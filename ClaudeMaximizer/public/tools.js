// Built-in tools: the Claude tab (runs Claude Code on the game), the Art editor (sprites + voxel models, saved
// straight into the code), the Level painter (paints tiles into the scene file) and the Sounds tool.
(function () {
  'use strict';
  const E = window.Editor;
  const $ = (s, r) => (r || document).querySelector(s), $$ = (s, r) => Array.from((r || document).querySelectorAll(s));
  const esc = s => String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const ICON = n => `<svg><use href="#i-${n}"/></svg>`;
  const pid = () => E.project.id;
  const api = (m, u, b) => E.get().api(m, u, b);

  // =====================================================================================================
  // Claude tab
  // =====================================================================================================
  const C = { feed: [], running: false, resume: true, loaded: false };
  E.onTab.claude = renderClaude;
  E.onClaude = ev => { C.feed.push(ev); if (C.feed.length > 300) C.feed.shift(); if (ev.type === 'start') { C.running = true; } if (ev.type === 'end') { C.running = false; E.loadNotes(); } setClaudeDot(); if (E.tab === 'claude') { appendFeed(ev); renderClaudeHead(); } };
  function setClaudeDot() { const d = $('#claudeDot'); d.textContent = C.running ? '…' : ''; d.className = C.running ? 'working' : ''; }
  async function renderClaude() {
    const box = $('#tab-claude');
    if (!C.loaded) { C.loaded = true; const st = await api('GET', '/api/claude/status?project=' + pid()); C.running = !!st.running; if (st.log && st.log.length && !C.feed.length) C.feed = st.log; C.hasSession = !!st.session; }
    box.innerHTML = `<div class="claude-head" id="claudeHead"></div>
      <div class="claude-feed" id="claudeFeed">${C.feed.length ? '' : `<div class="empty"><b>Claude works right here</b>Leave notes while you play, then press “Fix my notes”. Or just ask for anything: a boss, a new level, better art. Claude edits the game and it reloads in front of you.</div>`}</div>
      <form class="claude-ask" id="claudeAsk"><textarea id="claudeText" rows="2" placeholder="Ask Claude to build or change anything…"></textarea>
        <div class="claude-ask-row"><label class="check" style="margin:0"><input type="checkbox" id="claudeResume" ${C.resume ? 'checked' : ''}> Same conversation</label><span class="grow"></span><button type="button" class="btn ghost small" id="claudeNew" title="Start fresh next time">New chat</button><button type="submit" class="btn primary">${ICON('spark')}Send</button></div></form>`;
    renderClaudeHead(); for (const ev of C.feed) appendFeed(ev, true); scrollFeed();
    $('#claudeAsk').onsubmit = e => { e.preventDefault(); const t = $('#claudeText').value.trim(); if (!t) return; run('ask', t); $('#claudeText').value = ''; };
    $('#claudeText').onkeydown = e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); $('#claudeAsk').requestSubmit(); } };
    $('#claudeResume').onchange = e => { C.resume = e.target.checked; };
    $('#claudeNew').onclick = async () => { await api('POST', '/api/claude/forget', { project: pid() }); C.feed = []; C.hasSession = false; renderClaude(); E.toast('Next message starts a new conversation'); };
  }
  function renderClaudeHead() {
    const open = E.notes.filter(n => n.status === 'open').length, h = $('#claudeHead'); if (!h) return;
    h.innerHTML = `<span class="pill ${C.running ? 'working' : ''}">${C.running ? 'working…' : 'idle'}</span><span class="grow"></span>
      ${C.running ? `<button type="button" class="btn" id="claudeStop">${ICON('stop')}Stop</button>` : `<button type="button" class="btn primary" id="claudeFix" ${open ? '' : 'disabled'}>${ICON('spark')}Fix my ${open || ''} note${open === 1 ? '' : 's'}</button>`}`;
    const f = $('#claudeFix'); if (f) f.onclick = () => run('notes', '');
    const st = $('#claudeStop'); if (st) st.onclick = async () => { await api('POST', '/api/claude/stop', { project: pid() }); E.toast('Stopping Claude'); };
  }
  async function run(kind, text) {
    if (C.running) return E.toast('Claude is still working', 'err');
    const r = await api('POST', '/api/claude/run', { project: pid(), kind, text, resume: C.resume });
    if (r.error) return E.toast(r.error, 'err');
    C.running = true; setClaudeDot(); renderClaudeHead(); if (!C.feed.length) $('#claudeFeed').innerHTML = '';
    if (kind === 'ask') appendFeed({ type: 'you', text });
  }
  function appendFeed(ev, silent) {
    const feed = $('#claudeFeed'); if (!feed) return; const empty = feed.querySelector('.empty'); if (empty) empty.remove();
    let el;
    if (ev.type === 'start') el = `<div class="cf start">${ICON('spark')}<span>${esc(ev.text)}${ev.resumed ? ' <i class="muted">(continuing)</i>' : ''}</span></div>`;
    else if (ev.type === 'you') el = `<div class="cf you"><span>${esc(ev.text)}</span></div>`;
    else if (ev.type === 'text') el = `<div class="cf text">${md(ev.text)}</div>`;
    else if (ev.type === 'tool') el = `<div class="cf tool"><b>${esc(toolVerb(ev.name))}</b><span>${esc(ev.detail)}</span></div>`;
    else if (ev.type === 'result') el = `<div class="cf result ${ev.ok ? '' : 'bad'}">${md(ev.text)}<div class="cf-meta">${ev.turns ? ev.turns + ' steps · ' : ''}${ev.ms ? Math.round(ev.ms / 1000) + ' s' : ''}${ev.cost != null ? ' · $' + ev.cost.toFixed(2) : ''}</div></div>`;
    else if (ev.type === 'error') el = `<div class="cf error">${esc(ev.text)}</div>`;
    else if (ev.type === 'end') el = ev.code ? '' : `<div class="cf end">Done — the game reloaded with the changes.</div>`;
    else return;
    if (!el) return; feed.insertAdjacentHTML('beforeend', el); if (!silent) scrollFeed();
  }
  const scrollFeed = () => { const f = $('#claudeFeed'); if (f) f.scrollTop = f.scrollHeight; };
  const toolVerb = n => ({ Edit: 'Editing', MultiEdit: 'Editing', Write: 'Writing', Read: 'Reading', Bash: 'Running', Glob: 'Finding', Grep: 'Searching' }[n] || n);
  function md(t) { return esc(t).replace(/`([^`]+)`/g, '<code>$1</code>').replace(/\*\*([^*]+)\*\*/g, '<b>$1</b>').replace(/\n{2,}/g, '<br><br>').replace(/\n/g, '<br>'); }

  // =====================================================================================================
  // Tools tab: Art · Level · Sounds
  // =====================================================================================================
  const T = { sub: 'art' };
  E.onTab.tools = renderTools;
  function renderTools() {
    const { A } = E.get(); const box = $('#tab-tools');
    const subs = [['art', A.mode === '3d' ? 'Models' : 'Sprites'], ...(A.mode === '2d' ? [['level', 'Level']] : []), ['sounds', 'Sounds']];
    box.innerHTML = `<div class="seg">${subs.map(([k, l]) => `<button type="button" data-sub="${k}" class="${T.sub === k ? 'on' : ''}">${l}</button>`).join('')}</div><div id="toolBody"></div>`;
    $$('[data-sub]', box).forEach(b => b.onclick = () => { T.sub = b.dataset.sub; renderTools(); });
    if (!subs.some(s => s[0] === T.sub)) T.sub = 'art';
    if (T.sub === 'art') renderArt(); else if (T.sub === 'level') renderLevel(); else renderSounds();
  }

  // ---------------- Art editor (pixels for 2D sprites, voxel layers for 3D models) ----------------
  const ART = { name: null, kind: 'sprite', frames: [], palette: {}, fps: 8, size: 0.2, cur: 0, tool: 'pen', ch: 'Y', dirty: false, drawing: false };
  const FREE_CHARS = '0123456789acefhijklmopqtuvxzACEFHIJQUVXZ'.split('');
  function artList() { const { CM, A } = E.get(); if (A.mode === '3d') return Object.values(CM.defs.models).filter(m => m.voxels).map(m => ({ name: m.name, src: m.src })); return Object.values(CM.defs.sprites).map(s => ({ name: s.name, src: s.src, frames: s.frames.length })); }
  function loadArt(name) {
    const { CM, A } = E.get(); ART.name = name; ART.dirty = false; ART.cur = 0;
    if (A.mode === '3d') { const m = CM.defs.models[name]; ART.kind = 'model'; ART.frames = m.voxels.map(l => (typeof l === 'string' ? l.split('\n') : l).map(r => r)); ART.size = m.size || 0.2; ART.palette = { ...(m.palette || {}) }; }
    else { const s = CM.defs.sprites[name]; ART.kind = 'sprite'; ART.frames = s.frames.map(f => f.map(r => r)); ART.fps = s.fps; ART.palette = {}; for (const [k, v] of Object.entries(s.palette)) if (CM.PALETTE[k] !== v) ART.palette[k] = v; }
    normalize();
  }
  function normalize() { const w = Math.max(1, ...ART.frames.flat().map(r => r.length)); ART.frames = ART.frames.map(f => f.map(r => r.padEnd(w, '.'))); const h = Math.max(...ART.frames.map(f => f.length)); ART.frames = ART.frames.map(f => { while (f.length < h) f.push('.'.repeat(w)); return f; }); }
  const artW = () => ART.frames[0] ? ART.frames[0][0].length : 0, artH = () => ART.frames[0] ? ART.frames[0].length : 0;
  const colorOf = ch => { const { CM } = E.get(); return ART.palette[ch] || CM.PALETTE[ch] || null; };
  function renderArt() {
    const { CM, A } = E.get(); const body = $('#toolBody'); const list = artList(); const is3d = A.mode === '3d';
    if (ART.name && !list.some(x => x.name === ART.name)) ART.name = null;
    if (!ART.name && list.length) loadArt(list[0].name);
    body.innerHTML = `<div class="art-list"><select id="artPick" aria-label="Which one">${list.map(x => `<option value="${esc(x.name)}" ${x.name === ART.name ? 'selected' : ''}>${esc(x.name)}</option>`).join('')}</select><button type="button" class="btn" id="artNew">${ICON('plus')}New</button></div>
      ${ART.name ? `<div class="art-main">
        <div class="art-tools"><button type="button" data-tool="pen" class="${ART.tool === 'pen' ? 'on' : ''}" title="Draw (D)">${ICON('pen')}</button><button type="button" data-tool="erase" class="${ART.tool === 'erase' ? 'on' : ''}" title="Erase (E)">${ICON('trash')}</button><button type="button" data-tool="fill" class="${ART.tool === 'fill' ? 'on' : ''}" title="Fill (F)">${ICON('brush')}</button><button type="button" data-tool="pick" class="${ART.tool === 'pick' ? 'on' : ''}" title="Pick a color (I)">${ICON('target')}</button>
          <span class="sep"></span><label>W <input type="number" id="artW" min="1" max="64" value="${artW()}"></label><label>H <input type="number" id="artH" min="1" max="64" value="${artH()}"></label>${is3d ? `<label>size <input type="number" id="artSize" min="0.05" max="2" step="0.05" value="${ART.size}"></label>` : `<label>fps <input type="number" id="artFps" min="1" max="30" value="${ART.fps}"></label>`}</div>
        <canvas id="artCanvas" class="art-canvas"></canvas>
        <div class="art-palette" id="artPalette"></div>
        <div class="art-frames" id="artFrames"></div>
        <div class="insp-actions"><button type="button" class="btn primary" id="artSave">Save into the code</button><button type="button" class="btn ghost" id="artRevert">Revert</button><span class="src" id="artSrc">${esc((is3d ? CM.defs.models[ART.name] : CM.defs.sprites[ART.name]).src || '')}</span></div>
        <p class="muted small">${is3d ? 'Each layer is one slice from the bottom up; rows go back to front.' : 'Click to draw, drag to keep drawing. Letters are colors from the palette; add your own with +.'}</p>
      </div>` : `<div class="empty"><b>No ${is3d ? 'voxel models' : 'sprites'} yet</b>Press New to draw one.</div>`}`;
    $('#artPick').onchange = e => { if (ART.dirty && !confirm('Throw away unsaved changes?')) { e.target.value = ART.name; return; } loadArt(e.target.value); renderArt(); };
    $('#artNew').onclick = () => { const name = prompt(is3d ? 'Name for the new model:' : 'Name for the new sprite:'); if (!name || !/^[\w-]{1,40}$/.test(name)) return name ? E.toast('Names are letters, numbers, - and _', 'err') : null; ART.name = name; ART.kind = is3d ? 'model' : 'sprite'; ART.frames = [Array.from({ length: 8 }, () => '........')]; ART.palette = {}; ART.fps = 8; ART.cur = 0; ART.dirty = true; renderArt(); $('#artPick').insertAdjacentHTML('afterbegin', `<option value="${esc(name)}" selected>${esc(name)} (new)</option>`); };
    if (!ART.name) return;
    $$('[data-tool]', body).forEach(b => b.onclick = () => { ART.tool = b.dataset.tool; $$('[data-tool]', body).forEach(x => x.classList.toggle('on', x === b)); });
    $('#artW').onchange = e => resizeArt(+e.target.value, artH()); $('#artH').onchange = e => resizeArt(artW(), +e.target.value);
    const fps = $('#artFps'); if (fps) fps.onchange = e => { ART.fps = +e.target.value || 8; ART.dirty = true; };
    const sz = $('#artSize'); if (sz) sz.onchange = e => { ART.size = +e.target.value || 0.2; ART.dirty = true; };
    $('#artSave').onclick = saveArt; $('#artRevert').onclick = () => { if (artList().some(x => x.name === ART.name)) loadArt(ART.name); renderArt(); };
    drawPalette(); drawFrames(); drawArtCanvas(); bindArtCanvas();
  }
  function resizeArt(w, h) { w = Math.max(1, Math.min(64, w)); h = Math.max(1, Math.min(64, h)); ART.frames = ART.frames.map(f => { let g = f.slice(0, h); while (g.length < h) g.push('.'.repeat(w)); return g.map(r => r.slice(0, w).padEnd(w, '.')); }); ART.dirty = true; renderArt(); }
  function drawPalette() {
    const { CM } = E.get(); const box = $('#artPalette'); const chars = [...Object.keys(CM.PALETTE), ...Object.keys(ART.palette)];
    box.innerHTML = chars.map(ch => `<button type="button" class="sw ${ART.ch === ch ? 'on' : ''}" data-ch="${esc(ch)}" style="background:${colorOf(ch)}" title="${esc(ch)} ${colorOf(ch)}"><i>${esc(ch)}</i></button>`).join('') + `<button type="button" class="sw add" id="swAdd" title="Add a color">+</button><input type="color" id="swColor" hidden>`;
    $$('.sw[data-ch]', box).forEach(b => b.onclick = () => { ART.ch = b.dataset.ch; ART.tool = ART.tool === 'erase' ? 'pen' : ART.tool; drawPalette(); $$('[data-tool]').forEach(x => x.classList.toggle('on', x.dataset.tool === ART.tool)); });
    $('#swAdd').onclick = () => $('#swColor').click();
    $('#swColor').onchange = e => { const ch = FREE_CHARS.find(c => !(c in CM.PALETTE) && !(c in ART.palette)); if (!ch) return E.toast('Palette is full', 'err'); ART.palette[ch] = e.target.value; ART.ch = ch; ART.dirty = true; drawPalette(); };
  }
  function drawFrames() {
    const box = $('#artFrames'); const is3d = ART.kind === 'model';
    box.innerHTML = `<span class="muted small">${is3d ? 'Layers' : 'Frames'}</span>` + ART.frames.map((f, i) => `<button type="button" class="fr ${i === ART.cur ? 'on' : ''}" data-fr="${i}">${is3d ? i : i + 1}</button>`).join('') + `<button type="button" class="mini" id="frAdd">+ ${is3d ? 'layer' : 'frame'}</button><button type="button" class="mini" id="frDup">copy</button>${ART.frames.length > 1 ? `<button type="button" class="mini" id="frDel">delete</button>` : ''}`;
    $$('[data-fr]', box).forEach(b => b.onclick = () => { ART.cur = +b.dataset.fr; drawFrames(); drawArtCanvas(); });
    $('#frAdd').onclick = () => { ART.frames.push(Array.from({ length: artH() }, () => '.'.repeat(artW()))); ART.cur = ART.frames.length - 1; ART.dirty = true; drawFrames(); drawArtCanvas(); };
    $('#frDup').onclick = () => { ART.frames.splice(ART.cur + 1, 0, ART.frames[ART.cur].slice()); ART.cur++; ART.dirty = true; drawFrames(); drawArtCanvas(); };
    const del = $('#frDel'); if (del) del.onclick = () => { ART.frames.splice(ART.cur, 1); ART.cur = Math.max(0, ART.cur - 1); ART.dirty = true; drawFrames(); drawArtCanvas(); };
  }
  function cellSize() { return Math.max(4, Math.min(24, Math.floor(300 / Math.max(artW(), artH())))); }
  function drawArtCanvas() {
    const c = $('#artCanvas'); if (!c) return; const cs = cellSize(), w = artW(), h = artH(); c.width = w * cs; c.height = h * cs; c.style.width = c.width + 'px'; const x = c.getContext('2d');
    for (let j = 0; j < h; j++) for (let i = 0; i < w; i++) { x.fillStyle = (i + j) % 2 ? '#1a1d24' : '#22262e'; x.fillRect(i * cs, j * cs, cs, cs); }
    // onion skin of the previous frame
    if (ART.kind === 'sprite' && ART.cur > 0) { x.globalAlpha = 0.25; drawRows(x, ART.frames[ART.cur - 1], cs); x.globalAlpha = 1; }
    drawRows(x, ART.frames[ART.cur], cs);
    x.strokeStyle = 'rgba(255,255,255,.06)'; for (let i = 0; i <= w; i++) { x.beginPath(); x.moveTo(i * cs + .5, 0); x.lineTo(i * cs + .5, h * cs); x.stroke(); } for (let j = 0; j <= h; j++) { x.beginPath(); x.moveTo(0, j * cs + .5); x.lineTo(w * cs, j * cs + .5); x.stroke(); }
  }
  function drawRows(x, rows, cs) { rows.forEach((r, j) => { for (let i = 0; i < r.length; i++) { const col = colorOf(r[i]); if (r[i] === '.' || r[i] === ' ' || !col) continue; x.fillStyle = col; x.fillRect(i * cs, j * cs, cs, cs); } }); }
  function bindArtCanvas() {
    const c = $('#artCanvas'); const cell = ev => { const r = c.getBoundingClientRect(); const cs = cellSize(); return { i: Math.floor((ev.clientX - r.left) / cs), j: Math.floor((ev.clientY - r.top) / cs) }; };
    c.onpointerdown = ev => { ART.drawing = true; c.setPointerCapture(ev.pointerId); paint(cell(ev), ev.button === 2); };
    c.onpointermove = ev => { if (ART.drawing) paint(cell(ev), ev.buttons === 2); };
    c.onpointerup = () => { ART.drawing = false; }; c.oncontextmenu = ev => ev.preventDefault();
  }
  function paint({ i, j }, rightBtn) {
    const w = artW(), h = artH(); if (i < 0 || j < 0 || i >= w || j >= h) return; const f = ART.frames[ART.cur]; const cur = f[j][i];
    if (ART.tool === 'pick' && !rightBtn) { if (cur !== '.') { ART.ch = cur; drawPalette(); } return; }
    const ch = (ART.tool === 'erase' || rightBtn) ? '.' : ART.ch;
    if (ART.tool === 'fill' && !rightBtn) { const target = cur; if (target === ch) return; const stack = [[i, j]]; const seen = new Set(); while (stack.length) { const [a, b] = stack.pop(); if (a < 0 || b < 0 || a >= w || b >= h || seen.has(a + ',' + b) || f[b][a] !== target) continue; seen.add(a + ',' + b); f[b] = f[b].slice(0, a) + ch + f[b].slice(a + 1); stack.push([a + 1, b], [a - 1, b], [a, b + 1], [a, b - 1]); } }
    else { if (cur === ch) return; f[j] = f[j].slice(0, i) + ch + f[j].slice(i + 1); }
    ART.dirty = true; drawArtCanvas(); applyArtLive();
  }
  // show the drawing in the running game immediately (the file is only written on Save)
  function applyArtLive() {
    const { CM, A } = E.get();
    if (ART.kind === 'sprite') { if (CM.defs.sprites[ART.name]) { const src = CM.defs.sprites[ART.name].src; CM.sprite(ART.name, { fps: ART.fps, frames: ART.frames.map(f => f.slice()), palette: ART.palette }); CM.defs.sprites[ART.name].src = src; } }
    else if (CM.defs.models[ART.name]) { const src = CM.defs.models[ART.name].src; CM.model(ART.name, { size: ART.size, voxels: ART.frames.map(f => f.slice()), palette: ART.palette }); CM.defs.models[ART.name].src = src; for (const e of A.list()) if (e.model === ART.name) e.build(); }
  }
  async function saveArt() {
    const body = { project: pid(), name: ART.name, kind: ART.kind, palette: ART.palette, fps: ART.fps, size: ART.size }; if (ART.kind === 'model') body.voxels = ART.frames; else body.frames = ART.frames;
    const r = await api('POST', '/api/art/sprite', body); if (r.error) return E.toast(r.error, 'err');
    ART.dirty = false; E.toast(`${r.replaced ? 'Updated' : 'Added'} ${ART.name} in ${r.file}:${r.line}`, 'good'); $('#artSrc').textContent = `${r.file}:${r.line}`;
  }
  addEventListener('keydown', e => { if (E.tab !== 'tools' || T.sub !== 'art' || /INPUT|TEXTAREA|SELECT/.test(e.target.tagName)) return; const k = e.key.toLowerCase(); const t = { d: 'pen', e: 'erase', f: 'fill', i: 'pick' }[k]; if (t) { ART.tool = t; $$('[data-tool]').forEach(x => x.classList.toggle('on', x.dataset.tool === t)); } });

  // ---------------- Level painter (2D tile maps) ----------------
  const L = { on: false, ch: null, tm: null, hover: null, down: false, dirty: false };
  function renderLevel() {
    const { CM, A } = E.get(); const body = $('#toolBody'); const s = CM.current; const tms = s ? s.tilemaps : [];
    if (!tms.length) { body.innerHTML = `<div class="empty"><b>No tile map in this scene</b>Levels made with <code>s.tiles(...)</code> can be painted here.</div>`; return; }
    if (!L.tm || !tms.includes(L.tm)) L.tm = s.tilemap || tms[0]; const tm = L.tm; const legend = Object.entries(tm.legend);
    if (!L.ch || !tm.legend[L.ch]) L.ch = legend[0] ? legend[0][0] : '#';
    body.innerHTML = `<div class="tab-head">${tms.length > 1 ? `<select id="lvTm">${tms.map((t, i) => `<option value="${i}" ${t === tm ? 'selected' : ''}>${esc(t.name)}</option>`).join('')}</select>` : `<span>${esc(tm.name)} · ${tm.w}×${tm.h} tiles of ${tm.size}px</span>`}<span class="grow"></span><span class="src">${esc(tm.src || '')}</span></div>
      <div class="legend">${legend.map(([ch, Lg]) => `<button type="button" class="lg ${L.ch === ch ? 'on' : ''}" data-ch="${esc(ch)}" title="${esc(ch)}">${swatch(ch, Lg)}<span>${esc(Lg.spawn ? Lg.spawn : Lg.solid ? (Lg.oneWay ? 'platform' : 'solid') : 'tile')}</span><em>${esc(ch)}</em></button>`).join('')}<button type="button" class="lg ${L.ch === '.' ? 'on' : ''}" data-ch="." title="Erase"><i class="sw-empty"></i><span>erase</span><em>.</em></button></div>
      <div class="insp-actions"><button type="button" class="btn ${L.on ? 'on' : 'primary'}" id="lvToggle">${ICON('brush')}${L.on ? 'Stop painting' : 'Paint on the game'}</button><button type="button" class="btn" id="lvSave" ${L.dirty ? '' : 'disabled'}>Save level</button><button type="button" class="btn ghost" id="lvRevert">Revert</button></div>
      <p class="muted small">Pick a tile, then click or drag on the game. Right-click erases. Things like coins are placed live. Save writes the rows back into the scene file.</p>`;
    const sel = $('#lvTm'); if (sel) sel.onchange = e => { L.tm = tms[+e.target.value]; L.ch = null; renderLevel(); };
    $$('.lg', body).forEach(b => b.onclick = () => { L.ch = b.dataset.ch; $$('.lg', body).forEach(x => x.classList.toggle('on', x === b)); if (!L.on) toggleLevel(); });
    $('#lvToggle').onclick = toggleLevel; $('#lvSave').onclick = saveLevel; $('#lvRevert').onclick = () => { L.dirty = false; if (L.on) toggleLevel(); A.restart(); E.toast('Level reverted'); };
  }
  function swatch(ch, Lg) { const { CM } = E.get(); if (Lg.sprite && CM.defs.sprites[Lg.sprite]) return `<img src="${CM.defs.sprites[Lg.sprite].canvases[0].toDataURL()}" alt="">`; if (Lg.spawn && CM.defs.entities[Lg.spawn] && CM.defs.entities[Lg.spawn].sprite && CM.defs.sprites[CM.defs.entities[Lg.spawn].sprite]) return `<img src="${CM.defs.sprites[CM.defs.entities[Lg.spawn].sprite].canvases[0].toDataURL()}" alt="">`; return `<i style="background:${Lg.color || '#888'}"></i>`; }
  function toggleLevel() {
    L.on = !L.on;
    if (L.on) E.setMode('level', { move: lvMove, down: lvDown, up: () => { L.down = false; }, draw: lvDraw }); else E.setMode(null);
    $('#hint').textContent = L.on ? 'Painting · right-click erases · Esc to stop' : ''; $('#hint').classList.toggle('show', L.on);
    if (E.tab === 'tools') renderLevel();
  }
  const cellAt = p => { const { CM } = E.get(); const w = CM.toWorld(p.x, p.y); const tm = L.tm; return { tx: Math.floor(w.x / tm.size), ty: Math.floor(w.y / tm.size) }; };
  function lvMove(p, ev) { L.hover = cellAt(p); if (L.down) paintCell(L.hover, ev.buttons === 2); }
  function lvDown(p, ev) { L.down = true; paintCell(cellAt(p), ev.button === 2); }
  function paintCell({ tx, ty }, erase) {
    const { CM } = E.get(); const s = CM.current, tm = L.tm; if (tx < 0 || ty < 0 || tx >= tm.w || ty >= tm.h) return; const ch = erase ? '.' : L.ch; const Lg = tm.legend[ch];
    const key = tx + ',' + ty;
    // clear whatever sat in the cell before: a tile or a spawned thing
    if (tm.spawns[key]) { delete tm.spawns[key]; for (const e of s.entities) if (e.spawnCell && e.spawnCell.tx === tx && e.spawnCell.ty === ty && e.spawnCell.tm === tm.name) e.destroy(); }
    if (Lg && Lg.spawn) { if (tm.grid[ty][tx] === L.ch) return; tm.grid[ty][tx] = Lg.under || '.'; s.spawnInCell(tm, tx, ty, ch); }
    else { if (tm.grid[ty][tx] === ch && !Lg) return; tm.grid[ty][tx] = ch; }
    L.dirty = true; const b = $('#lvSave'); if (b) b.disabled = false;
  }
  function lvDraw(c) {
    const { CM, LW, LH } = E.get(); const tm = L.tm; if (!tm) return; const cam = CM.current.camera; const z = cam.zoom; const overlay = { width: LW, height: LH };
    c.strokeStyle = 'rgba(255,255,255,.07)'; const x0 = Math.floor(cam.x / tm.size), y0 = Math.floor(cam.y / tm.size);
    for (let tx = x0; tx * tm.size < cam.x + overlay.width / z; tx++) { const sx = Math.round((tx * tm.size - cam.x) * z) + .5; c.beginPath(); c.moveTo(sx, 0); c.lineTo(sx, overlay.height); c.stroke(); }
    for (let ty = y0; ty * tm.size < cam.y + overlay.height / z; ty++) { const sy = Math.round((ty * tm.size - cam.y) * z) + .5; c.beginPath(); c.moveTo(0, sy); c.lineTo(overlay.width, sy); c.stroke(); }
    if (L.hover) { const p = CM.toScreen(L.hover.tx * tm.size, L.hover.ty * tm.size); c.strokeStyle = '#ffd84d'; c.lineWidth = 2; c.strokeRect(p.x + 1, p.y + 1, tm.size * z - 2, tm.size * z - 2); c.lineWidth = 1; }
  }
  async function saveLevel() {
    const { CM } = E.get(); const tm = L.tm; const file = (tm.src || '').split(':')[0]; if (!file) return E.toast('This level was not made from a file', 'err');
    const r = await api('POST', '/api/art/tiles', { project: pid(), file, original: tm.original, rows: CM.current.tileRows(tm) });
    if (r.error) return E.toast(r.error, 'err'); L.dirty = false; if (L.on) toggleLevel(); E.toast('Level saved into ' + file, 'good');
  }

  // ---------------- Sounds ----------------
  const S = { sounds: {}, used: [], editing: null, rec: null };
  async function renderSounds() {
    const { CM } = E.get(); const body = $('#toolBody'); const r = await api('GET', '/api/sounds?project=' + pid()); S.sounds = r.sounds || {}; S.used = r.used || [];
    const names = [...new Set([...S.used, ...Object.keys(S.sounds), ...CM.SFX_NAMES])];
    body.innerHTML = `<div class="tab-head"><span>${S.used.length} used by the game · tap ▶ to hear</span></div>
      <div class="sound-list">${names.map(n => { const o = S.sounds[n]; const kind = o && o.file ? 'file' : o && o.synth ? 'synth' : CM.SFX_NAMES.includes(n) ? 'built-in' : 'none'; return `<div class="snd ${S.editing === n ? 'on' : ''}" data-snd="${esc(n)}"><button type="button" class="play" data-play="${esc(n)}">${ICON('play')}</button><b>${esc(n)}</b><span class="badge ${kind}">${kind}</span>${S.used.includes(n) ? '' : '<span class="muted small">not used</span>'}<span class="grow"></span><button type="button" class="mini" data-edit="${esc(n)}">${S.editing === n ? 'Close' : 'Change'}</button></div>${S.editing === n ? soundEditor(n) : ''}`; }).join('')}</div>
      <div class="insp-actions"><button type="button" class="btn" id="sndNew">${ICON('plus')}New sound</button></div>`;
    $$('[data-play]', body).forEach(b => b.onclick = () => CM.sfx(b.dataset.play));
    $$('[data-edit]', body).forEach(b => b.onclick = () => { S.editing = S.editing === b.dataset.edit ? null : b.dataset.edit; renderSounds(); });
    $('#sndNew').onclick = () => { const n = prompt('Name for the sound (use it with CM.sfx(\'name\')):'); if (!n || !/^[\w-]{1,30}$/.test(n)) return; S.sounds[n] = { synth: { ...CM.PRESETS.select } }; S.editing = n; saveSounds(); };
    if (S.editing) bindSoundEditor(S.editing);
  }
  function soundEditor(n) {
    const { CM } = E.get(); const o = S.sounds[n] || {}; const sy = o.synth || CM.PRESETS[n] || { freq: 440, slide: 0, dur: 0.15, type: 'square', vol: 0.25 };
    const sl = (k, min, max, step, label) => `<label class="slider"><span>${label}</span><input type="range" data-sy="${k}" min="${min}" max="${max}" step="${step}" value="${sy[k] != null ? sy[k] : 0}"><em>${sy[k] != null ? sy[k] : 0}</em></label>`;
    return `<div class="snd-edit">
      <div class="seg small"><button type="button" data-mode="synth" class="${!o.file ? 'on' : ''}">Synth</button><button type="button" data-mode="file" class="${o.file ? 'on' : ''}">File / record</button></div>
      <div id="sndSynth" ${o.file ? 'hidden' : ''}>${sl('freq', 40, 2000, 1, 'pitch')}${sl('slide', -1500, 1500, 10, 'slide')}${sl('dur', 0.02, 1.5, 0.01, 'length')}${sl('vol', 0, 1, 0.01, 'volume')}
        <label class="slider"><span>wave</span><select data-sy="type">${['square', 'sawtooth', 'triangle', 'sine'].map(t => `<option ${sy.type === t ? 'selected' : ''}>${t}</option>`).join('')}</select></label>
        <div class="insp-actions"><button type="button" class="btn" id="syPlay">${ICON('play')}Preview</button><button type="button" class="btn primary" id="syUse">Use this synth</button></div></div>
      <div id="sndFile" ${o.file ? '' : 'hidden'}>${o.file ? `<div class="muted small">Now: <code>${esc(o.file)}</code></div>` : ''}
        <div class="insp-actions"><label class="btn">${ICON('upload')}Upload<input type="file" id="sndUpload" accept="audio/*" hidden></label><button type="button" class="btn" id="sndRec">${ICON('mic')}Record</button></div>
        <div class="muted small" id="recStatus"></div></div>
      ${o.file || o.synth ? `<div class="insp-actions"><button type="button" class="btn ghost" id="sndReset">Back to the built-in sound</button></div>` : ''}
    </div>`;
  }
  function bindSoundEditor(n) {
    const { CM } = E.get(); const box = $('.snd-edit'); if (!box) return;
    const o = S.sounds[n] || {}; const sy = { ...(o.synth || CM.PRESETS[n] || { freq: 440, slide: 0, dur: 0.15, type: 'square', vol: 0.25 }) };
    $$('[data-mode]', box).forEach(b => b.onclick = () => { $$('[data-mode]', box).forEach(x => x.classList.toggle('on', x === b)); $('#sndSynth').hidden = b.dataset.mode !== 'synth'; $('#sndFile').hidden = b.dataset.mode !== 'file'; });
    $$('[data-sy]', box).forEach(inp => { inp.oninput = () => { sy[inp.dataset.sy] = inp.tagName === 'SELECT' ? inp.value : +inp.value; const em = inp.parentElement.querySelector('em'); if (em) em.textContent = inp.value; CM.tone(sy); }; });
    $('#syPlay').onclick = () => CM.tone(sy);
    $('#syUse').onclick = () => { S.sounds[n] = { synth: sy }; saveSounds(); };
    const rs = $('#sndReset'); if (rs) rs.onclick = () => { delete S.sounds[n]; saveSounds(); };
    $('#sndUpload').onchange = async e => { const f = e.target.files[0]; if (!f) return; const dataUrl = await new Promise(r => { const fr = new FileReader(); fr.onload = () => r(fr.result); fr.readAsDataURL(f); }); const r = await api('POST', '/api/sounds/upload', { project: pid(), name: n, dataUrl, ext: (f.name.split('.').pop() || '').toLowerCase() }); if (r.error) return E.toast(r.error, 'err'); S.sounds = r.sounds; CM.loadSounds(S.sounds); E.toast('Uploaded ' + f.name, 'good'); renderSounds(); CM.sfx(n); };
    $('#sndRec').onclick = async () => {
      if (S.rec) { S.rec.stop(); return; }
      try { const stream = await navigator.mediaDevices.getUserMedia({ audio: true }); const rec = new MediaRecorder(stream); const chunks = []; rec.ondataavailable = e => chunks.push(e.data);
        rec.onstop = async () => { stream.getTracks().forEach(t => t.stop()); S.rec = null; const blob = new Blob(chunks, { type: rec.mimeType || 'audio/webm' }); const dataUrl = await new Promise(r => { const fr = new FileReader(); fr.onload = () => r(fr.result); fr.readAsDataURL(blob); }); const r = await api('POST', '/api/sounds/upload', { project: pid(), name: n, dataUrl, ext: 'webm' }); if (r.error) return E.toast(r.error, 'err'); S.sounds = r.sounds; CM.loadSounds(S.sounds); E.toast('Recorded', 'good'); renderSounds(); CM.sfx(n); };
        rec.start(); S.rec = rec; $('#recStatus').textContent = 'Recording… press Record again to stop (max 5 s)'; $('#sndRec').classList.add('on'); setTimeout(() => { if (S.rec === rec) rec.stop(); }, 5000);
      } catch (e) { E.toast('Microphone not available: ' + e.message, 'err'); }
    };
  }
  async function saveSounds() { const { CM } = E.get(); const r = await api('PUT', '/api/sounds', { project: pid(), sounds: S.sounds }); if (r.error) return E.toast(r.error, 'err'); CM.loadSounds(S.sounds); E.toast('Sounds saved', 'good'); renderSounds(); if (S.editing) CM.sfx(S.editing); }
})();

// =====================================================================================================
// Sketch: draw what you want over the game (boxes, arrows, labels, freehand) and send it to Claude as one note
// =====================================================================================================
(function () {
  const E = window.Editor;
  const $ = (s, r) => (r || document).querySelector(s), $$ = (s, r) => Array.from((r || document).querySelectorAll(s));
  const esc = s => String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const COLORS = ['#ffd84d', '#5ea2ff', '#4ade80', '#f87171', '#ffffff', '#c084fc'];
  const K = { on: false, tool: 'box', color: COLORS[0], shapes: [], cur: null, space: 'screen', hover: null };
  const px = v => E.get().px(v); // screen pixels → logical units, so sketch text is the same size on any game
  const lw = () => px(2.5), fs = () => px(13);

  E.toggleSketch = function () {
    K.on = !K.on; const { stage, A } = E.get();
    if (K.on) { E.setMode('sketch', { move: onMove, down: onDown, up: onUp, draw: draw }); stage.classList.add('sketching'); renderBar(); $('#hint').textContent = 'Drag a box or arrow, type what it is, press Enter. Send when done · Esc stops'; $('#hint').classList.add('show'); }
    else { if (E.mode === 'sketch') E.setMode(null); stage.classList.remove('sketching'); $('#sketchBar').hidden = true; hideLabel(); $('#hint').classList.remove('show'); }
    $('[data-t=sketch]').classList.toggle('on', K.on);
  };
  const origSetMode = E.setMode; E.setMode = function (mode, h) { if (K.on && mode !== 'sketch') { K.on = false; E.get().stage.classList.remove('sketching'); $('#sketchBar').hidden = true; hideLabel(); $('[data-t=sketch]').classList.remove('on'); } return origSetMode(mode, h); };

  function renderBar() {
    const bar = $('#sketchBar'); bar.hidden = false; const { A } = E.get();
    bar.innerHTML = [['box', 'Box'], ['arrow', 'Arrow'], ['text', 'Label'], ['pen', 'Pen'], ['erase', 'Erase']].map(([t, l]) => `<button type="button" data-sk="${t}" class="${K.tool === t ? 'on' : ''}">${l}</button>`).join('') +
      `<span class="sep"></span>` + COLORS.map(c => `<button type="button" class="col ${K.color === c ? 'on' : ''}" data-col="${c}" style="background:${c}" title="${c}"></button>`).join('') +
      `<span class="sep"></span><button type="button" id="skUndo" title="Undo (⌘Z)">Undo</button><button type="button" id="skClear">Clear</button><span class="sep"></span><button type="button" class="send" id="skSend" ${K.shapes.length ? '' : 'disabled'}>Send to Claude</button>`;
    $$('[data-sk]', bar).forEach(b => b.onclick = () => { K.tool = b.dataset.sk; renderBar(); });
    $$('[data-col]', bar).forEach(b => b.onclick = () => { K.color = b.dataset.col; renderBar(); });
    $('#skUndo').onclick = undo; $('#skClear').onclick = () => { K.shapes = []; renderBar(); };
    $('#skSend').onclick = send;
  }
  addEventListener('keydown', e => { if (!K.on || /INPUT|TEXTAREA/.test(e.target.tagName)) return; if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'z') { undo(); e.preventDefault(); } const t = { b: 'box', a: 'arrow', t: 'text', p: 'pen', e: 'erase' }[e.key.toLowerCase()]; if (t && !e.metaKey) { K.tool = t; renderBar(); } });
  function undo() { K.shapes.pop(); renderBar(); }
  function worldOf(p) { const { A } = E.get(); try { const s = A.spot(p.x, p.y); return s && s.space !== 'screen' ? { x: s.x, y: s.y, z: s.z } : null; } catch { return null; } }

  function onDown(p, ev) {
    if (ev.button !== 0) return;
    if (K.tool === 'erase') { const i = hitShape(p); if (i >= 0) { K.shapes.splice(i, 1); renderBar(); } return; }
    if (K.tool === 'text') { const s = { type: 'text', x: p.x, y: p.y, color: K.color, label: '' }; K.shapes.push(s); askLabel(s, 'What goes here?'); return; }
    if (K.tool === 'pen') { K.cur = { type: 'pen', pts: [[p.x, p.y]], color: K.color, label: '' }; return; }
    K.cur = { type: K.tool, x: p.x, y: p.y, x2: p.x, y2: p.y, w: 0, h: 0, color: K.color, label: '' };
  }
  function onMove(p) { K.hover = p; if (!K.cur) return; if (K.cur.type === 'pen') { const l = K.cur.pts[K.cur.pts.length - 1]; if (Math.hypot(p.x - l[0], p.y - l[1]) > 1.5) K.cur.pts.push([p.x, p.y]); } else { K.cur.x2 = p.x; K.cur.y2 = p.y; K.cur.w = p.x - K.cur.x; K.cur.h = p.y - K.cur.y; } }
  function onUp(p) {
    const s = K.cur; K.cur = null; if (!s) return;
    if (s.type === 'box') { if (Math.abs(s.w) < 3 || Math.abs(s.h) < 3) return; if (s.w < 0) { s.x += s.w; s.w = -s.w; } if (s.h < 0) { s.y += s.h; s.h = -s.h; } delete s.x2; delete s.y2; }
    if (s.type === 'arrow' && Math.hypot(s.x2 - s.x, s.y2 - s.y) < 4) return;
    if (s.type === 'pen' && s.pts.length < 2) return;
    K.shapes.push(s); renderBar(); askLabel(s, s.type === 'box' ? 'What is this box?' : s.type === 'arrow' ? 'What should move or go there?' : 'What did you draw?');
  }
  function finish(s) { s.space = 'screen'; s.world = worldOf(center(s)); }
  function center(s) { if (s.type === 'box') return { x: s.x + s.w / 2, y: s.y + s.h / 2 }; if (s.type === 'arrow') return { x: s.x2, y: s.y2 }; if (s.type === 'pen') return { x: s.pts.reduce((a, p) => a + p[0], 0) / s.pts.length, y: s.pts.reduce((a, p) => a + p[1], 0) / s.pts.length }; return { x: s.x, y: s.y }; }
  function hitShape(p) { for (let i = K.shapes.length - 1; i >= 0; i--) { const s = K.shapes[i]; const m = px(10); if (s.type === 'box' && p.x >= s.x - m && p.x <= s.x + s.w + m && p.y >= s.y - m && p.y <= s.y + s.h + m) return i; if (s.type === 'text' && Math.hypot(p.x - s.x, p.y - s.y) < m * 3) return i; if (s.type === 'arrow' && (Math.hypot(p.x - s.x, p.y - s.y) < m * 2 || Math.hypot(p.x - s.x2, p.y - s.y2) < m * 2)) return i; if (s.type === 'pen' && s.pts.some(q => Math.hypot(p.x - q[0], p.y - q[1]) < m)) return i; } return -1; }

  let labelEl = null;
  function askLabel(s, placeholder) {
    hideLabel(); const { stage, cssScale } = E.get(); const c = center(s); const sc = cssScale();
    labelEl = document.createElement('input'); labelEl.className = 'sk-label'; labelEl.placeholder = placeholder; labelEl.value = s.label || '';
    labelEl.style.left = Math.min(stage.clientWidth - 160, Math.max(0, c.x * sc - 75)) + 'px'; labelEl.style.top = Math.min(stage.clientHeight - 30, Math.max(0, (s.type === 'box' ? s.y * sc - 30 : c.y * sc + 10))) + 'px';
    $('#dom-overlay').appendChild(labelEl); labelEl.style.pointerEvents = 'auto'; setTimeout(() => labelEl && labelEl.focus(), 20);
    const done = () => { if (!labelEl) return; s.label = labelEl.value.trim(); finish(s); hideLabel(); if (s.type === 'text' && !s.label) { K.shapes = K.shapes.filter(x => x !== s); } renderBar(); };
    labelEl.onkeydown = e => { if (e.key === 'Enter') { e.preventDefault(); done(); } else if (e.key === 'Escape') { e.preventDefault(); e.stopPropagation(); done(); } e.stopPropagation(); };
    labelEl.onblur = done;
  }
  function hideLabel() { if (labelEl) { const el = labelEl; labelEl = null; el.remove(); } }

  // drawing: live sketch while in sketch mode, and faded sketches from open notes any time
  function drawShape(c, s, alpha, live) {
    const { A } = E.get(); let dx = 0, dy = 0;
    if (s.space === 'world' && s.world && A.spotToScreen) { const sc = A.spotToScreen({ ...s.world, space: 'world' }); const cc = s.type === 'box' ? { x: s.x + s.w / 2, y: s.y + s.h / 2 } : s.type === 'pen' ? center(s) : s.type === 'arrow' ? { x: s.x2, y: s.y2 } : { x: s.x, y: s.y }; dx = sc.x - cc.x; dy = sc.y - cc.y; }
    c.save(); c.globalAlpha = alpha; c.strokeStyle = s.color; c.fillStyle = s.color; c.lineWidth = lw(); c.lineJoin = 'round'; c.lineCap = 'round'; c.font = `700 ${fs()}px Inter, sans-serif`; c.textBaseline = 'top';
    if (s.type === 'box') { c.setLineDash(live ? [] : [px(4), px(3)]); c.strokeRect(s.x + dx, s.y + dy, s.w, s.h); c.setLineDash([]); c.globalAlpha = alpha * 0.12; c.fillRect(s.x + dx, s.y + dy, s.w, s.h); c.globalAlpha = alpha; if (s.label) tag(c, s.label, s.x + dx + 2, s.y + dy + 2, s.color); }
    else if (s.type === 'arrow') { const a = Math.atan2(s.y2 - s.y, s.x2 - s.x), hl = px(12); c.beginPath(); c.moveTo(s.x + dx, s.y + dy); c.lineTo(s.x2 + dx, s.y2 + dy); c.stroke(); c.beginPath(); c.moveTo(s.x2 + dx, s.y2 + dy); c.lineTo(s.x2 + dx - hl * Math.cos(a - 0.5), s.y2 + dy - hl * Math.sin(a - 0.5)); c.lineTo(s.x2 + dx - hl * Math.cos(a + 0.5), s.y2 + dy - hl * Math.sin(a + 0.5)); c.closePath(); c.fill(); if (s.label) tag(c, s.label, (s.x + s.x2) / 2 + dx, (s.y + s.y2) / 2 + dy - fs(), s.color); }
    else if (s.type === 'pen') { c.beginPath(); s.pts.forEach((p, i) => i ? c.lineTo(p[0] + dx, p[1] + dy) : c.moveTo(p[0] + dx, p[1] + dy)); c.stroke(); if (s.label) { const ce = center(s); tag(c, s.label, ce.x + dx, ce.y + dy, s.color); } }
    else if (s.type === 'text') { tag(c, s.label || '…', s.x + dx, s.y + dy, s.color); }
    c.restore();
  }
  function tag(c, text, x, y, color) { const pad = px(4); const w = c.measureText(text).width + pad * 2, h = fs() + pad * 2; c.fillStyle = color; c.beginPath(); c.roundRect(x, y, w, h, px(4)); c.fill(); c.fillStyle = '#111'; c.fillText(text, x + pad, y + pad); }
  function draw(c) { for (const s of K.shapes) drawShape(c, s, 1, true); if (K.cur) drawShape(c, K.cur, 0.8, true); if (K.hover && K.tool !== 'erase') { c.fillStyle = K.color; c.fillRect(K.hover.x - px(1.5), K.hover.y - px(1.5), px(3), px(3)); } }
  E.drawSketches = function (c) { if (K.on) return; for (const n of E.notes) if (n.status === 'open' && n.kind === 'sketch' && n.shapes) for (const s of n.shapes) drawShape(c, s, 0.45, false); };

  async function send() {
    if (!K.shapes.length) return; const { A, popover, LW, LH } = E.get();
    // the picture is the game frame with the sketch drawn on top, at a readable size
    let image = null; try { const game = $('#game'); const scale = LW < 640 ? Math.ceil(640 / LW) : 1; const c = document.createElement('canvas'); c.width = LW * scale; c.height = LH * scale; const x = c.getContext('2d'); x.imageSmoothingEnabled = false; x.drawImage(game, 0, 0, c.width, c.height); const hud = $('#hud'); if (hud) x.drawImage(hud, 0, 0, c.width, c.height); x.setTransform(scale, 0, 0, scale, 0, 0); for (const s of K.shapes) drawShape(x, s, 1, true); image = c.toDataURL('image/png'); } catch (e) { console.warn('sketch picture', e); }
    const shapes = K.shapes.map(s => ({ ...s, x: r1(s.x), y: r1(s.y), x2: s.x2 != null ? r1(s.x2) : undefined, y2: s.y2 != null ? r1(s.y2) : undefined, w: s.w != null ? r1(s.w) : undefined, h: s.h != null ? r1(s.h) : undefined, pts: s.pts ? s.pts.filter((p, i) => i % 3 === 0 || i === s.pts.length - 1).map(p => [r1(p[0]), r1(p[1])]) : undefined }));
    E.openPopover({ kind: 'sketch', at: { x: LW / 2 - 160 / E.get().cssScale(), y: 20 }, shapes, image, text: '' });
    const done = () => { if (popover.hidden) { K.shapes = []; if (K.on) E.toggleSketch(); } else setTimeout(done, 300); }; setTimeout(done, 400);
  }
  const r1 = v => Math.round(v * 10) / 10;
})();
