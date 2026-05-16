const { IndexingService } = require('../src/services/indexingService');
const logger = require('../src/utils/logger');

jest.mock('../src/utils/logger', () => ({
  info: jest.fn(),
  error: jest.fn(),
  warn: jest.fn(),
  debug: jest.fn(),
}));

describe('IndexingService', () => {
  let indexingService;
  let mockEsClient;

  beforeEach(() => {
    jest.clearAllMocks();

    mockEsClient = {
      index: jest.fn(),
      bulk: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
      get: jest.fn(),
      indices: {
        exists: jest.fn(),
        create: jest.fn(),
        delete: jest.fn(),
      },
    };

    jest.spyOn(require('../src/config/elasticsearch'), 'getEsClient').mockReturnValue(mockEsClient);

    indexingService = new IndexingService();
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  describe('indexVideo', () => {
    const validVideo = {
      id: 'vid-001',
      title: 'Test Video Title',
      description: 'Test Description',
      userId: 'user-001',
      username: 'TestUser',
      category: 'tech',
      tags: ['test', 'video'],
      views: 100,
      likes: 10,
      duration: 300,
      coverUrl: 'https://example.com/cover.jpg',
      videoUrl: 'https://example.com/video.mp4',
      createdAt: '2024-01-01T00:00:00Z',
      updatedAt: '2024-01-01T00:00:00Z',
    };

    it('should index a valid video', async () => {
      mockEsClient.index.mockResolvedValue({
        result: 'created',
        _index: 'sukaczev_videos',
        _version: 1,
      });

      const result = await indexingService.indexVideo(validVideo);

      expect(mockEsClient.index).toHaveBeenCalledTimes(1);
      expect(result.result).toBe('created');
      expect(result.id).toBe('vid-001');

      const callArgs = mockEsClient.index.mock.calls[0][0];
      expect(callArgs.index).toBe('sukaczev_videos');
      expect(callArgs.id).toBe('vid-001');
      expect(callArgs.body.title).toBe('Test Video Title');
      expect(callArgs.body.views).toBe(100);
      expect(callArgs.body.likes).toBe(10);
      expect(callArgs.body.duration).toBe(300);
    });

    it('should index video with minimal data', async () => {
      mockEsClient.index.mockResolvedValue({
        result: 'created',
        _index: 'sukaczev_videos',
        _version: 1,
      });

      const result = await indexingService.indexVideo({
        id: 'vid-002',
        title: 'Minimal Video',
      });

      expect(result.result).toBe('created');
      const callArgs = mockEsClient.index.mock.calls[0][0];
      expect(callArgs.body.description).toBe('');
      expect(callArgs.body.views).toBe(0);
      expect(callArgs.body.category).toBe('other');
    });

    it('should throw error when id is missing', async () => {
      await expect(
        indexingService.indexVideo({ title: 'No ID' })
      ).rejects.toThrow('Video ID is required for indexing');

      expect(mockEsClient.index).not.toHaveBeenCalled();
    });

    it('should throw error when title is missing', async () => {
      await expect(
        indexingService.indexVideo({ id: 'vid-003' })
      ).rejects.toThrow('Video title is required for indexing');

      expect(mockEsClient.index).not.toHaveBeenCalled();
    });

    it('should handle string numbers for views/likes/duration', async () => {
      mockEsClient.index.mockResolvedValue({
        result: 'created',
        _index: 'sukaczev_videos',
        _version: 1,
      });

      await indexingService.indexVideo({
        ...validVideo,
        views: '500',
        likes: '50',
        duration: '600',
      });

      const callArgs = mockEsClient.index.mock.calls[0][0];
      expect(callArgs.body.views).toBe(500);
      expect(callArgs.body.likes).toBe(50);
      expect(callArgs.body.duration).toBe(600);
    });

    it('should include title_suggest field', async () => {
      mockEsClient.index.mockResolvedValue({
        result: 'created',
        _index: 'sukaczev_videos',
        _version: 1,
      });

      await indexingService.indexVideo(validVideo);

      const callArgs = mockEsClient.index.mock.calls[0][0];
      expect(callArgs.body.title_suggest).toBeDefined();
      expect(callArgs.body.title_suggest.input).toContain('Test Video Title');
      expect(callArgs.body.title_suggest.input).toContain('test');
      expect(callArgs.body.title_suggest.input).toContain('video');
      expect(callArgs.body.title_suggest.input).toContain('TestUser');
    });

    it('should handle ES errors', async () => {
      mockEsClient.index.mockRejectedValue(new Error('ES connection failed'));

      await expect(indexingService.indexVideo(validVideo)).rejects.toThrow('ES connection failed');
    });
  });

  describe('bulkIndexVideos', () => {
    const videos = [
      {
        id: 'vid-001',
        title: 'Video 1',
        description: 'Desc 1',
        userId: 'user-001',
        username: 'User1',
        category: 'tech',
        tags: ['tag1'],
        views: 100,
        likes: 10,
        duration: 300,
        createdAt: '2024-01-01T00:00:00Z',
      },
      {
        id: 'vid-002',
        title: 'Video 2',
        description: 'Desc 2',
        userId: 'user-002',
        username: 'User2',
        category: 'anime',
        tags: ['tag2'],
        views: 200,
        likes: 20,
        duration: 600,
        createdAt: '2024-02-01T00:00:00Z',
      },
    ];

    it('should bulk index valid videos', async () => {
      mockEsClient.bulk.mockResolvedValue({
        items: [
          { index: { _index: 'sukaczev_videos', _id: 'vid-001', result: 'created' } },
          { index: { _index: 'sukaczev_videos', _id: 'vid-002', result: 'created' } },
        ],
      });

      const result = await indexingService.bulkIndexVideos(videos);

      expect(result.indexed).toBe(2);
      expect(result.errors).toBe(0);
      expect(mockEsClient.bulk).toHaveBeenCalledTimes(1);
    });

    it('should skip invalid videos', async () => {
      const mixedVideos = [
        { id: 'vid-001', title: 'Valid Video' },
        { id: null, title: 'Invalid - no id' },
        { id: 'vid-003', title: null },
        { title: 'Invalid - no id field' },
      ];

      mockEsClient.bulk.mockResolvedValue({
        items: [
          { index: { _index: 'sukaczev_videos', _id: 'vid-001', result: 'created' } },
        ],
      });

      const result = await indexingService.bulkIndexVideos(mixedVideos);

      expect(result.indexed).toBe(1);
      expect(mockEsClient.bulk).toHaveBeenCalledTimes(1);
    });

    it('should throw error for empty array', async () => {
      await expect(indexingService.bulkIndexVideos([])).rejects.toThrow(
        'Videos array is required for bulk indexing'
      );
    });

    it('should throw error for non-array input', async () => {
      await expect(indexingService.bulkIndexVideos(null)).rejects.toThrow(
        'Videos array is required for bulk indexing'
      );
    });

    it('should return empty result when all videos are invalid', async () => {
      const allInvalid = [
        { id: null, title: 'No ID' },
        { id: 'vid-001', title: null },
      ];

      const result = await indexingService.bulkIndexVideos(allInvalid);

      expect(result.indexed).toBe(0);
      expect(result.errors).toBe(0);
      expect(mockEsClient.bulk).not.toHaveBeenCalled();
    });

    it('should count bulk indexing errors', async () => {
      mockEsClient.bulk.mockResolvedValue({
        items: [
          { index: { _index: 'sukaczev_videos', _id: 'vid-001', result: 'created' } },
          { index: { _index: 'sukaczev_videos', _id: 'vid-002', error: { type: 'mapper_parsing_exception' } } },
        ],
      });

      const result = await indexingService.bulkIndexVideos(videos);

      expect(result.indexed).toBe(1);
      expect(result.errors).toBe(1);
    });

    it('should handle ES bulk errors', async () => {
      mockEsClient.bulk.mockRejectedValue(new Error('Bulk failed'));

      await expect(indexingService.bulkIndexVideos(videos)).rejects.toThrow('Bulk failed');
    });
  });

  describe('updateVideoStats', () => {
    it('should update video stats', async () => {
      mockEsClient.update.mockResolvedValue({
        result: 'updated',
        _version: 2,
      });

      const result = await indexingService.updateVideoStats('vid-001', {
        views: 1000,
        likes: 100,
      });

      expect(result.result).toBe('updated');
      expect(result.id).toBe('vid-001');

      const callArgs = mockEsClient.update.mock.calls[0][0];
      expect(callArgs.body.doc.views).toBe(1000);
      expect(callArgs.body.doc.likes).toBe(100);
      expect(callArgs.body.doc_as_upsert).toBe(false);
    });

    it('should throw error when id is missing', async () => {
      await expect(
        indexingService.updateVideoStats(null, { views: 100 })
      ).rejects.toThrow('Video ID is required');
    });

    it('should throw error when no fields provided', async () => {
      await expect(
        indexingService.updateVideoStats('vid-001', {})
      ).rejects.toThrow('No fields to update');
    });

    it('should update only provided fields', async () => {
      mockEsClient.update.mockResolvedValue({
        result: 'updated',
        _version: 2,
      });

      await indexingService.updateVideoStats('vid-001', { views: 5000 });

      const callArgs = mockEsClient.update.mock.calls[0][0];
      expect(callArgs.body.doc).toHaveProperty('views', 5000);
      expect(callArgs.body.doc).not.toHaveProperty('likes');
      expect(callArgs.body.doc).toHaveProperty('updated_at');
    });

    it('should update title and description', async () => {
      mockEsClient.update.mockResolvedValue({
        result: 'updated',
        _version: 3,
      });

      const result = await indexingService.updateVideoStats('vid-001', {
        title: 'Updated Title',
        description: 'Updated Description',
      });

      expect(result.result).toBe('updated');
      const callArgs = mockEsClient.update.mock.calls[0][0];
      expect(callArgs.body.doc.title).toBe('Updated Title');
      expect(callArgs.body.doc.description).toBe('Updated Description');
    });

    it('should handle string numbers', async () => {
      mockEsClient.update.mockResolvedValue({
        result: 'updated',
        _version: 2,
      });

      await indexingService.updateVideoStats('vid-001', { views: '9999', likes: '888' });

      const callArgs = mockEsClient.update.mock.calls[0][0];
      expect(callArgs.body.doc.views).toBe(9999);
      expect(callArgs.body.doc.likes).toBe(888);
    });
  });

  describe('deleteVideo', () => {
    it('should delete video from index', async () => {
      mockEsClient.delete.mockResolvedValue({
        result: 'deleted',
        _version: 1,
      });

      const result = await indexingService.deleteVideo('vid-001');

      expect(result.result).toBe('deleted');
      expect(result.id).toBe('vid-001');
    });

    it('should throw error when id is missing', async () => {
      await expect(indexingService.deleteVideo(null)).rejects.toThrow(
        'Video ID is required for deletion'
      );
    });

    it('should return not_found for non-existent video', async () => {
      const error = new Error('Not Found');
      error.meta = { statusCode: 404 };
      mockEsClient.delete.mockRejectedValue(error);

      const result = await indexingService.deleteVideo('vid-999');

      expect(result.result).toBe('not_found');
    });

    it('should throw for other ES errors', async () => {
      mockEsClient.delete.mockRejectedValue(new Error('Connection failed'));

      await expect(indexingService.deleteVideo('vid-001')).rejects.toThrow('Connection failed');
    });
  });

  describe('getVideoById', () => {
    it('should return video by id', async () => {
      mockEsClient.get.mockResolvedValue({
        _id: 'vid-001',
        _source: {
          title: 'Test Video',
          description: 'Description',
          views: 100,
        },
      });

      const result = await indexingService.getVideoById('vid-001');

      expect(result.id).toBe('vid-001');
      expect(result.title).toBe('Test Video');
    });

    it('should return null for non-existent video', async () => {
      const error = new Error('Not Found');
      error.meta = { statusCode: 404 };
      mockEsClient.get.mockRejectedValue(error);

      const result = await indexingService.getVideoById('vid-999');

      expect(result).toBeNull();
    });

    it('should return null for empty id', async () => {
      const result = await indexingService.getVideoById('');
      expect(result).toBeNull();
    });

    it('should return null for null id', async () => {
      const result = await indexingService.getVideoById(null);
      expect(result).toBeNull();
    });

    it('should throw for non-404 errors', async () => {
      mockEsClient.get.mockRejectedValue(new Error('Connection failed'));

      await expect(indexingService.getVideoById('vid-001')).rejects.toThrow('Connection failed');
    });
  });

  describe('indexExists', () => {
    it('should return true when index exists', async () => {
      mockEsClient.indices.exists.mockResolvedValue(true);

      const result = await indexingService.indexExists();

      expect(result).toBe(true);
    });

    it('should return false when index does not exist', async () => {
      mockEsClient.indices.exists.mockResolvedValue(false);

      const result = await indexingService.indexExists();

      expect(result).toBe(false);
    });
  });

  describe('createIndex', () => {
    it('should create index when it does not exist', async () => {
      mockEsClient.indices.exists.mockResolvedValue(false);
      mockEsClient.indices.create.mockResolvedValue({ acknowledged: true });

      const result = await indexingService.createIndex();

      expect(result.created).toBe(true);
      expect(mockEsClient.indices.create).toHaveBeenCalled();

      const createArgs = mockEsClient.indices.create.mock.calls[0][0];
      expect(createArgs.index).toBe('sukaczev_videos');
      expect(createArgs.body.settings.number_of_shards).toBe(3);
      expect(createArgs.body.mappings.properties.title.type).toBe('text');
    });

    it('should not create index when it already exists', async () => {
      mockEsClient.indices.exists.mockResolvedValue(true);

      const result = await indexingService.createIndex();

      expect(result.created).toBe(false);
      expect(mockEsClient.indices.create).not.toHaveBeenCalled();
    });

    it('should handle create error', async () => {
      mockEsClient.indices.exists.mockResolvedValue(false);
      mockEsClient.indices.create.mockRejectedValue(new Error('Create failed'));

      await expect(indexingService.createIndex()).rejects.toThrow('Create failed');
    });
  });

  describe('deleteIndex', () => {
    it('should delete index', async () => {
      mockEsClient.indices.delete.mockResolvedValue({ acknowledged: true });

      const result = await indexingService.deleteIndex();

      expect(result.deleted).toBe(true);
      expect(mockEsClient.indices.delete).toHaveBeenCalled();
    });

    it('should handle delete error', async () => {
      mockEsClient.indices.delete.mockRejectedValue(new Error('Delete failed'));

      await expect(indexingService.deleteIndex()).rejects.toThrow('Delete failed');
    });
  });

  describe('_generateSuggestInputs', () => {
    it('should generate inputs from title', () => {
      const inputs = indexingService._generateSuggestInputs('Test Title', [], '');

      expect(inputs).toContain('Test Title');
      expect(inputs).toContain('Test Title'.substring(0, 10));
    });

    it('should include tags in inputs', () => {
      const inputs = indexingService._generateSuggestInputs('Title', ['tag1', 'tag2'], '');

      expect(inputs).toContain('tag1');
      expect(inputs).toContain('tag2');
    });

    it('should include username in inputs', () => {
      const inputs = indexingService._generateSuggestInputs('Title', [], 'TestUser');

      expect(inputs).toContain('TestUser');
    });

    it('should deduplicate inputs', () => {
      const inputs = indexingService._generateSuggestInputs('Title', ['Title'], 'Title');

      const uniqueInputs = [...new Set(inputs)];
      expect(inputs).toEqual(uniqueInputs);
    });

    it('should filter empty values', () => {
      const inputs = indexingService._generateSuggestInputs('', ['', null], '');

      expect(inputs.length).toBe(0);
    });

    it('should handle empty tags array', () => {
      const inputs = indexingService._generateSuggestInputs('Title', [], 'User');

      expect(inputs).toContain('Title');
      expect(inputs).toContain('User');
    });
  });
});
