const danmakuHandler = require('../websocket/danmakuHandler');
const logger = require('../utils/logger');

const roomStats = new Map();
const socketStats = {
  totalConnections: 0,
  activeConnections: 0,
  totalMessages: 0
};

function updateRoomStats(roomId, delta) {
  const current = roomStats.get(roomId) || 0;
  const updated = current + delta;
  if (updated <= 0) {
    roomStats.delete(roomId);
  } else {
    roomStats.set(roomId, updated);
  }
}

function getStats() {
  return {
    ...socketStats,
    rooms: Array.from(roomStats.entries()).map(([room, count]) => ({ room, count })),
    roomCount: roomStats.size
  };
}

module.exports = function configureSocket(io) {
  // Attach stats getter to io instance
  io.getStats = getStats;

  io.use((socket, next) => {
    // Authentication middleware
    const token = socket.handshake.auth.token || socket.handshake.query.token;
    const userId = socket.handshake.auth.userId || socket.handshake.query.userId;

    if (!token) {
      logger.warn('Socket connection rejected: no token provided');
      return next(new Error('Authentication required'));
    }

    // Attach user info to socket
    socket.userId = userId || 'anonymous';
    socket.token = token;
    socket.connectedAt = new Date();

    next();
  });

  io.on('connection', (socket) => {
    socketStats.totalConnections++;
    socketStats.activeConnections++;

    logger.info(`Socket connected: ${socket.id}, user: ${socket.userId}, total active: ${socketStats.activeConnections}`);

    // Handle video room joining
    socket.on('video:join', (data, callback) => {
      try {
        const { videoId } = data;
        if (!videoId) {
          if (typeof callback === 'function') {
            callback({ success: false, error: 'videoId is required' });
          }
          return;
        }

        // Leave previous video rooms
        const rooms = Array.from(socket.rooms);
        rooms.forEach(room => {
          if (room.startsWith('video:')) {
            socket.leave(room);
            updateRoomStats(room, -1);
            logger.debug(`Socket ${socket.id} left room ${room}`);
          }
        });

        // Join new room
        const roomName = `video:${videoId}`;
        socket.join(roomName);
        updateRoomStats(roomName, 1);
        socket.currentVideoId = videoId;

        logger.info(`Socket ${socket.id} joined room ${roomName}`);

        if (typeof callback === 'function') {
          callback({
            success: true,
            videoId,
            roomMembers: roomStats.get(roomName) || 1
          });
        }
      } catch (error) {
        logger.error('Error joining video room:', error);
        if (typeof callback === 'function') {
          callback({ success: false, error: 'Internal server error' });
        }
      }
    });

    // Handle video room leaving
    socket.on('video:leave', (data, callback) => {
      try {
        const { videoId } = data || {};
        const roomName = videoId ? `video:${videoId}` : `video:${socket.currentVideoId}`;

        socket.leave(roomName);
        updateRoomStats(roomName, -1);
        socket.currentVideoId = null;

        logger.debug(`Socket ${socket.id} left room ${roomName}`);

        if (typeof callback === 'function') {
          callback({ success: true });
        }
      } catch (error) {
        logger.error('Error leaving video room:', error);
        if (typeof callback === 'function') {
          callback({ success: false, error: 'Internal server error' });
        }
      }
    });

    // Initialize danmaku handlers
    danmakuHandler(io, socket, socketStats);

    // Handle ping from client
    socket.on('ping', (callback) => {
      if (typeof callback === 'function') {
        callback({ time: Date.now() });
      }
    });

    // Handle disconnection
    socket.on('disconnect', (reason) => {
      socketStats.activeConnections--;

      // Clean up rooms
      const rooms = Array.from(socket.rooms);
      rooms.forEach(room => {
        if (room.startsWith('video:')) {
          updateRoomStats(room, -1);
        }
      });

      logger.info(`Socket disconnected: ${socket.id}, reason: ${reason}, active: ${socketStats.activeConnections}`);
    });

    // Error handling
    socket.on('error', (error) => {
      logger.error(`Socket error on ${socket.id}:`, error);
    });
  });

  // Periodic cleanup of empty rooms
  setInterval(() => {
    const emptyRooms = [];
    roomStats.forEach((count, room) => {
      if (count <= 0) {
        emptyRooms.push(room);
      }
    });
    emptyRooms.forEach(room => roomStats.delete(room));
  }, 60000);
};
