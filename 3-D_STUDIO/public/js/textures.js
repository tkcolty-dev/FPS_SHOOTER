/* Procedural textures — generated on a canvas so games work offline with zero downloads. */
import * as THREE from 'three';

export const TEXTURE_NAMES = ['grass','dirt','sand','snow','stone','brick','wood','planks','metal','tiles','checker','lava','water','ice','rainbow'];
const cache = new Map();

function rng(seed){ let s = seed >>> 0; return () => { s = (s * 1664525 + 1013904223) >>> 0; return s / 4294967296; }; }
function noiseCanvas(ctx, w, h, base, variance, r, cells=4){
  // soft blotchy noise: sum of random rects + fine grain
  ctx.fillStyle = base; ctx.fillRect(0, 0, w, h);
  for (let i = 0; i < 260; i++){ const a = variance * (r() - 0.5); ctx.fillStyle = `rgba(${a>0?255:0},${a>0?255:0},${a>0?255:0},${Math.abs(a)})`; const s = 4 + r() * (w / cells); ctx.beginPath(); ctx.arc(r() * w, r() * h, s, 0, 7); ctx.fill(); }
  const img = ctx.getImageData(0, 0, w, h), d = img.data;
  for (let i = 0; i < d.length; i += 4){ const g = (r() - 0.5) * 22; d[i] += g; d[i+1] += g; d[i+2] += g; }
  ctx.putImageData(img, 0, 0);
}
const painters = {
  grass(ctx, w, h, r){ noiseCanvas(ctx, w, h, '#5aa63f', 0.35, r, 3); ctx.strokeStyle = 'rgba(40,110,30,.5)'; for (let i = 0; i < 900; i++){ const x = r()*w, y = r()*h; ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x + (r()-0.5)*4, y - 4 - r()*6); ctx.stroke(); } },
  dirt(ctx, w, h, r){ noiseCanvas(ctx, w, h, '#7a5a3a', 0.35, r, 3); for (let i = 0; i < 120; i++){ ctx.fillStyle = `rgba(60,40,25,${r()*0.5})`; ctx.beginPath(); ctx.arc(r()*w, r()*h, 1 + r()*3, 0, 7); ctx.fill(); } },
  sand(ctx, w, h, r){ noiseCanvas(ctx, w, h, '#e2c98a', 0.2, r, 4); },
  snow(ctx, w, h, r){ noiseCanvas(ctx, w, h, '#f2f6ff', 0.12, r, 5); },
  stone(ctx, w, h, r){ noiseCanvas(ctx, w, h, '#8b8f96', 0.4, r, 2); ctx.strokeStyle = 'rgba(30,30,35,.55)'; ctx.lineWidth = 2; for (let i = 0; i < 26; i++){ ctx.beginPath(); let x = r()*w, y = r()*h; ctx.moveTo(x, y); for (let k = 0; k < 4; k++){ x += (r()-0.5)*80; y += (r()-0.5)*80; ctx.lineTo(x, y); } ctx.stroke(); } },
  brick(ctx, w, h, r){ ctx.fillStyle = '#b8b0a4'; ctx.fillRect(0, 0, w, h); const bw = 64, bh = 32; for (let y = 0; y < h; y += bh){ const off = (y / bh) % 2 ? bw / 2 : 0; for (let x = -bw; x < w + bw; x += bw){ ctx.fillStyle = `hsl(${8 + r()*10},${55 + r()*15}%,${38 + r()*12}%)`; ctx.fillRect(x + off + 3, y + 3, bw - 6, bh - 6); } } },
  wood(ctx, w, h, r){ ctx.fillStyle = '#a5703c'; ctx.fillRect(0, 0, w, h); for (let i = 0; i < 40; i++){ ctx.strokeStyle = `rgba(80,45,15,${0.15 + r()*0.35})`; ctx.lineWidth = 1 + r()*3; ctx.beginPath(); const y = r()*h; ctx.moveTo(0, y); ctx.bezierCurveTo(w*0.3, y + (r()-0.5)*20, w*0.7, y + (r()-0.5)*20, w, y); ctx.stroke(); } },
  planks(ctx, w, h, r){ painters.wood(ctx, w, h, r); ctx.strokeStyle = 'rgba(40,20,5,.7)'; ctx.lineWidth = 4; for (let y = 0; y <= h; y += 64){ ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(w, y); ctx.stroke(); } for (let y = 0; y < h; y += 64){ const x = r()*w; ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x, y + 64); ctx.stroke(); } },
  metal(ctx, w, h, r){ noiseCanvas(ctx, w, h, '#9aa3ad', 0.18, r, 6); ctx.fillStyle = 'rgba(40,45,55,.6)'; for (let y = 24; y < h; y += 64) for (let x = 24; x < w; x += 64){ ctx.beginPath(); ctx.arc(x, y, 5, 0, 7); ctx.fill(); } },
  tiles(ctx, w, h, r){ ctx.fillStyle = '#dfe4ea'; ctx.fillRect(0, 0, w, h); for (let y = 0; y < h; y += 64) for (let x = 0; x < w; x += 64){ ctx.fillStyle = `hsl(200,20%,${78 + r()*12}%)`; ctx.fillRect(x + 3, y + 3, 58, 58); } },
  checker(ctx, w, h){ for (let y = 0; y < 8; y++) for (let x = 0; x < 8; x++){ ctx.fillStyle = (x + y) % 2 ? '#e8e8ee' : '#4a4a58'; ctx.fillRect(x * 32, y * 32, 32, 32); } },
  lava(ctx, w, h, r){ noiseCanvas(ctx, w, h, '#ff4d00', 0.5, r, 2); ctx.strokeStyle = '#2a0800'; ctx.lineWidth = 6; for (let i = 0; i < 14; i++){ ctx.beginPath(); let x = r()*w, y = r()*h; ctx.moveTo(x, y); for (let k = 0; k < 5; k++){ x += (r()-0.5)*90; y += (r()-0.5)*90; ctx.lineTo(x, y); } ctx.stroke(); } },
  water(ctx, w, h, r){ noiseCanvas(ctx, w, h, '#2f8fd8', 0.25, r, 3); ctx.strokeStyle = 'rgba(255,255,255,.35)'; ctx.lineWidth = 2; for (let i = 0; i < 30; i++){ const y = r()*h; ctx.beginPath(); ctx.moveTo(0, y); for (let x = 0; x <= w; x += 16) ctx.lineTo(x, y + Math.sin(x / 14 + i) * 4); ctx.stroke(); } },
  ice(ctx, w, h, r){ noiseCanvas(ctx, w, h, '#bfe6ff', 0.15, r, 3); ctx.strokeStyle = 'rgba(255,255,255,.6)'; for (let i = 0; i < 20; i++){ ctx.beginPath(); let x = r()*w, y = r()*h; ctx.moveTo(x, y); for (let k = 0; k < 3; k++){ x += (r()-0.5)*100; y += (r()-0.5)*100; ctx.lineTo(x, y); } ctx.stroke(); } },
  rainbow(ctx, w, h){ const g = ctx.createLinearGradient(0, 0, w, 0); ['#ff3b3b','#ffb53b','#fff43b','#3bff5c','#3bc4ff','#8a3bff','#ff3bd4'].forEach((c, i, a) => g.addColorStop(i / (a.length - 1), c)); ctx.fillStyle = g; ctx.fillRect(0, 0, w, h); }
};

export function getTexture(name){
  if (!painters[name]) return null;
  if (cache.has(name)) return cache.get(name);
  const c = document.createElement('canvas'); c.width = c.height = 256; const ctx = c.getContext('2d');
  painters[name](ctx, 256, 256, rng(name.length * 7919 + 17));
  const t = new THREE.CanvasTexture(c); t.wrapS = t.wrapT = THREE.RepeatWrapping; t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 4;
  cache.set(name, t); return t;
}
export function textureThumb(name){ const t = getTexture(name); return t ? t.image.toDataURL() : ''; }
export const TEXTURE_PROPS = { lava: { emissive: true, rough: 0.7 }, water: { opacity: 0.75, rough: 0.1, metal: 0.1 }, ice: { rough: 0.05, opacity: 0.9 }, metal: { metal: 0.85, rough: 0.35 } };
