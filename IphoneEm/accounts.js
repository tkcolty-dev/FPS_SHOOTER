// Real accounts, messages and call signalling.
// Storage: Postgres when a database is bound (Cloud Foundry) or DATABASE_URL is set — accounts then last forever.
// Otherwise a JSON file next to the server, for running on your own Mac.
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const FILE = path.join(__dirname, 'data', 'store.json');
const COLORS = ['#FF9500', '#34C759', '#5856D6', '#FF2D55', '#30B0C7', '#AF52DE', '#FF3B30', '#007AFF', '#A2845E', '#00C7BE'];
const norm = (h) => String(h || '').trim().toLowerCase().replace(/^@/, '');
const hash = (pass, salt) => crypto.scryptSync(String(pass), salt, 32).toString('hex');
const pub = (u) => ({ id: u.id, handle: u.handle, name: u.name, emoji: u.emoji || '', color: u.color || '#8E8E93', created: Number(u.created) });

/* ───────────────────────── storage backends ───────────────────────── */
function pgConfig() {
  if (process.env.VCAP_SERVICES) {
    try {
      const vcap = JSON.parse(process.env.VCAP_SERVICES);
      const svc = Object.values(vcap).flat().find((s) => /postgres/i.test(s.label || '') || /postgres/i.test((s.tags || []).join(',')) || /postgres/i.test(s.name || ''));
      const c = svc && svc.credentials;
      if (c) {
        if (c.uri || c.url) return { connectionString: c.uri || c.url, ssl: false };
        return { host: c.hostname || c.host || (c.hosts && c.hosts[0]), port: c.port || 5432, database: c.db || c.name || c.dbname || c.database || 'postgres', user: c.user || c.username, password: c.password, ssl: false };
      }
    } catch (e) { console.error('[accounts] VCAP parse', e.message); }
  }
  if (process.env.DATABASE_URL) return { connectionString: process.env.DATABASE_URL, ssl: process.env.PGSSL === '1' ? { rejectUnauthorized: false } : false };
  return null;
}

let store = null;                 // { kind, ready, ... } set below
const signals = [];               // call signalling is always in memory: it is worthless a few seconds later
let signalSeq = 0;
const signalListeners = [];

function fileStore() {
  let db = { users: [], msgs: [], seq: 0 };
  try { db = Object.assign(db, JSON.parse(fs.readFileSync(FILE, 'utf8'))); } catch {}
  let t = null;
  const save = () => { clearTimeout(t); t = setTimeout(() => { try { fs.mkdirSync(path.dirname(FILE), { recursive: true }); const tmp = FILE + '.tmp'; fs.writeFileSync(tmp, JSON.stringify(db)); fs.renameSync(tmp, FILE); } catch (e) { console.error('[accounts] save', e.message); } }, 150); };
  return {
    kind: 'file',
    async userByHandle(h) { return db.users.find((u) => u.handle === norm(h)) || null; },
    async userByToken(tk) { return (tk && db.users.find((u) => (u.tokens || []).includes(tk))) || null; },
    async userById(id) { return db.users.find((u) => u.id === id) || null; },
    async addUser(u) { db.users.push(u); save(); return u; },
    async saveUser() { save(); },
    async allUsers() { return db.users.slice(); },
    async addMsg(m) { m.n = ++db.seq; db.msgs.push(m); if (db.msgs.length > 20000) db.msgs.splice(0, db.msgs.length - 20000); save(); return m; },
    async msgsFor(userId, since) { return db.msgs.filter((m) => (m.from === userId || m.to === userId) && m.n > since).slice(-500); },
    async maxSeq() { return db.seq; },
    async markRead(userId, otherId) { db.msgs.forEach((m) => { if (m.to === userId && m.from === otherId) m.read = true; }); save(); },
    async count() { return { users: db.users.length, msgs: db.msgs.length }; },
  };
}

