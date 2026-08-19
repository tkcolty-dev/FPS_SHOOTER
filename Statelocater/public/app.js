/* StateLocater — learn the 50 states + capitals in 4 weeks. Vanilla JS, no build. */
(async function () {
'use strict';
const $ = (s, r = document) => r.querySelector(s);
const h = (tag, attrs = {}, ...kids) => { const e = document.createElement(tag); for (const [k, v] of Object.entries(attrs)) { if (k === 'class') e.className = v; else if (k === 'html') e.innerHTML = v; else if (k.startsWith('on')) e.addEventListener(k.slice(2), v); else if (v !== false && v != null) e.setAttribute(k, v); } for (const k of kids.flat()) if (k != null) e.append(k.nodeType ? k : document.createTextNode(k)); return e; };
const shuffle = (a) => { a = a.slice(); for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; };
const pick = (a) => a[Math.floor(Math.random() * a.length)];
const DAY = 864e5;
const dayKey = (d = new Date()) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
const dayStart = (offsetDays = 0) => { const d = new Date(); d.setHours(0, 0, 0, 0); return d.getTime() + offsetDays * DAY; };
const keyToDate = (k) => { const [y, m, d] = k.split('-').map(Number); return new Date(y, m - 1, d); };
const fmtDate = (d) => d.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });

// ---------------- data ----------------
const DATA = await fetch('states.json?v=2').then(r => r.json());
const STATES = DATA.states;
const BY = {}; STATES.forEach(s => BY[s.abbr] = s);
const REGION_NAME = { PW: 'Pacific', MT: 'Mountain', GP: 'Plains & South Central', MW: 'Midwest', SE: 'Southeast', MA: 'Mid-Atlantic', NE: 'New England' };
const ORDER = ['CA', 'WA', 'OR', 'AK', 'HI', 'NV', 'ID', 'MT', 'WY', 'UT', 'CO', 'AZ', 'NM', 'TX', 'OK', 'KS', 'NE', 'SD', 'ND', 'AR', 'LA', 'MN', 'IA', 'MO', 'WI', 'IL', 'MI', 'IN', 'OH', 'KY', 'TN', 'MS', 'AL', 'GA', 'FL', 'SC', 'NC', 'VA', 'WV', 'PA', 'NY', 'NJ', 'DE', 'MD', 'CT', 'RI', 'MA', 'VT', 'NH', 'ME'];
const MNEMO = {
AL:'Montgomery — where Rosa Parks rode the bus. Ala-BAMA drama, Mont-GOMERY.', AK:'"Do you know (Juneau) Alaska\'s capital?" Yes — Juneau!', AZ:'A Phoenix rises from the hot Arizona desert sun.', AR:'Arkansas ROCKS… just a Little Rock.', CA:'A SACK of California tomatoes — SACramento.', CO:'Denver, the Mile-High City in the Colorado Rockies.', CT:'Connecticut connects to your HEART — Hartford.', DE:'Delaware: drive over to DOVER.', FL:'TALL Florida palm trees in Tallahassee.', GA:'Georgia peach → Atlanta, the world\'s busiest airport.', HI:'Hawaii: do the hula in Honolulu.', ID:'Idaho potatoes — "BOY-see" those spuds! Boise.', IL:'Illinois: Abraham Lincoln\'s Springfield.', IN:'Indiana + polis (city) = Indianapolis.', IA:'Iowa: "Des Moines" = day-MOYN, out in the corn.', KS:'Kansas: Toto PEEKED out of the basket — ToPEKA.', KY:'Kentucky: be FRANK, it\'s Frankfort (not Louisville!).', LA:'Louisiana: "Baton Rouge" is French for red stick.', ME:'Maine: August is the month to visit Augusta.', MD:'Maryland: Anna at the Naval Academy — Annapolis.', MA:'Massachusetts: the Boston Tea Party.', MI:'Michigan is a mitten — Lansing sits in the palm.', MN:'Minnesota: Saint Paul, the twin of Minneapolis.', MS:'Mississippi: Jackson — say it with rhythm: Missis-sippi Jack-son.', MO:'Missouri: Jefferson City, right on the Missouri River.', MT:'Montana: HELEN-a of the mountains.', NE:'Nebraska: Abe Lincoln standing in the cornfields.', NV:'Nevada: NOT Las Vegas — Carson City, near Lake Tahoe.', NH:'New Hampshire: Concord grapes.', NJ:'New Jersey: Washington crossed the Delaware to Trenton.', NM:'New Mexico: Santa Fe ("holy faith"), the oldest US capital.', NY:'New York: NOT NYC — Albany, up the Hudson River.', NC:'North Carolina: Sir Walter Raleigh.', ND:'North Dakota: Bismarck, like the German chancellor.', OH:'Ohio: Columbus sailed to O-hi-o.', OK:'Oklahoma → just add "City": Oklahoma City.', OR:'Oregon: Salem (not the witch-trial one — that\'s Massachusetts).', PA:'Pennsylvania: NOT Philly — Harrisburg.', RI:'Rhode Island: Providence, the tiny state\'s big city.', SC:'South Carolina: Columbia (Columbus + -ia).', SD:'South Dakota: Pierre — said like "peer".', TN:'Tennessee: country music capital, Nashville.', TX:'Texas: Austin — keep it weird.', UT:'Utah: the Great Salt Lake → Salt Lake City.', VT:'Vermont = Green MOUNTain → MONTpelier, the smallest capital.', VA:'Virginia: Richmond, rich in history.', WA:'Washington: Mount Olympus → Olympia.', WV:'West Virginia: Charleston (the other Charleston is in SC, but it\'s not SC\'s capital).', WI:'Wisconsin: James MADISON loves cheese. Madison.', WY:'Wyoming: Cheyenne, home of the big rodeo.' };
const INTERVALS = [0, 1, 2, 4, 7, 14, 30]; // days by box
const PLAN_DAYS = 28;

// ---------------- progress ----------------
const LS = 'statelocater.v1';
function defaultP() { return { v: 1, created: Date.now(), updatedAt: Date.now(), startDate: dayKey(), settings: { newPerDay: 4, sound: true }, cards: {}, intro: {}, days: {}, xp: 0, streak: 0, lastDone: null, tests: [], best: null, onboarded: false }; }
let P = (() => { try { const p = JSON.parse(localStorage.getItem(LS)); if (p && p.cards) return Object.assign(defaultP(), p); } catch {} return defaultP(); })();
let user = null, pushTimer = null;
function save(push = true) { P.updatedAt = Date.now(); localStorage.setItem(LS, JSON.stringify(P)); if (push && user) { clearTimeout(pushTimer); pushTimer = setTimeout(pushProgress, 1200); } refreshHeader(); }
async function pushProgress() {
  if (!user) return;
  try { const r = await fetch('/api/progress', { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ progress: P }) }).then(r => r.json());
    if (r.stale && r.progress) { P = Object.assign(defaultP(), r.progress); localStorage.setItem(LS, JSON.stringify(P)); toast('Loaded newer progress from the cloud'); render(); }
    if (r.error === 'not signed in') { user = null; refreshHeader(); }
  } catch (e) { /* offline: local copy stays */ }
}
async function initAccount() {
  try { const me = await fetch('/api/me').then(r => r.json()); if (me.user) { user = me.user; adoptServer(me.progress); } } catch {}
  refreshHeader();
}
function adoptServer(sp) {
  if (sp && sp.cards && (!P.onboarded || sp.updatedAt >= P.updatedAt)) { P = Object.assign(defaultP(), sp); localStorage.setItem(LS, JSON.stringify(P)); }
  else if (P.onboarded) pushProgress();
}
const card = (abbr, kind) => P.cards[abbr + ':' + kind] || (P.cards[abbr + ':' + kind] = { box: 0, due: 0, seen: 0, right: 0, wrong: 0 });
const introduced = (abbr) => P.intro[abbr] != null;
const learnedList = () => ORDER.filter(introduced);
const CAP_DELAY = 2; // days after meeting a state before its capital is introduced
const capReady = (abbr) => introduced(abbr) && (card(abbr, 'cap').unlock || 0) <= dayStart() + DAY - 1;
const capLearned = (abbr) => card(abbr, 'cap').box >= 1;
const knownList = () => ORDER.filter(a => introduced(a) && card(a, 'loc').box >= 1);
const mastery = (abbr) => { if (!introduced(abbr)) return 0; const l = card(abbr, 'loc').box, c = card(abbr, 'cap'); const b = capReady(abbr) ? Math.min(l, c.box) : Math.min(l, 2); return Math.min(5, b); };
const CHECKPOINTS = [10, 20, 30, 40, 50];
function nextCheckpoint() { const n = knownList().length; P.checkpoints = P.checkpoints || {}; for (const k of CHECKPOINTS) { const c = P.checkpoints[k]; if (n >= k && !(c && (c.done || c.skipped))) return k; } return null; }
const pendingNew = () => ORDER.filter(a => introduced(a) && card(a, 'loc').box === 0);
function introduce(a) { P.intro[a] = dayNum(); card(a, 'loc'); const c = card(a, 'cap'); if (c.unlock == null) c.unlock = dayStart(CAP_DELAY); }
const stars = (n) => '★'.repeat(n) + '☆'.repeat(5 - n);
const dayNum = () => Math.max(1, Math.floor((dayStart() - keyToDate(P.startDate).getTime()) / DAY) + 1);
const levelOf = (xp) => Math.floor(Math.sqrt(xp / 40)) + 1;

