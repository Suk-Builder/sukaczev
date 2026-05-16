const commentController = require('../../src/controllers/commentController');
const commentService = require('../../src/services/commentService');
const { CommentError } = require('../../src/middleware/errorHandler');

jest.mock('../../src/services/commentService');

describe('CommentController', () => {
  let req, res, next;

  const mockComment = {
    id: '550e8400-e29b-41d4-a716-446655440000',
    videoId: '550e8400-e29b-41d4-a716-446655440001',
    userId: '550e8400-e29b-41d4-a716-446655440002',
    parentId: null,
    content: 'Test comment',
    likesCount: 10,
    repliesCount: 5,
    createdAt: '2024-01-15T10:30:00.000Z',
    updatedAt: '2024-01-15T10:30:00.000Z'
  };

  const mockReply = {
    id: '550e8400-e29b-41d4-a716-446655440003',
    videoId: mockComment.videoId,
    userId: '550e8400-e29b-41d4-a716-446655440004',
    parentId: mockComment.id,
    content: 'Test reply',
    likesCount: 3,
    repliesCount: 0,
    createdAt: '2024-01-15T11:00:00.000Z',
    updatedAt: '2024-01-15T11:00:00.000Z'
  };

  beforeEach(() => {
    req = {
      body: {},
      query: {},
      params: {},
      headers: {},
      validatedBody: {},
      validatedQuery: {},
      validatedParams: {},
      id: 'test-req-123'
    };
    res = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn().mockReturnThis()
    };
    next = jest.fn();
    jest.clearAllMocks();
  });

  describe('getComments', () => {
    it('should return tree comments by default', async () => {
      req.validatedQuery = {
        videoId: mockComment.videoId,
        page: 1,
        flat: 'false'
      };

      commentService.getCommentsTree = jest.fn().mockResolvedValue({
        comments: [mockComment],
        meta: { page: 1, totalPages: 1 }
      });

      await commentController.getComments(req, res, next);

      expect(commentService.getCommentsTree).toHaveBeenCalledWith(
        mockComment.videoId,
        expect.objectContaining({ page: 1 })
      );
      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({
          success: true,
          data: expect.any(Array)
        })
      );
    });

    it('should return flat comments when requested', async () => {
      req.validatedQuery = {
        videoId: mockComment.videoId,
        page: 1,
        flat: 'true',
        sortBy: 'likes_count DESC'
      };

      commentService.getCommentsFlat = jest.fn().mockResolvedValue({
        comments: [mockComment, mockReply],
        meta: { page: 1, total: 2 }
      });

      await commentController.getComments(req, res, next);

      expect(commentService.getCommentsFlat).toHaveBeenCalledWith(
        mockComment.videoId,
        expect.objectContaining({ sortBy: 'likes_count DESC' })
      );
    });

    it('should pass correct pageSize', async () => {
      req.validatedQuery = {
        videoId: mockComment.videoId,
        page: 1,
        flat: 'false'
      };

      commentService.getCommentsTree = jest.fn().mockResolvedValue({
        comments: [],
        meta: {}
      });

      await commentController.getComments(req, res, next);

      expect(commentService.getCommentsTree).toHaveBeenCalledWith(
        expect.any(String),
        expect.objectContaining({ pageSize: 20 })
      );
    });
  });

  describe('createComment', () => {
    it('should create comment successfully', async () => {
      req.validatedBody = {
        videoId: mockComment.videoId,
        userId: mockComment.userId,
        content: mockComment.content
      };

      commentService.createComment = jest.fn().mockResolvedValue(mockComment);

      await commentController.createComment(req, res, next);

      expect(commentService.createComment).toHaveBeenCalledWith(req.validatedBody);
      expect(res.status).toHaveBeenCalledWith(201);
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({
          success: true,
          data: mockComment,
          message: 'Comment created successfully'
        })
      );
    });

    it('should create reply with appropriate message', async () => {
      req.validatedBody = {
        videoId: mockReply.videoId,
        userId: mockReply.userId,
        content: mockReply.content,
        parentId: mockReply.parentId
      };

      commentService.createComment = jest.fn().mockResolvedValue(mockReply);

      await commentController.createComment(req, res, next);

      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({
          message: 'Reply created successfully'
        })
      );
    });

    it('should handle service errors', async () => {
      req.validatedBody = {
        videoId: mockComment.videoId,
        userId: mockComment.userId,
        content: 'Test'
      };

      const error = new CommentError('Creation failed', 500, 'CREATE_ERROR');
      commentService.createComment = jest.fn().mockRejectedValue(error);

      await commentController.createComment(req, res, next);

      expect(next).toHaveBeenCalledWith(error);
    });
  });

  describe('deleteComment', () => {
    it('should delete comment with userId from body', async () => {
      req.params = { id: mockComment.id };
      req.body = { userId: mockComment.userId };

      commentService.deleteComment = jest.fn().mockResolvedValue({
        success: true,
        deletedId: mockComment.id
      });

      await commentController.deleteComment(req, res, next);

      expect(commentService.deleteComment).toHaveBeenCalledWith(
        mockComment.id,
        mockComment.userId
      );
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({
          success: true,
          message: 'Comment deleted successfully'
        })
      );
    });

    it('should delete with userId from header', async () => {
      req.params = { id: mockComment.id };
      req.headers['x-user-id'] = mockComment.userId;

      commentService.deleteComment = jest.fn().mockResolvedValue({
        success: true,
        deletedId: mockComment.id
      });

      await commentController.deleteComment(req, res, next);

      expect(commentService.deleteComment).toHaveBeenCalledWith(
        mockComment.id,
        mockComment.userId
      );
    });

    it('should throw when userId missing', async () => {
      req.params = { id: mockComment.id };

      await commentController.deleteComment(req, res, next);

      expect(next).toHaveBeenCalledWith(expect.any(CommentError));
      const error = next.mock.calls[0][0];
      expect(error.statusCode).toBe(400);
    });
  });

  describe('toggleLike', () => {
    it('should like comment', async () => {
      req.params = { id: mockComment.id };
      req.body = { userId: mockComment.userId };

      commentService.toggleLike = jest.fn().mockResolvedValue({
        liked: true,
        action: 'liked',
        commentId: mockComment.id,
        likesCount: 11
      });

      await commentController.toggleLike(req, res, next);

      expect(commentService.toggleLike).toHaveBeenCalledWith(
        mockComment.id,
        mockComment.userId
      );
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({
          message: 'Comment liked'
        })
      );
    });

    it('should unlike comment', async () => {
      req.params = { id: mockComment.id };
      req.body = { userId: mockComment.userId };

      commentService.toggleLike = jest.fn().mockResolvedValue({
        liked: false,
        action: 'unliked',
        commentId: mockComment.id,
        likesCount: 9
      });

      await commentController.toggleLike(req, res, next);

      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({
          message: 'Comment unliked'
        })
      );
    });

    it('should throw when userId missing', async () => {
      req.params = { id: mockComment.id };

      await commentController.toggleLike(req, res, next);

      expect(next).toHaveBeenCalledWith(expect.any(CommentError));
    });
  });

  describe('getReplies', () => {
    it('should return replies', async () => {
      req.params = { id: mockComment.id };
      req.query = { page: '1', pageSize: '20' };

      commentService.getReplies = jest.fn().mockResolvedValue({
        replies: [mockReply],
        meta: { parentId: mockComment.id, total: 1 }
      });

      await commentController.getReplies(req, res, next);

      expect(commentService.getReplies).toHaveBeenCalledWith(
        mockComment.id,
        { page: 1, pageSize: 20 }
      );
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.any(Array)
        })
      );
    });

    it('should cap pageSize at 100', async () => {
      req.params = { id: mockComment.id };
      req.query = { pageSize: '200' };

      commentService.getReplies = jest.fn().mockResolvedValue({
        replies: [],
        meta: {}
      });

      await commentController.getReplies(req, res, next);

      expect(commentService.getReplies).toHaveBeenCalledWith(
        expect.any(String),
        expect.objectContaining({ pageSize: 100 })
      );
    });
  });

  describe('getThread', () => {
    it('should return comment thread', async () => {
      req.params = { id: mockComment.id };
      req.query = { maxDepth: '5' };

      commentService.getCommentThread = jest.fn().mockResolvedValue({
        comment: { ...mockComment, replies: [mockReply] },
        cached: false
      });

      await commentController.getThread(req, res, next);

      expect(commentService.getCommentThread).toHaveBeenCalledWith(
        mockComment.id,
        5
      );
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.any(Object),
          cached: false
        })
      );
    });

    it('should cap maxDepth at 10', async () => {
      req.params = { id: mockComment.id };
      req.query = { maxDepth: '20' };

      commentService.getCommentThread = jest.fn().mockResolvedValue({
        comment: mockComment,
        cached: false
      });

      await commentController.getThread(req, res, next);

      expect(commentService.getCommentThread).toHaveBeenCalledWith(
        mockComment.id,
        10
      );
    });
  });

  describe('getComment', () => {
    it('should return single comment', async () => {
      req.params = { id: mockComment.id };

      commentService.getCommentThread = jest.fn().mockResolvedValue({
        comment: mockComment
      });

      await commentController.getComment(req, res, next);

      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({
          success: true,
          data: mockComment
        })
      );
    });
  });

  describe('getHotComments', () => {
    it('should return hot comments', async () => {
      req.params = { videoId: mockComment.videoId };
      req.query = { limit: '10' };

      commentService.getHotComments = jest.fn().mockResolvedValue({
        comments: [mockComment],
        cached: false
      });

      await commentController.getHotComments(req, res, next);

      expect(commentService.getHotComments).toHaveBeenCalledWith(
        mockComment.videoId,
        10
      );
    });

    it('should cap limit at 50', async () => {
      req.params = { videoId: mockComment.videoId };
      req.query = { limit: '100' };

      commentService.getHotComments = jest.fn().mockResolvedValue({
        comments: [],
        cached: false
      });

      await commentController.getHotComments(req, res, next);

      expect(commentService.getHotComments).toHaveBeenCalledWith(
        mockComment.videoId,
        50
      );
    });
  });

  describe('getVideoStats', () => {
    it('should return video statistics', async () => {
      req.params = { videoId: mockComment.videoId };

      commentService.getVideoStats = jest.fn().mockResolvedValue({
        videoId: mockComment.videoId,
        totalComments: 150
      });

      await commentController.getVideoStats(req, res, next);

      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ totalComments: 150 })
        })
      );
    });
  });

  describe('getUserComments', () => {
    it('should return user comments', async () => {
      req.params = { userId: mockComment.userId };
      req.query = { limit: '50', offset: '0' };

      commentService.getUserComments = jest.fn().mockResolvedValue([mockComment]);

      await commentController.getUserComments(req, res, next);

      expect(commentService.getUserComments).toHaveBeenCalledWith(
        mockComment.userId,
        { limit: 50, offset: 0 }
      );
    });
  });

  describe('getUserLikedComments', () => {
    it('should return liked comments', async () => {
      req.params = { userId: mockComment.userId };

      commentService.getUserLikedComments = jest.fn().mockResolvedValue([]);

      await commentController.getUserLikedComments(req, res, next);

      expect(commentService.getUserLikedComments).toHaveBeenCalled();
    });
  });

  describe('checkLike', () => {
    it('should return like status', async () => {
      req.params = { id: mockComment.id };
      req.query = { userId: mockComment.userId };

      commentService.hasLiked = jest.fn().mockResolvedValue(true);

      await commentController.checkLike(req, res, next);

      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            commentId: mockComment.id,
            userId: mockComment.userId,
            hasLiked: true
          })
        })
      );
    });

    it('should throw when userId missing', async () => {
      req.params = { id: mockComment.id };

      await commentController.checkLike(req, res, next);

      expect(next).toHaveBeenCalledWith(expect.any(CommentError));
    });
  });

  describe('deleteAllForVideo', () => {
    it('should delete all comments for video', async () => {
      req.params = { videoId: mockComment.videoId };

      commentService.deleteAllForVideo = jest.fn().mockResolvedValue(50);

      await commentController.deleteAllForVideo(req, res, next);

      expect(commentService.deleteAllForVideo).toHaveBeenCalledWith(mockComment.videoId);
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ deletedCount: 50 })
        })
      );
    });
  });

  describe('getRecent', () => {
    it('should return recent comments', async () => {
      req.query = { limit: '50' };

      commentService.getRecentComments = jest.fn().mockResolvedValue([mockComment]);

      await commentController.getRecent(req, res, next);

      expect(commentService.getRecentComments).toHaveBeenCalledWith(50);
    });

    it('should cap limit at 200', async () => {
      req.query = { limit: '500' };

      commentService.getRecentComments = jest.fn().mockResolvedValue([]);

      await commentController.getRecent(req, res, next);

      expect(commentService.getRecentComments).toHaveBeenCalledWith(200);
    });
  });

  describe('error handling', () => {
    it('should pass errors to next', async () => {
      req.validatedQuery = { videoId: mockComment.videoId };
      const error = new Error('Unexpected');

      commentService.getCommentsTree = jest.fn().mockRejectedValue(error);

      await commentController.getComments(req, res, next);

      expect(next).toHaveBeenCalledWith(error);
    });
  });
});