function pgStore(cfg) {
  const { Pool } = require('pg');
  const pool = new Pool(Object.assign({ max: 4, idleTimeoutMillis: 30000 }, cfg));
  const q = (text, params) => pool.query(text, params);
  const rowUser = (r) => r && { id: r.id, handle: r.handle, name: r.name, emoji: r.emoji, color: r.color, salt: r.salt, pass: r.pass, created: Number(r.created), tokens: r.tokens || [] };
  const ready = (async () => {
    await q(`CREATE TABLE IF NOT EXISTS users (
      id text PRIMARY KEY, handle text UNIQUE NOT NULL, name text NOT NULL, emoji text DEFAULT '', color text DEFAULT '#8E8E93',
      salt text NOT NULL, pass text NOT NULL, created bigint NOT NULL, tokens text[] DEFAULT '{}')`);
    await q(`CREATE TABLE IF NOT EXISTS msgs (
      id text PRIMARY KEY, n bigserial, sender text NOT NULL, recipient text NOT NULL, text text NOT NULL, t bigint NOT NULL, read boolean DEFAULT false)`);
    await q(`CREATE INDEX IF NOT EXISTS msgs_people ON msgs (sender, recipient, n)`);
    console.log('  accounts: Postgres (permanent)');
  })();
  const rowMsg = (r) => ({ id: r.id, n: Number(r.n), from: r.sender, to: r.recipient, text: r.text, t: Number(r.t), read: r.read });
  return {
    kind: 'pg', ready,
    async userByHandle(h) { const r = await q('SELECT * FROM users WHERE handle=$1', [norm(h)]); return rowUser(r.rows[0]); },
    async userByToken(tk) { if (!tk) return null; const r = await q('SELECT * FROM users WHERE $1 = ANY(tokens)', [tk]); return rowUser(r.rows[0]); },
    async userById(id) { const r = await q('SELECT * FROM users WHERE id=$1', [id]); return rowUser(r.rows[0]); },
    async addUser(u) { await q('INSERT INTO users (id,handle,name,emoji,color,salt,pass,created,tokens) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)', [u.id, u.handle, u.name, u.emoji, u.color, u.salt, u.pass, u.created, u.tokens]); return u; },
    async saveUser(u) { await q('UPDATE users SET name=$2, emoji=$3, color=$4, tokens=$5 WHERE id=$1', [u.id, u.name, u.emoji, u.color, u.tokens]); },
    async allUsers() { const r = await q('SELECT * FROM users ORDER BY name'); return r.rows.map(rowUser); },
    async addMsg(m) { const r = await q('INSERT INTO msgs (id,sender,recipient,text,t) VALUES ($1,$2,$3,$4,$5) RETURNING n', [m.id, m.from, m.to, m.text, m.t]); m.n = Number(r.rows[0].n); return m; },
    async msgsFor(userId, since) { const r = await q('SELECT * FROM msgs WHERE (sender=$1 OR recipient=$1) AND n > $2 ORDER BY n LIMIT 500', [userId, since]); return r.rows.map(rowMsg); },
    async maxSeq() { const r = await q('SELECT COALESCE(MAX(n),0) AS m FROM msgs'); return Number(r.rows[0].m); },
    async markRead(userId, otherId) { await q('UPDATE msgs SET read=true WHERE recipient=$1 AND sender=$2', [userId, otherId]); },
    async count() { const u = await q('SELECT COUNT(*) c FROM users'); const m = await q('SELECT COUNT(*) c FROM msgs'); return { users: +u.rows[0].c, msgs: +m.rows[0].c }; },
  };
}

const cfg = pgConfig();
if (cfg) {
  try { store = pgStore(cfg); store.ready.catch((e) => { console.error('[accounts] Postgres failed, using file store:', e.message); store = fileStore(); }); }
  catch (e) { console.error('[accounts] pg module missing, using file store:', e.message); store = fileStore(); }
} else { store = fileStore(); console.log('  accounts: local file (data/store.json)'); }