function refreshHeader() {
  $('#st-day').textContent = `Day ${Math.min(dayNum(), 99)}`;
  $('#st-streak').textContent = P.streak || 0;
  $('#st-xp').textContent = P.xp || 0;
  $('#acct-btn').textContent = user ? `👤 ${user}` : 'Sign in';
}

// ---------------- utils ----------------
function toast(msg, ms = 2200) { const t = $('#toast'); t.textContent = msg; t.classList.add('show'); clearTimeout(t._t); t._t = setTimeout(() => t.classList.remove('show'), ms); }
const norm = (s) => String(s || '').toLowerCase().replace(/\bst\.?\b/g, 'saint').replace(/[^a-z]/g, '');
function lev(a, b) { const m = a.length, n = b.length; if (!m) return n; if (!n) return m; let prev = Array.from({ length: n + 1 }, (_, i) => i); for (let i = 1; i <= m; i++) { const cur = [i]; for (let j = 1; j <= n; j++) cur[j] = Math.min(prev[j] + 1, cur[j - 1] + 1, prev[j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1)); prev = cur; } return prev[n]; }
// returns 'exact' | 'close' | false
function matches(input, answer, others = []) {
  const a = norm(input), b = norm(answer); if (!a) return false; if (a === b) return 'exact';
  if (others.some(o => norm(o) === a)) return false; // typed a different real answer
  const tol = b.length <= 4 ? 0 : b.length <= 7 ? 1 : 2;
  return lev(a, b) <= tol ? 'close' : false;
}
let actx; function beep(kind) { if (!P.settings.sound) return; try { actx = actx || new (window.AudioContext || window.webkitAudioContext)(); const o = actx.createOscillator(), g = actx.createGain(); o.connect(g); g.connect(actx.destination); const t = actx.currentTime; if (kind === 'good') { o.frequency.setValueAtTime(660, t); o.frequency.setValueAtTime(880, t + .09); g.gain.setValueAtTime(.12, t); g.gain.exponentialRampToValueAtTime(.001, t + .25); o.start(t); o.stop(t + .26); } else if (kind === 'bad') { o.type = 'triangle'; o.frequency.setValueAtTime(220, t); o.frequency.linearRampToValueAtTime(160, t + .2); g.gain.setValueAtTime(.12, t); g.gain.exponentialRampToValueAtTime(.001, t + .3); o.start(t); o.stop(t + .31); } else { o.frequency.setValueAtTime(523, t); o.frequency.setValueAtTime(659, t + .1); o.frequency.setValueAtTime(784, t + .2); o.frequency.setValueAtTime(1047, t + .3); g.gain.setValueAtTime(.12, t); g.gain.exponentialRampToValueAtTime(.001, t + .7); o.start(t); o.stop(t + .71); } } catch {} }
function confetti() { const c = h('canvas', { class: 'confetti' }); document.body.append(c); const ctx = c.getContext('2d'); c.width = innerWidth; c.height = innerHeight; const ps = Array.from({ length: 140 }, () => ({ x: Math.random() * c.width, y: -20 - Math.random() * c.height * .5, vx: (Math.random() - .5) * 3, vy: 2 + Math.random() * 4, r: 4 + Math.random() * 5, c: pick(['#ff7a1a', '#2fb16d', '#ffd08a', '#6fa8ff', '#e5484d', '#ffe066']), a: Math.random() * 6 })); let t0 = performance.now(); (function f(now) { ctx.clearRect(0, 0, c.width, c.height); for (const p of ps) { p.x += p.vx; p.y += p.vy; p.a += .1; ctx.save(); ctx.translate(p.x, p.y); ctx.rotate(p.a); ctx.fillStyle = p.c; ctx.fillRect(-p.r / 2, -p.r / 2, p.r, p.r * .6); ctx.restore(); } if (now - t0 < 2600) requestAnimationFrame(f); else c.remove(); })(t0); }

// ---------------- map component ----------------
function makeMap(host, opts = {}) {
  const NS = 'http://www.w3.org/2000/svg';
  const el = (t, a = {}) => { const e = document.createElementNS(NS, t); for (const [k, v] of Object.entries(a)) e.setAttribute(k, v); return e; };
  host.classList.add('mapwrap'); host.innerHTML = '';
  const W = DATA.width, H = DATA.height;
  const svg = el('svg', { viewBox: `0 0 ${W} ${H}` });
  svg.append(el('path', { d: DATA.nation, class: 'nation' }));
  const gS = el('g'), gL = el('g'); const paths = {}, labels = {};
  for (const s of STATES) { const p = el('path', { d: s.d, class: 'st', 'data-abbr': s.abbr }); paths[s.abbr] = p; gS.append(p); }
  svg.append(gS, el('path', { d: DATA.mesh, class: 'mesh' }), el('path', { d: DATA.nation, class: 'outline' }), gL);
  host.append(svg);
  let vb = { x: 0, y: 0, w: W, h: H };
  const apply = () => svg.setAttribute('viewBox', `${vb.x} ${vb.y} ${vb.w} ${vb.h}`);
  const clamp = () => { vb.w = Math.min(W, Math.max(W / 12, vb.w)); vb.h = vb.w * H / W; vb.x = Math.min(W - vb.w, Math.max(0, vb.x)); vb.y = Math.min(H - vb.h, Math.max(0, vb.y)); apply(); };
  const toSvg = (cx, cy) => { const r = svg.getBoundingClientRect(); return { x: vb.x + (cx - r.left) / r.width * vb.w, y: vb.y + (cy - r.top) / r.height * vb.h }; };
  const zoomAt = (cx, cy, f) => { const p = toSvg(cx, cy); vb.x = p.x - (p.x - vb.x) * f; vb.y = p.y - (p.y - vb.y) * f; vb.w *= f; vb.h *= f; clamp(); };
  if (opts.tools !== false) { const tools = h('div', { class: 'tools' }); const r = svg.getBoundingClientRect; tools.append(h('button', { title: 'Zoom in', onclick: () => { const b = svg.getBoundingClientRect(); zoomAt(b.left + b.width / 2, b.top + b.height / 2, .6); } }, '+'), h('button', { title: 'Zoom out', onclick: () => { const b = svg.getBoundingClientRect(); zoomAt(b.left + b.width / 2, b.top + b.height / 2, 1.6); } }, '−'), h('button', { title: 'Zoom to the Northeast (small states)', style: 'font-size:11px', onclick: () => api.zoomRegion(['ME', 'NH', 'VT', 'MA', 'RI', 'CT', 'NY', 'NJ', 'PA', 'DE', 'MD']) }, 'NE'), h('button', { title: 'Reset view', onclick: () => api.reset() }, '⟲')); host.append(tools); }
  host.append(h('div', { class: 'hint' }, 'pinch / scroll to zoom · drag to pan'));
  // pointer handling
  const pts = new Map(); let moved = false, start = null, pinch0 = null;
  host.addEventListener('pointerdown', e => { pts.set(e.pointerId, { x: e.clientX, y: e.clientY }); moved = false; start = { x: e.clientX, y: e.clientY, vb: { ...vb } }; if (pts.size === 2) { const [a, b] = [...pts.values()]; pinch0 = { d: Math.hypot(a.x - b.x, a.y - b.y), vb: { ...vb }, cx: (a.x + b.x) / 2, cy: (a.y + b.y) / 2 }; } });
  host.addEventListener('pointermove', e => { if (!pts.has(e.pointerId)) return; pts.set(e.pointerId, { x: e.clientX, y: e.clientY }); const r = svg.getBoundingClientRect(); if (pts.size === 1 && start) { const dx = e.clientX - start.x, dy = e.clientY - start.y; if (Math.hypot(dx, dy) > 6) moved = true; if (moved) { vb.x = start.vb.x - dx / r.width * vb.w; vb.y = start.vb.y - dy / r.height * vb.h; clamp(); } } else if (pts.size === 2 && pinch0) { moved = true; const [a, b] = [...pts.values()]; const d = Math.hypot(a.x - b.x, a.y - b.y); const f = pinch0.d / Math.max(1, d); const p0 = { x: pinch0.vb.x + (pinch0.cx - r.left) / r.width * pinch0.vb.w, y: pinch0.vb.y + (pinch0.cy - r.top) / r.height * pinch0.vb.h }; vb.w = pinch0.vb.w * f; vb.h = pinch0.vb.h * f; const cx = (a.x + b.x) / 2, cy = (a.y + b.y) / 2; vb.x = p0.x - (cx - r.left) / r.width * vb.w; vb.y = p0.y - (cy - r.top) / r.height * vb.h; clamp(); } });
  const up = e => { if (!pts.has(e.pointerId)) return; pts.delete(e.pointerId); if (pts.size === 0) { if (!moved && opts.onTap && e.type === 'pointerup') { const t = document.elementFromPoint(e.clientX, e.clientY); const ab = t && t.getAttribute && t.getAttribute('data-abbr'); opts.onTap(ab || null, e); } start = null; pinch0 = null; } else if (pts.size === 1) { const [k] = pts.keys(); const p = pts.get(k); start = { x: p.x, y: p.y, vb: { ...vb } }; pinch0 = null; } };
  host.addEventListener('pointerup', up); host.addEventListener('pointercancel', up); host.addEventListener('pointerleave', e => { if (pts.has(e.pointerId)) up(e); });
  host.addEventListener('wheel', e => { e.preventDefault(); zoomAt(e.clientX, e.clientY, e.deltaY > 0 ? 1.15 : .87); }, { passive: false });
  host.addEventListener('dblclick', e => { e.preventDefault(); zoomAt(e.clientX, e.clientY, .5); });
  const api = {
    svg, paths,
    set(abbr, cls) { const p = paths[abbr]; if (p) p.setAttribute('class', 'st' + (cls ? ' ' + cls : '')); },
    add(abbr, cls) { paths[abbr]?.classList.add(cls); }, remove(abbr, cls) { paths[abbr]?.classList.remove(cls); },
    clear() { for (const a in paths) paths[a].setAttribute('class', 'st'); },
    label(abbr, text) { const s = BY[abbr]; if (labels[abbr]) { labels[abbr].remove(); delete labels[abbr]; } if (!text) return; const fs = Math.max(6.5, Math.min(15, Math.sqrt(s.area) / 7)); const t = el('text', { x: s.cx, y: s.cy, class: 'lbl', 'font-size': fs }); t.textContent = text; labels[abbr] = t; gL.append(t); },
    clearLabels() { for (const a in labels) labels[a].remove(); for (const a in labels) delete labels[a]; },
    reset() { vb = { x: 0, y: 0, w: W, h: H }; apply(); },
    zoomTo(abbr, pad = 2.2) { const b = BY[abbr].bbox; const bw = b[2] - b[0], bh = b[3] - b[1]; let w = Math.max(bw * pad, 140); let hh = w * H / W; if (bh * pad > hh) { hh = bh * pad; w = hh * W / H; } vb = { x: (b[0] + b[2]) / 2 - w / 2, y: (b[1] + b[3]) / 2 - hh / 2, w, h: hh }; clamp(); },
    zoomRegion(abbrs) { let x0 = 1e9, y0 = 1e9, x1 = -1e9, y1 = -1e9; abbrs.forEach(a => { const b = BY[a].bbox; x0 = Math.min(x0, b[0]); y0 = Math.min(y0, b[1]); x1 = Math.max(x1, b[2]); y1 = Math.max(y1, b[3]); }); let w = (x1 - x0) * 1.4, hh = w * H / W; if ((y1 - y0) * 1.4 > hh) { hh = (y1 - y0) * 1.4; w = hh * W / H; } vb = { x: (x0 + x1) / 2 - w / 2, y: (y0 + y1) / 2 - hh / 2, w, h: hh }; clamp(); },
  };
  return api;
}

