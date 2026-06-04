#!/usr/bin/env node
/* ============================================================
   compile.js — BlockForge-Script (BFS) → Blockly blocks
   Write games in compact code; this converts to real editable
   Scratch blocks and pushes them live into the editor.

   Usage:  node bridge/compile.js path/to/game.bfs   [--no-run]
   ============================================================ */
const fs = require('fs');
const F  = require('./forge');
const { B } = F;

let _id = 0; const nid = () => 'c' + (_id++);
const vref = name => ({ id: 'v_' + name });

/* ---------- costume / backdrop library ---------- */
const svg = s => 'data:image/svg+xml;utf8,' + encodeURIComponent(s);
const LIB = {
  ball:    c => svg(`<svg xmlns="http://www.w3.org/2000/svg" width="40" height="40"><circle cx="20" cy="20" r="18" fill="${c||'#ff5470'}"/><circle cx="14" cy="14" r="5" fill="#fff" opacity=".5"/></svg>`),
  square:  c => svg(`<svg xmlns="http://www.w3.org/2000/svg" width="40" height="40"><rect x="2" y="2" width="36" height="36" rx="7" fill="${c||'#4C97FF'}"/></svg>`),
  paddle:  c => svg(`<svg xmlns="http://www.w3.org/2000/svg" width="96" height="18"><rect x="1" y="1" width="94" height="16" rx="8" fill="${c||'#4C97FF'}"/></svg>`),
  star:    c => svg(`<svg xmlns="http://www.w3.org/2000/svg" width="44" height="44"><path d="M22 3l6 12 13 2-9.5 9 2 13L22 34 10.5 41l2-13L3 17l13-2z" fill="${c||'#FFBF00'}"/></svg>`),
  triangle:c => svg(`<svg xmlns="http://www.w3.org/2000/svg" width="40" height="40"><path d="M20 2 38 36 2 36z" fill="${c||'#59C059'}"/></svg>`),
  bullet:  c => svg(`<svg xmlns="http://www.w3.org/2000/svg" width="8" height="18"><rect x="1" y="1" width="6" height="16" rx="3" fill="${c||'#ffd84d'}"/></svg>`),
  coin:    c => svg(`<svg xmlns="http://www.w3.org/2000/svg" width="34" height="34"><circle cx="17" cy="17" r="15" fill="${c||'#ffcf33'}"/><circle cx="17" cy="17" r="10" fill="#ffe680"/></svg>`),
  rocket:  c => svg(`<svg xmlns="http://www.w3.org/2000/svg" width="38" height="46"><path d="M19 2 C28 12 30 26 28 40 L10 40 C8 26 10 12 19 2 Z" fill="${c||'#5cb1d6'}"/><circle cx="19" cy="20" r="5" fill="#bfe9ff"/><path d="M10 36 L3 46 L12 42 Z" fill="#ff8c1a"/><path d="M28 36 L35 46 L26 42 Z" fill="#ff8c1a"/><path d="M14 42 q5 8 10 0" fill="#ffd84d"/></svg>`),
  alien:   c => svg(`<svg xmlns="http://www.w3.org/2000/svg" width="42" height="36"><ellipse cx="21" cy="18" rx="18" ry="14" fill="${c||'#9966ff'}"/><circle cx="14" cy="16" r="4" fill="#fff"/><circle cx="28" cy="16" r="4" fill="#fff"/><circle cx="14" cy="16" r="2" fill="#222"/><circle cx="28" cy="16" r="2" fill="#222"/><path d="M6 30 l4 5 4-5 4 5 4-5 4 5 4-5" stroke="${c||'#9966ff'}" stroke-width="3" fill="none"/></svg>`),
  rock:    c => svg(`<svg xmlns="http://www.w3.org/2000/svg" width="34" height="34"><path d="M17 2 L28 7 L32 18 L26 30 L13 32 L3 24 L2 11 Z" fill="${c||'#9aa4b8'}"/><circle cx="13" cy="14" r="3" fill="#00000030"/><circle cx="22" cy="20" r="2.5" fill="#00000030"/></svg>`),
  space:   () => svg(`<svg xmlns="http://www.w3.org/2000/svg" width="480" height="360"><defs><radialGradient id="g" cx="50%" cy="30%" r="80%"><stop offset="0%" stop-color="#1a1f3a"/><stop offset="100%" stop-color="#05060f"/></radialGradient></defs><rect width="480" height="360" fill="url(#g)"/>${Array.from({length:70}).map((_,i)=>{const x=(i*97)%480,y=(i*53)%360,r=(i%3)?0.8:1.6;return `<circle cx="${x}" cy="${y}" r="${r}" fill="#fff" opacity="${0.4+(i%5)/8}"/>`}).join('')}</svg>`),
  grass:   () => svg(`<svg xmlns="http://www.w3.org/2000/svg" width="480" height="360"><rect width="480" height="360" fill="#7ec850"/><rect y="300" width="480" height="60" fill="#5fa83c"/></svg>`),
  night:   () => svg(`<svg xmlns="http://www.w3.org/2000/svg" width="480" height="360"><rect width="480" height="360" fill="#0e1430"/></svg>`),
  sky:     () => svg(`<svg xmlns="http://www.w3.org/2000/svg" width="480" height="360"><defs><linearGradient id="s" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stop-color="#7ec8ff"/><stop offset="100%" stop-color="#cdeeff"/></linearGradient></defs><rect width="480" height="360" fill="url(#s)"/><circle cx="410" cy="60" r="34" fill="#fff4b0"/><ellipse cx="120" cy="80" rx="46" ry="20" fill="#ffffff" opacity=".85"/><ellipse cx="160" cy="92" rx="38" ry="16" fill="#ffffff" opacity=".85"/><path d="M0 300 Q120 250 240 300 T480 300 L480 360 L0 360Z" fill="#8fd06a"/><path d="M0 330 Q160 290 320 330 T480 330 L480 360 L0 360Z" fill="#73b84e"/></svg>`),
  hero:    c => svg(`<svg xmlns="http://www.w3.org/2000/svg" width="30" height="42"><rect x="8" y="2" width="14" height="13" rx="4" fill="#ffd9a8"/><rect x="9" y="13" width="12" height="16" rx="3" fill="${c||'#4C97FF'}"/><rect x="6" y="14" width="4" height="12" rx="2" fill="${c||'#4C97FF'}"/><rect x="20" y="14" width="4" height="12" rx="2" fill="${c||'#4C97FF'}"/><rect x="10" y="29" width="4" height="11" rx="2" fill="#3a4a6a"/><rect x="16" y="29" width="4" height="11" rx="2" fill="#3a4a6a"/><circle cx="13" cy="8" r="1.4" fill="#222"/><circle cx="18" cy="8" r="1.4" fill="#222"/></svg>`),
  slime:   c => svg(`<svg xmlns="http://www.w3.org/2000/svg" width="40" height="30"><path d="M2 28 Q2 8 20 6 Q38 8 38 28 Z" fill="${c||'#59c059'}"/><circle cx="14" cy="18" r="4" fill="#fff"/><circle cx="26" cy="18" r="4" fill="#fff"/><circle cx="14" cy="19" r="2" fill="#222"/><circle cx="26" cy="19" r="2" fill="#222"/></svg>`),
  ground:  c => svg(`<svg xmlns="http://www.w3.org/2000/svg" width="480" height="44"><rect width="480" height="44" fill="${c||'#8a5a2b'}"/><rect width="480" height="12" fill="#6cae3e"/></svg>`),
  ledge:   c => svg(`<svg xmlns="http://www.w3.org/2000/svg" width="120" height="26"><rect width="120" height="26" rx="5" fill="${c||'#8a5a2b'}"/><rect width="120" height="8" rx="4" fill="#6cae3e"/></svg>`),
  door:    c => svg(`<svg xmlns="http://www.w3.org/2000/svg" width="44" height="62"><rect x="2" y="6" width="40" height="56" rx="18" fill="${c||'#5a3a1a'}"/><rect x="8" y="12" width="28" height="50" rx="13" fill="#7a5230"/><circle cx="31" cy="38" r="3" fill="#ffd84d"/></svg>`)
};

