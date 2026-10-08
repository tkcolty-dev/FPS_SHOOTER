/* Spark Engine — Kits: tick what you want and ready-made sprites + blocks land in your game */
(function () {
  const B = window.SparkExamples._builder;
  const { blk, script, xml, menu, bool, flag, clone, forever, repeat, iff, wait, goto, show, hide, touching, lt, gt, eq, not, or, rep, xpos, ypos, add, rand, stat, change, hud, burst, play, spawn, cloneMe, delClone, shake, toast, costume, sprite } = B;
  const field = (type, f) => blk(type, { f });
  const whenTouching = name => blk('event_whentouchingobject', { v: { TOUCHINGOBJECTMENU: menu('event_touchingobjectmenu', 'TOUCHINGOBJECTMENU', name) } });
  const worldGen = (type, w, h) => blk('spark_world_generate', { f: { TYPE: type }, v: { W: w, H: h, SEED: 0 } });
  const camFollow = name => blk('spark_cam_follow', { v: { TARGET: menu('spark_menu_sprite', 'TARGET', name) } });
  const tileTouch = t => rep('spark_world_touching', { f: { TILE: t } }).xml;

  // Each kit: { id, name, icon, desc, options?, build(opts) -> { sprites:[spriteData], scripts:{SpriteName:[scriptXml]} , stage:[scriptXml] } }
  const KITS = [
    {
      id: 'platformer', name: 'Platformer player', icon: '🏃', desc: 'A hero with gravity and jumping, arrow keys / controller, a generated platformer level and a camera that follows.',
      options: { level: ['generated level', 'no level (I\'ll build my own)'] },
      build(o) {
        const scripts = [script([flag(), ...(o.level === 'generated level' ? [worldGen('platformer level', 60, 14)] : []), blk('spark_phys_mode', { f: { MODE: 'platformer' } }), blk('spark_world_gotostart'), show(), camFollow('Player'),
          forever(blk('spark_phys_control', { f: { KEYS: 'arrow keys' }, v: { SPEED: 6 } }), iff(or(tileTouch('any hazard'), lt(ypos(), rep('operator_subtract', { v: { NUM1: rep('spark_world_info', { f: { WHICH: 'bottom' } }), NUM2: 100 } }))), burst('explosion'), shake(10, 0.4), blk('spark_world_gotostart')))], 20, 20),
        script([blk('event_whenkeypressed', { f: { KEY_OPTION: 'up arrow' } }), iff(rep('spark_phys_onground').xml, play('Jump'), burst('dust'))], 20, 420),
        script([flag(), forever(iff(tileTouch('door'), play('Win'), blk('spark_game_win', { v: { TEXT: 'Level complete!' } })))], 520, 20)];
        return { sprites: [sprite('Player', [costume('Hero', '#4C97FF')], ['Jump', 'Win'], scripts)] };
      }
    },
    {
      id: 'rpg', name: 'RPG / top-down player', icon: '🗺️', desc: 'A hero seen from above walking around a generated world (forest, town, dungeon or cave) with trees, water and walls you can\'t walk through.',
      options: { world: ['forest', 'town', 'dungeon', 'cave'] },
      build(o) {
        const scripts = [script([flag(), worldGen(o.world || 'forest', 40, 30), blk('spark_phys_mode', { f: { MODE: 'top-down' } }), blk('spark_world_gotostart'), show(), camFollow('Player'),
          forever(blk('spark_phys_control', { f: { KEYS: 'arrow keys' }, v: { SPEED: 5 } }), iff(tileTouch('any hazard'), change('health', -1), blk('spark_fx_tint', { v: { COLOR: '#ff0000', SECS: 0.1 } })))], 20, 20),
        script([flag(), forever(iff(tileTouch('chest'), play('Coin'), burst('coins'), change('coins', 1), blk('spark_world_settile', { v: { X: xpos(), Y: ypos() }, f: { TILE: 'floor' } })))], 520, 20)];
        return { sprites: [sprite('Player', [costume('Hero', '#FF8C1A')], ['Coin'], scripts)] };
      }
    },
    {
      id: 'coins', name: 'Coins to collect', icon: '🪙', desc: 'Spinning coins scattered over the world. Touch one: +1 score, sound, sparkle. Shows the score on screen.',
      build() {
        const scripts = [script([flag(), hide(), hud('score'), stat('score', 0), wait(0.2), repeat(15, spawn('_myself_', 0, 0))], 20, 20),
        script([clone(), blk('spark_world_gotofree'), show(), forever(blk('motion_changeyby', { v: { DY: rep('operator_mathop', { f: { OPERATOR: 'sin' }, v: { NUM: rep('operator_multiply', { v: { NUM1: rep('sensing_timer'), NUM2: 200 } }) } }) } }),
          iff(touching('Player'), change('score', 1), play('Coin'), burst('coins'), delClone()))], 20, 300)];
        return { sprites: [sprite('Coin', [costume('Coin', '#f5c400')], ['Coin'], scripts, { visible: false, size: 70 })] };
      }
    },
    {
      id: 'chaser', name: 'Enemies that chase you', icon: '👾', desc: 'Slimes that hunt the player. Touching one hurts: health bar on screen, game over at 0.',
      options: { count: ['3', '5', '8'] },
      build(o) {
        const scripts = [script([flag(), hide(), hud('health'), stat('health', 100), wait(0.3), repeat(+(o.count || 3), spawn('_myself_', 0, 0))], 20, 20),
        script([clone(), blk('spark_world_gotofree'), show(), blk('control_repeat_until', { v: { CONDITION: bool(gt(rep('sensing_distanceto', { v: { DISTANCETOMENU: menu('sensing_distancetomenu', 'DISTANCETOMENU', 'Player') } }), 250)) }, s: { SUBSTACK: [blk('spark_world_gotofree')] } }),
          forever(blk('spark_motion_toward', { v: { STEPS: 1.5, TARGET: menu('spark_menu_target', 'TARGET', 'Player') } }), iff(touching('Player'), change('health', -5), play('Hit'), shake(6, 0.2), wait(0.5)))], 20, 260),
        script([blk('spark_game_whenstat', { f: { STAT: 'health', OP: '=' }, v: { VALUE: 0 } }), blk('spark_game_over', { v: { TEXT: 'Game Over' } })], 520, 20)];
        return { sprites: [sprite('Enemy', [costume('Slime', '#59C059')], ['Hit'], scripts, { visible: false, size: 80 })] };
      }
    },
    {
      id: 'walker', name: 'Enemies that walk back and forth', icon: '🐛', desc: 'Platformer enemies that patrol and turn around at walls and edges. Jump on top to squash them, touch the side and lose a life.',
      build() {
        const scripts = [script([flag(), hide(), hud('lives'), stat('lives', 3), wait(0.3), repeat(6, spawn('_myself_', 0, 0))], 20, 20),
        script([clone(), blk('spark_world_gotofree'), show(), blk('spark_phys_mode', { f: { MODE: 'platformer' } }), blk('motion_setrotationstyle', { f: { STYLE: 'left-right' } }),
          forever(blk('spark_phys_setvel', { v: { VX: rep('operator_multiply', { v: { NUM1: 2, NUM2: rep('operator_divide', { v: { NUM1: rep('motion_direction'), NUM2: 90 } }) } }), VY: rep('spark_phys_vely') } }),
            iff(or(rep('spark_phys_touchingsolid').xml, eq(rep('spark_phys_velx'), 0)), blk('motion_turnright', { v: { DEGREES: 180 } }), blk('motion_changexby', { v: { DX: rep('operator_multiply', { v: { NUM1: 4, NUM2: rep('operator_divide', { v: { NUM1: rep('motion_direction'), NUM2: 90 } }) } }) } })),
            iff(touching('Player'), blk('control_if_else', { v: { CONDITION: bool(gt(rep('sensing_of', { f: { PROPERTY: 'y position' }, v: { OBJECT: menu('sensing_of_object_menu', 'OBJECT', 'Player') } }), add(ypos(), 20))) }, s: { SUBSTACK: [play('Pop'), burst('smoke'), change('score', 2), delClone()], SUBSTACK2: [change('lives', -1), play('Hit'), shake(8, 0.3), blk('spark_world_gotostart'), wait(0.5)] } })))], 20, 260),
        script([blk('spark_game_whenstat', { f: { STAT: 'lives', OP: '=' }, v: { VALUE: 0 } }), blk('spark_game_over', { v: { TEXT: 'Game Over' } })], 620, 20)];
        return { sprites: [sprite('Enemy', [costume('Slime', '#9966FF')], ['Hit', 'Pop'], scripts, { visible: false, size: 80 })] };
      }
    },
    {
      id: 'shooter', name: 'Shooting', icon: '🔫', desc: 'Press space to fire bullets in the direction the player faces. Bullets hit enemies (+1 score) and stop at walls.',
      build() {
        const bullet = sprite('Bullet', [costume('Bullet', '#ffeb3b')], ['Laser'], [
          script([flag(), hide()], 20, 20),
          script([clone(), show(), blk('motion_pointindirection', { v: { DIRECTION: rep('sensing_of', { f: { PROPERTY: 'direction' }, v: { OBJECT: menu('sensing_of_object_menu', 'OBJECT', 'Player') } }) } }), play('Laser'),
            repeat(60, blk('motion_movesteps', { v: { STEPS: 12 } }), iff(touching('Enemy'), change('score', 1), burst('sparkles'), delClone()), iff(tileTouch('any solid'), delClone())), delClone()], 20, 160)
        ], { visible: false, size: 60, rotationStyle: 'all around' });
        const playerScripts = [script([blk('event_whenkeypressed', { f: { KEY_OPTION: 'space' } }), spawn('Bullet', xpos(), ypos())], 20, 600)];
        return { sprites: [bullet], scripts: { Player: playerScripts } };
      }
    },
    {
      id: 'timer', name: 'Countdown timer', icon: '⏱️', desc: 'A 60 second countdown on screen. When it hits zero the game ends.',
      options: { seconds: ['30', '60', '120'] },
      build(o) {
        return { stage: [script([flag(), hud('timer'), blk('spark_game_countdown', { v: { SECS: +(o.seconds || 60) } })], 20, 20), script([blk('spark_game_whencountdown'), blk('spark_game_over', { v: { TEXT: "Time's up!" } })], 20, 200)] };
      }
    },
    {
      id: 'title', name: 'Title screen', icon: '🎬', desc: 'A big title with "press space to start". The game waits until the player is ready.',
      build() {
        const scripts = [script([flag(), blk('spark_cam_sticky', { f: { MODE: 'stays on screen' } }), goto(0, 40), show(), blk('spark_text_show', { v: { TEXT: 'MY GAME', SIZE: 48, COLOR: '#ffffff' } }), blk('spark_fx_shadow', { f: { ON: 'on' } }), blk('spark_game_pause', { f: { MODE: 'pause' } }),
          blk('spark_game_toast', { v: { TEXT: 'Press SPACE to start', SECS: 60 } }), blk('control_wait_until', { v: { CONDITION: bool(rep('sensing_keypressed', { v: { KEY_OPTION: menu('sensing_keyoptions', 'KEY_OPTION', 'space') } }).xml) } }), blk('spark_game_pause', { f: { MODE: 'resume' } }), play('Win'), hide(), blk('spark_game_toast', { v: { TEXT: 'Go!', SECS: 1 } })], 20, 20)];
        return { sprites: [sprite('Title', [costume('Text Label', '#ffffff')], ['Win'], scripts)] };
      }
    },
    {
      id: 'dialogue', name: 'Talking characters', icon: '💬', desc: 'A villager who shows an RPG-style dialogue box when you walk up and press space.',
      build() {
        const scripts = [script([flag(), blk('spark_world_gotofree'), show(), forever(iff(touching('Player'), blk('looks_say', { v: { MESSAGE: 'press space' } }), blk('control_wait_until', { v: { CONDITION: bool(or(rep('sensing_keypressed', { v: { KEY_OPTION: menu('sensing_keyoptions', 'KEY_OPTION', 'space') } }).xml, not(touching('Player')))) } }),
          iff(touching('Player'), blk('looks_say', { v: { MESSAGE: '' } }), blk('spark_text_dialogue', { v: { NAME: 'Villager', TEXT: 'Welcome, traveller! The chests in this land are full of gold. Be careful of the slimes...' } }), wait(0.5))), blk('looks_say', { v: { MESSAGE: '' } }))], 20, 20)];
        return { sprites: [sprite('Villager', [costume('Cat', '#FF6680')], [], scripts)] };
      }
    }
  ];

  window.SparkKits = { KITS };
})();
