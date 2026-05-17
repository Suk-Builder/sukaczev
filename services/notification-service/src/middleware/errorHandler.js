const logger = require('../utils/logger');

const errorHandler = (err, req, res, next) => {
  logger.error('Error:', {
    message: err.message,
    stack: process.env.NODE_ENV === 'development' ? err.stack : undefined,
    path: req.path,
    method: req.method,
  });

  // Handle Sequelize errors
  if (err.name === 'SequelizeValidationError') {
    return res.status(400).json({
      success: false,
      message: 'Validation failed',
      errors: err.errors.map((e) => ({ field: e.path, message: e.message })),
      timestamp: new Date().toISOString(),
    });
  }

  if (err.name === 'SequelizeUniqueConstraintError') {
    return res.status(409).json({
      success: false,
      message: 'Resource already exists',
      timestamp: new Date().toISOString(),
    });
  }

  if (err.name === 'SequelizeDatabaseError') {
    return res.status(500).json({
      success: false,
      message: 'Database error',
      timestamp: new Date().toISOString(),
    });
  }

  if (err.name === 'SequelizeConnectionError') {
    return res.status(503).json({
      success: false,
      message: 'Database connection error',
      timestamp: new Date().toISOString(),
    });
  }

  // Handle connection errors
  if (err.message?.includes('ECONNREFUSED') || err.message?.includes('connect')) {
    return res.status(503).json({
      success: false,
      message: 'Service temporarily unavailable',
      timestamp: new Date().toISOString(),
    });
  }

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
