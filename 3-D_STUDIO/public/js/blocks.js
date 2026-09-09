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
  physics:['#12B886','#0CA678','#099268'], camera:['#F26A5B','#E8503F','#D9432F'],
  effects:['#FF6EB4','#F55AA2','#E04A91'], custom:['#FF6680','#FF4D6A','#FF3355'], ui:['#2EC4B6','#22B0A3','#1A9A8E']
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
  listNames: () => [],                  // project lists
  soundNames: () => [],                 // uploaded sounds
  procNames: () => [],                  // "define" blocks in the current workspace
  textureNames: () => [],
  uiNames: () => []
};
const uiOpts = () => { const n = window.BW_hooks.uiNames(); return n.length ? n.map(x => [x, x]) : [['(make UI first)', '']]; };
const listOpts = () => { const n = window.BW_hooks.listNames(); return n.length ? n.map(x => [x, x]) : [['(make a list first)', '']]; };
const soundOpts = () => [['jump','jump'],['coin','coin'],['hit','hit'],['boom','boom'],['laser','laser'],['pop','pop'],['powerup','powerup'],['lose','lose'],['win','win'],['click','click'],['whoosh','whoosh'],['splash','splash']].concat(window.BW_hooks.soundNames().map(x => [x, x]));
const procOpts = () => { const n = window.BW_hooks.procNames(); return n.length ? n.map(x => [x, x]) : [['(define a block first)', '']]; };
const texOpts = () => [['none','none']].concat(window.BW_hooks.textureNames().map(x => [x, x]));
const INDEX_OPTS = [['1','1'],['last','last'],['random','random']];
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

