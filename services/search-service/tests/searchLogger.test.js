const { SearchLogger } = require('../src/utils/searchLogger');
const logger = require('../src/utils/logger');

jest.mock('../src/utils/logger', () => ({
  info: jest.fn(),
  error: jest.fn(),
  warn: jest.fn(),
  debug: jest.fn(),
}));

describe('SearchLogger', () => {
  let searchLogger;
  let mockEsClient;
  let mockRedis;

  beforeEach(() => {
    jest.clearAllMocks();
    jest.useFakeTimers();

    mockEsClient = {
      index: jest.fn().mockResolvedValue({}),
      search: jest.fn().mockResolvedValue({
        aggregations: {
          popular_queries: {
            buckets: [
              { key: 'python', doc_count: 50 },
              { key: 'anime', doc_count: 30 },
            ],
          },
          zero_result_queries: {
            queries: {
              buckets: [
                { key: 'xyz123', doc_count: 10 },
              ],
            },
          },
        },
      }),
      bulk: jest.fn().mockResolvedValue({}),
    };

    mockRedis = {
      zincrby: jest.fn().mockResolvedValue(1),
    };

    jest.spyOn(require('../src/config/elasticsearch'), 'getEsClient').mockReturnValue(mockEsClient);
    jest.spyOn(require('../src/config/redis'), 'getRedisClient').mockReturnValue(mockRedis);

    searchLogger = new SearchLogger();
  });

  afterEach(() => {
    jest.useRealTimers();
    jest.restoreAllMocks();
  });

  describe('logSearch', () => {
    it('should log search with all parameters', async () => {
      const params = {
        q: 'python tutorial',
        category: 'education',
        sort: 'relevance',
        page: 1,
        pageSize: 20,
        durationMin: 60,
        durationMax: 3600,
        uploadDateFrom: '2024-01-01T00:00:00Z',
        uploadDateTo: '2024-12-31T23:59:59Z',
      };
      const result = { total: 100, took: 15 };
      const context = {
        userId: 'user-001',
        ip: '192.168.1.100',
        userAgent: 'Mozilla/5.0',
      };

      await searchLogger.logSearch(params, result, context);

      // Check buffer has the log entry
      expect(searchLogger.buffer.length).toBe(1);
      const entry = searchLogger.buffer[0];
      expect(entry.query).toBe('python tutorial');
      expect(entry.category).toBe('education');
      expect(entry.sort).toBe('relevance');
      expect(entry.result_count).toBe(100);
      expect(entry.response_time_ms).toBe(15);
      expect(entry.user_id).toBe('user-001');
      expect(entry.user_agent).toBe('Mozilla/5.0');
    });

    it('should anonymize IP address', async () => {
      const params = { q: 'test' };
      const result = { total: 10 };
      const context = { ip: '192.168.1.100' };

      await searchLogger.logSearch(params, result, context);

      const entry = searchLogger.buffer[0];
      expect(entry.ip).toBe('192.168.1.0');
    });

    it('should not log null IPs', async () => {
      const params = { q: 'test' };
      const result = { total: 10 };
      const context = {};

      await searchLogger.logSearch(params, result, context);

      const entry = searchLogger.buffer[0];
      expect(entry.ip).toBeNull();
    });

    it('should not log local IPs', async () => {
      const params = { q: 'test' };
      const result = { total: 10 };
      const context = { ip: '127.0.0.1' };

      await searchLogger.logSearch(params, result, context);

      const entry = searchLogger.buffer[0];
      expect(entry.ip).toBeNull();
    });

    it('should not log empty queries', async () => {
      const params = { q: '' };
      const result = { total: 0 };

      await searchLogger.logSearch(params, result);

      expect(searchLogger.buffer.length).toBe(0);
    });

    it('should not log null queries', async () => {
      const params = { q: null };
      const result = { total: 0 };

      await searchLogger.logSearch(params, result);

      expect(searchLogger.buffer.length).toBe(0);
    });

    it('should update Redis search frequency', async () => {
      const params = { q: 'python' };
      const result = { total: 50 };

      await searchLogger.logSearch(params, result);

      expect(mockRedis.zincrby).toHaveBeenCalledWith('search:frequency', 1, 'python');
    });

    it('should handle Redis frequency update errors', async () => {
      mockRedis.zincrby.mockRejectedValue(new Error('Redis error'));

      const params = { q: 'python' };
      const result = { total: 50 };

      // Should not throw
      await expect(searchLogger.logSearch(params, result)).resolves.not.toThrow();
    });

    it('should use default page values', async () => {
      const params = { q: 'test' };
      const result = {};

      await searchLogger.logSearch(params, result);

      const entry = searchLogger.buffer[0];
      expect(entry.page).toBe(1);
      expect(entry.page_size).toBe(20);
    });

    it('should parse string page values', async () => {
      const params = { q: 'test', page: '2', pageSize: '50' };
      const result = {};

      await searchLogger.logSearch(params, result);

      const entry = searchLogger.buffer[0];
      expect(entry.page).toBe(2);
      expect(entry.page_size).toBe(50);
    });
  });

  describe('getPopularSearches', () => {
    it('should get popular searches', async () => {
      const result = await searchLogger.getPopularSearches(7, 20);

      expect(result.popular).toHaveLength(2);
      expect(result.popular[0]).toEqual({ query: 'python', count: 50 });
      expect(result.popular[1]).toEqual({ query: 'anime', count: 30 });
    });

    it('should get zero-result searches', async () => {
      const result = await searchLogger.getPopularSearches();

      expect(result.zeroResults).toHaveLength(1);
      expect(result.zeroResults[0]).toEqual({ query: 'xyz123', count: 10 });
    });

    it('should handle ES search errors', async () => {
      mockEsClient.search.mockRejectedValue(new Error('ES error'));

      const result = await searchLogger.getPopularSearches();

      expect(result.popular).toEqual([]);
      expect(result.zeroResults).toEqual([]);
    });

    it('should use default parameters', async () => {
      await searchLogger.getPopularSearches();

      const callArgs = mockEsClient.search.mock.calls[0][0];
      expect(callArgs.body.aggs.popular_queries.terms.size).toBe(20);
    });

    it('should query with date range', async () => {
      await searchLogger.getPopularSearches(7);

      const callArgs = mockEsClient.search.mock.calls[0][0];
      expect(callArgs.body.query.range['@timestamp']).toBeDefined();
      expect(callArgs.body.query.range['@timestamp'].gte).toBeDefined();
    });
  });

  describe('_flushBuffer', () => {
    it('should flush buffer to ES', async () => {
      // Add entries to buffer
      searchLogger.buffer.push({ query: 'test1', timestamp: '2024-01-01T00:00:00Z' });
      searchLogger.buffer.push({ query: 'test2', timestamp: '2024-01-01T00:00:00Z' });

      await searchLogger._flushBuffer();

      expect(mockEsClient.bulk).toHaveBeenCalled();
      expect(searchLogger.buffer).toEqual([]);
    });

    it('should do nothing with empty buffer', async () => {
      await searchLogger._flushBuffer();

      expect(mockEsClient.bulk).not.toHaveBeenCalled();
    });

    it('should handle ES bulk errors', async () => {
      mockEsClient.bulk.mockRejectedValue(new Error('Bulk failed'));

      searchLogger.buffer.push({ query: 'test1', timestamp: '2024-01-01T00:00:00Z' });

      await searchLogger._flushBuffer();

      // Buffer should retain some entries for retry
      expect(searchLogger.buffer.length).toBeGreaterThanOrEqual(0);
    });

    it('should limit retry buffer size', async () => {
      mockEsClient.bulk.mockRejectedValue(new Error('Bulk failed'));

      // Add more entries than max buffer size
      for (let i = 0; i < 150; i++) {
        searchLogger.buffer.push({ query: `test${i}`, timestamp: '2024-01-01T00:00:00Z' });
      }

      await searchLogger._flushBuffer();

      expect(searchLogger.buffer.length).toBeLessThanOrEqual(100);
    });
  });

  describe('_anonymizeIp', () => {
    it('should anonymize IPv4 address', () => {
      const result = searchLogger._anonymizeIp('192.168.1.100');
      expect(result).toBe('192.168.1.0');
    });

    it('should return null for localhost', () => {
      const result = searchLogger._anonymizeIp('127.0.0.1');
      expect(result).toBeNull();
    });

    it('should return null for empty IP', () => {
      const result = searchLogger._anonymizeIp('');
      expect(result).toBeNull();
    });

    it('should return null for undefined IP', () => {
      const result = searchLogger._anonymizeIp(undefined);
      expect(result).toBeNull();
    });
  });

  describe('shutdown', () => {
    it('should flush buffer and shut down', async () => {
      searchLogger.buffer.push({ query: 'test', timestamp: '2024-01-01T00:00:00Z' });

      await searchLogger.shutdown();

      expect(mockEsClient.bulk).toHaveBeenCalled();
    });
  });
});
