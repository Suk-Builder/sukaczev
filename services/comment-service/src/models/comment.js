const { query } = require('../config/database');
const { v4: uuidv4 } = require('uuid');

class Comment {
  /**
   * Create a new comment
   * @param {Object} data - Comment data
   * @returns {Promise<Object>} Created comment
   */
  static async create(data) {
    const {
      videoId,
      userId,
      content,
      parentId = null
    } = data;

    const id = uuidv4();

    const sql = `
      INSERT INTO comments (id, video_id, user_id, parent_id, content)
      VALUES ($1, $2, $3, $4, $5)
      RETURNING *
    `;

    const result = await query(sql, [id, videoId, userId, parentId, content]);

    // If this is a reply, increment parent's replies_count
    if (parentId) {
      await this.incrementRepliesCount(parentId);
    }

    return this.serialize(result.rows[0]);
  }

  /**
   * Find comment by ID
   * @param {string} id - Comment UUID
   * @returns {Promise<Object|null>} Comment or null
   */
  static async findById(id) {
    const sql = 'SELECT * FROM comments WHERE id = $1';
    const result = await query(sql, [id]);

    if (result.rows.length === 0) return null;
    return this.serialize(result.rows[0]);
  }

  /**
   * Find top-level comments for a video
   * @param {string} videoId - Video UUID
   * @param {Object} options - Query options
   * @returns {Promise<Array>} Top-level comments
   */
  static async findTopLevelByVideo(videoId, options = {}) {
    const {
      limit = 20,
      offset = 0,
      orderBy = 'created_at DESC'
    } = options;

    const sql = `
      SELECT *
      FROM comments
      WHERE video_id = $1 AND parent_id IS NULL
      ORDER BY ${orderBy}
      LIMIT $2 OFFSET $3
    `;

    const result = await query(sql, [videoId, limit, offset]);
    return result.rows.map(row => this.serialize(row));
  }

  /**
   * Find replies for a comment
   * @param {string} parentId - Parent comment UUID
   * @param {Object} options - Query options
   * @returns {Promise<Array>} Replies
   */
  static async findReplies(parentId, options = {}) {
    const {
      limit = 50,
      offset = 0,
      orderBy = 'created_at ASC'
    } = options;

    const sql = `
      SELECT *
      FROM comments
      WHERE parent_id = $1
      ORDER BY ${orderBy}
      LIMIT $2 OFFSET $3
    `;

    const result = await query(sql, [parentId, limit, offset]);
    return result.rows.map(row => this.serialize(row));
  }

  /**
   * Find all comments for a video (flat list)
   * @param {string} videoId - Video UUID
   * @param {Object} options - Query options
   * @returns {Promise<Array>} All comments
   */
  static async findByVideo(videoId, options = {}) {
    const {
      limit = 100,
      offset = 0,
      orderBy = 'created_at DESC'
    } = options;

    const sql = `
      SELECT *
      FROM comments
      WHERE video_id = $1
      ORDER BY ${orderBy}
      LIMIT $2 OFFSET $3
    `;

    const result = await query(sql, [videoId, limit, offset]);
    return result.rows.map(row => this.serialize(row));
  }

  /**
   * Get comments as tree structure
   * @param {string} videoId - Video UUID
   * @param {Object} options - Query options
   * @returns {Promise<Array>} Tree structure
   */
  static async getTreeByVideo(videoId, options = {}) {
    const { maxDepth = 5, topLevelLimit = 20, repliesLimit = 50 } = options;

    // Get top-level comments
    const topLevel = await this.findTopLevelByVideo(videoId, {
      limit: topLevelLimit,
      offset: options.offset || 0
    });

    // Build tree for each top-level comment
    const tree = [];
    for (const comment of topLevel) {
      const commentTree = await this.buildCommentTree(
        comment,
        1,
        maxDepth,
        repliesLimit
      );
      tree.push(commentTree);
    }

    return tree;
  }

