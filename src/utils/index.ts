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
