import type { Config } from "../../src/config";

// Keep the repo's local .env out of these tests.
jest.mock("dotenv", () => ({ config: jest.fn() }));

const ENV_KEYS = [
  "NODE_ENV", "RELAYER_PORT", "SUBNET_URL", "PARENTNET_URL", "SUBNET_WALLET_PK", "PARENTNET_WALLET_PK",
  "CHECKPOINT_CONTRACT", "REVERSE_CHECKPOINT_CONTRACT", "PARENTNET_ZERO_CONTRACT", "SUBNET_ZERO_CONTRACT",
  "PARENTNET_ZERO_WALLET_PK", "SUBNET_ZERO_WALLET_PK", "SLACK_WEBHOOK", "MAX_FETCH_BLOCK_SIZE",
  "MN_TX_SUBMIT_WAITING_TIME", "SN_FETCHING_WAITING_TIME", "BOOTSTRAP_FAILURE_WAIT_TIME",
];

const loadConfig = (env: Record<string, string>): Config => {
  const saved = { ...process.env };
  ENV_KEYS.forEach((k) => delete process.env[k]);
  Object.assign(process.env, env);
  let config: Config;
  jest.isolateModules(() => {
    // eslint-disable-next-line @typescript-eslint/no-var-requires -- re-evaluates the module with the current env
    config = require("../../src/config").config;
  });
  process.env = saved;
  return config;
};

const PK = "11".repeat(32);

describe("config", () => {
  it("applies defaults when nothing is set", () => {
    const config = loadConfig({});
    expect(config).toMatchObject({
      port: 5215,
      devMode: false,
      chunkSize: 120,
      reBootstrapWaitingTime: 120000,
      relayerCsc: { isEnabled: false },
      reverseRelayerCsc: { isEnabled: false },
      xdcZero: { isEnabled: false, isReverseEnabled: false },
      notification: { slack: undefined },
    });
    expect(config.mainnet.submitTransactionWaitingTime).toBe(100);
    expect(config.cronJob.jobExpression).toBe("*/20 * * * * *");
  });

  it("enables dev mode for any NODE_ENV other than production", () => {
    expect(loadConfig({ NODE_ENV: "development" }).devMode).toBe(true);
    expect(loadConfig({ NODE_ENV: "production" }).devMode).toBe(false);
  });

  it("reads URLs, contracts, keys and numeric settings", () => {
    const config = loadConfig({
      RELAYER_PORT: "6000",
      SUBNET_URL: "http://subnet:8545",
      PARENTNET_URL: "https://devnet",
      CHECKPOINT_CONTRACT: "0xcsc",
      REVERSE_CHECKPOINT_CONTRACT: "0xreverse",
      PARENTNET_WALLET_PK: "0xparentpk",
      SUBNET_WALLET_PK: "0xsubnetpk",
      MAX_FETCH_BLOCK_SIZE: "50",
      MN_TX_SUBMIT_WAITING_TIME: "250",
      BOOTSTRAP_FAILURE_WAIT_TIME: "5000",
      SLACK_WEBHOOK: "/T/B/X",
    });
    expect(config.port).toBe(6000);
    expect(config.chunkSize).toBe(50);
    expect(config.reBootstrapWaitingTime).toBe(5000);
    expect(config.mainnet).toMatchObject({ url: "https://devnet", smartContractAddress: "0xcsc", accountPK: "0xparentpk", submitTransactionWaitingTime: 250 });
    expect(config.subnet).toMatchObject({ url: "http://subnet:8545", smartContractAddress: "0xreverse", accountPK: "0xsubnetpk" });
    expect(config.notification.slack).toEqual({ incomingWebHook: "/T/B/X" });
  });

  it("enables the full relayer only when parentnet key, contract and URL are all set", () => {
    const full = { PARENTNET_WALLET_PK: PK, CHECKPOINT_CONTRACT: "0xcsc", PARENTNET_URL: "https://devnet" };
    expect(loadConfig(full).relayerCsc.isEnabled).toBe(true);
    for (const key of Object.keys(full)) {
      const partial: Record<string, string> = { ...full };
      delete partial[key];
      expect(loadConfig(partial).relayerCsc.isEnabled).toBe(false);
    }
  });

  it("enables the reverse relayer only when subnet key, reverse contract and URL are all set", () => {
    const reverse = { SUBNET_WALLET_PK: PK, REVERSE_CHECKPOINT_CONTRACT: "0xr", SUBNET_URL: "http://subnet" };
    expect(loadConfig(reverse).reverseRelayerCsc.isEnabled).toBe(true);
    for (const key of Object.keys(reverse)) {
      const partial: Record<string, string> = { ...reverse };
      delete partial[key];
      expect(loadConfig(partial).reverseRelayerCsc.isEnabled).toBe(false);
    }
  });

  it("enables XDC-Zero and 0x-prefixes its wallet keys", () => {
    const config = loadConfig({
      PARENTNET_ZERO_CONTRACT: "0xpz",
      SUBNET_ZERO_CONTRACT: "0xsz",
      PARENTNET_ZERO_WALLET_PK: PK,
      SUBNET_ZERO_WALLET_PK: "0x" + PK,
      CHECKPOINT_CONTRACT: "0xcsc",
      REVERSE_CHECKPOINT_CONTRACT: "0xr",
    });
    expect(config.xdcZero).toEqual({
      isEnabled: true,
      isReverseEnabled: true,
      parentChainZeroContractAddress: "0xpz",
      subnetZeroContractAddress: "0xsz",
      parentnetWalletPk: "0x" + PK,
      subnetWalletPk: "0x" + PK,
    });
  });

  it("leaves XDC-Zero disabled when a required variable is missing", () => {
    const config = loadConfig({ PARENTNET_ZERO_CONTRACT: "0xpz", SUBNET_ZERO_CONTRACT: "0xsz", PARENTNET_ZERO_WALLET_PK: PK });
    expect(config.xdcZero.isEnabled).toBe(false);
    expect(config.xdcZero.parentnetWalletPk).toBe("");
  });

  // BUG: features are enabled by key presence, so an empty value (e.g. `SUBNET_ZERO_WALLET_PK=` in an
  // env file) enables XDC-Zero with the key "0x", and ZeroService's privateKeyToAccount throws at startup.
  it.failing("does not enable XDC-Zero when its variables are present but empty", () => {
    const config = loadConfig({
      PARENTNET_ZERO_CONTRACT: "", SUBNET_ZERO_CONTRACT: "", PARENTNET_ZERO_WALLET_PK: "", CHECKPOINT_CONTRACT: "",
    });
    expect(config.xdcZero.isEnabled).toBe(false);
  });

  // BUG: `+value || default` turns an explicit 0 into the default.
  it.failing("honours an explicit 0 for numeric settings", () => {
    const config = loadConfig({ MN_TX_SUBMIT_WAITING_TIME: "0", BOOTSTRAP_FAILURE_WAIT_TIME: "0" });
    expect(config.mainnet.submitTransactionWaitingTime).toBe(0);
    expect(config.reBootstrapWaitingTime).toBe(0);
  });
});
