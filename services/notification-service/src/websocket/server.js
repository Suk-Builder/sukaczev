const { WebSocketServer } = require('ws');
const jwt = require('jsonwebtoken');
const { getRedisClient } = require('../config/redis');
const config = require('../config');
const logger = require('../utils/logger');

class NotificationWebSocketServer {
  constructor(httpServer) {
    this.wss = new WebSocketServer({ server: httpServer });
    this.redis = getRedisClient();
    this.connections = new Map(); // userId -> Set<ws>
    this.heartbeatInterval = null;

    this._setupServer();
    this._startHeartbeat();
  }

  /**
   * Setup WebSocket server event handlers
   */
  _setupServer() {
    this.wss.on('connection', (ws, req) => {
      logger.info(`New WebSocket connection from ${req.socket.remoteAddress}`);

      ws.isAlive = true;
      ws.userId = null;
      ws.isAuthenticated = false;
      ws.messageCount = 0;
      ws.lastMessageTime = Date.now();

      // Send connection established message
      this._send(ws, {
        type: 'connection',
        status: 'connected',
        message: 'WebSocket connection established. Please authenticate.',
        timestamp: new Date().toISOString(),
      });

      ws.on('message', (data) => this._handleMessage(ws, data));
      ws.on('pong', () => { ws.isAlive = true; });
      ws.on('close', (code, reason) => this._handleClose(ws, code, reason));
      ws.on('error', (error) => this._handleError(ws, error));
    });

    this.wss.on('error', (error) => {
      logger.error('WebSocket server error:', error.message);
    });

    logger.info('WebSocket server initialized');
  }

  /**
   * Handle incoming WebSocket message
   */
  _handleMessage(ws, data) {
    try {
      // Rate limiting check
      const now = Date.now();
      if (now - ws.lastMessageTime >= 60000) {
        ws.messageCount = 0;
        ws.lastMessageTime = now;
      }
      ws.messageCount++;

      if (ws.messageCount > config.websocket.messageRateLimit) {
        this._send(ws, {
          type: 'error',
          message: 'Message rate limit exceeded',
          timestamp: new Date().toISOString(),
        });
        return;
      }

      const message = JSON.parse(data.toString());

      switch (message.type) {
        case 'auth':
          this._handleAuth(ws, message);
          break;
        case 'ping':
          this._send(ws, {
            type: 'pong',
            timestamp: new Date().toISOString(),
          });
          break;
        case 'mark_read':
          if (!ws.isAuthenticated) {
            this._sendUnauthorized(ws);
            return;
          }
          this._handleMarkRead(ws, message);
          break;
        default:
          this._send(ws, {
            type: 'error',
            message: `Unknown message type: ${message.type}`,
            timestamp: new Date().toISOString(),
          });
      }
    } catch (error) {
      logger.error('WebSocket message handling error:', error.message);
      this._send(ws, {
        type: 'error',
        message: 'Invalid message format',
        timestamp: new Date().toISOString(),
      });
    }
  }

  /**
   * Handle authentication
   */
  _handleAuth(ws, message) {
    try {
      const { token } = message;

      if (!token) {
        this._send(ws, {
          type: 'auth',
          status: 'error',
          message: 'Token is required',
          timestamp: new Date().toISOString(),
        });
        return;
      }

      const decoded = jwt.verify(token, config.jwt.secret, {
        clockTolerance: 60,
      });

      const userId = decoded.sub || decoded.id;
      ws.userId = userId;
      ws.isAuthenticated = true;

      // Register connection
      if (!this.connections.has(userId)) {
        this.connections.set(userId, new Set());
      }

      const userConnections = this.connections.get(userId);

      // Enforce max connections per user
      if (userConnections.size >= config.websocket.maxConnectionsPerUser) {
        // Close oldest connection
        const oldest = userConnections.values().next().value;
        userConnections.delete(oldest);
        oldest.close(1008, 'Too many connections');
      }

      userConnections.add(ws);

      logger.info(`WebSocket authenticated for user: ${userId}`);

      this._send(ws, {
        type: 'auth',
        status: 'success',
        userId,
        timestamp: new Date().toISOString(),
      });

      // Send unread count after auth
      this._sendUnreadCount(userId);
    } catch (error) {
      if (error.name === 'TokenExpiredError') {
        this._send(ws, {
          type: 'auth',
          status: 'error',
          message: 'Token expired',
          timestamp: new Date().toISOString(),
        });
      } else {
        this._send(ws, {
          type: 'auth',
          status: 'error',
          message: 'Invalid token',
          timestamp: new Date().toISOString(),
        });
      }
    }
  }

