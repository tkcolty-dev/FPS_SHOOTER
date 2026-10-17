// Claude Maximizer 3D engine — the same ideas as the 2D one (models, entities, scenes, props) on top of
// Three.js. Positions are x (right), y (up), z (toward the camera). An entity's x,z is the center of its
// feet and y is the floor it stands on. Every model, entity type and scene remembers the file:line that
// defined it so playtest notes can point Claude at the code.
(function () {
  'use strict';
  const CM = window.CM, THREE = window.THREE;
  const srcOf = CM.srcOf, safe = CM.safe, reportError = CM.reportError, emit = CM.emit, logBuf = CM.logs, errSeen = CM._errSeen, input = CM.input;
  const models = {}, entityDefs = {}, scenes = {};
  CM.defs = { models, entities: entityDefs, scenes };
  const r1 = v => Math.round(v * 10) / 10;

  // ---------- materials + models ----------
  const matCache = {};
  const colorOf = c => (CM.PALETTE[c] || c || '#ff00ff');
  const mat = c => (matCache[c] ||= new THREE.MeshLambertMaterial({ color: new THREE.Color(colorOf(c)) }));
  const geoCache = {};
  const geo = (kind, args) => { const k = kind + args.join(','); return (geoCache[k] ||= kind === 'box' ? new THREE.BoxGeometry(...args) : kind === 'sphere' ? new THREE.SphereGeometry(args[0], 12, 8) : kind === 'cylinder' ? new THREE.CylinderGeometry(args[0], args[1], args[2], 12) : kind === 'cone' ? new THREE.ConeGeometry(args[0], args[1], 10) : kind === 'capsule' ? new THREE.CapsuleGeometry(args[0], args[1], 3, 8) : new THREE.BoxGeometry(1, 1, 1)); };
  function partMesh(p) {
    let m;
    if (p.box) m = new THREE.Mesh(geo('box', p.box), mat(p.color));
    else if (p.sphere != null) m = new THREE.Mesh(geo('sphere', [p.sphere]), mat(p.color));
    else if (p.cylinder) m = new THREE.Mesh(geo('cylinder', p.cylinder.length === 2 ? [p.cylinder[0], p.cylinder[0], p.cylinder[1]] : p.cylinder), mat(p.color));
    else if (p.cone) m = new THREE.Mesh(geo('cone', p.cone), mat(p.color));
    else if (p.capsule) m = new THREE.Mesh(geo('capsule', p.capsule), mat(p.color));
    else m = new THREE.Mesh(geo('box', [1, 1, 1]), mat(p.color));
    m.position.set(p.x || 0, p.y || 0, p.z || 0); m.rotation.set(p.rx || 0, p.ry || 0, p.rz || 0); if (p.scale) m.scale.setScalar(p.scale);
    m.castShadow = true; m.receiveShadow = true; return m;
  }
  // CM.model('crate', { box: [1, 1, 1], color: 'N' })
  // CM.model('tree', { parts: [{ cylinder: [0.2, 1], color: 'n', y: 0.5 }, { cone: [0.9, 1.6], color: 'g', y: 1.8 }] })
  // CM.model('bat', { voxels: [['.P.P.', 'PPPPP'], ['..P..']], size: 0.2 })   layers bottom→top, rows back→front
  // CM.model('x', { build(THREE) { return someObject3D; } })
  CM.model = function (name, def) {
    def = { ...def }; def.name = name; def.src = srcOf();
    def.make = () => {
      const g = new THREE.Group();
      if (def.build) { const o = def.build(THREE); if (o) g.add(o); }
      else if (def.voxels) {
        const size = def.size || 0.25, pal = { ...CM.PALETTE, ...(def.palette || {}) }, layers = def.voxels.map(l => typeof l === 'string' ? l.split('\n') : l);
        const H = layers.length, D = Math.max(...layers.map(l => l.length)), W = Math.max(...layers.flat().map(r => r.length));
        const box = geo('box', [size, size, size]);
        layers.forEach((rows, y) => rows.forEach((row, z) => { for (let x = 0; x < row.length; x++) { const ch = row[x]; if (ch === '.' || ch === ' ') continue; const m = new THREE.Mesh(box, mat(pal[ch] || ch)); m.position.set((x - W / 2 + 0.5) * size, (y + 0.5) * size, (z - D / 2 + 0.5) * size); m.castShadow = true; m.receiveShadow = true; g.add(m); } }));
      }
      else if (def.parts) def.parts.forEach(p => g.add(partMesh(p)));
      else { const m = partMesh(def); const b = new THREE.Box3().setFromObject(m); m.position.y -= b.min.y; g.add(m); }
      const b = new THREE.Box3().setFromObject(g); if (!def.parts && !def.voxels && !def.build) { /* already grounded */ }
      else if (def.ground !== false) { const c = b.getCenter(new THREE.Vector3()); g.children.forEach(ch => { ch.position.x -= c.x; ch.position.z -= c.z; ch.position.y -= b.min.y; }); }
      g.traverse(o => { if (o.isMesh) { o.castShadow = true; o.receiveShadow = true; } });
      return g;
    };
    const probe = def.make(); const b = new THREE.Box3().setFromObject(probe); const sz = b.getSize(new THREE.Vector3());
    def.w = r1(sz.x) || 0.5; def.h = r1(sz.y) || 0.5; def.d = r1(sz.z) || 0.5;
    models[name] = def; return def;
  };

  // ---------- entities ----------
  let nextId = {};
  CM.entity = function (type, def) { def = { ...def }; def.type = type; def.src = srcOf(); def.props = def.props || {}; def.tags = def.tags || []; entityDefs[type] = def; return def; };
  CM.entity('block', { solid: true, gravity: false, tags: ['block'], props: {} }); // s.block(...) makes these
  entityDefs.block.src = 'engine';

  class Entity {
    constructor(scene, type, x, y, z, over) {
      const def = entityDefs[type]; if (!def) throw new Error(`No entity type "${type}". Define it with CM.entity('${type}', {...}).`);
      over = over || {}; nextId[type] = (nextId[type] || 0) + 1;
      this.id = type + '#' + nextId[type]; this.type = type; this.def = def; this.scene = scene; this.name = over.name || null;
      this.x = +x || 0; this.y = +y || 0; this.z = +z || 0; this.vx = 0; this.vy = 0; this.vz = 0; this.ry = +over.ry || 0;
      if ([x, y, z].some(v => v != null && typeof v !== 'number')) CM.log(`spawn('${type}', …) got a non-number position (${JSON.stringify([x, y, z])}); use spawn(type, x, z) or spawn(type, x, y, z)`);
      this.model = over.model || def.model || null; const md = this.model && models[this.model];
      this.scale = over.scale || def.scale || 1; this.color = over.color || def.color || null;
      this.w = over.w || def.w || (md ? md.w * this.scale : 1); this.h = over.h || def.h || (md ? md.h * this.scale : 1); this.d = over.d || def.d || (md ? md.d * this.scale : 1);
      this.visible = true; this.alive = true; this.tags = new Set([...(def.tags || []), ...(over.tags || [])]);
      this.props = { ...def.props, ...(over.props || {}) };
      for (const k of Object.keys(over)) if (!(k in this) && k !== 'props' && k !== 'tags') this.props[k] = over[k];
      this.solid = over.solid != null ? !!over.solid : !!def.solid; this.gravity = def.gravity != null ? !!def.gravity : false; this.bounce = def.bounce || 0;
      this.grounded = false; this.timers = {}; this.age = 0; this.bubble = null; this.flashT = 0; this.error = null;
      this.obj = new THREE.Group(); this.obj.userData.entity = this; this.build(); scene.three.add(this.obj);
    }
    build() {
      while (this.obj.children.length) this.obj.remove(this.obj.children[0]);
      const md = this.model && models[this.model]; let inner;
      if (md) { inner = md.make(); inner.scale.setScalar(this.scale); }
      else { inner = new THREE.Mesh(geo('box', [this.w, this.h, this.d]), mat(this.color || 'L')); inner.position.y = this.h / 2; inner.castShadow = true; inner.receiveShadow = true; }
      if (this.color && md) inner.traverse(o => { if (o.isMesh) { o.material = o.material.clone(); o.material.color.set(colorOf(this.color)); } });
      this.obj.add(inner); this.inner = inner; this.sync();
    }
    sync() { this.obj.position.set(this.x, this.y, this.z); this.obj.rotation.y = this.ry; this.obj.visible = this.visible; }
    has(tag) { return this.tags.has(tag) || this.type === tag; }
    get cx() { return this.x; } get cy() { return this.y + this.h / 2; } get cz() { return this.z; }
    get left() { return this.x - this.w / 2; } get right() { return this.x + this.w / 2; } get back() { return this.z - this.d / 2; } get front() { return this.z + this.d / 2; } get top() { return this.y + this.h; } get bottom() { return this.y; }
    destroy() { this.alive = false; }
    overlaps(o) { return this.left < o.right && this.right > o.left && this.y < o.top && this.top > o.y && this.back < o.front && this.front > o.back; }
    dist(o) { return Math.hypot(this.x - o.x, (this.y - (o.y || 0)) * 0.5, this.z - o.z); }
    face(dx, dz) { if (dx || dz) this.ry = Math.atan2(dx, dz); }
    lookAt(o) { this.face(o.x - this.x, o.z - this.z); }
    forward() { return { x: Math.sin(this.ry), z: Math.cos(this.ry) }; }
    moveToward(o, speed) { const dx = o.x - this.x, dz = o.z - this.z, l = Math.hypot(dx, dz) || 1; this.vx = dx / l * speed; this.vz = dz / l * speed; this.face(dx, dz); }
    say(text, secs) { this.bubble = { text: String(text), until: this.scene.time + (secs || 2) }; }
    flash(secs) { this.flashT = secs || 0.15; }
    every(secs, key) { key = key || 'every'; const t = this.timers; if (t[key] == null) t[key] = 0; t[key] += CM.dt; if (t[key] >= secs) { t[key] -= secs; return true; } return false; }
    after(secs, key) { key = key || 'after'; const t = this.timers; if (t[key] == null) t[key] = 0; if (t[key] === -1) return false; t[key] += CM.dt; if (t[key] >= secs) { t[key] = -1; return true; } return false; }
    jump(v) { this.vy = v || this.props.jump || 8; this.grounded = false; }
    summary() { const o = {}; for (const k of Object.keys(this.props)) o[k] = this.props[k]; return { id: this.id, type: this.type, name: this.name, src: this.def.src, model: this.model, tags: [...this.tags], x: r1(this.x), y: r1(this.y), z: r1(this.z), vx: r1(this.vx), vy: r1(this.vy), vz: r1(this.vz), ry: r1(this.ry), w: this.w, h: this.h, d: this.d, scale: this.scale, color: this.color, grounded: this.grounded, props: o, error: this.error }; }
  }

  // ---------- scenes ----------
  CM.scene = function (name, def) { def = { ...def }; def.name = name; def.src = srcOf(); scenes[name] = def; return def; };
  class Scene {
    constructor(name) {
      const def = scenes[name]; if (!def) throw new Error(`No scene "${name}". Define it with CM.scene('${name}', {...}).`);
      this.name = name; this.def = def; this.entities = []; this.time = 0; this.gravity = def.gravity != null ? def.gravity : 24; this.data = {};
      this.three = new THREE.Scene(); this.bg = def.sky || def.bg || '#87ceeb'; this.three.background = new THREE.Color(this.bg);
      if (def.fog) this.three.fog = new THREE.Fog(this.bg, def.fog * 0.5, def.fog);
      this.floorY = null; this.bounds = null;
      const hemi = new THREE.HemisphereLight(0xffffff, 0x667744, 0.9); this.three.add(hemi);
      const sun = new THREE.DirectionalLight(0xffffff, 1.3); sun.position.set(12, 20, 8); sun.castShadow = true; sun.shadow.mapSize.set(2048, 2048);
      const sc = sun.shadow.camera; sc.left = -30; sc.right = 30; sc.top = 30; sc.bottom = -30; sc.near = 1; sc.far = 80; this.three.add(sun); this.three.add(sun.target); this.sun = sun;
      this.camera = { x: 0, y: 8, z: 10, target: null, offset: { x: 0, y: 7, z: 9 }, lerp: 0.1, behind: false, lookUp: 0.8, shakeT: 0, shakeA: 0, sx: 0, sy: 0,
        follow: (e, opts) => { this.camera.target = e; Object.assign(this.camera, opts || {}); this.camera.baseOffset = { ...this.camera.offset }; },
        look: (x, y, z) => { this.camera.target = null; this.camera.x = x; this.camera.y = y; this.camera.z = z; },
        shake: (amount, secs) => { this.camera.shakeA = amount || 0.3; this.camera.shakeT = secs || 0.2; } };
    }
    // s.spawn('gem', x, z) puts it on the ground; s.spawn('gem', x, y, z) sets the height; an object last = overrides
    spawn(type, x, y, z, over) { if (z === undefined || (z && typeof z === 'object')) { if (z && typeof z === 'object') over = z; z = y; y = 0; } const e = new Entity(this, type, x, y, z, over); this.entities.push(e); if (e.def.init) safe(() => e.def.init(e, this), 'init ' + e.type, e); return e; }
    find(tag) { return this.entities.find(e => e.alive && e.has(tag)) || null; }
    all(tag) { return this.entities.filter(e => e.alive && (!tag || e.has(tag))); }
    each(tag, fn) { this.all(tag).forEach(fn); }
    count(tag) { return this.all(tag).length; }
    byId(id) { return this.entities.find(e => e.id === id) || null; }
    go(name) { CM.go(name); } restart() { CM.go(this.name); }
    // s.floor({ size: 60, color: 'G', color2: 'g' })  → a checkered ground the player stands on
    floor(o) {
      o = o || {}; const size = o.size || 60, y = o.y || 0;
      const c = document.createElement('canvas'); c.width = c.height = 64; const ctx = c.getContext('2d');
      ctx.fillStyle = colorOf(o.color || 'G'); ctx.fillRect(0, 0, 64, 64); if (o.color2 !== false) { ctx.fillStyle = colorOf(o.color2 || 'g'); ctx.fillRect(0, 0, 32, 32); ctx.fillRect(32, 32, 32, 32); }
      const tex = new THREE.CanvasTexture(c); tex.magFilter = THREE.NearestFilter; tex.wrapS = tex.wrapT = THREE.RepeatWrapping; tex.repeat.set(size / 2, size / 2);
      const m = new THREE.Mesh(new THREE.PlaneGeometry(size, size), new THREE.MeshLambertMaterial({ map: tex })); m.rotation.x = -Math.PI / 2; m.position.y = y; m.receiveShadow = true; this.three.add(m);
      this.floorY = y; this.bounds = { x: -size / 2, z: -size / 2, w: size, d: size }; return m;
    }
    // s.block(x, y, z, w, h, d, color)  → a solid box (walls, platforms, crates you can't push)
    block(x, y, z, w, h, d, color, over) { return this.spawn('block', x, y, z, { w, h, d, color: color || 'D', ...(over || {}) }); }
  }

  // ---------- particles ----------
  let particles = []; const pGeo = new THREE.BoxGeometry(0.12, 0.12, 0.12);
  CM.burst = function (x, y, z, o) { o = o || {}; const s = CM.current; if (!s) return; const n = o.count || 12; for (let i = 0; i < n; i++) { const m = new THREE.Mesh(pGeo, mat(Array.isArray(o.color) ? o.color[i % o.color.length] : (o.color || 'Y'))); m.position.set(x, y, z); s.three.add(m); const a = Math.random() * Math.PI * 2, sp = (o.speed || 4) * (0.4 + Math.random()); particles.push({ m, vx: Math.cos(a) * sp, vy: (o.up || 4) * (0.5 + Math.random()), vz: Math.sin(a) * sp, life: (o.life || 0.6) * (0.6 + Math.random() * 0.6), scene: s }); } };

  // ---------- the running game ----------
  CM.W = 960; CM.H = 540; CM.canvas = null; CM.hud = null; CM.hctx = null; CM.renderer = null; CM.cam3 = null; CM.current = null;
  CM.time = 0; CM.dt = 1 / 60; CM.paused = false; CM.speed = 1; CM.fps = 0; CM.showBoxes = false; CM.frameNo = 0;
  let acc = 0, last = 0, stepOnce = false, raf = 0, fpsT = 0, fpsN = 0, pendingScene = null, started = false;

  CM.setup = function (canvas, opts) {
    opts = opts || {}; CM.canvas = canvas; CM.W = opts.width || 960; CM.H = opts.height || 540;
    CM.renderer = new THREE.WebGLRenderer({ canvas, antialias: true, preserveDrawingBuffer: true }); CM.renderer.setPixelRatio(1); CM.renderer.setSize(CM.W, CM.H, false);
    CM.renderer.shadowMap.enabled = true; CM.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    CM.cam3 = new THREE.PerspectiveCamera(50, CM.W / CM.H, 0.1, 400);
    const hud = document.createElement('canvas'); hud.id = 'hud'; hud.width = CM.W; hud.height = CM.H; hud.style.cssText = 'position:absolute;inset:0;width:100%;height:100%;pointer-events:none;image-rendering:auto'; canvas.insertAdjacentElement('afterend', hud); CM.hud = hud; CM.hctx = hud.getContext('2d');
    input.bindCanvas(canvas, toLogical);
  };
  CM.resize = function (w, h) { if (!CM.renderer || (w === CM.W && h === CM.H)) return; CM.W = w; CM.H = h; CM.renderer.setSize(w, h, false); CM.hud.width = w; CM.hud.height = h; CM.cam3.aspect = w / h; CM.cam3.updateProjectionMatrix(); };
  function toLogical(e) { const r = CM.canvas.getBoundingClientRect(); return { x: (e.clientX - r.left) / r.width * CM.W, y: (e.clientY - r.top) / r.height * CM.H }; }
  CM.project = function (x, y, z) { const v = new THREE.Vector3(x, y, z).project(CM.cam3); return { x: (v.x + 1) / 2 * CM.W, y: (1 - v.y) / 2 * CM.H, behind: v.z > 1 }; };
  CM.rayAt = function (sx, sy) { const rc = new THREE.Raycaster(); rc.setFromCamera(new THREE.Vector2(sx / CM.W * 2 - 1, 1 - sy / CM.H * 2), CM.cam3); return rc; };
  CM.groundAt = function (sx, sy) { const s = CM.current; const ray = CM.rayAt(sx, sy).ray; const y = s && s.floorY != null ? s.floorY : 0; const t = (y - ray.origin.y) / ray.direction.y; if (!(t > 0)) return null; const p = ray.origin.clone().addScaledVector(ray.direction, t); return { x: p.x, y: p.y, z: p.z }; };

  CM.start = function (sceneName) { pendingScene = sceneName || CM.startScene || Object.keys(scenes)[0]; if (!started) { started = true; last = performance.now(); raf = requestAnimationFrame(loop); } };
  CM.go = function (sceneName) { pendingScene = sceneName; };
  CM.stop = function () { cancelAnimationFrame(raf); started = false; };
  CM.step = function () { stepOnce = true; };
  CM.reset = function () { for (const k of Object.keys(models)) delete models[k]; for (const k of Object.keys(entityDefs)) if (k !== 'block') delete entityDefs[k]; for (const k of Object.keys(scenes)) delete scenes[k]; nextId = {}; particles = []; errSeen.clear(); CM.current = null; };

  function switchScene(name) {
    nextId = {}; particles = [];
    const s = new Scene(name); CM.current = s; CM.time = 0;
    safe(() => s.def.setup && s.def.setup(s), 'setup ' + name);
    emit('scene', s);
  }
  function loop(now) {
    raf = requestAnimationFrame(loop);
    const elapsed = Math.min(0.1, (now - last) / 1000); last = now;
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
    const p = input.pointer; const g = CM.groundAt(p.sx, p.sy); if (g) { p.x = g.x; p.y = g.y; p.z = g.z; }
    safe(() => s.def.update && s.def.update(s, dt), 'update scene ' + s.name);
    const ents = s.entities;
    for (const e of ents) { if (!e.alive) continue; e.age += dt; if (e.def.update) safe(() => e.def.update(e, dt, s), 'update ' + e.type, e); }
    for (const e of ents) if (e.alive) physics(e, s, dt);
    overlaps(s);
    for (const e of ents) { if (!e.alive) continue; if (e.bubble && s.time > e.bubble.until) e.bubble = null; if (e.flashT > 0) { e.flashT -= dt; e.inner.traverse(o => { if (o.isMesh) o.material.emissive && o.material.emissive.setScalar(e.flashT > 0 ? 0.8 : 0); }); } e.sync(); }
    for (let i = ents.length - 1; i >= 0; i--) if (!ents[i].alive) { s.three.remove(ents[i].obj); ents.splice(i, 1); }
    for (const q of particles) { q.vy -= 12 * dt; q.m.position.x += q.vx * dt; q.m.position.y += q.vy * dt; q.m.position.z += q.vz * dt; q.life -= dt; if (q.life <= 0) q.scene.three.remove(q.m); } particles = particles.filter(q => q.life > 0);
    // camera
    const c = s.camera;
    if (c.target && c.target.alive) { const t = c.target; let ox = c.offset.x, oz = c.offset.z; if (c.behind) { ox = -Math.sin(t.ry) * c.offset.z; oz = -Math.cos(t.ry) * c.offset.z; } const tx = t.x + ox, ty = t.y + c.offset.y, tz = t.z + oz; c.x += (tx - c.x) * c.lerp; c.y += (ty - c.y) * c.lerp; c.z += (tz - c.z) * c.lerp; c.lookX = t.x; c.lookY = t.y + c.lookUp; c.lookZ = t.z; s.sun.target.position.set(t.x, t.y, t.z); s.sun.position.set(t.x + 12, t.y + 20, t.z + 8); }
    if (c.shakeT > 0) { c.shakeT -= dt; c.sx = (Math.random() - 0.5) * c.shakeA * 2; c.sy = (Math.random() - 0.5) * c.shakeA * 2; } else { c.sx = 0; c.sy = 0; }
    input.endFrame();
  }
  function physics(e, s, dt) {
    if (e.def.static) return;
    if (e.gravity) e.vy -= s.gravity * dt;
    const solids = e.def.collides === false ? [] : s.entities.filter(o => o !== e && o.alive && o.solid);
    e.x += e.vx * dt; for (const o of solids) if (e.overlaps(o)) { e.x = e.vx > 0 ? o.left - e.w / 2 - 0.001 : o.right + e.w / 2 + 0.001; e.vx = e.bounce ? -e.vx * e.bounce : 0; }
    e.z += e.vz * dt; for (const o of solids) if (e.overlaps(o)) { e.z = e.vz > 0 ? o.back - e.d / 2 - 0.001 : o.front + e.d / 2 + 0.001; e.vz = e.bounce ? -e.vz * e.bounce : 0; }
    e.y += e.vy * dt; e.grounded = false;
    for (const o of solids) if (e.overlaps(o)) { if (e.vy <= 0) { e.y = o.top; e.grounded = true; } else e.y = o.y - e.h - 0.001; e.vy = e.bounce && Math.abs(e.vy) > 2 ? -e.vy * e.bounce : 0; }
    if (s.floorY != null && e.y < s.floorY && e.def.collides !== false) { e.y = s.floorY; e.grounded = true; e.vy = e.bounce && Math.abs(e.vy) > 2 ? -e.vy * e.bounce : 0; }
    if (e.def.keepInBounds && s.bounds) { e.x = Math.max(s.bounds.x + e.w / 2, Math.min(s.bounds.x + s.bounds.w - e.w / 2, e.x)); e.z = Math.max(s.bounds.z + e.d / 2, Math.min(s.bounds.z + s.bounds.d - e.d / 2, e.z)); }
  }
  function overlaps(s) {
    const ents = s.entities.filter(e => e.alive);
    for (const e of ents) { const hit = e.def.hit; if (!hit || !e.alive) continue;
      for (const o of ents) { if (o === e || !o.alive || !e.alive || !e.overlaps(o)) continue;
        let fn = null; for (const k of Object.keys(hit)) { if (k === '*' ? true : o.has(k)) { fn = hit[k]; if (k !== '*') break; } }
        if (fn) safe(() => fn(e, o, s), `hit ${e.type} -> ${o.type}`, e); } }
  }
  function render(s) {
    if (!CM.renderer || !s) return; const c = s.camera;
    CM.cam3.position.set(c.x + c.sx, c.y + c.sy, c.z); CM.cam3.lookAt(c.lookX != null ? c.lookX : 0, c.lookY != null ? c.lookY : 0, c.lookZ != null ? c.lookZ : 0);
    safe(() => s.def.draw && s.def.draw(s), 'draw ' + s.name);
    CM.renderer.render(s.three, CM.cam3);
    const ctx = CM.hctx; ctx.clearRect(0, 0, CM.W, CM.H);
    for (const e of s.entities) { if (!e.alive || !e.visible) continue; if (e.bubble) { const p = CM.project(e.x, e.top + 0.3, e.z); if (!p.behind) drawBubble(ctx, p.x, p.y, e.bubble.text); } if (e.error) { const p = CM.project(e.x, e.top, e.z); ctx.fillStyle = '#ff3b3b'; ctx.fillRect(p.x - 3, p.y - 10, 6, 6); } }
    if (CM.showBoxes) { ctx.lineWidth = 1; for (const e of s.entities) { if (!e.alive) continue; const b = boundsOf(e); if (!b) continue; ctx.strokeStyle = e.solid ? 'rgba(255,120,0,.9)' : 'rgba(0,220,255,.9)'; ctx.strokeRect(b.x, b.y, b.w, b.h); } }
    safe(() => s.def.ui && s.def.ui(s, ctx), 'ui ' + s.name);
  }
  function drawBubble(ctx, x, y, t) { ctx.save(); ctx.font = '600 14px -apple-system, Segoe UI, sans-serif'; const w = ctx.measureText(t).width + 14, h = 24; const bx = Math.round(x - w / 2), by = Math.round(y - h - 6); ctx.fillStyle = '#fff'; ctx.beginPath(); ctx.roundRect(bx, by, w, h, 6); ctx.fill(); ctx.beginPath(); ctx.moveTo(x - 5, by + h); ctx.lineTo(x + 5, by + h); ctx.lineTo(x, by + h + 6); ctx.fill(); ctx.fillStyle = '#222'; ctx.textBaseline = 'middle'; ctx.fillText(t, bx + 7, by + h / 2); ctx.restore(); }
  CM.draw = {
    text(ctx, str, x, y, o) { o = o || {}; ctx.save(); ctx.font = `${o.bold !== false ? '700 ' : ''}${o.size || 18}px ${o.font || '-apple-system, Segoe UI, sans-serif'}`; ctx.textAlign = o.align || 'left'; ctx.textBaseline = o.baseline || 'top'; if (o.shadow !== false) { ctx.fillStyle = o.shadow || 'rgba(0,0,0,.5)'; ctx.fillText(str, x + 2, y + 2); } ctx.fillStyle = o.color || '#fff'; ctx.fillText(str, x, y); ctx.restore(); },
    bar(ctx, x, y, w, h, pct, o) { o = o || {}; ctx.fillStyle = o.bg || 'rgba(0,0,0,.5)'; ctx.fillRect(x, y, w, h); ctx.fillStyle = o.color || '#49c94c'; ctx.fillRect(x + 2, y + 2, Math.max(0, Math.min(1, pct)) * (w - 4), h - 4); },
    rect(ctx, x, y, w, h, color) { ctx.fillStyle = color; ctx.fillRect(x, y, w, h); },
    hearts(ctx, x, y, n, max, o) { o = o || {}; const s = o.size || 20; for (let i = 0; i < max; i++) { ctx.fillStyle = i < n ? (o.color || '#e23d3d') : 'rgba(255,255,255,.25)'; const hx = x + i * (s + 6); ctx.beginPath(); ctx.moveTo(hx + s / 2, y + s); ctx.bezierCurveTo(hx - s * 0.3, y + s * 0.4, hx + s * 0.1, y - s * 0.2, hx + s / 2, y + s * 0.3); ctx.bezierCurveTo(hx + s * 0.9, y - s * 0.2, hx + s * 1.3, y + s * 0.4, hx + s / 2, y + s); ctx.fill(); } }
  };

  // ---------- helpers for the editor ----------
  function boundsOf(e) {
    const xs = [e.left, e.right], ys = [e.y, e.top], zs = [e.back, e.front]; let x0 = 1e9, y0 = 1e9, x1 = -1e9, y1 = -1e9, any = false;
    for (const x of xs) for (const y of ys) for (const z of zs) { const p = CM.project(x, y, z); if (p.behind) continue; any = true; x0 = Math.min(x0, p.x); y0 = Math.min(y0, p.y); x1 = Math.max(x1, p.x); y1 = Math.max(y1, p.y); }
    if (!any) return null; return { x: x0, y: y0, w: x1 - x0, h: y1 - y0 };
  }
  CM.entityAt = function (sx, sy) { const s = CM.current; if (!s) return null; const rc = CM.rayAt(sx, sy); const hits = rc.intersectObjects(s.entities.filter(e => e.alive && e.visible).map(e => e.obj), true); for (const h of hits) { let o = h.object; while (o && !o.userData.entity) o = o.parent; if (o && o.userData.entity.alive) return o.userData.entity; } return null; };
  CM.snapshot = function () { const s = CM.current; if (!s) return null; const player = s.find('player'); const counts = {}; for (const e of s.entities) if (e.alive) counts[e.type] = (counts[e.type] || 0) + 1; const data = {}; for (const k of Object.keys(s.data)) { const v = s.data[k]; data[k] = (typeof v === 'object' && v) ? '[object]' : v; } return { scene: s.name, sceneSrc: s.def.src, time: r1(s.time), fps: CM.fps, speed: CM.speed, paused: CM.paused, camera: { x: r1(s.camera.x), y: r1(s.camera.y), z: r1(s.camera.z) }, entityCount: s.entities.length, player: player ? player.summary() : null, counts, data, recentLog: logBuf.slice(-12).map(l => `${l.level === 'error' ? 'ERROR ' : ''}t=${r1(l.t)} ${l.text}`) }; };
  function cropRect(x, y, w, h, scale) { scale = scale || 1; const c = document.createElement('canvas'); x = Math.max(0, x); y = Math.max(0, y); w = Math.min(CM.W - x, Math.max(1, w)); h = Math.min(CM.H - y, Math.max(1, h)); c.width = Math.round(w * scale); c.height = Math.round(h * scale); const ctx = c.getContext('2d'); ctx.drawImage(CM.canvas, x, y, w, h, 0, 0, c.width, c.height); return c.toDataURL('image/png'); }
  const FIELDS = ['x', 'y', 'z', 'vx', 'vy', 'vz', 'ry', 'w', 'h', 'd', 'scale', 'color', 'visible', 'solid', 'gravity', 'bounce', 'name', 'model'];
  CM.adapter = {
    mode: '3d', fields: FIELDS,
    pick(sx, sy) { return CM.entityAt(sx, sy); },
    itemsIn(sx, sy, w, h) { const s = CM.current; if (!s) return []; return s.entities.filter(e => { if (!e.alive) return false; const b = boundsOf(e); return b && b.x < sx + w && b.x + b.w > sx && b.y < sy + h && b.y + b.h > sy; }); },
    list() { return CM.current ? CM.current.entities.filter(e => e.alive) : []; },
    byId(id) { return CM.current ? CM.current.byId(id) : null; },
    bounds(e) { return boundsOf(e) || { x: -100, y: -100, w: 0, h: 0 }; },
    spot(sx, sy) { const g = CM.groundAt(sx, sy); return g ? { x: r1(g.x), y: r1(g.y), z: r1(g.z), space: 'world' } : { x: Math.round(sx), y: Math.round(sy), space: 'screen' }; },
    spotToScreen(spot) { if (spot.space === 'screen') return { x: spot.x, y: spot.y }; const p = CM.project(spot.x, spot.y || 0, spot.z || 0); return p.behind ? { x: -100, y: -100 } : p; },
    crop(e) { const b = boundsOf(e); if (!b) return null; const pad = 10; return cropRect(b.x - pad, b.y - pad, b.w + pad * 2, b.h + pad * 2, b.w > 240 ? 240 / b.w : 1); },
    cropRect(sx, sy, w, h) { return cropRect(sx, sy, w, h, w > 400 ? 400 / w : 1); },
    summary(e) { return e.summary(); },
    snapshot() { return CM.snapshot(); },
    props(e) { const out = []; for (const k of FIELDS) out.push({ key: k, value: e[k], builtin: true }); for (const k of Object.keys(e.props)) out.push({ key: k, value: e.props[k], builtin: false }); return out; },
    setProp(e, key, val, all) {
      const apply = t => { if (FIELDS.includes(key)) { t[key] = val; if (['scale', 'color', 'model', 'w', 'h', 'd'].includes(key)) t.build(); t.sync(); } else t.props[key] = val; };
      apply(e); if (all) { for (const o of CM.current.entities) if (o.type === e.type && o !== e) apply(o); if (!FIELDS.includes(key)) e.def.props[key] = val; else if (['scale', 'color', 'model', 'solid', 'gravity', 'bounce'].includes(key)) e.def[key] = val; }
    },
    scenes() { return Object.keys(scenes); },
    sceneName() { return CM.current ? CM.current.name : null; },
    restart() { if (CM.current) CM.go(CM.current.name); },
    follow(e) { if (CM.current) CM.current.camera.follow(e); },
    pan(dx, dy) { const c = CM.current.camera; const k = 0.02 * Math.hypot(c.offset.x, c.offset.y, c.offset.z) / 15; const fx = (c.lookX || 0) - c.x, fz = (c.lookZ || 0) - c.z, fl = Math.hypot(fx, fz) || 1; const rx = fz / fl, rz = -fx / fl; const mx = (rx * dx - fx / fl * dy) * k, mz = (rz * dx - fz / fl * dy) * k; c.x += mx; c.z += mz; c.lookX = (c.lookX || 0) + mx; c.lookZ = (c.lookZ || 0) + mz; c.panned = true; },
    zoom(f) { const c = CM.current.camera; const lx = c.lookX || 0, ly = c.lookY || 0, lz = c.lookZ || 0; c.x = lx + (c.x - lx) * f; c.y = ly + (c.y - ly) * f; c.z = lz + (c.z - lz) * f; c.offset = { x: c.offset.x * f, y: c.offset.y * f, z: c.offset.z * f }; c.panned = true; },
    resetView() { const c = CM.current.camera; c.panned = false; const d = CM.current.def; const base = (d.cameraOffset) || c.baseOffset || { x: 0, y: 7, z: 9 }; c.offset = { ...base }; if (c.target && c.target.alive) { const t = c.target; c.x = t.x + c.offset.x; c.y = t.y + c.offset.y; c.z = t.z + c.offset.z; c.lookX = t.x; c.lookY = t.y + c.lookUp; c.lookZ = t.z; } },
    panned() { return !!CM.current.camera.panned; },
    typeSrc(type) { return entityDefs[type] ? entityDefs[type].src : null; },
    defs() { return Object.keys(entityDefs).filter(t => t !== 'block').map(t => ({ type: t, src: entityDefs[t].src, tags: entityDefs[t].tags, props: entityDefs[t].props })); }
  };
})();
