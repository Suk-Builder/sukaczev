const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');
const config = require('./config');
const logger = require('./utils/logger');
const searchRoutes = require('./routes/searchRoutes');
const { errorHandler, notFoundHandler } = require('./middleware/errorHandler');

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

  // Check Elasticsearch connectivity
  try {
    const { getEsClient } = require('./config/elasticsearch');
    const esClient = getEsClient();
    await esClient.ping();
    health.elasticsearch = 'connected';
  } catch (error) {
    health.elasticsearch = 'disconnected';
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

  // Only return 503 if critical dependency (Redis) is down; ES is optional
  const statusCode = health.redis === 'connected' ? 200 : 503;
  res.status(statusCode).json(health);
});

// API routes
app.use('/api', searchRoutes);

// Root endpoint
app.get('/', (req, res) => {
  res.json({
    service: config.app.name,
    version: '1.0.0',
    description: 'Sukačev Search Service - Full-text search powered by Elasticsearch',
    endpoints: {
      search: 'GET /api/search?q=keyword&sort=relevance&page=1',
      suggest: 'GET /api/search/suggest?q=partial',
      trending: 'GET /api/search/trending',
      index: 'POST /api/search/index',
      delete: 'DELETE /api/search/index/:id',
    },
    timestamp: new Date().toISOString(),
  });
});

// Error handling
app.use(notFoundHandler);
app.use(errorHandler);

module.exports = app;
