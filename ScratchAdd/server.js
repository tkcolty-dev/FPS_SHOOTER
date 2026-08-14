// Scratch+ Studio — multi-user Scratch-style editor with .sb3 export
// node server.js  →  http://localhost:4900
const express = require('express');
const http = require('http');
const path = require('path');
const fs = require('fs');
const crypto = require('crypto');
const { WebSocketServer } = require('ws');

const PORT = 4900;
const ROOT = __dirname;
const ASSETS = path.join(ROOT, 'assets');
const DATA = path.join(ROOT, 'data');
const PROJECT_FILE = path.join(DATA, 'project.json');

fs.mkdirSync(ASSETS, { recursive: true });
fs.mkdirSync(DATA, { recursive: true });

// ---------- built-in assets ----------
const BACKDROP_SVG = `<svg xmlns="http://www.w3.org/2000/svg" width="480" height="360"><rect width="480" height="360" fill="#ffffff"/></svg>`;
const SPRITE_SVG = `<svg xmlns="http://www.w3.org/2000/svg" width="120" height="120" viewBox="0 0 120 120">
<ellipse cx="60" cy="70" rx="42" ry="38" fill="#7c4dff"/>
<ellipse cx="60" cy="74" rx="30" ry="24" fill="#b39dff"/>
<circle cx="44" cy="52" r="12" fill="#fff"/><circle cx="76" cy="52" r="12" fill="#fff"/>
<circle cx="46" cy="54" r="5" fill="#222"/><circle cx="74" cy="54" r="5" fill="#222"/>
<path d="M46 84 Q60 96 74 84" stroke="#3b1f8f" stroke-width="4" fill="none" stroke-linecap="round"/>
<path d="M38 30 L46 44" stroke="#7c4dff" stroke-width="6" stroke-linecap="round"/>
<path d="M82 30 L74 44" stroke="#7c4dff" stroke-width="6" stroke-linecap="round"/>
<circle cx="37" cy="27" r="6" fill="#ffd54f"/><circle cx="83" cy="27" r="6" fill="#ffd54f"/>
</svg>`;

function saveAsset(buf, ext) {
  const md5 = crypto.createHash('md5').update(buf).digest('hex');
  const md5ext = md5 + '.' + ext;
  const file = path.join(ASSETS, md5ext);
  if (!fs.existsSync(file)) fs.writeFileSync(file, buf);
  return md5ext;
}

const backdropMd5ext = saveAsset(Buffer.from(BACKDROP_SVG), 'svg');
const spriteMd5ext = saveAsset(Buffer.from(SPRITE_SVG), 'svg');

// ---------- project state ----------
function defaultProject() {
  return {
    stage: {
      id: 'stage', name: 'Stage', isStage: true,
      costumes: [{ id: 'bd1', name: 'backdrop1', md5ext: backdropMd5ext, url: '/assets/' + backdropMd5ext, dataFormat: 'svg', width: 480, height: 360, cx: 240, cy: 180 }],
      currentCostume: 0, sounds: [], workspace: null,
    },
    sprites: [{
      id: 'sprite1', name: 'Sprite1',
      x: 0, y: 0, direction: 90, size: 100, visible: true, rotationStyle: 'all around',
      costumes: [{ id: 'c1', name: 'blobby', md5ext: spriteMd5ext, url: '/assets/' + spriteMd5ext, dataFormat: 'svg', width: 120, height: 120, cx: 60, cy: 60 }],
      currentCostume: 0, sounds: [], workspace: null,
    }],
  };
}

let project;
try { project = JSON.parse(fs.readFileSync(PROJECT_FILE, 'utf8')); }
catch { project = defaultProject(); }

let saveTimer = null;
function persist() {
  clearTimeout(saveTimer);
  saveTimer = setTimeout(() => {
    fs.writeFile(PROJECT_FILE, JSON.stringify(project), () => {});
  }, 800);
}

