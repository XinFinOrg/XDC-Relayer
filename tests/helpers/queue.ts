import Bull from "bull";

type JobHandler = (job: unknown, done: jest.Mock) => Promise<void>;

// With jest.mock("bull") each processor gets an automocked queue; this returns it along with the job
// handler the processor registered, and runs one job through that handler.
export const queueOf = (processor: { getQueue(): Bull.Queue }) => {
  const queue = processor.getQueue() as unknown as Record<"process" | "add" | "obliterate", jest.Mock>;
  const runJob = async () => {
    const handler = queue.process.mock.calls[0][0] as JobHandler;
    const done = jest.fn();
    await handler({}, done);
    return done;
  };
  return { queue, runJob };
};
