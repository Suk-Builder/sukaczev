const { getNotificationService } = require('../services/notificationService');
const logger = require('../utils/logger');

class EventConsumer {
  constructor(channel, wsServer) {
    this.channel = channel;
    this.wsServer = wsServer;
    this.notificationService = getNotificationService();
    this.isConsuming = false;
    this.consumerTag = null;
  }

  /**
   * Start consuming events from RabbitMQ
   */
  async startConsuming() {
    if (this.isConsuming) {
      logger.warn('Event consumer is already running');
      return;
    }

    try {
      const queueName = 'notification.events';
      await this.channel.assertQueue(queueName, {
        durable: true,
        arguments: {
          'x-dead-letter-exchange': '',
          'x-dead-letter-routing-key': `${queueName}.dlq`,
        },
      });

      // Bind to various event types
      const bindings = [
        'comment.*',
        'video.*',
        'user.*',
        'system.*',
      ];

      for (const pattern of bindings) {
        await this.channel.bindQueue(queueName, 'sukaczev.events', pattern);
      }

      const { consumerTag } = await this.channel.consume(queueName, async (msg) => {
        if (!msg) return;

        try {
          const content = JSON.parse(msg.content.toString());
          const routingKey = msg.fields.routingKey;

          logger.info(`Received event: ${routingKey}`);

          await this.handleEvent(routingKey, content);

          this.channel.ack(msg);
        } catch (error) {
          logger.error('Error processing event:', error.message);
          this.channel.nack(msg, false, false);
        }
      }, { noAck: false });

      this.consumerTag = consumerTag;
      this.isConsuming = true;
      logger.info('Event consumer started');
    } catch (error) {
      logger.error('Failed to start event consumer:', error.message);
      throw error;
    }
  }

  /**
   * Handle event based on routing key
   */
  async handleEvent(routingKey, content) {
    const [domain, action] = routingKey.split('.');

    switch (domain) {
      case 'comment':
        await this.handleCommentEvent(action, content);
        break;
      case 'video':
        await this.handleVideoEvent(action, content);
        break;
      case 'user':
        await this.handleUserEvent(action, content);
        break;
      case 'system':
        await this.handleSystemEvent(action, content);
        break;
      default:
        logger.warn(`Unknown event domain: ${domain}`);
    }
  }

  /**
   * Handle comment events
   */
  async handleCommentEvent(action, content) {
    switch (action) {
      case 'replied': {
        // Notify the original comment author
        const { parentCommentUserId, replyId, commentId, videoId, videoTitle, replierName } = content;

        if (!parentCommentUserId || parentCommentUserId === content.replierId) {
          return; // Don't notify self
        }

        const notification = await this.notificationService.createWithAggregation({
          userId: parentCommentUserId,
          type: 'comment_reply',
          senderId: content.replierId,
          resourceId: replyId || commentId,
          resourceType: 'comment',
          content: `${replierName || 'Someone'} replied to your comment on "${videoTitle || 'a video'}"`,
          metadata: {
            videoId,
            videoTitle,
            replyId,
            commentId,
            senderName: replierName,
          },
        });

        this._pushToUser(parentCommentUserId, notification);
        break;
      }

      case 'mentioned': {
        const { mentionedUserId, mentionerId, mentionerName, commentId, videoId, videoTitle } = content;

        if (!mentionedUserId || mentionedUserId === mentionerId) return;

        const notification = await this.notificationService.createNotification({
          userId: mentionedUserId,
          type: 'comment_reply',
          senderId: mentionerId,
          resourceId: commentId,
          resourceType: 'comment',
          content: `${mentionerName || 'Someone'} mentioned you in a comment on "${videoTitle || 'a video'}"`,
          metadata: {
            videoId,
            videoTitle,
            commentId,
            isMention: true,
            senderName: mentionerName,
          },
        });

        this._pushToUser(mentionedUserId, notification);
        break;
      }

      default:
        logger.debug(`Unhandled comment action: ${action}`);
    }
  }

