import axios, { AxiosInstance } from "axios";
import { sleep } from "./../utils/index";

interface SubnetClientConfig {
  url: string;
  timeout: number;
}



export class SubnetClient {
  private config: SubnetClientConfig;
  private instance: AxiosInstance;
  
  constructor(config: SubnetClientConfig) {
    this.config = config;
    this.instance = axios.create({
      baseURL: this.config.url,
      timeout: this.config.timeout || 5000
    });
  }
  
  async getLastConfirmedBlock() : Promise<any> {
    await sleep(2000);
    console.log("[Subnet] Fetching the last confirmed block in XDC subnet");
  }
  
  async cachingLastSubmittedBlock(block: any): Promise<void> {
    await sleep(1000);
    console.log("[Subnet] Caching the last submitted subnet block");
  }
  
  async getLastSubmittedBlock(): Promise<any> {
    await sleep(3000);
    console.log("[Subnet] Get the last submitted subnet block");
  }
}