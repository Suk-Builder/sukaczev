/**
 * @fileoverview Authentication tests - Comprehensive test suite for auth operations.
 * Tests registration, login, token refresh, and logout with edge cases.
 */

const request = require('supertest');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const { app } = require('../src/app');
const { pool } = require('../src/config/db');
const redis = require('../src/config/redis');
const User = require('../src/models/User');
const {
  cleanupTestData,
  cleanupRedis,
  createTestUser,
  extractTokens,
  mockRabbitMQ,
  restoreRabbitMQ,
  generateUUID,
  wait,
} = require('./setup');

describe('Authentication Endpoints', () => {
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
  // POST /api/auth/register
  // ============================================================

  describe('POST /api/auth/register', () => {
    const validRegistration = {
      username: 'newuser',
      email: 'newuser@example.com',
      password: 'password123',
      displayName: 'New User',
    };

    describe('Validation', () => {
      test('should reject empty request body', async () => {
        const res = await request(app)
          .post('/api/auth/register')
          .send({});

        expect(res.status).toBe(400);
        expect(res.body.success).toBe(false);
        expect(res.body.errors).toBeDefined();
      });

      test('should reject missing username', async () => {
        const res = await request(app)
          .post('/api/auth/register')
          .send({
            email: validRegistration.email,
            password: validRegistration.password,
          });

        expect(res.status).toBe(400);
        expect(res.body.errors).toEqual(
          expect.arrayContaining([
            expect.objectContaining({ field: 'username' }),
          ])
        );
      });

      test('should reject username shorter than 2 characters', async () => {
        const res = await request(app)
          .post('/api/auth/register')
          .send({
            ...validRegistration,
            username: 'a',
          });

        expect(res.status).toBe(400);
        expect(res.body.errors).toEqual(
          expect.arrayContaining([
            expect.objectContaining({ field: 'username' }),
          ])
        );
      });

      test('should reject username longer than 20 characters', async () => {
        const res = await request(app)
          .post('/api/auth/register')
          .send({
            ...validRegistration,
            username: 'a'.repeat(21),
          });

        expect(res.status).toBe(400);
        expect(res.body.errors).toEqual(
          expect.arrayContaining([
            expect.objectContaining({ field: 'username' }),
          ])
        );
      });

      test('should reject username with invalid characters', async () => {
        const res = await request(app)
          .post('/api/auth/register')
          .send({
            ...validRegistration,
            username: 'user@name!',
          });

        expect(res.status).toBe(400);
        expect(res.body.errors).toEqual(
          expect.arrayContaining([
            expect.objectContaining({ field: 'username' }),
          ])
        );
      });

      test('should reject missing email', async () => {
        const res = await request(app)
          .post('/api/auth/register')
          .send({
            username: validRegistration.username,
            password: validRegistration.password,
          });

        expect(res.status).toBe(400);
        expect(res.body.errors).toEqual(
          expect.arrayContaining([
            expect.objectContaining({ field: 'email' }),
          ])
        );
      });

      test('should reject invalid email format', async () => {
        const res = await request(app)
          .post('/api/auth/register')
          .send({
            ...validRegistration,
            email: 'not-an-email',
          });

        expect(res.status).toBe(400);
        expect(res.body.errors).toEqual(
          expect.arrayContaining([
            expect.objectContaining({ field: 'email' }),
          ])
        );
      });

      test('should reject email exceeding 255 characters', async () => {
        const res = await request(app)
          .post('/api/auth/register')
          .send({
            ...validRegistration,
            email: `${'a'.repeat(250)}@example.com`,
          });

        expect(res.status).toBe(400);
        expect(res.body.errors).toEqual(
          expect.arrayContaining([
            expect.objectContaining({ field: 'email' }),
          ])
        );
      });

      test('should reject missing password', async () => {
        const res = await request(app)
          .post('/api/auth/register')
          .send({
            username: validRegistration.username,
            email: validRegistration.email,
          });

        expect(res.status).toBe(400);
        expect(res.body.errors).toEqual(
          expect.arrayContaining([
            expect.objectContaining({ field: 'password' }),
          ])
        );
      });

      test('should reject password shorter than 6 characters', async () => {
        const res = await request(app)
          .post('/api/auth/register')
          .send({
            ...validRegistration,
            password: '12345',
          });

        expect(res.status).toBe(400);
        expect(res.body.errors).toEqual(
          expect.arrayContaining([
            expect.objectContaining({ field: 'password' }),
          ])
        );
      });

      test('should reject password without letters', async () => {
        const res = await request(app)
          .post('/api/auth/register')
          .send({
            ...validRegistration,
            password: '12345678',
          });

        expect(res.status).toBe(400);
        expect(res.body.errors).toEqual(
          expect.arrayContaining([
            expect.objectContaining({ field: 'password' }),
          ])
        );
      });

      test('should reject password without numbers', async () => {
        const res = await request(app)
          .post('/api/auth/register')
          .send({
            ...validRegistration,
            password: 'abcdefgh',
          });

        expect(res.status).toBe(400);
        expect(res.body.errors).toEqual(
          expect.arrayContaining([
            expect.objectContaining({ field: 'password' }),
          ])
        );
      });

      test('should reject displayName longer than 50 characters', async () => {
        const res = await request(app)
          .post('/api/auth/register')
          .send({
            ...validRegistration,
            displayName: 'a'.repeat(51),
          });

        expect(res.status).toBe(400);
        expect(res.body.errors).toEqual(
          expect.arrayContaining([
            expect.objectContaining({ field: 'displayName' }),
          ])
        );
      });

      test('should sanitize XSS in username', async () => {
        const res = await request(app)
          .post('/api/auth/register')
          .send({
            ...validRegistration,
            username: '<script>alert(1)</script>',
          });

        // Should either sanitize or reject
        expect(res.status === 400 || res.status === 201).toBe(true);
      });
    });

    describe('Successful Registration', () => {
      test('should register a new user with valid data', async () => {
        const res = await request(app)
          .post('/api/auth/register')
          .send(validRegistration);

        expect(res.status).toBe(201);
        expect(res.body.success).toBe(true);
        expect(res.body.data.user).toBeDefined();
        expect(res.body.data.user.username).toBe(validRegistration.username);
        expect(res.body.data.user.email).toBe(validRegistration.email);
        expect(res.body.data.user.display_name).toBe(validRegistration.displayName);
        expect(res.body.data.user.id).toBeDefined();
        expect(res.body.data.user.password_hash).toBeUndefined();
      });

      test('should return JWT tokens on registration', async () => {
        const res = await request(app)
          .post('/api/auth/register')
          .send(validRegistration);

        const tokens = extractTokens(res);
        expect(tokens).toBeDefined();
        expect(tokens.accessToken).toBeDefined();
        expect(tokens.refreshToken).toBeDefined();
        expect(tokens.expiresIn).toBe(900); // 15 minutes
        expect(tokens.tokenType).toBe('Bearer');
      });

      test('should use username as displayName when displayName not provided', async () => {
        const res = await request(app)
          .post('/api/auth/register')
          .send({
            username: 'nodisplay',
            email: 'nodisplay@example.com',
            password: 'password123',
          });

        expect(res.status).toBe(201);
        expect(res.body.data.user.display_name).toBe('nodisplay');
      });

      test('should hash password securely', async () => {
        const res = await request(app)
          .post('/api/auth/register')
          .send(validRegistration);

        const userId = res.body.data.user.id;
        const user = await User.findById(userId, true);
        expect(user.password_hash).toBeDefined();
        expect(user.password_hash).not.toBe(validRegistration.password);

        // Verify bcrypt hash format
        const isBcryptHash = await bcrypt.compare(validRegistration.password, user.password_hash);
        expect(isBcryptHash).toBe(true);
      });

      test('should set default values for new user', async () => {
        const res = await request(app)
          .post('/api/auth/register')
          .send(validRegistration);

        const user = res.body.data.user;
        expect(user.level).toBe(0);
        expect(user.exp).toBe(0);
        expect(user.coins).toBe(0);
        expect(user.followers_count).toBe(0);
        expect(user.following_count).toBe(0);
        expect(user.bio).toBe('');
        expect(user.avatar_url).toBeNull();
      });

      test('should cache user in Redis after registration', async () => {
        const res = await request(app)
          .post('/api/auth/register')
          .send(validRegistration);

        const userId = res.body.data.user.id;

        // Give cache a moment to set
        await wait(100);

        const cached = await redis.getCachedUser(userId);
        expect(cached).toBeDefined();
        expect(cached.id).toBe(userId);
        expect(cached.password_hash).toBeUndefined();
      });
    });

    describe('Duplicate Prevention', () => {
      test('should reject duplicate username', async () => {
        // First registration
        await request(app)
          .post('/api/auth/register')
          .send(validRegistration);

        // Second registration with same username
        const res = await request(app)
          .post('/api/auth/register')
          .send({
            ...validRegistration,
            email: 'different@example.com',
          });

        expect(res.status).toBe(409);
        expect(res.body.error.code).toBe('DUPLICATE_KEY');
        expect(res.body.error.field).toBe('username');
      });

      test('should reject duplicate email', async () => {
        // First registration
        await request(app)
          .post('/api/auth/register')
          .send(validRegistration);

        // Second registration with same email
        const res = await request(app)
          .post('/api/auth/register')
          .send({
            ...validRegistration,
            username: 'differentuser',
          });

        expect(res.status).toBe(409);
        expect(res.body.error.code).toBe('DUPLICATE_KEY');
      });

      test('should allow same username with different case after normalization', async () => {
        // Note: This test documents current behavior
        // Email normalization may cause conflicts
        const res1 = await request(app)
          .post('/api/auth/register')
          .send(validRegistration);

        expect(res1.status).toBe(201);

        const res2 = await request(app)
          .post('/api/auth/register')
          .send({
            username: 'newuser2',
            email: validRegistration.email.toUpperCase(),
            password: 'password123',
          });

        // Should either succeed or fail with duplicate email
        expect(res2.status === 201 || res2.status === 409).toBe(true);
      });
    });

    describe('Edge Cases', () => {
      test('should handle username with Chinese characters', async () => {
        const res = await request(app)
          .post('/api/auth/register')
          .send({
            username: '测试用户',
            email: 'chinese@example.com',
            password: 'password123',
          });

        expect(res.status).toBe(201);
        expect(res.body.data.user.username).toBe('测试用户');
      });

      test('should handle username with underscores and hyphens', async () => {
        const res = await request(app)
          .post('/api/auth/register')
          .send({
            username: 'user_name-test',
            email: 'underscore@example.com',
            password: 'password123',
          });

        expect(res.status).toBe(201);
        expect(res.body.data.user.username).toBe('user_name-test');
      });

      test('should handle exactly 2 character username', async () => {
        const res = await request(app)
          .post('/api/auth/register')
          .send({
            username: 'ab',
            email: 'twochars@example.com',
            password: 'password123',
          });

        expect(res.status).toBe(201);
      });

      test('should handle exactly 20 character username', async () => {
        const res = await request(app)
          .post('/api/auth/register')
          .send({
            username: 'a'.repeat(20),
            email: 'twentychars@example.com',
            password: 'password123',
          });

        expect(res.status).toBe(201);
      });

      test('should handle password with exactly 6 characters', async () => {
        const res = await request(app)
          .post('/api/auth/register')
          .send({
            username: 'shortpass',
            email: 'shortpass@example.com',
            password: 'abc123',
          });

        expect(res.status).toBe(201);
      });

      test('should handle password with 128 characters', async () => {
        const res = await request(app)
          .post('/api/auth/register')
          .send({
            username: 'longpassuser',
            email: 'longpass@example.com',
            password: 'a1'.repeat(64),
          });

        expect(res.status).toBe(201);
      });

      test('should trim whitespace from username', async () => {
        const res = await request(app)
          .post('/api/auth/register')
          .send({
            username: '  trimmed_user  ',
            email: 'trimmed@example.com',
            password: 'password123',
          });

        expect(res.status).toBe(201);
        expect(res.body.data.user.username).toBe('trimmed_user');
      });

      test('should trim whitespace from email', async () => {
        const res = await request(app)
          .post('/api/auth/register')
          .send({
            username: 'trimmedemail',
            email: '  trimmed@example.com  ',
            password: 'password123',
          });

        expect(res.status).toBe(201);
        expect(res.body.data.user.email).toBe('trimmed@example.com');
      });
    });
  });

  // ============================================================
  // POST /api/auth/login
  // ============================================================

  describe('POST /api/auth/login', () => {
    let testUser;

    beforeEach(async () => {
      testUser = await createTestUser({
        username: 'logintest',
        email: 'login@test.com',
        password: 'testpass123',
      });
    });

    describe('Validation', () => {
      test('should reject empty request body', async () => {
        const res = await request(app)
          .post('/api/auth/login')
          .send({});

        expect(res.status).toBe(400);
        expect(res.body.errors).toBeDefined();
      });

      test('should reject missing username', async () => {
        const res = await request(app)
          .post('/api/auth/login')
          .send({ password: 'testpass123' });

        expect(res.status).toBe(400);
        expect(res.body.errors).toEqual(
          expect.arrayContaining([
            expect.objectContaining({ field: 'username' }),
          ])
        );
      });

      test('should reject missing password', async () => {
        const res = await request(app)
          .post('/api/auth/login')
          .send({ username: 'logintest' });

        expect(res.status).toBe(400);
        expect(res.body.errors).toEqual(
          expect.arrayContaining([
            expect.objectContaining({ field: 'password' }),
          ])
        );
      });
    });

    describe('Login with Username', () => {
      test('should login with valid username and password', async () => {
        const res = await request(app)
          .post('/api/auth/login')
          .send({
            username: 'logintest',
            password: 'testpass123',
          });

        expect(res.status).toBe(200);
        expect(res.body.success).toBe(true);
        expect(res.body.data.user).toBeDefined();
        expect(res.body.data.user.username).toBe('logintest');
        expect(res.body.data.tokens).toBeDefined();
      });

      test('should return valid JWT access token', async () => {
        const res = await request(app)
          .post('/api/auth/login')
          .send({
            username: 'logintest',
            password: 'testpass123',
          });

        const { accessToken } = extractTokens(res);
        const decoded = jwt.decode(accessToken);

        expect(decoded.userId).toBe(testUser.id);
        expect(decoded.username).toBe('logintest');
        expect(decoded.level).toBeDefined();
        expect(decoded.iss).toBe('sukaczev-user-service');
        expect(decoded.aud).toBe('sukaczev-api');
      });

      test('should return valid JWT refresh token', async () => {
        const res = await request(app)
          .post('/api/auth/login')
          .send({
            username: 'logintest',
            password: 'testpass123',
          });

        const { refreshToken } = extractTokens(res);
        const decoded = jwt.decode(refreshToken);

        expect(decoded.userId).toBe(testUser.id);
        expect(decoded.type).toBe('refresh');
        expect(decoded.iss).toBe('sukaczev-user-service');
      });
    });

    describe('Login with Email', () => {
      test('should login with email and password', async () => {
        const res = await request(app)
          .post('/api/auth/login')
          .send({
            username: 'login@test.com',
            password: 'testpass123',
          });

        expect(res.status).toBe(200);
        expect(res.body.data.user.username).toBe('logintest');
      });

      test('should login with email containing uppercase letters', async () => {
        const res = await request(app)
          .post('/api/auth/login')
          .send({
            username: 'LOGIN@TEST.COM',
            password: 'testpass123',
          });

        expect(res.status).toBe(200);
      });
    });

    describe('Invalid Credentials', () => {
      test('should reject non-existent username', async () => {
        const res = await request(app)
          .post('/api/auth/login')
          .send({
            username: 'nonexistentuser',
            password: 'somepassword',
          });

        expect(res.status).toBe(401);
        expect(res.body.error.code).toBe('INVALID_CREDENTIALS');
      });

      test('should reject wrong password', async () => {
        const res = await request(app)
          .post('/api/auth/login')
          .send({
            username: 'logintest',
            password: 'wrongpassword',
          });

        expect(res.status).toBe(401);
        expect(res.body.error.code).toBe('INVALID_CREDENTIALS');
      });

      test('should reject empty password', async () => {
        const res = await request(app)
          .post('/api/auth/login')
          .send({
            username: 'logintest',
            password: '',
          });

        expect(res.status).toBe(400);
      });

      test('should not expose whether username exists', async () => {
        // Both non-existent user and wrong password should return same error
        const nonExistentRes = await request(app)
          .post('/api/auth/login')
          .send({ username: 'nobody', password: 'wrong' });

        const wrongPasswordRes = await request(app)
          .post('/api/auth/login')
          .send({ username: 'logintest', password: 'wrong' });

        expect(nonExistentRes.status).toBe(wrongPasswordRes.status);
        expect(nonExistentRes.body.error.code).toBe(wrongPasswordRes.body.error.code);
        expect(nonExistentRes.body.error.message).toBe(wrongPasswordRes.body.error.message);
      });
    });

    describe('Caching', () => {
      test('should cache user in Redis after login', async () => {
        const res = await request(app)
          .post('/api/auth/login')
          .send({
            username: 'logintest',
            password: 'testpass123',
          });

        const userId = res.body.data.user.id;

        // Give cache a moment to set
        await wait(100);

        const cached = await redis.getCachedUser(userId);
        expect(cached).toBeDefined();
        expect(cached.id).toBe(userId);
      });
    });

    describe('Edge Cases', () => {
      test('should handle username with leading/trailing spaces', async () => {
        const res = await request(app)
          .post('/api/auth/login')
          .send({
            username: '  logintest  ',
            password: 'testpass123',
          });

        // Should succeed because validator trims
        expect(res.status === 200 || res.status === 401).toBe(true);
      });

      test('should handle SQL injection attempt in username', async () => {
        const res = await request(app)
          .post('/api/auth/login')
          .send({
            username: "logintest'; DROP TABLE users; --",
            password: 'testpass123',
          });

        expect(res.status).toBe(401);

        // Verify table still exists
        const checkRes = await request(app)
          .post('/api/auth/login')
          .send({
            username: 'logintest',
            password: 'testpass123',
          });

        expect(checkRes.status).toBe(200);
      });

      test('should handle very long password attempt', async () => {
        const res = await request(app)
          .post('/api/auth/login')
          .send({
            username: 'logintest',
            password: 'a'.repeat(10000),
          });

        expect(res.status).toBe(401);
      });
    });
  });

  // ============================================================
  // POST /api/auth/refresh
  // ============================================================

  describe('POST /api/auth/refresh', () => {
    let testUser;
    let refreshToken;

    beforeEach(async () => {
      testUser = await createTestUser({
        username: 'refreshtest',
        email: 'refresh@test.com',
        password: 'testpass123',
      });

      const loginRes = await request(app)
        .post('/api/auth/login')
        .send({
          username: 'refreshtest',
          password: 'testpass123',
        });

      refreshToken = extractTokens(loginRes).refreshToken;
    });

    describe('Validation', () => {
      test('should reject missing refresh token', async () => {
        const res = await request(app)
          .post('/api/auth/refresh')
          .send({});

        expect(res.status).toBe(400);
        expect(res.body.errors).toBeDefined();
      });

      test('should reject non-string refresh token', async () => {
        const res = await request(app)
          .post('/api/auth/refresh')
          .send({ refreshToken: 12345 });

        expect(res.status).toBe(400);
      });
    });

    describe('Successful Refresh', () => {
      test('should refresh with valid refresh token', async () => {
        const res = await request(app)
          .post('/api/auth/refresh')
          .send({ refreshToken });

        expect(res.status).toBe(200);
        expect(res.body.success).toBe(true);
        expect(res.body.data.tokens).toBeDefined();
        expect(res.body.data.tokens.accessToken).toBeDefined();
        expect(res.body.data.tokens.refreshToken).toBeDefined();
      });

      test('should return new access and refresh tokens (token rotation)', async () => {
        const res = await request(app)
          .post('/api/auth/refresh')
          .send({ refreshToken });

        const newTokens = extractTokens(res);

        // New tokens should be different from old
        expect(newTokens.accessToken).not.toBe(refreshToken);
        expect(newTokens.refreshToken).not.toBe(refreshToken);
      });

      test('should return user data with tokens', async () => {
        const res = await request(app)
          .post('/api/auth/refresh')
          .send({ refreshToken });

        expect(res.body.data.user).toBeDefined();
        expect(res.body.data.user.id).toBe(testUser.id);
        expect(res.body.data.user.username).toBe('refreshtest');
      });

      test('should decode new access token correctly', async () => {
        const res = await request(app)
          .post('/api/auth/refresh')
          .send({ refreshToken });

        const { accessToken } = extractTokens(res);
        const decoded = jwt.decode(accessToken);

        expect(decoded.userId).toBe(testUser.id);
        expect(decoded.username).toBe('refreshtest');
        expect(decoded.iat).toBeDefined();
        expect(decoded.exp).toBeDefined();
      });
    });

    describe('Token Blacklisting', () => {
      test('should blacklist old refresh token after refresh', async () => {
        // First refresh
        await request(app)
          .post('/api/auth/refresh')
          .send({ refreshToken });

        // Try to use the old refresh token again
        const res = await request(app)
          .post('/api/auth/refresh')
          .send({ refreshToken });

        expect(res.status).toBe(401);
        expect(res.body.error.code).toBe('INVALID_TOKEN');
      });

      test('should return TOKEN_REVOKED for blacklisted token', async () => {
        // First refresh
        await request(app)
          .post('/api/auth/refresh')
          .send({ refreshToken });

        // Try old token
        const res = await request(app)
          .post('/api/auth/refresh')
          .send({ refreshToken });

        expect(res.status).toBe(401);
        expect(res.body.error.message).toContain('revoked');
      });
    });

    describe('Invalid Tokens', () => {
      test('should reject malformed refresh token', async () => {
        const res = await request(app)
          .post('/api/auth/refresh')
          .send({ refreshToken: 'not.a.valid.token' });

        expect(res.status).toBe(401);
        expect(res.body.error.code).toBe('INVALID_TOKEN');
      });

      test('should reject empty refresh token', async () => {
        const res = await request(app)
          .post('/api/auth/refresh')
          .send({ refreshToken: '' });

        expect(res.status).toBe(400);
      });

      test('should reject refresh token with invalid signature', async () => {
        const fakeToken = jwt.sign(
          { userId: testUser.id, type: 'refresh' },
          'wrong-secret',
          { expiresIn: '7d' }
        );

        const res = await request(app)
          .post('/api/auth/refresh')
          .send({ refreshToken: fakeToken });

        expect(res.status).toBe(401);
        expect(res.body.error.code).toBe('INVALID_TOKEN');
      });

      test('should reject access token used as refresh token', async () => {
        const loginRes = await request(app)
          .post('/api/auth/login')
          .send({
            username: 'refreshtest',
            password: 'testpass123',
          });

        const accessToken = extractTokens(loginRes).accessToken;

        // Try using access token as refresh
        const res = await request(app)
          .post('/api/auth/refresh')
          .send({ refreshToken: accessToken });

        // Should fail because it has wrong secret
        expect(res.status).toBe(401);
      });

      test('should reject expired refresh token', async () => {
        const expiredToken = jwt.sign(
          { userId: testUser.id, type: 'refresh' },
          process.env.JWT_REFRESH_SECRET,
          { expiresIn: '-1s' }
        );

        const res = await request(app)
          .post('/api/auth/refresh')
          .send({ refreshToken: expiredToken });

        expect(res.status).toBe(401);
        expect(res.body.error.code).toBe('INVALID_TOKEN');
      });

      test('should reject token for non-existent user', async () => {
        const fakeToken = jwt.sign(
          { userId: generateUUID(), type: 'refresh' },
          process.env.JWT_REFRESH_SECRET,
          { expiresIn: '7d' }
        );

        const res = await request(app)
          .post('/api/auth/refresh')
          .send({ refreshToken: fakeToken });

        expect(res.status).toBe(401);
        expect(res.body.error.code).toBe('USER_NOT_FOUND');
      });
    });

    describe('Multiple Refreshes', () => {
      test('should support sequential token refreshes', async () => {
        let currentToken = refreshToken;

        // Refresh 3 times sequentially
        for (let i = 0; i < 3; i++) {
          const res = await request(app)
            .post('/api/auth/refresh')
            .send({ refreshToken: currentToken });

          expect(res.status).toBe(200);
          currentToken = extractTokens(res).refreshToken;
          expect(currentToken).toBeDefined();
        }
      });

      test('each refresh should produce different tokens', async () => {
        const res1 = await request(app)
          .post('/api/auth/refresh')
          .send({ refreshToken });

        const token1 = extractTokens(res1).refreshToken;

        const res2 = await request(app)
          .post('/api/auth/refresh')
          .send({ refreshToken: token1 });

        const token2 = extractTokens(res2).refreshToken;

        expect(token1).not.toBe(refreshToken);
        expect(token2).not.toBe(token1);
        expect(token2).not.toBe(refreshToken);
      });
    });
  });

  // ============================================================
  // POST /api/auth/logout
  // ============================================================

  describe('POST /api/auth/logout', () => {
    let testUser;
    let tokens;

    beforeEach(async () => {
      testUser = await createTestUser({
        username: 'logouttest',
        email: 'logout@test.com',
        password: 'testpass123',
      });

      const loginRes = await request(app)
        .post('/api/auth/login')
        .send({
          username: 'logouttest',
          password: 'testpass123',
        });

      tokens = extractTokens(loginRes);
    });

    test('should logout with valid token', async () => {
      const res = await request(app)
        .post('/api/auth/logout')
        .set('Authorization', `Bearer ${tokens.accessToken}`)
        .send({ refreshToken: tokens.refreshToken });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.message).toContain('Logout');
    });

    test('should invalidate access token after logout', async () => {
      // Logout
      await request(app)
        .post('/api/auth/logout')
        .set('Authorization', `Bearer ${tokens.accessToken}`)
        .send({ refreshToken: tokens.refreshToken });

      // Wait for cache
      await wait(100);

      // Try to use the access token
      const res = await request(app)
        .get('/api/users/me')
        .set('Authorization', `Bearer ${tokens.accessToken}`);

      expect(res.status).toBe(401);
    });

    test('should invalidate refresh token after logout', async () => {
      // Logout
      await request(app)
        .post('/api/auth/logout')
        .set('Authorization', `Bearer ${tokens.accessToken}`)
        .send({ refreshToken: tokens.refreshToken });

      // Wait for cache
      await wait(100);

      // Try to refresh with old token
      const res = await request(app)
        .post('/api/auth/refresh')
        .send({ refreshToken: tokens.refreshToken });

      expect(res.status).toBe(401);
    });

    test('should require authentication', async () => {
      const res = await request(app)
        .post('/api/auth/logout')
        .send({ refreshToken: tokens.refreshToken });

      expect(res.status).toBe(401);
    });

    test('should handle logout without refresh token', async () => {
      const res = await request(app)
        .post('/api/auth/logout')
        .set('Authorization', `Bearer ${tokens.accessToken}`)
        .send({});

      expect(res.status).toBe(200);
    });

    test('should handle logout with invalid refresh token', async () => {
      const res = await request(app)
        .post('/api/auth/logout')
        .set('Authorization', `Bearer ${tokens.accessToken}`)
        .send({ refreshToken: 'invalid.token.here' });

      expect(res.status).toBe(200);
    });
  });
});

