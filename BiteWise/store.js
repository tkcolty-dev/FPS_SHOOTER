// Storage for accounts, sync records and Fitbit tokens.
//   - postgres: when VCAP_SERVICES (Cloud Foundry) has a postgres binding, or DATABASE_URL is set
//   - files (default for local dev): data/db.json
// The phone is the source of truth for a user's log; the server keeps a synced copy so a second device
// (or a wiped phone) can restore it. Records merge last-write-wins on the client's updatedAt.
const fs = require('fs');
const path = require('path');

function pgConfig() {
  if (process.env.VCAP_SERVICES) {
    try {
      const vcap = JSON.parse(process.env.VCAP_SERVICES);
      const svc = Object.values(vcap).flat().find(s => /postgres/i.test(s.label || '') || /postgres/i.test((s.tags || []).join(',')));
      if (svc) {
        const c = svc.credentials || {};
        if (c.uri || c.url) return { connectionString: (c.uri || c.url).replace(/^jdbc:/, ''), ssl: false };
        return { host: c.hostname || c.host || (c.hosts && c.hosts[0]), port: c.port || 5432, database: c.db || c.name || c.dbname || c.database || 'postgres', user: c.user || c.username, password: c.password, ssl: false };
      }
    } catch (e) { console.error('VCAP_SERVICES parse error (postgres):', e.message); }
  }
  if (process.env.DATABASE_URL) return { connectionString: process.env.DATABASE_URL, ssl: process.env.PGSSL === '1' ? { rejectUnauthorized: false } : false };
  return null;
}

function fileBackend() {
  const dir = process.env.BW_DATA_DIR || path.join(__dirname, 'data'), file = path.join(dir, 'db.json');
  fs.mkdirSync(dir, { recursive: true });
  let db = { users: {}, sessions: {}, records: {}, fitbit: {}, kv: {}, seq: 0 };
  try { db = { ...db, ...JSON.parse(fs.readFileSync(file, 'utf8')) }; } catch {}
  let timer = null;
  const save = () => { clearTimeout(timer); timer = setTimeout(() => { fs.writeFileSync(file + '.tmp', JSON.stringify(db)); fs.renameSync(file + '.tmp', file); }, 150); };
  return {
    name: 'files',
    async init() {},
    async createUser(u) { if (Object.values(db.users).some(x => x.username === u.username)) return false; db.users[u.id] = u; save(); return true; },
    async userByName(name) { return Object.values(db.users).find(x => x.username === name) || null; },
    async userById(id) { return db.users[id] || null; },
    async renameUser(id, username, salt, hash) { if (Object.values(db.users).some(x => x.username === username && x.id !== id)) return false; Object.assign(db.users[id], { username, salt, hash, auto: false }); save(); return true; },
    async addSession(hash, uid) { db.sessions[hash] = { uid, at: Date.now() }; save(); },
    async sessionUser(hash) { return db.sessions[hash]?.uid || null; },
    async dropSession(hash) { delete db.sessions[hash]; save(); },
    async upsertRecords(uid, recs) {
      const mine = db.records[uid] ||= {};
      let accepted = 0;
      for (const r of recs) {
        const cur = mine[r.id];
        if (!cur || (r.updatedAt || 0) >= (cur.data.updatedAt || 0)) { mine[r.id] = { seq: ++db.seq, data: r }; accepted++; }
      }
      save(); return accepted;
    },
    async recordsSince(uid, since) {
      const mine = db.records[uid] || {};
      const out = Object.values(mine).filter(x => x.seq > since).sort((a, b) => a.seq - b.seq);
      return { records: out.map(x => x.data), seq: out.length ? out[out.length - 1].seq : since };
    },
    async deleteRecords(uid) { delete db.records[uid]; save(); },
    async deleteUser(uid) { delete db.users[uid]; delete db.records[uid]; delete db.fitbit[uid]; for (const [h, v] of Object.entries(db.sessions)) if (v.uid === uid) delete db.sessions[h]; save(); },
    async kvGet(key) { return db.kv?.[key] ?? null; },
    async kvSet(key, value) { (db.kv ||= {})[key] = value; save(); },
    async kvDel(key) { if (db.kv) delete db.kv[key]; save(); },
    async getFitbit(uid) { return db.fitbit[uid] || null; },
    async setFitbit(uid, tok) { if (tok) db.fitbit[uid] = tok; else delete db.fitbit[uid]; save(); },
  };
}

