/**
 * @fileoverview Video routes - Defines video-related API endpoints.
 */

const express = require('express');
const router = express.Router();

const videoController = require('../controllers/videoController');
const { authenticate, optionalAuth } = require('../middleware/auth');
const {
  createVideoValidation,
  updateVideoValidation,
  videoIdValidation,
  listVideosValidation,
  coinValidation,
} = require('../middleware/validator');
const { asyncHandler } = require('../middleware/errorHandler');

/**
 * GET /api/videos
 * List videos with pagination and filtering.
 */
router.get('/', listVideosValidation, asyncHandler(videoController.list));

/**
 * GET /api/videos/hot
 * Get hot videos (most viewed).
 */
router.get('/hot', asyncHandler(videoController.getHot));

/**
 * POST /api/videos
 * Create a new video.
 */
router.post('/', authenticate, createVideoValidation, asyncHandler(videoController.create));

/**
 * GET /api/videos/:id
 * Get a video by ID.
 */
router.get('/:id', optionalAuth, videoIdValidation, asyncHandler(videoController.getById));

/**
 * PUT /api/videos/:id
 * Update a video.
 */
router.put('/:id', authenticate, updateVideoValidation, asyncHandler(videoController.update));

/**
 * DELETE /api/videos/:id
 * Delete a video.
 */
router.delete('/:id', authenticate, videoIdValidation, asyncHandler(videoController.remove));

/**
 * POST /api/videos/:id/like
 * Like a video.
 */
router.post('/:id/like', authenticate, videoIdValidation, asyncHandler(videoController.like));

/**
 * DELETE /api/videos/:id/like
 * Unlike a video.
 */
router.delete('/:id/like', authenticate, videoIdValidation, asyncHandler(videoController.unlike));

/**
 * POST /api/videos/:id/favorite
 * Favorite a video.
 */
router.post('/:id/favorite', authenticate, videoIdValidation, asyncHandler(videoController.favorite));

/**
 * DELETE /api/videos/:id/favorite
 * Unfavorite a video.
 */
router.delete('/:id/favorite', authenticate, videoIdValidation, asyncHandler(videoController.unfavorite));

/**
 * POST /api/videos/:id/coin
 * Drop coins on a video.
 */
router.post('/:id/coin', authenticate, coinValidation, asyncHandler(videoController.coin));

/**
 * POST /api/videos/:id/view
 * Record a view on a video.
 */
router.post('/:id/view', videoIdValidation, asyncHandler(videoController.recordView));

module.exports = router;
