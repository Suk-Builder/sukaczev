const request = require('supertest');
const app = require('../src/app');
const { getSearchService } = require('../src/services/searchService');
const { getIndexingService } = require('../src/services/indexingService');

jest.mock('../src/services/searchService');
jest.mock('../src/services/indexingService');

describe('Search Controller', () => {
  let mockSearchService;
  let mockIndexingService;

  beforeEach(() => {
    jest.clearAllMocks();

    mockSearchService = {
      search: jest.fn(),
      getSuggestions: jest.fn(),
      getTrending: jest.fn(),
    };

    mockIndexingService = {
      indexVideo: jest.fn(),
      bulkIndexVideos: jest.fn(),
      deleteVideo: jest.fn(),
      getVideoById: jest.fn(),
      updateVideoStats: jest.fn(),
      createIndex: jest.fn(),
    };

    getSearchService.mockReturnValue(mockSearchService);
    getIndexingService.mockReturnValue(mockIndexingService);
  });

  describe('GET /api/search', () => {
    it('should search with query parameter', async () => {
      const mockResult = {
        results: [
          {
            id: 'vid-001',
            title: 'Test Video',
            description: 'Description',
            username: 'TestUser',
            category: 'tech',
            tags: ['test'],
            views: 100,
            likes: 10,
            duration: 300,
            coverUrl: '',
            videoUrl: '',
            userId: 'u1',
            createdAt: '2024-01-01T00:00:00Z',
            score: 1.5,
            highlights: {},
          },
        ],
        total: 1,
        page: 1,
        pageSize: 20,
        query: 'test',
        sort: 'relevance',
        took: 10,
      };

      mockSearchService.search.mockResolvedValue(mockResult);

      const response = await request(app)
        .get('/api/search?q=test')
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data).toHaveLength(1);
      expect(response.body.data[0].title).toBe('Test Video');
      expect(response.body.pagination.total).toBe(1);
      expect(mockSearchService.search).toHaveBeenCalledWith(
        expect.objectContaining({ q: 'test' })
      );
    });

    it('should search with all query parameters', async () => {
      mockSearchService.search.mockResolvedValue({
        results: [],
        total: 0,
        page: 2,
        pageSize: 10,
        query: 'python',
        sort: 'latest',
        took: 5,
      });

      const response = await request(app)
        .get('/api/search?q=python&category=tech&sort=latest&page=2&pageSize=10&durationMin=60&durationMax=3600&minViews=100&minLikes=10')
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(mockSearchService.search).toHaveBeenCalledWith(
        expect.objectContaining({
          q: 'python',
          category: 'tech',
          sort: 'latest',
          page: '2',
          pageSize: '10',
          durationMin: '60',
          durationMax: '3600',
          minViews: '100',
          minLikes: '10',
        })
      );
    });

    it('should return validation error for invalid category', async () => {
      const response = await request(app)
        .get('/api/search?category=invalid-category')
        .expect(400);

      expect(response.body.success).toBe(false);
      expect(response.body.errors).toBeDefined();
    });

    it('should return validation error for invalid sort', async () => {
      const response = await request(app)
        .get('/api/search?sort=invalid-sort')
        .expect(400);

      expect(response.body.success).toBe(false);
      expect(response.body.errors).toBeDefined();
    });

    it('should return validation error for invalid page', async () => {
      const response = await request(app)
        .get('/api/search?page=0')
        .expect(400);

      expect(response.body.success).toBe(false);
      expect(response.body.errors).toBeDefined();
    });

    it('should return validation error for page too large', async () => {
      const response = await request(app)
        .get('/api/search?page=1001')
        .expect(400);

      expect(response.body.success).toBe(false);
      expect(response.body.errors).toBeDefined();
    });

    it('should return validation error for invalid pageSize', async () => {
      const response = await request(app)
        .get('/api/search?pageSize=0')
        .expect(400);

      expect(response.body.success).toBe(false);
      expect(response.body.errors).toBeDefined();
    });

    it('should return validation error for pageSize too large', async () => {
      const response = await request(app)
        .get('/api/search?pageSize=101')
        .expect(400);

      expect(response.body.success).toBe(false);
      expect(response.body.errors).toBeDefined();
    });

    it('should return validation error for invalid durationMin', async () => {
      const response = await request(app)
        .get('/api/search?durationMin=-1')
        .expect(400);

      expect(response.body.success).toBe(false);
    });

    it('should return validation error for invalid date format', async () => {
      const response = await request(app)
        .get('/api/search?uploadDateFrom=invalid-date')
        .expect(400);

      expect(response.body.success).toBe(false);
    });

    it('should handle search service errors', async () => {
      mockSearchService.search.mockRejectedValue(new Error('Search failed'));

      const response = await request(app)
        .get('/api/search?q=test')
        .expect(500);

      expect(response.body.success).toBe(false);
    });

    it('should search with query too long', async () => {
      const longQuery = 'a'.repeat(201);
      const response = await request(app)
        .get(`/api/search?q=${longQuery}`)
        .expect(400);

      expect(response.body.success).toBe(false);
    });
  });

  describe('GET /api/search/suggest', () => {
    it('should return suggestions', async () => {
      const suggestions = ['test video', 'test music', 'test'];
      mockSearchService.getSuggestions.mockResolvedValue(suggestions);

      const response = await request(app)
        .get('/api/search/suggest?q=test')
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.suggestions).toEqual(suggestions);
      expect(response.body.data.query).toBe('test');
    });

    it('should return empty suggestions for empty query', async () => {
      mockSearchService.getSuggestions.mockResolvedValue([]);

      const response = await request(app)
        .get('/api/search/suggest?q=')
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.suggestions).toEqual([]);
    });

    it('should return validation error for too long query', async () => {
      const response = await request(app)
        .get(`/api/search/suggest?q=${'a'.repeat(101)}`)
        .expect(400);

      expect(response.body.success).toBe(false);
    });

    it('should handle service errors', async () => {
      mockSearchService.getSuggestions.mockRejectedValue(new Error('Suggest failed'));

      const response = await request(app)
        .get('/api/search/suggest?q=test')
        .expect(500);

      expect(response.body.success).toBe(false);
    });
  });

  describe('GET /api/search/trending', () => {
    it('should return trending searches', async () => {
      const trending = [
        { rank: 1, term: 'python', score: 100 },
        { rank: 2, term: 'anime', score: 80 },
      ];
      mockSearchService.getTrending.mockResolvedValue(trending);

      const response = await request(app)
        .get('/api/search/trending')
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.trending).toEqual(trending);
      expect(response.body.data.updatedAt).toBeDefined();
    });

    it('should handle service errors', async () => {
      mockSearchService.getTrending.mockRejectedValue(new Error('Trending failed'));

      const response = await request(app)
        .get('/api/search/trending')
        .expect(500);

      expect(response.body.success).toBe(false);
    });
  });

  describe('POST /api/search/index', () => {
    const authToken = 'Bearer valid-token';

    it('should index a video', async () => {
      mockIndexingService.indexVideo.mockResolvedValue({
        id: 'vid-001',
        result: 'created',
        index: 'sukaczev_videos',
        version: 1,
      });

      const response = await request(app)
        .post('/api/search/index')
        .set('Authorization', authToken)
        .send({
          id: 'vid-001',
          title: 'Test Video',
          description: 'Description',
        })
        .expect(201);

      expect(response.body.success).toBe(true);
      expect(response.body.data.id).toBe('vid-001');
    });

    it('should return 400 when id is missing', async () => {
      const response = await request(app)
        .post('/api/search/index')
        .set('Authorization', authToken)
        .send({ title: 'No ID' })
        .expect(400);

      expect(response.body.success).toBe(false);
    });

    it('should return 400 when title is missing', async () => {
      const response = await request(app)
        .post('/api/search/index')
        .set('Authorization', authToken)
        .send({ id: 'vid-001' })
        .expect(400);

      expect(response.body.success).toBe(false);
    });

    it('should handle indexing errors', async () => {
      mockIndexingService.indexVideo.mockRejectedValue(new Error('Index failed'));

      const response = await request(app)
        .post('/api/search/index')
        .set('Authorization', authToken)
        .send({
          id: 'vid-001',
          title: 'Test Video',
        })
        .expect(500);

      expect(response.body.success).toBe(false);
    });
  });

  describe('POST /api/search/bulk-index', () => {
    const authToken = 'Bearer valid-token';

    it('should bulk index videos', async () => {
      mockIndexingService.bulkIndexVideos.mockResolvedValue({
        indexed: 2,
        errors: 0,
        items: [],
      });

      const response = await request(app)
        .post('/api/search/bulk-index')
        .set('Authorization', authToken)
        .send({
          videos: [
            { id: 'vid-001', title: 'Video 1' },
            { id: 'vid-002', title: 'Video 2' },
          ],
        })
        .expect(201);

      expect(response.body.success).toBe(true);
      expect(response.body.data.indexed).toBe(2);
    });

    it('should return 400 for empty videos array', async () => {
      const response = await request(app)
        .post('/api/search/bulk-index')
        .set('Authorization', authToken)
        .send({ videos: [] })
        .expect(400);

      expect(response.body.success).toBe(false);
    });

    it('should return 400 for non-array videos', async () => {
      const response = await request(app)
        .post('/api/search/bulk-index')
        .set('Authorization', authToken)
        .send({ videos: 'not an array' })
        .expect(400);

      expect(response.body.success).toBe(false);
    });

    it('should return 400 for too many videos', async () => {
      const manyVideos = Array.from({ length: 101 }, (_, i) => ({
        id: `vid-${i}`,
        title: `Video ${i}`,
      }));

      const response = await request(app)
        .post('/api/search/bulk-index')
        .set('Authorization', authToken)
        .send({ videos: manyVideos })
        .expect(400);

      expect(response.body.success).toBe(false);
    });

    it('should handle bulk index errors', async () => {
      mockIndexingService.bulkIndexVideos.mockRejectedValue(new Error('Bulk failed'));

      const response = await request(app)
        .post('/api/search/bulk-index')
        .set('Authorization', authToken)
        .send({
          videos: [{ id: 'vid-001', title: 'Video 1' }],
        })
        .expect(500);

      expect(response.body.success).toBe(false);
    });
  });

  describe('DELETE /api/search/index/:id', () => {
    const authToken = 'Bearer valid-token';

    it('should delete video from index', async () => {
      mockIndexingService.deleteVideo.mockResolvedValue({
        id: 'vid-001',
        result: 'deleted',
      });

      const response = await request(app)
        .delete('/api/search/index/vid-001')
        .set('Authorization', authToken)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.id).toBe('vid-001');
    });

    it('should return 400 for missing id', async () => {
      mockIndexingService.deleteVideo.mockRejectedValue(new Error('Video ID is required'));

      const response = await request(app)
        .delete('/api/search/index/')
        .expect(404);
    });

    it('should handle delete errors', async () => {
      mockIndexingService.deleteVideo.mockRejectedValue(new Error('Delete failed'));

      const response = await request(app)
        .delete('/api/search/index/vid-001')
        .set('Authorization', authToken)
        .expect(500);

      expect(response.body.success).toBe(false);
    });
  });

  describe('GET /api/search/index/:id', () => {
    const authToken = 'Bearer valid-token';

    it('should get video from index', async () => {
      mockIndexingService.getVideoById.mockResolvedValue({
        id: 'vid-001',
        title: 'Test Video',
        description: 'Description',
      });

      const response = await request(app)
        .get('/api/search/index/vid-001')
        .set('Authorization', authToken)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.id).toBe('vid-001');
    });

    it('should return 404 for non-existent video', async () => {
      mockIndexingService.getVideoById.mockResolvedValue(null);

      const response = await request(app)
        .get('/api/search/index/vid-999')
        .set('Authorization', authToken)
        .expect(404);

      expect(response.body.success).toBe(false);
    });

    it('should handle get errors', async () => {
      mockIndexingService.getVideoById.mockRejectedValue(new Error('Get failed'));

      const response = await request(app)
        .get('/api/search/index/vid-001')
        .set('Authorization', authToken)
        .expect(500);

      expect(response.body.success).toBe(false);
    });
  });

  describe('PUT /api/search/index/:id/stats', () => {
    const authToken = 'Bearer valid-token';

    it('should update video stats', async () => {
      mockIndexingService.updateVideoStats.mockResolvedValue({
        id: 'vid-001',
        result: 'updated',
      });

      const response = await request(app)
        .put('/api/search/index/vid-001/stats')
        .set('Authorization', authToken)
        .send({ views: 2000, likes: 200 })
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(mockIndexingService.updateVideoStats).toHaveBeenCalledWith('vid-001', {
        views: 2000,
        likes: 200,
      });
    });

    it('should update only provided fields', async () => {
      mockIndexingService.updateVideoStats.mockResolvedValue({
        id: 'vid-001',
        result: 'updated',
      });

      const response = await request(app)
        .put('/api/search/index/vid-001/stats')
        .set('Authorization', authToken)
        .send({ views: 5000 })
        .expect(200);

      expect(mockIndexingService.updateVideoStats).toHaveBeenCalledWith('vid-001', {
        views: 5000,
        likes: undefined,
        title: undefined,
        description: undefined,
      });
    });

    it('should handle update errors', async () => {
      mockIndexingService.updateVideoStats.mockRejectedValue(new Error('Update failed'));

      const response = await request(app)
        .put('/api/search/index/vid-001/stats')
        .set('Authorization', authToken)
        .send({ views: 100 })
        .expect(500);

      expect(response.body.success).toBe(false);
    });
  });

  describe('POST /api/search/setup-index', () => {
    const authToken = 'Bearer valid-token';

    it('should create index', async () => {
      mockIndexingService.createIndex.mockResolvedValue({
        created: true,
        index: 'sukaczev_videos',
      });

      const response = await request(app)
        .post('/api/search/setup-index')
        .set('Authorization', authToken)
        .expect(200);

      expect(response.body.success).toBe(true);
    });

    it('should handle create errors', async () => {
      mockIndexingService.createIndex.mockRejectedValue(new Error('Create failed'));

      const response = await request(app)
        .post('/api/search/setup-index')
        .set('Authorization', authToken)
        .expect(500);

      expect(response.body.success).toBe(false);
    });
  });

  describe('GET /health', () => {
    it('should return health status', async () => {
      const response = await request(app)
        .get('/health')
        .expect(200);

      expect(response.body.status).toBe('ok');
      expect(response.body.service).toBeDefined();
      expect(response.body.timestamp).toBeDefined();
    });
  });

  describe('GET /', () => {
    it('should return API info', async () => {
      const response = await request(app)
        .get('/')
        .expect(200);

      expect(response.body.service).toBeDefined();
      expect(response.body.version).toBeDefined();
      expect(response.body.endpoints).toBeDefined();
    });
  });

  describe('404 handler', () => {
    it('should return 404 for undefined routes', async () => {
      const response = await request(app)
        .get('/api/undefined-route')
        .expect(404);

      expect(response.body.success).toBe(false);
      expect(response.body.message).toContain('not found');
    });
  });
});
