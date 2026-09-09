// art.js — rasterizes the original SVG silhouettes and paints them: nation colour, camo, shading, insignia, outline.
window.Art = (function(){
  const RES = 2;               // internal pixels per world pixel
  const cache = {};            // id -> sprite
  const imgCache = {};
  function hash(s){ let h=2166136261; for (let i=0;i<s.length;i++){ h^=s.charCodeAt(i); h=Math.imul(h,16777619); } return h>>>0; }
  function rng(seed){ let a=seed>>>0; return function(){ a|=0; a=a+0x6D2B79F5|0; let t=Math.imul(a^a>>>15,1|a); t=t+Math.imul(t^t>>>7,61|t)^t; return ((t^t>>>14)>>>0)/4294967296; }; }
  function loadImage(src){ return imgCache[src] || (imgCache[src] = new Promise((res,rej)=>{ const i=new Image(); i.onload=()=>res(i); i.onerror=()=>rej(new Error('img '+src.slice(0,40))); i.src=src; })); }
  const supportsFilter = (()=>{ try{ const c=document.createElement('canvas').getContext('2d'); return typeof c.filter==='string'; }catch(e){ return false; } })();

  // Draw image at natural size, find opaque bounding box, return cropped canvas scaled so that height == len.
  // Some source SVGs point left / diagonally instead of up. Override angles (deg, clockwise) here; otherwise wide images are assumed nose-left.
  const ART_ROT = window.ART_ROT = { 'ilyushin-il-2-sturmovik-blueprint-2': 0, 'me-262a-1-swallow': 90, 'j-21': 90, 'j-21r': 90 };
  const ART_FLIP = window.ART_FLIP = { 'horten-229a-0':'invert', 'mig-19p-farmer':'invert' }; // true/false = force, 'invert' = opposite of auto-detect
  function bboxOf(t){ const d=t.getContext('2d').getImageData(0,0,t.width,t.height).data; let x0=t.width,y0=t.height,x1=0,y1=0; for (let y=0;y<t.height;y++) for (let x=0;x<t.width;x++){ if (d[(y*t.width+x)*4+3]>40){ if(x<x0)x0=x; if(x>x1)x1=x; if(y<y0)y0=y; if(y>y1)y1=y; } } if (x1<x0){ x0=0;y0=0;x1=t.width-1;y1=t.height-1; } return [x0,y0,x1,y1]; }
  async function rasterBase(artKey, len){
    const img = await loadImage(window.ART[artKey]);
    let w = img.naturalWidth||img.width, h = img.naturalHeight||img.height;
    const cap = 900; const s0 = Math.min(1, cap/Math.max(w,h));
    let t = document.createElement('canvas'); t.width = Math.max(1,Math.round(w*s0)); t.height = Math.max(1,Math.round(h*s0));
    let tc = t.getContext('2d'); tc.drawImage(img,0,0,t.width,t.height);
    // orientation: measure the opaque bbox first, rotate so the nose points up
    let bb = bboxOf(t); let rot = ART_ROT[artKey]; if (rot===undefined) rot = (bb[2]-bb[0]) > (bb[3]-bb[1])*1.08 ? 90 : 0;
    if (rot){ const th=rot*Math.PI/180; const bw0=bb[2]-bb[0]+1, bh0=bb[3]-bb[1]+1; const W2=Math.ceil(Math.abs(bw0*Math.cos(th))+Math.abs(bh0*Math.sin(th)))+4, H2=Math.ceil(Math.abs(bw0*Math.sin(th))+Math.abs(bh0*Math.cos(th)))+4;
      const r=document.createElement('canvas'); r.width=W2; r.height=H2; const rc=r.getContext('2d'); rc.translate(W2/2,H2/2); rc.rotate(th); rc.drawImage(t, bb[0],bb[1],bw0,bh0, -bw0/2,-bh0/2,bw0,bh0); t=r; tc=rc; }
    // nose detection: the tail end of an aircraft silhouette (stabilisers / trailing edge) is wider than the nose end.
    bb = bboxOf(t); { const d=t.getContext('2d').getImageData(0,0,t.width,t.height).data; const rows=[]; for (let y=bb[1];y<=bb[3];y++){ let n=0; for (let x=bb[0];x<=bb[2];x++) if (d[(y*t.width+x)*4+3]>40) n++; rows.push(n); }
      const k=Math.max(2,Math.floor(rows.length*0.14)); const top=rows.slice(0,k).reduce((a,b)=>a+b,0)/k, bot=rows.slice(-k).reduce((a,b)=>a+b,0)/k;
      let flip = top > bot; const fo=ART_FLIP[artKey]; if (fo==='invert') flip=!flip; else if (fo!==undefined) flip=fo;
      if (flip){ const r=document.createElement('canvas'); r.width=t.width; r.height=t.height; const rc=r.getContext('2d'); rc.translate(t.width/2,t.height/2); rc.rotate(Math.PI); rc.drawImage(t,-t.width/2,-t.height/2); t=r; } }
    const d = t.getContext('2d').getImageData(0,0,t.width,t.height).data;
    let x0=t.width,y0=t.height,x1=0,y1=0;
    for (let y=0;y<t.height;y++) for (let x=0;x<t.width;x++){ if (d[(y*t.width+x)*4+3]>40){ if(x<x0)x0=x; if(x>x1)x1=x; if(y<y0)y0=y; if(y>y1)y1=y; } }
    if (x1<x0){ x0=0;y0=0;x1=t.width-1;y1=t.height-1; }
    const bw=x1-x0+1, bh=y1-y0+1;
    const scale = len/bh; const pad = 4;
    const c = document.createElement('canvas'); c.width = Math.ceil(bw*scale)+pad*2; c.height = Math.ceil(bh*scale)+pad*2;
    const cc = c.getContext('2d'); cc.imageSmoothingQuality='high';
    cc.drawImage(t, x0,y0,bw,bh, pad,pad, bw*scale, bh*scale);
    return c;
  }

  function insignia(ctx, nation, x, y, r, lowvis){
    ctx.save(); ctx.translate(x,y); if (lowvis) ctx.globalAlpha=0.75;
    const star=(R,fill)=>{ ctx.beginPath(); for(let i=0;i<10;i++){ const a=-Math.PI/2+i*Math.PI/5; const rr=i%2?R*0.42:R; ctx.lineTo(Math.cos(a)*rr,Math.sin(a)*rr);} ctx.closePath(); ctx.fillStyle=fill; ctx.fill(); };
    const circ=(R,fill)=>{ ctx.beginPath(); ctx.arc(0,0,R,0,Math.PI*2); ctx.fillStyle=fill; ctx.fill(); };
    switch(nation){
      case 'usa': ctx.fillStyle='#e9eef5'; ctx.fillRect(-r*1.7,-r*0.36,r*3.4,r*0.72); ctx.fillStyle='#24427a'; ctx.fillRect(-r*1.7,-r*0.36,r*3.4,r*0.72); ctx.fillStyle='#e9eef5'; ctx.fillRect(-r*1.6,-r*0.26,r*3.2,r*0.52); circ(r,'#24427a'); star(r*0.78,'#f4f6f8'); break;
      case 'germany': ctx.fillStyle='#f2f2f2'; ctx.fillRect(-r,-r*0.36,r*2,r*0.72); ctx.fillRect(-r*0.36,-r,r*0.72,r*2); ctx.fillStyle='#111'; ctx.fillRect(-r*0.86,-r*0.24,r*1.72,r*0.48); ctx.fillRect(-r*0.24,-r*0.86,r*0.48,r*1.72); break;
      case 'ussr': star(r*1.05,'#f4f4f4'); star(r*0.9,'#d0242a'); break;
      case 'britain': circ(r,'#1d3f8f'); circ(r*0.66,'#f2f2f2'); circ(r*0.34,'#c62828'); break;
      case 'japan': circ(r*1.1,'#f4f4f4'); circ(r*0.9,'#c62828'); break;
      case 'france': circ(r,'#c62828'); circ(r*0.66,'#f2f2f2'); circ(r*0.34,'#1d3f8f'); break;
      case 'sweden': circ(r,'#2c63c6'); for(let i=0;i<3;i++){ const a=-Math.PI/2+i*Math.PI*2/3; ctx.beginPath(); ctx.arc(Math.cos(a)*r*0.42,Math.sin(a)*r*0.42,r*0.22,0,Math.PI*2); ctx.fillStyle='#f3c14b'; ctx.fill(); } break;
    }
    ctx.restore();
  }

  // Paint a base raster. Returns a new canvas.
  function paint(base, plane, opts){
    opts = opts||{};
    const nat = window.NATIONS[plane.nation]; const pal = plane.jet ? nat.jet : nat.prop;
    const R = rng(hash(plane.id+'|'+(opts.seed||0)));
    const w=base.width, h=base.height;
    const c=document.createElement('canvas'); c.width=w; c.height=h; const x=c.getContext('2d');
    // 1. colourise
    x.drawImage(base,0,0);
    // measure how dark the original is so near-black silhouettes get lifted before colourising
    const bd=x.getImageData(0,0,w,h).data; let lum=0,cnt=0; for (let i=0;i<bd.length;i+=16){ if (bd[i+3]>60){ lum+=(bd[i]*0.3+bd[i+1]*0.59+bd[i+2]*0.11)/255; cnt++; } } lum=cnt?lum/cnt:0.7;
    const dark = lum<0.45;
    x.globalCompositeOperation='source-atop';
    x.globalAlpha = dark?0.85:0.35; x.fillStyle='#e0e0e0'; x.fillRect(0,0,w,h);
    x.globalAlpha = plane.jet?0.62:0.78; x.fillStyle = opts.color||pal[0]; x.fillRect(0,0,w,h);
    // 2. camo blotches (props) / panel stripes (jets)
    x.globalAlpha = 1;
    if (!plane.jet){
      x.fillStyle = pal[1]; x.globalAlpha=0.55;
      const n = 10 + Math.floor(R()*8);
      for (let i=0;i<n;i++){ const cx=R()*w, cy=R()*h, rx=w*(0.06+R()*0.14), ry=h*(0.03+R()*0.08), a=R()*Math.PI; x.beginPath(); x.ellipse(cx,cy,rx,ry,a,0,Math.PI*2); x.fill(); }
      // nose / spinner accent
      x.globalAlpha=0.8; x.fillStyle = ['#c62828','#f3c14b','#e9eef5','#2c63c6'][Math.floor(R()*4)]; x.fillRect(0,0,w,h*0.045);
    } else {
      // subtle panel lines
      x.globalAlpha=0.16; x.strokeStyle='#000'; x.lineWidth=1;
      for (let i=1;i<9;i++){ const yy=h*(0.1+i*0.1); x.beginPath(); x.moveTo(0,yy); x.lineTo(w,yy); x.stroke(); }
      x.globalAlpha=0.35; x.fillStyle=pal[1]; x.fillRect(0,0,w,h*0.06); // radome
      if (plane.role==='Attacker'){ x.globalAlpha=0.5; x.fillStyle='#5b6b3a'; for(let i=0;i<8;i++){ x.beginPath(); x.ellipse(R()*w,R()*h,w*0.15,h*0.06,R()*3,0,7); x.fill(); } }
    }
    // 3. bring back line detail of original (multiply)
    x.globalAlpha=dark?0.12:0.5; x.globalCompositeOperation='multiply'; x.drawImage(base,0,0);
    x.globalAlpha=dark?0.2:0.35; x.globalCompositeOperation='overlay'; x.drawImage(base,0,0);
    x.globalCompositeOperation='destination-in'; x.globalAlpha=1; x.drawImage(base,0,0);
    // 4. lighting: fuselage highlight + directional shade
    x.globalCompositeOperation='source-atop';
    let g = x.createLinearGradient(w*0.5-w*0.09,0,w*0.5+w*0.09,0);
    g.addColorStop(0,'rgba(255,255,255,0)'); g.addColorStop(0.5,'rgba(255,255,255,0.28)'); g.addColorStop(1,'rgba(255,255,255,0)');
    x.fillStyle=g; x.fillRect(0,0,w,h);
    g = x.createLinearGradient(0,0,w,h); g.addColorStop(0,'rgba(255,255,255,0.18)'); g.addColorStop(0.55,'rgba(0,0,0,0)'); g.addColorStop(1,'rgba(0,0,0,0.28)');
    x.fillStyle=g; x.fillRect(0,0,w,h);
    // 5. insignia on wings
    const r = Math.max(4, Math.min(w*0.055, h*0.045));
    const wy = h*0.5 + (plane.role==='Bomber'?h*0.02:h*0.04);
    insignia(x, plane.nation, w*0.5 - w*0.31, wy, r, plane.jet); insignia(x, plane.nation, w*0.5 + w*0.31, wy, r, plane.jet);
    // 6. dark outline behind
    const sil = silhouette(c,'rgba(10,12,16,0.85)');
    x.globalCompositeOperation='destination-over';
    for (const [dx,dy] of [[1,0],[-1,0],[0,1],[0,-1],[1,1],[-1,-1]]) x.drawImage(sil,dx,dy);
    x.globalCompositeOperation='source-over';
    return c;
  }
  function silhouette(src, color){
    const c=document.createElement('canvas'); c.width=src.width; c.height=src.height; const x=c.getContext('2d');
    x.drawImage(src,0,0); x.globalCompositeOperation='source-in'; x.fillStyle=color; x.fillRect(0,0,c.width,c.height);
    return c;
  }
  function shadowOf(src){
    const s = silhouette(src,'rgba(0,0,0,1)');
    if (!supportsFilter) return s;
    const c=document.createElement('canvas'); c.width=s.width+16; c.height=s.height+16; const x=c.getContext('2d');
    x.filter='blur(3px)'; x.drawImage(s,8,8); return c;
  }

  async function plane(id, opts){
    const key = id+(opts&&opts.seed?'#'+opts.seed:'');
    if (cache[key]) return cache[key];
    const p = window.planeById(id);
    const base = await rasterBase(p.art, p.size*RES);
    const cv = paint(base, p, opts);
    const sp = { cv, shadow: shadowOf(cv), flash: silhouette(cv,'#fff'), w: cv.width/RES, h: cv.height/RES, res: RES, len: p.size, span: cv.width/RES - 8/RES };
    cache[key]=sp; return sp;
  }
  async function missile(key){
    const k='m:'+key; if (cache[k]) return cache[k];
    const m = window.MISSILES[key];
    const base = await rasterBase(m.art, 26*RES);
    const c=document.createElement('canvas'); c.width=base.width; c.height=base.height; const x=c.getContext('2d');
    x.drawImage(base,0,0); x.globalCompositeOperation='source-atop'; x.fillStyle='rgba(235,238,240,0.5)'; x.fillRect(0,0,c.width,c.height);
    x.globalCompositeOperation='destination-over'; const s=silhouette(base,'rgba(0,0,0,.8)'); for (const [dx,dy] of [[1,0],[-1,0],[0,1],[0,-1]]) x.drawImage(s,dx,dy);
    const sp = { cv:c, w:c.width/RES, h:c.height/RES, res:RES };
    cache[k]=sp; return sp;
  }
  async function showcase(id, len){
    const k='big:'+id+':'+len; if (cache[k]) return cache[k];
    const p=window.planeById(id); const base = await rasterBase(p.art, len);
    const cv = paint(base,p); const sp={cv, shadow:shadowOf(cv), w:cv.width, h:cv.height, res:1};
    cache[k]=sp; return sp;
  }
  async function thumb(id, len){
    const k='th:'+id+':'+len; if (cache[k]) return cache[k];
    const p=window.planeById(id); const base = await rasterBase(p.art, len);
    const cv = paint(base,p); cache[k]={cv,w:cv.width,h:cv.height,res:1}; return cache[k];
  }
  async function preloadAll(progress){
    const ids = window.PLANES.map(p=>p.id); let n=0;
    for (const id of ids){ await plane(id); n++; progress && progress(n/(ids.length+Object.keys(window.MISSILES).length)); }
    for (const k of Object.keys(window.MISSILES)){ await missile(k); n++; progress && progress(n/(ids.length+Object.keys(window.MISSILES).length)); }
  }
  return { plane, missile, showcase, thumb, preloadAll, rng, hash, supportsFilter, RES };
})();
