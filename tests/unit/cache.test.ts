import { Cache } from "../../src/service/cache";
import { CachingError } from "../../src/errors/cachingError";
import { createLogger } from "../helpers/logger";

const header = {
  subnetBlockHash: "0xabc",
  subnetBlockNumber: 10,
  subnetBlockRound: 11,
  encodedRLP: "AA==",
  parentHash: "0xdef",
};

describe("Cache", () => {
  it("stores and returns the last submitted subnet header", () => {
    const cache = new Cache(createLogger());
    expect(cache.getLastSubmittedSubnetHeader()).toBeUndefined();
    cache.setLastSubmittedSubnetHeader(header);
    expect(cache.getLastSubmittedSubnetHeader()).toEqual(header);
  });

  it("cleanCache removes everything", () => {
    const cache = new Cache(createLogger());
    cache.setLastSubmittedSubnetHeader(header);
    cache.cleanCache();
    expect(cache.getLastSubmittedSubnetHeader()).toBeUndefined();
  });

  it("throws CachingError when the underlying set fails", () => {
    const logger = createLogger();
    const cache = new Cache(logger);
    (cache as unknown as { inMemoryCache: { set: () => never } }).inMemoryCache.set = () => {
      throw new Error("ECACHEFULL");
    };
    expect(() => cache.setLastSubmittedSubnetHeader(header)).toThrow(CachingError);
    expect(logger.error).toHaveBeenCalled();
  });

  describe.each([
    ["forking", "setForkingNotificationCountdown"],
    ["error", "setErrorNotificationCountdown"],
  ] as const)("%s notification countdown", (_, method) => {
    beforeEach(() => jest.useFakeTimers());
    afterEach(() => jest.useRealTimers());

    it("allows one notification per countdown window", () => {
      const cache = new Cache(createLogger());
      expect(cache[method](60)).toBe(true);
      expect(cache[method](60)).toBe(false);
    });

    it("allows another notification once the window (in seconds) expires", () => {
      const cache = new Cache(createLogger());
      expect(cache[method](60)).toBe(true);
      jest.advanceTimersByTime(59_000);
      expect(cache[method](60)).toBe(false);
      jest.advanceTimersByTime(2_000);
      expect(cache[method](60)).toBe(true);
    });
  });

  it("keeps forking and error countdowns independent", () => {
    const cache = new Cache(createLogger());
    expect(cache.setForkingNotificationCountdown(60)).toBe(true);
    expect(cache.setErrorNotificationCountdown(60)).toBe(true);
  });
});
