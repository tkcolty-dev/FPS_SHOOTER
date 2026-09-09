/* ============================================================
   BlockWorld 3D — engine
   Three.js renderer (shadows, time-of-day sky, particles) +
   cannon-es physics (boxes, spheres, cylinders, heightfield terrain) +
   a Scratch-style green-thread runtime for compiled block scripts.
   Used by both the editor (app.js) and exported games (player.js).
   ============================================================ */
import * as THREE from 'three';
import * as CANNON from 'cannon-es';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { OBJLoader } from 'three/addons/loaders/OBJLoader.js';
import { FBXLoader } from 'three/addons/loaders/FBXLoader.js';
import { DRACOLoader } from 'three/addons/loaders/DRACOLoader.js';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import * as SkeletonUtils from 'three/addons/utils/SkeletonUtils.js';
import { getTexture, TEXTURE_PROPS } from './textures.js';

export const KINDS = ['box','sphere','cylinder','cone','capsule','torus','plane','wedge','model','light','spot','text','terrain'];
const D2R = Math.PI / 180, R2D = 180 / Math.PI;
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
let nextId = 1;
export const newId = () => 'o' + (Date.now().toString(36)) + (nextId++).toString(36);

/* Scratch-style casting */
export const toNum = v => { if (typeof v === 'number') return isNaN(v) ? 0 : v; if (typeof v === 'boolean') return v ? 1 : 0; const n = parseFloat(v); return isNaN(n) ? 0 : n; };
export const toStr = v => v == null ? '' : (typeof v === 'number' && !Number.isInteger(v) ? String(Math.round(v * 1e4) / 1e4) : String(v));
export const toBool = v => v === true || v === 'true' || (typeof v === 'number' && v !== 0 && !isNaN(v)) || (typeof v === 'string' && v !== '' && v !== 'false' && v !== '0' && !(isNaN(parseFloat(v)) === false && parseFloat(v) === 0));

/* Default data for a new object */
export function defaultObject(kind, name){
  const model = kind === 'model', isLight = kind === 'light' || kind === 'spot', noPhys = isLight || kind === 'text';
  return {
    id: newId(), name: name || kind, kind, modelUrl: '',
    position: [0, 0.5, 0], rotation: [0, 0, 0], scale: [1, 1, 1],
    color: model || isLight ? '' : '#4c97ff', material: 'normal', opacity: 0, texture: '', visible: true, collide: true,
    physics: { enabled: !noPhys, type: (kind === 'plane' || kind === 'terrain') ? 'static' : 'dynamic', mass: 1, bounce: 0.3, friction: 0.4, upright: model || kind === 'capsule' },
    light: isLight ? { color: '#fff1c8', intensity: kind === 'spot' ? 40 : 12, distance: 18, angle: 35, shadow: false } : null,
    text: kind === 'text' ? { content: 'Hello!', size: 0.8, color: '#ffffff', bg: '' } : null,
    terrain: kind === 'terrain' ? { size: 60, height: 4, seed: 7, detail: 64, texture: 'grass' } : null,
    workspace: null
  };
}
export function defaultProject(){
  return {
    version: 2, name: 'My Game',
    stage: { style: 'auto', time: 12, sky: '#8fd3ff', gravity: 9.8, sun: 1.0, fog: true, ambient: 1.0, workspace: null },
    variables: [], lists: [], sounds: [], ui: [], groups: [],
    objects: [],
    camera: { position: [9, 6, 11], target: [0, 1, 0] }
  };
}

/* ----------------------------- Sound ----------------------------- */
class Synth {
  constructor(){ this.ctx = null; this.volume = 1; this._last = {}; this.files = new Map(); this.playing = new Set(); }
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
    const t = performance.now(); if (t - (this._last[name] || 0) < 90) return; this._last[name] = t;   // a held key must not machine-gun a sound
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
      case 'click': this.tone(1500, 0.03, 'square', 0.1); break;
      case 'whoosh': this.noise(0.25, 0.2); break;
      case 'splash': this.noise(0.35, 0.3); this.tone(200, 0.3, 'sine', 0.2, 300); break;
    }
  }
  note(n, secs){ this.tone(440 * Math.pow(2, (toNum(n) - 69) / 12), secs, 'triangle', 0.25); }
  file(url, loop=false){
    if (!url) return null;
    const a = new Audio(url); a.volume = this.volume; a.loop = loop; a.play().catch(() => {}); this.playing.add(a); a.onended = () => this.playing.delete(a); return a;
  }
  stopAll(){ for (const a of this.playing){ a.pause(); } this.playing.clear(); }
}