// ---------------- session engine ----------------
let session = null; // { queue:[], i, total, answered, correct, xp, newAbbrs }
function ensureDay(k) { return P.days[k] || (P.days[k] = { newIntro: [], reviews: 0, correct: 0, xp: 0, done: false }); }
function dueCards() { const now = dayStart() + DAY - 1; const out = []; for (const [k, c] of Object.entries(P.cards)) { if (c.box >= 1 && c.due <= now) { const [abbr, kind] = k.split(':'); if (introduced(abbr)) out.push({ abbr, kind, c }); } } return out; }
function pickNew(n) { return ORDER.filter(a => !introduced(a)).slice(0, n); }
function qFor(abbr, kind, box) {
  if (kind === 'loc') { const pName = Math.min(.9, .25 + box * .15); return { type: Math.random() < pName ? 'name' : 'find', abbr, kind }; }
  if (box <= 1) return { type: 'capmc', abbr, kind }; if (box >= 4 && Math.random() < .35) return { type: 'rev', abbr, kind }; return { type: 'cap', abbr, kind };
}
function buildSession(extraNew = false) {
  const today = dayKey(); const d = ensureDay(today);
  let newAbbrs;
  if (extraNew) { const add = pickNew(P.settings.newPerDay); add.forEach(introduce); d.newIntro.push(...add); newAbbrs = pendingNew(); }
  else {
    if (!d.newIntro.length && !d.done && !nextCheckpoint()) { const add = pickNew(P.settings.newPerDay); add.forEach(introduce); d.newIntro.push(...add); }
    newAbbrs = pendingNew();
  }
  const capNew = ORDER.filter(a => capReady(a) && !capLearned(a) && card(a, 'loc').box >= 1 && !newAbbrs.includes(a));
  const due = shuffle(dueCards()).filter(x => !newAbbrs.includes(x.abbr) && !(x.kind === 'cap' && capNew.includes(x.abbr)));
  const q = [];
  for (const a of newAbbrs) q.push({ type: 'learn', abbr: a }, { type: 'find', abbr: a, kind: 'loc', practice: true }, { type: 'name', abbr: a, kind: 'loc' });
  for (const a of capNew) q.push({ type: 'learncap', abbr: a }, { type: 'capmc', abbr: a, kind: 'cap' });
  for (const x of due) q.push(qFor(x.abbr, x.kind, x.c.box));
  session = { queue: q, i: 0, total: q.length, answered: 0, correct: 0, xp: 0, newAbbrs, capNew, day: today };
  save();
}
function buildPractice(abbrs, label) {
  const q = [];
  for (const a of shuffle(abbrs)) { const kinds = [{ type: 'find', kind: 'loc' }, { type: 'name', kind: 'loc' }]; if (!introduced(a) || !capLearned(a)) { q.push({ type: 'learn', abbr: a, full: true }); kinds.push({ type: 'capmc', kind: 'cap' }); } else kinds.push({ type: 'capmc', kind: 'cap' }, { type: 'cap', kind: 'cap' }); q.push({ ...pick(kinds), abbr: a, practice: true }); }
  session = { queue: q, i: 0, total: q.length, answered: 0, correct: 0, xp: 0, newAbbrs: [], day: dayKey(), practice: true, label };
}
function grade(abbr, kind, ok, { practice, hint } = {}) {
  const c = card(abbr, kind); const d = ensureDay(dayKey());
  if (!practice) { c.seen++; d.reviews++; if (ok) { c.right++; d.correct++; if (c.lapsed) { c.lapsed = false; c.due = dayStart(1); } else { c.box = Math.min(6, c.box + 1); c.due = dayStart(INTERVALS[c.box]); } } else { c.wrong++; c.lapsed = true; c.box = Math.max(1, Math.ceil(c.box / 2)); c.due = dayStart(); } }
  const gain = ok ? (hint ? 5 : 10) : 0; P.xp += gain; d.xp += gain; session.xp += gain; session.answered++; if (ok) session.correct++;
  save(); return gain;
}
function finishSession() {
  if (session.practice) { save(); beep('win'); confetti(); return; }
  const d = ensureDay(dayKey()); const wasDone = d.done; d.done = true;
  if (!wasDone) { const y = dayKey(new Date(Date.now() - DAY)); P.streak = (P.lastDone === y) ? (P.streak || 0) + 1 : (P.lastDone === dayKey() ? P.streak : 1); P.lastDone = dayKey(); }
  save(); beep('win'); confetti();
}

// ---------------- views ----------------
const view = $('#view'); let tab = 'today'; let currentMap = null;
function render(t) { if (t) tab = t; document.querySelectorAll('#nav button').forEach(b => b.classList.toggle('on', b.dataset.tab === tab)); view.innerHTML = ''; window.scrollTo(0, 0); ({ today: renderToday, map: renderMap, test: renderTest, plan: renderPlan })[tab](); refreshHeader(); }
document.querySelectorAll('#nav button').forEach(b => b.onclick = () => { session = null; if (b.dataset.tab !== 'test') { if (test && !test.checked && !confirm('Leave the test? Progress on it will be lost.')) return; test = null; } render(b.dataset.tab); });

// ---- onboarding ----
function renderOnboard() {
  const box = h('div', { class: 'card' },
    h('h1', {}, 'Learn all 50 states & capitals in 4 weeks 🇺🇸'),
    h('p', {}, 'A few new states every day, placed on a real map. Old ones come back right before you\'d forget them (spaced repetition). By week 3 you\'ll be filling in the whole map from memory.'),
    h('h3', {}, 'How many new states per day?'),
    h('div', { class: 'row', id: 'pace' }, [3, 4, 5].map(n => h('button', { class: 'btn sec small', 'data-n': n, onclick: (e) => { P.settings.newPerDay = n; document.querySelectorAll('#pace .btn').forEach(b => b.classList.toggle('good', +b.dataset.n === n)); $('#pace-note').textContent = `All 50 learned by day ${Math.ceil(50 / n)}, then ${28 - Math.ceil(50 / n)} days of review + map tests.`; } }, `${n} / day`))),
    h('p', { class: 'muted', id: 'pace-note' }, ''),
    h('p', {}, h('b', {}, 'Each day: '), 'review what\'s due (5–10 min) → meet today\'s new states → quick quiz. Miss a day? No problem, it just piles up a bit.'),
    h('div', { class: 'row' }, h('button', { class: 'btn', onclick: () => { P.onboarded = true; P.startDate = dayKey(); save(); render('today'); } }, 'Start Day 1 →'), h('button', { class: 'btn sec', onclick: accountModal }, user ? `Signed in as ${user}` : 'Sign in to save to cloud')),
  );
  view.append(box); $(`#pace .btn[data-n="${P.settings.newPerDay}"]`).click();
}

