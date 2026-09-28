// BiteWise server. The app itself runs fully offline in the browser (service worker + IndexedDB);
// this server only adds: optional accounts + cloud sync, the AI coach, and Fitbit step sync.
const express = require('express');
const crypto = require('crypto');
const path = require('path');
const store = require('./store');
const ai = require('./ai');

const app = express();
app.set('trust proxy', true);
app.use(express.json({ limit: '2mb' }));
app.disable('x-powered-by');

const PORT = process.env.PORT || 4970;

// ---------- helpers ----------
const sha = s => crypto.createHash('sha256').update(s).digest('hex');
const hashPw = (pw, salt) => new Promise((res, rej) => crypto.scrypt(pw, salt, 64, (e, k) => e ? rej(e) : res(k.toString('hex'))));
const origin = req => process.env.PUBLIC_URL || `${req.protocol}://${req.get('host')}`;

const hits = new Map();
function limit(max, windowMs) {
  return (req, res, next) => {
    const k = req.path + '|' + (req.uid || req.ip), now = Date.now();
    const h = (hits.get(k) || []).filter(t => now - t < windowMs);
    if (h.length >= max) return res.status(429).json({ error: 'Slow down a little — try again in a minute.' });
    h.push(now); hits.set(k, h); next();
  };
}

async function auth(req, res, next) {
  const tok = (req.get('authorization') || '').replace(/^Bearer /, '');
  req.uid = tok ? await store.sessionUser(sha(tok)).catch(() => null) : null;
  next();
}
const needUser = (req, res, next) => req.uid ? next() : res.status(401).json({ error: 'Sign in to use this.' });
app.use('/api', auth);

// ---------- status ----------
app.get('/api/status', (req, res) => res.json({ ok: true, ai: ai.BACKEND !== 'none', model: ai.model, health: health.configured(), storage: store.name, signedIn: !!req.uid }));

// ---------- accounts ----------
const cleanName = s => String(s || '').trim().toLowerCase();
app.post('/api/signup', limit(10, 60 * 60e3), async (req, res) => {
  const username = cleanName(req.body.username), password = String(req.body.password || '');
  if (!/^[a-z0-9_.-]{3,24}$/.test(username)) return res.status(400).json({ error: 'Usernames are 3–24 letters, numbers, dots or dashes.' });
  if (password.length < 6) return res.status(400).json({ error: 'Use at least 6 characters for your password.' });
  const salt = crypto.randomBytes(16).toString('hex');
  const user = { id: crypto.randomUUID(), username, salt, hash: await hashPw(password, salt), created: Date.now() };
  if (!await store.createUser(user)) return res.status(409).json({ error: 'That username is taken.' });
  const token = crypto.randomBytes(32).toString('hex');
  await store.addSession(sha(token), user.id);
  res.json({ token, username });
});
app.post('/api/login', limit(20, 15 * 60e3), async (req, res) => {
  const user = await store.userByName(cleanName(req.body.username));
  if (!user || await hashPw(String(req.body.password || ''), user.salt) !== user.hash) return res.status(401).json({ error: 'Wrong username or password.' });
  const token = crypto.randomBytes(32).toString('hex');
  await store.addSession(sha(token), user.id);
  res.json({ token, username: user.username });
});
app.post('/api/logout', async (req, res) => {
  const tok = (req.get('authorization') || '').replace(/^Bearer /, '');
  if (tok) await store.dropSession(sha(tok));
  res.json({ ok: true });
});
app.get('/api/me', needUser, async (req, res) => {
  const u = await store.userById(req.uid);
  const t = await store.getFitbit(req.uid);
  res.json({ username: u?.username, health: !!(t && t.provider === 'google-health'), healthSince: t?.linkedAt || null });
});

// ---------- sync ----------
// Client sends records it changed since its last sync; server returns everything newer than `since` (server seq).
app.post('/api/sync', needUser, limit(120, 60e3), async (req, res) => {
  const changes = Array.isArray(req.body.changes) ? req.body.changes.filter(r => r && typeof r.id === 'string' && r.id.length < 80).slice(0, 5000) : [];
  const accepted = changes.length ? await store.upsertRecords(req.uid, changes) : 0;
  const out = await store.recordsSince(req.uid, Number(req.body.since) || 0);
  res.json({ accepted, ...out });
});

