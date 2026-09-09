/* Starter scripts, smart objects and example games, written as compact block chains.
   chain([[type, fields, inputs, {DO:[...], ELSE:[...]}], ...]) → Blockly serialization JSON */
export function chain(list, x=20, y=20){
  let head = null, cur = null;
  for (const [type, fields, inputs, subs] of list){
    const blk = { type };
    if (fields) blk.fields = fields;
    const inp = {};
    for (const k in (inputs || {})){
      const v = inputs[k];
      if (v && typeof v === 'object' && v.type) inp[k] = { block: v };
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
export const ws = (...chains) => ({ blocks: { languageVersion: 0, blocks: chains.map((c, i) => Object.assign(c, { x: 20 + (i % 2) * 540, y: 20 + Math.floor(i / 2) * 230 })) } });
export const rep = (type, fields, inputs) => { const b = { type }; if (fields) b.fields = fields; if (inputs){ b.inputs = {}; for (const k in inputs){ const v = inputs[k]; b.inputs[k] = v && v.type ? { block: v } : (typeof v === 'number' ? { shadow: { type:'math_number', fields:{ NUM:v } } } : { shadow: { type:'text', fields:{ TEXT:v } } }); } } return b; };
const V = name => ({ VAR: { id: name, name, type: '' } });
const uid = () => Math.random().toString(36).slice(2, 8);

const obj = (kind, name, position, o={}) => Object.assign({
  id: 'ex_' + name.replace(/\W/g,'_') + '_' + uid(), name, kind, modelUrl:'', position, rotation:[0,0,0], scale:[1,1,1],
  color:'#4c97ff', material:'normal', opacity:0, texture:'', visible:true, collide:true,
  physics:{ enabled:true, type:'dynamic', mass:1, bounce:0.3, friction:0.4, upright:false }, light:null, text:null, terrain:null, workspace:null }, o);
const STATIC = { enabled:true, type:'static', mass:1, bounce:0.2, friction:0.6, upright:false };
const ground = (w=40, d=40, texture='grass') => obj('plane', 'Ground', [0,-0.1,0], { scale:[w,0.2,d], color:'#ffffff', texture, physics:STATIC });

/* ---------- Smart objects: drop in, already scripted ---------- */
const playerScripts = () => ws(
  chain([['event_whenflag'], ['camera_follow', { TARGET:'Player' }, { DIST:6, H:3 }], ['looks_sayfor', null, { TEXT:'Arrow keys or WASD to move, space to jump!', SECS:3 }]]),
  chain([['event_whenkey', { KEY:'up arrow' }], ['motion_forward', null, { STEPS:0.12 }]]),
  chain([['event_whenkey', { KEY:'w' }], ['motion_forward', null, { STEPS:0.12 }]]),
  chain([['event_whenkey', { KEY:'down arrow' }], ['motion_forward', null, { STEPS:-0.08 }]]),
  chain([['event_whenkey', { KEY:'s' }], ['motion_forward', null, { STEPS:-0.08 }]]),
  chain([['event_whenkey', { KEY:'left arrow' }], ['motion_turnleft', null, { DEG:3 }]]),
  chain([['event_whenkey', { KEY:'a' }], ['motion_turnleft', null, { DEG:3 }]]),
  chain([['event_whenkey', { KEY:'right arrow' }], ['motion_turnright', null, { DEG:3 }]]),
  chain([['event_whenkey', { KEY:'d' }], ['motion_turnright', null, { DEG:3 }]]),
  chain([['event_whenkey', { KEY:'space' }], ['physics_jump', null, { V:6 }], ['sound_play', { NAME:'jump' }], ['fx_particles', { COLOR:'#ffffff' }, { N:10, S:2 }]])
);
export const SMART = [
  { key:'player', label:'Player', icon:'🕹️', hint:'Drive it with arrows/WASD, jump with space, camera follows',
    build(p){ return obj('capsule', 'Player', p, { color:'#ff8c1a', physics:{ enabled:true, type:'dynamic', mass:1, bounce:0, friction:0.5, upright:true }, workspace: playerScripts() }); } },
  { key:'coin', label:'Coin', icon:'🪙', hint:'Spins, and adds 1 to score when the Player touches it',
    build(p){ return obj('cylinder', 'Coin', [p[0], 0.6, p[2]], { color:'#ffd700', material:'shiny', scale:[0.6,0.1,0.6], rotation:[90,0,0], physics:{ enabled:false, type:'static', mass:1, bounce:0, friction:0, upright:false },
      workspace: ws(
        chain([['event_whenflag'], ['data_showvariable', V('score')], ['control_forever', null, null, { DO:[['motion_tilt', { AXIS:'z' }, { DEG:4 }]] }]]),
        chain([['event_whentouch', { TARGET:'Player' }], ['sound_play', { NAME:'coin' }], ['fx_particles', { COLOR:'#ffd700' }, { N:30, S:3 }], ['data_changevariableby', V('score'), { VALUE:1 }], ['looks_hide']])
      ) }); }, variables:['score'] },
  { key:'enemy', label:'Enemy', icon:'👾', hint:'Chases the Player; touching it = game over',
    build(p){ return obj('cone', 'Enemy', [p[0], 0.5, p[2]], { color:'#ff3b3b', material:'glow', physics:{ enabled:true, type:'dynamic', mass:2, bounce:0, friction:0.6, upright:true },
      workspace: ws(
        chain([['event_whenflag'], ['control_forever', null, null, { DO:[['motion_turntowards', { TARGET:'Player' }, { V:4 }], ['motion_forward', null, { STEPS:0.05 }]] }]]),
        chain([['event_whentouch', { TARGET:'Player' }], ['sound_play', { NAME:'lose' }], ['fx_flash', { COLOR:'#ff0000' }, { SECS:0.4 }], ['looks_bigtext', null, { TEXT:'Game over!', SECS:2 }], ['control_stop', { WHAT:'all' }]])
      ) }); } },
  { key:'platform', label:'Moving platform', icon:'🛗', hint:'Slides back and forth — stand on it for a ride',
    build(p){ return obj('box', 'Platform', [p[0], 1.5, p[2]], { color:'#9966ff', scale:[3,0.3,3], physics:STATIC,
      workspace: ws(chain([['event_whenflag'], ['control_forever', null, null, { DO:[['motion_glide', null, { SECS:2, X:p[0]+6, Y:1.5, Z:p[2] }], ['motion_glide', null, { SECS:2, X:p[0], Y:1.5, Z:p[2] }]] }]])) }); } },
  { key:'spawner', label:'Ball spawner', icon:'⛲', hint:'Drops a bouncy ball every second',
    build(p){ return obj('sphere', 'Spawner', [p[0], 6, p[2]], { color:'#5cb1d6', material:'shiny', scale:[0.5,0.5,0.5], physics:{ enabled:true, type:'dynamic', mass:0.5, bounce:0.8, friction:0.3, upright:false },
      workspace: ws(
        chain([['event_whenflag'], ['looks_hide'], ['control_forever', null, null, { DO:[['control_clone', { TARGET:'__self__' }], ['control_wait', null, { SECS:1 }]] }]]),
        chain([['control_startclone'], ['looks_show'], ['looks_setcolorval', null, { COLOR: rep('op_join', null, { A:'hsl(', B: rep('op_join', null, { A: rep('op_random', null, { A:0, B:360 }), B:',90%,55%)' }) }) }], ['control_wait', null, { SECS:8 }], ['control_deleteclone']])
      ) }); } },
  { key:'goal', label:'Goal', icon:'🏁', hint:'Touch it with the Player to win',
    build(p){ return obj('torus', 'Goal', [p[0], 1, p[2]], { color:'#4cbb17', material:'glow', scale:[2,2,2], rotation:[90,0,0], physics:{ enabled:false, type:'static', mass:1, bounce:0, friction:0, upright:false },
      workspace: ws(chain([['event_whentouch', { TARGET:'Player' }], ['sound_play', { NAME:'win' }], ['fx_particles', { COLOR:'#4cbb17' }, { N:120, S:6 }], ['looks_bigtext', null, { TEXT:'You win!', SECS:3 }], ['control_stop', { WHAT:'all' }]])) }); } },
  { key:'button', label:'Button', icon:'🔘', hint:'Click it in the game to broadcast "pressed"',
    build(p){ return obj('cylinder', 'Button', [p[0], 0.15, p[2]], { color:'#ff5a5f', scale:[0.8,0.3,0.8], physics:STATIC,
      workspace: ws(chain([['event_whenclicked'], ['sound_play', { NAME:'click' }], ['looks_setcolor', { COLOR:'#59c059' }], ['event_broadcast', null, { MSG:'pressed' }], ['control_wait', null, { SECS:0.5 }], ['looks_setcolor', { COLOR:'#ff5a5f' }]])) }); } },
  { key:'lamp', label:'Lamp', icon:'💡', hint:'A point light that flickers on at night',
    build(p){ const d = obj('light', 'Lamp', [p[0], 3, p[2]], { color:'', physics:{ enabled:false, type:'static', mass:1, bounce:0, friction:0, upright:false }, light:{ color:'#ffd58a', intensity:14, distance:16, angle:35, shadow:false } }); return d; } },
  { key:'sign', label:'Sign', icon:'🪧', hint:'Floating 3D text you can change with blocks',
    build(p){ return obj('text', 'Sign', [p[0], 2, p[2]], { color:'', physics:{ enabled:false, type:'static', mass:1, bounce:0, friction:0, upright:false }, text:{ content:'Welcome!', size:0.8, color:'#ffffff', bg:'' } }); } },
];

export function newProjectData(){
  const player = SMART[0].build([0, 0.6, 0]);
  const ball = obj('sphere', 'Ball', [3, 4, 2], { color:'#ff5a5f', material:'shiny', physics:{ enabled:true, type:'dynamic', mass:0.5, bounce:0.8, friction:0.3, upright:false },
    workspace: ws(chain([['event_whentouch', { TARGET:'Player' }], ['sound_play', { NAME:'pop' }], ['fx_particles', { COLOR:'#ff5a5f' }, { N:20, S:3 }], ['physics_pushdir', { DIR:'up' }, { V:5 }]])) });
  const crate = obj('box', 'Crate', [-3, 0.5, -2], { color:'#ffffff', texture:'planks', physics:{ enabled:true, type:'dynamic', mass:2, bounce:0.1, friction:0.6, upright:false } });
  const ramp = obj('wedge', 'Ramp', [5, 0.75, -4], { color:'#ffffff', texture:'stone', scale:[3,1.5,4], physics:STATIC });
  return { version:2, name:'My Game', stage:{ style:'auto', time:12, sky:'#8fd3ff', gravity:9.8, sun:1, fog:true, ambient:1, workspace:null }, variables:[], lists:[], sounds:[], objects:[ground(), player, ball, crate, ramp], camera:{ position:[9,6,11], target:[0,1,0] } };
}

export const EXAMPLES = [
  { name: 'Coin Collector', build(){
    const player = SMART[0].build([0,0.6,0]);
    const coin = SMART[1].build([4,0.6,3]);
    coin.workspace = ws(
      chain([['event_whenflag'], ['data_setvariableto', V('score'), { VALUE:0 }], ['data_showvariable', V('score')], ['looks_show'], ['control_repeat', null, { TIMES:9 }, { DO:[['control_clone', { TARGET:'__self__' }]] }]]),
      chain([['control_startclone'], ['looks_show'], ['motion_goto', null, { X: rep('op_random', null, { A:-15, B:15 }), Y:0.6, Z: rep('op_random', null, { A:-15, B:15 }) }]]),
      chain([['event_whenflag'], ['control_forever', null, null, { DO:[['motion_tilt', { AXIS:'z' }, { DEG:4 }]] }]]),
      chain([['event_whentouch', { TARGET:'Player' }], ['sound_play', { NAME:'coin' }], ['fx_particles', { COLOR:'#ffd700' }, { N:30, S:3 }], ['data_changevariableby', V('score'), { VALUE:1 }], ['looks_hide'], ['control_if', null, { COND: rep('op_eq', null, { A: rep('data_variable', V('score')), B:10 }) }, { DO:[['sound_play', { NAME:'win' }], ['looks_bigtext', null, { TEXT:'You got them all!', SECS:3 }]] }]])
    );
    const enemy = SMART[2].build([-8,0.5,-8]);
    // screen UI: a coin counter label and a Jump button, driven by UI blocks on the Stage
    const ui = [ { id:'ui_score', name:'coins', type:'label', text:'Coins: 0 / 10', x:3, y:3, w:34, h:8, size:5, color:'#ffd700', bg:'', visible:true, radius:10 },
                 { id:'ui_jump', name:'Jump', type:'button', text:'Jump', x:78, y:84, w:19, h:11, size:5, color:'#ffffff', bg:'#7c5ce6', visible:true, radius:14 } ];
    const stageWs = ws(
      chain([['event_whenflag'], ['control_forever', null, null, { DO:[['ui_settext', { NAME:'coins' }, { V: rep('op_join', null, { A:'Coins: ', B: rep('op_join', null, { A: rep('data_variable', V('score')), B:' / 10' }) }) }]] }]])
    );
    player.workspace.blocks.blocks.push(chain([['ui_whenclicked', { NAME:'Jump' }], ['physics_jump', null, { V:6 }], ['sound_play', { NAME:'jump' }]], 560, 460));
    return { version:2, name:'Coin Collector', stage:{ style:'auto', time:11, sky:'#8fd3ff', gravity:9.8, sun:1, fog:true, ambient:1, workspace: stageWs }, variables:[{ name:'score', id:'score' }], lists:[], sounds:[], ui, objects:[ground(), player, coin, enemy], camera:{ position:[9,6,11], target:[0,1,0] } };
  }},
  { name: 'Bouncy Balls', build(){
    const ball = obj('sphere', 'Ball', [0,6,0], { color:'#ff5a5f', material:'shiny', physics:{ enabled:true, type:'dynamic', mass:1, bounce:0.9, friction:0.2, upright:false },
      workspace: ws(
        chain([['event_whenflag'], ['camera_setpos', null, { X:0, Y:10, Z:22 }], ['camera_lookat', { TARGET:'Ground' }], ['control_repeat', null, { TIMES:30 }, { DO:[['control_clone', { TARGET:'__self__' }], ['control_wait', null, { SECS:0.15 }]] }]]),
        chain([['control_startclone'], ['motion_goto', null, { X: rep('op_random', null, { A:-8, B:8 }), Y: rep('op_random', null, { A:6, B:14 }), Z: rep('op_random', null, { A:-8, B:8 }) }], ['looks_setcolorval', null, { COLOR: rep('op_join', null, { A:'hsl(', B: rep('op_join', null, { A: rep('op_random', null, { A:0, B:360 }), B:',90%,55%)' }) }) }], ['looks_setsize', null, { SIZE: rep('op_random', null, { A:50, B:150 }) }]]),
        chain([['event_whentouch', { TARGET:'Ground' }], ['sound_play', { NAME:'pop' }], ['fx_particles', { COLOR:'#ffffff' }, { N:6, S:2 }]])
      ) });
    const ramp = obj('wedge', 'Ramp', [-4,1,0], { color:'#9966ff', scale:[6,2,6], physics:{ enabled:true, type:'static', mass:1, bounce:0.5, friction:0.2, upright:false } });
    return { version:2, name:'Bouncy Balls', stage:{ style:'auto', time:17.5, sky:'#ffd9a8', gravity:9.8, sun:1, fog:true, ambient:1, workspace:null }, variables:[], lists:[], sounds:[], objects:[ground(30,30,'tiles'), ball, ramp], camera:{ position:[0,10,22], target:[0,2,0] } };
  }},
  { name: 'Dodge the Blocks', build(){
    const player = SMART[0].build([0,0.6,8]);
    player.workspace = ws(
      chain([['event_whenflag'], ['camera_follow', { TARGET:'Player' }, { DIST:8, H:4 }], ['data_setvariableto', V('time'), { VALUE:0 }], ['data_showvariable', V('time')], ['sensing_resettimer'], ['control_forever', null, null, { DO:[['data_setvariableto', V('time'), { VALUE: rep('op_round', null, { A: rep('sensing_timer') }) }]] }]]),
      chain([['event_whenkey', { KEY:'left arrow' }], ['motion_moveaxis', { DIR:'left' }, { V:0.15 }]]),
      chain([['event_whenkey', { KEY:'right arrow' }], ['motion_moveaxis', { DIR:'right' }, { V:0.15 }]]),
      chain([['event_whenkey', { KEY:'space' }], ['physics_jump', null, { V:6 }]]),
      chain([['event_whentouch', { TARGET:'Block' }], ['sound_play', { NAME:'lose' }], ['fx_flash', { COLOR:'#ff0000' }, { SECS:0.4 }], ['looks_bigtext', null, { TEXT:'Ouch! Game over', SECS:2 }], ['control_stop', { WHAT:'all' }]]),
      chain([['event_whentimer', null, { V:30 }], ['sound_play', { NAME:'win' }], ['looks_bigtext', null, { TEXT:'You survived!', SECS:3 }], ['control_stop', { WHAT:'all' }]])
    );
    const block = obj('box', 'Block', [0,0.5,-20], { color:'#ffffff', texture:'lava', physics:{ enabled:true, type:'dynamic', mass:3, bounce:0.2, friction:0.1, upright:false },
      workspace: ws(
        chain([['event_whenflag'], ['looks_hide'], ['control_forever', null, null, { DO:[['control_clone', { TARGET:'__self__' }], ['control_wait', null, { SECS:0.8 }]] }]]),
        chain([['control_startclone'], ['looks_show'], ['motion_goto', null, { X: rep('op_random', null, { A:-6, B:6 }), Y:0.5, Z:-20 }], ['physics_setvel', null, { X:0, Y:0, Z:12 }], ['control_wait', null, { SECS:4 }], ['control_deleteclone']])
      ) });
    return { version:2, name:'Dodge the Blocks', stage:{ style:'auto', time:21, sky:'#c9b6ff', gravity:9.8, sun:1, fog:true, ambient:1, workspace:null }, variables:[{ name:'time', id:'time' }], lists:[], sounds:[], objects:[ground(16,60,'metal'), player, block, SMART[7].build([0,3,0]), SMART[7].build([0,3,-12])], camera:{ position:[0,8,18], target:[0,1,0] } };
  }},
  { name: 'Terrain Explorer', build(){
    const player = SMART[0].build([0,3,0]); player.drop = true;
    const terrain = obj('terrain', 'Terrain', [0,0,0], { color:'#ffffff', physics:STATIC, terrain:{ size:240, height:9, seed:12, detail:160, texture:'grass' } });
    const goal = SMART[5].build([60,1,-60]); goal.drop = true;
    return { version:2, name:'Terrain Explorer', stage:{ style:'auto', time:9, sky:'#8fd3ff', gravity:9.8, gravity:9.8, sun:1, fog:true, ambient:1, workspace:null }, variables:[], lists:[], sounds:[], objects:[terrain, player, goal, Object.assign(SMART[8].build([0,4,-3]), { drop:true })], camera:{ position:[12,10,14], target:[0,1,0] } };
  }}
];
