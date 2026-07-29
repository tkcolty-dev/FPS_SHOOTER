// Entry point: screen flow, server message wiring, and the render loop.

import { G, mkLocal } from './state.js';
import { send, on } from './net.js';
import { initRender, setupWorld, draw, addShot, addPoof } from './renderer.js';
import { drawTitleBg } from './title.js';
import { initInput, tickInput } from './input.js';
import { buildPanels, refreshPanels, refreshTopHud, renderLobby, toast, gpFocusFirst } from './ui.js';
import { COLOR_NAMES, MODES, entRadius } from '/shared/gamedata.js';

// ---------------------------------------------------------------- screens

function show(screen) {
  G.screen = screen;
  document.querySelectorAll('.screen').forEach(el => el.classList.remove('active'));
  document.getElementById(`screen-${screen}`).classList.add('active');
  document.querySelectorAll('.gp-focus').forEach(el => el.classList.remove('gp-focus'));
  if (G.gamepadActive && screen !== 'game') gpFocusFirst();
}

function myName() {
  const v = document.getElementById('name-input').value.trim();
  return v || `Knight${Math.floor(Math.random() * 900 + 100)}`;
}

// title → mode picker
document.getElementById('btn-host').addEventListener('click', () => {
  localStorage.setItem('mrts-name', document.getElementById('name-input').value);
  show('mode');
});
document.getElementById('btn-join').addEventListener('click', () => {
  localStorage.setItem('mrts-name', document.getElementById('name-input').value);
  document.getElementById('join-error').textContent = '';
  show('join');
  document.getElementById('code-input').focus();
});
document.getElementById('btn-help').addEventListener('click', () => show('help'));
document.getElementById('btn-help-back').addEventListener('click', () => show(G.code ? 'lobby' : 'title'));

// mode picker
for (const mode of Object.keys(MODES)) {
  const btn = document.getElementById(`btn-mode-${mode.replace('v', 'v')}`);
  if (btn) btn.addEventListener('click', () => send({ t: 'host', name: myName(), mode }));
}
document.getElementById('btn-mode-back').addEventListener('click', () => show('title'));

// join
document.getElementById('btn-join-go').addEventListener('click', () => {
  const code = document.getElementById('code-input').value.trim().toUpperCase();
  if (code.length !== 4) { document.getElementById('join-error').textContent = 'Codes are 4 letters.'; return; }
  send({ t: 'join', code, name: myName() });
});
document.getElementById('btn-join-back').addEventListener('click', () => show('title'));
document.getElementById('code-input').addEventListener('keydown', e => {
  if (e.key === 'Enter') document.getElementById('btn-join-go').click();
});

// lobby
document.getElementById('btn-add-bot').addEventListener('click', () => send({ t: 'addBot' }));
document.getElementById('btn-start').addEventListener('click', () => send({ t: 'start' }));
document.getElementById('btn-lobby-back').addEventListener('click', () => {
  send({ t: 'leave' });
  resetGame();
  show('title');
});

// game over
document.getElementById('btn-over-back').addEventListener('click', () => {
  send({ t: 'leave' });
  resetGame();
  show('title');
});

function resetGame() {
  G.code = ''; G.players = []; G.ents.clear();
  G.local = []; G.gameOver = false; G.mode = 'ffa';
}

// ---------------------------------------------------------------- net wiring

on('you', m => {
  G.mode = m.mode;
  G.local = m.slots.map((slot, lp) => mkLocal(lp, slot));
});

on('lobby', m => {
  G.code = m.code;
  G.mode = m.mode;
  G.hostSlot = m.hostSlot;
  G.players = m.players;
  renderLobby();
  if (G.screen !== 'lobby') show('lobby');
});

on('error', m => {
  if (G.screen === 'join') document.getElementById('join-error').textContent = m.msg;
  else toast(m.msg);
});

on('begin', m => {
  G.mode = m.mode;
  G.map = m.map;
  G.world = { w: m.map.w, h: m.map.h };
  G.players = m.players;
  G.ents.clear();
  G.gameOver = false;

  // cameras: FFA → your castle; 2v2 → midpoint of your two castles (shared
  // screen); 1v1 → each half centered on its own castle.
  const spots = m.map.spots;
  if (G.mode === '1v1') {
    for (const L of G.local) {
      L.cam.x = spots[L.slot].x; L.cam.y = spots[L.slot].y; L.cam.zoom = 0.8;
    }
  } else {
    const mine = G.local.map(L => spots[L.slot]).filter(Boolean);
    G.cam.x = mine.reduce((a, s) => a + s.x, 0) / (mine.length || 1);
    G.cam.y = mine.reduce((a, s) => a + s.y, 0) / (mine.length || 1);
    G.cam.zoom = G.local.length === 2 ? 0.7 : 1;
  }

  setupWorld();
  buildPanels();
  show('game');
  toast(G.mode === '2v2' ? 'Team up! Build windmills, then crush the other side ⚔' : 'Build windmills near farms, then raise an army! ⚔');
});

on('state', m => {
  G.time = m.time;
  G.moneyAll = m.money;

  const seen = new Set();
  for (const s of m.ents) {
    seen.add(s.i);
    const e = G.ents.get(s.i);
    if (e) Object.assign(e, s);
    else G.ents.set(s.i, { ...s, r: entRadius(s.k) });
  }
  for (const [id, e] of G.ents) {
    if (!seen.has(id)) {
      G.ents.delete(id);
      for (const L of G.local) L.sel.delete(id);
    }
  }
  for (const id of m.deaths || []) for (const L of G.local) L.sel.delete(id);
  for (const [f, t, kind] of m.shots || []) addShot(f, t, kind);

  refreshTopHud();
  refreshPanels();
});

on('eliminated', m => {
  const p = G.players.find(p => p.slot === m.slot);
  if (p) p.dead = true;
  const isMine = G.local.some(L => L.slot === m.slot);
  toast(isMine ? '💀 Your castle has fallen!' : `${p ? p.name : COLOR_NAMES[m.slot]} has been eliminated!`, 3200);
  const spot = G.map.spots[m.slot];
  if (spot) addPoof(spot.x, spot.y, true);
});

on('left', m => {
  const p = G.players.find(p => p.slot === m.slot);
  if (p) { p.left = true; toast(`${p.name} left the game`); }
});

on('gameover', m => {
  G.gameOver = true;
  const winners = (m.winners || []).map(s => G.players.find(p => p.slot === s)).filter(Boolean);
  const iWon = G.local.some(L => (m.winners || []).includes(L.slot));
  document.getElementById('over-title').textContent = iWon ? '👑 VICTORY!' : '⚔ DEFEAT';
  document.getElementById('over-sub').textContent = winners.length
    ? `${winners.map(w => w.name).join(' & ')} rule${winners.length > 1 ? '' : 's'} the land.`
    : 'Everyone fell. The land lies silent.';
  setTimeout(() => show('over'), 1600);
});

on('_closed', () => {
  if (G.screen !== 'title') {
    toast('Lost connection to server', 4000);
    resetGame();
    show('title');
  }
});

// ---------------------------------------------------------------- boot + loop

document.getElementById('name-input').value = localStorage.getItem('mrts-name') || '';

initRender();
initInput();

let last = performance.now();
function frame(now) {
  const dt = Math.min(0.05, (now - last) / 1000);
  last = now;
  tickInput(dt);
  if (G.screen === 'game') draw(dt, now);
  else if (['title', 'join', 'help', 'mode'].includes(G.screen)) drawTitleBg(now);
  requestAnimationFrame(frame);
}
requestAnimationFrame(frame);
