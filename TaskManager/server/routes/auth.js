const express = require('express');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const router = express.Router();

const JWT_SECRET = process.env.JWT_SECRET || 'dev-secret';
const { checkContent } = require('../services/moderation');

module.exports = (pool, auth) => {
  // Register (public)
  router.post('/register', async (req, res) => {
    try {
      const { username, password, displayName } = req.body;
      if (!username || !password) return res.status(400).json({ error: 'Username and password required' });
      if (username.length < 3) return res.status(400).json({ error: 'Username must be at least 3 characters' });
      if (password.length < 4) return res.status(400).json({ error: 'Password must be at least 4 characters' });

      const usernameCheck = checkContent(username);
      if (!usernameCheck.clean) return res.status(400).json({ error: 'Username contains inappropriate language. Please choose a different one.' });
      if (displayName) {
        const nameCheck = checkContent(displayName);
        if (!nameCheck.clean) return res.status(400).json({ error: 'Display name contains inappropriate language. Please choose a different one.' });
      }

      const exists = await pool.query('SELECT id FROM users WHERE username = $1', [username.toLowerCase()]);
      if (exists.rows.length) return res.status(409).json({ error: 'Username taken' });

      const hash = await bcrypt.hash(password, 10);
      const result = await pool.query(
        'INSERT INTO users (username, password_hash, display_name) VALUES ($1, $2, $3) RETURNING id, username, display_name',
        [username.toLowerCase(), hash, displayName || username]
      );
      const user = result.rows[0];
      const token = jwt.sign({ id: user.id, username: user.username }, JWT_SECRET, { expiresIn: '30d' });
      res.json({ token, user: { id: user.id, username: user.username, displayName: user.display_name } });
    } catch (err) {
      console.error('Register error:', err);
      res.status(500).json({ error: 'Server error' });
    }
  });

  // Login (public)
  router.post('/login', async (req, res) => {
    try {
      const { username, password } = req.body;
      if (!username || !password) return res.status(400).json({ error: 'Username and password required' });

      const result = await pool.query('SELECT * FROM users WHERE username = $1', [username.toLowerCase()]);
      if (!result.rows.length) return res.status(401).json({ error: 'Invalid credentials' });

      const user = result.rows[0];
      const valid = await bcrypt.compare(password, user.password_hash);
      if (!valid) return res.status(401).json({ error: 'Invalid credentials' });

      const token = jwt.sign({ id: user.id, username: user.username }, JWT_SECRET, { expiresIn: '30d' });
      res.json({
        token,
        user: {
          id: user.id, username: user.username, displayName: user.display_name,
          theme: user.theme, notifyOverdue: user.notify_overdue,
          notifyUpcoming: user.notify_upcoming, notifyBeforeMinutes: user.notify_before_minutes
        }
      });
    } catch (err) {
      console.error('Login error:', err);
      res.status(500).json({ error: 'Server error' });
    }
  });

  // Get profile (protected)
  router.get('/me', auth, async (req, res) => {
    try {
      const result = await pool.query(
        'SELECT id, username, display_name, theme, notify_overdue, notify_upcoming, notify_before_minutes, notify_shared, show_time_completed, confirm_before_delete, default_view, show_task_count, auto_clear_completed, auto_clear_hours, compact_mode, created_at FROM users WHERE id = $1',
        [req.userId]
      );
      if (!result.rows.length) return res.status(404).json({ error: 'User not found' });
      const u = result.rows[0];
      res.json({
        id: u.id, username: u.username, displayName: u.display_name,
        theme: u.theme, notifyOverdue: u.notify_overdue, notifyUpcoming: u.notify_upcoming,
        notifyBeforeMinutes: u.notify_before_minutes, notifyShared: u.notify_shared,
        showTimeCompleted: u.show_time_completed, confirmBeforeDelete: u.confirm_before_delete,
        defaultView: u.default_view, showTaskCount: u.show_task_count,
        autoClearCompleted: u.auto_clear_completed, autoClearHours: u.auto_clear_hours,
        compactMode: u.compact_mode, createdAt: u.created_at
      });
    } catch (err) {
      res.status(500).json({ error: 'Server error' });
    }
  });

  // Update profile (protected)
  router.put('/me', auth, async (req, res) => {
    try {
      const { displayName, theme, notifyOverdue, notifyUpcoming, notifyBeforeMinutes, notifyShared, showTimeCompleted, confirmBeforeDelete, defaultView, showTaskCount, autoClearCompleted, autoClearHours, compactMode } = req.body;
      if (displayName) {
        const nameCheck = checkContent(displayName);
        if (!nameCheck.clean) return res.status(400).json({ error: 'Display name contains inappropriate language.' });
      }
      await pool.query(
        `UPDATE users SET display_name = COALESCE($1, display_name), theme = COALESCE($2, theme),
         notify_overdue = COALESCE($3, notify_overdue), notify_upcoming = COALESCE($4, notify_upcoming),
         notify_before_minutes = COALESCE($5, notify_before_minutes), notify_shared = COALESCE($6, notify_shared),
         show_time_completed = COALESCE($7, show_time_completed), confirm_before_delete = COALESCE($8, confirm_before_delete),
         default_view = COALESCE($9, default_view), show_task_count = COALESCE($10, show_task_count),
         auto_clear_completed = COALESCE($11, auto_clear_completed),
         auto_clear_hours = COALESCE($12, auto_clear_hours),
         compact_mode = COALESCE($13, compact_mode) WHERE id = $14`,
        [displayName, theme, notifyOverdue, notifyUpcoming, notifyBeforeMinutes, notifyShared, showTimeCompleted, confirmBeforeDelete, defaultView, showTaskCount, autoClearCompleted, autoClearHours, compactMode, req.userId]
      );
      res.json({ ok: true });
    } catch (err) {
      res.status(500).json({ error: 'Server error' });
    }
  });

  // Change password (protected)
  router.put('/password', auth, async (req, res) => {
    try {
      const { currentPassword, newPassword } = req.body;
      const result = await pool.query('SELECT password_hash FROM users WHERE id = $1', [req.userId]);
      const valid = await bcrypt.compare(currentPassword, result.rows[0].password_hash);
      if (!valid) return res.status(401).json({ error: 'Current password incorrect' });

      const hash = await bcrypt.hash(newPassword, 10);
      await pool.query('UPDATE users SET password_hash = $1 WHERE id = $2', [hash, req.userId]);
      res.json({ ok: true });
    } catch (err) {
      res.status(500).json({ error: 'Server error' });
    }
  });

  return router;
};
