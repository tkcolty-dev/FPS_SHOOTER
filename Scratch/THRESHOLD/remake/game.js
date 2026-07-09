// ============================================================
// THRESHOLD — PAST THE LIMITS
// Clean rebuild. Original game & concept by plane3465.
// Same style: black/white minimalist horror. All art procedural.
// ============================================================
'use strict';

// ---------------- canvas ----------------
const canvas = document.getElementById('game');
const ctx = canvas.getContext('2d');
let W = 0, H = 0, DPR = 1;
function resize() {
  DPR = Math.min(2, window.devicePixelRatio || 1);
  W = innerWidth; H = innerHeight;
  canvas.width = W * DPR; canvas.height = H * DPR;
  canvas.style.width = W + 'px'; canvas.style.height = H + 'px';
}
addEventListener('resize', resize); resize();

// offscreen light layer
const lightC = document.createElement('canvas');
const lctx = lightC.getContext('2d');
// noise for film grain
const noiseC = document.createElement('canvas');
noiseC.width = 256; noiseC.height = 256;
{
  const nctx = noiseC.getContext('2d');
  const d = nctx.createImageData(256, 256);
  for (let i = 0; i < d.data.length; i += 4) {
    const v = Math.random() * 255 | 0;
    d.data[i] = d.data[i+1] = d.data[i+2] = v; d.data[i+3] = 22;
  }
  nctx.putImageData(d, 0, 0);
}

// ---------------- audio ----------------
const SND = {};
for (const [k, f, loop, vol] of [
  ['music', 'music.mp3', true, 0.22],
  ['ambience', 'ambience.wav', true, 0.14],
  ['warn', 'warn.wav', false, 0.85],
  ['whoosh', 'whoosh.wav', false, 0.9],
  ['pop', 'pop.wav', false, 0.5],
  ['collect', 'collect.wav', false, 0.45],
  ['doorclose', 'doorclose.wav', false, 0.8],
  ['death', 'death.wav', false, 0.9],
  ['click', 'click.wav', false, 0.7],
  ['tone', 'tone.wav', false, 0.75],
]) {
  const a = new Audio('sounds/' + f);
  a.loop = loop; a.volume = vol; a.preload = 'auto';
  SND[k] = a;
}
const play = k => { const a = SND[k]; if (!a) return; try { a.currentTime = 0; a.play().catch(()=>{}); } catch(e){} };
const stopS = k => { const a = SND[k]; if (!a) return; a.pause(); try { a.currentTime = 0; } catch(e){} };
const loopS = k => { const a = SND[k]; if (a && a.paused) a.play().catch(()=>{}); };

// ---------------- input ----------------
const keys = {};
const mouse = { x: 0, y: 0, clicked: false };
addEventListener('keydown', e => {
  if ([' ','ArrowUp','ArrowDown','ArrowLeft','ArrowRight'].includes(e.key)) e.preventDefault();
  const k = e.key.toLowerCase();
  if (!keys[k]) onKeyDown(k);
  keys[k] = true;
});
addEventListener('keyup', e => { keys[e.key.toLowerCase()] = false; });
addEventListener('mousemove', e => { mouse.x = e.clientX; mouse.y = e.clientY; });
addEventListener('mousedown', () => { mouse.clicked = true; });
const walkHeld = () => keys['w'] || keys['arrowup'];
const sprintHeld = () => keys['s'] || keys['arrowdown'];

// ---------------- save ----------------
const save = Object.assign({ points: 0, best: 0 },
  JSON.parse(localStorage.getItem('threshold2') || '{}'));
const persist = () => localStorage.setItem('threshold2', JSON.stringify(save));

// ---------------- items ----------------
const ITEMS = [
  { id: 1, name: 'FLASHLIGHT', desc: 'SCARES DOOR MONSTERS', cost: 80 },
  { id: 2, name: 'VITAMINS',   desc: 'BOOSTS SPEED',         cost: 100 },
  { id: 3, name: 'SCANNER',    desc: 'SHOWS DANGER EARLY',   cost: 200 },
  { id: 4, name: 'MASTER KEY', desc: 'OPENS LOCKED DOORS',   cost: 500 },
];
let ownedItems = [];           // bought at menu, carried into run, lost on death

// ---------------- world constants ----------------
const SEG = 460;               // segment length
const HALL = 130;              // hall half height
const GAP = 92;                // doorway opening height
const WALLT = 46;              // cross wall thickness
const ALC_W = 96, ALC_D = 62;  // alcove pocket size
const DOORS_PER_LEVEL = 10;

const WALK = 250, SPRINT = 430, VITA = 1.32;

// ---------------- state ----------------
let scene = 'boot', sceneT = 0, now = 0;
let fade = 0, fadeDir = 0, fadeCb = null, fadeWhite = false;
function fadeTo(cb, white = false) { fadeDir = 1; fadeCb = cb; fadeWhite = white; }

const G = {};   // run state
window.G = G;   // debug hook
function newRun() {
  Object.assign(G, {
    px: 60, py: 0, pr: 13,
    facing: 0, walkAnim: 0, moving: false, sprinting: false,
    maxX: 0, door: 0, level: 0, doorsRun: 0,
    segs: new Map(), lockCountdown: 2 + (Math.random() * 4 | 0),
    worm: { state: 'idle', t: 0, x: 0, lastEnd: -99, hadThisLevel: false },
    glance: { state: 'idle', t: 0, timer: 14 + Math.random() * 8, x: 0, y: 0 },
    items: [...ownedItems], slot: 0,
    hidden: false, deathCause: '', bonus: 0,
    shake: 0, shakeX: 0, shakeY: 0, flash: 0, doorFlash: 0, ePrompt: null,
  });
  segFor(0); segFor(1); segFor(2);
}

// segment: { i, type: normal|alcTop|alcBot|locked|monster|end, opened, monster:{t,active,fleeing,beam}, passed }
function segFor(i) {
  if (G.segs.has(i)) return G.segs.get(i);
  let type = 'normal';
  if (i > 0) {
    const doorNum = G.door + (i * SEG + SEG - G.maxX > 0 ? 0 : 0); // approx
    if (G.worm.state === 'warn') type = Math.random() < 0.7 ? (Math.random() < 0.5 ? 'alcTop' : 'alcBot') : 'normal';
    else if (G.lockCountdown <= 0) { type = 'locked'; G.lockCountdown = 3 + (Math.random() * 4 | 0); }
    else if (i > 2 && Math.random() < Math.min(0.10 + G.level * 0.05, 0.45)) type = 'monster';
    else if (Math.random() < 0.16) type = Math.random() < 0.5 ? 'alcTop' : 'alcBot';
    if (type !== 'locked') G.lockCountdown--;
  }
  const s = { i, type, opened: false, passed: false,
              monster: type === 'monster' ? { t: 0, active: true, fleeing: 0, beam: 0, seen: false } : null };
  G.segs.set(i, s);
  return s;
}
// wall x of segment i (the cross wall at its end)
const wallX = i => i * SEG + SEG;
const alcoveX = i => i * SEG + SEG * 0.55;

