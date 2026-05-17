const { getEsClient } = require('../config/elasticsearch');
const { getRedisClient } = require('../config/redis');
const { searchVideosFallback } = require('../config/db');
const config = require('../config');
const logger = require('../utils/logger');
const { getTokenizer } = require('../utils/tokenizer');

class SearchService {
  constructor() {
    this.esClient = getEsClient();
    this.redis = getRedisClient();
    this.tokenizer = getTokenizer();
    this.indexName = config.elasticsearch.indexName;
  }

  /**
   * Full-text search with filtering, sorting, and highlighting
   * Falls back to database search when ES is unavailable
   */
  async search(params) {
    try {
      return await this._searchES(params);
    } catch (error) {
      logger.warn(`ES search failed, falling back to DB search: ${error.message}`);
      return this._searchDB(params);
    }
  }

  /**
   * Elasticsearch search
   */
  async _searchES(params) {
    const {
      q: query,
      category,
      sort = 'relevance',
      page = 1,
      pageSize = config.search.defaultPageSize,
      durationMin,
      durationMax,
      uploadDateFrom,
      uploadDateTo,
      minViews,
      minLikes,
    } = params;

    const from = (Math.max(1, parseInt(page, 10)) - 1) * Math.min(
      parseInt(pageSize, 10),
      config.search.maxPageSize
    );
    const size = Math.min(parseInt(pageSize, 10), config.search.maxPageSize);

    const searchBody = {
      from,
      size,
      query: this._buildQuery({
        query,
        category,
        durationMin,
        durationMax,
        uploadDateFrom,
        uploadDateTo,
        minViews,
        minLikes,
      }),
      sort: this._buildSort(sort),
      highlight: this._buildHighlight(),
      _source: { excludes: [] },
    };

    logger.info(`ES Search query: "${query}" | sort: ${sort} | page: ${page}`);

    await this._recordSearchLog(query, category, sort);

    const response = await this.esClient.search({
      index: this.indexName,
      body: searchBody,
    });

    const hits = response.hits.hits;
    const total = response.hits.total.value;

    const results = hits.map((hit) => this._formatSearchResult(hit));

    if (query && total > 0) {
      await this._updateSearchFrequency(query);
    }

    return {
      results,
      total,
      page: parseInt(page, 10),
      pageSize: size,
      query: query || '',
      sort,
      took: response.took,
      source: 'elasticsearch',
    };
  }

  /**
   * Database fallback search
   */
  async _searchDB(params) {
    logger.info(`DB Fallback search: "${params.q}" | sort: ${params.sort || 'relevance'} | page: ${params.page || 1}`);
    try {
      return await searchVideosFallback(params);
    } catch (dbError) {
      logger.error(`DB fallback search also failed: ${dbError.message}`);
      throw dbError;
    }
  }

  /**
   * Get search suggestions - with DB fallback
   */
  async getSuggestions(partial) {
    if (!partial || partial.trim().length === 0) {
      return [];
    }

    const normalizedPartial = partial.toLowerCase().trim();
    const redisKey = `suggest:${normalizedPartial}`;

    // Try cached suggestions
    try {
      const cached = await this.redis.get(redisKey);
      if (cached) {
        return JSON.parse(cached);
      }
    } catch (error) {
      logger.error('Redis get suggestions error:', error.message);
    }

    // Generate suggestions from tokenizer
    const tokenizerSuggestions = this.tokenizer.generateSuggestions(normalizedPartial);

    let allSuggestions = [...tokenizerSuggestions];

    // Try ES suggestions, fall back to DB
    try {
      const esSuggestions = await this._getSuggestionsFromES(normalizedPartial);
      allSuggestions = [...allSuggestions, ...esSuggestions];
    } catch (esError) {
      logger.debug(`ES suggestions failed, skipping: ${esError.message}`);
      // ES is down, just use tokenizer suggestions - no DB fallback for suggestions to keep it simple
    }

    const uniqueSuggestions = [...new Set(allSuggestions)].slice(0, config.search.suggestLimit);

    // Cache for 5 minutes
    try {
      await this.redis.setex(redisKey, 300, JSON.stringify(uniqueSuggestions));
    } catch (error) {
      logger.error('Redis cache suggestions error:', error.message);
    }

    return uniqueSuggestions;
  }

