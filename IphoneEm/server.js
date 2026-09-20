// iPhone 17 emulator server — zero dependencies.
//   • static files
//   • /sys/*      genuine Apple sounds read from THIS Mac's system folders (never copied into the repo;
//                 on a non-Mac host the list is empty and the client falls back to synthesized sounds)
//   • /proxy      web proxy so Safari can show sites that refuse to be framed
//   • /api/ai     Claude (local Claude Code CLI) for Siri, Messages and the App Maker
const http = require('http');
const fs = require('fs');
const path = require('path');
const os = require('os');
const net = require('net');
const { spawn, execFile } = require('child_process');

const PORT = process.env.PORT || 4917;
const ROOT = __dirname;
const PUBLIC = path.join(ROOT, 'public');
const CACHE = path.join(ROOT, '.cache', 'sounds');

const MIME = {
  '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8', '.png': 'image/png', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg',
  '.svg': 'image/svg+xml', '.wav': 'audio/wav', '.m4a': 'audio/mp4', '.m4r': 'audio/mp4', '.mp3': 'audio/mpeg',
  '.ico': 'image/x-icon', '.webp': 'image/webp', '.woff2': 'font/woff2', '.md': 'text/markdown; charset=utf-8',
};

// ───────────────────────────── real system sounds ─────────────────────────────
const TONES = '/System/Library/PrivateFrameworks/ToneLibrary.framework/Versions/A/Resources';
const SYS = '/System/Library/Components/CoreAudio.component/Contents/SharedSupport/SystemSounds';
const SIRI = '/System/Library/PrivateFrameworks/AssistantServices.framework/Versions/A/Resources';

const UI_SOUNDS = {
  shutter: SYS + '/system/Shutter.aif',
  screenshot: SYS + '/system/Screen Capture.aif',
  sent: SYS + '/system/SentMessage.caf',
  received: TONES + '/AlertTones/ReceivedMessage.caf',
  charge: '/System/Library/CoreServices/PowerChime.app/Contents/Resources/connect_power.aif',
  pay: SYS + '/system/payment_success.aif',
  payfail: SYS + '/system/payment_failure.aif',
  begin_record: SYS + '/system/begin_record.caf',
  end_record: SYS + '/system/end_record.caf',
  mail_sent: '/System/Applications/Mail.app/Contents/Resources/Mail Sent.aiff',
  new_mail: '/System/Applications/Mail.app/Contents/Resources/New Mail.aiff',
  siri_begin: SYS + '/siri/jbl_begin.caf',
  siri_confirm: SYS + '/siri/jbl_confirm.caf',
  siri_cancel: SYS + '/siri/jbl_cancel.caf',
  ringback: SYS + '/telephony/ringback_tone_ansi.caf',
  busy: SYS + '/telephony/busy_tone_ansi.caf',
  endcall: SYS + '/telephony/end_call_tone_cept.caf',
  callwaiting: SYS + '/telephony/call_waiting_tone_ansi.caf',
  facetime_join: SYS + '/facetime/multiway_join.caf',
  facetime_leave: SYS + '/facetime/multiway_leave.caf',
  facetime_ring: SYS + '/facetime/multiway_invitation.caf',
  trash: SYS + '/finder/move to trash.aif',
  tapback_heart: TONES + '/AlertTones/Text-Message-Acknowledgement-Heart.caf',
  tapback_up: TONES + '/AlertTones/Text-Message-Acknowledgement-ThumbsUp.caf',
  tapback_down: TONES + '/AlertTones/Text-Message-Acknowledgement-ThumbsDown.caf',
  tapback_haha: TONES + '/AlertTones/Text-Message-Acknowledgement-HaHa.caf',
  tapback_exclaim: TONES + '/AlertTones/Text-Message-Acknowledgement-Exclamation.caf',
  tapback_question: TONES + '/AlertTones/Text-Message-Acknowledgement-QuestionMark.caf',
};
for (const k of ['0', '1', '2', '3', '4', '5', '6', '7', '8', '9', 'star', 'pound']) UI_SOUNDS['dtmf-' + k] = `${SYS}/telephony/dtmf-${k}.caf`;

