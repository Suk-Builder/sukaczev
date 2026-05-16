const { validateBody, validateQuery, validateParams, schemas } = require('../../src/middleware/validation');
const { errorHandler, asyncHandler, CommentError } = require('../../src/middleware/errorHandler');

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
      it('should pass with valid comment data', () => {
        req.body = {
          videoId: '550e8400-e29b-41d4-a716-446655440000',
          userId: '550e8400-e29b-41d4-a716-446655440001',
          content: 'Valid comment content'
        };

        validateBody('createComment')(req, res, next);

        expect(next).toHaveBeenCalled();
        expect(next).not.toHaveBeenCalledWith(expect.any(Error));
        expect(req.validatedBody).toBeDefined();
        expect(req.validatedBody.videoId).toBe(req.body.videoId);
      });

      it('should include optional parentId', () => {
        req.body = {
          videoId: '550e8400-e29b-41d4-a716-446655440000',
          userId: '550e8400-e29b-41d4-a716-446655440001',
          content: 'Reply comment',
          parentId: '550e8400-e29b-41d4-a716-446655440002'
        };

        validateBody('createComment')(req, res, next);

        expect(next).toHaveBeenCalled();
        expect(req.validatedBody.parentId).toBe(req.body.parentId);
      });

      it('should reject missing videoId', () => {
        req.body = {
          userId: '550e8400-e29b-41d4-a716-446655440001',
          content: 'Test'
        };

        validateBody('createComment')(req, res, next);

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
          content: 'Test'
        };

        validateBody('createComment')(req, res, next);

        expect(res.status).toHaveBeenCalledWith(400);
      });

      it('should reject empty content', () => {
        req.body = {
          videoId: '550e8400-e29b-41d4-a716-446655440000',
          userId: '550e8400-e29b-41d4-a716-446655440001',
          content: ''
        };

        validateBody('createComment')(req, res, next);

        expect(res.status).toHaveBeenCalledWith(400);
      });

      it('should reject content over 2000 characters', () => {
        req.body = {
          videoId: '550e8400-e29b-41d4-a716-446655440000',
          userId: '550e8400-e29b-41d4-a716-446655440001',
          content: 'x'.repeat(2001)
        };

        validateBody('createComment')(req, res, next);

        expect(res.status).toHaveBeenCalledWith(400);
      });

      it('should accept content at 2000 characters', () => {
        req.body = {
          videoId: '550e8400-e29b-41d4-a716-446655440000',
          userId: '550e8400-e29b-41d4-a716-446655440001',
          content: 'x'.repeat(2000)
        };

        validateBody('createComment')(req, res, next);

        expect(next).toHaveBeenCalled();
      });

      it('should reject invalid videoId format', () => {
        req.body = {
          videoId: 'not-a-uuid',
          userId: '550e8400-e29b-41d4-a716-446655440001',
          content: 'Test'
        };

        validateBody('createComment')(req, res, next);

        expect(res.status).toHaveBeenCalledWith(400);
      });

      it('should reject invalid parentId format', () => {
        req.body = {
          videoId: '550e8400-e29b-41d4-a716-446655440000',
          userId: '550e8400-e29b-41d4-a716-446655440001',
          content: 'Test',
          parentId: 'invalid-uuid'
        };

        validateBody('createComment')(req, res, next);

        expect(res.status).toHaveBeenCalledWith(400);
      });

      it('should accept null parentId', () => {
        req.body = {
          videoId: '550e8400-e29b-41d4-a716-446655440000',
          userId: '550e8400-e29b-41d4-a716-446655440001',
          content: 'Test',
          parentId: null
        };

        validateBody('createComment')(req, res, next);

        expect(next).toHaveBeenCalled();
      });

      it('should strip unknown fields', () => {
        req.body = {
          videoId: '550e8400-e29b-41d4-a716-446655440000',
          userId: '550e8400-e29b-41d4-a716-446655440001',
          content: 'Test',
          extraField: 'should be removed',
          anotherExtra: 123
        };

        validateBody('createComment')(req, res, next);

        expect(req.validatedBody.extraField).toBeUndefined();
        expect(req.validatedBody.anotherExtra).toBeUndefined();
      });
    });

    describe('validateQuery (getComments)', () => {
      it('should validate with videoId', () => {
        req.query = {
          videoId: '550e8400-e29b-41d4-a716-446655440000'
        };

        validateQuery('getComments')(req, res, next);

        expect(next).toHaveBeenCalled();
        expect(req.validatedQuery.videoId).toBe(req.query.videoId);
        expect(req.validatedQuery.page).toBe(1);
        expect(req.validatedQuery.flat).toBe('false');
      });

      it('should accept page parameter', () => {
        req.query = {
          videoId: '550e8400-e29b-41d4-a716-446655440000',
          page: '3'
        };

        validateQuery('getComments')(req, res, next);

        expect(req.validatedQuery.page).toBe(3);
      });

      it('should accept flat parameter', () => {
        req.query = {
          videoId: '550e8400-e29b-41d4-a716-446655440000',
          flat: 'true'
        };

        validateQuery('getComments')(req, res, next);

        expect(req.validatedQuery.flat).toBe('true');
      });

      it('should accept sortBy parameter', () => {
        req.query = {
          videoId: '550e8400-e29b-41d4-a716-446655440000',
          sortBy: 'likes_count DESC'
        };

        validateQuery('getComments')(req, res, next);

        expect(req.validatedQuery.sortBy).toBe('likes_count DESC');
      });

      it('should reject invalid sortBy', () => {
        req.query = {
          videoId: '550e8400-e29b-41d4-a716-446655440000',
          sortBy: 'invalid_column ASC'
        };

        validateQuery('getComments')(req, res, next);

        expect(res.status).toHaveBeenCalledWith(400);
      });

      it('should reject missing videoId', () => {
        req.query = {};

        validateQuery('getComments')(req, res, next);

        expect(res.status).toHaveBeenCalledWith(400);
      });

      it('should reject page less than 1', () => {
        req.query = {
          videoId: '550e8400-e29b-41d4-a716-446655440000',
          page: '0'
        };

        validateQuery('getComments')(req, res, next);

        expect(res.status).toHaveBeenCalledWith(400);
      });
    });

    describe('validateQuery (getReplies)', () => {
      it('should validate with defaults', () => {
        req.query = {};

        validateQuery('getReplies')(req, res, next);

        expect(next).toHaveBeenCalled();
        expect(req.validatedQuery.page).toBe(1);
        expect(req.validatedQuery.pageSize).toBe(50);
      });

      it('should accept custom pagination', () => {
        req.query = { page: '2', pageSize: '25' };

        validateQuery('getReplies')(req, res, next);

        expect(req.validatedQuery.page).toBe(2);
        expect(req.validatedQuery.pageSize).toBe(25);
      });

      it('should reject pageSize over 100', () => {
        req.query = { pageSize: '200' };

        validateQuery('getReplies')(req, res, next);

        expect(res.status).toHaveBeenCalledWith(400);
      });
    });

    describe('validateBody (toggleLike)', () => {
      it('should validate like request', () => {
        req.body = {
          userId: '550e8400-e29b-41d4-a716-446655440001'
        };

        validateBody('toggleLike')(req, res, next);

        expect(next).toHaveBeenCalled();
        expect(req.validatedBody.userId).toBe(req.body.userId);
      });

      it('should reject missing userId', () => {
        req.body = {};

        validateBody('toggleLike')(req, res, next);

        expect(res.status).toHaveBeenCalledWith(400);
      });
    });

    describe('unknown schema', () => {
      it('should pass CommentError for unknown body schema', () => {
        const middleware = validateBody('nonexistent');
        middleware(req, res, next);

        expect(next).toHaveBeenCalledWith(expect.any(CommentError));
      });

      it('should pass CommentError for unknown query schema', () => {
        const middleware = validateQuery('nonexistent');
        middleware(req, res, next);

        expect(next).toHaveBeenCalledWith(expect.any(CommentError));
      });

      it('should pass CommentError for unknown params schema', () => {
        const middleware = validateParams('nonexistent');
        middleware(req, res, next);

        expect(next).toHaveBeenCalledWith(expect.any(CommentError));
      });
    });

    describe('multiple validation errors', () => {
      it('should collect all errors', () => {
        req.body = {};

        validateBody('createComment')(req, res, next);

        const response = res.json.mock.calls[0][0];
        expect(response.error.details).toHaveLength(3); // videoId, userId, content
      });
    });
  });

  describe('ErrorHandler', () => {
    let req, res, next;

    beforeEach(() => {
      req = { id: 'test-req-123', path: '/api/comments', method: 'POST' };
      res = {
        status: jest.fn().mockReturnThis(),
        json: jest.fn().mockReturnThis()
      };
      next = jest.fn();
    });

    describe('CommentError', () => {
      it('should create with defaults', () => {
        const error = new CommentError('Something wrong');

        expect(error.message).toBe('Something wrong');
        expect(error.statusCode).toBe(500);
        expect(error.code).toBe('INTERNAL_ERROR');
        expect(error.isOperational).toBe(true);
      });

      it('should create with custom values', () => {
        const error = new CommentError('Not found', 404, 'NOT_FOUND');

        expect(error.statusCode).toBe(404);
        expect(error.code).toBe('NOT_FOUND');
      });

      it('should capture stack trace', () => {
        const error = new CommentError('Test');

        expect(error.stack).toBeDefined();
        expect(error.stack).toContain('CommentError');
      });
    });

    describe('errorHandler middleware', () => {
      it('should handle CommentError', () => {
        const error = new CommentError('Bad request', 400, 'BAD_REQUEST');

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

      it('should handle not found', () => {
        const error = new CommentError('Not found', 404, 'NOT_FOUND');

        errorHandler(error, req, res, next);

        expect(res.status).toHaveBeenCalledWith(404);
      });

      it('should handle unauthorized', () => {
        const error = new CommentError('Unauthorized', 403, 'UNAUTHORIZED');

        errorHandler(error, req, res, next);

        expect(res.status).toHaveBeenCalledWith(403);
      });

      it('should handle PostgreSQL validation errors', () => {
        const error = new Error('Constraint violation');
        error.code = '23514';

        errorHandler(error, req, res, next);

        expect(res.status).toHaveBeenCalledWith(400);
        expect(res.json).toHaveBeenCalledWith(
          expect.objectContaining({
            error: expect.objectContaining({ code: 'VALIDATION_ERROR' })
          })
        );
      });

      it('should handle PostgreSQL unique violation', () => {
        const error = new Error('Duplicate key');
        error.code = '23505';

        errorHandler(error, req, res, next);

        expect(res.status).toHaveBeenCalledWith(400);
      });

      it('should handle connection errors', () => {
        const error = new Error('Connection refused');
        error.code = 'ECONNREFUSED';

        errorHandler(error, req, res, next);

        expect(res.status).toHaveBeenCalledWith(503);
      });

      it('should handle generic errors', () => {
        const error = new Error('Unexpected');

        errorHandler(error, req, res, next);

        expect(res.status).toHaveBeenCalledWith(500);
      });

      it('should include stack in development', () => {
        const originalEnv = process.env.NODE_ENV;
        process.env.NODE_ENV = 'development';

        const error = new Error('Dev error');
        error.statusCode = 500;

        errorHandler(error, req, res, next);

        expect(res.json).toHaveBeenCalledWith(
          expect.objectContaining({
            error: expect.objectContaining({ stack: expect.any(String) })
          })
        );

        process.env.NODE_ENV = originalEnv;
      });

      it('should hide details in production', () => {
        const originalEnv = process.env.NODE_ENV;
        process.env.NODE_ENV = 'production';

        const error = new Error('Secret');

        errorHandler(error, req, res, next);

        const response = res.json.mock.calls[0][0];
        expect(response.error.message).toBe('Internal Server Error');

        process.env.NODE_ENV = originalEnv;
      });
    });

    describe('asyncHandler', () => {
      it('should catch async errors', async () => {
        const asyncFn = jest.fn().mockRejectedValue(new Error('Async error'));
        const wrapped = asyncHandler(asyncFn);

        await wrapped(req, res, next);

        expect(next).toHaveBeenCalledWith(expect.any(Error));
      });

      it('should pass through success', async () => {
        const asyncFn = jest.fn().mockResolvedValue('success');
        const wrapped = asyncHandler(asyncFn);

        await wrapped(req, res, next);

        expect(asyncFn).toHaveBeenCalled();
        expect(next).not.toHaveBeenCalledWith(expect.any(Error));
      });

      it('should pass req, res, next', async () => {
        const asyncFn = jest.fn().mockResolvedValue();
        const wrapped = asyncHandler(asyncFn);

        await wrapped(req, res, next);

        expect(asyncFn).toHaveBeenCalledWith(req, res, next);
      });
    });
  });
});
