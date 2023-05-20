import bunyan from "bunyan";
import { sleep } from "./../../src/utils/index";
import { config } from "../../src/config";
import { Worker } from "../../src/conntroller/worker";

let workerConfig: any;
const logger = bunyan.createLogger({name: "test"});
beforeEach(() => {
  workerConfig = config;
  jest.clearAllMocks();
});

test("Should bootstrap successfully for same block hash", async () => {
  const worker = new Worker(workerConfig, logger);
  
  const mockMainnetClient = {
    getLastAudittedBlock: jest.fn().mockResolvedValue({
      smartContractHash: "0x666",
      smartContractHeight: 6,
      smartContractCommittedHash: "0x123",
      smartContractCommittedHeight: 3
    })
  };
  const mockSubnetClient = {
    getLastCommittedBlockInfo: jest.fn().mockResolvedValue({
      subnetBlockHash: "0x123",
      subnetBlockNumber: 3,
      subnetBlockRound: 3,
      encodedRLP: "0x123123123",
      parentHash: "0x000"
    })
  };
  worker.subnetService = mockSubnetClient as any;
  worker.mainnetClient = mockMainnetClient as any;
  const success = await worker.bootstrap();
  expect(success).toBe(true);
});

test("Should submit transactions normally for small gaps", async () => {
  const worker = new Worker(workerConfig, logger);
  
  const mockedResultsToSubmit = Array(6).map((_, index) => {
    return {
      encodedRLP: "xxx",
      blockNum: index
    };
  });
  const mockMainnetClient = {
    getLastAudittedBlock: jest.fn().mockResolvedValue({
      smartContractHash: "0x666",
      smartContractHeight: 6,
      smartContractCommittedHash: "0x123",
      smartContractCommittedHeight: 3
    }),
    submitTxs: jest.fn().mockResolvedValueOnce(undefined)
  };
  const mockSubnetClient = {
    getLastCommittedBlockInfo: jest.fn().mockResolvedValue({
      subnetBlockHash: "0x456",
      subnetBlockNumber: 10,
      subnetBlockRound: 10,
      encodedRLP: "0x123123123",
      parentHash: "0x000"
    }),
    getCommittedBlockInfoByNum: jest.fn().mockResolvedValueOnce({
      subnetBlockHash: "0x123",
      subnetBlockNumber: 3
    }).mockResolvedValueOnce({
      subnetBlockHash: "0x666",
      subnetBlockNumber: 6
    }),
    bulkGetRlpEncodedHeaders: jest.fn().mockResolvedValueOnce(mockedResultsToSubmit)
  };
  worker.subnetService = mockSubnetClient as any;
  worker.mainnetClient = mockMainnetClient as any;
  const success = await worker.bootstrap();
  expect(success).toBe(true);
  expect(mockMainnetClient.submitTxs).toHaveBeenCalledTimes(1);
  expect(mockMainnetClient.submitTxs).toHaveBeenCalledWith(mockedResultsToSubmit);
  expect(mockSubnetClient.bulkGetRlpEncodedHeaders).toBeCalledWith(7, 4);
});

test("Should submit transactions normally for large gaps", async () => {
  const worker = new Worker(workerConfig, logger);
  const mockedResultsToSubmit = Array(10).map((_, index) => {
    return {
      encodedRLP: "xxx",
      blockNum: index
    };
  });
  
  const mockMainnetClient = {
    getLastAudittedBlock: jest.fn().mockResolvedValue({
      smartContractHash: "0x666",
      smartContractHeight: 6,
      smartContractCommittedHash: "0x123",
      smartContractCommittedHeight: 3
    }),
    submitTxs: jest.fn().mockResolvedValue(undefined)
  };
  
  const mockSubnetClient = {
    getLastCommittedBlockInfo: jest.fn().mockResolvedValue({
      subnetBlockHash: "0x100",
      subnetBlockNumber: 100,
      subnetBlockRound: 99,
      encodedRLP: "0x123123123",
      parentHash: "0x000"
    }),
    getCommittedBlockInfoByNum: jest.fn().mockResolvedValueOnce({
      subnetBlockHash: "0x123",
      subnetBlockNumber: 3
    }).mockResolvedValueOnce({
      subnetBlockHash: "0x666",
      subnetBlockNumber: 6
    }),
    bulkGetRlpEncodedHeaders: jest.fn().mockResolvedValueOnce(mockedResultsToSubmit)
  };
  
  
  worker.subnetService = mockSubnetClient as any;
  worker.mainnetClient = mockMainnetClient as any;
  const success = await worker.bootstrap();
  expect(success).toBe(true);
  expect(mockMainnetClient.submitTxs).toHaveBeenCalledTimes(4);
  expect(mockSubnetClient.bulkGetRlpEncodedHeaders).toHaveBeenNthCalledWith(1, 7, 30);
  expect(mockSubnetClient.bulkGetRlpEncodedHeaders).toHaveBeenNthCalledWith(2, 37, 30);
  expect(mockSubnetClient.bulkGetRlpEncodedHeaders).toHaveBeenNthCalledWith(3, 67, 30);
  expect(mockSubnetClient.bulkGetRlpEncodedHeaders).toHaveBeenLastCalledWith(97, 4);
});

