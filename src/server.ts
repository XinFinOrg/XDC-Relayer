import Koa from "koa";
import bodyParser from "koa-bodyparser";
import cors from "@koa/cors";
import bunyan from "bunyan";

import { config } from "./config";
import { Worker } from "./conntroller/worker";

const app = new Koa();

// Enable cors with default options
app.use(cors());
const logger = bunyan.createLogger({ name: "xdc-relayer" });

const worker = new Worker(config, logger);

// Enable bodyParser with default options
app.use(bodyParser());

app.listen(config.port, async () => {
  logger.info(`Server csc relayer running on port ${config.port}`);
  await worker.synchronization();
});

app.listen(config.port + 1, async () => {
  logger.info(`Server zero relayer running on port ${config.port + 1}`);
  await worker.syncZero();
});
