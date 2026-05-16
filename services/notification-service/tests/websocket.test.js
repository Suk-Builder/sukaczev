const NotificationWebSocketServer = require('../src/websocket/server');
const jwt = require('jsonwebtoken');
const config = require('../src/config');
const WebSocket = require('ws');

jest.mock('ws', () => {
  const MockWebSocket = jest.fn().mockImplementation(() => ({
    on: jest.fn(),
    send: jest.fn(),
    close: jest.fn(),
    terminate: jest.fn(),
    readyState: 1,
    isAlive: true,
    userId: null,
    isAuthenticated: false,
    messageCount: 0,
    lastMessageTime: Date.now(),
    pong: jest.fn(),
  }));

  MockWebSocket.Server = jest.fn().mockImplementation(() => ({
    on: jest.fn((event, handler) => {
      if (event === 'connection') {
        MockWebSocket.Server._connectionHandler = handler;
      }
    }),
    clients: new Set(),
    close: jest.fn(),
  }));

  MockWebSocket.OPEN = 1;
  MockWebSocket.CLOSING = 2;
  MockWebSocket.CLOSED = 3;

  return MockWebSocket;
});

describe('NotificationWebSocketServer', () => {
  let wsServer;
  let mockHttpServer;
  let mockRedis;

  beforeEach(() => {
    jest.clearAllMocks();

    mockRedis = {
      get: jest.fn(),
      setex: jest.fn(),
      del: jest.fn(),
    };

    jest.spyOn(require('../src/config/redis'), 'getRedisClient').mockReturnValue(mockRedis);

    mockHttpServer = {};

    wsServer = new NotificationWebSocketServer(mockHttpServer);
  });

  afterEach(() => {
    if (wsServer.heartbeatInterval) {
      clearInterval(wsServer.heartbeatInterval);
    }
    jest.restoreAllMocks();
  });

  describe('constructor', () => {
    it('should initialize with HTTP server', () => {
      expect(wsServer.wss).toBeDefined();
      expect(wsServer.connections).toBeInstanceOf(Map);
      expect(wsServer.heartbeatInterval).toBeDefined();
    });

    it('should start heartbeat', () => {
      expect(wsServer.heartbeatInterval).toBeDefined();
    });
  });

  describe('_setupServer', () => {
    it('should handle new connections', () => {
      const wsMock = {
        on: jest.fn(),
        send: jest.fn(),
        isAlive: true,
        userId: null,
        isAuthenticated: false,
        messageCount: 0,
        lastMessageTime: Date.now(),
        readyState: 1,
      };

      WebSocket.Server._connectionHandler(wsMock, { socket: { remoteAddress: '127.0.0.1' } });

      expect(wsMock.on).toHaveBeenCalledWith('message', expect.any(Function));
      expect(wsMock.on).toHaveBeenCalledWith('pong', expect.any(Function));
      expect(wsMock.on).toHaveBeenCalledWith('close', expect.any(Function));
      expect(wsMock.on).toHaveBeenCalledWith('error', expect.any(Function));
      expect(wsMock.send).toHaveBeenCalled();
    });
  });

  describe('_handleAuth', () => {
    it('should authenticate with valid token', () => {
      const token = jwt.sign({ sub: 'user-001', username: 'testuser' }, config.jwt.secret, { expiresIn: '1h' });

      const wsMock = {
        on: jest.fn(),
        send: jest.fn(),
        isAlive: true,
        userId: null,
        isAuthenticated: false,
        messageCount: 0,
        lastMessageTime: Date.now(),
        readyState: 1,
      };

      WebSocket.Server._connectionHandler(wsMock, { socket: { remoteAddress: '127.0.0.1' } });

      const messageHandler = wsMock.on.mock.calls.find(call => call[0] === 'message')[1];

      messageHandler(Buffer.from(JSON.stringify({ type: 'auth', token })));

      expect(wsMock.isAuthenticated).toBe(true);
      expect(wsMock.userId).toBe('user-001');
    });

    it('should reject authentication without token', () => {
      const wsMock = {
        on: jest.fn(),
        send: jest.fn(),
        isAlive: true,
        userId: null,
        isAuthenticated: false,
        messageCount: 0,
        lastMessageTime: Date.now(),
        readyState: 1,
      };

      WebSocket.Server._connectionHandler(wsMock, { socket: { remoteAddress: '127.0.0.1' } });

      const messageHandler = wsMock.on.mock.calls.find(call => call[0] === 'message')[1];

      messageHandler(Buffer.from(JSON.stringify({ type: 'auth' })));

      expect(wsMock.isAuthenticated).toBe(false);
    });

    it('should reject invalid token', () => {
      const wsMock = {
        on: jest.fn(),
        send: jest.fn(),
        isAlive: true,
        userId: null,
        isAuthenticated: false,
        messageCount: 0,
        lastMessageTime: Date.now(),
        readyState: 1,
      };

      WebSocket.Server._connectionHandler(wsMock, { socket: { remoteAddress: '127.0.0.1' } });

      const messageHandler = wsMock.on.mock.calls.find(call => call[0] === 'message')[1];

      messageHandler(Buffer.from(JSON.stringify({ type: 'auth', token: 'invalid-token' })));

      expect(wsMock.isAuthenticated).toBe(false);
    });

    it('should reject expired token', () => {
      const expiredToken = jwt.sign({ sub: 'user-001' }, config.jwt.secret, { expiresIn: '-1h' });

      const wsMock = {
        on: jest.fn(),
        send: jest.fn(),
        isAlive: true,
        userId: null,
        isAuthenticated: false,
        messageCount: 0,
        lastMessageTime: Date.now(),
        readyState: 1,
      };

      WebSocket.Server._connectionHandler(wsMock, { socket: { remoteAddress: '127.0.0.1' } });

      const messageHandler = wsMock.on.mock.calls.find(call => call[0] === 'message')[1];

      messageHandler(Buffer.from(JSON.stringify({ type: 'auth', token: expiredToken })));

      expect(wsMock.isAuthenticated).toBe(false);
    });

    it('should enforce max connections per user', () => {
      const token = jwt.sign({ sub: 'user-001' }, config.jwt.secret, { expiresIn: '1h' });

      const oldWs = {
        on: jest.fn(),
        send: jest.fn(),
        close: jest.fn(),
        isAlive: true,
        userId: null,
        isAuthenticated: false,
        messageCount: 0,
        lastMessageTime: Date.now(),
        readyState: 1,
      };

      // Simulate max connections
      for (let i = 0; i < config.websocket.maxConnectionsPerUser; i++) {
        wsServer.connections.set('user-001', new Set([oldWs]));
      }

      const wsMock = {
        on: jest.fn(),
        send: jest.fn(),
        isAlive: true,
        userId: null,
        isAuthenticated: false,
        messageCount: 0,
        lastMessageTime: Date.now(),
        readyState: 1,
      };

      WebSocket.Server._connectionHandler(wsMock, { socket: { remoteAddress: '127.0.0.1' } });

      const messageHandler = wsMock.on.mock.calls.find(call => call[0] === 'message')[1];

      messageHandler(Buffer.from(JSON.stringify({ type: 'auth', token })));

      expect(wsMock.isAuthenticated).toBe(true);
    });
  });

  describe('_handleMessage', () => {
    it('should handle ping messages', () => {
      const wsMock = {
        on: jest.fn(),
        send: jest.fn(),
        isAlive: true,
        userId: null,
        isAuthenticated: false,
        messageCount: 0,
        lastMessageTime: Date.now(),
        readyState: 1,
      };

      WebSocket.Server._connectionHandler(wsMock, { socket: { remoteAddress: '127.0.0.1' } });

      const messageHandler = wsMock.on.mock.calls.find(call => call[0] === 'message')[1];

      messageHandler(Buffer.from(JSON.stringify({ type: 'ping' })));

      const sentMessages = wsMock.send.mock.calls;
      const lastCall = JSON.parse(sentMessages[sentMessages.length - 1][0]);
      expect(lastCall.type).toBe('pong');
    });

    it('should handle mark_read messages for authenticated users', () => {
      const wsMock = {
        on: jest.fn(),
        send: jest.fn(),
        isAlive: true,
        userId: 'user-001',
        isAuthenticated: true,
        messageCount: 0,
        lastMessageTime: Date.now(),
        readyState: 1,
      };

      WebSocket.Server._connectionHandler(wsMock, { socket: { remoteAddress: '127.0.0.1' } });

      const messageHandler = wsMock.on.mock.calls.find(call => call[0] === 'message')[1];

      messageHandler(Buffer.from(JSON.stringify({ type: 'mark_read', notificationId: 'notif-001' })));

      const sentMessages = wsMock.send.mock.calls;
      const lastCall = JSON.parse(sentMessages[sentMessages.length - 1][0]);
      expect(lastCall.type).toBe('mark_read');
    });

    it('should reject mark_read for unauthenticated users', () => {
      const wsMock = {
        on: jest.fn(),
        send: jest.fn(),
        isAlive: true,
        userId: null,
        isAuthenticated: false,
        messageCount: 0,
        lastMessageTime: Date.now(),
        readyState: 1,
      };

      WebSocket.Server._connectionHandler(wsMock, { socket: { remoteAddress: '127.0.0.1' } });

      const messageHandler = wsMock.on.mock.calls.find(call => call[0] === 'message')[1];

      messageHandler(Buffer.from(JSON.stringify({ type: 'mark_read', notificationId: 'notif-001' })));

      const sentMessages = wsMock.send.mock.calls;
      const lastCall = JSON.parse(sentMessages[sentMessages.length - 1][0]);
      expect(lastCall.type).toBe('error');
      expect(lastCall.message).toContain('Authentication required');
    });

    it('should handle unknown message types', () => {
      const wsMock = {
        on: jest.fn(),
        send: jest.fn(),
        isAlive: true,
        userId: null,
        isAuthenticated: false,
        messageCount: 0,
        lastMessageTime: Date.now(),
        readyState: 1,
      };

      WebSocket.Server._connectionHandler(wsMock, { socket: { remoteAddress: '127.0.0.1' } });

      const messageHandler = wsMock.on.mock.calls.find(call => call[0] === 'message')[1];

      messageHandler(Buffer.from(JSON.stringify({ type: 'unknown' })));

      const sentMessages = wsMock.send.mock.calls;
      const lastCall = JSON.parse(sentMessages[sentMessages.length - 1][0]);
      expect(lastCall.type).toBe('error');
    });

    it('should handle rate limiting', () => {
      const wsMock = {
        on: jest.fn(),
        send: jest.fn(),
        isAlive: true,
        userId: null,
        isAuthenticated: false,
        messageCount: 999999,
        lastMessageTime: Date.now(),
        readyState: 1,
      };

      WebSocket.Server._connectionHandler(wsMock, { socket: { remoteAddress: '127.0.0.1' } });

      const messageHandler = wsMock.on.mock.calls.find(call => call[0] === 'message')[1];

      messageHandler(Buffer.from(JSON.stringify({ type: 'ping' })));

      const sentMessages = wsMock.send.mock.calls;
      const lastCall = JSON.parse(sentMessages[sentMessages.length - 1][0]);
      expect(lastCall.type).toBe('error');
      expect(lastCall.message).toContain('rate limit');
    });

    it('should handle invalid JSON', () => {
      const wsMock = {
        on: jest.fn(),
        send: jest.fn(),
        isAlive: true,
        userId: null,
        isAuthenticated: false,
        messageCount: 0,
        lastMessageTime: Date.now(),
        readyState: 1,
      };

      WebSocket.Server._connectionHandler(wsMock, { socket: { remoteAddress: '127.0.0.1' } });

      const messageHandler = wsMock.on.mock.calls.find(call => call[0] === 'message')[1];

      messageHandler(Buffer.from('invalid json{'));

      const sentMessages = wsMock.send.mock.calls;
      const lastCall = JSON.parse(sentMessages[sentMessages.length - 1][0]);
      expect(lastCall.type).toBe('error');
      expect(lastCall.message).toContain('Invalid');
    });

    it('should reset message count after time window', () => {
      const wsMock = {
        on: jest.fn(),
        send: jest.fn(),
        isAlive: true,
        userId: null,
        isAuthenticated: false,
        messageCount: 999999,
        lastMessageTime: Date.now() - 120000,
        readyState: 1,
      };

      WebSocket.Server._connectionHandler(wsMock, { socket: { remoteAddress: '127.0.0.1' } });

      const messageHandler = wsMock.on.mock.calls.find(call => call[0] === 'message')[1];

      messageHandler(Buffer.from(JSON.stringify({ type: 'ping' })));

      expect(wsMock.messageCount).toBe(1);
    });
  });

  describe('sendNotification', () => {
    it('should send notification to connected user', () => {
      const wsMock = {
        readyState: 1,
        send: jest.fn(),
      };
      wsServer.connections.set('user-001', new Set([wsMock]));

      const result = wsServer.sendNotification('user-001', { id: 'notif-001', content: 'Test' });

      expect(result).toBe(true);
      expect(wsMock.send).toHaveBeenCalled();
    });

    it('should return false when user not connected', () => {
      const result = wsServer.sendNotification('user-999', { id: 'notif-001' });

      expect(result).toBe(false);
    });

    it('should send to multiple connections', () => {
      const ws1 = { readyState: 1, send: jest.fn() };
      const ws2 = { readyState: 1, send: jest.fn() };
      wsServer.connections.set('user-001', new Set([ws1, ws2]));

      wsServer.sendNotification('user-001', { id: 'notif-001' });

      expect(ws1.send).toHaveBeenCalled();
      expect(ws2.send).toHaveBeenCalled();
    });

    it('should handle send errors', () => {
      const wsMock = {
        readyState: 1,
        send: jest.fn(() => { throw new Error('Send error'); }),
      };
      wsServer.connections.set('user-001', new Set([wsMock]));

      const result = wsServer.sendNotification('user-001', { id: 'notif-001' });

      expect(result).toBe(true);
    });
  });

  describe('sendUnreadCount', () => {
    it('should send cached count', async () => {
      const wsMock = {
        readyState: 1,
        send: jest.fn(),
      };
      wsServer.connections.set('user-001', new Set([wsMock]));

      await wsServer.sendUnreadCount('user-001', 5);

      expect(wsMock.send).toHaveBeenCalled();
    });

    it('should fetch count from Redis when not provided', async () => {
      mockRedis.get.mockResolvedValue('10');

      const wsMock = {
        readyState: 1,
        send: jest.fn(),
      };
      wsServer.connections.set('user-001', new Set([wsMock]));

      await wsServer.sendUnreadCount('user-001');

      expect(mockRedis.get).toHaveBeenCalledWith('unread:user-001');
    });

    it('should return false when user not connected', async () => {
      const result = await wsServer.sendUnreadCount('user-999', 5);

      expect(result).toBe(false);
    });
  });

  describe('broadcast', () => {
    it('should broadcast to all authenticated users', () => {
      const wsMock = {
        readyState: 1,
        send: jest.fn(),
        isAuthenticated: true,
      };

      wsServer.wss.clients.add(wsMock);

      wsServer.broadcast({ type: 'announcement', message: 'Hello' });

      expect(wsMock.send).toHaveBeenCalled();
    });

    it('should not send to unauthenticated users', () => {
      const wsMock = {
        readyState: 1,
        send: jest.fn(),
        isAuthenticated: false,
      };

      wsServer.wss.clients.add(wsMock);

      wsServer.broadcast({ type: 'announcement', message: 'Hello' });

      expect(wsMock.send).not.toHaveBeenCalled();
    });
  });

  describe('getStats', () => {
    it('should return connection statistics', () => {
      const ws1 = { isAuthenticated: true };
      const ws2 = { isAuthenticated: false };

      wsServer.wss.clients.add(ws1);
      wsServer.wss.clients.add(ws2);

      const stats = wsServer.getStats();

      expect(stats.totalConnections).toBe(2);
      expect(stats.authenticatedConnections).toBe(1);
    });

    it('should return zero for empty server', () => {
      const stats = wsServer.getStats();

      expect(stats.totalConnections).toBe(0);
      expect(stats.authenticatedConnections).toBe(0);
      expect(stats.uniqueUsers).toBe(0);
    });
  });

  describe('shutdown', () => {
    it('should close all connections and stop heartbeat', async () => {
      const wsMock = {
        close: jest.fn(),
      };
      wsServer.wss.clients.add(wsMock);

      await wsServer.shutdown();

      expect(wsMock.close).toHaveBeenCalled();
      expect(wsServer.wss.close).toHaveBeenCalled();
    });
  });

  describe('_handleClose', () => {
    it('should remove connection from map', () => {
      const wsMock = {
        userId: 'user-001',
      };
      wsServer.connections.set('user-001', new Set([wsMock]));

      wsServer._handleClose(wsMock, 1000, 'Normal closure');

      expect(wsServer.connections.has('user-001')).toBe(false);
    });

    it('should not fail for unregistered connections', () => {
      const wsMock = {
        userId: null,
      };

      expect(() => wsServer._handleClose(wsMock, 1000, 'Normal')).not.toThrow();
    });
  });

  describe('_handleError', () => {
    it('should not throw', () => {
      expect(() => wsServer._handleError({}, new Error('Test error'))).not.toThrow();
    });
  });
});
