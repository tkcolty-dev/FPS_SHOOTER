const { Router } = require('express');
const bcrypt = require('bcryptjs');
const crypto = require('crypto');
const { getPool } = require('../db');
const authenticate = require('../middleware');

const router = Router();

function genId() {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
}

router.post('/register', async (req, res) => {
  try {
    const { name, username, password } = req.body;
    if (!name || !username || !password) {
      return res.status(400).json({ error: 'All fields are required' });
    }
    if (password.length < 4) {
      return res.status(400).json({ error: 'Password must be at least 4 characters' });
    }

    const db = getPool();
    const existing = await db.query('SELECT id FROM users WHERE username = $1', [username.toLowerCase()]);
    if (existing.rows.length > 0) {
      return res.status(400).json({ error: 'That username is already taken' });
    }

    const id = genId();
    const passwordHash = await bcrypt.hash(password, 10);
    await db.query(
      'INSERT INTO users (id, name, username, password_hash, created_at) VALUES ($1, $2, $3, $4, $5)',
      [id, name.trim(), username.trim().toLowerCase(), passwordHash, Date.now()]
    );

    const token = crypto.randomBytes(32).toString('hex');
    await db.query(
      'INSERT INTO sessions (token, user_id, created_at) VALUES ($1, $2, $3)',
      [token, id, Date.now()]
    );

    res.json({ token, user: { id, name: name.trim(), username: username.trim().toLowerCase() } });
  } catch (err) {
    console.error('Register error:', err);
    res.status(500).json({ error: 'Server error' });
  }
});

router.post('/login', async (req, res) => {
  try {
    const { username, password } = req.body;
    const db = getPool();
    const result = await db.query('SELECT * FROM users WHERE username = $1', [username?.toLowerCase()]);
    if (result.rows.length === 0) {
      return res.status(401).json({ error: 'Invalid username or password' });
    }

    const user = result.rows[0];
    const valid = await bcrypt.compare(password, user.password_hash);
    if (!valid) {
      return res.status(401).json({ error: 'Invalid username or password' });
    }

    const token = crypto.randomBytes(32).toString('hex');
    await db.query(
      'INSERT INTO sessions (token, user_id, created_at) VALUES ($1, $2, $3)',
      [token, user.id, Date.now()]
    );

    res.json({ token, user: { id: user.id, name: user.name, username: user.username } });
  } catch (err) {
    console.error('Login error:', err);
    res.status(500).json({ error: 'Server error' });
  }
});

router.get('/me', authenticate, (req, res) => {
  res.json({ user: req.user });
});

router.post('/logout', authenticate, async (req, res) => {
  try {
    const token = req.headers.authorization.slice(7);
    const db = getPool();
    await db.query('DELETE FROM sessions WHERE token = $1', [token]);
    res.json({ ok: true });
  } catch (err) {
    console.error('Logout error:', err);
    res.status(500).json({ error: 'Failed to logout' });
  }
});

module.exports = router;
