const CommentLike = require('../../src/models/commentLike');
const { query } = require('../../src/config/database');

describe('CommentLike Model', () => {
  const mockLike = {
    id: '1',
    comment_id: '550e8400-e29b-41d4-a716-446655440000',
    user_id: '550e8400-e29b-41d4-a716-446655440001',
    created_at: '2024-01-15T10:30:00.000Z'
  };

  const mockCommentWithContent = {
    id: '1',
    comment_id: '550e8400-e29b-41d4-a716-446655440000',
    user_id: '550e8400-e29b-41d4-a716-446655440001',
    content: 'Test comment content',
    video_id: '550e8400-e29b-41d4-a716-446655440002',
    created_at: '2024-01-15T10:30:00.000Z'
  };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('serialize', () => {
    it('should serialize database row', () => {
      const result = CommentLike.serialize(mockLike);

      expect(result).toEqual({
        id: '1',
        commentId: mockLike.comment_id,
        userId: mockLike.user_id,
        createdAt: mockLike.created_at
      });
    });

    it('should return null for null input', () => {
      expect(CommentLike.serialize(null)).toBeNull();
    });

    it('should handle missing id', () => {
      const row = { ...mockLike, id: undefined };
      const result = CommentLike.serialize(row);

      expect(result.id).toBeNull();
    });

    it('should convert id to string', () => {
      const row = { ...mockLike, id: 123 };
      const result = CommentLike.serialize(row);

      expect(typeof result.id).toBe('string');
    });
  });

  describe('create', () => {
    it('should create a new like', async () => {
      query.mockResolvedValueOnce({ rows: [mockLike], rowCount: 1 });

      const result = await CommentLike.create(
        mockLike.comment_id,
        mockLike.user_id
      );

      expect(query).toHaveBeenCalledWith(
        expect.stringContaining('INSERT INTO comment_likes'),
        [mockLike.comment_id, mockLike.user_id]
      );
      expect(result).not.toBeNull();
      expect(result.commentId).toBe(mockLike.comment_id);
    });

    it('should return null on duplicate like', async () => {
      query.mockResolvedValueOnce({ rows: [], rowCount: 0 });

      const result = await CommentLike.create(
        mockLike.comment_id,
        mockLike.user_id
      );

      expect(result).toBeNull();
    });

    it('should handle database errors', async () => {
      query.mockRejectedValueOnce(new Error('Insert failed'));

      await expect(
        CommentLike.create(mockLike.comment_id, mockLike.user_id)
      ).rejects.toThrow('Insert failed');
    });
  });

  describe('delete (unlike)', () => {
    it('should delete existing like', async () => {
      query.mockResolvedValueOnce({ rows: [{ id: 1 }], rowCount: 1 });

      const result = await CommentLike.delete(
        mockLike.comment_id,
        mockLike.user_id
      );

      expect(query).toHaveBeenCalledWith(
        expect.stringContaining('DELETE FROM comment_likes'),
        [mockLike.comment_id, mockLike.user_id]
      );
      expect(result).toBe(true);
    });

    it('should return false when like not found', async () => {
      query.mockResolvedValueOnce({ rows: [], rowCount: 0 });

      const result = await CommentLike.delete(
        mockLike.comment_id,
        mockLike.user_id
      );

      expect(result).toBe(false);
    });
  });

  describe('hasLiked', () => {
    it('should return true when user has liked', async () => {
      query.mockResolvedValueOnce({
        rows: [{ has_liked: true }],
        rowCount: 1
      });

      const result = await CommentLike.hasLiked(
        mockLike.comment_id,
        mockLike.user_id
      );

      expect(query).toHaveBeenCalledWith(
        expect.stringContaining('EXISTS'),
        [mockLike.comment_id, mockLike.user_id]
      );
      expect(result).toBe(true);
    });

    it('should return false when user has not liked', async () => {
      query.mockResolvedValueOnce({
        rows: [{ has_liked: false }],
        rowCount: 1
      });

      const result = await CommentLike.hasLiked(
        mockLike.comment_id,
        mockLike.user_id
      );

      expect(result).toBe(false);
    });

    it('should handle null result', async () => {
      query.mockResolvedValueOnce({
        rows: [{ has_liked: null }],
        rowCount: 1
      });

      const result = await CommentLike.hasLiked(
        mockLike.comment_id,
        mockLike.user_id
      );

      expect(result).toBe(false);
    });
  });

  describe('countByComment', () => {
    it('should count likes for comment', async () => {
      query.mockResolvedValueOnce({ rows: [{ count: '42' }], rowCount: 1 });

      const result = await CommentLike.countByComment(mockLike.comment_id);

      expect(query).toHaveBeenCalledWith(
        expect.stringContaining('SELECT COUNT(*)'),
        [mockLike.comment_id]
      );
      expect(result).toBe(42);
    });

    it('should return 0 when no likes', async () => {
      query.mockResolvedValueOnce({ rows: [{ count: '0' }], rowCount: 1 });

      const result = await CommentLike.countByComment(mockLike.comment_id);

      expect(result).toBe(0);
    });
  });

  describe('findByComment', () => {
    it('should find likes for comment', async () => {
      query.mockResolvedValueOnce({
        rows: [mockLike, { ...mockLike, id: 2, user_id: 'different-user' }],
        rowCount: 2
      });

      const results = await CommentLike.findByComment(mockLike.comment_id);

      expect(query).toHaveBeenCalledWith(
        expect.stringContaining('WHERE comment_id = $1'),
        [mockLike.comment_id, 100, 0]
      );
      expect(results).toHaveLength(2);
    });

    it('should respect limit and offset', async () => {
      query.mockResolvedValueOnce({ rows: [], rowCount: 0 });

      await CommentLike.findByComment(mockLike.comment_id, { limit: 5, offset: 10 });

      expect(query).toHaveBeenCalledWith(
        expect.any(String),
        [mockLike.comment_id, 5, 10]
      );
    });
  });

  describe('findByUser', () => {
    it('should find comments liked by user', async () => {
      query.mockResolvedValueOnce({
        rows: [mockCommentWithContent],
        rowCount: 1
      });

      const results = await CommentLike.findByUser(mockLike.user_id);

      expect(query).toHaveBeenCalledWith(
        expect.stringContaining('JOIN comments'),
        [mockLike.user_id, 100, 0]
      );
      expect(results[0].content).toBe(mockCommentWithContent.content);
      expect(results[0].videoId).toBe(mockCommentWithContent.video_id);
    });

    it('should return enriched like data', async () => {
      query.mockResolvedValueOnce({
        rows: [mockCommentWithContent],
        rowCount: 1
      });

      const results = await CommentLike.findByUser(mockLike.user_id);

      expect(results[0]).toMatchObject({
        commentId: mockCommentWithContent.comment_id,
        userId: mockCommentWithContent.user_id,
        content: mockCommentWithContent.content,
        videoId: mockCommentWithContent.video_id
      });
    });
  });

  describe('toggle', () => {
    it('should like when not previously liked', async () => {
      query
        .mockResolvedValueOnce({ rows: [{ has_liked: false }], rowCount: 1 })
        .mockResolvedValueOnce({ rows: [mockLike], rowCount: 1 });

      const result = await CommentLike.toggle(
        mockLike.comment_id,
        mockLike.user_id
      );

      expect(result).toEqual({
        liked: true,
        action: 'liked',
        success: true
      });
    });

    it('should unlike when previously liked', async () => {
      query
        .mockResolvedValueOnce({ rows: [{ has_liked: true }], rowCount: 1 })
        .mockResolvedValueOnce({ rows: [{ id: 1 }], rowCount: 1 });

      const result = await CommentLike.toggle(
        mockLike.comment_id,
        mockLike.user_id
      );

      expect(result).toEqual({
        liked: false,
        action: 'unliked',
        success: true
      });
    });

    it('should handle unlike when like not found', async () => {
      query
        .mockResolvedValueOnce({ rows: [{ has_liked: true }], rowCount: 1 })
        .mockResolvedValueOnce({ rows: [], rowCount: 0 });

      const result = await CommentLike.toggle(
        mockLike.comment_id,
        mockLike.user_id
      );

      expect(result.success).toBe(false);
    });

    it('should handle like conflict', async () => {
      query
        .mockResolvedValueOnce({ rows: [{ has_liked: false }], rowCount: 1 })
        .mockResolvedValueOnce({ rows: [], rowCount: 0 });

      const result = await CommentLike.toggle(
        mockLike.comment_id,
        mockLike.user_id
      );

      expect(result.success).toBe(false);
    });
  });

  describe('deleteByComment', () => {
    it('should delete all likes for comment', async () => {
      query.mockResolvedValueOnce({
        rows: [{ id: 1 }, { id: 2 }, { id: 3 }],
        rowCount: 3
      });

      const result = await CommentLike.deleteByComment(mockLike.comment_id);

      expect(query).toHaveBeenCalledWith(
        expect.stringContaining('DELETE FROM comment_likes'),
        [mockLike.comment_id]
      );
      expect(result).toBe(3);
    });

    it('should return 0 when no likes', async () => {
      query.mockResolvedValueOnce({ rows: [], rowCount: 0 });

      const result = await CommentLike.deleteByComment(mockLike.comment_id);

      expect(result).toBe(0);
    });
  });

  describe('getStats', () => {
    it('should return global statistics', async () => {
      query.mockResolvedValueOnce({
        rows: [{
          total_likes: '500',
          liked_comments: '200',
          unique_users: '150'
        }],
        rowCount: 1
      });

      const stats = await CommentLike.getStats();

      expect(stats).toEqual({
        totalLikes: 500,
        likedComments: 200,
        uniqueUsers: 150
      });
    });

    it('should handle zero stats', async () => {
      query.mockResolvedValueOnce({
        rows: [{
          total_likes: null,
          liked_comments: null,
          unique_users: null
        }],
        rowCount: 1
      });

      const stats = await CommentLike.getStats();

      expect(stats).toEqual({
        totalLikes: 0,
        likedComments: 0,
        uniqueUsers: 0
      });
    });
  });

  describe('edge cases', () => {
    it('should handle rapid like/unlike cycles', async () => {
      query
        .mockResolvedValueOnce({ rows: [{ has_liked: false }], rowCount: 1 })
        .mockResolvedValueOnce({ rows: [mockLike], rowCount: 1 });

      const likeResult = await CommentLike.toggle(
        mockLike.comment_id,
        mockLike.user_id
      );

      query
        .mockResolvedValueOnce({ rows: [{ has_liked: true }], rowCount: 1 })
        .mockResolvedValueOnce({ rows: [{ id: 1 }], rowCount: 1 });

      const unlikeResult = await CommentLike.toggle(
        mockLike.comment_id,
        mockLike.user_id
      );

      expect(likeResult.liked).toBe(true);
      expect(unlikeResult.liked).toBe(false);
    });

    it('should handle multiple users liking same comment', async () => {
      query.mockResolvedValueOnce({
        rows: [
          { ...mockLike, user_id: 'user-1' },
          { ...mockLike, id: 2, user_id: 'user-2' },
          { ...mockLike, id: 3, user_id: 'user-3' }
        ],
        rowCount: 3
      });

      const results = await CommentLike.findByComment(mockLike.comment_id);

      const userIds = results.map(r => r.userId);
      expect(userIds).toContain('user-1');
      expect(userIds).toContain('user-2');
      expect(userIds).toContain('user-3');
    });

    it('should handle same user liking different comments', async () => {
      query.mockResolvedValueOnce({
        rows: [
          { ...mockCommentWithContent, comment_id: 'comment-1' },
          { ...mockCommentWithContent, comment_id: 'comment-2' }
        ],
        rowCount: 2
      });

      const results = await CommentLike.findByUser(mockLike.user_id);

      expect(results).toHaveLength(2);
    });

    it('should handle bigint id conversion', async () => {
      const row = { ...mockLike, id: 9223372036854775807n };
      query.mockResolvedValueOnce({ rows: [row], rowCount: 1 });

      const result = await CommentLike.create(
        mockLike.comment_id,
        mockLike.user_id
      );

      expect(result.id).toBe('9223372036854775807');
    });
  });
});
