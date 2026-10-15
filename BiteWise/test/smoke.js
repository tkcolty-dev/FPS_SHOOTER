// BiteWise smoke tests — run before every deploy:  npm test
// Checks the offline food parser, the goal math + safety limits, and the server API (accounts, sync, groups).
const fs = require('fs'), os = require('os'), path = require('path'), vm = require('vm');
const { spawn } = require('child_process');

let pass = 0, fail = 0;
const ok = (cond, name, extra = '') => { if (cond) pass++; else { fail++; console.log('  ✗ ' + name + (extra ? '  → ' + extra : '')); } };
const PUB = path.join(__dirname, '..', 'public');

// ---------- browser-side code in a sandbox ----------
function sandbox() {
  const store = {};
  const ctx = { window: { addEventListener() {} }, localStorage: { getItem: k => store[k] ?? null, setItem: (k, v) => { store[k] = String(v); }, removeItem: k => { delete store[k]; } }, navigator: { onLine: false }, crypto: require('crypto').webcrypto, console, setTimeout, clearTimeout };
  ctx.window.localStorage = ctx.localStorage; ctx.crypto.randomUUID = () => require('crypto').randomUUID();
  vm.createContext(ctx);
  for (const f of ['foods.js', 'parse.js', 'data.js']) vm.runInContext(fs.readFileSync(path.join(PUB, f), 'utf8'), ctx, { filename: f });
  return ctx.window;
}

function parserTests() {
  const { BW_PARSE: P, BW_FOODS } = sandbox();
  const total = t => P.parseLog(t).total;
  ok(BW_FOODS.length >= 200, 'food list loaded', BW_FOODS.length);
  ok(total('450') === 450, 'plain number');
  ok(total('three fifty calories') === 350, 'spoken number');
  ok(total('two eggs and toast') === 235, 'two eggs and toast', total('two eggs and toast'));
  ok(P.parseLog('big mac, large fries, diet coke for lunch').items.length === 3, 'comma list');
  ok(P.parseLog('big mac, large fries, diet coke for lunch').meal === 'lunch', 'meal word');
  ok(total('chipotle bowl 900') === 900, 'food + calories');
  ok(total('20 chicken nuggets') > 800, '20 nuggets');
  ok(P.parseLog('mac and cheese').items.length === 1, 'mac and cheese stays one food');
  ok(P.parseLog('something weird').items[0]?.calories == null, 'unknown food flagged');
  const pb = P.parseLog('peanut butter toast').items.find(i => /peanut/i.test(i.name));
  ok(!BW_FOODS[0].allergens || !!pb, 'peanut butter found');
  if (BW_FOODS.some(f => f.allergens)) ok((pb?.allergens || []).includes('peanut'), 'peanut allergen tagged', JSON.stringify(pb));
}

function fileTests() {
  const v = JSON.parse(fs.readFileSync(path.join(PUB, 'version.json'), 'utf8'));
  const app = fs.readFileSync(path.join(PUB, 'app.js'), 'utf8');
  ok(app.includes(`const APP_VERSION = '${v.version}'`), 'app.js version matches version.json', v.version);
  ok(v.history[0].version === v.version, 'newest history entry is the current version');
  const html = fs.readFileSync(path.join(PUB, 'index.html'), 'utf8');
  ok((html.match(/\?v=([0-9.]+)"/g) || []).length >= 5 && (html.match(/\?v=([0-9.]+)"/g) || []).every(m => m === `?v=${v.version}"`), 'index.html file links carry the current version', v.version);
  const sw = fs.readFileSync(path.join(PUB, 'sw.js'), 'utf8');
  for (const f of (sw.match(/const SHELL = \[(.*?)\]/s)?.[1] || '').match(/'([^']+)'/g).map(x => x.slice(1, -1))) if (f !== '/') ok(fs.existsSync(path.join(PUB, f)), 'offline file exists: ' + f);
  const u = JSON.parse(fs.readFileSync(path.join(PUB, 'usda-foods.json'), 'utf8'));
  ok(u.foods.length > 5000, 'USDA foods loaded', u.foods.length);
  const pb = u.foods.find(f => f[0] === 'Peanut butter');
  ok(pb && pb[3].includes('p') && !pb[3].includes('d'), 'peanut butter: peanut, not dairy', pb && pb[3]);
}

