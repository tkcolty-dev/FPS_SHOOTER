/* ============================================================
   BlockForge — application shell
   Wires Blockly editor, sprites, costumes, runtime & Claude bridge
   ============================================================ */

const $ = sel => document.querySelector(sel);
const el = (id) => document.getElementById(id);

const BF = {
  workspace: null,
  vm: null,
  project: null,
  current: null,        // currently edited target (sprite or stage)
  imageMap: {},         // name -> {costumeName: Image}
  spriteNames(){ return BF.project ? BF.project.sprites.map(s=>s.name) : []; }
};
window.BF = BF;

/* ---------- built-in SVG costumes ---------- */
const SVG = {
  ball:(c)=>`<svg xmlns="http://www.w3.org/2000/svg" width="48" height="48"><circle cx="24" cy="24" r="22" fill="${c}"/><circle cx="17" cy="17" r="7" fill="#ffffff" opacity=".5"/></svg>`,
  paddle:(c)=>`<svg xmlns="http://www.w3.org/2000/svg" width="20" height="90"><rect x="2" y="2" width="16" height="86" rx="8" fill="${c}"/></svg>`,
  star:(c)=>`<svg xmlns="http://www.w3.org/2000/svg" width="48" height="48"><path d="M24 3l6 13 14 2-10 10 2 14-12-7-12 7 2-14L4 18l14-2z" fill="${c}"/></svg>`,
  cat:()=>`<svg xmlns="http://www.w3.org/2000/svg" width="60" height="55"><ellipse cx="30" cy="32" rx="22" ry="18" fill="#ffab19"/><path d="M12 18l6 10 8-6z" fill="#ffab19"/><path d="M48 18l-6 10-8-6z" fill="#ffab19"/><circle cx="23" cy="30" r="3" fill="#222"/><circle cx="37" cy="30" r="3" fill="#222"/><path d="M26 38q4 4 8 0" stroke="#222" stroke-width="2" fill="none"/></svg>`,
  square:(c)=>`<svg xmlns="http://www.w3.org/2000/svg" width="44" height="44"><rect x="2" y="2" width="40" height="40" rx="7" fill="${c}"/></svg>`
};
const svgURL = (s)=>'data:image/svg+xml;utf8,'+encodeURIComponent(s);

/* ---------- default + example projects ---------- */
function defaultProject(){
  return {
    name:'Untitled', stage:{ name:'Stage', isStage:true, costumes:[], blocks:null },
    variables:[{name:'score', value:0, visible:false}],
    sprites:[{
      name:'Sprite1', x:0, y:0, direction:90, size:100, visible:true,
      costumes:[{name:'cat', src:svgURL(SVG.cat())}], currentCostume:0,
      blocks:{ blocks:{ languageVersion:0, blocks:[
        { type:'event_whenflag', id:'h1', x:40, y:40, next:{ block:{
          type:'control_forever', id:'f1', inputs:{ DO:{ block:{
            type:'motion_move', id:'m1',
            inputs:{ STEPS:{ shadow:{ type:'math_number_bf', id:'n1', fields:{NUM:4} } } },
            next:{ block:{ type:'motion_ifonedge', id:'e1' } }
          }}}
        }}}
      ]}}
    }]
  };
}

