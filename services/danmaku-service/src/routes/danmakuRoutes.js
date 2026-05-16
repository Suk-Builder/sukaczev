const { Router } = require('express');
const danmakuController = require('../controllers/danmakuController');
const { validateQuery, validateBody, validateParams } = require('../middleware/validation');
const { sendDanmakuLimiter } = require('../middleware/rateLimiter');
const { authenticate, requireAuth } = require('../middleware/auth');

const router = Router();

// GET /api/danmakus - Get danmakus by time range
router.get(
  '/',
  validateQuery('getDanmakus'),
  danmakuController.getDanmakus
);

// POST /api/danmakus - Send a danmaku
router.post(
  '/',
  sendDanmakuLimiter,
  validateBody('sendDanmaku'),
  danmakuController.sendDanmaku
);

// GET /api/danmakus/recent - Get recent danmakus (admin)
router.get('/recent', danmakuController.getRecent);

// GET /api/danmakus/stats/global - Global stats
router.get('/stats/global', danmakuController.getGlobalStats);

// GET /api/danmakus/user/:userId - User history
router.get('/user/:userId', danmakuController.getUserHistory);

// GET /api/danmakus/:videoId/stats - Video statistics
router.get(
  '/:videoId/stats',
  validateParams('getStats'),
  danmakuController.getStats
);

// GET /api/danmakus/:videoId/density - Density distribution
router.get('/:videoId/density', danmakuController.getDensity);

// GET /api/danmakus/:videoId/speed - Flight speed calculation
router.get('/:videoId/speed', danmakuController.getSpeed);

// DELETE /api/danmakus/:videoId - Delete all danmakus for video (requires auth)
router.delete('/:videoId', authenticate, requireAuth, danmakuController.deleteByVideo);

module.exports = router;

