/**
 * @fileoverview Global error handling middleware for video-service.
 */

const logger = require('../services/loggerService');

/**
 * Custom application error class.
 */
class AppError extends Error {
  constructor(message, statusCode = 500, code = 'INTERNAL_ERROR') {
    super(message);
    this.statusCode = statusCode;
    this.code = code;
    this.isOperational = true;
    Error.captureStackTrace(this, this.constructor);
  }
}

/**
 * Global error handler middleware.
 *
 * @param {Error} err
 * @param {Object} req
 * @param {Object} res
 * @param {Function} next
 */
function errorHandler(err, req, res, next) {
  let statusCode = err.statusCode || 500;
  let errorCode = err.code || 'INTERNAL_ERROR';
  let message = err.message || 'Internal server error';

  if (err.code === '23505' || err.code === 'DUPLICATE_KEY') {
    statusCode = 409;
    errorCode = 'DUPLICATE_KEY';
  }

  if (err.code === '23503') {
    statusCode = 404;
    errorCode = 'REFERENCED_NOT_FOUND';
    message = 'Referenced resource not found';
  }

  if (err.code === '22P02' || err.code === '23502') {
    statusCode = 400;
    errorCode = 'INVALID_DATA';
  }

  if (err.code === 'ECONNREFUSED' || err.code === 'ENOTFOUND') {
    statusCode = 503;
    errorCode = 'SERVICE_UNAVAILABLE';
    message = 'Required service is currently unavailable';
  }

  if (statusCode >= 500 || process.env.NODE_ENV !== 'production') {
    logger.error('Request error', {
      method: req.method,
      path: req.path,
      statusCode,
      errorCode,
      message: err.message,
    });
  }

  const errorResponse = {
    success: false,
    error: {
      code: errorCode,
      message,
    },
  };

  if (process.env.NODE_ENV === 'development') {
    errorResponse.error.stack = err.stack;
  }

  res.status(statusCode).json(errorResponse);
}

function notFoundHandler(req, res) {
  res.status(404).json({
    success: false,
    error: {
      code: 'ROUTE_NOT_FOUND',
      message: `Route ${req.method} ${req.path} not found`,
    },
  });
}

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
