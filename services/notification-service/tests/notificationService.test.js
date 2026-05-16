const { NotificationService } = require('../src/services/notificationService');
const logger = require('../src/utils/logger');

jest.mock('../src/utils/logger', () => ({
  info: jest.fn(),
  error: jest.fn(),
  warn: jest.fn(),
  debug: jest.fn(),
}));

describe('NotificationService', () => {
  let notificationService;
  let mockNotificationModel;
  let mockRedis;

  beforeEach(() => {
    jest.clearAllMocks();

    mockNotificationModel = {
      findAndCountAll: jest.fn(),
      count: jest.fn(),
      create: jest.fn(),
      findOne: jest.fn(),
      findByPk: jest.fn(),
      findAll: jest.fn(),
      update: jest.fn(),
      destroy: jest.fn(),
    };

    mockRedis = {
      get: jest.fn(),
      setex: jest.fn(),
      del: jest.fn(),
    };

    jest.spyOn(require('../src/models/notification'), 'Notification')
      .mockImplementation(() => mockNotificationModel);
    Object.setPrototypeOf(mockNotificationModel, jest.fn());
    Object.assign(require('../src/models/notification').Notification, mockNotificationModel);

    jest.spyOn(require('../src/config/redis'), 'getRedisClient').mockReturnValue(mockRedis);

    notificationService = new NotificationService();
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  describe('getNotifications', () => {
    it('should get notifications for a user', async () => {
      const mockNotifications = [
        {
          toJSON: () => ({
            id: 'notif-001',
            userId: 'user-001',
            type: 'video_like',
            content: 'Test notification',
            isRead: false,
            createdAt: '2024-01-01T00:00:00Z',
          }),
        },
      ];

      mockNotificationModel.findAndCountAll.mockResolvedValue({
        count: 1,
        rows: mockNotifications,
      });

      const result = await notificationService.getNotifications('user-001', {});

      expect(result.notifications).toHaveLength(1);
      expect(result.total).toBe(1);
      expect(result.page).toBe(1);
      expect(result.notifications[0].type).toBe('video_like');
    });

    it('should filter by type', async () => {
      mockNotificationModel.findAndCountAll.mockResolvedValue({
        count: 0,
        rows: [],
      });

      await notificationService.getNotifications('user-001', { type: 'video_like' });

      expect(mockNotificationModel.findAndCountAll).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            userId: 'user-001',
            type: 'video_like',
          }),
        })
      );
    });

    it('should filter by read status', async () => {
      mockNotificationModel.findAndCountAll.mockResolvedValue({
        count: 0,
        rows: [],
      });

      await notificationService.getNotifications('user-001', { isRead: 'false' });

      expect(mockNotificationModel.findAndCountAll).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            userId: 'user-001',
            isRead: false,
          }),
        })
      );
    });

    it('should handle pagination', async () => {
      const mockNotifications = Array.from({ length: 20 }, (_, i) => ({
        toJSON: () => ({
          id: `notif-${i}`,
          userId: 'user-001',
          type: 'video_like',
          content: `Notification ${i}`,
          isRead: false,
          createdAt: '2024-01-01T00:00:00Z',
        }),
      }));

      mockNotificationModel.findAndCountAll.mockResolvedValue({
        count: 50,
        rows: mockNotifications,
      });

      const result = await notificationService.getNotifications('user-001', { page: 1, pageSize: 20 });

      expect(result.notifications).toHaveLength(20);
      expect(result.total).toBe(50);
      expect(result.totalPages).toBe(3);
      expect(result.hasNext).toBe(true);
      expect(result.hasPrev).toBe(false);
    });

    it('should cap pageSize at max', async () => {
      mockNotificationModel.findAndCountAll.mockResolvedValue({
        count: 0,
        rows: [],
      });

      const result = await notificationService.getNotifications('user-001', { pageSize: 200 });

      expect(result.pageSize).toBeLessThanOrEqual(100);
    });

    it('should handle empty results', async () => {
      mockNotificationModel.findAndCountAll.mockResolvedValue({
        count: 0,
        rows: [],
      });

      const result = await notificationService.getNotifications('user-001', {});

      expect(result.notifications).toEqual([]);
      expect(result.total).toBe(0);
      expect(result.hasNext).toBe(false);
    });

    it('should handle boolean isRead', async () => {
      mockNotificationModel.findAndCountAll.mockResolvedValue({
        count: 0,
        rows: [],
      });

      await notificationService.getNotifications('user-001', { isRead: true });

      expect(mockNotificationModel.findAndCountAll).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            userId: 'user-001',
            isRead: true,
          }),
        })
      );
    });
  });

  describe('getUnreadCount', () => {
    it('should return cached count from Redis', async () => {
      mockRedis.get.mockResolvedValue('5');

      const result = await notificationService.getUnreadCount('user-001');

      expect(result).toBe(5);
      expect(mockRedis.get).toHaveBeenCalledWith('unread:user-001');
    });

    it('should count from DB when no cache', async () => {
      mockRedis.get.mockResolvedValue(null);
      mockNotificationModel.count.mockResolvedValue(3);

      const result = await notificationService.getUnreadCount('user-001');

      expect(result).toBe(3);
      expect(mockNotificationModel.count).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { userId: 'user-001', isRead: false },
        })
      );
    });

    it('should cache count after DB query', async () => {
      mockRedis.get.mockResolvedValue(null);
      mockNotificationModel.count.mockResolvedValue(10);

      await notificationService.getUnreadCount('user-001');

      expect(mockRedis.setex).toHaveBeenCalledWith('unread:user-001', 300, '10');
    });

    it('should handle Redis errors gracefully', async () => {
      mockRedis.get.mockRejectedValue(new Error('Redis error'));
      mockNotificationModel.count.mockResolvedValue(0);

      const result = await notificationService.getUnreadCount('user-001');

      expect(result).toBe(0);
    });

    it('should return 0 for null cached value', async () => {
      mockRedis.get.mockResolvedValue(null);
      mockNotificationModel.count.mockResolvedValue(0);

      const result = await notificationService.getUnreadCount('user-001');

      expect(result).toBe(0);
    });
  });

  describe('createNotification', () => {
    it('should create a notification', async () => {
      const mockNotification = {
        toJSON: () => ({
          id: 'notif-001',
          userId: 'user-001',
          type: 'video_like',
          content: 'Test',
          isRead: false,
        }),
      };

      mockNotificationModel.create.mockResolvedValue(mockNotification);

      const result = await notificationService.createNotification({
        userId: 'user-001',
        type: 'video_like',
        senderId: 'user-002',
        resourceId: 'vid-001',
        resourceType: 'video',
        content: 'Test notification',
        metadata: { key: 'value' },
      });

      expect(mockNotificationModel.create).toHaveBeenCalledWith(
        expect.objectContaining({
          userId: 'user-001',
          type: 'video_like',
          content: 'Test notification',
          isRead: false,
          aggregatedCount: 1,
          aggregatedIds: [],
        })
      );
    });

    it('should invalidate unread cache after creation', async () => {
      const mockNotification = {
        toJSON: () => ({ id: 'notif-001', userId: 'user-001' }),
      };

      mockNotificationModel.create.mockResolvedValue(mockNotification);

      await notificationService.createNotification({
        userId: 'user-001',
        type: 'system',
        content: 'System message',
      });

      expect(mockRedis.del).toHaveBeenCalledWith('unread:user-001');
    });

    it('should create with null senderId for system notifications', async () => {
      const mockNotification = {
        toJSON: () => ({ id: 'notif-001' }),
      };

      mockNotificationModel.create.mockResolvedValue(mockNotification);

      await notificationService.createNotification({
        userId: 'user-001',
        type: 'system',
        senderId: null,
        content: 'System notification',
      });

      expect(mockNotificationModel.create).toHaveBeenCalledWith(
        expect.objectContaining({ senderId: null })
      );
    });
  });

  describe('createWithAggregation', () => {
    it('should create new notification when not aggregatable', async () => {
      const mockNotification = {
        toJSON: () => ({ id: 'notif-001' }),
      };

      mockNotificationModel.create.mockResolvedValue(mockNotification);

      const result = await notificationService.createWithAggregation({
        userId: 'user-001',
        type: 'new_follower',
        content: 'New follower',
      });

      expect(mockNotificationModel.create).toHaveBeenCalled();
    });

    it('should create new notification without resourceId', async () => {
      const mockNotification = {
        toJSON: () => ({ id: 'notif-001' }),
      };

      mockNotificationModel.create.mockResolvedValue(mockNotification);

      await notificationService.createWithAggregation({
        userId: 'user-001',
        type: 'video_like',
        content: 'Like notification',
      });

      expect(mockNotificationModel.create).toHaveBeenCalled();
    });

    it('should aggregate existing notification', async () => {
      const existingNotification = {
        id: 'notif-001',
        aggregatedCount: 1,
        aggregatedIds: [],
        metadata: { resourceTitle: 'Test Video', senderName: 'User1' },
        content: 'Original content',
        save: jest.fn().mockResolvedValue(true),
        toJSON: () => ({
          id: 'notif-001',
          aggregatedCount: 2,
          content: 'aggregated content',
        }),
      };

      mockNotificationModel.create.mockResolvedValue(existingNotification);
      mockNotificationModel.findByPk.mockResolvedValue(existingNotification);

      // First call creates the notification
      await notificationService.createWithAggregation({
        userId: 'user-001',
        type: 'video_like',
        resourceId: 'vid-001',
        resourceType: 'video',
        senderId: 'user-002',
        content: 'First like',
        metadata: { resourceTitle: 'Test Video', senderName: 'User1' },
      });

      // Second call should aggregate
      const result = await notificationService.createWithAggregation({
        userId: 'user-001',
        type: 'video_like',
        resourceId: 'vid-001',
        resourceType: 'video',
        senderId: 'user-003',
        content: 'Second like',
        metadata: { resourceTitle: 'Test Video', senderName: 'User2' },
      });

      expect(existingNotification.save).toHaveBeenCalled();
    });

    it('should handle aggregation update errors', async () => {
      const mockNotification = {
        toJSON: () => ({ id: 'notif-001' }),
      };

      mockNotificationModel.create.mockResolvedValue(mockNotification);
      mockNotificationModel.findByPk.mockRejectedValue(new Error('DB error'));

      const result = await notificationService.createWithAggregation({
        userId: 'user-001',
        type: 'video_like',
        resourceId: 'vid-001',
        resourceType: 'video',
        content: 'Test',
      });

      expect(result).toBeDefined();
    });
  });

  describe('markAsRead', () => {
    it('should mark notification as read', async () => {
      const mockNotification = {
        id: 'notif-001',
        isRead: false,
        markAsRead: jest.fn().mockResolvedValue(true),
        toJSON: () => ({ id: 'notif-001', isRead: true }),
      };

      mockNotificationModel.findOne.mockResolvedValue(mockNotification);

      const result = await notificationService.markAsRead('notif-001', 'user-001');

      expect(mockNotification.markAsRead).toHaveBeenCalled();
      expect(mockRedis.del).toHaveBeenCalledWith('unread:user-001');
    });

    it('should not re-read already read notification', async () => {
      const mockNotification = {
        id: 'notif-001',
        isRead: true,
        markAsRead: jest.fn(),
        toJSON: () => ({ id: 'notif-001', isRead: true }),
      };

      mockNotificationModel.findOne.mockResolvedValue(mockNotification);

      const result = await notificationService.markAsRead('notif-001', 'user-001');

      expect(mockNotification.markAsRead).not.toHaveBeenCalled();
    });

    it('should throw when notification not found', async () => {
      mockNotificationModel.findOne.mockResolvedValue(null);

      await expect(
        notificationService.markAsRead('notif-999', 'user-001')
      ).rejects.toThrow('Notification not found');
    });

    it('should verify user ownership', async () => {
      mockNotificationModel.findOne.mockResolvedValue(null);

      await expect(
        notificationService.markAsRead('notif-001', 'wrong-user')
      ).rejects.toThrow('Notification not found');

      expect(mockNotificationModel.findOne).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: 'notif-001', userId: 'wrong-user' },
        })
      );
    });
  });

  describe('markAllAsRead', () => {
    it('should mark all notifications as read', async () => {
      mockNotificationModel.update.mockResolvedValue([5]);

      const result = await notificationService.markAllAsRead('user-001');

      expect(result).toBe(5);
      expect(mockNotificationModel.update).toHaveBeenCalledWith(
        expect.objectContaining({ isRead: true }),
        expect.objectContaining({
          where: { userId: 'user-001', isRead: false },
        })
      );
    });

    it('should invalidate unread cache', async () => {
      mockNotificationModel.update.mockResolvedValue([3]);

      await notificationService.markAllAsRead('user-001');

      expect(mockRedis.del).toHaveBeenCalledWith('unread:user-001');
    });

    it('should handle zero updates', async () => {
      mockNotificationModel.update.mockResolvedValue([0]);

      const result = await notificationService.markAllAsRead('user-001');

      expect(result).toBe(0);
    });
  });

  describe('deleteNotification', () => {
    it('should delete notification', async () => {
      const mockNotification = {
        id: 'notif-001',
        isRead: false,
        destroy: jest.fn().mockResolvedValue(true),
      };

      mockNotificationModel.findOne.mockResolvedValue(mockNotification);

      const result = await notificationService.deleteNotification('notif-001', 'user-001');

      expect(result).toBe(true);
      expect(mockNotification.destroy).toHaveBeenCalled();
    });

    it('should throw when notification not found', async () => {
      mockNotificationModel.findOne.mockResolvedValue(null);

      await expect(
        notificationService.deleteNotification('notif-999', 'user-001')
      ).rejects.toThrow('Notification not found');
    });

    it('should invalidate cache for unread notifications', async () => {
      const mockNotification = {
        id: 'notif-001',
        isRead: false,
        destroy: jest.fn().mockResolvedValue(true),
      };

      mockNotificationModel.findOne.mockResolvedValue(mockNotification);

      await notificationService.deleteNotification('notif-001', 'user-001');

      expect(mockRedis.del).toHaveBeenCalledWith('unread:user-001');
    });

    it('should not invalidate cache for read notifications', async () => {
      const mockNotification = {
        id: 'notif-001',
        isRead: true,
        destroy: jest.fn().mockResolvedValue(true),
      };

      mockNotificationModel.findOne.mockResolvedValue(mockNotification);
      mockRedis.del.mockClear();

      await notificationService.deleteNotification('notif-001', 'user-001');

      expect(mockRedis.del).not.toHaveBeenCalled();
    });
  });

  describe('getNotificationById', () => {
    it('should return notification by ID', async () => {
      const mockNotification = { id: 'notif-001' };

      mockNotificationModel.findOne.mockResolvedValue(mockNotification);

      const result = await notificationService.getNotificationById('notif-001', 'user-001');

      expect(result).toBe(mockNotification);
    });

    it('should verify user ownership', async () => {
      mockNotificationModel.findOne.mockResolvedValue(null);

      const result = await notificationService.getNotificationById('notif-001', 'user-001');

      expect(result).toBeNull();
    });
  });

  describe('getRecentNotifications', () => {
    it('should get recent notifications', async () => {
      const mockNotifications = [
        {
          toJSON: () => ({
            id: 'notif-001',
            type: 'video_like',
            content: 'Recent notification',
            createdAt: '2024-01-01T00:00:00Z',
          }),
        },
      ];

      mockNotificationModel.findAll.mockResolvedValue(mockNotifications);

      const result = await notificationService.getRecentNotifications('user-001', 10);

      expect(result).toHaveLength(1);
      expect(mockNotificationModel.findAll).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { userId: 'user-001' },
          order: [['created_at', 'DESC']],
          limit: 10,
        })
      );
    });

    it('should default to 10 notifications', async () => {
      mockNotificationModel.findAll.mockResolvedValue([]);

      await notificationService.getRecentNotifications('user-001');

      expect(mockNotificationModel.findAll).toHaveBeenCalledWith(
        expect.objectContaining({ limit: 10 })
      );
    });
  });

  describe('cleanupOldNotifications', () => {
    it('should delete old read notifications', async () => {
      mockNotificationModel.destroy.mockResolvedValue(100);

      const result = await notificationService.cleanupOldNotifications(30);

      expect(result).toBe(100);
      expect(mockNotificationModel.destroy).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            isRead: true,
            createdAt: expect.any(Object),
          }),
        })
      );
    });

    it('should use default 30 days', async () => {
      mockNotificationModel.destroy.mockResolvedValue(0);

      await notificationService.cleanupOldNotifications();

      expect(mockNotificationModel.destroy).toHaveBeenCalled();
    });
  });

  describe('_generateAggregatedContent', () => {
    it('should generate video_like content', () => {
      const notification = {
        type: 'video_like',
        aggregatedCount: 3,
        metadata: { senderName: 'User1', resourceTitle: 'Cool Video' },
        content: 'original',
      };

      const result = notificationService._generateAggregatedContent(notification);

      expect(result).toContain('User1');
      expect(result).toContain('Cool Video');
    });

    it('should generate comment_reply content', () => {
      const notification = {
        type: 'comment_reply',
        aggregatedCount: 5,
        metadata: {},
        content: 'original',
      };

      const result = notificationService._generateAggregatedContent(notification);

      expect(result).toContain('5 people');
    });

    it('should generate coin_received content', () => {
      const notification = {
        type: 'coin_received',
        aggregatedCount: 2,
        metadata: { senderName: 'User1' },
        content: 'original',
      };

      const result = notificationService._generateAggregatedContent(notification);

      expect(result).toContain('2 coins');
    });

    it('should return original content for unknown type', () => {
      const notification = {
        type: 'unknown',
        aggregatedCount: 2,
        content: 'original content',
      };

      const result = notificationService._generateAggregatedContent(notification);

      expect(result).toBe('original content');
    });
  });

  describe('_invalidateUnreadCache', () => {
    it('should delete cache key', async () => {
      await notificationService._invalidateUnreadCache('user-001');

      expect(mockRedis.del).toHaveBeenCalledWith('unread:user-001');
    });

    it('should handle Redis errors gracefully', async () => {
      mockRedis.del.mockRejectedValue(new Error('Redis error'));

      await expect(notificationService._invalidateUnreadCache('user-001')).resolves.not.toThrow();
    });
  });

  describe('updateUnreadCache', () => {
    it('should update cache with current count', async () => {
      mockNotificationModel.count.mockResolvedValue(7);

      const result = await notificationService.updateUnreadCache('user-001');

      expect(result).toBe(7);
      expect(mockRedis.setex).toHaveBeenCalledWith('unread:user-001', 300, '7');
    });

    it('should handle Redis errors', async () => {
      mockNotificationModel.count.mockResolvedValue(5);
      mockRedis.setex.mockRejectedValue(new Error('Redis error'));

      const result = await notificationService.updateUnreadCache('user-001');

      expect(result).toBe(0);
    });

    it('should handle DB errors', async () => {
      mockNotificationModel.count.mockRejectedValue(new Error('DB error'));

      const result = await notificationService.updateUnreadCache('user-001');

      expect(result).toBe(0);
    });
  });
});
