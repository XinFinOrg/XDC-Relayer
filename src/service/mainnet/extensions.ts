import Web3 from "web3";
import { NetworkInformation } from "../types";

const MAINNET_EXTENSION_NAME = "xdcMainnet";

export interface Web3WithExtension extends Web3 {
  xdcMainnet: {
    getNetworkInformation: () => Promise<NetworkInformation>
  }
}

export const mainnetExtensions = {
  property: MAINNET_EXTENSION_NAME,
  methods: [
    {
      name: "getNetworkInformation",
      call: "XDPoS_networkInformation"
    }
  ]
};