function dataTests() {
  {
    // two devices: each setting keeps the newest change, instead of the last device to save undoing the other
    const { BW, localStorage: ls } = sandbox();
    BW.saveProfile({ setup: true, goalLb: 160, waterGoal: 8 });
    const t = Date.now() + 5000; // "device B" saved water later but with an older goal
    const remote = { ...BW.profile(), goalLb: 170, waterGoal: 12, ts: { ...BW.profile().ts, goalLb: 1, waterGoal: t }, updatedAt: t };
    BW.saveProfile({ goalLb: 150 }); // device A changes the goal now (after B's old goal stamp, before B's water stamp)
    // simulate the cloud copy arriving through the same merge path sync uses
    const merged = BW._mergeProfile ? BW._mergeProfile(remote) : null;
    ok(merged && merged.goalLb === 150 && merged.waterGoal === 12, 'profile merge keeps the newest value of each setting', JSON.stringify(merged && { g: merged.goalLb, w: merged.waterGoal }));
  }
  const { BW } = sandbox();
  BW.put({ id: 'preset:1', kind: 'preset', name: 'Coffee', calories: 40, color: '#FF9500', order: 2 });
  BW.put({ id: 'preset:2', kind: 'preset', name: 'Lunch', calories: 650, color: '#007AFF', order: 1 });
  BW.put({ id: 'preset:3', kind: 'preset', name: '', calories: 0 });
  ok(BW.presets().length === 2 && BW.presets()[0].name === 'Lunch', 'quick adds listed in order, blanks skipped', JSON.stringify(BW.presets()));
  BW.remove('preset:1'); ok(BW.presets().length === 1, 'quick add deleted');
  BW.setWeight('2026-10-12', 180); BW.setWeight('2026-10-13', 179);
  ok(BW.trend().lost === 1 && BW.trend().now === 179, 'two weigh-ins: lost is the real difference', JSON.stringify({ lost: BW.trend().lost, now: BW.trend().now }));
  BW.saveProfile({ startLb: 185 });
  ok(BW.trend().lost === 1 && !BW.trend().startSet, 'a starting weight nobody set on purpose is ignored', JSON.stringify(BW.trend()));
  BW.setStart(185);
  ok(BW.trend().lost === 6 && BW.trend().start === 185 && BW.trend().startSet, 'pounds lost counts from the starting weight once set', JSON.stringify(BW.trend()));
  BW.setWeight('2026-10-10', 190); BW.syncWeightNow();
  ok(BW.weighIns()[0].date === '2026-10-13' && BW.weighIns().length === 3 && BW.profile().weightLb === 179, 'weigh-ins list newest first; weight now follows the latest', JSON.stringify(BW.weighIns()));
  BW.remove('weight:2026-10-13'); BW.syncWeightNow();
  ok(BW.trend().now === 180 && BW.profile().weightLb === 180 && BW.weighIns().length === 2, 'deleting the latest weigh-in moves weight now back', JSON.stringify({ now: BW.trend().now, w: BW.profile().weightLb }));
  BW.setStart(null); BW.setWeight('2026-10-13', 179);
  ok(BW.trend().lost === 11 && !BW.trend().startSet, 'without a starting weight, lost counts from the first weigh-in', BW.trend().lost);
  BW.remove('weight:2026-10-10');
  ok(BW.trend().lost === 1 && BW.trend().first === 180, 'deleting the first weigh-in moves the start to the next one', JSON.stringify({ lost: BW.trend().lost, first: BW.trend().first }));
  BW.saveProfile({ setup: true, sex: 'female', age: 30, heightIn: 64, weightLb: 160, goalLb: 140, activity: 1.375, goalType: 'lose', pace: 2 });
  let g = BW.goals();
  ok(g.budget >= 1200, 'adult floor', g.budget);
  ok(g.pace <= 1.6, 'pace capped near 1% body weight', g.pace);
  BW.saveProfile({ customBudget: 900 });
  BW.setSteps('2026-10-13', 15000);
  ok(!BW.profile().earnSteps && BW.day('2026-10-13').bonus === 0 && BW.day('2026-10-13').budget === BW.goals().budget, 'steps do not add calories', JSON.stringify({ bonus: BW.day('2026-10-13').bonus }));
  BW.saveProfile({ earnSteps: true });
  ok(BW.day('2026-10-13').bonus > 0, 'steps add calories only when switched on');
  ok(BW.goals().budget === 1200 && BW.goals().clamped, 'custom number cannot go under floor', BW.goals().budget);
  BW.saveProfile({ customBudget: 1800 });
  ok(BW.goals().budget === 1800, 'custom number used');
  BW.saveProfile({ customBudget: null, age: 14, goalType: 'lose', pace: 2 });
  g = BW.goals();
  ok(!g.teen && g.budget >= 1200 && g.pace > 0.5, 'under 18 uses the same limits as everyone', JSON.stringify({ pace: g.pace, budget: g.budget, floor: g.floor }));
  BW.saveProfile({ customBudget: 1300 });
  ok(BW.goals().budget === 1300, 'under 18 can set their own number above the minimum', BW.goals().budget);
  BW.saveProfile({ customBudget: null });
  BW.saveProfile({ age: 30, goalType: 'gain', gainPace: 0.5 });
  ok(BW.goals().budget > BW.goals().tdee, 'gain adds calories');
  const k = BW.dayKey();
  const e = BW.addEntry({ calories: 300, name: 'Test' });
  ok(BW.day(k).eaten === 300, 'entry counts');
  BW.remove(e.id);
  ok(BW.day(k).eaten === 0, 'delete removes');
  BW.addEntry({ date: BW.addDays(k, -1), calories: 100 }); BW.addEntry({ calories: 100 });
  ok(BW.streak().days === 2, 'streak counts days', BW.streak().days);
  ok(typeof BW.level().n === 'number', 'level works');
  const pts = BW.PACE_PRESETS.normal.points;
  ok(BW.paceShare(pts, 300) === 0 && BW.paceShare(pts, 1439) === 1, 'pace: 0 early morning, 100% at night');
  ok(Math.abs(BW.paceShare(pts, 780) - 0.5) < 1e-9 && BW.paceShare(pts, 660) > 0.2 && BW.paceShare(pts, 660) < 0.5, 'pace: exact at checkpoints, in between otherwise');
  const noon = new Date(); noon.setHours(12, 0, 0, 0);
  const pn = BW.paceNow(BW.dayKey(), noon);
  ok(pn && pn.expected > 0 && pn.expected < BW.day(BW.dayKey()).budget, 'pace: expected-by-now is part of the goal', JSON.stringify(pn));
  BW.saveProfile({ paceOn: false }); ok(BW.paceNow(BW.dayKey(), noon) === null, 'pace can be turned off'); BW.saveProfile({ paceOn: true });
}