test("Should fail if same block height but different hash received", async () => {
  const worker = new Worker(workerConfig, logger);
  const mockMainnetClient = {
    getLastAudittedBlock: jest.fn().mockResolvedValue({
      smartContractHash: "0x666",
      smartContractHeight: 6,
      smartContractCommittedHash: "0x123",
      smartContractCommittedHeight: 3
    }),
  };
  const mockSubnetClient = {
    getLastCommittedBlockInfo: jest.fn().mockResolvedValue({
      subnetBlockHash: "0x456",
      subnetBlockNumber: 3,
      subnetBlockRound: 4,
      encodedRLP: "0x123123123",
      parentHash: "0x000"
    })
  };
  worker.subnetService = mockSubnetClient as any;
  worker.mainnetClient = mockMainnetClient as any;
  const success = await worker.bootstrap();
  expect(success).toBe(false);
});


test("Should fail if fetch same block height from subnet have different hash than mainnent", async () => {
  const worker = new Worker(workerConfig, logger);
  const mockMainnetClient = {
    getLastAudittedBlock: jest.fn().mockResolvedValue({
      smartContractHash: "0x666",
      smartContractHeight: 6,
      smartContractCommittedHash: "0x123",
      smartContractCommittedHeight: 3
    }),
  };
  const mockSubnetClient = {
    getLastCommittedBlockInfo: jest.fn().mockResolvedValue({
      subnetBlockHash: "0x999",
      subnetBlockNumber: 9,
      subnetBlockRound: 10,
      encodedRLP: "0x123123123",
      parentHash: "0x000"
    }),
    getCommittedBlockInfoByNum: jest.fn().mockResolvedValue({
      subnetBlockHash: "0x321",
      subnetBlockNumber: 3
    })
  };
  worker.subnetService = mockSubnetClient as any;
  worker.mainnetClient = mockMainnetClient as any;
  const success = await worker.bootstrap();
  expect(success).toBe(false);
});

test("Should pass successfully if mainnet SM is ahead of subnet and matches the hashes", async () => {
  const worker = new Worker(workerConfig, logger);
  const mockMainnetClient = {
    getLastAudittedBlock: jest.fn().mockResolvedValue({
      smartContractHash: "0x999",
      smartContractHeight: 9,
      smartContractCommittedHash: "0x555",
      smartContractCommittedHeight: 5
    }),
    getBlockHashByNumber: jest.fn().mockResolvedValueOnce("0x333")
  };
  const mockSubnetClient = {
    getLastCommittedBlockInfo: jest.fn().mockResolvedValue({
      subnetBlockHash: "0x333",
      subnetBlockNumber: 3,
      subnetBlockRound: 4,
      encodedRLP: "0x123123123",
      parentHash: "0x000"
    }),
    
  };
  worker.subnetService = mockSubnetClient as any;
  worker.mainnetClient = mockMainnetClient as any;
  const success = await worker.bootstrap();
  expect(success).toBe(true);
});

test("Should start normal cron job", async () => {
  workerConfig.cronJob.jobExpression = "*/02 * * * * *";
  const worker = new Worker(workerConfig, logger);
  const mockedResultsToSubmit = [{
    encodedRLP: "first",
    blockNum: 4
  }];
  const mockedSecontimeResultsToSubmit = [{
    encodedRLP: "second",
    blockNum: 10
  }];
  const mockMainnetClient = {
    getLastAudittedBlock: jest.fn().mockResolvedValue({
      smartContractHash: "0x666",
      smartContractHeight: 6,
      smartContractCommittedHash: "0x123",
      smartContractCommittedHeight: 3
    }),
    submitTxs: jest.fn().mockResolvedValueOnce(undefined)
  };
  const mockSubnetClient = {
    getLastCommittedBlockInfo: jest.fn().mockResolvedValueOnce({
      subnetBlockHash: "0x10",
      subnetBlockNumber: 10,
      subnetBlockRound: 10,
      encodedRLP: "0x123123123",
      parentHash: "0x000"
    }).mockResolvedValueOnce({
      subnetBlockHash: "0x456",
      subnetBlockNumber: 11,
      subnetBlockRound: 12,
      encodedRLP: "0x123123123123",
      parentHash: "0x001"
    }),
    getCommittedBlockInfoByNum: jest.fn().mockResolvedValueOnce({
      subnetBlockHash: "0x123",
      subnetBlockNumber: 3
    }).mockResolvedValueOnce({
      subnetBlockHash: "0x666",
      subnetBlockNumber: 6
    }).mockResolvedValueOnce({
      subnetBlockHash: "0x10",
      subnetBlockNumber: 10
    }),
    bulkGetRlpEncodedHeaders: jest.fn()
      .mockResolvedValueOnce(mockedResultsToSubmit)
      .mockResolvedValueOnce(mockedSecontimeResultsToSubmit)
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
  expect(mockMainnetClient.submitTxs).toHaveBeenCalledWith(mockedResultsToSubmit);
  expect(mockSubnetClient.bulkGetRlpEncodedHeaders).toBeCalledWith(7, 4);
  
  // worker.cron.start();
  // await sleep(4500);
  // cachedValue = worker.cache.getLastSubmittedSubnetHeader();
  // expect(cachedValue?.subnetBlockHash).toEqual("0x456");
  // expect(cachedValue?.subnetBlockNumber).toEqual(11);
  // expect(cachedValue?.subnetBlockRound).toEqual(12);
  // worker.cron.stop();
});