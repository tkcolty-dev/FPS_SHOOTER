// ☁🔌 CloudPlug — plug your Scratch game into the cloud.
//
// A Scratch project (on scratch.mit.edu, no extensions needed) talks to this server through its
// cloud variables using the scratchattach "cloud requests" protocol: the project writes an encoded
// request into ☁ TO_HOST, this server runs it and writes the answer back into ☁ FROM_HOST_1..9.
// That gives a normal Scratch game: permanent saves, per-player saves, lists, leaderboards, counters,
// chat, mail, unlimited text cloud variables, web fetch, JSON, server time, and an AI helper.
//
// Three ways in:
//   1. scratch.mit.edu  — log in with your Scratch account on the dashboard, add the project id; the
//                          server joins the project's cloud like a player ("bridge").
//   2. TurboWarp/packager — ?cloud_host=wss://<this server>  (this server also speaks the cloud protocol)
//   3. TurboWarp extension — /extension.js gives real blocks (no encoding, instant, unlimited).

const http = require('http');
const fs = require('fs');
const path = require('path');
const express = require('express');
const { WebSocketServer, WebSocket } = require('ws');
const proto = require('./protocol');
const { makeHandlers, HELP } = require('./handlers');

const PORT = process.env.PORT || 4960;
const DATA_DIR = process.env.DATA_DIR || __dirname;
const DATA_FILE = path.join(DATA_DIR, 'data.json');
const CONFIG_FILE = path.join(DATA_DIR, 'config.json');
const UA = 'CloudPlug/1.0 (Scratch cloud requests server)';
const LOG_MAX = 300;

// ---------- persistence (Postgres on Cloud Foundry, JSON files locally) ----------
function loadJSON(file, fallback) { try { return JSON.parse(fs.readFileSync(file, 'utf8')); } catch { return fallback; } }
let data = { projects: {} };
let config = { scratch: null, adminKey: null };

function pgUri() {
  try {
    const vcap = JSON.parse(process.env.VCAP_SERVICES);
    for (const list of Object.values(vcap)) for (const svc of list) {
      const c = svc.credentials || {}; const uri = c.uri || c.url;
      if (uri && /^postgres/.test(uri)) return uri;
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
      } catch (e) { try { await pool.end(); } catch {} pool = null; if (ssl !== false) throw e; }
    }
    const res = await pool.query('SELECT key, value FROM kv');
    for (const row of res.rows) { if (row.key === 'data') data = row.value; if (row.key === 'config') config = row.value; }
    console.log('  storage: postgres');
  } else {
    data = loadJSON(DATA_FILE, data); config = loadJSON(CONFIG_FILE, config);
    console.log('  storage: local files');
  }
  for (const p of Object.values(data.projects)) normalizeProject(p);
}
async function persist(key, value, file) {
  if (pool) {
    await pool.query('INSERT INTO kv (key, value) VALUES ($1, $2) ON CONFLICT (key) DO UPDATE SET value = $2', [key, JSON.stringify(value)])
      .catch((e) => console.log('save error:', e.message));
  } else fs.writeFileSync(file, JSON.stringify(value, null, 2));
}
let saveTimer = null;
function saveSoon() { if (saveTimer) return; saveTimer = setTimeout(() => { saveTimer = null; persist('data', data, DATA_FILE); }, 700); }
function saveConfig() { persist('config', config, CONFIG_FILE); }

