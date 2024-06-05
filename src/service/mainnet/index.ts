import Web3 from "web3";
import { Contract } from "web3-eth-contract";
import { AbiItem } from "web3-utils";
import { Account } from "web3-core";
import { HttpsAgent } from "agentkeepalive";
import bunyan from "bunyan";
import { MainnetConfig } from "../../config";
import { sleep } from "../../utils/index";
import FullABI from "./ABI/FullABI.json";
import LiteABI from "./ABI/LiteABI.json";
import { Web3WithExtension, mainnetExtensions } from "./extensions";
import { NetworkInformation } from "../types";

const TRANSACTION_GAS_NUMBER = 12500000000;   //TODO: check this is different now?, is there better way to handle?

export interface MainnetBlockInfo {
  mainnetBlockHash: string;
  mainnetBlockNumber: number;
  mainnetBlockRound: number;
  hexRLP: string;
  parentHash: string;
}
export interface SmartContractData {
  smartContractHash: string;
  smartContractHeight: number;
  smartContractCommittedHeight: number;
  smartContractCommittedHash: string;
}


export class MainnetService {
  private web3: Web3WithExtension;
  private smartContractInstance: Contract;
  private mainnetAccount: Account;
  private mainnetConfig: MainnetConfig;
  logger: bunyan;

  constructor(config: MainnetConfig, logger: bunyan) {
    this.logger = logger;
    const keepaliveAgent = new HttpsAgent();
    const provider = new Web3.providers.HttpProvider(config.url, {
      keepAlive: true,
      agent: { https: keepaliveAgent },
    });
    this.web3 = new Web3(provider).extend(mainnetExtensions);
    this.smartContractInstance = new this.web3.eth.Contract(
      FullABI as AbiItem[],
      config.smartContractAddress
    );
    this.mainnetAccount = this.web3.eth.accounts.privateKeyToAccount(
      config.accountPK
    );
    this.mainnetConfig = config;
  }
  
  async getNetworkInformation(): Promise<NetworkInformation> {
    return this.web3.xdcMainnet.getNetworkInformation();
  }

