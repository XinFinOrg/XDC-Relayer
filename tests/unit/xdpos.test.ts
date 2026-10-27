import { formatCommittedBlockInfo, formatNetworkInformation, formatV2BlockInfo } from "../../src/service/xdpos";
import { gethV2Block, nethermindV2Block } from "../helpers/fixtures";

describe("formatV2BlockInfo", () => {
  const expected = {
    Committed: true,
    Hash: "0x68f0b0c34531c6ffb26e72704a4f95bcd4e4209618179ae09482da3341d80ea5",
    ParentHash: "0x90d0e03717ea6956bae3417a12c8ad01369180aad685ce4dddf3176460a52b0e",
    Number: 1,
    Round: 1,
    EncodedRLP: "+QJkoJDQ4Dc=",
    Error: undefined as string,
  };

  it("reads XDPoSChain PascalCase responses with numeric fields", () => {
    expect(formatV2BlockInfo({
      Hash: expected.Hash, Round: 1, Number: 1, ParentHash: expected.ParentHash,
      Committed: true, Miner: "0x00", Timestamp: 1, EncodedRLP: expected.EncodedRLP, Error: "",
    })).toEqual({ ...expected, Error: "" });
  });

  it("reads Nethermind camelCase responses with hex fields", () => {
    expect(formatV2BlockInfo({
      hash: expected.Hash, round: "0x1", number: "0x1", parentHash: expected.ParentHash,
      committed: true, miner: "0x00", timestamp: "0x6acbe501", encodedRLP: expected.EncodedRLP,
    })).toEqual(expected);
  });

  it("matches keys regardless of case", () => {
    expect(formatV2BlockInfo({ ENCODEDRLP: "abc", committed: false }))
      .toMatchObject({ EncodedRLP: "abc", Committed: false });
  });

  it("leaves missing fields undefined so presence checks still fail", () => {
    const { Hash, Number, EncodedRLP } = formatV2BlockInfo({});
    expect([Hash, Number, EncodedRLP]).toEqual([undefined, undefined, undefined]);
  });

  it("passes null results through unchanged", () => {
    expect(formatV2BlockInfo(null)).toBeNull();
  });
});

describe("formatCommittedBlockInfo", () => {
  it("normalizes camelCase hex responses", () => {
    expect(formatCommittedBlockInfo({ hash: "0xab", number: "0x47", round: "0x48" }))
      .toEqual({ Hash: "0xab", Number: 71, Round: 72 });
  });
});

describe("formatNetworkInformation", () => {
  it("normalizes both client shapes", () => {
    const expected = { Denom: "XDC", NetworkId: 51, NetworkName: "devnet" };
    expect(formatNetworkInformation({ Denom: "XDC", NetworkId: 51, NetworkName: "devnet" })).toEqual(expected);
    expect(formatNetworkInformation({ denom: "XDC", networkId: "0x33", networkName: "devnet" })).toEqual(expected);
  });
});

describe("formatV2BlockInfo with real client responses", () => {
  it("produces identical output for the XDPoSChain and Nethermind shapes of the same block", () => {
    const fromGeth = formatV2BlockInfo(gethV2Block);
    const fromNethermind = formatV2BlockInfo(nethermindV2Block);
    expect(fromNethermind).toEqual({ ...fromGeth, Error: undefined });
    expect(fromGeth).toMatchObject({
      Hash: gethV2Block.Hash,
      Number: 1957888,
      Round: 1961081,
      Committed: true,
      EncodedRLP: gethV2Block.EncodedRLP,
    });
  });

  it("passes undefined results through (a batch entry that errored)", () => {
    expect(formatV2BlockInfo(undefined)).toBeUndefined();
  });
});
