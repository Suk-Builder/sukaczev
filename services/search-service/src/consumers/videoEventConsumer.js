const { getIndexingService } = require('../services/indexingService');
const { getSearchService } = require('../services/searchService');
const logger = require('../utils/logger');

class VideoEventConsumer {
  constructor(channel) {
    this.channel = channel;
    this.indexingService = getIndexingService();
    this.searchService = getSearchService();
    this.isConsuming = false;
    this.consumerTag = null;
  }

  /**
   * Start consuming video events
   */
  async startConsuming() {
    if (this.isConsuming) {
      logger.warn('Video event consumer is already running');
      return;
    }

    try {
      const queueName = 'search.video.events';
      await this.channel.assertQueue(queueName, {
        durable: true,
        arguments: {
          'x-dead-letter-exchange': '',
          'x-dead-letter-routing-key': `${queueName}.dlq`,
        },
      });

      // Bind to video events
      await this.channel.bindQueue(queueName, 'sukaczev.events', 'video.published');
      await this.channel.bindQueue(queueName, 'sukaczev.events', 'video.updated');
      await this.channel.bindQueue(queueName, 'sukaczev.events', 'video.deleted');
      await this.channel.bindQueue(queueName, 'sukaczev.events', 'video.stats.updated');

      const { consumerTag } = await this.channel.consume(queueName, async (msg) => {
        if (!msg) return;

        try {
          const content = JSON.parse(msg.content.toString());
          const routingKey = msg.fields.routingKey;

          logger.info(`Received video event: ${routingKey}`, { videoId: content.id });

          await this.handleEvent(routingKey, content);

          // Acknowledge message
          this.channel.ack(msg);
        } catch (error) {
          logger.error('Error processing video event:', error.message);

          // Reject message - will be sent to DLQ after max retries
          this.channel.nack(msg, false, false);
        }
      }, { noAck: false });

      this.consumerTag = consumerTag;
      this.isConsuming = true;
      logger.info('Video event consumer started');
    } catch (error) {
      logger.error('Failed to start video event consumer:', error.message);
      throw error;
    }
  }

  /**
   * Handle a video event based on routing key
   */
  async handleEvent(routingKey, content) {
    switch (routingKey) {
      case 'video.published':
        await this.handleVideoPublished(content);
        break;
      case 'video.updated':
        await this.handleVideoUpdated(content);
        break;
      case 'video.deleted':
        await this.handleVideoDeleted(content);
        break;
      case 'video.stats.updated':
        await this.handleVideoStatsUpdated(content);
        break;
      default:
        logger.warn(`Unknown video event type: ${routingKey}`);
    }
  }

  /**
   * Handle video.published event
   */
  async handleVideoPublished(content) {
    const video = this._normalizeVideoData(content);
    await this.indexingService.indexVideo(video);
    logger.info(`Video indexed on publish: ${video.id}`);
  }

  /**
   * Handle video.updated event
   */
  async handleVideoUpdated(content) {
    const video = this._normalizeVideoData(content);
    // Re-index the entire video document
    await this.indexingService.indexVideo(video);
    logger.info(`Video re-indexed on update: ${video.id}`);
  }

  /**
   * Handle video.deleted event
   */
  async handleVideoDeleted(content) {
    const { id } = content;
    if (!id) {
      throw new Error('Video ID is required for deletion');
    }
    await this.indexingService.deleteVideo(id);
    logger.info(`Video deleted from index: ${id}`);
  }

  /**
   * Handle video.stats.updated event
   */
  async handleVideoStatsUpdated(content) {
    const { id, views, likes } = content;
    if (!id) {
      throw new Error('Video ID is required for stats update');
    }
    await this.indexingService.updateVideoStats(id, { views, likes });
    logger.info(`Video stats updated in index: ${id} (views: ${views}, likes: ${likes})`);
  }

  /**
   * Stop consuming
   */
  async stopConsuming() {
    if (this.consumerTag) {
      await this.channel.cancel(this.consumerTag);
      this.consumerTag = null;
    }
    this.isConsuming = false;
    logger.info('Video event consumer stopped');
  }

  /**
   * Normalize video data from various event formats
   */
  _normalizeVideoData(content) {
    return {
      id: content.id || content.videoId,
      title: content.title,
      description: content.description || '',
      userId: content.userId || content.user_id || content.uploaderId,
      username: content.username || content.uploaderName || '',
      category: content.category || 'other',
      tags: content.tags || [],
      views: content.views || 0,
      likes: content.likes || 0,
      duration: content.duration || 0,
      coverUrl: content.coverUrl || content.cover_url || '',
      videoUrl: content.videoUrl || content.video_url || '',
      createdAt: content.createdAt || content.created_at || new Date().toISOString(),
      updatedAt: content.updatedAt || content.updated_at || new Date().toISOString(),
    };
  }
}

module.exports = VideoEventConsumer;
