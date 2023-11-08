import { createPublicClient, http } from "viem";
import { mainnet } from "viem/chains";

export const client = createPublicClient({
  chain: mainnet,
  transport: http(),
});

export const getBlock = async () => {
  const blockNumber = await client.getBlockNumber();
  console.log(blockNumber);
};
