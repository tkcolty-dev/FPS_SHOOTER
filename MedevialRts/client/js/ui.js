// HUD panels (one per local player), lobby rendering, toasts, and the gamepad
// focus system for both DOM menus and in-game action bars.

import { G, selEnts, moneyOf } from './state.js';
import { cmd, send } from './net.js';
import { BUILDINGS, UNITS, BUILD_MENU, COLORS, COLOR_NAMES, SKINS, MODES } from '/shared/gamedata.js';

const ICONS = {
  windmill: '🌾', barracks: '⚔️', stables: '🐴', workshop: '🪨', tower: '🏹',
  wall: '🧱', builder: '🔨', swordsman: '⚔️', archer: '🏹', knight: '🛡️',
  catapult: '🪨', balloon: '🎈', castle: '🏰',
};

export function toast(msg, ms = 2200) {
  const el = document.getElementById('toast');
  el.textContent = msg;
  el.classList.add('show');
  clearTimeout(el._t);
  el._t = setTimeout(() => el.classList.remove('show'), ms);
}

// ---------------------------------------------------------------- panels

// Build one bottom panel per local player. Called on game start.
export function buildPanels() {
  const wrap = document.getElementById('hud-bottom');
  wrap.innerHTML = '';
  wrap.classList.toggle('dual', G.local.length === 2);
  for (const L of G.local) {
    const p = document.createElement('div');
    p.className = 'player-panel';
    p.dataset.lp = L.lp;
    p.style.borderColor = COLORS[L.slot];
    const who = G.players.find(pl => pl.slot === L.slot);
    p.innerHTML = `
      <div class="pp-head">
        <span class="pp-name" style="color:${COLORS[L.slot]}">${escapeHtml(who ? who.name : 'P' + (L.lp + 1))}</span>
        <span class="pp-money">💰 <b class="pp-money-val">0</b></span>
      </div>
      <div class="pp-sel"></div>
      <div class="pp-actions"></div>`;
    wrap.appendChild(p);
  }
  refreshPanels();
}

export function refreshPanels() {
  for (const L of G.local) refreshPanel(L);
}

