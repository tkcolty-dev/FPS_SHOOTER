/* ============================================================
   BlockWorld 3D — engine
   Three.js renderer (soft shadows) + cannon-es physics +
   a Scratch-style green-thread runtime for compiled block scripts.
   Used by both the editor (app.js) and exported games (player.js).
   ============================================================ */
import * as THREE from 'three';
import * as CANNON from 'cannon-es';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { OBJLoader } from 'three/addons/loaders/OBJLoader.js';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import * as SkeletonUtils from 'three/addons/utils/SkeletonUtils.js';

export const KINDS = ['box','sphere','cylinder','cone','capsule','torus','plane','wedge','model'];
const D2R = Math.PI / 180, R2D = 180 / Math.PI;
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
let nextId = 1;
export const newId = () => 'o' + (Date.now().toString(36)) + (nextId++).toString(36);

/* Scratch-style casting */
export const toNum = v => { if (typeof v === 'number') return isNaN(v) ? 0 : v; if (typeof v === 'boolean') return v ? 1 : 0; const n = parseFloat(v); return isNaN(n) ? 0 : n; };
export const toStr = v => v == null ? '' : (typeof v === 'number' && Number.isInteger(v) === false ? String(Math.round(v * 1e4) / 1e4) : String(v));
export const toBool = v => v === true || v === 'true' || (typeof v === 'number' && v !== 0 && !isNaN(v)) || (typeof v === 'string' && v !== '' && v !== 'false' && v !== '0' && isNaN(parseFloat(v)) === false && parseFloat(v) !== 0);

/* Default data for a new object */
export function defaultObject(kind, name){
  const model = kind === 'model';
  return {
    id: newId(), name: name || kind, kind, modelUrl: '',
    position: [0, 0.5, 0], rotation: [0, 0, 0], scale: [1, 1, 1],
    color: model ? '' : '#4c97ff', material: 'normal', opacity: 0, visible: true,
    physics: { enabled: true, type: kind === 'plane' ? 'static' : 'dynamic', mass: 1, bounce: 0.3, friction: 0.4, upright: model || kind === 'capsule' },
    workspace: null
  };
}
export function defaultProject(){
  return {
    version: 1, name: 'My Game',
    stage: { sky: '#8fd3ff', gravity: 9.8, workspace: null, sun: 1.0, fog: true },
    variables: [],
    objects: [],
    camera: { position: [9, 6, 11], target: [0, 1, 0] }
  };
}

/* ----------------------------- Sound synth ----------------------------- */
class Synth {
  constructor(){ this.ctx = null; this.volume = 1; }
  ensure(){ if (!this.ctx){ try { this.ctx = new (window.AudioContext || window.webkitAudioContext)(); } catch(e){} } if (this.ctx && this.ctx.state === 'suspended') this.ctx.resume(); return this.ctx; }
  tone(freq, dur, type='square', vol=0.2, slide=0, delay=0){
    const c = this.ensure(); if (!c) return;
    const o = c.createOscillator(), g = c.createGain();
    o.type = type; o.frequency.setValueAtTime(freq, c.currentTime + delay);
    if (slide) o.frequency.exponentialRampToValueAtTime(Math.max(20, freq + slide), c.currentTime + delay + dur);
    g.gain.setValueAtTime(vol * this.volume, c.currentTime + delay);
    g.gain.exponentialRampToValueAtTime(0.001, c.currentTime + delay + dur);
    o.connect(g).connect(c.destination); o.start(c.currentTime + delay); o.stop(c.currentTime + delay + dur + 0.05);
  }
  noise(dur, vol=0.3){
    const c = this.ensure(); if (!c) return;
    const buf = c.createBuffer(1, c.sampleRate * dur, c.sampleRate), d = buf.getChannelData(0);
    for (let i = 0; i < d.length; i++) d[i] = (Math.random() * 2 - 1) * (1 - i / d.length);
    const s = c.createBufferSource(), g = c.createGain(); s.buffer = buf; g.gain.value = vol * this.volume;
    s.connect(g).connect(c.destination); s.start();
  }
  play(name){
    // don't let a held key machine-gun the same sound
    const t = performance.now(); this._last = this._last || {}; if (t - (this._last[name] || 0) < 90) return; this._last[name] = t;
    switch (name){
      case 'jump': this.tone(300, 0.18, 'square', 0.15, 400); break;
      case 'coin': this.tone(988, 0.08, 'square', 0.15); this.tone(1319, 0.25, 'square', 0.15, 0, 0.08); break;
      case 'hit': this.noise(0.15, 0.4); this.tone(150, 0.15, 'sawtooth', 0.2, -100); break;
      case 'boom': this.noise(0.6, 0.6); this.tone(80, 0.5, 'sine', 0.4, -60); break;
      case 'laser': this.tone(1200, 0.2, 'sawtooth', 0.12, -1000); break;
      case 'pop': this.tone(600, 0.06, 'sine', 0.3, 200); break;
      case 'powerup': [523, 659, 784, 1047].forEach((f, i) => this.tone(f, 0.12, 'square', 0.12, 0, i * 0.08)); break;
      case 'lose': [392, 370, 349, 330].forEach((f, i) => this.tone(f, 0.25, 'triangle', 0.2, 0, i * 0.2)); break;
      case 'win': [523, 659, 784, 1047, 784, 1047].forEach((f, i) => this.tone(f, 0.15, 'square', 0.12, 0, i * 0.11)); break;
    }
  }
  note(n, secs){ this.tone(440 * Math.pow(2, (toNum(n) - 69) / 12), secs, 'triangle', 0.25); }
}

/* ----------------------------- Model cache ----------------------------- */
const gltfLoader = new GLTFLoader();
const objLoader = new OBJLoader();
const modelCache = new Map();
export function loadModel(url){
  if (!modelCache.has(url)){
    const p = (/\.obj$/i.test(url.split('?')[0]) ? objLoader.loadAsync(url).then(g => ({ scene: g, animations: [] })) : gltfLoader.loadAsync(url))
      .then(g => {
        const root = g.scene || g.scenes[0];
        root.updateMatrixWorld(true);
        const box = new THREE.Box3().setFromObject(root);
        const size = new THREE.Vector3(); box.getSize(size);
        const center = new THREE.Vector3(); box.getCenter(center);
        const s = 1 / (Math.max(size.x, size.y, size.z) || 1);
        // normalize: largest side = 1 unit, centered at origin
        const wrap = new THREE.Group();
        root.position.sub(center).multiplyScalar(s); root.scale.multiplyScalar(s);
        wrap.add(root);
        wrap.userData.localBox = new THREE.Box3(size.clone().multiplyScalar(-s / 2), size.clone().multiplyScalar(s / 2));
        wrap.userData.clips = g.animations || [];
        return wrap;
      });
    modelCache.set(url, p);
    p.catch(() => modelCache.delete(url));
  }
  return modelCache.get(url);
}

