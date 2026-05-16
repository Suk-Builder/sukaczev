/**
 * @fileoverview Input validation rules using express-validator.
 * Defines validation chains for all user-service endpoints.
 */

const { body, param, query } = require('express-validator');

/**
 * Validation rules for user registration.
 * @returns {Array} Express-validator validation chains
 */
const registerValidation = [
  body('username')
    .trim()
    .notEmpty().withMessage('Username is required')
    .isLength({ min: 2, max: 20 }).withMessage('Username must be 2-20 characters')
    .matches(/^[a-zA-Z0-9_\-\u4e00-\u9fa5]+$/).withMessage('Username can only contain letters, numbers, underscores, hyphens and Chinese characters')
    .escape(),

  body('email')
    .trim()
    .notEmpty().withMessage('Email is required')
    .isEmail().withMessage('Invalid email format')
    .normalizeEmail()
    .isLength({ max: 255 }).withMessage('Email must not exceed 255 characters'),

  body('password')
    .notEmpty().withMessage('Password is required')
    .isLength({ min: 6, max: 128 }).withMessage('Password must be 6-128 characters')
    .matches(/^(?=.*[a-zA-Z])(?=.*\d)/).withMessage('Password must contain at least one letter and one number'),

  body('displayName')
    .optional()
    .trim()
    .isLength({ min: 1, max: 50 }).withMessage('Display name must be 1-50 characters')
    .escape(),
];

/**
 * Validation rules for user login.
 * @returns {Array} Express-validator validation chains
 */
const loginValidation = [
  body('username')
    .trim()
    .notEmpty().withMessage('Username or email is required')
    .isLength({ max: 255 }).withMessage('Username or email must not exceed 255 characters'),

  body('password')
    .notEmpty().withMessage('Password is required'),
];

/**
 * Validation rules for token refresh.
 * @returns {Array} Express-validator validation chains
 */
const refreshValidation = [
  body('refreshToken')
    .notEmpty().withMessage('Refresh token is required')
    .isString().withMessage('Refresh token must be a string'),
];

/**
 * Validation rules for user profile update.
 * @returns {Array} Express-validator validation chains
 */
const updateUserValidation = [
  param('id')
    .notEmpty().withMessage('User ID is required')
    .isUUID().withMessage('Invalid user ID format'),

  body('displayName')
    .optional()
    .trim()
    .isLength({ min: 1, max: 50 }).withMessage('Display name must be 1-50 characters')
    .escape(),

  body('avatarUrl')
    .optional()
    .trim()
    .isURL().withMessage('Avatar URL must be a valid URL')
    .isLength({ max: 2048 }).withMessage('Avatar URL must not exceed 2048 characters'),

  body('bio')
    .optional()
    .trim()
    .isLength({ max: 500 }).withMessage('Bio must not exceed 500 characters')
    .escape(),
];

/**
 * Validation rules for user ID parameter.
 * @returns {Array} Express-validator validation chains
 */
const userIdValidation = [
  param('id')
    .notEmpty().withMessage('User ID is required')
    .isUUID().withMessage('Invalid user ID format'),
];

/**
 * Validation rules for pagination query parameters.
 * @returns {Array} Express-validator validation chains
 */
const paginationValidation = [
  query('limit')
    .optional()
    .isInt({ min: 1, max: 100 }).withMessage('Limit must be between 1 and 100')
    .toInt(),

  query('offset')
    .optional()
    .isInt({ min: 0 }).withMessage('Offset must be a non-negative integer')
    .toInt(),

  query('page')
    .optional()
    .isInt({ min: 1 }).withMessage('Page must be a positive integer')
    .toInt(),
];

/**
 * Validation rules for follow/unfollow operations.
 * @returns {Array} Express-validator validation chains
 */
const followValidation = [
  param('id')
    .notEmpty().withMessage('User ID is required')
    .isUUID().withMessage('Invalid user ID format'),
];

/**
 * Validation rules for search queries.
 * @returns {Array} Express-validator validation chains
 */
const searchValidation = [
  query('q')
    .trim()
    .notEmpty().withMessage('Search query is required')
    .isLength({ min: 2, max: 100 }).withMessage('Search query must be 2-100 characters')
    .escape(),

  ...paginationValidation,
];

/**
 * Validation rules for UUID array.
 * @returns {Array} Express-validator validation chains
 */
const uuidArrayValidation = [
  body('userIds')
    .isArray({ min: 1, max: 100 }).withMessage('User IDs must be an array of 1-100 items'),

  body('userIds.*')
    .isUUID().withMessage('Each user ID must be a valid UUID'),
];

/**
 * Validation rules for coin operations.
 * @returns {Array} Express-validator validation chains
 */
const coinValidation = [
  body('amount')
    .notEmpty().withMessage('Amount is required')
    .isInt({ min: 1, max: 1000 }).withMessage('Amount must be between 1 and 1000')
    .toInt(),
];

/**
 * Validation rules for password change.
 * @returns {Array} Express-validator validation chains
 */
const changePasswordValidation = [
  body('currentPassword')
    .notEmpty().withMessage('Current password is required'),

  body('newPassword')
    .notEmpty().withMessage('New password is required')
    .isLength({ min: 6, max: 128 }).withMessage('New password must be 6-128 characters')
    .matches(/^(?=.*[a-zA-Z])(?=.*\d)/).withMessage('New password must contain at least one letter and one number'),
];

module.exports = {
  registerValidation,
  loginValidation,
  refreshValidation,
  updateUserValidation,
  userIdValidation,
  paginationValidation,
  followValidation,
  searchValidation,
  uuidArrayValidation,
  coinValidation,
  changePasswordValidation,
};