  /**
   * Build comment tree recursively
   * @param {Object} comment - Comment node
   * @param {number} depth - Current depth
   * @param {number} maxDepth - Maximum depth
   * @param {number} repliesLimit - Max replies per comment
   * @returns {Promise<Object>} Comment tree node
   */
  static async buildCommentTree(comment, depth, maxDepth, repliesLimit) {
    if (depth >= maxDepth) {
      return { ...comment, replies: [], _truncated: true };
    }

    const replies = await this.findReplies(comment.id, { limit: repliesLimit });

    if (replies.length === 0) {
      return { ...comment, replies: [] };
    }

    const nestedReplies = [];
    for (const reply of replies) {
      const replyTree = await this.buildCommentTree(
        reply,
        depth + 1,
        maxDepth,
        repliesLimit
      );
      nestedReplies.push(replyTree);
    }

    return { ...comment, replies: nestedReplies };
  }

  /**
   * Get single comment thread (comment + all descendants)
   * @param {string} commentId - Root comment UUID
   * @param {number} maxDepth - Maximum depth to fetch
   * @returns {Promise<Object|null>} Comment thread
   */
  static async getThread(commentId, maxDepth = 5) {
    const comment = await this.findById(commentId);
    if (!comment) return null;

    return this.buildCommentTree(comment, 0, maxDepth, 100);
  }

  /**
   * Delete a comment (and cascade to replies)
   * @param {string} id - Comment UUID
   * @returns {Promise<boolean>} Whether deletion was successful
   */
  static async delete(id) {
    const comment = await this.findById(id);
    if (!comment) return false;

    // PostgreSQL CASCADE will handle replies
    const sql = 'DELETE FROM comments WHERE id = $1 RETURNING id';
    const result = await query(sql, [id]);

    return result.rowCount > 0;
  }

  /**
   * Update comment content
   * @param {string} id - Comment UUID
   * @param {string} content - New content
   * @returns {Promise<Object|null>} Updated comment
   */
  static async update(id, content) {
    const sql = `
      UPDATE comments
      SET content = $2, updated_at = NOW()
      WHERE id = $1
      RETURNING *
    `;

    const result = await query(sql, [id, content]);

    if (result.rows.length === 0) return null;
    return this.serialize(result.rows[0]);
  }

  /**
   * Increment likes count
   * @param {string} id - Comment UUID
   * @returns {Promise<number>} New likes count
   */
  static async incrementLikes(id) {
    const sql = `
      UPDATE comments
      SET likes_count = likes_count + 1
      WHERE id = $1
      RETURNING likes_count
    `;

    const result = await query(sql, [id]);
    return parseInt(result.rows[0].likes_count, 10);
  }

  /**
   * Decrement likes count
   * @param {string} id - Comment UUID
   * @returns {Promise<number>} New likes count
   */
  static async decrementLikes(id) {
    const sql = `
      UPDATE comments
      SET likes_count = GREATEST(likes_count - 1, 0)
      WHERE id = $1
      RETURNING likes_count
    `;

    const result = await query(sql, [id]);
    return parseInt(result.rows[0].likes_count, 10);
  }

  /**
   * Increment replies count
   * @param {string} id - Comment UUID
   * @returns {Promise<number>} New replies count
   */
  static async incrementRepliesCount(id) {
    const sql = `
      UPDATE comments
      SET replies_count = replies_count + 1
      WHERE id = $1
      RETURNING replies_count
    `;

    const result = await query(sql, [id]);
    return parseInt(result.rows[0].replies_count, 10);
  }

  /**
   * Decrement replies count
   * @param {string} id - Comment UUID
   * @returns {Promise<number>} New replies count
   */
  static async decrementRepliesCount(id) {
    const sql = `
      UPDATE comments
      SET replies_count = GREATEST(replies_count - 1, 0)
      WHERE id = $1
      RETURNING replies_count
    `;

    const result = await query(sql, [id]);
    return parseInt(result.rows[0].replies_count, 10);
  }

  /**
   * Count comments for a video
   * @param {string} videoId - Video UUID
   * @returns {Promise<number>} Count
   */
  static async countByVideo(videoId) {
    const sql = 'SELECT COUNT(*) FROM comments WHERE video_id = $1';
    const result = await query(sql, [videoId]);
    return parseInt(result.rows[0].count, 10);
  }