  /**
   * Handle video events
   */
  async handleVideoEvent(action, content) {
    switch (action) {
      case 'liked': {
        const { videoOwnerId, likerId, likerName, videoId, videoTitle } = content;

        if (!videoOwnerId || videoOwnerId === likerId) return;

        const notification = await this.notificationService.createWithAggregation({
          userId: videoOwnerId,
          type: 'video_like',
          senderId: likerId,
          resourceId: videoId,
          resourceType: 'video',
          content: `${likerName || 'Someone'} liked your video "${videoTitle || ''}"`,
          metadata: {
            videoId,
            videoTitle,
            senderName: likerName,
          },
        });

        this._pushToUser(videoOwnerId, notification);
        break;
      }

      case 'coin_received': {
        const { videoOwnerId, senderId, senderName, videoId, videoTitle, coinAmount } = content;

        if (!videoOwnerId) return;

        const notification = await this.notificationService.createNotification({
          userId: videoOwnerId,
          type: 'coin_received',
          senderId,
          resourceId: videoId,
          resourceType: 'video',
          content: `${senderName || 'Someone'} threw ${coinAmount || 1} coin(s) for your video "${videoTitle || ''}"`,
          metadata: {
            videoId,
            videoTitle,
            coinAmount,
            senderName,
          },
        });

        this._pushToUser(videoOwnerId, notification);
        break;
      }

      default:
        logger.debug(`Unhandled video action: ${action}`);
    }
  }

  /**
   * Handle user events
   */
  async handleUserEvent(action, content) {
    switch (action) {
      case 'followed': {
        const { followeeId, followerId, followerName } = content;

        if (!followeeId || followeeId === followerId) return;

        const notification = await this.notificationService.createNotification({
          userId: followeeId,
          type: 'new_follower',
          senderId: followerId,
          resourceId: followerId,
          resourceType: 'user',
          content: `${followerName || 'Someone'} started following you`,
          metadata: {
            followerId,
            followerName,
          },
        });

        this._pushToUser(followeeId, notification);
        break;
      }

      default:
        logger.debug(`Unhandled user action: ${action}`);
    }
  }

  /**
   * Handle system events
   */
  async handleSystemEvent(action, content) {
    switch (action) {
      case 'broadcast': {
        // System-wide broadcast notification
        const { userIds, title, body } = content;

        if (userIds && Array.isArray(userIds)) {
          for (const userId of userIds) {
            const notification = await this.notificationService.createNotification({
              userId,
              type: 'system',
              senderId: null,
              resourceId: null,
              resourceType: 'system',
              content: body || title,
              metadata: {
                title,
                isBroadcast: true,
              },
            });

            this._pushToUser(userId, notification);
          }
        }
        break;
      }

      case 'announcement': {
        const { userId, title, body } = content;

        if (userId) {
          const notification = await this.notificationService.createNotification({
            userId,
            type: 'system',
            senderId: null,
            resourceId: null,
            resourceType: 'system',
            content: body || title,
            metadata: {
              title,
              isAnnouncement: true,
            },
          });

          this._pushToUser(userId, notification);
        }
        break;
      }

      default:
        logger.debug(`Unhandled system action: ${action}`);
    }
  }

  /**
   * Stop consuming events
   */
  async stopConsuming() {
    if (this.consumerTag) {
      await this.channel.cancel(this.consumerTag);
      this.consumerTag = null;
    }
    this.isConsuming = false;
    logger.info('Event consumer stopped');
  }

  /**
   * Push notification to user via WebSocket
   */
  _pushToUser(userId, notification) {
    if (this.wsServer) {
      try {
        const sent = this.wsServer.sendNotification(userId, notification.toJSON());
        if (sent) {
          logger.debug(`Notification pushed to user ${userId} via WebSocket`);
        }

        // Update unread count
        this.notificationService.updateUnreadCache(userId).then((count) => {
          this.wsServer.sendUnreadCount(userId, count);
        });
      } catch (error) {
        logger.error('WebSocket push error:', error.message);
      }
    }
  }
}

module.exports = EventConsumer;