  /**
   * Get trending searches from Redis
   */
  async getTrending() {
    const redisKey = 'trending:searches';

    try {
      const trending = await this.redis.zrevrange(redisKey, 0, config.search.trendingLimit - 1, 'WITHSCORES');

      if (trending.length === 0) {
        return this._getDefaultTrending();
      }

      const formatted = [];
      for (let i = 0; i < trending.length; i += 2) {
        formatted.push({
          rank: Math.floor(i / 2) + 1,
          term: trending[i],
          score: parseInt(trending[i + 1], 10),
        });
      }
      return formatted;
    } catch (error) {
      logger.error('Redis get trending error:', error.message);
      return this._getDefaultTrending();
    }
  }

  /**
   * Update trending searches
   */
  async updateTrendingSearches() {
    const redisKey = 'trending:searches';
    const searchLogKey = 'search:frequency';

    try {
      const frequencies = await this.redis.zrevrange(
        searchLogKey,
        0,
        config.search.trendingLimit * 2 - 1,
        'WITHSCORES'
      );

      if (frequencies.length === 0) {
        return;
      }

      const pipeline = this.redis.pipeline();
      pipeline.del(redisKey);

      for (let i = 0; i < frequencies.length; i += 2) {
        pipeline.zadd(redisKey, frequencies[i + 1], frequencies[i]);
      }

      pipeline.expire(redisKey, config.search.hotSearchExpireSeconds);

      await pipeline.exec();
      logger.info('Trending searches updated successfully');
    } catch (error) {
      logger.error('Update trending searches error:', error.message);
    }
  }

  /**
   * Build Elasticsearch query
   */
  _buildQuery({ query, category, durationMin, durationMax, uploadDateFrom, uploadDateTo, minViews, minLikes }) {
    const must = [];
    const filter = [];

    if (query && query.trim()) {
      const trimmedQuery = query.trim();

      must.push({
        multi_match: {
          query: trimmedQuery,
          fields: ['title^3', 'description^1', 'username^2', 'tags^2'],
          type: 'best_fields',
          fuzziness: 'AUTO',
          prefix_length: 2,
        },
      });
    } else {
      must.push({ match_all: {} });
    }

    if (category) {
      filter.push({ term: { category } });
    }

    if (durationMin !== undefined || durationMax !== undefined) {
      const range = {};
      if (durationMin !== undefined) range.gte = parseInt(durationMin, 10);
      if (durationMax !== undefined) range.lte = parseInt(durationMax, 10);
      filter.push({ range: { duration: range } });
    }

    if (uploadDateFrom || uploadDateTo) {
      const range = {};
      if (uploadDateFrom) range.gte = uploadDateFrom;
      if (uploadDateTo) range.lte = uploadDateTo;
      filter.push({ range: { created_at: range } });
    }

    if (minViews) {
      filter.push({ range: { views: { gte: parseInt(minViews, 10) } } });
    }

    if (minLikes) {
      filter.push({ range: { likes: { gte: parseInt(minLikes, 10) } } });
    }

    return {
      bool: {
        must,
        filter,
      },
    };
  }

  /**
   * Build sort configuration
   */
  _buildSort(sortType) {
    switch (sortType) {
      case 'latest':
        return [{ created_at: { order: 'desc' } }];
      case 'popular':
        return [{ views: { order: 'desc' } }, { likes: { order: 'desc' } }];
      case 'likes':
        return [{ likes: { order: 'desc' } }];
      default:
        return ['_score', { created_at: { order: 'desc' } }];
    }
  }

