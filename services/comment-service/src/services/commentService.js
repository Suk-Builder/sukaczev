const Comment = require('../models/comment');
const CommentLike = require('../models/commentLike');
const {
  cacheComments,
  getCachedComments,
  cacheCommentTree,
  getCachedCommentTree,
  invalidateCommentCache,
  cacheHotComments,
  getCachedHotComments
} = require('../config/redis');
const publisher = require('../events/publisher');
const logger = require('../utils/logger');
const { CommentError } = require('../middleware/errorHandler');

class CommentService {
  /**
   * Create a new comment
   * @param {Object} data - Comment data
   * @returns {Promise<Object>} Created comment
   */
  async createComment(data) {
    const { videoId, userId, content, parentId } = data;

    if (!content || content.trim().length === 0) {
      throw new CommentError('Comment content cannot be empty', 400, 'VALIDATION_ERROR');
    }

    const maxLength = parseInt(process.env.COMMENT_MAX_LENGTH, 10) || 2000;
    if (content.length > maxLength) {
      throw new CommentError(
        `Content exceeds maximum length of ${maxLength} characters`,
        400,
        'VALIDATION_ERROR'
      );
    }

    // Validate parent exists if provided
    if (parentId) {
      const parent = await Comment.findById(parentId);
      if (!parent) {
        throw new CommentError('Parent comment not found', 404, 'PARENT_NOT_FOUND');
      }

      // Ensure parent belongs to same video
      if (parent.videoId !== videoId) {
        throw new CommentError(
          'Parent comment belongs to a different video',
          400,
          'VIDEO_MISMATCH'
        );
      }

      // Prevent deep nesting (max 5 levels)
      const parentDepth = await this.calculateCommentDepth(parentId);
      if (parentDepth >= 5) {
        throw new CommentError(
          'Maximum reply depth reached',
          400,
          'MAX_DEPTH_EXCEEDED'
        );
      }
    }

    try {
      const comment = await Comment.create({
        videoId,
        userId,
        content: content.trim(),
        parentId
      });

      // Invalidate cache
      await invalidateCommentCache(videoId);

      // Publish events
      await publisher.commentCreated(comment);

      if (parentId) {
        await publisher.commentReply({
          commentId: comment.id,
          parentId,
          userId,
          videoId
        });
      }

      logger.info(`Comment created: ${comment.id} for video ${videoId}`);

      return comment;
    } catch (error) {
      if (error instanceof CommentError) throw error;
      logger.error('Failed to create comment:', error);
      throw new CommentError('Failed to create comment', 500, 'CREATE_ERROR');
    }
  }

  /**
   * Get comments for a video in tree structure
   * @param {string} videoId - Video UUID
   * @param {Object} options - Query options
   * @returns {Promise<Object>} Comments tree and metadata
   */
  async getCommentsTree(videoId, options = {}) {
    const {
      page = 1,
      pageSize = 20,
      maxDepth = 5
    } = options;

    try {
      // Try cache
      const cached = await getCachedComments(videoId, page);
      if (cached) {
        return {
          comments: cached,
          meta: {
            videoId,
            page,
            pageSize,
            cached: true
          }
        };
      }

      const offset = (page - 1) * pageSize;
      const comments = await Comment.getTreeByVideo(videoId, {
        maxDepth,
        topLevelLimit: pageSize,
        repliesLimit: 50,
        offset
      });

      const totalTopLevel = await Comment.countTopLevelByVideo(videoId);
      const totalPages = Math.ceil(totalTopLevel / pageSize);

      const result = {
        comments,
        meta: {
          videoId,
          page,
          pageSize,
          totalTopLevel,
          totalPages,
          count: comments.length
        }
      };

      // Cache result
      await cacheComments(videoId, comments, page);

      return result;
    } catch (error) {
      if (error instanceof CommentError) throw error;
      logger.error('Failed to get comments tree:', error);
      throw new CommentError('Failed to retrieve comments', 500, 'RETRIEVE_ERROR');
    }
  }

  /**
   * Get flat comments list for a video
   * @param {string} videoId - Video UUID
   * @param {Object} options - Query options
   * @returns {Promise<Object>} Comments and metadata
   */
  async getCommentsFlat(videoId, options = {}) {
    const {
      page = 1,
      pageSize = 20,
      sortBy = 'created_at DESC'
    } = options;

    try {
      const offset = (page - 1) * pageSize;
      const comments = await Comment.findByVideo(videoId, {
        limit: pageSize,
        offset,
        orderBy: sortBy
      });

      const total = await Comment.countByVideo(videoId);
      const totalPages = Math.ceil(total / pageSize);

      return {
        comments,
        meta: {
          videoId,
          page,
          pageSize,
          total,
          totalPages,
          count: comments.length
        }
      };
    } catch (error) {
      logger.error('Failed to get flat comments:', error);
      throw new CommentError('Failed to retrieve comments', 500, 'RETRIEVE_ERROR');
    }
  }

