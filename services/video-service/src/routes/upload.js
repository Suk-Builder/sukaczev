/**
 * @fileoverview Upload routes - Defines file upload API endpoints.
 */

const express = require('express');
const router = express.Router();

const { uploadVideo, uploadThumbnail, videoUpload, thumbnailUpload } = require('../controllers/uploadController');
const { authenticate } = require('../middleware/auth');
const { asyncHandler } = require('../middleware/errorHandler');

/**
 * POST /api/upload/video
 * Upload a video file (multipart/form-data).
 */
router.post('/video', authenticate, videoUpload, asyncHandler(uploadVideo));

/**
 * POST /api/upload/thumbnail
 * Upload a thumbnail image (multipart/form-data).
 */
router.post('/thumbnail', authenticate, thumbnailUpload, asyncHandler(uploadThumbnail));

module.exports = router;

