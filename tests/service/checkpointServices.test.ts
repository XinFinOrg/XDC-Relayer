import abiCoder from "web3-eth-abi";
import { AbiItem } from "web3-utils";
import { SubnetService } from "../../src/service/subnet";
import { MainnetService } from "../../src/service/mainnet";
import SubnetFullABI from "../../src/service/subnet/ABI/FullABI.json";
import MainnetFullABI from "../../src/service/mainnet/ABI/FullABI.json";
import { contractCallHandler } from "../helpers/contract";
import { RpcError } from "../helpers/fakeProvider";
import { gethV2Block, hash, nethermindV2Block, v2Block } from "../helpers/fixtures";
import { createLogger } from "../helpers/logger";
import {
  ACCOUNT, attachProvider, CSC_ADDRESS, routeAxiosBatches, sentTransactions, serviceConfig, transactionHandlers,
} from "../helpers/services";
import * as utils from "../../src/utils";

jest.mock("../../src/utils", () => ({
  ...jest.requireActual("../../src/utils"),
  sleep: jest.fn().mockResolvedValue(undefined),
}));

afterEach(() => jest.restoreAllMocks());

// SubnetService and MainnetService expose the same full-CSC API against opposite chains; the
// returned block info only differs in its key prefix.
describe.each([
  {
    name: "SubnetService",
    create: () => new SubnetService(serviceConfig, createLogger()),
    abi: SubnetFullABI as AbiItem[],
    prefix: "subnet",
    blocksPerTx: [20, 10, 5, 1],
  },
  {
    name: "MainnetService",
    create: () => new MainnetService(serviceConfig, createLogger()),
    abi: MainnetFullABI as AbiItem[],
    prefix: "mainnet",
    blocksPerTx: [30, 15, 5, 1],
  },
])("$name", ({ create, abi, prefix, blocksPerTx }) => {
  const info = (block: ReturnType<typeof v2Block>) => ({
    [`${prefix}BlockHash`]: block.Hash,
    [`${prefix}BlockNumber`]: block.Number,
    [`${prefix}BlockRound`]: block.Round,
    encodedRLP: block.EncodedRLP,
    parentHash: block.ParentHash,
  });

  describe("block info lookups", () => {
    it("getLastCommittedBlockInfo asks for the committed block and maps it", async () => {
      const service = create();
      const provider = attachProvider(service, { XDPoS_getV2BlockByNumber: () => v2Block(100) });
      await expect(service.getLastCommittedBlockInfo()).resolves.toEqual(info(v2Block(100)));
      expect(provider.calls("XDPoS_getV2BlockByNumber")).toEqual([["committed"]]);
    });

    it("getCommittedBlockInfoByNum requests the hex block number", async () => {
      const service = create();
      const provider = attachProvider(service, { XDPoS_getV2BlockByNumber: () => v2Block(255) });
      await expect(service.getCommittedBlockInfoByNum(255)).resolves.toEqual(info(v2Block(255)));
      expect(provider.calls("XDPoS_getV2BlockByNumber")).toEqual([["0xff"]]);
    });

    it("maps a real XDPoSChain response and the same block from Nethermind identically", async () => {
      const service = create();
      attachProvider(service, { XDPoS_getV2BlockByNumber: () => gethV2Block });
      const fromGeth = await service.getCommittedBlockInfoByNum(gethV2Block.Number);
      attachProvider(service, { XDPoS_getV2BlockByNumber: () => nethermindV2Block });
      const fromNethermind = await service.getCommittedBlockInfoByNum(gethV2Block.Number);
      expect(fromNethermind).toEqual(fromGeth);
      expect((fromGeth as unknown as Record<string, unknown>)[`${prefix}BlockNumber`]).toBe(1957888);
    });

    it("throws when the node returns an XDPoSChain error result instead of a block", async () => {
      const service = create();
      attachProvider(service, {
        XDPoS_getV2BlockByNumber: () => ({ Number: 99999999, Error: "can not find block from this number" }),
      });
      await expect(service.getCommittedBlockInfoByNum(99999999)).rejects.toThrow(/Unable to get committed block information/);
    });

    it("throws when the node rejects the request (Nethermind before committed-tag support)", async () => {
      const service = create();
      attachProvider(service, {
        XDPoS_getV2BlockByNumber: () => {
          throw new RpcError(-32602, "Invalid params");
        },
      });
      await expect(service.getLastCommittedBlockInfo()).rejects.toThrow("Invalid params");
    });
  });

  describe("getCommittedBlockInfoBatch / bulkGetRlpHeaders", () => {
    const blocksByNumber = (params: unknown[]) => v2Block(parseInt(params[0] as string, 16));

    it("fetches consecutive blocks in one JSON-RPC batch", async () => {
      const service = create();
      const provider = attachProvider(service, { XDPoS_getV2BlockByNumber: blocksByNumber });
      const post = routeAxiosBatches(provider);
      await expect(service.getCommittedBlockInfoBatch(9, 3)).resolves.toEqual([9, 10, 11].map((n) => info(v2Block(n))));
      expect(post).toHaveBeenCalledTimes(1);
      const [url, body] = post.mock.calls[0];
      expect(url).toBe(serviceConfig.url);
      expect((body as { method: string; params: string[] }[]).map((r) => [r.method, r.params[0]])).toEqual([
        ["XDPoS_getV2BlockByNumber", "0x9"],
        ["XDPoS_getV2BlockByNumber", "0xa"],
        ["XDPoS_getV2BlockByNumber", "0xb"],
      ]);
    });

    it("accepts Nethermind-shaped batch results", async () => {
      const service = create();
      const provider = attachProvider(service, { XDPoS_getV2BlockByNumber: () => nethermindV2Block });
      routeAxiosBatches(provider);
      const [block] = await service.getCommittedBlockInfoBatch(gethV2Block.Number, 1);
      expect(block[`${prefix}BlockNumber` as keyof typeof block]).toBe(1957888);
      expect(block.encodedRLP).toBe(gethV2Block.EncodedRLP);
    });

    it("rejects the whole batch when one block is missing", async () => {
      const service = create();
      const provider = attachProvider(service, {
        XDPoS_getV2BlockByNumber: (params) => {
          if (params[0] === "0xb") throw new RpcError(-32000, "Unknown block");
          return blocksByNumber(params);
        },
      });
      routeAxiosBatches(provider);
      await expect(service.getCommittedBlockInfoBatch(9, 3)).rejects.toThrow();
    });

    it("bulkGetRlpHeaders returns each block's RLP with its number", async () => {
      const service = create();
      const provider = attachProvider(service, { XDPoS_getV2BlockByNumber: blocksByNumber });
      routeAxiosBatches(provider);
      await expect(service.bulkGetRlpHeaders(5, 2)).resolves.toEqual([
        { encodedRLP: v2Block(5).EncodedRLP, blockNum: 5 },
        { encodedRLP: v2Block(6).EncodedRLP, blockNum: 6 },
      ]);
    });

    // BUG: every batch entry uses `"id": 1`, and responses are matched to requests by array position.
    // JSON-RPC 2.0 lets a server answer a batch in any order, so a reordered response would submit
    // headers in the wrong order with no way to detect it.
    it.failing("keeps blocks in request order when the node reorders batch responses", async () => {
      const service = create();
      const provider = attachProvider(service, { XDPoS_getV2BlockByNumber: blocksByNumber });
      routeAxiosBatches(provider, (responses) => [...responses].reverse());
      const blocks = await service.getCommittedBlockInfoBatch(9, 3);
      expect(blocks.map((b) => b[`${prefix}BlockNumber` as keyof typeof b])).toEqual([9, 10, 11]);
    });
  });

  describe("checkpoint contract reads", () => {
    it("getLastAuditedBlock parses the latest and committed blocks", async () => {
      const service = create();
      const provider = attachProvider(service, {
        eth_call: contractCallHandler(abi, { getLatestBlocks: () => [[hash(120), 120], [hash(117), 117]] }),
      });
      await expect(service.getLastAuditedBlock()).resolves.toEqual({
        smartContractHash: hash(120),
        smartContractHeight: 120,
        smartContractCommittedHash: hash(117),
        smartContractCommittedHeight: 117,
      });
      expect((provider.calls("eth_call")[0][0] as { to: string }).to.toLowerCase()).toBe(CSC_ADDRESS);
    });

    it("getLastAuditedBlock rethrows contract call failures", async () => {
      const service = create();
      attachProvider(service, { eth_call: () => { throw new RpcError(-32000, "execution reverted"); } });
      await expect(service.getLastAuditedBlock()).rejects.toThrow("execution reverted");
    });

    it("getBlockHashByNumber returns the stored hash for a height", async () => {
      const service = create();
      const requested: unknown[] = [];
      attachProvider(service, {
        eth_call: contractCallHandler(abi, {
          getHeaderByNumber: (n) => {
            requested.push(n);
            return [hash(42), 42];
          },
        }),
      });
      await expect(service.getBlockHashByNumber(42)).resolves.toBe(hash(42));
      expect(requested).toEqual(["42"]);
    });

    it("Mode returns the contract's MODE()", async () => {
      const service = create();
      attachProvider(service, { eth_call: contractCallHandler(abi, { MODE: () => "full" }) });
      await expect(service.Mode()).resolves.toBe("full");
    });

    it("getNetworkInformation normalises both client shapes", async () => {
      const service = create();
      attachProvider(service, { XDPoS_networkInformation: () => ({ networkId: "0x71ee" }) });
      await expect(service.getNetworkInformation()).resolves.toMatchObject({ NetworkId: 29166 });
    });
  });

  describe("submitTxs", () => {
    const headers = [
      { encodedRLP: Buffer.from("header-a").toString("base64"), blockNum: 1 },
      { encodedRLP: Buffer.from("header-b").toString("base64"), blockNum: 2 },
    ];

    it("signs and sends receiveHeader(headers) to the checkpoint contract at the node's gas price", async () => {
      const service = create();
      const provider = attachProvider(service, transactionHandlers("0x9184e72a00")); // 625 gwei
      await service.submitTxs(headers);

      const [tx] = sentTransactions(provider);
      expect(tx.to).toBe(CSC_ADDRESS);
      expect(tx.from.toLowerCase()).toBe(ACCOUNT.toLowerCase());
      expect(tx.gasPrice).toBe(BigInt("625000000000"));
      expect(tx.gasLimit).toBe(BigInt(0x30d40));
      const receiveHeader = abi.find((item) => item.name === "receiveHeader");
      expect(tx.data).toBe(
        abiCoder.encodeFunctionCall(receiveHeader, [[
          "0x" + Buffer.from("header-a").toString("hex"),
          "0x" + Buffer.from("header-b").toString("hex"),
        ]] as unknown as string[])
      );
    });

    it("never pays less than the 12.5 gwei floor", async () => {
      const service = create();
      const provider = attachProvider(service, transactionHandlers("0x3b9aca00")); // 1 gwei
      await service.submitTxs(headers);
      expect(sentTransactions(provider)[0].gasPrice).toBe(BigInt("12500000000"));
    });

    it("waits submitTransactionWaitingTime after sending", async () => {
      const service = create();
      attachProvider(service, transactionHandlers());
      await service.submitTxs(headers);
      expect(utils.sleep).toHaveBeenCalledWith(serviceConfig.submitTransactionWaitingTime);
    });

    it("rethrows when the node rejects the transaction", async () => {
      const service = create();
      attachProvider(service, {
        ...transactionHandlers(),
        eth_sendRawTransaction: () => { throw new RpcError(-32000, "under min gas price"); },
      });
      await expect(service.submitTxs(headers)).rejects.toThrow("under min gas price");
    });

    it("does nothing for an empty batch", async () => {
      const service = create();
      const provider = attachProvider(service, transactionHandlers());
      await service.submitTxs([]);
      expect(provider.requests).toEqual([]);
    });
  });

  describe("submitTxsDynamic", () => {
    const blocks = (count: number, from = 1) =>
      Array.from({ length: count }, (_, i) => ({ encodedRLP: "AA==", blockNum: from + i }));
    const firstBlocks = (submit: jest.SpyInstance) =>
      submit.mock.calls.map(([batch]) => [batch[0].blockNum, batch.length]);
    const [maxSize, midSize] = blocksPerTx;

    beforeEach(() => (utils.sleep as jest.Mock).mockClear());

    it("submits a small batch in one transaction", async () => {
      const service = create();
      const submit = jest.spyOn(service, "submitTxs").mockResolvedValue();
      await service.submitTxsDynamic(blocks(maxSize - 3));
      expect(firstBlocks(submit)).toEqual([[1, maxSize - 3]]);
    });

    it(`splits large batches into transactions of ${maxSize}`, async () => {
      const service = create();
      const submit = jest.spyOn(service, "submitTxs").mockResolvedValue();
      await service.submitTxsDynamic(blocks(maxSize * 2 + 5));
      expect(firstBlocks(submit)).toEqual([[1, maxSize], [maxSize + 1, maxSize], [maxSize * 2 + 1, 5]]);
    });

    it("retries a failed transaction with fewer blocks and then grows again", async () => {
      const service = create();
      const submit = jest.spyOn(service, "submitTxs")
        .mockRejectedValueOnce(new Error("gas limit")) // maxSize from block 1
        .mockResolvedValue();
      await service.submitTxsDynamic(blocks(maxSize * 2));
      expect(firstBlocks(submit)).toEqual([
        [1, maxSize],
        [1, midSize],
        [midSize + 1, maxSize],
        [maxSize + midSize + 1, midSize],
      ]);
    });

    it("falls back to splitting when a small batch fails as a whole", async () => {
      const service = create();
      const submit = jest.spyOn(service, "submitTxs")
        .mockRejectedValueOnce(new Error("too big"))
        .mockResolvedValue();
      await service.submitTxsDynamic(blocks(7));
      expect(firstBlocks(submit)).toEqual([[1, 7], [1, 5], [6, 1], [7, 1]]);
    });

    it("gives up after more than 10 failed attempts", async () => {
      const service = create();
      jest.spyOn(service, "submitTxs").mockRejectedValue(new Error("under min gas price"));
      await expect(service.submitTxsDynamic(blocks(maxSize))).rejects.toThrow("submitDynamic failed 10X times");
    });

    // BUG (performance): the size loop sleeps 3s after every size it skips, even when no transaction
    // was attempted, so a 7-block remainder waits 6s before its first attempt.
    it.failing("does not sleep for batch sizes it skips without trying", async () => {
      const service = create();
      jest.spyOn(service, "submitTxs")
        .mockRejectedValueOnce(new Error("too big"))
        .mockResolvedValue();
      await service.submitTxsDynamic(blocks(7));
      expect(utils.sleep).not.toHaveBeenCalledWith(3000);
    });
  });
});

describe("SubnetService.getComittedBlockInfoByHash", () => {
  it("looks the block up by hash", async () => {
    const service = new SubnetService(serviceConfig, createLogger());
    const provider = attachProvider(service, { XDPoS_getV2BlockByHash: () => v2Block(7) });
    await expect(service.getComittedBlockInfoByHash(hash(7))).resolves.toMatchObject({
      subnetBlockHash: hash(7),
      subnetBlockNumber: 7,
    });
    expect(provider.calls("XDPoS_getV2BlockByHash")).toEqual([[hash(7)]]);
  });
});
