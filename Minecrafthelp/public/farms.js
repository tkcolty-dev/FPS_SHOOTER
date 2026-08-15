// 3D build tutorials that play like videos: real Minecraft textures, step-by-step
// captions, play/pause + scrubbing. Uses three.js.
import * as THREE from './vendor/three.module.js';

// ---------- texture loading ----------
const loader = new THREE.TextureLoader();
const texCache = {};
function tex(name, { animFrames, folder } = {}) {
  const key = (folder || 'block') + name + (animFrames || '');
  if (texCache[key]) return texCache[key];
  const url = name.includes('/') ? name : 'tex/' + (folder || 'block') + '/' + name + '.png';
  const t = loader.load(url, (tt) => {
    // tall strips are animated textures — crop to the first frame
    const img = tt.image;
    if (img && img.height > img.width && !animFrames) {
      tt.repeat.set(1, img.width / img.height);
      tt.offset.set(0, 1 - img.width / img.height);
    }
  });
  t.magFilter = THREE.NearestFilter;
  t.minFilter = THREE.NearestFilter;
  t.colorSpace = THREE.SRGBColorSpace;
  if (animFrames) {
    t.repeat.set(1, 1 / animFrames);
    t.offset.set(0, 1 - 1 / animFrames);
    t.userData.animFrames = animFrames;
    animatedTextures.push(t);
  }
  texCache[key] = t;
  return t;
}
const animatedTextures = [];

function mat(name, { tint, transparent, opacity, animFrames } = {}) {
  return new THREE.MeshLambertMaterial({
    map: tex(name, { animFrames }),
    color: tint ? new THREE.Color(tint) : 0xffffff,
    transparent: !!transparent || !!opacity,
    opacity: opacity ?? 1,
    alphaTest: transparent && !opacity ? 0.5 : 0,
    side: transparent ? THREE.DoubleSide : THREE.FrontSide,
  });
}

// face order: +x, -x, +y(top), -y(bottom), +z, -z
function cubeMats({ all, top, bottom, side, face, back, facing }) {
  const s = side || all, t = top || all, b = bottom || side || all;
  let m = [s, s, t, b, s, s].map(x => x);
  if (face && facing) {
    const idx = { '+x': 0, '-x': 1, '+y': 2, '-y': 3, '+z': 4, '-z': 5 }[facing];
    const opp = { 0: 1, 1: 0, 2: 3, 3: 2, 4: 5, 5: 4 }[idx];
    m[idx] = face;
    if (back) m[opp] = back;
  }
  return m;
}

// ---------- block registry ----------
const GRASS = '#79c05a', FOLIAGE = '#59ae30';
const BLOCK_DEFS = {
  dirt: () => cubeMats({ all: mat('dirt') }),
  grass_block: () => cubeMats({ top: mat('grass_block_top', { tint: GRASS }), side: mat('grass_block_side'), bottom: mat('dirt') }),
  sand: () => cubeMats({ all: mat('sand') }),
  stone: () => cubeMats({ all: mat('stone') }),
  cobblestone: () => cubeMats({ all: mat('cobblestone') }),
  smooth_stone: () => cubeMats({ all: mat('smooth_stone') }),
  oak_planks: () => cubeMats({ all: mat('oak_planks') }),
  oak_log: () => cubeMats({ top: mat('oak_log_top'), side: mat('oak_log') }),
  glass: () => cubeMats({ all: mat('glass', { transparent: true }) }),
  farmland: () => cubeMats({ top: mat('farmland_moist'), side: mat('dirt') }),
  chest: () => cubeMats({ top: mat('oak_planks', { tint: '#c89653' }), side: mat('oak_planks', { tint: '#a87e43' }) }),
  hopper: () => cubeMats({ top: mat('hopper_inside'), side: mat('hopper_outside') }),
  water: () => cubeMats({ all: mat('water_still', { tint: '#3f76e4', opacity: 0.75, transparent: true, animFrames: 32 }) }),
  lava: () => cubeMats({ all: mat('lava_still', { animFrames: 20 }) }),
  trial_spawner: () => cubeMats({ top: mat('trial_spawner_top_inactive'), side: mat('trial_spawner_side_inactive'), bottom: mat('trial_spawner_side_inactive') }),
  vault: () => cubeMats({ face: mat('vault_front_off'), side: mat('vault_side_off'), top: mat('vault_top'), bottom: mat('vault_top'), back: mat('vault_side_off'), facing: '+z' }),
};
function pistonDef(facing, sticky) {
  return cubeMats({
    face: mat(sticky ? 'piston_top_sticky' : 'piston_top'),
    back: mat('piston_bottom'),
    side: mat('piston_side'),
    facing,
  });
}
function observerDef(facing) {
  return cubeMats({ face: mat('observer_front'), back: mat('observer_back'), side: mat('observer_side'), top: mat('observer_top'), bottom: mat('observer_top'), facing });
}
function commandDef(base, facing) {
  const side = mat(base + '_side');
  return cubeMats({ face: mat(base + '_front'), back: mat(base + '_back'), side, top: side, bottom: side, facing: facing || '+z' });
}
function frontBoxDef(front, facing) {
  return cubeMats({ face: mat(front), side: mat('furnace_side'), top: mat('furnace_top'), bottom: mat('furnace_top'), facing: facing || '+z' });
}

const boxGeo = new THREE.BoxGeometry(1, 1, 1);
const matsCache = {};
function blockMesh(type) {
  // cross-rendered blocks (plants, torches, levers)
  const cross = {
    wheat: ['wheat_stage7', 1, FOLIAGE ? null : null],
    wheat_young: ['wheat_stage3', 1],
    sugar_cane: ['sugar_cane', 1, '#71b755'],
    torch: ['torch', 0.7],
    redstone_torch: ['redstone_torch', 0.7],
    lever: ['lever', 0.6],
  };
  if (cross[type]) {
    const [texName, scale, tint] = cross[type];
    const g = new THREE.Group();
    const m = mat(texName, { transparent: true, tint });
    const plane = new THREE.PlaneGeometry(1, 1);
    for (const rot of [Math.PI / 4, -Math.PI / 4]) {
      const p = new THREE.Mesh(plane, m);
      p.rotation.y = rot;
      g.add(p);
    }
    g.scale.setScalar(scale);
    g.position.y = (scale - 1) / 2;
    const holder = new THREE.Group();
    holder.add(g);
    return holder;
  }
  // floating spawn-egg marker: shows where a mob goes ("marker|villager_spawn_egg")
  if (type.startsWith('marker|')) {
    const icon = type.split('|')[1];
    const known = (window.MC_TEX || {})[icon]; // resolved item texture path when the app knows one
    const m = new THREE.MeshBasicMaterial({
      map: known ? tex(known) : tex(icon, { folder: 'item' }),
      transparent: true, alphaTest: 0.5, side: THREE.DoubleSide,
    });
    const g = new THREE.Group();
    const plane = new THREE.PlaneGeometry(0.85, 0.85);
    for (const rot of [Math.PI / 4, -Math.PI / 4]) {
      const p = new THREE.Mesh(plane, m);
      p.rotation.y = rot;
      g.add(p);
    }
    return g;
  }
  // beds rendered as half-height wool (foot = red, head = white pillow)
  if (type === 'bed_foot' || type === 'bed_head') {
    const g = new THREE.Group();
    const m = new THREE.Mesh(boxGeo, cubeMats({ all: mat(type === 'bed_foot' ? 'red_wool' : 'white_wool') }));
    m.scale.set(1, 0.45, 0.95);
    m.position.y = -0.275;
    g.add(m);
    return g;
  }
  // trapdoor flap hanging from the ceiling of its cell
  if (type === 'trapdoor_top' || type === 'iron_trapdoor_top') {
    const g = new THREE.Group();
    const texName = type === 'iron_trapdoor_top' ? 'iron_trapdoor' : 'oak_trapdoor';
    const m = new THREE.Mesh(boxGeo, cubeMats({ all: mat(texName, { transparent: true }) }));
    m.scale.set(1, 0.12, 1);
    m.position.y = 0.44;
    g.add(m);
    return g;
  }
  // generic cube face materials from the game-asset map (used by cubes, slabs, stairs)
  function genericMats(name, extraOpts) {
    const bt = (window.MC_BLOCKTEX || {})[name];
    if (!bt) return null;
    const isGlass = name.includes('glass');
    const isLeaves = name.endsWith('_leaves');
    const opts = extraOpts || (isGlass || name === 'spawner' || name.includes('grate') ? { transparent: true }
      : isLeaves ? { transparent: true, tint: FOLIAGE }
      : (name === 'slime_block' || name === 'honey_block') ? { transparent: true, opacity: 0.82 }
      : {});
    const mk = (p) => (p ? mat(p, opts) : undefined);
    return cubeMats({
      all: mk(bt.all), top: mk(bt.top), bottom: mk(bt.bottom),
      side: mk(bt.side || bt.all || bt.top),
      face: mk(bt.front), back: mk(bt.side || bt.all || bt.top), facing: bt.front ? '+z' : undefined,
    });
  }
  // slabs: half-height block
  if (type.endsWith('_slab')) {
    const mats = genericMats(type) || cubeMats({ all: mat('stone') });
    const g = new THREE.Group();
    const m = new THREE.Mesh(boxGeo, mats);
    m.scale.set(1, 0.5, 1);
    m.position.y = -0.25;
    m.castShadow = m.receiveShadow = true;
    g.add(m);
    return g;
  }
  // stairs: half + step, DIR = the high side ("oak_stairs|+z")
  if (type.split('|')[0].endsWith('_stairs')) {
    const [base, dir] = type.split('|');
    const mats = genericMats(base) || cubeMats({ all: mat('oak_planks') });
    const g = new THREE.Group();
    const lower = new THREE.Mesh(boxGeo, mats);
    lower.scale.set(1, 0.5, 1);
    lower.position.y = -0.25;
    const upper = new THREE.Mesh(boxGeo, mats);
    upper.scale.set(1, 0.5, 0.5);
    upper.position.set(0, 0.25, 0.25);
    for (const m of [lower, upper]) { m.castShadow = m.receiveShadow = true; g.add(m); }
    g.rotation.y = { '+z': 0, '+x': Math.PI / 2, '-z': Math.PI, '-x': -Math.PI / 2 }[dir] || 0;
    return g;
  }
  // fences and walls: a thick center post
  if (type.endsWith('_fence') || type.endsWith('_wall')) {
    const mats = genericMats(type) || cubeMats({ all: mat('oak_planks') });
    const g = new THREE.Group();
    const m = new THREE.Mesh(boxGeo, mats);
    m.scale.set(0.35, 1, 0.35);
    m.castShadow = true;
    g.add(m);
    return g;
  }
  // flat/cross transparents
  if (['ladder', 'iron_bars', 'cobweb', 'vine', 'end_rod', 'chain'].includes(type)) {
    const g = new THREE.Group();
    const m = mat(type, { transparent: true });
    const plane = new THREE.PlaneGeometry(1, 1);
    for (const rot of [Math.PI / 4, -Math.PI / 4]) {
      const p = new THREE.Mesh(plane, m);
      p.rotation.y = rot;
      g.add(p);
    }
    return g;
  }
  // lanterns: small glowing box
  if (type === 'lantern' || type === 'soul_lantern') {
    const g = new THREE.Group();
    const m = new THREE.Mesh(boxGeo, new THREE.MeshBasicMaterial({ map: tex(type), transparent: true, alphaTest: 0.4 }));
    m.scale.set(0.4, 0.55, 0.4);
    m.position.y = -0.22;
    g.add(m);
    return g;
  }
  // repeater / comparator / daylight detector / sculk sensor & shrieker: flat slabs with real top textures
  if (['repeater', 'comparator', 'daylight_detector', 'sculk_sensor', 'sculk_shrieker'].includes(type)) {
    const cfgMap = {
      repeater: { h: 0.14, top: 'repeater', side: 'smooth_stone' },
      comparator: { h: 0.14, top: 'comparator', side: 'smooth_stone' },
      daylight_detector: { h: 0.38, top: 'daylight_detector_top', side: 'daylight_detector_side' },
      sculk_sensor: { h: 0.5, top: 'sculk_sensor_top', side: 'sculk_sensor_side' },
      sculk_shrieker: { h: 0.5, top: 'sculk_shrieker_top', side: 'sculk_shrieker_side' },
    };
    const cfg = cfgMap[type];
    const g = new THREE.Group();
    const h = cfg.h;
    const m = new THREE.Mesh(boxGeo, cubeMats({ top: mat(cfg.top, { transparent: true }), side: mat(cfg.side) }));
    m.scale.set(1, h, 1);
    m.position.y = -(1 - h) / 2;
    m.castShadow = m.receiveShadow = true;
    g.add(m);
    return g;
  }
  // buttons + pressure plates
  if (type === 'stone_button' || type === 'oak_button') {
    const g = new THREE.Group();
    const m = new THREE.Mesh(boxGeo, cubeMats({ all: mat(type === 'stone_button' ? 'stone' : 'oak_planks') }));
    m.scale.set(0.38, 0.14, 0.26);
    m.position.y = -0.43;
    g.add(m);
    return g;
  }
  if (type === 'stone_pressure_plate' || type === 'oak_pressure_plate') {
    const g = new THREE.Group();
    const m = new THREE.Mesh(boxGeo, cubeMats({ all: mat(type === 'stone_pressure_plate' ? 'stone' : 'oak_planks') }));
    m.scale.set(0.88, 0.07, 0.88);
    m.position.y = -0.465;
    g.add(m);
    return g;
  }
  // rails: flat on the ground
  if (type === 'rail' || type === 'powered_rail') {
    const m = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), mat(type === 'rail' ? 'rail' : 'powered_rail_on', { transparent: true }));
    m.rotation.x = -Math.PI / 2;
    m.position.y = -0.48;
    const holder = new THREE.Group();
    holder.add(m);
    return holder;
  }
  // doors: one cell = the whole 2-tall door panel
  if (type === 'iron_door' || type === 'oak_door') {
    const g = new THREE.Group();
    const base = type;
    for (const [texName, dy] of [[base + '_bottom', 0], [base + '_top', 1]]) {
      const m = new THREE.Mesh(boxGeo, cubeMats({ all: mat(texName, { transparent: true }) }));
      m.scale.set(0.94, 1, 0.12);
      m.position.set(0, dy, -0.42);
      m.castShadow = true;
      g.add(m);
    }
    return g;
  }
  if (type === 'redstone_wire') {
    const m = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), mat('redstone_dust_dot', { transparent: true, tint: '#ff2a00' }));
    m.rotation.x = -Math.PI / 2;
    m.position.y = -0.49;
    const holder = new THREE.Group();
    holder.add(m);
    return holder;
  }
  let materials;
  if (matsCache[type]) materials = matsCache[type];
  else {
    if (type.startsWith('piston')) {
      const f = type.split('|')[1] || '+z';
      materials = pistonDef(f, false);
    } else if (type.startsWith('sticky_piston')) {
      materials = pistonDef(type.split('|')[1] || '+z', true);
    } else if (type.startsWith('observer')) {
      materials = observerDef(type.split('|')[1] || '+z');
    } else if (type.startsWith('command_block') || type.startsWith('chain_command_block') || type.startsWith('repeating_command_block')) {
      materials = commandDef(type.split('|')[0], type.split('|')[1]);
    } else if (type.startsWith('dropper') || type.startsWith('dispenser')) {
      materials = frontBoxDef(type.split('|')[0] + '_front', type.split('|')[1]);
    } else if (BLOCK_DEFS[type]) {
      materials = BLOCK_DEFS[type]();
    } else if ((window.MC_BLOCKTEX || {})[type]) {
      // ANY Minecraft block: real face textures generated from the game assets
      materials = genericMats(type);
    } else {
      materials = cubeMats({ all: mat('stone') });
    }
    matsCache[type] = materials;
  }
  const mesh = new THREE.Mesh(boxGeo, materials);
  if (type === 'chest' || type === 'hopper') mesh.scale.set(0.92, 0.92, 0.92);
  if (type === 'water' || type === 'lava') mesh.scale.set(1, 0.88, 1);
  else { mesh.castShadow = true; mesh.receiveShadow = true; }
  return mesh;
}

