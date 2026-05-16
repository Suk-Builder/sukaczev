const Redis = require('ioredis');
const logger = require('../utils/logger');

let redis = null;

function createRedisClient() {
  const config = {
    host: process.env.REDIS_HOST || 'localhost',
    port: parseInt(process.env.REDIS_PORT, 10) || 6379,
    password: process.env.REDIS_PASSWORD || undefined,
    db: parseInt(process.env.REDIS_DB, 10) || 0,
    maxRetriesPerRequest: 3,
    enableReadyCheck: true,
    retryStrategy(times) {
      const delay = Math.min(times * 50, 2000);
      return delay;
    },
    reconnectOnError(err) {
      const targetErrors = ['READONLY', 'ECONNREFUSED', 'ETIMEDOUT'];
      return targetErrors.some(e => err.message.includes(e));
    }
  };

  return new Redis(config);
}

async function connectRedis() {
  redis = createRedisClient();

  redis.on('connect', () => {
    logger.info('Redis client connected');
  });

  redis.on('ready', () => {
    logger.info('Redis client ready');
  });

  redis.on('error', (err) => {
    logger.error('Redis error:', err.message);
  });

  redis.on('reconnecting', () => {
    logger.warn('Redis reconnecting...');
  });

  redis.on('end', () => {
    logger.warn('Redis connection closed');
  });

  // Wait for connection
  await new Promise((resolve, reject) => {
    const timeout = setTimeout(() => {
      reject(new Error('Redis connection timeout'));
    }, 10000);

    redis.once('ready', () => {
      clearTimeout(timeout);
      resolve();
    });

    redis.once('error', (err) => {
      clearTimeout(timeout);
      reject(err);
    });
  });
}

async function closeRedis() {
  if (redis) {
    await redis.quit();
    redis = null;
    logger.info('Redis connection closed gracefully');
  }
}

function getRedis() {
  if (!redis) {
    throw new Error('Redis not connected. Call connectRedis() first.');
  }
  return redis;
}

// Danmaku-specific Redis operations
async function cacheDanmaku(videoId, danmaku) {
  const key = `danmaku:recent:${videoId}`;
  const redis = getRedis();
  const pipeline = redis.pipeline();

  pipeline.lpush(key, JSON.stringify(danmaku));
  pipeline.ltrim(key, 0, 499);
  pipeline.expire(key, parseInt(process.env.DANMAKU_CACHE_TTL, 10) || 3600);

  await pipeline.exec();
}

async function getCachedDanmaku(videoId, count = 100) {
  const key = `danmaku:recent:${videoId}`;
  const redis = getRedis();
  const items = await redis.lrange(key, 0, count - 1);
  return items.map(item => {
    try {
      return JSON.parse(item);
    } catch {
      return null;
    }
  }).filter(Boolean);
}

async function getDanmakuDensity(videoId, timePoint) {
  const key = `danmaku:density:${videoId}`;
  const timeBucket = Math.floor(timePoint);
  const redis = getRedis();
  const count = await redis.hget(key, timeBucket.toString());
  return parseInt(count, 10) || 0;
}

async function incrementDanmakuDensity(videoId, timePoint) {
  const key = `danmaku:density:${videoId}`;
  const timeBucket = Math.floor(timePoint);
  const redis = getRedis();
  const pipeline = redis.pipeline();

  pipeline.hincrby(key, timeBucket.toString(), 1);
  pipeline.expire(key, 3600);

  await pipeline.exec();
}

async function clearDanmakuCache(videoId) {
  const redis = getRedis();
  const keys = [
    `danmaku:recent:${videoId}`,
    `danmaku:density:${videoId}`
  ];
  await redis.del(...keys);
}

module.exports = {
  connectRedis,
  closeRedis,
  getRedis,
  cacheDanmaku,
  getCachedDanmaku,
  getDanmakuDensity,
  incrementDanmakuDensity,
  clearDanmakuCache
};
