// RefConnect — share a reference picture with a party, live.
const http = require('http');
const fs = require('fs');
const path = require('path');
const { WebSocketServer } = require('ws');

const PORT = process.env.PORT || 4880;
const rooms = new Map(); // code -> { image, history:[], clients:Set }
const MAX_MSG = 8 * 1024 * 1024;

function makeCode() {
  const A = 'ABCDEFGHJKLMNPQRSTUVWXYZ';
  let c;
  do { c = Array.from({ length: 4 }, () => A[Math.floor(Math.random() * A.length)]).join(''); }
  while (rooms.has(c));
  return c;
}
function getRoom(code) {
  if (!rooms.has(code)) rooms.set(code, { image: null, history: [], clients: new Set() });
  return rooms.get(code);
}
function send(ws, obj) { if (ws.readyState === 1) ws.send(JSON.stringify(obj)); }
function broadcast(room, obj, except) {
  const s = JSON.stringify(obj);
  for (const c of room.clients) if (c !== except && c.readyState === 1) c.send(s);
}
function roomState(room) {
  return { type: 'state', image: room.image, history: room.history, count: room.clients.size };
}

// ---- image search (DuckDuckGo, best effort, no API key) ----
const UA = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125 Safari/537.36';
async function ddgSearch(q) {
  const page = await fetch('https://duckduckgo.com/?q=' + encodeURIComponent(q) + '&iax=images&ia=images', { headers: { 'User-Agent': UA } });
  const html = await page.text();
  const m = html.match(/vqd=["']?([\d-]+)/) || html.match(/vqd=([\d-]+)/);
  if (!m) throw new Error('no vqd');
  const url = 'https://duckduckgo.com/i.js?l=us-en&o=json&q=' + encodeURIComponent(q) + '&vqd=' + m[1] + '&f=,,,,,&p=1';
  const r = await fetch(url, { headers: { 'User-Agent': UA, 'Referer': 'https://duckduckgo.com/', 'Accept': 'application/json' } });
  if (!r.ok) throw new Error('ddg ' + r.status);
  const j = await r.json();
  return (j.results || []).slice(0, 40).map(x => ({ image: x.image, thumb: x.thumbnail, title: x.title, w: x.width, h: x.height }));
}

function lanIP() {
  const os = require('os');
  for (const [name, addrs] of Object.entries(os.networkInterfaces()))
    for (const a of addrs) if (a.family === 'IPv4' && !a.internal && !/^169\.254/.test(a.address)) return a.address;
  return null;
}

const server = http.createServer(async (req, res) => {
  const u = new URL(req.url, 'http://x');
  if (u.pathname === '/whoami') {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    return res.end(JSON.stringify({ lan: lanIP(), port: PORT }));
  }
  if (u.pathname === '/search') {
    const q = (u.searchParams.get('q') || '').trim();
    if (!q) return res.writeHead(400).end('q?');
    try {
      const results = await ddgSearch(q);
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ results }));
    } catch (e) {
      res.writeHead(502, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: String(e.message || e), results: [] }));
    }
    return;
  }
  if (u.pathname === '/img') {
    // proxy a remote image so hotlink protection / CORS don't break sharing
    const target = u.searchParams.get('u');
    if (!/^https?:\/\//i.test(target || '')) return res.writeHead(400).end('bad url');
    try {
      const r = await fetch(target, { headers: { 'User-Agent': UA, 'Referer': new URL(target).origin + '/' }, redirect: 'follow' });
      if (!r.ok) throw new Error('upstream ' + r.status);
      const ct = r.headers.get('content-type') || 'image/jpeg';
      const buf = Buffer.from(await r.arrayBuffer());
      if (buf.length > 20 * 1024 * 1024) throw new Error('too big');
      res.writeHead(200, { 'Content-Type': ct, 'Cache-Control': 'public, max-age=86400' });
      res.end(buf);
    } catch (e) {
      res.writeHead(502).end('fetch failed: ' + e.message);
    }
    return;
  }
  // static
  let p = u.pathname === '/' ? '/index.html' : u.pathname;
  const file = path.join(__dirname, 'public', path.normalize(p));
  if (!file.startsWith(path.join(__dirname, 'public'))) return res.writeHead(403).end();
  fs.readFile(file, (err, data) => {
    if (err) { // SPA: any /CODE path serves index
      return fs.readFile(path.join(__dirname, 'public/index.html'), (e2, d2) => {
        if (e2) return res.writeHead(404).end('not found');
        res.writeHead(200, { 'Content-Type': 'text/html' }); res.end(d2);
      });
    }
    const ext = path.extname(file);
    const types = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.png': 'image/png', '.svg': 'image/svg+xml', '.webmanifest': 'application/manifest+json' };
    res.writeHead(200, { 'Content-Type': types[ext] || 'application/octet-stream' });
    res.end(data);
  });
});

