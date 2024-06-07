import bunyan from "bunyan";
import * as _ from "lodash";
import { createBullBoard } from '@bull-board/api';
import { BullAdapter } from '@bull-board/api/bullAdapter';
import { ExpressAdapter } from '@bull-board/express';

import { config } from "./../config";
import { Lite, NAME as liteName } from "./lite";
import { Full, NAME as fullName } from "./full";
import { ReverseFull, NAME as ReverseFullName } from "./reverseFull";
import { Zero, NAME as zeroName } from "./zero";
import { ReverseZero, NAME as ReverseZeroName } from "./reverseZero";
import { MainnetService } from "../service/mainnet";
import { SubnetService } from "../service/subnet";

enum Mode {
  LITE = liteName,
  FULL = fullName,
  REVERSE_FULL = ReverseFullName,
  ZERO = zeroName,
  REVERSE_ZERO = ReverseZeroName
}

export class Processors {
  logger: bunyan;
  private processors: {
    lite: Lite;
    full: Full;
    reverseFull: ReverseFull;
    zero: Zero;
    reverseZero: ReverseZero;
  }
  private mainnetService: MainnetService;
  private subnetService: SubnetService;
  
  constructor(logger: bunyan) {
    this.logger = logger;
    this.processors = {
      lite: new Lite(logger),
      full: new Full(logger),
      reverseFull: new ReverseFull(logger),
      zero: new Zero(logger),
      reverseZero: new ReverseZero(logger),
      // Register more processors here
    };
    this.mainnetService = new MainnetService(config.mainnet, logger);
    this.subnetService = new SubnetService(config.subnet, logger);
  }
  
  // Register the event process. NOTE: this won't actually start the job processing until you call the reset
  init(serverAdapter: ExpressAdapter) {
    const adapters: BullAdapter[] = [];
    _.forIn(this.processors, (p) => {
      p.init();
      adapters.push(new BullAdapter(p.getQueue(), { readOnlyMode: true }));
    });
    createBullBoard({
      queues: adapters,
      serverAdapter: serverAdapter,
      options: {
        uiConfig: {
          boardTitle: "Relayer Status"
        }
      }
    });
    
    return this;
  }
  
  async reset() {
    // Reset all the queues first
    await Promise.all(_.map(this.processors, async(p) => await p.clean()));
  
    const modes: Mode[] = await this.getRunningModes();
    // Depending on the mode, we choose different processor to work on
    modes.map(async (m) => {
      switch (m) {
        case Mode.LITE:
          await this.processors.lite.reset();
          break;
        // TODO: Add more processors here. e.g XDC-ZERO
        case Mode.FULL:
          await this.processors.full.reset();
          break;
        case Mode.REVERSE_FULL:
          await this.processors.reverseFull.reset();
          break;
        case Mode.ZERO:
          await this.processors.zero.reset();
          break;
        case Mode.REVERSE_ZERO:
          await this.processors.reverseZero.reset();
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
        case "full":
          modes.push(Mode.FULL);
          break;
        default:
          throw new Error("No avaiable mode from PARENTNET smart contract API");
      }
    }
    if (config.reverseRelayerCsc.isEnabled){
      const subnetSmartContractMode = await this.subnetService.Mode(); 
      switch (subnetSmartContractMode) {
        case "reverse_full":
          modes.push(Mode.REVERSE_FULL);
          break;
        default:
          throw new Error("No available mode from SUBNET smart contract API");
      }
    }
    
    if (config.xdcZero.isEnabled) {
      modes.push(Mode.ZERO);
      modes.push(Mode.REVERSE_ZERO);
    }
    
    this.logger.info("Running modes: ", modes);
    return modes;
  }
}