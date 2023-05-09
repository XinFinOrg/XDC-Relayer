import NodeCache from "node-cache";
import { SubnetBlockInfo } from "../subnet";
import { CachingError } from "./../../errors/cachingError";

const SUBNET_LAST_SUBMITTED_HEADER = "subnet_last_submitted_header";
const LAST_FORKING_NOTIFICATION_SENT = "last_forking_sent";
const LAST_ERROR_NOTIFICATION_SENT = "last_error_sent";

export class Cache {
  private inMemoryCache: NodeCache;
  
  constructor() {
    this.inMemoryCache = new NodeCache();
  }
  
  setLastSubmittedSubnetHeader(header: SubnetBlockInfo): void {
    let success = false;
    try {
      success = this.inMemoryCache.set(SUBNET_LAST_SUBMITTED_HEADER, header);
    } catch (error) {
      console.error("Error while trying to get cached data from memory", error);
    }
    if (!success) {
      throw new CachingError("SET");
    }  
  }
  
  getLastSubmittedSubnetHeader(): SubnetBlockInfo | undefined {
    try {
      return this.inMemoryCache.get(SUBNET_LAST_SUBMITTED_HEADER);  
    } catch (error) {
      console.error("Error while trying to get cached data from memory", error);
      throw new CachingError("GET");
    }
  }
  
  cleanCache(): void {
    this.inMemoryCache.flushAll();
  }
  
  setForkingNotificationCountdown(countdownTime: number): boolean {
    const lastForking = this.inMemoryCache.get(LAST_FORKING_NOTIFICATION_SENT);
    if(!lastForking) {
      this.inMemoryCache.set(LAST_FORKING_NOTIFICATION_SENT, true, countdownTime);
      return true;
    }
    return false;
  }
  
  setErrorNotificationCountdown(countdownTime: number): boolean {
    const lastForking = this.inMemoryCache.get(LAST_ERROR_NOTIFICATION_SENT);
    if(!lastForking) {
      this.inMemoryCache.set(LAST_ERROR_NOTIFICATION_SENT, true, countdownTime);
      return true;
    }
    return false;
  }
}