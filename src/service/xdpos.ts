import type { CommittedBlockInfo, FetchedV2BlockInfo } from "./subnet/extensions";
import { NetworkInformation } from "./types";

// XDPoS RPC responses differ by client: XDPoSChain returns PascalCase keys ("EncodedRLP") and JSON
// numbers, while Nethermind returns camelCase keys ("encodedRLP") and hex strings ("0x47").
// These formatters map either shape onto the PascalCase/number interfaces the relayer uses.

type RawResult = Record<string, unknown>;

const isObject = (raw: unknown): raw is RawResult =>
  typeof raw === "object" && raw !== null;

export const getField = (raw: RawResult, key: string): unknown => {
  if (key in raw) return raw[key];
  const lowerKey = key.toLowerCase();
  const match = Object.keys(raw).find((k) => k.toLowerCase() === lowerKey);
  return match === undefined ? undefined : raw[match];
};

// Number() parses both decimal and "0x" hex strings; missing values stay undefined so the callers'
// presence checks still catch them.
const getNumber = (raw: RawResult, key: string): number | undefined => {
  const value = getField(raw, key);
  return value === undefined || value === null ? undefined : Number(value);
};

export const formatV2BlockInfo = (raw: unknown): FetchedV2BlockInfo => {
  if (!isObject(raw)) return raw as FetchedV2BlockInfo;
  return {
    Committed: getField(raw, "Committed") as boolean,
    Hash: getField(raw, "Hash") as string,
    ParentHash: getField(raw, "ParentHash") as string,
    Number: getNumber(raw, "Number"),
    Round: getNumber(raw, "Round"),
    EncodedRLP: getField(raw, "EncodedRLP") as string,
    Error: getField(raw, "Error") as string,
  };
};

export const formatCommittedBlockInfo = (raw: unknown): CommittedBlockInfo => {
  if (!isObject(raw)) return raw as CommittedBlockInfo;
  return {
    Hash: getField(raw, "Hash") as string,
    Number: getNumber(raw, "Number"),
    Round: getNumber(raw, "Round"),
  };
};

export const formatNetworkInformation = (raw: unknown): NetworkInformation => {
  if (!isObject(raw)) return raw as NetworkInformation;
  return {
    Denom: getField(raw, "Denom") as string,
    NetworkId: getNumber(raw, "NetworkId"),
    NetworkName: getField(raw, "NetworkName") as string,
  };
};

// web3-core types Method.outputFormatter as `() => void`, but web3 calls it with the RPC result.
export const web3Formatter = (format: (raw: unknown) => unknown) =>
  format as unknown as () => void;
