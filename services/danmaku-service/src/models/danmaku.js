const { query } = require('../config/database');

class Danmaku {
  /**
   * Create a new danmaku entry
   * @param {Object} data - Danmaku data
   * @returns {Promise<Object>} Created danmaku
   */
  static async create(data) {
    const {
      videoId,
      userId,
      content,
      timePoint,
      color = '#FFFFFF',
      type = 0,
      fontSize = 25
    } = data;

    const sql = `
      INSERT INTO danmakus (video_id, user_id, content, time_point, color, type, font_size)
      VALUES ($1, $2, $3, $4, $5, $6, $7)
      RETURNING *
    `;

    const result = await query(sql, [
      videoId,
      userId,
      content,
      timePoint,
      color,
      type,
      fontSize
    ]);

    return this.serialize(result.rows[0]);
  }

  /**
   * Find danmakus by video ID and time range
   * @param {string} videoId - Video UUID
   * @param {number} startTime - Start time in seconds
   * @param {number} endTime - End time in seconds
   * @param {Object} options - Query options
   * @returns {Promise<Array>} List of danmakus
   */
  static async findByVideoAndTimeRange(videoId, startTime, endTime, options = {}) {
    const {
      limit = 500,
      offset = 0,
      orderBy = 'time_point ASC, created_at ASC'
    } = options;

    const sql = `
      SELECT *
      FROM danmakus
      WHERE video_id = $1
        AND time_point >= $2
        AND time_point <= $3
      ORDER BY ${orderBy}
      LIMIT $4 OFFSET $5
    `;

    const result = await query(sql, [videoId, startTime, endTime, limit, offset]);
    return result.rows.map(row => this.serialize(row));
  }

  /**
   * Find all danmakus for a video
   * @param {string} videoId - Video UUID
   * @param {Object} options - Query options
   * @returns {Promise<Array>} List of danmakus
   */
  static async findByVideoId(videoId, options = {}) {
    const {
      limit = 500,
      offset = 0,
      orderBy = 'created_at DESC'
    } = options;

    const sql = `
      SELECT *
      FROM danmakus
      WHERE video_id = $1
      ORDER BY ${orderBy}
      LIMIT $2 OFFSET $3
    `;

    const result = await query(sql, [videoId, limit, offset]);
    return result.rows.map(row => this.serialize(row));
  }

  /**
   * Get danmaku statistics for a video
   * @param {string} videoId - Video UUID
   * @returns {Promise<Object>} Statistics
   */
  static async getStats(videoId) {
    const sql = `
      SELECT
        COUNT(*) as total_count,
        COUNT(DISTINCT user_id) as unique_users,
        AVG(time_point)::float as avg_time_point,
        MAX(time_point)::float as max_time_point,
        MIN(created_at) as first_danmaku_at,
        MAX(created_at) as last_danmaku_at,
        SUM(CASE WHEN type = 0 THEN 1 ELSE 0 END) as scroll_count,
        SUM(CASE WHEN type = 1 THEN 1 ELSE 0 END) as top_count,
        SUM(CASE WHEN type = 2 THEN 1 ELSE 0 END) as bottom_count
      FROM danmakus
      WHERE video_id = $1
    `;

    const result = await query(sql, [videoId]);
    const stats = result.rows[0];

    return {
      videoId,
      totalCount: parseInt(stats.total_count, 10) || 0,
      uniqueUsers: parseInt(stats.unique_users, 10) || 0,
      avgTimePoint: parseFloat(stats.avg_time_point) || 0,
      maxTimePoint: parseFloat(stats.max_time_point) || 0,
      firstDanmakuAt: stats.first_danmaku_at,
      lastDanmakuAt: stats.last_danmaku_at,
      typeDistribution: {
        scroll: parseInt(stats.scroll_count, 10) || 0,
        top: parseInt(stats.top_count, 10) || 0,
        bottom: parseInt(stats.bottom_count, 10) || 0
      }
    };
  }

