/**
 * @fileoverview Redis configuration for video-service caching.
 */

const Redis = require('ioredis');
const logger = require('../services/loggerService');

const redis = new Redis({
  host: process.env.REDIS_HOST || 'localhost',
  port: parseInt(process.env.REDIS_PORT || '6379', 10),
  password: process.env.REDIS_PASSWORD || undefined,
  db: parseInt(process.env.REDIS_DB || '1', 10),
  maxRetriesPerRequest: 3,
  enableReadyCheck: true,
  lazyConnect: true,
});

redis.on('ready', () => {
  logger.info('Redis client connected and ready');
});

redis.on('error', (err) => {
  logger.error('Redis connection error', { error: err.message });
});

redis.on('reconnecting', () => {
  logger.warn('Redis client reconnecting');
});

redis.on('close', () => {
  logger.warn('Redis connection closed');
});

const KEY_PREFIX = 'video_svc:';

function cacheKey(key) {
  return `${KEY_PREFIX}${key}`;
}

/**
 * Gets cached video data.
 *
 * @async
 * @param {string} videoId - Video UUID
 * @returns {Promise<Object|null>}
 */
async function getCachedVideo(videoId) {
  try {
    const data = await redis.get(cacheKey(`video:${videoId}`));
    return data ? JSON.parse(data) : null;
  } catch (err) {
    logger.error('Failed to get cached video', { videoId, error: err.message });
    return null;
  }
}

/**
 * Caches video data with TTL.
 *
 * @async
 * @param {string} videoId - Video UUID
 * @param {Object} videoData - Video data
 * @param {number} [ttl=3600] - TTL in seconds
 */
async function setCachedVideo(videoId, videoData, ttl = 3600) {
  try {
    await redis.setex(cacheKey(`video:${videoId}`), ttl, JSON.stringify(videoData));
  } catch (err) {
    logger.error('Failed to cache video', { videoId, error: err.message });
  }
}

/**
 * Invalidates cached video.
 *
 * @async
 * @param {string} videoId - Video UUID
 */
async function invalidateVideo(videoId) {
  try {
    await redis.del(cacheKey(`video:${videoId}`));
  } catch (err) {
    logger.error('Failed to invalidate video cache', { videoId, error: err.message });
  }
}

/**
 * Gets cached video list.
 *
 * @async
 * @param {string} listKey - List cache key
 * @returns {Promise<Object|null>}
 */
async function getCachedVideoList(listKey) {
  try {
    const data = await redis.get(cacheKey(`list:${listKey}`));
    return data ? JSON.parse(data) : null;
  } catch (err) {
    logger.error('Failed to get cached video list', { error: err.message });
    return null;
  }
}

/**
 * Caches video list.
 *
 * @async
 * @param {string} listKey - List cache key
 * @param {Object} data - List data
 * @param {number} [ttl=300] - TTL in seconds
 */
async function setCachedVideoList(listKey, data, ttl = 300) {
  try {
    await redis.setex(cacheKey(`list:${listKey}`), ttl, JSON.stringify(data));
  } catch (err) {
    logger.error('Failed to cache video list', { error: err.message });
  }
}

/**
 * Invalidates video list caches.
 *
 * @async
 */
async function invalidateVideoLists() {
  try {
    const keys = await redis.keys(cacheKey('list:*'));
    if (keys.length > 0) {
      await redis.del(...keys);
    }
  } catch (err) {
    logger.error('Failed to invalidate video lists', { error: err.message });
  }
}

/**
 * Caches hot videos (most viewed).
 *
 * @async
 * @param {Array} videos - Array of video objects
 * @param {number} [ttl=600] - TTL in seconds
 */
async function setHotVideos(videos, ttl = 600) {
  try {
    await redis.setex(cacheKey('hot:videos'), ttl, JSON.stringify(videos));
  } catch (err) {
    logger.error('Failed to cache hot videos', { error: err.message });
  }
}

/**
 * Gets cached hot videos.
 *
 * @async
 * @returns {Promise<Array|null>}
 */
async function getHotVideos() {
  try {
    const data = await redis.get(cacheKey('hot:videos'));
    return data ? JSON.parse(data) : null;
  } catch (err) {
    logger.error('Failed to get hot videos', { error: err.message });
    return null;
  }
}

/**
 * Increments view count in Redis (for counter aggregation).
 *
 * @async
 * @param {string} videoId - Video UUID
 * @returns {Promise<number>} New count
 */
async function incrementViewCount(videoId) {
  try {
    const key = cacheKey(`views:${videoId}`);
    return await redis.incr(key);
  } catch (err) {
    logger.error('Failed to increment view count', { videoId, error: err.message });
    return 0;
  }
}

/**
 * Gets aggregated view counts for flush to database.
 *
 * @async
 * @returns {Promise<Array<{videoId: string, count: number}>>}
 */
async function getPendingViewCounts() {
  try {
    const keys = await redis.keys(cacheKey('views:*'));
    const results = [];

    for (const key of keys) {
      const videoId = key.replace(cacheKey('views:'), '');
      const count = await redis.get(key);
      if (count && parseInt(count, 10) > 0) {
        results.push({ videoId, count: parseInt(count, 10) });
      }
    }

    return results;
  } catch (err) {
    logger.error('Failed to get pending view counts', { error: err.message });
    return [];
  }
}

/**
 * Clears pending view counts after flush.
 *
 * @async
 * @param {string[]} videoIds - Video IDs to clear
 */
async function clearPendingViewCounts(videoIds) {
  try {
    const keys = videoIds.map((id) => cacheKey(`views:${id}`));
    if (keys.length > 0) {
      await redis.del(...keys);
    }
  } catch (err) {
    logger.error('Failed to clear pending view counts', { error: err.message });
  }
}

/**
 * Caches category tree.
 *
 * @async
 * @param {Array} categories - Category tree
 * @param {number} [ttl=3600] - TTL in seconds
 */
async function setCategoryCache(categories, ttl = 3600) {
  try {
    await redis.setex(cacheKey('categories'), ttl, JSON.stringify(categories));
  } catch (err) {
    logger.error('Failed to cache categories', { error: err.message });
  }
}

/**
 * Gets cached category tree.
 *
 * @async
 * @returns {Promise<Array|null>}
 */
async function getCategoryCache() {
  try {
    const data = await redis.get(cacheKey('categories'));
    return data ? JSON.parse(data) : null;
  } catch (err) {
    logger.error('Failed to get category cache', { error: err.message });
    return null;
  }
}

/**
 * Gracefully closes the Redis connection.
 *
 * @async
 * @returns {Promise<void>}
 */
async function closeRedis() {
  logger.info('Closing Redis connection');
  await redis.quit();
}

module.exports = {
  redis,
  cacheKey,
  getCachedVideo,
  setCachedVideo,
  invalidateVideo,
  getCachedVideoList,
  setCachedVideoList,
  invalidateVideoLists,
  setHotVideos,
  getHotVideos,
  incrementViewCount,
  getPendingViewCounts,
  clearPendingViewCounts,
  setCategoryCache,
  getCategoryCache,
  closeRedis,
};