const EXAMPLES = {
  'Bouncing Ball': ()=>({
    name:'Bouncing Ball', stage:{name:'Stage',isStage:true,costumes:[],blocks:null},
    variables:[],
    sprites:[{ name:'Ball', x:0,y:0,direction:45,size:100,visible:true,
      costumes:[{name:'ball',src:svgURL(SVG.ball('#ff5470'))}], currentCostume:0,
      blocks:{blocks:{languageVersion:0,blocks:[
        {type:'event_whenflag',id:'h',x:40,y:40,next:{block:{
          type:'control_forever',id:'f',inputs:{DO:{block:{
            type:'motion_move',id:'mv',inputs:{STEPS:{shadow:{type:'math_number_bf',fields:{NUM:6}}}},
            next:{block:{type:'motion_ifonedge',id:'eb'}}
          }}}
        }}}
      ]}}
    }]
  }),
  'Drive with Arrows': ()=>({
    name:'Drive with Arrows', stage:{name:'Stage',isStage:true,costumes:[],blocks:null},
    variables:[],
    sprites:[{ name:'Car', x:0,y:0,direction:90,size:100,visible:true,
      costumes:[{name:'car',src:svgURL(SVG.square('#4C97FF'))}], currentCostume:0,
      blocks:{blocks:{languageVersion:0,blocks:[
        {type:'event_whenflag',id:'h',x:40,y:30,next:{block:{
          type:'control_forever',id:'f',inputs:{DO:{block:{
            type:'control_if',id:'i1',inputs:{
              COND:{block:{type:'sensing_keypressed',id:'k1',fields:{KEY:'right arrow'}}},
              DO:{block:{type:'motion_changexby',id:'cx1',inputs:{DX:{shadow:{type:'math_number_bf',fields:{NUM:5}}}}}}
            },next:{block:{
            type:'control_if',id:'i2',inputs:{
              COND:{block:{type:'sensing_keypressed',id:'k2',fields:{KEY:'left arrow'}}},
              DO:{block:{type:'motion_changexby',id:'cx2',inputs:{DX:{shadow:{type:'math_number_bf',fields:{NUM:-5}}}}}}
            },next:{block:{
            type:'control_if',id:'i3',inputs:{
              COND:{block:{type:'sensing_keypressed',id:'k3',fields:{KEY:'up arrow'}}},
              DO:{block:{type:'motion_changeyby',id:'cy1',inputs:{DY:{shadow:{type:'math_number_bf',fields:{NUM:5}}}}}}
            },next:{block:{
            type:'control_if',id:'i4',inputs:{
              COND:{block:{type:'sensing_keypressed',id:'k4',fields:{KEY:'down arrow'}}},
              DO:{block:{type:'motion_changeyby',id:'cy2',inputs:{DY:{shadow:{type:'math_number_bf',fields:{NUM:-5}}}}}}
            }}}}}}}
          }}}
        }}}
      ]}}
    }]
  })
};

/* ============================================================
   BLOCKLY
   ============================================================ */
function initBlockly(){
  BF.workspace = Blockly.inject('blockly-area', {
    toolbox: BF_TOOLBOX,
    theme: BF_THEME,
    renderer: 'zelos',
    grid:{ spacing:28, length:2, colour:'#222a44', snap:true },
    zoom:{ controls:true, wheel:true, startScale:0.78, maxScale:2, minScale:0.4 },
    move:{ scrollbars:true, drag:true, wheel:true },
    trashcan:true
  });
  // custom Variables flyout + make-variable button
  BF.workspace.registerToolboxCategoryCallback('VARIABLE_BF', BF_variableFlyout);
  BF.workspace.registerButtonCallback('BF_MAKE_VAR', (btn)=>{
    Blockly.Variables.createVariableButtonHandler(btn.getTargetWorkspace(), (name)=>{
      if(name){ if(!BF.project.variables.find(v=>v.name===name))
        BF.project.variables.push({name, value:0, visible:false}); }
      BF.workspace.refreshToolboxSelection();
    });
  });
  // keep current target's blocks in sync as the user edits
  BF.workspace.addChangeListener((e)=>{
    if(e.isUiEvent) return;
    if(BF.current){ BF.current.blocks = Blockly.serialization.workspaces.save(BF.workspace); pushState(); }
  });
}

function ensureVariables(ws){
  BF.project.variables.forEach(v=>{
    if(!ws.getVariable(v.name)) ws.createVariable(v.name);
  });
}

/* ============================================================
   TARGET (sprite/stage) SWITCHING
   ============================================================ */
function selectTarget(target){
  // save current first
  if(BF.current && BF.workspace.getAllBlocks(false).length>=0){
    BF.current.blocks = Blockly.serialization.workspaces.save(BF.workspace);
  }
  BF.current = target;
  BF.workspace.removeChangeListener;            // no-op safeguard
  Blockly.Events.disable();
  BF.workspace.clear();
  if(target.blocks && target.blocks.blocks){
    try{ Blockly.serialization.workspaces.load(target.blocks, BF.workspace); }catch(err){ console.warn(err); }
  }
  ensureVariables(BF.workspace);
  Blockly.Events.enable();
  el('editing-target').innerHTML = target.isStage ? 'Stage' : '<b>'+target.name+'</b>';
  renderSpriteList();
  renderInspector();
  renderCostumes();
}