  /**
   * Get time-based distribution of danmakus
   * @param {string} videoId - Video UUID
   * @param {number} bucketSize - Time bucket size in seconds
   * @returns {Promise<Array>} Time distribution
   */
  static async getTimeDistribution(videoId, bucketSize = 30) {
    const sql = `
      SELECT
        FLOOR(time_point / $2) * $2 as time_bucket,
        COUNT(*) as count
      FROM danmakus
      WHERE video_id = $1
      GROUP BY time_bucket
      ORDER BY time_bucket
    `;

    const result = await query(sql, [videoId, bucketSize]);
    return result.rows.map(row => ({
      timeBucket: parseFloat(row.time_bucket),
      count: parseInt(row.count, 10)
    }));
  }

  /**
   * Count danmakus for a video
   * @param {string} videoId - Video UUID
   * @returns {Promise<number>} Count
   */
  static async countByVideoId(videoId) {
    const sql = 'SELECT COUNT(*) FROM danmakus WHERE video_id = $1';
    const result = await query(sql, [videoId]);
    return parseInt(result.rows[0].count, 10);
  }

  /**
   * Count danmakus at a specific time point
   * @param {string} videoId - Video UUID
   * @param {number} timePoint - Time point in seconds
   * @param {number} window - Time window in seconds
   * @returns {Promise<number>} Count
   */
  static async countAtTimePoint(videoId, timePoint, window = 1) {
    const sql = `
      SELECT COUNT(*)
      FROM danmakus
      WHERE video_id = $1
        AND time_point >= $2
        AND time_point < $3
    `;

    const result = await query(sql, [
      videoId,
      timePoint - window / 2,
      timePoint + window / 2
    ]);

    return parseInt(result.rows[0].count, 10);
  }

  /**
   * Delete danmakus by video ID (admin use)
   * @param {string} videoId - Video UUID
   * @returns {Promise<number>} Deleted count
   */
  static async deleteByVideoId(videoId) {
    const sql = 'DELETE FROM danmakus WHERE video_id = $1 RETURNING id';
    const result = await query(sql, [videoId]);
    return result.rowCount;
  }

  /**
   * Delete old danmakus
   * @param {number} days - Delete danmakus older than this many days
   * @returns {Promise<number>} Deleted count
   */
  static async deleteOlderThan(days) {
    const sql = `
      DELETE FROM danmakus
      WHERE created_at < NOW() - INTERVAL '${days} days'
      RETURNING id
    `;
    const result = await query(sql);
    return result.rowCount;
  }

  /**
   * Find recent danmakus across all videos
   * @param {number} limit - Number of results
   * @returns {Promise<Array>} Recent danmakus
   */
  static async findRecent(limit = 100) {
    const sql = `
      SELECT *
      FROM danmakus
      ORDER BY created_at DESC
      LIMIT $1
    `;

    const result = await query(sql, [limit]);
    return result.rows.map(row => this.serialize(row));
  }

  /**
   * Get user danmaku history
   * @param {string} userId - User UUID
   * @param {Object} options - Query options
   * @returns {Promise<Array>} User's danmaku history
   */
  static async findByUserId(userId, options = {}) {
    const { limit = 50, offset = 0 } = options;

    const sql = `
      SELECT *
      FROM danmakus
      WHERE user_id = $1
      ORDER BY created_at DESC
      LIMIT $2 OFFSET $3
    `;

    const result = await query(sql, [userId, limit, offset]);
    return result.rows.map(row => this.serialize(row));
  }

  /**
   * Serialize database row to camelCase object
   * @param {Object} row - Database row
   * @returns {Object} Serialized object
   */
  static serialize(row) {
    if (!row) return null;

    return {
      id: row.id.toString(),
      videoId: row.video_id,
      userId: row.user_id,
      content: row.content,
      timePoint: parseFloat(row.time_point),
      color: row.color,
      type: row.type,
      fontSize: row.font_size,
      createdAt: row.created_at
    };
  }
}

module.exports = Danmaku;
