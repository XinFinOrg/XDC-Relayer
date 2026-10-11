import Web3 from "web3";
import { getGasPrice } from "../src/utils";

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
});
