import Web3 from "web3";
import * as ethUtils from "@ethereumjs/util";
import { Contract } from "web3-eth-contract";
import {AbiItem} from "web3-utils";
import { Account } from "web3-core";
import { RLP } from "@ethereumjs/rlp";
import { XdcHeader } from "./../../utils/header";
import { InvalidInputError } from "./../../errors/invalidInput";
import { MainnetConfig } from "../../config";
import { base64ToUint8, sleep } from "../../utils/index";
import subnetContract from "../../../contract/subnet.json";
import { valuesArrayToHeaderData } from "../../utils/header";

export interface MainnetBlock {
  mainnetBlockHash: string;
  mainnetHeader: XdcHeader;
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
  async getLastAuditedBlock(): Promise<MainnetBlock> {
    try {
      const blockHash = await this.subnetSmartContractInstance.methods.getLatestFinalizedBlock().call();
      const rlpEncodedBlockHeader = await this.subnetSmartContractInstance.methods.getHeader(blockHash).call();
      const header =  decodeInputToBlock(rlpEncodedBlockHeader);
      return {
        mainnetBlockHash: blockHash,
        mainnetHeader: header
      };
    } catch (error) {
      console.error("Error while trying to fetch the last audited subnet's block in XDC mainnet", {message: error.message});
      throw error;
    }
  }
  
  /*
    A method to fetch the last subnet block that has been stored/audited in mainnet XDC
  **/
    async getLastAuditedBlockHash(): Promise<string> {
      try {
        return await this.subnetSmartContractInstance.methods.getLatestFinalizedBlock().call();
      } catch (error) {
        console.error("Error while trying to fetch the last audited subnet's block hash in XDC mainnet's smart contract", {message: error.message});
        throw error;
      }
    }
  
  async submitTxs(rlpEncodedHeaders: string[]): Promise<void> {
    try {
      for await (const h of rlpEncodedHeaders) {
        const rlpBytes = base64ToUint8(h);
        const transactionToBeSent = await this.subnetSmartContractInstance.methods.receiveHeader(rlpBytes);
        const options = {
          to: transactionToBeSent._parent._address,
          data    : transactionToBeSent.encodeABI(),
          gas     : await transactionToBeSent.estimateGas({from: this.mainnetAccount.address}),
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
  
  async submitTx(rlpEncodedString: string): Promise<void> {
    try {
      const transactionToBeSent = await this.subnetSmartContractInstance.methods.receiveHeader(base64ToUint8(rlpEncodedString));
      console.log(await transactionToBeSent.estimateGas({from: this.mainnetAccount.address}));
    } catch (error) {
      console.error("Fail to submit transaction into mainnet", {message: error.message});
      throw error;
    }
  }
}

/*
  Help method to decode an "rlp encoded string" back into block header object 
**/
const decodeInputToBlock = (input: string): XdcHeader => {
  if (!input.length) {
    throw new InvalidInputError("Received empty input when tring to do rlp decode");
  }
  const values = ethUtils.arrToBufArr(RLP.decode(input));
  if (!Array.isArray(values)) {
    throw new Error("Invalid serialized header input. Must be array");
  }
  return valuesArrayToHeaderData(values as Buffer[]);
};