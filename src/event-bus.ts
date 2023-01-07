import EventEmitter from "events";
import { Worker } from "./conntroller/worker";

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
      console.log("🥾 Received BOOTSTRAP events");
      await this.worker.bootstrap();
      this.triggerEvent(EventBusNames.SYNC);
    });
    
    this.emitter.on(EventBusNames.SYNC, async () => {
      console.log("👍 Received SYNC events");
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
    console.log("Received a signal to trigger the bootstrap again!");
    this.emitter.emit(EventBusNames.BOOTSTRAP);
  }
}