const dotenv = require('dotenv');

dotenv.config();

const config = {
  app: {
    name: process.env.APP_NAME || 'sukaczev-notification-service',
    port: parseInt(process.env.PORT, 10) || 3004,
    wsPort: parseInt(process.env.WS_PORT, 10) || 8084,
    env: process.env.NODE_ENV || 'development',
    logLevel: process.env.LOG_LEVEL || 'info',
  },
  database: {
    host: process.env.DB_HOST || 'localhost',
    port: parseInt(process.env.DB_PORT, 10) || 5432,
    name: process.env.DB_NAME || 'sukaczev',
    user: process.env.DB_USER || 'sukaczev',
    password: process.env.DB_PASSWORD,
    poolSize: parseInt(process.env.DB_POOL_SIZE, 10) || 10,
    ssl: process.env.DB_SSL === 'true',
    dialect: 'postgres',
    logging: process.env.DB_LOGGING === 'true',
  },
  redis: {
    host: process.env.REDIS_HOST || 'localhost',
    port: parseInt(process.env.REDIS_PORT, 10) || 6379,
    password: process.env.REDIS_PASSWORD || '',
    db: parseInt(process.env.REDIS_DB, 10) || 1,
    keyPrefix: process.env.REDIS_KEY_PREFIX || 'notify:',
    retryDelayOnFailover: 100,
    maxRetriesPerRequest: 3,
  },
  rabbitmq: {
    url: process.env.RABBITMQ_URL || 'amqp://localhost:5672',
    exchange: process.env.RABBITMQ_EXCHANGE || 'sukaczev.events',
    reconnectInterval: parseInt(process.env.RABBITMQ_RECONNECT_INTERVAL, 10) || 5000,
    maxReconnectAttempts: parseInt(process.env.RABBITMQ_MAX_RECONNECT_ATTEMPTS, 10) || 10,
  },
  jwt: {
    secret: process.env.JWT_SECRET || require('crypto').randomBytes(64).toString('hex'),
    expiresIn: process.env.JWT_EXPIRES_IN || '7d',
  },
  websocket: {
    heartbeatInterval: parseInt(process.env.WS_HEARTBEAT_INTERVAL, 10) || 30000,
    maxConnectionsPerUser: parseInt(process.env.WS_MAX_CONNECTIONS_PER_USER, 10) || 5,
    messageRateLimit: parseInt(process.env.WS_MESSAGE_RATE_LIMIT, 10) || 100,
  },
  notification: {
    pageSize: parseInt(process.env.NOTIFICATION_PAGE_SIZE, 10) || 20,
    maxPageSize: parseInt(process.env.NOTIFICATION_MAX_PAGE_SIZE, 10) || 100,
    aggregationWindowMs: parseInt(process.env.NOTIFICATION_AGGREGATION_WINDOW_MS, 10) || 300000,
    unreadCacheTtl: parseInt(process.env.NOTIFICATION_UNREAD_CACHE_TTL, 10) || 300,
    maxUnreadCount: parseInt(process.env.NOTIFICATION_MAX_UNREAD_COUNT, 10) || 999,
  },
};

module.exports = config;
