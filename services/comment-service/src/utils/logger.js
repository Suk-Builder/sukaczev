const winston = require('winston');
const DailyRotateFile = require('winston-daily-rotate-file');
const path = require('path');

const logDir = process.env.LOG_DIR || path.join(__dirname, '../../logs');
const logLevel = process.env.LOG_LEVEL || 'info';

const consoleFormat = winston.format.combine(
  winston.format.colorize(),
  winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
  winston.format.printf(({ level, message, timestamp, ...meta }) => {
    let msg = `${timestamp} [${level}]: ${message}`;
    if (Object.keys(meta).length > 0) {
      msg += ` ${JSON.stringify(meta)}`;
    }
    return msg;
  })
);

const fileFormat = winston.format.combine(
  winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
  winston.format.errors({ stack: true }),
  winston.format.json()
);

const transports = [
  new winston.transports.Console({
    format: consoleFormat,
    level: logLevel
  })
];

if (process.env.NODE_ENV === 'production') {
  transports.push(
    new DailyRotateFile({
      filename: path.join(logDir, 'comment-%DATE%.log'),
      datePattern: 'YYYY-MM-DD',
      maxSize: '20m',
      maxFiles: '14d',
      format: fileFormat,
      level: logLevel
    }),
    new DailyRotateFile({
      filename: path.join(logDir, 'comment-error-%DATE%.log'),
      datePattern: 'YYYY-MM-DD',
      maxSize: '20m',
      maxFiles: '30d',
      format: fileFormat,
      level: 'error'
    })
  );
}

const logger = winston.createLogger({
  level: logLevel,
  defaultMeta: { service: 'comment-service' },
  transports,
  exitOnError: false
});

logger.stream = {
  write: (message) => {
    logger.info(message.trim());
  }
};

module.exports = logger;