// ---------- schematic helpers ----------
function fill(list, type, x1, y1, z1, x2, y2, z2) {
  for (let x = Math.min(x1, x2); x <= Math.max(x1, x2); x++)
    for (let y = Math.min(y1, y2); y <= Math.max(y1, y2); y++)
      for (let z = Math.min(z1, z2); z <= Math.max(z1, z2); z++)
        list.push([x, y, z, type]);
  return list;
}
function put(list, type, ...coords) {
  for (let i = 0; i < coords.length; i += 3) list.push([coords[i], coords[i + 1], coords[i + 2], type]);
  return list;
}

// ---------- tutorials ----------
const TUTORIALS = [];

// 1. Wheat farm
{
  const steps = [];
  steps.push({
    caption: 'Place a 9x9 square of dirt. This is your farm base.',
    blocks: fill([], 'dirt', 0, 0, 0, 8, 0, 8),
  });
  steps.push({
    caption: 'Dig out the CENTER block and fill it with a water bucket. Water keeps farmland wet up to 4 blocks away — exactly the whole 9x9!',
    blocks: put([], 'water', 4, 0, 4),
  });
  steps.push({
    caption: 'Use a hoe on every dirt block (right-click / tap). It becomes dark farmland.',
    blocks: (() => { const l = fill([], 'farmland', 0, 0, 0, 8, 0, 8); return l.filter(b => !(b[0] === 4 && b[2] === 4)); })(),
  });
  steps.push({
    caption: 'Plant wheat seeds on all the farmland. Get seeds by breaking tall grass.',
    blocks: (() => { const l = fill([], 'wheat_young', 0, 1, 0, 8, 1, 8); return l.filter(b => !(b[0] === 4 && b[2] === 4)); })(),
  });
  steps.push({
    caption: 'Put torches on the corners so crops grow at night and mobs stay away.',
    blocks: put([], 'torch', 0, 1, 0, 8, 1, 0, 0, 1, 8, 8, 1, 8),
    replace: [[0,1,0],[8,1,0],[0,1,8],[8,1,8]],
  });
  steps.push({
    caption: 'Wait for the wheat to turn golden (or speed it up with bone meal), then harvest and replant! 3 wheat in a crafting row = bread.',
    blocks: (() => { const l = fill([], 'wheat', 0, 1, 0, 8, 1, 8); return l.filter(b => !((b[0] === 4 && b[2] === 4) || ((b[0] === 0 || b[0] === 8) && (b[2] === 0 || b[2] === 8)))); })(),
    ed: 'Works exactly the same on Bedrock and Java.',
  });
  TUTORIALS.push({ name: '🌾 Wheat Farm', steps, cam: 16 });
}

// 2. Auto sugar cane farm
{
  const steps = [];
  steps.push({
    caption: 'Build the base: a 6x3 dirt platform.',
    blocks: fill([], 'dirt', 0, 0, 0, 5, 0, 2),
  });
  steps.push({
    caption: 'Row of SAND on top (sugar cane loves sand), and a WATER channel right next to it — cane must touch water.',
    blocks: fill(fill([], 'sand', 1, 1, 1, 4, 1, 1), 'water', 1, 1, 2, 4, 1, 2),
  });
  steps.push({
    caption: 'Plant sugar cane on every sand block.',
    blocks: fill([], 'sugar_cane', 1, 2, 1, 4, 2, 1),
  });
  steps.push({
    caption: 'Behind the cane: PISTONS at the 2nd-block height, all facing the cane.',
    blocks: fill([], 'piston|+z', 1, 3, 0, 4, 3, 0),
  });
  steps.push({
    caption: 'OBSERVERS on top of the pistons, also facing the cane. They watch the 3rd-block spot — the moment cane grows there, they fire!',
    blocks: fill([], 'observer|+z', 1, 4, 0, 4, 4, 0),
  });
  steps.push({
    caption: 'Wiring: a solid block behind each piston with REDSTONE DUST on top. The observer pulse runs through the dust and fires the piston below.',
    blocks: fill(fill([], 'stone', 1, 3, -1, 4, 3, -1), 'redstone_wire', 1, 4, -1, 4, 4, -1),
  });
  steps.push({
    caption: 'Collection: a HOPPER at the end of the water channel pointing into a CHEST. Chopped cane floats down the water into it.',
    blocks: put([], 'hopper', 5, 1, 2).concat(put([], 'chest', 5, 1, 3)),
  });
  steps.push({
    caption: "Done! When cane grows 3 tall, the observer fires the piston, the cane pops off, and the water carries it to your chest. 100% automatic sugar for paper, books and cake!",
    blocks: fill([], 'sugar_cane', 1, 3, 1, 4, 3, 1),
    ed: 'Bedrock note: same build works. Observers pulse when the cane grows on both editions.',
  });
  TUTORIALS.push({ name: '🎋 Auto Sugar Cane Farm', steps, cam: 12 });
}

// 3. Cobblestone generator
{
  const steps = [];
  steps.push({
    caption: 'Build a 5x2 stone floor with a wall around it (or just dig this shape into the ground).',
    blocks: fill([], 'stone', 0, 0, 0, 4, 0, 2).concat(fill([], 'stone', 0, 1, 0, 4, 1, 0)).concat(fill([], 'stone', 0, 1, 2, 4, 1, 2)).concat(put([], 'stone', 0, 1, 1, 4, 1, 1)),
  });
  steps.push({
    caption: 'Pour WATER in the left end of the trench.',
    blocks: put([], 'water', 1, 1, 1),
  });
  steps.push({
    caption: 'Pour LAVA in the right end. Where flowing lava touches water... COBBLESTONE forms!',
    blocks: put([], 'lava', 3, 1, 1),
  });
  steps.push({
    caption: 'Mine the cobblestone in the middle — a new one appears instantly. Infinite cobblestone forever! (Use anything but your good pickaxe near the lava.)',
    blocks: put([], 'cobblestone', 2, 1, 1),
    ed: 'Same on both editions. Tip: if lava touches a WATER SOURCE block instead of flowing water, it makes obsidian — keep them apart!',
  });
  TUTORIALS.push({ name: '⛰ Cobblestone Generator', steps, cam: 9 });
}

// 4. Mob XP farm
{
  const steps = [];
  steps.push({
    caption: 'Start with the collection point: 2 HOPPERS feeding into a CHEST. All the loot ends up here.',
    blocks: put([], 'chest', 3, 0, 2).concat(put([], 'hopper', 4, 0, 3, 5, 0, 3)),
  });
  steps.push({
    caption: 'Build a 2-wide drop chute above the hoppers, 3 walls tall. Leave the front open at the bottom — that gap is where YOU hit the mobs.',
    blocks: fill(fill(fill([], 'cobblestone', 3, 1, 4, 6, 4, 4), 'cobblestone', 3, 1, 3, 3, 4, 3).filter(b=>!(b[0]===3&&b[1]<3&&b[2]===3)), 'cobblestone', 6, 1, 3, 6, 4, 3).filter(b=>!(b[0]===6&&b[1]<3&&b[2]===3)),
  });
  steps.push({
    caption: 'At the top, build a 9x9 dark platform with a 2x1 hole leading into the chute. (In your world, make the drop 22 blocks tall so mobs land at half a heart!)',
    blocks: (() => { let l = fill([], 'cobblestone', 0, 5, 0, 8, 5, 8); return l.filter(b => !((b[0] === 4 || b[0] === 5) && b[2] === 3)); })(),
  });
  steps.push({
    caption: 'Walls 3 high around the platform so mobs cannot escape and no light gets in.',
    blocks: fill(fill(fill(fill([], 'cobblestone', 0, 6, 0, 8, 8, 0), 'cobblestone', 0, 6, 8, 8, 8, 8), 'cobblestone', 0, 6, 1, 0, 8, 7), 'cobblestone', 8, 6, 1, 8, 8, 7),
  });
  steps.push({
    caption: 'Water sources along the back wall push every mob toward the hole. Water flows exactly 8 blocks — perfect.',
    blocks: fill([], 'water', 1, 6, 8, 7, 6, 8),
  });
  steps.push({
    caption: 'Roof it so it is pitch black inside. Mobs spawn in the dark, get swept into the hole, and drop to your hoppers.',
    blocks: fill([], 'cobblestone', 0, 9, 0, 8, 9, 8),
  });
  steps.push({
    caption: 'Stand by the gap, hit their feet for easy XP, and collect gunpowder, bones, arrows and string from the chest. AFK nearby (24+ blocks from the platform) to keep it spawning!',
    blocks: [],
    ed: 'Bedrock: mob farms are slower than Java because of different spawn rules — make the roof bigger (or add more platforms) for more mobs.',
  });
  TUTORIALS.push({ name: '💀 Mob XP Farm', steps, cam: 18 });
}

