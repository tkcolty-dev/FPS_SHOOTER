// ☁ CloudLift — better cloud variables for your Scratch projects.
//
// 1. Speaks the Scratch cloud-variable websocket protocol, so TurboWarp can
//    use THIS server instead of Scratch's (?cloud_host=ws://...): no 10-var
//    limit headaches, instant updates, and a live dashboard.
// 2. Optionally "bridges" to the real scratch.mit.edu cloud for a project,
//    syncing ☁ variables both ways — so players on the Scratch website and
//    players on your server share the same data.

const http = require('http');
const fs = require('fs');
const path = require('path');
const express = require('express');
const { WebSocketServer, WebSocket } = require('ws');

const PORT = process.env.PORT || 4995;
const DATA_FILE = path.join(__dirname, 'data.json');
const CONFIG_FILE = path.join(__dirname, 'config.json');
const HISTORY_MAX = 400;
const UA = 'CloudLift/1.0 (local Scratch cloud helper)';

// ---------- persistence (Postgres on Cloud Foundry, JSON files locally) ----------
function loadJSON(file, fallback) {
  try { return JSON.parse(fs.readFileSync(file, 'utf8')); } catch { return fallback; }
}
let data = { projects: {} };   // projects[id] = {title, author, bridge, vars:{name:{value,updated,source}}, history:[]}
let config = { scratch: null }; // scratch = {username, sessionId}

function pgUri() {
  try {
    const vcap = JSON.parse(process.env.VCAP_SERVICES);
    for (const list of Object.values(vcap)) {
      for (const svc of list) {
        const c = svc.credentials || {};
        const uri = c.uri || c.url;
        if (uri && /^postgres/.test(uri)) return uri;
      }
    }
  } catch {}
  return process.env.DATABASE_URL || null;
}

let pool = null;
async function initStorage() {
  const uri = pgUri();
  if (uri) {
    const { Pool } = require('pg');
    for (const ssl of [false, { rejectUnauthorized: false }]) {
      try {
        pool = new Pool({ connectionString: uri, ssl });
        await pool.query('CREATE TABLE IF NOT EXISTS kv (key TEXT PRIMARY KEY, value JSONB)');
        break;
      } catch (e) {
        try { await pool.end(); } catch {}
        pool = null;
        if (ssl !== false) throw e;
      }
    }
    const res = await pool.query('SELECT key, value FROM kv');
    for (const row of res.rows) {
      if (row.key === 'data') data = row.value;
      if (row.key === 'config') config = row.value;
    }
    console.log('  storage: postgres');
  } else {
    data = loadJSON(DATA_FILE, data);
    config = loadJSON(CONFIG_FILE, config);
    console.log('  storage: local files');
  }
}
async function persist(key, value, file) {
  if (pool) {
    await pool.query(
      'INSERT INTO kv (key, value) VALUES ($1, $2) ON CONFLICT (key) DO UPDATE SET value = $2',
      [key, JSON.stringify(value)]
    ).catch((e) => console.log('save error:', e.message));
  } else {
    fs.writeFileSync(file, JSON.stringify(value, null, 2));
  }
}

let saveTimer = null;
function saveSoon() {
  if (saveTimer) return;
  saveTimer = setTimeout(() => {
    saveTimer = null;
    persist('data', data, DATA_FILE);
  }, 800);
}
function saveConfig() {
  persist('config', config, CONFIG_FILE);
}

// ---------- scratch login ----------
async function scratchLogin(username, password) {
  const res = await fetch('https://scratch.mit.edu/login/', {
    method: 'POST',
    headers: {
      'x-csrftoken': 'a',
      'x-requested-with': 'XMLHttpRequest',
      'Cookie': 'scratchcsrftoken=a;scratchlanguage=en;',
      'referer': 'https://scratch.mit.edu',
      'user-agent': UA,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ username, password, useMessages: true }),
  });
  const setCookie = res.headers.get('set-cookie') || '';
  const m = setCookie.match(/scratchsessionsid="?([^";,]+)"?/);
  let body = null;
  try { body = await res.json(); } catch {}
  const entry = Array.isArray(body) ? body[0] : body;
  if (!m || (entry && entry.success === 0)) {
    const msg = (entry && entry.msg) || 'Login failed — check your username and password.';
    throw new Error(msg);
  }
  return { username: (entry && entry.username) || username, sessionId: m[1] };
}

