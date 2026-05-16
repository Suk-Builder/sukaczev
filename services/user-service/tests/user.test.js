/**
 * @fileoverview User tests - Comprehensive test suite for user operations.
 * Tests user CRUD, profile management, followers/following, and social features.
 */

const request = require('supertest');
const { app } = require('../src/app');
const User = require('../src/models/User');
const redis = require('../src/config/redis');
const {
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
} = require('./setup');

describe('User Endpoints', () => {
  beforeAll(async () => {
    await mockRabbitMQ();
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
  // GET /api/users/:id
  // ============================================================

  describe('GET /api/users/:id', () => {
    describe('Get User Profile', () => {
      test('should get user by valid UUID', async () => {
        const testUser = await createTestUser();

        const res = await request(app)
          .get(`/api/users/${testUser.id}`);

        expect(res.status).toBe(200);
        expect(res.body.success).toBe(true);
        expect(res.body.data.user).toBeDefined();
        expect(res.body.data.user.id).toBe(testUser.id);
        expect(res.body.data.user.username).toBe(testUser.username);
        expect(res.body.data.user.display_name).toBe(testUser.display_name);
      });

      test('should return correct user fields', async () => {
        const testUser = await createTestUser();

        const res = await request(app)
          .get(`/api/users/${testUser.id}`);

        const user = res.body.data.user;
        expect(user.id).toBeDefined();
        expect(user.username).toBeDefined();
        expect(user.display_name).toBeDefined();
        expect(user.avatar_url).toBeDefined();
        expect(user.bio).toBeDefined();
        expect(user.level).toBeDefined();
        expect(user.exp).toBeDefined();
        expect(user.coins).toBeDefined();
        expect(user.followers_count).toBeDefined();
        expect(user.following_count).toBeDefined();
        expect(user.created_at).toBeDefined();
        expect(user.updated_at).toBeDefined();
      });

      test('should not return password_hash in response', async () => {
        const testUser = await createTestUser();

        const res = await request(app)
          .get(`/api/users/${testUser.id}`);

        const user = res.body.data.user;
        expect(user.password_hash).toBeUndefined();
        expect(user.password).toBeUndefined();
      });

      test('should include is_following field', async () => {
        const testUser = await createTestUser();

        const res = await request(app)
          .get(`/api/users/${testUser.id}`);

        expect(res.body.data.user.is_following).toBeDefined();
      });
    });

    describe('Validation', () => {
      test('should reject invalid UUID format', async () => {
        const res = await request(app)
          .get('/api/users/not-a-uuid');

        expect(res.status).toBe(400);
        expect(res.body.errors).toBeDefined();
      });

      test('should reject empty user ID', async () => {
        const res = await request(app)
          .get('/api/users/');

        expect(res.status).toBe(404); // Router won't match empty param
      });

      test('should reject UUID with special characters', async () => {
        const res = await request(app)
          .get('/api/users/abc-123;drop table users;');

        expect(res.status).toBe(400);
      });
    });

    describe('Not Found', () => {
      test('should return 404 for non-existent user', async () => {
        const fakeUUID = generateUUID();

        const res = await request(app)
          .get(`/api/users/${fakeUUID}`);

        expect(res.status).toBe(404);
        expect(res.body.error.code).toBe('USER_NOT_FOUND');
      });

      test('should return 404 for zero UUID', async () => {
        const res = await request(app)
          .get('/api/users/00000000-0000-0000-0000-000000000000');

        expect(res.status).toBe(404);
      });

      test('should return 404 for nil UUID', async () => {
        const res = await request(app)
          .get('/api/users/11111111-1111-1111-1111-111111111111');

        expect(res.status).toBe(404);
      });
    });

    describe('Caching', () => {
      test('should cache user data in Redis after fetch', async () => {
        const testUser = await createTestUser();

        await request(app).get(`/api/users/${testUser.id}`);

        await wait(100);

        const cached = await redis.getCachedUser(testUser.id);
        expect(cached).toBeDefined();
        expect(cached.id).toBe(testUser.id);
      });

      test('should return cached data on subsequent requests', async () => {
        const testUser = await createTestUser();

        // First request
        const res1 = await request(app).get(`/api/users/${testUser.id}`);

        // Wait and make second request
        await wait(100);
        const res2 = await request(app).get(`/api/users/${testUser.id}`);

        expect(res1.body.data.user.id).toBe(res2.body.data.user.id);
        expect(res1.body.data.user.username).toBe(res2.body.data.user.username);
      });
    });

    describe('Authenticated Access', () => {
      test('should show is_following=true when current user follows target', async () => {
        const [user1, user2] = await createTestUsers(2);
        await createTestFollow(user1.id, user2.id);

        // Login as user1
        const loginRes = await request(app)
          .post('/api/auth/login')
          .send({ username: user1.username, password: user1.plainPassword });
        const tokens = extractTokens(loginRes);

        const res = await request(app)
          .get(`/api/users/${user2.id}`)
          .set('Authorization', `Bearer ${tokens.accessToken}`);

        expect(res.body.data.user.is_following).toBe(true);
      });

      test('should show is_following=false when not following', async () => {
        const [user1, user2] = await createTestUsers(2);

        const loginRes = await request(app)
          .post('/api/auth/login')
          .send({ username: user1.username, password: user1.plainPassword });
        const tokens = extractTokens(loginRes);

        const res = await request(app)
          .get(`/api/users/${user2.id}`)
          .set('Authorization', `Bearer ${tokens.accessToken}`);

        expect(res.body.data.user.is_following).toBe(false);
      });
    });
  });

  // ============================================================
  // GET /api/users/me
  // ============================================================

  describe('GET /api/users/me', () => {
    test('should get current authenticated user', async () => {
      const testUser = await createTestUser();

      const loginRes = await request(app)
        .post('/api/auth/login')
        .send({ username: testUser.username, password: testUser.plainPassword });
      const tokens = extractTokens(loginRes);

      const res = await request(app)
        .get('/api/users/me')
        .set('Authorization', `Bearer ${tokens.accessToken}`);

      expect(res.status).toBe(200);
      expect(res.body.data.user.id).toBe(testUser.id);
      expect(res.body.data.user.username).toBe(testUser.username);
    });

    test('should require authentication', async () => {
      const res = await request(app)
        .get('/api/users/me');

      expect(res.status).toBe(401);
    });

    test('should reject invalid token', async () => {
      const res = await request(app)
        .get('/api/users/me')
        .set('Authorization', 'Bearer invalidtoken');

      expect(res.status).toBe(401);
    });

    test('should reject expired token', async () => {
      const jwt = require('jsonwebtoken');
      const expiredToken = jwt.sign(
        { userId: generateUUID(), username: 'test' },
        process.env.JWT_ACCESS_SECRET,
        { expiresIn: '-1h' }
      );

      const res = await request(app)
        .get('/api/users/me')
        .set('Authorization', `Bearer ${expiredToken}`);

      expect(res.status).toBe(401);
    });

    test('should handle deleted user with valid token', async () => {
      const testUser = await createTestUser();

      const loginRes = await request(app)
        .post('/api/auth/login')
        .send({ username: testUser.username, password: testUser.plainPassword });
      const tokens = extractTokens(loginRes);

      // Delete user directly
      await User.remove(testUser.id);

      const res = await request(app)
        .get('/api/users/me')
        .set('Authorization', `Bearer ${tokens.accessToken}`);

      expect(res.status).toBe(404);
    });
  });

  // ============================================================
  // PUT /api/users/:id
  // ============================================================

  describe('PUT /api/users/:id', () => {
    test('should update display name', async () => {
      const testUser = await createTestUser();
      const tokens = extractTokens(
        await request(app)
          .post('/api/auth/login')
          .send({ username: testUser.username, password: testUser.plainPassword })
      );

      const res = await request(app)
        .put(`/api/users/${testUser.id}`)
        .set('Authorization', `Bearer ${tokens.accessToken}`)
        .send({ displayName: 'Updated Name' });

      expect(res.status).toBe(200);
      expect(res.body.data.user.display_name).toBe('Updated Name');
    });

    test('should update bio', async () => {
      const testUser = await createTestUser();
      const tokens = extractTokens(
        await request(app)
          .post('/api/auth/login')
          .send({ username: testUser.username, password: testUser.plainPassword })
      );

      const res = await request(app)
        .put(`/api/users/${testUser.id}`)
        .set('Authorization', `Bearer ${tokens.accessToken}`)
        .send({ bio: 'Updated bio information' });

      expect(res.status).toBe(200);
      expect(res.body.data.user.bio).toBe('Updated bio information');
    });

    test('should update avatar URL', async () => {
      const testUser = await createTestUser();
      const tokens = extractTokens(
        await request(app)
          .post('/api/auth/login')
          .send({ username: testUser.username, password: testUser.plainPassword })
      );

      const res = await request(app)
        .put(`/api/users/${testUser.id}`)
        .set('Authorization', `Bearer ${tokens.accessToken}`)
        .send({ avatarUrl: 'https://example.com/avatar.png' });

      expect(res.status).toBe(200);
      expect(res.body.data.user.avatar_url).toBe('https://example.com/avatar.png');
    });

    test('should update multiple fields at once', async () => {
      const testUser = await createTestUser();
      const tokens = extractTokens(
        await request(app)
          .post('/api/auth/login')
          .send({ username: testUser.username, password: testUser.plainPassword })
      );

      const res = await request(app)
        .put(`/api/users/${testUser.id}`)
        .set('Authorization', `Bearer ${tokens.accessToken}`)
        .send({
          displayName: 'Multi Update',
          bio: 'Multi bio update',
          avatarUrl: 'https://example.com/multi.png',
        });

      expect(res.status).toBe(200);
      expect(res.body.data.user.display_name).toBe('Multi Update');
      expect(res.body.data.user.bio).toBe('Multi bio update');
      expect(res.body.data.user.avatar_url).toBe('https://example.com/multi.png');
    });

    test('should update updated_at timestamp', async () => {
      const testUser = await createTestUser();
      const originalUpdatedAt = testUser.updated_at;

      await wait(100);

      const tokens = extractTokens(
        await request(app)
          .post('/api/auth/login')
          .send({ username: testUser.username, password: testUser.plainPassword })
      );

      const res = await request(app)
        .put(`/api/users/${testUser.id}`)
        .set('Authorization', `Bearer ${tokens.accessToken}`)
        .send({ displayName: 'Time Update' });

      const newUpdatedAt = res.body.data.user.updated_at;
      expect(new Date(newUpdatedAt).getTime()).toBeGreaterThan(
        new Date(originalUpdatedAt).getTime()
      );
    });

    test('should require authentication', async () => {
      const testUser = await createTestUser();

      const res = await request(app)
        .put(`/api/users/${testUser.id}`)
        .send({ displayName: 'No Auth' });

      expect(res.status).toBe(401);
    });

    test('should only allow self updates', async () => {
      const [user1, user2] = await createTestUsers(2);

      const tokens = extractTokens(
        await request(app)
          .post('/api/auth/login')
          .send({ username: user1.username, password: user1.plainPassword })
      );

      const res = await request(app)
        .put(`/api/users/${user2.id}`)
        .set('Authorization', `Bearer ${tokens.accessToken}`)
        .send({ displayName: 'Forbidden' });

      expect(res.status).toBe(403);
      expect(res.body.error.code).toBe('FORBIDDEN');
    });

    test('should validate bio length (max 500)', async () => {
      const testUser = await createTestUser();
      const tokens = extractTokens(
        await request(app)
          .post('/api/auth/login')
          .send({ username: testUser.username, password: testUser.plainPassword })
      );

      const res = await request(app)
        .put(`/api/users/${testUser.id}`)
        .set('Authorization', `Bearer ${tokens.accessToken}`)
        .send({ bio: 'a'.repeat(501) });

      expect(res.status).toBe(400);
    });

    test('should validate avatarUrl format', async () => {
      const testUser = await createTestUser();
      const tokens = extractTokens(
        await request(app)
          .post('/api/auth/login')
          .send({ username: testUser.username, password: testUser.plainPassword })
      );

      const res = await request(app)
        .put(`/api/users/${testUser.id}`)
        .set('Authorization', `Bearer ${tokens.accessToken}`)
        .send({ avatarUrl: 'not-a-url' });

      expect(res.status).toBe(400);
    });

    test('should validate displayName length', async () => {
      const testUser = await createTestUser();
      const tokens = extractTokens(
        await request(app)
          .post('/api/auth/login')
          .send({ username: testUser.username, password: testUser.plainPassword })
      );

      const res = await request(app)
        .put(`/api/users/${testUser.id}`)
        .set('Authorization', `Bearer ${tokens.accessToken}`)
        .send({ displayName: '' });

      expect(res.status).toBe(400);
    });

    test('should allow partial updates', async () => {
      const testUser = await createTestUser({
        displayName: 'Original',
        bio: 'Original bio',
      });
      const tokens = extractTokens(
        await request(app)
          .post('/api/auth/login')
          .send({ username: testUser.username, password: testUser.plainPassword })
      );

      const res = await request(app)
        .put(`/api/users/${testUser.id}`)
        .set('Authorization', `Bearer ${tokens.accessToken}`)
        .send({ displayName: 'New Name' });

      expect(res.status).toBe(200);
      expect(res.body.data.user.display_name).toBe('New Name');
    });

    test('should handle non-existent user', async () => {
      const testUser = await createTestUser();
      const tokens = extractTokens(
        await request(app)
          .post('/api/auth/login')
          .send({ username: testUser.username, password: testUser.plainPassword })
      );

      const fakeUUID = generateUUID();
      const res = await request(app)
        .put(`/api/users/${fakeUUID}`)
        .set('Authorization', `Bearer ${tokens.accessToken}`)
        .send({ displayName: 'Ghost' });

      expect(res.status).toBe(403);
    });
  });

  // ============================================================
  // DELETE /api/users/:id
  // ============================================================

  describe('DELETE /api/users/:id', () => {
    test('should delete own account', async () => {
      const testUser = await createTestUser();
      const tokens = extractTokens(
        await request(app)
          .post('/api/auth/login')
          .send({ username: testUser.username, password: testUser.plainPassword })
      );

      const res = await request(app)
        .delete(`/api/users/${testUser.id}`)
        .set('Authorization', `Bearer ${tokens.accessToken}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
    });

    test('should remove user from database', async () => {
      const testUser = await createTestUser();
      const tokens = extractTokens(
        await request(app)
          .post('/api/auth/login')
          .send({ username: testUser.username, password: testUser.plainPassword })
      );

      await request(app)
        .delete(`/api/users/${testUser.id}`)
        .set('Authorization', `Bearer ${tokens.accessToken}`);

      const checkUser = await User.findById(testUser.id);
      expect(checkUser).toBeNull();
    });

    test('should require authentication', async () => {
      const testUser = await createTestUser();

      const res = await request(app)
        .delete(`/api/users/${testUser.id}`);

      expect(res.status).toBe(401);
    });

    test('should only allow self deletion', async () => {
      const [user1, user2] = await createTestUsers(2);

      const tokens = extractTokens(
        await request(app)
          .post('/api/auth/login')
          .send({ username: user1.username, password: user1.plainPassword })
      );

      const res = await request(app)
        .delete(`/api/users/${user2.id}`)
        .set('Authorization', `Bearer ${tokens.accessToken}`);

      expect(res.status).toBe(403);
    });

    test('should return 404 for non-existent user', async () => {
      const testUser = await createTestUser();
      const tokens = extractTokens(
        await request(app)
          .post('/api/auth/login')
          .send({ username: testUser.username, password: testUser.plainPassword })
      );

      const fakeUUID = generateUUID();
      const res = await request(app)
        .delete(`/api/users/${fakeUUID}`)
        .set('Authorization', `Bearer ${tokens.accessToken}`);

      expect(res.status).toBe(404);
    });

    test('should handle cascading delete of follows', async () => {
      const [user1, user2, user3] = await createTestUsers(3);
      await createTestFollow(user1.id, user2.id);
      await createTestFollow(user3.id, user1.id);

      const tokens = extractTokens(
        await request(app)
          .post('/api/auth/login')
          .send({ username: user1.username, password: user1.plainPassword })
      );

      await request(app)
        .delete(`/api/users/${user1.id}`)
        .set('Authorization', `Bearer ${tokens.accessToken}`);

      // User2 and User3 should still exist
      const u2 = await User.findById(user2.id);
      const u3 = await User.findById(user3.id);
      expect(u2).not.toBeNull();
      expect(u3).not.toBeNull();
    });
  });

  // ============================================================
  // POST /api/users/:id/follow
  // ============================================================

  describe('POST /api/users/:id/follow', () => {
    test('should follow another user', async () => {
      const [user1, user2] = await createTestUsers(2);
      const tokens = extractTokens(
        await request(app)
          .post('/api/auth/login')
          .send({ username: user1.username, password: user1.plainPassword })
      );

      const res = await request(app)
        .post(`/api/users/${user2.id}/follow`)
        .set('Authorization', `Bearer ${tokens.accessToken}`);

      expect(res.status).toBe(201);
      expect(res.body.success).toBe(true);
      expect(res.body.data.followerId).toBe(user1.id);
      expect(res.body.data.followingId).toBe(user2.id);
    });

    test('should increment following count', async () => {
      const [user1, user2] = await createTestUsers(2);
      const tokens = extractTokens(
        await request(app)
          .post('/api/auth/login')
          .send({ username: user1.username, password: user1.plainPassword })
      );

      await request(app)
        .post(`/api/users/${user2.id}/follow`)
        .set('Authorization', `Bearer ${tokens.accessToken}`);

      const updatedUser1 = await User.findById(user1.id);
      expect(updatedUser1.following_count).toBe(1);
    });

    test('should increment followers count of target', async () => {
      const [user1, user2] = await createTestUsers(2);
      const tokens = extractTokens(
        await request(app)
          .post('/api/auth/login')
          .send({ username: user1.username, password: user1.plainPassword })
      );

      await request(app)
        .post(`/api/users/${user2.id}/follow`)
        .set('Authorization', `Bearer ${tokens.accessToken}`);

      const updatedUser2 = await User.findById(user2.id);
      expect(updatedUser2.followers_count).toBe(1);
    });

    test('should require authentication', async () => {
      const testUser = await createTestUser();

      const res = await request(app)
        .post(`/api/users/${testUser.id}/follow`);

      expect(res.status).toBe(401);
    });

    test('should reject self-follow', async () => {
      const testUser = await createTestUser();
      const tokens = extractTokens(
        await request(app)
          .post('/api/auth/login')
          .send({ username: testUser.username, password: testUser.plainPassword })
      );

      const res = await request(app)
        .post(`/api/users/${testUser.id}/follow`)
        .set('Authorization', `Bearer ${tokens.accessToken}`);

      expect(res.status).toBe(400);
      expect(res.body.error.code).toBe('SELF_FOLLOW');
    });

    test('should reject duplicate follow', async () => {
      const [user1, user2] = await createTestUsers(2);
      const tokens = extractTokens(
        await request(app)
          .post('/api/auth/login')
          .send({ username: user1.username, password: user1.plainPassword })
      );

      // First follow
      await request(app)
        .post(`/api/users/${user2.id}/follow`)
        .set('Authorization', `Bearer ${tokens.accessToken}`);

      // Second follow
      const res = await request(app)
        .post(`/api/users/${user2.id}/follow`)
        .set('Authorization', `Bearer ${tokens.accessToken}`);

      expect(res.status).toBe(409);
      expect(res.body.error.code).toBe('ALREADY_FOLLOWING');
    });

    test('should reject follow of non-existent user', async () => {
      const testUser = await createTestUser();
      const tokens = extractTokens(
        await request(app)
          .post('/api/auth/login')
          .send({ username: testUser.username, password: testUser.plainPassword })
      );

      const fakeUUID = generateUUID();
      const res = await request(app)
        .post(`/api/users/${fakeUUID}/follow`)
        .set('Authorization', `Bearer ${tokens.accessToken}`);

      expect(res.status).toBe(404);
    });

    test('should validate UUID format', async () => {
      const testUser = await createTestUser();
      const tokens = extractTokens(
        await request(app)
          .post('/api/auth/login')
          .send({ username: testUser.username, password: testUser.plainPassword })
      );

      const res = await request(app)
        .post('/api/users/invalid-uuid/follow')
        .set('Authorization', `Bearer ${tokens.accessToken}`);

      expect(res.status).toBe(400);
    });
  });

  // ============================================================
  // DELETE /api/users/:id/follow
  // ============================================================

  describe('DELETE /api/users/:id/follow', () => {
    test('should unfollow a user', async () => {
      const [user1, user2] = await createTestUsers(2);
      await createTestFollow(user1.id, user2.id);

      const tokens = extractTokens(
        await request(app)
          .post('/api/auth/login')
          .send({ username: user1.username, password: user1.plainPassword })
      );

      const res = await request(app)
        .delete(`/api/users/${user2.id}/follow`)
        .set('Authorization', `Bearer ${tokens.accessToken}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.unfollowed).toBe(true);
    });

    test('should decrement following count', async () => {
      const [user1, user2] = await createTestUsers(2);
      await createTestFollow(user1.id, user2.id);

      const tokens = extractTokens(
        await request(app)
          .post('/api/auth/login')
          .send({ username: user1.username, password: user1.plainPassword })
      );

      await request(app)
        .delete(`/api/users/${user2.id}/follow`)
        .set('Authorization', `Bearer ${tokens.accessToken}`);

      const updatedUser1 = await User.findById(user1.id);
      expect(updatedUser1.following_count).toBe(0);
    });

    test('should decrement followers count of target', async () => {
      const [user1, user2] = await createTestUsers(2);
      await createTestFollow(user1.id, user2.id);

      const tokens = extractTokens(
        await request(app)
          .post('/api/auth/login')
          .send({ username: user1.username, password: user1.plainPassword })
      );

      await request(app)
        .delete(`/api/users/${user2.id}/follow`)
        .set('Authorization', `Bearer ${tokens.accessToken}`);

      const updatedUser2 = await User.findById(user2.id);
      expect(updatedUser2.followers_count).toBe(0);
    });

    test('should return 404 if not following', async () => {
      const [user1, user2] = await createTestUsers(2);

      const tokens = extractTokens(
        await request(app)
          .post('/api/auth/login')
          .send({ username: user1.username, password: user1.plainPassword })
      );

      const res = await request(app)
        .delete(`/api/users/${user2.id}/follow`)
        .set('Authorization', `Bearer ${tokens.accessToken}`);

      expect(res.status).toBe(404);
      expect(res.body.error.code).toBe('NOT_FOLLOWING');
    });

    test('should require authentication', async () => {
      const testUser = await createTestUser();

      const res = await request(app)
        .delete(`/api/users/${testUser.id}/follow`);

      expect(res.status).toBe(401);
    });
  });

  // ============================================================
  // GET /api/users/:id/followers
  // ============================================================

  describe('GET /api/users/:id/followers', () => {
    test('should get empty followers list', async () => {
      const testUser = await createTestUser();

      const res = await request(app)
        .get(`/api/users/${testUser.id}/followers`);

      expect(res.status).toBe(200);
      expect(res.body.data.followers).toEqual([]);
      expect(res.body.data.pagination.total).toBe(0);
    });

    test('should get followers list with data', async () => {
      const [user1, user2, user3] = await createTestUsers(3);
      await createTestFollow(user2.id, user1.id);
      await createTestFollow(user3.id, user1.id);

      const res = await request(app)
        .get(`/api/users/${user1.id}/followers`);

      expect(res.status).toBe(200);
      expect(res.body.data.followers).toHaveLength(2);
      expect(res.body.data.pagination.total).toBe(2);
    });

    test('should return correct follower fields', async () => {
      const [user1, user2] = await createTestUsers(2);
      await createTestFollow(user2.id, user1.id);

      const res = await request(app)
        .get(`/api/users/${user1.id}/followers`);

      const follower = res.body.data.followers[0];
      expect(follower.id).toBe(user2.id);
      expect(follower.username).toBe(user2.username);
      expect(follower.display_name).toBeDefined();
      expect(follower.avatar_url).toBeDefined();
      expect(follower.bio).toBeDefined();
      expect(follower.level).toBeDefined();
      expect(follower.followed_at).toBeDefined();
    });

    test('should support pagination with limit', async () => {
      const targetUser = await createTestUser();
      const followers = await createTestUsers(5);

      for (const follower of followers) {
        await createTestFollow(follower.id, targetUser.id);
      }

      const res = await request(app)
        .get(`/api/users/${targetUser.id}/followers`)
        .query({ limit: 2 });

      expect(res.status).toBe(200);
      expect(res.body.data.followers).toHaveLength(2);
      expect(res.body.data.pagination.limit).toBe(2);
      expect(res.body.data.pagination.hasMore).toBe(true);
    });

    test('should support pagination with offset', async () => {
      const targetUser = await createTestUser();
      const followers = await createTestUsers(5);

      for (const follower of followers) {
        await createTestFollow(follower.id, targetUser.id);
      }

      const res = await request(app)
        .get(`/api/users/${targetUser.id}/followers`)
        .query({ limit: 2, offset: 2 });

      expect(res.status).toBe(200);
      expect(res.body.data.followers).toHaveLength(2);
      expect(res.body.data.pagination.offset).toBe(2);
    });

    test('should reject invalid limit parameter', async () => {
      const testUser = await createTestUser();

      const res = await request(app)
        .get(`/api/users/${testUser.id}/followers`)
        .query({ limit: -1 });

      expect(res.status).toBe(400);
    });

    test('should reject limit exceeding 100', async () => {
      const testUser = await createTestUser();

      const res = await request(app)
        .get(`/api/users/${testUser.id}/followers`)
        .query({ limit: 101 });

      expect(res.status).toBe(400);
    });

    test('should reject negative offset', async () => {
      const testUser = await createTestUser();

      const res = await request(app)
        .get(`/api/users/${testUser.id}/followers`)
        .query({ offset: -1 });

      expect(res.status).toBe(400);
    });

    test('should return 404 for non-existent user', async () => {
      const fakeUUID = generateUUID();

      const res = await request(app)
        .get(`/api/users/${fakeUUID}/followers`);

      expect(res.status).toBe(404);
    });

    test('should order followers by followed_at desc', async () => {
      const targetUser = await createTestUser();
      const follower1 = await createTestUser();
      const follower2 = await createTestUser();

      await createTestFollow(follower1.id, targetUser.id);
      await wait(100);
      await createTestFollow(follower2.id, targetUser.id);

      const res = await request(app)
        .get(`/api/users/${targetUser.id}/followers`);

      expect(res.body.data.followers[0].id).toBe(follower2.id);
    });
  });

  // ============================================================
  // GET /api/users/:id/following
  // ============================================================

  describe('GET /api/users/:id/following', () => {
    test('should get empty following list', async () => {
      const testUser = await createTestUser();

      const res = await request(app)
        .get(`/api/users/${testUser.id}/following`);

      expect(res.status).toBe(200);
      expect(res.body.data.following).toEqual([]);
      expect(res.body.data.pagination.total).toBe(0);
    });

    test('should get following list with data', async () => {
      const [user1, user2, user3] = await createTestUsers(3);
      await createTestFollow(user1.id, user2.id);
      await createTestFollow(user1.id, user3.id);

      const res = await request(app)
        .get(`/api/users/${user1.id}/following`);

      expect(res.status).toBe(200);
      expect(res.body.data.following).toHaveLength(2);
      expect(res.body.data.pagination.total).toBe(2);
    });

    test('should support pagination', async () => {
      const user1 = await createTestUser();
      const following = await createTestUsers(5);

      for (const f of following) {
        await createTestFollow(user1.id, f.id);
      }

      const res = await request(app)
        .get(`/api/users/${user1.id}/following`)
        .query({ limit: 3, offset: 0 });

      expect(res.status).toBe(200);
      expect(res.body.data.following).toHaveLength(3);
      expect(res.body.data.pagination.hasMore).toBe(true);
    });

    test('should return 404 for non-existent user', async () => {
      const fakeUUID = generateUUID();

      const res = await request(app)
        .get(`/api/users/${fakeUUID}/following`);

      expect(res.status).toBe(404);
    });
  });

  // ============================================================
  // GET /api/users/search
  // ============================================================

  describe('GET /api/users/search', () => {
    test('should search by username', async () => {
      await createTestUser({ username: 'searchme', displayName: 'Search Me' });

      const res = await request(app)
        .get('/api/users/search')
        .query({ q: 'searchme' });

      expect(res.status).toBe(200);
      expect(res.body.data.users.length).toBeGreaterThan(0);
    });

    test('should search by display name', async () => {
      await createTestUser({ username: 'displaytest', displayName: 'Find This Name' });

      const res = await request(app)
        .get('/api/users/search')
        .query({ q: 'Find This' });

      expect(res.status).toBe(200);
      expect(res.body.data.users.length).toBeGreaterThan(0);
    });

    test('should support partial matching', async () => {
      await createTestUser({ username: 'partialmatch', displayName: 'Partial Match' });

      const res = await request(app)
        .get('/api/users/search')
        .query({ q: 'partial' });

      expect(res.status).toBe(200);
      expect(res.body.data.users.length).toBeGreaterThan(0);
    });

    test('should reject empty query', async () => {
      const res = await request(app)
        .get('/api/users/search')
        .query({ q: '' });

      expect(res.status).toBe(400);
    });

    test('should reject short query', async () => {
      const res = await request(app)
        .get('/api/users/search')
        .query({ q: 'a' });

      expect(res.status).toBe(400);
    });

    test('should support pagination', async () => {
      for (let i = 0; i < 5; i++) {
        await createTestUser({ username: `searchpag_${i}` });
      }

      const res = await request(app)
        .get('/api/users/search')
        .query({ q: 'searchpag_', limit: 2 });

      expect(res.status).toBe(200);
      expect(res.body.data.users).toHaveLength(2);
      expect(res.body.data.pagination).toBeDefined();
    });

    test('should order by followers count', async () => {
      const popularUser = await createTestUser({ username: 'popular', displayName: 'Popular' });
      const unpopularUser = await createTestUser({ username: 'unpopular', displayName: 'Unpopular' });

      // Give popular user some followers
      for (let i = 0; i < 5; i++) {
        const follower = await createTestUser();
        await createTestFollow(follower.id, popularUser.id);
      }

      const res = await request(app)
        .get('/api/users/search')
        .query({ q: 'popular' });

      // Popular user should come first
      expect(res.body.data.users[0].username).toBe('popular');
    });
  });
});

// ============================================================
// User Model Unit Tests
// ============================================================

describe('User Model', () => {
  beforeEach(async () => {
    await cleanupTestData();
  });

  afterAll(async () => {
    await cleanupTestData();
  });

  describe('create', () => {
    test('should create user with all required fields', async () => {
      const bcrypt = require('bcrypt');
      const passwordHash = await bcrypt.hash('testpass', 10);

      const user = await User.create({
        username: 'modeltest',
        email: 'model@test.com',
        passwordHash,
        displayName: 'Model Test',
      });

      expect(user.id).toBeDefined();
      expect(user.username).toBe('modeltest');
      expect(user.email).toBe('model@test.com');
    });

    test('should reject duplicate username', async () => {
      const bcrypt = require('bcrypt');
      const passwordHash = await bcrypt.hash('testpass', 10);

      await User.create({
        username: 'duptest',
        email: 'dup1@test.com',
        passwordHash,
      });

      await expect(
        User.create({
          username: 'duptest',
          email: 'dup2@test.com',
          passwordHash,
        })
      ).rejects.toThrow('username already exists');
    });
  });

  describe('findById', () => {
    test('should find user by ID', async () => {
      const testUser = await createTestUser();

      const found = await User.findById(testUser.id);
      expect(found).not.toBeNull();
      expect(found.id).toBe(testUser.id);
    });

    test('should return null for non-existent ID', async () => {
      const found = await User.findById(generateUUID());
      expect(found).toBeNull();
    });

    test('should optionally include password', async () => {
      const testUser = await createTestUser();

      const found = await User.findById(testUser.id, true);
      expect(found.password_hash).toBeDefined();
    });
  });

  describe('update', () => {
    test('should update allowed fields', async () => {
      const testUser = await createTestUser();

      const updated = await User.update(testUser.id, {
        display_name: 'Updated',
        bio: 'New bio',
      });

      expect(updated.display_name).toBe('Updated');
      expect(updated.bio).toBe('New bio');
    });

    test('should return null for non-existent user', async () => {
      const updated = await User.update(generateUUID(), {
        display_name: 'Ghost',
      });

      expect(updated).toBeNull();
    });
  });

  describe('remove', () => {
    test('should delete existing user', async () => {
      const testUser = await createTestUser();

      const result = await User.remove(testUser.id);
      expect(result).toBe(true);

      const found = await User.findById(testUser.id);
      expect(found).toBeNull();
    });

    test('should return false for non-existent user', async () => {
      const result = await User.remove(generateUUID());
      expect(result).toBe(false);
    });
  });

  describe('follow/unfollow', () => {
    test('should create follow relationship', async () => {
      const [user1, user2] = await createTestUsers(2);

      const follow = await User.follow(user1.id, user2.id);
      expect(follow.follower_id).toBe(user1.id);
      expect(follow.following_id).toBe(user2.id);
    });

    test('should reject self-follow at database level', async () => {
      const testUser = await createTestUser();

      await expect(User.follow(testUser.id, testUser.id)).rejects.toThrow();
    });

    test('should reject duplicate follow', async () => {
      const [user1, user2] = await createTestUsers(2);

      await User.follow(user1.id, user2.id);
      await expect(User.follow(user1.id, user2.id)).rejects.toThrow('Already following');
    });

    test('should unfollow user', async () => {
      const [user1, user2] = await createTestUsers(2);

      await User.follow(user1.id, user2.id);
      const result = await User.unfollow(user1.id, user2.id);
      expect(result).toBe(true);
    });

    test('should return false when unfollowing non-followed user', async () => {
      const [user1, user2] = await createTestUsers(2);

      const result = await User.unfollow(user1.id, user2.id);
      expect(result).toBe(false);
    });
  });

  describe('isFollowing', () => {
    test('should return true when following', async () => {
      const [user1, user2] = await createTestUsers(2);
      await User.follow(user1.id, user2.id);

      const result = await User.isFollowing(user1.id, user2.id);
      expect(result).toBe(true);
    });

    test('should return false when not following', async () => {
      const [user1, user2] = await createTestUsers(2);

      const result = await User.isFollowing(user1.id, user2.id);
      expect(result).toBe(false);
    });
  });

  describe('getFollowers', () => {
    test('should get followers with pagination', async () => {
      const target = await createTestUser();
      const followers = await createTestUsers(3);

      for (const f of followers) {
        await User.follow(f.id, target.id);
      }

      const result = await User.getFollowers(target.id, { limit: 2, offset: 0 });
      expect(result.followers).toHaveLength(2);
      expect(result.total).toBe(3);
    });
  });

  describe('getFollowing', () => {
    test('should get following with pagination', async () => {
      const user = await createTestUser();
      const following = await createTestUsers(3);

      for (const f of following) {
        await User.follow(user.id, f.id);
      }

      const result = await User.getFollowing(user.id, { limit: 10, offset: 0 });
      expect(result.following).toHaveLength(3);
      expect(result.total).toBe(3);
    });
  });

  describe('addExperience', () => {
    test('should add experience points', async () => {
      const testUser = await createTestUser();

      const result = await User.addExperience(testUser.id, 100);
      expect(result.exp).toBe(100);
    });

    test('should level up when threshold reached', async () => {
      const testUser = await createTestUser({ level: 0, exp: 90 });

      const result = await User.addExperience(testUser.id, 20);
      expect(result.level).toBe(1);
      expect(result.exp).toBe(110);
    });

    test('should handle multiple level ups', async () => {
      const testUser = await createTestUser({ level: 0, exp: 0 });

      const result = await User.addExperience(testUser.id, 10000);
      expect(result.level).toBe(3);
    });
  });

  describe('search', () => {
    test('should search users by username', async () => {
      await createTestUser({ username: 'findme', displayName: 'Find Me' });

      const result = await User.search('findme');
      expect(result.users.length).toBeGreaterThan(0);
    });

    test('should search case-insensitively', async () => {
      await createTestUser({ username: 'CaseTest' });

      const result = await User.search('casetest');
      expect(result.users.length).toBeGreaterThan(0);
    });

    test('should support pagination', async () => {
      for (let i = 0; i < 5; i++) {
        await createTestUser({ username: `pagsearch_${i}` });
      }

      const result = await User.search('pagsearch_', { limit: 2, offset: 0 });
      expect(result.users).toHaveLength(2);
      expect(result.total).toBe(5);
    });
  });
});
