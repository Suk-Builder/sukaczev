const { validationResult, query: queryValidator } = require('express-validator');
const { getSearchService } = require('../services/searchService');
const { getIndexingService } = require('../services/indexingService');
const ApiResponse = require('../utils/response');
const logger = require('../utils/logger');

const searchService = getSearchService();
const indexingService = getIndexingService();

const searchValidation = [
  queryValidator('q')
    .optional()
    .trim()
    .isLength({ max: 200 })
    .withMessage('Search query must be at most 200 characters'),
  queryValidator('category')
    .optional()
    .trim()
    .isIn(['anime', 'game', 'tech', 'food', 'music', 'education', 'funny', 'sports', 'travel', 'diy', 'other'])
    .withMessage('Invalid category'),
  queryValidator('sort')
    .optional()
    .trim()
    .isIn(['relevance', 'latest', 'popular', 'likes'])
    .withMessage('Invalid sort type'),
  queryValidator('page')
    .optional()
    .isInt({ min: 1, max: 1000 })
    .withMessage('Page must be between 1 and 1000'),
  queryValidator('pageSize')
    .optional()
    .isInt({ min: 1, max: 100 })
    .withMessage('Page size must be between 1 and 100'),
  queryValidator('durationMin')
    .optional()
    .isInt({ min: 0 })
    .withMessage('Duration min must be a positive integer'),
  queryValidator('durationMax')
    .optional()
    .isInt({ min: 0 })
    .withMessage('Duration max must be a positive integer'),
  queryValidator('uploadDateFrom')
    .optional()
    .isISO8601()
    .withMessage('Invalid date format'),
  queryValidator('uploadDateTo')
    .optional()
    .isISO8601()
    .withMessage('Invalid date format'),
  queryValidator('minViews')
    .optional()
    .isInt({ min: 0 })
    .withMessage('minViews must be a positive integer'),
  queryValidator('minLikes')
    .optional()
    .isInt({ min: 0 })
    .withMessage('minLikes must be a positive integer'),
];

const suggestValidation = [
  queryValidator('q')
    .trim()
    .isLength({ min: 1, max: 100 })
    .withMessage('Query must be 1-100 characters'),
];

/**
 * Search videos
 */
const search = async (req, res, next) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return ApiResponse.error(res, 'Validation failed', 400, errors.array());
    }

    const result = await searchService.search(req.query);

    return ApiResponse.paginated(res, result.results, {
      page: result.page,
      pageSize: result.pageSize,
      total: result.total,
    }, `Found ${result.total} results for "${result.query}"`);
  } catch (error) {
    logger.error('Search error:', error.message);
    next(error);
  }
};

/**
 * Get search suggestions
 */
const suggest = async (req, res, next) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return ApiResponse.error(res, 'Validation failed', 400, errors.array());
    }

    const { q } = req.query;
    const suggestions = await searchService.getSuggestions(q);

    return ApiResponse.success(res, {
      query: q,
      suggestions,
    }, 'Suggestions retrieved');
  } catch (error) {
    logger.error('Suggest error:', error.message);
    next(error);
  }
};

/**
 * Get trending searches
 */
const trending = async (req, res, next) => {
  try {
    const trendingSearches = await searchService.getTrending();

    return ApiResponse.success(res, {
      trending: trendingSearches,
      updatedAt: new Date().toISOString(),
    }, 'Trending searches retrieved');
  } catch (error) {
    logger.error('Trending error:', error.message);
    next(error);
  }
};

/**
 * Index a video (manual or from queue)
 */
const indexVideo = async (req, res, next) => {
  try {
    const video = req.body;

    if (!video || !video.id || !video.title) {
      return ApiResponse.error(res, 'Video ID and title are required', 400);
    }

    const result = await indexingService.indexVideo(video);

    return ApiResponse.success(res, result, 'Video indexed successfully', 201);
  } catch (error) {
    logger.error('Index video error:', error.message);
    next(error);
  }
};

/**
 * Bulk index videos
 */
const bulkIndex = async (req, res, next) => {
  try {
    const { videos } = req.body;

    if (!Array.isArray(videos) || videos.length === 0) {
      return ApiResponse.error(res, 'Videos array is required', 400);
    }

    if (videos.length > 100) {
      return ApiResponse.error(res, 'Maximum 100 videos per bulk request', 400);
    }

    const result = await indexingService.bulkIndexVideos(videos);

    return ApiResponse.success(res, result, 'Bulk indexing completed', 201);
  } catch (error) {
    logger.error('Bulk index error:', error.message);
    next(error);
  }
};

/**
 * Delete video from index
 */
const deleteVideo = async (req, res, next) => {
  try {
    const { id } = req.params;

    if (!id) {
      return ApiResponse.error(res, 'Video ID is required', 400);
    }

    const result = await indexingService.deleteVideo(id);

    return ApiResponse.success(res, result, 'Video deleted from index');
  } catch (error) {
    logger.error('Delete video from index error:', error.message);
    next(error);
  }
};

/**
 * Get video from index by ID
 */
const getVideo = async (req, res, next) => {
  try {
    const { id } = req.params;

    if (!id) {
      return ApiResponse.error(res, 'Video ID is required', 400);
    }

    const video = await indexingService.getVideoById(id);

    if (!video) {
      return ApiResponse.error(res, 'Video not found in index', 404);
    }

    return ApiResponse.success(res, video, 'Video retrieved');
  } catch (error) {
    logger.error('Get video from index error:', error.message);
    next(error);
  }
};

/**
 * Update video stats
 */
const updateStats = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { views, likes, title, description } = req.body;

    if (!id) {
      return ApiResponse.error(res, 'Video ID is required', 400);
    }

    const result = await indexingService.updateVideoStats(id, { views, likes, title, description });

    return ApiResponse.success(res, result, 'Video stats updated');
  } catch (error) {
    logger.error('Update stats error:', error.message);
    next(error);
  }
};

/**
 * Create index with mappings
 */
const createIndex = async (req, res, next) => {
  try {
    const result = await indexingService.createIndex();
    return ApiResponse.success(res, result, result.created ? 'Index created' : 'Index already exists');
  } catch (error) {
    logger.error('Create index error:', error.message);
    next(error);
  }
};

module.exports = {
  search,
  suggest,
  trending,
  indexVideo,
  bulkIndex,
  deleteVideo,
  getVideo,
  updateStats,
  createIndex,
  searchValidation,
  suggestValidation,
};
