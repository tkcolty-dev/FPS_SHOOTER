/* ============================================================
   BlockForge — Block definitions, Scratch-style theme & toolbox
   Built on Blockly (Zelos renderer = Scratch-look rounded blocks)
   ============================================================ */

const BF_COLORS = {
  motion:'#4C97FF', looks:'#9966FF', sound:'#CF63CF', event:'#FFBF00',
  control:'#FFAB19', sensing:'#5CB1D6', operator:'#59C059', variable:'#FF8C1A', custom:'#FF6680'
};

/* ---------- Theme (dark workspace, Scratch block colors) ---------- */
const BF_THEME = Blockly.Theme.defineTheme('blockforge', {
  base: Blockly.Themes.Classic,
  fontStyle: { family: 'Inter, system-ui, sans-serif', weight: '600', size: 12 },
  componentStyles: {
    workspaceBackgroundColour: '#171c2e',
    toolboxBackgroundColour: '#12172a',
    toolboxForegroundColour: '#c7d0ea',
    flyoutBackgroundColour: '#12172a',
    flyoutForegroundColour: '#c7d0ea',
    flyoutOpacity: 0.97,
    scrollbarColour: '#39426a',
    insertionMarkerColour: '#ffffff',
    insertionMarkerOpacity: 0.4,
    cursorColour: '#ffffff',
    gridColour: '#222a44'
  }
});

/* ---------- Dropdown option helpers ---------- */
const KEY_OPTIONS = [
  ['space','space'],['up arrow','up arrow'],['down arrow','down arrow'],
  ['left arrow','left arrow'],['right arrow','right arrow'],['any','any'],
  ['a','a'],['b','b'],['c','c'],['d','d'],['e','e'],['f','f'],['g','g'],['h','h'],
  ['i','i'],['j','j'],['k','k'],['l','l'],['m','m'],['n','n'],['o','o'],['p','p'],
  ['q','q'],['r','r'],['s','s'],['t','t'],['u','u'],['v','v'],['w','w'],['x','x'],
  ['y','y'],['z','z'],['0','0'],['1','1'],['2','2'],['3','3'],['4','4'],['5','5'],
  ['6','6'],['7','7'],['8','8'],['9','9']
];
// dynamic: sprites in the project (filled by app.js)
window.BF_targetOptions = function(){
  const base = [['edge','edge'],['mouse-pointer','mouse-pointer']];
  const sprites = (window.BF && window.BF.spriteNames) ? window.BF.spriteNames() : [];
  return base.concat(sprites.map(n => [n, n]));
};

