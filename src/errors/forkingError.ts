export class ForkingError extends Error {
  constructor(blockNum: number, mainnetHash: string, subnetHash: string) {
    const message = `Forking detected! ${blockNum}, mainnetHash: ${mainnetHash} subnetHash: ${subnetHash}`;
    super(message);
  }
}