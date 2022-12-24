import Koa from "koa";
import bodyParser from "koa-bodyparser";
import cors from "@koa/cors";
import winston from "winston";

import { logger } from "./logger";
import { config } from "./config";
import { cron } from "./cron";

const app = new Koa();

// Enable cors with default options
app.use(cors());

// Logger middleware -> use winston as logger (logging.ts with config)
app.use(logger(winston));

// Enable bodyParser with default options
app.use(bodyParser());

// Register cron job to do any action needed
cron.start();

app.listen(config.port, () => {
    console.log(`Server running on port ${config.port}`);
});
