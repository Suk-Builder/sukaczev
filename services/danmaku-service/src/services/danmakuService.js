const Danmaku = require('../models/danmaku');
const {
  cacheDanmaku,
  getCachedDanmaku,
  clearDanmakuCache
} = require('../config/redis');
const densityController = require('../utils/densityController');
const sensitiveWordFilter = require('../utils/sensitiveWordFilter');
const logger = require('../utils/logger');
const { DanmakuError } = require('../middleware/errorHandler');

class DanmakuService {
  /**
   * Create and persist a new danmaku
   * @param {Object} data - Danmaku data
   * @returns {Promise<Object>} Created danmaku
   */
  async createDanmaku(data) {
    const {
      videoId,
      userId,
      content,
      timePoint,
      color = '#FFFFFF',
      type = 0,
      fontSize = 25
    } = data;

    // Validate content
    const validation = sensitiveWordFilter.validateContent(content);
    if (!validation.valid) {
      throw new DanmakuError(validation.error, 400, 'VALIDATION_ERROR');
    }

    const finalContent = validation.filtered ? validation.content : content;

    // Check density
    const densityAllowed = await densityController.checkDensity(videoId, timePoint);
    if (!densityAllowed) {
      throw new DanmakuError(
        'Too many danmakus at this time point. Please try again later.',
        429,
        'DENSITY_LIMIT'
      );
    }

    // Check user rate limit
    const rateLimitAllowed = await densityController.checkUserRateLimit(userId, videoId);
    if (!rateLimitAllowed) {
      throw new DanmakuError(
        'You are sending danmakus too fast. Please slow down.',
        429,
        'RATE_LIMIT'
      );
    }

    try {
      // Create in database
      const danmaku = await Danmaku.create({
        videoId,
        userId,
        content: finalContent,
        timePoint,
        color,
        type,
        fontSize
      });

      // Cache in Redis
      await cacheDanmaku(videoId, danmaku);

      // Record density
      await densityController.recordDanmaku(videoId, timePoint);

      logger.info(`Danmaku created: ${danmaku.id} for video ${videoId} at ${timePoint}s`);

      return {
        ...danmaku,
        filtered: validation.filtered || false,
        matchedWords: validation.matchedWords || []
      };
    } catch (error) {
      logger.error('Failed to create danmaku:', error);
      throw new DanmakuError('Failed to create danmaku', 500, 'CREATE_ERROR');
    }
  }

  /**
   * Get danmakus for a video in a time range
   * Uses cache-first strategy with PostgreSQL fallback
   * @param {string} videoId - Video UUID
   * @param {number} startTime - Start time in seconds
   * @param {number} endTime - End time in seconds
   * @param {Object} options - Query options
   * @returns {Promise<Object>} Danmakus and metadata
   */
  async getDanmakusByTimeRange(videoId, startTime, endTime, options = {}) {
    const { limit = 500, offset = 0 } = options;

    // Validate range
    if (endTime < startTime) {
      throw new DanmakuError('endTime must be greater than startTime', 400, 'VALIDATION_ERROR');
    }

    const maxRange = 3600; // 1 hour max
    if (endTime - startTime > maxRange) {
      throw new DanmakuError(
        `Time range exceeds maximum of ${maxRange} seconds`,
        400,
        'VALIDATION_ERROR'
      );
    }

    try {
      // Try cache for very recent requests
      let danmakus = [];
      const isRecentRange = endTime - startTime <= 60;

      if (isRecentRange && offset === 0) {
        const cached = await getCachedDanmaku(videoId, limit);
        if (cached.length > 0) {
          danmakus = cached.filter(d =>
            d.timePoint >= startTime && d.timePoint <= endTime
          );
        }
      }

      // If cache miss or incomplete, query database
      if (danmakus.length === 0 || danmakus.length < limit) {
        danmakus = await Danmaku.findByVideoAndTimeRange(videoId, startTime, endTime, {
          limit,
          offset,
          orderBy: 'time_point ASC, created_at ASC'
        });
      }

      const total = await Danmaku.countByVideoId(videoId);

      return {
        danmakus,
        meta: {
          videoId,
          startTime,
          endTime,
          count: danmakus.length,
          total,
          limit,
          offset
        }
      };
    } catch (error) {
      if (error instanceof DanmakuError) throw error;
      logger.error('Failed to get danmakus:', error);
      throw new DanmakuError('Failed to retrieve danmakus', 500, 'RETRIEVE_ERROR');
    }
  }

