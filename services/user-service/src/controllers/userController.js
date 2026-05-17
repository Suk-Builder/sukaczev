/**
 * @fileoverview User controller - Handles user-related HTTP requests.
 * Manages user profiles, follows, and social operations.
 */

const { validationResult } = require('express-validator');
const User = require('../models/User');
const userService = require('../services/userService');
const logger = require('../services/loggerService');

/**
 * Gets a user's public profile by ID.
 * GET /api/users/:id
 *
 * @async
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 * @param {Function} next - Express next middleware
 */
async function getUser(req, res, next) {
  try {
    const { id } = req.params;

    const user = await userService.getUserById(id);

    if (!user) {
      return res.status(404).json({
        success: false,
        error: {
          code: 'USER_NOT_FOUND',
          message: 'User not found',
        },
      });
    }

    // Check if current user is following this user
    let isFollowing = false;
    if (req.user?.userId && req.user.userId !== id) {
      isFollowing = await User.isFollowing(req.user.userId, id);
    }

    return res.status(200).json({
      success: true,
      data: {
        user: {
          ...user,
          is_following: isFollowing,
        },
      },
    });
  } catch (err) {
    next(err);
  }
}

/**
 * Updates user information.
 * PUT /api/users/:id
 *
 * @async
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 * @param {Function} next - Express next middleware
 */
async function updateUser(req, res, next) {
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

    // Verify user can only update their own profile
    if (req.user.userId !== id) {
      return res.status(403).json({
        success: false,
        error: {
          code: 'FORBIDDEN',
          message: 'You can only update your own profile',
        },
      });
    }

    const { displayName, avatarUrl, bio } = req.body;

    const updates = {};
    if (displayName !== undefined) updates.displayName = displayName;
    if (avatarUrl !== undefined) updates.avatarUrl = avatarUrl;
    if (bio !== undefined) updates.bio = bio;

    const user = await userService.updateUser(id, updates);

    if (!user) {
      return res.status(404).json({
        success: false,
        error: {
          code: 'USER_NOT_FOUND',
          message: 'User not found',
        },
      });
    }

    logger.info('User profile updated', { userId: id, updates: Object.keys(updates) });

    return res.status(200).json({
      success: true,
      message: 'Profile updated successfully',
      data: { user },
    });
  } catch (err) {
    if (err.code === 'DUPLICATE_KEY') {
      return res.status(409).json({
        success: false,
        error: {
          code: 'DUPLICATE_KEY',
          message: err.message,
        },
      });
    }
    next(err);
  }
}

/**
 * Gets followers list for a user.
 * GET /api/users/:id/followers
 *
 * @async
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 * @param {Function} next - Express next middleware
 */
async function getFollowers(req, res, next) {
  try {
    const { id } = req.params;
    const limit = Math.min(parseInt(req.query.limit || '20', 10), 100);
    const offset = parseInt(req.query.offset || '0', 10);

    // Verify user exists
    const userExists = await User.findById(id);
    if (!userExists) {
      return res.status(404).json({
        success: false,
        error: {
          code: 'USER_NOT_FOUND',
          message: 'User not found',
        },
      });
    }

    const result = await userService.getFollowers(id, { limit, offset });

    return res.status(200).json({
      success: true,
      data: {
        followers: result.followers,
        pagination: {
          total: result.total,
          limit: result.limit,
          offset: result.offset,
          hasMore: result.offset + result.limit < result.total,
        },
      },
    });
  } catch (err) {
    next(err);
  }
}

/**
 * Gets following list for a user.
 * GET /api/users/:id/following
 *
 * @async
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 * @param {Function} next - Express next middleware
 */
async function getFollowing(req, res, next) {
  try {
    const { id } = req.params;
    const limit = Math.min(parseInt(req.query.limit || '20', 10), 100);
    const offset = parseInt(req.query.offset || '0', 10);

    // Verify user exists
    const userExists = await User.findById(id);
    if (!userExists) {
      return res.status(404).json({
        success: false,
        error: {
          code: 'USER_NOT_FOUND',
          message: 'User not found',
        },
      });
    }

    const result = await userService.getFollowing(id, { limit, offset });

    return res.status(200).json({
      success: true,
      data: {
        following: result.following,
        pagination: {
          total: result.total,
          limit: result.limit,
          offset: result.offset,
          hasMore: result.offset + result.limit < result.total,
        },
      },
    });
  } catch (err) {
    next(err);
  }
}

/**
 * Follows a user.
 * POST /api/users/:id/follow
 *
 * @async
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 * @param {Function} next - Express next middleware
 */
