import Web3 from "web3";
import { BlockTransactionString } from "web3-eth";
import { SubnetConfig } from "../../config";
import { sleep } from "../../utils/index";
import { CommittedBlockInfo, subnetExtensions, Web3WithExtension } from "./extensions";

export class SubnetService {
  private web3: Web3WithExtension;
  
  constructor(config: SubnetConfig) {
    this.web3 = (new Web3(config.url)).extend(subnetExtensions);
  }
  
  async getLastCommittedBlockInfo() : Promise<CommittedBlockInfo> {
    try {
      return await this.web3.xdcSubnet.getLatestCommittedBlockInfo();
    } catch (error) {
      console.error("Error while trying to fetch the last committed block from subnet", error);
      throw error;
    }
  }
  
  async getLastCommitteddBlock() : Promise<BlockTransactionString> {
    try {
      return await this.web3.eth.getBlock("latest"); // TODO: to be replaced by "confirmed"
    } catch (error) {
      console.error("Error while trying to fetch the last confirmed block from subnet", error);
      throw error;
    }
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