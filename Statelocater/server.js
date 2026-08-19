// StateLocater — Express server: static app + tiny auth + progress save.
// Storage: Postgres when VCAP_SERVICES (Cloud Foundry) or DATABASE_URL is present, else data/*.json files.
const express = require('express');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const app = express();
app.set('trust proxy', 1);
app.use(express.json({ limit: '1mb' }));

// ---------- storage ----------
function pgConfig() {
  if (process.env.VCAP_SERVICES) {
    try {
      const vcap = JSON.parse(process.env.VCAP_SERVICES);
      const svc = Object.values(vcap).flat().find(s => /postgres/i.test(s.label || '') || /postgres/i.test((s.tags || []).join(',')) || /postgres/i.test(s.name || ''));
      if (svc) {
        const c = svc.credentials || {};
        if (c.uri || c.url || c.jdbcUrl) return { connectionString: (c.uri || c.url || '').replace(/^jdbc:/, ''), ssl: false };
        return { host: c.hostname || c.host || (c.hosts && c.hosts[0]), port: c.port || 5432, database: c.db || c.name || c.dbname || c.database || 'postgres', user: c.user || c.username, password: c.password, ssl: false };
      }
    } catch (e) { console.error('VCAP_SERVICES parse error', e.message); }
  }
  if (process.env.DATABASE_URL) return { connectionString: process.env.DATABASE_URL, ssl: process.env.PGSSL === '1' ? { rejectUnauthorized: false } : false };
  return null;
}

const DATA = path.join(__dirname, 'data');
let store;
function fileStore() {
  fs.mkdirSync(DATA, { recursive: true });
  const f = (k) => path.join(DATA, k.replace(/[^\w.-]/g, '_') + '.json');
  return {
    name: 'files',
    async init() {},
    async get(k) { try { return JSON.parse(fs.readFileSync(f(k), 'utf8')); } catch { return null; } },
    async set(k, v) { fs.writeFileSync(f(k) + '.tmp', JSON.stringify(v)); fs.renameSync(f(k) + '.tmp', f(k)); },
    async del(k) { try { fs.unlinkSync(f(k)); } catch {} },
  };
}
function pgStore(cfg) {
  const { Pool } = require('pg');
  const pool = new Pool({ ...cfg, max: 4 });
  return {
    name: 'postgres',
    async init() { await pool.query('CREATE TABLE IF NOT EXISTS docs (key text PRIMARY KEY, value jsonb NOT NULL, updated_at timestamptz DEFAULT now())'); },
    async get(k) { const r = await pool.query('SELECT value FROM docs WHERE key=$1', [k]); return r.rows[0]?.value ?? null; },
    async set(k, v) { await pool.query('INSERT INTO docs (key,value,updated_at) VALUES ($1,$2,now()) ON CONFLICT (key) DO UPDATE SET value=EXCLUDED.value, updated_at=now()', [k, JSON.stringify(v)]); },
    async del(k) { await pool.query('DELETE FROM docs WHERE key=$1', [k]); },
  };
}

// ---------- auth ----------
const norm = (u) => String(u || '').trim().toLowerCase().replace(/\s+/g, ' ').slice(0, 40);
const hashPw = (pw, salt = crypto.randomBytes(16).toString('hex')) => salt + ':' + crypto.scryptSync(pw, salt, 32).toString('hex');
const checkPw = (pw, stored) => { const [salt, h] = String(stored).split(':'); try { return crypto.timingSafeEqual(Buffer.from(h, 'hex'), crypto.scryptSync(pw, salt, 32)); } catch { return false; } };
const cookies = (req) => { const out = {}; (req.headers.cookie || '').split(';').forEach(c => { const i = c.indexOf('='); if (i > 0) out[c.slice(0, i).trim()] = decodeURIComponent(c.slice(i + 1).trim()); }); return out; };
const setSid = (res, req, token, maxAge) => res.setHeader('Set-Cookie', `sl_sid=${token}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${maxAge}${req.secure ? '; Secure' : ''}`);
const SESSION_DAYS = 120;

async function auth(req, res, next) {
  const sid = cookies(req).sl_sid;
  if (!sid) return next();
  const s = await store.get('sess:' + sid);
  if (s && Date.now() - s.t < SESSION_DAYS * 864e5) {
    req.user = s.u; req.sid = sid;
    if (Date.now() - s.t > 864e5) { s.t = Date.now(); await store.set('sess:' + sid, s); setSid(res, req, sid, SESSION_DAYS * 86400); }
  }
  next();
}
app.use('/api', auth);