async function fetchProjectInfo(id) {
  try {
    const res = await fetch(`https://api.scratch.mit.edu/projects/${id}`, { headers: { 'user-agent': UA } });
    if (!res.ok) return null;
    const j = await res.json();
    return { title: j.title, author: j.author && j.author.username };
  } catch { return null; }
}

// ---------- core state helpers ----------
function getProject(id) { return data.projects[id]; }

function setVar(projectId, name, value, source) {
  const p = getProject(projectId);
  if (!p) return false;
  value = String(value);
  const existing = p.vars[name];
  if (existing && existing.value === value) return false; // no change → no echo loops
  p.vars[name] = { value, updated: Date.now(), source };
  p.history.push({ t: Date.now(), name, value, source });
  if (p.history.length > HISTORY_MAX) p.history.splice(0, p.history.length - HISTORY_MAX);
  saveSoon();
  return true;
}

// Scratch's real cloud only accepts number-looking values up to 256 chars
function scratchSafe(value) {
  const s = String(value);
  return s.length > 0 && s.length <= 256 && /^-?\d+(\.\d+)?$/.test(s);
}

// ---------- websocket rooms (TurboWarp players + dashboards) ----------
const rooms = new Map(); // projectId -> Set<ws>  (cloud-protocol clients)
const dashboards = new Set();

function roomFor(id) {
  if (!rooms.has(id)) rooms.set(id, new Set());
  return rooms.get(id);
}
function playersIn(id) { return rooms.has(id) ? rooms.get(id).size : 0; }

function broadcastToPlayers(projectId, name, value, except) {
  const msg = JSON.stringify({ method: 'set', name, value }) + '\n';
  for (const ws of roomFor(projectId)) {
    if (ws !== except && ws.readyState === WebSocket.OPEN) ws.send(msg);
  }
}
function tellDashboards(obj) {
  const msg = JSON.stringify(obj);
  for (const ws of dashboards) if (ws.readyState === WebSocket.OPEN) ws.send(msg);
}
function announceVar(projectId, name, value, source) {
  tellDashboards({ type: 'var', projectId, name, value, source, t: Date.now() });
}
function announceStatus(projectId) {
  const b = bridges.get(projectId);
  tellDashboards({
    type: 'status', projectId,
    bridge: b ? b.status : (getProject(projectId) && getProject(projectId).bridge ? 'offline' : 'off'),
    players: playersIn(projectId),
  });
}

// ---------- the bridge to real scratch.mit.edu cloud ----------
const bridges = new Map(); // projectId -> Bridge

class Bridge {
  constructor(projectId) {
    this.projectId = String(projectId);
    this.status = 'connecting';
    this.ws = null;
    this.queue = [];
    this.sending = false;
    this.stopped = false;
    this.retryMs = 2000;
    this.connect();
  }
  connect() {
    if (this.stopped || !config.scratch) return;
    this.status = 'connecting';
    announceStatus(this.projectId);
    const ws = new WebSocket('wss://clouddata.scratch.mit.edu', {
      headers: {
        cookie: `scratchsessionsid=${config.scratch.sessionId};`,
        origin: 'https://scratch.mit.edu',
        'user-agent': UA,
      },
    });
    this.ws = ws;
    ws.on('open', () => {
      ws.send(JSON.stringify({
        method: 'handshake',
        user: config.scratch.username,
        project_id: this.projectId,
      }) + '\n');
      this.status = 'connected';
      this.retryMs = 2000;
      console.log(`[bridge ${this.projectId}] connected to Scratch cloud`);
      announceStatus(this.projectId);
      this.drain(); // send anything queued while we were reconnecting
    });
    ws.on('message', (buf) => {
      for (const line of buf.toString().split('\n')) {
        if (!line.trim()) continue;
        let msg; try { msg = JSON.parse(line); } catch { continue; }
        if (msg.method === 'set') {
          if (setVar(this.projectId, msg.name, msg.value, 'scratch')) {
            broadcastToPlayers(this.projectId, msg.name, msg.value, null);
            announceVar(this.projectId, msg.name, msg.value, 'scratch');
          }
        }
      }
    });
    const onDown = () => {
      if (this.ws !== ws) return;
      this.ws = null;
      if (this.stopped) return;
      this.status = 'offline';
      announceStatus(this.projectId);
      setTimeout(() => this.connect(), this.retryMs);
      this.retryMs = Math.min(this.retryMs * 2, 30000);
    };
    ws.on('close', onDown);
    ws.on('error', (e) => { console.log(`[bridge ${this.projectId}] error: ${e.message}`); ws.close(); });
  }
  // push a variable change up to real Scratch (rate-limited: 1 per 100ms)
  pushSet(name, value) {
    if (!name.startsWith('☁') || !scratchSafe(value)) return; // Scratch would reject it
    this.queue = this.queue.filter((q) => q.name !== name); // only latest value per var matters
    this.queue.push({ name, value: String(value) });
    this.drain();
  }
  drain() {
    if (this.sending) return;
    this.sending = true;
    const tick = () => {
      // if we're disconnected, keep the queue — it drains after reconnect
      if (!this.ws || this.ws.readyState !== WebSocket.OPEN) { this.sending = false; return; }
      const item = this.queue.shift();
      if (!item) { this.sending = false; return; }
      this.ws.send(JSON.stringify({
        method: 'set',
        name: item.name,
        value: item.value,
        user: config.scratch.username,
        project_id: this.projectId,
      }) + '\n');
      setTimeout(tick, 100);
    };
    tick();
  }
  stop() {
    this.stopped = true;
    this.status = 'off';
    if (this.ws) try { this.ws.close(); } catch {}
    announceStatus(this.projectId);
  }
}

