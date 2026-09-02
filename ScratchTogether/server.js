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

// ---------- storage (postgres on Cloud Foundry, plain files locally) ----------
function pgUri () {
    try {
        const vcap = JSON.parse(process.env.VCAP_SERVICES);
        for (const list of Object.values(vcap)) {
            for (const svc of list) {
                const c = svc.credentials || {};
                const uri = c.uri || c.url;
                if (uri && /^postgres/.test(uri)) return uri;
            }
        }
    } catch (e) { /* not on CF */ }
    return process.env.DATABASE_URL || null;
}

let pool = null;
const store = {
    async init () {
        const uri = pgUri();
        if (!uri) { console.log('  storage: local files (data/)'); return; }
        const {Pool} = require('pg');
        for (const ssl of [false, {rejectUnauthorized: false}]) {
            try {
                pool = new Pool({connectionString: uri, ssl});
                await pool.query('CREATE TABLE IF NOT EXISTS rooms (code TEXT PRIMARY KEY, meta JSONB, project TEXT)');
                await pool.query('CREATE TABLE IF NOT EXISTS assets (code TEXT, name TEXT, data BYTEA, PRIMARY KEY (code, name))');
                break;
            } catch (e) {
                try { await pool.end(); } catch (e2) { /* ignore */ }
                pool = null;
                if (ssl !== false) throw e;
            }
        }
        console.log('  storage: postgres');
    },
    async getRoom (code) {
        if (pool) {
            const r = await pool.query('SELECT meta, project FROM rooms WHERE code = $1', [code]);
            return r.rows[0] ? {meta: r.rows[0].meta || {}, project: r.rows[0].project} : null;
        }
        const dir = roomDir(code);
        if (!fs.existsSync(dir)) return null;
        let project = null;
        let meta = {};
        try { project = fs.readFileSync(path.join(dir, 'project.json'), 'utf8'); } catch (e) { /* new room */ }
        try { meta = JSON.parse(fs.readFileSync(path.join(dir, 'meta.json'), 'utf8')); } catch (e) { /* none */ }
        return {meta, project};
    },
    async exists (code) {
        if (pool) return (await pool.query('SELECT 1 FROM rooms WHERE code = $1', [code])).rowCount > 0;
        return fs.existsSync(roomDir(code));
    },
    async saveRoom (code, meta, project) {
        if (pool) {
            await pool.query('INSERT INTO rooms (code, meta, project) VALUES ($1, $2, $3) ' +
                'ON CONFLICT (code) DO UPDATE SET meta = $2, project = $3', [code, JSON.stringify(meta), project]);
            return;
        }
        const dir = roomDir(code);
        fs.mkdirSync(path.join(dir, 'assets'), {recursive: true});
        fs.writeFileSync(path.join(dir, 'meta.json'), JSON.stringify(meta));
        if (project) fs.writeFileSync(path.join(dir, 'project.json'), project);
    },
    async hasAsset (code, name) {
        if (pool) return (await pool.query('SELECT 1 FROM assets WHERE code = $1 AND name = $2', [code, name])).rowCount > 0;
        return fs.existsSync(path.join(roomDir(code), 'assets', name));
    },
    async missingAssets (code, names) {
        if (pool) {
            const r = await pool.query('SELECT name FROM assets WHERE code = $1 AND name = ANY($2)', [code, names]);
            const have = new Set(r.rows.map(x => x.name));
            return names.filter(n => !have.has(n));
        }
        return names.filter(n => !fs.existsSync(path.join(roomDir(code), 'assets', n)));
    },
    async getAsset (code, name) {
        if (pool) {
            const r = await pool.query('SELECT data FROM assets WHERE code = $1 AND name = $2', [code, name]);
            return r.rows[0] ? r.rows[0].data : null;
        }
        const p = path.join(roomDir(code), 'assets', name);
        return fs.existsSync(p) ? fs.readFileSync(p) : null;
    },
    async putAsset (code, name, buf) {
        if (pool) {
            await pool.query('INSERT INTO assets (code, name, data) VALUES ($1, $2, $3) ON CONFLICT DO NOTHING', [code, name, buf]);
            return;
        }
        const dir = path.join(roomDir(code), 'assets');
        fs.mkdirSync(dir, {recursive: true});
        const p = path.join(dir, name);
        if (!fs.existsSync(p)) fs.writeFileSync(p, buf);
    }
};

// ---------- rooms ----------
const rooms = new Map(); // code -> {code, project, clients:Set<ws>, meta, saveTimer, snapshotWaiters}

function roomDir (code) { return path.join(DATA_DIR, code); }

async function loadRoom (code) {
    if (rooms.has(code)) return rooms.get(code);
    const rec = await store.getRoom(code);
    if (!rec) return null;
    const room = {code, project: rec.project, clients: new Set(), meta: rec.meta || {}, saveTimer: null, snapshotWaiters: []};
    rooms.set(code, room);
    return room;
}

