export const ABI = [
  {
    inputs: [
      {
        internalType: "address[]",
        name: "initial_validator_set",
        type: "address[]",
      },
      {
        internalType: "bytes",
        name: "genesis_header",
        type: "bytes",
      },
      {
        internalType: "bytes",
        name: "block1_header",
        type: "bytes",
      },
      {
        internalType: "uint64",
        name: "gap",
        type: "uint64",
      },
      {
        internalType: "uint64",
        name: "epoch",
        type: "uint64",
      },
    ],
    payable: false,
    stateMutability: "nonpayable",
    type: "constructor",
  },
  {
    anonymous: false,
    inputs: [
      {
        indexed: false,
        internalType: "bytes32",
        name: "block_hash",
        type: "bytes32",
      },
      {
        indexed: false,
        internalType: "int256",
        name: "number",
        type: "int256",
      },
    ],
    name: "SubnetBlockAccepted",
    type: "event",
  },
  {
    anonymous: false,
    inputs: [
      {
        indexed: false,
        internalType: "bytes32",
        name: "block_hash",
        type: "bytes32",
      },
      {
        indexed: false,
        internalType: "int256",
        name: "number",
        type: "int256",
      },
    ],
    name: "SubnetBlockFinalized",
    type: "event",
  },
  {
    constant: true,
    inputs: [
      {
        internalType: "address",
        name: "master",
        type: "address",
      },
    ],
    name: "isMaster",
    outputs: [
      {
        internalType: "bool",
        name: "",
        type: "bool",
      },
    ],
    payable: false,
    stateMutability: "view",
    type: "function",
  },
  {
    constant: false,
    inputs: [
      {
        internalType: "address",
        name: "master",
        type: "address",
      },
    ],
    name: "addMaster",
    outputs: [],
    payable: false,
    stateMutability: "nonpayable",
    type: "function",
  },
  {
    constant: false,
    inputs: [
      {
        internalType: "address",
        name: "master",
        type: "address",
      },
    ],
    name: "removeMaster",
    outputs: [],
    payable: false,
    stateMutability: "nonpayable",
    type: "function",
  },
  {
    constant: false,
    inputs: [
      {
        internalType: "bytes[]",
        name: "headers",
        type: "bytes[]",
      },
    ],
    name: "receiveHeader",
    outputs: [],
    payable: false,
    stateMutability: "nonpayable",
    type: "function",
  },
  {
    constant: true,
    inputs: [
      {
        internalType: "bytes32",
        name: "header_hash",
        type: "bytes32",
      },
    ],
    name: "getHeader",
    outputs: [
      {
        components: [
          {
            internalType: "bytes32",
            name: "parent_hash",
            type: "bytes32",
          },
          {
            internalType: "int256",
            name: "number",
            type: "int256",
          },
          {
            internalType: "uint64",
            name: "round_num",
            type: "uint64",
          },
          {
            internalType: "int256",
            name: "mainnet_num",
            type: "int256",
          },
          {
            internalType: "bool",
            name: "finalized",
            type: "bool",
          },
        ],
        internalType: "struct Subnet.HeaderInfo",
        name: "",
        type: "tuple",
      },
    ],
    payable: false,
    stateMutability: "view",
    type: "function",
  },
  {
    constant: true,
    inputs: [
      {
        internalType: "int256",
        name: "number",
        type: "int256",
      },
    ],
    name: "getHeaderByNumber",
    outputs: [
      {
        components: [
          {
            internalType: "bytes32",
            name: "hash",
            type: "bytes32",
          },
          {
            internalType: "int256",
            name: "number",
            type: "int256",
          },
        ],
        internalType: "struct Subnet.BlockLite",
        name: "",
        type: "tuple",
      },
    ],
    payable: false,
    stateMutability: "view",
    type: "function",
  },
  {
    constant: true,
    inputs: [
      {
        internalType: "bytes32",
        name: "header_hash",
        type: "bytes32",
      },
    ],
    name: "getHeaderConfirmationStatus",
    outputs: [
      {
        internalType: "bool",
        name: "",
        type: "bool",
      },
    ],
    payable: false,
    stateMutability: "view",
    type: "function",
  },
  {
    constant: true,
    inputs: [
      {
        internalType: "bytes32",
        name: "header_hash",
        type: "bytes32",
      },
    ],
    name: "getMainnetBlockNumber",
    outputs: [
      {
        internalType: "uint256",
        name: "",
        type: "uint256",
      },
    ],
    payable: false,
    stateMutability: "view",
    type: "function",
  },
  {
    constant: true,
    inputs: [],
    name: "getLatestBlocks",
    outputs: [
      {
        components: [
          {
            internalType: "bytes32",
            name: "hash",
            type: "bytes32",
          },
          {
            internalType: "int256",
            name: "number",
            type: "int256",
          },
        ],
        internalType: "struct Subnet.BlockLite",
        name: "",
        type: "tuple",
      },
      {
        components: [
          {
            internalType: "bytes32",
            name: "hash",
            type: "bytes32",
          },
          {
            internalType: "int256",
            name: "number",
            type: "int256",
          },
        ],
        internalType: "struct Subnet.BlockLite",
        name: "",
        type: "tuple",
      },
    ],
    payable: false,
    stateMutability: "view",
    type: "function",
  },
  {
    constant: true,
    inputs: [],
    name: "getCurrentValidators",
    outputs: [
      {
        components: [
          {
            internalType: "address[]",
            name: "set",
            type: "address[]",
          },
          {
            internalType: "int256",
            name: "threshold",
            type: "int256",
          },
        ],
        internalType: "struct Subnet.Validators",
        name: "",
        type: "tuple",
      },
    ],
    payable: false,
    stateMutability: "view",
    type: "function",
  },
];

