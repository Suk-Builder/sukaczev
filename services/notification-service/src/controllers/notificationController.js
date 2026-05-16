const { validationResult, query: queryValidator, param, body } = require('express-validator');
const { getNotificationService } = require('../services/notificationService');
const logger = require('../utils/logger');

const notificationService = getNotificationService();

// Validation rules
const listValidation = [
  queryValidator('page')
    .optional()
    .isInt({ min: 1, max: 1000 })
    .withMessage('Page must be between 1 and 1000'),
  queryValidator('pageSize')
    .optional()
    .isInt({ min: 1, max: 100 })
    .withMessage('Page size must be between 1 and 100'),
  queryValidator('type')
    .optional()
    .isIn(['comment_reply', 'video_like', 'new_follower', 'system', 'coin_received'])
    .withMessage('Invalid notification type'),
  queryValidator('isRead')
    .optional()
    .isBoolean()
    .withMessage('isRead must be boolean'),
];

const idValidation = [
  param('id')
    .isUUID(4)
    .withMessage('Invalid notification ID'),
];

const createValidation = [
  body('userId')
    .notEmpty()
    .withMessage('userId is required'),
  body('type')
    .isIn(['comment_reply', 'video_like', 'new_follower', 'system', 'coin_received'])
    .withMessage('Invalid notification type'),
  body('content')
    .notEmpty()
    .isLength({ max: 2000 })
    .withMessage('Content is required and must be at most 2000 characters'),
];

/**
 * Get notification list
 */
const getNotifications = async (req, res, next) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        message: 'Validation failed',
        errors: errors.array(),
        timestamp: new Date().toISOString(),
      });
    }

    const userId = req.user.id;
    const result = await notificationService.getNotifications(userId, req.query);

    res.json({
      success: true,
      data: result.notifications,
      pagination: {
        page: result.page,
        pageSize: result.pageSize,
        total: result.total,
        totalPages: result.totalPages,
        hasNext: result.hasNext,
        hasPrev: result.hasPrev,
      },
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    logger.error('Get notifications error:', error.message);
    next(error);
  }
};

/**
 * Get unread notification count
 */
const getUnreadCount = async (req, res, next) => {
  try {
    const userId = req.user.id;
    const count = await notificationService.getUnreadCount(userId);

    res.json({
      success: true,
      data: { count },
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    logger.error('Get unread count error:', error.message);
    next(error);
  }
};

/**
 * Mark notification as read
 */
const markAsRead = async (req, res, next) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        message: 'Validation failed',
        errors: errors.array(),
        timestamp: new Date().toISOString(),
      });
    }

    const { id } = req.params;
    const userId = req.user.id;

    const notification = await notificationService.markAsRead(id, userId);

    res.json({
      success: true,
      data: notification.toJSON(),
      message: 'Notification marked as read',
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    if (error.message === 'Notification not found') {
      return res.status(404).json({
        success: false,
        message: 'Notification not found',
        timestamp: new Date().toISOString(),
      });
    }
    logger.error('Mark as read error:', error.message);
    next(error);
  }
};

/**
 * Mark all notifications as read
 */
const markAllAsRead = async (req, res, next) => {
  try {
    const userId = req.user.id;
    const count = await notificationService.markAllAsRead(userId);

    res.json({
      success: true,
      data: { markedCount: count },
      message: `${count} notification(s) marked as read`,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    logger.error('Mark all as read error:', error.message);
    next(error);
  }
};

/**
 * Delete a notification
 */
const deleteNotification = async (req, res, next) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        message: 'Validation failed',
        errors: errors.array(),
        timestamp: new Date().toISOString(),
      });
    }

    const { id } = req.params;
    const userId = req.user.id;

    await notificationService.deleteNotification(id, userId);

    res.json({
      success: true,
      message: 'Notification deleted',
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    if (error.message === 'Notification not found') {
      return res.status(404).json({
        success: false,
        message: 'Notification not found',
        timestamp: new Date().toISOString(),
      });
    }
    logger.error('Delete notification error:', error.message);
    next(error);
  }
};

/**
 * Get a single notification by ID
 */
const getNotification = async (req, res, next) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        message: 'Validation failed',
        errors: errors.array(),
        timestamp: new Date().toISOString(),
      });
    }

    const { id } = req.params;
    const userId = req.user.id;

    const notification = await notificationService.getNotificationById(id, userId);

    if (!notification) {
      return res.status(404).json({
        success: false,
        message: 'Notification not found',
        timestamp: new Date().toISOString(),
      });
    }

    res.json({
      success: true,
      data: notification.toJSON(),
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    logger.error('Get notification error:', error.message);
    next(error);
  }
};

/**
 * Create a notification (admin/internal use)
 */
const createNotification = async (req, res, next) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        message: 'Validation failed',
        errors: errors.array(),
        timestamp: new Date().toISOString(),
      });
    }

    const {
      userId,
      type,
      senderId,
      resourceId,
      resourceType,
      content,
      metadata,
    } = req.body;

    const notification = await notificationService.createNotification({
      userId,
      type,
      senderId,
      resourceId,
      resourceType,
      content,
      metadata,
    });

    res.status(201).json({
      success: true,
      data: notification.toJSON(),
      message: 'Notification created',
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    logger.error('Create notification error:', error.message);
    next(error);
  }
};

/**
 * Get recent notifications for current user
 */
const getRecent = async (req, res, next) => {
  try {
    const userId = req.user.id;
    const limit = Math.min(parseInt(req.query.limit, 10) || 10, 50);

    const notifications = await notificationService.getRecentNotifications(userId, limit);

    res.json({
      success: true,
      data: notifications,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    logger.error('Get recent notifications error:', error.message);
    next(error);
  }
};

/**
 * Cleanup old notifications (admin only)
 */
const cleanupOld = async (req, res, next) => {
  try {
    const days = parseInt(req.query.days, 10) || 30;
    const count = await notificationService.cleanupOldNotifications(days);

    res.json({
      success: true,
      data: { deletedCount: count },
      message: `${count} old notifications cleaned up`,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    logger.error('Cleanup old notifications error:', error.message);
    next(error);
  }
};

module.exports = {
  getNotifications,
  getUnreadCount,
  markAsRead,
  markAllAsRead,
  deleteNotification,
  getNotification,
  createNotification,
  getRecent,
  cleanupOld,
  listValidation,
  idValidation,
  createValidation,
};
