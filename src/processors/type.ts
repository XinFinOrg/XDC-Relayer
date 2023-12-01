export interface ProcessorInterface {
  /**
   * Initialise the processor, but this method won't trigger the event processing
   * @returns The processor
   */
  init: () => this;
  
  /**
   * Reset everything(cache) if processor is already running, otherwise start the event processing. 
   * @returns Promise<void>
   */
  reset: () => Promise<void>;
}