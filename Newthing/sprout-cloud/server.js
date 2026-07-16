'use strict';
/*
 * Sprout server — serves the app and relays the shared drawing canvas.
 *
 * Rooms live in memory only. That is deliberate: a room is two kids drawing
 * together for ten minutes, not a document. If the app restarts, rooms are
 * gone and everyone rejoins with a new code — no database to bind, nothing
 * to back up, and no personal data at rest.
 */
const express = require('express');
const http = require('http');
const path = require('path');
const { WebSocketServer } = require('ws');

const app = express();
const PORT = process.env.PORT || 8080;

app.use(express.static(path.join(__dirname, 'public'), { maxAge: '5m' }));

const server = http.createServer(app);
const wss = new WebSocketServer({ server, path: '/ws' });

/* ---------- rooms ---------- */
const rooms = new Map();          // code -> { trail:[], players:Map(id->p) }
const MAX_TRAIL = 2500;           // shared segments kept per room
const MAX_ROOMS = 500;
const MAX_PLAYERS = 8;
const IDLE_MS = 1000 * 60 * 90;   // reap rooms nobody has touched in 90 min

const WORDS = ['LEAF','SEED','FERN','MOSS','VINE','BUD','ROOT','SPROUT','PETAL','TWIG'];
function newCode() {
  for (let i = 0; i < 60; i++) {
    const c = WORDS[Math.floor(Math.random() * WORDS.length)] + Math.floor(10 + Math.random() * 90);
    if (!rooms.has(c)) return c;
  }
  return 'LEAF' + Date.now().toString().slice(-4);
}
function getRoom(code, make) {
  let r = rooms.get(code);
  if (!r && make) {
    if (rooms.size >= MAX_ROOMS) return null;
    r = { trail: [], players: new Map(), touched: Date.now() };
    rooms.set(code, r);
  }
  if (r) r.touched = Date.now();
  return r || null;
}
setInterval(() => {
  const now = Date.now();
  for (const [code, r] of rooms) {
    if (!r.players.size && now - r.touched > IDLE_MS) rooms.delete(code);
  }
}, 60000).unref();

/* ---------- validation: never trust the client ---------- */
const num = (v, lo, hi, d) =>
  (typeof v === 'number' && isFinite(v)) ? Math.max(lo, Math.min(hi, v)) : d;
const str = (v, max) => (typeof v === 'string' ? v.slice(0, max) : '');
const HEX = /^#[0-9a-fA-F]{3,8}$/;
const colr = v => (typeof v === 'string' && HEX.test(v)) ? v : '#19c37d';
function cleanSeg(s) {
  if (!s || typeof s !== 'object') return null;
  return {
    x1: num(s.x1, -2000, 2000, 0), y1: num(s.y1, -2000, 2000, 0),
    x2: num(s.x2, -2000, 2000, 0), y2: num(s.y2, -2000, 2000, 0),
    c: colr(s.c), w: num(s.w, 1, 40, 6)
  };
}

function send(ws, msg) {
  if (ws.readyState === 1) { try { ws.send(JSON.stringify(msg)); } catch (e) {} }
}
function broadcast(room, msg, exceptId) {
  for (const p of room.players.values()) {
    if (p.id !== exceptId) send(p.ws, msg);
  }
}

let nextId = 1;
wss.on('connection', ws => {
  let me = null, room = null, code = null;
  ws.isAlive = true;
  ws.on('pong', () => { ws.isAlive = true; });

  ws.on('message', raw => {
    let m;
    try { m = JSON.parse(raw); } catch (e) { return; }
    if (!m || typeof m.t !== 'string') return;

    if (m.t === 'join') {
      if (me) return;
      const wanted = str(m.room, 12).toUpperCase().replace(/[^A-Z0-9]/g, '');
      if (m.make || !wanted) {
        code = newCode(); room = getRoom(code, true);
      } else {
        code = wanted; room = getRoom(code, false);
        if (!room) return send(ws, { t: 'noroom', room: code });
      }
      if (!room) return send(ws, { t: 'full' });
      if (room.players.size >= MAX_PLAYERS) return send(ws, { t: 'full' });

      me = {
        id: nextId++, ws,
        name: str(m.name, 14) || 'Player',
        av: str(m.av, 8) || '🦊',
        color: colr(m.color),
        x: num(m.x, -2000, 2000, 0), y: num(m.y, -2000, 2000, 0), dir: num(m.dir, -3600, 3600, 90)
      };
      room.players.set(me.id, me);
      const peers = [...room.players.values()]
        .filter(p => p.id !== me.id)
        .map(p => ({ id: p.id, name: p.name, av: p.av, color: p.color, x: p.x, y: p.y, dir: p.dir }));
      send(ws, { t: 'welcome', id: me.id, room: code, trail: room.trail, peers });
      broadcast(room, { t: 'joined', p: { id: me.id, name: me.name, av: me.av, color: me.color, x: me.x, y: me.y, dir: me.dir } }, me.id);
      return;
    }

    if (!me || !room) return;
    room.touched = Date.now();

    if (m.t === 'seg') {
      const s = cleanSeg(m.s);
      if (!s) return;
      room.trail.push(s);
      if (room.trail.length > MAX_TRAIL) room.trail.splice(0, room.trail.length - MAX_TRAIL);
      broadcast(room, { t: 'seg', id: me.id, s }, me.id);
    } else if (m.t === 'pos') {
      me.x = num(m.x, -2000, 2000, me.x);
      me.y = num(m.y, -2000, 2000, me.y);
      me.dir = num(m.dir, -3600, 3600, me.dir);
      broadcast(room, { t: 'pos', id: me.id, x: me.x, y: me.y, dir: me.dir }, me.id);
    } else if (m.t === 'clear') {
      room.trail.length = 0;
      broadcast(room, { t: 'clear', by: me.name });   // sender clears locally too
      send(ws, { t: 'clear', by: me.name });
    }
  });

  ws.on('close', () => {
    if (room && me) {
      room.players.delete(me.id);
      broadcast(room, { t: 'left', id: me.id });
    }
  });
  ws.on('error', () => {});
});

// drop half-open sockets so ghost sprites don't linger on the canvas
setInterval(() => {
  wss.clients.forEach(ws => {
    if (ws.isAlive === false) return ws.terminate();
    ws.isAlive = false;
    try { ws.ping(); } catch (e) {}
  });
}, 30000).unref();

app.get('/api/health', (req, res) =>
  res.json({ ok: true, rooms: rooms.size, players: wss.clients.size }));

server.listen(PORT, () => console.log(`[sprout] listening on ${PORT}`));