/* ----------------------------- Scene object ----------------------------- */
export class SceneObject {
  constructor(engine, data, isClone=false){
    this.engine = engine; this.data = data; this.id = data.id; this.name = data.name;
    this.isClone = isClone; this.original = this;
    this.root = new THREE.Group(); this.root.userData.obj = this;
    this.body = null; this.mixer = null; this.clips = []; this.actions = {}; this.currentAction = null;
    this.localBox = new THREE.Box3(new THREE.Vector3(-0.5,-0.5,-0.5), new THREE.Vector3(0.5,0.5,0.5));
    this.ready = false; this.sizePct = 100; this.label = null; this.sayUntil = 0;
    this._tmp = new THREE.Vector3(); this._q = new THREE.Quaternion(); this._e = new THREE.Euler();
    this.materials = [];
  }
  get kind(){ return this.data.kind; }
  async build(){
    const d = this.data;
    while (this.root.children.length) this.root.remove(this.root.children[0]);
    let mesh;
    if (d.kind === 'model' && d.modelUrl){
      try {
        const proto = await loadModel(d.modelUrl);
        mesh = SkeletonUtils.clone(proto);
        this.localBox.copy(proto.userData.localBox);
        this.clips = proto.userData.clips;
        this.materials = [];
        mesh.traverse(m => { if (m.isMesh){ m.castShadow = true; m.receiveShadow = true; m.frustumCulled = !m.isSkinnedMesh; m.material = Array.isArray(m.material) ? m.material.map(x => x.clone()) : m.material.clone(); (Array.isArray(m.material) ? m.material : [m.material]).forEach(x => { x.userData.baseColor = x.color ? x.color.clone() : null; this.materials.push(x); }); } });
        if (this.clips.length){ this.mixer = new THREE.AnimationMixer(mesh); this.actions = {}; for (const c of this.clips) this.actions[c.name] = this.mixer.clipAction(c); }
      } catch (e) {
        console.warn('model failed', d.modelUrl, e); mesh = this._primitive('box'); this.materials = [mesh.material];
      }
    } else {
      mesh = this._primitive(d.kind === 'model' ? 'box' : d.kind);
      this.materials = [mesh.material];
    }
    this.root.add(mesh);
    this.mesh = mesh;
    this.ready = true;
    this.applyProps();
    this.rebuildBody();
  }
  _primitive(kind){
    let g;
    switch (kind){
      case 'sphere': g = new THREE.SphereGeometry(0.5, 32, 20); break;
      case 'cylinder': g = new THREE.CylinderGeometry(0.5, 0.5, 1, 32); break;
      case 'cone': g = new THREE.ConeGeometry(0.5, 1, 32); break;
      case 'capsule': g = new THREE.CapsuleGeometry(0.3, 0.6, 8, 16); this.localBox.set(new THREE.Vector3(-0.3,-0.6,-0.3), new THREE.Vector3(0.3,0.6,0.3)); break;
      case 'torus': g = new THREE.TorusGeometry(0.35, 0.15, 16, 40); g.rotateX(Math.PI/2); this.localBox.set(new THREE.Vector3(-0.5,-0.15,-0.5), new THREE.Vector3(0.5,0.15,0.5)); break;
      case 'plane': g = new THREE.BoxGeometry(1, 1, 1); break;
      case 'wedge': { const s = new THREE.Shape(); s.moveTo(-0.5,-0.5); s.lineTo(0.5,-0.5); s.lineTo(0.5,0.5); s.lineTo(-0.5,-0.5);
        g = new THREE.ExtrudeGeometry(s, { depth: 1, bevelEnabled: false }); g.translate(0, 0, -0.5); g.rotateY(Math.PI/2); g.computeVertexNormals(); break; }
      default: g = new THREE.BoxGeometry(1, 1, 1);
    }
    if (!['capsule','torus'].includes(kind)) this.localBox.set(new THREE.Vector3(-0.5,-0.5,-0.5), new THREE.Vector3(0.5,0.5,0.5));
    const m = new THREE.Mesh(g, new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.6, metalness: 0.05 }));
    m.castShadow = true; m.receiveShadow = true;
    return m;
  }
  applyProps(){
    const d = this.data;
    this.root.position.fromArray(d.position);
    this.root.rotation.set(d.rotation[0]*D2R, d.rotation[1]*D2R, d.rotation[2]*D2R);
    this.root.scale.fromArray(d.scale);
    this.root.visible = d.visible !== false;
    this.applyLook();
  }
  applyLook(){
    const d = this.data;
    const col = d.color ? new THREE.Color().setStyle(d.color) : null;
    for (const m of this.materials){
      if (col) { if (m.color) m.color.copy(col); if (m.emissive && d.material === 'glow') m.emissive.copy(col); }
      else if (m.userData.baseColor && m.color) m.color.copy(m.userData.baseColor);
      const mat = d.material || 'normal';
      if ('roughness' in m){
        m.roughness = mat === 'shiny' ? 0.15 : mat === 'metal' ? 0.3 : mat === 'glass' ? 0.05 : mat === 'flat' ? 1 : 0.6;
        m.metalness = mat === 'metal' ? 0.9 : mat === 'glass' ? 0.1 : 0.05;
      }
      if (m.emissive){ if (mat === 'glow') { m.emissive.copy(col || (m.color || new THREE.Color(0xffffff))); m.emissiveIntensity = 0.8; } else { m.emissive.setRGB(0,0,0); } }
      const op = clamp(1 - toNum(d.opacity == null ? 0 : d.opacity) / 100, 0, 1);
      const alpha = mat === 'glass' ? Math.min(op, 0.45) : op;
      m.transparent = alpha < 1; m.opacity = alpha; m.depthWrite = alpha >= 0.99 || mat !== 'glass';
      m.needsUpdate = true;
    }
  }
  /* physics */
  rebuildBody(){
    const eng = this.engine, d = this.data, p = d.physics;
    if (this.body){ eng.world.removeBody(this.body); this.body = null; }
    if (!p || !p.enabled || !eng.physicsActive) return;
    const size = new THREE.Vector3(); this.localBox.getSize(size);
    const sx = Math.abs(this.root.scale.x), sy = Math.abs(this.root.scale.y), sz = Math.abs(this.root.scale.z);
    let shape;
    if (d.kind === 'sphere') shape = new CANNON.Sphere(0.5 * Math.max(sx, sy, sz));
    else if (d.kind === 'cylinder') shape = new CANNON.Cylinder(0.5 * sx, 0.5 * sx, 1 * sy, 16);
    else if (d.kind === 'cone') shape = new CANNON.Cylinder(0.05 * sx, 0.5 * sx, 1 * sy, 12);
    else shape = new CANNON.Box(new CANNON.Vec3(Math.max(0.01, size.x * sx / 2), Math.max(0.01, size.y * sy / 2), Math.max(0.01, size.z * sz / 2)));
    const center = new THREE.Vector3(); this.localBox.getCenter(center);
    const mass = p.type === 'static' ? 0 : Math.max(0.01, toNum(p.mass) || 1);
    const body = new CANNON.Body({ mass, material: eng.physMaterial(p.bounce, p.friction), fixedRotation: !!p.upright, linearDamping: 0.02, angularDamping: p.upright ? 1 : 0.3, allowSleep: false });
    body.addShape(shape, new CANNON.Vec3(center.x * sx, center.y * sy, center.z * sz));
    body.position.set(this.root.position.x, this.root.position.y, this.root.position.z);
    body.quaternion.set(this.root.quaternion.x, this.root.quaternion.y, this.root.quaternion.z, this.root.quaternion.w);
    body.userData = { obj: this };
    if (p.upright) body.updateMassProperties();
    eng.world.addBody(body);
    this.body = body;
  }
  syncFromBody(){
    if (!this.body) return;
    const b = this.body;
    this.root.position.set(b.position.x, b.position.y, b.position.z);
    this.root.quaternion.set(b.quaternion.x, b.quaternion.y, b.quaternion.z, b.quaternion.w);
  }
  syncToBody(keepVel=false){
    if (!this.body) return;
    const b = this.body, r = this.root;
    b.position.set(r.position.x, r.position.y, r.position.z);
    b.quaternion.set(r.quaternion.x, r.quaternion.y, r.quaternion.z, r.quaternion.w);
    if (!keepVel){ b.velocity.set(0,0,0); b.angularVelocity.set(0,0,0); }
    b.aabbNeedsUpdate = true; b.wakeUp();
  }
  worldBox(out){
    // fast AABB from the 8 corners of the local box
    out = out || new THREE.Box3(); out.makeEmpty();
    const mn = this.localBox.min, mx = this.localBox.max, m = this.root.matrixWorld, v = this._tmp;
    for (let i = 0; i < 8; i++){ v.set(i&1 ? mx.x : mn.x, i&2 ? mx.y : mn.y, i&4 ? mx.z : mn.z).applyMatrix4(m); out.expandByPoint(v); }
    return out;
  }
  dispose(){
    if (this.body){ this.engine.world.removeBody(this.body); this.body = null; }
    if (this.label){ this.root.remove(this.label); this.label.material.map.dispose(); this.label.material.dispose(); this.label = null; }
    this.root.parent && this.root.parent.remove(this.root);
  }

  /* ======================= script API (self.*) ======================= */
  pos(){ return this.root.position; }
  dir(){ let d = this.root.rotation.y * R2D; d = ((d + 180) % 360 + 360) % 360 - 180; return Math.round(d * 100) / 100; }
  _moved(keepVel){ this.syncToBody(keepVel); }
  forward(steps){ const y = this.root.rotation.y; this.root.position.x += Math.sin(y) * steps; this.root.position.z += Math.cos(y) * steps; this._moved(true); }
  moveDir(dir, v){
    const y = this.root.rotation.y;
    if (dir === 'up') this.root.position.y += v; else if (dir === 'down') this.root.position.y -= v;
    else if (dir === 'back') { this.root.position.x -= Math.sin(y) * v; this.root.position.z -= Math.cos(y) * v; }
    else { const s = dir === 'left' ? 1 : -1; this.root.position.x += Math.cos(y) * v * s; this.root.position.z -= Math.sin(y) * v * s; }
    this._moved(dir !== 'up' && dir !== 'down');
  }
  turn(deg){ this.root.rotation.y += deg * D2R; this._moved(true); }
  setDir(deg){ this.root.rotation.y = deg * D2R; this._moved(true); }
  tilt(axis, deg){ this.root.rotation[axis] += deg * D2R; this._moved(true); }
  setRot(x, y, z){ this.root.rotation.set(x*D2R, y*D2R, z*D2R); this._moved(true); }
  pointTowards(name){ const t = this.engine.find(name, this); if (!t) return; const dx = t.root.position.x - this.root.position.x, dz = t.root.position.z - this.root.position.z; this.root.rotation.y = Math.atan2(dx, dz); this._moved(true); }
  goTo(x, y, z){ this.root.position.set(x, y, z); this._moved(false); }
  goToObj(name){
    if (name === '__random__'){ this.root.position.set((Math.random()-0.5)*30, this.root.position.y, (Math.random()-0.5)*30); this._moved(false); return; }
    const t = this.engine.find(name, this); if (t){ this.root.position.copy(t.root.position); this._moved(false); }
  }
  changeAxis(a, v){ this.root.position[a] += v; this._moved(a !== 'y'); }
  setAxis(a, v){ this.root.position[a] = v; this._moved(a !== 'y'); }
  *glide(secs, x, y, z){
    const R = this.engine.rt, t0 = R.now(), from = this.root.position.clone(), to = new THREE.Vector3(x, y, z);
    if (secs <= 0){ this.goTo(x, y, z); return; }
    while (true){ const k = clamp((R.now() - t0) / secs, 0, 1); this.root.position.lerpVectors(from, to, k); this._moved(false); if (k >= 1) return; yield; }
  }
  *glideObj(secs, name){ const t = this.engine.find(name, this); if (!t) return; yield* this.glide(secs, t.root.position.x, t.root.position.y, t.root.position.z); }
  /* looks */
  setVisible(v){ this.data.visible = !!v; this.root.visible = !!v; if (this.body){ if (v) { if (!this.body.world) this.engine.world.addBody(this.body); } else if (this.body.world) this.engine.world.removeBody(this.body); } }
  setColor(c){ try { const col = new THREE.Color().setStyle(String(c)); this.data.color = '#' + col.getHexString(); } catch(e){ return; } this.applyLook(); }
  setMaterial(m){ this.data.material = m; this.applyLook(); }
  setOpacity(p){ this.data.opacity = clamp(p, 0, 100); this.applyLook(); }
  size(){ return this.sizePct; }
  setSize(p){ p = clamp(p, 1, 2000); this.sizePct = p; const base = this.baseScale || this.data.scale; this.root.scale.set(base[0]*p/100, base[1]*p/100, base[2]*p/100); if (this.body) this.rebuildBody(); }
  say(text){ this.engine.setLabel(this, toStr(text)); this.sayUntil = 0; }
  *sayFor(text, secs){ this.say(text); const R = this.engine.rt, t0 = R.now(); while (R.now() - t0 < secs) yield; if (this.label && this.label.userData.text === toStr(text)) this.engine.setLabel(this, ''); }
  playAnim(name, loop){
    const a = this.actions[name]; if (!a) return;
    if (this.currentAction === a && a.isRunning() && loop) return;
    a.reset(); a.setLoop(loop ? THREE.LoopRepeat : THREE.LoopOnce, Infinity); a.clampWhenFinished = !loop; a.enabled = true;
    if (this.currentAction && this.currentAction !== a){ a.crossFadeFrom(this.currentAction, 0.2, false); }
    a.play(); this.currentAction = a;
  }
  *playAnimOnce(name){ const a = this.actions[name]; if (!a) return; this.playAnim(name, false); const R = this.engine.rt, t0 = R.now(), dur = a.getClip().duration / Math.max(0.01, a.timeScale); while (R.now() - t0 < dur) yield; }
  stopAnim(){ if (this.mixer) this.mixer.stopAllAction(); this.currentAction = null; }
  animSpeed(p){ if (this.mixer) this.mixer.timeScale = p / 100; }
  /* physics */
  physicsOn(on){ this.data.physics.enabled = !!on; this.rebuildBody(); }
  physicsType(t){ this.data.physics.type = t; this.rebuildBody(); }
  setMass(m){ this.data.physics.mass = Math.max(0.01, m); if (this.body && this.body.mass > 0){ this.body.mass = this.data.physics.mass; this.body.updateMassProperties(); } }
  setBounce(b){ this.data.physics.bounce = clamp(b, 0, 1.5); if (this.body) this.body.material = this.engine.physMaterial(this.data.physics.bounce, this.data.physics.friction); }
  setFriction(f){ this.data.physics.friction = clamp(f, 0, 2); if (this.body) this.body.material = this.engine.physMaterial(this.data.physics.bounce, this.data.physics.friction); }
  _dynamic(){ if (!this.body || this.body.mass === 0){ if (!this.data.physics.enabled || this.data.physics.type !== 'dynamic'){ this.data.physics.enabled = true; this.data.physics.type = 'dynamic'; this.rebuildBody(); } } return this.body; }
  push(x, y, z){ const b = this._dynamic(); if (b){ b.wakeUp(); b.applyImpulse(new CANNON.Vec3(x * b.mass, y * b.mass, z * b.mass)); } }
  pushDir(dir, v){
    const y = this.root.rotation.y, f = new THREE.Vector3(Math.sin(y), 0, Math.cos(y));
    if (dir === 'forward') this.push(f.x*v, 0, f.z*v); else if (dir === 'back') this.push(-f.x*v, 0, -f.z*v);
    else if (dir === 'up') this.push(0, v, 0); else { const s = dir === 'left' ? 1 : -1; this.push(f.z*v*s, 0, -f.x*v*s); }
  }
  jump(v){ if (this.onGround()) { const b = this._dynamic(); if (b){ b.velocity.y = 0; this.push(0, v, 0); } } }
  setVel(x, y, z){ const b = this._dynamic(); if (b){ b.wakeUp(); b.velocity.set(x, y, z); } }
  setVelAxis(a, v){ const b = this._dynamic(); if (b){ b.wakeUp(); b.velocity[a] = v; } }
  vel(a){ if (!this.body) return 0; const v = this.body.velocity; return a === 'speed' ? v.length() : v[a]; }
  onGround(){ return this.body ? this.engine.rt.grounded.has(this.body.id) : true; }
  /* sensing */
  touching(name){ return this.engine.rt.touching(this, name); }
  distanceTo(name){ const t = this.engine.find(name, this); return t ? this.root.position.distanceTo(t.root.position) : 0; }
}

