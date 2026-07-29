// 2D top-down canvas renderer with split-screen viewports.
//
// ART CONTRACT (for the artist / Codex):
//   Drop PNGs into client/assets/ using the names in ART_KEYS below.
//   Any sprite that exists is drawn automatically; anything missing falls
//   back to a built-in vector placeholder. See assets/README-ART.md.

import { G, canPlaceAt } from './state.js';
import { BUILDINGS, UNITS, COLORS, SKINS, WALL_LINK_RANGE } from '/shared/gamedata.js';

export const ART_KEYS = [
  'title_logo', 'title_bg',
  'tile_grass', 'farm', 'tree_1', 'tree_2', 'tree_3',
  'castle', 'windmill', 'windmill_blades', 'barracks', 'stables', 'workshop', 'tower', 'wall',
  'builder', 'swordsman', 'archer', 'knight', 'catapult', 'balloon',
  'builder_walk_0', 'builder_walk_1', 'swordsman_walk_0', 'swordsman_walk_1',
  'archer_walk_0', 'archer_walk_1', 'knight_walk_0', 'knight_walk_1',
  'arrow', 'rock',
];

const sprites = {};
export function spr(key) {
  let s = sprites[key];
  if (!s) {
    s = sprites[key] = { img: new Image(), ok: false };
    s.img.onload = () => { s.ok = true; };
    s.img.src = `assets/${key}.png`;
  }
  return s.ok ? s.img : null;
}
function sprSkin(key, skin) {
  if (skin && skin !== 'kingdom') {
    const v = spr(`${key}__${skin}`);
    if (v) return v;
  }
  return spr(key);
}
function skinOf(slot) {
  const p = G.players.find(p => p.slot === slot);
  return SKINS[p && p.skin] ? p.skin : 'kingdom';
}
function ownerColor(o) { return o >= 0 ? COLORS[o] : '#888'; }

let canvas, ctx, overlay, octx, mini, mtx;
let fx = [];

export function initRender() {
  canvas = document.getElementById('game-canvas');
  ctx = canvas.getContext('2d');
  overlay = document.getElementById('overlay-canvas');
  octx = overlay.getContext('2d');
  mini = document.getElementById('minimap');
  mtx = mini.getContext('2d');
  const fit = () => {
    canvas.width = innerWidth * devicePixelRatio;
    canvas.height = innerHeight * devicePixelRatio;
    overlay.width = innerWidth * devicePixelRatio;
    overlay.height = innerHeight * devicePixelRatio;
    mini.width = 176 * devicePixelRatio;
    mini.height = 176 * devicePixelRatio;
  };
  addEventListener('resize', fit);
  fit();
  for (const k of ART_KEYS) spr(k);
}

export function setupWorld() { fx = []; }

// ---------------------------------------------------------------- viewports

export function viewports() {
  if (G.mode === '1v1' && G.local.length === 2) {
    const w2 = Math.floor(innerWidth / 2);
    return [
      { i: 0, x: 0, y: 0, w: w2 - 1, h: innerHeight },
      { i: 1, x: w2 + 1, y: 0, w: innerWidth - w2 - 1, h: innerHeight },
    ];
  }
  return [{ i: 0, x: 0, y: 0, w: innerWidth, h: innerHeight }];
}
export function vpForLocal(li) {
  const vps = viewports();
  return vps[Math.min(li, vps.length - 1)];
}
export function camStateFor(li) {
  return (G.mode === '1v1' && G.local[li]) ? G.local[li].cam : G.cam;
}

export function screenToWorld(sx, sy, li = 0) {
  const vp = vpForLocal(li);
  const cs = camStateFor(vp.i);
  return {
    x: cs.x + (sx - vp.x - vp.w / 2) / cs.zoom,
    y: cs.y + (sy - vp.y - vp.h / 2) / cs.zoom,
  };
}
function worldToScreen(wx, wy, vp) {
  const cs = camStateFor(vp.i);
  return {
    x: vp.x + vp.w / 2 + (wx - cs.x) * cs.zoom,
    y: vp.y + vp.h / 2 + (wy - cs.y) * cs.zoom,
  };
}

// ---------------------------------------------------------------- fx

