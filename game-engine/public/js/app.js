/* Spark Engine — the editor */
(function () {
  const SB = window.ScratchBlocks, Lib = window.SparkLib;
  const $ = s => document.querySelector(s), $$ = s => Array.from(document.querySelectorAll(s));
  const uid = () => Math.random().toString(36).slice(2, 10);
  const debounce = (fn, ms) => { let t; return (...a) => { clearTimeout(t); t = setTimeout(() => fn(...a), ms); }; };

  /* ================= runtime ================= */
  const R = new SparkRuntime($('#stage'), { overlay: $('#stage-overlay'), editorMode: true });
  window.R = R;
  let current = null;      // target being edited
  let ws = null;           // blockly workspace
  let loadingWs = false;
  let deletedSprites = [];
  let tab = 'code';

  /* ================= menus for the blocks ================= */
  const opts = arr => arr.length ? arr.map(n => [n, n]) : [['', '']];
  Object.assign(window.SparkMenus, {
    costumes: () => opts(((current || R.stage) ? (current || R.stage).costumes : []).map(c => c.name)),
    backdrops: () => opts((R.stage ? R.stage.costumes : []).map(c => c.name)),
    sounds: () => { const s = (current || R.stage) ? (current || R.stage).sounds : []; return s.length ? opts(s.map(x => x.name)) : [['(no sounds yet)', '']]; },
    sprites: () => (R.stage ? R.originals() : []).filter(t => t !== current).map(t => [t.name, t.name]),
    isStage: () => !!(current && current.isStage)
  });

  /* ================= workspace ================= */
  function initWorkspace() {
    ws = SB.inject('blocks', {
      toolbox: SparkBlocks.makeToolbox(false), media: 'vendor/scratch-blocks/media/',
      zoom: { controls: true, wheel: true, startScale: 0.675 }, grid: { spacing: 40, length: 2, colour: '#ddd' },
      comments: true, collapse: false, sounds: false, scrollbars: true,
      colours: { workspace: '#F9F9F9', flyout: '#F9F9F9', toolbox: '#FFFFFF', toolboxSelected: '#E9EEF2', scrollbar: '#CECDCE', scrollbarHover: '#CECDCE', insertionMarker: '#000000', insertionMarkerOpacity: 0.2, fieldShadow: 'rgba(255, 255, 255, 0.3)', dragShadowOpacity: 0.6 }
    });
    ws.addChangeListener(onWorkspaceEvent);
    attachFlyoutListener();
    window.addEventListener('resize', () => SB.svgResize(ws));
    SB.prompt = variablePrompt;
    SB.Procedures.externalProcedureDefCallback = procedurePrompt;
  }
  const saveWorkspace = debounce(() => {
    if (!current || loadingWs) return;
    const dom = SB.Xml.workspaceToDom(ws);
    syncVariables(dom);
    current.xml = SB.Xml.domToText(dom);
    current.compile();
    markDirty();
    autoEnableFromBlocks();
  }, 250);
  // the palette (flyout) is its own workspace: checkbox clicks and block clicks there are reported on it, like Scratch
  let flyoutWs = null;
  function attachFlyoutListener() {
    const fl = ws.getFlyout && ws.getFlyout(); const fw = fl && fl.getWorkspace && fl.getWorkspace();
    if (fw && fw !== flyoutWs) { flyoutWs = fw; fw.addChangeListener(onWorkspaceEvent); }
  }
  function onWorkspaceEvent(e) {
    if (loadingWs) return;
    if (e.type === 'change' && e.element === 'checkbox') { onCheckbox(e); return; }
    if (e.type === 'ui') {
      if (e.element === 'stackclick') onStackClick(e);
      return;
    }
    if (e.workspaceId !== ws.id) return;
    saveWorkspace();
  }
  // variables without islocal belong to the stage (global); the rest to the sprite
  function syncVariables(dom) {
    const el = dom.querySelector('variables'); if (!el) return;
    const globals = [], locals = [];
    for (const v of Array.from(el.children)) {
      const rec = { id: v.getAttribute('id'), name: v.textContent, type: v.getAttribute('type') || '', isCloud: v.getAttribute('iscloud') === 'true' };
      (v.getAttribute('islocal') === 'true' && !current.isStage ? locals : globals).push(rec);
    }
    applyVars(R.stage, globals);
    R.stage.cloudVars = {}; for (const v of R.stage.variables) if (v.isCloud) R.stage.cloudVars[v.name] = true;
    R.cloudSetup();
    if (!current.isStage) applyVars(current, locals);
    // strip globals out of the sprite's own xml (they're rebuilt from the stage on load)
    if (!current.isStage) for (const v of Array.from(el.children)) if (v.getAttribute('islocal') !== 'true') el.removeChild(v);
  }
  function applyVars(t, list) {
    const keep = new Set();
    for (const v of list) {
      // same id, new name = a rename: carry the value, type and monitor across
      const byId = t.variables.find(x => x.id === v.id && x.type === v.type && x.name !== v.name);
      if (byId) {
        const old = byId.name; byId.name = v.name; t.varTypes[v.name] = t.varTypes[old]; delete t.varTypes[old];
        if (v.type === 'list') { t.lists[v.name] = t.lists[old] || []; delete t.lists[old]; } else if (v.type === '') { t.vars[v.name] = t.vars[old] ?? 0; delete t.vars[old]; }
        for (const m of R.monitors) if (m.name === old && m.target === (t.isStage ? null : t.name) && !!m.isList === (v.type === 'list')) m.name = v.name;
        if (t.isStage && t.cloudVars && t.cloudVars[old]) { delete t.cloudVars[old]; t.cloudVars[v.name] = true; }
      }
      keep.add(v.name + '|' + v.type);
      const ex = t.variables.find(x => x.name === v.name && x.type === v.type);
      if (ex) { ex.id = v.id; ex.isCloud = !!v.isCloud; } else t.variables.push({ ...v });
      if (!(v.name in t.varTypes)) { t.varTypes[v.name] = v.type; if (v.type === 'list') t.lists[v.name] = t.lists[v.name] || []; else if (v.type === '') t.vars[v.name] = t.vars[v.name] ?? 0; }
    }
    // a rename shows up as delete+create: drop variables no longer present
    t.variables = t.variables.filter(v => keep.has(v.name + '|' + v.type));
    for (const n of Object.keys(t.varTypes)) if (![...keep].some(k => k.startsWith(n + '|'))) { delete t.varTypes[n]; delete t.vars[n]; delete t.lists[n]; }
  }
  function workspaceXMLFor(t) {
    const doc = new DOMParser().parseFromString(t.xml || '<xml></xml>', 'text/xml');
    const root = doc.documentElement;
    let vars = root.querySelector('variables');
    if (vars) root.removeChild(vars);
    vars = doc.createElement('variables');
    const add = (v, local) => { const e = doc.createElement('variable'); e.setAttribute('type', v.type || ''); e.setAttribute('id', v.id || (v.id = uid())); e.setAttribute('islocal', local ? 'true' : 'false'); e.setAttribute('iscloud', v.isCloud ? 'true' : 'false'); e.textContent = v.name; vars.appendChild(e); };
    for (const v of R.stage.variables) add(v, false);
    if (!t.isStage) for (const v of t.variables) add(v, true);
    root.insertBefore(vars, root.firstChild);
    return root;
  }
  function loadWorkspace(t) {
    loadingWs = true;
    try {
      ws.updateToolbox(SparkBlocks.makeToolbox(t.isStage));
      SB.Xml.clearWorkspaceAndLoadFromXml(workspaceXMLFor(t), ws);
      ws.scrollCenter && ws.scrollCenter();
      if (ws.getToolbox()) ws.getToolbox().refreshSelection();
    } catch (e) { console.error('workspace load failed', e); }
    loadingWs = false;
    syncCheckboxes();
  }
  /* ---- extensions (Scratch-style "Add Extension") ---- */
  function allXml() { return R.allTargets().map(t => t.xml); }
  function enableExtensions(list, quiet) {
    const before = [...SparkBlocks.enabled]; const set = new Set([...before, ...list]);
    if (set.size === before.length && !quiet) return;
    SparkBlocks.setEnabled([...set]);
    if (ws && current) { if (set.size !== before.length) loadWorkspace(current); attachFlyoutListener(); }
  }
  function autoEnableFromBlocks() { const used = SparkBlocks.extensionsUsed(allXml()); const missing = [...used].filter(e => !SparkBlocks.enabled.has(e)); if (missing.length) enableExtensions(missing); }
  function extensionPicker() {
    const EXT = SparkBlocks.EXTENSIONS;
    openModal('Choose an Extension', `<div class="lib-grid ext-grid">${Object.entries(EXT).map(([k, e]) => `<div class="lib-item ext ${SparkBlocks.enabled.has(k) ? 'added' : ''}" data-ext="${k}" style="--c:${SparkBlocks.CATS[k].primary}"><span class="big">${e.icon}</span><b>${e.name}</b><small>${esc(e.desc)}</small>${SparkBlocks.enabled.has(k) ? '<em>added ✓</em>' : ''}</div>`).join('')}</div>`);
    $$('.ext-grid .lib-item').forEach(d => d.onclick = () => { const k = d.dataset.ext; closeModal(); enableExtensions([k], true); markDirty(); setTimeout(() => { try { ws.getToolbox().setSelectedCategoryById(k); } catch (e) {} }, 50); });
  }
  $('#btn-extension').onclick = extensionPicker;
  function refreshToolbox() { if (!ws || !current) return; loadingWs = true; try { ws.updateToolbox(SparkBlocks.makeToolbox(current.isStage)); ws.getToolbox() && ws.getToolbox().refreshSelection(); } catch (e) {} loadingWs = false; attachFlyoutListener(); syncCheckboxes(); }
  // clicking a script runs it; clicking a reporter shows its value (like Scratch)
  function onStackClick(e) {
    const inFlyout = e.workspaceId !== ws.id; const w = inFlyout ? flyoutWs : ws;
    const block = w && w.getBlockById(e.blockId); if (!block || !current) return;
    const root = inFlyout ? block : block.getRootBlock();
    const dom = SB.Xml.blockToDom(root); const varsDom = workspaceXMLFor(current).querySelector('variables');
    const xml = '<xml>' + (varsDom ? new XMLSerializer().serializeToString(varsDom) : '') + SB.Xml.domToText(dom) + '</xml>';
    const compiled = SparkCompiler.compileStack(xml, R); if (!compiled) return;
    R.audio.ctx();
    if (compiled.reporter) {
      let v; try { v = compiled.reporter(current); } catch (err) { v = ''; }
      if (v && typeof v.then === 'function') return;
      try { w.reportValue(block.id, R.str(v)); } catch (err) { console.log('reporter value:', v); }
      return;
    }
    const th = R.startScript(current, compiled.script, true);
    if (!inFlyout) { try { ws.glowStack(root.id, true); } catch (err) {} const un = () => { try { ws.glowStack(root.id, false); } catch (err) {} }; th.promise.then(un, un); }
  }

  // monitor checkboxes in the flyout
  const BUILTIN = { motion_xposition: 'x position', motion_yposition: 'y position', motion_direction: 'direction', looks_costumenumbername: 'costume #', looks_backdropnumbername: 'backdrop #', looks_size: 'size', sound_volume: 'volume', sensing_timer: 'timer', sensing_answer: 'answer', sensing_mousex: 'mouse x', sensing_mousey: 'mouse y', sensing_loudness: 'loudness', spark_game_get: 'score' };
  function monitorFor(block) {
    if (!block) return null;
    if (block.type === 'data_variable' || block.type === 'data_listcontents') {
      const field = block.getField(block.type === 'data_variable' ? 'VARIABLE' : 'LIST'); const v = ws.getVariableById(field.getValue());
      if (!v) return null;
      return { target: v.isLocal && !current.isStage ? current.name : null, name: v.name, isList: v.type === 'list' };
    }
    if (block.type in BUILTIN) {
      let name = BUILTIN[block.type];
      if (block.type === 'spark_game_get') name = block.getFieldValue('STAT');
      const perSprite = ['x position', 'y position', 'direction', 'costume #', 'size', 'volume'].includes(name) && !current.isStage;
      return { target: perSprite ? current.name : null, name, builtin: true, isList: false };
    }
    return null;
  }
  function onCheckbox(e) {
    const fw = ws.getFlyout() && ws.getFlyout().getWorkspace(); const block = fw && fw.getBlockById(e.blockId);
    const m = monitorFor(block); if (!m) return;
    let ex = R.monitors.find(x => x.name === m.name && x.target === m.target && !!x.isList === !!m.isList);
    if (!ex) { ex = { ...m, visible: false, x: null, y: null }; R.monitors.push(ex); }
    ex.visible = !!e.newValue; markDirty();
  }
  function syncCheckboxes() {
    const fl = ws.getFlyout(); if (!fl || !fl.getWorkspace()) return;
    for (const b of fl.getWorkspace().getTopBlocks()) {
      const m = monitorFor(b); if (!m) continue;
      const ex = R.monitors.find(x => x.name === m.name && x.target === m.target && !!x.isList === !!m.isList);
      try { fl.setCheckboxState(b.id, !!(ex && ex.visible)); } catch (err) {}
    }
  }

  /* ================= variable / procedure prompts ================= */
  function variablePrompt(message, defaultValue, callback, title, varType) {
    const isList = varType === 'list', isMsg = varType === 'broadcast_msg';
    const renaming = /rename/i.test(String(title || '')) || (!!defaultValue && !isMsg);
    const showScope = !current.isStage && !isMsg && !renaming;
    const showCloud = !isMsg && !isList && !renaming && !String(defaultValue || '').startsWith('☁');
    openModal(title || message, `
      <div class="form">
        <label>${message}<br><input type="text" id="var-name" value="${defaultValue || ''}" autocomplete="off"></label>
        ${showScope ? `<div class="radios"><label><input type="radio" name="scope" value="global" checked> For all sprites</label><label><input type="radio" name="scope" value="local"> For this sprite only</label></div>` : ''}
        ${showCloud ? `<label><input type="checkbox" id="var-cloud"> ☁ Cloud variable (stored online — everyone playing your game shares it)</label>` : ''}
        <div class="actions"><button class="btn" id="var-cancel">Cancel</button><button class="btn primary" id="var-ok">OK</button></div>
      </div>`);
    const inp = $('#var-name'); inp.focus(); inp.select();
    if (showCloud && showScope) $('#var-cloud').onchange = e => { if (e.target.checked) $('input[name=scope][value=global]').checked = true; };
    const done = () => { let name = inp.value.trim(); const cloud = showCloud && $('#var-cloud').checked; const scope = cloud ? 'global' : showScope && $('input[name=scope]:checked') ? $('input[name=scope]:checked').value : 'global'; closeModal(); if (!name) return; callback(name, [], { scope, isCloud: cloud }); };
    $('#var-ok').onclick = done; $('#var-cancel').onclick = closeModal;
    inp.onkeydown = e => { e.stopPropagation(); if (e.key === 'Enter') done(); if (e.key === 'Escape') closeModal(); };
  }
  function procedurePrompt(mutation, callback) {
    // parse existing proccode (editing) into parts
    const proccode = mutation.getAttribute('proccode') || '';
    const names = JSON.parse(mutation.getAttribute('argumentnames') || '[]');
    const ids = JSON.parse(mutation.getAttribute('argumentids') || '[]');
    const parts = []; let ai = 0;
    const tokens = proccode.split(/(%s|%b)/).filter(x => x !== '');
    for (const tk of tokens) {
      if (tk === '%s') parts.push({ kind: 'input', name: names[ai] || 'input', id: ids[ai++] });
      else if (tk === '%b') parts.push({ kind: 'bool', name: names[ai] || 'condition', id: ids[ai++] });
      else parts.push({ kind: 'label', name: tk.trim() });
    }
    if (!parts.length) parts.push({ kind: 'label', name: 'block name' });
    openModal('Make a Block', `
      <div class="form">
        <div class="proc-args" id="proc-args"></div>
        <div class="proc-add">
          <button class="btn" data-k="input">+ number or text input</button>
          <button class="btn" data-k="bool">+ true/false input</button>
          <button class="btn" data-k="label">+ label</button>
        </div>
        <label><input type="checkbox" id="proc-warp" ${mutation.getAttribute('warp') === 'true' ? 'checked' : ''}> Run without screen refresh (fast)</label>
        <div class="actions"><button class="btn" id="proc-cancel">Cancel</button><button class="btn primary" id="proc-ok">OK</button></div>
      </div>`);
    const box = $('#proc-args');
    const render = () => {
      box.innerHTML = '';
      parts.forEach((p, i) => {
        const chip = document.createElement('div'); chip.className = 'chip ' + p.kind;
        chip.innerHTML = `${p.kind === 'label' ? '' : p.kind === 'bool' ? '◆ ' : '▢ '}<input value="${p.name.replace(/"/g, '&quot;')}">${parts.length > 1 ? '<button title="remove">✕</button>' : ''}`;
        chip.querySelector('input').oninput = ev => p.name = ev.target.value;
        chip.querySelector('input').onkeydown = ev => ev.stopPropagation();
        const rm = chip.querySelector('button'); if (rm) rm.onclick = () => { parts.splice(i, 1); render(); };
        box.appendChild(chip);
      });
    };
    render();
    $$('.proc-add button').forEach(b => b.onclick = () => { const k = b.dataset.k; parts.push({ kind: k, name: k === 'label' ? 'label' : k === 'bool' ? 'condition' : 'number or text' }); render(); box.lastChild.querySelector('input').focus(); });
    $('#proc-cancel').onclick = closeModal;
    $('#proc-ok').onclick = () => {
      const code = [], an = [], aid = [], ad = [];
      for (const p of parts) {
        const nm = p.name.trim() || (p.kind === 'label' ? 'block' : 'input');
        if (p.kind === 'label') code.push(nm.replace(/%/g, ''));
        else { code.push(p.kind === 'bool' ? '%b' : '%s'); an.push(nm); aid.push(p.id || uid()); ad.push(p.kind === 'bool' ? 'false' : ''); }
      }
      const m = document.createElement('mutation');
      m.setAttribute('proccode', code.join(' ')); m.setAttribute('argumentnames', JSON.stringify(an)); m.setAttribute('argumentids', JSON.stringify(aid)); m.setAttribute('argumentdefaults', JSON.stringify(ad)); m.setAttribute('warp', $('#proc-warp').checked ? 'true' : 'false');
      closeModal(); callback(m);
    };
  }

  /* ================= modal ================= */
  function openModal(title, html) { $('#modal-title').textContent = title; $('#modal-body').innerHTML = html; $('#modal').hidden = false; }
  function closeModal() { $('#modal').hidden = true; $('#modal-body').innerHTML = ''; stopPreview(); }
  $('#modal-close').onclick = closeModal;
  $('#modal').addEventListener('pointerdown', e => { if (e.target === $('#modal')) closeModal(); });

  /* ================= selection ================= */
  function selectTarget(t) {
    if (current && current !== t && ws && !loadingWs) { const dom = SB.Xml.workspaceToDom(ws); syncVariables(dom); current.xml = SB.Xml.domToText(dom); }
    current = t;
    loadWorkspace(t);
    renderSprites(); renderInfo(); renderCostumes(); renderSounds(); renderTag();
    $('#tab-costumes-label').textContent = t.isStage ? 'Backdrops' : 'Costumes';
  }
  function renderTag() { if (!current) return; const c = current.costume; $('#tag-img').src = c ? c.src : ''; $('#tag-name').textContent = current.name; }

  /* ================= sprite list & info ================= */
  function renderSprites() {
    const list = $('#sprite-list'); list.innerHTML = '';
    for (const t of R.originals()) {
      const d = document.createElement('div'); d.className = 'sprite-tile' + (t === current ? ' selected' : ''); d.dataset.id = t.id;
      d.innerHTML = `<img src="${t.costume ? t.costume.src : ''}"><span class="nm">${esc(t.name)}</span><button class="del" title="Delete">✕</button>`;
      d.onclick = e => { if (e.target.classList.contains('del')) return deleteSprite(t); selectTarget(t); };
      d.oncontextmenu = e => { e.preventDefault(); spriteContext(t, e); };
      list.appendChild(d);
    }
    $('#stage-pane').classList.toggle('selected', !!(current && current.isStage));
    const bd = R.stage.costume; $('#stage-thumb').src = bd ? bd.src : ''; $('#backdrop-count').textContent = R.stage.costumes.length;
  }
  function spriteContext(t, e) {
    openModal(t.name, `<div class="form"><button class="btn" id="ctx-dup">Duplicate</button><button class="btn" id="ctx-export">Export sprite (.json)</button><button class="btn" id="ctx-del">Delete</button></div>`);
    $('#ctx-dup').onclick = () => { closeModal(); duplicateSprite(t); };
    $('#ctx-del').onclick = () => { closeModal(); deleteSprite(t); };
    $('#ctx-export').onclick = () => { closeModal(); download(JSON.stringify(t.toJSON()), safeName(t.name) + '.sprite.json', 'application/json'); };
  }
  function renderInfo() {
    if (!current) return;
    const info = $('#sprite-info'); info.classList.toggle('stage-selected', current.isStage);
    $('#info-name').value = current.name; $('#info-x').value = Math.round(current.x); $('#info-y').value = Math.round(current.y);
    $('#info-size').value = Math.round(current.size); $('#info-dir').value = Math.round(current.direction);
    $('#info-show').classList.toggle('active', current.visible); $('#info-hide').classList.toggle('active', !current.visible);
  }
  $('#info-name').onchange = e => renameTarget(current, e.target.value);
  $('#info-x').onchange = e => { current.goTo(+e.target.value || 0, current.y); markDirty(); };
  $('#info-y').onchange = e => { current.goTo(current.x, +e.target.value || 0); markDirty(); };
  $('#info-size').onchange = e => { current.setSize(+e.target.value || 100); markDirty(); };
  $('#info-dir').onchange = e => { current.setDirection(+e.target.value || 90); markDirty(); };
  $('#info-show').onclick = () => { current.visible = true; renderInfo(); markDirty(); };
  $('#info-hide').onclick = () => { current.visible = false; renderInfo(); markDirty(); };
  $$('#sprite-info input').forEach(i => i.onkeydown = e => e.stopPropagation());
  function renameTarget(t, name) {
    name = name.trim(); if (!name || t.isStage) { renderInfo(); return; }
    let n = name, i = 2; while (R.originals().some(o => o !== t && o.name === n)) n = name + (i++);
    const old = t.name;
    t.name = n;
    // update references in every workspace xml (menus store the sprite name)
    for (const o of R.allTargets()) if (o.xml && o.xml.includes('>' + escXml(old) + '<')) o.xml = o.xml.split('>' + escXml(old) + '<').join('>' + escXml(n) + '<');
    for (const m of R.monitors) if (m.target === old) m.target = n;
    if (t === current) loadWorkspace(t); else refreshToolbox();
    for (const o of R.allTargets()) o.compile();
    renderSprites(); renderInfo(); renderTag(); markDirty();
  }
  R.on('targetMoved', (t, done) => { if (t === current) renderInfo(); if (done) markDirty(); });
  // keep the x / y / size / direction boxes live while scripts move the sprite (like Scratch)
  setInterval(() => { if (!current || current.isStage || document.activeElement.closest('#sprite-info')) return; if (+$('#info-x').value !== Math.round(current.x) || +$('#info-y').value !== Math.round(current.y) || +$('#info-dir').value !== Math.round(current.direction) || +$('#info-size').value !== Math.round(current.size)) renderInfo(); }, 250);
  R.on('targetsChanged', () => { renderSprites(); });
  R.on('dirty', () => markDirty());
  R.on('costumesChanged', t => { if (t === current) { renderCostumes(); renderTag(); } renderSprites(); refreshToolbox(); markDirty(); });
  $('#stage').addEventListener('pointerup', () => { if (!R.running && !R.editorDragged) { const hit = R.spriteAt(R.mouse.x, R.mouse.y); if (hit && !hit.isClone && hit !== current) selectTarget(hit); } });
  $('#stage-tile').onclick = () => selectTarget(R.stage);

  /* ================= adding sprites ================= */
  function costumeFromSVG(name, svg) { return { name, src: Lib.svgToDataURL(svg) }; }
  function uniqueName(base) { let n = base, i = 2; while (R.originals().some(o => o.name === n)) n = base.replace(/\d+$/, '') + (i++); return n; }
  function addSprite(costumes, name, extra = {}) {
    const t = R.addSprite({ id: uid(), name: uniqueName(name || 'Sprite1'), x: Math.round(Math.random() * 200 - 100), y: Math.round(Math.random() * 120 - 60), costumes, currentCostume: 0, sounds: [{ name: 'Pop', preset: 'Pop' }], xml: '<xml></xml>', ...extra });
    selectTarget(t); refreshToolbox(); markDirty(); return t;
  }
  function duplicateSprite(t) {
    const data = t.toJSON(); data.id = uid(); data.name = uniqueName(t.name + '2'); data.x += 20; data.y -= 20;
    const n = R.addSprite(data); selectTarget(n); refreshToolbox(); markDirty();
  }
  function deleteSprite(t) {
    if (R.originals().length <= 1 && !confirm('Delete your last sprite?')) return;
    deletedSprites.push(t.toJSON()); if (deletedSprites.length > 5) deletedSprites.shift();
    R.removeSprite(t);
    if (current === t) selectTarget(R.originals()[0] || R.stage);
    refreshToolbox(); markDirty();
  }
  function restoreSprite() { const d = deletedSprites.pop(); if (!d) return; d.name = uniqueName(d.name); const t = R.addSprite(d); selectTarget(t); refreshToolbox(); markDirty(); }

  const EMOJIS = '😀 😎 🤖 👾 👻 🐱 🐶 🐸 🐵 🦊 🐼 🐧 🦄 🐲 🦖 🐢 🐙 🦀 🐝 🦋 ⭐ 🌟 ✨ 💎 🪙 💰 🍎 🍌 🍕 🍔 🎂 🧁 ❤️ 💙 💚 🔥 💧 ⚡ 🌈 ☁️ 🌙 ☀️ 🌵 🌲 🍄 🚀 🛸 ✈️ 🚗 🏎️ 🚂 ⚽ 🏀 🎯 🎮 🕹️ 🎲 🔑 🗝️ 🚪 🧱 🪨 🌳 🏠 🏰 ⚔️ 🛡️ 🏹 💣 🧲 🧪 🎁 🏆 🥇 🚩 🏁 ⬆️ ⬇️ ⬅️ ➡️ ❌ ✅ 💀 👑 🎩 👽 🧙 🧟 🦸 🦹'.split(' ');
  function emojiPicker(onPick) {
    openModal('Pick an emoji', `<div class="form"><input type="text" id="emoji-input" placeholder="…or type/paste any emoji here and press Enter"><div class="emoji-grid">${EMOJIS.map(e => `<button>${e}</button>`).join('')}</div></div>`);
    $$('.emoji-grid button').forEach(b => b.onclick = () => { closeModal(); onPick(b.textContent); });
    const inp = $('#emoji-input'); inp.focus(); inp.onkeydown = e => { e.stopPropagation(); if (e.key === 'Enter' && inp.value.trim()) { const v = inp.value.trim(); closeModal(); onPick(v); } };
  }
  function libraryPicker(kind, onPick) {
    // kind: 'costume' | 'backdrop' | 'sound'
    let color = Lib.COLORS[0];
    const render = (filter = '') => {
      const grid = $('#lib-grid'); if (!grid) return; grid.innerHTML = '';
      if (kind === 'sound') {
        for (const n of Lib.soundNames) { if (!n.toLowerCase().includes(filter)) continue; const d = document.createElement('div'); d.className = 'lib-item'; d.innerHTML = `<span class="big">🔊</span>${n}`; d.onmouseenter = () => previewPreset(n); d.onclick = () => { closeModal(); onPick({ name: n, preset: n }); }; grid.appendChild(d); }
      } else if (kind === 'backdrop') {
        for (const n of Lib.backdropNames) { if (!n.toLowerCase().includes(filter)) continue; const d = document.createElement('div'); d.className = 'lib-item backdrop'; d.innerHTML = `<img src="${Lib.svgToDataURL(Lib.backdropSVG(n))}">${n}`; d.onclick = () => { closeModal(); onPick(costumeFromSVG(n, Lib.backdropSVG(n))); }; grid.appendChild(d); }
      } else {
        for (const n of Lib.costumeNames) { if (!n.toLowerCase().includes(filter)) continue; const d = document.createElement('div'); d.className = 'lib-item'; d.innerHTML = `<img src="${Lib.svgToDataURL(Lib.costumeSVG(n, color))}">${n}`; d.onclick = () => { closeModal(); onPick(costumeFromSVG(n, Lib.costumeSVG(n, color)), n); }; grid.appendChild(d); }
      }
    };
    openModal(kind === 'sound' ? 'Choose a Sound' : kind === 'backdrop' ? 'Choose a Backdrop' : 'Choose a Sprite', `<div class="lib-filters" id="lib-filters">${kind === 'costume' ? Lib.COLORS.map(c => `<button style="background:${c}" data-c="${c}" class="${c === color ? 'active' : ''}"></button>`).join('') : ''}<input type="text" id="lib-search" placeholder="Search"></div><div class="lib-grid" id="lib-grid"></div>`);
    $$('#lib-filters button').forEach(b => b.onclick = () => { color = b.dataset.c; $$('#lib-filters button').forEach(x => x.classList.toggle('active', x === b)); render($('#lib-search').value.toLowerCase()); });
    $('#lib-search').oninput = e => render(e.target.value.toLowerCase()); $('#lib-search').onkeydown = e => e.stopPropagation();
    render();
  }
  /* ---- AI pixel art ---- */
  function renderPixels(data, scale) {
    const c = document.createElement('canvas'); c.width = data.w * scale; c.height = data.h * scale; const g = c.getContext('2d');
    data.rows.forEach((row, y) => { for (let x = 0; x < row.length; x++) { const col = data.palette[row[x]]; if (!col || row[x] === '.') continue; g.fillStyle = col; g.fillRect(x * scale, y * scale, scale, scale); } });
    return c.toDataURL();
  }
  function aiArtPicker(kind, onPick) {
    const isBackdrop = kind === 'backdrop';
    openModal(isBackdrop ? '✨ AI backdrop' : '✨ AI pixel art', `
      <div class="form">
        <label>What should it be?<input type="text" id="ai-prompt" placeholder="${isBackdrop ? 'a spooky forest at night' : 'a red dragon with small wings'}" autocomplete="off"></label>
        <div class="ai-opts">${isBackdrop ? '' : `<label>Size <select id="ai-size"><option value="16">16 × 16 (tiny)</option><option value="24" selected>24 × 24</option><option value="32">32 × 32 (detailed)</option></select></label><label>Type <select id="ai-style"><option>character</option><option>enemy / monster</option><option>item / pickup</option><option>weapon / tool</option><option>vehicle</option><option>block / tile</option><option>icon</option></select></label>`}<label>Colors <select id="ai-palette"><option>bright</option><option>pastel</option><option>dark & moody</option><option>retro 4-color</option><option>black & white</option></select></label></div>
        <div id="ai-preview" style="min-height:120px;display:flex;align-items:center;justify-content:center;background:repeating-conic-gradient(#f2f2f2 0 25%, #fff 0 50%) 0 0 / 20px 20px;border-radius:8px;border:1px solid var(--border)"><span style="opacity:.6">Describe it and press Generate — takes about 10 seconds</span></div>
        <div class="actions"><button class="btn" id="ai-cancel">Cancel</button><button class="btn" id="ai-gen">✨ Generate</button><button class="btn primary" id="ai-use" disabled>Use it</button></div>
      </div>`);
    let result = null, src = null;
    const inp = $('#ai-prompt'); inp.focus(); inp.onkeydown = e => { e.stopPropagation(); if (e.key === 'Enter') $('#ai-gen').click(); };
    $('#ai-cancel').onclick = closeModal;
    $('#ai-gen').onclick = async () => {
      const prompt = inp.value.trim(); if (!prompt) return inp.focus();
      const w = isBackdrop ? 48 : +$('#ai-size').value, h = isBackdrop ? 36 : w;
      const style = isBackdrop ? 'backdrop / scenery' : $('#ai-style').value, palette = $('#ai-palette').value;
      $('#ai-gen').disabled = true; $('#ai-gen').textContent = 'Drawing…'; $('#ai-preview').innerHTML = '<span style="opacity:.6">🎨 drawing pixels…</span>';
      try {
        const r = await fetch('/api/ai', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ prompt: `${style}: ${prompt}. Color palette: ${palette}.`, w, h, kind }) });
        const j = await r.json(); if (!r.ok) throw new Error(j.error || 'failed');
        result = j; src = renderPixels(j, isBackdrop ? 10 : Math.round(96 / w));
        $('#ai-preview').innerHTML = `<img src="${src}" style="image-rendering:pixelated;max-width:100%;max-height:260px">`; $('#ai-use').disabled = false;
      } catch (e) { $('#ai-preview').innerHTML = `<span style="color:#c00">Could not generate: ${esc(e.message)}</span>`; }
      $('#ai-gen').disabled = false; $('#ai-gen').textContent = '✨ Try again';
    };
    $('#ai-use').onclick = () => { if (!src) return; const name = inp.value.trim().slice(0, 24); closeModal(); onPick({ name, src }, name); };
  }

  function pickFile(accept, cb) { const fi = $('#file-input'); fi.accept = accept; fi.value = ''; fi.onchange = () => { const f = fi.files[0]; if (!f) return; const r = new FileReader(); r.onload = () => cb(r.result, f); r.readAsDataURL(f); }; fi.click(); }
  function blankCostume(name) { const c = document.createElement('canvas'); c.width = 2; c.height = 2; return { name, src: c.toDataURL() }; }

  function handleAdd(kind, what) {
    // kind: sprite | costume | backdrop | sound
    const target = kind === 'backdrop' ? R.stage : current;
    const addCostume = (c) => { target.costumes.push(c); target.currentCostume = target.costumes.length - 1; R.img(c); renderCostumes(); renderSprites(); renderTag(); refreshToolbox(); markDirty(); if (tab === 'costumes') loadPaint(); };
    switch (kind + ':' + what) {
      case 'sprite:library': libraryPicker('costume', (c, n) => addSprite([c], n)); break;
      case 'sprite:paint': addSprite([blankCostume('costume1')], 'Sprite1'); showTab('costumes'); break;
      case 'sprite:emoji': emojiPicker(e => addSprite([costumeFromSVG('costume1', Lib.emojiSVG(e))], 'Sprite1')); break;
      case 'sprite:text': addSprite([costumeFromSVG('costume1', Lib.textSVG('Hello', 28, '#333'))], 'Text'); break;
      case 'sprite:upload': pickFile('image/*', (src, f) => addSprite([{ name: f.name.replace(/\.\w+$/, ''), src }], f.name.replace(/\.\w+$/, '').slice(0, 20))); break;
      case 'sprite:ai': aiArtPicker('sprite', (c, n) => addSprite([{ ...c, name: 'costume1' }], n || 'Sprite1')); break;
      case 'costume:ai': if (current.isStage) return handleAdd('backdrop', 'ai'); aiArtPicker('sprite', c => addCostume({ ...c, name: uniqueCostume(target, c.name || 'costume1') })); break;
      case 'backdrop:ai': aiArtPicker('backdrop', c => addCostume({ ...c, name: uniqueCostume(target, c.name || 'backdrop1') })); break;
      case 'sprite:surprise': { const n = Lib.costumeNames[Math.floor(Math.random() * Lib.costumeNames.length)]; const c = Lib.COLORS[Math.floor(Math.random() * Lib.COLORS.length)]; addSprite([costumeFromSVG(n, Lib.costumeSVG(n, c))], n); break; }
      case 'costume:library': if (current.isStage) return handleAdd('backdrop', 'library'); libraryPicker('costume', c => addCostume({ ...c, name: uniqueCostume(target, c.name) })); break;
      case 'costume:paint': case 'backdrop:paint': addCostume(blankCostume(uniqueCostume(target, target.isStage ? 'backdrop1' : 'costume1'))); showTab('costumes'); break;
      case 'costume:emoji': emojiPicker(e => addCostume(costumeFromSVG(uniqueCostume(target, 'costume1'), Lib.emojiSVG(e)))); break;
      case 'costume:upload': case 'backdrop:upload': pickFile('image/*', (src, f) => addCostume({ name: uniqueCostume(target, f.name.replace(/\.\w+$/, '')), src })); break;
      case 'costume:surprise': { if (current.isStage) return handleAdd('backdrop', 'surprise'); const n = Lib.costumeNames[Math.floor(Math.random() * Lib.costumeNames.length)]; addCostume(costumeFromSVG(uniqueCostume(target, n), Lib.costumeSVG(n, Lib.COLORS[Math.floor(Math.random() * Lib.COLORS.length)]))); break; }
      case 'backdrop:library': libraryPicker('backdrop', c => addCostume({ ...c, name: uniqueCostume(target, c.name) })); break;
      case 'backdrop:surprise': { const n = Lib.backdropNames[Math.floor(Math.random() * Lib.backdropNames.length)]; addCostume(costumeFromSVG(uniqueCostume(target, n), Lib.backdropSVG(n))); break; }
      case 'sound:library': libraryPicker('sound', s => addSound({ ...s, name: uniqueSound(current, s.name) })); break;
      case 'sound:upload': pickFile('audio/*', (src, f) => addSound({ name: uniqueSound(current, f.name.replace(/\.\w+$/, '')), src })); break;
      case 'sound:record': recordSound(); break;
    }
  }
  function uniqueCostume(t, base) { let n = base, i = 2; while (t.costumes.some(c => c.name === n)) n = base.replace(/\d+$/, '') + (i++); return n; }
  function uniqueSound(t, base) { let n = base, i = 2; while (t.sounds.some(c => c.name === n)) n = base.replace(/\d+$/, '') + (i++); return n; }
  $$('.asset-add').forEach(a => {
    const kind = a.id === 'add-sprite-wrap' ? 'sprite' : a.querySelector('#add-sprite') ? 'sprite' : a.querySelector('#add-backdrop') ? 'backdrop' : a.querySelector('#add-sound') ? 'sound' : 'costume';
    // the round button opens the menu (tap friendly); the first menu item is the default action when the menu is already open
    a.querySelector('.add-btn').onclick = e => { e.stopPropagation(); const wasOpen = a.classList.contains('open'); $$('.asset-add').forEach(x => x.classList.remove('open')); if (!wasOpen) a.classList.add('open'); };
    a.querySelectorAll('.add-menu button').forEach(b => b.onclick = e => { e.stopPropagation(); a.classList.remove('open'); handleAdd(kind, b.dataset.add); });
  });

  /* ================= tabs ================= */
  function showTab(name) {
    tab = name;
    $$('.tab').forEach(t => t.classList.toggle('active', t.dataset.tab === name));
    $$('.panel').forEach(p => p.classList.toggle('active', p.id === 'panel-' + name));
    if (name === 'code') setTimeout(() => SB.svgResize(ws), 0);
    if (name === 'costumes') { renderCostumes(); loadPaint(); }
    if (name === 'sounds') renderSounds();
  }
  $$('.tab').forEach(t => t.onclick = () => showTab(t.dataset.tab));

  /* ================= costumes + paint editor ================= */
  function renderCostumes() {
    const list = $('#costume-list'); if (!current) return; list.innerHTML = '';
    current.costumes.forEach((c, i) => {
      const d = document.createElement('div'); d.className = 'asset-tile' + (i === current.currentCostume ? ' selected' : '');
      d.innerHTML = `<span class="num">${i + 1}</span><img src="${c.src}"><span class="nm">${esc(c.name)}</span><button class="del">✕</button>`;
      d.onclick = e => { if (e.target.classList.contains('del')) { if (current.costumes.length > 1) { current.costumes.splice(i, 1); current.currentCostume = Math.min(current.currentCostume, current.costumes.length - 1); renderCostumes(); renderSprites(); renderTag(); loadPaint(); markDirty(); } return; } current.currentCostume = i; renderCostumes(); renderSprites(); renderTag(); loadPaint(); markDirty(); };
      list.appendChild(d);
    });
    $('#costume-name').value = current.costume ? current.costume.name : '';
  }
  $('#costume-name').onchange = e => { if (current.costume) { current.costume.name = e.target.value.trim() || current.costume.name; renderCostumes(); refreshToolbox(); markDirty(); } };
  $('#costume-name').onkeydown = e => e.stopPropagation();

  const P = { tool: 'brush', color: '#4C97FF', outline: '#000000', outlineWidth: 0, size: 8, undo: [], redo: [], drawing: false, start: null, snapshot: null, loadedSrc: null };
  const pc = $('#paint-canvas'), pctx = pc.getContext('2d');
  $('#swatches').innerHTML = [...Lib.COLORS, '#f44336', '#ffeb3b', '#000000', 'transparent'].map(c => `<button data-c="${c}" style="background:${c === 'transparent' ? 'repeating-conic-gradient(#ccc 0 25%, #fff 0 50%) 0 0 / 8px 8px' : c}" title="${c}"></button>`).join('');
  $$('#swatches button').forEach(b => b.onclick = () => { P.color = b.dataset.c; if (P.color !== 'transparent') $('#paint-color').value = P.color; $('#fill-swatch').style.background = P.color === 'transparent' ? 'repeating-conic-gradient(#ccc 0 25%, #fff 0 50%) 0 0 / 8px 8px' : ''; $$('#swatches button').forEach(x => x.classList.toggle('active', x === b)); });
  $('#paint-color').oninput = e => { P.color = e.target.value; $('#fill-swatch').style.background = ''; $$('#swatches button').forEach(x => x.classList.remove('active')); };
  $('#paint-outline').oninput = e => P.outline = e.target.value;
  $('#paint-outline-width').oninput = e => P.outlineWidth = Math.max(0, +e.target.value || 0);
  $('#paint-size').oninput = e => P.size = +e.target.value;
  $$('.paint-tools [data-tool]').forEach(b => b.onclick = () => { P.tool = b.dataset.tool; $$('.paint-tools [data-tool]').forEach(x => x.classList.toggle('active', x === b)); pc.style.cursor = P.tool === 'select' ? 'move' : 'crosshair'; });
  $('#paint-undo').onclick = () => { const s = P.undo.pop(); if (s) { P.redo.push(pctx.getImageData(0, 0, pc.width, pc.height)); pctx.putImageData(s, 0, 0); commitPaint(); } };
  $('#paint-redo').onclick = () => { const s = P.redo.pop(); if (s) { P.undo.push(pctx.getImageData(0, 0, pc.width, pc.height)); pctx.putImageData(s, 0, 0); commitPaint(); } };
  $('#paint-clear').onclick = () => { pushUndo(); pctx.clearRect(0, 0, pc.width, pc.height); commitPaint(); };
  const transformCanvas = fn => { pushUndo(); const tmp = document.createElement('canvas'); tmp.width = pc.width; tmp.height = pc.height; tmp.getContext('2d').drawImage(pc, 0, 0); pctx.clearRect(0, 0, pc.width, pc.height); pctx.save(); fn(tmp); pctx.restore(); commitPaint(); };
  $('#paint-flip').onclick = () => transformCanvas(tmp => { pctx.translate(pc.width, 0); pctx.scale(-1, 1); pctx.drawImage(tmp, 0, 0); });
  $('#paint-flipv').onclick = () => transformCanvas(tmp => { pctx.translate(0, pc.height); pctx.scale(1, -1); pctx.drawImage(tmp, 0, 0); });
  $('#paint-center').onclick = () => { const b = contentBounds(); if (!b) return; transformCanvas(tmp => pctx.drawImage(tmp, Math.round(pc.width / 2 - (b.x0 + b.x1 + 1) / 2), Math.round(pc.height / 2 - (b.y0 + b.y1 + 1) / 2))); };
  function contentBounds() { const d = pctx.getImageData(0, 0, pc.width, pc.height).data; let x0 = pc.width, y0 = pc.height, x1 = -1, y1 = -1; for (let y = 0; y < pc.height; y++) for (let x = 0; x < pc.width; x++) if (d[(y * pc.width + x) * 4 + 3] > 0) { if (x < x0) x0 = x; if (x > x1) x1 = x; if (y < y0) y0 = y; if (y > y1) y1 = y; } return x1 < 0 ? null : { x0, y0, x1, y1 }; }
  function pushUndo() { P.undo.push(pctx.getImageData(0, 0, pc.width, pc.height)); if (P.undo.length > 30) P.undo.shift(); P.redo = []; }
  function loadPaint() {
    if (!current || !current.costume) return;
    const c = current.costume; if (P.loadedSrc === c.src) return;
    P.loadedSrc = c.src; P.undo = [];
    pctx.clearRect(0, 0, pc.width, pc.height);
    const im = new Image(); im.onload = () => {
      if (P.loadedSrc !== c.src) return;
      let w = im.naturalWidth, h = im.naturalHeight; if (!w || !h) return;
      if (current.isStage) { pctx.drawImage(im, 0, 0, pc.width, pc.height); return; }
      const k = Math.min(1, (pc.width - 20) / w, (pc.height - 20) / h); w *= k; h *= k;
      pctx.drawImage(im, pc.width / 2 - w / 2, pc.height / 2 - h / 2, w, h);
    }; im.src = c.src;
  }
  function commitPaint() {
    if (!current || !current.costume) return;
    const c = current.costume;
    let src;
    if (current.isStage) src = pc.toDataURL();
    else {
      // crop to content, keep the drawing centred on the sprite's position
      const b = contentBounds();
      if (!b) { src = blankCostume('').src; c.w = c.h = 2; c.cx = c.cy = 1; }
      else {
        const { x0, y0, x1, y1 } = b; const w = x1 - x0 + 1, h = y1 - y0 + 1; const out = document.createElement('canvas'); out.width = w; out.height = h; out.getContext('2d').drawImage(pc, x0, y0, w, h, 0, 0, w, h);
        src = out.toDataURL(); c.w = w; c.h = h; c.cx = pc.width / 2 - x0; c.cy = pc.height / 2 - y0;
      }
    }
    c.src = src; P.loadedSrc = src; R.img(c); renderCostumes(); renderSprites(); renderTag(); markDirty();
  }
  const ppos = e => { const r = pc.getBoundingClientRect(); return { x: (e.clientX - r.left) / r.width * pc.width, y: (e.clientY - r.top) / r.height * pc.height }; };
  pc.addEventListener('pointerdown', e => {
    pc.setPointerCapture(e.pointerId); const p = ppos(e); pushUndo(); P.drawing = true; P.start = p; P.snapshot = pctx.getImageData(0, 0, pc.width, pc.height);
    pctx.lineCap = pctx.lineJoin = 'round'; pctx.lineWidth = P.size;
    if (P.tool === 'fill') { floodFill(Math.floor(p.x), Math.floor(p.y)); P.drawing = false; commitPaint(); return; }
    if (P.tool === 'text') { P.drawing = false; paintTextAt(p); return; }
    if (P.tool === 'select') { P.snapCanvas = document.createElement('canvas'); P.snapCanvas.width = pc.width; P.snapCanvas.height = pc.height; P.snapCanvas.getContext('2d').drawImage(pc, 0, 0); return; }
    if (P.tool === 'brush' || P.tool === 'eraser') { strokeTo(p, p); }
  });
  pc.addEventListener('pointermove', e => {
    if (!P.drawing) return; const p = ppos(e);
    if (P.tool === 'brush' || P.tool === 'eraser') { strokeTo(P.start, p); P.start = p; return; }
    if (P.tool === 'select') { pctx.clearRect(0, 0, pc.width, pc.height); pctx.drawImage(P.snapCanvas, Math.round(p.x - P.start.x), Math.round(p.y - P.start.y)); return; }
    pctx.putImageData(P.snapshot, 0, 0); drawShape(P.start, p);
  });
  const endStroke = () => { if (P.drawing) { P.drawing = false; pctx.globalCompositeOperation = 'source-over'; commitPaint(); } };
  pc.addEventListener('pointerup', endStroke); pc.addEventListener('pointercancel', endStroke);
  function strokeTo(a, b) {
    pctx.globalCompositeOperation = P.tool === 'eraser' || P.color === 'transparent' ? 'destination-out' : 'source-over';
    pctx.strokeStyle = P.color === 'transparent' ? '#000' : P.color; pctx.lineWidth = P.size; pctx.beginPath(); pctx.moveTo(a.x, a.y); pctx.lineTo(b.x + 0.01, b.y + 0.01); pctx.stroke();
  }
  function drawShape(a, b) {
    pctx.globalCompositeOperation = 'source-over'; pctx.lineJoin = 'round';
    if (P.tool === 'line') { pctx.globalCompositeOperation = P.color === 'transparent' ? 'destination-out' : 'source-over'; pctx.strokeStyle = P.color === 'transparent' ? '#000' : P.color; pctx.beginPath(); pctx.moveTo(a.x, a.y); pctx.lineTo(b.x, b.y); pctx.lineWidth = P.size; pctx.stroke(); return; }
    pctx.beginPath();
    if (P.tool === 'rect') { const x = Math.min(a.x, b.x), y = Math.min(a.y, b.y), w = Math.abs(b.x - a.x), h = Math.abs(b.y - a.y); pctx.rect(x, y, w, h); }
    else if (P.tool === 'ellipse') pctx.ellipse((a.x + b.x) / 2, (a.y + b.y) / 2, Math.abs(b.x - a.x) / 2, Math.abs(b.y - a.y) / 2, 0, 0, Math.PI * 2);
    if (P.color === 'transparent') { pctx.globalCompositeOperation = 'destination-out'; pctx.fillStyle = '#000'; pctx.fill(); pctx.globalCompositeOperation = 'source-over'; }
    else { pctx.fillStyle = P.color; pctx.fill(); }
    if (P.outlineWidth > 0) { pctx.strokeStyle = P.outline; pctx.lineWidth = P.outlineWidth; pctx.stroke(); }
  }
  // text tool: type directly on the canvas (Enter commits, Escape cancels)
  function paintTextAt(p) {
    const wrap = $('.paint-canvas-wrap'); const old = wrap.querySelector('.paint-text-input'); if (old) old.remove();
    const r = pc.getBoundingClientRect(), wr = wrap.getBoundingClientRect(); const scale = r.width / pc.width; const fontPx = P.size * 4 + 8;
    const inp = document.createElement('input'); inp.className = 'paint-text-input'; inp.placeholder = 'type, then Enter';
    inp.style.cssText = `position:absolute; left:${r.left - wr.left + p.x * scale}px; top:${r.top - wr.top + (p.y - fontPx / 2) * scale}px; font: bold ${fontPx * scale}px Helvetica, Arial, sans-serif; color:${P.color === 'transparent' ? '#000' : P.color}; background:rgba(255,255,255,0.7); border:1px dashed var(--blue); padding:0 4px; min-width:120px; z-index:5; outline:none`;
    wrap.style.position = 'relative'; wrap.appendChild(inp); inp.focus();
    const commit = () => { const t = inp.value; inp.remove(); if (!t) return; pctx.globalCompositeOperation = 'source-over'; pctx.font = `bold ${fontPx}px Helvetica, Arial, sans-serif`; pctx.textBaseline = 'middle'; if (P.outlineWidth > 0) { pctx.strokeStyle = P.outline; pctx.lineWidth = P.outlineWidth * 2; pctx.lineJoin = 'round'; pctx.strokeText(t, p.x, p.y); } if (P.color !== 'transparent') { pctx.fillStyle = P.color; pctx.fillText(t, p.x, p.y); } commitPaint(); };
    inp.onkeydown = e => { e.stopPropagation(); if (e.key === 'Enter') commit(); if (e.key === 'Escape') inp.remove(); }; inp.onblur = () => setTimeout(() => { if (inp.isConnected) commit(); }, 0);
  }
  function floodFill(sx, sy) {
    const W = pc.width, H = pc.height, img = pctx.getImageData(0, 0, W, H), d = img.data;
    const i0 = (sy * W + sx) * 4, tr = d[i0], tg = d[i0 + 1], tb = d[i0 + 2], ta = d[i0 + 3];
    const col = P.color === 'transparent' ? [0, 0, 0, 0] : [...R.parseColor(P.color), 255];
    if (tr === col[0] && tg === col[1] && tb === col[2] && ta === col[3]) return;
    const match = i => Math.abs(d[i] - tr) < 40 && Math.abs(d[i + 1] - tg) < 40 && Math.abs(d[i + 2] - tb) < 40 && Math.abs(d[i + 3] - ta) < 40;
    const stack = [sx + sy * W]; const seen = new Uint8Array(W * H);
    while (stack.length) { const p = stack.pop(); if (seen[p]) continue; seen[p] = 1; const i = p * 4; if (!match(i)) continue; d[i] = col[0]; d[i + 1] = col[1]; d[i + 2] = col[2]; d[i + 3] = col[3]; const x = p % W; if (x > 0) stack.push(p - 1); if (x < W - 1) stack.push(p + 1); if (p >= W) stack.push(p - W); if (p < W * (H - 1)) stack.push(p + W); }
    pctx.putImageData(img, 0, 0);
  }

  /* ================= sounds ================= */
  let selectedSound = 0, previewSrc = null;
  function renderSounds() {
    const list = $('#sound-list'); if (!current) return; list.innerHTML = '';
    current.sounds.forEach((s, i) => {
      const d = document.createElement('div'); d.className = 'asset-tile' + (i === selectedSound ? ' selected' : '');
      d.innerHTML = `<span class="num">${i + 1}</span><span class="snd">${s.preset ? '🎵' : '🎤'}</span><span class="nm">${esc(s.name)}</span><button class="del">✕</button>`;
      d.onclick = e => { if (e.target.classList.contains('del')) { current.sounds.splice(i, 1); selectedSound = 0; renderSounds(); refreshToolbox(); markDirty(); return; } selectedSound = i; renderSounds(); playSound(s); };
      list.appendChild(d);
    });
    const s = current.sounds[selectedSound]; $('#sound-detail').style.visibility = s ? 'visible' : 'hidden'; if (s) { $('#sound-name').value = s.name; drawWave(s); }
  }
  $('#sound-name').onchange = e => { const s = current.sounds[selectedSound]; if (s) { s.name = e.target.value.trim() || s.name; renderSounds(); refreshToolbox(); markDirty(); } };
  $('#sound-name').onkeydown = e => e.stopPropagation();
  $('#sound-play').onclick = () => { const s = current.sounds[selectedSound]; if (s) playSound(s); };
  function addSound(s) { current.sounds.push(s); selectedSound = current.sounds.length - 1; R.audio.buffer(s); renderSounds(); refreshToolbox(); markDirty(); }
  /* ---- sound effects (like Scratch's sound editor) ---- */
  function bufferToWav(buf) {
    const n = buf.length, ch = 1, sr = buf.sampleRate, data = buf.getChannelData(0); const ab = new ArrayBuffer(44 + n * 2), v = new DataView(ab);
    const str = (o, s) => { for (let i = 0; i < s.length; i++) v.setUint8(o + i, s.charCodeAt(i)); };
    str(0, 'RIFF'); v.setUint32(4, 36 + n * 2, true); str(8, 'WAVE'); str(12, 'fmt '); v.setUint32(16, 16, true); v.setUint16(20, 1, true); v.setUint16(22, ch, true); v.setUint32(24, sr, true); v.setUint32(28, sr * 2, true); v.setUint16(32, 2, true); v.setUint16(34, 16, true); str(36, 'data'); v.setUint32(40, n * 2, true);
    for (let i = 0; i < n; i++) { const s = Math.max(-1, Math.min(1, data[i])); v.setInt16(44 + i * 2, s < 0 ? s * 0x8000 : s * 0x7FFF, true); }
    let bin = ''; const bytes = new Uint8Array(ab); for (let i = 0; i < bytes.length; i += 8192) bin += String.fromCharCode.apply(null, bytes.subarray(i, i + 8192));
    return 'data:audio/wav;base64,' + btoa(bin);
  }
  let soundUndo = null;
  async function applySoundFx(fx) {
    const s = current && current.sounds[selectedSound]; if (!s) return;
    const src = await R.audio.buffer(s); if (!src) return;
    const ctx = R.audio.ctx(); const sr = src.sampleRate; const d = src.getChannelData(0); let out;
    const make = (len, fn) => { const b = ctx.createBuffer(1, Math.max(1, Math.floor(len)), sr); const o = b.getChannelData(0); for (let i = 0; i < o.length; i++) o[i] = fn(i); return b; };
    switch (fx) {
      case 'faster': out = make(d.length / 1.25, i => d[Math.floor(i * 1.25)] || 0); break;
      case 'slower': out = make(d.length * 1.25, i => d[Math.floor(i / 1.25)] || 0); break;
      case 'louder': out = make(d.length, i => d[i] * 1.5); break;
      case 'softer': out = make(d.length, i => d[i] * 0.6); break;
      case 'mute': out = make(d.length, () => 0); break;
      case 'fadein': out = make(d.length, i => d[i] * Math.min(1, i / (sr * 0.5))); break;
      case 'fadeout': out = make(d.length, i => d[i] * Math.min(1, (d.length - i) / (sr * 0.5))); break;
      case 'reverse': out = make(d.length, i => d[d.length - 1 - i]); break;
      case 'robot': out = make(d.length, i => d[i] * (Math.sin(i / sr * 2 * Math.PI * 60) > 0 ? 1 : -0.6)); break;
      case 'echo': out = make(d.length + sr * 0.6, i => (d[i] || 0) + 0.45 * (d[i - Math.floor(sr * 0.2)] || 0) + 0.25 * (d[i - Math.floor(sr * 0.4)] || 0)); break;
      default: return;
    }
    soundUndo = { index: selectedSound, src: s.src, preset: s.preset };
    s.src = bufferToWav(out); delete s.preset; R.audio.buffers.delete(s.src);
    renderSounds(); playSound(s); markDirty();
  }
  $$('.sound-fx button').forEach(b => b.onclick = () => applySoundFx(b.dataset.fx));
  $('#sound-undo').onclick = () => { if (!soundUndo || !current) return; const s = current.sounds[soundUndo.index]; if (!s) return; s.src = soundUndo.src; if (soundUndo.preset) s.preset = soundUndo.preset; else delete s.preset; soundUndo = null; renderSounds(); markDirty(); };
  function playSound(s) { R.audio.play(current, s); }
  function previewPreset(n) { R.audio.play(R.stage, { name: n, preset: n }); }
  function stopPreview() { if (previewSrc) { try { previewSrc.stop(); } catch (e) {} previewSrc = null; } }
  async function drawWave(s) {
    const cv = $('#sound-wave'), c = cv.getContext('2d'); c.clearRect(0, 0, cv.width, cv.height);
    const buf = await R.audio.buffer(s); if (!buf) return; const d = buf.getChannelData(0), step = Math.ceil(d.length / cv.width);
    c.fillStyle = '#CF63CF'; for (let x = 0; x < cv.width; x++) { let m = 0; for (let j = 0; j < step; j++) m = Math.max(m, Math.abs(d[x * step + j] || 0)); const h = Math.max(2, m * cv.height * 0.9); c.fillRect(x, cv.height / 2 - h / 2, 1, h); }
    c.fillStyle = '#575e75'; c.font = '12px Helvetica, Arial, sans-serif'; c.fillText((buf.duration).toFixed(2) + ' s', 8, 16);
  }
  async function recordSound() {
    if (!navigator.mediaDevices) return alert('Recording needs microphone access (https or localhost).');
    openModal('Record Sound', `<div class="form" style="align-items:center"><div id="rec-status" style="font-size:40px">🎤</div><p id="rec-text">Click Record and make some noise!</p><div class="actions"><button class="btn" id="rec-cancel">Cancel</button><button class="btn primary" id="rec-btn">● Record</button></div></div>`);
    let rec = null, chunks = [], stream = null;
    $('#rec-cancel').onclick = () => { if (rec && rec.state === 'recording') rec.stop(); stream && stream.getTracks().forEach(t => t.stop()); closeModal(); };
    $('#rec-btn').onclick = async () => {
      if (!rec) {
        try { stream = await navigator.mediaDevices.getUserMedia({ audio: true }); } catch (e) { return alert('Microphone blocked: ' + e.message); }
        rec = new MediaRecorder(stream); chunks = [];
        rec.ondataavailable = e => chunks.push(e.data);
        rec.onstop = () => { stream.getTracks().forEach(t => t.stop()); const blob = new Blob(chunks, { type: rec.mimeType }); const r = new FileReader(); r.onload = () => { closeModal(); addSound({ name: uniqueSound(current, 'recording1'), src: r.result }); }; r.readAsDataURL(blob); };
        rec.start(); $('#rec-btn').textContent = '■ Stop'; $('#rec-text').textContent = 'Recording… click Stop when done.'; $('#rec-status').textContent = '🔴';
      } else rec.stop();
    };
  }

  /* ================= run controls ================= */
  $('#btn-flag').onclick = () => { if (!loadingWs && current) saveWorkspace.flush ? saveWorkspace.flush() : null; R.greenFlag(); };
  $('#btn-stop').onclick = () => R.stopAll();
  R.on('runStateChanged', on => $('#btn-flag').classList.toggle('active', on));
  $$('.size-btn[data-size]').forEach(b => b.onclick = () => { document.body.classList.toggle('small-stage', b.dataset.size === 'small'); $$('.size-btn[data-size]').forEach(x => x.classList.toggle('active', x === b)); setTimeout(() => SB.svgResize(ws), 0); });
  function enterPlayer() { document.body.classList.add('player-mode'); if (!R.running) R.greenFlag(); }
  function exitPlayer() { document.body.classList.remove('player-mode'); if (document.fullscreenElement) document.exitFullscreen().catch(() => {}); setTimeout(() => SB.svgResize(ws), 0); }
  $('#btn-player').onclick = enterPlayer;
  $('#btn-fullscreen').onclick = () => { enterPlayer(); document.documentElement.requestFullscreen && document.documentElement.requestFullscreen().catch(() => {}); };
  $('#exit-player').onclick = exitPlayer;
  document.addEventListener('keydown', e => { if (e.key === 'Escape' && document.body.classList.contains('player-mode')) exitPlayer(); });
  let frames = 0, lastFps = performance.now(); (function fps() { frames++; const now = performance.now(); if (now - lastFps > 1000) { $('#fps').textContent = R.running ? frames + ' fps' : ''; frames = 0; lastFps = now; } requestAnimationFrame(fps); })();

  /* ================= project I/O ================= */
  function defaultProject() {
    return {
      name: 'Untitled game',
      stage: { name: 'Stage', costumes: [costumeFromSVG('Sky', Lib.backdropSVG('Sky'))], currentCostume: 0, sounds: [], xml: '<xml></xml>', variables: [] },
      sprites: [{ id: uid(), name: 'Sprite1', x: 0, y: 0, direction: 90, size: 100, visible: true, costumes: [costumeFromSVG('Hero', Lib.costumeSVG('Hero', '#4C97FF'))], currentCostume: 0, sounds: [{ name: 'Jump', preset: 'Jump' }, { name: 'Pop', preset: 'Pop' }], xml: '<xml></xml>', variables: [] }],
      monitors: []
    };
  }
  function loadProject(p) {
    current = null; P.loadedSrc = null; deletedSprites = [];
    R.loadProject(p);
    SparkBlocks.setEnabled([...(p.extensions || []), ...SparkBlocks.extensionsUsed([p.stage && p.stage.xml, ...(p.sprites || []).map(s => s.xml)])]);
    $('#project-title').value = p.name || 'Untitled game';
    selectTarget(R.originals()[0] || R.stage);
    renderSprites(); refreshToolbox(); setStatus('Saved');
  }
  function currentProject() {
    if (current && ws && !loadingWs) { const dom = SB.Xml.workspaceToDom(ws); syncVariables(dom); current.xml = SB.Xml.domToText(dom); }
    R.projectName = $('#project-title').value.trim() || 'Untitled game';
    const proj = R.serialize(); proj.extensions = [...SparkBlocks.enabled]; return proj;
  }
  /* ---- My Projects: every project lives in the browser under its own id ---- */
  const PIDX = 'spark:projects';
  function projectIndex() { try { return JSON.parse(localStorage.getItem(PIDX) || '[]'); } catch (e) { return []; } }
  function saveIndex(list) { localStorage.setItem(PIDX, JSON.stringify(list)); }
  function thumbnail() { try { const c = document.createElement('canvas'); c.width = 160; c.height = 120; c.getContext('2d').drawImage(R.canvas, 0, 0, 160, 120); return c.toDataURL('image/jpeg', 0.6); } catch (e) { return ''; } }
  function saveCurrentProject() {
    const p = currentProject(); if (!R.projectId) R.projectId = uid();
    localStorage.setItem('spark:project:' + R.projectId, JSON.stringify(p));
    const list = projectIndex().filter(e => e.id !== R.projectId); list.unshift({ id: R.projectId, name: p.name, updated: Date.now(), thumb: thumbnail(), sprites: p.sprites.length }); saveIndex(list.slice(0, 200));
    localStorage.setItem('spark:current', R.projectId);
  }
  function openProjectById(id) { try { const p = JSON.parse(localStorage.getItem('spark:project:' + id)); if (!p) return false; loadProject(p); R.projectId = id; localStorage.setItem('spark:current', id); setStatus('Saved'); return true; } catch (e) { return false; } }
  function deleteProjectById(id) { localStorage.removeItem('spark:project:' + id); saveIndex(projectIndex().filter(e => e.id !== id)); }
  function projectsPicker() {
    const list = projectIndex();
    const fmt = t => { const d = new Date(t); return d.toLocaleDateString() + ' ' + d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }); };
    openModal('My Projects', `<div class="form"><div class="proj-actions"><button class="btn primary" id="proj-new">+ New project</button><button class="btn" id="proj-import">Load from your computer…</button><span class="hint" style="margin-left:auto">${list.length} project${list.length === 1 ? '' : 's'} saved in this browser</span></div>
      <div class="lib-grid proj-grid">${list.map(e => `<div class="lib-item proj ${e.id === R.projectId ? 'current' : ''}" data-id="${e.id}">${e.thumb ? `<img src="${e.thumb}">` : '<span class="big">🎮</span>'}<b>${esc(e.name)}</b><small>${fmt(e.updated)} · ${e.sprites} sprite${e.sprites === 1 ? '' : 's'}</small><div class="proj-btns"><button data-do="open">Open</button><button data-do="dup" title="Duplicate">⧉</button><button data-do="del" title="Delete">🗑</button></div></div>`).join('') || '<p class="hint">No projects yet — make something and it saves here automatically.</p>'}</div></div>`);
    $('#proj-new').onclick = () => { closeModal(); saveCurrentProject(); R.projectId = null; loadProject(defaultProject()); markDirty(); };
    $('#proj-import').onclick = () => { closeModal(); menuAction('load'); };
    $$('.proj-grid .proj').forEach(card => {
      const id = card.dataset.id;
      card.querySelector('[data-do=open]').onclick = e => { e.stopPropagation(); closeModal(); if (id !== R.projectId) { saveCurrentProject(); openProjectById(id); } };
      card.onclick = () => { closeModal(); if (id !== R.projectId) { saveCurrentProject(); openProjectById(id); } };
      card.querySelector('[data-do=dup]').onclick = e => { e.stopPropagation(); const raw = localStorage.getItem('spark:project:' + id); if (!raw) return; const nid = uid(); const p = JSON.parse(raw); p.name = p.name + ' copy'; localStorage.setItem('spark:project:' + nid, JSON.stringify(p)); const entry = projectIndex().find(x => x.id === id); saveIndex([{ ...entry, id: nid, name: p.name, updated: Date.now() }, ...projectIndex()]); projectsPicker(); };
      card.querySelector('[data-do=del]').onclick = e => { e.stopPropagation(); if (!confirm('Delete this project? This cannot be undone.')) return; deleteProjectById(id); if (id === R.projectId) { R.projectId = null; loadProject(defaultProject()); markDirty(); } projectsPicker(); };
    });
  }
  let dirty = false;
  const autosave = debounce(() => { try { saveCurrentProject(); setStatus('Saved'); } catch (e) { setStatus('Too big to autosave — use File › Save'); } }, 1200);
  function markDirty() { dirty = true; setStatus('Saving…'); autosave(); }
  function setStatus(s) { $('#save-status').textContent = s; }
  $('#project-title').onchange = markDirty; $('#project-title').onkeydown = e => e.stopPropagation();
  function download(text, name, type) { const a = document.createElement('a'); a.href = URL.createObjectURL(new Blob([text], { type })); a.download = name; a.click(); setTimeout(() => URL.revokeObjectURL(a.href), 2000); }
  const safeName = s => (s || 'game').replace(/[^\w\- ]+/g, '').trim() || 'game';
  async function exportHTML() { const p = currentProject(); download(await buildExportHTML(p), safeName(p.name) + '.html', 'text/html'); }
  async function buildExportHTML(p) {
    const files = await Promise.all(['js/library.js', 'js/compiler.js', 'js/runtime.js', 'js/features.js', 'js/multiplayer.js'].map(f => fetch(f).then(r => r.text())));
    const html = `<!DOCTYPE html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${esc(p.name)}</title>
<style>html,body{margin:0;height:100%;background:#111;overflow:hidden;font-family:Helvetica,Arial,sans-serif}#wrap{position:absolute;left:50%;top:50%;transform:translate(-50%,-50%);width:min(100vw,133.33vh);height:min(75vw,100vh);background:#fff}canvas{width:100%;height:100%;display:block;touch-action:none}#ov{position:absolute;inset:0;pointer-events:none}#ov>*{pointer-events:auto}.spark-ask{position:absolute;left:8px;right:8px;bottom:8px;display:flex;gap:6px;background:#fff;border:2px solid #4C97FF;border-radius:10px;padding:6px}.spark-ask input{flex:1;border:1px solid #ccc;border-radius:8px;padding:6px 10px;font-size:14px}.spark-ask button{border:0;background:#4C97FF;color:#fff;border-radius:50%;width:32px;height:32px;font-weight:700}#start{position:absolute;inset:0;display:flex;align-items:center;justify-content:center;background:rgba(0,0,0,.45);cursor:pointer}#start div{width:120px;height:120px;border-radius:50%;background:#fff;display:flex;align-items:center;justify-content:center;box-shadow:0 6px 24px rgba(0,0,0,.4)}#start svg{width:70px}#title{position:absolute;bottom:14px;left:0;right:0;text-align:center;color:#fff;font-weight:700;font-size:20px;text-shadow:0 2px 6px #000}</style></head>
<body><div id="wrap"><canvas id="stage"></canvas><div id="ov"></div><div id="start"><div><svg viewBox="0 0 24 24"><path d="M5 3v18" stroke="#45993d" stroke-width="2" fill="none"/><path d="M6 4h11l-3 4 3 4H6z" fill="#4cbf56"/></svg></div><div id="title">${esc(p.name)}</div></div></div>
<script>${files.join('\n;\n')}<\/script>
<script>window.SPARK_CLOUD_URL=${JSON.stringify(location.origin)};const project=${JSON.stringify(p).replace(/<\//g, '<\\/')};
const R=window.R=new SparkRuntime(document.getElementById('stage'),{overlay:document.getElementById('ov')});R.loadProject(project);
document.getElementById('start').onclick=function(){this.remove();R.greenFlag();};<\/script></body></html>`;
    return html;
  }
  function loadExample(key) {
    const p = window.SparkExamples && window.SparkExamples[key] && window.SparkExamples[key]();
    if (!p) return alert('Example not found');
    loadProject(p); markDirty();
    for (const t of R.allTargets()) { if (t === current) continue; const w = new SB.Workspace(); try { SB.Xml.domToWorkspace(workspaceXMLFor(t), w); w.cleanUp(); t.xml = SB.Xml.domToText(SB.Xml.workspaceToDom(w)); } catch (e) {} w.dispose(); }
    ws.cleanUp();
  }

  /* ================= menus ================= */
  $$('.menu').forEach(m => {
    m.querySelector('.menu-btn').onclick = e => { e.stopPropagation(); const open = m.classList.contains('open'); $$('.menu').forEach(x => x.classList.remove('open')); if (!open) m.classList.add('open'); };
    m.querySelectorAll('.dropdown button').forEach(b => b.onclick = e => { e.stopPropagation(); $$('.menu').forEach(x => x.classList.remove('open')); menuAction(b.dataset.act); });
  });
  document.addEventListener('pointerdown', e => { if (!e.target.closest('.menu')) $$('.menu').forEach(x => x.classList.remove('open')); if (!e.target.closest('.asset-add')) $$('.asset-add').forEach(x => x.classList.remove('open')); });
  function menuAction(act) {
    switch (act) {
      case 'new': saveCurrentProject(); R.projectId = null; loadProject(defaultProject()); markDirty(); break;
      case 'load': pickFile('.json,.spark,application/json', (src, f) => { fetch(src).then(r => r.json()).then(p => { if (p.sprites && p.stage) { saveCurrentProject(); R.projectId = null; loadProject(p); markDirty(); } else if (p.costumes) { p.id = uid(); p.name = uniqueName(p.name); const t = R.addSprite(p); selectTarget(t); refreshToolbox(); markDirty(); } else alert('Not a Spark project'); }).catch(e => alert('Could not load: ' + e.message)); }); break;
      case 'save': { const p = currentProject(); download(JSON.stringify(p), safeName(p.name) + '.spark.json', 'application/json'); setStatus('Saved'); break; }
      case 'projects': projectsPicker(); break;
      case 'export': exportHTML(); break;
      case 'restore': restoreSprite(); break;
      case 'cleanup': ws.cleanUp(); break;
      case 'turbo': R.turbo = !R.turbo; alert('Turbo mode is ' + (R.turbo ? 'on' : 'off') + ' (loops run as fast as possible)'); break;
      default: if (act && act.startsWith('ex-')) loadExample(act.slice(3));
    }
  }
  $('#btn-help').onclick = () => openModal('Help', `<div class="help">
    <p><b>Spark</b> works just like Scratch 3.0 — drag blocks from the left into the middle, click the green flag to run. Click a block or script to run it; click a reporter to see its value; tick the box next to a variable to show it on the stage.</p>
    <p>Everything beyond Scratch is an <b>extension</b>: press the blue puzzle button at the bottom-left of the palette and add the ones you want (they are added automatically when you open a project that uses them).</p>
    <h3>Physics</h3><p><code>turn physics platformer</code> gives a sprite gravity. Mark floors with <code>make this sprite solid</code>. <code>move with arrow keys</code> in a forever loop is a complete player controller (it also works with a game controller).</p>
    <h3>Camera</h3><p><code>camera follow Sprite</code> makes a scrolling level — the world is much bigger than the screen. Use <code>this sprite stays on screen</code> for score labels and buttons.</p>
    <h3>Game</h3><p>Built-in <code>score</code>, <code>lives</code>, <code>health</code>, <code>coins</code>, <code>level</code> with <code>show score on screen</code>. <code>game over</code> / <code>you win</code> show a screen with a Play again button. <code>when lives = 0</code> is a hat block. High scores are saved automatically.</p>
    <h3>Effects</h3><p>Particle bursts and trails, screen shake, flash, fade, slow motion, drop shadows, glow, hit-flash.</p>
    <h3>Text &amp; Speech</h3><p><code>show text</code> turns any sprite into a label. <code>speak</code> uses your computer's voice.</p>
    <h3>Controller</h3><p>Plug in an Xbox/PlayStation controller: buttons, sticks, rumble.</p>
    <h3>Multiplayer</h3><p><code>join online room [code] as [name]</code> then <code>this sprite is my player</code> — everyone in the same room sees each other's player sprite move, with name tags. <code>send [msg] with value</code> + <code>when I receive online</code> talk between players, <code>shared [name]</code> variables are the same for everyone, <code>am I the host?</code> lets one player spawn the enemies and <code>everyone sees this sprite from the host</code> shows them to the others.</p>
    <h3>Sounds</h3><p>Built-in synth sounds (jump, coin, laser…), record your voice, play notes and drums.</p>
    <h3>Saving</h3><p>Your game autosaves in this browser. Use <b>File › Save</b> to download it, and <b>File › Export</b> to get a single web page you can send to anyone.</p>
  </div>`);

  /* ================= helpers ================= */
  function esc(s) { return String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c])); }
  function escXml(s) { return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;'); }

  /* ================= boot ================= */
  initWorkspace();
  (function boot() {
    try { const old = localStorage.getItem('spark:autosave'); if (old && !projectIndex().length) { const p = JSON.parse(old); if (p && p.sprites) { const id = uid(); localStorage.setItem('spark:project:' + id, old); saveIndex([{ id, name: p.name || 'Untitled game', updated: Date.now(), thumb: '', sprites: p.sprites.length }]); localStorage.setItem('spark:current', id); } localStorage.removeItem('spark:autosave'); } } catch (e) {}
    const cur = localStorage.getItem('spark:current');
    if (!(cur && openProjectById(cur))) { const first = projectIndex()[0]; if (!(first && openProjectById(first.id))) loadProject(defaultProject()); }
  })();
  window.SparkEditor = { R, loadProject, currentProject, selectTarget, buildExportHTML, get current() { return current; }, get ws() { return ws; } };
})();
