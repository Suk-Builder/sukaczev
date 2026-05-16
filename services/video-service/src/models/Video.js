/**
 * @fileoverview Video model - Data access layer for video operations.
 * Handles CRUD, likes, favorites, coins, and interactions.
 */

const { query, getClient } = require('../config/db');
const logger = require('../services/loggerService');

/**
 * Public video fields to return to clients.
 */
const PUBLIC_VIDEO_FIELDS = [
  'v.id',
  'v.user_id',
  'v.title',
  'v.description',
  'v.video_url',
  'v.thumbnail_url',
  'v.duration',
  'v.views_count',
  'v.likes_count',
  'v.coins_count',
  'v.favorites_count',
  'v.danmaku_count',
  'v.comments_count',
  'v.category_id',
  'v.status',
  'v.published_at',
  'v.created_at',
  'v.updated_at',
].join(', ');

/**
 * Creates a new video.
 *
 * @async
 * @param {Object} videoData - Video data
 * @returns {Promise<Object>}
 */
async function create(videoData) {
  const {
    userId,
    title,
    description,
    videoUrl,
    thumbnailUrl,
    duration,
    categoryId,
    status,
  } = videoData;

  const sql = `
    INSERT INTO videos (user_id, title, description, video_url, thumbnail_url, duration, category_id, status, published_at)
    VALUES ($1, $2, $3, $4, $5, $6, $7, $8, CASE WHEN $8 = 'published' THEN CURRENT_TIMESTAMP ELSE NULL END)
    RETURNING ${PUBLIC_VIDEO_FIELDS}
  `;

  try {
    const result = await query(sql, [
      userId,
      title,
      description || '',
      videoUrl,
      thumbnailUrl || null,
      duration || 0,
      categoryId || null,
      status || 'draft',
    ]);

    logger.info('Video created', { videoId: result.rows[0].id, title, userId });
    return result.rows[0];
  } catch (err) {
    logger.error('Failed to create video', { error: err.message, title });
    throw err;
  }
}

/**
 * Finds a video by ID.
 *
 * @async
 * @param {string} id - Video UUID
 * @returns {Promise<Object|null>}
 */
async function findById(id) {
  const sql = `SELECT ${PUBLIC_VIDEO_FIELDS} FROM videos v WHERE v.id = $1`;
  const result = await query(sql, [id]);
  return result.rows[0] || null;
}

/**
 * Finds a published video by ID.
 *
 * @async
 * @param {string} id - Video UUID
 * @returns {Promise<Object|null>}
 */
async function findPublishedById(id) {
  const sql = `
    SELECT ${PUBLIC_VIDEO_FIELDS}
    FROM videos v
    WHERE v.id = $1 AND v.status = 'published'
  `;
  const result = await query(sql, [id]);
  return result.rows[0] || null;
}

/**
 * Updates a video.
 *
 * @async
 * @param {string} id - Video UUID
 * @param {Object} updates - Fields to update
 * @returns {Promise<Object|null>}
 */
async function update(id, updates) {
  const allowedFields = [
    'title',
    'description',
    'video_url',
    'thumbnail_url',
    'duration',
    'category_id',
    'status',
  ];

  const setClauses = [];
  const values = [];
  let paramIndex = 1;

  for (const [key, value] of Object.entries(updates)) {
    const dbField = key.replace(/[A-Z]/g, (letter) => `_${letter.toLowerCase()}`);
    if (allowedFields.includes(dbField) && value !== undefined) {
      setClauses.push(`${dbField} = $${paramIndex}`);
      values.push(value);
      paramIndex++;
    }
  }

  // Handle status change to published
  if (updates.status === 'published') {
    setClauses.push(`published_at = COALESCE(published_at, CURRENT_TIMESTAMP)`);
  }

  if (setClauses.length === 0) return findById(id);

  const sql = `
    UPDATE videos
    SET ${setClauses.join(', ')}
    WHERE id = $${paramIndex}
    RETURNING ${PUBLIC_VIDEO_FIELDS}
  `;
  values.push(id);

  const result = await query(sql, values);
  logger.info('Video updated', { videoId: id });
  return result.rows[0] || null;
}

