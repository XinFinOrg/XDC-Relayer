import Web3 from "web3";
import { BlockTransactionString } from "web3-eth";
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
  
  async getLastCommittedBlockInfoByNum(blockNum?: number) : Promise<SubnetBlockInfo> {
    try {
      const blockNumHex = blockNum ? `0x${(blockNum).toString(16)}` : undefined ;  // TODO: to be replaced by "confirmed" for the `undefined`
      const { Hash, Number, Round, EncodeRLP, ParentHash }  = await this.web3.xdcSubnet.getV2Block(); // TODO: Replace by get by number
      return {
        subnetBlockHash: Hash,
        subnetBlockNumber: Number,
        subnetBlockRound: Round,
        encodedRLP: EncodeRLP,
        parentHash: ParentHash
      };
    } catch (error) {
      console.error("Error while trying to fetch blockInfo by number from subnet", {message: error.message, blockNum });
      throw error;
    }
  }
  
  async getLastV2BlockInfoByHash(blockHash: string) : Promise<SubnetBlockInfo> {
    try {
      const { Hash, Number, Round, EncodeRLP, ParentHash }  = await this.web3.xdcSubnet.getV2BlockByHash(blockHash);
      return {
        subnetBlockHash: Hash,
        subnetBlockNumber: Number,
        subnetBlockRound: Round,
        encodedRLP: EncodeRLP,
        parentHash: ParentHash
      };
    } catch (error) {
      console.error("Error while trying to fetch blockInfo by hash from subnet", {message: error.message, blockHash});
      throw error;
    }
  }
  
  async getLastCommitteddBlock() : Promise<BlockTransactionString> {
    try {
      return await this.web3.eth.getBlock("latest");
    } catch (error) {
      console.error("Error while trying to fetch the last confirmed block from subnet", error);
      throw error;
    }
  }
  
  async bulkGetRlpEncodedHeaders(startingBlockNumber: number, numberOfBlocksToFetch: number): Promise<string[]>{
    const rlpEncodedHeaders: string[] = [];
    for (let i = startingBlockNumber; i < startingBlockNumber + numberOfBlocksToFetch; i++) {
      const { encodedRLP } = await this.getLastCommittedBlockInfoByNum(i);
      rlpEncodedHeaders.push(encodedRLP);
      await sleep(this.subnetConfig.fetchWaitingTime);
    }
    return rlpEncodedHeaders;
  }

}