export function addShot(fromId, toId, kind) {
  const a = G.ents.get(fromId);
  if (!a || !G.ents.get(toId)) return;
  fx.push({ type: 'shot', kind, x: a.rx ?? a.x, y: (a.ry ?? a.y) - 14, tx: toId, t: 0, dur: kind === 'rock' ? 0.55 : 0.3 });
}
export function addPoof(x, y, big) {
  fx.push({ type: 'poof', x, y, t: 0, dur: big ? 0.7 : 0.4, big });
}

// ---------------------------------------------------------------- main draw

export function draw(dt, now) {
  // lerp render positions ONCE per frame
  for (const e of G.ents.values()) {
    if (e.rx === undefined) { e.rx = e.x; e.ry = e.y; }
    const k = Math.min(1, dt * 10);
    e.rx += (e.x - e.rx) * k;
    e.ry += (e.y - e.ry) * k;
  }
  for (let i = fx.length - 1; i >= 0; i--) {
    fx[i].t += dt;
    if (fx[i].t >= fx[i].dur) fx.splice(i, 1);
  }

  ctx.setTransform(devicePixelRatio, 0, 0, devicePixelRatio, 0, 0);
  ctx.fillStyle = '#10150c';
  ctx.fillRect(0, 0, innerWidth, innerHeight);

  const vps = viewports();
  for (const vp of vps) drawWorldInViewport(vp, now);

  drawOverlay(now, vps);
  drawMinimap(vps);
}

function drawWorldInViewport(vp, now) {
  const cs = camStateFor(vp.i);
  ctx.save();
  ctx.beginPath();
  ctx.rect(vp.x, vp.y, vp.w, vp.h);
  ctx.clip();

  ctx.translate(vp.x + vp.w / 2, vp.y + vp.h / 2);
  ctx.scale(cs.zoom, cs.zoom);
  ctx.translate(-cs.x, -cs.y);

  drawGround(vp, cs);

  ctx.strokeStyle = 'rgba(0,0,0,0.45)';
  ctx.lineWidth = 14;
  ctx.strokeRect(0, 0, G.world.w, G.world.h);

  for (const t of G.map.trees) drawTree(t);

  const blds = [], ground = [], air = [], walls = [];
  for (const e of G.ents.values()) {
    if (e.k === 'farm') drawFarm(e);
    else if (BUILDINGS[e.k]) { blds.push(e); if (e.k === 'wall') walls.push(e); }
    else if (UNITS[e.k] && UNITS[e.k].flying) air.push(e);
    else ground.push(e);
  }
  blds.sort((a, b) => a.ry - b.ry);
  ground.sort((a, b) => a.ry - b.ry);
  drawWallLinks(walls);
  for (const e of blds) drawBuilding(e, now);
  for (const e of ground) drawUnit(e, now);
  drawFx();
  for (const e of air) drawUnit(e, now); // flyers above everything

  ctx.restore();
}

// ---------------------------------------------------------------- ground

function drawGround(vp, cs) {
  const { w, h } = G.world;
  const tile = spr('tile_grass');
  if (tile) {
    const pat = ctx.createPattern(tile, 'repeat');
    ctx.fillStyle = pat;
    ctx.fillRect(0, 0, w, h);
    return;
  }
  ctx.fillStyle = '#3c7a3a';
  ctx.fillRect(0, 0, w, h);
  // checker only over the visible range
  const size = 90;
  const x0 = Math.max(0, Math.floor((cs.x - vp.w / 2 / cs.zoom) / size) * size);
  const x1 = Math.min(w, cs.x + vp.w / 2 / cs.zoom + size);
  const y0 = Math.max(0, Math.floor((cs.y - vp.h / 2 / cs.zoom) / size) * size);
  const y1 = Math.min(h, cs.y + vp.h / 2 / cs.zoom + size);
  ctx.fillStyle = 'rgba(255,255,255,0.035)';
  for (let y = y0; y < y1; y += size) {
    for (let x = x0 + ((y / size) % 2 ? size : 0); x < x1; x += size * 2) {
      ctx.fillRect(x, y, size, size);
    }
  }
}

