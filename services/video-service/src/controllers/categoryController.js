/**
 * @fileoverview Category controller - Handles category-related HTTP requests.
 */

const Category = require('../models/Category');
const redis = require('../config/redis');
const logger = require('../services/loggerService');

/**
 * Lists all categories in tree structure.
 * GET /api/categories
 *
 * @async
 */
async function list(req, res, next) {
  try {
    // Try cache
    let tree = await redis.getCategoryCache();
    if (!tree) {
      tree = await Category.getCategoryTree();
      await redis.setCategoryCache(tree);
    }

    return res.status(200).json({
      success: true,
      data: {
        categories: tree,
      },
    });
  } catch (err) {
    next(err);
  }
}

/**
 * Gets a category by ID with subcategories.
 * GET /api/categories/:id
 *
 * @async
 */
async function getById(req, res, next) {
  try {
    const { id } = req.params;
    const categoryId = parseInt(id, 10);

    if (isNaN(categoryId)) {
      return res.status(400).json({
        success: false,
        error: { code: 'INVALID_ID', message: 'Invalid category ID' },
      });
    }

    const category = await Category.getWithSubcategories(categoryId);

    if (!category) {
      return res.status(404).json({
        success: false,
        error: { code: 'CATEGORY_NOT_FOUND', message: 'Category not found' },
      });
    }

    return res.status(200).json({
      success: true,
      data: { category },
    });
  } catch (err) {
    next(err);
  }
}

/**
 * Gets a category by slug with subcategories.
 * GET /api/categories/slug/:slug
 *
 * @async
 */
async function getBySlug(req, res, next) {
  try {
    const { slug } = req.params;

    const category = await Category.findBySlug(slug);

    if (!category) {
      return res.status(404).json({
        success: false,
        error: { code: 'CATEGORY_NOT_FOUND', message: 'Category not found' },
      });
    }

    const categoryWithSubs = await Category.getWithSubcategories(category.id);

    return res.status(200).json({
      success: true,
      data: { category: categoryWithSubs },
    });
  } catch (err) {
    next(err);
  }
}

/**
 * Creates a new category.
 * POST /api/categories
 *
 * @async
 */
async function create(req, res, next) {
  try {
    const { name, slug, icon, parentId, sortOrder } = req.body;

    const category = await Category.create({
      name,
      slug,
      icon,
      parentId,
      sortOrder,
    });

    // Invalidate cache
    await redis.setCategoryCache(null, 0);

    return res.status(201).json({
      success: true,
      message: 'Category created',
      data: { category },
    });
  } catch (err) {
    if (err.code === 'DUPLICATE_KEY') {
      return res.status(409).json({
        success: false,
        error: { code: 'DUPLICATE_KEY', message: err.message },
      });
    }
    next(err);
  }
}

/**
 * Updates a category.
 * PUT /api/categories/:id
 *
 * @async
 */
async function update(req, res, next) {
  try {
    const { id } = req.params;
    const categoryId = parseInt(id, 10);
    const { name, slug, icon, parentId, sortOrder } = req.body;

    const updates = {};
    if (name !== undefined) updates.name = name;
    if (slug !== undefined) updates.slug = slug;
    if (icon !== undefined) updates.icon = icon;
    if (parentId !== undefined) updates.parentId = parentId;
    if (sortOrder !== undefined) updates.sortOrder = sortOrder;

    const category = await Category.update(categoryId, updates);

    if (!category) {
      return res.status(404).json({
        success: false,
        error: { code: 'CATEGORY_NOT_FOUND', message: 'Category not found' },
      });
    }

    // Invalidate cache
    await redis.setCategoryCache(null, 0);

    return res.status(200).json({
      success: true,
      message: 'Category updated',
      data: { category },
    });
  } catch (err) {
    next(err);
  }
}

/**
 * Deletes a category.
 * DELETE /api/categories/:id
 *
 * @async
 */
async function remove(req, res, next) {
  try {
    const { id } = req.params;
    const categoryId = parseInt(id, 10);

    const result = await Category.remove(categoryId);

    if (!result) {
      return res.status(404).json({
        success: false,
        error: { code: 'CATEGORY_NOT_FOUND', message: 'Category not found' },
      });
    }

    // Invalidate cache
    await redis.setCategoryCache(null, 0);

    return res.status(200).json({
      success: true,
      message: 'Category deleted',
    });
  } catch (err) {
    next(err);
  }
}

module.exports = {
  list,
  getById,
  getBySlug,
  create,
  update,
  remove,
};
