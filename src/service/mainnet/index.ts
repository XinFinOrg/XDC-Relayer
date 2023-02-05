import Web3 from "web3";
import * as ethUtils from "@ethereumjs/util";
import { RLP } from "@ethereumjs/rlp";
import { Contract } from "web3-eth-contract";
import {AbiItem} from "web3-utils";
import { XdcHeader } from "./../../utils/header";
import { InvalidInputError } from "./../../errors/invalidInput";
import { MainnetConfig } from "../../config";
import { sleep } from "../../utils/index";
import subnetContract from "../../../contract/subnet.json";
import { valuesArrayToHeaderData } from "../../utils/header";


export class MainnetClient {
  private web3: Web3;
  private subnetSmartContractInstance: Contract;
  constructor(config: MainnetConfig) {
    this.web3 = (new Web3(config.url));
    this.subnetSmartContractInstance = new this.web3.eth.Contract(subnetContract.abi as AbiItem[], config.smartContractAddress);
  }
  
  /*
    A method to fetch the last subnet block that has been stored/audited in mainnet XDC
  **/
  async getLastAuditedBlock(): Promise<XdcHeader> {
    try {
      const blockHash = await this.subnetSmartContractInstance.methods.getLatestFinalizedBlock().call();
      const rlpEncodedBlockHeader = await this.subnetSmartContractInstance.methods.getHeader(blockHash).call();
      return decodeInputToBlock(rlpEncodedBlockHeader);
    } catch (error) {
      console.error("Error while trying to fetch the last audited subnet's block in XDC mainnet", error);
      throw error;
    }
  }
  
  async submitTransactions(txs: any): Promise<void> {
    await sleep(2000);
    console.log("[Mainnet] Submit new transactions into XDC mainnet");
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