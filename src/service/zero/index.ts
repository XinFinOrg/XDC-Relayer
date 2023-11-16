import {
  createPublicClient,
  createWalletClient,
  http,
  decodeAbiParameters,
} from "viem";
import { privateKeyToAccount } from "viem/accounts";
import endpointABI from "../../abi/endpointABI.json";
import cscABI from "../../abi/cscABI.json";
import fetch from "node-fetch";
import { sleep } from "../../utils";

const account = privateKeyToAccount(`0x${process.env.ZERO_WALLET_PK}`);

const csc = process.env.CHECKPOINT_CONTRACT;

const parentnetCSCContract = {
  address: csc,
  abi: cscABI,
};

const subnetEndpointContract = {
  address: process.env.SUBNET_ZERO_CONTRACT,
  abi: endpointABI,
};

const parentnetEndpointContract = {
  address: process.env.PARENTNET_ZERO_CONTRACT,
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
    public: { http: [process.env.PARENTCHAIN_URL] },
    default: { http: [process.env.PARENTCHAIN_URL] },
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
    public: { http: [process.env.SUBNET_URL] },
    default: { http: [process.env.SUBNET_URL] },
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

export const getLatestBlockNumberFromCsc = async () => {
  const blocks = (await parentnetPublicClient.readContract({
    ...(parentnetCSCContract as any),
    functionName: "getLatestBlocks",
    args: [],
  })) as [any, any];

  return blocks[1]?.number;
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

    const cscBlockNumber = await getLatestBlockNumberFromCsc();

    if (cscBlockNumber < lastBlockNumber) {
      console.log(
        "wait for csc block lastBlockNumber:" +
          lastBlockNumber +
          " cscBlockNumber:" +
          cscBlockNumber
      );
      await sleep(1000);
      continue;
    }

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
    await sleep(1000);
  }
};
