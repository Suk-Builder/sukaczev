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
  application_name: 'danmaku_service'
});

pool.on('connect', (client) => {
  logger.debug('New database connection established');
});

pool.on('error', (err, client) => {
  logger.error('Unexpected database error on idle client:', err);
});

pool.on('remove', () => {
  logger.debug('Database connection removed from pool');
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
    CREATE TABLE IF NOT EXISTS danmakus (
      id BIGSERIAL PRIMARY KEY,
      video_id UUID NOT NULL,
      user_id UUID NOT NULL,
      content TEXT NOT NULL CHECK (LENGTH(content) <= 100),
      time_point FLOAT NOT NULL CHECK (time_point >= 0),
      color VARCHAR(7) DEFAULT '#FFFFFF' CHECK (color ~ '^#[0-9A-Fa-f]{6}$'),
      type INT DEFAULT 0 CHECK (type IN (0, 1, 2)),
      font_size INT DEFAULT 25 CHECK (font_size BETWEEN 10 AND 100),
      created_at TIMESTAMPTZ DEFAULT NOW()
    );

    CREATE INDEX IF NOT EXISTS idx_danmakus_video_time 
      ON danmakus(video_id, time_point);
    CREATE INDEX IF NOT EXISTS idx_danmakus_created 
      ON danmakus(created_at DESC);
    CREATE INDEX IF NOT EXISTS idx_danmakus_video_id 
      ON danmakus(video_id);
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
