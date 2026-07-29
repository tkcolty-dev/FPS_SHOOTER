#!/usr/bin/env node
// Procedural block-model pipeline for Medieval RTS.
// Creates editable OBJ meshes and strict 90-degree orthographic PNG renders.
import fs from "node:fs/promises";
import path from "node:path";
import { createRequire } from "node:module";
const require = createRequire(import.meta.url);
const sharp = require("sharp");

const ROOT = path.resolve(import.meta.dirname, "..");
const OUT = path.join(ROOT, "client", "assets");
const MODELS = path.join(ROOT, "art", "models");
const C = {
  skin:"#cda46c", linen:"#c9b788", leather:"#705038", wood:"#865a30", wood2:"#b07a3e",
  steel:"#777d7d", steel2:"#a7aaaa", stone:"#9b988b", stone2:"#c3bda9",
  roof:"#934b38", roof2:"#b46044", straw:"#c69c3f", green:"#426a37", green2:"#63854a",
  dark:"#302922", ink:"#201c19", rock:"#77756e", purple:"#69446f", black:"#373a3a", moss:"#69744e"
};

const scenes = new Map();
function scene(name){ const s=[]; scenes.set(name,s); return s; }
function box(s,x,y,z,w,d,h,color,rot=0,name="box"){
  s.push({type:"box",x,y,z,w,d,h,color,rot,name});
}
function roof(s,x,y,z,w,d,h,color,rot=0,name="roof"){
  s.push({type:"roof",x,y,z,w,d,h,color,rot,name});
}
function disc(s,x,y,z,r,h,color,sides=8,name="disc"){
  s.push({type:"disc",x,y,z,r,h,color,sides,name});
}

function unitBase(kind){
  const s=scene(kind), a=Math.PI/4;
  // feet, legs, torso, arms, blank square head: all visible as top surfaces.
  box(s,-.22,.28,.12,.24,.34,.24,C.leather,a,"left_boot");
  box(s,.22,.28,.12,.24,.34,.24,C.leather,a,"right_boot");
  box(s,-.20,.03,.28,.25,.38,.30,kind==="knight"?C.steel:C.linen,a,"left_leg");
  box(s,.20,.03,.28,.25,.38,.30,kind==="knight"?C.steel:C.linen,a,"right_leg");
  box(s,0,-.22,.52,.62,.54,.42,kind==="builder"?C.linen:kind==="archer"?C.straw:C.steel,a,"torso");
  box(s,-.43,-.18,.48,.20,.55,.24,kind==="knight"?C.steel:C.skin,a,"left_arm");
  box(s,.43,-.18,.48,.20,.55,.24,kind==="knight"?C.steel:C.skin,a,"right_arm");
  box(s,0,-.61,.78,.42,.42,.38,kind==="builder"?C.skin:kind==="archer"?C.straw:C.steel,a,"head");
  if(kind==="builder"){
    box(s,-.60,-.02,.63,.12,.82,.12,C.wood,a,"hammer_handle");
    box(s,-.78,-.28,.72,.42,.20,.22,C.wood2,a,"hammer_head");
  } else if(kind==="swordsman"){
    box(s,.60,-.12,.68,.12,.86,.10,C.steel2,a,"sword_blade");
    box(s,.60,.30,.70,.32,.10,.12,C.wood,a,"sword_guard");
  } else if(kind==="archer"){
    // A compact angular bow readable from directly above.
    box(s,.58,-.25,.65,.09,.62,.10,C.wood2,a+.15,"bow_upper");
    box(s,.58,.20,.65,.09,.62,.10,C.wood2,a-.15,"bow_lower");
    box(s,.52,-.02,.67,.05,.82,.06,C.stone2,a,"bow_string");
  }
  return s;
}
unitBase("builder"); unitBase("swordsman"); unitBase("archer");

