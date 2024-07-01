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

//Parentnet = chain where zero contract is deployed
//Childnet = chain where data transfer is initiated
// Zero triggers once in a while to to check if there is zero-requests in childnet then store that info into parentnet zero contract
export class ZeroService {
  private childnetViemClient: PublicClient;
  private parentnetViemClient: PublicClient;
  private parentnetWalletClient: WalletClient;
  private childnetService: SubnetService;
  private parentnetService: MainnetService;
  private logger: Logger;
  private parentnetWalletAccount: PrivateKeyAccount;
  private childnetUrl: string;
  private parentnetUrl: string;
  private subnetZeroAddress: string;
  private parentnetZeroAddress: string;
  private parentnetCSCAddress: string;

  constructor(logger: bunyan, mode: "reverse" | string) {
    this.logger = logger;
    if (mode == "reverse") {
      this.childnetService = new SubnetService(config.mainnet, logger);
      this.parentnetService = new MainnetService(config.subnet, logger);
      this.childnetUrl = config.mainnet.url;
      this.parentnetUrl = config.subnet.url;
      if (config.xdcZero.isReverseEnabled) {
        this.parentnetCSCAddress = config.subnet.smartContractAddress;
        this.subnetZeroAddress = config.xdcZero.parentChainZeroContractAddress;
        this.parentnetZeroAddress = config.xdcZero.subnetZeroContractAddress;
        this.parentnetWalletAccount = privateKeyToAccount(
          config.xdcZero.subnetWalletPk as Hex
        );
      }
    } else {
      this.childnetService = new SubnetService(config.subnet, logger);
      this.parentnetService = new MainnetService(config.mainnet, logger);
      this.childnetUrl = config.subnet.url;
      this.parentnetUrl = config.mainnet.url;
      if (config.xdcZero.isEnabled) {
        this.parentnetCSCAddress = config.mainnet.smartContractAddress;
        this.subnetZeroAddress = config.xdcZero.subnetZeroContractAddress;
        this.parentnetZeroAddress =
          config.xdcZero.parentChainZeroContractAddress;
        this.parentnetWalletAccount = privateKeyToAccount(
          config.xdcZero.parentnetWalletPk as Hex
        );
      }
    }
  }

  // Initialise the client services
  async init() {
    const subnetNetworkInformation =
      await this.childnetService.getNetworkInformation();
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
        public: { http: [this.childnetUrl] },
        default: { http: [this.childnetUrl] },
      },
    };

    this.childnetViemClient = createPublicClient({
      chain: subnetInfo,
      transport: http(),
    });

    const mainnetNetworkInformation =
      await this.parentnetService.getNetworkInformation();
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

    this.parentnetViemClient = createPublicClient({
      chain: mainnetInfo,
      transport: http(),
    });

    this.parentnetWalletClient = createWalletClient({
      account: this.parentnetWalletAccount,
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

    const logs = await this.childnetViemClient.getContractEvents({
      ...(subnetEndpointContract as any),
      fromBlock: BigInt(0),
      eventName: "Packet",
    });

    const parentChainId = await this.parentnetViemClient.getChainId();

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

  async getLastIndexFromParentnet() {
    const subnetChainId = await this.getSubnetChainId();
    const parentnetEndpointContract = {
      // address: config.xdcZero.parentChainZeroContractAddress,
      address: this.parentnetZeroAddress,
      abi: endpointABI,
    };
    // getSendChainLastIndex
    const lastIndex = (await this.parentnetViemClient.readContract({
      ...(parentnetEndpointContract as any),
      functionName: "getSendChainLastIndex",
      args: [subnetChainId],
    })) as number;
    return lastIndex;
  }

  async getSubnetChainId() {
    return this.childnetViemClient.getChainId();
  }

  async getParentChainId() {
    return this.parentnetViemClient.getChainId();
  }

  async getLatestBlockNumberFromCsc() {
    const parentnetCSCContract = {
      // address: config.mainnet.smartContractAddress,
      address: this.parentnetCSCAddress,
      abi: cscABI,
    };
    const blocks = (await this.parentnetViemClient.readContract({
      ...(parentnetCSCContract as any),
      functionName: "getLatestBlocks",
      args: [],
    })) as [any, any];

    return blocks[1]?.number;
  }

  async getProof(txHash: string) {
    return this.childnetService.getTransactionAndReceiptProof(txHash);
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
    const subnetChainId = await this.childnetViemClient.getChainId();
    const { request } = await this.parentnetViemClient.simulateContract({
      ...(parentnetEndpointContract as any),
      functionName: "validateTransactionProof",
      args: [subnetChainId, key, receiptProof, transactionProof, blockhash],
      account: this.parentnetWalletAccount,
    });

    const tx = await this.parentnetWalletClient.writeContract(request as any);
    this.logger.info(tx);
  }
}
