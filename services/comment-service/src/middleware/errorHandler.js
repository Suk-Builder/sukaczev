const logger = require('../utils/logger');

/**
 * Custom error class for comment API errors
 */
class CommentError extends Error {
  constructor(message, statusCode = 500, code = 'INTERNAL_ERROR') {
    super(message);
    this.statusCode = statusCode;
    this.code = code;
    this.isOperational = true;

    Error.captureStackTrace(this, this.constructor);
  }
}

/**
 * Global error handling middleware
 */
function errorHandler(err, req, res, next) {
  logger.error('Error occurred:', {
    message: err.message,
    stack: process.env.NODE_ENV === 'development' ? err.stack : undefined,
    path: req.path,
    method: req.method,
    requestId: req.id
  });

  if (err instanceof CommentError) {
    return res.status(err.statusCode).json({
      error: {
        message: err.message,
        code: err.code,
        status: err.statusCode
      },
      requestId: req.id
    });
  }

  // Handle PostgreSQL errors
  if (err.code && err.code.startsWith('23')) {
    return res.status(400).json({
      error: {
        message: 'Invalid data provided',
        code: 'VALIDATION_ERROR',
        status: 400
      },
      requestId: req.id
    });
  }

  if (err.code === 'ECONNREFUSED' || err.code === '28P01') {
    return res.status(503).json({
      error: {
        message: 'Service temporarily unavailable',
        code: 'SERVICE_UNAVAILABLE',
        status: 503
      },
      requestId: req.id
    });
  }

  const isDevelopment = process.env.NODE_ENV === 'development';
  const statusCode = err.statusCode || err.status || 500;

  res.status(statusCode).json({
    error: {
      message: isDevelopment ? err.message : 'Internal Server Error',
      code: err.code || 'INTERNAL_ERROR',
      status: statusCode,
      ...(isDevelopment && { stack: err.stack })
    },
    requestId: req.id
  });
}

/**
 * Async handler wrapper
 * @param {Function} fn
 * @returns {Function}
 */
function asyncHandler(fn) {
  return (req, res, next) => {
    Promise.resolve(fn(req, res, next)).catch(next);
  };
}

module.exports = {
  errorHandler,
  asyncHandler,
  CommentError
};
