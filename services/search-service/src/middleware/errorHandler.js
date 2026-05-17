const logger = require('../utils/logger');

/**
 * Global error handler middleware
 */
const errorHandler = (err, req, res, next) => {
  logger.error('Error:', {
    message: err.message,
    stack: process.env.NODE_ENV === 'development' ? err.stack : undefined,
    path: req.path,
    method: req.method,
    query: req.query,
    body: req.body,
  });

  // Handle specific error types
  if (err.name === 'ResponseError' && err.meta?.statusCode) {
    const statusCode = err.meta.statusCode;

    if (statusCode === 404) {
      return res.status(404).json({
        success: false,
        message: 'Resource not found',
        timestamp: new Date().toISOString(),
      });
    }

    if (statusCode === 409) {
      return res.status(409).json({
        success: false,
        message: 'Conflict - resource already exists',
        timestamp: new Date().toISOString(),
      });
    }

    return res.status(statusCode >= 500 ? 503 : statusCode).json({
      success: false,
      message: 'Search service error',
      details: process.env.NODE_ENV === 'development' ? err.message : undefined,
      timestamp: new Date().toISOString(),
    });
  }

  // Elasticsearch connection errors
  if (err.message?.includes('ECONNREFUSED') || err.message?.includes('connect')) {
    return res.status(503).json({
      success: false,
      message: 'Search service temporarily unavailable',
      timestamp: new Date().toISOString(),
    });
  }

  // Default error response
  const statusCode = err.statusCode || err.status || 500;
  const message = statusCode === 500
    ? 'Internal server error'
    : err.message || 'Something went wrong';

  res.status(statusCode).json({
    success: false,
    message,
    details: process.env.NODE_ENV === 'development' ? err.stack : undefined,
    timestamp: new Date().toISOString(),
  });
};

/**
 * 404 handler for undefined routes
 */
const notFoundHandler = (req, res) => {
  res.status(404).json({
    success: false,
    message: `Route ${req.method} ${req.path} not found`,
    timestamp: new Date().toISOString(),
  });
};

module.exports = {
  errorHandler,
  notFoundHandler,
};