const soundMap = {};   // id -> absolute path
function scanSounds() {
  for (const [id, p] of Object.entries(UI_SOUNDS)) if (fs.existsSync(p)) soundMap[id] = p;
  const addDir = (dir, prefix) => {
    let names = [];
    try { names = fs.readdirSync(dir); } catch { return; }
    for (const n of names) {
      const ext = path.extname(n).toLowerCase();
      if (!['.m4r', '.caf', '.aif', '.aiff', '.wav'].includes(ext)) continue;
      const base = path.basename(n, ext).replace(/-EncoreInfinitum$/, '');
      const id = prefix + ':' + base;
      // prefer the modern ("EncoreInfinitum") master when both exist
      if (!soundMap[id] || /EncoreInfinitum/.test(n)) soundMap[id] = path.join(dir, n);
    }
  };
  addDir(TONES + '/Ringtones', 'ringtone');
  addDir(TONES + '/AlertTones/Classic', 'tone');
  addDir(TONES + '/AlertTones/Modern', 'tone');
  addDir(TONES + '/AlertTones/EncoreInfinitum', 'tone');
  // the kid's own verified keyboard recordings
  for (const n of ['key_tap', 'key_tap_2', 'key_tap_3', 'key_delete']) {
    const p = path.join(ROOT, 'sounds', n + '.wav');
    if (fs.existsSync(p)) soundMap[n] = p;
  }
}
scanSounds();

const converting = {};
function playablePath(id) {
  // Browsers can't decode CAF/AIFF — convert once with afconvert (ships with macOS) into .cache/
  const src = soundMap[id];
  if (!src) return Promise.resolve(null);
  const ext = path.extname(src).toLowerCase();
  if (ext === '.m4r' || ext === '.wav' || ext === '.m4a') return Promise.resolve(src);
  const out = path.join(CACHE, id.replace(/[^a-z0-9_-]+/gi, '_') + '.wav');
  if (fs.existsSync(out)) return Promise.resolve(out);
  if (converting[id]) return converting[id];
  fs.mkdirSync(CACHE, { recursive: true });
  converting[id] = new Promise((resolve) => {
    execFile('/usr/bin/afconvert', ['-f', 'WAVE', '-d', 'LEI16', src, out], (err) => {
      delete converting[id];
      resolve(err ? null : out);
    });
  });
  return converting[id];
}

// ───────────────────────────── helpers ─────────────────────────────
function sendJSON(res, code, obj) {
  const body = JSON.stringify(obj);
  res.writeHead(code, { 'Content-Type': MIME['.json'], 'Cache-Control': 'no-store' });
  res.end(body);
}
function sendFile(req, res, file, extraHeaders = {}) {
  fs.stat(file, (err, st) => {
    if (err || !st.isFile()) { res.writeHead(404); return res.end('Not found'); }
    const type = MIME[path.extname(file).toLowerCase()] || 'application/octet-stream';
    const headers = { 'Content-Type': type, 'Accept-Ranges': 'bytes', ...extraHeaders };
    const range = req.headers.range && /bytes=(\d*)-(\d*)/.exec(req.headers.range);
    if (range) {
      const start = range[1] ? parseInt(range[1], 10) : 0;
      const end = range[2] ? Math.min(parseInt(range[2], 10), st.size - 1) : st.size - 1;
      if (start > end || start >= st.size) { res.writeHead(416, { 'Content-Range': `bytes */${st.size}` }); return res.end(); }
      res.writeHead(206, { ...headers, 'Content-Range': `bytes ${start}-${end}/${st.size}`, 'Content-Length': end - start + 1 });
      return fs.createReadStream(file, { start, end }).pipe(res);
    }
    res.writeHead(200, { ...headers, 'Content-Length': st.size });
    fs.createReadStream(file).pipe(res);
  });
}
function readBody(req, limit = 2e6) {
  return new Promise((resolve, reject) => {
    let size = 0; const chunks = [];
    req.on('data', (c) => { size += c.length; if (size > limit) { reject(new Error('too large')); req.destroy(); } else chunks.push(c); });
    req.on('end', () => resolve(Buffer.concat(chunks).toString('utf8')));
    req.on('error', reject);
  });
}

