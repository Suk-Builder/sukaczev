const Redis = require('ioredis');
const config = require('./index');
const logger = require('../utils/logger');

let redisClient = null;

const createRedisClient = () => {
  const redis = new Redis({
    host: config.redis.host,
    port: config.redis.port,
    password: config.redis.password || undefined,
    db: config.redis.db,
    keyPrefix: config.redis.keyPrefix,
    retryDelayOnFailover: config.redis.retryDelayOnFailover,
    maxRetriesPerRequest: config.redis.maxRetriesPerRequest,
    lazyConnect: true,
  });

  redis.on('connect', () => {
    logger.info('Redis client connected');
  });

  redis.on('error', (err) => {
    logger.error('Redis client error:', err.message);
  });

  redis.on('reconnecting', () => {
    logger.warn('Redis client reconnecting...');
  });

  redis.on('close', () => {
    logger.warn('Redis client connection closed');
  });

  return redis;
};

const getRedisClient = () => {
  if (!redisClient) {
    redisClient = createRedisClient();
  }
  return redisClient;
};

const closeRedisClient = async () => {
  if (redisClient) {
    await redisClient.quit();
    redisClient = null;
    logger.info('Redis client closed');
  }
};

const pingRedis = async () => {
  const redis = getRedisClient();
  await redis.connect();
  const result = await redis.ping();
  logger.info('Redis connected successfully');
  return result;
};

module.exports = {
  getRedisClient,
  closeRedisClient,
  pingRedis,
};
