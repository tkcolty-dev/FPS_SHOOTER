/* ============================================================
   forge.js — Claude's authoring toolkit for the live bridge
   Build Scratch-style block trees, push them into the open editor.

   Usage in a node script:
     const F = require('./bridge/forge');
     await F.push({ action:'addSprite', sprite: F.sprite('Enemy', {...}) });
     const state = await F.getState();   // the user's live project
   ============================================================ */
const http = require('http');
const PORT = process.env.BF_PORT || 4321;

let _n = 0;
const nid = () => 'b' + (_n++) + Math.random().toString(36).slice(2,5);

/* ---- block builders ---- */
const B    = (type, o={}) => ({ type, id:nid(),
  ...(o.fields?{fields:o.fields}:{}), ...(o.inputs?{inputs:o.inputs}:{}) });
const chain = (...bs) => { bs = bs.filter(Boolean);
  for(let i=0;i<bs.length-1;i++) bs[i].next = { block:bs[i+1] }; return bs[0]; };
const sub  = b => ({ block:b });                  // C-block body / reporter into a slot
const rep  = b => ({ block:b });
const sNum = v => ({ shadow:{ type:'math_number_bf', id:nid(), fields:{NUM:v} } });
const sTxt = t => ({ shadow:{ type:'text_bf', id:nid(), fields:{TEXT:t} } });
const vref = id => ({ id });                      // variable field value

/* wrap one or more hat trees into a target's blocks object.
   NOTE: Blockly serialization puts `variables` at the TOP level, a sibling of `blocks`. */
const scripts = (hats, variables) => ({
  blocks: { languageVersion:0, blocks:[].concat(hats) },
  ...(variables ? { variables } : {})
});

/* ---- costumes ---- */
const svg = s => 'data:image/svg+xml;utf8,' + encodeURIComponent(s);
const shapes = {
  ball:   (c='#ff5470') => svg(`<svg xmlns="http://www.w3.org/2000/svg" width="40" height="40"><circle cx="20" cy="20" r="18" fill="${c}"/><circle cx="14" cy="14" r="5" fill="#fff" opacity=".5"/></svg>`),
  square: (c='#4C97FF') => svg(`<svg xmlns="http://www.w3.org/2000/svg" width="40" height="40"><rect x="2" y="2" width="36" height="36" rx="7" fill="${c}"/></svg>`),
  paddle: (c='#4C97FF') => svg(`<svg xmlns="http://www.w3.org/2000/svg" width="96" height="18"><rect x="1" y="1" width="94" height="16" rx="8" fill="${c}"/></svg>`),
  star:   (c='#FFBF00') => svg(`<svg xmlns="http://www.w3.org/2000/svg" width="44" height="44"><path d="M22 3l6 12 13 2-9.5 9 2 13L22 34 10.5 41l2-13L3 17l13-2z" fill="${c}"/></svg>`),
  triangle:(c='#59C059')=> svg(`<svg xmlns="http://www.w3.org/2000/svg" width="40" height="40"><path d="M20 2 38 36 2 36z" fill="${c}"/></svg>`)
};

/* ---- sprite helper ---- */
const sprite = (name, o={}) => ({
  name,
  x:o.x||0, y:o.y||0, direction:o.direction==null?90:o.direction,
  size:o.size==null?100:o.size, visible:o.visible!==false,
  costumes: o.costumes || [{ name:'body', src:(o.shape||shapes.ball)(o.color) }],
  currentCostume: o.currentCostume||0,
  blocks: o.blocks || null
});

/* ---- HTTP to the bridge server ---- */
function req(method, p, body){
  return new Promise((resolve,reject)=>{
    const data = body ? JSON.stringify(body) : null;
    const r = http.request({ host:'localhost', port:PORT, path:p, method,
      headers:{ 'Content-Type':'application/json',
        ...(data?{'Content-Length':Buffer.byteLength(data)}:{}) } },
      res=>{ let b=''; res.on('data',c=>b+=c); res.on('end',()=>{ try{ resolve(b?JSON.parse(b):null); }catch(e){ resolve(b); } }); });
    r.on('error', reject);
    if(data) r.write(data); r.end();
  });
}
const push     = action => req('POST','/push', action);
const getState = ()     => req('GET','/state');
const status   = ()     => req('GET','/bridge');

/* high-level convenience actions */
const actions = {
  load:        project        => push({ action:'loadProject', project }),
  addSprite:   spr            => push({ action:'addSprite', sprite:spr }),
  updateSprite:(name, props)  => push({ action:'updateSprite', name, props }),
  deleteSprite:name           => push({ action:'deleteSprite', name }),
  setScript:  (target, blocks)=> push({ action:'setScript', target, blocks }),
  addScript:  (target, hat, variables) => push({ action:'addScript', target, hat, variables }),
  addVariable:(name, o={})    => push({ action:'addVariable', name, value:o.value||0, visible:!!o.visible }),
  select:      target         => push({ action:'select', target }),
  run:         ()             => push({ action:'run' }),
  stop:        ()             => push({ action:'stop' }),
  toast:       msg            => push({ action:'toast', msg })
};

module.exports = { B, chain, sub, rep, sNum, sTxt, vref, scripts, svg, shapes,
  sprite, nid, push, getState, status, ...actions };
