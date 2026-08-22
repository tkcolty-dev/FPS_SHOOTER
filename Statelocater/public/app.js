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
const DATA = await fetch('states.json?v=3').then(r => r.json());
const STATES = DATA.states;
const BY = {}; STATES.forEach(s => BY[s.abbr] = s);
const REGION_NAME = { PW: 'Pacific', MT: 'Mountain', GP: 'Plains & South Central', MW: 'Midwest', SE: 'Southeast', MA: 'Mid-Atlantic', NE: 'New England' };
const ORDER = ['CA', 'WA', 'OR', 'AK', 'HI', 'NV', 'ID', 'MT', 'WY', 'UT', 'CO', 'AZ', 'NM', 'TX', 'OK', 'KS', 'NE', 'SD', 'ND', 'AR', 'LA', 'MN', 'IA', 'MO', 'WI', 'IL', 'MI', 'IN', 'OH', 'KY', 'TN', 'MS', 'AL', 'GA', 'FL', 'SC', 'NC', 'VA', 'WV', 'PA', 'NY', 'NJ', 'DE', 'MD', 'CT', 'RI', 'MA', 'VT', 'NH', 'ME'];
const MNEMO = {
AL:'Montgomery — where Rosa Parks rode the bus. Ala-BAMA drama, Mont-GOMERY.', AK:'"Do you know (Juneau) Alaska\'s capital?" Yes — Juneau!', AZ:'A Phoenix rises from the hot Arizona desert sun.', AR:'Arkansas ROCKS… just a Little Rock.', CA:'A SACK of California tomatoes — SACramento.', CO:'Denver, the Mile-High City in the Colorado Rockies.', CT:'Connecticut connects to your HEART — Hartford.', DE:'Delaware: drive over to DOVER.', FL:'TALL Florida palm trees in Tallahassee.', GA:'Georgia peach → Atlanta, the world\'s busiest airport.', HI:'Hawaii: do the hula in Honolulu.', ID:'Idaho potatoes — "BOY-see" those spuds! Boise.', IL:'Illinois: Abraham Lincoln\'s Springfield.', IN:'Indiana + polis (city) = Indianapolis.', IA:'Iowa: "Des Moines" = day-MOYN, out in the corn.', KS:'Kansas: Toto PEEKED out of the basket — ToPEKA.', KY:'Kentucky: be FRANK, it\'s Frankfort (not Louisville!).', LA:'Louisiana: "Baton Rouge" is French for red stick.', ME:'Maine: August is the month to visit Augusta.', MD:'Maryland: Anna at the Naval Academy — Annapolis.', MA:'Massachusetts: the Boston Tea Party.', MI:'Michigan is a mitten — Lansing sits in the palm.', MN:'Minnesota: Saint Paul, the twin of Minneapolis.', MS:'Mississippi: Jackson — say it with rhythm: Missis-sippi Jack-son.', MO:'Missouri: Jefferson City, right on the Missouri River.', MT:'Montana: HELEN-a of the mountains.', NE:'Nebraska: Abe Lincoln standing in the cornfields.', NV:'Nevada: NOT Las Vegas — Carson City, near Lake Tahoe.', NH:'New Hampshire: Concord grapes.', NJ:'New Jersey: Washington crossed the Delaware to Trenton.', NM:'New Mexico: Santa Fe ("holy faith"), the oldest US capital.', NY:'New York: NOT NYC — Albany, up the Hudson River.', NC:'North Carolina: Sir Walter Raleigh.', ND:'North Dakota: Bismarck, like the German chancellor.', OH:'Ohio: Columbus sailed to O-hi-o.', OK:'Oklahoma → just add "City": Oklahoma City.', OR:'Oregon: Salem (not the witch-trial one — that\'s Massachusetts).', PA:'Pennsylvania: NOT Philly — Harrisburg.', RI:'Rhode Island: Providence, the tiny state\'s big city.', SC:'South Carolina: Columbia (Columbus + -ia).', SD:'South Dakota: Pierre — said like "peer".', TN:'Tennessee: country music capital, Nashville.', TX:'Texas: Austin — keep it weird.', UT:'Utah: the Great Salt Lake → Salt Lake City.', VT:'Vermont = Green MOUNTain → MONTpelier, the smallest capital.', VA:'Virginia: Richmond, rich in history.', WA:'Washington: Mount Olympus → Olympia.', WV:'West Virginia: Charleston (the other Charleston is in SC, but it\'s not SC\'s capital).', WI:'Wisconsin: James MADISON loves cheese. Madison.', WY:'Wyoming: Cheyenne, home of the big rodeo.' };
const PICTURE = {
AL:'Picture a sweet-tea stand in Alabama run by a fellow named Mont Gomery.', AK:'Picture a moose in a parka asking "Did JUNEAU it\'s cold up here?"', AZ:'Picture a flaming PHOENIX bird rising out of the Grand Canyon.', AR:'Picture one tiny pebble — a LITTLE ROCK — sitting in the middle of Arkansas.', CA:'Picture a giant SACK of tomatoes dumped in California\'s valley — SACK-ramento.', CO:'Picture a bear DEN a mile high in the Rockies — DEN-ver.', CT:'Picture a big red HEART floating across a river FORD in Connecticut.', DE:'Picture a white DOVE flying OVER tiny Delaware — DOVE-r.', FL:'Picture a TALL palm tree at the top of Florida waving "HASS-ee!"', GA:'Picture a peach so huge it needs the world\'s busiest airport — Atlanta.', HI:'Picture hula dancers HONKing ukuleles — HONO-lulu.', ID:'Picture a BOY SEEing a potato the size of a truck — BOY-see.', IL:'Picture Abe Lincoln bouncing on a SPRING in a FIELD of Illinois corn.', IN:'Picture Indy race cars circling a city named after the state — India-napolis.', IA:'Picture an Iowa farmer sighing "DAY-MOYN, that\'s a lot of corn."', KS:'Picture Toto PEEKing out of the basket over Kansas — To-PEEK-a.', KY:'Picture a FRANK (hot dog) guarding a FORT of Kentucky bourbon barrels.', LA:'Picture a RED STICK (baton rouge) poking out of the Louisiana bayou.', ME:'Picture a GUST of August wind blowing Maine\'s lobster traps around.', MD:'Picture ANNA saluting at the Naval Academy in Maryland — ANNA-polis.', MA:'Picture tea crates splashing into BOSTON harbor.', MI:'Picture a LANCE stuck in the palm of Michigan\'s mitten — LANCE-ing.', MN:'Picture SAINT PAUL ice-fishing next to his twin, Minneapolis.', MS:'Picture Michael JACKSON moonwalking down the Mississippi River.', MO:'Picture Thomas JEFFERSON\'s face carved in the Missouri river bluffs.', MT:'Picture HELEN-a yodeling from the top of a Montana mountain.', NE:'Picture Abe LINCOLN\'s top hat poking up out of a Nebraska cornfield.', NV:'Picture Johnny CARSON hosting a talk show in a tiny Nevada town (NOT Vegas).', NH:'Picture purple CONCORD grapes rolling down a New Hampshire mountain.', NJ:'Picture Washington\'s boat crunching onto the snowy bank at TRENTON.', NM:'Picture SANTA in an adobe house in New Mexico — SANTA FE.', NY:'Picture a sleepy ALBANY far up the Hudson, giggling at the skyscrapers downstream.', NC:'Picture Sir Walter RALEIGH laying his cloak over a North Carolina puddle.', ND:'Picture stern old BISMARCK shivering on the North Dakota prairie.', OH:'Picture COLUMBUS\'s ship sailing down the O-hi-o River.', OK:'Picture a road sign: "Oklahoma → City, this way." That\'s it: Oklahoma City.', OR:'Picture a "SALE \'EM!" sign nailed to Oregon pine trees — SALE-M.', PA:'Picture a HARRY bear (HARRIS-burg) eating a cheesesteak far from Philly.', RI:'Picture PROVIDENCE — a guardian angel hovering over the tiniest state.', SC:'Picture COLUMBIA, the movie-logo lady, holding her torch over South Carolina.', SD:'Picture a PIER (peer) sticking into the Missouri River in South Dakota — PIERRE.', TN:'Picture a cowboy hat and a guitar — NASHVILLE, Music City.', TX:'Picture AUSTIN Powers riding a longhorn across Texas. Yeah baby.', UT:'Picture a SALTy LAKE with a CITY sparkling on its shore — Utah.', VT:'Picture a green MOUNTain (Ver-MONT) with a tiny capital perched on top — MONT-pelier.', VA:'Picture a RICH MAN (RICH-mond) in a powdered wig in colonial Virginia.', WA:'Picture the OLYMPIC rings hanging on Mount Olympus in Washington.', WV:'Picture CHARLES dancing the Charleston in the West Virginia hills.', WI:'Picture James MADISON biting into a giant wheel of Wisconsin cheese.', WY:'Picture a rodeo rider named SHY ANNE bucking across Wyoming — CHEY-ENNE.' };
// Plan length is a setting: 7-day sprint, 14-day, or 28-day classic. Review intervals compress to fit.
const INTERVALS_28 = [0, 1, 2, 4, 7, 14, 30];
const INTERVALS_14 = [0, 1, 1, 2, 4, 7, 14];
const INTERVALS_7 = [0, 1, 1, 1, 2, 3, 5];