// 5. 2x2 piston door
{
  const steps = [];
  steps.push({
    caption: 'Build a wall with a 2x2 doorway in the middle.',
    blocks: (() => { let l = fill([], 'stone', 0, 1, 2, 7, 3, 2); return l.filter(b => !((b[0] === 3 || b[0] === 4) && (b[1] === 1 || b[1] === 2))); })().concat(fill([], 'grass_block', 0, 0, 0, 7, 0, 5)),
  });
  steps.push({
    caption: 'STICKY pistons behind the wall on both sides of the doorway, facing inward — two on each side, stacked.',
    blocks: put([], 'sticky_piston|+x', 1, 1, 3, 1, 2, 3).concat(put([], 'sticky_piston|-x', 6, 1, 3, 6, 2, 3)),
  });
  steps.push({
    caption: 'Wait — the pistons need to be one block back so the door sits IN the wall. Add your 2x2 of door blocks (smooth stone looks clean) on the piston faces.',
    blocks: put([], 'smooth_stone', 2, 1, 3, 2, 2, 3).concat(put([], 'smooth_stone', 5, 1, 3, 5, 2, 3)),
  });
  steps.push({
    caption: 'Wiring: behind each piston stack, place a solid block with REDSTONE DUST on top, and run dust along the ground to the front.',
    blocks: put([], 'stone', 0, 1, 4, 7, 1, 4)
      .concat(put([], 'redstone_wire', 0, 2, 4, 7, 2, 4))
      .concat(put([], 'redstone_wire', 0, 1, 5, 1, 1, 5, 6, 1, 5, 7, 1, 5)),
  });
  steps.push({
    caption: 'Place a LEVER on a block by the door. Flip it: pistons pull the blocks apart — the door opens! Flip again to close.',
    blocks: put([], 'stone', 3, 1, 5).concat(put([], 'lever', 3, 2, 5)),
    ed: 'Bedrock: works the same, but pistons are 1 tick slower to retract — the door feels slightly different, still perfect.',
  });
  steps.push({
    caption: 'Open! For a hidden door, use the same blocks as your wall so nobody can see it. Want it to open automatically? Swap the lever for pressure plates on both sides.',
    blocks: [],
    remove: [[2,1,3],[2,2,3],[5,1,3],[5,2,3]],
  });
  TUTORIALS.push({ name: '🚪 2x2 Piston Door', steps, cam: 12 });
}

// 6. Iron farm (Bedrock-friendly)
{
  const steps = [];
  steps.push({
    caption: 'Build a big flat platform, at least 11x9. Iron golems will spawn here, so keep it open — no fences, no clutter.',
    blocks: fill([], 'grass_block', 0, 0, 0, 11, 0, 8),
  });
  steps.push({
    caption: 'The villager pod: a 5x5 GLASS box. Put 3 BEDS inside. Villagers need to sleep here every night.',
    blocks: (() => {
      let l = [];
      fill(l, 'glass', 1, 1, 2, 5, 3, 6);
      // hollow out the inside
      l = l.filter(b => !(b[0] >= 2 && b[0] <= 4 && b[2] >= 3 && b[2] <= 5 && b[1] <= 2));
      fill(l, 'glass', 1, 4, 2, 5, 4, 6); // roof
      put(l, 'bed_head', 2, 1, 3, 3, 1, 3, 4, 1, 3);
      put(l, 'bed_foot', 2, 1, 4, 3, 1, 4, 4, 1, 4);
      return l;
    })(),
  });
  steps.push({
    caption: 'Lure 3 VILLAGERS into the pod (use a boat or minecart to move them). Once they sleep in the beds, they count as a "village".',
    blocks: put([], 'marker|villager_spawn_egg', 2, 2, 4, 3, 2, 4, 4, 2, 4),
  });
  steps.push({
    caption: 'The scary part: a ZOMBIE in its own glass box right next to them. The villagers must SEE it through the glass — panicked villagers summon iron golems! (Name-tag the zombie so it never despawns.)',
    blocks: (() => {
      let l = [];
      fill(l, 'glass', 7, 1, 3, 9, 3, 5);
      l = l.filter(b => !(b[0] === 8 && b[2] === 4 && b[1] <= 2));
      fill(l, 'glass', 7, 4, 3, 9, 4, 5);
      put(l, 'marker|zombie_spawn_egg', 8, 1, 4);
      return l;
    })(),
  });
  steps.push({
    caption: 'Golems spawn on the platform around the pod. Add WATER on the far edges to push them toward one corner.',
    blocks: fill(fill([], 'water', 0, 1, 0, 11, 1, 0), 'water', 0, 1, 8, 11, 1, 8),
  });
  steps.push({
    caption: 'The kill chamber: dig a hole in that corner, hoppers + chest at the bottom, and LAVA floating above on SIGNS. The lava kills the golem, the iron falls through to your chest.',
    blocks: (() => {
      let l = [];
      fill(l, 'cobblestone', 10, -2, 3, 11, -2, 5); // chamber floor... walls
      fill(l, 'cobblestone', 9, -1, 3, 9, 0, 5);
      put(l, 'hopper', 10, -1, 4, 11, -1, 4);
      put(l, 'chest', 10, -1, 5);
      put(l, 'lava', 10, 1, 4, 11, 1, 4);
      return l;
    })(),
    remove: [[10, 0, 4], [11, 0, 4]],
  });
  steps.push({
    caption: 'Done! Free iron forever — golems drop 3-5 ingots each. Light everything up so nothing else spawns, and AFK nearby.',
    blocks: put([], 'marker|iron_ingot', 10, 0, 4, 11, 0, 4),
    ed: 'Bedrock: golems spawn within 16 blocks of the village center — keep the platform close to the pod. Java: same build works; golems spawn when villagers panic.',
  });
  TUTORIALS.push({ name: '🤖 Iron Farm', steps, cam: 18 });
}

// 7. Creeper farm
{
  const steps = [];
  steps.push({
    caption: 'Collection first: a CHEST with 2 hoppers. Every bit of gunpowder lands here.',
    blocks: put([], 'chest', 3, 0, 1).concat(put([], 'hopper', 4, 0, 1, 5, 0, 1)),
  });
  steps.push({
    caption: 'Build a tall drop chute above the hoppers. In your world make it 23+ blocks — that fall kills a creeper with NO explosion.',
    blocks: (() => {
      let l = [];
      fill(l, 'cobblestone', 3, 1, 0, 3, 8, 2);
      fill(l, 'cobblestone', 6, 1, 0, 6, 8, 2);
      fill(l, 'cobblestone', 4, 1, 2, 5, 8, 2);
      l = l.filter(b => !(b[2] === 0 && b[1] <= 2)); // open front at the bottom
      return l;
    })(),
  });
  steps.push({
    caption: 'The spawn corridor: a floor at the top, exactly 2 BLOCKS WIDE, with a hole into the chute. Two wide matters — spiders need a 3x3 space, so they can never spawn!',
    blocks: (() => {
      let l = fill([], 'cobblestone', 0, 9, 0, 8, 9, 2);
      return l.filter(b => !(b[0] >= 4 && b[0] <= 5 && b[2] >= 1 && b[2] <= 2 && b[1] === 9));
    })(),
  });
  steps.push({
    caption: 'Walls 2 high around the corridor, and WATER at both ends flowing toward the center hole. (We leave the front wall off here so you can see inside — build all 4 walls in your world!)',
    blocks: (() => {
      let l = [];
      fill(l, 'cobblestone', 0, 10, 2, 3, 11, 2); // back wall, left of the hole
      fill(l, 'cobblestone', 6, 10, 2, 8, 11, 2); // back wall, right of the hole
      fill(l, 'cobblestone', 0, 10, 0, 0, 11, 2); // left end cap
      fill(l, 'cobblestone', 8, 10, 0, 8, 11, 2); // right end cap
      l = l.filter(b => !(b[0] === 0 && b[1] === 10 && b[2] === 1) && !(b[0] === 8 && b[1] === 10 && b[2] === 1));
      put(l, 'water', 0, 10, 1, 8, 10, 1);
      return l;
    })(),
  });
  steps.push({
    caption: 'THE SECRET: trapdoors on the ceiling. They lower the head-room to 1.8 blocks — creepers (1.7 tall) fit, but zombies and skeletons (1.95) do NOT. Creepers only!',
    blocks: fill([], 'trapdoor_top', 1, 11, 1, 7, 11, 1),
  });
  steps.push({
    caption: 'Roof it so it is pitch dark inside, and light up the top so nothing spawns on the outside.',
    blocks: fill(fill([], 'cobblestone', 0, 12, 0, 8, 12, 2), 'torch', 2, 13, 1, 6, 13, 1).filter(b => b[3] !== 'torch' || b[0] === 2 || b[0] === 6),
  });
  steps.push({
    caption: 'Bonus: a CAT in a corner. Creepers are terrified of cats and sprint away — straight into the water and down the hole. Collect your gunpowder for TNT and fireworks!',
    blocks: put([], 'marker|cat_spawn_egg', 7, 10, 1).concat(put([], 'marker|creeper_spawn_egg', 3, 10, 1)).concat(put([], 'marker|gunpowder', 4, 1, 1, 5, 1, 1)),
    ed: 'Bedrock: creeper-only farms with trapdoors work great. Build it high in the sky or light all nearby caves so creepers only spawn in YOUR farm.',
  });
  TUTORIALS.push({ name: '💥 Creeper Farm', steps, cam: 16 });
}

/* ================= STRUCTURE GALLERY =================
   Famous generated structures, built step by step. */

// S1. Village house
{
  const steps = [];
  steps.push({
    caption: 'Villages generate in plains, savanna, desert, taiga and snowy biomes. A small house starts with a cobblestone foundation.',
    blocks: fill([], 'cobblestone', 0, 0, 0, 4, 0, 4),
  });
  steps.push({
    caption: 'Oak plank walls with log corners, a doorway in front, and glass windows on the sides.',
    blocks: (() => {
      let l = [];
      fill(l, 'oak_planks', 0, 1, 0, 4, 3, 0); fill(l, 'oak_planks', 0, 1, 4, 4, 3, 4);
      fill(l, 'oak_planks', 0, 1, 1, 0, 3, 3); fill(l, 'oak_planks', 4, 1, 1, 4, 3, 3);
      for (const [x, z] of [[0, 0], [4, 0], [0, 4], [4, 4]]) fill(l, 'oak_log', x, 1, z, x, 3, z);
      l = l.filter(b => !(b[0] === 2 && b[2] === 0 && b[1] <= 2));
      put(l, 'oak_door', 2, 1, 0);
      put(l, 'glass', 0, 2, 2, 4, 2, 2);
      return l;
    })(),
  });
  steps.push({
    caption: 'A gable roof out of oak stairs, closed with a slab ridge on top.',
    blocks: (() => {
      let l = [];
      fill(l, 'oak_stairs|+z', -1, 4, -1, 5, 4, -1);
      fill(l, 'oak_stairs|-z', -1, 4, 5, 5, 4, 5);
      fill(l, 'oak_planks', -1, 4, 0, 5, 4, 4);
      fill(l, 'oak_stairs|+z', -1, 5, 0, 5, 5, 0);
      fill(l, 'oak_stairs|-z', -1, 5, 4, 5, 5, 4);
      fill(l, 'oak_planks', -1, 5, 1, 5, 5, 3);
      fill(l, 'oak_slab', -1, 6, 1, 5, 6, 3);
      return l;
    })(),
  });
  steps.push({
    caption: 'Inside: a bed, a crafting table and a torch — and a villager to trade with! Job blocks nearby give villagers professions.',
    blocks: put([], 'bed_head', 3, 1, 3).concat(put([], 'bed_foot', 3, 1, 2))
      .concat(put([], 'crafting_table', 1, 1, 3)).concat(put([], 'torch', 1, 2, 1))
      .concat(put([], 'marker|villager_spawn_egg', 2, 1, 2)),
    ed: 'Bedrock and Java villages look slightly different, but the houses and villagers work the same.',
  });
  TUTORIALS.push({ name: '🏠 Village House', steps, cam: 12, kind: 'structure' });
}

