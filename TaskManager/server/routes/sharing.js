const express = require('express');
const router = express.Router();

module.exports = (pool) => {
  // Link accounts - share all tasks with a user
  router.post('/link', async (req, res) => {
    try {
      const { username } = req.body;
      if (!username) return res.status(400).json({ error: 'Username required' });

      const target = await pool.query('SELECT id, display_name, username FROM users WHERE username = $1', [username.toLowerCase()]);
      if (!target.rows.length) return res.status(404).json({ error: 'User not found' });
      if (target.rows[0].id === req.userId) return res.status(400).json({ error: 'Cannot link with yourself' });

      // Create bidirectional link using shared_tasks with task_id = 0 as a "link" marker
      await pool.query(
        `INSERT INTO shared_tasks (task_id, owner_id, shared_with_id, permission)
         VALUES (0, $1, $2, 'full') ON CONFLICT DO NOTHING`,
        [req.userId, target.rows[0].id]
      );

      // Notify them
      const owner = await pool.query('SELECT display_name FROM users WHERE id = $1', [req.userId]);
      await pool.query(
        'INSERT INTO notifications (user_id, type, title, message) VALUES ($1, $2, $3, $4)',
        [target.rows[0].id, 'shared', 'Tasks Shared With You',
         `${owner.rows[0]?.display_name || 'Someone'} is now sharing their tasks with you`]
      );

      res.json({ ok: true, partner: { id: target.rows[0].id, displayName: target.rows[0].display_name, username: target.rows[0].username } });
    } catch (err) {
      console.error('Link error:', err);
      res.status(500).json({ error: 'Server error' });
    }
  });

  // Get my sharing partners
  router.get('/partners', async (req, res) => {
    try {
      const result = await pool.query(
        `SELECT st.id, u.id as user_id, u.username, u.display_name
         FROM shared_tasks st JOIN users u ON u.id = st.shared_with_id
         WHERE st.owner_id = $1 AND st.task_id = 0`,
        [req.userId]
      );
      res.json(result.rows);
    } catch (err) { res.status(500).json({ error: 'Server error' }); }
  });

  // Get tasks from people who shared with me
  router.get('/with-me', async (req, res) => {
    try {
      // Find users who linked with me (shared their tasks)
      const links = await pool.query(
        'SELECT owner_id FROM shared_tasks WHERE shared_with_id = $1 AND task_id = 0',
        [req.userId]
      );
      if (!links.rows.length) return res.json([]);

      const ownerIds = links.rows.map(r => r.owner_id);
      const result = await pool.query(
        `SELECT t.*, u.display_name as owner_name, u.username as owner_username
         FROM tasks t JOIN users u ON u.id = t.user_id
         WHERE t.user_id = ANY($1)
         ORDER BY t.pinned DESC NULLS LAST, t.due_date ASC NULLS LAST`,
        [ownerIds]
      );
      res.json(result.rows);
    } catch (err) { res.status(500).json({ error: 'Server error' }); }
  });

  // Unlink a partner
  router.delete('/:id', async (req, res) => {
    try {
      await pool.query(
        'DELETE FROM shared_tasks WHERE id = $1 AND owner_id = $2',
        [req.params.id, req.userId]
      );
      res.json({ ok: true });
    } catch (err) { res.status(500).json({ error: 'Server error' }); }
  });

  return router;
};
