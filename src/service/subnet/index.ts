import Web3 from "web3";
import { HttpsAgent } from "agentkeepalive";
import bunyan from "bunyan";
import { SubnetConfig } from "../../config";
import { sleep } from "../../utils/index";
import { subnetExtensions, Web3WithExtension } from "./extensions";
import { NetworkInformation } from "../types";

export interface SubnetBlockInfo {
  subnetBlockHash: string;
  subnetBlockNumber: number;
  subnetBlockRound: number;
  hexRLP: string;
  parentHash: string;
}

export class SubnetService {
  protected web3: Web3WithExtension;
  protected subnetConfig: SubnetConfig;
  logger: bunyan;

  constructor(config: SubnetConfig, logger: bunyan) {
    this.logger = logger;
    const keepaliveAgent = new HttpsAgent();
    const provider = new Web3.providers.HttpProvider(config.url, {
      keepAlive: true,
      agent: { https: keepaliveAgent },
    });

    this.subnetConfig = config;
    this.web3 = new Web3(provider).extend(subnetExtensions);
  }
  
  async getNetworkInformation(): Promise<NetworkInformation> {
    return this.web3.xdcSubnet.getNetworkInformation();
  }
  
  async getLastCommittedBlockInfo(): Promise<SubnetBlockInfo> {
    try {
      const { Hash, Number, Round, HexRLP, ParentHash } =
        await this.web3.xdcSubnet.getV2Block("committed");
      if (!Hash || !Number || !HexRLP || !ParentHash) {
        this.logger.error(
          "Invalid block hash or height or encodedRlp or ParentHash received",
          Hash,
          Number,
          HexRLP,
          ParentHash
        );
        throw new Error("Unable to get latest committed block information");
      }
      return {
        subnetBlockHash: Hash,
        subnetBlockNumber: Number,
        subnetBlockRound: Round,
        hexRLP: HexRLP,
        parentHash: ParentHash,
      };
    } catch (error) {
      this.logger.error(
        "Error getLastCommittedBlockInfo while trying to fetch blockInfo by number from subnet",
        { message: error.message }
      );
      throw error;
    }
  }

  async getCommittedBlockInfoByNum(blockNum: number): Promise<SubnetBlockInfo> {
    try {
      const { Hash, Number, Round, HexRLP, ParentHash } =
        await this.web3.xdcSubnet.getV2Block(`0x${blockNum.toString(16)}`);
      if (!Hash || !Number || !HexRLP || !ParentHash) {
        this.logger.error(
          "Invalid block hash or height or encodedRlp or ParentHash received",
          Hash,
          Number,
          HexRLP,
          ParentHash
        );
        throw new Error("Unable to get committed block information by height");
      }
      return {
        subnetBlockHash: Hash,
        subnetBlockNumber: Number,
        subnetBlockRound: Round,
        hexRLP: HexRLP,
        parentHash: ParentHash,
      };
    } catch (error) {
      this.logger.error(
        "Error while trying to fetch blockInfo by number from subnet blockNum:",
        blockNum,
        { message: error.message }
      );
      throw error;
    }
  }

  async getComittedBlockInfoByHash(
    blockHash: string
  ): Promise<SubnetBlockInfo> {
    try {
      const { Hash, Number, Round, HexRLP, ParentHash } =
        await this.web3.xdcSubnet.getV2BlockByHash(blockHash);
      if (!Hash || !Number || !HexRLP || !ParentHash) {
        this.logger.error(
          "Invalid block hash or height or encodedRlp or ParentHash received",
          Hash,
          Number,
          HexRLP,
          ParentHash
        );
        throw new Error("Unable to get committed block information by hash");
      }
      return {
        subnetBlockHash: Hash,
        subnetBlockNumber: Number,
        subnetBlockRound: Round,
        hexRLP: HexRLP,
        parentHash: ParentHash,
      };
    } catch (error) {
      this.logger.error(
        "Error while trying to fetch blockInfo by hash from subnet",
        { message: error.message, blockHash }
      );
      throw error;
    }
  }
  
  async getTransactionAndReceiptProof(txHash: string) {
    try {
      return this.web3.xdcSubnet.getTransactionAndReceiptProof(txHash);  
    } catch (error) {
      this.logger.error("Error while trying to fetch the transaction receipt proof", error);
      throw error;
    }
  }

  async bulkGetRlpHeaders(
    startingBlockNumber: number,
    numberOfBlocksToFetch: number
  ): Promise<Array<{ hexRLP: string; blockNum: number }>> {
    this.logger.info(
      "Fetch subnet node data from " +
        startingBlockNumber +
        " to " +
        (startingBlockNumber + numberOfBlocksToFetch - 1)
    );
    const rlpHeaders: Array<{ hexRLP: string; blockNum: number }> = [];
    for (
      let i = startingBlockNumber;
      i < startingBlockNumber + numberOfBlocksToFetch;
      i++
    ) {
      const { hexRLP } = await this.getCommittedBlockInfoByNum(i);
      rlpHeaders.push({ hexRLP, blockNum: i });
      await sleep(this.subnetConfig.fetchWaitingTime);
    }
    return rlpHeaders;
  }
}
