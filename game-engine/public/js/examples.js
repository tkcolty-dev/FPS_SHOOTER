/* Spark Engine — example games, built with a tiny XML builder */
(function () {
  const Lib = window.SparkLib;
  const uid = () => Math.random().toString(36).slice(2, 10);
  const esc = s => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

  // value specs: number -> number shadow, string -> text shadow, menu(...) -> menu shadow, block -> reporter (with number shadow), bool(block) -> no shadow
  const menu = (type, field, value) => ({ menu: type, field, value });
  const bool = b => ({ bool: b });
  function valueXML(name, spec) {
    if (spec === undefined || spec === null) return '';
    if (typeof spec === 'number') return `<value name="${name}"><shadow type="math_number"><field name="NUM">${spec}</field></shadow></value>`;
    if (typeof spec === 'string') return `<value name="${name}"><shadow type="text"><field name="TEXT">${esc(spec)}</field></shadow></value>`;
    if (spec.menu) return `<value name="${name}"><shadow type="${spec.menu}"><field name="${spec.field}">${esc(spec.value)}</field></shadow></value>`;
    if (spec.bool) return `<value name="${name}">${spec.bool}</value>`;
    if (spec.xml) return `<value name="${name}"><shadow type="math_number"><field name="NUM">0</field></shadow>${spec.xml}</value>`;
    return '';
  }
  // blk(type, {f: fields, v: values, s: substacks, pos:[x,y]}) -> {xml, next(...)}
  function blk(type, o = {}) {
    let fields = '', values = '', stacks = '';
    for (const [k, v] of Object.entries(o.f || {})) fields += typeof v === 'object' ? `<field name="${k}" id="${v.id}" variabletype="${v.type || ''}">${esc(v.name)}</field>` : `<field name="${k}">${esc(v)}</field>`;
    for (const [k, v] of Object.entries(o.v || {})) values += valueXML(k, v);
    for (const [k, v] of Object.entries(o.s || {})) if (v && v.length) stacks += `<statement name="${k}">${chain(v)}</statement>`;
    const pos = o.pos ? ` x="${o.pos[0]}" y="${o.pos[1]}"` : '';
    return { xml: `<block type="${type}" id="${uid()}"${pos}>${fields}${values}${stacks}__NEXT__</block>` };
  }
  function chain(blocks) {
    let out = '';
    for (let i = blocks.length - 1; i >= 0; i--) out = blocks[i].xml.replace('__NEXT__', out ? `<next>${out}</next>` : '');
    return out;
  }
  const script = (blocks, x, y) => { const first = { ...blocks[0] }; first.xml = first.xml.replace(/^<block /, `<block x="${x}" y="${y}" `); return chain([first, ...blocks.slice(1)]); };
  const xml = (...scripts) => `<xml xmlns="http://www.w3.org/1999/xhtml"><variables></variables>${scripts.join('')}</xml>`;

  // shorthands
  const flag = () => blk('event_whenflagclicked');
  const clone = () => blk('control_start_as_clone');
  const forever = (...b) => blk('control_forever', { s: { SUBSTACK: b } });
  const repeat = (n, ...b) => blk('control_repeat', { v: { TIMES: n }, s: { SUBSTACK: b } });
  const iff = (cond, ...b) => blk('control_if', { v: { CONDITION: bool(cond) }, s: { SUBSTACK: b } });
  const wait = s => blk('control_wait', { v: { DURATION: s } });
  const goto = (x, y) => blk('motion_gotoxy', { v: { X: x, Y: y } });
  const show = () => blk('looks_show'), hide = () => blk('looks_hide');
  const rep = (type, o) => ({ xml: blk(type, o).xml.replace('__NEXT__', '') });
  const touching = name => rep('sensing_touchingobject', { v: { TOUCHINGOBJECTMENU: menu('sensing_touchingobjectmenu', 'TOUCHINGOBJECTMENU', name) } }).xml;
  const lt = (a, b) => rep('operator_lt', { v: { OPERAND1: a, OPERAND2: b } }).xml;
  const gt = (a, b) => rep('operator_gt', { v: { OPERAND1: a, OPERAND2: b } }).xml;
  const eq = (a, b) => rep('operator_equals', { v: { OPERAND1: a, OPERAND2: b } }).xml;
  const not = c => rep('operator_not', { v: { OPERAND: bool(c) } }).xml;
  const or = (a, b) => rep('operator_or', { v: { OPERAND1: bool(a), OPERAND2: bool(b) } }).xml;
  const xpos = () => rep('motion_xposition'), ypos = () => rep('motion_yposition');
  const add = (a, b) => rep('operator_add', { v: { NUM1: a, NUM2: b } });
  const rand = (a, b) => rep('operator_random', { v: { FROM: a, TO: b } });
  const stat = (s, v) => blk('spark_game_set', { f: { STAT: s }, v: { VALUE: v } });
  const change = (s, v) => blk('spark_game_change', { f: { STAT: s }, v: { VALUE: v } });
  const hud = (s, on = 'on') => blk('spark_game_hud', { f: { STAT: s, ON: on } });
  const burst = p => blk('spark_fx_burst', { f: { PRESET: p } });
  const play = name => blk('sound_play', { v: { SOUND_MENU: menu('sound_sounds_menu', 'SOUND_MENU', name) } });
  const spawn = (name, x, y) => blk('spark_game_spawn', { v: { TARGET: menu('spark_menu_clone', 'TARGET', name), X: x, Y: y } });
  const cloneMe = () => blk('control_create_clone_of', { v: { CLONE_OPTION: menu('control_create_clone_of_menu', 'CLONE_OPTION', '_myself_') } });
  const delClone = () => blk('control_delete_this_clone');
  const shake = (a, s) => blk('spark_cam_shake', { v: { AMOUNT: a, SECS: s } });
  const toast = (t, s) => blk('spark_game_toast', { v: { TEXT: t, SECS: s } });
  const svgC = (name, svg) => ({ name, src: Lib.svgToDataURL(svg) });
  const costume = (lib, color, name) => svgC(name || lib, Lib.costumeSVG(lib, color));
  const backdrop = name => svgC(name, Lib.backdropSVG(name));
  const sprite = (name, costumes, sounds, scripts, extra = {}) => ({ id: uid(), name, x: 0, y: 0, direction: 90, size: 100, visible: true, rotationStyle: 'left-right', costumes, currentCostume: 0, sounds: sounds.map(s => ({ name: s, preset: s })), xml: xml(...scripts), variables: [], ...extra });

  /* ---------------- Platformer ---------------- */
  function platformer() {
    const hero = sprite('Hero', [costume('Hero', '#4C97FF')], ['Jump', 'Hit', 'Coin'], [
      script([flag(), hide(), goto(-180, -60), wait(0.8), show(), blk('spark_phys_mode', { f: { MODE: 'platformer' } }), stat('lives', 3), stat('score', 0), hud('score'), hud('lives'),
        blk('spark_cam_follow', { v: { TARGET: menu('spark_menu_sprite', 'TARGET', 'Hero') } }),
        blk('spark_cam_bounds', { v: { X1: -240, X2: 1400, Y1: -180, Y2: 400 } }),
        toast('Arrow keys to move, up to jump. Get to the flag!', 4),
        forever(blk('spark_phys_control', { f: { KEYS: 'arrow keys' }, v: { SPEED: 6 } }),
          iff(or(touching('Spike'), lt(ypos(), -230)), change('lives', -1), play('Hit'), burst('explosion'), shake(10, 0.4), goto(-180, -60), blk('spark_phys_setvel', { v: { VX: 0, VY: 0 } })))], 20, 20),
      script([blk('spark_game_whenstat', { f: { STAT: 'lives', OP: '=' }, v: { VALUE: 0 } }), blk('spark_game_over', { v: { TEXT: 'Game Over' } })], 520, 20),
      script([blk('event_whenkeypressed', { f: { KEY_OPTION: 'up arrow' } }), iff(rep('spark_phys_onground').xml, play('Jump'), burst('dust'))], 520, 160)
    ], { x: -180, y: -60 });
    const ground = sprite('Ground', [costume('Grass Block', '#5cb83a')], [], [
      script([flag(), blk('spark_phys_solid', { f: { SOLID: 'solid' } }), hide(), goto(-240, -160),
        repeat(36, iff(not(eq(rep('operator_mod', { v: { NUM1: rep('operator_round', { v: { NUM: rep('operator_divide', { v: { NUM1: add(xpos(), 240), NUM2: 48 } }) } }), NUM2: 9 } }), 7)), cloneMe()), blk('motion_changexby', { v: { DX: 48 } })),
        goto(200, -40), cloneMe(), goto(248, -40), cloneMe(), goto(620, 0), cloneMe(), goto(668, 0), cloneMe(), goto(716, 0), cloneMe(), goto(1000, -30), cloneMe(), goto(1048, -30), cloneMe()], 20, 20),
      script([clone(), show()], 20, 520)
    ], { visible: false, x: -240, y: -160 });
    const spike = sprite('Spike', [costume('Spike', '#9aa0a6')], [], [
      script([flag(), hide(), spawn('_myself_', 330, -120), spawn('_myself_', 378, -120), spawn('_myself_', 800, -120), spawn('_myself_', 1150, -120), spawn('_myself_', 1198, -120)], 20, 20),
      script([clone(), show()], 20, 300)
    ], { visible: false, x: 330, y: -120 });
    const coin = sprite('Coin', [costume('Coin', '#f5c400')], ['Coin'], [
      script([flag(), hide(), goto(-100, -40), repeat(12, spawn('_myself_', xpos(), rep('operator_add', { v: { NUM1: -80, NUM2: rand(0, 60) } })), blk('motion_changexby', { v: { DX: 110 } }))], 20, 20),
      script([clone(), show(), forever(blk('motion_changeyby', { v: { DY: rep('operator_mathop', { f: { OPERATOR: 'sin' }, v: { NUM: rep('operator_multiply', { v: { NUM1: rep('sensing_timer'), NUM2: 200 } }) } }) } }),
        iff(touching('Hero'), change('score', 1), play('Coin'), burst('coins'), delClone()))], 20, 300)
    ], { visible: false, size: 80 });
    const goal = sprite('Goal', [costume('Flag', '#FF6680')], ['Win'], [
      script([flag(), goto(1300, -100), show(), forever(iff(touching('Hero'), play('Win'), burst('confetti'), blk('spark_game_win', { v: { TEXT: 'You made it!' } })))], 20, 20)
    ], { x: 1300, y: -100 });
    return { name: 'Platformer', stage: { name: 'Stage', costumes: [backdrop('Grassland')], currentCostume: 0, sounds: [], xml: xml(), variables: [] }, sprites: [ground, spike, coin, goal, hero], monitors: [] };
  }

  /* ---------------- Space Shooter ---------------- */
  function shooter() {
    const ship = sprite('Ship', [costume('Spaceship', '#5CB1D6')], ['Laser', 'Hit'], [
      script([flag(), goto(0, -130), show(), stat('lives', 3), stat('score', 0), hud('score'), hud('lives'), hud('highscore'), toast('Arrows move • Space shoots', 3),
        forever(blk('spark_phys_control', { f: { KEYS: 'arrow keys' }, v: { SPEED: 6 } }), blk('spark_motion_fence'))], 20, 20),
      script([blk('event_whenkeypressed', { f: { KEY_OPTION: 'space' } }), spawn('Laser', xpos(), add(ypos(), 30)), play('Laser')], 500, 20),
      script([blk('event_whentouchingobject', { v: { TOUCHINGOBJECTMENU: menu('event_touchingobjectmenu', 'TOUCHINGOBJECTMENU', 'Alien') } }), change('lives', -1), play('Hit'), blk('spark_fx_tint', { v: { COLOR: '#ff0000', SECS: 0.3 } }), shake(12, 0.4), burst('explosion')], 500, 160),
      script([blk('spark_game_whenstat', { f: { STAT: 'lives', OP: '=' }, v: { VALUE: 0 } }), burst('explosion'), hide(), blk('spark_game_over', { v: { TEXT: 'Game Over' } })], 500, 330)
    ], { x: 0, y: -130, rotationStyle: 'all around' });
    const laser = sprite('Laser', [costume('Laser', '#ffeb3b')], [], [
      script([flag(), hide()], 20, 20),
      script([clone(), show(), forever(blk('motion_changeyby', { v: { DY: 12 } }), iff(or(touching('Alien'), gt(ypos(), 200)), delClone()))], 20, 160)
    ], { visible: false, size: 70 });
    const alien = sprite('Alien', [costume('Alien', '#59C059')], ['Explosion'], [
      script([flag(), hide(), wait(1), forever(spawn('_myself_', rand(-200, 200), 200), wait(rep('operator_divide', { v: { NUM1: 20, NUM2: add(rep('spark_game_get', { f: { STAT: 'score' } }), 15) } })))], 20, 20),
      script([clone(), show(), blk('looks_setsizeto', { v: { SIZE: rand(60, 110) } }), forever(blk('motion_changeyby', { v: { DY: rep('operator_multiply', { v: { NUM1: -2, NUM2: rep('operator_add', { v: { NUM1: 1, NUM2: rep('operator_divide', { v: { NUM1: rep('spark_game_get', { f: { STAT: 'score' } }), NUM2: 10 } }) } }) } }) } }),
        iff(touching('Laser'), change('score', 1), play('Explosion'), burst('explosion'), delClone()),
        iff(touching('Ship'), delClone()),
        iff(lt(ypos(), -200), delClone()))], 20, 200)
    ], { visible: false });
    return { name: 'Space Shooter', stage: { name: 'Stage', costumes: [backdrop('Space')], currentCostume: 0, sounds: [], xml: xml(), variables: [] }, sprites: [laser, alien, ship], monitors: [] };
  }

  /* ---------------- Coin Chaser (top-down) ---------------- */
  function coins() {
    const cat = sprite('Cat', [costume('Cat', '#FF8C1A')], ['Coin', 'Hit'], [
      script([flag(), goto(0, 0), blk('spark_phys_mode', { f: { MODE: 'top-down' } }), stat('score', 0), stat('health', 100), hud('score'), hud('health'), hud('timer'), blk('spark_game_countdown', { v: { SECS: 30 } }), toast('Grab coins, dodge the slimes! 30 seconds.', 3),
        forever(blk('spark_phys_control', { f: { KEYS: 'arrow keys' }, v: { SPEED: 7 } }), blk('spark_motion_fence'))], 20, 20),
      script([flag(), forever(iff(touching('Slime'), change('health', -5), play('Hit'), blk('spark_fx_tint', { v: { COLOR: '#ff0000', SECS: 0.2 } }), shake(6, 0.2), wait(0.3)))], 20, 400),
      script([blk('spark_game_whencountdown'), blk('spark_game_over', { v: { TEXT: "Time's up!" } })], 520, 20),
      script([blk('spark_game_whenstat', { f: { STAT: 'health', OP: '=' }, v: { VALUE: 0 } }), burst('smoke'), blk('spark_game_over', { v: { TEXT: 'The slimes got you!' } })], 520, 150)
    ]);
    const coin = sprite('Coin', [costume('Coin', '#f5c400')], ['Coin'], [
      script([flag(), hide(), repeat(6, spawn('_myself_', rand(-200, 200), rand(-150, 150)))], 20, 20),
      script([clone(), show(), forever(iff(touching('Cat'), change('score', 1), play('Coin'), burst('coins'), blk('motion_goto', { v: { TO: menu('motion_goto_menu', 'TO', '_random_') } })))], 20, 200)
    ], { visible: false, size: 70 });
    const slime = sprite('Slime', [costume('Slime', '#59C059')], [], [
      script([flag(), hide(), spawn('_myself_', -200, 150), spawn('_myself_', 200, -150), wait(10), spawn('_myself_', 200, 150), wait(10), spawn('_myself_', -200, -150)], 20, 20),
      script([clone(), show(), blk('spark_fx_trail', { f: { PRESET: 'bubbles' } }), forever(blk('spark_motion_toward', { v: { STEPS: 2.5, TARGET: menu('spark_menu_target', 'TARGET', 'Cat') } }))], 20, 220)
    ], { visible: false, size: 80 });
    return { name: 'Coin Chaser', stage: { name: 'Stage', costumes: [backdrop('Checker')], currentCostume: 0, sounds: [], xml: xml(), variables: [] }, sprites: [coin, slime, cat], monitors: [] };
  }

  window.SparkExamples = { platformer, shooter, coins, _builder: { blk, chain, script, xml, menu, bool } };
})();
