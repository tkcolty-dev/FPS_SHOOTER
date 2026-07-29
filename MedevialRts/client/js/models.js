// ══════════════════════════════════════════════════════════════════════════
// THE ART FILE — every 3D model in the game is built here.
//
// Codex: this is YOUR file. Make these models awesome. Each builder returns a
// THREE.Group whose footprint roughly fills the entity's size (world units);
// the renderer only cares about:
//   • group.userData.blades  — windmill blades group (renderer spins it)
//   • group.userData.tint    — array of materials to color with the OWNER
//                              color (team blue/red/yellow/green)
// Buildings should use the `pal` skin palette (stone/stoneDark/wood/roof) so
// kingdom skins keep working. Units get `ownerColor` for their body.
// Keep it low-poly chunky-cute. Don't change any other file.
// ══════════════════════════════════════════════════════════════════════════

import * as THREE from 'three';

const mat = (color, opts = {}) => new THREE.MeshLambertMaterial({ color, ...opts });

function box(w, h, d, color, x = 0, y = 0, z = 0) {
  const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat(color));
  m.position.set(x, y + h / 2, z);
  return m;
}
function cyl(rTop, rBot, h, color, x = 0, y = 0, z = 0, seg = 10) {
  const m = new THREE.Mesh(new THREE.CylinderGeometry(rTop, rBot, h, seg), mat(color));
  m.position.set(x, y + h / 2, z);
  return m;
}
function cone(r, h, color, x = 0, y = 0, z = 0, seg = 10) {
  const m = new THREE.Mesh(new THREE.ConeGeometry(r, h, seg), mat(color));
  m.position.set(x, y + h / 2, z);
  return m;
}
function ball(r, color, x = 0, y = 0, z = 0, seg = 10) {
  const m = new THREE.Mesh(new THREE.SphereGeometry(r, seg, seg), mat(color));
  m.position.set(x, y, z);
  return m;
}
// pyramid roof (4-sided cone rotated to sit square)
function roof(w, h, color, x = 0, y = 0, z = 0) {
  const m = cone(w * 0.75, h, color, x, y, z, 4);
  m.rotation.y = Math.PI / 4;
  return m;
}
function flag(colorHex, h, g) {
  const pole = cyl(1.4, 1.4, 26, '#3b2c17', 0, h, 0, 6);
  const cloth = box(14, 8, 1.5, colorHex, 8, h + 16, 0);
  g.add(pole, cloth);
  g.userData.tint.push(cloth.material);
}

// ---------------------------------------------------------------- buildings

function castle(pal, ownerColor, g) {
  g.add(box(96, 52, 96, pal.stone));
  for (const [dx, dz] of [[-48, -48], [48, -48], [-48, 48], [48, 48]]) {
    g.add(cyl(16, 18, 84, pal.stoneDark, dx, 0, dz));
    g.add(cone(20, 26, pal.roof, dx, 84, dz));
  }
  g.add(box(30, 34, 6, '#241a10', 0, 0, 48));         // gate
  g.add(box(70, 26, 70, pal.stoneDark, 0, 52, 0));    // keep
  flag(ownerColor, 78, g);
}

function windmill(pal, ownerColor, g) {
  g.add(cyl(20, 27, 56, pal.wood));
  g.add(cone(24, 24, pal.roof, 0, 56, 0));
  const blades = new THREE.Group();
  for (let i = 0; i < 4; i++) {
    const b = box(52, 9, 2, '#efe3c0', 26, -4.5, 0);
    const holder = new THREE.Group();
    holder.rotation.z = i * Math.PI / 2;
    holder.add(b);
    blades.add(holder);
  }
  blades.position.set(0, 60, 26);
  g.add(blades);
  g.userData.blades = blades;
  flag(ownerColor, 66, g);
}

function hall(pal, ownerColor, g, roofColor, w = 80, d = 58) {
  g.add(box(w, 34, d, pal.wood));
  g.add(roof(w, 30, roofColor, 0, 34, 0));
  g.add(box(18, 22, 4, '#241a10', 0, 0, d / 2));
  flag(ownerColor, 60, g);
}

function barracks(pal, ownerColor, g) {
  hall(pal, ownerColor, g, '#6d3535');
  const sw = box(4, 26, 4, '#cfcfcf', -34, 30, 24);
  sw.rotation.z = 0.5;
  g.add(sw);
}
function stables(pal, ownerColor, g) {
  hall(pal, ownerColor, g, '#5c4a2e', 88, 52);
  g.add(box(50, 14, 8, pal.wood, 0, 0, 34)); // corral fence
}
function workshop(pal, ownerColor, g) {
  hall(pal, ownerColor, g, '#44505c');
  const wheel = cyl(14, 14, 4, '#6b4e2a', 44, 12, 0, 8);
  wheel.rotation.z = Math.PI / 2;
  g.add(wheel);
}

function tower(pal, ownerColor, g) {
  g.add(cyl(20, 26, 78, pal.stoneDark));
  g.add(cyl(26, 26, 12, pal.stone, 0, 78, 0));
  g.add(cone(22, 24, pal.roof, 0, 90, 0));
  flag(ownerColor, 100, g);
}

