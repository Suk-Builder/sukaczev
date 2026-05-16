const jwt = require('jsonwebtoken');
const logger = require('../utils/logger');

const JWT_ACCESS_SECRET = process.env.JWT_ACCESS_SECRET;

/**
 * Extracts token from Authorization header.
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
 */
function authenticate(req, res, next) {
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
      clockTolerance: 60,
    });

    req.user = {
      userId: decoded.userId || decoded.sub,
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
    logger.error('Authentication error:', err.message);
    next(err);
  }
}

/**
 * Requires authentication - blocks unauthenticated requests
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
  requireAuth,
  extractToken,
};

