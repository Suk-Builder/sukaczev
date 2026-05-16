/**
 * @fileoverview Global error handling middleware.
 * Catches and formats all errors into consistent API responses.
 */

const logger = require('../services/loggerService');

/**
 * Custom application error class with status code.
 */
class AppError extends Error {
  /**
   * Creates an AppError.
   *
   * @param {string} message - Error message
   * @param {number} [statusCode=500] - HTTP status code
   * @param {string} [code='INTERNAL_ERROR'] - Error code
   */
  constructor(message, statusCode = 500, code = 'INTERNAL_ERROR') {
    super(message);
    this.statusCode = statusCode;
    this.code = code;
    this.isOperational = true;
    Error.captureStackTrace(this, this.constructor);
  }
}

/**
 * Global error handling middleware.
 * Processes all errors and sends formatted responses.
 *
 * @param {Error} err - Error object
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 * @param {Function} next - Express next middleware
 */
function errorHandler(err, req, res, next) {
  // Default error values
  let statusCode = err.statusCode || 500;
  let errorCode = err.code || 'INTERNAL_ERROR';
  let message = err.message || 'Internal server error';

  // Handle specific error types
  if (err.code === '23505' || err.code === 'DUPLICATE_KEY') {
    statusCode = 409;
    errorCode = 'DUPLICATE_KEY';
    message = message || 'Resource already exists';
  }

  if (err.code === '23503') {
    statusCode = 404;
    errorCode = 'REFERENCED_NOT_FOUND';
    message = 'Referenced resource not found';
  }

  if (err.code === '22P02' || err.code === '23502') {
    statusCode = 400;
    errorCode = 'INVALID_DATA';
    message = 'Invalid data format';
  }

  if (err.name === 'ValidationError') {
    statusCode = 400;
    errorCode = 'VALIDATION_ERROR';
  }

  if (err.name === 'JsonWebTokenError' || err.name === 'TokenExpiredError') {
    statusCode = 401;
    errorCode = 'AUTH_ERROR';
  }

  if (err.code === 'ECONNREFUSED' || err.code === 'ENOTFOUND') {
    statusCode = 503;
    errorCode = 'SERVICE_UNAVAILABLE';
    message = 'Required service is currently unavailable';
  }

  // Log error (don't log 4xx client errors in production)
  if (statusCode >= 500 || process.env.NODE_ENV !== 'production') {
    logger.error('Request error', {
      method: req.method,
      path: req.path,
      statusCode,
      errorCode,
      message: err.message,
      stack: process.env.NODE_ENV === 'development' ? err.stack : undefined,
    });
  }

  // Build error response
  const errorResponse = {
    success: false,
    error: {
      code: errorCode,
      message,
    },
  };

  // Include stack trace in development
  if (process.env.NODE_ENV === 'development') {
    errorResponse.error.stack = err.stack;
  }

  // Include request ID if available
  if (req.id) {
    errorResponse.error.requestId = req.id;
  }

  res.status(statusCode).json(errorResponse);
}

/**
 * 404 not found handler middleware.
 * Catches requests to undefined routes.
 *
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 */
function notFoundHandler(req, res) {
  res.status(404).json({
    success: false,
    error: {
      code: 'ROUTE_NOT_FOUND',
      message: `Route ${req.method} ${req.path} not found`,
    },
  });
}

/**
 * Async handler wrapper to catch errors in async route handlers.
 * Eliminates need for try-catch in every route handler.
 *
 * @param {Function} fn - Async route handler function
 * @returns {Function} Wrapped handler with error catching
 */
function asyncHandler(fn) {
  return (req, res, next) => {
    Promise.resolve(fn(req, res, next)).catch(next);
  };
}

module.exports = {
  AppError,
  errorHandler,
  notFoundHandler,
  asyncHandler,
};