function drawTree(t) {
  const img = spr(`tree_${t.v}`);
  if (img) { ctx.drawImage(img, t.x - 26, t.y - 44, 52, 60); return; }
  ctx.fillStyle = 'rgba(0,0,0,0.2)';
  ctx.beginPath(); ctx.ellipse(t.x, t.y + 8, 20, 8, 0, 0, 7); ctx.fill();
  ctx.fillStyle = '#5b4426';
  ctx.fillRect(t.x - 4, t.y - 8, 8, 18);
  ctx.fillStyle = ['#2e5d2b', '#356b31', '#2a5527'][t.v - 1];
  ctx.beginPath(); ctx.arc(t.x, t.y - 22, 22, 0, 7); ctx.fill();
  ctx.beginPath(); ctx.arc(t.x - 12, t.y - 10, 14, 0, 7); ctx.fill();
  ctx.beginPath(); ctx.arc(t.x + 12, t.y - 10, 14, 0, 7); ctx.fill();
}

function drawFarm(e) {
  const img = spr('farm');
  if (img) { ctx.drawImage(img, e.rx - e.r, e.ry - e.r, e.r * 2, e.r * 2); return; }
  ctx.fillStyle = '#c9a94f';
  ctx.fillRect(e.rx - e.r, e.ry - e.r * 0.8, e.r * 2, e.r * 1.6);
  ctx.strokeStyle = '#a8853a'; ctx.lineWidth = 3;
  for (let i = -3; i <= 3; i++) {
    ctx.beginPath();
    ctx.moveTo(e.rx - e.r + 6, e.ry + i * e.r * 0.22);
    ctx.lineTo(e.rx + e.r - 6, e.ry + i * e.r * 0.22);
    ctx.stroke();
  }
  ctx.strokeStyle = '#6e5222'; ctx.lineWidth = 4;
  ctx.strokeRect(e.rx - e.r, e.ry - e.r * 0.8, e.r * 2, e.r * 1.6);
}

// ---------------------------------------------------------------- buildings

// ramparts between nearby friendly walls, drawn under the wall blocks
function drawWallLinks(walls) {
  for (let i = 0; i < walls.length; i++) {
    for (let j = i + 1; j < walls.length; j++) {
      const a = walls[i], b = walls[j];
      if (a.o !== b.o) continue;
      if (Math.hypot(a.rx - b.rx, a.ry - b.ry) > WALL_LINK_RANGE) continue;
      const pal = SKINS[skinOf(a.o)] || SKINS.kingdom;
      const done = a.d && b.d;
      ctx.lineCap = 'round';
      ctx.strokeStyle = 'rgba(0,0,0,0.35)';
      ctx.lineWidth = 26;
      if (!done) ctx.setLineDash([14, 10]);
      ctx.beginPath(); ctx.moveTo(a.rx, a.ry); ctx.lineTo(b.rx, b.ry); ctx.stroke();
      ctx.strokeStyle = done ? pal.stoneDark : 'rgba(120,120,120,0.5)';
      ctx.lineWidth = 20;
      ctx.beginPath(); ctx.moveTo(a.rx, a.ry); ctx.lineTo(b.rx, b.ry); ctx.stroke();
      ctx.strokeStyle = done ? pal.stone : 'rgba(160,160,160,0.5)';
      ctx.lineWidth = 9;
      ctx.beginPath(); ctx.moveTo(a.rx, a.ry - 4); ctx.lineTo(b.rx, b.ry - 4); ctx.stroke();
      ctx.setLineDash([]);
    }
  }
}

