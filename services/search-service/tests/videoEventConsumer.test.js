const VideoEventConsumer = require('../src/consumers/videoEventConsumer');
const logger = require('../src/utils/logger');

jest.mock('../src/utils/logger', () => ({
  info: jest.fn(),
  error: jest.fn(),
  warn: jest.fn(),
  debug: jest.fn(),
}));

describe('VideoEventConsumer', () => {
  let consumer;
  let mockChannel;
  let mockIndexingService;
  let mockSearchService;

  beforeEach(() => {
    jest.clearAllMocks();

    mockChannel = {
      assertQueue: jest.fn().mockResolvedValue(),
      bindQueue: jest.fn().mockResolvedValue(),
      consume: jest.fn().mockResolvedValue({ consumerTag: 'tag-001' }),
      ack: jest.fn(),
      nack: jest.fn(),
      cancel: jest.fn().mockResolvedValue(),
    };

    mockIndexingService = {
      indexVideo: jest.fn().mockResolvedValue({ result: 'created' }),
      deleteVideo: jest.fn().mockResolvedValue({ result: 'deleted' }),
      updateVideoStats: jest.fn().mockResolvedValue({ result: 'updated' }),
    };

    mockSearchService = {
      updateTrendingSearches: jest.fn(),
    };

    jest.spyOn(require('../src/services/indexingService'), 'getIndexingService').mockReturnValue(mockIndexingService);
    jest.spyOn(require('../src/services/searchService'), 'getSearchService').mockReturnValue(mockSearchService);

    consumer = new VideoEventConsumer(mockChannel);
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  describe('startConsuming', () => {
    it('should start consuming events', async () => {
      await consumer.startConsuming();

      expect(mockChannel.assertQueue).toHaveBeenCalled();
      expect(mockChannel.consume).toHaveBeenCalled();
      expect(consumer.isConsuming).toBe(true);
      expect(consumer.consumerTag).toBe('tag-001');
    });

    it('should not start if already consuming', async () => {
      await consumer.startConsuming();
      await consumer.startConsuming();

      expect(mockChannel.consume).toHaveBeenCalledTimes(1);
    });

    it('should throw error on setup failure', async () => {
      mockChannel.assertQueue.mockRejectedValue(new Error('Channel error'));

      await expect(consumer.startConsuming()).rejects.toThrow('Channel error');
    });

    it('should bind to all video event routing keys', async () => {
      await consumer.startConsuming();

      expect(mockChannel.bindQueue).toHaveBeenCalledWith(
        expect.any(String),
        'sukaczev.events',
        'video.published'
      );
      expect(mockChannel.bindQueue).toHaveBeenCalledWith(
        expect.any(String),
        'sukaczev.events',
        'video.updated'
      );
      expect(mockChannel.bindQueue).toHaveBeenCalledWith(
        expect.any(String),
        'sukaczev.events',
        'video.deleted'
      );
      expect(mockChannel.bindQueue).toHaveBeenCalledWith(
        expect.any(String),
        'sukaczev.events',
        'video.stats.updated'
      );
    });

    it('should configure DLQ arguments', async () => {
      await consumer.startConsuming();

      expect(mockChannel.assertQueue).toHaveBeenCalledWith(
        expect.any(String),
        expect.objectContaining({
          durable: true,
          arguments: expect.objectContaining({
            'x-dead-letter-exchange': '',
            'x-dead-letter-routing-key': expect.stringContaining('.dlq'),
          }),
        })
      );
    });
  });

  describe('handleEvent', () => {
    beforeEach(async () => {
      await consumer.startConsuming();
    });

    it('should handle video.published event', async () => {
      const content = {
        id: 'vid-001',
        title: 'New Video',
        description: 'Description',
        userId: 'user-001',
        username: 'TestUser',
        category: 'tech',
        tags: ['test'],
        views: 0,
        likes: 0,
        duration: 300,
        createdAt: '2024-01-01T00:00:00Z',
      };

      await consumer.handleEvent('video.published', content);

      expect(mockIndexingService.indexVideo).toHaveBeenCalledWith(
        expect.objectContaining({
          id: 'vid-001',
          title: 'New Video',
          username: 'TestUser',
        })
      );
    });

    it('should handle video.updated event', async () => {
      const content = {
        id: 'vid-001',
        title: 'Updated Video',
        description: 'Updated Description',
        userId: 'user-001',
        username: 'TestUser',
        category: 'anime',
        tags: ['anime'],
        views: 100,
        likes: 10,
        duration: 600,
      };

      await consumer.handleEvent('video.updated', content);

      expect(mockIndexingService.indexVideo).toHaveBeenCalledWith(
        expect.objectContaining({ id: 'vid-001', title: 'Updated Video' })
      );
    });

    it('should handle video.deleted event', async () => {
      const content = { id: 'vid-001' };

      await consumer.handleEvent('video.deleted', content);

      expect(mockIndexingService.deleteVideo).toHaveBeenCalledWith('vid-001');
    });

    it('should handle video.stats.updated event', async () => {
      const content = { id: 'vid-001', views: 5000, likes: 500 };

      await consumer.handleEvent('video.stats.updated', content);

      expect(mockIndexingService.updateVideoStats).toHaveBeenCalledWith('vid-001', {
        views: 5000,
        likes: 500,
      });
    });

    it('should handle unknown event types', async () => {
      const content = { id: 'vid-001' };

      await consumer.handleEvent('video.unknown', content);

      expect(mockIndexingService.indexVideo).not.toHaveBeenCalled();
      expect(mockIndexingService.deleteVideo).not.toHaveBeenCalled();
    });

    it('should throw error when video.deleted missing id', async () => {
      await expect(consumer.handleEvent('video.deleted', {})).rejects.toThrow(
        'Video ID is required for deletion'
      );
    });

    it('should throw error when video.stats.updated missing id', async () => {
      await expect(consumer.handleEvent('video.stats.updated', { views: 100 })).rejects.toThrow(
        'Video ID is required for stats update'
      );
    });
  });

  describe('handleVideoPublished', () => {
    it('should normalize and index video', async () => {
      const content = {
        id: 'vid-001',
        title: 'Test Video',
        description: 'Test Description',
        user_id: 'user-001',
        uploaderName: 'TestUser',
        category: 'tech',
        tags: ['test'],
        views: 0,
        likes: 0,
        duration: 300,
        created_at: '2024-01-01T00:00:00Z',
      };

      await consumer.handleVideoPublished(content);

      expect(mockIndexingService.indexVideo).toHaveBeenCalledWith(
        expect.objectContaining({
          id: 'vid-001',
          userId: 'user-001',
          username: 'TestUser',
        })
      );
    });
  });

  describe('handleVideoDeleted', () => {
    it('should delete video from index', async () => {
      await consumer.handleVideoDeleted({ id: 'vid-001' });

      expect(mockIndexingService.deleteVideo).toHaveBeenCalledWith('vid-001');
    });
  });

  describe('handleVideoStatsUpdated', () => {
    it('should update video stats in index', async () => {
      await consumer.handleVideoStatsUpdated({ id: 'vid-001', views: 100, likes: 10 });

      expect(mockIndexingService.updateVideoStats).toHaveBeenCalledWith('vid-001', {
        views: 100,
        likes: 10,
      });
    });
  });

  describe('stopConsuming', () => {
    beforeEach(async () => {
      await consumer.startConsuming();
    });

    it('should stop consuming', async () => {
      await consumer.stopConsuming();

      expect(mockChannel.cancel).toHaveBeenCalledWith('tag-001');
      expect(consumer.isConsuming).toBe(false);
      expect(consumer.consumerTag).toBeNull();
    });

    it('should handle stop without consumer tag', async () => {
      consumer.consumerTag = null;
      consumer.isConsuming = true;

      await consumer.stopConsuming();

      expect(mockChannel.cancel).not.toHaveBeenCalled();
      expect(consumer.isConsuming).toBe(false);
    });
  });

  describe('_normalizeVideoData', () => {
    it('should normalize complete video data', () => {
      const content = {
        id: 'vid-001',
        title: 'Test',
        description: 'Desc',
        userId: 'u1',
        username: 'User',
        category: 'tech',
        tags: ['t1'],
        views: 100,
        likes: 10,
        duration: 300,
        coverUrl: 'https://example.com/cover.jpg',
        videoUrl: 'https://example.com/video.mp4',
        createdAt: '2024-01-01T00:00:00Z',
        updatedAt: '2024-01-02T00:00:00Z',
      };

      const result = consumer._normalizeVideoData(content);

      expect(result.id).toBe('vid-001');
      expect(result.title).toBe('Test');
      expect(result.userId).toBe('u1');
      expect(result.username).toBe('User');
      expect(result.category).toBe('tech');
      expect(result.tags).toEqual(['t1']);
      expect(result.views).toBe(100);
      expect(result.likes).toBe(10);
      expect(result.duration).toBe(300);
    });

    it('should handle snake_case fields', () => {
      const content = {
        id: 'vid-001',
        title: 'Test',
        user_id: 'u1',
        uploaderName: 'Uploader',
        cover_url: 'https://example.com/cover.jpg',
        video_url: 'https://example.com/video.mp4',
        created_at: '2024-01-01T00:00:00Z',
      };

      const result = consumer._normalizeVideoData(content);

      expect(result.userId).toBe('u1');
      expect(result.username).toBe('Uploader');
      expect(result.coverUrl).toBe('https://example.com/cover.jpg');
      expect(result.videoUrl).toBe('https://example.com/video.mp4');
    });

    it('should use camelCase over snake_case', () => {
      const content = {
        id: 'vid-001',
        title: 'Test',
        userId: 'u1',
        user_id: 'u2',
      };

      const result = consumer._normalizeVideoData(content);

      expect(result.userId).toBe('u1');
    });

    it('should apply default values', () => {
      const content = {
        id: 'vid-001',
        title: 'Test',
      };

      const result = consumer._normalizeVideoData(content);

      expect(result.description).toBe('');
      expect(result.category).toBe('other');
      expect(result.tags).toEqual([]);
      expect(result.views).toBe(0);
      expect(result.likes).toBe(0);
      expect(result.duration).toBe(0);
      expect(result.coverUrl).toBe('');
      expect(result.videoUrl).toBe('');
    });

    it('should set timestamps if missing', () => {
      const content = {
        id: 'vid-001',
        title: 'Test',
      };

      const result = consumer._normalizeVideoData(content);

      expect(result.createdAt).toBeDefined();
      expect(result.updatedAt).toBeDefined();
      expect(new Date(result.createdAt)).toBeInstanceOf(Date);
    });
  });

  describe('message processing', () => {
    beforeEach(async () => {
      await consumer.startConsuming();
    });

    it('should process valid message', async () => {
      const messageHandler = mockChannel.consume.mock.calls[0][1];
      const msg = {
        content: Buffer.from(JSON.stringify({ id: 'vid-001', title: 'Test' })),
        fields: { routingKey: 'video.published' },
      };

      await messageHandler(msg);

      expect(mockIndexingService.indexVideo).toHaveBeenCalled();
      expect(mockChannel.ack).toHaveBeenCalledWith(msg);
    });

    it('should nack message on processing error', async () => {
      mockIndexingService.indexVideo.mockRejectedValue(new Error('Index failed'));

      const messageHandler = mockChannel.consume.mock.calls[0][1];
      const msg = {
        content: Buffer.from(JSON.stringify({ id: 'vid-001', title: 'Test' })),
        fields: { routingKey: 'video.published' },
      };

      await messageHandler(msg);

      expect(mockChannel.nack).toHaveBeenCalledWith(msg, false, false);
    });

    it('should skip null messages', async () => {
      const messageHandler = mockChannel.consume.mock.calls[0][1];

      await messageHandler(null);

      expect(mockIndexingService.indexVideo).not.toHaveBeenCalled();
      expect(mockChannel.ack).not.toHaveBeenCalled();
    });

    it('should handle invalid JSON in message', async () => {
      const messageHandler = mockChannel.consume.mock.calls[0][1];
      const msg = {
        content: Buffer.from('invalid json{'),
        fields: { routingKey: 'video.published' },
      };

      await messageHandler(msg);

      expect(mockChannel.nack).toHaveBeenCalled();
    });
  });
});