// colliders for a segment (list of rects {x,y,w,h})
function collidersFor(s) {
  const x0 = s.i * SEG, x1 = wallX(s.i);
  const rects = [];
  const big = 900;
  // top & bottom walls (with alcove pockets carved)
  const ax = alcoveX(s.i);
  if (s.type === 'alcTop') {
    rects.push({ x: x0, y: -HALL - big, w: ax - ALC_W / 2 - x0, h: big });
    rects.push({ x: ax + ALC_W / 2, y: -HALL - big, w: x1 - (ax + ALC_W / 2), h: big });
    rects.push({ x: ax - ALC_W / 2, y: -HALL - big, w: ALC_W, h: big - ALC_D }); // pocket back
  } else {
    rects.push({ x: x0, y: -HALL - big, w: SEG, h: big });
  }
  if (s.type === 'alcBot') {
    rects.push({ x: x0, y: HALL, w: ax - ALC_W / 2 - x0, h: big });
    rects.push({ x: ax + ALC_W / 2, y: HALL, w: x1 - (ax + ALC_W / 2), h: big });
    rects.push({ x: ax - ALC_W / 2, y: HALL + ALC_D, w: ALC_W, h: big - ALC_D });
  } else {
    rects.push({ x: x0, y: HALL, w: SEG, h: big });
  }
  // cross wall with doorway gap
  const wx = x1 - WALLT / 2;
  rects.push({ x: wx, y: -HALL, w: WALLT, h: HALL - GAP / 2 });
  rects.push({ x: wx, y: GAP / 2, w: WALLT, h: HALL - GAP / 2 });
  if (s.type === 'locked' && !s.opened) {
    rects.push({ x: wx + WALLT / 2 - 6, y: -GAP / 2, w: 12, h: GAP }); // bars
  }
  return rects;
}

function circleVsRects(x, y, r, rects) {
  for (const rc of rects) {
    const cx = Math.max(rc.x, Math.min(x, rc.x + rc.w));
    const cy = Math.max(rc.y, Math.min(y, rc.y + rc.h));
    const dx = x - cx, dy = y - cy;
    if (dx * dx + dy * dy < r * r) return true;
  }
  return false;
}

// ---------------- scenes / flow ----------------
let menuBtns, shopSel, shopErr = 0, coopFlash = 0;
function goMenu() {
  scene = 'menu'; sceneT = 0;
  stopS('ambience'); stopS('warn'); loopS('music');
}
function startGame() {
  newRun();
  scene = 'loading'; sceneT = 0;
  stopS('music');
}
function die(cause) {
  if (scene !== 'game') return;
  G.deathCause = cause;
  G.bonus = G.level * 50;
  save.points += G.bonus;
  save.best = Math.max(save.best, G.level * 100 + G.door);
  persist();
  ownedItems = []; G.items = [];
  scene = 'dying'; sceneT = 0;
  stopS('ambience'); stopS('warn');
  play('death');
}
window.forceWorm = () => { triggerWorm(true); };
window.forceGlance = () => { G.glance.timer = 0; };

function onKeyDown(k) {
  if (scene === 'disclaimer' && k === ' ') { play('click'); goMenu(); }
  else if (scene === 'stats' && k === ' ' && sceneT > 0.5) { play('click'); fadeTo(() => goMenu()); }
  else if (scene === 'game') {
    if (k === 'e') tryUnlock(false);
    if (k === '1' || k === 'arrowleft') { G.slot = 0; if (G.items.length) play('pop'); }
    if (k === '2' || k === 'arrowright') { G.slot = 1; if (G.items.length > 1) play('pop'); }
  }
}

function tryUnlock(auto) {
  for (const s of G.segs.values()) {
    if (s.type === 'locked' && !s.opened) {
      const d = wallX(s.i) - G.px;
      if (d > -30 && d < (auto ? 150 : 130) && Math.abs(G.py) < 90) {
        s.opened = true;
        play(auto ? 'collect' : 'pop');
        return;
      }
    }
  }
}

function triggerWorm(force) {
  const wm = G.worm;
  if (wm.state !== 'idle') return;
  if (!force) {
    if (now - wm.lastEnd < 14) return;
    if (G.door < 1) return;
    const must = G.door >= 6 && !wm.hadThisLevel;
    if (!must && Math.random() > 0.16) return;
  }
  wm.state = 'warn'; wm.t = 0; wm.hadThisLevel = true;
  play('warn');
  // guarantee reachable hiding spots ahead
  let conv = 0;
  const curSeg = Math.floor(G.px / SEG);
  for (let i = curSeg; i <= curSeg + 4 && conv < 3; i++) {
    const s = segFor(i);
    if (s.type === 'normal' && alcoveX(i) > G.px + 60) {
      s.type = Math.random() < 0.5 ? 'alcTop' : 'alcBot';
      conv++;
    }
  }
  // current segment too if player hasn't passed its alcove
  if (conv === 0) { const s = segFor(curSeg + 1); if (s.type === 'normal') s.type = 'alcTop'; }
}

// ---------------- update ----------------
function update(dt) {
  sceneT += dt; now += dt;
  if (fadeDir === 1) { fade = Math.min(1, fade + dt * 3); if (fade >= 1) { fadeDir = -1; if (fadeCb) { const c = fadeCb; fadeCb = null; c(); } } }
  else if (fadeDir === -1) { fade = Math.max(0, fade - dt * 3); if (fade <= 0) fadeDir = 0; }

  if (scene === 'boot') { if (sceneT > 0.4) { scene = 'disclaimer'; sceneT = 0; } }
  else if (scene === 'menu') updateMenu();
  else if (scene === 'shop') updateShop();
  else if (scene === 'loading') { if (sceneT > 2.2) { scene = 'game'; sceneT = 0; loopS('ambience'); } }
  else if (scene === 'game') updateGame(dt);
  else if (scene === 'dying') { if (sceneT > 2.1) { scene = 'stats'; sceneT = 0; } }
  else if (scene === 'stats') updateStats();
  mouse.clicked = false;
}

// ----- menu -----
function menuLayout() {
  const bx = W * 0.16, bw = Math.min(340, W * 0.34), bh = 64;
  return [
    { label: 'START', x: bx, y: H * 0.42, w: bw, h: bh, act: 'start' },
    { label: 'CO-OP', x: bx, y: H * 0.42 + 84, w: bw, h: bh, act: 'coop', dim: true },
    { label: 'SHOP',  x: bx, y: H * 0.42 + 168, w: bw, h: bh, act: 'shop' },
  ];
}
function updateMenu() {
  coopFlash = Math.max(0, coopFlash - 1 / 60);
  for (const b of menuLayout()) {
    const hov = mouse.x > b.x && mouse.x < b.x + b.w && mouse.y > b.y && mouse.y < b.y + b.h;
    if (hov && mouse.clicked) {
      if (b.act === 'start') { play('click'); fadeTo(() => startGame()); }
      else if (b.act === 'shop') { play('click'); shopSel = new Set(); scene = 'shop'; sceneT = 0; }
      else { play('click'); coopFlash = 1.6; }
    }
  }
}