// ───────────────────────────── web proxy (Safari) ─────────────────────────────
function isPrivateHost(host) {
  const h = host.toLowerCase().replace(/^\[|\]$/g, '');
  if (h === 'localhost' || h.endsWith('.localhost') || h.endsWith('.local') || h.endsWith('.internal')) return true;
  if (net.isIP(h) === 4) {
    const p = h.split('.').map(Number);
    return p[0] === 10 || p[0] === 127 || p[0] === 0 || (p[0] === 169 && p[1] === 254) || (p[0] === 172 && p[1] >= 16 && p[1] <= 31) || (p[0] === 192 && p[1] === 168);
  }
  if (net.isIP(h) === 6) return h === '::1' || h.startsWith('fc') || h.startsWith('fd') || h.startsWith('fe80') || h.startsWith('::ffff:');
  return false;
}
// When deployed (Cloud Foundry) this server is on the public internet: the proxy must never become a way into the
// network it runs in. Resolve every hostname and refuse private / loopback / link-local addresses, on every redirect hop.
const DEPLOYED = !!process.env.VCAP_APPLICATION;
const dns = require('dns').promises;
async function isPrivateTarget(hostname) {
  if (isPrivateHost(hostname)) return true;
  if (net.isIP(hostname.replace(/^\[|\]$/g, ''))) return false;
  try { const addrs = await dns.lookup(hostname, { all: true }); return !addrs.length || addrs.some((a) => isPrivateHost(a.address)); }
  catch { return true; }
}
async function safeFetch(startUrl, init, allowPrivate) {
  let url = startUrl;
  for (let hop = 0; hop < 6; hop++) {
    const u = parseTarget(url); if (!u) throw new Error('bad url');
    if (!allowPrivate && await isPrivateTarget(u.hostname)) { const e = new Error('blocked'); e.blocked = true; throw e; }
    const r = await fetch(u.href, { ...init, redirect: 'manual' });
    if (r.status >= 300 && r.status < 400 && r.headers.get('location')) { try { await r.body?.cancel(); } catch {} url = new URL(r.headers.get('location'), u.href).href; continue; }
    return { res: r, finalUrl: u.href };
  }
  throw new Error('too many redirects');
}
// tiny per-IP rate limiter
const buckets = new Map();
function limited(req, key, perMinute) {
  const ip = (req.headers['x-forwarded-for'] || req.socket.remoteAddress || '').split(',')[0].trim();
  const k = key + ':' + ip, now = Date.now(); let b = buckets.get(k);
  if (!b || now - b.t > 60000) { b = { t: now, n: 0 }; buckets.set(k, b); }
  if (buckets.size > 5000) buckets.clear();
  return ++b.n > perMinute;
}

function parseTarget(raw) {
  let u;
  try { u = new URL(raw); } catch { return null; }
  if (u.protocol !== 'http:' && u.protocol !== 'https:') return null;
  return u;
}
const UA = 'Mozilla/5.0 (iPhone; CPU iPhone OS 26_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/26.0 Mobile/15E148 Safari/604.1';

