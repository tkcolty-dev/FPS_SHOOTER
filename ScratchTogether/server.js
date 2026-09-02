'use strict';
// Scratch Together — real-time collaborative editing in the real Scratch 3 editor.
// One server, one room code, everybody edits the same project live.

const express = require('express');
const http = require('http');
const path = require('path');
const fs = require('fs');
const os = require('os');
const {WebSocketServer} = require('ws');

const PORT = process.env.PORT || 4940;
const DATA_DIR = path.join(__dirname, 'data');
const GUI_DIST = path.dirname(require.resolve('scratch-gui/package.json')) + '/dist';

fs.mkdirSync(DATA_DIR, {recursive: true});

// ---------- rooms ----------
const rooms = new Map(); // code -> {code, project, clients:Set<ws>, dir, saveTimer}

function roomDir (code) { return path.join(DATA_DIR, code); }

function loadRoom (code) {
    if (rooms.has(code)) return rooms.get(code);
    const dir = roomDir(code);
    if (!fs.existsSync(dir)) return null;
    let project = null;
    try { project = fs.readFileSync(path.join(dir, 'project.json'), 'utf8'); } catch (e) { /* new room */ }
    let meta = {};
    try { meta = JSON.parse(fs.readFileSync(path.join(dir, 'meta.json'), 'utf8')); } catch (e) { /* none */ }
    const room = {code, project, clients: new Set(), dir, meta, saveTimer: null, snapshotWaiters: []};
    rooms.set(code, room);
    return room;
}

function makeCode () {
    const letters = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
    let code = '';
    for (let i = 0; i < 5; i++) code += letters[Math.floor(Math.random() * letters.length)];
    return rooms.has(code) || fs.existsSync(roomDir(code)) ? makeCode() : code;
}

function createRoom (title) {
    const code = makeCode();
    const dir = roomDir(code);
    fs.mkdirSync(path.join(dir, 'assets'), {recursive: true});
    const meta = {title: title || 'Untitled project', created: Date.now()};
    fs.writeFileSync(path.join(dir, 'meta.json'), JSON.stringify(meta));
    const room = {code, project: null, clients: new Set(), dir, meta, saveTimer: null, snapshotWaiters: []};
    rooms.set(code, room);
    return room;
}

function saveRoom (room) {
    clearTimeout(room.saveTimer);
    room.saveTimer = setTimeout(() => {
        if (room.project) fs.writeFile(path.join(room.dir, 'project.json'), room.project, () => {});
        fs.writeFile(path.join(room.dir, 'meta.json'), JSON.stringify(room.meta), () => {});
    }, 500);
}

// A usable project has a stage; never let an empty/broken snapshot overwrite a good one.
function validProject (str) {
    if (typeof str !== 'string' || str.length < 2) return false;
    try {
        const p = JSON.parse(str);
        return Array.isArray(p.targets) && p.targets.some(t => t && t.isStage);
    } catch (e) { return false; }
}

function hostOf (room) {
    for (const c of room.clients) if (c.readyState === 1) return c;
    return null;
}

function usersOf (room) {
    return [...room.clients].filter(c => c.readyState === 1).map(c => ({
        id: c.userId, name: c.userName, color: c.color, sprite: c.sprite || null, host: c === hostOf(room)
    }));
}

function broadcast (room, msg, except) {
    const data = JSON.stringify(msg);
    for (const c of room.clients) if (c !== except && c.readyState === 1) c.send(data);
}

// ---------- http ----------
const app = express();
app.disable('x-powered-by');

// The real Scratch editor bundle + its media. The bundle references "static/..." relative to the page,
// so static is mounted at both /gui/static and /static.
app.use('/gui', express.static(GUI_DIST, {maxAge: '7d', immutable: true}));
app.use('/static', express.static(path.join(GUI_DIST, 'static'), {maxAge: '7d', immutable: true}));
app.use('/vendor/react.js', express.static(require.resolve('react/umd/react.production.min.js')));
app.use('/vendor/react-dom.js', express.static(require.resolve('react-dom/umd/react-dom.production.min.js')));
app.use(express.static(path.join(__dirname, 'public')));

app.post('/api/rooms', express.json(), (req, res) => {
    const room = createRoom(req.body && req.body.title);
    res.json({code: room.code});
});

app.get('/api/rooms/:code', (req, res) => {
    const room = loadRoom(req.params.code.toUpperCase());
    if (!room) return res.status(404).json({error: 'no such room'});
    res.json({code: room.code, title: room.meta.title, users: usersOf(room).length, hasProject: !!room.project});
});

const ASSET_RE = /^[a-f0-9]{32}\.(svg|png|jpg|jpeg|gif|bmp|wav|mp3)$/i;
app.post('/api/rooms/:code/assets-check', express.json({limit: '2mb'}), (req, res) => {
    const room = loadRoom(req.params.code.toUpperCase());
    if (!room) return res.status(404).end();
    const files = Array.isArray(req.body && req.body.files) ? req.body.files : [];
    const missing = files.filter(f => ASSET_RE.test(f) && !fs.existsSync(path.join(room.dir, 'assets', f)));
    res.json({missing});
});

