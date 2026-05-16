/**
 * @fileoverview Authentication middleware - JWT verification and user injection.
 * Protects routes by validating access tokens and attaching user context.
 */

const userService = require('../services/userService');
const logger = require('../services/loggerService');

/**
 * Extracts token from Authorization header.
 *
 * @param {Object} req - Express request object
 * @returns {string|null} JWT token or null
 */
function extractToken(req) {
  const authHeader = req.headers.authorization;
  if (authHeader && authHeader.startsWith('Bearer ')) {
    return authHeader.substring(7);
  }
  return null;
}

/**
 * Middleware to authenticate requests via JWT.
 * Attaches decoded user payload to req.user.
 *
 * @async
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 * @param {Function} next - Express next middleware
 */
async function authenticate(req, res, next) {
  try {
    const token = extractToken(req);

    if (!token) {
      return res.status(401).json({
        success: false,
        error: {
          code: 'UNAUTHORIZED',
          message: 'Access token is required',
        },
      });
    }

    // Verify token
    const decoded = await userService.verifyAccessToken(token);

    // Attach user context to request
    req.user = {
      userId: decoded.userId,
      username: decoded.username,
      level: decoded.level,
    };

    // Attach token for potential logout
    req.token = token;

    next();
  } catch (err) {
    if (err.code === 'TOKEN_REVOKED') {
      return res.status(401).json({
        success: false,
        error: {
          code: 'TOKEN_REVOKED',
          message: 'Token has been revoked. Please login again.',
        },
      });
    }
    if (err.name === 'TokenExpiredError') {
      return res.status(401).json({
        success: false,
        error: {
          code: 'TOKEN_EXPIRED',
          message: 'Token has expired. Please refresh your token.',
        },
      });
    }
    if (err.name === 'JsonWebTokenError') {
      return res.status(401).json({
        success: false,
        error: {
          code: 'INVALID_TOKEN',
          message: 'Invalid token format',
        },
      });
    }

    logger.error('Authentication error', { error: err.message });
    next(err);
  }
}

/**
 * Middleware to check if user is accessing their own resource.
 * Must be used after authenticate middleware.
 *
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 * @param {Function} next - Express next middleware
 */
function requireOwnership(req, res, next) {
  const resourceUserId = req.params.id;

  if (req.user.userId !== resourceUserId) {
    return res.status(403).json({
      success: false,
      error: {
        code: 'FORBIDDEN',
        message: 'Access denied. You can only access your own resources.',
      },
    });
  }

  next();
}

/**
 * Middleware for optional authentication.
 * Attaches user if token is valid, but doesn't require it.
 *
 * @async
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 * @param {Function} next - Express next middleware
 */
async function optionalAuth(req, res, next) {
  try {
    const token = extractToken(req);

    if (token) {
      const decoded = await userService.verifyAccessToken(token);
      req.user = {
        userId: decoded.userId,
        username: decoded.username,
        level: decoded.level,
      };
    }

    next();
  } catch (err) {
    // Ignore auth errors for optional auth
    next();
  }
}

module.exports = {
  authenticate,
  requireOwnership,
  optionalAuth,
  extractToken,
};
