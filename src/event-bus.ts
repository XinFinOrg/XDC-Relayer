import EventEmitter from "events";
import { sleep } from "./utils/index";
import { Worker } from "./conntroller/worker";
import { config } from "./config";

enum EventBusNames {
  BOOTSTRAP = "bootstrap",
  SYNC = "sync"
}

export class EventBus {
  emitter: EventEmitter;
  worker: Worker
  
  constructor() {
    this.emitter = new EventEmitter();
    this.worker = new Worker(this.reBootStrap);
    
    this.emitter.on(EventBusNames.BOOTSTRAP, async () => {
      console.info("🥾 Received BOOTSTRAP events");
      const success = await this.worker.bootstrap();
      if (success) {
        // Only trigger the normal operation if bootstrap has completed successfully
        this.triggerEvent(EventBusNames.SYNC);
      } else {
        // Whenever the service failed to bootstrap, we will keep the service down for 5 minutes before retrying
        console.error("Error while bootstraping, system will go into sleep mode for 5 minutes before re-processing!");
        await sleep(config.reBootstrapWaitingTime);
        this.triggerEvent(EventBusNames.BOOTSTRAP);    
      }
      
    });
    
    this.emitter.on(EventBusNames.SYNC, async () => {
      console.info("👍 Received SYNC events");
      await this.worker.synchronization();
    });
  }

  init(): void {
    console.info("💻 Starting the event lifecycle!");
    this.triggerEvent(EventBusNames.BOOTSTRAP);
  }
  

  triggerEvent(eventName: EventBusNames): void {
    this.emitter.emit(eventName);
  }
  
  reBootStrap(): void {
    console.info("Received a signal to trigger the bootstrap again!");
    this.emitter.emit(EventBusNames.BOOTSTRAP);
  }
}