// ---- Today ----
function renderToday() {
  if (!P.onboarded) return renderOnboard();
  if (session) return renderQuestion();
  if (checkpoint) return renderCheckpoint();
  const today = dayKey(); const d = ensureDay(today); const due = dueCards(); const learned = learnedList(); const remaining = 50 - learned.length;
  const cp = nextCheckpoint();
  const newToday = (d.newIntro.length || d.done || cp) ? pendingNew() : pendingNew().concat(pickNew(P.settings.newPerDay));
  const capNew = ORDER.filter(a => capReady(a) && !capLearned(a) && card(a, 'loc').box >= 1 && !newToday.includes(a));
  const mastered = ORDER.filter(a => mastery(a) >= 4).length;
  const wk = Math.ceil(Math.min(dayNum(), PLAN_DAYS) / 7);
  const phase = remaining > 0 ? `Week ${wk} · Learning phase` : dayNum() <= 21 ? `Week ${wk} · Lock it in` : `Week ${wk} · Test ready`;
  const nQ = newToday.length * 3 + capNew.length * 2 + due.length;
  const caughtUp = !nQ && !cp;
  if (cp) {
    view.append(h('div', { class: 'card learn' }, h('h3', {}, 'Checkpoint'), h('h1', {}, `🏁 ${cp} states known!`), h('p', {}, `Time to prove it. Part 1: a sheet of state shapes — write each name${ORDER.filter(capLearned).length ? ' (and capital where you\'ve learned it)' : ''}. Part 2: fill all ${knownList().length} in on the blank map. New states pause until you've taken it — reviews still run.`),
      h('div', { class: 'row' }, h('button', { class: 'btn', onclick: () => { checkpoint = { k: cp, stage: 'sheet' }; render(); } }, 'Start checkpoint →'), h('button', { class: 'btn sec', onclick: () => { P.checkpoints[cp] = { skipped: true }; save(); render(); toast('Skipped — you can still test any time on the Test tab.'); } }, 'Skip for now'))));
  }
  const box = h('div', { class: 'card' },
    h('div', { class: 'row' }, h('div', { class: 'grow' }, h('h3', {}, phase), h('h1', {}, caughtUp ? 'All caught up! 🎉' : d.done ? 'Today is done! 🎉' : `Day ${dayNum()} session`)), h('span', { class: 'chip acc' }, `Level ${levelOf(P.xp)}`)),
    h('div', { class: 'grid four' },
      h('div', { class: 'tile' }, h('b', {}, String(due.length)), h('span', {}, 'reviews due')),
      h('div', { class: 'tile' }, h('b', {}, String(newToday.length)), h('span', {}, 'new states')),
      h('div', { class: 'tile' }, h('b', {}, String(capNew.length)), h('span', {}, 'new capitals')),
      h('div', { class: 'tile' }, h('b', {}, `${learned.length}/50`), h('span', {}, `states met · ${mastered} mastered`)),
    ),
    h('div', { style: 'margin:12px 0' }, h('div', { class: 'bar green' }, h('i', { style: `width:${learned.length * 2}%` }))),
    newToday.length ? h('p', {}, h('b', {}, 'New states: '), newToday.map(a => BY[a].name).join(', '), h('span', { class: 'muted' }, ` (${REGION_NAME[BY[newToday[0]].region]})`)) : null,
    capNew.length ? h('p', {}, h('b', {}, 'Capitals arriving: '), capNew.map(a => BY[a].name).join(', '), h('span', { class: 'muted' }, ' — you met these states a couple of days ago; now learn their capitals.')) : null,
    h('div', { class: 'row', style: 'margin-top:10px' },
      nQ ? h('button', { class: 'btn', onclick: () => { buildSession(); if (!session.queue.length) { session = null; toast('Nothing due right now — try Free practice on the Map tab, or a Test.'); return; } render(); } }, d.done && !newToday.length ? `Review ${nQ} more` : `Start today's session (${nQ} questions)`) : h('button', { class: 'btn sec', onclick: () => render('map') }, 'Free practice on the map →'),
      d.done && remaining > 0 && !cp ? h('button', { class: 'btn sec', onclick: () => { buildSession(true); render(); } }, `+ Learn ${Math.min(P.settings.newPerDay, remaining)} more`) : null,
    ),
    d.done ? h('p', { class: 'muted', style: 'margin-top:10px' }, `Today: ${d.correct}/${d.reviews} correct · +${d.xp} XP. ${nQ ? '' : 'Come back tomorrow — your states will be waiting.'} ${remaining === 0 ? 'Try a full-map Test!' : ''}`) : null,
  );
  view.append(box);
  // mini progress map
  const mc = h('div', { class: 'card' }, h('h2', {}, 'Your map'), h('p', { class: 'muted' }, 'Colored = met. Greener = better known. Tap a state for details.'));
  const host = h('div'); mc.append(host); view.append(mc);
  const m = makeMap(host, { onTap: (a) => a && stateModal(a) });
  paintMastery(m);
  if (!d.done && newToday.length) newToday.forEach(a => m.add(a, 'hl'));
}
// ---- Checkpoint (sheet of shapes → map) ----
let checkpoint = null;
function shapeSvg(abbr, w = 170, hh = 106) {
  // A mini map with the state highlighted in place (small states get a zoomed-in window so neighbors show).
  const NS = 'http://www.w3.org/2000/svg'; const el = (t, a) => { const e = document.createElementNS(NS, t); for (const [k, v] of Object.entries(a)) e.setAttribute(k, v); return e; };
  const s = BY[abbr]; const b = s.bbox; const bw = b[2] - b[0], bh = b[3] - b[1]; const W = DATA.width, H = DATA.height;
  let vb = `0 0 ${W} ${H}`;
  if (bw < 90 || s.area < 2500) { let w2 = Math.max(bw * 5, 260); let h2 = w2 * hh / w; if (bh * 5 > h2) { h2 = bh * 5; w2 = h2 * w / hh; } vb = `${(b[0] + b[2]) / 2 - w2 / 2} ${(b[1] + b[3]) / 2 - h2 / 2} ${w2} ${h2}`; }
  const svg = el('svg', { viewBox: vb, width: w, height: hh, preserveAspectRatio: 'xMidYMid meet', class: 'mini' });
  svg.append(el('path', { d: DATA.nation, fill: '#f3eee2' }), el('path', { d: DATA.mesh, fill: 'none', stroke: '#9b9383', 'stroke-width': 1, 'vector-effect': 'non-scaling-stroke' }), el('path', { d: s.d, fill: '#ff7a1a', stroke: '#b3520a', 'stroke-width': 1, 'vector-effect': 'non-scaling-stroke' }), el('path', { d: DATA.nation, fill: 'none', stroke: '#5b5446', 'stroke-width': 1, 'vector-effect': 'non-scaling-stroke' }));
  return svg;
}
function renderCheckpoint() {
  const k = checkpoint.k; const known = knownList(); const sheetStates = known.slice(Math.max(0, k - 10), k);
  const withCaps = sheetStates.filter(capLearned);
  const card0 = h('div', { class: 'card' }, h('div', { class: 'row' }, h('div', { class: 'grow' }, h('h3', {}, `Checkpoint ${k} · Part 1 of 2`), h('h1', {}, 'The sheet 📄')), h('button', { class: 'pill ghost', onclick: () => { if (confirm('Leave the checkpoint? You can come back any time.')) { checkpoint = null; render(); } } }, 'Exit')),
    h('p', {}, `Each little map highlights one of your latest ${sheetStates.length} states, right where it sits. Write each one's name${withCaps.length ? ' — and the capital for the ones whose capital you\'ve learned' : ''}. Spelling close counts.`));
  const grid = h('div', { class: 'sheet' }); const inputs = {};
  shuffle(sheetStates).forEach(a => { const nm = h('input', { type: 'text', placeholder: 'State', autocomplete: 'off', autocapitalize: 'words', spellcheck: 'false' }); const cp = capLearned(a) ? h('input', { type: 'text', placeholder: 'Capital', autocomplete: 'off', autocapitalize: 'words', spellcheck: 'false' }) : null; inputs[a] = { nm, cp }; grid.append(h('div', { class: 'shape' }, shapeSvg(a), h('div', { class: 'fields' }, nm, cp))); });
  const all = [...grid.querySelectorAll('input')]; all.forEach((inp, i) => inp.addEventListener('keydown', e => { if (e.key === 'Enter') { e.preventDefault(); (all[i + 1] || checkBtn).focus(); } }));
  const res = h('div', { class: 'feedback' });
  const checkBtn = h('button', { class: 'btn good', onclick: () => {
    let rs = 0, rc = 0; const names = STATES.map(x => x.name), caps = STATES.map(x => x.capital);
    for (const a of sheetStates) { const s = BY[a]; const { nm, cp } = inputs[a]; const okS = !!matches(nm.value, s.name, names.filter(n => n !== s.name)); nm.classList.add(okS ? 'good' : 'bad'); nm.disabled = true; if (okS) rs++; else nm.value = nm.value ? `${nm.value} → ${s.name}` : s.name; if (cp) { const okC = !!matches(cp.value, s.capital, caps.filter(n => n !== s.capital)); cp.classList.add(okC ? 'good' : 'bad'); cp.disabled = true; if (okC) rc++; else cp.value = cp.value ? `${cp.value} → ${s.capital}` : s.capital; } }
    checkpoint.sheet = { states: rs, n: sheetStates.length, caps: withCaps.length ? rc : null, capN: withCaps.length };
    res.className = 'feedback ' + (rs === sheetStates.length ? 'good' : 'bad'); res.textContent = `Sheet: ${rs}/${sheetStates.length} states${withCaps.length ? `, ${rc}/${withCaps.length} capitals` : ''}. ${rs === sheetStates.length ? 'Perfect! ' : ''}Now the map →`;
    P.xp += rs * 3 + rc * 3; save(); beep(rs === sheetStates.length ? 'win' : 'good'); checkBtn.replaceWith(mapBtn); mapBtn.scrollIntoView({ behavior: 'smooth', block: 'center' });
  } }, 'Check my sheet ✓');
  const mapBtn = h('button', { class: 'btn', onclick: () => { const capSet = known.filter(capLearned); test = { caps: capSet.length > 0, capSet, instant: false, scope: known, ans: {}, t0: Date.now(), sel: null, checked: false, checkpoint: k }; checkpoint.stage = 'map'; render('test'); } }, `Part 2: fill in the map (${known.length} states) →`);
  card0.append(grid, res, h('div', { class: 'row', style: 'margin-top:12px' }, checkBtn));
  view.append(card0); setTimeout(() => all[0]?.focus(), 50);
}
function completeCheckpoint(T, rec) {
  P.checkpoints = P.checkpoints || {}; P.checkpoints[T.checkpoint] = { done: true, date: dayKey(), sheet: checkpoint?.sheet || null, map: rec }; P.xp += 50; checkpoint = null; save(); toast(`Checkpoint ${T.checkpoint} complete! +50 XP bonus`);
}
function paintMastery(m) { for (const s of STATES) { const k = mastery(s.abbr); m.set(s.abbr, k ? 'm' + k : (introduced(s.abbr) ? 'm1' : '')); } }