// Mounted knight: compact horse footprint with rider on top.
{
  const s=scene("knight"),a=Math.PI/4;
  box(s,0,.05,.35,.62,1.20,.48,C.wood,a,"horse_body");
  box(s,0,-.68,.45,.48,.48,.48,C.wood2,a,"horse_head");
  for(const [x,y] of [[-.28,.52],[.28,.52],[-.28,-.28],[.28,-.28]]) box(s,x,y,.12,.18,.36,.28,C.dark,a,"horse_leg");
  box(s,0,.05,.75,.42,.42,.38,C.steel,a,"rider_torso");
  box(s,0,-.25,1.02,.34,.34,.34,C.steel2,a,"rider_head");
  box(s,.45,-.18,.90,.10,1.25,.09,C.steel2,a,"lance");
}
// Catapult.
{
  const s=scene("catapult"),a=Math.PI/4;
  box(s,-.35,0,.22,.18,1.18,.20,C.wood,a,"left_rail"); box(s,.35,0,.22,.18,1.18,.20,C.wood,a,"right_rail");
  box(s,0,-.38,.30,.88,.16,.22,C.wood2,a,"crossbar"); box(s,0,.38,.30,.88,.16,.22,C.wood2,a,"crossbar");
  for(const [x,y] of [[-.48,-.38],[.48,-.38],[-.48,.38],[.48,.38]]) disc(s,x,y,.25,.22,.18,C.dark,10,"wheel");
  box(s,0,-.02,.60,.14,1.05,.15,C.wood2,a,"throw_arm"); box(s,0,-.52,.72,.42,.34,.18,C.wood,a,"cup");
  disc(s,0,-.52,.84,.13,.12,C.rock,8,"rock");
}

function simpleHall(name,roofColor=C.roof,mark=""){
  const s=scene(name);
  box(s,0,0,.32,1.35,1.10,.64,C.stone,0,"walls"); roof(s,0,0,.75,1.48,1.22,.42,roofColor,0,"roof");
  box(s,0,.48,.48,.34,.16,.34,C.wood,0,"door");
  if(mark==="swords"){box(s,-.12,.35,.92,.08,.42,.06,C.steel2,.65,"sword1");box(s,.12,.35,.93,.08,.42,.06,C.steel2,-.65,"sword2");}
  if(mark==="stall"){box(s,-.34,.39,.47,.34,.25,.30,C.dark,0,"stall1");box(s,.34,.39,.47,.34,.25,.30,C.dark,0,"stall2");}
  if(mark==="gear") disc(s,.43,.35,.85,.19,.07,C.wood2,8,"gear");
}
// Castle.
{
  const s=scene("castle");
  box(s,0,0,.30,1.55,1.55,.60,C.stone,0,"courtyard");
  for(const [x,y] of [[-.67,-.67],[.67,-.67],[-.67,.67],[.67,.67]]){
    box(s,x,y,.62,.48,.48,1.24,C.stone2,0,"tower");
    roof(s,x,y,1.30,.52,.52,.24,C.roof,0,"tower_roof");
  }
  box(s,0,-.58,.68,.72,.44,.78,C.stone,0,"keep"); roof(s,0,-.58,1.14,.78,.50,.28,C.roof2,0,"keep_roof");
  box(s,0,.76,.34,.34,.12,.40,C.wood,0,"gate");
}
// Windmill body.
{
  const s=scene("windmill");
  box(s,0,0,.42,.82,.82,.84,C.stone,0,"tower"); roof(s,0,0,.96,.94,.94,.36,C.roof,0,"roof");
  box(s,0,.38,.43,.24,.12,.34,C.wood,0,"door"); disc(s,0,.12,1.18,.09,.09,C.wood2,8,"axle");
}
simpleHall("barracks",C.roof,"swords");
simpleHall("stables",C.straw,"stall");
simpleHall("workshop",C.roof,"gear");
// Tower.
{
  const s=scene("tower"); box(s,0,0,.62,.72,.72,1.24,C.stone,0,"tower");
  roof(s,0,0,1.34,.84,.84,.38,C.roof,0,"roof"); box(s,0,.31,.61,.22,.11,.30,C.wood,0,"door");
}
// Windmill blades are a separate centered mesh/render.
{
  const s=scene("windmill_blades");
  disc(s,0,0,.12,.12,.12,C.wood2,10,"hub");
  for(let i=0;i<4;i++){ const a=i*Math.PI/2; box(s,Math.sin(a)*.42,Math.cos(a)*.42,.10,.14,.78,.10,C.straw,-a,"blade"); }
}
// Terrain props.
{
  const s=scene("farm"); box(s,0,0,.06,1.35,1.15,.12,C.wood,0,"field");
  for(let i=-3;i<=3;i++) box(s,i*.17,0,.13,.10,.98,.12,i%2?C.straw:C.wood2,0,"wheat_row");
}
for(let n=1;n<=3;n++){
  const s=scene(`tree_${n}`); box(s,0,0,.40,.22,.22,.80,C.wood,0,"trunk");
  const pts=n===1?[[-.22,0],[.22,0],[0,-.24],[0,.24]]:n===2?[[-.25,-.12],[.22,-.15],[-.12,.22],[.24,.20]]:[[-.24,0],[.18,-.22],[.22,.18],[0,.26]];
  for(const [x,y] of pts) disc(s,x,y,.84,.30,.34,n===3?C.green2:C.green,8,"foliage");
}
// Projectiles.
{const s=scene("arrow");box(s,0,0,.05,.70,.05,.06,C.wood,Math.PI/2,"shaft");box(s,.38,0,.06,.18,.12,.07,C.steel2,Math.PI/2,"head");}
{const s=scene("rock");disc(s,0,0,.12,.30,.24,C.rock,8,"rock");}

