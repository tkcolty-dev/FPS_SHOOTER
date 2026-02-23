const express = require('express');
const pool = require('../config/db');
const auth = require('../middleware/auth');

const router = express.Router();
router.use(auth);

// Get meal history grouped by date (excludes today)
router.get('/history', async (req, res) => {
  try {
    const days = parseInt(req.query.days) || 7;
    const result = await pool.query(
      `SELECT * FROM meals WHERE user_id = $1
        AND logged_at::date >= CURRENT_DATE - $2::int
        AND logged_at::date < CURRENT_DATE
       ORDER BY logged_at DESC`,
      [req.userId, days]
    );
    res.json(result.rows);
  } catch (err) {
    console.error('Get meal history error:', err);
    res.status(500).json({ error: 'Server error' });
  }
});

// Get top foods by frequency
router.get('/top-foods', async (req, res) => {
  try {
    const days = parseInt(req.query.days) || 30;
    const result = await pool.query(
      `SELECT name, COUNT(*)::int as count, ROUND(AVG(calories))::int as avg_calories,
              SUM(calories)::int as total_calories
       FROM meals WHERE user_id = $1
        AND logged_at::date >= CURRENT_DATE - $2::int
       GROUP BY name ORDER BY count DESC LIMIT 10`,
      [req.userId, days]
    );
    res.json(result.rows);
  } catch (err) {
    console.error('Get top foods error:', err);
    res.status(500).json({ error: 'Server error' });
  }
});

// Get meals for a date
router.get('/', async (req, res) => {
  try {
    const { date } = req.query;
    let query, params;

    if (date) {
      query = `SELECT * FROM meals WHERE user_id = $1 AND logged_at::date = $2 ORDER BY logged_at`;
      params = [req.userId, date];
    } else {
      query = `SELECT * FROM meals WHERE user_id = $1 AND logged_at::date = CURRENT_DATE ORDER BY logged_at`;
      params = [req.userId];
    }

    const result = await pool.query(query, params);
    res.json(result.rows);
  } catch (err) {
    console.error('Get meals error:', err);
    res.status(500).json({ error: 'Server error' });
  }
});

// Create a meal
router.post('/', async (req, res) => {
  try {
    const { meal_type, name, calories, notes, logged_at } = req.body;
    if (!meal_type || !name || calories == null) {
      return res.status(400).json({ error: 'meal_type, name, and calories are required' });
    }

    const validTypes = ['breakfast', 'lunch', 'dinner', 'snack'];
    if (!validTypes.includes(meal_type)) {
      return res.status(400).json({ error: 'meal_type must be breakfast, lunch, dinner, or snack' });
    }

    const result = await pool.query(
      `INSERT INTO meals (user_id, meal_type, name, calories, notes, logged_at)
       VALUES ($1, $2, $3, $4, $5, $6)
       RETURNING *`,
      [req.userId, meal_type, name, parseInt(calories), notes || null, logged_at || new Date()]
    );
    res.status(201).json(result.rows[0]);
  } catch (err) {
    console.error('Create meal error:', err);
    res.status(500).json({ error: 'Server error' });
  }
});

// Update a meal
router.put('/:id', async (req, res) => {
  try {
    const { meal_type, name, calories, notes } = req.body;
    const result = await pool.query(
      `UPDATE meals SET meal_type = COALESCE($1, meal_type), name = COALESCE($2, name),
       calories = COALESCE($3, calories), notes = COALESCE($4, notes)
       WHERE id = $5 AND user_id = $6 RETURNING *`,
      [meal_type, name, calories != null ? parseInt(calories) : null, notes, req.params.id, req.userId]
    );
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Meal not found' });
    }
    res.json(result.rows[0]);
  } catch (err) {
    console.error('Update meal error:', err);
    res.status(500).json({ error: 'Server error' });
  }
});

// Delete a meal
router.delete('/:id', async (req, res) => {
  try {
    const result = await pool.query(
      'DELETE FROM meals WHERE id = $1 AND user_id = $2 RETURNING id',
      [req.params.id, req.userId]
    );
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Meal not found' });
    }
    res.json({ message: 'Meal deleted' });
  } catch (err) {
    console.error('Delete meal error:', err);
    res.status(500).json({ error: 'Server error' });
  }
});

module.exports = router;
