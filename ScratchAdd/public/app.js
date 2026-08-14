// Scratch+ Studio app: editor state, live multi-user sync, uploads, recipes.
(function () {
  const $ = id => document.getElementById(id);

  // ---------- global app state ----------
  const state = {
    project: null,        // {stage, sprites:[...]}
    selectedId: null,     // 'stage' or sprite id
    you: null,
    users: [],
  };
  let ws = null;
  let workspace = null;      // main Blockly workspace
  let loadingWorkspace = false;
  let pendingReload = false;
  let sendTimer = null;

  function createVariable(ws, name) {
    if (ws.createVariable) return ws.createVariable(name);
    return ws.getVariableMap().createVariable(name);
  }

  function selected() {
    if (!state.project) return null;
    if (state.selectedId === 'stage') return state.project.stage;
    return state.project.sprites.find(s => s.id === state.selectedId) || null;
  }

  // SP: hooks the block definitions use for dynamic dropdowns
  window.SP = {
    _ctxSprite: null,
    _ctx() { return SP._ctxSprite || selected(); },
    costumeOptions() { return ((SP._ctx() || {}).costumes || []).map(c => [c.name, c.name]); },
    soundOptions() { return ((SP._ctx() || {}).sounds || []).map(s => [s.name, s.name]); },
    touchingOptions() {
      const me = SP._ctx();
      const others = (state.project ? state.project.sprites : []).filter(s => s !== me).map(s => [s.name, s.name]);
      return [['mouse-pointer', '_mouse_'], ['edge', '_edge_'], ...others];
    },
    towardsOptions() {
      const me = SP._ctx();
      const others = (state.project ? state.project.sprites : []).filter(s => s !== me).map(s => [s.name, s.name]);
      return [['mouse-pointer', '_mouse_'], ...others];
    },
    gotoOptions() {
      const me = SP._ctx();
      const others = (state.project ? state.project.sprites : []).filter(s => s !== me).map(s => [s.name, s.name]);
      return [['random position', '_random_'], ['mouse-pointer', '_mouse_'], ...others];
    },
  };

  // ---------- websocket ----------
  function connect() {
    ws = new WebSocket(`ws://${location.host}`);
    ws.onopen = () => {
      $('connDot').classList.remove('off');
      const name = localStorage.getItem('sp_name') || '';
      if (name) send({ type: 'join', name });
    };
    ws.onclose = () => { $('connDot').classList.add('off'); setTimeout(connect, 1500); };
    ws.onmessage = e => {
      const msg = JSON.parse(e.data);
      switch (msg.type) {
        case 'init':
          state.project = msg.project;
          state.you = msg.you;
          state.users = msg.users;
          if (!state.selectedId) state.selectedId = state.project.sprites[0] ? state.project.sprites[0].id : 'stage';
          initEditorOnce();
          renderAll();
          loadSelectedWorkspace();
          break;
        case 'project':
          state.project = msg.project;
          if (!selected()) state.selectedId = state.project.sprites[0] ? state.project.sprites[0].id : 'stage';
          renderAll();
          loadSelectedWorkspace();
          break;
        case 'sprite': {
          const sp = msg.sprite;
          const i = state.project.sprites.findIndex(s => s.id === sp.id);
          if (i >= 0) state.project.sprites[i] = sp; else state.project.sprites.push(sp);
          if (sp.id === state.selectedId) refreshCurrentFromRemote();
          renderAll();
          break;
        }
        case 'removeSprite':
          state.project.sprites = state.project.sprites.filter(s => s.id !== msg.id);
          if (state.selectedId === msg.id) {
            state.selectedId = state.project.sprites[0] ? state.project.sprites[0].id : 'stage';
            loadSelectedWorkspace();
          }
          renderAll();
          break;
        case 'stage':
          state.project.stage = msg.stage;
          if (state.selectedId === 'stage') refreshCurrentFromRemote();
          renderAll();
          break;
        case 'users':
          state.users = msg.users;
          renderUsers(); renderSprites();
          break;
        case 'flag': Runtime.greenFlag(); break;
        case 'stopall': Runtime.stopAll(); break;
      }
    };
  }
  function send(msg) { if (ws && ws.readyState === 1) ws.send(JSON.stringify(msg)); }

  function sendSelected() {
    const t = selected();
    if (!t) return;
    if (t.isStage) send({ type: 'stage', stage: t });
    else send({ type: 'sprite', sprite: t });
  }

  // remote changed the sprite I'm looking at → reload blocks unless mid-drag
  function refreshCurrentFromRemote() {
    if (!workspace) return;
    if (workspace.isDragging && workspace.isDragging()) { pendingReload = true; return; }
    loadSelectedWorkspace(true);
  }

  // ---------- Blockly ----------
  function initEditorOnce() {
    if (workspace) return;
    workspace = Blockly.inject('blocklyDiv', {
      toolbox: window.SP_TOOLBOX,
      renderer: 'zelos',
      media: '/blockly-media/',
      trashcan: true,
      zoom: { controls: true, wheel: true, startScale: 0.7, maxScale: 1.5, minScale: 0.4 },
      move: { scrollbars: true, drag: true, wheel: false },
    });

    workspace.registerToolboxCategoryCallback('SP_VARS', ws => {
      const out = [{ kind: 'button', text: '➕ Make a Variable', callbackKey: 'SP_NEWVAR' }];
      const names = ws.getVariableMap().getAllVariables().map(v => v.getName ? v.getName() : v.name);
      for (const n of names) out.push({ kind: 'block', type: 'data_variable', fields: { VARIABLE: { name: n, type: '' } } });
      if (names.length) {
        const first = { name: names[0], type: '' };
        out.push({ kind: 'block', type: 'data_setvariableto', fields: { VARIABLE: first },
          inputs: { VALUE: { shadow: { type: 'text', fields: { TEXT: '0' } } } } });
        out.push({ kind: 'block', type: 'data_changevariableby', fields: { VARIABLE: first },
          inputs: { VALUE: { shadow: { type: 'math_number', fields: { NUM: 1 } } } } });
        out.push({ kind: 'block', type: 'data_showvariable', fields: { VARIABLE: first } });
        out.push({ kind: 'block', type: 'data_hidevariable', fields: { VARIABLE: first } });
      }
      return out;
    });
    workspace.registerButtonCallback('SP_NEWVAR', () => {
      const name = window.prompt('Name your variable:', 'score');
      if (name) { createVariable(workspace, name.trim()); workspace.refreshToolboxSelection(); }
    });

    workspace.addChangeListener(ev => {
      if (loadingWorkspace) return;
      if (ev.isUiEvent) {
        if (pendingReload && !(workspace.isDragging && workspace.isDragging())) { pendingReload = false; loadSelectedWorkspace(true); }
        return;
      }
      const t = selected();
      if (!t) return;
      clearTimeout(sendTimer);
      sendTimer = setTimeout(() => {
        t.workspace = Blockly.serialization.workspaces.save(workspace);
        sendSelected();
      }, 350);
    });

    Runtime.init($('stage'), () => state.project);
    initStageDrag();
  }

  function loadSelectedWorkspace(keepScroll) {
    if (!workspace) return;
    const t = selected();
    loadingWorkspace = true;
    try {
      SP._ctxSprite = t;
      const scrollX = workspace.scrollX, scrollY = workspace.scrollY;
      workspace.clear();
      if (t && t.workspace) Blockly.serialization.workspaces.load(t.workspace, workspace);
      if (keepScroll) workspace.scroll(scrollX, scrollY);
    } catch (e) { console.error('workspace load failed', e); }
    finally { SP._ctxSprite = null; loadingWorkspace = false; }
  }

  function selectTarget(id) {
    if (state.selectedId === id) return;
    // save current first
    const cur = selected();
    if (cur && workspace && !loadingWorkspace) {
      cur.workspace = Blockly.serialization.workspaces.save(workspace);
    }
    state.selectedId = id;
    send({ type: 'presence', spriteId: id });
    loadSelectedWorkspace();
    renderAll();
  }

  // ---------- rendering ----------
  function renderAll() { renderSprites(); renderProps(); renderUsers(); }

  function renderUsers() {
    const bar = $('userBar');
    bar.innerHTML = '';
    for (const u of state.users) {
      const pill = document.createElement('span');
      pill.className = 'user-pill';
      const dot = document.createElement('i');
      dot.style.background = u.color;
      pill.appendChild(dot);
      pill.appendChild(document.createTextNode(u.name + (u.id === state.you ? ' (you)' : '')));
      bar.appendChild(pill);
    }
  }

  function renderSprites() {
    const list = $('spriteList');
    list.innerHTML = '';
    for (const sp of state.project.sprites) {
      const chip = document.createElement('div');
      chip.className = 'sprite-chip' + (sp.id === state.selectedId ? ' active' : '');
      const img = document.createElement('img');
      const c = (sp.costumes || [])[sp.currentCostume || 0];
      if (c) img.src = c.url;
      chip.appendChild(img);
      const nm = document.createElement('div');
      nm.textContent = sp.name;
      chip.appendChild(nm);
      // colored dots for other users editing this sprite
      const eds = state.users.filter(u => u.spriteId === sp.id && u.id !== state.you);
      if (eds.length) {
        const row = document.createElement('div');
        row.className = 'editors';
        for (const u of eds) { const i = document.createElement('i'); i.style.background = u.color; i.title = u.name; row.appendChild(i); }
        chip.appendChild(row);
      }
      const x = document.createElement('button');
      x.className = 'chip-x'; x.textContent = '✕'; x.title = 'delete sprite';
      x.onclick = e => {
        e.stopPropagation();
        if (!confirm(`Delete ${sp.name}?`)) return;
        state.project.sprites = state.project.sprites.filter(s => s.id !== sp.id);
        send({ type: 'removeSprite', id: sp.id });
        if (state.selectedId === sp.id) {
          state.selectedId = state.project.sprites[0] ? state.project.sprites[0].id : 'stage';
          loadSelectedWorkspace();
        }
        renderAll();
      };
      chip.appendChild(x);
      chip.onclick = () => selectTarget(sp.id);
      chip.ondblclick = () => {
        const name = window.prompt('Rename sprite:', sp.name);
        if (name && name.trim()) { sp.name = name.trim(); send({ type: 'sprite', sprite: sp }); renderAll(); }
      };
      list.appendChild(chip);
    }
    const sc = (state.project.stage.costumes || [])[state.project.stage.currentCostume || 0];
    if (sc) $('stageThumb').src = sc.url;
    $('stageChip').classList.toggle('active', state.selectedId === 'stage');
  }

  function renderProps() {
    const t = selected();
    const isSprite = t && !t.isStage;
    $('propsRow').style.display = isSprite ? 'flex' : 'none';
    if (isSprite) {
      $('propX').value = Math.round(t.x || 0);
      $('propY').value = Math.round(t.y || 0);
      $('propSize').value = t.size == null ? 100 : t.size;
      $('propDir').value = t.direction == null ? 90 : t.direction;
      $('propVisible').checked = t.visible !== false;
      $('propRotStyle').value = t.rotationStyle || 'all around';
    }
    // costumes
    const cr = $('costumeRow');
    cr.innerHTML = '';
    if (t) {
      (t.costumes || []).forEach((c, i) => {
        const chip = document.createElement('div');
        chip.className = 'costume-chip' + (i === (t.currentCostume || 0) ? ' active' : '');
        const img = document.createElement('img'); img.src = c.url; chip.appendChild(img);
        const nm = document.createElement('div'); nm.className = 'nm'; nm.textContent = c.name; chip.appendChild(nm);
        chip.onclick = () => { t.currentCostume = i; sendSelected(); renderAll(); };
        chip.ondblclick = () => {
          const name = window.prompt('Rename costume:', c.name);
          if (name && name.trim()) { c.name = name.trim(); sendSelected(); renderProps(); }
        };
        if ((t.costumes || []).length > 1) {
          const x = document.createElement('button');
          x.className = 'chip-x'; x.textContent = '✕';
          x.onclick = e => {
            e.stopPropagation();
            t.costumes.splice(i, 1);
            if ((t.currentCostume || 0) >= t.costumes.length) t.currentCostume = 0;
            sendSelected(); renderAll();
          };
          chip.appendChild(x);
        }
        cr.appendChild(chip);
      });
    }
    // sounds
    const sr = $('soundRow');
    sr.innerHTML = '';
    if (t && (t.sounds || []).length) {
      for (const [i, s] of t.sounds.entries()) {
        const chip = document.createElement('div');
        chip.className = 'sound-chip';
        chip.textContent = '🔊 ' + s.name;
        chip.title = 'click to preview';
        chip.onclick = () => new Audio(s.url).play();
        const x = document.createElement('button');
        x.className = 'chip-x'; x.textContent = '✕';
        x.onclick = e => { e.stopPropagation(); t.sounds.splice(i, 1); sendSelected(); renderProps(); };
        chip.appendChild(x);
        sr.appendChild(chip);
      }
    }
  }

  // property inputs
  function bindProp(id, key, parse) {
    $(id).addEventListener('change', () => {
      const t = selected();
      if (!t || t.isStage) return;
      t[key] = parse($(id));
      sendSelected();
    });
  }
  bindProp('propX', 'x', el => +el.value || 0);
  bindProp('propY', 'y', el => +el.value || 0);
  bindProp('propSize', 'size', el => Math.max(5, +el.value || 100));
  bindProp('propDir', 'direction', el => +el.value || 90);
  bindProp('propVisible', 'visible', el => el.checked);
  bindProp('propRotStyle', 'rotationStyle', el => el.value);

  // ---------- stage drag (edit mode) ----------
  function initStageDrag() {
    const stage = $('stage');
    let dragging = null;
    stage.addEventListener('pointerdown', e => {
      if (Runtime.isRunning()) return;
      const m = Runtime.stageMouse;
      const hit = Runtime.hitTest(m.x, m.y);
      if (hit) { dragging = hit; stage.setPointerCapture(e.pointerId); }
    });
    stage.addEventListener('pointermove', () => {
      if (!dragging) return;
      const m = Runtime.stageMouse;
      dragging.x = Math.round(m.x); dragging.y = Math.round(m.y);
      renderProps();
    });
    stage.addEventListener('pointerup', () => {
      if (!dragging) return;
      const sp = dragging; dragging = null;
      send({ type: 'sprite', sprite: sp });
    });
  }

  // ---------- sprites / uploads ----------
  let spriteSeq = 0;
  function newSpriteId() { return 's' + Date.now().toString(36) + (spriteSeq++); }
  function uniqueSpriteName() {
    let i = 1;
    while (state.project.sprites.some(s => s.name === 'Sprite' + i)) i++;
    return 'Sprite' + i;
  }

  async function addSprite(costume) {
    const sp = {
      id: newSpriteId(), name: uniqueSpriteName(),
      x: Math.round(Math.random() * 200 - 100), y: Math.round(Math.random() * 120 - 60),
      direction: 90, size: 100, visible: true, rotationStyle: 'all around',
      costumes: [costume], currentCostume: 0, sounds: [], workspace: null,
    };
    state.project.sprites.push(sp);
    send({ type: 'sprite', sprite: sp });
    selectTarget(sp.id);
  }

  async function uploadFile(file) {
    const resp = await fetch('/upload?name=' + encodeURIComponent(file.name), { method: 'POST', body: file });
    const data = await resp.json();
    if (data.error) throw new Error(data.error);
    return data;
  }

  function imageDims(url) {
    return new Promise((res, rej) => {
      const img = new Image();
      img.onload = () => res({ width: img.naturalWidth, height: img.naturalHeight });
      img.onerror = rej;
      img.src = url;
    });
  }

  async function fileToCostume(file) {
    const data = await uploadFile(file);
    const dims = await imageDims(data.url);
    const name = file.name.replace(/\.[^.]+$/, '') || 'costume';
    return { name, md5ext: data.md5ext, url: data.url, dataFormat: data.dataFormat,
      width: dims.width, height: dims.height, cx: dims.width / 2, cy: dims.height / 2 };
  }

  async function fileToSound(file) {
    const buf = await file.arrayBuffer();
    const data = await uploadFile(file);
    let rate = 44100, sampleCount = 0;
    try {
      const ac = new (window.AudioContext || window.webkitAudioContext)();
      const decoded = await ac.decodeAudioData(buf.slice(0));
      rate = decoded.sampleRate; sampleCount = decoded.length;
      ac.close();
    } catch (e) {}
    const name = file.name.replace(/\.[^.]+$/, '') || 'sound';
    return { name, md5ext: data.md5ext, url: data.url, dataFormat: data.dataFormat, rate, sampleCount };
  }

  $('btnUpload').onclick = () => $('fileInput').click();
  $('fileInput').onchange = async e => {
    const t = selected();
    if (!t) return;
    for (const file of e.target.files) {
      try {
        if (file.type.startsWith('image/')) {
          const c = await fileToCostume(file);
          uniqueName(c, t.costumes);
          t.costumes.push(c);
          t.currentCostume = t.costumes.length - 1;
        } else if (file.type.startsWith('audio/')) {
          const s = await fileToSound(file);
          uniqueName(s, t.sounds);
          t.sounds.push(s);
        } else alert('Unsupported file: ' + file.name);
      } catch (err) { alert('Upload failed: ' + err.message); }
    }
    e.target.value = '';
    sendSelected(); renderAll();
  };
  function uniqueName(item, list) {
    let n = item.name, i = 2;
    while (list.some(x => x.name === n)) n = item.name + i++;
    item.name = n;
  }

  $('btnAddSprite').onclick = async () => {
    const costume = await Paint.uploadRandomCreature();
    costume.name = 'creature';
    addSprite(costume);
  };
  $('btnAddSpriteFile').onclick = () => {
    const inp = document.createElement('input');
    inp.type = 'file'; inp.accept = 'image/*';
    inp.onchange = async () => {
      if (!inp.files[0]) return;
      const c = await fileToCostume(inp.files[0]);
      addSprite(c);
    };
    inp.click();
  };
  $('stageChip').onclick = () => selectTarget('stage');

  // ---------- paint ----------
  $('btnPaint').onclick = () => { $('paintModal').style.display = 'flex'; };
  $('paintClose').onclick = () => { $('paintModal').style.display = 'none'; };
  $('paintSave').onclick = async () => {
    const t = selected();
    if (!t) return;
    const c = await Paint.saveAsCostume();
    c.name = 'painted';
    uniqueName(c, t.costumes);
    t.costumes.push(c);
    t.currentCostume = t.costumes.length - 1;
    sendSelected(); renderAll();
    $('paintModal').style.display = 'none';
  };

  // ---------- run / stop / export / new ----------
  $('btnFlag').onclick = () => {
    const cur = selected();
    if (cur && workspace) cur.workspace = Blockly.serialization.workspaces.save(workspace);
    sendSelected();
    Runtime.greenFlag();
    send({ type: 'flag' });
  };
  $('btnStop').onclick = () => { Runtime.stopAll(); send({ type: 'stopall' }); };

  $('btnExport').onclick = async () => {
    const cur = selected();
    if (cur && workspace) { cur.workspace = Blockly.serialization.workspaces.save(workspace); sendSelected(); }
    try {
      await SB3Export.exportProject(state.project, 'scratchplus-project.sb3');
    } catch (e) {
      alert('Export failed: ' + e.message);
      console.error(e);
    }
  };

  $('btnNew').onclick = async () => {
    if (!confirm('Start a brand new project? This clears it for EVERYONE.')) return;
    await fetch('/reset', { method: 'POST' });
    const r = await fetch('/'); // server broadcasts new project over ws; nothing else needed
  };

  // ---------- name ----------
  const nameInput = $('nameInput');
  nameInput.value = localStorage.getItem('sp_name') || '';
  nameInput.addEventListener('change', () => {
    localStorage.setItem('sp_name', nameInput.value.trim());
    send({ type: 'join', name: nameInput.value.trim() || 'Guest' });
  });

  // ---------- recipes ----------
  const N = (v) => ({ shadow: { type: 'math_number', fields: { NUM: v } } });
  const T = (v) => ({ shadow: { type: 'text', fields: { TEXT: v } } });
  const RECIPES = [
    { name: '🎮 Move with arrow keys', blocks: [
      { type: 'event_whenkeypressed', x: 20, y: 20, fields: { KEY_OPTION: 'right arrow' }, next: { block: { type: 'motion_changexby', inputs: { DX: N(10) } } } },
      { type: 'event_whenkeypressed', x: 20, y: 120, fields: { KEY_OPTION: 'left arrow' }, next: { block: { type: 'motion_changexby', inputs: { DX: N(-10) } } } },
      { type: 'event_whenkeypressed', x: 20, y: 220, fields: { KEY_OPTION: 'up arrow' }, next: { block: { type: 'motion_changeyby', inputs: { DY: N(10) } } } },
      { type: 'event_whenkeypressed', x: 20, y: 320, fields: { KEY_OPTION: 'down arrow' }, next: { block: { type: 'motion_changeyby', inputs: { DY: N(-10) } } } },
    ]},
    { name: '🏀 Bounce around', blocks: [
      { type: 'event_whenflagclicked', x: 20, y: 20, next: { block: {
        type: 'motion_pointindirection', inputs: { DIRECTION: N(45) }, next: { block: {
          type: 'control_forever', inputs: { SUBSTACK: { block: {
            type: 'motion_movesteps', inputs: { STEPS: N(10) }, next: { block: { type: 'motion_ifonedgebounce' } } } } } } } } } },
    ]},
    { name: '🐭 Chase the mouse', blocks: [
      { type: 'event_whenflagclicked', x: 20, y: 20, next: { block: {
        type: 'control_forever', inputs: { SUBSTACK: { block: {
          type: 'motion_pointtowards', fields: { TOWARDS: '_mouse_' }, next: { block: {
            type: 'motion_movesteps', inputs: { STEPS: N(6) } } } } } } } } },
    ]},
    { name: '🖱 Clicker: score points', vars: ['score'], blocks: [
      { type: 'event_whenflagclicked', x: 20, y: 20, next: { block: {
        type: 'data_setvariableto', fields: { VARIABLE: { name: 'score', type: '' } }, inputs: { VALUE: T('0') } } } },
      { type: 'event_whenthisspriteclicked', x: 20, y: 140, next: { block: {
        type: 'data_changevariableby', fields: { VARIABLE: { name: 'score', type: '' } }, inputs: { VALUE: N(1) }, next: { block: {
          type: 'looks_sayforsecs', inputs: { MESSAGE: T('Yay!'), SECS: N(0.5) } } } } } },
    ]},
    { name: '🦘 Jump on space', blocks: [
      { type: 'event_whenkeypressed', x: 20, y: 20, fields: { KEY_OPTION: 'space' }, next: { block: {
        type: 'motion_changeyby', inputs: { DY: N(60) }, next: { block: {
          type: 'control_wait', inputs: { DURATION: N(0.25) }, next: { block: {
            type: 'motion_changeyby', inputs: { DY: N(-60) } } } } } } } },
    ]},
    { name: '🎲 Wander randomly', blocks: [
      { type: 'event_whenflagclicked', x: 20, y: 20, next: { block: {
        type: 'control_forever', inputs: { SUBSTACK: { block: {
          type: 'motion_glidesecstoxy', inputs: { SECS: N(1),
            X: { block: { type: 'operator_random', inputs: { FROM: N(-200), TO: N(200) } } },
            Y: { block: { type: 'operator_random', inputs: { FROM: N(-140), TO: N(140) } } } } } } } } } },
    ]},
  ];

  const menu = $('recipeMenu');
  for (const r of RECIPES) {
    const b = document.createElement('button');
    b.textContent = r.name;
    b.onclick = () => {
      menu.classList.remove('open');
      if (!workspace) return;
      for (const v of r.vars || []) {
        const existing = workspace.getVariableMap().getAllVariables().some(x => (x.getName ? x.getName() : x.name) === v);
        if (!existing) createVariable(workspace, v);
      }
      // drop the recipe below whatever is already in the workspace
      let baseY = 20;
      for (const top of workspace.getTopBlocks(false)) {
        const xy = top.getRelativeToSurfaceXY();
        baseY = Math.max(baseY, xy.y + top.getHeightWidth().height + 40);
      }
      const minY = Math.min(...r.blocks.map(b => b.y || 20));
      for (const blockState of r.blocks) {
        const st = JSON.parse(JSON.stringify(blockState));
        st.y = (st.y || 20) - minY + baseY;
        Blockly.serialization.blocks.append(st, workspace);
      }
    };
    menu.appendChild(b);
  }
  $('btnRecipes').onclick = e => { e.stopPropagation(); menu.classList.toggle('open'); };
  document.addEventListener('click', () => menu.classList.remove('open'));

  // ---------- boot ----------
  Paint.init();
  connect();
})();
