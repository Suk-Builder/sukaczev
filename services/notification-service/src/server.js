const http = require('http');
const app = require('./app');
const config = require('./config');
const logger = require('./utils/logger');
const { pingDatabase, closeDatabase, syncDatabase } = require('./config/database');
const { pingRedis, closeRedisClient } = require('./config/redis');
const { connectRabbitMQ, closeRabbitMQ } = require('./config/rabbitmq');
const NotificationWebSocketServer = require('./websocket/server');
const EventConsumer = require('./consumers/eventConsumer');
const { defineNotificationModel } = require('./models/notification');

let httpServer = null;
let wsServer = null;
let eventConsumer = null;

/**
 * Start the server
 */
const startServer = async () => {
  try {
    // Connect to Database
    await pingDatabase();

    // Define models and sync
    defineNotificationModel();
    if (config.app.env === 'development') {
      try {
        await syncDatabase();
      } catch (syncErr) {
        logger.warn('Database sync warning (table may already exist):', syncErr.message);
      }
    }

    // Connect to Redis
    await pingRedis();

    // Create HTTP server
    httpServer = http.createServer(app);

    // Initialize WebSocket server
    wsServer = new NotificationWebSocketServer(httpServer);
    global.wsServerInstance = wsServer;

    // Connect to RabbitMQ
    const { channel } = await connectRabbitMQ();

    // Start event consumer
    eventConsumer = new EventConsumer(channel, wsServer);
    await eventConsumer.startConsuming();

    // Start HTTP server
    const port = config.app.port;
    httpServer.listen(port, '127.0.0.1', () => {
      logger.info(`${config.app.name} running on port ${port} in ${config.app.env} mode`);
      logger.info(`WebSocket server available on the same port`);
    });

    return httpServer;
  } catch (error) {
    logger.error('Failed to start server:', error.message);
    logger.error("Startup failed, retrying in 10 seconds..."); setTimeout(() => { process.exit(1); }, 10000);
  }
};

/**
 * Graceful shutdown
 */
const shutdown = async (signal) => {
  logger.info(`${signal} received. Starting graceful shutdown...`);

  // Stop accepting new HTTP connections
  if (httpServer) {
    httpServer.close(() => {
      logger.info('HTTP server closed');
    });
  }

  // Stop event consumer
  if (eventConsumer) {
    await eventConsumer.stopConsuming();
  }

  // Close WebSocket server
  if (wsServer) {
    await wsServer.shutdown();
  }

  // Close connections
  await Promise.all([
    closeRabbitMQ().catch(() => {}),
    closeRedisClient().catch(() => {}),
    closeDatabase().catch(() => {}),
  ]);

  logger.info('Graceful shutdown completed');
  process.exit(0);
};

// Handle process signals
process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('SIGINT', () => shutdown('SIGINT'));

// Handle uncaught exceptions
process.on('uncaughtException', (error) => {
  logger.error('Uncaught exception:', error);
  shutdown('uncaughtException').catch(() => process.exit(1));
});

process.on('unhandledRejection', (reason, promise) => {
  logger.error('Unhandled rejection at:', promise, 'reason:', reason);
});

// Start the server if not in test mode
if (config.app.env !== 'test') {
  startServer();
}

module.exports = { startServer, shutdown };