// ---- question ----
let advanceTimer = null;
function renderQuestion() {
  clearTimeout(advanceTimer); view.innerHTML = ''; window.scrollTo(0, 0);
  if (session.i >= session.queue.length) return renderSummary();
  const q = session.queue[session.i]; const s = BY[q.abbr];
  const prog = h('div', { class: 'progress-top' }, h('span', {}, `${session.i + 1} / ${session.queue.length}`), h('div', { class: 'bar' }, h('i', { style: `width:${session.i / session.queue.length * 100}%` })), h('span', {}, `+${session.xp} XP`), h('button', { class: 'pill ghost', onclick: () => { session = null; render(); } }, 'Exit'));
  const wrap = h('div', { class: 'quiz' }); const mapHost = h('div'); const qcard = h('div', { class: 'card qcard' });
  wrap.append(h('div', {}, mapHost), qcard); view.append(prog, wrap);
  const next = () => { session.i++; renderQuestion(); };
  const nextBtn = (label = 'Next →') => h('div', { class: 'row', style: 'margin-top:12px' }, h('button', { class: 'btn', onclick: next }, label));
  const requeue = () => { const again = { ...q, practice: !!session.practice, retry: true }; session.queue.push(again); };
  const fb = h('div', { class: 'feedback' });
  const showFb = (ok, text, mn) => { fb.className = 'feedback ' + (ok ? 'good' : 'bad'); fb.innerHTML = ''; fb.append(text); if (mn) fb.append(h('span', { class: 'mn' }, '💡 ' + mn)); beep(ok ? 'good' : 'bad'); };
  let map;
  if (q.type === 'learn') {
    map = makeMap(mapHost); map.add(q.abbr, 'hl'); map.label(q.abbr, s.abbr); if (BY[q.abbr].bbox[2] - BY[q.abbr].bbox[0] < 110) map.zoomTo(q.abbr, 4);
    learnedList().filter(a => a !== q.abbr).forEach(a => map.add(a, 'filled'));
    s.nb.forEach(a => map.label(a, BY[a].abbr));
    qcard.classList.add('learn');
    const showCap = q.full || capLearned(q.abbr);
    const nbNames = s.nb.map(a => BY[a].name);
    qcard.append(h('small', { class: 'muted' }, `${session.practice ? 'MEET' : 'NEW STATE'} · ${REGION_NAME[s.region]}`), h('div', { class: 'big' }, s.name, ' ', h('span', { class: 'muted', style: 'font-size:18px' }, s.abbr)),
      showCap ? h('div', { class: 'cap' }, `★ Capital: ${s.capital}`) : h('div', { class: 'muted' }, `★ Capital: comes in ${CAP_DELAY} days — learn where it is first.`),
      h('div', { class: 'mn' }, showCap ? '💡 ' + MNEMO[s.abbr] : (nbNames.length ? `📍 Touches ${nbNames.join(', ')}.` : `📍 Out on its own — no land neighbors.`)),
      h('p', { class: 'muted', style: 'margin-top:10px' }, 'Look at its shape and what\'s around it. Say the name out loud once.'), nextBtn('Got it →'));
    return;
  }
  if (q.type === 'learncap') {
    map = makeMap(mapHost); map.add(q.abbr, 'hl'); map.label(q.abbr, s.abbr); if (BY[q.abbr].bbox[2] - BY[q.abbr].bbox[0] < 110) map.zoomTo(q.abbr, 4);
    qcard.classList.add('learn');
    qcard.append(h('small', { class: 'muted' }, `NEW CAPITAL · ${s.name}`), h('div', { class: 'big' }, s.capital), h('div', { class: 'cap' }, `is the capital of ${s.name}`), h('div', { class: 'mn' }, '💡 ' + MNEMO[s.abbr]), h('p', { class: 'muted', style: 'margin-top:10px' }, `Say it out loud: "${s.capital}, ${s.name}."`), nextBtn('Got it →'));
    return;
  }
  const finish = (ok, opts = {}) => { grade(q.abbr, q.kind, ok, { practice: q.practice, hint: opts.hint }); if (!ok) requeue(); };
  if (q.type === 'find') {
    let done = false;
    map = makeMap(mapHost, { onTap: (a) => { if (done || !a) return; done = true; const ok = a === q.abbr; map.add(q.abbr, 'good'); if (!ok) map.add(a, 'bad'); map.label(q.abbr, s.abbr); finish(ok); showFb(ok, ok ? `Yes! That's ${s.name}.` : `Not quite — that was ${BY[a].name}. ${s.name} is highlighted in green.`); qcard.append(nextBtn()); if (ok) advanceTimer = setTimeout(next, 1100); } });
    qcard.append(h('div', { class: 'prompt' }, h('small', {}, q.practice ? 'Practice · Find it' : 'Find it'), `Tap ${s.name} on the map`), h('p', { class: 'kbd' }, 'Pinch or scroll to zoom in on small states.'), fb);
    return;
  }
  if (q.type === 'capmc') {
    map = makeMap(mapHost); map.add(q.abbr, 'hl'); map.label(q.abbr, s.abbr); if (s.bbox[2] - s.bbox[0] < 110) map.zoomTo(q.abbr, 4);
    const sameRegion = STATES.filter(x => x.region === s.region && x.abbr !== s.abbr).map(x => x.capital);
    const others = shuffle(STATES.filter(x => x.abbr !== s.abbr).map(x => x.capital));
    const distract = shuffle(shuffle(sameRegion).slice(0, 2).concat(others).filter((v, i, a) => a.indexOf(v) === i)).slice(0, 3);
    // ensure at least 3
    const choices = shuffle([s.capital, ...distract]);
    let done = false; const grid = h('div', { class: 'choices' });
    choices.forEach(c => grid.append(h('button', { onclick: (e) => { if (done) return; done = true; const ok = c === s.capital; e.target.classList.add(ok ? 'good' : 'bad'); [...grid.children].forEach(b => { if (b.textContent === s.capital) b.classList.add('good'); }); finish(ok); showFb(ok, ok ? `Right — ${s.capital}, ${s.abbr}.` : `It's ${s.capital}.`, MNEMO[s.abbr]); qcard.append(nextBtn()); if (ok) advanceTimer = setTimeout(next, 1300); } }, c)));
    qcard.append(h('div', { class: 'prompt' }, h('small', {}, 'Capital'), `What is the capital of ${s.name}?`), grid, fb);
    return;
  }
  // typed: name | cap | rev
  const answer = q.type === 'name' ? s.name : q.type === 'cap' ? s.capital : s.name;
  const otherAnswers = q.type === 'cap' ? STATES.map(x => x.capital) : STATES.map(x => x.name);
  map = makeMap(mapHost);
  if (q.type !== 'rev') { map.add(q.abbr, 'hl'); if (s.bbox[2] - s.bbox[0] < 110) map.zoomTo(q.abbr, 4); }
  if (q.type === 'cap') map.label(q.abbr, s.abbr);
  const input = h('input', { type: 'text', autocomplete: 'off', autocapitalize: 'words', spellcheck: 'false', placeholder: q.type === 'cap' ? 'Type the capital…' : 'Type the state…', enterkeyhint: 'done' });
  let hints = 0; const hintBtn = h('button', { class: 'btn sec small', onclick: () => { hints++; input.value = answer.slice(0, hints); input.focus(); if (hints >= 2) hintBtn.disabled = true; } }, '💡 Hint');
  let done = false;
  const check = () => { if (done) return; const v = input.value.trim(); if (!v) return; done = true; const m = matches(v, answer, otherAnswers.filter(o => o !== answer)); const ok = !!m; input.classList.add(ok ? 'good' : 'bad'); input.disabled = true; if (q.type === 'rev') { map.add(q.abbr, 'good'); map.zoomTo(q.abbr, 4); } else map.set(q.abbr, ok ? 'good' : 'bad'); map.label(q.abbr, s.abbr); finish(ok, { hint: hints > 0 }); showFb(ok, ok ? (m === 'close' ? `Close enough — it's spelled "${answer}".` : `Correct! ${answer}.`) : `It's ${answer}.`, q.type !== 'name' ? MNEMO[s.abbr] : null); qcard.append(nextBtn()); if (ok && m === 'exact') advanceTimer = setTimeout(next, 1000); };
  input.addEventListener('keydown', e => { if (e.key === 'Enter') check(); });
  const prompt = q.type === 'name' ? ['Name it', 'Which state is highlighted?'] : q.type === 'cap' ? ['Capital', `What is the capital of ${s.name}?`] : ['Reverse', `${s.capital} is the capital of which state?`];
  qcard.append(h('div', { class: 'prompt' }, h('small', {}, (q.retry ? 'Try again · ' : '') + prompt[0]), prompt[1]), h('div', { class: 'ans' }, input, h('button', { class: 'btn', onclick: check }, 'Check')), h('div', { class: 'row', style: 'margin-top:8px' }, hintBtn, h('span', { class: 'kbd' }, 'Spelling close counts · hints = half XP')), fb);
  setTimeout(() => input.focus(), 50);
}
function renderSummary() {
  const prac = !!session.practice;
  const acc = session.answered ? Math.round(session.correct / session.answered * 100) : 100;
  finishSession();
  const d = ensureDay(dayKey()); const remaining = 50 - learnedList().length;
  view.append(h('div', { class: 'card summary' }, h('h3', {}, prac ? `Practice complete · ${session.label || ''}` : 'Session complete'), h('div', { class: 'big' }, `+${session.xp} XP`), h('p', {}, `${session.correct}/${session.answered} correct (${acc}%). ${session.newAbbrs.length ? 'New today: ' + session.newAbbrs.map(a => BY[a].name).join(', ') + '.' : ''}`), prac ? h('p', { class: 'muted' }, 'Practice doesn\'t change your review schedule — it\'s just extra reps (and XP).') : h('p', {}, `🔥 Streak: ${P.streak} day${P.streak === 1 ? '' : 's'} · Day ${dayNum()} of 28`), h('div', { class: 'row', style: 'margin-top:10px' }, h('button', { class: 'btn', onclick: () => { session = null; render(prac ? 'map' : 'today'); } }, 'Done'), prac ? null : remaining > 0 ? h('button', { class: 'btn sec', onclick: () => { buildSession(true); render(); } }, `+ Learn ${Math.min(P.settings.newPerDay, remaining)} more`) : h('button', { class: 'btn sec', onclick: () => { session = null; render('test'); } }, 'Try the full-map test'))));
  session = null;
}