/* ============================================================
   value / expression nodes
   ============================================================ */
const isLit = n => n && (n.__num !== undefined || n.__str !== undefined);
function asInput(n){
  if(n.__num !== undefined) return { shadow:{ type:'math_number_bf', id:nid(), fields:{NUM:n.__num} } };
  if(n.__str !== undefined) return { shadow:{ type:'text_bf', id:nid(), fields:{TEXT:n.__str} } };
  return { block:n };
}
const strOf = n => (n && n.__str !== undefined) ? n.__str : (n && n.__num!==undefined ? String(n.__num) : '');
const negate = n => n.__num !== undefined ? { __num:-n.__num }
  : B('operator_subtract', { inputs:{ A:asInput({__num:0}), B:asInput(n) } });

/* ---------- reporter (function-call) builders ---------- */
const REPORTERS = {
  xpos:()=>B('motion_xposition'), ypos:()=>B('motion_yposition'),
  direction:()=>B('motion_directionrep'), size:()=>B('looks_size'),
  timer:()=>B('sensing_timer'), answer:()=>B('sensing_answer'),
  mousex:()=>B('sensing_mousex'), mousey:()=>B('sensing_mousey'),
  mouseDown:()=>B('sensing_mousedown'),
  random:(a,b)=>B('operator_random',{inputs:{FROM:asInput(a),TO:asInput(b)}}),
  round:(a)=>B('operator_round',{inputs:{A:asInput(a)}}),
  abs:(a)=>B('operator_round',{inputs:{A:asInput(a)}}), // (no abs block; round as fallback)
  join:(a,b)=>B('operator_join',{inputs:{A:asInput(a),B:asInput(b)}}),
  distance:(a)=>B('sensing_distanceto',{fields:{TARGET:strOf(a)}}),
  keyPressed:(a)=>B('sensing_keypressed',{fields:{KEY:strOf(a)}}),
  touching:(a)=>B('sensing_touching',{fields:{TARGET:strOf(a)}})
};

