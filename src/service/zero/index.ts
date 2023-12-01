// import {
//   createPublicClient,
//   createWalletClient,
//   http,
//   decodeAbiParameters,
// } from "viem";
// import { privateKeyToAccount, PrivateKeyAccount } from "viem/accounts";
// import endpointABI from "../../abi/endpointABI.json";
// import cscABI from "../../abi/cscABI.json";
// import fetch from "node-fetch";
// import { sleep } from "../../utils";
// import Web3 from "web3";

// let account: PrivateKeyAccount = null;
// if (process.env.PARENTNET_ZERO_WALLET_PK) {
//   account = privateKeyToAccount(process.env.PARENTNET_ZERO_WALLET_PK as any);
// }

// const csc = process.env.CHECKPOINT_CONTRACT;

// const parentnetCSCContract = {
//   address: csc,
//   abi: cscABI,
// };

// const subnetEndpointContract = {
//   address: process.env.SUBNET_ZERO_CONTRACT,
//   abi: endpointABI,
// };

// const parentnetEndpointContract = {
//   address: process.env.PARENTNET_ZERO_CONTRACT,
//   abi: endpointABI,
// };
// const xdcparentnet = async () => {
//   return {
//     id: await getChainId(process.env.PARENTNET_URL),
//     name: "XDC Devnet",
//     network: "XDC Devnet",
//     nativeCurrency: {
//       decimals: 18,
//       name: "XDC",
//       symbol: "XDC",
//     },
//     rpcUrls: {
//       public: { http: [process.env.PARENTNET_URL] },
//       default: { http: [process.env.PARENTNET_URL] },
//     },
//   };
// };
// const xdcsubnet = async () => {
//   return {
//     id: await getChainId(process.env.SUBNET_URL),
//     name: "XDC Subnet",
//     network: "XDC Subnet",
//     nativeCurrency: {
//       decimals: 18,
//       name: "XDC",
//       symbol: "XDC",
//     },
//     rpcUrls: {
//       public: { http: [process.env.SUBNET_URL] },
//       default: { http: [process.env.SUBNET_URL] },
//     },
//   };
// };

// const getChainId = async (url: string) => {
//   const web3 = new Web3(url);
//   return web3.eth.getChainId();
// };

// const createParentnetWalletClient = async () => {
//   return createWalletClient({
//     account,
//     chain: await xdcparentnet(),
//     transport: http(),
//   });
// };

// export const createSubnetPublicClient = async () => {
//   return createPublicClient({
//     chain: await xdcsubnet(),
//     transport: http(),
//   });
// };

// export const createParentnetPublicClient = async () => {
//   return createPublicClient({
//     chain: await xdcparentnet(),
//     transport: http(),
//   });
// };

// export const validateTransactionProof = async (
//   cid: string,
//   key: string,
//   receiptProof: string[],
//   transactionProof: string[],
//   blockhash: string
// ) => {
//   const parentnetPublicClient = await createParentnetPublicClient();
//   const parentnetWalletClient = await createParentnetWalletClient();
//   const { request } = await parentnetPublicClient.simulateContract({
//     ...(parentnetEndpointContract as any),
//     account,
//     functionName: "validateTransactionProof",
//     args: [cid, key, receiptProof, transactionProof, blockhash],
//   });

//   const tx = await parentnetWalletClient.writeContract(request as any);
//   console.info(tx);
// };

// export const getLatestBlockNumberFromCsc = async () => {
//   const parentnetPublicClient = await createParentnetPublicClient();
//   const blocks = (await parentnetPublicClient.readContract({
//     ...(parentnetCSCContract as any),
//     functionName: "getLatestBlocks",
//     args: [],
//   })) as [any, any];

//   return blocks[1]?.number;
// };

// export const getIndexFromParentnet = async (): Promise<any> => {
//   const parentnetPublicClient = await createParentnetPublicClient();
//   const subnet = await xdcsubnet();
//   const chain = (await parentnetPublicClient.readContract({
//     ...(parentnetEndpointContract as any),
//     functionName: "getChain",
//     args: [subnet.id],
//   })) as { lastIndex: number };

//   return chain?.lastIndex;
// };

// export const getProof = async (txhash: string): Promise<any> => {
//   const res = await fetch(process.env.SUBNET_URL, {
//     method: "POST",
//     body: JSON.stringify({
//       jsonrpc: "2.0",
//       id: 1,
//       method: "eth_getTransactionAndReceiptProof",
//       params: [txhash],
//     }),
//     headers: { "Content-Type": "application/json" },
//   });
//   const json = await res.json();
//   return json?.result;
// };

// export const getPayloads = async () => {
//   const subnetPublicClient = await createSubnetPublicClient();
//   const payloads = [] as any;
//   const logs = await subnetPublicClient.getContractEvents({
//     ...(subnetEndpointContract as any),
//     fromBlock: BigInt(0),
//     eventName: "Packet",
//   });
//   const parentnet = await xdcparentnet();
//   logs?.forEach((log) => {
//     const values = decodeAbiParameters(
//       [
//         { name: "index", type: "uint" },
//         { name: "sid", type: "uint" },
//         { name: "sua", type: "address" },
//         { name: "rid", type: "uint" },
//         { name: "rua", type: "address" },
//         { name: "data", type: "bytes" },
//       ],
//       `0x${log.data.substring(130)}`
//     );

//     if (Number(values[3]) == parentnet.id) {
//       const list = [...values];
//       list.push(log.transactionHash);
//       list.push(log.blockNumber);
//       payloads.push(list);
//     }
//   });

//   return payloads;
// };

// export const sync = async () => {
//   while (true) {
//     console.info("start sync zero");
//     const payloads = await getPayloads();
//     if (payloads.length == 0) return;

//     const lastPayload = payloads[payloads.length - 1];
//     const lastIndexFromSubnet = lastPayload[0];

//     const lastIndexfromParentnet = await getIndexFromParentnet();

//     const lastBlockNumber = lastPayload[7];

//     const cscBlockNumber = await getLatestBlockNumberFromCsc();

//     if (cscBlockNumber < lastBlockNumber) {
//       console.info(
//         "wait for csc block lastBlockNumber:" +
//           lastBlockNumber +
//           " cscBlockNumber:" +
//           cscBlockNumber
//       );
//       await sleep(1000);
//       continue;
//     }

//     //it's better to fetch data from csc on parentnet , to get the latest subnet header data
//     const subnet = await xdcsubnet();

//     if (lastIndexFromSubnet > lastIndexfromParentnet) {
//       for (let i = lastIndexfromParentnet; i < lastIndexFromSubnet; i++) {
//         if (payloads?.[i]?.[6]) {
//           const proof = await getProof(payloads[i][6]);
//           await validateTransactionProof(
//             subnet.id.toString(),
//             proof.key,
//             proof.receiptProofValues,
//             proof.txProofValues,
//             proof.blockHash
//           );
//           console.info("sync zero index " + i + " success");
//         }
//       }
//     }
//     console.info("end sync zero ,sleep 1 seconds");
//     await sleep(1000);
//   }
// };
