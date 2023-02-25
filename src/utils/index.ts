import atob from "atob";

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

export const base64ToUint8 = (str: string): Uint8Array => Uint8Array.from(atob(str), (c) => c.charCodeAt(0));