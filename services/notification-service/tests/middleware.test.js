const jwt = require('jsonwebtoken');
const config = require('../src/config');

jest.mock('../src/utils/logger', () => ({
  info: jest.fn(),
  error: jest.fn(),
  warn: jest.fn(),
  debug: jest.fn(),
}));

describe('Auth Middleware', () => {
  let authenticate, requireAuth, requireRole;
  let req, res, next;

  beforeEach(() => {
    jest.clearAllMocks();
    jest.isolateModules(() => {
      const auth = require('../src/middleware/auth');
      authenticate = auth.authenticate;
      requireAuth = auth.requireAuth;
      requireRole = auth.requireRole;
    });

    req = { headers: {}, user: null };
    res = { status: jest.fn().mockReturnThis(), json: jest.fn() };
    next = jest.fn();
  });

  describe('authenticate', () => {
    it('should set user from valid token', () => {
      const token = jwt.sign(
        { sub: 'user-001', username: 'testuser', role: 'user' },
        config.jwt.secret,
        { expiresIn: '1h' }
      );
      req.headers.authorization = `Bearer ${token}`;

      authenticate(req, res, next);

      expect(req.user).toBeDefined();
      expect(req.user.id).toBe('user-001');
      expect(req.user.username).toBe('testuser');
      expect(next).toHaveBeenCalled();
    });

    it('should allow unauthenticated requests', () => {
      authenticate(req, res, next);

      expect(req.user).toBeNull();
      expect(next).toHaveBeenCalled();
    });

    it('should reject invalid auth format', () => {
      req.headers.authorization = 'Basic abc123';

      authenticate(req, res, next);

      expect(req.user).toBeNull();
      expect(next).toHaveBeenCalled();
    });

    it('should return 401 for expired token', () => {
      const token = jwt.sign({ sub: 'user-001' }, config.jwt.secret, { expiresIn: '-1h' });
      req.headers.authorization = `Bearer ${token}`;

      authenticate(req, res, next);

      expect(res.status).toHaveBeenCalledWith(401);
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({ success: false, message: 'Token expired' })
      );
    });

    it('should return 401 for invalid token', () => {
      req.headers.authorization = 'Bearer invalid-token';

      authenticate(req, res, next);

      expect(res.status).toHaveBeenCalledWith(401);
    });

    it('should handle missing auth header', () => {
      authenticate(req, res, next);

      expect(req.user).toBeNull();
      expect(next).toHaveBeenCalled();
    });

    it('should decode id field', () => {
      const token = jwt.sign({ id: 'user-002', username: 'test' }, config.jwt.secret, { expiresIn: '1h' });
      req.headers.authorization = `Bearer ${token}`;

      authenticate(req, res, next);

      expect(req.user.id).toBe('user-002');
    });

    it('should default role to user', () => {
      const token = jwt.sign({ sub: 'user-003' }, config.jwt.secret, { expiresIn: '1h' });
      req.headers.authorization = `Bearer ${token}`;

      authenticate(req, res, next);

      expect(req.user.role).toBe('user');
    });

    it('should handle malformed JWT', () => {
      req.headers.authorization = 'Bearer abc.def';

      authenticate(req, res, next);

      expect(res.status).toHaveBeenCalledWith(401);
    });

    it('should handle null auth header', () => {
      req.headers.authorization = null;

      authenticate(req, res, next);

      expect(req.user).toBeNull();
    });

    it('should handle undefined auth header', () => {
      req.headers.authorization = undefined;

      authenticate(req, res, next);

      expect(req.user).toBeNull();
    });
  });

  describe('requireAuth', () => {
    it('should allow authenticated requests', () => {
      req.user = { id: 'user-001', role: 'user' };

      requireAuth(req, res, next);

      expect(next).toHaveBeenCalled();
    });

    it('should reject unauthenticated requests', () => {
      req.user = null;

      requireAuth(req, res, next);

      expect(res.status).toHaveBeenCalledWith(401);
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({ success: false, message: 'Authentication required' })
      );
    });

    it('should reject undefined user', () => {
      req.user = undefined;

      requireAuth(req, res, next);

      expect(res.status).toHaveBeenCalledWith(401);
    });
  });

  describe('requireRole', () => {
    it('should allow matching role', () => {
      req.user = { id: 'user-001', role: 'admin' };
      const middleware = requireRole('admin');

      middleware(req, res, next);

      expect(next).toHaveBeenCalled();
    });

    it('should allow multiple roles', () => {
      req.user = { id: 'user-001', role: 'moderator' };
      const middleware = requireRole('admin', 'moderator');

      middleware(req, res, next);

      expect(next).toHaveBeenCalled();
    });

    it('should reject non-matching role', () => {
      req.user = { id: 'user-001', role: 'user' };
      const middleware = requireRole('admin');

      middleware(req, res, next);

      expect(res.status).toHaveBeenCalledWith(403);
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({ success: false, message: 'Insufficient permissions' })
      );
    });

    it('should reject unauthenticated', () => {
      req.user = null;
      const middleware = requireRole('admin');

      middleware(req, res, next);

      expect(res.status).toHaveBeenCalledWith(401);
    });

    it('should reject missing required role', () => {
      req.user = { id: 'user-001', role: 'guest' };
      const middleware = requireRole('admin', 'moderator', 'user');

      middleware(req, res, next);

      expect(res.status).toHaveBeenCalledWith(403);
    });
  });
});