function normalizeProject(p) {
  p.kv = p.kv || {}; p.users = p.users || {}; p.lists = p.lists || {}; p.boards = p.boards || {};
  p.chat = p.chat || []; p.mail = p.mail || {}; p.vars = p.vars || {}; p.log = p.log || [];
  p.stats = p.stats || { requests: 0 }; p.seen = p.seen || {}; p.settings = p.settings || {};
  if (p.enabled === undefined) p.enabled = true;
  return p;
}
function getProject(id) { return data.projects[id]; }
function ensureProject(id, extra = {}) {
  id = String(id);
  if (!data.projects[id]) {
    data.projects[id] = normalizeProject({ title: null, author: null, enabled: true, bridge: false, ...extra });
    saveSoon(); tellDashboards({ type: 'refresh' });
    if (/^\d+$/.test(id)) fetchProjectInfo(id).then((info) => { if (info) { data.projects[id].title = info.title; data.projects[id].author = info.author; saveSoon(); tellDashboards({ type: 'refresh' }); } });
  }
  return data.projects[id];
}

// ---------- scratch.mit.edu helpers ----------
async function scratchLogin(username, password) {
  const res = await fetch('https://scratch.mit.edu/login/', {
    method: 'POST',
    headers: { 'x-csrftoken': 'a', 'x-requested-with': 'XMLHttpRequest', Cookie: 'scratchcsrftoken=a;scratchlanguage=en;', referer: 'https://scratch.mit.edu', 'user-agent': UA, 'Content-Type': 'application/json' },
    body: JSON.stringify({ username, password, useMessages: true }),
  });
  const setCookie = res.headers.get('set-cookie') || '';
  const m = setCookie.match(/scratchsessionsid="?([^";,]+)"?/);
  let body = null; try { body = await res.json(); } catch {}
  const entry = Array.isArray(body) ? body[0] : body;
  if (!m || (entry && entry.success === 0)) throw new Error((entry && entry.msg) || 'Login failed — check your username and password.');
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
// Who sent a TO_HOST value? The cloud websocket doesn't say, but Scratch's public cloud log does.
const logCache = new Map(); // projectId -> {t, rows}
async function lookupRequester(projectId, value) {
  try {
    let entry = logCache.get(projectId);
    if (!entry || Date.now() - entry.t > 1500) {
      const res = await fetch(`https://clouddata.scratch.mit.edu/logs?projectid=${projectId}&limit=40&offset=0`, { headers: { 'user-agent': UA } });
      entry = { t: Date.now(), rows: res.ok ? await res.json() : [] };
      logCache.set(projectId, entry);
    }
    const row = entry.rows.find((r) => r.name === '☁ TO_HOST' && String(r.value) === String(value));
    return row ? row.user : null;
  } catch { return null; }
}

// ---------- live feeds ----------
const dashboards = new Set();
function tellDashboards(obj) { const msg = JSON.stringify(obj); for (const ws of dashboards) if (ws.readyState === WebSocket.OPEN) ws.send(msg); }
function logEvent(projectId, entry) {
  const p = getProject(projectId); if (!p) return;
  entry.t = Date.now();
  p.log.push(entry); if (p.log.length > LOG_MAX) p.log.splice(0, p.log.length - LOG_MAX);
  tellDashboards({ type: 'log', projectId, entry });
}

// ---------- transports: things that can carry FROM_HOST / TO_HOST ----------
// Each transport has: sendVar(name, value), rate (ms between sets), and calls onRequest(value, meta).

// (1) our own cloud host — TurboWarp / packager / Scratch Together connect here with ?cloud_host=
const rooms = new Map(); // projectId -> Set<ws>
function roomFor(id) { if (!rooms.has(id)) rooms.set(id, new Set()); return rooms.get(id); }
function broadcastToRoom(projectId, name, value, except) {
  const msg = JSON.stringify({ method: 'set', name, value }) + '\n';
  for (const ws of roomFor(projectId)) if (ws !== except && ws.readyState === WebSocket.OPEN) ws.send(msg);
}

