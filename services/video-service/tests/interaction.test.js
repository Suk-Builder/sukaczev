/**
 * @fileoverview Interaction tests - Like, coin, favorite, view operations.
 */

const request = require('supertest');
const { app } = require('../src/app');
const Video = require('../src/models/Video');
const redis = require('../src/config/redis');
const {
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
} = require('./setup');

describe('Video Interaction Endpoints', () => {
  let testUserId;
  let authToken;
  let otherUserId;
  let otherToken;

  beforeAll(async () => {
    await setupTestDatabase();
    await mockRabbitMQ();
    testUserId = generateUUID();
    authToken = generateTestToken(testUserId);
    otherUserId = generateUUID();
    otherToken = generateTestToken(otherUserId);
  });

  beforeEach(async () => {
    await cleanupTestData();
    await cleanupRedis();
  });

  afterAll(async () => {
    await cleanupTestData();
    await cleanupRedis();
    restoreRabbitMQ();
  });

  // ============================================================
  // POST /api/videos/:id/view
  // ============================================================

  describe('POST /api/videos/:id/view', () => {
    test('should record a view', async () => {
      const video = await createTestVideo({ status: 'published' });

      const res = await request(app)
        .post(`/api/videos/${video.id}/view`);

      expect(res.status).toBe(200);
      expect(res.body.data.viewsCount).toBe(1);
    });

    test('should increment view count', async () => {
      const video = await createTestVideo({ status: 'published' });

      await request(app).post(`/api/videos/${video.id}/view`);
      const res = await request(app).post(`/api/videos/${video.id}/view`);

      expect(res.status).toBe(200);
      expect(res.body.data.viewsCount).toBe(2);
    });

    test('should return 404 for non-existent video', async () => {
      const res = await request(app)
        .post(`/api/videos/${generateUUID()}/view`);

      expect(res.status).toBe(404);
    });

    test('should not require authentication', async () => {
      const video = await createTestVideo({ status: 'published' });

      const res = await request(app)
        .post(`/api/videos/${video.id}/view`);

      expect(res.status).toBe(200);
    });
  });

  // ============================================================
  // POST /api/videos/:id/like
  // ============================================================

  describe('POST /api/videos/:id/like', () => {
    test('should like a video', async () => {
      const video = await createTestVideo({ status: 'published' });

      const res = await request(app)
        .post(`/api/videos/${video.id}/like`)
        .set(getAuthHeaders(authToken));

      expect(res.status).toBe(201);
      expect(res.body.success).toBe(true);
      expect(res.body.data.video_id).toBe(video.id);
      expect(res.body.data.user_id).toBe(testUserId);
    });

    test('should increment like count', async () => {
      const video = await createTestVideo({ status: 'published' });

      await request(app)
        .post(`/api/videos/${video.id}/like`)
        .set(getAuthHeaders(authToken));

      const updated = await Video.findById(video.id);
      expect(updated.likes_count).toBe(1);
    });

    test('should require authentication', async () => {
      const video = await createTestVideo({ status: 'published' });

      const res = await request(app)
        .post(`/api/videos/${video.id}/like`);

      expect(res.status).toBe(401);
    });

    test('should reject duplicate like', async () => {
      const video = await createTestVideo({ status: 'published' });

      await request(app)
        .post(`/api/videos/${video.id}/like`)
        .set(getAuthHeaders(authToken));

      const res = await request(app)
        .post(`/api/videos/${video.id}/like`)
        .set(getAuthHeaders(authToken));

      expect(res.status).toBe(409);
      expect(res.body.error.code).toBe('ALREADY_LIKED');
    });

    test('should allow different users to like same video', async () => {
      const video = await createTestVideo({ status: 'published' });

      const res1 = await request(app)
        .post(`/api/videos/${video.id}/like`)
        .set(getAuthHeaders(authToken));

      const res2 = await request(app)
        .post(`/api/videos/${video.id}/like`)
        .set(getAuthHeaders(otherToken));

      expect(res1.status).toBe(201);
      expect(res2.status).toBe(201);

      const updated = await Video.findById(video.id);
      expect(updated.likes_count).toBe(2);
    });

    test('should return 404 for non-existent video', async () => {
      const res = await request(app)
        .post(`/api/videos/${generateUUID()}/like`)
        .set(getAuthHeaders(authToken));

      expect(res.status).toBe(404);
    });
  });

  // ============================================================
  // DELETE /api/videos/:id/like
  // ============================================================

  describe('DELETE /api/videos/:id/like', () => {
    test('should unlike a video', async () => {
      const video = await createTestVideo({ status: 'published' });

      await request(app)
        .post(`/api/videos/${video.id}/like`)
        .set(getAuthHeaders(authToken));

      const res = await request(app)
        .delete(`/api/videos/${video.id}/like`)
        .set(getAuthHeaders(authToken));

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
    });

    test('should decrement like count', async () => {
      const video = await createTestVideo({ status: 'published' });

      await request(app)
        .post(`/api/videos/${video.id}/like`)
        .set(getAuthHeaders(authToken));

      await request(app)
        .delete(`/api/videos/${video.id}/like`)
        .set(getAuthHeaders(authToken));

      const updated = await Video.findById(video.id);
      expect(updated.likes_count).toBe(0);
    });

    test('should return 404 if not liked', async () => {
      const video = await createTestVideo({ status: 'published' });

      const res = await request(app)
        .delete(`/api/videos/${video.id}/like`)
        .set(getAuthHeaders(authToken));

      expect(res.status).toBe(404);
      expect(res.body.error.code).toBe('NOT_LIKED');
    });

    test('should require authentication', async () => {
      const video = await createTestVideo({ status: 'published' });

      const res = await request(app)
        .delete(`/api/videos/${video.id}/like`);

      expect(res.status).toBe(401);
    });
  });

  // ============================================================
  // POST /api/videos/:id/favorite
  // ============================================================

  describe('POST /api/videos/:id/favorite', () => {
    test('should favorite a video', async () => {
      const video = await createTestVideo({ status: 'published' });

      const res = await request(app)
        .post(`/api/videos/${video.id}/favorite`)
        .set(getAuthHeaders(authToken));

      expect(res.status).toBe(201);
      expect(res.body.success).toBe(true);
      expect(res.body.data.video_id).toBe(video.id);
    });

    test('should increment favorites count', async () => {
      const video = await createTestVideo({ status: 'published' });

      await request(app)
        .post(`/api/videos/${video.id}/favorite`)
        .set(getAuthHeaders(authToken));

      const updated = await Video.findById(video.id);
      expect(updated.favorites_count).toBe(1);
    });

    test('should require authentication', async () => {
      const video = await createTestVideo({ status: 'published' });

      const res = await request(app)
        .post(`/api/videos/${video.id}/favorite`);

      expect(res.status).toBe(401);
    });

    test('should reject duplicate favorite', async () => {
      const video = await createTestVideo({ status: 'published' });

      await request(app)
        .post(`/api/videos/${video.id}/favorite`)
        .set(getAuthHeaders(authToken));

      const res = await request(app)
        .post(`/api/videos/${video.id}/favorite`)
        .set(getAuthHeaders(authToken));

      expect(res.status).toBe(409);
      expect(res.body.error.code).toBe('ALREADY_FAVORITED');
    });
  });

  // ============================================================
  // DELETE /api/videos/:id/favorite
  // ============================================================

  describe('DELETE /api/videos/:id/favorite', () => {
    test('should unfavorite a video', async () => {
      const video = await createTestVideo({ status: 'published' });

      await request(app)
        .post(`/api/videos/${video.id}/favorite`)
        .set(getAuthHeaders(authToken));

      const res = await request(app)
        .delete(`/api/videos/${video.id}/favorite`)
        .set(getAuthHeaders(authToken));

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
    });

    test('should decrement favorites count', async () => {
      const video = await createTestVideo({ status: 'published' });

      await request(app)
        .post(`/api/videos/${video.id}/favorite`)
        .set(getAuthHeaders(authToken));

      await request(app)
        .delete(`/api/videos/${video.id}/favorite`)
        .set(getAuthHeaders(authToken));

      const updated = await Video.findById(video.id);
      expect(updated.favorites_count).toBe(0);
    });

    test('should return 404 if not favorited', async () => {
      const video = await createTestVideo({ status: 'published' });

      const res = await request(app)
        .delete(`/api/videos/${video.id}/favorite`)
        .set(getAuthHeaders(authToken));

      expect(res.status).toBe(404);
    });

    test('should require authentication', async () => {
      const video = await createTestVideo({ status: 'published' });

      const res = await request(app)
        .delete(`/api/videos/${video.id}/favorite`);

      expect(res.status).toBe(401);
    });
  });

  // ============================================================
  // POST /api/videos/:id/coin
  // ============================================================

  describe('POST /api/videos/:id/coin', () => {
    test('should drop 1 coin', async () => {
      const video = await createTestVideo({ status: 'published' });

      const res = await request(app)
        .post(`/api/videos/${video.id}/coin`)
        .set(getAuthHeaders(authToken))
        .send({ count: 1 });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.count).toBe(1);
    });

    test('should drop 2 coins', async () => {
      const video = await createTestVideo({ status: 'published' });

      const res = await request(app)
        .post(`/api/videos/${video.id}/coin`)
        .set(getAuthHeaders(authToken))
        .send({ count: 2 });

      expect(res.status).toBe(200);
      expect(res.body.data.count).toBe(2);
    });

    test('should increment coins count', async () => {
      const video = await createTestVideo({ status: 'published' });

      await request(app)
        .post(`/api/videos/${video.id}/coin`)
        .set(getAuthHeaders(authToken))
        .send({ count: 2 });

      const updated = await Video.findById(video.id);
      expect(updated.coins_count).toBe(2);
    });

    test('should require authentication', async () => {
      const video = await createTestVideo({ status: 'published' });

      const res = await request(app)
        .post(`/api/videos/${video.id}/coin`)
        .send({ count: 1 });

      expect(res.status).toBe(401);
    });

    test('should default to 1 coin if count not provided', async () => {
      const video = await createTestVideo({ status: 'published' });

      const res = await request(app)
        .post(`/api/videos/${video.id}/coin`)
        .set(getAuthHeaders(authToken))
        .send({});

      expect(res.status).toBe(200);
      expect(res.body.data.count).toBe(1);
    });

    test('should reject 0 coins', async () => {
      const video = await createTestVideo({ status: 'published' });

      const res = await request(app)
        .post(`/api/videos/${video.id}/coin`)
        .set(getAuthHeaders(authToken))
        .send({ count: 0 });

      expect(res.status).toBe(400);
    });

    test('should reject 3 coins', async () => {
      const video = await createTestVideo({ status: 'published' });

      const res = await request(app)
        .post(`/api/videos/${video.id}/coin`)
        .set(getAuthHeaders(authToken))
        .send({ count: 3 });

      expect(res.status).toBe(400);
    });

    test('should reject negative coin count', async () => {
      const video = await createTestVideo({ status: 'published' });

      const res = await request(app)
        .post(`/api/videos/${video.id}/coin`)
        .set(getAuthHeaders(authToken))
        .send({ count: -1 });

      expect(res.status).toBe(400);
    });

    test('should allow cumulative coins up to 2', async () => {
      const video = await createTestVideo({ status: 'published' });

      // First drop 1 coin
      await request(app)
        .post(`/api/videos/${video.id}/coin`)
        .set(getAuthHeaders(authToken))
        .send({ count: 1 });

      // Then drop 1 more coin
      const res = await request(app)
        .post(`/api/videos/${video.id}/coin`)
        .set(getAuthHeaders(authToken))
        .send({ count: 1 });

      expect(res.status).toBe(200);
      expect(res.body.data.count).toBe(2);
    });

    test('should reject coins exceeding max of 2', async () => {
      const video = await createTestVideo({ status: 'published' });

      // First drop 2 coins
      await request(app)
        .post(`/api/videos/${video.id}/coin`)
        .set(getAuthHeaders(authToken))
        .send({ count: 2 });

      // Try to drop 1 more
      const res = await request(app)
        .post(`/api/videos/${video.id}/coin`)
        .set(getAuthHeaders(authToken))
        .send({ count: 1 });

      expect(res.status).toBe(400);
      expect(res.body.error.code).toBe('MAX_COINS_REACHED');
    });

    test('should allow different users to coin same video', async () => {
      const video = await createTestVideo({ status: 'published' });

      const res1 = await request(app)
        .post(`/api/videos/${video.id}/coin`)
        .set(getAuthHeaders(authToken))
        .send({ count: 2 });

      const res2 = await request(app)
        .post(`/api/videos/${video.id}/coin`)
        .set(getAuthHeaders(otherToken))
        .send({ count: 2 });

      expect(res1.status).toBe(200);
      expect(res2.status).toBe(200);

      const updated = await Video.findById(video.id);
      expect(updated.coins_count).toBe(4);
    });

    test('should return 404 for non-existent video', async () => {
      const res = await request(app)
        .post(`/api/videos/${generateUUID()}/coin`)
        .set(getAuthHeaders(authToken))
        .send({ count: 1 });

      expect(res.status).toBe(404);
    });
  });

  // ============================================================
  // Combined Interactions
  // ============================================================

  describe('Combined Interactions', () => {
    test('should track like, favorite, and coin independently', async () => {
      const video = await createTestVideo({ status: 'published' });

      // Like
      await request(app)
        .post(`/api/videos/${video.id}/like`)
        .set(getAuthHeaders(authToken));

      // Favorite
      await request(app)
        .post(`/api/videos/${video.id}/favorite`)
        .set(getAuthHeaders(authToken));

      // Coin
      await request(app)
        .post(`/api/videos/${video.id}/coin`)
        .set(getAuthHeaders(authToken))
        .send({ count: 2 });

      // View
      await request(app)
        .post(`/api/videos/${video.id}/view`);

      // Check stats
      const updated = await Video.findById(video.id);
      expect(updated.likes_count).toBe(1);
      expect(updated.favorites_count).toBe(1);
      expect(updated.coins_count).toBe(2);
      expect(updated.views_count).toBe(1);

      // Check interaction status
      const statusRes = await request(app)
        .get(`/api/videos/${video.id}`)
        .set(getAuthHeaders(authToken));

      expect(statusRes.body.data.interaction.liked).toBe(true);
      expect(statusRes.body.data.interaction.favorited).toBe(true);
      expect(statusRes.body.data.interaction.coinCount).toBe(2);
    });

    test('interaction status should be null for unauthenticated user', async () => {
      const video = await createTestVideo({ status: 'published' });

      const res = await request(app)
        .get(`/api/videos/${video.id}`);

      expect(res.body.data.interaction).toBeNull();
    });
  });
});
