/* ============================================================
   BlockWorld 3D — block language
   Scratch-look blocks (Blockly + Zelos renderer) built for 3D:
   motion in x/y/z, physics, camera, animation, clones, sound.
   Every block has a JavaScript generator that targets the
   runtime in engine.js  (self = this object, R = runtime, V = vars)
   ============================================================ */
(function(){
'use strict';

// [primary, secondary (inputs/dropdowns), tertiary (outline)] — the real Scratch 3 palette + two new 3D categories
const PAL = {
  motion:['#4C97FF','#4280D7','#3373CC'], looks:['#9966FF','#855CD6','#774DCB'], sound:['#CF63CF','#C94FC9','#BD42BD'],
  events:['#FFBF00','#E6AC00','#CC9900'], control:['#FFAB19','#EC9C13','#CF8B17'], sensing:['#5CB1D6','#47A8D1','#2E8EB8'],
  operators:['#59C059','#46B946','#389438'], variables:['#FF8C1A','#FF8000','#DB6E00'],
  physics:['#12B886','#0CA678','#099268'], camera:['#F26A5B','#E8503F','#D9432F']
};
const C = {}; for (const k in PAL) C[k] = PAL[k][0];
window.BW_COLORS = C;

/* ---------- theme (dark workspace, Scratch 3-tone blocks) ---------- */
const catStyle = {}, blockStyles = {};
for (const k in PAL){
  catStyle[k+'_category'] = { colour: PAL[k][0] };
  blockStyles[k+'_blocks'] = { colourPrimary: PAL[k][0], colourSecondary: PAL[k][1], colourTertiary: PAL[k][2], hat: '' };
}
window.BW_THEME = Blockly.Theme.defineTheme('blockworld', {
  base: Blockly.Themes.Zelos,
  fontStyle: { family: '"Helvetica Neue", Helvetica, Arial, sans-serif', weight: 'bold', size: 12 },
  categoryStyles: catStyle, blockStyles,
  componentStyles: {
    workspaceBackgroundColour: '#1a1d28', toolboxBackgroundColour: '#1b1e29', toolboxForegroundColour: '#c7cbe0',
    flyoutBackgroundColour: '#20232f', flyoutForegroundColour: '#c7cbe0', flyoutOpacity: 1,
    scrollbarColour: '#5a6080', scrollbarOpacity: 0.55, insertionMarkerColour: '#ffffff', insertionMarkerOpacity: 0.35,
    cursorColour: '#ffffff', markerColour: '#a78bfa'
  }
});

/* ---------- dynamic dropdowns (filled by the editor) ---------- */
window.BW_hooks = {
  objectNames: () => [],                // names of objects in the project
  animationNames: () => [],             // clips on the object being edited
  variableNames: () => []
};
const objOpts = (extra=[]) => () => {
  const names = window.BW_hooks.objectNames();
  const list = extra.concat(names.map(n => [n, n]));
  return list.length ? list : [['(no objects)', '']];
};
const animOpts = () => () => {
  const names = window.BW_hooks.animationNames();
  return names.length ? names.map(n => [n, n]) : [['(no animations)', '']];
};
const KEYS = [['space','space'],['up arrow','up arrow'],['down arrow','down arrow'],['left arrow','left arrow'],['right arrow','right arrow'],['any','any'],['enter','enter'],['shift','shift']]
  .concat('abcdefghijklmnopqrstuvwxyz0123456789'.split('').map(k => [k, k]));

/* ---------- block definition helper ----------
   def(type, category, message, args, {kind})   kind: 'stmt' | 'hat' | 'rep' | 'bool' | 'cap'
--------------------------------------------------*/
const defs = [];
function def(type, cat, message0, args0, opt={}){
  const kind = opt.kind || 'stmt';
  const d = { type, message0, args0: args0 || [], style: cat + '_blocks', tooltip: opt.tip || '', inputsInline: true };
  if (kind === 'stmt') { d.previousStatement = null; d.nextStatement = null; }
  if (kind === 'hat')  { d.nextStatement = null; d.hat = 'cap'; }
  if (kind === 'cap')  { d.previousStatement = null; }
  if (kind === 'rep')  { d.output = opt.out || null; }
  if (kind === 'bool') { d.output = 'Boolean'; }
  if (opt.extra) Object.assign(d, opt.extra);
  defs.push(d);
}
const num = name => ({ type:'input_value', name, check:['Number','String'] });
const anyv = name => ({ type:'input_value', name });
const boolv = name => ({ type:'input_value', name, check:'Boolean' });
const dd = (name, options) => ({ type:'field_dropdown', name, options });
const txt = (name, text) => ({ type:'field_input', name, text });
const stmt = name => ({ type:'input_statement', name });
const flagImg = { type:'field_image', width:24, height:24, alt:'▶',
  src:'data:image/svg+xml;utf8,'+encodeURIComponent('<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24"><path d="M4 3v19" stroke="#2d8a3e" stroke-width="2.4" stroke-linecap="round"/><path d="M5.5 4h13l-3.5 4.5 3.5 4.5h-13z" fill="#4cbb17"/></svg>') };

/* ===================== EVENTS ===================== */
def('event_whenflag', 'events', 'when %1 clicked', [flagImg], {kind:'hat', tip:'Runs when you press Play'});
def('event_whenkey', 'events', 'when %1 key pressed', [dd('KEY', KEYS)], {kind:'hat', tip:'Runs while the key is held'});
def('event_whenclicked', 'events', 'when this object clicked', [], {kind:'hat'});
def('event_whentouch', 'events', 'when this touches %1', [dd('TARGET', objOpts([['anything','__any__']]))], {kind:'hat', tip:'Runs when this object starts touching another'});
def('event_whenbroadcast', 'events', 'when I receive %1', [txt('MSG','message1')], {kind:'hat'});
def('event_broadcast', 'events', 'broadcast %1', [anyv('MSG')]);
def('event_broadcastwait', 'events', 'broadcast %1 and wait', [anyv('MSG')]);

/* ===================== MOTION ===================== */
def('motion_forward', 'motion', 'move %1 steps', [num('STEPS')], {tip:'Move in the direction this object is facing (1 step = 1 meter)'});
def('motion_turnright', 'motion', 'turn ↻ %1 degrees', [num('DEG')]);
def('motion_turnleft', 'motion', 'turn ↺ %1 degrees', [num('DEG')]);
def('motion_point', 'motion', 'point in direction %1', [num('DIR')]);
def('motion_pointtowards', 'motion', 'point towards %1', [dd('TARGET', objOpts())]);
def('motion_goto', 'motion', 'go to x: %1 y: %2 z: %3', [num('X'), num('Y'), num('Z')]);
def('motion_gotoobj', 'motion', 'go to %1', [dd('TARGET', objOpts([['random position','__random__']]))]);
def('motion_glide', 'motion', 'glide %1 secs to x: %2 y: %3 z: %4', [num('SECS'), num('X'), num('Y'), num('Z')]);
def('motion_glideobj', 'motion', 'glide %1 secs to %2', [num('SECS'), dd('TARGET', objOpts())]);
def('motion_changeby', 'motion', 'change %1 by %2', [dd('AXIS',[['x','x'],['y','y'],['z','z']]), num('V')]);
def('motion_setaxis', 'motion', 'set %1 to %2', [dd('AXIS',[['x','x'],['y','y'],['z','z']]), num('V')]);
def('motion_setrot', 'motion', 'set rotation x: %1 y: %2 z: %3', [num('X'), num('Y'), num('Z')]);
def('motion_tilt', 'motion', 'tilt %1 by %2 degrees', [dd('AXIS',[['forward/back (x)','x'],['sideways (z)','z']]), num('DEG')]);
def('motion_moveaxis', 'motion', 'move %1 by %2', [dd('DIR',[['up','up'],['down','down'],['left','left'],['right','right'],['back','back']]), num('V')], {tip:'Move relative to where this object is facing'});
def('motion_xpos', 'motion', 'x position', [], {kind:'rep', out:'Number'});
def('motion_ypos', 'motion', 'y position', [], {kind:'rep', out:'Number'});
def('motion_zpos', 'motion', 'z position', [], {kind:'rep', out:'Number'});
def('motion_dir', 'motion', 'direction', [], {kind:'rep', out:'Number'});

/* ===================== LOOKS ===================== */
def('looks_sayfor', 'looks', 'say %1 for %2 seconds', [anyv('TEXT'), num('SECS')]);
def('looks_say', 'looks', 'say %1', [anyv('TEXT')]);
def('looks_show', 'looks', 'show', []);
def('looks_hide', 'looks', 'hide', []);
def('looks_setcolor', 'looks', 'set color to %1', [{type:'field_colour', name:'COLOR', colour:'#ff5555'}]);
def('looks_setcolorval', 'looks', 'set color to %1', [anyv('COLOR')], {tip:'A color name or #hex'});
def('looks_setsize', 'looks', 'set size to %1 %', [num('SIZE')]);
def('looks_changesize', 'looks', 'change size by %1', [num('DELTA')]);
def('looks_setopacity', 'looks', 'set transparency to %1 %', [num('V')]);
def('looks_material', 'looks', 'set material to %1', [dd('MAT',[['normal','normal'],['shiny','shiny'],['metal','metal'],['glass','glass'],['glow','glow'],['flat','flat']])]);
def('looks_anim', 'looks', 'play animation %1', [dd('NAME', animOpts())], {tip:'Loops the animation (models from the Workshop)'});
def('looks_animonce', 'looks', 'play animation %1 until done', [dd('NAME', animOpts())]);
def('looks_animstop', 'looks', 'stop animations', []);
def('looks_animspeed', 'looks', 'set animation speed to %1 %', [num('V')]);
def('looks_bigtext', 'looks', 'show big text %1 for %2 seconds', [anyv('TEXT'), num('SECS')]);
def('looks_size', 'looks', 'size', [], {kind:'rep', out:'Number'});

/* ===================== SOUND ===================== */
def('sound_play', 'sound', 'play sound %1', [dd('NAME',[['jump','jump'],['coin','coin'],['hit','hit'],['boom','boom'],['laser','laser'],['pop','pop'],['powerup','powerup'],['lose','lose'],['win','win']])]);
def('sound_note', 'sound', 'play note %1 for %2 beats', [num('NOTE'), num('BEATS')]);
def('sound_volume', 'sound', 'set volume to %1 %', [num('V')]);

/* ===================== PHYSICS ===================== */
def('physics_enable', 'physics', 'turn physics %1', [dd('ON',[['on','on'],['off','off']])]);
def('physics_type', 'physics', 'set physics type to %1', [dd('T',[['dynamic (moves & falls)','dynamic'],['static (never moves)','static']])]);
def('physics_mass', 'physics', 'set mass to %1', [num('V')]);
def('physics_bounce', 'physics', 'set bounciness to %1', [num('V')], {tip:'0 = no bounce, 1 = super bouncy'});
def('physics_friction', 'physics', 'set friction to %1', [num('V')]);
def('physics_pushdir', 'physics', 'push %1 with power %2', [dd('DIR',[['forward','forward'],['back','back'],['up','up'],['left','left'],['right','right']]), num('V')]);
def('physics_push', 'physics', 'push x: %1 y: %2 z: %3', [num('X'), num('Y'), num('Z')]);
def('physics_jump', 'physics', 'jump with power %1', [num('V')], {tip:'Only jumps when standing on something'});
def('physics_setvel', 'physics', 'set velocity x: %1 y: %2 z: %3', [num('X'), num('Y'), num('Z')]);
def('physics_setvelaxis', 'physics', 'set %1 velocity to %2', [dd('AXIS',[['x','x'],['y','y'],['z','z']]), num('V')]);
def('physics_stop', 'physics', 'stop moving', []);
def('physics_gravity', 'physics', 'set gravity to %1', [num('V')], {tip:'Earth is 9.8'});
def('physics_vel', 'physics', '%1 velocity', [dd('AXIS',[['x','x'],['y','y'],['z','z'],['speed','speed']])], {kind:'rep', out:'Number'});
def('physics_onground', 'physics', 'on ground?', [], {kind:'bool'});

/* ===================== CAMERA ===================== */
def('camera_follow', 'camera', 'camera follow %1 distance %2 height %3', [dd('TARGET', objOpts()), num('DIST'), num('H')], {tip:'Third-person camera behind the object'});
def('camera_top', 'camera', 'camera above %1 height %2', [dd('TARGET', objOpts()), num('H')]);
def('camera_firstperson', 'camera', 'camera first person on %1', [dd('TARGET', objOpts())]);
def('camera_offset', 'camera', 'camera follow %1 offset x: %2 y: %3 z: %4', [dd('TARGET', objOpts()), num('X'), num('Y'), num('Z')]);
def('camera_setpos', 'camera', 'set camera position x: %1 y: %2 z: %3', [num('X'), num('Y'), num('Z')]);
def('camera_lookat', 'camera', 'camera look at %1', [dd('TARGET', objOpts())]);
def('camera_free', 'camera', 'camera free look (orbit with mouse)', []);
def('camera_mouselook', 'camera', 'mouse look %1', [dd('ON',[['on','on'],['off','off']])], {tip:'Click the game, then the mouse turns the followed object'});
def('camera_fov', 'camera', 'set camera zoom to %1 %', [num('V')]);
def('camera_shake', 'camera', 'shake camera %1', [num('V')]);

/* ===================== SENSING ===================== */
def('sensing_touching', 'sensing', 'touching %1 ?', [dd('TARGET', objOpts([['anything','__any__']]))], {kind:'bool'});
def('sensing_distance', 'sensing', 'distance to %1', [dd('TARGET', objOpts())], {kind:'rep', out:'Number'});
def('sensing_of', 'sensing', '%1 of %2', [dd('PROP',[['x position','x'],['y position','y'],['z position','z'],['direction','dir'],['size','size']]), dd('TARGET', objOpts())], {kind:'rep', out:'Number'});
def('sensing_keypressed', 'sensing', 'key %1 pressed?', [dd('KEY', KEYS)], {kind:'bool'});
def('sensing_mousedown', 'sensing', 'mouse down?', [], {kind:'bool'});
def('sensing_mouse', 'sensing', 'mouse %1', [dd('AXIS',[['x','x'],['y','y']])], {kind:'rep', out:'Number'});
def('sensing_timer', 'sensing', 'timer', [], {kind:'rep', out:'Number'});
def('sensing_resettimer', 'sensing', 'reset timer', []);
def('sensing_exists', 'sensing', '%1 exists?', [dd('TARGET', objOpts())], {kind:'bool'});
def('sensing_count', 'sensing', 'number of %1', [dd('TARGET', objOpts())], {kind:'rep', out:'Number', tip:'Counts the object plus its clones'});

/* ===================== CONTROL ===================== */
def('control_wait', 'control', 'wait %1 seconds', [num('SECS')]);
def('control_repeat', 'control', 'repeat %1 %2', [num('TIMES'), stmt('DO')]);
def('control_forever', 'control', 'forever %1', [stmt('DO')], {kind:'cap'});
def('control_if', 'control', 'if %1 then %2', [boolv('COND'), stmt('DO')]);
def('control_ifelse', 'control', 'if %1 then %2 else %3', [boolv('COND'), stmt('DO'), stmt('ELSE')]);
def('control_waituntil', 'control', 'wait until %1', [boolv('COND')]);
def('control_repeatuntil', 'control', 'repeat until %1 %2', [boolv('COND'), stmt('DO')]);
def('control_stop', 'control', 'stop %1', [dd('WHAT',[['all','all'],['this script','this'],['other scripts in object','other']])], {kind:'cap'});
def('control_clone', 'control', 'create clone of %1', [dd('TARGET', objOpts([['myself','__self__']]))]);
def('control_startclone', 'control', 'when I start as a clone', [], {kind:'hat'});
def('control_deleteclone', 'control', 'delete this clone', [], {kind:'cap'});
def('control_deleteobj', 'control', 'delete this object', [], {kind:'cap'});

/* ===================== OPERATORS ===================== */
def('op_add', 'operators', '%1 + %2', [num('A'), num('B')], {kind:'rep', out:'Number'});
def('op_sub', 'operators', '%1 - %2', [num('A'), num('B')], {kind:'rep', out:'Number'});
def('op_mul', 'operators', '%1 * %2', [num('A'), num('B')], {kind:'rep', out:'Number'});
def('op_div', 'operators', '%1 / %2', [num('A'), num('B')], {kind:'rep', out:'Number'});
def('op_random', 'operators', 'pick random %1 to %2', [num('A'), num('B')], {kind:'rep', out:'Number'});
def('op_gt', 'operators', '%1 > %2', [anyv('A'), anyv('B')], {kind:'bool'});
def('op_lt', 'operators', '%1 < %2', [anyv('A'), anyv('B')], {kind:'bool'});
def('op_eq', 'operators', '%1 = %2', [anyv('A'), anyv('B')], {kind:'bool'});
def('op_and', 'operators', '%1 and %2', [boolv('A'), boolv('B')], {kind:'bool'});
def('op_or', 'operators', '%1 or %2', [boolv('A'), boolv('B')], {kind:'bool'});
def('op_not', 'operators', 'not %1', [boolv('A')], {kind:'bool'});
def('op_join', 'operators', 'join %1 %2', [anyv('A'), anyv('B')], {kind:'rep', out:'String'});
def('op_letter', 'operators', 'letter %1 of %2', [num('N'), anyv('S')], {kind:'rep', out:'String'});
def('op_length', 'operators', 'length of %1', [anyv('S')], {kind:'rep', out:'Number'});
def('op_mod', 'operators', '%1 mod %2', [num('A'), num('B')], {kind:'rep', out:'Number'});
def('op_round', 'operators', 'round %1', [num('A')], {kind:'rep', out:'Number'});
def('op_math', 'operators', '%1 of %2', [dd('F',[['abs','abs'],['floor','floor'],['ceiling','ceil'],['sqrt','sqrt'],['sin','sin'],['cos','cos'],['tan','tan'],['ln','log'],['e ^','exp'],['10 ^','pow10']]), num('A')], {kind:'rep', out:'Number'});

/* ===================== VARIABLES ===================== */
def('data_variable', 'variables', '%1', [{type:'field_variable', name:'VAR', variable:'my variable'}], {kind:'rep'});
def('data_setvariableto', 'variables', 'set %1 to %2', [{type:'field_variable', name:'VAR', variable:'my variable'}, anyv('VALUE')]);
def('data_changevariableby', 'variables', 'change %1 by %2', [{type:'field_variable', name:'VAR', variable:'my variable'}, num('VALUE')]);
def('data_showvariable', 'variables', 'show variable %1', [{type:'field_variable', name:'VAR', variable:'my variable'}]);
def('data_hidevariable', 'variables', 'hide variable %1', [{type:'field_variable', name:'VAR', variable:'my variable'}]);

Blockly.defineBlocksWithJsonArray(defs);
// Scratch-style reporters: round; booleans: hexagon (zelos does this from output checks)
Blockly.Blocks['data_variable'].customContextMenu = null;

/* ===================== TOOLBOX ===================== */
// b(type, {INPUT: default}) → toolbox block with shadow number/text inputs
function b(type, values={}, fields={}){
  const inputs = {};
  for (const k in values){
    const v = values[k];
    inputs[k] = typeof v === 'number'
      ? { shadow: { type:'math_number', fields:{ NUM: v } } }
      : { shadow: { type:'text', fields:{ TEXT: v } } };
  }
  const e = { kind:'block', type };
  if (Object.keys(inputs).length) e.inputs = inputs;
  if (Object.keys(fields).length) e.fields = fields;
  return e;
}
const cat = (name, colour, contents, extra={}) => Object.assign({ kind:'category', name, colour, contents }, extra);
const sep = () => ({ kind:'sep', gap: 24 });

window.BW_TOOLBOX = { kind:'categoryToolbox', contents: [
  cat('Motion', C.motion, [
    b('motion_forward',{STEPS:1}), b('motion_turnright',{DEG:15}), b('motion_turnleft',{DEG:15}), sep(),
    b('motion_point',{DIR:0}), b('motion_pointtowards'), sep(),
    b('motion_goto',{X:0,Y:1,Z:0}), b('motion_gotoobj'), b('motion_glide',{SECS:1,X:0,Y:1,Z:0}), b('motion_glideobj',{SECS:1}), sep(),
    b('motion_changeby',{V:1}), b('motion_setaxis',{V:0}), b('motion_moveaxis',{V:1}), sep(),
    b('motion_setrot',{X:0,Y:0,Z:0}), b('motion_tilt',{DEG:15}), sep(),
    b('motion_xpos'), b('motion_ypos'), b('motion_zpos'), b('motion_dir')
  ]),
  cat('Looks', C.looks, [
    b('looks_sayfor',{TEXT:'Hello!',SECS:2}), b('looks_say',{TEXT:'Hello!'}), b('looks_bigtext',{TEXT:'You win!',SECS:2}), sep(),
    b('looks_show'), b('looks_hide'), sep(),
    b('looks_setcolor'), b('looks_setcolorval',{COLOR:'red'}), b('looks_material'), b('looks_setopacity',{V:50}), sep(),
    b('looks_setsize',{SIZE:100}), b('looks_changesize',{DELTA:10}), b('looks_size'), sep(),
    b('looks_anim'), b('looks_animonce'), b('looks_animstop'), b('looks_animspeed',{V:100})
  ]),
  cat('Sound', C.sound, [ b('sound_play'), b('sound_note',{NOTE:60,BEATS:0.5}), b('sound_volume',{V:100}) ]),
  cat('Events', C.events, [
    b('event_whenflag'), b('event_whenkey'), b('event_whenclicked'), b('event_whentouch'), sep(),
    b('event_whenbroadcast'), b('event_broadcast',{MSG:'message1'}), b('event_broadcastwait',{MSG:'message1'})
  ]),
  cat('Control', C.control, [
    b('control_wait',{SECS:1}), b('control_repeat',{TIMES:10}), b('control_forever'), sep(),
    b('control_if'), b('control_ifelse'), b('control_waituntil'), b('control_repeatuntil'), sep(),
    b('control_stop'), sep(),
    b('control_startclone'), b('control_clone'), b('control_deleteclone'), b('control_deleteobj')
  ]),
  cat('Physics', C.physics, [
    b('physics_enable'), b('physics_type'), sep(),
    b('physics_pushdir',{V:5}), b('physics_jump',{V:6}), b('physics_push',{X:0,Y:5,Z:0}), sep(),
    b('physics_setvel',{X:0,Y:0,Z:0}), b('physics_setvelaxis',{V:0}), b('physics_stop'), sep(),
    b('physics_mass',{V:1}), b('physics_bounce',{V:0.5}), b('physics_friction',{V:0.4}), b('physics_gravity',{V:9.8}), sep(),
    b('physics_vel'), b('physics_onground')
  ]),
  cat('Camera', C.camera, [
    b('camera_follow',{DIST:6,H:3}), b('camera_top',{H:15}), b('camera_firstperson'), b('camera_offset',{X:0,Y:5,Z:8}), sep(),
    b('camera_setpos',{X:0,Y:5,Z:10}), b('camera_lookat'), b('camera_free'), sep(),
    b('camera_mouselook'), b('camera_fov',{V:100}), b('camera_shake',{V:0.5})
  ]),
  cat('Sensing', C.sensing, [
    b('sensing_touching'), b('sensing_distance'), b('sensing_of'), sep(),
    b('sensing_keypressed'), b('sensing_mousedown'), b('sensing_mouse'), sep(),
    b('sensing_timer'), b('sensing_resettimer'), sep(),
    b('sensing_exists'), b('sensing_count')
  ]),
  cat('Operators', C.operators, [
    b('op_add',{A:'',B:''}), b('op_sub',{A:'',B:''}), b('op_mul',{A:'',B:''}), b('op_div',{A:'',B:''}), sep(),
    b('op_random',{A:1,B:10}), sep(),
    b('op_gt',{A:'',B:50}), b('op_lt',{A:'',B:50}), b('op_eq',{A:'',B:50}), sep(),
    b('op_and'), b('op_or'), b('op_not'), sep(),
    b('op_join',{A:'apple ',B:'banana'}), b('op_letter',{N:1,S:'apple'}), b('op_length',{S:'apple'}), sep(),
    b('op_mod',{A:'',B:''}), b('op_round',{A:''}), b('op_math',{A:''})
  ]),
  cat('Variables', C.variables, [], { custom:'VARIABLE' })
]};
// text shadows for operator inputs that take numbers: use math_number when value is ''
for (const c of window.BW_TOOLBOX.contents){
  if (c.name !== 'Operators') continue;
  for (const e of c.contents) if (e.inputs) for (const k in e.inputs){
    const sh = e.inputs[k].shadow;
    if (sh.type === 'text' && sh.fields.TEXT === '' ) { e.inputs[k].shadow = { type:'math_number', fields:{ NUM: '' } }; }
  }
}

// Variables flyout: "Make a Variable" button + one reporter per variable + set/change/show/hide
window.BW_variableFlyout = function(workspace){
  const xml = [];
  const contents = [{ kind:'button', text:'Make a Variable', callbackKey:'CREATE_VARIABLE' }];
  const vars = workspace.getVariableMap().getVariablesOfType('').slice();
  const nm = v => v.getName ? v.getName() : v.name;
  vars.sort((a,b) => nm(a).localeCompare(nm(b)));
  for (const v of vars) contents.push({ kind:'block', type:'data_variable', fields:{ VAR:{ id:v.getId(), name:nm(v), type:'' } } });
  if (vars.length){
    const first = { id: vars[0].getId(), name: nm(vars[0]), type:'' };
    contents.push({ kind:'sep', gap:24 });
    contents.push({ kind:'block', type:'data_setvariableto', fields:{ VAR:first }, inputs:{ VALUE:{ shadow:{ type:'math_number', fields:{ NUM:0 } } } } });
    contents.push({ kind:'block', type:'data_changevariableby', fields:{ VAR:first }, inputs:{ VALUE:{ shadow:{ type:'math_number', fields:{ NUM:1 } } } } });
    contents.push({ kind:'block', type:'data_showvariable', fields:{ VAR:first } });
    contents.push({ kind:'block', type:'data_hidevariable', fields:{ VAR:first } });
  }
  return contents;
};

/* ===================== JAVASCRIPT GENERATORS =====================
   Generated code runs inside:  function*(self, R, V){ ... }
   self = the object's runtime handle, R = runtime, V = variables
   Loops `yield` once per iteration so scripts run in parallel like Scratch.
------------------------------------------------------------------- */
const G = (typeof javascript !== 'undefined' && javascript.javascriptGenerator) || Blockly.JavaScript;
const ORDER = (typeof javascript !== 'undefined' && javascript.Order) || Blockly.JavaScript.ORDER || {};
const ATOMIC = ORDER.ATOMIC != null ? ORDER.ATOMIC : 0, NONE = ORDER.NONE != null ? ORDER.NONE : 99;
let uid = 0;
const val = (blk, name, dflt='0') => { const c = G.valueToCode(blk, name, NONE); return c === '' ? dflt : c; };
const n = (blk, name, dflt='0') => 'R.n(' + val(blk, name, dflt) + ')';
const bv = (blk, name) => { const c = G.valueToCode(blk, name, NONE); return c === '' ? 'false' : 'R.b(' + c + ')'; };
const body = (blk, name) => G.statementToCode(blk, name);
const str = s => JSON.stringify(s);
const field = (blk, name) => str(blk.getFieldValue(name));
const varName = blk => { const v = blk.getField('VAR').getVariable(); return str(v ? (v.getName ? v.getName() : v.name) : 'my variable'); };
const S = (type, fn) => G.forBlock[type] = fn;
const REP = (type, fn) => G.forBlock[type] = blk => [fn(blk), ATOMIC];

// hats: they are compiled by the runtime (engine.js) — the generator only emits the body of the chain
const HATS = { event_whenflag: b=>({hat:'flag'}), event_whenkey: b=>({hat:'key', key:b.getFieldValue('KEY')}),
  event_whenclicked: b=>({hat:'click'}), event_whentouch: b=>({hat:'touch', target:b.getFieldValue('TARGET')}),
  event_whenbroadcast: b=>({hat:'broadcast', msg:String(b.getFieldValue('MSG')).toLowerCase()}), control_startclone: b=>({hat:'clone'}) };
window.BW_HATS = HATS;
for (const t in HATS) S(t, () => '');

// events
S('event_broadcast', b => 'R.broadcast(' + val(b,'MSG','""') + ');\n');
S('event_broadcastwait', b => 'yield* R.broadcastWait(' + val(b,'MSG','""') + ');\n');
// motion
S('motion_forward', b => 'self.forward(' + n(b,'STEPS') + ');\n');
S('motion_turnright', b => 'self.turn(-' + n(b,'DEG') + ');\n');
S('motion_turnleft', b => 'self.turn(' + n(b,'DEG') + ');\n');
S('motion_point', b => 'self.setDir(' + n(b,'DIR') + ');\n');
S('motion_pointtowards', b => 'self.pointTowards(' + field(b,'TARGET') + ');\n');
S('motion_goto', b => 'self.goTo(' + n(b,'X') + ',' + n(b,'Y') + ',' + n(b,'Z') + ');\n');
S('motion_gotoobj', b => 'self.goToObj(' + field(b,'TARGET') + ');\n');
S('motion_glide', b => 'yield* self.glide(' + n(b,'SECS') + ',' + n(b,'X') + ',' + n(b,'Y') + ',' + n(b,'Z') + ');\n');
S('motion_glideobj', b => 'yield* self.glideObj(' + n(b,'SECS') + ',' + field(b,'TARGET') + ');\n');
S('motion_changeby', b => 'self.changeAxis(' + field(b,'AXIS') + ',' + n(b,'V') + ');\n');
S('motion_setaxis', b => 'self.setAxis(' + field(b,'AXIS') + ',' + n(b,'V') + ');\n');
S('motion_setrot', b => 'self.setRot(' + n(b,'X') + ',' + n(b,'Y') + ',' + n(b,'Z') + ');\n');
S('motion_tilt', b => 'self.tilt(' + field(b,'AXIS') + ',' + n(b,'DEG') + ');\n');
S('motion_moveaxis', b => 'self.moveDir(' + field(b,'DIR') + ',' + n(b,'V') + ');\n');
REP('motion_xpos', b => 'self.pos().x'); REP('motion_ypos', b => 'self.pos().y'); REP('motion_zpos', b => 'self.pos().z');
REP('motion_dir', b => 'self.dir()');
// looks
S('looks_sayfor', b => 'yield* self.sayFor(' + val(b,'TEXT','""') + ',' + n(b,'SECS') + ');\n');
S('looks_say', b => 'self.say(' + val(b,'TEXT','""') + ');\n');
S('looks_show', b => 'self.setVisible(true);\n'); S('looks_hide', b => 'self.setVisible(false);\n');
S('looks_setcolor', b => 'self.setColor(' + field(b,'COLOR') + ');\n');
S('looks_setcolorval', b => 'self.setColor(R.s(' + val(b,'COLOR','"red"') + '));\n');
S('looks_setsize', b => 'self.setSize(' + n(b,'SIZE') + ');\n');
S('looks_changesize', b => 'self.setSize(self.size()+' + n(b,'DELTA') + ');\n');
S('looks_setopacity', b => 'self.setOpacity(' + n(b,'V') + ');\n');
S('looks_material', b => 'self.setMaterial(' + field(b,'MAT') + ');\n');
S('looks_anim', b => 'self.playAnim(' + field(b,'NAME') + ', true);\n');
S('looks_animonce', b => 'yield* self.playAnimOnce(' + field(b,'NAME') + ');\n');
S('looks_animstop', b => 'self.stopAnim();\n');
S('looks_animspeed', b => 'self.animSpeed(' + n(b,'V') + ');\n');
S('looks_bigtext', b => 'yield* R.bigText(' + val(b,'TEXT','""') + ',' + n(b,'SECS') + ');\n');
REP('looks_size', b => 'self.size()');
// sound
S('sound_play', b => 'R.sound(' + field(b,'NAME') + ');\n');
S('sound_note', b => 'yield* R.note(' + n(b,'NOTE') + ',' + n(b,'BEATS') + ');\n');
S('sound_volume', b => 'R.volume(' + n(b,'V') + ');\n');
// physics
S('physics_enable', b => 'self.physicsOn(' + (b.getFieldValue('ON') === 'on') + ');\n');
S('physics_type', b => 'self.physicsType(' + field(b,'T') + ');\n');
S('physics_mass', b => 'self.setMass(' + n(b,'V') + ');\n');
S('physics_bounce', b => 'self.setBounce(' + n(b,'V') + ');\n');
S('physics_friction', b => 'self.setFriction(' + n(b,'V') + ');\n');
S('physics_pushdir', b => 'self.pushDir(' + field(b,'DIR') + ',' + n(b,'V') + ');\n');
S('physics_push', b => 'self.push(' + n(b,'X') + ',' + n(b,'Y') + ',' + n(b,'Z') + ');\n');
S('physics_jump', b => 'self.jump(' + n(b,'V') + ');\n');
S('physics_setvel', b => 'self.setVel(' + n(b,'X') + ',' + n(b,'Y') + ',' + n(b,'Z') + ');\n');
S('physics_setvelaxis', b => 'self.setVelAxis(' + field(b,'AXIS') + ',' + n(b,'V') + ');\n');
S('physics_stop', b => 'self.setVel(0,0,0);\n');
S('physics_gravity', b => 'R.setGravity(' + n(b,'V') + ');\n');
REP('physics_vel', b => 'self.vel(' + field(b,'AXIS') + ')');
G.forBlock['physics_onground'] = b => ['self.onGround()', ATOMIC];
// camera
S('camera_follow', b => 'R.cam.follow(' + field(b,'TARGET') + ',' + n(b,'DIST') + ',' + n(b,'H') + ');\n');
S('camera_top', b => 'R.cam.top(' + field(b,'TARGET') + ',' + n(b,'H') + ');\n');
S('camera_firstperson', b => 'R.cam.firstPerson(' + field(b,'TARGET') + ');\n');
S('camera_offset', b => 'R.cam.offset(' + field(b,'TARGET') + ',' + n(b,'X') + ',' + n(b,'Y') + ',' + n(b,'Z') + ');\n');
S('camera_setpos', b => 'R.cam.setPos(' + n(b,'X') + ',' + n(b,'Y') + ',' + n(b,'Z') + ');\n');
S('camera_lookat', b => 'R.cam.lookAt(' + field(b,'TARGET') + ');\n');
S('camera_free', b => 'R.cam.free();\n');
S('camera_mouselook', b => 'R.cam.mouseLook(' + (b.getFieldValue('ON') === 'on') + ');\n');
S('camera_fov', b => 'R.cam.zoom(' + n(b,'V') + ');\n');
S('camera_shake', b => 'R.cam.shake(' + n(b,'V') + ');\n');
// sensing
G.forBlock['sensing_touching'] = b => ['self.touching(' + field(b,'TARGET') + ')', ATOMIC];
REP('sensing_distance', b => 'self.distanceTo(' + field(b,'TARGET') + ')');
REP('sensing_of', b => 'R.propOf(' + field(b,'TARGET') + ',' + field(b,'PROP') + ')');
G.forBlock['sensing_keypressed'] = b => ['R.key(' + field(b,'KEY') + ')', ATOMIC];
G.forBlock['sensing_mousedown'] = b => ['R.input.mouseDown', ATOMIC];
REP('sensing_mouse', b => 'R.input.mouse' + b.getFieldValue('AXIS').toUpperCase());
REP('sensing_timer', b => 'R.timer()');
S('sensing_resettimer', b => 'R.resetTimer();\n');
G.forBlock['sensing_exists'] = b => ['R.exists(' + field(b,'TARGET') + ')', ATOMIC];
REP('sensing_count', b => 'R.count(' + field(b,'TARGET') + ')');
// control
S('control_wait', b => 'yield* R.wait(' + n(b,'SECS') + ');\n');
S('control_repeat', b => { const i = '_i' + (uid++); return 'for(let ' + i + '=0,_n' + i + '=Math.round(' + n(b,'TIMES') + ');' + i + '<_n' + i + ';' + i + '++){\n' + body(b,'DO') + '  yield;\n}\n'; });
S('control_forever', b => 'while(true){\n' + body(b,'DO') + '  yield;\n}\n');
S('control_if', b => 'if(' + bv(b,'COND') + '){\n' + body(b,'DO') + '}\n');
S('control_ifelse', b => 'if(' + bv(b,'COND') + '){\n' + body(b,'DO') + '} else {\n' + body(b,'ELSE') + '}\n');
S('control_waituntil', b => 'while(!' + bv(b,'COND') + '){ yield; }\n');
S('control_repeatuntil', b => 'while(!' + bv(b,'COND') + '){\n' + body(b,'DO') + '  yield;\n}\n');
S('control_stop', b => { const w = b.getFieldValue('WHAT'); return w === 'all' ? 'R.stopAll(); return;\n' : w === 'other' ? 'R.stopOthers(self, _thread);\n' : 'return;\n'; });
S('control_clone', b => 'R.clone(self, ' + field(b,'TARGET') + ');\n');
S('control_deleteclone', b => 'R.deleteClone(self); return;\n');
S('control_deleteobj', b => 'R.deleteObject(self); return;\n');
// operators
REP('op_add', b => '(' + n(b,'A') + '+' + n(b,'B') + ')');
REP('op_sub', b => '(' + n(b,'A') + '-' + n(b,'B') + ')');
REP('op_mul', b => '(' + n(b,'A') + '*' + n(b,'B') + ')');
REP('op_div', b => '(' + n(b,'A') + '/' + n(b,'B') + ')');
REP('op_random', b => 'R.random(' + n(b,'A') + ',' + n(b,'B') + ')');
G.forBlock['op_gt'] = b => ['R.cmp(' + val(b,'A','""') + ',' + val(b,'B','""') + ')>0', ATOMIC];
G.forBlock['op_lt'] = b => ['R.cmp(' + val(b,'A','""') + ',' + val(b,'B','""') + ')<0', ATOMIC];
G.forBlock['op_eq'] = b => ['R.cmp(' + val(b,'A','""') + ',' + val(b,'B','""') + ')===0', ATOMIC];
G.forBlock['op_and'] = b => ['(' + bv(b,'A') + '&&' + bv(b,'B') + ')', ATOMIC];
G.forBlock['op_or'] = b => ['(' + bv(b,'A') + '||' + bv(b,'B') + ')', ATOMIC];
G.forBlock['op_not'] = b => ['!' + bv(b,'A'), ATOMIC];
REP('op_join', b => '(R.s(' + val(b,'A','""') + ')+R.s(' + val(b,'B','""') + '))');
REP('op_letter', b => 'R.letter(' + n(b,'N') + ',' + val(b,'S','""') + ')');
REP('op_length', b => 'R.s(' + val(b,'S','""') + ').length');
REP('op_mod', b => 'R.mod(' + n(b,'A') + ',' + n(b,'B') + ')');
REP('op_round', b => 'Math.round(' + n(b,'A') + ')');
REP('op_math', b => 'R.mathOp(' + field(b,'F') + ',' + n(b,'A') + ')');
// variables
REP('data_variable', b => 'V.get(' + varName(b) + ')');
S('data_setvariableto', b => 'V.set(' + varName(b) + ',' + val(b,'VALUE','0') + ');\n');
S('data_changevariableby', b => 'V.change(' + varName(b) + ',' + n(b,'VALUE') + ');\n');
S('data_showvariable', b => 'V.show(' + varName(b) + ',true);\n');
S('data_hidevariable', b => 'V.show(' + varName(b) + ',false);\n');
// built-in shadows
G.forBlock['math_number'] = b => { const v = Number(b.getFieldValue('NUM')); return [isNaN(v) ? '0' : String(v), ATOMIC]; };
G.forBlock['text'] = b => [str(b.getFieldValue('TEXT')), ATOMIC];

/* Compile every script in a workspace → [{hat, ..., code}] */
window.BW_compileWorkspace = function(workspace){
  G.init(workspace);
  const out = [];
  for (const top of workspace.getTopBlocks(true)){
    const meta = HATS[top.type];
    if (!meta || !top.isEnabled()) continue;
    const next = top.getNextBlock();
    const code = next ? G.blockToCode(next) : '';
    out.push(Object.assign(meta(top), { code: typeof code === 'string' ? code : '' }));
  }
  return out;
};
})();
