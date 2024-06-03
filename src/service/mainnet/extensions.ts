import Web3 from "web3";
import { NetworkInformation } from "../types";

const MAINNET_EXTENSION_NAME = "xdcMainnet";

export interface Web3WithExtension extends Web3 {
  xdcMainnet:{
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
  HexRLP: string;
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

export const mainnetExtensions = {
  property: MAINNET_EXTENSION_NAME,
  methods: [
    {
      name: "getNetworkInformation",
      params: 0,
      call: "XDPoS_networkInformation"
    },
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
    }, 
    {
      name: "getTransactionAndReceiptProof",
      params: 1,
      call: "eth_getTransactionAndReceiptProof"
    }
  ]
};
