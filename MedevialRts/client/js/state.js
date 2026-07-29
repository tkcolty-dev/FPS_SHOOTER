// Single shared mutable state object for all client modules.

export const G = {
  screen: 'title',
  name: '',
  code: '',
  mode: 'ffa',
  hostSlot: 0,
  players: [],            // [{slot, name, bot, skin, team, dead?, left?}]

  // world (set from the server's `begin` message)
  world: { w: 2600, h: 2600 },
  map: { farms: [], trees: [], spots: [] },
  ents: new Map(),        // id -> {i,k,o,x,y,h, r, rx,ry, d,q,p,u}
  moneyAll: {},
  time: 0,

  // shared camera (ffa + 2v2). 1v1 uses each local's own cam.
  cam: { x: 0, y: 0, zoom: 1 },

  // local players on THIS device (1 normally, 2 in 2v2 and 1v1 modes)
  local: [],

  gamepadActive: false,
  mouseSeen: false,
  focusIdx: 0,            // gamepad focus for DOM menu screens
  ws: null,
  gameOver: false,
};

export function mkLocal(lp, slot) {
  return {
    lp, slot,
    sel: new Set(),
    placing: null,
    buildOpen: false,   // builder's building menu expanded?
    cursor: { x: innerWidth / 2, y: innerHeight / 2 },
    cam: { x: 0, y: 0, zoom: 1 },   // used only in 1v1 split mode
    drag: null,
    gpDrag: null,
    focusIdx: 0,
    usesPad: false,
  };
}

export function moneyOf(slot) { return G.moneyAll[slot] ?? 0; }

export function selEnts(L) {
  const out = [];
  for (const id of L.sel) {
    const e = G.ents.get(id);
    if (e) out.push(e); else L.sel.delete(id);
  }
  return out;
}