// Script injected into proxied pages: keeps navigation inside the emulator's Safari.
const PROXY_INJECT = `<script>(function(){
  var P=function(m){try{parent.postMessage(Object.assign({__safari:true},m),'*')}catch(e){}};
  var abs=function(h){try{return new URL(h,document.baseURI).href}catch(e){return null}};
  document.addEventListener('click',function(e){
    if(e.defaultPrevented)return;
    var a=e.target&&e.target.closest?e.target.closest('a[href]'):null; if(!a)return;
    var raw=a.getAttribute('href')||''; if(raw.charAt(0)==='#'||/^javascript:/i.test(raw))return;
    var u=abs(raw); if(!u||!/^https?:/i.test(u))return;
    e.preventDefault(); P({type:'nav',url:u});
  },false);
  document.addEventListener('submit',function(e){
    var f=e.target; if(!f||(f.method||'get').toLowerCase()!=='get')return;
    var u=abs(f.getAttribute('action')||document.baseURI); if(!u)return;
    e.preventDefault();
    var url=new URL(u); url.search=new URLSearchParams(new FormData(f)).toString(); P({type:'nav',url:url.href});
  },false);
  var report=function(){
    var ic=document.querySelector('link[rel~="icon"]');
    var th=document.querySelector('meta[name="theme-color"]');
    P({type:'loaded',title:document.title,url:document.baseURI,icon:ic?abs(ic.getAttribute('href')):null,theme:th?th.getAttribute('content'):null});
  };
  if(document.readyState!=='loading')report(); else document.addEventListener('DOMContentLoaded',report);
  window.addEventListener('load',report);
})();</scr` + `ipt>`;