  /**
   * Get single comment with thread
   * @param {string} commentId - Comment UUID
   * @param {number} maxDepth - Maximum depth
   * @returns {Promise<Object>} Comment thread
   */
  async getCommentThread(commentId, maxDepth = 5) {
    try {
      // Try cache
      const cached = await getCachedCommentTree(commentId);
      if (cached) {
        return { comment: cached, cached: true };
      }

      const thread = await Comment.getThread(commentId, maxDepth);

      if (!thread) {
        throw new CommentError('Comment not found', 404, 'NOT_FOUND');
      }

      // Cache thread
      await cacheCommentTree(commentId, thread);

      return { comment: thread, cached: false };
    } catch (error) {
      if (error instanceof CommentError) throw error;
      logger.error('Failed to get comment thread:', error);
      throw new CommentError('Failed to retrieve comment', 500, 'RETRIEVE_ERROR');
    }
  }

  /**
   * Delete a comment
   * @param {string} commentId - Comment UUID
   * @param {string} userId - User UUID (for authorization)
   * @returns {Promise<Object>} Deletion result
   */
  async deleteComment(commentId, userId) {
    try {
      const comment = await Comment.findById(commentId);

      if (!comment) {
        throw new CommentError('Comment not found', 404, 'NOT_FOUND');
      }

      // TODO: Add proper authorization check
      // For now, allow deletion by comment author
      if (comment.userId !== userId) {
        throw new CommentError(
          'Not authorized to delete this comment',
          403,
          'UNAUTHORIZED'
        );
      }

      await Comment.delete(commentId);

      // Invalidate cache
      await invalidateCommentCache(comment.videoId);
      await cacheCommentTree(commentId, null);

      // Publish event
      await publisher.commentDeleted({
        commentId,
        videoId: comment.videoId,
        userId
      });

      logger.info(`Comment deleted: ${commentId}`);

      return {
        success: true,
        deletedId: commentId,
        videoId: comment.videoId
      };
    } catch (error) {
      if (error instanceof CommentError) throw error;
      logger.error('Failed to delete comment:', error);
      throw new CommentError('Failed to delete comment', 500, 'DELETE_ERROR');
    }
  }

  /**
   * Like/unlike a comment
   * @param {string} commentId - Comment UUID
   * @param {string} userId - User UUID
   * @returns {Promise<Object>} Like result
   */
  async toggleLike(commentId, userId) {
    try {
      const comment = await Comment.findById(commentId);

      if (!comment) {
        throw new CommentError('Comment not found', 404, 'NOT_FOUND');
      }

      const result = await CommentLike.toggle(commentId, userId);

      // Update likes count
      if (result.liked) {
        await Comment.incrementLikes(commentId);
      } else {
        await Comment.decrementLikes(commentId);
      }

      // Invalidate caches
      await invalidateCommentCache(comment.videoId);
      await cacheCommentTree(commentId, null);

      // Publish event if liked
      if (result.liked) {
        await publisher.commentLiked({
          commentId,
          userId,
          videoId: comment.videoId
        });
      }

      // Get updated comment
      const updated = await Comment.findById(commentId);

      logger.info(`Comment ${commentId} ${result.action} by ${userId}`);

      return {
        ...result,
        commentId,
        likesCount: updated.likesCount
      };
    } catch (error) {
      if (error instanceof CommentError) throw error;
      logger.error('Failed to toggle like:', error);
      throw new CommentError('Failed to process like', 500, 'LIKE_ERROR');
    }
  }

  /**
   * Get replies for a comment
   * @param {string} commentId - Parent comment UUID
   * @param {Object} options - Query options
   * @returns {Promise<Object>} Replies and metadata
   */
  async getReplies(commentId, options = {}) {
    const { page = 1, pageSize = 50 } = options;

    try {
      const comment = await Comment.findById(commentId);
      if (!comment) {
        throw new CommentError('Comment not found', 404, 'NOT_FOUND');
      }

      const offset = (page - 1) * pageSize;
      const replies = await Comment.findReplies(commentId, {
        limit: pageSize,
        offset,
        orderBy: 'created_at ASC'
      });

      const total = await Comment.countReplies(commentId);
      const totalPages = Math.ceil(total / pageSize);

      return {
        replies,
        meta: {
          parentId: commentId,
          videoId: comment.videoId,
          page,
          pageSize,
          total,
          totalPages,
          count: replies.length
        }
      };
    } catch (error) {
      if (error instanceof CommentError) throw error;
      logger.error('Failed to get replies:', error);
      throw new CommentError('Failed to retrieve replies', 500, 'RETRIEVE_ERROR');
    }
  }

