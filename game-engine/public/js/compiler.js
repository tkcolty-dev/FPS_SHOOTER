/* Spark Engine — compiles scratch-blocks workspace XML into async JavaScript */
(function () {
  const NUM_SHADOWS = new Set(['math_number', 'math_integer', 'math_whole_number', 'math_positive_number', 'math_angle', 'note']);

  /* ---------- XML -> plain block tree ---------- */
  function parseXML(xmlString) {
    const doc = new DOMParser().parseFromString(xmlString || '<xml></xml>', 'text/xml');
    const root = doc.documentElement;
    const variables = [];
    const scripts = [];
    for (const el of Array.from(root.children)) {
      if (el.tagName === 'variables') {
        for (const v of Array.from(el.children)) {
          variables.push({ id: v.getAttribute('id'), name: v.textContent, type: v.getAttribute('type') || '', isLocal: v.getAttribute('islocal') === 'true', isCloud: v.getAttribute('iscloud') === 'true' });
        }
      } else if (el.tagName === 'block') scripts.push(parseBlock(el));
    }
    return { variables, scripts };
  }

  function parseBlock(el) {
    const b = { type: el.getAttribute('type'), id: el.getAttribute('id'), fields: {}, values: {}, statements: {}, next: null, mutation: null, shadow: el.tagName === 'shadow', x: el.getAttribute('x'), y: el.getAttribute('y') };
    for (const ch of Array.from(el.children)) {
      const name = ch.getAttribute('name');
      switch (ch.tagName) {
        case 'field': b.fields[name] = { text: ch.textContent, id: ch.getAttribute('id'), variabletype: ch.getAttribute('variabletype') }; break;
        case 'value': {
          let block = null, shadow = null;
          for (const c of Array.from(ch.children)) { if (c.tagName === 'block') block = c; else if (c.tagName === 'shadow') shadow = c; }
          b.values[name] = parseBlock(block || shadow || ch.firstElementChild || ch);
          if (!block && !shadow) b.values[name] = null;
          break;
        }
        case 'statement': b.statements[name] = ch.firstElementChild ? parseBlock(ch.firstElementChild) : null; break;
        case 'next': b.next = ch.firstElementChild ? parseBlock(ch.firstElementChild) : null; break;
        case 'mutation': { b.mutation = {}; for (const a of Array.from(ch.attributes)) b.mutation[a.name] = a.value; break; }
      }
    }
    return b;
  }

  /* ---------- helpers for generators ---------- */
  const q = s => JSON.stringify(String(s ?? ''));
  const numLit = t => { const s = String(t ?? '').trim(); return s !== '' && /^-?\d*\.?\d+(e-?\d+)?$/i.test(s) ? String(Number(s)) : q(s); };

  class Ctx {
    constructor() { this.uid = 0; this.hasLoops = false; }
    id(p) { return p + (++this.uid); }
    field(b, name) { const f = b.fields[name]; return f ? f.text : ''; }
    val(b, name, dflt = '0') {
      const v = b.values[name];
      if (!v) return dflt;
      return this.expr(v);
    }
    sub(b, name) { return this.stmts(b.statements[name]); }
    stmts(block) {
      let out = '';
      while (block) { out += this.stmt(block) + '\n'; block = block.next; }
      return out;
    }
    expr(b) {
      if (!b) return '0';
      const t = b.type;
      if (NUM_SHADOWS.has(t)) return numLit(b.fields.NUM?.text ?? b.fields.NOTE?.text);
      if (t === 'text') return q(b.fields.TEXT?.text);
      if (t === 'colour_picker') return q(b.fields.COLOUR?.text);
      const g = EXPR[t];
      if (g) return g(b, this);
      // menu blocks: single field → string
      const keys = Object.keys(b.fields);
      if (keys.length === 1) return q(b.fields[keys[0]].text);
      console.warn('Spark: unknown reporter', t);
      return '0';
    }
    stmt(b) {
      const g = STMT[b.type];
      if (g) return g(b, this);
      console.warn('Spark: unknown block', b.type);
      return `/* unknown ${b.type} */`;
    }
  }

  const n = (c, b, name, d = '0') => `R.num(${c.val(b, name, d)})`;
  const s = (c, b, name, d = '""') => `R.str(${c.val(b, name, d)})`;
  const bool = (c, b, name) => `R.bool(${c.val(b, name, 'false')})`;
  const f = (c, b, name) => q(c.field(b, name));
  const list = (c, b) => `R.l(S,${f(c, b, 'LIST')})`;

  /* ---------- statement generators ---------- */
  const STMT = {
    // motion
    motion_movesteps: (b, c) => `S.move(${n(c, b, 'STEPS')});`,
    motion_turnright: (b, c) => `S.turn(${n(c, b, 'DEGREES')});`,
    motion_turnleft: (b, c) => `S.turn(-${n(c, b, 'DEGREES')});`,
    motion_pointindirection: (b, c) => `S.setDirection(${n(c, b, 'DIRECTION')});`,
    motion_pointtowards: (b, c) => `S.pointTowards(${s(c, b, 'TOWARDS')});`,
    motion_gotoxy: (b, c) => `S.goTo(${n(c, b, 'X')}, ${n(c, b, 'Y')});`,
    motion_goto: (b, c) => `S.goToTarget(${s(c, b, 'TO')});`,
    motion_glidesecstoxy: (b, c) => `await S.glide(T, ${n(c, b, 'SECS')}, ${n(c, b, 'X')}, ${n(c, b, 'Y')});`,
    motion_glideto: (b, c) => `await S.glideTo(T, ${n(c, b, 'SECS')}, ${s(c, b, 'TO')});`,
    motion_changexby: (b, c) => `S.setX(S.x + ${n(c, b, 'DX')});`,
    motion_setx: (b, c) => `S.setX(${n(c, b, 'X')});`,
    motion_changeyby: (b, c) => `S.setY(S.y + ${n(c, b, 'DY')});`,
    motion_sety: (b, c) => `S.setY(${n(c, b, 'Y')});`,
    motion_ifonedgebounce: () => `S.bounceOnEdge();`,
    motion_setrotationstyle: (b, c) => `S.rotationStyle = ${f(c, b, 'STYLE')};`,
    spark_motion_toward: (b, c) => `S.moveToward(${n(c, b, 'STEPS')}, ${s(c, b, 'TARGET')});`,
    spark_motion_fence: () => `S.fence();`,
    spark_motion_face: (b, c) => `S.faceDirection(${f(c, b, 'DIR')});`,
    // looks
    looks_say: (b, c) => `S.say(${c.val(b, 'MESSAGE', '""')}, false);`,
    looks_think: (b, c) => `S.say(${c.val(b, 'MESSAGE', '""')}, true);`,
    looks_sayforsecs: (b, c) => `await S.sayFor(T, ${c.val(b, 'MESSAGE', '""')}, ${n(c, b, 'SECS')}, false);`,
    looks_thinkforsecs: (b, c) => `await S.sayFor(T, ${c.val(b, 'MESSAGE', '""')}, ${n(c, b, 'SECS')}, true);`,
    looks_show: () => `S.visible = true;`,
    looks_hide: () => `S.visible = false;`,
    looks_switchcostumeto: (b, c) => `S.setCostume(${c.val(b, 'COSTUME', '1')});`,
    looks_nextcostume: () => `S.nextCostume();`,
    looks_switchbackdropto: (b, c) => `R.setBackdrop(${c.val(b, 'BACKDROP', '1')});`,
    looks_switchbackdroptoandwait: (b, c) => `await R.setBackdropAndWait(T, ${c.val(b, 'BACKDROP', '1')});`,
    looks_nextbackdrop: () => `R.nextBackdrop();`,
    looks_changeeffectby: (b, c) => `S.changeEffect(${f(c, b, 'EFFECT')}, ${n(c, b, 'CHANGE')});`,
    looks_seteffectto: (b, c) => `S.setEffect(${f(c, b, 'EFFECT')}, ${n(c, b, 'VALUE')});`,
    looks_cleargraphiceffects: () => `S.clearEffects();`,
    looks_changesizeby: (b, c) => `S.setSize(S.size + ${n(c, b, 'CHANGE')});`,
    looks_setsizeto: (b, c) => `S.setSize(${n(c, b, 'SIZE')});`,
    looks_gotofrontback: (b, c) => `R.layerFrontBack(S, ${f(c, b, 'FRONT_BACK')});`,
    looks_goforwardbackwardlayers: (b, c) => `R.layerMove(S, ${f(c, b, 'FORWARD_BACKWARD')}, ${n(c, b, 'NUM')});`,
    spark_looks_flip: (b, c) => `S.flip(${f(c, b, 'DIR')});`,
    // sound
    sound_play: (b, c) => `S.playSound(${c.val(b, 'SOUND_MENU', '""')});`,
    sound_playuntildone: (b, c) => `await S.playSoundUntilDone(T, ${c.val(b, 'SOUND_MENU', '""')});`,
    sound_stopallsounds: () => `R.stopAllSounds();`,
    sound_seteffectto: (b, c) => `S.setSoundEffect(${f(c, b, 'EFFECT')}, ${n(c, b, 'VALUE')}, false);`,
    sound_changeeffectby: (b, c) => `S.setSoundEffect(${f(c, b, 'EFFECT')}, ${n(c, b, 'VALUE')}, true);`,
    sound_cleareffects: () => `S.clearSoundEffects();`,
    sound_changevolumeby: (b, c) => `S.setVolume(S.volume + ${n(c, b, 'VOLUME')});`,
    sound_setvolumeto: (b, c) => `S.setVolume(${n(c, b, 'VOLUME')});`,
    spark_sound_note: (b, c) => `await S.playNote(T, ${n(c, b, 'NOTE', '60')}, ${n(c, b, 'BEATS', '0.25')});`,
    spark_sound_drum: (b, c) => `await S.playDrum(T, ${f(c, b, 'DRUM')}, ${n(c, b, 'BEATS', '0.25')});`,
    spark_sound_rest: (b, c) => `await T.wait(60 / R.tempo * ${n(c, b, 'BEATS', '0.25')});`,
    spark_sound_tempo: (b, c) => `R.tempo = Math.max(20, Math.min(500, ${n(c, b, 'TEMPO', '60')}));`,
    spark_sound_preset: (b, c) => `S.playPreset(${f(c, b, 'PRESET')});`,
    // events
    event_broadcast: (b, c) => `R.broadcast(${s(c, b, 'BROADCAST_INPUT')});`,
    event_broadcastandwait: (b, c) => `await R.broadcastAndWait(T, ${s(c, b, 'BROADCAST_INPUT')});`,
    // control
    control_wait: (b, c) => `await T.wait(${n(c, b, 'DURATION')});`,
    control_repeat: (b, c) => { const i = c.id('i'), k = c.id('k'); return `for (let ${i} = 0, ${k} = Math.round(${n(c, b, 'TIMES')}); ${i} < ${k}; ${i}++) {\n${c.sub(b, 'SUBSTACK')}await T.yield();\n}`; },
    control_forever: (b, c) => `while (true) {\n${c.sub(b, 'SUBSTACK')}await T.yield();\n}`,
    control_if: (b, c) => `if (${bool(c, b, 'CONDITION')}) {\n${c.sub(b, 'SUBSTACK')}}`,
    control_if_else: (b, c) => `if (${bool(c, b, 'CONDITION')}) {\n${c.sub(b, 'SUBSTACK')}} else {\n${c.sub(b, 'SUBSTACK2')}}`,
    control_wait_until: (b, c) => `while (!${bool(c, b, 'CONDITION')}) await T.yield();`,
    control_repeat_until: (b, c) => `while (!${bool(c, b, 'CONDITION')}) {\n${c.sub(b, 'SUBSTACK')}await T.yield();\n}`,
    control_while: (b, c) => `while (${bool(c, b, 'CONDITION')}) {\n${c.sub(b, 'SUBSTACK')}await T.yield();\n}`,
    control_for_each: (b, c) => { const i = c.id('i'); return `for (let ${i} = 1; ${i} <= ${n(c, b, 'VALUE')}; ${i}++) { R.setV(S, ${f(c, b, 'VARIABLE')}, ${i});\n${c.sub(b, 'SUBSTACK')}await T.yield();\n}`; },
    control_all_at_once: (b, c) => `T.warp++; try {\n${c.sub(b, 'SUBSTACK')}} finally { T.warp--; }`,
    control_stop: (b, c) => {
      const opt = c.field(b, 'STOP_OPTION');
      if (opt === 'all') return `R.stopAll(); throw R.STOP;`;
      if (opt === 'other scripts in sprite') return `R.stopOthers(S, T);`;
      return `throw R.STOP;`;
    },
    control_create_clone_of: (b, c) => `R.createClone(S, ${s(c, b, 'CLONE_OPTION')});`,
    control_delete_this_clone: () => `if (S.isClone) { R.deleteClone(S); throw R.STOP; }`,
    control_incr_counter: () => `R.counter++;`,
    control_clear_counter: () => `R.counter = 0;`,
    // sensing
    sensing_askandwait: (b, c) => `await R.ask(T, S, ${s(c, b, 'QUESTION')});`,
    sensing_setdragmode: (b, c) => `S.draggable = ${f(c, b, 'DRAG_MODE')} === "draggable";`,
    sensing_resettimer: () => `R.resetTimer();`,
    // data
    data_setvariableto: (b, c) => `R.setV(S, ${f(c, b, 'VARIABLE')}, ${c.val(b, 'VALUE', '0')});`,
    data_changevariableby: (b, c) => `R.changeV(S, ${f(c, b, 'VARIABLE')}, ${n(c, b, 'VALUE')});`,
    data_showvariable: (b, c) => `R.showMonitor(S, ${f(c, b, 'VARIABLE')}, true);`,
    data_hidevariable: (b, c) => `R.showMonitor(S, ${f(c, b, 'VARIABLE')}, false);`,
    data_addtolist: (b, c) => `${list(c, b)}.push(${c.val(b, 'ITEM', '""')});`,
    data_deleteoflist: (b, c) => `R.listDelete(${list(c, b)}, ${c.val(b, 'INDEX', '1')});`,
    data_deletealloflist: (b, c) => `${list(c, b)}.length = 0;`,
    data_insertatlist: (b, c) => `R.listInsert(${list(c, b)}, ${c.val(b, 'INDEX', '1')}, ${c.val(b, 'ITEM', '""')});`,
    data_replaceitemoflist: (b, c) => `R.listReplace(${list(c, b)}, ${c.val(b, 'INDEX', '1')}, ${c.val(b, 'ITEM', '""')});`,
    data_showlist: (b, c) => `R.showMonitor(S, ${f(c, b, 'LIST')}, true, true);`,
    data_hidelist: (b, c) => `R.showMonitor(S, ${f(c, b, 'LIST')}, false, true);`,
    // procedures
    procedures_call: (b, c) => {
      const m = b.mutation || {};
      const ids = JSON.parse(m.argumentids || '[]');
      const args = ids.map(id => c.val(b, id, '""'));
      return `await R.callProc(S, T, ${q(m.proccode)}, [${args.join(', ')}]);`;
    },
    // pen
    pen_clear: () => `R.pen.clear();`,
    pen_stamp: () => `R.pen.stamp(S);`,
    pen_penDown: () => `S.penDown();`,
    pen_penUp: () => `S.pen.down = false;`,
    pen_setPenColorToColor: (b, c) => `S.setPenColor(${s(c, b, 'COLOR')});`,
    pen_changePenSizeBy: (b, c) => `S.pen.size = Math.max(1, S.pen.size + ${n(c, b, 'SIZE')});`,
    pen_setPenSizeTo: (b, c) => `S.pen.size = Math.max(1, ${n(c, b, 'SIZE')});`,
    pen_setPenTransparency: (b, c) => `S.pen.alpha = 1 - Math.max(0, Math.min(100, ${n(c, b, 'VALUE')})) / 100;`,
    // physics
    spark_phys_mode: (b, c) => `S.setPhysics(${f(c, b, 'MODE')});`,
    spark_phys_setgravity: (b, c) => `S.phys.gravity = ${n(c, b, 'GRAVITY')};`,
    spark_phys_setvel: (b, c) => `S.phys.vx = ${n(c, b, 'VX')}; S.phys.vy = ${n(c, b, 'VY')};`,
    spark_phys_changevel: (b, c) => `S.phys.vx += ${n(c, b, 'VX')}; S.phys.vy += ${n(c, b, 'VY')};`,
    spark_phys_jump: (b, c) => `S.jump(${n(c, b, 'POWER')});`,
    spark_phys_solid: (b, c) => `S.phys.solid = ${f(c, b, 'SOLID')} === "solid";`,
    spark_phys_setbounce: (b, c) => `S.phys.bounce = Math.max(0, Math.min(1, ${n(c, b, 'BOUNCE')}));`,
    spark_phys_setfriction: (b, c) => `S.phys.friction = Math.max(0, Math.min(1, ${n(c, b, 'FRICTION')}));`,
    spark_phys_setmaxspeed: (b, c) => `S.phys.maxSpeed = Math.max(0, ${n(c, b, 'SPEED')});`,
    spark_phys_control: (b, c) => `S.controlWith(${f(c, b, 'KEYS')}, ${n(c, b, 'SPEED')});`,
    // camera
    spark_cam_follow: (b, c) => `R.cam.follow = R.findTarget(S, ${s(c, b, 'TARGET')});`,
    spark_cam_stop: () => `R.cam.follow = null;`,
    spark_cam_goto: (b, c) => `R.cam.follow = null; R.cam.x = ${n(c, b, 'X')}; R.cam.y = ${n(c, b, 'Y')};`,
    spark_cam_change: (b, c) => `R.cam.follow = null; R.cam.x += ${n(c, b, 'X')}; R.cam.y += ${n(c, b, 'Y')};`,
    spark_cam_zoom: (b, c) => `R.cam.zoom = Math.max(0.1, ${n(c, b, 'ZOOM')} / 100);`,
    spark_cam_shake: (b, c) => `R.cam.shakeFor(${n(c, b, 'AMOUNT')}, ${n(c, b, 'SECS')});`,
    spark_cam_sticky: (b, c) => `S.sticky = ${f(c, b, 'MODE')} === "stays on screen";`,
    spark_cam_bounds: (b, c) => `R.cam.bounds = { x1: ${n(c, b, 'X1')}, x2: ${n(c, b, 'X2')}, y1: ${n(c, b, 'Y1')}, y2: ${n(c, b, 'Y2')} };`,
    spark_cam_nobounds: () => `R.cam.bounds = null;`,
    // effects
    spark_fx_burst: (b, c) => `R.particles.burst(${f(c, b, 'PRESET')}, S.x, S.y);`,
    spark_fx_burstat: (b, c) => `R.particles.burst(${f(c, b, 'PRESET')}, ${n(c, b, 'X')}, ${n(c, b, 'Y')});`,
    spark_fx_trail: (b, c) => `S.trail = ${f(c, b, 'PRESET')} === "off" ? null : ${f(c, b, 'PRESET')};`,
    spark_fx_flash: (b, c) => `R.screenFlash(${s(c, b, 'COLOR')}, ${n(c, b, 'SECS')});`,
    spark_fx_fade: (b, c) => `await R.fade(T, ${f(c, b, 'MODE')}, ${n(c, b, 'SECS')});`,
    spark_fx_timescale: (b, c) => `R.timeScale = Math.max(0, ${n(c, b, 'SPEED')} / 100);`,
    spark_fx_shadow: (b, c) => `S.shadow = ${f(c, b, 'ON')} === "on";`,
    spark_fx_glow: (b, c) => `S.glow = ${f(c, b, 'ON')} === "off" ? null : { color: ${s(c, b, 'COLOR')}, size: 18 };`,
    spark_fx_tint: (b, c) => `S.tintFor(${s(c, b, 'COLOR')}, ${n(c, b, 'SECS')});`,
    spark_fx_squash: (b, c) => `S.squash(${n(c, b, 'AMOUNT')});`,
    // game
    spark_game_set: (b, c) => `R.game.set(${f(c, b, 'STAT')}, ${n(c, b, 'VALUE')});`,
    spark_game_change: (b, c) => `R.game.change(${f(c, b, 'STAT')}, ${n(c, b, 'VALUE')});`,
    spark_game_hud: (b, c) => `R.game.hud(${f(c, b, 'STAT')}, ${f(c, b, 'ON')} === "on");`,
    spark_game_over: (b, c) => `R.game.over(${s(c, b, 'TEXT')}, false); throw R.STOP;`,
    spark_game_win: (b, c) => `R.game.over(${s(c, b, 'TEXT')}, true); throw R.STOP;`,
    spark_game_restart: () => `R.restart(); throw R.STOP;`,
    spark_game_countdown: (b, c) => `R.game.startCountdown(${n(c, b, 'SECS')});`,
    spark_game_save: (b, c) => `R.save(${s(c, b, 'KEY')}, ${c.val(b, 'VALUE', '0')});`,
    spark_game_pause: (b, c) => `R.setPaused(T, ${f(c, b, 'MODE')} === "pause");`,
    spark_game_toast: (b, c) => `R.toast(${s(c, b, 'TEXT')}, ${n(c, b, 'SECS')});`,
    spark_game_spawn: (b, c) => `R.spawn(S, ${s(c, b, 'TARGET')}, ${n(c, b, 'X')}, ${n(c, b, 'Y')});`,
    // text
    spark_text_show: (b, c) => `S.showText(${s(c, b, 'TEXT')}, ${n(c, b, 'SIZE')}, ${s(c, b, 'COLOR')});`,
    spark_text_clear: () => `S.showText(null);`,
    spark_text_speak: (b, c) => `await R.speak(T, ${s(c, b, 'TEXT')});`,
    spark_text_voice: (b, c) => `R.voice = ${f(c, b, 'VOICE')};`,
    spark_text_font: (b, c) => `S.font = ${f(c, b, 'FONT')};`,
    spark_text_dialogue: (b, c) => `await R.dialogue(T, ${s(c, b, 'NAME')}, ${s(c, b, 'TEXT')});`,
    spark_text_type: (b, c) => `await S.typeText(T, ${s(c, b, 'TEXT')});`,
    spark_text_style: (b, c) => `S.textStyle = { size: ${n(c, b, 'SIZE', '24')}, color: ${s(c, b, 'COLOR')} }; if (S.textCostume) S.showText(S.textCostume.text);`,
    spark_text_label: (b, c) => `R.label(${f(c, b, 'POS')}, ${s(c, b, 'TEXT')});`,
    spark_text_hidelabel: (b, c) => `R.label(${f(c, b, 'POS')}, null);`,
    // world
    spark_world_generate: (b, c) => `R.generateWorld(${f(c, b, 'TYPE')}, ${n(c, b, 'W', '40')}, ${n(c, b, 'H', '30')}, ${n(c, b, 'SEED', '0')});`,
    spark_world_clear: () => `R.world.clear(); R.cam.bounds = null;`,
    spark_world_tilesize: (b, c) => `R.world.size = Math.max(8, ${n(c, b, 'SIZE', '48')});`,
    spark_world_settile: (b, c) => `R.world.set(R.world.colOf(${n(c, b, 'X')}), R.world.rowOf(${n(c, b, 'Y')}), R.world.kindOf(${f(c, b, 'TILE')}));`,
    spark_world_fill: (b, c) => `R.world.fill(R.world.colOf(${n(c, b, 'X1')}), R.world.rowOf(${n(c, b, 'Y1')}), R.world.colOf(${n(c, b, 'X2')}), R.world.rowOf(${n(c, b, 'Y2')}), R.world.kindOf(${f(c, b, 'TILE')}));`,
    spark_world_gotostart: () => `S.goToWorldStart();`,
    spark_world_gotofree: () => `S.goToFreeTile();`,
    spark_world_camera: () => `R.cameraInsideWorld();`,
    // controller
    spark_pad_rumble: (b, c) => `R.pad.rumble(${n(c, b, 'PLAYER', '1')}, ${n(c, b, 'SECS')});`
  };

  /* ---------- reporter generators ---------- */
  const EXPR = {
    motion_xposition: () => `S.x`, motion_yposition: () => `S.y`, motion_direction: () => `S.direction`,
    looks_costumenumbername: (b, c) => `S.costumeNumberName(${f(c, b, 'NUMBER_NAME')})`,
    looks_backdropnumbername: (b, c) => `R.backdropNumberName(${f(c, b, 'NUMBER_NAME')})`,
    looks_size: () => `S.size`,
    sound_volume: () => `S.volume`,
    sensing_touchingobject: (b, c) => `S.touching(${s(c, b, 'TOUCHINGOBJECTMENU')})`,
    sensing_touchingcolor: (b, c) => `S.touchingColor(${s(c, b, 'COLOR')})`,
    sensing_coloristouchingcolor: (b, c) => `S.colorTouchingColor(${s(c, b, 'COLOR')}, ${s(c, b, 'COLOR2')})`,
    sensing_distanceto: (b, c) => `S.distanceTo(${s(c, b, 'DISTANCETOMENU')})`,
    sensing_answer: () => `R.answer`,
    sensing_keypressed: (b, c) => `R.keyPressed(${s(c, b, 'KEY_OPTION')})`,
    sensing_mousedown: () => `R.mouse.down`, sensing_mousex: () => `R.mouse.x`, sensing_mousey: () => `R.mouse.y`,
    sensing_loudness: () => `R.loudness()`, sensing_loud: () => `(R.loudness() > 10)`,
    sensing_timer: () => `R.timer()`,
    sensing_of: (b, c) => `R.of(${f(c, b, 'PROPERTY')}, ${s(c, b, 'OBJECT')})`,
    sensing_current: (b, c) => `R.current(${f(c, b, 'CURRENTMENU')})`,
    sensing_dayssince2000: () => `R.daysSince2000()`,
    sensing_username: () => `"player"`, sensing_userid: () => `0`, sensing_online: () => `navigator.onLine`,
    spark_sense_touchingedge: (b, c) => `S.touchingEdge(${f(c, b, 'EDGE')})`,
    spark_sense_mouseclicked: () => `R.mouse.clicked`,
    spark_sense_isclone: () => `S.isClone`,
    spark_sense_frame: () => `R.frame`,
    operator_add: (b, c) => `(${n(c, b, 'NUM1')} + ${n(c, b, 'NUM2')})`,
    operator_subtract: (b, c) => `(${n(c, b, 'NUM1')} - ${n(c, b, 'NUM2')})`,
    operator_multiply: (b, c) => `(${n(c, b, 'NUM1')} * ${n(c, b, 'NUM2')})`,
    operator_divide: (b, c) => `R.div(${n(c, b, 'NUM1')}, ${n(c, b, 'NUM2')})`,
    operator_random: (b, c) => `R.random(${c.val(b, 'FROM', '1')}, ${c.val(b, 'TO', '10')})`,
    operator_lt: (b, c) => `(R.compare(${c.val(b, 'OPERAND1', '""')}, ${c.val(b, 'OPERAND2', '""')}) < 0)`,
    operator_equals: (b, c) => `(R.compare(${c.val(b, 'OPERAND1', '""')}, ${c.val(b, 'OPERAND2', '""')}) === 0)`,
    operator_gt: (b, c) => `(R.compare(${c.val(b, 'OPERAND1', '""')}, ${c.val(b, 'OPERAND2', '""')}) > 0)`,
    operator_and: (b, c) => `(${bool(c, b, 'OPERAND1')} && ${bool(c, b, 'OPERAND2')})`,
    operator_or: (b, c) => `(${bool(c, b, 'OPERAND1')} || ${bool(c, b, 'OPERAND2')})`,
    operator_not: (b, c) => `(!${bool(c, b, 'OPERAND')})`,
    operator_join: (b, c) => `(${s(c, b, 'STRING1')} + ${s(c, b, 'STRING2')})`,
    operator_letter_of: (b, c) => `R.letterOf(${n(c, b, 'LETTER', '1')}, ${s(c, b, 'STRING')})`,
    operator_length: (b, c) => `${s(c, b, 'STRING')}.length`,
    operator_contains: (b, c) => `${s(c, b, 'STRING1')}.toLowerCase().includes(${s(c, b, 'STRING2')}.toLowerCase())`,
    operator_mod: (b, c) => `R.mod(${n(c, b, 'NUM1')}, ${n(c, b, 'NUM2')})`,
    operator_round: (b, c) => `Math.round(${n(c, b, 'NUM')})`,
    operator_mathop: (b, c) => `R.mathop(${f(c, b, 'OPERATOR')}, ${n(c, b, 'NUM')})`,
    data_variable: (b, c) => `R.v(S, ${f(c, b, 'VARIABLE')})`,
    data_listcontents: (b, c) => `R.listContents(${list(c, b)})`,
    data_itemoflist: (b, c) => `R.listItem(${list(c, b)}, ${c.val(b, 'INDEX', '1')})`,
    data_itemnumoflist: (b, c) => `R.listIndexOf(${list(c, b)}, ${c.val(b, 'ITEM', '""')})`,
    data_lengthoflist: (b, c) => `${list(c, b)}.length`,
    data_listcontainsitem: (b, c) => `R.listContains(${list(c, b)}, ${c.val(b, 'ITEM', '""')})`,
    control_get_counter: () => `R.counter`,
    argument_reporter_string_number: (b, c) => `R.arg(A, ${f(c, b, 'VALUE')})`,
    argument_reporter_boolean: (b, c) => `R.bool(R.arg(A, ${f(c, b, 'VALUE')}))`,
    spark_phys_velx: () => `S.phys.vx`, spark_phys_vely: () => `S.phys.vy`,
    spark_phys_onground: () => `S.phys.onGround`,
    spark_phys_touchingsolid: () => `S.touchingSolid()`,
    spark_cam_x: () => `R.cam.x`, spark_cam_y: () => `R.cam.y`,
    spark_game_get: (b, c) => `R.game.get(${f(c, b, 'STAT')})`,
    spark_game_countdownval: () => `R.game.countdown()`,
    spark_game_load: (b, c) => `R.load(${s(c, b, 'KEY')})`,
    spark_game_highscore: () => `R.game.highScore()`,
    spark_game_clonecount: (b, c) => `R.cloneCount(${s(c, b, 'TARGET')})`,
    spark_pad_button: (b, c) => `R.pad.button(${n(c, b, 'PLAYER', '1')}, ${f(c, b, 'BUTTON')})`,
    spark_pad_stick: (b, c) => `R.pad.stick(${n(c, b, 'PLAYER', '1')}, ${f(c, b, 'STICK')}, ${f(c, b, 'AXIS')})`,
    spark_pad_connected: (b, c) => `R.pad.connected(${n(c, b, 'PLAYER', '1')})`,
    spark_text_width: () => `S.bounds().w`,
    spark_text_case: (b, c) => `R.textOp(${f(c, b, 'OP')}, ${s(c, b, 'TEXT')})`,
    spark_text_replace: (b, c) => `R.textOp("replace", ${s(c, b, 'TEXT')}, ${s(c, b, 'FROM')}, ${s(c, b, 'TO')})`,
    spark_text_split: (b, c) => `R.textOp("split", ${s(c, b, 'TEXT')}, ${s(c, b, 'SEP')}, ${n(c, b, 'INDEX', '1')})`,
    spark_text_count: (b, c) => `R.textOp("count", ${s(c, b, 'TEXT')}, ${s(c, b, 'PART')})`,
    spark_text_repeat: (b, c) => `R.textOp("repeat", ${s(c, b, 'TEXT')}, ${n(c, b, 'TIMES', '2')})`,
    spark_text_commas: (b, c) => `R.textOp("commas", ${n(c, b, 'NUM')})`,
    spark_text_dialogopen: () => `(!!R.dialog)`,
    spark_cloud_status: () => `R.cloudStatus`,
    spark_world_tileat: (b, c) => `R.world.nameAt(${n(c, b, 'X')}, ${n(c, b, 'Y')})`,
    spark_world_touching: (b, c) => `S.touchingTile(${f(c, b, 'TILE')})`,
    spark_world_info: (b, c) => `R.worldInfo(${f(c, b, 'WHICH')})`,
    spark_world_active: () => `R.world.active`
  };

  /* ---------- hats ---------- */
  const HATS = {
    event_whenflagclicked: () => ({ hat: 'flag' }),
    event_whenkeypressed: (b, c) => ({ hat: 'key', key: c.field(b, 'KEY_OPTION') }),
    event_whenthisspriteclicked: () => ({ hat: 'click' }),
    event_whenstageclicked: () => ({ hat: 'click' }),
    event_whenbroadcastreceived: (b, c) => ({ hat: 'broadcast', name: c.field(b, 'BROADCAST_OPTION').toLowerCase() }),
    event_whenbackdropswitchesto: (b, c) => ({ hat: 'backdrop', name: c.field(b, 'BACKDROP') }),
    event_whengreaterthan: (b, c) => ({ hat: 'greater', menu: c.field(b, 'WHENGREATERTHANMENU'), cond: `R.num(${c.val(b, 'VALUE', '10')})` }),
    event_whentouchingobject: (b, c) => ({ hat: 'touching', cond: `S.touching(${s(c, b, 'TOUCHINGOBJECTMENU')})` }),
    control_start_as_clone: () => ({ hat: 'clone' }),
    spark_game_whenstat: (b, c) => ({ hat: 'stat', cond: `R.statCheck(${f(c, b, 'STAT')}, ${f(c, b, 'OP')}, ${n(c, b, 'VALUE')})` }),
    spark_game_whencountdown: () => ({ hat: 'countdown' }),
    spark_game_whenover: () => ({ hat: 'gameover' }),
    spark_pad_whenbutton: (b, c) => ({ hat: 'pad', player: c.field(b, 'PLAYER'), button: c.field(b, 'BUTTON') })
  };

  function compile(xmlString) {
    const { variables, scripts } = parseXML(xmlString);
    const c = new Ctx();
    let out = 'const scripts = [], procs = {};\n';
    for (const top of scripts) {
      if (top.type === 'procedures_definition') {
        const proto = top.statements.custom_block || top.values.custom_block;
        const m = (proto && proto.mutation) || {};
        const names = JSON.parse(m.argumentnames || '[]');
        const body = c.stmts(top.next);
        out += `procs[${q(m.proccode)}] = { argNames: ${JSON.stringify(names)}, warp: ${m.warp === 'true'}, fn: async function(S, T, A) {\n${body}} };\n`;
        continue;
      }
      const hatGen = HATS[top.type];
      if (!hatGen) continue; // loose blocks without a hat never run
      const hat = hatGen(top, c);
      const body = c.stmts(top.next);
      const cond = hat.cond ? `function(S) { const A = {}; return (${hat.cond}); }` : 'null';
      delete hat.cond;
      out += `scripts.push({ ...${JSON.stringify(hat)}, id: ${q(top.id)}, cond: ${cond}, fn: async function(S, T) { const A = {};\n${body}} });\n`;
    }
    out += 'return { scripts, procs };';
    let factory;
    try { factory = new Function('R', out); }
    catch (e) { console.error('Spark compile error', e, out); factory = () => ({ scripts: [], procs: {} }); }
    return { factory, variables, source: out };
  }

  window.SparkCompiler = { compile, parseXML, STMT, EXPR, HATS, helpers: { n, s, bool, f, q, list } };
})();
