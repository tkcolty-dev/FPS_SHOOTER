/* ============================================================
   BlockForge VM — green-thread interpreter + stage renderer
   Walks Blockly block trees. Cooperative generators yield each
   frame so forever/repeat/wait behave like Scratch.
   ============================================================ */

const STAGE_W = 480, STAGE_H = 360;

function toNum(v){ const n = parseFloat(v); return isNaN(n) ? 0 : n; }
function toStr(v){ return v == null ? '' : String(v); }
function toBool(v){ return v === true || v === 'true' || (typeof v==='number' && v!==0); }

class RuntimeSprite {
  constructor(data){
    this.name = data.name;
    this.isStage = !!data.isStage;
    this.x = data.x||0; this.y = data.y||0;
    this.direction = data.direction==null?90:data.direction;
    this.size = data.size==null?100:data.size;
    this.visible = data.visible!==false;
    this.rotationStyle = data.rotationStyle||'all around';
    this.costumes = data.costumes||[];
    this.currentCostume = data.currentCostume||0;
    this.effects = { ghost:0, brightness:0, color:0 };
    this.sayText = ''; this.sayKind='say'; this.sayUntil=0;
    this.layer = data.layer||0;
    this.images = {}; // name -> HTMLImageElement (filled by app)
  }
  costumeImage(){
    const c = this.costumes[this.currentCostume];
    return c ? this.images[c.name] : null;
  }
  width(){ const im=this.costumeImage(); return (im?im.naturalWidth:40)*this.size/100; }
  height(){ const im=this.costumeImage(); return (im?im.naturalHeight:40)*this.size/100; }
  bbox(){
    const w=this.width(), h=this.height();
    return { l:this.x-w/2, r:this.x+w/2, t:this.y+h/2, b:this.y-h/2 };
  }
}

class VM {
  constructor(canvas){
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d');
    this.sprites = [];        // RuntimeSprite[]
    this.stage = null;        // RuntimeSprite (isStage)
    this.threads = [];
    this.running = false;
    this.vars = {};           // global variables {name:value}
    this.varConfig = {};      // {name:{visible,x,y}}
    this.timerStart = 0;
    this.input = { keys:{}, mouseX:0, mouseY:0, mouseDown:false };
    this.ask = null;          // {resolve} when waiting for an answer
    this.answer = '';
    this._fpsT = 0; this._fpsN = 0; this.fps = 0;
    this._raf = null;
    this.onAsk = null; this.onAskDone = null; this.onStop = null;
  }

  now(){ return performance.now()/1000; }

  /* ---- build runtime model from the authoring project ---- */
  load(project, imageMap){
    this.sprites = [];
    project.sprites.forEach((s,i)=>{
      const rs = new RuntimeSprite(s);
      rs.layer = i+1;
      rs.images = imageMap[s.name] || {};
      rs.blocks = s.blocks;
      this.sprites.push(rs);
    });
    const st = new RuntimeSprite(project.stage || {name:'Stage', isStage:true, costumes:[]});
    st.isStage = true; st.layer = 0;
    st.images = imageMap['Stage'] || {};
    st.blocks = (project.stage && project.stage.blocks) || null;
    this.stage = st;
    this.vars = {};
    this.varConfig = {};
    (project.variables||[]).forEach(v=>{
      this.vars[v.name] = v.value!==undefined?v.value:0;
      this.varConfig[v.name] = { visible:!!v.visible, x:v.x||5, y:v.y||5 };
    });
    this.render();
  }

  targets(){ return [this.stage, ...this.sprites]; }
  spriteByName(n){ if(n==='Stage')return this.stage; return this.sprites.find(s=>s.name===n); }

  /* ---- headless workspace per target, to read blocks ---- */
  buildWorkspaces(){
    this._ws = {};
    this.targets().forEach(t=>{
      const ws = new Blockly.Workspace();
      if (t.blocks && t.blocks.blocks){
        try { Blockly.serialization.workspaces.load(t.blocks, ws); }
        catch(e){ console.warn('block load failed for', t.name, e); }
      }
      this._ws[t.name] = ws;
      t.ws = ws;
    });
  }

