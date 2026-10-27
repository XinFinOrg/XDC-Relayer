import { encodeAbiParameters, getAddress, Hex } from "viem";
import { createLogger } from "../helpers/logger";
import { PK } from "../helpers/services";

const mockConfig = {
  subnet: { url: "http://subnet.invalid", smartContractAddress: "0x00000000000000000000000000000000000000a1", accountPK: PK, fetchWaitingTime: 0, submitTransactionWaitingTime: 0 },
  mainnet: { url: "http://parentnet.invalid", smartContractAddress: "0x00000000000000000000000000000000000000b1", accountPK: PK, fetchWaitingTime: 0, submitTransactionWaitingTime: 0 },
  xdcZero: {
    isEnabled: true,
    isReverseEnabled: true,
    subnetZeroContractAddress: "0x00000000000000000000000000000000000000a2",
    parentChainZeroContractAddress: "0x00000000000000000000000000000000000000b2",
    parentnetWalletPk: PK,
    subnetWalletPk: PK,
  },
};
jest.mock("../../src/config", () => ({ config: mockConfig }));

import { ZeroService } from "../../src/service/zero";

const SUBNET_CHAIN = 29166;
const PARENT_CHAIN = 551;
const SUA = getAddress("0x00000000000000000000000000000000000000Ee");
const RUA = getAddress("0x00000000000000000000000000000000000000Ff");

// A Packet log as the XDC-Zero Endpoint emits it: `emit Packet(abi.encode(index, sid, sua, rid, rua, data))`.
const packetLog = (index: number, rid: number, txHash: string, blockNumber: bigint) => {
  const payload = encodeAbiParameters(
    [{ type: "uint256" }, { type: "uint256" }, { type: "address" }, { type: "uint256" }, { type: "address" }, { type: "bytes" }],
    [BigInt(index), BigInt(SUBNET_CHAIN), SUA, BigInt(rid), RUA, "0xdeadbeef"]
  );
  return { data: encodeAbiParameters([{ type: "bytes" }], [payload]), transactionHash: txHash, blockNumber };
};

type Clients = {
  childnetViemClient: Record<string, jest.Mock>;
  parentnetViemClient: Record<string, jest.Mock>;
  parentnetWalletClient: Record<string, jest.Mock>;
  childnetService: Record<string, jest.Mock>;
};

const withClients = (service: ZeroService, logs: unknown[] = []) => {
  const clients: Clients = {
    childnetViemClient: {
      getContractEvents: jest.fn().mockResolvedValue(logs),
      getChainId: jest.fn().mockResolvedValue(SUBNET_CHAIN),
    },
    parentnetViemClient: {
      getChainId: jest.fn().mockResolvedValue(PARENT_CHAIN),
      readContract: jest.fn(),
      simulateContract: jest.fn().mockResolvedValue({ request: { simulated: true } }),
    },
    parentnetWalletClient: { writeContract: jest.fn().mockResolvedValue("0xtx") },
    childnetService: { getTransactionAndReceiptProof: jest.fn() },
  };
  Object.assign(service, clients);
  return clients;
};

