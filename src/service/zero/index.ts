import {
  createPublicClient,
  createWalletClient,
  http,
  decodeAbiParameters,
} from "viem";
import { privateKeyToAccount } from "viem/accounts";
import endpointABI from "../../abi/endpointABI.json";
import fetch from "node-fetch";
import { sleep } from "../../utils";

const account = privateKeyToAccount(`0x${process.env.ZERO_WALLET_PK}`);

const subnetEndpointContract = {
  address: "0x36757BaA2F0b767Ea4DCFb434F46ACD020046f47",
  abi: endpointABI,
};

const parentnetEndpointContract = {
  address: "0x6edf5Cf866eD8b0C40B4e9eb363DDc1d5EFf30C8",
  abi: endpointABI,
};
const xdcparentnet = {
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
  id: 12755,
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

const parentnetWalletClient = createWalletClient({
  account,
  chain: xdcparentnet,
  transport: http(),
});
export const subnetPublicClient = createPublicClient({
  chain: xdcsubnet,
  transport: http(),
});

export const parentnetPublicClient = createPublicClient({
  chain: xdcparentnet,
  transport: http(),
});

export const getBlock = async () => {
  const blockNumber = await subnetPublicClient.getBlockNumber();
  console.log("viem:" + blockNumber);
};

export const validateTransactionProof = async (
  cid: string,
  key: string,
  receiptProof: string[],
  transactionProof: string[],
  blockhash: string
) => {
  const { request } = await parentnetPublicClient.simulateContract({
    ...(parentnetEndpointContract as any),
    account,
    functionName: "validateTransactionProof",
    args: [cid, key, receiptProof, transactionProof, blockhash],
  });
  const tx = await parentnetWalletClient.writeContract(request as any);
  console.log(tx);
};

export const getIndexFromParentnet = async (): Promise<any> => {
  const chain = (await parentnetPublicClient.readContract({
    ...(parentnetEndpointContract as any),
    functionName: "getChain",
    args: [xdcsubnet.id],
  })) as { lastIndex: number };

  return chain?.lastIndex;
};

export const getProof = async (txhash: string): Promise<any> => {
  const res = await fetch("https://devnetstats.apothem.network/subnet", {
    method: "POST",
    body: JSON.stringify({
      jsonrpc: "2.0",
      id: 1,
      method: "eth_getTransactionAndReceiptProof",
      params: [txhash],
    }),
    headers: { "Content-Type": "application/json" },
  });
  const json = await res.json();
  return json?.result;
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

    if (Number(values[3]) == xdcparentnet.id) {
      const list = [...values];
      list.push(log.transactionHash);
      list.push(log.blockNumber);
      payloads.push(list);
    }
  });

  return payloads;
};

export const sync = async () => {
  while (true) {
    console.log("start sync zero");
    const payloads = await getPayloads();
    if (payloads.length == 0) return;

    const lastPayload = payloads[payloads.length - 1];
    const lastIndexFromSubnet = lastPayload[0];

    const lastIndexfromParentnet = await getIndexFromParentnet();

    const lastBlockNumber = lastPayload[7];

    //it's better to fetch data from csc on parentnet , to get the latest subnet header data
    

    if (lastIndexFromSubnet > lastIndexfromParentnet) {
      for (let i = lastIndexfromParentnet; i <= lastIndexFromSubnet; i++) {
        const proof = await getProof(payloads[i][6]);
        await validateTransactionProof(
          xdcsubnet.id.toString(),
          proof.key,
          proof.receiptProofValues,
          proof.txProofValues,
          proof.blockHash
        );
        console.log("sync zero index " + i + " success");
      }
    }
    console.log("end sync zero ,sleep 10 seconds");
    await sleep(10000);
  }
};
