// Read-only checks against live nodes. Skipped unless node URLs are given, e.g.:
//   RELAYER_IT_PARENTNET_URL=https://rpc1.devnet.xinfin.org RELAYER_IT_SUBNET_URL=http://127.0.0.1:8545 npm run test:integration
// Set RELAYER_IT_PARENTNET_CSC / RELAYER_IT_SUBNET_CSC to also check a checkpoint contract against its source chain.
import { keccak256 } from "ethereum-cryptography/keccak";
import Web3 from "web3";
import { MainnetService } from "../../src/service/mainnet";
import { SubnetService } from "../../src/service/subnet";
import { getGasPrice } from "../../src/utils";
import { createLogger } from "../helpers/logger";
import { PK } from "../helpers/services";

jest.setTimeout(60_000);

const nodes = [
  { name: "parentnet", url: process.env.RELAYER_IT_PARENTNET_URL, csc: process.env.RELAYER_IT_PARENTNET_CSC },
  { name: "subnet", url: process.env.RELAYER_IT_SUBNET_URL, csc: process.env.RELAYER_IT_SUBNET_CSC },
];

const ZERO_ADDRESS = "0x0000000000000000000000000000000000000000";
const serviceFor = (url: string, csc = ZERO_ADDRESS) =>
  new SubnetService({ url, smartContractAddress: csc, accountPK: PK, fetchWaitingTime: 0, submitTransactionWaitingTime: 0 }, createLogger());

const configured = nodes.filter((n) => n.url);

const liveNodeSuite = ({ url, csc }: { url?: string; csc?: string }) => {
  const service = serviceFor(url);

  it("reports a gas price the relayer will accept", async () => {
    const price = BigInt(await getGasPrice(new Web3(url)));
    expect(price >= BigInt("12500000000")).toBe(true);
  });

  it("returns block 1 with all fields the relayer needs", async () => {
    const block = await service.getCommittedBlockInfoByNum(1);
    expect(block.subnetBlockNumber).toBe(1);
    expect(block.subnetBlockHash).toMatch(/^0x[0-9a-f]{64}$/);
    expect(block.encodedRLP.length).toBeGreaterThan(0);
  });

  it("serves a batch of consecutive blocks that chain together by parent hash", async () => {
    const blocks = await service.getCommittedBlockInfoBatch(1, 5);
    expect(blocks.map((b) => b.subnetBlockNumber)).toEqual([1, 2, 3, 4, 5]);
    for (let i = 1; i < blocks.length; i++) {
      expect(blocks[i].parentHash).toBe(blocks[i - 1].subnetBlockHash);
    }
  });

  // The checkpoint contract derives each block's hash from the submitted RLP, so the RLP must hash
  // to the hash the node reports, or the relayer's fork checks compare mismatched hashes.
  it("returns EncodedRLP that hashes to the block hash", async () => {
    const [block] = await service.getCommittedBlockInfoBatch(1, 1);
    const rlpHash = "0x" + Buffer.from(keccak256(Buffer.from(block.encodedRLP, "base64"))).toString("hex");
    expect(rlpHash).toBe(block.subnetBlockHash);
  });

  it("supports the 'committed' block tag used every relayer cycle", async () => {
    const block = await service.getLastCommittedBlockInfo();
    expect(block.subnetBlockNumber).toBeGreaterThan(0);
  });

  it("reports its network id", async () => {
    const info = await service.getNetworkInformation();
    expect(info.NetworkId).toBeGreaterThan(0);
  });

  (csc ? describe : describe.skip)("checkpoint contract", () => {
    // The contract on this node stores the other chain's headers; this checks it against that chain.
    const sourceUrl = nodes.find((n) => n.url && n.url !== url)?.url;
    const contract = new MainnetService({ url, smartContractAddress: csc ?? ZERO_ADDRESS, accountPK: PK, fetchWaitingTime: 0, submitTransactionWaitingTime: 0 }, createLogger());

    it("reports a known mode and a committed block at or below the latest", async () => {
      expect(["lite", "full", "reverse_full"]).toContain(await contract.Mode());
      const audited = await contract.getLastAuditedBlock();
      expect(audited.smartContractCommittedHeight).toBeLessThanOrEqual(audited.smartContractHeight);
    });

    (sourceUrl ? it : it.skip)("stores the source chain's hash for its committed block", async () => {
      const audited = await contract.getLastAuditedBlock();
      const sourceBlock = await serviceFor(sourceUrl).getCommittedBlockInfoByNum(audited.smartContractCommittedHeight);
      expect(audited.smartContractCommittedHash).toBe(sourceBlock.subnetBlockHash);
    });
  });
};

if (configured.length) {
  describe.each(configured)("live $name node ($url)", liveNodeSuite);
} else {
  it.skip("live node checks (set RELAYER_IT_PARENTNET_URL and/or RELAYER_IT_SUBNET_URL)", () => {
    // intentionally empty
  });
}
