import Web3 from "web3";
import { chunkBy, getGasPrice, sleep } from "../../src/utils";

const web3WithGasPrice = (gasPrice: string) => {
  const web3 = new Web3();
  web3.eth.getGasPrice = jest.fn().mockResolvedValue(gasPrice);
  return web3;
};

describe("getGasPrice", () => {
  it("uses the node gas price when it is above the floor", async () => {
    expect(await getGasPrice(web3WithGasPrice("625000000000"))).toBe("625000000000");
  });

  it("never goes below the 12.5 gwei floor", async () => {
    expect(await getGasPrice(web3WithGasPrice("250000000"))).toBe("12500000000");
  });

  it("returns the floor when the node price equals it", async () => {
    expect(await getGasPrice(web3WithGasPrice("12500000000"))).toBe("12500000000");
  });

  it("handles prices beyond Number.MAX_SAFE_INTEGER without losing precision", async () => {
    expect(await getGasPrice(web3WithGasPrice("90071992547409930000"))).toBe("90071992547409930000");
  });

  it("propagates RPC failures", async () => {
    const web3 = new Web3();
    web3.eth.getGasPrice = jest.fn().mockRejectedValue(new Error("connection refused"));
    await expect(getGasPrice(web3)).rejects.toThrow("connection refused");
  });
});

describe("chunkBy", () => {
  it.each([
    [120, 0, []],
    [120, 1, [1]],
    [120, 120, [120]],
    [120, 121, [120, 1]],
    [120, 365, [120, 120, 120, 5]],
    [4, 8, [4, 4]],
  ])("chunkBy(%i)(%i) -> %j", (size, total, expected) => {
    expect(chunkBy(size)(total)).toEqual(expected);
  });

  it("chunks always add up to the requested total", () => {
    for (let total = 0; total < 500; total += 7) {
      const chunks = chunkBy(30)(total);
      expect(chunks.reduce((a, b) => a + b, 0)).toBe(total);
      expect(chunks.every((c) => c > 0 && c <= 30)).toBe(true);
    }
  });
});

describe("sleep", () => {
  it("resolves after the given delay", async () => {
    jest.useFakeTimers();
    const done = jest.fn();
    const pending = sleep(3000).then(done);
    jest.advanceTimersByTime(2999);
    await Promise.resolve();
    expect(done).not.toHaveBeenCalled();
    jest.advanceTimersByTime(1);
    await pending;
    expect(done).toHaveBeenCalled();
    jest.useRealTimers();
  });
});