/* ============================================================
   expression tokenizer + Pratt parser
   ============================================================ */
function tokenize(s){
  const t=[]; let i=0;
  const two = ['==','!=','>=','<=','&&','||'];
  while(i<s.length){
    const c=s[i];
    if(/\s/.test(c)){ i++; continue; }
    if(c==='"'){ let j=i+1,str=''; while(j<s.length&&s[j]!=='"'){str+=s[j++];} i=j+1; t.push({k:'str',v:str}); continue; }
    if(/[0-9]/.test(c) || (c==='.'&&/[0-9]/.test(s[i+1]))){ let n=''; while(i<s.length&&/[0-9.]/.test(s[i])) n+=s[i++]; t.push({k:'num',v:parseFloat(n)}); continue; }
    if(/[A-Za-z_]/.test(c)){ let id=''; while(i<s.length&&/[A-Za-z0-9_]/.test(s[i])) id+=s[i++]; t.push({k:'id',v:id}); continue; }
    const pair=s.substr(i,2);
    if(two.includes(pair)){ t.push({k:'op',v:pair}); i+=2; continue; }
    if('+-*/%<>!(),'.includes(c)){ t.push({k:'op',v:c}); i++; continue; }
    i++; // skip unknown
  }
  return t;
}
function parseExpr(str, ctx){
  const toks = tokenize(str); let p=0;
  const peek=()=>toks[p], next=()=>toks[p++];
  const PREC={'||':1,'&&':2,'==':3,'!=':3,'<':4,'>':4,'<=':4,'>=':4,'+':5,'-':5,'*':6,'/':6,'%':6};
  function primary(){
    const tk=next();
    if(!tk) return {__num:0};
    if(tk.k==='num') return {__num:tk.v};
    if(tk.k==='str') return {__str:tk.v};
    if(tk.k==='op' && tk.v==='('){ const e=expr(0); if(peek()&&peek().v===')') next(); return e; }
    if(tk.k==='op' && tk.v==='!'){ return B('operator_not',{inputs:{A:asInput(unary())}}); }
    if(tk.k==='op' && tk.v==='-'){ return negate(unary()); }
    if(tk.k==='id'){
      if(peek() && peek().v==='('){ // function call
        next(); const args=[];
        if(peek() && peek().v!==')'){ args.push(expr(0)); while(peek()&&peek().v===','){ next(); args.push(expr(0)); } }
        if(peek() && peek().v===')') next();
        const fn=REPORTERS[tk.v];
        if(!fn) throw new Error('unknown function: '+tk.v);
        return fn(...args);
      }
      // bare identifier -> variable
      ctx.vars.add(tk.v);
      return B('data_variable',{fields:{VAR:vref(tk.v)}});
    }
    return {__num:0};
  }
  function unary(){ return primary(); }
  function binBlock(op,a,b){
    switch(op){
      case '+': return B('operator_add',{inputs:{A:asInput(a),B:asInput(b)}});
      case '-': return B('operator_subtract',{inputs:{A:asInput(a),B:asInput(b)}});
      case '*': return B('operator_multiply',{inputs:{A:asInput(a),B:asInput(b)}});
      case '/': return B('operator_divide',{inputs:{A:asInput(a),B:asInput(b)}});
      case '%': return B('operator_mod',{inputs:{A:asInput(a),B:asInput(b)}});
      case '<': return B('operator_lt',{inputs:{A:asInput(a),B:asInput(b)}});
      case '>': return B('operator_gt',{inputs:{A:asInput(a),B:asInput(b)}});
      case '==':return B('operator_equals',{inputs:{A:asInput(a),B:asInput(b)}});
      case '!=':return B('operator_not',{inputs:{A:asInput(B('operator_equals',{inputs:{A:asInput(a),B:asInput(b)}}))}});
      case '>=':return B('operator_not',{inputs:{A:asInput(B('operator_lt',{inputs:{A:asInput(a),B:asInput(b)}}))}});
      case '<=':return B('operator_not',{inputs:{A:asInput(B('operator_gt',{inputs:{A:asInput(a),B:asInput(b)}}))}});
      case '&&':return B('operator_and',{inputs:{A:asInput(a),B:asInput(b)}});
      case '||':return B('operator_or',{inputs:{A:asInput(a),B:asInput(b)}});
    }
  }
  function expr(min){
    let left=unary();
    while(peek() && peek().k==='op' && PREC[peek().v]!==undefined && PREC[peek().v]>=min){
      const op=next().v; const right=expr(PREC[op]+1); left=binBlock(op,left,right);
    }
    return left;
  }
  return expr(0);
}

