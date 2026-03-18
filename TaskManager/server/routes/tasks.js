const express = require('express');
const router = express.Router();

module.exports = (pool) => {
  // Get all tasks
  router.get('/', async (req, res) => {
    try {
      const { status, category, date } = req.query;
      let q = 'SELECT * FROM tasks WHERE user_id = $1';
      const params = [req.userId];
      let idx = 2;

      if (status) { q += ` AND status = $${idx++}`; params.push(status); }
      if (category) { q += ` AND category = $${idx++}`; params.push(category); }
      if (date) { q += ` AND due_date::date = $${idx++}::date`; params.push(date); }

      q += ' ORDER BY CASE priority WHEN \'high\' THEN 1 WHEN \'medium\' THEN 2 ELSE 3 END, due_date ASC NULLS LAST';
      const result = await pool.query(q, params);
      res.json(result.rows);
    } catch (err) {
      console.error('Get tasks error:', err);
      res.status(500).json({ error: 'Server error' });
    }
  });

  // Create task
  router.post('/', async (req, res) => {
    try {
      const { title, description, category, priority, dueDate, dueTime } = req.body;
      if (!title) return res.status(400).json({ error: 'Title required' });

      const result = await pool.query(
        `INSERT INTO tasks (user_id, title, description, category, priority, due_date, due_time)
         VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING *`,
        [req.userId, title, description || null, category || 'general', priority || 'medium', dueDate || null, dueTime || null]
      );
      res.json(result.rows[0]);
    } catch (err) {
      console.error('Create task error:', err);
      res.status(500).json({ error: 'Server error' });
    }
  });

  // Update task
  router.put('/:id', async (req, res) => {
    try {
      const { title, description, category, priority, status, dueDate, dueTime } = req.body;
      const completedAt = status === 'completed' ? 'NOW()' : 'NULL';
      const result = await pool.query(
        `UPDATE tasks SET title = COALESCE($1, title), description = COALESCE($2, description),
         category = COALESCE($3, category), priority = COALESCE($4, priority),
         status = COALESCE($5, status), due_date = COALESCE($6, due_date), due_time = COALESCE($7, due_time),
         completed_at = ${completedAt}, updated_at = NOW()
         WHERE id = $8 AND user_id = $9 RETURNING *`,
        [title, description, category, priority, status, dueDate, dueTime, req.params.id, req.userId]
      );
      if (!result.rows.length) return res.status(404).json({ error: 'Task not found' });
      res.json(result.rows[0]);
    } catch (err) {
      console.error('Update task error:', err);
      res.status(500).json({ error: 'Server error' });
    }
  });

  // Delete task
  router.delete('/:id', async (req, res) => {
    try {
      const result = await pool.query('DELETE FROM tasks WHERE id = $1 AND user_id = $2 RETURNING id', [req.params.id, req.userId]);
      if (!result.rows.length) return res.status(404).json({ error: 'Task not found' });
      res.json({ ok: true });
    } catch (err) {
      res.status(500).json({ error: 'Server error' });
    }
  });

  // Get task stats
  router.get('/stats', async (req, res) => {
    try {
      const today = new Date().toISOString().slice(0, 10);
      const [total, completed, overdue, todayTasks] = await Promise.all([
        pool.query('SELECT COUNT(*) FROM tasks WHERE user_id = $1 AND status != $2', [req.userId, 'completed']),
        pool.query('SELECT COUNT(*) FROM tasks WHERE user_id = $1 AND status = $2 AND completed_at::date = $3::date', [req.userId, 'completed', today]),
        pool.query('SELECT COUNT(*) FROM tasks WHERE user_id = $1 AND status != $2 AND due_date < NOW()', [req.userId, 'completed']),
        pool.query('SELECT COUNT(*) FROM tasks WHERE user_id = $1 AND due_date::date = $2::date', [req.userId, today])
      ]);
      res.json({
        pending: parseInt(total.rows[0].count),
        completedToday: parseInt(completed.rows[0].count),
        overdue: parseInt(overdue.rows[0].count),
        today: parseInt(todayTasks.rows[0].count)
      });
    } catch (err) {
      res.status(500).json({ error: 'Server error' });
    }
  });

  return router;
};
