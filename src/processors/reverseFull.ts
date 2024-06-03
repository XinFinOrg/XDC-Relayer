import bunyan from "bunyan";
import { config } from "../config";
// import { MainnetService, SmartContractData } from "../service/mainnet";
// import { SubnetBlockInfo, SubnetService } from "../service/subnet";
import {SubnetService, SmartContractData } from "../service/subnet";
import {MainnetService, MainnetBlockInfo} from "../service/mainnet";
import { chunkBy, sleep } from "../utils";
import { ForkingError } from "../errors/forkingError";
import { BaseProcessor } from "./base";

const chunkByMaxFetchSize = chunkBy(config.chunkSize);
export const NAME = "REVERSE-FULL";
const REPEAT_JOB_OPT = { jobId: NAME, repeat: { cron: config.cronJob.jobExpression}};
export class ReverseFull extends BaseProcessor {
  private mainnetService: MainnetService;
  private subnetService: SubnetService;
  logger: bunyan;
  
  constructor(logger: bunyan) {
    super(NAME);
    this.logger = logger;
    this.mainnetService = new MainnetService(config.mainnet, logger);
    this.subnetService = new SubnetService(config.subnet, logger);
  }
  
  getQueue() {
    return this.queue;
  }
  
  init() {
    this.logger.info("Initialising Reverse XDC relayer");
    //TODO: check CSC mode is correct at init

    this.queue.process(async (_, done) => {
      this.logger.info("⏰ Executing normal flow periodically");
      try {
        done(null, await this.processEvent());
      } catch (error) {
        this.logger.error("Fail to process full reverse relayer job", {
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
    await this.queue.add({}, REPEAT_JOB_OPT);
  }
  
  async processEvent() {
    // Pull latest confirmed tx from mainnet
    const smartContractData = await this.subnetService.getLastAuditedBlock();
    // Pull latest confirmed block from subnet
    const latestMainnetCommittedBlock =
      await this.mainnetService.getLastCommittedBlockInfo();
    
    const { shouldProcess, from, msg } = await this.shouldProcessSync(
      smartContractData,
      latestMainnetCommittedBlock
    );
    
    if (shouldProcess) {
      await this.submitTxs(
        from,
        latestMainnetCommittedBlock.mainnetBlockNumber
      );
      return `Completed sync from ${from} to ${latestMainnetCommittedBlock.mainnetBlockNumber}`;
    }
    return msg;
  };

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
    lastestSubnetCommittedBlock: MainnetBlockInfo
  ): Promise<{ shouldProcess: boolean; msg?: string, from?: number }> {
    const { mainnetBlockHash, mainnetBlockNumber } = lastestSubnetCommittedBlock;
    const {
      smartContractHash,
      smartContractHeight,
      smartContractCommittedHash,
      smartContractCommittedHeight,
    } = smartContractData;

    if (mainnetBlockNumber < smartContractCommittedHeight) {
      const subnetHashInSmartContract =
        await this.mainnetService.getBlockHashByNumber(mainnetBlockNumber);

      if (subnetHashInSmartContract != mainnetBlockHash) {
        this.logger.error(
          "⛔️ WARNING: Forking detected when smart contract is ahead of subnet"
        );
        throw new ForkingError(
          mainnetBlockNumber,
          subnetHashInSmartContract,
          mainnetBlockHash
        );
      }
      const msg = "Smart contract is ahead of subnet, nothing needs to be done, just wait";
      return { shouldProcess: false, msg };
    } else if (mainnetBlockNumber == smartContractCommittedHeight) {
      if (smartContractCommittedHash != mainnetBlockHash) {
        this.logger.error(
          "⛔️ WARNING: Forking detected when subnet and smart contract having the same height"
        );
        throw new ForkingError(
          smartContractCommittedHeight,
          smartContractCommittedHash,
          mainnetBlockHash
        );
      }
      return { shouldProcess: false, msg: "Smart contract committed and subnet are already in sync, nothing needs to be done, waiting for new blocks" };
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
      if (smartContractHash == mainnetBlockHash) {
        // Same block height and hash
        return { shouldProcess: false, msg: "Smart contract latest and subnet are already in sync, nothing needs to be done, waiting for new blocks" };
      } else if (mainnetBlockNumber < smartContractHeight) {
        // This is when subnet is behind the mainnet latest audited
        const subnetHashInSmartContract =
          await this.mainnetService.getBlockHashByNumber(mainnetBlockNumber);
        if (subnetHashInSmartContract != mainnetBlockHash) {
          // This only happens when there is a forking happened but not yet committed on mainnet, we will need to recursively submit subnet headers from diverging point
          const { divergingHeight } = await this.findDivergingPoint(
            mainnetBlockNumber
          );
          return {
            shouldProcess: true,
            from: divergingHeight,
            msg: `Forking happened but not yet committed on mainnet, we will need to recursively submit subnet headers from diverging point of ${divergingHeight}`
          };
        }
        return { 
          shouldProcess: false,
          msg: "Subnet is behind mainnet latest audited blocks! This usually means there is another relayer on a different node who is ahead of this relayer in terms of mining and submitting txs. OR there gonna be forking soon!"
        };
      }
      // Below is the case where subnet is ahead of mainnet and we need to do some more checks before submit txs
      const auditedBlockInfoInSubnet =
        await this.subnetService.getCommittedBlockInfoByNum(
          smartContractHeight
        );
      if (auditedBlockInfoInSubnet.subnetBlockHash != smartContractHash) {
        const { divergingHeight } = await this.findDivergingPoint(
          smartContractHeight
        );
        return {
          shouldProcess: true,
          from: divergingHeight
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
    let currentHeight = heightToSearchFrom;
    // let mainnetHash: string;
    let subnetHash: string;
    // let subnetBlockInfo: SubnetBlockInfo;
    let mainnetBlockInfo: MainnetBlockInfo;
  
    while (currentHeight > 0) {
      subnetHash = await this.subnetService.getBlockHashByNumber(currentHeight);
      mainnetBlockInfo = await this.mainnetService.getCommittedBlockInfoByNum(currentHeight);
  
      if (subnetHash != mainnetBlockInfo.mainnetBlockHash) {
        currentHeight--;
      } else {
        break;
      }
    }
    return {
      divergingHash: subnetHash,
      divergingHeight: currentHeight
    };
  }
}