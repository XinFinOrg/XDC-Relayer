import bunyan from "bunyan";
import express from "express";
import cors from "cors";
import bodyParser from "body-parser";
import { ExpressAdapter } from '@bull-board/express';
import Redis from 'ioredis';

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
serverAdapter.setBasePath('/');

// "/" route show the relayer job status
app.use('/', serverAdapter.getRouter());

const bootstrap = async (): Promise<void> => {
  try {
    await processors.reset();
    logger.info("Bootstrap complete");
  } catch (error) {
    logger.error(
      `Bootstrap failed, retrying in ${config.reBootstrapWaitingTime}ms`,
      { message: error.message }
    );
    await new Promise((r) => setTimeout(r, config.reBootstrapWaitingTime));
    return bootstrap();
  }
};

app.listen(config.port, async () => {
  logger.info(`Relayer running on port ${config.port}`);
  await checkConnection();
  try {
    processors.init(serverAdapter);
  } catch (error) {
    logger.error("Startup failed: processors.init threw", {
      message: error.message,
      stack: error.stack,
    });
    process.exit(1);
  }
  await bootstrap();
});

  
// Check if necessary infrastructures are up running, such as redis
const checkConnection = async () => {
  logger.info("Checking redis connection");
  const redisClient = new Redis({
    host: process.env.REDIS_HOST || "127.0.0.1",
    port: +(process.env.REDIS_PORT || 6379),
    maxRetriesPerRequest: 2
  });
  try {
    // Test command using await
    const result = await redisClient.ping();
    logger.info('Redis is connected! PING response:', result);
  } catch (error) {
    logger.error('Make sure you have redis running, error connecting to Redis:', error);
    process.exit(1);
  } finally {
    // Close the Redis connection
    redisClient.disconnect();
  }
};