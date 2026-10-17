// Claude Maximizer editor — the layer on top of the running game: note mode, pins, inspector, things, log.
// It only talks to the engine through CM.adapter, so the same layer works for 2D sprites and 3D things.
(function () {
  'use strict';
  const $ = (s, r) => (r || document).querySelector(s), $$ = (s, r) => Array.from((r || document).querySelectorAll(s));
  const esc = s => String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const CHIPS = ['Too fast', 'Too slow', 'Too big', 'Too small', 'Move this', 'Remove this', 'Looks wrong', 'Bug here', 'More of these', 'Change the color'];
  const ICON = n => `<svg><use href="#i-${n}"/></svg>`;

  const E = (window.Editor = { notes: [], noteMode: false, hover: null, selected: null, drag: null, tweaks: new Map(), project: null, tab: 'notes', wasPaused: false, typeHighlight: null, flashNote: null, search: '', errorCount: 0 });
  let A = null, CM = null, overlay, octx, stage, game, domOverlay, hoverChip, popover, toastEl, toastT, pinRects = [];

  E.init = function ({ project, cm }) {
    CM = cm; A = cm.adapter; E.project = project;
    stage = $('#stage'); game = $('#game'); overlay = $('#overlay'); octx = overlay.getContext('2d'); domOverlay = $('#dom-overlay'); popover = $('#popover'); toastEl = $('#toast');
    hoverChip = document.createElement('div'); hoverChip.className = 'chip hover'; hoverChip.hidden = true; domOverlay.appendChild(hoverChip);
    $('#brandMode').textContent = A.mode === '3d' ? '3D' : '2D';
    bindToolbar(); bindPointer(); bindKeys(); bindTabs();
    CM.on('frame', drawOverlay); CM.on('log', onLog); CM.on('error', onError);
    CM.on('scene', () => { E.selected = null; E.tweaks.clear(); if (E.tab === 'inspect') renderInspector(); if (E.tab === 'things') renderThings(); });
    addEventListener('resize', fit); fit(); setTimeout(fit, 50);
    loadNotes(); renderThings(); setHint('Press N or right-click anything to leave a note');
    setInterval(() => { if (E.tab === 'things') renderThings(); if (E.tab === 'inspect') refreshInspectorValues(); updateStatus(); }, 250);
    try { if (localStorage.getItem('cm.panelHidden') === '1') document.body.classList.add('panel-hidden'); } catch {}
  };

  // ---------- layout ----------
  function fit() {
    const wrap = $('#stage-wrap'); const aw = wrap.clientWidth - 40, ah = wrap.clientHeight - 112;
    let w, h;
    if (A.mode === '3d') { w = Math.max(320, aw); h = Math.max(200, ah); if (CM.resize) CM.resize(Math.round(w), Math.round(h)); }
    else { const s = Math.max(1, Math.floor(Math.min(aw / CM.W, ah / CM.H))); w = CM.W * s; h = CM.H * s; }
    stage.style.width = w + 'px'; stage.style.height = h + 'px';
    overlay.width = game.width; overlay.height = game.height;
  }
  const cssScale = () => stage.clientWidth / overlay.width;
  const toLogical = ev => { const r = overlay.getBoundingClientRect(); return { x: (ev.clientX - r.left) / r.width * overlay.width, y: (ev.clientY - r.top) / r.height * overlay.height }; };
  function setHint(t) { const h = $('#hint'); h.textContent = t; h.classList.toggle('show', !!t); }

  // ---------- toolbar + keys ----------
  function bindToolbar() {
    $$('[data-t]').forEach(b => b.onclick = () => action(b.dataset.t));
    $('#project').onchange = e => { location.search = '?p=' + encodeURIComponent(e.target.value); };
    $('#newproj').onclick = async () => { const name = prompt('Name for the new game:'); if (!name) return; const mode = confirm('Make it 3D?\n\nOK = 3D, Cancel = 2D pixel art') ? '3d' : '2d'; const r = await api('POST', '/api/projects', { name, mode }); if (r.error) return toast(r.error, 'err'); location.search = '?p=' + encodeURIComponent(r.id); };
    const sp = $('#speed'); sp.oninput = () => { CM.speed = +sp.value; $('#speedLabel').textContent = CM.speed.toFixed(1) + '×'; };
    $('#helpClose').onclick = () => { $('#help').hidden = true; }; $('#help').onclick = e => { if (e.target === $('#help')) $('#help').hidden = true; };
  }
  function action(t) {
    if (t === 'play') setPaused(!CM.paused);
    else if (t === 'note') setNoteMode(!E.noteMode);
    else if (t === 'step') { if (!CM.paused) setPaused(true); CM.step(); }
    else if (t === 'boxes') { CM.showBoxes = !CM.showBoxes; $('[data-t=boxes]').classList.toggle('on', CM.showBoxes); }
    else if (t === 'restart') { A.restart(); toast('Restarted ' + (A.sceneName() || 'the scene')); }
    else if (t === 'mute') { CM.muted = !CM.muted; const b = $('[data-t=mute]'); b.classList.toggle('on', CM.muted); b.innerHTML = ICON(CM.muted ? 'mute' : 'sound'); }
    else if (t === 'reload') window.App && window.App.reload();
    else if (t === 'noteall') openPopover({ kind: 'global', at: { x: overlay.width / 2 - 160 / cssScale(), y: overlay.height / 3 } });
    else if (t === 'help') { $('#help').hidden = !$('#help').hidden; }
    else if (t === 'panel') { document.body.classList.toggle('panel-hidden'); try { localStorage.setItem('cm.panelHidden', document.body.classList.contains('panel-hidden') ? '1' : '0'); } catch {} setTimeout(fit, 260); }
  }
  function setPaused(p) { CM.paused = p; const b = $('[data-t=play]'); b.innerHTML = ICON(p ? 'play' : 'pause') + `<span>${p ? 'Play' : 'Pause'}</span>`; b.classList.toggle('on', p); }
  function setNoteMode(on) {
    if (on === E.noteMode) return; if (on && E.mode) E.setMode(null);
    E.noteMode = on; stage.classList.toggle('noting', on); $('[data-t=note]').classList.toggle('on', on);
    if (on) { E.wasPaused = CM.paused; setPaused(true); CM.input.enabled = false; setHint('Click anything to note it · drag a box for an area · Esc to leave'); }
    else { CM.input.enabled = true; setPaused(E.wasPaused); E.hover = null; hoverChip.hidden = true; closePopover(); setHint('Press N or right-click anything to leave a note'); }
  }
  function bindKeys() {
    addEventListener('keydown', e => {
      if (e.target && /INPUT|TEXTAREA|SELECT/.test(e.target.tagName)) { if (e.key === 'Escape') { e.target.blur(); closePopover(); } return; }
      const k = e.key.toLowerCase();
      if (k === 'n') { setNoteMode(!E.noteMode); e.preventDefault(); }
      else if (k === 'escape') { if (!$('#help').hidden) $('#help').hidden = true; else if (!popover.hidden) closePopover(); else if (E.noteMode) setNoteMode(false); else if (E.mode) E.setMode(null); }
      else if (k === '?') action('help');
      else if (k === '\\') action('panel');
      else if (e.key === 'F8') action('play');
      else if (E.noteMode || e.altKey || CM.paused) { if (k === '.') action('step'); else if (k === 'b') action('boxes'); else if (k === 'r') action('restart'); else if (k === 'm') action('mute'); else if (k === 'p') action('play'); }
    });
  }
  function bindTabs() { $$('.tabs button').forEach(b => b.onclick = () => showTab(b.dataset.tab)); showTab('notes'); }
  function showTab(t) { E.tab = t; $$('.tabs button').forEach(b => b.classList.toggle('on', b.dataset.tab === t)); $$('.tab').forEach(x => x.hidden = x.id !== 'tab-' + t); if (t === 'things') renderThings(); if (t === 'inspect') renderInspector(); if (t === 'log') renderLog(); if (t === 'notes') renderNotes(); if (E.onTab[t]) E.onTab[t](); }
  E.onTab = {}; E.showTab = showTab;
  // other tools (tools.js) can take over the stage pointer: E.setMode('level', handlers) / E.setMode(null)
  E.mode = null; E.modeHandlers = null;
  E.setMode = function (mode, handlers) { if (E.noteMode) setNoteMode(false); E.mode = mode; E.modeHandlers = handlers || null; stage.classList.toggle('painting', !!mode); if (mode) { E.wasPaused = CM.paused; setPaused(true); CM.input.enabled = false; } else { CM.input.enabled = true; setPaused(E.wasPaused); } };
  E.get = () => ({ A, CM, overlay, stage, octx, toLogical, cssScale, select, setPaused, api, popover });

  // ---------- pointer ----------
  function bindPointer() {
    overlay.addEventListener('pointermove', ev => {
      if (E.mode && E.modeHandlers) return E.modeHandlers.move && E.modeHandlers.move(toLogical(ev), ev);
      if (!E.noteMode) return; const p = toLogical(ev);
      if (E.drag) { E.drag.x1 = p.x; E.drag.y1 = p.y; return; }
      const it = A.pick(p.x, p.y); E.hover = it;
      if (it) { const b = A.bounds(it), s = cssScale(); hoverChip.hidden = false; hoverChip.textContent = label(it); hoverChip.style.left = Math.round(b.x * s) + 'px'; hoverChip.style.top = Math.max(0, Math.round(b.y * s) - 26) + 'px'; } else hoverChip.hidden = true;
      overlay.style.cursor = pinAt(p) ? 'pointer' : 'crosshair';
    });
    overlay.addEventListener('pointerdown', ev => { if (E.mode && E.modeHandlers) { overlay.setPointerCapture(ev.pointerId); return E.modeHandlers.down && E.modeHandlers.down(toLogical(ev), ev); } if (!E.noteMode || ev.button !== 0) return; const p = toLogical(ev); if (pinAt(p)) return; E.drag = { x0: p.x, y0: p.y, x1: p.x, y1: p.y }; overlay.setPointerCapture(ev.pointerId); });
    overlay.addEventListener('pointerup', ev => {
      if (E.mode && E.modeHandlers) return E.modeHandlers.up && E.modeHandlers.up(toLogical(ev), ev);
      if (!E.noteMode || ev.button !== 0) return; const p = toLogical(ev);
      const pin = pinAt(p); if (pin && !E.drag) { showNote(pin.id); showTab('notes'); return; }
      if (!E.drag) return; const d = E.drag; E.drag = null;
      const dx = Math.abs(d.x1 - d.x0), dy = Math.abs(d.y1 - d.y0);
      if (dx < 4 && dy < 4) noteAtPoint(p);
      else { const x = Math.min(d.x0, d.x1), y = Math.min(d.y0, d.y1), w = dx, h = dy; openPopover({ kind: 'area', at: { x: x + w, y }, rect: { x, y, w, h }, items: A.itemsIn(x, y, w, h) }); }
    });
    overlay.addEventListener('dblclick', ev => { if (E.noteMode) return; const p = toLogical(ev); const it = A.pick(p.x, p.y); if (it) { select(it); showTab('inspect'); } });
    // right-click anything while playing: straight to a note, no mode switch needed
    stage.addEventListener('contextmenu', ev => { ev.preventDefault(); if (E.mode) return; if (!E.noteMode) setNoteMode(true); noteAtPoint(toLogical(ev)); });
    game.addEventListener('dblclick', ev => { const p = toLogical(ev); const it = A.pick(p.x, p.y); if (it) { select(it); showTab('inspect'); } });
  }
  function noteAtPoint(p) { const it = A.pick(p.x, p.y); if (it) { select(it); openPopover({ kind: 'entity', item: it, at: p }); } else openPopover({ kind: 'spot', at: p, spot: A.spot(p.x, p.y) }); }
  function pinAt(p) { return pinRects.find(r => p.x >= r.x && p.x <= r.x + r.w && p.y >= r.y && p.y <= r.y + r.h) || null; }
  function label(it) { return (it.name ? it.name + ' · ' : '') + it.id; }
  function select(it) { E.selected = it; E.tweaks.clear(); if (E.tab === 'inspect') renderInspector(); }

  // ---------- overlay drawing (every frame) ----------
  function drawOverlay() {
    const c = octx; c.clearRect(0, 0, overlay.width, overlay.height); c.lineWidth = 1; pinRects = [];
    if (E.mode && E.modeHandlers && E.modeHandlers.draw) { E.modeHandlers.draw(c); return; }
    for (const n of E.notes) {
      if (n.status !== 'open') continue; let pos = null;
      if (n.target && n.target.id) { const it = A.byId(n.target.id); if (it) { const b = A.bounds(it); pos = { x: b.x + b.w, y: b.y }; } }
      else if (n.spot) pos = A.spotToScreen(n.spot);
      else if (n.rect) { const p = n.rect.space === 'screen' ? { x: n.rect.x, y: n.rect.y } : A.spotToScreen({ x: n.rect.x, y: n.rect.y, z: n.rect.z, space: 'world' }); pos = { x: p.x + n.rect.w, y: p.y }; }
      if (!pos || pos.x < -20 || pos.y < -20 || pos.x > overlay.width + 20 || pos.y > overlay.height + 20) continue;
      drawPin(c, pos.x, pos.y, n);
    }
    if (E.typeHighlight) { c.strokeStyle = 'rgba(255,216,77,.9)'; for (const it of A.list()) if (it.type === E.typeHighlight) { const b = A.bounds(it); c.strokeRect(b.x - 1.5, b.y - 1.5, b.w + 3, b.h + 3); } }
    if (E.selected && E.selected.alive !== false && A.byId(E.selected.id) === E.selected) { const b = A.bounds(E.selected); c.strokeStyle = '#5ea2ff'; c.lineWidth = 2; c.strokeRect(b.x - 2, b.y - 2, b.w + 4, b.h + 4); c.lineWidth = 1; }
    if (E.noteMode) {
      if (E.hover) { const b = A.bounds(E.hover); c.strokeStyle = '#ffd84d'; c.setLineDash([3, 2]); c.strokeRect(b.x - 1.5, b.y - 1.5, b.w + 3, b.h + 3); c.setLineDash([]); }
      if (E.drag) { const d = E.drag; c.fillStyle = 'rgba(255,216,77,.16)'; c.strokeStyle = '#ffd84d'; const x = Math.min(d.x0, d.x1), y = Math.min(d.y0, d.y1); c.fillRect(x, y, Math.abs(d.x1 - d.x0), Math.abs(d.y1 - d.y0)); c.strokeRect(x + 0.5, y + 0.5, Math.abs(d.x1 - d.x0), Math.abs(d.y1 - d.y0)); }
    }
  }
  function drawPin(c, x, y, n) {
    const big = overlay.width > 600, w = big ? 20 : 10, h = big ? 16 : 8, hot = n.id === E.flashNote; x = Math.round(x) - w + 2; y = Math.round(y) - 3;
    c.fillStyle = hot ? '#fff1a8' : '#ffd84d'; c.beginPath(); c.roundRect(x, y, w, h, big ? 5 : 2); c.fill();
    c.fillStyle = '#2b2300'; c.font = `700 ${big ? 11 : 6}px ${big ? 'Inter, sans-serif' : 'monospace'}`; c.textBaseline = 'middle'; c.textAlign = 'center'; c.fillText(String(n.id), x + w / 2, y + h / 2 + (big ? 0.5 : 0.5));
    pinRects.push({ x, y, w, h, id: n.id });
  }

  // ---------- popover (write a note) ----------
  let draft = null;
  function openPopover(d) {
    draft = d; const s = cssScale(); const x = Math.min(stage.clientWidth - 330, Math.max(4, d.at.x * s + 10)), y = Math.min(stage.clientHeight - 230, Math.max(4, d.at.y * s + 10));
    let about;
    if (d.kind === 'entity') { const it = d.item; about = `<b>${esc(label(it))}</b> <span class="src">${esc(it.src || A.typeSrc(it.type) || '')}</span>`; }
    else if (d.kind === 'spot') about = `This spot${d.spot.tile ? ` · tile ${d.spot.tile.tx},${d.spot.tile.ty}${d.spot.tile.ch ? ' "' + esc(d.spot.tile.ch) + '"' : ''}` : ''} · ${Math.round(d.spot.x)}, ${Math.round(d.spot.y)}${d.spot.z != null ? ', ' + Math.round(d.spot.z) : ''}`;
    else if (d.kind === 'area') about = `This area · <b>${d.items.length} thing${d.items.length === 1 ? '' : 's'}</b> inside${d.items.length ? ': ' + esc(d.items.slice(0, 6).map(label).join(', ')) + (d.items.length > 6 ? '…' : '') : ''}`;
    else if (d.kind === 'global') about = `The whole game · scene <b>${esc(A.sceneName() || '')}</b>`;
    else if (d.kind === 'tweak') about = `Tweaks on <b>${esc(label(d.item))}</b>`;
    else if (d.kind === 'bug') about = `Crash: <b>${esc(d.error.text)}</b>`;
    popover.innerHTML = `<div class="pop-about">${about}</div>
      <textarea id="noteText" rows="3" placeholder="${d.kind === 'tweak' ? 'Anything else about this change?' : 'What should change?'}">${esc(d.text || '')}</textarea>
      <div class="chips">${CHIPS.map(c => `<button type="button" class="chip" data-chip="${esc(c)}">${esc(c)}</button>`).join('')}</div>
      ${d.kind === 'entity' ? `<label class="check"><input type="checkbox" id="noteAll"> Applies to every <b>${esc(d.item.type)}</b></label>` : ''}
      <div class="pop-actions"><span class="muted">Enter saves · Esc cancels</span><button type="button" class="btn ghost" id="noteCancel">Cancel</button><button type="button" class="btn primary" id="noteSave">Save note</button></div>`;
    popover.style.left = x + 'px'; popover.style.top = y + 'px'; popover.hidden = false;
    const ta = $('#noteText', popover); setTimeout(() => ta.focus(), 30);
    $$('[data-chip]', popover).forEach(b => b.onclick = () => { ta.value = (ta.value ? ta.value.replace(/\s*$/, '') + '. ' : '') + b.dataset.chip; ta.focus(); });
    ta.onkeydown = e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); saveDraft(); } };
    $('#noteSave', popover).onclick = saveDraft; $('#noteCancel', popover).onclick = closePopover;
  }
  function closePopover() { popover.hidden = true; draft = null; }
  async function saveDraft() {
    if (!draft) return; const text = $('#noteText', popover).value.trim(); if (!text && draft.kind !== 'tweak') return toast('Write what should change first', 'err');
    const d = draft; const note = { kind: d.kind, text, scene: A.sceneName(), time: Math.round((CM.current ? CM.current.time : 0) * 10) / 10, context: A.snapshot() };
    try {
      if (d.kind === 'entity' || d.kind === 'tweak') { note.target = A.summary(d.item); note.allOfType = d.kind === 'entity' ? !!$('#noteAll', popover).checked : true; note.image = A.crop(d.item); }
      if (d.kind === 'spot') { note.spot = d.spot; note.image = A.cropRect(d.at.x - 30, d.at.y - 30, 60, 60); }
      if (d.kind === 'area') { const r = d.rect; const sp = A.spot(r.x, r.y); note.rect = { x: sp.x, y: sp.y, z: sp.z, w: Math.round(r.w), h: Math.round(r.h), space: sp.space || 'world' }; note.items = d.items.map(A.summary); note.image = A.cropRect(r.x, r.y, r.w, r.h); }
      if (d.kind === 'tweak') note.tweaks = d.tweaks;
      if (d.kind === 'bug') note.error = d.error;
      if (d.kind === 'global') note.image = A.cropRect(0, 0, overlay.width, overlay.height);
    } catch (e) { console.warn('capture', e); }
    closePopover();
    const r = await api('POST', '/api/notes', { project: E.project.id, note });
    if (r.error) return toast(r.error, 'err');
    E.notes.push(r.note); renderNotes(); flash(r.note.id);
    if (d.kind === 'tweak') { E.tweaks.clear(); renderInspector(); }
    toast(`Note ${r.note.id} saved · Claude reads it from NOTES.md`, 'good');
  }
  function flash(id) { E.flashNote = id; $$('.note').forEach(n => n.classList.toggle('hot', +n.dataset.note === id)); setTimeout(() => { if (E.flashNote === id) { E.flashNote = null; $$('.note.hot').forEach(n => n.classList.remove('hot')); } }, 1800); }

  // ---------- notes list ----------
  async function loadNotes() {
    const r = await api('GET', '/api/notes?project=' + encodeURIComponent(E.project.id)); const fresh = r.notes || [];
    // did Claude reply or close something since last time? say so
    for (const n of fresh) { const old = E.notes.find(o => o.id === n.id); if (old && n.reply && n.reply !== old.reply) toast(`Claude on note ${n.id}: ${n.reply}`, 'good', 5000); else if (old && old.status === 'open' && n.status === 'done' && !n.reply) toast(`Note ${n.id} is done`, 'good'); }
    E.notes = fresh; renderNotes();
  }
  E.loadNotes = loadNotes;
  function renderNotes() {
    const open = E.notes.filter(n => n.status === 'open'), done = E.notes.filter(n => n.status !== 'open');
    $('#noteCount').textContent = open.length || '';
    const row = n => `<div class="note ${n.status} ${n.id === E.flashNote ? 'hot' : ''}" data-note="${n.id}">
      <div class="note-head"><span class="pin">${n.id}</span><span class="note-about">${esc(noteAbout(n))}</span><span class="when">${ago(n.created)}</span></div>
      <div class="note-body"><div class="note-text">${esc(n.text) || '<span class="muted">tweaks only</span>'}${n.target && n.target.src ? `<div class="note-src">${esc(n.target.src)}</div>` : ''}</div>${n.image ? `<img class="note-thumb" alt="" src="/p/${esc(E.project.id)}/${esc(n.image)}?t=${n.created}">` : ''}</div>
      ${n.tweaks && n.tweaks.length ? `<div class="note-tweaks">${n.tweaks.map(t => `<code>${esc(t.key)} ${esc(fmtVal(t.from))} → ${esc(fmtVal(t.to))}${t.all ? ' · all' : ''}</code>`).join('')}</div>` : ''}
      ${n.reply ? `<div class="note-reply"><b>Claude</b> · ${esc(n.reply)}</div>` : ''}
      <div class="note-actions">${(n.target && n.target.id) || n.spot || n.rect ? `<button type="button" data-go="${n.id}">${ICON('eye')}Show</button>` : ''}${n.status === 'open' ? `<button type="button" data-done="${n.id}">${ICON('check')}Done</button>` : `<button type="button" data-reopen="${n.id}">Reopen</button>`}<button type="button" data-del="${n.id}" class="danger">${ICON('trash')}</button></div></div>`;
    $('#tab-notes').innerHTML = `<div class="tab-head"><span>${open.length ? `${open.length} open` : 'Nothing open'}</span><span class="grow"></span><button type="button" class="mini" id="copyNotes" title="Copy every open note as text">${ICON('copy')} Copy for Claude</button></div>
      ${open.length ? open.slice().reverse().map(row).join('') : `<div class="empty"><b>No notes yet</b>Press <kbd>N</kbd> and click anything in the game, or right-click it while playing. Claude reads notes from <code>projects/${esc(E.project.id)}/NOTES.md</code>.</div>`}
      ${done.length ? `<details class="done-list"><summary>${done.length} done</summary>${done.slice().reverse().map(row).join('')}</details>` : ''}`;
    $$('[data-go]', $('#tab-notes')).forEach(b => b.onclick = () => showNote(+b.dataset.go));
    $$('[data-done]', $('#tab-notes')).forEach(b => b.onclick = () => patchNote(+b.dataset.done, { status: 'done' }));
    $$('[data-reopen]', $('#tab-notes')).forEach(b => b.onclick = () => patchNote(+b.dataset.reopen, { status: 'open' }));
    $$('[data-del]', $('#tab-notes')).forEach(b => b.onclick = async () => { await api('DELETE', `/api/notes/${b.dataset.del}?project=${encodeURIComponent(E.project.id)}`); E.notes = E.notes.filter(n => n.id !== +b.dataset.del); renderNotes(); toast('Note deleted'); });
    $('#copyNotes').onclick = async () => { try { const md = await (await fetch(`/p/${E.project.id}/NOTES.md?t=${Date.now()}`)).text(); await navigator.clipboard.writeText(md); toast('Copied the notes as text', 'good'); } catch { toast('Could not copy', 'err'); } };
  }
  function noteAbout(n) { if (n.kind === 'global') return 'Whole game'; if (n.kind === 'bug') return 'Crash'; if (n.target) return (n.target.name ? n.target.name + ' · ' : '') + n.target.id + (n.allOfType ? ' · every ' + n.target.type : ''); if (n.rect) return `Area · ${(n.items || []).length} things`; if (n.spot) return `Spot ${n.spot.x}, ${n.spot.y}${n.spot.z != null ? ', ' + n.spot.z : ''}`; return n.kind; }
  async function patchNote(id, changes) { const r = await api('PATCH', `/api/notes/${id}`, { project: E.project.id, ...changes }); if (r.note) { E.notes = E.notes.map(n => n.id === id ? r.note : n); renderNotes(); } }
  function showNote(id) {
    const n = E.notes.find(x => x.id === id); if (!n) return; flash(id);
    if (n.target && n.target.id) { const it = A.byId(n.target.id); if (it) { select(it); showTab('inspect'); return; } toast(`${n.target.id} isn't in the scene right now`); return; }
    toast('The pin shows where this note points');
  }

  // ---------- inspector ----------
  function renderInspector() {
    const it = E.selected, box = $('#tab-inspect');
    if (!it || it.alive === false) { box.innerHTML = `<div class="empty"><b>Nothing selected</b>Double-click a thing while playing, click one in note mode, or pick it from Things.</div>`; return; }
    const props = A.props(it), crop = safeCrop(it);
    box.innerHTML = `<div class="insp-head"><div><b>${esc(label(it))}</b><div class="src">${esc(it.src || A.typeSrc(it.type) || '')}</div><div class="insp-actions" style="margin-top:8px"><button type="button" class="btn" id="inspNote">${ICON('pen')}Note</button><button type="button" class="btn" id="inspFollow" title="Keep the camera on it">${ICON('target')}Follow</button></div></div>${crop ? `<img class="insp-img" alt="" src="${crop}">` : ''}</div>
      <label class="check"><input type="checkbox" id="inspAll"> Change every <b>${esc(it.type)}</b>, not just this one</label>
      <div class="props-title">Its numbers<span class="grow"></span>${E.tweaks.size ? `<button type="button" class="mini" id="inspReset">Reset ${E.tweaks.size}</button>` : ''}</div>
      <div class="props">${props.filter(p => !p.builtin).map(propRow).join('')}</div>
      <div class="props-title">Engine fields</div>
      <div class="props">${props.filter(p => p.builtin).map(propRow).join('')}</div>
      <div class="insp-actions"><button type="button" class="btn primary" id="inspSave" ${E.tweaks.size ? '' : 'disabled'}>Save ${E.tweaks.size || ''} tweak${E.tweaks.size === 1 ? '' : 's'} as a note</button></div>
      <p class="muted small">Tweaks change the running game right now. Saving them as a note tells Claude to make them permanent.</p>`;
    $$('[data-prop]', box).forEach(inp => {
      inp.onchange = () => { const key = inp.dataset.prop, before = parseVal(inp.dataset.before, inp.dataset.type), val = inp.type === 'checkbox' ? inp.checked : parseVal(inp.value, inp.dataset.type); const all = $('#inspAll', box).checked; A.setProp(it, key, val, all); const t = E.tweaks.get(key) || { key, from: before, all }; t.to = val; t.all = all || t.all; E.tweaks.set(key, t); if (val === t.from) E.tweaks.delete(key); inp.closest('.prop').classList.toggle('tweaked', E.tweaks.has(key)); const sv = $('#inspSave', box); sv.disabled = !E.tweaks.size; sv.textContent = `Save ${E.tweaks.size || ''} tweak${E.tweaks.size === 1 ? '' : 's'} as a note`; };
      inp.onfocus = () => { inp.dataset.focus = '1'; }; inp.onblur = () => { delete inp.dataset.focus; };
    });
    $('#inspNote', box).onclick = () => openPopover({ kind: 'entity', item: it, at: centerOf(it) });
    $('#inspFollow', box).onclick = () => { if (A.follow) { A.follow(it); toast('Camera follows ' + label(it)); } };
    const rs = $('#inspReset', box); if (rs) rs.onclick = () => { for (const t of E.tweaks.values()) A.setProp(it, t.key, t.from, t.all); E.tweaks.clear(); renderInspector(); toast('Tweaks reset'); };
    $('#inspSave', box).onclick = () => openPopover({ kind: 'tweak', item: it, at: centerOf(it), tweaks: [...E.tweaks.values()].map(t => ({ ...t, type: it.type, id: it.id })), text: [...E.tweaks.values()].map(t => `${t.key} ${fmtVal(t.from)} → ${fmtVal(t.to)}${t.all ? ' for every ' + it.type : ''}`).join(', ') });
  }
  function safeCrop(it) { try { return A.crop(it); } catch { return null; } }
  function centerOf(it) { const b = A.bounds(it); return { x: b.x + b.w, y: b.y }; }
  function propRow(p) {
    const v = p.value, t = typeof v === 'boolean' ? 'bool' : typeof v === 'number' ? 'num' : (typeof v === 'string' && /^#[0-9a-f]{3,8}$/i.test(v)) ? 'color' : (v == null || typeof v === 'object') ? 'ro' : 'str';
    const inp = t === 'bool' ? `<input type="checkbox" data-prop="${esc(p.key)}" data-type="bool" data-before="${v}" ${v ? 'checked' : ''}>` : t === 'num' ? `<input type="number" step="${Number.isInteger(v) ? 1 : 0.1}" data-prop="${esc(p.key)}" data-type="num" data-before="${v}" value="${Math.round(v * 100) / 100}">` : t === 'color' ? `<input type="color" data-prop="${esc(p.key)}" data-type="str" data-before="${esc(v)}" value="${esc(v.length === 4 ? '#' + v[1] + v[1] + v[2] + v[2] + v[3] + v[3] : v.slice(0, 7))}">` : t === 'str' ? `<input type="text" data-prop="${esc(p.key)}" data-type="str" data-before="${esc(v)}" value="${esc(v)}">` : `<span class="ro">${esc(v == null ? '–' : JSON.stringify(v))}</span>`;
    return `<label class="prop ${p.builtin ? 'builtin' : 'own'} ${E.tweaks.has(p.key) ? 'tweaked' : ''}"><span class="key">${esc(p.key)}</span>${inp}</label>`;
  }
  const parseVal = (s, t) => t === 'num' ? (s === '' ? 0 : +s) : t === 'bool' ? s === 'true' : s;
  const fmtVal = v => typeof v === 'number' ? (Math.round(v * 100) / 100) : String(v);
  function refreshInspectorValues() {
    const it = E.selected; if (!it) return; if (it.alive === false || A.byId(it.id) !== it) { if ($('#tab-inspect .insp-head')) renderInspector(); return; }
    const vals = {}; for (const p of A.props(it)) vals[p.key] = p.value;
    $$('[data-prop]', $('#tab-inspect')).forEach(inp => { if (inp.dataset.focus || E.tweaks.has(inp.dataset.prop)) return; const v = vals[inp.dataset.prop]; if (inp.type === 'checkbox') inp.checked = !!v; else if (inp.type === 'number') { if (typeof v === 'number' && Math.abs(+inp.value - v) > 0.05) inp.value = Math.round(v * 10) / 10; } });
  }

  // ---------- things ----------
  function renderThings() {
    const box = $('#tab-things'); const q = E.search.toLowerCase(); const list = A.list().filter(it => !q || it.type.includes(q) || it.id.toLowerCase().includes(q) || (it.name || '').toLowerCase().includes(q)); const groups = {};
    for (const it of list) (groups[it.type] ||= []).push(it);
    const defs = A.defs(); const active = document.activeElement && document.activeElement.id === 'thingSearch';
    const openState = {}; $$('details.type', box).forEach(d => { openState[d.dataset.type] = d.open; });
    box.innerHTML = `<div class="search">${ICON('search')}<input id="thingSearch" placeholder="Find a thing…" value="${esc(E.search)}"></div>
      ${Object.keys(groups).length ? Object.entries(groups).sort((a, b) => b[1].length - a[1].length).map(([type, items]) => `<details class="type" data-type="${esc(type)}" ${openState[type] === false ? '' : 'open'}><summary><b>${esc(type)}</b><span class="count">${items.length}</span><span class="src">${esc(A.typeSrc(type) || '')}</span><button type="button" class="mini" data-tnote="${esc(type)}">Note all</button></summary>
      <div class="items">${items.slice(0, 80).map(it => `<button type="button" class="item ${E.selected === it ? 'on' : ''}" data-sel="${esc(it.id)}">${esc(label(it))}<span class="pos">${esc(posOf(it))}</span>${it.error ? '<span class="err">!</span>' : ''}</button>`).join('')}${items.length > 80 ? `<div class="muted small">…and ${items.length - 80} more</div>` : ''}</div></details>`).join('') : `<div class="empty"><b>${q ? 'No match' : 'Nothing in the scene'}</b>${q ? 'Try another name.' : 'Spawn something in the scene’s setup.'}</div>`}
      ${defs.filter(d => !groups[d.type]).length && !q ? `<div class="muted small" style="margin-top:10px;padding:0 8px">Defined but not in this scene: ${defs.filter(d => !groups[d.type]).map(d => esc(d.type)).join(', ')}</div>` : ''}`;
    const si = $('#thingSearch', box); si.oninput = () => { E.search = si.value; renderThings(); }; if (active) { si.focus(); si.setSelectionRange(si.value.length, si.value.length); }
    $$('[data-sel]', box).forEach(b => { b.onclick = () => { const it = A.byId(b.dataset.sel); if (it) { select(it); showTab('inspect'); } }; b.onmouseenter = () => { E.hover = A.byId(b.dataset.sel); }; b.onmouseleave = () => { E.hover = null; }; });
    $$('[data-tnote]', box).forEach(b => { b.onclick = e => { e.preventDefault(); const it = groups[b.dataset.tnote][0]; openPopover({ kind: 'entity', item: it, at: centerOf(it) }); setTimeout(() => { const c = $('#noteAll', popover); if (c) c.checked = true; }, 0); }; });
    $$('details.type > summary', box).forEach(s => { s.onmouseenter = () => { E.typeHighlight = s.parentElement.dataset.type; }; s.onmouseleave = () => { E.typeHighlight = null; }; });
  }
  const posOf = it => it.z != null ? `${Math.round(it.x)}, ${Math.round(it.y)}, ${Math.round(it.z)}` : `${Math.round(it.x)}, ${Math.round(it.y)}`;

  // ---------- log ----------
  function onLog() { if (E.tab === 'log') renderLog(); }
  function onError(entry) { E.errorCount++; const b = $('#logCount'); b.textContent = E.errorCount; b.className = 'err'; toast('Error: ' + entry.text, 'err'); if (E.tab === 'log') renderLog(); }
  function renderLog() {
    const box = $('#tab-log'); const logs = CM.logs.slice(-100).reverse();
    box.innerHTML = `<div class="tab-head"><span>Scripts write here with CM.log(…)</span><span class="grow"></span><button type="button" class="mini" id="logClear">Clear</button></div>` + (logs.length ? logs.map((l, i) => `<div class="logline ${l.level}"><span class="t">${l.t.toFixed(1)}</span><span class="txt">${esc(l.text)}</span>${l.level === 'error' ? `<button type="button" class="mini" data-bug="${i}">Note this crash</button>` : ''}</div>`).join('') : '<div class="empty"><b>Nothing logged yet</b></div>');
    $('#logClear', box).onclick = () => { CM.logs.length = 0; E.errorCount = 0; $('#logCount').textContent = ''; renderLog(); };
    $$('[data-bug]', box).forEach(b => b.onclick = () => { const l = logs[+b.dataset.bug]; openPopover({ kind: 'bug', at: { x: overlay.width / 2 - 160 / cssScale(), y: 30 }, error: { text: l.text, stack: l.stack, entity: l.entity, where: l.where }, text: 'This crashed: ' + l.text }); });
  }

  // ---------- status + toast + api ----------
  function updateStatus() {
    const s = CM.current; $('#fpsPill').textContent = CM.fps + ' fps';
    $('#status').innerHTML = `<span>scene <b>${esc(A.sceneName() || '–')}</b></span><span>${s ? s.time.toFixed(1) : '0.0'} s</span><span>${A.list().length} things</span>${CM.speed !== 1 ? `<span>${CM.speed.toFixed(1)}× speed</span>` : ''}${CM.paused ? '<span class="paused">paused</span>' : ''}<span class="grow"></span><span>${E.watchText || ''}</span>`;
  }
  E.setWatch = (t, ok) => { E.watchText = t; $('#liveText').textContent = t; $('#dot').className = ok ? 'ok' : 'bad'; };
  function toast(msg, kind, ms) { toastEl.textContent = msg; toastEl.className = 'show ' + (kind || ''); clearTimeout(toastT); toastT = setTimeout(() => { toastEl.className = ''; }, ms || (kind === 'err' ? 4000 : 2200)); }
  E.toast = toast;
  async function api(method, url, body) { try { const r = await fetch(url, { method, headers: { 'Content-Type': 'application/json' }, body: body ? JSON.stringify(body) : undefined }); return await r.json(); } catch (e) { return { error: 'Server not reachable: ' + e.message }; } }
  const ago = t => { const d = (Date.now() - t) / 1000; return d < 60 ? 'now' : d < 3600 ? Math.round(d / 60) + 'm' : d < 86400 ? Math.round(d / 3600) + 'h' : Math.round(d / 86400) + 'd'; };
})();
