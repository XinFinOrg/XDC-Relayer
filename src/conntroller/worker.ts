import { SmartContractData } from "./../service/mainnet/index";

import { CronJob } from "cron";
import { SubnetBlockInfo, SubnetService } from "../service/subnet";
import { MainnetClient} from "../service/mainnet";
import { Config } from "../config";
import { chunkBy } from "../utils";
import { Cache } from "../service/cache";
import { ForkingError } from "./../errors/forkingError";
import { Nofications } from "../service/notification";


const MAX_FETCH_BLOCK_SIZE = 30;

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
    this.notification = new Nofications(config.notification, this.cache, config.devMode);
    this.cron = new CronJob(config.cronJob.jobExpression, async () => {
      try {
        if (this.isBootstraping) return;
        console.info("⏰ Executing normal flow periodically");
        // Pull subnet's latest committed block
        const lastSubmittedSubnetBlock = await this.cache.getLastSubmittedSubnetHeader();
        const lastCommittedBlockInfo = await this.subnetService.getLastCommittedBlockInfo();
        await this.submitTxs(lastSubmittedSubnetBlock.subnetBlockNumber, lastCommittedBlockInfo.subnetBlockNumber);
        
        this.cache.setLastSubmittedSubnetHeader(lastCommittedBlockInfo);  
      } catch (error) {
        console.error("Fail to run cron job normally", {message: error.message});
        if (error instanceof ForkingError) {
          this.notification.postForkingErrorMessage(error.message);
        }
        //onAbnormalDetected();
      }
    });
    
    this.abnormalDetectionCronJob = new CronJob(config.cronJob.abnormalDetectionExpression, async () => {
      if (this.isBootstraping) return;
      console.info("🏥 Executing abnormal Detection by restart the bootstrap periodically");
      // Trigger the callback to initiatiate the bootstrap in event bus again
      // onAbnormalDetected();
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
      const smartContractData = await this.mainnetClient.getLastAudittedBlock();
      // Pull latest confirm block from subnet
      const lastestSubnetCommittedBlock = await this.subnetService.getLastCommittedBlockInfo();
      
      const { shouldProcess, from } = await this.shouldProcessSync(smartContractData, lastestSubnetCommittedBlock);
      
      if (shouldProcess) {
        await this.submitTxs(from, lastestSubnetCommittedBlock.subnetBlockNumber);
        // Store subnet block into cache
        this.cache.setLastSubmittedSubnetHeader(lastestSubnetCommittedBlock);
      }
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
  
  // This method does all the necessary verifications before submit blocks as transactions into mainnet XDC
  private async shouldProcessSync(smartContractData: SmartContractData, lastestSubnetCommittedBlock: SubnetBlockInfo): Promise<
    { shouldProcess: boolean, from?: number }
  > {
    const { subnetBlockHash, subnetBlockNumber } = lastestSubnetCommittedBlock;
    const { 
      smartContractHash, smartContractHeight,
      smartContractCommittedHash, smartContractCommittedHeight
    } = smartContractData;
    
    if (subnetBlockNumber < smartContractCommittedHeight) {
      const subnetHashInSmartContract = await this.mainnetClient.getBlockHashByNumber(subnetBlockNumber);
    
      if (subnetHashInSmartContract != subnetBlockHash) {
        console.error("⛔️ WARNING: Forking detected when smart contract is ahead of subnet");
        throw new ForkingError(subnetBlockNumber, subnetHashInSmartContract, subnetBlockHash);
      }
      console.info("Smart contract is ahead of subnet, nothing needs to be done, just wait");
      return { shouldProcess: false };
    } else if (subnetBlockNumber == smartContractCommittedHeight) {
      if (smartContractCommittedHash != subnetBlockHash) {
        console.error("⛔️ WARNING: Forking detected when subnet and smart contract having the same height");
        throw new ForkingError(smartContractCommittedHeight, smartContractCommittedHash, subnetBlockHash);
      }
      console.info("Smart contract committed and subnet are already in sync, nothing needs to be done, waiting for new blocks");
      return { shouldProcess: false };
    } else {
      // Check the committed
      const auditedCommittedBlockInfoInSubnet = await this.subnetService.getCommittedBlockInfoByNum(smartContractCommittedHeight);
      if (auditedCommittedBlockInfoInSubnet.subnetBlockHash != smartContractCommittedHash) {
        console.error("⛔️ WARNING: Forking detected when subnet is ahead of smart contract");
        throw new ForkingError(smartContractCommittedHeight, smartContractCommittedHash, auditedCommittedBlockInfoInSubnet.subnetBlockHash);
      }
      // Verification for committed blocks are completed! We need to check where we shall start sync based on the last audited block (smartContractHash and height) in mainnet
      if (smartContractHash == subnetBlockHash) { // Same block height and hash
        console.info("Smart contract latest and subnet are already in sync, nothing needs to be done, waiting for new blocks");
        return { shouldProcess: false };
      } else if (subnetBlockNumber < smartContractHeight) { // This is when subnet is behind the mainnet latest auditted
        const subnetHashInSmartContract = await this.mainnetClient.getBlockHashByNumber(subnetBlockNumber);
        if (subnetHashInSmartContract != subnetBlockHash) { // This only happens when there is a forking happened but not yet committed on mainnet, we will need to recursively submit subnet headers from diverging point
          const { divergingHeight } = await this.findDivergingPoint(subnetBlockNumber);
          return {
            shouldProcess: true, from: divergingHeight
          };
        }
        console.warn("Subnet is behind mainnet latest auditted blocks! This usually means there is another relayer on a different node who is ahead of this relayer in terms of mining and submitting txs. OR there gonna be forking soon!");
        return { shouldProcess: false };
      }
      // Below is the case where subnet is ahead of mainnet and we need to do some more checks before submit txs
      const audittedBlockInfoInSubnet = await this.subnetService.getCommittedBlockInfoByNum(smartContractHeight);
      if (audittedBlockInfoInSubnet.subnetBlockHash != smartContractHash) {
        const { divergingHeight } = await this.findDivergingPoint(smartContractHeight);
          return {
            shouldProcess: true, from: divergingHeight
          };
      }
      // Everything seems normal, we will just submit txs from this point onwards.
      return {
        shouldProcess: true, from: smartContractHeight
      };
    }
  }
  
  // Find the point where after this "divering block", chain start to split (fork)
  private async findDivergingPoint(heightToSearchFrom: number): Promise<{ divergingHeight: number, divergingHash: string}> {
    const mainnetHash = await this.mainnetClient.getBlockHashByNumber(heightToSearchFrom);
    const subnetBlockInfo = await this.subnetService.getCommittedBlockInfoByNum(heightToSearchFrom);
    if (mainnetHash != subnetBlockInfo.subnetBlockHash) {
      return this.findDivergingPoint(heightToSearchFrom - 1);
    }
    return {
      divergingHash: mainnetHash,
      divergingHeight: heightToSearchFrom
    } ;
  }
  
  // "from" is exclusive, we submit blocks "from + 1" till "to"
  private async submitTxs(from: number, to: number): Promise<void> {
    let startingBlockNumberToFetch = from + 1;
    const blocksToFetchInChunks = chunkByMaxFetchSize(to - from);
    console.info(`Start syncing with smart contract from block ${startingBlockNumberToFetch} to ${to}`);
    for await (const numOfBlocks of blocksToFetchInChunks) {
      const results = await this.subnetService.bulkGetRlpEncodedHeaders(startingBlockNumberToFetch, numOfBlocks);
      await this.mainnetClient.submitTxs(results);
      startingBlockNumberToFetch+=numOfBlocks;
    }
    console.log("Sync completed!");
    return;
  }
}