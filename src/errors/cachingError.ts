export class CachingError extends Error {
  constructor(operation: "SET" | "GET") {
    const message = `Error while trying to ${operation} from the cache`;
    super(message);
  }
}