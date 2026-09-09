/* ============================================================
   BlockWorld 3D Studio — backend engine
   • serves the editor
   • saves/loads projects to ./projects
   • Model Workshop: fetches models from TRUSTED sources only,
     caches them on disk so the browser never hits the internet
   ============================================================ */
const express = require('express');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const https = require('https');

const PORT = process.env.PORT || 4770;
const ROOT = __dirname;
const PROJECTS = path.join(ROOT, 'projects');
const MODEL_CACHE = path.join(ROOT, 'cache', 'models');
fs.mkdirSync(PROJECTS, { recursive: true });
fs.mkdirSync(MODEL_CACHE, { recursive: true });

// Trusted hosts we will download models from. Nothing else, ever.
const TRUSTED_HOSTS = new Set([
  'raw.githubusercontent.com',   // Khronos glTF sample assets
  'github.com',
  'objects.githubusercontent.com',
  'static.poly.pizza',           // poly.pizza CC0 low-poly library
  'poly.pizza',
  'api.poly.pizza'
]);
const POLY_KEY = process.env.POLY_PIZZA_KEY || '';

// Curated starter catalog (Khronos official sample models, all free to use)
const KHRONOS = 'https://raw.githubusercontent.com/KhronosGroup/glTF-Sample-Assets/main/Models/';
const THUMB_EXT = { Duck:'png', DamagedHelmet:'png', Fox:'jpg', Avocado:'jpg', BoomBox:'jpg', Lantern:'jpg', WaterBottle:'jpg', ToyCar:'jpg', Suzanne:'jpg', AntiqueCamera:'jpg', BarramundiFish:'jpg', Corset:'jpg', SheenChair:'jpg', IridescenceLamp:'jpg', MosquitoInAmber:'jpg', Cube:'jpg', Sponza:'jpg', CesiumMan:'gif', BrainStem:'gif', CesiumMilkTruck:'gif', AnimatedCube:'gif', RiggedFigure:'gif', RiggedSimple:'gif' };
const K = (name, file, tags, anim) => ({
  id: 'khronos-' + name.toLowerCase(), title: name.replace(/([a-z])([A-Z])/g, '$1 $2'),
  url: KHRONOS + name + '/glTF-Binary/' + (file || name) + '.glb',
  thumb: THUMB_EXT[name] ? KHRONOS + name + '/screenshot/screenshot.' + THUMB_EXT[name] : '',
  creator: 'Khronos Group', license: 'CC0 / permissive', tags, animated: !!anim, source: 'Khronos samples'
});
const CATALOG = [
  K('Duck', null, ['animal','toy'], false),
  K('Fox', null, ['animal'], true),
  K('CesiumMan', null, ['character','person'], true),
  K('BrainStem', null, ['robot','character'], true),
  K('Avocado', null, ['food'], false),
  K('BoomBox', null, ['prop','music'], false),
  K('Lantern', null, ['prop','light'], false),
  K('WaterBottle', null, ['prop'], false),
  K('DamagedHelmet', null, ['scifi','prop'], false),
  K('ToyCar', null, ['vehicle','toy'], false),
  K('CesiumMilkTruck', null, ['vehicle'], true),
  K('Suzanne', null, ['monkey','test'], false),
  K('AntiqueCamera', null, ['prop'], false),
  K('BarramundiFish', null, ['animal','fish'], false),
  K('Corset', null, ['prop'], false),
  K('SheenChair', null, ['furniture'], false),
  K('IridescenceLamp', null, ['furniture','light'], false),
  K('MosquitoInAmber', null, ['nature'], false),
  K('AnimatedCube', null, ['test'], true),
  K('RiggedFigure', null, ['character'], true),
  K('RiggedSimple', null, ['test'], true),
  K('Cube', null, ['test'], false),
  K('Sponza', null, ['level','building'], false),
];

const app = express();
app.use(express.json({ limit: '50mb' }));
app.use(express.static(path.join(ROOT, 'public'), { maxAge: 0 }));
app.use('/models', express.static(MODEL_CACHE, { maxAge: '30d', immutable: true }));

/* ---------------- projects ---------------- */
const safeName = n => String(n || '').replace(/[^a-zA-Z0-9 _\-]/g, '').trim().slice(0, 60) || 'Untitled';
app.get('/api/projects', (req, res) => {
  const list = fs.readdirSync(PROJECTS).filter(f => f.endsWith('.bw3d')).map(f => {
    const st = fs.statSync(path.join(PROJECTS, f));
    return { name: f.replace(/\.bw3d$/, ''), modified: st.mtimeMs, size: st.size };
  }).sort((a, b) => b.modified - a.modified);
  res.json(list);
});
app.get('/api/projects/:name', (req, res) => {
  const f = path.join(PROJECTS, safeName(req.params.name) + '.bw3d');
  if (!fs.existsSync(f)) return res.status(404).json({ error: 'not found' });
  res.type('json').send(fs.readFileSync(f));
});
app.put('/api/projects/:name', (req, res) => {
  const f = path.join(PROJECTS, safeName(req.params.name) + '.bw3d');
  fs.writeFileSync(f, JSON.stringify(req.body));
  res.json({ ok: true, name: safeName(req.params.name) });
});
app.delete('/api/projects/:name', (req, res) => {
  const f = path.join(PROJECTS, safeName(req.params.name) + '.bw3d');
  if (fs.existsSync(f)) fs.unlinkSync(f);
  res.json({ ok: true });
});