  hats(type){
    const out=[];
    this.targets().forEach(t=>{
      if(!t.ws) return;
      t.ws.getTopBlocks(false).forEach(b=>{ if(b.type===type) out.push({block:b, target:t}); });
    });
    return out;
  }

  /* ============ EXECUTION ============ */
  greenFlag(){
    this.stopAll();
    // reset sprite state from authoring values is done by app via reload before greenFlag
    this.buildWorkspaces();
    this.timerStart = this.now();
    this.threads = [];
    this.hats('event_whenflag').forEach(h=> this.startThread(h.block.getNextBlock(), h.target));
    this.start();
  }

  whenKey(keyName){
    this.hats('event_whenkey').forEach(h=>{
      const k = h.block.getFieldValue('KEY');
      if(k===keyName || k==='any') this.startThread(h.block.getNextBlock(), h.target);
    });
  }
  whenClicked(target){
    this.hats('event_whenclicked').forEach(h=>{
      if(h.target===target) this.startThread(h.block.getNextBlock(), h.target);
    });
  }
  broadcast(msg){
    this.hats('event_whenbroadcast').forEach(h=>{
      if(h.block.getFieldValue('MSG')===msg) this.startThread(h.block.getNextBlock(), h.target);
    });
  }

  startThread(firstBlock, target){
    if(!firstBlock) return;
    const gen = this.execStack(firstBlock, target);
    this.threads.push({ gen, target, done:false });
  }

  start(){
    if(this.running) return;
    this.running = true;
    const loop = ()=>{
      if(!this.running) return;
      this.step();
      this.render();
      this._raf = requestAnimationFrame(loop);
    };
    this._raf = requestAnimationFrame(loop);
  }
  stopAll(){
    this.running = false;
    if(this._raf) cancelAnimationFrame(this._raf);
    this.threads = [];
    if(this.ask){ this.ask = null; if(this.onAskDone) this.onAskDone(); }
    if(this.onStop) this.onStop();
  }

  step(){
    // fps
    const t = this.now();
    this._fpsN++;
    if(t - this._fpsT > 0.5){ this.fps = Math.round(this._fpsN/(t-this._fpsT)); this._fpsT=t; this._fpsN=0; }
    if(this.ask) return; // paused for input
    const next=[];
    for(const th of this.threads){
      if(th.done) continue;
      let guard=0;
      // run this thread until it yields a frame boundary (or finishes)
      try{
        while(true){
          const r = th.gen.next();
          if(r.done){ th.done=true; break; }
          if(r.value === 'frame') break;       // pause until next frame
          if(r.value === 'ask') { return; }     // ask pauses whole VM (set this.ask)
          if(++guard > 100000){ th.done=true; break; } // runaway guard
        }
      }catch(e){ console.error('thread error', e); th.done=true; }
      if(!th.done) next.push(th);
    }
    this.threads = next;
    if(this.threads.length===0 && this.running){ /* idle but keep rendering for inputs */ }
  }

  /* ---- execute a chain of statement blocks ---- */
  *execStack(block, sp){
    let b = block;
    while(b){
      yield* this.execBlock(b, sp);
      b = b.getNextBlock();
    }
  }

  input_val(block, name, sp){
    const t = block.getInputTargetBlock(name);
    if(!t) return '';
    return this.evalReporter(t, sp);
  }

