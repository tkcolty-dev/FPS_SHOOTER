// Groups: make a group, share a 6-letter code, and members see each other's goals and progress.
// Each person decides what they share (Me → Groups → What I share); the app sends a small summary, never the food log.
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
    steps: num(s.steps, 0, 200000), lostLb: num(s.lostLb, -500, 500), goalLb: num(s.goalLb, 0, 1000), color: /^#[0-9a-f]{6}$/i.test(s.color || '') ? s.color : null,
  };
}

module.exports = function mountGroups(app, { store, needUser, limit }) {
  const myGroups = async uid => (await store.kvGet('ugroups:' + uid)) || [];
  const setMyGroups = (uid, ids) => store.kvSet('ugroups:' + uid, ids);

  async function view(uid, g) {
    const members = await Promise.all(g.members.map(async m => {
      const share = await store.kvGet('share:' + m);
      const u = await store.userById(m);
      const auto = !u || u.auto || /^bw-/.test(u.username || '');
      return { you: m === uid, owner: m === g.owner, username: auto ? null : u.username, stats: share?.stats || null, at: share?.at || null };
    }));
    return { id: g.id, name: g.name, code: g.code, created: g.created, members };
  }

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
    for (const id of await myGroups(req.uid)) { const g = await store.kvGet('group:' + id); if (g && g.members.includes(req.uid)) out.push(await view(req.uid, g)); }
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

  // the app posts a fresh summary of what the person chose to share whenever their numbers change
  app.post('/api/share', needUser, limit(60, 60e3), async (req, res) => {
    await store.kvSet('share:' + req.uid, { stats: cleanStats(req.body.stats), at: Date.now() });
    res.json({ ok: true });
  });
};
