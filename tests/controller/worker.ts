import bunyan from "bunyan";
import { sleep } from "./../../src/utils/index";
import { config } from "../../src/config";
import { Worker } from "../../src/conntroller/worker";

let workerConfig: any;
const logger = bunyan.createLogger({ name: "test" });
beforeEach(() => {
  workerConfig = config;
  jest.clearAllMocks();
});

describe("Full sync test", () => {
  it("Should bootstrap successfully for same block hash", async () => {
    const worker = new Worker(workerConfig, logger);

    const mockMainnetClient = {
      getLastAudittedBlock: jest.fn().mockResolvedValue({
        smartContractHash: "0x666",
        smartContractHeight: 6,
        smartContractCommittedHash: "0x123",
        smartContractCommittedHeight: 3,
      }),
    };
    const mockSubnetClient = {
      getLastCommittedBlockInfo: jest.fn().mockResolvedValue({
        subnetBlockHash: "0x123",
        subnetBlockNumber: 3,
        subnetBlockRound: 3,
        hexRLP: "0x123123123",
        parentHash: "0x000",
      }),
    };
    worker.subnetService = mockSubnetClient as any;
    worker.mainnetClient = mockMainnetClient as any;
    const success = await worker.bootstrap();
    expect(success).toBe(true);
  });

  it("Should submit transactions normally for small gaps", async () => {
    const worker = new Worker(workerConfig, logger);

    const mockedResultsToSubmit = Array(6).map((_, index) => {
      return {
        hexRLP: "xxx",
        blockNum: index,
      };
    });
    const mockMainnetClient = {
      getLastAudittedBlock: jest.fn().mockResolvedValue({
        smartContractHash: "0x666",
        smartContractHeight: 6,
        smartContractCommittedHash: "0x123",
        smartContractCommittedHeight: 3,
      }),
      submitTxs: jest.fn().mockResolvedValueOnce(undefined),
    };
    const mockSubnetClient = {
      getLastCommittedBlockInfo: jest.fn().mockResolvedValue({
        subnetBlockHash: "0x456",
        subnetBlockNumber: 10,
        subnetBlockRound: 10,
        hexRLP: "0x123123123",
        parentHash: "0x000",
      }),
      getCommittedBlockInfoByNum: jest
        .fn()
        .mockResolvedValueOnce({
          subnetBlockHash: "0x123",
          subnetBlockNumber: 3,
        })
        .mockResolvedValueOnce({
          subnetBlockHash: "0x666",
          subnetBlockNumber: 6,
        }),
      bulkGetRlpHeaders: jest.fn().mockResolvedValueOnce(mockedResultsToSubmit),
    };
    worker.subnetService = mockSubnetClient as any;
    worker.mainnetClient = mockMainnetClient as any;
    const success = await worker.bootstrap();
    expect(success).toBe(true);
    expect(mockMainnetClient.submitTxs).toHaveBeenCalledTimes(1);
    expect(mockMainnetClient.submitTxs).toHaveBeenCalledWith(
      mockedResultsToSubmit
    );
    expect(mockSubnetClient.bulkGetRlpHeaders).toBeCalledWith(7, 4);
  });

  it("Should submit transactions normally for large gaps", async () => {
    const worker = new Worker(workerConfig, logger);
    const mockedResultsToSubmit = Array(10).map((_, index) => {
      return {
        hexRLP: "xxx",
        blockNum: index,
      };
    });

    const mockMainnetClient = {
      getLastAudittedBlock: jest.fn().mockResolvedValue({
        smartContractHash: "0x666",
        smartContractHeight: 6,
        smartContractCommittedHash: "0x123",
        smartContractCommittedHeight: 3,
      }),
      submitTxs: jest.fn().mockResolvedValue(undefined),
    };

    const mockSubnetClient = {
      getLastCommittedBlockInfo: jest.fn().mockResolvedValue({
        subnetBlockHash: "0x100",
        subnetBlockNumber: 100,
        subnetBlockRound: 99,
        hexRLP: "0x123123123",
        parentHash: "0x000",
      }),
      getCommittedBlockInfoByNum: jest
        .fn()
        .mockResolvedValueOnce({
          subnetBlockHash: "0x123",
          subnetBlockNumber: 3,
        })
        .mockResolvedValueOnce({
          subnetBlockHash: "0x666",
          subnetBlockNumber: 6,
        }),
      bulkGetRlpHeaders: jest.fn().mockResolvedValueOnce(mockedResultsToSubmit),
    };

    worker.subnetService = mockSubnetClient as any;
    worker.mainnetClient = mockMainnetClient as any;
    const success = await worker.bootstrap();
    expect(success).toBe(true);
    expect(mockMainnetClient.submitTxs).toHaveBeenCalledTimes(4);
    expect(mockSubnetClient.bulkGetRlpHeaders).toHaveBeenNthCalledWith(
      1,
      7,
      30
    );
    expect(mockSubnetClient.bulkGetRlpHeaders).toHaveBeenNthCalledWith(
      2,
      37,
      30
    );
    expect(mockSubnetClient.bulkGetRlpHeaders).toHaveBeenNthCalledWith(
      3,
      67,
      30
    );
    expect(mockSubnetClient.bulkGetRlpHeaders).toHaveBeenLastCalledWith(97, 4);
  });

  it("Should fail if same block height but different hash received", async () => {
    const worker = new Worker(workerConfig, logger);
    const mockMainnetClient = {
      getLastAudittedBlock: jest.fn().mockResolvedValue({
        smartContractHash: "0x666",
        smartContractHeight: 6,
        smartContractCommittedHash: "0x123",
        smartContractCommittedHeight: 3,
      }),
    };
    const mockSubnetClient = {
      getLastCommittedBlockInfo: jest.fn().mockResolvedValue({
        subnetBlockHash: "0x456",
        subnetBlockNumber: 3,
        subnetBlockRound: 4,
        hexRLP: "0x123123123",
        parentHash: "0x000",
      }),
    };
    worker.subnetService = mockSubnetClient as any;
    worker.mainnetClient = mockMainnetClient as any;
    const success = await worker.bootstrap();
    expect(success).toBe(false);
  });

  it("Should fail if fetch same block height from subnet have different hash than mainnent", async () => {
    const worker = new Worker(workerConfig, logger);
    const mockMainnetClient = {
      getLastAudittedBlock: jest.fn().mockResolvedValue({
        smartContractHash: "0x666",
        smartContractHeight: 6,
        smartContractCommittedHash: "0x123",
        smartContractCommittedHeight: 3,
      }),
    };
    const mockSubnetClient = {
      getLastCommittedBlockInfo: jest.fn().mockResolvedValue({
        subnetBlockHash: "0x999",
        subnetBlockNumber: 9,
        subnetBlockRound: 10,
        hexRLP: "0x123123123",
        parentHash: "0x000",
      }),
      getCommittedBlockInfoByNum: jest.fn().mockResolvedValue({
        subnetBlockHash: "0x321",
        subnetBlockNumber: 3,
      }),
    };
    worker.subnetService = mockSubnetClient as any;
    worker.mainnetClient = mockMainnetClient as any;
    const success = await worker.bootstrap();
    expect(success).toBe(false);
  });

  it("Should pass successfully if mainnet SM is ahead of subnet and matches the hashes", async () => {
    const worker = new Worker(workerConfig, logger);
    const mockMainnetClient = {
      getLastAudittedBlock: jest.fn().mockResolvedValue({
        smartContractHash: "0x999",
        smartContractHeight: 9,
        smartContractCommittedHash: "0x555",
        smartContractCommittedHeight: 5,
      }),
      getBlockHashByNumber: jest.fn().mockResolvedValueOnce("0x333"),
    };
    const mockSubnetClient = {
      getLastCommittedBlockInfo: jest.fn().mockResolvedValue({
        subnetBlockHash: "0x333",
        subnetBlockNumber: 3,
        subnetBlockRound: 4,
        hexRLP: "0x123123123",
        parentHash: "0x000",
      }),
    };
    worker.subnetService = mockSubnetClient as any;
    worker.mainnetClient = mockMainnetClient as any;
    const success = await worker.bootstrap();
    expect(success).toBe(true);
  });

  it("Should start normal cron job", async () => {
    workerConfig.cronJob.jobExpression = "*/02 * * * * *";
    const worker = new Worker(workerConfig, logger);
    const mockedResultsToSubmit = [
      {
        hexRLP: "first",
        blockNum: 4,
      },
    ];
    const mockedSecontimeResultsToSubmit = [
      {
        hexRLP: "second",
        blockNum: 10,
      },
    ];
    const mockMainnetClient = {
      getLastAudittedBlock: jest.fn().mockResolvedValue({
        smartContractHash: "0x666",
        smartContractHeight: 6,
        smartContractCommittedHash: "0x123",
        smartContractCommittedHeight: 3,
      }),
      submitTxs: jest.fn().mockResolvedValueOnce(undefined),
    };
    const mockSubnetClient = {
      getLastCommittedBlockInfo: jest
        .fn()
        .mockResolvedValueOnce({
          subnetBlockHash: "0x10",
          subnetBlockNumber: 10,
          subnetBlockRound: 10,
          hexRLP: "0x123123123",
          parentHash: "0x000",
        })
        .mockResolvedValueOnce({
          subnetBlockHash: "0x456",
          subnetBlockNumber: 11,
          subnetBlockRound: 12,
          hexRLP: "0x123123123123",
          parentHash: "0x001",
        }),
      getCommittedBlockInfoByNum: jest
        .fn()
        .mockResolvedValueOnce({
          subnetBlockHash: "0x123",
          subnetBlockNumber: 3,
        })
        .mockResolvedValueOnce({
          subnetBlockHash: "0x666",
          subnetBlockNumber: 6,
        })
        .mockResolvedValueOnce({
          subnetBlockHash: "0x10",
          subnetBlockNumber: 10,
        }),
      bulkGetRlpHeaders: jest
        .fn()
        .mockResolvedValueOnce(mockedResultsToSubmit)
        .mockResolvedValueOnce(mockedSecontimeResultsToSubmit),
    };
    worker.subnetService = mockSubnetClient as any;
    worker.mainnetClient = mockMainnetClient as any;
    const success = await worker.bootstrap();
    const cachedValue = worker.cache.getLastSubmittedSubnetHeader();
    expect(cachedValue?.subnetBlockHash).toEqual("0x10");
    expect(cachedValue?.subnetBlockNumber).toEqual(10);
    expect(cachedValue?.subnetBlockRound).toEqual(10);
    expect(success).toBe(true);
    expect(mockMainnetClient.submitTxs).toHaveBeenCalledTimes(1);
    expect(mockMainnetClient.submitTxs).toHaveBeenCalledWith(
      mockedResultsToSubmit
    );
    expect(mockSubnetClient.bulkGetRlpHeaders).toBeCalledWith(7, 4);

    // worker.cron.start();
    // await sleep(4500);
    // cachedValue = worker.cache.getLastSubmittedSubnetHeader();
    // expect(cachedValue?.subnetBlockHash).toEqual("0x456");
    // expect(cachedValue?.subnetBlockNumber).toEqual(11);
    // expect(cachedValue?.subnetBlockRound).toEqual(12);
    // worker.cron.stop();
  });
});

