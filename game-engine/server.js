// Spark Engine — zero-dependency server: static files + an AI pixel-art endpoint
const http = require('http');
const fs = require('fs');
const path = require('path');
const { spawn } = require('child_process');

const PORT = process.env.PORT || 4860;
const ROOT = path.join(__dirname, 'public');
const TYPES = {
  '.html': 'text/html; charset=utf-8', '.js': 'application/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8', '.json': 'application/json', '.svg': 'image/svg+xml',
  '.png': 'image/png', '.jpg': 'image/jpeg', '.gif': 'image/gif', '.cur': 'image/x-icon',
  '.mp3': 'audio/mpeg', '.wav': 'audio/wav', '.ogg': 'audio/ogg', '.woff2': 'font/woff2'
};

/* ---------- AI backend: Tanzu GenAI (OpenAI-compatible, from VCAP) → Anthropic key → local claude CLI ---------- */
function openaiCreds() {
  if (process.env.OPENAI_API_BASE && process.env.OPENAI_API_KEY) return { base: process.env.OPENAI_API_BASE, key: process.env.OPENAI_API_KEY };
  try {
    const vcap = JSON.parse(process.env.VCAP_SERVICES || '{}');
    for (const list of Object.values(vcap)) for (const svc of list) {
      const c = svc.credentials || {}; const ep = c.endpoint || c;
      if (ep.api_base && ep.api_key) return { base: ep.api_base.replace(/\/$/, ''), key: ep.api_key };
    }
  } catch (e) {}
  return null;
}
const creds = openaiCreds();
let model = null;
async function pickModel() {
  if (!creds) return null;
  if (model) return model;
  try {
    const r = await fetch(creds.base + '/openai/v1/models', { headers: { Authorization: 'Bearer ' + creds.key } });
    const ids = ((await r.json()).data || []).map(m => m.id);
    const prefer = ['claude', 'gpt-oss-120b', 'deepseek', 'gpt-oss', 'qwen', 'gemma', 'llama'];
    model = prefer.map(p => ids.find(i => i.toLowerCase().includes(p))).find(Boolean) || ids[0] || null;
    console.log('AI model:', model, '(of', ids.length + ')');
  } catch (e) { console.warn('AI model list failed', e.message); }
  return model;
}
const hasAnthropic = !!process.env.ANTHROPIC_API_KEY;
const claudeCli = [path.join(process.env.HOME || '', '.local/bin/claude'), '/usr/local/bin/claude', '/opt/homebrew/bin/claude'].find(p => { try { return fs.statSync(p).isFile(); } catch (e) { return false; } });
const aiAvailable = () => !!(creds || hasAnthropic || claudeCli);

async function askAI(system, user) {
  if (creds) {
    const m = await pickModel();
    const r = await fetch(creds.base + '/openai/v1/chat/completions', {
      method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + creds.key },
      body: JSON.stringify({ model: m, messages: [{ role: 'system', content: system }, { role: 'user', content: user }], temperature: 0.8, max_tokens: 6000 })
    });
    const j = await r.json();
    if (!r.ok) throw new Error(j.error && j.error.message || ('AI error ' + r.status));
    return j.choices[0].message.content;
  }
  if (hasAnthropic) {
    const r = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST', headers: { 'Content-Type': 'application/json', 'x-api-key': process.env.ANTHROPIC_API_KEY, 'anthropic-version': '2023-06-01' },
      body: JSON.stringify({ model: 'claude-sonnet-5-5', max_tokens: 6000, system, messages: [{ role: 'user', content: user }] })
    });
    const j = await r.json();
    if (!r.ok) throw new Error(j.error && j.error.message || ('AI error ' + r.status));
    return j.content.map(c => c.text || '').join('');
  }
  if (claudeCli) {
    return new Promise((resolve, reject) => {
      const p = spawn(claudeCli, ['-p', '--output-format', 'text', '--model', 'sonnet', '--tools', '', '--system-prompt', system, user], { env: { ...process.env, CLAUDECODE: '' } });
      let out = '', err = ''; p.stdout.on('data', d => out += d); p.stderr.on('data', d => err += d);
      const t = setTimeout(() => { p.kill(); reject(new Error('AI timed out')); }, 120000);
      p.on('close', code => { clearTimeout(t); code === 0 ? resolve(out) : reject(new Error(err || 'claude exited ' + code)); });
    });
  }
  throw new Error('No AI backend is set up');
}