// (2) the bridge into real scratch.mit.edu cloud
const bridges = new Map();
class Bridge {
  constructor(projectId) {
    this.projectId = String(projectId); this.status = 'connecting'; this.ws = null; this.stopped = false;
    this.retryMs = 2000; this.lastSet = 0; this.connect();
  }
  connect() {
    if (this.stopped || !config.scratch) return;
    this.status = 'connecting'; announceStatus(this.projectId);
    const ws = new WebSocket('wss://clouddata.scratch.mit.edu', { headers: { cookie: `scratchsessionsid=${config.scratch.sessionId};`, origin: 'https://scratch.mit.edu', 'user-agent': UA } });
    this.ws = ws;
    ws.on('open', () => {
      ws.send(JSON.stringify({ method: 'handshake', user: config.scratch.username, project_id: this.projectId }) + '\n');
      this.status = 'connected'; this.retryMs = 2000; this.lastSet = Date.now();
      console.log(`[bridge ${this.projectId}] connected to Scratch cloud`);
      announceStatus(this.projectId);
    });
    ws.on('message', (buf) => {
      for (const line of buf.toString().split('\n')) {
        if (!line.trim()) continue;
        let msg; try { msg = JSON.parse(line); } catch { continue; }
        if (msg.method === 'set') onCloudSet(this.projectId, msg.name, msg.value, { transport: 'scratch', bridge: this });
      }
    });
    const onDown = () => {
      if (this.ws !== ws) return;
      this.ws = null; if (this.stopped) return;
      this.status = 'offline'; announceStatus(this.projectId);
      setTimeout(() => this.connect(), this.retryMs); this.retryMs = Math.min(this.retryMs * 2, 30000);
    };
    ws.on('close', onDown);
    ws.on('error', (e) => { console.log(`[bridge ${this.projectId}] error: ${e.message}`); ws.close(); });
  }
  // Scratch's cloud server seems to drop the first set after a long idle — reconnect first (scratchattach does the same)
  async ready() {
    if (this.ws && this.ws.readyState === WebSocket.OPEN && Date.now() - this.lastSet < 8000) return true;
    if (this.ws) { try { this.ws.removeAllListeners('close'); this.ws.close(); } catch {} this.ws = null; }
    this.connect();
    for (let i = 0; i < 40; i++) { if (this.ws && this.ws.readyState === WebSocket.OPEN) return true; await sleep(100); }
    return false;
  }
  sendVar(name, value) {
    if (!this.ws || this.ws.readyState !== WebSocket.OPEN) return false;
    this.ws.send(JSON.stringify({ method: 'set', name, value: String(value), user: config.scratch.username, project_id: this.projectId }) + '\n');
    this.lastSet = Date.now();
    return true;
  }
  stop() { this.stopped = true; this.status = 'off'; if (this.ws) try { this.ws.close(); } catch {} announceStatus(this.projectId); }
}
function syncBridges() {
  for (const [id, p] of Object.entries(data.projects)) {
    const want = p.bridge && p.enabled && config.scratch && /^\d+$/.test(id);
    const have = bridges.get(id);
    if (want && !have) bridges.set(id, new Bridge(id));
    if (!want && have) { have.stop(); bridges.delete(id); }
  }
  for (const [id, b] of bridges) if (!data.projects[id]) { b.stop(); bridges.delete(id); }
}
function announceStatus(projectId) {
  const b = bridges.get(projectId); const p = getProject(projectId);
  tellDashboards({ type: 'status', projectId, bridge: b ? b.status : (p && p.bridge ? 'offline' : 'off'), players: roomFor(projectId).size, plugs: plugsFor(projectId).size });
}
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

// ---------- the request engine ----------
const assemblers = new Map(); // projectId -> RequestAssembler
const responders = new Map(); // projectId -> per-project send queue (Scratch allows 10 sets/sec)
const packetMemory = new Map(); // projectId -> [{requestId, packets}]
let handlers = null;

