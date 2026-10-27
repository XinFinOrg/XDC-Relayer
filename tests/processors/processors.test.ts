import { createLogger } from "../helpers/logger";
import { testConfig } from "../helpers/testConfig";

jest.mock("bull");
jest.mock("@bull-board/api", () => ({ createBullBoard: jest.fn() }));
jest.mock("@bull-board/api/bullAdapter", () => ({ BullAdapter: jest.fn() }));
// eslint-disable-next-line @typescript-eslint/no-var-requires -- jest.mock factories are hoisted, so they cannot use imports
jest.mock("../../src/config", () => ({ config: require("../helpers/testConfig").testConfig }));
jest.mock("../../src/service/mainnet");
jest.mock("../../src/service/subnet");
jest.mock("../../src/processors/lite");
jest.mock("../../src/processors/full");
jest.mock("../../src/processors/reverseFull");
jest.mock("../../src/processors/zero");
jest.mock("../../src/processors/reverseZero");

import { createBullBoard } from "@bull-board/api";
import { ExpressAdapter } from "@bull-board/express";
import { Processors } from "../../src/processors";

type Internals = {
  processors: Record<"lite" | "full" | "reverseFull" | "zero" | "reverseZero", Record<string, jest.Mock>>;
  mainnetService: Record<string, jest.Mock>;
  subnetService: Record<string, jest.Mock>;
};

const setup = (flags: { full?: string; reverse?: string; zero?: boolean; reverseZero?: boolean }) => {
  testConfig.relayerCsc.isEnabled = flags.full !== undefined;
  testConfig.reverseRelayerCsc.isEnabled = flags.reverse !== undefined;
  testConfig.xdcZero.isEnabled = !!flags.zero;
  testConfig.xdcZero.isReverseEnabled = !!flags.reverseZero;
  const processors = new Processors(createLogger());
  const internals = processors as unknown as Internals;
  internals.mainnetService.Mode.mockResolvedValue(flags.full);
  internals.subnetService.Mode.mockResolvedValue(flags.reverse);
  const resetCalled = () =>
    Object.entries(internals.processors).filter(([, p]) => p.reset.mock.calls.length > 0).map(([k]) => k);
  return { processors, internals, resetCalled };
};

describe("Processors", () => {
  it.each([
    [{ full: "full" }, ["full"]],
    [{ full: "lite" }, ["lite"]],
    [{ reverse: "reverse_full" }, ["reverseFull"]],
    [{ full: "full", reverse: "reverse_full", zero: true, reverseZero: true }, ["full", "reverseFull", "zero", "reverseZero"]],
    [{ zero: true }, ["zero"]],
    [{}, []],
  ])("with %j starts %j", async (flags, expected) => {
    const { processors, resetCalled } = setup(flags);
    await processors.reset();
    expect(resetCalled()).toEqual(expected);
  });

  it("cleans every queue before starting the selected processors", async () => {
    const { processors, internals } = setup({ full: "full" });
    await processors.reset();
    for (const p of Object.values(internals.processors)) expect(p.clean).toHaveBeenCalled();
  });

  it("rejects an unknown parentnet contract mode", async () => {
    const { processors } = setup({ full: "reverse_full" });
    await expect(processors.reset()).rejects.toThrow("No avaiable mode from PARENTNET smart contract API");
  });

  it("rejects an unknown subnet contract mode", async () => {
    const { processors } = setup({ reverse: "full" });
    await expect(processors.reset()).rejects.toThrow("No available mode from SUBNET smart contract API");
  });

  it("does not query contract modes for disabled relayers", async () => {
    const { processors, internals } = setup({ zero: true });
    await processors.reset();
    expect(internals.mainnetService.Mode).not.toHaveBeenCalled();
    expect(internals.subnetService.Mode).not.toHaveBeenCalled();
  });

  it("init registers every processor and exposes all queues on the status board", () => {
    const { processors, internals } = setup({});
    for (const p of Object.values(internals.processors)) p.getQueue.mockReturnValue({});
    const adapter = new ExpressAdapter();
    expect(processors.init(adapter)).toBe(processors);
    for (const p of Object.values(internals.processors)) expect(p.init).toHaveBeenCalled();
    expect(createBullBoard).toHaveBeenCalledWith(
      expect.objectContaining({ serverAdapter: adapter, queues: expect.arrayContaining([expect.anything()]) })
    );
    expect((createBullBoard as jest.Mock).mock.calls[0][0].queues).toHaveLength(5);
  });
});
