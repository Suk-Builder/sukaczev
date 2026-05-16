const Comment = require('../../src/models/comment');
const commentService = require('../../src/services/commentService');

describe('Tree Structure', () => {
  // Helper to create a tree of comments
  const createMockComment = (id, parentId = null, depth = 0) => ({
    id: `comment-${id}`,
    videoId: 'video-1',
    userId: `user-${id}`,
    parentId,
    content: `Comment at depth ${depth}`,
    likesCount: Math.floor(Math.random() * 100),
    repliesCount: 0,
    createdAt: new Date(2024, 0, 15, 10, depth).toISOString(),
    updatedAt: new Date(2024, 0, 15, 10, depth).toISOString()
  });

  describe('Comment.buildCommentTree', () => {
    it('should build tree with replies', async () => {
      const parent = createMockComment('parent');
      const reply1 = createMockComment('reply1', 'comment-parent');
      const reply2 = createMockComment('reply2', 'comment-parent');

      const { query } = require('../../src/config/database');
      query.mockResolvedValueOnce({ rows: [reply1, reply2], rowCount: 2 });

      const tree = await Comment.buildCommentTree(parent, 0, 5, 50);

      expect(tree.replies).toHaveLength(2);
      expect(tree.replies[0].parentId).toBe(parent.id);
      expect(tree.replies[1].parentId).toBe(parent.id);
    });

    it('should build nested tree', async () => {
      const level0 = createMockComment('0');
      const level1 = createMockComment('1', 'comment-0');
      const level2 = createMockComment('2', 'comment-1');

      const { query } = require('../../src/config/database');
      query
        .mockResolvedValueOnce({ rows: [level1], rowCount: 1 })
        .mockResolvedValueOnce({ rows: [level2], rowCount: 1 })
        .mockResolvedValueOnce({ rows: [], rowCount: 0 });

      const tree = await Comment.buildCommentTree(level0, 0, 5, 50);

      expect(tree.replies).toHaveLength(1);
      expect(tree.replies[0].id).toBe(level1.id);
      expect(tree.replies[0].replies).toHaveLength(1);
      expect(tree.replies[0].replies[0].id).toBe(level2.id);
    });

    it('should truncate at max depth', async () => {
      const level0 = createMockComment('0');
      const level1 = createMockComment('1', 'comment-0');

      const { query } = require('../../src/config/database');
      query.mockResolvedValueOnce({ rows: [level1], rowCount: 1 });

      const tree = await Comment.buildCommentTree(level0, 4, 5, 50);

      expect(tree.replies).toHaveLength(1);
      expect(tree.replies[0]._truncated).toBe(true);
    });

    it('should handle comments with no replies', async () => {
      const comment = createMockComment('leaf');

      const { query } = require('../../src/config/database');
      query.mockResolvedValueOnce({ rows: [], rowCount: 0 });

      const tree = await Comment.buildCommentTree(comment, 0, 5, 50);

      expect(tree.replies).toEqual([]);
    });

    it('should handle deep nesting', async () => {
      const comments = [];
      for (let i = 0; i < 6; i++) {
        comments.push(createMockComment(i.toString(), i > 0 ? `comment-${i - 1}` : null, i));
      }

      const { query } = require('../../src/config/database');
      // Each level has one reply
      for (let i = 1; i < 6; i++) {
        query.mockResolvedValueOnce({ rows: [comments[i]], rowCount: 1 });
      }

      const tree = await Comment.buildCommentTree(comments[0], 0, 10, 50);

      // Walk down the tree
      let current = tree;
      let depth = 0;
      while (current.replies && current.replies.length > 0) {
        current = current.replies[0];
        depth++;
      }

      expect(depth).toBe(5);
    });

    it('should handle branching tree', async () => {
      const root = createMockComment('root');
      const children = [];
      for (let i = 0; i < 5; i++) {
        children.push(createMockComment(`child-${i}`, 'comment-root'));
      }

      const { query } = require('../../src/config/database');
      query.mockResolvedValueOnce({ rows: children, rowCount: 5 });

      const tree = await Comment.buildCommentTree(root, 0, 5, 50);

      expect(tree.replies).toHaveLength(5);
    });

    it('should handle mixed branching and depth', async () => {
      const root = createMockComment('root');
      const child1 = createMockComment('c1', 'comment-root');
      const child2 = createMockComment('c2', 'comment-root');
      const grandchild1 = createMockComment('gc1', 'comment-c1');
      const grandchild2 = createMockComment('gc2', 'comment-c1');
      const greatgrandchild = createMockComment('ggc1', 'comment-gc1');

      const { query } = require('../../src/config/database');
      query
        .mockResolvedValueOnce({ rows: [child1, child2], rowCount: 2 })
        .mockResolvedValueOnce({ rows: [grandchild1, grandchild2], rowCount: 2 })
        .mockResolvedValueOnce({ rows: [greatgrandchild], rowCount: 1 })
        .mockResolvedValueOnce({ rows: [], rowCount: 0 })
        .mockResolvedValueOnce({ rows: [], rowCount: 0 })
        .mockResolvedValueOnce({ rows: [], rowCount: 0 });

      const tree = await Comment.buildCommentTree(root, 0, 5, 50);

      expect(tree.replies).toHaveLength(2);
      expect(tree.replies[0].replies).toHaveLength(2);
      expect(tree.replies[0].replies[0].replies).toHaveLength(1);
    });
  });

  describe('Comment.getTreeByVideo', () => {
    it('should return empty array for no comments', async () => {
      Comment.findTopLevelByVideo = jest.fn().mockResolvedValue([]);

      const tree = await Comment.getTreeByVideo('video-1');

      expect(tree).toEqual([]);
    });

    it('should build tree for multiple top-level comments', async () => {
      const tlc1 = createMockComment('tlc1');
      const tlc2 = createMockComment('tlc2');
      const reply1 = createMockComment('r1', 'comment-tlc1');

      const { query } = require('../../src/config/database');
      query.mockResolvedValueOnce({ rows: [reply1], rowCount: 1 })
        .mockResolvedValueOnce({ rows: [], rowCount: 0 });

      Comment.findTopLevelByVideo = jest.fn().mockResolvedValue([tlc1, tlc2]);

      const tree = await Comment.getTreeByVideo('video-1', {
        topLevelLimit: 2
      });

      expect(tree).toHaveLength(2);
      expect(tree[0].replies).toHaveLength(1);
      expect(tree[1].replies).toEqual([]);
    });

    it('should pass options correctly', async () => {
      const comment = createMockComment('1');
      Comment.findTopLevelByVideo = jest.fn().mockResolvedValue([comment]);

      const { query } = require('../../src/config/database');
      query.mockResolvedValueOnce({ rows: [], rowCount: 0 });

      await Comment.getTreeByVideo('video-1', {
        maxDepth: 3,
        topLevelLimit: 5,
        repliesLimit: 10,
        offset: 20
      });

      expect(Comment.findTopLevelByVideo).toHaveBeenCalledWith(
        'video-1',
        expect.objectContaining({ limit: 5, offset: 20 })
      );
    });
  });

  describe('Comment.getThread', () => {
    it('should return null for non-existent comment', async () => {
      Comment.findById = jest.fn().mockResolvedValue(null);

      const thread = await Comment.getThread('non-existent');

      expect(thread).toBeNull();
    });

    it('should get full thread', async () => {
      const comment = createMockComment('root');
      const reply = createMockComment('reply', 'comment-root');

      Comment.findById = jest.fn().mockResolvedValue(comment);

      const { query } = require('../../src/config/database');
      query.mockResolvedValueOnce({ rows: [reply], rowCount: 1 })
        .mockResolvedValueOnce({ rows: [], rowCount: 0 });

      const thread = await Comment.getThread('comment-root');

      expect(thread.id).toBe(comment.id);
      expect(thread.replies).toHaveLength(1);
      expect(thread.replies[0].id).toBe(reply.id);
    });
  });

  describe('Tree serialization', () => {
    it('should preserve all fields in tree nodes', async () => {
      const comment = {
        ...createMockComment('test'),
        likesCount: 42,
        repliesCount: 5
      };

      const { query } = require('../../src/config/database');
      query.mockResolvedValueOnce({ rows: [], rowCount: 0 });

      const tree = await Comment.buildCommentTree(comment, 0, 5, 50);

      expect(tree.id).toBe(comment.id);
      expect(tree.content).toBe(comment.content);
      expect(tree.likesCount).toBe(42);
      expect(tree.repliesCount).toBe(5);
      expect(tree.createdAt).toBe(comment.createdAt);
    });

    it('should handle tree truncation flag', async () => {
      const comment = createMockComment('test');

      const { query } = require('../../src/config/database');
      query.mockResolvedValueOnce({ rows: [], rowCount: 0 });

      const tree = await Comment.buildCommentTree(comment, 4, 5, 50);

      expect(tree._truncated).toBe(true);
      expect(tree.replies).toEqual([]);
    });
  });

  describe('Complex tree scenarios', () => {
    it('should handle wide tree (many siblings)', async () => {
      const root = createMockComment('root');
      const siblings = Array.from({ length: 20 }, (_, i) =>
        createMockComment(`sibling-${i}`, 'comment-root')
      );

      const { query } = require('../../src/config/database');
      query.mockResolvedValueOnce({ rows: siblings, rowCount: 20 });

      const tree = await Comment.buildCommentTree(root, 0, 5, 50);

      expect(tree.replies).toHaveLength(20);
    });

    it('should handle diamond pattern', async () => {
      // A comments on B, C comments on A, D comments on B - diamond
      const a = createMockComment('a');
      const b = createMockComment('b', 'comment-a');
      const c = createMockComment('c', 'comment-a');
      const d = createMockComment('d', 'comment-b');

      const { query } = require('../../src/config/database');
      query
        .mockResolvedValueOnce({ rows: [b, c], rowCount: 2 })
        .mockResolvedValueOnce({ rows: [d], rowCount: 1 })
        .mockResolvedValueOnce({ rows: [], rowCount: 0 })
        .mockResolvedValueOnce({ rows: [], rowCount: 0 });

      const tree = await Comment.buildCommentTree(a, 0, 5, 50);

      expect(tree.replies).toHaveLength(2);
      const bNode = tree.replies.find(r => r.id === b.id);
      expect(bNode.replies).toHaveLength(1);
      expect(bNode.replies[0].id).toBe(d.id);
    });

    it('should handle circular references safely', async () => {
      // This shouldn't happen in DB due to FK constraints,
      // but we should handle it gracefully
      const a = createMockComment('a');
      const b = createMockComment('b', 'comment-a');

      const { query } = require('../../src/config/database');
      query.mockResolvedValueOnce({ rows: [b], rowCount: 1 });
      // If b somehow pointed back to a, the loop protection kicks in
      query.mockResolvedValueOnce({ rows: [a], rowCount: 1 });

      // With maxDepth=5, it will stop before infinite loop
      const tree = await Comment.buildCommentTree(a, 0, 5, 50);

      expect(tree.replies).toHaveLength(1);
    });

    it('should limit replies per comment', async () => {
      const root = createMockComment('root');
      const manyReplies = Array.from({ length: 100 }, (_, i) =>
        createMockComment(`reply-${i}`, 'comment-root')
      );

      const { query } = require('../../src/config/database');
      query.mockResolvedValueOnce({ rows: manyReplies.slice(0, 50), rowCount: 50 });

      const tree = await Comment.buildCommentTree(root, 0, 5, 50);

      expect(tree.replies.length).toBeLessThanOrEqual(50);
    });
  });

  describe('Service integration with tree', () => {
    it('should get complete tree with metadata', async () => {
      getCachedComments.mockResolvedValueOnce(null);

      const tlc = createMockComment('tlc');
      const reply = createMockComment('reply', 'comment-tlc');

      Comment.getTreeByVideo = jest.fn().mockResolvedValue([{
        ...tlc,
        replies: [reply]
      }]);
      Comment.countTopLevelByVideo = jest.fn().mockResolvedValue(1);

      const result = await commentService.getCommentsTree('video-1');

      expect(result.comments).toHaveLength(1);
      expect(result.comments[0].replies).toHaveLength(1);
      expect(result.meta.totalTopLevel).toBe(1);
    });

    it('should get thread with specified depth', async () => {
      getCachedCommentTree.mockResolvedValueOnce(null);

      const comment = createMockComment('root');
      Comment.getThread = jest.fn().mockResolvedValue({
        ...comment,
        replies: []
      });

      const result = await commentService.getCommentThread('comment-root', 3);

      expect(Comment.getThread).toHaveBeenCalledWith('comment-root', 3);
      expect(result.comment.id).toBe(comment.id);
    });
  });
});