function drawBuilding(e, now) {
  const spec = BUILDINGS[e.k];
  const s = e.r;
  const col = ownerColor(e.o);
  const skin = skinOf(e.o);
  const img = sprSkin(e.k, skin);

  ctx.save();
  if (!e.d) ctx.globalAlpha = 0.55 + 0.45 * (e.h / spec.hp);
  if (img) ctx.drawImage(img, e.rx - s, e.ry - s, s * 2, s * 2);
  else placeholderBuilding(e, spec, col, now, SKINS[skin]);
  ctx.restore();

  // owner banner (walls skip it — a flag per wall chunk would be clutter)
  if (e.k !== 'wall') {
    ctx.fillStyle = col;
    ctx.strokeStyle = '#00000088';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(e.rx - 7, e.ry - s - 26); ctx.lineTo(e.rx + 9, e.ry - s - 21);
    ctx.lineTo(e.rx - 7, e.ry - s - 14); ctx.closePath();
    ctx.fill(); ctx.stroke();
    ctx.strokeStyle = '#3b2c17'; ctx.lineWidth = 3;
    ctx.beginPath(); ctx.moveTo(e.rx - 7, e.ry - s - 28); ctx.lineTo(e.rx - 7, e.ry - s + 2); ctx.stroke();
  }

  if (!e.d) {
    ctx.strokeStyle = '#c9a94f'; ctx.lineWidth = 3;
    ctx.setLineDash([10, 8]);
    ctx.strokeRect(e.rx - s, e.ry - s, s * 2, s * 2);
    ctx.setLineDash([]);
  }
}

function placeholderBuilding(e, spec, col, now, pal) {
  pal = pal || SKINS.kingdom;
  const s = e.r, x = e.rx, y = e.ry;
  ctx.fillStyle = 'rgba(0,0,0,0.25)';
  ctx.beginPath(); ctx.ellipse(x, y + s * 0.75, s, s * 0.3, 0, 0, 7); ctx.fill();

  if (e.k === 'castle') {
    ctx.fillStyle = pal.stone;
    ctx.fillRect(x - s * 0.8, y - s * 0.55, s * 1.6, s * 1.2);
    ctx.fillStyle = pal.stoneDark;
    for (const dx of [-0.8, 0.8]) {
      ctx.fillRect(x + dx * s - s * 0.28, y - s * 0.9, s * 0.56, s * 1.5);
      crenels(x + dx * s, y - s * 0.9, s * 0.56);
    }
    ctx.fillStyle = pal.stone;
    crenels(x, y - s * 0.55, s * 1.6);
    ctx.fillStyle = '#241a10';
    ctx.beginPath(); ctx.arc(x, y + s * 0.65, s * 0.3, Math.PI, 0); ctx.lineTo(x + s * 0.3, y + s * 0.65); ctx.fill();
    ctx.fillStyle = pal.roof;
    ctx.fillRect(x - s * 0.8, y - s * 0.55, s * 1.6, s * 0.14);
  } else if (e.k === 'windmill') {
    ctx.fillStyle = pal.wood;
    ctx.beginPath(); ctx.moveTo(x - s * 0.55, y + s * 0.7); ctx.lineTo(x - s * 0.3, y - s * 0.5);
    ctx.lineTo(x + s * 0.3, y - s * 0.5); ctx.lineTo(x + s * 0.55, y + s * 0.7); ctx.closePath(); ctx.fill();
    ctx.fillStyle = pal.roof;
    ctx.beginPath(); ctx.moveTo(x - s * 0.38, y - s * 0.5); ctx.lineTo(x, y - s * 0.95); ctx.lineTo(x + s * 0.38, y - s * 0.5); ctx.fill();
    const blades = spr('windmill_blades');
    const ang = (e.d ? now / 900 : 0);
    ctx.save();
    ctx.translate(x, y - s * 0.45); ctx.rotate(ang);
    if (blades) ctx.drawImage(blades, -s * 0.9, -s * 0.9, s * 1.8, s * 1.8);
    else {
      ctx.strokeStyle = '#efe3c0'; ctx.lineWidth = 7; ctx.lineCap = 'round';
      for (let i = 0; i < 4; i++) { ctx.rotate(Math.PI / 2); ctx.beginPath(); ctx.moveTo(0, 0); ctx.lineTo(s * 0.85, 0); ctx.stroke(); }
    }
    ctx.restore();
  } else if (e.k === 'tower') {
    ctx.fillStyle = pal.stoneDark;
    ctx.fillRect(x - s * 0.5, y - s, s, s * 1.7);
    ctx.fillStyle = pal.stone;
    crenels(x, y - s, s * 1.15);
  } else if (e.k === 'wall') {
    ctx.fillStyle = pal.stoneDark;
    ctx.fillRect(x - s, y - s * 0.6, s * 2, s * 1.3);
    ctx.fillStyle = pal.stone;
    crenels(x, y - s * 0.6, s * 1.9);
  } else {
    ctx.fillStyle = pal.wood;
    ctx.fillRect(x - s * 0.85, y - s * 0.3, s * 1.7, s * 0.95);
    ctx.fillStyle = { barracks: '#6d3535', stables: '#5c4a2e', workshop: '#44505c' }[e.k] || '#555';
    ctx.beginPath(); ctx.moveTo(x - s, y - s * 0.3); ctx.lineTo(x, y - s * 0.95); ctx.lineTo(x + s, y - s * 0.3); ctx.closePath(); ctx.fill();
    ctx.fillStyle = '#3d2c19';
    ctx.fillRect(x - s * 0.18, y + s * 0.1, s * 0.36, s * 0.55);
    if (e.k === 'workshop') {
      ctx.strokeStyle = '#d8d0c0'; ctx.lineWidth = 4;
      ctx.beginPath(); ctx.arc(x, y - s * 0.5, s * 0.16, 0, 7); ctx.stroke();
    }
  }
}