/* ============================================================
   IMAGE PRELOAD
   ============================================================ */
function preloadImages(project, done){
  BF.imageMap = {};
  const all = [project.stage, ...project.sprites];
  let pending = 0, started=false;
  all.forEach(t=>{
    BF.imageMap[t.name] = {};
    (t.costumes||[]).forEach(c=>{
      pending++;
      const img = new Image();
      img.onload = img.onerror = ()=>{ pending--; if(started && pending===0) finish(); BF.vm && BF.vm.render(); };
      img.src = c.src;
      BF.imageMap[t.name][c.name] = img;
    });
  });
  started=true;
  if(pending===0) finish();
  function finish(){ if(done) done(); }
}

/* ============================================================
   PROJECT LOAD / SAVE
   ============================================================ */
function loadProject(project){
  // normalize
  project.variables = project.variables || [];
  project.stage = project.stage || {name:'Stage',isStage:true,costumes:[],blocks:null};
  project.stage.isStage = true; project.stage.name='Stage';
  project.sprites = project.sprites || [];
  project.sprites.forEach(s=>{
    s.x=s.x||0; s.y=s.y||0; s.direction=s.direction==null?90:s.direction;
    s.size=s.size==null?100:s.size; s.visible=s.visible!==false;
    s.costumes = s.costumes && s.costumes.length ? s.costumes : [{name:'costume1', src:svgURL(SVG.square('#4C97FF'))}];
    s.currentCostume = s.currentCostume||0;
  });
  BF.project = project;
  BF.current = null;

  preloadImages(project, ()=>{
    BF.vm.load(project, BF.imageMap);
  });
  // ensure variables exist in workspace and select a target
  BF.current = null;
  selectTarget(project.sprites[0] || project.stage);
  BF.vm.load(project, BF.imageMap);
  toast('Loaded: '+(project.name||'project'));
}

function collectProject(){
  // make sure current edits are captured
  if(BF.current) BF.current.blocks = Blockly.serialization.workspaces.save(BF.workspace);
  return {
    name: BF.project.name||'Untitled',
    variables: BF.project.variables,
    stage: stripTarget(BF.project.stage),
    sprites: BF.project.sprites.map(stripTarget)
  };
}
function stripTarget(t){
  return {
    name:t.name, isStage:t.isStage||undefined,
    x:t.x, y:t.y, direction:t.direction, size:t.size, visible:t.visible,
    rotationStyle:t.rotationStyle, currentCostume:t.currentCostume,
    costumes:t.costumes, blocks:t.blocks||null
  };
}

function exportProject(){
  const data = collectProject();
  const blob = new Blob([JSON.stringify(data,null,2)], {type:'application/json'});
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = (data.name||'project').replace(/\s+/g,'_')+'.bfproject.json';
  a.click();
  toast('Project saved — share the .json with Claude to iterate');
}

/* ============================================================
   SPRITE LIST + INSPECTOR + COSTUMES
   ============================================================ */