// ----- shop -----
function shopLayout() {
  const cw = Math.min(300, W * 0.28), ch = Math.min(150, H * 0.24);
  const cxs = W / 2 - cw - 18, cys = H * 0.30;
  return {
    cards: ITEMS.map((it, i) => ({
      it, x: cxs + (i % 2) * (cw + 36), y: cys + Math.floor(i / 2) * (ch + 26), w: cw, h: ch,
    })),
    btn: { x: W / 2 - 110, y: H * 0.30 + 2 * (ch + 26) + 12, w: 220, h: 56 },
  };
}
function updateShop() {
  shopErr = Math.max(0, shopErr - 1 / 60);
  if (!mouse.clicked) return;
  const L = shopLayout();
  for (const c of L.cards) {
    if (mouse.x > c.x && mouse.x < c.x + c.w && mouse.y > c.y && mouse.y < c.y + c.h) {
      if (ownedItems.includes(c.it.id)) return;
      play('pop');
      if (shopSel.has(c.it.id)) shopSel.delete(c.it.id);
      else if (shopSel.size + ownedItems.length < 2) shopSel.add(c.it.id);
      return;
    }
  }
  const b = L.btn;
  if (mouse.x > b.x && mouse.x < b.x + b.w && mouse.y > b.y && mouse.y < b.y + b.h) {
    play('click');
    if (shopSel.size) {
      const cost = [...shopSel].reduce((a, id) => a + ITEMS[id - 1].cost, 0);
      if (save.points >= cost) {
        save.points -= cost;
        ownedItems.push(...shopSel);
        persist(); play('collect');
        shopSel.clear();
        scene = 'menu'; sceneT = 0;
      } else { shopSel.clear(); shopErr = 1.4; }
    } else { scene = 'menu'; sceneT = 0; }
  }
}

// ----- stats -----
function statsLayout() {
  return { btn: { x: W * 0.14, y: H * 0.72, w: 250, h: 62 } };
}
function updateStats() {
  if (!mouse.clicked || sceneT < 0.4) return;
  const b = statsLayout().btn;
  if (mouse.x > b.x && mouse.x < b.x + b.w && mouse.y > b.y && mouse.y < b.y + b.h) {
    play('click');
    fadeTo(() => startGame(), true);
  }
}

// ----- game -----
function camera() {
  const zoom = Math.max(0.9, Math.min(H * 0.72 / 420, W / 1100));
  return { zoom, cx: G.px + 130, cy: G.py * 0.25 };
}
function w2s(x, y) {
  const c = camera();
  return [ (x - c.cx) * c.zoom + W / 2 + G.shakeX, (y - c.cy) * c.zoom + H / 2 + G.shakeY ];
}

function updateGame(dt) {
  const c = camera();
  // facing from player to mouse (screen → world)
  const [psx, psy] = w2s(G.px, G.py);
  G.facing = Math.atan2(mouse.y - psy, mouse.x - psx);

  // segments around player
  const ci = Math.floor(G.px / SEG);
  for (let i = Math.max(0, ci - 1); i <= ci + 3; i++) segFor(i);
  for (const k of [...G.segs.keys()]) if (k < ci - 3) G.segs.delete(k);

  // ---- movement ----
  G.sprinting = sprintHeld();
  const boost = G.items.includes(2) ? VITA : 1;
  const spd = (G.sprinting ? SPRINT : WALK) * boost;
  G.moving = false;
  if (walkHeld()) {
    let dx = Math.cos(G.facing) * spd * dt;
    let dy = Math.sin(G.facing) * spd * dt;
    const rects = [];
    for (let i = Math.max(0, ci - 1); i <= ci + 1; i++) rects.push(...collidersFor(segFor(i)));
    // axis-separated resolution (slide along walls)
    if (!circleVsRects(G.px + dx, G.py, G.pr, rects)) G.px += dx;
    else if (!circleVsRects(G.px + Math.sign(dx) * 1.5, G.py, G.pr, rects)) G.px += Math.sign(dx) * 1.5;
    if (!circleVsRects(G.px, G.py + dy, G.pr, rects)) G.py += dy;
    else if (!circleVsRects(G.px, G.py + Math.sign(dy) * 1.5, G.pr, rects)) G.py += Math.sign(dy) * 1.5;
    G.px = Math.max(20, G.px);
    G.moving = true;
    G.walkAnim += dt * (G.sprinting ? 14 : 9);
  }

  // ---- E prompt / master key ----
  G.ePrompt = null;
  for (const s of G.segs.values()) {
    if (s.type === 'locked' && !s.opened) {
      const d = wallX(s.i) - G.px;
      if (d > -30 && d < 150 && Math.abs(G.py) < 100) {
        if (G.items.includes(4)) tryUnlock(true);
        else G.ePrompt = wallX(s.i);
      }
    }
  }

  // ---- door crossing ----
  if (G.px > G.maxX) {
    for (const s of G.segs.values()) {
      const wx = wallX(s.i);
      if (!s.passed && G.maxX < wx && G.px >= wx) {
        s.passed = true;
        // monster kill check
        if (s.monster && s.monster.active && !s.monster.fleeing) { die('monster'); return; }
        G.door++; G.doorsRun++;
        save.points += 5; persist();
        G.doorFlash = 0.3;
        if (G.door >= DOORS_PER_LEVEL) {
          G.level++; G.door = 0;
          G.worm.hadThisLevel = false;
          save.points += 25; persist();
          play('doorclose');
          G.flash = 0.5;
        } else {
          play('collect');
          triggerWorm(false);
        }
      }
    }
    G.maxX = G.px;
  }

  // ---- hiding ----
  G.hidden = false;
  for (const s of G.segs.values()) {
    if (s.type === 'alcTop' || s.type === 'alcBot') {
      const ax = alcoveX(s.i);
      const inX = Math.abs(G.px - ax) < ALC_W / 2 - 4;
      const inY = s.type === 'alcTop' ? G.py < -HALL + 14 : G.py > HALL - 14;
      if (inX && inY) G.hidden = true;
    }
  }

  // ---- monsters ----
  for (const s of G.segs.values()) {
    if (!s.monster || !s.monster.active) continue;
    const m = s.monster, wx = wallX(s.i);
    const rel = wx - G.px;
    if (Math.abs(rel) < 560) { m.seen = true; m.t += dt; }
    if (m.fleeing) { m.fleeing += dt; if (m.fleeing > 0.7) m.active = false; continue; }
    // flashlight scare
    if (G.items.includes(1) && m.seen && Math.abs(rel) < 480) {
      const ang = Math.atan2(0 - G.py, rel);
      let dd = Math.abs(((G.facing - ang) + Math.PI * 3) % (Math.PI * 2) - Math.PI);
      if (dd < 0.3) {
        m.beam += dt;
        if (m.beam > 0.55) { m.fleeing = 0.001; play('pop'); }
      } else m.beam = Math.max(0, m.beam - dt * 2);
    }
    if (m.t > 8) m.active = false;           // wanders off eventually
  }

  // ---- worm ----
  const wm = G.worm;
  wm.t += dt;
  if (wm.state === 'warn') {
    if (wm.t > 6.0) {
      wm.state = 'dash'; wm.t = 0;
      wm.x = G.px - 900;
      play('whoosh');
      if (!G.hidden) { die('worm'); return; }
    }
  } else if (wm.state === 'dash') {
    wm.x += dt * 2600;
    G.shake = 6;
    if (!G.hidden && Math.abs(wm.x - G.px) < 120) { die('worm'); return; }
    if (wm.t > 1.1) { wm.state = 'idle'; wm.t = 0; wm.lastEnd = now; stopS('warn'); }
  }

  // ---- glance ----
  const gl = G.glance;
  if (gl.state === 'idle') {
    if (G.level >= 1 && wm.state === 'idle') {
      gl.timer -= dt;
      if (gl.timer <= 0) {
        gl.state = 'appear'; gl.t = 0;
        gl.x = W * (0.25 + Math.random() * 0.5);
        gl.y = H * (0.2 + Math.random() * 0.5);
        play('tone');
      }
    }
  } else if (gl.state === 'appear') {
    gl.t += dt;
    if (gl.t > (G.items.includes(3) ? 1.4 : 0.7)) { gl.state = 'watch'; gl.t = 0; }
  } else if (gl.state === 'watch') {
    gl.t += dt;
    if (walkHeld() || sprintHeld()) { die('glance'); return; }
    if (gl.t > 2.3) { gl.state = 'fade'; gl.t = 0; }
  } else if (gl.state === 'fade') {
    gl.t += dt;
    if (gl.t > 0.5) { gl.state = 'idle'; gl.timer = Math.max(6, 15 + Math.random() * 10 - G.level * 2); }
  }

  // fx decay
  G.flash = Math.max(0, G.flash - dt);
  G.doorFlash = Math.max(0, G.doorFlash - dt);
  G.shake = Math.max(0, G.shake - dt * 18);
  G.shakeX = (Math.random() - 0.5) * G.shake * 2;
  G.shakeY = (Math.random() - 0.5) * G.shake * 2;
}

