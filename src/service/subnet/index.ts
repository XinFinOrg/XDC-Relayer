import Web3 from "web3";
import { SubnetConfig } from "../../config";
import { sleep } from "../../utils/index";
import { subnetExtensions, Web3WithExtension } from "./extensions";

export interface SubnetBlockInfo {
  subnetBlockHash: string,
  subnetBlockNumber: number,
  subnetBlockRound: number,
  encodedRLP: string,
  parentHash: string
}

export class SubnetService {
  private web3: Web3WithExtension;
  private subnetConfig: SubnetConfig;
  
  constructor(config: SubnetConfig) {
    this.subnetConfig = config;
    this.web3 = (new Web3(config.url)).extend(subnetExtensions);
  }
  
  async getLastCommittedBlockInfo() : Promise<SubnetBlockInfo> {
    try {
      const { Hash, Number, Round, EncodedRLP, ParentHash }  = await this.web3.xdcSubnet.getV2Block("committed");
      return {
        subnetBlockHash: Hash,
        subnetBlockNumber: Number,
        subnetBlockRound: Round,
        encodedRLP: EncodedRLP,
        parentHash: ParentHash
      };
    } catch (error) {
      console.error("Error while trying to fetch blockInfo by number from subnet", {message: error.message });
      throw error;
    }
  }
  
  async getCommittedBlockInfoByNum(blockNum: number) : Promise<SubnetBlockInfo> {
    try {
      const { Hash, Number, Round, EncodedRLP, ParentHash }  = await this.web3.xdcSubnet.getV2Block(`0x${(blockNum).toString(16)}`);
      if (!Hash || !Number || !EncodedRLP || !ParentHash ) {
        console.error("Invalid block hash or height or encodedRlp or ParentHash received", Hash, Number, EncodedRLP, ParentHash);
        throw new Error("Unable to get committed block information by height");
      }
      return {
        subnetBlockHash: Hash,
        subnetBlockNumber: Number,
        subnetBlockRound: Round,
        encodedRLP: EncodedRLP,
        parentHash: ParentHash
      };
    } catch (error) {
      console.error("Error while trying to fetch blockInfo by number from subnet", {message: error.message });
      throw error;
    }
  }
  
  async getComittedBlockInfoByHash(blockHash: string) : Promise<SubnetBlockInfo> {
    try {
      const { Hash, Number, Round, EncodedRLP, ParentHash }  = await this.web3.xdcSubnet.getV2BlockByHash(blockHash);
      if (!Hash || !Number || !EncodedRLP || !ParentHash ) {
        console.error("Invalid block hash or height or encodedRlp or ParentHash received", Hash, Number, EncodedRLP, ParentHash);
        throw new Error("Unable to get committed block information by hash");
      }
      return {
        subnetBlockHash: Hash,
        subnetBlockNumber: Number,
        subnetBlockRound: Round,
        encodedRLP: EncodedRLP,
        parentHash: ParentHash
      };
    } catch (error) {
      console.error("Error while trying to fetch blockInfo by hash from subnet", {message: error.message, blockHash});
      throw error;
    }
  }
  
  async bulkGetRlpEncodedHeaders(startingBlockNumber: number, numberOfBlocksToFetch: number): Promise<string[]>{
    const rlpEncodedHeaders: string[] = [];
    for (let i = startingBlockNumber; i < startingBlockNumber + numberOfBlocksToFetch; i++) {
      const { encodedRLP } = await this.getCommittedBlockInfoByNum(i);
      rlpEncodedHeaders.push(encodedRLP);
      await sleep(this.subnetConfig.fetchWaitingTime);
    }
    return rlpEncodedHeaders;
  }

}