describe("Lite sync test", () => {
  it("Should test lite mode normal sync", async () => {
    const worker = new Worker(workerConfig, logger);
    const mockedResultsToSubmit = Array(4).map((_, index) => {
      return {
        hexRLP: "xxx",
        blockNum: index,
      };
    });
    const mockSubnetClient = {
      bulkGetRlpHeaders: jest.fn().mockResolvedValueOnce(mockedResultsToSubmit),
      getLastCommittedBlockInfo: jest.fn().mockResolvedValue({
        subnetBlockHash: "0x333",
        subnetBlockNumber: 9,
        subnetBlockRound: 7,
        hexRLP: "0x123123123",
        parentHash: "0x000",
      }),
    };
    const mockLiteMainnetClient = {
      getLastAudittedBlock: jest
        .fn()
        .mockResolvedValueOnce({
          smartContractHash: "0x000",
          smartContractHeight: 0,
          smartContractCommittedHash: "0x000",
          smartContractCommittedHeight: 0,
        })
        .mockResolvedValueOnce({
          smartContractHash: "0x666",
          smartContractHeight: 6,
          smartContractCommittedHash: "0x666",
          smartContractCommittedHeight: 6,
        }),
      getGapAndEpoch: jest.fn().mockResolvedValue({
        gap: 5,
        epoch: 10,
      }),
      commitHeader: jest.fn().mockResolvedValue(undefined),
      submitTxs: jest.fn().mockResolvedValue(undefined),
    };
    worker.subnetService = mockSubnetClient as any;
    worker.liteMainnetClient = mockLiteMainnetClient as any;
    const success = await worker.liteBootstrap();
    expect(success).toBe(true);
  });

  it("Should test lite mode continue normal sync", async () => {
    const worker = new Worker(workerConfig, logger);
    const mockedResultsToSubmit = Array(4).map((_, index) => {
      return {
        hexRLP: "xxx",
        blockNum: index,
      };
    });
    const mockSubnetClient = {
      bulkGetRlpHeaders: jest.fn().mockResolvedValue(mockedResultsToSubmit),
      getLastCommittedBlockInfo: jest.fn().mockResolvedValue({
        subnetBlockHash: "0x333",
        subnetBlockNumber: 21,
        subnetBlockRound: 101,
        hexRLP: "0x123123123",
        parentHash: "0x000",
      }),
    };
    const mockLiteMainnetClient = {
      getLastAudittedBlock: jest
        .fn()
        .mockResolvedValueOnce({
          smartContractHash: "0x000",
          smartContractHeight: 0,
          smartContractCommittedHash: "0x000",
          smartContractCommittedHeight: 0,
        })
        .mockResolvedValueOnce({
          smartContractHash: "0x666",
          smartContractHeight: 6,
          smartContractCommittedHash: "0x000",
          smartContractCommittedHeight: 6,
        })
        .mockResolvedValueOnce({
          smartContractHash: "0x666",
          smartContractHeight: 10,
          smartContractCommittedHash: "0x666",
          smartContractCommittedHeight: 10,
        })
        .mockResolvedValueOnce({
          smartContractHash: "0x666",
          smartContractHeight: 16,
          smartContractCommittedHash: "0x666",
          smartContractCommittedHeight: 16,
        })
        .mockResolvedValueOnce({
          smartContractHash: "0x666",
          smartContractHeight: 20,
          smartContractCommittedHash: "0x666",
          smartContractCommittedHeight: 20,
        }),

      getGapAndEpoch: jest.fn().mockResolvedValue({
        gap: 5,
        epoch: 10,
      }),

      commitHeader: jest.fn().mockResolvedValue(undefined),
      submitTxs: jest.fn().mockResolvedValue(undefined),
    };
    worker.subnetService = mockSubnetClient as any;
    worker.liteMainnetClient = mockLiteMainnetClient as any;
    const success = await worker.liteBootstrap();
    expect(success).toBe(true);
  });

  it("Should test lite mode sync with continue commit", async () => {
    const worker = new Worker(workerConfig, logger);
    const mockedResultsToSubmit = Array(4).map((_, index) => {
      return {
        hexRLP: "xxx",
        blockNum: index,
      };
    });
    const mockSubnetClient = {
      bulkGetRlpHeaders: jest.fn().mockResolvedValue(mockedResultsToSubmit),
      getLastCommittedBlockInfo: jest.fn().mockResolvedValue({
        subnetBlockHash: "0x333",
        subnetBlockNumber: 9,
        subnetBlockRound: 7,
        hexRLP: "0x123123123",
        parentHash: "0x000",
      }),
    };
    const mockLiteMainnetClient = {
      getLastAudittedBlock: jest
        .fn()
        .mockResolvedValueOnce({
          smartContractHash: "0x000",
          smartContractHeight: 0,
          smartContractCommittedHash: "0x000",
          smartContractCommittedHeight: 0,
        })
        .mockResolvedValueOnce({
          smartContractHash: "0x666",
          smartContractHeight: 6,
          smartContractCommittedHash: "0x000",
          smartContractCommittedHeight: 0,
        })
        .mockResolvedValueOnce({
          smartContractHash: "0x666",
          smartContractHeight: 6,
          smartContractCommittedHash: "0x666",
          smartContractCommittedHeight: 6,
        }),

      getGapAndEpoch: jest.fn().mockResolvedValue({
        gap: 5,
        epoch: 10,
      }),
      getUnCommittedHeader: jest.fn().mockResolvedValue({
        sequence: 1,
        lastRoundNum: 8,
        lastNum: 7,
      }),
      commitHeader: jest.fn().mockResolvedValue(undefined),
      submitTxs: jest.fn().mockResolvedValue(undefined),
    };
    worker.subnetService = mockSubnetClient as any;
    worker.liteMainnetClient = mockLiteMainnetClient as any;
    const success = await worker.liteBootstrap();
    expect(success).toBe(true);
  });
});
