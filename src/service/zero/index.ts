import {
  createPublicClient,
  createWalletClient,
  http,
  decodeAbiParameters,
} from "viem";
import { privateKeyToAccount } from "viem/accounts";
import endpointABI from "../../abi/endpointABI.json";

// const account = privateKeyToAccount(`0x${process.env.PRIVATE_KEY}`);

const endpoint = "0xD4449Bf3f8E6a1b3fb5224F4e1Ec4288BD765547";

const xdcsubnet = {
  id: 4865,
  name: "XDC Subnet",
  network: "XDC Subnet",
  nativeCurrency: {
    decimals: 18,
    name: "XDC",
    symbol: "XDC",
  },
  rpcUrls: {
    public: { http: ["https://devnetstats.apothem.network/subnet"] },
    default: { http: ["https://devnetstats.apothem.network/subnet"] },
  },
};

// const walletClient = createWalletClient({
//   account,
//   chain: xdcsubnet,
//   transport: http(),
// });
export const publicClient = createPublicClient({
  chain: xdcsubnet,
  transport: http(),
});

export const getBlock = async () => {
  const blockNumber = await publicClient.getBlockNumber();
  console.log("viem:" + blockNumber);
};

export const validateTransactionProof = async () => {
  return;
};

export const sync = async () => {
  const logs = await publicClient.getContractEvents({
    address: endpoint as any,
    abi: endpointABI as any,
    fromBlock: BigInt(0),
    eventName: "Packet",
  });

  logs?.forEach((log) => {
    const values = decodeAbiParameters(
      [
        { name: "index", type: "uint" },
        { name: "sid", type: "uint" },
        { name: "sua", type: "address" },
        { name: "rid", type: "uint" },
        { name: "rua", type: "address" },
        { name: "data", type: "bytes" },
      ],
      `0x${log.data.substring(130)}`
    );
    console.log(values);
  });

  return;
};