describe('Rate Limiter Middleware', () => {
  let rateLimiter;
  let req, res, next;

  beforeEach(() => {
    jest.clearAllMocks();
    jest.isolateModules(() => {
      const rl = require('../src/middleware/rateLimiter');
      rateLimiter = rl.rateLimiter;
    });

    req = { ip: '192.168.1.100', user: null };
    res = { setHeader: jest.fn(), status: jest.fn().mockReturnThis(), json: jest.fn() };
    next = jest.fn();
  });

  it('should allow request within limit', async () => {
    const mockRedis = {
      incr: jest.fn().mockResolvedValue(1),
      pexpire: jest.fn().mockResolvedValue(1),
      pttl: jest.fn().mockResolvedValue(60000),
      status: 'ready',
    };

    jest.spyOn(require('../src/config/redis'), 'getRedisClient').mockReturnValue(mockRedis);

    const middleware = rateLimiter('list');
    await middleware(req, res, next);

    expect(next).toHaveBeenCalled();
    expect(res.setHeader).toHaveBeenCalledWith('X-RateLimit-Limit', 60);
  });

  it('should block request over limit', async () => {
    const mockRedis = {
      incr: jest.fn().mockResolvedValue(61),
      pexpire: jest.fn().mockResolvedValue(1),
      pttl: jest.fn().mockResolvedValue(30000),
      status: 'ready',
    };

    jest.spyOn(require('../src/config/redis'), 'getRedisClient').mockReturnValue(mockRedis);

    const middleware = rateLimiter('list');
    await middleware(req, res, next);

    expect(res.status).toHaveBeenCalledWith(429);
    expect(next).not.toHaveBeenCalled();
  });

  it('should skip when Redis not connected', async () => {
    const mockRedis = { status: 'end' };
    jest.spyOn(require('../src/config/redis'), 'getRedisClient').mockReturnValue(mockRedis);

    const middleware = rateLimiter('list');
    await middleware(req, res, next);

    expect(next).toHaveBeenCalled();
  });

  it('should use user ID for authenticated users', async () => {
    req.user = { id: 'user-001' };
    const mockRedis = {
      incr: jest.fn().mockResolvedValue(1),
      pexpire: jest.fn().mockResolvedValue(1),
      pttl: jest.fn().mockResolvedValue(60000),
      status: 'ready',
    };

    jest.spyOn(require('../src/config/redis'), 'getRedisClient').mockReturnValue(mockRedis);

    const middleware = rateLimiter('list');
    await middleware(req, res, next);

    expect(next).toHaveBeenCalled();
  });

  it('should allow when Redis fails', async () => {
    const mockRedis = {
      incr: jest.fn().mockRejectedValue(new Error('Redis error')),
      status: 'ready',
    };

    jest.spyOn(require('../src/config/redis'), 'getRedisClient').mockReturnValue(mockRedis);

    const middleware = rateLimiter('list');
    await middleware(req, res, next);

    expect(next).toHaveBeenCalled();
  });

  it('should use different limits per type', async () => {
    const mockRedis = {
      incr: jest.fn().mockResolvedValue(1),
      pexpire: jest.fn().mockResolvedValue(1),
      pttl: jest.fn().mockResolvedValue(60000),
      status: 'ready',
    };

    jest.spyOn(require('../src/config/redis'), 'getRedisClient').mockReturnValue(mockRedis);

    const markReadMiddleware = rateLimiter('markRead');
    await markReadMiddleware(req, res, next);

    expect(res.setHeader).toHaveBeenCalledWith('X-RateLimit-Limit', 120);
  });

  it('should use default config for unknown type', async () => {
    const mockRedis = {
      incr: jest.fn().mockResolvedValue(1),
      pexpire: jest.fn().mockResolvedValue(1),
      pttl: jest.fn().mockResolvedValue(60000),
      status: 'ready',
    };

    jest.spyOn(require('../src/config/redis'), 'getRedisClient').mockReturnValue(mockRedis);

    const middleware = rateLimiter('unknown');
    await middleware(req, res, next);

    expect(res.setHeader).toHaveBeenCalledWith('X-RateLimit-Limit', 120);
  });

  it('should handle missing ip and user', async () => {
    req.ip = undefined;
    req.user = null;
    const mockRedis = {
      incr: jest.fn().mockResolvedValue(1),
      pexpire: jest.fn().mockResolvedValue(1),
      pttl: jest.fn().mockResolvedValue(60000),
      status: 'ready',
    };

    jest.spyOn(require('../src/config/redis'), 'getRedisClient').mockReturnValue(mockRedis);

    const middleware = rateLimiter('list');
    await middleware(req, res, next);

    expect(next).toHaveBeenCalled();
  });
});

