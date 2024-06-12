import bunyan from "bunyan";
import { LiteMainnetService, SmartContractData } from "../service/mainnet";
import { config } from "../config";
import { SubnetService } from "../service/subnet";
import { ForkingError } from "../errors/forkingError";
import { BaseProcessor } from "./base";


export const NAME = "LITE";

export class Lite extends BaseProcessor {
  logger: bunyan;
  liteMainnetService: LiteMainnetService;
  subnetService: SubnetService;
  
  constructor(logger: bunyan) {
    super(NAME);
    this.logger = logger;
    this.liteMainnetService = new LiteMainnetService(config.mainnet, logger);
    // this.subnetService = new SubnetService(config.subnet, logger);
  }
  
  init() {
    this.logger.info("Initialising XDC Lite relayer");

    this.queue.process(async (_, done) => {
      this.logger.info("⏰ Executing lite flow periodically");
      try {
        done(null, await this.processEvent());
      } catch (error) {
        this.logger.error("Fail to process lite relayer job", {
          message: error.message,
        });
        done(error);
      }
    });
    return this;
  };
  
  // In lite mode, the reset does nothing other than just trigger the jobs. We can trigger it multiple time, it has no effect
  async reset(): Promise<void> {
    await this.queue.add({}, { jobId: NAME, repeat: { cron: config.cronJob.liteJobExpression}});
  }
  
  private async processEvent() {
    // Pull latest confirmed tx from mainnet
    const latestBlock = await this.liteMainnetService.getLastAuditedBlock();
    // Pull latest confirm block from subnet
    const lastestSubnetCommittedBlock =
      await this.subnetService.getLastCommittedBlockInfo();

    const gapAndEpoch = await this.liteMainnetService.getGapAndEpoch();
    await this.liteSubmitTxs(
      gapAndEpoch,
      latestBlock,
      lastestSubnetCommittedBlock.subnetBlockNumber
    );
    
    return `Successfully submitted subnet header up till ${lastestSubnetCommittedBlock.subnetBlockNumber} into parent chain`;
  }
  
  private async liteSubmitTxs(
    gapAndEpoch: { gap: number; epoch: number },
    latestBlock: SmartContractData,
    to: number
  ): Promise<void> {
    const gap = gapAndEpoch.gap;
    const epoch = gapAndEpoch.epoch;
    let scHeight = latestBlock.smartContractHeight;
    let scHash = latestBlock.smartContractHash;
    let scCommittedHeight = latestBlock.smartContractCommittedHeight;
    const scCommittedHash = latestBlock.smartContractCommittedHash;

    let continueScan = true;
    this.logger.info(
      `Start syncing with smart contract from block ${scHeight} to ${to}`
    );

    while (continueScan) {
      this.logger.info(
        `Current epoch number ${scHeight} committed epoch number ${scCommittedHeight}`
      );
      if (scHeight != scCommittedHeight) {
        this.logger.info(
          `gap/epoch number ${scHeight} is not committed ,continue commit headers`
        );
        const unCommittedHeader =
          await this.liteMainnetService.getUnCommittedHeader(scHash);

        const lastNum = unCommittedHeader.lastNum;
        const sequence = unCommittedHeader.sequence;
        if (sequence >= 3 || lastNum == 0) {
          this.logger.error(
            `sequence >=3 or lastNum is 0 there are some wrong in gap/epoch number ${scHeight} `
          );
          throw new ForkingError(scHeight, scHash, scCommittedHash);
        }

        const startNum = Number(lastNum) + 1;

        const results = await this.subnetService.bulkGetRlpHeaders(startNum, 4);
        await this.liteMainnetService.commitHeader(
          scHash,
          results.map((item) => {
            return "0x" + item.encodedRLP;
          })
        );
      } else {
        //find next epoch
        if (scHeight % epoch == 0) {
          scHeight += epoch - gap + 1;
        } else {
          scHeight = (Math.floor(scHeight / epoch) + 1) * epoch;
        }
        this.logger.info(`Next epoch block number ${scHeight}`);
        if (scHeight > to) {
          this.logger.info(
            `Next epoch block number ${scHeight} greater than subnet node latest block number ${to} ,so stop sync , wait subnet node block grow up`
          );
          continueScan = false;
          break;
        }

        const results = await this.subnetService.bulkGetRlpHeaders(scHeight, 4);

        await this.liteMainnetService.submitTxs(results);
      }

      const last = await this.liteMainnetService.getLastAuditedBlock();
      scCommittedHeight = last.smartContractCommittedHeight;
      scHash = last.smartContractHash;
    }
    this.logger.info("Lite CSC Sync completed!");
    return;
  }
}