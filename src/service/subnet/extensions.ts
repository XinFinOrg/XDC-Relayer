import Web3 from "web3";
import { NetworkInformation } from "../types";

const SUBNET_EXTENSION_NAME = "xdcSubnet";

export interface Web3WithExtension extends Web3 {
  xdcSubnet: {
    getLatestCommittedBlockInfo:  () => Promise<CommittedBlockInfo>
    getV2Block: (number: string) => Promise<FetchedV2BlockInfo>
    getV2BlockByNumber: (bluckNum: string) => Promise<FetchedV2BlockInfo>
    getV2BlockByHash: (blockHash: string) => Promise<FetchedV2BlockInfo>
    getNetworkInformation: () => Promise<NetworkInformation>
    getTransactionAndReceiptProof: (txHash: string) => Promise<TxReceiptProof>
  }
}

export interface CommittedBlockInfo {
  Hash: string;
  Number: number;
  Round: number;
}

export interface FetchedV2BlockInfo {
  Committed: boolean;
  Hash: string;
  ParentHash: string;
  Number: number;
  Round: number;
  EncodedRLP: string;
  Error: string;
}

export interface TxReceiptProof {
  blockHash: string;
  key: string;
  receiptProofKeys: string[];
  receiptProofValues: string[];
  receiptRoot: string;
  txProofKeys: string;
  txProofValues: string[];
  txRoot: string;
}



export const subnetExtensions = {
  property: SUBNET_EXTENSION_NAME,
  methods: [
    {
      name: "getLatestCommittedBlockInfo",
      call: "XDPoS_getLatestCommittedBlockHeader"
    },
    {
      name: "getV2Block",
      params: 1,
      call: "XDPoS_getV2BlockByNumber"
    },
    {
      name: "getV2BlockByNumber",
      params: 1,
      call: "XDPoS_getV2BlockByNumber"
    },
    {
      name: "getV2BlockByHash",
      params: 1,
      call: "XDPoS_getV2BlockByHash"
    }, {
      name: "getNetworkInformation",
      params: 0,
      call: "XDPoS_networkInformation"
    },
    {
      name: "getTransactionAndReceiptProof",
      params: 1,
      call: "eth_getTransactionAndReceiptProof"
    }
  ]
};

