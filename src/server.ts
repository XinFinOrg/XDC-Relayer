import Koa from "koa";
import bodyParser from "koa-bodyparser";
import cors from "@koa/cors";
import bunyan from "bunyan";

import { config } from "./config";
import { Processors } from "./processors";
// import { sync } from "./service/zero";

const app = new Koa();

// Enable cors with default options
app.use(cors());
const logger = bunyan.createLogger({ name: "xdc-relayer" });

const processors = new Processors(logger);

// Enable bodyParser with default options
app.use(bodyParser());

app.listen(config.port, async () => {
  logger.info(`Relayer running on port ${config.port}`);
  await processors.init().reset();
});

