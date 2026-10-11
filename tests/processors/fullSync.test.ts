import { hash } from "../helpers/fixtures";
import { createLogger } from "../helpers/logger";
import { queueOf } from "../helpers/queue";

jest.mock("bull");
// eslint-disable-next-line @typescript-eslint/no-var-requires -- jest.mock factories are hoisted, so they cannot use imports
jest.mock("../../src/config", () => ({ config: require("../helpers/testConfig").testConfig }));
jest.mock("../../src/service/mainnet");
jest.mock("../../src/service/subnet");

import { Full } from "../../src/processors/full";
import { ReverseFull } from "../../src/processors/reverseFull";
import { ForkingError } from "../../src/errors/forkingError";

// Full relays subnet blocks into the CSC on the parentnet; ReverseFull relays parentnet blocks into
// the reverse CSC on the subnet. Both run the same sync algorithm, so one suite covers both:
// "source" is the chain being relayed and "csc" is the service holding the checkpoint contract.
const forkHash = (n: number) => "0xf0" + n.toString(16).padStart(62, "0");
const otherContractHash = (n: number) => "0xee" + n.toString(16).padStart(62, "0");

describe.each([
  { name: "Full", Processor: Full, sourceKey: "subnetService", cscKey: "mainnetService", prefix: "subnet" },
  { name: "ReverseFull", Processor: ReverseFull, sourceKey: "mainnetService", cscKey: "subnetService", prefix: "mainnet" },
] as const)("$name processor", ({ name, Processor, sourceKey, cscKey, prefix }) => {
  type Mocked = Record<string, jest.Mock>;

  // Builds a processor whose source chain has canonical hashes hash(n) up to `sourceHeight`, and whose
  // checkpoint contract stores `cscHash(n)` with the given latest/committed heights.
  const setup = (opts: {
    sourceHeight: number;
    cscLatest: number;
    cscCommitted: number;
    cscHash?: (n: number) => string;
  }) => {
    const cscHash = opts.cscHash ?? hash;
    const processor = new Processor(createLogger());
    const internals = processor as unknown as Record<string, Mocked>;
    const source = internals[sourceKey];
    const csc = internals[cscKey];

    const blockInfo = (n: number) => ({
      [`${prefix}BlockHash`]: hash(n),
      [`${prefix}BlockNumber`]: n,
      [`${prefix}BlockRound`]: n,
      encodedRLP: `rlp-${n}`,
      parentHash: hash(n - 1),
    });
    source.getLastCommittedBlockInfo.mockResolvedValue(blockInfo(opts.sourceHeight));
    source.getCommittedBlockInfoByNum.mockImplementation(async (n: number) => blockInfo(n));
    source.bulkGetRlpHeaders.mockImplementation(async (start: number, count: number) =>
      Array.from({ length: count }, (_, i) => ({ encodedRLP: `rlp-${start + i}`, blockNum: start + i }))
    );
    // If the processor reads stored hashes from the source-chain service, it is reading the wrong
    // contract (the other direction's CSC), which stores unrelated hashes.
    source.getBlockHashByNumber.mockImplementation(async (n: number) => otherContractHash(n));

    csc.getLastAuditedBlock.mockResolvedValue({
      smartContractHash: cscHash(opts.cscLatest),
      smartContractHeight: opts.cscLatest,
      smartContractCommittedHash: cscHash(opts.cscCommitted),
      smartContractCommittedHeight: opts.cscCommitted,
    });
    csc.getBlockHashByNumber.mockImplementation(async (n: number) => cscHash(n));
    csc.submitTxsDynamic.mockResolvedValue(undefined);

    const submittedRanges = () =>
      csc.submitTxsDynamic.mock.calls.map(([headers]: [{ blockNum: number }[]]) => [
        headers[0].blockNum,
        headers[headers.length - 1].blockNum,
      ]);
    return { processor, source, csc, submittedRanges };
  };

  // Branches that look up the source chain's height in the checkpoint contract. ReverseFull reads
  // that hash from mainnetService (the parentnet CSC holding subnet headers) instead of
  // subnetService (the reverse CSC), so it compares against the wrong contract.
  const readsCscByHeight = name === "ReverseFull" ? it.failing : it;

  describe("when the source chain is behind the contract's committed block", () => {
    readsCscByHeight("waits if the source block matches the contract", async () => {
      const { processor, csc } = setup({ sourceHeight: 90, cscLatest: 110, cscCommitted: 100 });
      await expect(processor.processEvent()).resolves.toMatch(/Smart contract is ahead/);
      expect(csc.submitTxsDynamic).not.toHaveBeenCalled();
    });

    it("reports a fork if the source block differs from the contract", async () => {
      const { processor } = setup({ sourceHeight: 90, cscLatest: 110, cscCommitted: 100, cscHash: forkHash });
      await expect(processor.processEvent()).rejects.toThrow(ForkingError);
    });
  });

  describe("when the source chain is at the contract's committed height", () => {
    it("does nothing if the hashes match", async () => {
      const { processor, csc } = setup({ sourceHeight: 100, cscLatest: 100, cscCommitted: 100 });
      await expect(processor.processEvent()).resolves.toMatch(/committed and subnet are already in sync/);
      expect(csc.submitTxsDynamic).not.toHaveBeenCalled();
    });

    it("reports a fork if the hashes differ", async () => {
      const { processor } = setup({ sourceHeight: 100, cscLatest: 100, cscCommitted: 100, cscHash: forkHash });
      await expect(processor.processEvent()).rejects.toThrow(/Forking detected! 100/);
    });
  });

  describe("when the source chain is ahead of the contract's committed block", () => {
    it("reports a fork if the contract's committed block is not on the source chain", async () => {
      const { processor } = setup({ sourceHeight: 120, cscLatest: 110, cscCommitted: 100, cscHash: forkHash });
      await expect(processor.processEvent()).rejects.toThrow(/Forking detected! 100/);
    });

    it("does nothing if the contract's latest block is the source's latest committed block", async () => {
      const { processor, csc } = setup({ sourceHeight: 110, cscLatest: 110, cscCommitted: 100 });
      await expect(processor.processEvent()).resolves.toMatch(/latest and subnet are already in sync/);
      expect(csc.submitTxsDynamic).not.toHaveBeenCalled();
    });

    it("submits every block after the contract's latest, in chunks of chunkSize", async () => {
      const { processor, source, submittedRanges } = setup({ sourceHeight: 112, cscLatest: 100, cscCommitted: 98 });
      await expect(processor.processEvent()).resolves.toBe("Completed sync from 100 to 112");
      expect(source.bulkGetRlpHeaders.mock.calls).toEqual([[101, 5], [106, 5], [111, 2]]);
      expect(submittedRanges()).toEqual([[101, 105], [106, 110], [111, 112]]);
    });

    it("resubmits from the diverging point when the contract's latest block is on a fork", async () => {
      // Contract matches the source chain up to 103, then holds forked blocks 104..106.
      const cscHash = (n: number) => (n > 103 ? forkHash(n) : hash(n));
      const { processor, submittedRanges } = setup({ sourceHeight: 110, cscLatest: 106, cscCommitted: 100, cscHash });
      await expect(processor.processEvent()).resolves.toBe("Completed sync from 103 to 110");
      expect(submittedRanges()).toEqual([[104, 108], [109, 110]]);
    });

    readsCscByHeight("waits when another relayer is ahead on the same chain", async () => {
      const { processor, csc } = setup({ sourceHeight: 105, cscLatest: 110, cscCommitted: 100 });
      await expect(processor.processEvent()).resolves.toMatch(/behind mainnet latest audited/);
      expect(csc.submitTxsDynamic).not.toHaveBeenCalled();
    });

    it("resubmits from the diverging point when the contract is ahead on a fork", async () => {
      const cscHash = (n: number) => (n > 102 ? forkHash(n) : hash(n));
      const { processor, submittedRanges } = setup({ sourceHeight: 105, cscLatest: 110, cscCommitted: 100, cscHash });
      await expect(processor.processEvent()).resolves.toBe("Completed sync from 102 to 105");
      expect(submittedRanges()).toEqual([[103, 105]]);
    });
  });

  describe("job lifecycle", () => {
    it("reset schedules the repeatable sync job", async () => {
      const processor = new Processor(createLogger());
      const { queue } = queueOf(processor);
      await processor.reset();
      expect(queue.add).toHaveBeenCalledWith({}, { jobId: name === "Full" ? "FULL" : "REVERSE_FULL", repeat: { cron: "*/20 * * * * *" } });
    });

    it("completes the job with processEvent's result", async () => {
      const { processor } = setup({ sourceHeight: 100, cscLatest: 100, cscCommitted: 100 });
      processor.init();
      const done = await queueOf(processor).runJob();
      expect(done).toHaveBeenCalledWith(null, expect.stringMatching(/already in sync/));
    });

    it("fails the job and reschedules when processing throws", async () => {
      const { processor, csc } = setup({ sourceHeight: 100, cscLatest: 100, cscCommitted: 100 });
      csc.getLastAuditedBlock.mockRejectedValue(new Error("node down"));
      processor.init();
      const { queue, runJob } = queueOf(processor);
      const done = await runJob();
      expect(done).toHaveBeenCalledWith(expect.objectContaining({ message: "node down" }));
      expect(queue.add).toHaveBeenCalledTimes(1);
    });
  });
});