function onCloudSet(projectId, name, value, meta) {
  const p = getProject(projectId); if (!p) return;
  value = String(value);
  if (name === '☁ TO_HOST') {
    if (!p.enabled) return;
    if (!assemblers.has(projectId)) assemblers.set(projectId, new proto.RequestAssembler());
    const got = assemblers.get(projectId).feed(value);
    if (!got) return;
    if (got.resend) { resendPacket(projectId, got.resend, meta); return; }
    handleRequest(projectId, got, meta, value);
    return;
  }
  if (name.startsWith('☁ FROM_HOST_')) return; // our own echoes
  // any other cloud variable: keep it (so this server is also a plain cloud host)
  if (setPlainVar(projectId, name, value, meta.user || meta.transport)) {
    if (meta.transport === 'room') broadcastToRoom(projectId, name, value, meta.ws);
  }
}
function setPlainVar(projectId, name, value, source) {
  const p = getProject(projectId);
  const existing = p.vars[name];
  if (existing && existing.value === value) return false;
  p.vars[name] = { value, updated: Date.now(), source };
  saveSoon(); tellDashboards({ type: 'var', projectId, name, value, source });
  return true;
}

async function handleRequest(projectId, req, meta, rawValue) {
  const p = getProject(projectId);
  p.stats.requests += 1; p.stats.last = Date.now();
  const ctx = {
    projectId, project: p, args: req.args, name: req.name, transport: meta.transport,
    requester: async () => {
      if (meta.user) return meta.user;
      if (meta.transport === 'scratch') return (await lookupRequester(projectId, rawValue)) || '';
      return '';
    },
    touch: (user) => { if (user) { p.seen[user] = Date.now(); } },
    changed: () => { saveSoon(); tellDashboards({ type: 'data', projectId }); },
    push: (name, value) => pushCloudVar(projectId, name, value), // super cloud variables notify TurboWarp plugs live
  };
  let output; let ok = true;
  const started = Date.now();
  try {
    const fn = handlers[req.name];
    if (!fn) { output = `unknown request: ${req.name}`; ok = false; }
    else output = await fn(ctx, ...req.args);
  } catch (e) { output = 'error: ' + (e.message || String(e)); ok = false; }
  if (output === undefined || output === null) output = '';
  logEvent(projectId, { kind: 'request', name: req.name, args: req.args.map((a) => String(a).slice(0, 80)), ok, ms: Date.now() - started, out: Array.isArray(output) ? `[${output.length} items]` : String(output).slice(0, 120), via: meta.transport });
  if (meta.transport === 'plug') return output; // TurboWarp extension gets the raw result
  respond(projectId, req.requestId, output, meta);
}

function respond(projectId, requestId, output, meta) {
  const packets = proto.buildResponse(requestId, output);
  let mem = packetMemory.get(projectId); if (!mem) { mem = []; packetMemory.set(projectId, mem); }
  mem.push({ requestId, packets }); if (mem.length > 15) mem.shift();
  queueSend(projectId, packets, meta);
}
function resendPacket(projectId, { requestId, packet }, meta) {
  const mem = (packetMemory.get(projectId) || []).find((m) => m.requestId === requestId);
  if (mem && mem.packets[packet - 1]) queueSend(projectId, [mem.packets[packet - 1]], meta);
}
// FROM_HOST_1..9 are set round-robin, one every 100ms (Scratch's limit). Our own room can go faster.
function queueSend(projectId, packets, meta) {
  let q = responders.get(projectId);
  if (!q) { q = { items: [], running: false, next: 0 }; responders.set(projectId, q); }
  q.items.push(...packets.map((v) => ({ v, meta })));
  if (q.running) return;
  q.running = true;
  (async () => {
    while (q.items.length) {
      const { v, meta } = q.items.shift();
      const name = `☁ FROM_HOST_${(q.next % 9) + 1}`; q.next += 1;
      const p = getProject(projectId);
      if (p) { p.vars[name] = { value: v, updated: Date.now(), source: 'cloudplug' }; }
      // deliver everywhere this project is listening: the real Scratch cloud (if bridged) and our own room
      const b = bridges.get(projectId);
      let viaScratch = false;
      if (b && (meta.transport === 'scratch' || meta.transport === 'push')) { if (await b.ready()) viaScratch = b.sendVar(name, v); }
      broadcastToRoom(projectId, name, v, null);
      await sleep(viaScratch ? 100 : 20);
    }
    q.running = false;
  })();
}
// server → project message with no request (shows up in the project as a "cloud plug message")
function pushMessage(projectId, text) {
  const requestId = '100000000' + String(Math.floor(1000 + Math.random() * 9000));
  respond(projectId, requestId, text, { transport: 'push' });
  const msg = JSON.stringify({ type: 'message', text: String(text) });
  for (const ws of plugsFor(projectId)) if (ws.readyState === WebSocket.OPEN) ws.send(msg);
  logEvent(projectId, { kind: 'push', out: String(text).slice(0, 120) });
}

