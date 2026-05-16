/**
 * @fileoverview Video CRUD tests - Comprehensive test suite for video operations.
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

describe('Video CRUD Endpoints', () => {
  let testUserId;
  let authToken;

  beforeAll(async () => {
    await setupTestDatabase();
    await mockRabbitMQ();
    testUserId = generateUUID();
    authToken = generateTestToken(testUserId);
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
  // POST /api/videos - Create
  // ============================================================

  describe('POST /api/videos', () => {
    test('should create a video with valid data', async () => {
      const res = await request(app)
        .post('/api/videos')
        .set(getAuthHeaders(authToken))
        .send({
          title: 'Test Video',
          description: 'Test description',
          videoUrl: 'https://example.com/video.mp4',
          thumbnailUrl: 'https://example.com/thumb.jpg',
          duration: 120,
          categoryId: 1,
          status: 'published',
        });

      expect(res.status).toBe(201);
      expect(res.body.success).toBe(true);
      expect(res.body.data.video.id).toBeDefined();
      expect(res.body.data.video.title).toBe('Test Video');
      expect(res.body.data.video.user_id).toBe(testUserId);
    });

    test('should create a video with minimal data', async () => {
      const res = await request(app)
        .post('/api/videos')
        .set(getAuthHeaders(authToken))
        .send({
          title: 'Minimal Video',
          videoUrl: 'https://example.com/video.mp4',
        });

      expect(res.status).toBe(201);
      expect(res.body.data.video.title).toBe('Minimal Video');
      expect(res.body.data.video.status).toBe('draft');
    });

    test('should create draft video by default', async () => {
      const res = await request(app)
        .post('/api/videos')
        .set(getAuthHeaders(authToken))
        .send({
          title: 'Draft Video',
          videoUrl: 'https://example.com/video.mp4',
        });

      expect(res.body.data.video.status).toBe('draft');
      expect(res.body.data.video.published_at).toBeNull();
    });

    test('should reject missing title', async () => {
      const res = await request(app)
        .post('/api/videos')
        .set(getAuthHeaders(authToken))
        .send({ videoUrl: 'https://example.com/video.mp4' });

      expect(res.status).toBe(400);
      expect(res.body.errors).toBeDefined();
    });

    test('should reject missing videoUrl', async () => {
      const res = await request(app)
        .post('/api/videos')
        .set(getAuthHeaders(authToken))
        .send({ title: 'No URL' });

      expect(res.status).toBe(400);
      expect(res.body.errors).toBeDefined();
    });

    test('should reject invalid videoUrl', async () => {
      const res = await request(app)
        .post('/api/videos')
        .set(getAuthHeaders(authToken))
        .send({
          title: 'Bad URL',
          videoUrl: 'not-a-url',
        });

      expect(res.status).toBe(400);
    });

    test('should reject title exceeding 100 characters', async () => {
      const res = await request(app)
        .post('/api/videos')
        .set(getAuthHeaders(authToken))
        .send({
          title: 'a'.repeat(101),
          videoUrl: 'https://example.com/video.mp4',
        });

      expect(res.status).toBe(400);
    });

    test('should reject invalid status', async () => {
      const res = await request(app)
        .post('/api/videos')
        .set(getAuthHeaders(authToken))
        .send({
          title: 'Bad Status',
          videoUrl: 'https://example.com/video.mp4',
          status: 'invalid_status',
        });

      expect(res.status).toBe(400);
    });

    test('should reject invalid categoryId', async () => {
      const res = await request(app)
        .post('/api/videos')
        .set(getAuthHeaders(authToken))
        .send({
          title: 'Bad Category',
          videoUrl: 'https://example.com/video.mp4',
          categoryId: 'not-a-number',
        });

      expect(res.status).toBe(400);
    });

    test('should require authentication', async () => {
      const res = await request(app)
        .post('/api/videos')
        .send({
          title: 'No Auth',
          videoUrl: 'https://example.com/video.mp4',
        });

      expect(res.status).toBe(401);
    });

    test('should reject invalid token', async () => {
      const res = await request(app)
        .post('/api/videos')
        .set('Authorization', 'Bearer invalid-token')
        .send({
          title: 'Bad Token',
          videoUrl: 'https://example.com/video.mp4',
        });

      expect(res.status).toBe(401);
    });

    test('should reject empty request body', async () => {
      const res = await request(app)
        .post('/api/videos')
        .set(getAuthHeaders(authToken))
        .send({});

      expect(res.status).toBe(400);
    });
  });

  // ============================================================
  // GET /api/videos - List
  // ============================================================

  describe('GET /api/videos', () => {
    test('should list published videos', async () => {
      await createTestVideos(3, { status: 'published' });

      const res = await request(app).get('/api/videos');

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.videos.length).toBe(3);
    });

    test('should not include draft videos in default list', async () => {
      await createTestVideos(2, { status: 'published' });
      await createTestVideos(2, { status: 'draft' });

      const res = await request(app).get('/api/videos');

      expect(res.body.data.videos.length).toBe(2);
    });

    test('should support cursor-based pagination', async () => {
      await createTestVideos(5, { status: 'published' });

      const res1 = await request(app)
        .get('/api/videos')
        .query({ limit: 2 });

      expect(res1.status).toBe(200);
      expect(res1.body.data.videos).toHaveLength(2);
      expect(res1.body.data.pagination.hasMore).toBe(true);
      expect(res1.body.data.pagination.nextCursor).toBeDefined();

      // Fetch next page with cursor
      const res2 = await request(app)
        .get('/api/videos')
        .query({
          limit: 2,
          cursor: res1.body.data.pagination.nextCursor,
        });

      expect(res2.status).toBe(200);
      expect(res2.body.data.videos).toHaveLength(2);
    });

    test('should support limit parameter', async () => {
      await createTestVideos(10, { status: 'published' });

      const res = await request(app)
        .get('/api/videos')
        .query({ limit: 5 });

      expect(res.body.data.videos).toHaveLength(5);
      expect(res.body.data.pagination.limit).toBe(5);
    });

    test('should support category filter', async () => {
      await createTestVideo({ status: 'published', categoryId: 1, title: 'Cat 1' });
      await createTestVideo({ status: 'published', categoryId: 2, title: 'Cat 2' });

      const res = await request(app)
        .get('/api/videos')
        .query({ categoryId: 1 });

      expect(res.body.data.videos.length).toBe(1);
      expect(res.body.data.videos[0].title).toBe('Cat 1');
    });

    test('should support sort by views', async () => {
      await createTestVideo({ status: 'published', title: 'Low Views' });

      const res = await request(app)
        .get('/api/videos')
        .query({ sortBy: 'views_count', order: 'desc' });

      expect(res.status).toBe(200);
    });

    test('should support sort by likes', async () => {
      await createTestVideos(3, { status: 'published' });

      const res = await request(app)
        .get('/api/videos')
        .query({ sortBy: 'likes_count', order: 'desc' });

      expect(res.status).toBe(200);
    });

    test('should reject invalid limit', async () => {
      const res = await request(app)
        .get('/api/videos')
        .query({ limit: 101 });

      expect(res.status).toBe(400);
    });

    test('should return empty list when no videos', async () => {
      const res = await request(app).get('/api/videos');

      expect(res.status).toBe(200);
      expect(res.body.data.videos).toEqual([]);
      expect(res.body.data.pagination.total).toBe(0);
    });

    test('should include pagination metadata', async () => {
      await createTestVideos(5, { status: 'published' });

      const res = await request(app)
        .get('/api/videos')
        .query({ limit: 2 });

      expect(res.body.data.pagination.total).toBe(5);
      expect(res.body.data.pagination.limit).toBe(2);
      expect(res.body.data.pagination.hasMore).toBe(true);
      expect(res.body.data.pagination.nextCursor).toBeDefined();
    });
  });

  // ============================================================
  // GET /api/videos/:id - Get by ID
  // ============================================================

  describe('GET /api/videos/:id', () => {
    test('should get video by ID', async () => {
      const video = await createTestVideo({ status: 'published' });

      const res = await request(app).get(`/api/videos/${video.id}`);

      expect(res.status).toBe(200);
      expect(res.body.data.video.id).toBe(video.id);
      expect(res.body.data.video.title).toBe(video.title);
    });

    test('should include interaction status for authenticated user', async () => {
      const video = await createTestVideo({ status: 'published' });

      const res = await request(app)
        .get(`/api/videos/${video.id}`)
        .set(getAuthHeaders(authToken));

      expect(res.status).toBe(200);
      expect(res.body.data.interaction).toBeDefined();
      expect(res.body.data.interaction.liked).toBe(false);
      expect(res.body.data.interaction.favorited).toBe(false);
      expect(res.body.data.interaction.coinCount).toBe(0);
    });

    test('should not require authentication', async () => {
      const video = await createTestVideo({ status: 'published' });

      const res = await request(app).get(`/api/videos/${video.id}`);

      expect(res.status).toBe(200);
      expect(res.body.data.video.id).toBe(video.id);
    });

    test('should return 404 for non-existent video', async () => {
      const res = await request(app).get(`/api/videos/${generateUUID()}`);

      expect(res.status).toBe(404);
      expect(res.body.error.code).toBe('VIDEO_NOT_FOUND');
    });

    test('should reject invalid UUID format', async () => {
      const res = await request(app).get('/api/videos/invalid-uuid');

      expect(res.status).toBe(400);
    });

    test('should not show private videos to other users', async () => {
      const otherUserId = generateUUID();
      const video = await createTestVideo({ status: 'private', userId: otherUserId });

      const res = await request(app)
        .get(`/api/videos/${video.id}`)
        .set(getAuthHeaders(authToken));

      expect(res.status).toBe(403);
    });

    test('should show private video to owner', async () => {
      const video = await createTestVideo({ status: 'private', userId: testUserId });

      const res = await request(app)
        .get(`/api/videos/${video.id}`)
        .set(getAuthHeaders(authToken));

      expect(res.status).toBe(200);
      expect(res.body.data.video.id).toBe(video.id);
    });

    test('should cache video after fetch', async () => {
      const video = await createTestVideo({ status: 'published' });

      await request(app).get(`/api/videos/${video.id}`);
      await wait(100);

      const cached = await redis.getCachedVideo(video.id);
      expect(cached).toBeDefined();
      expect(cached.id).toBe(video.id);
    });
  });

  // ============================================================
  // PUT /api/videos/:id - Update
  // ============================================================

  describe('PUT /api/videos/:id', () => {
    test('should update video title', async () => {
      const video = await createTestVideo({ userId: testUserId });

      const res = await request(app)
        .put(`/api/videos/${video.id}`)
        .set(getAuthHeaders(authToken))
        .send({ title: 'Updated Title' });

      expect(res.status).toBe(200);
      expect(res.body.data.video.title).toBe('Updated Title');
    });

    test('should update video description', async () => {
      const video = await createTestVideo({ userId: testUserId });

      const res = await request(app)
        .put(`/api/videos/${video.id}`)
        .set(getAuthHeaders(authToken))
        .send({ description: 'Updated description' });

      expect(res.status).toBe(200);
      expect(res.body.data.video.description).toBe('Updated description');
    });

    test('should update video status to published', async () => {
      const video = await createTestVideo({ userId: testUserId, status: 'draft' });

      const res = await request(app)
        .put(`/api/videos/${video.id}`)
        .set(getAuthHeaders(authToken))
        .send({ status: 'published' });

      expect(res.status).toBe(200);
      expect(res.body.data.video.status).toBe('published');
    });

    test('should update thumbnailUrl', async () => {
      const video = await createTestVideo({ userId: testUserId });

      const res = await request(app)
        .put(`/api/videos/${video.id}`)
        .set(getAuthHeaders(authToken))
        .send({ thumbnailUrl: 'https://example.com/new-thumb.jpg' });

      expect(res.status).toBe(200);
      expect(res.body.data.video.thumbnail_url).toBe('https://example.com/new-thumb.jpg');
    });

    test('should update duration', async () => {
      const video = await createTestVideo({ userId: testUserId });

      const res = await request(app)
        .put(`/api/videos/${video.id}`)
        .set(getAuthHeaders(authToken))
        .send({ duration: 300 });

      expect(res.status).toBe(200);
      expect(res.body.data.video.duration).toBe(300);
    });

    test('should update category', async () => {
      const video = await createTestVideo({ userId: testUserId });

      const res = await request(app)
        .put(`/api/videos/${video.id}`)
        .set(getAuthHeaders(authToken))
        .send({ categoryId: 2 });

      expect(res.status).toBe(200);
      expect(res.body.data.video.category_id).toBe(2);
    });

    test('should require authentication', async () => {
      const video = await createTestVideo();

      const res = await request(app)
        .put(`/api/videos/${video.id}`)
        .send({ title: 'No Auth' });

      expect(res.status).toBe(401);
    });

    test('should only allow owner to update', async () => {
      const otherUserId = generateUUID();
      const video = await createTestVideo({ userId: otherUserId });

      const res = await request(app)
        .put(`/api/videos/${video.id}`)
        .set(getAuthHeaders(authToken))
        .send({ title: 'Hacked' });

      expect(res.status).toBe(403);
    });

    test('should return 404 for non-existent video', async () => {
      const res = await request(app)
        .put(`/api/videos/${generateUUID()}`)
        .set(getAuthHeaders(authToken))
        .send({ title: 'Ghost' });

      expect(res.status).toBe(404);
    });

    test('should reject invalid title', async () => {
      const video = await createTestVideo({ userId: testUserId });

      const res = await request(app)
        .put(`/api/videos/${video.id}`)
        .set(getAuthHeaders(authToken))
        .send({ title: '' });

      expect(res.status).toBe(400);
    });

    test('should reject invalid status', async () => {
      const video = await createTestVideo({ userId: testUserId });

      const res = await request(app)
        .put(`/api/videos/${video.id}`)
        .set(getAuthHeaders(authToken))
        .send({ status: 'bad_status' });

      expect(res.status).toBe(400);
    });

    test('should reject invalid categoryId', async () => {
      const video = await createTestVideo({ userId: testUserId });

      const res = await request(app)
        .put(`/api/videos/${video.id}`)
        .set(getAuthHeaders(authToken))
        .send({ categoryId: 99999 });

      expect(res.status).toBe(404);
    });
  });

  // ============================================================
  // DELETE /api/videos/:id - Delete
  // ============================================================

  describe('DELETE /api/videos/:id', () => {
    test('should delete own video', async () => {
      const video = await createTestVideo({ userId: testUserId });

      const res = await request(app)
        .delete(`/api/videos/${video.id}`)
        .set(getAuthHeaders(authToken));

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
    });

    test('should remove video from database', async () => {
      const video = await createTestVideo({ userId: testUserId });

      await request(app)
        .delete(`/api/videos/${video.id}`)
        .set(getAuthHeaders(authToken));

      const check = await Video.findById(video.id);
      expect(check).toBeNull();
    });

    test('should require authentication', async () => {
      const video = await createTestVideo();

      const res = await request(app)
        .delete(`/api/videos/${video.id}`);

      expect(res.status).toBe(401);
    });

    test('should only allow owner to delete', async () => {
      const otherUserId = generateUUID();
      const video = await createTestVideo({ userId: otherUserId });

      const res = await request(app)
        .delete(`/api/videos/${video.id}`)
        .set(getAuthHeaders(authToken));

      expect(res.status).toBe(403);
    });

    test('should return 404 for non-existent video', async () => {
      const res = await request(app)
        .delete(`/api/videos/${generateUUID()}`)
        .set(getAuthHeaders(authToken));

      expect(res.status).toBe(404);
    });
  });

  // ============================================================
  // GET /api/videos/hot - Hot Videos
  // ============================================================

  describe('GET /api/videos/hot', () => {
    test('should return hot videos', async () => {
      await createTestVideos(3, { status: 'published' });

      const res = await request(app).get('/api/videos/hot');

      expect(res.status).toBe(200);
      expect(res.body.data.videos).toBeDefined();
    });

    test('should support limit parameter', async () => {
      await createTestVideos(10, { status: 'published' });

      const res = await request(app)
        .get('/api/videos/hot')
        .query({ limit: 5 });

      expect(res.status).toBe(200);
    });
  });
});
