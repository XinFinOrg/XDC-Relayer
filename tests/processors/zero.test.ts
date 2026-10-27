import { createLogger } from "../helpers/logger";
import { queueOf } from "../helpers/queue";
import { testConfig } from "../helpers/testConfig";

jest.mock("bull");
// eslint-disable-next-line @typescript-eslint/no-var-requires -- jest.mock factories are hoisted, so they cannot use imports
jest.mock("../../src/config", () => ({ config: require("../helpers/testConfig").testConfig }));
jest.mock("../../src/service/zero/index");

import { Zero } from "../../src/processors/zero";
import { ReverseZero } from "../../src/processors/reverseZero";

const flushPromises = () => new Promise((resolve) => setImmediate(resolve));

// A decoded Packet payload as ZeroService.getPayloads returns it (viem decodes uints as bigint):
// [index, sid, sua, rid, rua, data, txHash, blockNumber].
const payload = (index: number, blockNumber: number, txHash: string | null = `0xtx${index}`) => [
  BigInt(index), BigInt(29166), "0xsua", BigInt(551), "0xrua", "0xdata", txHash, BigInt(blockNumber),
];

describe.each([
  { name: "Zero", Processor: Zero, flag: "isEnabled", jobId: "ZERO" },
  { name: "ReverseZero", Processor: ReverseZero, flag: "isReverseEnabled", jobId: "REVERSE_ZERO" },
] as const)("$name processor", ({ Processor, flag, jobId }) => {
  beforeEach(() => {
    testConfig.xdcZero[flag] = true;
  });
  afterEach(() => {
    testConfig.xdcZero[flag] = false;
  });

  const setup = async (opts: { payloads?: unknown[][]; cscBlock?: number; parentIndex?: number; initFails?: boolean } = {}) => {
    const processor = new Processor(createLogger());
    const zero = (processor as unknown as { zeroService: Record<string, jest.Mock> }).zeroService;
    zero.init.mockImplementation(async () => {
      if (opts.initFails) throw new Error("network information unavailable");
    });
    zero.getPayloads.mockResolvedValue(opts.payloads ?? []);
    zero.getLatestBlockNumberFromCsc.mockResolvedValue(BigInt(opts.cscBlock ?? 1000));
    zero.getLastIndexFromParentnet.mockResolvedValue(BigInt(opts.parentIndex ?? 0));
    zero.getProof.mockImplementation(async (txHash: string) => ({
      key: `key-${txHash}`, receiptProofValues: [`r-${txHash}`], txProofValues: [`t-${txHash}`], blockHash: `b-${txHash}`,
    }));
    zero.validateTransactionProof.mockResolvedValue(undefined);
    processor.init();
    await flushPromises();
    return { processor, zero };
  };

  it("skips cycles until its service has initialised", async () => {
    const { processor, zero } = await setup({ initFails: true });
    await expect(processor.processEvent()).resolves.toMatch(/not ready, skipping cycle/);
    expect(zero.getPayloads).not.toHaveBeenCalled();
  });

  it("does not initialise its service when the feature is disabled", async () => {
    testConfig.xdcZero[flag] = false;
    const { processor, zero } = await setup();
    expect(zero.init).not.toHaveBeenCalled();
    await expect(processor.processEvent()).resolves.toMatch(/not ready/);
  });

  it("waits when there are no packets", async () => {
    const { processor, zero } = await setup({ payloads: [] });
    await expect(processor.processEvent()).resolves.toMatch(/Nothing to process/);
    expect(zero.validateTransactionProof).not.toHaveBeenCalled();
  });

  it("waits until the checkpoint contract has the block of the last packet", async () => {
    const { processor, zero } = await setup({ payloads: [payload(1, 100), payload(2, 250)], cscBlock: 200 });
    await expect(processor.processEvent()).resolves.toBe("Wait for csc block lastBlockNumber: 250, cscBlockNumber: 200");
    expect(zero.validateTransactionProof).not.toHaveBeenCalled();
  });

  it("proves only the packets after the destination's last received index, in order", async () => {
    const payloads = [payload(1, 100), payload(2, 110), payload(3, 120), payload(4, 130)];
    const { processor, zero } = await setup({ payloads, cscBlock: 130, parentIndex: 2 });
    await expect(processor.processEvent()).resolves.toMatch(/sync up till 4/);
    expect(zero.getProof.mock.calls).toEqual([["0xtx3"], ["0xtx4"]]);
    expect(zero.validateTransactionProof.mock.calls).toEqual([
      ["key-0xtx3", ["r-0xtx3"], ["t-0xtx3"], "b-0xtx3"],
      ["key-0xtx4", ["r-0xtx4"], ["t-0xtx4"], "b-0xtx4"],
    ]);
  });

  it("finds packets by their index when the scan did not start at the first packet", async () => {
    const { processor, zero } = await setup({ payloads: [payload(5, 100), payload(6, 110), payload(7, 120)], cscBlock: 120, parentIndex: 5 });
    await expect(processor.processEvent()).resolves.toMatch(/sync up till 7/);
    expect(zero.getProof.mock.calls).toEqual([["0xtx6"], ["0xtx7"]]);
  });

  it("does nothing when the destination already received every packet", async () => {
    const { processor, zero } = await setup({ payloads: [payload(1, 100), payload(2, 110)], parentIndex: 2 });
    await processor.processEvent();
    expect(zero.validateTransactionProof).not.toHaveBeenCalled();
  });

  it("skips packets without a transaction hash", async () => {
    const { processor, zero } = await setup({ payloads: [payload(1, 100, null), payload(2, 110)] });
    await processor.processEvent();
    expect(zero.getProof.mock.calls).toEqual([["0xtx2"]]);
  });

  it("fails the job and reschedules when proof validation throws", async () => {
    const { processor, zero } = await setup({ payloads: [payload(1, 100)] });
    zero.validateTransactionProof.mockRejectedValue(new Error("invailid index"));
    const { queue, runJob } = queueOf(processor);
    const done = await runJob();
    expect(done).toHaveBeenCalledWith(expect.objectContaining({ message: "invailid index" }));
    expect(queue.add).toHaveBeenCalledWith({}, { jobId, repeat: { cron: "*/10 * * * * *" } });
  });
});
