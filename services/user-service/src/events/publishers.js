/**
 * @fileoverview Event publishers for user-service.
 * Centralizes all RabbitMQ event publishing operations with retry logic.
 */

const rabbitmq = require('../config/rabbitmq');
const logger = require('../services/loggerService');

/**
 * Publishes user.created event with retry.
 *
 * @async
 * @param {Object} userData - Created user data
 * @param {number} [retries=3] - Number of retry attempts
 * @returns {Promise<boolean>} True if published
 */
async function publishUserCreated(userData, retries = 3) {
  for (let attempt = 1; attempt <= retries; attempt++) {
    try {
      const result = await rabbitmq.publishUserCreated(userData);
      if (result) return true;

      if (attempt < retries) {
        await delay(1000 * attempt);
      }
    } catch (err) {
      logger.error('Failed to publish user.created', {
        attempt,
        error: err.message,
        userId: userData.id,
      });
      if (attempt < retries) {
        await delay(1000 * attempt);
      }
    }
  }
  return false;
}

/**
 * Publishes user.updated event with retry.
 *
 * @async
 * @param {Object} userData - Updated user data
 * @param {string[]} changedFields - List of changed field names
 * @param {number} [retries=3] - Number of retry attempts
 * @returns {Promise<boolean>} True if published
 */
async function publishUserUpdated(userData, changedFields, retries = 3) {
  for (let attempt = 1; attempt <= retries; attempt++) {
    try {
      const result = await rabbitmq.publishUserUpdated(userData, changedFields);
      if (result) return true;

      if (attempt < retries) {
        await delay(1000 * attempt);
      }
    } catch (err) {
      logger.error('Failed to publish user.updated', {
        attempt,
        error: err.message,
        userId: userData.id,
      });
      if (attempt < retries) {
        await delay(1000 * attempt);
      }
    }
  }
  return false;
}

/**
 * Publishes user.followed event with retry.
 *
 * @async
 * @param {Object} followData - Follow relationship data
 * @param {number} [retries=3] - Number of retry attempts
 * @returns {Promise<boolean>} True if published
 */
async function publishUserFollowed(followData, retries = 3) {
  for (let attempt = 1; attempt <= retries; attempt++) {
    try {
      const result = await rabbitmq.publishUserFollowed(followData);
      if (result) return true;

      if (attempt < retries) {
        await delay(1000 * attempt);
      }
    } catch (err) {
      logger.error('Failed to publish user.followed', {
        attempt,
        error: err.message,
        followerId: followData.follower_id,
        followingId: followData.following_id,
      });
      if (attempt < retries) {
        await delay(1000 * attempt);
      }
    }
  }
  return false;
}

/**
 * Publishes user.unfollowed event with retry.
 *
 * @async
 * @param {Object} followData - Unfollow relationship data
 * @param {number} [retries=3] - Number of retry attempts
 * @returns {Promise<boolean>} True if published
 */
async function publishUserUnfollowed(followData, retries = 3) {
  for (let attempt = 1; attempt <= retries; attempt++) {
    try {
      const result = await rabbitmq.publishUserUnfollowed(followData);
      if (result) return true;

      if (attempt < retries) {
        await delay(1000 * attempt);
      }
    } catch (err) {
      logger.error('Failed to publish user.unfollowed', {
        attempt,
        error: err.message,
        followerId: followData.follower_id,
        followingId: followData.following_id,
      });
      if (attempt < retries) {
        await delay(1000 * attempt);
      }
    }
  }
  return false;
}

/**
 * Publishes user.deleted event.
 *
 * @async
 * @param {string} userId - Deleted user ID
 * @returns {Promise<boolean>} True if published
 */
async function publishUserDeleted(userId) {
  try {
    return await rabbitmq.publish('user.deleted', { userId });
  } catch (err) {
    logger.error('Failed to publish user.deleted', { userId, error: err.message });
    return false;
  }
}

/**
 * Utility delay function for retry backoff.
 *
 * @param {number} ms - Milliseconds to delay
 * @returns {Promise<void>}
 */
function delay(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

module.exports = {
  publishUserCreated,
  publishUserUpdated,
  publishUserFollowed,
  publishUserUnfollowed,
  publishUserDeleted,
};
