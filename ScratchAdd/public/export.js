// Export the project as a real .sb3 that scratch.mit.edu can open.
// Our Blockly block types are Scratch opcodes, so this is a structural mapping:
// Blockly fields/inputs -> Scratch project.json inputs/fields + menu shadow blocks.
window.SB3Export = (function () {

  // How each opcode's Blockly inputs map to Scratch input encodings.
  // kinds: num, text, bool, substack, menu (menuOpcode+menuField pulled from a Blockly FIELD)
  const MENU = (op, field) => ({ kind: 'menu', op, field });
  const SPEC = {
    motion_movesteps: { STEPS: 'num' }, motion_turnright: { DEGREES: 'num' }, motion_turnleft: { DEGREES: 'num' },
    motion_goto: { TO: MENU('motion_goto_menu', 'TO') },
    motion_gotoxy: { X: 'num', Y: 'num' },
    motion_glidesecstoxy: { SECS: 'num', X: 'num', Y: 'num' },
    motion_pointindirection: { DIRECTION: 'num' },
    motion_pointtowards: { TOWARDS: MENU('motion_pointtowards_menu', 'TOWARDS') },
    motion_changexby: { DX: 'num' }, motion_setx: { X: 'num' }, motion_changeyby: { DY: 'num' }, motion_sety: { Y: 'num' },
    looks_sayforsecs: { MESSAGE: 'text', SECS: 'num' }, looks_say: { MESSAGE: 'text' },
    looks_thinkforsecs: { MESSAGE: 'text', SECS: 'num' },
    looks_switchcostumeto: { COSTUME: MENU('looks_costume', 'COSTUME') },
    looks_changesizeby: { CHANGE: 'num' }, looks_setsizeto: { SIZE: 'num' },
    sound_play: { SOUND_MENU: MENU('sound_sounds_menu', 'SOUND_MENU') },
    sound_playuntildone: { SOUND_MENU: MENU('sound_sounds_menu', 'SOUND_MENU') },
    control_wait: { DURATION: 'num' },
    control_repeat: { TIMES: 'num', SUBSTACK: 'substack' },
    control_forever: { SUBSTACK: 'substack' },
    control_if: { CONDITION: 'bool', SUBSTACK: 'substack' },
    control_if_else: { CONDITION: 'bool', SUBSTACK: 'substack', SUBSTACK2: 'substack' },
    control_wait_until: { CONDITION: 'bool' },
    control_repeat_until: { CONDITION: 'bool', SUBSTACK: 'substack' },
    sensing_touchingobject: { TOUCHINGOBJECTMENU: MENU('sensing_touchingobjectmenu', 'TOUCHINGOBJECTMENU') },
    sensing_keypressed: { KEY_OPTION: MENU('sensing_keyoptions', 'KEY_OPTION') },
    sensing_askandwait: { QUESTION: 'text' },
    operator_add: { NUM1: 'num', NUM2: 'num' }, operator_subtract: { NUM1: 'num', NUM2: 'num' },
    operator_multiply: { NUM1: 'num', NUM2: 'num' }, operator_divide: { NUM1: 'num', NUM2: 'num' },
    operator_mod: { NUM1: 'num', NUM2: 'num' }, operator_round: { NUM: 'num' },
    operator_random: { FROM: 'num', TO: 'num' },
    operator_gt: { OPERAND1: 'text', OPERAND2: 'text' }, operator_lt: { OPERAND1: 'text', OPERAND2: 'text' },
    operator_equals: { OPERAND1: 'text', OPERAND2: 'text' },
    operator_and: { OPERAND1: 'bool', OPERAND2: 'bool' }, operator_or: { OPERAND1: 'bool', OPERAND2: 'bool' },
    operator_not: { OPERAND: 'bool' },
    operator_join: { STRING1: 'text', STRING2: 'text' },
    data_setvariableto: { VALUE: 'text' }, data_changevariableby: { VALUE: 'num' },
  };
  const HATS = new Set(['event_whenflagclicked', 'event_whenkeypressed', 'event_whenthisspriteclicked', 'event_whenbroadcastreceived']);

  let idSeq = 0;
  const newId = () => 'gen' + (++idSeq) + '_' + Math.random().toString(36).slice(2, 8);

  function varNameOf(ws, id) {
    const map = ws.getVariableMap ? ws.getVariableMap() : null;
    const v = (map && map.getVariableById) ? map.getVariableById(id) : null;
    return v ? (v.getName ? v.getName() : v.name) : String(id);
  }

  // ---- per-target block emission ----
  function emitTarget(ws, out, gctx) {
    for (const top of ws.getTopBlocks(false)) {
      emitChain(top, null, true, out, gctx);
    }
  }

  function emitChain(block, parentId, topLevel, out, gctx) {
    let prevId = parentId;
    let headId = null;
    let isFirst = true;
    while (block) {
      const id = block.id;
      const entry = emitBlock(block, out, gctx);
      entry.parent = prevId;
      entry.topLevel = topLevel && isFirst;
      if (entry.topLevel) {
        const xy = block.getRelativeToSurfaceXY();
        entry.x = Math.round(xy.x * 1.5); entry.y = Math.round(xy.y * 1.5);
      }
      if (!isFirst && prevId) out[prevId].next = id;
      if (isFirst) headId = id;
      isFirst = false;
      prevId = id;
      block = block.getNextBlock();
    }
    return headId;
  }

  function fieldsOf(block) {
    const fields = {};
    for (const inp of block.inputList) {
      for (const f of inp.fieldRow) {
        if (!f.name) continue;
        let v = f.getValue();
        if (f.name === 'VARIABLE') v = varNameOf(block.workspace, v);
        fields[f.name] = v;
      }
    }
    return fields;
  }

  function emitBlock(block, out, gctx) {
    const op = block.type;
    const entry = { opcode: op, next: null, parent: null, inputs: {}, fields: {}, shadow: false, topLevel: false };
    out[block.id] = entry;
    const rawFields = fieldsOf(block);
    const spec = SPEC[op] || {};

    // menu-kind entries consume a Blockly field and become shadow menu blocks
    for (const [name, kind] of Object.entries(spec)) {
      if (kind && kind.kind === 'menu') {
        const val = rawFields[name]; delete rawFields[name];
        const mid = newId();
        out[mid] = { opcode: kind.op, next: null, parent: block.id, inputs: {}, fields: { [kind.field]: [val, null] }, shadow: true, topLevel: false };
        entry.inputs[name] = [1, mid];
      }
    }

    // remaining fields
    for (const [name, val] of Object.entries(rawFields)) {
      if (name === 'VARIABLE') entry.fields.VARIABLE = [val, gctx.varId(val)];
      else if (name === 'BROADCAST_OPTION') entry.fields.BROADCAST_OPTION = [String(val), gctx.bcId(String(val))];
      else if (name === 'BROADCAST_INPUT') entry.inputs.BROADCAST_INPUT = [1, [11, String(val), gctx.bcId(String(val))]];
      else entry.fields[name] = [val, null];
    }
    if (op === 'control_stop') entry.mutation = { tagName: 'mutation', children: [], hasnext: 'false' };

    // value + substack inputs
    for (const inp of block.inputList) {
      if (!inp.connection || !inp.name) continue;
      const kind = spec[inp.name];
      const target = inp.connection.targetBlock();
      if (inp.connection.type === Blockly.NEXT_STATEMENT) {
        if (target) entry.inputs[inp.name] = [2, emitChain(target, block.id, false, out, gctx)];
        continue;
      }
      const prim = kind === 'text' ? v => [10, String(v)] : v => [4, String(v)];
      if (!target) {
        if (kind === 'num') entry.inputs[inp.name] = [1, [4, '']];
        else if (kind === 'text') entry.inputs[inp.name] = [1, [10, '']];
        // empty bool: omitted
      } else if (target.isShadow()) {
        const v = target.type === 'math_number' ? target.getFieldValue('NUM') : target.getFieldValue('TEXT');
        entry.inputs[inp.name] = [1, prim(v == null ? '' : v)];
      } else {
        const sub = emitBlock(target, out, gctx);
        sub.parent = block.id;
        if (kind === 'bool') entry.inputs[inp.name] = [2, target.id];
        else entry.inputs[inp.name] = [3, target.id, prim('')];
      }
    }
    return entry;
  }

  // ---- assets ----
  async function fetchBytes(url) {
    const r = await fetch(url);
    if (!r.ok) throw new Error('asset fetch failed: ' + url);
    return new Uint8Array(await r.arrayBuffer());
  }

  function costumeJson(c) {
    return {
      name: c.name, bitmapResolution: 1, dataFormat: c.dataFormat,
      assetId: c.md5ext.split('.')[0], md5ext: c.md5ext,
      rotationCenterX: c.cx, rotationCenterY: c.cy,
    };
  }
  function soundJson(s) {
    return {
      name: s.name, assetId: s.md5ext.split('.')[0], dataFormat: s.dataFormat, format: '',
      rate: s.rate || 44100, sampleCount: s.sampleCount || 0, md5ext: s.md5ext,
    };
  }

  // ---- main ----
  async function exportProject(project, filename) {
    idSeq = 0;
    const variables = {};   // id -> [name, value]
    const varIds = new Map();
    const broadcasts = {};  // id -> name
    const bcIds = new Map();
    const gctx = {
      varId(name) {
        if (!varIds.has(name)) { const id = 'var_' + varIds.size + '_' + name.replace(/[^\w]/g, ''); varIds.set(name, id); variables[id] = [name, 0]; }
        return varIds.get(name);
      },
      bcId(name) {
        const key = name.toLowerCase();
        if (!bcIds.has(key)) { const id = 'bc_' + bcIds.size; bcIds.set(key, id); broadcasts[id] = name; }
        return bcIds.get(key);
      },
    };

    const models = [project.stage, ...project.sprites];
    const targets = [];
    models.forEach((m, i) => {
      const blocks = {};
      if (m.workspace) {
        const ws = new Blockly.Workspace();
        try {
          if (window.SP) SP._ctxSprite = m;   // dynamic dropdowns resolve against this target
          Blockly.serialization.workspaces.load(m.workspace, ws);
          for (const v of ws.getVariableMap().getAllVariables()) gctx.varId(v.getName ? v.getName() : v.name);
          emitTarget(ws, blocks, gctx);
        } finally { ws.dispose(); if (window.SP) SP._ctxSprite = null; }
      }
      const base = {
        isStage: !!m.isStage, name: m.isStage ? 'Stage' : m.name,
        variables: {}, lists: {}, broadcasts: {}, blocks, comments: {},
        currentCostume: m.currentCostume || 0,
        costumes: (m.costumes || []).map(costumeJson),
        sounds: (m.sounds || []).map(soundJson),
        volume: 100, layerOrder: i,
      };
      if (m.isStage) {
        Object.assign(base, { tempo: 60, videoTransparency: 50, videoState: 'on', textToSpeechLanguage: null });
      } else {
        Object.assign(base, {
          visible: m.visible !== false, x: m.x || 0, y: m.y || 0,
          size: m.size == null ? 100 : m.size, direction: m.direction == null ? 90 : m.direction,
          draggable: false, rotationStyle: m.rotationStyle || 'all around',
        });
      }
      targets.push(base);
    });

    // globals live on the stage
    targets[0].variables = variables;
    targets[0].broadcasts = broadcasts;

    const projectJson = {
      targets, monitors: [], extensions: [],
      meta: { semver: '3.0.0', vm: '2.3.0', agent: 'ScratchPlus Studio' },
    };

    const zip = new JSZip();
    zip.file('project.json', JSON.stringify(projectJson));
    const added = new Set();
    for (const m of models) {
      for (const a of [...(m.costumes || []), ...(m.sounds || [])]) {
        if (added.has(a.md5ext)) continue;
        added.add(a.md5ext);
        zip.file(a.md5ext, await fetchBytes(a.url));
      }
    }
    const blob = await zip.generateAsync({ type: 'blob', compression: 'DEFLATE' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = filename || 'project.sb3';
    a.click();
    setTimeout(() => URL.revokeObjectURL(a.href), 5000);
    return projectJson;
  }

  return { exportProject };
})();
