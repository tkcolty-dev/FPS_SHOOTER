const express = require('express');
const router = express.Router();

module.exports = (pool) => {
  // Get notifications
  router.get('/', async (req, res) => {
    try {
      const result = await pool.query(
        'SELECT * FROM notifications WHERE user_id = $1 ORDER BY created_at DESC LIMIT 50',
        [req.userId]
      );
      res.json(result.rows);
    } catch (err) {
      res.status(500).json({ error: 'Server error' });
    }
  });

  // Get unread count
  router.get('/unread', async (req, res) => {
    try {
      const result = await pool.query(
        'SELECT COUNT(*) FROM notifications WHERE user_id = $1 AND read = false',
        [req.userId]
      );
      res.json({ count: parseInt(result.rows[0].count) });
    } catch (err) {
      res.status(500).json({ error: 'Server error' });
    }
  });

  // Mark as read
  router.put('/:id/read', async (req, res) => {
    try {
      await pool.query('UPDATE notifications SET read = true WHERE id = $1 AND user_id = $2', [req.params.id, req.userId]);
      res.json({ ok: true });
    } catch (err) {
      res.status(500).json({ error: 'Server error' });
    }
  });

  // Mark all as read
  router.put('/read-all', async (req, res) => {
    try {
      await pool.query('UPDATE notifications SET read = true WHERE user_id = $1', [req.userId]);
      res.json({ ok: true });
    } catch (err) {
      res.status(500).json({ error: 'Server error' });
    }
  });

  // Delete notification
  router.delete('/:id', async (req, res) => {
    try {
      await pool.query('DELETE FROM notifications WHERE id = $1 AND user_id = $2', [req.params.id, req.userId]);
      res.json({ ok: true });
    } catch (err) {
      res.status(500).json({ error: 'Server error' });
    }
  });

  // Clear all notifications
  router.delete('/', async (req, res) => {
    try {
      const result = await pool.query('DELETE FROM notifications WHERE user_id = $1', [req.userId]);
      res.json({ ok: true, deleted: result.rowCount });
    } catch (err) {
      res.status(500).json({ error: 'Server error' });
    }
  });

  return router;
};
