const app = require('./app');
const config = require('./config');
const logger = require('./utils/logger');
const { pingElasticsearch, closeEsClient } = require('./config/elasticsearch');
const { pingRedis, closeRedisClient } = require('./config/redis');
const { connectRabbitMQ, closeRabbitMQ } = require('./config/rabbitmq');
const VideoEventConsumer = require('./consumers/videoEventConsumer');
const { getSearchService } = require('./services/searchService');
const { getSearchLogger } = require('./utils/searchLogger');

let server = null;
let videoConsumer = null;
let trendingInterval = null;

/**
 * Start the server
 */
const startServer = async () => {
  try {
    // Connect to Elasticsearch (optional, skip if not available)
    try {
      await pingElasticsearch();
    } catch (esError) {
      logger.warn('Elasticsearch not available, running in degraded mode:', esError.message);
    }

    // Connect to Redis
    await pingRedis();

    // Connect to RabbitMQ
    const { channel } = await connectRabbitMQ();

    // Start video event consumer
    videoConsumer = new VideoEventConsumer(channel);
    await videoConsumer.startConsuming();

    // Setup trending update interval (every 10 minutes)
    const searchService = getSearchService();
    trendingInterval = setInterval(async () => {
      try {
        await searchService.updateTrendingSearches();
      } catch (error) {
        logger.error('Trending update error:', error.message);
      }
    }, config.search.trendingUpdateInterval);

    // Start HTTP server
    const port = config.app.port;
    server = app.listen(port, '127.0.0.1', () => {
      logger.info(`${config.app.name} running on port ${port} in ${config.app.env} mode`);
    });

    return server;
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

  // Stop accepting new connections
  if (server) {
    server.close(() => {
      logger.info('HTTP server closed');
    });
  }

  // Stop trending update interval
  if (trendingInterval) {
    clearInterval(trendingInterval);
  }

  // Stop video event consumer
  if (videoConsumer) {
    await videoConsumer.stopConsuming();
  }

  // Flush search logger
  try {
    const searchLogger = getSearchLogger();
    await searchLogger.shutdown();
  } catch (error) {
    logger.error('Search logger shutdown error:', error.message);
  }

  // Close connections
  await Promise.all([
    closeRabbitMQ().catch(() => {}),
    closeRedisClient().catch(() => {}),
    closeEsClient().catch(() => {}),
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


