import Web3 from "web3";
import { Contract } from "web3-eth-contract";
import {AbiItem} from "web3-utils";
import { Account } from "web3-core";
import { MainnetConfig } from "../../config";
import { base64ToUint8, sleep } from "../../utils/index";
import subnetContract from "../../../contract/subnet.json";

export interface SmartContractData {
  smartContractHash: string;
  smartContractHeight: number;
}

const TRANSACTION_GAS_NUMBER = 250000000;

export class MainnetClient {
  private web3: Web3;
  private subnetSmartContractInstance: Contract;
  private mainnetAccount: Account;
  private mainnetConfig: MainnetConfig;
  constructor(config: MainnetConfig) {
    this.web3 = (new Web3(config.url));
    this.subnetSmartContractInstance = new this.web3.eth.Contract(subnetContract.abi as AbiItem[], config.smartContractAddress);
    this.mainnetAccount = this.web3.eth.accounts.privateKeyToAccount(config.accountPK);
  }
  
  /*
    A method to fetch the last subnet block that has been stored/audited in mainnet XDC
  **/
  async getLastAudittedBlock(): Promise<SmartContractData> {
    try {
      const [blockHash, blockHeight] = await this.subnetSmartContractInstance.methods.getLatestBlock().call();
      console.log(blockHash, blockHeight)
      if (!blockHash || !blockHeight) {
        console.error("Invalid block hash or height received", blockHash, blockHeight);
        throw new Error("Unable to get last auditted block information");
      }
      return {
        smartContractHash: blockHash, smartContractHeight: parseInt(blockHeight)
      };
    } catch (error) {
      console.error("Error while trying to fetch the last audited subnet's block in XDC mainnet", {message: error.message});
      throw error;
    }
  }
    
  async submitTxs(rlpEncodedHeaders: string[]): Promise<void> {
    try {
      for await (const h of rlpEncodedHeaders) {
        const rlpBytes = base64ToUint8(h);
        const transactionToBeSent = await this.subnetSmartContractInstance.methods.receiveHeader(rlpBytes);
        const gas = await transactionToBeSent.estimateGas({from: this.mainnetAccount.address});
        const options = {
          to: transactionToBeSent._parent._address,
          data: transactionToBeSent.encodeABI(),
          gas,
          gasPrice: TRANSACTION_GAS_NUMBER
        };
        const signed = await this.web3.eth.accounts.signTransaction(options, this.mainnetAccount.privateKey);
        const receipt = await this.web3.eth.sendSignedTransaction(signed.rawTransaction);
        console.info("Successfully submitted the subnet block as tx into mainnet", receipt);
        await sleep(this.mainnetConfig.submitTransactionWaitingTime);
      } 
    } catch (error) {
      console.error("Fail to submit transactions into mainnet", {message: error.message});
      throw error;
    }
  }
  
  async getBlockHashByNumber(height: number): Promise<string> {
    try {
      const { hash } = await this.web3.eth.getBlock(height);
      return hash;
    } catch (error) {
      
    }
  }
}