/* ----------------------------- Camera controller ----------------------------- */
class CameraRig {
  constructor(engine){ this.e = engine; this.mode = 'free'; this.target = null; this.dist = 6; this.h = 3; this.off = new THREE.Vector3(); this.pitch = 0; this.yawOffset = 0; this.look = null; this.shakeAmt = 0; this.mouse = false; this.smooth = true; }
  reset(){ this.mode = 'free'; this.target = null; this.look = null; this.shakeAmt = 0; this.mouse = false; this.pitch = 0; this.e.controls.enabled = true; this.e.camera.fov = 55; this.e.camera.updateProjectionMatrix(); this._unlock(); }
  _t(name){ const o = this.e.find(name); if (o) { this.target = o; } return o; }
  follow(name, d, h){ if (this._t(name)){ this.mode = 'follow'; this.dist = d; this.h = h; this.e.controls.enabled = false; } }
  top(name, h){ if (this._t(name)){ this.mode = 'top'; this.h = h; this.e.controls.enabled = false; } }
  firstPerson(name){ if (this._t(name)){ this.mode = 'fp'; this.e.controls.enabled = false; } }
  offset(name, x, y, z){ if (this._t(name)){ this.mode = 'offset'; this.off.set(x, y, z); this.e.controls.enabled = false; } }
  setPos(x, y, z){ this.mode = 'fixed'; this.e.camera.position.set(x, y, z); this.e.controls.enabled = false; if (this.look) this.e.camera.lookAt(this.look.root.position); }
  lookAt(name){ const o = this.e.find(name); if (o){ this.look = o; if (this.mode === 'free'){ this.mode = 'fixed'; this.e.controls.enabled = false; } } }
  free(){ this.mode = 'free'; this.e.controls.target.copy(this.target ? this.target.root.position : this.e.controls.target); this.e.controls.enabled = true; }
  zoom(p){ this.e.camera.fov = clamp(55 * 100 / Math.max(1, p), 5, 150); this.e.camera.updateProjectionMatrix(); }
  shake(a){ this.shakeAmt = Math.max(this.shakeAmt, a); }
  mouseLook(on){ this.mouse = !!on; if (!on) this._unlock(); }
  _unlock(){ if (document.pointerLockElement === this.e.canvas) document.exitPointerLock(); }
  onMouseMove(dx, dy){
    if (!this.mouse || document.pointerLockElement !== this.e.canvas) return;
    if (this.target && (this.mode === 'follow' || this.mode === 'fp')) { this.target.turn(-dx * 0.15); }
    this.pitch = clamp(this.pitch + dy * 0.15, -80, 80);
  }
  update(dt){
    const cam = this.e.camera, t = this.target;
    if (this.mode !== 'free' && t && !t.root.parent) { this.free(); return; }
    const want = new THREE.Vector3(), lookAt = new THREE.Vector3();
    const k = 1 - Math.exp(-dt * 10);
    if (this.mode === 'follow' && t){
      const y = t.root.rotation.y, pr = this.pitch * D2R;
      const back = new THREE.Vector3(-Math.sin(y), 0, -Math.cos(y)).multiplyScalar(this.dist * Math.cos(pr));
      want.copy(t.root.position).add(back).add(new THREE.Vector3(0, this.h + this.dist * Math.sin(pr), 0));
      lookAt.copy(t.root.position).add(new THREE.Vector3(0, this.h * 0.35, 0));
      cam.position.lerp(want, k); cam.lookAt(lookAt);
    } else if (this.mode === 'top' && t){
      want.copy(t.root.position).add(new THREE.Vector3(0, this.h, 0.001 * this.h));
      cam.position.lerp(want, k); cam.lookAt(t.root.position);
    } else if (this.mode === 'fp' && t){
      const box = t.worldBox(); const y = t.root.rotation.y, pr = this.pitch * D2R;
      want.set(t.root.position.x, box.max.y - 0.1 * (box.max.y - box.min.y), t.root.position.z).add(new THREE.Vector3(Math.sin(y), 0, Math.cos(y)).multiplyScalar(0.3));
      cam.position.copy(want);
      lookAt.copy(want).add(new THREE.Vector3(Math.sin(y) * Math.cos(pr), -Math.sin(pr), Math.cos(y) * Math.cos(pr)));
      cam.lookAt(lookAt);
    } else if (this.mode === 'offset' && t){
      want.copy(t.root.position).add(this.off); cam.position.lerp(want, k); cam.lookAt(t.root.position);
    } else if (this.mode === 'fixed'){
      if (this.look) cam.lookAt(this.look.root.position);
    }
    if (this.shakeAmt > 0.001){ cam.position.add(new THREE.Vector3((Math.random()-0.5), (Math.random()-0.5), (Math.random()-0.5)).multiplyScalar(this.shakeAmt * 0.3)); this.shakeAmt *= Math.exp(-dt * 4); }
  }
}

