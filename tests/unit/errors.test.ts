import { CachingError } from "../../src/errors/cachingError";
import { ChainNotInSync } from "../../src/errors/chainNotInSync";
import { ForkingError } from "../../src/errors/forkingError";
import { InvalidInputError } from "../../src/errors/invalidInput";
import { InvalidBlockHeight } from "../../src/errors/invalidblockHeight";

describe("error types", () => {
  it("ForkingError names the height and both hashes", () => {
    const error = new ForkingError(42, "0xmain", "0xsub");
    expect(error).toBeInstanceOf(Error);
    expect(error.message).toBe("Forking detected! 42, mainnetHash: 0xmain subnetHash: 0xsub");
  });

  it("InvalidBlockHeight names both heights", () => {
    expect(new InvalidBlockHeight(10, 12).message).toBe(
      "Block number height mismatch! Mainnet number 10 and subnet has 12"
    );
  });

  it.each(["SET", "GET"] as const)("CachingError describes a %s failure", (op) => {
    expect(new CachingError(op).message).toBe(`Error while trying to ${op} from the cache`);
  });

  it("ChainNotInSync and InvalidInputError keep the message", () => {
    expect(new ChainNotInSync("lagging").message).toBe("lagging");
    expect(new InvalidInputError("bad").message).toBe("bad");
  });
});
