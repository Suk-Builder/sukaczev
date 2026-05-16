/**
 * @fileoverview Category routes - Defines category-related API endpoints.
 */

const express = require('express');
const router = express.Router();

const categoryController = require('../controllers/categoryController');
const { authenticate } = require('../middleware/auth');
const { asyncHandler } = require('../middleware/errorHandler');

/**
 * GET /api/categories
 * List all categories in tree structure.
 */
router.get('/', asyncHandler(categoryController.list));

/**
 * POST /api/categories
 * Create a new category.
 */
router.post('/', authenticate, asyncHandler(categoryController.create));

/**
 * GET /api/categories/:id
 * Get a category by ID with subcategories.
 */
router.get('/:id', asyncHandler(categoryController.getById));

/**
 * PUT /api/categories/:id
 * Update a category.
 */
router.put('/:id', authenticate, asyncHandler(categoryController.update));

/**
 * DELETE /api/categories/:id
 * Delete a category.
 */
router.delete('/:id', authenticate, asyncHandler(categoryController.remove));

module.exports = router;
