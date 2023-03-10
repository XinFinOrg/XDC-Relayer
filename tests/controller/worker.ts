import { sleep } from "./../../src/utils/index";
import { config } from "../../src/config";
import { Worker } from "../../src/conntroller/worker";

let workerConfig: any;
beforeEach(() => {
  workerConfig = config;
  jest.clearAllMocks();
});

test("Should bootstrap successfully for same block hash", async () => {
  const abnormalCallback = () => {return;};
  const worker = new Worker(workerConfig, abnormalCallback);
  
  const mockMainnetClient = {
    getLastAudittedBlock: jest.fn().mockResolvedValue({
      smartContractHash: "0x123",
      smartContractHeight: 3
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
  const abnormalCallback = () => {return;};
  const worker = new Worker(workerConfig, abnormalCallback);
  
  const mockedResultsToSubmit = Array(6).map((_, index) => {
    return {
      encodedRLP: "xxx",
      blockNum: index
    };
  });
  const mockMainnetClient = {
    getLastAudittedBlock: jest.fn().mockResolvedValue({
      smartContractHash: "0x123",
      smartContractHeight: 3
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
    getCommittedBlockInfoByNum: jest.fn().mockResolvedValue({
      subnetBlockHash: "0x123",
      subnetBlockNumber: 3
    }),
    bulkGetRlpEncodedHeaders: jest.fn().mockResolvedValueOnce(mockedResultsToSubmit)
  };
  worker.subnetService = mockSubnetClient as any;
  worker.mainnetClient = mockMainnetClient as any;
  const success = await worker.bootstrap();
  expect(success).toBe(true);
  expect(mockMainnetClient.submitTxs).toHaveBeenCalledTimes(1);
  expect(mockMainnetClient.submitTxs).toHaveBeenCalledWith(mockedResultsToSubmit);
  expect(mockSubnetClient.bulkGetRlpEncodedHeaders).toBeCalledWith(4, 7);
});

test("Should submit transactions normally for large gaps", async () => {
  const abnormalCallback = () => {return;};
  const worker = new Worker(workerConfig, abnormalCallback);
  const mockedResultsToSubmit = Array(10).map((_, index) => {
    return {
      encodedRLP: "xxx",
      blockNum: index
    };
  });
  
  const mockMainnetClient = {
    getLastAudittedBlock: jest.fn().mockResolvedValue({
      smartContractHash: "0x123",
      smartContractHeight: 3
    }),
    submitTxs: jest.fn().mockResolvedValue(undefined)
  };
  
  const mockSubnetClient = {
    getLastCommittedBlockInfo: jest.fn().mockResolvedValue({
      subnetBlockHash: "0x456",
      subnetBlockNumber: 100,
      subnetBlockRound: 99,
      encodedRLP: "0x123123123",
      parentHash: "0x000"
    }),
    getCommittedBlockInfoByNum: jest.fn().mockResolvedValue({
      subnetBlockHash: "0x123",
      subnetBlockNumber: 3
    }),
    bulkGetRlpEncodedHeaders: jest.fn().mockResolvedValueOnce(mockedResultsToSubmit)
  };
  
  
  worker.subnetService = mockSubnetClient as any;
  worker.mainnetClient = mockMainnetClient as any;
  const success = await worker.bootstrap();
  expect(success).toBe(true);
  expect(mockMainnetClient.submitTxs).toHaveBeenCalledTimes(10);
  expect(mockSubnetClient.bulkGetRlpEncodedHeaders).toHaveBeenNthCalledWith(1, 4, 10);
  expect(mockSubnetClient.bulkGetRlpEncodedHeaders).toHaveBeenNthCalledWith(2, 14, 10);
  expect(mockSubnetClient.bulkGetRlpEncodedHeaders).toHaveBeenNthCalledWith(3, 24, 10);
  expect(mockSubnetClient.bulkGetRlpEncodedHeaders).toHaveBeenLastCalledWith(94, 7);
});

test("Should fail if same block height but different hash received", async () => {
  const abnormalCallback = () => {return;};
  const worker = new Worker(workerConfig, abnormalCallback);
  const mockMainnetClient = {
    getLastAudittedBlock: jest.fn().mockResolvedValue({
      smartContractHash: "0x123",
      smartContractHeight: 3
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
  const abnormalCallback = () => {return;};
  const worker = new Worker(workerConfig, abnormalCallback);
  const mockMainnetClient = {
    getLastAudittedBlock: jest.fn().mockResolvedValue({
      smartContractHash: "0x123",
      smartContractHeight: 3
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
  const abnormalCallback = () => {return;};
  const worker = new Worker(workerConfig, abnormalCallback);
  const mockMainnetClient = {
    getLastAudittedBlock: jest.fn().mockResolvedValue({
      smartContractHash: "0x555",
      smartContractHeight: 5
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
  const abnormalCallback = () => {return;};
  const worker = new Worker(workerConfig, abnormalCallback);
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
      smartContractHash: "0x123",
      smartContractHeight: 3
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
  let cachedValue = worker.cache.getLastSubmittedSubnetHeader();
  expect(cachedValue?.subnetBlockHash).toEqual("0x10");
  expect(cachedValue?.subnetBlockNumber).toEqual(10);
  expect(cachedValue?.subnetBlockRound).toEqual(10);
  expect(success).toBe(true);
  expect(mockMainnetClient.submitTxs).toHaveBeenCalledTimes(1);
  expect(mockMainnetClient.submitTxs).toHaveBeenCalledWith(mockedResultsToSubmit);
  expect(mockSubnetClient.bulkGetRlpEncodedHeaders).toBeCalledWith(4, 7);
  
  await worker.synchronization();
  await sleep(2500);
  cachedValue = worker.cache.getLastSubmittedSubnetHeader();
  expect(cachedValue?.subnetBlockHash).toEqual("0x456");
  expect(cachedValue?.subnetBlockNumber).toEqual(11);
  expect(cachedValue?.subnetBlockRound).toEqual(12);
});