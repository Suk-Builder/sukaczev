const Danmaku = require('../../src/models/danmaku');
const { query } = require('../../src/config/database');

describe('Danmaku Model', () => {
  const mockDanmaku = {
    id: 1,
    video_id: '550e8400-e29b-41d4-a716-446655440000',
    user_id: '550e8400-e29b-41d4-a716-446655440001',
    content: 'Test danmaku content',
    time_point: 45.5,
    color: '#FF0000',
    type: 0,
    font_size: 25,
    created_at: '2024-01-15T10:30:00.000Z'
  };

  const mockDanmakuTop = {
    id: 2,
    video_id: '550e8400-e29b-41d4-a716-446655440000',
    user_id: '550e8400-e29b-41d4-a716-446655440001',
    content: 'Top danmaku',
    time_point: 60.0,
    color: '#FFFFFF',
    type: 1,
    font_size: 30,
    created_at: '2024-01-15T10:31:00.000Z'
  };

  const mockDanmakuBottom = {
    id: 3,
    video_id: '550e8400-e29b-41d4-a716-446655440000',
    user_id: '550e8400-e29b-41d4-a716-446655440002',
    content: 'Bottom danmaku',
    time_point: 120.0,
    color: '#00FF00',
    type: 2,
    font_size: 20,
    created_at: '2024-01-15T10:32:00.000Z'
  };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('serialize', () => {
    it('should serialize database row to camelCase object', () => {
      const result = Danmaku.serialize(mockDanmaku);

      expect(result).toEqual({
        id: '1',
        videoId: mockDanmaku.video_id,
        userId: mockDanmaku.user_id,
        content: mockDanmaku.content,
        timePoint: mockDanmaku.time_point,
        color: mockDanmaku.color,
        type: mockDanmaku.type,
        fontSize: mockDanmaku.font_size,
        createdAt: mockDanmaku.created_at
      });
    });

    it('should return null for null input', () => {
      const result = Danmaku.serialize(null);
      expect(result).toBeNull();
    });

    it('should return null for undefined input', () => {
      const result = Danmaku.serialize(undefined);
      expect(result).toBeNull();
    });

    it('should handle different types correctly', () => {
      expect(Danmaku.serialize(mockDanmakuTop).type).toBe(1);
      expect(Danmaku.serialize(mockDanmakuBottom).type).toBe(2);
    });

    it('should convert time_point to float', () => {
      const result = Danmaku.serialize(mockDanmaku);
      expect(typeof result.timePoint).toBe('number');
      expect(result.timePoint).toBe(45.5);
    });

    it('should convert id to string', () => {
      const result = Danmaku.serialize(mockDanmaku);
      expect(typeof result.id).toBe('string');
      expect(result.id).toBe('1');
    });

    it('should handle bigint id', () => {
      const row = { ...mockDanmaku, id: 9223372036854775807n };
      const result = Danmaku.serialize(row);
      expect(result.id).toBe('9223372036854775807');
    });
  });

  describe('create', () => {
    it('should create a new danmaku with all fields', async () => {
      query.mockResolvedValueOnce({ rows: [mockDanmaku], rowCount: 1 });

      const data = {
        videoId: mockDanmaku.video_id,
        userId: mockDanmaku.user_id,
        content: mockDanmaku.content,
        timePoint: mockDanmaku.time_point,
        color: mockDanmaku.color,
        type: mockDanmaku.type,
        fontSize: mockDanmaku.font_size
      };

      const result = await Danmaku.create(data);

      expect(query).toHaveBeenCalledWith(
        expect.stringContaining('INSERT INTO danmakus'),
        expect.arrayContaining([
          data.videoId,
          data.userId,
          data.content,
          data.timePoint,
          data.color,
          data.type,
          data.fontSize
        ])
      );

      expect(result).toMatchObject({
        videoId: data.videoId,
        userId: data.userId,
        content: data.content,
        timePoint: data.timePoint,
        color: data.color,
        type: data.type,
        fontSize: data.fontSize
      });
    });

    it('should create a danmaku with default values', async () => {
      const defaultDanmaku = {
        ...mockDanmaku,
        color: '#FFFFFF',
        type: 0,
        font_size: 25
      };
      query.mockResolvedValueOnce({ rows: [defaultDanmaku], rowCount: 1 });

      const data = {
        videoId: mockDanmaku.video_id,
        userId: mockDanmaku.user_id,
        content: 'Default test',
        timePoint: 10.0
      };

      const result = await Danmaku.create(data);

      expect(query).toHaveBeenCalledWith(
        expect.any(String),
        expect.arrayContaining([
          data.videoId,
          data.userId,
          data.content,
          data.timePoint,
          '#FFFFFF',
          0,
          25
        ])
      );

      expect(result.color).toBe('#FFFFFF');
      expect(result.type).toBe(0);
      expect(result.fontSize).toBe(25);
    });

    it('should handle database errors', async () => {
      query.mockRejectedValueOnce(new Error('Database error'));

      const data = {
        videoId: mockDanmaku.video_id,
        userId: mockDanmaku.user_id,
        content: 'Test',
        timePoint: 5.0
      };

      await expect(Danmaku.create(data)).rejects.toThrow('Database error');
    });

    it('should create danmaku with type 1 (top)', async () => {
      query.mockResolvedValueOnce({ rows: [mockDanmakuTop], rowCount: 1 });

      const data = {
        videoId: mockDanmakuTop.video_id,
        userId: mockDanmakuTop.user_id,
        content: mockDanmakuTop.content,
        timePoint: mockDanmakuTop.time_point,
        type: 1
      };

      const result = await Danmaku.create(data);
      expect(result.type).toBe(1);
    });

    it('should create danmaku with type 2 (bottom)', async () => {
      query.mockResolvedValueOnce({ rows: [mockDanmakuBottom], rowCount: 1 });

      const data = {
        videoId: mockDanmakuBottom.video_id,
        userId: mockDanmakuBottom.user_id,
        content: mockDanmakuBottom.content,
        timePoint: mockDanmakuBottom.time_point,
        type: 2
      };

      const result = await Danmaku.create(data);
      expect(result.type).toBe(2);
    });
  });

  describe('findByVideoAndTimeRange', () => {
    it('should find danmakus in time range with default options', async () => {
      query.mockResolvedValueOnce({
        rows: [mockDanmaku, mockDanmakuTop],
        rowCount: 2
      });

      const videoId = mockDanmaku.video_id;
      const startTime = 0;
      const endTime = 300;

      const results = await Danmaku.findByVideoAndTimeRange(videoId, startTime, endTime);

      expect(query).toHaveBeenCalledWith(
        expect.stringContaining('WHERE video_id = $1'),
        [videoId, startTime, endTime, 500, 0]
      );

      expect(results).toHaveLength(2);
      expect(results[0].videoId).toBe(videoId);
    });

    it('should find danmakus with custom limit and offset', async () => {
      query.mockResolvedValueOnce({
        rows: [mockDanmaku],
        rowCount: 1
      });

      const results = await Danmaku.findByVideoAndTimeRange(
        mockDanmaku.video_id,
        0,
        100,
        { limit: 10, offset: 5 }
      );

      expect(query).toHaveBeenCalledWith(
        expect.any(String),
        expect.arrayContaining([mockDanmaku.video_id, 0, 100, 10, 5])
      );

      expect(results).toHaveLength(1);
    });

    it('should find danmakus with custom ordering', async () => {
      query.mockResolvedValueOnce({
        rows: [mockDanmakuTop, mockDanmaku],
        rowCount: 2
      });

      const results = await Danmaku.findByVideoAndTimeRange(
        mockDanmaku.video_id,
        0,
        300,
        { orderBy: 'created_at DESC' }
      );

      expect(query).toHaveBeenCalledWith(
        expect.stringContaining('ORDER BY created_at DESC'),
        expect.any(Array)
      );
    });

    it('should return empty array when no results', async () => {
      query.mockResolvedValueOnce({ rows: [], rowCount: 0 });

      const results = await Danmaku.findByVideoAndTimeRange('non-existent', 0, 300);

      expect(results).toEqual([]);
    });

    it('should handle narrow time ranges', async () => {
      query.mockResolvedValueOnce({ rows: [mockDanmaku], rowCount: 1 });

      const results = await Danmaku.findByVideoAndTimeRange(
        mockDanmaku.video_id,
        45.0,
        46.0
      );

      expect(query).toHaveBeenCalledWith(
        expect.stringContaining('time_point >= $2 AND time_point <= $3'),
        expect.any(Array)
      );
    });
  });

  describe('findByVideoId', () => {
    it('should find all danmakus for a video', async () => {
      query.mockResolvedValueOnce({
        rows: [mockDanmaku, mockDanmakuTop, mockDanmakuBottom],
        rowCount: 3
      });

      const results = await Danmaku.findByVideoId(mockDanmaku.video_id);

      expect(query).toHaveBeenCalledWith(
        expect.stringContaining('WHERE video_id = $1'),
        expect.arrayContaining([mockDanmaku.video_id])
      );

      expect(results).toHaveLength(3);
    });

    it('should respect limit option', async () => {
      query.mockResolvedValueOnce({ rows: [mockDanmaku], rowCount: 1 });

      await Danmaku.findByVideoId(mockDanmaku.video_id, { limit: 1 });

      expect(query).toHaveBeenCalledWith(
        expect.any(String),
        expect.arrayContaining([mockDanmaku.video_id, 1, expect.any(Number)])
      );
    });

    it('should respect offset option', async () => {
      query.mockResolvedValueOnce({ rows: [], rowCount: 0 });

      await Danmaku.findByVideoId(mockDanmaku.video_id, { offset: 100 });

      expect(query).toHaveBeenCalledWith(
        expect.any(String),
        expect.arrayContaining([mockDanmaku.video_id, expect.any(Number), 100])
      );
    });
  });

  describe('getStats', () => {
    it('should return comprehensive statistics', async () => {
      query.mockResolvedValueOnce({
        rows: [{
          total_count: '150',
          unique_users: '45',
          avg_time_point: '75.5',
          max_time_point: '300.0',
          first_danmaku_at: '2024-01-15T08:00:00.000Z',
          last_danmaku_at: '2024-01-15T12:00:00.000Z',
          scroll_count: '100',
          top_count: '30',
          bottom_count: '20'
        }],
        rowCount: 1
      });

      const stats = await Danmaku.getStats(mockDanmaku.video_id);

      expect(query).toHaveBeenCalledWith(
        expect.stringContaining('SELECT'),
        [mockDanmaku.video_id]
      );

      expect(stats).toMatchObject({
        videoId: mockDanmaku.video_id,
        totalCount: 150,
        uniqueUsers: 45,
        avgTimePoint: 75.5,
        maxTimePoint: 300.0,
        typeDistribution: {
          scroll: 100,
          top: 30,
          bottom: 20
        }
      });
    });

    it('should handle zero danmakus', async () => {
      query.mockResolvedValueOnce({
        rows: [{
          total_count: '0',
          unique_users: '0',
          avg_time_point: null,
          max_time_point: null,
          first_danmaku_at: null,
          last_danmaku_at: null,
          scroll_count: '0',
          top_count: '0',
          bottom_count: '0'
        }],
        rowCount: 1
      });

      const stats = await Danmaku.getStats(mockDanmaku.video_id);

      expect(stats.totalCount).toBe(0);
      expect(stats.uniqueUsers).toBe(0);
      expect(stats.avgTimePoint).toBe(0);
      expect(stats.maxTimePoint).toBe(0);
    });

    it('should handle null values gracefully', async () => {
      query.mockResolvedValueOnce({
        rows: [{
          total_count: null,
          unique_users: null,
          avg_time_point: null,
          max_time_point: null,
          first_danmaku_at: null,
          last_danmaku_at: null,
          scroll_count: null,
          top_count: null,
          bottom_count: null
        }],
        rowCount: 1
      });

      const stats = await Danmaku.getStats(mockDanmaku.video_id);

      expect(stats.totalCount).toBe(0);
      expect(stats.uniqueUsers).toBe(0);
      expect(stats.avgTimePoint).toBe(0);
    });
  });

  describe('getTimeDistribution', () => {
    it('should return time distribution with default bucket size', async () => {
      query.mockResolvedValueOnce({
        rows: [
          { time_bucket: '0', count: '10' },
          { time_bucket: '30', count: '25' },
          { time_bucket: '60', count: '15' }
        ],
        rowCount: 3
      });

      const distribution = await Danmaku.getTimeDistribution(mockDanmaku.video_id);

      expect(query).toHaveBeenCalledWith(
        expect.stringContaining('FLOOR(time_point / $2)'),
        [mockDanmaku.video_id, 30]
      );

      expect(distribution).toHaveLength(3);
      expect(distribution[0]).toEqual({ timeBucket: 0, count: 10 });
      expect(distribution[1]).toEqual({ timeBucket: 30, count: 25 });
    });

    it('should return distribution with custom bucket size', async () => {
      query.mockResolvedValueOnce({
        rows: [
          { time_bucket: '0', count: '50' },
          { time_bucket: '60', count: '75' }
        ],
        rowCount: 2
      });

      const distribution = await Danmaku.getTimeDistribution(
        mockDanmaku.video_id,
        60
      );

      expect(query).toHaveBeenCalledWith(
        expect.any(String),
        [mockDanmaku.video_id, 60]
      );
    });

    it('should return empty array for no data', async () => {
      query.mockResolvedValueOnce({ rows: [], rowCount: 0 });

      const distribution = await Danmaku.getTimeDistribution(mockDanmaku.video_id);

      expect(distribution).toEqual([]);
    });
  });

  describe('countByVideoId', () => {
    it('should return count for video', async () => {
      query.mockResolvedValueOnce({ rows: [{ count: '150' }], rowCount: 1 });

      const count = await Danmaku.countByVideoId(mockDanmaku.video_id);

      expect(query).toHaveBeenCalledWith(
        expect.stringContaining('SELECT COUNT(*)'),
        [mockDanmaku.video_id]
      );

      expect(count).toBe(150);
    });

    it('should return 0 for no danmakus', async () => {
      query.mockResolvedValueOnce({ rows: [{ count: '0' }], rowCount: 1 });

      const count = await Danmaku.countByVideoId(mockDanmaku.video_id);

      expect(count).toBe(0);
    });
  });

  describe('countAtTimePoint', () => {
    it('should return count at specific time point', async () => {
      query.mockResolvedValueOnce({ rows: [{ count: '5' }], rowCount: 1 });

      const count = await Danmaku.countAtTimePoint(mockDanmaku.video_id, 45.5, 1);

      expect(query).toHaveBeenCalledWith(
        expect.stringContaining('time_point >= $2 AND time_point < $3'),
        expect.arrayContaining([mockDanmaku.video_id, 45.0, 46.0])
      );

      expect(count).toBe(5);
    });

    it('should use default window of 1 second', async () => {
      query.mockResolvedValueOnce({ rows: [{ count: '3' }], rowCount: 1 });

      await Danmaku.countAtTimePoint(mockDanmaku.video_id, 30.0);

      expect(query).toHaveBeenCalledWith(
        expect.any(String),
        expect.arrayContaining([mockDanmaku.video_id, 29.5, 30.5])
      );
    });

    it('should handle custom window sizes', async () => {
      query.mockResolvedValueOnce({ rows: [{ count: '10' }], rowCount: 1 });

      await Danmaku.countAtTimePoint(mockDanmaku.video_id, 60.0, 5);

      expect(query).toHaveBeenCalledWith(
        expect.any(String),
        expect.arrayContaining([mockDanmaku.video_id, 57.5, 62.5])
      );
    });
  });

  describe('deleteByVideoId', () => {
    it('should delete all danmakus for video', async () => {
      query.mockResolvedValueOnce({
        rows: [{ id: 1 }, { id: 2 }],
        rowCount: 2
      });

      const count = await Danmaku.deleteByVideoId(mockDanmaku.video_id);

      expect(query).toHaveBeenCalledWith(
        expect.stringContaining('DELETE FROM danmakus'),
        [mockDanmaku.video_id]
      );

      expect(count).toBe(2);
    });

    it('should return 0 when no danmakus to delete', async () => {
      query.mockResolvedValueOnce({ rows: [], rowCount: 0 });

      const count = await Danmaku.deleteByVideoId(mockDanmaku.video_id);

      expect(count).toBe(0);
    });
  });

  describe('deleteOlderThan', () => {
    it('should delete old danmakus', async () => {
      query.mockResolvedValueOnce({
        rows: [{ id: 1 }, { id: 2 }],
        rowCount: 2
      });

      const count = await Danmaku.deleteOlderThan(30);

      expect(query).toHaveBeenCalledWith(
        expect.stringContaining('DELETE FROM danmakus'),
        expect.any(Array)
      );

      expect(count).toBe(2);
    });
  });

  describe('findRecent', () => {
    it('should return recent danmakus with default limit', async () => {
      query.mockResolvedValueOnce({
        rows: [mockDanmaku, mockDanmakuTop],
        rowCount: 2
      });

      const results = await Danmaku.findRecent();

      expect(query).toHaveBeenCalledWith(
        expect.stringContaining('ORDER BY created_at DESC'),
        [100]
      );

      expect(results).toHaveLength(2);
    });

    it('should return recent danmakus with custom limit', async () => {
      query.mockResolvedValueOnce({ rows: [mockDanmaku], rowCount: 1 });

      const results = await Danmaku.findRecent(5);

      expect(query).toHaveBeenCalledWith(expect.any(String), [5]);
      expect(results).toHaveLength(1);
    });
  });

  describe('findByUserId', () => {
    it('should return user danmaku history with default options', async () => {
      query.mockResolvedValueOnce({
        rows: [mockDanmaku, mockDanmakuTop],
        rowCount: 2
      });

      const results = await Danmaku.findByUserId(mockDanmaku.user_id);

      expect(query).toHaveBeenCalledWith(
        expect.stringContaining('WHERE user_id = $1'),
        [mockDanmaku.user_id, 50, 0]
      );

      expect(results).toHaveLength(2);
    });

    it('should return user history with custom limit and offset', async () => {
      query.mockResolvedValueOnce({ rows: [], rowCount: 0 });

      await Danmaku.findByUserId(mockDanmaku.user_id, { limit: 10, offset: 20 });

      expect(query).toHaveBeenCalledWith(
        expect.any(String),
        [mockDanmaku.user_id, 10, 20]
      );
    });

    it('should order by created_at DESC', async () => {
      query.mockResolvedValueOnce({ rows: [], rowCount: 0 });

      await Danmaku.findByUserId(mockDanmaku.user_id);

      expect(query).toHaveBeenCalledWith(
        expect.stringContaining('ORDER BY created_at DESC'),
        expect.any(Array)
      );
    });
  });

  describe('edge cases and error handling', () => {
    it('should handle very long content at boundary', async () => {
      const longContent = 'a'.repeat(100);
      const row = { ...mockDanmaku, content: longContent };
      query.mockResolvedValueOnce({ rows: [row], rowCount: 1 });

      const data = {
        videoId: mockDanmaku.video_id,
        userId: mockDanmaku.user_id,
        content: longContent,
        timePoint: 1.0
      };

      const result = await Danmaku.create(data);
      expect(result.content).toBe(longContent);
    });

    it('should handle zero time point', async () => {
      const row = { ...mockDanmaku, time_point: 0 };
      query.mockResolvedValueOnce({ rows: [row], rowCount: 1 });

      const data = {
        videoId: mockDanmaku.video_id,
        userId: mockDanmaku.user_id,
        content: 'Start',
        timePoint: 0
      };

      const result = await Danmaku.create(data);
      expect(result.timePoint).toBe(0);
    });

    it('should handle floating point time values precisely', async () => {
      const row = { ...mockDanmaku, time_point: 123.456789 };
      query.mockResolvedValueOnce({ rows: [row], rowCount: 1 });

      const data = {
        videoId: mockDanmaku.video_id,
        userId: mockDanmaku.user_id,
        content: 'Precise time',
        timePoint: 123.456789
      };

      const result = await Danmaku.create(data);
      expect(result.timePoint).toBeCloseTo(123.456789, 6);
    });

    it('should handle empty string content with trim consideration', async () => {
      query.mockRejectedValueOnce(new Error('check constraint violation'));

      const data = {
        videoId: mockDanmaku.video_id,
        userId: mockDanmaku.user_id,
        content: '',
        timePoint: 1.0
      };

      await expect(Danmaku.create(data)).rejects.toThrow();
    });

    it('should handle different video UUIDs', async () => {
      const differentVideoId = '123e4567-e89b-12d3-a456-426614174000';
      query.mockResolvedValueOnce({ rows: [], rowCount: 0 });

      await Danmaku.findByVideoId(differentVideoId);

      expect(query).toHaveBeenCalledWith(
        expect.any(String),
        expect.arrayContaining([differentVideoId])
      );
    });

    it('should handle concurrent queries independently', async () => {
      query
        .mockResolvedValueOnce({ rows: [mockDanmaku], rowCount: 1 })
        .mockResolvedValueOnce({ rows: [{ count: '50' }], rowCount: 1 });

      const [danmakus, count] = await Promise.all([
        Danmaku.findByVideoId(mockDanmaku.video_id),
        Danmaku.countByVideoId(mockDanmaku.video_id)
      ]);

      expect(danmakus).toHaveLength(1);
      expect(count).toBe(50);
      expect(query).toHaveBeenCalledTimes(2);
    });

    it('should handle special characters in content', async () => {
      const specialContent = 'Hello! @#$%^&*() <> [] {} | "quotes" \'apostrophe\' 中文 🎉';
      const row = { ...mockDanmaku, content: specialContent };
      query.mockResolvedValueOnce({ rows: [row], rowCount: 1 });

      const data = {
        videoId: mockDanmaku.video_id,
        userId: mockDanmaku.user_id,
        content: specialContent,
        timePoint: 5.0
      };

      const result = await Danmaku.create(data);
      expect(result.content).toBe(specialContent);
    });

    it('should handle all three types in single query', async () => {
      query.mockResolvedValueOnce({
        rows: [mockDanmaku, mockDanmakuTop, mockDanmakuBottom],
        rowCount: 3
      });

      const results = await Danmaku.findByVideoId(mockDanmaku.video_id);

      const types = results.map(r => r.type).sort();
      expect(types).toEqual([0, 1, 2]);
    });

    it('should handle very large time points', async () => {
      const row = { ...mockDanmaku, time_point: 86400 }; // 24 hours
      query.mockResolvedValueOnce({ rows: [row], rowCount: 1 });

      const data = {
        videoId: mockDanmaku.video_id,
        userId: mockDanmaku.user_id,
        content: 'Long video',
        timePoint: 86400
      };

      const result = await Danmaku.create(data);
      expect(result.timePoint).toBe(86400);
    });
  });
});