async function makeCode () {
    const letters = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
    let code = '';
    for (let i = 0; i < 5; i++) code += letters[Math.floor(Math.random() * letters.length)];
    return (rooms.has(code) || await store.exists(code)) ? makeCode() : code;
}

async function createRoom (title) {
    const code = await makeCode();
    const meta = {title: title || 'Untitled project', created: Date.now()};
    await store.saveRoom(code, meta, null);
    const room = {code, project: null, clients: new Set(), meta, saveTimer: null, snapshotWaiters: []};
    rooms.set(code, room);
    return room;
}

function saveRoom (room) {
    clearTimeout(room.saveTimer);
    room.saveTimer = setTimeout(() => {
        store.saveRoom(room.code, room.meta, room.project).catch(e => console.warn('save failed', e.message));
    }, 500);
}

const MIME = {svg: 'image/svg+xml', png: 'image/png', jpg: 'image/jpeg', jpeg: 'image/jpeg', gif: 'image/gif',
    bmp: 'image/bmp', wav: 'audio/wav', mp3: 'audio/mpeg'};

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

const wrap = fn => (req, res) => fn(req, res).catch(e => { console.warn(e); res.status(500).json({error: 'server error'}); });

app.post('/api/rooms', express.json(), wrap(async (req, res) => {
    const room = await createRoom(req.body && req.body.title);
    res.json({code: room.code});
}));

app.get('/api/rooms/:code', wrap(async (req, res) => {
    const room = await loadRoom(req.params.code.toUpperCase());
    if (!room) return res.status(404).json({error: 'no such room'});
    res.json({code: room.code, title: room.meta.title, users: usersOf(room).length, hasProject: !!room.project});
}));

const ASSET_RE = /^[a-f0-9]{32}\.(svg|png|jpg|jpeg|gif|bmp|wav|mp3)$/i;
app.post('/api/rooms/:code/assets-check', express.json({limit: '2mb'}), wrap(async (req, res) => {
    const room = await loadRoom(req.params.code.toUpperCase());
    if (!room) return res.status(404).end();
    const files = (Array.isArray(req.body && req.body.files) ? req.body.files : []).filter(f => ASSET_RE.test(f));
    res.json({missing: files.length ? await store.missingAssets(room.code, files) : []});
}));

// Asset store: the sender uploads costume/sound bytes here, other editors fetch them through
// scratch-storage as if this were assets.scratch.mit.edu.
app.get('/api/rooms/:code/assets/:file', wrap(async (req, res) => {
    const {code, file} = req.params;
    if (!ASSET_RE.test(file)) return res.status(400).end();
    const buf = await store.getAsset(code.toUpperCase(), file);
    if (!buf) return res.status(404).end();
    res.set('Cache-Control', 'public, max-age=31536000, immutable');
    res.type(MIME[file.split('.').pop().toLowerCase()] || 'application/octet-stream');
    res.send(buf);
}));
app.post('/api/rooms/:code/assets/:file', express.raw({type: () => true, limit: '60mb'}), wrap(async (req, res) => {
    const {code, file} = req.params;
    if (!ASSET_RE.test(file)) return res.status(400).end();
    const room = await loadRoom(code.toUpperCase());
    if (!room) return res.status(404).end();
    if (!Buffer.isBuffer(req.body) || !req.body.length) return res.status(400).end();
    await store.putAsset(room.code, file, req.body);
    res.json({ok: true});
}));
app.head('/api/rooms/:code/assets/:file', wrap(async (req, res) => {
    res.status(await store.hasAsset(req.params.code.toUpperCase(), req.params.file) ? 200 : 404).end();
}));

// Download the room as a .sb3-compatible project.json (the editor's File menu also works).
app.get('/api/rooms/:code/project.json', wrap(async (req, res) => {
    const room = await loadRoom(req.params.code.toUpperCase());
    if (!room || !room.project) return res.status(404).end();
    res.type('json').send(room.project);
}));

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

wss.on('connection', async (ws, req) => {
    const url = new URL(req.url, 'http://x');
    const code = (url.searchParams.get('room') || '').toUpperCase();
    let room = null;
    try { room = await loadRoom(code); } catch (e) { console.warn(e); }
    if (!room) { ws.close(4004, 'no such room'); return; }
    if (ws.readyState !== 1) return;

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

store.init().catch(e => { console.error('storage init failed', e); process.exit(1); }).then(() => server.listen(PORT, () => {
    const ips = Object.values(os.networkInterfaces()).flat()
        .filter(i => i && i.family === 'IPv4' && !i.internal).map(i => i.address);
    console.log('');
    console.log('  Scratch Together is running');
    console.log(`  You:      http://localhost:${PORT}`);
    ips.forEach(ip => console.log(`  Friends:  http://${ip}:${PORT}   (same wifi)`));
    console.log('');
}));
