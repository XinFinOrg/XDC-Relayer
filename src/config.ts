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
  devMode: boolean;
  cronJob: {
    jobExpression: string;
    abnormalDetectionExpression: string;
  };
  subnet: SubnetConfig;
  mainnet: MainnetConfig;
  reBootstrapWaitingTime: number;
  notification: NotificationConfig;
}

const environment = process.env.NODE_ENV || "production";
export const devMode = environment!= "production";

const config: Config = {
    port: +(process.env.PORT || 3000),
    devMode: devMode,
    cronJob: {
      jobExpression: "*/10 * * * * *", // every 10s
      abnormalDetectionExpression: "0 */10 * * * *", // every 10 minutes,
    },
    subnet: {
      url: process.env.SUBNET_URL || "https://devnetstats.apothem.network/subnet",
      fetchWaitingTime: +(process.env.SN_FETCHING_WAITING_TIME) || 0
    },
    mainnet: {
      url: process.env.MAINNET_URL || "https://devnetstats.apothem.network/mainnet",
      smartContractAddress: process.env.SC_ADDRESS || "",
      accountPK: process.env.MAINNET_WALLET_PK || "",
      submitTransactionWaitingTime: +(process.env.MN_TX_SUBMIT_WAITING_TIME) || 100
    },
    reBootstrapWaitingTime: +(process.env.BOOTSTRAP_FAILURE_WAIT_TIME) || 60000,
    notification: {
      slack: process.env.SLACK_WEBHOOK ? {
        incomingWebHook: process.env.SLACK_WEBHOOK
      } : undefined
    }
};

export { config };