  /**
   * Build highlight configuration
   */
  _buildHighlight() {
    return {
      fields: {
        title: {
          fragment_size: 150,
          number_of_fragments: 1,
          pre_tags: ['<mark class="search-highlight">'],
          post_tags: ['</mark>'],
        },
        description: {
          fragment_size: 200,
          number_of_fragments: 2,
          pre_tags: ['<mark class="search-highlight">'],
          post_tags: ['</mark>'],
        },
        username: {
          fragment_size: 100,
          number_of_fragments: 1,
          pre_tags: ['<mark class="search-highlight">'],
          post_tags: ['</mark>'],
        },
      },
    };
  }

  /**
   * Format a single search result from ES hit
   */
  _formatSearchResult(hit) {
    const source = hit._source;
    const highlight = hit.highlight || {};

    return {
      id: hit._id,
      score: hit._score,
      title: highlight.title?.[0] || source.title,
      description: highlight.description?.[0] || source.description,
      username: highlight.username?.[0] || source.username,
      category: source.category,
      tags: source.tags || [],
      views: source.views || 0,
      likes: source.likes || 0,
      duration: source.duration || 0,
      coverUrl: source.cover_url || '',
      videoUrl: source.video_url || '',
      userId: source.user_id || '',
      createdAt: source.created_at,
      highlights: {
        title: highlight.title || [],
        description: highlight.description || [],
        username: highlight.username || [],
      },
    };
  }

  /**
   * Get suggestions from Elasticsearch
   */
  async _getSuggestionsFromES(partial) {
    const response = await this.esClient.search({
      index: this.indexName,
      body: {
        size: 0,
        suggest: {
          title_suggest: {
            prefix: partial,
            completion: {
              field: 'title_suggest',
              fuzzy: { fuzziness: 'AUTO' },
              size: 10,
            },
          },
        },
      },
    });

    const suggestions = [];
    const titleSuggestions = response.suggest?.title_suggest || [];

    for (const sugg of titleSuggestions) {
      for (const option of sugg.options) {
        suggestions.push(option.text);
      }
    }

    return suggestions;
  }

  /**
   * Record search log
   */
  async _recordSearchLog(query, category, sort) {
    try {
      const logEntry = {
        query: query || '',
        category: category || '',
        sort: sort || 'relevance',
        timestamp: new Date().toISOString(),
        source: 'search_api',
      };

      await this.redis.lpush('search:log:recent', JSON.stringify(logEntry));
      await this.redis.ltrim('search:log:recent', 0, 9999);
    } catch (error) {
      logger.debug('Search log indexing error:', error.message);
    }
  }

  /**
   * Update search frequency in Redis
   */
  async _updateSearchFrequency(query) {
    try {
      const normalizedQuery = query.trim().toLowerCase();
      await this.redis.zincrby('search:frequency', 1, normalizedQuery);
    } catch (error) {
      logger.debug('Update search frequency error:', error.message);
    }
  }

  /**
   * Get default trending searches
   */
  _getDefaultTrending() {
    return [
      { rank: 1, term: '动漫推荐', score: 9999 },
      { rank: 2, term: '游戏实况', score: 8888 },
      { rank: 3, term: '科技评测', score: 7777 },
      { rank: 4, term: '美食制作', score: 6666 },
      { rank: 5, term: '音乐MV', score: 5555 },
      { rank: 6, term: '学习教程', score: 4444 },
      { rank: 7, term: '搞笑合集', score: 3333 },
      { rank: 8, term: '运动健身', score: 2222 },
      { rank: 9, term: '旅行Vlog', score: 1111 },
      { rank: 10, term: '手工DIY', score: 1000 },
    ].slice(0, config.search.trendingLimit);
  }
}

// Export singleton
let instance = null;
const getSearchService = () => {
  if (!instance) {
    instance = new SearchService();
  }
  return instance;
};

module.exports = {
  SearchService,
  getSearchService,
};
