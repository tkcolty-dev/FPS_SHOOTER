// Lobby + game server. Express serves the client; WebSockets carry lobby and
// game traffic. Rooms are 4-letter codes; each room runs one Game instance.
//
// A single websocket connection can own MULTIPLE local players (2v2 and 1v1
// modes put two players on one device/screen). Commands carry `lp` (local
// player index) so the server knows which of the connection's slots is acting.

import express from 'express';
import http from 'http';
import path from 'path';
import { fileURLToPath } from 'url';
import { WebSocketServer } from 'ws';
import { Game } from './game.js';
import { SKIN_KEYS, MODES, teamOf } from '../shared/gamedata.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PORT = process.env.PORT || 4720;

const app = express();
app.use(express.static(path.join(__dirname, '../client')));
app.use('/shared', express.static(path.join(__dirname, '../shared')));
app.use('/vendor', express.static(path.join(__dirname, '../node_modules/three/build')));

app.get('/debug', (req, res) => res.json([...rooms.values()].map(r => ({
  code: r.code, mode: r.mode,
  players: r.players.map(p => ({ slot: p.slot, name: p.name, bot: !!p.bot, connected: !!p.ws, lp: p.lp })),
  inGame: !!r.game,
  ents: r.game ? r.game.ents.size : 0,
}))));

const server = http.createServer(app);
const wss = new WebSocketServer({ server });

const rooms = new Map();

const TICK_MS = 66;       // ~15 Hz simulation
const SNAP_EVERY = 2;     // snapshot every other tick + client lerp

function makeCode() {
  const letters = 'ABCDEFGHJKLMNPQRSTUVWXYZ';
  let code;
  do {
    code = Array.from({ length: 4 }, () => letters[Math.floor(Math.random() * letters.length)]).join('');
  } while (rooms.has(code));
  return code;
}

function lobbyMsg(room) {
  return {
    t: 'lobby',
    code: room.code,
    mode: room.mode,
    hostSlot: 0,
    players: room.players.map(p => ({
      slot: p.slot, name: p.name, bot: !!p.bot, skin: p.skin, team: teamOf(room.mode, p.slot),
    })),
  };
}

function broadcast(room, msg) {
  const data = JSON.stringify(msg);
  const sent = new Set();
  for (const p of room.players) {
    if (p.ws && p.ws.readyState === 1 && !sent.has(p.ws)) { sent.add(p.ws); p.ws.send(data); }
  }
}

function sendTo(ws, msg) { if (ws.readyState === 1) ws.send(JSON.stringify(msg)); }

function freeSlot(room) {
  const max = MODES[room.mode].maxSlots;
  for (let s = 0; s < max; s++) if (!room.players.some(p => p.slot === s)) return s;
  return -1;
}

// Register `count` local players for one connection. Returns their slots.
function addLocals(room, ws, name, count) {
  const slots = [];
  for (let lp = 0; lp < count; lp++) {
    const slot = freeSlot(room);
    if (slot === -1) break;
    const pname = lp === 0 ? name : `${name} II`;
    room.players.push({ slot, lp, name: pname.slice(0, 16), ws, bot: false, skin: SKIN_KEYS[slot % SKIN_KEYS.length] });
    slots.push(slot);
  }
  return slots;
}

function startGame(room) {
  if (room.game) return;
  room.game = new Game(room.players, msg => broadcast(room, msg), room.mode);
  const lm = lobbyMsg(room);
  broadcast(room, { t: 'begin', mode: room.mode, map: room.game.map, players: lm.players });
  let n = 0;
  room.timer = setInterval(() => {
    room.game.tick(TICK_MS / 1000);
    if (++n % SNAP_EVERY === 0) broadcast(room, room.game.snapshot());
    if (room.game.over) { clearInterval(room.timer); room.timer = null; }
  }, TICK_MS);
}