app.post('/api/register', async (req, res) => {
  const u = norm(req.body.user), pw = String(req.body.pass || '');
  if (u.length < 2) return res.status(400).json({ error: 'Name must be at least 2 characters.' });
  if (pw.length < 4) return res.status(400).json({ error: 'Password must be at least 4 characters.' });
  if (await store.get('user:' + u)) return res.status(409).json({ error: 'That name is taken — try signing in.' });
  await store.set('user:' + u, { name: u, pw: hashPw(pw), created: Date.now() });
  const sid = crypto.randomBytes(24).toString('hex');
  await store.set('sess:' + sid, { u, t: Date.now() });
  setSid(res, req, sid, SESSION_DAYS * 86400);
  res.json({ ok: true, user: u, progress: null });
});
app.post('/api/login', async (req, res) => {
  const u = norm(req.body.user), pw = String(req.body.pass || '');
  const rec = await store.get('user:' + u);
  if (!rec || !checkPw(pw, rec.pw)) return res.status(401).json({ error: 'Wrong name or password.' });
  const sid = crypto.randomBytes(24).toString('hex');
  await store.set('sess:' + sid, { u, t: Date.now() });
  setSid(res, req, sid, SESSION_DAYS * 86400);
  res.json({ ok: true, user: u, progress: await store.get('prog:' + u) });
});
app.post('/api/logout', async (req, res) => { if (req.sid) await store.del('sess:' + req.sid); res.setHeader('Set-Cookie', 'sl_sid=; Path=/; Max-Age=0'); res.json({ ok: true }); });
app.get('/api/me', async (req, res) => {
  if (!req.user) return res.json({ user: null });
  res.json({ user: req.user, progress: await store.get('prog:' + req.user) });
});
app.get('/api/progress', async (req, res) => {
  if (!req.user) return res.status(401).json({ error: 'not signed in' });
  res.json({ progress: await store.get('prog:' + req.user) });
});
app.put('/api/progress', async (req, res) => {
  if (!req.user) return res.status(401).json({ error: 'not signed in' });
  const p = req.body && req.body.progress;
  if (!p || typeof p !== 'object') return res.status(400).json({ error: 'bad body' });
  const cur = await store.get('prog:' + req.user);
  if (cur && cur.updatedAt > p.updatedAt && !req.body.force) return res.json({ ok: true, progress: cur, stale: true });
  await store.set('prog:' + req.user, p);
  res.json({ ok: true });
});
app.get('/api/health', (req, res) => res.json({ ok: true, storage: store.name }));

app.use(express.static(path.join(__dirname, 'public'), { maxAge: process.env.NODE_ENV === 'production' ? '1h' : 0, etag: true }));
app.get('/{*path}', (req, res) => res.sendFile(path.join(__dirname, 'public', 'index.html')));

(async () => {
  const cfg = pgConfig();
  store = cfg ? pgStore(cfg) : fileStore();
  try { await store.init(); } catch (e) { console.error('Storage init failed, falling back to files:', e.message); store = fileStore(); }
  const PORT = process.env.PORT || 4990;
  const srv = app.listen(PORT, () => console.log(`StateLocater on http://localhost:${PORT} (storage: ${store.name})`));
  attachWs(srv);
})();

// ---------- multiplayer race (WebSocket) ----------
// Rooms are in-memory (single instance). Protocol: JSON {t, ...}.
const { WebSocketServer } = require('ws');
const ROOMS = new Map(); // code -> room
const CODE_CHARS = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
const mkCode = () => { let c = ''; do { c = Array.from({ length: 4 }, () => CODE_CHARS[Math.floor(Math.random() * CODE_CHARS.length)]).join(''); } while (ROOMS.has(c)); return c; };
const ALL_STATES = JSON.parse(fs.readFileSync(path.join(__dirname, 'public', 'states.json'))).states;
const ROUND_MS = 14000, BETWEEN_MS = 2500, POINTS = 100;

function roomSend(room, msg, except) { const s = JSON.stringify(msg); for (const p of room.players.values()) { if (p.ws !== except && p.ws.readyState === 1) p.ws.send(s); } }
function roster(room) { return [...room.players.values()].map(p => ({ id: p.id, name: p.name, score: p.score, host: p.id === room.hostId, done: p.done })); }
function cleanupRoom(code) { const r = ROOMS.get(code); if (r && r.players.size === 0) { clearTimeout(r.timer); ROOMS.delete(code); } }