/* ----------------------------- Runtime (R) ----------------------------- */
class Runtime {
  constructor(engine){
    this.e = engine; this.threads = []; this.running = false; this.time = 0; this.timerStart = 0;
    this.input = { keys: new Set(), mouseDown: false, mouseX: 0, mouseY: 0 };
    this.grounded = new Set(); this.pairs = new Set(); this.prevPairs = new Set(); this.touchPrev = new Set();
    this.synth = new Synth(); this.vars = new Map(); this.monitors = new Set(); this.cam = new CameraRig(engine);
    this.V = { get: k => this.vars.has(k) ? this.vars.get(k) : 0, set: (k, v) => { this.vars.set(k, v); this.e.hudDirty = true; },
      change: (k, v) => { this.vars.set(k, toNum(this.vars.get(k)) + v); this.e.hudDirty = true; }, show: (k, on) => { on ? this.monitors.add(k) : this.monitors.delete(k); this.e.hudDirty = true; } };
    this.bigTextEl = null;
  }
  now(){ return this.time; }
  n(v){ return toNum(v); } s(v){ return toStr(v); } b(v){ return toBool(v); }
  cmp(a, b){ const na = typeof a === 'number' ? a : (a === '' || isNaN(Number(a)) ? NaN : Number(a)), nb = typeof b === 'number' ? b : (b === '' || isNaN(Number(b)) ? NaN : Number(b));
    if (!isNaN(na) && !isNaN(nb)) return na - nb; const sa = toStr(a).toLowerCase(), sb = toStr(b).toLowerCase(); return sa < sb ? -1 : sa > sb ? 1 : 0; }
  random(a, b){ const lo = Math.min(a, b), hi = Math.max(a, b); if (Number.isInteger(lo) && Number.isInteger(hi)) return lo + Math.floor(Math.random() * (hi - lo + 1)); return lo + Math.random() * (hi - lo); }
  letter(i, s){ s = toStr(s); i = Math.floor(i); return i < 1 || i > s.length ? '' : s[i - 1]; }
  mod(a, b){ if (b === 0) return NaN; let r = a % b; if (r !== 0 && (r < 0) !== (b < 0)) r += b; return r; }
  mathOp(f, v){ switch (f){ case 'abs': return Math.abs(v); case 'floor': return Math.floor(v); case 'ceil': return Math.ceil(v); case 'sqrt': return Math.sqrt(v); case 'sin': return Math.round(Math.sin(v*D2R)*1e10)/1e10; case 'cos': return Math.round(Math.cos(v*D2R)*1e10)/1e10; case 'tan': return Math.tan(v*D2R); case 'log': return Math.log(v); case 'exp': return Math.exp(v); case 'pow10': return Math.pow(10, v); } return 0; }
  *wait(secs){ const t0 = this.time; while (this.time - t0 < secs) yield; }
  timer(){ return Math.round((this.time - this.timerStart) * 1000) / 1000; }
  resetTimer(){ this.timerStart = this.time; }
  key(k){ if (k === 'any') return this.input.keys.size > 0; return this.input.keys.has(k); }
  sound(n){ this.synth.play(n); }
  *note(n, beats){ const secs = beats * 0.5; this.synth.note(n, secs); yield* this.wait(secs); }
  volume(v){ this.synth.volume = clamp(v, 0, 100) / 100; }
  setGravity(g){ this.e.world.gravity.set(0, -g, 0); }
  exists(name){ return !!this.e.find(name); }
  count(name){ return this.e.objects.filter(o => o.name === name).length; }
  propOf(name, p){ const o = this.e.find(name); if (!o) return 0; switch (p){ case 'x': return o.root.position.x; case 'y': return o.root.position.y; case 'z': return o.root.position.z; case 'dir': return o.dir(); case 'size': return o.size(); } return 0; }
  *bigText(text, secs){ this.e.showBigText(toStr(text)); yield* this.wait(secs); this.e.showBigText(''); }
  /* threads */
  start(obj, script, restart=true){
    const existing = this.threads.find(t => t.obj === obj && t.script === script && !t.done);
    if (existing){ if (!restart) return existing; existing.done = true; }
    const t = { obj, script, done: false, it: null };
    try { t.it = script.fn(obj, this, this.V, t); } catch (e) { console.error(e); t.done = true; }
    this.threads.push(t); return t;
  }
  stopAll(){ for (const t of this.threads) t.done = true; this._stopAllFlag = true; }
  stopOthers(obj, self){ for (const t of this.threads) if (t.obj === obj && t !== self) t.done = true; }
  startHats(kind, filter, restart=true){
    const started = [];
    for (const o of this.e.objects.slice()) for (const s of (o.scripts || [])) if (s.hat === kind && (!filter || filter(s, o))) started.push(this.start(o, s, restart));
    return started;
  }
  broadcast(msg){ msg = toStr(msg).toLowerCase(); return this.startHats('broadcast', s => s.msg === msg, true); }
  *broadcastWait(msg){ const ts = this.broadcast(msg); while (ts.some(t => !t.done)) yield; }
  clone(self, target){
    const src = target === '__self__' ? self : this.e.find(target);
    if (!src || this.e.objects.length > 400) return;
    const c = this.e.cloneObject(src);
    for (const s of c.scripts) if (s.hat === 'clone') this.start(c, s);
  }
  deleteClone(o){ if (o.isClone) this.e.removeObject(o); }
  deleteObject(o){ this.e.removeObject(o); }
  step(){
    // key hats: run while the key is held (restart when the script finishes)
    if (this.input.keys.size) this.startHats('key', s => this.key(s.key), false);
    for (let i = 0; i < this.threads.length; i++){
      const t = this.threads[i]; if (t.done) continue;
      try { const r = t.it.next(); if (r.done) t.done = true; } catch (e) { console.error('Script error in ' + t.obj.name + ':', e); this.e.reportError(t.obj.name + ': ' + e.message); t.done = true; }
      if (this._stopAllFlag) break;
    }
    this._stopAllFlag = false;
    if (this.threads.length > 64 || this.threads.some(t => t.done)) this.threads = this.threads.filter(t => !t.done);
  }
  /* contacts */
  updateContacts(){
    const g = this.grounded; g.clear(); this.prevPairs = this.pairs; const pairs = this.pairs = new Set();
    for (const c of this.e.world.contacts){
      const a = c.bi, b = c.bj;
      if (c.ni.y < -0.5) g.add(a.id); if (c.ni.y > 0.5) g.add(b.id);
      pairs.add(a.id < b.id ? a.id + '|' + b.id : b.id + '|' + a.id);
    }
  }
  bodiesTouch(a, b){ return this.pairs.has(a.id < b.id ? a.id + '|' + b.id : b.id + '|' + a.id); }
  _box1 = new THREE.Box3(); _box2 = new THREE.Box3();
  touchingObj(a, b){
    if (a === b || !a.root.visible || !b.root.visible) return false;
    if (a.body && b.body && a.body.world && b.body.world) return this.bodiesTouch(a.body, b.body);
    a.worldBox(this._box1); b.worldBox(this._box2); this._box1.expandByScalar(0.02);
    return this._box1.intersectsBox(this._box2);
  }
  touching(self, name){
    for (const o of this.e.objects){ if (o === self) continue; if (name !== '__any__' && o.name !== name) continue; if (this.touchingObj(self, o)) return true; }
    return false;
  }
  fireTouchHats(){
    const nowSet = new Set();
    for (const o of this.e.objects){
      if (!o.scripts) continue;
      for (const s of o.scripts){
        if (s.hat !== 'touch') continue;
        for (const t of this.e.objects){
          if (t === o || (s.target !== '__any__' && t.name !== s.target)) continue;
          if (!this.touchingObj(o, t)) continue;
          const key = o.id + '>' + t.id + '>' + s.id;
          nowSet.add(key);
          if (!this.touchPrev.has(key)) this.start(o, s, false);
        }
      }
    }
    this.touchPrev = nowSet;
  }
}

