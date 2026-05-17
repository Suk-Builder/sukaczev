const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const compression = require('compression');
const rateLimit = require('express-rate-limit');
const danmakuRoutes = require('./routes/danmakuRoutes');
const { errorHandler } = require('./middleware/errorHandler');
const logger = require('./utils/logger');

const app = express();

// Security middleware
app.use(helmet({
  contentSecurityPolicy: false,
  crossOriginEmbedderPolicy: false
}));

app.use(cors({
  origin: ['https://sukaczev.top', 'https://www.sukaczev.top', 'http://sukaczev.top'],
  credentials: true
}));

app.use(compression());

// Rate limiting
const limiter = rateLimit({
  windowMs: parseInt(process.env.RATE_LIMIT_WINDOW_MS, 10) || 60000,
  max: parseInt(process.env.RATE_LIMIT_MAX, 10) || 300,
  message: { error: 'Too many requests, please try again later' },
  standardHeaders: true,
  legacyHeaders: false
});
app.use(limiter);

// Body parsing
app.use(express.json({ limit: '10kb' }));
app.use(express.urlencoded({ extended: true, limit: '10kb' }));

// Request logging
app.use((req, res, next) => {
  req.id = `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  logger.info(`${req.method} ${req.path} - ${req.id}`);
  next();
});

// Health check
app.get('/health', (req, res) => {
  res.status(200).json({
    status: 'ok',
    service: 'danmaku-service',
    timestamp: new Date().toISOString(),
    uptime: process.uptime()
  });
});

// API routes
app.use('/api/danmakus', danmakuRoutes);

// Root endpoint
app.get('/', (req, res) => {
  res.json({
    service: 'danmaku-service',
    version: '1.0.0',
    description: 'Real-time danmaku (bullet comment) service for Sukačev'
  });
});

// 404 handler
app.use((req, res) => {
  res.status(404).json({ error: 'Not Found', path: req.path });
});

// Global error handler
app.use(errorHandler);

module.exports = app;