// Asset store: the sender uploads costume/sound bytes here, other editors fetch them through
// scratch-storage as if this were assets.scratch.mit.edu.
app.get('/api/rooms/:code/assets/:file', (req, res) => {
    const {code, file} = req.params;
    if (!ASSET_RE.test(file)) return res.status(400).end();
    const p = path.join(roomDir(code.toUpperCase()), 'assets', file);
    if (!fs.existsSync(p)) return res.status(404).end();
    res.set('Cache-Control', 'public, max-age=31536000, immutable');
    res.sendFile(p);
});
app.post('/api/rooms/:code/assets/:file', express.raw({type: () => true, limit: '60mb'}), (req, res) => {
    const {code, file} = req.params;
    if (!ASSET_RE.test(file)) return res.status(400).end();
    const room = loadRoom(code.toUpperCase());
    if (!room) return res.status(404).end();
    const p = path.join(room.dir, 'assets', file);
    if (!fs.existsSync(p)) fs.writeFileSync(p, req.body);
    res.json({ok: true});
});
app.head('/api/rooms/:code/assets/:file', (req, res) => {
    const p = path.join(roomDir(req.params.code.toUpperCase()), 'assets', req.params.file);
    res.status(fs.existsSync(p) ? 200 : 404).end();
});

// Download the room as a .sb3-compatible project.json (the editor's File menu also works).
app.get('/api/rooms/:code/project.json', (req, res) => {
    const room = loadRoom(req.params.code.toUpperCase());
    if (!room || !room.project) return res.status(404).end();
    res.type('json').send(room.project);
});

app.get('/editor', (req, res) => res.sendFile(path.join(__dirname, 'public', 'editor.html')));
app.get('/r/:code', (req, res) => res.redirect(`/editor?room=${encodeURIComponent(req.params.code.toUpperCase())}`));

// ---------- websocket ----------
const server = http.createServer(app);
const wss = new WebSocketServer({server, path: '/ws', maxPayload: 64 * 1024 * 1024});

const COLORS = ['#ff6680', '#4c97ff', '#59c059', '#ffab19', '#9966ff', '#0fbd8c', '#ff8c1a', '#5cb1d6', '#cf63cf'];
let nextUser = 1;

function sendInit (room, ws) {
    ws.send(JSON.stringify({
        type: 'init',
        project: room.project,
        title: room.meta.title,
        you: ws.userId,
        host: hostOf(room) === ws,
        users: usersOf(room)
    }));
}

wss.on('connection', (ws, req) => {
    const url = new URL(req.url, 'http://x');
    const code = (url.searchParams.get('room') || '').toUpperCase();
    const room = loadRoom(code);
    if (!room) { ws.close(4004, 'no such room'); return; }

    ws.userId = `u${nextUser++}`;
    ws.userName = (url.searchParams.get('name') || 'Someone').slice(0, 24);
    ws.color = COLORS[(nextUser - 2) % COLORS.length];
    ws.room = room;

    const host = hostOf(room);
    room.clients.add(ws);

    // Ask the host for a fresh snapshot so the newcomer starts from the very latest state.
    if (host && host !== ws) {
        let done = false;
        const finish = () => { if (done) return; done = true; if (ws.readyState === 1) sendInit(room, ws); };
        room.snapshotWaiters.push(finish);
        host.send(JSON.stringify({type: 'requestSnapshot'}));
        setTimeout(finish, 4000);
    } else {
        sendInit(room, ws);
    }
    broadcast(room, {type: 'users', users: usersOf(room)}, ws);

    ws.on('message', raw => {
        let msg;
        try { msg = JSON.parse(raw); } catch (e) { return; }
        switch (msg.type) {
        case 'snapshot': // host keeps the server's copy fresh
            if (validProject(msg.project)) {
                room.project = msg.project;
                if (msg.title) room.meta.title = msg.title;
                saveRoom(room);
                const waiters = room.snapshotWaiters.splice(0);
                waiters.forEach(fn => fn());
            }
            return;
        case 'presence':
            ws.sprite = msg.sprite || null;
            broadcast(room, {type: 'users', users: usersOf(room)});
            return;
        case 'title':
            room.meta.title = String(msg.title || '').slice(0, 100);
            saveRoom(room);
            broadcast(room, {type: 'title', title: room.meta.title}, ws);
            return;
        case 'blocks': case 'sprite': case 'deleteSprite': case 'reorder':
        case 'project': case 'extension': case 'blocksReplace':
            msg.from = ws.userId;
            if (process.env.DEBUG || msg.type !== 'blocks') console.log(`[${code}] ${ws.userName}: ${msg.type} ${msg.sprite || ''}${msg.add ? ' (new)' : ''}${msg.rename ? ' → ' + msg.rename : ''} → ${room.clients.size - 1} others`);
            if (msg.type === 'project') {
                if (!validProject(msg.project)) return;
                room.project = msg.project; saveRoom(room);
            }
            broadcast(room, msg, ws);
            return;
        default:
            return;
        }
    });

    ws.on('close', () => {
        room.clients.delete(ws);
        const newHost = hostOf(room);
        if (newHost) newHost.send(JSON.stringify({type: 'host'}));
        broadcast(room, {type: 'users', users: usersOf(room)});
    });
});

server.listen(PORT, () => {
    const ips = Object.values(os.networkInterfaces()).flat()
        .filter(i => i && i.family === 'IPv4' && !i.internal).map(i => i.address);
    console.log('');
    console.log('  Scratch Together is running');
    console.log(`  You:      http://localhost:${PORT}`);
    ips.forEach(ip => console.log(`  Friends:  http://${ip}:${PORT}   (same wifi)`));
    console.log('');
});