/**
 * Deletes a video.
 *
 * @async
 * @param {string} id - Video UUID
 * @returns {Promise<boolean>}
 */
async function remove(id) {
  const sql = 'DELETE FROM videos WHERE id = $1 RETURNING id';
  const result = await query(sql, [id]);
  if (result.rowCount > 0) {
    logger.info('Video deleted', { videoId: id });
    return true;
  }
  return false;
}

/**
 * Lists videos with cursor-based pagination.
 *
 * @async
 * @param {Object} options - Query options
 * @returns {Promise<Object>}
 */
async function list(options = {}) {
  const {
    limit = 20,
    cursor = null,
    categoryId = null,
    status = 'published',
    sortBy = 'created_at',
    order = 'desc',
    userId = null,
  } = options;

  const maxLimit = Math.min(limit, 100);
  const conditions = [];
  const values = [];
  let paramIndex = 1;

  // Status filter
  if (status) {
    conditions.push(`v.status = $${paramIndex}`);
    values.push(status);
    paramIndex++;
  }

  // Category filter
  if (categoryId) {
    conditions.push(`v.category_id = $${paramIndex}`);
    values.push(categoryId);
    paramIndex++;
  }

  // User filter
  if (userId) {
    conditions.push(`v.user_id = $${paramIndex}`);
    values.push(userId);
    paramIndex++;
  }

  // Cursor-based pagination
  if (cursor) {
    const decoded = Buffer.from(cursor, 'base64').toString();
    const [cursorValue, cursorId] = decoded.split('|');
    const operator = order.toLowerCase() === 'desc' ? '<' : '>';

    conditions.push(`(v.${sortBy}, v.id) ${operator} ($${paramIndex}, $${paramIndex + 1})`);
    values.push(cursorValue, cursorId);
    paramIndex += 2;
  }

  const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';
  const orderClause = `ORDER BY v.${sortBy} ${order.toUpperCase()}, v.id ${order.toUpperCase()}`;

  const sql = `
    SELECT ${PUBLIC_VIDEO_FIELDS}
    FROM videos v
    ${whereClause}
    ${orderClause}
    LIMIT $${paramIndex}
  `;
  values.push(maxLimit + 1);

  const countSql = `
    SELECT COUNT(*) as count FROM videos v ${whereClause}
  `;
  const countValues = values.slice(0, -1);

  const [result, countResult] = await Promise.all([
    query(sql, values),
    query(countSql, countValues),
  ]);

  const rows = result.rows;
  const hasMore = rows.length > maxLimit;
  const videos = hasMore ? rows.slice(0, maxLimit) : rows;

  // Generate next cursor
  let nextCursor = null;
  if (hasMore && videos.length > 0) {
    const lastVideo = videos[videos.length - 1];
    const cursorValue = sortBy === 'views_count' ? lastVideo.views_count :
      sortBy === 'likes_count' ? lastVideo.likes_count :
      lastVideo.created_at;
    nextCursor = Buffer.from(`${cursorValue}|${lastVideo.id}`).toString('base64');
  }

  return {
    videos,
    pagination: {
      total: parseInt(countResult.rows[0]?.count || '0', 10),
      limit: maxLimit,
      hasMore,
      nextCursor,
    },
  };
}

/**
 * Increments view count for a video.
 *
 * @async
 * @param {string} videoId - Video UUID
 * @returns {Promise<Object|null>}
 */
async function incrementViews(videoId) {
  const sql = `
    UPDATE videos
    SET views_count = views_count + 1
    WHERE id = $1
    RETURNING views_count
  `;
  const result = await query(sql, [videoId]);
  return result.rows[0] || null;
}

/**
 * Adds a like to a video.
 *
 * @async
 * @param {string} videoId - Video UUID
 * @param {string} userId - User UUID
 * @returns {Promise<Object>}
 */