/* ----------------------------- Model cache ----------------------------- */
const gltfLoader = new GLTFLoader();
const objLoader = new OBJLoader();
const fbxLoader = new FBXLoader();
const draco = new DRACOLoader();
if (typeof window !== 'undefined' && window.__DRACO_JS__){ draco.setDecoderConfig({ type: 'js' }); draco._loadLibrary = () => Promise.resolve(window.__DRACO_JS__); }
else draco.setDecoderPath('vendor/three/jsm/libs/draco/gltf/');
gltfLoader.setDRACOLoader(draco);
const modelCache = new Map();
export function loadModel(url){
  if (!modelCache.has(url)){
    const clean = url.split('?')[0];
    const p = (/\.obj$/i.test(clean) ? objLoader.loadAsync(url).then(g => ({ scene: g, animations: [] })) : /\.fbx$/i.test(clean) ? fbxLoader.loadAsync(url).then(g => ({ scene: g, animations: g.animations || [] })) : gltfLoader.loadAsync(url))
      .then(g => {
        const root = g.scene || g.scenes[0];
        root.updateMatrixWorld(true);
        const box = new THREE.Box3().setFromObject(root);
        const size = new THREE.Vector3(); box.getSize(size);
        const center = new THREE.Vector3(); box.getCenter(center);
        const s = 1 / (Math.max(size.x, size.y, size.z) || 1);
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

/* ----------------------------- Terrain noise ----------------------------- */
function makeNoise(seed){
  const perm = new Uint8Array(512); let s = seed * 9301 + 49297;
  const rnd = () => (s = (s * 1664525 + 1013904223) >>> 0) / 4294967296;
  const p = []; for (let i = 0; i < 256; i++) p[i] = i; for (let i = 255; i > 0; i--){ const j = Math.floor(rnd() * (i + 1)); [p[i], p[j]] = [p[j], p[i]]; }
  for (let i = 0; i < 512; i++) perm[i] = p[i & 255];
  const fade = t => t * t * t * (t * (t * 6 - 15) + 10), lerp = (a, b, t) => a + (b - a) * t;
  const grad = (h, x, y) => { switch (h & 3){ case 0: return x + y; case 1: return -x + y; case 2: return x - y; default: return -x - y; } };
  const n2 = (x, y) => { const X = Math.floor(x) & 255, Y = Math.floor(y) & 255; x -= Math.floor(x); y -= Math.floor(y); const u = fade(x), v = fade(y);
    const a = perm[X] + Y, b = perm[X + 1] + Y;
    return lerp(lerp(grad(perm[a], x, y), grad(perm[b], x - 1, y), u), lerp(grad(perm[a + 1], x, y - 1), grad(perm[b + 1], x - 1, y - 1), u), v); };
  return (x, y) => { let v = 0, amp = 1, f = 1, norm = 0; for (let o = 0; o < 4; o++){ v += n2(x * f, y * f) * amp; norm += amp; amp *= 0.5; f *= 2.1; } return v / norm; };
}

/* ----------------------------- Sky ----------------------------- */
class Sky {
  constructor(scene){
    this.scene = scene;
    const geo = new THREE.SphereGeometry(420, 32, 16);
    this.uniforms = { topColor: { value: new THREE.Color(0x3d8fe8) }, bottomColor: { value: new THREE.Color(0xcfe9ff) }, offset: { value: 20 }, exponent: { value: 0.7 } };
    const mat = new THREE.ShaderMaterial({ uniforms: this.uniforms, side: THREE.BackSide, depthWrite: false, fog: false,
      vertexShader: 'varying vec3 vW; void main(){ vec4 w = modelMatrix * vec4(position,1.0); vW = w.xyz; gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }',
      fragmentShader: 'uniform vec3 topColor; uniform vec3 bottomColor; uniform float offset; uniform float exponent; varying vec3 vW; void main(){ float h = normalize(vW + vec3(0.0, offset, 0.0)).y; gl_FragColor = vec4(mix(bottomColor, topColor, max(pow(max(h, 0.0), exponent), 0.0)), 1.0); }' });
    this.dome = new THREE.Mesh(geo, mat); this.dome.renderOrder = -10; this.dome.frustumCulled = false; scene.add(this.dome);
    this.sunDisc = new THREE.Mesh(new THREE.SphereGeometry(9, 16, 12), new THREE.MeshBasicMaterial({ color: 0xfff6d5, fog: false })); scene.add(this.sunDisc);
    const pts = []; for (let i = 0; i < 1600; i++){ const v = new THREE.Vector3().randomDirection(); if (v.y < -0.05) v.y = -v.y; pts.push(v.multiplyScalar(400)); }
    this.stars = new THREE.Points(new THREE.BufferGeometry().setFromPoints(pts), new THREE.PointsMaterial({ color: 0xffffff, size: 1.6, sizeAttenuation: false, transparent: true, opacity: 0, fog: false })); scene.add(this.stars);
  }
  setVisible(v){ this.dome.visible = v; this.sunDisc.visible = v; this.stars.visible = v; }
  // t = hour of day 0..24 → returns { sunDir, sunColor, sunIntensity, horizon, top, night }
  apply(style, hour, custom){
    const c = (a, b, k) => new THREE.Color(a).lerp(new THREE.Color(b), clamp(k, 0, 1));
    const elev = Math.sin((hour - 6) / 12 * Math.PI);          // 1 at noon, -1 at midnight
    const az = (hour - 12) / 12 * Math.PI;                      // east → west
    const sunDir = new THREE.Vector3(Math.sin(az) * Math.cos(elev * 1.2), Math.max(0.03, elev), Math.cos(az) * 0.5 - 0.3).normalize();
    let top, horizon, night = 0, sunColor = new THREE.Color(0xfff4e0), intensity;
    if (style === 'space'){ top = new THREE.Color(0x02030a); horizon = new THREE.Color(0x0a0d22); night = 1; intensity = 2.2; sunColor = new THREE.Color(0xffffff); }
    else if (style === 'custom'){ top = new THREE.Color(custom); horizon = new THREE.Color(custom).lerp(new THREE.Color(0xffffff), 0.45); intensity = 2.4; }
    else {
      const day = clamp(elev * 1.6, 0, 1), dusk = clamp(1 - Math.abs(elev) * 3.5, 0, 1); night = clamp(-elev * 2.2, 0, 1);
      top = c('#0b1026', '#3d8fe8', day).lerp(new THREE.Color('#5a4a9a'), dusk * 0.5);
      horizon = c('#141a38', '#cfe9ff', day).lerp(new THREE.Color('#ff9a5c'), dusk * 0.9);
      sunColor = c('#ff8a3c', '#fff4e0', clamp(elev * 2.5, 0, 1));
      intensity = clamp(elev * 2.6, 0, 2.4) + 0.06;
    }
    this.uniforms.topColor.value.copy(top); this.uniforms.bottomColor.value.copy(horizon);
    this.sunDisc.position.copy(sunDir).multiplyScalar(395); this.sunDisc.visible = style !== 'custom' && (elev > -0.05 || style === 'space');
    this.stars.material.opacity = night * 0.9;
    return { sunDir, sunColor, intensity, horizon, top, night };
  }
}

/* ----------------------------- Particles ----------------------------- */
class Particles {
  constructor(scene, max=4000){
    this.max = max; this.n = 0;
    this.pos = new Float32Array(max * 3); this.vel = new Float32Array(max * 3); this.col = new Float32Array(max * 3); this.age = new Float32Array(max); this.life = new Float32Array(max); this.size = new Float32Array(max);
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.BufferAttribute(this.pos, 3)); g.setAttribute('color', new THREE.BufferAttribute(this.col, 3));
    g.setAttribute('aAge', new THREE.BufferAttribute(this.age, 1)); g.setAttribute('aSize', new THREE.BufferAttribute(this.size, 1));
    const m = new THREE.ShaderMaterial({ transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, vertexColors: true,
      vertexShader: 'attribute float aAge; attribute float aSize; varying vec3 vC; varying float vA; void main(){ vC = color; vA = 1.0 - aAge; vec4 mv = modelViewMatrix * vec4(position,1.0); gl_PointSize = aSize * (1.0 - aAge*0.6) * (280.0 / max(1.0, -mv.z)); gl_Position = projectionMatrix * mv; }',
      fragmentShader: 'varying vec3 vC; varying float vA; void main(){ float d = length(gl_PointCoord - 0.5); if (d > 0.5) discard; gl_FragColor = vec4(vC, vA * (1.0 - d*1.6)); }' });
    this.points = new THREE.Points(g, m); this.points.frustumCulled = false; this.points.visible = false; scene.add(this.points);
    g.setDrawRange(0, 0);
  }
  burst(p, color, count, speed, size=1.2, gravity=true){
    const c = new THREE.Color(color);
    for (let k = 0; k < count; k++){
      const i = this.n < this.max ? this.n++ : Math.floor(Math.random() * this.max);
      const d = new THREE.Vector3().randomDirection().multiplyScalar(speed * (0.4 + Math.random() * 0.8));
      this.pos.set([p.x, p.y, p.z], i * 3); this.vel.set([d.x, d.y + speed * 0.3, d.z], i * 3);
      this.col.set([c.r, c.g, c.b], i * 3); this.age[i] = 0; this.life[i] = 0.5 + Math.random() * 0.8; this.size[i] = size * (10 + Math.random() * 10); this.grav = gravity;
    }
  }
  update(dt){
    if (!this.n){ this.points.visible = false; return; }
    let alive = 0;
    for (let i = 0; i < this.n; i++){
      this.age[i] += dt / this.life[i];
      if (this.age[i] >= 1){ // compact: swap with last
        const j = --this.n; if (i !== j){ for (let k = 0; k < 3; k++){ this.pos[i*3+k] = this.pos[j*3+k]; this.vel[i*3+k] = this.vel[j*3+k]; this.col[i*3+k] = this.col[j*3+k]; } this.age[i] = this.age[j]; this.life[i] = this.life[j]; this.size[i] = this.size[j]; i--; }
        continue;
      }
      if (this.grav !== false) this.vel[i*3+1] -= 7 * dt;
      this.pos[i*3] += this.vel[i*3] * dt; this.pos[i*3+1] += this.vel[i*3+1] * dt; this.pos[i*3+2] += this.vel[i*3+2] * dt;
      alive++;
    }
    const g = this.points.geometry; g.setDrawRange(0, this.n); this.points.visible = this.n > 0;
    for (const a of ['position','color','aAge','aSize']) g.attributes[a].needsUpdate = true;
  }
  clear(){ this.n = 0; this.points.geometry.setDrawRange(0, 0); this.points.visible = false; }
}

/* ----------------------------- Scene object ----------------------------- */
export class SceneObject {
  constructor(engine, data, isClone=false){
    this.engine = engine; this.data = data; this.id = data.id; this.name = data.name;
    this.isClone = isClone; this.original = this;
    this.root = new THREE.Group(); this.root.userData.obj = this;
    this.body = null; this.mixer = null; this.clips = []; this.actions = {}; this.currentAction = null;
    this.localBox = new THREE.Box3(new THREE.Vector3(-0.5,-0.5,-0.5), new THREE.Vector3(0.5,0.5,0.5));
    this.ready = false; this.sizePct = 100; this.label = null; this.light = null; this.textSprite = null;
    this._tmp = new THREE.Vector3(); this.materials = []; this.procs = {};
  }
  get kind(){ return this.data.kind; }
  get isLight(){ return this.data.kind === 'light' || this.data.kind === 'spot'; }
  async build(){
    const d = this.data;
    while (this.root.children.length) this.root.remove(this.root.children[0]);
    this.light = null; this.textSprite = null; this.mixer = null; this.clips = []; this.actions = {};
    let mesh;
    if (d.kind === 'model' && d.modelUrl){
      try {
        const proto = await loadModel(d.modelUrl);
        mesh = SkeletonUtils.clone(proto);
        this.localBox.copy(proto.userData.localBox);
        this.clips = proto.userData.clips;
        this._prepModel(mesh);
      } catch (e) { console.warn('model failed', d.modelUrl, e); mesh = this._primitive('box'); this.materials = [mesh.material]; }
    } else if (this.isLight) {
      mesh = this._lightRig();
    } else if (d.kind === 'text') {
      mesh = new THREE.Group(); this.materials = []; this.localBox.set(new THREE.Vector3(-1,-0.3,-0.05), new THREE.Vector3(1,0.3,0.05));
    } else if (d.kind === 'terrain') {
      mesh = this._terrain();
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
  _prepModel(mesh){
    this.materials = [];
    mesh.traverse(m => { if (m.isMesh){ m.castShadow = true; m.receiveShadow = true; m.frustumCulled = !m.isSkinnedMesh; m.material = Array.isArray(m.material) ? m.material.map(x => x.clone()) : m.material.clone(); (Array.isArray(m.material) ? m.material : [m.material]).forEach(x => { if (!x.userData.baseColor) x.userData.baseColor = x.color ? x.color.clone() : null; this.materials.push(x); }); } });
    if (this.clips.length){ this.mixer = new THREE.AnimationMixer(mesh); this.actions = {}; for (const c of this.clips) this.actions[c.name] = this.mixer.clipAction(c); }
  }
  _primitive(kind){
    let g;
    switch (kind){
      case 'sphere': g = new THREE.SphereGeometry(0.5, 32, 20); break;
      case 'cylinder': g = new THREE.CylinderGeometry(0.5, 0.5, 1, 32); break;
      case 'cone': g = new THREE.ConeGeometry(0.5, 1, 32); break;
      case 'capsule': g = new THREE.CapsuleGeometry(0.3, 0.6, 8, 16); break;
      case 'torus': g = new THREE.TorusGeometry(0.35, 0.15, 16, 40); g.rotateX(Math.PI/2); break;
      case 'wedge': { const s = new THREE.Shape(); s.moveTo(-0.5,-0.5); s.lineTo(0.5,-0.5); s.lineTo(0.5,0.5); s.lineTo(-0.5,-0.5);
        g = new THREE.ExtrudeGeometry(s, { depth: 1, bevelEnabled: false }); g.translate(0, 0, -0.5); g.rotateY(Math.PI/2); g.computeVertexNormals(); break; }
      default: g = new THREE.BoxGeometry(1, 1, 1);
    }
    if (kind === 'capsule') this.localBox.set(new THREE.Vector3(-0.3,-0.6,-0.3), new THREE.Vector3(0.3,0.6,0.3));
    else if (kind === 'torus') this.localBox.set(new THREE.Vector3(-0.5,-0.15,-0.5), new THREE.Vector3(0.5,0.15,0.5));
    else this.localBox.set(new THREE.Vector3(-0.5,-0.5,-0.5), new THREE.Vector3(0.5,0.5,0.5));
    const m = new THREE.Mesh(g, new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.6, metalness: 0.05 }));
    m.castShadow = true; m.receiveShadow = true;
    return m;
  }
  _lightRig(){
    const d = this.data, L = d.light || (d.light = defaultObject(d.kind).light);
    const g = new THREE.Group();
    const bulb = new THREE.Mesh(new THREE.SphereGeometry(0.16, 16, 12), new THREE.MeshStandardMaterial({ color: 0xffffff, emissive: 0xffffff, emissiveIntensity: 1.5, roughness: 0.3 }));
    g.add(bulb); this.materials = [bulb.material];
    if (d.kind === 'spot'){
      const cone = new THREE.Mesh(new THREE.ConeGeometry(0.22, 0.35, 16, 1, true), new THREE.MeshStandardMaterial({ color: 0x333844, side: THREE.DoubleSide })); cone.position.y = 0.15; g.add(cone);
      this.light = new THREE.SpotLight(0xffffff, 40, 18, 35 * D2R, 0.45, 1.5); this.light.position.set(0, -0.1, 0);
      this.light.target.position.set(0, -1, 0); g.add(this.light.target);
    } else {
      this.light = new THREE.PointLight(0xffffff, 12, 18, 1.5);
    }
    this.light.shadow.mapSize.set(512, 512); this.light.shadow.bias = -0.002;
    g.add(this.light);
    this.localBox.set(new THREE.Vector3(-0.2,-0.2,-0.2), new THREE.Vector3(0.2,0.25,0.2));
    return g;
  }
  _terrain(){
    const d = this.data, T = d.terrain || (d.terrain = defaultObject('terrain').terrain);
    const size = clamp(toNum(T.size) || 60, 5, 2000), n = clamp(Math.round(toNum(T.detail) || 64), 8, 256), h = toNum(T.height);
    const es = size / n, count = (n + 1) * (n + 1);
    // heights: sculpted data if present, else fresh hills from noise
    let heights = Array.isArray(T.heights) && T.heights.length === count ? Float32Array.from(T.heights) : null;
    if (!heights){
      const noise = makeNoise(toNum(T.seed) || 1); heights = new Float32Array(count);
      for (let iy = 0; iy <= n; iy++) for (let ix = 0; ix <= n; ix++){ const x = -size/2 + ix * es, z = -size/2 + iy * es; const f = 2.2 / size; heights[iy * (n + 1) + ix] = (noise((x + size) * f, (z + size) * f) * 0.5 + 0.5) * h * 2 - h * 0.6; }
      T.heights = null;
    }
    let colors = null;
    if (typeof T.colors === 'string' && T.colors){ try { const bin = atob(T.colors); if (bin.length === count * 3){ colors = new Float32Array(count * 3); for (let i = 0; i < bin.length; i++) colors[i] = bin.charCodeAt(i) / 255; } } catch (e) {} }
    if (!colors){ colors = new Float32Array(count * 3).fill(1); }
    const g = new THREE.PlaneGeometry(size, size, n, n); g.rotateX(-Math.PI / 2);
    const p = g.attributes.position;
    for (let i = 0; i < count; i++) p.setY(i, heights[i]);
    g.setAttribute('color', new THREE.BufferAttribute(colors, 3));
    g.computeVertexNormals();
    const m = new THREE.Mesh(g, new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.95, vertexColors: true }));
    m.castShadow = true; m.receiveShadow = true;
    this.materials = [m.material];
    this.terrainInfo = { size, n, es, heights, colors, geometry: g };
    this.heightAt = (x, z) => {          // bilinear sample in local (unscaled) coords
      const fx = clamp((x + size / 2) / es, 0, n - 1e-6), fz = clamp((z + size / 2) / es, 0, n - 1e-6);
      const ix = Math.floor(fx), iz = Math.floor(fz), tx = fx - ix, tz = fz - iz, w = n + 1;
      const h00 = heights[iz * w + ix], h10 = heights[iz * w + ix + 1], h01 = heights[(iz + 1) * w + ix], h11 = heights[(iz + 1) * w + ix + 1];
      return (h00 * (1 - tx) + h10 * tx) * (1 - tz) + (h01 * (1 - tx) + h11 * tx) * tz;
    };
    this._updateTerrainBox();
    return m;
  }
  _updateTerrainBox(){ const { size, heights } = this.terrainInfo; let lo = Infinity, hi = -Infinity; for (let i = 0; i < heights.length; i++){ if (heights[i] < lo) lo = heights[i]; if (heights[i] > hi) hi = heights[i]; } this.localBox.set(new THREE.Vector3(-size/2, lo - 0.1, -size/2), new THREE.Vector3(size/2, hi + 0.1, size/2)); }
  /* Terrain brush. point = world position; mode: raise|lower|smooth|flatten|paint */
  sculpt(point, radius, strength, mode, color, flattenTo){
    const ti = this.terrainInfo; if (!ti) return;
    const { size, n, es, heights, colors, geometry } = ti, w = n + 1;
    const local = point.clone().sub(this.root.position); local.x /= this.root.scale.x || 1; local.z /= this.root.scale.z || 1;
    const r = radius / (this.root.scale.x || 1);
    const cx = (local.x + size / 2) / es, cz = (local.z + size / 2) / es, rr = r / es;
    const x0 = Math.max(0, Math.floor(cx - rr)), x1 = Math.min(n, Math.ceil(cx + rr)), z0 = Math.max(0, Math.floor(cz - rr)), z1 = Math.min(n, Math.ceil(cz + rr));
    const pos = geometry.attributes.position, col = geometry.attributes.color;
    const c = color ? new THREE.Color(color) : null;
    let src = null; if (mode === 'smooth') src = Float32Array.from(heights);
    for (let iz = z0; iz <= z1; iz++) for (let ix = x0; ix <= x1; ix++){
      const dx = ix - cx, dz = iz - cz, dist = Math.sqrt(dx * dx + dz * dz) / rr; if (dist > 1) continue;
      const falloff = (1 - dist * dist) * (1 - dist * dist); const i = iz * w + ix;
      if (mode === 'raise') heights[i] += strength * 0.08 * falloff;
      else if (mode === 'lower') heights[i] -= strength * 0.08 * falloff;
      else if (mode === 'flatten') heights[i] += (flattenTo - heights[i]) * Math.min(1, strength * 0.12 * falloff);
      else if (mode === 'smooth'){ let sum = 0, cnt = 0; for (let oz = -1; oz <= 1; oz++) for (let ox = -1; ox <= 1; ox++){ const jx = ix + ox, jz = iz + oz; if (jx < 0 || jz < 0 || jx > n || jz > n) continue; sum += src[jz * w + jx]; cnt++; } heights[i] += (sum / cnt - heights[i]) * Math.min(1, strength * 0.15 * falloff); }
      else if (mode === 'paint' && c){ const k = Math.min(1, strength * 0.12 * falloff); colors[i*3] += (c.r - colors[i*3]) * k; colors[i*3+1] += (c.g - colors[i*3+1]) * k; colors[i*3+2] += (c.b - colors[i*3+2]) * k; }
      if (mode !== 'paint') pos.setY(i, heights[i]);
    }
    if (mode === 'paint') col.needsUpdate = true; else { pos.needsUpdate = true; geometry.computeVertexNormals(); this._updateTerrainBox(); }
    this.terrainDirty = true;
  }
  commitTerrain(){   // store sculpt data in the project
    const ti = this.terrainInfo, T = this.data.terrain; if (!ti || !this.terrainDirty) return;
    T.heights = Array.from(ti.heights, v => Math.round(v * 100) / 100);
    let bin = ''; for (let i = 0; i < ti.colors.length; i++) bin += String.fromCharCode(Math.round(clamp(ti.colors[i], 0, 1) * 255)); T.colors = btoa(bin);
    this.terrainDirty = false;
  }
  resetTerrain(){ const T = this.data.terrain; T.heights = null; T.colors = null; }
  // change size / detail / height while keeping what was sculpted
  async reshapeTerrain(next){
    const T = this.data.terrain, ti = this.terrainInfo; if (!ti) return;
    const oldSize = ti.size, oldN = ti.n, oldH = toNum(T.height);
    const sculpted = Array.isArray(T.heights);
    const newSize = clamp(toNum(next.size) || oldSize, 5, 2000), newN = clamp(Math.round(toNum(next.detail) || oldN), 8, 256), newH = toNum(next.height);
    if (sculpted && (newSize !== oldSize || newN !== oldN)){
      const w = newN + 1, es = newSize / newN, heights = new Array(w * w), colors = new Uint8Array(w * w * 3);
      for (let iy = 0; iy <= newN; iy++) for (let ix = 0; ix <= newN; ix++){
        const x = -newSize/2 + ix * es, z = -newSize/2 + iy * es;
        heights[iy * w + ix] = Math.round(this.heightAt(clamp(x, -oldSize/2, oldSize/2), clamp(z, -oldSize/2, oldSize/2)) * 100) / 100;
        const ox = clamp(Math.round((x + oldSize/2) / (oldSize / oldN)), 0, oldN), oz = clamp(Math.round((z + oldSize/2) / (oldSize / oldN)), 0, oldN), oi = oz * (oldN + 1) + ox;
        for (let k = 0; k < 3; k++) colors[(iy * w + ix) * 3 + k] = Math.round(clamp(ti.colors[oi * 3 + k], 0, 1) * 255);
      }
      T.heights = heights; let bin = ''; for (let i = 0; i < colors.length; i++) bin += String.fromCharCode(colors[i]); T.colors = btoa(bin);
    }
    if (sculpted && newH !== oldH && oldH !== 0){ const k = newH / oldH; T.heights = T.heights.map(v => Math.round(v * k * 100) / 100); }
    T.size = newSize; T.detail = newN; T.height = newH; if (next.seed != null) T.seed = next.seed;
    await this.build();
  }
  applyProps(){
    const d = this.data;
    this.root.position.fromArray(d.position);
    this.root.rotation.set(d.rotation[0]*D2R, d.rotation[1]*D2R, d.rotation[2]*D2R);
    this.root.scale.fromArray(d.scale);
    this.root.visible = d.visible !== false;
    this.applyLook();
    if (this.isLight && this.light) this.applyLight();
    if (d.kind === 'text') this.applyText();
  }
  applyLook(){
    const d = this.data;
    const tint = d.color ? new THREE.Color().setStyle(d.color) : null;
    const texName = d.kind === 'terrain' ? (d.terrain && d.terrain.texture) : d.texture;
    const tex = texName ? getTexture(texName) : null, tp = (texName && TEXTURE_PROPS[texName]) || {};
    const mat = d.material || 'normal';
    for (const m of this.materials){
      if (m.emissiveIntensity != null && this.isLight) continue;      // bulb keeps its glow look; colour handled in applyLight
      if ('map' in m){
        if (tex){
          if (!m.map || m.map.userData.name !== texName){ m.map = tex.clone(); m.map.userData.name = texName; m.map.needsUpdate = true; }
          const sx = Math.abs(this.root.scale.x), sy = Math.abs(this.root.scale.y), sz = Math.abs(this.root.scale.z);
          if (d.kind === 'terrain'){ const r = this.terrainInfo.size / 8; m.map.repeat.set(r, r); }
          else if (d.kind === 'plane'){ m.map.repeat.set(Math.max(1, Math.round(sx / 3)), Math.max(1, Math.round(sz / 3))); }
          else { m.map.repeat.set(Math.max(1, Math.round(Math.max(sx, sz))), Math.max(1, Math.round(sy))); }
        } else if (m.map && m.map.userData.name){ m.map = null; }
        m.needsUpdate = true;
      }
      if (tint) { if (m.color) m.color.copy(tint); }
      else if (m.userData.baseColor && m.color) m.color.copy(m.userData.baseColor);
      else if (tex && m.color) m.color.setRGB(1, 1, 1);
      if ('roughness' in m){
        m.roughness = tp.rough != null ? tp.rough : mat === 'shiny' ? 0.15 : mat === 'metal' ? 0.3 : mat === 'glass' ? 0.05 : mat === 'flat' ? 1 : 0.6;
        m.metalness = tp.metal != null ? tp.metal : mat === 'metal' ? 0.9 : mat === 'glass' ? 0.1 : 0.05;
      }
      if (m.emissive){
        if (mat === 'glow' || tp.emissive){ m.emissive.copy(tint || (m.color || new THREE.Color(0xffffff))); m.emissiveIntensity = tp.emissive ? 0.9 : 0.8; if (tp.emissive && m.map) { m.emissiveMap = m.map; m.emissive.setRGB(1,1,1); } }
        else { m.emissive.setRGB(0,0,0); m.emissiveMap = null; }
      }
      const op = clamp(1 - toNum(d.opacity == null ? 0 : d.opacity) / 100, 0, 1) * (tp.opacity != null ? tp.opacity : 1);
      const alpha = mat === 'glass' ? Math.min(op, 0.45) : op;
      m.transparent = alpha < 1; m.opacity = alpha; m.depthWrite = alpha >= 0.99 || mat !== 'glass';
      m.wireframe = mat === 'wireframe';
      m.needsUpdate = true;
    }
  }
  applyLight(){
    const L = this.data.light; if (!L || !this.light) return;
    const col = new THREE.Color().setStyle(L.color || '#ffffff');
    this.light.color.copy(col); this.light.intensity = toNum(L.intensity); this.light.distance = Math.max(0.5, toNum(L.distance) || 18);
    if (this.light.isSpotLight) this.light.angle = clamp(toNum(L.angle) || 35, 1, 89) * D2R;
    this.light.castShadow = !!L.shadow && this.engine.editor !== null;
    this.light.visible = L.on !== false;
    const bulb = this.materials[0]; if (bulb){ bulb.emissive.copy(col); bulb.emissiveIntensity = L.on === false ? 0 : 1.4; bulb.color.copy(col); }
  }
  applyText(){
    const T = this.data.text || (this.data.text = defaultObject('text').text);
    if (this.textSprite){ this.mesh.remove(this.textSprite); this.textSprite.material.map.dispose(); this.textSprite.material.dispose(); }
    const text = toStr(T.content) || ' ', size = Math.max(0.1, toNum(T.size) || 0.8);
    const c = document.createElement('canvas'); const ctx = c.getContext('2d'); ctx.font = 'bold 64px Helvetica, Arial, sans-serif';
    const lines = text.split('\n'); const w = Math.max(...lines.map(l => ctx.measureText(l).width)) + 40; c.width = Math.ceil(Math.min(2048, w)); c.height = 80 * lines.length;
    ctx.font = 'bold 64px Helvetica, Arial, sans-serif'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    if (T.bg){ ctx.fillStyle = T.bg; ctx.beginPath(); ctx.roundRect(0, 0, c.width, c.height, 24); ctx.fill(); }
    ctx.fillStyle = T.color || '#fff'; ctx.strokeStyle = 'rgba(0,0,0,.55)'; ctx.lineWidth = 6; ctx.lineJoin = 'round';
    lines.forEach((l, i) => { const y = 40 + i * 80; if (!T.bg) ctx.strokeText(l, c.width / 2, y); ctx.fillText(l, c.width / 2, y); });
    const tex = new THREE.CanvasTexture(c); tex.colorSpace = THREE.SRGBColorSpace;
    const sp = new THREE.Sprite(new THREE.SpriteMaterial({ map: tex, transparent: true }));
    const hgt = size * lines.length, wid = hgt * c.width / c.height; sp.scale.set(wid, hgt, 1);
    this.mesh.add(sp); this.textSprite = sp;
    this.localBox.set(new THREE.Vector3(-wid/2, -hgt/2, -0.05), new THREE.Vector3(wid/2, hgt/2, 0.05));
  }
  /* physics */
  rebuildBody(){
    const eng = this.engine, d = this.data, p = d.physics;
    if (this.body){ eng.world.removeBody(this.body); this.body = null; }
    if (!p || !p.enabled || !eng.physicsActive || this.isLight) return;
    const sx = Math.abs(this.root.scale.x), sy = Math.abs(this.root.scale.y), sz = Math.abs(this.root.scale.z);
    let shape, offset = new CANNON.Vec3(), mass = p.type === 'static' ? 0 : Math.max(0.01, toNum(p.mass) || 1);
    const body = new CANNON.Body({ mass: d.kind === 'terrain' ? 0 : mass, material: eng.physMaterial(p.bounce, p.friction), fixedRotation: !!p.upright, linearDamping: 0.02, angularDamping: p.upright ? 1 : 0.3, allowSleep: false, collisionResponse: d.collide !== false });
    if (d.kind === 'terrain'){
      const { size, n, es, heights } = this.terrainInfo, matrix = [], w = n + 1;
      for (let i = 0; i <= n; i++){ const row = []; for (let j = 0; j <= n; j++) row.push(heights[(n - j) * w + i] * sy); matrix.push(row); }
      shape = new CANNON.Heightfield(matrix, { elementSize: es * sx });
      const q = new CANNON.Quaternion().setFromEuler(-Math.PI / 2, 0, 0);
      body.addShape(shape, new CANNON.Vec3(-size/2 * sx, 0, size/2 * sz), q);
    } else {
      const size = new THREE.Vector3(); this.localBox.getSize(size);
      const center = new THREE.Vector3(); this.localBox.getCenter(center);
      if (d.kind === 'sphere') shape = new CANNON.Sphere(0.5 * Math.max(sx, sy, sz));
      else if (d.kind === 'cylinder') shape = new CANNON.Cylinder(0.5 * sx, 0.5 * sx, 1 * sy, 16);
      else if (d.kind === 'cone') shape = new CANNON.Cylinder(0.05 * sx, 0.5 * sx, 1 * sy, 12);
      else shape = new CANNON.Box(new CANNON.Vec3(Math.max(0.01, size.x * sx / 2), Math.max(0.01, size.y * sy / 2), Math.max(0.01, size.z * sz / 2)));
      body.addShape(shape, new CANNON.Vec3(center.x * sx, center.y * sy, center.z * sz));
    }
    body.position.set(this.root.position.x, this.root.position.y, this.root.position.z);
    body.quaternion.set(this.root.quaternion.x, this.root.quaternion.y, this.root.quaternion.z, this.root.quaternion.w);
    body.userData = { obj: this };
    if (p.upright) body.updateMassProperties();
    eng.world.addBody(body);
    this.body = body;
  }
  syncFromBody(){ if (!this.body || this.body.mass === 0) return; const b = this.body; this.root.position.set(b.position.x, b.position.y, b.position.z); this.root.quaternion.set(b.quaternion.x, b.quaternion.y, b.quaternion.z, b.quaternion.w); }
  syncToBody(keepVel=false){
    if (!this.body) return;
    const b = this.body, r = this.root;
    b.position.set(r.position.x, r.position.y, r.position.z);
    b.quaternion.set(r.quaternion.x, r.quaternion.y, r.quaternion.z, r.quaternion.w);
    if (!keepVel){ b.velocity.set(0,0,0); b.angularVelocity.set(0,0,0); }
    b.aabbNeedsUpdate = true; b.wakeUp();
  }
  worldBox(out){
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
  forwardVec(){ const y = this.root.rotation.y; return new THREE.Vector3(Math.sin(y), 0, Math.cos(y)); }
  forward(steps){ const f = this.forwardVec(); this.root.position.x += f.x * steps; this.root.position.z += f.z * steps; this._moved(true); }
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
  pointTowards(name){ const t = this.engine.find(name, this); if (!t) return; this.lookAtPoint(t.root.position.x, t.root.position.z); }
  lookAtPoint(x, z){ const dx = x - this.root.position.x, dz = z - this.root.position.z; if (Math.abs(dx) + Math.abs(dz) < 1e-6) return; this.root.rotation.y = Math.atan2(dx, dz); this._moved(true); }
  turnTowards(name, maxDeg){ const t = this.engine.find(name, this); if (!t) return; const dx = t.root.position.x - this.root.position.x, dz = t.root.position.z - this.root.position.z; const want = Math.atan2(dx, dz); let diff = want - this.root.rotation.y; diff = Math.atan2(Math.sin(diff), Math.cos(diff)); const step = clamp(diff, -maxDeg * D2R, maxDeg * D2R); this.root.rotation.y += step; this._moved(true); }
  moveTowards(name, steps){ const t = this.engine.find(name, this); if (!t) return; const d = t.root.position.clone().sub(this.root.position); d.y = 0; const len = d.length(); if (len < 1e-4) return; d.multiplyScalar(Math.min(steps, len) / len); this.root.position.add(d); this._moved(true); }
  goTo(x, y, z){ this.root.position.set(x, y, z); this._moved(false); }
  goToObj(name){
    if (name === '__random__'){ const ext = this.engine.worldExtent() * 0.8; this.root.position.set((Math.random()-0.5)*ext, this.root.position.y, (Math.random()-0.5)*ext); this._moved(false); return; }
    if (name === '__mouse__'){ const p = this.engine.mouseGround(); if (p){ this.root.position.x = p.x; this.root.position.z = p.z; this._moved(false); } return; }
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
  setColor(c){ try { const col = new THREE.Color().setStyle(String(c)); this.data.color = '#' + col.getHexString(); } catch(e){ return; } if (this.isLight){ this.data.light.color = this.data.color; this.applyLight(); return; } this.applyLook(); }
  setMaterial(m){ this.data.material = m; this.applyLook(); }
  setTexture(t){ if (this.data.kind === 'terrain'){ this.data.terrain.texture = t; } else { this.data.texture = t === 'none' ? '' : t; if (t && t !== 'none' && this.data.color && this.data.color !== '#ffffff' && !this._tinted) { this.data.color = '#ffffff'; } } this.applyLook(); }
  setOpacity(p){ this.data.opacity = clamp(p, 0, 100); this.applyLook(); }
  size(){ return this.sizePct; }
  setSize(p){ p = clamp(p, 1, 2000); this.sizePct = p; const base = this.baseScale || this.data.scale; this.root.scale.set(base[0]*p/100, base[1]*p/100, base[2]*p/100); if (this.body) this.rebuildBody(); }
  say(text){ this.engine.setLabel(this, toStr(text)); this.sayUntil = 0; }
  *sayFor(text, secs){ this.say(text); const R = this.engine.rt, t0 = R.now(); while (R.now() - t0 < secs) yield; if (this.label && this.label.userData.text === toStr(text)) this.engine.setLabel(this, ''); }
  setText(t){ if (!this.data.text) return; this.data.text.content = toStr(t); this.applyText(); }
  setLight(what, v){ if (!this.data.light) return; const L = this.data.light; if (what === 'color') L.color = toStr(v); else if (what === 'brightness') L.intensity = toNum(v); else if (what === 'range') L.distance = toNum(v); else if (what === 'on') L.on = !!v; this.applyLight(); }
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
  setCollide(on){ this.data.collide = !!on; if (this.body) this.body.collisionResponse = !!on; }
  setMass(m){ this.data.physics.mass = Math.max(0.01, m); if (this.body && this.body.mass > 0){ this.body.mass = this.data.physics.mass; this.body.updateMassProperties(); } }
  setBounce(b){ this.data.physics.bounce = clamp(b, 0, 1.5); if (this.body) this.body.material = this.engine.physMaterial(this.data.physics.bounce, this.data.physics.friction); }
  setFriction(f){ this.data.physics.friction = clamp(f, 0, 2); if (this.body) this.body.material = this.engine.physMaterial(this.data.physics.bounce, this.data.physics.friction); }
  _dynamic(){ if (!this.body || this.body.mass === 0){ if (!this.data.physics.enabled || this.data.physics.type !== 'dynamic'){ this.data.physics.enabled = true; this.data.physics.type = 'dynamic'; this.rebuildBody(); } } return this.body; }
  push(x, y, z){ const b = this._dynamic(); if (b){ b.wakeUp(); b.applyImpulse(new CANNON.Vec3(x * b.mass, y * b.mass, z * b.mass)); } }
  pushDir(dir, v){
    const f = this.forwardVec();
    if (dir === 'forward') this.push(f.x*v, 0, f.z*v); else if (dir === 'back') this.push(-f.x*v, 0, -f.z*v);
    else if (dir === 'up') this.push(0, v, 0); else if (dir === 'down') this.push(0, -v, 0); else { const s = dir === 'left' ? 1 : -1; this.push(f.z*v*s, 0, -f.x*v*s); }
  }
  jump(v){ if (this.onGround()) { const b = this._dynamic(); if (b){ b.velocity.y = 0; this.push(0, v, 0); } } }
  setVel(x, y, z){ const b = this._dynamic(); if (b){ b.wakeUp(); b.velocity.set(x, y, z); } }
  setVelAxis(a, v){ const b = this._dynamic(); if (b){ b.wakeUp(); b.velocity[a] = v; } }
  vel(a){ if (!this.body) return 0; const v = this.body.velocity; return a === 'speed' ? v.length() : v[a]; }
  onGround(){ return this.body ? this.engine.rt.grounded.has(this.body.id) : true; }
  explode(power, radius){
    const p = this.root.position;
    for (const o of this.engine.objects){ if (o === this || !o.body || o.body.mass === 0) continue; const d = o.root.position.clone().sub(p); const len = d.length(); if (len > radius) continue; d.normalize().multiplyScalar(power * (1 - len / radius) * o.body.mass); d.y += power * 0.3 * o.body.mass; o.body.wakeUp(); o.body.applyImpulse(new CANNON.Vec3(d.x, d.y, d.z)); }
    this.engine.rt.particles.burst(p, this.data.color || '#ffaa33', 120, power * 1.2, 1.4);
    this.engine.rt.cam.shake(Math.min(1.5, power / 6));
  }
  /* sensing */
  touching(name){ return this.engine.rt.touching(this, name); }
  distanceTo(name){ const t = this.engine.find(name, this); return t ? this.root.position.distanceTo(t.root.position) : 0; }
  rayHit(dist){ const e = this.engine; const f = this.forwardVec(); const box = this.worldBox(); const origin = this.root.position.clone(); origin.y = (box.min.y + box.max.y) / 2;
    e.raycaster.set(origin.add(f.clone().multiplyScalar(0.01)), f); e.raycaster.far = dist;
    const hits = e.raycaster.intersectObjects(e.objects.filter(o => o !== this && o.root.visible && !o.isLight).map(o => o.root), true);
    for (const h of hits){ let n = h.object; while (n && !n.userData.obj) n = n.parent; if (n && n.userData.obj && n.userData.obj !== this && !h.object.isSprite) return n.userData.obj; } return null; }
  heightAboveGround(){ const e = this.engine; const box = this.worldBox(); e.raycaster.set(new THREE.Vector3(this.root.position.x, box.min.y - 0.01, this.root.position.z), new THREE.Vector3(0, -1, 0)); e.raycaster.far = 1000;
    const hits = e.raycaster.intersectObjects(e.objects.filter(o => o !== this && o.root.visible && !o.isLight && o.kind !== 'text').map(o => o.root), true); return hits.length ? Math.round(hits[0].distance * 100) / 100 : 1000; }
}

/* ----------------------------- Camera controller ----------------------------- */
class CameraRig {
  constructor(engine){ this.e = engine; this.mode = 'free'; this.target = null; this.dist = 6; this.h = 3; this.off = new THREE.Vector3(); this.pitch = 0; this.look = null; this.shakeAmt = 0; this.mouse = false; }
  reset(){ this.mode = 'free'; this.target = null; this.look = null; this.shakeAmt = 0; this.mouse = false; this.pitch = 0; this.e.controls.enabled = true; this.e.camera.fov = 55; this.e.camera.updateProjectionMatrix(); this._unlock(); }
  _t(name){ const o = this.e.find(name); if (o) { this.target = o; } return o; }
  follow(name, d, h){ if (this._t(name)){ this.mode = 'follow'; this.dist = d; this.h = h; this.e.controls.enabled = false; } }
  top(name, h){ if (this._t(name)){ this.mode = 'top'; this.h = h; this.e.controls.enabled = false; } }
  firstPerson(name){ if (this._t(name)){ this.mode = 'fp'; this.e.controls.enabled = false; } }
  offset(name, x, y, z){ if (this._t(name)){ this.mode = 'offset'; this.off.set(x, y, z); this.e.controls.enabled = false; } }
  setPos(x, y, z){ this.mode = 'fixed'; this.e.camera.position.set(x, y, z); this.e.controls.enabled = false; if (this.look) this.e.camera.lookAt(this.look.root.position); }
  lookAt(name){ const o = this.e.find(name); if (o){ this.look = o; if (this.mode === 'free'){ this.mode = 'fixed'; this.e.controls.enabled = false; } } }
  free(){ this.mode = 'free'; if (this.target) this.e.controls.target.copy(this.target.root.position); this.e.controls.enabled = true; }
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
    this.e = engine; this.threads = []; this.time = 0; this.timerStart = 0; this.timeScale = 1;
    this.input = { keys: new Set(), mouseDown: false, mouseX: 0, mouseY: 0 };
    this.grounded = new Set(); this.pairs = new Set(); this.touchPrev = new Set(); this.timerFired = new Set();
    this.synth = new Synth(); this.vars = new Map(); this.lists = new Map(); this.monitors = new Set(); this.cam = new CameraRig(engine);
    this.particles = new Particles(engine.scene);
    this.V = { get: k => this.vars.has(k) ? this.vars.get(k) : 0, set: (k, v) => { this.vars.set(k, v); this.e.hudDirty = true; },
      change: (k, v) => { this.vars.set(k, toNum(this.vars.get(k)) + v); this.e.hudDirty = true; }, show: (k, on) => { on ? this.monitors.add(k) : this.monitors.delete(k); this.e.hudDirty = true; } };
    const L = k => { if (!this.lists.has(k)) this.lists.set(k, []); return this.lists.get(k); };
    this.L = { get: L, add: (k, v) => { L(k).push(v); this.e.hudDirty = true; }, del: (k, i) => { const a = L(k); if (i === 'all') a.length = 0; else if (i === 'last') a.pop(); else { i = Math.floor(toNum(i)); if (i >= 1 && i <= a.length) a.splice(i - 1, 1); } this.e.hudDirty = true; },
      insert: (k, i, v) => { const a = L(k); i = i === 'last' ? a.length + 1 : Math.floor(toNum(i)); if (i >= 1 && i <= a.length + 1) a.splice(i - 1, 0, v); this.e.hudDirty = true; },
      replace: (k, i, v) => { const a = L(k); i = i === 'last' ? a.length : Math.floor(toNum(i)); if (i >= 1 && i <= a.length) a[i - 1] = v; this.e.hudDirty = true; },
      item: (k, i) => { const a = L(k); if (i === 'last') return a[a.length - 1] ?? ''; if (i === 'random') return a[Math.floor(Math.random() * a.length)] ?? ''; i = Math.floor(toNum(i)); return a[i - 1] ?? ''; },
      length: k => L(k).length, contains: (k, v) => L(k).some(x => this.cmp(x, v) === 0), indexOf: (k, v) => L(k).findIndex(x => this.cmp(x, v) === 0) + 1,
      join: k => L(k).map(toStr).join(' '), show: (k, on) => { on ? this.monitors.add('list:' + k) : this.monitors.delete('list:' + k); this.e.hudDirty = true; } };
    this.hudTexts = { top: '', bottom: '' }; this.uiDown = new Set();
    this.ui = { set: (name, prop, v) => { const u = this.e.uiFind(name); if (!u) return; u[prop] = v; this.e.updateUI(u); }, pressed: name => this.uiDown.has(name), get: (name, prop) => { const u = this.e.uiFind(name); return u ? (u[prop] ?? '') : ''; } };
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
  resetTimer(){ this.timerStart = this.time; this.timerFired.clear(); }
  key(k){ if (k === 'any') return this.input.keys.size > 0; return this.input.keys.has(k); }
  sound(n){ const f = (this.e.project.sounds || []).find(s => s.name === n); if (f) this.synth.file(f.url); else this.synth.play(n); }
  soundFile(n){ const f = (this.e.project.sounds || []).find(s => s.name === n); if (f) this.synth.file(f.url); }
  stopSounds(){ this.synth.stopAll(); }
  *note(n, beats){ const secs = beats * 0.5; this.synth.note(n, secs); yield* this.wait(secs); }
  volume(v){ this.synth.volume = clamp(v, 0, 100) / 100; }
  setGravity(g){ this.e.world.gravity.set(0, -g, 0); }
  setSpeed(p){ this.timeScale = clamp(p, 1, 400) / 100; }
  exists(name){ return !!this.e.find(name); }
  count(name){ return this.e.objects.filter(o => o.name === name).length; }
  propOf(name, p){ const o = this.e.find(name); if (!o) return 0; switch (p){ case 'x': return o.root.position.x; case 'y': return o.root.position.y; case 'z': return o.root.position.z; case 'dir': return o.dir(); case 'size': return o.size(); } return 0; }
  *bigText(text, secs){ this.e.showBigText(toStr(text)); yield* this.wait(secs); this.e.showBigText(''); }
  hudText(pos, text){ this.hudTexts[pos] = toStr(text); this.e.hudDirty = true; }
  *flash(color, secs){ this.e.flash(color, secs); yield* this.wait(secs); }
  fx(self, color, count, speed){ this.particles.burst(self.root ? self.root.position : new THREE.Vector3(), toStr(color) || '#ffffff', clamp(Math.round(count), 1, 600), Math.max(0.1, speed)); }
  fxAt(x, y, z, color, count, speed){ this.particles.burst(new THREE.Vector3(x, y, z), toStr(color) || '#ffffff', clamp(Math.round(count), 1, 600), Math.max(0.1, speed)); }
  setSky(style, time){ const s = this.e.project.stage; if (style) s.style = style; if (time != null) s.time = clamp(time, 0, 24); this.e.applyStage(); }
  /* threads */
  start(obj, script, restart=true, arg){
    const existing = this.threads.find(t => t.obj === obj && t.script === script && !t.done);
    if (existing){ if (!restart) return existing; existing.done = true; }
    const t = { obj, script, done: false, it: null };
    try { t.it = script.fn(obj, this, this.V, t, arg, this.L); } catch (e) { console.error(e); t.done = true; }
    this.threads.push(t); return t;
  }
  *callProc(self, name, arg){ const s = (self.scripts || []).find(s => s.hat === 'define' && s.name === name); if (!s) return; yield* s.fn(self, this, this.V, null, arg, this.L); }
  stopAll(){ for (const t of this.threads) t.done = true; this._stopAllFlag = true; }
  stopOthers(obj, self){ for (const t of this.threads) if (t.obj === obj && t !== self) t.done = true; }
  startHats(kind, filter, restart=true){
    const started = [];
    const all = this.e.objects.slice(); if (this.e.stageObj) all.push(this.e.stageObj);
    for (const o of all) for (const s of (o.scripts || [])) if (s.hat === kind && (!filter || filter(s, o))) started.push(this.start(o, s, restart));
    return started;
  }
  broadcast(msg){ msg = toStr(msg).toLowerCase(); return this.startHats('broadcast', s => s.msg === msg, true); }
  *broadcastWait(msg){ const ts = this.broadcast(msg); while (ts.some(t => !t.done)) yield; }
  clone(self, target){
    const src = target === '__self__' ? self : this.e.find(target);
    if (!src || src.isStage || this.e.objects.length > 500) return null;
    const c = this.e.cloneObject(src);
    for (const s of c.scripts) if (s.hat === 'clone') this.start(c, s);
    return c;
  }
  spawn(self, target, x, y, z){ const c = this.clone(self, target); if (c){ c.goTo(x, y, z); c.setVisible(true); } }
  deleteClone(o){ if (o.isClone) this.e.removeObject(o); }
  deleteObject(o){ if (!o.isStage) this.e.removeObject(o); }
  step(){
    if (this.input.keys.size) this.startHats('key', s => this.key(s.key), false);
    const tm = this.timer(); this.startHats('timer', s => { if (tm > s.value && !this.timerFired.has(s)) { this.timerFired.add(s); return true; } return false; });
    for (let i = 0; i < this.threads.length; i++){
      const t = this.threads[i]; if (t.done) continue;
      try { const r = t.it.next(); if (r.done) t.done = true; } catch (e) { console.error('Script error in ' + t.obj.name + ':', e); this.e.reportError(t.obj.name + ': ' + e.message); t.done = true; }
      if (this._stopAllFlag) break;
    }
    this._stopAllFlag = false;
    if (this.threads.length > 64 || this.threads.some(t => t.done)) this.threads = this.threads.filter(t => !t.done);
  }
  updateContacts(){
    const g = this.grounded; g.clear(); const pairs = this.pairs = new Set();
    for (const c of this.e.world.contacts){
      const a = c.bi, b = c.bj;
      if (c.ni.y < -0.35) g.add(a.id); if (c.ni.y > 0.35) g.add(b.id);   // slopes up to ~70° still count as ground
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
    if (self.isStage) return false;
    for (const o of this.e.objects){ if (o === self || o.isLight) continue; if (name !== '__any__' && o.name !== name) continue; if (this.touchingObj(self, o)) return true; }
    return false;
  }
  fireTouchHats(){
    const nowSet = new Set();
    for (const o of this.e.objects){
      if (!o.scripts) continue;
      for (const s of o.scripts){
        if (s.hat !== 'touch') continue;
        for (const t of this.e.objects){
          if (t === o || t.isLight || (s.target !== '__any__' && t.name !== s.target)) continue;
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
    this.camera = new THREE.PerspectiveCamera(55, 1, 0.1, 4000);
    this.camera.position.set(9, 6, 11);
    this.controls = new OrbitControls(this.camera, canvas);
    this.controls.enableDamping = true; this.controls.dampingFactor = 0.12; this.controls.target.set(0, 1, 0); this.controls.maxPolarAngle = Math.PI * 0.495; this.controls.maxDistance = 1500;
    this.controls.mouseButtons = { LEFT: THREE.MOUSE.ROTATE, MIDDLE: THREE.MOUSE.PAN, RIGHT: null };
    // lights + sky
    this.hemi = new THREE.HemisphereLight(0xbfe3ff, 0x6a7a4a, 0.75); this.scene.add(this.hemi);
    this.sun = new THREE.DirectionalLight(0xfff4e0, 2.4); this.sun.position.set(20, 35, 15); this.sun.castShadow = true;
    const sc = this.sun.shadow.camera; sc.left = -34; sc.right = 34; sc.top = 34; sc.bottom = -34; sc.near = 1; sc.far = 200;
    this.sun.shadow.mapSize.set(2048, 2048); this.sun.shadow.bias = -0.0006; this.sun.shadow.normalBias = 0.03; this.sun.shadow.radius = 3;
    this.scene.add(this.sun); this.scene.add(this.sun.target);
    this.sky = new Sky(this.scene);
    // editor helpers
    this.grid = new THREE.GridHelper(200, 200, 0x8890aa, 0x555c75); this.grid.position.y = 0.002; this.grid.material.transparent = true; this.grid.material.opacity = 0.35; this.scene.add(this.grid);
    this.selBox = new THREE.BoxHelper(new THREE.Mesh(new THREE.BoxGeometry(1,1,1)), 0xa78bfa); this.selBox.material.depthTest = false; this.selBox.material.transparent = true; this.selBox.material.opacity = 0.9; this.selBox.renderOrder = 998; this.selBox.visible = false; this.scene.add(this.selBox);
    this.hoverBox = new THREE.BoxHelper(new THREE.Mesh(new THREE.BoxGeometry(1,1,1)), 0xffffff); this.hoverBox.material.depthTest = false; this.hoverBox.material.transparent = true; this.hoverBox.material.opacity = 0.35; this.hoverBox.visible = false; this.scene.add(this.hoverBox);
    this.selected = null; this.hovered = null;
    this.brush = new THREE.Mesh(new THREE.RingGeometry(0.85, 1, 48), new THREE.MeshBasicMaterial({ color: 0xa78bfa, transparent: true, opacity: 0.85, depthTest: false, side: THREE.DoubleSide })); this.brush.rotation.x = -Math.PI / 2; this.brush.renderOrder = 999; this.brush.visible = false; this.scene.add(this.brush);
    // physics
    this.world = new CANNON.World({ gravity: new CANNON.Vec3(0, -9.8, 0) });
    this.world.broadphase = new CANNON.SAPBroadphase(this.world); this.world.allowSleep = false;
    this.world.solver.iterations = 10; this.world.defaultContactMaterial.friction = 0.4; this.world.defaultContactMaterial.restitution = 0.3;
    this._materials = new Map();
    this.physicsActive = false;
    this.objects = []; this.byId = new Map();
    this.project = defaultProject();
    this.rt = new Runtime(this);
    this.playing = false; this.hudDirty = false; this._snapshot = null; this.onError = null; this.onPlayState = null;
    this.clock = new THREE.Clock(); this.fps = 0; this._fpsN = 0; this._fpsT = 0; this.stats = { objects: 0, bodies: 0, threads: 0 };
    this.raycaster = new THREE.Raycaster();
    this.fly = { keys: new Set(), speed: 8 };
    this._bindInput();
    this.resize();
    this._loop = this._loop.bind(this); requestAnimationFrame(this._loop);
  }
  /* ---------- setup / project ---------- */
  applyStage(){
    const s = this.project.stage;
    const info = this.sky.apply(s.style || 'auto', s.time == null ? 12 : toNum(s.time), s.sky || '#8fd3ff');
    this.sunDir = info.sunDir;
    this.sun.color.copy(info.sunColor); this.sun.intensity = info.intensity * (s.sun == null ? 1 : toNum(s.sun));
    this.hemi.color.copy(info.top).lerp(new THREE.Color(0xffffff), 0.5); this.hemi.groundColor.set(0x5a6a45).lerp(info.horizon, 0.3);
    this.hemi.intensity = (0.25 + (1 - info.night) * 0.55) * (s.ambient == null ? 1 : toNum(s.ambient));
    const fogCol = info.horizon.clone(), ext = this.worldExtent();
    this.scene.fog = s.fog === false || s.style === 'space' ? null : new THREE.Fog(fogCol, Math.max(70, ext * 0.45), Math.max(260, ext * 1.6));
    const sh = clamp(ext / 3, 34, 110); const sc = this.sun.shadow.camera; sc.left = -sh; sc.right = sh; sc.top = sh; sc.bottom = -sh; sc.far = 200 + ext; sc.updateProjectionMatrix();
    this.sun.shadow.mapSize.set(ext > 300 ? 4096 : 2048, ext > 300 ? 4096 : 2048); if (this.sun.shadow.map){ this.sun.shadow.map.dispose(); this.sun.shadow.map = null; }
    this.scene.background = null;
    this.world.gravity.set(0, -(s.gravity == null ? 9.8 : toNum(s.gravity)), 0);
  }
  worldExtent(){ let ext = 120; for (const o of this.objects){ if (o.kind === 'terrain' && o.terrainInfo) ext = Math.max(ext, o.terrainInfo.size * Math.abs(o.root.scale.x)); else if (o.kind === 'plane') ext = Math.max(ext, Math.max(Math.abs(o.root.scale.x), Math.abs(o.root.scale.z)) * 1.5); } return ext; }
  async loadProject(p){
    this.stop(); this.clear();
    const def = defaultProject();
    this.project = Object.assign(def, p);
    this.project.stage = Object.assign(def.stage, p.stage || {});
    this.project.lists = p.lists || []; this.project.sounds = p.sounds || []; this.project.groups = p.groups || []; this.project.ui = p.ui || [];
    this.applyStage();
    if (p.camera){ this.camera.position.fromArray(p.camera.position); this.controls.target.fromArray(p.camera.target); this.controls.update(); }
    await Promise.all((this.project.objects || []).map(d => this.addObject(d, false)));
    this.scene.updateMatrixWorld(true);
    for (const o of this.objects) if (o.data.drop){ delete o.data.drop; this.dropToGround(o); }   // examples: settle onto terrain after it exists
    this.applyStage(); this.renderUI(false);
  }
  clear(){ for (const o of this.objects.slice()) this.removeObject(o, false); this.objects = []; this.byId.clear(); this.select(null); }
  async addObject(data, register=true){
    if (register && !this.project.objects.includes(data)) this.project.objects.push(data);
    const o = new SceneObject(this, data);
    this.objects.push(o); this.byId.set(o.id, o); this.scene.add(o.root);
    await o.build();
    if (o.kind === 'terrain' || o.kind === 'plane') this.applyStage();
    return o;
  }
  removeObject(o, unregister=true){
    if (this.selected === o) this.select(null);
    if (this.hovered === o) this.hovered = null;
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
    c.localBox.copy(src.localBox); c.clips = src.clips;
    if (src.data.kind === 'model' && src.mesh && src.mesh.isGroup){ const mesh = SkeletonUtils.clone(src.mesh); c._prepModel(mesh); c.root.add(mesh); c.mesh = mesh; }
    else if (src.isLight){ const m = c._lightRig(); c.root.add(m); c.mesh = m; }
    else if (src.kind === 'text'){ const g = new THREE.Group(); c.root.add(g); c.mesh = g; c.materials = []; }
    else if (src.kind === 'terrain'){ const m = c._terrain(); c.root.add(m); c.mesh = m; }
    else { const m = c._primitive(src.data.kind === 'model' ? 'box' : src.data.kind); c.root.add(m); c.mesh = m; c.materials = [m.material]; }
    c.ready = true; c.applyProps(); c.rebuildBody();
    return c;
  }
  find(name, self){ if (name === '__self__') return self; if (name === 'Stage' && this.stageObj) return null; for (const o of this.objects) if (o.name === name && !o.isClone) return o; for (const o of this.objects) if (o.name === name) return o; return null; }
  physMaterial(bounce, friction){
    const b = Math.round(clamp(toNum(bounce), 0, 1.5) * 10) / 10, f = Math.round(clamp(toNum(friction), 0, 2) * 10) / 10, key = b + '_' + f;
    if (this._materials.has(key)) return this._materials.get(key);
    const m = new CANNON.Material(key); m.userData = { b, f };
    for (const other of this._materials.values()) this.world.addContactMaterial(new CANNON.ContactMaterial(m, other, { friction: (f + other.userData.f) / 2, restitution: Math.max(b, other.userData.b) }));
    this.world.addContactMaterial(new CANNON.ContactMaterial(m, m, { friction: f, restitution: b }));
    this._materials.set(key, m); return m;
  }
  /* ---------- editor selection ---------- */
  select(o){ this.selected = o; this.selBox.visible = !!o && !this.playing; }
  setSelection(list){   // extra outlines for multi-select (primary keeps the bright box)
    this._selPool = this._selPool || [];
    const extra = list.filter(o => o !== this.selected);
    while (this._selPool.length < extra.length){ const h = new THREE.BoxHelper(new THREE.Mesh(new THREE.BoxGeometry(1,1,1)), 0xa78bfa); h.material.depthTest = false; h.material.transparent = true; h.material.opacity = 0.6; h.renderOrder = 998; this.scene.add(h); this._selPool.push(h); }
    this._selPool.forEach((h, i) => { h.userData.obj = extra[i] || null; h.visible = !!extra[i]; });
  }
  dropToGround(o){
    o.root.updateMatrixWorld(true); const box = o.worldBox();
    this.raycaster.set(new THREE.Vector3(o.root.position.x, box.max.y + 200, o.root.position.z), new THREE.Vector3(0, -1, 0)); this.raycaster.far = 1000;
    const hits = this.raycaster.intersectObjects(this.objects.filter(x => x !== o && x.root.visible && !x.isLight && x.kind !== 'text').map(x => x.root), true).filter(h => !h.object.isSprite && h.point.y < box.min.y + 0.001 + 1e-3 || true);
    let groundY = 0; for (const h of hits){ let n = h.object; while (n && !n.userData.obj) n = n.parent; if (n && n.userData.obj !== o && !h.object.isSprite){ if (h.point.y <= box.max.y + 200){ groundY = h.point.y; break; } } }
    o.data.position[1] += groundY - box.min.y; o.applyProps();
  }
  mouseGround(){ return this.pickPoint(this._lastMouse.x, this._lastMouse.y, 0); }
  /* ---------- play / stop ---------- */
  play(scriptsById){
    if (this.playing) this.stop();
    this._snapshot = { camera: { position: this.camera.position.toArray(), target: this.controls.target.toArray() }, stage: JSON.parse(JSON.stringify(this.project.stage)), ui: JSON.parse(JSON.stringify(this.project.ui || [])),
      objects: this.objects.map(o => ({ o, data: JSON.parse(JSON.stringify(o.data)) })) };
    const rt = this.rt; rt.threads = []; rt.time = 0; rt.timerStart = 0; rt.timeScale = 1; rt.vars.clear(); rt.lists.clear(); rt.monitors.clear(); rt.touchPrev.clear(); rt.pairs.clear(); rt.timerFired.clear(); rt.hudTexts = { top: '', bottom: '' }; rt.particles.clear();
    for (const v of this.project.variables || []) rt.vars.set(v.name || v, 0);
    for (const l of this.project.lists || []) rt.lists.set(l.name || l, []);
    const noop = () => {}, gen = function*(){};
    this.stageObj = { id: 'stage', name: 'Stage', scripts: scriptsById.stage || [], root: new THREE.Group(), isStage: true, pos(){ return this.root.position; }, dir(){ return 0; }, size(){ return 100; }, vel: () => 0, onGround: () => false, touching: () => false, distanceTo: () => 0, rayHit: () => null, heightAboveGround: () => 0, procs: {} };
    for (const k of Object.getOwnPropertyNames(SceneObject.prototype)){ if (k === 'constructor' || this.stageObj[k]) continue; const d = Object.getOwnPropertyDescriptor(SceneObject.prototype, k); if (typeof d.value === 'function') this.stageObj[k] = d.value.constructor.name === 'GeneratorFunction' ? gen : noop; }
    this.physicsActive = true;
    for (const o of this.objects){ o.scripts = scriptsById[o.id] || []; o.sizePct = 100; o.baseScale = o.data.scale.slice(); o.applyProps(); o.rebuildBody(); }
    this.grid.visible = false; this.selBox.visible = false; this.hoverBox.visible = false; if (this._selPool) this._selPool.forEach(h => h.visible = false); this.playing = true; this.hudDirty = true;
    rt.cam.reset(); rt.synth.ensure();
    this.showBigText(''); this.renderUI(true);
    rt.startHats('flag');
    if (this.onPlayState) this.onPlayState(true);
  }
  stop(){
    if (!this.playing) return;
    this.playing = false; this.physicsActive = false;
    this.rt.threads = []; this.rt.cam.reset(); this.rt.input.keys.clear(); this.rt.synth.stopAll(); this.rt.particles.clear();
    for (const o of this.objects.slice()) if (o.isClone) this.removeObject(o);
    for (const o of this.objects){ if (o.body){ this.world.removeBody(o.body); o.body = null; } o.stopAnim(); this.setLabel(o, ''); }
    if (this._snapshot){
      for (const { o, data } of this._snapshot.objects) if (this.objects.includes(o)) { Object.assign(o.data, data); o.applyProps(); }
      Object.assign(this.project.stage, this._snapshot.stage); this.project.ui = this._snapshot.ui;
      this.camera.position.fromArray(this._snapshot.camera.position); this.controls.target.fromArray(this._snapshot.camera.target); this.controls.update();
      this._snapshot = null;
    }
    this.grid.visible = this.editor; this.selBox.visible = !!this.selected; this.showBigText(''); this.rt.monitors.clear(); this.rt.hudTexts = { top: '', bottom: '' }; this.renderHud(); this.applyStage(); this.renderUI(false);
    if (this.onPlayState) this.onPlayState(false);
  }
  reportError(msg){ if (this.onError) this.onError(msg); }
  /* ---------- UI maker (labels, buttons, bars, panels, images) ---------- */
  renderUI(interactive){
    if (!this.hud) return;
    let box = this.hud.querySelector('.bw-ui'); if (!box){ box = document.createElement('div'); box.className = 'bw-ui'; this.hud.appendChild(box); if (window.ResizeObserver) new ResizeObserver(() => this.refreshUISizes()).observe(this.hud); }
    box.innerHTML = ''; box.classList.toggle('live', !!interactive); this._uiEls = new Map();
    for (const el of this.project.ui || []){
      const d = document.createElement('div'); d.className = 'bw-el bw-' + el.type; d.dataset.id = el.id; d.dataset.name = el.name;
      if (el.type === 'bar'){ d.innerHTML = '<div class="fill"></div><span class="lbl"></span>'; }
      else if (el.type !== 'image') { d.innerHTML = '<span class="lbl"></span>'; }
      const rs = document.createElement('i'); rs.className = 'bw-rs'; d.appendChild(rs);
      if (interactive && el.type === 'button'){ d.addEventListener('pointerdown', ev => { ev.stopPropagation(); d.classList.add('down'); this.rt.uiDown.add(el.name); this.rt.startHats('uiclick', s => s.name === el.name); }); const up = () => { d.classList.remove('down'); this.rt.uiDown.delete(el.name); }; d.addEventListener('pointerup', up); d.addEventListener('pointerleave', up); }
      box.appendChild(d); this._uiEls.set(el.id, d); this.updateUI(el);
    }
  }
  updateUI(el){
    const d = this._uiEls && this._uiEls.get(el.id); if (!d) return;
    const H = this.hud.clientHeight || 300;
    Object.assign(d.style, { left: el.x + '%', top: el.y + '%', width: el.w + '%', height: el.h + '%', fontSize: (toNum(el.size) || 4) / 100 * H + 'px', color: el.color || '#fff', background: el.type === 'label' ? 'transparent' : (el.bg || 'transparent'), display: el.visible === false ? 'none' : '', textAlign: el.align || 'center' });
    if (el.type === 'image'){ d.style.backgroundImage = el.url ? 'url("' + el.url + '")' : ''; d.style.backgroundColor = el.url ? 'transparent' : (el.bg || '#ffffff33'); }
    const lbl = d.querySelector('.lbl'); if (lbl) lbl.textContent = toStr(el.text ?? '');
    if (el.type === 'bar'){ const f = d.querySelector('.fill'); f.style.width = clamp(toNum(el.value), 0, 100) + '%'; f.style.background = el.color || '#4cbf56'; d.style.color = '#fff'; d.style.background = el.bg || 'rgba(0,0,0,.45)'; }
    d.style.borderRadius = (el.radius == null ? 10 : el.radius) + 'px';
  }
  refreshUISizes(){ for (const el of this.project.ui || []) this.updateUI(el); }
  uiFind(name){ return (this.project.ui || []).find(u => u.name === name); }
  /* ---------- HUD ---------- */
  showBigText(t){ if (!this.hud) return; let el = this.hud.querySelector('.bw-bigtext'); if (!el){ el = document.createElement('div'); el.className = 'bw-bigtext'; this.hud.appendChild(el); } el.textContent = t; el.style.display = t ? '' : 'none'; }
  flash(color, secs){ if (!this.hud) return; let el = this.hud.querySelector('.bw-flash'); if (!el){ el = document.createElement('div'); el.className = 'bw-flash'; this.hud.appendChild(el); } el.style.background = color; el.style.transition = 'none'; el.style.opacity = '0.8'; requestAnimationFrame(() => { el.style.transition = 'opacity ' + Math.max(0.05, secs) + 's'; el.style.opacity = '0'; }); }
  renderHud(){
    if (!this.hud) return;
    let box = this.hud.querySelector('.bw-monitors'); if (!box){ box = document.createElement('div'); box.className = 'bw-monitors'; this.hud.appendChild(box); }
    box.innerHTML = '';
    for (const k of this.rt.monitors){
      const d = document.createElement('div');
      if (k.startsWith('list:')){ const name = k.slice(5); d.className = 'bw-listmon'; const h = document.createElement('div'); h.className = 'k'; h.textContent = name; d.appendChild(h); const ul = document.createElement('div'); ul.className = 'items'; (this.rt.lists.get(name) || []).forEach((v, i) => { const r = document.createElement('div'); r.innerHTML = '<span></span><b></b>'; r.firstChild.textContent = i + 1; r.lastChild.textContent = toStr(v); ul.appendChild(r); }); d.appendChild(ul); }
      else { d.className = 'bw-monitor'; d.innerHTML = '<span class="k"></span><span class="v"></span>'; d.querySelector('.k').textContent = k; d.querySelector('.v').textContent = toStr(this.rt.vars.get(k) ?? 0); }
      box.appendChild(d);
    }
    for (const pos of ['top','bottom']){ let el = this.hud.querySelector('.bw-hudtext.' + pos); if (!el){ el = document.createElement('div'); el.className = 'bw-hudtext ' + pos; this.hud.appendChild(el); } el.textContent = this.rt.hudTexts[pos]; el.style.display = this.rt.hudTexts[pos] ? '' : 'none'; }
    this.hudDirty = false;
  }
  setLabel(o, text){
    if (o.label){ o.root.remove(o.label); o.label.material.map.dispose(); o.label.material.dispose(); o.label = null; }
    if (!text) return;
    const c = document.createElement('canvas'); const ctx = c.getContext('2d'); ctx.font = 'bold 40px Helvetica, Arial, sans-serif';
    const w = Math.min(900, ctx.measureText(text).width + 50); c.width = Math.ceil(w); c.height = 84;
    ctx.font = 'bold 40px Helvetica, Arial, sans-serif'; ctx.fillStyle = 'rgba(255,255,255,0.95)';
    ctx.beginPath(); ctx.roundRect(4, 4, c.width - 8, 68, 24); ctx.fill(); ctx.strokeStyle = '#575e75'; ctx.lineWidth = 3; ctx.stroke();
    ctx.fillStyle = '#222'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText(text, c.width / 2, 40, c.width - 30);
    const tex = new THREE.CanvasTexture(c); tex.colorSpace = THREE.SRGBColorSpace;
    const sp = new THREE.Sprite(new THREE.SpriteMaterial({ map: tex, depthTest: false, transparent: true }));
    const h = 0.6;
    sp.scale.set(h * c.width / c.height / o.root.scale.x, h / o.root.scale.y, 1);
    sp.position.set(0, o.localBox.max.y + 0.5 / o.root.scale.y, 0); sp.renderOrder = 999; sp.userData.text = text;
    o.root.add(sp); o.label = sp;
  }
  /* ---------- thumbnails ---------- */
  _thumbSetup(){
    if (this._thumb) return this._thumb;
    const canvas = document.createElement('canvas'); canvas.width = canvas.height = 128;
    const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true, preserveDrawingBuffer: true });
    renderer.setPixelRatio(1); renderer.setSize(128, 128, false); renderer.toneMapping = THREE.ACESFilmicToneMapping;
    const scene = new THREE.Scene();
    scene.add(new THREE.HemisphereLight(0xffffff, 0x556677, 1.1));
    const key = new THREE.DirectionalLight(0xffffff, 2.2); key.position.set(3, 5, 4); scene.add(key);
    const camera = new THREE.PerspectiveCamera(32, 1, 0.01, 1000);
    return (this._thumb = { canvas, renderer, scene, camera });
  }
  thumbnail(o){
    if (!o.ready || !o.mesh) return '';
    const t = this._thumbSetup(), parent = o.root.parent, wasVisible = o.root.visible;
    if (t.canvas.height !== 128) t.renderer.setSize(128, 128, false);
    t.camera.aspect = 1;
    const pos = o.root.position.clone(), quat = o.root.quaternion.clone();
    o.root.position.set(0, 0, 0); o.root.quaternion.identity(); o.root.visible = true;
    t.scene.add(o.root); o.root.updateMatrixWorld(true);
    const box = o.worldBox(); const c = new THREE.Vector3(), sz = new THREE.Vector3(); box.getCenter(c); box.getSize(sz);
    const r = Math.max(0.05, sz.length() / 2);
    t.camera.position.copy(c).add(new THREE.Vector3(1, 0.75, 1.35).normalize().multiplyScalar(r * 3.4)); t.camera.lookAt(c);
    t.camera.near = r * 0.05; t.camera.far = r * 20; t.camera.updateProjectionMatrix();
    const label = o.label; if (label) label.visible = false;
    t.renderer.render(t.scene, t.camera);
    if (label) label.visible = true;
    o.root.position.copy(pos); o.root.quaternion.copy(quat); o.root.visible = wasVisible;
    if (parent) parent.add(o.root); else t.scene.remove(o.root);
    o.root.updateMatrixWorld(true);
    return t.canvas.toDataURL('image/png');
  }
  sceneThumbnail(){
    const t = this._thumbSetup(); const cam = this.camera.clone(); cam.aspect = 4 / 3; cam.updateProjectionMatrix();
    const hid = [this.grid, this.selBox, this.hoverBox, this._gizmoHelper, this.brush].filter(Boolean).map(h => [h, h.visible]); hid.forEach(([h]) => h.visible = false);
    if (t.canvas.height !== 96) t.renderer.setSize(128, 96, false);
    t.renderer.render(this.scene, cam);
    hid.forEach(([h, v]) => h.visible = v);
    return t.canvas.toDataURL('image/png');
  }
  /* ---------- input ---------- */
  _bindInput(){
    this._lastMouse = { x: 0, y: 0 };
    const keyName = e => { const k = e.key; const map = { ' ': 'space', ArrowUp: 'up arrow', ArrowDown: 'down arrow', ArrowLeft: 'left arrow', ArrowRight: 'right arrow', Enter: 'enter', Shift: 'shift' }; return map[k] || (k.length === 1 ? k.toLowerCase() : null); };
    window.addEventListener('keydown', e => {
      if (!this.playing) return; if (e.target && /INPUT|TEXTAREA|SELECT/.test(e.target.tagName)) return;
      const k = keyName(e); if (k){ this.rt.input.keys.add(k); if (/arrow|space/.test(k)) e.preventDefault(); }
    });
    window.addEventListener('keyup', e => { const k = keyName(e); if (k) this.rt.input.keys.delete(k); });
    window.addEventListener('blur', () => { this.rt.input.keys.clear(); this.fly.keys.clear(); });
    const c = this.canvas;
    c.addEventListener('pointerdown', e => {
      this._lastMouse = { x: e.clientX, y: e.clientY };
      if (!this.playing) return;
      this.rt.input.mouseDown = true;
      if (this.rt.cam.mouse && document.pointerLockElement !== c) c.requestPointerLock();
      const o = this.pick(e.clientX, e.clientY);
      if (o) for (const s of (o.scripts || [])) if (s.hat === 'click') this.rt.start(o, s);
    });
    window.addEventListener('pointerup', () => { this.rt.input.mouseDown = false; });
    c.addEventListener('pointermove', e => {
      this._lastMouse = { x: e.clientX, y: e.clientY };
      const r = c.getBoundingClientRect();
      this.rt.input.mouseX = Math.round(((e.clientX - r.left) / r.width - 0.5) * 480 * 2) / 2; this.rt.input.mouseY = Math.round((0.5 - (e.clientY - r.top) / r.height) * 360 * 2) / 2;
      if (this.playing) this.rt.cam.onMouseMove(e.movementX, e.movementY);
    });
  }
  ndc(cx, cy){ const r = this.canvas.getBoundingClientRect(); return new THREE.Vector2(((cx - r.left) / r.width) * 2 - 1, -((cy - r.top) / r.height) * 2 + 1); }
  pick(cx, cy){
    this.raycaster.setFromCamera(this.ndc(cx, cy), this.camera); this.raycaster.far = Infinity;
    const hits = this.raycaster.intersectObjects(this.objects.filter(o => o.root.visible).map(o => o.root), true);
    for (const h of hits){ let n = h.object; while (n && !n.userData.obj) n = n.parent; if (n && n.userData.obj && !(h.object.isSprite && h.object.userData.text)) return n.userData.obj; }
    return null;
  }
  pickPoint(cx, cy, planeY=0){ this.raycaster.setFromCamera(this.ndc(cx, cy), this.camera); const p = new THREE.Vector3(); return this.raycaster.ray.intersectPlane(new THREE.Plane(new THREE.Vector3(0,1,0), -planeY), p) ? p : null; }
  pickTerrain(o, cx, cy){ this.raycaster.setFromCamera(this.ndc(cx, cy), this.camera); this.raycaster.far = Infinity; const h = this.raycaster.intersectObject(o.mesh, false); return h.length ? h[0].point : null; }
  groundHeightAt(x, z){ this.raycaster.set(new THREE.Vector3(x, 500, z), new THREE.Vector3(0, -1, 0)); this.raycaster.far = 2000; const hits = this.raycaster.intersectObjects(this.objects.filter(o => o.root.visible && !o.isLight && o.kind !== 'text').map(o => o.root), true).filter(h => !h.object.isSprite); return hits.length ? Math.round(hits[0].point.y * 100) / 100 : 0; }
  pickSurface(cx, cy){ this.raycaster.setFromCamera(this.ndc(cx, cy), this.camera); this.raycaster.far = Infinity; const hits = this.raycaster.intersectObjects(this.objects.filter(o => o.root.visible && !o.isLight && o.kind !== 'text').map(o => o.root), true).filter(h => !h.object.isSprite); return hits.length ? hits[0].point : this.pickPoint(cx, cy, 0); }
  /* ---------- editor fly camera ---------- */
  flyStep(dt){
    const k = this.fly.keys; if (!k.size || this.playing) return;
    const sp = this.fly.speed * (k.has('shift') ? 3 : 1) * dt;
    const fwd = new THREE.Vector3(); this.camera.getWorldDirection(fwd); const right = new THREE.Vector3().crossVectors(fwd, new THREE.Vector3(0, 1, 0)).normalize();
    const mv = new THREE.Vector3();
    if (k.has('w')) mv.add(fwd); if (k.has('s')) mv.sub(fwd); if (k.has('d')) mv.add(right); if (k.has('a')) mv.sub(right); if (k.has('e')) mv.y += 1; if (k.has('q')) mv.y -= 1;
    if (mv.lengthSq()){ mv.normalize().multiplyScalar(sp); this.camera.position.add(mv); this.controls.target.add(mv); }
  }
  lookAround(dx, dy){
    // rotate the camera in place (right-drag), then re-aim the orbit target in front of it
    const dist = this.camera.position.distanceTo(this.controls.target);
    const q = new THREE.Quaternion(); const e = new THREE.Euler().setFromQuaternion(this.camera.quaternion, 'YXZ');
    e.y -= dx * 0.0035; e.x = clamp(e.x - dy * 0.0035, -1.5, 1.5); q.setFromEuler(e); this.camera.quaternion.copy(q);
    const fwd = new THREE.Vector3(); this.camera.getWorldDirection(fwd); this.controls.target.copy(this.camera.position).add(fwd.multiplyScalar(dist));
  }
  /* ---------- frame loop ---------- */
  resize(){
    const c = this.canvas, w = c.clientWidth || 1, h = c.clientHeight || 1, pr = this.renderer.getPixelRatio();
    if (c.width !== Math.floor(w * pr) || c.height !== Math.floor(h * pr)){ this.renderer.setSize(w, h, false); this.camera.aspect = w / h; this.camera.updateProjectionMatrix(); }
  }
  _loop(){
    requestAnimationFrame(this._loop);
    this.resize();
    const raw = Math.min(0.05, this.clock.getDelta());
    if (this.playing){
      if (this.brush.visible) this.brush.visible = false;
      const dt = raw * this.rt.timeScale;
      this.rt.time += dt;
      this.rt.step();
      this.world.step(1 / 60, dt, 4);
      this.rt.updateContacts();
      const floor = -40 - this.worldExtent() * 0.2;
      for (const o of this.objects){ if (o.body) o.syncFromBody(); if (o.mixer) o.mixer.update(dt); if (o.body && o.body.mass > 0 && o.root.position.y < floor){ const s = this._snapshot && this._snapshot.objects.find(x => x.o === o); const p = s ? s.data.position : [0, 5, 0]; o.goTo(p[0], Math.max(p[1], this.groundHeightAt(p[0], p[2]) + 2), p[2]); } }
      this.scene.updateMatrixWorld();
      this.rt.fireTouchHats();
      this.rt.cam.update(raw);
      this.rt.particles.update(dt);
      if (this.hudDirty) this.renderHud();
    } else {
      this.flyStep(raw);
      if (this.selected && this.selected.root.parent){ this.selBox.setFromObject(this.selected.root); this.selBox.visible = true; } else this.selBox.visible = false;
      if (this._selPool) for (const h of this._selPool){ if (h.userData.obj && h.userData.obj.root.parent){ h.setFromObject(h.userData.obj.root); h.visible = true; } else h.visible = false; }
      if (this.hovered && this.hovered !== this.selected && this.hovered.root.parent){ this.hoverBox.setFromObject(this.hovered.root); this.hoverBox.visible = true; } else this.hoverBox.visible = false;
    }
    if (this.controls.enabled) this.controls.update();
    const focus = this.rt.cam.target && this.playing ? this.rt.cam.target.root.position : this.controls.target;
    this.sun.target.position.copy(focus); this.sun.position.copy(focus).add((this.sunDir || new THREE.Vector3(0.45, 0.8, 0.35)).clone().multiplyScalar(60));
    this.sky.dome.position.copy(this.camera.position); this.sky.stars.position.copy(this.camera.position); this.sky.sunDisc.position.copy(this.camera.position).add((this.sunDir || new THREE.Vector3(0.45,0.8,0.35)).clone().multiplyScalar(395));
    this.renderer.render(this.scene, this.camera);
    this.stats.objects = this.objects.length; this.stats.bodies = this.world.bodies.length; this.stats.threads = this.rt.threads.length;
    this._fpsN++; this._fpsT += raw; if (this._fpsT >= 0.5){ this.fps = Math.round(this._fpsN / this._fpsT); this._fpsN = 0; this._fpsT = 0; }
  }
}
