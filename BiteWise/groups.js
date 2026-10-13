// Groups: make a group, share a 6-letter code, and members see each other's progress.
// Sharing is one switch per person (off until they turn it on). Once on, everyone in their groups sees their
// goal, streak, steps, weight and food log, and can log food for them. The app posts a summary; the server adds
// the food log and weigh-ins straight from their synced records, so it is current even if their phone is offline.
const crypto = require('crypto');
const CODE_CHARS = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; // no 0/O/1/I so codes are easy to read out loud
const newCode = () => Array.from(crypto.randomBytes(6), b => CODE_CHARS[b % CODE_CHARS.length]).join('');
const MAX_GROUPS = 10, MAX_MEMBERS = 30;

// only these fields are stored/shown, with sane limits
function cleanStats(s = {}) {
  const num = (v, lo, hi) => Number.isFinite(+v) ? Math.max(lo, Math.min(hi, Math.round(+v * 10) / 10)) : null;
  const str = (v, n) => typeof v === 'string' ? v.trim().slice(0, n) : null;
  return {
    name: str(s.name, 30), goal: str(s.goal, 60), budget: num(s.budget, 0, 9999), streak: num(s.streak, 0, 9999),
    level: num(s.level, 1, 99), levelName: str(s.levelName, 30), todayPct: num(s.todayPct, 0, 500), onTrackDays: num(s.onTrackDays, 0, 7),
    steps: num(s.steps, 0, 200000), lostLb: num(s.lostLb, -500, 500), goalLb: num(s.goalLb, 0, 1000), weightLb: num(s.weightLb, 0, 1500), color: /^#[0-9a-f]{6}$/i.test(s.color || '') ? s.color : null,
  };
}
const dayKey = (d = new Date()) => d.toISOString().slice(0, 10);
const addDays = (k, n) => dayKey(new Date(Date.parse(k) + n * 864e5));

// what a sharing member's groups see of their actual log: this week's totals, today's foods, recent weigh-ins
async function logView(store, uid, today) {
  const DAYS = 14, from = addDays(today, -(DAYS - 1));
  const recs = (await store.recentRecords(uid, ['entry', 'steps'], addDays(today, -60))).concat(await store.recentRecords(uid, ['weight'], '0000-00-00'));
  const days = {}; for (let i = DAYS - 1; i >= 0; i--) days[addDays(today, -i)] = { date: addDays(today, -i), eaten: 0, steps: null, weight: null, foods: [] };
  const food = r => ({ name: String(r.name || 'Food').slice(0, 80), calories: Math.round(+r.calories || 0), meal: r.meal, time: r.time, by: r.by ? String(r.by).slice(0, 30) : undefined });
  for (const r of recs) {
    const d = days[r.date]; if (!d) continue;
    if (r.kind === 'entry') { d.eaten += (+r.calories || 0); if (d.foods.length < 40) d.foods.push(food(r)); }
    else if (r.kind === 'steps') d.steps = Math.round(+r.steps || +r.count || 0);
    else if (r.kind === 'weight' && r.lb > 0) d.weight = Math.round(r.lb * 10) / 10;
  }
  for (const d of Object.values(days)) d.foods.sort((a, b) => (b.time || 0) - (a.time || 0));
  const allW = recs.filter(r => r.kind === 'weight' && r.lb > 0 && r.date <= today).map(r => ({ date: r.date, lb: Math.round(r.lb * 10) / 10 })).sort((a, b) => a.date < b.date ? -1 : 1);
  // pounds lost counts from the starting weight they set on Goals (synced in their profile), else their first weigh-in
  const prof = (await store.recentRecords(uid, ['profile'], '0000-00-00').catch(() => []))[0];
  const startLb = prof && +prof.startLb > 0 ? +prof.startLb : (allW.length ? allW[0].lb : null);
  const lostLb = allW.length ? Math.round((startLb - allW[allW.length - 1].lb) * 10) / 10 : null;
  const t = days[today];
  return { today, days: Object.values(days), foods: t.foods, weights: allW.slice(-12), lostLb, weighIns: allW.length, todayCal: t.eaten, steps: t.steps };
}

// members are addressed by a per-group key, never by their account id
const memberKey = (gid, uid) => crypto.createHash('sha256').update(gid + ':' + uid).digest('hex').slice(0, 16);

