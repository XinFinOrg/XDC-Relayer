import { SmartContractData } from "./../service/mainnet/index";

import { CronJob } from "cron";
import { SubnetBlockInfo, SubnetService } from "../service/subnet";
import { MainnetClient} from "../service/mainnet";
import { Config } from "../config";
import { chunkBy, sleep } from "../utils";
import { Cache } from "../service/cache";
import { ForkingError } from "./../errors/forkingError";
import { Nofications } from "../service/notification";
import bunyan from "bunyan";


const MAX_FETCH_BLOCK_SIZE = 30;

const chunkByMaxFetchSize = chunkBy(MAX_FETCH_BLOCK_SIZE);
export class Worker {
  cron: CronJob;
  mainnetClient: MainnetClient;
  subnetService: SubnetService;
  cache: Cache;
  notification: Nofications;
  config: Config;
  logger: bunyan;

  constructor(config: Config, logger: bunyan) {
    this.logger = logger;
    this.config = config;
    this.cache = new Cache(logger);
    this.mainnetClient = new MainnetClient(config.mainnet, logger);
    this.subnetService = new SubnetService(config.subnet, logger);
    this.notification = new Nofications(config.notification, this.cache, logger, config.devMode);
    this.cron = new CronJob(config.cronJob.jobExpression, async () => {
      try {
        logger.info("⏰ Executing normal flow periodically");
        // Pull subnet's latest committed block
        const lastSubmittedSubnetBlock = await this.getLastSubmittedSubnetHeader();
        const lastCommittedBlockInfo = await this.subnetService.getLastCommittedBlockInfo();
        if (lastCommittedBlockInfo.subnetBlockNumber <= lastSubmittedSubnetBlock.subnetBlockNumber) {
          logger.info(`Already on the latest, nothing to subnet, Subnet latest: ${lastCommittedBlockInfo.subnetBlockNumber}, smart contract latest: ${lastSubmittedSubnetBlock.subnetBlockNumber}`);
          return;
        }
        await this.submitTxs(lastSubmittedSubnetBlock.subnetBlockNumber, lastCommittedBlockInfo.subnetBlockNumber);
        this.cache.setLastSubmittedSubnetHeader(lastCommittedBlockInfo);  
      } catch (error) {
        logger.error("Fail to run cron job normally", {message: error.message});
        this.postNotifications(error);
        this.synchronization();
      }
    });
  }
  
  async getLastSubmittedSubnetHeader(): Promise<SubnetBlockInfo> {
    const lastSubmittedSubnetBlock = this.cache.getLastSubmittedSubnetHeader();
    if (lastSubmittedSubnetBlock) return lastSubmittedSubnetBlock;
    // Else, our cache don't have such data
    const smartContractData = await this.mainnetClient.getLastAudittedBlock();
    return await this.subnetService.getCommittedBlockInfoByNum(smartContractData.smartContractHeight);
  }
  
  async bootstrap(): Promise<boolean> {
    try {
      // Clean timer
      this.cache.cleanCache();
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
      return true;
    } catch (error) {
      this.postNotifications(error);
      this.logger.error(`Error while bootstraping, system will go into sleep mode for ${this.config.reBootstrapWaitingTime/1000/60} minutes before re-processing!, message: ${error?.message}`);
      return false;
    }
  }
  
  async synchronization(): Promise<void> {
    this.logger.info("Start the synchronization to audit the subnet block by submit smart contract transaction onto XDC's mainnet");
    this.cron.stop();
    while(!(await this.bootstrap())) {
      await sleep(this.config.reBootstrapWaitingTime);
    }
    return this.cron.start();
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
        this.logger.error("⛔️ WARNING: Forking detected when smart contract is ahead of subnet");
        throw new ForkingError(subnetBlockNumber, subnetHashInSmartContract, subnetBlockHash);
      }
      this.logger.info("Smart contract is ahead of subnet, nothing needs to be done, just wait");
      return { shouldProcess: false };
    } else if (subnetBlockNumber == smartContractCommittedHeight) {
      if (smartContractCommittedHash != subnetBlockHash) {
        this.logger.error("⛔️ WARNING: Forking detected when subnet and smart contract having the same height");
        throw new ForkingError(smartContractCommittedHeight, smartContractCommittedHash, subnetBlockHash);
      }
      this.logger.info("Smart contract committed and subnet are already in sync, nothing needs to be done, waiting for new blocks");
      return { shouldProcess: false };
    } else {
      // Check the committed
      const auditedCommittedBlockInfoInSubnet = await this.subnetService.getCommittedBlockInfoByNum(smartContractCommittedHeight);
      if (auditedCommittedBlockInfoInSubnet.subnetBlockHash != smartContractCommittedHash) {
        this.logger.error("⛔️ WARNING: Forking detected when subnet is ahead of smart contract");
        throw new ForkingError(smartContractCommittedHeight, smartContractCommittedHash, auditedCommittedBlockInfoInSubnet.subnetBlockHash);
      }
      // Verification for committed blocks are completed! We need to check where we shall start sync based on the last audited block (smartContractHash and height) in mainnet
      if (smartContractHash == subnetBlockHash) { // Same block height and hash
        this.logger.info("Smart contract latest and subnet are already in sync, nothing needs to be done, waiting for new blocks");
        return { shouldProcess: false };
      } else if (subnetBlockNumber < smartContractHeight) { // This is when subnet is behind the mainnet latest auditted
        const subnetHashInSmartContract = await this.mainnetClient.getBlockHashByNumber(subnetBlockNumber);
        if (subnetHashInSmartContract != subnetBlockHash) { // This only happens when there is a forking happened but not yet committed on mainnet, we will need to recursively submit subnet headers from diverging point
          const { divergingHeight } = await this.findDivergingPoint(subnetBlockNumber);
          return {
            shouldProcess: true, from: divergingHeight
          };
        }
        this.logger.warn("Subnet is behind mainnet latest auditted blocks! This usually means there is another relayer on a different node who is ahead of this relayer in terms of mining and submitting txs. OR there gonna be forking soon!");
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
    this.logger.info(`Start syncing with smart contract from block ${startingBlockNumberToFetch} to ${to}`);
    for await (const numOfBlocks of blocksToFetchInChunks) {
      const results = await this.subnetService.bulkGetRlpEncodedHeaders(startingBlockNumberToFetch, numOfBlocks);
      await this.mainnetClient.submitTxs(results);
      startingBlockNumberToFetch+=numOfBlocks;
    }
    this.logger.info("Sync completed!");
    return;
  }
  
  private postNotifications(error: Error) {
    try {
      if (error instanceof ForkingError) {
        this.notification.postForkingErrorMessage(error.message);
      } else {
        this.notification.postErrorMessage(error.message);
      }  
    } catch (error) {
      this.logger.error("Fail to publish notifications");
    }
  }
}