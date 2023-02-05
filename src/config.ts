import dotenv from "dotenv";
dotenv.config({ path: ".env" });

export interface SubnetConfig {
  url: string;
}

export interface MainnetConfig {
  url: string;
  smartContractAddress: string;
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
      url: process.env.SUBNET_URL
    },
    mainnet: {
      url: process.env.MAINNET_URL,
      smartContractAddress: process.env.SC_ADDRESS
    }
};

export { config };