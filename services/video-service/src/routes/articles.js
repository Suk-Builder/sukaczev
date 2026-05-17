const express = require('express');
const router = express.Router();
const { Pool } = require('pg');

const pool = new Pool({
  host: process.env.DB_HOST || '127.0.0.1',
  port: process.env.DB_PORT || 5432,
  database: process.env.DB_NAME || 'sukaczev',
  user: process.env.DB_USER || 'sukaczev',
  password: process.env.DB_PASSWORD || 'sukaczev416520',
});

router.get('/', async (req, res) => {
  try {
    const { page = 1, limit = 20, category } = req.query;
    const offset = (page - 1) * limit;

    let query = 'SELECT * FROM articles WHERE status = $1';
    let params = ['published'];
    let countQuery = 'SELECT COUNT(*) FROM articles WHERE status = $1';
    let countParams = ['published'];

    if (category) {
      query += ' AND category_id = $2';
      params.push(category);
      countQuery += ' AND category_id = $2';
      countParams.push(category);
    }

    query += ' ORDER BY created_at DESC LIMIT $' + (params.length + 1) + ' OFFSET $' + (params.length + 2);
    params.push(limit, offset);

    const articles = await pool.query(query, params);
    const countResult = await pool.query(countQuery, countParams);
    const total = parseInt(countResult.rows[0].count);

    res.json({
      success: true,
      data: {
        articles: articles.rows,
        pagination: {
          total,
          limit: parseInt(limit),
          hasMore: offset + articles.rows.length < total
        }
      }
    });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

router.get('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const result = await pool.query('SELECT * FROM articles WHERE id = $1', [id]);
    if (result.rows.length === 0) {
      return res.json({ success: false, message: 'Article not found' });
    }
    res.json({ success: true, data: { article: result.rows[0] } });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

module.exports = router;

