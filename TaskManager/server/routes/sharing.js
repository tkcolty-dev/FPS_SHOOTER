const express = require('express');
const router = express.Router();

module.exports = (pool) => {
  // Link accounts - share all tasks with a user
  // permission: 'view' = read only, 'operator' = can edit/complete/delete
  router.post('/link', async (req, res) => {
    try {
      const { username, permission, shareBack } = req.body;
      if (!username) return res.status(400).json({ error: 'Username required' });

      const target = await pool.query('SELECT id, display_name, username FROM users WHERE username = $1', [username.toLowerCase()]);
      if (!target.rows.length) return res.status(404).json({ error: 'User not found' });
      if (target.rows[0].id === req.userId) return res.status(400).json({ error: 'Cannot link with yourself' });

      const existing = await pool.query(
        'SELECT id FROM shared_tasks WHERE owner_id = $1 AND shared_with_id = $2 AND task_id IS NULL',
        [req.userId, target.rows[0].id]
      );
      if (existing.rows.length) return res.status(400).json({ error: 'Already linked with this user' });

      const perm = permission === 'operator' ? 'operator' : 'view';

      // Share my tasks with them
      await pool.query(
        'INSERT INTO shared_tasks (task_id, owner_id, shared_with_id, permission) VALUES (NULL, $1, $2, $3)',
        [req.userId, target.rows[0].id, perm]
      );

      // If shareBack, also share their tasks with me (view by default)
      if (shareBack) {
        const reverseExists = await pool.query(
          'SELECT id FROM shared_tasks WHERE owner_id = $1 AND shared_with_id = $2 AND task_id IS NULL',
          [target.rows[0].id, req.userId]
        );
        if (!reverseExists.rows.length) {
          await pool.query(
            'INSERT INTO shared_tasks (task_id, owner_id, shared_with_id, permission) VALUES (NULL, $1, $2, $3)',
            [target.rows[0].id, req.userId, 'view']
          );
        }
      }

      const owner = await pool.query('SELECT display_name FROM users WHERE id = $1', [req.userId]);
      await pool.query(
        'INSERT INTO notifications (user_id, type, title, message) VALUES ($1, $2, $3, $4)',
        [target.rows[0].id, 'shared', 'Tasks Shared With You',
         `${owner.rows[0]?.display_name || 'Someone'} is now sharing their tasks with you${perm === 'operator' ? ' (operator access)' : ''}`]
      );

      res.json({ ok: true, partner: { id: target.rows[0].id, displayName: target.rows[0].display_name, username: target.rows[0].username, permission: perm } });
    } catch (err) {
      console.error('Link error:', err);
      res.status(500).json({ error: 'Server error' });
    }
  });

  // Update partner permission
  router.put('/:id/permission', async (req, res) => {
    try {
      const { permission } = req.body;
      await pool.query(
        'UPDATE shared_tasks SET permission = $1 WHERE id = $2 AND owner_id = $3',
        [permission, req.params.id, req.userId]
      );
      res.json({ ok: true });
    } catch (err) { res.status(500).json({ error: 'Server error' }); }
  });

  // Get my sharing partners (people I share WITH)
  router.get('/partners', async (req, res) => {
    try {
      const result = await pool.query(
        `SELECT st.id, st.permission, u.id as user_id, u.username, u.display_name
         FROM shared_tasks st JOIN users u ON u.id = st.shared_with_id
         WHERE st.owner_id = $1 AND st.task_id IS NULL`,
        [req.userId]
      );
      res.json(result.rows);
    } catch (err) { res.status(500).json({ error: 'Server error' }); }
  });

  // Get tasks from people who shared with me + my permission level
  router.get('/with-me', async (req, res) => {
    try {
      const links = await pool.query(
        'SELECT owner_id, permission FROM shared_tasks WHERE shared_with_id = $1 AND task_id IS NULL',
        [req.userId]
      );
      if (!links.rows.length) return res.json({ tasks: [], permissions: {} });

      const ownerIds = links.rows.map(r => r.owner_id);
      const permissions = {};
      links.rows.forEach(r => { permissions[r.owner_id] = r.permission; });

      const result = await pool.query(
        `SELECT t.*, u.display_name as owner_name, u.username as owner_username
         FROM tasks t JOIN users u ON u.id = t.user_id
         WHERE t.user_id = ANY($1)
         ORDER BY t.pinned DESC NULLS LAST, t.due_date ASC NULLS LAST`,
        [ownerIds]
      );
      res.json({ tasks: result.rows, permissions });
    } catch (err) { res.status(500).json({ error: 'Server error' }); }
  });

  // Operate on a shared task (toggle/edit/delete) - requires operator permission
  router.put('/task/:taskId', async (req, res) => {
    try {
      // Find whose task this is
      const task = await pool.query('SELECT user_id, title FROM tasks WHERE id = $1', [req.params.taskId]);
      if (!task.rows.length) return res.status(404).json({ error: 'Task not found' });
      const ownerId = task.rows[0].user_id;

      // Check I have operator permission
      const link = await pool.query(
        'SELECT permission FROM shared_tasks WHERE owner_id = $1 AND shared_with_id = $2 AND task_id IS NULL',
        [ownerId, req.userId]
      );
      if (!link.rows.length || link.rows[0].permission !== 'operator') {
        return res.status(403).json({ error: 'No operator permission' });
      }

      // Build update
      const fields = []; const params = []; let idx = 1;
      const add = (col, val) => { fields.push(`${col} = $${idx++}`); params.push(val); };

      if (req.body.title !== undefined) add('title', req.body.title);
      if (req.body.description !== undefined) add('description', req.body.description || null);
      if (req.body.category !== undefined) add('category', req.body.category);
      if (req.body.priority !== undefined) add('priority', req.body.priority);
      if (req.body.status !== undefined) {
        add('status', req.body.status);
        if (req.body.status === 'completed') add('completed_at', new Date());
        else if (req.body.status === 'pending') add('completed_at', null);
      }
      if (req.body.pinned !== undefined) add('pinned', req.body.pinned);
      add('updated_at', new Date());

      params.push(req.params.taskId);
      const result = await pool.query(
        `UPDATE tasks SET ${fields.join(', ')} WHERE id = $${idx} RETURNING *`, params
      );

      // Notify the owner
      const me = await pool.query('SELECT display_name FROM users WHERE id = $1', [req.userId]);
      const myName = me.rows[0]?.display_name || 'Someone';
      const action = req.body.status === 'completed' ? 'completed' : req.body.status === 'pending' ? 'unchecked' : 'updated';
      await pool.query(
        'INSERT INTO notifications (user_id, task_id, type, title, message) VALUES ($1, $2, $3, $4, $5)',
        [ownerId, parseInt(req.params.taskId), 'shared_completed', 'Shared Task ' + action.charAt(0).toUpperCase() + action.slice(1),
         `${myName} ${action} "${task.rows[0].title}"`]
      );

      // Push notification
      try {
        const { sendPushToUser } = require('./push');
        sendPushToUser(pool, ownerId, 'Shared Task ' + action.charAt(0).toUpperCase() + action.slice(1),
          `${myName} ${action} "${task.rows[0].title}"`, { url: '/tasks' });
      } catch {}

      res.json(result.rows[0]);
    } catch (err) {
      console.error('Shared task update error:', err);
      res.status(500).json({ error: 'Server error' });
    }
  });

  // Delete a shared task (requires operator)
  router.delete('/task/:taskId', async (req, res) => {
    try {
      const task = await pool.query('SELECT user_id, title FROM tasks WHERE id = $1', [req.params.taskId]);
      if (!task.rows.length) return res.status(404).json({ error: 'Task not found' });

      const link = await pool.query(
        'SELECT permission FROM shared_tasks WHERE owner_id = $1 AND shared_with_id = $2 AND task_id IS NULL',
        [task.rows[0].user_id, req.userId]
      );
      if (!link.rows.length || link.rows[0].permission !== 'operator') {
        return res.status(403).json({ error: 'No operator permission' });
      }

      await pool.query('DELETE FROM tasks WHERE id = $1', [req.params.taskId]);

      const me = await pool.query('SELECT display_name FROM users WHERE id = $1', [req.userId]);
      await pool.query(
        'INSERT INTO notifications (user_id, type, title, message) VALUES ($1, $2, $3, $4)',
        [task.rows[0].user_id, 'shared_completed', 'Shared Task Deleted',
         `${me.rows[0]?.display_name || 'Someone'} deleted "${task.rows[0].title}"`]
      );
      try {
        const { sendPushToUser } = require('./push');
        sendPushToUser(pool, task.rows[0].user_id, 'Shared Task Deleted',
          `${me.rows[0]?.display_name || 'Someone'} deleted "${task.rows[0].title}"`, { url: '/tasks' });
      } catch {}

      res.json({ ok: true });
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
