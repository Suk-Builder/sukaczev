/**
 * @fileoverview Video service layer - Business logic for video operations.
 */

const Video = require('../models/Video');
const Category = require('../models/Category');
const redis = require('../config/redis');
const rabbitmq = require('../config/rabbitmq');
const logger = require('./loggerService');

/**
 * Creates a new video.
 *
 * @async
 * @param {Object} videoData - Video creation data
 * @returns {Promise<Object>}
 */
async function createVideo(videoData) {
  // Validate category if provided
  if (videoData.categoryId) {
    const category = await Category.findById(videoData.categoryId);
    if (!category) {
      const error = new Error('Category not found');
      error.code = 'CATEGORY_NOT_FOUND';
      throw error;
    }
  }

  const video = await Video.create(videoData);

  // Publish event (non-blocking)
  rabbitmq.publishVideoUploaded(video).catch((err) => {
    logger.warn('Failed to publish video.uploaded event', { error: err.message });
  });

  // If published immediately, publish published event
  if (videoData.status === 'published') {
    rabbitmq.publishVideoPublished(video).catch((err) => {
      logger.warn('Failed to publish video.published event', { error: err.message });
    });
  }

  // Cache the video
  await redis.setCachedVideo(video.id, video, 3600);

  // Invalidate lists
  await redis.invalidateVideoLists();

  return video;
}

/**
 * Gets a video by ID with caching.
 *
 * @async
 * @param {string} videoId - Video UUID
 * @returns {Promise<Object|null>}
 */
async function getVideo(videoId) {
  // Try cache first
  let video = await redis.getCachedVideo(videoId);
  if (video) {
    return video;
  }

  video = await Video.findById(videoId);
  if (video) {
    await redis.setCachedVideo(videoId, video);
  }

  return video;
}

/**
 * Gets a published video by ID.
 *
 * @async
 * @param {string} videoId - Video UUID
 * @returns {Promise<Object|null>}
 */
async function getPublishedVideo(videoId) {
  let video = await redis.getCachedVideo(videoId);
  if (video) {
    return video;
  }

  video = await Video.findPublishedById(videoId);
  if (video) {
    await redis.setCachedVideo(videoId, video);
  }

  return video;
}

/**
 * Updates a video.
 *
 * @async
 * @param {string} videoId - Video UUID
 * @param {Object} updates - Fields to update
 * @returns {Promise<Object|null>}
 */
async function updateVideo(videoId, updates) {
  // Validate category if provided
  if (updates.categoryId) {
    const category = await Category.findById(updates.categoryId);
    if (!category) {
      const error = new Error('Category not found');
      error.code = 'CATEGORY_NOT_FOUND';
      throw error;
    }
  }

  const video = await Video.update(videoId, updates);

  if (video) {
    // Update cache
    await redis.setCachedVideo(videoId, video);
    await redis.invalidateVideoLists();

    // Publish event if status changed to published
    if (updates.status === 'published') {
      rabbitmq.publishVideoPublished(video).catch((err) => {
        logger.warn('Failed to publish video.published event', { error: err.message });
      });
    }
  }

  return video;
}

/**
 * Deletes a video.
 *
 * @async
 * @param {string} videoId - Video UUID
 * @returns {Promise<boolean>}
 */
async function deleteVideo(videoId) {
  const result = await Video.remove(videoId);

  if (result) {
    await redis.invalidateVideo(videoId);
    await redis.invalidateVideoLists();
  }

  return result;
}

/**
 * Lists videos with pagination and filtering.
 *
 * @async
 * @param {Object} options - Query options
 * @returns {Promise<Object>}
 */
async function listVideos(options = {}) {
  // Try cache for common queries
  const cacheKey = `videos_${JSON.stringify(options)}`;
  const cached = await redis.getCachedVideoList(cacheKey);
  if (cached) {
    return cached;
  }

  const result = await Video.list(options);

  // Cache popular queries
  if (!options.cursor && !options.userId) {
    await redis.setCachedVideoList(cacheKey, result, 60);
  }

  return result;
}

/**
 * Records a view on a video.
 *
 * @async
 * @param {string} videoId - Video UUID
 * @returns {Promise<Object>}
 */
async function recordView(videoId) {
  // Increment in Redis first (fast)
  await redis.incrementViewCount(videoId);

  // Also increment in DB
  const result = await Video.incrementViews(videoId);

  return result;
}