// S2. Desert temple
{
  const steps = [];
  steps.push({
    caption: 'Desert temples (pyramids) generate in deserts, often half-buried in sand. This is a mini version — real ones are 21x21!',
    blocks: (() => {
      let l = fill([], 'sandstone', 0, 0, 0, 8, 0, 8);
      fill(l, 'sandstone', 1, 1, 1, 7, 1, 7);
      fill(l, 'sandstone', 2, 2, 2, 6, 2, 6);
      fill(l, 'sandstone', 3, 3, 3, 5, 3, 5);
      put(l, 'chiseled_sandstone', 4, 4, 4);
      return l;
    })(),
  });
  steps.push({
    caption: 'The floor in the center has an orange and blue pattern — that marks THE SECRET. Never dig straight down onto blue!',
    blocks: (() => {
      let l = [];
      fill(l, 'orange_terracotta', 3, 3, 3, 5, 3, 5);
      put(l, 'blue_terracotta', 4, 3, 4);
      return l;
    })(),
  });
  steps.push({
    caption: 'Below the pattern hides a treasure room: 4 chests full of loot... and a STONE PRESSURE PLATE in the middle wired to 9 TNT!',
    blocks: (() => {
      let l = [];
      // open the shaft
      // treasure chamber
      fill(l, 'sandstone', 2, -5, 2, 6, -5, 6);          // chamber floor
      fill(l, 'cut_sandstone', 2, -4, 2, 6, -1, 2);      // walls
      fill(l, 'cut_sandstone', 2, -4, 6, 6, -1, 6);
      fill(l, 'cut_sandstone', 2, -4, 3, 2, -1, 5);
      fill(l, 'cut_sandstone', 6, -4, 3, 6, -1, 5);
      put(l, 'chest', 3, -4, 3, 5, -4, 3, 3, -4, 5, 5, -4, 5);
      put(l, 'stone_pressure_plate', 4, -4, 4);
      fill(l, 'tnt', 3, -6, 3, 5, -6, 5);                // the trap!
      return l;
    })(),
    remove: [[4, 3, 4], [4, 2, 4], [4, 1, 4], [4, 0, 4], [3, 3, 3], [5, 3, 3], [3, 3, 5], [5, 3, 5], [3, 3, 4], [5, 3, 4], [4, 3, 3], [4, 3, 5]],
  });
  steps.push({
    caption: 'Loot: diamonds, emeralds, enchanted books, golden apples. Dig down a CORNER, break the pressure plate first, then loot safely!',
    blocks: put([], 'marker|diamond', 3, -3, 4).concat(put([], 'marker|emerald', 5, -3, 4)).concat(put([], 'marker|enchanted_book', 4, -3, 3)),
    ed: 'Same trap on Bedrock and Java. The TNT destroys ALL the loot if it blows — be careful.',
  });
  TUTORIALS.push({ name: '🏜 Desert Temple', steps, cam: 15, kind: 'structure' });
}

// S3. End portal room
{
  const steps = [];
  steps.push({
    caption: 'Deep in a stronghold hides the portal room — stone bricks, some mossy and cracked with age.',
    blocks: (() => {
      let l = fill([], 'stone_bricks', 0, 0, 0, 8, 0, 6);
      fill(l, 'stone_bricks', 0, 1, 0, 8, 4, 0);
      fill(l, 'stone_bricks', 0, 1, 6, 8, 4, 6);
      fill(l, 'stone_bricks', 0, 1, 1, 0, 4, 5);
      fill(l, 'stone_bricks', 8, 1, 1, 8, 4, 5);
      put(l, 'mossy_cobblestone', 1, 1, 0, 7, 2, 6, 0, 3, 2);
      put(l, 'cracked_stone_bricks', 3, 1, 0, 8, 2, 3, 5, 4, 6);
      return l.filter(b => !(b[2] === 0 && b[0] >= 3 && b[0] <= 5 && b[1] >= 1 && b[1] <= 2)); // entrance
    })(),
  });
  steps.push({
    caption: 'The portal sits above a pool of LAVA. Watch your step — a dropped Eye of Ender is gone forever.',
    blocks: fill([], 'lava', 3, 0, 2, 5, 0, 4),
  });
  steps.push({
    caption: '12 End Portal Frames in a ring. Each needs an EYE OF ENDER — some generate already filled (about 1 in 10).',
    blocks: (() => {
      let l = [];
      fill(l, 'end_portal_frame', 3, 1, 1, 5, 1, 1);
      fill(l, 'end_portal_frame', 3, 1, 5, 5, 1, 5);
      fill(l, 'end_portal_frame', 2, 1, 2, 2, 1, 4);
      fill(l, 'end_portal_frame', 6, 1, 2, 6, 1, 4);
      put(l, 'marker|ender_eye', 3, 2, 1, 6, 2, 3);
      return l;
    })(),
  });
  steps.push({
    caption: 'A SILVERFISH SPAWNER guards the stairs — break it fast or cover it with torches. Fill all 12 frames and jump in to fight the dragon!',
    blocks: put([], 'spawner', 4, 1, 0).concat(put([], 'marker|silverfish_spawn_egg', 4, 2, 0)),
    ed: 'Exactly the same on Bedrock and Java. Bring 12+ Eyes of Ender.',
  });
  TUTORIALS.push({ name: '👁 End Portal Room', steps, cam: 13, kind: 'structure' });
}

// S4. Nether fortress
{
  const steps = [];
  steps.push({
    caption: 'Nether fortresses are giant nether brick castles with long bridges over lava. Find them by exploring along the X axis.',
    blocks: (() => {
      let l = [];
      fill(l, 'nether_bricks', 1, 0, 2, 2, 3, 3);
      fill(l, 'nether_bricks', 8, 0, 2, 9, 3, 3);
      fill(l, 'nether_bricks', 0, 4, 1, 10, 4, 4);
      return l;
    })(),
  });
  steps.push({
    caption: 'Nether brick fence railings keep you from falling into the lava ocean below.',
    blocks: fill(fill([], 'nether_brick_fence', 0, 5, 1, 10, 5, 1), 'nether_brick_fence', 0, 5, 4, 10, 5, 4),
  });
  steps.push({
    caption: 'The prize: a BLAZE SPAWNER on an open platform. Blaze rods are the only way to brew potions and reach the End!',
    blocks: (() => {
      let l = fill([], 'nether_bricks', 3, 5, 6, 7, 5, 10);
      fill(l, 'nether_bricks', 4, 4, 5, 6, 4, 5);
      put(l, 'spawner', 5, 6, 8);
      put(l, 'marker|blaze_spawn_egg', 5, 7, 8, 3, 6, 7, 7, 6, 9);
      return l;
    })(),
  });
  steps.push({
    caption: 'Also look for NETHER WART growing on soul sand near stairwells — grab some, you need it for every potion!',
    blocks: fill([], 'soul_sand', 0, 4, 5, 1, 4, 6).concat(put([], 'marker|nether_wart', 0, 5, 5, 1, 5, 6)),
    ed: 'Bedrock tip: build a small safe room near the spawner with a 1-block gap to hit blazes through.',
  });
  TUTORIALS.push({ name: '🏰 Nether Fortress', steps, cam: 15, kind: 'structure' });
}

// S5. Ruined portal
{
  const steps = [];
  steps.push({
    caption: 'Ruined portals generate EVERYWHERE — broken pieces of ancient nether portals, often with crying obsidian you cannot light.',
    blocks: (() => {
      let l = [];
      fill(l, 'obsidian', 2, 0, 2, 5, 0, 2);
      fill(l, 'obsidian', 2, 1, 2, 2, 4, 2);
      put(l, 'crying_obsidian', 5, 1, 2, 5, 2, 2, 3, 5, 2);
      put(l, 'obsidian', 2, 5, 2, 4, 5, 2, 5, 4, 2);
      return l;
    })(),
  });
  steps.push({
    caption: 'Netherrack and magma blocks splash around it — like the Nether leaked through.',
    blocks: (() => {
      let l = [];
      put(l, 'netherrack', 0, 0, 1, 1, 0, 3, 6, 0, 2, 4, 0, 4, 1, 1, 2);
      put(l, 'magma_block', 0, 0, 3, 6, 0, 1, 3, 0, 4);
      put(l, 'gold_block', 6, 0, 3, 1, 0, 0);
      return l;
    })(),
  });
  steps.push({
    caption: 'The chest has GOLD gear, obsidian, and sometimes flint and steel — replace the missing obsidian, light it, and you have a free portal to the Nether!',
    blocks: put([], 'chest', 6, 1, 2).concat(put([], 'marker|golden_apple', 6, 2, 2)).concat(put([], 'marker|flint_and_steel', 3, 3, 2)),
    ed: 'Crying obsidian does NOT count for the portal frame — swap it for regular obsidian.',
  });
  TUTORIALS.push({ name: '🌀 Ruined Portal', steps, cam: 12, kind: 'structure' });
}

// S6. Witch hut
{
  const steps = [];
  steps.push({
    caption: 'Swamp huts stand on stilts over the water in swamp biomes.',
    blocks: (() => {
      let l = [];
      for (const [x, z] of [[1, 1], [5, 1], [1, 6], [5, 6]]) fill(l, 'oak_log', x, 0, z, x, 2, z);
      fill(l, 'spruce_planks', 0, 3, 0, 6, 3, 7);
      return l;
    })(),
  });
  steps.push({
    caption: 'Spruce walls and a stair roof with a little porch out front.',
    blocks: (() => {
      let l = [];
      fill(l, 'spruce_planks', 0, 4, 2, 6, 6, 2);
      fill(l, 'spruce_planks', 0, 4, 7, 6, 6, 7);
      fill(l, 'spruce_planks', 0, 4, 3, 0, 6, 6);
      fill(l, 'spruce_planks', 6, 4, 3, 6, 6, 6);
      l = l.filter(b => !(b[0] === 3 && b[2] === 2 && b[1] <= 5));
      fill(l, 'spruce_stairs|+z', -1, 7, 1, 7, 7, 1);
      fill(l, 'spruce_planks', -1, 7, 2, 7, 7, 7);
      fill(l, 'spruce_stairs|-z', -1, 7, 8, 7, 7, 8);
      return l;
    })(),
  });
  steps.push({
    caption: 'Inside: a CAULDRON (sometimes with a potion on Bedrock!), a crafting table — and the WITCH. Her black cat protects her from... nothing. Loot the cat? No! It is a free pet.',
    blocks: put([], 'cauldron', 1, 4, 6).concat(put([], 'crafting_table', 5, 4, 6))
      .concat(put([], 'marker|witch_spawn_egg', 3, 4, 5)).concat(put([], 'marker|cat_spawn_egg', 5, 4, 3)),
    ed: 'Bedrock: the cauldron can contain a random potion — scoop it with bottles! Witches always respawn near the hut.',
  });
  TUTORIALS.push({ name: '🧙 Witch Hut', steps, cam: 13, kind: 'structure' });
}

// S7. Igloo
{
  const steps = [];
  steps.push({
    caption: 'Igloos generate in snowy biomes — a cozy snow dome.',
    blocks: (() => {
      let l = [];
      fill(l, 'snow_block', 0, 0, 0, 6, 0, 6);
      fill(l, 'snow_block', 0, 1, 0, 6, 2, 0);
      fill(l, 'snow_block', 0, 1, 6, 6, 2, 6);
      fill(l, 'snow_block', 0, 1, 1, 0, 2, 5);
      fill(l, 'snow_block', 6, 1, 1, 6, 2, 5);
      fill(l, 'snow_block', 1, 3, 1, 5, 3, 5);
      l = l.filter(b => !(b[0] === 3 && b[2] === 0 && b[1] >= 1 && b[1] <= 2));
      return l;
    })(),
  });
  steps.push({
    caption: 'Inside: a bed, a furnace, and a torch. Cozy! But HALF of all igloos hide something under the carpet...',
    blocks: put([], 'bed_head', 1, 1, 4).concat(put([], 'bed_foot', 1, 1, 3))
      .concat(put([], 'furnace', 5, 1, 4)).concat(put([], 'torch', 3, 2, 5))
      .concat(put([], 'white_carpet', 3, 1, 3)),
  });
  steps.push({
    caption: 'THE SECRET: under the carpet, a ladder shaft drops into a hidden lab — with a caged ZOMBIE VILLAGER, a regular villager, a brewing stand and a chest with a golden apple!',
    blocks: (() => {
      let l = [];
      fill(l, 'ladder', 3, -4, 3, 3, 0, 3);
      fill(l, 'stone_bricks', 1, -5, 1, 5, -5, 5);
      fill(l, 'stone_bricks', 1, -4, 1, 5, -2, 1);
      fill(l, 'stone_bricks', 1, -4, 5, 5, -2, 5);
      fill(l, 'stone_bricks', 1, -4, 2, 1, -2, 4);
      fill(l, 'stone_bricks', 5, -4, 2, 5, -2, 4);
      put(l, 'iron_bars', 4, -4, 4, 4, -3, 4);
      put(l, 'marker|zombie_villager_spawn_egg', 4, -4, 4);
      put(l, 'marker|villager_spawn_egg', 2, -4, 4);
      put(l, 'chest', 2, -4, 2);
      put(l, 'cauldron', 4, -4, 2);
      put(l, 'marker|golden_apple', 2, -3, 2);
      put(l, 'cobweb', 1, -2, 2, 5, -2, 4);
      return l;
    })(),
    remove: [[3, 1, 3]],
    ed: 'The basement chest has a golden apple + the brewing stand holds a Weakness potion — everything you need to CURE the zombie villager for discount trades!',
  });
  TUTORIALS.push({ name: '❄️ Igloo Secret', steps, cam: 13, kind: 'structure' });
}

