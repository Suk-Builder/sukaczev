/**
 * @fileoverview Database configuration and connection pool for user-service.
 * Uses PostgreSQL with pg-pool for connection management.
 */

const { Pool } = require('pg');
const logger = require('../services/loggerService');

/**
 * PostgreSQL connection pool instance.
 * Configured via environment variables with sensible defaults.
 */
const pool = new Pool({
  host: process.env.DB_HOST || 'localhost',
  port: parseInt(process.env.DB_PORT || '5432', 10),
  database: process.env.DB_NAME || 'sukaczev_users',
  user: process.env.DB_USER || 'postgres',
  password: process.env.DB_PASSWORD,
  max: parseInt(process.env.DB_POOL_MAX || '12', 10),
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 5000,
});

/**
 * Event listener for pool errors.
 * Logs unexpected errors on idle clients.
 */
pool.on('error', (err) => {
  logger.error('Unexpected database pool error', { error: err.message, stack: err.stack });
});

/**
 * Event listener for successful connection.
 * Logs database connection status.
 */
pool.on('connect', () => {
  logger.debug('New database client connected');
});

/**
 * Initializes database tables if they don't exist.
 * Creates users and follows tables with proper constraints.
 *
 * @async
 * @returns {Promise<void>}
 */
async function initDatabase() {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    // Create users table
    await client.query(`
      CREATE TABLE IF NOT EXISTS users (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        username VARCHAR(20) UNIQUE NOT NULL,
        email VARCHAR(255) UNIQUE NOT NULL,
        password_hash VARCHAR(255) NOT NULL,
        display_name VARCHAR(50),
        avatar_url TEXT,
        bio VARCHAR(500) DEFAULT '',
        level SMALLINT DEFAULT 0 CHECK (level >= 0 AND level <= 6),
        exp INTEGER DEFAULT 0 CHECK (exp >= 0),
        coins INTEGER DEFAULT 0 CHECK (coins >= 0),
        followers_count INTEGER DEFAULT 0 CHECK (followers_count >= 0),
        following_count INTEGER DEFAULT 0 CHECK (following_count >= 0),
        created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
        CONSTRAINT username_length CHECK (char_length(username) >= 2 AND char_length(username) <= 20)
      );

      CREATE INDEX IF NOT EXISTS idx_users_username ON users(username);
      CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);
      CREATE INDEX IF NOT EXISTS idx_users_level ON users(level);
      CREATE INDEX IF NOT EXISTS idx_users_created_at ON users(created_at);
    `);

    // Create follows table
    await client.query(`
      CREATE TABLE IF NOT EXISTS follows (
        id SERIAL PRIMARY KEY,
        follower_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        following_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
        UNIQUE(follower_id, following_id),
        CONSTRAINT no_self_follow CHECK (follower_id <> following_id)
      );

      CREATE INDEX IF NOT EXISTS idx_follows_follower ON follows(follower_id);
      CREATE INDEX IF NOT EXISTS idx_follows_following ON follows(following_id);
      CREATE INDEX IF NOT EXISTS idx_follows_created_at ON follows(created_at);
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

      DROP TRIGGER IF EXISTS update_users_updated_at ON users;
      CREATE TRIGGER update_users_updated_at
        BEFORE UPDATE ON users
        FOR EACH ROW
        EXECUTE FUNCTION update_updated_at_column();
    `);

    await client.query('COMMIT');
    logger.info('Database initialized successfully');
  } catch (err) {
    await client.query('ROLLBACK');
    logger.error('Database initialization failed', { error: err.message });
    throw err;
  } finally {
    client.release();
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
  closePool,
};
