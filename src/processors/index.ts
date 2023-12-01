import { config } from "./../config";
import bunyan from "bunyan";
import * as _ from "lodash";
import { ProcessorInterface } from "./type";
import { Lite } from "./lite";
import { Standard } from "./standard";
import { MainnetService } from "../service/mainnet";

enum Mode {
  LITE,
  STANDARD,
  ZERO
}

export class Processors implements ProcessorInterface {
  logger: bunyan;
  private processors: {
    lite: Lite;
    standard: Standard;
  }
  private mainnetService: MainnetService;
  
  constructor(logger: bunyan) {
    this.logger = logger;
    this.processors = {
      lite: new Lite(logger),
      standard: new Standard(logger)
      // Register more processors here
    };
    this.mainnetService = new MainnetService(config.mainnet, logger);
  }
  
  // Register the event process. NOTE: this won't actually start the job processing until you call the reset
  init() {
    _.forIn(this.processors, (p, _) => {
      p.init();
    });
    return this;
  }
  
  async reset() {
    const modes: Mode[] = await this.getRunningModes();
    // Depending on the mode, we choose different processor to work on
    modes.map(async (m) => {
      switch (m) {
        case Mode.LITE:
          await this.processors.lite.reset();
          break;
        // TODO: Add more processors here. e.g XDC-ZERO
        case Mode.STANDARD:
          await this.processors.standard.reset();
          break;
        default:
          throw new Error("No avaiable modes to choose from");
      }
    });
  }
  
  private async getRunningModes(): Promise<Mode[]> {
    const modes = [];
    if (config.relayerCsc.isEnabled) {
      const mainnetSmartContractMode = await this.mainnetService.Mode();
      switch (mainnetSmartContractMode) {
        case "lite":
          modes.push(Mode.LITE);
          break;
        default:
          modes.push(Mode.STANDARD);
          break;
      }
    }
    
    // TODO: Now check xdc-zero
    this.logger.info("Running modes: ", modes);
    return modes;
  }
}