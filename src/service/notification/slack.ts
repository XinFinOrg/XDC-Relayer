import axios, { AxiosInstance } from "axios";
import { HttpsAgent } from "agentkeepalive";

export class SlackNotification {
  axiosInstance: AxiosInstance;
  webHookPath: string;
  constructor(webHookPath: string) {
    this.webHookPath = webHookPath;
    const keepaliveAgent = new HttpsAgent();
    this.axiosInstance = axios.create({
      baseURL: "https://hooks.slack.com/services",
      timeout: 5000,
      headers: {"Content-type": "application/json"},
      httpsAgent: keepaliveAgent
    });
  }
  
  async postForkingErrorMessage(message: string): Promise<void>{
    await this.axiosInstance.post(this.webHookPath, {
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
  
  async postErrorMessage(message: string): Promise<void>{
    await this.axiosInstance.post(this.webHookPath, {
      "text": ":no_entry: Relayer unable to sync!",
      "blocks": [
      	{
      		"type": "section",
      		"text": {
      			"type": "mrkdwn",
      			"text": ":no_entry: Relayer unable to sync!"
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