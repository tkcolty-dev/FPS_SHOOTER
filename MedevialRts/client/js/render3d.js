// 3D top-down renderer (Three.js) + 2D overlay for bars/rings/cursors/minimap.
// The world simulation is 2D (x, y); here x→X, y→Z, and height is ours to play
// with. All models come from models.js — the art file.

import * as THREE from 'three';
import { G } from './state.js';
import { buildEntityMesh, buildFarm, buildTree } from './models.js';
import { BUILDINGS, UNITS, COLORS, SKINS } from '/shared/gamedata.js';

let renderer, scene, overlay, octx, mini, mtx;
let worldGroup = null;
const cams = [];
const entMeshes = new Map(); // id -> {group, kind}
let fx = [];                 // {type:'shot'|'poof', ...}
const raycaster = new THREE.Raycaster();
const groundPlane = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0);
const _v = new THREE.Vector3();
const artLoader = new THREE.TextureLoader();
const artTextures = new Map();

function artTexture(name) {
  if (!artTextures.has(name)) {
    const tex = artLoader.load(`assets/${name}.png`);
    tex.colorSpace = THREE.SRGBColorSpace;
    tex.magFilter = THREE.LinearFilter;
    tex.minFilter = THREE.LinearMipmapLinearFilter;
    artTextures.set(name, tex);
  }
  return artTextures.get(name);
}

// Generated unit art is displayed as camera-facing cards inside the 3D world.
// This preserves the terrain/camera while using polished top-down raster sprites.
function buildUnitSprite(kind) {
  const g = new THREE.Group();
  const size = (kind === 'knight' || kind === 'catapult') ? 50 : 34;
  const material = new THREE.SpriteMaterial({ map: artTexture(kind), transparent: true, depthWrite: false });
  const sprite = new THREE.Sprite(material);
  sprite.scale.set(size, size, 1);
  sprite.position.y = size * 0.52;
  g.add(sprite);
  g.userData.artSprite = sprite;
  g.userData.idleTexture = material.map;
  if (kind !== 'catapult') {
    g.userData.walkTextures = [artTexture(`${kind}_walk_0`), artTexture(`${kind}_walk_1`)];
  }
  return g;
}

function buildBuildingSprite(kind) {
  const sizes = { castle: 130, windmill: 76, barracks: 96, stables: 96, workshop: 96, tower: 60 };
  const size = sizes[kind] || 80;
  const g = new THREE.Group();
  const material = new THREE.SpriteMaterial({ map: artTexture(kind), transparent: true, depthWrite: false });
  const sprite = new THREE.Sprite(material);
  sprite.scale.set(size, size, 1);
  sprite.position.y = size * 0.48;
  g.add(sprite);
  g.userData.artSprite = sprite;
  if (kind === 'windmill') {
    const bladeMaterial = new THREE.SpriteMaterial({ map: artTexture('windmill_blades'), transparent: true, depthWrite: false });
    const blades = new THREE.Sprite(bladeMaterial);
    blades.scale.set(68, 68, 1);
    blades.position.set(0, size * 0.53, 0.5);
    g.add(blades);
    g.userData.blades = blades;
  }
  return g;
}

export function initRender() {
  const canvas = document.getElementById('game-canvas');
  renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
  renderer.setPixelRatio(Math.min(2, devicePixelRatio));
  scene = new THREE.Scene();
  scene.background = new THREE.Color('#141d12');

  scene.add(new THREE.HemisphereLight('#dfeadf', '#4a5a40', 1.15));
  const sun = new THREE.DirectionalLight('#fff2d8', 1.35);
  sun.position.set(-0.6, 1, -0.4);
  scene.add(sun);

  for (let i = 0; i < 2; i++) {
    cams.push(new THREE.PerspectiveCamera(50, 1, 10, 6000));
  }

  overlay = document.getElementById('overlay-canvas');
  octx = overlay.getContext('2d');
  mini = document.getElementById('minimap');
  mtx = mini.getContext('2d');

  const fit = () => {
    renderer.setSize(innerWidth, innerHeight, false);
    overlay.width = innerWidth * devicePixelRatio;
    overlay.height = innerHeight * devicePixelRatio;
    mini.width = 176 * devicePixelRatio;
    mini.height = 176 * devicePixelRatio;
  };
  addEventListener('resize', fit);
  fit();
}

function skinOf(slot) {
  const p = G.players.find(p => p.slot === slot);
  return SKINS[p && p.skin] ? p.skin : 'kingdom';
}
function ownerColor(o) { return o >= 0 ? COLORS[o] : '#9a9a9a'; }

// ---------------------------------------------------------------- world

