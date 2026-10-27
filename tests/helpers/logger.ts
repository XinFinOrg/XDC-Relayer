import bunyan from "bunyan";

// A bunyan-shaped logger whose methods are jest mocks, so tests stay quiet and can assert on logs.
export const createLogger = () =>
  ({
    info: jest.fn(),
    error: jest.fn(),
    warn: jest.fn(),
    debug: jest.fn(),
  } as unknown as bunyan & Record<"info" | "error" | "warn" | "debug", jest.Mock>);
