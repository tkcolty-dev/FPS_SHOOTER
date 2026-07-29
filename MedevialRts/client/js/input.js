// Input: mouse + keyboard + up to two Xbox controllers, routed to local
// players. Mouse/keyboard always belong to local player 0. Controllers:
//   • 1 local player  → first pad drives them
//   • 2 locals, mouse in use → first pad drives local player 2
//   • 2 locals, no mouse (e.g. Xbox) → pad 1 → P1, pad 2 → P2

import { G, selEnts, canPlaceAt } from './state.js';
import { cmd } from './net.js';
import { screenToWorld, vpForLocal, camStateFor } from './renderer.js';
import { BUILDINGS, UNITS } from '/shared/gamedata.js';
import {
  openBuildMenu, refreshPanels, toast,
  gpMoveFocus, gpClickFocused, backAction,
  gpMoveFocusPanel, gpClickFocusedPanel,
} from './ui.js';

const PAN_SPEED = 900;
const CURSOR_SPEED = 1100;
const keys = {};

function camOf(L) { return camStateFor(L.lp); }

function clampCam(cs) {
  cs.x = Math.max(0, Math.min(G.world.w, cs.x));
  cs.y = Math.max(0, Math.min(G.world.h, cs.y));
}

export function initInput() {
  const overlay = document.getElementById('overlay-canvas');

  addEventListener('keydown', e => {
    keys[e.key.toLowerCase()] = true;
    if (G.screen !== 'game' || !G.local.length) return;
    const L = G.local[0];
    if (e.key === 'Escape') cancelAction(L);
    if (e.key.toLowerCase() === 'b') openBuildMenu(L);
  });
  addEventListener('keyup', e => { keys[e.key.toLowerCase()] = false; });

  const inMyHalf = (L, x) => G.mode !== '1v1' || (x >= vpForLocal(L.lp).x && x <= vpForLocal(L.lp).x + vpForLocal(L.lp).w);

  overlay.addEventListener('mousemove', e => {
    G.mouseSeen = true;
    const L = G.local[0];
    if (!L) return;
    if (!L.usesPad) { L.cursor.x = e.clientX; L.cursor.y = e.clientY; }
    if (L.drag) { L.drag.x1 = e.clientX; L.drag.y1 = e.clientY; }
  });

  overlay.addEventListener('mousedown', e => {
    const L = G.local[0];
    if (!L || !inMyHalf(L, e.clientX)) return;
    L.usesPad = false;
    if (e.button === 0) {
      if (L.placing) { placeAt(L, e.clientX, e.clientY); return; }
      L.drag = { x0: e.clientX, y0: e.clientY, x1: e.clientX, y1: e.clientY };
    } else if (e.button === 2) {
      if (L.placing) { L.placing = null; refreshPanels(); return; } // right-click exits placement
      commandAt(L, e.clientX, e.clientY);
    }
  });

  addEventListener('mouseup', e => {
    const L = G.local[0];
    if (L && e.button === 0 && L.drag) { finishDrag(L, !e.shiftKey); L.drag = null; }
  });

  overlay.addEventListener('contextmenu', e => e.preventDefault());

  overlay.addEventListener('wheel', e => {
    const L = (G.mode === '1v1' && e.clientX > innerWidth / 2 && G.local[1]) ? G.local[1] : G.local[0];
    if (!L) return;
    const cs = camOf(L);
    cs.zoom = Math.max(0.55, Math.min(1.7, cs.zoom * (e.deltaY > 0 ? 0.9 : 1.11)));
  }, { passive: true });

  // minimap click → jump local 0's camera
  const mini = document.getElementById('minimap');
  const jump = e => {
    const r = mini.getBoundingClientRect();
    const L = G.local[0];
    if (!L) return;
    const cs = camOf(L);
    cs.x = (e.clientX - r.left) / r.width * G.world.w;
    cs.y = (e.clientY - r.top) / r.height * G.world.h;
    clampCam(cs);
  };
  mini.addEventListener('mousedown', e => { jump(e); mini.dataset.drag = '1'; });
  addEventListener('mousemove', e => { if (mini.dataset.drag === '1') jump(e); });
  addEventListener('mouseup', () => { mini.dataset.drag = '0'; });
}

// ---------------------------------------------------------------- actions

