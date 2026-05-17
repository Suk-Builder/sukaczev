const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');
const config = require('./config');
const logger = require('./utils/logger');
const notificationRoutes = require('./routes/notificationRoutes');
const { errorHandler, notFoundHandler } = require('./middleware/errorHandler');
const { defineNotificationModel } = require('./models/notification');

const app = express();

// Security middleware
app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      styleSrc: ["'self'", "'unsafe-inline'"],
      scriptSrc: ["'self'"],
    },
  },
}));

// CORS
app.use(cors({
  origin: ['https://sukaczev.top', 'https://www.sukaczev.top', 'http://sukaczev.top'],
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization'],
  credentials: true,
}));

// Body parsing
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// HTTP request logging
if (config.app.env !== 'test') {
  app.use(morgan(config.app.env === 'development' ? 'dev' : 'combined', {
    stream: {
      write: (message) => logger.info(message.trim()),
    },
  }));
}

// Define models
if (config.app.env !== 'test') {
  try {
    defineNotificationModel();
  } catch (error) {
    logger.error('Model definition error:', error.message);
  }
}

// Health check endpoint
app.get('/health', async (req, res) => {
  const health = {
    status: 'ok',
    service: config.app.name,
    version: process.env.npm_package_version || '1.0.0',
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    environment: config.app.env,
  };

  // Check Database connectivity
  try {
    const { getSequelize } = require('./config/database');
    const sequelize = getSequelize();
    await sequelize.authenticate();
    health.database = 'connected';
  } catch (error) {
    health.database = 'disconnected';
    health.status = 'degraded';
  }

  // Check Redis connectivity
  try {
    const { getRedisClient } = require('./config/redis');
    const redis = getRedisClient();
    await redis.ping();
    health.redis = 'connected';
  } catch (error) {
    health.redis = 'disconnected';
    health.status = 'degraded';
  }

  const statusCode = health.status === 'ok' ? 200 : 503;
  res.status(statusCode).json(health);
});

// WebSocket stats endpoint
app.get('/ws-stats', (req, res) => {
  if (global.wsServerInstance) {
    const stats = global.wsServerInstance.getStats();
    res.json({
      success: true,
      data: stats,
      timestamp: new Date().toISOString(),
    });
  } else {
    res.status(503).json({
      success: false,
      message: 'WebSocket server not available',
      timestamp: new Date().toISOString(),
    });
  }
});

// API routes
app.use('/api', notificationRoutes);

// Root endpoint
app.get('/', (req, res) => {
  res.json({
    service: config.app.name,
    version: '1.0.0',
    description: 'Sukačev Notification Service - Real-time notifications with WebSocket push',
    endpoints: {
      notifications: 'GET /api/notifications',
      unreadCount: 'GET /api/notifications/unread-count',
      markRead: 'PUT /api/notifications/:id/read',
      markAllRead: 'PUT /api/notifications/read-all',
      delete: 'DELETE /api/notifications/:id',
      wsStats: 'GET /ws-stats',
    },
    timestamp: new Date().toISOString(),
  });
});

// Error handling
app.use(notFoundHandler);
app.use(errorHandler);

module.exports = app;
