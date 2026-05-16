const rateLimit = require('express-rate-limit');
const logger = require('../utils/logger');

/**
 * Create a rate limiter middleware with custom options
 * @param {Object} options - Rate limiter options
 * @returns {Function} Express middleware
 */
function createRateLimiter(options = {}) {
  const {
    windowMs = 60000, // 1 minute
    max = 100, // 100 requests per window
    message = 'Too many requests, please try again later',
    keyGenerator = (req) => req.ip,
    skipSuccessfulRequests = false
  } = options;

  return rateLimit({
    windowMs,
    max,
    message: {
      error: {
        message,
        code: 'RATE_LIMIT_EXCEEDED',
        status: 429
      }
    },
    standardHeaders: true,
    legacyHeaders: false,
    keyGenerator,
    skipSuccessfulRequests,
    handler: (req, res, next, options) => {
      logger.warn(`Rate limit exceeded for IP: ${req.ip}`);
      res.status(429).json(options.message);
    }
  });
}

/**
 * Strict rate limiter for danmaku sending
 * Prevents spam/abuse
 */
const sendDanmakuLimiter = createRateLimiter({
  windowMs: 10000, // 10 seconds
  max: 5, // 5 danmakus per 10 seconds per IP
  message: 'Danmaku sending rate limit exceeded. Please slow down.',
  keyGenerator: (req) => {
    // Rate limit by user if available, otherwise by IP
    return req.body?.userId || req.ip;
  }
});

/**
 * Standard API rate limiter
 */
const apiLimiter = createRateLimiter({
  windowMs: 60000, // 1 minute
  max: 300, // 300 requests per minute
  message: 'API rate limit exceeded'
});

/**
 * WebSocket rate limiter (in-memory, per socket)
 * Returns true if allowed, false if rate limited
 */
class WebSocketRateLimiter {
  constructor(options = {}) {
    this.windowMs = options.windowMs || 5000; // 5 seconds
    this.max = options.max || 3; // 3 messages per window
    this.clients = new Map();
    this.cleanupInterval = setInterval(() => this.cleanup(), 60000);
  }

  /**
   * Check if a socket is allowed to send
   * @param {string} socketId - Socket ID
   * @returns {boolean} Whether the request is allowed
   */
  isAllowed(socketId) {
    const now = Date.now();
    const clientData = this.clients.get(socketId);

    if (!clientData) {
      this.clients.set(socketId, { count: 1, resetTime: now + this.windowMs });
      return true;
    }

    if (now > clientData.resetTime) {
      clientData.count = 1;
      clientData.resetTime = now + this.windowMs;
      return true;
    }

    if (clientData.count >= this.max) {
      logger.warn(`WebSocket rate limit exceeded for socket: ${socketId}`);
      return false;
    }

    clientData.count++;
    return true;
  }

  /**
   * Remove a socket from tracking
   * @param {string} socketId - Socket ID
   */
  removeSocket(socketId) {
    this.clients.delete(socketId);
  }

  /**
   * Clean up expired entries
   */
  cleanup() {
    const now = Date.now();
    let cleaned = 0;

    for (const [socketId, data] of this.clients.entries()) {
      if (now > data.resetTime + this.windowMs) {
        this.clients.delete(socketId);
        cleaned++;
      }
    }

    if (cleaned > 0) {
      logger.debug(`Cleaned up ${cleaned} expired rate limit entries`);
    }
  }

  /**
   * Stop the cleanup interval
   */
  stop() {
    clearInterval(this.cleanupInterval);
    this.clients.clear();
  }
}

// Singleton instance for global WS rate limiting
const wsRateLimiter = new WebSocketRateLimiter();

module.exports = {
  createRateLimiter,
  sendDanmakuLimiter,
  apiLimiter,
  WebSocketRateLimiter,
  wsRateLimiter
};