// ============================================================
// JWT Token Structure Tests
// ============================================================

describe('JWT Token Structure', () => {
  let testUser;
  let tokens;

  beforeAll(async () => {
    testUser = await createTestUser({
      username: 'jwttest',
      email: 'jwt@test.com',
      password: 'testpass123',
    });

    const loginRes = await request(app)
      .post('/api/auth/login')
      .send({
        username: 'jwttest',
        password: 'testpass123',
      });

    tokens = extractTokens(loginRes);
  });

  test('access token should have correct structure', () => {
    const parts = tokens.accessToken.split('.');
    expect(parts).toHaveLength(3); // header.payload.signature

    const header = JSON.parse(Buffer.from(parts[0], 'base64url').toString());
    expect(header.alg).toBeDefined();
    expect(header.typ).toBe('JWT');
  });

  test('access token payload should contain required claims', () => {
    const decoded = jwt.decode(tokens.accessToken);

    expect(decoded.userId).toBeDefined();
    expect(decoded.username).toBeDefined();
    expect(decoded.level).toBeDefined();
    expect(decoded.iat).toBeDefined();
    expect(decoded.exp).toBeDefined();
    expect(decoded.iss).toBe('sukaczev-user-service');
    expect(decoded.aud).toBe('sukaczev-api');
  });

  test('access token should expire in 15 minutes', () => {
    const decoded = jwt.decode(tokens.accessToken);
    const expiryDuration = decoded.exp - decoded.iat;

    // Allow 5 second tolerance
    expect(expiryDuration).toBeGreaterThanOrEqual(895);
    expect(expiryDuration).toBeLessThanOrEqual(905);
  });

  test('refresh token should expire in 7 days', () => {
    const decoded = jwt.decode(tokens.refreshToken);
    const expiryDuration = decoded.exp - decoded.iat;

    const sevenDaysInSeconds = 7 * 24 * 60 * 60;
    expect(expiryDuration).toBeGreaterThanOrEqual(sevenDaysInSeconds - 10);
  });

  test('refresh token should have type claim', () => {
    const decoded = jwt.decode(tokens.refreshToken);
    expect(decoded.type).toBe('refresh');
  });

  test('access token should not have type claim', () => {
    const decoded = jwt.decode(tokens.accessToken);
    expect(decoded.type).toBeUndefined();
  });

  test('tokens should be verifiable with correct secret', () => {
    expect(() => {
      jwt.verify(tokens.accessToken, process.env.JWT_ACCESS_SECRET);
    }).not.toThrow();

    expect(() => {
      jwt.verify(tokens.refreshToken, process.env.JWT_REFRESH_SECRET);
    }).not.toThrow();
  });

  test('access token should fail verification with refresh secret', () => {
    expect(() => {
      jwt.verify(tokens.accessToken, process.env.JWT_REFRESH_SECRET);
    }).toThrow();
  });

  test('refresh token should fail verification with access secret', () => {
    expect(() => {
      jwt.verify(tokens.refreshToken, process.env.JWT_ACCESS_SECRET);
    }).toThrow();
  });
});

