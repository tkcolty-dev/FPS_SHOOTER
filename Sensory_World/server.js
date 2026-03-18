const express = require('express');
const { Pool } = require('pg');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const cookieParser = require('cookie-parser');
const path = require('path');

const app = express();
app.use(express.json());
app.use(cookieParser());
app.use(express.static(path.join(__dirname, 'public')));

let dbConfig;
if (process.env.VCAP_SERVICES) {
  const vcap = JSON.parse(process.env.VCAP_SERVICES);
  const svc = (vcap.postgres || vcap['on-demand-postgres-db'] || [])[0];
  if (svc) {
    const c = svc.credentials;
    dbConfig = { host: c.primary_host || (c.hosts && c.hosts[0]) || c.hostname || c.host, port: c.port, database: c.db || c.name || c.dbname || c.database, user: c.user || c.username, password: c.password, ssl: false };
  }
}
if (!dbConfig) dbConfig = { host: 'localhost', port: 5432, database: 'sensory_world', user: 'postgres', password: 'postgres' };

const pool = new Pool(dbConfig);
const JWT_SECRET = process.env.JWT_SECRET || 'sw-' + (dbConfig.password || '').slice(0, 8) + '-secret';

async function initDB() {
  const client = await pool.connect();
  try {
    await client.query(`CREATE TABLE IF NOT EXISTS users (id SERIAL PRIMARY KEY, username VARCHAR(50) UNIQUE NOT NULL, password_hash VARCHAR(255) NOT NULL, display_name VARCHAR(100), avatar VARCHAR(20) DEFAULT 'cat', is_admin BOOLEAN DEFAULT false, created_at TIMESTAMP DEFAULT NOW())`);
    await client.query(`CREATE TABLE IF NOT EXISTS games (id SERIAL PRIMARY KEY, creator_id INTEGER REFERENCES users(id) ON DELETE CASCADE, name VARCHAR(100) NOT NULL, type VARCHAR(30) DEFAULT 'slicer', config JSONB DEFAULT '{}', published BOOLEAN DEFAULT false, approved BOOLEAN DEFAULT false, plays INTEGER DEFAULT 0, created_at TIMESTAMP DEFAULT NOW())`);
    await client.query(`ALTER TABLE users ADD COLUMN IF NOT EXISTS is_admin BOOLEAN DEFAULT false`).catch(() => {});
    // First user + tehkenna become admin
    await client.query(`UPDATE users SET is_admin = true WHERE id = (SELECT MIN(id) FROM users) AND NOT EXISTS (SELECT 1 FROM users WHERE is_admin = true)`).catch(() => {});
    await client.query(`UPDATE users SET is_admin = true WHERE username IN ('tehkenna', 'kennaaaaa')`).catch(() => {});
  } finally { client.release(); }
}

function auth(req, res, next) {
  const token = req.cookies.token;
  if (!token) return res.status(401).json({ error: 'Not authenticated' });
  try { req.user = jwt.verify(token, JWT_SECRET); next(); } catch { res.status(401).json({ error: 'Invalid token' }); }
}

async function adminCheck(req, res, next) {
  try {
    const r = await pool.query('SELECT is_admin FROM users WHERE id = $1', [req.user.id]);
    if (!r.rows.length || !r.rows[0].is_admin) return res.status(403).json({ error: 'Admin required' });
    next();
  } catch { res.status(500).json({ error: 'Failed' }); }
}

const cookieOpts = { httpOnly: true, maxAge: 30 * 24 * 60 * 60 * 1000, sameSite: 'lax' };

// Auth
app.post('/api/auth/register', async (req, res) => {
  try {
    const { username, password, avatar } = req.body;
    if (!username || !password) return res.status(400).json({ error: 'Username and password required' });
    if (username.length < 2) return res.status(400).json({ error: 'Username too short' });
    if (password.length < 3) return res.status(400).json({ error: 'Password too short' });
    const hash = await bcrypt.hash(password, 10);
    // Check if first user
    const countRes = await pool.query('SELECT COUNT(*) FROM users');
    const isFirst = parseInt(countRes.rows[0].count) === 0;
    const result = await pool.query(
      'INSERT INTO users (username, password_hash, display_name, avatar, is_admin) VALUES ($1,$2,$3,$4,$5) RETURNING id, username, display_name, avatar, is_admin',
      [username.toLowerCase().trim(), hash, username.trim(), avatar || 'cat', isFirst]
    );
    const user = result.rows[0];
    const token = jwt.sign({ id: user.id, username: user.username }, JWT_SECRET, { expiresIn: '30d' });
    res.cookie('token', token, cookieOpts);
    res.json({ user });
  } catch (e) {
    if (e.code === '23505') return res.status(400).json({ error: 'Username already taken' });
    console.error('Register error:', e);
    res.status(500).json({ error: 'Registration failed' });
  }
});

app.post('/api/auth/login', async (req, res) => {
  try {
    const { username, password } = req.body;
    const result = await pool.query('SELECT * FROM users WHERE username = $1', [username.toLowerCase().trim()]);
    if (!result.rows.length) return res.status(400).json({ error: 'User not found' });
    const user = result.rows[0];
    if (!(await bcrypt.compare(password, user.password_hash))) return res.status(400).json({ error: 'Wrong password' });
    const token = jwt.sign({ id: user.id, username: user.username }, JWT_SECRET, { expiresIn: '30d' });
    res.cookie('token', token, cookieOpts);
    res.json({ user: { id: user.id, username: user.username, display_name: user.display_name, avatar: user.avatar, is_admin: user.is_admin } });
  } catch (e) { res.status(500).json({ error: 'Login failed' }); }
});