// S8. Pillager outpost
{
  const steps = [];
  steps.push({
    caption: 'Pillager outposts are tall watchtowers that generate near villages. Dangerous — pillagers shoot on sight!',
    blocks: (() => {
      let l = [];
      for (const [x, z] of [[0, 0], [4, 0], [0, 4], [4, 4]]) fill(l, 'dark_oak_log', x, 0, z, x, 1, z);
      fill(l, 'cobblestone', 0, 2, 0, 4, 2, 4);
      return l;
    })(),
  });
  steps.push({
    caption: 'The tower body: dark oak and cobblestone, floors connected by ladders.',
    blocks: (() => {
      let l = [];
      fill(l, 'dark_oak_planks', 0, 3, 0, 4, 7, 0);
      fill(l, 'dark_oak_planks', 0, 3, 4, 4, 7, 4);
      fill(l, 'dark_oak_planks', 0, 3, 1, 0, 7, 3);
      fill(l, 'dark_oak_planks', 4, 3, 1, 4, 7, 3);
      l = l.filter(b => !((b[1] === 5) && ((b[0] === 2 && (b[2] === 0 || b[2] === 4)) || (b[2] === 2 && (b[0] === 0 || b[0] === 4)))));
      fill(l, 'ladder', 2, 3, 3, 2, 7, 3);
      return l;
    })(),
  });
  steps.push({
    caption: 'The top deck hangs over the edges — that is where the CAPTAIN stands with his banner. Killing him gives you BAD OMEN... enter a village with it and a RAID starts!',
    blocks: (() => {
      let l = fill([], 'cobblestone', -1, 8, -1, 5, 8, 5);
      fill(l, 'cobblestone_wall', -1, 9, -1, 5, 9, -1);
      fill(l, 'cobblestone_wall', -1, 9, 5, 5, 9, 5);
      fill(l, 'cobblestone_wall', -1, 9, 0, -1, 9, 4);
      fill(l, 'cobblestone_wall', 5, 9, 0, 5, 9, 4);
      put(l, 'marker|pillager_spawn_egg', 1, 9, 2, 3, 9, 1);
      put(l, 'marker|crossbow', 2, 10, 2);
      return l;
    })(),
  });
  steps.push({
    caption: 'Loot the chest at the top: crossbows, arrows, dark oak logs — and check the cages around the outpost, sometimes an IRON GOLEM is trapped inside. Free it for a friend!',
    blocks: put([], 'chest', 2, 9, 3).concat(put([], 'marker|iron_ingot', 2, 10, 3)),
    ed: 'Raids: on Bedrock, Bad Omen turns into Raid Omen when you enter a village. Win the raid for the Hero of the Village discount!',
  });
  TUTORIALS.push({ name: '🗼 Pillager Outpost', steps, cam: 15, kind: 'structure' });
}

// S9. Ancient city
{
  const steps = [];
  steps.push({
    caption: 'Ancient Cities generate in the DEEP DARK, around Y -52. A huge deepslate walkway runs down the middle of the city.',
    blocks: (() => {
      let l = fill([], 'deepslate_tiles', 0, 0, 2, 14, 0, 6);
      fill(l, 'cobbled_deepslate', 0, 0, 1, 14, 0, 1);
      fill(l, 'cobbled_deepslate', 0, 0, 7, 14, 0, 7);
      fill(l, 'deepslate_bricks', 0, 1, 1, 0, 1, 7);
      fill(l, 'deepslate_bricks', 14, 1, 1, 14, 1, 7);
      return l;
    })(),
  });
  steps.push({
    caption: 'At the center stands a giant frame of REINFORCED DEEPSLATE — it looks like a portal, but nobody has ever opened it. Unbreakable in survival!',
    blocks: (() => {
      let l = [];
      fill(l, 'reinforced_deepslate', 5, 1, 4, 9, 1, 4);
      fill(l, 'reinforced_deepslate', 5, 2, 4, 5, 5, 4);
      fill(l, 'reinforced_deepslate', 9, 2, 4, 9, 5, 4);
      fill(l, 'reinforced_deepslate', 5, 6, 4, 9, 6, 4);
      fill(l, 'chiseled_deepslate', 6, 1, 4, 8, 1, 4);
      return l;
    })(),
  });
  steps.push({
    caption: 'SCULK grows everywhere. Sensors hear your footsteps, and SHRIEKERS scream when caught — 3 screams summons THE WARDEN. Sneak. Always sneak.',
    blocks: (() => {
      let l = [];
      put(l, 'sculk', 2, 0, 3, 3, 0, 5, 11, 0, 4, 12, 0, 2, 4, 0, 6, 10, 0, 6);
      put(l, 'sculk_sensor', 3, 1, 4, 11, 1, 5);
      put(l, 'sculk_shrieker', 7, 1, 2);
      put(l, 'sculk_catalyst', 12, 1, 6);
      put(l, 'marker|warden_spawn_egg', 7, 3, 2);
      return l;
    })(),
  });
  steps.push({
    caption: 'Gray wool paths let you walk SILENTLY (wool muffles vibrations). Loot chests hold Echo Shards, Swift Sneak books and enchanted golden apples!',
    blocks: (() => {
      let l = fill([], 'gray_wool', 1, 1, 5, 4, 1, 5);
      put(l, 'chest', 2, 1, 2, 12, 1, 3);
      put(l, 'soul_lantern', 4, 3, 1, 10, 3, 1);
      fill(l, 'dark_oak_fence', 4, 1, 1, 4, 2, 1);
      fill(l, 'dark_oak_fence', 10, 1, 1, 10, 2, 1);
      put(l, 'marker|echo_shard', 2, 2, 2);
      put(l, 'marker|enchanted_golden_apple', 12, 2, 3);
      return l;
    })(),
    ed: 'Same on Bedrock and Java. NEVER light candles near shriekers, and bring wool blocks to plug them.',
  });
  TUTORIALS.push({ name: '🏙 Ancient City', steps, cam: 17, kind: 'structure' });
}

// S10. Ocean monument
{
  const steps = [];
  steps.push({
    caption: 'Ocean Monuments rise from deep ocean floors — giant prismarine temples. This is one wing; real ones are 58x58!',
    blocks: (() => {
      let l = [];
      fill(l, 'prismarine', 0, 0, 0, 12, 0, 8);
      fill(l, 'prismarine', 0, 1, 0, 12, 4, 0);
      fill(l, 'prismarine', 0, 1, 8, 12, 4, 8);
      fill(l, 'prismarine', 0, 1, 1, 0, 4, 7);
      fill(l, 'prismarine', 12, 1, 1, 12, 4, 7);
      fill(l, 'prismarine_bricks', 0, 5, 0, 12, 5, 8);
      l = l.filter(b => !(b[2] === 0 && b[0] >= 5 && b[0] <= 7 && b[1] >= 1 && b[1] <= 3)); // entrance
      for (const [x, z] of [[0, 0], [12, 0], [0, 8], [12, 8]]) fill(l, 'dark_prismarine', x, 1, z, x, 5, z);
      return l;
    })(),
  });
  steps.push({
    caption: 'SEA LANTERNS light the halls — mine them with Silk Touch, they are the prettiest light source in the game.',
    blocks: put([], 'sea_lantern', 3, 5, 2, 9, 5, 2, 3, 5, 6, 9, 5, 6, 6, 4, 4),
  });
  steps.push({
    caption: 'The treasure core: 8 GOLD BLOCKS sealed inside dark prismarine, right in the center of the monument. Shown cut open here!',
    blocks: (() => {
      let l = [];
      fill(l, 'dark_prismarine', 4, 1, 3, 8, 3, 5);
      let l2 = l.filter(b => b[2] !== 3); // cutaway: open the front face
      fill(l2, 'gold_block', 5, 1, 4, 7, 2, 4);
      return l2;
    })(),
  });
  steps.push({
    caption: 'GUARDIANS patrol everywhere, and 3 ELDER GUARDIANS curse you with Mining Fatigue. Drink milk to clear it, and bring Water Breathing potions + a conduit if you can!',
    blocks: (() => {
      let l = fill([], 'water', 0, 6, 0, 12, 6, 8);
      put(l, 'wet_sponge', 10, 1, 6, 11, 1, 6, 10, 1, 7);
      put(l, 'marker|guardian_spawn_egg', 2, 3, 4, 10, 4, 3);
      put(l, 'marker|elder_guardian_spawn_egg', 6, 6, 4);
      put(l, 'marker|sponge', 10, 2, 6);
      return l;
    })(),
    ed: 'Bedrock: elder guardians drop wet sponges when killed. The sponge room (shown in the corner) is the fastest way to dry out the monument.',
  });
  TUTORIALS.push({ name: '🌊 Ocean Monument', steps, cam: 17, kind: 'structure' });
}

// S11. Bastion remnant
{
  const steps = [];
  steps.push({
    caption: 'Bastion Remnants are ruined blackstone castles in the Nether — home of the piglins. Four types generate; this is a treasure room bastion.',
    blocks: (() => {
      let l = [];
      fill(l, 'blackstone', 0, 0, 0, 10, 0, 8);
      fill(l, 'polished_blackstone_bricks', 0, 1, 0, 10, 5, 0);
      fill(l, 'polished_blackstone_bricks', 0, 1, 8, 2, 5, 8);
      fill(l, 'polished_blackstone_bricks', 0, 1, 1, 0, 5, 7);
      fill(l, 'polished_blackstone_bricks', 10, 1, 1, 10, 3, 7);
      // ruined: knock holes in the walls
      return l.filter(b => !((b[0] === 4 && b[1] >= 3 && b[2] === 0) || (b[0] === 7 && b[1] >= 4 && b[2] === 0) || (b[0] === 10 && b[1] === 3 && b[2] >= 4)));
    })(),
  });
  steps.push({
    caption: 'A lava moat guards the center. Basalt pillars hold up what is left of the roof, with chains hanging from the ruins.',
    blocks: (() => {
      let l = fill([], 'lava', 2, 1, 2, 8, 1, 6);
      fill(l, 'blackstone', 4, 1, 3, 6, 1, 5); // island in the moat
      for (const [x, z] of [[2, 2], [8, 2], [2, 6], [8, 6]]) fill(l, 'basalt', x, 1, z, x, 5, z);
      fill(l, 'chain', 5, 4, 4, 5, 5, 4);
      return l;
    })(),
  });
  steps.push({
    caption: 'The treasure: GOLD BLOCKS and GILDED BLACKSTONE around a loot chest — netherite scraps, ancient debris, even a Netherite Upgrade template!',
    blocks: (() => {
      let l = [];
      put(l, 'gold_block', 4, 2, 4, 6, 2, 4);
      put(l, 'gilded_blackstone', 5, 2, 3, 5, 2, 5, 4, 2, 3, 6, 2, 5);
      put(l, 'chest', 5, 3, 4);
      put(l, 'marker|netherite_upgrade_smithing_template', 5, 4, 4);
      put(l, 'magma_block', 1, 1, 1, 9, 1, 7);
      return l;
    })(),
  });
  steps.push({
    caption: 'PIGLINS attack unless you wear at least one piece of GOLD armor. Piglin BRUTES attack no matter what — and never forget: do not mine the gold in front of them!',
    blocks: put([], 'marker|piglin_spawn_egg', 2, 2, 1, 8, 2, 7).concat(put([], 'marker|piglin_brute_spawn_egg', 5, 2, 6)).concat(put([], 'marker|golden_boots', 5, 6, 4)),
    ed: 'Same rules both editions. Gold armor stops piglin aggro but NOT brutes — fight or run.',
  });
  TUTORIALS.push({ name: '⚫ Bastion Remnant', steps, cam: 15, kind: 'structure' });
}

