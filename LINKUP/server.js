// LinkUp — a hub for every project in ~/claude.
// No dependencies: plain Node http server. `node server.js` → http://localhost:4510
const http = require('http');
const fs = require('fs');
const path = require('path');
const net = require('net');
const os = require('os');
const { spawn, execFile } = require('child_process');
const cloud = require('./cloud');
const CLOUD = cloud.IS_CLOUD;

const PORT = Number(process.env.PORT) || 4510;
const HOST = CLOUD ? '0.0.0.0' : '127.0.0.1';
const ROOT = path.resolve(process.env.PROJECTS_ROOT || path.join(__dirname, '..'));
const SELF = path.basename(__dirname);
const DATA_DIR = path.join(__dirname, 'data');
const DATA_FILE = path.join(DATA_DIR, 'hub.json');
const PREVIEW_DIR = path.join(__dirname, 'previews');
const PUBLIC_DIR = path.join(__dirname, 'public');
const MEMORY_DIR = path.join(os.homedir(), '.claude', 'projects', '-Users-colton-claude', 'memory');
const CHROME = '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
const CF_DOMAIN = 'apps.tas-ndc.kuhn-labs.com';
const SKIP_DIRS = new Set(['node_modules', '.git', '.next', '.cache', 'dist', 'build', '.venv', '__pycache__']);

fs.mkdirSync(DATA_DIR, { recursive: true });
fs.mkdirSync(PREVIEW_DIR, { recursive: true });

// ---------- saved data (your edits + custom projects) ----------
function loadData() {
  try { return Object.assign({ overrides: {}, custom: [] }, JSON.parse(fs.readFileSync(DATA_FILE, 'utf8'))); }
  catch { return { overrides: {}, custom: [] }; }
}
let data = loadData();
function saveData() {
  if (CLOUD) return cloud.saveData(data);
  fs.writeFileSync(DATA_FILE + '.tmp', JSON.stringify(data, null, 2));
  fs.renameSync(DATA_FILE + '.tmp', DATA_FILE);
}

// ---------- scanning ----------
const read = (f) => { try { return fs.readFileSync(f, 'utf8'); } catch { return null; } };
const readJSON = (f) => { try { return JSON.parse(fs.readFileSync(f, 'utf8')); } catch { return null; } };
const ls = (d) => { try { return fs.readdirSync(d, { withFileTypes: true }); } catch { return []; } };

function prettify(s) {
  return s.replace(/\.html?$/i, '').replace(/[-_]+/g, ' ').replace(/([a-z])([A-Z])/g, '$1 $2')
    .replace(/\s+/g, ' ').trim().replace(/\b\w/g, (c) => c.toUpperCase());
}

// Names + descriptions Claude already wrote down in memory, keyed by top-level folder.
function loadMemory() {
  const out = {};
  const index = read(path.join(MEMORY_DIR, 'MEMORY.md')) || '';
  for (const line of index.split('\n')) {
    const m = line.match(/^- \*\*(.+?)\*\*\s*\(`([^`]+)`\):\s*(?:See \[[^\]]*\]\(([^)]+)\)\.?)?\s*(.*)$/);
    if (!m) continue;
    const folder = m[2].replace(/\/$/, '').split('/')[0];
    const summary = m[4].replace(/^for full status\.?\s*/i, '').replace(/\*\*|`/g, '').trim();
    out[folder] = { name: m[1], memoryFile: m[3] || null, summary };
  }
  // memory files can also mention a folder in backticks
  for (const f of ls(MEMORY_DIR)) {
    if (!f.name.endsWith('.md') || f.name === 'MEMORY.md') continue;
    const txt = read(path.join(MEMORY_DIR, f.name)) || '';
    for (const [folder, info] of Object.entries(out)) if (info.memoryFile === f.name) info.memory = txt;
  }
  return out;
}