function refreshPanel(L) {
  const root = document.querySelector(`.player-panel[data-lp="${L.lp}"]`);
  if (!root) return;
  root.querySelector('.pp-money-val').textContent = moneyOf(L.slot);
  const info = root.querySelector('.pp-sel');
  const bar = root.querySelector('.pp-actions');
  bar.innerHTML = '';
  const sel = selEnts(L);
  const money = moneyOf(L.slot);

  if (L.placing) {
    const spec = BUILDINGS[L.placing];
    info.innerHTML = `<div class="sel-name">Placing: ${spec.name}</div><div class="sel-sub">Click / press A on open ground · B cancels</div>`;
    const btn = mkBtn('✖', 'Cancel', '', () => { L.placing = null; refreshPanels(); });
    btn.classList.add('cancel');
    bar.appendChild(btn);
    return;
  }

  if (!sel.length) {
    info.innerHTML = `<div class="sel-name">Nothing selected</div><div class="sel-sub">Drag / hold A to select</div>`;
    return;
  }

  const units = sel.filter(e => UNITS[e.k]);
  const bld = sel.find(e => BUILDINGS[e.k]);

  if (units.length) {
    const counts = {};
    for (const u of units) counts[u.k] = (counts[u.k] || 0) + 1;
    const label = Object.entries(counts).map(([k, n]) => `${n}× ${UNITS[k].name}`).join(', ');
    info.innerHTML = `<div class="sel-name">${units.length === 1 ? UNITS[units[0].k].name : units.length + ' units'}</div><div class="sel-sub">${label}</div>`;
    if (units.some(u => u.k === 'builder')) {
      if (!L.buildOpen) {
        // one Build button — the full menu only opens when asked
        const open = mkBtn('🔨', 'Build', '', () => {
          L.buildOpen = true;
          refreshPanels();
          if (L.usesPad) gpFocusFirstPanel(L);
        });
        bar.appendChild(open);
      } else {
        for (const bk of BUILD_MENU) {
          const spec = BUILDINGS[bk];
          const btn = mkBtn(ICONS[bk], spec.name, `$${spec.cost}`, () => {
            if (moneyOf(L.slot) < spec.cost) { toast(`Need $${spec.cost} for a ${spec.name}`); return; }
            L.placing = bk;
            refreshPanels();
          });
          if (money < spec.cost) btn.disabled = true;
          bar.appendChild(btn);
        }
        const back = mkBtn('◀', 'Back', '', () => { L.buildOpen = false; refreshPanels(); });
        back.classList.add('cancel');
        bar.appendChild(back);
      }
    }
    return;
  }

  if (bld) {
    const spec = BUILDINGS[bld.k];
    info.innerHTML = `<div class="sel-name">${ICONS[bld.k] || ''} ${spec.name}</div>
      <div class="sel-sub">${bld.d ? `HP ${bld.h}/${spec.hp}` : 'Under construction — keep a builder next to it'}</div>`;
    if (bld.d && spec.trains) {
      for (const uk of spec.trains) {
        const u = UNITS[uk];
        const btn = mkBtn(ICONS[uk], u.name, `$${u.cost}`, () => {
          cmd(L, { kind: 'train', building: bld.i, unit: uk });
        });
        if (money < u.cost) btn.disabled = true;
        bar.appendChild(btn);
      }
      if (bld.q) {
        const pips = document.createElement('div');
        pips.className = 'queue-pips';
        for (let i = 0; i < bld.q; i++) {
          const pip = document.createElement('div');
          pip.className = 'pip';
          pip.textContent = i === 0 ? (ICONS[bld.u] || '·') : '·';
          if (i === 0) {
            const fill = document.createElement('div');
            fill.className = 'fill';
            fill.style.height = `${Math.round((bld.p || 0) * 100)}%`;
            pip.appendChild(fill);
          }
          pips.appendChild(pip);
        }
        bar.appendChild(pips);
      }
    }
    if (bld.k === 'windmill' && bld.d) {
      info.querySelector('.sel-sub').textContent = 'Earning money — more when next to a farm';
    }
  }
}

function mkBtn(ico, label, cost, onClick) {
  const b = document.createElement('button');
  b.className = 'act-btn focusable';
  b.innerHTML = `<span class="ico">${ico}</span><span>${label}</span>${cost ? `<span class="cost">${cost}</span>` : ''}`;
  b.addEventListener('click', onClick);
  return b;
}

export function openBuildMenu(L) {
  const sel = selEnts(L);
  if (!sel.some(e => e.k === 'builder')) {
    L.sel.clear();
    for (const e of G.ents.values()) {
      if (e.o === L.slot && e.k === 'builder') { L.sel.add(e.i); break; }
    }
  }
  L.buildOpen = selEnts(L).some(e => e.k === 'builder');
  refreshPanels();
  if (!L.buildOpen) toast('No builder! Select your Castle and train one.');
  else gpFocusFirstPanel(L);
}

// ---------------------------------------------------------------- top HUD

export function refreshTopHud() {
  const wrap = document.getElementById('hud-players');
  wrap.innerHTML = '';
  const showTeams = G.mode === '2v2';
  for (const p of G.players) {
    const chip = document.createElement('div');
    chip.className = 'hp-chip' + (p.dead ? ' dead' : '');
    chip.innerHTML = `<span class="dot" style="background:${COLORS[p.slot]}"></span>${escapeHtml(p.name)}${p.left ? ' (left)' : ''}${showTeams ? `<span class="team-tag">T${(p.team ?? 0) + 1}</span>` : ''}`;
    wrap.appendChild(chip);
  }
}

// ---------------------------------------------------------------- lobby

