/**
 * @fileoverview Input validation rules for video-service using express-validator.
 */

const { body, param, query } = require('express-validator');

const createVideoValidation = [
  body('title')
    .trim()
    .notEmpty().withMessage('Title is required')
    .isLength({ max: 100 }).withMessage('Title must not exceed 100 characters')
    .escape(),

  body('description')
    .optional()
    .trim()
    .escape(),

  body('videoUrl')
    .notEmpty().withMessage('Video URL is required')
    .isURL().withMessage('Video URL must be a valid URL')
    .isLength({ max: 2048 }).withMessage('Video URL must not exceed 2048 characters'),

  body('thumbnailUrl')
    .optional()
    .isURL().withMessage('Thumbnail URL must be a valid URL')
    .isLength({ max: 2048 }),

  body('duration')
    .optional()
    .isInt({ min: 0 }).withMessage('Duration must be a non-negative integer')
    .toInt(),

  body('categoryId')
    .optional()
    .isInt({ min: 1 }).withMessage('Category ID must be a positive integer')
    .toInt(),

  body('status')
    .optional()
    .isIn(['draft', 'published', 'private']).withMessage('Status must be draft, published, or private'),
];

const updateVideoValidation = [
  param('id')
    .isUUID().withMessage('Invalid video ID format'),

  body('title')
    .optional()
    .trim()
    .isLength({ min: 1, max: 100 }).withMessage('Title must be 1-100 characters')
    .escape(),

  body('description')
    .optional()
    .trim()
    .escape(),

  body('thumbnailUrl')
    .optional()
    .isURL().withMessage('Thumbnail URL must be a valid URL'),

  body('duration')
    .optional()
    .isInt({ min: 0 }).withMessage('Duration must be a non-negative integer')
    .toInt(),

  body('categoryId')
    .optional()
    .isInt({ min: 1 }).withMessage('Category ID must be a positive integer')
    .toInt(),

  body('status')
    .optional()
    .isIn(['draft', 'published', 'private']).withMessage('Status must be draft, published, or private'),
];

const videoIdValidation = [
  param('id')
    .isUUID().withMessage('Invalid video ID format'),
];

const listVideosValidation = [
  query('cursor')
    .optional()
    .isString().withMessage('Cursor must be a string'),

  query('limit')
    .optional()
    .isInt({ min: 1, max: 100 }).withMessage('Limit must be between 1 and 100')
    .toInt(),

  query('categoryId')
    .optional()
    .isInt({ min: 1 }).withMessage('Category ID must be a positive integer')
    .toInt(),

  query('sortBy')
    .optional()
    .isIn(['created_at', 'views_count', 'likes_count', 'published_at']).withMessage('Invalid sort field'),

  query('order')
    .optional()
    .isIn(['asc', 'desc']).withMessage('Order must be asc or desc'),

  query('status')
    .optional()
    .isIn(['draft', 'published', 'private']).withMessage('Invalid status'),
];

const coinValidation = [
  param('id')
    .isUUID().withMessage('Invalid video ID format'),

  body('count')
    .optional()
    .isInt({ min: 1, max: 2 }).withMessage('Coin count must be 1 or 2')
    .toInt(),
];

const categoryIdValidation = [
  param('id')
    .isInt({ min: 1 }).withMessage('Category ID must be a positive integer'),
];

const createCategoryValidation = [
  body('name')
    .trim()
    .notEmpty().withMessage('Category name is required')
    .isLength({ max: 50 }).withMessage('Name must not exceed 50 characters'),

  body('slug')
    .trim()
    .notEmpty().withMessage('Slug is required')
    .isLength({ max: 50 }).withMessage('Slug must not exceed 50 characters')
    .matches(/^[a-z0-9-]+$/).withMessage('Slug must contain only lowercase letters, numbers, and hyphens'),

  body('icon')
    .optional()
    .isLength({ max: 100 }),

  body('parentId')
    .optional()
    .isInt({ min: 1 }).withMessage('Parent ID must be a positive integer')
    .toInt(),

  body('sortOrder')
    .optional()
    .isInt().withMessage('Sort order must be an integer')
    .toInt(),
];

module.exports = {
  createVideoValidation,
  updateVideoValidation,
  videoIdValidation,
  listVideosValidation,
  coinValidation,
  categoryIdValidation,
  createCategoryValidation,
};
