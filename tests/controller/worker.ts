// import { sleep } from "./../../src/utils/index";
// import { config } from "../../src/config";
// import { Worker } from "../../src/conntroller/worker";

// let workerConfig: any;
// beforeEach(() => {
//   workerConfig = config;
// });

// test("Should bootstrap successfully for same block hash", async () => {
//   const abnormalCallback = () => {return;};
//   const worker = new Worker(workerConfig, abnormalCallback);
  
//   const mockMainnetClient = {
//     getLastAudittedBlock: jest.fn().mockResolvedValue("0x123")
//   };
//   const mockSubnetClient = {
//     getLastCommittedBlockInfo: jest.fn().mockResolvedValue({
//       subnetBlockHash: "0x123",
//       subnetBlockNumber: 3,
//       subnetBlockRound: 3,
//       encodedRLP: "0x123123123",
//       parentHash: "0x000"
//     })
//   };
//   worker.subnetService = mockSubnetClient as any;
//   worker.mainnetClient = mockMainnetClient as any;
//   const success = await worker.bootstrap();
//   expect(success).toBe(true);
// });

// test("Should submit transactions normally for small gaps", async () => {
//   const abnormalCallback = () => {return;};
//   const worker = new Worker(workerConfig, abnormalCallback);
//   const mockedResultsToSubmit = ["a", "b", "c", "d", "e", "f", "g", "h"];
//   const mockMainnetClient = {
//     getLastAuditedBlockHash: jest.fn().mockResolvedValue("0x123"),
//     submitTxs: jest.fn().mockResolvedValueOnce(undefined)
//   };
//   const mockSubnetClient = {
//     getLastCommittedBlockInfo: jest.fn().mockResolvedValue({
//       subnetBlockHash: "0x456",
//       subnetBlockNumber: 10,
//       subnetBlockRound: 10,
//       encodedRLP: "0x123123123",
//       parentHash: "0x000"
//     }),
//     getLastV2BlockInfoByHash: jest.fn().mockResolvedValue({
//       subnetBlockHash: "0x-mainnet-hash",
//       subnetBlockNumber: 1
//     }),
//     bulkGetRlpEncodedHeaders: jest.fn().mockResolvedValueOnce(mockedResultsToSubmit)
//   };
//   worker.subnetService = mockSubnetClient as any;
//   worker.mainnetClient = mockMainnetClient as any;
//   const success = await worker.bootstrap();
//   expect(success).toBe(true);
//   expect(mockMainnetClient.submitTxs).toHaveBeenCalledTimes(1);
//   expect(mockMainnetClient.submitTxs).toHaveBeenCalledWith(mockedResultsToSubmit);
//   expect(mockSubnetClient.bulkGetRlpEncodedHeaders).toBeCalledWith(2, 9);
// });

// test("Should submit transactions normally for large gaps", async () => {
//   const abnormalCallback = () => {return;};
//   const worker = new Worker(workerConfig, abnormalCallback);
//   const mockedResultsToSubmit = ["a", "b", "c", "d", "e", "f", "g", "h"];
//   const mockMainnetClient = {
//     getLastAuditedBlockHash: jest.fn().mockResolvedValue("0x123"),
//     submitTxs: jest.fn().mockResolvedValueOnce(undefined)
//   };
//   const mockSubnetClient = {
//     getLastCommittedBlockInfo: jest.fn().mockResolvedValue({
//       subnetBlockHash: "0x456",
//       subnetBlockNumber: 100,
//       subnetBlockRound: 99,
//       encodedRLP: "0x123123123",
//       parentHash: "0x000"
//     }),
//     getLastV2BlockInfoByHash: jest.fn().mockResolvedValue({
//       subnetBlockHash: "0x-mainnet-hash",
//       subnetBlockNumber: 1
//     }),
//     bulkGetRlpEncodedHeaders: jest.fn().mockResolvedValueOnce(mockedResultsToSubmit)
//   };
  
  
//   worker.subnetService = mockSubnetClient as any;
//   worker.mainnetClient = mockMainnetClient as any;
//   const success = await worker.bootstrap();
//   expect(success).toBe(true);
//   expect(mockMainnetClient.submitTxs).toHaveBeenCalledTimes(10);
//   expect(mockMainnetClient.submitTxs).toHaveBeenCalledWith(mockedResultsToSubmit);
//   expect(mockSubnetClient.bulkGetRlpEncodedHeaders).toHaveBeenNthCalledWith(1, 2, 10);
//   expect(mockSubnetClient.bulkGetRlpEncodedHeaders).toHaveBeenNthCalledWith(2, 12, 10);
//   expect(mockSubnetClient.bulkGetRlpEncodedHeaders).toHaveBeenNthCalledWith(3, 22, 10);
//   expect(mockSubnetClient.bulkGetRlpEncodedHeaders).toHaveBeenLastCalledWith(92, 9);
// });