  *execBlock(b, sp){
    switch(b.type){
      /* ---- MOTION ---- */
      case 'motion_move': {
        const steps = toNum(this.input_val(b,'STEPS',sp));
        const r = (sp.direction-90)*Math.PI/180;
        sp.x += steps*Math.cos(r); sp.y -= steps*Math.sin(r); break; }
      case 'motion_turnright': sp.direction = (sp.direction + toNum(this.input_val(b,'DEG',sp))); break;
      case 'motion_turnleft':  sp.direction = (sp.direction - toNum(this.input_val(b,'DEG',sp))); break;
      case 'motion_pointindirection': sp.direction = toNum(this.input_val(b,'DIR',sp)); break;
      case 'motion_goto': sp.x=toNum(this.input_val(b,'X',sp)); sp.y=toNum(this.input_val(b,'Y',sp)); break;
      case 'motion_changexby': sp.x += toNum(this.input_val(b,'DX',sp)); break;
      case 'motion_setx': sp.x = toNum(this.input_val(b,'X',sp)); break;
      case 'motion_changeyby': sp.y += toNum(this.input_val(b,'DY',sp)); break;
      case 'motion_sety': sp.y = toNum(this.input_val(b,'Y',sp)); break;
      case 'motion_glide': {
        const secs = Math.max(0,toNum(this.input_val(b,'SECS',sp)));
        const tx=toNum(this.input_val(b,'X',sp)), ty=toNum(this.input_val(b,'Y',sp));
        const sx=sp.x, sy=sp.y, t0=this.now();
        if(secs===0){ sp.x=tx; sp.y=ty; break; }
        while(true){ const f=(this.now()-t0)/secs; if(f>=1){ sp.x=tx; sp.y=ty; break; }
          sp.x=sx+(tx-sx)*f; sp.y=sy+(ty-sy)*f; yield 'frame'; }
        break; }
      case 'motion_ifonedge': this.ifOnEdgeBounce(sp); break;

      /* ---- LOOKS ---- */
      case 'looks_sayforsecs': {
        sp.sayText = toStr(this.input_val(b,'MSG',sp)); sp.sayKind='say';
        const secs = toNum(this.input_val(b,'SECS',sp)); const end=this.now()+secs;
        while(this.now()<end) yield 'frame';
        sp.sayText=''; break; }
      case 'looks_say': sp.sayText = toStr(this.input_val(b,'MSG',sp)); sp.sayKind='say'; break;
      case 'looks_think': sp.sayText = toStr(this.input_val(b,'MSG',sp)); sp.sayKind='think'; break;
      case 'looks_switchcostume': {
        const name=toStr(b.getFieldValue('COSTUME'));
        const idx=sp.costumes.findIndex(c=>c.name===name);
        if(idx>=0) sp.currentCostume=idx;
        else { const n=parseInt(name); if(!isNaN(n)&&sp.costumes[n-1]) sp.currentCostume=n-1; }
        break; }
      case 'looks_nextcostume': if(sp.costumes.length) sp.currentCostume=(sp.currentCostume+1)%sp.costumes.length; break;
      case 'looks_changesize': sp.size += toNum(this.input_val(b,'DSIZE',sp)); break;
      case 'looks_setsize': sp.size = toNum(this.input_val(b,'SIZE',sp)); break;
      case 'looks_seteffect': sp.effects[b.getFieldValue('EFFECT')] = toNum(this.input_val(b,'VAL',sp)); break;
      case 'looks_changeeffect': sp.effects[b.getFieldValue('EFFECT')] += toNum(this.input_val(b,'VAL',sp)); break;
      case 'looks_cleareffects': sp.effects={ghost:0,brightness:0,color:0}; break;
      case 'looks_show': sp.visible=true; break;
      case 'looks_hide': sp.visible=false; break;
      case 'looks_gotofront': { const max=Math.max(...this.sprites.map(s=>s.layer)); sp.layer=max+1; break; }

      /* ---- CONTROL ---- */
      case 'control_wait': {
        const end=this.now()+toNum(this.input_val(b,'SECS',sp));
        while(this.now()<end) yield 'frame'; break; }
      case 'control_repeat': {
        const n=Math.round(toNum(this.input_val(b,'TIMES',sp)));
        const body=b.getInputTargetBlock('DO');
        for(let i=0;i<n;i++){ yield* this.execStack(body,sp); yield 'frame'; } break; }
      case 'control_forever': {
        const body=b.getInputTargetBlock('DO');
        while(true){ yield* this.execStack(body,sp); yield 'frame'; } }
      case 'control_if': {
        if(toBool(this.input_val(b,'COND',sp))) yield* this.execStack(b.getInputTargetBlock('DO'),sp); break; }
      case 'control_if_else': {
        if(toBool(this.input_val(b,'COND',sp))) yield* this.execStack(b.getInputTargetBlock('DO'),sp);
        else yield* this.execStack(b.getInputTargetBlock('ELSE'),sp); break; }
      case 'control_repeat_until': {
        const body=b.getInputTargetBlock('DO');
        while(!toBool(this.input_val(b,'COND',sp))){ yield* this.execStack(body,sp); yield 'frame'; } break; }
      case 'control_wait_until': {
        while(!toBool(this.input_val(b,'COND',sp))) yield 'frame'; break; }
      case 'control_stop': {
        const what=b.getFieldValue('WHAT');
        if(what==='all'){ this.stopAll(); return; }
        if(what==='this script'){ return; }
        break; }

      /* ---- EVENTS ---- */
      case 'event_broadcast': this.broadcast(toStr(b.getFieldValue('MSG'))); break;

      /* ---- SENSING ---- */
      case 'sensing_resettimer': this.timerStart=this.now(); break;
      case 'sensing_askandwait': {
        const q = toStr(this.input_val(b,'Q',sp));
        if(this.onAsk) this.onAsk(q);
        yield* this.waitForAnswer(); break; }

      /* ---- VARIABLES ---- */
      case 'data_setvariableto': { const v=this.varName(b); this.vars[v]=this.input_val(b,'VALUE',sp); break; }
      case 'data_changevariableby': { const v=this.varName(b); this.vars[v]=toNum(this.vars[v])+toNum(this.input_val(b,'VALUE',sp)); break; }
      case 'data_showvariable': { const v=this.varName(b); (this.varConfig[v]=this.varConfig[v]||{x:5,y:5}).visible=true; break; }
      case 'data_hidevariable': { const v=this.varName(b); if(this.varConfig[v]) this.varConfig[v].visible=false; break; }

      default: /* unknown statement -> skip */ break;
    }
  }