Blockly.defineBlocksWithJsonArray([
  /* ===================== EVENTS ===================== */
  { type:'event_whenflag', message0:'when %1 clicked', args0:[{type:'field_image',
      src:'data:image/svg+xml;utf8,'+encodeURIComponent('<svg xmlns="http://www.w3.org/2000/svg" width="22" height="22" viewBox="0 0 24 24"><path d="M5 3v18" stroke="%2344a047" stroke-width="2" fill="none"/><path d="M6 4h11l-3 4 3 4H6z" fill="%2344a047"/></svg>'),
      width:22, height:22, alt:'flag'}],
    nextStatement:null, colour:BF_COLORS.event, tooltip:'Run when the green flag is clicked' },
  { type:'event_whenkey', message0:'when %1 key pressed',
    args0:[{type:'field_dropdown', name:'KEY', options:KEY_OPTIONS}],
    nextStatement:null, colour:BF_COLORS.event },
  { type:'event_whenclicked', message0:'when this sprite clicked',
    nextStatement:null, colour:BF_COLORS.event },
  { type:'event_broadcast', message0:'broadcast %1',
    args0:[{type:'field_input', name:'MSG', text:'message1'}],
    previousStatement:null, nextStatement:null, colour:BF_COLORS.event },
  { type:'event_whenbroadcast', message0:'when I receive %1',
    args0:[{type:'field_input', name:'MSG', text:'message1'}],
    nextStatement:null, colour:BF_COLORS.event },

  /* ===================== MOTION ===================== */
  { type:'motion_move', message0:'move %1 steps',
    args0:[{type:'input_value', name:'STEPS', check:'Number'}],
    previousStatement:null, nextStatement:null, colour:BF_COLORS.motion, inputsInline:true },
  { type:'motion_turnright', message0:'turn ↻ %1 degrees',
    args0:[{type:'input_value', name:'DEG', check:'Number'}],
    previousStatement:null, nextStatement:null, colour:BF_COLORS.motion, inputsInline:true },
  { type:'motion_turnleft', message0:'turn ↺ %1 degrees',
    args0:[{type:'input_value', name:'DEG', check:'Number'}],
    previousStatement:null, nextStatement:null, colour:BF_COLORS.motion, inputsInline:true },
  { type:'motion_pointindirection', message0:'point in direction %1',
    args0:[{type:'input_value', name:'DIR', check:'Number'}],
    previousStatement:null, nextStatement:null, colour:BF_COLORS.motion, inputsInline:true },
  { type:'motion_goto', message0:'go to x: %1 y: %2',
    args0:[{type:'input_value', name:'X', check:'Number'},{type:'input_value', name:'Y', check:'Number'}],
    previousStatement:null, nextStatement:null, colour:BF_COLORS.motion, inputsInline:true },
  { type:'motion_glide', message0:'glide %1 secs to x: %2 y: %3',
    args0:[{type:'input_value', name:'SECS', check:'Number'},{type:'input_value', name:'X', check:'Number'},{type:'input_value', name:'Y', check:'Number'}],
    previousStatement:null, nextStatement:null, colour:BF_COLORS.motion, inputsInline:true },
  { type:'motion_changexby', message0:'change x by %1',
    args0:[{type:'input_value', name:'DX', check:'Number'}],
    previousStatement:null, nextStatement:null, colour:BF_COLORS.motion, inputsInline:true },
  { type:'motion_setx', message0:'set x to %1',
    args0:[{type:'input_value', name:'X', check:'Number'}],
    previousStatement:null, nextStatement:null, colour:BF_COLORS.motion, inputsInline:true },
  { type:'motion_changeyby', message0:'change y by %1',
    args0:[{type:'input_value', name:'DY', check:'Number'}],
    previousStatement:null, nextStatement:null, colour:BF_COLORS.motion, inputsInline:true },
  { type:'motion_sety', message0:'set y to %1',
    args0:[{type:'input_value', name:'Y', check:'Number'}],
    previousStatement:null, nextStatement:null, colour:BF_COLORS.motion, inputsInline:true },
  { type:'motion_ifonedge', message0:'if on edge, bounce',
    previousStatement:null, nextStatement:null, colour:BF_COLORS.motion },
  { type:'motion_xposition', message0:'x position', output:'Number', colour:BF_COLORS.motion },
  { type:'motion_yposition', message0:'y position', output:'Number', colour:BF_COLORS.motion },
  { type:'motion_directionrep', message0:'direction', output:'Number', colour:BF_COLORS.motion },

  /* ===================== LOOKS ===================== */
  { type:'looks_sayforsecs', message0:'say %1 for %2 seconds',
    args0:[{type:'input_value', name:'MSG', check:null},{type:'input_value', name:'SECS', check:'Number'}],
    previousStatement:null, nextStatement:null, colour:BF_COLORS.looks, inputsInline:true },
  { type:'looks_say', message0:'say %1',
    args0:[{type:'input_value', name:'MSG'}],
    previousStatement:null, nextStatement:null, colour:BF_COLORS.looks, inputsInline:true },
  { type:'looks_think', message0:'think %1',
    args0:[{type:'input_value', name:'MSG'}],
    previousStatement:null, nextStatement:null, colour:BF_COLORS.looks, inputsInline:true },
  { type:'looks_switchcostume', message0:'switch costume to %1',
    args0:[{type:'field_input', name:'COSTUME', text:'costume1'}],
    previousStatement:null, nextStatement:null, colour:BF_COLORS.looks },
  { type:'looks_nextcostume', message0:'next costume',
    previousStatement:null, nextStatement:null, colour:BF_COLORS.looks },
  { type:'looks_changesize', message0:'change size by %1',
    args0:[{type:'input_value', name:'DSIZE', check:'Number'}],
    previousStatement:null, nextStatement:null, colour:BF_COLORS.looks, inputsInline:true },
  { type:'looks_setsize', message0:'set size to %1 %',
    args0:[{type:'input_value', name:'SIZE', check:'Number'}],
    previousStatement:null, nextStatement:null, colour:BF_COLORS.looks, inputsInline:true },
  { type:'looks_seteffect', message0:'set %1 effect to %2',
    args0:[{type:'field_dropdown', name:'EFFECT', options:[['ghost','ghost'],['brightness','brightness'],['color','color']]},
           {type:'input_value', name:'VAL', check:'Number'}],
    previousStatement:null, nextStatement:null, colour:BF_COLORS.looks, inputsInline:true },
  { type:'looks_changeeffect', message0:'change %1 effect by %2',
    args0:[{type:'field_dropdown', name:'EFFECT', options:[['ghost','ghost'],['brightness','brightness'],['color','color']]},
           {type:'input_value', name:'VAL', check:'Number'}],
    previousStatement:null, nextStatement:null, colour:BF_COLORS.looks, inputsInline:true },
  { type:'looks_cleareffects', message0:'clear graphic effects',
    previousStatement:null, nextStatement:null, colour:BF_COLORS.looks },
  { type:'looks_show', message0:'show', previousStatement:null, nextStatement:null, colour:BF_COLORS.looks },
  { type:'looks_hide', message0:'hide', previousStatement:null, nextStatement:null, colour:BF_COLORS.looks },
  { type:'looks_gotofront', message0:'go to front layer',
    previousStatement:null, nextStatement:null, colour:BF_COLORS.looks },
  { type:'looks_size', message0:'size', output:'Number', colour:BF_COLORS.looks },

  /* ===================== CONTROL ===================== */
  { type:'control_wait', message0:'wait %1 seconds',
    args0:[{type:'input_value', name:'SECS', check:'Number'}],
    previousStatement:null, nextStatement:null, colour:BF_COLORS.control, inputsInline:true },
  { type:'control_repeat', message0:'repeat %1 %2 %3',
    args0:[{type:'input_value', name:'TIMES', check:'Number'},
           {type:'input_dummy'},
           {type:'input_statement', name:'DO'}],
    previousStatement:null, nextStatement:null, colour:BF_COLORS.control, inputsInline:true },
  { type:'control_forever', message0:'forever %1 %2',
    args0:[{type:'input_dummy'},{type:'input_statement', name:'DO'}],
    previousStatement:null, colour:BF_COLORS.control },
  { type:'control_if', message0:'if %1 then %2 %3',
    args0:[{type:'input_value', name:'COND', check:'Boolean'},{type:'input_dummy'},{type:'input_statement', name:'DO'}],
    previousStatement:null, nextStatement:null, colour:BF_COLORS.control },
  { type:'control_if_else', message0:'if %1 then %2 %3 else %4',
    args0:[{type:'input_value', name:'COND', check:'Boolean'},{type:'input_dummy'},
           {type:'input_statement', name:'DO'},{type:'input_statement', name:'ELSE'}],
    previousStatement:null, nextStatement:null, colour:BF_COLORS.control },
  { type:'control_repeat_until', message0:'repeat until %1 %2 %3',
    args0:[{type:'input_value', name:'COND', check:'Boolean'},{type:'input_dummy'},{type:'input_statement', name:'DO'}],
    previousStatement:null, nextStatement:null, colour:BF_COLORS.control },
  { type:'control_wait_until', message0:'wait until %1',
    args0:[{type:'input_value', name:'COND', check:'Boolean'}],
    previousStatement:null, nextStatement:null, colour:BF_COLORS.control },
  { type:'control_stop', message0:'stop %1',
    args0:[{type:'field_dropdown', name:'WHAT', options:[['all','all'],['this script','this script'],['other scripts in sprite','other']]}],
    previousStatement:null, colour:BF_COLORS.control },

  /* ===================== SENSING ===================== */
  { type:'sensing_touching', message0:'touching %1 ?',
    args0:[{type:'field_dropdown', name:'TARGET', options:window.BF_targetOptions}],
    output:'Boolean', colour:BF_COLORS.sensing },
  { type:'sensing_keypressed', message0:'key %1 pressed?',
    args0:[{type:'field_dropdown', name:'KEY', options:KEY_OPTIONS}],
    output:'Boolean', colour:BF_COLORS.sensing },
  { type:'sensing_mousedown', message0:'mouse down?', output:'Boolean', colour:BF_COLORS.sensing },
  { type:'sensing_mousex', message0:'mouse x', output:'Number', colour:BF_COLORS.sensing },
  { type:'sensing_mousey', message0:'mouse y', output:'Number', colour:BF_COLORS.sensing },
  { type:'sensing_distanceto', message0:'distance to %1',
    args0:[{type:'field_dropdown', name:'TARGET', options:window.BF_targetOptions}],
    output:'Number', colour:BF_COLORS.sensing },
  { type:'sensing_timer', message0:'timer', output:'Number', colour:BF_COLORS.sensing },
  { type:'sensing_resettimer', message0:'reset timer',
    previousStatement:null, nextStatement:null, colour:BF_COLORS.sensing },
  { type:'sensing_askandwait', message0:'ask %1 and wait',
    args0:[{type:'input_value', name:'Q'}],
    previousStatement:null, nextStatement:null, colour:BF_COLORS.sensing },
  { type:'sensing_answer', message0:'answer', output:'String', colour:BF_COLORS.sensing },

  /* ===================== OPERATORS ===================== */
  { type:'operator_add', message0:'%1 + %2',
    args0:[{type:'input_value', name:'A', check:'Number'},{type:'input_value', name:'B', check:'Number'}],
    output:'Number', colour:BF_COLORS.operator, inputsInline:true },
  { type:'operator_subtract', message0:'%1 − %2',
    args0:[{type:'input_value', name:'A', check:'Number'},{type:'input_value', name:'B', check:'Number'}],
    output:'Number', colour:BF_COLORS.operator, inputsInline:true },
  { type:'operator_multiply', message0:'%1 × %2',
    args0:[{type:'input_value', name:'A', check:'Number'},{type:'input_value', name:'B', check:'Number'}],
    output:'Number', colour:BF_COLORS.operator, inputsInline:true },
  { type:'operator_divide', message0:'%1 ÷ %2',
    args0:[{type:'input_value', name:'A', check:'Number'},{type:'input_value', name:'B', check:'Number'}],
    output:'Number', colour:BF_COLORS.operator, inputsInline:true },
  { type:'operator_random', message0:'pick random %1 to %2',
    args0:[{type:'input_value', name:'FROM', check:'Number'},{type:'input_value', name:'TO', check:'Number'}],
    output:'Number', colour:BF_COLORS.operator, inputsInline:true },
  { type:'operator_lt', message0:'%1 < %2',
    args0:[{type:'input_value', name:'A'},{type:'input_value', name:'B'}],
    output:'Boolean', colour:BF_COLORS.operator, inputsInline:true },
  { type:'operator_equals', message0:'%1 = %2',
    args0:[{type:'input_value', name:'A'},{type:'input_value', name:'B'}],
    output:'Boolean', colour:BF_COLORS.operator, inputsInline:true },
  { type:'operator_gt', message0:'%1 > %2',
    args0:[{type:'input_value', name:'A'},{type:'input_value', name:'B'}],
    output:'Boolean', colour:BF_COLORS.operator, inputsInline:true },
  { type:'operator_and', message0:'%1 and %2',
    args0:[{type:'input_value', name:'A', check:'Boolean'},{type:'input_value', name:'B', check:'Boolean'}],
    output:'Boolean', colour:BF_COLORS.operator, inputsInline:true },
  { type:'operator_or', message0:'%1 or %2',
    args0:[{type:'input_value', name:'A', check:'Boolean'},{type:'input_value', name:'B', check:'Boolean'}],
    output:'Boolean', colour:BF_COLORS.operator, inputsInline:true },
  { type:'operator_not', message0:'not %1',
    args0:[{type:'input_value', name:'A', check:'Boolean'}],
    output:'Boolean', colour:BF_COLORS.operator, inputsInline:true },
  { type:'operator_join', message0:'join %1 %2',
    args0:[{type:'input_value', name:'A'},{type:'input_value', name:'B'}],
    output:'String', colour:BF_COLORS.operator, inputsInline:true },
  { type:'operator_mod', message0:'%1 mod %2',
    args0:[{type:'input_value', name:'A', check:'Number'},{type:'input_value', name:'B', check:'Number'}],
    output:'Number', colour:BF_COLORS.operator, inputsInline:true },
  { type:'operator_round', message0:'round %1',
    args0:[{type:'input_value', name:'A', check:'Number'}],
    output:'Number', colour:BF_COLORS.operator, inputsInline:true },

  /* ===================== VARIABLES ===================== */
  { type:'data_setvariableto', message0:'set %1 to %2',
    args0:[{type:'field_variable', name:'VAR', variable:'score'},{type:'input_value', name:'VALUE'}],
    previousStatement:null, nextStatement:null, colour:BF_COLORS.variable, inputsInline:true },
  { type:'data_changevariableby', message0:'change %1 by %2',
    args0:[{type:'field_variable', name:'VAR', variable:'score'},{type:'input_value', name:'VALUE', check:'Number'}],
    previousStatement:null, nextStatement:null, colour:BF_COLORS.variable, inputsInline:true },
  { type:'data_variable', message0:'%1',
    args0:[{type:'field_variable', name:'VAR', variable:'score'}],
    output:null, colour:BF_COLORS.variable },
  { type:'data_showvariable', message0:'show variable %1',
    args0:[{type:'field_variable', name:'VAR', variable:'score'}],
    previousStatement:null, nextStatement:null, colour:BF_COLORS.variable },
  { type:'data_hidevariable', message0:'hide variable %1',
    args0:[{type:'field_variable', name:'VAR', variable:'score'}],
    previousStatement:null, nextStatement:null, colour:BF_COLORS.variable },

  /* literal helpers (shadow blocks for quick numbers/text) */
  { type:'math_number_bf', message0:'%1',
    args0:[{type:'field_number', name:'NUM', value:0}], output:'Number', colour:BF_COLORS.operator },
  { type:'text_bf', message0:'%1',
    args0:[{type:'field_input', name:'TEXT', text:''}], output:'String', colour:BF_COLORS.operator }
]);