// test("Should fail if invalid mainnet block height received", async () => {
//   const abnormalCallback = () => {return;};
//   const worker = new Worker(workerConfig, abnormalCallback);
//   const mockMainnetClient = {
//     getLastAuditedBlockHash: jest.fn().mockResolvedValue("0x123")
//   };
//   const mockSubnetClient = {
//     getLastCommittedBlockInfo: jest.fn().mockResolvedValue({
//       subnetBlockHash: "0x456",
//       subnetBlockNumber: 10,
//       subnetBlockRound: 10,
//       encodedRLP: "0x123123123",
//       parentHash: "0x000"
//     }),
//     getLastV2BlockInfoByHash: jest.fn().mockResolvedValue({
//       subnetBlockHash: "0x-mainnet-hash",
//       subnetBlockNumber: 11
//     })
//   };
//   worker.subnetService = mockSubnetClient as any;
//   worker.mainnetClient = mockMainnetClient as any;
//   const success = await worker.bootstrap();
//   expect(success).toBe(false);
// });


// test("Should fail if same block height but different hash received", async () => {
//   const abnormalCallback = () => {return;};
//   const worker = new Worker(workerConfig, abnormalCallback);
//   const mockMainnetClient = {
//     getLastAuditedBlockHash: jest.fn().mockResolvedValue("0x123")
//   };
//   const mockSubnetClient = {
//     getLastCommittedBlockInfo: jest.fn().mockResolvedValue({
//       subnetBlockHash: "0x456",
//       subnetBlockNumber: 10,
//       subnetBlockRound: 10,
//       encodedRLP: "0x123123123",
//       parentHash: "0x000"
//     }),
//     getLastV2BlockInfoByHash: jest.fn().mockResolvedValue({
//       subnetBlockHash: "0x-mainnet-hash",
//       subnetBlockNumber: 10
//     })
//   };
//   worker.subnetService = mockSubnetClient as any;
//   worker.mainnetClient = mockMainnetClient as any;
//   const success = await worker.bootstrap();
//   expect(success).toBe(false);
// });

// test("Should start normal cron job", async () => {
//   workerConfig.cronJob.jobExpression = "*/02 * * * * *";
//   const abnormalCallback = () => {return;};
//   const worker = new Worker(workerConfig, abnormalCallback);
//   const mockedResultsToSubmit = ["first"];
//   const mockedSecontimeResultsToSubmit = ["second"];
//   const mockMainnetClient = {
//     getLastAuditedBlockHash: jest.fn().mockResolvedValue("0xaaa"),
//     submitTxs: jest.fn().mockResolvedValueOnce(undefined)
//   };
//   const mockSubnetClient = {
//     getLastCommittedBlockInfo: jest.fn().mockResolvedValueOnce({
//       subnetBlockHash: "0x123",
//       subnetBlockNumber: 10,
//       subnetBlockRound: 10,
//       encodedRLP: "0x123123123",
//       parentHash: "0x000"
//     }).mockResolvedValueOnce({
//       subnetBlockHash: "0x456",
//       subnetBlockNumber: 11,
//       subnetBlockRound: 12,
//       encodedRLP: "0x123123123123",
//       parentHash: "0x001"
//     }),
//     getLastV2BlockInfoByHash: jest.fn().mockResolvedValueOnce({
//       subnetBlockHash: "0x-mainnet-hash",
//       subnetBlockNumber: 1
//     }).mockResolvedValueOnce({
//       subnetBlockHash: "0x-mainnet-hash-2",
//       subnetBlockNumber: 10
//     }),
//     bulkGetRlpEncodedHeaders: jest.fn()
//       .mockResolvedValueOnce(mockedResultsToSubmit)
//       .mockResolvedValueOnce(mockedSecontimeResultsToSubmit)
//   };
//   worker.subnetService = mockSubnetClient as any;
//   worker.mainnetClient = mockMainnetClient as any;
//   const success = await worker.bootstrap();
//   let cachedValue = worker.cache.getLastSubmittedSubnetHeader();
//   expect(cachedValue?.subnetBlockHash).toEqual("0x123");
//   expect(cachedValue?.subnetBlockNumber).toEqual(10);
//   expect(cachedValue?.subnetBlockRound).toEqual(10);
//   expect(success).toBe(true);
//   expect(mockMainnetClient.submitTxs).toHaveBeenCalledTimes(1);
//   expect(mockMainnetClient.submitTxs).toHaveBeenCalledWith(mockedResultsToSubmit);
//   expect(mockSubnetClient.bulkGetRlpEncodedHeaders).toBeCalledWith(2, 9);
  
//   await worker.synchronization();
//   await sleep(5000);
//   cachedValue = worker.cache.getLastSubmittedSubnetHeader();
//   expect(cachedValue?.subnetBlockHash).toEqual("0x456");
//   expect(cachedValue?.subnetBlockNumber).toEqual(11);
//   expect(cachedValue?.subnetBlockRound).toEqual(12);
// });