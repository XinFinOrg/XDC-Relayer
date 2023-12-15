import Bull from "bull";

export abstract class BaseProcessor {
  queue: Bull.Queue;
  constructor(name: string) {
    this.queue = new Bull(name);
  }

  /**
   * Initialise the processor, but this method won't trigger the event processing
   * @returns The processor
   */
  abstract init(): this;
  
  /**
   * Reset everything(cache) if processor is already running, otherwise start the event processing. 
   * @returns Promise<void>
   */
  abstract reset(): Promise<void>;
  
  getQueue() {
    return this.queue;
  }
  
  async clean(): Promise<void> {
    await this.queue.obliterate({ force: true });
  }
}