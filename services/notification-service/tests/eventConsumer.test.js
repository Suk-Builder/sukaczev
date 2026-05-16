const EventConsumer = require('../src/consumers/eventConsumer');
const logger = require('../src/utils/logger');

jest.mock('../src/utils/logger', () => ({
  info: jest.fn(),
  error: jest.fn(),
  warn: jest.fn(),
  debug: jest.fn(),
}));

describe('EventConsumer', () => {
  let consumer;
  let mockChannel;
  let mockWsServer;
  let mockNotificationService;

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

    mockWsServer = {
      sendNotification: jest.fn().mockReturnValue(true),
      sendUnreadCount: jest.fn(),
    };

    mockNotificationService = {
      createNotification: jest.fn(),
      createWithAggregation: jest.fn(),
      updateUnreadCache: jest.fn().mockResolvedValue(5),
    };

    jest.spyOn(require('../src/services/notificationService'), 'getNotificationService')
      .mockReturnValue(mockNotificationService);

    consumer = new EventConsumer(mockChannel, mockWsServer);
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

    it('should throw on setup failure', async () => {
      mockChannel.assertQueue.mockRejectedValue(new Error('Channel error'));

      await expect(consumer.startConsuming()).rejects.toThrow('Channel error');
    });

    it('should bind to all event patterns', async () => {
      await consumer.startConsuming();

      expect(mockChannel.bindQueue).toHaveBeenCalledTimes(4);
      expect(mockChannel.bindQueue).toHaveBeenCalledWith(
        expect.any(String),
        'sukaczev.events',
        'comment.*'
      );
      expect(mockChannel.bindQueue).toHaveBeenCalledWith(
        expect.any(String),
        'sukaczev.events',
        'video.*'
      );
      expect(mockChannel.bindQueue).toHaveBeenCalledWith(
        expect.any(String),
        'sukaczev.events',
        'user.*'
      );
      expect(mockChannel.bindQueue).toHaveBeenCalledWith(
        expect.any(String),
        'sukaczev.events',
        'system.*'
      );
    });

    it('should configure DLQ', async () => {
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

    it('should route comment events', async () => {
      const mockNotification = {
        toJSON: () => ({ id: 'notif-001' }),
      };
      mockNotificationService.createWithAggregation.mockResolvedValue(mockNotification);

      await consumer.handleEvent('comment.replied', {
        parentCommentUserId: 'user-001',
        replierId: 'user-002',
        replierName: 'TestUser',
        replyId: 'reply-001',
        commentId: 'comment-001',
        videoId: 'vid-001',
        videoTitle: 'Test Video',
      });

      expect(mockNotificationService.createWithAggregation).toHaveBeenCalled();
    });

    it('should route video events', async () => {
      const mockNotification = {
        toJSON: () => ({ id: 'notif-001' }),
      };
      mockNotificationService.createWithAggregation.mockResolvedValue(mockNotification);

      await consumer.handleEvent('video.liked', {
        videoOwnerId: 'user-001',
        likerId: 'user-002',
        likerName: 'TestUser',
        videoId: 'vid-001',
        videoTitle: 'Test Video',
      });

      expect(mockNotificationService.createWithAggregation).toHaveBeenCalled();
    });

    it('should route user events', async () => {
      const mockNotification = {
        toJSON: () => ({ id: 'notif-001' }),
      };
      mockNotificationService.createNotification.mockResolvedValue(mockNotification);

      await consumer.handleEvent('user.followed', {
        followeeId: 'user-001',
        followerId: 'user-002',
        followerName: 'TestUser',
      });

      expect(mockNotificationService.createNotification).toHaveBeenCalled();
    });

    it('should route system broadcast', async () => {
      const mockNotification = {
        toJSON: () => ({ id: 'notif-001' }),
      };
      mockNotificationService.createNotification.mockResolvedValue(mockNotification);

      await consumer.handleEvent('system.broadcast', {
        userIds: ['user-001', 'user-002'],
        title: 'Announcement',
        body: 'System update',
      });

      expect(mockNotificationService.createNotification).toHaveBeenCalledTimes(2);
    });

    it('should route system announcement', async () => {
      const mockNotification = {
        toJSON: () => ({ id: 'notif-001' }),
      };
      mockNotificationService.createNotification.mockResolvedValue(mockNotification);

      await consumer.handleEvent('system.announcement', {
        userId: 'user-001',
        title: 'Announcement',
        body: 'Personal announcement',
      });

      expect(mockNotificationService.createNotification).toHaveBeenCalled();
    });

    it('should handle unknown domain', async () => {
      await consumer.handleEvent('unknown.action', {});

      expect(mockNotificationService.createNotification).not.toHaveBeenCalled();
    });
  });

  describe('handleCommentEvent', () => {
    it('should handle comment.replied', async () => {
      const mockNotification = {
        toJSON: () => ({ id: 'notif-001' }),
      };
      mockNotificationService.createWithAggregation.mockResolvedValue(mockNotification);

      await consumer.handleCommentEvent('replied', {
        parentCommentUserId: 'user-001',
        replierId: 'user-002',
        replierName: 'TestUser',
        replyId: 'reply-001',
        commentId: 'comment-001',
        videoId: 'vid-001',
        videoTitle: 'Test Video',
      });

      expect(mockNotificationService.createWithAggregation).toHaveBeenCalledWith(
        expect.objectContaining({
          userId: 'user-001',
          type: 'comment_reply',
          senderId: 'user-002',
        })
      );
    });

    it('should skip self-replies', async () => {
      await consumer.handleCommentEvent('replied', {
        parentCommentUserId: 'user-001',
        replierId: 'user-001',
      });

      expect(mockNotificationService.createWithAggregation).not.toHaveBeenCalled();
    });

    it('should skip missing parentCommentUserId', async () => {
      await consumer.handleCommentEvent('replied', {
        replierId: 'user-002',
      });

      expect(mockNotificationService.createWithAggregation).not.toHaveBeenCalled();
    });

    it('should handle comment.mentioned', async () => {
      const mockNotification = {
        toJSON: () => ({ id: 'notif-001' }),
      };
      mockNotificationService.createNotification.mockResolvedValue(mockNotification);

      await consumer.handleCommentEvent('mentioned', {
        mentionedUserId: 'user-001',
        mentionerId: 'user-002',
        mentionerName: 'TestUser',
        commentId: 'comment-001',
        videoId: 'vid-001',
        videoTitle: 'Test Video',
      });

      expect(mockNotificationService.createNotification).toHaveBeenCalledWith(
        expect.objectContaining({
          userId: 'user-001',
          type: 'comment_reply',
          senderId: 'user-002',
          metadata: expect.objectContaining({ isMention: true }),
        })
      );
    });

    it('should skip self-mentions', async () => {
      await consumer.handleCommentEvent('mentioned', {
        mentionedUserId: 'user-001',
        mentionerId: 'user-001',
      });

      expect(mockNotificationService.createNotification).not.toHaveBeenCalled();
    });

    it('should skip missing mentionedUserId', async () => {
      await consumer.handleCommentEvent('mentioned', {
        mentionerId: 'user-002',
      });

      expect(mockNotificationService.createNotification).not.toHaveBeenCalled();
    });

    it('should handle unknown comment action', async () => {
      await consumer.handleCommentEvent('unknown', {});

      expect(mockNotificationService.createNotification).not.toHaveBeenCalled();
    });
  });

  describe('handleVideoEvent', () => {
    it('should handle video.liked', async () => {
      const mockNotification = {
        toJSON: () => ({ id: 'notif-001' }),
      };
      mockNotificationService.createWithAggregation.mockResolvedValue(mockNotification);

      await consumer.handleVideoEvent('liked', {
        videoOwnerId: 'user-001',
        likerId: 'user-002',
        likerName: 'TestUser',
        videoId: 'vid-001',
        videoTitle: 'Test Video',
      });

      expect(mockNotificationService.createWithAggregation).toHaveBeenCalledWith(
        expect.objectContaining({
          userId: 'user-001',
          type: 'video_like',
          senderId: 'user-002',
        })
      );
    });

    it('should skip self-likes', async () => {
      await consumer.handleVideoEvent('liked', {
        videoOwnerId: 'user-001',
        likerId: 'user-001',
      });

      expect(mockNotificationService.createWithAggregation).not.toHaveBeenCalled();
    });

    it('should skip missing videoOwnerId', async () => {
      await consumer.handleVideoEvent('liked', { likerId: 'user-002' });

      expect(mockNotificationService.createWithAggregation).not.toHaveBeenCalled();
    });

    it('should handle video.coin_received', async () => {
      const mockNotification = {
        toJSON: () => ({ id: 'notif-001' }),
      };
      mockNotificationService.createNotification.mockResolvedValue(mockNotification);

      await consumer.handleVideoEvent('coin_received', {
        videoOwnerId: 'user-001',
        senderId: 'user-002',
        senderName: 'TestUser',
        videoId: 'vid-001',
        videoTitle: 'Test Video',
        coinAmount: 5,
      });

      expect(mockNotificationService.createNotification).toHaveBeenCalledWith(
        expect.objectContaining({
          userId: 'user-001',
          type: 'coin_received',
          senderId: 'user-002',
          metadata: expect.objectContaining({ coinAmount: 5 }),
        })
      );
    });

    it('should skip missing videoOwnerId for coin_received', async () => {
      await consumer.handleVideoEvent('coin_received', { senderId: 'user-002' });

      expect(mockNotificationService.createNotification).not.toHaveBeenCalled();
    });

    it('should handle unknown video action', async () => {
      await consumer.handleVideoEvent('unknown', {});

      expect(mockNotificationService.createNotification).not.toHaveBeenCalled();
    });
  });

  describe('handleUserEvent', () => {
    it('should handle user.followed', async () => {
      const mockNotification = {
        toJSON: () => ({ id: 'notif-001' }),
      };
      mockNotificationService.createNotification.mockResolvedValue(mockNotification);

      await consumer.handleUserEvent('followed', {
        followeeId: 'user-001',
        followerId: 'user-002',
        followerName: 'TestUser',
      });

      expect(mockNotificationService.createNotification).toHaveBeenCalledWith(
        expect.objectContaining({
          userId: 'user-001',
          type: 'new_follower',
          senderId: 'user-002',
          resourceId: 'user-002',
          resourceType: 'user',
        })
      );
    });

    it('should skip self-follows', async () => {
      await consumer.handleUserEvent('followed', {
        followeeId: 'user-001',
        followerId: 'user-001',
      });

      expect(mockNotificationService.createNotification).not.toHaveBeenCalled();
    });

    it('should skip missing followeeId', async () => {
      await consumer.handleUserEvent('followed', { followerId: 'user-002' });

      expect(mockNotificationService.createNotification).not.toHaveBeenCalled();
    });

    it('should handle unknown user action', async () => {
      await consumer.handleUserEvent('unknown', {});

      expect(mockNotificationService.createNotification).not.toHaveBeenCalled();
    });
  });

  describe('handleSystemEvent', () => {
    it('should handle system.broadcast', async () => {
      const mockNotification = {
        toJSON: () => ({ id: 'notif-001' }),
      };
      mockNotificationService.createNotification.mockResolvedValue(mockNotification);

      await consumer.handleSystemEvent('broadcast', {
        userIds: ['user-001', 'user-002'],
        title: 'Announcement',
        body: 'System update scheduled',
      });

      expect(mockNotificationService.createNotification).toHaveBeenCalledTimes(2);
    });

    it('should skip broadcast with empty userIds', async () => {
      await consumer.handleSystemEvent('broadcast', {
        userIds: [],
        title: 'Announcement',
        body: 'Test',
      });

      expect(mockNotificationService.createNotification).not.toHaveBeenCalled();
    });

    it('should skip broadcast with non-array userIds', async () => {
      await consumer.handleSystemEvent('broadcast', {
        userIds: 'not-an-array',
        title: 'Announcement',
        body: 'Test',
      });

      expect(mockNotificationService.createNotification).not.toHaveBeenCalled();
    });

    it('should handle system.announcement', async () => {
      const mockNotification = {
        toJSON: () => ({ id: 'notif-001' }),
      };
      mockNotificationService.createNotification.mockResolvedValue(mockNotification);

      await consumer.handleSystemEvent('announcement', {
        userId: 'user-001',
        title: 'Personal Announcement',
        body: 'You have a new badge',
      });

      expect(mockNotificationService.createNotification).toHaveBeenCalled();
    });

    it('should skip announcement without userId', async () => {
      await consumer.handleSystemEvent('announcement', {
        title: 'Announcement',
        body: 'Test',
      });

      expect(mockNotificationService.createNotification).not.toHaveBeenCalled();
    });

    it('should handle unknown system action', async () => {
      await consumer.handleSystemEvent('unknown', {});

      expect(mockNotificationService.createNotification).not.toHaveBeenCalled();
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
    });

    it('should handle stop without consumer tag', async () => {
      consumer.consumerTag = null;

      await consumer.stopConsuming();

      expect(mockChannel.cancel).not.toHaveBeenCalled();
    });
  });

  describe('_pushToUser', () => {
    it('should push notification via WebSocket', async () => {
      const mockNotification = {
        toJSON: () => ({ id: 'notif-001', content: 'Test' }),
      };

      consumer._pushToUser('user-001', mockNotification);

      expect(mockWsServer.sendNotification).toHaveBeenCalledWith('user-001', { id: 'notif-001', content: 'Test' });
      expect(mockNotificationService.updateUnreadCache).toHaveBeenCalledWith('user-001');
    });

    it('should handle push errors gracefully', async () => {
      mockWsServer.sendNotification.mockImplementation(() => {
        throw new Error('WebSocket error');
      });

      const mockNotification = {
        toJSON: () => ({ id: 'notif-001' }),
      };

      expect(() => consumer._pushToUser('user-001', mockNotification)).not.toThrow();
    });

    it('should not push when wsServer is null', async () => {
      consumer.wsServer = null;
      const mockNotification = {
        toJSON: () => ({ id: 'notif-001' }),
      };

      expect(() => consumer._pushToUser('user-001', mockNotification)).not.toThrow();
    });
  });

  describe('message processing', () => {
    beforeEach(async () => {
      await consumer.startConsuming();
    });

    it('should process valid message', async () => {
      const mockNotification = {
        toJSON: () => ({ id: 'notif-001' }),
      };
      mockNotificationService.createNotification.mockResolvedValue(mockNotification);

      const messageHandler = mockChannel.consume.mock.calls[0][1];
      const msg = {
        content: Buffer.from(JSON.stringify({ followeeId: 'user-001', followerId: 'user-002' })),
        fields: { routingKey: 'user.followed' },
      };

      await messageHandler(msg);

      expect(mockNotificationService.createNotification).toHaveBeenCalled();
      expect(mockChannel.ack).toHaveBeenCalledWith(msg);
    });

    it('should nack message on error', async () => {
      mockNotificationService.createNotification.mockRejectedValue(new Error('DB error'));

      const messageHandler = mockChannel.consume.mock.calls[0][1];
      const msg = {
        content: Buffer.from(JSON.stringify({ followeeId: 'user-001', followerId: 'user-002' })),
        fields: { routingKey: 'user.followed' },
      };

      await messageHandler(msg);

      expect(mockChannel.nack).toHaveBeenCalledWith(msg, false, false);
    });

    it('should skip null messages', async () => {
      const messageHandler = mockChannel.consume.mock.calls[0][1];

      await messageHandler(null);

      expect(mockNotificationService.createNotification).not.toHaveBeenCalled();
      expect(mockChannel.ack).not.toHaveBeenCalled();
    });

    it('should handle invalid JSON', async () => {
      const messageHandler = mockChannel.consume.mock.calls[0][1];
      const msg = {
        content: Buffer.from('invalid json{'),
        fields: { routingKey: 'user.followed' },
      };

      await messageHandler(msg);

      expect(mockChannel.nack).toHaveBeenCalled();
    });
  });
});