const decode = (t) => t && t.replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&#0?39;|&apos;/g, "'").replace(/&middot;/g, '·').replace(/&mdash;/g, '—').replace(/&ndash;/g, '–').replace(/&#(\d+);/g, (_, n) => String.fromCharCode(n));
function htmlMeta(file) {
  const h = read(file);
  if (!h) return {};
  const title = (h.match(/<title[^>]*>([^<]*)<\/title>/i) || [])[1];
  const desc = (h.match(/<meta[^>]+name=["']description["'][^>]+content=["']([^"']*)["']/i) || [])[1];
  return { title: decode(title && title.trim()), description: decode(desc && desc.trim()) };
}

function readmeBlurb(dir) {
  const r = read(path.join(dir, 'README.md'));
  if (!r) return null;
  const para = r.split(/\n\s*\n/).map((p) => p.trim()).find((p) => p && !p.startsWith('#') && !p.startsWith('!') && !p.startsWith('```') && !p.startsWith('<'));
  return para ? para.replace(/\s+/g, ' ').slice(0, 280) : null;
}

const DB_PORTS = new Set([5432, 3306, 6379, 27017, 9200]);
function detectPort(dir, pkg) {
  const texts = [];
  if (pkg && pkg.scripts) texts.push(Object.values(pkg.scripts).join('\n'));
  for (const f of ['server.js', 'index.js', 'app.js', 'server/index.js', 'server/server.js', 'src/server.js', 'bridge/server.js', 'vite.config.js', 'vite.config.mjs', 'client/vite.config.js']) {
    const t = read(path.join(dir, f));
    if (t) texts.push(t);
  }
  const all = texts.join('\n');
  const envAware = /process\.env\.PORT/.test(all);
  const patterns = [/\bPORT\s*(?:\|\||\?\?)\s*(\d{4,5})/g, /\blisten\(\s*(\d{4,5})/g, /(?<![A-Z])PORT\s*=\s*(\d{4,5})\b/g, /\bport\s*:\s*(\d{4,5})/g, /localhost:(\d{4,5})/g];
  for (const re of patterns) for (const m of all.matchAll(re)) {
    const n = Number(m[1]);
    if (!DB_PORTS.has(n)) return { port: n, envAware };
  }
  return { port: null, envAware };
}
function cfUrls(dir) {
  const y = read(path.join(dir, 'manifest.yml'));
  if (!y) return [];
  const routes = [...y.matchAll(/(?<![-\w])route:\s*["']?([^\s"']+)/g)].map((m) => 'https://' + m[1].replace(/^https?:\/\//, ''));
  if (routes.length) return routes;
  if (/random-route:\s*true/.test(y)) return [];
  const name = (y.match(/-\s*name:\s*["']?([\w.-]+)/) || [])[1];
  return name ? [`https://${name}.${CF_DOMAIN}`] : [];
}

function gitRemote(dir) {
  const cfg = read(path.join(dir, '.git', 'config'));
  const m = cfg && cfg.match(/\[remote "origin"\][^[]*?url\s*=\s*(\S+)/);
  if (!m) return null;
  return m[1].replace(/^git@github\.com:/, 'https://github.com/').replace(/\.git$/, '');
}

// newest file time + file count, a few levels deep, ignoring build junk
function walkStats(dir, depth = 3) {
  let newest = 0, count = 0;
  const stack = [[dir, 0]];
  while (stack.length && count < 4000) {
    const [d, lvl] = stack.pop();
    for (const e of ls(d)) {
      if (e.name.startsWith('.') && e.name !== '.env') continue;
      const p = path.join(d, e.name);
      if (e.isDirectory()) { if (!SKIP_DIRS.has(e.name) && lvl < depth) stack.push([p, lvl + 1]); continue; }
      count++;
      try { const s = fs.statSync(p); if (s.mtimeMs > newest) newest = s.mtimeMs; } catch {}
    }
  }
  return { newest, count };
}

// The folder holding the actual app (root, or one level down for wrapper folders).
function findAppRoot(dir) {
  const has = (d) => fs.existsSync(path.join(d, 'package.json')) || fs.existsSync(path.join(d, 'index.html')) || fs.existsSync(path.join(d, 'server.js'));
  if (has(dir)) return '';
  for (const e of ls(dir)) {
    if (e.isDirectory() && !SKIP_DIRS.has(e.name) && !e.name.startsWith('.') && has(path.join(dir, e.name))) return e.name;
  }
  for (const e of ls(dir)) if (e.isFile() && /\.html?$/i.test(e.name)) return '';
  return null;
}

function startCommand(appDir, pkg) {
  if (pkg && pkg.scripts) {
    if (pkg.scripts.start) return 'npm start';
    if (pkg.scripts.dev) return 'npm run dev';
  }
  if (fs.existsSync(path.join(appDir, 'server.js'))) return 'node server.js';
  if (fs.existsSync(path.join(appDir, 'start.command'))) return 'sh start.command';
  return null;
}

function findLooseShots(name) {
  const key = name.toLowerCase().replace(/[^a-z0-9]/g, '');
  if (key.length < 4) return [];
  return ls(ROOT).filter((e) => e.isFile() && /\.(png|jpe?g)$/i.test(e.name) && e.name.toLowerCase().replace(/[^a-z0-9]/g, '').startsWith(key)).map((e) => e.name);
}

function scanFolder(folder, memory) {
  const dir = path.join(ROOT, folder);
  const appSub = findAppRoot(dir);
  const appDir = appSub ? path.join(dir, appSub) : dir;
  const pkg = readJSON(path.join(appDir, 'package.json'));
  const entries = ls(dir);
  const files = entries.filter((e) => e.isFile()).map((e) => e.name);
  const htmlFile = fs.existsSync(path.join(appDir, 'index.html')) ? 'index.html'
    : (ls(appDir).find((e) => e.isFile() && /\.html?$/i.test(e.name)) || {}).name || null;
  const meta = htmlFile ? htmlMeta(path.join(appDir, htmlFile)) : {};
  const stats = walkStats(dir);
  const mem = memory[folder];
  let created = 0;
  try { created = fs.statSync(dir).birthtimeMs; } catch {}

  const lower = folder.toLowerCase();
  const allNames = entries.map((e) => e.name.toLowerCase());
  const cmd = startCommand(appDir, pkg);
  let kind = 'files';
  if (stats.count === 0) kind = 'empty';
  else if (cmd) kind = 'server';
  else if (htmlFile) kind = 'static';
  else if (lower.includes('roblox') || allNames.some((n) => /\.(rbxl|rbxm|lua|luau)$/.test(n))) kind = 'roblox';
  else if (lower.includes('scratch') || allNames.some((n) => n.endsWith('.sb3'))) kind = 'scratch';

  const shots = files.filter((f) => /\.(png|jpe?g|webp)$/i.test(f)).concat(findLooseShots(folder).map((f) => '../' + f));

  return {
    id: folder,
    folder,
    appSub,
    source: 'folder',
    kind,
    name: (mem && mem.name) || meta.title || (pkg && pkg.name && prettify(pkg.name)) || prettify(folder),
    description: (mem && mem.summary) || (pkg && pkg.description) || meta.description || readmeBlurb(appDir) || readmeBlurb(dir) || '',
    memory: mem ? mem.memory || null : null,
    hasMemory: !!mem,
    startCmd: cmd,
    needsInstall: !!(pkg && (pkg.dependencies || pkg.devDependencies) && !fs.existsSync(path.join(appDir, 'node_modules'))),
    ...(() => {
      const memPort = mem && (mem.summary.match(/localhost:(\d{4,5})/) || [])[1];
      const d = detectPort(appDir, pkg);
      return { port: memPort ? Number(memPort) : d.port, envAware: d.envAware };
    })(),
    htmlFile,
    liveUrls: cfUrls(appDir).concat(appDir !== dir ? cfUrls(dir) : []),
    github: gitRemote(dir),
    hasManifest: fs.existsSync(path.join(appDir, 'manifest.yml')),
    fileCount: stats.count,
    edited: stats.newest || created,
    created,
    screenshots: shots,
  };
}

function scanLooseHtml(file) {
  const p = path.join(ROOT, file);
  const meta = htmlMeta(p);
  const s = fs.statSync(p);
  return {
    id: file, folder: null, file, appSub: '', source: 'file', kind: 'static',
    name: meta.title || prettify(file), description: meta.description || 'Single-file page in ~/claude.',
    memory: null, hasMemory: false, startCmd: null, needsInstall: false, port: null, htmlFile: file,
    liveUrls: [], github: null, hasManifest: false, fileCount: 1, edited: s.mtimeMs, created: s.birthtimeMs, screenshots: [],
  };
}

let scanned = [];
function scan() {
  if (CLOUD) return scanned; // the cloud copy only knows what your Mac published
  const memory = loadMemory();
  const out = [];
  for (const e of ls(ROOT)) {
    if (e.name.startsWith('.') || e.name === SELF) continue;
    if (e.isDirectory()) out.push(scanFolder(e.name, memory));
    else if (e.isFile() && /\.html?$/i.test(e.name)) out.push(scanLooseHtml(e.name));
  }
  const byPort = {};
  for (const p of out) if (p.port) (byPort[p.port] = byPort[p.port] || []).push(p);
  let next = 5100;
  data.assignedPorts = data.assignedPorts || {};
  const taken = new Set(out.map((p) => p.port).concat(Object.values(data.assignedPorts)));
  for (const group of Object.values(byPort)) {
    if (group.length < 2) continue;
    for (const p of group) {
      if (!p.envAware) continue;
      if (data.assignedPorts[p.id]) { p.sharedPort = p.port; p.port = data.assignedPorts[p.id]; continue; }
      while (taken.has(next) || next === PORT) next++;
      p.sharedPort = p.port; p.port = data.assignedPorts[p.id] = next; taken.add(next++);
    }
  }
  saveData();
  scanned = out;
  return out;
}

// ---------- merging scan + your edits ----------
const EDITABLE = ['name', 'description', 'status', 'tags', 'pinned', 'hidden', 'liveUrl', 'github', 'port', 'startCmd', 'notes', 'color', 'links', 'url', 'kind', 'preview'];

function previewFor(p) {
  if (CLOUD) {
    const v = cloud.previews.get(safeId(p.id));
    return v ? '/previews/' + encodeURIComponent(safeId(p.id)) + '.png?v=' + v : null;
  }
  const file = path.join(PREVIEW_DIR, safeId(p.id) + '.png');
  if (fs.existsSync(file)) return '/previews/' + encodeURIComponent(safeId(p.id)) + '.png?v=' + Math.round(fs.statSync(file).mtimeMs);
  if (p.screenshots && p.screenshots.length && p.folder) {
    const shot = p.screenshots[0];
    return shot.startsWith('../') ? '/site/' + encodeURIComponent(shot.slice(3)) : '/site/' + encodeURIComponent(p.folder) + '/' + encodeURIComponent(shot);
  }
  return null;
}
const safeId = (id) => id.replace(/[^\w.-]+/g, '_');
function previewFile(p) {
  const own = path.join(PREVIEW_DIR, safeId(p.id) + '.png');
  if (fs.existsSync(own)) return own;
  if (p.screenshots && p.screenshots.length && p.folder) {
    const shot = p.screenshots[0];
    const f = shot.startsWith('../') ? path.join(ROOT, shot.slice(3)) : path.join(ROOT, p.folder, shot);
    if (fs.existsSync(f)) return f;
  }
  return null;
}

function merged() {
  const all = scanned.concat(data.custom.map((c) => Object.assign({
    source: 'custom', folder: null, kind: 'link', fileCount: 0, liveUrls: [], screenshots: [], startCmd: null, port: null,
    edited: c.createdAt || 0, created: c.createdAt || 0, description: '',
  }, c)));
  return all.map((p) => {
    const o = data.overrides[p.id] || {};
    const m = Object.assign({}, p, o);
    if (!m.status) m.status = p.kind === 'empty' ? 'idea' : 'active';
    if (!m.tags) m.tags = [];
    m.liveUrl = o.liveUrl !== undefined ? o.liveUrl : (p.liveUrls[0] || p.url || '');
    m.localUrl = m.port ? `http://localhost:${m.port}` : null;
    m.staticUrl = p.htmlFile ? (p.source === 'file' ? '/site/' + encodeURIComponent(p.file) : '/site/' + [p.folder, p.appSub, p.htmlFile].filter(Boolean).map(encodeURIComponent).join('/')) : null;
    m.previewUrl = o.preview || previewFor(p);
    m.running = runState(m);
    m.live = liveCache.get(m.liveUrl) || null;
    m.lastOpened = (data.overrides[p.id] || {}).lastOpened || 0;
    if (CLOUD) Object.assign(m, { localUrl: null, staticUrl: null, running: 'stopped', memory: null, startCmd: null });
    return m;
  });
}
const byId = (id) => merged().find((p) => p.id === id);

// ---------- running local servers ----------
const procs = new Map(); // id -> { child, logs, started, port }
const portOpen = new Map(); // port -> bool

function checkPort(port) {
  return new Promise((resolve) => {
    const s = net.connect({ port, host: '127.0.0.1' });
    const done = (v) => { s.destroy(); resolve(v); };
    s.setTimeout(400, () => done(false));
    s.once('connect', () => done(true));
    s.once('error', () => done(false));
  });
}
async function refreshPorts() {
  const ports = [...new Set(merged().map((p) => p.port).filter(Boolean))];
  await Promise.all(ports.map(async (pt) => portOpen.set(pt, await checkPort(pt))));
}
function runState(p) {
  const pr = procs.get(p.id);
  if (pr && !pr.exited) return portOpen.get(p.port) ? 'running' : 'starting';
  if (p.port && portOpen.get(p.port)) return 'running-elsewhere';
  return pr && pr.exitCode ? 'crashed' : 'stopped';
}

function pushLog(pr, chunk) {
  for (const line of chunk.toString().split(/\r?\n/)) if (line.trim()) pr.logs.push(line);
  if (pr.logs.length > 500) pr.logs.splice(0, pr.logs.length - 500);
}

function startProject(p) {
  const cur = procs.get(p.id);
  if (cur && !cur.exited) return cur;
  if (!p.startCmd) throw new Error('No start command. Set one in the project settings.');
  const cwd = path.join(ROOT, p.folder, p.appSub || '');
  const cmd = (p.needsInstall ? 'npm install && ' : '') + p.startCmd;
  const env = Object.assign({}, process.env, { FORCE_COLOR: '0' });
  if (p.port) env.PORT = String(p.port);
  const child = spawn('/bin/zsh', ['-lc', cmd], { cwd, env, detached: true });
  const pr = { child, logs: [`$ ${cmd}`, `(in ${cwd})`], started: Date.now(), exited: false, exitCode: null };
  child.stdout.on('data', (d) => pushLog(pr, d));
  child.stderr.on('data', (d) => pushLog(pr, d));
  child.on('exit', (code) => { pr.exited = true; pr.exitCode = code; pr.logs.push(`[exited with code ${code}]`); });
  procs.set(p.id, pr);
  touch(p.id);
  return pr;
}

function stopProject(p) {
  const pr = procs.get(p.id);
  if (pr && !pr.exited) {
    try { process.kill(-pr.child.pid, 'SIGTERM'); } catch {}
    setTimeout(() => { if (!pr.exited) try { process.kill(-pr.child.pid, 'SIGKILL'); } catch {} }, 3000);
    return Promise.resolve();
  }
  if (p.port && portOpen.get(p.port)) {
    // started outside the hub — stop whatever is listening on its port
    return new Promise((resolve) => execFile('lsof', ['-ti', `tcp:${p.port}`, '-sTCP:LISTEN'], (err, out) => {
      for (const pid of (out || '').split(/\s+/).filter(Boolean)) if (Number(pid) !== process.pid) try { process.kill(Number(pid), 'SIGTERM'); } catch {}
      resolve();
    }));
  }
  return Promise.resolve();
}

function touch(id) {
  data.overrides[id] = Object.assign(data.overrides[id] || {}, { lastOpened: Date.now() });
  saveData();
}

// ---------- live-site checks ----------
const liveCache = new Map(); // url -> { ok, status, at }
async function checkLive(url) {
  if (!url || !/^https?:/.test(url)) return null;
  const c = liveCache.get(url);
  if (c && Date.now() - c.at < 5 * 60e3) return c;
  let r;
  try {
    const res = await fetch(url, { method: 'GET', redirect: 'follow', signal: AbortSignal.timeout(6000) });
    r = { ok: res.status < 500 && res.status !== 404, status: res.status, at: Date.now() };
  } catch (e) { r = { ok: false, status: 0, at: Date.now() }; }
  liveCache.set(url, r);
  return r;
}

// ---------- screenshots (headless Chrome) ----------
const snapQueue = [];
let snapping = 0;
const snapState = { total: 0, done: 0, current: [] };

function snapTarget(p) {
  if (p.running === 'running' || p.running === 'running-elsewhere') return `http://127.0.0.1:${p.port}`;
  if (p.staticUrl) return `http://127.0.0.1:${PORT}${p.staticUrl}`;
  if (p.liveUrl && /^https?:/.test(p.liveUrl)) return p.liveUrl;
  return null;
}

function snap(p) {
  return new Promise((resolve) => {
    const url = snapTarget(p);
    if (!url || !fs.existsSync(CHROME)) return resolve({ ok: false, error: url ? 'Google Chrome not found' : 'Nothing to capture — start it, or give it a live URL.' });
    const final = path.join(PREVIEW_DIR, safeId(p.id) + '.png');
    const out = path.join(os.tmpdir(), 'linkup-' + safeId(p.id) + '-' + Date.now() + '.png');
    const profile = fs.mkdtempSync(path.join(os.tmpdir(), 'linkup-chrome-'));
    const args = ['--headless=new', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--hide-scrollbars', '--autoplay-policy=no-user-gesture-required', '--mute-audio', '--no-first-run', '--no-default-browser-check',
      `--user-data-dir=${profile}`, '--window-size=1280,800', '--virtual-time-budget=9000', '--run-all-compositor-stages-before-draw',
      `--screenshot=${out}`, url];
    execFile(CHROME, args, { timeout: 30000 }, (err) => {
      fs.rm(profile, { recursive: true, force: true }, () => {});
      if (data.overrides[p.id] && data.overrides[p.id].preview) { delete data.overrides[p.id].preview; saveData(); }
      let size = 0;
      try { size = fs.statSync(out).size; } catch {}
      // a near-empty PNG is a blank page — keep whatever preview we had before
      if (size > 6000) {
        fs.renameSync(out, final);
        return execFile('sips', ['-Z', '720', final], () => resolve({ ok: true }));
      }
      fs.rm(out, { force: true }, () => {});
      resolve({ ok: false, error: size ? 'The page was blank when captured. Try again once it is running, or upload a picture.' : (err ? 'Capture timed out' : 'Capture failed') });
    });
  });
}
function pumpSnaps() {
  while (snapping < 3 && snapQueue.length) {
    const p = snapQueue.shift();
    snapping++;
    snapState.current.push(p.name);
    snap(p).finally(() => {
      snapping--; snapState.done++;
      snapState.current = snapState.current.filter((n) => n !== p.name);
      pumpSnaps();
    });
  }
}

// ---------- open things on this Mac ----------
function revealFolder(p) {
  const target = p.folder ? path.join(ROOT, p.folder) : p.file ? path.join(ROOT, p.file) : null;
  if (!target) throw new Error('This project has no folder.');
  execFile('open', p.folder ? [target] : ['-R', target]);
}
function openTerminal(p) {
  if (!p.folder) throw new Error('This project has no folder.');
  execFile('open', ['-a', 'Terminal', path.join(ROOT, p.folder)]);
}

// ---------- http ----------
const MIME = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript', '.mjs': 'text/javascript', '.css': 'text/css', '.json': 'application/json',
  '.png': 'image/png', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.gif': 'image/gif', '.svg': 'image/svg+xml', '.webp': 'image/webp', '.ico': 'image/x-icon',
  '.wasm': 'application/wasm', '.mp3': 'audio/mpeg', '.wav': 'audio/wav', '.ogg': 'audio/ogg', '.mp4': 'video/mp4', '.woff': 'font/woff', '.woff2': 'font/woff2',
  '.ttf': 'font/ttf', '.glb': 'model/gltf-binary', '.gltf': 'model/gltf+json', '.txt': 'text/plain; charset=utf-8', '.md': 'text/plain; charset=utf-8', '.sb3': 'application/octet-stream' };

function sendFile(res, file) {
  fs.stat(file, (err, st) => {
    if (err) return send(res, 404, 'Not found');
    if (st.isDirectory()) {
      const idx = path.join(file, 'index.html');
      if (fs.existsSync(idx)) return sendFile(res, idx);
      return send(res, 404, 'Not found');
    }
    res.writeHead(200, { 'Content-Type': MIME[path.extname(file).toLowerCase()] || 'application/octet-stream', 'Content-Length': st.size, 'Cache-Control': 'no-cache' });
    fs.createReadStream(file).pipe(res);
  });
}
function send(res, code, body, type = 'text/plain; charset=utf-8') {
  res.writeHead(code, { 'Content-Type': type });
  res.end(body);
}
const json = (res, obj, code = 200) => send(res, code, JSON.stringify(obj), 'application/json');

function readBody(req, limit = 15e6) {
  return new Promise((resolve, reject) => {
    let size = 0; const chunks = [];
    req.on('data', (c) => { size += c.length; if (size > limit) { reject(new Error('Too large')); req.destroy(); } else chunks.push(c); });
    req.on('end', () => { try { resolve(chunks.length ? JSON.parse(Buffer.concat(chunks).toString()) : {}); } catch (e) { reject(e); } });
  });
}

function readRaw(req) {
  return new Promise((resolve) => { let s = ''; req.on('data', (c) => { if (s.length < 1e5) s += c; }); req.on('end', () => resolve(s)); });
}

function inside(base, p) {
  const rel = path.relative(base, p);
  return rel && !rel.startsWith('..') && !path.isAbsolute(rel);
}

async function api(req, res, parts) {
  const method = req.method;
  // /api/projects
  if (parts[0] === 'projects' && parts.length === 1) {
    if (method === 'GET') {
      await refreshPorts();
      return json(res, { cloud: CLOUD, cloudUrl: CLOUD ? null : (data.cloud && data.cloud.url) || null, projects: merged() });
    }
    if (method === 'POST') {
      const b = await readBody(req);
      if (!b.name) return json(res, { error: 'Name required' }, 400);
      const c = { id: 'custom-' + Date.now().toString(36), name: String(b.name).slice(0, 120), url: b.url || '', kind: b.kind || 'link',
        description: b.description || '', tags: Array.isArray(b.tags) ? b.tags : [], createdAt: Date.now() };
      data.custom.push(c); saveData();
      return json(res, c);
    }
  }
  // ---- cloud copy: receive a publish from the Mac ----
  if (CLOUD && parts[0] === 'sync' && !parts[1] && method === 'POST') {
    const b = await readBody(req, 50e6);
    if (Array.isArray(b.projects)) scanned = b.projects;
    cloud.mergeInto(data, b);
    await cloud.putKV('snapshot', scanned);
    await cloud.putKV('data', data);
    return json(res, { overrides: data.overrides, custom: data.custom, previews: Object.fromEntries(cloud.previews) });
  }
  if (CLOUD && parts[0] === 'sync' && parts[1] === 'preview' && method === 'POST') {
    const b = await readBody(req, 20e6);
    if (!b.id || !b.png) return json(res, { error: 'id and png required' }, 400);
    await cloud.putPreview(safeId(String(b.id)), Buffer.from(b.png, 'base64'), Number(b.updated) || Date.now());
    return json(res, { ok: true });
  }
  // ---- Mac: push everything to the cloud copy ----
  if (!CLOUD && parts[0] === 'publish' && method === 'POST') {
    try {
      return json(res, await cloud.publish({ cloud: data.cloud, scanned, data, saveData, previewFile }));
    } catch (e) { return json(res, { error: e.message }, 400); }
  }
  const MAC_ONLY = ['rescan', 'snap-all'];
  if (CLOUD && MAC_ONLY.includes(parts[0])) return json(res, { error: 'That only works on your Mac. Publish from there.' }, 400);
  if (parts[0] === 'rescan' && method === 'POST') { scan(); await refreshPorts(); return json(res, { projects: merged() }); }
  if (parts[0] === 'status' && method === 'GET') {
    await refreshPorts();
    const all = merged();
    return json(res, { running: Object.fromEntries(all.map((p) => [p.id, p.running])), snap: snapState });
  }
  if (parts[0] === 'live' && method === 'POST') {
    const urls = [...new Set(merged().map((p) => p.liveUrl).filter((u) => u && /^https?:/.test(u)))];
    const out = {};
    await Promise.all(urls.map(async (u) => { out[u] = await checkLive(u); }));
    return json(res, out);
  }
  if (parts[0] === 'snap-all' && method === 'POST') {
    const b = await readBody(req);
    await refreshPorts();
    const list = merged().filter((p) => !p.hidden && snapTarget(p) && (b.all || !fs.existsSync(path.join(PREVIEW_DIR, safeId(p.id) + '.png'))));
    if (snapState.done >= snapState.total) { snapState.total = 0; snapState.done = 0; }
    snapState.total += list.length;
    snapQueue.push(...list); pumpSnaps();
    return json(res, { queued: list.length });
  }

  if (parts[0] !== 'projects' || !parts[1]) return json(res, { error: 'Not found' }, 404);
  const id = decodeURIComponent(parts[1]);
  const p = byId(id);
  if (!p) return json(res, { error: 'Unknown project' }, 404);
  const action = parts[2];

  if (CLOUD && ['start', 'stop', 'reveal', 'terminal', 'snap'].includes(action)) return json(res, { error: 'That only works on your Mac.' }, 400);
  if (CLOUD && action === 'logs') return json(res, { logs: [], exited: null });

  try {
    if (!action && method === 'PATCH') {
      const b = await readBody(req);
      const o = data.overrides[id] || (data.overrides[id] = {});
      for (const k of EDITABLE) if (k in b) {
        if (b[k] === null || b[k] === '') delete o[k]; else o[k] = b[k];
      }
      if (p.source === 'custom') {
        const c = data.custom.find((x) => x.id === id);
        for (const k of ['name', 'url', 'kind', 'description']) if (k in b) { c[k] = b[k]; delete o[k]; }
      }
      if (o.port) o.port = Number(o.port) || undefined;
      saveData();
      return json(res, byId(id));
    }
    if (!action && method === 'DELETE') {
      if (p.source !== 'custom') return json(res, { error: 'Folder projects are hidden, not deleted.' }, 400);
      data.custom = data.custom.filter((c) => c.id !== id);
      delete data.overrides[id];
      if (CLOUD) await cloud.delPreview(safeId(id));
      else fs.rm(path.join(PREVIEW_DIR, safeId(id) + '.png'), { force: true }, () => {});
      saveData();
      return json(res, { ok: true });
    }
    if (action === 'start' && method === 'POST') { startProject(p); return json(res, { ok: true }); }
    if (action === 'stop' && method === 'POST') { await stopProject(p); return json(res, { ok: true }); }
    if (action === 'logs') { const pr = procs.get(id); return json(res, { logs: pr ? pr.logs : [], exited: pr ? pr.exited : null }); }
    if (action === 'reveal' && method === 'POST') { revealFolder(p); return json(res, { ok: true }); }
    if (action === 'terminal' && method === 'POST') { openTerminal(p); return json(res, { ok: true }); }
    if (action === 'opened' && method === 'POST') { touch(id); return json(res, { ok: true }); }
    if (action === 'snap' && method === 'POST') { await refreshPorts(); return json(res, await snap(byId(id))); }
    if (action === 'preview' && method === 'POST') {
      const b = await readBody(req);
      const m = /^data:image\/(png|jpe?g|webp);base64,(.+)$/.exec(b.dataUrl || '');
      if (!m) return json(res, { error: 'Send a PNG, JPG or WebP image.' }, 400);
      if (CLOUD) { await cloud.putPreview(safeId(id), Buffer.from(m[2], 'base64')); return json(res, { ok: true }); }
      const file = path.join(PREVIEW_DIR, safeId(id) + '.png');
      fs.writeFileSync(file, Buffer.from(m[2], 'base64'));
      await new Promise((r) => execFile('sips', ['-s', 'format', 'png', '-Z', '1200', file], r));
      if (data.overrides[id]) { delete data.overrides[id].preview; saveData(); }
      return json(res, { ok: true });
    }
    if (action === 'preview' && method === 'DELETE') {
      if (CLOUD) { await cloud.delPreview(safeId(id)); return json(res, { ok: true }); }
      fs.rmSync(path.join(PREVIEW_DIR, safeId(id) + '.png'), { force: true });
      return json(res, { ok: true });
    }
  } catch (e) {
    return json(res, { error: e.message }, 400);
  }
  return json(res, { error: 'Not found' }, 404);
}

const server = http.createServer(async (req, res) => {
  const url = new URL(req.url, 'http://x');
  const parts = url.pathname.split('/').filter(Boolean);
  try {
    if (CLOUD && await cloud.gate(req, res, url, readRaw)) return;
    if (parts[0] === 'api') return await api(req, res, parts.slice(1));
    if (CLOUD && parts[0] === 'previews') {
      const png = await cloud.getPreview(decodeURIComponent(parts[1] || '').replace(/\.png$/, ''));
      if (!png) return send(res, 404, 'Not found');
      res.writeHead(200, { 'Content-Type': 'image/png', 'Cache-Control': 'private, max-age=31536000, immutable' });
      return res.end(png);
    }
    if (CLOUD && parts[0] === 'site') return send(res, 404, 'Not found');
    if (parts[0] === 'site') {
      const rel = decodeURIComponent(url.pathname.slice('/site/'.length));
      const file = path.resolve(ROOT, rel);
      if (!inside(ROOT, file)) return send(res, 403, 'Forbidden');
      if (url.pathname.endsWith('/') || !path.extname(file)) {
        // make relative links inside a folder resolve correctly
        if (!url.pathname.endsWith('/') && fs.existsSync(file) && fs.statSync(file).isDirectory()) {
          res.writeHead(302, { Location: url.pathname + '/' }); return res.end();
        }
      }
      return sendFile(res, file);
    }
    if (parts[0] === 'previews') {
      const file = path.join(PREVIEW_DIR, decodeURIComponent(parts[1] || ''));
      if (!inside(PREVIEW_DIR, file)) return send(res, 403, 'Forbidden');
      return sendFile(res, file);
    }
    const file = path.join(PUBLIC_DIR, url.pathname === '/' ? 'index.html' : decodeURIComponent(url.pathname));
    if (!inside(PUBLIC_DIR, file)) return send(res, 403, 'Forbidden');
    return sendFile(res, file);
  } catch (e) {
    json(res, { error: e.message }, 500);
  }
});

if (CLOUD) {
  cloud.init().then((saved) => {
    data = Object.assign({ overrides: {}, custom: [] }, saved.data || {});
    scanned = saved.snapshot || [];
    server.listen(PORT, HOST, () => console.log(`LinkUp cloud copy: ${scanned.length} projects, port ${PORT}`));
  }).catch((e) => { console.error('LinkUp could not start:', e.message); process.exit(1); });
} else {
  scan();
  refreshPorts().then(() => server.listen(PORT, HOST, () => {
    console.log(`LinkUp: ${scanned.length} projects from ${ROOT}`);
    console.log(`Open http://localhost:${PORT}`);
  }));
}

function shutdown() {
  for (const pr of procs.values()) if (!pr.exited) try { process.kill(-pr.child.pid, 'SIGTERM'); } catch {}
  process.exit(0);
}
process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);
