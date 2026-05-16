const dotenv = require('dotenv');

dotenv.config();

const config = {
  app: {
    name: process.env.APP_NAME || 'sukaczev-search-service',
    port: parseInt(process.env.PORT, 10) || 3003,
    env: process.env.NODE_ENV || 'development',
    logLevel: process.env.LOG_LEVEL || 'info',
  },
  elasticsearch: {
    node: process.env.ES_NODE || 'http://localhost:9200',
    username: process.env.ES_USERNAME || '',
    password: process.env.ES_PASSWORD || '',
    indexName: process.env.ES_INDEX_NAME || 'sukaczev_videos',
    maxRetries: parseInt(process.env.ES_MAX_RETRIES, 10) || 3,
    requestTimeout: parseInt(process.ES_REQUEST_TIMEOUT, 10) || 30000,
    sniffOnStart: process.env.ES_SNIFF_ON_START === 'true',
  },
  redis: {
    host: process.env.REDIS_HOST || 'localhost',
    port: parseInt(process.env.REDIS_PORT, 10) || 6379,
    password: process.env.REDIS_PASSWORD || '',
    db: parseInt(process.env.REDIS_DB, 10) || 0,
    keyPrefix: process.env.REDIS_KEY_PREFIX || 'search:',
    retryDelayOnFailover: 100,
    maxRetriesPerRequest: 3,
  },
  rabbitmq: {
    url: process.env.RABBITMQ_URL || 'amqp://localhost:5672',
    exchange: process.env.RABBITMQ_EXCHANGE || 'sukaczev.events',
    queue: process.env.RABBITMQ_QUEUE || 'search.indexing',
    reconnectInterval: parseInt(process.env.RABBITMQ_RECONNECT_INTERVAL, 10) || 5000,
    maxReconnectAttempts: parseInt(process.env.RABBITMQ_MAX_RECONNECT_ATTEMPTS, 10) || 10,
  },
  search: {
    defaultPageSize: parseInt(process.env.SEARCH_DEFAULT_PAGE_SIZE, 10) || 20,
    maxPageSize: parseInt(process.env.SEARCH_MAX_PAGE_SIZE, 10) || 100,
    suggestLimit: parseInt(process.env.SEARCH_SUGGEST_LIMIT, 10) || 10,
    trendingLimit: parseInt(process.env.SEARCH_TRENDING_LIMIT, 10) || 20,
    trendingUpdateInterval: parseInt(process.env.SEARCH_TRENDING_UPDATE_INTERVAL, 10) || 600000,
    hotSearchExpireSeconds: parseInt(process.env.SEARCH_HOT_EXPIRE, 10) || 86400,
    searchLogIndex: process.env.SEARCH_LOG_INDEX || 'sukaczev_search_logs',
  },
  jwt: {
    secret: process.env.JWT_SECRET || require('crypto').randomBytes(64).toString('hex'),
    expiresIn: process.env.JWT_EXPIRES_IN || '7d',
  },
  services: {
    videoService: process.env.VIDEO_SERVICE_URL || 'http://localhost:3001',
    userService: process.env.USER_SERVICE_URL || 'http://localhost:3002',
  },
};

module.exports = config;
