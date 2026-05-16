const Comment = require('../../src/models/comment');
const { query } = require('../../src/config/database');

describe('Comment Model', () => {
  const mockComment = {
    id: '550e8400-e29b-41d4-a716-446655440000',
    video_id: '550e8400-e29b-41d4-a716-446655440001',
    user_id: '550e8400-e29b-41d4-a716-446655440002',
    parent_id: null,
    content: 'This is a test comment',
    likes_count: 10,
    replies_count: 5,
    created_at: '2024-01-15T10:30:00.000Z',
    updated_at: '2024-01-15T10:30:00.000Z'
  };

  const mockReply = {
    id: '550e8400-e29b-41d4-a716-446655440003',
    video_id: '550e8400-e29b-41d4-a716-446655440001',
    user_id: '550e8400-e29b-41d4-a716-446655440004',
    parent_id: '550e8400-e29b-41d4-a716-446655440000',
    content: 'This is a reply',
    likes_count: 3,
    replies_count: 0,
    created_at: '2024-01-15T11:00:00.000Z',
    updated_at: '2024-01-15T11:00:00.000Z'
  };

  const mockNestedReply = {
    id: '550e8400-e29b-41d4-a716-446655440005',
    video_id: '550e8400-e29b-41d4-a716-446655440001',
    user_id: '550e8400-e29b-41d4-a716-446655440006',
    parent_id: '550e8400-e29b-41d4-a716-446655440003',
    content: 'Nested reply level 2',
    likes_count: 1,
    replies_count: 0,
    created_at: '2024-01-15T11:30:00.000Z',
    updated_at: '2024-01-15T11:30:00.000Z'
  };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('serialize', () => {
    it('should serialize database row to camelCase', () => {
      const result = Comment.serialize(mockComment);

      expect(result).toEqual({
        id: mockComment.id,
        videoId: mockComment.video_id,
        userId: mockComment.user_id,
        parentId: mockComment.parent_id,
        content: mockComment.content,
        likesCount: mockComment.likes_count,
        repliesCount: mockComment.replies_count,
        createdAt: mockComment.created_at,
        updatedAt: mockComment.updated_at
      });
    });

    it('should return null for null input', () => {
      expect(Comment.serialize(null)).toBeNull();
    });

    it('should return null for undefined input', () => {
      expect(Comment.serialize(undefined)).toBeNull();
    });

    it('should handle zero counts', () => {
      const row = { ...mockComment, likes_count: 0, replies_count: 0 };
      const result = Comment.serialize(row);

      expect(result.likesCount).toBe(0);
      expect(result.repliesCount).toBe(0);
    });

    it('should parse string numbers to integers', () => {
      const row = { ...mockComment, likes_count: '42', replies_count: '7' };
      const result = Comment.serialize(row);

      expect(typeof result.likesCount).toBe('number');
      expect(typeof result.repliesCount).toBe('number');
      expect(result.likesCount).toBe(42);
      expect(result.repliesCount).toBe(7);
    });

    it('should handle reply with parentId', () => {
      const result = Comment.serialize(mockReply);

      expect(result.parentId).toBe(mockReply.parent_id);
      expect(result.likesCount).toBe(3);
    });
  });

  describe('create', () => {
    it('should create top-level comment', async () => {
      query.mockResolvedValueOnce({ rows: [mockComment], rowCount: 1 });

      const data = {
        videoId: mockComment.video_id,
        userId: mockComment.user_id,
        content: mockComment.content
      };

      const result = await Comment.create(data);

      expect(query).toHaveBeenCalledWith(
        expect.stringContaining('INSERT INTO comments'),
        expect.arrayContaining([
          expect.any(String),
          data.videoId,
          data.userId,
          null,
          data.content
        ])
      );
      expect(result.content).toBe(data.content);
      expect(result.parentId).toBeNull();
    });

    it('should create reply comment', async () => {
      query
        .mockResolvedValueOnce({ rows: [mockReply], rowCount: 1 })
        .mockResolvedValueOnce({ rows: [{ replies_count: 6 }], rowCount: 1 });

      const data = {
        videoId: mockReply.video_id,
        userId: mockReply.user_id,
        content: mockReply.content,
        parentId: mockReply.parent_id
      };

      const result = await Comment.create(data);

      expect(query).toHaveBeenCalledWith(
        expect.stringContaining('INSERT INTO comments'),
        expect.arrayContaining([
          expect.any(String),
          data.videoId,
          data.userId,
          data.parentId,
          data.content
        ])
      );
      expect(result.parentId).toBe(data.parentId);
    });

    it('should increment parent replies_count for reply', async () => {
      query
        .mockResolvedValueOnce({ rows: [mockReply], rowCount: 1 })
        .mockResolvedValueOnce({ rows: [{ replies_count: 6 }], rowCount: 1 });

      await Comment.create({
        videoId: mockReply.video_id,
        userId: mockReply.user_id,
        content: 'Reply content',
        parentId: '550e8400-e29b-41d4-a716-446655440000'
      });

      expect(query).toHaveBeenCalledTimes(2);
    });

    it('should handle database errors', async () => {
      query.mockRejectedValueOnce(new Error('Insert failed'));

      await expect(Comment.create({
        videoId: mockComment.video_id,
        userId: mockComment.user_id,
        content: 'Test'
      })).rejects.toThrow('Insert failed');
    });

    it('should generate UUID for new comment', async () => {
      query.mockResolvedValueOnce({ rows: [mockComment], rowCount: 1 });

      const result = await Comment.create({
        videoId: mockComment.video_id,
        userId: mockComment.user_id,
        content: 'Test'
      });

      expect(result.id).toBeDefined();
      expect(result.id).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i);
    });
  });

  describe('findById', () => {
    it('should find comment by id', async () => {
      query.mockResolvedValueOnce({ rows: [mockComment], rowCount: 1 });

      const result = await Comment.findById(mockComment.id);

      expect(query).toHaveBeenCalledWith(
        'SELECT * FROM comments WHERE id = $1',
        [mockComment.id]
      );
      expect(result.id).toBe(mockComment.id);
    });

    it('should return null when not found', async () => {
      query.mockResolvedValueOnce({ rows: [], rowCount: 0 });

      const result = await Comment.findById('non-existent-id');

      expect(result).toBeNull();
    });
  });

  describe('findTopLevelByVideo', () => {
    it('should find top-level comments', async () => {
      query.mockResolvedValueOnce({
        rows: [mockComment, { ...mockComment, id: 'another-id' }],
        rowCount: 2
      });

      const results = await Comment.findTopLevelByVideo(mockComment.video_id);

      expect(query).toHaveBeenCalledWith(
        expect.stringContaining('parent_id IS NULL'),
        [mockComment.video_id, 20, 0]
      );
      expect(results).toHaveLength(2);
      expect(results[0].parentId).toBeNull();
    });

    it('should respect limit and offset', async () => {
      query.mockResolvedValueOnce({ rows: [], rowCount: 0 });

      await Comment.findTopLevelByVideo(mockComment.video_id, {
        limit: 10,
        offset: 20
      });

      expect(query).toHaveBeenCalledWith(
        expect.any(String),
        [mockComment.video_id, 10, 20]
      );
    });

    it('should support custom ordering', async () => {
      query.mockResolvedValueOnce({ rows: [], rowCount: 0 });

      await Comment.findTopLevelByVideo(mockComment.video_id, {
        orderBy: 'likes_count DESC'
      });

      expect(query).toHaveBeenCalledWith(
        expect.stringContaining('ORDER BY likes_count DESC'),
        expect.any(Array)
      );
    });
  });

  describe('findReplies', () => {
    it('should find replies for a comment', async () => {
      query.mockResolvedValueOnce({
        rows: [mockReply, mockNestedReply],
        rowCount: 2
      });

      const results = await Comment.findReplies(mockComment.id);

      expect(query).toHaveBeenCalledWith(
        expect.stringContaining('WHERE parent_id = $1'),
        [mockComment.id, 50, 0]
      );
      expect(results).toHaveLength(2);
      expect(results[0].parentId).toBe(mockComment.id);
    });

    it('should return empty array when no replies', async () => {
      query.mockResolvedValueOnce({ rows: [], rowCount: 0 });

      const results = await Comment.findReplies(mockComment.id);

      expect(results).toEqual([]);
    });

    it('should respect limit and offset', async () => {
      query.mockResolvedValueOnce({ rows: [], rowCount: 0 });

      await Comment.findReplies(mockComment.id, { limit: 5, offset: 10 });

      expect(query).toHaveBeenCalledWith(
        expect.any(String),
        [mockComment.id, 5, 10]
      );
    });
  });

  describe('findByVideo', () => {
    it('should find all comments for video', async () => {
      query.mockResolvedValueOnce({
        rows: [mockComment, mockReply],
        rowCount: 2
      });

      const results = await Comment.findByVideo(mockComment.video_id);

      expect(query).toHaveBeenCalledWith(
        expect.stringContaining('WHERE video_id = $1'),
        [mockComment.video_id, 100, 0]
      );
      expect(results).toHaveLength(2);
    });

    it('should respect pagination', async () => {
      query.mockResolvedValueOnce({ rows: [], rowCount: 0 });

      await Comment.findByVideo(mockComment.video_id, {
        limit: 10,
        offset: 5
      });

      expect(query).toHaveBeenCalledWith(
        expect.any(String),
        [mockComment.video_id, 10, 5]
      );
    });
  });

  describe('getTreeByVideo', () => {
    it('should build comment tree', async () => {
      query
        .mockResolvedValueOnce({ rows: [mockComment], rowCount: 1 })
        .mockResolvedValueOnce({ rows: [mockReply], rowCount: 1 })
        .mockResolvedValueOnce({ rows: [mockNestedReply], rowCount: 1 })
        .mockResolvedValueOnce({ rows: [], rowCount: 0 });

      const tree = await Comment.getTreeByVideo(mockComment.video_id, {
        topLevelLimit: 1,
        repliesLimit: 50
      });

      expect(tree).toHaveLength(1);
      expect(tree[0].id).toBe(mockComment.id);
      expect(tree[0].replies).toBeDefined();
    });

    it('should handle empty comments', async () => {
      query.mockResolvedValueOnce({ rows: [], rowCount: 0 });

      const tree = await Comment.getTreeByVideo(mockComment.video_id);

      expect(tree).toEqual([]);
    });

    it('should truncate at maxDepth', async () => {
      query
        .mockResolvedValueOnce({ rows: [mockComment], rowCount: 1 })
        .mockResolvedValueOnce({ rows: [mockReply], rowCount: 1 })
        .mockResolvedValueOnce({ rows: [mockNestedReply], rowCount: 1 });

      const tree = await Comment.getTreeByVideo(mockComment.video_id, {
        maxDepth: 2,
        topLevelLimit: 1
      });

      expect(tree[0].replies[0]._truncated).toBe(true);
    });

    it('should handle comments without replies', async () => {
      query
        .mockResolvedValueOnce({ rows: [mockComment], rowCount: 1 })
        .mockResolvedValueOnce({ rows: [], rowCount: 0 });

      const tree = await Comment.getTreeByVideo(mockComment.video_id, {
        topLevelLimit: 1
      });

      expect(tree[0].replies).toEqual([]);
    });
  });

  describe('buildCommentTree', () => {
    it('should build nested tree structure', async () => {
      query
        .mockResolvedValueOnce({ rows: [mockReply], rowCount: 1 })
        .mockResolvedValueOnce({ rows: [mockNestedReply], rowCount: 1 })
        .mockResolvedValueOnce({ rows: [], rowCount: 0 });

      const serialized = Comment.serialize(mockComment);
      const tree = await Comment.buildCommentTree(serialized, 0, 5, 50);

      expect(tree.replies).toBeDefined();
      expect(tree.replies).toHaveLength(1);
    });

    it('should truncate when max depth reached', async () => {
      const serialized = Comment.serialize(mockComment);
      const tree = await Comment.buildCommentTree(serialized, 5, 5, 50);

      expect(tree._truncated).toBe(true);
      expect(tree.replies).toEqual([]);
    });
  });

  describe('getThread', () => {
    it('should get full comment thread', async () => {
      query
        .mockResolvedValueOnce({ rows: [mockComment], rowCount: 1 })
        .mockResolvedValueOnce({ rows: [mockReply], rowCount: 1 })
        .mockResolvedValueOnce({ rows: [], rowCount: 0 });

      const thread = await Comment.getThread(mockComment.id);

      expect(thread.id).toBe(mockComment.id);
      expect(thread.replies).toBeDefined();
    });

    it('should return null for non-existent comment', async () => {
      query.mockResolvedValueOnce({ rows: [], rowCount: 0 });

      const thread = await Comment.getThread('non-existent');

      expect(thread).toBeNull();
    });
  });

  describe('delete', () => {
    it('should delete comment', async () => {
      query
        .mockResolvedValueOnce({ rows: [mockComment], rowCount: 1 })
        .mockResolvedValueOnce({ rows: [{ id: mockComment.id }], rowCount: 1 });

      const result = await Comment.delete(mockComment.id);

      expect(result).toBe(true);
    });

    it('should return false for non-existent comment', async () => {
      query.mockResolvedValueOnce({ rows: [], rowCount: 0 });

      const result = await Comment.delete('non-existent');

      expect(result).toBe(false);
    });

    it('should cascade delete replies', async () => {
      query
        .mockResolvedValueOnce({ rows: [mockComment], rowCount: 1 })
        .mockResolvedValueOnce({ rows: [
          { id: mockComment.id },
          { id: mockReply.id }
        ], rowCount: 2 });

      const result = await Comment.delete(mockComment.id);

      expect(result).toBe(true);
    });
  });

  describe('update', () => {
    it('should update comment content', async () => {
      const updated = { ...mockComment, content: 'Updated content' };
      query.mockResolvedValueOnce({ rows: [updated], rowCount: 1 });

      const result = await Comment.update(mockComment.id, 'Updated content');

      expect(result.content).toBe('Updated content');
    });

    it('should return null for non-existent comment', async () => {
      query.mockResolvedValueOnce({ rows: [], rowCount: 0 });

      const result = await Comment.update('non-existent', 'Content');

      expect(result).toBeNull();
    });
  });

  describe('incrementLikes', () => {
    it('should increment likes count', async () => {
      query.mockResolvedValueOnce({ rows: [{ likes_count: 11 }], rowCount: 1 });

      const result = await Comment.incrementLikes(mockComment.id);

      expect(result).toBe(11);
    });
  });

  describe('decrementLikes', () => {
    it('should decrement likes count', async () => {
      query.mockResolvedValueOnce({ rows: [{ likes_count: 9 }], rowCount: 1 });

      const result = await Comment.decrementLikes(mockComment.id);

      expect(result).toBe(9);
    });

    it('should not go below zero', async () => {
      query.mockResolvedValueOnce({ rows: [{ likes_count: 0 }], rowCount: 1 });

      const result = await Comment.decrementLikes(mockComment.id);

      expect(result).toBe(0);
    });
  });

  describe('incrementRepliesCount', () => {
    it('should increment replies count', async () => {
      query.mockResolvedValueOnce({ rows: [{ replies_count: 6 }], rowCount: 1 });

      const result = await Comment.incrementRepliesCount(mockComment.id);

      expect(result).toBe(6);
    });
  });

  describe('decrementRepliesCount', () => {
    it('should decrement replies count', async () => {
      query.mockResolvedValueOnce({ rows: [{ replies_count: 4 }], rowCount: 1 });

      const result = await Comment.decrementRepliesCount(mockComment.id);

      expect(result).toBe(4);
    });

    it('should not go below zero', async () => {
      query.mockResolvedValueOnce({ rows: [{ replies_count: 0 }], rowCount: 1 });

      const result = await Comment.decrementRepliesCount(mockComment.id);

      expect(result).toBe(0);
    });
  });

  describe('countByVideo', () => {
    it('should count comments', async () => {
      query.mockResolvedValueOnce({ rows: [{ count: '150' }], rowCount: 1 });

      const result = await Comment.countByVideo(mockComment.video_id);

      expect(result).toBe(150);
    });
  });

  describe('countTopLevelByVideo', () => {
    it('should count top-level comments', async () => {
      query.mockResolvedValueOnce({ rows: [{ count: '50' }], rowCount: 1 });

      const result = await Comment.countTopLevelByVideo(mockComment.video_id);

      expect(result).toBe(50);
    });
  });

  describe('countReplies', () => {
    it('should count replies', async () => {
      query.mockResolvedValueOnce({ rows: [{ count: '10' }], rowCount: 1 });

      const result = await Comment.countReplies(mockComment.id);

      expect(result).toBe(10);
    });
  });

  describe('getVideoStats', () => {
    it('should return comprehensive stats', async () => {
      query.mockResolvedValueOnce({
        rows: [{
          total_comments: '150',
          unique_users: '45',
          total_likes: '500',
          top_level_count: '50',
          replies_count: '100',
          last_comment_at: '2024-01-15T12:00:00.000Z'
        }],
        rowCount: 1
      });

      const stats = await Comment.getVideoStats(mockComment.video_id);

      expect(stats).toMatchObject({
        videoId: mockComment.video_id,
        totalComments: 150,
        uniqueUsers: 45,
        totalLikes: 500,
        topLevelCount: 50,
        repliesCount: 100
      });
    });

    it('should handle zero stats', async () => {
      query.mockResolvedValueOnce({
        rows: [{
          total_comments: '0',
          unique_users: '0',
          total_likes: null,
          top_level_count: '0',
          replies_count: '0',
          last_comment_at: null
        }],
        rowCount: 1
      });

      const stats = await Comment.getVideoStats(mockComment.video_id);

      expect(stats.totalComments).toBe(0);
      expect(stats.totalLikes).toBe(0);
    });
  });

  describe('findRecent', () => {
    it('should return recent comments', async () => {
      query.mockResolvedValueOnce({ rows: [mockComment, mockReply], rowCount: 2 });

      const results = await Comment.findRecent(10);

      expect(query).toHaveBeenCalledWith(
        expect.stringContaining('ORDER BY created_at DESC'),
        [10]
      );
      expect(results).toHaveLength(2);
    });
  });

  describe('findByUser', () => {
    it('should find user comments', async () => {
      query.mockResolvedValueOnce({ rows: [mockComment], rowCount: 1 });

      const results = await Comment.findByUser(mockComment.user_id);

      expect(query).toHaveBeenCalledWith(
        expect.stringContaining('WHERE user_id = $1'),
        [mockComment.user_id, 50, 0]
      );
      expect(results).toHaveLength(1);
    });

    it('should respect limit and offset', async () => {
      query.mockResolvedValueOnce({ rows: [], rowCount: 0 });

      await Comment.findByUser(mockComment.user_id, { limit: 10, offset: 20 });

      expect(query).toHaveBeenCalledWith(
        expect.any(String),
        [mockComment.user_id, 10, 20]
      );
    });
  });

  describe('findPopularByVideo', () => {
    it('should return popular comments', async () => {
      query.mockResolvedValueOnce({
        rows: [
          { ...mockComment, likes_count: 100 },
          { ...mockComment, id: 'another-id', likes_count: 50 }
        ],
        rowCount: 2
      });

      const results = await Comment.findPopularByVideo(mockComment.video_id, 5);

      expect(query).toHaveBeenCalledWith(
        expect.stringContaining('ORDER BY likes_count DESC'),
        [mockComment.video_id, 5]
      );
      expect(results[0].likesCount).toBeGreaterThanOrEqual(results[1].likesCount);
    });
  });

  describe('deleteByVideo', () => {
    it('should delete all comments for video', async () => {
      query.mockResolvedValueOnce({
        rows: [{ id: '1' }, { id: '2' }],
        rowCount: 2
      });

      const result = await Comment.deleteByVideo(mockComment.video_id);

      expect(result).toBe(2);
    });

    it('should return 0 when no comments', async () => {
      query.mockResolvedValueOnce({ rows: [], rowCount: 0 });

      const result = await Comment.deleteByVideo(mockComment.video_id);

      expect(result).toBe(0);
    });
  });

  describe('edge cases', () => {
    it('should handle very long content at boundary', async () => {
      const longContent = 'a'.repeat(2000);
      const row = { ...mockComment, content: longContent };
      query.mockResolvedValueOnce({ rows: [row], rowCount: 1 });

      const result = await Comment.create({
        videoId: mockComment.video_id,
        userId: mockComment.user_id,
        content: longContent
      });

      expect(result.content).toBe(longContent);
    });

    it('should handle special characters in content', async () => {
      const specialContent = 'Hello! @#$%^&*() <> [] {} | "quotes" \'apostrophe\' 中文 🎉 <script>';
      const row = { ...mockComment, content: specialContent };
      query.mockResolvedValueOnce({ rows: [row], rowCount: 1 });

      const result = await Comment.create({
        videoId: mockComment.video_id,
        userId: mockComment.user_id,
        content: specialContent
      });

      expect(result.content).toBe(specialContent);
    });

    it('should handle concurrent requests', async () => {
      query
        .mockResolvedValueOnce({ rows: [mockComment], rowCount: 1 })
        .mockResolvedValueOnce({ rows: [{ count: '10' }], rowCount: 1 });

      const [comment, count] = await Promise.all([
        Comment.findById(mockComment.id),
        Comment.countByVideo(mockComment.video_id)
      ]);

      expect(comment).toBeDefined();
      expect(count).toBe(10);
      expect(query).toHaveBeenCalledTimes(2);
    });

    it('should handle deep reply chains', async () => {
      const deepReply = { ...mockNestedReply, parent_id: mockNestedReply.id };
      query
        .mockResolvedValueOnce({ rows: [mockComment], rowCount: 1 })
        .mockResolvedValueOnce({ rows: [mockReply], rowCount: 1 })
        .mockResolvedValueOnce({ rows: [mockNestedReply], rowCount: 1 })
        .mockResolvedValueOnce({ rows: [deepReply], rowCount: 1 })
        .mockResolvedValueOnce({ rows: [], rowCount: 0 });

      const tree = await Comment.getTreeByVideo(mockComment.video_id, {
        maxDepth: 5,
        topLevelLimit: 1
      });

      expect(tree).toHaveLength(1);
      expect(tree[0].replies).toBeDefined();
    });

    it('should handle whitespace-only content', async () => {
      const wsContent = '   ';
      const row = { ...mockComment, content: wsContent };
      query.mockResolvedValueOnce({ rows: [row], rowCount: 1 });

      const result = await Comment.create({
        videoId: mockComment.video_id,
        userId: mockComment.user_id,
        content: wsContent
      });

      expect(result.content).toBe(wsContent);
    });

    it('should handle null parent_id explicitly', async () => {
      query.mockResolvedValueOnce({ rows: [mockComment], rowCount: 1 });

      const result = await Comment.create({
        videoId: mockComment.video_id,
        userId: mockComment.user_id,
        content: 'Test',
        parentId: null
      });

      expect(result.parentId).toBeNull();
    });
  });
});
