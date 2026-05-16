const request = require('supertest');
const app = require('../../src/app');
const danmakuService = require('../../src/services/danmakuService');

jest.mock('../../src/services/danmakuService');
jest.mock('../../src/config/redis', () => ({
  connectRedis: jest.fn().mockResolvedValue(),
  closeRedis: jest.fn().mockResolvedValue(),
  getRedis: jest.fn().mockReturnValue({
    pipeline: jest.fn().mockReturnValue({
      lpush: jest.fn().mockReturnThis(),
      ltrim: jest.fn().mockReturnThis(),
      expire: jest.fn().mockReturnThis(),
      hincrby: jest.fn().mockReturnThis(),
      hget: jest.fn().mockReturnThis(),
      lrange: jest.fn().mockReturnThis(),
      del: jest.fn().mockReturnThis(),
      exec: jest.fn().mockResolvedValue([])
    }),
    lrange: jest.fn().mockResolvedValue([]),
    hget: jest.fn().mockResolvedValue('0'),
    del: jest.fn().mockResolvedValue(1)
  }),
  cacheDanmaku: jest.fn().mockResolvedValue(),
  getCachedDanmaku: jest.fn().mockResolvedValue([]),
  getDanmakuDensity: jest.fn().mockResolvedValue(0),
  incrementDanmakuDensity: jest.fn().mockResolvedValue(),
  clearDanmakuCache: jest.fn().mockResolvedValue()
}));
jest.mock('../../src/utils/logger', () => ({
  info: jest.fn(),
  error: jest.fn(),
  warn: jest.fn(),
  debug: jest.fn(),
  stream: { write: jest.fn() }
}));