// ---------------------------------------------------------------- terrain

export function buildFarm() {
  const g = new THREE.Group();
  g.userData.tint = [];
  const bed = box(100, 3, 84, '#c9a94f');
  g.add(bed);
  for (let i = -2; i <= 2; i++) g.add(box(96, 3, 6, '#a8853a', 0, 1.5, i * 16));
  g.add(box(6, 12, 6, '#6e5222', -46, 0, -38));
  return g;
}

export function buildTree(v) {
  const g = new THREE.Group();
  g.add(cyl(4, 6, 18, '#5b4426'));
  if (v === 1) { g.add(ball(20, '#2e5d2b', 0, 34, 0)); }
  else if (v === 2) { g.add(cone(18, 40, '#356b31', 0, 14, 0)); }
  else { g.add(ball(15, '#2a5527', -8, 28, 0)); g.add(ball(17, '#356b31', 8, 36, 0)); }
  return g;
}

// ---------------------------------------------------------------- units

function unitBase(g, ownerColor, r = 10, h = 18) {
  const body = cyl(r * 0.75, r, h, ownerColor, 0, 0, 0, 8);
  g.add(body);
  g.userData.tint.push(body.material);
  g.add(ball(6.5, '#e8c9a0', 0, h + 6, 0, 8)); // head
  return body;
}

function builderU(pal, ownerColor, g) {
  unitBase(g, ownerColor);
  const handle = box(2.5, 14, 2.5, '#c9a94f', 10, 14, 0);
  handle.rotation.z = -0.6;
  g.add(handle, box(7, 5, 5, '#9a9a9a', 14, 24, 0));
}
function swordsman(pal, ownerColor, g) {
  unitBase(g, ownerColor);
  const sw = box(2.5, 20, 2.5, '#d8d8d8', 11, 12, 0);
  sw.rotation.z = -0.35;
  g.add(sw);
}
function archer(pal, ownerColor, g) {
  unitBase(g, ownerColor);
  const bow = new THREE.Mesh(new THREE.TorusGeometry(9, 1.2, 6, 10, Math.PI), mat('#8a6b45'));
  bow.position.set(11, 16, 0);
  bow.rotation.z = -Math.PI / 2;
  g.add(bow);
}
function knight(pal, ownerColor, g) {
  const horse = box(26, 14, 12, '#5b4426', 0, 6, 0);
  g.add(horse);
  g.add(box(8, 8, 10, '#5b4426', 15, 16, 0)); // horse head
  const body = cyl(6, 7.5, 16, ownerColor, -2, 20, 0, 8);
  g.add(body);
  g.userData.tint.push(body.material);
  g.add(cone(6, 9, '#cfcfcf', -2, 36, 0, 8)); // helmet
  const lance = cyl(1.3, 1.3, 30, '#d8d8d8', 8, 24, 0, 6);
  lance.rotation.z = -0.9;
  g.add(lance);
}
function catapult(pal, ownerColor, g) {
  g.add(box(34, 8, 22, '#6b4e2a', 0, 6, 0));
  for (const [dx, dz] of [[-13, -12], [13, -12], [-13, 12], [13, 12]]) {
    const w = cyl(6, 6, 4, '#3d2c19', dx, 4, dz, 8);
    w.rotation.x = Math.PI / 2;
    g.add(w);
  }
  const arm = box(4, 34, 4, '#8a6b45', 0, 12, 0);
  arm.rotation.z = -0.7;
  g.add(arm);
  const bucket = ball(5, '#555', 14, 34, 0, 8);
  g.add(bucket);
  const trim = box(10, 4, 24, ownerColor, -12, 14, 0);
  g.add(trim);
  g.userData.tint.push(trim.material);
}
function balloon(pal, ownerColor, g) {
  const env = ball(22, ownerColor, 0, 46, 0, 12);
  g.add(env);
  g.userData.tint.push(env.material);
  g.add(cone(14, 12, '#efe3c0', 0, 14, 0, 8));          // envelope skirt
  g.add(box(16, 12, 16, '#8a6b45', 0, 0, 0));           // basket
  for (const [dx, dz] of [[-8, -8], [8, -8], [-8, 8], [8, 8]]) {
    g.add(cyl(0.6, 0.6, 18, '#d8cba8', dx, 10, dz, 4)); // ropes
  }
}

// ---------------------------------------------------------------- registry

const BUILDERS = {
  castle, windmill, barracks, stables, workshop, tower,
  builder: builderU, swordsman, archer, knight, catapult, balloon,
};

// Main entry: the renderer calls this for every entity that appears.
export function buildEntityMesh(kind, pal, ownerColorHex) {
  const g = new THREE.Group();
  g.userData.tint = [];
  const fn = BUILDERS[kind];
  if (fn) fn(pal, ownerColorHex, g);
  else g.add(box(20, 20, 20, '#ff00ff')); // unknown kind — loud placeholder
  return g;
}
