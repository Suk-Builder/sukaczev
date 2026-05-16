const app = require('./app');
const { connectDatabase, closeDatabase, initDatabase } = require('./config/database');
const { connectRedis, closeRedis } = require('./config/redis');
const { connectRabbitMQ, closeRabbitMQ } = require('./config/rabbitmq');
const logger = require('./utils/logger');

const PORT = process.env.PORT || 3004;

async function startServer() {
  try {
    await connectDatabase();
    logger.info('PostgreSQL connected');

    await connectRedis();
    logger.info('Redis connected');

    await connectRabbitMQ();
    logger.info('RabbitMQ connected');

    await initDatabase();
    logger.info('Database initialized');

    const server = app.listen(PORT, '127.0.0.1', () => {
      logger.info(`Comment service running on port ${PORT}`);
    });

    // Graceful shutdown
    const gracefulShutdown = async (signal) => {
      logger.info(`${signal} received. Starting graceful shutdown...`);

      server.close(async () => {
        try {
          await closeDatabase();
          await closeRedis();
          await closeRabbitMQ();
          logger.info('All connections closed');
          process.exit(0);
        } catch (error) {
          logger.error('Error during shutdown:', error);
          logger.error("Startup failed, retrying in 10 seconds..."); setTimeout(() => { process.exit(1); }, 10000);
        }
      });

      setTimeout(() => {
        logger.error('Forced shutdown after timeout');
        logger.error("Startup failed, retrying in 10 seconds..."); setTimeout(() => { process.exit(1); }, 10000);
      }, 10000);
    };

    process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
    process.on('SIGINT', () => gracefulShutdown('SIGINT'));
  } catch (error) {
    logger.error('Failed to start server:', error);
    logger.error("Startup failed, retrying in 10 seconds..."); setTimeout(() => { process.exit(1); }, 10000);
  }
}

process.on('unhandledRejection', (reason, promise) => {
  logger.error('Unhandled Rejection at:', promise, 'reason:', reason);
});

process.on('uncaughtException', (error) => {
  logger.error('Uncaught Exception:', error);
  logger.error("Startup failed, retrying in 10 seconds..."); setTimeout(() => { process.exit(1); }, 10000);
});

startServer();

