const handleDanmaku = require('../../src/websocket/danmakuHandler');
const danmakuService = require('../../src/services/danmakuService');
const { validateSocketData } = require('../../src/middleware/validation');
const { wsRateLimiter } = require('../../src/middleware/rateLimiter');

jest.mock('../../src/services/danmakuService');
jest.mock('../../src/middleware/validation');
jest.mock('../../src/utils/logger', () => ({
  info: jest.fn(),
  error: jest.fn(),
  warn: jest.fn(),
  debug: jest.fn()
}));

describe('WebSocket Danmaku Handler', () => {
  let io, socket, mockStats;

  const mockDanmaku = {
    id: '1',
    videoId: '550e8400-e29b-41d4-a716-446655440000',
    userId: '550e8400-e29b-41d4-a716-446655440001',
    content: 'Test danmaku',
    timePoint: 45.5,
    color: '#FF0000',
    type: 0,
    fontSize: 25,
    createdAt: '2024-01-15T10:30:00.000Z'
  };

  beforeEach(() => {
    mockStats = { totalMessages: 0 };

    socket = {
      id: 'socket-123',
      userId: '550e8400-e29b-41d4-a716-446655440001',
      rooms: new Set(['socket-123']),
      currentVideoId: null,
      join: jest.fn(),
      leave: jest.fn(),
      emit: jest.fn(),
      on: jest.fn(),
      once: jest.fn()
    };

    io = {
      to: jest.fn().mockReturnThis(),
      emit: jest.fn(),
      sockets: {
        adapter: {
          rooms: new Map()
        }
      },
      getStats: jest.fn().mockReturnValue({
        totalConnections: 5,
        activeConnections: 3,
        roomCount: 2
      })
    };

    // Reset rate limiter
    wsRateLimiter.removeSocket('socket-123');

    jest.clearAllMocks();
  });

  const triggerSocketEvent = (eventName, data, callback) => {
    const handler = socket.on.mock.calls.find(call => call[0] === eventName);
    if (handler && handler[1]) {
      return handler[1](data, callback);
    }
    return Promise.resolve();
  };

  describe('connection setup', () => {
    it('should register all event handlers', () => {
      handleDanmaku(io, socket, mockStats);

      const registeredEvents = socket.on.mock.calls.map(call => call[0]);

      expect(registeredEvents).toContain('danmaku:send');
      expect(registeredEvents).toContain('danmaku:history');
      expect(registeredEvents).toContain('danmaku:subscribe');
      expect(registeredEvents).toContain('danmaku:unsubscribe');
      expect(registeredEvents).toContain('danmaku:stats');
      expect(registeredEvents).toContain('disconnect');
    });

    it('should clean up rate limiter on disconnect', () => {
      handleDanmaku(io, socket, mockStats);

      // Find disconnect handler
      const disconnectHandler = socket.on.mock.calls.find(
        call => call[0] === 'disconnect'
      );

      expect(disconnectHandler).toBeDefined();
    });
  });

  describe('danmaku:send', () => {
    beforeEach(() => {
      danmakuService.createDanmaku = jest.fn().mockResolvedValue(mockDanmaku);
      validateSocketData = jest.fn().mockReturnValue({
        error: false,
        value: {
          videoId: mockDanmaku.videoId,
          userId: mockDanmaku.userId,
          content: mockDanmaku.content,
          timePoint: mockDanmaku.timePoint,
          color: mockDanmaku.color,
          type: mockDanmaku.type,
          fontSize: mockDanmaku.fontSize
        }
      });
    });

    it('should send danmaku successfully', async () => {
      handleDanmaku(io, socket, mockStats);

      const callback = jest.fn();
      await triggerSocketEvent('danmaku:send', {
        videoId: mockDanmaku.videoId,
        userId: mockDanmaku.userId,
        content: mockDanmaku.content,
        timePoint: mockDanmaku.timePoint
      }, callback);

      expect(danmakuService.createDanmaku).toHaveBeenCalled();
      expect(io.to).toHaveBeenCalledWith(`video:${mockDanmaku.videoId}`);
    });

    it('should apply rate limiting', async () => {
      handleDanmaku(io, socket, mockStats);

      // Exhaust rate limit
      wsRateLimiter.isAllowed = jest.fn().mockReturnValue(false);

      const callback = jest.fn();
      await triggerSocketEvent('danmaku:send', {
        videoId: mockDanmaku.videoId,
        content: 'Test'
      }, callback);

      expect(danmakuService.createDanmaku).not.toHaveBeenCalled();
      expect(callback).toHaveBeenCalledWith(
        expect.objectContaining({
          success: false,
          code: 'RATE_LIMIT'
        })
      );
    });

    it('should handle validation errors', async () => {
      validateSocketData = jest.fn().mockReturnValue({
        error: true,
        message: 'Invalid data'
      });

      handleDanmaku(io, socket, mockStats);

      const callback = jest.fn();
      await triggerSocketEvent('danmaku:send', { invalid: 'data' }, callback);

      expect(callback).toHaveBeenCalledWith(
        expect.objectContaining({
          success: false,
          code: 'VALIDATION_ERROR'
        })
      );
    });

    it('should handle service errors', async () => {
      danmakuService.createDanmaku = jest.fn().mockRejectedValue(
        new Error('Service unavailable')
      );

      handleDanmaku(io, socket, mockStats);

      const callback = jest.fn();
      await triggerSocketEvent('danmaku:send', {
        videoId: mockDanmaku.videoId,
        userId: mockDanmaku.userId,
        content: 'Test',
        timePoint: 10.0
      }, callback);

      expect(callback).toHaveBeenCalledWith(
        expect.objectContaining({
          success: false
        })
      );
    });

    it('should include flight parameters in broadcast', async () => {
      danmakuService.createDanmaku = jest.fn().mockResolvedValue(mockDanmaku);

      handleDanmaku(io, socket, mockStats);

      await triggerSocketEvent('danmaku:send', {
        videoId: mockDanmaku.videoId,
        userId: mockDanmaku.userId,
        content: 'Test',
        timePoint: 45.5,
        videoDuration: 300
      }, jest.fn());

      expect(io.to).toHaveBeenCalled();
      expect(io.emit).toHaveBeenCalledWith(
        'danmaku:new',
        expect.objectContaining({
          id: mockDanmaku.id,
          content: mockDanmaku.content,
          timePoint: mockDanmaku.timePoint
        })
      );
    });

    it('should increment total message count', async () => {
      const initialCount = mockStats.totalMessages;

      handleDanmaku(io, socket, mockStats);

      await triggerSocketEvent('danmaku:send', {
        videoId: mockDanmaku.videoId,
        userId: mockDanmaku.userId,
        content: 'Test',
        timePoint: 10.0
      }, jest.fn());

      expect(mockStats.totalMessages).toBe(initialCount + 1);
    });

    it('should use callback for acknowledgment', async () => {
      handleDanmaku(io, socket, mockStats);

      const callback = jest.fn();
      await triggerSocketEvent('danmaku:send', {
        videoId: mockDanmaku.videoId,
        userId: mockDanmaku.userId,
        content: 'Test',
        timePoint: 10.0
      }, callback);

      expect(callback).toHaveBeenCalledWith(
        expect.objectContaining({
          success: true,
          data: expect.any(Object)
        })
      );
    });

    it('should emit error event when no callback provided', async () => {
      validateSocketData = jest.fn().mockReturnValue({
        error: true,
        message: 'Invalid',
        code: 'VALIDATION_ERROR'
      });

      handleDanmaku(io, socket, mockStats);

      await triggerSocketEvent('danmaku:send', { invalid: 'data' }, undefined);

      expect(socket.emit).toHaveBeenCalledWith(
        'danmaku:error',
        expect.any(Object)
      );
    });

    it('should handle different danmaku types', async () => {
      handleDanmaku(io, socket, mockStats);

      await triggerSocketEvent('danmaku:send', {
        videoId: mockDanmaku.videoId,
        userId: mockDanmaku.userId,
        content: 'Top message',
        timePoint: 30.0,
        type: 1
      }, jest.fn());

      await triggerSocketEvent('danmaku:send', {
        videoId: mockDanmaku.videoId,
        userId: mockDanmaku.userId,
        content: 'Bottom message',
        timePoint: 45.0,
        type: 2
      }, jest.fn());

      expect(danmakuService.createDanmaku).toHaveBeenCalledTimes(2);
    });

    it('should handle fallback to socket.userId', async () => {
      handleDanmaku(io, socket, mockStats);

      await triggerSocketEvent('danmaku:send', {
        videoId: mockDanmaku.videoId,
        content: 'No userId in data',
        timePoint: 10.0
      }, jest.fn());

      const callArgs = danmakuService.createDanmaku.mock.calls[0][0];
      expect(callArgs.userId || socket.userId).toBeDefined();
    });
  });

  describe('danmaku:history', () => {
    beforeEach(() => {
      danmakuService.getDanmakusByTimeRange = jest.fn().mockResolvedValue({
        danmakus: [mockDanmaku],
        meta: {
          videoId: mockDanmaku.videoId,
          startTime: 0,
          endTime: 300,
          count: 1,
          total: 1
        }
      });

      validateSocketData = jest.fn().mockImplementation((schema, data) => {
        if (schema === 'socketHistoryRequest') {
          return {
            error: false,
            value: {
              videoId: data.videoId,
              start: data.start || 0,
              end: data.end || 300
            }
          };
        }
        return { error: false, value: data };
      });
    });

    it('should retrieve history successfully', async () => {
      handleDanmaku(io, socket, mockStats);

      const callback = jest.fn();
      await triggerSocketEvent('danmaku:history', {
        videoId: mockDanmaku.videoId,
        start: 0,
        end: 300
      }, callback);

      expect(danmakuService.getDanmakusByTimeRange).toHaveBeenCalledWith(
        mockDanmaku.videoId,
        0,
        300,
        expect.any(Object)
      );
      expect(callback).toHaveBeenCalledWith(
        expect.objectContaining({
          success: true,
          data: expect.any(Array)
        })
      );
    });

    it('should use default time range', async () => {
      handleDanmaku(io, socket, mockStats);

      const callback = jest.fn();
      await triggerSocketEvent('danmaku:history', {
        videoId: mockDanmaku.videoId
      }, callback);

      expect(danmakuService.getDanmakusByTimeRange).toHaveBeenCalledWith(
        mockDanmaku.videoId,
        0,
        300,
        expect.any(Object)
      );
    });

    it('should handle validation errors', async () => {
      validateSocketData = jest.fn().mockReturnValue({
        error: true,
        message: 'Missing videoId'
      });

      handleDanmaku(io, socket, mockStats);

      const callback = jest.fn();
      await triggerSocketEvent('danmaku:history', {}, callback);

      expect(callback).toHaveBeenCalledWith(
        expect.objectContaining({
          success: false
        })
      );
    });

    it('should handle service errors', async () => {
      danmakuService.getDanmakusByTimeRange = jest.fn().mockRejectedValue(
        new Error('Service error')
      );

      handleDanmaku(io, socket, mockStats);

      const callback = jest.fn();
      await triggerSocketEvent('danmaku:history', {
        videoId: mockDanmaku.videoId
      }, callback);

      expect(callback).toHaveBeenCalledWith(
        expect.objectContaining({
          success: false
        })
      );
    });

    it('should include flight params in response', async () => {
      handleDanmaku(io, socket, mockStats);

      const callback = jest.fn();
      await triggerSocketEvent('danmaku:history', {
        videoId: mockDanmaku.videoId,
        start: 0,
        end: 300,
        videoDuration: 300
      }, callback);

      expect(callback).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.arrayContaining([
            expect.objectContaining({
              flightDuration: expect.any(Number),
              speedFactor: expect.any(Number)
            })
          ])
        })
      );
    });

    it('should emit history without callback', async () => {
      handleDanmaku(io, socket, mockStats);

      await triggerSocketEvent('danmaku:history', {
        videoId: mockDanmaku.videoId
      }, undefined);

      expect(socket.emit).toHaveBeenCalledWith(
        'danmaku:history',
        expect.objectContaining({
          success: true
        })
      );
    });
  });

  describe('danmaku:subscribe', () => {
    it('should subscribe to video room', async () => {
      handleDanmaku(io, socket, mockStats);

      const callback = jest.fn();
      await triggerSocketEvent('danmaku:subscribe', {
        videoId: mockDanmaku.videoId
      }, callback);

      expect(socket.join).toHaveBeenCalledWith(`video:${mockDanmaku.videoId}`);
      expect(socket.currentVideoId).toBe(mockDanmaku.videoId);
      expect(callback).toHaveBeenCalledWith(
        expect.objectContaining({
          success: true,
          subscribed: true
        })
      );
    });

    it('should reject without videoId', async () => {
      handleDanmaku(io, socket, mockStats);

      const callback = jest.fn();
      await triggerSocketEvent('danmaku:subscribe', {}, callback);

      expect(callback).toHaveBeenCalledWith(
        expect.objectContaining({
          success: false
        })
      );
    });

    it('should leave previous rooms', async () => {
      socket.rooms = new Set(['socket-123', 'video:old-video']);
      socket.currentVideoId = 'old-video';

      handleDanmaku(io, socket, mockStats);

      const callback = jest.fn();
      await triggerSocketEvent('danmaku:subscribe', {
        videoId: mockDanmaku.videoId
      }, callback);

      expect(socket.leave).toHaveBeenCalledWith(`video:old-video`);
    });

    it('should handle errors', async () => {
      socket.join = jest.fn().mockImplementation(() => {
        throw new Error('Join failed');
      });

      handleDanmaku(io, socket, mockStats);

      const callback = jest.fn();
      await triggerSocketEvent('danmaku:subscribe', {
        videoId: mockDanmaku.videoId
      }, callback);

      expect(callback).toHaveBeenCalledWith(
        expect.objectContaining({
          success: false
        })
      );
    });
  });

  describe('danmaku:unsubscribe', () => {
    it('should unsubscribe from specified video', async () => {
      handleDanmaku(io, socket, mockStats);

      const callback = jest.fn();
      await triggerSocketEvent('danmaku:unsubscribe', {
        videoId: mockDanmaku.videoId
      }, callback);

      expect(socket.leave).toHaveBeenCalledWith(`video:${mockDanmaku.videoId}`);
      expect(callback).toHaveBeenCalledWith(
        expect.objectContaining({
          success: true
        })
      );
    });

    it('should unsubscribe from current video', async () => {
      socket.currentVideoId = mockDanmaku.videoId;

      handleDanmaku(io, socket, mockStats);

      const callback = jest.fn();
      await triggerSocketEvent('danmaku:unsubscribe', {}, callback);

      expect(socket.leave).toHaveBeenCalledWith(`video:${mockDanmaku.videoId}`);
    });

    it('should reset currentVideoId when no videoId specified', async () => {
      socket.currentVideoId = mockDanmaku.videoId;

      handleDanmaku(io, socket, mockStats);

      const callback = jest.fn();
      await triggerSocketEvent('danmaku:unsubscribe', {}, callback);

      expect(socket.currentVideoId).toBeNull();
    });

    it('should handle errors', async () => {
      socket.leave = jest.fn().mockImplementation(() => {
        throw new Error('Leave failed');
      });

      handleDanmaku(io, socket, mockStats);

      const callback = jest.fn();
      await triggerSocketEvent('danmaku:unsubscribe', {}, callback);

      expect(callback).toHaveBeenCalledWith(
        expect.objectContaining({
          success: false
        })
      );
    });
  });

  describe('danmaku:stats', () => {
    it('should return stats for specific video', async () => {
      io.sockets.adapter.rooms.set(
        `video:${mockDanmaku.videoId}`,
        new Set(['socket1', 'socket2', 'socket3'])
      );

      handleDanmaku(io, socket, mockStats);

      const callback = jest.fn();
      await triggerSocketEvent('danmaku:stats', {
        videoId: mockDanmaku.videoId
      }, callback);

      expect(callback).toHaveBeenCalledWith(
        expect.objectContaining({
          success: true,
          data: expect.objectContaining({
            videoId: mockDanmaku.videoId,
            viewers: 3
          })
        })
      );
    });

    it('should return global stats without videoId', async () => {
      handleDanmaku(io, socket, mockStats);

      const callback = jest.fn();
      await triggerSocketEvent('danmaku:stats', {}, callback);

      expect(callback).toHaveBeenCalledWith(
        expect.objectContaining({
          success: true,
          data: expect.any(Object)
        })
      );
    });

    it('should handle empty rooms', async () => {
      handleDanmaku(io, socket, mockStats);

      const callback = jest.fn();
      await triggerSocketEvent('danmaku:stats', {
        videoId: 'non-existent-video'
      }, callback);

      expect(callback).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            viewers: 0
          })
        })
      );
    });

    it('should handle errors', async () => {
      io.getStats = jest.fn().mockImplementation(() => {
        throw new Error('Stats error');
      });

      handleDanmaku(io, socket, mockStats);

      const callback = jest.fn();
      await triggerSocketEvent('danmaku:stats', {}, callback);

      expect(callback).toHaveBeenCalledWith(
        expect.objectContaining({
          success: false
        })
      );
    });
  });

  describe('edge cases', () => {
    it('should handle socket without userId', async () => {
      socket.userId = undefined;

      handleDanmaku(io, socket, mockStats);

      const callback = jest.fn();
      await triggerSocketEvent('danmaku:send', {
        videoId: mockDanmaku.videoId,
        content: 'Test',
        timePoint: 10.0
      }, callback);

      // Should not throw
      expect(callback).toHaveBeenCalled();
    });

    it('should handle callback as non-function', async () => {
      handleDanmaku(io, socket, mockStats);

      // Should not throw when callback is undefined
      await expect(
        triggerSocketEvent('danmaku:send', {
          videoId: mockDanmaku.videoId,
          content: 'Test',
          timePoint: 10.0
        }, undefined)
      ).resolves.not.toThrow();
    });

    it('should handle empty danmaku history', async () => {
      danmakuService.getDanmakusByTimeRange = jest.fn().mockResolvedValue({
        danmakus: [],
        meta: { count: 0, total: 0 }
      });

      validateSocketData = jest.fn().mockReturnValue({
        error: false,
        value: { videoId: mockDanmaku.videoId, start: 0, end: 300 }
      });

      handleDanmaku(io, socket, mockStats);

      const callback = jest.fn();
      await triggerSocketEvent('danmaku:history', {
        videoId: mockDanmaku.videoId
      }, callback);

      expect(callback).toHaveBeenCalledWith(
        expect.objectContaining({
          data: [],
          meta: expect.objectContaining({ count: 0 })
        })
      );
    });

    it('should handle multiple rapid sends', async () => {
      handleDanmaku(io, socket, mockStats);

      const sends = [];
      for (let i = 0; i < 5; i++) {
        sends.push(triggerSocketEvent('danmaku:send', {
          videoId: mockDanmaku.videoId,
          userId: mockDanmaku.userId,
          content: `Message ${i}`,
          timePoint: i * 10
        }, jest.fn()));
      }

      await Promise.all(sends);

      // Some should succeed, some should be rate limited
      expect(danmakuService.createDanmaku).toHaveBeenCalled();
    });

    it('should handle null data in subscribe', async () => {
      handleDanmaku(io, socket, mockStats);

      const callback = jest.fn();
      await triggerSocketEvent('danmaku:subscribe', null, callback);

      expect(callback).toHaveBeenCalledWith(
        expect.objectContaining({
          success: false
        })
      );
    });

    it('should handle null data in unsubscribe', async () => {
      handleDanmaku(io, socket, mockStats);

      const callback = jest.fn();
      await triggerSocketEvent('danmaku:unsubscribe', null, callback);

      expect(callback).toHaveBeenCalled();
    });
  });
});
