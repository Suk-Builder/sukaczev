const danmakuService = require('../services/danmakuService');
const { asyncHandler, DanmakuError } = require('../middleware/errorHandler');
const logger = require('../utils/logger');

class DanmakuController {
  /**
   * GET /api/danmakus
   * Get danmakus for a video in a time range
   */
  getDanmakus = asyncHandler(async (req, res) => {
    const { videoId, start, end, limit, offset } = req.validatedQuery;

    const result = await danmakuService.getDanmakusByTimeRange(
      videoId,
      start,
      end,
      { limit, offset }
    );

    res.status(200).json({
      success: true,
      data: { danmakus: result.danmakus, count: result.meta.total || result.danmakus.length }
    });
  });

  /**
   * POST /api/danmakus
   * Send a new danmaku
   */
  sendDanmaku = asyncHandler(async (req, res) => {
    const danmakuData = req.validatedBody;

    // Get io instance for broadcasting
    const io = req.app.get('io');

    const danmaku = await danmakuService.createDanmaku(danmakuData);

    // Broadcast to video room via WebSocket
    const roomName = `video:${danmakuData.videoId}`;
    if (io) {
      io.to(roomName).emit('danmaku:new', {
        id: danmaku.id,
        videoId: danmaku.videoId,
        userId: danmaku.userId,
        content: danmaku.content,
        timePoint: danmaku.timePoint,
        color: danmaku.color,
        type: danmaku.type,
        fontSize: danmaku.fontSize,
        createdAt: danmaku.createdAt,
        filtered: danmaku.filtered || false,
        matchedWords: danmaku.matchedWords || []
      });

      logger.debug(`Broadcasted danmaku ${danmaku.id} to room ${roomName}`);
    }

    res.status(201).json({
      success: true,
      data: danmaku,
      message: danmaku.filtered
        ? 'Danmaku created with sensitive words filtered'
        : 'Danmaku created successfully'
    });
  });

  /**
   * GET /api/danmakus/:videoId/stats
   * Get danmaku statistics for a video
   */
  getStats = asyncHandler(async (req, res) => {
    const { videoId } = req.validatedParams;

    const stats = await danmakuService.getVideoStats(videoId);

    res.status(200).json({
      success: true,
      data: stats
    });
  });

  /**
   * GET /api/danmakus/:videoId/density
   * Get danmaku density distribution for a video
   */
  getDensity = asyncHandler(async (req, res) => {
    const { videoId } = req.params;
    const duration = parseInt(req.query.duration, 10) || 600;

    const density = await danmakuService.getDensityInfo(videoId, duration);

    res.status(200).json({
      success: true,
      data: density
    });
  });

  /**
   * GET /api/danmakus/:videoId/speed
   * Calculate flight speed for a time point
   */
  getSpeed = asyncHandler(async (req, res) => {
    const { videoId } = req.params;
    const timePoint = parseFloat(req.query.timePoint) || 0;
    const videoDuration = parseFloat(req.query.videoDuration) || 300;

    const speed = await danmakuService.calculateFlightSpeed(
      videoId,
      timePoint,
      videoDuration
    );

    res.status(200).json({
      success: true,
      data: speed
    });
  });

  /**
   * DELETE /api/danmakus/:videoId
   * Delete all danmakus for a video (admin)
   */
  deleteByVideo = asyncHandler(async (req, res) => {
    const { videoId } = req.params;

    // TODO: Add admin authentication middleware
    const count = await danmakuService.deleteDanmakusByVideo(videoId);

    res.status(200).json({
      success: true,
      message: `Deleted ${count} danmakus for video ${videoId}`,
      data: { deletedCount: count, videoId }
    });
  });

  /**
   * GET /api/danmakus/recent
   * Get recent danmakus across all videos (admin/monitoring)
   */
  getRecent = asyncHandler(async (req, res) => {
    const limit = Math.min(parseInt(req.query.limit, 10) || 100, 500);

    const danmakus = await danmakuService.getRecentDanmakus(limit);

    res.status(200).json({
      success: true,
      data: danmakus,
      meta: { count: danmakus.length, limit }
    });
  });

  /**
   * GET /api/danmakus/user/:userId
   * Get user's danmaku history
   */
  getUserHistory = asyncHandler(async (req, res) => {
    const { userId } = req.params;
    const limit = Math.min(parseInt(req.query.limit, 10) || 50, 200);
    const offset = parseInt(req.query.offset, 10) || 0;

    const danmakus = await danmakuService.getUserDanmakuHistory(userId, { limit, offset });

    res.status(200).json({
      success: true,
      data: danmakus,
      meta: { count: danmakus.length, limit, offset }
    });
  });

  /**
   * GET /api/danmakus/stats/global
   * Get global service statistics (admin/monitoring)
   */
  getGlobalStats = asyncHandler(async (req, res) => {
    const io = req.app.get('io');
    const socketStats = io ? io.getStats() : { totalConnections: 0, activeConnections: 0 };

    res.status(200).json({
      success: true,
      data: {
        connections: socketStats,
        timestamp: new Date().toISOString()
      }
    });
  });
}

module.exports = new DanmakuController();