// ============================================================
// RENDER
// ============================================================
const SERIF = '"Georgia", "Times New Roman", serif';
function text(str, x, y, size, color = '#fff', align = 'center', alpha = 1, weight = 'bold') {
  ctx.save(); ctx.globalAlpha = alpha;
  ctx.fillStyle = color;
  ctx.font = `${weight} ${size}px ${SERIF}`;
  ctx.textAlign = align; ctx.textBaseline = 'middle';
  ctx.fillText(str, x, y);
  ctx.restore();
}

function render() {
  ctx.setTransform(DPR, 0, 0, DPR, 0, 0);
  ctx.fillStyle = '#000'; ctx.fillRect(0, 0, W, H);

  if (scene === 'boot') text('THRESHOLD', W/2, H/2, 40, '#666');
  else if (scene === 'disclaimer') renderDisclaimer();
  else if (scene === 'menu') renderMenu();
  else if (scene === 'shop') renderShop();
  else if (scene === 'loading') renderLoading();
  else if (scene === 'game') renderGame();
  else if (scene === 'dying') renderDying();
  else if (scene === 'stats') renderStats();

  // film grain + vignette on all scenes
  ctx.save();
  ctx.globalAlpha = 0.5;
  const ox = (Math.random() * 256) | 0, oy = (Math.random() * 256) | 0;
  ctx.translate(-ox, -oy);
  ctx.fillStyle = ctx.createPattern(noiseC, 'repeat');
  ctx.fillRect(0, 0, W + 256, H + 256);
  ctx.restore();
  const vg = ctx.createRadialGradient(W/2, H/2, Math.min(W,H)*0.35, W/2, H/2, Math.max(W,H)*0.75);
  vg.addColorStop(0, 'rgba(0,0,0,0)'); vg.addColorStop(1, 'rgba(0,0,0,0.55)');
  ctx.fillStyle = vg; ctx.fillRect(0, 0, W, H);

  if (fade > 0) { ctx.fillStyle = fadeWhite ? '#fff' : '#000'; ctx.globalAlpha = fade; ctx.fillRect(0,0,W,H); ctx.globalAlpha = 1; }

  // crosshair cursor (menus)
  if (scene !== 'game' && scene !== 'boot' && scene !== 'dying') drawCrosshair(mouse.x, mouse.y, '#fff');
}

function drawCrosshair(x, y, color) {
  ctx.save();
  ctx.strokeStyle = color; ctx.lineWidth = 3; ctx.lineCap = 'round';
  const s = 11, g = 5;
  for (const [dx, dy] of [[-1,-1],[1,-1],[-1,1],[1,1]]) {
    ctx.beginPath();
    ctx.moveTo(x + dx*s, y + dy*g); ctx.lineTo(x + dx*s, y + dy*s); ctx.lineTo(x + dx*g, y + dy*s);
    ctx.stroke();
  }
  ctx.restore();
}

function renderDisclaimer() {
  const blink = Math.floor(sceneT) % 2 === 0;
  text('DISCLAIMER', W/2, H*0.38, Math.min(90, W*0.09));
  text('THIS GAME CONTAINS', W/2, H*0.52, Math.min(44, W*0.045));
  text('FLASHING LIGHTS', W/2, H*0.59, Math.min(44, W*0.045));
  if (blink) text('PRESS SPACE', W/2, H*0.78, 22, '#888');
}

// procedural menu backdrop: diagonal brick corridor + worm chase silhouette
function renderMenuArt() {
  ctx.save();
  ctx.translate(W * 0.72, H * 0.5);
  ctx.rotate(0.55);
  // corridor band
  ctx.fillStyle = '#232323';
  ctx.fillRect(-160, -H, 320, H * 2.4);
  // bricks
  ctx.fillStyle = '#2e2e2e';
  for (let r = 0; r < 30; r++) {
    for (let col = 0; col < 4; col++) {
      const bx = -150 + col * 78 + (r % 2 ? 38 : 0);
      const by = -H + r * 64;
      ctx.beginPath();
      if (ctx.roundRect) ctx.roundRect(bx, by, 66, 50, 12); else ctx.rect(bx, by, 66, 50);
      ctx.fill();
    }
  }
  // worm silhouette gliding
  const t = (now * 0.25) % 1.4;
  ctx.translate(0, -H * 0.55 + t * H * 0.2);
  ctx.fillStyle = '#3c3c3c';
  ctx.beginPath();
  if (ctx.roundRect) ctx.roundRect(-52, 0, 104, 420, 52); else ctx.rect(-52, 0, 104, 420);
  ctx.fill();
  ctx.fillStyle = '#181818';
  ctx.beginPath(); ctx.arc(-16, 60, 7, 0, 7); ctx.fill();
  ctx.beginPath(); ctx.arc(18, 66, 7, 0, 7); ctx.fill();
  ctx.strokeStyle = '#181818'; ctx.lineWidth = 8; ctx.lineCap = 'round';
  ctx.beginPath(); ctx.moveTo(-8, 130); ctx.lineTo(-8, 330); ctx.stroke();
  ctx.restore();
}

