import dotenv from "dotenv";
dotenv.config({ path: ".env" });

export interface SubnetConfig {
  url: string;
  fetchWaitingTime: number;
}

export interface MainnetConfig {
  url: string;
  smartContractAddress: string;
  accountPK: string;
  submitTransactionWaitingTime: number;
}

export interface NotificationConfig {
  slack?: {
    incomingWebHook: string;
  }
}


export interface Config {
  port: number;
  debugLogging: boolean;
  cronJob: {
    jobExpression: string;
    abnormalDetectionExpression: string;
  };
  subnet: SubnetConfig;
  mainnet: MainnetConfig;
  reBootstrapWaitingTime: number;
  notification: NotificationConfig;
}

export const isDevMode = process.env.NODE_ENV == "development";

const config: Config = {
    port: +(process.env.PORT || 3000),
    debugLogging: isDevMode,
    cronJob: {
      jobExpression: "*/10 * * * * *", // every 10s
      abnormalDetectionExpression: "0 */10 * * * *", // every 10 minutes,
    },
    subnet: {
      url: process.env.SUBNET_URL || "",
      fetchWaitingTime: +(process.env.SN_FETCHING_WAITING_TIME) || 1000
    },
    mainnet: {
      url: process.env.MAINNET_URL || "",
      smartContractAddress: process.env.SC_ADDRESS || "",
      accountPK: process.env.MAINNET_WALLET_PK || "",
      submitTransactionWaitingTime: +(process.env.MN_TX_SUBMIT_WAITING_TIME) || 2000
    },
    reBootstrapWaitingTime: +(process.env.BOOTSTRAP_FAILURE_WAIT_TIME) || 3000000,
    notification: {
      slack: process.env.SLACK_WEBHOOK ? {
        incomingWebHook: process.env.SLACK_WEBHOOK
      } : undefined
    }
};

export { config };