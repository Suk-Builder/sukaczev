const request = require('supertest');
const app = require('../../src/app');
const commentService = require('../../src/services/commentService');

jest.mock('../../src/services/commentService');
jest.mock('../../src/config/redis', () => ({
  connectRedis: jest.fn().mockResolvedValue(),
  closeRedis: jest.fn().mockResolvedValue(),
  getRedis: jest.fn().mockReturnValue({
    setex: jest.fn().mockResolvedValue('OK'),
    get: jest.fn().mockResolvedValue(null),
    del: jest.fn().mockResolvedValue(1),
    keys: jest.fn().mockResolvedValue([]),
    incr: jest.fn().mockResolvedValue(1)
  }),
  cacheComments: jest.fn().mockResolvedValue(),
  getCachedComments: jest.fn().mockResolvedValue(null),
  cacheCommentTree: jest.fn().mockResolvedValue(),
  getCachedCommentTree: jest.fn().mockResolvedValue(null),
  invalidateCommentCache: jest.fn().mockResolvedValue(),
  cacheHotComments: jest.fn().mockResolvedValue(),
  getCachedHotComments: jest.fn().mockResolvedValue(null)
}));
jest.mock('../../src/utils/logger', () => ({
  info: jest.fn(),
  error: jest.fn(),
  warn: jest.fn(),
  debug: jest.fn(),
  stream: { write: jest.fn() }
}));