function renderMenu() {
  renderMenuArt();
  text('THRESHOLD', W * 0.16, H * 0.16, Math.min(96, W * 0.085), '#fff', 'left');
  text('PAST THE LIMITS', W * 0.165, H * 0.16 + Math.min(70, W * 0.055), Math.min(38, W * 0.033), '#bbb', 'left');
  for (const b of menuLayout()) {
    const hov = mouse.x > b.x && mouse.x < b.x + b.w && mouse.y > b.y && mouse.y < b.y + b.h;
    const slide = hov && !b.dim ? 14 : 0;
    ctx.save();
    ctx.globalAlpha = b.dim ? 0.35 : 1;
    ctx.strokeStyle = hov && !b.dim ? '#7f7' : '#fff';
    ctx.lineWidth = 3;
    ctx.beginPath();
    if (ctx.roundRect) ctx.roundRect(b.x + slide, b.y, b.w, b.h, 14); else ctx.rect(b.x + slide, b.y, b.w, b.h);
    ctx.stroke();
    ctx.fillStyle = '#0a0a0a'; ctx.globalAlpha = (b.dim ? 0.35 : 1) * 0.7; ctx.fill();
    ctx.restore();
    text(b.label, b.x + slide + b.w/2, b.y + b.h/2 + 2, 34, b.dim ? '#777' : '#fff', 'center', b.dim ? 0.6 : 1);
  }
  if (coopFlash > 0) text('SOLO ONLY — FOR NOW', W*0.16, H*0.42 + 84 + 90, 20, '#f55', 'left', Math.min(1, coopFlash));
  // points + best
  text(save.points + ' PS', W - 36, 44, 34, '#fff', 'right');
  text('BEST ' + save.best, W - 36, 78, 18, '#888', 'right');
  // owned items
  ownedItems.forEach((id, i) => drawItemGlyph(id, W - 60 - i * 54, 124, 20, '#ccc'));
  // controls hint
  text('W WALK · S SPRINT · E OPEN DOORS · MOUSE TO AIM', W*0.16, H*0.93, 17, '#666', 'left');
  text('(CLIENT V2.0)(CREATOR PLANE3465)', W*0.16, H*0.965, 13, '#444', 'left');
}

function renderLoading() {
  text('LOADING', W/2, H*0.42, 54);
  const t = Math.min(1, sceneT / 2);
  ctx.fillStyle = '#fff';
  ctx.fillRect(W/2 - 160, H*0.52, 320 * t, 8);
  ctx.strokeStyle = '#555'; ctx.strokeRect(W/2 - 160, H*0.52, 320, 8);
  // little runner
  ctx.save();
  ctx.translate(W/2 - 160 + 320 * t, H*0.52 - 26);
  drawPlayerIcon(0, 0, 16, now * 10);
  ctx.restore();
}

function renderShop() {
  renderMenuArt();
  ctx.fillStyle = 'rgba(0,0,0,0.75)'; ctx.fillRect(0, 0, W, H);
  text('ITEM SHOP', W/2, H*0.14, 56);
  text(save.points + ' PS', W - 36, 44, 34, '#fff', 'right');
  const L = shopLayout();
  for (const c of L.cards) {
    const owned = ownedItems.includes(c.it.id);
    const sel = shopSel.has(c.it.id);
    const hov = mouse.x > c.x && mouse.x < c.x + c.w && mouse.y > c.y && mouse.y < c.y + c.h;
    ctx.save();
    ctx.globalAlpha = owned ? 0.4 : 1;
    ctx.fillStyle = hov && !owned ? '#181818' : '#0d0d0d';
    ctx.strokeStyle = sel ? '#fff' : '#555';
    ctx.lineWidth = sel ? 4 : 2;
    ctx.beginPath();
    if (ctx.roundRect) ctx.roundRect(c.x, c.y, c.w, c.h, 12); else ctx.rect(c.x, c.y, c.w, c.h);
    ctx.fill(); ctx.stroke();
    ctx.restore();
    drawItemGlyph(c.it.id, c.x + 44, c.y + c.h/2, 26, owned ? '#666' : '#fff');
    text(c.it.name, c.x + 84, c.y + c.h * 0.32, 24, owned ? '#777' : '#fff', 'left');
    text(c.it.desc, c.x + 84, c.y + c.h * 0.56, 14, '#999', 'left');
    text(owned ? 'OWNED' : c.it.cost + ' PS', c.x + 84, c.y + c.h * 0.78, 20, owned ? '#5c5' : '#ccc', 'left');
  }
  const b = L.btn;
  const anySel = shopSel && shopSel.size > 0;
  const hovB = mouse.x > b.x && mouse.x < b.x + b.w && mouse.y > b.y && mouse.y < b.y + b.h;
  ctx.strokeStyle = hovB ? '#7f7' : '#fff'; ctx.lineWidth = 3;
  ctx.beginPath();
  if (ctx.roundRect) ctx.roundRect(b.x, b.y, b.w, b.h, 12); else ctx.rect(b.x, b.y, b.w, b.h);
  ctx.stroke();
  text(anySel ? 'CONFIRM' : 'CLOSE', b.x + b.w/2, b.y + b.h/2 + 2, 28);
  if (anySel) {
    const cost = [...shopSel].reduce((a, id) => a + ITEMS[id-1].cost, 0);
    text('COST ' + cost + ' PS', b.x + b.w/2, b.y - 22, 20, save.points >= cost ? '#fff' : '#f55');
  }
  if (shopErr > 0) text('NOT ENOUGH PS', W/2, H*0.22, 26, '#f55', 'center', Math.min(1, shopErr));
  text('MAX 2 ITEMS · LOST ON DEATH', W/2, H*0.94, 15, '#666');
}

function drawItemGlyph(id, x, y, s, color) {
  ctx.save();
  ctx.translate(x, y);
  ctx.strokeStyle = color; ctx.fillStyle = color;
  ctx.lineWidth = Math.max(2.5, s * 0.14); ctx.lineCap = 'round'; ctx.lineJoin = 'round';
  if (id === 1) {          // flashlight
    ctx.strokeRect(-s*0.8, -s*0.32, s*0.9, s*0.64);
    ctx.beginPath();
    ctx.moveTo(s*0.1, -s*0.32); ctx.lineTo(s*0.75, -s*0.62);
    ctx.lineTo(s*0.75, s*0.62); ctx.lineTo(s*0.1, s*0.32);
    ctx.closePath(); ctx.stroke();
  } else if (id === 2) {   // vitamins bottle
    ctx.strokeRect(-s*0.42, -s*0.3, s*0.84, s*0.95);
    ctx.fillRect(-s*0.3, -s*0.62, s*0.6, s*0.3);
    ctx.beginPath(); ctx.arc(0, s*0.18, s*0.16, 0, 7); ctx.fill();
  } else if (id === 3) {   // scanner
    ctx.strokeRect(-s*0.7, -s*0.5, s*1.4, s);
    ctx.beginPath(); ctx.arc(0, 0, s*0.28, 0, 7); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(s*0.2, -s*0.2); ctx.lineTo(s*0.38, -s*0.38); ctx.stroke();
  } else {                 // master key
    ctx.beginPath(); ctx.arc(-s*0.4, 0, s*0.32, 0, 7); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(-s*0.1, 0); ctx.lineTo(s*0.75, 0); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(s*0.45, 0); ctx.lineTo(s*0.45, s*0.3); ctx.moveTo(s*0.72, 0); ctx.lineTo(s*0.72, s*0.34); ctx.stroke();
  }
  ctx.restore();
}

