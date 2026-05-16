const danmakuService = require('../../src/services/danmakuService');
const Danmaku = require('../../src/models/danmaku');
const {
  cacheDanmaku,
  getCachedDanmaku,
  clearDanmakuCache
} = require('../../src/config/redis');
const densityController = require('../../src/utils/densityController');
const sensitiveWordFilter = require('../../src/utils/sensitiveWordFilter');
const { DanmakuError } = require('../../src/middleware/errorHandler');

// Mock dependencies
jest.mock('../../src/models/danmaku');
jest.mock('../../src/utils/densityController');
jest.mock('../../src/utils/sensitiveWordFilter');
jest.mock('../../src/config/redis', () => ({
  ...jest.requireActual('../../src/config/redis'),
  cacheDanmaku: jest.fn().mockResolvedValue(),
  getCachedDanmaku: jest.fn().mockResolvedValue([]),
  clearDanmakuCache: jest.fn().mockResolvedValue()
}));

describe('DanmakuService', () => {
  const mockDanmaku = {
    id: '1',
    videoId: '550e8400-e29b-41d4-a716-446655440000',
    userId: '550e8400-e29b-41d4-a716-446655440001',
    content: 'Test content',
    timePoint: 45.5,
    color: '#FF0000',
    type: 0,
    fontSize: 25,
    createdAt: '2024-01-15T10:30:00.000Z'
  };

  beforeEach(() => {
    jest.clearAllMocks();

    sensitiveWordFilter.validateContent = jest.fn().mockReturnValue({
      valid: true,
      filtered: false,
      content: 'Test content',
      matchedWords: []
    });

    densityController.checkDensity = jest.fn().mockResolvedValue(true);
    densityController.checkUserRateLimit = jest.fn().mockResolvedValue(true);
    densityController.recordDanmaku = jest.fn().mockResolvedValue();
    densityController.getCurrentDensity = jest.fn().mockResolvedValue(5);
    densityController.calculateSpeedFactor = jest.fn().mockReturnValue(1.2);
    densityController.calculateFlightDuration = jest.fn().mockReturnValue(7000);
    densityController.getDensityStats = jest.fn().mockResolvedValue({
      maxDensity: 8,
      maxDensityTime: 45,
      averageDensity: 3.5,
      totalDanmakus: 150,
      densityLimit: 10
    });
  });

  describe('createDanmaku', () => {
    it('should create danmaku successfully', async () => {
      Danmaku.create = jest.fn().mockResolvedValue(mockDanmaku);

      const result = await danmakuService.createDanmaku({
        videoId: mockDanmaku.videoId,
        userId: mockDanmaku.userId,
        content: mockDanmaku.content,
        timePoint: mockDanmaku.timePoint,
        color: mockDanmaku.color,
        type: mockDanmaku.type,
        fontSize: mockDanmaku.fontSize
      });

      expect(sensitiveWordFilter.validateContent).toHaveBeenCalledWith(mockDanmaku.content);
      expect(densityController.checkDensity).toHaveBeenCalledWith(
        mockDanmaku.videoId,
        mockDanmaku.timePoint
      );
      expect(densityController.checkUserRateLimit).toHaveBeenCalledWith(
        mockDanmaku.userId,
        mockDanmaku.videoId
      );
      expect(Danmaku.create).toHaveBeenCalled();
      expect(cacheDanmaku).toHaveBeenCalledWith(mockDanmaku.videoId, mockDanmaku);
      expect(densityController.recordDanmaku).toHaveBeenCalledWith(
        mockDanmaku.videoId,
        mockDanmaku.timePoint
      );

      expect(result).toMatchObject(mockDanmaku);
    });

    it('should create danmaku with filtered content', async () => {
      const filteredContent = '**** content';
      sensitiveWordFilter.validateContent = jest.fn().mockReturnValue({
        valid: true,
        filtered: true,
        content: filteredContent,
        matchedWords: ['spam', 'abuse']
      });

      const filteredDanmaku = { ...mockDanmaku, content: filteredContent };
      Danmaku.create = jest.fn().mockResolvedValue(filteredDanmaku);

      const result = await danmakuService.createDanmaku({
        videoId: mockDanmaku.videoId,
        userId: mockDanmaku.userId,
        content: 'spam abuse message',
        timePoint: mockDanmaku.timePoint
      });

      expect(result.content).toBe(filteredContent);
      expect(result.filtered).toBe(true);
      expect(result.matchedWords).toEqual(['spam', 'abuse']);
      expect(Danmaku.create).toHaveBeenCalledWith(
        expect.objectContaining({ content: filteredContent })
      );
    });

    it('should reject invalid content', async () => {
      sensitiveWordFilter.validateContent = jest.fn().mockReturnValue({
        valid: false,
        error: 'Content exceeds maximum length of 100 characters'
      });

      await expect(
        danmakuService.createDanmaku({
          videoId: mockDanmaku.videoId,
          userId: mockDanmaku.userId,
          content: 'x'.repeat(101),
          timePoint: mockDanmaku.timePoint
        })
      ).rejects.toThrow(DanmakuError);

      expect(Danmaku.create).not.toHaveBeenCalled();
    });

    it('should reject when density limit reached', async () => {
      densityController.checkDensity = jest.fn().mockResolvedValue(false);

      await expect(
        danmakuService.createDanmaku({
          videoId: mockDanmaku.videoId,
          userId: mockDanmaku.userId,
          content: mockDanmaku.content,
          timePoint: mockDanmaku.timePoint
        })
      ).rejects.toThrow(DanmakuError);

      expect(Danmaku.create).not.toHaveBeenCalled();
    });

    it('should reject when user rate limited', async () => {
      densityController.checkUserRateLimit = jest.fn().mockResolvedValue(false);

      await expect(
        danmakuService.createDanmaku({
          videoId: mockDanmaku.videoId,
          userId: mockDanmaku.userId,
          content: mockDanmaku.content,
          timePoint: mockDanmaku.timePoint
        })
      ).rejects.toThrow(DanmakuError);

      expect(Danmaku.create).not.toHaveBeenCalled();
    });

    it('should handle database errors', async () => {
      Danmaku.create = jest.fn().mockRejectedValue(new Error('DB connection failed'));

      await expect(
        danmakuService.createDanmaku({
          videoId: mockDanmaku.videoId,
          userId: mockDanmaku.userId,
          content: mockDanmaku.content,
          timePoint: mockDanmaku.timePoint
        })
      ).rejects.toThrow(DanmakuError);
    });

    it('should create danmaku with minimal data', async () => {
      Danmaku.create = jest.fn().mockResolvedValue({
        ...mockDanmaku,
        color: '#FFFFFF',
        type: 0,
        fontSize: 25
      });

      const result = await danmakuService.createDanmaku({
        videoId: mockDanmaku.videoId,
        userId: mockDanmaku.userId,
        content: 'Minimal',
        timePoint: 10.0
      });

      expect(Danmaku.create).toHaveBeenCalledWith(
        expect.objectContaining({
          color: '#FFFFFF',
          type: 0,
          fontSize: 25
        })
      );
      expect(result.color).toBe('#FFFFFF');
    });

    it('should create danmaku with type 1 (top)', async () => {
      const topDanmaku = { ...mockDanmaku, type: 1 };
      Danmaku.create = jest.fn().mockResolvedValue(topDanmaku);

      const result = await danmakuService.createDanmaku({
        videoId: mockDanmaku.videoId,
        userId: mockDanmaku.userId,
        content: 'Top message',
        timePoint: 30.0,
        type: 1
      });

      expect(result.type).toBe(1);
    });

    it('should create danmaku with type 2 (bottom)', async () => {
      const bottomDanmaku = { ...mockDanmaku, type: 2 };
      Danmaku.create = jest.fn().mockResolvedValue(bottomDanmaku);

      const result = await danmakuService.createDanmaku({
        videoId: mockDanmaku.videoId,
        userId: mockDanmaku.userId,
        content: 'Bottom message',
        timePoint: 45.0,
        type: 2
      });

      expect(result.type).toBe(2);
    });

    it('should create danmaku with custom color', async () => {
      const customDanmaku = { ...mockDanmaku, color: '#00FF00' };
      Danmaku.create = jest.fn().mockResolvedValue(customDanmaku);

      const result = await danmakuService.createDanmaku({
        videoId: mockDanmaku.videoId,
        userId: mockDanmaku.userId,
        content: 'Green text',
        timePoint: 15.0,
        color: '#00FF00'
      });

      expect(result.color).toBe('#00FF00');
    });

    it('should create danmaku with custom font size', async () => {
      const bigDanmaku = { ...mockDanmaku, fontSize: 40 };
      Danmaku.create = jest.fn().mockResolvedValue(bigDanmaku);

      const result = await danmakuService.createDanmaku({
        videoId: mockDanmaku.videoId,
        userId: mockDanmaku.userId,
        content: 'Big text',
        timePoint: 20.0,
        fontSize: 40
      });

      expect(result.fontSize).toBe(40);
    });

    it('should use filtered content from validation', async () => {
      const originalContent = 'spam message here';
      const filteredContent = '**** message here';

      sensitiveWordFilter.validateContent = jest.fn().mockReturnValue({
        valid: true,
        filtered: true,
        content: filteredContent,
        matchedWords: ['spam']
      });

      Danmaku.create = jest.fn().mockImplementation((data) =>
        Promise.resolve({ ...mockDanmaku, content: data.content })
      );

      await danmakuService.createDanmaku({
        videoId: mockDanmaku.videoId,
        userId: mockDanmaku.userId,
        content: originalContent,
        timePoint: 10.0
      });

      expect(Danmaku.create).toHaveBeenCalledWith(
        expect.objectContaining({ content: filteredContent })
      );
    });

    it('should handle Redis cache errors gracefully', async () => {
      Danmaku.create = jest.fn().mockResolvedValue(mockDanmaku);
      cacheDanmaku.mockRejectedValueOnce(new Error('Redis unavailable'));
      densityController.recordDanmaku = jest.fn().mockRejectedValueOnce(
        new Error('Redis unavailable')
      );

      const result = await danmakuService.createDanmaku({
        videoId: mockDanmaku.videoId,
        userId: mockDanmaku.userId,
        content: mockDanmaku.content,
        timePoint: mockDanmaku.timePoint
      });

      expect(result).toBeDefined();
      expect(Danmaku.create).toHaveBeenCalled();
    });
  });

  describe('getDanmakusByTimeRange', () => {
    it('should return danmakus for time range', async () => {
      Danmaku.findByVideoAndTimeRange = jest.fn().mockResolvedValue([
        mockDanmaku,
        { ...mockDanmaku, id: '2', timePoint: 60.0 }
      ]);
      Danmaku.countByVideoId = jest.fn().mockResolvedValue(100);

      const result = await danmakuService.getDanmakusByTimeRange(
        mockDanmaku.videoId,
        0,
        300
      );

      expect(Danmaku.findByVideoAndTimeRange).toHaveBeenCalledWith(
        mockDanmaku.videoId,
        0,
        300,
        expect.objectContaining({ limit: 500, offset: 0 })
      );

      expect(result.danmakus).toHaveLength(2);
      expect(result.meta.videoId).toBe(mockDanmaku.videoId);
      expect(result.meta.total).toBe(100);
    });

    it('should use cache for recent small ranges', async () => {
      const cachedDanmaku = { ...mockDanmaku, timePoint: 30.0 };
      getCachedDanmaku.mockResolvedValueOnce([cachedDanmaku]);
      Danmaku.countByVideoId = jest.fn().mockResolvedValue(50);

      const result = await danmakuService.getDanmakusByTimeRange(
        mockDanmaku.videoId,
        0,
        60
      );

      expect(getCachedDanmaku).toHaveBeenCalledWith(mockDanmaku.videoId, 500);
    });

    it('should fall back to database when cache is empty', async () => {
      getCachedDanmaku.mockResolvedValueOnce([]);
      Danmaku.findByVideoAndTimeRange = jest.fn().mockResolvedValue([mockDanmaku]);
      Danmaku.countByVideoId = jest.fn().mockResolvedValue(1);

      const result = await danmakuService.getDanmakusByTimeRange(
        mockDanmaku.videoId,
        0,
        60
      );

      expect(Danmaku.findByVideoAndTimeRange).toHaveBeenCalled();
      expect(result.danmakus).toHaveLength(1);
    });

    it('should reject invalid time range', async () => {
      await expect(
        danmakuService.getDanmakusByTimeRange(
          mockDanmaku.videoId,
          300,
          0
        )
      ).rejects.toThrow(DanmakuError);
    });

    it('should reject time range exceeding maximum', async () => {
      await expect(
        danmakuService.getDanmakusByTimeRange(
          mockDanmaku.videoId,
          0,
          4000
        )
      ).rejects.toThrow(DanmakuError);
    });

    it('should handle database errors', async () => {
      Danmaku.findByVideoAndTimeRange = jest.fn().mockRejectedValue(
        new Error('Query failed')
      );

      await expect(
        danmakuService.getDanmakusByTimeRange(
          mockDanmaku.videoId,
          0,
          300
        )
      ).rejects.toThrow(DanmakuError);
    });

    it('should respect custom limit and offset', async () => {
      Danmaku.findByVideoAndTimeRange = jest.fn().mockResolvedValue([]);
      Danmaku.countByVideoId = jest.fn().mockResolvedValue(0);

      await danmakuService.getDanmakusByTimeRange(
        mockDanmaku.videoId,
        0,
        300,
        { limit: 50, offset: 100 }
      );

      expect(Danmaku.findByVideoAndTimeRange).toHaveBeenCalledWith(
        expect.any(String),
        expect.any(Number),
        expect.any(Number),
        expect.objectContaining({ limit: 50, offset: 100 })
      );
    });

    it('should return danmakus within exact range', async () => {
      const danmaku1 = { ...mockDanmaku, timePoint: 10.0 };
      const danmaku2 = { ...mockDanmaku, id: '2', timePoint: 50.0 };
      const danmaku3 = { ...mockDanmaku, id: '3', timePoint: 100.0 };

      getCachedDanmaku.mockResolvedValueOnce([danmaku1, danmaku2, danmaku3]);
      Danmaku.countByVideoId = jest.fn().mockResolvedValue(3);

      const result = await danmakuService.getDanmakusByTimeRange(
        mockDanmaku.videoId,
        20,
        80
      );

      expect(result.danmakus.every(d => d.timePoint >= 20 && d.timePoint <= 80)).toBe(true);
    });

    it('should handle boundary time values', async () => {
      Danmaku.findByVideoAndTimeRange = jest.fn().mockResolvedValue([]);
      Danmaku.countByVideoId = jest.fn().mockResolvedValue(0);

      const result = await danmakuService.getDanmakusByTimeRange(
        mockDanmaku.videoId,
        0,
        0.001
      );

      expect(result.meta.startTime).toBe(0);
      expect(result.meta.endTime).toBe(0.001);
    });
  });

  describe('getVideoStats', () => {
    it('should return video statistics with density', async () => {
      Danmaku.getStats = jest.fn().mockResolvedValue({
        videoId: mockDanmaku.videoId,
        totalCount: 150,
        uniqueUsers: 45
      });

      const result = await danmakuService.getVideoStats(mockDanmaku.videoId);

      expect(Danmaku.getStats).toHaveBeenCalledWith(mockDanmaku.videoId);
      expect(densityController.getDensityStats).toHaveBeenCalledWith(
        mockDanmaku.videoId
      );

      expect(result).toMatchObject({
        videoId: mockDanmaku.videoId,
        totalCount: 150,
        uniqueUsers: 45,
        density: expect.any(Object)
      });
    });

    it('should handle database errors', async () => {
      Danmaku.getStats = jest.fn().mockRejectedValue(new Error('DB error'));

      await expect(
        danmakuService.getVideoStats(mockDanmaku.videoId)
      ).rejects.toThrow(DanmakuError);
    });
  });

  describe('deleteDanmakusByVideo', () => {
    it('should delete danmakus and clear cache', async () => {
      Danmaku.deleteByVideoId = jest.fn().mockResolvedValue(50);

      const result = await danmakuService.deleteDanmakusByVideo(mockDanmaku.videoId);

      expect(Danmaku.deleteByVideoId).toHaveBeenCalledWith(mockDanmaku.videoId);
      expect(clearDanmakuCache).toHaveBeenCalledWith(mockDanmaku.videoId);
      expect(result).toBe(50);
    });

    it('should handle deletion errors', async () => {
      Danmaku.deleteByVideoId = jest.fn().mockRejectedValue(new Error('Delete failed'));

      await expect(
        danmakuService.deleteDanmakusByVideo(mockDanmaku.videoId)
      ).rejects.toThrow(DanmakuError);
    });
  });

  describe('getRecentDanmakus', () => {
    it('should return recent danmakus', async () => {
      const recent = [mockDanmaku, { ...mockDanmaku, id: '2' }];
      Danmaku.findRecent = jest.fn().mockResolvedValue(recent);

      const result = await danmakuService.getRecentDanmakus(10);

      expect(Danmaku.findRecent).toHaveBeenCalledWith(10);
      expect(result).toHaveLength(2);
    });

    it('should handle errors', async () => {
      Danmaku.findRecent = jest.fn().mockRejectedValue(new Error('Query failed'));

      await expect(danmakuService.getRecentDanmakus()).rejects.toThrow(DanmakuError);
    });
  });

  describe('getUserDanmakuHistory', () => {
    it('should return user history', async () => {
      const history = [mockDanmaku];
      Danmaku.findByUserId = jest.fn().mockResolvedValue(history);

      const result = await danmakuService.getUserDanmakuHistory(mockDanmaku.userId);

      expect(Danmaku.findByUserId).toHaveBeenCalledWith(
        mockDanmaku.userId,
        expect.objectContaining({ limit: 50, offset: 0 })
      );
      expect(result).toEqual(history);
    });

    it('should pass options to model', async () => {
      Danmaku.findByUserId = jest.fn().mockResolvedValue([]);

      await danmakuService.getUserDanmakuHistory(mockDanmaku.userId, {
        limit: 20,
        offset: 10
      });

      expect(Danmaku.findByUserId).toHaveBeenCalledWith(
        mockDanmaku.userId,
        { limit: 20, offset: 10 }
      );
    });

    it('should handle errors', async () => {
      Danmaku.findByUserId = jest.fn().mockRejectedValue(new Error('DB error'));

      await expect(
        danmakuService.getUserDanmakuHistory(mockDanmaku.userId)
      ).rejects.toThrow(DanmakuError);
    });
  });

  describe('getDensityInfo', () => {
    it('should return density info', async () => {
      const result = await danmakuService.getDensityInfo(mockDanmaku.videoId, 600);

      expect(densityController.getDensityStats).toHaveBeenCalledWith(
        mockDanmaku.videoId,
        600
      );
      expect(result).toMatchObject({
        maxDensity: 8,
        densityLimit: 10
      });
    });

    it('should handle errors', async () => {
      densityController.getDensityStats = jest.fn().mockRejectedValue(
        new Error('Calculation failed')
      );

      await expect(
        danmakuService.getDensityInfo(mockDanmaku.videoId)
      ).rejects.toThrow(DanmakuError);
    });
  });

  describe('calculateFlightSpeed', () => {
    it('should calculate flight speed', async () => {
      const result = await danmakuService.calculateFlightSpeed(
        mockDanmaku.videoId,
        45.5,
        300
      );

      expect(densityController.getCurrentDensity).toHaveBeenCalledWith(
        mockDanmaku.videoId,
        45.5
      );
      expect(densityController.calculateFlightDuration).toHaveBeenCalledWith(5, 300);
      expect(densityController.calculateSpeedFactor).toHaveBeenCalledWith(5);

      expect(result).toMatchObject({
        density: 5,
        flightDuration: 7000,
        speedFactor: 1.2,
        videoDuration: 300
      });
    });

    it('should return defaults on error', async () => {
      densityController.getCurrentDensity = jest.fn().mockRejectedValue(
        new Error('Redis down')
      );

      const result = await danmakuService.calculateFlightSpeed(
        mockDanmaku.videoId,
        10.0,
        300
      );

      expect(result).toMatchObject({
        density: 0,
        flightDuration: 8000,
        speedFactor: 1.0,
        videoDuration: 300
      });
    });

    it('should use default video duration', async () => {
      await danmakuService.calculateFlightSpeed(mockDanmaku.videoId, 10.0);

      expect(densityController.calculateFlightDuration).toHaveBeenCalledWith(
        expect.any(Number),
        300
      );
    });

    it('should handle very low density', async () => {
      densityController.getCurrentDensity = jest.fn().mockResolvedValue(0);
      densityController.calculateSpeedFactor = jest.fn().mockReturnValue(1.0);

      const result = await danmakuService.calculateFlightSpeed(
        mockDanmaku.videoId,
        10.0
      );

      expect(result.density).toBe(0);
      expect(result.speedFactor).toBe(1.0);
    });

    it('should handle high density', async () => {
      densityController.getCurrentDensity = jest.fn().mockResolvedValue(50);
      densityController.calculateSpeedFactor = jest.fn().mockReturnValue(2.5);
      densityController.calculateFlightDuration = jest.fn().mockReturnValue(3200);

      const result = await danmakuService.calculateFlightSpeed(
        mockDanmaku.videoId,
        10.0,
        120
      );

      expect(result.density).toBe(50);
      expect(result.speedFactor).toBe(2.5);
    });
  });

  describe('getDanmakusByVideo', () => {
    it('should return danmakus for video', async () => {
      Danmaku.findByVideoId = jest.fn().mockResolvedValue([mockDanmaku]);

      const result = await danmakuService.getDanmakusByVideo(
        mockDanmaku.videoId,
        { limit: 100 }
      );

      expect(Danmaku.findByVideoId).toHaveBeenCalledWith(
        mockDanmaku.videoId,
        { limit: 100 }
      );
      expect(result).toHaveLength(1);
    });

    it('should handle errors', async () => {
      Danmaku.findByVideoId = jest.fn().mockRejectedValue(new Error('DB error'));

      await expect(
        danmakuService.getDanmakusByVideo(mockDanmaku.videoId)
      ).rejects.toThrow(DanmakuError);
    });
  });
});
