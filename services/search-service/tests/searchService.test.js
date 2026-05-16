const { SearchService } = require('../src/services/searchService');
const { getRedisClient, closeRedisClient } = require('../src/config/redis');
const { getEsClient, closeEsClient } = require('../src/config/elasticsearch');
const logger = require('../src/utils/logger');

// Mock logger to reduce noise
jest.mock('../src/utils/logger', () => ({
  info: jest.fn(),
  error: jest.fn(),
  warn: jest.fn(),
  debug: jest.fn(),
}));

describe('SearchService', () => {
  let searchService;
  let mockEsClient;
  let mockRedis;

  beforeEach(() => {
    // Reset mocks
    jest.clearAllMocks();

    // Create mock Elasticsearch client
    mockEsClient = {
      search: jest.fn(),
      index: jest.fn(),
    };

    // Create mock Redis client
    mockRedis = {
      get: jest.fn(),
      setex: jest.fn(),
      zincrby: jest.fn(),
      zrevrange: jest.fn(),
      pipeline: jest.fn().mockReturnThis(),
      del: jest.fn().mockReturnThis(),
      zadd: jest.fn().mockReturnThis(),
      expire: jest.fn().mockReturnThis(),
      exec: jest.fn().mockResolvedValue([]),
    };

    // Mock getEsClient and getRedisClient
    jest.spyOn(require('../src/config/elasticsearch'), 'getEsClient').mockReturnValue(mockEsClient);
    jest.spyOn(require('../src/config/redis'), 'getRedisClient').mockReturnValue(mockRedis);

    searchService = new SearchService();
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  afterAll(async () => {
    await closeRedisClient();
    await closeEsClient();
  });

  describe('search', () => {
    it('should perform basic search with query', async () => {
      const mockResponse = {
        hits: {
          total: { value: 2 },
          hits: [
            {
              _id: 'vid-001',
              _score: 1.5,
              _source: {
                title: 'Test Video',
                description: 'Test Description',
                username: 'TestUser',
                category: 'tech',
                tags: ['test'],
                views: 100,
                likes: 10,
                duration: 300,
                cover_url: '',
                video_url: '',
                user_id: 'user-001',
                created_at: '2024-01-01T00:00:00Z',
              },
              highlight: {
                title: ['<mark>Test</mark> Video'],
              },
            },
          ],
        },
        took: 10,
      };

      mockEsClient.search.mockResolvedValue(mockResponse);

      const result = await searchService.search({ q: 'test' });

      expect(mockEsClient.search).toHaveBeenCalledTimes(1);
      expect(result.results).toHaveLength(1);
      expect(result.total).toBe(2);
      expect(result.query).toBe('test');
      expect(result.results[0].title).toBe('<mark>Test</mark> Video');
    });

    it('should search with category filter', async () => {
      const mockResponse = {
        hits: {
          total: { value: 1 },
          hits: [
            {
              _id: 'vid-001',
              _score: 1.0,
              _source: {
                title: 'Tech Video',
                description: 'Description',
                username: 'User',
                category: 'tech',
                tags: [],
                views: 100,
                likes: 10,
                duration: 300,
                cover_url: '',
                video_url: '',
                user_id: 'u1',
                created_at: '2024-01-01T00:00:00Z',
              },
              highlight: {},
            },
          ],
        },
        took: 5,
      };

      mockEsClient.search.mockResolvedValue(mockResponse);

      const result = await searchService.search({ q: 'tech', category: 'tech' });

      expect(result.results).toHaveLength(1);
      expect(mockEsClient.search).toHaveBeenCalled();
      const searchBody = mockEsClient.search.mock.calls[0][0].body;
      expect(searchBody.query.bool.filter).toContainEqual({ term: { category: 'tech' } });
    });

    it('should search with sort by latest', async () => {
      const mockResponse = {
        hits: {
          total: { value: 3 },
          hits: [
            {
              _id: 'vid-003',
              _score: 1,
              _source: {
                title: 'Latest Video',
                description: 'Desc',
                username: 'User',
                category: 'tech',
                tags: [],
                views: 50,
                likes: 5,
                duration: 100,
                cover_url: '',
                video_url: '',
                user_id: 'u1',
                created_at: '2024-03-01T00:00:00Z',
              },
              highlight: {},
            },
            {
              _id: 'vid-002',
              _score: 1,
              _source: {
                title: 'Older Video',
                description: 'Desc',
                username: 'User',
                category: 'tech',
                tags: [],
                views: 50,
                likes: 5,
                duration: 100,
                cover_url: '',
                video_url: '',
                user_id: 'u1',
                created_at: '2024-02-01T00:00:00Z',
              },
              highlight: {},
            },
          ],
        },
        took: 5,
      };

      mockEsClient.search.mockResolvedValue(mockResponse);

      const result = await searchService.search({ q: 'video', sort: 'latest' });

      expect(result.results).toHaveLength(2);
      const searchBody = mockEsClient.search.mock.calls[0][0].body;
      expect(searchBody.sort).toEqual([{ created_at: { order: 'desc' } }]);
    });

    it('should search with sort by popular', async () => {
      const mockResponse = {
        hits: {
          total: { value: 2 },
          hits: [],
        },
        took: 3,
      };

      mockEsClient.search.mockResolvedValue(mockResponse);

      await searchService.search({ q: 'video', sort: 'popular' });

      const searchBody = mockEsClient.search.mock.calls[0][0].body;
      expect(searchBody.sort).toEqual([
        { views: { order: 'desc' } },
        { likes: { order: 'desc' } },
      ]);
    });

    it('should search with sort by likes', async () => {
      const mockResponse = {
        hits: {
          total: { value: 2 },
          hits: [],
        },
        took: 3,
      };

      mockEsClient.search.mockResolvedValue(mockResponse);

      await searchService.search({ q: 'video', sort: 'likes' });

      const searchBody = mockEsClient.search.mock.calls[0][0].body;
      expect(searchBody.sort).toEqual([{ likes: { order: 'desc' } }]);
    });

    it('should search with duration filter', async () => {
      const mockResponse = {
        hits: {
          total: { value: 1 },
          hits: [
            {
              _id: 'vid-001',
              _score: 1,
              _source: {
                title: 'Short Video',
                description: 'Desc',
                username: 'User',
                category: 'tech',
                tags: [],
                views: 100,
                likes: 10,
                duration: 300,
                cover_url: '',
                video_url: '',
                user_id: 'u1',
                created_at: '2024-01-01T00:00:00Z',
              },
              highlight: {},
            },
          ],
        },
        took: 3,
      };

      mockEsClient.search.mockResolvedValue(mockResponse);

      const result = await searchService.search({
        q: 'video',
        durationMin: 0,
        durationMax: 600,
      });

      expect(result.results).toHaveLength(1);
      const searchBody = mockEsClient.search.mock.calls[0][0].body;
      expect(searchBody.query.bool.filter).toContainEqual({
        range: { duration: { gte: 0, lte: 600 } },
      });
    });

    it('should search with upload date filter', async () => {
      const mockResponse = {
        hits: {
          total: { value: 0 },
          hits: [],
        },
        took: 2,
      };

      mockEsClient.search.mockResolvedValue(mockResponse);

      await searchService.search({
        q: 'video',
        uploadDateFrom: '2024-01-01T00:00:00Z',
        uploadDateTo: '2024-12-31T23:59:59Z',
      });

      const searchBody = mockEsClient.search.mock.calls[0][0].body;
      expect(searchBody.query.bool.filter).toContainEqual({
        range: {
          created_at: {
            gte: '2024-01-01T00:00:00Z',
            lte: '2024-12-31T23:59:59Z',
          },
        },
      });
    });

    it('should search with minViews filter', async () => {
      const mockResponse = {
        hits: {
          total: { value: 0 },
          hits: [],
        },
        took: 2,
      };

      mockEsClient.search.mockResolvedValue(mockResponse);

      await searchService.search({
        q: 'video',
        minViews: 1000,
      });

      const searchBody = mockEsClient.search.mock.calls[0][0].body;
      expect(searchBody.query.bool.filter).toContainEqual({
        range: { views: { gte: 1000 } },
      });
    });

    it('should search with minLikes filter', async () => {
      const mockResponse = {
        hits: {
          total: { value: 0 },
          hits: [],
        },
        took: 2,
      };

      mockEsClient.search.mockResolvedValue(mockResponse);

      await searchService.search({
        q: 'video',
        minLikes: 100,
      });

      const searchBody = mockEsClient.search.mock.calls[0][0].body;
      expect(searchBody.query.bool.filter).toContainEqual({
        range: { likes: { gte: 100 } },
      });
    });

    it('should return empty results when no query and no filters', async () => {
      const mockResponse = {
        hits: {
          total: { value: 0 },
          hits: [],
        },
        took: 1,
      };

      mockEsClient.search.mockResolvedValue(mockResponse);

      const result = await searchService.search({});

      expect(result.results).toHaveLength(0);
      expect(result.total).toBe(0);
    });

    it('should handle pagination', async () => {
      const mockResponse = {
        hits: {
          total: { value: 50 },
          hits: Array.from({ length: 20 }, (_, i) => ({
            _id: `vid-${i}`,
            _score: 1,
            _source: {
              title: `Video ${i}`,
              description: 'Desc',
              username: 'User',
              category: 'tech',
              tags: [],
              views: i * 10,
              likes: i,
              duration: 100,
              cover_url: '',
              video_url: '',
              user_id: 'u1',
              created_at: '2024-01-01T00:00:00Z',
            },
            highlight: {},
          })),
        },
        took: 5,
      };

      mockEsClient.search.mockResolvedValue(mockResponse);

      const result = await searchService.search({ q: 'video', page: 1, pageSize: 20 });

      expect(result.results).toHaveLength(20);
      expect(result.page).toBe(1);
      expect(result.pageSize).toBe(20);
    });

    it('should cap pageSize at max', async () => {
      const mockResponse = {
        hits: {
          total: { value: 200 },
          hits: [],
        },
        took: 2,
      };

      mockEsClient.search.mockResolvedValue(mockResponse);

      const result = await searchService.search({ q: 'video', pageSize: 200 });

      // Should cap at 100 (maxPageSize)
      expect(result.pageSize).toBeLessThanOrEqual(100);
    });

    it('should handle empty query with match_all', async () => {
      const mockResponse = {
        hits: {
          total: { value: 10 },
          hits: [],
        },
        took: 2,
      };

      mockEsClient.search.mockResolvedValue(mockResponse);

      await searchService.search({ q: '' });

      const searchBody = mockEsClient.search.mock.calls[0][0].body;
      expect(searchBody.query.bool.must).toContainEqual({ match_all: {} });
    });

    it('should update search frequency when results found', async () => {
      const mockResponse = {
        hits: {
          total: { value: 5 },
          hits: [
            {
              _id: 'vid-001',
              _score: 1,
              _source: {
                title: 'Video',
                description: 'Desc',
                username: 'User',
                category: 'tech',
                tags: [],
                views: 100,
                likes: 10,
                duration: 300,
                cover_url: '',
                video_url: '',
                user_id: 'u1',
                created_at: '2024-01-01T00:00:00Z',
              },
              highlight: {},
            },
          ],
        },
        took: 5,
      };

      mockEsClient.search.mockResolvedValue(mockResponse);

      await searchService.search({ q: 'popular query' });

      expect(mockRedis.zincrby).toHaveBeenCalledWith('search:frequency', 1, 'popular query');
    });

    it('should handle ES errors gracefully', async () => {
      mockEsClient.search.mockRejectedValue(new Error('ES connection failed'));

      await expect(searchService.search({ q: 'test' })).rejects.toThrow('ES connection failed');
    });

    it('should record search log after search', async () => {
      const mockResponse = {
        hits: {
          total: { value: 1 },
          hits: [],
        },
        took: 5,
      };

      mockEsClient.search.mockResolvedValue(mockResponse);
      mockEsClient.index.mockResolvedValue({});

      await searchService.search({ q: 'logged query', category: 'tech', sort: 'latest' });

      expect(mockEsClient.index).toHaveBeenCalled();
      const logEntry = mockEsClient.index.mock.calls[0][0].body;
      expect(logEntry.query).toBe('logged query');
      expect(logEntry.category).toBe('tech');
      expect(logEntry.sort).toBe('latest');
    });
  });

  describe('getSuggestions', () => {
    it('should return empty array for empty query', async () => {
      const result = await searchService.getSuggestions('');
      expect(result).toEqual([]);
    });

    it('should return empty array for null query', async () => {
      const result = await searchService.getSuggestions(null);
      expect(result).toEqual([]);
    });

    it('should return cached suggestions if available', async () => {
      const cached = ['test video', 'test music', 'test'];
      mockRedis.get.mockResolvedValue(JSON.stringify(cached));

      const result = await searchService.getSuggestions('test');

      expect(result).toEqual(cached);
      expect(mockRedis.get).toHaveBeenCalledWith('suggest:test');
    });

    it('should generate and cache suggestions when not cached', async () => {
      mockRedis.get.mockResolvedValue(null);
      mockRedis.setex.mockResolvedValue('OK');

      // Mock ES completion suggest
      mockEsClient.search = jest.fn().mockResolvedValue({
        suggest: {
          title_suggest: [{
            options: [
              { text: 'test video' },
              { text: 'test music' },
            ],
          }],
        },
      });

      const result = await searchService.getSuggestions('test');

      expect(result.length).toBeGreaterThan(0);
      expect(mockRedis.setex).toHaveBeenCalled();
    });

    it('should handle Redis errors gracefully', async () => {
      mockRedis.get.mockRejectedValue(new Error('Redis error'));

      const result = await searchService.getSuggestions('test');

      expect(Array.isArray(result)).toBe(true);
    });
  });

  describe('getTrending', () => {
    it('should return trending searches from Redis', async () => {
      const mockTrending = [
        'python', '10',
        'anime', '8',
        'food', '5',
      ];
      mockRedis.zrevrange.mockResolvedValue(mockTrending);

      const result = await searchService.getTrending();

      expect(result).toHaveLength(3);
      expect(result[0]).toEqual({ rank: 1, term: 'python', score: 10 });
      expect(result[1]).toEqual({ rank: 2, term: 'anime', score: 8 });
      expect(result[2]).toEqual({ rank: 3, term: 'food', score: 5 });
    });

    it('should return default trending when no data', async () => {
      mockRedis.zrevrange.mockResolvedValue([]);

      const result = await searchService.getTrending();

      expect(result.length).toBeGreaterThan(0);
      expect(result[0]).toHaveProperty('rank');
      expect(result[0]).toHaveProperty('term');
      expect(result[0]).toHaveProperty('score');
    });

    it('should handle Redis errors and return defaults', async () => {
      mockRedis.zrevrange.mockRejectedValue(new Error('Redis error'));

      const result = await searchService.getTrending();

      expect(result.length).toBeGreaterThan(0);
    });

    it('should limit trending results to configured limit', async () => {
      const manyTrending = [];
      for (let i = 0; i < 50; i++) {
        manyTrending.push(`term-${i}`);
        manyTrending.push(`${50 - i}`);
      }
      mockRedis.zrevrange.mockResolvedValue(manyTrending);

      const result = await searchService.getTrending();

      // Should be limited to trendingLimit (default 20)
      expect(result.length).toBeLessThanOrEqual(20);
    });
  });

  describe('updateTrendingSearches', () => {
    it('should update trending from frequency data', async () => {
      const frequencies = [
        'python tutorial', '50',
        'anime', '40',
        'food', '30',
      ];
      mockRedis.zrevrange.mockResolvedValue(frequencies);

      await searchService.updateTrendingSearches();

      expect(mockRedis.pipeline).toHaveBeenCalled();
    });

    it('should do nothing when no frequency data', async () => {
      mockRedis.zrevrange.mockResolvedValue([]);

      await searchService.updateTrendingSearches();

      expect(mockRedis.pipeline).not.toHaveBeenCalled();
    });

    it('should handle Redis errors gracefully', async () => {
      mockRedis.zrevrange.mockRejectedValue(new Error('Redis error'));

      await expect(searchService.updateTrendingSearches()).rejects.toThrow('Redis error');
    });
  });

  describe('_formatSearchResult', () => {
    it('should format hit with highlights', () => {
      const hit = {
        _id: 'vid-001',
        _score: 2.5,
        _source: {
          title: 'Original Title',
          description: 'Original Description',
          username: 'User1',
          category: 'tech',
          tags: ['tag1', 'tag2'],
          views: 100,
          likes: 10,
          duration: 300,
          cover_url: 'https://example.com/cover.jpg',
          video_url: 'https://example.com/video.mp4',
          user_id: 'u1',
          created_at: '2024-01-01T00:00:00Z',
        },
        highlight: {
          title: ['<mark>Highlighted</mark> Title'],
          description: ['<mark>Highlighted</mark> Description'],
        },
      };

      const result = searchService._formatSearchResult(hit);

      expect(result.id).toBe('vid-001');
      expect(result.score).toBe(2.5);
      expect(result.title).toBe('<mark>Highlighted</mark> Title');
      expect(result.description).toBe('<mark>Highlighted</mark> Description');
      expect(result.highlights.title).toEqual(['<mark>Highlighted</mark> Title']);
      expect(result.views).toBe(100);
      expect(result.likes).toBe(10);
    });

    it('should format hit without highlights', () => {
      const hit = {
        _id: 'vid-002',
        _score: 1.0,
        _source: {
          title: 'No Highlight Title',
          description: 'No Highlight Description',
          username: 'User2',
          category: 'anime',
          tags: [],
          views: 0,
          likes: 0,
          duration: 0,
          cover_url: '',
          video_url: '',
          user_id: 'u2',
          created_at: '2024-01-01T00:00:00Z',
        },
        highlight: undefined,
      };

      const result = searchService._formatSearchResult(hit);

      expect(result.title).toBe('No Highlight Title');
      expect(result.description).toBe('No Highlight Description');
      expect(result.highlights.title).toEqual([]);
      expect(result.highlights.description).toEqual([]);
    });

    it('should format hit with partial highlights', () => {
      const hit = {
        _id: 'vid-003',
        _score: 1.5,
        _source: {
          title: 'Title',
          description: 'Desc',
          username: 'User',
          category: 'food',
          tags: [],
          views: 50,
          likes: 5,
          duration: 200,
          cover_url: '',
          video_url: '',
          user_id: 'u3',
          created_at: '2024-01-01T00:00:00Z',
        },
        highlight: {
          title: ['<mark>Title</mark>'],
        },
      };

      const result = searchService._formatSearchResult(hit);

      expect(result.title).toBe('<mark>Title</mark>');
      expect(result.highlights.title).toEqual(['<mark>Title</mark>']);
      expect(result.highlights.description).toEqual([]);
    });
  });

  describe('_buildQuery', () => {
    it('should build query with text search', () => {
      const query = searchService._buildQuery({ query: 'test' });

      expect(query.bool.must).toHaveLength(1);
      expect(query.bool.must[0]).toHaveProperty('multi_match');
      expect(query.bool.must[0].multi_match.query).toBe('test');
      expect(query.bool.must[0].multi_match.fields).toContain('title^3');
    });

    it('should build query with match_all when no query', () => {
      const query = searchService._buildQuery({});

      expect(query.bool.must).toContainEqual({ match_all: {} });
    });

    it('should build query with all filters', () => {
      const query = searchService._buildQuery({
        query: 'test',
        category: 'tech',
        durationMin: 60,
        durationMax: 3600,
        uploadDateFrom: '2024-01-01T00:00:00Z',
        uploadDateTo: '2024-12-31T23:59:59Z',
        minViews: 100,
        minLikes: 10,
      });

      expect(query.bool.filter).toHaveLength(5);
      expect(query.bool.filter).toContainEqual({ term: { category: 'tech' } });
      expect(query.bool.filter).toContainEqual({
        range: { duration: { gte: 60, lte: 3600 } },
      });
      expect(query.bool.filter).toContainEqual({
        range: { created_at: { gte: '2024-01-01T00:00:00Z', lte: '2024-12-31T23:59:59Z' } },
      });
      expect(query.bool.filter).toContainEqual({
        range: { views: { gte: 100 } },
      });
      expect(query.bool.filter).toContainEqual({
        range: { likes: { gte: 10 } },
      });
    });
  });

  describe('_buildSort', () => {
    it('should return relevance sort by default', () => {
      const sort = searchService._buildSort('relevance');
      expect(sort).toEqual(['_score', { created_at: { order: 'desc' } }]);
    });

    it('should return latest sort', () => {
      const sort = searchService._buildSort('latest');
      expect(sort).toEqual([{ created_at: { order: 'desc' } }]);
    });

    it('should return popular sort', () => {
      const sort = searchService._buildSort('popular');
      expect(sort).toEqual([{ views: { order: 'desc' } }, { likes: { order: 'desc' } }]);
    });

    it('should return likes sort', () => {
      const sort = searchService._buildSort('likes');
      expect(sort).toEqual([{ likes: { order: 'desc' } }]);
    });

    it('should return default for unknown sort type', () => {
      const sort = searchService._buildSort('unknown');
      expect(sort).toEqual(['_score', { created_at: { order: 'desc' } }]);
    });
  });

  describe('_buildHighlight', () => {
    it('should configure highlighting for title, description, username', () => {
      const highlight = searchService._buildHighlight();

      expect(highlight.fields).toHaveProperty('title');
      expect(highlight.fields).toHaveProperty('description');
      expect(highlight.fields).toHaveProperty('username');
      expect(highlight.fields.title.pre_tags).toEqual(['<mark class="search-highlight">']);
      expect(highlight.fields.title.fragment_size).toBe(150);
    });
  });
});
