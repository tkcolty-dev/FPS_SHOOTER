// world.js — procedural terrain tiles (value noise → water/sand/grass/forest/fields/towns), cloud layer.
window.World = (function(){
  const TILE = 512, BASE_RES = 2; // base colour computed every 4 world px, features drawn at full res
  const THEMES = {
    islands: { sea:0.47, deep:[14,52,92], shallow:[46,138,170], sand:[214,196,150], grass:[[96,142,66],[118,158,74],[84,130,60]], forest:[38,84,44], tree:[52,104,52], field:[[196,168,88],[160,140,70],[110,150,70],[184,150,60]], rock:[120,118,110], snowLine:2, town:[168,160,150], road:[86,82,78], river:false },
    plains:  { sea:0.30, deep:[18,60,100], shallow:[52,140,168], sand:[200,186,140], grass:[[108,150,66],[128,166,74],[96,140,60]], forest:[44,92,46], tree:[56,110,54], field:[[204,172,80],[168,140,66],[126,160,72],[190,150,58],[230,200,100]], rock:[120,118,110], snowLine:0.92, town:[172,166,156], road:[90,86,82], river:true },
    desert:  { sea:0.26, deep:[20,70,110], shallow:[70,160,180], sand:[222,196,138], grass:[[214,186,124],[206,178,112],[224,200,140]], forest:[150,130,80], tree:[96,120,60], field:[[190,160,90],[120,150,70],[200,180,110]], rock:[150,128,98], snowLine:2, town:[200,186,160], road:[110,96,80], river:false },
    winter:  { sea:0.38, deep:[26,56,84], shallow:[90,140,170], sand:[210,214,220], grass:[[224,230,236],[236,240,244],[208,216,224]], forest:[64,88,80], tree:[40,70,62], field:[[220,224,228],[200,206,214],[236,236,236]], rock:[130,136,140], snowLine:0.0, town:[150,150,158], road:[80,84,90], river:true },
  };
  function mkNoise(seed){
    const perm = new Uint8Array(512); const R = Art.rng(seed);
    const p=[]; for(let i=0;i<256;i++) p[i]=i; for(let i=255;i>0;i--){ const j=Math.floor(R()*(i+1)); [p[i],p[j]]=[p[j],p[i]]; }
    for(let i=0;i<512;i++) perm[i]=p[i&255];
    const fade=t=>t*t*t*(t*(t*6-15)+10);
    function n2(x,y){ // 2D gradient-free value noise via hashed corners
      const X=Math.floor(x)&255, Y=Math.floor(y)&255; const xf=x-Math.floor(x), yf=y-Math.floor(y);
      const u=fade(xf), v=fade(yf);
      const h=(a,b)=>perm[(perm[a&255]+b)&511]/255;
      const a=h(X,Y), b=h(X+1,Y), c=h(X,Y+1), d=h(X+1,Y+1);
      return (a+(b-a)*u)*(1-v) + (c+(d-c)*u)*v;
    }
    return function(x,y,oct,lac,gain){ oct=oct||4; lac=lac||2; gain=gain||0.5; let s=0,a=1,f=1,m=0; for(let i=0;i<oct;i++){ s+=n2(x*f,y*f)*a; m+=a; a*=gain; f*=lac; } return s/m; };
  }
  function lerp(a,b,t){ return a+(b-a)*t; }
  function mix(c1,c2,t){ return [lerp(c1[0],c2[0],t),lerp(c1[1],c2[1],t),lerp(c1[2],c2[2],t)]; }

  function create(themeName, size, seed){
    const theme = THEMES[themeName]||THEMES.islands; const T = theme;
    const noise = mkNoise(seed), noiseB = mkNoise(seed*7+1), noiseC = mkNoise(seed*13+2);
    const tiles = new Map(); const order=[];
    const S = 1/2200; // terrain feature scale
    function height(x,y){ // 0..1, with a coastal falloff so the map edge is water
      let h = noise(x*S, y*S, 5, 2.1, 0.5);
      const ex = Math.min(x, size-x)/size, ey = Math.min(y,size-y)/size; const edge = Math.min(ex,ey);
      if (edge<0.12) h -= (0.12-edge)*(0.12-edge)*60;
      if (T.river){ const r = Math.abs(noiseB(x*S*0.9, y*S*0.9, 2)-0.5); if (r<0.012) h -= (0.012-r)*22; }
      return h;
    }
    const isLand = (x,y)=>height(x,y) > T.sea;
    function baseColor(x,y){
      const h=height(x,y);
      if (h < T.sea){ const d=Math.min(1,Math.pow((T.sea-h)*7,0.7)); let c=mix(T.shallow,T.deep,d); const w=noiseC(x*0.02,y*0.02,2); c=mix(c,[255,255,255],(w>0.62?(w-0.62)*0.5:0)*(1-d)); return c; }
      const a = h - T.sea;
      if (a < 0.007) return T.sand;
      if (a < 0.016) return mix(T.sand, T.grass[0], (a-0.007)/0.009);
      const v = noiseB(x*S*3, y*S*3, 3); const g = T.grass[v<0.4?0:v<0.6?1:2];
      const f = noiseC(x*S*2.2, y*S*2.2, 3);
      let c = g;
      if (f>0.58) c = mix(g, T.forest, Math.min(1,(f-0.58)*7));
      if (a > 0.30){ const m=Math.min(1,(a-0.30)*5); c=mix(c,T.rock,m); if (a>T.snowLine*0.42) c=mix(c,[240,244,248],Math.min(1,(a-T.snowLine*0.42)*8)); }
      return c;
    }
    function renderTile(tx,ty){
      const cv=document.createElement('canvas'); cv.width=TILE; cv.height=TILE; const ctx=cv.getContext('2d');
      const n = TILE/BASE_RES; const img = ctx.createImageData(n,n); const d=img.data; const ox=tx*TILE, oy=ty*TILE;
      for (let j=0;j<n;j++) for (let i=0;i<n;i++){ const c=baseColor(ox+i*BASE_RES+2, oy+j*BASE_RES+2); const k=(j*n+i)*4; d[k]=c[0]; d[k+1]=c[1]; d[k+2]=c[2]; d[k+3]=255; }
      const small=document.createElement('canvas'); small.width=n; small.height=n; small.getContext('2d').putImageData(img,0,0);
      ctx.imageSmoothingEnabled=true; ctx.drawImage(small,0,0,TILE,TILE);
      // features
      const R = Art.rng(Art.hash(seed+':'+tx+','+ty));
      // fields
      for (let k=0;k<6;k++){ const fx=ox+R()*TILE, fy=oy+R()*TILE; const h=height(fx,fy)-T.sea; const f=noiseC(fx*S*2.2, fy*S*2.2, 3);
        if (h>0.02 && h<0.24 && f<0.5 && R()< (themeName==='plains'?0.9:0.45)){
          const w=60+R()*120, hh=40+R()*90, a=R()*Math.PI; const col=T.field[Math.floor(R()*T.field.length)];
          ctx.save(); ctx.translate(fx-ox,fy-oy); ctx.rotate(a); ctx.fillStyle=`rgba(${col[0]},${col[1]},${col[2]},0.85)`; ctx.fillRect(-w/2,-hh/2,w,hh);
          ctx.strokeStyle='rgba(0,0,0,0.10)'; ctx.lineWidth=1; for(let s=-w/2+6;s<w/2;s+=7){ ctx.beginPath(); ctx.moveTo(s,-hh/2); ctx.lineTo(s,hh/2); ctx.stroke(); }
          ctx.strokeStyle='rgba(0,0,0,0.25)'; ctx.strokeRect(-w/2,-hh/2,w,hh); ctx.restore();
        } }
      // trees
      const treeN = themeName==='desert'?40:260;
      for (let k=0;k<treeN;k++){ const px=ox+R()*TILE, py=oy+R()*TILE; const h=height(px,py)-T.sea; if (h<0.014||h>0.34) continue; const f=noiseC(px*S*2.2, py*S*2.2, 3); if (f<0.55 && R()>0.06) continue;
        const r=2.5+R()*3.5; const c=T.tree; const sh=themeName==='winter'?0.9:0.75;
        ctx.fillStyle='rgba(0,0,0,0.28)'; ctx.beginPath(); ctx.arc(px-ox+r*0.6,py-oy+r*0.7,r,0,7); ctx.fill();
        ctx.fillStyle=`rgb(${c[0]*sh|0},${c[1]*sh|0},${c[2]*sh|0})`; ctx.beginPath(); ctx.arc(px-ox,py-oy,r,0,7); ctx.fill();
        ctx.fillStyle=`rgb(${Math.min(255,c[0]+30)},${Math.min(255,c[1]+34)},${Math.min(255,c[2]+20)})`; ctx.beginPath(); ctx.arc(px-ox-r*0.3,py-oy-r*0.3,r*0.5,0,7); ctx.fill();
      }
      // rocks in desert / mountains
      for (let k=0;k<30;k++){ const px=ox+R()*TILE, py=oy+R()*TILE; const h=height(px,py)-T.sea; if (!(h>0.28 || (themeName==='desert'&&h>0.05&&R()<0.3))) continue; const r=3+R()*6; ctx.fillStyle='rgba(0,0,0,0.25)'; ctx.beginPath(); ctx.ellipse(px-ox+2,py-oy+2,r,r*0.7,R()*3,0,7); ctx.fill(); ctx.fillStyle=`rgb(${T.rock[0]},${T.rock[1]},${T.rock[2]})`; ctx.beginPath(); ctx.ellipse(px-ox,py-oy,r,r*0.7,R()*3,0,7); ctx.fill(); }
      // town
      if (R()<0.42){ const cx=ox+80+R()*(TILE-160), cy=oy+80+R()*(TILE-160); const h=height(cx,cy)-T.sea; const f=noiseC(cx*S*2.2, cy*S*2.2, 3);
        if (h>0.02 && h<0.22 && f<0.6){ const nb=8+Math.floor(R()*14); const ang=R()*Math.PI; ctx.save(); ctx.translate(cx-ox,cy-oy); ctx.rotate(ang);
          ctx.strokeStyle=`rgb(${T.road[0]},${T.road[1]},${T.road[2]})`; ctx.lineWidth=7; ctx.lineCap='round'; ctx.beginPath(); ctx.moveTo(-90,0); ctx.lineTo(90,0); ctx.moveTo(0,-70); ctx.lineTo(0,70); ctx.stroke();
          ctx.strokeStyle='rgba(255,255,255,0.35)'; ctx.lineWidth=1; ctx.setLineDash([6,6]); ctx.beginPath(); ctx.moveTo(-90,0); ctx.lineTo(90,0); ctx.moveTo(0,-70); ctx.lineTo(0,70); ctx.stroke(); ctx.setLineDash([]);
          for (let b=0;b<nb;b++){ const bx=(R()-0.5)*170, by=(R()-0.5)*130; if (Math.abs(bx)<8||Math.abs(by)<8) continue; const bw=8+R()*16, bh=8+R()*14; const t=T.town; const sh=0.75+R()*0.35;
            ctx.fillStyle='rgba(0,0,0,0.35)'; ctx.fillRect(bx+3,by+3,bw,bh); ctx.fillStyle=`rgb(${t[0]*sh|0},${t[1]*sh|0},${t[2]*sh|0})`; ctx.fillRect(bx,by,bw,bh);
            ctx.fillStyle=R()<0.5?'rgba(120,60,50,0.8)':'rgba(90,90,100,0.8)'; ctx.fillRect(bx+1,by+1,bw-2,bh*0.45); }
          ctx.restore(); }
      }
      // shoreline foam / wave lines
      if (themeName!=='plains' || true){ ctx.strokeStyle='rgba(255,255,255,0.18)'; ctx.lineWidth=1.2; for (let k=0;k<18;k++){ const px=ox+R()*TILE, py=oy+R()*TILE; if (height(px,py)>T.sea-0.005) continue; const len=10+R()*30; ctx.beginPath(); ctx.moveTo(px-ox,py-oy); ctx.quadraticCurveTo(px-ox+len/2,py-oy-3,px-ox+len,py-oy); ctx.stroke(); } }
      return cv;
    }
    function tile(tx,ty){ const k=tx+','+ty; let t=tiles.get(k); if (!t){ t=renderTile(tx,ty); tiles.set(k,t); order.push(k); if (order.length>90){ tiles.delete(order.shift()); } } return t; }
    function draw(ctx, cam, vw, vh){
      const x0=Math.floor((cam.x - vw/2/cam.zoom)/TILE), x1=Math.floor((cam.x + vw/2/cam.zoom)/TILE);
      const y0=Math.floor((cam.y - vh/2/cam.zoom)/TILE), y1=Math.floor((cam.y + vh/2/cam.zoom)/TILE);
      const nT = Math.ceil(size/TILE);
      for (let ty=y0;ty<=y1;ty++) for (let tx=x0;tx<=x1;tx++){
        if (tx<0||ty<0||tx>=nT||ty>=nT){ ctx.fillStyle=`rgb(${T.deep[0]},${T.deep[1]},${T.deep[2]})`; ctx.fillRect(tx*TILE,ty*TILE,TILE+1,TILE+1); continue; }
        ctx.drawImage(tile(tx,ty), tx*TILE, ty*TILE, TILE+0.5, TILE+0.5);
      }
    }
    // cloud layer
    const clouds=[]; const R=Art.rng(seed+99);
    for (let i=0;i<Math.floor(size*size/(1000*1000));i++){ const parts=[]; const n=6+Math.floor(R()*8); const sc=0.7+R()*0.9; for(let k=0;k<n;k++){ const ang=R()*Math.PI*2, rr=R()*90*sc; parts.push([ Math.cos(ang)*rr*1.5, Math.sin(ang)*rr*0.7, (24+R()*34)*sc ]); } clouds.push({x:R()*size, y:R()*size, parts, a:0.5+R()*0.25, vx:12+R()*10, vy:4+R()*6}); }
    function findLand(R, tries){ for (let i=0;i<(tries||60);i++){ const x=size*0.15+R()*size*0.7, y=size*0.15+R()*size*0.7; if (isLand(x,y) && height(x,y)-T.sea<0.28) return {x,y}; } return {x:size/2,y:size/2}; }
    return { theme:themeName, T, size, seed, TILE, tile, draw, height, isLand, clouds, findLand, noise };
  }
  return { create, THEMES, TILE };
})();
