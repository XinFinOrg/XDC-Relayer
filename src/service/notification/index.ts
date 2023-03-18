import { NotificationConfig } from "./../../config";
import { SlackNotification } from "./slack";
import { Cache } from "../cache";

const NOTIFICATION_DELAY_PERIOD = 1500; // Only send message every 15 minutes
export class Nofications {
  private notificationChannels: any[] = [];
  private cache: Cache;
  private devMode: boolean;
  
  constructor(notificationConfig: NotificationConfig, cache: Cache, devMode: boolean = true) {
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
      const isSet = this.cache.setForkingNotificationCountdown(NOTIFICATION_DELAY_PERIOD);
      if (isSet) {
        this.notificationChannels.forEach(async c => {
          await c.postForkingErrorMessage(message);
        });  
      }
    } catch (error) {
      console.error("Fail to publish message to the dedicated notification channels", error);
    }
  }
}