const { Pool } = require('pg');
const logger = require('../utils/logger');

const pool = new Pool({
  host: process.env.DB_HOST || 'localhost',
  port: parseInt(process.env.DB_PORT, 10) || 5432,
  database: process.env.DB_NAME || 'sukaczev',
  user: process.env.DB_USER || 'sukaczev',
  password: process.env.DB_PASSWORD,
  max: parseInt(process.env.DB_POOL_SIZE, 10) || 10,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 5000,
  application_name: 'comment_service'
});

pool.on('connect', () => {
  logger.debug('New database connection established');
});

pool.on('error', (err) => {
  logger.error('Unexpected database error on idle client:', err);
});

async function connectDatabase() {
  const client = await pool.connect();
  try {
    await client.query('SELECT NOW()');
    logger.info('Database connection verified');
  } finally {
    client.release();
  }
}

async function closeDatabase() {
  await pool.end();
  logger.info('Database pool closed');
}

async function query(text, params) {
  const start = Date.now();
  try {
    const result = await pool.query(text, params);
    const duration = Date.now() - start;
    logger.debug('Query executed', { duration, rows: result.rowCount });
    return result;
  } catch (error) {
    logger.error('Database query error:', { error: error.message, query: text });
    throw error;
  }
}

async function transaction(callback) {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const result = await callback(client);
    await client.query('COMMIT');
    return result;
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
}

async function initDatabase() {
  const createTableSQL = `
    CREATE TABLE IF NOT EXISTS comments (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      video_id UUID NOT NULL,
      user_id UUID NOT NULL,
      parent_id UUID REFERENCES comments(id) ON DELETE CASCADE,
      content TEXT NOT NULL CHECK (LENGTH(content) <= 2000),
      likes_count INT DEFAULT 0 CHECK (likes_count >= 0),
      replies_count INT DEFAULT 0 CHECK (replies_count >= 0),
      created_at TIMESTAMPTZ DEFAULT NOW(),
      updated_at TIMESTAMPTZ DEFAULT NOW()
    );

    CREATE INDEX IF NOT EXISTS idx_comments_video_id 
      ON comments(video_id);
    CREATE INDEX IF NOT EXISTS idx_comments_parent_id 
      ON comments(parent_id) WHERE parent_id IS NOT NULL;
    CREATE INDEX IF NOT EXISTS idx_comments_created 
      ON comments(created_at DESC);
    CREATE INDEX IF NOT EXISTS idx_comments_video_created 
      ON comments(video_id, created_at DESC);

    CREATE TABLE IF NOT EXISTS comment_likes (
      id BIGSERIAL PRIMARY KEY,
      comment_id UUID NOT NULL REFERENCES comments(id) ON DELETE CASCADE,
      user_id UUID NOT NULL,
      created_at TIMESTAMPTZ DEFAULT NOW(),
      UNIQUE(comment_id, user_id)
    );

    CREATE INDEX IF NOT EXISTS idx_comment_likes_comment_id 
      ON comment_likes(comment_id);
    CREATE INDEX IF NOT EXISTS idx_comment_likes_user_id 
      ON comment_likes(user_id);

    -- Function to update updated_at
    CREATE OR REPLACE FUNCTION update_updated_at_column()
    RETURNS TRIGGER AS $$
    BEGIN
      NEW.updated_at = NOW();
      RETURN NEW;
    END;
    $$ language 'plpgsql';

    -- Drop if exists to avoid error
    DROP TRIGGER IF EXISTS update_comments_updated_at ON comments;
    
    CREATE TRIGGER update_comments_updated_at
      BEFORE UPDATE ON comments
      FOR EACH ROW
      EXECUTE FUNCTION update_updated_at_column();
  `;

  try {
    await query(createTableSQL);
    logger.info('Database tables initialized');
  } catch (error) {
    logger.error('Failed to initialize database tables:', error);
    throw error;
  }
}

module.exports = {
  pool,
  connectDatabase,
  closeDatabase,
  query,
  transaction,
  initDatabase
};