export function setupWorld() {
  if (worldGroup) { scene.remove(worldGroup); disposeDeep(worldGroup); }
  for (const m of entMeshes.values()) { scene.remove(m.group); disposeDeep(m.group); }
  entMeshes.clear();
  fx = [];

  worldGroup = new THREE.Group();
  const { w, h } = G.world;

  // checkerboard grass texture
  const tc = document.createElement('canvas');
  tc.width = tc.height = 256;
  const t = tc.getContext('2d');
  t.fillStyle = '#3c7a3a'; t.fillRect(0, 0, 256, 256);
  t.fillStyle = 'rgba(255,255,255,0.05)';
  t.fillRect(0, 0, 128, 128); t.fillRect(128, 128, 128, 128);
  const tex = new THREE.CanvasTexture(tc);
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
  tex.repeat.set(w / 180, h / 180);
  tex.colorSpace = THREE.SRGBColorSpace;

  const ground = new THREE.Mesh(
    new THREE.BoxGeometry(w + 240, 20, h + 240),
    new THREE.MeshLambertMaterial({ map: tex })
  );
  ground.position.set(w / 2, -10, h / 2);
  worldGroup.add(ground);

  // world border posts
  const borderMat = new THREE.MeshLambertMaterial({ color: '#3b2c17' });
  for (let x = 0; x <= w; x += 200) addPost(x, 0);
  for (let x = 0; x <= w; x += 200) addPost(x, h);
  for (let y = 200; y < h; y += 200) { addPost(0, y); addPost(w, y); }
  function addPost(x, y) {
    const p = new THREE.Mesh(new THREE.BoxGeometry(10, 34, 10), borderMat);
    p.position.set(x, 17, y);
    worldGroup.add(p);
  }

  for (const tr of G.map.trees) {
    const m = buildTree(tr.v);
    m.position.set(tr.x, 0, tr.y);
    m.rotation.y = (tr.x * 13 + tr.y * 7) % 6.28;
    worldGroup.add(m);
  }
  scene.add(worldGroup);
}

function disposeDeep(obj) {
  obj.traverse(o => {
    if (o.geometry) o.geometry.dispose();
    if (o.material) (Array.isArray(o.material) ? o.material : [o.material]).forEach(m => { if (m.map) m.map.dispose(); m.dispose(); });
  });
}

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

function updateCam(i, vp) {
  const cs = camStateFor(vp.i);
  const cam = cams[i];
  cam.aspect = vp.w / vp.h;
  const dist = 720 / cs.zoom;
  cam.position.set(cs.x, dist, cs.y + dist * 0.62);
  cam.lookAt(cs.x, 0, cs.y);
  cam.updateProjectionMatrix();
}

export function screenToWorld(sx, sy, li = 0) {
  const vp = vpForLocal(li);
  const cam = cams[vp.i];
  const nx = ((sx - vp.x) / vp.w) * 2 - 1;
  const ny = -(((sy - vp.y) / vp.h) * 2 - 1);
  raycaster.setFromCamera({ x: nx, y: ny }, cam);
  const out = new THREE.Vector3();
  raycaster.ray.intersectPlane(groundPlane, out);
  return out ? { x: out.x, y: out.z } : { x: 0, y: 0 };
}

function project(wx, wy, wh, vp) {
  _v.set(wx, wh, wy).project(cams[vp.i]);
  return {
    x: vp.x + (_v.x + 1) / 2 * vp.w,
    y: vp.y + (1 - _v.y) / 2 * vp.h,
    ok: _v.z < 1,
  };
}

// ---------------------------------------------------------------- fx

export function addShot(fromId, toId, kind) {
  const a = G.ents.get(fromId);
  if (!a || !G.ents.get(toId)) return;
  const h0 = BUILDINGS[a.k] ? 85 : (a.k === 'balloon' ? 90 : 22);
  const mesh = kind === 'rock'
    ? new THREE.Mesh(new THREE.SphereGeometry(7, 8, 8), new THREE.MeshLambertMaterial({ color: '#666' }))
    : new THREE.Mesh(new THREE.BoxGeometry(14, 1.6, 1.6), new THREE.MeshBasicMaterial({ color: '#f2e6c2' }));
  scene.add(mesh);
  fx.push({ type: 'shot', kind, x: a.rx ?? a.x, y: a.ry ?? a.y, h: h0, tx: toId, t: 0, dur: kind === 'rock' ? 0.55 : 0.3, mesh });
}

export function addPoof(x, y, big) {
  const mesh = new THREE.Mesh(
    new THREE.SphereGeometry(big ? 30 : 12, 10, 10),
    new THREE.MeshBasicMaterial({ color: big ? '#e8a23a' : '#ddd', transparent: true, opacity: 0.85 })
  );
  mesh.position.set(x, 18, y);
  scene.add(mesh);
  fx.push({ type: 'poof', t: 0, dur: big ? 0.7 : 0.4, mesh, big });
}

