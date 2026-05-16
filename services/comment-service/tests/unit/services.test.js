const commentService = require('../../src/services/commentService');
const Comment = require('../../src/models/comment');
const CommentLike = require('../../src/models/commentLike');
const publisher = require('../../src/events/publisher');
const {
  cacheComments,
  getCachedComments,
  cacheCommentTree,
  getCachedCommentTree,
  invalidateCommentCache,
  cacheHotComments,
  getCachedHotComments
} = require('../../src/config/redis');
const { CommentError } = require('../../src/middleware/errorHandler');

jest.mock('../../src/models/comment');
jest.mock('../../src/models/commentLike');
jest.mock('../../src/events/publisher');
jest.mock('../../src/config/redis', () => ({
  ...jest.requireActual('../../src/config/redis'),
  cacheComments: jest.fn().mockResolvedValue(),
  getCachedComments: jest.fn().mockResolvedValue(null),
  cacheCommentTree: jest.fn().mockResolvedValue(),
  getCachedCommentTree: jest.fn().mockResolvedValue(null),
  invalidateCommentCache: jest.fn().mockResolvedValue(),
  cacheHotComments: jest.fn().mockResolvedValue(),
  getCachedHotComments: jest.fn().mockResolvedValue(null)
}));

describe('CommentService', () => {
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
    jest.clearAllMocks();
    publisher.commentCreated = jest.fn().mockResolvedValue();
    publisher.commentDeleted = jest.fn().mockResolvedValue();
    publisher.commentLiked = jest.fn().mockResolvedValue();
    publisher.commentReply = jest.fn().mockResolvedValue();
  });

  describe('createComment', () => {
    it('should create top-level comment', async () => {
      Comment.create = jest.fn().mockResolvedValue(mockComment);

      const result = await commentService.createComment({
        videoId: mockComment.videoId,
        userId: mockComment.userId,
        content: mockComment.content
      });

      expect(Comment.create).toHaveBeenCalledWith({
        videoId: mockComment.videoId,
        userId: mockComment.userId,
        content: mockComment.content,
        parentId: undefined
      });
      expect(invalidateCommentCache).toHaveBeenCalledWith(mockComment.videoId);
      expect(publisher.commentCreated).toHaveBeenCalledWith(mockComment);
      expect(result).toEqual(mockComment);
    });

    it('should create reply comment', async () => {
      Comment.create = jest.fn().mockResolvedValue(mockReply);
      Comment.findById = jest.fn().mockResolvedValue(mockComment);

      const result = await commentService.createComment({
        videoId: mockComment.videoId,
        userId: mockReply.userId,
        content: mockReply.content,
        parentId: mockComment.id
      });

      expect(Comment.create).toHaveBeenCalledWith({
        videoId: mockComment.videoId,
        userId: mockReply.userId,
        content: mockReply.content,
        parentId: mockComment.id
      });
      expect(publisher.commentReply).toHaveBeenCalled();
      expect(result.parentId).toBe(mockComment.id);
    });

    it('should reject empty content', async () => {
      await expect(
        commentService.createComment({
          videoId: mockComment.videoId,
          userId: mockComment.userId,
          content: ''
        })
      ).rejects.toThrow(CommentError);

      expect(Comment.create).not.toHaveBeenCalled();
    });

    it('should reject whitespace-only content', async () => {
      await expect(
        commentService.createComment({
          videoId: mockComment.videoId,
          userId: mockComment.userId,
          content: '   '
        })
      ).rejects.toThrow(CommentError);
    });

    it('should reject content exceeding max length', async () => {
      const longContent = 'x'.repeat(2001);

      await expect(
        commentService.createComment({
          videoId: mockComment.videoId,
          userId: mockComment.userId,
          content: longContent
        })
      ).rejects.toThrow(CommentError);
    });

    it('should accept content at max length', async () => {
      const maxContent = 'x'.repeat(2000);
      Comment.create = jest.fn().mockResolvedValue({
        ...mockComment,
        content: maxContent
      });

      const result = await commentService.createComment({
        videoId: mockComment.videoId,
        userId: mockComment.userId,
        content: maxContent
      });

      expect(result.content).toBe(maxContent);
    });

    it('should reject non-existent parent', async () => {
      Comment.findById = jest.fn().mockResolvedValue(null);

      await expect(
        commentService.createComment({
          videoId: mockComment.videoId,
          userId: mockComment.userId,
          content: 'Reply',
          parentId: 'non-existent-parent'
        })
      ).rejects.toThrow(CommentError);

      expect(Comment.create).not.toHaveBeenCalled();
    });

    it('should reject parent from different video', async () => {
      Comment.findById = jest.fn().mockResolvedValue({
        ...mockComment,
        videoId: 'different-video-id'
      });

      await expect(
        commentService.createComment({
          videoId: mockComment.videoId,
          userId: mockComment.userId,
          content: 'Reply',
          parentId: mockComment.id
        })
      ).rejects.toThrow(CommentError);
    });

    it('should reject when max depth exceeded', async () => {
      const deepParent = { ...mockComment, parentId: 'level-3-id' };
      Comment.findById = jest.fn().mockResolvedValue(deepParent);

      // Mock calculateCommentDepth to return 5
      const { query } = require('../../src/config/database');
      query.mockResolvedValueOnce({ rows: [{ parent_id: 'l4' }] })
        .mockResolvedValueOnce({ rows: [{ parent_id: 'l3' }] })
        .mockResolvedValueOnce({ rows: [{ parent_id: 'l2' }] })
        .mockResolvedValueOnce({ rows: [{ parent_id: 'l1' }] })
        .mockResolvedValueOnce({ rows: [{ parent_id: null }] });

      await expect(
        commentService.createComment({
          videoId: mockComment.videoId,
          userId: mockComment.userId,
          content: 'Deep reply',
          parentId: deepParent.id
        })
      ).rejects.toThrow(CommentError);
    });

    it('should handle database errors', async () => {
      Comment.create = jest.fn().mockRejectedValue(new Error('DB error'));

      await expect(
        commentService.createComment({
          videoId: mockComment.videoId,
          userId: mockComment.userId,
          content: 'Test'
        })
      ).rejects.toThrow(CommentError);
    });

    it('should trim content', async () => {
      Comment.create = jest.fn().mockResolvedValue(mockComment);

      await commentService.createComment({
        videoId: mockComment.videoId,
        userId: mockComment.userId,
        content: '  Trimmed content  '
      });

      expect(Comment.create).toHaveBeenCalledWith(
        expect.objectContaining({
          content: 'Trimmed content'
        })
      );
    });
  });

  describe('getCommentsTree', () => {
    it('should return cached comments', async () => {
      const cachedTree = [mockComment];
      getCachedComments.mockResolvedValueOnce(cachedTree);

      const result = await commentService.getCommentsTree(mockComment.videoId);

      expect(getCachedComments).toHaveBeenCalledWith(mockComment.videoId, 1);
      expect(result.comments).toEqual(cachedTree);
      expect(result.meta.cached).toBe(true);
    });

    it('should build tree from database', async () => {
      getCachedComments.mockResolvedValueOnce(null);
      Comment.getTreeByVideo = jest.fn().mockResolvedValue([mockComment]);
      Comment.countTopLevelByVideo = jest.fn().mockResolvedValue(1);

      const result = await commentService.getCommentsTree(mockComment.videoId);

      expect(Comment.getTreeByVideo).toHaveBeenCalled();
      expect(cacheComments).toHaveBeenCalledWith(
        mockComment.videoId,
        [mockComment],
        1
      );
      expect(result.comments).toHaveLength(1);
      expect(result.meta.page).toBe(1);
    });

    it('should support pagination', async () => {
      getCachedComments.mockResolvedValueOnce(null);
      Comment.getTreeByVideo = jest.fn().mockResolvedValue([]);
      Comment.countTopLevelByVideo = jest.fn().mockResolvedValue(50);

      const result = await commentService.getCommentsTree(
        mockComment.videoId,
        { page: 2, pageSize: 20 }
      );

      expect(result.meta.page).toBe(2);
      expect(result.meta.totalPages).toBe(3);
    });

    it('should handle errors', async () => {
      Comment.getTreeByVideo = jest.fn().mockRejectedValue(new Error('Query failed'));

      await expect(
        commentService.getCommentsTree(mockComment.videoId)
      ).rejects.toThrow(CommentError);
    });
  });

  describe('getCommentsFlat', () => {
    it('should return flat comment list', async () => {
      Comment.findByVideo = jest.fn().mockResolvedValue([mockComment, mockReply]);
      Comment.countByVideo = jest.fn().mockResolvedValue(2);

      const result = await commentService.getCommentsFlat(mockComment.videoId);

      expect(result.comments).toHaveLength(2);
      expect(result.meta.total).toBe(2);
      expect(result.meta.totalPages).toBe(1);
    });

    it('should support custom sorting', async () => {
      Comment.findByVideo = jest.fn().mockResolvedValue([]);
      Comment.countByVideo = jest.fn().mockResolvedValue(0);

      await commentService.getCommentsFlat(mockComment.videoId, {
        sortBy: 'likes_count DESC'
      });

      expect(Comment.findByVideo).toHaveBeenCalledWith(
        mockComment.videoId,
        expect.objectContaining({ orderBy: 'likes_count DESC' })
      );
    });

    it('should handle pagination', async () => {
      Comment.findByVideo = jest.fn().mockResolvedValue([]);
      Comment.countByVideo = jest.fn().mockResolvedValue(100);

      const result = await commentService.getCommentsFlat(
        mockComment.videoId,
        { page: 3, pageSize: 20 }
      );

      expect(result.meta.page).toBe(3);
      expect(result.meta.pageSize).toBe(20);
    });
  });

  describe('getCommentThread', () => {
    it('should return cached thread', async () => {
      const cachedThread = { ...mockComment, replies: [mockReply] };
      getCachedCommentTree.mockResolvedValueOnce(cachedThread);

      const result = await commentService.getCommentThread(mockComment.id);

      expect(result.comment).toEqual(cachedThread);
      expect(result.cached).toBe(true);
    });

    it('should fetch from database', async () => {
      getCachedCommentTree.mockResolvedValueOnce(null);
      Comment.getThread = jest.fn().mockResolvedValue({
        ...mockComment,
        replies: [mockReply]
      });

      const result = await commentService.getCommentThread(mockComment.id);

      expect(Comment.getThread).toHaveBeenCalledWith(mockComment.id, 5);
      expect(cacheCommentTree).toHaveBeenCalled();
      expect(result.comment.replies).toHaveLength(1);
    });

    it('should throw when comment not found', async () => {
      getCachedCommentTree.mockResolvedValueOnce(null);
      Comment.getThread = jest.fn().mockResolvedValue(null);

      await expect(
        commentService.getCommentThread('non-existent')
      ).rejects.toThrow(CommentError);
    });

    it('should respect max depth', async () => {
      getCachedCommentTree.mockResolvedValueOnce(null);
      Comment.getThread = jest.fn().mockResolvedValue(mockComment);

      await commentService.getCommentThread(mockComment.id, 10);

      expect(Comment.getThread).toHaveBeenCalledWith(mockComment.id, 10);
    });
  });

  describe('deleteComment', () => {
    it('should delete comment by author', async () => {
      Comment.findById = jest.fn().mockResolvedValue(mockComment);
      Comment.delete = jest.fn().mockResolvedValue(true);

      const result = await commentService.deleteComment(
        mockComment.id,
        mockComment.userId
      );

      expect(Comment.delete).toHaveBeenCalledWith(mockComment.id);
      expect(invalidateCommentCache).toHaveBeenCalledWith(mockComment.videoId);
      expect(publisher.commentDeleted).toHaveBeenCalled();
      expect(result.success).toBe(true);
    });

    it('should reject deletion when comment not found', async () => {
      Comment.findById = jest.fn().mockResolvedValue(null);

      await expect(
        commentService.deleteComment('non-existent', mockComment.userId)
      ).rejects.toThrow(CommentError);
    });

    it('should reject deletion by non-author', async () => {
      Comment.findById = jest.fn().mockResolvedValue(mockComment);

      await expect(
        commentService.deleteComment(mockComment.id, 'different-user')
      ).rejects.toThrow(CommentError);
    });

    it('should handle deletion errors', async () => {
      Comment.findById = jest.fn().mockResolvedValue(mockComment);
      Comment.delete = jest.fn().mockRejectedValue(new Error('Delete failed'));

      await expect(
        commentService.deleteComment(mockComment.id, mockComment.userId)
      ).rejects.toThrow(CommentError);
    });
  });

  describe('toggleLike', () => {
    it('should like a comment', async () => {
      Comment.findById = jest.fn().mockResolvedValue(mockComment);
      CommentLike.toggle = jest.fn().mockResolvedValue({
        liked: true,
        action: 'liked',
        success: true
      });
      Comment.incrementLikes = jest.fn().mockResolvedValue(11);
      Comment.findById = jest.fn().mockResolvedValue({
        ...mockComment,
        likesCount: 11
      });

      const result = await commentService.toggleLike(
        mockComment.id,
        mockComment.userId
      );

      expect(CommentLike.toggle).toHaveBeenCalledWith(
        mockComment.id,
        mockComment.userId
      );
      expect(Comment.incrementLikes).toHaveBeenCalledWith(mockComment.id);
      expect(invalidateCommentCache).toHaveBeenCalled();
      expect(result.liked).toBe(true);
      expect(result.likesCount).toBe(11);
    });

    it('should unlike a comment', async () => {
      const updatedComment = { ...mockComment, likesCount: 9 };
      Comment.findById = jest.fn().mockResolvedValue(mockComment);
      CommentLike.toggle = jest.fn().mockResolvedValue({
        liked: false,
        action: 'unliked',
        success: true
      });
      Comment.decrementLikes = jest.fn().mockResolvedValue(9);
      Comment.findById = jest.fn().mockResolvedValue(updatedComment);

      const result = await commentService.toggleLike(
        mockComment.id,
        mockComment.userId
      );

      expect(Comment.decrementLikes).toHaveBeenCalledWith(mockComment.id);
      expect(result.liked).toBe(false);
      expect(result.likesCount).toBe(9);
    });

    it('should throw when comment not found', async () => {
      Comment.findById = jest.fn().mockResolvedValue(null);

      await expect(
        commentService.toggleLike('non-existent', mockComment.userId)
      ).rejects.toThrow(CommentError);
    });

    it('should publish like event', async () => {
      Comment.findById = jest.fn().mockResolvedValue(mockComment);
      CommentLike.toggle = jest.fn().mockResolvedValue({
        liked: true,
        action: 'liked',
        success: true
      });
      Comment.incrementLikes = jest.fn().mockResolvedValue(11);

      await commentService.toggleLike(mockComment.id, mockComment.userId);

      expect(publisher.commentLiked).toHaveBeenCalledWith({
        commentId: mockComment.id,
        userId: mockComment.userId,
        videoId: mockComment.videoId
      });
    });
  });

  describe('getReplies', () => {
    it('should return replies with pagination', async () => {
      Comment.findById = jest.fn().mockResolvedValue(mockComment);
      Comment.findReplies = jest.fn().mockResolvedValue([mockReply]);
      Comment.countReplies = jest.fn().mockResolvedValue(1);

      const result = await commentService.getReplies(mockComment.id);

      expect(result.replies).toHaveLength(1);
      expect(result.meta.parentId).toBe(mockComment.id);
      expect(result.meta.total).toBe(1);
    });

    it('should throw when parent not found', async () => {
      Comment.findById = jest.fn().mockResolvedValue(null);

      await expect(
        commentService.getReplies('non-existent')
      ).rejects.toThrow(CommentError);
    });
  });

  describe('getHotComments', () => {
    it('should return cached hot comments', async () => {
      const cached = [mockComment];
      getCachedHotComments.mockResolvedValueOnce(cached);

      const result = await commentService.getHotComments(mockComment.videoId);

      expect(result.comments).toEqual(cached);
      expect(result.cached).toBe(true);
    });

    it('should fetch from database', async () => {
      getCachedHotComments.mockResolvedValueOnce(null);
      Comment.findPopularByVideo = jest.fn().mockResolvedValue([mockComment]);

      const result = await commentService.getHotComments(mockComment.videoId);

      expect(Comment.findPopularByVideo).toHaveBeenCalledWith(
        mockComment.videoId,
        10
      );
      expect(cacheHotComments).toHaveBeenCalled();
      expect(result.cached).toBe(false);
    });

    it('should respect limit', async () => {
      getCachedHotComments.mockResolvedValueOnce(null);
      Comment.findPopularByVideo = jest.fn().mockResolvedValue([]);

      await commentService.getHotComments(mockComment.videoId, 25);

      expect(Comment.findPopularByVideo).toHaveBeenCalledWith(
        mockComment.videoId,
        25
      );
    });
  });

  describe('getVideoStats', () => {
    it('should return video statistics', async () => {
      const stats = {
        videoId: mockComment.videoId,
        totalComments: 150,
        uniqueUsers: 45
      };
      Comment.getVideoStats = jest.fn().mockResolvedValue(stats);

      const result = await commentService.getVideoStats(mockComment.videoId);

      expect(result).toEqual(stats);
    });
  });

  describe('getUserComments', () => {
    it('should return user comments', async () => {
      const comments = [mockComment];
      Comment.findByUser = jest.fn().mockResolvedValue(comments);

      const result = await commentService.getUserComments(mockComment.userId);

      expect(result).toEqual(comments);
    });
  });

  describe('getUserLikedComments', () => {
    it('should return liked comments', async () => {
      const likes = [{ commentId: '1', videoId: 'v1' }];
      CommentLike.findByUser = jest.fn().mockResolvedValue(likes);

      const result = await commentService.getUserLikedComments(mockComment.userId);

      expect(result).toEqual(likes);
    });
  });

  describe('hasLiked', () => {
    it('should return true when liked', async () => {
      CommentLike.hasLiked = jest.fn().mockResolvedValue(true);

      const result = await commentService.hasLiked(mockComment.id, mockComment.userId);

      expect(result).toBe(true);
    });

    it('should return false when not liked', async () => {
      CommentLike.hasLiked = jest.fn().mockResolvedValue(false);

      const result = await commentService.hasLiked(mockComment.id, mockComment.userId);

      expect(result).toBe(false);
    });

    it('should handle errors gracefully', async () => {
      CommentLike.hasLiked = jest.fn().mockRejectedValue(new Error('DB error'));

      const result = await commentService.hasLiked(mockComment.id, mockComment.userId);

      expect(result).toBe(false);
    });
  });

  describe('calculateCommentDepth', () => {
    it('should calculate depth for top-level', async () => {
      const { query } = require('../../src/config/database');
      query.mockResolvedValueOnce({ rows: [{ parent_id: null }] });

      const depth = await commentService.calculateCommentDepth(mockComment.id);

      expect(depth).toBe(0);
    });

    it('should calculate depth for nested comment', async () => {
      const { query } = require('../../src/config/database');
      query
        .mockResolvedValueOnce({ rows: [{ parent_id: 'parent-1' }] })
        .mockResolvedValueOnce({ rows: [{ parent_id: 'parent-2' }] })
        .mockResolvedValueOnce({ rows: [{ parent_id: null }] });

      const depth = await commentService.calculateCommentDepth(mockComment.id);

      expect(depth).toBe(2);
    });

    it('should stop at max iterations', async () => {
      const { query } = require('../../src/config/database');
      // Always return a parent to test iteration limit
      for (let i = 0; i < 15; i++) {
        query.mockResolvedValueOnce({ rows: [{ parent_id: `parent-${i}` }] });
      }

      const depth = await commentService.calculateCommentDepth(mockComment.id);

      expect(depth).toBeLessThanOrEqual(10);
    });
  });

  describe('deleteAllForVideo', () => {
    it('should delete all comments', async () => {
      Comment.deleteByVideo = jest.fn().mockResolvedValue(50);

      const result = await commentService.deleteAllForVideo(mockComment.videoId);

      expect(Comment.deleteByVideo).toHaveBeenCalledWith(mockComment.videoId);
      expect(invalidateCommentCache).toHaveBeenCalled();
      expect(result).toBe(50);
    });
  });

  describe('getRecentComments', () => {
    it('should return recent comments', async () => {
      Comment.findRecent = jest.fn().mockResolvedValue([mockComment]);

      const result = await commentService.getRecentComments(20);

      expect(result).toHaveLength(1);
    });
  });
});
