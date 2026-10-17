// Claude Maximizer server: serves the editor, the game projects, keeps playtest notes, writes NOTES.md for
// Claude, and pushes file changes to the page so edits show up live.  node server.js → http://localhost:4990
const http = require('http'), fs = require('fs'), path = require('path');
const PORT = process.env.PORT || 4990;
const ROOT = __dirname, PUB = path.join(ROOT, 'public'), PROJECTS = path.join(ROOT, 'projects');
const notesLib = require('./tools/notes-lib');
const art = require('./tools/art-lib'), claude = require('./tools/claude-runner'), db = require('./tools/db');
const SOUND_EXT = { 'audio/wav': 'wav', 'audio/x-wav': 'wav', 'audio/mpeg': 'mp3', 'audio/mp3': 'mp3', 'audio/ogg': 'ogg', 'audio/webm': 'webm', 'video/webm': 'webm', 'audio/mp4': 'm4a', 'audio/x-m4a': 'm4a', 'audio/aac': 'aac', 'audio/flac': 'flac' };
const readGame = pid => { try { return JSON.parse(fs.readFileSync(path.join(PROJECTS, pid, 'game.json'), 'utf8')); } catch { return null; } };
const MIME = { '.wav': 'audio/wav', '.mp3': 'audio/mpeg', '.ogg': 'audio/ogg', '.webm': 'audio/webm', '.m4a': 'audio/mp4', '.aac': 'audio/aac', '.flac': 'audio/flac', '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8', '.json': 'application/json; charset=utf-8', '.png': 'image/png', '.md': 'text/markdown; charset=utf-8', '.svg': 'image/svg+xml', '.txt': 'text/plain; charset=utf-8', '.wasm': 'application/wasm' };