// Remove this connection from EVERY room it appears in (scanning all rooms
// guarantees a socket can never straddle two games at once).
function leaveRoom(ws) {
  for (const room of [...rooms.values()]) {
    const mine = room.players.filter(p => p.ws === ws);
    if (!mine.length) continue;
    if (room.game) {
      for (const p of mine) { p.ws = null; broadcast(room, { t: 'left', slot: p.slot }); }
    } else {
      room.players = room.players.filter(p => p.ws !== ws);
      broadcast(room, lobbyMsg(room));
    }
    const humansLeft = room.players.some(p => p.ws);
    if (!humansLeft) {
      if (room.timer) clearInterval(room.timer);
      rooms.delete(room.code);
    }
  }
  ws.room = null;
}

wss.on('connection', ws => {
  ws.on('message', raw => {
    let m;
    try { m = JSON.parse(raw); } catch { return; }
    const room = ws.room;

    if (m.t === 'host') {
      leaveRoom(ws); // hosting again always abandons any previous room
      const mode = MODES[m.mode] ? m.mode : 'ffa';
      const code = makeCode();
      const r = { code, mode, players: [], game: null, timer: null };
      rooms.set(code, r);
      const slots = addLocals(r, ws, m.name || 'Player', MODES[mode].locals);
      ws.room = r;
      sendTo(ws, { t: 'you', slots, mode });
      broadcast(r, lobbyMsg(r));
    }

    else if (m.t === 'join') {
      leaveRoom(ws);
      const r = rooms.get((m.code || '').toUpperCase().trim());
      if (!r) return sendTo(ws, { t: 'error', msg: 'No room with that code.' });
      if (r.game) return sendTo(ws, { t: 'error', msg: 'That game already started.' });
      if (r.mode === '1v1') return sendTo(ws, { t: 'error', msg: '1v1 Split Screen is single-device.' });
      const need = MODES[r.mode].locals;
      const open = MODES[r.mode].maxSlots - r.players.length;
      if (open < need) return sendTo(ws, { t: 'error', msg: 'Room is full.' });
      const slots = addLocals(r, ws, m.name || 'Player', need);
      ws.room = r;
      sendTo(ws, { t: 'you', slots, mode: r.mode });
      broadcast(r, lobbyMsg(r));
    }

    else if (m.t === 'addBot') {
      if (!room || room.game || !room.players.some(p => p.ws === ws && p.slot === 0)) return;
      const slot = freeSlot(room);
      if (slot === -1) return;
      const names = ['Sir Botsalot', 'Lady Circuit', 'Baron Beep', 'Duke Data'];
      room.players.push({ slot, name: names[slot % names.length], ws: null, bot: true, skin: SKIN_KEYS[Math.floor(Math.random() * SKIN_KEYS.length)] });
      broadcast(room, lobbyMsg(room));
    }

    else if (m.t === 'skin') {
      if (!room || room.game) return;
      const p = room.players.find(p => p.ws === ws && p.lp === (m.lp || 0));
      if (!p) return;
      const i = SKIN_KEYS.indexOf(p.skin);
      p.skin = SKIN_KEYS[(i + 1) % SKIN_KEYS.length];
      broadcast(room, lobbyMsg(room));
    }

    else if (m.t === 'start') {
      if (!room || room.game || !room.players.some(p => p.ws === ws && p.slot === 0)) return;
      const need = room.mode === '2v2' ? 4 : room.mode === '1v1' ? 2 : 1;
      if (room.players.length < need) {
        return sendTo(ws, { t: 'error', msg: room.mode === '2v2' ? 'Need 4 players — invite the other device or add bots.' : 'Not enough players.' });
      }
      startGame(room);
    }

    else if (m.t === 'cmd') {
      if (!room || !room.game) return;
      const p = room.players.find(p => p.ws === ws && p.lp === (m.lp || 0));
      if (p && !p.dead) {
        const err = room.game.handleCmd(p.slot, m);
        if (typeof err === 'string') sendTo(ws, { t: 'error', msg: err });
      }
    }

    else if (m.t === 'leave') leaveRoom(ws);
  });

  ws.on('close', () => leaveRoom(ws));
});

server.listen(PORT, () => {
  console.log(`Medieval RTS server running → http://localhost:${PORT}`);
  console.log(`Other devices (or an Xbox Edge browser) join via your LAN IP, e.g. http://<your-ip>:${PORT}`);
});
