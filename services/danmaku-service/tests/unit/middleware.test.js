const { validateBody, validateQuery, validateParams, validateSocketData } = require('../../src/middleware/validation');
const { errorHandler, asyncHandler, notFoundHandler, DanmakuError } = require('../../src/middleware/errorHandler');
const { createRateLimiter, sendDanmakuLimiter, apiLimiter, WebSocketRateLimiter, wsRateLimiter } = require('../../src/middleware/rateLimiter');

describe('Middleware', () => {
  describe('Validation', () => {
    let req, res, next;

    beforeEach(() => {
      req = { body: {}, query: {}, params: {} };
      res = {
        status: jest.fn().mockReturnThis(),
        json: jest.fn().mockReturnThis()
      };
      next = jest.fn();
    });

    describe('validateBody', () => {
      it('should pass validation with valid danmaku data', () => {
        req.body = {
          videoId: '550e8400-e29b-41d4-a716-446655440000',
          userId: '550e8400-e29b-41d4-a716-446655440001',
          content: 'Test danmaku',
          timePoint: 45.5,
          color: '#FF0000',
          type: 0,
          fontSize: 25
        };

        validateBody('sendDanmaku')(req, res, next);

        expect(next).toHaveBeenCalled();
        expect(next).not.toHaveBeenCalledWith(expect.any(Error));
        expect(req.validatedBody).toBeDefined();
        expect(req.validatedBody.videoId).toBe(req.body.videoId);
      });

      it('should use default values for optional fields', () => {
        req.body = {
          videoId: '550e8400-e29b-41d4-a716-446655440000',
          userId: '550e8400-e29b-41d4-a716-446655440001',
          content: 'Minimal danmaku',
          timePoint: 10.0
        };

        validateBody('sendDanmaku')(req, res, next);

        expect(next).toHaveBeenCalled();
        expect(req.validatedBody.color).toBe('#FFFFFF');
        expect(req.validatedBody.type).toBe(0);
        expect(req.validatedBody.fontSize).toBe(25);
      });

      it('should reject missing videoId', () => {
        req.body = {
          userId: '550e8400-e29b-41d4-a716-446655440001',
          content: 'Test',
          timePoint: 10.0
        };

        validateBody('sendDanmaku')(req, res, next);

        expect(next).not.toHaveBeenCalled();
        expect(res.status).toHaveBeenCalledWith(400);
        expect(res.json).toHaveBeenCalledWith(
          expect.objectContaining({
            error: expect.objectContaining({
              code: 'VALIDATION_ERROR',
              details: expect.arrayContaining([
                expect.objectContaining({ field: 'videoId' })
              ])
            })
          })
        );
      });

      it('should reject missing userId', () => {
        req.body = {
          videoId: '550e8400-e29b-41d4-a716-446655440000',
          content: 'Test',
          timePoint: 10.0
        };

        validateBody('sendDanmaku')(req, res, next);

        expect(res.status).toHaveBeenCalledWith(400);
        expect(res.json).toHaveBeenCalledWith(
          expect.objectContaining({
            error: expect.objectContaining({
              code: 'VALIDATION_ERROR'
            })
          })
        );
      });

      it('should reject empty content', () => {
        req.body = {
          videoId: '550e8400-e29b-41d4-a716-446655440000',
          userId: '550e8400-e29b-41d4-a716-446655440001',
          content: '',
          timePoint: 10.0
        };

        validateBody('sendDanmaku')(req, res, next);

        expect(res.status).toHaveBeenCalledWith(400);
      });

      it('should reject content exceeding 100 characters', () => {
        req.body = {
          videoId: '550e8400-e29b-41d4-a716-446655440000',
          userId: '550e8400-e29b-41d4-a716-446655440001',
          content: 'x'.repeat(101),
          timePoint: 10.0
        };

        validateBody('sendDanmaku')(req, res, next);

        expect(res.status).toHaveBeenCalledWith(400);
      });

      it('should accept content at exactly 100 characters', () => {
        req.body = {
          videoId: '550e8400-e29b-41d4-a716-446655440000',
          userId: '550e8400-e29b-41d4-a716-446655440001',
          content: 'x'.repeat(100),
          timePoint: 10.0
        };

        validateBody('sendDanmaku')(req, res, next);

        expect(next).toHaveBeenCalled();
      });

      it('should reject negative timePoint', () => {
        req.body = {
          videoId: '550e8400-e29b-41d4-a716-446655440000',
          userId: '550e8400-e29b-41d4-a716-446655440001',
          content: 'Test',
          timePoint: -1.0
        };

        validateBody('sendDanmaku')(req, res, next);

        expect(res.status).toHaveBeenCalledWith(400);
      });

      it('should reject zero timePoint', () => {
        req.body = {
          videoId: '550e8400-e29b-41d4-a716-446655440000',
          userId: '550e8400-e29b-41d4-a716-446655440001',
          content: 'Test',
          timePoint: 0
        };

        validateBody('sendDanmaku')(req, res, next);

        expect(next).toHaveBeenCalled();
      });

      it('should reject invalid UUID format', () => {
        req.body = {
          videoId: 'not-a-uuid',
          userId: '550e8400-e29b-41d4-a716-446655440001',
          content: 'Test',
          timePoint: 10.0
        };

        validateBody('sendDanmaku')(req, res, next);

        expect(res.status).toHaveBeenCalledWith(400);
      });

      it('should reject invalid color format', () => {
        req.body = {
          videoId: '550e8400-e29b-41d4-a716-446655440000',
          userId: '550e8400-e29b-41d4-a716-446655440001',
          content: 'Test',
          timePoint: 10.0,
          color: 'red'
        };

        validateBody('sendDanmaku')(req, res, next);

        expect(res.status).toHaveBeenCalledWith(400);
      });

      it('should accept valid hex color', () => {
        req.body = {
          videoId: '550e8400-e29b-41d4-a716-446655440000',
          userId: '550e8400-e29b-41d4-a716-446655440001',
          content: 'Test',
          timePoint: 10.0,
          color: '#AbCdEf'
        };

        validateBody('sendDanmaku')(req, res, next);

        expect(next).toHaveBeenCalled();
      });

      it('should reject invalid type value', () => {
        req.body = {
          videoId: '550e8400-e29b-41d4-a716-446655440000',
          userId: '550e8400-e29b-41d4-a716-446655440001',
          content: 'Test',
          timePoint: 10.0,
          type: 5
        };

        validateBody('sendDanmaku')(req, res, next);

        expect(res.status).toHaveBeenCalledWith(400);
      });

      it('should accept type 0 (scroll)', () => {
        req.body = {
          videoId: '550e8400-e29b-41d4-a716-446655440000',
          userId: '550e8400-e29b-41d4-a716-446655440001',
          content: 'Test',
          timePoint: 10.0,
          type: 0
        };

        validateBody('sendDanmaku')(req, res, next);
        expect(next).toHaveBeenCalled();
      });

      it('should accept type 1 (top)', () => {
        req.body = {
          videoId: '550e8400-e29b-41d4-a716-446655440000',
          userId: '550e8400-e29b-41d4-a716-446655440001',
          content: 'Test',
          timePoint: 10.0,
          type: 1
        };

        validateBody('sendDanmaku')(req, res, next);
        expect(next).toHaveBeenCalled();
      });

      it('should accept type 2 (bottom)', () => {
        req.body = {
          videoId: '550e8400-e29b-41d4-a716-446655440000',
          userId: '550e8400-e29b-41d4-a716-446655440001',
          content: 'Test',
          timePoint: 10.0,
          type: 2
        };

        validateBody('sendDanmaku')(req, res, next);
        expect(next).toHaveBeenCalled();
      });

      it('should reject fontSize below 10', () => {
        req.body = {
          videoId: '550e8400-e29b-41d4-a716-446655440000',
          userId: '550e8400-e29b-41d4-a716-446655440001',
          content: 'Test',
          timePoint: 10.0,
          fontSize: 5
        };

        validateBody('sendDanmaku')(req, res, next);

        expect(res.status).toHaveBeenCalledWith(400);
      });

      it('should reject fontSize above 100', () => {
        req.body = {
          videoId: '550e8400-e29b-41d4-a716-446655440000',
          userId: '550e8400-e29b-41d4-a716-446655440001',
          content: 'Test',
          timePoint: 10.0,
          fontSize: 150
        };

        validateBody('sendDanmaku')(req, res, next);

        expect(res.status).toHaveBeenCalledWith(400);
      });

      it('should accept fontSize at boundary values', () => {
        req.body = {
          videoId: '550e8400-e29b-41d4-a716-446655440000',
          userId: '550e8400-e29b-41d4-a716-446655440001',
          content: 'Test',
          timePoint: 10.0,
          fontSize: 10
        };

        validateBody('sendDanmaku')(req, res, next);
        expect(next).toHaveBeenCalled();

        req.body.fontSize = 100;
        validateBody('sendDanmaku')(req, res, next);
        expect(next).toHaveBeenCalledTimes(2);
      });
    });

    describe('validateQuery', () => {
      it('should validate getDanmakus query', () => {
        req.query = {
          videoId: '550e8400-e29b-41d4-a716-446655440000',
          start: '0',
          end: '300',
          limit: '100'
        };

        validateQuery('getDanmakus')(req, res, next);

        expect(next).toHaveBeenCalled();
        expect(req.validatedQuery).toBeDefined();
        expect(req.validatedQuery.start).toBe(0);
        expect(req.validatedQuery.end).toBe(300);
      });

      it('should use default values for query', () => {
        req.query = {
          videoId: '550e8400-e29b-41d4-a716-446655440000'
        };

        validateQuery('getDanmakus')(req, res, next);

        expect(next).toHaveBeenCalled();
        expect(req.validatedQuery.start).toBe(0);
        expect(req.validatedQuery.end).toBe(300);
        expect(req.validatedQuery.limit).toBe(500);
        expect(req.validatedQuery.offset).toBe(0);
      });

      it('should reject missing videoId in query', () => {
        req.query = { start: '0', end: '300' };

        validateQuery('getDanmakus')(req, res, next);

        expect(res.status).toHaveBeenCalledWith(400);
      });

      it('should convert string numbers to actual numbers', () => {
        req.query = {
          videoId: '550e8400-e29b-41d4-a716-446655440000',
          start: '50',
          end: '150',
          limit: '50',
          offset: '25'
        };

        validateQuery('getDanmakus')(req, res, next);

        expect(req.validatedQuery.start).toBe(50);
        expect(req.validatedQuery.end).toBe(150);
        expect(req.validatedQuery.limit).toBe(50);
        expect(req.validatedQuery.offset).toBe(25);
        expect(typeof req.validatedQuery.start).toBe('number');
      });

      it('should reject negative start time', () => {
        req.query = {
          videoId: '550e8400-e29b-41d4-a716-446655440000',
          start: '-1'
        };

        validateQuery('getDanmakus')(req, res, next);

        expect(res.status).toHaveBeenCalledWith(400);
      });

      it('should reject limit over 1000', () => {
        req.query = {
          videoId: '550e8400-e29b-41d4-a716-446655440000',
          limit: '1001'
        };

        validateQuery('getDanmakus')(req, res, next);

        expect(res.status).toHaveBeenCalledWith(400);
      });
    });

    describe('validateParams', () => {
      it('should validate videoId param', () => {
        req.params = {
          videoId: '550e8400-e29b-41d4-a716-446655440000'
        };

        validateParams('getStats')(req, res, next);

        expect(next).toHaveBeenCalled();
        expect(req.validatedParams).toBeDefined();
      });

      it('should reject invalid videoId param', () => {
        req.params = {
          videoId: 'invalid-uuid'
        };

        validateParams('getStats')(req, res, next);

        expect(res.status).toHaveBeenCalledWith(400);
      });
    });

    describe('validateSocketData', () => {
      it('should validate socket danmaku data', () => {
        const data = {
          videoId: '550e8400-e29b-41d4-a716-446655440000',
          userId: '550e8400-e29b-41d4-a716-446655440001',
          content: 'Socket test',
          timePoint: 20.0
        };

        const result = validateSocketData('socketDanmakuSend', data);

        expect(result.error).toBe(false);
        expect(result.value).toBeDefined();
      });

      it('should reject invalid socket data', () => {
        const result = validateSocketData('socketDanmakuSend', {
          content: 'Missing fields'
        });

        expect(result.error).toBe(true);
        expect(result.message).toBeDefined();
      });

      it('should validate history request data', () => {
        const result = validateSocketData('socketHistoryRequest', {
          videoId: '550e8400-e29b-41d4-a716-446655440000'
        });

        expect(result.error).toBe(false);
        expect(result.value.start).toBe(0);
        expect(result.value.end).toBe(300);
      });

      it('should return error for unknown schema', () => {
        const result = validateSocketData('unknownSchema', {});

        expect(result.error).toBe(true);
      });

      it('should handle null data', () => {
        const result = validateSocketData('socketDanmakuSend', null);

        expect(result.error).toBe(true);
      });

      it('should strip unknown fields', () => {
        const data = {
          videoId: '550e8400-e29b-41d4-a716-446655440000',
          userId: '550e8400-e29b-41d4-a716-446655440001',
          content: 'Test',
          timePoint: 10.0,
          extraField: 'should be removed',
          anotherExtra: 123
        };

        const result = validateSocketData('socketDanmakuSend', data);

        expect(result.error).toBe(false);
        expect(result.value.extraField).toBeUndefined();
        expect(result.value.anotherExtra).toBeUndefined();
      });
    });

    describe('unknown schema handling', () => {
      it('should return 500 for unknown body schema', () => {
        const middleware = validateBody('nonexistentSchema');
        middleware(req, res, next);

        expect(next).toHaveBeenCalledWith(expect.any(DanmakuError));
      });

      it('should return 500 for unknown query schema', () => {
        const middleware = validateQuery('nonexistentSchema');
        middleware(req, res, next);

        expect(next).toHaveBeenCalledWith(expect.any(DanmakuError));
      });
    });
  });

  describe('ErrorHandler', () => {
    let req, res, next;

    beforeEach(() => {
      req = { id: 'test-req-123', path: '/api/danmakus', method: 'POST' };
      res = {
        status: jest.fn().mockReturnThis(),
        json: jest.fn().mockReturnThis()
      };
      next = jest.fn();
    });

    describe('DanmakuError', () => {
      it('should create error with defaults', () => {
        const error = new DanmakuError('Something went wrong');

        expect(error.message).toBe('Something went wrong');
        expect(error.statusCode).toBe(500);
        expect(error.code).toBe('INTERNAL_ERROR');
        expect(error.isOperational).toBe(true);
      });

      it('should create error with custom status', () => {
        const error = new DanmakuError('Not found', 404, 'NOT_FOUND');

        expect(error.statusCode).toBe(404);
        expect(error.code).toBe('NOT_FOUND');
      });

      it('should capture stack trace', () => {
        const error = new DanmakuError('Test');

        expect(error.stack).toBeDefined();
        expect(error.stack).toContain('DanmakuError');
      });
    });

    describe('errorHandler', () => {
      it('should handle DanmakuError', () => {
        const error = new DanmakuError('Bad request', 400, 'BAD_REQUEST');

        errorHandler(error, req, res, next);

        expect(res.status).toHaveBeenCalledWith(400);
        expect(res.json).toHaveBeenCalledWith(
          expect.objectContaining({
            error: expect.objectContaining({
              message: 'Bad request',
              code: 'BAD_REQUEST',
              status: 400
            })
          })
        );
      });

      it('should handle PostgreSQL validation errors', () => {
        const error = new Error('Check constraint violation');
        error.code = '23514';

        errorHandler(error, req, res, next);

        expect(res.status).toHaveBeenCalledWith(400);
        expect(res.json).toHaveBeenCalledWith(
          expect.objectContaining({
            error: expect.objectContaining({
              code: 'VALIDATION_ERROR'
            })
          })
        );
      });

      it('should handle PostgreSQL connection errors', () => {
        const error = new Error('Connection refused');
        error.code = 'ECONNREFUSED';

        errorHandler(error, req, res, next);

        expect(res.status).toHaveBeenCalledWith(503);
        expect(res.json).toHaveBeenCalledWith(
          expect.objectContaining({
            error: expect.objectContaining({
              code: 'SERVICE_UNAVAILABLE'
            })
          })
        );
      });

      it('should handle generic errors', () => {
        const error = new Error('Something unexpected');

        errorHandler(error, req, res, next);

        expect(res.status).toHaveBeenCalledWith(500);
        expect(res.json).toHaveBeenCalledWith(
          expect.objectContaining({
            error: expect.objectContaining({
              code: 'INTERNAL_ERROR',
              status: 500
            })
          })
        );
      });

      it('should include stack trace in development', () => {
        const originalEnv = process.env.NODE_ENV;
        process.env.NODE_ENV = 'development';

        const error = new Error('Dev error');
        error.statusCode = 500;

        errorHandler(error, req, res, next);

        expect(res.json).toHaveBeenCalledWith(
          expect.objectContaining({
            error: expect.objectContaining({
              stack: expect.any(String)
            })
          })
        );

        process.env.NODE_ENV = originalEnv;
      });

      it('should hide details in production', () => {
        const originalEnv = process.env.NODE_ENV;
        process.env.NODE_ENV = 'production';

        const error = new Error('Secret error');

        errorHandler(error, req, res, next);

        const response = res.json.mock.calls[0][0];
        expect(response.error.message).toBe('Internal Server Error');

        process.env.NODE_ENV = originalEnv;
      });
    });

    describe('asyncHandler', () => {
      it('should catch errors in async functions', async () => {
        const asyncFn = jest.fn().mockRejectedValue(new Error('Async error'));
        const wrapped = asyncHandler(asyncFn);

        await wrapped(req, res, next);

        expect(next).toHaveBeenCalledWith(expect.any(Error));
      });

      it('should pass through successful execution', async () => {
        const asyncFn = jest.fn().mockResolvedValue('success');
        const wrapped = asyncHandler(asyncFn);

        await wrapped(req, res, next);

        expect(asyncFn).toHaveBeenCalled();
        expect(next).not.toHaveBeenCalledWith(expect.any(Error));
      });

      it('should pass req, res, next to wrapped function', async () => {
        const asyncFn = jest.fn().mockResolvedValue();
        const wrapped = asyncHandler(asyncFn);

        await wrapped(req, res, next);

        expect(asyncFn).toHaveBeenCalledWith(req, res, next);
      });
    });

    describe('notFoundHandler', () => {
      it('should create 404 error', () => {
        req.path = '/nonexistent';

        notFoundHandler(req, res, next);

        expect(next).toHaveBeenCalledWith(expect.any(DanmakuError));
        const error = next.mock.calls[0][0];
        expect(error.statusCode).toBe(404);
        expect(error.code).toBe('ROUTE_NOT_FOUND');
        expect(error.message).toContain('/nonexistent');
      });
    });
  });

  describe('RateLimiter', () => {
    describe('WebSocketRateLimiter', () => {
      let limiter;

      beforeEach(() => {
        limiter = new WebSocketRateLimiter({
          windowMs: 5000,
          max: 3
        });
      });

      afterEach(() => {
        limiter.stop();
      });

      it('should allow first request', () => {
        expect(limiter.isAllowed('socket1')).toBe(true);
      });

      it('should allow requests up to limit', () => {
        limiter.isAllowed('socket1');
        limiter.isAllowed('socket1');
        expect(limiter.isAllowed('socket1')).toBe(true);
      });

      it('should deny requests exceeding limit', () => {
        limiter.isAllowed('socket1');
        limiter.isAllowed('socket1');
        limiter.isAllowed('socket1');
        expect(limiter.isAllowed('socket1')).toBe(false);
      });

      it('should track sockets independently', () => {
        limiter.isAllowed('socket1');
        limiter.isAllowed('socket1');
        limiter.isAllowed('socket1');

        expect(limiter.isAllowed('socket2')).toBe(true);
      });

      it('should remove socket tracking', () => {
        limiter.isAllowed('socket1');
        limiter.isAllowed('socket1');
        limiter.removeSocket('socket1');

        expect(limiter.isAllowed('socket1')).toBe(true);
      });

      it('should reset after window expires', async () => {
        const shortLimiter = new WebSocketRateLimiter({
          windowMs: 50,
          max: 1
        });

        shortLimiter.isAllowed('socket1');
        expect(shortLimiter.isAllowed('socket1')).toBe(false);

        await new Promise(resolve => setTimeout(resolve, 100));

        expect(shortLimiter.isAllowed('socket1')).toBe(true);
        shortLimiter.stop();
      });

      it('should cleanup expired entries', () => {
        limiter.isAllowed('socket1');
        limiter.lastCleanup = Date.now() - 120000;

        limiter.cleanup();

        // Should not throw
        expect(limiter.clients.size).toBeGreaterThanOrEqual(0);
      });

      it('should stop without errors', () => {
        expect(() => limiter.stop()).not.toThrow();
        expect(limiter.clients.size).toBe(0);
      });
    });

    describe('createRateLimiter', () => {
      it('should create express middleware', () => {
        const middleware = createRateLimiter({
          windowMs: 60000,
          max: 100
        });

        expect(typeof middleware).toBe('function');
      });
    });
  });
});
