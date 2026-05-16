// Test environment setup
process.env.NODE_ENV = 'test';
process.env.PORT = '0';
process.env.DB_HOST = 'localhost';
process.env.DB_PORT = '5432';
process.env.DB_NAME = 'sukaczev_comments_test';
process.env.DB_USER = 'postgres';
process.env.DB_PASSWORD = 'postgres';
process.env.REDIS_HOST = 'localhost';
process.env.REDIS_PORT = '6379';
process.env.REDIS_DB = '15';
process.env.RABBITMQ_URL = 'amqp://localhost:5672';
process.env.LOG_LEVEL = 'error';
process.env.COMMENT_MAX_LENGTH = '2000';
process.env.COMMENT_PAGE_SIZE = '20';
process.env.COMMENT_CACHE_TTL = '3600';

jest.setTimeout(30000);

// Suppress console output during tests
global.console = {
  ...console,
  log: jest.fn(),
  debug: jest.fn(),
  info: jest.fn(),
  warn: jest.fn(),
  error: jest.fn()
};

// Mock Redis
jest.mock('../src/config/redis', () => ({
  connectRedis: jest.fn().mockResolvedValue(),
  closeRedis: jest.fn().mockResolvedValue(),
  getRedis: jest.fn().mockReturnValue({
    setex: jest.fn().mockResolvedValue('OK'),
    get: jest.fn().mockResolvedValue(null),
    del: jest.fn().mockResolvedValue(1),
    keys: jest.fn().mockResolvedValue([]),
    incr: jest.fn().mockResolvedValue(1)
  }),
  cacheComments: jest.fn().mockResolvedValue(),
  getCachedComments: jest.fn().mockResolvedValue(null),
  cacheCommentTree: jest.fn().mockResolvedValue(),
  getCachedCommentTree: jest.fn().mockResolvedValue(null),
  invalidateCommentCache: jest.fn().mockResolvedValue(),
  cacheHotComments: jest.fn().mockResolvedValue(),
  getCachedHotComments: jest.fn().mockResolvedValue(null),
  incrementCommentLikeCount: jest.fn().mockResolvedValue(),
  getCommentLikeCount: jest.fn().mockResolvedValue(0)
}));

// Mock RabbitMQ
jest.mock('../src/config/rabbitmq', () => ({
  connectRabbitMQ: jest.fn().mockResolvedValue(),
  closeRabbitMQ: jest.fn().mockResolvedValue(),
  getChannel: jest.fn().mockReturnValue(null),
  isConnected: jest.fn().mockReturnValue(false),
  publishMessage: jest.fn().mockResolvedValue(false),
  publishCommentCreated: jest.fn().mockResolvedValue(false),
  publishCommentDeleted: jest.fn().mockResolvedValue(false),
  publishCommentLiked: jest.fn().mockResolvedValue(false),
  publishCommentReply: jest.fn().mockResolvedValue(false),
  consumeMessages: jest.fn().mockResolvedValue()
}));

// Mock database
jest.mock('../src/config/database', () => ({
  connectDatabase: jest.fn().mockResolvedValue(),
  closeDatabase: jest.fn().mockResolvedValue(),
  query: jest.fn().mockResolvedValue({ rows: [], rowCount: 0 }),
  transaction: jest.fn(async (callback) => {
    const client = {
      query: jest.fn().mockResolvedValue({ rows: [], rowCount: 0 })
    };
    return callback(client);
  }),
  pool: {
    connect: jest.fn().mockReturnValue({
      query: jest.fn().mockResolvedValue({ rows: [] }),
      release: jest.fn()
    }),
    end: jest.fn().mockResolvedValue(),
    on: jest.fn()
  }
}));

afterAll(async () => {
  jest.clearAllMocks();
});

afterEach(() => {
  jest.clearAllMocks();
});
