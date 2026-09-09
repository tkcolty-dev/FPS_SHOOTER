/* Starter scripts + example games, written as compact block chains.
   chain([[type, fields, inputs, {DO:[...], ELSE:[...]}], ...]) → Blockly serialization JSON */
export function chain(list, x=20, y=20){
  let head = null, cur = null;
  for (const [type, fields, inputs, subs] of list){
    const blk = { type };
    if (fields) blk.fields = fields;
    const inp = {};
    for (const k in (inputs || {})){
      const v = inputs[k];
      if (v && typeof v === 'object' && v.type) inp[k] = { block: v };                 // nested reporter block
      else if (v && typeof v === 'object' && v.shadowType) inp[k] = { shadow: { type: v.shadowType, fields: v.fields } };
      else inp[k] = typeof v === 'number' ? { shadow: { type: 'math_number', fields: { NUM: v } } } : { shadow: { type: 'text', fields: { TEXT: v } } };
    }
    for (const k in (subs || {})) inp[k] = { block: chainBlock(subs[k]) };
    if (Object.keys(inp).length) blk.inputs = inp;
    if (!head) { head = blk; head.x = x; head.y = y; } else cur.next = { block: blk };
    cur = blk;
  }
  return head;
}
function chainBlock(list){ const b = chain(list); delete b.x; delete b.y; return b; }
export const ws = (...chains) => ({ blocks: { languageVersion: 0, blocks: chains.map((c, i) => Object.assign(c, { x: 20 + (i % 2) * 540, y: 20 + Math.floor(i / 2) * 210 })) } });
// reporters / booleans
export const rep = (type, fields, inputs) => { const b = { type }; if (fields) b.fields = fields; if (inputs){ b.inputs = {}; for (const k in inputs){ const v = inputs[k]; b.inputs[k] = v && v.type ? { block: v } : (typeof v === 'number' ? { shadow: { type:'math_number', fields:{ NUM:v } } } : { shadow: { type:'text', fields:{ TEXT:v } } }); } } return b; };
const V = name => ({ VAR: { id: name, name, type: '' } });

const obj = (kind, name, position, o={}) => Object.assign({
  id: 'ex_' + name.replace(/\W/g,'_') + '_' + Math.random().toString(36).slice(2,6), name, kind, modelUrl:'', position, rotation:[0,0,0], scale:[1,1,1],
  color:'#4c97ff', material:'normal', opacity:0, visible:true,
  physics:{ enabled:true, type:'dynamic', mass:1, bounce:0.3, friction:0.4, upright:false }, workspace:null }, o);
const ground = (w=40, d=40, color='#7cbf5a') => obj('plane', 'Ground', [0,-0.1,0], { scale:[w,0.2,d], color, physics:{ enabled:true, type:'static', mass:1, bounce:0.2, friction:0.6, upright:false } });

/* Scripts that a brand-new Player gets so pressing ▶ instantly does something */
export function playerScripts(){
  return ws(
    chain([['event_whenflag'], ['camera_follow', { TARGET:'Player' }, { DIST:6, H:3 }], ['looks_sayfor', null, { TEXT:'Arrow keys to move, space to jump!', SECS:3 }]]),
    chain([['event_whenkey', { KEY:'up arrow' }], ['motion_forward', null, { STEPS:0.12 }]]),
    chain([['event_whenkey', { KEY:'down arrow' }], ['motion_forward', null, { STEPS:-0.08 }]]),
    chain([['event_whenkey', { KEY:'left arrow' }], ['motion_turnleft', null, { DEG:3 }]]),
    chain([['event_whenkey', { KEY:'right arrow' }], ['motion_turnright', null, { DEG:3 }]]),
    chain([['event_whenkey', { KEY:'space' }], ['physics_jump', null, { V:6 }], ['sound_play', { NAME:'jump' }]])
  );
}

export function newProjectData(){
  const player = obj('capsule', 'Player', [0, 0.6, 0], { color:'#ff8c1a', physics:{ enabled:true, type:'dynamic', mass:1, bounce:0, friction:0.5, upright:true }, workspace: playerScripts() });
  const ball = obj('sphere', 'Ball', [3, 4, 2], { color:'#ff5a5f', physics:{ enabled:true, type:'dynamic', mass:0.5, bounce:0.8, friction:0.3, upright:false },
    workspace: ws(chain([['event_whenflag'], ['control_forever', null, null, { DO:[['control_if', null, { COND: rep('sensing_touching', { TARGET:'Player' }) }, { DO:[['sound_play', { NAME:'pop' }], ['physics_pushdir', { DIR:'up' }, { V:5 }], ['control_wait', null, { SECS:0.3 }]] }]] }]])) });
  const crate = obj('box', 'Crate', [-3, 0.5, -2], { color:'#c58b4e', physics:{ enabled:true, type:'dynamic', mass:2, bounce:0.1, friction:0.6, upright:false } });
  return { version:1, name:'My Game', stage:{ sky:'#8fd3ff', gravity:9.8, sun:1, fog:true, workspace:null }, variables:[], objects:[ground(), player, ball, crate], camera:{ position:[9,6,11], target:[0,1,0] } };
}

