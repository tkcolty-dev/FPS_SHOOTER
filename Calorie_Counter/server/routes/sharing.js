const express = require('express');
const pool = require('../config/db');
const auth = require('../middleware/auth');

const router = express.Router();
router.use(auth);

// List who you share with + who shares with you
router.get('/', async (req, res) => {
  try {
    const sharing = await pool.query(
      `SELECT s.id, s.viewer_id, u.username as viewer_username, u.email as viewer_email, s.created_at
       FROM shares s JOIN users u ON s.viewer_id = u.id
       WHERE s.owner_id = $1`,
      [req.userId]
    );

    const sharedWithMe = await pool.query(
      `SELECT s.id, s.owner_id, u.username as owner_username, u.email as owner_email, s.created_at
       FROM shares s JOIN users u ON s.owner_id = u.id
       WHERE s.viewer_id = $1`,
      [req.userId]
    );

    res.json({
      sharing: sharing.rows,
      sharedWithMe: sharedWithMe.rows,
    });
  } catch (err) {
    console.error('Get sharing error:', err);
    res.status(500).json({ error: 'Server error' });
  }
});

// Grant access to a user
router.post('/', async (req, res) => {
  try {
    const { viewer_username } = req.body;
    if (!viewer_username) {
      return res.status(400).json({ error: 'viewer_username is required' });
    }

    const userResult = await pool.query(
      'SELECT id FROM users WHERE username = $1',
      [viewer_username]
    );
    if (userResult.rows.length === 0) {
      return res.status(404).json({ error: 'User not found' });
    }

    const viewerId = userResult.rows[0].id;
    if (viewerId === req.userId) {
      return res.status(400).json({ error: 'Cannot share with yourself' });
    }

    const result = await pool.query(
      `INSERT INTO shares (owner_id, viewer_id)
       VALUES ($1, $2)
       ON CONFLICT (owner_id, viewer_id) DO NOTHING
       RETURNING *`,
      [req.userId, viewerId]
    );

    if (result.rows.length === 0) {
      return res.status(409).json({ error: 'Already sharing with this user' });
    }

    res.status(201).json(result.rows[0]);
  } catch (err) {
    console.error('Create share error:', err);
    res.status(500).json({ error: 'Server error' });
  }
});

// Revoke access
router.delete('/:id', async (req, res) => {
  try {
    const result = await pool.query(
      'DELETE FROM shares WHERE id = $1 AND owner_id = $2 RETURNING id',
      [req.params.id, req.userId]
    );
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Share not found' });
    }
    res.json({ message: 'Share revoked' });
  } catch (err) {
    console.error('Delete share error:', err);
    res.status(500).json({ error: 'Server error' });
  }
});

// View shared user's meals
router.get('/:userId/meals', async (req, res) => {
  try {
    // Verify the current user has access
    const access = await pool.query(
      'SELECT id FROM shares WHERE owner_id = $1 AND viewer_id = $2',
      [req.params.userId, req.userId]
    );
    if (access.rows.length === 0) {
      return res.status(403).json({ error: 'Access denied' });
    }

    const { date } = req.query;
    let query, params;
    if (date) {
      query = `SELECT m.*, u.username FROM meals m JOIN users u ON m.user_id = u.id
               WHERE m.user_id = $1 AND m.logged_at::date = $2 ORDER BY m.logged_at`;
      params = [req.params.userId, date];
    } else {
      query = `SELECT m.*, u.username FROM meals m JOIN users u ON m.user_id = u.id
               WHERE m.user_id = $1 AND m.logged_at::date = CURRENT_DATE ORDER BY m.logged_at`;
      params = [req.params.userId];
    }

    const result = await pool.query(query, params);

    // Also get their goals for context
    const goalsResult = await pool.query(
      'SELECT daily_total FROM calorie_goals WHERE user_id = $1',
      [req.params.userId]
    );

    res.json({
      meals: result.rows,
      goals: goalsResult.rows[0] || { daily_total: 2000 },
    });
  } catch (err) {
    console.error('View shared meals error:', err);
    res.status(500).json({ error: 'Server error' });
  }
});

module.exports = router;
