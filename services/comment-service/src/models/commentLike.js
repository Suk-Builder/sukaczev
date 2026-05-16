const { query } = require('../config/database');

class CommentLike {
  /**
   * Create a new like
   * @param {string} commentId - Comment UUID
   * @param {string} userId - User UUID
   * @returns {Promise<Object>} Created like
   */
  static async create(commentId, userId) {
    const sql = `
      INSERT INTO comment_likes (comment_id, user_id)
      VALUES ($1, $2)
      ON CONFLICT (comment_id, user_id) DO NOTHING
      RETURNING *
    `;

    const result = await query(sql, [commentId, userId]);

    if (result.rowCount === 0) {
      return null; // Already liked
    }

    return this.serialize(result.rows[0]);
  }

  /**
   * Delete a like (unlike)
   * @param {string} commentId - Comment UUID
   * @param {string} userId - User UUID
   * @returns {Promise<boolean>} Whether unlike was successful
   */
  static async delete(commentId, userId) {
    const sql = `
      DELETE FROM comment_likes
      WHERE comment_id = $1 AND user_id = $2
      RETURNING id
    `;

    const result = await query(sql, [commentId, userId]);
    return result.rowCount > 0;
  }

  /**
   * Check if user has liked a comment
   * @param {string} commentId - Comment UUID
   * @param {string} userId - User UUID
   * @returns {Promise<boolean>} Whether user has liked
   */
  static async hasLiked(commentId, userId) {
    const sql = `
      SELECT EXISTS(
        SELECT 1 FROM comment_likes
        WHERE comment_id = $1 AND user_id = $2
      ) as has_liked
    `;

    const result = await query(sql, [commentId, userId]);
    return result.rows[0].has_liked === true;
  }

  /**
   * Count likes for a comment
   * @param {string} commentId - Comment UUID
   * @returns {Promise<number>} Like count
   */
  static async countByComment(commentId) {
    const sql = 'SELECT COUNT(*) FROM comment_likes WHERE comment_id = $1';
    const result = await query(sql, [commentId]);
    return parseInt(result.rows[0].count, 10);
  }

  /**
   * Get likes for a comment with user IDs
   * @param {string} commentId - Comment UUID
   * @param {Object} options - Query options
   * @returns {Promise<Array>} Likes
   */
  static async findByComment(commentId, options = {}) {
    const { limit = 100, offset = 0 } = options;

    const sql = `
      SELECT *
      FROM comment_likes
      WHERE comment_id = $1
      ORDER BY created_at DESC
      LIMIT $2 OFFSET $3
    `;

    const result = await query(sql, [commentId, limit, offset]);
    return result.rows.map(row => this.serialize(row));
  }

  /**
   * Get comments liked by a user
   * @param {string} userId - User UUID
   * @param {Object} options - Query options
   * @returns {Promise<Array>} Liked comment IDs
   */
  static async findByUser(userId, options = {}) {
    const { limit = 100, offset = 0 } = options;

    const sql = `
      SELECT cl.*, c.content, c.video_id
      FROM comment_likes cl
      JOIN comments c ON cl.comment_id = c.id
      WHERE cl.user_id = $1
      ORDER BY cl.created_at DESC
      LIMIT $2 OFFSET $3
    `;

    const result = await query(sql, [userId, limit, offset]);
    return result.rows.map(row => ({
      ...this.serialize(row),
      content: row.content,
      videoId: row.video_id
    }));
  }

  /**
   * Toggle like status
   * @param {string} commentId - Comment UUID
   * @param {string} userId - User UUID
   * @returns {Promise<Object>} Result with liked status
   */
  static async toggle(commentId, userId) {
    const hasLiked = await this.hasLiked(commentId, userId);

    if (hasLiked) {
      const deleted = await this.delete(commentId, userId);
      return { liked: false, action: 'unliked', success: deleted };
    } else {
      const created = await this.create(commentId, userId);
      return { liked: true, action: 'liked', success: created !== null };
    }
  }

  /**
   * Delete all likes for a comment
   * @param {string} commentId - Comment UUID
   * @returns {Promise<number>} Deleted count
   */
  static async deleteByComment(commentId) {
    const sql = 'DELETE FROM comment_likes WHERE comment_id = $1 RETURNING id';
    const result = await query(sql, [commentId]);
    return result.rowCount;
  }

  /**
   * Get like statistics
   * @returns {Promise<Object>} Statistics
   */
  static async getStats() {
    const sql = `
      SELECT
        COUNT(*) as total_likes,
        COUNT(DISTINCT comment_id) as liked_comments,
        COUNT(DISTINCT user_id) as unique_users
      FROM comment_likes
    `;

    const result = await query(sql);
    const stats = result.rows[0];

    return {
      totalLikes: parseInt(stats.total_likes, 10) || 0,
      likedComments: parseInt(stats.liked_comments, 10) || 0,
      uniqueUsers: parseInt(stats.unique_users, 10) || 0
    };
  }

  /**
   * Serialize database row to camelCase object
   * @param {Object} row - Database row
   * @returns {Object} Serialized object
   */
  static serialize(row) {
    if (!row) return null;

    return {
      id: row.id ? row.id.toString() : null,
      commentId: row.comment_id,
      userId: row.user_id,
      createdAt: row.created_at
    };
  }
}

module.exports = CommentLike;