const PIXEL_SYSTEM = `You are a pixel artist for a kids' game engine. You draw tiny pixel-art images as a character grid.
Reply with ONLY a JSON object, no prose, no markdown fences:
{"palette":{"a":"#rrggbb","b":"#rrggbb"},"rows":["....aa....","...abba..."]}
Rules: "." means transparent. Each palette key is ONE character (letters/digits). Every row must be exactly WIDTH characters and there must be exactly HEIGHT rows.
Make it readable at small size: strong silhouette, a dark outline colour, 2-3 shades per material, facing right if it is a character. Fill the grid well (use most of the space). For backdrops "." should not appear - paint the whole image.`;

function parsePixelJSON(text, w, h) {
  const m = text.match(/\{[\s\S]*\}/); if (!m) throw new Error('AI did not return pixel data');
  const j = JSON.parse(m[0]);
  const palette = j.palette || {}; let rows = Array.isArray(j.rows) ? j.rows.map(r => String(r)) : [];
  rows = rows.slice(0, h); while (rows.length < h) rows.push('.'.repeat(w));
  rows = rows.map(r => (r + '.'.repeat(w)).slice(0, w));
  for (const k of Object.keys(palette)) if (!/^#[0-9a-f]{6}$/i.test(String(palette[k]))) delete palette[k];
  return { palette, rows, w, h };
}

async function handleAI(req, res) {
  let body = ''; req.on('data', d => { body += d; if (body.length > 1e6) req.destroy(); });
  req.on('end', async () => {
    try {
      const { prompt, w, h, kind } = JSON.parse(body || '{}');
      const W = Math.max(8, Math.min(64, parseInt(w) || 16)), H = Math.max(8, Math.min(48, parseInt(h) || W));
      const user = `Draw: ${String(prompt || 'a cute character').slice(0, 300)}\nKind: ${kind === 'backdrop' ? 'backdrop / scenery (fill every pixel)' : 'sprite (transparent background)'}\nWIDTH=${W} HEIGHT=${H}`;
      let result, lastErr;
      for (let attempt = 0; attempt < 2 && !result; attempt++) {
        try { result = parsePixelJSON(await askAI(PIXEL_SYSTEM.replace('WIDTH', String(W)).replace('HEIGHT', String(H)), user), W, H); } catch (e) { lastErr = e; }
      }
      if (!result) throw lastErr;
      res.writeHead(200, { 'Content-Type': 'application/json' }); res.end(JSON.stringify(result));
    } catch (e) {
      res.writeHead(500, { 'Content-Type': 'application/json' }); res.end(JSON.stringify({ error: e.message }));
    }
  });
}

/* ---------- cloud variables: shared per project id, pushed to every open player over SSE ---------- */
const DATA = path.join(__dirname, 'data'); const CLOUD_FILE = path.join(DATA, 'cloud.json');
let cloud = {}; try { cloud = JSON.parse(fs.readFileSync(CLOUD_FILE, 'utf8')); } catch (e) {}
let cloudSaveTimer = null;
const saveCloud = () => { if (cloudSaveTimer) return; cloudSaveTimer = setTimeout(() => { cloudSaveTimer = null; try { fs.mkdirSync(DATA, { recursive: true }); fs.writeFileSync(CLOUD_FILE, JSON.stringify(cloud)); } catch (e) {} }, 500); };
const streams = {}; // projectId -> Set(res)
const cors = { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Headers': 'Content-Type', 'Access-Control-Allow-Methods': 'GET, POST, OPTIONS' };
function handleCloud(req, res, parts) {
  const id = parts[0].replace(/[^\w-]/g, '').slice(0, 64), action = parts[1];
  if (!id) { res.writeHead(400, cors); return res.end(); }
  if (req.method === 'OPTIONS') { res.writeHead(204, cors); return res.end(); }
  if (action === 'stream') {
    res.writeHead(200, { ...cors, 'Content-Type': 'text/event-stream', 'Cache-Control': 'no-cache', Connection: 'keep-alive' });
    res.write('retry: 3000\n\n');
    (streams[id] = streams[id] || new Set()).add(res);
    const ping = setInterval(() => res.write(': ping\n\n'), 25000);
    req.on('close', () => { clearInterval(ping); streams[id].delete(res); });
    return;
  }
  if (action === 'players') { res.writeHead(200, { ...cors, 'Content-Type': 'application/json' }); return res.end(JSON.stringify({ players: (streams[id] || new Set()).size })); }
  if (action === 'broadcast' && req.method === 'POST') {
    let body = ''; req.on('data', d => { body += d; if (body.length > 1e4) req.destroy(); });
    req.on('end', () => { try { const { name, from } = JSON.parse(body || '{}'); for (const s of streams[id] || []) s.write(`data: ${JSON.stringify({ broadcast: String(name).slice(0, 100), from: String(from || '').slice(0, 40) })}\n\n`); res.writeHead(200, cors); res.end('{"ok":true}'); } catch (e) { res.writeHead(400, cors); res.end(); } });
    return;
  }
  if (action === 'leaderboard') {
    const store = cloud[id] = cloud[id] || {}; const board = store.__board = store.__board || [];
    if (req.method === 'POST') {
      let body = ''; req.on('data', d => { body += d; if (body.length > 1e4) req.destroy(); });
      req.on('end', () => {
        try {
          const { name, score } = JSON.parse(body || '{}'); const n = String(name || 'player').slice(0, 20), sc = Number(score) || 0;
          const ex = board.find(e => e.name === n); if (ex) ex.score = Math.max(ex.score, sc); else board.push({ name: n, score: sc });
          board.sort((a, b) => b.score - a.score); board.splice(20); saveCloud();
          for (const s of streams[id] || []) s.write(`data: ${JSON.stringify({ leaderboard: board.slice(0, 10) })}\n\n`);
          res.writeHead(200, { ...cors, 'Content-Type': 'application/json' }); res.end(JSON.stringify(board.slice(0, 10)));
        } catch (e) { res.writeHead(400, cors); res.end(); }
      });
      return;
    }
    res.writeHead(200, { ...cors, 'Content-Type': 'application/json' }); return res.end(JSON.stringify(board.slice(0, 10)));
  }
  if (action === 'set' && req.method === 'POST') {
    let body = ''; req.on('data', d => { body += d; if (body.length > 1e5) req.destroy(); });
    req.on('end', () => {
      try {
        const { vars } = JSON.parse(body || '{}'); const store = cloud[id] = cloud[id] || {};
        const keys = Object.keys(vars || {}).slice(0, 50);
        for (const k of keys) { let v = vars[k]; if (typeof v === 'string') v = v.slice(0, 1000); else if (typeof v !== 'number' && typeof v !== 'boolean') continue; store[k] = v; for (const s of streams[id] || []) s.write(`data: ${JSON.stringify({ name: k, value: v })}\n\n`); }
        if (Object.keys(store).length > 200) for (const k of Object.keys(store).slice(200)) delete store[k];
        saveCloud(); res.writeHead(200, { ...cors, 'Content-Type': 'application/json' }); res.end('{"ok":true}');
      } catch (e) { res.writeHead(400, cors); res.end(); }
    });
    return;
  }
  const vars = { ...(cloud[id] || {}) }; delete vars.__board;
  res.writeHead(200, { ...cors, 'Content-Type': 'application/json' }); res.end(JSON.stringify(vars));
}

http.createServer((req, res) => {
  let url = decodeURIComponent(req.url.split('?')[0]);
  if (url.startsWith('/api/cloud/')) return handleCloud(req, res, url.slice('/api/cloud/'.length).split('/'));
  if (url === '/api/ai/status') { res.writeHead(200, { 'Content-Type': 'application/json' }); return res.end(JSON.stringify({ available: aiAvailable(), backend: creds ? 'genai' : hasAnthropic ? 'anthropic' : claudeCli ? 'claude-cli' : null })); }
  if (url === '/api/ai' && req.method === 'POST') return handleAI(req, res);
  if (url === '/') url = '/index.html';
  const file = path.normalize(path.join(ROOT, url));
  if (!file.startsWith(ROOT)) { res.writeHead(403); return res.end(); }
  fs.readFile(file, (err, data) => {
    if (err) { res.writeHead(404); return res.end('Not found'); }
    res.writeHead(200, { 'Content-Type': TYPES[path.extname(file)] || 'application/octet-stream', 'Cache-Control': 'no-cache' });
    res.end(data);
  });
}).listen(PORT, () => { console.log(`Spark Engine → http://localhost:${PORT}  (AI: ${creds ? 'genai' : hasAnthropic ? 'anthropic' : claudeCli ? 'claude cli' : 'none'})`); pickModel(); });
