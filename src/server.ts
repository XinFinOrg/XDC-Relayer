import Koa from "koa";
import bodyParser from "koa-bodyparser";
import cors from "@koa/cors";
import winston from "winston";

import { logger } from "./logger";
import { config } from "./config";
import { Worker } from "./conntroller/worker";

const app = new Koa();
const worker = new Worker(config);

// Enable cors with default options
app.use(cors());

// Logger middleware -> use winston as logger (logging.ts with config)
app.use(logger(winston));

// Enable bodyParser with default options
app.use(bodyParser());

app.listen(config.port, async () => {
    console.info(`Server running on port ${config.port}`);
    await worker.synchronization();
});
