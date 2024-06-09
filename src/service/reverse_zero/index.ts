import {
  Hex,
  PrivateKeyAccount,
  createWalletClient,
  PublicClient,
  WalletClient,
  createPublicClient,
  decodeAbiParameters,
  http,
} from "viem";
import bunyan from "bunyan";
import { config } from "../../config";
import { SubnetService } from "../subnet";
import endpointABI from "../../abi/endpointABI.json";
import cscABI from "../../abi/cscABI.json";
import { MainnetService } from "../mainnet";
import Logger from "bunyan";
import { privateKeyToAccount } from "viem/accounts";

// This class must be called with init() in order to use it
export class ReverseZeroService {
  private subnetViemClient: PublicClient;
  private mainnetViemClient: PublicClient;
  private mainnetWalletClient: WalletClient;
  private subnetService: SubnetService;
  private mainnetService: MainnetService;
  private logger: Logger;

  private parentChainWalletAccount: PrivateKeyAccount;
  
  private zeroWalletPk: PrivateKeyAccount;
  private subnetUrl: string;
  private parentnetUrl: string;
  private subnetZeroAddress: string;
  private parentnetZeroAddress: string;
  private subnetCSCAddress: string;
  private parentnetCSCAddress: string;

  constructor(logger: bunyan) {
    this.subnetService = new SubnetService(config.mainnet, logger); //TODO: temp swap
    this.mainnetService = new MainnetService(config.subnet, logger); //TODO: fix temp swap
    this.subnetUrl = config.mainnet.url;
    this.parentnetUrl = config.subnet.url;
    this.subnetCSCAddress = config.mainnet.smartContractAddress;
    this.parentnetCSCAddress = config.subnet.smartContractAddress;
    this.subnetZeroAddress = config.xdcZero.parentChainZeroContractAddress;
    this.parentnetZeroAddress = config.xdcZero.subnetZeroContractAddress;

    this.logger = logger;
    this.parentChainWalletAccount = privateKeyToAccount(config.xdcZero.subnetWalletPk as Hex);
  }

  // Initialise the client services
  async init() {
    const subnetNetworkInformation =
      await this.subnetService.getNetworkInformation();
    const subnetInfo = {
      id: subnetNetworkInformation.NetworkId,
      name: subnetNetworkInformation.NetworkName,
      network: subnetNetworkInformation.NetworkName,
      nativeCurrency: {
        decimals: 18,
        name: subnetNetworkInformation.Denom,
        symbol: subnetNetworkInformation.Denom,
      },
      rpcUrls: {
        public: { http: [this.subnetUrl]},
        default: { http: [this.subnetUrl] },
      },
    };

    this.subnetViemClient = createPublicClient({
      chain: subnetInfo,
      transport: http(),
    });

    const mainnetNetworkInformation =
      await this.mainnetService.getNetworkInformation();
    const mainnetInfo = {
      id: mainnetNetworkInformation.NetworkId,
      name: mainnetNetworkInformation.NetworkName,
      network: mainnetNetworkInformation.NetworkName,
      nativeCurrency: {
        decimals: 18,
        name: mainnetNetworkInformation.Denom,
        symbol: mainnetNetworkInformation.Denom,
      },
      rpcUrls: {
        public: { http: [this.parentnetUrl] },
        default: { http: [this.parentnetUrl] },
      },
    };

    this.mainnetViemClient = createPublicClient({
      chain: mainnetInfo,
      transport: http(),
    });

    this.mainnetWalletClient = createWalletClient({
      account: this.parentChainWalletAccount,
      chain: mainnetInfo,
      transport: http(),
    });
  }

  async getPayloads() {
    const payloads = [] as any;
    const subnetEndpointContract = {
      // address: config.xdcZero.subnetZeroContractAddress,
      address: this.subnetZeroAddress,
      abi: endpointABI,
    };

    const logs = await this.subnetViemClient.getContractEvents({
      ...(subnetEndpointContract as any),
      fromBlock: BigInt(0),
      eventName: "Packet",
    });

    const parentChainId = await this.mainnetViemClient.getChainId();

    logs?.forEach((log) => {
      const values = decodeAbiParameters(
        [
          { name: "index", type: "uint" },
          { name: "sid", type: "uint" },
          { name: "sua", type: "address" },
          { name: "rid", type: "uint" },
          { name: "rua", type: "address" },
          { name: "data", type: "bytes" },
        ],
        `0x${log.data.substring(130)}`
      );

      if (Number(values[3]) == parentChainId) {
        const list = [...values];
        list.push(log.transactionHash);
        list.push(log.blockNumber);
        payloads.push(list);
      }
    });

    return payloads;
  }

  async getIndexFromParentnet() {
    const subnetChainId = await this.subnetViemClient.getChainId();
    const parentnetEndpointContract = {
      // address: config.xdcZero.parentChainZeroContractAddress,
      address: this.parentnetZeroAddress,
      abi: endpointABI,
    };
    const chain = (await this.mainnetViemClient.readContract({
      ...(parentnetEndpointContract as any),
      functionName: "getChain",
      args: [subnetChainId],
    })) as { lastIndex: number };

    return chain?.lastIndex;
  }

  async getLatestBlockNumberFromCsc() {
    const parentnetCSCContract = {
      // address: config.mainnet.smartContractAddress,
      address: this.parentnetCSCAddress,
      abi: cscABI,
    };
    const blocks = (await this.mainnetViemClient.readContract({
      ...(parentnetCSCContract as any),
      functionName: "getLatestBlocks",
      args: [],
    })) as [any, any];

    return blocks[1]?.number;
  }

  async getProof(txHash: string) {
    return this.subnetService.getTransactionAndReceiptProof(txHash);
  }

  async validateTransactionProof(
    key: string,
    receiptProof: string[],
    transactionProof: string[],
    blockhash: string
  ) {
    const parentnetEndpointContract = {
      // address: config.xdcZero.parentChainZeroContractAddress,
      address: this.parentnetZeroAddress,
      abi: endpointABI,
    };
    const subnetChainId = await this.subnetViemClient.getChainId();
    const { request } = await this.mainnetViemClient.simulateContract({
      ...(parentnetEndpointContract as any),
      functionName: "validateTransactionProof",
      args: [subnetChainId, key, receiptProof, transactionProof, blockhash],
      account: this.parentChainWalletAccount,
    });

    const tx = await this.mainnetWalletClient.writeContract(request as any);
    this.logger.info(tx);
  }
}
