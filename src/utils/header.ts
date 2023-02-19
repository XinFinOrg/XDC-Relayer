import {
  BufferLike,
  AddressLike,
  BigIntLike,
  TypeOutput,
  toType
  } from "@ethereumjs/util";
  import { BlockTransactionString } from "web3-eth";
  import { Input } from "@ethereumjs/rlp";
/**
 * A XDC block header's data in buffer type.
 */
interface XdcHeaderBufferData {
  parentHash?: BufferLike
  sha3Uncles?: BufferLike
  miner?: AddressLike
  stateRoot?: BufferLike
  transactionsRoot?: BufferLike
  receiptsRoot?: BufferLike
  logsBloom?: BufferLike
  difficulty?: BigIntLike
  number?: BigIntLike
  gasLimit?: BigIntLike
  gasUsed?: BigIntLike
  timestamp?: BigIntLike
  extraData?: BufferLike
  mixHash?: BufferLike
  nonce?: BufferLike
  validators?: BufferLike,
  validator?: BufferLike,
  penalties?: BufferLike
}

export interface RawXdcSubnetHeader extends BlockTransactionString {
  validators: string
  validator: string
  penalties: string
  mixHash: string
}

/**
 * A XDC block header's data.
 */
export interface XdcHeader {
  parentHash: string
  sha3Uncles: string
  miner: string
  stateRoot: string
  transactionsRoot: string
  receiptsRoot: string
  logsBloom: string
  difficulty: bigint
  number: bigint
  gasLimit: number
  gasUsed: number
  timestamp: bigint
  extraData: string
  mixHash: string
  nonce: string
  validators: string,
  validator: string,
  penalties: string
}
export const headerToInputs = (header: XdcHeader): Input[] => {
  return [
    header.parentHash,
    header.sha3Uncles,
    header.miner,
    header.stateRoot,
    header.transactionsRoot,
    header.receiptsRoot,
    header.logsBloom,
    header.difficulty,
    header.number,
    header.gasLimit,
    header.gasUsed,
    header.timestamp,
    header.extraData,
    header.mixHash,
    header.nonce,
    header.validators,
    header.validator,
    header.penalties
  ];
};

const valuesArrayToHeaderBufferData = (values: Buffer[]): XdcHeaderBufferData => {
  const [
    parentHash,
    sha3Uncles,
    miner,
    stateRoot,
    transactionsRoot,
    receiptsRoot,
    logsBloom,
    difficulty,
    number,
    gasLimit,
    gasUsed,
    timestamp,
    extraData,
    mixHash,
    nonce,
    validators,
    validator,
    penalties,
  ] = values;

  if (values.length > 18) {
    throw new Error("invalid header. More values than expected were received");
  }
  if (values.length < 18) {
    throw new Error("invalid header. Less values than expected were received");
  }
  return {
    parentHash,
    sha3Uncles,
    miner,
    stateRoot,
    transactionsRoot,
    receiptsRoot,
    logsBloom,
    difficulty,
    number,
    gasLimit,
    gasUsed,
    timestamp,
    extraData,
    mixHash,
    nonce,
    validators,
    validator,
    penalties
  };
};

export const valuesArrayToHeaderData = (values: Buffer[]): XdcHeader => {
  const headerBufferData = valuesArrayToHeaderBufferData(values);
  
  const parentHash = toType(headerBufferData.parentHash, TypeOutput.PrefixedHexString);
  const sha3Uncles = toType(headerBufferData.sha3Uncles, TypeOutput.PrefixedHexString);
  // const miner = new Address(
  //   toType(headerBufferData.miner;
  // );
  const miner = toType(headerBufferData.miner, TypeOutput.PrefixedHexString);
  const stateRoot = toType(headerBufferData.stateRoot, TypeOutput.PrefixedHexString);
  const transactionsRoot =
    toType(headerBufferData.transactionsRoot, TypeOutput.PrefixedHexString);
  const receiptsRoot = toType(headerBufferData.receiptsRoot, TypeOutput.PrefixedHexString);
  const logsBloom = toType(headerBufferData.logsBloom, TypeOutput.PrefixedHexString);
  const difficulty = toType(headerBufferData.difficulty, TypeOutput.BigInt);
  const number = toType(headerBufferData.number, TypeOutput.BigInt);
  const gasLimit = toType(headerBufferData.gasLimit, TypeOutput.Number);
  const gasUsed = toType(headerBufferData.gasUsed, TypeOutput.Number);
  const timestamp = toType(headerBufferData.timestamp, TypeOutput.BigInt);
  const extraData = toType(headerBufferData.extraData, TypeOutput.PrefixedHexString);
  const mixHash = toType(headerBufferData.mixHash, TypeOutput.PrefixedHexString);
  const nonce = toType(headerBufferData.nonce, TypeOutput.PrefixedHexString);
  const validators = toType(headerBufferData.validators, TypeOutput.PrefixedHexString);
  const validator = toType(headerBufferData.validator, TypeOutput.PrefixedHexString);
  const penalties = toType(headerBufferData.penalties, TypeOutput.PrefixedHexString);
  
  return {
    parentHash, sha3Uncles, miner, stateRoot, transactionsRoot, receiptsRoot, logsBloom, difficulty, number, gasLimit, gasUsed,
    timestamp, extraData, mixHash, nonce, validators, validator, penalties
  };
};

export const toXdcHeader = (header: RawXdcSubnetHeader): XdcHeader => {
  return {
    parentHash: header.parentHash,
    sha3Uncles: header.sha3Uncles,
    miner: header.miner,
    stateRoot: header.stateRoot,
    transactionsRoot: header.transactionsRoot,
    receiptsRoot: header.receiptsRoot,
    logsBloom: header.logsBloom,
    difficulty: BigInt(header.difficulty),
    number: BigInt(header.number),
    gasLimit: header.gasLimit,
    gasUsed: header.gasUsed,
    timestamp: BigInt(header.timestamp),
    extraData: header.extraData,
    mixHash: header.mixHash,
    nonce: header.nonce,
    validators: header.validators,
    validator: header.validator,
    penalties: header.penalties
  };
};