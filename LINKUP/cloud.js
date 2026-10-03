// Cloud side of LinkUp.
// On Cloud Foundry the hub is a mirror: your Mac publishes its scan + previews here,
// edits are stored in Postgres, and the whole site sits behind a passcode.
// On your Mac this file only provides publish(), which pushes to the cloud copy.
const crypto = require('crypto');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { execFile } = require('child_process');

const IS_CLOUD = !!process.env.VCAP_APPLICATION;
const PASSCODE = process.env.LINKUP_PASSCODE || '';

// ---------- postgres (cloud only) ----------
function pgConfig() {
  if (process.env.VCAP_SERVICES) {
    const vcap = JSON.parse(process.env.VCAP_SERVICES);
    const svc = Object.values(vcap).flat().find((s) => /postgres/i.test(s.label || '') || /postgres/i.test((s.tags || []).join(',')) || /postgres/i.test(s.name || ''));
    if (svc) {
      const c = svc.credentials || {};
      if (c.uri || c.url || c.jdbcUrl) return { connectionString: (c.uri || c.url || '').replace(/^jdbc:/, ''), ssl: false };
      return { host: c.hostname || c.host || (c.hosts && c.hosts[0]), port: c.port || 5432, database: c.db || c.name || c.dbname || c.database || 'postgres', user: c.user || c.username, password: c.password, ssl: false };
    }
  }
  if (process.env.DATABASE_URL) return { connectionString: process.env.DATABASE_URL, ssl: false };
  return null;
}

let pool = null;
const previews = new Map(); // safe id -> updated ms

async function init() {
  const cfg = pgConfig();
  if (!cfg) throw new Error('No Postgres service bound (expected linkup-db).');
  const { Pool } = require('pg');
  pool = new Pool({ ...cfg, max: 4 });
  await pool.query('create table if not exists kv (key text primary key, value jsonb not null)');
  await pool.query('create table if not exists previews (id text primary key, png bytea not null, updated bigint not null)');
  const out = { data: null, snapshot: [] };
  for (const row of (await pool.query('select key, value from kv')).rows) {
    if (row.key === 'data') out.data = row.value;
    if (row.key === 'snapshot') out.snapshot = row.value;
  }
  for (const row of (await pool.query('select id, updated from previews')).rows) previews.set(row.id, Number(row.updated));
  return out;
}

async function putKV(key, value) {
  await pool.query('insert into kv (key, value) values ($1, $2) on conflict (key) do update set value = excluded.value', [key, JSON.stringify(value)]);
}

let saveTimer = null;
function saveData(data) {
  clearTimeout(saveTimer);
  saveTimer = setTimeout(() => putKV('data', data).catch((e) => console.error('save failed', e.message)), 300);
}

async function putPreview(id, buf, updated = Date.now()) {
  await pool.query('insert into previews (id, png, updated) values ($1, $2, $3) on conflict (id) do update set png = excluded.png, updated = excluded.updated', [id, buf, updated]);
  previews.set(id, updated);
}
async function delPreview(id) {
  await pool.query('delete from previews where id = $1', [id]);
  previews.delete(id);
}
async function getPreview(id) {
  const r = await pool.query('select png from previews where id = $1', [id]);
  return r.rows[0] ? r.rows[0].png : null;
}

// ---------- passcode ----------
const token = () => crypto.createHmac('sha256', PASSCODE).update('linkup-session').digest('hex');
const same = (a, b) => {
  const x = Buffer.from(String(a)), y = Buffer.from(String(b));
  return x.length === y.length && crypto.timingSafeEqual(x, y);
};
function cookie(req, name) {
  const m = (req.headers.cookie || '').split(/;\s*/).find((c) => c.startsWith(name + '='));
  return m ? decodeURIComponent(m.slice(name.length + 1)) : null;
}
const signedIn = (req) => !!PASSCODE && same(cookie(req, 'linkup') || '', token());
const keyOk = (req) => !!PASSCODE && same(req.headers['x-linkup-key'] || '', PASSCODE);

const LOGIN_PAGE = (error) => `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">
<title>LinkUp</title>
<link href="https://fonts.googleapis.com/css2?family=Bricolage+Grotesque:opsz,wght@12..96,800&family=Inter:wght@400;600&display=swap" rel="stylesheet">
<style>
:root{--bg:#f4f1ec;--panel:#fffdf9;--line:#e2dcd2;--ink:#1d1a16;--ink3:#8f877b;--accent:#ff6b3d}
@media (prefers-color-scheme:dark){:root{--bg:#121110;--panel:#1b1a18;--line:#322f2b;--ink:#f3efe8;--ink3:#807869}}
*{box-sizing:border-box}body{margin:0;min-height:100vh;display:grid;place-items:center;background:var(--bg);color:var(--ink);font:15px Inter,system-ui,sans-serif;padding:16px}
form{background:var(--panel);border:1px solid var(--line);border-radius:18px;padding:30px;width:min(360px,100%);display:flex;flex-direction:column;gap:14px}
.logo{width:48px;height:48px;border-radius:13px;background:var(--accent);display:grid;place-items:center}
.logo svg{width:30px;height:30px;stroke:#fff;stroke-width:3.2;fill:none;stroke-linecap:round}
h1{font:800 26px "Bricolage Grotesque",sans-serif;margin:0}p{margin:0;color:var(--ink3)}
input{height:46px;border-radius:11px;border:1px solid var(--line);background:var(--bg);padding:0 14px;font:inherit;color:inherit;outline:none}
input:focus{border-color:var(--accent)}
button{height:46px;border:0;border-radius:11px;background:var(--accent);color:#fff;font:600 15px Inter,sans-serif;cursor:pointer}
.err{color:#dc2626;font-size:13px}
</style></head><body>
<form method="post" action="/login">
<div class="logo"><svg viewBox="0 0 32 32"><path d="M9 9v14h8M15 16h8"/></svg></div>
<h1>LinkUp</h1><p>Enter your passcode to see your projects.</p>
${error ? '<div class="err">That passcode is not right.</div>' : ''}
<input name="passcode" type="password" placeholder="Passcode" autofocus autocomplete="current-password">
<button>Open</button>
</form></body></html>`;