function tickFx(dt) {
  for (let i = fx.length - 1; i >= 0; i--) {
    const f = fx[i];
    f.t += dt;
    if (f.t >= f.dur) { scene.remove(f.mesh); disposeDeep(f.mesh); fx.splice(i, 1); continue; }
    const p = f.t / f.dur;
    if (f.type === 'shot') {
      const tgt = G.ents.get(f.tx);
      const tx = tgt ? (tgt.rx ?? tgt.x) : f.x, ty = tgt ? (tgt.ry ?? tgt.y) : f.y;
      const th = tgt && tgt.k === 'balloon' ? 80 : 14;
      const x = f.x + (tx - f.x) * p, y = f.y + (ty - f.y) * p;
      const h = f.h + (th - f.h) * p + Math.sin(p * Math.PI) * (f.kind === 'rock' ? 120 : 34);
      f.mesh.position.set(x, h, y);
      f.mesh.lookAt(tx, th, ty);
    } else {
      const s = 0.4 + p * (f.big ? 2.6 : 1.8);
      f.mesh.scale.set(s, s, s);
      f.mesh.material.opacity = 0.85 * (1 - p);
    }
  }
}

// ---------------------------------------------------------------- ents

function syncEnts(dt, now) {
  const seen = new Set();
  for (const e of G.ents.values()) {
    seen.add(e.i);
    let m = entMeshes.get(e.i);
    if (!m) {
      const group = e.k === 'farm'
        ? buildFarm()
        : (UNITS[e.k] && e.k !== 'balloon'
          ? buildUnitSprite(e.k)
          : (BUILDINGS[e.k]
            ? buildBuildingSprite(e.k)
            : buildEntityMesh(e.k, SKINS[skinOf(e.o)], ownerColor(e.o))));
      // soft blob shadow
      if (e.k !== 'farm') {
        const blob = new THREE.Mesh(
          new THREE.CircleGeometry(e.r * (BUILDINGS[e.k] ? 1.05 : 1.25), 14),
          new THREE.MeshBasicMaterial({ color: '#000', transparent: true, opacity: 0.22 })
        );
        blob.rotation.x = -Math.PI / 2;
        blob.position.y = 1.2;
        blob.userData.isShadow = true;
        group.add(blob);
      }
      scene.add(group);
      m = { group, kind: e.k };
      entMeshes.set(e.i, m);
    }
    if (e.rx === undefined) { e.rx = e.x; e.ry = e.y; }
    const k = Math.min(1, dt * 10);
    const oldRx = e.rx, oldRy = e.ry;
    e.rx += (e.x - e.rx) * k;
    e.ry += (e.y - e.ry) * k;

    const flying = UNITS[e.k] && UNITS[e.k].flying;
    const hover = flying ? 74 + Math.sin(now / 600 + e.i) * 6 : 0;
    m.group.position.set(e.rx, hover, e.ry);
    if (flying) {
      const sh = m.group.children.find(c => c.userData.isShadow);
      if (sh) sh.position.y = -hover + 1.2;
    }

    // face movement direction
    const dx = e.rx - oldRx, dy = e.ry - oldRy;
    const moving = (dx * dx + dy * dy) > 0.05;
    if (!BUILDINGS[e.k] && e.k !== 'farm' && moving) {
      m.group.rotation.y = Math.atan2(dx, dy);
    }
    const artSprite = m.group.userData.artSprite;
    if (artSprite) {
      const frames = m.group.userData.walkTextures;
      artSprite.material.map = moving && frames ? frames[Math.floor(now / 150) % frames.length] : m.group.userData.idleTexture;
    }

    // construction grows out of the ground
    if (BUILDINGS[e.k]) {
      const prog = e.d ? 1 : Math.max(0.15, e.h / BUILDINGS[e.k].hp);
      m.group.scale.y = e.d ? 1 : 0.25 + 0.75 * prog;
      const blades = m.group.userData.blades;
      if (blades && e.d) {
        if (blades.material?.isSpriteMaterial) blades.material.rotation = now / 900;
        else blades.rotation.z = now / 900;
      }
    }
  }
  for (const [id, m] of entMeshes) {
    if (!seen.has(id)) {
      scene.remove(m.group);
      disposeDeep(m.group);
      entMeshes.delete(id);
    }
  }
}

// ---------------------------------------------------------------- draw