async function handleProxy(req, res, query) {
  const target = parseTarget(query.get('url') || '');
  if (!target) { res.writeHead(400); return res.end('Bad url'); }
  if (limited(req, 'proxy', 90)) { res.writeHead(429); return res.end('Slow down'); }
  try {
    const ctl = new AbortController();
    const timer = setTimeout(() => ctl.abort(), 20000);
    const { res: r, finalUrl: fu } = await safeFetch(target.href, {
      signal: ctl.signal,
      headers: { 'User-Agent': UA, 'Accept': 'text/html,application/xhtml+xml,*/*;q=0.8', 'Accept-Language': 'en-US,en;q=0.9' },
    }, false);
    clearTimeout(timer);
    const finalUrl = parseTarget(fu) || target;
    const len = +(r.headers.get('content-length') || 0);
    if (len > 12e6) { try { await r.body?.cancel(); } catch {} res.writeHead(413); return res.end('Too large'); }
    const type = r.headers.get('content-type') || 'application/octet-stream';
    if (/text\/html|application\/xhtml/i.test(type)) {
      let html = await r.text();
      const base = `<base href="${finalUrl.href.replace(/"/g, '&quot;')}">`;
      // drop the page's own <base> and any meta CSP, then put ours first
      html = html.replace(/<base\b[^>]*>/gi, '').replace(/<meta[^>]+http-equiv=["']?content-security-policy["']?[^>]*>/gi, '');
      if (/<head[^>]*>/i.test(html)) html = html.replace(/<head[^>]*>/i, (m) => m + base + PROXY_INJECT);
      else html = base + PROXY_INJECT + html;
      res.writeHead(r.status === 200 ? 200 : r.status, { 'Content-Type': 'text/html; charset=utf-8', 'Cache-Control': 'no-store', 'X-Final-Url': encodeURI(finalUrl.href) });
      return res.end(html);
    }
    const buf = Buffer.from(await r.arrayBuffer());
    res.writeHead(r.status, { 'Content-Type': type, 'Access-Control-Allow-Origin': '*' });
    res.end(buf);
  } catch (e) {
    res.writeHead(502, { 'Content-Type': 'text/html; charset=utf-8' });
    res.end(`<!doctype html><meta name=viewport content="width=device-width"><body style="font:17px -apple-system,sans-serif;color:#8e8e93;text-align:center;padding:120px 40px"><h2 style="color:#1c1c1e;font-size:22px">Safari Can’t Open the Page</h2><p>Safari can’t open the page because the server can’t be found.</p></body>`);
  }
}

// Does the site allow being shown in a frame? (then Safari loads it directly — full fidelity)
async function handleFrameable(req, res, query) {
  const target = parseTarget(query.get('url') || '');
  if (!target) return sendJSON(res, 400, { error: 'bad url' });
  try {
    const ctl = new AbortController();
    const timer = setTimeout(() => ctl.abort(), 8000);
    if (limited(req, 'frame', 90)) return sendJSON(res, 429, { frameable: false });
    const { res: r, finalUrl } = await safeFetch(target.href, { signal: ctl.signal, headers: { 'User-Agent': UA, 'Accept': 'text/html,*/*' } }, false);
    clearTimeout(timer);
    try { await r.body?.cancel(); } catch {}
    const xfo = (r.headers.get('x-frame-options') || '').toLowerCase();
    const csp = (r.headers.get('content-security-policy') || '').toLowerCase();
    const blocked = !!xfo || /frame-ancestors/.test(csp);
    sendJSON(res, 200, { frameable: !blocked, finalUrl, status: r.status });
  } catch (e) {
    sendJSON(res, 200, { frameable: false, error: String(e.message || e) });
  }
}

// ───────────────────────────── Claude bridge ─────────────────────────────
const CLAUDE_BIN = [path.join(os.homedir(), '.local/bin/claude'), '/opt/homebrew/bin/claude', '/usr/local/bin/claude'].find((p) => fs.existsSync(p)) || 'claude';

function genai() {
  try {
    for (const list of Object.values(JSON.parse(process.env.VCAP_SERVICES || '{}'))) for (const s of list || []) {
      const c = s.credentials || {}; const ep = c.endpoint && c.endpoint.api_base ? c.endpoint : c;
      if (ep.api_base && ep.api_key) return { apiBase: ep.api_base, apiKey: ep.api_key };
    }
  } catch {}
  return null;
}
let MODEL = process.env.MODEL || null;
async function pickModel(svc) {
  if (MODEL) return MODEL;
  try { const j = await (await fetch(`${svc.apiBase}/openai/v1/models`, { headers: { Authorization: `Bearer ${svc.apiKey}` } })).json(); const n = (j.data || []).map((m) => m.id); MODEL = n.find((x) => /claude/i.test(x)) || n.find((x) => /gpt-oss-120b/.test(x)) || n[0]; } catch {}
  return (MODEL = MODEL || 'openai/gpt-oss-120b');
}

async function handleAI(req, res) {
  let body;
  try { body = JSON.parse(await readBody(req)); } catch { return sendJSON(res, 400, { error: 'bad json' }); }
  const prompt = String(body.prompt || '').slice(0, 60000);
  const system = String(body.system || '').slice(0, 20000);
  if (!prompt) return sendJSON(res, 400, { error: 'empty prompt' });
  const model = body.fast ? 'haiku' : 'sonnet';

  res.writeHead(200, { 'Content-Type': 'text/event-stream', 'Cache-Control': 'no-store', 'Connection': 'keep-alive' });
  const send = (o) => { try { res.write('data: ' + JSON.stringify(o) + '\n\n'); } catch {} };

  if (DEPLOYED && limited(req, 'ai', 12)) { send({ error: 'Too many requests — wait a minute.' }); send({ done: true }); return res.end(); }
  const svc = genai();
  if (svc) {   // Cloud Foundry: OpenAI-compatible GenAI service bound to the app
    try {
      const model = await pickModel(svc);
      const up = await fetch(`${svc.apiBase}/openai/v1/chat/completions`, { method: 'POST', headers: { Authorization: `Bearer ${svc.apiKey}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ model, stream: true, max_tokens: body.fast ? 1200 : 8000, messages: [...(system ? [{ role: 'system', content: system }] : []), { role: 'user', content: prompt }] }) });
      if (!up.ok) throw new Error('AI ' + up.status);
      const reader = up.body.getReader(), dec = new TextDecoder(); let buf = '';
      for (;;) {
        const { done, value } = await reader.read(); if (done) break;
        buf += dec.decode(value, { stream: true }); const lines = buf.split('\n'); buf = lines.pop();
        for (const l of lines) { if (!l.startsWith('data:')) continue; const p = l.slice(5).trim(); if (p === '[DONE]') continue; try { const d = JSON.parse(p).choices?.[0]?.delta?.content; if (d) send({ t: d }); } catch {} }
      }
    } catch (e) { send({ error: 'AI is unavailable right now.' }); }
    send({ done: true }); return res.end();
  }
  if (DEPLOYED) { send({ error: 'AI is not configured.' }); send({ done: true }); return res.end(); }

  const full = (system ? system + '\n\n' : '') +
    'Answer directly in this single reply from your own knowledge. Do not use any tools.\n\n' + prompt;
  let child;
  try {
    child = spawn(CLAUDE_BIN, [
      '-p', '--output-format', 'stream-json', '--include-partial-messages', '--verbose',
      '--max-turns', '1', '--model', model,
      '--strict-mcp-config', '--mcp-config', '{"mcpServers":{}}',
    ], { cwd: os.tmpdir(), env: process.env });
  } catch (e) { send({ error: 'Claude is not available on this computer.' }); send({ done: true }); return res.end(); }

  let sentText = false, buf = '';
  const killer = setTimeout(() => child.kill(), 300000);
  res.on('close', () => child.kill());
  child.stdout.on('data', (chunk) => {
    buf += chunk.toString();
    const lines = buf.split('\n'); buf = lines.pop();
    for (const line of lines) {
      if (!line.trim()) continue;
      let obj; try { obj = JSON.parse(line); } catch { continue; }
      if (obj.type === 'stream_event' && obj.event?.type === 'content_block_delta' && obj.event.delta?.type === 'text_delta') {
        sentText = true; send({ t: obj.event.delta.text });
      } else if (obj.type === 'result' && !sentText && typeof obj.result === 'string') {
        sentText = true; send({ t: obj.result });
      }
    }
  });
  child.on('close', (code) => {
    clearTimeout(killer);
    if (!sentText) send({ error: 'Claude did not answer (exit ' + code + ').' });
    send({ done: true }); res.end();
  });
  child.on('error', () => {
    clearTimeout(killer);
    send({ error: 'Claude is not available on this computer.' }); send({ done: true }); res.end();
  });
  child.stdin.write(full);
  child.stdin.end();
}

// ───────────────────────────── catalog + app script discovery ─────────────────────────────
function storeCatalog() {
  const dir = path.join(PUBLIC, 'store');
  const out = [];
  let names = [];
  try { names = fs.readdirSync(dir); } catch {}
  for (const n of names) {
    try {
      const m = JSON.parse(fs.readFileSync(path.join(dir, n, 'manifest.json'), 'utf8'));
      if (!fs.existsSync(path.join(dir, n, 'index.html'))) continue;
      m.id = n; m.url = `/store/${n}/index.html`;
      out.push(m);
    } catch {}
  }
  return out;
}
function appScripts() {
  try { return fs.readdirSync(path.join(PUBLIC, 'js', 'apps')).filter((f) => f.endsWith('.js')).sort().map((f) => '/js/apps/' + f); }
  catch { return []; }
}

// ───────────────────────────── passcode gate ─────────────────────────────
const ACCESS_CODE = String(process.env.ACCESS_CODE || '').trim();
const GATE_TOKEN = ACCESS_CODE ? require('crypto').createHash('sha256').update('ip17-gate:' + ACCESS_CODE).digest('hex').slice(0, 40) : '';
function safeEqual(a, b) { const x = Buffer.from(a), y = Buffer.from(b); return x.length === y.length && require('crypto').timingSafeEqual(x, y); }
function gatePage(wrong) {
  return `<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="robots" content="noindex"><title>Locked</title>
<style>html,body{margin:0;height:100%;background:#0b0b0d;color:#fff;font-family:system-ui,-apple-system,sans-serif}body{display:flex;align-items:center;justify-content:center}
form{display:flex;flex-direction:column;align-items:center;gap:16px;padding:0 16px}svg{width:34px;height:44px;fill:#fff}h1{margin:0;font-size:20px;font-weight:600}
input{width:220px;height:48px;border-radius:14px;border:0;background:rgba(120,120,128,.3);color:#fff;font-size:24px;text-align:center;letter-spacing:8px;outline:none}
button{height:44px;padding:0 28px;border-radius:22px;border:0;background:#0a84ff;color:#fff;font-size:16px;font-weight:600;cursor:pointer}p{margin:0;color:#ff453a;font-size:14px;min-height:18px}</style></head>
<body><form method="post" action="/unlock"><svg viewBox="0 0 26 34"><path d="M7.5 15V9.5a5.5 5.5 0 0 1 11 0V15" fill="none" stroke="#fff" stroke-width="3" stroke-linecap="round"/><rect x="3" y="14" width="20" height="17" rx="4.5"/></svg>
<h1>Enter Passcode</h1><input name="code" type="password" inputmode="numeric" autocomplete="off" autofocus><p>${wrong ? 'Wrong passcode' : ''}</p><button>Unlock</button></form></body></html>`;
}

// ───────────────────────────── router ─────────────────────────────
const server = http.createServer(async (req, res) => {
  let url;
  try { url = new URL(req.url, 'http://localhost'); } catch { res.writeHead(400); return res.end(); }
  const p = decodeURIComponent(url.pathname);

  // ── passcode gate (only when ACCESS_CODE is set, i.e. on Cloud Foundry) ──
  if (ACCESS_CODE) {
    const cookies = Object.fromEntries((req.headers.cookie || '').split(';').map((c) => c.trim().split('=')).filter((kv) => kv[0]));
    if (cookies.ip17 !== GATE_TOKEN) {
      if (p === '/unlock' && req.method === 'POST') {
        if (limited(req, 'unlock', 10)) { res.writeHead(429); return res.end('Too many tries — wait a minute.'); }
        const code = (new URLSearchParams(await readBody(req, 2000).catch(() => ''))).get('code') || '';
        if (safeEqual(code.trim(), ACCESS_CODE)) { res.writeHead(303, { 'Set-Cookie': `ip17=${GATE_TOKEN}; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=31536000`, Location: '/' }); return res.end(); }
        res.writeHead(303, { Location: '/?wrong=1' }); return res.end();
      }
      res.writeHead(401, { 'Content-Type': 'text/html; charset=utf-8', 'Cache-Control': 'no-store' });
      return res.end(gatePage(url.searchParams.has('wrong')));
    }
  }

  try {
    if (p === '/proxy') return handleProxy(req, res, url.searchParams);
    if (p === '/api/frameable') return handleFrameable(req, res, url.searchParams);
    if (p === '/api/ai' && req.method === 'POST') return handleAI(req, res);
    if (p === '/api/store-catalog') return sendJSON(res, 200, storeCatalog());
    if (p === '/api/app-scripts') return sendJSON(res, 200, appScripts());
    if (p === '/sys/list') return sendJSON(res, 200, Object.keys(soundMap).sort());
    if (p.startsWith('/sys/sound/')) {
      const file = await playablePath(p.slice('/sys/sound/'.length));
      if (!file) { res.writeHead(404); return res.end('no such sound'); }
      return sendFile(req, res, file, { 'Cache-Control': 'public, max-age=86400' });
    }
    // static
    const rel = p === '/' ? '/index.html' : p;
    const file = path.normalize(path.join(PUBLIC, rel));
    if (!file.startsWith(PUBLIC)) { res.writeHead(403); return res.end(); }
    return sendFile(req, res, file, { 'Cache-Control': 'no-cache' });
  } catch (e) {
    try { res.writeHead(500); res.end('Server error'); } catch {}
  }
});

server.listen(PORT, () => {
  const n = Object.keys(soundMap).length;
  console.log(`\n  iPhone 17 emulator  →  http://localhost:${PORT}\n`);
  console.log(`  ${n} real system sounds found on this machine${n < 10 ? ' (not a Mac? the rest are synthesized)' : ''}`);
  console.log(`  Claude CLI: ${CLAUDE_BIN}\n`);
});
