import axios, { AxiosInstance } from "axios";
import { sleep } from "./../utils/index";

interface MainnetClientConfig {
  url: string;
  timeout: number;
  smartContractAddress: string;
}



export class MainnetClient {
  private config: MainnetClientConfig;
  private instance: AxiosInstance;
  
  constructor(config: MainnetClientConfig) {
    this.config = config;
    this.instance = axios.create({
      baseURL: this.config.url,
      timeout: this.config.timeout || 5000
    });
  }
  
  async getLastAuditedBlock(): Promise<any> {
    await sleep(1000);
    console.log("[Mainnet] Fetching the last confirmed subnet block in XDC mainnet");
    // Store item into the cache
  }
  
  async submitTransactions(txs: any): Promise<void> {
    await sleep(2000);
    console.log("[Mainnet] Submit new transactions into XDC mainnet");
  }
}