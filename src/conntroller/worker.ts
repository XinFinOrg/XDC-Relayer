
import { CronJob } from "cron";
import { SubnetBlockInfo, SubnetService } from "../service/subnet";
import { MainnetClient} from "../service/mainnet";
import { Config } from "../config";
import { chunkBy } from "../utils";
import { Cache } from "../service/cache";
import { ForkingError } from "./../errors/forkingError";
import { Nofications } from "../service/notification";


const MAX_FETCH_BLOCK_SIZE = 10;
const chunkByMaxFetchSize = chunkBy(MAX_FETCH_BLOCK_SIZE);
export class Worker {
  cron: CronJob;
  abnormalDetectionCronJob: CronJob;
  mainnetClient: MainnetClient;
  subnetService: SubnetService;
  isBootstraping: boolean;
  cache: Cache;
  notification: Nofications;

  constructor(config: Config, onAbnormalDetected: () => void) {
    this.cache = new Cache();
    this.isBootstraping = false;
    this.mainnetClient = new MainnetClient(config.mainnet);
    this.subnetService = new SubnetService(config.subnet);
    this.notification = new Nofications(config.notification, this.cache);
    this.cron = new CronJob(config.cronJob.jobExpression, async () => {
      try {
        if (this.isBootstraping) return;
        console.info("⏰ Executing normal flow periodically");
        // Pull subnet's latest committed block
        const lastSubmittedSubnetBlock = await this.cache.getLastSubmittedSubnetHeader();
        const lastCommittedBlockInfo = await this.subnetService.getLastCommittedBlockInfo();
        
        await this.diffAndSubmitTxs(lastSubmittedSubnetBlock.subnetBlockHash, lastSubmittedSubnetBlock.subnetBlockNumber, lastCommittedBlockInfo);
        this.cache.setLastSubmittedSubnetHeader(lastCommittedBlockInfo);  
      } catch (error) {
        console.error("Fail to run cron job normally", {message: error.message});
        if (error instanceof ForkingError) {
          this.notification.postForkingErrorMessage(error.message);
        }
        onAbnormalDetected();
      }
    });
    
    this.abnormalDetectionCronJob = new CronJob(config.cronJob.abnormalDetectionExpression, async () => {
      if (this.isBootstraping) return;
      console.info("🏥 Executing abnormal Detection by restart the bootstrap periodically");
      // Trigger the callback to initiatiate the bootstrap in event bus again
      onAbnormalDetected();
    });
  }

  async bootstrap(): Promise<boolean> {
    let success = false;
    try {
      this.cache.cleanCache();
      this.isBootstraping = true;
      // Clean timers
      this.cron.stop();
      this.abnormalDetectionCronJob.stop();
      // Pull latest confirmed tx from mainnet
      const { smartContractHash, smartContractHeight} = await this.mainnetClient.getLastAudittedBlock();
      // Pull latest confirm block from subnet
      const lastestSubnetCommittedBlock = await this.subnetService.getLastCommittedBlockInfo();
      // Diffing and push the blocks into mainnet as transactions
      await this.diffAndSubmitTxs(smartContractHash, smartContractHeight, lastestSubnetCommittedBlock);
  
      // // Store subnet block into cache
      this.cache.setLastSubmittedSubnetHeader(lastestSubnetCommittedBlock);
      success = true;
    } catch (error) {
      console.error("Fail to bootstrap", {message: error.message});
      if (error instanceof ForkingError) {
        this.notification.postForkingErrorMessage(error.message);
      }
    }
    this.isBootstraping = false;
    return success;
  }
  
  async synchronization(): Promise<void> {
    console.info("Start the synchronization to audit the subnet block by submit smart contract transaction onto XDC's mainnet");
    this.cron.start();
    this.abnormalDetectionCronJob.start();
  }
  
  private async diffAndSubmitTxs(lastAuditedBlockHash: string, lastAuditedBlockHeight: number, lastestSubnetCommittedBlock: SubnetBlockInfo): Promise<void> {
    const { subnetBlockHash, subnetBlockNumber } = lastestSubnetCommittedBlock;
    
    if (subnetBlockNumber < lastAuditedBlockHeight) {
      const mainnetHash = await this.mainnetClient.getBlockHashByNumber(lastAuditedBlockHeight);
      if (mainnetHash != subnetBlockHash) {
        console.error("⛔️ WARNING: Forking detected when smart contract is ahead of subnet");
        throw new ForkingError(lastAuditedBlockHeight, mainnetHash, subnetBlockHash);
      }
      console.info("Smart contract is ahead of subnet, nothing needs to be done, just wait");
      return;
    } else if (subnetBlockNumber == lastAuditedBlockHeight) {
      if (lastAuditedBlockHash != subnetBlockHash) {
        console.error("⛔️ WARNING: Forking detected when subnet and smart contract having the same height");
        throw new ForkingError(lastAuditedBlockHeight, lastAuditedBlockHash, subnetBlockHash);
      }
      console.info("Smart contract and subnet are already in sync, nothing needs to be done, waiting for new blocks");
      return;
    } else {
      // subnetBlockNumber > lastAuditedBlockHeight
      const auditedBlockInfoInSubnet = await this.subnetService.getCommittedBlockInfoByNum(lastAuditedBlockHeight);
      if (auditedBlockInfoInSubnet.subnetBlockHash != lastAuditedBlockHash) {
        console.error("⛔️ WARNING: Forking detected when subnet is ahead of smart contract");
        throw new ForkingError(lastAuditedBlockHeight, lastAuditedBlockHash, auditedBlockInfoInSubnet.subnetBlockHash);
      }
      // Do the transactions, everything seems normal
      let startingBlockNumberToFetch = lastAuditedBlockHeight + 1;
      const blocksToFetchInChunks = chunkByMaxFetchSize(subnetBlockNumber - lastAuditedBlockHeight);
      console.info(`Start syncing with smart contract from block ${startingBlockNumberToFetch} to ${subnetBlockNumber}`);
      for await (const numOfBlocks of blocksToFetchInChunks) {
        const results = await this.subnetService.bulkGetRlpEncodedHeaders(startingBlockNumberToFetch, numOfBlocks);
        await this.mainnetClient.submitTxs(results);
        startingBlockNumberToFetch+=numOfBlocks;
      }
      console.log("Sync completed!");
      return;
    }
  }
}