  *waitForAnswer(){
    this.ask = {};
    while(this.ask) yield 'frame';
  }
  submitAnswer(text){
    this.answer = text; this.ask = null;
    if(this.onAskDone) this.onAskDone();
  }

  varName(b){
    const f=b.getField('VAR');
    return f ? f.getText() : (b.getFieldValue('VAR')||'');
  }

  /* ---- reporter evaluation (synchronous) ---- */
  evalReporter(b, sp){
    switch(b.type){
      case 'math_number_bf': return b.getFieldValue('NUM');
      case 'text_bf': return b.getFieldValue('TEXT');

      case 'motion_xposition': return sp.x;
      case 'motion_yposition': return sp.y;
      case 'motion_directionrep': return sp.direction;
      case 'looks_size': return sp.size;

      case 'operator_add': return toNum(this.input_val(b,'A',sp))+toNum(this.input_val(b,'B',sp));
      case 'operator_subtract': return toNum(this.input_val(b,'A',sp))-toNum(this.input_val(b,'B',sp));
      case 'operator_multiply': return toNum(this.input_val(b,'A',sp))*toNum(this.input_val(b,'B',sp));
      case 'operator_divide': return toNum(this.input_val(b,'A',sp))/toNum(this.input_val(b,'B',sp));
      case 'operator_random': { let a=toNum(this.input_val(b,'FROM',sp)), c=toNum(this.input_val(b,'TO',sp));
        if(a>c){const t=a;a=c;c=t;} const int=(a%1===0&&c%1===0);
        return int?Math.floor(Math.random()*(c-a+1))+a:Math.random()*(c-a)+a; }
      case 'operator_lt': return toNum(this.input_val(b,'A',sp))<toNum(this.input_val(b,'B',sp));
      case 'operator_gt': return toNum(this.input_val(b,'A',sp))>toNum(this.input_val(b,'B',sp));
      case 'operator_equals': { const a=this.input_val(b,'A',sp), c=this.input_val(b,'B',sp);
        const na=parseFloat(a), nc=parseFloat(c);
        if(!isNaN(na)&&!isNaN(nc)) return na===nc;
        return toStr(a).toLowerCase()===toStr(c).toLowerCase(); }
      case 'operator_and': return toBool(this.input_val(b,'A',sp))&&toBool(this.input_val(b,'B',sp));
      case 'operator_or': return toBool(this.input_val(b,'A',sp))||toBool(this.input_val(b,'B',sp));
      case 'operator_not': return !toBool(this.input_val(b,'A',sp));
      case 'operator_join': return toStr(this.input_val(b,'A',sp))+toStr(this.input_val(b,'B',sp));
      case 'operator_mod': { const a=toNum(this.input_val(b,'A',sp)), c=toNum(this.input_val(b,'B',sp)); return ((a%c)+c)%c; }
      case 'operator_round': return Math.round(toNum(this.input_val(b,'A',sp)));

      case 'sensing_touching': return this.touching(sp, b.getFieldValue('TARGET'));
      case 'sensing_keypressed': { const k=b.getFieldValue('KEY'); return k==='any'?Object.values(this.input.keys).some(Boolean):!!this.input.keys[k]; }
      case 'sensing_mousedown': return this.input.mouseDown;
      case 'sensing_mousex': return this.input.mouseX;
      case 'sensing_mousey': return this.input.mouseY;
      case 'sensing_timer': return Math.round((this.now()-this.timerStart)*10)/10;
      case 'sensing_answer': return this.answer;
      case 'sensing_distanceto': { const tgt=this.resolveTarget(sp,b.getFieldValue('TARGET'));
        if(!tgt) return 0; return Math.round(Math.hypot(tgt.x-sp.x, tgt.y-sp.y)); }

      case 'data_variable': { const v=this.varName(b); return this.vars[v]!==undefined?this.vars[v]:0; }
      default: return 0;
    }
  }

