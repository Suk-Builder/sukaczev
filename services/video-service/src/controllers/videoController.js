/**
 * @fileoverview Video controller - Handles video-related HTTP requests.
 */

const { validationResult } = require('express-validator');
const videoService = require('../services/videoService');
const Video = require('../models/Video');
const Category = require('../models/Category');
const logger = require('../services/loggerService');

/**
 * Creates a new video.
 * POST /api/videos
 *
 * @async
 */
async function create(req, res, next) {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        errors: errors.array().map((err) => ({
          field: err.path || err.param,
          message: err.msg,
        })),
      });
    }

    const { title, description, videoUrl, thumbnailUrl, duration, categoryId, status } = req.body;
    const userId = req.user.userId;

    logger.info('Video creation attempt', { userId, title });

    const video = await videoService.createVideo({
      userId,
      title,
      description,
      videoUrl,
      thumbnailUrl,
      duration,
      categoryId,
      status: status || 'draft',
    });

    logger.info('Video created', { videoId: video.id, userId });

    return res.status(201).json({
      success: true,
      message: 'Video created successfully',
      data: { video },
    });
  } catch (err) {
    if (err.code === 'CATEGORY_NOT_FOUND') {
      return res.status(404).json({
        success: false,
        error: { code: 'CATEGORY_NOT_FOUND', message: err.message },
      });
    }
    next(err);
  }
}

/**
 * Lists videos with pagination and filtering.
 * GET /api/videos
 *
 * @async
 */
async function list(req, res, next) {
  try {
    const {
      cursor,
      limit,
      categoryId,
      sortBy,
      order,
      status,
      userId: queryUserId,
    } = req.query;

    const options = {
      cursor: cursor || null,
      limit: limit ? parseInt(limit, 10) : 20,
      categoryId: categoryId || req.query.category || null,
      sortBy: sortBy || 'created_at',
      order: order || 'desc',
      status: status || 'published',
      userId: queryUserId || null,
    };

    const result = await videoService.listVideos(options);

    return res.status(200).json({
      success: true,
      data: {
        videos: result.videos,
        pagination: result.pagination,
      },
    });
  } catch (err) {
    next(err);
  }
}

/**
 * Gets a video by ID.
 * GET /api/videos/:id
 *
 * @async
 */
async function getById(req, res, next) {
  try {
    const { id } = req.params;
    const userId = req.user?.userId;

    const video = await videoService.getVideo(id);

    if (!video) {
      return res.status(404).json({
        success: false,
        error: { code: 'VIDEO_NOT_FOUND', message: 'Video not found' },
      });
    }

    // Check if private video and user is owner
    if (video.status === 'private' && video.user_id !== userId) {
      return res.status(403).json({
        success: false,
        error: { code: 'FORBIDDEN', message: 'This video is private' },
      });
    }

    // Get interaction status if user is authenticated
    let interaction = null;
    if (userId) {
      interaction = await videoService.getInteractionStatus(id, userId);
    }

    return res.status(200).json({
      success: true,
      data: {
        video,
        interaction,
      },
    });
  } catch (err) {
    next(err);
  }
}

/**
 * Updates a video.
 * PUT /api/videos/:id
 *
 * @async
 */
async function update(req, res, next) {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        errors: errors.array().map((err) => ({
          field: err.path || err.param,
          message: err.msg,
        })),
      });
    }

    const { id } = req.params;
    const userId = req.user.userId;

    // Verify ownership
    const existing = await Video.findById(id);
    if (!existing) {
      return res.status(404).json({
        success: false,
        error: { code: 'VIDEO_NOT_FOUND', message: 'Video not found' },
      });
    }

    if (existing.user_id !== userId) {
      return res.status(403).json({
        success: false,
        error: { code: 'FORBIDDEN', message: 'You can only update your own videos' },
      });
    }

    const { title, description, thumbnailUrl, duration, categoryId, status } = req.body;
    const updates = {};
    if (title !== undefined) updates.title = title;
    if (description !== undefined) updates.description = description;
    if (thumbnailUrl !== undefined) updates.thumbnailUrl = thumbnailUrl;
    if (duration !== undefined) updates.duration = duration;
    if (categoryId !== undefined) updates.categoryId = categoryId;
    if (status !== undefined) updates.status = status;

    const video = await videoService.updateVideo(id, updates);

    return res.status(200).json({
      success: true,
      message: 'Video updated successfully',
      data: { video },
    });
  } catch (err) {
    if (err.code === 'CATEGORY_NOT_FOUND') {
      return res.status(404).json({
        success: false,
        error: { code: 'CATEGORY_NOT_FOUND', message: err.message },
      });
    }
    next(err);
  }
}

/**
 * Deletes a video.
 * DELETE /api/videos/:id
 *
 * @async
 */
