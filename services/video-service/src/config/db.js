/**
 * @fileoverview Database configuration and connection pool for video-service.
 * Uses PostgreSQL with pg-pool for connection management.
 */

const { Pool } = require('pg');
const logger = require('../services/loggerService');

const pool = new Pool({
  host: process.env.DB_HOST || 'localhost',
  port: parseInt(process.env.DB_PORT || '5432', 10),
  database: process.env.DB_NAME || 'sukaczev_videos',
  user: process.env.DB_USER || 'postgres',
  password: process.env.DB_PASSWORD,
  max: parseInt(process.env.DB_POOL_MAX || '12', 10),
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 5000,
});

pool.on('error', (err) => {
  logger.error('Unexpected database pool error', { error: err.message, stack: err.stack });
});

pool.on('connect', () => {
  logger.debug('New database client connected');
});

/**
 * Initializes database tables for video-service.
 *
 * @async
 * @returns {Promise<void>}
 */
async function initDatabase() {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    // Create categories table (first, since videos references it)
    await client.query(`
      CREATE TABLE IF NOT EXISTS categories (
        id SERIAL PRIMARY KEY,
        name VARCHAR(50) NOT NULL,
        slug VARCHAR(50) UNIQUE NOT NULL,
        icon VARCHAR(100),
        parent_id INTEGER REFERENCES categories(id) ON DELETE SET NULL,
        sort_order INTEGER DEFAULT 0,
        created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
        UNIQUE(name, parent_id)
      );

      CREATE INDEX IF NOT EXISTS idx_categories_slug ON categories(slug);
      CREATE INDEX IF NOT EXISTS idx_categories_parent ON categories(parent_id);
    `);

    // Create videos table
    await client.query(`
      CREATE TABLE IF NOT EXISTS videos (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        user_id UUID NOT NULL,
        title VARCHAR(100) NOT NULL,
        description TEXT DEFAULT '',
        video_url TEXT NOT NULL,
        thumbnail_url TEXT,
        duration INTEGER DEFAULT 0 CHECK (duration >= 0),
        views_count BIGINT DEFAULT 0 CHECK (views_count >= 0),
        likes_count INTEGER DEFAULT 0 CHECK (likes_count >= 0),
        coins_count INTEGER DEFAULT 0 CHECK (coins_count >= 0),
        favorites_count INTEGER DEFAULT 0 CHECK (favorites_count >= 0),
        danmaku_count INTEGER DEFAULT 0 CHECK (danmaku_count >= 0),
        comments_count INTEGER DEFAULT 0 CHECK (comments_count >= 0),
        category_id INTEGER REFERENCES categories(id) ON DELETE SET NULL,
        status VARCHAR(20) DEFAULT 'draft' CHECK (status IN ('draft', 'published', 'private')),
        published_at TIMESTAMPTZ,
        created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
        CONSTRAINT title_length CHECK (char_length(title) >= 1 AND char_length(title) <= 100)
      );

      CREATE INDEX IF NOT EXISTS idx_videos_user_id ON videos(user_id);
      CREATE INDEX IF NOT EXISTS idx_videos_status ON videos(status);
      CREATE INDEX IF NOT EXISTS idx_videos_category ON videos(category_id);
      CREATE INDEX IF NOT EXISTS idx_videos_created_at ON videos(created_at DESC);
      CREATE INDEX IF NOT EXISTS idx_videos_published_at ON videos(published_at DESC);
      CREATE INDEX IF NOT EXISTS idx_videos_views ON videos(views_count DESC);
      CREATE INDEX IF NOT EXISTS idx_videos_likes ON videos(likes_count DESC);
    `);

    // Create video_likes table
    await client.query(`
      CREATE TABLE IF NOT EXISTS video_likes (
        id SERIAL PRIMARY KEY,
        video_id UUID NOT NULL REFERENCES videos(id) ON DELETE CASCADE,
        user_id UUID NOT NULL,
        created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
        UNIQUE(video_id, user_id)
      );

      CREATE INDEX IF NOT EXISTS idx_likes_video ON video_likes(video_id);
      CREATE INDEX IF NOT EXISTS idx_likes_user ON video_likes(user_id);
    `);

    // Create video_favorites table
    await client.query(`
      CREATE TABLE IF NOT EXISTS video_favorites (
        id SERIAL PRIMARY KEY,
        video_id UUID NOT NULL REFERENCES videos(id) ON DELETE CASCADE,
        user_id UUID NOT NULL,
        created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
        UNIQUE(video_id, user_id)
      );

      CREATE INDEX IF NOT EXISTS idx_favorites_video ON video_favorites(video_id);
      CREATE INDEX IF NOT EXISTS idx_favorites_user ON video_favorites(user_id);
    `);

    // Create coin_drops table
    await client.query(`
      CREATE TABLE IF NOT EXISTS coin_drops (
        id SERIAL PRIMARY KEY,
        video_id UUID NOT NULL REFERENCES videos(id) ON DELETE CASCADE,
        user_id UUID NOT NULL,
        count SMALLINT NOT NULL CHECK (count >= 1 AND count <= 2),
        created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
        UNIQUE(video_id, user_id)
      );

      CREATE INDEX IF NOT EXISTS idx_coins_video ON coin_drops(video_id);
      CREATE INDEX IF NOT EXISTS idx_coins_user ON coin_drops(user_id);
    `);

    // Create trigger function for updated_at
    await client.query(`
      CREATE OR REPLACE FUNCTION update_updated_at_column()
      RETURNS TRIGGER AS $$
      BEGIN
        NEW.updated_at = CURRENT_TIMESTAMP;
        RETURN NEW;
      END;
      $$ language 'plpgsql';

      DROP TRIGGER IF EXISTS update_videos_updated_at ON videos;
      CREATE TRIGGER update_videos_updated_at
        BEFORE UPDATE ON videos
        FOR EACH ROW
        EXECUTE FUNCTION update_updated_at_column();
    `);

    await client.query('COMMIT');
    logger.info('Video database initialized successfully');
  } catch (err) {
    await client.query('ROLLBACK');
    logger.error('Video database initialization failed', { error: err.message });
    throw err;
  } finally {
    client.release();
  }
}

