import Web3 from "web3";

export const sleep = (ms: number) => {
  return new Promise((resolve) => {
    setTimeout(resolve, ms);
  });
};

export const chunkBy = (chunkValue: number) => (numToChunk: number): number[] => {
  const chunks = new Array(Math.floor(numToChunk / chunkValue)).fill(chunkValue);
  const remainder = numToChunk % chunkValue;
  if (remainder > 0) {
    chunks.push(remainder);
  }

  return chunks;
};
   
// Floor for transaction gas prices. Above it, the node's eth_gasPrice wins, since XDC networks raise
// their minimum gas price over time (devnet rejects anything under 625 gwei).
const MIN_GAS_PRICE = "12500000000";

export const getGasPrice = async (web3: Web3): Promise<string> => {
  const nodeGasPrice = web3.utils.toBN(await web3.eth.getGasPrice());
  const minGasPrice = web3.utils.toBN(MIN_GAS_PRICE);
  return (nodeGasPrice.gt(minGasPrice) ? nodeGasPrice : minGasPrice).toString();
};
