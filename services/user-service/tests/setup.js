/**
 * @fileoverview Test setup and utilities for user-service.
 * Provides shared test configuration, helpers, and mock utilities.
 */

const { pool, initDatabase } = require('../src/config/db');
const redis = require('../src/config/redis');
const rabbitmq = require('../src/config/rabbitmq');

/**
 * Test database name.
 */
const TEST_DB_NAME = 'sukaczev_users_test';

/**
 * Sets up test database connection.
 */
async function setupTestDatabase() {
  // Set test environment variables
  process.env.NODE_ENV = 'test';
  process.env.JWT_ACCESS_SECRET = 'test-access-secret-key-for-jwt-tokens';
  process.env.JWT_REFRESH_SECRET = 'test-refresh-secret-key-for-jwt-tokens';
  process.env.LOG_LEVEL = 'error';

  // Initialize database tables
  await initDatabase();
}

/**
 * Cleans up all test data from database.
 */
async function cleanupTestData() {
  try {
    await pool.query('TRUNCATE TABLE follows CASCADE');
    await pool.query('TRUNCATE TABLE users CASCADE');
  } catch (err) {
    // Ignore cleanup errors
  }
}

/**
 * Cleans up Redis test data.
 */
async function cleanupRedis() {
  try {
    const keys = await redis.redis.keys('user_svc:test:*');
    if (keys.length > 0) {
      await redis.redis.del(...keys);
    }
    // Also clean regular keys
    const allKeys = await redis.redis.keys('user_svc:*');
    if (allKeys.length > 0) {
      await redis.redis.del(...allKeys);
    }
  } catch (err) {
    // Redis may not be available in tests
  }
}

/**
 * Creates a test user directly in the database.
 *
 * @param {Object} overrides - Fields to override
 * @returns {Promise<Object>} Created test user
 */
async function createTestUser(overrides = {}) {
  const bcrypt = require('bcrypt');
  const { query } = require('../src/config/db');

  const defaultUser = {
    username: `testuser_${Date.now()}_${Math.random().toString(36).substring(2, 8)}`,
    email: `test_${Date.now()}_${Math.random().toString(36).substring(2, 8)}@example.com`,
    password: 'password123',
    displayName: 'Test User',
    bio: 'A test user for testing purposes',
    level: 0,
  };

  const userData = { ...defaultUser, ...overrides };
  const passwordHash = await bcrypt.hash(userData.password, 10);

  const sql = `
    INSERT INTO users (username, email, password_hash, display_name, bio, level)
    VALUES ($1, $2, $3, $4, $5, $6)
    RETURNING id, username, email, display_name, avatar_url, bio, level, exp, coins, followers_count, following_count, created_at, updated_at
  `;

  const result = await query(sql, [
    userData.username,
    userData.email,
    passwordHash,
    userData.displayName,
    userData.bio,
    userData.level,
  ]);

  return {
    ...result.rows[0],
    plainPassword: userData.password,
  };
}

/**
 * Creates multiple test users.
 *
 * @param {number} count - Number of users to create
 * @returns {Promise<Array>} Array of created test users
 */
async function createTestUsers(count) {
  const users = [];
  for (let i = 0; i < count; i++) {
    users.push(await createTestUser({
      username: `batchuser_${i}_${Date.now()}`,
      email: `batch_${i}_${Date.now()}@example.com`,
      displayName: `Batch User ${i}`,
    }));
  }
  return users;
}

/**
 * Creates a follow relationship between two test users.
 *
 * @param {string} followerId - Follower user ID
 * @param {string} followingId - Following user ID
 * @returns {Promise<Object>} Follow data
 */
async function createTestFollow(followerId, followingId) {
  const User = require('../src/models/User');
  return await User.follow(followerId, followingId);
}

/**
 * Generates auth headers for a user.
 *
 * @param {Object} tokens - Token object with accessToken
 * @returns {Object} Headers object with Authorization
 */
function getAuthHeaders(tokens) {
  return {
    Authorization: `Bearer ${tokens.accessToken}`,
  };
}

/**
 * Extracts token from response body.
 *
 * @param {Object} response - Supertest response
 * @returns {Object} Tokens object
 */
function extractTokens(response) {
  return response.body.data?.tokens;
}

/**
 * Mock RabbitMQ publish functions.
 */
function mockRabbitMQ() {
  jest.spyOn(rabbitmq, 'publish').mockResolvedValue(true);
  jest.spyOn(rabbitmq, 'publishUserCreated').mockResolvedValue(true);
  jest.spyOn(rabbitmq, 'publishUserUpdated').mockResolvedValue(true);
  jest.spyOn(rabbitmq, 'publishUserFollowed').mockResolvedValue(true);
  jest.spyOn(rabbitmq, 'publishUserUnfollowed').mockResolvedValue(true);
}

/**
 * Restore RabbitMQ mocks.
 */
function restoreRabbitMQ() {
  jest.restoreAllMocks();
}

/**
 * Generates valid UUID for testing.
 *
 * @returns {string} Random UUID
 */
function generateUUID() {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    const v = c === 'x' ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}

/**
 * Waits for specified milliseconds.
 *
 * @param {number} ms - Milliseconds to wait
 * @returns {Promise<void>}
 */
function wait(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

module.exports = {
  setupTestDatabase,
  cleanupTestData,
  cleanupRedis,
  createTestUser,
  createTestUsers,
  createTestFollow,
  getAuthHeaders,
  extractTokens,
  mockRabbitMQ,
  restoreRabbitMQ,
  generateUUID,
  wait,
  TEST_DB_NAME,
};
