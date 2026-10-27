import { hash } from "../helpers/fixtures";
import { createLogger } from "../helpers/logger";
import { queueOf } from "../helpers/queue";

jest.mock("bull");
// eslint-disable-next-line @typescript-eslint/no-var-requires -- jest.mock factories are hoisted, so they cannot use imports
jest.mock("../../src/config", () => ({ config: require("../helpers/testConfig").testConfig }));
jest.mock("../../src/service/mainnet");
jest.mock("../../src/service/subnet");

import { Lite } from "../../src/processors/lite";
import { ForkingError } from "../../src/errors/forkingError";

type Mocked = Record<string, jest.Mock>;

// Simulates a lite CSC with epoch 900 / gap 450: it stores gap blocks (451, 1351, ...) and epoch blocks
// (900, 1800, ...). Receiving a block with its 3 following headers commits it immediately, unless the
// block number is listed in `needsCommit`, in which case it stays uncommitted until commitHeader.
const setup = (opts: { latest: number; committed: number; subnetHeight: number; needsCommit?: number[]; sequence?: number; lastNum?: number }) => {
  const processor = new Lite(createLogger());
  const lite = (processor as unknown as Record<string, Mocked>).liteMainnetService;
  const subnet = (processor as unknown as Record<string, Mocked>).subnetService;
  const state = { latest: opts.latest, committed: opts.committed };
  const needsCommit = new Set(opts.needsCommit ?? []);

  // web3 returns uint64 values as decimal strings.
  lite.getGapAndEpoch.mockResolvedValue({ gap: "450", epoch: "900" });
  lite.getLastAuditedBlock.mockImplementation(async () => ({
    smartContractHash: hash(state.latest),
    smartContractHeight: state.latest,
    smartContractCommittedHash: hash(state.committed),
    smartContractCommittedHeight: state.committed,
  }));
  lite.getUnCommittedHeader.mockImplementation(async () => ({
    sequence: String(opts.sequence ?? 1),
    lastRoundNum: "0",
    lastNum: String(opts.lastNum ?? state.latest + 1),
  }));
  lite.submitTxs.mockImplementation(async (headers: { blockNum: number }[]) => {
    state.latest = headers[0].blockNum;
    if (!needsCommit.has(state.latest)) state.committed = state.latest;
  });
  lite.commitHeader.mockImplementation(async () => {
    state.committed = state.latest;
  });
  subnet.getLastCommittedBlockInfo.mockResolvedValue({ subnetBlockNumber: opts.subnetHeight, subnetBlockHash: hash(opts.subnetHeight) });
  subnet.bulkGetRlpHeaders.mockImplementation(async (start: number, count: number) =>
    Array.from({ length: count }, (_, i) => ({ encodedRLP: Buffer.from(`h${start + i}`).toString("base64"), blockNum: start + i }))
  );
  const run = () => (processor as unknown as { processEvent(): Promise<string> }).processEvent();
  return { processor, lite, subnet, state, run };
};

describe("Lite processor", () => {
  it("submits each next gap/epoch block until the next one is beyond the subnet's committed height", async () => {
    const { lite, subnet, run } = setup({ latest: 451, committed: 451, subnetHeight: 2000 });
    await expect(run()).resolves.toBe("Successfully submitted subnet header up till 2000 into parent chain");
    expect(subnet.bulkGetRlpHeaders.mock.calls).toEqual([[900, 4], [1351, 4], [1800, 4]]);
    expect(lite.submitTxs).toHaveBeenCalledTimes(3);
    expect(lite.commitHeader).not.toHaveBeenCalled();
  });

  it("steps from an epoch block to the next gap block (epoch - gap + 1 later)", async () => {
    const { subnet, run } = setup({ latest: 900, committed: 900, subnetHeight: 1400 });
    await run();
    expect(subnet.bulkGetRlpHeaders.mock.calls).toEqual([[1351, 4]]);
  });

  it("submits nothing when the next gap/epoch block is not committed on the subnet yet", async () => {
    const { lite, run } = setup({ latest: 900, committed: 900, subnetHeight: 1350 });
    await run();
    expect(lite.submitTxs).not.toHaveBeenCalled();
  });

  it("commits an uncommitted block with the headers after its last committed header", async () => {
    const { lite, subnet, run } = setup({ latest: 1351, committed: 900, subnetHeight: 1700, lastNum: 1352 });
    await run();
    expect(lite.getUnCommittedHeader).toHaveBeenCalledWith(hash(1351));
    expect(subnet.bulkGetRlpHeaders).toHaveBeenCalledWith(1353, 4);
    expect(lite.commitHeader).toHaveBeenCalledWith(
      hash(1351),
      [1353, 1354, 1355, 1356].map((n) => "0x" + Buffer.from(`h${n}`).toString("hex"))
    );
  });

  it("commits a newly submitted block that did not commit on receipt, then moves on", async () => {
    const { lite, subnet, run } = setup({ latest: 451, committed: 451, subnetHeight: 1000, needsCommit: [900] });
    await run();
    expect(subnet.bulkGetRlpHeaders.mock.calls).toEqual([[900, 4], [902, 4]]);
    expect(lite.submitTxs).toHaveBeenCalledTimes(1);
    expect(lite.commitHeader).toHaveBeenCalledTimes(1);
  });

  it.each([
    ["the commit sequence reached 3", { sequence: 3 }],
    ["no header was ever committed for it", { lastNum: 0 }],
  ])("throws ForkingError when %s", async (_, opts) => {
    const { run } = setup({ latest: 1351, committed: 900, subnetHeight: 1700, ...opts });
    await expect(run()).rejects.toThrow(ForkingError);
  });

  it("schedules its job every 2 minutes and does not reschedule on failure", async () => {
    const { processor, lite } = setup({ latest: 900, committed: 900, subnetHeight: 1000 });
    const { queue, runJob } = queueOf(processor);
    await processor.reset();
    expect(queue.add).toHaveBeenCalledWith({}, { jobId: "LITE", repeat: { cron: "0 */2 * * * *" } });

    processor.init();
    lite.getLastAuditedBlock.mockRejectedValue(new Error("node down"));
    const done = await runJob();
    expect(done).toHaveBeenCalledWith(expect.objectContaining({ message: "node down" }));
    expect(queue.add).toHaveBeenCalledTimes(1);
  });
});
