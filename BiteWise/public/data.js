// BiteWise data layer — everything lives on the device (localStorage), so the app works fully offline.
// Records: { id, kind, updatedAt, deleted?, ...fields }. Kinds: entry, weight, water, steps, profile.
// When signed in, changed records sync to the server (last write wins on updatedAt).
(function () {
  const LS = {
    get(k, d) { try { const v = localStorage.getItem('bw.' + k); return v == null ? d : JSON.parse(v); } catch { return d; } },
    set(k, v) { try { localStorage.setItem('bw.' + k, JSON.stringify(v)); return true; } catch { return false; } },
    del(k) { try { localStorage.removeItem('bw.' + k); } catch {} },
  };
  try { navigator.storage?.persist?.(); } catch {}

  const pad = n => String(n).padStart(2, '0');
  const dayKey = (d = new Date()) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
  const parseDay = k => { const [y, m, d] = k.split('-').map(Number); return new Date(y, m - 1, d); };
  const addDays = (k, n) => { const d = parseDay(k); d.setDate(d.getDate() + n); return dayKey(d); };
  const uid = () => (crypto.randomUUID ? crypto.randomUUID() : Date.now().toString(36) + Math.random().toString(36).slice(2));

  let recs = LS.get('records', {});
  let dirty = new Set(LS.get('dirty', []));
  const listeners = new Set();
  let saveT = null;
  const persist = () => { clearTimeout(saveT); saveT = setTimeout(() => { LS.set('records', recs); LS.set('dirty', [...dirty]); }, 60); };
  // derived numbers are cached until any record changes
  let ver = 0; const cache = new Map();
  const memo = (name, fn) => (...args) => { const key = name + '|' + ver + '|' + args.join(','); if (cache.has(key)) return cache.get(key); if (cache.size > 4000) cache.clear(); const v = fn(...args); cache.set(key, v); return v; };
  const emit = () => { ver++; cache.clear(); listeners.forEach(f => { try { f(); } catch (e) { console.error(e); } }); };

  function put(r) {
    r.updatedAt = Date.now();
    recs[r.id] = r; dirty.add(r.id); persist(); emit(); scheduleSync();
    return r;
  }
  function remove(id) { const r = recs[id]; if (!r) return; put({ ...r, deleted: true }); }
  const all = kind => Object.values(recs).filter(r => r.kind === kind && !r.deleted);

  // ---------- profile + goals ----------
  const DEFAULT_PROFILE = { id: 'profile', kind: 'profile', name: '', setup: false, sex: 'female', age: 30, heightIn: 66, weightLb: 170, goalLb: 155, activity: 1.375, pace: 1, customBudget: null, stepGoal: 8000, waterGoal: 8, earnSteps: true, theme: 'fresh', units: 'lb', allergies: [] };
  const profile = () => ({ ...DEFAULT_PROFILE, ...(recs.profile || {}) });
  const saveProfile = p => put({ ...profile(), ...p, id: 'profile', kind: 'profile' });

  // goalType: 'lose' | 'maintain' | 'gain'. customBudget (a number) overrides the math, but never below the safe floor.
  function goals(p = profile()) {
    const kg = p.weightLb * 0.4536, cm = p.heightIn * 2.54;
    // Mifflin–St Jeor; for "other" gender we use the midpoint of the two formulas
    const bmr = 10 * kg + 6.25 * cm - 5 * p.age + (p.sex === 'male' ? 5 : p.sex === 'female' ? -161 : -78);
    const tdee = Math.round(bmr * p.activity / 10) * 10;
    const teen = false; // no separate under-18 rules; everyone uses the same limits
    const goalType = p.goalType || (p.pace > 0 ? 'lose' : 'maintain');
    // safety minimum for everyone: never under 1200 (female) / 1500 (male) / 1350 (other)
    const floor = p.sex === 'male' ? 1500 : p.sex === 'female' ? 1200 : 1350;
    const maxPace = Math.max(0.5, Math.floor(p.weightLb * 0.01 * 4) / 4); // ≤ ~1% of body weight per week
    const pace = goalType === 'lose' ? Math.min(p.pace || 1, maxPace) : 0;
    const gain = goalType === 'gain' ? Math.min(p.gainPace || 0.5, 1) : 0;
    const planned = Math.round((tdee - pace * 500 + gain * 500) / 10) * 10;
    const custom = p.customBudget ? Math.round(p.customBudget) : null;
    let budget = custom || planned, clamped = false;
    if (budget < floor) { budget = floor; clamped = true; }
    const weeklyChange = (budget - tdee) * 7 / 3500; // lb per week, negative = losing
    return { bmr: Math.round(bmr), tdee, budget, planned, custom, teen, floor, pace, gain, goalType, maxPace, clamped, weeklyChange, losing: goalType === 'lose' };
  }


  // ---------- daily pace: how much of the day's calories you usually eat by certain times ----------
  // points are [minutes after midnight, share of the daily goal 0..1]; kept as shares so they follow goal changes
  const PACE_PRESETS = {
    normal: { name: 'Normal day', desc: 'Breakfast, lunch, dinner', points: [[540, .2], [780, .5], [960, .6], [1170, .9], [1320, 1]] },
    bigbreakfast: { name: 'Big breakfast', desc: 'Eat more early', points: [[540, .35], [780, .65], [1140, .95], [1320, 1]] },
    bigdinner: { name: 'Big dinner', desc: 'Light day, bigger evening', points: [[540, .15], [780, .4], [1170, .9], [1320, 1]] },
    window: { name: 'Eating window', desc: 'Noon to 8 PM', points: [[750, .35], [960, .55], [1200, 1]] },
  };
  const paceSettings = () => { const p = profile(); return { on: p.paceOn !== false, preset: p.pacePreset || 'normal', points: (p.pacePoints && p.pacePoints.length ? p.pacePoints : PACE_PRESETS[p.pacePreset || 'normal']?.points || PACE_PRESETS.normal.points).slice().sort((a, b) => a[0] - b[0]) }; };
  // share of the day you'd usually have eaten at this minute (straight line between checkpoints, starting from 0 at 6 AM)
  function paceShare(points, minute) {
    const pts = [[Math.min(360, points[0][0] - 60), 0], ...points];
    if (minute <= pts[0][0]) return 0;
    for (let i = 1; i < pts.length; i++) if (minute <= pts[i][0]) { const [m0, s0] = pts[i - 1], [m1, s1] = pts[i]; return s0 + (s1 - s0) * (minute - m0) / (m1 - m0); }
    return pts[pts.length - 1][1];
  }
  function paceNow(k = dayKey(), now = new Date()) {
    const ps = paceSettings(); if (!ps.on || k !== dayKey()) return null;
    const d = day(k), minute = now.getHours() * 60 + now.getMinutes(), share = paceShare(ps.points, minute);
    const expected = Math.round(d.budget * share / 10) * 10, next = ps.points.find(p => p[0] > minute);
    return { expected, share, diff: d.eaten - expected, next: next ? { minute: next[0], calories: Math.round(d.budget * next[1] / 10) * 10 } : null };
  }

  // ---------- per-day numbers ----------
  const byDate = memo('byDate', () => { const m = {}; all('entry').forEach(e => (m[e.date] ||= []).push(e)); Object.values(m).forEach(a => a.sort((x, y) => x.time - y.time)); return m; });
  const entriesOn = k => byDate()[k] || [];
  const waterOn = k => (recs['water:' + k] && !recs['water:' + k].deleted ? recs['water:' + k].glasses : 0);
  const stepsOn = k => (recs['steps:' + k] && !recs['steps:' + k].deleted ? recs['steps:' + k].steps : 0);
  const stepSource = k => recs['steps:' + k]?.source || null;
  const weightOn = k => recs['weight:' + k] && !recs['weight:' + k].deleted ? recs['weight:' + k].lb : null;
  const setWater = (k, g) => put({ id: 'water:' + k, kind: 'water', date: k, glasses: Math.max(0, Math.min(30, g)) });
  const setSteps = (k, s, source = 'manual') => put({ id: 'steps:' + k, kind: 'steps', date: k, steps: Math.max(0, Math.round(s)), source });
  const setWeight = (k, lb) => put({ id: 'weight:' + k, kind: 'weight', date: k, lb: Math.round(lb * 10) / 10 });

  function stepBonus(k, p = profile()) {
    if (!p.earnSteps) return 0;
    const s = stepsOn(k); // ~0.04 kcal per step for a 150 lb person above an everyday baseline of 4,000
    return Math.min(500, Math.round(Math.max(0, s - 4000) * 0.04 * (p.weightLb / 150) / 5) * 5);
  }

  const day = memo('day', function day(k) {
    const p = profile(), g = goals(p), es = entriesOn(k);
    const eaten = es.reduce((a, e) => a + (e.calories || 0), 0), bonus = stepBonus(k, p), budget = g.budget + bonus;
    const meals = { breakfast: [], lunch: [], dinner: [], snack: [] };
    es.forEach(e => (meals[e.meal] || meals.snack).push(e));
    return { k, entries: es, meals, eaten, budget, base: g.budget, bonus, remaining: budget - eaten, water: waterOn(k), steps: stepsOn(k), weight: weightOn(k) };
  });

  // Health Score 0–100: calories near budget, steps, water, logging, consistency
  const health = memo('health', function health(k) {
    const p = profile(), d = day(k), isToday = k === dayKey();
    const ratio = d.budget ? d.eaten / d.budget : 0;
    let cal;
    if (!d.entries.length) cal = 0;
    else if (isToday && ratio <= 1.1) cal = 35 * Math.min(1, .4 + ratio);           // in progress: reward staying on track so far
    else { const off = Math.abs(1 - ratio); cal = off <= .1 ? 35 : Math.max(0, 35 * (1 - (off - .1) / .3)); }
    const steps = Math.min(1, d.steps / p.stepGoal) * 25;
    const water = Math.min(1, d.water / p.waterGoal) * 15;
    const mealsLogged = Object.values(d.meals).filter(m => m.length).length;
    const logging = mealsLogged >= 2 ? 15 : mealsLogged === 1 ? 8 : 0;
    const st = streak(k).days;
    const consist = Math.min(10, st * 3.34);
    const parts = { Calories: Math.round(cal), Steps: Math.round(steps), Water: Math.round(water), Logging: logging, Streak: Math.round(consist) };
    const max = { Calories: 35, Steps: 25, Water: 15, Logging: 15, Streak: 10 };
    return { score: Math.round(Object.values(parts).reduce((a, b) => a + b, 0)), parts, max };
  });

  // ---------- streaks (with freezes: earn 1 per 7 days in a row, hold up to 2) ----------
  const loggedDays = () => { const s = new Set(); all('entry').forEach(e => s.add(e.date)); return s; };
  const streak = memo('streak', function streak(upTo) {
    upTo = upTo || dayKey();
    const days = loggedDays();
    if (!days.size) return { days: 0, freezes: 0, best: 0, usedFreeze: false };
    const first = [...days].sort()[0];
    let run = 0, best = 0, freezes = 0, sinceFreeze = 0, usedFreeze = false;
    for (let k = first; k <= upTo; k = addDays(k, 1)) {
      if (days.has(k)) { run++; sinceFreeze++; usedFreeze = false; if (sinceFreeze >= 7) { freezes = Math.min(2, freezes + 1); sinceFreeze = 0; } }
      else if (k === upTo) { /* today not logged yet — streak still alive */ }
      else if (freezes > 0 && run > 0) { freezes--; usedFreeze = true; }
      else { run = 0; sinceFreeze = 0; }
      best = Math.max(best, run);
    }
    return { days: run, freezes, best, usedFreeze, loggedToday: days.has(upTo) };
  });

  // ---------- XP, levels, badges, challenges (all derived from the log, so they sync for free) ----------
  const LEVELS = ['Rookie', 'Nibbler', 'Snack Scout', 'Meal Planner', 'Portion Pro', 'Kitchen Knight', 'Macro Master', 'Nutrition Ninja', 'Health Hero', 'BiteWise Legend'];
  const levelNeed = n => 150 * n + 50 * n * (n - 1); // XP to reach level n+1
  const allDays = memo('allDays', function allDays() {
    const s = new Set();
    Object.values(recs).forEach(r => { if (!r.deleted && r.date) s.add(r.date); });
    return [...s].sort();
  });
  const xpBreakdown = memo('xp', function xpBreakdown() {
    const p = profile(), items = [];
    let xp = 0;
    for (const k of allDays()) {
      if (k > dayKey()) continue;
      const d = day(k);
      const n = Math.min(5, d.entries.length); if (n) { xp += n * 10; }
      if (d.entries.length && k < dayKey() && Math.abs(1 - d.eaten / d.budget) <= .1) xp += 50;
      if (d.water >= p.waterGoal) xp += 15;
      if (d.steps >= p.stepGoal) xp += 25;
      if (d.weight) xp += 10;
    }
    for (const c of challengeHistory()) if (c.done) xp += c.xp;
    xp += badges().filter(b => b.earned).length * 40;
    return xp;
  });
  function level(xp = xpBreakdown()) {
    let n = 0; while (n < LEVELS.length - 1 && xp >= levelNeed(n + 1)) n++;
    const cur = levelNeed(n), next = n < LEVELS.length - 1 ? levelNeed(n + 1) : null;
    return { n: n + 1, name: LEVELS[n], xp, cur, next, pct: next ? (xp - cur) / (next - cur) : 1 };
  }

  const trend = memo('trend', function trend() {
    const ws = all('weight').sort((a, b) => a.date < b.date ? -1 : 1);
    if (!ws.length) return null;
    let t = ws[0].lb; const pts = [];
    for (const w of ws) { t = t + 0.25 * (w.lb - t); pts.push({ date: w.date, lb: w.lb, trend: Math.round(t * 10) / 10 }); }
    const last = pts[pts.length - 1];
    // rate from trend over last ~21 days
    const back = pts.filter(x => x.date >= addDays(last.date, -21));
    const span = (parseDay(last.date) - parseDay(back[0].date)) / 864e5;
    const perWeek = span >= 6 ? (last.trend - back[0].trend) / span * 7 : null;
    const p = profile();
    let eta = null;
    if (perWeek && perWeek < -0.05 && last.trend > p.goalLb) { const weeks = (last.trend - p.goalLb) / -perWeek; if (weeks < 520) { const d = parseDay(last.date); d.setDate(d.getDate() + Math.round(weeks * 7)); eta = d; } }
    return { pts, now: last.trend, first: pts[0].lb, perWeek, eta, lost: Math.round((pts[0].lb - last.trend) * 10) / 10 };
  });

  const BADGES = [
    ['first', 'First Bite', 'Log your first food', 'bite'],
    ['s3', 'Hat Trick', '3-day logging streak', 'flame'],
    ['s7', 'Week Warrior', '7-day logging streak', 'flame'],
    ['s30', 'Month Master', '30-day logging streak', 'crown'],
    ['water', 'Hydrated', 'Drink your water goal in a day', 'drop'],
    ['steps10', 'Step Star', '10,000 steps in a day', 'shoe'],
    ['target5', 'On Target', '5 days within 10% of your budget', 'target'],
    ['scale', 'Scale Brave', 'Log your weight', 'scale'],
    ['down5', 'Down 5', 'Trend weight 5 lb below your start', 'trophy'],
    ['down10', 'Double Digits', 'Trend weight 10 lb below your start', 'trophy'],
    ['voice', 'Just Say It', 'Log food with your voice', 'mic'],
    ['coach', 'Coach’s Pick', 'Chat with Bitey, your AI coach', 'spark'],
    ['early', 'Early Bird', 'Log breakfast before 9am on 5 days', 'sun'],
    ['score80', 'Glow Up', 'Health Score of 80+ in a day', 'heart'],
  ];
  const badges = memo('badges', function badges() {
    const es = all('entry'), p = profile(), st = streak(), days = allDays().filter(k => k <= dayKey());
    const tr = trend();
    let target = 0, waterDay = false, stepDay = false, score80 = false;
    for (const k of days) {
      const d = day(k);
      if (d.entries.length && k < dayKey() && Math.abs(1 - d.eaten / d.budget) <= .1) target++;
      if (d.water >= p.waterGoal) waterDay = true;
      if (d.steps >= 10000) stepDay = true;
    }
    for (const k of days.slice(-60)) if (d80(k)) { score80 = true; break; }
    function d80(k) { const d = day(k); if (!d.entries.length) return false; return healthNoStreak(k) >= 80; }
    const early = new Set(es.filter(e => e.meal === 'breakfast' && new Date(e.time).getHours() < 9).map(e => e.date)).size;
    const got = {
      first: es.length > 0, s3: st.best >= 3, s7: st.best >= 7, s30: st.best >= 30, water: waterDay, steps10: stepDay,
      target5: target >= 5, scale: all('weight').length > 0, down5: !!tr && tr.lost >= 5, down10: !!tr && tr.lost >= 10,
      voice: es.some(e => e.source === 'voice'), coach: !!LS.get('usedCoach', false) || es.some(e => e.source === 'coach'), early: early >= 5, score80,
    };
    return BADGES.map(([id, name, desc, icon]) => ({ id, name, desc, icon, earned: !!got[id] }));
  });
  // health() calls streak(); badges avoid recursion by scoring without the streak part (+10 assumed if logging).
  function healthNoStreak(k) { const h = health(k); return h.score; }

  // weekly challenge rotates by week of the year
  const CHALLENGES = [
    { id: 'water', title: 'Water Week', desc: 'Hit your water goal on 4 days', need: 4, xp: 150, test: (d, p) => d.water >= p.waterGoal },
    { id: 'steps', title: 'Step It Up', desc: 'Reach your step goal on 4 days', need: 4, xp: 150, test: (d, p) => d.steps >= p.stepGoal },
    { id: 'breakfast', title: 'Breakfast Club', desc: 'Log breakfast on 5 days', need: 5, xp: 150, test: d => d.meals.breakfast.length > 0 },
    { id: 'budget', title: 'Bullseye', desc: 'Finish 4 days within 10% of budget', need: 4, xp: 200, test: d => d.entries.length > 0 && Math.abs(1 - d.eaten / d.budget) <= .1 },
    { id: 'log3', title: 'Full Picture', desc: 'Log 3+ meals or snacks on 5 days', need: 5, xp: 150, test: d => Object.values(d.meals).filter(m => m.length).length >= 3 },
  ];
  const weekStart = (k = dayKey()) => { const d = parseDay(k); d.setDate(d.getDate() - ((d.getDay() + 6) % 7)); return dayKey(d); };
  function challengeFor(ws) {
    const n = Math.floor(parseDay(ws).getTime() / (7 * 864e5));
    const c = CHALLENGES[((n % CHALLENGES.length) + CHALLENGES.length) % CHALLENGES.length], p = profile();
    let prog = 0;
    for (let i = 0; i < 7; i++) { const k = addDays(ws, i); if (k > dayKey()) break; if (c.test(day(k), p)) prog++; }
    return { ...c, week: ws, progress: Math.min(prog, c.need), done: prog >= c.need, daysLeft: 7 - Math.min(7, Math.round((parseDay(dayKey()) - parseDay(ws)) / 864e5) + 1) };
  }
  const challengeHistory = memo('ch', function challengeHistory() {
    const days = allDays(); if (!days.length) return [];
    const out = []; for (let ws = weekStart(days[0]); ws <= weekStart(); ws = addDays(ws, 7)) out.push(challengeFor(ws));
    return out;
  });

  const frequent = () => {
    const m = new Map();
    all('entry').slice(-300).forEach(e => { if (!e.name || e.name === 'Quick add') return; const k = e.name.toLowerCase() + '|' + e.calories; const c = m.get(k) || { name: e.name, calories: e.calories, n: 0, meal: e.meal }; c.n++; m.set(k, c); });
    return [...m.values()].filter(x => x.n >= 1).sort((a, b) => b.n - a.n).slice(0, 8);
  };
  const recentAmounts = () => { const s = []; all('entry').sort((a, b) => b.time - a.time).forEach(e => { if (!s.includes(e.calories) && e.calories > 0) s.push(e.calories); }); return s.slice(0, 4); };

  function mealForNow(d = new Date()) { const h = d.getHours() + d.getMinutes() / 60; return h < 10.5 ? 'breakfast' : h < 15 ? 'lunch' : h < 17 ? 'snack' : h < 21 ? 'dinner' : 'snack'; }
  function addEntry({ date = dayKey(), meal, name, calories, source = 'quick', allergens }) {
    const t = date === dayKey() ? Date.now() : parseDay(date).getTime() + 12 * 3600e3;
    return put({ id: 'e:' + uid(), kind: 'entry', date, time: t, meal: meal || mealForNow(), name: (name || 'Quick add').slice(0, 80), calories: Math.max(0, Math.round(+calories || 0)), source, ...(allergens && allergens.length ? { allergens: allergens.slice(0, 9) } : {}) });
  }

  // ---------- account + sync ----------
  const acct = () => LS.get('account', null);
  let syncT = null, syncing = false, lastSyncErr = null;
  function scheduleSync(ms = 1500) { if (!acct()) return; clearTimeout(syncT); syncT = setTimeout(sync, ms); }
  async function api(path, body, method = 'POST') {
    const a = acct();
    const r = await fetch('/api/' + path, { method, headers: { 'Content-Type': 'application/json', ...(a ? { Authorization: 'Bearer ' + a.token } : {}) }, body: method === 'GET' ? undefined : JSON.stringify(body || {}) });
    const j = await r.json().catch(() => ({}));
    if (!r.ok) throw Object.assign(new Error(j.error || 'Request failed (' + r.status + ')'), { status: r.status });
    return j;
  }
  async function sync() {
    const a = acct(); if (!a || syncing || !navigator.onLine) return;
    syncing = true; emit();
    try {
      const ids = [...dirty];
      let res = await api('sync', { since: LS.get('seq', 0), changes: ids.map(id => recs[id]).filter(Boolean) });
      const all = [...res.records];
      for (let g = 0; g < 50 && res.records.length >= 5000; g++) { res = await api('sync', { since: res.seq, changes: [] }); all.push(...res.records); }
      res = { ...res, records: all };
      ids.forEach(id => dirty.delete(id));
      let changed = false;
      for (const r of res.records) { const cur = recs[r.id]; if (!cur || (r.updatedAt || 0) > (cur.updatedAt || 0)) { recs[r.id] = r; changed = true; } }
      LS.set('seq', res.seq); LS.set('lastSync', Date.now()); lastSyncErr = null;
      persist(); if (changed) emit();
    } catch (e) { lastSyncErr = e.message; if (e.status === 401) { LS.del('account'); } }
    syncing = false; emit();
  }
  async function signIn(mode, username, password) {
    const j = await api(mode === 'signup' ? 'signup' : 'login', { username, password });
    LS.set('account', { token: j.token, username: j.username }); LS.set('seq', 0);
    let serverProfile = false;
    if (mode !== 'signup') {
      // Signing in on another device: the cloud copy wins for goals/settings, and everything else merges.
      let since = 0;
      for (let guard = 0; guard < 50; guard++) {
        const res = await api('sync', { since, changes: [] });
        for (const r of res.records) {
          if (r.id === 'profile') { recs.profile = r; serverProfile = true; continue; }
          const cur = recs[r.id]; if (!cur || (r.updatedAt || 0) > (cur.updatedAt || 0)) recs[r.id] = r;
        }
        since = res.seq; if (res.records.length < 5000) break;
      }
      LS.set('seq', since);
    }
    Object.keys(recs).forEach(id => { if (!(id === 'profile' && serverProfile)) dirty.add(id); });
    persist(); emit();
    await sync(); return { ...j, restored: serverProfile };
  }
  async function signOut() { try { await api('logout'); } catch {} LS.del('account'); LS.del('seq'); emit(); }

  // An automatic account is created behind the scenes the first time something needs the cloud (like Fitbit),
  // so nobody has to sign up just to connect steps. It can be turned into a real login later.
  async function ensureAccount() {
    if (acct()) return acct();
    const rand = n => Array.from(crypto.getRandomValues(new Uint8Array(n)), b => 'abcdefghijkmnpqrstuvwxyz23456789'[b % 32]).join('');
    const username = 'bw-' + rand(12), password = rand(24);
    const j = await api('signup', { username, password });
    LS.set('account', { token: j.token, username: j.username, auto: true }); LS.set('seq', 0);
    Object.keys(recs).forEach(id => dirty.add(id)); persist(); await sync();
    return acct();
  }
  async function claimAccount(username, password) {
    const j = await api('account/claim', { username, password });
    LS.set('account', { ...acct(), username: j.username, auto: false }); emit(); return j;
  }

  let pulling = null;
  async function pullHealth() {
    if (pulling) return pulling;
    pulling = (async () => {
      const today = dayKey();
      const j = await api('health/pull', { start: addDays(today, -13), end: addDays(today, 1) });
      let changed = 0;
      for (const s of j.steps) if (s.date <= today && (s.steps !== stepsOn(s.date) || stepSource(s.date) !== 'fitbit') && (s.steps > 0 || stepSource(s.date) === 'fitbit')) { setSteps(s.date, s.steps, 'fitbit'); changed++; }
      for (const w of j.weights || []) if (!weightOn(w.date)) setWeight(w.date, w.lb);
      LS.set('healthPulled', Date.now());
      emit();
      return { changed, today: stepsOn(today) };
    })();
    try { return await pulling; } finally { pulling = null; }
  }

  function exportCSV() {
    const rows = [['date', 'time', 'meal', 'food', 'calories', 'source']];
    all('entry').sort((a, b) => a.time - b.time).forEach(e => rows.push([e.date, new Date(e.time).toLocaleTimeString(), e.meal, e.name, e.calories, e.source]));
    rows.push([]); rows.push(['date', 'weight_lb', 'steps', 'water_glasses']);
    allDays().forEach(k => rows.push([k, weightOn(k) || '', stepsOn(k) || '', waterOn(k) || '']));
    return rows.map(r => r.map(v => /[",\n]/.test(String(v)) ? `"${String(v).replace(/"/g, '""')}"` : v).join(',')).join('\n');
  }
  function wipe() { recs = {}; dirty = new Set(); ['records', 'dirty', 'seq', 'lastSync', 'usedCoach', 'coachChat', 'healthPulled', 'healthLinked', 'seenLevel', 'seenBadges', 'seenChallenge'].forEach(LS.del); emit(); }

  // Demo data so a first-time visitor sees a lived-in app (clearly removable from Me → Delete all data)
  function seedDemo() {
    const today = dayKey(), p = { ...DEFAULT_PROFILE, name: '', setup: true, sex: 'male', age: 34, heightIn: 70, weightLb: 192, goalLb: 175, activity: 1.375, pace: 1, demo: true };
    recs.profile = { ...p, updatedAt: Date.now() };
    const meals = [
      ['breakfast', [['Oatmeal', 160], ['Banana', 105], ['Coffee with milk', 40]], [['2 eggs', 155], ['Toast with butter', 115]], [['Greek yogurt', 150], ['Granola', 240]]],
      ['lunch', [['Turkey sandwich', 350], ['Apple', 95]], [['Chipotle bowl', 650]], [['Chicken wrap', 450], ['Chips', 150]], [['Caesar salad', 360]]],
      ['dinner', [['Grilled chicken', 230], ['Rice', 205], ['Broccoli', 55]], [['2 slices pizza', 570], ['Side salad', 120]], [['Salmon', 370], ['Sweet potato', 115]], [['Spaghetti', 480]]],
      ['snack', [['Protein bar', 210]], [['Popcorn', 130]], [['String cheese', 80]], [['Cookie', 150]]],
    ];
    let seed = 11; const rnd = () => (seed = (seed * 9301 + 49297) % 233280) / 233280;
    for (let i = 20; i >= 0; i--) {
      const k = addDays(today, -i), base = parseDay(k).getTime();
      if (i === 9) continue; // one missed day (streak freeze shows up)
      for (const [meal, ...opts] of meals) {
        if (i === 0 && (meal === 'dinner' || meal === 'snack')) continue;
        if (meal === 'snack' && rnd() < .4) continue;
        const pick = opts[Math.floor(rnd() * opts.length)];
        const hr = { breakfast: 7.5, lunch: 12.5, dinner: 18.5, snack: 15.5 }[meal];
        pick.forEach(([name, calories]) => { const id = 'e:' + uid(); recs[id] = { id, kind: 'entry', date: k, time: base + hr * 3600e3, meal, name, calories, source: rnd() < .3 ? 'voice' : 'quick', updatedAt: Date.now() }; });
      }
      recs['water:' + k] = { id: 'water:' + k, kind: 'water', date: k, glasses: i === 0 ? 4 : 4 + Math.floor(rnd() * 5), updatedAt: Date.now() };
      recs['steps:' + k] = { id: 'steps:' + k, kind: 'steps', date: k, steps: i === 0 ? 5230 : 4500 + Math.floor(rnd() * 8000), source: 'manual', updatedAt: Date.now() };
      if (i % 2 === 0) recs['weight:' + k] = { id: 'weight:' + k, kind: 'weight', date: k, lb: Math.round((192 - (20 - i) * 0.21 + (rnd() - .5) * 1.6) * 10) / 10, updatedAt: Date.now() };
    }
    Object.keys(recs).forEach(id => dirty.add(id));
    persist(); emit();
  }

  window.BW = {
    LS, dayKey, parseDay, addDays, uid, put, remove, all, get: id => recs[id], profile, saveProfile, goals, day, health, streak, level, LEVELS, xpBreakdown, badges, trend,
    challenge: () => challengeFor(weekStart()), weekStart, frequent, recentAmounts, mealForNow, addEntry, entriesOn,
    setWater, setSteps, setWeight, stepBonus, PACE_PRESETS, paceSettings, paceShare, paceNow, stepSource, acct, sync, signIn, signOut, api, ensureAccount, claimAccount, pullHealth, exportCSV, wipe, seedDemo,
    get syncing() { return syncing; }, get syncError() { return lastSyncErr; }, get dirtyCount() { return dirty.size; },
    on: f => listeners.add(f), hasData: () => Object.keys(recs).length > 0,
  };
  window.addEventListener('online', () => scheduleSync(300));
})();
