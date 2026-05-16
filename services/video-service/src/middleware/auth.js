/**
 * @fileoverview Authentication middleware for video-service.
 * Verifies JWT tokens forwarded from API gateway or user-service.
 */

const jwt = require('jsonwebtoken');
const logger = require('../services/loggerService');

const JWT_ACCESS_SECRET = process.env.JWT_ACCESS_SECRET;

/**
 * Extracts token from Authorization header.
 *
 * @param {Object} req - Express request object
 * @returns {string|null}
 */
function extractToken(req) {
  const authHeader = req.headers.authorization;
  if (authHeader && authHeader.startsWith('Bearer ')) {
    return authHeader.substring(7);
  }
  return null;
}

/**
 * Authenticates requests via JWT.
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

    const decoded = jwt.verify(token, JWT_ACCESS_SECRET, {
      issuer: 'sukaczev-user-service',
      audience: 'sukaczev-api',
      clockTolerance: 60,
    });

    req.user = {
      userId: decoded.userId,
      username: decoded.username,
      level: decoded.level,
    };

    next();
  } catch (err) {
    if (err.name === 'TokenExpiredError') {
      return res.status(401).json({
        success: false,
        error: {
          code: 'TOKEN_EXPIRED',
          message: 'Token has expired',
        },
      });
    }
    if (err.name === 'JsonWebTokenError') {
      return res.status(401).json({
        success: false,
        error: {
          code: 'INVALID_TOKEN',
          message: 'Invalid token',
        },
      });
    }
    logger.error('Authentication error', { error: err.message });
    next(err);
  }
}

/**
 * Optional authentication middleware.
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
      const decoded = jwt.verify(token, JWT_ACCESS_SECRET, {
        issuer: 'sukaczev-user-service',
        audience: 'sukaczev-api',
        clockTolerance: 60,
      });
      req.user = {
        userId: decoded.userId,
        username: decoded.username,
        level: decoded.level,
      };
    }
    next();
  } catch (err) {
    next();
  }
}

/**
 * Requires authentication for write operations.
 *
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 * @param {Function} next - Express next middleware
 */
function requireAuth(req, res, next) {
  if (!req.user) {
    return res.status(401).json({
      success: false,
      error: {
        code: 'UNAUTHORIZED',
        message: 'Authentication required',
      },
    });
  }
  next();
}

module.exports = {
  authenticate,
  optionalAuth,
  requireAuth,
  extractToken,
};
