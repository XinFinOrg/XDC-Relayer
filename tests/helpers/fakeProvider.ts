// Minimal JSON-RPC provider for web3 1.x: routes each request to a handler by method name, so tests
// exercise web3's real request encoding and result formatting without a node.

export interface JsonRpcRequest {
  jsonrpc: string;
  id: number | string;
  method: string;
  params: unknown[];
}

export type RpcHandler = (params: unknown[]) => unknown;

export class RpcError extends Error {
  constructor(public code: number, message: string) {
    super(message);
  }
}

export class FakeProvider {
  readonly requests: JsonRpcRequest[] = [];

  constructor(private handlers: Record<string, RpcHandler> = {}) {}

  on(method: string, handler: RpcHandler): this {
    this.handlers[method] = handler;
    return this;
  }

  calls(method: string): unknown[][] {
    return this.requests.filter((r) => r.method === method).map((r) => r.params);
  }

  send(
    payload: JsonRpcRequest | JsonRpcRequest[],
    callback: (error: Error | null, response?: unknown) => void
  ): void {
    try {
      const response = Array.isArray(payload)
        ? payload.map((p) => this.handle(p))
        : this.handle(payload);
      setImmediate(() => callback(null, response));
    } catch (error) {
      setImmediate(() => callback(error as Error));
    }
  }

  // Answers one JSON-RPC request; also used to serve batches the relayer posts with axios.
  handle(request: JsonRpcRequest) {
    this.requests.push(request);
    const handler = this.handlers[request.method];
    if (!handler) {
      return {
        jsonrpc: "2.0",
        id: request.id,
        error: { code: -32601, message: `the method ${request.method} does not exist/is not available` },
      };
    }
    try {
      return { jsonrpc: "2.0", id: request.id, result: handler(request.params) };
    } catch (error) {
      const code = error instanceof RpcError ? error.code : -32000;
      return { jsonrpc: "2.0", id: request.id, error: { code, message: (error as Error).message } };
    }
  }
}
