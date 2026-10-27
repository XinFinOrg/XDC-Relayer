import type { Config } from "../../src/config";
import { PK } from "./services";

// Config used by processor tests through jest.mock("../../src/config"). Tests may mutate the flags;
// chunkSize is small so chunked submission is visible.
export const testConfig: Config = {
  port: 5215,
  devMode: true,
  cronJob: {
    liteJobExpression: "0 */2 * * * *",
    jobExpression: "*/20 * * * * *",
    zeroJobExpression: "*/10 * * * * *",
  },
  subnet: { url: "http://subnet.invalid", smartContractAddress: "0x00000000000000000000000000000000000000a1", accountPK: PK, fetchWaitingTime: 0, submitTransactionWaitingTime: 0 },
  mainnet: { url: "http://parentnet.invalid", smartContractAddress: "0x00000000000000000000000000000000000000b1", accountPK: PK, fetchWaitingTime: 0, submitTransactionWaitingTime: 0 },
  reBootstrapWaitingTime: 0,
  notification: {},
  chunkSize: 5,
  xdcZero: { isEnabled: false, isReverseEnabled: false },
  relayerCsc: { isEnabled: false },
  reverseRelayerCsc: { isEnabled: false },
};