export function cancelAction(L) {
  if (L.placing) { L.placing = null; refreshPanels(); return; }
  if (L.buildOpen) { L.buildOpen = false; refreshPanels(); return; }
  L.sel.clear();
  refreshPanels();
}

function placeAt(L, sx, sy) {
  const w = screenToWorld(sx, sy, L.lp);
  const builders = selEnts(L).filter(e => e.k === 'builder').map(e => e.i);
  if (!builders.length) { L.placing = null; refreshPanels(); return; }
  const err = canPlaceAt(L, L.placing, w);
  if (err) { toast(`❌ ${err}`); return; } // stay in placement mode, try again
  cmd(L, { kind: 'build', b: L.placing, ids: builders, x: w.x, y: w.y });
  // walls chain-place so you can drag out a rampart; others place once
  if (L.placing !== 'wall') { L.placing = null; L.buildOpen = false; }
  refreshPanels();
}

function entAt(sx, sy, lp) {
  const w = screenToWorld(sx, sy, lp);
  let best = null, bd = 1e9;
  for (const e of G.ents.values()) {
    if (e.k === 'farm') continue;
    const r = (e.r || 14) + 8;
    const d = Math.hypot(e.x - w.x, e.y - w.y);
    if (d < r && d < bd) { bd = d; best = e; }
  }
  return best;
}

function finishDrag(L, replace) {
  const { x0, y0, x1, y1 } = L.drag;
  const isClick = Math.abs(x1 - x0) < 8 && Math.abs(y1 - y0) < 8;

  if (isClick) {
    const e = entAt(x0, y0, L.lp);
    if (e && e.o === L.slot) {
      // clicking your own stuff selects it
      if (replace) L.sel.clear();
      L.sel.add(e.i);
      L.buildOpen = false;
    } else {
      // clicking ground/enemy with units selected COMMANDS them (click-to-move)
      const selUnits = selEnts(L).filter(u => !BUILDINGS[u.k]);
      if (selUnits.length) {
        commandAt(L, x0, y0);
      } else if (replace) {
        L.sel.clear();
      }
    }
    refreshPanels();
    return;
  }

  if (replace) L.sel.clear();
  L.buildOpen = false;
  {
    const wa = screenToWorld(Math.min(x0, x1), Math.min(y0, y1), L.lp);
    const wb = screenToWorld(Math.max(x0, x1), Math.max(y0, y1), L.lp);
    const xLo = Math.min(wa.x, wb.x), xHi = Math.max(wa.x, wb.x);
    const yLo = Math.min(wa.y, wb.y), yHi = Math.max(wa.y, wb.y);
    const units = [], blds = [];
    for (const e of G.ents.values()) {
      if (e.o !== L.slot) continue;
      if (e.x >= xLo && e.x <= xHi && e.y >= yLo && e.y <= yHi) {
        (BUILDINGS[e.k] ? blds : units).push(e);
      }
    }
    if (units.length) for (const u of units) L.sel.add(u.i);
    else if (blds.length) L.sel.add(blds[0].i);
  }
  refreshPanels();
}

function commandAt(L, sx, sy) {
  const sel = selEnts(L).filter(e => !BUILDINGS[e.k]);
  if (!sel.length) return;
  const target = entAt(sx, sy, L.lp);
  const myTeam = t => {
    const p = G.players.find(p => p.slot === t.o);
    const me = G.players.find(p => p.slot === L.slot);
    return p && me && p.team === me.team;
  };
  if (target && target.o !== -1 && !myTeam(target)) {
    cmd(L, { kind: 'attack', ids: sel.map(e => e.i), target: target.i });
  } else {
    const w = screenToWorld(sx, sy, L.lp);
    cmd(L, { kind: 'move', ids: sel.map(e => e.i), x: w.x, y: w.y });
  }
}

// ---------------------------------------------------------------- per-frame

export function tickInput(dt) {
  if (G.screen === 'game' && G.local.length) {
    const L0 = G.local[0];
    const cs = camOf(L0);
    let dx = 0, dy = 0;
    if (keys['w'] || keys['arrowup']) dy -= 1;
    if (keys['s'] || keys['arrowdown']) dy += 1;
    if (keys['a'] || keys['arrowleft']) dx -= 1;
    if (keys['d'] || keys['arrowright']) dx += 1;
    if (G.mouseSeen && !L0.usesPad) {
      if (L0.cursor.x < 14) dx -= 1;
      if (L0.cursor.x > innerWidth - 14) dx += 1;
      if (L0.cursor.y < 14) dy -= 1;
      if (L0.cursor.y > innerHeight - 14) dy += 1;
    }
    cs.x += dx * PAN_SPEED * dt / cs.zoom;
    cs.y += dy * PAN_SPEED * dt / cs.zoom;
    clampCam(cs);
  }
  tickGamepads(dt);
}

