const { getEsClient } = require('../config/elasticsearch');
const config = require('../config');
const logger = require('../utils/logger');

class IndexingService {
  constructor() {
    this.esClient = getEsClient();
    this.indexName = config.elasticsearch.indexName;
  }

  /**
   * Index or update a video document
   * @param {Object} video - Video data to index
   * @returns {Promise<Object>} - Indexing result
   */
  async indexVideo(video) {
    const {
      id,
      title,
      description,
      userId,
      username,
      category,
      tags = [],
      views = 0,
      likes = 0,
      duration = 0,
      coverUrl,
      videoUrl,
      createdAt,
      updatedAt,
    } = video;

    if (!id) {
      throw new Error('Video ID is required for indexing');
    }

    if (!title) {
      throw new Error('Video title is required for indexing');
    }

    const document = {
      title: title || '',
      description: description || '',
      user_id: userId || '',
      username: username || '',
      category: category || 'other',
      tags: Array.isArray(tags) ? tags : [],
      views: parseInt(views, 10) || 0,
      likes: parseInt(likes, 10) || 0,
      duration: parseInt(duration, 10) || 0,
      cover_url: coverUrl || '',
      video_url: videoUrl || '',
      created_at: createdAt || new Date().toISOString(),
      updated_at: updatedAt || new Date().toISOString(),
      // Suggest field for auto-completion
      title_suggest: {
        input: this._generateSuggestInputs(title, tags, username),
        weight: Math.min(views + likes, 100),
      },
    };

    const result = await this.esClient.index({
      index: this.indexName,
      id: id.toString(),
      body: document,
      refresh: 'wait_for',
    });

    logger.info(`Video indexed: ${id} | result: ${result.result}`);

    return {
      id,
      result: result.result,
      index: result._index,
      version: result._version,
    };
  }

  /**
   * Bulk index multiple videos
   * @param {Array<Object>} videos - Array of video objects
   * @returns {Promise<Object>} - Bulk indexing result
   */
  async bulkIndexVideos(videos) {
    if (!Array.isArray(videos) || videos.length === 0) {
      throw new Error('Videos array is required for bulk indexing');
    }

    const operations = [];

    for (const video of videos) {
      const {
        id,
        title,
        description,
        userId,
        username,
        category,
        tags = [],
        views = 0,
        likes = 0,
        duration = 0,
        coverUrl,
        videoUrl,
        createdAt,
        updatedAt,
      } = video;

      if (!id || !title) {
        logger.warn(`Skipping invalid video for bulk index: missing id or title`);
        continue;
      }

      operations.push({
        index: {
          _index: this.indexName,
          _id: id.toString(),
        },
      });

      operations.push({
        title: title || '',
        description: description || '',
        user_id: userId || '',
        username: username || '',
        category: category || 'other',
        tags: Array.isArray(tags) ? tags : [],
        views: parseInt(views, 10) || 0,
        likes: parseInt(likes, 10) || 0,
        duration: parseInt(duration, 10) || 0,
        cover_url: coverUrl || '',
        video_url: videoUrl || '',
        created_at: createdAt || new Date().toISOString(),
        updated_at: updatedAt || new Date().toISOString(),
        title_suggest: {
          input: this._generateSuggestInputs(title, tags, username),
          weight: Math.min(parseInt(views, 10) + parseInt(likes, 10), 100),
        },
      });
    }

    if (operations.length === 0) {
      return { indexed: 0, errors: 0, items: [] };
    }

    const result = await this.esClient.bulk({
      operations,
      refresh: 'wait_for',
    });

    const errors = result.items.filter((item) => item.index?.error);
    const indexed = result.items.length - errors.length;

    if (errors.length > 0) {
      logger.error(`Bulk indexing errors: ${errors.length}`, errors.slice(0, 3));
    }

    logger.info(`Bulk indexed ${indexed} videos (${errors.length} errors)`);

    return {
      indexed,
      errors: errors.length,
      items: result.items,
    };
  }

  /**
   * Update video stats (views, likes) in index
   * @param {string} id - Video ID
   * @param {Object} stats - Stats to update
   * @returns {Promise<Object>} - Update result
   */
  async updateVideoStats(id, stats) {
    if (!id) {
      throw new Error('Video ID is required');
    }

    const doc = {};
    if (stats.views !== undefined) doc.views = parseInt(stats.views, 10);
    if (stats.likes !== undefined) doc.likes = parseInt(stats.likes, 10);
    if (stats.title) doc.title = stats.title;
    if (stats.description) doc.description = stats.description;

    if (Object.keys(doc).length === 0) {
      throw new Error('No fields to update');
    }

    doc.updated_at = new Date().toISOString();

    const result = await this.esClient.update({
      index: this.indexName,
      id: id.toString(),
      body: {
        doc,
        doc_as_upsert: false,
      },
      refresh: 'wait_for',
    });

    logger.info(`Video stats updated: ${id}`);

    return {
      id,
      result: result.result,
      version: result._version,
    };
  }