// Returns true when it handled the request (login page, redirect, 401).
async function gate(req, res, url, readForm) {
  if (url.pathname === '/login') {
    if (req.method === 'POST') {
      const form = new URLSearchParams(await readForm(req));
      if (PASSCODE && same(form.get('passcode') || '', PASSCODE)) {
        res.writeHead(302, { 'Set-Cookie': `linkup=${token()}; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=31536000`, Location: '/' });
        return res.end(), true;
      }
      res.writeHead(401, { 'Content-Type': 'text/html; charset=utf-8' });
      return res.end(LOGIN_PAGE(true)), true;
    }
    res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
    return res.end(LOGIN_PAGE(false)), true;
  }
  if (url.pathname === '/logout') {
    res.writeHead(302, { 'Set-Cookie': 'linkup=; Path=/; Max-Age=0', Location: '/login' });
    return res.end(), true;
  }
  if (url.pathname.startsWith('/api/sync')) {
    if (keyOk(req)) return false;
    res.writeHead(401, { 'Content-Type': 'application/json' });
    return res.end('{"error":"Bad key"}'), true;
  }
  if (signedIn(req)) return false;
  if (url.pathname.startsWith('/api/')) {
    res.writeHead(401, { 'Content-Type': 'application/json' });
    return res.end('{"error":"Signed out. Reload the page."}'), true;
  }
  res.writeHead(302, { Location: '/login' });
  return res.end(), true;
}

// ---------- sync: cloud receives ----------
// Local wins on any field it has set; edits made only in the cloud are kept.
function mergeInto(data, incoming) {
  for (const [id, o] of Object.entries(incoming.overrides || {})) data.overrides[id] = Object.assign({}, data.overrides[id], o);
  const byId = new Map(data.custom.map((c) => [c.id, c]));
  for (const c of incoming.custom || []) byId.set(c.id, Object.assign({}, byId.get(c.id), c));
  data.custom = [...byId.values()];
}

// ---------- sync: Mac publishes ----------
// Strip anything that only makes sense (or should only be seen) on the Mac.
function sanitize(p) {
  const { memory, screenshots, needsInstall, envAware, sharedPort, ...rest } = p;
  return Object.assign(rest, { memory: null, hasMemory: false, screenshots: [], startCmd: null, port: null, htmlFile: null });
}

function resizeTo(file) {
  const out = path.join(os.tmpdir(), 'linkup-up-' + crypto.randomBytes(4).toString('hex') + '.png');
  return new Promise((resolve) => execFile('sips', ['-s', 'format', 'png', '-Z', '720', file, '--out', out], (err) => resolve(err ? file : out)));
}

async function publish({ cloud, scanned, data, saveData, previewFile }) {
  if (!cloud || !cloud.url || !cloud.key) throw new Error('No cloud copy set up yet.');
  const base = cloud.url.replace(/\/$/, '');
  const headers = { 'Content-Type': 'application/json', 'x-linkup-key': cloud.key };
  const res = await fetch(base + '/api/sync', {
    method: 'POST', headers,
    body: JSON.stringify({ projects: scanned.map(sanitize), overrides: data.overrides, custom: data.custom }),
    signal: AbortSignal.timeout(30000),
  });
  const back = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(back.error || `Cloud said ${res.status}`);
  data.overrides = back.overrides;
  data.custom = back.custom;
  saveData();

  // upload previews the cloud doesn't have yet (or has an older copy of)
  const jobs = [];
  for (const p of scanned.concat(data.custom)) {
    const f = previewFile(p);
    if (!f) continue;
    const sid = p.id.replace(/[^\w.-]+/g, '_');
    const mtime = Math.round(fs.statSync(f).mtimeMs);
    if ((back.previews || {})[sid] >= mtime) continue;
    jobs.push({ sid, f, mtime, loose: !f.includes(`${path.sep}previews${path.sep}`) });
  }
  let sent = 0;
  const worker = async () => {
    for (let j; (j = jobs.shift());) {
      const src = j.loose ? await resizeTo(j.f) : j.f;
      const png = fs.readFileSync(src).toString('base64');
      if (src !== j.f) fs.rm(src, { force: true }, () => {});
      const r = await fetch(base + '/api/sync/preview', { method: 'POST', headers, body: JSON.stringify({ id: j.sid, png, updated: j.mtime }), signal: AbortSignal.timeout(30000) });
      if (r.ok) sent++;
    }
  };
  await Promise.all([worker(), worker(), worker(), worker()]);
  return { projects: scanned.length, previews: sent };
}

module.exports = { IS_CLOUD, init, saveData, putKV, putPreview, delPreview, getPreview, previews, gate, mergeInto, publish };
