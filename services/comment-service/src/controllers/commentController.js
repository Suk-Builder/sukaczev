const commentService = require('../services/commentService');
const { asyncHandler, CommentError } = require('../middleware/errorHandler');
const logger = require('../utils/logger');

class CommentController {
  /**
   * GET /api/comments
   * Get comments for a video (tree structure by default)
   */
  getComments = asyncHandler(async (req, res) => {
    const { videoId, page, flat, sortBy } = req.validatedQuery;

    const options = {
      page: page || 1,
      pageSize: parseInt(process.env.COMMENT_PAGE_SIZE, 10) || 20,
      sortBy: sortBy || 'created_at DESC'
    };

    let result;
    if (flat === 'true') {
      result = await commentService.getCommentsFlat(videoId, options);
    } else {
      result = await commentService.getCommentsTree(videoId, options);
    }

    res.status(200).json({
      success: true,
      data: { comments: result.comments, total: result.meta.total || result.meta.totalTopLevel || result.meta.count || result.comments.length },
      meta: result.meta
    });
  });

  /**
   * POST /api/comments
   * Create a new comment
   */
  createComment = asyncHandler(async (req, res) => {
    const commentData = req.validatedBody;

    const comment = await commentService.createComment(commentData);

    res.status(201).json({
      success: true,
      data: comment,
      message: comment.parentId
        ? 'Reply created successfully'
        : 'Comment created successfully'
    });
  });

  /**
   * DELETE /api/comments/:id
   * Delete a comment
   */
  deleteComment = asyncHandler(async (req, res) => {
    const { id } = req.params;
    const userId = req.body.userId || req.headers['x-user-id'];

    if (!userId) {
      throw new CommentError('User ID is required', 400, 'USER_REQUIRED');
    }

    const result = await commentService.deleteComment(id, userId);

    res.status(200).json({
      success: true,
      data: result,
      message: 'Comment deleted successfully'
    });
  });

  /**
   * POST /api/comments/:id/like
   * Like/unlike a comment
   */
  toggleLike = asyncHandler(async (req, res) => {
    const { id } = req.params;
    const userId = req.body.userId || req.headers['x-user-id'];

    if (!userId) {
      throw new CommentError('User ID is required', 400, 'USER_REQUIRED');
    }

    const result = await commentService.toggleLike(id, userId);

    res.status(200).json({
      success: true,
      data: result,
      message: result.liked ? 'Comment liked' : 'Comment unliked'
    });
  });

  /**
   * GET /api/comments/:id/replies
   * Get replies for a comment
   */
  getReplies = asyncHandler(async (req, res) => {
    const { id } = req.params;
    const page = parseInt(req.query.page, 10) || 1;
    const pageSize = Math.min(
      parseInt(req.query.pageSize, 10) || 50,
      100
    );

    const result = await commentService.getReplies(id, { page, pageSize });

    res.status(200).json({
      success: true,
      data: { replies: result.replies, total: result.meta.total || result.meta.totalTopLevel || result.meta.count || result.comments.length },
      meta: result.meta
    });
  });

  /**
   * GET /api/comments/:id/thread
   * Get full comment thread
   */
  getThread = asyncHandler(async (req, res) => {
    const { id } = req.params;
    const maxDepth = Math.min(parseInt(req.query.maxDepth, 10) || 5, 10);

    const result = await commentService.getCommentThread(id, maxDepth);

    res.status(200).json({
      success: true,
      data: result.comment,
      cached: result.cached || false
    });
  });

  /**
   * GET /api/comments/:id
   * Get single comment
   */
  getComment = asyncHandler(async (req, res) => {
    const { id } = req.params;

    const result = await commentService.getCommentThread(id, 0);

    res.status(200).json({
      success: true,
      data: result.comment
    });
  });

  /**
   * GET /api/comments/video/:videoId/hot
   * Get hot comments for a video
   */
  getHotComments = asyncHandler(async (req, res) => {
    const { videoId } = req.params;
    const limit = Math.min(parseInt(req.query.limit, 10) || 10, 50);

    const result = await commentService.getHotComments(videoId, limit);

    res.status(200).json({
      success: true,
      data: { comments: result.comments, total: result.meta.total || result.meta.totalTopLevel || result.meta.count || result.comments.length },
      cached: result.cached || false
    });
  });

  /**
   * GET /api/comments/video/:videoId/stats
   * Get video comment statistics
   */
  getVideoStats = asyncHandler(async (req, res) => {
    const { videoId } = req.params;

    const stats = await commentService.getVideoStats(videoId);

    res.status(200).json({
      success: true,
      data: stats
    });
  });

  /**
   * GET /api/comments/user/:userId
   * Get user's comments
   */
  getUserComments = asyncHandler(async (req, res) => {
    const { userId } = req.params;
    const limit = Math.min(parseInt(req.query.limit, 10) || 50, 200);
    const offset = parseInt(req.query.offset, 10) || 0;

    const comments = await commentService.getUserComments(userId, { limit, offset });

    res.status(200).json({
      success: true,
      data: { comments: comments, total: comments.length },
      meta: { count: comments.length, limit, offset }
    });
  });

  /**
   * GET /api/comments/user/:userId/liked
   * Get comments liked by user
   */
  getUserLikedComments = asyncHandler(async (req, res) => {
    const { userId } = req.params;
    const limit = Math.min(parseInt(req.query.limit, 10) || 100, 200);
    const offset = parseInt(req.query.offset, 10) || 0;

    const comments = await commentService.getUserLikedComments(userId, { limit, offset });

    res.status(200).json({
      success: true,
      data: { comments: comments, total: comments.length },
      meta: { count: comments.length, limit, offset }
    });
  });

  /**
   * GET /api/comments/:id/like/check
   * Check if user has liked a comment
   */
  checkLike = asyncHandler(async (req, res) => {
    const { id } = req.params;
    const userId = req.query.userId;

    if (!userId) {
      throw new CommentError('User ID is required', 400, 'USER_REQUIRED');
    }

    const hasLiked = await commentService.hasLiked(id, userId);

    res.status(200).json({
      success: true,
      data: { commentId: id, userId, hasLiked }
    });
  });

  /**
   * DELETE /api/comments/video/:videoId
   * Delete all comments for a video (admin)
   */
  deleteAllForVideo = asyncHandler(async (req, res) => {
    const { videoId } = req.params;

    // TODO: Add admin authentication check
    const count = await commentService.deleteAllForVideo(videoId);

    res.status(200).json({
      success: true,
      message: `Deleted ${count} comments for video ${videoId}`,
      data: { deletedCount: count, videoId }
    });
  });

  /**
   * GET /api/comments/recent
   * Get recent comments (admin/monitoring)
   */
  getRecent = asyncHandler(async (req, res) => {
    const limit = Math.min(parseInt(req.query.limit, 10) || 50, 200);

    const comments = await commentService.getRecentComments(limit);

    res.status(200).json({
      success: true,
      data: { comments: comments, total: comments.length },
      meta: { count: comments.length, limit }
    });
  });
}

module.exports = new CommentController();
