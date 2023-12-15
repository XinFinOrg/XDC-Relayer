import bunyan from "bunyan";
import express from "express";
import cors from "cors";
import bodyParser from "body-parser";
import { ExpressAdapter } from '@bull-board/express';

import { config } from "./config";
import { Processors } from "./processors";

const app = express();

// Enable cors with default options
app.use(cors());
const logger = bunyan.createLogger({ name: "xdc-relayer" });

const processors = new Processors(logger);

// Body Parser Middleware
// To parse URL-encoded data
app.use(bodyParser.urlencoded({ extended: true }));
// To parse json data
app.use(bodyParser.json());

const serverAdapter = new ExpressAdapter();
serverAdapter.setBasePath('/status');

// "/status" route show the relayer job status
app.use('/status', serverAdapter.getRouter());

app.listen(config.port, async () => {
  logger.info(`Relayer running on port ${config.port}, check its status at "/stats"`);
  await processors.init(serverAdapter).reset();
});