/* ============================================================
   statement compiler
   ============================================================ */
function splitTop(s){ // split args on top-level commas
  const out=[]; let depth=0,cur='',q=false;
  for(const ch of s){
    if(ch==='"') q=!q;
    if(!q && (ch==='('||ch==='[')) depth++;
    if(!q && (ch===')'||ch===']')) depth--;
    if(!q && ch===',' && depth===0){ out.push(cur.trim()); cur=''; continue; }
    cur+=ch;
  }
  if(cur.trim()) out.push(cur.trim());
  return out;
}

const COMMANDS = {
  move:(a)=>B('motion_move',{inputs:{STEPS:asInput(a[0])}}),
  turnRight:(a)=>B('motion_turnright',{inputs:{DEG:asInput(a[0])}}),
  turnLeft:(a)=>B('motion_turnleft',{inputs:{DEG:asInput(a[0])}}),
  point:(a)=>B('motion_pointindirection',{inputs:{DIR:asInput(a[0])}}),
  goto:(a)=>B('motion_goto',{inputs:{X:asInput(a[0]),Y:asInput(a[1])}}),
  glide:(a)=>B('motion_glide',{inputs:{SECS:asInput(a[0]),X:asInput(a[1]),Y:asInput(a[2])}}),
  changeX:(a)=>B('motion_changexby',{inputs:{DX:asInput(a[0])}}),
  setx:(a)=>B('motion_setx',{inputs:{X:asInput(a[0])}}),
  changeY:(a)=>B('motion_changeyby',{inputs:{DY:asInput(a[0])}}),
  sety:(a)=>B('motion_sety',{inputs:{Y:asInput(a[0])}}),
  ifEdgeBounce:()=>B('motion_ifonedge'),
  say:(a)=> a.length>1 ? B('looks_sayforsecs',{inputs:{MSG:asInput(a[0]),SECS:asInput(a[1])}})
                       : B('looks_say',{inputs:{MSG:asInput(a[0])}}),
  think:(a)=>B('looks_think',{inputs:{MSG:asInput(a[0])}}),
  costume:(a)=>B('looks_switchcostume',{fields:{COSTUME:strOf(a[0])}}),
  nextCostume:()=>B('looks_nextcostume'),
  changeSize:(a)=>B('looks_changesize',{inputs:{DSIZE:asInput(a[0])}}),
  setSize:(a)=>B('looks_setsize',{inputs:{SIZE:asInput(a[0])}}),
  setEffect:(a)=>B('looks_seteffect',{fields:{EFFECT:strOf(a[0])},inputs:{VAL:asInput(a[1])}}),
  changeEffect:(a)=>B('looks_changeeffect',{fields:{EFFECT:strOf(a[0])},inputs:{VAL:asInput(a[1])}}),
  clearEffects:()=>B('looks_cleareffects'),
  show:()=>B('looks_show'), hide:()=>B('looks_hide'), goToFront:()=>B('looks_gotofront'),
  wait:(a)=>B('control_wait',{inputs:{SECS:asInput(a[0])}}),
  stopAll:()=>B('control_stop',{fields:{WHAT:'all'}}),
  stopScript:()=>B('control_stop',{fields:{WHAT:'this script'}}),
  broadcast:(a)=>B('event_broadcast',{fields:{MSG:strOf(a[0])}}),
  waitUntil:(a,ctx,raw)=>B('control_wait_until',{inputs:{COND:asInput(parseExpr(raw,ctx))}}),
  resetTimer:()=>B('sensing_resettimer'),
  ask:(a)=>B('sensing_askandwait',{inputs:{Q:asInput(a[0])}}),
  showVar:(a)=>B('data_showvariable',{fields:{VAR:vref(strOf(a[0])||a[0].__id)}}),
  hideVar:(a)=>B('data_hidevariable',{fields:{VAR:vref(strOf(a[0])||a[0].__id)}})
};

