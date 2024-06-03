import bunyan from "bunyan";
import { ZeroService } from "../service/zero";
import { config } from "../config";
import { BaseProcessor } from "./base";

export const NAME = "REVERSE-ZERO";
const REPEAT_JOB_OPT = {
  jobId: NAME,
  repeat: { cron: config.cronJob.zeroJobExpression },
};

export class ReverseZero extends BaseProcessor {
  private logger: bunyan;
  private zeroService: ZeroService;

  constructor(logger: bunyan) {
    super(NAME);
    this.logger = logger;
    this.zeroService = new ZeroService(logger);
  }
  init() {
    this.logger.info("Initialising Reverse XDC-Zero");
    this.zeroService.init();
    this.queue.process(async (_, done) => {
      this.logger.info("⏰ Executing xdc-zero periodically");
      try {
        done(null, await this.processEvent());
      } catch (error) {
        this.logger.error("Fail to process reverse xdc-zero job", {
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
      const msg = "Nothing to process in xdc-zero, wait for the next event log";
      this.logger.info(msg);
      return msg;
    }
    const lastPayload = payloads[payloads.length - 1];
    const lastIndexFromSubnet = lastPayload[0];

    const lastIndexfromParentnet =
      await this.zeroService.getIndexFromParentnet();

    const lastBlockNumber = lastPayload[7];
    const cscBlockNumber = await this.zeroService.getLatestBlockNumberFromCsc();
    if (cscBlockNumber < lastBlockNumber) {
      const msg = `Wait for csc block lastBlockNumber: ${lastBlockNumber}, cscBlockNumber: ${cscBlockNumber}`;
      this.logger.info(msg);
      return msg;
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
    const msg = `Completed the xdc-zero sync up till ${lastIndexFromSubnet} from subnet, wait for the next cycle`;
    this.logger.info(msg);
    return msg;
  }
}
