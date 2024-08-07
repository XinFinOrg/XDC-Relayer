import bunyan from "bunyan";
import { ZeroService } from "../service/zero/index";
import { config } from "../config";
import { BaseProcessor } from "./base";

export const NAME = "REVERSE_ZERO";
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
    this.zeroService = new ZeroService(logger, "reverse");
  }
  init() {
    this.logger.info("Initialising Reverse-XDC-Zero");
    this.zeroService.init();
    this.queue.process(async (_, done) => {
      this.logger.info("⏰ Executing reverse-xdc-zero periodically");
      try {
        done(null, await this.processEvent());
      } catch (error) {
        this.logger.error("Fail to process reverse-xdc-zero job", {
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
      const msg =
        "Nothing to process in reverse-xdc-zero, wait for the next event log";
      this.logger.info(msg);
      return msg;
    }
    const lastPayload = payloads[payloads.length - 1];
    const lastIndexFromSubnet = lastPayload[0];

    const lastBlockNumber = lastPayload[7];
    const cscBlockNumber = await this.zeroService.getLatestBlockNumberFromCsc();
    if (cscBlockNumber < lastBlockNumber) {
      const msg = `Wait for csc block lastBlockNumber: ${lastBlockNumber}, cscBlockNumber: ${cscBlockNumber}`;
      this.logger.info(msg);
      return msg;
    }
    const lastIndexFromParentnet =
      await this.zeroService.getLastIndexFromParentnet();

    for (let i = lastIndexFromParentnet; i < lastIndexFromSubnet; i++) {
      const payload = payloads?.[i];
      const transactionHash = payload?.[6];
      if (transactionHash) {
        const proof = await this.zeroService.getProof(transactionHash);
        await this.zeroService.validateTransactionProof(
          proof.key,
          proof.receiptProofValues,
          proof.txProofValues,
          proof.blockHash
        );
        this.logger.info("Reverse Zero: sync index " + i + " success");
      }
    }

    const msg = `Completed the reverse-xdc-zero sync up till ${lastIndexFromSubnet} from parentnet, wait for the next cycle`;
    this.logger.info(msg);
    return msg;
  }
}
