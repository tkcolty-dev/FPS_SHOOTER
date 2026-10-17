// Keeps notes (and their pictures) plus sounds in Postgres when one is available, so they survive restarts and
// deploys on the cloud copy. Files on disk stay the working copy: on boot the database is written back to disk,
// and after every change the game's note/sound files are copied into the database.
// Without a database (on the Mac) this does nothing and everything just lives in projects/.
const fs = require('fs'), path = require('path');
const PROJECTS = path.join(__dirname, '..', 'projects');
const KEEP = rel => rel === 'notes.json' || rel === 'sounds.json' || /^notes\/\d+\.png$/.test(rel) || /^sounds\/[\w-]+\.\w{2,4}$/.test(rel);

function pgConfig() {
  if (process.env.VCAP_SERVICES) {
    try {
      const vcap = JSON.parse(process.env.VCAP_SERVICES);
      const pgs = Object.values(vcap).flat().filter(s => /postgres/i.test(s.label || '') || /postgres/i.test((s.tags || []).join(',')));
      const svc = pgs.find(s => s.name === 'claude-maximizer-db') || pgs[0];
      if (svc) {
        const c = svc.credentials || {};
        if (c.uri || c.url) return { connectionString: (c.uri || c.url).replace(/^jdbc:/, ''), ssl: false };
        return { host: c.hostname || c.host || (c.hosts && c.hosts[0]), port: c.port || 5432, database: c.db || c.name || c.dbname || c.database || 'postgres', user: c.user || c.username, password: c.password, ssl: false };
      }
    } catch (e) { console.error('VCAP_SERVICES parse error:', e.message); }
  }
  if (process.env.DATABASE_URL) return { connectionString: process.env.DATABASE_URL, ssl: process.env.PGSSL === '1' ? { rejectUnauthorized: false } : false };
  return null;
}

let pool = null;
const enabled = () => !!pool;

async function init() {
  const cfg = pgConfig(); if (!cfg) return false;
  let Pool; try { ({ Pool } = require('pg')); } catch { console.error('Database configured but the pg package is missing; notes stay on disk only.'); return false; }
  pool = new Pool({ ...cfg, max: 4 });
  await pool.query(`CREATE TABLE IF NOT EXISTS cm_files (project TEXT NOT NULL, path TEXT NOT NULL, data BYTEA NOT NULL, updated_at TIMESTAMPTZ NOT NULL DEFAULT now(), PRIMARY KEY (project, path))`);
  return true;
}

// database → disk, once at boot
async function restore(afterProject) {
  if (!pool) return 0;
  const { rows } = await pool.query('SELECT project, path, data FROM cm_files');
  const touched = new Set();
  for (const r of rows) {
    if (!/^[a-z0-9_-]+$/.test(r.project) || !KEEP(r.path)) continue;
    const dir = path.join(PROJECTS, r.project); if (!fs.existsSync(path.join(dir, 'game.json'))) continue; // that game isn't deployed any more
    const file = path.join(dir, r.path); fs.mkdirSync(path.dirname(file), { recursive: true }); fs.writeFileSync(file, r.data); touched.add(r.project);
  }
  for (const pid of touched) if (afterProject) afterProject(pid);
  return rows.length;
}

function listKept(pid) {
  const dir = path.join(PROJECTS, pid), out = [];
  for (const rel of ['notes.json', 'sounds.json']) if (fs.existsSync(path.join(dir, rel))) out.push(rel);
  for (const sub of ['notes', 'sounds']) { const d = path.join(dir, sub); if (fs.existsSync(d)) for (const f of fs.readdirSync(d)) { const rel = sub + '/' + f; if (KEEP(rel)) out.push(rel); } }
  return out;
}
// disk → database for one game. Runs in the background; a failed save is retried on the next change.
const pending = new Map();
function save(pid) {
  if (!pool) return;
  clearTimeout(pending.get(pid));
  pending.set(pid, setTimeout(async () => {
    pending.delete(pid);
    try {
      const files = listKept(pid);
      for (const rel of files) await pool.query(`INSERT INTO cm_files (project, path, data, updated_at) VALUES ($1, $2, $3, now()) ON CONFLICT (project, path) DO UPDATE SET data = EXCLUDED.data, updated_at = now() WHERE cm_files.data <> EXCLUDED.data`, [pid, rel, fs.readFileSync(path.join(PROJECTS, pid, rel))]);
      await pool.query('DELETE FROM cm_files WHERE project = $1 AND NOT (path = ANY($2::text[]))', [pid, files]);
    } catch (e) { console.error('db save', pid, e.message); }
  }, 300));
}
module.exports = { init, restore, save, enabled };