function renderSpriteList(){
  const list = el('sprite-list'); list.innerHTML='';
  // stage card
  list.appendChild(spriteCard(BF.project.stage, true));
  BF.project.sprites.forEach(s=> list.appendChild(spriteCard(s,false)));
}
function spriteCard(target, isStage){
  const d = document.createElement('div');
  d.className='sprite-card'+(isStage?' is-stage':'')+(BF.current===target?' active':'');
  const thumb = document.createElement('div'); thumb.className='sprite-thumb';
  const c = target.costumes && target.costumes[target.currentCostume||0];
  if(c){ const im=document.createElement('img'); im.src=c.src; thumb.appendChild(im); }
  else thumb.textContent='▥';
  const nm=document.createElement('div'); nm.className='nm'; nm.textContent=isStage?'Stage':target.name;
  d.appendChild(thumb); d.appendChild(nm);
  d.onclick=()=>selectTarget(target);
  return d;
}
function renderInspector(){
  const insp = el('sprite-inspector');
  if(BF.current.isStage){ insp.style.display='none'; return; }
  insp.style.display='flex';
  const s = BF.current;
  el('insp-name').value=s.name;
  el('insp-x').value=Math.round(s.x); el('insp-y').value=Math.round(s.y);
  el('insp-dir').value=Math.round(s.direction); el('insp-size').value=Math.round(s.size);
  el('insp-show').checked=s.visible;
}
function bindInspector(){
  el('insp-name').oninput=e=>{ const old=BF.current.name; BF.current.name=e.target.value||old;
    BF.imageMap[BF.current.name]=BF.imageMap[old]; renderSpriteList(); el('editing-target').innerHTML='<b>'+BF.current.name+'</b>'; };
  const upd=(k,id,parse)=>{ el(id).oninput=e=>{ BF.current[k]=parse(e.target.value); refreshLive(); }; };
  upd('x','insp-x',parseFloat); upd('y','insp-y',parseFloat);
  upd('direction','insp-dir',parseFloat); upd('size','insp-size',parseFloat);
  el('insp-show').onchange=e=>{ BF.current.visible=e.target.checked; refreshLive(); };
  el('btn-del-sprite').onclick=()=>{
    if(BF.current.isStage) return;
    const i=BF.project.sprites.indexOf(BF.current);
    if(i>=0) BF.project.sprites.splice(i,1);
    selectTarget(BF.project.sprites[0]||BF.project.stage);
    BF.vm.load(BF.project, BF.imageMap);
  };
}
function refreshLive(){
  // reflect inspector changes onto the (non-running) stage preview
  if(!BF.vm.running){ BF.vm.load(BF.project, BF.imageMap); }
  renderSpriteList(); pushState();
}

function renderCostumes(){
  const panel = el('costumes-panel'); panel.innerHTML='';
  const head = document.createElement('div'); head.className='costume-actions';
  const up=document.createElement('button'); up.textContent='⬆ Upload image';
  up.onclick=()=>pickCostumeImage();
  const lib=document.createElement('button'); lib.className='ghost'; lib.textContent='+ Shape';
  lib.onclick=()=>addShapeCostume();
  head.appendChild(up); head.appendChild(lib);
  panel.appendChild(head);
  const grid=document.createElement('div'); grid.className='costume-grid';
  (BF.current.costumes||[]).forEach((c,i)=>{
    const card=document.createElement('div'); card.className='costume-card'+(i===BF.current.currentCostume?' active':'');
    const cv=document.createElement('div'); cv.className='cv'; const im=document.createElement('img'); im.src=c.src; cv.appendChild(im);
    const cn=document.createElement('div'); cn.className='cn'; cn.textContent=c.name;
    card.appendChild(cv); card.appendChild(cn);
    card.onclick=()=>{ BF.current.currentCostume=i; renderCostumes(); refreshLive(); };
    grid.appendChild(card);
  });
  panel.appendChild(grid);
}
function pickCostumeImage(){
  const inp=document.createElement('input'); inp.type='file'; inp.accept='image/*';
  inp.onchange=e=>{ const f=e.target.files[0]; if(!f) return;
    const r=new FileReader(); r.onload=()=>{
      const name=f.name.replace(/\.[^.]+$/,'');
      BF.current.costumes.push({name, src:r.result});
      const img=new Image(); img.src=r.result; (BF.imageMap[BF.current.name]=BF.imageMap[BF.current.name]||{})[name]=img;
      renderCostumes(); refreshLive();
    }; r.readAsDataURL(f);
  };
  inp.click();
}
function addShapeCostume(){
  const colors=['#ff5470','#4C97FF','#59C059','#FFAB19','#9966FF'];
  const c=colors[Math.floor(Math.random()*colors.length)];
  const name='shape'+(BF.current.costumes.length+1);
  const src=svgURL(SVG.square(c));
  BF.current.costumes.push({name, src});
  const img=new Image(); img.src=src; (BF.imageMap[BF.current.name]=BF.imageMap[BF.current.name]||{})[name]=img;
  renderCostumes(); refreshLive();
}