app.get('/api/auth/me', auth, async (req, res) => {
  try {
    const result = await pool.query('SELECT id, username, display_name, avatar, is_admin FROM users WHERE id = $1', [req.user.id]);
    if (!result.rows.length) return res.status(404).json({ error: 'Not found' });
    res.json({ user: result.rows[0] });
  } catch { res.status(500).json({ error: 'Failed' }); }
});

app.put('/api/auth/profile', auth, async (req, res) => {
  try {
    const { display_name, avatar } = req.body;
    const result = await pool.query('UPDATE users SET display_name = COALESCE($1, display_name), avatar = COALESCE($2, avatar) WHERE id = $3 RETURNING id, username, display_name, avatar, is_admin', [display_name || null, avatar || null, req.user.id]);
    res.json({ user: result.rows[0] });
  } catch { res.status(500).json({ error: 'Update failed' }); }
});

app.post('/api/auth/logout', (req, res) => { res.clearCookie('token'); res.json({ ok: true }); });

// Games
app.post('/api/games', auth, async (req, res) => {
  try {
    const { name, type, config } = req.body;
    if (!name) return res.status(400).json({ error: 'Name required' });
    const r = await pool.query('INSERT INTO games (creator_id, name, type, config) VALUES ($1,$2,$3,$4) RETURNING *', [req.user.id, name, type || 'slicer', config || {}]);
    res.json({ game: r.rows[0] });
  } catch (e) { res.status(500).json({ error: 'Failed to create game' }); }
});

app.get('/api/games', async (req, res) => {
  try {
    const r = await pool.query('SELECT g.*, u.username as creator_name, u.avatar as creator_avatar FROM games g JOIN users u ON g.creator_id = u.id WHERE g.published = true AND g.approved = true ORDER BY g.plays DESC, g.created_at DESC');
    res.json({ games: r.rows });
  } catch { res.json({ games: [] }); }
});

app.get('/api/games/mine', auth, async (req, res) => {
  try {
    const r = await pool.query('SELECT * FROM games WHERE creator_id = $1 ORDER BY created_at DESC', [req.user.id]);
    res.json({ games: r.rows });
  } catch { res.json({ games: [] }); }
});

app.put('/api/games/:id', auth, async (req, res) => {
  try {
    const { name, config, published } = req.body;
    const r = await pool.query('UPDATE games SET name = COALESCE($1, name), config = COALESCE($2, config), published = COALESCE($3, published) WHERE id = $4 AND creator_id = $5 RETURNING *', [name || null, config || null, published, req.params.id, req.user.id]);
    if (!r.rows.length) return res.status(404).json({ error: 'Not found' });
    res.json({ game: r.rows[0] });
  } catch { res.status(500).json({ error: 'Update failed' }); }
});

app.delete('/api/games/:id', auth, async (req, res) => {
  try {
    await pool.query('DELETE FROM games WHERE id = $1 AND creator_id = $2', [req.params.id, req.user.id]);
    res.json({ ok: true });
  } catch { res.status(500).json({ error: 'Delete failed' }); }
});

app.post('/api/games/:id/play', async (req, res) => {
  try {
    await pool.query('UPDATE games SET plays = plays + 1 WHERE id = $1', [req.params.id]);
    res.json({ ok: true });
  } catch { res.json({ ok: true }); }
});

// Admin
app.get('/api/admin/users', auth, adminCheck, async (req, res) => {
  try {
    const r = await pool.query('SELECT id, username, display_name, avatar, is_admin, created_at FROM users ORDER BY created_at DESC');
    res.json({ users: r.rows });
  } catch { res.json({ users: [] }); }
});

app.put('/api/admin/users/:id/toggle-admin', auth, adminCheck, async (req, res) => {
  try {
    const r = await pool.query('UPDATE users SET is_admin = NOT is_admin WHERE id = $1 RETURNING id, username, is_admin', [req.params.id]);
    res.json({ user: r.rows[0] });
  } catch { res.status(500).json({ error: 'Failed' }); }
});

app.delete('/api/admin/users/:id', auth, adminCheck, async (req, res) => {
  try {
    if (parseInt(req.params.id) === req.user.id) return res.status(400).json({ error: "Can't delete yourself" });
    await pool.query('DELETE FROM users WHERE id = $1', [req.params.id]);
    res.json({ ok: true });
  } catch { res.status(500).json({ error: 'Failed' }); }
});

app.get('/api/admin/games', auth, adminCheck, async (req, res) => {
  try {
    const r = await pool.query('SELECT g.*, u.username as creator_name FROM games g JOIN users u ON g.creator_id = u.id ORDER BY g.created_at DESC');
    res.json({ games: r.rows });
  } catch { res.json({ games: [] }); }
});

app.put('/api/admin/games/:id/approve', auth, adminCheck, async (req, res) => {
  try {
    const { approved } = req.body;
    const r = await pool.query('UPDATE games SET approved = $1 WHERE id = $2 RETURNING *', [approved, req.params.id]);
    res.json({ game: r.rows[0] });
  } catch { res.status(500).json({ error: 'Failed' }); }
});

app.delete('/api/admin/games/:id', auth, adminCheck, async (req, res) => {
  try { await pool.query('DELETE FROM games WHERE id = $1', [req.params.id]); res.json({ ok: true }); } catch { res.status(500).json({ error: 'Failed' }); }
});

const PORT = process.env.PORT || 3000;
async function start() {
  for (let i = 0; i < 5; i++) {
    try { await initDB(); console.log('DB ready'); break; }
    catch (e) { console.error(`DB attempt ${i + 1}:`, e.message); if (i === 4) process.exit(1); await new Promise(r => setTimeout(r, 3000)); }
  }
  app.listen(PORT, () => console.log(`Sensory World on port ${PORT}`));
}
start();
