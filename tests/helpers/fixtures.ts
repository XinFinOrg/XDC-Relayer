import xdposChainBlock from "../fixtures/xdposchain-v2block-1957888.json";

// A committed devnet block as returned by XDPoSChain (geth): PascalCase keys, JSON numbers. Its
// EncodedRLP hashes (keccak256) to its Hash.
export const gethV2Block = xdposChainBlock;

const toHex = (n: number) => "0x" + n.toString(16);

// The same block in the shape Nethermind returns (camelCase keys, hex-string numbers, no Error
// field), as observed from nethermindeth/nethermind:master-c88b947.
export const nethermindV2Block = {
  hash: gethV2Block.Hash,
  round: toHex(gethV2Block.Round),
  number: toHex(gethV2Block.Number),
  parentHash: gethV2Block.ParentHash,
  committed: gethV2Block.Committed,
  miner: "0x" + gethV2Block.Miner.slice(-40),
  timestamp: toHex(gethV2Block.Timestamp),
  encodedRLP: gethV2Block.EncodedRLP,
};

export const hash = (n: number) => "0x" + n.toString(16).padStart(64, "0");

// A V2 block in XDPoSChain shape for block n, with deterministic hashes.
export const v2Block = (n: number, overrides: Record<string, unknown> = {}) => ({
  Hash: hash(n),
  Round: n,
  Number: n,
  ParentHash: hash(n - 1),
  Committed: true,
  Miner: hash(0),
  Timestamp: 1700000000 + n,
  EncodedRLP: Buffer.from(`header-${n}`).toString("base64"),
  Error: "",
  ...overrides,
});