function syncBridges() {
  for (const [id, p] of Object.entries(data.projects)) {
    const want = p.bridge && config.scratch;
    const have = bridges.get(id);
    if (want && !have) bridges.set(id, new Bridge(id));
    if (!want && have) { have.stop(); bridges.delete(id); }
  }
  for (const [id, b] of bridges) if (!data.projects[id]) { b.stop(); bridges.delete(id); }
}

// ---------- express app ----------
const app = express();
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

function publicState() {
  const projects = {};
  for (const [id, p] of Object.entries(data.projects)) {
    const b = bridges.get(id);
    projects[id] = {
      title: p.title, author: p.author, bridge: p.bridge,
      bridgeStatus: b ? b.status : (p.bridge ? 'offline' : 'off'),
      players: playersIn(id),
      vars: p.vars,
      history: p.history.slice(-HISTORY_MAX),
    };
  }
  return {
    scratch: config.scratch ? { username: config.scratch.username } : null,
    port: PORT,
    projects,
  };
}

app.get('/api/state', (req, res) => res.json(publicState()));

app.post('/api/login', async (req, res) => {
  const { username, password } = req.body || {};
  if (!username || !password) return res.status(400).json({ error: 'Enter a username and password.' });
  try {
    const session = await scratchLogin(username, password);
    config.scratch = session;
    saveConfig();
    syncBridges();
    tellDashboards({ type: 'login', username: session.username });
    res.json({ ok: true, username: session.username });
  } catch (e) {
    res.status(401).json({ error: e.message });
  }
});

app.post('/api/logout', (req, res) => {
  config.scratch = null;
  saveConfig();
  syncBridges();
  tellDashboards({ type: 'login', username: null });
  res.json({ ok: true });
});

app.post('/api/projects', async (req, res) => {
  let { id, bridge } = req.body || {};
  const m = String(id || '').match(/(\d{4,})/);
  if (!m) return res.status(400).json({ error: 'Paste a project link or ID (the number in the URL).' });
  id = m[1];
  if (!data.projects[id]) {
    data.projects[id] = { title: null, author: null, bridge: !!bridge, vars: {}, history: [] };
  } else {
    data.projects[id].bridge = !!bridge;
  }
  const info = await fetchProjectInfo(id);
  if (info) { data.projects[id].title = info.title; data.projects[id].author = info.author; }
  saveSoon();
  syncBridges();
  tellDashboards({ type: 'refresh' });
  res.json({ ok: true, id, title: info && info.title });
});

app.delete('/api/projects/:id', (req, res) => {
  delete data.projects[req.params.id];
  saveSoon();
  syncBridges();
  tellDashboards({ type: 'refresh' });
  res.json({ ok: true });
});