// ---------- server API ----------
async function serverTests() {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'bw-test-'));
  const PORT = 4979;
  const srv = spawn(process.execPath, [path.join(__dirname, '..', 'server.js')], { env: { ...process.env, PORT, BW_DATA_DIR: dir, VCAP_SERVICES: '', DATABASE_URL: '', OPENAI_API_BASE: '', BW_NO_AI: '1' }, stdio: ['ignore', 'pipe', 'pipe'] });
  let log = ''; srv.stdout.on('data', d => log += d); srv.stderr.on('data', d => log += d);
  const base = `http://localhost:${PORT}/api/`;
  const call = async (p, body, tok, method = 'POST') => { const r = await fetch(base + p, { method, headers: { 'Content-Type': 'application/json', ...(tok ? { Authorization: 'Bearer ' + tok } : {}) }, body: method === 'GET' ? undefined : JSON.stringify(body || {}) }); return { status: r.status, j: await r.json().catch(() => ({})) }; };
  try {
    for (let i = 0; i < 40; i++) { try { await fetch(base + 'status'); break; } catch { await new Promise(r => setTimeout(r, 150)); } }
    const st = await call('status', null, null, 'GET');
    ok(st.status === 200 && st.j.ok, 'server status');
    const a = await call('signup', { username: 'alice', password: 'secret1' });
    ok(a.status === 200 && a.j.token, 'signup');
    ok((await call('signup', { username: 'alice', password: 'secret1' })).status === 409, 'duplicate username rejected');
    ok((await call('login', { username: 'alice', password: 'nope' })).status === 401, 'wrong password rejected');
    const b = await call('login', { username: 'alice', password: 'secret1' });
    ok(b.status === 200, 'login');
    const s1 = await call('sync', { since: 0, changes: [{ id: 'e:1', kind: 'entry', calories: 5, updatedAt: 10 }] }, a.j.token);
    ok(s1.j.accepted === 1 && s1.j.records.length === 1, 'sync push');
    const s2 = await call('sync', { since: 0, changes: [{ id: 'e:1', kind: 'entry', calories: 1, updatedAt: 5 }] }, b.j.token);
    ok(s2.j.accepted === 0 && s2.j.records[0].calories === 5, 'older change loses');
    ok((await call('sync', { since: 0 })).status === 401, 'sync needs sign-in');
    const del = await call('signup', { username: 'deleteme', password: 'secret9' });
    await call('sync', { since: 0, changes: [{ id: 'e:x', kind: 'entry', calories: 9, updatedAt: 1 }] }, del.j.token);
    ok((await call('account/wipe', {}, del.j.token)).status === 200 && (await call('sync', { since: 0 }, del.j.token)).j.records.length === 0, 'wipe clears the cloud log');
    ok((await call('account/delete', {}, del.j.token)).status === 200, 'delete account');
    ok((await call('sync', { since: 0 }, del.j.token)).status === 401 && (await call('login', { username: 'deleteme', password: 'secret9' })).status === 401, 'deleted account is gone');
    // groups (only once the feature exists)
    const g = await call('groups', { name: 'Fam' }, a.j.token);
    if (g.status !== 404) {
      ok(g.status === 200 && /^[A-Z0-9]{6}$/.test(g.j.group?.code || ''), 'create group', JSON.stringify(g.j));
      const bob = await call('signup', { username: 'bob', password: 'secret2' });
      ok((await call('groups/join', { code: 'ZZZZZZ' }, bob.j.token)).status === 404, 'bad code rejected');
      const jn = await call('groups/join', { code: g.j.group.code }, bob.j.token);
      ok(jn.status === 200, 'join group');
      await call('sync', { since: 0, changes: [{ id: 'e:b1', kind: 'entry', date: '2026-10-12', meal: 'lunch', name: 'Taco', calories: 400, time: 1, updatedAt: 10 }, { id: 'weight:2026-10-12', kind: 'weight', date: '2026-10-12', lb: 171.5, updatedAt: 10 }] }, bob.j.token);
      await call('share', { stats: { name: 'Bob', goal: 'Lose 1 lb a week', streak: 3, weightLb: 171.5 } }, bob.j.token);
      let list = await call('groups?date=2026-10-12', null, a.j.token, 'GET');
      let bobRow = list.j.groups?.[0]?.members.find(m => m.stats?.name === 'Bob');
      ok(bobRow && !bobRow.sharing && bobRow.stats.streak == null && !bobRow.log && !bobRow.canLog, 'sharing is off by default: only the name shows', JSON.stringify(bobRow));
      await call('share', { stats: { name: 'Bob', goal: 'Lose 1 lb a week', streak: 3, weightLb: 171.5 }, full: true }, bob.j.token);
      list = await call('groups?date=2026-10-12', null, a.j.token, 'GET');
      const fam = list.j.groups?.[0];
      bobRow = fam?.members.find(m => m.stats?.name === 'Bob');
      ok(bobRow?.sharing && bobRow.stats.weightLb === 171.5 && bobRow.log?.foods?.[0]?.name === 'Taco' && bobRow.log.weights?.[0]?.lb === 171.5 && bobRow.log.days.find(d => d.date === '2026-10-12')?.eaten === 400, 'sharing on: weight and food log visible', JSON.stringify(bobRow?.log));
      await call('share', { stats: { name: 'Bob', streak: 3, weightLb: 171.5, lostLb: 4.5 }, full: true, exact: false }, bob.j.token);
      bobRow = (await call('groups?date=2026-10-12', null, a.j.token, 'GET')).j.groups?.[0]?.members.find(m => m.stats?.name === 'Bob');
      ok(bobRow?.sharing && bobRow.stats.weightLb == null && bobRow.stats.lostLb === 0 && bobRow.log?.weights?.length === 0 && bobRow.log.foods.length === 1, 'exact weight off: pounds lost (from weigh-ins) shows, the number does not', JSON.stringify(bobRow?.stats));
      await call('share', { stats: { name: 'Bob', streak: 3, weightLb: 171.5, budget: 2000, todayPct: 99 }, full: true }, bob.j.token);
      await call('sync', { since: 0, changes: [{ id: 'e:b2', kind: 'entry', date: '2026-10-12', meal: 'dinner', name: 'Soup', calories: 200, time: 2, updatedAt: 11 }, { id: 'steps:2026-10-12', kind: 'steps', date: '2026-10-12', steps: 7100, updatedAt: 11 }] }, bob.j.token);
      bobRow = (await call('groups?date=2026-10-12', null, a.j.token, 'GET')).j.groups?.[0]?.members.find(m => m.stats?.name === 'Bob');
      ok(bobRow?.log?.todayCal === 600 && bobRow.stats.todayPct === 30 && bobRow.stats.steps === 7100, 'today\'s numbers come from the log, not the stale pushed summary', JSON.stringify({ cal: bobRow?.log?.todayCal, pct: bobRow?.stats?.todayPct, steps: bobRow?.stats?.steps }));
      bobRow = (await call('groups?date=2026-10-13', null, a.j.token, 'GET')).j.groups?.[0]?.members.find(m => m.stats?.name === 'Bob');
      ok(bobRow?.log?.todayCal === 0 && bobRow.stats.todayPct === 0 && bobRow.log.foods.length === 0, 'a new day starts at zero for everyone', JSON.stringify({ cal: bobRow?.log?.todayCal, pct: bobRow?.stats?.todayPct }));
      await call('sync', { since: 0, changes: [{ id: 'weight:2026-09-01', kind: 'weight', date: '2026-09-01', lb: 175, updatedAt: 12 }, { id: 'weight:2026-10-13', kind: 'weight', date: '2026-10-13', lb: 170.5, updatedAt: 12 }] }, bob.j.token);
      await call('share', { stats: { name: 'Bob', budget: 2000, lostLb: 0.2, weightLb: 171.5 }, full: true }, bob.j.token);
      bobRow = (await call('groups?date=2026-10-13', null, a.j.token, 'GET')).j.groups?.[0]?.members.find(m => m.stats?.name === 'Bob');
      ok(bobRow?.stats?.lostLb === 4.5 && bobRow.stats.weightLb === 170.5 && bobRow.log.lostLb === 4.5, 'pounds lost and weight come from the weigh-ins, not the pushed summary', JSON.stringify({ lost: bobRow?.stats?.lostLb, w: bobRow?.stats?.weightLb }));
      const yd = bobRow?.log?.days?.find(d => d.date === '2026-10-12');
      ok(bobRow?.log?.days?.length === 14 && yd && yd.eaten === 600 && yd.foods.length === 2 && yd.steps === 7100 && yd.weight === 171.5, 'past days carry their foods, steps and weigh-in', JSON.stringify(yd));
      ok(fam && fam.members.length === 2, 'both members listed', JSON.stringify(list.j));
      ok(fam?.members.some(m => m.stats?.name === 'Bob' && m.stats.streak === 3), 'shared stats visible');
      const eve = await call('signup', { username: 'eve', password: 'secret3' });
      ok(!((await call('groups', null, eve.j.token, 'GET')).j.groups || []).length, 'outsiders see nothing');
      const bobKey = fam.members.find(m => m.stats?.name === 'Bob')?.key;
      ok(!!bobKey, 'members have a key');
      const lf = await call(`groups/${fam.id}/log`, { to: bobKey, name: 'Pizza', calories: 300, meal: 'dinner', date: '2026-09-28' }, a.j.token);
      ok(lf.status === 200, 'log food for a group member', JSON.stringify(lf.j));
      const bs = await call('sync', { since: 0 }, bob.j.token);
      ok(bs.j.records.some(r => r.name === 'Pizza' && r.source === 'group' && r.by), 'friend-logged food lands in their log');
      await call('share', { stats: { name: 'Bob' }, full: false }, bob.j.token);
      ok((await call(`groups/${fam.id}/log`, { to: bobKey, name: 'Cake', calories: 300 }, a.j.token)).status === 403, 'sharing off blocks logging for them');
      ok((await call(`groups/${fam.id}/log`, { to: bobKey, name: 'Cake', calories: 300 }, eve.j.token)).status === 404, 'outsiders cannot log for members');
      const st1 = (await call('groups/pulse', null, a.j.token, 'GET')).j.stamp;
      await new Promise(r => setTimeout(r, 5));
      await call('sync', { since: 0, changes: [{ id: 'e:p1', kind: 'entry', date: '2026-10-13', calories: 10, updatedAt: 14 }] }, bob.j.token);
      const st2 = (await call('groups/pulse', null, a.j.token, 'GET')).j.stamp;
      ok(st1 > 0 && st2 > st1, 'a member syncing a change moves the group stamp', JSON.stringify({ st1, st2 }));
      ok((await call('groups/pulse', null, a.j.token, 'GET')).j.stamp === st2, 'stamp stays put when nothing changed');
      ok((await call(`groups/${fam.id}/leave`, {}, bob.j.token)).status === 200, 'leave group');
      ok((await call('groups/pulse', null, a.j.token, 'GET')).j.stamp > st2, 'leaving moves the stamp');
      // starting weight (synced in the profile) drives the server's pounds lost
      await call('sync', { since: 0, changes: [{ id: 'profile', kind: 'profile', startLb: 180, updatedAt: 12 }] }, bob.j.token);
      await call('share', { stats: { name: 'Bob', budget: 2000 }, full: true }, bob.j.token);
      await call('groups/join', { code: g.j.group.code }, bob.j.token);
      bobRow = (await call('groups?date=2026-10-13', null, a.j.token, 'GET')).j.groups?.[0]?.members.find(m => m.stats?.name === 'Bob');
      ok(bobRow?.stats?.lostLb === 4.5, 'server ignores a starting weight nobody set on purpose', JSON.stringify({ lost: bobRow?.stats?.lostLb }));
      await call('sync', { since: 0, changes: [{ id: 'profile', kind: 'profile', startLb: 180, startBy: 'user', updatedAt: 13 }] }, bob.j.token);
      await call('share', { stats: { name: 'Bob', budget: 2000 }, full: true }, bob.j.token);
      await call('groups/join', { code: g.j.group.code }, bob.j.token);
      bobRow = (await call('groups?date=2026-10-13', null, a.j.token, 'GET')).j.groups?.[0]?.members.find(m => m.stats?.name === 'Bob');
      ok(bobRow?.stats?.lostLb === 9.5 && bobRow.log.lostLb === 9.5, 'server pounds lost counts from the starting weight', JSON.stringify({ lost: bobRow?.stats?.lostLb }));
    }
    // staying signed in: cookie restore, sign-in codes, install key
    const rawLogin = await fetch(base + 'login', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ username: 'alice', password: 'secret1' }) });
    const cookie = (rawLogin.headers.get('set-cookie') || '').split(';')[0];
    ok(/^bw_s=[0-9a-f]{64}$/.test(cookie) && /HttpOnly/.test(rawLogin.headers.get('set-cookie') || ''), 'login sets an HttpOnly sign-in cookie', rawLogin.headers.get('set-cookie'));
    const restored = await fetch(base + 'session/restore', { method: 'POST', headers: { 'Content-Type': 'application/json', cookie }, body: '{}' }).then(r => r.json());
    ok(restored.token && restored.username === 'alice' && restored.auto === false, 'the cookie alone restores the sign-in', JSON.stringify(restored));
    ok((await call('session/restore')).status === 401, 'no cookie, no restore');
    ok((await call('sync', { since: 0 }, restored.token)).status === 200, 'restored token works');
    const lk = await call('link', {}, a.j.token);
    ok(lk.status === 200 && /^[A-Z2-9]{6}$/.test(lk.j.code || ''), 'sign-in code issued', JSON.stringify(lk.j));
    const red = await call('link/redeem', { code: lk.j.code.toLowerCase() + ' ' });
    ok(red.status === 200 && red.j.username === 'alice' && (await call('sync', { since: 0 }, red.j.token)).status === 200, 'code signs another device in as the same account', JSON.stringify(red.j));
    ok((await call('link/redeem', { code: 'ZZZZZZ' })).status === 404, 'bad code rejected');
    const ik = await call('link/install', null, a.j.token, 'GET');
    ok(/^[0-9a-f]{48}$/.test(ik.j.key || ''), 'install key issued');
    ok((await call('link/install', null, a.j.token, 'GET')).j.key === ik.j.key, 'install key is stable');
    const man = await fetch(`http://localhost:${PORT}/manifest.webmanifest?k=${ik.j.key}`).then(r => r.json());
    ok(man.start_url === `/?k=${ik.j.key}#today` && man.name === 'BiteWise', 'manifest carries the install key in its start address', man.start_url);
    ok((await fetch(`http://localhost:${PORT}/manifest.webmanifest?k=${'0'.repeat(48)}`).then(r => r.json())).start_url === '/#today', 'unknown key gets the plain manifest');
    const red2 = await call('link/redeem', { code: ik.j.key });
    ok(red2.status === 200 && red2.j.username === 'alice', 'the installed app signs in with its key', JSON.stringify(red2.j));
    const autoU = await call('signup', { username: 'bw-abcdefghijkl', password: 'secretsecret' });
    const lk2 = await call('link', {}, autoU.j.token);
    ok((await call('link/redeem', { code: lk2.j.code })).j.auto === true, 'automatic accounts can be linked by code too');
    ok((await call('logout', {}, a.j.token)).status === 200 && (await call('link/redeem', { code: ik.j.key })).status === 404, 'sign out retires the install key');
  } catch (e) { fail++; console.log('  ✗ server tests crashed: ' + e.message + '\n' + log.slice(-800)); }
  srv.kill(); fs.rmSync(dir, { recursive: true, force: true });
}

function searchSafetyTests() {
  const { isSafe } = require('../search');
  ok(isSafe("Holtman's Donuts") && isSafe('calories in a big mac'), 'normal lookups allowed');
  ok(!isSafe('how to purge after eating') && !isSafe('diet pills that work') && !isSafe('buy weed'), 'unsafe lookups refused');
}

(async () => {
  console.log('BiteWise smoke tests');
  try { parserTests(); } catch (e) { fail++; console.log('  ✗ parser crashed: ' + e.stack); }
  try { fileTests(); } catch (e) { fail++; console.log('  ✗ files crashed: ' + e.stack); }
  try { searchSafetyTests(); } catch (e) { fail++; console.log('  ✗ search safety crashed: ' + e.stack); }
  try { dataTests(); } catch (e) { fail++; console.log('  ✗ data crashed: ' + e.stack); }
  await serverTests();
  console.log(`${pass} passed, ${fail} failed`);
  process.exit(fail ? 1 : 0);
})();
