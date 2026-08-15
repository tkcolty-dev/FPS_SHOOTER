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
    const m = new THREE.MeshBasicMaterial({
      map: tex(icon, { folder: 'item' }), transparent: true, alphaTest: 0.5, side: THREE.DoubleSide,
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
  // repeater / comparator / daylight detector: flat slabs with their real top texture
  if (type === 'repeater' || type === 'comparator' || type === 'daylight_detector') {
    const g = new THREE.Group();
    const h = type === 'daylight_detector' ? 0.38 : 0.14;
    const sideTex = type === 'daylight_detector' ? 'daylight_detector_side' : 'smooth_stone';
    const m = new THREE.Mesh(boxGeo, cubeMats({ top: mat(type === 'daylight_detector' ? 'daylight_detector_top' : type, { transparent: true }), side: mat(sideTex) }));
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
      const bt = window.MC_BLOCKTEX[type];
      const isGlass = type.includes('glass');
      const isLeaves = type.endsWith('_leaves');
      const opts = isGlass ? { transparent: true }
        : isLeaves ? { transparent: true, tint: FOLIAGE }
        : (type === 'slime_block' || type === 'honey_block') ? { transparent: true, opacity: 0.82 }
        : {};
      const mk = (p) => (p ? mat(p, opts) : undefined);
      materials = cubeMats({
        all: mk(bt.all), top: mk(bt.top), bottom: mk(bt.bottom),
        side: mk(bt.side || bt.all || bt.top),
        face: mk(bt.front), back: mk(bt.side || bt.all || bt.top), facing: bt.front ? '+z' : undefined,
      });
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
  holder.appendChild(renderer.domElement);
}
const scene = new THREE.Scene();

// black night sky
scene.background = new THREE.Color('#000000');
scene.fog = new THREE.Fog('#000000', 55, 110);

const camera = new THREE.PerspectiveCamera(55, 1, 0.1, 300);
scene.add(new THREE.AmbientLight(0xffffff, 0.75));
const sun = new THREE.DirectionalLight(0xffffff, 1.6);
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

// stars instead of clouds on the black sky (clouds group kept for the drift animation)
const clouds = new THREE.Group();
scene.add(clouds);
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
  const stars = new THREE.Points(starGeo, new THREE.PointsMaterial({ color: 0xffffff, size: 0.9, fog: false }));
  stars.frustumCulled = false;
  scene.add(stars);
}

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

// camera orbit
let camTheta = 0.7, camPhi = 0.42, camDist = 16, camTarget = new THREE.Vector3(4, 2, 3);
let autoSpin = true;
function updateCam() {
  camera.position.set(
    camTarget.x + camDist * Math.cos(camPhi) * Math.sin(camTheta),
    camTarget.y + camDist * Math.sin(camPhi),
    camTarget.z + camDist * Math.cos(camPhi) * Math.cos(camTheta),
  );
  camera.lookAt(camTarget);
}
let dragging = false, lastX = 0, lastY = 0;
holder.addEventListener('pointerdown', e => { dragging = true; autoSpin = false; lastX = e.clientX; lastY = e.clientY; });
window.addEventListener('pointerup', () => dragging = false);
window.addEventListener('pointermove', e => {
  if (!dragging) return;
  camTheta -= (e.clientX - lastX) * 0.008;
  camPhi = Math.min(1.4, Math.max(0.05, camPhi + (e.clientY - lastY) * 0.006));
  lastX = e.clientX; lastY = e.clientY;
  updateCam();
});
holder.addEventListener('wheel', e => { e.preventDefault(); camDist = Math.min(50, Math.max(5, camDist + e.deltaY * 0.02)); updateCam(); }, { passive: false });

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
  autoSpin = true;
  // grass field around the build, at the build's lowest level
  buildGround(min[0], max[0] + 1, min[2], max[2] + 1, Math.min(0, min[1]));
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
  camTheta = 0.7; camPhi = 0.42; camDist = current ? (current.cam || 14) : 14;
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
  TUTORIALS.forEach((t, i) => {
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

  if (autoSpin) { camTheta += dt * 0.12; updateCam(); }

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
