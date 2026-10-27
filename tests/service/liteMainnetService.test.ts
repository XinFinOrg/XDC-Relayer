import abiCoder from "web3-eth-abi";
import { AbiItem } from "web3-utils";
import { LiteMainnetService } from "../../src/service/mainnet";
import LiteABI from "../../src/service/mainnet/ABI/LiteABI.json";
import { contractCallHandler } from "../helpers/contract";
import { RpcError } from "../helpers/fakeProvider";
import { hash } from "../helpers/fixtures";
import { createLogger } from "../helpers/logger";
import { attachProvider, CSC_ADDRESS, sentTransactions, serviceConfig, transactionHandlers } from "../helpers/services";

jest.mock("../../src/utils", () => ({
  ...jest.requireActual("../../src/utils"),
  sleep: jest.fn().mockResolvedValue(undefined),
}));

const abi = LiteABI as AbiItem[];
const create = () => new LiteMainnetService(serviceConfig, createLogger());
const encodeCall = (name: string, args: unknown[]) =>
  abiCoder.encodeFunctionCall(abi.find((item) => item.name === name), args as string[]);

describe("LiteMainnetService", () => {
  it("getLastAuditedBlock parses the lite contract's latest and committed blocks", async () => {
    const service = create();
    attachProvider(service, {
      eth_call: contractCallHandler(abi, { getLatestBlocks: () => [[hash(1351), 1351], [hash(900), 900]] }),
    });
    await expect(service.getLastAuditedBlock()).resolves.toEqual({
      smartContractHash: hash(1351),
      smartContractHeight: 1351,
      smartContractCommittedHash: hash(900),
      smartContractCommittedHeight: 900,
    });
  });

  it("getGapAndEpoch reads INIT_GAP and INIT_EPOCH", async () => {
    const service = create();
    attachProvider(service, { eth_call: contractCallHandler(abi, { INIT_GAP: () => 450, INIT_EPOCH: () => 900 }) });
    const { gap, epoch } = await service.getGapAndEpoch();
    // web3 returns uint64 values as decimal strings even though the signature says number.
    expect([gap, epoch]).toEqual(["450", "900"]);
  });

  it("getUnCommittedHeader maps the tuple fields", async () => {
    const service = create();
    const requested: unknown[] = [];
    attachProvider(service, {
      eth_call: contractCallHandler(abi, {
        getUnCommittedHeader: (blockHash) => {
          requested.push(blockHash);
          return [2, 1400, 1353];
        },
      }),
    });
    await expect(service.getUnCommittedHeader(hash(1351))).resolves.toEqual({
      sequence: "2",
      lastRoundNum: "1400",
      lastNum: "1353",
    });
    expect(requested).toEqual([hash(1351)]);
  });

  it("Mode returns the contract's MODE()", async () => {
    const service = create();
    attachProvider(service, { eth_call: contractCallHandler(abi, { MODE: () => "lite" }) });
    await expect(service.Mode()).resolves.toBe("lite");
  });

  // BUG: the lite contract's getHeaderByNumber returns (HeaderInfo, bytes32 hash), but this returns
  // result[0], the HeaderInfo tuple, instead of the hash. Nothing calls it yet.
  it.failing("getBlockHashByNumber returns the block hash", async () => {
    const service = create();
    attachProvider(service, {
      eth_call: contractCallHandler(abi, { getHeaderByNumber: () => [[1351, 1400, 1957888], hash(1351)] }),
    });
    await expect(service.getBlockHashByNumber(1351)).resolves.toBe(hash(1351));
  });

  describe("transactions", () => {
    const headers = ["a", "b", "c", "d"].map((h, i) => ({
      encodedRLP: Buffer.from(`header-${h}`).toString("base64"),
      blockNum: 1351 + i,
    }));
    const hexHeaders = headers.map((h) => "0x" + Buffer.from(h.encodedRLP, "base64").toString("hex"));

    it("submitTxs sends receiveHeader(headers) at the node's gas price", async () => {
      const service = create();
      const provider = attachProvider(service, transactionHandlers("0x9184e72a00"));
      await service.submitTxs(headers);
      const [tx] = sentTransactions(provider);
      expect(tx.to).toBe(CSC_ADDRESS);
      expect(tx.gasPrice).toBe(BigInt("625000000000"));
      expect(tx.data).toBe(encodeCall("receiveHeader", [hexHeaders]));
    });

    it("submitTxs does nothing for an empty batch", async () => {
      const service = create();
      const provider = attachProvider(service, transactionHandlers());
      await service.submitTxs([]);
      expect(provider.requests).toEqual([]);
    });

    it("commitHeader sends commitHeader(epochHash, headers)", async () => {
      const service = create();
      const provider = attachProvider(service, transactionHandlers());
      await service.commitHeader(hash(1351), hexHeaders);
      const [tx] = sentTransactions(provider);
      expect(tx.data).toBe(encodeCall("commitHeader", [hash(1351), hexHeaders]));
      expect(tx.gasPrice).toBe(BigInt("12500000000"));
    });

    it("commitHeader rethrows when gas estimation fails (e.g. the contract would revert)", async () => {
      const service = create();
      attachProvider(service, {
        ...transactionHandlers(),
        eth_estimateGas: () => { throw new RpcError(-32000, "execution reverted"); },
      });
      await expect(service.commitHeader(hash(1351), hexHeaders)).rejects.toThrow("execution reverted");
    });
  });
});
