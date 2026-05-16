const jwt = require('jsonwebtoken');
const config = require('../config');
const logger = require('../utils/logger');

/**
 * Authentication middleware - extracts user from JWT if present
 * Does not block requests - just adds user info to req
 */
const authenticate = (req, res, next) => {
  try {
    const authHeader = req.headers.authorization;

    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      req.user = null;
      return next();
    }

    const token = authHeader.substring(7);
    const decoded = jwt.verify(token, config.jwt.secret, {
      clockTolerance: 60,
    });

    req.user = {
      id: decoded.sub || decoded.id,
      username: decoded.username,
      role: decoded.role || 'user',
    };

    next();
  } catch (error) {
    if (error.name === 'TokenExpiredError') {
      return res.status(401).json({
        success: false,
        message: 'Token expired',
        timestamp: new Date().toISOString(),
      });
    }
    if (error.name === 'JsonWebTokenError') {
      return res.status(401).json({
        success: false,
        message: 'Invalid token',
        timestamp: new Date().toISOString(),
      });
    }
    logger.error('Auth middleware error:', error.message);
    req.user = null;
    next();
  }
};

/**
 * Require authentication - blocks unauthenticated requests
 */
const requireAuth = (req, res, next) => {
  if (!req.user) {
    return res.status(401).json({
      success: false,
      message: 'Authentication required',
      timestamp: new Date().toISOString(),
    });
  }
  next();
};

/**
 * Require specific roles
 */
const requireRole = (...roles) => {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({
        success: false,
        message: 'Authentication required',
        timestamp: new Date().toISOString(),
      });
    }

    if (!roles.includes(req.user.role)) {
      return res.status(403).json({
        success: false,
        message: 'Insufficient permissions',
        timestamp: new Date().toISOString(),
      });
    }

    next();
  };
};

module.exports = {
  authenticate,
  requireAuth,
  requireRole,
};
