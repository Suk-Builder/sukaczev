const danmakuService = require('../services/danmakuService');
const { validateSocketData } = require('../middleware/validation');
const { wsRateLimiter } = require('../middleware/rateLimiter');
const logger = require('../utils/logger');

/**
 * Calculate flight speed parameters for a danmaku
 * @param {number} density - Current density at time point
 * @param {number} type - Danmaku type (0=scroll, 1=top, 2=bottom)
 * @param {number} videoDuration - Total video duration
 * @returns {Object} Speed parameters
 */
function calculateFlightParams(density, type, videoDuration = 300) {
  const densityController = require('../utils/densityController');
  const speedFactor = densityController.calculateSpeedFactor(density);

  // Different types have different durations
  const baseDuration = type === 0 ? 8000 : 5000; // Scroll: 8s, Top/Bottom: 5s
  const duration = densityController.calculateFlightDuration(
    density,
    videoDuration,
    baseDuration
  );

  return {
    duration,
    speedFactor,
    delay: type === 0 ? 0 : 3000 // Top/bottom stay for 3s
  };
}

/**
 * Format danmaku for client delivery
 * @param {Object} danmaku - Danmaku object
 * @param {Object} flightParams - Flight parameters
 * @returns {Object} Formatted danmaku
 */
function formatDanmakuForClient(danmaku, flightParams = null) {
  return {
    id: danmaku.id,
    videoId: danmaku.videoId,
    userId: danmaku.userId,
    content: danmaku.content,
    timePoint: danmaku.timePoint,
    color: danmaku.color,
    type: danmaku.type,
    fontSize: danmaku.fontSize,
    createdAt: danmaku.createdAt,
    ...(flightParams && {
      flightDuration: flightParams.duration,
      speedFactor: flightParams.speedFactor
    })
  };
}

/**
 * Handle danmaku WebSocket events
 * @param {Object} io - Socket.io server instance
 * @param {Object} socket - Connected socket
 * @param {Object} stats - Socket stats tracker
 */
