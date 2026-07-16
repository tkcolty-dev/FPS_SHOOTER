'use strict';
/*
 * Sprout server — serves the app and stores accounts + progress.
 *
 * Design goal: it must NEVER hard-break, even on Cloud Foundry with no
 * database bound. It tries Postgres if a connection string is available
 * (DATABASE_URL, or a postgres service in VCAP_SERVICES). If that isn't
 * present or fails to initialise, it falls back to an in-memory store so
 * login always works — it just won't persist across restarts until you
 * bind a database. Every failure is logged, not thrown.
 */
const express = require('express');
const path = require('path');
const crypto = require('crypto');
const fs = require('fs');

const app = express();
app.use(express.json({ limit: '256kb' }));
app.use(express.static(path.join(__dirname, 'public')));

const PORT = process.env.PORT || 8080;
const DATA_FILE = path.join(__dirname, 'data.json');

/* ---------- work out a Postgres connection string, if any ---------- */
function findPgUri() {
  if (process.env.DATABASE_URL) return process.env.DATABASE_URL;
  const vcap = process.env.VCAP_SERVICES;
  if (!vcap) return null;
  try {
    const parsed = JSON.parse(vcap);
    for (const key of Object.keys(parsed)) {
      for (const inst of parsed[key]) {
        const c = inst.credentials || {};
        const uri = c.uri || c.jdbcUrl || c.url;
        if (uri && /postgres/i.test(uri)) return uri.replace(/^jdbc:/, '');
      }
    }
  } catch (e) { console.warn('[sprout] could not parse VCAP_SERVICES:', e.message); }
  return null;
}

/* ---------- storage: Postgres with an in-memory / file fallback ---------- */
let store;

function memoryStore() {
  // load a best-effort snapshot from disk (works locally; harmless on CF)
  let db = { profiles: {}, progress: {} };
  try { if (fs.existsSync(DATA_FILE)) db = JSON.parse(fs.readFileSync(DATA_FILE, 'utf8')); }
  catch (e) { console.warn('[sprout] could not read data file:', e.message); }
  const flush = () => { try { fs.writeFileSync(DATA_FILE, JSON.stringify(db)); } catch (e) {} };
  return {
    kind: 'memory',
    async listProfiles() { return Object.values(db.profiles); },
    async createProfile(p) { db.profiles[p.id] = p; flush(); return p; },
    async getProgress(id) { return db.progress[id] || null; },
    async putProgress(id, data) { db.progress[id] = data; flush(); return true; }
  };
}

async function pgStore(uri) {
  const { Pool } = require('pg');
  const ssl = /localhost|127\.0\.0\.1/.test(uri) ? false : { rejectUnauthorized: false };
  const pool = new Pool({ connectionString: uri, ssl });
  await pool.query('SELECT 1');
  await pool.query(`CREATE TABLE IF NOT EXISTS profiles (
      id text PRIMARY KEY, name text, color text, av text, created bigint)`);
  await pool.query(`CREATE TABLE IF NOT EXISTS progress (
      id text PRIMARY KEY, data jsonb, updated bigint)`);
  return {
    kind: 'postgres',
    async listProfiles() {
      const r = await pool.query('SELECT id,name,color,av FROM profiles ORDER BY created ASC LIMIT 100');
      return r.rows;
    },
    async createProfile(p) {
      await pool.query('INSERT INTO profiles(id,name,color,av,created) VALUES($1,$2,$3,$4,$5)',
        [p.id, p.name, p.color, p.av, p.created]);
      return p;
    },
    async getProgress(id) {
      const r = await pool.query('SELECT data FROM progress WHERE id=$1', [id]);
      return r.rows[0] ? r.rows[0].data : null;
    },
    async putProgress(id, data) {
      await pool.query(
        `INSERT INTO progress(id,data,updated) VALUES($1,$2,$3)
         ON CONFLICT (id) DO UPDATE SET data=$2, updated=$3`,
        [id, data, Date.now()]);
      return true;
    }
  };
}

async function initStore() {
  const uri = findPgUri();
  if (uri) {
    try {
      store = await pgStore(uri);
      console.log('[sprout] storage: Postgres (persistent) ✔');
      return;
    } catch (e) {
      console.warn('[sprout] Postgres unavailable, falling back to memory:', e.message);
    }
  } else {
    console.log('[sprout] no database bound — using in-memory store.');
  }
  store = memoryStore();
}

/* ---------- API ---------- */
const clean = (s, max = 40) => String(s == null ? '' : s).slice(0, max);

app.get('/api/health', (req, res) =>
  res.json({ ok: true, storage: store ? store.kind : 'starting' }));

app.get('/api/profiles', async (req, res) => {
  try { res.json({ profiles: await store.listProfiles() }); }
  catch (e) { console.error(e); res.json({ profiles: [] }); }
});

app.post('/api/profiles', async (req, res) => {
  try {
    const p = {
      id: crypto.randomUUID(),
      name: clean(req.body.name, 20) || 'Learner',
      color: clean(req.body.color, 12) || '#2fd47f',
      av: clean(req.body.av, 8) || '🦊',
      created: Date.now()
    };
    await store.createProfile(p);
    res.json({ profile: p });
  } catch (e) { console.error(e); res.status(500).json({ error: 'could not create profile' }); }
});

app.get('/api/progress/:id', async (req, res) => {
  try { res.json({ data: await store.getProgress(clean(req.params.id, 64)) }); }
  catch (e) { console.error(e); res.json({ data: null }); }
});

app.put('/api/progress/:id', async (req, res) => {
  try { await store.putProgress(clean(req.params.id, 64), req.body.data || {}); res.json({ ok: true }); }
  catch (e) { console.error(e); res.status(500).json({ ok: false }); }
});

// SPA fallback
app.get('*', (req, res) => res.sendFile(path.join(__dirname, 'public', 'index.html')));

initStore().finally(() => {
  app.listen(PORT, () => console.log(`[sprout] listening on ${PORT}`));
});
