// Kingdom Deluxe LAN server — serves the game and relays multiplayer rooms.
// Run:  node server.js   then everyone on the wifi opens http://<your-ip>:8912
const http = require('http');
const fs = require('fs');
const path = require('path');
const os = require('os');
const WebSocket = require('ws');

const PORT = 8912;
const ROOT = __dirname;
const MIME = {
  '.html': 'text/html', '.png': 'image/png', '.js': 'text/javascript',
  '.json': 'application/json', '.ico': 'image/x-icon',
};

function lanIP() {
  for (const ifs of Object.values(os.networkInterfaces())) {
    for (const i of ifs) {
      if (i.family === 'IPv4' && !i.internal) return i.address;
    }
  }
  return 'localhost';
}

const server = http.createServer((req, res) => {
  let p = decodeURIComponent(req.url.split('?')[0]);
  if (p === '/') p = '/index.html';
  const file = path.join(ROOT, path.normalize(p));
  if (!file.startsWith(ROOT)) { res.writeHead(403); res.end(); return; }
  fs.readFile(file, (err, data) => {
    if (err) { res.writeHead(404); res.end('not found'); return; }
    res.writeHead(200, { 'Content-Type': MIME[path.extname(file)] || 'application/octet-stream' });
    res.end(data);
  });
});

// ---- rooms: pure relay, the host's game is the authority ----
const rooms = new Map();  // code -> { host, guests: Map(id -> ws) }
let nextId = 1;

function send(ws, obj) {
  if (ws && ws.readyState === WebSocket.OPEN) ws.send(JSON.stringify(obj));
}

const wss = new WebSocket.Server({ server });
wss.on('connection', ws => {
  ws.on('message', raw => {
    let m;
    try { m = JSON.parse(raw); } catch { return; }
    if (m.t === 'host') {
      let code;
      do {
        code = Array.from({ length: 4 }, () =>
          'ABCDEFGHJKLMNPQRSTUVWXYZ'[Math.floor(Math.random() * 24)]).join('');
      } while (rooms.has(code));
      rooms.set(code, { host: ws, guests: new Map() });
      ws.room = code; ws.isHost = true;
      send(ws, { t: 'room', code, ip: lanIP(), port: PORT });
    } else if (m.t === 'join') {
      const room = rooms.get((m.code || '').toUpperCase());
      if (!room) { send(ws, { t: 'err', m: 'No kingdom with that code.' }); return; }
      ws.room = ws.roomCode = (m.code || '').toUpperCase();
      ws.gid = nextId++;
      room.guests.set(ws.gid, ws);
      send(ws, { t: 'joined', id: ws.gid });
      send(room.host, { t: 'guest+', id: ws.gid });
    } else if (ws.isHost) {
      const room = rooms.get(ws.room);
      if (!room) return;
      if (m.to) send(room.guests.get(m.to), m);
      else for (const g of room.guests.values()) send(g, m);
    } else if (ws.gid) {
      const room = rooms.get(ws.room);
      if (!room) return;
      m.from = ws.gid;
      send(room.host, m);
    }
  });
  ws.on('close', () => {
    const room = rooms.get(ws.room);
    if (!room) return;
    if (ws.isHost) {
      for (const g of room.guests.values()) send(g, { t: 'hostgone' });
      rooms.delete(ws.room);
    } else if (ws.gid) {
      room.guests.delete(ws.gid);
      send(room.host, { t: 'guest-', id: ws.gid });
    }
  });
});

server.listen(PORT, () => {
  console.log('');
  console.log('  ⚔  Kingdom Deluxe is live!');
  console.log('     You:      http://localhost:' + PORT);
  console.log('     Friends:  http://' + lanIP() + ':' + PORT + '  (same wifi)');
  console.log('     Xbox:     open Edge on the Xbox → same address. Controllers just work.');
  console.log('');
});