// ---------- AI coach ----------
app.post('/api/coach', limit(30, 60e3), async (req, res) => {
  try {
    const messages = (Array.isArray(req.body.messages) ? req.body.messages : [])
      .filter(m => m && (m.role === 'user' || m.role === 'assistant') && typeof m.content === 'string')
      .map(m => ({ role: m.role, content: m.content.slice(0, 2000) }));
    if (!messages.length) return res.status(400).json({ error: 'Say something to the coach first.' });
    // hard ceiling so the router never times out and sends an HTML error page instead of JSON
    const out = await Promise.race([ai.coach({ messages, context: req.body.context || {} }), new Promise(r => setTimeout(() => r(null), 50000))]);
    if (!out) return res.status(504).json({ error: 'Bitey took too long on that one.' });
    res.json(out);
  } catch (e) { console.error('coach:', e.message); res.status(503).json({ error: e.message }); }
});
app.post('/api/estimate', limit(40, 60e3), async (req, res) => {
  try { res.json({ items: await ai.estimate(String(req.body.text || '')) }); }
  catch (e) { console.error('estimate:', e.message); res.status(503).json({ error: e.message }); }
});

// ---------- Fitbit via Google Health ----------
const health = require('./health')(app, { store, needUser, limit, origin });
require('./groups')(app, { store, needUser, limit });
require('./online-foods')(app, { limit });

// Delete everything in the cloud: just the log (keep the account), or the whole account.
app.post('/api/account/wipe', needUser, limit(10, 60 * 60e3), async (req, res) => { await store.deleteRecords(req.uid); res.json({ ok: true }); });
app.post('/api/account/delete', needUser, limit(5, 60 * 60e3), async (req, res) => {
  // leave every group first so nobody sees a ghost member
  for (const id of (await store.kvGet('ugroups:' + req.uid)) || []) {
    const g = await store.kvGet('group:' + id); if (!g) continue;
    g.members = g.members.filter(m => m !== req.uid);
    if (!g.members.length) { await store.kvDel('group:' + g.id); await store.kvDel('code:' + g.code); }
    else { if (g.owner === req.uid) g.owner = g.members[0]; await store.kvSet('group:' + g.id, g); }
  }
  for (const k of ['ugroups:', 'share:']) await store.kvDel(k + req.uid);
  await store.deleteUser(req.uid);
  res.json({ ok: true });
});

// Turn an automatic device account into a real login (username + password) so it works on other devices.
app.post('/api/account/claim', needUser, limit(10, 60 * 60e3), async (req, res) => {
  const username = cleanName(req.body.username), password = String(req.body.password || '');
  if (!/^[a-z0-9_.-]{3,24}$/.test(username)) return res.status(400).json({ error: 'Usernames are 3–24 letters, numbers, dots or dashes.' });
  if (password.length < 6) return res.status(400).json({ error: 'Use at least 6 characters for your password.' });
  const salt = crypto.randomBytes(16).toString('hex');
  if (!await store.renameUser(req.uid, username, salt, await hashPw(password, salt))) return res.status(409).json({ error: 'That username is taken.' });
  res.json({ username });
});

// ---------- static app ----------
app.use((req, res, next) => { res.set('X-Content-Type-Options', 'nosniff'); next(); });
app.get('/sw.js', (req, res) => { res.set('Cache-Control', 'no-cache'); res.sendFile(path.join(__dirname, 'public', 'sw.js')); });
app.use(express.static(path.join(__dirname, 'public'), { maxAge: 0, etag: true }));
app.get(/^\/(?!api\/).*/, (req, res) => res.sendFile(path.join(__dirname, 'public', 'index.html')));

store.init().then(() => {
  const server = app.listen(PORT, () => console.log(`BiteWise on http://localhost:${PORT}  (storage: ${store.name}, ai: ${ai.BACKEND}, fitbit via google health: ${health.configured() ? 'on' : 'not set up'})`));
  // Cloud Foundry sends SIGTERM when it restarts or moves the app: finish requests in progress, then exit
  // (the other running copy keeps serving, so nobody sees an error)
  const stop = () => { console.log('stopping: finishing open requests'); server.close(() => process.exit(0)); setTimeout(() => process.exit(0), 8000).unref(); };
  process.on('SIGTERM', stop); process.on('SIGINT', stop);
}).catch(e => { console.error('storage init failed:', e); process.exit(1); });