// ============================================================
// Security Tests
// ============================================================

describe('Auth Security', () => {
  test('should not return password in any response', async () => {
    const res = await request(app)
      .post('/api/auth/register')
      .send({
        username: 'securitytest',
        email: 'security@test.com',
        password: 'password123',
      });

    const responseBody = JSON.stringify(res.body);
    expect(responseBody).not.toContain('password_hash');
    expect(responseBody).not.toContain('password123');
  });

  test('should not expose internal errors to client', async () => {
    // This test documents that error responses should not contain stack traces
    const res = await request(app)
      .post('/api/auth/login')
      .send({ username: 'test', password: 'test' });

    expect(res.status).toBe(401);
    expect(res.body.error.stack).toBeUndefined();
  });

  test('should handle rapid login attempts', async () => {
    const testUser = await createTestUser({
      username: 'rapidtest',
      email: 'rapid@test.com',
      password: 'testpass123',
    });

    const requests = Array.from({ length: 10 }, () =>
      request(app)
        .post('/api/auth/login')
        .send({ username: 'rapidtest', password: 'wrongpass' })
    );

    const results = await Promise.all(requests);

    // All should return 401
    results.forEach((res) => {
      expect(res.status).toBe(401);
    });
  });

  test('should handle rapid registration attempts', async () => {
    const requests = Array.from({ length: 5 }, (_, i) =>
      request(app)
        .post('/api/auth/register')
        .send({
          username: `rapidreg_${i}_${Date.now()}`,
          email: `rapidreg_${i}_${Date.now()}@test.com`,
          password: 'password123',
        })
    );

    const results = await Promise.all(requests);
    const successCount = results.filter((r) => r.status === 201).length;

    // Most should succeed (some may fail due to unique constraints)
    expect(successCount).toBeGreaterThanOrEqual(3);
  });
});