export function draw(dt, now) {
  syncEnts(dt, now);
  tickFx(dt);

  renderer.setScissorTest(true);
  const vps = viewports();
  for (const vp of vps) {
    updateCam(vp.i, vp);
    const pr = renderer.getPixelRatio();
    renderer.setViewport(vp.x, innerHeight - vp.y - vp.h, vp.w, vp.h);
    renderer.setScissor(vp.x, innerHeight - vp.y - vp.h, vp.w, vp.h);
    renderer.render(scene, cams[vp.i]);
  }
  drawOverlay(now, vps);
  drawMinimap(vps);
}

function ringAt(vp, wx, wy, r, color, dash) {
  const c = project(wx, wy, 0, vp);
  const px = project(wx + r, wy, 0, vp);
  const py = project(wx, wy + r, 0, vp);
  if (!c.ok) return;
  const rx = Math.abs(px.x - c.x), ry = Math.abs(py.y - c.y);
  octx.strokeStyle = color;
  octx.lineWidth = 2.2;
  if (dash) octx.setLineDash([7, 6]);
  octx.beginPath();
  octx.ellipse(c.x, c.y, rx, ry, 0, 0, 7);
  octx.stroke();
  octx.setLineDash([]);
}

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
    octx.save();
    octx.beginPath();
    octx.rect(vp.x, vp.y, vp.w, vp.h);
    octx.clip();

    // selection rings (colored per selecting local player)
    for (const L of G.local) {
      if (G.mode === '1v1' && vpForLocal(L.lp).i !== vp.i) continue;
      for (const id of L.sel) {
        const e = G.ents.get(id);
        if (e) ringAt(vp, e.rx ?? e.x, e.ry ?? e.y, (e.r || 14) + 8, COLORS[L.slot], true);
      }
    }

    // health / progress bars
    for (const e of G.ents.values()) {
      if (e.k === 'farm') continue;
      const isB = !!BUILDINGS[e.k];
      const max = isB ? BUILDINGS[e.k].hp : UNITS[e.k].hp;
      const top = isB ? 105 : (UNITS[e.k].flying ? 130 : 42);
      const damaged = e.h < max;
      const training = isB && e.q;
      const constructing = isB && !e.d;
      if (!damaged && !training && !constructing) continue;
      const p = project(e.rx ?? e.x, e.ry ?? e.y, top, vp);
      if (!p.ok) continue;
      const w = Math.max(26, (e.r || 12) * 1.5);
      if (damaged || constructing) bar(p.x, p.y, w, e.h / max, constructing ? '#c9a94f' : healthColor(e.h / max));
      if (training) bar(p.x, p.y + 7, w, e.p || 0, '#7fd4ff');
    }

    // build-placement ghost rings
    for (const L of G.local) {
      if (!L.placing) continue;
      if (G.mode === '1v1' && vpForLocal(L.lp).i !== vp.i) continue;
      const spec = BUILDINGS[L.placing];
      const w = screenToWorld(L.cursor.x, L.cursor.y, L.lp);
      ringAt(vp, w.x, w.y, spec.size / 2, '#eaf6ff', true);
      if (L.placing === 'windmill') ringAt(vp, w.x, w.y, BUILDINGS.windmill.farmRange, 'rgba(216,168,63,0.55)', true);
      octx.fillStyle = '#eaf6ff';
      octx.font = '13px Trebuchet MS';
      octx.textAlign = 'center';
      const c = project(w.x, w.y, 0, vp);
      octx.fillText(spec.name, c.x, c.y - 14);
    }

    // drag select boxes
    for (const L of G.local) {
      if (!L.drag) continue;
      const { x0, y0, x1, y1 } = L.drag;
      octx.strokeStyle = COLORS[L.slot];
      octx.fillStyle = 'rgba(200,230,255,0.10)';
      octx.lineWidth = 1.5;
      octx.fillRect(Math.min(x0, x1), Math.min(y0, y1), Math.abs(x1 - x0), Math.abs(y1 - y0));
      octx.strokeRect(Math.min(x0, x1), Math.min(y0, y1), Math.abs(x1 - x0), Math.abs(y1 - y0));
    }

    // cursors (gamepad locals always; mouse local only in split so you can find it)
    for (const L of G.local) {
      if (G.mode === '1v1' && vpForLocal(L.lp).i !== vp.i) continue;
      if (!L.usesPad) continue; // mouse players keep the system cursor
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

  // split divider
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
  for (const vp of vps) {
    const cs = camStateFor(vp.i);
    const vw = (1100 / cs.zoom) * k * (vp.w / innerWidth) * 2;
    const vh = (760 / cs.zoom) * k;
    mtx.strokeStyle = '#fff';
    mtx.strokeRect(cs.x * k - vw / 2, cs.y * k - vh / 2, vw, vh);
  }
}