function crenels(cx, topY, width) {
  const n = 4, w = width / (n * 2 - 1);
  for (let i = 0; i < n; i++) ctx.fillRect(cx - width / 2 + i * w * 2, topY - w * 0.9, w, w * 0.9);
}

// ---------------------------------------------------------------- units

function drawUnit(e, now) {
  const r = e.r || 12;
  const col = ownerColor(e.o);
  const flying = UNITS[e.k] && UNITS[e.k].flying;
  const lift = flying ? 46 + Math.sin(now / 600 + e.i) * 5 : 0;
  // walk animation frames (<unit>_walk_0/1.png) kick in while moving
  let img = spr(e.k);
  const moving = Math.abs(e.x - e.rx) + Math.abs(e.y - e.ry) > 1.5;
  if (img && moving) {
    const wf = spr(`${e.k}_walk_${Math.floor(now / 180) % 2}`);
    if (wf) img = wf;
  }

  // ground shadow, always at the feet
  const footY = e.ry + r * 0.7;
  ctx.fillStyle = 'rgba(0,0,0,0.25)';
  ctx.beginPath(); ctx.ellipse(e.rx, footY, r * (flying ? 0.7 : 1.05), r * 0.42, 0, 0, 7); ctx.fill();

  const dy = e.ry - lift;
  if (img) {
    // team ring on the ground instead of a floating dot
    ctx.strokeStyle = col;
    ctx.lineWidth = 2.5;
    ctx.beginPath(); ctx.ellipse(e.rx, footY, r * 1.15, r * 0.5, 0, 0, 7); ctx.stroke();
    // sprite bottom sits ON the shadow (sprites fill their canvas, feet at bottom edge)
    const size = r * 2.8;
    ctx.drawImage(img, e.rx - size / 2, footY - lift - size + r * 0.15, size, size);
  } else {
    placeholderUnit(e, r, col, now, dy);
  }
}

