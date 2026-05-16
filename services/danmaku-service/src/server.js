const http = require('http');
const { Server } = require('socket.io');
const app = require('./app');
const { connectDatabase, closeDatabase } = require('./config/database');
const { connectRedis, closeRedis } = require('./config/redis');
const socketConfig = require('./config/socket');
const logger = require('./utils/logger');

const PORT = process.env.PORT || 3003;

const server = http.createServer(app);
const io = new Server(server, {
  cors: {
    origin: process.env.CORS_ORIGIN || '*',
    methods: ['GET', 'POST'],
    credentials: true
  },
  transports: ['websocket', 'polling'],
  pingTimeout: 60000,
  pingInterval: 25000,
  connectTimeout: 10000
});

// Attach io to app for controller access
app.set('io', io);

// Initialize socket handlers
socketConfig(io);

async function startServer() {
  try {
    await connectDatabase();
    logger.info('PostgreSQL connected');

    await connectRedis();
    logger.info('Redis connected');

    server.listen(PORT, '127.0.0.1', () => {
      logger.info(`Danmaku service running on port ${PORT}`);
    });
  } catch (error) {
    logger.error('Failed to start server:', error);
    logger.error("Startup failed, retrying in 10 seconds..."); setTimeout(() => { process.exit(1); }, 10000);
  }
}

// Graceful shutdown
async function gracefulShutdown(signal) {
  logger.info(`${signal} received. Starting graceful shutdown...`);

  server.close(async () => {
    try {
      await closeDatabase();
      await closeRedis();
      logger.info('All connections closed');
      process.exit(0);
    } catch (error) {
      logger.error('Error during shutdown:', error);
      logger.error("Startup failed, retrying in 10 seconds..."); setTimeout(() => { process.exit(1); }, 10000);
    }
  });

  // Force shutdown after 10s
  setTimeout(() => {
    logger.error('Forced shutdown after timeout');
    logger.error("Startup failed, retrying in 10 seconds..."); setTimeout(() => { process.exit(1); }, 10000);
  }, 10000);
}

process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
process.on('SIGINT', () => gracefulShutdown('SIGINT'));

process.on('unhandledRejection', (reason, promise) => {
  logger.error('Unhandled Rejection at:', promise, 'reason:', reason);
});

process.on('uncaughtException', (error) => {
  logger.error('Uncaught Exception:', error);
  gracefulShutdown('UNCAUGHT_EXCEPTION');
});

startServer();