// ---- game world rendering ----
function drawPlayerIcon(x, y, r, anim) {
  // rounded-square character with the "C" face — same style as original
  ctx.save();
  ctx.translate(x, y);
  const bob = Math.sin(anim) * r * 0.06;
  ctx.translate(0, bob);
  ctx.fillStyle = '#fff'; ctx.strokeStyle = '#000';
  ctx.lineWidth = r * 0.22;
  ctx.beginPath();
  if (ctx.roundRect) ctx.roundRect(-r, -r, r*2, r*2, r*0.35); else ctx.rect(-r, -r, r*2, r*2);
  ctx.fill(); ctx.stroke();
  // inner black block + white slit (the "C")
  ctx.fillStyle = '#000';
  ctx.fillRect(-r*0.45, -r*0.55, r*1.1, r*1.1);
  ctx.fillStyle = '#fff';
  ctx.fillRect(r*0.28, -r*0.55, r*0.22, r*1.1);
  ctx.restore();
}

function renderGame() {
  const c = camera();
  const z = c.zoom;

  // floor
  ctx.fillStyle = '#3f3f3f';
  const [fx0, fy0] = w2s(c.cx - W, -HALL);
  const [fx1, fy1] = w2s(c.cx + W, HALL);
  ctx.fillRect(0, fy0, W, fy1 - fy0);
  // subtle floor lines
  ctx.strokeStyle = 'rgba(255,255,255,0.04)'; ctx.lineWidth = 1;
  for (let gx = Math.floor((c.cx - W/z) / 80) * 80; gx < c.cx + W/z; gx += 80) {
    const [sx] = w2s(gx, 0);
    ctx.beginPath(); ctx.moveTo(sx, fy0); ctx.lineTo(sx, fy1); ctx.stroke();
  }

  // segments
  const ci = Math.floor(G.px / SEG);
  for (let i = Math.max(0, ci - 2); i <= ci + 3; i++) {
    const s = G.segs.get(i); if (!s) continue;
    drawSegment(s, z);
  }

  // player
  const [psx, psy] = w2s(G.px, G.py);
  const pr = G.pr * z * 1.35;
  ctx.save();
  ctx.translate(psx, psy);
  ctx.rotate(G.facing + Math.PI / 2);
  drawPlayerIcon(0, 0, pr, G.moving ? G.walkAnim : 0);
  ctx.restore();
  if (G.hidden) text('HIDDEN', psx, psy + (G.py < 0 ? 92 : -92), 22, '#7f7');

  // worm
  const wm = G.worm;
  if (wm.state === 'dash') {
    const [wx, wy] = w2s(wm.x, 0);
    drawWorm(wx, wy, z);
    ctx.fillStyle = `rgba(255,255,255,${Math.max(0, 0.2 - wm.t * 0.18)})`;
    ctx.fillRect(0, 0, W, H);
  }

  // darkness + flashlight
  drawLighting(psx, psy);

  // worm warning overlay
  if (wm.state === 'warn') {
    const p = 0.5 + 0.5 * Math.sin(now * 9);
    drawWarnBars(p);
    if (G.items.includes(3)) {
      ctx.fillStyle = '#f44';
      ctx.fillRect(W/2 - 150, 26, 300 * Math.max(0, 1 - wm.t / 6), 6);
    }
  }

  // glance
  const gl = G.glance;
  if (gl.state !== 'idle') {
    let a = 1;
    if (gl.state === 'appear') a = Math.min(1, gl.t / 0.25);
    if (gl.state === 'fade') a = 1 - gl.t * 2;
    drawGlance(gl.x, gl.y, a, gl.state === 'watch');
    if (gl.state === 'watch')
      text('DO NOT MOVE', W/2, H*0.12, 34, '#fff', 'center', 0.7 + 0.3 * Math.sin(now * 9));
  }

  // flashes
  if (G.doorFlash > 0) { ctx.fillStyle = `rgba(255,255,255,${G.doorFlash * 0.25})`; ctx.fillRect(0,0,W,H); }
  if (G.flash > 0) { ctx.fillStyle = `rgba(255,255,255,${G.flash})`; ctx.fillRect(0,0,W,H); }

  // E prompt
  if (G.ePrompt !== null) {
    const [ex, ey] = w2s(G.ePrompt - WALLT/2 - 10, 0);
    if (Math.floor(now * 2.5) % 2 === 0) {
      ctx.strokeStyle = '#fff'; ctx.lineWidth = 3;
      ctx.strokeRect(ex - 26, ey - 90 - 26, 52, 52);
      text('E', ex, ey - 90 + 2, 34);
    }
  }

  // HUD
  text('DOOR', 40, 40, 17, '#999', 'left');
  text(String(G.door), 110, 41, 34, '#fff', 'left');
  text('LVL', W - 110, 40, 17, '#999', 'right');
  text(String(G.level), W - 96, 41, 34, '#fff', 'left');
  // slots
  const slotY = H - 54, slotX = W/2 - 34;
  for (let i = 0; i < 2; i++) {
    const x = slotX + i * 68;
    ctx.save();
    ctx.globalAlpha = 0.85;
    ctx.fillStyle = '#0c0c0c';
    ctx.strokeStyle = G.slot === i ? '#fff' : '#555';
    ctx.lineWidth = G.slot === i ? 3 : 2;
    ctx.beginPath();
    if (ctx.roundRect) ctx.roundRect(x - 26, slotY - 26, 52, 52, 10); else ctx.rect(x - 26, slotY - 26, 52, 52);
    ctx.fill(); ctx.stroke();
    ctx.restore();
    text(String(i + 1), x - 18, slotY - 15, 13, '#777');
    if (G.items[i]) drawItemGlyph(G.items[i], x, slotY, 15, '#fff');
  }
}

function drawSegment(s, z) {
  const x0 = s.i * SEG, x1 = wallX(s.i);
  // top / bottom walls with brick texture
  drawWallBand(x0, x1, -HALL - 260, -HALL, s.type === 'alcTop' ? s : null, true);
  drawWallBand(x0, x1, HALL, HALL + 260, s.type === 'alcBot' ? s : null, false);

  // cross wall
  const wx = x1 - WALLT / 2;
  const isEnd = G.door >= DOORS_PER_LEVEL - 1 && !s.passed && wallX(s.i) > G.px;
  const [sx0, sy0] = w2s(wx, -HALL);
  const [sx1, sy1] = w2s(wx + WALLT, -GAP/2);
  const [sx2, sy2] = w2s(wx, GAP/2);
  const [sx3, sy3] = w2s(wx + WALLT, HALL);
  ctx.fillStyle = '#2a2a2a';
  ctx.fillRect(sx0, sy0, sx1 - sx0, sy1 - sy0);
  ctx.fillRect(sx2, sy2, sx3 - sx2, sy3 - sy2);
  // door posts
  ctx.fillStyle = '#000';
  ctx.fillRect(sx0, sy1 - 6 * z, sx1 - sx0, 6 * z);
  ctx.fillRect(sx2, sy2, sx3 - sx2, 6 * z);

  // locked bars
  if (s.type === 'locked' && !s.opened) {
    const [bx, by0] = w2s(x1 - 3, -GAP/2);
    const [, by1] = w2s(x1, GAP/2);
    ctx.strokeStyle = '#ddd'; ctx.lineWidth = Math.max(2, 3.5 * z);
    for (let i = 0; i <= 4; i++) {
      const yy = by0 + (by1 - by0) * (i / 4);
      ctx.beginPath(); ctx.moveTo(bx - 8 * z, yy); ctx.lineTo(bx + 8 * z, yy); ctx.stroke();
    }
    ctx.beginPath(); ctx.moveTo(bx, by0); ctx.lineTo(bx, by1); ctx.stroke();
  }

  // monster in doorway
  if (s.monster && s.monster.active) {
    const m = s.monster;
    const [mx, my] = w2s(x1 - WALLT/2 + (m.fleeing ? m.fleeing * 300 : 0), 0);
    drawMonster(mx, my, z, m);
    if (G.items.includes(3) && !m.fleeing && x1 > G.px && Math.floor(now * 3) % 2 === 0)
      text('!', mx, my - 70 * z, 36 * z + 10, '#f44');
  }
}

