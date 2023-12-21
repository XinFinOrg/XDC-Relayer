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
  };
}

export interface XdcZeroConfig {
  isEnabled: boolean;
  subnetZeroContractAddress?: string;
  parentChainZeroContractAddress?: string;
  walletPk?: string;
}

export interface Config {
  port: number;
  devMode: boolean;
  cronJob: {
    liteJobExpression: string;
    jobExpression: string;
    zeroJobExpression: string;
  };
  subnet: SubnetConfig;
  mainnet: MainnetConfig;
  reBootstrapWaitingTime: number;
  notification: NotificationConfig;
  chunkSize: number;
  xdcZero: XdcZeroConfig;
  relayerCsc: {
    isEnabled: boolean;
  }
}

const environment = process.env.NODE_ENV || "production";
export const devMode = environment != "production";

const getZeroConfig = (): XdcZeroConfig => {
  const isEnabled: boolean = "PARENTNET_ZERO_WALLET_PK" in process.env && "SUBNET_ZERO_CONTRACT" in process.env && "PARENTNET_ZERO_CONTRACT" in process.env;
  return isEnabled ? {
    isEnabled,
    subnetZeroContractAddress: process.env.SUBNET_ZERO_CONTRACT,
    parentChainZeroContractAddress: process.env.PARENTNET_ZERO_CONTRACT,
    walletPk: process.env.PARENTNET_ZERO_WALLET_PK.startsWith("0x") ? process.env.PARENTNET_ZERO_WALLET_PK : `0x${process.env.PARENTNET_ZERO_WALLET_PK}`
  }: { isEnabled: false };
};

const config: Config = {
  port: +(process.env.RELAYER_PORT || 4000),
  devMode: devMode,
  cronJob: {
    liteJobExpression: "0 */2 * * * *", // every 2min
    jobExpression: "*/20 * * * * *", // every 20s
    zeroJobExpression: "*/10 * * * * *", // every 10s
  },
  subnet: {
    url: process.env.SUBNET_URL || "https://devnetstats.apothem.network/subnet",
    fetchWaitingTime: +process.env.SN_FETCHING_WAITING_TIME || 0,
  },
  mainnet: {
    url:
      process.env.PARENTNET_URL ||
      "https://devnetstats.apothem.network/mainnet",
    smartContractAddress: process.env.CHECKPOINT_CONTRACT || "",
    accountPK:
      process.env.PARENTNET_WALLET_PK ||
      "0xa6538b992365dd26bbc2391ae6639bac0ed8599f8b45bca7c28c105959f02af4", // Default to a dummy key
    submitTransactionWaitingTime: +process.env.MN_TX_SUBMIT_WAITING_TIME || 100,
  },
  relayerCsc: {
    isEnabled: "PARENTNET_WALLET_PK" in process.env && "CHECKPOINT_CONTRACT" in process.env && "PARENTNET_URL" in process.env
  },
  xdcZero: getZeroConfig(),
  reBootstrapWaitingTime: +process.env.BOOTSTRAP_FAILURE_WAIT_TIME || 120000,
  notification: {
    slack: process.env.SLACK_WEBHOOK
      ? {
          incomingWebHook: process.env.SLACK_WEBHOOK,
        }
      : undefined,
  },
  chunkSize : parseInt(process.env.MAX_FETCH_BLOCK_SIZE) || 30,
};

export { config };