// ---------------- progress ----------------
const LS = 'statelocater.v2'; // v2 = fresh start (2026-08-20) with the new learning ladder
function defaultP() { return { v: 1, created: Date.now(), updatedAt: Date.now(), startDate: dayKey(), settings: { newPerDay: 8, planDays: 7, sound: true }, cards: {}, intro: {}, days: {}, xp: 0, streak: 0, lastDone: null, tests: [], best: null, onboarded: false }; }
let P = (() => { try { const p = JSON.parse(localStorage.getItem(LS)); if (p && p.cards) return Object.assign(defaultP(), p); } catch {} return defaultP(); })();
let user = null, pushTimer = null;
const planDays = () => P.settings.planDays || 28;
const intervals = () => planDays() <= 7 ? INTERVALS_7 : planDays() <= 14 ? INTERVALS_14 : INTERVALS_28;
const paceOptions = () => planDays() <= 7 ? [6, 8, 10] : planDays() <= 14 ? [4, 5, 6] : [3, 4, 5, 6];
const defaultPace = () => planDays() <= 7 ? 8 : planDays() <= 14 ? 4 : 3;
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
const capDelay = () => (P.settings.capDelay == null ? (planDays() <= 7 ? 1 : 2) : P.settings.capDelay); // days after meeting a state before its capital is introduced
const capReady = (abbr) => { if (!introduced(abbr)) return false; const c = card(abbr, 'cap'); const at = c.introAt != null ? c.introAt + capDelay() * DAY : (c.unlock || 0); return at <= dayStart() + DAY - 1; };
const capLearned = (abbr) => card(abbr, 'cap').box >= 1;
const knownList = () => ORDER.filter(a => introduced(a) && card(a, 'loc').box >= 1);
const mastery = (abbr) => { if (!introduced(abbr)) return 0; const l = card(abbr, 'loc').box, c = card(abbr, 'cap'); const b = capReady(abbr) ? Math.min(l, c.box) : Math.min(l, 2); return Math.min(5, b); };
const CHECKPOINTS = [10, 20, 30, 40, 50];
function nextCheckpoint() { const n = knownList().length; P.checkpoints = P.checkpoints || {}; for (const k of CHECKPOINTS) { const c = P.checkpoints[k]; if (n >= k && !(c && (c.done || c.skipped))) return k; } return null; }
const pendingNew = () => ORDER.filter(a => introduced(a) && card(a, 'loc').box === 0);
function introduce(a) { P.intro[a] = dayNum(); card(a, 'loc'); const c = card(a, 'cap'); if (c.introAt == null) c.introAt = dayStart(); }
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
    star(abbr, text) { const s = BY[abbr]; const k = 'star:' + abbr; if (labels[k]) { labels[k].remove(); delete labels[k]; } const g = el('g', { class: 'capstar' }); const st = el('text', { x: s.cap[0], y: s.cap[1], class: 'starglyph' }); st.textContent = '★'; g.append(st); if (text) { const fs = Math.max(7, Math.min(11, Math.sqrt(s.area) / 9)); const t = el('text', { x: s.cap[0] + 4, y: s.cap[1] + 1, class: 'lbl cap', 'font-size': fs, 'text-anchor': 'start' }); t.textContent = text; g.append(t); } labels[k] = g; gL.append(g); },
    unstar(abbr) { const k = 'star:' + abbr; if (labels[k]) { labels[k].remove(); delete labels[k]; } },
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
  if (kind === 'loc') {
    if (box <= 1) return { type: pick(['find', 'find', 'namemc', 'name']), abbr, kind }; // mostly recognition while weak
    const pName = Math.min(.9, .25 + box * .15); return { type: Math.random() < pName ? 'name' : 'find', abbr, kind };
  }
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
  const due = shuffle(dueCards()).sort((x, y) => (y.c.lapsed ? 1 : 0) - (x.c.lapsed ? 1 : 0)).filter(x => !newAbbrs.includes(x.abbr) && !(x.kind === 'cap' && capNew.includes(x.abbr)));
  const q = [];
  // Ladder: meet it -> find it with training wheels -> recognize the name. Typing waits for the mixed round.
  for (const a of newAbbrs) q.push({ type: 'learn', abbr: a }, { type: 'find', abbr: a, kind: 'loc', practice: true, easy: true }, { type: 'namemc', abbr: a, kind: 'loc', practice: true });
  for (const a of capNew) q.push({ type: 'learncap', abbr: a }, { type: 'capmc', abbr: a, kind: 'cap' });
  for (const x of due) q.push(qFor(x.abbr, x.kind, x.c.box));
  // Mixed round: the same new states come back shuffled, a few minutes later — find again, then type the name (this one counts).
  if (newAbbrs.length) { for (const a of shuffle(newAbbrs)) q.push({ type: 'find', abbr: a, kind: 'loc', practice: true, mixed: true }); for (const a of shuffle(newAbbrs)) q.push({ type: 'name', abbr: a, kind: 'loc' }); }
  session = { queue: q, i: 0, total: q.length, answered: 0, correct: 0, xp: 0, newAbbrs, capNew, day: today };
  save();
}
function buildPractice(abbrs, label, types) {
  const q = [];
  for (const a of shuffle(abbrs)) { let kinds = [{ type: 'find', kind: 'loc' }, { type: 'name', kind: 'loc' }]; if (!introduced(a) || !capLearned(a)) { q.push({ type: 'learn', abbr: a, full: true }); kinds = [{ type: 'find', kind: 'loc' }, { type: 'namemc', kind: 'loc' }, { type: 'capmc', kind: 'cap' }]; } else kinds.push({ type: 'capmc', kind: 'cap' }, { type: 'cap', kind: 'cap' }, { type: 'rev', kind: 'cap' }); if (types) kinds = types.map(t => ({ type: t, kind: t === 'find' || t === 'name' ? 'loc' : 'cap' })); q.push({ ...pick(kinds), abbr: a, practice: true }); }
  session = { queue: q, i: 0, total: q.length, answered: 0, correct: 0, xp: 0, newAbbrs: [], day: dayKey(), practice: true, label };
}
function grade(abbr, kind, ok, { practice, hint } = {}) {
  const c = card(abbr, kind); const d = ensureDay(dayKey());
  if (!practice) { c.seen++; d.reviews++; if (ok) { c.right++; d.correct++; if (c.lapsed) { c.lapsed = false; c.due = dayStart(1); } else { c.box = Math.min(6, c.box + 1); c.due = dayStart(intervals()[c.box]); } } else { c.wrong++; c.lapsed = true; c.box = Math.max(1, Math.ceil(c.box / 2)); c.due = dayStart(); } }
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
function render(t) { if (t) tab = t; document.querySelectorAll('#nav button').forEach(b => b.classList.toggle('on', b.dataset.tab === tab)); view.innerHTML = ''; window.scrollTo(0, 0); if (session) renderQuestion(); else ({ today: renderToday, play: renderPlay, map: renderMap, test: renderTest, plan: renderPlan })[tab](); refreshHeader(); }
document.querySelectorAll('#nav button').forEach(b => b.onclick = () => { session = null; matchGame = null; blitz = null; flash = null; raceLeave(); if (b.dataset.tab !== 'test') { if (test && !test.checked && !confirm('Leave the test? Progress on it will be lost.')) return; test = null; } render(b.dataset.tab); });

// ---- onboarding ----
function renderOnboard() {
  const box = h('div', { class: 'card' },
    h('h1', {}, 'Learn all 50 states & capitals 🇺🇸'),
    h('p', {}, 'A few new states every day, placed on a real map. Each new state gets several easy reps before you ever have to spell it, and old ones come back right before you\'d forget them — until you can fill in the whole map from memory.'),
    h('h3', {}, 'How much time do you have?'),
    h('div', { class: 'row', id: 'plen' }, [[7, '1 week 🏃 (intense)'], [14, '2 weeks'], [28, '4 weeks (chill)']].map(([d, lab]) => h('button', { class: 'btn sec small' + (planDays() === d ? ' good' : ''), onclick: () => { P.settings.planDays = d; P.settings.newPerDay = defaultPace(); render(); } }, lab))),
    h('h3', { style: 'margin-top:12px' }, 'New states per day'),
    h('p', { class: 'muted' }, planDays() <= 7 ? 'A sprint means big days — sessions run 15–25 min. The reps are built so it still sticks.' : 'Start small — fewer sticks better. You can always tap "+ Learn more" on a good day.'),
    h('div', { class: 'row', id: 'pace' }, paceOptions().map(n => h('button', { class: 'btn sec small', 'data-n': n, onclick: (e) => { P.settings.newPerDay = n; document.querySelectorAll('#pace .btn').forEach(b => b.classList.toggle('good', +b.dataset.n === n)); $('#pace-note').textContent = `All 50 learned by day ${Math.ceil(50 / n)}, then ${Math.max(0, planDays() - Math.ceil(50 / n))} day(s) of review + map tests.`; } }, `${n} / day`))),
    h('p', { class: 'muted', id: 'pace-note' }, ''),
    h('h3', {}, 'When do you want capitals?'),
    h('div', { class: 'row', id: 'capw' }, (planDays() <= 7 ? [[0, 'Together with each state'], [1, 'The next day (recommended)']] : [[0, 'Together with each state'], [2, 'A couple of days after (recommended)']]).map(([k, lab]) => h('button', { class: 'btn sec small' + (capDelay() === k ? ' good' : ''), onclick: (e) => { P.settings.capDelay = k; [...e.target.parentNode.children].forEach(b => b.classList.remove('good')); e.target.classList.add('good'); } }, lab))),
    h('p', {}, h('b', {}, 'Each day: '), 'review what\'s due (5–10 min) → meet today\'s new states → quick quiz. Miss a day? No problem, it just piles up a bit.'),
    h('div', { class: 'row' }, h('button', { class: 'btn', onclick: () => { P.onboarded = true; P.startDate = dayKey(); save(); render('today'); } }, 'Start Day 1 →'), h('button', { class: 'btn sec', onclick: accountModal }, user ? `Signed in as ${user}` : 'Sign in to save to cloud')),
  );
  view.append(box); const pb = $(`#pace .btn[data-n="${P.settings.newPerDay}"]`) || $(`#pace .btn`); pb.click();
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
  const PD = planDays(); const wk = Math.ceil(Math.min(dayNum(), PD) / 7);
  const phase = PD <= 7 ? (remaining > 0 ? `Day ${Math.min(dayNum(), PD)} of ${PD} · Sprint 🏃` : 'Sprint · Lock it in') : remaining > 0 ? `Week ${wk} · Learning phase` : dayNum() <= PD - 7 ? `Week ${wk} · Lock it in` : `Week ${wk} · Test ready`;
  const nQ = newToday.length * 5 + capNew.length * 2 + due.length;
  const caughtUp = !nQ && !cp;
  if (cp) {
    view.append(h('div', { class: 'card learn' }, h('h3', {}, 'Checkpoint'), h('h1', {}, `🏁 ${cp} states known!`), h('p', {}, `Time to prove it. Part 1: a sheet of mini-maps, one state highlighted on each — write its name${ORDER.filter(capLearned).length ? ' (and capital where you\'ve learned it)' : ''}. Part 2: fill all ${knownList().length} in on the blank map. New states pause until you've taken it — reviews still run.`),
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
      nQ ? h('button', { class: 'btn', onclick: () => { buildSession(); if (!session.queue.length) { session = null; toast('Nothing due right now — hit the Play tab!'); return; } render(); } }, d.done && !newToday.length ? `Review ${nQ} more` : `Start today's session (${nQ} questions)`) : h('button', { class: 'btn sec', onclick: () => render('play') }, 'Play a game →'),
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
  // after a miss: type the right answer once before moving on (locks it in)
  const lockIn = (answer) => { const inp = h('input', { type: 'text', autocomplete: 'off', autocapitalize: 'words', spellcheck: 'false', placeholder: `Type "${answer}" to continue`, enterkeyhint: 'done' }); const go = h('button', { class: 'btn', disabled: true, onclick: next }, 'Next →'); inp.addEventListener('input', () => { if (matches(inp.value, answer)) { inp.classList.add('good'); inp.disabled = true; go.disabled = false; go.focus(); beep('good'); } }); inp.addEventListener('keydown', e => { if (e.key === 'Enter' && !go.disabled) next(); }); setTimeout(() => inp.focus(), 50); return h('div', { style: 'margin-top:12px' }, h('div', { class: 'kbd', style: 'margin-bottom:6px' }, '✍️ Lock it in — type the answer once:'), h('div', { class: 'ans' }, inp, go)); };
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
    if (showCap) map.star(q.abbr, s.capital);
    const nbNames = s.nb.map(a => BY[a].name);
    qcard.append(h('small', { class: 'muted' }, `${session.practice ? 'MEET' : 'NEW STATE'} · ${REGION_NAME[s.region]}`), h('div', { class: 'big' }, s.name, ' ', h('span', { class: 'muted', style: 'font-size:18px' }, s.abbr)),
      showCap ? h('div', { class: 'cap' }, `★ Capital: ${s.capital}`) : h('div', { class: 'muted' }, `★ Capital: comes in ${capDelay()} day${capDelay() === 1 ? '' : 's'} — learn where it is first.`),
      h('div', { class: 'mn' }, showCap ? ['💡 ' + MNEMO[s.abbr], h('br'), h('span', { class: 'muted' }, '🎨 ' + PICTURE[s.abbr])] : (nbNames.length ? `📍 Touches ${nbNames.join(', ')}.` : `📍 Out on its own — no land neighbors.`)),
      h('p', { class: 'muted', style: 'margin-top:10px' }, 'Look at its shape and what\'s around it. Say the name out loud once — you\'ll get several easy reps before any spelling, and it comes back again in a few minutes.'), nextBtn('Got it →'));
    return;
  }
  if (q.type === 'learncap') {
    map = makeMap(mapHost); map.add(q.abbr, 'hl'); map.label(q.abbr, s.abbr); map.star(q.abbr, s.capital); map.zoomTo(q.abbr, s.bbox[2] - s.bbox[0] < 110 ? 4 : 2.4);
    qcard.classList.add('learn');
    const inp = h('input', { type: 'text', autocomplete: 'off', autocapitalize: 'words', spellcheck: 'false', placeholder: `Type "${s.capital}" to lock it in`, enterkeyhint: 'done' });
    const go = h('button', { class: 'btn', disabled: true, onclick: next }, 'Got it →');
    const ok = h('div', { class: 'feedback' });
    inp.addEventListener('input', () => { if (matches(inp.value, s.capital)) { inp.classList.add('good'); inp.disabled = true; go.disabled = false; ok.className = 'feedback good'; ok.textContent = `${s.capital}, ${s.name}. ★ marks the city on the map.`; beep('good'); go.focus(); } });
    inp.addEventListener('keydown', e => { if (e.key === 'Enter' && !go.disabled) next(); });
    qcard.append(h('small', { class: 'muted' }, `NEW CAPITAL · ${s.name}`), h('div', { class: 'big' }, s.capital), h('div', { class: 'cap' }, `is the capital of ${s.name}`), h('div', { class: 'mn' }, '💡 ' + MNEMO[s.abbr], h('br'), h('span', { class: 'muted' }, '🎨 ' + PICTURE[s.abbr])), h('p', { class: 'muted', style: 'margin-top:10px' }, `Say it out loud — "${s.capital}, ${s.name}" — then type it once:`), h('div', { class: 'ans' }, inp), ok, h('div', { class: 'row', style: 'margin-top:12px' }, go));
    setTimeout(() => inp.focus(), 50);
    return;
  }
  const finish = (ok, opts = {}) => { grade(q.abbr, q.kind, ok, { practice: q.practice, hint: opts.hint }); if (!ok) requeue(); };
  if (q.type === 'find') {
    let done = false;
    const whereHint = s.nb.length ? `It touches ${s.nb.map(a => BY[a].name).join(', ')}.` : `It's out on its own — no land neighbors.`;
    map = makeMap(mapHost, { onTap: (a) => { if (done || !a) return; done = true; const ok = a === q.abbr; map.add(q.abbr, 'good'); if (!ok) map.add(a, 'bad'); map.label(q.abbr, s.abbr); s.nb.forEach(n => map.label(n, BY[n].abbr)); finish(ok); showFb(ok, ok ? `Yes! That's ${s.name}.` : `Not quite — that was ${BY[a].name}. ${s.name} is the green one. ${whereHint}`); qcard.append(ok ? nextBtn() : lockIn(s.name)); if (ok) advanceTimer = setTimeout(next, 1100); } });
    if (q.easy) { const regionAbbrs = STATES.filter(x => x.region === s.region).map(x => x.abbr); map.zoomRegion(regionAbbrs.concat(s.nb)); s.nb.forEach(n => map.label(n, BY[n].abbr)); }
    qcard.append(h('div', { class: 'prompt' }, h('small', {}, q.easy ? 'Warm-up · Find it (neighbors are labeled)' : q.mixed ? 'Round 2 · Find it again' : q.practice ? 'Practice · Find it' : 'Find it'), `Tap ${s.name} on the map`), q.easy ? h('p', { class: 'kbd' }, `Hint: ${whereHint}`) : h('p', { class: 'kbd' }, 'Pinch or scroll to zoom in on small states.'), fb);
    return;
  }
  if (q.type === 'namemc') {
    map = makeMap(mapHost); map.add(q.abbr, 'hl'); if (s.bbox[2] - s.bbox[0] < 110) map.zoomTo(q.abbr, 4);
    const near = s.nb.length ? s.nb.map(a => BY[a].name) : STATES.filter(x => x.region === s.region && x.abbr !== s.abbr).map(x => x.name);
    const others = shuffle(STATES.filter(x => x.abbr !== s.abbr).map(x => x.name));
    const distract = shuffle(shuffle(near).slice(0, 2).concat(others).filter((v, i, a) => a.indexOf(v) === i && v !== s.name)).slice(0, 3);
    const choices = shuffle([s.name, ...distract]);
    let done = false; const grid = h('div', { class: 'choices' });
    choices.forEach(c => grid.append(h('button', { onclick: (e) => { if (done) return; done = true; const ok = c === s.name; e.target.classList.add(ok ? 'good' : 'bad'); [...grid.children].forEach(b => { if (b.textContent === s.name) b.classList.add('good'); }); map.label(q.abbr, s.abbr); finish(ok); showFb(ok, ok ? `Yes — ${s.name}!` : `That's ${s.name}.`); qcard.append(ok ? nextBtn() : lockIn(s.name)); if (ok) advanceTimer = setTimeout(next, 1000); } }, c)));
    qcard.append(h('div', { class: 'prompt' }, h('small', {}, (q.retry ? 'Try again · ' : '') + 'Which state?'), 'Which state is highlighted?'), grid, fb);
    return;
  }
  if (q.type === 'capmc') {
    map = makeMap(mapHost); map.add(q.abbr, 'hl'); map.label(q.abbr, s.abbr); map.star(q.abbr); if (s.bbox[2] - s.bbox[0] < 110) map.zoomTo(q.abbr, 4);
    const sameRegion = STATES.filter(x => x.region === s.region && x.abbr !== s.abbr).map(x => x.capital);
    const others = shuffle(STATES.filter(x => x.abbr !== s.abbr).map(x => x.capital));
    const distract = shuffle(shuffle(sameRegion).slice(0, 2).concat(others).filter((v, i, a) => a.indexOf(v) === i)).slice(0, 3);
    // ensure at least 3
    const choices = shuffle([s.capital, ...distract]);
    let done = false; const grid = h('div', { class: 'choices' });
    choices.forEach(c => grid.append(h('button', { onclick: (e) => { if (done) return; done = true; const ok = c === s.capital; e.target.classList.add(ok ? 'good' : 'bad'); [...grid.children].forEach(b => { if (b.textContent === s.capital) b.classList.add('good'); }); map.star(q.abbr, s.capital); finish(ok); showFb(ok, ok ? `Right — ${s.capital}, ${s.abbr}.` : `It's ${s.capital}.`, MNEMO[s.abbr] + (ok ? '' : ' 🎨 ' + PICTURE[s.abbr])); qcard.append(ok ? nextBtn() : lockIn(s.capital)); if (ok) advanceTimer = setTimeout(next, 1300); } }, c)));
    qcard.append(h('div', { class: 'prompt' }, h('small', {}, 'Capital'), `What is the capital of ${s.name}?`), grid, fb);
    return;
  }
  // typed: name | cap | rev
  const answer = q.type === 'name' ? s.name : q.type === 'cap' ? s.capital : s.name;
  const otherAnswers = q.type === 'cap' ? STATES.map(x => x.capital) : STATES.map(x => x.name);
  map = makeMap(mapHost);
  if (q.type !== 'rev') { map.add(q.abbr, 'hl'); if (s.bbox[2] - s.bbox[0] < 110) map.zoomTo(q.abbr, 4); }
  if (q.type === 'cap') { map.label(q.abbr, s.abbr); map.star(q.abbr); }
  const input = h('input', { type: 'text', autocomplete: 'off', autocapitalize: 'words', spellcheck: 'false', placeholder: q.type === 'cap' ? 'Type the capital…' : 'Type the state…', enterkeyhint: 'done' });
  let hints = 0; const hintBtn = h('button', { class: 'btn sec small', onclick: () => { hints++; input.value = answer.slice(0, hints); input.focus(); if (hints >= 2) hintBtn.disabled = true; } }, '💡 Hint');
  let done = false;
  const check = () => { if (done) return; const v = input.value.trim(); if (!v) return; done = true; const m = matches(v, answer, otherAnswers.filter(o => o !== answer)); const ok = !!m; input.classList.add(ok ? 'good' : 'bad'); input.disabled = true; if (q.type === 'rev') { map.add(q.abbr, 'good'); map.zoomTo(q.abbr, 4); } else map.set(q.abbr, ok ? 'good' : 'bad'); map.label(q.abbr, s.abbr); if (q.type !== 'name') map.star(q.abbr, s.capital); finish(ok, { hint: hints > 0 }); showFb(ok, ok ? (m === 'close' ? `Close enough — it's spelled "${answer}".` : `Correct! ${answer}.`) : `It's ${answer}.`, q.type !== 'name' ? MNEMO[s.abbr] + (ok ? '' : ' 🎨 ' + PICTURE[s.abbr]) : null); qcard.append(ok ? nextBtn() : lockIn(answer)); if (ok && m === 'exact') advanceTimer = setTimeout(next, 1000); };
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
  view.append(h('div', { class: 'card summary' }, h('h3', {}, prac ? `Practice complete · ${session.label || ''}` : 'Session complete'), h('div', { class: 'big' }, `+${session.xp} XP`), h('p', {}, `${session.correct}/${session.answered} correct (${acc}%). ${session.newAbbrs.length ? 'New today: ' + session.newAbbrs.map(a => BY[a].name).join(', ') + '.' : ''}`), prac ? h('p', { class: 'muted' }, 'Practice doesn\'t change your review schedule — it\'s just extra reps (and XP).') : h('p', {}, `🔥 Streak: ${P.streak} day${P.streak === 1 ? '' : 's'} · Day ${dayNum()} of ${planDays()}`), h('div', { class: 'row', style: 'margin-top:10px' }, h('button', { class: 'btn', onclick: () => { session = null; render(prac ? 'play' : 'today'); } }, 'Done'), prac ? null : remaining > 0 ? h('button', { class: 'btn sec', onclick: () => { buildSession(true); render(); } }, `+ Learn ${Math.min(P.settings.newPerDay, remaining)} more`) : h('button', { class: 'btn sec', onclick: () => { session = null; render('test'); } }, 'Try the full-map test'))));
  session = null;
}

// ---- Map tab ----
let labelMode = 'learned'; let matchGame = null;
function renderMatch() {
  const G = matchGame; const PAIRS = 6;
  if (!G.order) G.order = shuffle(G.pool);
  const chunk = G.order.slice(G.round * PAIRS, G.round * PAIRS + PAIRS);
  if (!chunk.length) { // done
    const t = Date.now() - G.t0; P.xp += 0; save(); beep('win'); confetti();
    view.append(h('div', { class: 'card summary' }, h('h3', {}, 'Match game complete'), h('div', { class: 'big' }, `+${G.xp} XP`), h('p', {}, `${G.order.length} pairs in ${fmtTime(t)} · ${G.misses} miss${G.misses === 1 ? '' : 'es'}.`), h('div', { class: 'row' }, h('button', { class: 'btn', onclick: () => { matchGame = null; render('play'); } }, 'Done'), h('button', { class: 'btn sec', onclick: () => { matchGame = { pool: G.pool, round: 0, t0: Date.now(), xp: 0, misses: 0, label: G.label }; render(); } }, 'Play again'))));
    matchGame = null; return;
  }
  const wrap = h('div', { class: 'quiz' }); const mapHost = h('div'); const qcard = h('div', { class: 'card qcard' }); wrap.append(h('div', {}, mapHost), qcard);
  view.append(h('div', { class: 'progress-top' }, h('span', {}, `Round ${G.round + 1} / ${Math.ceil(G.order.length / PAIRS)}`), h('div', { class: 'bar' }, h('i', { style: `width:${G.round / Math.ceil(G.order.length / PAIRS) * 100}%` })), h('span', {}, `+${G.xp} XP`), h('button', { class: 'pill ghost', onclick: () => { matchGame = null; render('play'); } }, 'Exit')), wrap);
  const map = makeMap(mapHost); chunk.forEach(a => map.add(a, 'hl')); map.zoomRegion(chunk); chunk.forEach(a => map.label(a, BY[a].abbr));
  const left = h('div', { class: 'matchcol' }), right = h('div', { class: 'matchcol' }); let selL = null, selR = null, matched = 0;
  const lb = {}, rb = {};
  const tryMatch = () => { if (!selL || !selR) return; const okm = selL === selR; if (okm) { lb[selL].classList.add('done'); rb[selR].classList.add('done'); lb[selL].disabled = rb[selR].disabled = true; map.set(selL, 'good'); map.star(selL, BY[selL].capital); G.xp += 3; P.xp += 3; beep('good'); matched++; if (matched === chunk.length) { save(); G.round++; setTimeout(() => { view.innerHTML = ''; renderMatch(); }, 900); } } else { G.misses++; const a = lb[selL], b = rb[selR]; a.classList.add('bad'); b.classList.add('bad'); beep('bad'); setTimeout(() => { a.classList.remove('bad'); b.classList.remove('bad'); }, 500); } lb[selL].classList.remove('sel'); rb[selR].classList.remove('sel'); selL = selR = null; };
  shuffle(chunk).forEach(a => { const b = h('button', { onclick: () => { if (selL) lb[selL].classList.remove('sel'); selL = a; b.classList.add('sel'); map.zoomRegion(chunk); tryMatch(); } }, BY[a].name); lb[a] = b; left.append(b); });
  shuffle(chunk).forEach(a => { const b = h('button', { onclick: () => { if (selR) rb[selR].classList.remove('sel'); selR = a; b.classList.add('sel'); tryMatch(); } }, BY[a].capital); rb[a] = b; right.append(b); });
  qcard.append(h('div', { class: 'prompt' }, h('small', {}, 'Match game · ' + G.label), 'Tap a state, then its capital'), h('div', { class: 'matchgrid' }, left, right), h('p', { class: 'kbd', style: 'margin-top:10px' }, 'Matched pairs light up green on the map with a ★ on the capital city.'));
}
function renderMap() {
  if (matchGame) return renderMatch();
  const learned = learnedList();
  const top = h('div', { class: 'card' }, h('div', { class: 'row' }, h('div', { class: 'grow' }, h('h1', {}, 'Progress map'), h('p', { class: 'muted' }, `${learned.length}/50 met · ${ORDER.filter(a => mastery(a) >= 4).length} mastered. Tap any state for its info and memory hooks.`)),
    h('div', { class: 'seg' }, ['none', 'learned', 'all'].map(m => h('button', { class: labelMode === m ? 'on' : '', onclick: () => { labelMode = m; render(); } }, m === 'none' ? 'No labels' : m === 'learned' ? 'Label learned' : 'Label all')))),
    h('div', { class: 'region-legend', style: 'margin-top:6px' }, h('span', {}, h('i', { style: 'background:var(--land)' }), 'not yet'), h('span', {}, h('i', { style: 'background:var(--m1)' }), 'met'), h('span', {}, h('i', { style: 'background:var(--m3)' }), 'getting there'), h('span', {}, h('i', { style: 'background:var(--m5)' }), 'mastered')));
  const host = h('div'); top.append(host); view.append(top);
  const m = makeMap(host, { onTap: (a) => a && stateModal(a) }); paintMastery(m);
  STATES.forEach(s => { if (labelMode === 'all' || (labelMode === 'learned' && introduced(s.abbr))) m.label(s.abbr, s.abbr); });
  const list = h('div', { class: 'slist' });
  ORDER.forEach(a => { const s = BY[a]; const k = mastery(a); list.append(h('div', { class: 's m' + k, onclick: () => stateModal(a) }, h('span', {}, h('b', {}, s.name), h('br'), h('span', { class: 'muted' }, s.capital)), h('span', { class: 'stars' }, introduced(a) ? stars(k) : '·'))); });
  view.append(h('div', { class: 'card' }, h('h2', {}, 'All 50 states (learning order)'), h('p', { class: 'muted' }, 'Grouped by region so neighbors are learned together. Tap any state for its memory hook — or to pull it into today\'s lesson early.'), list));
}
// ---- Play tab: every game in one place ----
function renderPlay() {
  if (matchGame) return renderMatch();
  if (blitz) return renderBlitz();
  if (race) return renderRace();
  if (flash) return renderFlash();
  const learned2 = learnedList();
  const capPool = ORDER.filter(capLearned); const capAny = capPool.length >= 4 ? capPool : learned2.length >= 4 ? learned2 : ORDER;
  const blitzPool = learned2.length >= 8 ? learned2 : ORDER;
  view.append(h('div', { class: 'card' }, h('h1', {}, 'Play 🎮'), h('p', { class: 'muted' }, 'Games are extra reps — they earn XP but never mess up your daily review schedule.')));
  // multiplayer
  view.append(h('div', { class: 'card learn' }, h('h2', {}, '⚔️ Race a friend (multiplayer)'),
    h('p', {}, 'Same map, same prompts, first correct tap wins the round. Up to 8 players — share the room code, works across phones/laptops on this site.'),
    h('div', { class: 'row' },
      h('input', { id: 'race-name', type: 'text', placeholder: 'Your name', autocomplete: 'off', maxlength: '20', value: user || localStorage.getItem('sl.user') || '', style: 'width:140px;padding:10px;border:2px solid var(--line);border-radius:12px;font-weight:800;font-size:15px' }),
      h('button', { class: 'btn', onclick: () => raceStart(null) }, 'Create room'),
      h('input', { id: 'join-code', type: 'text', placeholder: 'CODE', autocapitalize: 'characters', autocomplete: 'off', maxlength: '4', style: 'width:86px;padding:10px;border:2px solid var(--line);border-radius:12px;font-weight:900;text-transform:uppercase;font-size:16px', onkeydown: (e) => { if (e.key === 'Enter') raceStart(e.target.value); } }),
      h('button', { class: 'btn sec', onclick: () => raceStart($('#join-code').value) }, 'Join'))));
  // blitz
  view.append(h('div', { class: 'card' }, h('h2', {}, '⚡ Blitz — 60 second race'),
    h('p', { class: 'muted' }, `Tap as many as you can in 60 seconds. Streaks build a combo multiplier. ${P.blitzBest ? `🏆 Best: ${P.blitzBest.score} (${P.blitzBest.hits} states)` : 'No best score yet — set one!'}`),
    h('div', { class: 'row' },
      h('button', { class: 'btn small', onclick: () => { startBlitz(blitzPool, 'states'); } }, `States (${blitzPool.length})`),
      capPool.length >= 8 ? h('button', { class: 'btn sec small', onclick: () => { startBlitz(capPool, 'capitals'); } }, `Capitals (${capPool.length})`) : null,
      h('button', { class: 'btn sec small', onclick: () => { startBlitz(ORDER, 'mixed'); } }, 'All 50 mixed'))));
  // free practice
  view.append(h('div', { class: 'card' }, h('h2', {}, '🎯 Free practice'), h('p', { class: 'muted' }, 'Any region, any time. States you haven\'t met yet get a quick intro first.'),
    h('div', { class: 'row' }, Object.entries(REGION_NAME).map(([r, nm]) => { const abbrs = STATES.filter(x => x.region === r).map(x => x.abbr); const met = abbrs.filter(introduced).length; return h('button', { class: 'btn sec small', onclick: () => { buildPractice(abbrs, nm); render(); } }, `${nm} `, h('span', { class: 'muted' }, `${met}/${abbrs.length}`)); }),
      h('button', { class: 'btn small', onclick: () => { if (!learned2.length) return toast('Meet a few states first — or pick a region!'); buildPractice(learned2, 'Everything learned'); render(); } }, `All learned (${learned2.length})`),
      h('button', { class: 'btn small', onclick: () => { buildPractice(ORDER, 'All 50'); render(); } }, 'All 50 🇺🇸'))));
  // capitals drill
  view.append(h('div', { class: 'card' }, h('h2', {}, '🏛️ Capitals drill'), h('p', { class: 'muted' }, `Extra reps just for capitals. ${capPool.length} capital${capPool.length === 1 ? '' : 's'} learned so far${capPool.length < 4 ? ' — drills use your learned states (or all 50) until you have more' : ''}.`),
    h('div', { class: 'row' },
      h('button', { class: 'btn small', onclick: () => { matchGame = { pool: capAny, round: 0, t0: Date.now(), xp: 0, misses: 0, label: capPool.length >= 4 ? 'learned capitals' : 'states' }; render(); } }, '🧩 Match game'),
      h('button', { class: 'btn sec small', onclick: () => { buildPractice(capAny, 'Capital → State', ['rev']); render(); } }, 'Capital → State'),
      h('button', { class: 'btn sec small', onclick: () => { buildPractice(capAny, 'Type the capitals', ['cap']); render(); } }, '⌨️ Type the capitals'),
      h('button', { class: 'btn sec small', onclick: () => { buildPractice(ORDER, 'All 50 capitals', ['capmc', 'cap']); render(); } }, 'All 50 capitals')),
    h('h3', { style: 'margin-top:14px' }, '🃏 Flashcards'),
    h('div', { class: 'row' },
      h('button', { class: 'btn small', onclick: () => startFlash(capAny, 'state') }, `State → Capital (${capAny.length})`),
      h('button', { class: 'btn sec small', onclick: () => startFlash(capAny, 'capital') }, 'Capital → State'),
      h('button', { class: 'btn sec small', onclick: () => startFlash(capAny, 'mixed') }, 'Mixed'),
      h('button', { class: 'btn sec small', onclick: () => startFlash(ORDER, 'mixed') }, 'All 50'))));
  // drag practice
  view.append(h('div', { class: 'card' }, h('h2', {}, '🧲 Drag the tiles'), h('p', { class: 'muted' }, 'Pile of name tiles, blank map — drag each one home. Instant feedback, great warm-up before a real test.'),
    h('div', { class: 'row' },
      h('button', { class: 'btn small', onclick: () => { test = { drag: true, practice: true, bank: 'states', instant: true, scope: (learned2.length >= 5 ? learned2 : ORDER).slice(), ans: {}, locked: {}, t0: Date.now(), checked: false }; render('test'); } }, 'State names'),
      h('button', { class: 'btn sec small', onclick: () => { test = { drag: true, practice: true, bank: 'capitals', instant: true, scope: (capPool.length >= 5 ? capPool : (learned2.length >= 5 ? learned2 : ORDER)).slice(), ans: {}, locked: {}, t0: Date.now(), checked: false }; render('test'); } }, 'Capitals onto states'))));
  // tricky states
  const tricky = ORDER.filter(a => introduced(a) && (card(a, 'loc').wrong + card(a, 'cap').wrong) >= 2).sort((x, y) => (card(y, 'loc').wrong + card(y, 'cap').wrong) - (card(x, 'loc').wrong + card(x, 'cap').wrong)).slice(0, 10);
  if (tricky.length) view.append(h('div', { class: 'card' }, h('h2', {}, '🎯 Your tricky ones'), h('p', { class: 'muted' }, 'The states you\'ve missed the most. Ten focused minutes here beats an hour everywhere else.'),
    h('div', { class: 'row' }, tricky.map(a => h('span', { class: 'chip bad', onclick: () => stateModal(a), style: 'cursor:pointer' }, `${BY[a].name} ✗${card(a, 'loc').wrong + card(a, 'cap').wrong}`))),
    h('div', { class: 'row', style: 'margin-top:10px' }, h('button', { class: 'btn small', onclick: () => { buildPractice(tricky, 'Tricky states'); render(); } }, 'Practice these'), h('button', { class: 'btn sec small', onclick: () => startFlash(tricky, 'mixed') }, 'Flashcards'))));
  view.append(h('div', { class: 'card' }, h('h2', {}, '🏁 The big test'), h('p', { class: 'muted' }, 'Blank map, write everything in — the real deal lives on the Test tab.'), h('div', { class: 'row' }, h('button', { class: 'btn sec small', onclick: () => render('test') }, 'Go to Test →'))));
}
// ---- Flashcards (capitals) ----
let flash = null;
function startFlash(pool, front) { flash = { queue: shuffle(pool.slice()), front, i: 0, got: 0, again: 0, seen: new Set(), missed: new Set(), flipped: false, t0: Date.now() }; render('play'); }
function renderFlash() {
  const F = flash;
  if (!F.queue.length) {
    P.xp += F.got * 2; save(); beep('win'); if (!F.missed.size) confetti();
    view.append(h('div', { class: 'card summary' }, h('h3', {}, '🃏 Deck done'), h('div', { class: 'big' }, `+${F.got * 2} XP`), h('p', {}, `${F.seen.size} cards · ${F.missed.size ? F.missed.size + ' needed a retry: ' + [...F.missed].map(a => BY[a].name).join(', ') : 'no retries — clean run! 🎉'}`), h('div', { class: 'row', style: 'margin-top:10px' }, h('button', { class: 'btn', onclick: () => startFlash([...F.seen], F.front) }, 'Again'), F.missed.size ? h('button', { class: 'btn sec', onclick: () => startFlash([...F.missed], F.front) }, `Just the ${F.missed.size} tricky`) : null, h('button', { class: 'btn sec', onclick: () => { flash = null; render('play'); } }, 'Done'))));
    flash = null; return;
  }
  const a = F.queue[0]; const st = BY[a];
  const frontIsState = F.front === 'state' || (F.front === 'mixed' && (a.charCodeAt(0) + a.charCodeAt(1)) % 2 === 0);
  const frontTxt = frontIsState ? st.name : st.capital;
  const backTxt = frontIsState ? st.capital : st.name;
  view.append(h('div', { class: 'progress-top' }, h('span', {}, `🃏 ${F.seen.size} / ${F.seen.size + new Set(F.queue.filter(x => !F.seen.has(x))).size}`), h('div', { class: 'bar' }, h('i', { style: `width:${F.seen.size / Math.max(1, F.seen.size + F.queue.length) * 100}%` })), h('span', {}, `✅ ${F.got}`), h('button', { class: 'pill ghost', onclick: () => { flash = null; render('play'); } }, 'Exit')));
  const mini = h('div', { class: 'fmini' });
  const card0 = h('div', { class: 'fcard' + (F.flipped ? ' flipped' : ''), onclick: () => { if (!F.flipped) { F.flipped = true; render('play'); } } },
    h('div', { class: 'finner' },
      h('div', { class: 'fface front' }, h('small', {}, frontIsState ? 'STATE' : 'CAPITAL'), h('div', { class: 'ftxt' }, frontTxt), h('span', { class: 'muted' }, 'tap to flip')),
      h('div', { class: 'fface back' }, h('small', {}, frontIsState ? 'CAPITAL' : 'STATE'), h('div', { class: 'ftxt' }, backTxt), h('div', { class: 'fmn' }, '💡 ' + MNEMO[a]))));
  const row = h('div', { class: 'row', style: 'margin-top:14px;justify-content:center' });
  if (F.flipped) row.append(
    h('button', { class: 'btn sec', onclick: () => { F.missed.add(a); F.again++; F.seen.add(a); F.queue.push(F.queue.shift()); F.flipped = false; beep('bad'); render('play'); } }, '🔁 Again'),
    h('button', { class: 'btn good', onclick: () => { F.seen.add(a); F.got++; F.queue.shift(); F.flipped = false; beep('good'); render('play'); } }, '✅ Got it'));
  else row.append(h('button', { class: 'btn', onclick: () => { F.flipped = true; render('play'); } }, 'Flip →'));
  const wrap = h('div', { class: 'card', style: 'max-width:560px;margin:0 auto' }, card0, row, mini);
  view.append(wrap);
  const mm = makeMap(mini, { tools: false }); mm.add(a, 'hl'); mm.label(a, st.abbr); if (F.flipped) mm.star(a, st.capital); mm.zoomTo(a, 3.2); const hint = mini.querySelector('.hint'); if (hint) hint.remove();
}
// ---- Blitz ----
let blitz = null;
function startBlitz(pool, mode) { blitz = { pool: pool.slice(), mode, score: 0, hits: 0, miss: 0, combo: 0, end: Date.now() + 60000, cur: null, done: false }; render('play'); }
function blitzNext() { const B = blitz; const last = B.cur && B.cur.abbr; let a; do { a = pick(B.pool); } while (B.pool.length > 1 && a === last); const cap = B.mode === 'capitals' || (B.mode === 'mixed' && capLearned(a) && Math.random() < .5); B.cur = { abbr: a, cap }; }
function renderBlitz() {
  const B = blitz;
  if (!B.cur) blitzNext();
  const timeEl = h('b', {}, ''); const scoreEl = h('b', {}, String(B.score)); const comboEl = h('span', { class: 'chip acc' }, '');
  const prompt = h('div', { class: 'prompt' });
  const wrap = h('div', { class: 'quiz' }); const mapHost = h('div'); const qcard = h('div', { class: 'card qcard' });
  wrap.append(h('div', {}, mapHost), qcard);
  view.append(h('div', { class: 'progress-top' }, h('span', {}, '⚡ Blitz'), h('div', { class: 'bar', style: 'flex:1' }, h('i', { id: 'blitz-bar', style: 'width:100%' })), h('span', {}, '⏱ ', timeEl), h('span', {}, '⭐ ', scoreEl), comboEl, h('button', { class: 'pill ghost', onclick: () => { blitz = null; render('play'); } }, 'Exit')), wrap);
  const m = makeMap(mapHost, { onTap: (a) => {
    if (!a || B.done) return;
    const ok = a === B.cur.abbr;
    if (ok) { B.hits++; B.combo++; const gain = 10 * Math.min(4, 1 + Math.floor(B.combo / 5)); B.score += gain; beep('good'); m.set(a, 'good'); setTimeout(() => { if (!B.done) m.set(a, ''); }, 350); }
    else { B.miss++; B.combo = 0; beep('bad'); m.add(a, 'bad'); m.add(B.cur.abbr, 'good'); m.label(B.cur.abbr, BY[B.cur.abbr].abbr); const wrongA = a, rightA = B.cur.abbr; setTimeout(() => { if (!B.done) { m.set(wrongA, ''); m.set(rightA, ''); m.label(rightA, null); } }, 700); }
    scoreEl.textContent = B.score; comboEl.textContent = B.combo >= 5 ? `🔥 x${Math.min(4, 1 + Math.floor(B.combo / 5))}` : '';
    blitzNext(); showPrompt();
  } });
  const showPrompt = () => { const s = BY[B.cur.abbr]; prompt.innerHTML = ''; prompt.append(h('small', {}, B.cur.cap ? 'Whose capital is…' : 'Find it fast'), B.cur.cap ? `${s.capital}!` : s.name); };
  showPrompt();
  qcard.append(prompt, h('p', { class: 'kbd' }, 'Correct = +10 (combos up to x4). Wrong just resets your combo — keep tapping!'));
  const tick = () => {
    if (!blitz || blitz !== B) return;
    const left = B.end - Date.now();
    timeEl.textContent = Math.max(0, Math.ceil(left / 1000)) + 's';
    const bar = $('#blitz-bar'); if (bar) bar.style.width = Math.max(0, left / 60000 * 100) + '%';
    if (left <= 0) { B.done = true; finishBlitz(B); return; }
    B._t = setTimeout(tick, 200);
  }; tick();
}
function finishBlitz(B) {
  clearTimeout(B._t);
  const acc = B.hits + B.miss ? Math.round(B.hits / (B.hits + B.miss) * 100) : 100;
  P.xp += Math.round(B.score / 5);
  const isBest = !P.blitzBest || B.score > P.blitzBest.score;
  if (isBest) P.blitzBest = { score: B.score, hits: B.hits, mode: B.mode, date: dayKey() };
  save(); if (isBest && B.score > 0) { confetti(); beep('win'); } else beep('good');
  view.innerHTML = '';
  view.append(h('div', { class: 'card summary' }, h('h3', {}, '⚡ Blitz over'), h('div', { class: 'big' }, String(B.score)), h('p', {}, `${B.hits} correct · ${B.miss} wrong (${acc}%) · +${Math.round(B.score / 5)} XP${isBest && B.score > 0 ? ' · 🏆 NEW BEST!' : P.blitzBest ? ` · best ${P.blitzBest.score}` : ''}`), h('div', { class: 'row', style: 'margin-top:10px' }, h('button', { class: 'btn', onclick: () => startBlitz(B.pool, B.mode) }, 'Again!'), h('button', { class: 'btn sec', onclick: () => { blitz = null; render('play'); } }, 'Done'))));
  blitz = null;
}
// ---- Race (multiplayer over WebSocket) ----
let race = null;
function raceLeave() { if (race && race.ws) { try { race.ws.close(); } catch {} } race = null; }
function raceStart(code) {
  const field = $('#race-name');
  const name = ((field && field.value) || user || localStorage.getItem('sl.user') || '').trim().slice(0, 20);
  if (!name) { toast('Type your name first!'); field && field.focus(); return; }
  localStorage.setItem('sl.user', name);
  if (code != null && !String(code).trim()) { toast('Type the room code to join.'); $('#join-code') && $('#join-code').focus(); return; }
  const proto = location.protocol === 'https:' ? 'wss' : 'ws';
  const ws = new WebSocket(`${proto}://${location.host}/ws`);
  race = { ws, code: null, you: null, roster: [], state: 'connecting', prompt: null, roundI: 0, roundN: 0, lastResult: null, log: [], name };
  ws.onopen = () => ws.send(JSON.stringify(code ? { t: 'join', code: String(code).toUpperCase().trim(), name } : { t: 'create', name }));
  ws.onmessage = (ev) => { const m = JSON.parse(ev.data); raceMsg(m); };
  ws.onclose = () => { if (race && race.ws === ws && race.state !== 'ended') { toast('Disconnected from the room'); race = null; if (tab === 'play') render(); } };
  render('play');
}
function raceMsg(m) {
  const R = race; if (!R) return;
  if (m.t === 'err') { toast(m.msg); raceLeave(); if (tab === 'play') render(); return; }
  if (m.t === 'room') { R.code = m.code; R.you = m.you; R.roster = m.roster; R.state = 'lobby'; }
  if (m.t === 'roster') R.roster = m.roster;
  if (m.t === 'grabStart') { R.state = 'grab'; R.grabMode = m.mode; R.scope = m.scope; R.claimed = {}; R.roster = m.roster; R.sel = null; R.locked = {}; }
  if (m.t === 'claimed') { R.claimed[m.abbr] = m.id; R.roster = m.roster; R.left = m.left; if (R.sel === m.abbr) R.sel = null; if (m.id === R.you) beep('good'); }
  if (m.t === 'claimfail') { if (m.reason === 'taken') { R.claimed[m.abbr] = m.by; toast('Too slow — already claimed!'); } else { R.locked[m.abbr] = Date.now() + 4000; beep('bad'); } if (R.sel === m.abbr) R.sel = null; }
  if (m.t === 'starting') { R.state = 'starting'; R.roster = m.roster; R.lastResult = null; }
  if (m.t === 'round') { R.state = 'playing'; R.prompt = m.prompt; R.roundI = m.i; R.roundN = m.n; R.roster = m.roster; R.answered = false; R.lastResult = null; }
  if (m.t === 'wrong') { R.answered = true; }
  if (m.t === 'roundEnd') { R.state = 'between'; R.lastResult = m; R.roster = m.roster; }
  if (m.t === 'gameEnd') { if (m.grab) R.grabTime = m.time; R.state = 'ended'; R.roster = m.roster; const me = m.roster.find(p => p.id === R.you); const win = m.roster.slice().sort((a, b) => b.score - a.score)[0]; if (me && win && me.id === win.id && m.roster.length > 1) { confetti(); beep('win'); } P.xp += 20; save(); }
  if (tab === 'play') render();
}
function renderRace() {
  const R = race;
  const board = () => h('div', { class: 'raceboard' }, R.roster.slice().sort((a, b) => b.score - a.score).map((p, i) => h('div', { class: 'racerow' + (p.id === R.you ? ' me' : '') }, h('span', {}, h('i', { class: p.id === R.you ? 'pdot' : 'pdot c' + (p.color || 0) }), `${i === 0 && p.score > 0 ? '👑 ' : ''}${p.name}${p.host ? ' ⭐' : ''}${p.id === R.you ? ' (you)' : ''}`), h('b', {}, String(p.score)))));
  if (R.state === 'connecting') { view.append(h('div', { class: 'card' }, h('h2', {}, 'Connecting…'), h('button', { class: 'btn sec small', onclick: () => { raceLeave(); render(); } }, 'Cancel'))); return; }
  const iAmHost = R.roster.find(p => p.id === R.you)?.host;
  if (R.state === 'lobby' || R.state === 'ended') {
    const opts = { rounds: 10, mode: 'mixed' };
    view.append(h('div', { class: 'card learn' },
      h('h3', {}, R.state === 'ended' ? 'Final standings' : 'Race lobby'),
      h('div', { class: 'row' }, h('h1', { class: 'grow' }, R.state === 'ended' ? (R.grabTime ? `🏆 Map filled in ${fmtTime(R.grabTime)}!` : '🏆 Race over!') : 'Room code:'), R.state === 'ended' ? null : h('div', { class: 'roomcode' }, R.code)),
      R.state === 'ended' ? null : h('p', { class: 'muted' }, `Friends open ${location.host} → Play → type ${R.code} → Join. ${R.roster.length} player${R.roster.length === 1 ? '' : 's'} in.`),
      board(),
      h('div', { class: 'row', style: 'margin-top:12px' },
        iAmHost ? h('div', { class: 'row' },
          h('button', { class: 'btn', onclick: () => R.ws.send(JSON.stringify({ t: 'start', game: 'grab', mode: 'states' })) }, R.state === 'ended' ? '🗺️ Land grab again!' : '🗺️ Land grab — fill the map'),
          h('button', { class: 'btn sec', onclick: () => R.ws.send(JSON.stringify({ t: 'start', game: 'grab', mode: 'capitals' })) }, '🏛️ Land grab: capitals'),
          h('button', { class: 'btn sec', onclick: () => R.ws.send(JSON.stringify({ t: 'start', rounds: 10, mode: 'mixed' })) }, '⚡ Round race')) : h('p', { class: 'muted' }, R.state === 'ended' ? 'Waiting for the host to pick a rematch…' : 'Waiting for the host to start…'),
        h('button', { class: 'btn sec', onclick: () => { raceLeave(); render(); } }, 'Leave'))));
    if (R.state !== 'ended') view.append(h('div', { class: 'card' }, h('h3', {}, 'The games'), h('p', {}, h('b', {}, '🗺️ Land grab: '), 'one shared map on every screen. Tap any open state, pick its name (or capital) from 4 choices — get it right and it\'s YOURS, painted your color live on everyone\'s map. Wrong = that state locks for you for 4s. When the map is full, most states wins.'), h('p', {}, h('b', {}, '⚡ Round race: '), 'same prompt for everyone, first correct tap wins the round.')));
    return;
  }
  if (R.state === 'grab') return renderGrab(R);
  if (R.state === 'starting') { view.append(h('div', { class: 'card summary' }, h('h1', {}, 'Get ready… 3, 2, 1 🏁'), board())); return; }
  // playing / between rounds
  const wrap = h('div', { class: 'quiz' }); const mapHost = h('div'); const qcard = h('div', { class: 'card qcard' });
  wrap.append(h('div', {}, mapHost), qcard);
  view.append(h('div', { class: 'progress-top' }, h('span', {}, `Round ${R.roundI + 1}/${R.roundN}`), h('div', { class: 'bar' }, h('i', { style: `width:${(R.roundI) / R.roundN * 100}%` })), h('span', {}, `Room ${R.code}`), h('button', { class: 'pill ghost', onclick: () => { raceLeave(); render(); } }, 'Leave')), wrap);
  const m = makeMap(mapHost, { onTap: (a) => { if (!a || R.state !== 'playing' || R.answered) return; R.ws.send(JSON.stringify({ t: 'tap', abbr: a })); m.add(a, 'sel'); } });
  if (R.state === 'between' && R.lastResult) {
    m.add(R.lastResult.answer, 'good'); m.label(R.lastResult.answer, BY[R.lastResult.answer].abbr); m.star(R.lastResult.answer, R.lastResult.capital);
    const winner = R.roster.find(p => p.id === R.lastResult.winner);
    qcard.append(h('div', { class: 'prompt' }, h('small', {}, 'Round ' + (R.lastResult.i + 1)), winner ? `${winner.id === R.you ? '🎉 You got it!' : winner.name + ' got it!'}` : 'Nobody got it!'), h('div', { class: 'feedback ' + (winner && winner.id === R.you ? 'good' : 'bad'), style: 'display:block' }, `${R.lastResult.name} — ${R.lastResult.capital}`), board());
  } else {
    qcard.append(h('div', { class: 'prompt' }, h('small', {}, R.answered ? '❌ Locked out this round' : 'First correct tap wins'), R.prompt.text), board());
  }
}
function stateModal(a) {
  const s = BY[a]; const k = mastery(a); const loc = card(a, 'loc'), cap = card(a, 'cap');
  const m = $('#modal'); m.classList.remove('hidden'); m.innerHTML = '';
  const mini = h('div', { style: 'margin:8px 0' });
  const box = h('div', { class: 'box' }, h('h2', {}, s.name, ' ', h('span', { class: 'muted' }, s.abbr)), h('p', {}, h('b', {}, 'Capital: '), s.capital, h('span', { class: 'muted' }, ` · ${REGION_NAME[s.region]}`)), mini, h('p', { class: 'muted' }, '💡 ' + MNEMO[a]), h('p', { class: 'muted' }, '🎨 ' + PICTURE[a]),
    introduced(a) ? [h('p', {}, h('span', { class: 'stars' }, stars(k)), ` · location ${loc.right}/${loc.seen} · capital ${cap.right}/${cap.seen}`), h('p', { class: 'muted' }, `Next review: ${Math.min(loc.due, cap.due) <= dayStart() ? 'today' : fmtDate(new Date(Math.min(loc.due, cap.due)))}`)] : h('p', { class: 'muted' }, `Not in your lessons yet — it's scheduled around day ${Math.ceil((ORDER.indexOf(a) + 1) / P.settings.newPerDay)}.`),
    h('div', { class: 'row', style: 'margin-top:10px' }, h('button', { class: 'btn', onclick: closeModal }, 'Close'),
      introduced(a) ? h('button', { class: 'btn sec', onclick: () => { closeModal(); buildPractice([a], s.name); render(); } }, 'Quiz me on it') : h('button', { class: 'btn sec', onclick: () => { const d = ensureDay(dayKey()); introduce(a); d.newIntro.push(a); d.done = false; save(); closeModal(); toast(`${s.name} added to today's lesson`); render('today'); } }, "Add to today's lesson")));
  const mm = makeMap(mini, { tools: false }); mm.add(a, 'hl'); mm.label(a, s.abbr); mm.star(a, s.capital); mm.zoomTo(a, 3); mini.querySelector('.hint').remove();
  m.append(box); m.onclick = (e) => { if (e.target === m) closeModal(); };
}
function closeModal() { $('#modal').classList.add('hidden'); }

// ---- Test tab ----
let test = null;
let testDraft = null;
function renderTest() {
  if (test) return test.drag ? renderDragRun() : renderTestRun();
  const learned = learnedList();
  const best = P.best;
  const d = testDraft || (testDraft = { style: 'type', caps: true, bank: 'capitals', instant: false, scope: learned.length >= 50 ? 'all' : 'learned' });
  const seg = (opts, cur, set) => h('div', { class: 'seg' }, opts.map(([v, lab]) => h('button', { class: cur === v ? 'on' : '', onclick: () => { set(v); render('test'); } }, lab)));
  const box = h('div', { class: 'card' }, h('h1', {}, 'Fill in the map 🏁'),
    h('p', {}, d.style === 'drag' ? 'A blank map and a pile of name tiles — drag each tile onto the right state.' : 'A blank map, borders only. Tap each state and write its name (and capital). Then check your answers — just like the real test.'),
    h('h3', {}, 'How you answer'), seg([['type', '⌨️ Type them in'], ['drag', '🧲 Drag the tiles']], d.style, v => d.style = v),
    d.style === 'type'
      ? h('div', {}, h('h3', { style: 'margin-top:12px' }, 'What to fill in'), seg([[true, 'States + capitals'], [false, 'States only']], d.caps, v => d.caps = v))
      : h('div', {}, h('h3', { style: 'margin-top:12px' }, 'What\'s on the tiles'), seg([['states', 'State names'], ['capitals', 'Capital names']], d.bank, v => d.bank = v), d.bank === 'capitals' ? h('p', { class: 'muted', style: 'margin-top:4px' }, 'Drag each capital onto its state — tests capitals AND locations at once.') : null),
    h('h3', { style: 'margin-top:12px' }, 'Which states'), seg([['learned', `Learned so far (${learned.length})`], ['all', 'All 50']], d.scope, v => d.scope = v),
    h('h3', { style: 'margin-top:12px' }, 'Feedback'), seg([[false, 'Check at the end'], [true, 'Check as I go']], d.instant, v => d.instant = v),
    h('div', { class: 'row', style: 'margin-top:16px' }, h('button', { class: 'btn', onclick: () => { const scope = d.scope === 'all' ? ORDER.slice() : learned.slice(); if (!scope.length) return toast('Learn a few states first!'); test = d.style === 'drag' ? { drag: true, bank: d.bank, instant: d.instant, scope, ans: {}, locked: {}, t0: Date.now(), checked: false } : { caps: d.caps, instant: d.instant, scope, ans: {}, t0: Date.now(), sel: null, checked: false }; render(); } }, 'Start test')),
    best ? h('p', { class: 'muted', style: 'margin-top:10px' }, `🏆 Best full test: ${best.states}/50 states${best.caps != null ? `, ${best.caps}/50 capitals` : ''} in ${fmtTime(best.time)} (${best.date})`) : null,
  );
  view.append(box);
  if (P.tests.length) { const hist = h('div', { class: 'result-list' }); P.tests.slice(-10).reverse().forEach(t => hist.append(h('div', {}, h('span', {}, `${t.date} · ${t.n} states${t.scope === 'all' ? '' : ' (learned)'}${t.mode === 'drag' ? (t.bank === 'capitals' ? ' · drag capitals' : ' · drag') : ''}`), h('span', {}, `${t.states}/${t.n}${t.caps != null ? ` · caps ${t.caps}/${t.n}` : ''} · ${fmtTime(t.time)}`)))); view.append(h('div', { class: 'card' }, h('h2', {}, 'Past tests'), hist)); }
}
// ---- drag-the-tiles test ----
function renderDragRun() {
  const T = test; const inScope = new Set(T.scope);
  const label = (a) => T.bank === 'capitals' ? BY[a].capital : BY[a].name;
  if (!T.tray) T.tray = shuffle(T.scope.slice());
  const wrap = h('div', { class: 'testpanel' }); const mapHost = h('div'); const panel = h('div', { class: 'card qcard' }); wrap.append(h('div', {}, mapHost), panel); view.append(wrap);
  const m = makeMap(mapHost, { onTap: (a) => { if (T.checked) { if (a) showRes(a); return; } if (a && T.ans[a] && !T.locked[a]) { T.tray.push(T.ans[a]); delete T.ans[a]; refresh(); } } });
  STATES.forEach(s => { if (!inScope.has(s.abbr)) m.add(s.abbr, 'dim'); });
  const count = h('b'); const timer = h('span', { class: 'muted' }); const status = h('div', { class: 'feedback' });
  const tray = h('div', { class: 'dtray' });
  const results = h('div', { class: 'result-list', style: 'margin-top:10px' });
  const finishBtn = h('button', { class: 'btn good', onclick: checkAll }, 'Finish & check ✓');
  const exitBtn = h('button', { class: 'btn sec small', onclick: () => { if (T.checked || T.practice || confirm('Leave the test? Progress on it will be lost.')) { test = null; render(T.practice ? 'play' : 'test'); } } }, 'Exit');
  const title = h('div', { class: 'prompt' }, h('small', {}, T.practice ? 'Practice · drag the tiles' : 'Drag the tiles onto the map'), T.bank === 'capitals' ? 'Where does each capital go?' : 'Where does each state name go?');
  panel.append(title, h('p', {}, 'Placed: ', count, ` / ${T.scope.length} · `, timer), h('p', { class: 'kbd' }, 'Drag a tile onto a state. Tap a placed state to take its tile back. Pinch/scroll the map to zoom for the little ones.'), tray, status, h('div', { class: 'row', style: 'margin-top:12px' }, finishBtn, exitBtn), results);
  const tick = () => { timer.textContent = fmtTime((T.end || Date.now()) - T.t0); if (test === T && !T.checked) T._tm = setTimeout(tick, 1000); }; tick();
  const short = (a, txt) => (txt.length > 11 && BY[a].area < 3000) ? txt.slice(0, 9) + '…' : txt;
  function paint() { for (const a of T.scope) { const it = T.ans[a]; if (T.checked) { const ok = it === a; m.set(a, ok ? 'good' : 'bad'); m.label(a, BY[a].abbr); if (T.bank === 'capitals' && ok) m.star(a, BY[a].capital); } else if (it) { m.set(a, T.locked[a] ? 'good' : 'filled'); m.label(a, short(a, label(it))); if (T.locked[a] && T.bank === 'capitals') m.star(a); } else { m.set(a, ''); m.label(a, null); } } }
  function refresh() {
    count.textContent = Object.keys(T.ans).length;
    tray.innerHTML = '';
    for (const it of T.tray) { const chip = h('button', { class: 'dchip' }, label(it)); dragify(chip, it); tray.append(chip); }
    if (!T.tray.length && !T.checked) status.className = 'feedback good', status.style.display = 'block', status.textContent = T.instant ? 'All placed! 🎉' : 'All placed — hit Finish & check!';
    paint();
  }
  function place(it, abbr) {
    if (T.ans[abbr]) T.tray.push(T.ans[abbr]);
    T.ans[abbr] = it; T.tray = T.tray.filter(x => x !== it);
    if (T.instant) {
      const ok = it === abbr;
      if (ok) { T.locked[abbr] = true; P.xp += 2; save(false); beep('good'); }
      else { beep('bad'); m.set(abbr, 'bad'); m.label(abbr, short(abbr, label(it))); setTimeout(() => { if (test === T && T.ans[abbr] === it) { delete T.ans[abbr]; T.tray.push(it); refresh(); } }, 700); status.className = 'feedback bad'; status.style.display = 'block'; status.textContent = `Not quite — "${label(it)}" goes somewhere else.`; }
    }
    refresh();
    if (T.instant && T.scope.every(a => T.locked[a])) checkAll(true);
  }
  function dragify(chip, it) {
    chip.addEventListener('pointerdown', (e) => {
      if (T.checked) return;
      e.preventDefault();
      const ghost = h('div', { class: 'dchip ghost' }, label(it)); document.body.append(ghost);
      const moveTo = (x, y) => { ghost.style.left = x + 'px'; ghost.style.top = y + 'px'; };
      moveTo(e.clientX, e.clientY); chip.classList.add('lift');
      let hovered = null;
      const mv = (ev) => { moveTo(ev.clientX, ev.clientY); const el = document.elementFromPoint(ev.clientX, ev.clientY); const ab = el && el.getAttribute && el.getAttribute('data-abbr'); if (hovered !== ab) { if (hovered && !T.ans[hovered]) m.set(hovered, ''); hovered = (ab && inScope.has(ab) && !T.locked[ab]) ? ab : null; if (hovered && !T.ans[hovered]) m.set(hovered, 'sel'); } };
      const up = (ev) => { window.removeEventListener('pointermove', mv); window.removeEventListener('pointerup', up); window.removeEventListener('pointercancel', up); ghost.remove(); chip.classList.remove('lift'); if (hovered && !T.ans?.[hovered]) m.set(hovered, ''); const el = document.elementFromPoint(ev.clientX, ev.clientY); const ab = el && el.getAttribute && el.getAttribute('data-abbr'); if (ab && inScope.has(ab) && !T.locked[ab] && !T.checked) place(it, ab); };
      window.addEventListener('pointermove', mv); window.addEventListener('pointerup', up); window.addEventListener('pointercancel', up);
    });
  }
  function checkAll(auto) {
    if (!auto && !confirm(`Check answers? ${T.scope.length - Object.keys(T.ans).length} still blank.`)) return;
    T.checked = true; T.end = Date.now(); clearTimeout(T._tm);
    const right = T.scope.filter(a => T.ans[a] === a).length;
    const rec = { date: dayKey(), n: T.scope.length, scope: T.scope.length === 50 ? 'all' : 'learned', states: T.bank === 'states' ? right : null, caps: T.bank === 'capitals' ? right : null, time: T.end - T.t0, mode: 'drag', bank: T.bank };
    if (!T.practice) { P.tests.push(rec); P.xp += right * 2; save(); } else { P.xp += right; save(); }
    finishBtn.remove(); title.firstChild.textContent = 'Results'; title.lastChild.textContent = `${right}/${T.scope.length} right · ${fmtTime(rec.time)}`;
    const perfect = right === T.scope.length;
    status.className = 'feedback ' + (perfect ? 'good' : 'bad'); status.style.display = 'block';
    status.textContent = perfect ? 'PERFECT! 🎉' : 'Red = wrong. Tap a state to see what it really is.';
    if (perfect) { confetti(); beep('win'); } else beep('bad');
    results.innerHTML = '';
    T.scope.forEach(a => { const it = T.ans[a]; if (it === a) return; results.append(h('div', {}, h('span', { class: 'bad' }, it ? `you put "${label(it)}"` : '(left blank)'), h('span', { class: 'good' }, `${BY[a].name}${T.bank === 'capitals' ? ' — ' + BY[a].capital : ''}`))); });
    if (!results.children.length) results.append(h('div', {}, h('span', { class: 'good' }, 'No misses!')));
    tray.innerHTML = ''; paint(); m.reset();
  }
  function showRes(a) { const it = T.ans[a]; status.className = 'feedback ' + (it === a ? 'good' : 'bad'); status.style.display = 'block'; status.textContent = `${BY[a].name} — ${BY[a].capital}${it && it !== a ? ` (you put "${label(it)}")` : it ? '' : ' (blank)'}`; }
  refresh();
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
  const PD = planDays(); const nWeeks = Math.ceil(PD / 7);
  const byDay = {}; for (const [a, d] of Object.entries(P.intro)) (byDay[d] = byDay[d] || []).push(a);
  const box = h('div', { class: 'card' }, h('h1', {}, PD <= 7 ? 'Your 1-week sprint 🏃' : `Your ${nWeeks}-week plan`), h('p', {}, `Started ${fmtDate(new Date(start))} · ${n} new states/day → all 50 by day ${learnDays}, then review until the whole map is automatic.`),
    h('div', { class: 'weeks' }));
  const weeks = box.lastChild; const labels = PD <= 7 ? ['The week · West → East, test at the end'] : nWeeks === 2 ? ['Week 1 · West, Mountains & Plains', 'Week 2 · East coast + full-map tests'] : ['Week 1 · Meet the West & Mountains', 'Week 2 · Plains, Midwest & South', 'Week 3 · East coast + lock it in', 'Week 4 · Full-map tests'];
  for (let w = 0; w < nWeeks; w++) { weeks.append(h('div', { class: 'wk-label' }, labels[w])); const row = h('div', { class: 'week' }); for (let i = 0; i < 7; i++) { const d = w * 7 + i + 1; const k = dayKey(new Date(start + (d - 1) * DAY)); const rec = P.days[k]; const cls = ['day', d === today ? 'today' : '', rec?.done ? 'done' : '', d < today ? 'past' : ''].join(' '); const abbrs = byDay[d] || (rec ? [] : null); let lab = ''; if (d < today && !rec?.done) lab = abbrs?.length ? '' : 'skipped'; if (d >= today && !abbrs) { const todayAssigned = !!(P.days[dayKey()]?.newIntro?.length); const before = Object.keys(P.intro).length + (d - today - (todayAssigned ? 1 : 0)) * n; lab = before < 50 ? `+${Math.min(n, 50 - before)} new` : d > PD - Math.max(2, Math.floor(PD / 4)) ? 'test day' : 'review'; } const cpMark = (abbrs?.length && Object.values(P.checkpoints || {}).some(c => c.done && c.date === k)) || (d >= today && !abbrs && lab.startsWith('+') && Math.floor((Object.keys(P.intro).length + (d - today - (P.days[dayKey()]?.newIntro?.length ? 1 : 0) + 1) * n) / 10) > Math.floor((Object.keys(P.intro).length + (d - today - (P.days[dayKey()]?.newIntro?.length ? 1 : 0)) * n) / 10)); row.append(h('div', { class: cls }, h('span', { class: 'n' }, `${rec?.done ? '✓ ' : ''}${d}${cpMark ? ' 🏁' : ''}`), h('span', { class: 'lab' }, fmtDate(new Date(start + (d - 1) * DAY))), abbrs?.length ? h('div', { class: 'abbr' }, abbrs.map(a => h('i', {}, a))) : h('span', { class: 'lab' }, lab))); } weeks.append(row); }
  view.append(box);
  view.append(h('div', { class: 'card' }, h('h2', {}, 'How it works'), h('p', {}, h('b', {}, '1. Meet gently: '), 'each new state = see it on the map \u2192 warm-up find with neighbors labeled \u2192 pick its name \u2192 (a few minutes later) find it again and type it. Recognition first, spelling last.'), h('p', {}, h('b', {}, '2. Space it out: '), `every state has a "box" (1–6). Get it right → it moves up and comes back later (${intervals().slice(1).join(', ')} days). Miss it → it drops back and shows up tomorrow.`), h('p', {}, h('b', {}, '3. Recall, don\'t recognize: '), 'as a state gets stronger, questions switch from tap-it / multiple choice to writing the name and capital from memory — exactly what the test asks.'), h('p', {}, h('b', {}, '4. Capitals come second: '), `by default each state's capital arrives ${capDelay()} day(s) after you meet the state, so you anchor the shape and place first, then hang the capital on it. Change this in Settings below (same day = learn both together).`), h('p', {}, h('b', {}, '5. Checkpoints 🏁: '), 'every 10 states known, you take a checkpoint: a sheet of mini-maps (one state lit up on each) to name, then fill every state you know in on the blank map. Then the next batch unlocks.'), h('p', {}, h('b', {}, '6. Test: '), planDays() <= 7 ? 'from day 4, take the full Fill-in-the-map test daily — that IS the studying. Your best score is saved.' : 'from week 3, take the full Fill-in-the-map test a few times a week. Your best full score is saved.')));
  view.append(h('div', { class: 'card' }, h('h2', {}, '🧠 The science — why this works'),
    h('p', {}, h('b', {}, 'Retrieval beats re-reading. '), 'Testing yourself is one of only two "high-utility" study techniques found in the big Dunlosky research review — the other is spacing. That\'s why every question here makes you pull the answer out of your head instead of staring at a list.'),
    h('p', {}, h('b', {}, 'Space it out. '), 'Reviewing right before you\'d forget (1 → 2 → 4 → 7 → 14 → 30 days) roughly doubles what sticks vs. cramming. 10 minutes a day beats an hour on Sunday.'),
    h('p', {}, h('b', {}, 'Learn it ON the map. '), 'Spatial memory is one of the strongest systems you have. Seeing what touches what ("Nevada leans on California") builds a mental picture a flashcard can\'t.'),
    h('p', {}, h('b', {}, 'Silly pictures stick. '), 'The keyword method — turning "Topeka" into Toto PEEKing out of the basket — is proven for exactly this kind of name-pairing. The weirder the picture, the better. Say it out loud too.'),
    h('p', {}, h('b', {}, 'Mix it up + sleep. '), 'Interleave (states, capitals, regions in one session — that\'s what Play does) and get real sleep — that\'s when the day\'s states move to long-term memory.'),
    h('p', { class: 'muted' }, 'Sources: Dunlosky et al. 2013 review · retrieval + spacing studies · map-mnemonic classroom research.')));
  const sBox = h('div', { class: 'card' }, h('h2', {}, 'Settings'),
    h('div', { class: 'row' }, h('span', {}, 'Plan length:'), h('div', { class: 'seg' }, [[7, '1 week'], [14, '2 weeks'], [28, '4 weeks']].map(([d2, lab]) => h('button', { class: planDays() === d2 ? 'on' : '', onclick: () => { P.settings.planDays = d2; if (!paceOptions().includes(P.settings.newPerDay)) P.settings.newPerDay = defaultPace(); save(); render(); } }, lab)))),
    h('div', { class: 'row', style: 'margin-top:10px' }, h('span', {}, 'New states per day:'), h('div', { class: 'seg' }, paceOptions().map(k => h('button', { class: k === n ? 'on' : '', onclick: () => { P.settings.newPerDay = k; save(); render(); } }, String(k))))),
    h('div', { class: 'row', style: 'margin-top:10px' }, h('span', {}, 'Capitals arrive:'), h('div', { class: 'seg' }, [[0, 'Same day as the state'], [1, '1 day later'], [2, '2 days later'], [4, '4 days later']].map(([k, lab]) => h('button', { class: k === capDelay() ? 'on' : '', onclick: () => { P.settings.capDelay = k; save(); render(); } }, lab)))),
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

function renderGrab(R) {
  const mine = R.roster.find(p => p.id === R.you);
  const claimedN = Object.keys(R.claimed).length;
  const wrap = h('div', { class: 'quiz' }); const mapHost = h('div'); const qcard = h('div', { class: 'card qcard' });
  wrap.append(h('div', {}, mapHost), qcard);
  view.append(h('div', { class: 'progress-top' }, h('span', {}, `🗺️ Land grab · ${R.grabMode === 'capitals' ? 'capitals' : 'states'}`), h('div', { class: 'bar' }, h('i', { style: `width:${claimedN / R.scope.length * 100}%` })), h('span', {}, `${claimedN}/${R.scope.length}`), h('button', { class: 'pill ghost', onclick: () => { raceLeave(); render(); } }, 'Leave')), wrap);
  const colorOf = {}; R.roster.forEach(p => colorOf[p.id] = p.color || 0);
  const m = makeMap(mapHost, { onTap: (a) => { if (!a) return; if (R.claimed[a]) { const owner = R.roster.find(p => p.id === R.claimed[a]); toast(`${BY[a].name}: ${owner ? owner.name : 'someone'}'s!`); return; } if ((R.locked[a] || 0) > Date.now()) { toast('Locked for a few seconds — you missed that one.'); return; } R.sel = a; paintSel(); ask(a); } });
  function paintAll() { for (const s of STATES) { const owner = R.claimed[s.abbr]; if (owner) { m.set(s.abbr, owner === R.you ? 'good' : 'pc' + (colorOf[owner] % 8)); m.label(s.abbr, s.abbr); } else m.set(s.abbr, (R.locked[s.abbr] || 0) > Date.now() ? 'dim' : ''); } if (R.sel && !R.claimed[R.sel]) m.add(R.sel, 'sel'); }
  function paintSel() { paintAll(); }
  const prompt = h('div', { class: 'prompt' }, h('small', {}, 'Tap an open state to claim it'), 'The map is up for grabs!');
  const choices = h('div', { class: 'choices' });
  function ask(a) {
    const s = BY[a];
    const right = R.grabMode === 'capitals' ? s.capital : s.name;
    const pool = R.grabMode === 'capitals' ? STATES.map(x => x.capital) : STATES.map(x => x.name);
    const near = R.grabMode === 'capitals' ? s.nb.map(n => BY[n].capital) : s.nb.map(n => BY[n].name);
    const distract = shuffle(shuffle(near).slice(0, 2).concat(shuffle(pool)).filter((v, i, arr) => arr.indexOf(v) === i && v !== right)).slice(0, 3);
    prompt.innerHTML = ''; prompt.append(h('small', {}, R.grabMode === 'capitals' ? 'Claim it — what\'s its capital?' : 'Claim it — which state is this?'), 'The highlighted one is…');
    choices.innerHTML = '';
    shuffle([right, ...distract]).forEach(c => choices.append(h('button', { onclick: () => { R.ws.send(JSON.stringify({ t: 'claim', abbr: a, answer: c })); choices.innerHTML = ''; prompt.lastChild.textContent = '…'; } }, c)));
  }
  qcard.append(prompt, choices, board2());
  function board2() { return h('div', { class: 'raceboard' }, R.roster.slice().sort((x, y) => y.score - x.score).map((p, i) => h('div', { class: 'racerow' + (p.id === R.you ? ' me' : '') }, h('span', {}, h('i', { class: p.id === R.you ? 'pdot' : 'pdot c' + (p.color || 0) }), `${i === 0 && p.score > 0 ? '👑 ' : ''}${p.name}${p.id === R.you ? ' (you)' : ''}`), h('b', {}, String(p.score))))); }
  paintAll();
  if (R.sel && !R.claimed[R.sel]) ask(R.sel);
}
// ---------------- boot ----------------
await initAccount();
render('today');
document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'hidden' && user) { clearTimeout(pushTimer); navigator.sendBeacon && fetch('/api/progress', { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ progress: P }), keepalive: true }).catch(() => {}); } });
})();