  resolveTarget(sp, name){
    if(name==='mouse-pointer') return { x:this.input.mouseX, y:this.input.mouseY };
    if(name==='edge') return null;
    return this.spriteByName(name);
  }
  touching(sp, target){
    const a=sp.bbox();
    if(target==='edge'){ return a.l<-STAGE_W/2||a.r>STAGE_W/2||a.t>STAGE_H/2||a.b<-STAGE_H/2; }
    if(target==='mouse-pointer'){ const mx=this.input.mouseX,my=this.input.mouseY; return mx>=a.l&&mx<=a.r&&my<=a.t&&my>=a.b; }
    const o=this.spriteByName(target); if(!o||!o.visible) return false;
    const c=o.bbox();
    return a.l<c.r&&a.r>c.l&&a.b<c.t&&a.t>c.b;
  }
  ifOnEdgeBounce(sp){
    const a=sp.bbox(); let dir=sp.direction; const r=(90-dir)*Math.PI/180;
    let dx=Math.sin(r*0+ (dir-90)*Math.PI/180); // unused fine
    let bounced=false;
    if(a.l<-STAGE_W/2){ sp.x+=(-STAGE_W/2-a.l); dir=180-dir; bounced=true; }
    else if(a.r>STAGE_W/2){ sp.x-=(a.r-STAGE_W/2); dir=180-dir; bounced=true; }
    if(a.t>STAGE_H/2){ sp.y-=(a.t-STAGE_H/2); dir=-dir; bounced=true; }
    else if(a.b<-STAGE_H/2){ sp.y+=(-STAGE_H/2-a.b); dir=-dir; bounced=true; }
    if(bounced) sp.direction=((dir%360)+360)%360;
  }