function addSprite(){
  const n='Sprite'+(BF.project.sprites.length+1);
  const colors=['#ff5470','#4C97FF','#59C059','#FFAB19','#9966FF'];
  const c=colors[BF.project.sprites.length%colors.length];
  const s={ name:n, x:0,y:0,direction:90,size:100,visible:true,
    costumes:[{name:'body', src:svgURL(SVG.ball(c))}], currentCostume:0, blocks:null };
  BF.project.sprites.push(s);
  BF.imageMap[n]={}; const img=new Image(); img.src=s.costumes[0].src; BF.imageMap[n]['body']=img;
  selectTarget(s);
  BF.vm.load(BF.project, BF.imageMap);
}

/* ============================================================
   RUN CONTROLS + INPUT
   ============================================================ */
function greenFlag(){
  if(BF.current) BF.current.blocks = Blockly.serialization.workspaces.save(BF.workspace);
  BF.vm.load(BF.project, BF.imageMap);
  BF.vm.greenFlag();
}
function stopAll(){ BF.vm.stopAll(); BF.vm.load(BF.project, BF.imageMap); }

const KEYMAP={ ' ':'space','ArrowUp':'up arrow','ArrowDown':'down arrow','ArrowLeft':'left arrow','ArrowRight':'right arrow' };
function keyName(e){ if(KEYMAP[e.key]) return KEYMAP[e.key]; if(e.key.length===1) return e.key.toLowerCase(); return null; }
function bindInput(){
  const canvas=el('stage');
  window.addEventListener('keydown',e=>{ const k=keyName(e); if(!k) return;
    if(['space','up arrow','down arrow','left arrow','right arrow'].includes(k)) e.preventDefault();
    if(!BF.vm.input.keys[k]){ BF.vm.input.keys[k]=true; if(BF.vm.running) BF.vm.whenKey(k); } });
  window.addEventListener('keyup',e=>{ const k=keyName(e); if(k) BF.vm.input.keys[k]=false; });
  function toStage(e){ const r=canvas.getBoundingClientRect();
    BF.vm.input.mouseX=(e.clientX-r.left)*(480/r.width)-240;
    BF.vm.input.mouseY=180-(e.clientY-r.top)*(360/r.height); }
  canvas.addEventListener('mousemove',toStage);
  canvas.addEventListener('mousedown',e=>{ toStage(e); BF.vm.input.mouseDown=true;
    if(BF.vm.running){ const sp=spriteAtPoint(BF.vm.input.mouseX,BF.vm.input.mouseY); if(sp) BF.vm.whenClicked(sp); } });
  window.addEventListener('mouseup',()=>BF.vm.input.mouseDown=false);
}
function spriteAtPoint(x,y){
  const order=[...BF.vm.sprites].sort((a,b)=>b.layer-a.layer);
  for(const s of order){ if(!s.visible) continue; const b=s.bbox();
    if(x>=b.l&&x<=b.r&&y>=b.b&&y<=b.t) return s; }
  return null;
}

/* ---- ask/answer overlay ---- */
function bindAsk(){
  BF.vm.onAsk=(q)=>{ el('ask-question').textContent=q; el('ask-overlay').classList.remove('hidden'); el('ask-input').value=''; el('ask-input').focus(); };
  BF.vm.onAskDone=()=>{ el('ask-overlay').classList.add('hidden'); };
  const submit=()=>{ BF.vm.submitAnswer(el('ask-input').value); };
  el('ask-ok').onclick=submit;
  el('ask-input').addEventListener('keydown',e=>{ if(e.key==='Enter') submit(); });
  BF.vm.onStop=()=>{ el('ask-overlay').classList.add('hidden'); };
}

/* ---- fps readout ---- */
function tickFps(){ el('fps-readout').textContent = BF.vm.running ? (BF.vm.fps+' fps') : 'idle'; requestAnimationFrame(tickFps); }

/* ============================================================
   CLAUDE BRIDGE
   ============================================================ */
