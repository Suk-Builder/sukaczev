/**
 * @fileoverview User routes - Defines user-related API endpoints.
 * Maps HTTP routes to user controller functions.
 */

const express = require('express');
const router = express.Router();

const userController = require('../controllers/userController');
const authController = require('../controllers/authController');
const { authenticate } = require('../middleware/auth');
const {
  userIdValidation,
  updateUserValidation,
  paginationValidation,
  followValidation,
  searchValidation,
} = require('../middleware/validator');
const { asyncHandler } = require('../middleware/errorHandler');

/**
 * GET /api/users
 * Get all users with pagination.
 */
router.get('/', paginationValidation, asyncHandler(userController.listUsers));

/**
 * GET /api/users/me
 * Get current authenticated user's information.
 */
router.get('/me', authenticate, asyncHandler(authController.me));

router.get('/search', searchValidation, asyncHandler(userController.searchUsers));

/**
 * GET /api/users/:id
 * Get a user's public profile.
 */
router.get('/:id', userIdValidation, asyncHandler(userController.getUser));

/**
 * PUT /api/users/:id
 * Update user profile information.
 */
router.put('/:id', authenticate, updateUserValidation, asyncHandler(userController.updateUser));

/**
 * DELETE /api/users/:id
 * Delete user account.
 */
router.delete('/:id', authenticate, userIdValidation, asyncHandler(userController.deleteUser));

/**
 * GET /api/users/:id/followers
 * Get list of users following this user.
 */
router.get(
  '/:id/followers',
  userIdValidation,
  paginationValidation,
  asyncHandler(userController.getFollowers)
);

/**
 * GET /api/users/:id/following
 * Get list of users this user is following.
 */
router.get(
  '/:id/following',
  userIdValidation,
  paginationValidation,
  asyncHandler(userController.getFollowing)
);

/**
 * POST /api/users/:id/follow
 * Follow a user.
 */
router.post(
  '/:id/follow',
  authenticate,
  followValidation,
  asyncHandler(userController.follow)
);

/**
 * DELETE /api/users/:id/follow
 * Unfollow a user.
 */
router.delete(
  '/:id/follow',
  authenticate,
  followValidation,
  asyncHandler(userController.unfollow)
);

module.exports = router;

