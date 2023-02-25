export class InvalidBlockHeight extends Error {
  constructor(mainnetBlockNumber: number, subnetBlockNumber: number) {
    const message = `Block number height mismatch! Mainnet number ${mainnetBlockNumber} and subnet has ${subnetBlockNumber}`;
    super(message);
  }
}