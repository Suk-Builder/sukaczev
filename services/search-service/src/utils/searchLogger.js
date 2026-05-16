const { getEsClient } = require('../config/elasticsearch');
const { getRedisClient } = require('../config/redis');
const config = require('../config');
const logger = require('./logger');

/**
 * Search logger utility for analytics and query optimization
 */
class SearchLogger {
  constructor() {
    this.esClient = getEsClient();
    this.redis = getRedisClient();
    this.logIndex = config.search.searchLogIndex;
    this.buffer = [];
    this.flushInterval = 5000; // 5 seconds
    this.maxBufferSize = 100;
    this._startFlushTimer();
  }

  /**
   * Log a search query
   * @param {Object} params - Search parameters
   * @param {Object} result - Search result metadata
   * @param {Object} context - Request context (user agent, IP, etc.)
   */
  async logSearch(params, result, context = {}) {
    const logEntry = {
      query: params.q || '',
      category: params.category || null,
      sort: params.sort || 'relevance',
      page: parseInt(params.page, 10) || 1,
      page_size: parseInt(params.pageSize, 10) || config.search.defaultPageSize,
      result_count: result.total || 0,
      response_time_ms: result.took || 0,
      user_id: context.userId || null,
      ip: this._anonymizeIp(context.ip) || null,
      user_agent: context.userAgent || null,
      duration_filter: {
        min: params.durationMin ? parseInt(params.durationMin, 10) : null,
        max: params.durationMax ? parseInt(params.durationMax, 10) : null,
      },
      date_filter: {
        from: params.uploadDateFrom || null,
        to: params.uploadDateTo || null,
      },
      timestamp: new Date().toISOString(),
      '@timestamp': new Date().toISOString(),
    };

    // Add to buffer for batch processing
    this.buffer.push(logEntry);

    // Update Redis search frequency
    if (logEntry.query) {
      try {
        await this.redis.zincrby('search:frequency', 1, logEntry.query.toLowerCase().trim());
      } catch (error) {
        logger.debug('Redis frequency update error:', error.message);
      }
    }

    // Flush if buffer is full
    if (this.buffer.length >= this.maxBufferSize) {
      await this._flushBuffer();
    }
  }

  /**
   * Get popular searches from logs
   * @param {number} days - Number of days to look back
   * @param {number} limit - Maximum results
   * @returns {Promise<Array>} - Popular searches
   */
  async getPopularSearches(days = 7, limit = 20) {
    const fromDate = new Date();
    fromDate.setDate(fromDate.getDate() - days);

    try {
      const response = await this.esClient.search({
        index: this.logIndex,
        body: {
          size: 0,
          query: {
            range: {
              '@timestamp': {
                gte: fromDate.toISOString(),
              },
            },
          },
          aggs: {
            popular_queries: {
              terms: {
                field: 'query.keyword',
                size: limit,
                order: { _count: 'desc' },
                min_doc_count: 5,
              },
            },
            zero_result_queries: {
              filter: {
                term: { result_count: 0 },
              },
              aggs: {
                queries: {
                  terms: {
                    field: 'query.keyword',
                    size: limit,
                  },
                },
              },
            },
          },
        },
      });

      const popular = response.aggregations?.popular_queries?.buckets || [];
      const zeroResults = response.aggregations?.zero_result_queries?.queries?.buckets || [];

      return {
        popular: popular.map((bucket) => ({
          query: bucket.key,
          count: bucket.doc_count,
        })),
        zeroResults: zeroResults.map((bucket) => ({
          query: bucket.key,
          count: bucket.doc_count,
        })),
      };
    } catch (error) {
      logger.error('Get popular searches error:', error.message);
      return { popular: [], zeroResults: [] };
    }
  }

  /**
   * Flush the log buffer to Elasticsearch
   */
  async _flushBuffer() {
    if (this.buffer.length === 0) return;

    const operations = [];
    const logsToFlush = [...this.buffer];
    this.buffer = [];

    for (const log of logsToFlush) {
      operations.push({ index: { _index: this.logIndex } });
      operations.push(log);
    }

    try {
      await this.esClient.bulk({ operations });
      logger.debug(`Flushed ${logsToFlush.length} search logs`);
    } catch (error) {
      logger.error('Flush search logs error:', error.message);
      // Put logs back in buffer for retry
      this.buffer.unshift(...logsToFlush.slice(-this.maxBufferSize));
    }
  }

  /**
   * Start the flush timer
   */
  _startFlushTimer() {
    setInterval(() => {
      this._flushBuffer().catch((err) => {
        logger.error('Periodic flush error:', err.message);
      });
    }, this.flushInterval);
  }

  /**
   * Anonymize IP address for privacy
   */
  _anonymizeIp(ip) {
    if (!ip || ip === '127.0.0.1') return null;
    // Remove last octet for IPv4
    return ip.replace(/\.\d+$/, '.0');
  }

  /**
   * Graceful shutdown - flush remaining logs
   */
  async shutdown() {
    await this._flushBuffer();
    logger.info('Search logger shut down');
  }
}

// Export singleton
let instance = null;
const getSearchLogger = () => {
  if (!instance) {
    instance = new SearchLogger();
  }
  return instance;
};

module.exports = {
  SearchLogger,
  getSearchLogger,
};
