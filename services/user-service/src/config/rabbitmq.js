/**
 * @fileoverview RabbitMQ configuration and connection management for user-service.
 * Handles event publishing for user-related domain events.
 */

const amqp = require('amqplib');
const logger = require('../services/loggerService');

/**
 * RabbitMQ connection URL from environment variables.
 */
const RABBITMQ_URL = process.env.RABBITMQ_URL || 'amqp://guest:guest@localhost:5672';

/**
 * Exchange name for user-service events.
 */
const EXCHANGE_NAME = 'user.events';

/**
 * Exchange type for event routing.
 */
const EXCHANGE_TYPE = 'topic';

/**
 * Singleton connection instance.
 * @type {Object|null}
 */
let connection = null;

/**
 * Singleton channel instance.
 * @type {Object|null}
 */
let channel = null;

/**
 * Connection state tracking.
 */
let isConnecting = false;

/**
 * Message queue for buffering messages when disconnected.
 * @type {Array<Object>}
 */
const messageBuffer = [];

/**
 * Establishes connection to RabbitMQ and creates channel.
 * Implements retry logic with exponential backoff.
 *
 * @async
 * @param {number} [retries=5] - Number of connection retries
 * @param {number} [delay=3000] - Initial retry delay in ms
 * @returns {Promise<Object>} RabbitMQ channel
 */
async function connect(retries = 5, delay = 3000) {
  if (channel) {
    return channel;
  }

  if (isConnecting) {
    // Wait for ongoing connection attempt
    await new Promise((resolve) => setTimeout(resolve, delay));
    if (channel) return channel;
  }

  isConnecting = true;

  for (let attempt = 1; attempt <= retries; attempt++) {
    try {
      logger.info(`Connecting to RabbitMQ (attempt ${attempt}/${retries})`, { url: RABBITMQ_URL.replace(/:\/\/.*@/, '://***@') });

      connection = await amqp.connect(RABBITMQ_URL);
      channel = await connection.createChannel();

      // Assert topic exchange for user events
      await channel.assertExchange(EXCHANGE_NAME, EXCHANGE_TYPE, {
        durable: true,
        autoDelete: false,
      });

      // Setup connection event handlers
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

      // Flush buffered messages
      await flushBuffer();

      isConnecting = false;
      return channel;
    } catch (err) {
      logger.error(`RabbitMQ connection attempt ${attempt} failed`, { error: err.message });
      if (attempt < retries) {
        const waitTime = delay * Math.pow(2, attempt - 1);
        logger.info(`Retrying in ${waitTime}ms...`);
        await new Promise((resolve) => setTimeout(resolve, waitTime));
      }
    }
  }

  isConnecting = false;
  throw new Error(`Failed to connect to RabbitMQ after ${retries} attempts`);
}

/**
 * Flushes buffered messages to RabbitMQ.
 * Called after successful connection.
 *
 * @async
 * @returns {Promise<void>}
 */
async function flushBuffer() {
  if (messageBuffer.length === 0) return;

  logger.info(`Flushing ${messageBuffer.length} buffered messages`);

  while (messageBuffer.length > 0) {
    const msg = messageBuffer.shift();
    try {
      await publish(msg.routingKey, msg.data, msg.options);
    } catch (err) {
      logger.error('Failed to flush buffered message', { error: err.message, routingKey: msg.routingKey });
      messageBuffer.unshift(msg); // Put it back for next flush
      break;
    }
  }
}

/**
 * Publishes an event to the user events exchange.
 *
 * @async
 * @param {string} routingKey - Event routing key (e.g., 'user.created')
 * @param {Object} data - Event payload data
 * @param {Object} [options={}] - Publish options
 * @returns {Promise<boolean>} True if published successfully
 */
