const { Op } = require('sequelize');
const { Notification } = require('../models/notification');
const { getRedisClient } = require('../config/redis');
const config = require('../config');
const logger = require('../utils/logger');

class NotificationService {
  constructor() {
    this.redis = getRedisClient();
    this.aggregationCache = new Map(); // userId:resourceId:resourceType -> { count, timer }
  }

  /**
   * Get notification list for a user
   * @param {string} userId - User ID
   * @param {Object} options - Query options
   * @returns {Promise<Object>} - Paginated notifications
   */
  async getNotifications(userId, options = {}) {
    const {
      page = 1,
      pageSize = config.notification.pageSize,
      type,
      isRead,
    } = options;

    const limit = Math.min(parseInt(pageSize, 10), config.notification.maxPageSize);
    const offset = (Math.max(1, parseInt(page, 10)) - 1) * limit;

    const where = { userId };
    if (type) {
      where.type = type;
    }
    if (isRead !== undefined && isRead !== null && isRead !== '') {
      where.isRead = isRead === 'true' || isRead === true;
    }

    const { count, rows } = await Notification.findAndCountAll({
      where,
      order: [['created_at', 'DESC']],
      limit,
      offset,
    });

    return {
      notifications: rows.map((n) => n.toJSON()),
      total: count,
      page: parseInt(page, 10),
      pageSize: limit,
      totalPages: Math.ceil(count / limit),
      hasNext: offset + limit < count,
      hasPrev: offset > 0,
    };
  }

  /**
   * Get unread notification count for a user
   * @param {string} userId - User ID
   * @returns {Promise<number>} - Unread count
   */
  async getUnreadCount(userId) {
    // Try cache first
    try {
      const redisKey = `unread:${userId}`;
      const cached = await this.redis.get(redisKey);
      if (cached !== null) {
        return parseInt(cached, 10);
      }
    } catch (error) {
      logger.error('Redis get unread count error:', error.message);
    }

    // Count from database
    const count = await Notification.count({
      where: {
        userId,
        isRead: false,
      },
    });

    // Cache the count
    try {
      const redisKey = `unread:${userId}`;
      await this.redis.setex(redisKey, config.notification.unreadCacheTtl, count.toString());
    } catch (error) {
      logger.error('Redis cache unread count error:', error.message);
    }

    return count;
  }

  /**
   * Create a new notification
   * @param {Object} data - Notification data
   * @returns {Promise<Notification>} - Created notification
   */
  async createNotification(data) {
    const {
      userId,
      type,
      senderId,
      resourceId,
      resourceType,
      content,
      metadata = {},
    } = data;

    const notification = await Notification.create({
      userId,
      type,
      senderId,
      resourceId,
      resourceType,
      content,
      metadata,
      isRead: false,
      aggregatedCount: 1,
      aggregatedIds: [],
    });

    // Invalidate unread count cache
    await this._invalidateUnreadCache(userId);

    logger.info(`Notification created: ${notification.id} for user ${userId}`);

    return notification;
  }

  /**
   * Create notification with aggregation support
   * @param {Object} data - Notification data
   * @returns {Promise<Notification|null>} - Created or aggregated notification
   */
  async createWithAggregation(data) {
    const { userId, type, resourceId, resourceType, senderId } = data;

    // Aggregation only applies to certain types
    const aggregatableTypes = ['video_like', 'comment_reply', 'coin_received'];
    if (!aggregatableTypes.includes(type) || !resourceId || !resourceType) {
      return this.createNotification(data);
    }

    // Check for recent similar notification
    const cacheKey = `${userId}:${resourceId}:${resourceType}:${type}`;
    const existing = this.aggregationCache.get(cacheKey);

    if (existing) {
      // Update existing aggregation
      existing.count++;
      clearTimeout(existing.timer);

      // Update the database notification
      try {
        const notification = await Notification.findByPk(existing.notificationId);
        if (notification) {
          notification.aggregatedCount = existing.count;
          if (senderId && !notification.aggregatedIds.includes(senderId)) {
            notification.aggregatedIds = [...notification.aggregatedIds, senderId];
          }
          notification.content = this._generateAggregatedContent(notification);
          await notification.save();

          // Reset aggregation timer
          existing.timer = this._createAggregationTimer(cacheKey, existing.notificationId);
          this.aggregationCache.set(cacheKey, existing);

          await this._invalidateUnreadCache(userId);

          return notification;
        }
      } catch (error) {
        logger.error('Aggregation update error:', error.message);
      }
    }

    // Create new notification
    const notification = await this.createNotification(data);

    // Start aggregation window
    const timer = this._createAggregationTimer(cacheKey, notification.id);
    this.aggregationCache.set(cacheKey, {
      count: 1,
      notificationId: notification.id,
      timer,
    });

    return notification;
  }

