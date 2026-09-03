'use strict';
// Scratch Together — real-time collaborative editing in the real Scratch 3 editor.
// One server, one room code, everybody edits the same project live.

const express = require('express');
const http = require('http');
const path = require('path');
const fs = require('fs');
const os = require('os');
const {WebSocketServer, WebSocket} = require('ws');

const PORT = process.env.PORT || 4940;
const DATA_DIR = path.join(__dirname, 'data');
const BACKPACK_DIR = path.join(DATA_DIR, '_backpack');
// Cloud variables go to the user's own CloudLift server (speaks Scratch's cloud protocol).
const CLOUD_HOST = process.env.CLOUD_HOST || 'cloudlift.apps.tas-ndc.kuhn-labs.com';
const crypto = require('crypto');
const cloudProjectId = code => String(9000000000 + [...code].reduce((n, ch) => n * 32 + 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'.indexOf(ch), 0));
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
                await pool.query('CREATE TABLE IF NOT EXISTS backpack_items (username TEXT, id TEXT, item JSONB, created BIGINT, PRIMARY KEY (username, id))');
                await pool.query('CREATE TABLE IF NOT EXISTS backpack_files (name TEXT PRIMARY KEY, data BYTEA)');
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
    async listRooms () {
        if (pool) {
            const r = await pool.query('SELECT code, meta FROM rooms');
            return r.rows.map(x => ({code: x.code, meta: x.meta || {}}));
        }
        if (!fs.existsSync(DATA_DIR)) return [];
        return fs.readdirSync(DATA_DIR).filter(d => /^[A-Z0-9]{5}$/.test(d)).map(code => {
            let meta = {};
            try { meta = JSON.parse(fs.readFileSync(path.join(roomDir(code), 'meta.json'), 'utf8')); } catch (e) { /* none */ }
            return {code, meta};
        });
    },
    async deleteRoom (code) {
        if (pool) {
            await pool.query('DELETE FROM rooms WHERE code = $1', [code]);
            await pool.query('DELETE FROM assets WHERE code = $1', [code]);
            return;
        }
        fs.rmSync(roomDir(code), {recursive: true, force: true});
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
    // ---- backpack (per user name, files named by md5 like Scratch's backpack server) ----
    async backpackList (username, limit, offset) {
        if (pool) {
            const r = await pool.query('SELECT item FROM backpack_items WHERE username = $1 ORDER BY created DESC LIMIT $2 OFFSET $3',
                [username, limit, offset]);
            return r.rows.map(x => x.item);
        }
        const dir = path.join(BACKPACK_DIR, username);
        if (!fs.existsSync(dir)) return [];
        return fs.readdirSync(dir).filter(f => f.endsWith('.json'))
            .map(f => JSON.parse(fs.readFileSync(path.join(dir, f), 'utf8')))
            .sort((a, b) => b.created - a.created).slice(offset, offset + limit);
    },
    async backpackAdd (username, item, files) {
        if (pool) {
            for (const [name, buf] of files) {
                await pool.query('INSERT INTO backpack_files (name, data) VALUES ($1, $2) ON CONFLICT DO NOTHING', [name, buf]);
            }
            await pool.query('INSERT INTO backpack_items (username, id, item, created) VALUES ($1, $2, $3, $4)',
                [username, item.id, JSON.stringify(item), item.created]);
            return;
        }
        fs.mkdirSync(path.join(BACKPACK_DIR, 'files'), {recursive: true});
        fs.mkdirSync(path.join(BACKPACK_DIR, username), {recursive: true});
        for (const [name, buf] of files) {
            const fp = path.join(BACKPACK_DIR, 'files', name);
            if (!fs.existsSync(fp)) fs.writeFileSync(fp, buf);
        }
        fs.writeFileSync(path.join(BACKPACK_DIR, username, `${item.id}.json`), JSON.stringify(item));
    },
    async backpackDelete (username, id) {
        if (pool) { await pool.query('DELETE FROM backpack_items WHERE username = $1 AND id = $2', [username, id]); return; }
        const fp = path.join(BACKPACK_DIR, username, `${id}.json`);
        if (fs.existsSync(fp)) fs.unlinkSync(fp);
    },
    async backpackFile (name) {
        if (pool) {
            const r = await pool.query('SELECT data FROM backpack_files WHERE name = $1', [name]);
            return r.rows[0] ? r.rows[0].data : null;
        }
        const fp = path.join(BACKPACK_DIR, 'files', name);
        return fs.existsSync(fp) ? fs.readFileSync(fp) : null;
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
function parseProject (str) {
    if (typeof str !== 'string' || str.length < 2 || str.length > 60 * 1024 * 1024) return null;
    try {
        const p = JSON.parse(str);
        return (Array.isArray(p.targets) && p.targets.some(t => t && t.isStage)) ? p : null;
    } catch (e) { return null; }
}
const validProject = str => !!parseProject(str);

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

function summary (code, meta) {
    const live = rooms.get(code);
    return {
        code, title: meta.title || 'Untitled project', created: meta.created || 0, updated: meta.updated || meta.created || 0,
        thumb: meta.thumb || null, cloudMode: meta.cloudMode || 'live', sprites: meta.sprites || 0,
        online: live ? usersOf(live).length : 0, people: live ? usersOf(live).map(u => u.name) : []
    };
}

app.get('/api/rooms', wrap(async (req, res) => {
    const list = await store.listRooms();
    res.json(list.map(r => summary(r.code, r.meta)).sort((a, b) => b.updated - a.updated));
}));

app.get('/api/rooms/:code', wrap(async (req, res) => {
    const room = await loadRoom(req.params.code.toUpperCase());
    if (!room) return res.status(404).json({error: 'no such room'});
    res.json(Object.assign(summary(room.code, room.meta), {hasProject: !!room.project, cloudProjectId: cloudProjectId(room.code)}));
}));

app.delete('/api/rooms/:code', wrap(async (req, res) => {
    const code = req.params.code.toUpperCase();
    const room = rooms.get(code);
    if (room) {
        for (const c of room.clients) { try { c.close(4010, 'room deleted'); } catch (e) { /* ignore */ } }
        clearTimeout(room.saveTimer);
        rooms.delete(code);
    }
    await store.deleteRoom(code);
    res.json({ok: true});
}));

// Room settings (title, cloud-variable mode) — shared by everyone in the room.
app.post('/api/rooms/:code/settings', express.json(), wrap(async (req, res) => {
    const room = await loadRoom(req.params.code.toUpperCase());
    if (!room) return res.status(404).end();
    const b = req.body || {};
    if (typeof b.title === 'string' && b.title.trim()) room.meta.title = b.title.trim().slice(0, 100);
    if (['live', 'sim', 'off'].includes(b.cloudMode)) room.meta.cloudMode = b.cloudMode;
    saveRoom(room);
    broadcast(room, {type: 'settings', title: room.meta.title, cloudMode: room.meta.cloudMode || 'live'});
    res.json({title: room.meta.title, cloudMode: room.meta.cloudMode || 'live'});
}));

// Stage thumbnail from the host (small JPEG data URL) for the projects page.
app.post('/api/rooms/:code/thumbnail', express.text({type: '*/*', limit: '400kb'}), wrap(async (req, res) => {
    const room = await loadRoom(req.params.code.toUpperCase());
    if (!room) return res.status(404).end();
    if (/^data:image\/(jpeg|png|webp);base64,/.test(req.body || '')) { room.meta.thumb = req.body; saveRoom(room); }
    res.json({ok: true});
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
const uploadAsset = wrap(async (req, res) => {
    const {code, file} = req.params;
    if (!ASSET_RE.test(file)) return res.status(400).end();
    const room = await loadRoom(code.toUpperCase());
    if (!room) return res.status(404).end();
    if (!Buffer.isBuffer(req.body) || !req.body.length) return res.status(400).end();
    await store.putAsset(room.code, file, req.body);
    res.json({ok: true, status: 'ok', 'content-name': file});
});
app.post('/api/rooms/:code/assets/:file', express.raw({type: () => true, limit: '60mb'}), uploadAsset);
app.put('/api/rooms/:code/assets/:file', express.raw({type: () => true, limit: '60mb'}), uploadAsset);

app.get('/api/config', (req, res) => res.json({cloudHost: CLOUD_HOST}));
app.get('/api/health', (req, res) => res.json({ok: true, rooms: rooms.size, uptime: Math.round(process.uptime())}));

// ---------- backpack (same API scratch-gui expects from Scratch's backpack server) ----------
const BP_MIME_EXT = {'image/svg+xml': 'svg', 'image/png': 'png', 'audio/x-wav': 'wav', 'audio/wav': 'wav',
    'audio/mp3': 'mp3', 'audio/mpeg': 'mp3', 'application/zip': 'zip', 'application/json': 'json'};
const BP_EXT_MIME = {svg: 'image/svg+xml', png: 'image/png', wav: 'audio/wav', mp3: 'audio/mpeg', zip: 'application/zip',
    json: 'application/json', jpg: 'image/jpeg'};
const bpUser = u => String(u || '').replace(/[^A-Za-z0-9_\-. ]/g, '').trim().slice(0, 24) || 'someone';

app.get('/backpack/:file([a-f0-9]{32}\.[a-z0-9]+)', wrap(async (req, res) => {
    const buf = await store.backpackFile(req.params.file);
    if (!buf) return res.status(404).end();
    res.set('Cache-Control', 'public, max-age=31536000, immutable');
    res.type(BP_EXT_MIME[req.params.file.split('.').pop()] || 'application/octet-stream');
    res.send(buf);
}));
app.get('/backpack/:username', wrap(async (req, res) => {
    const limit = Math.min(50, parseInt(req.query.limit, 10) || 20);
    const offset = parseInt(req.query.offset, 10) || 0;
    res.json(await store.backpackList(bpUser(req.params.username), limit, offset));
}));
app.post('/backpack/:username', express.json({limit: '60mb'}), wrap(async (req, res) => {
    const {type, mime, name, body, thumbnail} = req.body || {};
    if (!type || !body) return res.status(400).json({error: 'bad item'});
    const ext = BP_MIME_EXT[mime] || 'bin';
    const bodyBuf = Buffer.from(String(body), 'base64');
    const thumbBuf = Buffer.from(String(thumbnail || ''), 'base64');
    const bodyName = `${crypto.createHash('md5').update(bodyBuf).digest('hex')}.${ext}`;
    const thumbName = `${crypto.createHash('md5').update(thumbBuf).digest('hex')}.jpg`;
    const item = {id: crypto.randomBytes(8).toString('hex'), type, mime, name: String(name || type).slice(0, 60),
        body: bodyName, thumbnail: thumbName, created: Date.now()};
    await store.backpackAdd(bpUser(req.params.username), item, [[bodyName, bodyBuf], [thumbName, thumbBuf]]);
    res.json(item);
}));
app.delete('/backpack/:username/:id', wrap(async (req, res) => {
    await store.backpackDelete(bpUser(req.params.username), String(req.params.id).slice(0, 32));
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
app.get('/projects', (req, res) => res.sendFile(path.join(__dirname, 'public', 'index.html')));
app.get('/r/:code', (req, res) => res.redirect(`/editor?room=${encodeURIComponent(req.params.code.toUpperCase())}`));

// ---------- websocket ----------
const server = http.createServer(app);
const wss = new WebSocketServer({noServer: true, maxPayload: 64 * 1024 * 1024});
const cloudWss = new WebSocketServer({noServer: true});
server.on('upgrade', (req, socket, head) => {
    const pathname = new URL(req.url, 'http://x').pathname;
    if (pathname === '/ws') wss.handleUpgrade(req, socket, head, ws => wss.emit('connection', ws, req));
    else if (pathname === '/cloud') cloudWss.handleUpgrade(req, socket, head, ws => cloudWss.emit('connection', ws, req));
    else socket.destroy();
});

// Tell CloudLift the room's name so its dashboard shows "My Game" instead of a number.
const registered = new Map();
async function registerWithCloudLift (room) {
    if (!CLOUD_HOST) return;
    const key = `${room.code}:${room.meta.title}`;
    if (registered.get(room.code) === key) return;
    registered.set(room.code, key);
    await fetch(`https://${CLOUD_HOST}/api/projects`, {
        method: 'POST', headers: {'Content-Type': 'application/json'},
        body: JSON.stringify({id: cloudProjectId(room.code), title: `${room.meta.title} (Scratch Together ${room.code})`})
    });
}

// Simulated cloud variables: kept per room on this server, shared with everyone in the room.
const simClients = new Map(); // code -> Set<ws>
function simCloud (client, room) {
    if (!simClients.has(room.code)) simClients.set(room.code, new Set());
    const peers = simClients.get(room.code);
    peers.add(client);
    room.meta.cloudVars = room.meta.cloudVars || {};
    client.on('message', d => {
        for (const line of d.toString().split('\n')) {
            if (!line.trim()) continue;
            let msg; try { msg = JSON.parse(line); } catch (e) { continue; }
            if (msg.method === 'handshake') {
                const lines = Object.entries(room.meta.cloudVars).map(([name, value]) => JSON.stringify({method: 'set', name, value}));
                if (lines.length && client.readyState === 1) client.send(`${lines.join('\n')}\n`);
            } else if ((msg.method === 'set' || msg.method === 'create') && typeof msg.name === 'string') {
                const value = String(msg.value === undefined ? 0 : msg.value).slice(0, 256);
                room.meta.cloudVars[msg.name] = value;
                saveRoom(room);
                const out = `${JSON.stringify({method: 'set', name: msg.name, value})}\n`;
                for (const p of peers) if (p !== client && p.readyState === 1) p.send(out);
            } else if (msg.method === 'rename' && msg.name && msg.new_name) {
                room.meta.cloudVars[msg.new_name] = room.meta.cloudVars[msg.name]; delete room.meta.cloudVars[msg.name]; saveRoom(room);
            } else if (msg.method === 'delete' && msg.name) {
                delete room.meta.cloudVars[msg.name]; saveRoom(room);
            }
        }
    });
    client.on('close', () => peers.delete(client));
    client.on('error', () => {});
}

// Cloud variables: the editor talks to us. "live" relays to CloudLift line for line, "sim" stays in the room.
cloudWss.on('connection', async (client, req) => {
    const url = new URL(req.url, 'http://x');
    const room = await loadRoom((url.searchParams.get('room') || '').toUpperCase()).catch(() => null);
    if (!room) { client.close(4004); return; }
    const mode = room.meta.cloudMode || 'live';
    if (mode === 'sim') return simCloud(client, room);
    if (mode === 'off') { client.close(4005, 'cloud off'); return; }
    registerWithCloudLift(room).catch(() => {});
    const up = new WebSocket(`wss://${CLOUD_HOST}/`, {headers: {'User-Agent': 'ScratchTogether'}});
    const pending = [];
    up.on('open', () => { pending.splice(0).forEach(d => up.send(d)); });
    up.on('message', d => { if (client.readyState === 1) client.send(d.toString()); });
    up.on('close', () => { if (client.readyState === 1) client.close(1012, 'cloud server closed'); });
    up.on('error', e => { console.warn('cloud upstream error', e.message); if (client.readyState === 1) client.close(1011); });
    client.on('message', d => { const s = d.toString(); if (up.readyState === 1) up.send(s); else if (up.readyState === 0) pending.push(s); });
    client.on('close', () => { try { up.close(); } catch (e) { /* ignore */ } });
    client.on('error', () => {});
});

const COLORS = ['#ff6680', '#4c97ff', '#59c059', '#ffab19', '#9966ff', '#0fbd8c', '#ff8c1a', '#5cb1d6', '#cf63cf'];
let nextUser = 1;

function sendInit (room, ws) {
    ws.send(JSON.stringify({
        type: 'init',
        project: room.project,
        title: room.meta.title,
        cloudMode: room.meta.cloudMode || 'live',
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
            {
                const parsed = parseProject(msg.project);
                if (!parsed) return;
                room.project = msg.project;
                if (msg.title) room.meta.title = msg.title;
                room.meta.updated = Date.now();
                room.meta.sprites = parsed.targets.filter(t => !t.isStage).length;
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
            registerWithCloudLift(room).catch(() => {});
            return;
        case 'blocks': case 'sprite': case 'deleteSprite': case 'reorder':
        case 'project': case 'extension': case 'blocksReplace': case 'blocksAdd': case 'monitor':
            msg.from = ws.userId;
            if (process.env.DEBUG || (msg.type !== 'blocks' && msg.type !== 'monitor')) console.log(`[${code}] ${ws.userName}: ${msg.type} ${msg.sprite || ''}${msg.add ? ' (new)' : ''}${msg.rename ? ' → ' + msg.rename : ''} → ${room.clients.size - 1} others`);
            if (msg.type === 'project') {
                if (!validProject(msg.project)) return;
                room.project = msg.project; room.meta.updated = Date.now(); saveRoom(room);
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

process.on('uncaughtException', e => console.error('uncaught', e && e.stack || e));
process.on('unhandledRejection', e => console.error('unhandled', e && e.stack || e));

store.init().catch(e => { console.error('storage init failed', e); process.exit(1); }).then(() => server.listen(PORT, () => {
    const ips = Object.values(os.networkInterfaces()).flat()
        .filter(i => i && i.family === 'IPv4' && !i.internal).map(i => i.address);
    console.log('');
    console.log('  Scratch Together is running');
    console.log(`  You:      http://localhost:${PORT}`);
    ips.forEach(ip => console.log(`  Friends:  http://${ip}:${PORT}   (same wifi)`));
    console.log('');
}));
