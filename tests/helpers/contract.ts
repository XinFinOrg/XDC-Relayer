import abiCoder from "web3-eth-abi";
import { AbiItem } from "web3-utils";
import { RpcHandler } from "./fakeProvider";

type ContractHandlers = Record<string, (...args: unknown[]) => unknown>;

// Builds an eth_call handler that decodes the called function from its selector, passes the decoded
// arguments to the matching handler, and ABI-encodes the handler's return values.
export const contractCallHandler = (abi: AbiItem[], handlers: ContractHandlers): RpcHandler => {
  const functions = abi
    .filter((item) => item.type === "function")
    .map((item) => ({ item, selector: abiCoder.encodeFunctionSignature(item) }));

  return (params) => {
    const { data } = params[0] as { data: string };
    const fn = functions.find((f) => data.startsWith(f.selector));
    if (!fn) throw new Error(`unknown selector ${data.slice(0, 10)}`);
    const handler = handlers[fn.item.name];
    if (!handler) throw new Error(`no handler for ${fn.item.name}`);

    const decoded = abiCoder.decodeParameters(fn.item.inputs, "0x" + data.slice(10));
    const args = fn.item.inputs.map((_, i) => decoded[i]);
    const outputs = fn.item.outputs ?? [];
    const result = handler(...args);
    const values = outputs.length === 1 ? [result] : (result as unknown[]);
    return abiCoder.encodeParameters(outputs, values);
  };
};
