/**
 * Database configuration for search service fallback
 */
const { Pool } = require('pg');
const logger = require('../utils/logger');

const pool = new Pool({
  host: process.env.DB_HOST || 'localhost',
  port: parseInt(process.env.DB_PORT || '5432', 10),
  database: process.env.DB_NAME || 'sukaczev',
  user: process.env.DB_USER || 'sukaczev',
  password: process.env.DB_PASSWORD || 'Sukaczev416520!',
  max: 5,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 5000,
});

pool.on('error', (err) => {
  logger.error('Unexpected DB pool error:', err.message);
});

async function query(sql, params) {
  const client = await pool.connect();
  try {
    const result = await client.query(sql, params);
    return result;
  } finally {
    client.release();
  }
}

async function pingDatabase() {
  try {
    await query('SELECT 1');
    return true;
  } catch (error) {
    logger.error('Database ping failed:', error.message);
    return false;
  }
}

async function searchVideosFallback({
  query: searchQuery,
  category,
  sort = 'relevance',
  page = 1,
  pageSize = 20,
}) {
  const conditions = ["v.status = 'published'"];
  const values = [];

  if (searchQuery && searchQuery.trim()) {
    conditions.push('(v.title ILIKE $1 OR v.description ILIKE $1)');
    values.push('%' + searchQuery.trim() + '%');
  }

  if (category) {
    conditions.push('c.slug = $' + (values.length + 1));
    values.push(category);
  }

  const whereClause = 'WHERE ' + conditions.join(' AND ');

  let orderClause;
  switch (sort) {
    case 'latest':
      orderClause = 'ORDER BY v.created_at DESC';
      break;
    case 'popular':
      orderClause = 'ORDER BY v.views_count DESC, v.likes_count DESC';
      break;
    case 'likes':
      orderClause = 'ORDER BY v.likes_count DESC';
      break;
    default:
      if (searchQuery && searchQuery.trim()) {
        orderClause = 'ORDER BY v.views_count DESC, v.created_at DESC';
      } else {
        orderClause = 'ORDER BY v.created_at DESC';
      }
  }

  const offset = (Math.max(1, parseInt(page, 10)) - 1) * Math.min(parseInt(pageSize, 10), 100);
  const limit = Math.min(parseInt(pageSize, 10), 100);

  const baseSql = `
    SELECT v.id, v.user_id, v.title, v.description, v.video_url, v.thumbnail_url,
           v.duration, v.views_count, v.likes_count, v.category_id,
           c.name as category_name, v.created_at, v.updated_at,
           u.username, u.avatar_url
    FROM videos v
    LEFT JOIN categories c ON v.category_id = c.id
    LEFT JOIN users u ON v.user_id = u.id
    ${whereClause}
    ${orderClause}
  `;

  const countSql = `SELECT COUNT(*) as count FROM videos v LEFT JOIN categories c ON v.category_id = c.id ${whereClause}`;

  const limitOffsetParams = [...values, limit, offset];
  const sql = baseSql + ` LIMIT $${values.length + 1} OFFSET $${values.length + 2}`;

  const [result, countResult] = await Promise.all([
    query(sql, limitOffsetParams),
    query(countSql, values),
  ]);

  const total = parseInt(countResult.rows[0]?.count || 0, 10);

  const results = result.rows.map((row) => ({
    id: row.id,
    score: 1.0,
    title: row.title,
    description: row.description || '',
    username: row.username || '',
    category: row.category_name || '',
    tags: [],
    views: row.views_count || 0,
    likes: row.likes_count || 0,
    duration: row.duration || 0,
    coverUrl: row.thumbnail_url || '',
    videoUrl: row.video_url || '',
    userId: row.user_id || '',
    userAvatar: row.avatar_url || '',
    createdAt: row.created_at,
    highlights: { title: [], description: [], username: [] },
  }));

  return {
    results, total,
    page: parseInt(page, 10),
    pageSize: limit,
    query: searchQuery || '',
    sort,
    took: 0,
    source: 'database_fallback',
  };
}

module.exports = {
  pool,
  query,
  pingDatabase,
  searchVideosFallback,
};
