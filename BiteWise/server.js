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
const FITBIT_ID = process.env.FITBIT_CLIENT_ID || '';
const FITBIT_SECRET = process.env.FITBIT_CLIENT_SECRET || '';

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
app.get('/api/status', (req, res) => res.json({ ok: true, ai: ai.BACKEND !== 'none', model: ai.model, fitbit: !!(FITBIT_ID && FITBIT_SECRET), storage: store.name, signedIn: !!req.uid }));

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
  res.json({ username: u?.username, fitbit: !!(await store.getFitbit(req.uid)) });
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
    res.json(await ai.coach({ messages, context: req.body.context || {} }));
  } catch (e) { console.error('coach:', e.message); res.status(503).json({ error: e.message }); }
});
app.post('/api/estimate', limit(40, 60e3), async (req, res) => {
  try { res.json({ items: await ai.estimate(String(req.body.text || '')) }); }
  catch (e) { console.error('estimate:', e.message); res.status(503).json({ error: e.message }); }
});

// ---------- Fitbit (OAuth 2 + PKCE) ----------
const pending = new Map(); // state -> { uid, verifier, at }
// The app POSTs here (so the session token stays out of URLs) and then navigates to the returned Fitbit URL.
app.post('/api/fitbit/start', needUser, async (req, res) => {
  if (!FITBIT_ID || !FITBIT_SECRET) return res.status(501).json({ error: 'Fitbit is not set up on this server yet.' });
  for (const [k, v] of pending) if (Date.now() - v.at > 15 * 60e3) pending.delete(k);
  const verifier = crypto.randomBytes(48).toString('base64url');
  const challenge = crypto.createHash('sha256').update(verifier).digest('base64url');
  const state = crypto.randomBytes(16).toString('hex');
  pending.set(state, { uid: req.uid, verifier, at: Date.now() });
  const u = new URL('https://www.fitbit.com/oauth2/authorize');
  u.search = new URLSearchParams({ response_type: 'code', client_id: FITBIT_ID, redirect_uri: origin(req) + '/api/fitbit/callback', scope: 'activity weight profile', code_challenge: challenge, code_challenge_method: 'S256', state }).toString();
  res.json({ url: u.toString() });
});

async function fitbitToken(params) {
  const r = await fetch('https://api.fitbit.com/oauth2/token', {
    method: 'POST',
    headers: { Authorization: 'Basic ' + Buffer.from(FITBIT_ID + ':' + FITBIT_SECRET).toString('base64'), 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams(params),
  });
  const j = await r.json();
  if (!r.ok) throw new Error(j.errors?.[0]?.message || 'Fitbit token error');
  return { access: j.access_token, refresh: j.refresh_token, expires: Date.now() + (j.expires_in - 60) * 1000, fitbitUser: j.user_id };
}

app.get('/api/fitbit/callback', async (req, res) => {
  const p = pending.get(String(req.query.state || '')); pending.delete(String(req.query.state || ''));
  if (!p || !req.query.code) return res.redirect('/#me?fitbit=error');
  try {
    const tok = await fitbitToken({ grant_type: 'authorization_code', code: String(req.query.code), redirect_uri: origin(req) + '/api/fitbit/callback', code_verifier: p.verifier, client_id: FITBIT_ID });
    await store.setFitbit(p.uid, tok);
    res.redirect('/#me?fitbit=connected');
  } catch (e) { console.error('fitbit callback:', e.message); res.redirect('/#me?fitbit=error'); }
});

async function fitbitGet(uid, urlPath) {
  let tok = await store.getFitbit(uid);
  if (!tok) throw Object.assign(new Error('Fitbit is not connected.'), { status: 404 });
  if (Date.now() > tok.expires) { tok = await fitbitToken({ grant_type: 'refresh_token', refresh_token: tok.refresh }); await store.setFitbit(uid, tok); }
  const r = await fetch('https://api.fitbit.com' + urlPath, { headers: { Authorization: 'Bearer ' + tok.access, 'Accept-Language': 'en_US' } });
  if (r.status === 401) { await store.setFitbit(uid, null); throw Object.assign(new Error('Fitbit access ended. Connect it again.'), { status: 401 }); }
  if (!r.ok) throw new Error('Fitbit error ' + r.status);
  return r.json();
}

app.post('/api/fitbit/pull', needUser, limit(30, 60e3), async (req, res) => {
  try {
    const days = Math.min(30, Math.max(1, Number(req.body.days) || 7));
    const steps = await fitbitGet(req.uid, `/1/user/-/activities/steps/date/today/${days}d.json`);
    let weights = [];
    try { const w = await fitbitGet(req.uid, `/1/user/-/body/log/weight/date/today/30d.json`); weights = (w.weight || []).map(x => ({ date: x.date, lb: x.weight })); } catch {}
    res.json({ steps: (steps['activities-steps'] || []).map(s => ({ date: s.dateTime, steps: Number(s.value) || 0 })), weights });
  } catch (e) { res.status(e.status || 502).json({ error: e.message }); }
});
app.post('/api/fitbit/disconnect', needUser, async (req, res) => { await store.setFitbit(req.uid, null); res.json({ ok: true }); });

// ---------- static app ----------
app.use((req, res, next) => { res.set('X-Content-Type-Options', 'nosniff'); next(); });
app.get('/sw.js', (req, res) => { res.set('Cache-Control', 'no-cache'); res.sendFile(path.join(__dirname, 'public', 'sw.js')); });
app.use(express.static(path.join(__dirname, 'public'), { maxAge: 0, etag: true }));
app.get(/^\/(?!api\/).*/, (req, res) => res.sendFile(path.join(__dirname, 'public', 'index.html')));

store.init().then(() => {
  app.listen(PORT, () => console.log(`BiteWise on http://localhost:${PORT}  (storage: ${store.name}, ai: ${ai.BACKEND}, fitbit: ${FITBIT_ID ? 'on' : 'not set up'})`));
}).catch(e => { console.error('storage init failed:', e); process.exit(1); });
