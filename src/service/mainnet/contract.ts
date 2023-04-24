export const abi = [
  {
    "inputs": [
      {
        "internalType": "address[]",
        "name": "initial_validator_set",
        "type": "address[]"
      },
      {
        "internalType": "bytes",
        "name": "genesis_header",
        "type": "bytes"
      },
      {
        "internalType": "bytes",
        "name": "block1_header",
        "type": "bytes"
      },
      {
        "internalType": "uint64",
        "name": "gap",
        "type": "uint64"
      },
      {
        "internalType": "uint64",
        "name": "epoch",
        "type": "uint64"
      }
    ],
    "payable": false,
    "stateMutability": "nonpayable",
    "type": "constructor"
  },
  {
    "anonymous": false,
    "inputs": [
      {
        "indexed": false,
        "internalType": "bytes32",
        "name": "block_hash",
        "type": "bytes32"
      },
      {
        "indexed": false,
        "internalType": "int256",
        "name": "number",
        "type": "int256"
      }
    ],
    "name": "SubnetBlockAccepted",
    "type": "event"
  },
  {
    "anonymous": false,
    "inputs": [
      {
        "indexed": false,
        "internalType": "bytes32",
        "name": "block_hash",
        "type": "bytes32"
      },
      {
        "indexed": false,
        "internalType": "int256",
        "name": "number",
        "type": "int256"
      }
    ],
    "name": "SubnetBlockFinalized",
    "type": "event"
  },
  {
    "constant": true,
    "inputs": [
      {
        "internalType": "address",
        "name": "master",
        "type": "address"
      }
    ],
    "name": "isMaster",
    "outputs": [
      {
        "internalType": "bool",
        "name": "",
        "type": "bool"
      }
    ],
    "payable": false,
    "stateMutability": "view",
    "type": "function"
  },
  {
    "constant": false,
    "inputs": [
      {
        "internalType": "address",
        "name": "master",
        "type": "address"
      }
    ],
    "name": "addMaster",
    "outputs": [],
    "payable": false,
    "stateMutability": "nonpayable",
    "type": "function"
  },
  {
    "constant": false,
    "inputs": [
      {
        "internalType": "address",
        "name": "master",
        "type": "address"
      }
    ],
    "name": "removeMaster",
    "outputs": [],
    "payable": false,
    "stateMutability": "nonpayable",
    "type": "function"
  },
  {
    "constant": false,
    "inputs": [
      {
        "internalType": "bytes[]",
        "name": "headers",
        "type": "bytes[]"
      }
    ],
    "name": "receiveHeader",
    "outputs": [],
    "payable": false,
    "stateMutability": "nonpayable",
    "type": "function"
  },
  {
    "constant": true,
    "inputs": [
      {
        "internalType": "bytes32",
        "name": "header_hash",
        "type": "bytes32"
      }
    ],
    "name": "getHeader",
    "outputs": [
      {
        "components": [
          {
            "internalType": "bytes32",
            "name": "parent_hash",
            "type": "bytes32"
          },
          {
            "internalType": "int256",
            "name": "number",
            "type": "int256"
          },
          {
            "internalType": "uint64",
            "name": "round_num",
            "type": "uint64"
          },
          {
            "internalType": "int256",
            "name": "mainnet_num",
            "type": "int256"
          },
          {
            "internalType": "bool",
            "name": "finalized",
            "type": "bool"
          }
        ],
        "internalType": "struct Subnet.HeaderInfo",
        "name": "",
        "type": "tuple"
      }
    ],
    "payable": false,
    "stateMutability": "view",
    "type": "function"
  },
  {
    "constant": true,
    "inputs": [
      {
        "internalType": "int256",
        "name": "number",
        "type": "int256"
      }
    ],
    "name": "getHeaderByNumber",
    "outputs": [
      {
        "components": [
          {
            "internalType": "bytes32",
            "name": "hash",
            "type": "bytes32"
          },
          {
            "internalType": "int256",
            "name": "number",
            "type": "int256"
          }
        ],
        "internalType": "struct Subnet.BlockLite",
        "name": "",
        "type": "tuple"
      }
    ],
    "payable": false,
    "stateMutability": "view",
    "type": "function"
  },
  {
    "constant": true,
    "inputs": [
      {
        "internalType": "bytes32",
        "name": "header_hash",
        "type": "bytes32"
      }
    ],
    "name": "getHeaderConfirmationStatus",
    "outputs": [
      {
        "internalType": "bool",
        "name": "",
        "type": "bool"
      }
    ],
    "payable": false,
    "stateMutability": "view",
    "type": "function"
  },
  {
    "constant": true,
    "inputs": [
      {
        "internalType": "bytes32",
        "name": "header_hash",
        "type": "bytes32"
      }
    ],
    "name": "getMainnetBlockNumber",
    "outputs": [
      {
        "internalType": "uint256",
        "name": "",
        "type": "uint256"
      }
    ],
    "payable": false,
    "stateMutability": "view",
    "type": "function"
  },
  {
    "constant": true,
    "inputs": [],
    "name": "getLatestBlocks",
    "outputs": [
      {
        "components": [
          {
            "internalType": "bytes32",
            "name": "hash",
            "type": "bytes32"
          },
          {
            "internalType": "int256",
            "name": "number",
            "type": "int256"
          }
        ],
        "internalType": "struct Subnet.BlockLite",
        "name": "",
        "type": "tuple"
      },
      {
        "components": [
          {
            "internalType": "bytes32",
            "name": "hash",
            "type": "bytes32"
          },
          {
            "internalType": "int256",
            "name": "number",
            "type": "int256"
          }
        ],
        "internalType": "struct Subnet.BlockLite",
        "name": "",
        "type": "tuple"
      }
    ],
    "payable": false,
    "stateMutability": "view",
    "type": "function"
  },
  {
    "constant": true,
    "inputs": [],
    "name": "getCurrentValidators",
    "outputs": [
      {
        "components": [
          {
            "internalType": "address[]",
            "name": "set",
            "type": "address[]"
          },
          {
            "internalType": "int256",
            "name": "threshold",
            "type": "int256"
          }
        ],
        "internalType": "struct Subnet.Validators",
        "name": "",
        "type": "tuple"
      }
    ],
    "payable": false,
    "stateMutability": "view",
    "type": "function"
  }
];