  /**
   * Get hot/popular comments for a video
   * @param {string} videoId - Video UUID
   * @param {number} limit - Number to retrieve
   * @returns {Promise<Array>} Hot comments
   */
  async getHotComments(videoId, limit = 10) {
    try {
      // Try cache
      const cached = await getCachedHotComments(videoId);
      if (cached) {
        return { comments: cached, cached: true };
      }

      const comments = await Comment.findPopularByVideo(videoId, limit);

      // Cache result
      await cacheHotComments(videoId, comments);

      return { comments, cached: false };
    } catch (error) {
      logger.error('Failed to get hot comments:', error);
      throw new CommentError('Failed to retrieve hot comments', 500, 'RETRIEVE_ERROR');
    }
  }

  /**
   * Get video statistics
   * @param {string} videoId - Video UUID
   * @returns {Promise<Object>} Statistics
   */
  async getVideoStats(videoId) {
    try {
      return await Comment.getVideoStats(videoId);
    } catch (error) {
      logger.error('Failed to get video stats:', error);
      throw new CommentError('Failed to retrieve statistics', 500, 'STATS_ERROR');
    }
  }

  /**
   * Get user's comment history
   * @param {string} userId - User UUID
   * @param {Object} options - Query options
   * @returns {Promise<Array>} User's comments
   */
  async getUserComments(userId, options = {}) {
    try {
      return await Comment.findByUser(userId, options);
    } catch (error) {
      logger.error('Failed to get user comments:', error);
      throw new CommentError('Failed to retrieve user comments', 500, 'RETRIEVE_ERROR');
    }
  }

  /**
   * Get user's liked comments
   * @param {string} userId - User UUID
   * @param {Object} options - Query options
   * @returns {Promise<Array>} Liked comments
   */
  async getUserLikedComments(userId, options = {}) {
    try {
      return await CommentLike.findByUser(userId, options);
    } catch (error) {
      logger.error('Failed to get liked comments:', error);
      throw new CommentError('Failed to retrieve liked comments', 500, 'RETRIEVE_ERROR');
    }
  }

  /**
   * Check if user has liked a comment
   * @param {string} commentId - Comment UUID
   * @param {string} userId - User UUID
   * @returns {Promise<boolean>}
   */
  async hasLiked(commentId, userId) {
    try {
      return await CommentLike.hasLiked(commentId, userId);
    } catch (error) {
      logger.error('Failed to check like status:', error);
      return false;
    }
  }

  /**
   * Calculate depth of a comment in the tree
   * @param {string} commentId - Comment UUID
   * @returns {Promise<number>} Depth (0 = top-level)
   */
  async calculateCommentDepth(commentId) {
    let depth = 0;
    let currentId = commentId;
    const maxIterations = 10; // Safety limit

    for (let i = 0; i < maxIterations; i++) {
      const sql = 'SELECT parent_id FROM comments WHERE id = $1';
      const { query } = require('../config/database');
      const result = await query(sql, [currentId]);

      if (result.rows.length === 0 || result.rows[0].parent_id === null) {
        break;
      }

      depth++;
      currentId = result.rows[0].parent_id;
    }

    return depth;
  }

  /**
   * Delete all comments for a video (admin)
   * @param {string} videoId - Video UUID
   * @returns {Promise<number>} Deleted count
   */
  async deleteAllForVideo(videoId) {
    try {
      const count = await Comment.deleteByVideo(videoId);
      await invalidateCommentCache(videoId);

      logger.info(`Deleted ${count} comments for video ${videoId}`);
      return count;
    } catch (error) {
      logger.error('Failed to delete all comments:', error);
      throw new CommentError('Failed to delete comments', 500, 'DELETE_ERROR');
    }
  }

  /**
   * Get recent comments across all videos
   * @param {number} limit - Number to retrieve
   * @returns {Promise<Array>} Recent comments
   */
  async getRecentComments(limit = 50) {
    try {
      return await Comment.findRecent(limit);
    } catch (error) {
      logger.error('Failed to get recent comments:', error);
      throw new CommentError('Failed to retrieve recent comments', 500, 'RETRIEVE_ERROR');
    }
  }
}

module.exports = new CommentService();