function pgBackend(cfg) {
  const { Pool } = require('pg');
  const pool = new Pool({ ...cfg, max: 5 });
  const q = (text, params) => pool.query(text, params);
  return {
    name: 'postgres',
    async init() {
      await q(`CREATE TABLE IF NOT EXISTS bw_users (id text PRIMARY KEY, username text UNIQUE NOT NULL, data jsonb NOT NULL)`);
      await q(`CREATE TABLE IF NOT EXISTS bw_sessions (hash text PRIMARY KEY, uid text NOT NULL, at timestamptz DEFAULT now())`);
      await q(`CREATE TABLE IF NOT EXISTS bw_records (uid text NOT NULL, id text NOT NULL, seq bigserial, updated_at bigint NOT NULL, data jsonb NOT NULL, PRIMARY KEY (uid, id))`);
      await q(`CREATE INDEX IF NOT EXISTS bw_records_seq ON bw_records (uid, seq)`);
      await q(`CREATE TABLE IF NOT EXISTS bw_fitbit (uid text PRIMARY KEY, data jsonb NOT NULL)`);
      await q(`CREATE TABLE IF NOT EXISTS bw_kv (key text PRIMARY KEY, value jsonb NOT NULL, updated_at timestamptz DEFAULT now())`);
    },
    async createUser(u) {
      const r = await q('INSERT INTO bw_users (id, username, data) VALUES ($1, $2, $3) ON CONFLICT (username) DO NOTHING', [u.id, u.username, JSON.stringify(u)]);
      return r.rowCount === 1;
    },
    async userByName(name) { const r = await q('SELECT data FROM bw_users WHERE username = $1', [name]); return r.rows[0]?.data || null; },
    async userById(id) { const r = await q('SELECT data FROM bw_users WHERE id = $1', [id]); return r.rows[0]?.data || null; },
    async renameUser(id, username, salt, hash) {
      try { const r = await q(`UPDATE bw_users SET username = $2, data = data || jsonb_build_object('username', $2::text, 'salt', $3::text, 'hash', $4::text, 'auto', false) WHERE id = $1`, [id, username, salt, hash]); return r.rowCount === 1; }
      catch (e) { if (e.code === '23505') return false; throw e; }
    },
    async addSession(hash, uid) { await q('INSERT INTO bw_sessions (hash, uid) VALUES ($1, $2) ON CONFLICT DO NOTHING', [hash, uid]); },
    async sessionUser(hash) { const r = await q('SELECT uid FROM bw_sessions WHERE hash = $1', [hash]); return r.rows[0]?.uid || null; },
    async dropSession(hash) { await q('DELETE FROM bw_sessions WHERE hash = $1', [hash]); },
    async upsertRecords(uid, recs) {
      let accepted = 0;
      for (const r of recs) {
        // nextval() on every accepted write keeps seq increasing so other devices pick the change up
        const res = await q(`INSERT INTO bw_records (uid, id, updated_at, data) VALUES ($1, $2, $3, $4)
          ON CONFLICT (uid, id) DO UPDATE SET data = EXCLUDED.data, updated_at = EXCLUDED.updated_at, seq = nextval(pg_get_serial_sequence('bw_records', 'seq'))
          WHERE bw_records.updated_at <= EXCLUDED.updated_at`, [uid, r.id, r.updatedAt || 0, JSON.stringify(r)]);
        accepted += res.rowCount;
      }
      return accepted;
    },
    async recordsSince(uid, since) {
      const r = await q('SELECT seq, data FROM bw_records WHERE uid = $1 AND seq > $2 ORDER BY seq LIMIT 5000', [uid, since]);
      return { records: r.rows.map(x => x.data), seq: r.rows.length ? Number(r.rows[r.rows.length - 1].seq) : since };
    },
    async deleteRecords(uid) { await q('DELETE FROM bw_records WHERE uid = $1', [uid]); },
    async deleteUser(uid) { for (const t of ['bw_records', 'bw_fitbit', 'bw_sessions']) await q(`DELETE FROM ${t} WHERE uid = $1`, [uid]); await q('DELETE FROM bw_users WHERE id = $1', [uid]); },
    async kvGet(key) { const r = await q('SELECT value FROM bw_kv WHERE key = $1', [key]); return r.rows[0]?.value ?? null; },
    async kvSet(key, value) { await q('INSERT INTO bw_kv (key, value, updated_at) VALUES ($1, $2, now()) ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value, updated_at = now()', [key, JSON.stringify(value)]); },
    async kvDel(key) { await q('DELETE FROM bw_kv WHERE key = $1', [key]); },
    async getFitbit(uid) { const r = await q('SELECT data FROM bw_fitbit WHERE uid = $1', [uid]); return r.rows[0]?.data || null; },
    async setFitbit(uid, tok) {
      if (!tok) return void await q('DELETE FROM bw_fitbit WHERE uid = $1', [uid]);
      await q('INSERT INTO bw_fitbit (uid, data) VALUES ($1, $2) ON CONFLICT (uid) DO UPDATE SET data = EXCLUDED.data', [uid, JSON.stringify(tok)]);
    },
  };
}

const cfg = pgConfig();
const store = cfg ? pgBackend(cfg) : fileBackend();
module.exports = store;