const SCHEMA_TEXT = `// BlockForge project format (.bfproject.json)
{
  "name": "My Game",
  "variables": [ { "name": "score", "value": 0, "visible": true } ],
  "stage":   { "name": "Stage", "isStage": true, "costumes": [], "blocks": null },
  "sprites": [
    {
      "name": "Player",
      "x": 0, "y": -120, "direction": 90, "size": 100, "visible": true,
      "costumes": [ { "name": "body", "src": "data:image/svg+xml;utf8,..." } ],
      "currentCostume": 0,
      "blocks": <Blockly workspace JSON>   // see block types below
    }
  ]
}

// "blocks" uses Blockly serialization:
// { "blocks": { "languageVersion": 0, "blocks": [ <hat block tree> ] } }
// A block: { "type":"...", "id":"x", "x":40,"y":40,
//            "fields": { "KEY":"space" },
//            "inputs": { "STEPS": { "shadow": { "type":"math_number_bf","fields":{"NUM":10} } } },
//            "next":   { "block": { ...next statement... } } }

// HAT blocks (script starts): event_whenflag, event_whenkey(KEY),
//   event_whenclicked, event_whenbroadcast(MSG)
// MOTION: motion_move(STEPS) motion_turnright/left(DEG) motion_pointindirection(DIR)
//   motion_goto(X,Y) motion_glide(SECS,X,Y) motion_changexby(DX) motion_setx(X)
//   motion_changeyby(DY) motion_sety(Y) motion_ifonedge | reporters: motion_xposition
//   motion_yposition motion_directionrep
// LOOKS: looks_sayforsecs(MSG,SECS) looks_say(MSG) looks_think(MSG)
//   looks_switchcostume(field COSTUME) looks_nextcostume looks_changesize(DSIZE)
//   looks_setsize(SIZE) looks_seteffect(EFFECT,VAL) looks_show looks_hide | looks_size
// CONTROL: control_wait(SECS) control_repeat(TIMES,DO) control_forever(DO)
//   control_if(COND,DO) control_if_else(COND,DO,ELSE) control_repeat_until(COND,DO)
//   control_wait_until(COND) control_stop(field WHAT=all|this script)
// SENSING: sensing_touching(field TARGET) sensing_keypressed(field KEY)
//   sensing_mousedown sensing_mousex sensing_mousey sensing_distanceto(TARGET)
//   sensing_timer sensing_resettimer sensing_askandwait(Q) sensing_answer
// OPERATORS: operator_add/subtract/multiply/divide(A,B) operator_random(FROM,TO)
//   operator_lt/equals/gt(A,B) operator_and/or(A,B) operator_not(A)
//   operator_join(A,B) operator_mod(A,B) operator_round(A)
// VARIABLES: data_setvariableto(field VAR, VALUE) data_changevariableby(field VAR, VALUE)
//   data_variable(field VAR) data_showvariable/hidevariable(field VAR)
// LITERAL shadows: math_number_bf(field NUM)  text_bf(field TEXT)

// WORKFLOW: Claude writes this JSON into BlockForge/projects/<name>.bfproject.json.
// The user clicks "Open Project", edits blocks/sprites by hand, then "Save Project"
// to export an updated JSON back to Claude for the next iteration.`;

function openClaudeModal(){ el('schema-preview').textContent=SCHEMA_TEXT; el('claude-modal').classList.remove('hidden'); }

/* ============================================================
   LIVE BRIDGE CLIENT  (talks to bridge/server.js over SSE)
   ============================================================ */
function setBridge(on){
  BF._bridgeOn = on;
  const b = el('bridge-status');
  b.className = 'bridge-status ' + (on?'on':'off');
  b.textContent = on ? '● live' : '● offline';
}
function flashBridge(){ const b=el('bridge-status'); b.classList.add('flash'); setTimeout(()=>b.classList.remove('flash'),600); }

let _stateTimer;
function pushState(){
  if(!BF._bridgeOn || !BF.project) return;
  clearTimeout(_stateTimer);
  _stateTimer = setTimeout(()=>{
    try{ fetch('/state',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(collectProject())}).catch(()=>{}); }catch(e){}
  }, 450);
}

