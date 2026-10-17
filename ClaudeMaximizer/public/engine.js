// Claude Maximizer engine — a small 2D game engine where every sprite is a named, clickable thing.
// Games are plain scripts that call CM.sprite / CM.entity / CM.scene. Everything registered here knows
// which file and line defined it, so playtest notes can point Claude straight at the code.
(function () {
  'use strict';
  const CM = window.CM; // made in common.js
  const srcOf = CM.srcOf, safe = CM.safe, reportError = CM.reportError, emit = CM.emit, logBuf = CM.logs, errSeen = CM._errSeen, input = CM.input;

  // ---------- registries ----------
  const sprites = {}, entityDefs = {}, scenes = {};
  CM.defs = { sprites, entities: entityDefs, scenes };

  // ---------- sprites ----------
  // Letters from CM.PALETTE work in any sprite without declaring a palette. '.' and ' ' are transparent.
  // CM.sprite('bat', ['..KK..', '.KKKK.'], { K: '#223' })  or  CM.sprite('bat', { frames: [rows, rows], fps: 6, palette })
  CM.sprite = function (name, rowsOrDef, palette) {
    let def = Array.isArray(rowsOrDef) ? { frames: [rowsOrDef], palette } : { ...rowsOrDef };
    if (def.rows && !def.frames) def.frames = [def.rows];
    def.frames = (def.frames || []).map(f => (typeof f === 'string' ? f.split('\n') : f).filter(r => r.length));
    def.palette = { ...CM.PALETTE, ...(def.palette || palette || {}) };
    def.fps = def.fps || 8; def.name = name; def.src = srcOf();
    def.w = Math.max(1, ...def.frames.map(f => Math.max(...f.map(r => r.length))));
    def.h = Math.max(1, ...def.frames.map(f => f.length));
    def.canvases = def.frames.map(rows => {
      const c = document.createElement('canvas'); c.width = def.w; c.height = def.h;
      const ctx = c.getContext('2d');
      rows.forEach((row, y) => { for (let x = 0; x < row.length; x++) { const ch = row[x]; if (ch === '.' || ch === ' ') continue; ctx.fillStyle = def.palette[ch] || '#f0f'; ctx.fillRect(x, y, 1, 1); } });
      return c;
    });
    sprites[name] = def; return def;
  };

  // ---------- entities ----------
  let nextId = {};
  // CM.entity('bat', { sprite: 'bat', tags: ['enemy'], props: { speed: 60 }, gravity: false, solid: false, update(e, dt) {}, hit: { player(e, o) {} } })
  CM.entity = function (type, def) {
    def = { ...def }; def.type = type; def.src = srcOf(); def.props = def.props || {}; def.tags = def.tags || [];
    def.layer = def.layer || 0; entityDefs[type] = def; return def;
  };

  class Entity {
    constructor(scene, type, x, y, over) {
      const def = entityDefs[type]; if (!def) throw new Error(`No entity type "${type}". Define it with CM.entity('${type}', {...}).`);
      over = over || {};
      nextId[type] = (nextId[type] || 0) + 1;
      this.id = type + '#' + nextId[type]; this.type = type; this.def = def; this.scene = scene;
      this.name = over.name || null;
      this.x = x || 0; this.y = y || 0; this.vx = 0; this.vy = 0;
      this.sprite = over.sprite || def.sprite || null;
      const sp = this.sprite && sprites[this.sprite];
      this.scale = over.scale || def.scale || 1;
      this.w = over.w || def.w || (sp ? sp.w * this.scale : 8); this.h = over.h || def.h || (sp ? sp.h * this.scale : 8);
      this.shape = def.shape || (sp ? 'sprite' : 'rect'); this.color = over.color || def.color || '#f0f';
      this.flip = false; this.alpha = 1; this.visible = true; this.alive = true; this.layer = over.layer != null ? over.layer : def.layer;
      this.tags = new Set([...(def.tags || []), ...(over.tags || [])]);
      this.props = { ...def.props, ...(over.props || {}) };
      for (const k of Object.keys(over)) if (!(k in this) && k !== 'props' && k !== 'tags') this.props[k] = over[k]; // spawn(type, x, y, { hp: 3 }) is a prop
      this.frame = 0; this.animT = 0; this.fps = over.fps || null; this.grounded = false; this.onWall = 0;
      this.solid = !!def.solid; this.gravity = def.gravity != null ? !!def.gravity : scene.gravityDefault;
      this.bounce = def.bounce || 0; this.friction = def.friction != null ? def.friction : (this.gravity ? 0 : 0);
      this.timers = {}; this.age = 0; this.bubble = null; this.flashT = 0; this.error = null; this.text = over.text || def.text || null;
      this.angle = over.angle || 0; // radians; non-zero draws the sprite rotated (top-down games)
    }
    // top-down helpers: aim and move by angle, chase things, fire projectiles
    moveToward(o, speed) { const tx = o.cx != null ? o.cx : o.x, ty = o.cy != null ? o.cy : o.y; const dx = tx - this.cx, dy = ty - this.cy, l = Math.hypot(dx, dy) || 1; this.vx = dx / l * speed; this.vy = dy / l * speed; this.face(dx, dy); }
    face(dx, dy) { if (dx || dy) { this.angle = Math.atan2(dy, dx); if (dx) this.flip = dx < 0; } }
    forward() { return { x: Math.cos(this.angle), y: Math.sin(this.angle) }; }
    angleTo(o) { return Math.atan2((o.cy != null ? o.cy : o.y) - this.cy, (o.cx != null ? o.cx : o.x) - this.cx); }
    // e.shoot('arrow', { speed: 220, angle, at: target, spread: 0.1 }) → spawns it at this thing's center, moving that way
    shoot(type, o) { o = o || {}; const a = o.at ? this.angleTo(o.at) : (o.angle != null ? o.angle : this.angle) + (o.spread ? (Math.random() - 0.5) * o.spread : 0); const p = this.scene.spawn(type, 0, 0, o.over); p.cx = this.cx + Math.cos(a) * (o.offset || 0); p.cy = this.cy + Math.sin(a) * (o.offset || 0); const sp = o.speed || 200; p.vx = Math.cos(a) * sp; p.vy = Math.sin(a) * sp; p.angle = a; p.owner = this; return p; }
    tween(props, secs, o) { return CM.tween(this, props, secs, o); }
    damage(n, by) { const hp = this.props.hp; if (hp == null) { this.destroy(); return true; } this.props.hp = hp - (n == null ? 1 : n); this.flash(0.12); if (this.props.hp <= 0) { this.destroy(); if (this.def.onDie) safe(() => this.def.onDie(this, this.scene, by), 'onDie ' + this.type, this); return true; } return false; }
    has(tag) { return this.tags.has(tag) || this.type === tag; }
    get cx() { return this.x + this.w / 2; } get cy() { return this.y + this.h / 2; }
    set cx(v) { this.x = v - this.w / 2; } set cy(v) { this.y = v - this.h / 2; }
    get left() { return this.x; } get right() { return this.x + this.w; } get top() { return this.y; } get bottom() { return this.y + this.h; }
    destroy() { this.alive = false; }
    overlaps(o) { return this.x < o.x + o.w && this.x + this.w > o.x && this.y < o.y + o.h && this.y + this.h > o.y; }
    dist(o) { return Math.hypot(this.cx - (o.cx != null ? o.cx : o.x), this.cy - (o.cy != null ? o.cy : o.y)); }
    say(text, secs) { this.bubble = { text: String(text), until: this.scene.time + (secs || 2) }; }
    flash(secs) { this.flashT = secs || 0.15; }
    every(secs, key) { key = key || 'every'; const t = this.timers; if (t[key] == null) t[key] = 0; t[key] += CM.dt; if (t[key] >= secs) { t[key] -= secs; return true; } return false; }
    after(secs, key) { key = key || 'after'; const t = this.timers; if (t[key] == null) t[key] = 0; if (t[key] === -1) return false; t[key] += CM.dt; if (t[key] >= secs) { t[key] = -1; return true; } return false; }
    jump(v) { this.vy = -(v || this.props.jump || 300); this.grounded = false; }
    summary() { // what a note captures about this thing
      const o = {}; for (const k of Object.keys(this.props)) o[k] = this.props[k];
      return { id: this.id, type: this.type, name: this.name, src: this.def.src, sprite: this.sprite, tags: [...this.tags], x: r1(this.x), y: r1(this.y), w: this.w, h: this.h, vx: r1(this.vx), vy: r1(this.vy), grounded: this.grounded, flip: this.flip, angle: r1(this.angle), scale: this.scale, layer: this.layer, props: o, error: this.error };
    }
  }
  const r1 = v => Math.round(v * 10) / 10;

  // ---------- scenes ----------
  // CM.scene('level1', { setup(s) {}, update(s, dt) {}, draw(s, ctx) {}, ui(s, ctx) {} })
  CM.scene = function (name, def) { def = { ...def }; def.name = name; def.src = srcOf(); scenes[name] = def; return def; };

  class Scene {
    constructor(name) {
      const def = scenes[name]; if (!def) throw new Error(`No scene "${name}". Define it with CM.scene('${name}', {...}).`);
      this.name = name; this.def = def; this.entities = []; this.time = 0; this.gravity = def.gravity != null ? def.gravity : 900;
      this.gravityDefault = def.gravityDefault != null ? !!def.gravityDefault : false;
      this.tilemap = null; this.tilemaps = []; this.bg = def.bg || '#1b2030'; this.bounds = null; this.data = {}; this.ended = false; this.timersList = [];
      this.camera = { x: 0, y: 0, zoom: 1, target: null, lerp: 0.12, shakeT: 0, shakeA: 0, sx: 0, sy: 0, bounds: null,
        follow: (e, opts) => { this.camera.target = e; Object.assign(this.camera, opts || {}); },
        shake: (amount, secs) => { this.camera.shakeA = amount || 4; this.camera.shakeT = secs || 0.2; },
        look: (x, y) => { this.camera.target = null; this.camera.x = x - CM.W / 2; this.camera.y = y - CM.H / 2; } };
    }
    spawn(type, x, y, over) { const e = new Entity(this, type, x, y, over); this.entities.push(e); if (e.def.init) safe(() => e.def.init(e, this), 'init ' + e.type, e); return e; }
    find(tag) { return this.entities.find(e => e.alive && e.has(tag)) || null; }
    all(tag) { return this.entities.filter(e => e.alive && (!tag || e.has(tag))); }
    each(tag, fn) { this.all(tag).forEach(fn); }
    count(tag) { return this.all(tag).length; }
    byId(id) { return this.entities.find(e => e.id === id) || null; }
    go(name, o) { CM.go(name, o); }
    restart(o) { CM.go(this.name, o); }
    after(secs, fn) { this.timersList.push({ t: secs, fn, every: false }); }   // s.after(2, () => ...)
    every(secs, fn) { this.timersList.push({ t: secs, fn, every: secs }); }   // s.every(3, () => spawn...)
    // ASCII level: s.tiles(['####', '#..#'], { size: 16, legend: { '#': { solid: true, color: '#555' }, 'c': { spawn: 'coin' } } })
    tiles(rows, opts) {
      opts = opts || {}; rows = (typeof rows === 'string' ? rows.split('\n') : rows).filter(r => r.length);
      const size = opts.size || 16, legend = opts.legend || {}, w = Math.max(...rows.map(r => r.length)), h = rows.length;
      const grid = rows.map(r => r.padEnd(w, ' ').split(''));
      const tm = { size, w, h, grid, legend, src: srcOf(), original: rows.slice(), layer: opts.layer || 0, over: !!opts.over, name: opts.name || ('layer' + this.tilemaps.length), spawns: {} };
      this.tilemaps.push(tm); if (!this.tilemap || opts.main) this.tilemap = tm;
      if (!this.bounds || opts.main) this.bounds = { x: 0, y: 0, w: w * size, h: h * size };
      for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
        const ch = grid[y][x], L = legend[ch]; if (!L || !L.spawn) continue;
        const e = this.spawnInCell(tm, x, y, ch);
        if (L.keep !== true) grid[y][x] = L.under || '.'; // spawned things leave the cell empty unless told to keep it
      }
      return tm;
    }
    // used by tiles() and by the level painter: spawn the legend's entity sitting on the floor of that cell
    spawnInCell(tm, x, y, ch) { const L = tm.legend[ch]; const e = this.spawn(L.spawn, x * tm.size, y * tm.size, L.props ? { props: L.props } : undefined); e.y = (y + 1) * tm.size - e.h; e.x = x * tm.size + (tm.size - e.w) / 2; e.spawnCell = { tx: x, ty: y, ch, tm: tm.name }; tm.spawns[x + ',' + y] = ch; return e; }
    // the level as text again, spawn letters included, for saving back into the file
    tileRows(tm) { tm = tm || this.tilemap; if (!tm) return []; return tm.grid.map((row, y) => row.map((ch, x) => tm.spawns[x + ',' + y] || ch).join('')); }
    tileAt(wx, wy, tm) { tm = tm || this.tilemap; if (!tm) return null; const x = Math.floor(wx / tm.size), y = Math.floor(wy / tm.size); if (x < 0 || y < 0 || x >= tm.w || y >= tm.h) return null; const ch = tm.grid[y][x]; return tm.legend[ch] ? { ...tm.legend[ch], ch, tx: x, ty: y } : null; }
    setTile(tx, ty, ch, tm) { tm = tm || this.tilemap; if (tm && ty >= 0 && ty < tm.h && tx >= 0 && tx < tm.w) tm.grid[ty][tx] = ch; }
    solidAt(wx, wy) { for (const tm of this.tilemaps) { const t = this.tileAt(wx, wy, tm); if (t && t.solid) return true; } return false; }
    lineClear(x0, y0, x1, y1) { const n = Math.ceil(Math.hypot(x1 - x0, y1 - y0) / 4); for (let i = 0; i <= n; i++) if (this.solidAt(x0 + (x1 - x0) * i / n, y0 + (y1 - y0) * i / n)) return false; return true; } // can A see B through the walls?
  }

  // ---------- drawing helpers (screen or world space depending on where you call them) ----------
  CM.draw = {
    text(ctx, str, x, y, o) { o = o || {}; ctx.save(); ctx.font = `${o.bold ? 'bold ' : ''}${o.size || 8}px ${o.font || '"Press Start 2P", monospace'}`; ctx.textAlign = o.align || 'left'; ctx.textBaseline = o.baseline || 'top'; if (o.shadow !== false) { ctx.fillStyle = o.shadow || 'rgba(0,0,0,.6)'; ctx.fillText(str, x + 1, y + 1); } ctx.fillStyle = o.color || '#fff'; ctx.fillText(str, x, y); ctx.restore(); },
    bar(ctx, x, y, w, h, pct, o) { o = o || {}; ctx.fillStyle = o.bg || 'rgba(0,0,0,.5)'; ctx.fillRect(x, y, w, h); ctx.fillStyle = o.color || '#49c94c'; ctx.fillRect(x + 1, y + 1, Math.max(0, Math.min(1, pct)) * (w - 2), h - 2); },
    rect(ctx, x, y, w, h, color) { ctx.fillStyle = color; ctx.fillRect(x, y, w, h); },
    sprite(ctx, name, x, y, o) { const sp = sprites[name]; if (!sp) return; o = o || {}; const c = sp.canvases[(o.frame || 0) % sp.canvases.length], s = o.scale || 1; ctx.save(); if (o.flip) { ctx.translate(x + sp.w * s, y); ctx.scale(-1, 1); ctx.drawImage(c, 0, 0, sp.w * s, sp.h * s); } else ctx.drawImage(c, x, y, sp.w * s, sp.h * s); ctx.restore(); },
    hearts(ctx, x, y, n, max, o) { o = o || {}; for (let i = 0; i < max; i++) { ctx.fillStyle = i < n ? (o.color || '#e23d3d') : 'rgba(255,255,255,.2)'; const hx = x + i * (o.gap || 9); ctx.fillRect(hx, y + 1, 3, 2); ctx.fillRect(hx + 4, y + 1, 3, 2); ctx.fillRect(hx, y + 3, 7, 2); ctx.fillRect(hx + 1, y + 5, 5, 1); ctx.fillRect(hx + 2, y + 6, 3, 1); ctx.fillRect(hx + 3, y + 7, 1, 1); } }
  };

  // ---------- tweens, timers, saving ----------
  let tweens = [];
  const EASE = { linear: t => t, out: t => 1 - (1 - t) * (1 - t), in: t => t * t, inout: t => t < 0.5 ? 2 * t * t : 1 - (-2 * t + 2) ** 2 / 2, bounce: t => { const n = 7.5625, d = 2.75; if (t < 1 / d) return n * t * t; if (t < 2 / d) return n * (t -= 1.5 / d) * t + 0.75; if (t < 2.5 / d) return n * (t -= 2.25 / d) * t + 0.9375; return n * (t -= 2.625 / d) * t + 0.984375; } };
  // CM.tween(thing, { x: 100, alpha: 0 }, 0.5, { ease: 'out', onDone })  — props can also be inside thing.props
  CM.tween = function (obj, props, secs, o) { o = o || {}; const from = {}; for (const k of Object.keys(props)) from[k] = k in obj ? obj[k] : (obj.props || {})[k]; const tw = { obj, props, from, t: 0, secs: secs || 0.3, ease: EASE[o.ease || 'out'] || EASE.out, onDone: o.onDone, done: false }; tweens.push(tw); return tw; };
  CM.save = (key, val) => { try { localStorage.setItem('cm.save.' + (CM.projectId || '') + '.' + key, JSON.stringify(val)); } catch {} };
  CM.load = (key, def) => { try { const v = localStorage.getItem('cm.save.' + (CM.projectId || '') + '.' + key); return v == null ? def : JSON.parse(v); } catch { return def; } };
  let fade = null; // { t, dur, to: sceneName, phase: 'out'|'in' }

  // ---------- particles (cheap, no entities) ----------
  let particles = [];
  CM.burst = function (x, y, o) { o = o || {}; const n = o.count || 10; for (let i = 0; i < n; i++) { const a = Math.random() * Math.PI * 2, sp = (o.speed || 80) * (0.4 + Math.random()); particles.push({ x, y, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp - (o.up || 40), life: (o.life || 0.5) * (0.6 + Math.random() * 0.6), size: o.size || 2, color: Array.isArray(o.color) ? o.color[i % o.color.length] : (o.color || '#ffd93d'), g: o.gravity != null ? o.gravity : 200 }); } };

  // ---------- the running game ----------
  CM.W = 320; CM.H = 180; CM.scale = 1; CM.canvas = null; CM.ctx = null; CM.current = null;
  CM.time = 0; CM.dt = 1 / 60; CM.paused = false; CM.speed = 1; CM.fps = 0; CM.showBoxes = false; CM.frameNo = 0;
  let acc = 0, last = 0, stepOnce = false, raf = 0, fpsT = 0, fpsN = 0, pendingScene = null, started = false;

  CM.setup = function (canvas, opts) {
    opts = opts || {}; CM.canvas = canvas; CM.ctx = canvas.getContext('2d'); CM.W = opts.width || 320; CM.H = opts.height || 180;
    canvas.width = CM.W; canvas.height = CM.H; CM.ctx.imageSmoothingEnabled = false;
    input.bindCanvas(canvas, toLogical);
  };
  function toLogical(e) { const r = CM.canvas.getBoundingClientRect(); return { x: (e.clientX - r.left) / r.width * CM.W, y: (e.clientY - r.top) / r.height * CM.H }; }
  CM.toWorld = (sx, sy) => { const c = CM.current ? CM.current.camera : { x: 0, y: 0, zoom: 1 }; return { x: sx / c.zoom + c.x, y: sy / c.zoom + c.y }; };
  CM.toScreen = (wx, wy) => { const c = CM.current ? CM.current.camera : { x: 0, y: 0, zoom: 1 }; return { x: (wx - c.x) * c.zoom, y: (wy - c.y) * c.zoom }; };

  CM.start = function (sceneName) { pendingScene = sceneName || CM.startScene || Object.keys(scenes)[0]; if (!started) { started = true; last = performance.now(); raf = requestAnimationFrame(loop); } };
  CM.go = function (sceneName, o) { if (o && o.fade) { if (fade && fade.phase === 'out') return; fade = { t: 0, dur: o.fade, to: sceneName, phase: 'out' }; } else pendingScene = sceneName; };
  CM.stop = function () { cancelAnimationFrame(raf); started = false; };
  CM.step = function () { stepOnce = true; };
  CM.reset = function () { // used by hot reload: forget every definition, keep the loop
    for (const k of Object.keys(sprites)) delete sprites[k]; for (const k of Object.keys(entityDefs)) delete entityDefs[k]; for (const k of Object.keys(scenes)) delete scenes[k];
    nextId = {}; particles = []; errSeen.clear(); CM.current = null;
  };

  function switchScene(name) {
    nextId = {}; particles = []; tweens = [];
    const s = new Scene(name); CM.current = s; CM.time = 0;
    safe(() => s.def.setup && s.def.setup(s), 'setup ' + name);
    emit('scene', s);
  }

  function loop(now) {
    raf = requestAnimationFrame(loop);
    let elapsed = Math.min(0.1, (now - last) / 1000); last = now;
    fpsN++; fpsT += elapsed; if (fpsT >= 0.5) { CM.fps = Math.round(fpsN / fpsT); fpsN = 0; fpsT = 0; }
    if (pendingScene) { const n = pendingScene; pendingScene = null; switchScene(n); }
    const s = CM.current; if (!s) return;
    const fixed = 1 / 60;
    if (CM.paused && !stepOnce) { render(s); emit('frame', s); input.endFrame(); return; }
    if (stepOnce) { stepOnce = false; tick(s, fixed); render(s); emit('frame', s); return; }
    acc += elapsed * CM.speed; let steps = 0;
    while (acc >= fixed && steps < 4) { tick(s, fixed); acc -= fixed; steps++; if (pendingScene) break; }
    render(CM.current); emit('frame', CM.current);
  }

  function tick(s, dt) {
    input.pollPads(); CM.dt = dt; CM.time += dt; s.time += dt; CM.frameNo++;
    const p = input.pointer; const wp = CM.toWorld(p.sx, p.sy); p.x = wp.x; p.y = wp.y;
    safe(() => s.def.update && s.def.update(s, dt), 'update scene ' + s.name);
    const ents = s.entities;
    for (const e of ents) { if (!e.alive) continue; e.age += dt; if (e.def.update) safe(() => e.def.update(e, dt, s), 'update ' + e.type, e); }
    for (const e of ents) if (e.alive) physics(e, s, dt);
    overlaps(s);
    // animation + bubbles
    for (const e of ents) { if (!e.alive) continue; const sp = e.sprite && sprites[e.sprite]; if (sp && sp.canvases.length > 1) { e.animT += dt * (e.fps || sp.fps); e.frame = Math.floor(e.animT) % sp.canvases.length; } if (e.bubble && s.time > e.bubble.until) e.bubble = null; if (e.flashT > 0) e.flashT -= dt; }
    for (let i = ents.length - 1; i >= 0; i--) if (!ents[i].alive) ents.splice(i, 1);
    // timers + tweens + fade
    for (const tm of s.timersList) { tm.t -= dt; if (tm.t <= 0) { safe(tm.fn, 'timer', null); if (tm.every) tm.t += tm.every; else tm.done = true; } } s.timersList = s.timersList.filter(t => !t.done);
    for (const tw of tweens) { tw.t += dt; const k = tw.ease(Math.min(1, tw.t / tw.secs)); for (const key of Object.keys(tw.props)) { const v = tw.from[key] + (tw.props[key] - tw.from[key]) * k; if (key in tw.obj) tw.obj[key] = v; else if (tw.obj.props) tw.obj.props[key] = v; } if (tw.t >= tw.secs) { tw.done = true; if (tw.onDone) safe(tw.onDone, 'tween done'); } } tweens = tweens.filter(t => !t.done);
    if (fade) { fade.t += dt; if (fade.phase === 'out' && fade.t >= fade.dur / 2) { pendingScene = fade.to; fade.phase = 'in'; } else if (fade.phase === 'in' && fade.t >= fade.dur) fade = null; }
    // particles
    for (const q of particles) { q.vy += q.g * dt; q.x += q.vx * dt; q.y += q.vy * dt; q.life -= dt; } particles = particles.filter(q => q.life > 0);
    // camera
    const c = s.camera;
    if (c.target && c.target.alive) { const tx = c.target.cx - CM.W / 2 / c.zoom, ty = c.target.cy - CM.H / 2 / c.zoom; c.x += (tx - c.x) * (c.lerp == null ? 0.12 : c.lerp); c.y += (ty - c.y) * (c.lerp == null ? 0.12 : c.lerp); }
    const b = c.bounds || s.bounds; if (b) { c.x = Math.max(b.x, Math.min(b.x + b.w - CM.W / c.zoom, c.x)); c.y = Math.max(b.y, Math.min(b.y + b.h - CM.H / c.zoom, c.y)); if (b.w < CM.W / c.zoom) c.x = b.x - (CM.W / c.zoom - b.w) / 2; if (b.h < CM.H / c.zoom) c.y = b.y - (CM.H / c.zoom - b.h) / 2; }
    if (c.shakeT > 0) { c.shakeT -= dt; c.sx = (Math.random() - 0.5) * c.shakeA * 2; c.sy = (Math.random() - 0.5) * c.shakeA * 2; } else { c.sx = 0; c.sy = 0; }
    input.endFrame();
  }

  function physics(e, s, dt) {
    if (e.gravity) e.vy += s.gravity * dt;
    if (e.friction && e.grounded) e.vx *= Math.max(0, 1 - e.friction * dt);
    const solids = e.solid || e.def.collides !== false ? s.entities.filter(o => o !== e && o.alive && o.solid) : [];
    // horizontal
    e.x += e.vx * dt; e.onWall = 0;
    if (e.def.collides !== false) {
      if (hitsSolid(e, s, solids)) { const dir = Math.sign(e.vx) || 1; let n = 0; while (hitsSolid(e, s, solids) && n++ < 64) e.x -= dir * 0.5; e.onWall = dir; if (e.bounce) e.vx = -e.vx * e.bounce; else e.vx = 0; }
    }
    // vertical
    e.y += e.vy * dt; const wasGrounded = e.grounded; e.grounded = false;
    if (e.def.collides !== false) {
      if (hitsSolid(e, s, solids)) { const dir = Math.sign(e.vy) || 1; let n = 0; while (hitsSolid(e, s, solids) && n++ < 64) e.y -= dir * 0.5; if (dir > 0) e.grounded = true; if (e.bounce && Math.abs(e.vy) > 40) e.vy = -e.vy * e.bounce; else e.vy = 0; }
      else if (wasGrounded && e.gravity && e.vy >= 0) { // still touching the floor? keep grounded so walking off a ledge is one frame late, not jittery
        e.y += 1; if (hitsSolid(e, s, solids)) e.grounded = true; e.y -= 1; }
    }
    if (e.def.keepInBounds && s.bounds) { e.x = Math.max(s.bounds.x, Math.min(s.bounds.x + s.bounds.w - e.w, e.x)); e.y = Math.max(s.bounds.y, Math.min(s.bounds.y + s.bounds.h - e.h, e.y)); }
  }
  function hitsSolid(e, s, solids) {
    for (const tm of s.tilemaps) { const x0 = Math.floor(e.x / tm.size), x1 = Math.floor((e.x + e.w - 0.01) / tm.size), y0 = Math.floor(e.y / tm.size), y1 = Math.floor((e.y + e.h - 0.01) / tm.size);
      for (let ty = y0; ty <= y1; ty++) for (let tx = x0; tx <= x1; tx++) { if (tx < 0 || ty < 0 || tx >= tm.w || ty >= tm.h) continue; const L = tm.legend[tm.grid[ty][tx]]; if (L && L.solid) { if (L.oneWay) { if (e.vy > 0 && e.y + e.h - e.vy * CM.dt <= ty * tm.size + 0.5) return true; } else return true; } } }
    for (const o of solids) if (e.overlaps(o)) return true;
    return false;
  }
  function overlaps(s) {
    const ents = s.entities.filter(e => e.alive);
    for (const e of ents) { const hit = e.def.hit; if (!hit || !e.alive) continue;
      for (const o of ents) { if (o === e || !o.alive || !e.alive) continue; if (!e.overlaps(o)) continue;
        let fn = null; for (const k of Object.keys(hit)) { if (k === '*' ? true : o.has(k)) { fn = hit[k]; if (k !== '*') break; } }
        if (fn) safe(() => fn(e, o, s), `hit ${e.type} -> ${o.type}`, e); } }
  }

  function render(s) {
    const ctx = CM.ctx; if (!ctx || !s) return;
    ctx.imageSmoothingEnabled = false;
    ctx.fillStyle = s.bg; ctx.fillRect(0, 0, CM.W, CM.H);
    const c = s.camera; ctx.save(); ctx.scale(c.zoom, c.zoom); ctx.translate(-Math.round(c.x + c.sx), -Math.round(c.y + c.sy));
    safe(() => s.def.background && s.def.background(s, ctx), 'background ' + s.name);
    drawTiles(s, ctx);
    const ents = s.entities.filter(e => e.alive && e.visible).sort((a, b) => a.layer - b.layer);
    for (const e of ents) drawEntity(e, ctx);
    for (const q of particles) { ctx.globalAlpha = Math.min(1, q.life * 3); ctx.fillStyle = q.color; ctx.fillRect(Math.round(q.x), Math.round(q.y), q.size, q.size); } ctx.globalAlpha = 1;
    drawTiles(s, ctx, true);
    safe(() => s.def.draw && s.def.draw(s, ctx), 'draw ' + s.name);
    for (const e of ents) if (e.bubble) drawBubble(e, ctx);
    if (CM.showBoxes) { ctx.lineWidth = 1; for (const e of ents) { ctx.strokeStyle = e.solid ? 'rgba(255,120,0,.9)' : 'rgba(0,220,255,.9)'; ctx.strokeRect(Math.round(e.x) + 0.5, Math.round(e.y) + 0.5, e.w - 1, e.h - 1); } }
    ctx.restore();
    safe(() => s.def.ui && s.def.ui(s, ctx), 'ui ' + s.name);
    if (fade) { const a = fade.phase === 'out' ? Math.min(1, fade.t / (fade.dur / 2)) : Math.max(0, 1 - (fade.t - fade.dur / 2) / (fade.dur / 2)); ctx.fillStyle = `rgba(0,0,0,${a})`; ctx.fillRect(0, 0, CM.W, CM.H); }
  }
  function drawTiles(s, ctx, over) {
    for (const tm of s.tilemaps) if (!!tm.over === !!over) drawTilemap(s, ctx, tm);
  }
  function drawTilemap(s, ctx, tm) {
    const c = s.camera;
    const x0 = Math.max(0, Math.floor(c.x / tm.size)), y0 = Math.max(0, Math.floor(c.y / tm.size)), x1 = Math.min(tm.w - 1, Math.ceil((c.x + CM.W / c.zoom) / tm.size)), y1 = Math.min(tm.h - 1, Math.ceil((c.y + CM.H / c.zoom) / tm.size));
    for (let ty = y0; ty <= y1; ty++) for (let tx = x0; tx <= x1; tx++) { const L = tm.legend[tm.grid[ty][tx]]; if (!L) continue;
      if (L.sprite && sprites[L.sprite]) { const sp = sprites[L.sprite]; ctx.drawImage(sp.canvases[0], tx * tm.size, ty * tm.size, tm.size, tm.size); }
      else if (L.color) { ctx.fillStyle = L.color; ctx.fillRect(tx * tm.size, ty * tm.size, tm.size, tm.size); if (L.top) { ctx.fillStyle = L.top; ctx.fillRect(tx * tm.size, ty * tm.size, tm.size, Math.max(1, Math.round(tm.size / 5))); } } }
  }
  function drawEntity(e, ctx) {
    ctx.globalAlpha = e.alpha;
    if (e.def.draw) { safe(() => e.def.draw(e, ctx), 'draw ' + e.type, e); ctx.globalAlpha = 1; return; }
    const x = Math.round(e.x), y = Math.round(e.y);
    const sp = e.sprite && sprites[e.sprite];
    if (sp) { const c = sp.canvases[e.frame % sp.canvases.length]; ctx.save();
      if (e.angle && e.def.rotate) { ctx.translate(e.cx, e.cy); ctx.rotate(e.angle); if (e.flip) ctx.scale(1, -1); ctx.drawImage(c, -e.w / 2, -e.h / 2, e.w, e.h); }
      else if (e.flip) { ctx.translate(x + e.w, y); ctx.scale(-1, 1); ctx.drawImage(c, 0, 0, e.w, e.h); } else ctx.drawImage(c, x, y, e.w, e.h); ctx.restore(); }
    else if (e.shape === 'circle') { ctx.fillStyle = e.color; ctx.beginPath(); ctx.arc(e.cx, e.cy, Math.min(e.w, e.h) / 2, 0, Math.PI * 2); ctx.fill(); }
    else if (e.text != null) { CM.draw.text(ctx, String(e.text), x, y, { color: e.color, size: e.props.size || 8, align: e.props.align }); }
    else { ctx.fillStyle = e.color; ctx.fillRect(x, y, e.w, e.h); }
    if (e.flashT > 0) { ctx.globalCompositeOperation = 'source-atop'; ctx.fillStyle = 'rgba(255,255,255,.8)'; ctx.fillRect(x, y, e.w, e.h); ctx.globalCompositeOperation = 'source-over'; }
    if (e.error) { ctx.fillStyle = '#ff3b3b'; ctx.fillRect(x + e.w - 3, y - 3, 4, 4); }
    ctx.globalAlpha = 1;
  }
  function drawBubble(e, ctx) {
    const t = e.bubble.text; ctx.save(); ctx.font = '7px "Press Start 2P", monospace'; const w = ctx.measureText(t).width + 8, h = 13; let bx = Math.round(e.cx - w / 2), by = Math.round(e.y - h - 5);
    ctx.fillStyle = '#fff'; ctx.fillRect(bx, by, w, h); ctx.fillRect(Math.round(e.cx) - 2, by + h, 4, 2); ctx.fillStyle = '#222'; ctx.textBaseline = 'top'; ctx.fillText(t, bx + 4, by + 3); ctx.restore();
  }

  // ---------- helpers for notes/editor ----------
  CM.entityAt = function (wx, wy) { const s = CM.current; if (!s) return null; const list = s.entities.filter(e => e.alive && e.visible && wx >= e.x - 1 && wx <= e.x + e.w + 1 && wy >= e.y - 1 && wy <= e.y + e.h + 1).sort((a, b) => b.layer - a.layer || (a.w * a.h) - (b.w * b.h)); return list[0] || null; };
  CM.entitiesIn = function (x, y, w, h) { const s = CM.current; if (!s) return []; return s.entities.filter(e => e.alive && e.x < x + w && e.x + e.w > x && e.y < y + h && e.y + e.h > y); };
  CM.cropEntity = function (e, scale) { scale = scale || 4; const c = document.createElement('canvas'); const pad = 2; c.width = (e.w + pad * 2) * scale; c.height = (e.h + pad * 2) * scale; const ctx = c.getContext('2d'); ctx.imageSmoothingEnabled = false; ctx.fillStyle = CM.current ? CM.current.bg : '#000'; ctx.fillRect(0, 0, c.width, c.height); ctx.scale(scale, scale); ctx.translate(pad - e.x, pad - e.y); drawEntity(e, ctx); return c.toDataURL('image/png'); };
  CM.cropArea = function (x, y, w, h, scale) { scale = scale || 2; const c = document.createElement('canvas'); c.width = Math.max(1, Math.round(w * scale)); c.height = Math.max(1, Math.round(h * scale)); const ctx = c.getContext('2d'); ctx.imageSmoothingEnabled = false; const cam = CM.current.camera; ctx.drawImage(CM.canvas, (x - cam.x) * cam.zoom, (y - cam.y) * cam.zoom, w * cam.zoom, h * cam.zoom, 0, 0, c.width, c.height); return c.toDataURL('image/png'); };
  CM.snapshot = function () { const s = CM.current; if (!s) return null; const player = s.find('player'); return { scene: s.name, sceneSrc: s.def.src, time: r1(s.time), fps: CM.fps, speed: CM.speed, paused: CM.paused, camera: { x: Math.round(s.camera.x), y: Math.round(s.camera.y) }, entityCount: s.entities.length, player: player ? player.summary() : null, counts: countTypes(s), data: shallow(s.data), recentLog: logBuf.slice(-12).map(l => `${l.level === 'error' ? 'ERROR ' : ''}t=${r1(l.t)} ${l.text}`) }; };
  const countTypes = s => { const o = {}; for (const e of s.entities) if (e.alive) o[e.type] = (o[e.type] || 0) + 1; return o; };
  const shallow = o => { const r = {}; for (const k of Object.keys(o || {})) { const v = o[k]; r[k] = (typeof v === 'object' && v) ? '[object]' : v; } return r; };

  // ---------- adapter: what the note editor needs from any engine (2D here, 3D in engine3d.js) ----------
  const FIELDS = ['x', 'y', 'w', 'h', 'vx', 'vy', 'scale', 'layer', 'alpha', 'flip', 'visible', 'solid', 'gravity', 'bounce', 'friction', 'color', 'sprite', 'name', 'text'];
  CM.adapter = {
    mode: '2d', fields: FIELDS,
    pick(sx, sy) { const w = CM.toWorld(sx, sy); return CM.entityAt(w.x, w.y); },
    itemsIn(sx, sy, w, h) { const a = CM.toWorld(sx, sy); return CM.entitiesIn(a.x, a.y, w, h); },
    list() { return CM.current ? CM.current.entities.filter(e => e.alive) : []; },
    byId(id) { return CM.current ? CM.current.byId(id) : null; },
    bounds(e) { const c = CM.current.camera, p = CM.toScreen(e.x - c.sx, e.y - c.sy); return { x: p.x, y: p.y, w: e.w * c.zoom, h: e.h * c.zoom }; },
    spot(sx, sy) { const w = CM.toWorld(sx, sy); return { x: Math.round(w.x), y: Math.round(w.y), space: 'world', tile: CM.current && CM.current.tilemap ? { tx: Math.floor(w.x / CM.current.tilemap.size), ty: Math.floor(w.y / CM.current.tilemap.size), ch: (CM.current.tileAt(w.x, w.y) || {}).ch || null, src: CM.current.tilemap.src } : null }; },
    spotToScreen(spot) { if (spot.space === 'screen') return { x: spot.x, y: spot.y }; return CM.toScreen(spot.x, spot.y); },
    crop(e) { return CM.cropEntity(e); },
    cropRect(sx, sy, w, h) { const a = CM.toWorld(sx, sy); return CM.cropArea(a.x, a.y, w, h); },
    summary(e) { return e.summary(); },
    snapshot() { return CM.snapshot(); },
    props(e) { // editable things: engine fields first, then the game's own props
      const out = []; for (const k of FIELDS) out.push({ key: k, value: e[k], builtin: true }); for (const k of Object.keys(e.props)) out.push({ key: k, value: e.props[k], builtin: false }); return out;
    },
    setProp(e, key, val, all) {
      const apply = t => { if (FIELDS.includes(key)) t[key] = val; else t.props[key] = val; };
      apply(e); if (all) { for (const o of CM.current.entities) if (o.type === e.type && o !== e) apply(o); if (!FIELDS.includes(key)) e.def.props[key] = val; else if (['w', 'h', 'scale', 'layer', 'color', 'sprite', 'solid', 'gravity', 'bounce', 'friction'].includes(key)) e.def[key] = val; }
    },
    scenes() { return Object.keys(scenes); },
    sceneName() { return CM.current ? CM.current.name : null; },
    restart() { if (CM.current) CM.go(CM.current.name); },
    follow(e) { if (CM.current) CM.current.camera.follow(e); },
    // looking around while paused: pan in screen pixels, zoom around the middle, snap back to the target
    pan(dx, dy) { const c = CM.current.camera; c.x += dx / c.zoom; c.y += dy / c.zoom; c.panned = true; },
    zoom(f) { const c = CM.current.camera; const z0 = c.zoom, z1 = Math.max(0.5, Math.min(6, z0 * f)); const cx = c.x + CM.W / 2 / z0, cy = c.y + CM.H / 2 / z0; c.zoom = z1; c.x = cx - CM.W / 2 / z1; c.y = cy - CM.H / 2 / z1; c.panned = true; },
    resetView() { const c = CM.current.camera; c.zoom = 1; c.panned = false; if (c.target && c.target.alive) { c.x = c.target.cx - CM.W / 2; c.y = c.target.cy - CM.H / 2; } },
    panned() { return !!CM.current.camera.panned; },
    typeSrc(type) { return entityDefs[type] ? entityDefs[type].src : null; },
    defs() { return Object.keys(entityDefs).map(t => ({ type: t, src: entityDefs[t].src, tags: entityDefs[t].tags, props: entityDefs[t].props })); }
  };
})();