async function remove(req, res, next) {
  try {
    const { id } = req.params;
    const userId = req.user.userId;

    const existing = await Video.findById(id);
    if (!existing) {
      return res.status(404).json({
        success: false,
        error: { code: 'VIDEO_NOT_FOUND', message: 'Video not found' },
      });
    }

    if (existing.user_id !== userId) {
      return res.status(403).json({
        success: false,
        error: { code: 'FORBIDDEN', message: 'You can only delete your own videos' },
      });
    }

    await videoService.deleteVideo(id);

    return res.status(200).json({
      success: true,
      message: 'Video deleted successfully',
    });
  } catch (err) {
    next(err);
  }
}

/**
 * Likes a video.
 * POST /api/videos/:id/like
 *
 * @async
 */
async function like(req, res, next) {
  try {
    const { id: videoId } = req.params;
    const userId = req.user.userId;

    const result = await videoService.likeVideo(videoId, userId);

    return res.status(201).json({
      success: true,
      message: 'Video liked',
      data: result,
    });
  } catch (err) {
    if (err.code === 'ALREADY_LIKED') {
      return res.status(409).json({
        success: false,
        error: { code: 'ALREADY_LIKED', message: 'You already liked this video' },
      });
    }
    next(err);
  }
}

/**
 * Unlikes a video.
 * DELETE /api/videos/:id/like
 *
 * @async
 */
async function unlike(req, res, next) {
  try {
    const { id: videoId } = req.params;
    const userId = req.user.userId;

    const result = await videoService.unlikeVideo(videoId, userId);

    if (!result) {
      return res.status(404).json({
        success: false,
        error: { code: 'NOT_LIKED', message: 'You have not liked this video' },
      });
    }

    return res.status(200).json({
      success: true,
      message: 'Like removed',
    });
  } catch (err) {
    next(err);
  }
}

/**
 * Favorites a video.
 * POST /api/videos/:id/favorite
 *
 * @async
 */
async function favorite(req, res, next) {
  try {
    const { id: videoId } = req.params;
    const userId = req.user.userId;

    const result = await videoService.favoriteVideo(videoId, userId);

    return res.status(201).json({
      success: true,
      message: 'Video added to favorites',
      data: result,
    });
  } catch (err) {
    if (err.code === 'ALREADY_FAVORITED') {
      return res.status(409).json({
        success: false,
        error: { code: 'ALREADY_FAVORITED', message: 'Already in favorites' },
      });
    }
    next(err);
  }
}

/**
 * Unfavorites a video.
 * DELETE /api/videos/:id/favorite
 *
 * @async
 */
async function unfavorite(req, res, next) {
  try {
    const { id: videoId } = req.params;
    const userId = req.user.userId;

    const result = await videoService.unfavoriteVideo(videoId, userId);

    if (!result) {
      return res.status(404).json({
        success: false,
        error: { code: 'NOT_FAVORITED', message: 'Not in favorites' },
      });
    }

    return res.status(200).json({
      success: true,
      message: 'Removed from favorites',
    });
  } catch (err) {
    next(err);
  }
}

/**
 * Drops coins on a video.
 * POST /api/videos/:id/coin
 *
 * @async
 */
async function coin(req, res, next) {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        errors: errors.array().map((err) => ({
          field: err.path || err.param,
          message: err.msg,
        })),
      });
    }

    const { id: videoId } = req.params;
    const userId = req.user.userId;
    const count = parseInt(req.body.count, 10) || 1;

    if (count < 1 || count > 2) {
      return res.status(400).json({
        success: false,
        error: { code: 'INVALID_COIN_COUNT', message: 'Coin count must be 1 or 2' },
      });
    }

    const result = await videoService.dropCoins(videoId, userId, count);

    return res.status(200).json({
      success: true,
      message: `${count} coin(s) dropped`,
      data: result,
    });
  } catch (err) {
    if (err.code === 'MAX_COINS_REACHED') {
      return res.status(400).json({
        success: false,
        error: { code: 'MAX_COINS_REACHED', message: err.message },
      });
    }
    next(err);
  }
}

/**
 * Records a view on a video.
 * POST /api/videos/:id/view
 *
 * @async
 */
async function recordView(req, res, next) {
  try {
    const { id: videoId } = req.params;

    const result = await videoService.recordView(videoId);

    if (!result) {
      return res.status(404).json({
        success: false,
        error: { code: 'VIDEO_NOT_FOUND', message: 'Video not found' },
      });
    }

    return res.status(200).json({
      success: true,
      data: {
        viewsCount: result.views_count,
      },
    });
  } catch (err) {
    next(err);
  }
}

/**
 * Gets hot videos.
 * GET /api/videos/hot
 *
 * @async
 */
async function getHot(req, res, next) {
  try {
    const limit = parseInt(req.query.limit || '20', 10);
    const videos = await videoService.getHotVideos(limit);

    return res.status(200).json({
      success: true,
      data: { videos },
    });
  } catch (err) {
    next(err);
  }
}

module.exports = {
  create,
  list,
  getById,
  update,
  remove,
  like,
  unlike,
  favorite,
  unfavorite,
  coin,
  recordView,
  getHot,
};