// S12. Trial chamber
{
  const steps = [];
  steps.push({
    caption: 'Trial Chambers generate underground in copper and tuff. Find them with a Trial Explorer map from cartographer villagers.',
    blocks: (() => {
      let l = [];
      fill(l, 'tuff_bricks', 0, 0, 0, 10, 0, 8);
      fill(l, 'tuff_bricks', 0, 1, 0, 10, 5, 0);
      fill(l, 'tuff_bricks', 0, 1, 8, 10, 5, 8);
      fill(l, 'tuff_bricks', 0, 1, 1, 0, 5, 7);
      fill(l, 'tuff_bricks', 10, 1, 1, 10, 5, 7);
      fill(l, 'tuff_bricks', 0, 6, 0, 10, 6, 8);
      for (const [x, z] of [[1, 1], [9, 1], [1, 7], [9, 7]]) fill(l, 'copper_block', x, 1, z, x, 5, z);
      l = l.filter(b => !(b[2] === 0 && b[0] >= 4 && b[0] <= 6 && b[1] >= 1 && b[1] <= 3)); // entrance
      fill(l, 'chiseled_tuff', 0, 1, 0, 10, 1, 0);
      return l;
    })(),
  });
  steps.push({
    caption: 'COPPER GRATES for windows and COPPER BULBS for light — they toggle with redstone and oxidize green over time.',
    blocks: (() => {
      let l = [];
      put(l, 'copper_grate', 2, 3, 0, 8, 3, 0, 0, 3, 4, 10, 3, 4);
      put(l, 'copper_bulb', 3, 4, 1, 7, 4, 1, 3, 4, 7, 7, 4, 7);
      put(l, 'oxidized_copper', 9, 5, 1, 1, 5, 7);
      return l;
    })(),
  });
  steps.push({
    caption: 'The TRIAL SPAWNER: walk close and it spawns WAVES of mobs — more mobs for more players! Beat the wave and it spits out loot and a TRIAL KEY.',
    blocks: (() => {
      let l = fill([], 'chiseled_tuff', 4, 1, 3, 6, 1, 5);
      put(l, 'trial_spawner', 5, 2, 4);
      put(l, 'marker|breeze_spawn_egg', 3, 2, 5, 5, 4, 4);
      put(l, 'marker|zombie_spawn_egg', 7, 2, 3);
      return l;
    })(),
  });
  steps.push({
    caption: 'Use your Trial Key on the VAULT — every player can open each vault ONCE for their own loot. Drink an Ominous Bottle for harder trials and better rewards (Heavy Cores for the MACE!).',
    blocks: put([], 'vault', 5, 1, 7).concat(put([], 'marker|trial_key', 5, 2, 6)).concat(put([], 'marker|ominous_bottle', 3, 2, 7)).concat(put([], 'marker|heavy_core', 7, 2, 7)),
    ed: 'Bedrock and Java both have Trial Chambers since 1.21. Vault loot is per-player — everyone in your group gets their own!',
  });
  TUTORIALS.push({ name: '⚔️ Trial Chamber', steps, cam: 15, kind: 'structure' });
}

// ---------- three.js scene ----------
const holder = document.getElementById('tut-canvas-holder');
let renderer = null;
try {
  renderer = new THREE.WebGLRenderer({ antialias: true });
} catch (e) {
  holder.innerHTML = `<div style="display:flex;height:100%;align-items:center;justify-content:center;text-align:center;padding:30px;background:#1c1c1c">
    <div style="max-width:520px;color:#fff;font-size:16px;line-height:1.7">🎮 The 3D viewer could not start because your browser turned off graphics (WebGL).<br><br>
    <b style="color:#ffff55">Fix: fully quit and reopen your browser</b>, then come back — the tutorials will work again. Everything else in the app still works!</div></div>`;
}
if (renderer) {
  renderer.setPixelRatio(window.devicePixelRatio);
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.18;
  holder.appendChild(renderer.domElement);
}
const scene = new THREE.Scene();

// day/night sky system (day = vibrant gradient + clouds, night = black + stars)
function makeSkyTex(stops) {
  const c = document.createElement('canvas');
  c.width = 2; c.height = 256;
  const g = c.getContext('2d');
  const grad = g.createLinearGradient(0, 0, 0, 256);
  for (const [p, col] of stops) grad.addColorStop(p, col);
  g.fillStyle = grad;
  g.fillRect(0, 0, 2, 256);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}
const daySky = makeSkyTex([[0, '#2f8fff'], [0.6, '#7fc4ff'], [1, '#dff2ff']]);
scene.background = daySky;
scene.fog = new THREE.Fog('#bfe0ff', 55, 115);

const camera = new THREE.PerspectiveCamera(55, 1, 0.1, 300);
const ambient = new THREE.AmbientLight(0xffffff, 0.55);
scene.add(ambient);
const hemi = new THREE.HemisphereLight(0xcfe8ff, 0x9a8a60, 0.55);
scene.add(hemi);
const sun = new THREE.DirectionalLight(0xfff2dd, 1.7);
sun.position.set(18, 30, 12);
sun.castShadow = true;
sun.shadow.mapSize.set(2048, 2048);
sun.shadow.camera.left = -30; sun.shadow.camera.right = 30;
sun.shadow.camera.top = 30; sun.shadow.camera.bottom = -30;
sun.shadow.camera.near = 1; sun.shadow.camera.far = 100;
sun.shadow.bias = -0.002;
scene.add(sun);
const sun2 = new THREE.DirectionalLight(0xbcd4ff, 0.5);
sun2.position.set(-10, 12, -14);
scene.add(sun2);

// clouds (day) + stars (night)
const clouds = new THREE.Group();
scene.add(clouds);
const cloudMat = new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.88, fog: false });
for (let i = 0; i < 10; i++) {
  const c = new THREE.Mesh(boxGeo, cloudMat);
  c.scale.set(7 + ((i * 37) % 9), 0.8, 4 + ((i * 23) % 6));
  c.position.set(((i * 29) % 140) - 70, 27 + (i % 4) * 3, ((i * 47) % 120) - 60);
  clouds.add(c);
}
let stars;
{
  const starPos = new Float32Array(350 * 3);
  for (let i = 0; i < 350; i++) {
    const a = Math.random() * Math.PI * 2;
    const b = Math.random() * Math.PI * 0.45 + 0.08; // keep stars above the horizon
    const r = 130;
    starPos[i * 3] = Math.cos(a) * Math.cos(b) * r;
    starPos[i * 3 + 1] = Math.sin(b) * r;
    starPos[i * 3 + 2] = Math.sin(a) * Math.cos(b) * r;
  }
  const starGeo = new THREE.BufferGeometry();
  starGeo.setAttribute('position', new THREE.BufferAttribute(starPos, 3));
  stars = new THREE.Points(starGeo, new THREE.PointsMaterial({ color: 0xffffff, size: 0.9, fog: false }));
  stars.frustumCulled = false;
  scene.add(stars);
}
let isDay = true;
function setDaylight(day) {
  isDay = day;
  if (day) {
    scene.background = daySky;
    scene.fog.color.set('#bfe0ff');
    ambient.intensity = 0.55; hemi.intensity = 0.55;
    sun.intensity = 1.7; sun.color.set(0xfff2dd);
  } else {
    scene.background = new THREE.Color('#000000');
    scene.fog.color.set('#000000');
    ambient.intensity = 0.6; hemi.intensity = 0.2;
    sun.intensity = 1.1; sun.color.set(0xcfd8ff);
  }
  clouds.visible = day;
  stars.visible = !day;
  const btn = document.getElementById('tut-day');
  if (btn) btn.textContent = day ? '🌞' : '🌙';
}
setDaylight(true);

// grass ground built as 4 rectangles around the build's footprint (so digs below ground stay visible)
const groundGroup = new THREE.Group();
scene.add(groundGroup);
function makeGroundMat() {
  const t = tex('grass_block_top');
  const g = t.clone();
  g.wrapS = g.wrapT = THREE.RepeatWrapping;
  g.magFilter = THREE.NearestFilter;
  g.minFilter = THREE.NearestFilter;
  g.colorSpace = THREE.SRGBColorSpace;
  return new THREE.MeshLambertMaterial({ map: g, color: new THREE.Color(GRASS) });
}
function buildGround(xLo, xHi, zLo, zHi, y) {
  groundGroup.clear();
  const E = 60;
  const rects = [
    [-E, xLo, -E, E], [xHi, E, -E, E],   // west / east strips
    [xLo, xHi, -E, zLo], [xLo, xHi, zHi, E], // front / back strips
  ];
  for (const [x0, x1, z0, z1] of rects) {
    const w = x1 - x0, h = z1 - z0;
    if (w <= 0 || h <= 0) continue;
    const mat = makeGroundMat();
    mat.map.repeat.set(w, h);
    const p = new THREE.Mesh(new THREE.PlaneGeometry(w, h), mat);
    p.rotation.x = -Math.PI / 2;
    p.position.set(x0 + w / 2, y + 0.01, z0 + h / 2);
    p.receiveShadow = true;
    groundGroup.add(p);
  }
}

const world = new THREE.Group();
scene.add(world);

// ---------- sound engine: per-material synthesized block sounds ----------
let actx = null, soundOn = true, lastSoundAt = 0;
function ctx() {
  actx = actx || new (window.AudioContext || window.webkitAudioContext)();
  return actx;
}
function blip({ f0 = 200, f1 = 90, dur = 0.1, wave = 'triangle', vol = 0.1 } = {}) {
  try {
    const a = ctx(), t = a.currentTime;
    const o = a.createOscillator(), g = a.createGain();
    o.type = wave;
    o.frequency.setValueAtTime(f0 * (0.92 + Math.random() * 0.16), t);
    o.frequency.exponentialRampToValueAtTime(Math.max(30, f1), t + dur * 0.8);
    g.gain.setValueAtTime(vol, t);
    g.gain.exponentialRampToValueAtTime(0.001, t + dur);
    o.connect(g); g.connect(a.destination);
    o.start(t); o.stop(t + dur + 0.02);
  } catch {}
}
function noiseBurst({ dur = 0.08, freq = 900, vol = 0.08 } = {}) {
  try {
    const a = ctx(), t = a.currentTime;
    const n = Math.floor(a.sampleRate * dur);
    const buf = a.createBuffer(1, n, a.sampleRate);
    const d = buf.getChannelData(0);
    for (let i = 0; i < n; i++) d[i] = (Math.random() * 2 - 1) * (1 - i / n);
    const src = a.createBufferSource();
    src.buffer = buf;
    const f = a.createBiquadFilter();
    f.type = 'lowpass';
    f.frequency.value = freq * (0.8 + Math.random() * 0.4);
    const g = a.createGain();
    g.gain.value = vol;
    src.connect(f); f.connect(g); g.connect(a.destination);
    src.start(t);
  } catch {}
}
function soundCat(type) {
  const b = type.split('|')[0];
  if (/water/.test(b)) return 'water';
  if (/lava/.test(b)) return 'lava';
  if (/(wheat|sugar_cane|torch|lever|redstone_wire|marker|_leaves$|_sapling$|flower)/.test(b)) return 'plant';
  if (/(dirt|grass_block|sand|gravel|farmland|bed_|wool|carpet|hay|slime|honey|snow|moss|mud)/.test(b)) return 'soft';
  if (/(piston|observer|hopper|trapdoor|command_block|dropper|dispenser|repeater|comparator|daylight|rail|iron_|target|lamp|anvil|cauldron|chain)/.test(b)) return 'metal';
  if (/(planks|log|chest|glass|_wood$|bookshelf|barrel|crafting|door|fence|shelf|sign)/.test(b)) return 'wood';
  return 'stone';
}
function blockSound(type) {
  if (!soundOn) return;
  const now = performance.now();
  if (now - lastSoundAt < 45) return; // rate limit: rapid steps become a build-arpeggio
  lastSoundAt = now;
  switch (soundCat(type)) {
    case 'stone': blip({ f0: 150, f1: 65, dur: 0.11, vol: 0.11 }); noiseBurst({ freq: 650, dur: 0.06, vol: 0.05 }); break;
    case 'wood': blip({ f0: 240, f1: 120, dur: 0.09, vol: 0.1 }); break;
    case 'soft': noiseBurst({ freq: 480, dur: 0.09, vol: 0.09 }); break;
    case 'metal': blip({ f0: 700, f1: 380, dur: 0.06, wave: 'square', vol: 0.045 }); break;
    case 'water': blip({ f0: 280, f1: 520, dur: 0.12, wave: 'sine', vol: 0.08 }); noiseBurst({ freq: 1100, dur: 0.1, vol: 0.05 }); break;
    case 'lava': noiseBurst({ freq: 260, dur: 0.2, vol: 0.1 }); break;
    case 'plant': noiseBurst({ freq: 2100, dur: 0.05, vol: 0.05 }); break;
  }
}
function placeSound() { blockSound('stone'); } // used by the sound-toggle preview

// ---------- particle system: block-place dust puffs (pixel points) ----------
const MAXP = 700;
const pPos = new Float32Array(MAXP * 3);
const pCol = new Float32Array(MAXP * 3);
const pVel = new Float32Array(MAXP * 3);
const pLife = new Float32Array(MAXP);
pPos.fill(-999);
const pGeo = new THREE.BufferGeometry();
pGeo.setAttribute('position', new THREE.BufferAttribute(pPos, 3));
pGeo.setAttribute('color', new THREE.BufferAttribute(pCol, 3));
const pMat = new THREE.PointsMaterial({ size: 0.16, vertexColors: true });
const points = new THREE.Points(pGeo, pMat);
points.frustumCulled = false;
scene.add(points);
let pNext = 0;

