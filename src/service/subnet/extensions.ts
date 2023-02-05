import Web3 from "web3";

const SUBNET_EXTENSION_NAME = "xdcSubnet";

export interface CommittedBlockInfo {
  Hash: string;
  Number: number;
  Round: number;
}

export interface Web3WithExtension extends Web3 {
  xdcSubnet: {
    getLatestCommittedBlockInfo:  () => Promise<CommittedBlockInfo>
  }
}

export const subnetExtensions = {
  property: SUBNET_EXTENSION_NAME,
  methods: [
    {
      name: "getLatestCommittedBlockInfo",
      call: "XDPoS_getLatestCommittedBlockHeader"
    }
  ]
};

