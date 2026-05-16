const EventPublisher = require('../../src/events/publisher');
const {
  publishCommentCreated,
  publishCommentDeleted,
  publishCommentLiked,
  publishCommentReply,
  isConnected
} = require('../../src/config/rabbitmq');

describe('EventPublisher', () => {
  const mockComment = {
    id: '550e8400-e29b-41d4-a716-446655440000',
    videoId: '550e8400-e29b-41d4-a716-446655440001',
    userId: '550e8400-e29b-41d4-a716-446655440002',
    parentId: null,
    content: 'Test comment',
    createdAt: '2024-01-15T10:30:00.000Z'
  };

  let publisher;

  beforeEach(() => {
    publisher = new EventPublisher();
    publisher.setEnabled(true);
    jest.clearAllMocks();
  });

  describe('isAvailable', () => {
    it('should return true when enabled and connected', () => {
      isConnected.mockReturnValue(true);

      expect(publisher.isAvailable()).toBe(true);
    });

    it('should return false when disabled', () => {
      publisher.setEnabled(false);
      isConnected.mockReturnValue(true);

      expect(publisher.isAvailable()).toBe(false);
    });

    it('should return false when not connected', () => {
      isConnected.mockReturnValue(false);

      expect(publisher.isAvailable()).toBe(false);
    });
  });

  describe('commentCreated', () => {
    it('should publish comment created event', async () => {
      publishCommentCreated.mockResolvedValueOnce(true);

      await publisher.commentCreated(mockComment);

      expect(publishCommentCreated).toHaveBeenCalledWith(mockComment);
    });

    it('should handle publish failure with fallback', async () => {
      publishCommentCreated.mockResolvedValueOnce(false);

      // Should not throw
      await expect(publisher.commentCreated(mockComment)).resolves.not.toThrow();
    });

    it('should not publish when disabled', async () => {
      publisher.setEnabled(false);

      await publisher.commentCreated(mockComment);

      expect(publishCommentCreated).not.toHaveBeenCalled();
    });

    it('should retry on failure', async () => {
      publishCommentCreated
        .mockRejectedValueOnce(new Error('Connection lost'))
        .mockResolvedValueOnce(true);

      await publisher.commentCreated(mockComment);

      expect(publishCommentCreated).toHaveBeenCalledTimes(2);
    });

    it('should fail after all retries', async () => {
      publishCommentCreated.mockRejectedValue(new Error('Persistent failure'));

      // Should not throw, just log
      await expect(publisher.commentCreated(mockComment)).resolves.not.toThrow();
      expect(publishCommentCreated).toHaveBeenCalledTimes(3);
    });
  });

  describe('commentDeleted', () => {
    it('should publish comment deleted event', async () => {
      publishCommentDeleted.mockResolvedValueOnce(true);

      await publisher.commentDeleted({
        commentId: mockComment.id,
        videoId: mockComment.videoId,
        userId: mockComment.userId
      });

      expect(publishCommentDeleted).toHaveBeenCalled();
    });

    it('should handle publish failure', async () => {
      publishCommentDeleted.mockResolvedValueOnce(false);

      await expect(
        publisher.commentDeleted({
          commentId: mockComment.id,
          videoId: mockComment.videoId,
          userId: mockComment.userId
        })
      ).resolves.not.toThrow();
    });
  });

  describe('commentLiked', () => {
    it('should publish comment liked event', async () => {
      publishCommentLiked.mockResolvedValueOnce(true);

      await publisher.commentLiked({
        commentId: mockComment.id,
        userId: mockComment.userId,
        videoId: mockComment.videoId
      });

      expect(publishCommentLiked).toHaveBeenCalled();
    });

    it('should handle publish failure', async () => {
      publishCommentLiked.mockResolvedValueOnce(false);

      await expect(
        publisher.commentLiked({
          commentId: mockComment.id,
          userId: mockComment.userId,
          videoId: mockComment.videoId
        })
      ).resolves.not.toThrow();
    });
  });

  describe('commentReply', () => {
    it('should publish comment reply event', async () => {
      publishCommentReply.mockResolvedValueOnce(true);

      await publisher.commentReply({
        commentId: 'reply-id',
        parentId: mockComment.id,
        userId: mockComment.userId,
        videoId: mockComment.videoId
      });

      expect(publishCommentReply).toHaveBeenCalled();
    });

    it('should handle publish failure', async () => {
      publishCommentReply.mockResolvedValueOnce(false);

      await expect(
        publisher.commentReply({
          commentId: 'reply-id',
          parentId: mockComment.id,
          userId: mockComment.userId,
          videoId: mockComment.videoId
        })
      ).resolves.not.toThrow();
    });
  });

  describe('publishBatch', () => {
    it('should publish multiple events', async () => {
      publishCommentCreated.mockResolvedValue(true);
      publishCommentLiked.mockResolvedValue(true);

      const events = [
        { type: 'comment.created', data: mockComment },
        { type: 'comment.liked', data: { commentId: mockComment.id, userId: mockComment.userId } }
      ];

      const results = await publisher.publishBatch(events);

      expect(results).toHaveLength(2);
      expect(results[0].published).toBe(true);
      expect(results[1].published).toBe(true);
    });

    it('should handle partial failures', async () => {
      publishCommentCreated.mockResolvedValue(true);
      publishCommentLiked.mockRejectedValue(new Error('Failed'));

      const events = [
        { type: 'comment.created', data: mockComment },
        { type: 'comment.liked', data: { commentId: mockComment.id } }
      ];

      const results = await publisher.publishBatch(events);

      expect(results[0].published).toBe(true);
      expect(results[1].published).toBe(false);
      expect(results[1].error).toBeDefined();
    });

    it('should skip unknown event types', async () => {
      const events = [
        { type: 'unknown.event', data: {} }
      ];

      const results = await publisher.publishBatch(events);

      expect(results[0].published).toBe(false);
    });

    it('should return empty for empty array', async () => {
      const results = await publisher.publishBatch([]);

      expect(results).toBeUndefined();
    });

    it('should not publish when disabled', async () => {
      publisher.setEnabled(false);

      const events = [
        { type: 'comment.created', data: mockComment }
      ];

      await publisher.publishBatch(events);

      expect(publishCommentCreated).not.toHaveBeenCalled();
    });
  });

  describe('retryPublish', () => {
    it('should succeed on first attempt', async () => {
      const fn = jest.fn().mockResolvedValue(true);

      const result = await publisher.retryPublish(fn);

      expect(result).toBe(true);
      expect(fn).toHaveBeenCalledTimes(1);
    });

    it('should retry on failure and eventually succeed', async () => {
      const fn = jest.fn()
        .mockRejectedValueOnce(new Error('Error 1'))
        .mockRejectedValueOnce(new Error('Error 2'))
        .mockResolvedValueOnce(true);

      const result = await publisher.retryPublish(fn);

      expect(result).toBe(true);
      expect(fn).toHaveBeenCalledTimes(3);
    });

    it('should fail after all attempts exhausted', async () => {
      const fn = jest.fn().mockRejectedValue(new Error('Always fails'));

      const result = await publisher.retryPublish(fn, 3);

      expect(result).toBe(false);
      expect(fn).toHaveBeenCalledTimes(3);
    });

    it('should respect custom attempt count', async () => {
      const fn = jest.fn().mockRejectedValue(new Error('Fail'));

      await publisher.retryPublish(fn, 5);

      expect(fn).toHaveBeenCalledTimes(5);
    });

    it('should add increasing delays between retries', async () => {
      const fn = jest.fn()
        .mockRejectedValueOnce(new Error('Error 1'))
        .mockRejectedValueOnce(new Error('Error 2'))
        .mockRejectedValueOnce(new Error('Error 3'));

      const start = Date.now();
      await publisher.retryPublish(fn, 4);
      const elapsed = Date.now() - start;

      // Should have some delay (at least 100ms + 200ms + 300ms = 600ms)
      expect(elapsed).toBeGreaterThanOrEqual(500);
    });
  });

  describe('getHealth', () => {
    it('should return health status', () => {
      isConnected.mockReturnValue(true);

      const health = publisher.getHealth();

      expect(health).toMatchObject({
        enabled: true,
        connected: true,
        available: true,
        fallbackToLog: true,
        retryAttempts: 3
      });
    });

    it('should reflect disabled state', () => {
      publisher.setEnabled(false);
      isConnected.mockReturnValue(true);

      const health = publisher.getHealth();

      expect(health.enabled).toBe(false);
      expect(health.available).toBe(false);
    });
  });

  describe('singleton behavior', () => {
    it('should share state across requires', () => {
      const Publisher1 = require('../../src/events/publisher');
      const Publisher2 = require('../../src/events/publisher');

      expect(Publisher1).toBe(Publisher2);
    });
  });

  describe('error handling', () => {
    it('should handle publish throwing sync error', async () => {
      publishCommentCreated.mockImplementation(() => {
        throw new Error('Sync error');
      });

      await expect(publisher.commentCreated(mockComment)).resolves.not.toThrow();
    });

    it('should handle malformed event data', async () => {
      publishCommentCreated.mockResolvedValue(true);

      await expect(
        publisher.commentCreated(null)
      ).resolves.not.toThrow();
    });

    it('should handle undefined event data', async () => {
      publishCommentCreated.mockResolvedValue(true);

      await expect(
        publisher.commentCreated(undefined)
      ).resolves.not.toThrow();
    });
  });
});