describe('API Integration Tests', () => {
  const validVideoId = '550e8400-e29b-41d4-a716-446655440000';
  const validUserId = '550e8400-e29b-41d4-a716-446655440001';

  const mockDanmaku = {
    id: '1',
    videoId: validVideoId,
    userId: validUserId,
    content: 'Test danmaku',
    timePoint: 45.5,
    color: '#FF0000',
    type: 0,
    fontSize: 25,
    createdAt: '2024-01-15T10:30:00.000Z',
    filtered: false,
    matchedWords: []
  };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('Health Check', () => {
    it('should return health status', async () => {
      const response = await request(app)
        .get('/health')
        .expect(200);

      expect(response.body).toMatchObject({
        status: 'ok',
        service: 'danmaku-service'
      });
      expect(response.body.timestamp).toBeDefined();
      expect(response.body.uptime).toBeGreaterThanOrEqual(0);
    });
  });

  describe('Root Endpoint', () => {
    it('should return service info', async () => {
      const response = await request(app)
        .get('/')
        .expect(200);

      expect(response.body).toMatchObject({
        service: 'danmaku-service',
        version: '1.0.0'
      });
    });
  });

  describe('GET /api/danmakus', () => {
    it('should return danmakus for time range', async () => {
      danmakuService.getDanmakusByTimeRange = jest.fn().mockResolvedValue({
        danmakus: [mockDanmaku],
        meta: {
          videoId: validVideoId,
          startTime: 0,
          endTime: 300,
          count: 1,
          total: 1,
          limit: 500,
          offset: 0
        }
      });

      const response = await request(app)
        .get('/api/danmakus')
        .query({
          videoId: validVideoId,
          start: 0,
          end: 300
        })
        .expect(200);

      expect(response.body).toMatchObject({
        success: true,
        data: expect.any(Array),
        meta: expect.any(Object)
      });
      expect(response.body.data).toHaveLength(1);
      expect(danmakuService.getDanmakusByTimeRange).toHaveBeenCalledWith(
        validVideoId,
        0,
        300,
        expect.any(Object)
      );
    });

    it('should return empty array when no danmakus', async () => {
      danmakuService.getDanmakusByTimeRange = jest.fn().mockResolvedValue({
        danmakus: [],
        meta: {
          videoId: validVideoId,
          startTime: 0,
          endTime: 300,
          count: 0,
          total: 0
        }
      });

      const response = await request(app)
        .get('/api/danmakus')
        .query({ videoId: validVideoId })
        .expect(200);

      expect(response.body.data).toEqual([]);
    });

    it('should reject missing videoId', async () => {
      const response = await request(app)
        .get('/api/danmakus')
        .query({ start: 0, end: 300 })
        .expect(400);

      expect(response.body.error.code).toBe('VALIDATION_ERROR');
    });

    it('should reject invalid videoId', async () => {
      const response = await request(app)
        .get('/api/danmakus')
        .query({ videoId: 'not-a-uuid' })
        .expect(400);

      expect(response.body.error.code).toBe('VALIDATION_ERROR');
    });

    it('should accept valid time parameters', async () => {
      danmakuService.getDanmakusByTimeRange = jest.fn().mockResolvedValue({
        danmakus: [],
        meta: { count: 0 }
      });

      await request(app)
        .get('/api/danmakus')
        .query({
          videoId: validVideoId,
          start: 50,
          end: 150
        })
        .expect(200);

      expect(danmakuService.getDanmakusByTimeRange).toHaveBeenCalledWith(
        validVideoId,
        50,
        150,
        expect.any(Object)
      );
    });

    it('should convert string numbers', async () => {
      danmakuService.getDanmakusByTimeRange = jest.fn().mockResolvedValue({
        danmakus: [],
        meta: { count: 0 }
      });

      await request(app)
        .get('/api/danmakus')
        .query({
          videoId: validVideoId,
          start: '0',
          end: '300',
          limit: '50',
          offset: '10'
        })
        .expect(200);

      expect(danmakuService.getDanmakusByTimeRange).toHaveBeenCalledWith(
        validVideoId,
        expect.any(Number),
        expect.any(Number),
        expect.objectContaining({ limit: 50, offset: 10 })
      );
    });

    it('should handle service errors', async () => {
      danmakuService.getDanmakusByTimeRange = jest.fn().mockRejectedValue(
        new Error('Database connection failed')
      );

      const response = await request(app)
        .get('/api/danmakus')
        .query({ videoId: validVideoId })
        .expect(500);

      expect(response.body.error).toBeDefined();
    });

    it('should reject negative start time', async () => {
      const response = await request(app)
        .get('/api/danmakus')
        .query({
          videoId: validVideoId,
          start: -1
        })
        .expect(400);

      expect(response.body.error.code).toBe('VALIDATION_ERROR');
    });

    it('should reject limit over 1000', async () => {
      const response = await request(app)
        .get('/api/danmakus')
        .query({
          videoId: validVideoId,
          limit: 1001
        })
        .expect(400);

      expect(response.body.error.code).toBe('VALIDATION_ERROR');
    });
  });

  describe('POST /api/danmakus', () => {
    it('should create a danmaku', async () => {
      danmakuService.createDanmaku = jest.fn().mockResolvedValue(mockDanmaku);

      const response = await request(app)
        .post('/api/danmakus')
        .send({
          videoId: validVideoId,
          userId: validUserId,
          content: 'Test danmaku',
          timePoint: 45.5
        })
        .expect(201);

      expect(response.body).toMatchObject({
        success: true,
        data: expect.any(Object)
      });
      expect(danmakuService.createDanmaku).toHaveBeenCalled();
    });

    it('should create danmaku with all fields', async () => {
      danmakuService.createDanmaku = jest.fn().mockResolvedValue(mockDanmaku);

      const response = await request(app)
        .post('/api/danmakus')
        .send({
          videoId: validVideoId,
          userId: validUserId,
          content: 'Test danmaku',
          timePoint: 45.5,
          color: '#FF0000',
          type: 1,
          fontSize: 30
        })
        .expect(201);

      expect(response.body.success).toBe(true);
    });

    it('should reject missing required fields', async () => {
      const response = await request(app)
        .post('/api/danmakus')
        .send({ content: 'Missing fields' })
        .expect(400);

      expect(response.body.error.code).toBe('VALIDATION_ERROR');
    });

    it('should reject content over 100 characters', async () => {
      const response = await request(app)
        .post('/api/danmakus')
        .send({
          videoId: validVideoId,
          userId: validUserId,
          content: 'x'.repeat(101),
          timePoint: 10.0
        })
        .expect(400);

      expect(response.body.error.code).toBe('VALIDATION_ERROR');
    });

    it('should reject invalid type values', async () => {
      const response = await request(app)
        .post('/api/danmakus')
        .send({
          videoId: validVideoId,
          userId: validUserId,
          content: 'Test',
          timePoint: 10.0,
          type: 5
        })
        .expect(400);

      expect(response.body.error.code).toBe('VALIDATION_ERROR');
    });

    it('should reject invalid color format', async () => {
      const response = await request(app)
        .post('/api/danmakus')
        .send({
          videoId: validVideoId,
          userId: validUserId,
          content: 'Test',
          timePoint: 10.0,
          color: 'red'
        })
        .expect(400);

      expect(response.body.error.code).toBe('VALIDATION_ERROR');
    });

    it('should reject negative timePoint', async () => {
      const response = await request(app)
        .post('/api/danmakus')
        .send({
          videoId: validVideoId,
          userId: validUserId,
          content: 'Test',
          timePoint: -5.0
        })
        .expect(400);

      expect(response.body.error.code).toBe('VALIDATION_ERROR');
    });

    it('should handle density limit errors', async () => {
      danmakuService.createDanmaku = jest.fn().mockRejectedValue({
        message: 'Too many danmakus',
        statusCode: 429,
        code: 'DENSITY_LIMIT'
      });

      const response = await request(app)
        .post('/api/danmakus')
        .send({
          videoId: validVideoId,
          userId: validUserId,
          content: 'Test',
          timePoint: 45.5
        })
        .expect(429);

      expect(response.body.error.code).toBe('DENSITY_LIMIT');
    });

    it('should handle rate limit errors', async () => {
      danmakuService.createDanmaku = jest.fn().mockRejectedValue({
        message: 'Too fast',
        statusCode: 429,
        code: 'RATE_LIMIT'
      });

      const response = await request(app)
        .post('/api/danmakus')
        .send({
          videoId: validVideoId,
          userId: validUserId,
          content: 'Test',
          timePoint: 45.5
        })
        .expect(429);

      expect(response.body.error.code).toBe('RATE_LIMIT');
    });

    it('should handle service errors', async () => {
      danmakuService.createDanmaku = jest.fn().mockRejectedValue(
        new Error('Database error')
      );

      const response = await request(app)
        .post('/api/danmakus')
        .send({
          videoId: validVideoId,
          userId: validUserId,
          content: 'Test',
          timePoint: 10.0
        })
        .expect(500);

      expect(response.body.error).toBeDefined();
    });

    it('should broadcast danmaku via WebSocket', async () => {
      const mockIo = {
        to: jest.fn().mockReturnThis(),
        emit: jest.fn()
      };
      app.set('io', mockIo);

      danmakuService.createDanmaku = jest.fn().mockResolvedValue(mockDanmaku);

      await request(app)
        .post('/api/danmakus')
        .send({
          videoId: validVideoId,
          userId: validUserId,
          content: 'Test',
          timePoint: 45.5
        })
        .expect(201);

      expect(mockIo.to).toHaveBeenCalledWith(`video:${validVideoId}`);
      expect(mockIo.emit).toHaveBeenCalledWith('danmaku:new', expect.any(Object));
    });
  });

  describe('GET /api/danmakus/:videoId/stats', () => {
    it('should return video statistics', async () => {
      danmakuService.getVideoStats = jest.fn().mockResolvedValue({
        videoId: validVideoId,
        totalCount: 150,
        uniqueUsers: 45,
        typeDistribution: { scroll: 100, top: 30, bottom: 20 }
      });

      const response = await request(app)
        .get(`/api/danmakus/${validVideoId}/stats`)
        .expect(200);

      expect(response.body).toMatchObject({
        success: true,
        data: expect.any(Object)
      });
      expect(response.body.data.totalCount).toBe(150);
    });

    it('should reject invalid videoId', async () => {
      const response = await request(app)
        .get('/api/danmakus/invalid-uuid/stats')
        .expect(400);

      expect(response.body.error.code).toBe('VALIDATION_ERROR');
    });

    it('should handle service errors', async () => {
      danmakuService.getVideoStats = jest.fn().mockRejectedValue(
        new Error('Stats error')
      );

      const response = await request(app)
        .get(`/api/danmakus/${validVideoId}/stats`)
        .expect(500);

      expect(response.body.error).toBeDefined();
    });
  });

  describe('GET /api/danmakus/:videoId/density', () => {
    it('should return density distribution', async () => {
      danmakuService.getDensityInfo = jest.fn().mockResolvedValue({
        videoId: validVideoId,
        maxDensity: 8,
        averageDensity: 3.5,
        distribution: [{ timeBucket: 0, count: 10 }]
      });

      const response = await request(app)
        .get(`/api/danmakus/${validVideoId}/density`)
        .query({ duration: 600 })
        .expect(200);

      expect(response.body).toMatchObject({
        success: true,
        data: expect.any(Object)
      });
    });

    it('should use default duration', async () => {
      danmakuService.getDensityInfo = jest.fn().mockResolvedValue({});

      await request(app)
        .get(`/api/danmakus/${validVideoId}/density`)
        .expect(200);

      expect(danmakuService.getDensityInfo).toHaveBeenCalledWith(
        validVideoId,
        600
      );
    });
  });

  describe('GET /api/danmakus/:videoId/speed', () => {
    it('should calculate flight speed', async () => {
      danmakuService.calculateFlightSpeed = jest.fn().mockResolvedValue({
        density: 5,
        flightDuration: 7000,
        speedFactor: 1.2,
        videoDuration: 300
      });

      const response = await request(app)
        .get(`/api/danmakus/${validVideoId}/speed`)
        .query({ timePoint: 45.5, videoDuration: 300 })
        .expect(200);

      expect(response.body).toMatchObject({
        success: true,
        data: expect.objectContaining({
          density: expect.any(Number),
          flightDuration: expect.any(Number),
          speedFactor: expect.any(Number)
        })
      });
    });

    it('should use default parameters', async () => {
      danmakuService.calculateFlightSpeed = jest.fn().mockResolvedValue({});

      await request(app)
        .get(`/api/danmakus/${validVideoId}/speed`)
        .expect(200);

      expect(danmakuService.calculateFlightSpeed).toHaveBeenCalledWith(
        validVideoId,
        0,
        300
      );
    });
  });

  describe('DELETE /api/danmakus/:videoId', () => {
    it('should delete danmakus for video', async () => {
      danmakuService.deleteDanmakusByVideo = jest.fn().mockResolvedValue(50);

      const response = await request(app)
        .delete(`/api/danmakus/${validVideoId}`)
        .expect(200);

      expect(response.body).toMatchObject({
        success: true,
        data: expect.objectContaining({
          deletedCount: 50,
          videoId: validVideoId
        })
      });
    });

    it('should handle deletion errors', async () => {
      danmakuService.deleteDanmakusByVideo = jest.fn().mockRejectedValue(
        new Error('Delete failed')
      );

      const response = await request(app)
        .delete(`/api/danmakus/${validVideoId}`)
        .expect(500);

      expect(response.body.error).toBeDefined();
    });
  });

  describe('GET /api/danmakus/recent', () => {
    it('should return recent danmakus', async () => {
      danmakuService.getRecentDanmakus = jest.fn().mockResolvedValue([
        mockDanmaku,
        { ...mockDanmaku, id: '2' }
      ]);

      const response = await request(app)
        .get('/api/danmakus/recent')
        .expect(200);

      expect(response.body.data).toHaveLength(2);
    });

    it('should pass limit parameter', async () => {
      danmakuService.getRecentDanmakus = jest.fn().mockResolvedValue([]);

      await request(app)
        .get('/api/danmakus/recent')
        .query({ limit: 20 })
        .expect(200);

      expect(danmakuService.getRecentDanmakus).toHaveBeenCalledWith(20);
    });

    it('should cap limit at 500', async () => {
      danmakuService.getRecentDanmakus = jest.fn().mockResolvedValue([]);

      await request(app)
        .get('/api/danmakus/recent')
        .query({ limit: 1000 })
        .expect(200);

      expect(danmakuService.getRecentDanmakus).toHaveBeenCalledWith(500);
    });
  });

  describe('GET /api/danmakus/user/:userId', () => {
    it('should return user danmaku history', async () => {
      danmakuService.getUserDanmakuHistory = jest.fn().mockResolvedValue([
        mockDanmaku
      ]);

      const response = await request(app)
        .get(`/api/danmakus/user/${validUserId}`)
        .expect(200);

      expect(response.body.data).toHaveLength(1);
    });

    it('should pass limit and offset', async () => {
      danmakuService.getUserDanmakuHistory = jest.fn().mockResolvedValue([]);

      await request(app)
        .get(`/api/danmakus/user/${validUserId}`)
        .query({ limit: 10, offset: 20 })
        .expect(200);

      expect(danmakuService.getUserDanmakuHistory).toHaveBeenCalledWith(
        validUserId,
        expect.objectContaining({ limit: 10, offset: 20 })
      );
    });
  });

  describe('GET /api/danmakus/stats/global', () => {
    it('should return global stats', async () => {
      const mockIo = {
        getStats: jest.fn().mockReturnValue({
          totalConnections: 100,
          activeConnections: 50
        })
      };
      app.set('io', mockIo);

      const response = await request(app)
        .get('/api/danmakus/stats/global')
        .expect(200);

      expect(response.body).toMatchObject({
        success: true,
        data: expect.any(Object)
      });
    });
  });

  describe('404 Handling', () => {
    it('should return 404 for unknown routes', async () => {
      const response = await request(app)
        .get('/api/unknown/route')
        .expect(404);

      expect(response.body).toMatchObject({
        error: 'Not Found'
      });
    });
  });

  describe('Request logging', () => {
    it('should process requests with request ID', async () => {
      const response = await request(app)
        .get('/health')
        .expect(200);

      expect(response.body.status).toBe('ok');
    });
  });
});
