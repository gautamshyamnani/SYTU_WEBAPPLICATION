/**
 * server.js — Entry point
 *
 * Supports both local Node execution and Vercel serverless execution.
 * In local mode it starts an HTTP server. In Vercel it exports the Express app
 * as a handler so the same code can run in serverless functions.
 */

require('dotenv').config();
const { validateEnv } = require('./config/env');
validateEnv();

const http = require('http');
const mongoose = require('mongoose');
const app = require('./app');
const connectDB = require('./config/db');
const { getRedisClient } = require('./config/redis');
const { initSocket } = require('./config/socket');
const logger = require('./config/logger');

const PORT = process.env.PORT || 5000;
const HOST = process.env.HOST || '0.0.0.0';

let httpServer;
let shuttingDown = false;
let startupPromise = null;

const startServer = async () => {
  if (startupPromise) return startupPromise;

  startupPromise = (async () => {
    try {
      await connectDB();

      // Redis is best-effort: cache/BullMQ/Socket.IO adapter degrade
      // gracefully (see cache.js try/catch and redis.js retryStrategy),
      // so a Redis outage must never block the HTTP server from starting.
      try {
        getRedisClient();
      } catch (err) {
        logger.warn('Redis client failed to initialize (continuing without cache)', {
          err: err.message,
        });
      }

      if (process.env.VERCEL) {
        logger.info('Vercel runtime detected — skipping local HTTP server bootstrap');
        return;
      }

      httpServer = http.createServer(app);
      initSocket(httpServer);

      httpServer.listen(PORT, HOST, () => {
        logger.info(`🚀 Server running on http://${HOST}:${PORT} (${process.env.NODE_ENV || 'development'})`);
      });
    } catch (err) {
      logger.error('Failed to start server', { err: err.message, stack: err.stack });
      if (require.main === module) process.exit(1);
      throw err;
    }
  })();

  return startupPromise;
};

const shutdown = (signal) => {
  if (shuttingDown) return;
  shuttingDown = true;

  logger.info(`${signal} received — starting graceful shutdown`);

  const forceExitTimer = setTimeout(() => {
    logger.error('Graceful shutdown timed out after 10s — forcing exit');
    process.exit(1);
  }, 10_000);

  const closeHttp = () =>
    new Promise((resolve) => {
      if (!httpServer) return resolve();
      httpServer.close(() => {
        logger.info('HTTP server closed — no longer accepting new connections');
        resolve();
      });
    });

  (async () => {
    try {
      await closeHttp();
      await mongoose.connection.close();
      logger.info('MongoDB connection closed');

      try {
        await getRedisClient().quit();
        logger.info('Redis connection closed');
      } catch (err) {
        logger.warn('Redis connection close error (non-fatal)', { err: err.message });
      }

      clearTimeout(forceExitTimer);
      logger.info('Graceful shutdown complete — exiting');
      process.exit(0);
    } catch (err) {
      logger.error('Error during graceful shutdown', { err: err.message, stack: err.stack });
      clearTimeout(forceExitTimer);
      process.exit(1);
    }
  })();
};

if (require.main === module) {
  process.on('SIGINT', () => shutdown('SIGINT'));
  process.on('SIGTERM', () => shutdown('SIGTERM'));
  startServer();
}

module.exports = async function handler(req, res) {
  await startServer();
  return app(req, res);
};