function handleDanmaku(io, socket, stats) {
  // Send danmaku via WebSocket
  socket.on('danmaku:send', async (data, callback) => {
    try {
      // Rate limit check
      if (!wsRateLimiter.isAllowed(socket.id)) {
        const error = {
          success: false,
          error: 'Rate limit exceeded. Please slow down.',
          code: 'RATE_LIMIT'
        };

        if (typeof callback === 'function') {
          callback(error);
        } else {
          socket.emit('danmaku:error', error);
        }
        return;
      }

      // Validate data
      const validation = validateSocketData('socketDanmakuSend', data);
      if (validation.error) {
        const error = {
          success: false,
          error: validation.message,
          code: 'VALIDATION_ERROR'
        };

        if (typeof callback === 'function') {
          callback(error);
        } else {
          socket.emit('danmaku:error', error);
        }
        return;
      }

      const danmakuData = validation.value;

      // Create danmaku
      const danmaku = await danmakuService.createDanmaku({
        ...danmakuData,
        userId: danmakuData.userId || socket.userId
      });

      // Calculate flight parameters
      const density = await require('../utils/densityController')
        .getCurrentDensity(danmaku.videoId, danmaku.timePoint);
      const flightParams = calculateFlightParams(
        density,
        danmaku.type,
        data.videoDuration || 300
      );

      const formattedDanmaku = formatDanmakuForClient(danmaku, flightParams);

      // Broadcast to all clients in the video room
      const roomName = `video:${danmaku.videoId}`;
      io.to(roomName).emit('danmaku:new', formattedDanmaku);

      stats.totalMessages++;

      // Send acknowledgment to sender
      const response = {
        success: true,
        data: formattedDanmaku
      };

      if (typeof callback === 'function') {
        callback(response);
      }

      logger.debug(`Danmaku sent via WebSocket: ${danmaku.id} to room ${roomName}`);
    } catch (error) {
      logger.error('Error handling danmaku:send:', error);

      const errorResponse = {
        success: false,
        error: error.message || 'Failed to send danmaku',
        code: error.code || 'SEND_ERROR'
      };

      if (typeof callback === 'function') {
        callback(errorResponse);
      } else {
        socket.emit('danmaku:error', errorResponse);
      }
    }
  });

  // Request danmaku history for a time range
  socket.on('danmaku:history', async (data, callback) => {
    try {
      // Validate data
      const validation = validateSocketData('socketHistoryRequest', data);
      if (validation.error) {
        const error = {
          success: false,
          error: validation.message,
          code: 'VALIDATION_ERROR'
        };

        if (typeof callback === 'function') {
          callback(error);
        }
        return;
      }

      const { videoId, start, end } = validation.value;

      const result = await danmakuService.getDanmakusByTimeRange(
        videoId,
        start,
        end,
        { limit: 500 }
      );

      const formattedDanmakus = result.danmakus.map(d => {
        // Calculate flight params for each danmaku
        const flightParams = calculateFlightParams(
          result.meta.total,
          d.type,
          data.videoDuration || 300
        );
        return formatDanmakuForClient(d, flightParams);
      });

      const response = {
        success: true,
        data: formattedDanmakus,
        meta: {
          ...result.meta,
          count: formattedDanmakus.length
        }
      };

      if (typeof callback === 'function') {
        callback(response);
      } else {
        socket.emit('danmaku:history', response);
      }

      logger.debug(`Sent danmaku history: ${formattedDanmakus.length} items for video ${videoId}`);
    } catch (error) {
      logger.error('Error handling danmaku:history:', error);

      const errorResponse = {
        success: false,
        error: error.message || 'Failed to retrieve danmaku history',
        code: error.code || 'HISTORY_ERROR'
      };

      if (typeof callback === 'function') {
        callback(errorResponse);
      }
    }
  });

  // Subscribe to real-time danmakus for current video
  socket.on('danmaku:subscribe', async (data, callback) => {
    try {
      const { videoId } = data || {};
      if (!videoId) {
        if (typeof callback === 'function') {
          callback({ success: false, error: 'videoId is required' });
        }
        return;
      }

      // Join video room
      const roomName = `video:${videoId}`;

      // Leave previous video rooms
      Array.from(socket.rooms).forEach(room => {
        if (room.startsWith('video:') && room !== roomName) {
          socket.leave(room);
        }
      });

      socket.join(roomName);
      socket.currentVideoId = videoId;

      const response = {
        success: true,
        videoId,
        subscribed: true
      };

      if (typeof callback === 'function') {
        callback(response);
      }

      logger.debug(`Socket ${socket.id} subscribed to danmakus for video ${videoId}`);
    } catch (error) {
      logger.error('Error handling danmaku:subscribe:', error);

      if (typeof callback === 'function') {
        callback({
          success: false,
          error: error.message || 'Failed to subscribe'
        });
      }
    }
  });

  // Unsubscribe from video danmakus
  socket.on('danmaku:unsubscribe', (data, callback) => {
    try {
      const { videoId } = data || {};
      const roomName = videoId
        ? `video:${videoId}`
        : `video:${socket.currentVideoId}`;

      socket.leave(roomName);

      if (!videoId) {
        socket.currentVideoId = null;
      }

      if (typeof callback === 'function') {
        callback({ success: true, unsubscribed: true });
      }

      logger.debug(`Socket ${socket.id} unsubscribed from ${roomName}`);
    } catch (error) {
      logger.error('Error handling danmaku:unsubscribe:', error);

      if (typeof callback === 'function') {
        callback({
          success: false,
          error: error.message || 'Failed to unsubscribe'
        });
      }
    }
  });

  // Get current socket stats
  socket.on('danmaku:stats', (data, callback) => {
    try {
      const { videoId } = data || {};

      if (videoId) {
        const roomName = `video:${videoId}`;
        const sockets = io.sockets.adapter.rooms.get(roomName);
        const roomSize = sockets ? sockets.size : 0;

        if (typeof callback === 'function') {
          callback({
            success: true,
            data: {
              videoId,
              viewers: roomSize,
              timestamp: new Date().toISOString()
            }
          });
        }
      } else {
        const allStats = io.getStats();

        if (typeof callback === 'function') {
          callback({
            success: true,
            data: allStats
          });
        }
      }
    } catch (error) {
      logger.error('Error handling danmaku:stats:', error);

      if (typeof callback === 'function') {
        callback({
          success: false,
          error: error.message || 'Failed to get stats'
        });
      }
    }
  });

  // Clean up rate limiter on disconnect
  socket.on('disconnect', () => {
    wsRateLimiter.removeSocket(socket.id);
  });
}

module.exports = handleDanmaku;