function startRound(room) {
  if (room.round >= room.prompts.length) {
    room.state = 'ended'; roomSend(room, { t: 'gameEnd', roster: roster(room) }); return;
  }
  const pr = room.prompts[room.round];
  room.roundState = { answered: new Set(), winner: null, t0: Date.now() };
  room.state = 'playing';
  roomSend(room, { t: 'round', i: room.round, n: room.prompts.length, prompt: { type: pr.type, text: pr.text }, ms: ROUND_MS, roster: roster(room) });
  clearTimeout(room.timer);
  room.timer = setTimeout(() => endRound(room, null), ROUND_MS);
}
function endRound(room, winnerId) {
  clearTimeout(room.timer);
  const pr = room.prompts[room.round];
  roomSend(room, { t: 'roundEnd', i: room.round, answer: pr.abbr, name: pr.name, capital: pr.capital, winner: winnerId, roster: roster(room) });
  room.round++;
  room.timer = setTimeout(() => startRound(room), BETWEEN_MS);
}
function buildPrompts(n, mode) {
  const pool = ALL_STATES.slice();
  for (let i = pool.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [pool[i], pool[j]] = [pool[j], pool[i]]; }
  return pool.slice(0, n).map(s => {
    const cap = mode === 'capitals' || (mode === 'mixed' && Math.random() < .5);
    return { abbr: s.abbr, name: s.name, capital: s.capital, type: 'find', text: cap ? `Tap the state whose capital is ${s.capital}` : `Tap ${s.name}` };
  });
}

function attachWs(server) {
  const wss = new WebSocketServer({ server, path: '/ws' });
  let nextId = 1;
  wss.on('connection', (ws) => {
    let room = null, me = null;
    const send = (msg) => { if (ws.readyState === 1) ws.send(JSON.stringify(msg)); };
    ws.on('message', (raw) => {
      let m; try { m = JSON.parse(raw); } catch { return; }
      try {
        if (m.t === 'create') {
          const code = mkCode(); me = { id: 'p' + (nextId++), name: String(m.name || 'Player').slice(0, 20), score: 0, ws };
          room = { code, hostId: me.id, players: new Map([[me.id, me]]), state: 'lobby', round: 0, prompts: [], timer: null };
          ROOMS.set(code, room);
          send({ t: 'room', code, you: me.id, roster: roster(room), state: room.state });
        } else if (m.t === 'join') {
          const r = ROOMS.get(String(m.code || '').toUpperCase().trim());
          if (!r) return send({ t: 'err', msg: 'No room with that code. Check it and try again.' });
          if (r.players.size >= 8) return send({ t: 'err', msg: 'Room is full (8 max).' });
          me = { id: 'p' + (nextId++), name: String(m.name || 'Player').slice(0, 20), score: 0, ws };
          room = r; room.players.set(me.id, me);
          send({ t: 'room', code: room.code, you: me.id, roster: roster(room), state: room.state });
          roomSend(room, { t: 'roster', roster: roster(room) }, ws);
        } else if (!room || !me) {
          return;
        } else if (m.t === 'start' && me.id === room.hostId && room.state !== 'playing') {
          for (const p of room.players.values()) p.score = 0;
          room.prompts = buildPrompts(Math.min(20, Math.max(5, +m.rounds || 10)), ['states', 'capitals', 'mixed'].includes(m.mode) ? m.mode : 'mixed');
          room.round = 0;
          roomSend(room, { t: 'starting', in: 3000, roster: roster(room) });
          clearTimeout(room.timer); room.timer = setTimeout(() => startRound(room), 3000);
        } else if (m.t === 'tap' && room.state === 'playing' && room.roundState && !room.roundState.winner) {
          const rs = room.roundState; if (rs.answered.has(me.id)) return;
          const pr = room.prompts[room.round];
          if (m.abbr === pr.abbr) {
            rs.winner = me.id;
            const speed = Math.max(0, 1 - (Date.now() - rs.t0) / ROUND_MS);
            me.score += POINTS + Math.round(speed * 50);
            endRound(room, me.id);
          } else {
            rs.answered.add(me.id);
            send({ t: 'wrong', abbr: m.abbr });
            roomSend(room, { t: 'missed', id: me.id, name: me.name }, ws);
            if (rs.answered.size >= room.players.size) endRound(room, null);
          }
        } else if (m.t === 'chat') {
          roomSend(room, { t: 'chat', name: me.name, msg: String(m.msg || '').slice(0, 140) });
        }
      } catch (e) { console.error('ws error', e.message); }
    });
    ws.on('close', () => {
      if (room && me) {
        room.players.delete(me.id);
        if (me.id === room.hostId && room.players.size) room.hostId = [...room.players.keys()][0];
        roomSend(room, { t: 'roster', roster: roster(room) });
        cleanupRoom(room.code);
      }
    });
  });
}
