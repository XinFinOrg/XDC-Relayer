import {
  createPublicClient,
  createWalletClient,
  http,
  decodeAbiParameters,
} from "viem";
import { privateKeyToAccount } from "viem/accounts";
import endpointABI from "../../abi/endpointABI.json";

// const account = privateKeyToAccount(`0x${process.env.PRIVATE_KEY}`);

const subnetEndpointContract = {
  address: "0xD4449Bf3f8E6a1b3fb5224F4e1Ec4288BD765547",
  abi: endpointABI,
};

const devnetEndpointContract = {
  address: "0xc77f4F74FE5E0416A8e35285332f189954928834",
  abi: endpointABI,
};
const xdcdevnet = {
  id: 551,
  name: "XDC Devnet",
  network: "XDC Devnet",
  nativeCurrency: {
    decimals: 18,
    name: "XDC",
    symbol: "XDC",
  },
  rpcUrls: {
    public: { http: ["https://devnetstats.apothem.network/devnet"] },
    default: { http: ["https://devnetstats.apothem.network/devnet"] },
  },
};
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
export const subnetPublicClient = createPublicClient({
  chain: xdcsubnet,
  transport: http(),
});

export const devnetPublicClient = createPublicClient({
  chain: xdcdevnet,
  transport: http(),
});

export const getBlock = async () => {
  const blockNumber = await subnetPublicClient.getBlockNumber();
  console.log("viem:" + blockNumber);
};

export const validateTransactionProof = async () => {
  return;
};

export const getIndexFromParentnet = async (): Promise<any> => {
  const index = await devnetPublicClient.readContract({
    ...(devnetEndpointContract as any),
    functionName: "getChainIndex",
    args: [xdcsubnet.id],
  });
  return index;
};

export const getPayloads = async () => {
  const payloads = [] as any;
  const logs = await subnetPublicClient.getContractEvents({
    ...(subnetEndpointContract as any),
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
    payloads.push(values);
  });

  return payloads;
};

export const sync = async () => {
  const index = await getIndexFromParentnet();
  console.log(index);
  const payloads = await getPayloads();

  console.log(payloads);

  return;
};