async function addLike(videoId, userId) {
  const client = await getClient();

  try {
    await client.query('BEGIN');

    const likeSql = `
      INSERT INTO video_likes (video_id, user_id)
      VALUES ($1, $2)
      ON CONFLICT (video_id, user_id) DO NOTHING
      RETURNING id, video_id, user_id, created_at
    `;
    const likeResult = await client.query(likeSql, [videoId, userId]);

    if (likeResult.rowCount === 0) {
      await client.query('ROLLBACK');
      const error = new Error('Already liked this video');
      error.code = 'ALREADY_LIKED';
      throw error;
    }

    await client.query(
      'UPDATE videos SET likes_count = likes_count + 1 WHERE id = $1',
      [videoId]
    );

    await client.query('COMMIT');

    return likeResult.rows[0];
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
}

/**
 * Removes a like from a video.
 *
 * @async
 * @param {string} videoId - Video UUID
 * @param {string} userId - User UUID
 * @returns {Promise<boolean>}
 */
async function removeLike(videoId, userId) {
  const client = await getClient();

  try {
    await client.query('BEGIN');

    const unlikeSql = `
      DELETE FROM video_likes
      WHERE video_id = $1 AND user_id = $2
      RETURNING id
    `;
    const result = await client.query(unlikeSql, [videoId, userId]);

    if (result.rowCount === 0) {
      await client.query('ROLLBACK');
      return false;
    }

    await client.query(
      'UPDATE videos SET likes_count = GREATEST(likes_count - 1, 0) WHERE id = $1',
      [videoId]
    );

    await client.query('COMMIT');
    return true;
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
}

/**
 * Checks if user liked a video.
 *
 * @async
 * @param {string} videoId - Video UUID
 * @param {string} userId - User UUID
 * @returns {Promise<boolean>}
 */
async function hasLiked(videoId, userId) {
  const sql = 'SELECT 1 FROM video_likes WHERE video_id = $1 AND user_id = $2';
  const result = await query(sql, [videoId, userId]);
  return result.rowCount > 0;
}

/**
 * Adds a favorite to a video.
 *
 * @async
 * @param {string} videoId - Video UUID
 * @param {string} userId - User UUID
 * @returns {Promise<Object>}
 */
async function addFavorite(videoId, userId) {
  const client = await getClient();

  try {
    await client.query('BEGIN');

    const favSql = `
      INSERT INTO video_favorites (video_id, user_id)
      VALUES ($1, $2)
      ON CONFLICT (video_id, user_id) DO NOTHING
      RETURNING id, video_id, user_id, created_at
    `;
    const favResult = await client.query(favSql, [videoId, userId]);

    if (favResult.rowCount === 0) {
      await client.query('ROLLBACK');
      const error = new Error('Already favorited this video');
      error.code = 'ALREADY_FAVORITED';
      throw error;
    }

    await client.query(
      'UPDATE videos SET favorites_count = favorites_count + 1 WHERE id = $1',
      [videoId]
    );

    await client.query('COMMIT');
    return favResult.rows[0];
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
}

/**
 * Removes a favorite from a video.
 *
 * @async
 * @param {string} videoId - Video UUID
 * @param {string} userId - User UUID
 * @returns {Promise<boolean>}
 */
async function removeFavorite(videoId, userId) {
  const client = await getClient();

  try {
    await client.query('BEGIN');

    const result = await client.query(
      'DELETE FROM video_favorites WHERE video_id = $1 AND user_id = $2 RETURNING id',
      [videoId, userId]
    );

    if (result.rowCount === 0) {
      await client.query('ROLLBACK');
      return false;
    }

    await client.query(
      'UPDATE videos SET favorites_count = GREATEST(favorites_count - 1, 0) WHERE id = $1',
      [videoId]
    );

    await client.query('COMMIT');
    return true;
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
}

/**
 * Checks if user favorited a video.
 *
 * @async
 * @param {string} videoId - Video UUID
 * @param {string} userId - User UUID
 * @returns {Promise<boolean>}
 */
async function hasFavorited(videoId, userId) {
  const sql = 'SELECT 1 FROM video_favorites WHERE video_id = $1 AND user_id = $2';
  const result = await query(sql, [videoId, userId]);
  return result.rowCount > 0;
}

/**
 * Drops coins on a video.
 *
 * @async
 * @param {string} videoId - Video UUID
 * @param {string} userId - User UUID
 * @param {number} count - Number of coins (1-2)
 * @returns {Promise<Object>}
 */
async function dropCoins(videoId, userId, count) {
  const client = await getClient();

  try {
    await client.query('BEGIN');

    // Check if user already dropped coins on this video
    const checkSql = 'SELECT count FROM coin_drops WHERE video_id = $1 AND user_id = $2';
    const checkResult = await client.query(checkSql, [videoId, userId]);

    let totalCoins = count;
    if (checkResult.rowCount > 0) {
      totalCoins = checkResult.rows[0].count + count;
      if (totalCoins > 2) {
        await client.query('ROLLBACK');
        const error = new Error('Maximum 2 coins per video');
        error.code = 'MAX_COINS_REACHED';
        throw error;
      }

      await client.query(
        'UPDATE coin_drops SET count = $3 WHERE video_id = $1 AND user_id = $2',
        [videoId, userId, totalCoins]
      );
    } else {
      await client.query(
        'INSERT INTO coin_drops (video_id, user_id, count) VALUES ($1, $2, $3)',
        [videoId, userId, count]
      );
    }

    await client.query(
      'UPDATE videos SET coins_count = coins_count + $2 WHERE id = $1',
      [videoId, count]
    );

    await client.query('COMMIT');

    return {
      video_id: videoId,
      user_id: userId,
      count: totalCoins,
      dropped: count,
    };
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
}

/**
 * Gets coin count for a video by user.
 *
 * @async
 * @param {string} videoId - Video UUID
 * @param {string} userId - User UUID
 * @returns {Promise<number>}
 */
async function getUserCoinCount(videoId, userId) {
  const sql = 'SELECT count FROM coin_drops WHERE video_id = $1 AND user_id = $2';
  const result = await query(sql, [videoId, userId]);
  return result.rows[0]?.count || 0;
}

/**
 * Gets video statistics.
 *
 * @async
 * @param {string} videoId - Video UUID
 * @returns {Promise<Object|null>}
 */
async function getStats(videoId) {
  const sql = `
    SELECT
      views_count,
      likes_count,
      coins_count,
      favorites_count,
      comments_count
    FROM videos
    WHERE id = $1
  `;
  const result = await query(sql, [videoId]);
  return result.rows[0] || null;
}

/**
 * Gets user's videos.
 *
 * @async
 * @param {string} userId - User UUID
 * @param {Object} options - Query options
 * @returns {Promise<Object>}
 */
async function getByUser(userId, options = {}) {
  const { limit = 20, offset = 0, status } = options;

  let sql = `
    SELECT ${PUBLIC_VIDEO_FIELDS}
    FROM videos v
    WHERE v.user_id = $1
  `;
  const values = [userId];

  if (status) {
    sql += ` AND v.status = $2`;
    values.push(status);
  }

  sql += ` ORDER BY v.created_at DESC LIMIT $${values.length + 1} OFFSET $${values.length + 2}`;
  values.push(limit, offset);

  const countSql = `SELECT COUNT(*) as count FROM videos WHERE user_id = $1${status ? ' AND status = $2' : ''}`;
  const countValues = status ? [userId, status] : [userId];

  const [result, countResult] = await Promise.all([
    query(sql, values),
    query(countSql, countValues),
  ]);

  return {
    videos: result.rows,
    total: parseInt(countResult.rows[0].count, 10),
    limit,
    offset,
  };
}

module.exports = {
  create,
  findById,
  findPublishedById,
  update,
  remove,
  list,
  incrementViews,
  addLike,
  removeLike,
  hasLiked,
  addFavorite,
  removeFavorite,
  hasFavorited,
  dropCoins,
  getUserCoinCount,
  getStats,
  getByUser,
};