function drawWallBand(x0, x1, yTop, yBot, alcSeg, isTop) {
  const [sx0, sy0] = w2s(x0, yTop);
  const [sx1, sy1] = w2s(x1, yBot);
  const z = camera().zoom;
  ctx.fillStyle = '#6f6f6f';
  ctx.fillRect(sx0, sy0, sx1 - sx0, sy1 - sy0);
  // bricks
  ctx.fillStyle = '#7c7c7c';
  const bw = 56 * z, bh = 30 * z;
  const startRow = Math.floor((sy0) / bh);
  for (let yy = sy0; yy < sy1 - 2; yy += bh) {
    const row = Math.round(yy / bh);
    for (let xx = sx0 - ((sx0 % bw) + bw) % bw + (row % 2 ? bw/2 : 0); xx < sx1; xx += bw + 4*z) {
      const bx = Math.max(xx, sx0), bx2 = Math.min(xx + bw - 4*z, sx1);
      if (bx2 - bx < 6) continue;
      ctx.beginPath();
      if (ctx.roundRect) ctx.roundRect(bx, yy + 2*z, bx2 - bx, bh - 6*z, 6*z); else ctx.rect(bx, yy + 2*z, bx2-bx, bh - 6*z);
      ctx.fill();
    }
  }
  // alcove pocket
  if (alcSeg) {
    const ax = alcoveX(alcSeg.i);
    const [ax0, ay0] = w2s(ax - ALC_W/2, isTop ? -HALL - ALC_D : HALL);
    const [ax1, ay1] = w2s(ax + ALC_W/2, isTop ? -HALL : HALL + ALC_D);
    ctx.fillStyle = '#0a0a0a';
    ctx.fillRect(ax0, ay0, ax1 - ax0, ay1 - ay0);
    // outline
    ctx.strokeStyle = '#000'; ctx.lineWidth = 3 * z;
    ctx.strokeRect(ax0, ay0, ax1 - ax0, ay1 - ay0);
    // label (hidden while the player is inside this pocket)
    const playerIn = G.hidden && Math.abs(G.px - ax) < ALC_W / 2;
    if (!playerIn) {
      const [lx, ly] = w2s(ax, isTop ? -HALL + 26 : HALL - 26);
      text('HIDE ' + (isTop ? '↑' : '↓'), lx, ly, Math.max(13, 15 * z), '#eee');
    }
  }
}

function drawWorm(x, y, z) {
  ctx.save();
  ctx.translate(x, y);
  const L = 700 * z, R = 55 * z;
  // smoke trail
  const grad = ctx.createLinearGradient(-L, 0, 0, 0);
  grad.addColorStop(0, 'rgba(30,30,30,0)');
  grad.addColorStop(1, 'rgba(60,60,60,0.9)');
  ctx.fillStyle = grad;
  ctx.fillRect(-L, -R, L, R * 2);
  // body
  ctx.fillStyle = '#f4f4f4';
  ctx.beginPath();
  if (ctx.roundRect) ctx.roundRect(-L * 0.6, -R, L * 0.6 + R, R * 2, R); else ctx.rect(-L*0.6, -R, L*0.6+R, R*2);
  ctx.fill();
  // face
  ctx.fillStyle = '#111';
  ctx.beginPath(); ctx.arc(-R*0.1, -R*0.35, 6*z, 0, 7); ctx.fill();
  ctx.beginPath(); ctx.arc(-R*0.1, R*0.35, 6*z, 0, 7); ctx.fill();
  ctx.restore();
}

function drawMonster(x, y, z, m) {
  ctx.save();
  ctx.translate(x, y);
  ctx.fillStyle = '#0a0a0a';
  // scratchy scribble blob
  const t = now * 7;
  for (let i = 0; i < 5; i++) {
    const a = t + i * 2.1;
    const rx = 16*z + Math.sin(a) * 5*z, ry = 11*z + Math.cos(a * 1.3) * 4*z;
    ctx.beginPath();
    ctx.ellipse(Math.sin(a*0.7)*8*z, Math.cos(a)*10*z + Math.sin(now*3)*4*z, rx, ry, a, 0, 7);
    ctx.fill();
  }
  // eyes
  ctx.fillStyle = '#fff';
  ctx.beginPath(); ctx.arc(-5*z, -4*z, 2.4*z, 0, 7); ctx.fill();
  ctx.beginPath(); ctx.arc(6*z, -2*z, 2.4*z, 0, 7); ctx.fill();
  if (m.beam > 0.1) {
    ctx.strokeStyle = `rgba(255,255,255,${m.beam})`;
    ctx.lineWidth = 3; ctx.beginPath(); ctx.arc(0, 0, 30*z, 0, 7); ctx.stroke();
  }
  ctx.restore();
}

function drawGlance(x, y, alpha, watching) {
  ctx.save();
  ctx.globalAlpha = alpha;
  const s = Math.min(W, H) * 0.09;
  // glow
  const g = ctx.createRadialGradient(x, y, s*0.3, x, y, s*2.4);
  g.addColorStop(0, 'rgba(255,255,255,0.25)'); g.addColorStop(1, 'rgba(255,255,255,0)');
  ctx.fillStyle = g; ctx.fillRect(x - s*2.4, y - s*2.4, s*4.8, s*4.8);
  // black square
  ctx.fillStyle = '#000';
  ctx.fillRect(x - s, y - s, s*2, s*2);
  ctx.strokeStyle = '#fff'; ctx.lineWidth = Math.max(3, s*0.09);
  ctx.strokeRect(x - s, y - s, s*2, s*2);
  // eye ring — animates while watching
  const ir = watching ? s * (0.42 + 0.1 * Math.sin(now * 10)) : s * 0.45;
  ctx.strokeRect(x - ir, y - ir, ir*2, ir*2);
  ctx.fillStyle = '#fff';
  const pr = watching ? s*0.16 : s*0.1;
  ctx.fillRect(x - pr, y - pr, pr*2, pr*2);
  ctx.restore();
}