  /*
    A method to fetch the last subnet block that has been stored/audited in mainnet XDC
  **/
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
        throw new Error("Unable to get last audited block informations from PARENTNET");
      }
      return {
        smartContractHash: latestBlockHash,
        smartContractHeight: parseInt(latestBlockHeight),
        smartContractCommittedHash: latestSmComittedHash,
        smartContractCommittedHeight: parseInt(latestSmHeight),
      };
    } catch (error) {
      this.logger.error(
        "Error while trying to fetch the last audited subnet's block in XDC PARENTNET",
        { message: error.message }
      );
      throw error;
    }
  }

  async submitTxs(
    results: Array<{ hexRLP: string; blockNum: number }>
  ): Promise<void> {
    try {
      if (!results.length) return;
      this.logger.info(
        `Submit the subnet block up to ${
          results[results.length - 1].blockNum
        } as tx into PARENTNET`
      );
      //const encodedHexArray = results.map(r => "0x" + Buffer.from(r.encodedRLP, "base64").toString("hex")); //old method for reference
      const hexArray = results.map((r) => "0x" + r.hexRLP);
      const transactionToBeSent =
        await this.smartContractInstance.methods.receiveHeader(hexArray);
      const gas = await transactionToBeSent.estimateGas({
        from: this.mainnetAccount.address,
      });
      const options = {
        to: transactionToBeSent._parent._address,
        data: transactionToBeSent.encodeABI(),
        gas,
        gasPrice: TRANSACTION_GAS_NUMBER,
      };
      const signed = await this.web3.eth.accounts.signTransaction(
        options,
        this.mainnetAccount.privateKey
      );

      await this.web3.eth.sendSignedTransaction(signed.rawTransaction);

      await sleep(this.mainnetConfig.submitTransactionWaitingTime);
    } catch (error) {
      this.logger.error("Fail to submit transactions into PARENTNET", {
        message: error.message,
      });
      throw error;
    }
  }

  // Below shall be given height provide the SM hash
  async getBlockHashByNumber(height: number): Promise<string> {
    try {
      const result = await this.smartContractInstance.methods
        .getHeaderByNumber(height)
        .call();
      return result[0];
    } catch (error) {
      this.logger.error("Fail to get block hash by number from PARENTNET", {
        height,
        message: error.message,
      });
      throw error;
    }
  }

  async getCommittedBlockInfoByNum(blockNum: number): Promise<MainnetBlockInfo> {
    try {
      const { Hash, Number, Round, EncodedRLP, ParentHash } =
        await this.web3.xdcMainnet.getV2Block(`0x${blockNum.toString(16)}`);
        const HexRLP = EncodedRLP;
      if (!Hash || !Number || !HexRLP || !ParentHash) {
        this.logger.error(
          "Invalid block hash or height or encodedRlp or ParentHash received",
          Hash,
          Number,
          HexRLP,
          ParentHash
        );
        throw new Error("Unable to get committed block information by height from PARENTNET");
      }
      return {
        mainnetBlockHash: Hash,
        mainnetBlockNumber: Number,
        mainnetBlockRound: Round,
        hexRLP: HexRLP,
        parentHash: ParentHash,
      };
    } catch (error) {
      this.logger.error(
        "Error while trying to fetch blockInfo by number from PARENTNET blockNum:",
        blockNum,
        { message: error.message }
      );
      throw error;
    }
  }

  async getLastCommittedBlockInfo(): Promise<MainnetBlockInfo> {
    try {
      const { Hash, Number, Round, EncodedRLP, ParentHash } =
        await this.web3.xdcMainnet.getV2Block("committed");
      const HexRLP = EncodedRLP;
      if (!Hash || !Number || !HexRLP || !ParentHash) {
        this.logger.error(
          "Invalid block hash or height or encodedRlp or ParentHash received",
          Hash,
          Number,
          HexRLP,
          ParentHash
        );
        throw new Error("Unable to get latest committed block information from PARENTNET");
      }
      return {
        mainnetBlockHash: Hash,
        mainnetBlockNumber: Number,
        mainnetBlockRound: Round,
        hexRLP: HexRLP,
        parentHash: ParentHash,
      };
    } catch (error) {
      this.logger.error(
        "Error getLastCommittedBlockInfo while trying to fetch blockInfo by number from PARENTNET",
        { message: error.message }
      );
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
      await sleep(this.mainnetConfig.fetchWaitingTime);
    }
    return rlpHeaders;
  }

  async Mode(): Promise<"lite"| "full"| "reverse full"> {
    try {
      return this.smartContractInstance.methods.MODE().call();
    } catch (error) {
      this.logger.error("Fail to get mode from PARENTNET smart contract");
      throw error;
    }
  }
}

export class LiteMainnetService {
  private web3: Web3;
  private liteSmartContractInstance: Contract;
  private mainnetAccount: Account;
  private mainnetConfig: MainnetConfig;
  logger: bunyan;

  constructor(config: MainnetConfig, logger: bunyan) {
    this.logger = logger;
    const keepaliveAgent = new HttpsAgent();
    const provider = new Web3.providers.HttpProvider(config.url, {
      keepAlive: true,
      agent: { https: keepaliveAgent },
    });
    this.web3 = new Web3(provider);
    this.liteSmartContractInstance = new this.web3.eth.Contract(
      LiteABI as AbiItem[],
      config.smartContractAddress
    );
    this.mainnetAccount = this.web3.eth.accounts.privateKeyToAccount(
      config.accountPK
    );
    this.mainnetConfig = config;
  }

