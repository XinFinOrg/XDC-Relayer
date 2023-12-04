import Bull from "bull";
import bunyan from "bunyan";
import { config } from "../config";
import { MainnetService, SmartContractData } from "../service/mainnet";
import { SubnetBlockInfo, SubnetService } from "../service/subnet";
import { Cache } from "../service/cache";
import { chunkBy, sleep } from "../utils";
import { ForkingError } from "../errors/forkingError";
import { ProcessorInterface } from "./type";

export const NAME = "STANDARD";

const chunkByMaxFetchSize = chunkBy(config.chunkSize);
const REPEAT_JOB_OPT = { jobId: NAME, repeat: { cron: config.cronJob.jobExpression}};

export class Standard implements ProcessorInterface {
  private queue: Bull.Queue;
  private mainnetService: MainnetService;
  private subnetService: SubnetService;
  cache: Cache;
  logger: bunyan;
  
  constructor(logger: bunyan) {
    this.logger = logger;
    this.queue = new Bull(NAME);
    this.mainnetService = new MainnetService(config.mainnet, logger);
    this.subnetService = new SubnetService(config.subnet, logger);
    this.cache = this.cache = new Cache(logger);
  }
  
  init() {
    this.logger.info("Initialising XDC relayer");
    this.queue.process(async (_, done) => {
      this.logger.info("⏰ Executing normal flow periodically");
      try {
        done(null, await this.processEvent());
      } catch (error) {
        this.logger.error("Fail to process standard relayer job", {
          message: error.message,
        });
        // Report the error
        done(error);
        await this.reset();
      }
    });
    return this;
  }
  
  // Reset and start the state sync until success
  async reset() {
    try {
      // Stop and remove repeatable jobs
      await this.queue.removeRepeatable(NAME, REPEAT_JOB_OPT.repeat);
      // Clean timer
      this.cache.cleanCache();
      // Pull latest confirmed tx from mainnet
      const smartContractData = await this.mainnetService.getLastAudittedBlock();
      // Pull latest confirm block from subnet
      const lastestSubnetCommittedBlock =
        await this.subnetService.getLastCommittedBlockInfo();
      const { shouldProcess, from } = await this.shouldProcessSync(
        smartContractData,
        lastestSubnetCommittedBlock
      );
      
      if (shouldProcess) {
        await this.submitTxs(
          from,
          lastestSubnetCommittedBlock.subnetBlockNumber
        );
        // Store subnet block into cache
        this.cache.setLastSubmittedSubnetHeader(lastestSubnetCommittedBlock);
      }
      // Keep the "jobId: NAME" and its repeat configuration here so that bull won't create a new repeated job each time we run this code.
      (await this.queue.add({}, REPEAT_JOB_OPT)).name;
    } catch (error) {
      this.logger.error(
        `Error while bootstraping, system will go into sleep mode for ${
          config.reBootstrapWaitingTime / 1000 / 60
        } minutes before re-processing!, message: ${error?.message}`
      );
      await sleep(config.reBootstrapWaitingTime);
      this.reset();
      // TODO: Add back the notification
    }
  }
  
  async processEvent() {
    // Pull subnet's latest committed block
    const lastSubmittedSubnetBlock = await this.getLastSubmittedSubnetHeader();
    const lastCommittedBlockInfo = await this.subnetService.getLastCommittedBlockInfo();
    if (
      lastCommittedBlockInfo.subnetBlockNumber <=
      lastSubmittedSubnetBlock.subnetBlockNumber
    ) {
      this.logger.info(
        `Already on the latest, nothing to subnet, Subnet latest: ${lastCommittedBlockInfo.subnetBlockNumber}, smart contract latest: ${lastSubmittedSubnetBlock.subnetBlockNumber}`
      );
      return;
    }
    await this.submitTxs(
      lastSubmittedSubnetBlock.subnetBlockNumber,
      lastCommittedBlockInfo.subnetBlockNumber
    );
    this.cache.setLastSubmittedSubnetHeader(lastCommittedBlockInfo);
  };
  
  
  async getLastSubmittedSubnetHeader(): Promise<SubnetBlockInfo> {
    const lastSubmittedSubnetBlock = this.cache.getLastSubmittedSubnetHeader();
    if (lastSubmittedSubnetBlock) return lastSubmittedSubnetBlock;
    // Else, our cache don't have such data
    const smartContractData = await this.mainnetService.getLastAudittedBlock();
    return await this.subnetService.getCommittedBlockInfoByNum(
      smartContractData.smartContractHeight
    );
  }


