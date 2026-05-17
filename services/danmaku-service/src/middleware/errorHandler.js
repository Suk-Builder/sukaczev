const logger = require('../utils/logger');

/**
 * Custom error class for API errors
 */
class DanmakuError extends Error {
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
  // Log error
  logger.error('Error occurred:', {
    message: err.message,
    stack: process.env.NODE_ENV === 'development' ? err.stack : undefined,
    path: req.path,
    method: req.method,
    requestId: req.id
  });

  // Handle known operational errors
  if (err instanceof DanmakuError) {
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

  // Handle PostgreSQL connection errors
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

  // Default error response
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
 * Async handler wrapper to catch errors in async route handlers
 * @param {Function} fn - Async function to wrap
 * @returns {Function} Wrapped function
 */
function asyncHandler(fn) {
  return (req, res, next) => {
    Promise.resolve(fn(req, res, next)).catch(next);
  };
}

/**
 * 404 Not Found handler for undefined routes
 */
function notFoundHandler(req, res, next) {
  const error = new DanmakuError(
    `Route not found: ${req.method} ${req.path}`,
    404,
    'ROUTE_NOT_FOUND'
  );
  next(error);
}

module.exports = {
  errorHandler,
  asyncHandler,
  notFoundHandler,
  DanmakuError
};
