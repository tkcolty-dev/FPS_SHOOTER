// Project runtime: compiles Blockly workspaces to an AST and runs them
// with Scratch-style cooperative threads on a 480x360 canvas.
window.Runtime = (function () {
  const W = 480, H = 360;
  const STOP = Symbol('stop-script');

  let canvas, ctx2d, getProject;
  let running = false;
  let runId = 0;
  let targets = [];          // live copies while running
  let vars = new Map();      // global variables  name -> value
  let monitorShown = new Map();
  let broadcastHandlers = []; // {message, targetIdx, node, token}
  let keyHandlers = [];       // {key, targetIdx, node}
  let clickHandlers = [];     // {targetIdx, node}
  let activeSounds = new Set();
  let timerStart = performance.now();
  let answer = '';
  const keysDown = new Set();
  const mouse = { x: 0, y: 0, down: false };
  const images = new Map();  // url -> Image
  let frameResolvers = [];

  // ---------- assets ----------
  function imageFor(url) {
    if (!images.has(url)) {
      const img = new Image();
      img.src = url;
      images.set(url, img);
    }
    return images.get(url);
  }

  // ---------- key mapping ----------
  function scratchKey(e) {
    if (e.key === ' ') return 'space';
    if (e.key === 'ArrowUp') return 'up arrow';
    if (e.key === 'ArrowDown') return 'down arrow';
    if (e.key === 'ArrowLeft') return 'left arrow';
    if (e.key === 'ArrowRight') return 'right arrow';
    if (e.key.length === 1) return e.key.toLowerCase();
    return null;
  }

  // ---------- compile Blockly JSON -> AST ----------
  function varName(ws, id) {
    const map = ws.getVariableMap ? ws.getVariableMap() : null;
    const v = (map && map.getVariableById) ? map.getVariableById(id)
      : (ws.getVariableById ? ws.getVariableById(id) : null);
    return v ? (v.getName ? v.getName() : v.name) : String(id);
  }
  window.SP_varName = varName; // shared with export.js

  function blockToNode(block) {
    if (!block) return null;
    const node = { op: block.type, id: block.id, fields: {}, inputs: {}, stacks: {}, next: null };
    for (const inp of block.inputList) {
      for (const f of inp.fieldRow) {
        if (!f.name) continue;
        let v = f.getValue();
        if (f.name === 'VARIABLE') v = varName(block.workspace, v);
        node.fields[f.name] = v;
      }
      if (inp.connection) {
        const t = inp.connection.targetBlock();
        if (inp.connection.type === Blockly.NEXT_STATEMENT) node.stacks[inp.name] = chainToNode(t);
        else node.inputs[inp.name] = blockToNode(t);
      }
    }
    return node;
  }
  function chainToNode(block) {
    let head = null, prev = null;
    while (block) {
      const n = blockToNode(block);
      if (prev) prev.next = n; else head = n;
      prev = n;
      block = block.getNextBlock();
    }
    return head;
  }

  function compile(project) {
    const models = [project.stage, ...project.sprites];
    targets = models.map((m, i) => ({
      model: m, isStage: !!m.isStage, name: m.name,
      x: m.x || 0, y: m.y || 0, direction: m.direction == null ? 90 : m.direction,
      size: m.size == null ? 100 : m.size, visible: m.visible !== false,
      rotationStyle: m.rotationStyle || 'all around',
      costume: m.currentCostume || 0, say: null, idx: i,
    }));
    vars = new Map();
    broadcastHandlers = []; keyHandlers = []; clickHandlers = [];
    const flagScripts = [];
    models.forEach((m, idx) => {
      if (!m.workspace) return;
      const ws = new Blockly.Workspace();
      try {
        Blockly.serialization.workspaces.load(m.workspace, ws);
        for (const v of ws.getVariableMap().getAllVariables()) {
          const nm = v.getName ? v.getName() : v.name;
          if (!vars.has(nm)) vars.set(nm, 0);
          if (!monitorShown.has(nm)) monitorShown.set(nm, true);
        }
        for (const top of ws.getTopBlocks(false)) {
          const node = blockToNode(top);
          node.next = chainToNode(top.getNextBlock());
          const body = node.next;
          if (node.op === 'event_whenflagclicked') flagScripts.push({ targetIdx: idx, node: body });
          else if (node.op === 'event_whenkeypressed') keyHandlers.push({ key: node.fields.KEY_OPTION, targetIdx: idx, node: body });
          else if (node.op === 'event_whenthisspriteclicked') clickHandlers.push({ targetIdx: idx, node: body });
          else if (node.op === 'event_whenbroadcastreceived')
            broadcastHandlers.push({ message: String(node.fields.BROADCAST_OPTION).toLowerCase(), targetIdx: idx, node: body, token: null });
        }
      } finally { ws.dispose(); }
    });
    return flagScripts;
  }

  // ---------- scheduling ----------
  function nextFrame(tok) {
    return new Promise((res, rej) => {
      frameResolvers.push(() => (tok.cancelled || tok.runId !== runId) ? rej(STOP) : res());
    });
  }
  function check(tok) { if (tok.cancelled || tok.runId !== runId) throw STOP; }

  function spawn(targetIdx, node) {
    const tok = { runId, cancelled: false };
    runChain(node, targets[targetIdx], tok).catch(e => { if (e !== STOP) console.error(e); });
    return tok;
  }

  async function runChain(node, t, tok) {
    while (node) {
      check(tok);
      await exec(node, t, tok);
      node = node.next;
    }
  }

  // ---------- value helpers ----------
  const toNum = v => { const n = parseFloat(v); return isNaN(n) ? 0 : n; };
  function looseEq(a, b) {
    const na = parseFloat(a), nb = parseFloat(b);
    if (!isNaN(na) && !isNaN(nb)) return na === nb;
    return String(a).toLowerCase() === String(b).toLowerCase();
  }
  function looseCmp(a, b) {
    const na = parseFloat(a), nb = parseFloat(b);
    if (!isNaN(na) && !isNaN(nb)) return na - nb;
    return String(a).toLowerCase() < String(b).toLowerCase() ? -1 : 1;
  }

  async function ev(node, t, tok, dflt) {
    if (!node) return dflt !== undefined ? dflt : 0;
    return evalExpr(node, t, tok);
  }

  async function evalExpr(n, t, tok) {
    const f = n.fields, I = n.inputs;
    switch (n.op) {
      case 'math_number': return toNum(f.NUM);
      case 'text': return f.TEXT;
      case 'motion_xposition': return t.x;
      case 'motion_yposition': return t.y;
      case 'motion_direction': return t.direction;
      case 'looks_size': return t.size;
      case 'sensing_mousex': return mouse.x;
      case 'sensing_mousey': return mouse.y;
      case 'sensing_mousedown': return mouse.down;
      case 'sensing_timer': return (performance.now() - timerStart) / 1000;
      case 'sensing_answer': return answer;
      case 'sensing_keypressed':
        return f.KEY_OPTION === 'any' ? keysDown.size > 0 : keysDown.has(f.KEY_OPTION);
      case 'sensing_touchingobject': return touching(t, f.TOUCHINGOBJECTMENU);
      case 'data_variable': return vars.has(f.VARIABLE) ? vars.get(f.VARIABLE) : 0;
      case 'operator_add': return toNum(await ev(I.NUM1, t, tok)) + toNum(await ev(I.NUM2, t, tok));
      case 'operator_subtract': return toNum(await ev(I.NUM1, t, tok)) - toNum(await ev(I.NUM2, t, tok));
      case 'operator_multiply': return toNum(await ev(I.NUM1, t, tok)) * toNum(await ev(I.NUM2, t, tok));
      case 'operator_divide': return toNum(await ev(I.NUM1, t, tok)) / toNum(await ev(I.NUM2, t, tok));
      case 'operator_mod': { const a = toNum(await ev(I.NUM1, t, tok)), b = toNum(await ev(I.NUM2, t, tok)); const r = a % b; return r / b < 0 ? r + b : r; }
      case 'operator_round': return Math.round(toNum(await ev(I.NUM, t, tok)));
      case 'operator_random': {
        let a = toNum(await ev(I.FROM, t, tok)), b = toNum(await ev(I.TO, t, tok));
        if (a > b) [a, b] = [b, a];
        if (Number.isInteger(a) && Number.isInteger(b)) return a + Math.floor(Math.random() * (b - a + 1));
        return a + Math.random() * (b - a);
      }
      case 'operator_gt': return looseCmp(await ev(I.OPERAND1, t, tok, ''), await ev(I.OPERAND2, t, tok, '')) > 0;
      case 'operator_lt': return looseCmp(await ev(I.OPERAND1, t, tok, ''), await ev(I.OPERAND2, t, tok, '')) < 0;
      case 'operator_equals': return looseEq(await ev(I.OPERAND1, t, tok, ''), await ev(I.OPERAND2, t, tok, ''));
      case 'operator_and': return !!(await ev(I.OPERAND1, t, tok, false)) && !!(await ev(I.OPERAND2, t, tok, false));
      case 'operator_or': return !!(await ev(I.OPERAND1, t, tok, false)) || !!(await ev(I.OPERAND2, t, tok, false));
      case 'operator_not': return !(await ev(I.OPERAND, t, tok, false));
      case 'operator_join': return String(await ev(I.STRING1, t, tok, '')) + String(await ev(I.STRING2, t, tok, ''));
      default: return 0;
    }
  }

  // ---------- statements ----------
  async function exec(n, t, tok) {
    const f = n.fields, I = n.inputs, S = n.stacks;
    switch (n.op) {
      // motion (no-op on stage)
      case 'motion_movesteps': if (t.isStage) break; {
        const steps = toNum(await ev(I.STEPS, t, tok));
        const rad = (90 - t.direction) * Math.PI / 180;
        moveTo(t, t.x + steps * Math.cos(rad), t.y + steps * Math.sin(rad));
      } break;
      case 'motion_turnright': t.direction = wrapDir(t.direction + toNum(await ev(I.DEGREES, t, tok))); break;
      case 'motion_turnleft': t.direction = wrapDir(t.direction - toNum(await ev(I.DEGREES, t, tok))); break;
      case 'motion_goto': if (t.isStage) break;
        if (f.TO === '_random_') moveTo(t, Math.floor(Math.random() * 481) - 240, Math.floor(Math.random() * 361) - 180);
        else if (f.TO === '_mouse_') moveTo(t, mouse.x, mouse.y);
        else { const o = targetByName(f.TO); if (o) moveTo(t, o.x, o.y); }
        break;
      case 'motion_gotoxy': moveTo(t, toNum(await ev(I.X, t, tok)), toNum(await ev(I.Y, t, tok))); break;
      case 'motion_glidesecstoxy': {
        const secs = toNum(await ev(I.SECS, t, tok));
        const x1 = toNum(await ev(I.X, t, tok)), y1 = toNum(await ev(I.Y, t, tok));
        const x0 = t.x, y0 = t.y, start = performance.now(), dur = Math.max(secs, 0) * 1000;
        if (dur === 0) { moveTo(t, x1, y1); break; }
        while (true) {
          await nextFrame(tok);
          const p = Math.min(1, (performance.now() - start) / dur);
          moveTo(t, x0 + (x1 - x0) * p, y0 + (y1 - y0) * p);
          if (p >= 1) break;
        }
      } break;
      case 'motion_pointindirection': t.direction = wrapDir(toNum(await ev(I.DIRECTION, t, tok))); break;
      case 'motion_pointtowards': {
        let tx, ty;
        if (f.TOWARDS === '_mouse_') { tx = mouse.x; ty = mouse.y; }
        else { const o = targetByName(f.TOWARDS); if (!o) break; tx = o.x; ty = o.y; }
        t.direction = wrapDir(90 - Math.atan2(ty - t.y, tx - t.x) * 180 / Math.PI);
      } break;
      case 'motion_changexby': moveTo(t, t.x + toNum(await ev(I.DX, t, tok)), t.y); break;
      case 'motion_setx': moveTo(t, toNum(await ev(I.X, t, tok)), t.y); break;
      case 'motion_changeyby': moveTo(t, t.x, t.y + toNum(await ev(I.DY, t, tok))); break;
      case 'motion_sety': moveTo(t, t.x, toNum(await ev(I.Y, t, tok))); break;
      case 'motion_ifonedgebounce': bounce(t); break;

      // looks
      case 'looks_say': t.say = { text: String(await ev(I.MESSAGE, t, tok, '')), think: false }; if (!t.say.text) t.say = null; break;
      case 'looks_sayforsecs': case 'looks_thinkforsecs': {
        const think = n.op === 'looks_thinkforsecs';
        t.say = { text: String(await ev(I.MESSAGE, t, tok, '')), think };
        await waitSecs(toNum(await ev(I.SECS, t, tok)), tok);
        t.say = null;
      } break;
      case 'looks_switchcostumeto': {
        const i = (t.model.costumes || []).findIndex(c => c.name === f.COSTUME);
        if (i >= 0) t.costume = i;
      } break;
      case 'looks_nextcostume': if (t.model.costumes && t.model.costumes.length) t.costume = (t.costume + 1) % t.model.costumes.length; break;
      case 'looks_changesizeby': t.size = Math.max(5, t.size + toNum(await ev(I.CHANGE, t, tok))); break;
      case 'looks_setsizeto': t.size = Math.max(5, toNum(await ev(I.SIZE, t, tok))); break;
      case 'looks_show': t.visible = true; break;
      case 'looks_hide': t.visible = false; break;

      // sound
      case 'sound_play': playSound(t, f.SOUND_MENU, false); break;
      case 'sound_playuntildone': await playSound(t, f.SOUND_MENU, true, tok); break;
      case 'sound_stopallsounds': stopSounds(); break;

      // events
      case 'event_broadcast': doBroadcast(String(f.BROADCAST_INPUT)); break;

      // control
      case 'control_wait': await waitSecs(toNum(await ev(I.DURATION, t, tok)), tok); break;
      case 'control_repeat': {
        const times = Math.round(toNum(await ev(I.TIMES, t, tok)));
        for (let i = 0; i < times; i++) { await runChain(S.SUBSTACK, t, tok); await nextFrame(tok); }
      } break;
      case 'control_forever': while (true) { await runChain(S.SUBSTACK, t, tok); await nextFrame(tok); } break;
      case 'control_if': if (await ev(I.CONDITION, t, tok, false)) await runChain(S.SUBSTACK, t, tok); break;
      case 'control_if_else':
        if (await ev(I.CONDITION, t, tok, false)) await runChain(S.SUBSTACK, t, tok);
        else await runChain(S.SUBSTACK2, t, tok);
        break;
      case 'control_wait_until': while (!(await ev(I.CONDITION, t, tok, false))) await nextFrame(tok); break;
      case 'control_repeat_until':
        while (!(await ev(I.CONDITION, t, tok, false))) { await runChain(S.SUBSTACK, t, tok); await nextFrame(tok); }
        break;
      case 'control_stop':
        if (f.STOP_OPTION === 'all') { stopAll(); throw STOP; }
        throw STOP; // 'this script'
      case 'sensing_resettimer': timerStart = performance.now(); break;
      case 'sensing_askandwait': await ask(String(await ev(I.QUESTION, t, tok, '')), tok); break;

      // variables
      case 'data_setvariableto': vars.set(f.VARIABLE, await ev(I.VALUE, t, tok, '')); break;
      case 'data_changevariableby': vars.set(f.VARIABLE, toNum(vars.get(f.VARIABLE)) + toNum(await ev(I.VALUE, t, tok))); break;
      case 'data_showvariable': monitorShown.set(f.VARIABLE, true); break;
      case 'data_hidevariable': monitorShown.set(f.VARIABLE, false); break;
    }
  }

  function wrapDir(d) { d = d % 360; if (d > 180) d -= 360; if (d <= -180) d += 360; return d; }
  function moveTo(t, x, y) { t.x = Math.max(-260, Math.min(260, x)); t.y = Math.max(-195, Math.min(195, y)); }
  function targetByName(name) { return targets.find(o => o.name === name && !o.isStage); }

  async function waitSecs(secs, tok) {
    const end = performance.now() + Math.max(0, secs) * 1000;
    do { await nextFrame(tok); } while (performance.now() < end);
  }

  // ---------- collision ----------
  function bbox(t) {
    const c = (t.model.costumes || [])[t.costume];
    if (!c) return { l: t.x - 10, r: t.x + 10, t: t.y + 10, b: t.y - 10 };
    const s = t.size / 100;
    const w = (c.width || 60) * s, h = (c.height || 60) * s;
    const rad = t.rotationStyle === 'all around' ? (t.direction - 90) * Math.PI / 180 : 0;
    const cw = Math.abs(w * Math.cos(rad)) + Math.abs(h * Math.sin(rad));
    const ch = Math.abs(w * Math.sin(rad)) + Math.abs(h * Math.cos(rad));
    return { l: t.x - cw / 2, r: t.x + cw / 2, t: t.y + ch / 2, b: t.y - ch / 2 };
  }
  function touching(t, what) {
    if (t.isStage) return false;
    const b = bbox(t);
    if (what === '_edge_') return b.l <= -W / 2 || b.r >= W / 2 || b.t >= H / 2 || b.b <= -H / 2;
    if (what === '_mouse_') return mouse.x >= b.l && mouse.x <= b.r && mouse.y >= b.b && mouse.y <= b.t;
    const o = targetByName(what);
    if (!o || !o.visible) return false;
    const b2 = bbox(o);
    return b.l < b2.r && b.r > b2.l && b.b < b2.t && b.t > b2.b;
  }
  function bounce(t) {
    const b = bbox(t);
    const rad = (90 - t.direction) * Math.PI / 180;
    let dx = Math.cos(rad), dy = Math.sin(rad);
    if (b.l <= -W / 2) dx = Math.abs(dx);
    if (b.r >= W / 2) dx = -Math.abs(dx);
    if (b.b <= -H / 2) dy = Math.abs(dy);
    if (b.t >= H / 2) dy = -Math.abs(dy);
    t.direction = wrapDir(90 - Math.atan2(dy, dx) * 180 / Math.PI);
    moveTo(t, Math.max(-W / 2 + (t.x - b.l), Math.min(W / 2 - (b.r - t.x), t.x)),
      Math.max(-H / 2 + (t.y - b.b), Math.min(H / 2 - (b.t - t.y), t.y)));
  }

  // ---------- sound ----------
  function playSound(t, name, wait, tok) {
    const snd = (t.model.sounds || []).find(s => s.name === name);
    if (!snd) return Promise.resolve();
    const a = new Audio(snd.url);
    activeSounds.add(a);
    a.play().catch(() => {});
    const done = new Promise(res => { a.onended = a.onerror = () => { activeSounds.delete(a); res(); }; });
    if (!wait) return;
    return (async () => {
      let finished = false; done.then(() => finished = true);
      while (!finished) await nextFrame(tok);
    })();
  }
  function stopSounds() { for (const a of activeSounds) { a.pause(); } activeSounds.clear(); }

  // ---------- ask ----------
  let askResolve = null;
  async function ask(question, tok) {
    const bar = document.getElementById('askBar');
    document.getElementById('askQuestion').textContent = question;
    const input = document.getElementById('askInput');
    input.value = '';
    bar.style.display = 'flex';
    input.focus();
    let done = false;
    askResolve = v => { answer = v; done = true; bar.style.display = 'none'; };
    try { while (!done) await nextFrame(tok); }
    finally { if (!done) bar.style.display = 'none'; askResolve = null; }
  }

  // ---------- events ----------
  function doBroadcast(message) {
    const m = message.toLowerCase();
    for (const h of broadcastHandlers) {
      if (h.message === m) {
        if (h.token) h.token.cancelled = true;
        h.token = spawn(h.targetIdx, h.node);
      }
    }
  }

  function greenFlag() {
    stopAll();
    runId++;
    running = true;
    timerStart = performance.now();
    answer = '';
    const flagScripts = compile(getProject());
    for (const s of flagScripts) spawn(s.targetIdx, s.node);
  }
  function stopAll() {
    runId++;
    running = false;
    stopSounds();
    for (const t of targets) t.say = null;
    const bar = document.getElementById('askBar');
    if (bar) bar.style.display = 'none';
  }

  // ---------- render loop ----------
  function stageToCanvas(x, y) { return [W / 2 + x, H / 2 - y]; }

  function drawTarget(t) {
    const c = (t.model.costumes || [])[t.costume];
    if (!c) return;
    const img = imageFor(c.url);
    if (!img.complete || !img.naturalWidth) return;
    const s = t.size / 100;
    const [cx, cy] = stageToCanvas(t.x, t.y);
    ctx2d.save();
    ctx2d.translate(cx, cy);
    if (t.rotationStyle === 'all around') ctx2d.rotate((t.direction - 90) * Math.PI / 180);
    else if (t.rotationStyle === 'left-right' && t.direction < 0) ctx2d.scale(-1, 1);
    ctx2d.drawImage(img, -c.cx * s, -c.cy * s, c.width * s, c.height * s);
    ctx2d.restore();
  }

  function drawSay(t) {
    if (!t.say || !t.say.text) return;
    const c = (t.model.costumes || [])[t.costume];
    const s = t.size / 100;
    const topY = t.y + ((c ? c.cy : 30) * s);
    let [bx, by] = stageToCanvas(t.x + 20, topY);
    ctx2d.font = '13px "Helvetica Neue", Arial, sans-serif';
    const text = String(t.say.text).slice(0, 60);
    const w = Math.min(180, Math.max(40, ctx2d.measureText(text).width + 20));
    const h = 30;
    by = Math.max(h + 12, by - 8);
    bx = Math.min(W - w - 4, Math.max(4, bx));
    ctx2d.save();
    ctx2d.fillStyle = '#fff';
    ctx2d.strokeStyle = '#c8cad0';
    ctx2d.lineWidth = 1.5;
    if (t.say.think) ctx2d.setLineDash([4, 3]);
    ctx2d.beginPath();
    ctx2d.roundRect(bx, by - h, w, h, 10);
    ctx2d.fill(); ctx2d.stroke();
    ctx2d.setLineDash([]);
    ctx2d.beginPath();
    ctx2d.moveTo(bx + 14, by); ctx2d.lineTo(bx + 10, by + 8); ctx2d.lineTo(bx + 26, by);
    ctx2d.closePath(); ctx2d.fill();
    ctx2d.strokeStyle = '#c8cad0';
    ctx2d.fillStyle = '#575e75';
    ctx2d.fillText(text, bx + 10, by - h / 2 + 4);
    ctx2d.restore();
  }

  function drawMonitors() {
    let y = 6;
    ctx2d.font = 'bold 11px "Helvetica Neue", Arial, sans-serif';
    for (const [name, val] of vars) {
      if (!monitorShown.get(name)) continue;
      const label = name;
      const value = String(typeof val === 'number' ? Math.round(val * 1000) / 1000 : val);
      const lw = ctx2d.measureText(label).width;
      const vw = Math.max(24, ctx2d.measureText(value).width + 12);
      const w = lw + vw + 18;
      ctx2d.save();
      ctx2d.fillStyle = 'rgba(230,240,255,.95)';
      ctx2d.strokeStyle = '#c4ccd9';
      ctx2d.beginPath(); ctx2d.roundRect(6, y, w, 20, 4); ctx2d.fill(); ctx2d.stroke();
      ctx2d.fillStyle = '#575e75';
      ctx2d.fillText(label, 12, y + 14);
      ctx2d.fillStyle = '#ff8c1a';
      ctx2d.beginPath(); ctx2d.roundRect(12 + lw + 4, y + 3, vw, 14, 4); ctx2d.fill();
      ctx2d.fillStyle = '#fff';
      ctx2d.fillText(value, 12 + lw + 10, y + 14);
      ctx2d.restore();
      y += 24;
    }
  }

  function displayTargets() {
    if (running && targets.length) return targets;
    // edit mode: mirror the live project models
    const p = getProject();
    return [p.stage, ...p.sprites].map(m => ({
      model: m, isStage: !!m.isStage, name: m.name,
      x: m.x || 0, y: m.y || 0, direction: m.direction == null ? 90 : m.direction,
      size: m.size == null ? 100 : m.size, visible: m.visible !== false,
      rotationStyle: m.rotationStyle || 'all around',
      costume: m.currentCostume || 0, say: null,
    }));
  }

  function frame() {
    const list = displayTargets();
    ctx2d.clearRect(0, 0, W, H);
    ctx2d.fillStyle = '#fff';
    ctx2d.fillRect(0, 0, W, H);
    for (const t of list) {
      if (t.isStage) drawTarget(t);
    }
    for (const t of list) {
      if (!t.isStage && t.visible) drawTarget(t);
    }
    for (const t of list) drawSay(t);
    if (running) drawMonitors();
    const resolvers = frameResolvers;
    frameResolvers = [];
    for (const r of resolvers) r();
    requestAnimationFrame(frame);
  }

  // ---------- public ----------
  function init(canvasEl, projectGetter) {
    canvas = canvasEl;
    ctx2d = canvas.getContext('2d');
    getProject = projectGetter;

    window.addEventListener('keydown', e => {
      if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA' || e.target.isContentEditable) return;
      const k = scratchKey(e);
      if (!k) return;
      keysDown.add(k);
      if (running) {
        for (const h of keyHandlers) {
          if ((h.key === 'any' || h.key === k) && !e.repeat) spawn(h.targetIdx, h.node);
        }
      }
    });
    window.addEventListener('keyup', e => { const k = scratchKey(e); if (k) keysDown.delete(k); });

    canvas.addEventListener('pointermove', e => {
      const r = canvas.getBoundingClientRect();
      mouse.x = ((e.clientX - r.left) / r.width) * W - W / 2;
      mouse.y = H / 2 - ((e.clientY - r.top) / r.height) * H;
    });
    canvas.addEventListener('pointerdown', () => { mouse.down = true; });
    window.addEventListener('pointerup', () => { mouse.down = false; });

    canvas.addEventListener('click', () => {
      if (!running) return;
      for (let i = targets.length - 1; i >= 0; i--) {
        const t = targets[i];
        if (t.isStage || !t.visible) continue;
        const b = bbox(t);
        if (mouse.x >= b.l && mouse.x <= b.r && mouse.y >= b.b && mouse.y <= b.t) {
          for (const h of clickHandlers) if (h.targetIdx === t.idx) spawn(h.targetIdx, h.node);
          break;
        }
      }
    });

    const askInput = document.getElementById('askInput');
    if (askInput) {
      askInput.addEventListener('keydown', e => {
        if (e.key === 'Enter' && askResolve) askResolve(askInput.value);
        e.stopPropagation();
      });
    }
    requestAnimationFrame(frame);
  }

  return {
    init, greenFlag, stopAll,
    isRunning: () => running,
    stageMouse: mouse,
    hitTest(x, y) { // edit-mode hit test for dragging sprites (stage coords)
      const p = getProject();
      for (let i = p.sprites.length - 1; i >= 0; i--) {
        const m = p.sprites[i];
        if (m.visible === false) continue;
        const c = (m.costumes || [])[m.currentCostume || 0];
        if (!c) continue;
        const s = (m.size == null ? 100 : m.size) / 100;
        const w = c.width * s / 2, h = c.height * s / 2;
        if (x >= m.x - w && x <= m.x + w && y >= m.y - h && y <= m.y + h) return m;
      }
      return null;
    },
  };
})();
