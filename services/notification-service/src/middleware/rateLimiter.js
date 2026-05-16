const { getRedisClient } = require('../config/redis');
const logger = require('../utils/logger');

const redis = getRedisClient();

const rateLimitConfigs = {
  list: {
    windowMs: 60000,
    maxRequests: 60,
    keyPrefix: 'ratelimit:list:',
  },
  markRead: {
    windowMs: 60000,
    maxRequests: 120,
    keyPrefix: 'ratelimit:markread:',
  },
  ws: {
    windowMs: 60000,
    maxRequests: 200,
    keyPrefix: 'ratelimit:ws:',
  },
  default: {
    windowMs: 60000,
    maxRequests: 120,
    keyPrefix: 'ratelimit:default:',
  },
};

const rateLimiter = (type = 'default') => {
  const config = rateLimitConfigs[type] || rateLimitConfigs.default;

  return async (req, res, next) => {
    try {
      if (!redis || redis.status === 'end') {
        return next();
      }

      const identifier = req.user?.id || req.ip || 'anonymous';
      const key = `${config.keyPrefix}${identifier}`;

      const current = await redis.incr(key);

      if (current === 1) {
        await redis.pexpire(key, config.windowMs);
      }

      const ttl = await redis.pttl(key);

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
      logger.error('Rate limiter error:', error.message);
      next();
    }
  };
};

module.exports = {
  rateLimiter,
  rateLimitConfigs,
};
