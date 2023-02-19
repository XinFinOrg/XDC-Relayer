import { CronJob } from "cron";
import { ChainNotInSync } from "./../errors/chainNotInSync";
import { BlockHashMismatch } from "./../errors/blockHashMismatch copy";
import { InvalidBlockHeight } from "./../errors/invalidblockHeight";
import { SubnetBlockInfo, SubnetService } from "../service/subnet";
import { MainnetClient } from "../service/mainnet";
import { config } from "../config";
import { chunkBy } from "../utils";
import { Cache } from "../service/cache";


const MAX_FETCH_BLOCK_SIZE = 2;
const chunkByMaxFetchSize = chunkBy(MAX_FETCH_BLOCK_SIZE);
export class Worker {
  private cron: CronJob;
  private abnormalDetectionCronJob: CronJob;
  private mainnetClient: MainnetClient;
  private subnetService: SubnetService;
  private isBootstraping: boolean;
  private cache: Cache;

  constructor(onAbnormalDetected: () => void) {
    this.cache = new Cache();
    this.isBootstraping = false;
    this.mainnetClient = new MainnetClient(config.mainnet);
    this.subnetService = new SubnetService(config.subnet);
    this.cron = new CronJob(config.cronJob.jobExpression, async () => {
      if (this.isBootstraping) return;
      console.info("⏰ Executing normal flow periodically");
      // Pull subnet's latest committed block
      const lastSubmittedSubnetBlock = await this.cache.getLastSubmittedSubnetHeader();
      const lastCommittedBlockInfo = await this.subnetService.getLastCommittedBlockInfoByNum();
      
      await this.diffAndSubmitTxs(lastSubmittedSubnetBlock.subnetBlockHash, lastCommittedBlockInfo);
      this.cache.setLastSubmittedSubnetHeader(lastCommittedBlockInfo);
    });
    
    this.abnormalDetectionCronJob = new CronJob(config.cronJob.abnormalDetectionExpression, async () => {
      if (this.isBootstraping) return;
      console.info("🏥 Executing abnormal Detection periodically");
      
      // Pull latest confirmed tx from mainnet
      const lastAuditedBlockHash = await this.mainnetClient.getLastAuditedBlockHash();
      // Pull latest confirm block from subnet
      const lastestSubnetCommittedBlock = await this.subnetService.getLastCommittedBlockInfoByNum();
      const { subnetBlockHash: mainnetBlockHash, subnetBlockNumber: mainnetBlockNumber } = await this.subnetService.getLastV2BlockInfoByHash(lastAuditedBlockHash);
      if (!mainnetBlockNumber || (mainnetBlockNumber != lastestSubnetCommittedBlock.subnetBlockNumber)) {
        console.error("ERROR! Chain not in sync!", lastAuditedBlockHash, lastestSubnetCommittedBlock, mainnetBlockNumber, mainnetBlockHash);
        throw new ChainNotInSync(`Chain not in sync for the last audited block hash of ${lastAuditedBlockHash} from mainnet smart contract!`);
      }
      // Trigger the callback to initiatiate the bootstrap in event bus again
      onAbnormalDetected();
    });
  }

  async bootstrap(): Promise<boolean> {
    let success = false;
    try {
      this.isBootstraping = true;
      // Clean timers
      this.cron.stop();
      this.abnormalDetectionCronJob.stop();
      // Pull latest confirmed tx from mainnet
      const lastAuditedBlockHash = await this.mainnetClient.getLastAuditedBlockHash();
      // Pull latest confirm block from subnet
      const lastestSubnetCommittedBlock = await this.subnetService.getLastCommittedBlockInfoByNum();
      // Diffing and push the blocks into mainnet as transactions
      await this.diffAndSubmitTxs(lastAuditedBlockHash, lastestSubnetCommittedBlock);
  
      // Store subnet block into cache
      this.cache.setLastSubmittedSubnetHeader(lastestSubnetCommittedBlock);
      success = true;
    } catch (error) {
      console.error("Fail to bootstrap", {message: error.message});
    }
    this.isBootstraping = false;
    return success;
  }
  
  async synchronization(): Promise<void> {
    console.info("Start the synchronization to audit the subnet block by submit smart contract transaction onto XDC's mainnet");
    this.cron.start();
    this.abnormalDetectionCronJob.start();
  }
  
  async diffAndSubmitTxs(lastAuditedBlockHash: string, lastestSubnetCommittedBlock: SubnetBlockInfo): Promise<void> {
    const { subnetBlockHash, subnetBlockRound, subnetBlockNumber } = lastestSubnetCommittedBlock;
    if (subnetBlockHash != lastAuditedBlockHash) {
      const { subnetBlockHash: mainnetBlockHash, subnetBlockNumber: mainnetBlockNumber } = await this.subnetService.getLastV2BlockInfoByHash(lastAuditedBlockHash);
      switch (true) {
        case (mainnetBlockNumber > subnetBlockNumber):
          console.error("Invalid mainnet block height received!", mainnetBlockNumber, subnetBlockNumber, subnetBlockRound);
          throw new InvalidBlockHeight(mainnetBlockNumber, subnetBlockNumber);
        case (mainnetBlockNumber === subnetBlockNumber):
          console.error(`Same block height but hash mismatch, blockNumber: ${subnetBlockNumber}, at mainnetHash: ${mainnetBlockHash} and subnetHash: ${subnetBlockHash}`, subnetBlockRound);
            throw new BlockHashMismatch(mainnetBlockNumber, mainnetBlockHash, subnetBlockHash);
        default:
          // The main diffing logic
          let startingBlockNumberToFetch = mainnetBlockNumber + 1;
          const blocksToFetchInChunks = chunkByMaxFetchSize(subnetBlockNumber - mainnetBlockNumber);
          for await (const numOfBlocks of blocksToFetchInChunks) {
            const results = await this.subnetService.bulkGetRlpEncodedHeaders(startingBlockNumberToFetch, numOfBlocks);
            await this.mainnetClient.submitTxs(results);
            startingBlockNumberToFetch+=numOfBlocks;
          }
          break;
      }
    }
  }
}