function placeholderUnit(e, r, col, now, yy) {
  const x = e.rx, y = yy;
  const bob = Math.sin(now / 180 + e.i) * 1.2;

  if (e.k === 'balloon') {
    ctx.fillStyle = col;
    ctx.strokeStyle = 'rgba(0,0,0,0.55)';
    ctx.lineWidth = 2.5;
    ctx.beginPath(); ctx.arc(x, y - r * 1.1 + bob, r * 1.15, 0, 7); ctx.fill(); ctx.stroke();
    ctx.strokeStyle = '#d8cba8'; ctx.lineWidth = 2;
    ctx.beginPath(); ctx.moveTo(x - r * 0.5, y - r * 0.35 + bob); ctx.lineTo(x - r * 0.35, y + r * 0.45 + bob); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(x + r * 0.5, y - r * 0.35 + bob); ctx.lineTo(x + r * 0.35, y + r * 0.45 + bob); ctx.stroke();
    ctx.fillStyle = '#8a6b45';
    ctx.fillRect(x - r * 0.45, y + r * 0.4 + bob, r * 0.9, r * 0.55);
    return;
  }

  if (e.k === 'catapult') {
    ctx.fillStyle = '#6b4e2a';
    ctx.fillRect(x - r, y - r * 0.35 + bob, r * 2, r * 0.7);
    ctx.fillStyle = '#3d2c19';
    for (const dx of [-r * 0.6, r * 0.6]) { ctx.beginPath(); ctx.arc(x + dx, y + r * 0.4, r * 0.35, 0, 7); ctx.fill(); }
    ctx.strokeStyle = '#8a6b45'; ctx.lineWidth = 5; ctx.lineCap = 'round';
    ctx.beginPath(); ctx.moveTo(x - r * 0.5, y + bob); ctx.lineTo(x + r * 0.7, y - r * 1.3 + bob); ctx.stroke();
    ctx.fillStyle = col;
    ctx.beginPath(); ctx.arc(x + r * 0.7, y - r * 1.3 + bob, 5, 0, 7); ctx.fill();
    return;
  }

  ctx.fillStyle = col;
  ctx.strokeStyle = 'rgba(0,0,0,0.55)';
  ctx.lineWidth = 2.5;
  ctx.beginPath(); ctx.arc(x, y + bob, r, 0, 7); ctx.fill(); ctx.stroke();
  ctx.fillStyle = '#e8c9a0';
  ctx.beginPath(); ctx.arc(x, y - r * 0.95 + bob, r * 0.55, 0, 7); ctx.fill(); ctx.stroke();

  ctx.strokeStyle = '#f0e6d2'; ctx.lineWidth = 3; ctx.lineCap = 'round';
  if (e.k === 'swordsman') {
    ctx.beginPath(); ctx.moveTo(x + r * 0.7, y + bob); ctx.lineTo(x + r * 1.6, y - r * 1.1 + bob); ctx.stroke();
  } else if (e.k === 'archer') {
    ctx.beginPath(); ctx.arc(x + r * 1.1, y + bob - r * 0.2, r * 0.8, -1.2, 1.2); ctx.stroke();
  } else if (e.k === 'knight') {
    ctx.fillStyle = '#cfcfcf';
    ctx.beginPath(); ctx.arc(x, y - r * 0.95 + bob, r * 0.62, Math.PI, 0); ctx.fill();
    ctx.strokeStyle = '#cfcfcf'; ctx.lineWidth = 4;
    ctx.beginPath(); ctx.moveTo(x + r * 0.7, y + bob + r * 0.4); ctx.lineTo(x + r * 1.7, y - r * 1.3 + bob); ctx.stroke();
  } else if (e.k === 'builder') {
    ctx.strokeStyle = '#c9a94f';
    ctx.beginPath(); ctx.moveTo(x + r * 0.6, y + bob - r * 0.9); ctx.lineTo(x + r * 1.3, y + bob - r * 0.1); ctx.stroke();
    ctx.fillStyle = '#9a9a9a';
    ctx.fillRect(x + r * 0.35, y + bob - r * 1.25, r * 0.55, r * 0.5);
  }
}

// ---------------------------------------------------------------- fx draw (world space)

function drawFx() {
  for (const f of fx) {
    const p = f.t / f.dur;
    if (f.type === 'shot') {
      const tgt = G.ents.get(f.tx);
      const tx = tgt ? tgt.rx : f.x;
      const tyLift = tgt && tgt.k === 'balloon' ? 46 : 0;
      const ty = (tgt ? tgt.ry : f.y) - tyLift;
      const x = f.x + (tx - f.x) * p;
      const y = f.y + (ty - f.y) * p - Math.sin(p * Math.PI) * (f.kind === 'rock' ? 90 : 30);
      if (f.kind === 'rock') {
        const img = spr('rock');
        if (img) ctx.drawImage(img, x - 9, y - 9, 18, 18);
        else { ctx.fillStyle = '#666'; ctx.beginPath(); ctx.arc(x, y, 8, 0, 7); ctx.fill(); }
      } else {
        const img = spr('arrow');
        const ang = Math.atan2(ty - f.y, tx - f.x);
        ctx.save(); ctx.translate(x, y); ctx.rotate(ang);
        if (img) ctx.drawImage(img, -10, -3, 20, 6);
        else { ctx.strokeStyle = '#e8dcc0'; ctx.lineWidth = 2.5; ctx.beginPath(); ctx.moveTo(-9, 0); ctx.lineTo(9, 0); ctx.stroke(); }
        ctx.restore();
      }
    } else if (f.type === 'poof') {
      const r = (f.big ? 46 : 20) * (0.3 + p);
      ctx.globalAlpha = 1 - p;
      ctx.fillStyle = f.big ? '#e8a23a' : '#ddd';
      for (let j = 0; j < (f.big ? 7 : 4); j++) {
        const a = j * 2.1 + f.x;
        ctx.beginPath();
        ctx.arc(f.x + Math.cos(a) * r * 0.6, f.y + Math.sin(a) * r * 0.5, r * 0.4, 0, 7);
        ctx.fill();
      }
      ctx.globalAlpha = 1;
    }
  }
}

