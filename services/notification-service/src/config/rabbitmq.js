const amqp = require('amqplib');
const config = require('./index');
const logger = require('../utils/logger');

let connection = null;
let channel = null;
let reconnectAttempts = 0;

const connectRabbitMQ = async () => {
  try {
    connection = await amqp.connect(config.rabbitmq.url);
    channel = await connection.createChannel();

    await channel.assertExchange(config.rabbitmq.exchange, 'topic', { durable: true });

    reconnectAttempts = 0;
    logger.info('RabbitMQ connected successfully');

    connection.on('error', (err) => {
      logger.error('RabbitMQ connection error:', err.message);
    });

    connection.on('close', () => {
      logger.warn('RabbitMQ connection closed');
      if (reconnectAttempts < config.rabbitmq.maxReconnectAttempts) {
        reconnectAttempts++;
        logger.info(`RabbitMQ reconnecting... Attempt ${reconnectAttempts}`);
        setTimeout(connectRabbitMQ, config.rabbitmq.reconnectInterval);
      }
    });

    return { connection, channel };
  } catch (error) {
    logger.error('RabbitMQ connection failed:', error.message);
    if (reconnectAttempts < config.rabbitmq.maxReconnectAttempts) {
      reconnectAttempts++;
      logger.info(`RabbitMQ reconnecting... Attempt ${reconnectAttempts}`);
      setTimeout(connectRabbitMQ, config.rabbitmq.reconnectInterval);
    }
    throw error;
  }
};

const getRabbitMQChannel = () => {
  if (!channel) {
    throw new Error('RabbitMQ channel not initialized');
  }
  return channel;
};

const closeRabbitMQ = async () => {
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
  } catch (error) {
    logger.error('Error closing RabbitMQ:', error.message);
  }
};

const publishMessage = async (routingKey, message) => {
  const ch = getRabbitMQChannel();
  const messageBuffer = Buffer.from(JSON.stringify(message));
  const published = ch.publish(
    config.rabbitmq.exchange,
    routingKey,
    messageBuffer,
    { persistent: true }
  );
  if (!published) {
    throw new Error(`Failed to publish message to ${routingKey}`);
  }
  logger.debug(`Message published to ${routingKey}:`, message);
};

module.exports = {
  connectRabbitMQ,
  getRabbitMQChannel,
  closeRabbitMQ,
  publishMessage,
};
