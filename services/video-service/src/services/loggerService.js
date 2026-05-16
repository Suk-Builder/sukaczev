/**
 * @fileoverview Winston logger configuration for video-service.
 * Provides structured logging with multiple transports.
 */

const winston = require('winston');

const logFormat = winston.format.combine(
  winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
  winston.format.errors({ stack: true }),
  winston.format.json()
);

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

const logger = winston.createLogger({
  level: process.env.LOG_LEVEL || 'info',
  defaultMeta: { service: 'video-service' },
  transports: [
    new winston.transports.Console({
      format: process.env.NODE_ENV === 'production' ? logFormat : consoleFormat,
    }),
  ],
});

if (process.env.NODE_ENV === 'production') {
  logger.add(new winston.transports.File({
    filename: 'logs/video-service-error.log',
    level: 'error',
    format: logFormat,
  }));
  logger.add(new winston.transports.File({
    filename: 'logs/video-service-combined.log',
    format: logFormat,
  }));
}

logger.stream = {
  write: (message) => {
    logger.info(message.trim());
  },
};

module.exports = logger;