  /**
   * Count top-level comments for a video
   * @param {string} videoId - Video UUID
   * @returns {Promise<number>} Count
   */
  static async countTopLevelByVideo(videoId) {
    const sql = `
      SELECT COUNT(*)
      FROM comments
      WHERE video_id = $1 AND parent_id IS NULL
    `;
    const result = await query(sql, [videoId]);
    return parseInt(result.rows[0].count, 10);
  }

  /**
   * Count replies for a comment
   * @param {string} parentId - Parent comment UUID
   * @returns {Promise<number>} Count
   */
  static async countReplies(parentId) {
    const sql = 'SELECT COUNT(*) FROM comments WHERE parent_id = $1';
    const result = await query(sql, [parentId]);
    return parseInt(result.rows[0].count, 10);
  }

  /**
   * Get video statistics
   * @param {string} videoId - Video UUID
   * @returns {Promise<Object>} Statistics
   */
  static async getVideoStats(videoId) {
    const sql = `
      SELECT
        COUNT(*) as total_comments,
        COUNT(DISTINCT user_id) as unique_users,
        SUM(likes_count) as total_likes,
        COUNT(*) FILTER (WHERE parent_id IS NULL) as top_level_count,
        COUNT(*) FILTER (WHERE parent_id IS NOT NULL) as replies_count,
        MAX(created_at) as last_comment_at
      FROM comments
      WHERE video_id = $1
    `;

    const result = await query(sql, [videoId]);
    const stats = result.rows[0];

    return {
      videoId,
      totalComments: parseInt(stats.total_comments, 10) || 0,
      uniqueUsers: parseInt(stats.unique_users, 10) || 0,
      totalLikes: parseInt(stats.total_likes, 10) || 0,
      topLevelCount: parseInt(stats.top_level_count, 10) || 0,
      repliesCount: parseInt(stats.replies_count, 10) || 0,
      lastCommentAt: stats.last_comment_at
    };
  }

  /**
   * Find recent comments across all videos
   * @param {number} limit - Number to retrieve
   * @returns {Promise<Array>} Recent comments
   */
  static async findRecent(limit = 50) {
    const sql = `
      SELECT *
      FROM comments
      ORDER BY created_at DESC
      LIMIT $1
    `;

    const result = await query(sql, [limit]);
    return result.rows.map(row => this.serialize(row));
  }

  /**
   * Find comments by user
   * @param {string} userId - User UUID
   * @param {Object} options - Query options
   * @returns {Promise<Array>} User's comments
   */
  static async findByUser(userId, options = {}) {
    const { limit = 50, offset = 0 } = options;

    const sql = `
      SELECT *
      FROM comments
      WHERE user_id = $1
      ORDER BY created_at DESC
      LIMIT $2 OFFSET $3
    `;

    const result = await query(sql, [userId, limit, offset]);
    return result.rows.map(row => this.serialize(row));
  }

  /**
   * Get popular comments for a video
   * @param {string} videoId - Video UUID
   * @param {number} limit - Number to retrieve
   * @returns {Promise<Array>} Popular comments
   */
  static async findPopularByVideo(videoId, limit = 10) {
    const sql = `
      SELECT *
      FROM comments
      WHERE video_id = $1
      ORDER BY likes_count DESC, created_at DESC
      LIMIT $2
    `;

    const result = await query(sql, [videoId, limit]);
    return result.rows.map(row => this.serialize(row));
  }

  /**
   * Delete all comments for a video
   * @param {string} videoId - Video UUID
   * @returns {Promise<number>} Deleted count
   */
  static async deleteByVideo(videoId) {
    const sql = 'DELETE FROM comments WHERE video_id = $1 RETURNING id';
    const result = await query(sql, [videoId]);
    return result.rowCount;
  }

  /**
   * Serialize database row to camelCase object
   * @param {Object} row - Database row
   * @returns {Object} Serialized object
   */
  static serialize(row) {
    if (!row) return null;

    return {
      id: row.id,
      videoId: row.video_id,
      userId: row.user_id,
      parentId: row.parent_id,
      content: row.content,
      likesCount: parseInt(row.likes_count, 10) || 0,
      repliesCount: parseInt(row.replies_count, 10) || 0,
      createdAt: row.created_at,
      updatedAt: row.updated_at
    };
  }
}

module.exports = Comment;