/* ---------- colour field (Blockly 13 moved FieldColour to a plugin; this is a tiny native one) ---------- */
class FieldColour extends Blockly.Field {
  constructor(value, validator){ super(value || '#ff5555', validator); this.SERIALIZABLE = true; this.CURSOR = 'pointer'; }
  static fromJson(o){ return new this(o.colour); }
  initView(){ this.createBorderRect_(); this.borderRect_.setAttribute('rx', 8); this.borderRect_.setAttribute('ry', 8); this.size_ = new Blockly.utils.Size(34, 24); }
  applyColour(){ if (this.borderRect_){ this.borderRect_.style.fill = this.getValue(); this.borderRect_.style.stroke = 'rgba(0,0,0,.25)'; this.borderRect_.style.fillOpacity = '1'; } }
  render_(){ this.borderRect_.setAttribute('width', 34); this.borderRect_.setAttribute('height', 24); this.applyColour(); }
  doClassValidation_(v){ if (typeof v !== 'string') return null; if (/^#[0-9a-f]{6}$/i.test(v)) return v.toLowerCase(); const c = document.createElement('canvas').getContext('2d'); c.fillStyle = v; return /^#[0-9a-f]{6}$/i.test(c.fillStyle) ? c.fillStyle : null; }
  doValueUpdate_(v){ super.doValueUpdate_(v); this.applyColour(); }
  getText_(){ return this.getValue(); }
  showEditor_(){
    const input = document.createElement('input'); input.type = 'color'; input.value = this.getValue();
    const r = this.fieldGroup_.getBoundingClientRect(); Object.assign(input.style, { position: 'fixed', left: r.left + 'px', top: r.bottom + 'px', width: '1px', height: '1px', opacity: '0', border: '0', padding: '0' });
    document.body.appendChild(input);
    input.addEventListener('input', () => this.setValue(input.value));
    const done = () => { setTimeout(() => input.remove(), 300); };
    input.addEventListener('change', done); input.addEventListener('blur', done);
    input.click();
  }
}
Blockly.fieldRegistry.register('field_colour', FieldColour);

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

/* ===================== v2 additions ===================== */
def('event_whentimer', 'events', 'when timer > %1', [num('V')], {kind:'hat'});
def('motion_towards', 'motion', 'move towards %1 by %2', [dd('TARGET', objOpts()), num('V')]);
def('motion_turntowards', 'motion', 'turn towards %1 by up to %2 degrees', [dd('TARGET', objOpts()), num('V')], {tip:'Smoothly rotates to face something — great for enemies'});
def('motion_lookatxz', 'motion', 'point towards x: %1 z: %2', [num('X'), num('Z')]);
def('looks_texture', 'looks', 'set texture to %1', [dd('T', texOpts)]);
def('looks_settext', 'looks', 'set text to %1', [anyv('TEXT')], {tip:'For Text objects'});
def('looks_light', 'looks', 'set light %1 to %2', [dd('W',[['color','color'],['brightness','brightness'],['range','range']]), anyv('V')], {tip:'For Light objects'});
def('looks_lighton', 'looks', 'turn light %1', [dd('ON',[['on','on'],['off','off']])]);
def('fx_particles', 'effects', 'burst %1 particles color %2 speed %3', [num('N'), {type:'field_colour', name:'COLOR', colour:'#ffcc00'}, num('S')]);
def('fx_particlesat', 'effects', 'burst %1 particles at x: %2 y: %3 z: %4 color %5', [num('N'), num('X'), num('Y'), num('Z'), anyv('COLOR')]);
def('fx_flash', 'effects', 'flash screen %1 for %2 seconds', [{type:'field_colour', name:'COLOR', colour:'#ffffff'}, num('SECS')]);
def('fx_speed', 'effects', 'set game speed to %1 %', [num('V')], {tip:'50 = slow motion, 200 = double speed'});
def('fx_hudtext', 'effects', 'show text %1 at %2 of screen', [anyv('TEXT'), dd('POS',[['top','top'],['bottom','bottom']])]);
def('fx_hudclear', 'effects', 'clear screen text', []);
def('fx_sky', 'effects', 'set sky to %1', [dd('S',[['day/night (by time)','auto'],['space','space'],['flat color','custom']])]);
def('fx_time', 'effects', 'set time of day to %1', [num('V')], {tip:'0–24 hours: 6 sunrise, 12 noon, 18 sunset'});
def('physics_collide', 'physics', 'turn collisions %1', [dd('ON',[['on','on'],['off','off']])], {tip:'Off = ghost: still touches things, but passes through them'});
def('physics_explode', 'physics', 'explode with power %1 radius %2', [num('P'), num('R')], {tip:'Pushes everything nearby away'});
def('sensing_infront', 'sensing', 'object in front within %1', [num('D')], {kind:'rep', out:'String', tip:'Name of the first object ahead, or nothing'});
def('sensing_hitfront', 'sensing', 'something in front within %1 ?', [num('D')], {kind:'bool'});
def('sensing_height', 'sensing', 'height above ground', [], {kind:'rep', out:'Number'});
def('sensing_groundat', 'sensing', 'ground height at x: %1 z: %2', [num('X'), num('Z')], {kind:'rep', out:'Number', tip:'Works on terrain too — handy for spawning things on hills'});
def('control_spawn', 'control', 'spawn %1 at x: %2 y: %3 z: %4', [dd('TARGET', objOpts([['myself','__self__']])), num('X'), num('Y'), num('Z')], {tip:'Creates a clone and puts it there'});
def('custom_define', 'custom', 'define %1', [txt('NAME','my block')], {kind:'hat'});
def('custom_call', 'custom', 'run %1', [dd('NAME', procOpts)]);
def('custom_callarg', 'custom', 'run %1 with %2', [dd('NAME', procOpts), anyv('V')]);
def('custom_arg', 'custom', 'argument', [], {kind:'rep'});
def('data_list', 'variables', '%1', [dd('LIST', listOpts)], {kind:'rep', out:'String'});
def('data_listadd', 'variables', 'add %1 to %2', [anyv('V'), dd('LIST', listOpts)]);
def('data_listdelete', 'variables', 'delete %1 of %2', [anyv('I'), dd('LIST', listOpts)]);
def('data_listdeleteall', 'variables', 'delete all of %1', [dd('LIST', listOpts)]);
def('data_listinsert', 'variables', 'insert %1 at %2 of %3', [anyv('V'), anyv('I'), dd('LIST', listOpts)]);
def('data_listreplace', 'variables', 'replace item %1 of %2 with %3', [anyv('I'), dd('LIST', listOpts), anyv('V')]);
def('data_listitem', 'variables', 'item %1 of %2', [anyv('I'), dd('LIST', listOpts)], {kind:'rep'});
def('data_listindex', 'variables', 'item # of %1 in %2', [anyv('V'), dd('LIST', listOpts)], {kind:'rep', out:'Number'});
def('data_listlength', 'variables', 'length of %1', [dd('LIST', listOpts)], {kind:'rep', out:'Number'});
def('data_listcontains', 'variables', '%1 contains %2 ?', [dd('LIST', listOpts), anyv('V')], {kind:'bool'});
def('data_listshow', 'variables', 'show list %1', [dd('LIST', listOpts)]);
def('data_listhide', 'variables', 'hide list %1', [dd('LIST', listOpts)]);
def('sound_stopall', 'sound', 'stop all sounds', []);
def('ui_whenclicked', 'ui', 'when UI button %1 clicked', [dd('NAME', uiOpts)], {kind:'hat'});
def('ui_settext', 'ui', 'set UI %1 text to %2', [dd('NAME', uiOpts), anyv('V')]);
def('ui_show', 'ui', '%1 UI %2', [dd('ON',[['show','show'],['hide','hide']]), dd('NAME', uiOpts)]);
def('ui_setvalue', 'ui', 'set UI bar %1 to %2 %', [dd('NAME', uiOpts), num('V')]);
def('ui_setcolor', 'ui', 'set UI %1 color to %2', [dd('NAME', uiOpts), {type:'field_colour', name:'COLOR', colour:'#ffffff'}]);
def('ui_setpos', 'ui', 'move UI %1 to x: %2 % y: %3 %', [dd('NAME', uiOpts), num('X'), num('Y')]);
def('ui_pressed', 'ui', 'UI button %1 pressed?', [dd('NAME', uiOpts)], {kind:'bool'});
def('ui_text', 'ui', 'text of UI %1', [dd('NAME', uiOpts)], {kind:'rep', out:'String'});
Blockly.defineBlocksWithJsonArray(defs);
// dynamic sound list (built-ins + uploaded files)
Blockly.Blocks['sound_play'].init = function(){ this.jsonInit({ type:'sound_play', message0:'play sound %1', args0:[{ type:'field_dropdown', name:'NAME', options: soundOpts }], previousStatement:null, nextStatement:null, style:'sound_blocks', inputsInline:true }); };
Blockly.Blocks['motion_gotoobj'].init = function(){ this.jsonInit({ type:'motion_gotoobj', message0:'go to %1', args0:[{ type:'field_dropdown', name:'TARGET', options: objOpts([['random position','__random__'],['mouse position','__mouse__']]) }], previousStatement:null, nextStatement:null, style:'motion_blocks', inputsInline:true }); };
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
    b('motion_towards',{V:0.1}), b('motion_turntowards',{V:3}), b('motion_lookatxz',{X:0,Z:0}), sep(),
    b('motion_setrot',{X:0,Y:0,Z:0}), b('motion_tilt',{DEG:15}), sep(),
    b('motion_xpos'), b('motion_ypos'), b('motion_zpos'), b('motion_dir')
  ]),
  cat('Looks', C.looks, [
    b('looks_sayfor',{TEXT:'Hello!',SECS:2}), b('looks_say',{TEXT:'Hello!'}), b('looks_bigtext',{TEXT:'You win!',SECS:2}), sep(),
    b('looks_show'), b('looks_hide'), sep(),
    b('looks_setcolor'), b('looks_setcolorval',{COLOR:'red'}), b('looks_texture'), b('looks_material'), b('looks_setopacity',{V:50}), sep(),
    b('looks_settext',{TEXT:'Hello!'}), b('looks_light',{V:'#ff8800'}), b('looks_lighton'), sep(),
    b('looks_setsize',{SIZE:100}), b('looks_changesize',{DELTA:10}), b('looks_size'), sep(),
    b('looks_anim'), b('looks_animonce'), b('looks_animstop'), b('looks_animspeed',{V:100})
  ]),
  cat('Sound', C.sound, [ b('sound_play'), b('sound_note',{NOTE:60,BEATS:0.5}), b('sound_volume',{V:100}), b('sound_stopall'), { kind:'button', text:'Add a sound file', callbackKey:'ADD_SOUND' } ]),
  cat('Events', C.events, [
    b('event_whenflag'), b('event_whenkey'), b('event_whenclicked'), b('event_whentouch'), sep(),
    b('event_whenbroadcast'), b('event_broadcast',{MSG:'message1'}), b('event_broadcastwait',{MSG:'message1'}), sep(),
    b('event_whentimer',{V:10})
  ]),
  cat('Control', C.control, [
    b('control_wait',{SECS:1}), b('control_repeat',{TIMES:10}), b('control_forever'), sep(),
    b('control_if'), b('control_ifelse'), b('control_waituntil'), b('control_repeatuntil'), sep(),
    b('control_stop'), sep(),
    b('control_startclone'), b('control_clone'), b('control_spawn',{X:0,Y:3,Z:0}), b('control_deleteclone'), b('control_deleteobj')
  ]),
  cat('Physics', C.physics, [
    b('physics_enable'), b('physics_type'), sep(),
    b('physics_pushdir',{V:5}), b('physics_jump',{V:6}), b('physics_push',{X:0,Y:5,Z:0}), sep(),
    b('physics_setvel',{X:0,Y:0,Z:0}), b('physics_setvelaxis',{V:0}), b('physics_stop'), sep(),
    b('physics_mass',{V:1}), b('physics_bounce',{V:0.5}), b('physics_friction',{V:0.4}), b('physics_gravity',{V:9.8}), sep(),
    b('physics_collide'), b('physics_explode',{P:8,R:6}), sep(),
    b('physics_vel'), b('physics_onground')
  ]),
  cat('Effects', C.effects, [
    b('fx_particles',{N:40,S:4}), b('fx_particlesat',{N:40,X:0,Y:2,Z:0,COLOR:'#ffcc00'}), b('fx_flash',{SECS:0.3}), sep(),
    b('fx_hudtext',{TEXT:'Level 1'}), b('fx_hudclear'), sep(),
    b('fx_speed',{V:100}), b('fx_sky'), b('fx_time',{V:18})
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
    b('sensing_infront',{D:2}), b('sensing_hitfront',{D:2}), b('sensing_height'), b('sensing_groundat',{X:0,Z:0}), sep(),
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
  cat('Variables', C.variables, [], { custom:'VARIABLE' }),
  cat('My Blocks', C.custom, [ b('custom_define'), b('custom_call'), b('custom_callarg',{V:10}), b('custom_arg') ]),
  cat('UI', C.ui, [ { kind:'label', text:'Design the screen in the UI tab' }, b('ui_whenclicked'), b('ui_pressed'), sep(), b('ui_settext',{V:'Score: 0'}), b('ui_setvalue',{V:50}), b('ui_setcolor'), b('ui_setpos',{X:50,Y:10}), b('ui_show'), b('ui_text') ])
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
  contents.push({ kind:'sep', gap:28 });
  contents.push({ kind:'button', text:'Make a List', callbackKey:'CREATE_LIST' });
  const lists = window.BW_hooks.listNames();
  if (lists.length){
    const L = { LIST: lists[0] }, sh = v => ({ shadow:{ type: typeof v === 'number' ? 'math_number' : 'text', fields: typeof v === 'number' ? { NUM:v } : { TEXT:v } } });
    for (const l of lists) contents.push({ kind:'block', type:'data_list', fields:{ LIST:l } });
    contents.push({ kind:'sep', gap:24 });
    contents.push({ kind:'block', type:'data_listadd', fields:L, inputs:{ V:sh('thing') } });
    contents.push({ kind:'block', type:'data_listdelete', fields:L, inputs:{ I:sh(1) } });
    contents.push({ kind:'block', type:'data_listdeleteall', fields:L });
    contents.push({ kind:'block', type:'data_listinsert', fields:L, inputs:{ V:sh('thing'), I:sh(1) } });
    contents.push({ kind:'block', type:'data_listreplace', fields:L, inputs:{ I:sh(1), V:sh('thing') } });
    contents.push({ kind:'sep', gap:24 });
    contents.push({ kind:'block', type:'data_listitem', fields:L, inputs:{ I:sh(1) } });
    contents.push({ kind:'block', type:'data_listindex', fields:L, inputs:{ V:sh('thing') } });
    contents.push({ kind:'block', type:'data_listlength', fields:L });
    contents.push({ kind:'block', type:'data_listcontains', fields:L, inputs:{ V:sh('thing') } });
    contents.push({ kind:'sep', gap:24 });
    contents.push({ kind:'block', type:'data_listshow', fields:L });
    contents.push({ kind:'block', type:'data_listhide', fields:L });
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
  event_whenbroadcast: b=>({hat:'broadcast', msg:String(b.getFieldValue('MSG')).toLowerCase()}), control_startclone: b=>({hat:'clone'}),
  event_whentimer: b=>({hat:'timer', value: Number(G.valueToCode(b, 'V', NONE)) || 0}), custom_define: b=>({hat:'define', name:String(b.getFieldValue('NAME')).trim()}),
  ui_whenclicked: b=>({hat:'uiclick', name:b.getFieldValue('NAME')}) };
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

// v2 generators
S('motion_towards', b => 'self.moveTowards(' + field(b,'TARGET') + ',' + n(b,'V') + ');\n');
S('motion_turntowards', b => 'self.turnTowards(' + field(b,'TARGET') + ',' + n(b,'V') + ');\n');
S('motion_lookatxz', b => 'self.lookAtPoint(' + n(b,'X') + ',' + n(b,'Z') + ');\n');
S('looks_texture', b => 'self.setTexture(' + field(b,'T') + ');\n');
S('looks_settext', b => 'self.setText(' + val(b,'TEXT','""') + ');\n');
S('looks_light', b => 'self.setLight(' + field(b,'W') + ',' + val(b,'V','0') + ');\n');
S('looks_lighton', b => 'self.setLight("on",' + (b.getFieldValue('ON') === 'on') + ');\n');
S('fx_particles', b => 'R.fx(self,' + field(b,'COLOR') + ',' + n(b,'N') + ',' + n(b,'S') + ');\n');
S('fx_particlesat', b => 'R.fxAt(' + n(b,'X') + ',' + n(b,'Y') + ',' + n(b,'Z') + ',' + val(b,'COLOR','"#fff"') + ',' + n(b,'N') + ',4);\n');
S('fx_flash', b => 'yield* R.flash(' + field(b,'COLOR') + ',' + n(b,'SECS') + ');\n');
S('fx_speed', b => 'R.setSpeed(' + n(b,'V') + ');\n');
S('fx_hudtext', b => 'R.hudText(' + field(b,'POS') + ',' + val(b,'TEXT','""') + ');\n');
S('fx_hudclear', b => 'R.hudText("top","");R.hudText("bottom","");\n');
S('fx_sky', b => 'R.setSky(' + field(b,'S') + ');\n');
S('fx_time', b => 'R.setSky(null,' + n(b,'V') + ');\n');
S('physics_collide', b => 'self.setCollide(' + (b.getFieldValue('ON') === 'on') + ');\n');
S('physics_explode', b => 'self.explode(' + n(b,'P') + ',' + n(b,'R') + ');\n');
REP('sensing_infront', b => '((self.rayHit(' + n(b,'D') + ')||{name:""}).name)');
G.forBlock['sensing_hitfront'] = b => ['!!self.rayHit(' + n(b,'D') + ')', ATOMIC];
REP('sensing_height', b => 'self.heightAboveGround()');
REP('sensing_groundat', b => 'R.e.groundHeightAt(' + n(b,'X') + ',' + n(b,'Z') + ')');
S('control_spawn', b => 'R.spawn(self,' + field(b,'TARGET') + ',' + n(b,'X') + ',' + n(b,'Y') + ',' + n(b,'Z') + ');\n');
S('custom_call', b => 'yield* R.callProc(self,' + field(b,'NAME') + ');\n');
S('custom_callarg', b => 'yield* R.callProc(self,' + field(b,'NAME') + ',' + val(b,'V','0') + ');\n');
REP('custom_arg', b => '(_arg===undefined?"":_arg)');
REP('data_list', b => 'L.join(' + field(b,'LIST') + ')');
S('data_listadd', b => 'L.add(' + field(b,'LIST') + ',' + val(b,'V','""') + ');\n');
S('data_listdelete', b => 'L.del(' + field(b,'LIST') + ',' + val(b,'I','1') + ');\n');
S('data_listdeleteall', b => 'L.del(' + field(b,'LIST') + ',"all");\n');
S('data_listinsert', b => 'L.insert(' + field(b,'LIST') + ',' + val(b,'I','1') + ',' + val(b,'V','""') + ');\n');
S('data_listreplace', b => 'L.replace(' + field(b,'LIST') + ',' + val(b,'I','1') + ',' + val(b,'V','""') + ');\n');
REP('data_listitem', b => 'L.item(' + field(b,'LIST') + ',' + val(b,'I','1') + ')');
REP('data_listindex', b => 'L.indexOf(' + field(b,'LIST') + ',' + val(b,'V','""') + ')');
REP('data_listlength', b => 'L.length(' + field(b,'LIST') + ')');
G.forBlock['data_listcontains'] = b => ['L.contains(' + field(b,'LIST') + ',' + val(b,'V','""') + ')', ATOMIC];
S('data_listshow', b => 'L.show(' + field(b,'LIST') + ',true);\n');
S('data_listhide', b => 'L.show(' + field(b,'LIST') + ',false);\n');
S('sound_stopall', b => 'R.stopSounds();\n');
S('ui_settext', b => 'R.ui.set(' + field(b,'NAME') + ',"text",R.s(' + val(b,'V','""') + '));\n');
S('ui_show', b => 'R.ui.set(' + field(b,'NAME') + ',"visible",' + (b.getFieldValue('ON') === 'show') + ');\n');
S('ui_setvalue', b => 'R.ui.set(' + field(b,'NAME') + ',"value",' + n(b,'V') + ');\n');
S('ui_setcolor', b => 'R.ui.set(' + field(b,'NAME') + ',"color",' + field(b,'COLOR') + ');\n');
S('ui_setpos', b => 'R.ui.set(' + field(b,'NAME') + ',"x",' + n(b,'X') + ');R.ui.set(' + field(b,'NAME') + ',"y",' + n(b,'Y') + ');\n');
G.forBlock['ui_pressed'] = b => ['R.ui.pressed(' + field(b,'NAME') + ')', ATOMIC];
REP('ui_text', b => 'R.ui.get(' + field(b,'NAME') + ',"text")');

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
