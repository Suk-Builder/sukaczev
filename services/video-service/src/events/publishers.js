/**
 * @fileoverview Event publishers for video-service with retry logic.
 */

const rabbitmq = require('../config/rabbitmq');
const logger = require('../services/loggerService');

/**
 * Publishes video.uploaded event with retry.
 *
 * @async
 * @param {Object} videoData - Video data
 * @param {number} [retries=3] - Number of retries
 * @returns {Promise<boolean>}
 */
async function publishVideoUploaded(videoData, retries = 3) {
  for (let attempt = 1; attempt <= retries; attempt++) {
    try {
      const result = await rabbitmq.publishVideoUploaded(videoData);
      if (result) return true;
      if (attempt < retries) await delay(1000 * attempt);
    } catch (err) {
      logger.error('Failed to publish video.uploaded', { attempt, error: err.message });
      if (attempt < retries) await delay(1000 * attempt);
    }
  }
  return false;
}

/**
 * Publishes video.published event with retry.
 *
 * @async
 * @param {Object} videoData - Video data
 * @param {number} [retries=3] - Number of retries
 * @returns {Promise<boolean>}
 */
async function publishVideoPublished(videoData, retries = 3) {
  for (let attempt = 1; attempt <= retries; attempt++) {
    try {
      const result = await rabbitmq.publishVideoPublished(videoData);
      if (result) return true;
      if (attempt < retries) await delay(1000 * attempt);
    } catch (err) {
      logger.error('Failed to publish video.published', { attempt, error: err.message });
      if (attempt < retries) await delay(1000 * attempt);
    }
  }
  return false;
}

/**
 * Publishes video.liked event with retry.
 *
 * @async
 * @param {Object} likeData - Like data
 * @param {number} [retries=3] - Number of retries
 * @returns {Promise<boolean>}
 */
async function publishVideoLiked(likeData, retries = 3) {
  for (let attempt = 1; attempt <= retries; attempt++) {
    try {
      const result = await rabbitmq.publishVideoLiked(likeData);
      if (result) return true;
      if (attempt < retries) await delay(1000 * attempt);
    } catch (err) {
      logger.error('Failed to publish video.liked', { attempt, error: err.message });
      if (attempt < retries) await delay(1000 * attempt);
    }
  }
  return false;
}

/**
 * Publishes video.unliked event with retry.
 *
 * @async
 * @param {Object} unlikeData - Unlike data
 * @param {number} [retries=3] - Number of retries
 * @returns {Promise<boolean>}
 */
async function publishVideoUnliked(unlikeData, retries = 3) {
  for (let attempt = 1; attempt <= retries; attempt++) {
    try {
      const result = await rabbitmq.publishVideoUnliked(unlikeData);
      if (result) return true;
      if (attempt < retries) await delay(1000 * attempt);
    } catch (err) {
      logger.error('Failed to publish video.unliked', { attempt, error: err.message });
      if (attempt < retries) await delay(1000 * attempt);
    }
  }
  return false;
}

/**
 * Publishes video.deleted event.
 *
 * @async
 * @param {string} videoId - Video ID
 * @returns {Promise<boolean>}
 */
async function publishVideoDeleted(videoId) {
  try {
    return await rabbitmq.publish('video.deleted', { videoId });
  } catch (err) {
    logger.error('Failed to publish video.deleted', { videoId, error: err.message });
    return false;
  }
}

/**
 * Utility delay function.
 *
 * @param {number} ms - Milliseconds
 * @returns {Promise<void>}
 */
function delay(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

module.exports = {
  publishVideoUploaded,
  publishVideoPublished,
  publishVideoLiked,
  publishVideoUnliked,
  publishVideoDeleted,
};