export function renderLobby() {
  document.getElementById('lobby-code').textContent = G.code || '----';
  const modeInfo = MODES[G.mode] || MODES.ffa;
  document.getElementById('lobby-mode').textContent = `${modeInfo.name} — ${modeInfo.desc}`;
  const list = document.getElementById('lobby-players');
  list.innerHTML = '';
  const maxSlots = modeInfo.maxSlots;
  const showTeams = G.mode === '2v2';

  for (let s = 0; s < maxSlots; s++) {
    if (showTeams && (s === 0 || s === 2)) {
      const head = document.createElement('div');
      head.className = 'team-head';
      head.textContent = s === 0 ? '🛡 TEAM WEST' : '⚔ TEAM EAST';
      list.appendChild(head);
    }
    const p = G.players.find(p => p.slot === s);
    const row = document.createElement('div');
    row.className = 'lobby-row';
    if (p) {
      const skinName = SKINS[p.skin] ? SKINS[p.skin].name : 'Kingdom';
      const mineL = G.local.find(L => L.slot === s);
      row.innerHTML = `<span class="dot" style="background:${COLORS[s]}"></span>
        <b>${escapeHtml(p.name)}</b>
        <span class="tag">${COLOR_NAMES[s]}${p.bot ? ' · BOT' : ''}${p.slot === 0 ? ' · Host' : ''}${mineL ? ' · You' : ''}</span>`;
      if (mineL) {
        const btn = document.createElement('button');
        btn.className = 'skin-btn focusable';
        btn.textContent = `🏰 ${skinName} ⟳`;
        btn.addEventListener('click', () => send({ t: 'skin', lp: mineL.lp }));
        row.appendChild(btn);
      } else {
        const tag = document.createElement('span');
        tag.className = 'skin-tag';
        tag.textContent = `🏰 ${skinName}`;
        row.appendChild(tag);
      }
    } else {
      row.innerHTML = `<span class="dot" style="background:#333"></span><span class="muted">Open slot…</span>`;
      row.style.opacity = 0.5;
    }
    list.appendChild(row);
  }
  const isHost = G.local.some(L => L.slot === 0);
  document.getElementById('btn-add-bot').style.display = isHost && G.mode !== '1v1' ? '' : 'none';
  document.getElementById('btn-start').style.display = isHost ? '' : 'none';
}

function escapeHtml(s) {
  return String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}

// ---------------------------------------------------------------- gamepad focus
// Menu screens: one global focus list. In game: per-panel focus.

export function gpFocusables() {
  const screen = document.querySelector('.screen.active');
  if (!screen || G.screen === 'game') return [];
  return [...screen.querySelectorAll('.focusable:not(:disabled)')].filter(el => el.offsetParent !== null);
}

export function gpMoveFocus(dir) {
  const els = gpFocusables();
  if (!els.length) return;
  document.querySelectorAll('.gp-focus').forEach(el => el.classList.remove('gp-focus'));
  G.focusIdx = ((G.focusIdx + dir) % els.length + els.length) % els.length;
  els[G.focusIdx].classList.add('gp-focus');
  els[G.focusIdx].scrollIntoView({ block: 'nearest' });
}

export function gpFocusFirst() {
  G.focusIdx = -1;
  gpMoveFocus(1);
}

export function gpClickFocused() {
  const els = gpFocusables();
  const el = els[G.focusIdx];
  if (el) el.click();
  else if (els.length) { G.focusIdx = 0; els[0].classList.add('gp-focus'); }
}

function panelFocusables(L) {
  return [...document.querySelectorAll(`.player-panel[data-lp="${L.lp}"] .act-btn:not(:disabled)`)];
}

export function gpMoveFocusPanel(L, dir) {
  const els = panelFocusables(L);
  if (!els.length) return;
  els.forEach(el => el.classList.remove('gp-focus'));
  L.focusIdx = ((L.focusIdx + dir) % els.length + els.length) % els.length;
  els[L.focusIdx].classList.add('gp-focus');
}

export function gpFocusFirstPanel(L) {
  L.focusIdx = -1;
  gpMoveFocusPanel(L, 1);
}

export function gpClickFocusedPanel(L) {
  const els = panelFocusables(L);
  const el = els[L.focusIdx];
  if (el) el.click();
}

export function backAction() {
  const backBtn = document.querySelector('.screen.active .menu-btn.ghost, #screen-help.active #btn-help-back, #screen-over.active #btn-over-back');
  if (backBtn) backBtn.click();
}
