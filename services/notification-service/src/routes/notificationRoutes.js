const express = require('express');
const {
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
} = require('../controllers/notificationController');
const { authenticate, requireAuth, requireRole } = require('../middleware/auth');
const { rateLimiter } = require('../middleware/rateLimiter');

const router = express.Router();

// All notification routes require authentication
router.use(authenticate);
router.use(requireAuth);

// Notification list and count
router.get('/notifications', rateLimiter('list'), listValidation, getNotifications);
router.get('/notifications/unread-count', getUnreadCount);
router.get('/notifications/recent', getRecent);

// Single notification operations
router.get('/notifications/:id', idValidation, getNotification);
router.put('/notifications/:id/read', idValidation, markAsRead);
router.delete('/notifications/:id', idValidation, deleteNotification);

// Bulk operations
router.put('/notifications/read-all', markAllAsRead);

// Admin/internal endpoints
router.post('/notifications', requireRole('admin', 'system'), createValidation, createNotification);
router.delete('/notifications/admin/cleanup', requireRole('admin'), cleanupOld);

module.exports = router;
