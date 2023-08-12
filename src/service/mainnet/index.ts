import Web3 from "web3";
import { Contract } from "web3-eth-contract";
import { AbiItem } from "web3-utils";
import { HttpsAgent } from "agentkeepalive";
import { Account } from "web3-core";
import bunyan from "bunyan";
import { MainnetConfig } from "../../config";
import { sleep } from "../../utils/index";
import { ABI, liteABI } from "./contract";

export interface SmartContractData {
  smartContractHash: string;
  smartContractHeight: number;
  smartContractCommittedHeight: number;
  smartContractCommittedHash: string;
}

const TRANSACTION_GAS_NUMBER = 250000000;

export class MainnetClient {
  private web3: Web3;
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
    this.web3 = new Web3(provider);
    this.smartContractInstance = new this.web3.eth.Contract(
      ABI as AbiItem[],
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
  async getLastAudittedBlock(): Promise<SmartContractData> {
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
        throw new Error("Unable to get last auditted block informations");
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

  async submitTxs(
    results: Array<{ hexRLP: string; blockNum: number }>
  ): Promise<void> {
    try {
      if (!results.length) return;
      this.logger.info(
        `Submit the subnet block up to ${
          results[results.length - 1].blockNum
        } as tx into mainnet`
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
      this.logger.error("Fail to submit transactions into mainnet", {
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
      this.logger.error("Fail to get block hash by number from mainnet", {
        height,
        message: error.message,
      });
      throw error;
    }
  }
}

export class LiteMainnetClient {
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
      liteABI as AbiItem[],
      config.liteSmartContractAddress
    );
    this.mainnetAccount = this.web3.eth.accounts.privateKeyToAccount(
      config.accountPK
    );
    this.mainnetConfig = config;
  }

  /*
    A method to fetch the last subnet block that has been stored/audited in mainnet XDC
  **/
  async getLastAudittedBlock(): Promise<SmartContractData> {
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
        throw new Error("Unable to get last auditted block informations");
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
        } as tx into mainnet`
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
      this.logger.error("Fail to submit transactions into mainnet", {
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
      this.logger.error("Fail to get block hash by number from mainnet", {
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
      this.logger.error("Fail to getGapAndEpoch from mainnet", {
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
}
