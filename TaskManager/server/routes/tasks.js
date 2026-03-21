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
      if (req.query.search) { q += ` AND (title ILIKE $${idx} OR description ILIKE $${idx})`; params.push(`%${req.query.search}%`); idx++; }

      q += ' ORDER BY pinned DESC NULLS LAST, sort_order ASC, CASE priority WHEN \'high\' THEN 1 WHEN \'medium\' THEN 2 ELSE 3 END, due_date ASC NULLS LAST, id ASC';
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
      const { title, description, category, priority, dueDate, dueTime, link, recurrence } = req.body;
      if (!title) return res.status(400).json({ error: 'Title required' });

      const result = await pool.query(
        `INSERT INTO tasks (user_id, title, description, category, priority, due_date, due_time, link, recurrence)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9) RETURNING *`,
        [req.userId, title, description || null, category || 'general', priority || 'medium', dueDate || null, dueTime || null, link || null, recurrence || 'none']
      );
      res.json(result.rows[0]);
    } catch (err) {
      console.error('Create task error:', err);
      res.status(500).json({ error: 'Server error' });
    }
  });

  // Bulk create tasks (from AI plans/checklists)
  router.post('/bulk', async (req, res) => {
    try {
      const { tasks } = req.body;
      if (!tasks || !tasks.length) return res.status(400).json({ error: 'Tasks required' });

      const created = [];
      for (const t of tasks) {
        if (!t.title) continue;
        const result = await pool.query(
          `INSERT INTO tasks (user_id, title, description, category, priority, due_date, due_time)
           VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING *`,
          [req.userId, t.title, t.description || null, t.category || 'general', t.priority || 'medium', t.dueDate || null, t.dueTime || null]
        );
        created.push(result.rows[0]);
      }
      res.json({ created: created.length, tasks: created });
    } catch (err) {
      console.error('Bulk create error:', err);
      res.status(500).json({ error: 'Server error' });
    }
  });

  // AI: convert script/text into checklist tasks
  router.post('/ai-checklist', async (req, res) => {
    try {
      const { script } = req.body;
      if (!script || !script.trim()) return res.status(400).json({ error: 'Script text required' });

      const { chatCompletion } = require('../services/ai');
      const raw = await chatCompletion([
        { role: 'system', content: `You break down scripts, instructions, recipes, processes, or any text into a clear checklist of actionable tasks. Return ONLY valid JSON — no markdown, no backticks, no explanation.

Format: { "tasks": [{ "title": "...", "priority": "high|medium|low", "category": "general|work|personal|health|shopping|errands" }] }

Rules:
- Each task title should be concise and actionable (start with a verb)
- Order tasks logically (sequential steps)
- Set priority based on importance/urgency within the script
- Pick the best category based on context
- Break complex steps into smaller sub-tasks when helpful
- Typically produce 3-15 tasks depending on script length` },
        { role: 'user', content: script }
      ], 2000);

      console.log('AI checklist raw:', raw?.slice(0, 200));
      if (!raw) return res.status(500).json({ error: 'AI returned empty response' });
      const jsonMatch = raw.match(/\{[\s\S]*\}/);
      if (!jsonMatch) return res.status(500).json({ error: 'AI returned invalid format: ' + raw.slice(0, 100) });
      const parsed = JSON.parse(jsonMatch[0]);
      if (!parsed.tasks || !Array.isArray(parsed.tasks)) return res.status(500).json({ error: 'AI did not return tasks array' });
      res.json(parsed);
    } catch (err) {
      console.error('AI checklist error:', err);
      res.status(500).json({ error: err.message || 'Failed to generate checklist' });
    }
  });

  // Reorder tasks (must be before /:id)
  router.put('/reorder', async (req, res) => {
    try {
      const { orderedIds } = req.body;
      if (!orderedIds?.length) return res.status(400).json({ error: 'orderedIds required' });
      for (let i = 0; i < orderedIds.length; i++) {
        await pool.query('UPDATE tasks SET sort_order = $1 WHERE id = $2 AND user_id = $3', [i, orderedIds[i], req.userId]);
      }
      res.json({ ok: true });
    } catch (err) { res.status(500).json({ error: 'Server error' }); }
  });

  // Update task
  router.put('/:id', async (req, res) => {
    try {
      const fields = [];
      const params = [];
      let idx = 1;
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
      if (req.body.dueDate !== undefined) add('due_date', req.body.dueDate || null);
      if (req.body.dueTime !== undefined) add('due_time', req.body.dueTime || null);
      if (req.body.link !== undefined) add('link', req.body.link || null);
      if (req.body.recurrence !== undefined) add('recurrence', req.body.recurrence || 'none');
      if (req.body.pinned !== undefined) add('pinned', req.body.pinned);
      if (req.body.sortOrder !== undefined) add('sort_order', req.body.sortOrder);
      if (req.body.timeSpent !== undefined) add('time_spent', req.body.timeSpent);
      add('updated_at', new Date());

      if (fields.length === 1) return res.status(400).json({ error: 'No fields to update' });

      params.push(req.params.id, req.userId);
      const result = await pool.query(
        `UPDATE tasks SET ${fields.join(', ')} WHERE id = $${idx++} AND user_id = $${idx} RETURNING *`,
        params
      );
      if (!result.rows.length) return res.status(404).json({ error: 'Task not found' });
      const task = result.rows[0];

      // Notify shared users when task status changes (completed or unchecked)
      if (req.body.status === 'completed' || req.body.status === 'pending') {
        try {
          const action = req.body.status === 'completed' ? 'completed' : 'unchecked';
          const me = await pool.query('SELECT display_name FROM users WHERE id = $1', [req.userId]);
          const myName = me.rows[0]?.display_name || 'Someone';

          // Find all users who have all-tasks sharing links from this owner
          const sharedLinks = await pool.query(
            'SELECT shared_with_id FROM shared_tasks WHERE owner_id = $1 AND task_id IS NULL',
            [req.userId]
          );
          // Also check per-task sharing
          const perTask = await pool.query('SELECT shared_with_id, owner_id FROM shared_tasks WHERE task_id = $1', [req.params.id]);

          const notifySet = new Set();
          for (const row of sharedLinks.rows) notifySet.add(row.shared_with_id);
          for (const row of perTask.rows) {
            const uid = row.owner_id === req.userId ? row.shared_with_id : row.owner_id;
            if (uid !== req.userId) notifySet.add(uid);
          }

          for (const uid of notifySet) {
            // Check if user has notify_shared enabled
            const pref = await pool.query('SELECT notify_shared FROM users WHERE id = $1', [uid]);
            if (pref.rows[0]?.notify_shared === false) continue;

            const title = action === 'completed' ? 'Shared Task Completed' : 'Shared Task Unchecked';
            const message = `${myName} ${action} "${task.title}"`;
            await pool.query(
              'INSERT INTO notifications (user_id, task_id, type, title, message) VALUES ($1, $2, $3, $4, $5)',
              [uid, task.id, 'shared_completed', title, message]
            );
            try {
              const { sendPushToUser } = require('./push');
              sendPushToUser(pool, uid, title, message, { url: '/tasks' });
            } catch {}
          }
        } catch (err) { console.error('Shared notification error:', err); }
      }

      res.json(task);
    } catch (err) {
      console.error('Update task error:', err);
      res.status(500).json({ error: 'Server error' });
    }
  });

  // Add time to task (atomic increment)
  router.post('/:id/timer', async (req, res) => {
    try {
      const { seconds } = req.body;
      const result = await pool.query(
        'UPDATE tasks SET time_spent = COALESCE(time_spent, 0) + $1 WHERE id = $2 AND user_id = $3 RETURNING *',
        [seconds, req.params.id, req.userId]
      );
      if (!result.rows.length) return res.status(404).json({ error: 'Task not found' });
      res.json(result.rows[0]);
    } catch (err) { res.status(500).json({ error: 'Server error' }); }
  });

  // Delete all completed tasks
  router.delete('/completed', async (req, res) => {
    try {
      const result = await pool.query('DELETE FROM tasks WHERE user_id = $1 AND status = $2 RETURNING id', [req.userId, 'completed']);
      res.json({ deleted: result.rowCount });
    } catch (err) {
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
        pool.query('SELECT COUNT(*) FROM tasks WHERE user_id = $1 AND status != $2 AND due_date::date < CURRENT_DATE', [req.userId, 'completed']),
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
