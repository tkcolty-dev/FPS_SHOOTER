// Storage: Postgres when a service is bound (Cloud Foundry), a JSON file when running locally.
const fs = require('fs');
const path = require('path');

function pgUri() {
  if (process.env.DATABASE_URL) return process.env.DATABASE_URL;
  try {
    const v = JSON.parse(process.env.VCAP_SERVICES || '{}');
    for (const insts of Object.values(v))
      for (const i of insts) {
        const c = i.credentials || {};
        const uri = c.uri || c.jdbcUrl || c.url;
        if (uri && /^postgres/.test(uri)) return uri;
      }
  } catch {}
  return null;
}

// ---------- file store ----------
function fileStore(file) {
  const read = () => { try { return JSON.parse(fs.readFileSync(file, 'utf8')); }
                       catch { return { projects: [], comments: [] }; } };
  const write = db => fs.writeFileSync(file, JSON.stringify(db, null, 2));
  fs.mkdirSync(path.dirname(file), { recursive: true });
  if (!fs.existsSync(file)) write({ projects: [], comments: [] });

  return {
    kind: 'file',
    init: async () => {},
    projects: async () => read().projects,
    addProject: async p => { const db = read(); db.projects.push(p); write(db); return p; },
    updateProject: async (id, patch) => {
      const db = read(); const p = db.projects.find(x => x.id === id);
      if (!p) return null; Object.assign(p, patch); write(db); return p; },
    deleteProject: async id => {
      const db = read();
      db.projects = db.projects.filter(x => x.id !== id);
      db.comments = db.comments.filter(c => c.projectId !== id);
      write(db); },
    comments: async () => read().comments,
    addComment: async c => { const db = read(); db.comments.push(c); write(db); return c; },
    updateComment: async (id, patch) => {
      const db = read(); const c = db.comments.find(x => x.id === id);
      if (!c) return null; Object.assign(c, patch); write(db); return c; },
    deleteComment: async id => {
      const db = read(); db.comments = db.comments.filter(x => x.id !== id); write(db); }
  };
}

// ---------- postgres store ----------
function pgStore(uri) {
  const { Pool } = require('pg');
  // Tanzu Postgres here speaks plaintext inside the platform network; only use TLS if asked for.
  const wantSsl = /[?&]ssl(mode)?=(true|require|verify-ca|verify-full)/.test(uri);
  const pool = new Pool({ connectionString: uri,
                          ssl: wantSsl ? { rejectUnauthorized: false } : false, max: 5 });
  const q = (t, p) => pool.query(t, p);
  const rowP = r => ({ id: r.id, name: r.name, url: r.url || '', description: r.description || '',
                       createdAt: r.created_at.toISOString() });
  const rowC = r => ({ id: r.id, projectId: r.project_id, author: r.author, text: r.body,
                       kind: r.kind, status: r.status, note: r.note || '',
                       createdAt: r.created_at.toISOString() });

  return {
    kind: 'postgres',
    init: async () => {
      await q(`CREATE TABLE IF NOT EXISTS suggest_projects (
                 id text PRIMARY KEY, name text NOT NULL, url text, description text,
                 created_at timestamptz NOT NULL DEFAULT now())`);
      await q(`CREATE TABLE IF NOT EXISTS suggest_comments (
                 id text PRIMARY KEY,
                 project_id text NOT NULL REFERENCES suggest_projects(id) ON DELETE CASCADE,
                 author text, body text NOT NULL, kind text NOT NULL DEFAULT 'idea',
                 status text NOT NULL DEFAULT 'new', note text,
                 created_at timestamptz NOT NULL DEFAULT now())`);
    },
    projects: async () =>
      (await q(`SELECT * FROM suggest_projects ORDER BY created_at`)).rows.map(rowP),
    addProject: async p => {
      await q(`INSERT INTO suggest_projects (id,name,url,description,created_at)
               VALUES ($1,$2,$3,$4,$5)`, [p.id, p.name, p.url, p.description, p.createdAt]);
      return p; },
    updateProject: async (id, patch) => {
      const sets = [], vals = [];
      for (const [k, col] of [['name','name'],['url','url'],['description','description']])
        if (k in patch) { vals.push(patch[k]); sets.push(`${col}=$${vals.length}`); }
      if (!sets.length) sets.push('name=name');
      vals.push(id);
      const r = await q(`UPDATE suggest_projects SET ${sets.join(',')}
                         WHERE id=$${vals.length} RETURNING *`, vals);
      return r.rows[0] ? rowP(r.rows[0]) : null; },
    deleteProject: async id => { await q(`DELETE FROM suggest_projects WHERE id=$1`, [id]); },
    comments: async () =>
      (await q(`SELECT * FROM suggest_comments ORDER BY created_at`)).rows.map(rowC),
    addComment: async c => {
      await q(`INSERT INTO suggest_comments (id,project_id,author,body,kind,status,note,created_at)
               VALUES ($1,$2,$3,$4,$5,$6,$7,$8)`,
              [c.id, c.projectId, c.author, c.text, c.kind, c.status, c.note, c.createdAt]);
      return c; },
    updateComment: async (id, patch) => {
      const sets = [], vals = [];
      for (const [k, col] of [['status','status'],['note','note']])
        if (k in patch) { vals.push(patch[k]); sets.push(`${col}=$${vals.length}`); }
      if (!sets.length) sets.push('status=status');
      vals.push(id);
      const r = await q(`UPDATE suggest_comments SET ${sets.join(',')}
                         WHERE id=$${vals.length} RETURNING *`, vals);
      return r.rows[0] ? rowC(r.rows[0]) : null; },
    deleteComment: async id => { await q(`DELETE FROM suggest_comments WHERE id=$1`, [id]); }
  };
}

const uri = pgUri();
module.exports = uri ? pgStore(uri) : fileStore(path.join(__dirname, 'data', 'db.json'));