app.post('/api/projects/:id/bridge', (req, res) => {
  const p = getProject(req.params.id);
  if (!p) return res.status(404).json({ error: 'No such project' });
  p.bridge = !!(req.body && req.body.on);
  saveSoon();
  syncBridges();
  announceStatus(req.params.id);
  res.json({ ok: true });
});

// dashboard sets/creates a variable
app.post('/api/projects/:id/set', (req, res) => {
  const id = req.params.id;
  const { name, value } = req.body || {};
  if (!getProject(id)) return res.status(404).json({ error: 'No such project' });
  if (!name) return res.status(400).json({ error: 'Variable needs a name' });
  if (setVar(id, name, value, 'dashboard')) {
    broadcastToPlayers(id, name, String(value), null);
    announceVar(id, name, String(value), 'dashboard');
    const b = bridges.get(id);
    if (b) b.pushSet(name, String(value));
  }
  res.json({ ok: true });
});

app.delete('/api/projects/:id/vars/:name', (req, res) => {
  const p = getProject(req.params.id);
  if (p && p.vars[decodeURIComponent(req.params.name)]) {
    delete p.vars[decodeURIComponent(req.params.name)];
    saveSoon();
    tellDashboards({ type: 'refresh' });
  }
  res.json({ ok: true });
});

// ---------- websockets ----------
const server = http.createServer(app);
const wss = new WebSocketServer({ server });

wss.on('connection', (ws, req) => {
  if ((req.url || '/').startsWith('/dash')) {
    // dashboard live feed
    dashboards.add(ws);
    ws.send(JSON.stringify({ type: 'snapshot', state: publicState() }));
    ws.on('close', () => dashboards.delete(ws));
    return;
  }

  // Scratch cloud protocol client (TurboWarp / packager)
  let projectId = null;
  let user = 'player';
  ws.on('message', (buf) => {
    for (const line of buf.toString().split('\n')) {
      if (!line.trim()) continue;
      let msg; try { msg = JSON.parse(line); } catch { continue; }

      if (msg.method === 'handshake') {
        projectId = String(msg.project_id);
        user = msg.user || 'player';
        if (!data.projects[projectId]) {
          // auto-add unknown projects so they Just Work
          data.projects[projectId] = { title: null, author: null, bridge: false, vars: {}, history: [] };
          fetchProjectInfo(projectId).then((info) => {
            if (info) { data.projects[projectId].title = info.title; data.projects[projectId].author = info.author; saveSoon(); tellDashboards({ type: 'refresh' }); }
          });
          saveSoon();
          tellDashboards({ type: 'refresh' });
        }
        roomFor(projectId).add(ws);
        const p = getProject(projectId);
        const lines = Object.entries(p.vars).map(([name, v]) => JSON.stringify({ method: 'set', name, value: v.value }));
        if (lines.length) ws.send(lines.join('\n') + '\n');
        console.log(`[cloud ${projectId}] ${user} joined (${playersIn(projectId)} online)`);
        announceStatus(projectId);
      } else if ((msg.method === 'set' || msg.method === 'create') && projectId) {
        if (setVar(projectId, msg.name, msg.value, user)) {
          broadcastToPlayers(projectId, msg.name, String(msg.value), ws);
          announceVar(projectId, msg.name, String(msg.value), user);
          const b = bridges.get(projectId);
          if (b) b.pushSet(msg.name, String(msg.value));
        }
      }
    }
  });
  ws.on('close', () => {
    if (projectId && rooms.has(projectId)) {
      rooms.get(projectId).delete(ws);
      console.log(`[cloud ${projectId}] ${user} left (${playersIn(projectId)} online)`);
      announceStatus(projectId);
    }
  });
  ws.on('error', () => {});
});

// keep dashboards' player counts fresh-ish
setInterval(() => { for (const id of rooms.keys()) announceStatus(id); }, 10000);

initStorage().then(() => {
  server.listen(PORT, () => {
    console.log('');
    console.log('  ☁ CloudLift is running!');
    console.log(`  Dashboard:  http://localhost:${PORT}`);
    console.log(`  Cloud host: ws://localhost:${PORT}  (for TurboWarp ?cloud_host=)`);
    console.log('');
    syncBridges();
  });
}).catch((e) => { console.error('storage failed:', e); process.exit(1); });