/* ---------- Toolbox (category flyout) ---------- */
const num  = (v)=>({shadow:{type:'math_number_bf', fields:{NUM:v}}});
const txt  = (t)=>({shadow:{type:'text_bf', fields:{TEXT:t}}});

const BF_TOOLBOX = {
  kind:'categoryToolbox',
  contents:[
    { kind:'category', name:'Motion', colour:BF_COLORS.motion, contents:[
      { kind:'block', type:'motion_move', inputs:{STEPS:num(10)} },
      { kind:'block', type:'motion_turnright', inputs:{DEG:num(15)} },
      { kind:'block', type:'motion_turnleft', inputs:{DEG:num(15)} },
      { kind:'block', type:'motion_pointindirection', inputs:{DIR:num(90)} },
      { kind:'block', type:'motion_goto', inputs:{X:num(0),Y:num(0)} },
      { kind:'block', type:'motion_glide', inputs:{SECS:num(1),X:num(0),Y:num(0)} },
      { kind:'block', type:'motion_changexby', inputs:{DX:num(10)} },
      { kind:'block', type:'motion_setx', inputs:{X:num(0)} },
      { kind:'block', type:'motion_changeyby', inputs:{DY:num(10)} },
      { kind:'block', type:'motion_sety', inputs:{Y:num(0)} },
      { kind:'block', type:'motion_ifonedge' },
      { kind:'block', type:'motion_xposition' },
      { kind:'block', type:'motion_yposition' },
      { kind:'block', type:'motion_directionrep' },
    ]},
    { kind:'category', name:'Looks', colour:BF_COLORS.looks, contents:[
      { kind:'block', type:'looks_sayforsecs', inputs:{MSG:txt('Hello!'),SECS:num(2)} },
      { kind:'block', type:'looks_say', inputs:{MSG:txt('Hello!')} },
      { kind:'block', type:'looks_think', inputs:{MSG:txt('Hmm...')} },
      { kind:'block', type:'looks_switchcostume' },
      { kind:'block', type:'looks_nextcostume' },
      { kind:'block', type:'looks_changesize', inputs:{DSIZE:num(10)} },
      { kind:'block', type:'looks_setsize', inputs:{SIZE:num(100)} },
      { kind:'block', type:'looks_seteffect', inputs:{VAL:num(0)} },
      { kind:'block', type:'looks_changeeffect', inputs:{VAL:num(25)} },
      { kind:'block', type:'looks_cleareffects' },
      { kind:'block', type:'looks_show' },
      { kind:'block', type:'looks_hide' },
      { kind:'block', type:'looks_gotofront' },
      { kind:'block', type:'looks_size' },
    ]},
    { kind:'category', name:'Events', colour:BF_COLORS.event, contents:[
      { kind:'block', type:'event_whenflag' },
      { kind:'block', type:'event_whenkey' },
      { kind:'block', type:'event_whenclicked' },
      { kind:'block', type:'event_broadcast' },
      { kind:'block', type:'event_whenbroadcast' },
    ]},
    { kind:'category', name:'Control', colour:BF_COLORS.control, contents:[
      { kind:'block', type:'control_wait', inputs:{SECS:num(1)} },
      { kind:'block', type:'control_repeat', inputs:{TIMES:num(10)} },
      { kind:'block', type:'control_forever' },
      { kind:'block', type:'control_if' },
      { kind:'block', type:'control_if_else' },
      { kind:'block', type:'control_repeat_until' },
      { kind:'block', type:'control_wait_until' },
      { kind:'block', type:'control_stop' },
    ]},
    { kind:'category', name:'Sensing', colour:BF_COLORS.sensing, contents:[
      { kind:'block', type:'sensing_touching' },
      { kind:'block', type:'sensing_keypressed' },
      { kind:'block', type:'sensing_mousedown' },
      { kind:'block', type:'sensing_mousex' },
      { kind:'block', type:'sensing_mousey' },
      { kind:'block', type:'sensing_distanceto' },
      { kind:'block', type:'sensing_timer' },
      { kind:'block', type:'sensing_resettimer' },
      { kind:'block', type:'sensing_askandwait', inputs:{Q:txt("What's your name?")} },
      { kind:'block', type:'sensing_answer' },
    ]},
    { kind:'category', name:'Operators', colour:BF_COLORS.operator, contents:[
      { kind:'block', type:'operator_add', inputs:{A:num(''),B:num('')} },
      { kind:'block', type:'operator_subtract', inputs:{A:num(''),B:num('')} },
      { kind:'block', type:'operator_multiply', inputs:{A:num(''),B:num('')} },
      { kind:'block', type:'operator_divide', inputs:{A:num(''),B:num('')} },
      { kind:'block', type:'operator_random', inputs:{FROM:num(1),TO:num(10)} },
      { kind:'block', type:'operator_lt', inputs:{A:txt(''),B:txt('')} },
      { kind:'block', type:'operator_equals', inputs:{A:txt(''),B:txt('')} },
      { kind:'block', type:'operator_gt', inputs:{A:txt(''),B:txt('')} },
      { kind:'block', type:'operator_and' },
      { kind:'block', type:'operator_or' },
      { kind:'block', type:'operator_not' },
      { kind:'block', type:'operator_join', inputs:{A:txt('apple '),B:txt('banana')} },
      { kind:'block', type:'operator_mod', inputs:{A:num(''),B:num('')} },
      { kind:'block', type:'operator_round', inputs:{A:num('')} },
    ]},
    { kind:'category', name:'Variables', colour:BF_COLORS.variable, custom:'VARIABLE_BF' },
  ]
};

