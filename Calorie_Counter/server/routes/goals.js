const express = require('express');
const pool = require('../config/db');
const auth = require('../middleware/auth');

const router = express.Router();
router.use(auth);

router.get('/', async (req, res) => {
  try {
    const result = await pool.query(
      'SELECT * FROM calorie_goals WHERE user_id = $1',
      [req.userId]
    );
    if (result.rows.length === 0) {
      return res.json({ daily_total: 2000, breakfast: null, lunch: null, dinner: null, snacks: null });
    }
    res.json(result.rows[0]);
  } catch (err) {
    console.error('Get goals error:', err);
    res.status(500).json({ error: 'Server error' });
  }
});

router.put('/', async (req, res) => {
  try {
    const { daily_total, breakfast, lunch, dinner, snacks } = req.body;
    if (!daily_total || daily_total < 0) {
      return res.status(400).json({ error: 'daily_total is required and must be positive' });
    }

    const result = await pool.query(
      `INSERT INTO calorie_goals (user_id, daily_total, breakfast, lunch, dinner, snacks)
       VALUES ($1, $2, $3, $4, $5, $6)
       ON CONFLICT (user_id)
       DO UPDATE SET daily_total = $2, breakfast = $3, lunch = $4, dinner = $5, snacks = $6
       RETURNING *`,
      [req.userId, daily_total, breakfast || null, lunch || null, dinner || null, snacks || null]
    );
    res.json(result.rows[0]);
  } catch (err) {
    console.error('Update goals error:', err);
    res.status(500).json({ error: 'Server error' });
  }
});

module.exports = router;
