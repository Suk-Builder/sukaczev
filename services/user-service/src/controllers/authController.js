/**
 * @fileoverview Authentication controller - Handles auth-related HTTP requests.
 * Manages registration, login, token refresh, and logout operations.
 */

const { validationResult } = require('express-validator');
const userService = require('../services/userService');
const logger = require('../services/loggerService');

/**
 * Handles user registration.
 * POST /api/auth/register
 *
 * @async
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 * @param {Function} next - Express next middleware
 */
async function register(req, res, next) {
  try {
    // Check validation errors
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

    const { username, email, password, displayName } = req.body;

    logger.info('Registration attempt', { username, email });

    const result = await userService.register({
      username,
      email,
      password,
      displayName,
    });

    logger.info('User registered successfully', { userId: result.user.id, username });

    return res.status(201).json({
      success: true,
      message: 'User registered successfully',
      data: {
        user: result.user,
        tokens: result.tokens,
      },
    });
  } catch (err) {
    if (err.code === 'DUPLICATE_KEY') {
      return res.status(409).json({
        success: false,
        error: {
          code: 'DUPLICATE_KEY',
          field: err.field,
          message: err.message,
        },
      });
    }
    next(err);
  }
}

/**
 * Handles user login.
 * POST /api/auth/login
 *
 * @async
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 * @param {Function} next - Express next middleware
 */
async function login(req, res, next) {
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

    const { username, password } = req.body;

    logger.info('Login attempt', { username });

    const result = await userService.login(username, password);

    logger.info('User logged in successfully', { userId: result.user.id });

    return res.status(200).json({
      success: true,
      message: 'Login successful',
      data: {
        user: result.user,
        tokens: result.tokens,
      },
    });
  } catch (err) {
    if (err.code === 'INVALID_CREDENTIALS') {
      return res.status(401).json({
        success: false,
        error: {
          code: 'INVALID_CREDENTIALS',
          message: 'Invalid username or password',
        },
      });
    }
    next(err);
  }
}

/**
 * Refreshes access token.
 * POST /api/auth/refresh
 *
 * @async
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 * @param {Function} next - Express next middleware
 */
async function refresh(req, res, next) {
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

    const { refreshToken } = req.body;

    const result = await userService.refreshToken(refreshToken);

    logger.info('Token refreshed', { userId: result.user.id });

    return res.status(200).json({
      success: true,
      message: 'Token refreshed successfully',
      data: {
        user: result.user,
        tokens: result.tokens,
      },
    });
  } catch (err) {
    if (err.code === 'INVALID_TOKEN' || err.code === 'TOKEN_REVOKED' || err.code === 'USER_NOT_FOUND') {
      return res.status(401).json({
        success: false,
        error: {
          code: err.code,
          message: err.message,
        },
      });
    }
    next(err);
  }
}

/**
 * Handles user logout.
 * POST /api/auth/logout
 *
 * @async
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 * @param {Function} next - Express next middleware
 */
async function logout(req, res, next) {
  try {
    const authHeader = req.headers.authorization;
    const { refreshToken } = req.body;

    const accessToken = authHeader?.startsWith('Bearer ')
      ? authHeader.substring(7)
      : null;

    if (accessToken && refreshToken) {
      await userService.logout(accessToken, refreshToken);
    }

    logger.info('User logged out', { userId: req.user?.userId });

    return res.status(200).json({
      success: true,
      message: 'Logout successful',
    });
  } catch (err) {
    next(err);
  }
}

/**
 * Gets current authenticated user info.
 * GET /api/users/me
 *
 * @async
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 * @param {Function} next - Express next middleware
 */
async function me(req, res, next) {
  try {
    const userId = req.user.userId;
    const user = await userService.getUserById(userId);

    if (!user) {
      return res.status(404).json({
        success: false,
        error: {
          code: 'USER_NOT_FOUND',
          message: 'User not found',
        },
      });
    }

    return res.status(200).json({
      success: true,
      data: { user },
    });
  } catch (err) {
    next(err);
  }
}

module.exports = {
  register,
  login,
  refresh,
  logout,
  me,
};