/**
 * Seeds default categories if they don't exist.
 *
 * @async
 * @returns {Promise<void>}
 */
async function seedDefaultCategories() {
  const categories = [
    // Top-level categories
    { name: '动画', slug: 'anime', icon: 'film', sort_order: 1 },
    { name: '音乐', slug: 'music', icon: 'music', sort_order: 2 },
    { name: '科技', slug: 'tech', icon: 'cpu', sort_order: 3 },
    { name: '知识', slug: 'knowledge', icon: 'book', sort_order: 4 },
    { name: '生活', slug: 'life', icon: 'coffee', sort_order: 5 },
    { name: '游戏', slug: 'game', icon: 'gamepad', sort_order: 6 },
    { name: '娱乐', slug: 'entertainment', icon: 'smile', sort_order: 7 },
    { name: '美食', slug: 'food', icon: 'utensils', sort_order: 8 },
    { name: '运动', slug: 'sports', icon: 'running', sort_order: 9 },
    { name: '时尚', slug: 'fashion', icon: 'tshirt', sort_order: 10 },
  ];

  const subCategories = {
    'anime': [
      { name: 'MAD·AMV', slug: 'mad-amv', icon: 'film' },
      { name: 'MMD·3D', slug: 'mmd-3d', icon: 'cube' },
      { name: '动画短片', slug: 'animation-short', icon: 'video' },
      { name: '手书', slug: 'tegaki', icon: 'pencil' },
      { name: '配音', slug: 'dubbing', icon: 'microphone' },
    ],
    'music': [
      { name: '翻唱', slug: 'cover', icon: 'microphone' },
      { name: '原创音乐', slug: 'original-music', icon: 'music' },
      { name: '演奏', slug: 'instrument', icon: 'guitar' },
      { name: 'VOCALOID', slug: 'vocaloid', icon: 'robot' },
      { name: '音乐现场', slug: 'live-music', icon: 'broadcast' },
    ],
    'tech': [
      { name: '数码', slug: 'digital', icon: 'laptop' },
      { name: '编程', slug: 'programming', icon: 'code' },
      { name: 'AI·人工智能', slug: 'ai', icon: 'brain' },
      { name: '极客DIY', slug: 'diy', icon: 'tools' },
      { name: '网络安全', slug: 'security', icon: 'shield' },
    ],
    'knowledge': [
      { name: '科学科普', slug: 'science', icon: 'flask' },
      { name: '人文历史', slug: 'humanities', icon: 'landmark' },
      { name: '财经', slug: 'finance', icon: 'chart-line' },
      { name: '校园学习', slug: 'study', icon: 'graduation-cap' },
      { name: '职业职场', slug: 'career', icon: 'briefcase' },
    ],
    'life': [
      { name: '日常', slug: 'daily', icon: 'sun' },
      { name: '动物圈', slug: 'animals', icon: 'paw' },
      { name: '手工', slug: 'handcraft', icon: 'hand-paper' },
      { name: '绘画', slug: 'painting', icon: 'palette' },
      { name: '旅行', slug: 'travel', icon: 'plane' },
    ],
    'game': [
      { name: '单机游戏', slug: 'single-player', icon: 'desktop' },
      { name: '网络游戏', slug: 'online-game', icon: 'network-wired' },
      { name: '电子竞技', slug: 'esports', icon: 'trophy' },
      { name: '手游', slug: 'mobile-game', icon: 'mobile' },
      { name: '桌游棋牌', slug: 'board-game', icon: 'chess' },
    ],
  };

  try {
    for (const cat of categories) {
      const result = await pool.query(
        `INSERT INTO categories (name, slug, icon, sort_order)
         VALUES ($1, $2, $3, $4)
         ON CONFLICT (slug) DO NOTHING
         RETURNING id`,
        [cat.name, cat.slug, cat.icon, cat.sort_order]
      );

      const parentId = result.rows[0]?.id;

      // Insert subcategories if parent was created and has subcategories
      if (parentId && subCategories[cat.slug]) {
        for (const sub of subCategories[cat.slug]) {
          await pool.query(
            `INSERT INTO categories (name, slug, icon, parent_id)
             VALUES ($1, $2, $3, $4)
             ON CONFLICT (name, parent_id) DO NOTHING`,
            [sub.name, sub.slug, sub.icon, parentId]
          );
        }
      }
    }
    logger.info('Default categories seeded');
  } catch (err) {
    logger.error('Failed to seed categories', { error: err.message });
    throw err;
  }
}

/**
 * Gracefully closes the database pool.
 *
 * @async
 * @returns {Promise<void>}
 */
async function closePool() {
  logger.info('Closing database pool');
  await pool.end();
}

/**
 * Executes a query using the connection pool.
 *
 * @param {string} text - SQL query text
 * @param {Array} params - Query parameters
 * @returns {Promise<Object>} Query result
 */
function query(text, params) {
  return pool.query(text, params);
}

/**
 * Gets a client from the pool for transactions.
 *
 * @returns {Promise<Object>} Database client
 */
function getClient() {
  return pool.connect();
}

module.exports = {
  pool,
  query,
  getClient,
  initDatabase,
  seedDefaultCategories,
  closePool,
};