// ---------------------------------------------------------------- overlay
// Screen-space: selection rings, bars, ghosts, drag boxes, cursors, divider.

function bar(cx, cy, w, frac, color) {
  frac = Math.max(0, Math.min(1, frac));
  octx.fillStyle = 'rgba(0,0,0,0.65)';
  octx.fillRect(cx - w / 2 - 1, cy - 3, w + 2, 6);
  octx.fillStyle = color;
  octx.fillRect(cx - w / 2, cy - 2, w * frac, 4);
}
const healthColor = f => f > 0.55 ? '#5ad46a' : f > 0.25 ? '#e8c33a' : '#e85a3a';

function drawOverlay(now, vps) {
  octx.setTransform(devicePixelRatio, 0, 0, devicePixelRatio, 0, 0);
  octx.clearRect(0, 0, innerWidth, innerHeight);

  for (const vp of vps) {
    const cs = camStateFor(vp.i);
    octx.save();
    octx.beginPath();
    octx.rect(vp.x, vp.y, vp.w, vp.h);
    octx.clip();

    // selection rings, colored per selecting local player
    for (const L of G.local) {
      if (G.mode === '1v1' && vpForLocal(L.lp).i !== vp.i) continue;
      for (const id of L.sel) {
        const e = G.ents.get(id);
        if (!e) continue;
        const p = worldToScreen(e.rx, e.ry, vp);
        octx.strokeStyle = COLORS[L.slot];
        octx.lineWidth = 2.5;
        octx.setLineDash([6, 5]);
        octx.beginPath();
        octx.arc(p.x, p.y, ((e.r || 12) + 8) * cs.zoom, 0, 7);
        octx.stroke();
        octx.setLineDash([]);
      }
    }

    // health / progress bars
    for (const e of G.ents.values()) {
      if (e.k === 'farm') continue;
      const isB = !!BUILDINGS[e.k];
      const max = isB ? BUILDINGS[e.k].hp : UNITS[e.k].hp;
      const flying = !isB && UNITS[e.k].flying;
      const damaged = e.h < max;
      const training = isB && e.q;
      const constructing = isB && !e.d;
      if (!damaged && !training && !constructing) continue;
      const p = worldToScreen(e.rx, e.ry, vp);
      const top = p.y - ((e.r || 12) + (flying ? 74 : 16)) * cs.zoom;
      const w = Math.max(24, (e.r || 12) * 1.8 * cs.zoom);
      if (damaged || constructing) bar(p.x, top, w, e.h / max, constructing ? '#c9a94f' : healthColor(e.h / max));
      if (training) bar(p.x, top + 7, w, e.p || 0, '#7fd4ff');
    }

    // build ghosts
    for (const L of G.local) {
      if (!L.placing) continue;
      if (G.mode === '1v1' && vpForLocal(L.lp).i !== vp.i) continue;
      const spec = BUILDINGS[L.placing];
      const wpos = screenToWorld(L.cursor.x, L.cursor.y, L.lp);
      const err = canPlaceAt(L, L.placing, wpos);
      const col = err ? '#ff6b5d' : '#7dffa0';
      const c = worldToScreen(wpos.x, wpos.y, vp);
      octx.fillStyle = err ? 'rgba(255,90,70,0.16)' : 'rgba(120,255,150,0.14)';
      octx.fillRect(c.x - spec.size / 2 * cs.zoom, c.y - spec.size / 2 * cs.zoom, spec.size * cs.zoom, spec.size * cs.zoom);
      octx.strokeStyle = col;
      octx.lineWidth = 2;
      octx.setLineDash([8, 6]);
      octx.strokeRect(c.x - spec.size / 2 * cs.zoom, c.y - spec.size / 2 * cs.zoom, spec.size * cs.zoom, spec.size * cs.zoom);
      if (L.placing === 'windmill') {
        octx.strokeStyle = 'rgba(216,168,63,0.55)';
        octx.beginPath();
        octx.arc(c.x, c.y, BUILDINGS.windmill.farmRange * cs.zoom, 0, 7);
        octx.stroke();
      }
      octx.setLineDash([]);
      octx.font = '13px Trebuchet MS';
      octx.textAlign = 'center';
      octx.fillStyle = col;
      octx.fillText(err ? `✕ ${err}` : `✓ ${spec.name} — click to place`, c.x, c.y - spec.size / 2 * cs.zoom - 8);
    }

    // drag boxes
    for (const L of G.local) {
      if (!L.drag) continue;
      const { x0, y0, x1, y1 } = L.drag;
      octx.strokeStyle = COLORS[L.slot];
      octx.fillStyle = 'rgba(200,230,255,0.10)';
      octx.lineWidth = 1.5;
      octx.fillRect(Math.min(x0, x1), Math.min(y0, y1), Math.abs(x1 - x0), Math.abs(y1 - y0));
      octx.strokeRect(Math.min(x0, x1), Math.min(y0, y1), Math.abs(x1 - x0), Math.abs(y1 - y0));
    }

    // gamepad cursors
    for (const L of G.local) {
      if (G.mode === '1v1' && vpForLocal(L.lp).i !== vp.i) continue;
      if (!L.usesPad) continue;
      const { x, y } = L.cursor;
      const pulse = 1 + Math.sin(now / 200) * 0.12;
      octx.strokeStyle = COLORS[L.slot];
      octx.lineWidth = 2.5;
      octx.shadowColor = '#000';
      octx.shadowBlur = 4;
      octx.beginPath(); octx.arc(x, y, 10 * pulse, 0, 7); octx.stroke();
      octx.beginPath();
      octx.moveTo(x - 16, y); octx.lineTo(x - 6, y);
      octx.moveTo(x + 6, y); octx.lineTo(x + 16, y);
      octx.moveTo(x, y - 16); octx.lineTo(x, y - 6);
      octx.moveTo(x, y + 6); octx.lineTo(x, y + 16);
      octx.stroke();
      octx.shadowBlur = 0;
    }
    octx.restore();
  }

  if (vps.length === 2) {
    octx.fillStyle = '#1a140e';
    octx.fillRect(innerWidth / 2 - 2, 0, 4, innerHeight);
  }
}

// ---------------------------------------------------------------- minimap

function drawMinimap(vps) {
  const S = 176 * devicePixelRatio;
  mtx.setTransform(1, 0, 0, 1, 0, 0);
  mtx.fillStyle = '#2c5e2b';
  mtx.fillRect(0, 0, S, S);
  const { w, h } = G.world;
  const k = Math.min(S / w, S / h);
  mtx.fillStyle = '#c9a94f';
  for (const f of G.map.farms) mtx.fillRect(f.x * k - 2, f.y * k - 2, 5, 5);
  for (const e of G.ents.values()) {
    if (e.k === 'farm') continue;
    mtx.fillStyle = ownerColor(e.o);
    const sz = BUILDINGS[e.k] ? (e.k === 'castle' ? 8 : 5) : 3;
    mtx.fillRect(e.x * k - sz / 2, e.y * k - sz / 2, sz, sz);
  }
  mtx.lineWidth = 1.5;
  mtx.strokeStyle = '#fff';
  for (const vp of vps) {
    const cs = camStateFor(vp.i);
    const vw = vp.w / cs.zoom * k, vh = vp.h / cs.zoom * k;
    mtx.strokeRect(cs.x * k - vw / 2, cs.y * k - vh / 2, vw, vh);
  }
}