  /**
   * Mark a notification as read
   * @param {string} notificationId - Notification ID
   * @param {string} userId - User ID (for security)
   * @returns {Promise<Notification>} - Updated notification
   */
  async markAsRead(notificationId, userId) {
    const notification = await Notification.findOne({
      where: {
        id: notificationId,
        userId,
      },
    });

    if (!notification) {
      throw new Error('Notification not found');
    }

    if (notification.isRead) {
      return notification;
    }

    await notification.markAsRead();

    // Invalidate unread cache
    await this._invalidateUnreadCache(userId);

    return notification;
  }

  /**
   * Mark all notifications as read for a user
   * @param {string} userId - User ID
   * @returns {Promise<number>} - Number of notifications marked as read
   */
  async markAllAsRead(userId) {
    const [count] = await Notification.update(
      {
        isRead: true,
        readAt: new Date(),
      },
      {
        where: {
          userId,
          isRead: false,
        },
      }
    );

    // Invalidate unread cache
    await this._invalidateUnreadCache(userId);

    logger.info(`Marked ${count} notifications as read for user ${userId}`);

    return count;
  }

  /**
   * Delete a notification
   * @param {string} notificationId - Notification ID
   * @param {string} userId - User ID
   * @returns {Promise<boolean>} - Success status
   */
  async deleteNotification(notificationId, userId) {
    const notification = await Notification.findOne({
      where: {
        id: notificationId,
        userId,
      },
    });

    if (!notification) {
      throw new Error('Notification not found');
    }

    await notification.destroy();

    // If notification was unread, invalidate cache
    if (!notification.isRead) {
      await this._invalidateUnreadCache(userId);
    }

    logger.info(`Notification deleted: ${notificationId}`);

    return true;
  }

  /**
   * Get notification by ID
   * @param {string} notificationId - Notification ID
   * @param {string} userId - User ID
   * @returns {Promise<Notification|null>}
   */
  async getNotificationById(notificationId, userId) {
    return Notification.findOne({
      where: {
        id: notificationId,
        userId,
      },
    });
  }

  /**
   * Get recent notifications for WebSocket push
   * @param {string} userId - User ID
   * @param {number} limit - Number of notifications
   * @returns {Promise<Array>}
   */
  async getRecentNotifications(userId, limit = 10) {
    const notifications = await Notification.findAll({
      where: { userId },
      order: [['created_at', 'DESC']],
      limit,
    });

    return notifications.map((n) => n.toJSON());
  }

  /**
   * Clean up old read notifications
   * @param {number} days - Age threshold in days
   * @returns {Promise<number>} - Number of deleted notifications
   */
  async cleanupOldNotifications(days = 30) {
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - days);

    const count = await Notification.destroy({
      where: {
        isRead: true,
        createdAt: {
          [Op.lt]: cutoffDate,
        },
      },
    });

    logger.info(`Cleaned up ${count} old notifications`);
    return count;
  }

  /**
   * Generate aggregated content based on notification type
   */
  _generateAggregatedContent(notification) {
    const { type, aggregatedCount, metadata } = notification;
    const senderName = metadata?.senderName || 'Someone';

    switch (type) {
      case 'video_like':
        return `${senderName} and ${aggregatedCount - 1} others liked your video "${metadata?.resourceTitle || ''}"`;
      case 'comment_reply':
        return `${aggregatedCount} people replied to your comment`;
      case 'coin_received':
        return `You received ${aggregatedCount} coins from ${senderName}`;
      default:
        return notification.content;
    }
  }

  /**
   * Create aggregation timer
   */
  _createAggregationTimer(cacheKey, notificationId) {
    return setTimeout(() => {
      this.aggregationCache.delete(cacheKey);
      logger.debug(`Aggregation window closed for ${notificationId}`);
    }, config.notification.aggregationWindowMs);
  }

  /**
   * Invalidate unread count cache
   */
  async _invalidateUnreadCache(userId) {
    try {
      const redisKey = `unread:${userId}`;
      await this.redis.del(redisKey);
    } catch (error) {
      logger.error('Cache invalidation error:', error.message);
    }
  }

  /**
   * Update unread cache with new count
   */
  async updateUnreadCache(userId) {
    try {
      const count = await Notification.count({
        where: { userId, isRead: false },
      });

      const redisKey = `unread:${userId}`;
      await this.redis.setex(redisKey, config.notification.unreadCacheTtl, count.toString());

      return count;
    } catch (error) {
      logger.error('Update unread cache error:', error.message);
      return 0;
    }
  }
}

// Export singleton
let instance = null;
const getNotificationService = () => {
  if (!instance) {
    instance = new NotificationService();
  }
  return instance;
};

module.exports = {
  NotificationService,
  getNotificationService,
};
