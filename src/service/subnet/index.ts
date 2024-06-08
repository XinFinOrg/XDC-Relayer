import Web3 from "web3";
import { Contract } from "web3-eth-contract";
import { AbiItem } from "web3-utils";
import { Account } from "web3-core";
import { HttpsAgent } from "agentkeepalive";
import bunyan from "bunyan";
import { SubnetConfig } from "../../config";
import { sleep } from "../../utils/index";
import { subnetExtensions, Web3WithExtension } from "./extensions";
import { NetworkInformation } from "../types";
import FullABI from "./ABI/FullABI.json";
import axios from "axios";

const TRANSACTION_GAS_NUMBER = 12500000000;   //TODO: check this is different now?, is there better way to handle?

export interface SubnetBlockInfo {
  subnetBlockHash: string;
  subnetBlockNumber: number;
  subnetBlockRound: number;
  encodedRLP: string;
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
    this.web3 = new Web3(provider).extend(subnetExtensions);
    this.smartContractInstance = new this.web3.eth.Contract(
      FullABI as AbiItem[],
      config.smartContractAddress
    );
    this.subnetAccount =  this.web3.eth.accounts.privateKeyToAccount(
      config.accountPK
    );
    this.subnetConfig = config;
  }
  
  async getNetworkInformation(): Promise<NetworkInformation> {
    return this.web3.xdcSubnet.getNetworkInformation();
  }

   //bypassing web3 with axios here,  really hard to use batch web3 in version 1.8.2, maybe later we upgrade to 4.x.x and utilize web3 batch
  async getCommittedBlockInfoBatch(startBlockNum: number, numToFetch: number): Promise<SubnetBlockInfo[]> {
    const data = [];
    const blockInfoList: SubnetBlockInfo[] = [];
    for (let i = startBlockNum; i<startBlockNum+numToFetch;i++){
      data.push({"jsonrpc":"2.0","method":"XDPoS_getV2BlockByNumber","params":[`0x${i.toString(16)}`],"id":1});
    }
    await axios.post(this.subnetConfig.url, data, {timeout: 10000}).then((response) => {
      for (let i=0; i<response.data.length; i++){
        const { Hash, Number, Round, EncodedRLP, ParentHash } = response.data[i].result;
        if (!Hash || !Number || !EncodedRLP || !ParentHash) {
          this.logger.error(
            "Invalid block hash or height or encodedRlp or ParentHash received",
            Hash,
            Number,
            EncodedRLP,
            ParentHash
          );
          throw new Error("Unable to get committed block information by height from PARENTNET");
        }
        blockInfoList.push({
          subnetBlockHash: Hash,
          subnetBlockNumber: Number,
          subnetBlockRound: Round,
          encodedRLP: EncodedRLP,
          parentHash: ParentHash,
        });
      }
      }).catch((error) => {
        this.logger.error("Axios Fetching Error:", error);
      });
    return blockInfoList;
  }
 
  async getLastCommittedBlockInfo(): Promise<SubnetBlockInfo> {
    try {
      const x = await this.web3.xdcSubnet.getV2Block("committed");
      const { Hash, Number, Round, EncodedRLP, ParentHash } =
        // await this.web3.xdcSubnet.getV2Block("committed");
        await this.web3.xdcSubnet.getV2Block("latest");
      if (!Hash || !Number || !EncodedRLP || !ParentHash) {
        this.logger.error(
          "Invalid block hash or height or encodedRlp or ParentHash received",
          Hash,
          Number,
          EncodedRLP,
          ParentHash
        );
        throw new Error("Unable to get latest committed block information on SUBNET");
      }
      return {
        subnetBlockHash: Hash,
        subnetBlockNumber: Number,
        subnetBlockRound: Round,
        encodedRLP: EncodedRLP,
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
      const { Hash, Number, Round, EncodedRLP, ParentHash } =
        await this.web3.xdcSubnet.getV2Block(`0x${blockNum.toString(16)}`);
      if (!Hash || !Number || !EncodedRLP || !ParentHash) {
        this.logger.error(
          "Invalid block hash or height or encodedRlp or ParentHash received",
          Hash,
          Number,
          EncodedRLP,
          ParentHash
        );
        throw new Error("Unable to get committed block information by height on SUBNET");
      }
      return {
        subnetBlockHash: Hash,
        subnetBlockNumber: Number,
        subnetBlockRound: Round,
        encodedRLP: EncodedRLP,
        parentHash: ParentHash,
      };
    } catch (error) {
      this.logger.error(
        "Error while trying to fetch blockInfo by number from SUBNET blockNum:",
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
      const { Hash, Number, Round, EncodedRLP, ParentHash } =
        await this.web3.xdcSubnet.getV2BlockByHash(blockHash);
      if (!Hash || !Number || !EncodedRLP || !ParentHash) {
        this.logger.error(
          "Invalid block hash or height or encodedRlp or ParentHash received",
          Hash,
          Number,
          EncodedRLP,
          ParentHash
        );
        throw new Error("Unable to get committed block information by hash on SUBNET");
      }
      return {
        subnetBlockHash: Hash,
        subnetBlockNumber: Number,
        subnetBlockRound: Round,
        encodedRLP: EncodedRLP,
        parentHash: ParentHash,
      };
    } catch (error) {
      this.logger.error(
        "Error while trying to fetch blockInfo by hash from SUBNET",
        { message: error.message, blockHash }
      );
      throw error;
    }
  }
  
  async getTransactionAndReceiptProof(txHash: string) {
    try {
      return this.web3.xdcSubnet.getTransactionAndReceiptProof(txHash);  
    } catch (error) {
      this.logger.error("Error while trying to fetch the transaction receipt proof on SUBNET", error);
      throw error;
    }
  }

  async bulkGetRlpHeaders(
    startingBlockNumber: number,
    numberOfBlocksToFetch: number
  ): Promise<Array<{ encodedRLP: string; blockNum: number }>> {
    this.logger.info(
      "Fetch subnet node data from " +
        startingBlockNumber +
        " to " +
        (startingBlockNumber + numberOfBlocksToFetch - 1)
    );
    const rlpHeaders: Array<{ encodedRLP: string; blockNum: number }> = [];
    const blockInfoList = await this.getCommittedBlockInfoBatch(startingBlockNumber, numberOfBlocksToFetch);
    for (let i=0; i<blockInfoList.length;i++){
      rlpHeaders.push({
       encodedRLP: blockInfoList[i].encodedRLP,
       blockNum: blockInfoList[i].subnetBlockNumber, 
      });
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
      this.logger.error("Fail to get block hash by number from SUBNET", {
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
        throw new Error("Unable to get last audited block informations on SUBNET");
      }
      return {
        smartContractHash: latestBlockHash,
        smartContractHeight: parseInt(latestBlockHeight),
        smartContractCommittedHash: latestSmComittedHash,
        smartContractCommittedHeight: parseInt(latestSmHeight),
      };
    } catch (error) {
      this.logger.error(
        "Error while trying to fetch the last audited subnet's block in XDC SUBNET",
        { message: error.message }
      );
      throw error;
    }
  }

  async submitTxs(
    results: Array<{ encodedRLP: string; blockNum: number }>
  ): Promise<void> {
    try {
      if (!results.length) return;
      const encodedHexArray = results.map(r => "0x" + Buffer.from(r.encodedRLP, "base64").toString("hex"));
      const transactionToBeSent =
        await this.smartContractInstance.methods.receiveHeader(encodedHexArray);
      const gas = await transactionToBeSent.estimateGas({
        from: this.subnetAccount.address,
      });
      const options = {
        to: transactionToBeSent._parent._address,
        data: transactionToBeSent.encodeABI(),
        gas,
        gasPrice: TRANSACTION_GAS_NUMBER,
      };
      const signed = await this.web3.eth.accounts.signTransaction(
        options,
        this.subnetAccount.privateKey
      );

      await this.web3.eth.sendSignedTransaction(signed.rawTransaction);

      await sleep(this.subnetConfig.submitTransactionWaitingTime);
    } catch (error) {
      this.logger.error("Fail to submit transactions into SUBNET", {
        message: error.message,
      });
      throw error;
    }
  }

  async submitTxsDynamic(results: Array<{ encodedRLP: string; blockNum: number }>): Promise<void> {
    const blocksPerTx = [5, 1];
    while (results.length) {
      let i = 0;
      while (i < blocksPerTx.length){
        const val = blocksPerTx[i];
        if (results.length >= val){
          try{
            this.logger.info("submitDynamic startblock", results[0].blockNum, "pushing", val, "blocks,", results.length, "remaining(inclusive) into SUBNET");
            await this.submitTxs(results.slice(0, val));
            results = results.slice(val, results.length);
            break; //if push success, reset push size
          } catch (error){}
        }
        if (i < blocksPerTx.length){
          i++;
        }
      }
    }
  }

  async Mode(): Promise<"lite"| "full"| "reverse_full"> {
    try {
      return this.smartContractInstance.methods.MODE().call();
    } catch (error) {
      this.logger.error("Fail to get mode from SUBNET smart contract");
      throw error;
    }
  }
}