const wss = new WebSocketServer({ server, maxPayload: MAX_MSG });
wss.on('connection', ws => {
  ws.room = null; ws.code = null; ws.name = 'Guest';
  ws.on('message', raw => {
    let m; try { m = JSON.parse(raw); } catch { return; }
    if (m.type === 'create') {
      const code = makeCode();
      joinRoom(ws, code, m.name);
    } else if (m.type === 'join') {
      const code = String(m.code || '').toUpperCase().replace(/[^A-Z]/g, '').slice(0, 4);
      if (code.length !== 4) return send(ws, { type: 'error', msg: 'Enter a 4-letter code' });
      joinRoom(ws, code, m.name);
    } else if (m.type === 'image' && ws.room) {
      // { src (data url or http url), name, by }
      if (typeof m.src !== 'string' || !m.src) return;
      const img = { src: m.src, name: String(m.name || '').slice(0, 120), by: ws.name, t: Date.now(), id: Math.random().toString(36).slice(2, 9) };
      ws.room.image = img;
      ws.room.history.unshift(img);
      if (ws.room.history.length > 12) ws.room.history.length = 12;
      broadcast(ws.room, { type: 'image', image: img, history: ws.room.history });
    } else if (m.type === 'show' && ws.room) {
      const img = ws.room.history.find(h => h.id === m.id);
      if (img) { ws.room.image = img; broadcast(ws.room, { type: 'image', image: img, history: ws.room.history }); }
    } else if (m.type === 'clear' && ws.room) {
      ws.room.image = null;
      broadcast(ws.room, { type: 'image', image: null, history: ws.room.history });
    } else if (m.type === 'name') {
      ws.name = String(m.name || 'Guest').slice(0, 24);
    }
  });
  ws.on('close', () => leave(ws));
});
function joinRoom(ws, code, name) {
  leave(ws);
  ws.name = String(name || 'Guest').slice(0, 24) || 'Guest';
  ws.code = code; ws.room = getRoom(code);
  ws.room.clients.add(ws);
  send(ws, { type: 'joined', code });
  send(ws, roomState(ws.room));
  broadcast(ws.room, { type: 'count', count: ws.room.clients.size }, ws);
}
function leave(ws) {
  if (!ws.room) return;
  ws.room.clients.delete(ws);
  broadcast(ws.room, { type: 'count', count: ws.room.clients.size });
  if (ws.room.clients.size === 0) {
    // keep room alive 10 min for reconnects, then drop
    const code = ws.code, room = ws.room;
    setTimeout(() => { if (rooms.get(code) === room && room.clients.size === 0) rooms.delete(code); }, 10 * 60 * 1000);
  }
  ws.room = null; ws.code = null;
}

server.listen(PORT, () => {
  console.log('RefConnect → http://localhost:' + PORT);
  const ip = lanIP(); if (ip) console.log('Other devices on this wifi → http://' + ip + ':' + PORT);
});
