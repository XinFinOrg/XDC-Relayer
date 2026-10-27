import axios from "axios";
import Web3 from "web3";
import { TransactionFactory } from "@ethereumjs/tx";
import { FakeProvider, JsonRpcRequest, RpcHandler } from "./fakeProvider";

export const PK = "0x" + "11".repeat(32);
export const ACCOUNT = new Web3().eth.accounts.privateKeyToAccount(PK).address;
export const CSC_ADDRESS = "0x00000000000000000000000000000000000000c5";
export const serviceConfig = {
  url: "http://relayer-test.invalid",
  smartContractAddress: CSC_ADDRESS,
  accountPK: PK,
  fetchWaitingTime: 0,
  submitTransactionWaitingTime: 0,
};

// Points a service's web3 instance (and everything built on it: contracts, accounts, the XDPoS
// extension) at a fake provider.
export const attachProvider = (service: unknown, handlers: Record<string, RpcHandler> = {}) => {
  const provider = new FakeProvider(handlers);
  (service as { web3: Web3 }).web3.setProvider(provider as never);
  return provider;
};

// Serves the relayer's axios JSON-RPC batch posts from the fake provider. `reorder` lets a test
// return batch responses in a different order, which the JSON-RPC spec allows.
export const routeAxiosBatches = (
  provider: FakeProvider,
  reorder: (responses: unknown[]) => unknown[] = (r) => r
) =>
  jest.spyOn(axios, "post").mockImplementation(async (_url: string, body: unknown) => ({
    status: 200,
    data: reorder((body as JsonRpcRequest[]).map((request) => provider.handle(request))),
  }));

// Handlers for the RPC calls web3 makes when signing and sending a transaction. The receipt is
// available immediately.
export const transactionHandlers = (gasPrice = "0x2e90edd00"): Record<string, RpcHandler> => ({
  eth_estimateGas: () => "0x30d40",
  eth_gasPrice: () => gasPrice,
  eth_chainId: () => "0x33",
  net_version: () => "51",
  eth_getTransactionCount: () => "0x7",
  eth_sendRawTransaction: () => "0x" + "ab".repeat(32),
  eth_getTransactionReceipt: () => ({
    transactionHash: "0x" + "ab".repeat(32),
    blockHash: "0x" + "cd".repeat(32),
    blockNumber: "0x10",
    transactionIndex: "0x0",
    status: "0x1",
    gasUsed: "0x5208",
    cumulativeGasUsed: "0x5208",
    logs: [],
    logsBloom: "0x" + "00".repeat(256),
    contractAddress: null,
    from: ACCOUNT.toLowerCase(),
    to: CSC_ADDRESS,
  }),
  eth_getBlockByNumber: () => ({ number: "0x10", hash: "0x" + "cd".repeat(32), transactions: [] }),
  eth_blockNumber: () => "0x10",
});

// Decodes every raw transaction the provider received.
export const sentTransactions = (provider: FakeProvider) =>
  provider.calls("eth_sendRawTransaction").map(([raw]) => {
    const tx = TransactionFactory.fromSerializedData(Buffer.from((raw as string).slice(2), "hex"));
    return {
      to: tx.to?.toString(),
      from: tx.getSenderAddress().toString(),
      gasPrice: (tx as unknown as { gasPrice: bigint }).gasPrice,
      gasLimit: tx.gasLimit,
      nonce: tx.nonce,
      data: "0x" + Buffer.from(tx.data).toString("hex"),
    };
  });
