/**
 * @fileoverview Middleware tests - Comprehensive test suite for middleware components.
 * Tests JWT authentication, error handling, input validation, and edge cases.
 */

const request = require('supertest');
const jwt = require('jsonwebtoken');
const { app } = require('../src/app');
const { authenticate, optionalAuth, extractToken } = require('../src/middleware/auth');
const { AppError, errorHandler, notFoundHandler, asyncHandler } = require('../src/middleware/errorHandler');
const {
  registerValidation,
  loginValidation,
  refreshValidation,
  updateUserValidation,
  userIdValidation,
  paginationValidation,
  followValidation,
  searchValidation,
} = require('../src/middleware/validator');
const User = require('../src/models/User');
const redis = require('../src/config/redis');
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

describe('Middleware', () => {
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
  // JWT Authentication Middleware
  // ============================================================

  describe('authenticate', () => {
    test('should allow request with valid token', async () => {
      const testUser = await createTestUser();
      const tokens = extractTokens(
        await request(app)
          .post('/api/auth/login')
          .send({ username: testUser.username, password: testUser.plainPassword })
      );

      const res = await request(app)
        .get('/api/users/me')
        .set('Authorization', `Bearer ${tokens.accessToken}`);

      expect(res.status).toBe(200);
    });

    test('should reject request without Authorization header', async () => {
      const res = await request(app)
        .get('/api/users/me');

      expect(res.status).toBe(401);
      expect(res.body.error.code).toBe('UNAUTHORIZED');
      expect(res.body.error.message).toContain('Access token is required');
    });

    test('should reject request with empty Authorization header', async () => {
      const res = await request(app)
        .get('/api/users/me')
        .set('Authorization', '');

      expect(res.status).toBe(401);
    });

    test('should reject request with malformed Authorization header', async () => {
      const res = await request(app)
        .get('/api/users/me')
        .set('Authorization', 'NotBearer token');

      expect(res.status).toBe(401);
    });

    test('should reject request with Bearer but no token', async () => {
      const res = await request(app)
        .get('/api/users/me')
        .set('Authorization', 'Bearer ');

      expect(res.status).toBe(401);
    });

    test('should reject invalid token format', async () => {
      const res = await request(app)
        .get('/api/users/me')
        .set('Authorization', 'Bearer not-a-valid-jwt');

      expect(res.status).toBe(401);
      expect(res.body.error.code).toBe('INVALID_TOKEN');
    });

    test('should reject expired token', async () => {
      const testUser = await createTestUser();
      const expiredToken = jwt.sign(
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

    test('should reject token with invalid signature', async () => {
      const testUser = await createTestUser();
      const fakeToken = jwt.sign(
        { userId: testUser.id, username: testUser.username },
        'wrong-secret-key',
        { expiresIn: '15m' }
      );

      const res = await request(app)
        .get('/api/users/me')
        .set('Authorization', `Bearer ${fakeToken}`);

      expect(res.status).toBe(401);
    });

    test('should reject token with wrong issuer', async () => {
      const testUser = await createTestUser();
      const fakeToken = jwt.sign(
        { userId: testUser.id, username: testUser.username },
        process.env.JWT_ACCESS_SECRET,
        { expiresIn: '15m', issuer: 'wrong-issuer', audience: 'sukaczev-api' }
      );

      const res = await request(app)
        .get('/api/users/me')
        .set('Authorization', `Bearer ${fakeToken}`);

      expect(res.status).toBe(401);
    });

    test('should reject token with wrong audience', async () => {
      const testUser = await createTestUser();
      const fakeToken = jwt.sign(
        { userId: testUser.id, username: testUser.username },
        process.env.JWT_ACCESS_SECRET,
        { expiresIn: '15m', issuer: 'sukaczev-user-service', audience: 'wrong-audience' }
      );

      const res = await request(app)
        .get('/api/users/me')
        .set('Authorization', `Bearer ${fakeToken}`);

      expect(res.status).toBe(401);
    });

    test('should reject revoked token', async () => {
      const testUser = await createTestUser();
      const tokens = extractTokens(
        await request(app)
          .post('/api/auth/login')
          .send({ username: testUser.username, password: testUser.plainPassword })
      );

      // Logout to revoke token
      await request(app)
        .post('/api/auth/logout')
        .set('Authorization', `Bearer ${tokens.accessToken}`)
        .send({ refreshToken: tokens.refreshToken });

      await wait(200);

      // Try to use revoked token
      const res = await request(app)
        .get('/api/users/me')
        .set('Authorization', `Bearer ${tokens.accessToken}`);

      expect(res.status).toBe(401);
      expect(res.body.error.code).toBe('TOKEN_REVOKED');
    });

    test('should attach user object to request', async () => {
      const testUser = await createTestUser();
      const tokens = extractTokens(
        await request(app)
          .post('/api/auth/login')
          .send({ username: testUser.username, password: testUser.plainPassword })
      );

      const res = await request(app)
        .get('/api/users/me')
        .set('Authorization', `Bearer ${tokens.accessToken}`);

      // The response should contain user data that was attached via middleware
      expect(res.body.data.user).toBeDefined();
      expect(res.body.data.user.id).toBe(testUser.id);
    });

    test('should extract token from header correctly', () => {
      const req = { headers: { authorization: 'Bearer test-token-123' } };
      const token = extractToken(req);
      expect(token).toBe('test-token-123');
    });

    test('extractToken should return null for missing header', () => {
      const req = { headers: {} };
      const token = extractToken(req);
      expect(token).toBeNull();
    });

    test('extractToken should return null for non-Bearer scheme', () => {
      const req = { headers: { authorization: 'Basic dXNlcjpwYXNz' } };
      const token = extractToken(req);
      expect(token).toBeNull();
    });
  });

  // ============================================================
  // Optional Auth Middleware
  // ============================================================

  describe('optionalAuth', () => {
    test('should attach user when valid token provided', async () => {
      const testUser = await createTestUser();
      const tokens = extractTokens(
        await request(app)
          .post('/api/auth/login')
          .send({ username: testUser.username, password: testUser.plainPassword })
      );

      const res = await request(app)
        .get(`/api/users/${testUser.id}`)
        .set('Authorization', `Bearer ${tokens.accessToken}`);

      expect(res.status).toBe(200);
    });

    test('should allow request without token', async () => {
      const testUser = await createTestUser();

      const res = await request(app)
        .get(`/api/users/${testUser.id}`);

      expect(res.status).toBe(200);
    });

    test('should allow request with invalid token', async () => {
      const testUser = await createTestUser();

      const res = await request(app)
        .get(`/api/users/${testUser.id}`)
        .set('Authorization', 'Bearer invalid-token');

      expect(res.status).toBe(200);
    });
  });

  // ============================================================
  // Error Handler Middleware
  // ============================================================

  describe('errorHandler', () => {
    test('should handle generic errors with 500 status', () => {
      const err = new Error('Something went wrong');
      const req = { method: 'GET', path: '/test', id: 'test-id' };
      const res = {
        status: jest.fn().mockReturnThis(),
        json: jest.fn().mockReturnThis(),
      };
      const next = jest.fn();

      errorHandler(err, req, res, next);

      expect(res.status).toHaveBeenCalledWith(500);
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({
          success: false,
          error: expect.objectContaining({
            code: 'INTERNAL_ERROR',
            message: 'Something went wrong',
          }),
        })
      );
    });

    test('should handle AppError with custom status code', () => {
      const err = new AppError('Not found', 404, 'NOT_FOUND');
      const req = { method: 'GET', path: '/test' };
      const res = {
        status: jest.fn().mockReturnThis(),
        json: jest.fn().mockReturnThis(),
      };
      const next = jest.fn();

      errorHandler(err, req, res, next);

      expect(res.status).toHaveBeenCalledWith(404);
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({
          success: false,
          error: expect.objectContaining({
            code: 'NOT_FOUND',
            message: 'Not found',
          }),
        })
      );
    });

    test('should handle duplicate key errors', () => {
      const err = new Error('Duplicate');
      err.code = '23505';
      err.constraint = 'users_username_key';
      const req = { method: 'POST', path: '/test' };
      const res = {
        status: jest.fn().mockReturnThis(),
        json: jest.fn().mockReturnThis(),
      };
      const next = jest.fn();

      errorHandler(err, req, res, next);

      expect(res.status).toHaveBeenCalledWith(409);
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({
          error: expect.objectContaining({ code: 'DUPLICATE_KEY' }),
        })
      );
    });

    test('should handle foreign key constraint errors', () => {
      const err = new Error('FK violation');
      err.code = '23503';
      const req = { method: 'POST', path: '/test' };
      const res = {
        status: jest.fn().mockReturnThis(),
        json: jest.fn().mockReturnThis(),
      };
      const next = jest.fn();

      errorHandler(err, req, res, next);

      expect(res.status).toHaveBeenCalledWith(404);
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({
          error: expect.objectContaining({
            code: 'REFERENCED_NOT_FOUND',
            message: 'Referenced resource not found',
          }),
        })
      );
    });

    test('should handle invalid data format errors', () => {
      const err = new Error('Invalid data');
      err.code = '22P02';
      const req = { method: 'POST', path: '/test' };
      const res = {
        status: jest.fn().mockReturnThis(),
        json: jest.fn().mockReturnThis(),
      };
      const next = jest.fn();

      errorHandler(err, req, res, next);

      expect(res.status).toHaveBeenCalledWith(400);
    });

    test('should handle connection refused errors', () => {
      const err = new Error('Connection refused');
      err.code = 'ECONNREFUSED';
      const req = { method: 'GET', path: '/test' };
      const res = {
        status: jest.fn().mockReturnThis(),
        json: jest.fn().mockReturnThis(),
      };
      const next = jest.fn();

      errorHandler(err, req, res, next);

      expect(res.status).toHaveBeenCalledWith(503);
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({
          error: expect.objectContaining({
            code: 'SERVICE_UNAVAILABLE',
          }),
        })
      );
    });

    test('should not include stack trace in production', () => {
      const originalEnv = process.env.NODE_ENV;
      process.env.NODE_ENV = 'production';

      const err = new Error('Test error');
      const req = { method: 'GET', path: '/test' };
      const res = {
        status: jest.fn().mockReturnThis(),
        json: jest.fn().mockReturnThis(),
      };
      const next = jest.fn();

      errorHandler(err, req, res, next);

      const jsonCall = res.json.mock.calls[0][0];
      expect(jsonCall.error.stack).toBeUndefined();

      process.env.NODE_ENV = originalEnv;
    });

    test('should include request ID if available', () => {
      const err = new Error('Test error');
      const req = { method: 'GET', path: '/test', id: 'req-123' };
      const res = {
        status: jest.fn().mockReturnThis(),
        json: jest.fn().mockReturnThis(),
      };
      const next = jest.fn();

      errorHandler(err, req, res, next);

      const jsonCall = res.json.mock.calls[0][0];
      expect(jsonCall.error.requestId).toBe('req-123');
    });
  });

  // ============================================================
  // Not Found Handler
  // ============================================================

  describe('notFoundHandler', () => {
    test('should return 404 for undefined routes', async () => {
      const res = await request(app)
        .get('/api/nonexistent/route');

      expect(res.status).toBe(404);
      expect(res.body.error.code).toBe('ROUTE_NOT_FOUND');
    });

    test('should include route path in error message', async () => {
      const res = await request(app)
        .get('/api/something/missing');

      expect(res.body.error.message).toContain('/api/something/missing');
    });
  });

  // ============================================================
  // Async Handler
  // ============================================================

  describe('asyncHandler', () => {
    test('should catch errors in async functions', async () => {
      const asyncFn = jest.fn().mockRejectedValue(new Error('Async error'));
      const wrapped = asyncHandler(asyncFn);

      const req = {};
      const res = {};
      const next = jest.fn();

      await wrapped(req, res, next);

      expect(next).toHaveBeenCalledWith(expect.any(Error));
    });

    test('should pass successful execution', async () => {
      const asyncFn = jest.fn().mockResolvedValue('success');
      const wrapped = asyncHandler(asyncFn);

      const req = {};
      const res = {};
      const next = jest.fn();

      await wrapped(req, res, next);

      expect(asyncFn).toHaveBeenCalled();
    });
  });

  // ============================================================
  // Validation Middleware
  // ============================================================

  describe('registerValidation', () => {
    test('should have validation rules defined', () => {
      expect(registerValidation).toBeDefined();
      expect(Array.isArray(registerValidation)).toBe(true);
      expect(registerValidation.length).toBeGreaterThan(0);
    });

    test('should validate username field', async () => {
      const res = await request(app)
        .post('/api/auth/register')
        .send({ email: 'test@test.com', password: 'password123' });

      expect(res.status).toBe(400);
      expect(res.body.errors).toBeDefined();
    });

    test('should validate email field', async () => {
      const res = await request(app)
        .post('/api/auth/register')
        .send({ username: 'testuser', password: 'password123' });

      expect(res.status).toBe(400);
      expect(res.body.errors).toBeDefined();
    });

    test('should validate password field', async () => {
      const res = await request(app)
        .post('/api/auth/register')
        .send({ username: 'testuser', email: 'test@test.com' });

      expect(res.status).toBe(400);
      expect(res.body.errors).toBeDefined();
    });
  });

  describe('loginValidation', () => {
    test('should have validation rules defined', () => {
      expect(loginValidation).toBeDefined();
      expect(Array.isArray(loginValidation)).toBe(true);
    });

    test('should validate username', async () => {
      const res = await request(app)
        .post('/api/auth/login')
        .send({ password: 'password123' });

      expect(res.status).toBe(400);
      expect(res.body.errors).toBeDefined();
    });

    test('should validate password', async () => {
      const res = await request(app)
        .post('/api/auth/login')
        .send({ username: 'testuser' });

      expect(res.status).toBe(400);
      expect(res.body.errors).toBeDefined();
    });
  });

  describe('refreshValidation', () => {
    test('should validate refresh token', async () => {
      const res = await request(app)
        .post('/api/auth/refresh')
        .send({});

      expect(res.status).toBe(400);
      expect(res.body.errors).toBeDefined();
    });
  });

  describe('updateUserValidation', () => {
    test('should validate user ID parameter', async () => {
      const testUser = await createTestUser();
      const tokens = extractTokens(
        await request(app)
          .post('/api/auth/login')
          .send({ username: testUser.username, password: testUser.plainPassword })
      );

      const res = await request(app)
        .put('/api/users/invalid-uuid')
        .set('Authorization', `Bearer ${tokens.accessToken}`)
        .send({ displayName: 'Test' });

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
        .send({ displayName: 'a'.repeat(51) });

      expect(res.status).toBe(400);
    });

    test('should validate bio length', async () => {
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
        .send({ avatarUrl: 'not-a-valid-url' });

      expect(res.status).toBe(400);
    });
  });

  describe('userIdValidation', () => {
    test('should reject invalid UUID format', async () => {
      const res = await request(app)
        .get('/api/users/not-a-uuid');

      expect(res.status).toBe(400);
    });
  });

  describe('paginationValidation', () => {
    test('should reject negative limit', async () => {
      const testUser = await createTestUser();

      const res = await request(app)
        .get(`/api/users/${testUser.id}/followers`)
        .query({ limit: -1 });

      expect(res.status).toBe(400);
    });

    test('should reject limit over 100', async () => {
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
  });

  describe('followValidation', () => {
    test('should reject invalid UUID for follow', async () => {
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

  describe('searchValidation', () => {
    test('should reject empty query', async () => {
      const res = await request(app)
        .get('/api/users/search')
        .query({ q: '' });

      expect(res.status).toBe(400);
    });

    test('should reject single character query', async () => {
      const res = await request(app)
        .get('/api/users/search')
        .query({ q: 'a' });

      expect(res.status).toBe(400);
    });

    test('should reject query over 100 characters', async () => {
      const res = await request(app)
        .get('/api/users/search')
        .query({ q: 'a'.repeat(101) });

      expect(res.status).toBe(400);
    });
  });

  // ============================================================
  // Request ID Middleware
  // ============================================================

  describe('Request ID', () => {
    test('should include X-Request-Id header in response', async () => {
      const res = await request(app)
        .get('/health');

      expect(res.headers['x-request-id']).toBeDefined();
    });

    test('should include X-Request-Id in error responses', async () => {
      const res = await request(app)
        .get('/api/nonexistent');

      expect(res.headers['x-request-id']).toBeDefined();
      expect(res.status).toBe(404);
    });
  });

  // ============================================================
  // Security Headers
  // ============================================================

  describe('Security Headers', () => {
    test('should include security headers', async () => {
      const res = await request(app)
        .get('/health');

      // Helmet adds various security headers
      expect(res.headers['x-content-type-options']).toBeDefined();
    });

    test('should handle CORS headers', async () => {
      const res = await request(app)
        .options('/api/auth/login')
        .set('Origin', 'http://localhost:3000')
        .set('Access-Control-Request-Method', 'POST');

      // CORS preflight should be handled
      expect(res.status).toBe(204);
    });
  });

  // ============================================================
  // AppError Class
  // ============================================================

  describe('AppError', () => {
    test('should create error with defaults', () => {
      const err = new AppError('Test message');
      expect(err.message).toBe('Test message');
      expect(err.statusCode).toBe(500);
      expect(err.code).toBe('INTERNAL_ERROR');
      expect(err.isOperational).toBe(true);
    });

    test('should create error with custom values', () => {
      const err = new AppError('Not found', 404, 'NOT_FOUND');
      expect(err.statusCode).toBe(404);
      expect(err.code).toBe('NOT_FOUND');
    });

    test('should capture stack trace', () => {
      const err = new AppError('Test');
      expect(err.stack).toBeDefined();
      expect(err.stack.includes('AppError')).toBe(true);
    });
  });
});
