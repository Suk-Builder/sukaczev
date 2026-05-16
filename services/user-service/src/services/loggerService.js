/**
 * @fileoverview Winston logger configuration for user-service.
 * Provides structured logging with multiple transports.
 */

const winston = require('winston');

/**
 * Log format combining timestamp, JSON structure, and colorization for console.
 */
const logFormat = winston.format.combine(
  winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
  winston.format.errors({ stack: true }),
  winston.format.json()
);

/**
 * Console format for development - more human readable.
 */
const consoleFormat = winston.format.combine(
  winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
  winston.format.colorize(),
  winston.format.printf(({ level, message, timestamp, ...metadata }) => {
    let msg = `${timestamp} [${level}] ${message}`;
    if (Object.keys(metadata).length > 0) {
      msg += ` ${JSON.stringify(metadata)}`;
    }
    return msg;
  })
);

/**
 * Winston logger instance.
 */
const logger = winston.createLogger({
  level: process.env.LOG_LEVEL || 'info',
  defaultMeta: { service: 'user-service' },
  transports: [
    new winston.transports.Console({
      format: process.env.NODE_ENV === 'production' ? logFormat : consoleFormat,
    }),
  ],
});

// Add file transport in production
if (process.env.NODE_ENV === 'production') {
  logger.add(new winston.transports.File({
    filename: 'logs/user-service-error.log',
    level: 'error',
    format: logFormat,
  }));
  logger.add(new winston.transports.File({
    filename: 'logs/user-service-combined.log',
    format: logFormat,
  }));
}

/**
 * Stream interface for Morgan HTTP logging integration.
 */
logger.stream = {
  write: (message) => {
    logger.info(message.trim());
  },
};

module.exports = logger;
