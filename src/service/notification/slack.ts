import { WebClient } from "@slack/web-api";

export class SlackNotification {
  private web: WebClient;
  private channel: string;
  
  constructor(channel: string, token: string) {
    this.web = new WebClient(token);
    this.channel = channel;
  }
  
  async postForkingErrorMessage(message: string): Promise<void>{
    await this.web.chat.postMessage({
      channel: this.channel,
      text: ":no_entry: Relayer detected errors",
      blocks: [
        {
          type: "section",
          text: {
            type: "mrkdwn",
            text: `:no_entry: ${message}`
          }
        }
      ]
    });
  }
  
}