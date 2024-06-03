import Web3 from "web3";
import { HttpsAgent } from "agentkeepalive";
import bunyan from "bunyan";
import { SubnetConfig } from "../../config";
import { sleep } from "../../utils/index";
import { subnetExtensions, Web3WithExtension } from "./extensions";
import { NetworkInformation } from "../types";
import { Contract } from "web3-eth-contract";
import { AbiItem } from "web3-utils";
import { Account } from "web3-core";

export interface SubnetBlockInfo {
  subnetBlockHash: string;
  subnetBlockNumber: number;
  subnetBlockRound: number;
  hexRLP: string;
  parentHash: string;
}

export interface SmartContractData {
  smartContractHash: string;
  smartContractHeight: number;
  smartContractCommittedHeight: number;
  smartContractCommittedHash: string;
}

export class SubnetService {
  protected web3: Web3WithExtension;
  private smartContractInstance: Contract;
  private subnetAccount: Account;
  private subnetConfig: SubnetConfig;
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

  // Below shall be given height provide the SM hash
  async getBlockHashByNumber(height: number): Promise<string> {
    try {
      const result = await this.smartContractInstance.methods
        .getHeaderByNumber(height)
        .call();
      return result[0];
    } catch (error) {
      this.logger.error("Fail to get block hash by number from mainnet", {
        height,
        message: error.message,
      });
      throw error;
    }
  }

  async getLastAuditedBlock(): Promise<SmartContractData> {
    try {
      const result = await this.smartContractInstance.methods
        .getLatestBlocks()
        .call();
      const [latestBlockHash, latestBlockHeight] = result[0];
      const [latestSmComittedHash, latestSmHeight] = result[1];
      if (
        !latestBlockHash ||
        !latestBlockHeight ||
        !latestSmComittedHash ||
        !latestSmHeight
      ) {
        this.logger.error(
          "Invalid block hash or height received",
          latestBlockHash,
          latestBlockHeight,
          latestSmComittedHash,
          latestSmHeight
        );
        throw new Error("Unable to get last audited block informations");
      }
      return {
        smartContractHash: latestBlockHash,
        smartContractHeight: parseInt(latestBlockHeight),
        smartContractCommittedHash: latestSmComittedHash,
        smartContractCommittedHeight: parseInt(latestSmHeight),
      };
    } catch (error) {
      this.logger.error(
        "Error while trying to fetch the last audited subnet's block in XDC mainnet",
        { message: error.message }
      );
      throw error;
    }
  }

  async Mode(): Promise<"lite"| "full"| "reverse full"> {
    try {
      return this.smartContractInstance.methods.MODE().call();
    } catch (error) {
      this.logger.error("Fail to get mode from mainnet smart contract");
      throw error;
    }
  }
}