// ---------------------------------------------------------------- gamepads

const prevBtn = {};   // pad.index -> {button: bool}
const repState = {};  // menu stick-repeat timers
const DEAD = 0.22;

function pressed(gp, i) {
  const store = prevBtn[gp.index] || (prevBtn[gp.index] = {});
  const now = gp.buttons[i] && gp.buttons[i].pressed;
  const was = store[i];
  store[i] = now;
  return now && !was;
}
function held(gp, i) { return gp.buttons[i] && gp.buttons[i].pressed; }
function axis(gp, i) {
  const v = gp.axes[i] || 0;
  return Math.abs(v) < DEAD ? 0 : v;
}

function connectedPads() {
  const out = [];
  for (const p of navigator.getGamepads ? navigator.getGamepads() : []) {
    if (p && p.connected) out.push(p);
  }
  return out;
}

function padAssignments(pads) {
  if (!G.local.length) return [];
  if (G.local.length === 1) return pads.length ? [[pads[0], G.local[0]]] : [];
  if (G.mouseSeen) return pads.length ? [[pads[0], G.local[1]]] : [];
  return pads.slice(0, 2).map((p, i) => [p, G.local[i]]);
}

function tickGamepads(dt) {
  const pads = connectedPads();
  if (!pads.length) return;

  let anyActivity = false;
  for (const gp of pads) {
    if (gp.buttons.some(b => b.pressed) ||
        Math.abs(axis(gp, 0)) + Math.abs(axis(gp, 1)) + Math.abs(axis(gp, 2)) + Math.abs(axis(gp, 3)) > 0) {
      anyActivity = true;
    }
  }
  if (anyActivity) {
    G.gamepadActive = true;
    const hints = document.getElementById('gp-hints');
    if (hints) hints.classList.add('on');
  }

  // menu screens: first pad drives DOM focus
  if (G.screen !== 'game') {
    const gp = pads[0];
    const ly = axis(gp, 1);
    const dir =
      (pressed(gp, 12) || stickRepeat('u', ly < -0.6, dt)) ? -1 :
      (pressed(gp, 13) || stickRepeat('d', ly > 0.6, dt)) ? 1 : 0;
    if (G.gamepadActive) {
      if (dir) gpMoveFocus(dir);
      if (pressed(gp, 0)) gpClickFocused();
      if (pressed(gp, 1)) backAction();
    }
    for (let i = 2; i < gp.buttons.length; i++) pressed(gp, i);
    return;
  }

  for (const [gp, L] of padAssignments(pads)) {
    if (!L) continue;
    tickPadForLocal(gp, L, dt);
  }
}

