import dotenv from "dotenv";
dotenv.config({ path: ".env" });

export interface SubnetConfig {
  url: string;
  fetchWaitingTime: number;
  smartContractAddress: string;
  accountPK: string;
  submitTransactionWaitingTime: number;
}

export interface MainnetConfig {
  url: string;
  fetchWaitingTime: number;
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
  isReverseEnabled: boolean;
  subnetZeroContractAddress?: string;
  parentChainZeroContractAddress?: string;
  parentnetWalletPk?: string;
  subnetWalletPk?: string;
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
  relayerCsc: {   //Checkpoint Smart Contract is deployed on the Parentnet and stores Subnet data, check https://github.com/XinFinOrg/XDC-CSC
    isEnabled: boolean;
  }
  reverseRelayerCsc:{ //Reverse Checkpoint Smart Contract is deployed in the Subnet and stores Parentnet data, check https://github.com/XinFinOrg/XDC-CSC
    isEnabled: boolean;
  }
}

const environment = process.env.NODE_ENV || "production";
export const devMode = environment != "production";

const getZeroConfig = (): XdcZeroConfig => {
  const reqXdcZero = [
    "PARENTNET_ZERO_CONTRACT",
    "SUBNET_ZERO_CONTRACT",
    "PARENTNET_ZERO_WALLET_PK",
    "CHECKPOINT_CONTRACT"
  ];
  const reqReverseXdcZero = [
    "PARENTNET_ZERO_CONTRACT",
    "SUBNET_ZERO_CONTRACT",
    "SUBNET_ZERO_WALLET_PK",
    "REVERSE_CHECKPOINT_CONTRACT"
  ];
  const isEnabled = reqXdcZero.every(envVar => envVar in process.env);
  const isReverseEnabled = reqReverseXdcZero.every(envVar => envVar in process.env);

  let parentnetWalletPk = "";
  if (isEnabled){
    parentnetWalletPk = process.env.PARENTNET_ZERO_WALLET_PK.startsWith("0x") ? process.env.PARENTNET_ZERO_WALLET_PK : `0x${process.env.PARENTNET_ZERO_WALLET_PK}`;
  }
  let subnetWalletPk = "";
  if (isReverseEnabled){
    subnetWalletPk = process.env.SUBNET_ZERO_WALLET_PK.startsWith("0x") ? process.env.SUBNET_ZERO_WALLET_PK : `0x${process.env.SUBNET_WALLET_PK}`;
  }
  return {
    isEnabled,
    isReverseEnabled,
    subnetZeroContractAddress: process.env.SUBNET_ZERO_CONTRACT,
    subnetWalletPk: subnetWalletPk,
    parentChainZeroContractAddress: process.env.PARENTNET_ZERO_CONTRACT,
    parentnetWalletPk:  parentnetWalletPk,
  };
};

const config: Config = {
  port: +(process.env.RELAYER_PORT || 5215),
  devMode: devMode,
  cronJob: {
    liteJobExpression: "0 */2 * * * *", // every 2min
    jobExpression: "*/20 * * * * *", // every 20s
    zeroJobExpression: "*/10 * * * * *", // every 10s
  },
  subnet: {
    url: process.env.SUBNET_URL || "",
    smartContractAddress: process.env.REVERSE_CHECKPOINT_CONTRACT || "",
    accountPK:
      process.env.SUBNET_WALLET_PK ||
      "0xa6538b992365dd26bbc2391ae6639bac0ed8599f8b45bca7c28c105959f02af0", // Default to a dummy key
    fetchWaitingTime: +process.env.SN_FETCHING_WAITING_TIME || 0,
    submitTransactionWaitingTime: +process.env.MN_TX_SUBMIT_WAITING_TIME || 100,
  },
  mainnet: {
    url:
      process.env.PARENTNET_URL || "",
    smartContractAddress: process.env.CHECKPOINT_CONTRACT || "",
    accountPK:
      process.env.PARENTNET_WALLET_PK ||
      "0xa6538b992365dd26bbc2391ae6639bac0ed8599f8b45bca7c28c105959f02af4", // Default to a dummy key
    fetchWaitingTime: +process.env.SN_FETCHING_WAITING_TIME || 0,
    submitTransactionWaitingTime: +process.env.MN_TX_SUBMIT_WAITING_TIME || 100,
  },
  relayerCsc: {
    isEnabled: "PARENTNET_WALLET_PK" in process.env && "CHECKPOINT_CONTRACT" in process.env && "PARENTNET_URL" in process.env
  },
  reverseRelayerCsc: {
    isEnabled: "SUBNET_WALLET_PK" in process.env && "REVERSE_CHECKPOINT_CONTRACT" in process.env && "SUBNET_URL" in process.env
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
  chunkSize : parseInt(process.env.MAX_FETCH_BLOCK_SIZE) || 120,
};

export { config };