/* ----------------------------- Engine ----------------------------- */
export class Engine {
  constructor({ canvas, hud, editor = true }){
    this.canvas = canvas; this.hud = hud; this.editor = editor;
    this.renderer = new THREE.WebGLRenderer({ canvas, antialias: true, powerPreference: 'high-performance' });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    this.renderer.shadowMap.enabled = true; this.renderer.shadowMap.type = THREE.PCFShadowMap;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping; this.renderer.toneMappingExposure = 1.0;
    this.scene = new THREE.Scene();
    this.camera = new THREE.PerspectiveCamera(55, 1, 0.1, 500);
    this.camera.position.set(9, 6, 11);
    this.controls = new OrbitControls(this.camera, canvas);
    this.controls.enableDamping = true; this.controls.dampingFactor = 0.12; this.controls.target.set(0, 1, 0); this.controls.maxPolarAngle = Math.PI * 0.495;
    this.controls.mouseButtons = { LEFT: THREE.MOUSE.ROTATE, MIDDLE: THREE.MOUSE.DOLLY, RIGHT: THREE.MOUSE.PAN };
    // lights
    this.hemi = new THREE.HemisphereLight(0xbfe3ff, 0x6a7a4a, 0.75); this.scene.add(this.hemi);
    this.sun = new THREE.DirectionalLight(0xfff4e0, 2.4); this.sun.position.set(20, 35, 15); this.sun.castShadow = true;
    const sc = this.sun.shadow.camera; sc.left = -30; sc.right = 30; sc.top = 30; sc.bottom = -30; sc.near = 1; sc.far = 150;
    this.sun.shadow.mapSize.set(2048, 2048); this.sun.shadow.bias = -0.0006; this.sun.shadow.normalBias = 0.03; this.sun.shadow.radius = 3;
    this.scene.add(this.sun); this.scene.add(this.sun.target);
    // editor helpers
    this.grid = new THREE.GridHelper(60, 60, 0x666666, 0xbbbbbb); this.grid.position.y = 0.002; this.grid.material.transparent = true; this.grid.material.opacity = 0.35; this.scene.add(this.grid);
    // physics
    this.world = new CANNON.World({ gravity: new CANNON.Vec3(0, -9.8, 0) });
    this.world.broadphase = new CANNON.SAPBroadphase(this.world); this.world.allowSleep = false;
    this.world.solver.iterations = 10; this.world.defaultContactMaterial.friction = 0.4; this.world.defaultContactMaterial.restitution = 0.3;
    this._materials = new Map();
    this.physicsActive = false;   // bodies only exist while playing
    this.objects = []; this.byId = new Map();
    this.project = defaultProject();
    this.rt = new Runtime(this);
    this.playing = false; this.hudDirty = false; this._snapshot = null; this.onError = null; this.onPlayState = null;
    this.clock = new THREE.Clock(); this.fps = 0; this._fpsN = 0; this._fpsT = 0;
    this.raycaster = new THREE.Raycaster();
    this._bindInput();
    this.resize();
    this._loop = this._loop.bind(this); requestAnimationFrame(this._loop);
  }
  /* ---------- setup / project ---------- */
  applyStage(){
    const s = this.project.stage;
    const sky = new THREE.Color().setStyle(s.sky || '#8fd3ff');
    this.scene.background = sky;
    this.scene.fog = s.fog === false ? null : new THREE.Fog(sky, 70, 220);
    this.hemi.color.copy(sky).lerp(new THREE.Color(0xffffff), 0.5);
    this.sun.intensity = 2.4 * (s.sun == null ? 1 : s.sun);
    this.world.gravity.set(0, -(s.gravity == null ? 9.8 : s.gravity), 0);
  }
  async loadProject(p){
    this.stop(); this.clear();
    this.project = Object.assign(defaultProject(), p);
    this.project.stage = Object.assign(defaultProject().stage, p.stage || {});
    this.applyStage();
    if (p.camera){ this.camera.position.fromArray(p.camera.position); this.controls.target.fromArray(p.camera.target); this.controls.update(); }
    await Promise.all((this.project.objects || []).map(d => this.addObject(d, false)));
  }
  clear(){ for (const o of this.objects.slice()) this.removeObject(o, false); this.objects = []; this.byId.clear(); }
  async addObject(data, register=true){
    if (register && !this.project.objects.includes(data)) this.project.objects.push(data);
    const o = new SceneObject(this, data);
    this.objects.push(o); this.byId.set(o.id, o); this.scene.add(o.root);
    await o.build();
    return o;
  }
  removeObject(o, unregister=true){
    o.dispose();
    const i = this.objects.indexOf(o); if (i >= 0) this.objects.splice(i, 1);
    this.byId.delete(o.id);
    if (unregister && !o.isClone){ const j = this.project.objects.indexOf(o.data); if (j >= 0) this.project.objects.splice(j, 1); }
  }
  cloneObject(src){
    const data = JSON.parse(JSON.stringify(src.data)); data.id = newId();
    data.position = src.root.position.toArray(); data.rotation = [src.root.rotation.x*R2D, src.root.rotation.y*R2D, src.root.rotation.z*R2D]; data.scale = src.root.scale.toArray();
    const c = new SceneObject(this, data, true); c.original = src.original; c.scripts = src.scripts; c.sizePct = src.sizePct; c.baseScale = src.baseScale;
    this.objects.push(c); this.byId.set(c.id, c); this.scene.add(c.root);
    // synchronous build for models: reuse the already-loaded prototype
    c.localBox.copy(src.localBox); c.clips = src.clips;
    if (src.data.kind === 'model' && src.mesh && src.mesh.isGroup){
      const mesh = SkeletonUtils.clone(src.mesh); c.materials = [];
      mesh.traverse(m => { if (m.isMesh){ m.castShadow = m.receiveShadow = true; m.frustumCulled = !m.isSkinnedMesh; m.material = Array.isArray(m.material) ? m.material.map(x => x.clone()) : m.material.clone(); (Array.isArray(m.material) ? m.material : [m.material]).forEach(x => c.materials.push(x)); } });
      c.root.add(mesh); c.mesh = mesh;
      if (c.clips.length){ c.mixer = new THREE.AnimationMixer(mesh); for (const cl of c.clips) c.actions[cl.name] = c.mixer.clipAction(cl); }
    } else { const m = c._primitive(src.data.kind === 'model' ? 'box' : src.data.kind); c.root.add(m); c.mesh = m; c.materials = [m.material]; }
    c.ready = true; c.applyProps(); c.rebuildBody();
    return c;
  }
  find(name, self){ if (name === '__self__') return self; for (const o of this.objects) if (o.name === name && !o.isClone) return o; for (const o of this.objects) if (o.name === name) return o; return null; }
  physMaterial(bounce, friction){
    const b = Math.round(clamp(toNum(bounce), 0, 1.5) * 10) / 10, f = Math.round(clamp(toNum(friction), 0, 2) * 10) / 10, key = b + '_' + f;
    if (this._materials.has(key)) return this._materials.get(key);
    const m = new CANNON.Material(key); m.userData = { b, f };
    for (const other of this._materials.values()) this.world.addContactMaterial(new CANNON.ContactMaterial(m, other, { friction: (f + other.userData.f) / 2, restitution: Math.max(b, other.userData.b) }));
    this.world.addContactMaterial(new CANNON.ContactMaterial(m, m, { friction: f, restitution: b }));
    this._materials.set(key, m); return m;
  }
  /* ---------- play / stop ---------- */
  play(scriptsById){
    if (this.playing) this.stop();
    this._snapshot = { camera: { position: this.camera.position.toArray(), target: this.controls.target.toArray() },
      objects: this.objects.map(o => ({ o, data: JSON.parse(JSON.stringify(o.data)) })) };
    const rt = this.rt; rt.threads = []; rt.time = 0; rt.timerStart = 0; rt.vars.clear(); rt.monitors.clear(); rt.touchPrev.clear(); rt.pairs.clear();
    for (const v of this.project.variables || []) rt.vars.set(v.name || v, 0);
    this.stageObj = { id: 'stage', name: 'Stage', scripts: scriptsById.stage || [], root: new THREE.Group(), isStage: true,
      pos(){ return this.root.position; }, dir(){ return 0; }, size(){ return 100; } };
    for (const k of ['forward','turn','setDir','goTo','goToObj','changeAxis','setAxis','setRot','tilt','moveDir','pointTowards','setVisible','setColor','setSize','setOpacity','setMaterial','say','playAnim','stopAnim','animSpeed','physicsOn','physicsType','setMass','setBounce','setFriction','push','pushDir','jump','setVel','setVelAxis']) this.stageObj[k] = () => {};
    for (const k of ['glide','glideObj','sayFor','playAnimOnce']) this.stageObj[k] = function*(){};
    this.stageObj.vel = () => 0; this.stageObj.onGround = () => false; this.stageObj.touching = () => false; this.stageObj.distanceTo = () => 0;
    this.physicsActive = true;
    for (const o of this.objects){ o.scripts = scriptsById[o.id] || []; o.sizePct = 100; o.baseScale = o.data.scale.slice(); o.applyProps(); o.rebuildBody(); }
    this.grid.visible = false; this.playing = true; this.hudDirty = true;
    rt.cam.reset(); rt.synth.ensure();
    this.showBigText('');
    for (const s of this.stageObj.scripts) if (s.hat === 'flag') rt.start(this.stageObj, s);
    rt.startHats('flag');
    if (this.onPlayState) this.onPlayState(true);
  }
  stop(){
    if (!this.playing) return;
    this.playing = false; this.physicsActive = false;
    this.rt.threads = []; this.rt.cam.reset(); this.rt.input.keys.clear();
    for (const o of this.objects.slice()) if (o.isClone) this.removeObject(o);
    for (const o of this.objects){ if (o.body){ this.world.removeBody(o.body); o.body = null; } o.stopAnim(); this.setLabel(o, ''); }
    if (this._snapshot){
      for (const { o, data } of this._snapshot.objects) if (this.objects.includes(o)) { Object.assign(o.data, data); o.applyProps(); }
      this.camera.position.fromArray(this._snapshot.camera.position); this.controls.target.fromArray(this._snapshot.camera.target); this.controls.update();
      this._snapshot = null;
    }
    this.grid.visible = this.editor; this.showBigText(''); this.hudDirty = true; this.applyStage();
    if (this.onPlayState) this.onPlayState(false);
  }
  reportError(msg){ if (this.onError) this.onError(msg); }
  /* ---------- HUD ---------- */
  showBigText(t){ if (!this.hud) return; let el = this.hud.querySelector('.bw-bigtext'); if (!el){ el = document.createElement('div'); el.className = 'bw-bigtext'; this.hud.appendChild(el); } el.textContent = t; el.style.display = t ? '' : 'none'; }
  renderHud(){
    if (!this.hud) return;
    let box = this.hud.querySelector('.bw-monitors'); if (!box){ box = document.createElement('div'); box.className = 'bw-monitors'; this.hud.appendChild(box); }
    box.innerHTML = '';
    for (const k of this.rt.monitors){ const d = document.createElement('div'); d.className = 'bw-monitor'; d.innerHTML = '<span class="k"></span><span class="v"></span>'; d.querySelector('.k').textContent = k; d.querySelector('.v').textContent = toStr(this.rt.vars.get(k) ?? 0); box.appendChild(d); }
    this.hudDirty = false;
  }
  setLabel(o, text){
    if (o.label){ o.root.remove(o.label); o.label.material.map.dispose(); o.label.material.dispose(); o.label = null; }
    if (!text) return;
    const c = document.createElement('canvas'); const ctx = c.getContext('2d'); ctx.font = 'bold 40px Helvetica, Arial, sans-serif';
    const w = Math.min(900, ctx.measureText(text).width + 50); c.width = Math.ceil(w); c.height = 84;
    ctx.font = 'bold 40px Helvetica, Arial, sans-serif'; ctx.fillStyle = 'rgba(255,255,255,0.95)';
    const r = 24; ctx.beginPath(); ctx.roundRect(4, 4, c.width - 8, 68, r); ctx.fill(); ctx.strokeStyle = '#575e75'; ctx.lineWidth = 3; ctx.stroke();
    ctx.fillStyle = '#222'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText(text, c.width / 2, 40, c.width - 30);
    const tex = new THREE.CanvasTexture(c); tex.colorSpace = THREE.SRGBColorSpace;
    const sp = new THREE.Sprite(new THREE.SpriteMaterial({ map: tex, depthTest: false, transparent: true }));
    const h = 0.6, sz = new THREE.Vector3(); o.localBox.getSize(sz);
    sp.scale.set(h * c.width / c.height / o.root.scale.x, h / o.root.scale.y, 1);
    sp.position.set(0, o.localBox.max.y + 0.5 / o.root.scale.y, 0); sp.renderOrder = 999; sp.userData.text = text;
    o.root.add(sp); o.label = sp;
  }
  /* ---------- input ---------- */
  _bindInput(){
    const keyName = e => { const k = e.key; const map = { ' ': 'space', ArrowUp: 'up arrow', ArrowDown: 'down arrow', ArrowLeft: 'left arrow', ArrowRight: 'right arrow', Enter: 'enter', Shift: 'shift' }; return map[k] || (k.length === 1 ? k.toLowerCase() : null); };
    window.addEventListener('keydown', e => {
      if (!this.playing) return; if (e.target && /INPUT|TEXTAREA/.test(e.target.tagName)) return;
      const k = keyName(e); if (k){ this.rt.input.keys.add(k); if (/arrow|space/.test(k)) e.preventDefault(); }
    });
    window.addEventListener('keyup', e => { const k = keyName(e); if (k) this.rt.input.keys.delete(k); });
    window.addEventListener('blur', () => this.rt.input.keys.clear());
    const c = this.canvas;
    c.addEventListener('pointerdown', e => {
      if (!this.playing) return;
      this.rt.input.mouseDown = true;
      if (this.rt.cam.mouse && document.pointerLockElement !== c) c.requestPointerLock();
      const o = this.pick(e.clientX, e.clientY);
      if (o) for (const s of (o.scripts || [])) if (s.hat === 'click') this.rt.start(o, s);
    });
    window.addEventListener('pointerup', () => { this.rt.input.mouseDown = false; });
    c.addEventListener('pointermove', e => {
      const r = c.getBoundingClientRect();
      this.rt.input.mouseX = Math.round(((e.clientX - r.left) / r.width - 0.5) * 480 * 2) / 2; this.rt.input.mouseY = Math.round((0.5 - (e.clientY - r.top) / r.height) * 360 * 2) / 2;
      if (this.playing) this.rt.cam.onMouseMove(e.movementX, e.movementY);
    });
  }
  ndc(cx, cy){ const r = this.canvas.getBoundingClientRect(); return new THREE.Vector2(((cx - r.left) / r.width) * 2 - 1, -((cy - r.top) / r.height) * 2 + 1); }
  pick(cx, cy){
    this.raycaster.setFromCamera(this.ndc(cx, cy), this.camera);
    const hits = this.raycaster.intersectObjects(this.objects.filter(o => o.root.visible).map(o => o.root), true);
    for (const h of hits){ let n = h.object; while (n && !n.userData.obj) n = n.parent; if (n && n.userData.obj && !(h.object.isSprite)) return n.userData.obj; }
    return null;
  }
  pickPoint(cx, cy){ this.raycaster.setFromCamera(this.ndc(cx, cy), this.camera); const p = new THREE.Vector3(); return this.raycaster.ray.intersectPlane(new THREE.Plane(new THREE.Vector3(0,1,0), 0), p) ? p : null; }
  /* ---------- frame loop ---------- */
  resize(){
    const c = this.canvas, w = c.clientWidth || 1, h = c.clientHeight || 1;
    if (c.width !== Math.floor(w * this.renderer.getPixelRatio()) || c.height !== Math.floor(h * this.renderer.getPixelRatio())){
      this.renderer.setSize(w, h, false); this.camera.aspect = w / h; this.camera.updateProjectionMatrix();
    }
  }
  _loop(){
    requestAnimationFrame(this._loop);
    this.resize();
    const dt = Math.min(0.05, this.clock.getDelta());
    if (this.playing){
      this.rt.time += dt;
      this.rt.step();
      this.world.step(1 / 60, dt, 4);
      this.rt.updateContacts();
      for (const o of this.objects){ if (o.body) o.syncFromBody(); if (o.mixer) o.mixer.update(dt); }
      this.scene.updateMatrixWorld();
      this.rt.fireTouchHats();
      this.rt.cam.update(dt);
      if (this.hudDirty) this.renderHud();
    }
    if (this.controls.enabled) this.controls.update();
    // keep the shadow frustum around what the camera looks at
    const focus = this.rt.cam.target && this.playing ? this.rt.cam.target.root.position : this.controls.target;
    this.sun.target.position.copy(focus); this.sun.position.copy(focus).add(new THREE.Vector3(20, 35, 15));
    this.renderer.render(this.scene, this.camera);
    this._fpsN++; this._fpsT += dt; if (this._fpsT >= 0.5){ this.fps = Math.round(this._fpsN / this._fpsT); this._fpsN = 0; this._fpsT = 0; }
  }
}
