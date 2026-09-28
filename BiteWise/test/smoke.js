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
  const sw = fs.readFileSync(path.join(PUB, 'sw.js'), 'utf8');
  for (const f of (sw.match(/const SHELL = \[(.*?)\]/s)?.[1] || '').match(/'([^']+)'/g).map(x => x.slice(1, -1))) if (f !== '/') ok(fs.existsSync(path.join(PUB, f)), 'offline file exists: ' + f);
  const u = JSON.parse(fs.readFileSync(path.join(PUB, 'usda-foods.json'), 'utf8'));
  ok(u.foods.length > 5000, 'USDA foods loaded', u.foods.length);
  const pb = u.foods.find(f => f[0] === 'Peanut butter');
  ok(pb && pb[3].includes('p') && !pb[3].includes('d'), 'peanut butter: peanut, not dairy', pb && pb[3]);
}

function dataTests() {
  const { BW } = sandbox();
  BW.saveProfile({ setup: true, sex: 'female', age: 30, heightIn: 64, weightLb: 160, goalLb: 140, activity: 1.375, goalType: 'lose', pace: 2 });
  let g = BW.goals();
  ok(g.budget >= 1200, 'adult floor', g.budget);
  ok(g.pace <= 1.6, 'pace capped near 1% body weight', g.pace);
  BW.saveProfile({ customBudget: 900 });
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
    // groups (only once the feature exists)
    const g = await call('groups', { name: 'Fam' }, a.j.token);
    if (g.status !== 404) {
      ok(g.status === 200 && /^[A-Z0-9]{6}$/.test(g.j.group?.code || ''), 'create group', JSON.stringify(g.j));
      const bob = await call('signup', { username: 'bob', password: 'secret2' });
      ok((await call('groups/join', { code: 'ZZZZZZ' }, bob.j.token)).status === 404, 'bad code rejected');
      const jn = await call('groups/join', { code: g.j.group.code }, bob.j.token);
      ok(jn.status === 200, 'join group');
      await call('share', { stats: { name: 'Bob', goal: 'Lose 1 lb a week', streak: 3 } }, bob.j.token);
      const list = await call('groups', null, a.j.token, 'GET');
      const fam = list.j.groups?.[0];
      ok(fam && fam.members.length === 2, 'both members listed', JSON.stringify(list.j));
      ok(fam?.members.some(m => m.stats?.name === 'Bob' && m.stats.streak === 3), 'shared stats visible');
      const eve = await call('signup', { username: 'eve', password: 'secret3' });
      ok(!((await call('groups', null, eve.j.token, 'GET')).j.groups || []).length, 'outsiders see nothing');
      ok((await call(`groups/${fam.id}/leave`, {}, bob.j.token)).status === 200, 'leave group');
    }
  } catch (e) { fail++; console.log('  ✗ server tests crashed: ' + e.message + '\n' + log.slice(-800)); }
  srv.kill(); fs.rmSync(dir, { recursive: true, force: true });
}

(async () => {
  console.log('BiteWise smoke tests');
  try { parserTests(); } catch (e) { fail++; console.log('  ✗ parser crashed: ' + e.stack); }
  try { fileTests(); } catch (e) { fail++; console.log('  ✗ files crashed: ' + e.stack); }
  try { dataTests(); } catch (e) { fail++; console.log('  ✗ data crashed: ' + e.stack); }
  await serverTests();
  console.log(`${pass} passed, ${fail} failed`);
  process.exit(fail ? 1 : 0);
})();