function drawWarnBars(p) {
  ctx.save();
  ctx.fillStyle = `rgba(255,255,255,${0.35 + 0.45 * p})`;
  // jagged bars top and bottom (like the original warn art)
  const hgt = H * 0.085;
  for (const top of [true, false]) {
    ctx.beginPath();
    const base = top ? 0 : H;
    const dir = top ? 1 : -1;
    ctx.moveTo(0, base);
    let x = 0;
    while (x < W) {
      const step = 30 + ((x * 7919) % 50);
      const hh = hgt * (0.5 + ((x * 104729) % 100) / 160);
      ctx.lineTo(x, base + dir * hh);
      x += step;
      ctx.lineTo(x, base + dir * hh);
    }
    ctx.lineTo(W, base);
    ctx.closePath();
    ctx.fill();
  }
  ctx.restore();
}

function drawLighting(px, py) {
  lightC.width = W; lightC.height = H;
  lctx.setTransform(1, 0, 0, 1, 0, 0);
  lctx.fillStyle = 'rgba(0,0,0,0.84)';
  lctx.fillRect(0, 0, W, H);
  lctx.globalCompositeOperation = 'destination-out';
  // ambient glow around player
  const r1 = Math.min(W, H) * 0.30;
  let g = lctx.createRadialGradient(px, py, 10, px, py, r1);
  g.addColorStop(0, 'rgba(0,0,0,0.95)'); g.addColorStop(1, 'rgba(0,0,0,0)');
  lctx.fillStyle = g;
  lctx.fillRect(px - r1, py - r1, r1*2, r1*2);
  // flashlight cone
  const len = Math.max(W, H) * 0.6;
  const spread = 0.42;
  lctx.save();
  lctx.translate(px, py);
  lctx.rotate(G.facing);
  const cg = lctx.createLinearGradient(0, 0, len, 0);
  cg.addColorStop(0, 'rgba(0,0,0,0.95)');
  cg.addColorStop(0.7, 'rgba(0,0,0,0.55)');
  cg.addColorStop(1, 'rgba(0,0,0,0)');
  lctx.fillStyle = cg;
  lctx.beginPath();
  lctx.moveTo(0, 0);
  lctx.lineTo(len, -len * Math.tan(spread));
  lctx.lineTo(len, len * Math.tan(spread));
  lctx.closePath();
  lctx.fill();
  lctx.restore();
  lctx.globalCompositeOperation = 'source-over';
  ctx.drawImage(lightC, 0, 0);
}

function renderDying() {
  const t = sceneT;
  if (t < 0.55) {
    // eyes closing: two lids
    const k = Math.min(1, t / 0.5);
    ctx.fillStyle = '#1a1a1a'; ctx.fillRect(0, 0, W, H);
    ctx.fillStyle = '#000';
    ctx.beginPath();
    ctx.ellipse(W/2, -H*0.55 + k * H*0.55, W*0.85, H*0.62, 0, 0, 7); ctx.fill();
    ctx.beginPath();
    ctx.ellipse(W/2, H*1.55 - k * H*0.55, W*0.85, H*0.62, 0, 0, 7); ctx.fill();
  } else {
    const flick = Math.random() < 0.12;
    const jx = (Math.random() - 0.5) * 6, jy = (Math.random() - 0.5) * 6;
    if (!flick) text('FAIL!', W/2 + jx, H/2 + jy, Math.min(150, W*0.16));
  }
}

function renderStats() {
  // right panel: little scene (echoes the original stat art)
  ctx.fillStyle = '#0d0d0d'; ctx.fillRect(W*0.55, 0, W*0.45, H);
  ctx.strokeStyle = '#2c2c2c'; ctx.lineWidth = 4;
  ctx.strokeRect(W*0.60, H*0.30, W*0.34, H*0.36);
  // lamp scene
  const lx = W*0.77, ly = H*0.56;
  const lg = ctx.createRadialGradient(lx, ly - 40, 6, lx, ly - 40, 110);
  lg.addColorStop(0, 'rgba(255,255,240,0.55)'); lg.addColorStop(1, 'rgba(255,255,240,0)');
  ctx.fillStyle = lg; ctx.fillRect(lx - 120, ly - 160, 240, 240);
  ctx.strokeStyle = '#caa54a'; ctx.lineWidth = 5;
  ctx.beginPath(); ctx.moveTo(lx, ly - 30); ctx.lineTo(lx, ly + 30);
  ctx.moveTo(lx - 18, ly + 42); ctx.lineTo(lx, ly + 22); ctx.lineTo(lx + 18, ly + 42); ctx.stroke();
  ctx.fillStyle = '#e0c04d';
  ctx.fillRect(lx - 12, ly - 52, 24, 24);
  ctx.fillStyle = '#2a2a2a';
  ctx.fillRect(W*0.60, ly + 46, W*0.34, 12);
  text(String(G.door), W*0.9, H*0.85, 46, '#fff');

  // left: stats
  text('STATS', W*0.14, H*0.14, 74, '#fff', 'left');
  text('DOOR', W*0.14, H*0.30, 40, '#fff', 'left');
  text(String(G.door), W*0.34, H*0.30, 46, '#fff', 'left');
  text('LEVEL', W*0.14, H*0.42, 40, '#fff', 'left');
  text(String(G.level), W*0.34, H*0.42, 46, '#fff', 'left');
  text('+' + G.bonus + ' PS', W*0.14, H*0.55, 40, '#fff', 'left');
  text('TOTAL ' + save.points, W*0.14, H*0.63, 22, '#999', 'left');
  text('CAUSE: ' + (G.deathCause === 'worm' ? 'THE WORM' : G.deathCause === 'glance' ? 'GLANCE' : 'IT GOT YOU'),
       W*0.14, H*0.675, 16, '#666', 'left');

  const b = statsLayout().btn;
  const hov = mouse.x > b.x && mouse.x < b.x + b.w && mouse.y > b.y && mouse.y < b.y + b.h;
  ctx.strokeStyle = hov ? '#7f7' : '#fff'; ctx.lineWidth = 3;
  ctx.beginPath();
  if (ctx.roundRect) ctx.roundRect(b.x, b.y, b.w, b.h, 14); else ctx.rect(b.x, b.y, b.w, b.h);
  ctx.stroke();
  text('RESTART', b.x + b.w/2, b.y + b.h/2 + 2, 32);

  // waving SPACE FOR MAIN MENU (text engine style FX)
  const msg = 'SPACE FOR MAIN MENU';
  let xx = W*0.14;
  for (let i = 0; i < msg.length; i++) {
    const chW = 13;
    const yy = H*0.90 + Math.sin(now * 4 + i * 0.55) * 5;
    text(msg[i], xx, yy, 20, '#bbb', 'left');
    xx += msg[i] === ' ' ? 10 : chW;
  }
}

// ---------------- main loop ----------------
newRun();
let last = performance.now();
function loop(ts) {
  const dt = Math.min(0.05, (ts - last) / 1000);
  last = ts;
  update(dt);
  render();
  requestAnimationFrame(loop);
}
requestAnimationFrame(loop);
