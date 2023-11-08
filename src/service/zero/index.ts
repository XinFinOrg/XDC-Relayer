import { createPublicClient, createWalletClient, http } from "viem";
import { privateKeyToAccount } from "viem/accounts";
import { mainnet } from "viem/chains";

const account = privateKeyToAccount(`0x${process.env.PRIVATE_KEY}`);

const walletClient = createWalletClient({
  account,
  chain: mainnet,
  transport: http(),
});
export const publicClient = createPublicClient({
  chain: mainnet,
  transport: http(),
});

export const getBlock = async () => {
  const blockNumber = await publicClient.getBlockNumber();
  console.log("viem:" + blockNumber);
};

export const getPayload = async () => {
  return;
};
