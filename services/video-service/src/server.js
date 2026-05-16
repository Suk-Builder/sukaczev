/**
 * @fileoverview Server entry point for video-service.
 */

require('dotenv').config();

const { app } = require('./app');
const { initDatabase, seedDefaultCategories, closePool } = require('./config/db');
const redis = require('../src/config/redis');
const rabbitmq = require('../src/config/rabbitmq');
const logger = require('../src/services/loggerService');

const PORT = parseInt(process.env.PORT || '3002', 10);

/**
 * Graceful shutdown handler.
 */
async function gracefulShutdown(signal) {
  logger.info(`Received ${signal}. Starting graceful shutdown...`);

  try {
    await closePool();
    await redis.closeRedis();
    await rabbitmq.closeConnection();
    logger.info('Graceful shutdown completed');
    process.exit(0);
  } catch (err) {
    logger.error('Error during graceful shutdown', { error: err.message });
    process.exit(1);
  }
}

process.on('unhandledRejection', (reason, promise) => {
  logger.error('Unhandled Rejection', { reason });
});

process.on('uncaughtException', (err) => {
  logger.error('Uncaught Exception', { error: err.message, stack: err.stack });
  process.exit(1);
});

process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
process.on('SIGINT', () => gracefulShutdown('SIGINT'));

/**
 * Start the server.
 */
async function startServer() {
  try {
    await initDatabase();

    // Seed default categories
    try {
      await seedDefaultCategories();
    } catch (err) {
      logger.warn('Failed to seed categories', { error: err.message });
    }

    try {
      await redis.redis.connect();
    } catch (err) {
      logger.warn('Redis not available', { error: err.message });
    }

    try {
      await rabbitmq.connect();
    } catch (err) {
      logger.warn('RabbitMQ not available', { error: err.message });
    }

    app.listen(PORT, '127.0.0.1', () => {
      logger.info(`Video service running on port ${PORT}`, {
        port: PORT,
        env: process.env.NODE_ENV,
        pid: process.pid,
      });
    });
  } catch (err) {
    logger.error('Failed to start server', { error: err.message });
    process.exit(1);
  }
}

startServer();
