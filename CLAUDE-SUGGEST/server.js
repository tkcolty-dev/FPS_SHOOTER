// CLAUDE-SUGGEST — link a project, let people comment, pull the comments into Claude with /comment
const http  = require('http');
const fs    = require('fs');
const path  = require('path');
const os    = require('os');
const store = require('./store');

const PORT   = process.env.PORT || 4990;
const PUBLIC = path.join(__dirname, 'public');

const TYPES = { '.html':'text/html; charset=utf-8', '.css':'text/css', '.js':'text/javascript',
                '.json':'application/json', '.svg':'image/svg+xml', '.png':'image/png', '.ico':'image/x-icon' };

function id() { return Date.now().toString(36) + Math.random().toString(36).slice(2, 7); }
function body(req) {
  return new Promise(res => { let b = ''; req.on('data', c => b += c);
    req.on('end', () => { try { res(JSON.parse(b || '{}')); } catch { res({}); } }); });
}
function json(res, data, code = 200) {
  res.writeHead(code, { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' });
  res.end(JSON.stringify(data));
}

async function api(req, res, url) {
  const p = url.pathname;

  // projects
  if (p === '/api/projects' && req.method === 'GET') {
    const [projects, comments] = await Promise.all([store.projects(), store.comments()]);
    return json(res, projects.map(pr => ({
      ...pr,
      commentCount: comments.filter(c => c.projectId === pr.id).length,
      newCount:     comments.filter(c => c.projectId === pr.id && c.status === 'new').length
    })));
  }
  if (p === '/api/projects' && req.method === 'POST') {
    const b = await body(req);
    if (!b.name) return json(res, { error: 'name required' }, 400);
    return json(res, await store.addProject({
      id: id(), name: String(b.name).slice(0, 120), url: b.url || '',
      description: b.description || '', createdAt: new Date().toISOString() }), 201);
  }
  if (p.startsWith('/api/projects/') && req.method === 'PATCH') {
    const patch = {}; const b = await body(req);
    for (const k of ['name', 'url', 'description']) if (k in b) patch[k] = b[k];
    const pr = await store.updateProject(p.split('/')[3], patch);
    return pr ? json(res, pr) : json(res, { error: 'not found' }, 404);
  }
  if (p.startsWith('/api/projects/') && req.method === 'DELETE') {
    await store.deleteProject(p.split('/')[3]);
    return json(res, { ok: true });
  }

  // comments
  if (p === '/api/comments' && req.method === 'GET') {
    const [projects, comments] = await Promise.all([store.projects(), store.comments()]);
    const st  = url.searchParams.get('status');
    const pid = url.searchParams.get('projectId');
    let out = comments;
    if (st)  out = out.filter(c => st.split(',').includes(c.status));
    if (pid) out = out.filter(c => c.projectId === pid);
    const names = Object.fromEntries(projects.map(x => [x.id, x.name]));
    return json(res, out.map(c => ({ ...c, projectName: names[c.projectId] || '(deleted project)' }))
                        .sort((a, b) => b.createdAt.localeCompare(a.createdAt)));
  }
  if (p === '/api/comments' && req.method === 'POST') {
    const b = await body(req);
    if (!b.text || !b.projectId) return json(res, { error: 'projectId and text required' }, 400);
    const projects = await store.projects();
    if (!projects.some(x => x.id === b.projectId)) return json(res, { error: 'no such project' }, 404);
    return json(res, await store.addComment({
      id: id(), projectId: b.projectId, author: (b.author || 'anonymous').slice(0, 40),
      text: String(b.text).slice(0, 4000),
      kind: ['idea', 'bug', 'love'].includes(b.kind) ? b.kind : 'idea',
      status: 'new', note: '', createdAt: new Date().toISOString() }), 201);
  }
  if (p.startsWith('/api/comments/') && req.method === 'PATCH') {
    const b = await body(req); const patch = {};
    if (b.status && ['new', 'accepted', 'rejected', 'done'].includes(b.status)) patch.status = b.status;
    if ('note' in b) patch.note = String(b.note).slice(0, 500);
    const c = await store.updateComment(p.split('/')[3], patch);
    return c ? json(res, c) : json(res, { error: 'not found' }, 404);
  }
  if (p.startsWith('/api/comments/') && req.method === 'DELETE') {
    await store.deleteComment(p.split('/')[3]);
    return json(res, { ok: true });
  }
  return json(res, { error: 'no such endpoint' }, 404);
}

const server = http.createServer(async (req, res) => {
  const url = new URL(req.url, `http://${req.headers.host}`);

  if (req.method === 'OPTIONS') {
    res.writeHead(204, { 'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET,POST,PATCH,DELETE',
      'Access-Control-Allow-Headers': 'Content-Type' });
    return res.end();
  }

  if (url.pathname.startsWith('/api/')) {
    try { return await api(req, res, url); }
    catch (e) { console.error(e); return json(res, { error: 'server error' }, 500); }
  }

  const file = url.pathname === '/' ? '/index.html' : url.pathname;
  const full = path.join(PUBLIC, path.normalize(file).replace(/^(\.\.[/\\])+/, ''));
  fs.readFile(full, (err, data) => {
    if (err) { res.writeHead(404); return res.end('Not found'); }
    res.writeHead(200, { 'Content-Type': TYPES[path.extname(full)] || 'text/plain' });
    res.end(data);
  });
});

store.init().then(() => {
  server.listen(PORT, '0.0.0.0', () => {
    console.log(`\n  CLAUDE-SUGGEST running  (storage: ${store.kind})`);
    console.log(`  You:    http://localhost:${PORT}`);
    Object.values(os.networkInterfaces()).flat()
      .filter(n => n && n.family === 'IPv4' && !n.internal)
      .forEach(n => console.log(`  Others: http://${n.address}:${PORT}   (same wifi)`));
    console.log(`\n  Pull comments into Claude with:  /comment\n`);
  });
}).catch(e => { console.error('storage init failed:', e); process.exit(1); });