  /* ============ RENDER ============ */
  render(){
    const ctx=this.ctx;
    ctx.save();
    // backdrop
    const bg=this.stage && this.stage.costumeImage();
    if(bg){ ctx.drawImage(bg,0,0,STAGE_W,STAGE_H); }
    else { ctx.fillStyle='#ffffff'; ctx.fillRect(0,0,STAGE_W,STAGE_H); }
    // sprites by layer
    const order=[...this.sprites].sort((a,b)=>a.layer-b.layer);
    for(const sp of order){
      if(!sp.visible) continue;
      const im=sp.costumeImage();
      const cx=STAGE_W/2+sp.x, cy=STAGE_H/2-sp.y;
      ctx.save();
      ctx.translate(cx,cy);
      if(sp.rotationStyle==='all around') ctx.rotate((sp.direction-90)*Math.PI/180);
      else if(sp.rotationStyle==='left-right' && sp.direction>180) ctx.scale(-1,1);
      ctx.globalAlpha=Math.max(0,1-(sp.effects.ghost||0)/100);
      const w=(im?im.naturalWidth:40)*sp.size/100, h=(im?im.naturalHeight:40)*sp.size/100;
      if(im){ ctx.drawImage(im,-w/2,-h/2,w,h); }
      else { ctx.fillStyle='#4C97FF'; ctx.beginPath(); ctx.arc(0,0,20*sp.size/100,0,7); ctx.fill(); }
      ctx.restore();
      if(sp.sayText){ this.drawBubble(ctx, cx+w/2*0+ (im?im.naturalWidth:40)*sp.size/200, cy-h/2, sp.sayText, sp.sayKind); }
    }
    // variable monitors
    let vy=6;
    for(const name in this.varConfig){
      if(!this.varConfig[name].visible) continue;
      const val=this.vars[name];
      ctx.font='600 11px Inter, sans-serif';
      const label=`${name}  ${val}`;
      const w=ctx.measureText(label).width+18;
      ctx.fillStyle='rgba(20,25,40,.85)'; this.roundRect(ctx,6,vy,w,20,6); ctx.fill();
      ctx.fillStyle='#ffd84d'; ctx.textBaseline='middle';
      ctx.fillText(name+' ', 12, vy+10);
      const nameW=ctx.measureText(name+' ').width;
      ctx.fillStyle='#fff'; ctx.fillText(String(val), 12+nameW, vy+10);
      vy+=26;
    }
    ctx.restore();
  }
  drawBubble(ctx,x,y,text,kind){
    ctx.font='600 12px Inter, sans-serif';
    const maxW=150; const words=String(text).split(' '); let line='',lines=[];
    for(const w of words){ const t=line?line+' '+w:w; if(ctx.measureText(t).width>maxW&&line){lines.push(line);line=w;} else line=t; }
    if(line)lines.push(line);
    const bw=Math.min(maxW,Math.max(...lines.map(l=>ctx.measureText(l).width)))+18;
    const bh=lines.length*15+12;
    let bx=Math.min(x,STAGE_W-bw-4), by=Math.max(2,y-bh-8);
    ctx.fillStyle='#fff'; ctx.strokeStyle='#cbd2e0'; ctx.lineWidth=1;
    this.roundRect(ctx,bx,by,bw,bh,10); ctx.fill(); ctx.stroke();
    ctx.fillStyle='#2a2f3a'; ctx.textBaseline='top';
    lines.forEach((l,i)=>ctx.fillText(l,bx+9,by+7+i*15));
  }
  roundRect(ctx,x,y,w,h,r){ ctx.beginPath(); ctx.moveTo(x+r,y);
    ctx.arcTo(x+w,y,x+w,y+h,r); ctx.arcTo(x+w,y+h,x,y+h,r);
    ctx.arcTo(x,y+h,x,y,r); ctx.arcTo(x,y,x+w,y,r); ctx.closePath(); }
}

window.VM = VM;
