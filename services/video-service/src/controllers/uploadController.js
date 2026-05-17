/**
 * @fileoverview Upload controller - Handles file upload via multipart/form-data.
 */

const multer = require('multer');
const path = require('path');
const fs = require('fs');
const logger = require('../services/loggerService');

// Ensure uploads directory exists
const UPLOAD_DIR = path.join(__dirname, '../../uploads');
const VIDEO_DIR = path.join(UPLOAD_DIR, 'videos');
if (!fs.existsSync(VIDEO_DIR)) {
  fs.mkdirSync(VIDEO_DIR, { recursive: true });
}

// Configure storage
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, VIDEO_DIR);
  },
  filename: (req, file, cb) => {
    const uniqueName = `${Date.now()}-${Math.random().toString(36).substring(2, 11)}${path.extname(file.originalname)}`;
    cb(null, uniqueName);
  },
});

// File filter - only allow video files
const fileFilter = (req, file, cb) => {
  const allowedTypes = [
    'video/mp4',
    'video/webm',
    'video/ogg',
    'video/x-msvideo',
    'video/quicktime',
    'video/x-matroska',
    'video/mpeg',
    'video/x-ms-wmv',
  ];
  if (allowedTypes.includes(file.mimetype)) {
    cb(null, true);
  } else {
    cb(new Error(`Unsupported file type: ${file.mimetype}. Only video files are allowed.`), false);
  }
};

// Configure multer
const upload = multer({
  storage,
  fileFilter,
  limits: {
    fileSize: 2 * 1024 * 1024 * 1024, // 2GB max
  },
});

/**
 * Upload a video file.
 * POST /api/upload/video
 */
async function uploadVideo(req, res) {
  try {
    if (!req.file) {
      return res.status(400).json({
        success: false,
        error: { code: 'NO_FILE', message: 'No video file provided' },
      });
    }

    const protocol = req.headers['x-forwarded-proto'] || req.protocol;
    const host = req.headers['x-forwarded-host'] || req.headers.host;
    const fileUrl = `${protocol}://${host}/uploads/videos/${req.file.filename}`;

    logger.info('Video uploaded', {
      originalName: req.file.originalname,
      filename: req.file.filename,
      size: req.file.size,
      userId: req.user?.userId,
    });

    return res.status(201).json({
      success: true,
      message: 'Video uploaded successfully',
      data: {
        filename: req.file.filename,
        originalName: req.file.originalname,
        url: fileUrl,
        size: req.file.size,
        mimetype: req.file.mimetype,
      },
    });
  } catch (err) {
    logger.error('Video upload error', { error: err.message });
    return res.status(500).json({
      success: false,
      error: { code: 'UPLOAD_ERROR', message: err.message },
    });
  }
}

/**
 * Upload a thumbnail image.
 * POST /api/upload/thumbnail
 */
async function uploadThumbnail(req, res) {
  try {
    if (!req.file) {
      return res.status(400).json({
        success: false,
        error: { code: 'NO_FILE', message: 'No thumbnail file provided' },
      });
    }

    const protocol = req.headers['x-forwarded-proto'] || req.protocol;
    const host = req.headers['x-forwarded-host'] || req.headers.host;
    const fileUrl = `${protocol}://${host}/uploads/thumbnails/${req.file.filename}`;

    logger.info('Thumbnail uploaded', {
      originalName: req.file.originalname,
      filename: req.file.filename,
      size: req.file.size,
    });

    return res.status(201).json({
      success: true,
      message: 'Thumbnail uploaded successfully',
      data: {
        filename: req.file.filename,
        originalName: req.file.originalname,
        url: fileUrl,
        size: req.file.size,
      },
    });
  } catch (err) {
    logger.error('Thumbnail upload error', { error: err.message });
    return res.status(500).json({
      success: false,
      error: { code: 'UPLOAD_ERROR', message: err.message },
    });
  }
}

/**
 * Create multer middleware instances for export
 */
const videoUpload = upload.single('video');

const thumbnailStorage = multer.diskStorage({
  destination: (req, file, cb) => {
    const thumbDir = path.join(UPLOAD_DIR, 'thumbnails');
    if (!fs.existsSync(thumbDir)) {
      fs.mkdirSync(thumbDir, { recursive: true });
    }
    cb(null, thumbDir);
  },
  filename: (req, file, cb) => {
    const uniqueName = `thumb-${Date.now()}-${Math.random().toString(36).substring(2, 11)}${path.extname(file.originalname)}`;
    cb(null, uniqueName);
  },
});

const thumbnailUpload = multer({
  storage: thumbnailStorage,
  fileFilter: (req, file, cb) => {
    const allowedTypes = ['image/jpeg', 'image/png', 'image/gif', 'image/webp'];
    if (allowedTypes.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error(`Unsupported file type: ${file.mimetype}. Only image files are allowed.`), false);
    }
  },
  limits: { fileSize: 10 * 1024 * 1024 }, // 10MB max
}).single('thumbnail');

module.exports = {
  uploadVideo,
  uploadThumbnail,
  videoUpload,
  thumbnailUpload,
};