/* ───────────────────────── API ───────────────────────── */
async function signup({ handle, name, pass, emoji }) {
  handle = norm(handle);
  if (!/^[a-z0-9_.]{3,20}$/.test(handle)) throw new Error('Pick a username of 3–20 letters, numbers, dots or underscores.');
  if (await store.userByHandle(handle)) throw new Error('That username is taken.');
  if (String(pass || '').length < 4) throw new Error('Your passcode needs at least 4 characters.');
  const all = await store.allUsers();
  const salt = crypto.randomBytes(12).toString('hex');
  await store.addUser({ id: crypto.randomUUID(), handle, name: String(name || '').trim().slice(0, 30) || handle, emoji: String(emoji || '').slice(0, 4), color: COLORS[all.length % COLORS.length], salt, pass: hash(pass, salt), created: Date.now(), tokens: [] });
  return login({ handle, pass });
}
async function login({ handle, pass }) {
  const u = await store.userByHandle(handle);
  if (!u) throw new Error('No account with that username.');
  if (hash(pass, u.salt) !== u.pass) throw new Error('Wrong passcode.');
  const token = crypto.randomBytes(24).toString('hex');
  u.tokens = (u.tokens || []).slice(-4).concat([token]);
  await store.saveUser(u);
  return { token, user: pub(u) };
}
async function need(token) { const u = await store.userByToken(token); if (!u) throw new Error('Signed out'); return u; }
async function me(token) { return pub(await need(token)); }
async function updateMe(token, patch) {
  const u = await need(token);
  if (patch.name != null) u.name = String(patch.name).trim().slice(0, 30) || u.handle;
  if (patch.emoji != null) u.emoji = String(patch.emoji).slice(0, 4);
  if (patch.color != null && /^#[0-9a-f]{6}$/i.test(patch.color)) u.color = patch.color;
  await store.saveUser(u); return pub(u);
}
async function directory(token) { const u = await need(token); return (await store.allUsers()).filter((x) => x.id !== u.id).map(pub).sort((a, b) => a.name.localeCompare(b.name)); }
async function send(token, { to, text }) {
  const u = await need(token);
  const other = (await store.userById(to)) || (await store.userByHandle(to));
  if (!other) throw new Error('No such person.');
  text = String(text || '').slice(0, 4000);
  if (!text.trim()) throw new Error('Empty message.');
  return store.addMsg({ id: crypto.randomUUID(), from: u.id, to: other.id, text, t: Date.now() });
}
async function inbox(token, since, sinceSig) {
  const u = await need(token);
  const [msgs, seq, people] = await Promise.all([store.msgsFor(u.id, Number(since) || 0), store.maxSeq(), directory(token)]);
  // First poll after a page load (no sig yet): don't replay old offers as phantom calls. If the server restarted and
  // its counter is behind the phone's, start over from 0.
  let from = sinceSig === '' || sinceSig == null ? signalSeq : Number(sinceSig) || 0;
  if (from > signalSeq) from = 0;
  const sig = signals.filter((s) => s.to === u.id && s.n > from);
  return { msgs, seq, people, signals: sig, sigSeq: signalSeq };
}
async function markRead(token, otherId) { const u = await need(token); await store.markRead(u.id, otherId); return { ok: true }; }
async function logout(token) { const u = await store.userByToken(token); if (u) { u.tokens = (u.tokens || []).filter((t) => t !== token); await store.saveUser(u); } return { ok: true }; }

// ── call signalling (offers, answers, ICE) — in memory, expires fast ──
async function signal(token, body) {
  const u = await need(token);
  const to = String(body.to || '');
  if (!to) throw new Error('No recipient.');
  const s = { n: ++signalSeq, id: crypto.randomUUID(), from: u.id, to, call: String(body.call || '').slice(0, 64), kind: String(body.kind || '').slice(0, 16), mode: body.mode === 'audio' ? 'audio' : 'video', data: body.data, t: Date.now() };
  signals.push(s);
  signalListeners.forEach((fn) => { try { fn(s); } catch {} });
  const cutoff = Date.now() - 90000;
  while (signals.length && (signals[0].t < cutoff || signals.length > 4000)) signals.shift();
  return { ok: true, n: s.n };
}
async function stats() { return store.count(); }

const onSignal = (fn) => signalListeners.push(fn);

module.exports = { onSignal, signup, login, me, updateMe, directory, send, inbox, markRead, logout, signal, stats };