async function publish(routingKey, data, options = {}) {
  const message = {
    ...data,
    _metadata: {
      service: 'user-service',
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
    if (!channel) {
      await connect();
    }

    const result = channel.publish(EXCHANGE_NAME, routingKey, buffer, publishOptions);

    if (result) {
      logger.debug('Event published', { routingKey, messageId: publishOptions.messageId });
      return true;
    }

    // Channel write buffer is full, buffer the message
    logger.warn('Channel write buffer full, buffering message', { routingKey });
    messageBuffer.push({ routingKey, data: message, options: publishOptions });
    return false;
  } catch (err) {
    logger.error('Failed to publish event', { routingKey, error: err.message });
    // Buffer message for retry
    messageBuffer.push({ routingKey, data: message, options: publishOptions });
    return false;
  }
}

/**
 * Publishes user.created event.
 *
 * @async
 * @param {Object} userData - Created user data
 * @returns {Promise<boolean>}
 */
async function publishUserCreated(userData) {
  return publish('user.created', {
    userId: userData.id,
    username: userData.username,
    email: userData.email,
    displayName: userData.display_name,
    level: userData.level,
    createdAt: userData.created_at,
  });
}

/**
 * Publishes user.updated event.
 *
 * @async
 * @param {Object} userData - Updated user data
 * @param {string[]} [changedFields=[]] - List of changed field names
 * @returns {Promise<boolean>}
 */
async function publishUserUpdated(userData, changedFields = []) {
  return publish('user.updated', {
    userId: userData.id,
    username: userData.username,
    displayName: userData.display_name,
    avatarUrl: userData.avatar_url,
    bio: userData.bio,
    level: userData.level,
    changedFields,
    updatedAt: userData.updated_at,
  });
}

/**
 * Publishes user.followed event.
 *
 * @async
 * @param {Object} followData - Follow relationship data
 * @returns {Promise<boolean>}
 */
async function publishUserFollowed(followData) {
  return publish('user.followed', {
    followerId: followData.follower_id,
    followingId: followData.following_id,
    createdAt: followData.created_at,
  });
}

/**
 * Publishes user.unfollowed event.
 *
 * @async
 * @param {Object} followData - Unfollow relationship data
 * @returns {Promise<boolean>}
 */
async function publishUserUnfollowed(followData) {
  return publish('user.unfollowed', {
    followerId: followData.follower_id,
    followingId: followData.following_id,
    unfollowedAt: new Date().toISOString(),
  });
}

/**
 * Consumes messages from a queue with given routing key pattern.
 *
 * @async
 * @param {string} queueName - Queue name to consume from
 * @param {string} routingPattern - Routing key pattern (e.g., 'user.*')
 * @param {Function} handler - Message handler function
 * @returns {Promise<void>}
 */
async function consume(queueName, routingPattern, handler) {
  if (!channel) {
    await connect();
  }

  await channel.assertQueue(queueName, { durable: true });
  await channel.bindQueue(queueName, EXCHANGE_NAME, routingPattern);

  await channel.consume(queueName, async (msg) => {
    if (!msg) return;

    try {
      const content = JSON.parse(msg.content.toString());
      logger.debug('Message consumed', { queue: queueName, routingKey: msg.fields.routingKey });
      await handler(content, msg.fields);
      channel.ack(msg);
    } catch (err) {
      logger.error('Error processing message', { queue: queueName, error: err.message });
      // Negative acknowledge, requeue if it's not a processing error
      channel.nack(msg, false, err.requeue !== false);
    }
  });

  logger.info('Consumer started', { queue: queueName, pattern: routingPattern });
}

/**
 * Gracefully closes RabbitMQ connection.
 *
 * @async
 * @returns {Promise<void>}
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

/**
 * Gets the current channel instance.
 *
 * @returns {Object|null} RabbitMQ channel or null
 */
function getChannel() {
  return channel;
}

module.exports = {
  connect,
  publish,
  publishUserCreated,
  publishUserUpdated,
  publishUserFollowed,
  publishUserUnfollowed,
  consume,
  closeConnection,
  getChannel,
  EXCHANGE_NAME,
};