/* ---------------- workshop ---------------- */
function fetchBuffer(url, headers = {}, redirects = 0) {
  return new Promise((resolve, reject) => {
    let u; try { u = new URL(url); } catch { return reject(new Error('bad url')); }
    if (u.protocol !== 'https:' || !TRUSTED_HOSTS.has(u.hostname)) return reject(new Error('untrusted host: ' + u.hostname));
    const req = https.get(u, { headers: { 'User-Agent': 'BlockWorld3D/1.0', ...headers } }, r => {
      if ([301, 302, 303, 307, 308].includes(r.statusCode) && r.headers.location && redirects < 5) {
        r.resume();
        return fetchBuffer(new URL(r.headers.location, u).toString(), headers, redirects + 1).then(resolve, reject);
      }
      if (r.statusCode !== 200) { r.resume(); return reject(new Error('HTTP ' + r.statusCode)); }
      const chunks = [];
      r.on('data', c => chunks.push(c));
      r.on('end', () => resolve({ buf: Buffer.concat(chunks), type: r.headers['content-type'] || '' }));
      r.on('error', reject);
    });
    req.on('error', reject);
    req.setTimeout(60000, () => req.destroy(new Error('timeout')));
  });
}

app.get('/api/workshop/search', async (req, res) => {
  const q = String(req.query.q || '').toLowerCase().trim();
  let results = CATALOG.filter(m => !q || m.title.toLowerCase().includes(q) || m.tags.some(t => t.includes(q)));
  let polyError = null;
  if (POLY_KEY && q) {
    try {
      const { buf } = await fetchBuffer('https://api.poly.pizza/v1.1/search/' + encodeURIComponent(q) + '?Limit=40', { 'x-auth-token': POLY_KEY });
      const data = JSON.parse(buf.toString('utf8'));
      const items = (data.results || data.Results || []).map(m => ({
        id: 'poly-' + (m.ID || m.id), title: m.Title || m.title, url: m.Download || m.download,
        thumb: m.Thumbnail || m.thumbnail, creator: (m.Creator && (m.Creator.Username || m.Creator.name)) || 'poly.pizza',
        license: m.Licence || m.License || 'CC0', tags: (m.Tags || []).map(String), animated: !!m.Animated, source: 'poly.pizza'
      })).filter(m => m.url);
      results = results.concat(items);
    } catch (e) { polyError = e.message; }
  }
  res.json({ results, polyEnabled: !!POLY_KEY, polyError });
});

// Download (once) into the cache and hand back a local URL the browser can load.
app.post('/api/workshop/fetch', async (req, res) => {
  const url = String(req.body.url || '');
  const hash = crypto.createHash('sha1').update(url).digest('hex').slice(0, 16);
  const ext = (url.split('?')[0].match(/\.(glb|gltf|obj|fbx)$/i) || [, 'glb'])[1].toLowerCase();
  const file = hash + '.' + ext;
  const full = path.join(MODEL_CACHE, file);
  if (fs.existsSync(full)) return res.json({ ok: true, local: '/models/' + file, cached: true });
  try {
    const { buf } = await fetchBuffer(url);
    if (buf.length > 120 * 1024 * 1024) throw new Error('model too large');
    fs.writeFileSync(full, buf);
    res.json({ ok: true, local: '/models/' + file, size: buf.length });
  } catch (e) {
    res.status(400).json({ ok: false, error: e.message });
  }
});

// Thumbnail proxy so the browser only ever talks to us.
app.get('/api/workshop/thumb', async (req, res) => {
  try {
    const { buf, type } = await fetchBuffer(String(req.query.url || ''));
    res.set('Cache-Control', 'public, max-age=86400').type(type || 'image/png').send(buf);
  } catch (e) { res.status(404).end(); }
});

// User uploads (their own .glb/.gltf/.obj) — raw body, stored in the cache.
app.post('/api/workshop/upload', express.raw({ type: '*/*', limit: '120mb' }), (req, res) => {
  const name = String(req.query.name || 'model.glb');
  const ext = (name.match(/\.(glb|gltf|obj|fbx)$/i) || [, 'glb'])[1].toLowerCase();
  const hash = crypto.createHash('sha1').update(req.body).digest('hex').slice(0, 16);
  const file = hash + '.' + ext;
  fs.writeFileSync(path.join(MODEL_CACHE, file), req.body);
  res.json({ ok: true, local: '/models/' + file });
});


