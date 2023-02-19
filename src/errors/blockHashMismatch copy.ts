export class BlockHashMismatch extends Error {
  constructor(blockNum: number, mainnetHash: string, subnetHash: string) {
    const message = `Block hash mismatch at same block height! BlockNum: ${blockNum}, mainnetHash: ${mainnetHash}, subnetHash: ${subnetHash}`;
    super(message);
  }
}