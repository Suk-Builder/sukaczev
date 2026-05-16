const winston = require('winston');
const config = require('../config');

const { combine, timestamp, printf, colorize, errors, json } = winston.format;

const devFormat = printf(({ level, message, timestamp, stack, ...metadata }) => {
  let msg = `${timestamp} [${level}]: ${message}`;
  if (Object.keys(metadata).length > 0) {
    msg += ` ${JSON.stringify(metadata)}`;
  }
  if (stack) {
    msg += `\n${stack}`;
  }
  return msg;
});

const logger = winston.createLogger({
  level: config.app.logLevel,
  defaultMeta: { service: config.app.name },
  transports: [
    new winston.transports.Console({
      format: combine(
        timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
        colorize(),
        errors({ stack: true }),
        config.app.env === 'production' ? json() : devFormat
      ),
    }),
  ],
  exitOnError: false,
});

module.exports = logger;
