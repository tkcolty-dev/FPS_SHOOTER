const express = require('express');
const pool = require('../config/db');
const auth = require('../middleware/auth');

const router = express.Router();
router.use(auth);

router.get('/', async (req, res) => {
  try {
    const { q } = req.query;
    if (!q || q.trim().length === 0) {
      return res.json([]);
    }

    // Prefer ILIKE matches (simpler, more intuitive results)
    const result = await pool.query(
      `SELECT id, name, category, calories_per_serving, serving_size
       FROM food_database
       WHERE name ILIKE $1
       ORDER BY
         CASE WHEN name ILIKE $2 THEN 0 ELSE 1 END,
         length(name),
         name
       LIMIT 20`,
      [`%${q}%`, `${q}%`]
    );

    // Fallback to full-text search if ILIKE finds nothing
    if (result.rows.length === 0) {
      const fallback = await pool.query(
        `SELECT id, name, category, calories_per_serving, serving_size
         FROM food_database
         WHERE search_vector @@ plainto_tsquery('english', $1)
         ORDER BY ts_rank(search_vector, plainto_tsquery('english', $1)) DESC
         LIMIT 20`,
        [q]
      );
      return res.json(fallback.rows);
    }

    res.json(result.rows);
  } catch (err) {
    console.error('Food search error:', err);
    res.status(500).json({ error: 'Server error' });
  }
});

module.exports = router;