  /**
   * Get danmaku statistics for a video
   * @param {string} videoId - Video UUID
   * @returns {Promise<Object>} Statistics
   */
  async getVideoStats(videoId) {
    try {
      const stats = await Danmaku.getStats(videoId);
      const density = await densityController.getDensityStats(videoId);

      return {
        ...stats,
        density
      };
    } catch (error) {
      logger.error('Failed to get video stats:', error);
      throw new DanmakuError('Failed to retrieve statistics', 500, 'STATS_ERROR');
    }
  }

  /**
   * Get all danmakus for a video (admin/debug)
   * @param {string} videoId - Video UUID
   * @param {Object} options - Query options
   * @returns {Promise<Array>} Danmakus
   */
  async getDanmakusByVideo(videoId, options = {}) {
    try {
      return await Danmaku.findByVideoId(videoId, options);
    } catch (error) {
      logger.error('Failed to get danmakus by video:', error);
      throw new DanmakuError('Failed to retrieve danmakus', 500, 'RETRIEVE_ERROR');
    }
  }

  /**
   * Delete all danmakus for a video (admin)
   * @param {string} videoId - Video UUID
   * @returns {Promise<number>} Number deleted
   */
  async deleteDanmakusByVideo(videoId) {
    try {
      const count = await Danmaku.deleteByVideoId(videoId);
      await clearDanmakuCache(videoId);
      logger.info(`Deleted ${count} danmakus for video ${videoId}`);
      return count;
    } catch (error) {
      logger.error('Failed to delete danmakus:', error);
      throw new DanmakuError('Failed to delete danmakus', 500, 'DELETE_ERROR');
    }
  }

  /**
   * Get recent danmakus across all videos
   * @param {number} limit - Number to retrieve
   * @returns {Promise<Array>} Recent danmakus
   */
  async getRecentDanmakus(limit = 100) {
    try {
      return await Danmaku.findRecent(limit);
    } catch (error) {
      logger.error('Failed to get recent danmakus:', error);
      throw new DanmakuError('Failed to retrieve recent danmakus', 500, 'RETRIEVE_ERROR');
    }
  }

  /**
   * Get user's danmaku history
   * @param {string} userId - User UUID
   * @param {Object} options - Query options
   * @returns {Promise<Array>} User's danmaku history
   */
  async getUserDanmakuHistory(userId, options = {}) {
    try {
      return await Danmaku.findByUserId(userId, options);
    } catch (error) {
      logger.error('Failed to get user danmaku history:', error);
      throw new DanmakuError('Failed to retrieve user history', 500, 'RETRIEVE_ERROR');
    }
  }

  /**
   * Get danmaku density information for a video
   * @param {string} videoId - Video UUID
   * @param {number} duration - Video duration
   * @returns {Promise<Object>} Density info
   */
  async getDensityInfo(videoId, duration) {
    try {
      return await densityController.getDensityStats(videoId, duration);
    } catch (error) {
      logger.error('Failed to get density info:', error);
      throw new DanmakuError('Failed to retrieve density info', 500, 'RETRIEVE_ERROR');
    }
  }

  /**
   * Calculate flight speed for a danmaku
   * @param {string} videoId - Video UUID
   * @param {number} timePoint - Time point
   * @param {number} videoDuration - Video duration
   * @returns {Promise<Object>} Speed info
   */
  async calculateFlightSpeed(videoId, timePoint, videoDuration = 300) {
    try {
      const density = await densityController.getCurrentDensity(videoId, timePoint);
      const duration = densityController.calculateFlightDuration(density, videoDuration);
      const speedFactor = densityController.calculateSpeedFactor(density);

      return {
        density,
        flightDuration: duration,
        speedFactor,
        videoDuration
      };
    } catch (error) {
      logger.error('Failed to calculate flight speed:', error);
      // Return defaults on error
      return {
        density: 0,
        flightDuration: 8000,
        speedFactor: 1.0,
        videoDuration
      };
    }
  }
}

module.exports = new DanmakuService();