  // "from" is exclusive, we submit blocks "from + 1" till "to"
  private async submitTxs(from: number, to: number): Promise<void> {
    let startingBlockNumberToFetch = from + 1;
    const blocksToFetchInChunks = chunkByMaxFetchSize(to - from);
    this.logger.info(
      `Start syncing with smart contract from block ${startingBlockNumberToFetch} to ${to}`
    );
    for await (const numOfBlocks of blocksToFetchInChunks) {
      const results = await this.subnetService.bulkGetRlpHeaders(
        startingBlockNumberToFetch,
        numOfBlocks
      );
      await this.mainnetService.submitTxs(results);
      startingBlockNumberToFetch += numOfBlocks;
    }
    this.logger.info("Sync completed!");
    return;
  }
  
  
  // This method does all the necessary verifications before submit blocks as transactions into mainnet XDC
  private async shouldProcessSync(
    smartContractData: SmartContractData,
    lastestSubnetCommittedBlock: SubnetBlockInfo
  ): Promise<{ shouldProcess: boolean; from?: number }> {
    const { subnetBlockHash, subnetBlockNumber } = lastestSubnetCommittedBlock;
    const {
      smartContractHash,
      smartContractHeight,
      smartContractCommittedHash,
      smartContractCommittedHeight,
    } = smartContractData;

    if (subnetBlockNumber < smartContractCommittedHeight) {
      const subnetHashInSmartContract =
        await this.mainnetService.getBlockHashByNumber(subnetBlockNumber);

      if (subnetHashInSmartContract != subnetBlockHash) {
        this.logger.error(
          "⛔️ WARNING: Forking detected when smart contract is ahead of subnet"
        );
        throw new ForkingError(
          subnetBlockNumber,
          subnetHashInSmartContract,
          subnetBlockHash
        );
      }
      this.logger.info(
        "Smart contract is ahead of subnet, nothing needs to be done, just wait"
      );
      return { shouldProcess: false };
    } else if (subnetBlockNumber == smartContractCommittedHeight) {
      if (smartContractCommittedHash != subnetBlockHash) {
        this.logger.error(
          "⛔️ WARNING: Forking detected when subnet and smart contract having the same height"
        );
        throw new ForkingError(
          smartContractCommittedHeight,
          smartContractCommittedHash,
          subnetBlockHash
        );
      }
      this.logger.info(
        "Smart contract committed and subnet are already in sync, nothing needs to be done, waiting for new blocks"
      );
      return { shouldProcess: false };
    } else {
      // Check the committed
      const auditedCommittedBlockInfoInSubnet =
        await this.subnetService.getCommittedBlockInfoByNum(
          smartContractCommittedHeight
        );
      if (
        auditedCommittedBlockInfoInSubnet.subnetBlockHash !=
        smartContractCommittedHash
      ) {
        this.logger.error(
          "⛔️ WARNING: Forking detected when subnet is ahead of smart contract"
        );
        throw new ForkingError(
          smartContractCommittedHeight,
          smartContractCommittedHash,
          auditedCommittedBlockInfoInSubnet.subnetBlockHash
        );
      }
      // Verification for committed blocks are completed! We need to check where we shall start sync based on the last audited block (smartContractHash and height) in mainnet
      if (smartContractHash == subnetBlockHash) {
        // Same block height and hash
        this.logger.info(
          "Smart contract latest and subnet are already in sync, nothing needs to be done, waiting for new blocks"
        );
        return { shouldProcess: false };
      } else if (subnetBlockNumber < smartContractHeight) {
        // This is when subnet is behind the mainnet latest auditted
        const subnetHashInSmartContract =
          await this.mainnetService.getBlockHashByNumber(subnetBlockNumber);
        if (subnetHashInSmartContract != subnetBlockHash) {
          // This only happens when there is a forking happened but not yet committed on mainnet, we will need to recursively submit subnet headers from diverging point
          const { divergingHeight } = await this.findDivergingPoint(
            subnetBlockNumber
          );
          return {
            shouldProcess: true,
            from: divergingHeight,
          };
        }
        this.logger.warn(
          "Subnet is behind mainnet latest auditted blocks! This usually means there is another relayer on a different node who is ahead of this relayer in terms of mining and submitting txs. OR there gonna be forking soon!"
        );
        return { shouldProcess: false };
      }
      // Below is the case where subnet is ahead of mainnet and we need to do some more checks before submit txs
      const audittedBlockInfoInSubnet =
        await this.subnetService.getCommittedBlockInfoByNum(
          smartContractHeight
        );
      if (audittedBlockInfoInSubnet.subnetBlockHash != smartContractHash) {
        const { divergingHeight } = await this.findDivergingPoint(
          smartContractHeight
        );
        return {
          shouldProcess: true,
          from: divergingHeight,
        };
      }
      // Everything seems normal, we will just submit txs from this point onwards.
      return {
        shouldProcess: true,
        from: smartContractHeight,
      };
    }
  }
  
  
  // Find the point where after this "divering block", chain start to split (fork)
  private async findDivergingPoint(
    heightToSearchFrom: number
  ): Promise<{ divergingHeight: number; divergingHash: string }> {
    const mainnetHash = await this.mainnetService.getBlockHashByNumber(
      heightToSearchFrom
    );
    const subnetBlockInfo = await this.subnetService.getCommittedBlockInfoByNum(
      heightToSearchFrom
    );
    if (mainnetHash != subnetBlockInfo.subnetBlockHash) {
      return this.findDivergingPoint(heightToSearchFrom - 1);
    }
    return {
      divergingHash: mainnetHash,
      divergingHeight: heightToSearchFrom,
    };
  }

}