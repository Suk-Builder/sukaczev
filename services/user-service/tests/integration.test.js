/**
 * @fileoverview Integration tests - End-to-end workflows for user-service.
 * Tests complete user journeys including auth, profile management, and social features.
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
  getAuthHeaders,
  extractTokens,
  mockRabbitMQ,
  restoreRabbitMQ,
  generateUUID,
  wait,
} = require('./setup');

describe('Integration Tests', () => {
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
  // Complete User Registration Flow
  // ============================================================

  describe('Complete Registration Flow', () => {
    test('should register, login, and access protected resource', async () => {
      // Step 1: Register
      const registerRes = await request(app)
        .post('/api/auth/register')
        .send({
          username: 'integration_user',
          email: 'integration@test.com',
          password: 'password123',
          displayName: 'Integration User',
        });

      expect(registerRes.status).toBe(201);
      const { user, tokens } = registerRes.body.data;

      // Step 2: Access protected resource with token
      const meRes = await request(app)
        .get('/api/users/me')
        .set('Authorization', `Bearer ${tokens.accessToken}`);

      expect(meRes.status).toBe(200);
      expect(meRes.body.data.user.id).toBe(user.id);

      // Step 3: Login with credentials
      const loginRes = await request(app)
        .post('/api/auth/login')
        .send({
          username: 'integration_user',
          password: 'password123',
        });

      expect(loginRes.status).toBe(200);
      expect(loginRes.body.data.tokens).toBeDefined();
    });

    test('should register and immediately be searchable', async () => {
      await request(app)
        .post('/api/auth/register')
        .send({
          username: 'searchable_user',
          email: 'searchable@test.com',
          password: 'password123',
          displayName: 'Searchable User',
        });

      const searchRes = await request(app)
        .get('/api/users/search')
        .query({ q: 'searchable_user' });

      expect(searchRes.status).toBe(200);
      expect(searchRes.body.data.users.length).toBeGreaterThan(0);
    });

    test('should not allow registration with duplicate username', async () => {
      // First registration
      await request(app)
        .post('/api/auth/register')
        .send({
          username: 'dup_check',
          email: 'dup1@test.com',
          password: 'password123',
        });

      // Duplicate username
      const dupRes = await request(app)
        .post('/api/auth/register')
        .send({
          username: 'dup_check',
          email: 'dup2@test.com',
          password: 'password123',
        });

      expect(dupRes.status).toBe(409);
    });
  });

  // ============================================================
  // Complete Authentication Flow
  // ============================================================

  describe('Complete Authentication Flow', () => {
    test('full auth lifecycle: register -> login -> refresh -> logout', async () => {
      // Register
      const registerRes = await request(app)
        .post('/api/auth/register')
        .send({
          username: 'fullflow',
          email: 'fullflow@test.com',
          password: 'password123',
        });

      expect(registerRes.status).toBe(201);
      const originalTokens = registerRes.body.data.tokens;

      // Login
      const loginRes = await request(app)
        .post('/api/auth/login')
        .send({
          username: 'fullflow',
          password: 'password123',
        });

      expect(loginRes.status).toBe(200);
      const loginTokens = loginRes.body.data.tokens;

      // Access protected resource
      const meRes = await request(app)
        .get('/api/users/me')
        .set('Authorization', `Bearer ${loginTokens.accessToken}`);

      expect(meRes.status).toBe(200);

      // Refresh token
      const refreshRes = await request(app)
        .post('/api/auth/refresh')
        .send({ refreshToken: loginTokens.refreshToken });

      expect(refreshRes.status).toBe(200);
      const newTokens = refreshRes.body.data.tokens;

      // Verify old refresh token doesn't work
      await wait(100);
      const oldRefreshRes = await request(app)
        .post('/api/auth/refresh')
        .send({ refreshToken: loginTokens.refreshToken });

      expect(oldRefreshRes.status).toBe(401);

      // Logout
      const logoutRes = await request(app)
        .post('/api/auth/logout')
        .set('Authorization', `Bearer ${newTokens.accessToken}`)
        .send({ refreshToken: newTokens.refreshToken });

      expect(logoutRes.status).toBe(200);

      // Verify token is invalidated
      await wait(200);
      const invalidAccessRes = await request(app)
        .get('/api/users/me')
        .set('Authorization', `Bearer ${newTokens.accessToken}`);

      expect(invalidAccessRes.status).toBe(401);
    });

    test('should handle concurrent sessions with different tokens', async () => {
      // Create user
      const testUser = await createTestUser({
        username: 'concurrent',
        email: 'concurrent@test.com',
        password: 'password123',
      });

      // Login twice (simulating two devices)
      const login1Res = await request(app)
        .post('/api/auth/login')
        .send({ username: 'concurrent', password: 'password123' });

      const login2Res = await request(app)
        .post('/api/auth/login')
        .send({ username: 'concurrent', password: 'password123' });

      expect(login1Res.status).toBe(200);
      expect(login2Res.status).toBe(200);

      const tokens1 = extractTokens(login1Res);
      const tokens2 = extractTokens(login2Res);

      // Both should work
      const me1Res = await request(app)
        .get('/api/users/me')
        .set('Authorization', `Bearer ${tokens1.accessToken}`);

      const me2Res = await request(app)
        .get('/api/users/me')
        .set('Authorization', `Bearer ${tokens2.accessToken}`);

      expect(me1Res.status).toBe(200);
      expect(me2Res.status).toBe(200);
    });
  });

  // ============================================================
  // Profile Management Flow
  // ============================================================

  describe('Profile Management Flow', () => {
    test('complete profile update journey', async () => {
      // Register
      const registerRes = await request(app)
        .post('/api/auth/register')
        .send({
          username: 'profile_journey',
          email: 'profile@test.com',
          password: 'password123',
        });

      const tokens = registerRes.body.data.tokens;
      const userId = registerRes.body.data.user.id;

      // Update profile
      const updateRes = await request(app)
        .put(`/api/users/${userId}`)
        .set('Authorization', `Bearer ${tokens.accessToken}`)
        .send({
          displayName: 'Journey User',
          bio: 'This is my journey bio',
          avatarUrl: 'https://example.com/journey.png',
        });

      expect(updateRes.status).toBe(200);
      expect(updateRes.body.data.user.display_name).toBe('Journey User');
      expect(updateRes.body.data.user.bio).toBe('This is my journey bio');
      expect(updateRes.body.data.user.avatar_url).toBe('https://example.com/journey.png');

      // Verify changes persist
      await wait(100);

      const getRes = await request(app)
        .get(`/api/users/${userId}`)
        .set('Authorization', `Bearer ${tokens.accessToken}`);

      expect(getRes.status).toBe(200);
      expect(getRes.body.data.user.display_name).toBe('Journey User');
      expect(getRes.body.data.user.bio).toBe('This is my journey bio');
    });

    test('should prevent unauthorized profile updates', async () => {
      const [user1, user2] = await createTestUsers(2);

      const loginRes = await request(app)
        .post('/api/auth/login')
        .send({ username: user1.username, password: user1.plainPassword });

      const tokens = extractTokens(loginRes);

      // Try to update user2's profile
      const updateRes = await request(app)
        .put(`/api/users/${user2.id}`)
        .set('Authorization', `Bearer ${tokens.accessToken}`)
        .send({ displayName: 'Hacked' });

      expect(updateRes.status).toBe(403);

      // Verify user2's profile is unchanged
      const user2Check = await User.findById(user2.id);
      expect(user2Check.display_name).toBe(user2.display_name);
    });
  });

  // ============================================================
  // Social Features Flow
  // ============================================================

  describe('Social Features Flow', () => {
    test('complete follow/unfollow flow', async () => {
      const [user1, user2] = await createTestUsers(2);

      // Login as user1
      const loginRes = await request(app)
        .post('/api/auth/login')
        .send({ username: user1.username, password: user1.plainPassword });

      const tokens = extractTokens(loginRes);

      // Follow user2
      const followRes = await request(app)
        .post(`/api/users/${user2.id}/follow`)
        .set('Authorization', `Bearer ${tokens.accessToken}`);

      expect(followRes.status).toBe(201);

      // Check user2's profile shows is_following
      const profileRes = await request(app)
        .get(`/api/users/${user2.id}`)
        .set('Authorization', `Bearer ${tokens.accessToken}`);

      expect(profileRes.body.data.user.is_following).toBe(true);

      // Check user1's following list
      const followingRes = await request(app)
        .get(`/api/users/${user1.id}/following`)
        .set('Authorization', `Bearer ${tokens.accessToken}`);

      expect(followingRes.status).toBe(200);
      expect(followingRes.body.data.following.length).toBe(1);
      expect(followingRes.body.data.following[0].id).toBe(user2.id);

      // Check user2's followers list
      const followersRes = await request(app)
        .get(`/api/users/${user2.id}/followers`)
        .set('Authorization', `Bearer ${tokens.accessToken}`);

      expect(followersRes.status).toBe(200);
      expect(followersRes.body.data.followers.length).toBe(1);
      expect(followersRes.body.data.followers[0].id).toBe(user1.id);

      // Unfollow user2
      const unfollowRes = await request(app)
        .delete(`/api/users/${user2.id}/follow`)
        .set('Authorization', `Bearer ${tokens.accessToken}`);

      expect(unfollowRes.status).toBe(200);

      // Verify unfollow
      const profileAfterRes = await request(app)
        .get(`/api/users/${user2.id}`)
        .set('Authorization', `Bearer ${tokens.accessToken}`);

      expect(profileAfterRes.body.data.user.is_following).toBe(false);
    });

    test('follower counts update correctly', async () => {
      const target = await createTestUser();
      const followers = await createTestUsers(3);

      for (const follower of followers) {
        const loginRes = await request(app)
          .post('/api/auth/login')
          .send({ username: follower.username, password: follower.plainPassword });

        const tokens = extractTokens(loginRes);

        await request(app)
          .post(`/api/users/${target.id}/follow`)
          .set('Authorization', `Bearer ${tokens.accessToken}`);
      }

      // Verify follower count
      const profileRes = await request(app)
        .get(`/api/users/${target.id}`);

      expect(profileRes.body.data.user.followers_count).toBe(3);

      // Verify each follower's following count
      for (const follower of followers) {
        const profileRes = await request(app)
          .get(`/api/users/${follower.id}`);

        expect(profileRes.body.data.user.following_count).toBe(1);
      }
    });

    test('cannot follow self', async () => {
      const testUser = await createTestUser();

      const loginRes = await request(app)
        .post('/api/auth/login')
        .send({ username: testUser.username, password: testUser.plainPassword });

      const tokens = extractTokens(loginRes);

      const res = await request(app)
        .post(`/api/users/${testUser.id}/follow`)
        .set('Authorization', `Bearer ${tokens.accessToken}`);

      expect(res.status).toBe(400);
      expect(res.body.error.code).toBe('SELF_FOLLOW');
    });

    test('cannot follow same user twice', async () => {
      const [user1, user2] = await createTestUsers(2);

      const loginRes = await request(app)
        .post('/api/auth/login')
        .send({ username: user1.username, password: user1.plainPassword });

      const tokens = extractTokens(loginRes);

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

    test('follower pagination works correctly', async () => {
      const target = await createTestUser();
      const followers = await createTestUsers(25);

      for (const follower of followers) {
        const loginRes = await request(app)
          .post('/api/auth/login')
          .send({ username: follower.username, password: follower.plainPassword });

        const tokens = extractTokens(loginRes);

        await request(app)
          .post(`/api/users/${target.id}/follow`)
          .set('Authorization', `Bearer ${tokens.accessToken}`);
      }

      // Get first page
      const page1Res = await request(app)
        .get(`/api/users/${target.id}/followers`)
        .query({ limit: 10, offset: 0 });

      expect(page1Res.status).toBe(200);
      expect(page1Res.body.data.followers).toHaveLength(10);
      expect(page1Res.body.data.pagination.total).toBe(25);
      expect(page1Res.body.data.pagination.hasMore).toBe(true);

      // Get second page
      const page2Res = await request(app)
        .get(`/api/users/${target.id}/followers`)
        .query({ limit: 10, offset: 10 });

      expect(page2Res.status).toBe(200);
      expect(page2Res.body.data.followers).toHaveLength(10);

      // Get third page
      const page3Res = await request(app)
        .get(`/api/users/${target.id}/followers`)
        .query({ limit: 10, offset: 20 });

      expect(page3Res.status).toBe(200);
      expect(page3Res.body.data.followers).toHaveLength(5);
      expect(page3Res.body.data.pagination.hasMore).toBe(false);
    });
  });

  // ============================================================
  // Search and Discovery Flow
  // ============================================================

  describe('Search and Discovery Flow', () => {
    test('should search and find registered users', async () => {
      // Register several users
      const users = [
        { username: 'gamer_one', email: 'gamer1@test.com', displayName: 'Gamer One' },
        { username: 'gamer_two', email: 'gamer2@test.com', displayName: 'Gamer Two' },
        { username: 'coder_pro', email: 'coder@test.com', displayName: 'Coder Pro' },
      ];

      for (const user of users) {
        await request(app)
          .post('/api/auth/register')
          .send({ ...user, password: 'password123' });
      }

      // Search for gamers
      const gamerRes = await request(app)
        .get('/api/users/search')
        .query({ q: 'gamer' });

      expect(gamerRes.status).toBe(200);
      expect(gamerRes.body.data.users.length).toBe(2);

      // Search for coder
      const coderRes = await request(app)
        .get('/api/users/search')
        .query({ q: 'coder' });

      expect(coderRes.status).toBe(200);
      expect(coderRes.body.data.users.length).toBe(1);

      // Search with display name
      const displayRes = await request(app)
        .get('/api/users/search')
        .query({ q: 'Pro' });

      expect(displayRes.status).toBe(200);
      expect(displayRes.body.data.users.length).toBeGreaterThan(0);
    });

    test('search pagination works correctly', async () => {
      // Create 15 searchable users
      for (let i = 0; i < 15; i++) {
        await createTestUser({
          username: `pagy_user_${i}`,
          email: `pagy_${i}@test.com`,
        });
      }

      const page1Res = await request(app)
        .get('/api/users/search')
        .query({ q: 'pagy_user_', limit: 5 });

      expect(page1Res.status).toBe(200);
      expect(page1Res.body.data.users).toHaveLength(5);
      expect(page1Res.body.data.pagination.hasMore).toBe(true);
    });
  });

  // ============================================================
  // Error Recovery Flows
  // ============================================================

  describe('Error Recovery Flows', () => {
    test('should handle invalid token gracefully', async () => {
      const res = await request(app)
        .get('/api/users/me')
        .set('Authorization', 'Bearer invalid_token_format');

      expect(res.status).toBe(401);
      expect(res.body.success).toBe(false);
      expect(res.body.error).toBeDefined();
    });

    test('should handle expired token with proper error', async () => {
      const testUser = await createTestUser();
      const expiredToken = require('jsonwebtoken').sign(
        { userId: testUser.id, username: testUser.username },
        process.env.JWT_ACCESS_SECRET,
        { expiresIn: '-1h', issuer: 'sukaczev-user-service', audience: 'sukaczev-api' }
      );

      const res = await request(app)
        .get('/api/users/me')
        .set('Authorization', `Bearer ${expiredToken}`);

      expect(res.status).toBe(401);
      expect(res.body.error.code).toBe('TOKEN_EXPIRED');
    });

    test('should handle missing Authorization header', async () => {
      const res = await request(app)
        .get('/api/users/me');

      expect(res.status).toBe(401);
      expect(res.body.error.code).toBe('UNAUTHORIZED');
    });

    test('should handle malformed JSON body', async () => {
      const res = await request(app)
        .post('/api/auth/login')
        .set('Content-Type', 'application/json')
        .send('{ invalid json }');

      expect(res.status).toBe(400);
    });

    test('should handle very large request body', async () => {
      const res = await request(app)
        .post('/api/auth/register')
        .send({
          username: 'sizetest',
          email: 'size@test.com',
          password: 'password123',
          bio: 'a'.repeat(10000), // Very large bio (will be rejected by validation)
        });

      expect(res.status).toBe(400);
    });
  });

  // ============================================================
  // Health Check
  // ============================================================

  describe('Health Check', () => {
    test('should return health status', async () => {
      const res = await request(app)
        .get('/health');

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.service).toBe('user-service');
      expect(res.body.data.status).toBe('healthy');
      expect(res.body.data.timestamp).toBeDefined();
      expect(res.body.data.uptime).toBeDefined();
    });

    test('health check should not require auth', async () => {
      const res = await request(app)
        .get('/health');

      expect(res.status).toBe(200);
      expect(res.headers['x-request-id']).toBeDefined();
    });
  });

  // ============================================================
  // Caching Integration
  // ============================================================

  describe('Caching Integration', () => {
    test('user data should be cached after first fetch', async () => {
      const testUser = await createTestUser();

      // First fetch
      const res1 = await request(app)
        .get(`/api/users/${testUser.id}`);

      expect(res1.status).toBe(200);

      await wait(100);

      // Second fetch should hit cache
      const res2 = await request(app)
        .get(`/api/users/${testUser.id}`);

      expect(res2.status).toBe(200);
      expect(res2.body.data.user.id).toBe(testUser.id);
    });

    test('cache should be invalidated on profile update', async () => {
      const testUser = await createTestUser();

      const loginRes = await request(app)
        .post('/api/auth/login')
        .send({ username: testUser.username, password: testUser.plainPassword });

      const tokens = extractTokens(loginRes);

      // Initial fetch to cache
      await request(app)
        .get(`/api/users/${testUser.id}`)
        .set('Authorization', `Bearer ${tokens.accessToken}`);

      // Update profile
      await request(app)
        .put(`/api/users/${testUser.id}`)
        .set('Authorization', `Bearer ${tokens.accessToken}`)
        .send({ displayName: 'Updated Via Cache' });

      await wait(200);

      // Fetch again - should get updated data
      const res = await request(app)
        .get(`/api/users/${testUser.id}`);

      expect(res.body.data.user.display_name).toBe('Updated Via Cache');
    });
  });

  // ============================================================
  // Boundary and Edge Cases
  // ============================================================

  describe('Boundary and Edge Cases', () => {
    test('should handle username with exactly 2 characters', async () => {
      const res = await request(app)
        .post('/api/auth/register')
        .send({
          username: 'ab',
          email: 'two@chars.com',
          password: 'password123',
        });

      expect(res.status).toBe(201);
    });

    test('should handle username with exactly 20 characters', async () => {
      const res = await request(app)
        .post('/api/auth/register')
        .send({
          username: 'a'.repeat(20),
          email: 'twenty@chars.com',
          password: 'password123',
        });

      expect(res.status).toBe(201);
    });

    test('should handle bio with exactly 500 characters', async () => {
      const testUser = await createTestUser();
      const loginRes = await request(app)
        .post('/api/auth/login')
        .send({ username: testUser.username, password: testUser.plainPassword });

      const tokens = extractTokens(loginRes);

      const res = await request(app)
        .put(`/api/users/${testUser.id}`)
        .set('Authorization', `Bearer ${tokens.accessToken}`)
        .send({ bio: 'a'.repeat(500) });

      expect(res.status).toBe(200);
      expect(res.body.data.user.bio).toBe('a'.repeat(500));
    });

    test('should handle maximum limit of 100 for pagination', async () => {
      const testUser = await createTestUser();

      const res = await request(app)
        .get(`/api/users/${testUser.id}/followers`)
        .query({ limit: 100 });

      expect(res.status).toBe(200);
    });

    test('should handle offset of 0', async () => {
      const testUser = await createTestUser();

      const res = await request(app)
        .get(`/api/users/${testUser.id}/followers`)
        .query({ offset: 0 });

      expect(res.status).toBe(200);
    });

    test('should handle rapid sequential requests', async () => {
      const testUser = await createTestUser();

      const promises = Array.from({ length: 10 }, () =>
        request(app).get(`/api/users/${testUser.id}`)
      );

      const results = await Promise.all(promises);

      results.forEach((res) => {
        expect(res.status).toBe(200);
        expect(res.body.data.user.id).toBe(testUser.id);
      });
    });
  });

  // ============================================================
  // Complete User Lifecycle
  // ============================================================

  describe('Complete User Lifecycle', () => {
    test('full lifecycle: create -> update -> follow -> unfollow -> delete', async () => {
      // Create users
      const [user1, user2] = await createTestUsers(2);

      // Login as user1
      const loginRes = await request(app)
        .post('/api/auth/login')
        .send({ username: user1.username, password: user1.plainPassword });

      const tokens = extractTokens(loginRes);

      // Update profile
      const updateRes = await request(app)
        .put(`/api/users/${user1.id}`)
        .set('Authorization', `Bearer ${tokens.accessToken}`)
        .send({ displayName: 'Lifecycle User', bio: 'Testing lifecycle' });

      expect(updateRes.status).toBe(200);

      // Follow user2
      const followRes = await request(app)
        .post(`/api/users/${user2.id}/follow`)
        .set('Authorization', `Bearer ${tokens.accessToken}`);

      expect(followRes.status).toBe(201);

      // Verify follow
      const followingRes = await request(app)
        .get(`/api/users/${user1.id}/following`)
        .set('Authorization', `Bearer ${tokens.accessToken}`);

      expect(followingRes.body.data.following).toHaveLength(1);

      // Unfollow user2
      const unfollowRes = await request(app)
        .delete(`/api/users/${user2.id}/follow`)
        .set('Authorization', `Bearer ${tokens.accessToken}`);

      expect(unfollowRes.status).toBe(200);

      // Delete account
      const deleteRes = await request(app)
        .delete(`/api/users/${user1.id}`)
        .set('Authorization', `Bearer ${tokens.accessToken}`);

      expect(deleteRes.status).toBe(200);

      // Verify user is deleted
      const checkRes = await request(app)
        .get(`/api/users/${user1.id}`);

      expect(checkRes.status).toBe(404);
    });
  });
});