const shade=(hex,f)=>{
  const n=parseInt(hex.slice(1),16),r=n>>16,g=n>>8&255,b=n&255;
  return `rgb(${Math.max(0,Math.min(255,Math.round(r*f)))},${Math.max(0,Math.min(255,Math.round(g*f)))},${Math.max(0,Math.min(255,Math.round(b*f)))})`;
};
function rot2(x,y,a){return [x*Math.cos(a)-y*Math.sin(a),x*Math.sin(a)+y*Math.cos(a)];}
// 74° keeps the map-camera feel while leaving enough wall depth to read as 3D.
const ELEV=74*Math.PI/180;
function project3([x,y,z]){ return [x, y*Math.sin(ELEV)-z*Math.cos(ELEV)]; }
function meshPolys(o){
  if(o.type==="box"){
    const vs=[];
    for(const z of [o.z-o.h/2,o.z+o.h/2]) for(const [x,y] of [[-o.w/2,-o.d/2],[o.w/2,-o.d/2],[o.w/2,o.d/2],[-o.w/2,o.d/2]]){const q=rot2(x,y,o.rot);vs.push([q[0]+o.x,q[1]+o.y,z]);}
    const faces=[
      {i:[4,5,6,7],f:1.12},{i:[0,1,5,4],f:.78},{i:[1,2,6,5],f:.66},
      {i:[2,3,7,6],f:.74},{i:[3,0,4,7],f:.88}
    ];
    return faces.map(q=>({p:q.i.map(i=>project3(vs[i])),depth:q.i.reduce((n,i)=>n+vs[i][1]*Math.cos(ELEV)+vs[i][2]*Math.sin(ELEV),0)/4,color:shade(o.color,q.f)}));
  }
  if(o.type==="roof"){
    const raw=[[-o.w/2,-o.d/2,o.z],[o.w/2,-o.d/2,o.z],[o.w/2,o.d/2,o.z],[-o.w/2,o.d/2,o.z],[-o.w/2,0,o.z+o.h],[o.w/2,0,o.z+o.h]];
    const vs=raw.map(([x,y,z])=>{const r=rot2(x,y,o.rot);return [r[0]+o.x,r[1]+o.y,z];});
    const faces=[{i:[0,1,5,4],f:1.12},{i:[4,5,2,3],f:.78},{i:[0,4,3],f:.72},{i:[1,2,5],f:.62}];
    return faces.map(q=>({p:q.i.map(i=>project3(vs[i])),depth:q.i.reduce((n,i)=>n+vs[i][1]*Math.cos(ELEV)+vs[i][2]*Math.sin(ELEV),0)/q.i.length,color:shade(o.color,q.f)}));
  }
  const top=[],bottom=[]; for(let i=0;i<o.sides;i++){const a=i*Math.PI*2/o.sides;bottom.push([o.x+Math.cos(a)*o.r,o.y+Math.sin(a)*o.r,o.z-o.h/2]);top.push([o.x+Math.cos(a)*o.r,o.y+Math.sin(a)*o.r,o.z+o.h/2]);}
  const all=[...bottom,...top], faces=[{i:Array.from({length:o.sides},(_,i)=>o.sides+i),f:1.08}];
  for(let i=0;i<o.sides;i++)faces.push({i:[i,(i+1)%o.sides,o.sides+(i+1)%o.sides,o.sides+i],f:i<o.sides/2?.72:.86});
  return faces.map(q=>({p:q.i.map(i=>project3(all[i])),depth:q.i.reduce((n,i)=>n+all[i][1]*Math.cos(ELEV)+all[i][2]*Math.sin(ELEV),0)/q.i.length,color:shade(o.color,q.f)}));
}
function bounds(polys){const pts=polys.flatMap(x=>x.p),xs=pts.map(p=>p[0]),ys=pts.map(p=>p[1]);return {minX:Math.min(...xs),maxX:Math.max(...xs),minY:Math.min(...ys),maxY:Math.max(...ys)};}
async function render(name,s,w,h,palette={}){
  const recolor=o=>({...o,color:palette[o.color]||o.color});
  const polys=s.map(recolor).flatMap(meshPolys).sort((a,b)=>a.depth-b.depth), b=bounds(polys);
  const pad=Math.min(w,h)*.08, scale=Math.min((w-2*pad)/(b.maxX-b.minX),(h-2*pad)/(b.maxY-b.minY));
  const tx=w/2-(b.minX+b.maxX)*scale/2,ty=h/2-(b.minY+b.maxY)*scale/2;
  const shadow=`<ellipse cx="${w/2}" cy="${h*.82}" rx="${w*.30}" ry="${h*.07}" fill="#17130f" opacity=".22"/>`;
  const body=polys.map(x=>`<polygon points="${x.p.map(p=>`${(p[0]*scale+tx).toFixed(1)},${(p[1]*scale+ty).toFixed(1)}`).join(" ")}" fill="${x.color}" stroke="${C.ink}" stroke-width="${Math.max(2,w/90)}"/>`).join("");
  const svg=`<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}">${shadow}<g stroke-linejoin="round">${body}</g></svg>`;
  await sharp(Buffer.from(svg)).png().toFile(path.join(OUT,`${name}.png`));
}
function objFor(s){
  let out="# Procedural Medieval RTS block model\n",v=1;
  for(const o of s){
    if(o.type!=="box") continue;
    const zs=[o.z-o.h/2,o.z+o.h/2], corners=[];
    for(const z of zs) for(const [x,y] of [[-o.w/2,-o.d/2],[o.w/2,-o.d/2],[o.w/2,o.d/2],[-o.w/2,o.d/2]]){const q=rot2(x,y,o.rot);corners.push([q[0]+o.x,q[1]+o.y,z]);}
    out+=`o ${o.name}\n`+corners.map(p=>`v ${p.join(" ")}`).join("\n")+"\n";
    for(const f of [[1,2,3,4],[5,8,7,6],[1,5,6,2],[2,6,7,3],[3,7,8,4],[4,8,5,1]]) out+=`f ${f.map(i=>i+v-1).join(" ")}\n`;
    v+=8;
  }
  return out;
}

