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
    it("decodes Packet events addressed to the parent chain and appends tx hash and block number", async () => {
      const service = new ZeroService(createLogger(), "normal");
      const clients = withClients(service, [
        packetLog(1, PARENT_CHAIN, "0xaa", BigInt(100)),
        packetLog(1, 999, "0xbb", BigInt(101)), // another destination chain
        packetLog(2, PARENT_CHAIN, "0xcc", BigInt(102)),
      ]);
      const payloads = await service.getPayloads();
      expect(payloads).toEqual([
        [BigInt(1), BigInt(SUBNET_CHAIN), SUA, BigInt(PARENT_CHAIN), RUA, "0xdeadbeef", "0xaa", BigInt(100)],
        [BigInt(2), BigInt(SUBNET_CHAIN), SUA, BigInt(PARENT_CHAIN), RUA, "0xdeadbeef", "0xcc", BigInt(102)],
      ]);
      expect(clients.childnetViemClient.getContractEvents).toHaveBeenCalledWith(
        expect.objectContaining({ address: mockConfig.xdcZero.subnetZeroContractAddress, eventName: "Packet", fromBlock: BigInt(0) })
      );
    });

    it("returns nothing when there are no logs", async () => {
      const service = new ZeroService(createLogger(), "normal");
      withClients(service, []);
      await expect(service.getPayloads()).resolves.toEqual([]);
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