export const liteABI = [
  {
    inputs: [
      {
        internalType: "address[]",
        name: "initialValidatorSet",
        type: "address[]",
      },
      {
        internalType: "bytes",
        name: "block1",
        type: "bytes",
      },
      {
        internalType: "uint64",
        name: "initGap",
        type: "uint64",
      },
      {
        internalType: "uint64",
        name: "initEpoch",
        type: "uint64",
      },
    ],
    stateMutability: "nonpayable",
    type: "constructor",
  },
  {
    anonymous: false,
    inputs: [
      {
        indexed: false,
        internalType: "bytes32",
        name: "blockHash",
        type: "bytes32",
      },
      {
        indexed: false,
        internalType: "uint64",
        name: "number",
        type: "uint64",
      },
    ],
    name: "SubnetEpochBlockAccepted",
    type: "event",
  },
  {
    anonymous: false,
    inputs: [
      {
        indexed: false,
        internalType: "string",
        name: "",
        type: "string",
      },
    ],
    name: "Warn",
    type: "event",
  },
  {
    inputs: [],
    name: "INIT_EPOCH",
    outputs: [
      {
        internalType: "uint64",
        name: "",
        type: "uint64",
      },
    ],
    stateMutability: "view",
    type: "function",
  },
  {
    inputs: [],
    name: "INIT_GAP",
    outputs: [
      {
        internalType: "uint64",
        name: "",
        type: "uint64",
      },
    ],
    stateMutability: "view",
    type: "function",
  },
  {
    inputs: [
      {
        internalType: "bytes32",
        name: "epochHash",
        type: "bytes32",
      },
      {
        internalType: "bytes[]",
        name: "headers",
        type: "bytes[]",
      },
    ],
    name: "commitHeader",
    outputs: [],
    stateMutability: "nonpayable",
    type: "function",
  },
  {
    inputs: [
      {
        internalType: "uint256",
        name: "number",
        type: "uint256",
      },
      {
        internalType: "bytes[]",
        name: "headers",
        type: "bytes[]",
      },
    ],
    name: "commitHeaderByNumber",
    outputs: [],
    stateMutability: "nonpayable",
    type: "function",
  },
  {
    inputs: [],
    name: "epochNum",
    outputs: [
      {
        internalType: "uint64",
        name: "",
        type: "uint64",
      },
    ],
    stateMutability: "view",
    type: "function",
  },
  {
    inputs: [
      {
        internalType: "uint256",
        name: "idx",
        type: "uint256",
      },
    ],
    name: "getCurrentEpochBlockByIndex",
    outputs: [
      {
        components: [
          {
            internalType: "uint64",
            name: "number",
            type: "uint64",
          },
          {
            internalType: "uint64",
            name: "roundNum",
            type: "uint64",
          },
          {
            internalType: "int64",
            name: "mainnetNum",
            type: "int64",
          },
        ],
        internalType: "struct LiteCheckpoint.HeaderInfo",
        name: "",
        type: "tuple",
      },
    ],
    stateMutability: "view",
    type: "function",
  },
  {
    inputs: [],
    name: "getCurrentValidators",
    outputs: [
      {
        components: [
          {
            internalType: "address[]",
            name: "set",
            type: "address[]",
          },
          {
            internalType: "int256",
            name: "threshold",
            type: "int256",
          },
        ],
        internalType: "struct LiteCheckpoint.Validators",
        name: "",
        type: "tuple",
      },
    ],
    stateMutability: "view",
    type: "function",
  },
  {
    inputs: [
      {
        internalType: "bytes32",
        name: "blockHash",
        type: "bytes32",
      },
    ],
    name: "getHeader",
    outputs: [
      {
        components: [
          {
            internalType: "uint64",
            name: "number",
            type: "uint64",
          },
          {
            internalType: "uint64",
            name: "roundNum",
            type: "uint64",
          },
          {
            internalType: "int64",
            name: "mainnetNum",
            type: "int64",
          },
        ],
        internalType: "struct LiteCheckpoint.HeaderInfo",
        name: "",
        type: "tuple",
      },
    ],
    stateMutability: "view",
    type: "function",
  },
  {
    inputs: [
      {
        internalType: "uint256",
        name: "number",
        type: "uint256",
      },
    ],
    name: "getHeaderByNumber",
    outputs: [
      {
        components: [
          {
            internalType: "uint64",
            name: "number",
            type: "uint64",
          },
          {
            internalType: "uint64",
            name: "roundNum",
            type: "uint64",
          },
          {
            internalType: "int64",
            name: "mainnetNum",
            type: "int64",
          },
        ],
        internalType: "struct LiteCheckpoint.HeaderInfo",
        name: "",
        type: "tuple",
      },
      {
        internalType: "bytes32",
        name: "",
        type: "bytes32",
      },
    ],
    stateMutability: "view",
    type: "function",
  },
  {
    inputs: [],
    name: "getLatestBlocks",
    outputs: [
      {
        components: [
          {
            internalType: "bytes32",
            name: "blockHash",
            type: "bytes32",
          },
          {
            internalType: "uint64",
            name: "number",
            type: "uint64",
          },
        ],
        internalType: "struct LiteCheckpoint.BlockLite",
        name: "",
        type: "tuple",
      },
      {
        components: [
          {
            internalType: "bytes32",
            name: "blockHash",
            type: "bytes32",
          },
          {
            internalType: "uint64",
            name: "number",
            type: "uint64",
          },
        ],
        internalType: "struct LiteCheckpoint.BlockLite",
        name: "",
        type: "tuple",
      },
    ],
    stateMutability: "view",
    type: "function",
  },
  {
    inputs: [
      {
        internalType: "bytes32",
        name: "blockHash",
        type: "bytes32",
      },
    ],
    name: "getUnCommittedHeader",
    outputs: [
      {
        components: [
          {
            internalType: "uint64",
            name: "sequence",
            type: "uint64",
          },
          {
            internalType: "uint64",
            name: "lastRoundNum",
            type: "uint64",
          },
          {
            internalType: "uint64",
            name: "lastNum",
            type: "uint64",
          },
        ],
        internalType: "struct LiteCheckpoint.UnCommittedHeaderInfo",
        name: "",
        type: "tuple",
      },
    ],
    stateMutability: "view",
    type: "function",
  },
  {
    inputs: [
      {
        internalType: "bytes[]",
        name: "headers",
        type: "bytes[]",
      },
    ],
    name: "receiveHeader",
    outputs: [],
    stateMutability: "nonpayable",
    type: "function",
  },
];