describe("ZeroService", () => {
  describe("getPayloads", () => {
    // Answers the contract reads getPayloads makes: the CSC's committed childnet block, and the reverse CSC's
    // init status and init block.
    const mockReads = (clients: Clients, reads: { cscCommitted: number; initStatus?: number; initBlock?: number | Error }) => {
      clients.parentnetViemClient.readContract.mockImplementation(async ({ functionName }: { functionName: string }) => {
        if (functionName == "getLatestBlocks") {
          return [{ hash: "0x01", number: BigInt(reads.cscCommitted + 3) }, { hash: "0x02", number: BigInt(reads.cscCommitted) }];
        }
        if (functionName == "INIT_STATUS") {
          return BigInt(reads.initStatus ?? 1);
        }
        if (functionName == "INIT_V2ESBN") {
          if (reads.initBlock instanceof Error) throw reads.initBlock;
          return BigInt(reads.initBlock);
        }
        throw new Error(`unexpected read ${functionName}`);
      });
    };
    const scannedRanges = (clients: Clients) =>
      clients.childnetViemClient.getContractEvents.mock.calls.map(([args]) => [Number(args.fromBlock), Number(args.toBlock)]);

    it("decodes Packet events addressed to the parent chain and appends tx hash and block number", async () => {
      const service = new ZeroService(createLogger(), "normal");
      const clients = withClients(service, [
        packetLog(1, PARENT_CHAIN, "0xaa", BigInt(100)),
        packetLog(1, 999, "0xbb", BigInt(101)), // another destination chain
        packetLog(2, PARENT_CHAIN, "0xcc", BigInt(102)),
      ]);
      mockReads(clients, { cscCommitted: 200 });
      const payloads = await service.getPayloads();
      expect(payloads).toEqual([
        [BigInt(1), BigInt(SUBNET_CHAIN), SUA, BigInt(PARENT_CHAIN), RUA, "0xdeadbeef", "0xaa", BigInt(100)],
        [BigInt(2), BigInt(SUBNET_CHAIN), SUA, BigInt(PARENT_CHAIN), RUA, "0xdeadbeef", "0xcc", BigInt(102)],
      ]);
      expect(clients.childnetViemClient.getContractEvents).toHaveBeenCalledWith(
        expect.objectContaining({
          address: mockConfig.xdcZero.subnetZeroContractAddress,
          eventName: "Packet",
          fromBlock: BigInt(0),
          toBlock: BigInt(200),
        })
      );
    });

    it("returns nothing when there are no logs", async () => {
      const service = new ZeroService(createLogger(), "normal");
      const clients = withClients(service, []);
      mockReads(clients, { cscCommitted: 200 });
      await expect(service.getPayloads()).resolves.toEqual([]);
    });

    it.each([
      { cscCommitted: 0, ranges: [[0, 0]] },
      { cscCommitted: 4998, ranges: [[0, 4998]] },
      { cscCommitted: 4999, ranges: [[0, 4999]] },
      { cscCommitted: 5000, ranges: [[0, 4999], [5000, 5000]] },
      { cscCommitted: 12000, ranges: [[0, 4999], [5000, 9999], [10000, 12000]] },
    ])("splits blocks 0..$cscCommitted into requests of at most 5000 blocks", async ({ cscCommitted, ranges }) => {
      const service = new ZeroService(createLogger(), "normal");
      const clients = withClients(service, []);
      mockReads(clients, { cscCommitted });
      await service.getPayloads();
      expect(scannedRanges(clients)).toEqual(ranges);
    });

    it("keeps its cache intact when a caller changes the returned list", async () => {
      const service = new ZeroService(createLogger(), "normal");
      const clients = withClients(service, [packetLog(1, PARENT_CHAIN, "0xaa", BigInt(100))]);
      mockReads(clients, { cscCommitted: 200 });
      (await service.getPayloads()).pop();
      await expect(service.getPayloads()).resolves.toHaveLength(1);
    });

    it("only scans new blocks on later calls and keeps the payloads already found", async () => {
      const service = new ZeroService(createLogger(), "normal");
      const clients = withClients(service);
      clients.childnetViemClient.getContractEvents
        .mockResolvedValueOnce([packetLog(1, PARENT_CHAIN, "0xaa", BigInt(100))])
        .mockResolvedValueOnce([packetLog(2, PARENT_CHAIN, "0xcc", BigInt(205))]);
      mockReads(clients, { cscCommitted: 200 });
      await service.getPayloads();
      mockReads(clients, { cscCommitted: 210 });
      const payloads = await service.getPayloads();
      expect(scannedRanges(clients)).toEqual([[0, 200], [201, 210]]);
      expect(payloads.map((p: unknown[]) => p[6])).toEqual(["0xaa", "0xcc"]);
    });

    it("does not query logs until the CSC commits a new block", async () => {
      const service = new ZeroService(createLogger(), "normal");
      const clients = withClients(service, []);
      mockReads(clients, { cscCommitted: 200 });
      await service.getPayloads();
      await service.getPayloads();
      expect(scannedRanges(clients)).toEqual([[0, 200]]);
    });

    it("resumes from the failed chunk when a request fails, without losing or repeating payloads", async () => {
      const service = new ZeroService(createLogger(), "normal");
      const clients = withClients(service);
      clients.childnetViemClient.getContractEvents
        .mockResolvedValueOnce([packetLog(1, PARENT_CHAIN, "0xaa", BigInt(100))])
        .mockRejectedValueOnce(new Error("timeout"))
        .mockResolvedValueOnce([packetLog(2, PARENT_CHAIN, "0xcc", BigInt(6000))]);
      mockReads(clients, { cscCommitted: 7000 });
      await expect(service.getPayloads()).rejects.toThrow("timeout");
      const payloads = await service.getPayloads();
      expect(scannedRanges(clients)).toEqual([[0, 4999], [5000, 7000], [5000, 7000]]);
      expect(payloads.map((p: unknown[]) => p[6])).toEqual(["0xaa", "0xcc"]);
    });

    it.each([
      { initBlock: 84607100, cscCommitted: 84608147, ranges: [[84607100, 84608147]] },
      { initBlock: 84607100, cscCommitted: 84607100, ranges: [[84607100, 84607100]] },
      { initBlock: 84600000, cscCommitted: 84612000, ranges: [[84600000, 84604999], [84605000, 84609999], [84610000, 84612000]] },
      { initBlock: 0, cscCommitted: 30, ranges: [[0, 30]] }, // a parentnet running XDPoS v2 from genesis
    ])("reverse mode scans $initBlock..$cscCommitted, from the block the reverse CSC was initialised from", async ({ initBlock, cscCommitted, ranges }) => {
      const service = new ZeroService(createLogger(), "reverse");
      const clients = withClients(service, []);
      mockReads(clients, { cscCommitted, initBlock });
      await service.getPayloads();
      expect(scannedRanges(clients)).toEqual(ranges);
      expect(clients.parentnetViemClient.readContract).toHaveBeenCalledWith(
        expect.objectContaining({ address: mockConfig.subnet.smartContractAddress, functionName: "INIT_V2ESBN" })
      );
    });

    it("reverse mode reads the init block only once", async () => {
      const service = new ZeroService(createLogger(), "reverse");
      const clients = withClients(service, []);
      mockReads(clients, { cscCommitted: 84608147, initBlock: 84607100 });
      await service.getPayloads();
      await service.getPayloads();
      const initReads = clients.parentnetViemClient.readContract.mock.calls.filter(([args]) => args.functionName == "INIT_V2ESBN");
      expect(initReads).toHaveLength(1);
    });

    it("reverse mode waits for the reverse CSC to be initialised instead of scanning from block 0", async () => {
      const service = new ZeroService(createLogger(), "reverse");
      const clients = withClients(service, []);
      mockReads(clients, { cscCommitted: 0, initStatus: 0, initBlock: 0 });
      await expect(service.getPayloads()).rejects.toThrow("Reverse CSC is not initialised yet");
      expect(clients.childnetViemClient.getContractEvents).not.toHaveBeenCalled();
      mockReads(clients, { cscCommitted: 84608147, initBlock: 84607100 });
      await service.getPayloads();
      expect(scannedRanges(clients)).toEqual([[84607100, 84608147]]);
    });

    it("reverse mode fails the cycle rather than scanning from block 0 when the init block cannot be read", async () => {
      const service = new ZeroService(createLogger(), "reverse");
      const clients = withClients(service, []);
      mockReads(clients, { cscCommitted: 84608147, initBlock: new Error("execution reverted") });
      await expect(service.getPayloads()).rejects.toThrow("execution reverted");
      expect(clients.childnetViemClient.getContractEvents).not.toHaveBeenCalled();
      mockReads(clients, { cscCommitted: 84608147, initBlock: 84607100 });
      await service.getPayloads();
      expect(scannedRanges(clients)).toEqual([[84607100, 84608147]]);
    });
  });

  it("getLastIndexFromParentnet reads getSendChainLastIndex(subnetChainId) on the parent endpoint", async () => {
    const service = new ZeroService(createLogger(), "normal");
    const clients = withClients(service);
    clients.parentnetViemClient.readContract.mockResolvedValue(BigInt(5));
    await expect(service.getLastIndexFromParentnet()).resolves.toBe(BigInt(5));
    expect(clients.parentnetViemClient.readContract).toHaveBeenCalledWith(
      expect.objectContaining({
        address: mockConfig.xdcZero.parentChainZeroContractAddress,
        functionName: "getSendChainLastIndex",
        args: [SUBNET_CHAIN],
      })
    );
  });

  it("getLatestBlockNumberFromCsc returns the CSC's committed block number", async () => {
    const service = new ZeroService(createLogger(), "normal");
    const clients = withClients(service);
    clients.parentnetViemClient.readContract.mockResolvedValue([
      { hash: "0x01", number: BigInt(120) },
      { hash: "0x02", number: BigInt(117) },
    ]);
    await expect(service.getLatestBlockNumberFromCsc()).resolves.toBe(BigInt(117));
    expect(clients.parentnetViemClient.readContract).toHaveBeenCalledWith(
      expect.objectContaining({ address: mockConfig.mainnet.smartContractAddress, functionName: "getLatestBlocks" })
    );
  });

  it("validateTransactionProof simulates then sends validateTransactionProof", async () => {
    const service = new ZeroService(createLogger(), "normal");
    const clients = withClients(service);
    await service.validateTransactionProof("0xkey", ["0xr"], ["0xt"], "0xblock");
    expect(clients.parentnetViemClient.simulateContract).toHaveBeenCalledWith(
      expect.objectContaining({
        address: mockConfig.xdcZero.parentChainZeroContractAddress,
        functionName: "validateTransactionProof",
        args: [SUBNET_CHAIN, "0xkey", ["0xr"], ["0xt"], "0xblock"],
      })
    );
    expect(clients.parentnetWalletClient.writeContract).toHaveBeenCalledWith({ simulated: true });
  });

  it("getProof fetches the transaction and receipt proof from the child chain", async () => {
    const service = new ZeroService(createLogger(), "normal");
    const clients = withClients(service);
    clients.childnetService.getTransactionAndReceiptProof.mockResolvedValue({ key: "0xk" });
    await expect(service.getProof("0xaa")).resolves.toEqual({ key: "0xk" });
    expect(clients.childnetService.getTransactionAndReceiptProof).toHaveBeenCalledWith("0xaa");
  });

  it("init builds viem clients from both chains' network information", async () => {
    const service = new ZeroService(createLogger(), "normal");
    const internals = service as unknown as Record<string, { getNetworkInformation?: jest.Mock; chain?: { id: number; rpcUrls: unknown } }>;
    internals.childnetService.getNetworkInformation = jest.fn().mockResolvedValue({ NetworkId: SUBNET_CHAIN, NetworkName: "subnet", Denom: "SUB" });
    internals.parentnetService.getNetworkInformation = jest.fn().mockResolvedValue({ NetworkId: PARENT_CHAIN, NetworkName: "devnet", Denom: "XDC" });
    await service.init();
    expect(internals.childnetViemClient.chain).toMatchObject({ id: SUBNET_CHAIN, rpcUrls: { default: { http: [mockConfig.subnet.url] } } });
    expect(internals.parentnetViemClient.chain).toMatchObject({ id: PARENT_CHAIN, rpcUrls: { default: { http: [mockConfig.mainnet.url] } } });
    expect(internals.parentnetWalletClient.chain).toMatchObject({ id: PARENT_CHAIN });
  });

  it("reverse mode swaps the chains: subnet is the parent, parentnet is the child", () => {
    const service = new ZeroService(createLogger(), "reverse") as unknown as Record<string, string>;
    expect(service.childnetUrl).toBe(mockConfig.mainnet.url);
    expect(service.parentnetUrl).toBe(mockConfig.subnet.url);
    expect(service.parentnetCSCAddress).toBe(mockConfig.subnet.smartContractAddress);
    expect(service.subnetZeroAddress).toBe(mockConfig.xdcZero.parentChainZeroContractAddress);
    expect(service.parentnetZeroAddress).toBe(mockConfig.xdcZero.subnetZeroContractAddress);
  });

  // Consequence of the config bug: an empty *_ZERO_WALLET_PK still enables XDC-Zero with key "0x",
  // and the constructor throws. Processors build ZeroService at startup, so the relayer crashes.
  it("throws in the constructor when XDC-Zero is enabled with an empty wallet key", () => {
    const saved = mockConfig.xdcZero.parentnetWalletPk;
    mockConfig.xdcZero.parentnetWalletPk = "0x" as Hex;
    expect(() => new ZeroService(createLogger(), "normal")).toThrow();
    mockConfig.xdcZero.parentnetWalletPk = saved;
  });
});