const PARTICLE_COLORS = {
  dirt: 0x79553a, grass_block: 0x6aa84f, farmland: 0x6b4a2f, sand: 0xdbd3a0,
  stone: 0x7d7d7d, cobblestone: 0x767676, smooth_stone: 0x9a9a9a,
  oak_planks: 0xb8945f, oak_log: 0x9a7d4d, chest: 0xa87e43, glass: 0xd6f0f5,
  water: 0x3f76e4, lava: 0xe59026, redstone_wire: 0xcc0000,
  piston: 0x8a8a8a, sticky_piston: 0x8a9a6a, observer: 0x666666, hopper: 0x4a4a4a,
  wheat: 0xd5b45a, wheat_young: 0x7bb24a, sugar_cane: 0x71b755, torch: 0xffd84d,
  trapdoor_top: 0xa07a45, bed_foot: 0xb02e26, bed_head: 0xe8e8e8, lever: 0x7d7d7d,
  command_block: 0xc77e4f, chain_command_block: 0x86b3a2, repeating_command_block: 0x9061c2,
  repeater: 0x9a9a9a, comparator: 0x9a9a9a, redstone_torch: 0xff2a00, redstone_block: 0xcc0000,
  redstone_lamp: 0x8a5a2a, tnt: 0xd0563e, slime_block: 0x84c873, target: 0xd8c0a8,
  dropper: 0x7d7d7d, dispenser: 0x7d7d7d, rail: 0x8c7853, powered_rail: 0xb08040,
  iron_door: 0xc8c8c8, oak_door: 0xb8945f, daylight_detector: 0x3a4a6a, note_block: 0x8a5a3a,
};
const _pc = new THREE.Color();
function spawnBurst(x, y, z, type, count = 7) {
  const hex = PARTICLE_COLORS[type.split('|')[0]] ?? 0x9a9a9a;
  for (let k = 0; k < count; k++) {
    const i = pNext; pNext = (pNext + 1) % MAXP;
    pPos[i * 3] = x + (Math.random() - 0.5) * 0.8;
    pPos[i * 3 + 1] = y + Math.random() * 0.5;
    pPos[i * 3 + 2] = z + (Math.random() - 0.5) * 0.8;
    pVel[i * 3] = (Math.random() - 0.5) * 3;
    pVel[i * 3 + 1] = 1.5 + Math.random() * 2.5;
    pVel[i * 3 + 2] = (Math.random() - 0.5) * 3;
    _pc.setHex(hex);
    _pc.offsetHSL(0, 0, (Math.random() - 0.5) * 0.15);
    pCol[i * 3] = _pc.r; pCol[i * 3 + 1] = _pc.g; pCol[i * 3 + 2] = _pc.b;
    pLife[i] = 0.45 + Math.random() * 0.3;
  }
  pGeo.attributes.color.needsUpdate = true;
}
function updateParticles(dt) {
  let any = false;
  for (let i = 0; i < MAXP; i++) {
    if (pLife[i] <= 0) continue;
    any = true;
    pLife[i] -= dt;
    if (pLife[i] <= 0) { pPos[i * 3 + 1] = -999; continue; }
    pVel[i * 3 + 1] -= 9.5 * dt;
    pPos[i * 3] += pVel[i * 3] * dt;
    pPos[i * 3 + 1] += pVel[i * 3 + 1] * dt;
    pPos[i * 3 + 2] += pVel[i * 3 + 2] * dt;
  }
  if (any) pGeo.attributes.position.needsUpdate = true;
}

// camera orbit + smooth fly-to + first-person walk mode
let camTheta = 0.7, camPhi = 0.42, camDist = 16, camTarget = new THREE.Vector3(4, 2, 3);
let autoSpin = true;
let flyTo = null;            // {target: Vector3, dist} — camera glides there
let buildCenter = new THREE.Vector3(4, 2, 3), buildDist = 16;
let walkMode = false, walkYaw = 0, walkPitch = -0.1;
const walkPos = new THREE.Vector3(0, 3, 10);
const keys = {};
function updateCam() {
  if (walkMode) return;
  camera.position.set(
    camTarget.x + camDist * Math.cos(camPhi) * Math.sin(camTheta),
    camTarget.y + camDist * Math.sin(camPhi),
    camTarget.z + camDist * Math.cos(camPhi) * Math.cos(camTheta),
  );
  camera.lookAt(camTarget);
}
let dragging = false, lastX = 0, lastY = 0;
holder.addEventListener('pointerdown', e => { dragging = true; if (!walkMode) { autoSpin = false; flyTo = null; } lastX = e.clientX; lastY = e.clientY; });
window.addEventListener('pointerup', () => dragging = false);
window.addEventListener('pointermove', e => {
  if (!dragging) return;
  if (walkMode) {
    walkYaw -= (e.clientX - lastX) * 0.005;
    walkPitch = Math.min(1.45, Math.max(-1.45, walkPitch - (e.clientY - lastY) * 0.004));
  } else {
    camTheta -= (e.clientX - lastX) * 0.008;
    camPhi = Math.min(1.4, Math.max(-1.1, camPhi + (e.clientY - lastY) * 0.006));
    updateCam();
  }
  lastX = e.clientX; lastY = e.clientY;
});
holder.addEventListener('wheel', e => { e.preventDefault(); if (walkMode) return; flyTo = null; camDist = Math.min(50, Math.max(5, camDist + e.deltaY * 0.02)); updateCam(); }, { passive: false });

window.addEventListener('keydown', e => {
  if (!walkMode) return;
  const tag = (document.activeElement || {}).tagName;
  if (tag === 'INPUT' || tag === 'TEXTAREA') return;
  keys[e.code] = true;
  if (['Space', 'KeyW', 'KeyA', 'KeyS', 'KeyD', 'KeyC'].includes(e.code)) e.preventDefault();
});
window.addEventListener('keyup', e => { keys[e.code] = false; });

function setWalkMode(on) {
  walkMode = on;
  document.getElementById('tut-walkhint').style.display = on ? 'block' : 'none';
  document.getElementById('tut-walk').style.background = on ? '#4c7f36' : '';
  if (on) {
    // start at the edge of the build, facing it, at eye height
    walkPos.set(buildCenter.x, Math.max(1.7, buildCenter.y - 1), buildCenter.z + buildDist * 0.7);
    walkYaw = 0; // yaw 0 faces -z, toward the build
    walkPitch = -0.15;
  } else {
    autoSpin = true;
    flyTo = { target: buildCenter.clone(), dist: buildDist };
    updateCam();
  }
}
document.getElementById('tut-walk').onclick = () => setWalkMode(!walkMode);
document.getElementById('tut-day').onclick = () => setDaylight(!isDay);

// hover inspector: name + coordinates of the block under the cursor
const raycaster = new THREE.Raycaster();
const pointerNdc = new THREE.Vector2();
const tipEl = document.getElementById('tut-tip');
holder.addEventListener('pointermove', e => {
  if (dragging || walkMode || !renderer) { tipEl.style.display = 'none'; return; }
  const rect = holder.getBoundingClientRect();
  pointerNdc.set(((e.clientX - rect.left) / rect.width) * 2 - 1, -((e.clientY - rect.top) / rect.height) * 2 + 1);
  raycaster.setFromCamera(pointerNdc, camera);
  const hits = raycaster.intersectObjects(world.children, true);
  let info = null;
  for (const h of hits) {
    let o = h.object;
    while (o && o !== world && !o.userData.blockType) o = o.parent;
    if (o && o.userData.blockType) { info = o.userData; break; }
  }
  if (info) {
    tipEl.textContent = `${info.blockType.split('|')[0].replace(/_/g, ' ')}  (${info.bx}, ${info.by}, ${info.bz})`;
    tipEl.style.display = 'block';
    tipEl.style.left = (e.clientX - rect.left + 14) + 'px';
    tipEl.style.top = (e.clientY - rect.top + 10) + 'px';
  } else {
    tipEl.style.display = 'none';
  }
});
holder.addEventListener('pointerleave', () => tipEl.style.display = 'none');

// ghost preview of the NEXT step's blocks while paused
const ghostGroup = new THREE.Group();
scene.add(ghostGroup);
const ghostMat = new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.22, depthWrite: false });
function updateGhosts() {
  ghostGroup.clear();
  if (playing || !current) return;
  const next = current.steps[stepIndex + 1];
  if (!next) return;
  for (const [x, y, z] of (next.blocks || []).slice(0, 400)) {
    const g = new THREE.Mesh(boxGeo, ghostMat);
    g.scale.setScalar(0.95);
    g.position.set(x + 0.5, y + 0.5, z + 0.5);
    ghostGroup.add(g);
  }
}

// white flash when a block lands
let flashes = [];
function addFlash(x, y, z) {
  const m = new THREE.Mesh(boxGeo, new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.75, depthWrite: false }));
  m.scale.setScalar(1.06);
  m.position.set(x, y, z);
  scene.add(m);
  flashes.push({ m, t: 0 });
}

function resize() {
  if (!renderer) return;
  const w = holder.clientWidth, h = holder.clientHeight;
  if (!w || !h) return;
  renderer.setSize(w, h);
  camera.aspect = w / h;
  camera.updateProjectionMatrix();
}
window.tutResize = resize;
window.addEventListener('resize', resize);

// ---------- tutorial state ----------
let current = null;         // active tutorial
let stepIndex = -1;         // last applied step
let placed = new Map();     // "x,y,z" -> mesh
let popping = [];           // meshes animating in
let playing = false;
let playTimer = 0;

const captionEl = document.getElementById('tut-caption');
const scrub = document.getElementById('tut-scrub');
const progressEl = document.getElementById('tut-progress');
const playBtn = document.getElementById('tut-play');

function clearWorld() {
  for (const m of placed.values()) world.remove(m);
  placed.clear();
  popping = [];
}

function applyStep(step, animate) {
  if (step.remove) for (const [x, y, z] of step.remove) {
    const k = `${x},${y},${z}`;
    if (placed.has(k)) { world.remove(placed.get(k)); placed.delete(k); }
  }
  if (step.replace) for (const [x, y, z] of step.replace) {
    const k = `${x},${y},${z}`;
    if (placed.has(k)) { world.remove(placed.get(k)); placed.delete(k); }
  }
  const blocks = step.blocks || [];
  blocks.forEach(([x, y, z, type], i) => {
    const k = `${x},${y},${z}`;
    if (placed.has(k)) { world.remove(placed.get(k)); placed.delete(k); }
    const mesh = blockMesh(type);
    mesh.position.set(x + 0.5, y + 0.5, z + 0.5);
    mesh.userData.blockType = type;
    mesh.userData.bx = x; mesh.userData.by = y; mesh.userData.bz = z;
    world.add(mesh);
    placed.set(k, mesh);
    if (animate) {
      const base = mesh.scale.clone();
      mesh.scale.setScalar(0.001);
      popping.push({ mesh, base, t: -i * 0.02, type, burst: false });
    }
  });
}

function goToStep(n, animate = true) {
  if (!current) return;
  n = Math.max(0, Math.min(current.steps.length - 1, n));
  if (n < stepIndex || stepIndex === -1) {
    clearWorld();
    for (let i = 0; i <= n; i++) applyStep(current.steps[i], i === n && animate);
  } else {
    for (let i = stepIndex + 1; i <= n; i++) applyStep(current.steps[i], animate);
  }
  stepIndex = n;
  const st = current.steps[n];
  captionEl.innerHTML = `<span class="stepno">Step ${n + 1}/${current.steps.length}</span>${st.caption}` +
    (st.ed ? `<span class="ed">◆ ${st.ed}</span>` : '');
  scrub.max = current.steps.length - 1;
  scrub.value = n;
  progressEl.textContent = `${n + 1} / ${current.steps.length}`;
  playTimer = 0;
  // cinematic: glide the camera to frame this step's new blocks
  if (!walkMode) {
    const blocks = st.blocks || [];
    if (blocks.length) {
      let mn = [1e9, 1e9, 1e9], mx = [-1e9, -1e9, -1e9];
      for (const [x, y, z] of blocks) {
        mn = [Math.min(mn[0], x), Math.min(mn[1], y), Math.min(mn[2], z)];
        mx = [Math.max(mx[0], x), Math.max(mx[1], y), Math.max(mx[2], z)];
      }
      const c = new THREE.Vector3((mn[0] + mx[0]) / 2 + 0.5, (mn[1] + mx[1]) / 2 + 0.5, (mn[2] + mx[2]) / 2 + 0.5);
      const extent = Math.max(mx[0] - mn[0], mx[1] - mn[1], mx[2] - mn[2]) + 1;
      // blend step focus with the whole build so we never lose context
      const target = c.lerp(buildCenter, 0.35);
      const dist = Math.min(buildDist + 4, Math.max(8, extent * 2.2 + 5, buildDist * 0.55));
      flyTo = { target, dist };
    } else {
      flyTo = { target: buildCenter.clone(), dist: buildDist }; // caption-only step: show it all
    }
  }
  updateGhosts();
}

