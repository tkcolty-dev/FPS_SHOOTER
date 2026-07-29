#!/usr/bin/env node
/* Medieval RTS art generator.
 * Run from the project root:
 *   NODE_PATH=/path/to/node_modules node art/generate.js
 * The script uses `sharp` and writes retina-resolution PNGs to client/assets.
 */
import fs from "node:fs/promises";
import path from "node:path";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
const sharp = require("sharp");
const ROOT = path.resolve(import.meta.dirname, "..");
const OUT = path.join(ROOT, "client", "assets");
const GENERATED = "/Users/colton/.codex/generated_images/019fafe3-d69b-78a1-97ac-056e4fb849fc";
const TITLE_BG_SOURCE = path.join(GENERATED, "call_XahNXnDXNruKsWdu0DdnCrFG.png");
const TITLE_LOGO_SOURCE = path.join(GENERATED, "call_BSiQQMw3X9xDKREKu8fiMLFZ.png");

const P = {
  ink: "#29231f", outline: "#332923", stone: "#a99f8f", stoneDark: "#776f65",
  stoneLight: "#d8d0bf", wood: "#8b552f", woodDark: "#57351f", woodLight: "#c18449",
  roof: "#9b4b32", roofDark: "#673225", straw: "#d4a847", strawDark: "#9b762d",
  green: "#426d3b", greenDark: "#294b2b", greenLight: "#6f9a4a",
  leather: "#795039", steel: "#aeb8b8", steelDark: "#677276", skin: "#d8aa76",
  gold: "#d3a53d", purple: "#694369", black: "#383b3c", moss: "#65744a",
};
const esc = (s) => s.replaceAll("&", "&amp;").replaceAll("<", "&lt;");
const svg = (w, h, body, bg = "none") =>
  `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}" viewBox="0 0 ${w} ${h}">
  ${bg === "none" ? "" : `<rect width="100%" height="100%" fill="${bg}"/>`}
  <g stroke-linejoin="round" stroke-linecap="round">${body}</g></svg>`;
const poly = (pts, fill, sw = 6, stroke = P.outline) =>
  `<polygon points="${pts}" fill="${fill}" stroke="${stroke}" stroke-width="${sw}"/>`;
const rect = (x,y,w,h,fill,rx=0,sw=6,stroke=P.outline) =>
  `<rect x="${x}" y="${y}" width="${w}" height="${h}" rx="${rx}" fill="${fill}" stroke="${stroke}" stroke-width="${sw}"/>`;
const ell = (cx,cy,rx,ry,fill,sw=6,stroke=P.outline) =>
  `<ellipse cx="${cx}" cy="${cy}" rx="${rx}" ry="${ry}" fill="${fill}" stroke="${stroke}" stroke-width="${sw}"/>`;
const line = (x1,y1,x2,y2,stroke=P.outline,sw=6) =>
  `<line x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}" stroke="${stroke}" stroke-width="${sw}"/>`;
const pathEl = (d,fill,sw=6,stroke=P.outline) =>
  `<path d="${d}" fill="${fill}" stroke="${stroke}" stroke-width="${sw}"/>`;

async function write(name, w, h, body, bg = "none") {
  await sharp(Buffer.from(svg(w, h, body, bg))).png().toFile(path.join(OUT, name));
}