// ---------- TurboWarp extension websocket ("plugs") ----------
const plugs = new Map(); // projectId -> Set<ws>
function plugsFor(id) { if (!plugs.has(id)) plugs.set(id, new Set()); return plugs.get(id); }
function pushCloudVar(projectId, name, value) {
  const msg = JSON.stringify({ type: 'var', name, value });
  for (const ws of plugsFor(projectId)) if (ws.readyState === WebSocket.OPEN) ws.send(msg);
}

// ---------- express ----------
const app = express();
app.use(express.json({ limit: '1mb' }));
app.use((req, res, next) => { res.setHeader('Access-Control-Allow-Origin', '*'); res.setHeader('Access-Control-Allow-Headers', 'Content-Type'); res.setHeader('Access-Control-Allow-Methods', 'GET,POST,DELETE,OPTIONS'); if (req.method === 'OPTIONS') return res.sendStatus(204); next(); });
app.use(express.static(path.join(__dirname, 'public')));
// the browser plugin's page script, also usable as a bookmarklet / userscript when you can't install extensions
app.get('/inject.js', (req, res) => res.type('application/javascript').send(fs.readFileSync(path.join(__dirname, 'browser-extension', 'inject.js'), 'utf8')));
app.get('/browser-extension.zip', (req, res) => res.sendFile(path.join(__dirname, 'public', 'CloudPlug-browser-extension.zip')));

function publicProject(id, p) {
  const b = bridges.get(id);
  return {
    id, title: p.title, author: p.author, enabled: p.enabled, bridge: p.bridge,
    bridgeStatus: b ? b.status : (p.bridge ? 'offline' : 'off'),
    players: roomFor(id).size, plugs: plugsFor(id).size, stats: p.stats,
    kv: p.kv, users: p.users, lists: p.lists, boards: p.boards, chat: p.chat.slice(-100), mail: p.mail, vars: p.vars,
    seen: p.seen, log: p.log.slice(-LOG_MAX), settings: p.settings,
  };
}
function publicState() {
  const projects = {};
  for (const [id, p] of Object.entries(data.projects)) projects[id] = publicProject(id, p);
  return { scratch: config.scratch ? { username: config.scratch.username } : null, ai: !!handlers.__ai, projects, help: HELP, host: null };
}
app.get('/api/state', (req, res) => { const s = publicState(); s.host = req.headers.host; s.secure = req.secure || req.headers['x-forwarded-proto'] === 'https'; res.json(s); });

app.post('/api/login', async (req, res) => {
  const { username, password } = req.body || {};
  if (!username || !password) return res.status(400).json({ error: 'Enter a username and password.' });
  try {
    config.scratch = await scratchLogin(username, password); saveConfig(); syncBridges();
    tellDashboards({ type: 'login', username: config.scratch.username });
    res.json({ ok: true, username: config.scratch.username });
  } catch (e) { res.status(401).json({ error: e.message }); }
});
app.post('/api/logout', (req, res) => { config.scratch = null; saveConfig(); syncBridges(); tellDashboards({ type: 'login', username: null }); res.json({ ok: true }); });

