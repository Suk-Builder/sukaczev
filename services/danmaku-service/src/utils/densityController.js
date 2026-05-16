const { getDanmakuDensity, incrementDanmakuDensity } = require('../config/redis');
const Danmaku = require('../models/danmaku');
const logger = require('./logger');

class DensityController {
  constructor() {
    this.maxDensity = parseInt(process.env.DANMAKU_DENSITY_LIMIT, 10) || 10;
    this.timeWindow = 1; // 1 second window
    this.localCache = new Map();
    this.lastCleanup = Date.now();
    this.cleanupInterval = 60000; // 1 minute
  }

  /**
   * Check if a danmaku can be sent at the given time point
   * Uses Redis for distributed rate limiting and local cache for performance
   * @param {string} videoId - Video UUID
   * @param {number} timePoint - Time point in seconds
   * @returns {Promise<boolean>} Whether the danmaku is allowed
   */
  async checkDensity(videoId, timePoint) {
    try {
      // Try Redis first
      const density = await getDanmakuDensity(videoId, timePoint);

      if (density >= this.maxDensity) {
        logger.warn(`Density limit reached for video ${videoId} at ${timePoint}: ${density}/${this.maxDensity}`);
        return false;
      }

      return true;
    } catch (error) {
      logger.error('Redis density check failed, falling back to local cache:', error.message);

      // Fallback to local cache
      return this.checkLocalDensity(videoId, timePoint);
    }
  }

  /**
   * Record a danmaku at the given time point
   * @param {string} videoId - Video UUID
   * @param {number} timePoint - Time point in seconds
   */
  async recordDanmaku(videoId, timePoint) {
    try {
      await incrementDanmakuDensity(videoId, timePoint);
    } catch (error) {
      logger.error('Failed to record danmaku density in Redis:', error.message);
      this.recordLocalDensity(videoId, timePoint);
    }

    this.cleanupIfNeeded();
  }

  /**
   * Check density using local cache (fallback)
   * @param {string} videoId - Video UUID
   * @param {number} timePoint - Time point in seconds
   * @returns {boolean} Whether the danmaku is allowed
   */
  checkLocalDensity(videoId, timePoint) {
    const key = `${videoId}:${Math.floor(timePoint)}`;
    const count = this.localCache.get(key) || 0;

    if (count >= this.maxDensity) {
      return false;
    }

    return true;
  }

  /**
   * Record danmaku in local cache (fallback)
   * @param {string} videoId - Video UUID
   * @param {number} timePoint - Time point in seconds
   */
  recordLocalDensity(videoId, timePoint) {
    const key = `${videoId}:${Math.floor(timePoint)}`;
    const count = this.localCache.get(key) || 0;
    this.localCache.set(key, count + 1);
  }

  /**
   * Get current density for a time point
   * @param {string} videoId - Video UUID
   * @param {number} timePoint - Time point in seconds
   * @returns {Promise<number>} Current density
   */
  async getCurrentDensity(videoId, timePoint) {
    try {
      return await getDanmakuDensity(videoId, timePoint);
    } catch (error) {
      const key = `${videoId}:${Math.floor(timePoint)}`;
      return this.localCache.get(key) || 0;
    }
  }

  /**
   * Calculate dynamic speed factor based on density
   * Higher density = faster animation to clear the screen
   * @param {number} density - Current density
   * @returns {number} Speed factor (1.0 = normal)
   */
  calculateSpeedFactor(density) {
    if (density <= 5) return 1.0;
    if (density <= 10) return 1.2;
    if (density <= 20) return 1.5;
    if (density <= 30) return 2.0;
    return 2.5;
  }

  /**
   * Calculate flight duration for a danmaku based on video and density context
   * @param {number} density - Current density
   * @param {number} videoDuration - Total video duration in seconds
   * @param {number} baseDuration - Base flight duration in ms
   * @returns {number} Flight duration in milliseconds
   */
  calculateFlightDuration(density, videoDuration = 300, baseDuration = 8000) {
    const speedFactor = this.calculateSpeedFactor(density);
    const durationFactor = Math.min(videoDuration / 300, 1.5);
    return Math.round(baseDuration / (speedFactor * durationFactor));
  }

  /**
   * Get density statistics for a video
   * @param {string} videoId - Video UUID
   * @param {number} duration - Video duration
   * @returns {Promise<Object>} Density statistics
   */
  async getDensityStats(videoId, duration = 600) {
    const distribution = await Danmaku.getTimeDistribution(videoId, 30);

    let maxDensity = 0;
    let maxDensityTime = 0;
    let totalDensity = 0;

    distribution.forEach(d => {
      totalDensity += d.count;
      if (d.count > maxDensity) {
        maxDensity = d.count;
        maxDensityTime = d.timeBucket;
      }
    });

    const avgDensity = distribution.length > 0 ? totalDensity / distribution.length : 0;

    return {
      videoId,
      maxDensity,
      maxDensityTime,
      averageDensity: Math.round(avgDensity * 100) / 100,
      totalDanmakus: totalDensity,
      distribution,
      densityLimit: this.maxDensity
    };
  }

  /**
   * Clean up old local cache entries
   */
  cleanupIfNeeded() {
    const now = Date.now();
    if (now - this.lastCleanup < this.cleanupInterval) {
      return;
    }

    this.lastCleanup = now;
    const keysToDelete = [];

    this.localCache.forEach((value, key) => {
      // Remove entries older than 1 hour
      const [, timeBucket] = key.split(':');
      const bucketTime = parseInt(timeBucket, 10) * 1000;
      if (now - bucketTime > 3600000) {
        keysToDelete.push(key);
      }
    });

    keysToDelete.forEach(key => this.localCache.delete(key));

    if (keysToDelete.length > 0) {
      logger.debug(`Cleaned up ${keysToDelete.length} local density cache entries`);
    }
  }

  /**
   * Reset density data for a video
   * @param {string} videoId - Video UUID
   */
  async resetDensity(videoId) {
    const Redis = require('../config/redis');
    await Redis.clearDanmakuCache(videoId);
    logger.info(`Density data reset for video ${videoId}`);
  }

  /**
   * Check if user has exceeded rate limit
   * @param {string} userId - User ID
   * @param {string} videoId - Video ID
   * @returns {Promise<boolean>} Whether user is rate limited
   */
  async checkUserRateLimit(userId, videoId) {
    const { getRedis } = require('../config/redis');
    const redis = getRedis();
    const key = `danmaku:ratelimit:${userId}:${videoId}`;
    const windowSeconds = 5; // 5 second window
    const maxPerWindow = 3; // max 3 danmakus per window

    try {
      const current = await redis.get(key);
      if (current && parseInt(current, 10) >= maxPerWindow) {
        return false; // Rate limited
      }

      const pipeline = redis.pipeline();
      pipeline.incr(key);
      pipeline.expire(key, windowSeconds);
      await pipeline.exec();

      return true; // Not rate limited
    } catch (error) {
      logger.error('Rate limit check failed:', error.message);
      return true; // Allow on error
    }
  }
}

module.exports = new DensityController();
