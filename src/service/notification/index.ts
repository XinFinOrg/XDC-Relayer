import bunyan from "bunyan";
import { NotificationConfig } from "./../../config";
import { SlackNotification } from "./slack";
import { Cache } from "../cache";

const FORKING_NOTIFICATION_DELAY_PERIOD = 3000; // Only send message every 30 minutes
const DEFAULT_NOTIFICATION_DELAY_PERIOD = 6000; // Only send message every 1 hours
export class Nofications {
  private notificationChannels: any[] = [];
  private cache: Cache;
  private devMode: boolean;
  logger: bunyan;
  
  constructor(notificationConfig: NotificationConfig, cache: Cache, logger: bunyan, devMode: boolean = true) {
    this.logger = logger;
    this.cache = cache;
    this.devMode = devMode;
    if (notificationConfig.slack) {
      this.notificationChannels.push(new SlackNotification(notificationConfig.slack.incomingWebHook)); 
    }
    // Add the rest here
  }
  
  async postForkingErrorMessage(message: string): Promise<void> {
    try {
      if ( this.devMode ) {
        return;
      }
      const isSet = this.cache.setForkingNotificationCountdown(FORKING_NOTIFICATION_DELAY_PERIOD);
      if (isSet) {
        this.notificationChannels.forEach(async c => {
          await c.postForkingErrorMessage(message);
        });  
      }
    } catch (error) {
      this.logger.error("Fail to publish message to the dedicated notification channels", error?.message);
    }
  }
  
  async postErrorMessage(message: string): Promise<void> {
    try {
      if ( this.devMode ) {
        return;
      }
      const isSet = this.cache.setErrorNotificationCountdown(DEFAULT_NOTIFICATION_DELAY_PERIOD);
      if (isSet) {
        this.notificationChannels.forEach(async c => {
          await c.postErrorMessage(message);
        });  
      }
    } catch (error) {
      this.logger.error("Fail to publish default error message to the dedicated notification channels", error?.message);
    }
  }
}