/* ---------------- export: one self-contained .html ---------------- */
let bundleCache = null;
async function buildRuntimeBundle(){
  const esbuild = require('esbuild');
  const r = await esbuild.build({
    entryPoints: [path.join(ROOT, 'public', 'js', 'player.js')], bundle: true, format: 'iife', minify: true, write: false, target: 'es2020',
    alias: { 'three': path.join(ROOT, 'public', 'vendor', 'three', 'three.module.js'), 'three/addons': path.join(ROOT, 'public', 'vendor', 'three', 'jsm'), 'cannon-es': path.join(ROOT, 'public', 'vendor', 'cannon-es.js') }
  });
  return r.outputFiles[0].text;
}
app.post('/api/export', async (req, res) => {
  try {
    const { project, scripts } = req.body;
    if (!project) throw new Error('no project');
    if (!bundleCache) bundleCache = await buildRuntimeBundle();
    const proj = JSON.parse(JSON.stringify(project));
    // inline models as data URLs so the game plays offline
    for (const o of proj.objects || []){
      if (o.kind === 'model' && o.modelUrl && o.modelUrl.startsWith('/models/')){
        const f = path.join(MODEL_CACHE, path.basename(o.modelUrl));
        if (fs.existsSync(f)){ const ext = path.extname(f).slice(1); const mime = ext === 'glb' ? 'model/gltf-binary' : ext === 'gltf' ? 'model/gltf+json' : 'text/plain'; o.modelUrl = 'data:' + mime + ';base64,' + fs.readFileSync(f).toString('base64'); }
      }
      delete o.workspace;
    }
    if (proj.stage) delete proj.stage.workspace;
    const safe = s => s.replace(/<\/script/gi, '<\\/script');
    const html = `<!DOCTYPE html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${String(proj.name || 'Game').replace(/[<>&]/g, '')}</title>
<style>html,body{margin:0;height:100%;background:#000;overflow:hidden;font-family:Helvetica,Arial,sans-serif}#view{width:100%;height:100%;display:block;outline:none}#hud{position:absolute;inset:0;pointer-events:none}
.bw-monitors{position:absolute;left:12px;top:12px;display:flex;flex-direction:column;gap:6px}.bw-monitor{display:flex;align-items:center;gap:8px;background:#e6f0ff;border:1px solid #c3d4f5;border-radius:6px;padding:3px 3px 3px 8px;font-size:14px;font-weight:600;color:#575e75}.bw-monitor .v{background:#4c97ff;color:#fff;border-radius:4px;padding:2px 8px;min-width:36px;text-align:center}
.bw-bigtext{position:absolute;inset:0;display:flex;align-items:center;justify-content:center;font-size:9vmin;font-weight:900;color:#fff;text-shadow:0 4px 18px rgba(0,0,0,.5),0 0 3px #000;text-align:center;padding:20px}
#start{position:absolute;inset:0;display:flex;flex-direction:column;align-items:center;justify-content:center;background:rgba(0,0,0,.55);color:#fff;cursor:pointer;gap:14px}#start h1{margin:0;font-size:8vmin}#start .b{background:#4cbb17;padding:14px 40px;border-radius:40px;font-size:24px;font-weight:700}
#restart{position:absolute;top:10px;right:10px;background:rgba(255,255,255,.85);border:0;border-radius:8px;padding:6px 12px;font-weight:700;cursor:pointer}#err{position:absolute;bottom:10px;left:10px;background:#c0392b;color:#fff;padding:6px 10px;border-radius:6px;display:none;font-size:12px}
#credit{position:absolute;bottom:8px;right:10px;color:#fff;opacity:.5;font-size:11px}</style></head>
<body><canvas id="view" tabindex="0"></canvas><div id="hud"></div><button id="restart">↻ Restart</button><div id="err"></div><div id="credit">made with BlockWorld 3D</div>
<div id="start"><h1>${String(proj.name || 'Game').replace(/[<>&]/g, '')}</h1><div class="b">▶ Play</div></div>
<script>window.BW_GAME=${safe(JSON.stringify({ project: proj, scripts }))};</script>
<script>${safe(bundleCache)}</script></body></html>`;
    res.set('Content-Disposition', 'attachment; filename="' + String(proj.name || 'game').replace(/[^\w\- ]/g, '') + '.html"').type('html').send(html);
  } catch (e) { console.error(e); res.status(500).json({ error: e.message }); }
});

app.get('/api/health', (req, res) => res.json({ ok: true, poly: !!POLY_KEY }));

app.listen(PORT, () => {
  console.log('\n  ◆ BlockWorld 3D Studio  →  http://localhost:' + PORT);
  console.log('    projects: ' + PROJECTS);
  console.log('    workshop: ' + (POLY_KEY ? 'Khronos + poly.pizza' : 'Khronos samples (set POLY_PIZZA_KEY for thousands more)') + '\n');
});
