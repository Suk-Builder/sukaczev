const { Router } = require('express');
const commentController = require('../controllers/commentController');
const { validateBody, validateQuery } = require('../middleware/validation');
const rateLimit = require('express-rate-limit');

const router = Router();

// Rate limiters
const commentLimiter = rateLimit({
  windowMs: 60000,
  max: 30,
  message: { error: 'Too many comments, please slow down' }
});

const likeLimiter = rateLimit({
  windowMs: 10000,
  max: 20,
  message: { error: 'Too many like actions' }
});

// GET /api/comments - Get comments for video (tree structure)
router.get(
  '/',
  validateQuery('getComments'),
  commentController.getComments
);

// POST /api/comments - Create comment
router.post(
  '/',
  commentLimiter,
  validateBody('createComment'),
  commentController.createComment
);

// GET /api/comments/recent - Recent comments (admin)
router.get('/recent', commentController.getRecent);

// GET /api/comments/user/:userId - User's comments
router.get('/user/:userId', commentController.getUserComments);

// GET /api/comments/user/:userId/liked - User's liked comments
router.get('/user/:userId/liked', commentController.getUserLikedComments);

// GET /api/comments/video/:videoId/hot - Hot comments
router.get('/video/:videoId/hot', commentController.getHotComments);

// GET /api/comments/video/:videoId/stats - Video statistics
router.get('/video/:videoId/stats', commentController.getVideoStats);

// DELETE /api/comments/video/:videoId - Delete all for video (admin)
router.delete('/video/:videoId', commentController.deleteAllForVideo);

// GET /api/comments/:id - Get single comment
router.get('/:id', commentController.getComment);

// DELETE /api/comments/:id - Delete comment
router.delete('/:id', commentController.deleteComment);

// POST /api/comments/:id/like - Like/unlike
router.post('/:id/like', likeLimiter, commentController.toggleLike);

// GET /api/comments/:id/like/check - Check like status
router.get('/:id/like/check', commentController.checkLike);

// GET /api/comments/:id/replies - Get replies
router.get('/:id/replies', commentController.getReplies);

// GET /api/comments/:id/thread - Get full thread
router.get('/:id/thread', commentController.getThread);

module.exports = router;
