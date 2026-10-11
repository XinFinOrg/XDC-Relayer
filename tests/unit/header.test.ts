import { RLP } from "@ethereumjs/rlp";
import { headerToInputs, RawXdcSubnetHeader, toXdcHeader, valuesArrayToHeaderData } from "../../src/utils/header";
import { gethV2Block } from "../helpers/fixtures";

const field = (byte: number, length = 32) => Buffer.alloc(length, byte);

// An 18-field XDC subnet header in RLP field order.
const subnetHeaderValues = (): Buffer[] => [
  field(0x01), // parentHash
  field(0x02), // sha3Uncles
  field(0x03, 20), // miner
  field(0x04), // stateRoot
  field(0x05), // transactionsRoot
  field(0x06), // receiptsRoot
  field(0x00, 256), // logsBloom
  Buffer.from([0x01]), // difficulty
  Buffer.from([0x01, 0x00]), // number = 256
  Buffer.from([0x01, 0xc9, 0xc3, 0x80]), // gasLimit = 30000000
  Buffer.from([0x52, 0x08]), // gasUsed = 21000
  Buffer.from([0x65, 0x00, 0x00, 0x00]), // timestamp
  Buffer.from("extra"), // extraData
  field(0x07), // mixHash
  field(0x00, 8), // nonce
  Buffer.from("validators"),
  Buffer.from("validator"),
  Buffer.from("penalties"),
];

describe("valuesArrayToHeaderData", () => {
  it("maps the 18 RLP fields of a subnet header to typed values", () => {
    const header = valuesArrayToHeaderData(subnetHeaderValues());
    expect(header).toMatchObject({
      parentHash: "0x" + "01".repeat(32),
      miner: "0x" + "03".repeat(20),
      difficulty: BigInt(1),
      number: BigInt(256),
      gasLimit: 30000000,
      gasUsed: 21000,
      timestamp: BigInt(0x65000000),
      extraData: "0x" + Buffer.from("extra").toString("hex"),
      penalties: "0x" + Buffer.from("penalties").toString("hex"),
    });
  });

  it("rejects headers with too few fields", () => {
    expect(() => valuesArrayToHeaderData(subnetHeaderValues().slice(0, 17))).toThrow(
      "Less values than expected"
    );
  });

  it("rejects headers with too many fields", () => {
    expect(() => valuesArrayToHeaderData([...subnetHeaderValues(), field(0x09)])).toThrow(
      "More values than expected"
    );
  });

  it("survives an RLP round trip through headerToInputs", () => {
    const header = valuesArrayToHeaderData(subnetHeaderValues());
    const reencoded = RLP.decode(RLP.encode(headerToInputs(header))) as Uint8Array[];
    expect(valuesArrayToHeaderData(reencoded.map((v) => Buffer.from(v)))).toEqual(header);
  });

  // Not called anywhere in src today; documents that current XDPoSChain headers (19 fields, with
  // the base fee) are outside what this parser accepts.
  it("rejects a current 19-field XDPoSChain header", () => {
    const values = RLP.decode(Buffer.from(gethV2Block.EncodedRLP, "base64")) as Uint8Array[];
    expect(values).toHaveLength(19);
    expect(() => valuesArrayToHeaderData(values.map((v) => Buffer.from(v)))).toThrow(
      "More values than expected"
    );
  });
});

describe("toXdcHeader", () => {
  it("converts numeric strings to bigint and keeps the other fields", () => {
    const raw = {
      parentHash: "0xp",
      sha3Uncles: "0xs",
      miner: "0xm",
      stateRoot: "0xsr",
      transactionsRoot: "0xtr",
      receiptsRoot: "0xrr",
      logsBloom: "0xlb",
      difficulty: "1",
      number: 256,
      gasLimit: 30000000,
      gasUsed: 21000,
      timestamp: "1700000000",
      extraData: "0xe",
      mixHash: "0xmh",
      nonce: "0xn",
      validators: "0xvs",
      validator: "0xv",
      penalties: "0xp2",
    } as unknown as RawXdcSubnetHeader;
    const header = toXdcHeader(raw);
    expect(header.difficulty).toBe(BigInt(1));
    expect(header.number).toBe(BigInt(256));
    expect(header.timestamp).toBe(BigInt(1700000000));
    expect(headerToInputs(header)).toHaveLength(18);
    expect(headerToInputs(header)[0]).toBe("0xp");
    expect(headerToInputs(header)[17]).toBe("0xp2");
  });
});