// ---- Map tab ----
let labelMode = 'learned';
function renderMap() {
  const learned = learnedList();
  const top = h('div', { class: 'card' }, h('div', { class: 'row' }, h('div', { class: 'grow' }, h('h1', {}, 'Progress map'), h('p', { class: 'muted' }, `${learned.length}/50 met · ${ORDER.filter(a => mastery(a) >= 4).length} mastered. Tap any state.`)),
    h('div', { class: 'seg' }, ['none', 'learned', 'all'].map(m => h('button', { class: labelMode === m ? 'on' : '', onclick: () => { labelMode = m; render(); } }, m === 'none' ? 'No labels' : m === 'learned' ? 'Label learned' : 'Label all')))),
    h('div', { class: 'region-legend', style: 'margin-top:6px' }, h('span', {}, h('i', { style: 'background:var(--land)' }), 'not yet'), h('span', {}, h('i', { style: 'background:var(--m1)' }), 'met'), h('span', {}, h('i', { style: 'background:var(--m3)' }), 'getting there'), h('span', {}, h('i', { style: 'background:var(--m5)' }), 'mastered')));
  const host = h('div'); top.append(host); view.append(top);
  const m = makeMap(host, { onTap: (a) => a && stateModal(a) }); paintMastery(m);
  STATES.forEach(s => { if (labelMode === 'all' || (labelMode === 'learned' && introduced(s.abbr))) m.label(s.abbr, s.abbr); });
  const learned2 = learnedList();
  const prac = h('div', { class: 'card' }, h('h2', {}, 'Free practice 🎯'), h('p', { class: 'muted' }, 'Any region, any time — doesn\'t touch your daily schedule. States you haven\'t met yet get a quick intro first.'),
    h('div', { class: 'row' }, Object.entries(REGION_NAME).map(([r, nm]) => { const abbrs = STATES.filter(x => x.region === r).map(x => x.abbr); const met = abbrs.filter(introduced).length; return h('button', { class: 'btn sec small', onclick: () => { buildPractice(abbrs, nm); render(); } }, `${nm} `, h('span', { class: 'muted' }, `${met}/${abbrs.length}`)); }),
      h('button', { class: 'btn small', onclick: () => { if (!learned2.length) return toast('Meet a few states first — or pick a region!'); buildPractice(learned2, 'Everything learned'); render(); } }, `All learned (${learned2.length})`),
      h('button', { class: 'btn small', onclick: () => { buildPractice(ORDER, 'All 50'); render(); } }, 'All 50 🇺🇸')));
  view.append(prac);
  const list = h('div', { class: 'slist' });
  ORDER.forEach(a => { const s = BY[a]; const k = mastery(a); list.append(h('div', { class: 's m' + k, onclick: () => stateModal(a) }, h('span', {}, h('b', {}, s.name), h('br'), h('span', { class: 'muted' }, s.capital)), h('span', { class: 'stars' }, introduced(a) ? stars(k) : '·'))); });
  view.append(h('div', { class: 'card' }, h('h2', {}, 'All 50 states (learning order)'), h('p', { class: 'muted' }, 'Grouped by region so neighbors are learned together. Tap any state for its memory hook — or to pull it into today\'s lesson early.'), list));
}
function stateModal(a) {
  const s = BY[a]; const k = mastery(a); const loc = card(a, 'loc'), cap = card(a, 'cap');
  const m = $('#modal'); m.classList.remove('hidden'); m.innerHTML = '';
  const mini = h('div', { style: 'margin:8px 0' });
  const box = h('div', { class: 'box' }, h('h2', {}, s.name, ' ', h('span', { class: 'muted' }, s.abbr)), h('p', {}, h('b', {}, 'Capital: '), s.capital, h('span', { class: 'muted' }, ` · ${REGION_NAME[s.region]}`)), mini, h('p', { class: 'muted' }, '💡 ' + MNEMO[a]),
    introduced(a) ? [h('p', {}, h('span', { class: 'stars' }, stars(k)), ` · location ${loc.right}/${loc.seen} · capital ${cap.right}/${cap.seen}`), h('p', { class: 'muted' }, `Next review: ${Math.min(loc.due, cap.due) <= dayStart() ? 'today' : fmtDate(new Date(Math.min(loc.due, cap.due)))}`)] : h('p', { class: 'muted' }, `Not in your lessons yet — it's scheduled around day ${Math.ceil((ORDER.indexOf(a) + 1) / P.settings.newPerDay)}.`),
    h('div', { class: 'row', style: 'margin-top:10px' }, h('button', { class: 'btn', onclick: closeModal }, 'Close'),
      introduced(a) ? h('button', { class: 'btn sec', onclick: () => { closeModal(); buildPractice([a], s.name); render(); } }, 'Quiz me on it') : h('button', { class: 'btn sec', onclick: () => { const d = ensureDay(dayKey()); introduce(a); d.newIntro.push(a); d.done = false; save(); closeModal(); toast(`${s.name} added to today's lesson`); render('today'); } }, "Add to today's lesson")));
  const mm = makeMap(mini, { tools: false }); mm.add(a, 'hl'); mm.label(a, s.abbr); mm.zoomTo(a, 3); mini.querySelector('.hint').remove();
  m.append(box); m.onclick = (e) => { if (e.target === m) closeModal(); };
}
function closeModal() { $('#modal').classList.add('hidden'); }