  /**
   * Handle mark read from WebSocket
   */
  _handleMarkRead(ws, message) {
    const { notificationId } = message;

    this._send(ws, {
      type: 'mark_read',
      status: 'acknowledged',
      notificationId,
      timestamp: new Date().toISOString(),
    });
  }

  /**
   * Handle connection close
   */
  _handleClose(ws, code, reason) {
    logger.info(`WebSocket connection closed: ${code} - ${reason}`);

    if (ws.userId && this.connections.has(ws.userId)) {
      const userConnections = this.connections.get(ws.userId);
      userConnections.delete(ws);

      if (userConnections.size === 0) {
        this.connections.delete(ws.userId);
      }
    }
  }

  /**
   * Handle WebSocket error
   */
  _handleError(ws, error) {
    logger.error('WebSocket error:', error.message);
  }

  /**
   * Start heartbeat interval
   */
  _startHeartbeat() {
    this.heartbeatInterval = setInterval(() => {
      this.wss.clients.forEach((ws) => {
        if (!ws.isAlive) {
          ws.terminate();
          return;
        }
        ws.isAlive = false;
        ws.ping();
      });
    }, config.websocket.heartbeatInterval);

    logger.info(`Heartbeat started with ${config.websocket.heartbeatInterval}ms interval`);
  }

  /**
   * Send message to a WebSocket client
   */
  _send(ws, data) {
    if (ws.readyState === 1) { // OPEN
      try {
        ws.send(JSON.stringify(data));
      } catch (error) {
        logger.error('WebSocket send error:', error.message);
      }
    }
  }

  /**
   * Send unauthorized message
   */
  _sendUnauthorized(ws) {
    this._send(ws, {
      type: 'error',
      message: 'Authentication required',
      timestamp: new Date().toISOString(),
    });
  }

  /**
   * Send notification to a specific user
   */
  sendNotification(userId, notification) {
    if (!this.connections.has(userId)) {
      return false;
    }

    const userConnections = this.connections.get(userId);
    const message = {
      type: 'notification',
      data: notification,
      timestamp: new Date().toISOString(),
    };

    let sent = false;
    userConnections.forEach((ws) => {
      this._send(ws, message);
      sent = true;
    });

    return sent;
  }

  /**
   * Send unread count update to user
   */
  async sendUnreadCount(userId, count) {
    if (!this.connections.has(userId)) {
      return false;
    }

    // If count not provided, get from Redis
    if (count === undefined) {
      try {
        const redisKey = `unread:${userId}`;
        const cached = await this.redis.get(redisKey);
        count = cached ? parseInt(cached, 10) : 0;
      } catch (error) {
        logger.error('Redis get unread count error:', error.message);
        count = 0;
      }
    }

    const message = {
      type: 'unread_count',
      count,
      timestamp: new Date().toISOString(),
    };

    const userConnections = this.connections.get(userId);
    userConnections.forEach((ws) => {
      this._send(ws, message);
    });

    return true;
  }

  /**
   * Send unread count to specific user after auth
   */
  async _sendUnreadCount(userId) {
    return this.sendUnreadCount(userId);
  }

  /**
   * Broadcast to all authenticated connections
   */
  broadcast(message) {
    this.wss.clients.forEach((ws) => {
      if (ws.isAuthenticated) {
        this._send(ws, message);
      }
    });
  }

  /**
   * Get connection statistics
   */
  getStats() {
    let authenticated = 0;
    let total = 0;

    this.wss.clients.forEach((ws) => {
      total++;
      if (ws.isAuthenticated) {
        authenticated++;
      }
    });

    return {
      totalConnections: total,
      authenticatedConnections: authenticated,
      uniqueUsers: this.connections.size,
    };
  }

  /**
   * Graceful shutdown
   */
  async shutdown() {
    // Close all connections
    this.wss.clients.forEach((ws) => {
      ws.close(1001, 'Server shutting down');
    });

    // Stop heartbeat
    if (this.heartbeatInterval) {
      clearInterval(this.heartbeatInterval);
    }

    // Close server
    this.wss.close();
    logger.info('WebSocket server shut down');
  }
}

module.exports = NotificationWebSocketServer;