function stack(children, ctx){
  const blocks=[];
  for(let i=0;i<children.length;i++){
    const node=children[i]; const line=node.line.trim();
    let blk=null;

    if(/^forever\s*:?$/.test(line)){
      blk=B('control_forever',{inputs:{DO:wrap(stack(node.children,ctx))}});
    } else if(/^repeat\s+(.+?)\s*:$/.test(line)){
      const m=line.match(/^repeat\s+(.+?)\s*:$/);
      blk=B('control_repeat',{inputs:{TIMES:asInput(parseExpr(m[1],ctx)),DO:wrap(stack(node.children,ctx))}});
    } else if(/^until\s+(.+?)\s*:$/.test(line)){
      const m=line.match(/^until\s+(.+?)\s*:$/);
      blk=B('control_repeat_until',{inputs:{COND:asInput(parseExpr(m[1],ctx)),DO:wrap(stack(node.children,ctx))}});
    } else if(/^if\s+(.+?)\s*:$/.test(line)){
      const m=line.match(/^if\s+(.+?)\s*:$/);
      const cond=asInput(parseExpr(m[1],ctx));
      const doStack=wrap(stack(node.children,ctx));
      const nxt=children[i+1];
      if(nxt && /^else\s*:?$/.test(nxt.line.trim())){
        blk=B('control_if_else',{inputs:{COND:cond,DO:doStack,ELSE:wrap(stack(nxt.children,ctx))}});
        i++; // consume else
      } else {
        blk=B('control_if',{inputs:{COND:cond,DO:doStack}});
      }
    } else if(/^else\s*:?$/.test(line)){
      continue; // handled with its if
    } else {
      blk=compileSimple(line,ctx);
    }
    if(blk) blocks.push(blk);
  }
  // chain
  for(let i=0;i<blocks.length-1;i++) blocks[i].next={block:blocks[i+1]};
  return blocks[0]||null;
}
function wrap(firstBlock){ return firstBlock?{block:firstBlock}:undefined; }

