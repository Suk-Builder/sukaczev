/**
 * @fileoverview Integration tests - End-to-end workflows for video-service.
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

describe('Integration Tests', () => {
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
  // Complete Video Lifecycle
  // ============================================================

  describe('Complete Video Lifecycle', () => {
    test('full lifecycle: create -> publish -> like -> coin -> delete', async () => {
      // Create video as draft
      const createRes = await request(app)
        .post('/api/videos')
        .set(getAuthHeaders(authToken))
        .send({
          title: 'Lifecycle Video',
          description: 'Full lifecycle test',
          videoUrl: 'https://example.com/video.mp4',
          duration: 300,
          categoryId: 1,
          status: 'draft',
        });

      expect(createRes.status).toBe(201);
      const videoId = createRes.body.data.video.id;

      // Verify it's a draft
      expect(createRes.body.data.video.status).toBe('draft');

      // Publish the video
      const publishRes = await request(app)
        .put(`/api/videos/${videoId}`)
        .set(getAuthHeaders(authToken))
        .send({ status: 'published' });

      expect(publishRes.status).toBe(200);
      expect(publishRes.body.data.video.status).toBe('published');

      // View the video
      const viewRes = await request(app)
        .post(`/api/videos/${videoId}/view`);

      expect(viewRes.status).toBe(200);
      expect(viewRes.body.data.viewsCount).toBe(1);

      // Like the video
      const likeRes = await request(app)
        .post(`/api/videos/${videoId}/like`)
        .set(getAuthHeaders(authToken));

      expect(likeRes.status).toBe(201);

      // Favorite the video
      const favRes = await request(app)
        .post(`/api/videos/${videoId}/favorite`)
        .set(getAuthHeaders(authToken));

      expect(favRes.status).toBe(201);

      // Drop coins
      const coinRes = await request(app)
        .post(`/api/videos/${videoId}/coin`)
        .set(getAuthHeaders(authToken))
        .send({ count: 2 });

      expect(coinRes.status).toBe(200);
      expect(coinRes.body.data.count).toBe(2);

      // Verify all interactions
      const getRes = await request(app)
        .get(`/api/videos/${videoId}`)
        .set(getAuthHeaders(authToken));

      expect(getRes.body.data.video.views_count).toBe(1);
      expect(getRes.body.data.video.likes_count).toBe(1);
      expect(getRes.body.data.video.favorites_count).toBe(1);
      expect(getRes.body.data.video.coins_count).toBe(2);
      expect(getRes.body.data.interaction.liked).toBe(true);
      expect(getRes.body.data.interaction.favorited).toBe(true);
      expect(getRes.body.data.interaction.coinCount).toBe(2);

      // Delete the video
      const delRes = await request(app)
        .delete(`/api/videos/${videoId}`)
        .set(getAuthHeaders(authToken));

      expect(delRes.status).toBe(200);

      // Verify deletion
      const checkRes = await request(app).get(`/api/videos/${videoId}`);
      expect(checkRes.status).toBe(404);
    });

    test('draft to published to listed flow', async () => {
      // Create draft
      const createRes = await request(app)
        .post('/api/videos')
        .set(getAuthHeaders(authToken))
        .send({
          title: 'Draft Flow',
          videoUrl: 'https://example.com/draft.mp4',
          status: 'draft',
        });

      const videoId = createRes.body.data.video.id;

      // Draft should not appear in public list
      const listBefore = await request(app).get('/api/videos');
      const foundBefore = listBefore.body.data.videos.find((v) => v.id === videoId);
      expect(foundBefore).toBeUndefined();

      // Publish
      await request(app)
        .put(`/api/videos/${videoId}`)
        .set(getAuthHeaders(authToken))
        .send({ status: 'published' });

      // Now should appear in list
      const listAfter = await request(app).get('/api/videos');
      const foundAfter = listAfter.body.data.videos.find((v) => v.id === videoId);
      expect(foundAfter).toBeDefined();
    });
  });

  // ============================================================
  // Multi-User Interaction Flows
  // ============================================================

  describe('Multi-User Interaction Flows', () => {
    test('multiple users interacting with same video', async () => {
      // Create video
      const video = await createTestVideo({ status: 'published', userId: testUserId });

      const users = [
        { id: generateUUID(), name: 'user1' },
        { id: generateUUID(), name: 'user2' },
        { id: generateUUID(), name: 'user3' },
      ];

      // Each user likes, favorites, and coins
      for (const user of users) {
        const token = generateTestToken(user.id);

        await request(app)
          .post(`/api/videos/${video.id}/view`);

        await request(app)
          .post(`/api/videos/${video.id}/like`)
          .set(getAuthHeaders(token));

        await request(app)
          .post(`/api/videos/${video.id}/favorite`)
          .set(getAuthHeaders(token));

        await request(app)
          .post(`/api/videos/${video.id}/coin`)
          .set(getAuthHeaders(token))
          .send({ count: 2 });
      }

      // Check final stats
      const statsRes = await request(app).get(`/api/videos/${video.id}`);
      expect(statsRes.body.data.video.views_count).toBe(3);
      expect(statsRes.body.data.video.likes_count).toBe(3);
      expect(statsRes.body.data.video.favorites_count).toBe(3);
      expect(statsRes.body.data.video.coins_count).toBe(6);
    });

    test('one user cannot affect another\'s interactions', async () => {
      const video = await createTestVideo({ status: 'published' });

      // User 1 likes
      await request(app)
        .post(`/api/videos/${video.id}/like`)
        .set(getAuthHeaders(authToken));

      // User 2 checks - should not be liked
      const checkRes = await request(app)
        .get(`/api/videos/${video.id}`)
        .set(getAuthHeaders(otherToken));

      expect(checkRes.body.data.interaction.liked).toBe(false);
    });
  });

  // ============================================================
  // Category + Video Combined Flows
  // ============================================================

  describe('Category + Video Combined Flows', () => {
    test('should filter videos by category', async () => {
      // Create videos in different categories
      const cat1Video = await createTestVideo({
        status: 'published',
        categoryId: 1,
        title: 'Anime Video',
      });
      const cat2Video = await createTestVideo({
        status: 'published',
        categoryId: 2,
        title: 'Music Video',
      });

      // Get category 1 videos
      const res1 = await request(app)
        .get('/api/videos')
        .query({ categoryId: 1 });

      expect(res1.body.data.videos.length).toBe(1);
      expect(res1.body.data.videos[0].id).toBe(cat1Video.id);

      // Get category 2 videos
      const res2 = await request(app)
        .get('/api/videos')
        .query({ categoryId: 2 });

      expect(res2.body.data.videos.length).toBe(1);
      expect(res2.body.data.videos[0].id).toBe(cat2Video.id);
    });

    test('should browse category tree and find videos', async () => {
      // Get categories
      const catRes = await request(app).get('/api/categories');
      const categories = catRes.body.data.categories;
      expect(categories.length).toBeGreaterThan(0);

      // Create video in first category
      const video = await createTestVideo({
        status: 'published',
        categoryId: categories[0].id,
      });

      // List videos in that category
      const listRes = await request(app)
        .get('/api/videos')
        .query({ categoryId: categories[0].id });

      expect(listRes.body.data.videos.length).toBe(1);
      expect(listRes.body.data.videos[0].id).toBe(video.id);
    });
  });

  // ============================================================
  // Pagination and Sorting Flows
  // ============================================================

  describe('Pagination and Sorting Flows', () => {
    test('should paginate through all videos', async () => {
      await createTestVideos(15, { status: 'published' });

      const allVideoIds = new Set();
      let cursor = null;
      let pageCount = 0;

      do {
        const res = await request(app)
          .get('/api/videos')
          .query({ limit: 5, cursor });

        expect(res.status).toBe(200);
        pageCount++;

        for (const video of res.body.data.videos) {
          allVideoIds.add(video.id);
        }

        cursor = res.body.data.pagination.nextCursor;
      } while (cursor);

      expect(allVideoIds.size).toBe(15);
      expect(pageCount).toBe(3);
    });

    test('should sort by different fields', async () => {
      // Create videos with different view counts
      const video1 = await createTestVideo({ status: 'published', title: 'Low' });
      const video2 = await createTestVideo({ status: 'published', title: 'High' });

      // Add views to video2
      for (let i = 0; i < 10; i++) {
        await request(app).post(`/api/videos/${video2.id}/view`);
      }
      // Add views to video1
      await request(app).post(`/api/videos/${video1.id}/view`);

      // Sort by views
      const res = await request(app)
        .get('/api/videos')
        .query({ sortBy: 'views_count', order: 'desc' });

      expect(res.status).toBe(200);
      expect(res.body.data.videos.length).toBe(2);
    });
  });

  // ============================================================
  // Error Recovery Flows
  // ============================================================

  describe('Error Recovery Flows', () => {
    test('should handle invalid video ID', async () => {
      const res = await request(app)
        .get('/api/videos/invalid-uuid');

      expect(res.status).toBe(400);
    });

    test('should handle non-existent video', async () => {
      const res = await request(app)
        .get(`/api/videos/${generateUUID()}`);

      expect(res.status).toBe(404);
    });

    test('should handle unauthorized operations', async () => {
      const video = await createTestVideo({ userId: otherUserId });

      const res = await request(app)
        .put(`/api/videos/${video.id}`)
        .set(getAuthHeaders(authToken))
        .send({ title: 'Hacked' });

      expect(res.status).toBe(403);
    });

    test('should handle rapid requests', async () => {
      const video = await createTestVideo({ status: 'published' });

      const requests = Array.from({ length: 20 }, () =>
        request(app).post(`/api/videos/${video.id}/view`)
      );

      const results = await Promise.all(requests);
      results.forEach((res) => {
        expect(res.status).toBe(200);
      });

      const finalRes = await request(app).get(`/api/videos/${video.id}`);
      expect(finalRes.body.data.video.views_count).toBe(20);
    });
  });

  // ============================================================
  // Caching Flows
  // ============================================================

  describe('Caching Flows', () => {
    test('should cache and retrieve video', async () => {
      const video = await createTestVideo({ status: 'published' });

      // First fetch
      await request(app).get(`/api/videos/${video.id}`);
      await wait(100);

      // Should be cached
      const cached = await redis.getCachedVideo(video.id);
      expect(cached).toBeDefined();
      expect(cached.id).toBe(video.id);
    });

    test('should invalidate cache on update', async () => {
      const video = await createTestVideo({ userId: testUserId, status: 'published' });

      // Fetch to cache
      await request(app).get(`/api/videos/${video.id}`);
      await wait(100);

      // Update
      await request(app)
        .put(`/api/videos/${video.id}`)
        .set(getAuthHeaders(authToken))
        .send({ title: 'Updated' });

      // Cache should be invalidated
      const cached = await redis.getCachedVideo(video.id);
      expect(cached).toBeNull();
    });

    test('should cache hot videos', async () => {
      await createTestVideos(5, { status: 'published' });

      await request(app).get('/api/videos/hot');
      await wait(100);

      const cached = await redis.getHotVideos();
      expect(cached).toBeDefined();
      expect(Array.isArray(cached)).toBe(true);
    });
  });

  // ============================================================
  // Health Check
  // ============================================================

  describe('Health Check', () => {
    test('should return health status', async () => {
      const res = await request(app).get('/health');

      expect(res.status).toBe(200);
      expect(res.body.data.service).toBe('video-service');
      expect(res.body.data.status).toBe('healthy');
    });

    test('should include timestamp and uptime', async () => {
      const res = await request(app).get('/health');

      expect(res.body.data.timestamp).toBeDefined();
      expect(res.body.data.uptime).toBeDefined();
    });
  });

  // ============================================================
  // Complex Scenarios
  // ============================================================

  describe('Complex Scenarios', () => {
    test('full platform simulation', async () => {
      // 1. Create multiple videos in different categories
      const videos = [];
      for (let i = 0; i < 5; i++) {
        const res = await request(app)
          .post('/api/videos')
          .set(getAuthHeaders(authToken))
          .send({
            title: `Platform Video ${i}`,
            videoUrl: `https://example.com/vid${i}.mp4`,
            categoryId: (i % 3) + 1,
            status: 'published',
            duration: 60 * (i + 1),
          });
        videos.push(res.body.data.video);
      }

      // 2. Multiple users view, like, favorite videos
      const users = Array.from({ length: 5 }, (_, i) => ({
        id: generateUUID(),
        token: generateTestToken(generateUUID()),
      }));

      for (const user of users) {
        for (const video of videos) {
          await request(app).post(`/api/videos/${video.id}/view`);

          if (Math.random() > 0.3) {
            await request(app)
              .post(`/api/videos/${video.id}/like`)
              .set(getAuthHeaders(user.token));
          }

          if (Math.random() > 0.5) {
            await request(app)
              .post(`/api/videos/${video.id}/favorite`)
              .set(getAuthHeaders(user.token));
          }

          if (Math.random() > 0.7) {
            await request(app)
              .post(`/api/videos/${video.id}/coin`)
              .set(getAuthHeaders(user.token))
              .send({ count: 1 });
          }
        }
      }

      // 3. Verify videos are listed
      const listRes = await request(app).get('/api/videos');
      expect(listRes.body.data.videos.length).toBe(5);

      // 4. Verify category filtering
      const catRes = await request(app)
        .get('/api/videos')
        .query({ categoryId: 1 });
      expect(catRes.body.data.videos.length).toBeGreaterThan(0);

      // 5. Get hot videos
      const hotRes = await request(app).get('/api/videos/hot');
      expect(hotRes.status).toBe(200);
      expect(hotRes.body.data.videos.length).toBeGreaterThan(0);

      // 6. Verify individual video stats
      for (const video of videos) {
        const res = await request(app).get(`/api/videos/${video.id}`);
        expect(res.status).toBe(200);
        expect(res.body.data.video.views_count).toBeGreaterThan(0);
      }
    });

    test('edge case: empty title after update', async () => {
      const video = await createTestVideo({ userId: testUserId });

      const res = await request(app)
        .put(`/api/videos/${video.id}`)
        .set(getAuthHeaders(authToken))
        .send({ title: '' });

      expect(res.status).toBe(400);
    });

    test('edge case: maximum duration', async () => {
      const res = await request(app)
        .post('/api/videos')
        .set(getAuthHeaders(authToken))
        .send({
          title: 'Long Video',
          videoUrl: 'https://example.com/long.mp4',
          duration: 86400, // 24 hours
          status: 'published',
        });

      expect(res.status).toBe(201);
      expect(res.body.data.video.duration).toBe(86400);
    });

    test('edge case: unicode in title', async () => {
      const res = await request(app)
        .post('/api/videos')
        .set(getAuthHeaders(authToken))
        .send({
          title: '🎬 测试视频 · アニメ | Special #1',
          videoUrl: 'https://example.com/unicode.mp4',
        });

      expect(res.status).toBe(201);
      expect(res.body.data.video.title).toBe('🎬 测试视频 · アニメ | Special #1');
    });
  });
});