  /**
   * Delete a video from the index
   * @param {string} id - Video ID to delete
   * @returns {Promise<Object>} - Deletion result
   */
  async deleteVideo(id) {
    if (!id) {
      throw new Error('Video ID is required for deletion');
    }

    try {
      const result = await this.esClient.delete({
        index: this.indexName,
        id: id.toString(),
        refresh: 'wait_for',
      });

      logger.info(`Video deleted from index: ${id}`);

      return {
        id,
        result: result.result,
        version: result._version,
      };
    } catch (error) {
      if (error.meta?.statusCode === 404) {
        logger.warn(`Video not found in index for deletion: ${id}`);
        return { id, result: 'not_found' };
      }
      throw error;
    }
  }

  /**
   * Get video by ID from index
   * @param {string} id - Video ID
   * @returns {Promise<Object|null>} - Video document or null
   */
  async getVideoById(id) {
    if (!id) {
      return null;
    }

    try {
      const result = await this.esClient.get({
        index: this.indexName,
        id: id.toString(),
      });

      return {
        id: result._id,
        ...result._source,
      };
    } catch (error) {
      if (error.meta?.statusCode === 404) {
        return null;
      }
      throw error;
    }
  }

  /**
   * Check if index exists
   * @returns {Promise<boolean>}
   */
  async indexExists() {
    return await this.esClient.indices.exists({
      index: this.indexName,
    });
  }

  /**
   * Create index with mappings
   * @returns {Promise<Object>}
   */
  async createIndex() {
    const exists = await this.indexExists();
    if (exists) {
      logger.info(`Index ${this.indexName} already exists`);
      return { created: false, index: this.indexName };
    }

    const result = await this.esClient.indices.create({
      index: this.indexName,
      body: {
        settings: {
          number_of_shards: 3,
          number_of_replicas: 1,
          analysis: {
            analyzer: {
              ik_max_word: {
                type: 'custom',
                tokenizer: 'ik_max_word',
                filter: ['lowercase', 'word_delimiter'],
              },
              ik_smart: {
                type: 'custom',
                tokenizer: 'ik_smart',
                filter: ['lowercase'],
              },
            },
          },
        },
        mappings: {
          properties: {
            title: {
              type: 'text',
              analyzer: 'ik_max_word',
              search_analyzer: 'ik_max_word',
              fields: {
                keyword: {
                  type: 'keyword',
                  ignore_above: 256,
                },
              },
            },
            description: {
              type: 'text',
              analyzer: 'ik_max_word',
              search_analyzer: 'ik_max_word',
            },
            user_id: {
              type: 'keyword',
            },
            username: {
              type: 'keyword',
              fields: {
                text: {
                  type: 'text',
                  analyzer: 'ik_max_word',
                },
              },
            },
            category: {
              type: 'keyword',
            },
            tags: {
              type: 'keyword',
            },
            views: {
              type: 'integer',
            },
            likes: {
              type: 'integer',
            },
            duration: {
              type: 'integer',
            },
            cover_url: {
              type: 'keyword',
              index: false,
            },
            video_url: {
              type: 'keyword',
              index: false,
            },
            created_at: {
              type: 'date',
            },
            updated_at: {
              type: 'date',
            },
            title_suggest: {
              type: 'completion',
              analyzer: 'ik_max_word',
            },
          },
        },
      },
    });

    logger.info(`Index ${this.indexName} created successfully`);
    return { created: true, index: this.indexName, acknowledged: result.acknowledged };
  }

  /**
   * Delete the entire index (use with caution!)
   * @returns {Promise<Object>}
   */
  async deleteIndex() {
    const result = await this.esClient.indices.delete({
      index: this.indexName,
    });

    logger.warn(`Index ${this.indexName} deleted`);
    return { deleted: true, acknowledged: result.acknowledged };
  }

  /**
   * Generate suggestion inputs from title, tags, and username
   */
  _generateSuggestInputs(title, tags, username) {
    const inputs = [];

    if (title) {
      inputs.push(title);
      // Add first 10 characters as prefix suggestion
      if (title.length > 2) {
        inputs.push(title.substring(0, 10));
      }
    }

    if (Array.isArray(tags)) {
      tags.forEach((tag) => {
        if (tag && tag.trim()) {
          inputs.push(tag.trim());
        }
      });
    }

    if (username) {
      inputs.push(username);
    }

    return [...new Set(inputs)].filter(Boolean);
  }
}

// Export singleton
let instance = null;
const getIndexingService = () => {
  if (!instance) {
    instance = new IndexingService();
  }
  return instance;
};

module.exports = {
  IndexingService,
  getIndexingService,
};
