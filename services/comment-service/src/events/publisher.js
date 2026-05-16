const {
  publishCommentCreated,
  publishCommentDeleted,
  publishCommentLiked,
  publishCommentReply,
  isConnected
} = require('../config/rabbitmq');
const logger = require('../utils/logger');

class EventPublisher {
  constructor() {
    this.enabled = true;
    this.fallbackToLog = true;
    this.publishRetryAttempts = 3;
  }

  /**
   * Enable/disable publishing
   * @param {boolean} enabled
   */
  setEnabled(enabled) {
    this.enabled = enabled;
  }

  /**
   * Check if event publishing is available
   * @returns {boolean}
   */
  isAvailable() {
    return this.enabled && isConnected();
  }

  /**
   * Retry a publish operation
   * @param {Function} publishFn - Publish function
   * @param {number} attempts - Remaining attempts
   * @returns {Promise<boolean>}
   */
  async retryPublish(publishFn, attempts = this.publishRetryAttempts) {
    for (let i = 0; i < attempts; i++) {
      try {
        const result = await publishFn();
        if (result) return true;
      } catch (error) {
        logger.warn(`Publish attempt ${i + 1}/${attempts} failed:`, error.message);
        if (i < attempts - 1) {
          await new Promise(resolve => setTimeout(resolve, 100 * (i + 1)));
        }
      }
    }
    return false;
  }

  /**
   * Publish comment created event
   * @param {Object} comment - Comment data
   */
  async commentCreated(comment) {
    if (!this.enabled) return;

    const published = await this.retryPublish(
      () => publishCommentCreated(comment)
    );

    if (!published && this.fallbackToLog) {
      logger.info('Comment created event (logged):', {
        commentId: comment.id,
        videoId: comment.videoId,
        userId: comment.userId
      });
    }
  }

  /**
   * Publish comment deleted event
   * @param {Object} data - Deletion data
   */
  async commentDeleted(data) {
    if (!this.enabled) return;

    const published = await this.retryPublish(
      () => publishCommentDeleted(data)
    );

    if (!published && this.fallbackToLog) {
      logger.info('Comment deleted event (logged):', data);
    }
  }

  /**
   * Publish comment liked event
   * @param {Object} data - Like data
   */
  async commentLiked(data) {
    if (!this.enabled) return;

    const published = await this.retryPublish(
      () => publishCommentLiked(data)
    );

    if (!published && this.fallbackToLog) {
      logger.info('Comment liked event (logged):', data);
    }
  }

  /**
   * Publish comment reply event
   * @param {Object} data - Reply data
   */
  async commentReply(data) {
    if (!this.enabled) return;

    const published = await this.retryPublish(
      () => publishCommentReply(data)
    );

    if (!published && this.fallbackToLog) {
      logger.info('Comment reply event (logged):', data);
    }
  }

  /**
   * Publish batch of events
   * @param {Array} events - Array of event objects
   */
  async publishBatch(events) {
    if (!this.enabled || events.length === 0) return;

    const results = [];
    for (const event of events) {
      try {
        let published = false;

        switch (event.type) {
          case 'comment.created':
            published = await this.retryPublish(
              () => publishCommentCreated(event.data)
            );
            break;
          case 'comment.deleted':
            published = await this.retryPublish(
              () => publishCommentDeleted(event.data)
            );
            break;
          case 'comment.liked':
            published = await this.retryPublish(
              () => publishCommentLiked(event.data)
            );
            break;
          case 'comment.reply':
            published = await this.retryPublish(
              () => publishCommentReply(event.data)
            );
            break;
          default:
            logger.warn(`Unknown event type: ${event.type}`);
        }

        results.push({ type: event.type, published });
      } catch (error) {
        logger.error(`Failed to publish ${event.type}:`, error.message);
        results.push({ type: event.type, published: false, error: error.message });
      }
    }

    return results;
  }

  /**
   * Get publisher health status
   * @returns {Object} Health status
   */
  getHealth() {
    return {
      enabled: this.enabled,
      connected: isConnected(),
      available: this.isAvailable(),
      fallbackToLog: this.fallbackToLog,
      retryAttempts: this.publishRetryAttempts
    };
  }
}

module.exports = new EventPublisher();