function tickPadForLocal(gp, L, dt) {
  const lx = axis(gp, 0), ly = axis(gp, 1), rx = axis(gp, 2), ry = axis(gp, 3);
  if (Math.abs(lx) + Math.abs(ly) > 0 || gp.buttons.some(b => b.pressed)) L.usesPad = true;
  if (!L.usesPad) { for (let i = 0; i < gp.buttons.length; i++) pressed(gp, i); return; }

  const vp = vpForLocal(L.lp);
  const cs = camOf(L);

  L.cursor.x = Math.max(vp.x, Math.min(vp.x + vp.w, L.cursor.x + lx * CURSOR_SPEED * dt));
  L.cursor.y = Math.max(vp.y, Math.min(vp.y + vp.h, L.cursor.y + ly * CURSOR_SPEED * dt));
  cs.x += rx * PAN_SPEED * 1.2 * dt / cs.zoom;
  cs.y += ry * PAN_SPEED * 1.2 * dt / cs.zoom;
  // cursor pushes camera at viewport edges
  if (L.cursor.x < vp.x + 30 && lx < 0) cs.x += lx * PAN_SPEED * dt / cs.zoom;
  if (L.cursor.x > vp.x + vp.w - 30 && lx > 0) cs.x += lx * PAN_SPEED * dt / cs.zoom;
  if (L.cursor.y < vp.y + 30 && ly < 0) cs.y += ly * PAN_SPEED * dt / cs.zoom;
  if (L.cursor.y > vp.y + vp.h - 30 && ly > 0) cs.y += ly * PAN_SPEED * dt / cs.zoom;
  clampCam(cs);

  // triggers zoom
  if (held(gp, 6)) cs.zoom = Math.max(0.55, cs.zoom * (1 - dt * 0.8));
  if (held(gp, 7)) cs.zoom = Math.min(1.7, cs.zoom * (1 + dt * 0.8));

  // d-pad navigates this player's action bar
  if (pressed(gp, 14) || pressed(gp, 12)) gpMoveFocusPanel(L, -1);
  if (pressed(gp, 15) || pressed(gp, 13)) gpMoveFocusPanel(L, 1);

  // A: place / select / command (hold + move = box select)
  if (pressed(gp, 0)) {
    if (L.placing) placeAt(L, L.cursor.x, L.cursor.y);
    else if (document.querySelector(`.player-panel[data-lp="${L.lp}"] .act-btn.gp-focus`)) gpClickFocusedPanel(L);
    else L.gpDrag = { x0: L.cursor.x, y0: L.cursor.y, moved: false };
  }
  if (L.gpDrag) {
    if (Math.abs(L.cursor.x - L.gpDrag.x0) + Math.abs(L.cursor.y - L.gpDrag.y0) > 14) L.gpDrag.moved = true;
    if (L.gpDrag.moved) L.drag = { x0: L.gpDrag.x0, y0: L.gpDrag.y0, x1: L.cursor.x, y1: L.cursor.y };
    if (!held(gp, 0)) {
      if (L.gpDrag.moved) { finishDrag(L, true); L.drag = null; }
      else aTapAt(L, L.gpDrag.x0, L.gpDrag.y0);
      L.gpDrag = null;
    }
  }

  if (pressed(gp, 1)) cancelAction(L);          // B
  if (pressed(gp, 2)) openBuildMenu(L);         // X
  if (pressed(gp, 3)) selectArmy(L);            // Y
  if (pressed(gp, 5)) selectBuilders(L);        // RB
  if (pressed(gp, 4)) jumpToCastle(L);          // LB
}

function aTapAt(L, sx, sy) {
  const e = entAt(sx, sy, L.lp);
  const selUnits = selEnts(L).filter(u => !BUILDINGS[u.k]);
  const sameTeam = t => {
    const p = G.players.find(p => p.slot === t.o);
    const me = G.players.find(p => p.slot === L.slot);
    return p && me && p.team === me.team;
  };
  if (e && e.o === L.slot) {
    L.sel.clear(); L.sel.add(e.i); L.buildOpen = false; refreshPanels();
  } else if (e && e.o !== -1 && !sameTeam(e) && selUnits.length) {
    cmd(L, { kind: 'attack', ids: selUnits.map(u => u.i), target: e.i });
  } else if (selUnits.length) {
    const w = screenToWorld(sx, sy, L.lp);
    cmd(L, { kind: 'move', ids: selUnits.map(u => u.i), x: w.x, y: w.y });
  } else {
    L.sel.clear(); refreshPanels();
  }
}

function selectArmy(L) {
  L.sel.clear();
  for (const e of G.ents.values()) {
    if (e.o === L.slot && !BUILDINGS[e.k] && UNITS[e.k] && UNITS[e.k].dmg) L.sel.add(e.i);
  }
  refreshPanels();
  toast(L.sel.size ? `Selected army (${L.sel.size})` : 'No army yet — build a Barracks!');
}

function selectBuilders(L) {
  L.sel.clear();
  for (const e of G.ents.values()) if (e.o === L.slot && e.k === 'builder') L.sel.add(e.i);
  refreshPanels();
  toast(L.sel.size ? `Selected builders (${L.sel.size})` : 'No builders — train one at your Castle!');
}

function jumpToCastle(L) {
  for (const e of G.ents.values()) {
    if (e.o === L.slot && e.k === 'castle') {
      const cs = camOf(L);
      cs.x = e.x; cs.y = e.y;
      return;
    }
  }
}

function stickRepeat(key, active, dt) {
  if (!active) { repState[key] = 0; return false; }
  repState[key] = (repState[key] || 0) - dt;
  if (repState[key] <= 0) { repState[key] = 0.28; return true; }
  return false;
}