app.post('/api/projects', async (req, res) => {
  let { id, bridge } = req.body || {};
  const m = String(id || '').match(/(\d{4,})/);
  id = m ? m[1] : String(id || '').trim().slice(0, 60);
  if (!id) return res.status(400).json({ error: 'Paste a project link / ID, or a room name for TurboWarp.' });
  const p = ensureProject(id);
  if (bridge !== undefined) p.bridge = !!bridge;
  if (!p.title && /^\d+$/.test(id)) { const info = await fetchProjectInfo(id); if (info) { p.title = info.title; p.author = info.author; } }
  saveSoon(); syncBridges(); tellDashboards({ type: 'refresh' });
  res.json({ ok: true, id });
});
app.delete('/api/projects/:id', (req, res) => { delete data.projects[req.params.id]; saveSoon(); syncBridges(); tellDashboards({ type: 'refresh' }); res.json({ ok: true }); });
app.post('/api/projects/:id/settings', (req, res) => {
  const p = getProject(req.params.id); if (!p) return res.status(404).json({ error: 'No such project' });
  const { bridge, enabled } = req.body || {};
  if (bridge !== undefined) p.bridge = !!bridge;
  if (enabled !== undefined) p.enabled = !!enabled;
  saveSoon(); syncBridges(); announceStatus(req.params.id); tellDashboards({ type: 'refresh' });
  res.json({ ok: true });
});
app.post('/api/projects/:id/push', (req, res) => {
  const p = getProject(req.params.id); if (!p) return res.status(404).json({ error: 'No such project' });
  pushMessage(req.params.id, String((req.body || {}).text || ''));
  res.json({ ok: true });
});
// run any request from the dashboard / curl (same handlers the Scratch project uses)
app.post('/api/projects/:id/run', async (req, res) => {
  const p = ensureProject(req.params.id);
  const { name, args } = req.body || {};
  const out = await handleRequest(req.params.id, { requestId: '0', name: String(name || ''), args: (args || []).map(String) }, { transport: 'plug', user: (req.body || {}).user || 'dashboard' }, '');
  res.json({ ok: true, result: out });
});
// edit stored data directly
app.post('/api/projects/:id/data', (req, res) => {
  const p = getProject(req.params.id); if (!p) return res.status(404).json({ error: 'No such project' });
  const { kind, key, sub, value, remove } = req.body || {};
  const bag = p[kind]; if (!bag || typeof bag !== 'object') return res.status(400).json({ error: 'bad kind' });
  if (remove) { if (sub !== undefined && bag[key]) delete bag[key][sub]; else delete bag[key]; }
  else if (sub !== undefined) { bag[key] = bag[key] || {}; bag[key][sub] = value; }
  else bag[key] = value;
  if (kind === 'vars') pushCloudVar(req.params.id, key, value);
  saveSoon(); tellDashboards({ type: 'data', projectId: req.params.id });
  res.json({ ok: true });
});
app.post('/api/projects/:id/clearlog', (req, res) => { const p = getProject(req.params.id); if (p) { p.log = []; saveSoon(); tellDashboards({ type: 'data', projectId: req.params.id }); } res.json({ ok: true }); });

