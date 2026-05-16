/**
 * @fileoverview Express application setup for video-service.
 */

const express = require('express');
const helmet = require('helmet');
const cors = require('cors');
const morgan = require('morgan');
const compression = require('compression');

const logger = require('./services/loggerService');
const { errorHandler, notFoundHandler } = require('./middleware/errorHandler');
const videoRoutes = require('./routes/videos');
const categoryRoutes = require('./routes/categories');

/**
 * Creates and configures the Express application.
 *
 * @returns {Object} Configured Express app
 */
function createApp() {
  const app = express();

  // Security middleware
  app.use(helmet());
  app.use(cors({
    origin: process.env.CORS_ORIGIN || '*',
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization'],
    credentials: true,
  }));

  // Body parsing
  app.use(express.json({ limit: '10mb' }));
  app.use(express.urlencoded({ extended: true, limit: '10mb' }));

  // Compression
  app.use(compression());

  // HTTP request logging
  app.use(morgan('combined', { stream: logger.stream }));

  // Request ID middleware
  app.use((req, res, next) => {
    req.id = `${Date.now()}-${Math.random().toString(36).substring(2, 11)}`;
    res.setHeader('X-Request-Id', req.id);
    next();
  });

  // Health check endpoint
  app.get('/health', (req, res) => {
    res.status(200).json({
      success: true,
      data: {
        service: 'video-service',
        status: 'healthy',
        timestamp: new Date().toISOString(),
        uptime: process.uptime(),
        version: process.env.npm_package_version || '1.0.0',
      },
    });
  });

  // API routes
  app.use('/api/videos', videoRoutes);
  app.use('/api/categories', categoryRoutes);

  // Handle undefined routes
  app.use(notFoundHandler);

  // Global error handler
  app.use(errorHandler);

  return app;
}

const app = createApp();

module.exports = { app, createApp };
