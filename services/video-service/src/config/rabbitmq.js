/**
 * @fileoverview RabbitMQ configuration for video-service.
 */

const amqp = require('amqplib');
const logger = require('../services/loggerService');

const RABBITMQ_URL = process.env.RABBITMQ_URL || 'amqp://guest:guest@localhost:5672';
const EXCHANGE_NAME = 'video.events';
const EXCHANGE_TYPE = 'topic';

let connection = null;
let channel = null;
let isConnecting = false;
const messageBuffer = [];

/**
 * Establishes connection to RabbitMQ.
 *
 * @async
 * @param {number} [retries=5] - Number of retries
 * @param {number} [delay=3000] - Delay between retries
 * @returns {Promise<Object>} RabbitMQ channel
 */
async function connect(retries = 5, delay = 3000) {
  if (channel) return channel;

  if (isConnecting) {
    await new Promise((resolve) => setTimeout(resolve, delay));
    if (channel) return channel;
  }

  isConnecting = true;

  for (let attempt = 1; attempt <= retries; attempt++) {
    try {
      logger.info(`Connecting to RabbitMQ (attempt ${attempt}/${retries})`);

      connection = await amqp.connect(RABBITMQ_URL);
      channel = await connection.createChannel();

      await channel.assertExchange(EXCHANGE_NAME, EXCHANGE_TYPE, {
        durable: true,
        autoDelete: false,
      });

      connection.on('error', (err) => {
        logger.error('RabbitMQ connection error', { error: err.message });
        connection = null;
        channel = null;
      });

      connection.on('close', () => {
        logger.warn('RabbitMQ connection closed');
        connection = null;
        channel = null;
      });

      logger.info('RabbitMQ connected successfully');
      await flushBuffer();
      isConnecting = false;
      return channel;
    } catch (err) {
      logger.error(`RabbitMQ connection attempt ${attempt} failed`, { error: err.message });
      if (attempt < retries) {
        const waitTime = delay * Math.pow(2, attempt - 1);
        await new Promise((resolve) => setTimeout(resolve, waitTime));
      }
    }
  }

  isConnecting = false;
  throw new Error(`Failed to connect to RabbitMQ after ${retries} attempts`);
}

async function flushBuffer() {
  if (messageBuffer.length === 0) return;
  logger.info(`Flushing ${messageBuffer.length} buffered messages`);

  while (messageBuffer.length > 0) {
    const msg = messageBuffer.shift();
    try {
      await publish(msg.routingKey, msg.data, msg.options);
    } catch (err) {
      messageBuffer.unshift(msg);
      break;
    }
  }
}

/**
 * Publishes an event to the video events exchange.
 *
 * @async
 * @param {string} routingKey - Routing key
 * @param {Object} data - Event data
 * @param {Object} [options={}] - Publish options
 * @returns {Promise<boolean>}
 */
async function publish(routingKey, data, options = {}) {
  const message = {
    ...data,
    _metadata: {
      service: 'video-service',
      timestamp: new Date().toISOString(),
      version: '1.0',
      ...options.metadata,
    },
  };

  const buffer = Buffer.from(JSON.stringify(message));
  const publishOptions = {
    persistent: true,
    contentType: 'application/json',
    messageId: options.messageId || `${Date.now()}-${Math.random().toString(36).substring(2, 11)}`,
    timestamp: Date.now(),
    ...options,
  };

  try {
    if (!channel) await connect();
    const result = channel.publish(EXCHANGE_NAME, routingKey, buffer, publishOptions);

    if (result) {
      logger.debug('Event published', { routingKey, messageId: publishOptions.messageId });
      return true;
    }

    messageBuffer.push({ routingKey, data: message, options: publishOptions });
    return false;
  } catch (err) {
    logger.error('Failed to publish event', { routingKey, error: err.message });
    messageBuffer.push({ routingKey, data: message, options: publishOptions });
    return false;
  }
}

/**
 * Publishes video.uploaded event.
 *
 * @async
 * @param {Object} videoData - Video data
 * @returns {Promise<boolean>}
 */
async function publishVideoUploaded(videoData) {
  return publish('video.uploaded', {
    videoId: videoData.id,
    userId: videoData.user_id,
    title: videoData.title,
    categoryId: videoData.category_id,
    status: videoData.status,
    createdAt: videoData.created_at,
  });
}

/**
 * Publishes video.published event.
 *
 * @async
 * @param {Object} videoData - Video data
 * @returns {Promise<boolean>}
 */
async function publishVideoPublished(videoData) {
  return publish('video.published', {
    videoId: videoData.id,
    userId: videoData.user_id,
    title: videoData.title,
    categoryId: videoData.category_id,
    publishedAt: videoData.published_at || new Date().toISOString(),
  });
}

/**
 * Publishes video.liked event.
 *
 * @async
 * @param {Object} likeData - Like data
 * @returns {Promise<boolean>}
 */
async function publishVideoLiked(likeData) {
  return publish('video.liked', {
    videoId: likeData.video_id,
    userId: likeData.user_id,
    likedAt: likeData.created_at,
  });
}

/**
 * Publishes video.unliked event.
 *
 * @async
 * @param {Object} unlikeData - Unlike data
 * @returns {Promise<boolean>}
 */
async function publishVideoUnliked(unlikeData) {
  return publish('video.unliked', {
    videoId: unlikeData.video_id,
    userId: unlikeData.user_id,
    unlikedAt: new Date().toISOString(),
  });
}

/**
 * Consumes messages from a queue.
 *
 * @async
 * @param {string} queueName - Queue name
 * @param {string} routingPattern - Routing pattern
 * @param {Function} handler - Message handler
 */
async function consume(queueName, routingPattern, handler) {
  if (!channel) await connect();

  await channel.assertQueue(queueName, { durable: true });
  await channel.bindQueue(queueName, EXCHANGE_NAME, routingPattern);

  await channel.consume(queueName, async (msg) => {
    if (!msg) return;

    try {
      const content = JSON.parse(msg.content.toString());
      await handler(content, msg.fields);
      channel.ack(msg);
    } catch (err) {
      logger.error('Error processing message', { queue: queueName, error: err.message });
      channel.nack(msg, false, err.requeue !== false);
    }
  });

  logger.info('Consumer started', { queue: queueName, pattern: routingPattern });
}

/**
 * Gracefully closes RabbitMQ connection.
 *
 * @async
 */
async function closeConnection() {
  try {
    if (channel) {
      await channel.close();
      channel = null;
    }
    if (connection) {
      await connection.close();
      connection = null;
    }
    logger.info('RabbitMQ connection closed');
  } catch (err) {
    logger.error('Error closing RabbitMQ connection', { error: err.message });
  }
}

function getChannel() {
  return channel;
}

module.exports = {
  connect,
  publish,
  publishVideoUploaded,
  publishVideoPublished,
  publishVideoLiked,
  publishVideoUnliked,
  consume,
  closeConnection,
  getChannel,
  EXCHANGE_NAME,
};