function shadow(cx, cy, rx, ry) {
  return `<ellipse cx="${cx}" cy="${cy}" rx="${rx}" ry="${ry}" fill="#1b171529" stroke="none"/>`;
}
function bricks(x,y,w,h,color=P.stoneDark) {
  let s="";
  for(let yy=y+16; yy<y+h; yy+=24) {
    s += line(x+8,yy,x+w-8,yy,color,3);
    for(let xx=x+22+((yy/24)%2)*18; xx<x+w; xx+=38) s += line(xx,yy-12,xx,yy+12,color,3);
  }
  return s;
}
function buildingBase(kind, pal=P) {
  const isCastle=kind==="castle", W=isCastle?260:kind==="tower"?120:192, H=isCastle?260:kind==="tower"?120:192;
  let b=shadow(W/2,H*.85,W*.36,H*.10);
  if (kind==="windmill") {
    b += poly("60,154 132,154 120,54 72,54",pal.stone,6)+bricks(66,70,60,80,pal.stoneDark);
    b += poly("62,58 96,28 130,58",pal.roof,6)+poly("96,28 130,58 118,62",pal.roofDark,0,"none");
    b += rect(84,116,24,38,pal.woodDark,7,5)+rect(76,74,40,26,"#91bed0",5,5);
  } else if (kind==="tower") {
    b += rect(31,34,58,72,pal.stone,6,6)+bricks(34,44,52,58,pal.stoneDark);
    b += poly("22,38 98,38 88,17 32,17",pal.roof,6)+poly("60,17 98,38 86,41",pal.roofDark,0,"none");
    b += rect(51,72,18,34,pal.woodDark,5,4)+rect(48,49,24,16,"#89aeb8",3,4);
  } else if (isCastle) {
    b += rect(54,95,152,112,pal.stone,8,7)+bricks(58,106,144,94,pal.stoneDark);
    for (const x of [48,166]) {
      b += rect(x,66,48,132,pal.stone,8,7)+bricks(x+4,80,40,105,pal.stoneDark);
      b += poly(`${x-7},73 ${x+55},73 ${x+45},43 ${x+3},43`,pal.roof,6);
    }
    b += poly("72,105 130,55 188,105",pal.roof,7)+poly("130,55 188,105 166,110",pal.roofDark,0,"none");
    b += rect(112,159,36,48,pal.woodDark,14,6)+rect(121,166,8,16,pal.gold,3,0,"none");
    for (const x of [76,165]) b += rect(x,128,20,26,"#8db4bd",4,4);
    b += poly("47,66 59,56 71,66 83,56 95,66",pal.stone,6);
    b += poly("166,66 178,56 190,66 202,56 214,66",pal.stone,6);
  } else {
    b += rect(35,86,122,74,pal.stone,8,6)+bricks(40,98,112,55,pal.stoneDark);
    b += poly("24,92 96,40 168,92",pal.roof,7)+poly("96,40 168,92 139,98",pal.roofDark,0,"none");
    b += rect(78,119,34,41,pal.woodDark,6,5);
    if(kind==="barracks") {
      b += line(50,51,143,142,P.woodLight,7)+line(143,51,50,142,P.woodLight,7);
      b += pathEl("M136 42 L164 58 L148 75 Z",P.straw,5);
    } else if(kind==="stables") {
      b += rect(42,104,26,32,P.wood,4,4)+rect(124,104,25,32,P.wood,4,4);
      b += pathEl("M48 116 Q56 103 64 116",P.ink,3,"none");
    } else if(kind==="workshop") {
      b += ell(47,139,22,22,P.wood,5)+ell(47,139,8,8,P.stoneLight,3);
      for(let a=0;a<8;a++){const q=a*Math.PI/4;b+=line(47+Math.cos(q)*18,139+Math.sin(q)*18,47+Math.cos(q)*28,139+Math.sin(q)*28,P.woodDark,5);}
      b += rect(123,111,27,24,"#24282a",3,4);
    }
  }
  return {W,H,b};
}
async function buildings() {
  for (const kind of ["castle","windmill","barracks","stables","workshop","tower"]) {
    const {W,H,b}=buildingBase(kind,P); await write(`${kind}.png`,W,H,b);
  }
  const blade = ell(68,68,10,10,P.woodLight,5) +
    [0,90,180,270].map(a=>`<g transform="rotate(${a} 68 68)">${poly("62,68 74,68 91,17 70,9",P.straw,5)}${line(68,68,79,22,P.woodDark,5)}</g>`).join("");
  await write("windmill_blades.png",136,136,blade);
  const skins={
    royal:{...P,stone:"#d7cdb6",stoneDark:"#9c9079",roof:"#724278",roofDark:"#472b50"},
    dark:{...P,stone:"#505253",stoneDark:"#292c2d",roof:"#353b3d",roofDark:"#202425",wood:"#515355",woodDark:"#292b2c"},
    forest:{...P,stone:"#8d9678",stoneDark:"#5e674f",roof:"#49633c",roofDark:"#30452d",wood:"#557044",woodDark:"#34472e"}
  };
  for(const [skin,pal] of Object.entries(skins)) for(const kind of ["castle","windmill","barracks","stables","workshop","tower"]){
    const {W,H,b}=buildingBase(kind,pal); await write(`${kind}__${skin}.png`,W,H,b);
  }
}

