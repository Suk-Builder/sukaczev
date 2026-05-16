const { getRedisClient } = require('../config/redis');
const logger = require('../utils/logger');

const redis = getRedisClient();

/**
 * Rate limiter configurations per endpoint type
 */
const rateLimitConfigs = {
  search: {
    windowMs: 60000, // 1 minute
    maxRequests: 30,
    keyPrefix: 'ratelimit:search:',
  },
  suggest: {
    windowMs: 60000,
    maxRequests: 60,
    keyPrefix: 'ratelimit:suggest:',
  },
  index: {
    windowMs: 60000,
    maxRequests: 100,
    keyPrefix: 'ratelimit:index:',
  },
  default: {
    windowMs: 60000,
    maxRequests: 120,
    keyPrefix: 'ratelimit:default:',
  },
};

/**
 * Rate limiter middleware
 * @param {string} type - Rate limit type
 * @returns {Function} Express middleware
 */
const rateLimiter = (type = 'default') => {
  const config = rateLimitConfigs[type] || rateLimitConfigs.default;

  return async (req, res, next) => {
    try {
      // Skip rate limiting if no Redis connection
      if (!redis || redis.status === 'end') {
        return next();
      }

      const identifier = req.user?.id || req.ip || 'anonymous';
      const key = `${config.keyPrefix}${identifier}`;

      const current = await redis.incr(key);

      // Set expiry on first request
      if (current === 1) {
        await redis.pexpire(key, config.windowMs);
      }

      const ttl = await redis.pttl(key);

      // Set rate limit headers
      res.setHeader('X-RateLimit-Limit', config.maxRequests);
      res.setHeader('X-RateLimit-Remaining', Math.max(0, config.maxRequests - current));
      res.setHeader('X-RateLimit-Reset', Date.now() + ttl);

      if (current > config.maxRequests) {
        return res.status(429).json({
          success: false,
          message: `Rate limit exceeded. Try again in ${Math.ceil(ttl / 1000)} seconds.`,
          retryAfter: Math.ceil(ttl / 1000),
          timestamp: new Date().toISOString(),
        });
      }

      next();
    } catch (error) {
      // If Redis fails, allow the request through
      logger.error('Rate limiter error:', error.message);
      next();
    }
  };
};

module.exports = {
  rateLimiter,
  rateLimitConfigs,
};