// what item each schematic block type costs the player
const MATERIAL_MAP = {
  farmland: 'dirt', wheat_young: 'wheat_seeds', wheat: 'wheat_seeds',
  water: 'water_bucket', lava: 'lava_bucket', redstone_wire: 'redstone',
  trapdoor_top: 'oak_trapdoor', bed_foot: 'red_bed', bed_head: null,
  iron_trapdoor_top: 'iron_trapdoor', powered_rail: 'powered_rail',
};
function materialFor(type) {
  if (type.startsWith('marker|')) return null;
  const base = type.split('|')[0];
  return base in MATERIAL_MAP ? MATERIAL_MAP[base] : base;
}
function computeMaterials(t) {
  const state = new Map();
  const counts = {};
  const inc = (ty) => { const m = materialFor(ty); if (m) counts[m] = (counts[m] || 0) + 1; };
  for (const st of t.steps) {
    for (const list of [st.remove || [], st.replace || []]) {
      for (const [x, y, z] of list) {
        const k = `${x},${y},${z}`;
        if (state.has(k)) { inc(state.get(k)); state.delete(k); } // was placed, so it was needed
      }
    }
    for (const [x, y, z, ty] of st.blocks || []) state.set(`${x},${y},${z}`, ty);
  }
  for (const ty of state.values()) inc(ty);
  // water/lava buckets: you only need one bucket, you can re-scoop
  if (counts.water_bucket) counts.water_bucket = Math.min(counts.water_bucket, 2);
  if (counts.lava_bucket) counts.lava_bucket = 1;
  return counts;
}
function renderMaterials(t) {
  const el = document.getElementById('tut-materials');
  el.innerHTML = '<span class="mat-label">📦 You need:</span>';
  const counts = computeMaterials(t);
  const entries = Object.entries(counts).sort((a, b) => b[1] - a[1]);
  for (const [name, n] of entries) {
    const d = document.createElement('div');
    d.className = 'mat';
    const texUrl = (window.MC_TEX && window.MC_TEX[name]) || null;
    const disp = name.replace(/_/g, ' ');
    d.title = n + ' × ' + disp;
    d.innerHTML = (texUrl ? `<img src="${texUrl}" alt="">` : `<span style="font-size:10px;color:#fff">${disp.slice(0, 3)}</span>`) +
      (n > 1 ? `<span class="cnt">${n}</span>` : '');
    el.appendChild(d);
  }
}

function loadTutorial(idx) {
  current = TUTORIALS[idx];
  stepIndex = -1;
  renderMaterials(current);
  // center camera on schematic bounds
  let min = [1e9, 1e9, 1e9], max = [-1e9, -1e9, -1e9];
  for (const st of current.steps) for (const [x, y, z] of (st.blocks || [])) {
    min = [Math.min(min[0], x), Math.min(min[1], y), Math.min(min[2], z)];
    max = [Math.max(max[0], x), Math.max(max[1], y), Math.max(max[2], z)];
  }
  camTarget.set((min[0] + max[0]) / 2 + 0.5, (min[1] + max[1]) / 2 + 0.5, (min[2] + max[2]) / 2 + 0.5);
  camDist = current.cam || 14;
  buildCenter.copy(camTarget);
  buildDist = camDist;
  flyTo = null;
  autoSpin = true;
  // grass field around the build, at the build's lowest level
  // ground stays at the surface (y=0); underground rooms show through the cutout like a cutaway
  buildGround(min[0], max[0] + 1, min[2], max[2] + 1, 0);
  sun.target.position.copy(camTarget);
  sun.target.updateMatrixWorld();
  updateCam();
  document.querySelectorAll('#tut-bar button').forEach((b, i) => b.classList.toggle('active', i === idx));
  // link to real YouTube tutorials for this exact build
  const q = encodeURIComponent('minecraft bedrock ' + current.name.replace(/[^\w\s]/g, '').trim() + ' tutorial');
  document.getElementById('tut-yt').href = 'https://www.youtube.com/results?search_query=' + q;
  goToStep(0);
  setPlaying(true);
}

function setPlaying(p) {
  playing = p;
  playBtn.textContent = p ? '⏸' : '▶';
  if (p && current && stepIndex >= current.steps.length - 1) goToStep(0);
  updateGhosts();
}

playBtn.onclick = () => setPlaying(!playing);
document.getElementById('tut-prev').onclick = () => { setPlaying(false); goToStep(stepIndex - 1); };
document.getElementById('tut-next').onclick = () => { setPlaying(false); goToStep(stepIndex + 1); };
scrub.oninput = () => { setPlaying(false); goToStep(Number(scrub.value)); };

// playback speed + camera reset
let playSpeed = 1;
document.getElementById('tut-speed').onclick = (e) => {
  playSpeed = playSpeed === 1 ? 2 : playSpeed === 2 ? 0.5 : 1;
  e.target.textContent = playSpeed + 'x';
};
document.getElementById('tut-view').onclick = () => {
  if (walkMode) setWalkMode(false);
  camTheta = 0.7; camPhi = 0.42;
  flyTo = { target: buildCenter.clone(), dist: buildDist };
  autoSpin = true;
  updateCam();
};
document.getElementById('tut-sound').onclick = (e) => {
  soundOn = !soundOn;
  e.target.textContent = soundOn ? '🔊' : '🔇';
  if (soundOn) placeSound();
};

const bar = document.getElementById('tut-bar');
function renderBar() {
  bar.innerHTML = '';
  const addLabel = (text) => {
    const s = document.createElement('span');
    s.className = 'tut-group-label';
    s.textContent = text;
    bar.appendChild(s);
  };
  let lastKind = null;
  TUTORIALS.forEach((t, i) => {
    const kind = t.custom ? 'ai' : (t.kind || 'farm');
    if (kind !== lastKind) {
      addLabel(kind === 'farm' ? '🌾 Farms & Machines' : kind === 'structure' ? '🏛 Structures' : '🤖 Your AI Builds');
      lastKind = kind;
    }
    const b = document.createElement('button');
    b.textContent = t.name;
    b.onclick = () => loadTutorial(i);
    if (current === t) b.classList.add('active');
    bar.appendChild(b);
  });
}
renderBar();

// ---------- AI-built tutorials: the chat AI emits build JSON, we play it ----------
// def: {name, cam?, steps:[{caption, ed?, blocks?:[[x,y,z,type]], fill?:[[type,x1,y1,z1,x2,y2,z2]], remove?:[[x,y,z]]}]}
const MAX_BLOCKS = 6000;
function normalizeCustom(def) {
  const clamp = (v) => Math.max(-40, Math.min(40, Math.round(Number(v) || 0)));
  let total = 0;
  const steps = (def.steps || []).slice(0, 14).map(st => {
    const blocks = [];
    for (const b of (st.blocks || [])) {
      if (total > MAX_BLOCKS) break;
      blocks.push([clamp(b[0]), clamp(b[1]), clamp(b[2]), String(b[3] || 'stone')]);
      total++;
    }
    for (const f of (st.fill || [])) {
      const type = String(f[0] || 'stone');
      const [x1, y1, z1, x2, y2, z2] = [1, 2, 3, 4, 5, 6].map(i => clamp(f[i]));
      for (let x = Math.min(x1, x2); x <= Math.max(x1, x2); x++)
        for (let y = Math.min(y1, y2); y <= Math.max(y1, y2); y++)
          for (let z = Math.min(z1, z2); z <= Math.max(z1, z2); z++) {
            if (total > MAX_BLOCKS) break;
            blocks.push([x, y, z, type]);
            total++;
          }
    }
    const out = { caption: String(st.caption || '...'), blocks };
    if (st.ed) out.ed = String(st.ed);
    if (Array.isArray(st.remove)) out.remove = st.remove.map(r => [clamp(r[0]), clamp(r[1]), clamp(r[2])]);
    return out;
  }).filter(st => st.blocks.length || st.remove || st.caption);
  if (!steps.length) return null;
  return { name: '🤖 ' + String(def.name || 'AI Build').slice(0, 26), steps, cam: Math.max(6, Math.min(30, Number(def.cam) || 14)), custom: true };
}
window.addCustomTutorial = function (def) {
  const tut = normalizeCustom(def);
  if (!tut) return -1;
  // same-name AI build replaces the old version (so "make it bigger" edits update in place)
  const existing = TUTORIALS.findIndex(t => t.custom && t.name === tut.name);
  if (existing >= 0) TUTORIALS[existing] = tut; else TUTORIALS.push(tut);
  renderBar();
  return existing >= 0 ? existing : TUTORIALS.length - 1;
};
window.playTutorial = function (idx) {
  if (!TUTORIALS[idx]) return;
  window.showTab('tutorials');
  loadTutorial(idx);
  renderBar();
};

// ---------- render loop ----------
const clock = new THREE.Clock();
let waterFrame = 0;
function animate() {
  requestAnimationFrame(animate);
  const dt = Math.min(clock.getDelta(), 0.1);

  // pop-in animation + dust burst + sound the moment each block appears
  for (const p of popping) {
    p.t += dt * 3;
    if (!p.burst && p.t >= 0) {
      p.burst = true;
      spawnBurst(p.mesh.position.x, p.mesh.position.y, p.mesh.position.z, p.type);
      addFlash(p.mesh.position.x, p.mesh.position.y, p.mesh.position.z);
      blockSound(p.type);
    }
    const s = Math.min(1, Math.max(0.001, p.t));
    const ease = 1 - Math.pow(1 - s, 3);
    p.mesh.scale.set(p.base.x * ease, p.base.y * ease, p.base.z * ease);
  }
  popping = popping.filter(p => p.t < 1);
  updateParticles(dt);

  // animated water / lava frames
  waterFrame += dt * 8;
  for (const t of animatedTextures) {
    const frames = t.userData.animFrames;
    const f = Math.floor(waterFrame) % frames;
    t.offset.y = 1 - (f + 1) / frames;
  }

  // auto play: advance steps every ~4.5s
  if (playing && current) {
    playTimer += dt;
    const dur = 4.5 / playSpeed;
    if (playTimer > dur) {
      if (stepIndex < current.steps.length - 1) goToStep(stepIndex + 1);
      else setPlaying(false);
    }
  }

  // flash overlays fade out
  for (const f of flashes) {
    f.t += dt;
    f.m.material.opacity = Math.max(0, 0.75 * (1 - f.t / 0.4));
    f.m.scale.setScalar(1.06 + f.t * 0.25);
    if (f.t >= 0.4) { scene.remove(f.m); f.m.material.dispose(); }
  }
  flashes = flashes.filter(f => f.t < 0.4);

  if (walkMode) {
    // first-person: WASD relative to look direction, SPACE up, C down
    const speed = (keys.ShiftLeft || keys.ShiftRight) ? 9 : 4.5;
    const fx = -Math.sin(walkYaw), fz = -Math.cos(walkYaw);
    const rx = Math.cos(walkYaw), rz = -Math.sin(walkYaw);
    if (keys.KeyW) { walkPos.x += fx * speed * dt; walkPos.z += fz * speed * dt; }
    if (keys.KeyS) { walkPos.x -= fx * speed * dt; walkPos.z -= fz * speed * dt; }
    if (keys.KeyA) { walkPos.x -= rx * speed * dt; walkPos.z -= rz * speed * dt; }
    if (keys.KeyD) { walkPos.x += rx * speed * dt; walkPos.z += rz * speed * dt; }
    if (keys.Space) walkPos.y += speed * dt;
    if (keys.KeyC) walkPos.y -= speed * dt;
    walkPos.y = Math.max(-9, walkPos.y);
    camera.position.copy(walkPos);
    camera.rotation.order = 'YXZ';
    camera.rotation.set(walkPitch, walkYaw, 0);
  } else {
    if (flyTo) {
      // glide toward the step's framing
      const k = Math.min(1, dt * 2.6);
      camTarget.lerp(flyTo.target, k);
      camDist += (flyTo.dist - camDist) * k;
      if (camTarget.distanceTo(flyTo.target) < 0.05 && Math.abs(camDist - flyTo.dist) < 0.1) flyTo = null;
      updateCam();
    }
    if (autoSpin) { camTheta += dt * 0.12; updateCam(); }
  }

  // clouds drift and wrap
  for (const c of clouds.children) {
    c.position.x += dt * 0.8;
    if (c.position.x > 70) c.position.x = -70;
  }

  resize();
  renderer.render(scene, camera);
}
loadTutorial(0);
setPlaying(false);
updateCam();
if (renderer) animate();
