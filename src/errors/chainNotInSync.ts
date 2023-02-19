export class ChainNotInSync extends Error {
  constructor(msg: string) {
    super(msg);
  }
}