await fs.mkdir(OUT,{recursive:true}); await fs.mkdir(MODELS,{recursive:true});
const sizes={builder:[68,68],swordsman:[68,68],archer:[68,68],knight:[100,100],catapult:[100,100],castle:[260,260],windmill:[152,152],windmill_blades:[136,136],barracks:[192,192],stables:[192,192],workshop:[192,192],tower:[120,120],farm:[220,220],tree_1:[104,120],tree_2:[104,120],tree_3:[104,120],arrow:[40,12],rock:[36,36]};
for(const [name,s] of scenes){
  await fs.writeFile(path.join(MODELS,`${name}.obj`),objFor(s));
  await render(name,s,...sizes[name]);
}
const skins={
  royal:{[C.stone]:"#d4cab3",[C.stone2]:"#eee3c9",[C.roof]:C.purple,[C.roof2]:"#8c5b91",[C.straw]:"#d4ad48"},
  dark:{[C.stone]:C.black,[C.stone2]:"#565b5a",[C.roof]:"#292d2e",[C.roof2]:"#444a4a",[C.straw]:"#6a6254"},
  forest:{[C.stone]:C.moss,[C.stone2]:"#899173",[C.roof]:C.green,[C.roof2]:C.green2,[C.straw]:"#7d834a"}
};
for(const [skin,pal] of Object.entries(skins)) for(const name of ["castle","windmill","barracks","stables","workshop","tower"]) await render(`${name}__${skin}`,scenes.get(name),...sizes[name],pal);
console.log(`Exported ${scenes.size} OBJ models and near-overhead 3D PNG renders.`);