function compileSimple(line, ctx){
  // assignment:  name = expr  |  name += expr  |  name -= expr
  let m=line.match(/^([A-Za-z_]\w*)\s*(\+=|-=|=)(?!=)\s*(.+)$/);
  if(m){
    const name=m[1], op=m[2], val=parseExpr(m[3],ctx); ctx.vars.add(name);
    if(op==='=')  return B('data_setvariableto',{fields:{VAR:vref(name)},inputs:{VALUE:asInput(val)}});
    if(op==='+=') return B('data_changevariableby',{fields:{VAR:vref(name)},inputs:{VALUE:asInput(val)}});
    if(op==='-=') return B('data_changevariableby',{fields:{VAR:vref(name)},inputs:{VALUE:asInput(negate(val))}});
  }
  // command call:  name(args)
  m=line.match(/^([A-Za-z_]\w*)\s*\((.*)\)\s*$/);
  if(m){
    const name=m[1], raw=m[2];
    const args=splitTop(raw).map(a=>parseExpr(a,ctx));
    // showVar/hideVar take a bare variable name -> mark it
    if((name==='showVar'||name==='hideVar')){ const vn=splitTop(raw)[0]; ctx.vars.add(vn); return COMMANDS[name]([{__str:vn}]); }
    const fn=COMMANDS[name];
    if(!fn) throw new Error('unknown command: '+name+'  ('+line+')');
    return fn(args, ctx, raw);
  }
  throw new Error('cannot parse line: '+line);
}

/* ============================================================
   indentation parser
   ============================================================ */
function parseIndent(text){
  const raw=text.replace(/\r/g,'').split('\n')
    .map(l=>({ indent:l.match(/^ */)[0].length, line:l.trim(), rawHasContent:l.trim().length>0 }))
    .filter(l=>l.rawHasContent && !l.line.startsWith('#'));
  let idx=0;
  function build(minIndent){
    const nodes=[];
    while(idx<raw.length && raw[idx].indent>=minIndent){
      const cur=raw[idx]; idx++;
      const node={ line:cur.line, indent:cur.indent, children:[] };
      if(idx<raw.length && raw[idx].indent>cur.indent) node.children=build(raw[idx].indent);
      nodes.push(node);
    }
    return nodes;
  }
  return build(0);
}

/* ============================================================
   project assembler
   ============================================================ */
