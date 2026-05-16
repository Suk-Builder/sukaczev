/**
 * @fileoverview Category model - Data access for video categories.
 */

const { query } = require('../config/db');
const logger = require('../services/loggerService');

/**
 * Gets all categories.
 *
 * @async
 * @returns {Promise<Array>} All categories
 */
async function getAll() {
  const sql = 'SELECT id, name, slug, icon, parent_id, sort_order, created_at FROM categories ORDER BY sort_order, name';
  const result = await query(sql);
  return result.rows;
}

/**
 * Gets category by ID.
 *
 * @async
 * @param {number} id - Category ID
 * @returns {Promise<Object|null>}
 */
async function findById(id) {
  const sql = 'SELECT id, name, slug, icon, parent_id, sort_order, created_at FROM categories WHERE id = $1';
  const result = await query(sql, [id]);
  return result.rows[0] || null;
}

/**
 * Gets category by slug.
 *
 * @async
 * @param {string} slug - Category slug
 * @returns {Promise<Object|null>}
 */
async function findBySlug(slug) {
  const sql = 'SELECT id, name, slug, icon, parent_id, sort_order, created_at FROM categories WHERE slug = $1';
  const result = await query(sql, [slug]);
  return result.rows[0] || null;
}

/**
 * Gets subcategories of a parent category.
 *
 * @async
 * @param {number} parentId - Parent category ID
 * @returns {Promise<Array>}
 */
async function getSubcategories(parentId) {
  const sql = `
    SELECT id, name, slug, icon, parent_id, sort_order, created_at
    FROM categories
    WHERE parent_id = $1
    ORDER BY sort_order, name
  `;
  const result = await query(sql, [parentId]);
  return result.rows;
}

/**
 * Gets category tree (parent -> children structure).
 *
 * @async
 * @returns {Promise<Array>} Category tree
 */
async function getCategoryTree() {
  const allCategories = await getAll();
  const categoryMap = new Map();
  const rootCategories = [];

  // Create map of all categories
  for (const cat of allCategories) {
    categoryMap.set(cat.id, { ...cat, children: [] });
  }

  // Build tree
  for (const cat of allCategories) {
    const node = categoryMap.get(cat.id);
    if (cat.parent_id && categoryMap.has(cat.parent_id)) {
      categoryMap.get(cat.parent_id).children.push(node);
    } else if (!cat.parent_id) {
      rootCategories.push(node);
    }
  }

  return rootCategories;
}

/**
 * Creates a new category.
 *
 * @async
 * @param {Object} categoryData - Category data
 * @returns {Promise<Object>}
 */
async function create(categoryData) {
  const { name, slug, icon, parentId, sortOrder } = categoryData;

  const sql = `
    INSERT INTO categories (name, slug, icon, parent_id, sort_order)
    VALUES ($1, $2, $3, $4, $5)
    RETURNING id, name, slug, icon, parent_id, sort_order, created_at
  `;

  try {
    const result = await query(sql, [name, slug, icon, parentId || null, sortOrder || 0]);
    logger.info('Category created', { categoryId: result.rows[0].id, name });
    return result.rows[0];
  } catch (err) {
    if (err.code === '23505') {
      const error = new Error('Category with this slug already exists');
      error.code = 'DUPLICATE_KEY';
      throw error;
    }
    throw err;
  }
}

/**
 * Updates a category.
 *
 * @async
 * @param {number} id - Category ID
 * @param {Object} updates - Fields to update
 * @returns {Promise<Object|null>}
 */
async function update(id, updates) {
  const setClauses = [];
  const values = [];
  let paramIndex = 1;

  for (const [key, value] of Object.entries(updates)) {
    if (value !== undefined) {
      const dbField = key.replace(/[A-Z]/g, (letter) => `_${letter.toLowerCase()}`);
      setClauses.push(`${dbField} = $${paramIndex}`);
      values.push(value);
      paramIndex++;
    }
  }

  if (setClauses.length === 0) return findById(id);

  const sql = `
    UPDATE categories
    SET ${setClauses.join(', ')}
    WHERE id = $${paramIndex}
    RETURNING id, name, slug, icon, parent_id, sort_order, created_at
  `;
  values.push(id);

  const result = await query(sql, values);
  return result.rows[0] || null;
}

/**
 * Deletes a category.
 *
 * @async
 * @param {number} id - Category ID
 * @returns {Promise<boolean>}
 */
async function remove(id) {
  const sql = 'DELETE FROM categories WHERE id = $1 RETURNING id';
  const result = await query(sql, [id]);
  return result.rowCount > 0;
}

/**
 * Gets category with subcategories.
 *
 * @async
 * @param {number} id - Category ID
 * @returns {Promise<Object|null>}
 */
async function getWithSubcategories(id) {
  const category = await findById(id);
  if (!category) return null;

  const children = await getSubcategories(id);
  return { ...category, children };
}

/**
 * Gets video count for a category.
 *
 * @async
 * @param {number} id - Category ID
 * @returns {Promise<number>}
 */
async function getVideoCount(id) {
  const sql = `
    SELECT COUNT(*) as count FROM videos
    WHERE category_id = $1 AND status = 'published'
  `;
  const result = await query(sql, [id]);
  return parseInt(result.rows[0].count, 10);
}

module.exports = {
  getAll,
  findById,
  findBySlug,
  getSubcategories,
  getCategoryTree,
  create,
  update,
  remove,
  getWithSubcategories,
  getVideoCount,
};