module.exports = function mountGroups(app, { store, needUser, limit }) {
  const myGroups = async uid => (await store.kvGet('ugroups:' + uid)) || [];
  const setMyGroups = (uid, ids) => store.kvSet('ugroups:' + uid, ids);

  async function view(uid, g, today = dayKey()) {
    const members = await Promise.all(g.members.map(async m => {
      const share = await store.kvGet('share:' + m);
      const u = await store.userById(m);
      const auto = !u || u.auto || /^bw-/.test(u.username || '');
      const sharing = !!share?.full, exact = share?.exact !== false; // exact = share the actual weight number, not just pounds lost
      let st = share?.stats || null, log = sharing ? await logView(store, m, today).catch(e => { console.error('group log view:', e.message); return null; }) : null;
      // today's progress, weight and pounds lost come from the log itself, never from the summary their phone last
      // pushed (that could be yesterday's). If the log can't be read, stale pushed numbers are dropped rather than shown.
      if (sharing && st) {
        const stale = Date.now() - (share.at || 0) > 36e5 * 20;
        if (log) { st = { ...st, todayPct: st.budget ? Math.round(log.todayCal / st.budget * 100) : null, steps: log.steps != null ? log.steps : (stale ? null : st.steps) }; if (log.weighIns) { st.lostLb = log.lostLb; st.weightLb = log.weights[log.weights.length - 1].lb; } }
        else if (stale) st = { ...st, todayPct: null, steps: null };
      }
      if (sharing && st && !exact) st = { ...st, weightLb: null, goalLb: null };
      if (log && !exact) log = { ...log, weights: [] };
      return { key: memberKey(g.id, m), you: m === uid, owner: m === g.owner, username: auto ? null : u.username, sharing, exact,
        stats: sharing ? st : (st ? { name: st.name, color: st.color } : null), at: share?.at || null, canLog: sharing, log };
    }));
    return { id: g.id, name: g.name, code: g.code, created: g.created, members };
  }
  const todayOf = req => /^\d{4}-\d{2}-\d{2}$/.test(req.query.date || '') ? req.query.date : dayKey();

  app.post('/api/groups', needUser, limit(10, 60 * 60e3), async (req, res) => {
    const name = String(req.body.name || '').trim().slice(0, 40);
    if (!name) return res.status(400).json({ error: 'Give your group a name.' });
    const mine = await myGroups(req.uid);
    if (mine.length >= MAX_GROUPS) return res.status(400).json({ error: `You can be in up to ${MAX_GROUPS} groups.` });
    let code; for (let i = 0; i < 20; i++) { code = newCode(); if (!await store.kvGet('code:' + code)) break; }
    const g = { id: crypto.randomUUID(), code, name, owner: req.uid, members: [req.uid], created: Date.now() };
    await store.kvSet('group:' + g.id, g); await store.kvSet('code:' + code, g.id); await setMyGroups(req.uid, [...mine, g.id]);
    res.json({ group: await view(req.uid, g) });
  });

  app.post('/api/groups/join', needUser, limit(20, 60 * 60e3), async (req, res) => {
    const code = String(req.body.code || '').toUpperCase().replace(/[^A-Z0-9]/g, '');
    const id = code.length === 6 ? await store.kvGet('code:' + code) : null;
    const g = id ? await store.kvGet('group:' + id) : null;
    if (!g) return res.status(404).json({ error: 'No group has that code. Check the letters and try again.' });
    const mine = await myGroups(req.uid);
    if (!g.members.includes(req.uid)) {
      if (g.members.length >= MAX_MEMBERS) return res.status(400).json({ error: 'That group is full.' });
      if (mine.length >= MAX_GROUPS) return res.status(400).json({ error: `You can be in up to ${MAX_GROUPS} groups.` });
      g.members.push(req.uid); await store.kvSet('group:' + g.id, g); await setMyGroups(req.uid, [...mine, g.id]);
    }
    res.json({ group: await view(req.uid, g) });
  });

  app.get('/api/groups', needUser, async (req, res) => {
    const out = [];
    for (const id of await myGroups(req.uid)) { const g = await store.kvGet('group:' + id); if (g && g.members.includes(req.uid)) out.push(await view(req.uid, g, todayOf(req))); }
    res.json({ groups: out });
  });

  app.post('/api/groups/:id/leave', needUser, async (req, res) => {
    const g = await store.kvGet('group:' + req.params.id);
    await setMyGroups(req.uid, (await myGroups(req.uid)).filter(x => x !== req.params.id));
    if (g) {
      g.members = g.members.filter(m => m !== req.uid);
      if (!g.members.length) { await store.kvDel('group:' + g.id); await store.kvDel('code:' + g.code); }
      else { if (g.owner === req.uid) g.owner = g.members[0]; await store.kvSet('group:' + g.id, g); }
    }
    res.json({ ok: true });
  });

  // a member logs food for someone else in the group (only if that person has sharing on). It lands in their log
  // like any synced record, so it shows up on their phone the next time it syncs, even if they were offline.
  app.post('/api/groups/:id/log', needUser, limit(60, 60 * 60e3), async (req, res) => {
    const g = await store.kvGet('group:' + req.params.id);
    if (!g || !g.members.includes(req.uid)) return res.status(404).json({ error: 'That group is gone.' });
    const to = g.members.find(m => memberKey(g.id, m) === String(req.body.to || ''));
    if (!to || to === req.uid) return res.status(404).json({ error: 'That person isn\u2019t in the group anymore.' });
    const share = await store.kvGet('share:' + to);
    if (!share?.full) return res.status(403).json({ error: 'They haven\u2019t turned on sharing, so nobody can log for them yet.' });
    const name = String(req.body.name || 'Food').trim().slice(0, 80), calories = Math.round(+req.body.calories);
    if (!(calories > 0 && calories <= 5000)) return res.status(400).json({ error: 'Enter calories between 1 and 5,000.' });
    const date = /^\d{4}-\d{2}-\d{2}$/.test(req.body.date || '') ? req.body.date : new Date().toISOString().slice(0, 10);
    const meal = ['breakfast', 'lunch', 'dinner', 'snack'].includes(req.body.meal) ? req.body.meal : 'snack';
    const me = await store.kvGet('share:' + req.uid);
    const by = me?.stats?.name || (await store.userById(req.uid))?.username || 'A friend';
    const now = Date.now();
    await store.upsertRecords(to, [{ id: 'e:g-' + crypto.randomUUID(), kind: 'entry', date, time: now, meal, name, calories, source: 'group', by: String(by).slice(0, 30), updatedAt: now }]);
    res.json({ ok: true });
  });

  // the app posts a fresh summary whenever the person's numbers change. `full` is their one sharing switch.
  app.post('/api/share', needUser, limit(60, 60e3), async (req, res) => {
    await store.kvSet('share:' + req.uid, { stats: cleanStats(req.body.stats), full: !!req.body.full, exact: req.body.exact !== false, at: Date.now() });
    res.json({ ok: true });
  });
};