function compileText(text){
  const tree=parseIndent(text);
  const project={ name:'BFS Game', variables:[], stage:{name:'Stage',isStage:true,costumes:[],blocks:null}, sprites:[] };
  const monitors=new Set();
  const allVars=new Set();

  for(const node of tree){
    const line=node.line;
    if(line.startsWith('@name ')){ project.name=line.slice(6).trim(); continue; }
    if(line.startsWith('@show ')){ line.slice(6).trim().split(/\s+/).forEach(v=>monitors.add(v)); continue; }

    if(line.startsWith('stage')){
      const props=parseHeader(line.replace(/:$/,''));
      if(props.backdrop && LIB[props.backdrop]) project.stage.costumes=[{name:props.backdrop,src:LIB[props.backdrop]()}];
      const ctx={vars:new Set()};
      const hats=node.children.map(h=>compileHat(h,ctx)).filter(Boolean);
      if(hats.length) project.stage.blocks={ blocks:{languageVersion:0,blocks:hats}, variables:[...ctx.vars].map(v=>({name:v,id:'v_'+v})) };
      ctx.vars.forEach(v=>allVars.add(v));
      continue;
    }

    if(line.startsWith('sprite ')){
      const header=line.replace(/:$/,'').slice(7);
      const name=header.split(/\s+/)[0];
      const props=parseHeader(header.slice(name.length));
      const shape=props.costume||'square';
      const src=(LIB[shape]||LIB.square)(props.color);
      const ctx={vars:new Set()};
      const hats=node.children.map(h=>compileHat(h,ctx)).filter(Boolean);
      const spr={
        name, x:num(props.x,0), y:num(props.y,0), direction:num(props.dir,90),
        size:num(props.size,100), visible:props.visible!=='false',
        costumes:[{name:shape,src}], currentCostume:0,
        blocks:{ blocks:{languageVersion:0,blocks:hats}, variables:[...ctx.vars].map(v=>({name:v,id:'v_'+v})) }
      };
      project.sprites.push(spr);
      ctx.vars.forEach(v=>allVars.add(v));
    }
  }
  project.variables=[...allVars].map(v=>({name:v,value:0,visible:monitors.has(v)}));
  return project;
}
function num(v,d){ const n=parseFloat(v); return isNaN(n)?d:n; }
function parseHeader(s){
  const props={};
  (s.match(/(\w+)=("[^"]*"|\S+)/g)||[]).forEach(kv=>{ const i=kv.indexOf('='); props[kv.slice(0,i)]=kv.slice(i+1).replace(/^"|"$/g,''); });
  return props;
}
const HATS={
  flag:()=>B('event_whenflag'),
  clicked:()=>B('event_whenclicked')
};
function compileHat(node, ctx){
  const line=node.line.replace(/:$/,'').trim();
  let hat;
  let m;
  if(/^on\s+flag$/.test(line)) hat=B('event_whenflag');
  else if((m=line.match(/^on\s+key\s+"([^"]+)"$/))) hat=B('event_whenkey',{fields:{KEY:m[1]}});
  else if(/^on\s+clicked$/.test(line)) hat=B('event_whenclicked');
  else if((m=line.match(/^on\s+receive\s+"([^"]+)"$/))) hat=B('event_whenbroadcast',{fields:{MSG:m[1]}});
  else throw new Error('unknown hat: '+line);
  const body=stack(node.children,ctx);
  if(body) hat.next={block:body};
  return hat;
}

/* ============================================================
   CLI
   ============================================================ */
async function main(){
  const file=process.argv[2];
  if(!file){ console.error('usage: node bridge/compile.js game.bfs [--no-run]'); process.exit(1); }
  const text=fs.readFileSync(file,'utf8');
  let project;
  try{ project=compileText(text); }
  catch(e){ console.error('COMPILE ERROR:', e.message); process.exit(1); }
  console.log(`compiled "${project.name}": ${project.sprites.length} sprites, vars [${project.variables.map(v=>v.name).join(', ')}]`);
  const st=await F.status().catch(()=>null);
  if(!st || !st.browsers){ console.log('No editor connected (open http://localhost:4321). Project JSON:\n', JSON.stringify(project).length,'bytes'); return; }
  await F.load(project);
  await F.toast('⚙️ Compiled '+project.name+' from code → blocks');
  if(!process.argv.includes('--no-run')) await F.run();
  console.log('pushed live to', st.browsers, 'browser(s)');
}
if(require.main===module) main();
module.exports={ compileText, parseExpr, LIB };