function targetByName(name){
  if(!name || name==='Stage') return BF.project.stage;
  return BF.project.sprites.find(s=>s.name===name);
}
function preloadTarget(t){
  BF.imageMap[t.name] = BF.imageMap[t.name] || {};
  (t.costumes||[]).forEach(c=>{ const img=new Image(); img.onload=()=>BF.vm&&BF.vm.render(); img.src=c.src; BF.imageMap[t.name][c.name]=img; });
}
function reloadWorkspace(){
  Blockly.Events.disable(); BF.workspace.clear();
  if(BF.current.blocks && BF.current.blocks.blocks){
    try{ Blockly.serialization.workspaces.load(BF.current.blocks, BF.workspace); }catch(e){ console.warn(e); }
  }
  ensureVariables(BF.workspace); Blockly.Events.enable();
}

function applyCommand(cmd){
  if(!cmd || !cmd.action || cmd.action[0]==='_') return;
  switch(cmd.action){
    case 'loadProject': loadProject(cmd.project); break;

    case 'addSprite': {
      const s = cmd.sprite; if(!s) break;
      s.x=s.x||0; s.y=s.y||0; s.direction=s.direction==null?90:s.direction;
      s.size=s.size==null?100:s.size; s.visible=s.visible!==false;
      s.costumes = s.costumes&&s.costumes.length?s.costumes:[{name:'body',src:svgURL(SVG.ball('#ff5470'))}];
      s.currentCostume=s.currentCostume||0;
      // unique name
      let base=s.name||'Sprite', n=base, i=2; while(BF.project.sprites.find(x=>x.name===n)) n=base+i++; s.name=n;
      BF.project.sprites.push(s); preloadTarget(s);
      selectTarget(s); BF.vm.load(BF.project, BF.imageMap);
      toast('⚡ Claude added '+s.name); break;
    }
    case 'updateSprite': {
      const t=targetByName(cmd.name); if(!t) break;
      Object.assign(t, cmd.props||{});
      if(cmd.props && cmd.props.costumes) preloadTarget(t);
      if(t===BF.current) renderInspector();
      refreshLive(); toast('⚡ Updated '+t.name); break;
    }
    case 'deleteSprite': {
      const i=BF.project.sprites.findIndex(s=>s.name===cmd.name);
      if(i>=0){ const was=BF.project.sprites[i]; BF.project.sprites.splice(i,1);
        if(BF.current===was) selectTarget(BF.project.sprites[0]||BF.project.stage);
        BF.vm.load(BF.project, BF.imageMap); } break;
    }
    case 'setScript': {
      const t=targetByName(cmd.target); if(!t) break;
      t.blocks = cmd.blocks;
      if(t===BF.current) reloadWorkspace();
      if(!BF.vm.running) BF.vm.load(BF.project, BF.imageMap);
      toast('⚡ Claude wrote a script for '+t.name); break;
    }
    case 'addScript': {
      const t=targetByName(cmd.target); if(!t) break;
      if(!t.blocks || !t.blocks.blocks) t.blocks={blocks:{languageVersion:0,blocks:[]}};
      t.blocks.blocks.blocks = t.blocks.blocks.blocks || [];
      t.blocks.blocks.blocks.push(cmd.hat);
      if(cmd.variables){ t.blocks.variables=(t.blocks.variables||[]).concat(cmd.variables); }
      if(t===BF.current) reloadWorkspace();
      if(!BF.vm.running) BF.vm.load(BF.project, BF.imageMap);
      toast('⚡ Claude added a script to '+t.name); break;
    }
    case 'addVariable': {
      if(!BF.project.variables.find(v=>v.name===cmd.name))
        BF.project.variables.push({name:cmd.name, value:cmd.value||0, visible:!!cmd.visible});
      ensureVariables(BF.workspace); BF.workspace.refreshToolboxSelection();
      if(!BF.vm.running) BF.vm.load(BF.project, BF.imageMap); break;
    }
    case 'select': { const t=targetByName(cmd.target); if(t) selectTarget(t); break; }
    case 'run': greenFlag(); break;
    case 'stop': stopAll(); break;
    case 'toast': toast(cmd.msg||''); break;
    default: break;
  }
  flashBridge();
  pushState();
}