describe('Error Handler Middleware', () => {
  let errorHandler, notFoundHandler;

  beforeEach(() => {
    jest.clearAllMocks();
    jest.isolateModules(() => {
      const eh = require('../src/middleware/errorHandler');
      errorHandler = eh.errorHandler;
      notFoundHandler = eh.notFoundHandler;
    });
  });

  describe('errorHandler', () => {
    it('should handle Sequelize validation error', () => {
      const err = new Error('Validation failed');
      err.name = 'SequelizeValidationError';
      err.errors = [{ path: 'email', message: 'Invalid email' }];

      const req = { path: '/api/notifications', method: 'POST' };
      const res = { status: jest.fn().mockReturnThis(), json: jest.fn() };

      errorHandler(err, req, res, jest.fn());

      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({
          success: false,
          errors: expect.arrayContaining([expect.objectContaining({ field: 'email' })]),
        })
      );
    });

    it('should handle Sequelize unique constraint error', () => {
      const err = new Error('Duplicate');
      err.name = 'SequelizeUniqueConstraintError';

      const req = { path: '/api/notifications', method: 'POST' };
      const res = { status: jest.fn().mockReturnThis(), json: jest.fn() };

      errorHandler(err, req, res, jest.fn());

      expect(res.status).toHaveBeenCalledWith(409);
    });

    it('should handle Sequelize database error', () => {
      const err = new Error('DB error');
      err.name = 'SequelizeDatabaseError';

      const req = { path: '/api/notifications', method: 'GET' };
      const res = { status: jest.fn().mockReturnThis(), json: jest.fn() };

      errorHandler(err, req, res, jest.fn());

      expect(res.status).toHaveBeenCalledWith(500);
    });

    it('should handle Sequelize connection error', () => {
      const err = new Error('Connection failed');
      err.name = 'SequelizeConnectionError';

      const req = { path: '/api/notifications', method: 'GET' };
      const res = { status: jest.fn().mockReturnThis(), json: jest.fn() };

      errorHandler(err, req, res, jest.fn());

      expect(res.status).toHaveBeenCalledWith(503);
    });

    it('should handle connection refused', () => {
      const err = new Error('ECONNREFUSED');

      const req = { path: '/api/notifications', method: 'GET' };
      const res = { status: jest.fn().mockReturnThis(), json: jest.fn() };

      errorHandler(err, req, res, jest.fn());

      expect(res.status).toHaveBeenCalledWith(503);
    });

    it('should handle generic errors', () => {
      const err = new Error('Something went wrong');
      err.statusCode = 400;

      const req = { path: '/api/notifications', method: 'GET' };
      const res = { status: jest.fn().mockReturnThis(), json: jest.fn() };

      errorHandler(err, req, res, jest.fn());

      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ success: false }));
    });

    it('should handle internal server errors', () => {
      const err = new Error('Internal error');

      const req = { path: '/api/notifications', method: 'GET' };
      const res = { status: jest.fn().mockReturnThis(), json: jest.fn() };

      errorHandler(err, req, res, jest.fn());

      expect(res.status).toHaveBeenCalledWith(500);
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({ message: 'Internal server error' })
      );
    });
  });

  describe('notFoundHandler', () => {
    it('should return 404 for undefined routes', () => {
      const req = { path: '/api/unknown', method: 'GET' };
      const res = { status: jest.fn().mockReturnThis(), json: jest.fn() };

      notFoundHandler(req, res);

      expect(res.status).toHaveBeenCalledWith(404);
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({
          success: false,
          message: expect.stringContaining('not found'),
        })
      );
    });
  });
});