const clients = new Map(); // project id → Set of SSE responses
const send = (pid, event, data) => { for (const res of clients.get(pid) || []) res.write(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`); };
const json = (res, code, obj) => { res.writeHead(code, { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' }); res.end(JSON.stringify(obj)); };
const readBody = req => new Promise(r => { let b = ''; req.on('data', c => { b += c; if (b.length > 20e6) req.destroy(); }); req.on('end', () => { try { r(JSON.parse(b || '{}')); } catch { r({}); } }); });
const safeId = s => String(s || '').toLowerCase().replace(/[^a-z0-9_-]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 40);

function listProjects() {
  if (!fs.existsSync(PROJECTS)) return [];
  return fs.readdirSync(PROJECTS).filter(d => fs.existsSync(path.join(PROJECTS, d, 'game.json'))).map(d => { try { const g = JSON.parse(fs.readFileSync(path.join(PROJECTS, d, 'game.json'), 'utf8')); return { id: d, name: g.name || d, mode: g.mode || '2d' }; } catch { return { id: d, name: d, mode: '2d', broken: true }; } });
}
function serveFile(res, file) {
  fs.stat(file, (err, st) => {
    if (err || !st.isFile()) { res.writeHead(404); return res.end('Not found'); }
    res.writeHead(200, { 'Content-Type': MIME[path.extname(file).toLowerCase()] || 'application/octet-stream', 'Cache-Control': 'no-store' });
    fs.createReadStream(file).pipe(res);
  });
}

const server = http.createServer(async (req, res) => {
  const url = new URL(req.url, 'http://x'), p = url.pathname;
  try {
    if (p === '/api/projects' && req.method === 'GET') return json(res, 200, { projects: listProjects() });
    if (p === '/api/projects' && req.method === 'POST') {
      const b = await readBody(req); const id = safeId(b.name); if (!id) return json(res, 400, { error: 'Give the game a name.' });
      const dir = path.join(PROJECTS, id); if (fs.existsSync(dir)) return json(res, 409, { error: 'A game with that name already exists.' });
      const tpl = path.join(ROOT, 'templates', 'blank-2d');
      fs.cpSync(tpl, dir, { recursive: true });
      const g = JSON.parse(fs.readFileSync(path.join(dir, 'game.json'), 'utf8')); g.name = String(b.name).trim().slice(0, 60); fs.writeFileSync(path.join(dir, 'game.json'), JSON.stringify(g, null, 2));
      watchProject(id); return json(res, 200, { id });
    }
    if (p === '/api/notes' && req.method === 'GET') { const pid = safeId(url.searchParams.get('project')); return json(res, 200, { notes: notesLib.load(pid).notes }); }
    if (p === '/api/notes' && req.method === 'POST') {
      const b = await readBody(req); const pid = safeId(b.project); if (!pid || !fs.existsSync(path.join(PROJECTS, pid))) return json(res, 404, { error: 'No such game.' });
      const note = notesLib.add(pid, b.note || {}); db.save(pid); send(pid, 'notes', { id: note.id }); return json(res, 200, { note });
    }
    let m = p.match(/^\/api\/notes\/(\d+)$/);
    if (m && (req.method === 'PATCH' || req.method === 'DELETE')) {
      const b = req.method === 'PATCH' ? await readBody(req) : {}; const pid = safeId(b.project || url.searchParams.get('project'));
      if (req.method === 'DELETE') { notesLib.remove(pid, +m[1]); db.save(pid); send(pid, 'notes', {}); return json(res, 200, { ok: true }); }
      const note = notesLib.update(pid, +m[1], b); if (!note) return json(res, 404, { error: 'No such note.' }); db.save(pid); send(pid, 'notes', { id: note.id }); return json(res, 200, { note });
    }
    // ---- sounds: list, save settings, upload a file
    if (p === '/api/sounds' && req.method === 'GET') { const pid = safeId(url.searchParams.get('project')); let sounds = {}; try { sounds = JSON.parse(fs.readFileSync(path.join(PROJECTS, pid, 'sounds.json'), 'utf8')); } catch {} return json(res, 200, { sounds, used: art.usedSounds(pid) }); }
    if (p === '/api/sounds' && req.method === 'PUT') { const b = await readBody(req); const pid = safeId(b.project); if (!readGame(pid)) return json(res, 404, { error: 'No such game.' }); fs.writeFileSync(path.join(PROJECTS, pid, 'sounds.json'), JSON.stringify(b.sounds || {}, null, 2)); db.save(pid); return json(res, 200, { ok: true }); }
    if (p === '/api/sounds/upload' && req.method === 'POST') {
      const b = await readBody(req); const pid = safeId(b.project); const name = safeId(b.name); if (!readGame(pid) || !name) return json(res, 404, { error: 'No such game or sound.' });
      const m = /^data:([\w/+.-]+);base64,(.+)$/.exec(b.dataUrl || ''); if (!m) return json(res, 400, { error: 'Send the file as a data URL.' });
      const ext = SOUND_EXT[m[1]] || (b.ext && /^[a-z0-9]{2,4}$/.test(b.ext) ? b.ext : null); if (!ext) return json(res, 400, { error: 'Unsupported audio type ' + m[1] });
      const buf = Buffer.from(m[2], 'base64'); if (buf.length > 8e6) return json(res, 400, { error: 'Keep sounds under 8 MB.' });
      fs.mkdirSync(path.join(PROJECTS, pid, 'sounds'), { recursive: true }); const rel = `sounds/${name}.${ext}`; fs.writeFileSync(path.join(PROJECTS, pid, rel), buf);
      let sounds = {}; try { sounds = JSON.parse(fs.readFileSync(path.join(PROJECTS, pid, 'sounds.json'), 'utf8')); } catch {} sounds[name] = { file: rel }; fs.writeFileSync(path.join(PROJECTS, pid, 'sounds.json'), JSON.stringify(sounds, null, 2)); db.save(pid);
      return json(res, 200, { ok: true, file: rel, sounds });
    }
    // ---- art: write a sprite/model into the code, or paint level rows into the scene file
    if (p === '/api/art/sprite' && req.method === 'POST') { const b = await readBody(req); const pid = safeId(b.project); if (!readGame(pid)) return json(res, 404, { error: 'No such game.' }); if (!/^[\w-]{1,40}$/.test(b.name || '')) return json(res, 400, { error: 'Sprite names are letters, numbers, - and _.' }); const r = art.saveArt(pid, b); return json(res, r.error ? 400 : 200, r); }
    if (p === '/api/art/tiles' && req.method === 'POST') { const b = await readBody(req); const pid = safeId(b.project); if (!readGame(pid)) return json(res, 404, { error: 'No such game.' }); const r = art.saveTiles(pid, b); return json(res, r.error ? 409 : 200, r); }
    // ---- Claude built in
    if (p === '/api/claude/run' && req.method === 'POST') { const b = await readBody(req); const pid = safeId(b.project); const g = readGame(pid); if (!g) return json(res, 404, { error: 'No such game.' }); const r = claude.start(pid, g, { kind: b.kind === 'notes' ? 'notes' : 'ask', text: String(b.text || '').slice(0, 4000), resume: b.resume !== false }, ev => send(pid, 'claude', ev)); return json(res, r.error ? 409 : 200, r); }
    if (p === '/api/claude/stop' && req.method === 'POST') { const b = await readBody(req); return json(res, 200, { stopped: claude.stop(safeId(b.project)) }); }
    if (p === '/api/claude/forget' && req.method === 'POST') { const b = await readBody(req); claude.forget(safeId(b.project)); return json(res, 200, { ok: true }); }
    if (p === '/api/claude/status' && req.method === 'GET') return json(res, 200, claude.status(safeId(url.searchParams.get('project'))));
    if (p === '/api/events') {
      const pid = safeId(url.searchParams.get('project'));
      res.writeHead(200, { 'Content-Type': 'text/event-stream', 'Cache-Control': 'no-cache', Connection: 'keep-alive' }); res.write(': hi\n\n');
      if (!clients.has(pid)) clients.set(pid, new Set()); clients.get(pid).add(res); watchProject(pid);
      const ping = setInterval(() => res.write(': ping\n\n'), 25000);
      req.on('close', () => { clearInterval(ping); clients.get(pid).delete(res); }); return;
    }
    m = p.match(/^\/p\/([a-z0-9_-]+)\/(.+)$/);
    if (m) { const file = path.normalize(path.join(PROJECTS, m[1], m[2])); if (!file.startsWith(PROJECTS)) { res.writeHead(403); return res.end(); } if (m[2] === 'sounds.json' && !fs.existsSync(file)) return json(res, 200, {}); return serveFile(res, file); }
    const file = path.normalize(path.join(PUB, p === '/' ? 'index.html' : p)); if (!file.startsWith(PUB)) { res.writeHead(403); return res.end(); }
    serveFile(res, file);
  } catch (e) { console.error(e); json(res, 500, { error: e.message }); }
});

// file watching: when Claude edits a script the page reloads it; when notes.json changes (Claude replied) the list refreshes
const watchers = new Map();
function watchProject(pid) {
  const dir = path.join(PROJECTS, pid); if (watchers.has(pid) || !fs.existsSync(dir)) return;
  let pending = new Set(), timer = null;
  const w = fs.watch(dir, { recursive: true }, (ev, file) => {
    if (!file) return; file = String(file).replace(/\\/g, '/');
    const isNotes = file === 'notes.json', isCode = /\.(js|json)$/.test(file) && !isNotes && !file.startsWith('notes') && !file.startsWith('sounds/');
    if (!isNotes && !isCode) return; // NOTES.md, note pictures, editor temp files: not a reason to reload the game
    pending.add(file); clearTimeout(timer);
    timer = setTimeout(() => {
      const files = [...pending]; pending = new Set();
      if (files.includes('notes.json')) { send(pid, 'notes', {}); db.save(pid); }
      const code = files.filter(f => f !== 'notes.json'); if (code.length) send(pid, 'files', { files: code });
    }, 150);
  });
  watchers.set(pid, w);
}

// notes Claude closes through the CLI change notes.json on disk; the file watcher copies that into the database too
(async () => {
  try { if (await db.init()) { const n = await db.restore(pid => { try { notesLib.save(pid, notesLib.load(pid)); } catch {} }); console.log(`Database on: restored ${n} saved file${n === 1 ? '' : 's'} (notes, pictures, sounds)`); } }
  catch (e) { console.error('Database unavailable, notes stay on disk only:', e.message); }
  start();
})();
function start() { server.listen(PORT, () => {
  const ps = listProjects(); ps.forEach(p => watchProject(p.id));
  console.log(`Claude Maximizer on http://localhost:${PORT}  (${ps.length} game${ps.length === 1 ? '' : 's'}: ${ps.map(p => p.id).join(', ') || 'none yet'})`);
});
}
