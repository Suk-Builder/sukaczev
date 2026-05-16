const request = require('supertest');
const app = require('../src/app');
const jwt = require('jsonwebtoken');
const config = require('../src/config');

jest.mock('../src/services/notificationService');

const generateToken = (userId, role = 'user') => {
  return jwt.sign(
    { sub: userId, username: 'testuser', role },
    config.jwt.secret,
    { expiresIn: '1h' }
  );
};

describe('Notification Controller', () => {
  let mockNotificationService;

  beforeEach(() => {
    jest.clearAllMocks();

    mockNotificationService = {
      getNotifications: jest.fn(),
      getUnreadCount: jest.fn(),
      markAsRead: jest.fn(),
      markAllAsRead: jest.fn(),
      deleteNotification: jest.fn(),
      getNotificationById: jest.fn(),
      createNotification: jest.fn(),
      getRecentNotifications: jest.fn(),
      cleanupOldNotifications: jest.fn(),
    };

    require('../src/services/notificationService').getNotificationService.mockReturnValue(mockNotificationService);
  });

  describe('GET /api/notifications', () => {
    it('should get notifications list', async () => {
      const token = generateToken('user-001');
      mockNotificationService.getNotifications.mockResolvedValue({
        notifications: [
          { id: 'notif-001', type: 'video_like', content: 'Test', isRead: false },
        ],
        total: 1,
        page: 1,
        pageSize: 20,
        totalPages: 1,
        hasNext: false,
        hasPrev: false,
      });

      const response = await request(app)
        .get('/api/notifications')
        .set('Authorization', `Bearer ${token}`)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data).toHaveLength(1);
      expect(response.body.pagination.total).toBe(1);
    });

    it('should filter by type', async () => {
      const token = generateToken('user-001');
      mockNotificationService.getNotifications.mockResolvedValue({
        notifications: [],
        total: 0,
        page: 1,
        pageSize: 20,
        totalPages: 0,
        hasNext: false,
        hasPrev: false,
      });

      await request(app)
        .get('/api/notifications?type=video_like')
        .set('Authorization', `Bearer ${token}`)
        .expect(200);

      expect(mockNotificationService.getNotifications).toHaveBeenCalledWith(
        'user-001',
        expect.objectContaining({ type: 'video_like' })
      );
    });

    it('should filter by isRead', async () => {
      const token = generateToken('user-001');
      mockNotificationService.getNotifications.mockResolvedValue({
        notifications: [], total: 0, page: 1, pageSize: 20, totalPages: 0, hasNext: false, hasPrev: false,
      });

      await request(app)
        .get('/api/notifications?isRead=false')
        .set('Authorization', `Bearer ${token}`)
        .expect(200);
    });

    it('should validate page parameter', async () => {
      const token = generateToken('user-001');

      const response = await request(app)
        .get('/api/notifications?page=0')
        .set('Authorization', `Bearer ${token}`)
        .expect(400);

      expect(response.body.success).toBe(false);
    });

    it('should validate pageSize parameter', async () => {
      const token = generateToken('user-001');

      const response = await request(app)
        .get('/api/notifications?pageSize=101')
        .set('Authorization', `Bearer ${token}`)
        .expect(400);

      expect(response.body.success).toBe(false);
    });

    it('should validate type parameter', async () => {
      const token = generateToken('user-001');

      const response = await request(app)
        .get('/api/notifications?type=invalid')
        .set('Authorization', `Bearer ${token}`)
        .expect(400);

      expect(response.body.success).toBe(false);
    });

    it('should handle service errors', async () => {
      const token = generateToken('user-001');
      mockNotificationService.getNotifications.mockRejectedValue(new Error('DB error'));

      const response = await request(app)
        .get('/api/notifications')
        .set('Authorization', `Bearer ${token}`)
        .expect(500);

      expect(response.body.success).toBe(false);
    });

    it('should return 401 without auth', async () => {
      await request(app)
        .get('/api/notifications')
        .expect(401);
    });
  });

  describe('GET /api/notifications/unread-count', () => {
    it('should get unread count', async () => {
      const token = generateToken('user-001');
      mockNotificationService.getUnreadCount.mockResolvedValue(5);

      const response = await request(app)
        .get('/api/notifications/unread-count')
        .set('Authorization', `Bearer ${token}`)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.count).toBe(5);
    });

    it('should handle service errors', async () => {
      const token = generateToken('user-001');
      mockNotificationService.getUnreadCount.mockRejectedValue(new Error('Error'));

      const response = await request(app)
        .get('/api/notifications/unread-count')
        .set('Authorization', `Bearer ${token}`)
        .expect(500);

      expect(response.body.success).toBe(false);
    });
  });

  describe('GET /api/notifications/recent', () => {
    it('should get recent notifications', async () => {
      const token = generateToken('user-001');
      mockNotificationService.getRecentNotifications.mockResolvedValue([
        { id: 'notif-001', type: 'video_like', content: 'Test' },
      ]);

      const response = await request(app)
        .get('/api/notifications/recent')
        .set('Authorization', `Bearer ${token}`)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data).toHaveLength(1);
    });
  });

  describe('GET /api/notifications/:id', () => {
    it('should get single notification', async () => {
      const token = generateToken('user-001');
      const mockNotification = {
        toJSON: () => ({
          id: '550e8400-e29b-41d4-a716-446655440000',
          type: 'video_like',
          content: 'Test',
          isRead: false,
        }),
      };

      mockNotificationService.getNotificationById.mockResolvedValue(mockNotification);

      const response = await request(app)
        .get('/api/notifications/550e8400-e29b-41d4-a716-446655440000')
        .set('Authorization', `Bearer ${token}`)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.id).toBe('550e8400-e29b-41d4-a716-446655440000');
    });

    it('should return 404 for non-existent notification', async () => {
      const token = generateToken('user-001');
      mockNotificationService.getNotificationById.mockResolvedValue(null);

      const response = await request(app)
        .get('/api/notifications/550e8400-e29b-41d4-a716-446655440000')
        .set('Authorization', `Bearer ${token}`)
        .expect(404);

      expect(response.body.success).toBe(false);
    });

    it('should validate notification ID', async () => {
      const token = generateToken('user-001');

      const response = await request(app)
        .get('/api/notifications/invalid-id')
        .set('Authorization', `Bearer ${token}`)
        .expect(400);

      expect(response.body.success).toBe(false);
    });

    it('should handle service errors', async () => {
      const token = generateToken('user-001');
      mockNotificationService.getNotificationById.mockRejectedValue(new Error('Error'));

      const response = await request(app)
        .get('/api/notifications/550e8400-e29b-41d4-a716-446655440000')
        .set('Authorization', `Bearer ${token}`)
        .expect(500);

      expect(response.body.success).toBe(false);
    });
  });

  describe('PUT /api/notifications/:id/read', () => {
    it('should mark notification as read', async () => {
      const token = generateToken('user-001');
      const mockNotification = {
        toJSON: () => ({
          id: '550e8400-e29b-41d4-a716-446655440000',
          type: 'video_like',
          content: 'Test',
          isRead: true,
        }),
      };

      mockNotificationService.markAsRead.mockResolvedValue(mockNotification);

      const response = await request(app)
        .put('/api/notifications/550e8400-e29b-41d4-a716-446655440000/read')
        .set('Authorization', `Bearer ${token}`)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.message).toContain('marked as read');
    });

    it('should return 404 for non-existent notification', async () => {
      const token = generateToken('user-001');
      mockNotificationService.markAsRead.mockRejectedValue(new Error('Notification not found'));

      const response = await request(app)
        .put('/api/notifications/550e8400-e29b-41d4-a716-446655440000/read')
        .set('Authorization', `Bearer ${token}`)
        .expect(404);

      expect(response.body.success).toBe(false);
    });

    it('should validate notification ID', async () => {
      const token = generateToken('user-001');

      const response = await request(app)
        .put('/api/notifications/invalid-id/read')
        .set('Authorization', `Bearer ${token}`)
        .expect(400);

      expect(response.body.success).toBe(false);
    });
  });

  describe('PUT /api/notifications/read-all', () => {
    it('should mark all as read', async () => {
      const token = generateToken('user-001');
      mockNotificationService.markAllAsRead.mockResolvedValue(5);

      const response = await request(app)
        .put('/api/notifications/read-all')
        .set('Authorization', `Bearer ${token}`)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.markedCount).toBe(5);
    });

    it('should handle service errors', async () => {
      const token = generateToken('user-001');
      mockNotificationService.markAllAsRead.mockRejectedValue(new Error('Error'));

      const response = await request(app)
        .put('/api/notifications/read-all')
        .set('Authorization', `Bearer ${token}`)
        .expect(500);

      expect(response.body.success).toBe(false);
    });
  });

  describe('DELETE /api/notifications/:id', () => {
    it('should delete notification', async () => {
      const token = generateToken('user-001');
      mockNotificationService.deleteNotification.mockResolvedValue(true);

      const response = await request(app)
        .delete('/api/notifications/550e8400-e29b-41d4-a716-446655440000')
        .set('Authorization', `Bearer ${token}`)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.message).toContain('deleted');
    });

    it('should return 404 for non-existent notification', async () => {
      const token = generateToken('user-001');
      mockNotificationService.deleteNotification.mockRejectedValue(new Error('Notification not found'));

      const response = await request(app)
        .delete('/api/notifications/550e8400-e29b-41d4-a716-446655440000')
        .set('Authorization', `Bearer ${token}`)
        .expect(404);

      expect(response.body.success).toBe(false);
    });

    it('should validate notification ID', async () => {
      const token = generateToken('user-001');

      const response = await request(app)
        .delete('/api/notifications/invalid-id')
        .set('Authorization', `Bearer ${token}`)
        .expect(400);

      expect(response.body.success).toBe(false);
    });
  });

  describe('POST /api/notifications (admin)', () => {
    it('should create notification as admin', async () => {
      const token = generateToken('admin-001', 'admin');
      const mockNotification = {
        toJSON: () => ({
          id: 'notif-001',
          userId: 'user-001',
          type: 'system',
          content: 'Test',
        }),
      };

      mockNotificationService.createNotification.mockResolvedValue(mockNotification);

      const response = await request(app)
        .post('/api/notifications')
        .set('Authorization', `Bearer ${token}`)
        .send({
          userId: 'user-001',
          type: 'system',
          content: 'System notification',
        })
        .expect(201);

      expect(response.body.success).toBe(true);
      expect(response.body.data.type).toBe('system');
    });

    it('should reject non-admin users', async () => {
      const token = generateToken('user-001', 'user');

      const response = await request(app)
        .post('/api/notifications')
        .set('Authorization', `Bearer ${token}`)
        .send({
          userId: 'user-001',
          type: 'system',
          content: 'Test',
        })
        .expect(403);

      expect(response.body.success).toBe(false);
    });

    it('should validate request body', async () => {
      const token = generateToken('admin-001', 'admin');

      const response = await request(app)
        .post('/api/notifications')
        .set('Authorization', `Bearer ${token}`)
        .send({})
        .expect(400);

      expect(response.body.success).toBe(false);
    });

    it('should validate notification type', async () => {
      const token = generateToken('admin-001', 'admin');

      const response = await request(app)
        .post('/api/notifications')
        .set('Authorization', `Bearer ${token}`)
        .send({
          userId: 'user-001',
          type: 'invalid_type',
          content: 'Test',
        })
        .expect(400);

      expect(response.body.success).toBe(false);
    });

    it('should validate content length', async () => {
      const token = generateToken('admin-001', 'admin');

      const response = await request(app)
        .post('/api/notifications')
        .set('Authorization', `Bearer ${token}`)
        .send({
          userId: 'user-001',
          type: 'system',
          content: 'a'.repeat(2001),
        })
        .expect(400);

      expect(response.body.success).toBe(false);
    });
  });

  describe('DELETE /api/notifications/admin/cleanup', () => {
    it('should cleanup as admin', async () => {
      const token = generateToken('admin-001', 'admin');
      mockNotificationService.cleanupOldNotifications.mockResolvedValue(100);

      const response = await request(app)
        .delete('/api/notifications/admin/cleanup?days=30')
        .set('Authorization', `Bearer ${token}`)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.deletedCount).toBe(100);
    });

    it('should reject non-admin users', async () => {
      const token = generateToken('user-001', 'user');

      await request(app)
        .delete('/api/notifications/admin/cleanup')
        .set('Authorization', `Bearer ${token}`)
        .expect(403);
    });
  });

  describe('Auth handling', () => {
    it('should reject requests without token', async () => {
      await request(app)
        .get('/api/notifications')
        .expect(401);
    });

    it('should reject requests with invalid token', async () => {
      await request(app)
        .get('/api/notifications')
        .set('Authorization', 'Bearer invalid-token')
        .expect(401);
    });

    it('should reject requests with expired token', async () => {
      const expiredToken = jwt.sign(
        { sub: 'user-001' },
        config.jwt.secret,
        { expiresIn: '-1h' }
      );

      const response = await request(app)
        .get('/api/notifications')
        .set('Authorization', `Bearer ${expiredToken}`)
        .expect(401);

      expect(response.body.message).toBe('Token expired');
    });
  });

  describe('GET /health', () => {
    it('should return health status', async () => {
      const response = await request(app)
        .get('/health')
        .expect(200);

      expect(response.body.status).toBeDefined();
      expect(response.body.service).toBeDefined();
    });
  });

  describe('GET /', () => {
    it('should return API info', async () => {
      const response = await request(app)
        .get('/')
        .expect(200);

      expect(response.body.service).toBeDefined();
      expect(response.body.endpoints).toBeDefined();
    });
  });

  describe('404 handler', () => {
    it('should return 404 for undefined routes', async () => {
      await request(app)
        .get('/api/undefined-route')
        .expect(404);
    });
  });
});
