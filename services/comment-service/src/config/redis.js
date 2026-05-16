const Redis = require('ioredis');
const logger = require('../utils/logger');

let redis = null;

function createRedisClient() {
  const config = {
    host: process.env.REDIS_HOST || 'localhost',
    port: parseInt(process.env.REDIS_PORT, 10) || 6379,
    password: process.env.REDIS_PASSWORD || undefined,
    db: parseInt(process.env.REDIS_DB, 10) || 1,
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

// Comment-specific Redis operations
async function cacheComments(videoId, comments, page = 1) {
  const key = `comments:${videoId}:page:${page}`;
  const redis = getRedis();
  const ttl = parseInt(process.env.COMMENT_CACHE_TTL, 10) || 3600;

  await redis.setex(key, ttl, JSON.stringify(comments));
}

async function getCachedComments(videoId, page = 1) {
  const key = `comments:${videoId}:page:${page}`;
  const redis = getRedis();
  const cached = await redis.get(key);

  if (cached) {
    try {
      return JSON.parse(cached);
    } catch {
      return null;
    }
  }
  return null;
}

async function cacheCommentTree(commentId, tree) {
  const key = `comment:tree:${commentId}`;
  const redis = getRedis();
  const ttl = parseInt(process.env.COMMENT_CACHE_TTL, 10) || 3600;

  await redis.setex(key, ttl, JSON.stringify(tree));
}

async function getCachedCommentTree(commentId) {
  const key = `comment:tree:${commentId}`;
  const redis = getRedis();
  const cached = await redis.get(key);

  if (cached) {
    try {
      return JSON.parse(cached);
    } catch {
      return null;
    }
  }
  return null;
}

async function invalidateCommentCache(videoId) {
  const redis = getRedis();
  const keys = await redis.keys(`comments:${videoId}:*`);
  if (keys.length > 0) {
    await redis.del(...keys);
  }
}

async function cacheHotComments(videoId, comments) {
  const key = `comments:hot:${videoId}`;
  const redis = getRedis();
  const ttl = parseInt(process.env.COMMENT_CACHE_TTL, 10) || 3600;

  await redis.setex(key, ttl, JSON.stringify(comments));
}

async function getCachedHotComments(videoId) {
  const key = `comments:hot:${videoId}`;
  const redis = getRedis();
  const cached = await redis.get(key);

  if (cached) {
    try {
      return JSON.parse(cached);
    } catch {
      return null;
    }
  }
  return null;
}

async function incrementCommentLikeCount(commentId) {
  const redis = getRedis();
  const key = `comment:likes:${commentId}`;
  await redis.incr(key);
  await redis.expire(key, 3600);
}

async function getCommentLikeCount(commentId) {
  const redis = getRedis();
  const key = `comment:likes:${commentId}`;
  const count = await redis.get(key);
  return parseInt(count, 10) || 0;
}

module.exports = {
  connectRedis,
  closeRedis,
  getRedis,
  cacheComments,
  getCachedComments,
  cacheCommentTree,
  getCachedCommentTree,
  invalidateCommentCache,
  cacheHotComments,
  getCachedHotComments,
  incrementCommentLikeCount,
  getCommentLikeCount
};
