// Fitbit steps + weight via the Google Health API (the successor to the Fitbit Web API, which Google shut down
// in September 2026). One Google sign-in gives us the user's Fitbit data.
//   Setup (once, by the app owner): Google Cloud project → enable "Google Health API" → OAuth client (Web app)
//   with redirect URI  <PUBLIC_URL>/api/health/callback  → set GOOGLE_CLIENT_ID + GOOGLE_CLIENT_SECRET.
const crypto = require('crypto');

const CLIENT_ID = process.env.GOOGLE_CLIENT_ID || '';
const CLIENT_SECRET = process.env.GOOGLE_CLIENT_SECRET || '';
const API = 'https://health.googleapis.com/v4/users/me';
const SCOPES = [
  'https://www.googleapis.com/auth/googlehealth.activity_and_fitness.readonly',
  'https://www.googleapis.com/auth/googlehealth.health_metrics_and_measurements.readonly',
];
const configured = () => !!(CLIENT_ID && CLIENT_SECRET);

module.exports = function mountHealth(app, { store, needUser, limit, origin }) {
  // sign-in state lives in the database so any running copy of the server can finish the sign-in
  const redirectUri = req => origin(req) + '/api/health/callback';

  // The app POSTs here (keeps the session token out of URLs), then navigates to the returned Google URL.
  app.post('/api/health/start', needUser, async (req, res) => {
    if (!configured()) return res.status(501).json({ error: 'Fitbit sync isn’t set up on this server yet.' });
    const verifier = crypto.randomBytes(48).toString('base64url');
    const state = crypto.randomBytes(16).toString('hex');
    await store.kvSet('oauth:' + state, { uid: req.uid, verifier, at: Date.now() });
    const u = new URL('https://accounts.google.com/o/oauth2/v2/auth');
    u.search = new URLSearchParams({
      client_id: CLIENT_ID, redirect_uri: redirectUri(req), response_type: 'code', scope: SCOPES.join(' '),
      access_type: 'offline', prompt: 'consent', include_granted_scopes: 'true', state,
      code_challenge: crypto.createHash('sha256').update(verifier).digest('base64url'), code_challenge_method: 'S256',
    }).toString();
    res.json({ url: u.toString() });
  });

  async function token(params) {
    const r = await fetch('https://oauth2.googleapis.com/token', {
      method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({ client_id: CLIENT_ID, client_secret: CLIENT_SECRET, ...params }),
    });
    const j = await r.json();
    if (!r.ok) throw Object.assign(new Error(j.error_description || j.error || 'Google sign-in failed'), { status: r.status, code: j.error });
    return j;
  }

  app.get('/api/health/callback', async (req, res) => {
    const state = String(req.query.state || '').replace(/[^a-f0-9]/g, '').slice(0, 64);
    let p = state ? await store.kvGet('oauth:' + state) : null;
    if (state) await store.kvDel('oauth:' + state);
    if (p && Date.now() - p.at > 15 * 60e3) p = null;
    if (req.query.error) return res.redirect('/#me?health=' + (req.query.error === 'access_denied' ? 'denied' : 'error'));
    if (!p || !req.query.code) return res.redirect('/#me?health=error');
    try {
      const j = await token({ grant_type: 'authorization_code', code: String(req.query.code), redirect_uri: redirectUri(req), code_verifier: p.verifier });
      await store.setFitbit(p.uid, { provider: 'google-health', access: j.access_token, refresh: j.refresh_token, expires: Date.now() + (j.expires_in - 60) * 1000, linkedAt: Date.now() });
      res.redirect('/#today?health=connected');
    } catch (e) { console.error('health callback:', e.message); res.redirect('/#me?health=error'); }
  });

  async function access(uid) {
    let t = await store.getFitbit(uid);
    if (!t || t.provider !== 'google-health') throw Object.assign(new Error('Fitbit isn’t connected.'), { status: 404 });
    if (Date.now() > t.expires) {
      try {
        const j = await token({ grant_type: 'refresh_token', refresh_token: t.refresh });
        t = { ...t, access: j.access_token, expires: Date.now() + (j.expires_in - 60) * 1000, refresh: j.refresh_token || t.refresh };
        await store.setFitbit(uid, t);
      } catch (e) {
        if (e.code === 'invalid_grant') { await store.setFitbit(uid, null); throw Object.assign(new Error('Fitbit access ended. Connect it again.'), { status: 401 }); }
        throw e;
      }
    }
    return t.access;
  }

  const civil = (d) => ({ date: { year: d.getUTCFullYear(), month: d.getUTCMonth() + 1, day: d.getUTCDate() } });
  const dayOf = c => { const d = c?.date || c; return d && d.year ? `${d.year}-${String(d.month).padStart(2, '0')}-${String(d.day).padStart(2, '0')}` : null; };
  // first number found inside an object (rollup value field names vary by type: countSum, weightGramsAvg, …)
  const firstNum = (o, prefer) => { if (o == null) return null; if (typeof o === 'number') return o; if (typeof o === 'string' && isFinite(+o)) return +o; if (typeof o !== 'object') return null; const keys = Object.keys(o).sort((a, b) => (prefer.test(b) ? 1 : 0) - (prefer.test(a) ? 1 : 0)); for (const k of keys) { const v = firstNum(o[k], prefer); if (v != null) return v; } return null; };

  async function rollup(uid, type, startKey, endKey) {
    const tok = await access(uid);
    const [sy, sm, sd] = startKey.split('-').map(Number), [ey, em, ed] = endKey.split('-').map(Number);
    const r = await fetch(`${API}/dataTypes/${type}/dataPoints:dailyRollUp`, {
      method: 'POST', headers: { Authorization: 'Bearer ' + tok, 'Content-Type': 'application/json' },
      body: JSON.stringify({ range: { start: civil(new Date(Date.UTC(sy, sm - 1, sd))), end: civil(new Date(Date.UTC(ey, em - 1, ed))) }, windowSizeDays: 1 }),
    });
    const j = await r.json().catch(() => ({}));
    if (r.status === 401) { await store.setFitbit(uid, null); throw Object.assign(new Error('Fitbit access ended. Connect it again.'), { status: 401 }); }
    if (r.status === 412) throw Object.assign(new Error('Your Google Health profile isn’t set up yet. Open the Fitbit app once, then try again.'), { status: 412 });
    if (!r.ok) throw Object.assign(new Error(j.error?.message || 'Google Health error ' + r.status), { status: 502 });
    return j.rollupDataPoints || [];
  }

  // Client sends its own local dates (so "today" matches the phone's time zone).
  app.post('/api/health/pull', needUser, limit(40, 60e3), async (req, res) => {
    try {
      const start = String(req.body.start || ''), end = String(req.body.end || '');
      if (!/^\d{4}-\d{2}-\d{2}$/.test(start) || !/^\d{4}-\d{2}-\d{2}$/.test(end)) return res.status(400).json({ error: 'Bad date range.' });
      const pts = await rollup(req.uid, 'steps', start, end);
      const steps = pts.map(p => ({ date: dayOf(p.civilStartTime) || (p.startTime || '').slice(0, 10), steps: Math.round(firstNum(p.steps, /count|sum/i) || 0) })).filter(s => s.date);
      let weights = [];
      try {
        const w = await rollup(req.uid, 'weight', start, end);
        weights = w.map(p => {
          const v = firstNum(p.weight, /avg|mean|last/i); if (v == null) return null;
          const kg = v > 1000 ? v / 1000 : v; // grams or kilograms
          return { date: dayOf(p.civilStartTime) || (p.startTime || '').slice(0, 10), lb: Math.round(kg * 2.20462 * 10) / 10 };
        }).filter(x => x && x.date && x.lb > 40);
      } catch (e) { if (e.status === 401) throw e; }
      res.json({ steps, weights, at: Date.now() });
    } catch (e) { console.error('health pull:', e.message); res.status(e.status || 502).json({ error: e.message }); }
  });

  // Test: raw Google Health response for the last 7 days of steps, plus what BiteWise made of it.
  app.post('/api/health/test', needUser, limit(20, 60e3), async (req, res) => {
    const start = String(req.body.start || ''), end = String(req.body.end || '');
    const out = { connected: false, steps: [], raw: null, error: null };
    try {
      const t = await store.getFitbit(req.uid);
      out.connected = !!(t && t.provider === 'google-health');
      if (!out.connected) return res.json(out);
      const tok = await access(req.uid);
      const [sy, sm, sd] = start.split('-').map(Number), [ey, em, ed] = end.split('-').map(Number);
      const r = await fetch(`${API}/dataTypes/steps/dataPoints:dailyRollUp`, {
        method: 'POST', headers: { Authorization: 'Bearer ' + tok, 'Content-Type': 'application/json' },
        body: JSON.stringify({ range: { start: civil(new Date(Date.UTC(sy, sm - 1, sd))), end: civil(new Date(Date.UTC(ey, em - 1, ed))) }, windowSizeDays: 1 }),
      });
      out.status = r.status;
      out.raw = await r.json().catch(() => null);
      if (!r.ok) out.error = out.raw?.error?.message || 'Google Health error ' + r.status;
      else out.steps = (out.raw?.rollupDataPoints || []).map(p => ({ date: dayOf(p.civilStartTime) || (p.startTime || '').slice(0, 10), steps: Math.round(firstNum(p.steps, /count|sum/i) || 0) }));
    } catch (e) { out.error = e.message; }
    res.json(out);
  });

  app.post('/api/health/disconnect', needUser, async (req, res) => {
    const t = await store.getFitbit(req.uid);
    if (t?.access) fetch('https://oauth2.googleapis.com/revoke?token=' + encodeURIComponent(t.refresh || t.access), { method: 'POST' }).catch(() => {});
    await store.setFitbit(req.uid, null); res.json({ ok: true });
  });

  return { configured };
};
