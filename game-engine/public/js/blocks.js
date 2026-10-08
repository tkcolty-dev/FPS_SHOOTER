/* Spark Engine — extra blocks, dynamic menus and the toolbox (built on scratch-blocks) */
(function () {
  const SB = window.ScratchBlocks;
  const C = SB.Colours;

  // the editor supplies the current sprite's costumes/sounds etc.
  const Menus = window.SparkMenus = window.SparkMenus || {
    costumes: () => [['costume1', 'costume1']], backdrops: () => [['backdrop1', 'backdrop1']], sounds: () => [['pop', 'pop']],
    sprites: () => [], isStage: () => false
  };
  const spritesOnly = () => { const s = Menus.sprites(); return s.length ? s : [['Sprite1', 'Sprite1']]; };
  const stageMsg = (m) => SB.Msg[m] || m;

  /* ---------- dynamic Scratch menus (same trick scratch-gui uses) ---------- */
  const menuJSON = (name, fn, colors, start) => ({
    message0: '%1', args0: [{ type: 'field_dropdown', name, options: () => start.concat(fn()) }],
    colour: colors.secondary, colourSecondary: colors.secondary, colourTertiary: colors.tertiary, extensions: ['output_string']
  });
  const defMenu = (type, name, fn, colors, start = []) => { SB.Blocks[type] = { init() { this.jsonInit(menuJSON(name, fn, colors, start)); } }; };
  defMenu('motion_goto_menu', 'TO', spritesOnly, C.motion, [[stageMsg('MOTION_GOTO_RANDOM'), '_random_'], [stageMsg('MOTION_GOTO_POINTER'), '_mouse_']]);
  defMenu('motion_glideto_menu', 'TO', spritesOnly, C.motion, [[stageMsg('MOTION_GLIDETO_RANDOM'), '_random_'], [stageMsg('MOTION_GLIDETO_POINTER'), '_mouse_']]);
  defMenu('motion_pointtowards_menu', 'TOWARDS', spritesOnly, C.motion, [[stageMsg('MOTION_POINTTOWARDS_POINTER'), '_mouse_']]);
  defMenu('looks_costume', 'COSTUME', Menus.costumes, C.looks);
  defMenu('looks_backdrops', 'BACKDROP', Menus.backdrops, C.looks, [['next backdrop', 'next backdrop'], ['previous backdrop', 'previous backdrop'], ['random backdrop', 'random backdrop']]);
  defMenu('sound_sounds_menu', 'SOUND_MENU', Menus.sounds, C.sounds);
  defMenu('sensing_touchingobjectmenu', 'TOUCHINGOBJECTMENU', spritesOnly, C.sensing, [[stageMsg('SENSING_TOUCHINGOBJECT_POINTER'), '_mouse_'], [stageMsg('SENSING_TOUCHINGOBJECT_EDGE'), '_edge_']]);
  defMenu('event_touchingobjectmenu', 'TOUCHINGOBJECTMENU', spritesOnly, C.event, [[stageMsg('SENSING_TOUCHINGOBJECT_POINTER'), '_mouse_'], [stageMsg('SENSING_TOUCHINGOBJECT_EDGE'), '_edge_']]);
  defMenu('sensing_distancetomenu', 'DISTANCETOMENU', spritesOnly, C.sensing, [[stageMsg('SENSING_DISTANCETO_POINTER'), '_mouse_']]);
  defMenu('sensing_of_object_menu', 'OBJECT', spritesOnly, C.sensing, [[stageMsg('SENSING_OF_STAGE'), '_stage_']]);
  defMenu('control_create_clone_of_menu', 'CLONE_OPTION', spritesOnly, C.control, [[stageMsg('CONTROL_CREATECLONEOF_MYSELF'), '_myself_']]);
  SB.Blocks.event_whenbackdropswitchesto = { init() { this.jsonInit({ message0: stageMsg('EVENT_WHENBACKDROPSWITCHESTO'), args0: [{ type: 'field_dropdown', name: 'BACKDROP', options: () => Menus.backdrops() }], colour: C.event.primary, colourSecondary: C.event.secondary, colourTertiary: C.event.tertiary, extensions: ['shape_hat'] }); } };

  /* ---------- Spark categories ---------- */
  const CATS = {
    physics: { name: 'Physics', primary: '#E5484D', secondary: '#C53A40', tertiary: '#A82F34' },
    camera: { name: 'Camera', primary: '#6366F1', secondary: '#4F51D6', tertiary: '#4345B8' },
    fx: { name: 'Effects', primary: '#F97316', secondary: '#DB6512', tertiary: '#BF5810' },
    game: { name: 'Game', primary: '#84CC16', secondary: '#6FAD11', tertiary: '#5F950F' },
    text: { name: 'Text &amp; Speech', primary: '#64748B', secondary: '#52606F', tertiary: '#45515D' },
    pad: { name: 'Controller', primary: '#475569', secondary: '#3B4759', tertiary: '#2F3A49' },
    pen: { name: 'Pen', primary: '#0FBD8C', secondary: '#0DA57A', tertiary: '#0B8E69' },
    world: { name: 'World', primary: '#8D6E63', secondary: '#795548', tertiary: '#5D4037' }
  };
  const defs = [];
  const def = (type, cat, message, args, shape, extra) => {
    defs.push({ type, cat, message, args: args || [], shape: shape || 'statement', extra });
    const c = CATS[cat] || { primary: C[cat].primary, secondary: C[cat].secondary, tertiary: C[cat].tertiary };
    const ext = { statement: ['shape_statement'], hat: ['shape_hat'], end: ['shape_end'], number: ['output_number'], string: ['output_string'], boolean: ['output_boolean'] }[shape || 'statement'];
    SB.Blocks[type] = { init() { this.jsonInit({ message0: message, args0: (args || []).map(a => a.json), colour: c.primary, colourSecondary: c.secondary, colourTertiary: c.tertiary, extensions: ext, ...(extra || {}) }); } };
  };
  // arg helpers: each returns {json, shadow}
  const num = (name, d) => ({ json: { type: 'input_value', name }, shadow: `<value name="${name}"><shadow type="math_number"><field name="NUM">${d}</field></shadow></value>` });
  const txt = (name, d) => ({ json: { type: 'input_value', name }, shadow: `<value name="${name}"><shadow type="text"><field name="TEXT">${d}</field></shadow></value>` });
  const col = (name, d) => ({ json: { type: 'input_value', name }, shadow: `<value name="${name}"><shadow type="colour_picker"><field name="COLOUR">${d}</field></shadow></value>` });
  const note = (name, d) => ({ json: { type: 'input_value', name }, shadow: `<value name="${name}"><shadow type="note"><field name="NOTE">${d}</field></shadow></value>` });
  const menu = (name, type) => ({ json: { type: 'input_value', name }, shadow: `<value name="${name}"><shadow type="${type}"></shadow></value>` });
  const dd = (name, options) => ({ json: { type: 'field_dropdown', name, options: options.map(o => Array.isArray(o) ? o : [o, o]) }, shadow: '' });

  // menu blocks of our own
  SB.Blocks.spark_menu_sprite = { init() { this.jsonInit(menuJSON('TARGET', spritesOnly, CATS.camera, [])); } };
  SB.Blocks.spark_menu_target = { init() { this.jsonInit(menuJSON('TARGET', spritesOnly, C.motion, [['mouse-pointer', '_mouse_']])); } };
  SB.Blocks.spark_menu_clone = { init() { this.jsonInit(menuJSON('TARGET', spritesOnly, CATS.game, [['myself', '_myself_']])); } };

  // Motion extras
  def('spark_motion_toward', 'motion', 'move %1 steps toward %2', [num('STEPS', 5), menu('TARGET', 'spark_menu_target')]);
  def('spark_motion_fence', 'motion', 'keep inside the screen', []);
  // Looks extras
  def('spark_looks_flip', 'looks', 'flip %1', [dd('DIR', ['horizontally', 'vertically'])]);
  // Sound extras
  def('spark_sound_note', 'sounds', 'play note %1 for %2 beats', [note('NOTE', 60), num('BEATS', 0.25)]);
  def('spark_sound_drum', 'sounds', 'play drum %1 for %2 beats', [dd('DRUM', ['kick', 'snare', 'hi-hat', 'clap', 'tom', 'cymbal']), num('BEATS', 0.25)]);
  def('spark_sound_rest', 'sounds', 'rest for %1 beats', [num('BEATS', 0.25)]);
  def('spark_sound_tempo', 'sounds', 'set tempo to %1 bpm', [num('TEMPO', 120)]);
  def('spark_sound_preset', 'sounds', 'play built-in sound %1', [dd('PRESET', window.SparkLib.soundNames)]);
  // Sensing extras
  def('spark_sense_touchingedge', 'sensing', 'touching %1 edge?', [dd('EDGE', ['any', 'top', 'bottom', 'left', 'right'])], 'boolean');
  def('spark_sense_mouseclicked', 'sensing', 'mouse clicked?', [], 'boolean');
  def('spark_sense_isclone', 'sensing', 'is a clone?', [], 'boolean');
  // Physics
  def('spark_phys_mode', 'physics', 'turn physics %1', [dd('MODE', ['platformer', 'top-down', 'off'])]);
  def('spark_phys_control', 'physics', 'move with %1 at speed %2', [dd('KEYS', ['arrow keys', 'WASD']), num('SPEED', 5)]);
  def('spark_phys_jump', 'physics', 'jump with power %1', [num('POWER', 12)]);
  def('spark_phys_onground', 'physics', 'on ground?', [], 'boolean');
  def('spark_phys_solid', 'physics', 'make this sprite %1', [dd('SOLID', ['solid', 'not solid'])]);
  def('spark_phys_setgravity', 'physics', 'set gravity to %1', [num('GRAVITY', 1)]);
  def('spark_phys_setvel', 'physics', 'set velocity x: %1 y: %2', [num('VX', 0), num('VY', 0)]);
  def('spark_phys_changevel', 'physics', 'change velocity x: %1 y: %2', [num('VX', 0), num('VY', 5)]);
  def('spark_phys_velx', 'physics', 'velocity x', [], 'number');
  def('spark_phys_vely', 'physics', 'velocity y', [], 'number');
  def('spark_phys_setbounce', 'physics', 'set bounciness to %1', [num('BOUNCE', 0.5)]);
  def('spark_phys_setfriction', 'physics', 'set friction to %1', [num('FRICTION', 0.8)]);
  def('spark_phys_setmaxspeed', 'physics', 'set max speed to %1', [num('SPEED', 20)]);
  def('spark_phys_touchingsolid', 'physics', 'touching a solid?', [], 'boolean');
  // Camera
  def('spark_cam_follow', 'camera', 'camera follow %1', [menu('TARGET', 'spark_menu_sprite')]);
  def('spark_cam_stop', 'camera', 'camera stop following', []);
  def('spark_cam_goto', 'camera', 'set camera to x: %1 y: %2', [num('X', 0), num('Y', 0)]);
  def('spark_cam_change', 'camera', 'change camera by x: %1 y: %2', [num('X', 10), num('Y', 0)]);
  def('spark_cam_zoom', 'camera', 'set camera zoom to %1 %', [num('ZOOM', 100)]);
  def('spark_cam_shake', 'camera', 'shake camera %1 for %2 seconds', [num('AMOUNT', 8), num('SECS', 0.4)]);
  def('spark_cam_bounds', 'camera', 'keep camera inside x: %1 to %2 y: %3 to %4', [num('X1', -960), num('X2', 960), num('Y1', -360), num('Y2', 360)]);
  def('spark_cam_nobounds', 'camera', 'camera can go anywhere', []);
  def('spark_cam_sticky', 'camera', 'this sprite %1', [dd('MODE', ['moves with the world', 'stays on screen'])]);
  def('spark_cam_x', 'camera', 'camera x', [], 'number');
  def('spark_cam_y', 'camera', 'camera y', [], 'number');
  // Effects
  const PRESETS = Object.keys(window.SparkRuntime.PARTICLE_PRESETS);
  def('spark_fx_burst', 'fx', 'burst %1 here', [dd('PRESET', PRESETS)]);
  def('spark_fx_burstat', 'fx', 'burst %1 at x: %2 y: %3', [dd('PRESET', PRESETS), num('X', 0), num('Y', 0)]);
  def('spark_fx_trail', 'fx', 'trail %1', [dd('PRESET', ['off', ...PRESETS])]);
  def('spark_fx_tint', 'fx', 'flash this sprite %1 for %2 seconds', [col('COLOR', '#ff0000'), num('SECS', 0.2)]);
  def('spark_fx_squash', 'fx', 'squash by %1 %', [num('AMOUNT', 30)]);
  def('spark_fx_shadow', 'fx', 'drop shadow %1', [dd('ON', ['on', 'off'])]);
  def('spark_fx_glow', 'fx', 'glow %1 color %2', [dd('ON', ['on', 'off']), col('COLOR', '#ffff00')]);
  def('spark_fx_flash', 'fx', 'flash screen %1 for %2 seconds', [col('COLOR', '#ffffff'), num('SECS', 0.3)]);
  def('spark_fx_fade', 'fx', 'fade %1 for %2 seconds', [dd('MODE', ['out to black', 'in from black', 'out to white', 'in from white']), num('SECS', 1)]);
  def('spark_fx_timescale', 'fx', 'set game speed to %1 %', [num('SPEED', 100)]);
  // Game
  const STATS = ['score', 'lives', 'health', 'coins', 'level'];
  def('spark_game_set', 'game', 'set %1 to %2', [dd('STAT', STATS), num('VALUE', 0)]);
  def('spark_game_change', 'game', 'change %1 by %2', [dd('STAT', STATS), num('VALUE', 1)]);
  def('spark_game_get', 'game', '%1', [dd('STAT', STATS)], 'number', { checkboxInFlyout: false });
  def('spark_game_hud', 'game', 'show %1 on screen %2', [dd('STAT', [...STATS, 'timer', 'highscore']), dd('ON', ['on', 'off'])]);
  def('spark_game_whenstat', 'game', 'when %1 %2 %3', [dd('STAT', STATS), dd('OP', ['<', '=', '>']), num('VALUE', 0)], 'hat');
  def('spark_game_over', 'game', 'game over with text %1', [txt('TEXT', 'Game Over')], 'end');
  def('spark_game_win', 'game', 'you win with text %1', [txt('TEXT', 'You Win!')], 'end');
  def('spark_game_whenover', 'game', 'when the game ends', [], 'hat');
  def('spark_game_restart', 'game', 'restart game', [], 'end');
  def('spark_game_pause', 'game', '%1 game', [dd('MODE', ['pause', 'resume'])]);
  def('spark_game_countdown', 'game', 'start countdown %1 seconds', [num('SECS', 30)]);
  def('spark_game_countdownval', 'game', 'countdown', [], 'number');
  def('spark_game_whencountdown', 'game', 'when countdown ends', [], 'hat');
  def('spark_game_toast', 'game', 'show message %1 for %2 seconds', [txt('TEXT', 'Level 1'), num('SECS', 2)]);
  def('spark_game_spawn', 'game', 'spawn clone of %1 at x: %2 y: %3', [menu('TARGET', 'spark_menu_clone'), num('X', 0), num('Y', 0)]);
  def('spark_game_clonecount', 'game', 'number of clones of %1', [menu('TARGET', 'spark_menu_clone')], 'number');
  def('spark_game_save', 'game', 'save %1 as %2', [txt('VALUE', '0'), txt('KEY', 'best')]);
  def('spark_game_load', 'game', 'saved %1', [txt('KEY', 'best')], 'string');
  def('spark_game_highscore', 'game', 'high score', [], 'number');
  // Text & Speech
  def('spark_text_show', 'text', 'show text %1 size %2 color %3', [txt('TEXT', 'Hello!'), num('SIZE', 24), col('COLOR', '#333333')]);
  def('spark_text_clear', 'text', 'show my costume again', []);
  def('spark_text_font', 'text', 'set font to %1', [dd('FONT', Object.keys(window.SparkLib.FONTS))]);
  def('spark_text_speak', 'text', 'speak %1', [txt('TEXT', 'hello')]);
  def('spark_text_voice', 'text', 'set voice to %1', [dd('VOICE', ['normal', 'squeaky', 'deep', 'fast', 'slow', 'robot'])]);
  def('spark_text_dialogue', 'text', 'dialogue box %1 says %2 and wait', [txt('NAME', 'Villager'), txt('TEXT', 'Hello there, traveller!')]);
  def('spark_text_type', 'text', 'type %1 letter by letter', [txt('TEXT', 'Once upon a time...')]);
  def('spark_text_style', 'text', 'set text size %1 color %2', [num('SIZE', 24), col('COLOR', '#333333')]);
  def('spark_text_label', 'text', 'show label %1 at %2', [txt('TEXT', 'Level 1'), dd('POS', ['top left', 'top center', 'top right', 'bottom left', 'bottom center', 'bottom right'])]);
  def('spark_text_hidelabel', 'text', 'hide label at %1', [dd('POS', ['top left', 'top center', 'top right', 'bottom left', 'bottom center', 'bottom right'])]);
  def('spark_text_dialogopen', 'text', 'dialogue box open?', [], 'boolean');
  def('spark_text_case', 'text', '%1 %2', [dd('OP', ['uppercase', 'lowercase', 'reversed', 'trimmed']), txt('TEXT', 'hello')], 'string');
  def('spark_text_replace', 'text', 'replace %1 with %2 in %3', [txt('FROM', 'a'), txt('TO', 'o'), txt('TEXT', 'banana')], 'string');
  def('spark_text_split', 'text', 'item %1 of %2 split by %3', [num('INDEX', 1), txt('TEXT', 'red,green,blue'), txt('SEP', ',')], 'string');
  def('spark_text_count', 'text', 'count %1 in %2', [txt('PART', 'a'), txt('TEXT', 'banana')], 'number');
  def('spark_text_repeat', 'text', 'repeat %1 %2 times', [txt('TEXT', 'ha'), num('TIMES', 3)], 'string');
  def('spark_text_commas', 'text', '%1 with commas', [num('NUM', 1234567)], 'string');
  def('spark_cloud_status', 'sensing', 'cloud status', [], 'string');
  // Controller
  const BTN = ['A', 'B', 'X', 'Y', 'LB', 'RB', 'LT', 'RT', 'up', 'down', 'left', 'right', 'start', 'select', 'any'];
  def('spark_pad_whenbutton', 'pad', 'when controller %1 button %2 pressed', [dd('PLAYER', ['1', '2', '3', '4', 'any']), dd('BUTTON', BTN)], 'hat');
  def('spark_pad_button', 'pad', 'controller %1 button %2 pressed?', [num('PLAYER', 1), dd('BUTTON', BTN)], 'boolean');
  def('spark_pad_stick', 'pad', 'controller %1 %2 stick %3', [num('PLAYER', 1), dd('STICK', ['left', 'right']), dd('AXIS', ['x', 'y'])], 'number');
  def('spark_pad_connected', 'pad', 'controller %1 connected?', [num('PLAYER', 1)], 'boolean');
  def('spark_pad_rumble', 'pad', 'rumble controller %1 for %2 seconds', [num('PLAYER', 1), num('SECS', 0.3)]);
  // World (tile maps + generation)
  const TILES = window.SparkRuntime.TILE_NAMES.filter(n => n !== 'empty');
  def('spark_world_generate', 'world', 'generate %1 world width %2 height %3 seed %4', [dd('TYPE', ['forest', 'dungeon', 'town', 'cave', 'platformer level', 'empty']), num('W', 40), num('H', 30), num('SEED', 0)]);
  def('spark_world_clear', 'world', 'clear world', []);
  def('spark_world_gotostart', 'world', 'go to world start', []);
  def('spark_world_gotofree', 'world', 'go to a random free tile', []);
  def('spark_world_camera', 'world', 'keep camera inside world', []);
  def('spark_world_touching', 'world', 'touching %1 tile?', [dd('TILE', ['any solid', 'any hazard', 'any tile', ...TILES])], 'boolean');
  def('spark_world_tileat', 'world', 'tile at x: %1 y: %2', [num('X', 0), num('Y', 0)], 'string');
  def('spark_world_settile', 'world', 'set tile at x: %1 y: %2 to %3', [num('X', 0), num('Y', 0), dd('TILE', ['empty', ...TILES])]);
  def('spark_world_fill', 'world', 'fill tiles from x: %1 y: %2 to x: %3 y: %4 with %5', [num('X1', -240), num('Y1', -180), num('X2', 240), num('Y2', -140), dd('TILE', ['grass', ...TILES.filter(t => t !== 'grass'), 'empty'])]);
  def('spark_world_tilesize', 'world', 'set tile size to %1', [num('SIZE', 48)]);
  def('spark_world_info', 'world', 'world %1', [dd('WHICH', ['width', 'height', 'left', 'right', 'top', 'bottom', 'start x', 'start y', 'tile size'])], 'number');
  def('spark_world_active', 'world', 'world exists?', [], 'boolean');
  // Pen
  def('pen_clear', 'pen', 'erase all', []);
  def('pen_stamp', 'pen', 'stamp', []);
  def('pen_penDown', 'pen', 'pen down', []);
  def('pen_penUp', 'pen', 'pen up', []);
  def('pen_setPenColorToColor', 'pen', 'set pen color to %1', [col('COLOR', '#0000ff')]);
  def('pen_changePenSizeBy', 'pen', 'change pen size by %1', [num('SIZE', 1)]);
  def('pen_setPenSizeTo', 'pen', 'set pen size to %1', [num('SIZE', 1)]);
  def('pen_setPenTransparency', 'pen', 'set pen transparency to %1', [num('VALUE', 0)]);

  const xmlFor = type => { const d = defs.find(x => x.type === type); return `<block type="${type}" id="${type}">${d.args.map(a => a.shadow).join('')}</block>`; };
  const catXML = (key, inner) => { const c = CATS[key]; return `<category name="${c.name}" id="${key}" colour="${c.primary}" secondaryColour="${c.tertiary}">${inner}</category>`; };
  const blocksXML = (...types) => types.map(xmlFor).join('');
  const sep = '<sep gap="36"></sep>';

  const N = (name, v) => `<value name="${name}"><shadow type="math_number"><field name="NUM">${v}</field></shadow></value>`;
  const Tx = (name, v) => `<value name="${name}"><shadow type="text"><field name="TEXT">${v}</field></shadow></value>`;
  const M = (name, type) => `<value name="${name}"><shadow type="${type}"></shadow></value>`;
  const B = (type, inner = '') => `<block type="${type}" id="${type}">${inner}</block>`;

  function makeToolbox(isStage) {
    const motion = isStage ? '<label text="Stage selected: no motion blocks"></label>' :
      B('motion_movesteps', N('STEPS', 10)) + B('motion_turnright', N('DEGREES', 15)) + B('motion_turnleft', N('DEGREES', 15)) + sep +
      B('motion_goto', M('TO', 'motion_goto_menu')) + B('motion_gotoxy', N('X', 0) + N('Y', 0)) + B('motion_glideto', N('SECS', 1) + M('TO', 'motion_glideto_menu')) + B('motion_glidesecstoxy', N('SECS', 1) + N('X', 0) + N('Y', 0)) + sep +
      B('motion_pointindirection', `<value name="DIRECTION"><shadow type="math_angle"><field name="NUM">90</field></shadow></value>`) + B('motion_pointtowards', M('TOWARDS', 'motion_pointtowards_menu')) + sep +
      B('motion_changexby', N('DX', 10)) + B('motion_setx', N('X', 0)) + B('motion_changeyby', N('DY', 10)) + B('motion_sety', N('Y', 0)) + sep +
      B('motion_ifonedgebounce') + sep + B('motion_setrotationstyle') + sep + xmlFor('spark_motion_toward') + xmlFor('spark_motion_fence') + sep +
      B('motion_xposition') + B('motion_yposition') + B('motion_direction');
    const looks = isStage ?
      B('looks_switchbackdropto', M('BACKDROP', 'looks_backdrops')) + B('looks_switchbackdroptoandwait', M('BACKDROP', 'looks_backdrops')) + B('looks_nextbackdrop') + sep +
      B('looks_changeeffectby', N('CHANGE', 25)) + B('looks_seteffectto', N('VALUE', 0)) + B('looks_cleargraphiceffects') + sep + B('looks_backdropnumbername')
      :
      B('looks_sayforsecs', Tx('MESSAGE', 'Hello!') + N('SECS', 2)) + B('looks_say', Tx('MESSAGE', 'Hello!')) + B('looks_thinkforsecs', Tx('MESSAGE', 'Hmm...') + N('SECS', 2)) + B('looks_think', Tx('MESSAGE', 'Hmm...')) + sep +
      B('looks_switchcostumeto', M('COSTUME', 'looks_costume')) + B('looks_nextcostume') + B('looks_switchbackdropto', M('BACKDROP', 'looks_backdrops')) + B('looks_nextbackdrop') + sep +
      B('looks_changesizeby', N('CHANGE', 10)) + B('looks_setsizeto', N('SIZE', 100)) + sep +
      B('looks_changeeffectby', N('CHANGE', 25)) + B('looks_seteffectto', N('VALUE', 0)) + B('looks_cleargraphiceffects') + sep +
      B('looks_show') + B('looks_hide') + xmlFor('spark_looks_flip') + sep +
      B('looks_gotofrontback') + B('looks_goforwardbackwardlayers', `<value name="NUM"><shadow type="math_integer"><field name="NUM">1</field></shadow></value>`) + sep +
      B('looks_costumenumbername') + B('looks_backdropnumbername') + B('looks_size');
    const sound =
      B('sound_playuntildone', M('SOUND_MENU', 'sound_sounds_menu')) + B('sound_play', M('SOUND_MENU', 'sound_sounds_menu')) + B('sound_stopallsounds') + sep +
      xmlFor('spark_sound_preset') + sep +
      B('sound_changeeffectby', N('VALUE', 10)) + B('sound_seteffectto', N('VALUE', 100)) + B('sound_cleareffects') + sep +
      B('sound_changevolumeby', N('VOLUME', -10)) + B('sound_setvolumeto', N('VOLUME', 100)) + B('sound_volume') + sep +
      blocksXML('spark_sound_note', 'spark_sound_drum', 'spark_sound_rest', 'spark_sound_tempo');
    const events =
      B('event_whenflagclicked') + B('event_whenkeypressed') + (isStage ? B('event_whenstageclicked') : B('event_whenthisspriteclicked')) + B('event_whenbackdropswitchesto') + sep +
      B('event_whengreaterthan', N('VALUE', 10)) + (isStage ? '' : B('event_whentouchingobject', M('TOUCHINGOBJECTMENU', 'event_touchingobjectmenu'))) + sep +
      B('event_whenbroadcastreceived') + B('event_broadcast', M('BROADCAST_INPUT', 'event_broadcast_menu')) + B('event_broadcastandwait', M('BROADCAST_INPUT', 'event_broadcast_menu'));
    const control =
      B('control_wait', `<value name="DURATION"><shadow type="math_positive_number"><field name="NUM">1</field></shadow></value>`) + sep +
      B('control_repeat', `<value name="TIMES"><shadow type="math_whole_number"><field name="NUM">10</field></shadow></value>`) + B('control_forever') + sep +
      B('control_if') + B('control_if_else') + B('control_wait_until') + B('control_repeat_until') + sep + B('control_stop') + sep +
      (isStage ? '' : B('control_start_as_clone')) + B('control_create_clone_of', M('CLONE_OPTION', 'control_create_clone_of_menu')) + (isStage ? '' : B('control_delete_this_clone'));
    const sensing =
      (isStage ? '' : B('sensing_touchingobject', M('TOUCHINGOBJECTMENU', 'sensing_touchingobjectmenu')) + B('sensing_touchingcolor', M('COLOR', 'colour_picker')) + B('sensing_coloristouchingcolor', M('COLOR', 'colour_picker') + M('COLOR2', 'colour_picker')) + B('sensing_distanceto', M('DISTANCETOMENU', 'sensing_distancetomenu')) + xmlFor('spark_sense_touchingedge') + xmlFor('spark_sense_isclone') + sep) +
      B('sensing_askandwait', Tx('QUESTION', "What's your name?")) + B('sensing_answer') + sep +
      B('sensing_keypressed', M('KEY_OPTION', 'sensing_keyoptions')) + B('sensing_mousedown') + xmlFor('spark_sense_mouseclicked') + B('sensing_mousex') + B('sensing_mousey') + sep +
      (isStage ? '' : B('sensing_setdragmode') + sep) +
      B('sensing_loudness') + sep + B('sensing_timer') + B('sensing_resettimer') + sep +
      B('sensing_of', M('OBJECT', 'sensing_of_object_menu')) + sep + B('sensing_current') + B('sensing_dayssince2000') + sep + B('sensing_username') + xmlFor('spark_cloud_status');
    const op2 = (t, a, b) => B(t, N('NUM1', a) + N('NUM2', b));
    const cmp = (t) => B(t, Tx('OPERAND1', '') + Tx('OPERAND2', '50'));
    const operators =
      op2('operator_add', '', '') + op2('operator_subtract', '', '') + op2('operator_multiply', '', '') + op2('operator_divide', '', '') + sep +
      B('operator_random', N('FROM', 1) + N('TO', 10)) + sep + cmp('operator_gt') + cmp('operator_lt') + cmp('operator_equals') + sep +
      B('operator_and') + B('operator_or') + B('operator_not') + sep +
      B('operator_join', Tx('STRING1', 'apple ') + Tx('STRING2', 'banana')) + B('operator_letter_of', N('LETTER', 1) + Tx('STRING', 'apple')) + B('operator_length', Tx('STRING', 'apple')) + B('operator_contains', Tx('STRING1', 'apple') + Tx('STRING2', 'a')) + sep +
      op2('operator_mod', '', '') + B('operator_round', N('NUM', '')) + B('operator_mathop', N('NUM', ''));
    const cat = (name, id, c1, c2, inner) => `<category name="${name}" id="${id}" colour="${c1}" secondaryColour="${c2}">${inner}</category>`;
    const spark = isStage ? '' : catXML('physics', blocksXML('spark_phys_mode', 'spark_phys_control', 'spark_phys_jump', 'spark_phys_onground') + sep + blocksXML('spark_phys_solid', 'spark_phys_touchingsolid') + sep + blocksXML('spark_phys_setgravity', 'spark_phys_setvel', 'spark_phys_changevel', 'spark_phys_velx', 'spark_phys_vely') + sep + blocksXML('spark_phys_setbounce', 'spark_phys_setfriction', 'spark_phys_setmaxspeed'));
    return `<xml id="toolbox-categories" style="display: none">` +
      cat('Motion', 'motion', '#4C97FF', '#3373CC', motion) +
      cat('Looks', 'looks', '#9966FF', '#774DCB', looks) +
      cat('Sound', 'sound', '#CF63CF', '#BD42BD', sound) +
      cat('Events', 'events', '#FFBF00', '#CC9900', events) +
      cat('Control', 'control', '#FFAB19', '#CF8B17', control) +
      cat('Sensing', 'sensing', '#5CB1D6', '#2E8EB8', sensing) +
      cat('Operators', 'operators', '#59C059', '#389438', operators) +
      `<category name="Variables" id="data" colour="#FF8C1A" secondaryColour="#DB6E00" custom="VARIABLE"></category>` +
      `<category name="My Blocks" id="more" colour="#FF6680" secondaryColour="#FF3355" custom="PROCEDURE"></category>` +
      spark +
      catXML('camera', blocksXML('spark_cam_follow', 'spark_cam_stop') + sep + blocksXML('spark_cam_goto', 'spark_cam_change', 'spark_cam_zoom', 'spark_cam_shake') + sep + blocksXML('spark_cam_bounds', 'spark_cam_nobounds') + sep + (isStage ? '' : xmlFor('spark_cam_sticky') + sep) + blocksXML('spark_cam_x', 'spark_cam_y')) +
      catXML('fx', (isStage ? '' : blocksXML('spark_fx_burst')) + blocksXML('spark_fx_burstat') + (isStage ? '' : blocksXML('spark_fx_trail', 'spark_fx_tint', 'spark_fx_squash', 'spark_fx_shadow', 'spark_fx_glow')) + sep + blocksXML('spark_fx_flash', 'spark_fx_fade', 'spark_fx_timescale')) +
      catXML('game', blocksXML('spark_game_set', 'spark_game_change', 'spark_game_get', 'spark_game_hud') + sep + blocksXML('spark_game_whenstat', 'spark_game_over', 'spark_game_win', 'spark_game_whenover', 'spark_game_restart', 'spark_game_pause') + sep + blocksXML('spark_game_countdown', 'spark_game_countdownval', 'spark_game_whencountdown') + sep + blocksXML('spark_game_toast', 'spark_game_spawn', 'spark_game_clonecount') + sep + blocksXML('spark_game_save', 'spark_game_load', 'spark_game_highscore')) +
      catXML('world', blocksXML('spark_world_generate', 'spark_world_clear', 'spark_world_camera') + sep + (isStage ? '' : blocksXML('spark_world_gotostart', 'spark_world_gotofree', 'spark_world_touching') + sep) + blocksXML('spark_world_tileat', 'spark_world_settile', 'spark_world_fill', 'spark_world_tilesize') + sep + blocksXML('spark_world_info', 'spark_world_active')) +
      catXML('text', (isStage ? '' : blocksXML('spark_text_show', 'spark_text_type', 'spark_text_style', 'spark_text_font', 'spark_text_clear') + sep) + blocksXML('spark_text_dialogue', 'spark_text_dialogopen') + sep + blocksXML('spark_text_label', 'spark_text_hidelabel') + sep + blocksXML('spark_text_speak', 'spark_text_voice') + sep + blocksXML('spark_text_case', 'spark_text_replace', 'spark_text_split', 'spark_text_count', 'spark_text_repeat', 'spark_text_commas')) +
      catXML('pad', blocksXML('spark_pad_whenbutton', 'spark_pad_button', 'spark_pad_stick', 'spark_pad_connected', 'spark_pad_rumble')) +
      catXML('pen', blocksXML('pen_clear') + (isStage ? '' : blocksXML('pen_stamp', 'pen_penDown', 'pen_penUp') + sep + blocksXML('pen_setPenColorToColor', 'pen_changePenSizeBy', 'pen_setPenSizeTo', 'pen_setPenTransparency'))) +
      `</xml>`;
  }

  window.SparkBlocks = { makeToolbox, CATS };
})();