/**
 * Likes a video.
 *
 * @async
 * @param {string} videoId - Video UUID
 * @param {string} userId - User UUID
 * @returns {Promise<Object>}
 */
async function likeVideo(videoId, userId) {
  const likeData = await Video.addLike(videoId, userId);

  // Invalidate video cache
  await redis.invalidateVideo(videoId);
  await redis.invalidateVideoLists();

  // Publish event
  rabbitmq.publishVideoLiked(likeData).catch((err) => {
    logger.warn('Failed to publish video.liked event', { error: err.message });
  });

  return likeData;
}

/**
 * Unlikes a video.
 *
 * @async
 * @param {string} videoId - Video UUID
 * @param {string} userId - User UUID
 * @returns {Promise<boolean>}
 */
async function unlikeVideo(videoId, userId) {
  const result = await Video.removeLike(videoId, userId);

  if (result) {
    await redis.invalidateVideo(videoId);
    await redis.invalidateVideoLists();

    rabbitmq.publishVideoUnliked({ video_id: videoId, user_id: userId }).catch((err) => {
      logger.warn('Failed to publish video.unliked event', { error: err.message });
    });
  }

  return result;
}

/**
 * Favorites a video.
 *
 * @async
 * @param {string} videoId - Video UUID
 * @param {string} userId - User UUID
 * @returns {Promise<Object>}
 */
async function favoriteVideo(videoId, userId) {
  return await Video.addFavorite(videoId, userId);
}

/**
 * Unfavorites a video.
 *
 * @async
 * @param {string} videoId - Video UUID
 * @param {string} userId - User UUID
 * @returns {Promise<boolean>}
 */
async function unfavoriteVideo(videoId, userId) {
  return await Video.removeFavorite(videoId, userId);
}

/**
 * Drops coins on a video.
 *
 * @async
 * @param {string} videoId - Video UUID
 * @param {string} userId - User UUID
 * @param {number} count - Number of coins (1-2)
 * @returns {Promise<Object>}
 */
async function dropCoins(videoId, userId, count) {
  return await Video.dropCoins(videoId, userId, count);
}

/**
 * Gets hot videos (most viewed).
 *
 * @async
 * @param {number} limit - Number of videos
 * @returns {Promise<Array>}
 */
async function getHotVideos(limit = 20) {
  // Try cache first
  let videos = await redis.getHotVideos();
  if (videos) {
    return videos.slice(0, limit);
  }

  // Fetch from DB
  const result = await Video.list({
    limit: Math.min(limit, 100),
    sortBy: 'views_count',
    order: 'desc',
    status: 'published',
  });

  videos = result.videos;

  // Cache for 10 minutes
  await redis.setHotVideos(videos, 600);

  return videos;
}

/**
 * Flushes pending view counts from Redis to DB.
 *
 * @async
 * @returns {Promise<number>} Number of videos updated
 */
async function flushViewCounts() {
  const pending = await redis.getPendingViewCounts();
  let updated = 0;

  for (const { videoId, count } of pending) {
    try {
      await Video.incrementViews(videoId);
      updated++;
    } catch (err) {
      logger.error('Failed to flush view count', { videoId, error: err.message });
    }
  }

  if (pending.length > 0) {
    await redis.clearPendingViewCounts(pending.map((p) => p.videoId));
  }

  return updated;
}

/**
 * Checks user's interaction status with a video.
 *
 * @async
 * @param {string} videoId - Video UUID
 * @param {string} userId - User UUID
 * @returns {Promise<Object>}
 */
async function getInteractionStatus(videoId, userId) {
  const [liked, favorited, coinCount] = await Promise.all([
    Video.hasLiked(videoId, userId),
    Video.hasFavorited(videoId, userId),
    Video.getUserCoinCount(videoId, userId),
  ]);

  return {
    liked,
    favorited,
    coinCount,
  };
}

module.exports = {
  createVideo,
  getVideo,
  getPublishedVideo,
  updateVideo,
  deleteVideo,
  listVideos,
  recordView,
  likeVideo,
  unlikeVideo,
  favoriteVideo,
  unfavoriteVideo,
  dropCoins,
  getHotVideos,
  flushViewCounts,
  getInteractionStatus,
};