// ---------- websockets ----------
const server = http.createServer(app);
const wss = new WebSocketServer({ server });
wss.on('connection', (ws, req) => {
  const url = req.url || '/';
  if (url.startsWith('/dash')) {
    dashboards.add(ws);
    ws.send(JSON.stringify({ type: 'snapshot', state: publicState() }));
    ws.on('close', () => dashboards.delete(ws));
    return;
  }
  if (url.startsWith('/plug')) return plugConnection(ws);

  // Scratch cloud protocol (TurboWarp ?cloud_host=, packager, Scratch Together)
  let projectId = null; let user = 'player';
  ws.on('message', (buf) => {
    for (const line of buf.toString().split('\n')) {
      if (!line.trim()) continue;
      let msg; try { msg = JSON.parse(line); } catch { continue; }
      if (msg.method === 'handshake') {
        projectId = String(msg.project_id); user = msg.user || 'player';
        const p = ensureProject(projectId);
        roomFor(projectId).add(ws);
        const lines = Object.entries(p.vars).map(([name, v]) => JSON.stringify({ method: 'set', name, value: v.value }));
        if (lines.length) ws.send(lines.join('\n') + '\n');
        p.seen[user] = Date.now();
        announceStatus(projectId);
      } else if ((msg.method === 'set' || msg.method === 'create') && projectId) {
        onCloudSet(projectId, String(msg.name), msg.value, { transport: 'room', user, ws });
      } else if (msg.method === 'rename' && projectId && msg.name && msg.new_name) {
        const p = getProject(projectId);
        if (p && p.vars[msg.name] && msg.name !== msg.new_name) { p.vars[msg.new_name] = p.vars[msg.name]; delete p.vars[msg.name]; saveSoon(); }
      } else if (msg.method === 'delete' && projectId && msg.name) {
        const p = getProject(projectId); if (p && p.vars[msg.name]) { delete p.vars[msg.name]; saveSoon(); }
      }
    }
  });
  ws.on('close', () => { if (projectId && rooms.has(projectId)) { rooms.get(projectId).delete(ws); announceStatus(projectId); } });
  ws.on('error', () => {});
});

// TurboWarp extension: JSON messages {id, name, args} → {id, result}; subscribes to super cloud variable changes
function plugConnection(ws) {
  let projectId = null; let user = 'player';
  ws.on('message', async (buf) => {
    let msg; try { msg = JSON.parse(buf.toString()); } catch { return; }
    if (msg.type === 'hello') {
      projectId = String(msg.project || 'default').slice(0, 60); user = String(msg.user || 'player').slice(0, 40);
      const p = ensureProject(projectId);
      plugsFor(projectId).add(ws); p.seen[user] = Date.now();
      ws.send(JSON.stringify({ type: 'hello', project: projectId, vars: Object.fromEntries(Object.entries(p.vars).map(([k, v]) => [k, v.value])) }));
      announceStatus(projectId);
      return;
    }
    if (msg.type === 'call' && projectId) {
      const p = getProject(projectId);
      if (!p || !p.enabled) return ws.send(JSON.stringify({ type: 'result', id: msg.id, result: 'project is paused on the server' }));
      const result = await handleRequest(projectId, { requestId: '0', name: String(msg.name || ''), args: (msg.args || []).map(String) }, { transport: 'plug', user }, '');
      if (ws.readyState === WebSocket.OPEN) ws.send(JSON.stringify({ type: 'result', id: msg.id, result }));
    }
  });
  ws.on('close', () => { if (projectId) { plugsFor(projectId).delete(ws); announceStatus(projectId); } });
  ws.on('error', () => {});
}

setInterval(() => { for (const id of new Set([...rooms.keys(), ...plugs.keys()])) announceStatus(id); }, 10000);

initStorage().then(() => {
  handlers = makeHandlers({ pushMessage, roomFor, plugsFor });
  server.listen(PORT, () => {
    console.log('');
    console.log('  ☁🔌 CloudPlug is running!');
    console.log(`  Dashboard:   http://localhost:${PORT}`);
    console.log(`  Cloud host:  ws://localhost:${PORT}   (TurboWarp ?cloud_host=)`);
    console.log(`  Extension:   http://localhost:${PORT}/extension.js`);
    console.log(`  AI:          ${handlers.__ai ? 'on' : 'off (bind blockbuddy-ai or set ANTHROPIC_API_KEY)'}`);
    console.log('');
    syncBridges();
  });
}).catch((e) => { console.error('storage failed:', e); process.exit(1); });