async function follow(req, res, next) {
  try {
    const { id: followingId } = req.params;
    const followerId = req.user.userId;

    const result = await userService.followUser(followerId, followingId);

    logger.info('Follow successful', { followerId, followingId });

    return res.status(201).json({
      success: true,
      message: 'Successfully followed user',
      data: result,
    });
  } catch (err) {
    if (err.code === 'SELF_FOLLOW') {
      return res.status(400).json({
        success: false,
        error: {
          code: 'SELF_FOLLOW',
          message: 'Cannot follow yourself',
        },
      });
    }
    if (err.code === 'ALREADY_FOLLOWING') {
      return res.status(409).json({
        success: false,
        error: {
          code: 'ALREADY_FOLLOWING',
          message: 'Already following this user',
        },
      });
    }
    if (err.code === 'USER_NOT_FOUND') {
      return res.status(404).json({
        success: false,
        error: {
          code: 'USER_NOT_FOUND',
          message: 'User not found',
        },
      });
    }
    next(err);
  }
}

/**
 * Unfollows a user.
 * DELETE /api/users/:id/follow
 *
 * @async
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 * @param {Function} next - Express next middleware
 */
async function unfollow(req, res, next) {
  try {
    const { id: followingId } = req.params;
    const followerId = req.user.userId;

    const result = await userService.unfollowUser(followerId, followingId);

    if (!result) {
      return res.status(404).json({
        success: false,
        error: {
          code: 'NOT_FOLLOWING',
          message: 'Not following this user',
        },
      });
    }

    logger.info('Unfollow successful', { followerId, followingId });

    return res.status(200).json({
      success: true,
      message: 'Successfully unfollowed user',
      data: {
        followerId,
        followingId,
        unfollowed: true,
      },
    });
  } catch (err) {
    next(err);
  }
}

/**
 * Deletes a user account.
 * DELETE /api/users/:id
 *
 * @async
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 * @param {Function} next - Express next middleware
 */
async function deleteUser(req, res, next) {
  try {
    const { id } = req.params;

    // Verify user can only delete their own account
    if (req.user.userId !== id) {
      return res.status(403).json({
        success: false,
        error: {
          code: 'FORBIDDEN',
          message: 'You can only delete your own account',
        },
      });
    }

    const deleted = await User.remove(id);

    if (!deleted) {
      return res.status(404).json({
        success: false,
        error: {
          code: 'USER_NOT_FOUND',
          message: 'User not found',
        },
      });
    }

    logger.info('User account deleted', { userId: id });

    return res.status(200).json({
      success: true,
      message: 'Account deleted successfully',
    });
  } catch (err) {
    next(err);
  }
}

/**
 * Searches for users.
 * GET /api/users/search?q=query
 *
 * @async
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 * @param {Function} next - Express next middleware
 */
async function searchUsers(req, res, next) {
  try {
    const { q } = req.query;
    const limit = Math.min(parseInt(req.query.limit || '20', 10), 100);
    const offset = parseInt(req.query.offset || '0', 10);

    if (!q || q.trim().length < 2) {
      return res.status(400).json({
        success: false,
        error: {
          code: 'INVALID_QUERY',
          message: 'Search query must be at least 2 characters',
        },
      });
    }

    const result = await User.search(q.trim(), { limit, offset });

    return res.status(200).json({
      success: true,
      data: {
        users: result.users,
        pagination: {
          total: result.total,
          limit: result.limit,
          offset: result.offset,
          hasMore: result.offset + result.limit < result.total,
        },
      },
    });
  } catch (err) {
    next(err);
  }
}


/**
 * List all users with pagination
 * @async
 */
async function listUsers(req, res, next) {
  try {
    const limit = Math.min(parseInt(req.query.limit || '20', 10), 100);
    const offset = (parseInt(req.query.page || '1', 10) - 1) * limit;

    const result = await User.findAll({ limit, offset });

    return res.status(200).json({
      success: true,
      data: {
        users: result.users.map(user => ({
          id: user.id,
          username: user.username,
          avatar: user.avatar,
          bio: user.bio,
          createdAt: user.created_at,
        })),
        pagination: {
          total: result.total,
          limit: result.limit,
          offset: result.offset,
          hasMore: result.offset + result.limit < result.total,
        },
      },
    });
  } catch (err) {
    next(err);
  }
}

module.exports = {
  getUser,
  updateUser,
  getFollowers,
  getFollowing,
  follow,
  unfollow,
  deleteUser,
  searchUsers,
  listUsers,
};