  /*
    A method to fetch the last subnet block that has been stored/audited in mainnet XDC
  **/
  async getLastAuditedBlock(): Promise<SmartContractData> {
    try {
      const result = await this.liteSmartContractInstance.methods
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
        throw new Error("Unable to get last audited block informations from PARENTNET");
      }
      return {
        smartContractHash: latestBlockHash,
        smartContractHeight: parseInt(latestBlockHeight),
        smartContractCommittedHash: latestSmComittedHash,
        smartContractCommittedHeight: parseInt(latestSmHeight),
      };
    } catch (error) {
      this.logger.error(
        "Error while trying to fetch the last audited subnet's block in XDC PARENTNET",
        { message: error.message }
      );
      throw error;
    }
  }

  async submitTxs(
    results: Array<{ hexRLP: string; blockNum: number }>
  ): Promise<void> {
    try {
      if (!results.length) return;
      this.logger.info(
        `Submit the subnet block epoch ${
          results[0].blockNum
        } and commit block up to ${
          results[results.length - 1].blockNum
        } as tx into PARENTNET`
      );

      //const encodedHexArray = results.map(r => "0x" + Buffer.from(r.encodedRLP, "base64").toString("hex")); //old method for reference
      const hexArray = results.map((r) => "0x" + r.hexRLP);
      const transactionToBeSent =
        await this.liteSmartContractInstance.methods.receiveHeader(hexArray);

      const gas = await transactionToBeSent.estimateGas({
        from: this.mainnetAccount.address,
      });
      const options = {
        to: transactionToBeSent._parent._address,
        data: transactionToBeSent.encodeABI(),
        gas,
        gasPrice: TRANSACTION_GAS_NUMBER,
      };
      const signed = await this.web3.eth.accounts.signTransaction(
        options,
        this.mainnetAccount.privateKey
      );

      await this.web3.eth.sendSignedTransaction(signed.rawTransaction);

      await sleep(this.mainnetConfig.submitTransactionWaitingTime);
    } catch (error) {
      this.logger.error("Fail to submit transactions into PARENTNET", {
        message: error.message,
      });
      throw error;
    }
  }

  // Below shall be given height provide the SM hash
  async getBlockHashByNumber(height: number): Promise<string> {
    try {
      const result = await this.liteSmartContractInstance.methods
        .getHeaderByNumber(height)
        .call();
      return result[0];
    } catch (error) {
      this.logger.error("Fail to get block hash by number from PARENTNET", {
        height,
        message: error.message,
      });
      throw error;
    }
  }

  async getGapAndEpoch(): Promise<{ gap: number; epoch: number }> {
    try {
      const gap = await this.liteSmartContractInstance.methods
        .INIT_GAP()
        .call();

      const epoch = await this.liteSmartContractInstance.methods
        .INIT_EPOCH()
        .call();
      return { gap, epoch };
    } catch (error) {
      this.logger.error("Fail to getGapAndEpoch from PARENTNET", {
        message: error.message,
      });
      throw error;
    }
  }

  async commitHeader(epochHash: string, headers: Array<string>): Promise<void> {
    try {
      const transactionToBeSent =
        await this.liteSmartContractInstance.methods.commitHeader(
          epochHash,
          headers
        );
      const gas = await transactionToBeSent.estimateGas({
        from: this.mainnetAccount.address,
      });
      const options = {
        to: transactionToBeSent._parent._address,
        data: transactionToBeSent.encodeABI(),
        gas,
        gasPrice: TRANSACTION_GAS_NUMBER,
      };
      const signed = await this.web3.eth.accounts.signTransaction(
        options,
        this.mainnetAccount.privateKey
      );

      await this.web3.eth.sendSignedTransaction(signed.rawTransaction);

      await sleep(this.mainnetConfig.submitTransactionWaitingTime);
    } catch (error) {
      this.logger.error("Fail to commitHeader from mainnet", {
        message: error.message,
      });
      throw error;
    }
  }

  async getUnCommittedHeader(
    epochHash: string
  ): Promise<{ sequence: number; lastRoundNum: number; lastNum: number }> {
    try {
      const result = await this.liteSmartContractInstance.methods
        .getUnCommittedHeader(epochHash)
        .call();
      return {
        sequence: result[0],
        lastRoundNum: result[1],
        lastNum: result[2],
      };
    } catch (error) {
      this.logger.error("Fail to commitHeader to mainnnet", {
        message: error.message,
      });
      throw error;
    }
  }
  async Mode(): Promise<"lite"| "full"| "reverse full"> {
    try {
      return this.liteSmartContractInstance.methods.MODE().call();
    } catch (error) {
      this.logger.error("Fail to get mode from mainnet smart contract");
      throw error;
    }
  }
  
}

function base64ToHex(base64String: string) {
  // Step 1: Decode base64 string to binary data
  const binaryString = atob(base64String);

  // Step 2: Convert binary data to hex
  let hexString = "";
  for (let i = 0; i < binaryString.length; i++) {
    const hex = binaryString.charCodeAt(i).toString(16);
    hexString += hex.length === 2 ? hex : "0" + hex;
  }

  return hexString;
}