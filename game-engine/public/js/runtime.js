/* Spark Engine — runtime: stage renderer, sprites, threads, physics, camera, particles, sound, HUD */
(function () {
  const W = 480, H = 360;
  const STOP = Symbol('stop');
  const Lib = window.SparkLib;
  const uid = () => Math.random().toString(36).slice(2, 10);
  const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
  const toNum = v => { if (typeof v === 'number') return isNaN(v) ? 0 : v; if (typeof v === 'boolean') return v ? 1 : 0; const n = Number(v); return (v === '' || v === null || v === undefined || isNaN(n)) ? 0 : n; };
  const toStr = v => { if (typeof v === 'number') return String(v); if (v === null || v === undefined) return ''; return String(v); };
  const toBool = v => { if (typeof v === 'boolean') return v; if (typeof v === 'string') { const s = v.toLowerCase(); return !(s === '' || s === '0' || s === 'false'); } return !!v; };
  const isNumeric = v => typeof v === 'number' || (typeof v === 'string' && v.trim() !== '' && !isNaN(Number(v)));
  const KEYMAP = { ' ': 'space', ArrowUp: 'up arrow', ArrowDown: 'down arrow', ArrowLeft: 'left arrow', ArrowRight: 'right arrow', Enter: 'enter' };
  const PAD_BUTTONS = { A: 0, B: 1, X: 2, Y: 3, LB: 4, RB: 5, LT: 6, RT: 7, select: 8, start: 9, up: 12, down: 13, left: 14, right: 15 };

  const PARTICLE_PRESETS = {
    sparkles: { count: 18, colors: ['#fff59d', '#ffffff', '#ffe082'], speed: 3, life: 0.6, gravity: 0, size: 4, shape: 'star' },
    explosion: { count: 36, colors: ['#ff6d00', '#ffd600', '#ff1744', '#424242'], speed: 7, life: 0.7, gravity: 0.1, size: 7, shape: 'circle' },
    smoke: { count: 14, colors: ['#9e9e9e', '#bdbdbd', '#757575'], speed: 1.5, life: 1.2, gravity: -0.05, size: 10, shape: 'circle', fade: true },
    confetti: { count: 40, colors: ['#ff4081', '#40c4ff', '#ffd740', '#69f0ae', '#b388ff'], speed: 7, life: 1.6, gravity: 0.25, size: 6, shape: 'square' },
    hearts: { count: 10, colors: ['#ff4081', '#ff80ab', '#f50057'], speed: 2.5, life: 1.1, gravity: -0.08, size: 9, shape: 'heart' },
    coins: { count: 12, colors: ['#ffd600', '#ffea00', '#ffab00'], speed: 5, life: 0.9, gravity: 0.3, size: 6, shape: 'circle' },
    stars: { count: 16, colors: ['#ffffff', '#b3e5fc', '#fff59d'], speed: 4, life: 0.9, gravity: 0, size: 7, shape: 'star' },
    bubbles: { count: 12, colors: ['rgba(173,216,230,0.8)', 'rgba(255,255,255,0.7)'], speed: 1.5, life: 1.5, gravity: -0.12, size: 7, shape: 'ring' },
    fire: { count: 20, colors: ['#ff3d00', '#ff9100', '#ffea00'], speed: 2.5, life: 0.5, gravity: -0.15, size: 7, shape: 'circle', fade: true },
    rainbow: { count: 14, colors: ['#f44336', '#ff9800', '#ffeb3b', '#4caf50', '#2196f3', '#9c27b0'], speed: 3, life: 0.8, gravity: 0, size: 6, shape: 'circle' },
    dust: { count: 8, colors: ['#d7ccc8', '#bcaaa4'], speed: 1.5, life: 0.5, gravity: 0.02, size: 4, shape: 'circle', fade: true },
    snow: { count: 20, colors: ['#ffffff', '#e3f2fd'], speed: 1, life: 2, gravity: 0.03, size: 4, shape: 'circle' }
  };

  /* ============================ World (tile map) ============================ */
  // [name, solid in top-down, solid in side view, hazard]
  const TILE_DEFS = [
    ['empty', 0, 0, 0], ['grass', 0, 1, 0], ['dirt', 0, 1, 0], ['stone', 1, 1, 0], ['wall', 1, 1, 0], ['water', 1, 0, 0], ['tree', 1, 1, 0], ['flower', 0, 0, 0],
    ['path', 0, 1, 0], ['floor', 0, 1, 0], ['sand', 0, 1, 0], ['lava', 0, 0, 1], ['brick', 1, 1, 0], ['wood', 1, 1, 0], ['ice', 1, 1, 0], ['bush', 1, 1, 0], ['rock', 1, 1, 0],
    ['spike', 0, 0, 1], ['chest', 0, 0, 0], ['door', 0, 0, 0], ['cloud', 0, 1, 0], ['snow', 0, 1, 0]
  ];
  const TILE_INDEX = Object.fromEntries(TILE_DEFS.map((d, i) => [d[0], i]));
  const TILE_NAMES = TILE_DEFS.map(d => d[0]);
  const tileSVG = name => {
    const S = 48, w = inner => `<svg xmlns="http://www.w3.org/2000/svg" width="${S}" height="${S}" viewBox="0 0 48 48">${inner}</svg>`;
    const grass = `<rect width="48" height="48" fill="#5cb83a"/><path d="M6 40 l2 -7 l2 7 M20 18 l2 -7 l2 7 M34 30 l2 -7 l2 7 M12 12 l2 -6 l2 6 M40 10 l2 -6 l2 6" stroke="#4aa52d" stroke-width="2" fill="none"/>`;
    const dirt = `<rect width="48" height="48" fill="#8b5a2b"/><circle cx="12" cy="14" r="3" fill="#6b421a"/><circle cx="34" cy="30" r="4" fill="#6b421a"/><circle cx="22" cy="40" r="2.5" fill="#6b421a"/>`;
    const floor = `<rect width="48" height="48" fill="#cfd3dc"/><path d="M0 24 H48 M24 0 V48" stroke="#b5bac6" stroke-width="2"/>`;
    switch (name) {
      case 'grass': return w(grass);
      case 'dirt': return w(dirt);
      case 'stone': return w(`<rect width="48" height="48" fill="#8f949c"/><path d="M0 16 H48 M0 32 H48 M24 0 V16 M12 16 V32 M36 16 V32 M24 32 V48" stroke="#6d727a" stroke-width="3"/>`);
      case 'wall': return w(`<rect width="48" height="48" fill="#4a4e5a"/><path d="M0 24 H48 M24 0 V24 M12 24 V48 M36 24 V48" stroke="#2f323b" stroke-width="3"/><rect x="2" y="2" width="20" height="20" fill="#565a68"/>`);
      case 'water': return w(`<rect width="48" height="48" fill="#3f9be8"/><path d="M4 16 q6 -6 12 0 t12 0 t12 0 M4 34 q6 -6 12 0 t12 0 t12 0" stroke="#8fd0ff" stroke-width="3" fill="none"/>`);
      case 'tree': return w(grass + `<rect x="21" y="30" width="6" height="16" fill="#7a4a1e"/><circle cx="24" cy="20" r="16" fill="#2e8b3a"/><circle cx="16" cy="26" r="9" fill="#2e8b3a"/><circle cx="32" cy="26" r="9" fill="#2e8b3a"/><circle cx="20" cy="15" r="5" fill="#45a84f"/>`);
      case 'flower': return w(grass + `<circle cx="14" cy="16" r="5" fill="#ff4f8b"/><circle cx="14" cy="16" r="2" fill="#ffe36b"/><circle cx="34" cy="30" r="5" fill="#ffd93b"/><circle cx="34" cy="30" r="2" fill="#ff7a00"/><circle cx="30" cy="12" r="4" fill="#fff"/><circle cx="30" cy="12" r="1.5" fill="#ffd93b"/>`);
      case 'path': return w(`<rect width="48" height="48" fill="#d9b876"/><circle cx="10" cy="12" r="3" fill="#c7a461"/><circle cx="30" cy="34" r="4" fill="#c7a461"/><circle cx="38" cy="10" r="2.5" fill="#c7a461"/>`);
      case 'floor': return w(floor);
      case 'sand': return w(`<rect width="48" height="48" fill="#f0dc9c"/><circle cx="12" cy="30" r="2" fill="#e2c97f"/><circle cx="30" cy="14" r="2" fill="#e2c97f"/><circle cx="36" cy="38" r="2" fill="#e2c97f"/>`);
      case 'lava': return w(`<rect width="48" height="48" fill="#ff5a1f"/><path d="M4 20 q8 -8 16 0 t16 0 t16 0" stroke="#ffd33b" stroke-width="4" fill="none"/><circle cx="14" cy="36" r="4" fill="#ffd33b"/><circle cx="36" cy="30" r="3" fill="#ffb21f"/>`);
      case 'brick': return w(`<rect width="48" height="48" fill="#c0564a"/><path d="M0 16 H48 M0 32 H48 M24 0 V16 M12 16 V32 M36 16 V32 M24 32 V48" stroke="#8e3a30" stroke-width="3"/>`);
      case 'wood': return w(`<rect width="48" height="48" fill="#c89550"/><path d="M0 12 H48 M0 24 H48 M0 36 H48" stroke="#a5743a" stroke-width="2"/><circle cx="12" cy="18" r="2" fill="#a5743a"/><circle cx="36" cy="30" r="2" fill="#a5743a"/>`);
      case 'ice': return w(`<rect width="48" height="48" fill="#bfe9ff"/><path d="M8 40 L20 8 M28 44 L40 14" stroke="#ffffff" stroke-width="3"/><rect width="48" height="48" fill="none" stroke="#9ad4f5" stroke-width="2"/>`);
      case 'bush': return w(grass + `<ellipse cx="24" cy="30" rx="18" ry="13" fill="#2e8b3a"/><ellipse cx="16" cy="24" rx="9" ry="8" fill="#3aa347"/><ellipse cx="30" cy="22" rx="10" ry="9" fill="#3aa347"/><circle cx="22" cy="30" r="2.5" fill="#e53935"/><circle cx="32" cy="32" r="2.5" fill="#e53935"/>`);
      case 'rock': return w(grass + `<path d="M6 40 L12 20 L26 12 L40 20 L42 40 Z" fill="#8f949c"/><path d="M12 20 L26 12 L30 26 Z" fill="#b4b9c2"/>`);
      case 'spike': return w(`<path d="M0 48 L12 10 L24 48 L36 10 L48 48 Z" fill="#9aa0a6"/><path d="M12 10 L18 30 L6 30 Z" fill="#c9cdd2"/>`);
      case 'chest': return w(floor + `<rect x="8" y="16" width="32" height="24" rx="4" fill="#a5743a"/><rect x="8" y="24" width="32" height="4" fill="#6b421a"/><rect x="21" y="22" width="6" height="8" fill="#ffd93b"/>`);
      case 'door': return w(`<rect width="48" height="48" fill="#4a4e5a"/><rect x="10" y="4" width="28" height="44" rx="14" fill="#8b5a2b"/><rect x="14" y="8" width="20" height="40" rx="10" fill="#a5743a"/><circle cx="30" cy="30" r="3" fill="#ffd93b"/>`);
      case 'cloud': return w(`<ellipse cx="24" cy="30" rx="22" ry="12" fill="#ffffff"/><circle cx="16" cy="22" r="10" fill="#ffffff"/><circle cx="30" cy="20" r="12" fill="#ffffff"/>`);
      case 'snow': return w(`<rect width="48" height="48" fill="#eef6ff"/><circle cx="12" cy="14" r="2" fill="#ffffff"/><circle cx="34" cy="30" r="3" fill="#ffffff"/><rect y="40" width="48" height="8" fill="#d9e8f7"/>`);
      default: return null;
    }
  };
  function rng(seed) { let a = (seed >>> 0) || 1; return () => { a |= 0; a = a + 0x6D2B79F5 | 0; let t = Math.imul(a ^ a >>> 15, 1 | a); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; }; }

  class World {
    constructor(R) { this.R = R; this.images = {}; this.clear(); }
    clear() { this.w = 0; this.h = 0; this.size = 48; this.tiles = null; this.sideView = false; this.start = { x: 0, y: 0 }; this.type = ''; }
    get active() { return !!this.tiles; }
    img(kind) {
      const name = TILE_NAMES[kind]; if (!name || name === 'empty') return null;
      let im = this.images[name]; if (!im) { im = new Image(); im.ready = false; im.onload = () => im.ready = true; im.src = Lib.svgToDataURL(tileSVG(name)); this.images[name] = im; }
      return im.ready ? im : null;
    }
    // world coords: map is centred on the origin; column 0 is the left, row 0 is the TOP
    left() { return -this.w * this.size / 2; } top() { return this.h * this.size / 2; }
    right() { return this.w * this.size / 2; } bottom() { return -this.h * this.size / 2; }
    colOf(x) { return Math.floor((x - this.left()) / this.size); } rowOf(y) { return Math.floor((this.top() - y) / this.size); }
    centerOf(c, r) { return { x: this.left() + (c + 0.5) * this.size, y: this.top() - (r + 0.5) * this.size }; }
    get(c, r) { return (this.tiles && c >= 0 && r >= 0 && c < this.w && r < this.h) ? this.tiles[r * this.w + c] : 0; }
    set(c, r, kind) { if (this.tiles && c >= 0 && r >= 0 && c < this.w && r < this.h) this.tiles[r * this.w + c] = kind; }
    kindOf(name) { return TILE_INDEX[toStr(name).toLowerCase()] ?? 0; }
    nameAt(x, y) { return TILE_NAMES[this.get(this.colOf(x), this.rowOf(y))]; }
    isSolid(kind) { const d = TILE_DEFS[kind]; return !!(d && (this.sideView ? d[2] : d[1])); }
    isHazard(kind) { const d = TILE_DEFS[kind]; return !!(d && d[3]); }
    isFree(c, r) { const k = this.get(c, r); return !this.isSolid(k) && !this.isHazard(k); }
    rectOf(c, r) { const l = this.left() + c * this.size, t = this.top() - r * this.size; return { left: l, right: l + this.size, top: t, bottom: t - this.size }; }
    // solid tile rects overlapping a bounds box
    solidRects(b) {
      if (!this.tiles) return [];
      const out = []; const c0 = Math.max(0, this.colOf(b.left)), c1 = Math.min(this.w - 1, this.colOf(b.right - 0.001)), r0 = Math.max(0, this.rowOf(b.top - 0.001)), r1 = Math.min(this.h - 1, this.rowOf(b.bottom));
      for (let r = r0; r <= r1; r++) for (let c = c0; c <= c1; c++) if (this.isSolid(this.get(c, r))) out.push(this.rectOf(c, r));
      return out;
    }
    touching(b, test) {
      if (!this.tiles) return false;
      const c0 = Math.max(0, this.colOf(b.left)), c1 = Math.min(this.w - 1, this.colOf(b.right - 0.001)), r0 = Math.max(0, this.rowOf(b.top - 0.001)), r1 = Math.min(this.h - 1, this.rowOf(b.bottom));
      for (let r = r0; r <= r1; r++) for (let c = c0; c <= c1; c++) if (test(this.get(c, r))) return true;
      return false;
    }
    randomFree(rand = Math.random) {
      if (!this.tiles) return { x: Math.random() * 400 - 200, y: Math.random() * 300 - 150 };
      for (let i = 0; i < 500; i++) { const c = Math.floor(rand() * this.w), r = Math.floor(rand() * this.h); if (this.isFree(c, r) && (!this.sideView || this.isSolid(this.get(c, r + 1)))) return this.centerOf(c, r); }
      return this.start;
    }
    fill(c0, r0, c1, r1, kind) { for (let r = Math.min(r0, r1); r <= Math.max(r0, r1); r++) for (let c = Math.min(c0, c1); c <= Math.max(c0, c1); c++) this.set(c, r, kind); }
    generate(type, w, h, seed) {
      w = clamp(Math.round(w) || 40, 8, 200); h = clamp(Math.round(h) || 30, 6, 150); seed = Math.round(seed) || Math.floor(Math.random() * 1e9);
      const rand = rng(seed); const K = TILE_INDEX;
      this.w = w; this.h = h; this.tiles = new Uint8Array(w * h); this.type = type; this.sideView = type === 'platformer level';
      const ri = (a, b) => a + Math.floor(rand() * (b - a + 1));
      const blob = (cx, cy, rad, kind, chance = 1) => { for (let r = Math.max(0, cy - rad); r <= Math.min(h - 1, cy + rad); r++) for (let c = Math.max(0, cx - rad); c <= Math.min(w - 1, cx + rad); c++) if ((c - cx) ** 2 + (r - cy) ** 2 <= rad * rad && rand() < chance) this.set(c, r, kind); };
      const walk = (c, r, steps, kind, horizBias) => { for (let i = 0; i < steps; i++) { this.set(c, r, kind); const d = rand(); if (d < 0.25 + horizBias) c++; else if (d < 0.5) c--; else if (d < 0.75) r++; else r--; c = clamp(c, 1, w - 2); r = clamp(r, 1, h - 2); } };
      const border = kind => { for (let c = 0; c < w; c++) { this.set(c, 0, kind); this.set(c, h - 1, kind); } for (let r = 0; r < h; r++) { this.set(0, r, kind); this.set(w - 1, r, kind); } };
      const clearStart = (c, r, rad) => blob(c, r, rad, this.sideView ? K.empty : (type === 'dungeon' || type === 'cave' ? K.floor : K.grass));
      switch (type) {
        case 'empty': { this.tiles.fill(K.empty); this.start = this.centerOf(Math.floor(w / 2), Math.floor(h / 2)); break; }
        case 'forest': {
          this.tiles.fill(K.grass);
          for (let i = 0; i < (w * h) / 60; i++) blob(ri(0, w - 1), ri(0, h - 1), ri(1, 3), K.tree, 0.7);
          for (let i = 0; i < (w * h) / 250; i++) blob(ri(0, w - 1), ri(0, h - 1), ri(1, 3), K.bush, 0.5);
          for (let i = 0; i < (w * h) / 300; i++) blob(ri(0, w - 1), ri(0, h - 1), ri(0, 1), K.rock, 0.6);
          for (let i = 0; i < (w * h) / 25; i++) if (this.get(ri(0, w - 1), ri(0, h - 1)) === K.grass) this.set(ri(0, w - 1), ri(0, h - 1), K.flower);
          for (let i = 0; i < Math.max(1, (w * h) / 600); i++) blob(ri(3, w - 4), ri(3, h - 4), ri(2, 4), K.water);
          walk(ri(1, w - 2), 1, w * 2, K.path, 0.1);
          border(K.tree);
          this.start = this.centerOf(Math.floor(w / 2), Math.floor(h / 2)); clearStart(Math.floor(w / 2), Math.floor(h / 2), 2);
          break;
        }
        case 'town': {
          this.tiles.fill(K.grass);
          for (let r = 2; r < h - 2; r += Math.max(5, Math.floor(h / 4))) this.fill(1, r, w - 2, r, K.path);
          for (let c = 2; c < w - 2; c += Math.max(6, Math.floor(w / 4))) this.fill(c, 1, c, h - 2, K.path);
          for (let i = 0; i < (w * h) / 60; i++) {
            const hw = ri(3, 5), hh = ri(3, 4), c = ri(1, w - hw - 2), r = ri(1, h - hh - 2);
            let ok = true; for (let rr = r - 1; rr <= r + hh; rr++) for (let cc = c - 1; cc <= c + hw; cc++) if (this.get(cc, rr) !== K.grass) ok = false;
            if (!ok) continue;
            this.fill(c, r, c + hw - 1, r + hh - 1, K.brick); this.fill(c + 1, r + 1, c + hw - 2, r + hh - 2, K.floor); this.set(c + Math.floor(hw / 2), r + hh - 1, K.door);
          }
          for (let i = 0; i < (w * h) / 40; i++) { const c = ri(0, w - 1), r = ri(0, h - 1); if (this.get(c, r) === K.grass) this.set(c, r, rand() < 0.5 ? K.tree : K.flower); }
          border(K.tree);
          this.start = this.centerOf(2, 2); clearStart(2, 2, 1);
          break;
        }
        case 'dungeon': {
          this.tiles.fill(K.wall);
          const rooms = []; const n = Math.max(3, Math.floor((w * h) / 90));
          for (let i = 0; i < n * 4 && rooms.length < n; i++) {
            const rw = ri(4, 9), rh = ri(3, 7), c = ri(1, w - rw - 2), r = ri(1, h - rh - 2);
            if (rooms.some(o => c < o.c + o.w + 1 && c + rw + 1 > o.c && r < o.r + o.h + 1 && r + rh + 1 > o.r)) continue;
            rooms.push({ c, r, w: rw, h: rh }); this.fill(c, r, c + rw - 1, r + rh - 1, K.floor);
          }
          for (let i = 1; i < rooms.length; i++) {
            const a = rooms[i - 1], b = rooms[i]; const ac = a.c + Math.floor(a.w / 2), ar = a.r + Math.floor(a.h / 2), bc = b.c + Math.floor(b.w / 2), br = b.r + Math.floor(b.h / 2);
            this.fill(ac, ar, bc, ar, K.floor); this.fill(bc, ar, bc, br, K.floor);
          }
          for (const rm of rooms.slice(1)) { if (rand() < 0.5) this.set(rm.c + ri(0, rm.w - 1), rm.r + ri(0, rm.h - 1), K.chest); if (rand() < 0.35) this.set(rm.c + ri(0, rm.w - 1), rm.r + ri(0, rm.h - 1), K.lava); }
          const last = rooms[rooms.length - 1]; this.set(last.c + Math.floor(last.w / 2), last.r, K.door);
          const f = rooms[0]; this.start = this.centerOf(f.c + Math.floor(f.w / 2), f.r + Math.floor(f.h / 2));
          break;
        }
        case 'cave': {
          let a = new Uint8Array(w * h); for (let i = 0; i < a.length; i++) a[i] = rand() < 0.46 ? 1 : 0;
          for (let it = 0; it < 4; it++) { const b = new Uint8Array(w * h); for (let r = 0; r < h; r++) for (let c = 0; c < w; c++) { let n = 0; for (let dr = -1; dr <= 1; dr++) for (let dc = -1; dc <= 1; dc++) { const rr = r + dr, cc = c + dc; if (rr < 0 || cc < 0 || rr >= h || cc >= w || a[rr * w + cc]) n++; } b[r * w + c] = n >= 5 ? 1 : 0; } a = b; }
          for (let i = 0; i < a.length; i++) this.tiles[i] = a[i] ? K.stone : K.dirt;
          border(K.stone);
          for (let i = 0; i < (w * h) / 150; i++) { const c = ri(1, w - 2), r = ri(1, h - 2); if (this.get(c, r) === K.dirt) this.set(c, r, rand() < 0.6 ? K.lava : K.chest); }
          const sc = Math.floor(w / 2), sr = Math.floor(h / 2); this.start = this.centerOf(sc, sr); blob(sc, sr, 2, K.dirt);
          break;
        }
        default: { // platformer level (side view)
          this.tiles.fill(K.empty);
          let ground = Math.max(2, Math.floor(h * 0.3)); // height of ground in tiles from the bottom
          let c = 0;
          while (c < w) {
            const run = ri(3, 8); const gap = c > 6 && rand() < 0.35 ? ri(2, 3) : 0;
            for (let i = 0; i < run && c < w; i++, c++) { for (let r = 0; r < ground; r++) this.set(c, h - 1 - r, r === ground - 1 ? K.grass : K.dirt); if (rand() < 0.08 && c > 5) this.set(c, h - 1 - ground, K.spike); }
            c += gap;
            ground = clamp(ground + ri(-1, 1), 2, Math.floor(h * 0.6));
          }
          for (let i = 0; i < w / 4; i++) { const pc = ri(4, w - 4), pr = ri(2, h - 5), len = ri(2, 4); let ok = true; for (let k = -1; k <= len; k++) for (let d = -2; d <= 1; d++) if (this.get(pc + k, pr + d) !== K.empty) ok = false; if (ok) this.fill(pc, pr, pc + len - 1, pr, K.wood); }
          for (let i = 0; i < w / 6; i++) { const cc = ri(1, w - 3), rr = ri(0, Math.floor(h / 3)); this.set(cc, rr, K.cloud); this.set(cc + 1, rr, K.cloud); }
          for (let r = 0; r < 3; r++) this.set(0, h - 1 - r, K.dirt), this.set(0, h - 4, K.grass);
          this.set(w - 1, this.firstSolidRow(w - 1) - 1, K.door);
          const sr = this.firstSolidRow(1); this.start = this.centerOf(1, sr - 1);
        }
      }
    }
    firstSolidRow(c) { for (let r = 0; r < this.h; r++) if (this.isSolid(this.get(c, r))) return r; return this.h - 1; }
    draw(ctx, map, zoom) {
      if (!this.tiles) return;
      const v = this.R.viewRect(false); const s = this.size * zoom;
      const c0 = Math.max(0, this.colOf(v.left)), c1 = Math.min(this.w - 1, this.colOf(v.right)), r0 = Math.max(0, this.rowOf(v.top)), r1 = Math.min(this.h - 1, this.rowOf(v.bottom));
      for (let r = r0; r <= r1; r++) for (let c = c0; c <= c1; c++) {
        const k = this.tiles[r * this.w + c]; if (!k) continue;
        const im = this.img(k); if (!im) continue;
        const [sx, sy] = map(this.left() + c * this.size, this.top() - r * this.size);
        ctx.drawImage(im, sx, sy, s + 0.5, s + 0.5);
      }
    }
  }

  /* ============================ Thread ============================ */
  class Thread {
    constructor(R, target, script) {
      this.R = R; this.target = target; this.script = script; this.stopped = false; this.done = false;
      this.wakeFn = null; this.warp = 0; this.ignorePause = false; this.children = [];
    }
    start() {
      // scripts start on the next microtask so every hat started in the same tick is live before any of them runs (lets "stop all" stop them all)
      this.promise = Promise.resolve().then(() => { if (this.stopped) throw STOP; return this.script.fn(this.target, this); }).catch(e => { if (e !== STOP) console.error('Script error in ' + this.target.name + ':', e); }).finally(() => { this.done = true; });
      return this;
    }
    yield() {
      if (this.stopped) throw STOP;
      if (this.warp > 0 && performance.now() - this.R.frameStart < 400) return;
      return new Promise(res => { this.wakeFn = res; }).then(() => { if (this.stopped) throw STOP; });
    }
    async wait(secs) {
      const end = this.R.time + Math.max(0, toNum(secs));
      do { await this.yield(); } while (this.R.time < end);
    }
    stop() { this.stopped = true; this.children.forEach(c => c.stop()); }
  }

  /* ============================ Target (sprite or stage) ============================ */
  class Target {
    constructor(R, data, isStage) {
      this.R = R; this.isStage = !!isStage; this.isClone = false;
      this.id = data.id || uid(); this.name = data.name || (isStage ? 'Stage' : 'Sprite');
      this.x = data.x || 0; this.y = data.y || 0; this.direction = data.direction ?? 90; this.size = data.size ?? 100;
      this.visible = data.visible !== false; this.rotationStyle = data.rotationStyle || 'all around'; this.draggable = !!data.draggable;
      this.costumes = (data.costumes || []).map(c => ({ ...c }));
      this.currentCostume = data.currentCostume || 0;
      this.sounds = (data.sounds || []).map(s => ({ ...s }));
      this.volume = data.volume ?? 100;
      this.xml = data.xml || '<xml></xml>';
      this.vars = {}; this.lists = {}; this.varTypes = {};
      for (const v of data.variables || []) { if (v.type === 'list') this.lists[v.name] = Array.isArray(v.value) ? v.value.slice() : []; else if (v.type === '') this.vars[v.name] = v.value ?? 0; this.varTypes[v.name] = v.type || ''; }
      this.variables = (data.variables || []).map(v => ({ ...v }));
      if (this.isStage) { this.cloudVars = {}; for (const v of this.variables) if (v.isCloud) this.cloudVars[v.name] = true; }
      this.effects = { COLOR: 0, FISHEYE: 0, WHIRL: 0, PIXELATE: 0, MOSAIC: 0, BRIGHTNESS: 0, GHOST: 0 };
      this.soundEffects = { PITCH: 0, PAN: 0 };
      this.bubble = null; this.flipX = false; this.flipY = false; this.sticky = false; this.trail = null; this.shadow = false; this.glow = null; this.tint = null; this.squashAmt = 0;
      this.textCostume = null; this.font = 'Sans';
      this.pen = { down: false, color: '#0000ff', size: 1, alpha: 1 };
      this.phys = { mode: 'off', vx: 0, vy: 0, gravity: 1, bounce: 0, friction: 0.8, solid: false, onGround: false, maxSpeed: 25 };
      this.scripts = []; this.procs = {}; this.activeSounds = new Set();
      this.compile();
    }
    toJSON() {
      return {
        id: this.id, name: this.name, x: this.x, y: this.y, direction: this.direction, size: this.size, visible: this.visible,
        rotationStyle: this.rotationStyle, draggable: this.draggable, costumes: this.costumes.map(c => ({ name: c.name, src: c.src, cx: c.cx, cy: c.cy })),
        currentCostume: this.currentCostume, sounds: this.sounds.map(s => ({ name: s.name, preset: s.preset, src: s.src })), volume: this.volume, xml: this.xml,
        variables: this.variables.map(v => ({ id: v.id, name: v.name, type: v.type, isCloud: v.isCloud || undefined, value: v.type === 'list' ? (this.lists[v.name] || []) : v.type === '' ? (this.vars[v.name] ?? 0) : undefined }))
      };
    }
    compile() {
      const { factory, variables } = window.SparkCompiler.compile(this.xml);
      const out = factory(this.R);
      this.scripts = out.scripts; this.procs = out.procs;
      // sync variable declarations from workspace (keep values)
      const mine = variables.filter(v => this.isStage ? true : v.isLocal);
      const keep = {};
      // globals are registered on the stage by the editor even when the stage's own scripts never mention them — never drop those
      if (this.isStage) for (const v of this.variables) keep[v.name] = true;
      for (const v of mine) {
        keep[v.name] = true;
        if (!(v.name in this.varTypes)) {
          this.varTypes[v.name] = v.type;
          if (v.type === 'list') this.lists[v.name] = []; else if (v.type === '') this.vars[v.name] = 0;
        }
        if (!this.variables.find(x => x.name === v.name && x.type === v.type)) this.variables.push({ id: v.id, name: v.name, type: v.type });
      }
      this.variables = this.variables.filter(v => keep[v.name]);
      for (const name of Object.keys(this.varTypes)) if (!keep[name]) { delete this.varTypes[name]; delete this.vars[name]; delete this.lists[name]; }
      if (this.isStage) { for (const v of variables) if (v.isCloud) { this.cloudVars[v.name] = true; const ex = this.variables.find(x => x.name === v.name); if (ex) ex.isCloud = true; } this.R.cloudSetup(this); }
      this.R.onEvent('variablesChanged', this);
    }
    get costume() { return this.costumes[this.currentCostume] || this.costumes[0]; }
    img() { const c = this.textCostume || this.costume; return c ? this.R.img(c) : null; }
    costumeSize() {
      const c = this.textCostume || this.costume; const im = c && this.R.img(c);
      const w = (c && c.w) || (im && im.naturalWidth) || 1, h = (c && c.h) || (im && im.naturalHeight) || 1;
      const cx = c && c.cx != null ? c.cx : w / 2, cy = c && c.cy != null ? c.cy : h / 2;
      return { w, h, cx, cy };
    }
    scaleX() { return (this.size / 100) * (1 + this.squashAmt); }
    scaleY() { return (this.size / 100) * (1 - this.squashAmt); }
    rotationRad() { return this.rotationStyle === 'all around' ? (this.direction - 90) * Math.PI / 180 : 0; }
    // axis-aligned bounds in world coords (Scratch coords: y up)
    bounds() {
      const { w, h, cx, cy } = this.costumeSize(); const sx = this.scaleX(), sy = this.scaleY(), r = this.rotationRad();
      const pts = [[-cx, -cy], [w - cx, -cy], [w - cx, h - cy], [-cx, h - cy]];
      let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity;
      const cos = Math.cos(r), sin = Math.sin(r);
      for (const [px, py] of pts) {
        const lx = px * sx, ly = py * sy;
        const rx = lx * cos - ly * sin, ry = lx * sin + ly * cos;
        minX = Math.min(minX, rx); maxX = Math.max(maxX, rx); minY = Math.min(minY, ry); maxY = Math.max(maxY, ry);
      }
      return { left: this.x + minX, right: this.x + maxX, top: this.y - minY, bottom: this.y - maxY, w: maxX - minX, h: maxY - minY };
    }
    /* ---- motion ---- */
    goTo(x, y) {
      if (!isFinite(x) || !isFinite(y)) return;
      const ox = this.x, oy = this.y; this.x = x; this.y = y;
      // Scratch keeps a sliver of every sprite on stage; only do that when the game isn't using a scrolling world/camera
      if (!this.isStage && this.R.fenceLikeScratch()) this.keepInFence();
      if (this.pen.down && !this.isStage) this.R.pen.line(this, ox, oy, this.x, this.y);
    }
    keepInFence() {
      const b = this.bounds(); const inset = 15; const w = b.right - b.left, h = b.top - b.bottom; if (!(w > 0 && h > 0)) return;
      const sx = Math.min(inset, w), sy = Math.min(inset, h);
      if (b.right < -W / 2 + sx) this.x += (-W / 2 + sx) - b.right; else if (b.left > W / 2 - sx) this.x -= b.left - (W / 2 - sx);
      if (b.top < -H / 2 + sy) this.y += (-H / 2 + sy) - b.top; else if (b.bottom > H / 2 - sy) this.y -= b.bottom - (H / 2 - sy);
    }
    setX(x) { this.goTo(x, this.y); } setY(y) { this.goTo(this.x, y); }
    move(steps) { const r = this.direction * Math.PI / 180; this.goTo(this.x + steps * Math.sin(r), this.y + steps * Math.cos(r)); }
    turn(deg) { this.setDirection(this.direction + deg); }
    setDirection(d) { d = ((d + 179) % 360 + 360) % 360 - 179; this.direction = d; }
    pointTowards(name) {
      const p = this.R.pointFor(this, name); if (!p) return;
      this.setDirection(90 - Math.atan2(p.y - this.y, p.x - this.x) * 180 / Math.PI);
    }
    goToTarget(name) { const p = this.R.pointFor(this, name); if (p) this.goTo(p.x, p.y); }
    moveToward(steps, name) {
      const p = this.R.pointFor(this, name); if (!p) return;
      const dx = p.x - this.x, dy = p.y - this.y, d = Math.hypot(dx, dy); if (d < 0.001) return;
      const k = Math.min(1, steps / d); this.goTo(this.x + dx * k, this.y + dy * k);
    }
    async glide(T, secs, x, y) {
      const sx = this.x, sy = this.y, start = this.R.time, dur = Math.max(0, secs);
      if (dur === 0) { this.goTo(x, y); return; }
      while (true) {
        await T.yield();
        const t = Math.min(1, (this.R.time - start) / dur);
        this.goTo(sx + (x - sx) * t, sy + (y - sy) * t);
        if (t >= 1) break;
      }
    }
    async glideTo(T, secs, name) { const p = this.R.pointFor(this, name); if (p) await this.glide(T, secs, p.x, p.y); }
    fence() {
      const v = this.R.viewRect(this.sticky); const b = this.bounds();
      let dx = 0, dy = 0;
      if (b.left < v.left) dx = v.left - b.left; else if (b.right > v.right) dx = v.right - b.right;
      if (b.bottom < v.bottom) dy = v.bottom - b.bottom; else if (b.top > v.top) dy = v.top - b.top;
      if (dx || dy) this.goTo(this.x + dx, this.y + dy);
    }
    bounceOnEdge() {
      const v = this.R.viewRect(this.sticky); const b = this.bounds();
      let dx = Math.sin(this.direction * Math.PI / 180), dy = Math.cos(this.direction * Math.PI / 180);
      let hit = false;
      if (b.left < v.left) { dx = Math.abs(dx); hit = true; } if (b.right > v.right) { dx = -Math.abs(dx); hit = true; }
      if (b.top > v.top) { dy = -Math.abs(dy); hit = true; } if (b.bottom < v.bottom) { dy = Math.abs(dy); hit = true; }
      if (!hit) return;
      this.setDirection(Math.atan2(dx, dy) * 180 / Math.PI);
      if (this.phys.mode !== 'off') { if (b.left < v.left || b.right > v.right) this.phys.vx = -this.phys.vx; if (b.top > v.top || b.bottom < v.bottom) this.phys.vy = -this.phys.vy; }
      this.fence();
    }
    touchingEdge(which) {
      const v = this.R.viewRect(this.sticky); const b = this.bounds();
      const l = b.left <= v.left, r = b.right >= v.right, t = b.top >= v.top, bo = b.bottom <= v.bottom;
      switch (which) { case 'left': return l; case 'right': return r; case 'top': return t; case 'bottom': return bo; default: return l || r || t || bo; }
    }
    /* ---- looks ---- */
    say(text, think) {
      const s = toStr(text);
      this.bubble = s === '' ? null : { text: s.length > 330 ? s.slice(0, 330) + '…' : s, think: !!think, id: uid() };
      return this.bubble && this.bubble.id;
    }
    async sayFor(T, text, secs, think) { const id = this.say(text, think); await T.wait(secs); if (this.bubble && this.bubble.id === id) this.bubble = null; }
    setCostume(v) {
      if (!this.costumes.length) return;
      if (typeof v === 'string') {
        const i = this.costumes.findIndex(c => c.name === v);
        if (i >= 0) { this.currentCostume = i; return; }
        if (v === 'next costume') { this.nextCostume(); return; }
        if (v === 'previous costume') { this.currentCostume = (this.currentCostume - 1 + this.costumes.length) % this.costumes.length; return; }
        if (!isNumeric(v)) return;
      }
      const n = Math.round(toNum(v)) - 1; const L = this.costumes.length;
      this.currentCostume = ((n % L) + L) % L;
    }
    nextCostume() { if (this.costumes.length) this.currentCostume = (this.currentCostume + 1) % this.costumes.length; }
    costumeNumberName(which) { return which === 'number' ? this.currentCostume + 1 : (this.costume ? this.costume.name : ''); }
    setEffect(name, v) { if (name in this.effects) this.effects[name] = name === 'GHOST' ? clamp(v, 0, 100) : v; }
    changeEffect(name, v) { this.setEffect(name, (this.effects[name] || 0) + v); }
    clearEffects() { for (const k in this.effects) this.effects[k] = 0; }
    setSize(s) { this.size = Math.max(0, s); }
    flip(dir) { if (dir === 'vertically') this.flipY = !this.flipY; else this.flipX = !this.flipX; }
    squash(amount) { this.squashAmt = clamp(amount, -90, 90) / 100; }
    tintFor(color, secs) { this.tint = { color, until: this.R.time + Math.max(0.05, secs) }; }
    async typeText(T, text, size, color) {
      const s = toStr(text); const speed = 30; // letters per second
      for (let i = 1; i <= s.length; i++) { this.showText(s.slice(0, i), size, color); await T.wait(1 / speed); }
      if (!s.length) this.showText('', size, color);
    }
    showText(text, size, color) {
      if (text === null || text === undefined) { this.textCostume = null; return; }
      this.textStyle = { size: size || (this.textStyle && this.textStyle.size) || 24, color: color || (this.textStyle && this.textStyle.color) || '#333333' };
      size = this.textStyle.size; color = this.textStyle.color;
      const svg = Lib.textSVG(text, clamp(size || 24, 6, 200), color || '#333333', this.font);
      const src = Lib.svgToDataURL(svg);
      const m = svg.match(/width="(\d+)" height="(\d+)"/);
      this.textCostume = { name: '_text_', text: String(text), src, w: +m[1], h: +m[2], cx: +m[1] / 2, cy: +m[2] / 2 };
      this.R.img(this.textCostume);
    }
    /* ---- sound ---- */
    findSound(v) {
      if (typeof v === 'string' && !isNumeric(v)) return this.sounds.find(s => s.name === v) || null;
      const n = Math.round(toNum(v)) - 1; return this.sounds[((n % Math.max(1, this.sounds.length)) + this.sounds.length) % Math.max(1, this.sounds.length)] || null;
    }
    playSound(v) { const s = this.findSound(v); if (s) return this.R.audio.play(this, s); }
    async playSoundUntilDone(T, v) { const p = this.playSound(v); if (!p) return; let done = false; p.then(() => done = true); while (!done) await T.yield(); }
    playPreset(name) { return this.R.audio.play(this, { name, preset: name }); }
    async playNote(T, midi, beats) { const secs = 60 / this.R.tempo * beats; this.R.audio.playBuffer(this, Lib.renderNote(this.R.audio.ctx(), toNum(midi), Math.max(0.05, secs)), 1); await T.wait(secs); }
    async playDrum(T, drum, beats) { this.playPreset(Lib.DRUMS[drum] || 'Drum Kick'); await T.wait(60 / this.R.tempo * beats); }
    setVolume(v) { this.volume = clamp(v, 0, 100); this.R.audio.updateVolume(this); }
    setSoundEffect(name, v, change) { if (!(name in this.soundEffects)) return; this.soundEffects[name] = change ? this.soundEffects[name] + v : v; this.soundEffects.PAN = clamp(this.soundEffects.PAN, -100, 100); this.soundEffects.PITCH = clamp(this.soundEffects.PITCH, -360, 360); this.R.audio.updateVolume(this); }
    clearSoundEffects() { this.soundEffects.PITCH = 0; this.soundEffects.PAN = 0; this.R.audio.updateVolume(this); }
    /* ---- pen ---- */
    penDown() { this.pen.down = true; this.R.pen.line(this, this.x, this.y, this.x, this.y); }
    setPenColor(c) { this.pen.color = toStr(c) || '#000'; }
    /* ---- sensing ---- */
    touching(name) { return this.R.touching(this, name); }
    touchingColor(c) { return this.R.touchingColor(this, c, null); }
    colorTouchingColor(c1, c2) { return this.R.touchingColor(this, c2, c1); }
    distanceTo(name) { const p = this.R.pointFor(this, name); return p ? Math.hypot(p.x - this.x, p.y - this.y) : 10000; }
    touchingSolid() { const b = this.bounds(); return this.R.world.solidRects(b).length > 0 || this.R.sprites().some(o => o !== this && o.phys.solid && o.visible && this.R.aabb(b, o.bounds())); }
    touchingTile(name) {
      const W = this.R.world; const b = this.bounds();
      if (name === 'any solid') return W.touching(b, k => W.isSolid(k));
      if (name === 'any hazard') return W.touching(b, k => W.isHazard(k));
      if (name === 'any tile') return W.touching(b, k => k !== 0);
      const kind = W.kindOf(name); return W.touching(b, k => k === kind);
    }
    goToWorldStart() { const s = this.R.world.start; this.goTo(s.x, s.y); this.phys.vx = 0; this.phys.vy = 0; }
    goToFreeTile() { const p = this.R.world.randomFree(); this.goTo(p.x, p.y); }
    /* ---- physics ---- */
    setPhysics(mode) { this.phys.mode = mode; this.phys.vx = 0; this.phys.vy = 0; if (mode === 'top-down' && this.phys.friction > 0.95) this.phys.friction = 0.8; }
    jump(power) { if (this.phys.mode === 'off') this.setPhysics('platformer'); if (this.phys.onGround) { this.phys.vy = power; this.phys.onGround = false; } }
    controlWith(keys, speed) {
      const R = this.R, k = R.keyPressed.bind(R), pad = R.pad;
      const wasd = keys === 'WASD';
      const left = k(wasd ? 'a' : 'left arrow') || pad.button(1, 'left') || pad.stick(1, 'left', 'x') < -0.4;
      const right = k(wasd ? 'd' : 'right arrow') || pad.button(1, 'right') || pad.stick(1, 'left', 'x') > 0.4;
      const up = k(wasd ? 'w' : 'up arrow') || pad.button(1, 'up') || pad.button(1, 'A') || pad.stick(1, 'left', 'y') < -0.4 || (wasd && k('space'));
      const down = k(wasd ? 's' : 'down arrow') || pad.button(1, 'down') || pad.stick(1, 'left', 'y') > 0.4;
      const h = (right ? 1 : 0) - (left ? 1 : 0), v = (up ? 1 : 0) - (down ? 1 : 0);
      if (this.phys.mode === 'platformer') {
        this.phys.vx = h * speed;
        if (up) this.jump(Math.max(8, speed * 2.2));
      } else if (this.phys.mode === 'top-down') {
        if (h || v) { const L = Math.hypot(h, v); this.phys.vx = h / L * speed; this.phys.vy = v / L * speed; }
      } else {
        if (h || v) { const L = Math.hypot(h, v); this.goTo(this.x + h / L * speed, this.y + v / L * speed); }
      }
      if (h !== 0 && this.rotationStyle === 'left-right') this.direction = h > 0 ? 90 : -90;
    }
  }

  /* ============================ Audio ============================ */
  class AudioEngine {
    constructor(R) { this.R = R; this._ctx = null; this.buffers = new Map(); this.master = null; }
    ctx() {
      if (!this._ctx) { this._ctx = new (window.AudioContext || window.webkitAudioContext)(); this.master = this._ctx.createGain(); this.master.connect(this._ctx.destination); }
      if (this._ctx.state === 'suspended') this._ctx.resume();
      return this._ctx;
    }
    async buffer(sound) {
      const key = sound.preset ? 'preset:' + sound.preset : sound.src;
      if (!key) return null;
      if (this.buffers.has(key)) return this.buffers.get(key);
      let p;
      if (sound.preset) p = Promise.resolve(Lib.renderSynth(this.ctx(), sound.preset));
      else p = fetch(sound.src).then(r => r.arrayBuffer()).then(ab => this.ctx().decodeAudioData(ab)).catch(e => { console.warn('sound decode failed', sound.name, e); return null; });
      this.buffers.set(key, p);
      return p;
    }
    preload(target) { if (!this._ctx) return; for (const s of target.sounds) this.buffer(s).catch(() => {}); }
    play(target, sound) { return this.buffer(sound).then(buf => buf ? this.playBuffer(target, buf) : null); }
    playBuffer(target, buf) {
      const ctx = this.ctx();
      const src = ctx.createBufferSource(); src.buffer = buf;
      const gain = ctx.createGain(); const pan = ctx.createStereoPanner ? ctx.createStereoPanner() : null;
      src.connect(gain); if (pan) { gain.connect(pan); pan.connect(this.master); } else gain.connect(this.master);
      const node = { src, gain, pan, target };
      this.applyEffects(node);
      target.activeSounds.add(node);
      src.start();
      return new Promise(res => { src.onended = () => { target.activeSounds.delete(node); res(); }; });
    }
    applyEffects(node) {
      const t = node.target; node.gain.gain.value = clamp(t.volume, 0, 100) / 100;
      node.src.playbackRate.value = Math.pow(2, (t.soundEffects.PITCH || 0) / 120);
      if (node.pan) node.pan.pan.value = (t.soundEffects.PAN || 0) / 100;
    }
    updateVolume(target) { for (const n of target.activeSounds) this.applyEffects(n); }
    stopTarget(target) { for (const n of target.activeSounds) { try { n.src.stop(); } catch (e) {} } target.activeSounds.clear(); }
    stopAll() { for (const t of this.R.allTargets()) this.stopTarget(t); }
  }

  /* ============================ Pen layer ============================ */
  class PenLayer {
    constructor(R) { this.R = R; this.w = 1920; this.h = 1440; this.canvas = document.createElement('canvas'); this.canvas.width = this.w; this.canvas.height = this.h; this.ctx = this.canvas.getContext('2d'); this.used = false; }
    toPx(x, y) { return [this.w / 2 + x, this.h / 2 - y]; }
    clear() { this.ctx.clearRect(0, 0, this.w, this.h); this.used = false; }
    line(t, x0, y0, x1, y1) {
      const c = this.ctx; const [a, b] = this.toPx(x0, y0), [d, e] = this.toPx(x1, y1);
      c.save(); c.globalAlpha = t.pen.alpha; c.strokeStyle = t.pen.color; c.lineWidth = t.pen.size; c.lineCap = 'round'; c.lineJoin = 'round';
      c.beginPath(); c.moveTo(a, b); c.lineTo(d + (a === d && b === e ? 0.01 : 0), e); c.stroke(); c.restore(); this.used = true;
    }
    stamp(t) { const [px, py] = this.toPx(0, 0); this.R.drawSprite(this.ctx, t, (x, y) => [px + x, py - y], 1); this.used = true; }
  }

  /* ============================ Runtime ============================ */
  class SparkRuntime {
    constructor(canvas, opts = {}) {
      this.canvas = canvas; this.ctx = canvas.getContext('2d'); this.opts = opts; this.overlay = opts.overlay || null;
      this.editorMode = !!opts.editorMode;
      this.STOP = STOP; this.num = toNum; this.str = toStr; this.bool = toBool;
      this.stage = null; this.targets = []; this.threads = []; this.images = new Map();
      this.keys = new Set(); this.mouse = { x: 0, y: 0, down: false, clicked: false };
      this.time = 0; this.timeScale = 1; this.frame = 0; this.frameStart = 0; this.timerStart = 0; this.running = false; this.paused = false;
      this.answer = ''; this.counter = 0; this.tempo = 60; this.voice = 'normal';
      this.cam = { x: 0, y: 0, zoom: 1, follow: null, bounds: null, shakeAmt: 0, shakeUntil: 0, ox: 0, oy: 0, shakeFor: (amt, secs) => { this.cam.shakeAmt = amt; this.cam.shakeUntil = this.time + secs; } };
      this.particles = { list: [], burst: (preset, x, y, scale) => this.burstParticles(preset, x, y, scale) };
      this.audio = new AudioEngine(this); this.pen = new PenLayer(this); this.world = new World(this);
      this.monitors = []; this.flash = null; this.fadeOverlay = null; this.toastMsg = null; this.gameOver = null; this.dialog = null; this.labels = {}; this.cloudStatus = '';
      this.edgeState = new Map(); this.hatsFired = new Set();
      this.game = this.makeGame(); this.pad = this.makePad();
      this.listeners = {}; this.viewScale = 1; this.dpr = window.devicePixelRatio || 1;
      this.drag = null; this.snapshot = null; this.loudnessVal = -1;
      this.scratchCanvas = document.createElement('canvas'); this.scratchCanvas2 = document.createElement('canvas');
      this.bindInput();
      for (const p of SparkRuntime.plugins) if (p.init) p.init(this);
      this.lastTs = performance.now();
      requestAnimationFrame(ts => this.tick(ts));
    }
    on(ev, fn) { (this.listeners[ev] = this.listeners[ev] || []).push(fn); }
    onEvent(ev, ...args) { (this.listeners[ev] || []).forEach(f => f(...args)); }

    /* ---------- project ---------- */
    loadProject(p) {
      this.stopAll(true);
      this.projectName = p.name || 'Untitled'; this.cloudId = p.cloudId || null; this.cloudClose();
      this.stage = new Target(this, p.stage || { name: 'Stage', costumes: [{ name: 'backdrop1', src: Lib.svgToDataURL(Lib.backdropSVG('Blank')) }] }, true);
      this.targets = (p.sprites || []).map(s => new Target(this, s, false));
      this.monitors = (p.monitors || []).map(m => ({ ...m }));
      this.pen.clear(); this.world.clear(); this.resetGameState();
      for (const t of this.allTargets()) { for (const c of t.costumes) this.img(c); this.audio.preload(t); }
      this.onEvent('projectLoaded');
    }
    serialize() {
      return { name: this.projectName, version: 1, cloudId: this.cloudId || undefined, stage: this.stage.toJSON(), sprites: this.sprites().filter(s => !s.isClone).map(s => s.toJSON()), monitors: this.monitors.map(m => ({ ...m })) };
    }
    allTargets() { return this.stage ? [this.stage, ...this.targets] : []; }
    sprites() { return this.targets; }
    originals() { return this.targets.filter(t => !t.isClone); }
    findTarget(S, name) {
      if (name === '_myself_') return S;
      if (name === '_stage_' || name === 'Stage') return this.stage;
      return this.targets.find(t => !t.isClone && t.name === name) || null;
    }
    addSprite(data) { const t = new Target(this, data, false); this.targets.push(t); for (const c of t.costumes) this.img(c); this.onEvent('targetsChanged'); return t; }
    removeSprite(t) { this.stopTarget(t); this.targets = this.targets.filter(x => x !== t && !(x.isClone && x.original === t)); this.onEvent('targetsChanged'); }
    img(c) {
      if (!c || !c.src) return null;
      let im = this.images.get(c.src);
      if (!im) {
        im = new Image(); im.ready = false;
        im.onload = () => { im.ready = true; if (!c.w) { c.w = im.naturalWidth; c.h = im.naturalHeight; } };
        im.src = c.src; this.images.set(c.src, im);
      }
      if (im.ready && !c.w) { c.w = im.naturalWidth; c.h = im.naturalHeight; }
      return im;
    }

    /* ---------- threads & events ---------- */
    startScript(target, script, restart = true) {
      const existing = this.threads.find(t => t.target === target && t.script === script && !t.done);
      if (existing) { if (!restart) return existing; existing.stop(); }
      const th = new Thread(this, target, script).start();
      this.threads.push(th); this.running = true;
      return th;
    }
    startHats(filter, restart = true, targets) {
      const out = [];
      for (const t of targets || this.allTargets()) for (const s of t.scripts) if (filter(s, t)) out.push(this.startScript(t, s, restart));
      return out;
    }
    greenFlag() {
      this.audio.ctx();
      this.stopAll();
      this.resetGameState();
      this.snapshot = this.originals().map(t => ({ t, x: t.x, y: t.y, direction: t.direction, size: t.size, visible: t.visible, costume: t.currentCostume }));
      this.running = true; this.resetTimer();
      this.startHats(s => s.hat === 'flag');
      this.onEvent('runStateChanged', true);
    }
    restart() {
      if (this.snapshot) for (const s of this.snapshot) { if (this.targets.includes(s.t)) { s.t.x = s.x; s.t.y = s.y; s.t.direction = s.direction; s.t.size = s.size; s.t.visible = s.visible; s.t.currentCostume = s.costume; s.t.phys.vx = 0; s.t.phys.vy = 0; } }
      setTimeout(() => this.greenFlag(), 0);
    }
    resetGameState() {
      this.game.reset(); this.cam.x = 0; this.cam.y = 0; this.cam.zoom = 1; this.cam.follow = null; this.cam.bounds = null; this.cam.shakeAmt = 0;
      this.timeScale = 1; this.paused = false; this.particles.list.length = 0; this.flash = null; this.fadeOverlay = null; this.toastMsg = null; this.gameOver = null; this.edgeState.clear(); this.dialog = null; this.labels = {};
      for (const t of this.allTargets()) { t.textCostume = null; t.tint = null; t.trail = null; t.squashAmt = 0; }
      for (const p of SparkRuntime.plugins) if (p.reset) p.reset(this);
    }
    stopAll(silent) {
      for (const th of this.threads) th.stop();
      this.threads = []; this.running = false; this.paused = false;
      this.targets = this.targets.filter(t => !t.isClone);
      for (const t of this.allTargets()) { t.bubble = null; t.phys.vx = 0; t.phys.vy = 0; }
      this.audio.stopAll(); if (window.speechSynthesis) speechSynthesis.cancel();
      if (this.askUI) this.closeAsk();
      for (const p of SparkRuntime.plugins) if (p.stop) p.stop(this);
      if (!silent) { this.onEvent('runStateChanged', false); this.onEvent('targetsChanged'); }
    }
    stopOthers(S, T) { for (const th of this.threads) if (th.target === S && th !== T) th.stop(); }
    stopTarget(t) { for (const th of this.threads) if (th.target === t) th.stop(); this.audio.stopTarget(t); }
    broadcast(name) {
      const n = toStr(name).toLowerCase();
      return this.startHats(s => s.hat === 'broadcast' && s.name === n);
    }
    async broadcastAndWait(T, name) { const ths = this.broadcast(name); T.children = ths; while (ths.some(t => !t.done)) await T.yield(); }
    createClone(S, name) {
      const src = this.findTarget(S, name); if (!src || src.isStage) return null;
      if (this.targets.filter(t => t.isClone).length >= 300) return null;
      const c = Object.create(Target.prototype);
      Object.assign(c, src); c.id = uid(); c.isClone = true; c.original = src.isClone ? src.original : src;
      c.vars = { ...src.vars }; c.lists = Object.fromEntries(Object.entries(src.lists).map(([k, v]) => [k, v.slice()]));
      c.effects = { ...src.effects }; c.soundEffects = { ...src.soundEffects }; c.phys = { ...src.phys }; c.pen = { ...src.pen }; c.activeSounds = new Set(); c.bubble = null; c.tint = null;
      const i = this.targets.indexOf(src); this.targets.splice(i, 0, c);
      this.startHats(s => s.hat === 'clone', true, [c]);
      return c;
    }
    spawn(S, name, x, y) { const c = this.createClone(S, name); if (c) { c.x = x; c.y = y; c.visible = true; } return c; }
    deleteClone(S) { if (!S.isClone) return; this.stopTarget(S); this.targets = this.targets.filter(t => t !== S); }
    cloneCount(name) { const o = this.findTarget(null, name); return this.targets.filter(t => t.isClone && t.original === o).length; }
    async callProc(S, T, proccode, args) {
      const p = S.procs[proccode]; if (!p) return;
      const A = {}; p.argNames.forEach((n, i) => A[n] = args[i]);
      if (p.warp) { T.warp++; try { await p.fn(S, T, A); } finally { T.warp--; } } else await p.fn(S, T, A);
    }
    arg(A, name) { return A && name in A ? A[name] : 0; }
    setPaused(T, on) { this.paused = on; if (on) T.ignorePause = true; else for (const th of this.threads) th.ignorePause = false; }

    /* ---------- variables & lists ---------- */
    v(S, name) { if (S && name in S.vars) return S.vars[name]; return name in this.stage.vars ? this.stage.vars[name] : 0; }
    setV(S, name, val) { if (S && name in S.vars) S.vars[name] = val; else { this.stage.vars[name] = val; if (this.stage.cloudVars && this.stage.cloudVars[name]) this.cloudPush(name, val); } }
    changeV(S, name, d) { this.setV(S, name, toNum(this.v(S, name)) + d); }
    l(S, name) { if (S && name in S.lists) return S.lists[name]; if (!(name in this.stage.lists)) this.stage.lists[name] = []; return this.stage.lists[name]; }
    listIndex(list, idx, forInsert) {
      if (idx === 'last') return list.length - (forInsert ? 0 : 1);
      if (idx === 'random' || idx === 'any') return Math.floor(Math.random() * (list.length + (forInsert ? 1 : 0)));
      const n = Math.round(toNum(idx)) - 1; return n >= 0 && n < list.length + (forInsert ? 1 : 0) ? n : -1;
    }
    listItem(list, idx) { const i = this.listIndex(list, idx); return i >= 0 ? list[i] : ''; }
    listDelete(list, idx) { if (idx === 'all') { list.length = 0; return; } const i = this.listIndex(list, idx); if (i >= 0) list.splice(i, 1); }
    listInsert(list, idx, item) { const i = this.listIndex(list, idx, true); if (i >= 0) list.splice(i, 0, item); }
    listReplace(list, idx, item) { const i = this.listIndex(list, idx); if (i >= 0) list[i] = item; }
    listIndexOf(list, item) { const s = toStr(item).toLowerCase(); return list.findIndex(x => toStr(x).toLowerCase() === s) + 1; }
    listContains(list, item) { return this.listIndexOf(list, item) > 0; }
    listContents(list) { return list.every(x => toStr(x).length === 1) ? list.join('') : list.join(' '); }
    showMonitor(S, name, show, isList) {
      const targetName = S && !S.isStage && (name in (isList ? S.lists : S.vars)) ? S.name : null;
      let m = this.monitors.find(m => m.name === name && m.target === targetName && !!m.isList === !!isList);
      if (!m) { m = { target: targetName, name, isList: !!isList, visible: false, x: null, y: null }; this.monitors.push(m); }
      m.visible = show; this.onEvent('monitorsChanged');
    }

    /* ---------- operators ---------- */
    compare(a, b) {
      if (isNumeric(a) && isNumeric(b)) { const x = Number(a), y = Number(b); return x < y ? -1 : x > y ? 1 : 0; }
      const s1 = toStr(a).toLowerCase(), s2 = toStr(b).toLowerCase(); return s1 < s2 ? -1 : s1 > s2 ? 1 : 0;
    }
    div(a, b) { return b === 0 ? (a === 0 ? NaN : a > 0 ? Infinity : -Infinity) : a / b; }
    random(a, b) {
      const na = toNum(a), nb = toNum(b), lo = Math.min(na, nb), hi = Math.max(na, nb);
      const ints = Number.isInteger(na) && Number.isInteger(nb) && !(String(a).includes('.') || String(b).includes('.'));
      return ints ? lo + Math.floor(Math.random() * (hi - lo + 1)) : lo + Math.random() * (hi - lo);
    }
    mod(a, b) { const r = a % b; return r !== 0 && (r < 0) !== (b < 0) ? r + b : r; }
    letterOf(i, s) { return s.charAt(Math.round(i) - 1); }
    mathop(op, n) {
      switch (op) {
        case 'abs': return Math.abs(n); case 'floor': return Math.floor(n); case 'ceiling': return Math.ceil(n); case 'sqrt': return Math.sqrt(n);
        case 'sin': return Math.round(Math.sin(n * Math.PI / 180) * 1e10) / 1e10; case 'cos': return Math.round(Math.cos(n * Math.PI / 180) * 1e10) / 1e10;
        case 'tan': { const r = this.mod(n, 180); if (r === 90) return Infinity; if (r === -90) return -Infinity; return Math.round(Math.tan(n * Math.PI / 180) * 1e10) / 1e10; }
        case 'asin': return Math.asin(n) * 180 / Math.PI; case 'acos': return Math.acos(n) * 180 / Math.PI; case 'atan': return Math.atan(n) * 180 / Math.PI;
        case 'ln': return Math.log(n); case 'log': return Math.log10(n); case 'e ^': return Math.exp(n); case '10 ^': return Math.pow(10, n);
      }
      return 0;
    }

    /* ---------- sensing ---------- */
    keyPressed(k) {
      k = toStr(k); if (k === 'any') return this.keys.size > 0;
      if (k.length === 1) k = k.toLowerCase();
      return this.keys.has(k);
    }
    timer() { return Math.round((this.time - this.timerStart) * 1000) / 1000; }
    resetTimer() { this.timerStart = this.time; }
    loudness() { return this.loudnessVal; }
    daysSince2000() { return (Date.now() - Date.UTC(2000, 0, 1)) / 86400000; }
    current(u) { const d = new Date(); switch (u) { case 'YEAR': return d.getFullYear(); case 'MONTH': return d.getMonth() + 1; case 'DATE': return d.getDate(); case 'DAYOFWEEK': return d.getDay() + 1; case 'HOUR': return d.getHours(); case 'MINUTE': return d.getMinutes(); default: return d.getSeconds(); } }
    of(prop, name) {
      const t = this.findTarget(null, name); if (!t) return 0;
      switch (prop) {
        case 'x position': return t.x; case 'y position': return t.y; case 'direction': return t.direction; case 'costume #': case 'backdrop #': return t.currentCostume + 1;
        case 'costume name': case 'backdrop name': return t.costume ? t.costume.name : ''; case 'size': return t.size; case 'volume': return t.volume;
        default: return prop in t.vars ? t.vars[prop] : 0;
      }
    }
    pointFor(S, name) {
      if (name === '_mouse_') return { x: this.mouse.x, y: this.mouse.y };
      if (name === '_random_') { const v = this.viewRect(S && S.sticky); return { x: v.left + Math.random() * (v.right - v.left), y: v.bottom + Math.random() * (v.top - v.bottom) }; }
      const t = this.findTarget(S, name); return t && !t.isStage ? { x: t.x, y: t.y } : null;
    }
    fenceLikeScratch() { const c = this.cam; return !this.world.active && !c.follow && c.zoom === 1 && c.x === 0 && c.y === 0 && !c.bounds; }
    viewRect(sticky) {
      if (sticky) return { left: -W / 2, right: W / 2, top: H / 2, bottom: -H / 2 };
      const z = this.cam.zoom; return { left: this.cam.x - W / 2 / z, right: this.cam.x + W / 2 / z, top: this.cam.y + H / 2 / z, bottom: this.cam.y - H / 2 / z };
    }
    aabb(a, b) { return a.left < b.right && a.right > b.left && a.bottom < b.top && a.top > b.bottom; }
    touching(S, name) {
      if (!S.visible) return false;
      if (name === '_mouse_') return this.pixelAt(S, this.mouse.x, this.mouse.y);
      if (name === '_edge_') return S.touchingEdge('any');
      const b = S.bounds();
      const orig = this.findTarget(S, name); if (!orig) return false;
      for (const o of this.targets) {
        if (o === S || !o.visible) continue;
        if (o !== orig && o.original !== orig) continue;
        if (this.aabb(b, o.bounds()) && this.pixelOverlap(S, o)) return true;
      }
      return false;
    }
    // draw sprite into a small canvas covering a world rect; returns image data
    maskFor(t, rect, cw, ch) {
      const c = this.scratchCanvas; c.width = cw; c.height = ch; const ctx = c.getContext('2d'); ctx.clearRect(0, 0, cw, ch);
      const sx = cw / (rect.right - rect.left), sy = ch / (rect.top - rect.bottom);
      this.drawSprite(ctx, t, (x, y) => [(x - rect.left) * sx, (rect.top - y) * sy], sx, true);
      return ctx.getImageData(0, 0, cw, ch).data;
    }
    pixelOverlap(a, b) {
      const ba = a.bounds(), bb = b.bounds();
      const rect = { left: Math.max(ba.left, bb.left), right: Math.min(ba.right, bb.right), top: Math.min(ba.top, bb.top), bottom: Math.max(ba.bottom, bb.bottom) };
      const w = rect.right - rect.left, h = rect.top - rect.bottom; if (w <= 0 || h <= 0) return false;
      const scale = Math.min(1, 40 / Math.max(w, h)); const cw = Math.max(1, Math.ceil(w * scale)), ch = Math.max(1, Math.ceil(h * scale));
      const da = this.maskFor(a, rect, cw, ch);
      const c2 = this.scratchCanvas2; c2.width = cw; c2.height = ch; const ctx2 = c2.getContext('2d');
      const sx = cw / w, sy = ch / h; this.drawSprite(ctx2, b, (x, y) => [(x - rect.left) * sx, (rect.top - y) * sy], sx, true);
      const db = ctx2.getImageData(0, 0, cw, ch).data;
      for (let i = 3; i < da.length; i += 4) if (da[i] > 20 && db[i] > 20) return true;
      return false;
    }
    pixelAt(t, x, y) {
      const b = t.bounds(); if (x < b.left || x > b.right || y < b.bottom || y > b.top) return false;
      const c = this.scratchCanvas; c.width = 1; c.height = 1; const ctx = c.getContext('2d'); ctx.clearRect(0, 0, 1, 1);
      this.drawSprite(ctx, t, (px, py) => [px - x + 0.5, y - py + 0.5], 1, true);
      return ctx.getImageData(0, 0, 1, 1).data[3] > 20;
    }
    parseColor(c) {
      c = toStr(c); if (typeof c === 'string' && c[0] === '#') { const n = parseInt(c.length === 4 ? c.replace(/./g, (m, i) => i ? m + m : m) : c.slice(1), 16); return [(n >> 16) & 255, (n >> 8) & 255, n & 255]; }
      if (isNumeric(c)) { const n = Math.round(toNum(c)); return [(n >> 16) & 255, (n >> 8) & 255, n & 255]; }
      const m = String(c).match(/\d+/g); return m ? m.slice(0, 3).map(Number) : [0, 0, 0];
    }
    touchingColor(S, color, maskColor) {
      if (!S.visible) return false;
      const b = S.bounds(); const w = b.right - b.left, h = b.top - b.bottom; if (w <= 0 || h <= 0) return false;
      const scale = Math.min(1, 48 / Math.max(w, h)); const cw = Math.max(1, Math.ceil(w * scale)), ch = Math.max(1, Math.ceil(h * scale));
      const mask = this.maskFor(S, b, cw, ch);
      const c2 = this.scratchCanvas2; c2.width = cw; c2.height = ch; const ctx = c2.getContext('2d');
      const sx = cw / w, sy = ch / h; const map = (x, y) => [(x - b.left) * sx, (b.top - y) * sy];
      // backdrop (stage colour) + pen + other sprites
      ctx.clearRect(0, 0, cw, ch);
      const bd = this.stage.img(); if (bd && bd.ready) { const v = this.viewRect(S.sticky); const [x0, y0] = map(v.left, v.top), [x1, y1] = map(v.right, v.bottom); ctx.drawImage(bd, x0, y0, x1 - x0, y1 - y0); }
      if (this.pen.used) { const [x0, y0] = map(-this.pen.w / 2, this.pen.h / 2); ctx.drawImage(this.pen.canvas, x0, y0, this.pen.w * sx, this.pen.h * sy); }
      for (const o of this.targets) if (o !== S && o.visible && this.aabb(b, o.bounds())) this.drawSprite(ctx, o, map, sx, false);
      const data = ctx.getImageData(0, 0, cw, ch).data; const [r, g, bl] = this.parseColor(color);
      const mc = maskColor != null ? this.parseColor(maskColor) : null;
      let own = null; if (mc) { own = this.maskFor(S, b, cw, ch); }
      const near = (d, i, c) => Math.abs(d[i] - c[0]) < 24 && Math.abs(d[i + 1] - c[1]) < 24 && Math.abs(d[i + 2] - c[2]) < 32;
      for (let i = 0; i < data.length; i += 4) {
        if (mask[i + 3] < 20) continue;
        if (mc && !near(own, i, mc)) continue;
        if (data[i + 3] > 20 && near(data, i, [r, g, bl])) return true;
      }
      return false;
    }
    /* ---------- text engine ---------- */
    async dialogue(T, name, text) {
      const pages = this.paginate(toStr(text), 3, 54);
      for (const page of pages) {
        this.dialog = { name: toStr(name), text: page, shown: 0, done: false, start: this.time };
        this.dialogAdvance = false;
        while (!this.dialog.done) { await T.yield(); if (this.dialogAdvance) { this.dialog.shown = page.length; this.dialog.done = true; } }
        this.dialogAdvance = false;
        while (!this.dialogAdvance) await T.yield();
        this.dialogAdvance = false;
      }
      this.dialog = null;
    }
    paginate(text, lines, cols) {
      const words = text.split(/\s+/), rows = []; let cur = '';
      for (const w of words) { const t = cur ? cur + ' ' + w : w; if (t.length > cols && cur) { rows.push(cur); cur = w; } else cur = t; }
      if (cur) rows.push(cur);
      const pages = []; for (let i = 0; i < rows.length; i += lines) pages.push(rows.slice(i, i + lines).join('\n'));
      return pages.length ? pages : [''];
    }
    wantAdvance() { return this.keys.has('space') || this.keys.has('enter') || this.mouse.down || this.pad.button(1, 'A'); }
    label(pos, text) { if (text === null || toStr(text) === '') delete this.labels[pos]; else this.labels[pos] = toStr(text); }
    textOp(op, a, b, c) {
      a = toStr(a); b = toStr(b); c = toStr(c);
      switch (op) {
        case 'uppercase': return a.toUpperCase(); case 'lowercase': return a.toLowerCase(); case 'reversed': return [...a].reverse().join(''); case 'trimmed': return a.trim();
        case 'replace': return a.split(b).join(c);
        case 'split': { const parts = a.split(b === '' ? /\s+/ : b); const i = Math.round(toNum(c)) - 1; return parts[i] ?? ''; }
        case 'count': return b === '' ? 0 : a.split(b).length - 1;
        case 'repeat': return a.repeat(clamp(Math.round(toNum(b)), 0, 1000));
        case 'commas': { const n = toNum(a); return n.toLocaleString(); }
      }
      return a;
    }
    /* ---------- cloud variables ---------- */
    cloudEnsure() { if (!this.cloudId) { this.cloudId = uid() + uid(); this.onEvent('dirty'); } if (!this.cloudStream) this.cloudSetup(null, true); }
    cloudSetup(stage, force) {
      stage = stage || this.stage; if (!stage) return;
      const cv = Object.keys(stage.cloudVars || {});
      if (!cv.length && !force) { if (!this.cloudKeep) this.cloudClose(); return; }
      if (force) this.cloudKeep = true;
      if (!this.cloudId) { this.cloudId = uid() + uid(); this.onEvent('dirty'); }
      if (this.cloudStream) return;
      const base = window.SPARK_CLOUD_URL || '';
      fetch(`${base}/api/cloud/${this.cloudId}`).then(r => r.json()).then(vals => { for (const k in vals) if (k in stage.vars) stage.vars[k] = vals[k]; }).catch(() => {});
      try {
        const es = new EventSource(`${base}/api/cloud/${this.cloudId}/stream`); this.cloudStream = es;
        es.onmessage = e => { try { const m = JSON.parse(e.data); if (m.broadcast !== undefined) { if (this.running) this.broadcast(m.broadcast); } else if (m.leaderboard) this.leaderboard = m.leaderboard; else if (m.name in this.stage.vars) this.stage.vars[m.name] = m.value; } catch (err) {} };
        es.onerror = () => { this.cloudStatus = 'offline'; }; es.onopen = () => { this.cloudStatus = 'online'; };
      } catch (e) { this.cloudStatus = 'offline'; }
    }
    cloudClose() { if (this.cloudStream) { this.cloudStream.close(); this.cloudStream = null; } }
    cloudPush(name, value) {
      if (!this.cloudId) return; const base = window.SPARK_CLOUD_URL || '';
      this.cloudQueue = this.cloudQueue || {}; this.cloudQueue[name] = value;
      if (this.cloudTimer) return;
      this.cloudTimer = setTimeout(() => {
        this.cloudTimer = null; const q = this.cloudQueue; this.cloudQueue = {};
        fetch(`${base}/api/cloud/${this.cloudId}/set`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ vars: q }) }).catch(() => { this.cloudStatus = 'offline'; });
      }, 120);
    }
    /* ---------- world ---------- */
    generateWorld(type, w, h, seed) {
      this.world.generate(type, w, h, seed);
      this.cameraInsideWorld();
      // a side-view world turns on platformer physics for sprites that already use physics
      if (this.world.sideView) for (const t of this.targets) if (t.phys.mode === 'top-down') t.phys.mode = 'platformer';
    }
    cameraInsideWorld() { const W = this.world; if (!W.active) { this.cam.bounds = null; return; } this.cam.bounds = { x1: W.left(), x2: W.right(), y1: W.bottom(), y2: W.top() }; }
    worldInfo(which) {
      const W = this.world;
      switch (which) { case 'width': return W.w * W.size; case 'height': return W.h * W.size; case 'left': return W.left(); case 'right': return W.right(); case 'top': return W.top(); case 'bottom': return W.bottom(); case 'start x': return W.start.x; case 'start y': return W.start.y; case 'tile size': return W.size; default: return 0; }
    }
    statCheck(stat, op, v) { const s = this.game.get(stat); return op === '>' ? s > v : op === '<' ? s < v : s === v; }

    /* ---------- backdrops ---------- */
    setBackdrop(v) {
      const st = this.stage; if (!st.costumes.length) return [];
      if (v === 'random backdrop') { const L = st.costumes.length; let n = Math.floor(Math.random() * L); if (L > 1 && n === st.currentCostume) n = (n + 1) % L; st.currentCostume = n; }
      else if (v === 'next backdrop') st.nextCostume(); else if (v === 'previous backdrop') st.setCostume('previous costume'); else st.setCostume(v);
      const name = st.costume.name;
      return this.startHats(s => s.hat === 'backdrop' && s.name === name);
    }
    async setBackdropAndWait(T, v) { const ths = this.setBackdrop(v); while (ths.some(t => !t.done)) await T.yield(); }
    nextBackdrop() { this.setBackdrop('next backdrop'); }
    backdropNumberName(w) { return this.stage.costumeNumberName(w); }
    layerFrontBack(S, where) { if (S.isStage) return; this.targets = this.targets.filter(t => t !== S); if (where === 'front') this.targets.push(S); else this.targets.unshift(S); }
    layerMove(S, dir, n) { if (S.isStage) return; const i = this.targets.indexOf(S); this.targets.splice(i, 1); const j = clamp(i + (dir === 'forward' ? n : -n), 0, this.targets.length); this.targets.splice(j, 0, S); }

    /* ---------- ask / speech / save ---------- */
    ask(T, S, question) {
      return new Promise(resolve => {
        if (S && !S.isStage && S.visible) S.say(question, false); else this.toast(question, 9999);
        this.askResolve = ans => { this.answer = ans; if (S) { if (S.bubble && S.bubble.text === question) S.bubble = null; } if (this.toastMsg && this.toastMsg.text === question) this.toastMsg = null; resolve(); };
        this.openAsk();
        const check = async () => { while (this.askUI && !T.stopped) await T.yield(); if (T.stopped) this.closeAsk(); };
        check();
      });
    }
    openAsk() {
      if (!this.overlay) { const a = window.prompt('?') || ''; this.askResolve(a); return; }
      this.closeAsk();
      const bar = document.createElement('div'); bar.className = 'spark-ask';
      bar.innerHTML = '<input type="text" placeholder="Type your answer…" autocomplete="off"><button>✓</button>';
      const inp = bar.querySelector('input'), btn = bar.querySelector('button');
      const submit = () => { const v = inp.value; this.closeAsk(); this.askResolve && this.askResolve(v); };
      btn.onclick = submit; inp.onkeydown = e => { e.stopPropagation(); if (e.key === 'Enter') submit(); }; inp.onkeyup = e => e.stopPropagation();
      this.overlay.appendChild(bar); this.askUI = bar; setTimeout(() => inp.focus(), 0);
    }
    closeAsk() { if (this.askUI) { this.askUI.remove(); this.askUI = null; } }
    async speak(T, text) {
      if (!window.speechSynthesis) return;
      let done = false; const u = new SpeechSynthesisUtterance(toStr(text));
      const V = { normal: [1, 1], squeaky: [1.8, 1.2], deep: [0.5, 0.9], fast: [1, 1.8], slow: [1, 0.6], robot: [0.3, 1.1] }[this.voice] || [1, 1];
      u.pitch = V[0]; u.rate = V[1]; u.onend = u.onerror = () => done = true; speechSynthesis.speak(u);
      const t0 = this.time; while (!done && this.time - t0 < 30) await T.yield();
    }
    saveKey(k) { return 'spark:' + (this.projectName || 'project') + ':' + k; }
    save(k, v) { try { localStorage.setItem(this.saveKey(k), JSON.stringify(v)); } catch (e) {} }
    load(k) { try { const v = localStorage.getItem(this.saveKey(k)); return v === null ? 0 : JSON.parse(v); } catch (e) { return 0; } }
    toast(text, secs) { this.toastMsg = { text: toStr(text), until: this.time + Math.max(0.1, secs), start: this.time }; }
    screenFlash(color, secs) { this.flash = { color: toStr(color), until: this.time + Math.max(0.05, secs), dur: Math.max(0.05, secs) }; }
    async fade(T, mode, secs) {
      const out = mode.startsWith('out'); const color = mode.includes('white') ? '#ffffff' : '#000000';
      const t0 = this.time, dur = Math.max(0.01, secs);
      while (true) {
        const k = Math.min(1, (this.time - t0) / dur);
        this.fadeOverlay = { color, alpha: out ? k : 1 - k };
        if (k >= 1) break; await T.yield();
      }
      if (!out) this.fadeOverlay = null;
    }

    /* ---------- game stats ---------- */
    makeGame() {
      const R = this; const stats = {}, hud = {};
      return {
        reset() { Object.assign(stats, { score: 0, lives: 3, health: 100, coins: 0, level: 1 }); for (const k in hud) delete hud[k]; this.countdownEnd = null; this.countdownFired = false; },
        get(s) { return stats[s] ?? 0; },
        set(s, v) { stats[s] = v; if (s === 'health') stats.health = clamp(v, 0, 100); if (s === 'score') this.trackHigh(); },
        change(s, d) { this.set(s, (stats[s] ?? 0) + d); },
        hud(s, on) { hud[s] = on; },
        hudOn(s) { return !!hud[s]; }, hudAny() { return Object.values(hud).some(Boolean); },
        trackHigh() { const hs = R.load('_highscore'); if (toNum(hs) < stats.score) R.save('_highscore', stats.score); },
        highScore() { return toNum(R.load('_highscore')); },
        over(text, win) { R.gameOver = { text: toStr(text) || (win ? 'You Win!' : 'Game Over'), win }; R.stopAll(); R.gameOver.ready = true; R.startHats(s => s.hat === 'gameover'); },
        startCountdown(secs) { this.countdownEnd = R.time + Math.max(0, secs); this.countdownFired = false; },
        countdown() { return this.countdownEnd == null ? 0 : Math.max(0, Math.ceil((this.countdownEnd - R.time) * 10) / 10); },
        tick() { if (this.countdownEnd != null && !this.countdownFired && R.time >= this.countdownEnd) { this.countdownFired = true; R.startHats(s => s.hat === 'countdown'); } },
        stats
      };
    }
    /* ---------- gamepads ---------- */
    makePad() {
      const R = this; const prev = [];
      return {
        pads: [],
        poll() {
          this.pads = navigator.getGamepads ? Array.from(navigator.getGamepads()).filter(Boolean) : [];
          this.pads.forEach((gp, i) => {
            const was = prev[i] || []; const now = gp.buttons.map(b => b.pressed);
            now.forEach((p, bi) => { if (p && !was[bi]) { const name = Object.keys(PAD_BUTTONS).find(k => PAD_BUTTONS[k] === bi); if (name) R.startHats(s => s.hat === 'pad' && (s.button === name || s.button === 'any') && (s.player === 'any' || toNum(s.player) === i + 1), false); } });
            prev[i] = now;
          });
        },
        gp(p) { return this.pads[clamp(Math.round(toNum(p)) - 1, 0, 3)] || null; },
        connected(p) { return !!this.gp(p); },
        button(p, name) { const g = this.gp(p); if (!g) return false; if (name === 'any') return g.buttons.some(b => b.pressed); const i = PAD_BUTTONS[name]; return !!(g.buttons[i] && g.buttons[i].pressed); },
        stick(p, which, axis) { const g = this.gp(p); if (!g) return 0; const i = (which === 'right' ? 2 : 0) + (axis === 'y' ? 1 : 0); const v = g.axes[i] || 0; return Math.abs(v) < 0.12 ? 0 : Math.round(v * 100) / 100; },
        rumble(p, secs) { const g = this.gp(p); if (g && g.vibrationActuator) try { g.vibrationActuator.playEffect('dual-rumble', { duration: secs * 1000, strongMagnitude: 1, weakMagnitude: 0.6 }); } catch (e) {} }
      };
    }

    /* ---------- particles ---------- */
    burstParticles(preset, x, y, scale = 1) {
      const p = PARTICLE_PRESETS[preset] || PARTICLE_PRESETS.sparkles;
      for (let i = 0; i < Math.round(p.count * scale); i++) {
        const a = Math.random() * Math.PI * 2, sp = p.speed * (0.4 + Math.random() * 0.8) * scale;
        this.particles.list.push({ x, y, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp, life: p.life * (0.6 + Math.random() * 0.6), max: p.life, size: p.size * (0.6 + Math.random() * 0.8) * Math.max(0.5, scale), color: p.colors[Math.floor(Math.random() * p.colors.length)], shape: p.shape, g: p.gravity, fade: p.fade, rot: Math.random() * 6.28 });
      }
      if (this.particles.list.length > 1500) this.particles.list.splice(0, this.particles.list.length - 1500);
    }
    updateParticles(dt) {
      const L = this.particles.list;
      for (let i = L.length - 1; i >= 0; i--) {
        const p = L[i]; p.life -= dt; if (p.life <= 0) { L.splice(i, 1); continue; }
        p.x += p.vx * dt * 60; p.y += p.vy * dt * 60; p.vy -= p.g * dt * 60; p.vx *= 0.985; p.rot += dt * 3;
      }
      for (const t of this.targets) if (t.trail && t.visible && this.frame % 2 === 0) this.burstParticles(t.trail, t.x, t.y, 0.12);
    }

    /* ---------- input ---------- */
    bindInput() {
      const cv = this.canvas;
      const keyName = e => KEYMAP[e.key] || (e.key.length === 1 ? e.key.toLowerCase() : e.key.toLowerCase());
      window.addEventListener('keydown', e => {
        if (e.target && (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA' || e.target.isContentEditable)) return;
        const k = keyName(e);
        if (this.running && (k === 'space' || k.endsWith('arrow'))) e.preventDefault();
        // like Scratch, a held key keeps firing "when key pressed" (the hat only restarts once its script finished)
        this.keys.add(k); this.startHats(s => s.hat === 'key' && (s.key === k || s.key === 'any'), false);
      });
      window.addEventListener('keyup', e => { this.keys.delete(keyName(e)); });
      window.addEventListener('blur', () => this.keys.clear());
      const spos = e => { const r = cv.getBoundingClientRect(); this.canvasRect = r; return { x: (e.clientX - r.left) / r.width * W, y: (e.clientY - r.top) / r.height * H }; };
      const pos = e => { const s = spos(e); return this.screenToWorld(s.x, s.y); };
      cv.addEventListener('pointerdown', e => {
        this.audio.ctx(); cv.setPointerCapture(e.pointerId);
        const p = pos(e); this.mouse.x = p.x; this.mouse.y = p.y; this.mouse.down = true; this.mouse.clicked = true;
        if (this.gameOver && this.gameOver.ready) { this.gameOver = null; this.restart(); return; }
        // stage monitors: slider, drag (editor), double-click to change mode
        const sp = spos(e); const mon = this.monitorAt(sp.x, sp.y);
        if (mon) {
          const now = performance.now();
          if (mon._slider && sp.y >= mon._slider.y) { this.monDrag = { m: mon, slider: true }; this.setMonitorValue(mon, clamp((sp.x - mon._slider.x) / mon._slider.w, 0, 1)); return; }
          if (this.editorMode) {
            if (mon._lastClick && now - mon._lastClick < 350) { mon._lastClick = 0; this.cycleMonitorMode(mon); return; }
            mon._lastClick = now; this.monDrag = { m: mon, dx: sp.x - mon._rect.x, dy: sp.y - mon._rect.y, moved: false };
          }
          return;
        }
        const hit = this.spriteAt(p.x, p.y);
        this.drag = { target: hit, sx: p.x, sy: p.y, ox: hit ? hit.x : 0, oy: hit ? hit.y : 0, moved: false, time: performance.now() };
        if (hit && (this.editorMode || hit.draggable)) { /* dragging handled on move */ }
      });
      cv.addEventListener('pointermove', e => {
        const p = pos(e); this.mouse.x = p.x; this.mouse.y = p.y;
        if (this.monDrag) {
          const sp = spos(e), d = this.monDrag;
          if (d.slider) this.setMonitorValue(d.m, clamp((sp.x - d.m._slider.x) / d.m._slider.w, 0, 1));
          else { d.moved = true; d.m.x = clamp(Math.round(sp.x - d.dx), 0, W - d.m._rect.w); d.m.y = clamp(Math.round(sp.y - d.dy), 0, H - d.m._rect.h); }
          return;
        }
        if (this.drag && this.drag.target && (this.editorMode || this.drag.target.draggable)) {
          const dx = p.x - this.drag.sx, dy = p.y - this.drag.sy;
          if (Math.hypot(dx, dy) > 3) this.drag.moved = true;
          if (this.drag.moved) { const t = this.drag.target; t.goTo(this.drag.ox + dx, this.drag.oy + dy); this.onEvent('targetMoved', t); }
        }
      });
      const up = e => {
        this.mouse.down = false;
        if (this.monDrag) { if (this.monDrag.moved) this.onEvent('monitorsChanged'); this.monDrag = null; return; }
        if (this.drag) {
          const d = this.drag; this.drag = null;
          if (!d.moved) {
            if (d.target) this.startHats(s => s.hat === 'click', true, [d.target]);
            else this.startHats(s => s.hat === 'click', true, [this.stage]);
          } else if (d.target) this.onEvent('targetMoved', d.target, true);
        }
      };
      cv.addEventListener('pointerup', up); cv.addEventListener('pointercancel', up);
      cv.addEventListener('contextmenu', e => e.preventDefault());
    }
    screenToWorld(sx, sy) { const z = this.cam.zoom; return { x: this.cam.x + this.cam.ox + (sx - W / 2) / z, y: this.cam.y + this.cam.oy - (sy - H / 2) / z }; }
    spriteAt(x, y) {
      for (let i = this.targets.length - 1; i >= 0; i--) {
        const t = this.targets[i]; if (!t.visible) continue;
        let px = x, py = y;
        if (t.sticky) { const z = this.cam.zoom; px = (x - this.cam.x - this.cam.ox) * z; py = (y - this.cam.y - this.cam.oy) * z; }
        if (this.pixelAt(t, px, py)) return t;
      }
      return null;
    }

    /* ---------- physics ---------- */
    physicsStep() {
      const solids = this.targets.filter(t => t.phys.solid && t.visible);
      for (const t of this.targets) {
        const p = t.phys; if (p.mode === 'off' || !t.visible) continue;
        if (p.mode === 'platformer') p.vy -= p.gravity; else { p.vx *= p.friction; p.vy *= p.friction; if (Math.abs(p.vx) < 0.05) p.vx = 0; if (Math.abs(p.vy) < 0.05) p.vy = 0; }
        const sp = Math.hypot(p.vx, p.vy); if (sp > p.maxSpeed) { p.vx *= p.maxSpeed / sp; p.vy *= p.maxSpeed / sp; }
        const mine = solids.filter(s => s !== t && s.original !== t && t.original !== s);
        const rectsFor = b => mine.map(s => s.bounds()).concat(this.world.solidRects(b));
        // X axis
        if (p.vx) { t.goTo(t.x + p.vx, t.y); let b = t.bounds(); for (const o of rectsFor(b)) { if (this.aabb(b, o)) { if (p.vx > 0) t.x -= (b.right - o.left) + 0.01; else t.x += (o.right - b.left) + 0.01; p.vx = -p.vx * p.bounce; if (Math.abs(p.vx) < 0.5) p.vx = 0; b = t.bounds(); } } }
        // Y axis
        let landed = false;
        t.goTo(t.x, t.y + p.vy); let b = t.bounds();
        for (const o of rectsFor(b)) { if (this.aabb(b, o)) { if (p.vy <= 0) { t.y += (o.top - b.bottom) + 0.01; landed = true; } else t.y -= (b.top - o.bottom) + 0.01; p.vy = -p.vy * p.bounce; if (Math.abs(p.vy) < 1) p.vy = 0; b = t.bounds(); } }
        if (p.mode === 'platformer') { p.onGround = landed; if (landed) { p.vx *= p.friction; if (Math.abs(p.vx) < 0.05) p.vx = 0; } }
        else p.onGround = true;
      }
    }

    /* ---------- main loop ---------- */
    async tick(ts) {
      this.frameStart = performance.now();
      const dtReal = Math.min(0.1, (ts - this.lastTs) / 1000); this.lastTs = ts;
      const dt = this.paused ? 0 : dtReal * this.timeScale;
      this.time += dt; this.frame++;
      try {
        if (this.running) {
          this.pad.poll(); this.game.tick();
          // edge-triggered hats
          for (const t of this.allTargets()) for (const s of t.scripts) if (s.cond) {
            let v = false; try { v = s.hat === 'greater' ? (s.menu === 'TIMER' ? this.timer() > s.cond(t) : this.loudness() > s.cond(t)) : toBool(s.cond(t)); } catch (e) {}
            const key = s.id + '|' + t.id; const was = this.edgeState.get(key);
            if (v && !was) this.startScript(t, s, false);
            this.edgeState.set(key, v);
          }
          // wake threads
          for (const th of this.threads) if (!th.done && th.wakeFn && (!this.paused || th.ignorePause)) { const w = th.wakeFn; th.wakeFn = null; w(); }
          await null; await null;
          this.threads = this.threads.filter(t => !t.done);
          if (!this.paused) { this.physicsStep(); for (const p of SparkRuntime.plugins) if (p.tick) p.tick(this, dt); }
        }
        if (!this.paused || !this.running) {
          this.updateParticles(dt || dtReal * (this.running ? 0 : 1));
          this.updateCamera(dtReal);
          for (const t of this.targets) { if (t.tint && this.time > t.tint.until) t.tint = null; if (t.squashAmt) { t.squashAmt *= 0.85; if (Math.abs(t.squashAmt) < 0.005) t.squashAmt = 0; } }
          if (this.flash && this.time > this.flash.until) this.flash = null;
          if (this.toastMsg && this.time > this.toastMsg.until) this.toastMsg = null;
        }
        this.mouse.clicked = false;
        // idle in the editor: redraw at ~20fps so block dragging stays snappy
        const busy = this.running || this.drag || this.monDrag || this.particles.list.length || this.toastMsg || this.flash || this.dialog || this.gameOver;
        if (busy || this.frame % 3 === 0) this.render();
      } catch (e) { console.error(e); }
      requestAnimationFrame(t => this.tick(t));
    }
    updateCamera(dt) {
      const c = this.cam;
      if (c.follow && this.targets.includes(c.follow)) { c.x += (c.follow.x - c.x) * Math.min(1, dt * 8); c.y += (c.follow.y - c.y) * Math.min(1, dt * 8); }
      if (c.bounds) { const hw = W / 2 / c.zoom, hh = H / 2 / c.zoom; const { x1, x2, y1, y2 } = c.bounds; if (x2 - x1 >= hw * 2) c.x = clamp(c.x, x1 + hw, x2 - hw); else c.x = (x1 + x2) / 2; if (y2 - y1 >= hh * 2) c.y = clamp(c.y, y1 + hh, y2 - hh); else c.y = (y1 + y2) / 2; }
      if (this.time < c.shakeUntil) { c.ox = (Math.random() - 0.5) * 2 * c.shakeAmt; c.oy = (Math.random() - 0.5) * 2 * c.shakeAmt; } else { c.ox = 0; c.oy = 0; }
    }

    /* ---------- rendering ---------- */
    worldToScreen(sticky) {
      if (sticky) return (x, y) => [W / 2 + x, H / 2 - y];
      const z = this.cam.zoom, cx = this.cam.x + this.cam.ox, cy = this.cam.y + this.cam.oy;
      return (x, y) => [W / 2 + (x - cx) * z, H / 2 - (y - cy) * z];
    }
    // draws a sprite with ctx already in "stage pixel" space; map converts world coords -> ctx coords, zoom = extra scale
    drawSprite(ctx, t, map, zoom, plain) {
      const im = t.img(); if (!im || !im.ready) return;
      const { w, h, cx, cy } = t.costumeSize();
      const [sx, sy] = map(t.x, t.y);
      ctx.save();
      ctx.translate(sx, sy);
      const r = t.rotationRad(); if (r) ctx.rotate(r);
      let fx = t.flipX ? -1 : 1, fy = t.flipY ? -1 : 1;
      if (t.rotationStyle === 'left-right' && t.direction < 0) fx *= -1;
      ctx.scale(t.scaleX() * zoom * fx, t.scaleY() * zoom * fy);
      if (!plain) {
        const e = t.effects; const filters = [];
        if (e.BRIGHTNESS) filters.push(`brightness(${clamp(100 + e.BRIGHTNESS, 0, 200)}%)`);
        if (e.COLOR) filters.push(`hue-rotate(${(e.COLOR * 1.8) % 360}deg)`);
        if (filters.length) ctx.filter = filters.join(' ');
        ctx.globalAlpha = clamp(1 - e.GHOST / 100, 0, 1);
        if (t.shadow) { ctx.save(); ctx.globalAlpha *= 0.35; ctx.filter = 'brightness(0)'; ctx.drawImage(im, -cx + 5 / (t.scaleX() * zoom), -cy + 6 / (t.scaleY() * zoom), w, h); ctx.restore(); }
        if (t.glow) { ctx.shadowColor = t.glow.color; ctx.shadowBlur = t.glow.size; }
      }
      ctx.drawImage(im, -cx, -cy, w, h);
      if (!plain && t.tint) {
        const c = this.scratchCanvas2; c.width = w; c.height = h; const tc = c.getContext('2d'); tc.clearRect(0, 0, w, h); tc.drawImage(im, 0, 0, w, h); tc.globalCompositeOperation = 'source-atop'; tc.fillStyle = t.tint.color; tc.fillRect(0, 0, w, h);
        ctx.globalAlpha *= 0.7; ctx.drawImage(c, -cx, -cy, w, h);
      }
      ctx.restore();
    }
    render() {
      const cv = this.canvas, ctx = this.ctx;
      // the canvas size is cached (a getBoundingClientRect every frame forces layout and makes block dragging stutter)
      if (!this.canvasRect) { this.canvasRect = cv.getBoundingClientRect(); if (window.ResizeObserver && !this.resizeObs) { this.resizeObs = new ResizeObserver(() => { this.canvasRect = cv.getBoundingClientRect(); }); this.resizeObs.observe(cv); } }
      const rect = this.canvasRect; const pw = Math.max(1, Math.round(rect.width * this.dpr)), ph = Math.max(1, Math.round(rect.height * this.dpr));
      if (cv.width !== pw || cv.height !== ph) { cv.width = pw; cv.height = ph; }
      ctx.setTransform(pw / W, 0, 0, ph / H, 0, 0); this.viewScale = rect.width / W;
      ctx.clearRect(0, 0, W, H);
      // backdrop
      ctx.fillStyle = '#fff'; ctx.fillRect(0, 0, W, H);
      // the backdrop stays fixed to the screen (like a sky) while sprites scroll with the camera; optional parallax scroll
      const bd = this.stage && this.stage.img();
      if (bd && bd.ready) {
        const par = this.parallax || 0;
        if (!par) ctx.drawImage(bd, 0, 0, W, H);
        else { const ox = -((this.cam.x + this.cam.ox) * par) % W, oy = ((this.cam.y + this.cam.oy) * par) % H; for (let dx = -1; dx <= 1; dx++) for (let dy = -1; dy <= 1; dy++) ctx.drawImage(bd, ox + dx * W, oy + dy * H, W, H); }
      }
      // pen
      const map = this.worldToScreen(false);
      this.world.draw(ctx, map, this.cam.zoom);
      if (this.pen.used) { const [x0, y0] = map(-this.pen.w / 2, this.pen.h / 2); ctx.drawImage(this.pen.canvas, x0, y0, this.pen.w * this.cam.zoom, this.pen.h * this.cam.zoom); }
      // sprites
      const stickyMap = this.worldToScreen(true);
      for (const t of this.targets) if (t.visible && !t.sticky) this.drawSprite(ctx, t, map, this.cam.zoom, false);
      this.drawParticles(ctx, map);
      for (const p of SparkRuntime.plugins) if (p.drawWorld) p.drawWorld(this, ctx, map);
      for (const t of this.targets) if (t.visible && t.sticky) this.drawSprite(ctx, t, stickyMap, 1, false);
      for (const t of this.targets) if (t.bubble && t.visible) this.drawBubble(ctx, t, t.sticky ? stickyMap : map, t.sticky ? 1 : this.cam.zoom);
      if (this.stage && this.stage.bubble) this.drawBubble(ctx, this.stage, () => [W / 2, H - 40], 1, true);
      this.drawMonitors(ctx); this.drawHUD(ctx);
      if (this.flash) { const k = (this.flash.until - this.time) / this.flash.dur; ctx.globalAlpha = clamp(k, 0, 1) * 0.85; ctx.fillStyle = this.flash.color; ctx.fillRect(0, 0, W, H); ctx.globalAlpha = 1; }
      if (this.fadeOverlay) { ctx.globalAlpha = clamp(this.fadeOverlay.alpha, 0, 1); ctx.fillStyle = this.fadeOverlay.color; ctx.fillRect(0, 0, W, H); ctx.globalAlpha = 1; }
      this.drawLabels(ctx);
      for (const p of SparkRuntime.plugins) if (p.drawScreen) p.drawScreen(this, ctx);
      if (this.toastMsg) this.drawToast(ctx);
      if (this.dialog) this.drawDialog(ctx);
      if (this.gameOver) this.drawGameOver(ctx);
    }
    drawLabels(ctx) {
      ctx.font = 'bold 15px Helvetica, Arial, sans-serif'; ctx.textBaseline = 'top';
      for (const pos in this.labels) {
        const text = this.labels[pos]; const w = ctx.measureText(text).width + 16;
        const x = pos.endsWith('left') ? 8 : pos.endsWith('right') ? W - 8 - w : W / 2 - w / 2, y = pos.startsWith('top') ? (this.game.hudAny() ? 40 : 8) : H - 34;
        ctx.fillStyle = 'rgba(0,0,0,0.55)'; this.roundRect(ctx, x, y, w, 24, 12); ctx.fill(); ctx.fillStyle = '#fff'; ctx.fillText(text, x + 8, y + 5);
      }
    }
    drawDialog(ctx) {
      const d = this.dialog; const cps = 40;
      if (!d.done) { d.shown = Math.min(d.text.length, Math.floor((this.time - d.start) * cps)); if (d.shown >= d.text.length) d.done = true; }
      if (this.wantAdvance()) { if (!d.advArmed) { d.advArmed = true; this.dialogAdvance = true; } } else d.advArmed = false;
      const x = 12, y = H - 96, w = W - 24, h = 84;
      ctx.fillStyle = 'rgba(20,24,40,0.92)'; this.roundRect(ctx, x, y, w, h, 10); ctx.fill(); ctx.strokeStyle = '#fff'; ctx.lineWidth = 2; this.roundRect(ctx, x + 3, y + 3, w - 6, h - 6, 8); ctx.stroke();
      if (d.name) { ctx.font = 'bold 13px Helvetica, Arial, sans-serif'; ctx.textBaseline = 'middle'; const nw = ctx.measureText(d.name).width + 16; ctx.fillStyle = '#4C97FF'; this.roundRect(ctx, x + 10, y - 11, nw, 22, 11); ctx.fill(); ctx.fillStyle = '#fff'; ctx.textAlign = 'left'; ctx.fillText(d.name, x + 18, y); }
      ctx.font = '15px Helvetica, Arial, sans-serif'; ctx.textBaseline = 'top'; ctx.fillStyle = '#fff'; ctx.textAlign = 'left';
      d.text.slice(0, d.shown).split('\n').forEach((line, i) => ctx.fillText(line, x + 16, y + 16 + i * 20));
      if (d.done && Math.floor(this.time * 2) % 2 === 0) { ctx.fillStyle = '#fff'; ctx.beginPath(); ctx.moveTo(x + w - 24, y + h - 20); ctx.lineTo(x + w - 12, y + h - 20); ctx.lineTo(x + w - 18, y + h - 12); ctx.fill(); }
    }
    drawParticles(ctx, map) {
      const z = this.cam.zoom;
      for (const p of this.particles.list) {
        const [sx, sy] = map(p.x, p.y); const k = p.life / p.max; const s = p.size * z * (p.fade ? (0.5 + k) : 1);
        ctx.globalAlpha = p.fade ? k * 0.8 : Math.min(1, k * 2); ctx.fillStyle = p.color; ctx.strokeStyle = p.color;
        ctx.save(); ctx.translate(sx, sy); ctx.rotate(p.rot);
        switch (p.shape) {
          case 'square': ctx.fillRect(-s / 2, -s / 2, s, s); break;
          case 'ring': ctx.lineWidth = 1.5; ctx.beginPath(); ctx.arc(0, 0, s / 2, 0, 6.283); ctx.stroke(); break;
          case 'star': ctx.beginPath(); for (let i = 0; i < 10; i++) { const r = i % 2 ? s / 4 : s / 2, a = i * Math.PI / 5; ctx.lineTo(Math.cos(a) * r, Math.sin(a) * r); } ctx.closePath(); ctx.fill(); break;
          case 'heart': ctx.beginPath(); const h = s / 2; ctx.moveTo(0, h); ctx.bezierCurveTo(-h * 1.6, -h * 0.2, -h * 0.6, -h * 1.4, 0, -h * 0.4); ctx.bezierCurveTo(h * 0.6, -h * 1.4, h * 1.6, -h * 0.2, 0, h); ctx.fill(); break;
          default: ctx.beginPath(); ctx.arc(0, 0, s / 2, 0, 6.283); ctx.fill();
        }
        ctx.restore();
      }
      ctx.globalAlpha = 1;
    }
    drawBubble(ctx, t, map, zoom, isStage) {
      const b = t.bubble; ctx.font = 'bold 13px Helvetica, Arial, sans-serif';
      const words = b.text.split(/\s+/); const lines = []; let cur = '';
      for (const w of words) { const test = cur ? cur + ' ' + w : w; if (ctx.measureText(test).width > 150 && cur) { lines.push(cur); cur = w; } else cur = test; }
      if (cur) lines.push(cur);
      const tw = Math.min(170, Math.max(...lines.map(l => ctx.measureText(l).width)) + 20), th = lines.length * 16 + 14;
      let x, y;
      if (isStage) { [x, y] = map(); x -= tw / 2; y -= th; }
      else { const bo = t.bounds(); const [rx, ty] = map(bo.right, bo.top); x = clamp(rx - 10, 4, W - tw - 4); y = clamp(ty - th - 12, 4, H - th - 4); }
      ctx.fillStyle = '#fff'; ctx.strokeStyle = '#c6c6c6'; ctx.lineWidth = 1.5;
      this.roundRect(ctx, x, y, tw, th, 12); ctx.fill(); ctx.stroke();
      if (!isStage) {
        if (b.think) { ctx.beginPath(); ctx.arc(x + 14, y + th + 6, 4, 0, 6.283); ctx.fill(); ctx.stroke(); ctx.beginPath(); ctx.arc(x + 7, y + th + 13, 2.5, 0, 6.283); ctx.fill(); ctx.stroke(); }
        else { ctx.beginPath(); ctx.moveTo(x + 14, y + th - 1); ctx.lineTo(x + 10, y + th + 10); ctx.lineTo(x + 26, y + th - 1); ctx.fillStyle = '#fff'; ctx.fill(); ctx.beginPath(); ctx.moveTo(x + 14, y + th); ctx.lineTo(x + 10, y + th + 10); ctx.lineTo(x + 26, y + th); ctx.stroke(); }
      }
      ctx.fillStyle = '#575e75'; ctx.textAlign = 'center'; ctx.textBaseline = 'top';
      lines.forEach((l, i) => ctx.fillText(l, x + tw / 2, y + 8 + i * 16));
      ctx.textAlign = 'left';
    }
    roundRect(ctx, x, y, w, h, r) { ctx.beginPath(); ctx.moveTo(x + r, y); ctx.arcTo(x + w, y, x + w, y + h, r); ctx.arcTo(x + w, y + h, x, y + h, r); ctx.arcTo(x, y + h, x, y, r); ctx.arcTo(x, y, x + w, y, r); ctx.closePath(); }
    drawMonitors(ctx) {
      let autoY = 5;
      ctx.font = 'bold 11px Helvetica, Arial, sans-serif'; ctx.textBaseline = 'middle';
      for (const m of this.monitors) {
        if (!m.visible) { m._rect = null; continue; }
        const t = m.target ? this.findTarget(null, m.target) : this.stage; if (!t) continue;
        const label = (m.target ? m.target + ': ' : '') + m.name;
        const x = m.x ?? 5, y = m.y ?? autoY;
        if (!m.isList && m.mode === 'large') {
          const val = toStr(m.builtin ? this.builtinValue(m.name, t) : this.v(t, m.name)); ctx.font = 'bold 15px Helvetica, Arial, sans-serif'; const w = Math.max(44, ctx.measureText(val).width + 16), h = 26;
          ctx.fillStyle = m.color || '#FF8C1A'; this.roundRect(ctx, x, y, w, h, 4); ctx.fill(); ctx.fillStyle = '#fff'; ctx.textAlign = 'center'; ctx.fillText(val, x + w / 2, y + h / 2); ctx.textAlign = 'left'; ctx.font = 'bold 11px Helvetica, Arial, sans-serif';
          m._rect = { x, y, w, h }; if (m.y == null) autoY += h + 5; continue;
        }
        if (m.isList) {
          const list = this.l(t, m.name); const w = 110, h = 140;
          ctx.fillStyle = '#e6e8ee'; ctx.strokeStyle = '#c2c6d5'; this.roundRect(ctx, x, y, w, h, 4); ctx.fill(); ctx.stroke();
          ctx.fillStyle = '#575e75'; ctx.textAlign = 'center'; ctx.fillText(label, x + w / 2, y + 10);
          ctx.textAlign = 'left'; ctx.font = '10px Helvetica, Arial, sans-serif';
          const rows = Math.min(list.length, 6);
          for (let i = 0; i < rows; i++) { ctx.fillStyle = '#575e75'; ctx.fillText(String(i + 1), x + 4, y + 30 + i * 18); ctx.fillStyle = m.color || '#FF661A'; this.roundRect(ctx, x + 16, y + 22 + i * 18, w - 20, 16, 3); ctx.fill(); ctx.fillStyle = '#fff'; ctx.fillText(toStr(list[i]).slice(0, 14), x + 20, y + 30 + i * 18); }
          ctx.font = 'bold 11px Helvetica, Arial, sans-serif'; ctx.fillStyle = '#575e75'; ctx.textAlign = 'center'; ctx.fillText('length ' + list.length, x + w / 2, y + h - 9); ctx.textAlign = 'left';
          m._rect = { x, y, w, h }; if (m.y == null) autoY += h + 5;
        } else {
          const val = toStr(m.builtin ? this.builtinValue(m.name, t) : this.v(t, m.name)); const lw = ctx.measureText(label).width; const vw = Math.max(36, ctx.measureText(val).width + 12); const slider = m.mode === 'slider' && !m.builtin; const w = Math.max(lw + vw + 16, slider ? 110 : 0), h = slider ? 40 : 22;
          ctx.fillStyle = '#e6f0ff'; ctx.strokeStyle = '#c2d3f0'; this.roundRect(ctx, x, y, w, h, 4); ctx.fill(); ctx.stroke();
          ctx.fillStyle = '#575e75'; ctx.fillText(label, x + 6, y + 11);
          ctx.fillStyle = m.color || '#FF8C1A'; this.roundRect(ctx, x + lw + 11, y + 3, vw, 16, 4); ctx.fill();
          ctx.fillStyle = '#fff'; ctx.textAlign = 'center'; ctx.fillText(val, x + lw + 11 + vw / 2, y + 11); ctx.textAlign = 'left';
          if (slider) {
            const min = m.min ?? 0, max = m.max ?? 100; const k = clamp((toNum(val) - min) / ((max - min) || 1), 0, 1);
            ctx.fillStyle = '#b9c7e0'; this.roundRect(ctx, x + 8, y + 29, w - 16, 4, 2); ctx.fill();
            ctx.fillStyle = '#4C97FF'; ctx.beginPath(); ctx.arc(x + 8 + k * (w - 16), y + 31, 6, 0, 6.283); ctx.fill();
            m._slider = { x: x + 8, w: w - 16, y: y + 24, h: 16, min, max };
          } else m._slider = null;
          m._rect = { x, y, w, h }; if (m.y == null) autoY += h + 5;
        }
      }
    }
    monitorAt(sx, sy) { for (let i = this.monitors.length - 1; i >= 0; i--) { const r = this.monitors[i]._rect; if (r && sx >= r.x && sx <= r.x + r.w && sy >= r.y && sy <= r.y + r.h) return this.monitors[i]; } return null; }
    cycleMonitorMode(m) { if (m.isList) return; m.mode = m.mode === 'large' ? (m.builtin ? 'normal' : 'slider') : m.mode === 'slider' ? 'normal' : 'large'; this.onEvent('monitorsChanged'); }
    setMonitorValue(m, k) { const t = m.target ? this.findTarget(null, m.target) : this.stage; const s = m._slider; let v = s.min + k * (s.max - s.min); if (Number.isInteger(s.min) && Number.isInteger(s.max)) v = Math.round(v); this.setV(t, m.name, Math.round(v * 100) / 100); }
    builtinValue(name, t) {
      switch (name) {
        case 'timer': return this.timer(); case 'answer': return this.answer; case 'mouse x': return Math.round(this.mouse.x); case 'mouse y': return Math.round(this.mouse.y); case 'loudness': return this.loudness();
        case 'score': case 'lives': case 'health': case 'coins': case 'level': return this.game.get(name);
        case 'x position': return Math.round(t.x); case 'y position': return Math.round(t.y); case 'direction': return Math.round(t.direction);
        default: return this.of(name, t.isStage ? '_stage_' : t.name);
      }
    }
    drawHUD(ctx) {
      const g = this.game; if (!g.hudAny()) return;
      ctx.font = 'bold 16px Helvetica, Arial, sans-serif'; ctx.textBaseline = 'top';
      const pill = (text, x, y, align) => { const w = ctx.measureText(text).width + 18; const px = align === 'right' ? x - w : align === 'center' ? x - w / 2 : x; ctx.fillStyle = 'rgba(0,0,0,0.55)'; this.roundRect(ctx, px, y, w, 26, 13); ctx.fill(); ctx.fillStyle = '#fff'; ctx.fillText(text, px + 9, y + 5); return 30; };
      let ly = 8, ry = 8;
      if (g.hudOn('score')) ly += pill('Score ' + toStr(g.get('score')), 8, ly, 'left');
      if (g.hudOn('coins')) ly += pill('🪙 ' + toStr(g.get('coins')), 8, ly, 'left');
      if (g.hudOn('level')) ly += pill('Level ' + toStr(g.get('level')), 8, ly, 'left');
      if (g.hudOn('lives')) { const n = clamp(Math.round(g.get('lives')), 0, 10); ry += pill(n > 0 ? '❤'.repeat(n) : '💔', W - 8, ry, 'right'); }
      if (g.hudOn('health')) { const h = clamp(g.get('health'), 0, 100); const x = W - 8 - 120, y = ry; ctx.fillStyle = 'rgba(0,0,0,0.55)'; this.roundRect(ctx, x, y, 120, 16, 8); ctx.fill(); ctx.fillStyle = h > 50 ? '#4caf50' : h > 25 ? '#ff9800' : '#f44336'; if (h > 0) { this.roundRect(ctx, x + 3, y + 3, 114 * h / 100, 10, 5); ctx.fill(); } ry += 22; }
      if (g.hudOn('timer')) { const cd = g.countdownEnd != null ? g.countdown() : null; const txt = cd != null ? '⏱ ' + (cd % 1 === 0 ? cd : cd.toFixed(1)) : '⏱ ' + Math.floor(this.timer()); pill(txt, W / 2, 8, 'center'); }
      if (g.hudOn('highscore')) pill('Best ' + toStr(g.highScore()), W / 2, g.hudOn('timer') ? 38 : 8, 'center');
    }
    drawToast(ctx) {
      const m = this.toastMsg; const age = this.time - m.start, left = m.until - this.time; const a = clamp(Math.min(age * 4, left * 4), 0, 1);
      ctx.globalAlpha = a; ctx.font = 'bold 15px Helvetica, Arial, sans-serif'; ctx.textBaseline = 'middle'; const w = Math.min(W - 20, ctx.measureText(m.text).width + 28);
      ctx.fillStyle = 'rgba(30,30,40,0.85)'; this.roundRect(ctx, W / 2 - w / 2, H - 50, w, 32, 16); ctx.fill(); ctx.fillStyle = '#fff'; ctx.textAlign = 'center'; ctx.fillText(m.text, W / 2, H - 34, w - 20); ctx.textAlign = 'left'; ctx.globalAlpha = 1;
    }
    drawGameOver(ctx) {
      const g = this.gameOver; ctx.fillStyle = 'rgba(0,0,0,0.6)'; ctx.fillRect(0, 0, W, H);
      ctx.fillStyle = g.win ? '#ffd740' : '#fff'; ctx.font = 'bold 40px Helvetica, Arial, sans-serif'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      ctx.fillText(g.text, W / 2, H / 2 - 20, W - 40);
      ctx.font = 'bold 16px Helvetica, Arial, sans-serif'; ctx.fillStyle = '#fff'; ctx.fillText('Score ' + toStr(this.game.get('score')) + (this.game.highScore() ? '   •   Best ' + toStr(this.game.highScore()) : ''), W / 2, H / 2 + 24);
      ctx.fillStyle = '#4C97FF'; this.roundRect(ctx, W / 2 - 80, H / 2 + 50, 160, 40, 20); ctx.fill(); ctx.fillStyle = '#fff'; ctx.fillText('▶ Play again', W / 2, H / 2 + 70); ctx.textAlign = 'left';
    }
  }

  SparkRuntime.W = W; SparkRuntime.H = H; SparkRuntime.PARTICLE_PRESETS = PARTICLE_PRESETS; SparkRuntime.TILE_NAMES = TILE_NAMES; SparkRuntime.TILE_INDEX = TILE_INDEX; SparkRuntime.tileSVG = tileSVG;
  SparkRuntime.Target = Target; SparkRuntime.Thread = Thread; SparkRuntime.World = World; SparkRuntime.util = { toNum, toStr, toBool, clamp, uid, isNumeric, rng, STOP };
  SparkRuntime.plugins = []; // features.js registers { init(R), tick(R, dt), reset(R), stop(R), drawWorld(R, ctx, map), drawScreen(R, ctx) }
  window.SparkRuntime = SparkRuntime;
})();
