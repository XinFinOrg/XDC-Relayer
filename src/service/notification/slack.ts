import axios from "axios";

export class SlackNotification {
  webHookUrl: string;
  constructor(webHookUrl: string) {
    this.webHookUrl = webHookUrl;
  }
  
  async postForkingErrorMessage(message: string): Promise<void>{
    await axios.post(this.webHookUrl, {
      "text": ":no_entry: Relayer detected forking!",
      "blocks": [
      	{
      		"type": "section",
      		"text": {
      			"type": "mrkdwn",
      			"text": ":no_entry: Relayer detected forking!"
      		}
      	},
      	{
      		"type": "section",
      		"block_id": "section567",
      		"text": {
      			"type": "mrkdwn",
      			"text": message
      		}
      	},
      ]
    }, {
      headers: {
        "Content-type": "application/json"
      }
    });
  }
  
}