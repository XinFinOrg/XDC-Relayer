import {
  BufferLike,
  AddressLike,
  BigIntLike,
  TypeOutput,
  zeros,
  Address,
  KECCAK256_RLP,
  KECCAK256_RLP_ARRAY,
  toType,
  } from "@ethereumjs/util";

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

/**
 * A XDC block header's data.
 */
export interface XdcHeader {
  parentHash?: string
  sha3Uncles?: string
  miner?: string
  stateRoot?: string
  transactionsRoot?: string
  receiptsRoot?: string
  logsBloom?: string
  difficulty?: bigint
  number?: bigint
  gasLimit?: number
  gasUsed?: number
  timestamp?: bigint
  extraData?: string
  mixHash?: string
  nonce?: string
  validators?: string,
  validator?: string,
  penalties?: string
}

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