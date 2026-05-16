/**
 * @fileoverview Redis client configuration for caching and session storage.
 * Uses ioredis for Redis connection management in user-service.
 */

const Redis = require('ioredis');
const logger = require('../services/loggerService');

/**
 * Redis client instance for caching user data.
 * Configured via environment variables with sensible defaults.
 */
const redis = new Redis({
  host: process.env.REDIS_HOST || 'localhost',
  port: parseInt(process.env.REDIS_PORT || '6379', 10),
  password: process.env.REDIS_PASSWORD || undefined,
  db: parseInt(process.env.REDIS_DB || '0', 10),
  maxRetriesPerRequest: 3,
  enableReadyCheck: true,
  lazyConnect: true,
});

/**
 * Event listener for Redis connection ready state.
 */
redis.on('ready', () => {
  logger.info('Redis client connected and ready');
});

/**
 * Event listener for Redis connection errors.
 * Logs errors but allows application to continue functioning.
 */
redis.on('error', (err) => {
  logger.error('Redis connection error', { error: err.message });
});

/**
 * Event listener for Redis reconnection.
 */
redis.on('reconnecting', () => {
  logger.warn('Redis client reconnecting');
});

/**
 * Event listener for Redis close event.
 */
redis.on('close', () => {
  logger.warn('Redis connection closed');
});

/**
 * Cache key prefix for user-service to avoid key collisions.
 */
const KEY_PREFIX = 'user_svc:';

/**
 * Generates a cache key with service prefix.
 *
 * @param {string} key - Base cache key
 * @returns {string} Prefixed cache key
 */
function cacheKey(key) {
  return `${KEY_PREFIX}${key}`;
}

/**
 * Gets cached user data by user ID.
 *
 * @async
 * @param {string} userId - User UUID
 * @returns {Promise<Object|null>} Parsed user object or null
 */
async function getCachedUser(userId) {
  try {
    const data = await redis.get(cacheKey(`user:${userId}`));
    return data ? JSON.parse(data) : null;
  } catch (err) {
    logger.error('Failed to get cached user', { userId, error: err.message });
    return null;
  }
}

/**
 * Caches user data with TTL.
 *
 * @async
 * @param {string} userId - User UUID
 * @param {Object} userData - User data object
 * @param {number} [ttl=3600] - Time to live in seconds (default 1 hour)
 * @returns {Promise<void>}
 */
async function setCachedUser(userId, userData, ttl = 3600) {
  try {
    await redis.setex(cacheKey(`user:${userId}`), ttl, JSON.stringify(userData));
  } catch (err) {
    logger.error('Failed to cache user', { userId, error: err.message });
  }
}

/**
 * Invalidates cached user data.
 *
 * @async
 * @param {string} userId - User UUID
 * @returns {Promise<void>}
 */
async function invalidateUser(userId) {
  try {
    await redis.del(cacheKey(`user:${userId}`));
    logger.debug('User cache invalidated', { userId });
  } catch (err) {
    logger.error('Failed to invalidate user cache', { userId, error: err.message });
  }
}

/**
 * Invalidates multiple user caches.
 *
 * @async
 * @param {string[]} userIds - Array of user UUIDs
 * @returns {Promise<void>}
 */
async function invalidateUsers(userIds) {
  try {
    const keys = userIds.map((id) => cacheKey(`user:${id}`));
    if (keys.length > 0) {
      await redis.del(...keys);
    }
  } catch (err) {
    logger.error('Failed to invalidate users cache', { error: err.message });
  }
}

/**
 * Stores a blacklist token (for revoked JWTs).
 *
 * @async
 * @param {string} token - JWT token
 * @param {number} expiresIn - Expiration time in seconds
 * @returns {Promise<void>}
 */
async function blacklistToken(token, expiresIn) {
  try {
    const jti = token.substring(token.lastIndexOf('.') - 10, token.lastIndexOf('.'));
    await redis.setex(cacheKey(`blacklist:${jti}`), expiresIn, '1');
  } catch (err) {
    logger.error('Failed to blacklist token', { error: err.message });
  }
}

/**
 * Checks if a token is blacklisted.
 *
 * @async
 * @param {string} token - JWT token
 * @returns {Promise<boolean>} True if blacklisted
 */
async function isTokenBlacklisted(token) {
  try {
    const jti = token.substring(token.lastIndexOf('.') - 10, token.lastIndexOf('.'));
    const result = await redis.get(cacheKey(`blacklist:${jti}`));
    return result !== null;
  } catch (err) {
    logger.error('Failed to check token blacklist', { error: err.message });
    return false;
  }
}

/**
 * Caches paginated follower list for a user.
 *
 * @async
 * @param {string} userId - User UUID
 * @param {number} page - Page number
 * @param {Object} data - Followers data
 * @param {number} [ttl=300] - Cache TTL in seconds
 * @returns {Promise<void>}
 */
async function setCachedFollowers(userId, page, data, ttl = 300) {
  try {
    await redis.setex(cacheKey(`followers:${userId}:${page}`), ttl, JSON.stringify(data));
  } catch (err) {
    logger.error('Failed to cache followers', { userId, error: err.message });
  }
}

/**
 * Gets cached followers list.
 *
 * @async
 * @param {string} userId - User UUID
 * @param {number} page - Page number
 * @returns {Promise<Object|null>} Cached followers data
 */
async function getCachedFollowers(userId, page) {
  try {
    const data = await redis.get(cacheKey(`followers:${userId}:${page}`));
    return data ? JSON.parse(data) : null;
  } catch (err) {
    logger.error('Failed to get cached followers', { userId, error: err.message });
    return null;
  }
}

/**
 * Caches paginated following list for a user.
 *
 * @async
 * @param {string} userId - User UUID
 * @param {number} page - Page number
 * @param {Object} data - Following data
 * @param {number} [ttl=300] - Cache TTL in seconds
 * @returns {Promise<void>}
 */
async function setCachedFollowing(userId, page, data, ttl = 300) {
  try {
    await redis.setex(cacheKey(`following:${userId}:${page}`), ttl, JSON.stringify(data));
  } catch (err) {
    logger.error('Failed to cache following', { userId, error: err.message });
  }
}

/**
 * Gets cached following list.
 *
 * @async
 * @param {string} userId - User UUID
 * @param {number} page - Page number
 * @returns {Promise<Object|null>} Cached following data
 */
async function getCachedFollowing(userId, page) {
  try {
    const data = await redis.get(cacheKey(`following:${userId}:${page}`));
    return data ? JSON.parse(data) : null;
  } catch (err) {
    logger.error('Failed to get cached following', { userId, error: err.message });
    return null;
  }
}

/**
 * Invalidates follower/following caches for a user.
 *
 * @async
 * @param {string} userId - User UUID
 * @returns {Promise<void>}
 */
async function invalidateFollowCaches(userId) {
  try {
    const followerKeys = await redis.keys(cacheKey(`followers:${userId}:*`));
    const followingKeys = await redis.keys(cacheKey(`following:${userId}:*`));
    const allKeys = [...followerKeys, ...followingKeys];
    if (allKeys.length > 0) {
      await redis.del(...allKeys);
    }
  } catch (err) {
    logger.error('Failed to invalidate follow caches', { userId, error: err.message });
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
  getCachedUser,
  setCachedUser,
  invalidateUser,
  invalidateUsers,
  blacklistToken,
  isTokenBlacklisted,
  setCachedFollowers,
  getCachedFollowers,
  setCachedFollowing,
  getCachedFollowing,
  invalidateFollowCaches,
  closeRedis,
};
