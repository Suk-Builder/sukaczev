/**
 * @fileoverview Server entry point for user-service.
 * Initializes database connections and starts the HTTP server.
 */

require('dotenv').config();

const { app } = require('./app');
const { initDatabase, closePool } = require('./config/db');
const redis = require('./config/redis');
const rabbitmq = require('./config/rabbitmq');
const logger = require('./services/loggerService');

/**
 * Server port from environment or default.
 */
const PORT = parseInt(process.env.PORT || '3001', 10);

/**
 * Graceful shutdown handler.
 * Closes all connections before exiting.
 */
async function gracefulShutdown(signal) {
  logger.info(`Received ${signal}. Starting graceful shutdown...`);

  try {
    // Close database pool
    await closePool();
    logger.info('Database pool closed');

    // Close Redis connection
    await redis.closeRedis();
    logger.info('Redis connection closed');

    // Close RabbitMQ connection
    await rabbitmq.closeConnection();
    logger.info('RabbitMQ connection closed');

    logger.info('Graceful shutdown completed');
    process.exit(0);
  } catch (err) {
    logger.error('Error during graceful shutdown', { error: err.message });
    process.exit(1);
  }
}

/**
 * Unhandled error handlers.
 */
process.on('unhandledRejection', (reason, promise) => {
  logger.error('Unhandled Rejection', { reason, promise });
});

process.on('uncaughtException', (err) => {
  logger.error('Uncaught Exception', { error: err.message, stack: err.stack });
  process.exit(1);
});

// Setup graceful shutdown signals
process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
process.on('SIGINT', () => gracefulShutdown('SIGINT'));

/**
 * Start the server.
 */
async function startServer() {
  try {
    // Initialize database tables
    await initDatabase();

    // Connect to Redis (optional - don't fail if not available)
    try {
      await redis.redis.connect();
    } catch (err) {
      logger.warn('Redis not available, continuing without cache', { error: err.message });
    }

    // Connect to RabbitMQ (optional - don't fail if not available)
    try {
      await rabbitmq.connect();
    } catch (err) {
      logger.warn('RabbitMQ not available, continuing without events', { error: err.message });
    }

    // Start HTTP server
    app.listen(PORT, '127.0.0.1', () => {
      logger.info(`User service running on port ${PORT}`, {
        port: PORT,
        env: process.env.NODE_ENV,
        pid: process.pid,
      });
    });
  } catch (err) {
    logger.error('Failed to start server', { error: err.message, stack: err.stack });
    process.exit(1);
  }
}

// Start the server
startServer();