/* ---------- Custom Variables flyout (Scratch-style blocks + make button) ---------- */
function BF_variableFlyout(workspace){
  const xml = [];
  const button = document.createElement('button');
  button.setAttribute('text','Make a Variable');
  button.setAttribute('callbackKey','BF_MAKE_VAR');
  xml.push(button);
  const vars = workspace.getAllVariables();
  if (vars.length){
    const v0 = vars[0];
    xml.push(Blockly.utils.xml.textToDom(
      `<block type="data_setvariableto"><field name="VAR" id="${v0.getId()}">${v0.name}</field>`+
      `<value name="VALUE"><shadow type="text_bf"><field name="TEXT">0</field></shadow></value></block>`));
    xml.push(Blockly.utils.xml.textToDom(
      `<block type="data_changevariableby"><field name="VAR" id="${v0.getId()}">${v0.name}</field>`+
      `<value name="VALUE"><shadow type="math_number_bf"><field name="NUM">1</field></shadow></value></block>`));
    xml.push(Blockly.utils.xml.textToDom(`<block type="data_showvariable"><field name="VAR" id="${v0.getId()}">${v0.name}</field></block>`));
    xml.push(Blockly.utils.xml.textToDom(`<block type="data_hidevariable"><field name="VAR" id="${v0.getId()}">${v0.name}</field></block>`));
    vars.forEach(v=>{
      xml.push(Blockly.utils.xml.textToDom(`<block type="data_variable"><field name="VAR" id="${v.getId()}">${v.name}</field></block>`));
    });
  }
  return xml;
}
