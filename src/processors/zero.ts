import bunyan from "bunyan";
import { ZeroService } from "../service/zero";
import { config } from "../config";
import { BaseProcessor } from "./base";

export const NAME = "ZERO";
const REPEAT_JOB_OPT = {
  jobId: NAME,
  repeat: { cron: config.cronJob.zeroJobExpression },
};

export class Zero extends BaseProcessor {
  private logger: bunyan;
  private zeroService: ZeroService;

  constructor(logger: bunyan) {
    super(NAME);
    this.logger = logger;
    this.zeroService = new ZeroService(logger);
  }
  init() {
    this.logger.info("Initialising XDC-Zero");
    this.zeroService.init();
    this.queue.process(async (_, done) => {
      this.logger.info("⏰ Executing xdc-zero periodically");
      try {
        done(null, await this.processEvent());
      } catch (error) {
        this.logger.error("Fail to process xdc-zero job", {
          message: error.message,
        });
        // Report the error
        done(error);
        await this.reset();
      }
    });
    return this;
  }
  
  async reset(): Promise<void> {
    await this.queue.add({}, REPEAT_JOB_OPT);
  }
  
  async processEvent() {
    const payloads = await this.zeroService.getPayloads();
    if (payloads.length == 0) {
      this.logger.info(
        "Nothing to process in xdc-zero, wait for the next event log"
      );
      return;
    }
    const lastPayload = payloads[payloads.length - 1];
    const lastIndexFromSubnet = lastPayload[0];

    const lastIndexfromParentnet =
      await this.zeroService.getIndexFromParentnet();

    const lastBlockNumber = lastPayload[7];
    const cscBlockNumber = await this.zeroService.getLatestBlockNumberFromCsc();
    if (cscBlockNumber < lastBlockNumber) {
      this.logger.info(
        "wait for csc block lastBlockNumber:" +
          lastBlockNumber +
          " cscBlockNumber:" +
          cscBlockNumber
      );
      return;
    }

    if (lastIndexFromSubnet > lastIndexfromParentnet) {
      for (let i = lastIndexfromParentnet; i < lastIndexFromSubnet; i++) {
        if (payloads?.[i]?.[6]) {
          const proof = await this.zeroService.getProof(payloads[i][6]);
          await this.zeroService.validateTransactionProof(
            proof.key,
            proof.receiptProofValues,
            proof.txProofValues,
            proof.blockHash
          );
          this.logger.info("sync zero index " + i + " success");
        }
      }
    }
    this.logger.info("Completed the xdc-zero sync, wait for the next cycle");
  }
}