function person(role) {
  const W=68,H=68; let b=shadow(34,59,21,6);
  b += ell(35,25,12,13,P.skin,5)+pathEl("M23 25 Q25 7 43 12 L46 25 Q35 17 23 25",role==="knight"?P.steel:P.leather,5);
  b += pathEl("M22 36 Q35 29 48 37 L52 57 Q35 65 18 56 Z",role==="knight"?P.steel:role==="archer"?P.green:P.leather,5);
  b += line(26,56,23,64,P.woodDark,6)+line(44,56,48,64,P.woodDark,6);
  if(role==="builder"){ b+=line(47,39,60,21,P.woodDark,5)+rect(52,13,13,9,P.steel,2,4); }
  if(role==="swordsman"){ b+=line(49,47,61,14,P.steel,6)+poly("57,12 65,8 64,17",P.steelLight||P.stoneLight,3)+line(54,35,65,39,P.gold,4); }
  if(role==="archer"){ b+=pathEl("M51 15 Q66 34 50 54","none",5,P.woodLight)+line(52,16,52,53,P.stoneLight,2)+line(49,35,64,35,P.wood,3); }
  if(role==="knight"){ b+=poly("13,39 26,33 27,54 14,57",P.steelDark,5)+line(48,45,61,17,P.steel,5); }
  return {W,H,b};
}
async function units(){
  for(const r of ["builder","swordsman","archer","knight"]){const {W,H,b}=person(r);await write(`${r}.png`,W,H,b);}
  let b=shadow(50,89,38,8)+rect(20,48,60,28,P.wood,4,6)+ell(26,76,15,15,P.woodDark,5)+ell(74,76,15,15,P.woodDark,5);
  b+=line(29,47,65,22,P.woodDark,8)+line(65,22,76,34,P.woodDark,7)+ell(67,24,7,7,P.steelDark,4)+pathEl("M68 21 L87 13 L90 33 L75 35 Z",P.wood,5);
  await write("catapult.png",100,100,b);
}
async function terrain(){
  // Seamless because edge-crossing details are duplicated at opposite edges.
  let g=""; const dots=[[18,24],[62,91],[111,32],[154,180],[221,74],[240,231],[5,198],[129,239],[198,132]];
  for(const [x,y] of dots) g+=pathEl(`M${x-6} ${y+4} Q${x} ${y-7} ${x+6} ${y+4}`,P.greenDark,3,"none");
  for(const [x,y] of [[0,52],[256,52],[0,218],[256,218]]) g+=ell(x,y,7,4,"#739151",0,"none");
  await write("tile_grass.png",256,256,g,"#557f45");
  let f=shadow(110,190,76,13)+poly("18,160 96,96 202,135 118,204",P.woodDark,6);
  for(let i=0;i<7;i++) f+=poly(`${28+i*17},151 ${94+i*9},109 ${106+i*11},116 ${43+i*17},169`,i%2?P.strawDark:P.straw,2,P.strawDark);
  f+=line(18,160,118,204,P.woodLight,5)+line(96,96,202,135,P.woodLight,5); await write("farm.png",220,220,f);
  for(let n=1;n<=3;n++){let t=shadow(52,111,34,7)+rect(46,73,13,38,P.wood,4,4); const shift=(n-2)*4;
    t+=ell(50+shift,54,34,30,P.greenDark,6)+ell(35-shift,67,25,24,P.green,6)+ell(67,68,25,24,n===3?P.moss:P.green,6)+ell(46,39,25,23,P.greenLight,5);
    await write(`tree_${n}.png`,104,120,t);}
}
async function projectiles(){
  let a=line(7,6,34,6,P.wood,4)+poly("34,1 40,6 34,11",P.steel,3)+poly("8,6 1,1 5,6 1,11",P.strawDark,2);
  await write("arrow.png",40,12,a);
  let r=ell(18,19,14,13,P.stoneDark,5)+ell(13,13,5,4,P.stoneLight,0,"none")+pathEl("M20 9 L27 14 L24 21","none",3,P.ink);
  await write("rock.png",36,36,r);
}
async function titles(){
  try {
    await sharp(TITLE_BG_SOURCE).resize(1920,1080,{fit:"cover"}).png().toFile(path.join(OUT,"title_bg.png"));
    // Chroma-key with a soft antialiased matte.
    const img=sharp(TITLE_LOGO_SOURCE).removeAlpha();
    const {data,info}=await img.raw().toBuffer({resolveWithObject:true});
    const out=Buffer.alloc(info.width*info.height*4);
    for(let i=0,j=0;i<data.length;i+=3,j+=4){
      const r=data[i],g=data[i+1],bl=data[i+2];
      const green=Math.max(0,g-Math.max(r,bl));
      const alpha=Math.max(0,Math.min(255,255-(green-25)*2.2));
      out[j]=r;
      out[j+1]=alpha<252?Math.min(g,Math.max(r,bl)*1.04):g;
      out[j+2]=bl;
      out[j+3]=alpha;
    }
    await sharp(out,{raw:{width:info.width,height:info.height,channels:4}})
      .trim({background:{r:0,g:0,b:0,alpha:0}}).resize(1120,600,{fit:"contain",background:{r:0,g:0,b:0,alpha:0}})
      .png().toFile(path.join(OUT,"title_logo.png"));
  } catch(e) { console.warn("Title sources unavailable; skipped:",e.message); }
}
async function contactSheet(){
  const files=(await fs.readdir(OUT)).filter(f=>f.endsWith(".png")&&!f.startsWith("title_")).sort();
  const thumbs=await Promise.all(files.map(async f=>({input:await sharp(path.join(OUT,f)).resize(120,120,{fit:"contain",background:"#efe3c8"}).png().toBuffer()})));
  await sharp({create:{width:720,height:Math.ceil(files.length/6)*150,channels:3,background:"#302a26"}})
    .composite(thumbs.map((x,i)=>({...x,left:(i%6)*120,top:Math.floor(i/6)*150}))).png().toFile(path.join(ROOT,"art","contact-sheet.png"));
  const grass=await sharp(path.join(OUT,"tile_grass.png")).png().toBuffer();
  await sharp({create:{width:512,height:512,channels:3,background:"#557f45"}})
    .composite([{input:grass,left:0,top:0},{input:grass,left:256,top:0},{input:grass,left:0,top:256},{input:grass,left:256,top:256}])
    .png().toFile(path.join(ROOT,"art","grass-2x2-proof.png"));
}
await fs.mkdir(OUT,{recursive:true});
await titles(); await buildings(); await units(); await terrain(); await projectiles(); await contactSheet();
console.log("Generated Medieval RTS art in",OUT);