describe('API Integration Tests', () => {
  const validVideoId = '550e8400-e29b-41d4-a716-446655440000';
  const validUserId = '550e8400-e29b-41d4-a716-446655440001';
  const validCommentId = '550e8400-e29b-41d4-a716-446655440002';

  const mockComment = {
    id: validCommentId,
    videoId: validVideoId,
    userId: validUserId,
    parentId: null,
    content: 'Test comment content',
    likesCount: 10,
    repliesCount: 5,
    createdAt: '2024-01-15T10:30:00.000Z',
    updatedAt: '2024-01-15T10:30:00.000Z'
  };

  const mockReply = {
    id: '550e8400-e29b-41d4-a716-446655440003',
    videoId: validVideoId,
    userId: '550e8400-e29b-41d4-a716-446655440004',
    parentId: validCommentId,
    content: 'Test reply',
    likesCount: 3,
    repliesCount: 0,
    createdAt: '2024-01-15T11:00:00.000Z',
    updatedAt: '2024-01-15T11:00:00.000Z'
  };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('Health Check', () => {
    it('should return health status', async () => {
      const response = await request(app)
        .get('/health')
        .expect(200);

      expect(response.body).toMatchObject({
        status: 'ok',
        service: 'comment-service'
      });
      expect(response.body.timestamp).toBeDefined();
      expect(response.body.uptime).toBeGreaterThanOrEqual(0);
    });
  });

  describe('Root Endpoint', () => {
    it('should return service info', async () => {
      const response = await request(app)
        .get('/')
        .expect(200);

      expect(response.body).toMatchObject({
        service: 'comment-service',
        version: '1.0.0'
      });
    });
  });

  describe('GET /api/comments', () => {
    it('should get tree comments', async () => {
      commentService.getCommentsTree = jest.fn().mockResolvedValue({
        comments: [{ ...mockComment, replies: [mockReply] }],
        meta: {
          videoId: validVideoId,
          page: 1,
          totalTopLevel: 1,
          totalPages: 1,
          count: 1
        }
      });

      const response = await request(app)
        .get('/api/comments')
        .query({ videoId: validVideoId })
        .expect(200);

      expect(response.body).toMatchObject({
        success: true,
        data: expect.any(Array),
        meta: expect.any(Object)
      });
      expect(response.body.data[0].replies).toBeDefined();
      expect(commentService.getCommentsTree).toHaveBeenCalled();
    });

    it('should get flat comments', async () => {
      commentService.getCommentsFlat = jest.fn().mockResolvedValue({
        comments: [mockComment, mockReply],
        meta: {
          videoId: validVideoId,
          page: 1,
          total: 2,
          totalPages: 1,
          count: 2
        }
      });

      const response = await request(app)
        .get('/api/comments')
        .query({ videoId: validVideoId, flat: 'true' })
        .expect(200);

      expect(commentService.getCommentsFlat).toHaveBeenCalled();
      expect(response.body.data).toHaveLength(2);
    });

    it('should support pagination', async () => {
      commentService.getCommentsTree = jest.fn().mockResolvedValue({
        comments: [],
        meta: { page: 2, totalPages: 5 }
      });

      await request(app)
        .get('/api/comments')
        .query({ videoId: validVideoId, page: '2' })
        .expect(200);

      expect(commentService.getCommentsTree).toHaveBeenCalledWith(
        validVideoId,
        expect.objectContaining({ page: 2 })
      );
    });

    it('should support sorting', async () => {
      commentService.getCommentsFlat = jest.fn().mockResolvedValue({
        comments: [],
        meta: {}
      });

      await request(app)
        .get('/api/comments')
        .query({
          videoId: validVideoId,
          flat: 'true',
          sortBy: 'likes_count DESC'
        })
        .expect(200);

      expect(commentService.getCommentsFlat).toHaveBeenCalledWith(
        validVideoId,
        expect.objectContaining({ sortBy: 'likes_count DESC' })
      );
    });

    it('should reject missing videoId', async () => {
      const response = await request(app)
        .get('/api/comments')
        .expect(400);

      expect(response.body.error.code).toBe('VALIDATION_ERROR');
    });

    it('should reject invalid videoId', async () => {
      const response = await request(app)
        .get('/api/comments')
        .query({ videoId: 'not-a-uuid' })
        .expect(400);

      expect(response.body.error.code).toBe('VALIDATION_ERROR');
    });

    it('should handle service errors', async () => {
      commentService.getCommentsTree = jest.fn().mockRejectedValue(
        new Error('DB error')
      );

      const response = await request(app)
        .get('/api/comments')
        .query({ videoId: validVideoId })
        .expect(500);

      expect(response.body.error).toBeDefined();
    });
  });

  describe('POST /api/comments', () => {
    it('should create comment', async () => {
      commentService.createComment = jest.fn().mockResolvedValue(mockComment);

      const response = await request(app)
        .post('/api/comments')
        .send({
          videoId: validVideoId,
          userId: validUserId,
          content: 'New comment'
        })
        .expect(201);

      expect(response.body).toMatchObject({
        success: true,
        data: expect.any(Object),
        message: 'Comment created successfully'
      });
      expect(commentService.createComment).toHaveBeenCalled();
    });

    it('should create reply', async () => {
      commentService.createComment = jest.fn().mockResolvedValue(mockReply);

      const response = await request(app)
        .post('/api/comments')
        .send({
          videoId: validVideoId,
          userId: validUserId,
          content: 'Reply content',
          parentId: validCommentId
        })
        .expect(201);

      expect(response.body.message).toBe('Reply created successfully');
      expect(response.body.data.parentId).toBe(validCommentId);
    });

    it('should reject empty content', async () => {
      const response = await request(app)
        .post('/api/comments')
        .send({
          videoId: validVideoId,
          userId: validUserId,
          content: ''
        })
        .expect(400);

      expect(response.body.error.code).toBe('VALIDATION_ERROR');
    });

    it('should reject content over 2000 chars', async () => {
      const response = await request(app)
        .post('/api/comments')
        .send({
          videoId: validVideoId,
          userId: validUserId,
          content: 'x'.repeat(2001)
        })
        .expect(400);

      expect(response.body.error.code).toBe('VALIDATION_ERROR');
    });

    it('should reject missing required fields', async () => {
      const response = await request(app)
        .post('/api/comments')
        .send({ content: 'Only content' })
        .expect(400);

      expect(response.body.error.code).toBe('VALIDATION_ERROR');
    });

    it('should handle service errors', async () => {
      commentService.createComment = jest.fn().mockRejectedValue({
        message: 'Parent not found',
        statusCode: 404,
        code: 'PARENT_NOT_FOUND'
      });

      const response = await request(app)
        .post('/api/comments')
        .send({
          videoId: validVideoId,
          userId: validUserId,
          content: 'Reply',
          parentId: 'non-existent-parent'
        })
        .expect(404);

      expect(response.body.error.code).toBe('PARENT_NOT_FOUND');
    });
  });

  describe('DELETE /api/comments/:id', () => {
    it('should delete comment', async () => {
      commentService.deleteComment = jest.fn().mockResolvedValue({
        success: true,
        deletedId: validCommentId
      });

      const response = await request(app)
        .delete(`/api/comments/${validCommentId}`)
        .send({ userId: validUserId })
        .expect(200);

      expect(response.body).toMatchObject({
        success: true,
        message: 'Comment deleted successfully'
      });
      expect(commentService.deleteComment).toHaveBeenCalledWith(
        validCommentId,
        validUserId
      );
    });

    it('should handle deletion errors', async () => {
      commentService.deleteComment = jest.fn().mockRejectedValue({
        message: 'Not authorized',
        statusCode: 403,
        code: 'UNAUTHORIZED'
      });

      const response = await request(app)
        .delete(`/api/comments/${validCommentId}`)
        .send({ userId: 'different-user' })
        .expect(403);

      expect(response.body.error.code).toBe('UNAUTHORIZED');
    });
  });

  describe('POST /api/comments/:id/like', () => {
    it('should like comment', async () => {
      commentService.toggleLike = jest.fn().mockResolvedValue({
        liked: true,
        action: 'liked',
        commentId: validCommentId,
        likesCount: 11
      });

      const response = await request(app)
        .post(`/api/comments/${validCommentId}/like`)
        .send({ userId: validUserId })
        .expect(200);

      expect(response.body).toMatchObject({
        success: true,
        data: expect.objectContaining({ liked: true }),
        message: 'Comment liked'
      });
    });

    it('should unlike comment', async () => {
      commentService.toggleLike = jest.fn().mockResolvedValue({
        liked: false,
        action: 'unliked',
        commentId: validCommentId,
        likesCount: 9
      });

      const response = await request(app)
        .post(`/api/comments/${validCommentId}/like`)
        .send({ userId: validUserId })
        .expect(200);

      expect(response.body.message).toBe('Comment unliked');
    });

    it('should require userId', async () => {
      const response = await request(app)
        .post(`/api/comments/${validCommentId}/like`)
        .send({})
        .expect(400);

      expect(response.body.error.code).toBe('VALIDATION_ERROR');
    });
  });

  describe('GET /api/comments/:id/replies', () => {
    it('should get replies', async () => {
      commentService.getReplies = jest.fn().mockResolvedValue({
        replies: [mockReply],
        meta: {
          parentId: validCommentId,
          total: 1,
          page: 1
        }
      });

      const response = await request(app)
        .get(`/api/comments/${validCommentId}/replies`)
        .expect(200);

      expect(response.body.data).toHaveLength(1);
      expect(response.body.data[0].parentId).toBe(validCommentId);
    });

    it('should support pagination', async () => {
      commentService.getReplies = jest.fn().mockResolvedValue({
        replies: [],
        meta: { page: 2 }
      });

      await request(app)
        .get(`/api/comments/${validCommentId}/replies`)
        .query({ page: '2', pageSize: '10' })
        .expect(200);

      expect(commentService.getReplies).toHaveBeenCalledWith(
        validCommentId,
        { page: 2, pageSize: 10 }
      );
    });
  });

  describe('GET /api/comments/:id/thread', () => {
    it('should get comment thread', async () => {
      commentService.getCommentThread = jest.fn().mockResolvedValue({
        comment: { ...mockComment, replies: [mockReply] },
        cached: false
      });

      const response = await request(app)
        .get(`/api/comments/${validCommentId}/thread`)
        .expect(200);

      expect(response.body.data.replies).toHaveLength(1);
      expect(response.body.cached).toBe(false);
    });

    it('should support maxDepth', async () => {
      commentService.getCommentThread = jest.fn().mockResolvedValue({
        comment: mockComment,
        cached: false
      });

      await request(app)
        .get(`/api/comments/${validCommentId}/thread`)
        .query({ maxDepth: '3' })
        .expect(200);

      expect(commentService.getCommentThread).toHaveBeenCalledWith(
        validCommentId,
        3
      );
    });
  });

  describe('GET /api/comments/:id', () => {
    it('should get single comment', async () => {
      commentService.getCommentThread = jest.fn().mockResolvedValue({
        comment: mockComment
      });

      const response = await request(app)
        .get(`/api/comments/${validCommentId}`)
        .expect(200);

      expect(response.body.data.id).toBe(validCommentId);
    });
  });

  describe('GET /api/comments/:id/like/check', () => {
    it('should check like status', async () => {
      commentService.hasLiked = jest.fn().mockResolvedValue(true);

      const response = await request(app)
        .get(`/api/comments/${validCommentId}/like/check`)
        .query({ userId: validUserId })
        .expect(200);

      expect(response.body.data).toMatchObject({
        commentId: validCommentId,
        userId: validUserId,
        hasLiked: true
      });
    });
  });

  describe('GET /api/comments/video/:videoId/hot', () => {
    it('should get hot comments', async () => {
      commentService.getHotComments = jest.fn().mockResolvedValue({
        comments: [mockComment],
        cached: false
      });

      const response = await request(app)
        .get(`/api/comments/video/${validVideoId}/hot`)
        .expect(200);

      expect(response.body.data).toHaveLength(1);
    });

    it('should support limit', async () => {
      commentService.getHotComments = jest.fn().mockResolvedValue({
        comments: [],
        cached: false
      });

      await request(app)
        .get(`/api/comments/video/${validVideoId}/hot`)
        .query({ limit: '25' })
        .expect(200);

      expect(commentService.getHotComments).toHaveBeenCalledWith(
        validVideoId,
        25
      );
    });
  });

  describe('GET /api/comments/video/:videoId/stats', () => {
    it('should get video stats', async () => {
      commentService.getVideoStats = jest.fn().mockResolvedValue({
        videoId: validVideoId,
        totalComments: 150,
        uniqueUsers: 45,
        topLevelCount: 50,
        repliesCount: 100
      });

      const response = await request(app)
        .get(`/api/comments/video/${validVideoId}/stats`)
        .expect(200);

      expect(response.body.data).toMatchObject({
        totalComments: 150,
        uniqueUsers: 45
      });
    });
  });

  describe('GET /api/comments/user/:userId', () => {
    it('should get user comments', async () => {
      commentService.getUserComments = jest.fn().mockResolvedValue([mockComment]);

      const response = await request(app)
        .get(`/api/comments/user/${validUserId}`)
        .expect(200);

      expect(response.body.data).toHaveLength(1);
    });
  });

  describe('GET /api/comments/user/:userId/liked', () => {
    it('should get liked comments', async () => {
      commentService.getUserLikedComments = jest.fn().mockResolvedValue([
        { commentId: validCommentId, videoId: validVideoId }
      ]);

      const response = await request(app)
        .get(`/api/comments/user/${validUserId}/liked`)
        .expect(200);

      expect(response.body.data).toHaveLength(1);
    });
  });

  describe('DELETE /api/comments/video/:videoId', () => {
    it('should delete all comments', async () => {
      commentService.deleteAllForVideo = jest.fn().mockResolvedValue(50);

      const response = await request(app)
        .delete(`/api/comments/video/${validVideoId}`)
        .expect(200);

      expect(response.body.data.deletedCount).toBe(50);
    });
  });

  describe('GET /api/comments/recent', () => {
    it('should get recent comments', async () => {
      commentService.getRecentComments = jest.fn().mockResolvedValue([mockComment]);

      const response = await request(app)
        .get('/api/comments/recent')
        .expect(200);

      expect(response.body.data).toHaveLength(1);
    });
  });

  describe('404 Handling', () => {
    it('should return 404 for unknown routes', async () => {
      const response = await request(app)
        .get('/api/unknown/route')
        .expect(404);

      expect(response.body).toMatchObject({
        error: 'Not Found'
      });
    });
  });

  describe('Request logging', () => {
    it('should process requests', async () => {
      const response = await request(app)
        .get('/health')
        .expect(200);

      expect(response.body.status).toBe('ok');
    });
  });
});