export const EXAMPLES = [
  { name: 'Coin Collector', build(){
    const player = obj('capsule', 'Player', [0,0.6,0], { color:'#ff8c1a', physics:{ enabled:true, type:'dynamic', mass:1, bounce:0, friction:0.5, upright:true }, workspace: playerScripts() });
    const coin = obj('cylinder', 'Coin', [4,0.5,3], { color:'#ffd700', material:'shiny', scale:[0.6,0.1,0.6], rotation:[90,0,0], physics:{ enabled:false, type:'static', mass:1, bounce:0, friction:0, upright:false },
      workspace: ws(
        chain([['event_whenflag'], ['data_setvariableto', V('score'), { VALUE:0 }], ['data_showvariable', V('score')], ['looks_show'], ['control_repeat', null, { TIMES:9 }, { DO:[['control_clone', { TARGET:'__self__' }]] }]]),
        chain([['control_startclone'], ['looks_show'], ['motion_goto', null, { X: rep('op_random', null, { A:-15, B:15 }), Y:0.5, Z: rep('op_random', null, { A:-15, B:15 }) }]]),
        chain([['event_whenflag'], ['control_forever', null, null, { DO:[['motion_tilt', { AXIS:'z' }, { DEG:4 }]] }]]),
        chain([['event_whentouch', { TARGET:'Player' }], ['sound_play', { NAME:'coin' }], ['data_changevariableby', V('score'), { VALUE:1 }], ['looks_hide'], ['control_if', null, { COND: rep('op_eq', null, { A: rep('data_variable', V('score')), B:10 }) }, { DO:[['sound_play', { NAME:'win' }], ['looks_bigtext', null, { TEXT:'You got them all!', SECS:3 }]] }]])
      ) });
    return { version:1, name:'Coin Collector', stage:{ sky:'#8fd3ff', gravity:9.8, sun:1, fog:true, workspace:null }, variables:[{ name:'score', id:'score' }], objects:[ground(), player, coin], camera:{ position:[9,6,11], target:[0,1,0] } };
  }},
  { name: 'Bouncy Balls', build(){
    const ball = obj('sphere', 'Ball', [0,6,0], { color:'#ff5a5f', material:'shiny', physics:{ enabled:true, type:'dynamic', mass:1, bounce:0.9, friction:0.2, upright:false },
      workspace: ws(
        chain([['event_whenflag'], ['camera_setpos', null, { X:0, Y:10, Z:22 }], ['camera_lookat', { TARGET:'Ground' }], ['control_repeat', null, { TIMES:30 }, { DO:[['control_clone', { TARGET:'__self__' }], ['control_wait', null, { SECS:0.15 }]] }]]),
        chain([['control_startclone'], ['motion_goto', null, { X: rep('op_random', null, { A:-8, B:8 }), Y: rep('op_random', null, { A:6, B:14 }), Z: rep('op_random', null, { A:-8, B:8 }) }], ['looks_setcolorval', null, { COLOR: rep('op_join', null, { A:'hsl(', B: rep('op_join', null, { A: rep('op_random', null, { A:0, B:360 }), B:',90%,55%)' }) }) }], ['looks_setsize', null, { SIZE: rep('op_random', null, { A:50, B:150 }) }]]),
        chain([['event_whentouch', { TARGET:'Ground' }], ['sound_play', { NAME:'pop' }]])
      ) });
    const ramp = obj('wedge', 'Ramp', [-4,1,0], { color:'#9966ff', scale:[6,2,6], physics:{ enabled:true, type:'static', mass:1, bounce:0.5, friction:0.2, upright:false } });
    return { version:1, name:'Bouncy Balls', stage:{ sky:'#ffd9a8', gravity:9.8, sun:1, fog:true, workspace:null }, variables:[], objects:[ground(30,30,'#5aa9bf'), ball, ramp], camera:{ position:[0,10,22], target:[0,2,0] } };
  }},
  { name: 'Dodge the Blocks', build(){
    const player = obj('capsule', 'Player', [0,0.6,8], { color:'#4cbb17', physics:{ enabled:true, type:'dynamic', mass:1, bounce:0, friction:0.5, upright:true },
      workspace: ws(
        chain([['event_whenflag'], ['camera_follow', { TARGET:'Player' }, { DIST:8, H:4 }], ['data_setvariableto', V('time'), { VALUE:0 }], ['data_showvariable', V('time')], ['sensing_resettimer'], ['control_forever', null, null, { DO:[['data_setvariableto', V('time'), { VALUE: rep('op_round', null, { A: rep('sensing_timer') }) }]] }]]),
        chain([['event_whenkey', { KEY:'left arrow' }], ['motion_moveaxis', { DIR:'left' }, { V:0.15 }]]),
        chain([['event_whenkey', { KEY:'right arrow' }], ['motion_moveaxis', { DIR:'right' }, { V:0.15 }]]),
        chain([['event_whenkey', { KEY:'space' }], ['physics_jump', null, { V:6 }]]),
        chain([['event_whentouch', { TARGET:'Block' }], ['sound_play', { NAME:'lose' }], ['looks_bigtext', null, { TEXT:'Ouch! Game over', SECS:2 }], ['control_stop', { WHAT:'all' }]])
      ) });
    const block = obj('box', 'Block', [0,0.5,-20], { color:'#ff5a5f', physics:{ enabled:true, type:'dynamic', mass:3, bounce:0.2, friction:0.1, upright:false },
      workspace: ws(
        chain([['event_whenflag'], ['looks_hide'], ['control_forever', null, null, { DO:[['control_clone', { TARGET:'__self__' }], ['control_wait', null, { SECS:0.8 }]] }]]),
        chain([['control_startclone'], ['looks_show'], ['motion_goto', null, { X: rep('op_random', null, { A:-6, B:6 }), Y:0.5, Z:-20 }], ['physics_setvel', null, { X:0, Y:0, Z:12 }], ['control_wait', null, { SECS:4 }], ['control_deleteclone']])
      ) });
    return { version:1, name:'Dodge the Blocks', stage:{ sky:'#c9b6ff', gravity:9.8, sun:1, fog:true, workspace:null }, variables:[{ name:'time', id:'time' }], objects:[ground(16,60,'#6c757d'), player, block], camera:{ position:[0,8,18], target:[0,1,0] } };
  }}
];
