const express = require('express');
const {
  search,
  suggest,
  trending,
  indexVideo,
  bulkIndex,
  deleteVideo,
  getVideo,
  updateStats,
  createIndex,
  searchValidation,
  suggestValidation,
} = require('../controllers/searchController');
const { authenticate, requireAuth } = require('../middleware/auth');
const { rateLimiter } = require('../middleware/rateLimiter');

const router = express.Router();

// Search endpoints
router.get('/search', rateLimiter('search'), searchValidation, search);
router.get('/search/suggest', rateLimiter('suggest'), suggestValidation, suggest);
router.get('/search/trending', trending);

// Index management (protected)
router.post('/search/index', authenticate, requireAuth, indexVideo);
router.post('/search/bulk-index', authenticate, requireAuth, bulkIndex);
router.delete('/search/index/:id', authenticate, requireAuth, deleteVideo);
router.get('/search/index/:id', authenticate, getVideo);
router.put('/search/index/:id/stats', authenticate, updateStats);
router.post('/search/setup-index', authenticate, createIndex);

module.exports = router;
