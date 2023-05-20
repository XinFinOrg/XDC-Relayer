import Web3 from "web3";
import { Contract } from "web3-eth-contract";
import {AbiItem} from "web3-utils";
import { HttpsAgent } from "agentkeepalive";
import { Account } from "web3-core";
import bunyan from "bunyan";
import { MainnetConfig } from "../../config";
import { sleep } from "../../utils/index";
import { abi } from "./contract";


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
    const provider = new Web3.providers.HttpProvider(config.url, { keepAlive: true, agent: {https: keepaliveAgent } });
    this.web3 = (new Web3(provider));
    this.smartContractInstance = new this.web3.eth.Contract(abi as AbiItem[], config.smartContractAddress);
    this.mainnetAccount = this.web3.eth.accounts.privateKeyToAccount(config.accountPK);
    this.mainnetConfig = config;
  }
  
  /*
    A method to fetch the last subnet block that has been stored/audited in mainnet XDC
  **/
  async getLastAudittedBlock(): Promise<SmartContractData> {
    try {
      const result = await this.smartContractInstance.methods.getLatestBlocks().call();
      const [latestBlockHash, latestBlockHeight] = result[0];
      const [latestSmComittedHash, latestSmHeight] = result[1];
      if (!latestBlockHash || !latestBlockHeight || !latestSmComittedHash || !latestSmHeight) {
        this.logger.error("Invalid block hash or height received", latestBlockHash, latestBlockHeight, latestSmComittedHash, latestSmHeight);
        throw new Error("Unable to get last auditted block informations");
      }
      return {
        smartContractHash: latestBlockHash, smartContractHeight: parseInt(latestBlockHeight),
        smartContractCommittedHash: latestSmComittedHash, smartContractCommittedHeight: parseInt(latestSmHeight)
      };
    } catch (error) {
      this.logger.error("Error while trying to fetch the last audited subnet's block in XDC mainnet", {message: error.message});
      throw error;
    }
  }
    
  async submitTxs(results: Array<{encodedRLP: string, blockNum: number}>): Promise<void> {
    try {
      if (!results.length) return;
      const encodedHexArray = results.map(r => "0x" + Buffer.from(r.encodedRLP, "base64").toString("hex"));
      const transactionToBeSent = await this.smartContractInstance.methods.receiveHeader(encodedHexArray);
      const gas = await transactionToBeSent.estimateGas({from: this.mainnetAccount.address});
      const options = {
        to: transactionToBeSent._parent._address,
        data: transactionToBeSent.encodeABI(),
        gas,
        gasPrice: TRANSACTION_GAS_NUMBER
      };
      const signed = await this.web3.eth.accounts.signTransaction(options, this.mainnetAccount.privateKey);
      await this.web3.eth.sendSignedTransaction(signed.rawTransaction);
      this.logger.info(`Successfully submitted the subnet block up to ${results[results.length-1].blockNum} as tx into mainnet`);
      await sleep(this.mainnetConfig.submitTransactionWaitingTime);
    } catch (error) {
      this.logger.error("Fail to submit transactions into mainnet", {message: error.message});
      throw error;
    }
  }
  
  // Below shall be given height provide the SM hash
  async getBlockHashByNumber(height: number): Promise<string> {
    try {
      const result = await this.smartContractInstance.methods.getHeaderByNumber(height);
      return result[0];
    } catch (error) {
      this.logger.error("Fail to get block hash by number from mainnet", { height, message: error.message});
      throw error;
    }
  }
}