function initBridge(){
  if(!/^https?:/.test(location.protocol)){ setBridge(false); return; }
  let es;
  const connect=()=>{
    try{ es = new EventSource('/events'); }catch(e){ setBridge(false); return; }
    es.onopen = ()=>{ setBridge(true); pushState(); };
    es.onerror = ()=>{ setBridge(false); };          // EventSource auto-reconnects
    es.onmessage = (ev)=>{ let cmd; try{ cmd=JSON.parse(ev.data); }catch(e){ return; } applyCommand(cmd); };
  };
  connect();
  setInterval(()=>{ if(BF._bridgeOn) pushState(); }, 4000);
}

/* ============================================================
   WIRING
   ============================================================ */
function toast(msg){ const t=el('toast'); t.textContent=msg; t.classList.remove('hidden');
  clearTimeout(toast._t); toast._t=setTimeout(()=>t.classList.add('hidden'),2600); }

function bindTabs(){
  document.querySelectorAll('.tab').forEach(tab=>{
    tab.onclick=()=>{
      document.querySelectorAll('.tab').forEach(t=>t.classList.remove('active'));
      tab.classList.add('active');
      const which=tab.dataset.tab;
      el('blockly-area').classList.toggle('active', which==='code');
      el('costumes-panel').classList.toggle('active', which==='costumes');
      el('sounds-panel').classList.toggle('active', which==='sounds');
      if(which==='code') Blockly.svgResize(BF.workspace);
    };
  });
}
function bindSampleMenu(){
  const menu=el('sample-menu');
  Object.keys(EXAMPLES).forEach(name=>{
    const b=document.createElement('button'); b.textContent=name;
    b.onclick=()=>{ loadProject(EXAMPLES[name]()); menu.classList.add('hidden'); };
    menu.appendChild(b);
  });
  el('btn-load-sample').onclick=(e)=>{ e.stopPropagation(); menu.classList.toggle('hidden'); };
  document.addEventListener('click',()=>menu.classList.add('hidden'));
}

function init(){
  initBlockly();
  BF.vm = new VM(el('stage'));
  bindTabs(); bindInspector(); bindInput(); bindAsk(); bindSampleMenu(); initBridge();

  el('btn-green-flag').onclick=greenFlag;
  el('btn-stop').onclick=stopAll;
  el('btn-new').onclick=()=>loadProject(defaultProject());
  el('btn-export').onclick=exportProject;
  el('btn-import').onclick=()=>el('file-input').click();
  el('file-input').onchange=e=>{ const f=e.target.files[0]; if(!f) return;
    const r=new FileReader(); r.onload=()=>{ try{ loadProject(JSON.parse(r.result)); }catch(err){ toast('Bad project file'); } }; r.readAsText(f);
    e.target.value=''; };
  el('btn-add-sprite').onclick=addSprite;
  el('btn-claude').onclick=openClaudeModal;
  document.querySelectorAll('[data-close]').forEach(b=>b.onclick=()=>el('claude-modal').classList.add('hidden'));
  el('btn-copy-schema').onclick=()=>{ navigator.clipboard.writeText(SCHEMA_TEXT).then(()=>toast('Schema copied — paste to Claude')); };
  el('btn-fullstage').onclick=()=>document.body.classList.toggle('big-stage');

  // deep-link: index.html?project=pong  -> loads projects/pong.bfproject.json
  const wanted = new URLSearchParams(location.search).get('project');
  if(wanted){
    fetch('projects/'+wanted+'.bfproject.json')
      .then(r=>r.ok?r.json():Promise.reject())
      .then(p=>loadProject(p))
      .catch(()=>{ toast('Could not load project: '+wanted); loadProject(defaultProject()); });
  } else {
    loadProject(defaultProject());
  }
  tickFps();
}

// exposed for the Claude bridge / embedding
window.loadProject = loadProject;

window.addEventListener('DOMContentLoaded', init);