// ---------- http ----------
const app = express();
app.use(express.static(path.join(ROOT, 'public')));
app.use('/assets', express.static(ASSETS, { maxAge: '365d', immutable: true }));
app.get('/vendor/blockly.min.js', (_q, r) => r.sendFile(path.join(ROOT, 'node_modules/blockly/blockly.min.js')));
app.get('/vendor/jszip.min.js', (_q, r) => r.sendFile(path.join(ROOT, 'node_modules/jszip/dist/jszip.min.js')));
app.get('/vendor/spark-md5.min.js', (_q, r) => r.sendFile(path.join(ROOT, 'node_modules/spark-md5/spark-md5.min.js')));
app.use('/blockly-media', express.static(path.join(ROOT, 'node_modules/blockly/media')));

app.post('/upload', express.raw({ type: () => true, limit: '40mb' }), (req, res) => {
  const name = String(req.query.name || 'file');
  const extRaw = (name.split('.').pop() || '').toLowerCase();
  const ok = { png: 'png', jpg: 'jpg', jpeg: 'jpg', gif: 'png', svg: 'svg', bmp: 'png', wav: 'wav', mp3: 'mp3' };
  const ext = ok[extRaw];
  if (!ext) return res.status(400).json({ error: 'unsupported file type: ' + extRaw });
  if (!req.body || !req.body.length) return res.status(400).json({ error: 'empty upload' });
  const md5ext = saveAsset(req.body, ext);
  res.json({ md5ext, url: '/assets/' + md5ext, dataFormat: ext });
});

app.post('/reset', (_q, res) => { // wipe project (used by "New project" button)
  project = defaultProject();
  persist();
  broadcast({ type: 'project', project });
  res.json({ ok: true });
});

const server = http.createServer(app);

// ---------- websocket ----------
const wss = new WebSocketServer({ server });
const USER_COLORS = ['#ff5c8a', '#4c97ff', '#59c059', '#ffab19', '#9966ff', '#00c4cc'];
let userSeq = 0;
const users = new Map(); // ws -> {id, name, color, spriteId}

function broadcast(msg, exceptWs) {
  const s = JSON.stringify(msg);
  for (const client of wss.clients) {
    if (client !== exceptWs && client.readyState === 1) client.send(s);
  }
}
function userList() {
  return [...users.values()].map(u => ({ id: u.id, name: u.name, color: u.color, spriteId: u.spriteId }));
}

wss.on('connection', ws => {
  const u = { id: 'u' + (++userSeq), name: 'Guest', color: USER_COLORS[userSeq % USER_COLORS.length], spriteId: null };
  users.set(ws, u);
  ws.send(JSON.stringify({ type: 'init', project, you: u.id, users: userList() }));

  ws.on('message', raw => {
    let msg; try { msg = JSON.parse(raw); } catch { return; }
    switch (msg.type) {
      case 'join':
        u.name = String(msg.name || 'Guest').slice(0, 20);
        broadcast({ type: 'users', users: userList() });
        break;
      case 'presence':
        u.spriteId = msg.spriteId;
        broadcast({ type: 'users', users: userList() }, ws);
        break;
      case 'sprite': {
        const sp = msg.sprite;
        if (!sp || !sp.id) return;
        const i = project.sprites.findIndex(s => s.id === sp.id);
        if (i >= 0) project.sprites[i] = sp; else project.sprites.push(sp);
        persist();
        broadcast({ type: 'sprite', sprite: sp, from: u.id }, ws);
        break;
      }
      case 'removeSprite':
        project.sprites = project.sprites.filter(s => s.id !== msg.id);
        persist();
        broadcast({ type: 'removeSprite', id: msg.id, from: u.id }, ws);
        break;
      case 'stage':
        project.stage = msg.stage;
        persist();
        broadcast({ type: 'stage', stage: msg.stage, from: u.id }, ws);
        break;
      case 'flag': // let everyone see the project run together
      case 'stopall':
        broadcast({ type: msg.type, from: u.id }, ws);
        break;
    }
  });

  ws.on('close', () => {
    users.delete(ws);
    broadcast({ type: 'users', users: userList() });
  });
});

server.listen(PORT, () => console.log(`Scratch+ Studio → http://localhost:${PORT}`));
