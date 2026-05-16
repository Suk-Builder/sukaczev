/**
 * @fileoverview Test setup and utilities for video-service.
 */

const { initDatabase, seedDefaultCategories } = require('../src/config/db');
const redis = require('../src/config/redis');
const rabbitmq = require('../src/config/rabbitmq');

/**
 * Sets up test environment.
 */
async function setupTestDatabase() {
  process.env.NODE_ENV = 'test';
  process.env.JWT_ACCESS_SECRET = 'test-access-secret-key';
  process.env.JWT_REFRESH_SECRET = 'test-refresh-secret-key';
  process.env.LOG_LEVEL = 'error';

  await initDatabase();
  await seedDefaultCategories();
}

/**
 * Cleans up test data.
 */
async function cleanupTestData() {
  const { pool } = require('../src/config/db');
  try {
    await pool.query('TRUNCATE TABLE video_likes, video_favorites, coin_drops CASCADE');
    await pool.query('TRUNCATE TABLE videos CASCADE');
    // Don't truncate categories since they have seeded data
  } catch (err) {
    // Ignore
  }
}

/**
 * Cleans up Redis.
 */
async function cleanupRedis() {
  try {
    const keys = await redis.redis.keys('video_svc:*');
    if (keys.length > 0) {
      await redis.redis.del(...keys);
    }
  } catch (err) {
    // Redis may not be available
  }
}

/**
 * Creates a test video.
 */
async function createTestVideo(overrides = {}) {
  const { query } = require('../src/config/db');
  const uuid = () => 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    return (c === 'x' ? r : (r & 0x3) | 0x8).toString(16);
  });

  const defaultVideo = {
    userId: overrides.userId || uuid(),
    title: overrides.title || `Test Video ${Date.now()}`,
    description: overrides.description || 'Test video description',
    videoUrl: overrides.videoUrl || 'https://example.com/video.mp4',
    thumbnailUrl: overrides.thumbnailUrl || 'https://example.com/thumb.jpg',
    duration: overrides.duration || 120,
    categoryId: overrides.categoryId || 1,
    status: overrides.status || 'published',
  };

  const sql = `
    INSERT INTO videos (user_id, title, description, video_url, thumbnail_url, duration, category_id, status, published_at)
    VALUES ($1, $2, $3, $4, $5, $6, $7, $8, CASE WHEN $8 = 'published' THEN CURRENT_TIMESTAMP ELSE NULL END)
    RETURNING id, user_id, title, description, video_url, thumbnail_url, duration, views_count, likes_count, coins_count, favorites_count, danmaku_count, comments_count, category_id, status, published_at, created_at, updated_at
  `;

  const result = await query(sql, [
    defaultVideo.userId,
    defaultVideo.title,
    defaultVideo.description,
    defaultVideo.videoUrl,
    defaultVideo.thumbnailUrl,
    defaultVideo.duration,
    defaultVideo.categoryId,
    defaultVideo.status,
  ]);

  return result.rows[0];
}

/**
 * Creates multiple test videos.
 */
async function createTestVideos(count, overrides = {}) {
  const videos = [];
  for (let i = 0; i < count; i++) {
    videos.push(await createTestVideo({
      ...overrides,
      title: overrides.title || `Test Video ${i}_${Date.now()}`,
    }));
  }
  return videos;
}

/**
 * Generates a UUID.
 */
function generateUUID() {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    return (c === 'x' ? r : (r & 0x3) | 0x8).toString(16);
  });
}

/**
 * Generates a test JWT token.
 */
function generateTestToken(userId, username = 'testuser') {
  const jwt = require('jsonwebtoken');
  return jwt.sign(
    { userId, username, level: 0 },
    process.env.JWT_ACCESS_SECRET,
    { expiresIn: '15m', issuer: 'sukaczev-user-service', audience: 'sukaczev-api' }
  );
}

/**
 * Gets auth headers for test requests.
 */
function getAuthHeaders(token) {
  return { Authorization: `Bearer ${token}` };
}

/**
 * Mocks RabbitMQ functions.
 */
function mockRabbitMQ() {
  jest.spyOn(rabbitmq, 'publish').mockResolvedValue(true);
  jest.spyOn(rabbitmq, 'publishVideoUploaded').mockResolvedValue(true);
  jest.spyOn(rabbitmq, 'publishVideoPublished').mockResolvedValue(true);
  jest.spyOn(rabbitmq, 'publishVideoLiked').mockResolvedValue(true);
  jest.spyOn(rabbitmq, 'publishVideoUnliked').mockResolvedValue(true);
}

/**
 * Restores RabbitMQ mocks.
 */
function restoreRabbitMQ() {
  jest.restoreAllMocks();
}

/**
 * Waits for specified milliseconds.
 */
function wait(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

module.exports = {
  setupTestDatabase,
  cleanupTestData,
  cleanupRedis,
  createTestVideo,
  createTestVideos,
  generateUUID,
  generateTestToken,
  getAuthHeaders,
  mockRabbitMQ,
  restoreRabbitMQ,
  wait,
};
