const express = require('express');
const pool = require('../config/db');
const auth = require('../middleware/auth');

const router = express.Router();
router.use(auth);

// Get all custom meals for user
router.get('/', async (req, res) => {
  try {
    const result = await pool.query(
      'SELECT * FROM custom_meals WHERE user_id = $1 ORDER BY created_at DESC',
      [req.userId]
    );
    res.json(result.rows);
  } catch (err) {
    console.error('Get custom meals error:', err);
    res.status(500).json({ error: 'Server error' });
  }
});

// Create a custom meal
router.post('/', async (req, res) => {
  try {
    const { name, meal_type, calories, ingredients, notes } = req.body;
    if (!name || !meal_type || calories == null) {
      return res.status(400).json({ error: 'name, meal_type, and calories are required' });
    }
    const result = await pool.query(
      `INSERT INTO custom_meals (user_id, name, meal_type, calories, ingredients, notes)
       VALUES ($1, $2, $3, $4, $5, $6) RETURNING *`,
      [req.userId, name, meal_type, parseInt(calories), ingredients || null, notes || null]
    );
    res.status(201).json(result.rows[0]);
  } catch (err) {
    console.error('Create custom meal error:', err);
    res.status(500).json({ error: 'Server error' });
  }
});

// Update a custom meal
router.put('/:id', async (req, res) => {
  try {
    const { name, meal_type, calories, ingredients, notes } = req.body;
    const result = await pool.query(
      `UPDATE custom_meals SET name = COALESCE($1, name), meal_type = COALESCE($2, meal_type),
       calories = COALESCE($3, calories), ingredients = COALESCE($4, ingredients), notes = COALESCE($5, notes)
       WHERE id = $6 AND user_id = $7 RETURNING *`,
      [name, meal_type, calories != null ? parseInt(calories) : null, ingredients, notes, req.params.id, req.userId]
    );
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Custom meal not found' });
    }
    res.json(result.rows[0]);
  } catch (err) {
    console.error('Update custom meal error:', err);
    res.status(500).json({ error: 'Server error' });
  }
});

// Delete a custom meal
router.delete('/:id', async (req, res) => {
  try {
    const result = await pool.query(
      'DELETE FROM custom_meals WHERE id = $1 AND user_id = $2 RETURNING id',
      [req.params.id, req.userId]
    );
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Custom meal not found' });
    }
    res.json({ message: 'Custom meal deleted' });
  } catch (err) {
    console.error('Delete custom meal error:', err);
    res.status(500).json({ error: 'Server error' });
  }
});

module.exports = router;