// ---- Test tab ----
let test = null;
function renderTest() {
  if (test) return renderTestRun();
  const learned = learnedList();
  const best = P.best;
  const setup = { caps: true, instant: false, scope: learned.length >= 50 ? 'all' : 'learned' };
  const box = h('div', { class: 'card' }, h('h1', {}, 'Fill in the map 🏁'),
    h('p', {}, 'A blank map, borders only. Tap each state and write its name (and capital). Then check your answers — just like the real test.'),
    h('h3', {}, 'What to fill in'), h('div', { class: 'seg', id: 't-caps' }, h('button', { class: 'on', onclick: (e) => { setup.caps = true; seg(e) } }, 'States + capitals'), h('button', { onclick: (e) => { setup.caps = false; seg(e) } }, 'States only')),
    h('h3', { style: 'margin-top:12px' }, 'Which states'), h('div', { class: 'seg', id: 't-scope' }, h('button', { class: setup.scope === 'learned' ? 'on' : '', onclick: (e) => { setup.scope = 'learned'; seg(e) } }, `Learned so far (${learned.length})`), h('button', { class: setup.scope === 'all' ? 'on' : '', onclick: (e) => { setup.scope = 'all'; seg(e) } }, 'All 50')),
    h('h3', { style: 'margin-top:12px' }, 'Feedback'), h('div', { class: 'seg', id: 't-inst' }, h('button', { class: 'on', onclick: (e) => { setup.instant = false; seg(e) } }, 'Check at the end'), h('button', { onclick: (e) => { setup.instant = true; seg(e) } }, 'Check as I go')),
    h('div', { class: 'row', style: 'margin-top:16px' }, h('button', { class: 'btn', onclick: () => { const scope = setup.scope === 'all' ? ORDER.slice() : learned.slice(); if (!scope.length) return toast('Learn a few states first!'); test = { ...setup, scope, ans: {}, t0: Date.now(), sel: null, checked: false }; render(); } }, 'Start test')),
    best ? h('p', { class: 'muted', style: 'margin-top:10px' }, `🏆 Best full test: ${best.states}/50 states${best.caps != null ? `, ${best.caps}/50 capitals` : ''} in ${fmtTime(best.time)} (${best.date})`) : null,
  );
  function seg(e) { [...e.target.parentNode.children].forEach(b => b.classList.toggle('on', b === e.target)); }
  view.append(box);
  if (P.tests.length) { const hist = h('div', { class: 'result-list' }); P.tests.slice(-10).reverse().forEach(t => hist.append(h('div', {}, h('span', {}, `${t.date} · ${t.n} states${t.scope === 'all' ? '' : ' (learned)'}`), h('span', {}, `${t.states}/${t.n}${t.caps != null ? ` · caps ${t.caps}/${t.n}` : ''} · ${fmtTime(t.time)}`)))); view.append(h('div', { class: 'card' }, h('h2', {}, 'Past tests'), hist)); }
}
const fmtTime = (ms) => { const s = Math.round(ms / 1000); return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`; };
function renderTestRun() {
  const T = test; const inScope = new Set(T.scope);
  const wrap = h('div', { class: 'testpanel' }); const mapHost = h('div'); const panel = h('div', { class: 'card qcard' }); wrap.append(h('div', {}, mapHost), panel); view.append(wrap);
  const m = makeMap(mapHost, { onTap: (a) => { if (T.checked) { if (a) showResultFor(a); return; } if (a && inScope.has(a)) select(a); } });
  STATES.forEach(s => { if (!inScope.has(s.abbr)) m.add(s.abbr, 'dim'); });
  const nameIn = h('input', { type: 'text', placeholder: 'State name', autocomplete: 'off', autocapitalize: 'words', spellcheck: 'false' });
  const capIn = h('input', { type: 'text', placeholder: 'Capital', autocomplete: 'off', autocapitalize: 'words', spellcheck: 'false' });
  const count = h('b'); const timer = h('span', { class: 'muted' }); const status = h('div', { class: 'feedback' });
  const form = h('div', { class: T.sel ? '' : 'hidden' });
  const title = h('div', { class: 'prompt' }, h('small', {}, T.checkpoint ? `Checkpoint ${T.checkpoint} · Part 2 of 2 · tap a state, write it in` : 'Tap a state on the map, then write it in'), 'Fill in the map');
  const saveBtn = h('button', { class: 'btn', onclick: commit }, 'Save ↵');
  form.append(h('div', { class: 'ans', style: 'margin-bottom:8px' }, nameIn), T.caps ? h('div', { class: 'ans', style: 'margin-bottom:8px' }, capIn) : '', h('div', { class: 'row' }, saveBtn, h('button', { class: 'btn sec small', onclick: () => { select(null); } }, 'Cancel')));
  [nameIn, capIn].forEach(i => i.addEventListener('keydown', e => { if (e.key === 'Enter') { if (i === nameIn && needCap(T.sel) && !capIn.value) capIn.focus(); else commit(); } }));
  const finishBtn = h('button', { class: 'btn good', onclick: checkAll }, 'Finish & check ✓');
  const exitBtn = h('button', { class: 'btn sec small', onclick: () => { if (T.checked || confirm('Leave the test? Progress on it will be lost.')) { test = null; if (T.checkpoint) { checkpoint = null; render('today'); } else render(); } } }, 'Exit');
  panel.append(title, h('p', {}, 'Filled: ', count, ` / ${T.scope.length} · `, timer), form, status, h('div', { class: 'row', style: 'margin-top:12px' }, T.checked ? '' : finishBtn, exitBtn));
  const results = h('div', { class: 'result-list', style: 'margin-top:10px' }); panel.append(results);
  const tick = () => { timer.textContent = fmtTime((T.end || Date.now()) - T.t0); if (test === T && !T.checked) T._tm = setTimeout(tick, 1000); }; tick();
  function paint() { count.textContent = Object.keys(T.ans).length; for (const a of T.scope) { const an = T.ans[a]; if (T.checked) { m.set(a, an && an.okS ? (needCap(a) && !an.okC ? 'sel' : 'good') : 'bad'); m.label(a, BY[a].abbr); } else { m.set(a, a === T.sel ? 'sel' : an ? 'filled' : ''); m.label(a, an ? (an.name.length > 12 && BY[a].area < 3000 ? an.name.slice(0, 10) + '…' : an.name) : null); if (T.instant && an) m.set(a, an.okS && (!needCap(a) || an.okC) ? 'good' : 'bad'); } } if (T.sel) m.add(T.sel, 'sel'); }
  function select(a) { T.sel = a; form.classList.toggle('hidden', !a); if (a) { const an = T.ans[a] || {}; nameIn.value = an.name || ''; capIn.value = an.cap || ''; if (capIn.parentNode) capIn.parentNode.classList.toggle('hidden', !needCap(a)); title.lastChild.textContent = 'Selected state — write it in'; setTimeout(() => nameIn.focus(), 30); } else title.lastChild.textContent = 'Fill in the map'; paint(); }
  const needCap = (a) => T.caps && (!T.capSet || T.capSet.includes(a));
  function gradeOne(a) { const s = BY[a]; const an = T.ans[a]; if (!an) return; an.okS = !!matches(an.name, s.name, STATES.map(x => x.name).filter(n => n !== s.name)); an.okC = needCap(a) ? !!matches(an.cap, s.capital, STATES.map(x => x.capital).filter(n => n !== s.capital)) : null; }
  function commit() { if (!T.sel) return; const name = nameIn.value.trim(); if (!name) { nameIn.focus(); return; } T.ans[T.sel] = { name, cap: capIn.value.trim() }; gradeOne(T.sel); if (T.instant) { const an = T.ans[T.sel]; const s = BY[T.sel]; const ok = an.okS && (!needCap(T.sel) || an.okC); status.className = 'feedback ' + (ok ? 'good' : 'bad'); status.textContent = ok ? `✓ ${s.name}${T.caps ? ' — ' + s.capital : ''}` : `✗ That one is ${s.name}${T.caps ? ' — ' + s.capital : ''}`; beep(ok ? 'good' : 'bad'); } const left = T.scope.filter(x => !T.ans[x]); select(null); if (!left.length && !T.instant) toast('All filled — hit Finish & check!'); }
  function checkAll() { if (!confirm(`Check answers? ${T.scope.length - Object.keys(T.ans).length} still blank.`)) return; T.checked = true; T.end = Date.now(); T.scope.forEach(gradeOne); const states = T.scope.filter(a => T.ans[a]?.okS).length; const capN = T.caps ? T.scope.filter(needCap).length : 0; const caps = T.caps ? T.scope.filter(a => needCap(a) && T.ans[a]?.okC).length : null; const rec = { date: dayKey(), n: T.scope.length, capN, scope: T.scope.length === 50 ? 'all' : 'learned', states, caps, time: T.end - T.t0, checkpoint: T.checkpoint || null }; P.tests.push(rec); if (rec.n === 50 && (!P.best || states + (caps || 0) > P.best.states + (P.best.caps || 0))) P.best = rec; P.xp += states * 2 + (caps || 0) * 2; save(); finishBtn.remove(); form.classList.add('hidden'); title.firstChild.textContent = 'Results'; title.lastChild.textContent = `${states}/${T.scope.length} states${T.caps ? ` · ${caps}/${capN} capitals` : ''} · ${fmtTime(rec.time)}`; const perfect = states === T.scope.length && (!T.caps || caps === capN); if (T.checkpoint) completeCheckpoint(T, rec); status.className = 'feedback ' + (perfect ? 'good' : 'bad'); status.textContent = perfect ? 'PERFECT! 🎉' : `Red = wrong state${T.caps ? ', yellow = right state but wrong capital' : ''}. Tap one to see the answer.`; if (perfect) { confetti(); beep('win'); } if (T.checkpoint) exitBtn.replaceWith(h('button', { class: 'btn', onclick: () => { test = null; render('today'); } }, 'Checkpoint done → back to Today')); results.innerHTML = ''; T.scope.forEach(a => { const an = T.ans[a]; const s = BY[a]; const okS = an?.okS, okC = an?.okC; const nc = needCap(a); if (okS && (!nc || okC)) return; results.append(h('div', {}, h('span', { class: 'bad' }, an ? (okS ? s.name : `"${an.name}"`) + (nc ? ` / ${okC ? s.capital : `"${an.cap || '—'}"`}` : '') : '(blank)'), h('span', { class: 'good' }, `${s.name}${nc ? ' — ' + s.capital : ''}`))); }); if (!results.children.length) results.append(h('div', {}, h('span', { class: 'good' }, 'No misses!'))); paint(); m.reset(); }
  function showResultFor(a) { const s = BY[a]; const an = T.ans[a]; const nc = needCap(a); status.className = 'feedback ' + (an?.okS && (!nc || an.okC) ? 'good' : 'bad'); status.textContent = `${s.name}${nc ? ' — ' + s.capital : ''}${an ? ` (you wrote: ${an.name}${nc ? ' / ' + (an.cap || '—') : ''})` : ' (left blank)'}`; }
  paint(); if (T.sel) select(T.sel);
}

// ---- Plan tab ----
function renderPlan() {
  const n = P.settings.newPerDay; const learnDays = Math.ceil(50 / n); const today = dayNum(); const start = keyToDate(P.startDate).getTime();
  const byDay = {}; for (const [a, d] of Object.entries(P.intro)) (byDay[d] = byDay[d] || []).push(a);
  const box = h('div', { class: 'card' }, h('h1', {}, 'Your 4-week plan'), h('p', {}, `Started ${fmtDate(new Date(start))} · ${n} new states/day → all 50 by day ${learnDays}, then review until the whole map is automatic.`),
    h('div', { class: 'weeks' }));
  const weeks = box.lastChild; const labels = ['Week 1 · Meet the West & Mountains', 'Week 2 · Plains, Midwest & South', 'Week 3 · East coast + lock it in', 'Week 4 · Full-map tests'];
  for (let w = 0; w < 4; w++) { weeks.append(h('div', { class: 'wk-label' }, labels[w])); const row = h('div', { class: 'week' }); for (let i = 0; i < 7; i++) { const d = w * 7 + i + 1; const k = dayKey(new Date(start + (d - 1) * DAY)); const rec = P.days[k]; const cls = ['day', d === today ? 'today' : '', rec?.done ? 'done' : '', d < today ? 'past' : ''].join(' '); const abbrs = byDay[d] || (rec ? [] : null); let lab = ''; if (d < today && !rec?.done) lab = abbrs?.length ? '' : 'skipped'; if (d >= today && !abbrs) { const todayAssigned = !!(P.days[dayKey()]?.newIntro?.length); const before = Object.keys(P.intro).length + (d - today - (todayAssigned ? 1 : 0)) * n; lab = before < 50 ? `+${Math.min(n, 50 - before)} new` : d >= 22 ? 'test day' : 'review'; } const cpMark = (abbrs?.length && Object.values(P.checkpoints || {}).some(c => c.done && c.date === k)) || (d >= today && !abbrs && lab.startsWith('+') && Math.floor((Object.keys(P.intro).length + (d - today - (P.days[dayKey()]?.newIntro?.length ? 1 : 0) + 1) * n) / 10) > Math.floor((Object.keys(P.intro).length + (d - today - (P.days[dayKey()]?.newIntro?.length ? 1 : 0)) * n) / 10)); row.append(h('div', { class: cls }, h('span', { class: 'n' }, `${rec?.done ? '✓ ' : ''}${d}${cpMark ? ' 🏁' : ''}`), h('span', { class: 'lab' }, fmtDate(new Date(start + (d - 1) * DAY))), abbrs?.length ? h('div', { class: 'abbr' }, abbrs.map(a => h('i', {}, a))) : h('span', { class: 'lab' }, lab))); } weeks.append(row); }
  view.append(box);
  view.append(h('div', { class: 'card' }, h('h2', {}, 'How it works'), h('p', {}, h('b', {}, '1. Meet: '), 'each new state is shown on the map with its neighbors. You find it, then type its name from memory.'), h('p', {}, h('b', {}, '2. Space it out: '), 'every state has a "box" (1–6). Get it right → it moves up and comes back later (1, 2, 4, 7, 14, 30 days). Miss it → it drops back and shows up tomorrow.'), h('p', {}, h('b', {}, '3. Recall, don\'t recognize: '), 'as a state gets stronger, questions switch from tap-it / multiple choice to writing the name and capital from memory — exactly what the test asks.'), h('p', {}, h('b', {}, '4. Capitals come second: '), `each state's capital is introduced ${CAP_DELAY} days after you meet the state, so you anchor the shape and place first, then hang the capital on it.`), h('p', {}, h('b', {}, '5. Checkpoints 🏁: '), 'every 10 states known, you take a checkpoint: a sheet of state shapes to name, then fill every state you know in on the blank map. Then the next batch unlocks.'), h('p', {}, h('b', {}, '6. Test: '), 'from week 3, take the full Fill-in-the-map test a few times a week. Your best full score is saved.')));
  const sBox = h('div', { class: 'card' }, h('h2', {}, 'Settings'),
    h('div', { class: 'row' }, h('span', {}, 'New states per day:'), h('div', { class: 'seg' }, [3, 4, 5, 6].map(k => h('button', { class: k === n ? 'on' : '', onclick: () => { P.settings.newPerDay = k; save(); render(); } }, String(k))))),
    h('div', { class: 'row', style: 'margin-top:10px' }, h('label', { class: 'sw' }, h('input', { type: 'checkbox', checked: P.settings.sound ? true : null, onchange: (e) => { P.settings.sound = e.target.checked; save(); } }), 'Sounds')),
    h('div', { class: 'row', style: 'margin-top:14px' }, h('button', { class: 'btn sec small', onclick: accountModal }, user ? `Account: ${user}` : 'Sign in / create account'), h('button', { class: 'btn sec small', onclick: () => { if (confirm('Reset ALL progress and start over from Day 1?')) { P = defaultP(); save(); if (user) pushProgress(); render('today'); } } }, 'Reset progress')),
    h('p', { class: 'muted', style: 'margin-top:8px' }, user ? '☁️ Progress is saved to the cloud and on this device.' : '💾 Progress is saved on this device only. Sign in to sync across your phone and laptop.'));
  view.append(sBox);
}

