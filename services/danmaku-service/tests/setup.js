// Test environment setup
process.env.NODE_ENV = 'test';
process.env.PORT = '0';
process.env.DB_HOST = 'localhost';
process.env.DB_PORT = '5432';
process.env.DB_NAME = 'sukaczev_danmaku_test';
process.env.DB_USER = 'postgres';
process.env.DB_PASSWORD = 'postgres';
process.env.REDIS_HOST = 'localhost';
process.env.REDIS_PORT = '6379';
process.env.REDIS_DB = '15';
process.env.LOG_LEVEL = 'error';
process.env.DANMAKU_MAX_LENGTH = '100';
process.env.DANMAKU_DENSITY_LIMIT = '10';
process.env.DANMAKU_CACHE_TTL = '3600';
process.env.SENSITIVE_WORDS = 'spam,abuse,toxic,hate,racist,sexist';
process.env.CORS_ORIGIN = '*';

// Increase test timeout for database operations
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

// Mock Redis for unit tests
jest.mock('../src/config/redis', () => ({
  connectRedis: jest.fn().mockResolvedValue(),
  closeRedis: jest.fn().mockResolvedValue(),
  getRedis: jest.fn().mockReturnValue({
    pipeline: jest.fn().mockReturnValue({
      lpush: jest.fn().mockReturnThis(),
      ltrim: jest.fn().mockReturnThis(),
      expire: jest.fn().mockReturnThis(),
      hincrby: jest.fn().mockReturnThis(),
      hget: jest.fn().mockReturnThis(),
      lrange: jest.fn().mockReturnThis(),
      del: jest.fn().mockReturnThis(),
      get: jest.fn().mockReturnThis(),
      incr: jest.fn().mockReturnThis(),
      exec: jest.fn().mockResolvedValue([])
    }),
    lrange: jest.fn().mockResolvedValue([]),
    hget: jest.fn().mockResolvedValue('0'),
    hincrby: jest.fn().mockResolvedValue(1),
    del: jest.fn().mockResolvedValue(1),
    get: jest.fn().mockResolvedValue(null),
    incr: jest.fn().mockResolvedValue(1),
    quit: jest.fn().mockResolvedValue()
  }),
  cacheDanmaku: jest.fn().mockResolvedValue(),
  getCachedDanmaku: jest.fn().mockResolvedValue([]),
  getDanmakuDensity: jest.fn().mockResolvedValue(0),
  incrementDanmakuDensity: jest.fn().mockResolvedValue(),
  clearDanmakuCache: jest.fn().mockResolvedValue()
}));

// Mock database for unit tests
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

// Cleanup after all tests
afterAll(async () => {
  jest.clearAllMocks();
});

// Reset mocks after each test
afterEach(() => {
  jest.clearAllMocks();
});
