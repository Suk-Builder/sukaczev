const amqp = require('amqplib');
const logger = require('../utils/logger');

let connection = null;
let channel = null;
let isConnecting = false;

const EXCHANGE_NAME = process.env.RABBITMQ_EXCHANGE || 'sukaczev.events';
const EXCHANGE_TYPE = 'topic';
const ROUTING_KEYS = {
  COMMENT_CREATED: 'comment.created',
  COMMENT_DELETED: 'comment.deleted',
  COMMENT_LIKED: 'comment.liked',
  COMMENT_REPLY: 'comment.reply'
};

async function connectRabbitMQ(retries = 5) {
  if (connection || isConnecting) return;

  isConnecting = true;

  for (let i = 0; i < retries; i++) {
    try {
      const url = process.env.RABBITMQ_URL || 'amqp://localhost:5672';
      connection = await amqp.connect(url);

      connection.on('error', (err) => {
        logger.error('RabbitMQ connection error:', err.message);
        connection = null;
        channel = null;
      });

      connection.on('close', () => {
        logger.warn('RabbitMQ connection closed');
        connection = null;
        channel = null;
      });

      channel = await connection.createChannel();

      // Assert exchange
      await channel.assertExchange(EXCHANGE_NAME, EXCHANGE_TYPE, {
        durable: true,
        autoDelete: false
      });

      // Assert queue for this service
      const queueName = process.env.RABBITMQ_QUEUE || 'comment.events';
      await channel.assertQueue(queueName, {
        durable: true,
        arguments: {
          'x-message-ttl': 86400000 // 24 hours
        }
      });

      await channel.bindQueue(queueName, EXCHANGE_NAME, 'comment.*');

      logger.info('RabbitMQ connected and configured');
      isConnecting = false;
      return;
    } catch (error) {
      logger.error(`RabbitMQ connection attempt ${i + 1}/${retries} failed:`, error.message);
      if (i < retries - 1) {
        await new Promise(resolve => setTimeout(resolve, 2000 * (i + 1)));
      }
    }
  }

  isConnecting = false;
  logger.warn('Failed to connect to RabbitMQ after all retries');
}

async function closeRabbitMQ() {
  try {
    if (channel) {
      await channel.close();
      channel = null;
    }
    if (connection) {
      await connection.close();
      connection = null;
    }
    logger.info('RabbitMQ connection closed gracefully');
  } catch (error) {
    logger.error('Error closing RabbitMQ connection:', error.message);
  }
}

function getChannel() {
  if (!channel) {
    logger.warn('RabbitMQ channel not available');
    return null;
  }
  return channel;
}

function isConnected() {
  return connection !== null && channel !== null;
}

/**
 * Publish a message to RabbitMQ
 * @param {string} routingKey - Message routing key
 * @param {Object} message - Message payload
 * @returns {boolean} Whether the message was published
 */
async function publishMessage(routingKey, message) {
  const ch = getChannel();
  if (!ch) {
    logger.warn(`Cannot publish message: RabbitMQ not connected. Key: ${routingKey}`);
    return false;
  }

  try {
    const messageBuffer = Buffer.from(JSON.stringify({
      ...message,
      timestamp: new Date().toISOString(),
      service: 'comment-service'
    }));

    const published = ch.publish(EXCHANGE_NAME, routingKey, messageBuffer, {
      persistent: true,
      contentType: 'application/json',
      messageId: `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      timestamp: Math.floor(Date.now() / 1000)
    });

    if (published) {
      logger.debug(`Published message to ${routingKey}`);
    }

    return published;
  } catch (error) {
    logger.error(`Failed to publish message to ${routingKey}:`, error.message);
    return false;
  }
}

/**
 * Publish comment created event
 * @param {Object} comment - Comment data
 */
async function publishCommentCreated(comment) {
  return publishMessage(ROUTING_KEYS.COMMENT_CREATED, {
    event: 'comment.created',
    comment: {
      id: comment.id,
      videoId: comment.videoId,
      userId: comment.userId,
      parentId: comment.parentId,
      content: comment.content,
      createdAt: comment.createdAt
    }
  });
}

/**
 * Publish comment deleted event
 * @param {Object} data - Deletion data
 */
async function publishCommentDeleted(data) {
  return publishMessage(ROUTING_KEYS.COMMENT_DELETED, {
    event: 'comment.deleted',
    commentId: data.commentId,
    videoId: data.videoId,
    userId: data.userId
  });
}

/**
 * Publish comment liked event
 * @param {Object} data - Like data
 */
async function publishCommentLiked(data) {
  return publishMessage(ROUTING_KEYS.COMMENT_LIKED, {
    event: 'comment.liked',
    commentId: data.commentId,
    userId: data.userId,
    videoId: data.videoId
  });
}

/**
 * Publish comment reply event
 * @param {Object} data - Reply data
 */
async function publishCommentReply(data) {
  return publishMessage(ROUTING_KEYS.COMMENT_REPLY, {
    event: 'comment.reply',
    commentId: data.commentId,
    parentId: data.parentId,
    userId: data.userId,
    videoId: data.videoId
  });
}

/**
 * Consume messages from a queue
 * @param {string} queueName - Queue to consume from
 * @param {Function} handler - Message handler
 */
async function consumeMessages(queueName, handler) {
  const ch = getChannel();
  if (!ch) {
    logger.warn('Cannot consume messages: RabbitMQ not connected');
    return;
  }

  try {
    await ch.consume(queueName, async (msg) => {
      if (!msg) return;

      try {
        const content = JSON.parse(msg.content.toString());
        await handler(content, msg);
        ch.ack(msg);
      } catch (error) {
        logger.error('Error processing message:', error);
        ch.nack(msg, false, false); // Reject and don't requeue
      }
    });

    logger.info(`Started consuming from queue: ${queueName}`);
  } catch (error) {
    logger.error(`Failed to consume from ${queueName}:`, error.message);
  }
}

module.exports = {
  connectRabbitMQ,
  closeRabbitMQ,
  getChannel,
  isConnected,
  publishMessage,
  publishCommentCreated,
  publishCommentDeleted,
  publishCommentLiked,
  publishCommentReply,
  consumeMessages,
  EXCHANGE_NAME,
  ROUTING_KEYS
};