// ---- account ----
function accountModal() {
  const m = $('#modal'); m.classList.remove('hidden'); m.innerHTML = '';
  if (user) { m.append(h('div', { class: 'box' }, h('h2', {}, `👤 ${user}`), h('p', { class: 'muted' }, 'Your progress syncs to the cloud whenever you answer. Sign in on any device to continue.'), h('div', { class: 'row' }, h('button', { class: 'btn', onclick: closeModal }, 'Close'), h('button', { class: 'btn sec', onclick: async () => { await pushProgress(); await fetch('/api/logout', { method: 'POST' }); user = null; closeModal(); refreshHeader(); render(); toast('Signed out'); } }, 'Sign out')))); m.onclick = (e) => { if (e.target === m) closeModal(); }; return; }
  let mode = 'login';
  const name = h('input', { type: 'text', placeholder: 'Your name (e.g. colton)', autocomplete: 'username', value: localStorage.getItem('sl.user') || '' });
  const pass = h('input', { type: 'password', placeholder: 'Password', autocomplete: 'current-password' });
  const err = h('div', { class: 'err' }); const title = h('h2', {}, 'Sign in'); const sub = h('p', { class: 'muted' }, 'Save your progress to the cloud so you can keep going on your phone, laptop, anywhere.');
  const go = async () => { err.textContent = ''; try { const r = await fetch('/api/' + mode, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ user: name.value, pass: pass.value }) }).then(r => r.json()); if (r.error) { err.textContent = r.error; return; } user = r.user; localStorage.setItem('sl.user', user); adoptServer(r.progress); if (!r.progress && P.onboarded) await pushProgress(); closeModal(); refreshHeader(); render(); toast(mode === 'register' ? 'Account created — progress will save to the cloud ☁️' : 'Signed in ☁️'); } catch (e) { err.textContent = 'Could not reach the server.'; } };
  const swap = h('button', { class: 'btn sec small', type: 'button', onclick: () => { mode = mode === 'login' ? 'register' : 'login'; title.textContent = mode === 'login' ? 'Sign in' : 'Create account'; swap.textContent = mode === 'login' ? 'New here? Create account' : 'Have an account? Sign in'; pass.autocomplete = mode === 'login' ? 'current-password' : 'new-password'; } }, 'New here? Create account');
    m.append(h('div', { class: 'box' }, title, sub, h('form', { onsubmit: (e) => { e.preventDefault(); go(); } }, h('label', {}, 'Name'), name, h('label', {}, 'Password'), pass, err, h('div', { class: 'row' }, h('button', { class: 'btn', type: 'submit' }, 'Go'), swap, h('button', { class: 'pill ghost', type: 'button', onclick: closeModal }, 'Cancel')))));
  m.onclick = (e) => { if (e.target === m) closeModal(); }; setTimeout(() => (name.value ? pass : name).focus(), 50);
}
$('#acct-btn').onclick = accountModal;

// ---------------- boot ----------------
await initAccount();
render('today');
document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'hidden' && user) { clearTimeout(pushTimer); navigator.sendBeacon && fetch('/api/progress', { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ progress: P }), keepalive: true }).catch(() => {}); } });
})();
