// Shared game data — imported by BOTH the server simulation and the client.
// All balance numbers live here so tweaking the game is one-file work.

export const START_MONEY = 150;
export const INCOME_INTERVAL = 1;      // seconds between income payouts
export const AGGRO_RANGE = 150;        // units auto-engage enemies this close
export const MAX_QUEUE = 5;            // per production building

// ---------------------------------------------------------------- modes
// ffa  — classic online battle, 1 player per device, up to 4 devices.
// 2v2  — TWO devices, TWO players per device sharing one screen. Teammates
//        spawn side by side on their team's half of the map.
// 1v1  — ONE device, split screen, small map.
export const MODES = {
  ffa: { name: 'Online Battle', desc: '1–4 devices · every knight for themself', locals: 1, maxSlots: 4 },
  '2v2': { name: '2v2 Team War', desc: '2 devices · 2 players share each screen', locals: 2, maxSlots: 4 },
  '1v1': { name: '1v1 Split Screen', desc: '1 device · left vs right', locals: 2, maxSlots: 2 },
};

export function teamOf(mode, slot) {
  return mode === '2v2' ? (slot < 2 ? 0 : 1) : slot;
}

// Player slot colors (P1..P4).
export const COLORS = ['#4da3ff', '#ff5d5d', '#ffd24d', '#6dde7c'];
export const COLOR_NAMES = ['Blue', 'Red', 'Yellow', 'Green'];

// Kingdom skins — picked per player in the lobby. Placeholder models recolor
// with these palettes; see client/js/models.js (the art file).
export const SKINS = {
  kingdom: { name: 'Kingdom',   stone: '#9a9a9a', stoneDark: '#7d7d7d', wood: '#8a6b45', roof: '#6d3535' },
  royal:   { name: 'Royal',     stone: '#c4b78f', stoneDark: '#a2955f', wood: '#9a7b45', roof: '#7a4ca8' },
  dark:    { name: 'Dark Keep', stone: '#5c5c6a', stoneDark: '#44444f', wood: '#4a3b2b', roof: '#22222e' },
  forest:  { name: 'Forest',    stone: '#8a9678', stoneDark: '#6d7a5c', wood: '#6b5a35', roof: '#3f6d35' },
};
export const SKIN_KEYS = Object.keys(SKINS);

export const BUILDINGS = {
  castle:   { name: 'Castle',         hp: 3000, size: 130, cost: 0,   trains: ['builder'] },
  windmill: { name: 'Windmill',       hp: 400,  size: 76,  cost: 100, income: 30, incomeFar: 8, farmRange: 170 },
  barracks: { name: 'Barracks',       hp: 800,  size: 96,  cost: 150, trains: ['swordsman', 'archer'] },
  stables:  { name: 'Stables',        hp: 800,  size: 96,  cost: 250, trains: ['knight'] },
  workshop: { name: 'Siege Workshop', hp: 800,  size: 96,  cost: 300, trains: ['catapult', 'balloon'] },
  tower:    { name: 'Tower',          hp: 600,  size: 60,  cost: 200, range: 240, dmg: 12, atkCd: 0.8, aa: true },
  wall:     { name: 'Wall',           hp: 500,  size: 40,  cost: 25 },
};

// Walls within this range visually connect into a rampart.
export const WALL_LINK_RANGE = 110;

// aa: can shoot flying units. flying: can only be hit by aa attackers.
export const UNITS = {
  builder:   { name: 'Builder',   hp: 60,  speed: 90,  cost: 30,  trainTime: 4,  buildRate: 55 },
  swordsman: { name: 'Swordsman', hp: 120, speed: 78,  cost: 40,  trainTime: 5,  dmg: 10, range: 30,  atkCd: 0.9 },
  archer:    { name: 'Archer',    hp: 70,  speed: 82,  cost: 60,  trainTime: 6,  dmg: 8,  range: 175, atkCd: 1.1, projectile: 'arrow', aa: true },
  knight:    { name: 'Knight',    hp: 260, speed: 125, cost: 120, trainTime: 8,  dmg: 18, range: 34,  atkCd: 1.0 },
  catapult:  { name: 'Catapult',  hp: 150, speed: 48,  cost: 200, trainTime: 12, dmg: 60, range: 330, atkCd: 3.0, splash: 80, projectile: 'rock' },
  balloon:   { name: 'Hot Air Balloon', hp: 90, speed: 70, cost: 150, trainTime: 10, dmg: 6, range: 150, atkCd: 1.2, projectile: 'arrow', flying: true, aa: true },
};

// Buildings a builder can place, in menu order.
export const BUILD_MENU = ['windmill', 'barracks', 'stables', 'workshop', 'tower', 'wall'];

export const FARM_RADIUS = 55;

export function unitRadius(kind) {
  return kind === 'catapult' ? 18 : kind === 'balloon' ? 20 : 12;
}

// Radius for any entity kind — used by the client (snapshots don't carry size).
export function entRadius(kind) {
  if (kind === 'farm') return FARM_RADIUS;
  if (BUILDINGS[kind]) return BUILDINGS[kind].size / 2;
  return unitRadius(kind);
}

// ---------------------------------------------------------------- maps
// Returns { w, h, spots, farms, trees } for a mode. spots[i] = slot i's castle.

export function makeMap(mode = 'ffa', seed = 7) {
  let s = seed;
  const rnd = () => (s = (s * 1103515245 + 12345) & 0x7fffffff) / 0x7fffffff;

  let w, h, spots;
  if (mode === '2v2') {
    w = 2800; h = 2000;
    spots = [
      { x: 380, y: 620 }, { x: 380, y: 1380 },      // Team West, side by side
      { x: 2420, y: 620 }, { x: 2420, y: 1380 },    // Team East
    ];
  } else if (mode === '1v1') {
    w = 1500; h = 1500;
    spots = [{ x: 300, y: 750 }, { x: 1200, y: 750 }];
  } else {
    w = 2600; h = 2600;
    const m = 320;
    spots = [{ x: m, y: m }, { x: w - m, y: h - m }, { x: w - m, y: m }, { x: m, y: h - m }];
  }

  const farms = [];
  const farmsPer = mode === '1v1' ? 3 : 3;
  for (const c of spots) {
    for (let i = 0; i < farmsPer; i++) {
      const a = rnd() * Math.PI * 2, d = 240 + rnd() * (mode === '1v1' ? 140 : 220);
      farms.push({
        x: Math.min(w - 120, Math.max(120, c.x + Math.cos(a) * d)),
        y: Math.min(h - 120, Math.max(120, c.y + Math.sin(a) * d)),
      });
    }
  }
  const centerFarms = mode === '1v1' ? 3 : 5;
  for (let i = 0; i < centerFarms; i++) {
    farms.push({
      x: w / 2 + (rnd() - 0.5) * w * 0.28,
      y: h / 2 + (rnd() - 0.5) * h * 0.28,
    });
  }

  const trees = [];
  const treeCount = Math.round(w * h / 75000);
  for (let i = 0; i < treeCount; i++) {
    const t = { x: rnd() * w, y: rnd() * h, v: 1 + Math.floor(rnd() * 3) };
    const clear = [...farms, ...spots].every(p => Math.hypot(p.x - t.x, p.y - t.y) > 170);
    if (clear) trees.push(t);
  }
  return { w, h, spots, farms, trees };
}
