// game.js — core simulation + rendering: planes, guns, missiles, bombs, ground units, AI, HUD, camera.
window.Game = (function(){
  const TAU=Math.PI*2, DEG=Math.PI/180;
  const clamp=(v,a,b)=>v<a?a:v>b?b:v, lerp=(a,b,t)=>a+(b-a)*t, rnd=(a,b)=>a+Math.random()*(b-a);
  const norm=a=>{ while(a>Math.PI)a-=TAU; while(a<-Math.PI)a+=TAU; return a; };
  const dist=(a,b)=>Math.hypot(a.x-b.x,a.y-b.y);
  const AI_NAMES=['Viper','Ghost','Maverick','Iceman','Red Baron','Falcon','Hawk','Bandit','Cobra','Reaper','Wolf','Sabre','Raven','Duke','Lynx','Storm','Blitz','Jester','Rogue','Hornet','Kestrel','Dagger','Vandal','Comet','Rook','Talon','Zulu','Echo','Bravo','Kilo','Nomad','Ranger','Spectre','Titan','Ivan','Hans','Pierre','Sven','Kenji','Jack','Mick','Boris'];

  let canvas, ctx, W=0, H=0, dpr=1;
  let S=null;           // battle state
  let settings={ control:'mouse', quality:2, name:'Pilot' };
  let onEnd=null;
  const input={ keys:{}, mx:0, my:0, lmb:false, rmb:false, wheel:0, gp:null };
  let backdrop=null;    // hangar backdrop world
  let lastT=0, acc=0; const DT=1/60;
  let hudMsgs=[];

  // ------------------------------------------------------------ setup
  function init(cv){
    canvas=cv; ctx=cv.getContext('2d'); resize(); window.addEventListener('resize',resize);
    window.addEventListener('keydown',e=>{ if(e.target.tagName==='INPUT'||e.target.tagName==='SELECT') return; input.keys[e.code]=true; if (S&&S.state!=='ended'){ keyPress(e.code); } if(['Space','ArrowUp','ArrowDown','ArrowLeft','ArrowRight','Tab'].includes(e.code)) e.preventDefault(); });
    window.addEventListener('keyup',e=>{ input.keys[e.code]=false; });
    cv.addEventListener('mousemove',e=>{ input.mx=e.clientX; input.my=e.clientY; });
    cv.addEventListener('mousedown',e=>{ if(e.button===0) input.lmb=true; if(e.button===2){ input.rmb=true; fireMissile(S&&S.player); } e.preventDefault(); });
    window.addEventListener('mouseup',e=>{ if(e.button===0) input.lmb=false; if(e.button===2) input.rmb=false; });
    cv.addEventListener('contextmenu',e=>e.preventDefault());
    cv.addEventListener('wheel',e=>{ if(!S) return; S.cam.userZoom=clamp(S.cam.userZoom*(e.deltaY>0?0.9:1.1),0.45,1.6); e.preventDefault(); },{passive:false});
    cv.addEventListener('touchstart',e=>{ const t=e.touches[0]; input.mx=t.clientX; input.my=t.clientY; input.lmb=true; e.preventDefault(); },{passive:false});
    cv.addEventListener('touchmove',e=>{ const t=e.touches[0]; input.mx=t.clientX; input.my=t.clientY; e.preventDefault(); },{passive:false});
    cv.addEventListener('touchend',e=>{ input.lmb=false; });
    window.addEventListener('gamepadconnected',()=>{ toast('Gamepad connected'); });
    requestAnimationFrame(frame);
  }
  function resize(){ dpr=Math.min(2,window.devicePixelRatio||1); W=window.innerWidth; H=window.innerHeight; canvas.width=W*dpr; canvas.height=H*dpr; canvas.style.width=W+'px'; canvas.style.height=H+'px'; }
  function toast(t){ hudMsgs.push({t, life:2.6}); }
  function keyPress(code){
    const p=S.player; if(!p) return;
    if (code==='KeyF') dropFlares(p);
    if (code==='KeyB'||code==='ControlLeft'||code==='ControlRight') dropBomb(p);
    if (code==='KeyE'||code==='ShiftLeft'||code==='ShiftRight') fireMissile(p);
    if (code==='KeyQ'||code==='KeyT'||code==='Tab') cycleTarget(p);
    if (code==='KeyR' && !p.alive && S.respawnT<=0) respawn();
    if (code==='Digit1'||code==='Digit2'||code==='Digit3'){ const i=parseInt(code.slice(5))-1; if (p.missiles&&p.missiles[i]){ p.missileIdx=i; toast(window.MISSILES[p.missiles[i].key].name+' selected'); Audio2.click(); } }
  }

  // ------------------------------------------------------------ battle creation
  function start(opts){
    const {planeId, mode, map, size, diff} = opts;
    const teamSize = mode==='test'?3:size;
    const worldSize = teamSize<=4?4800:teamSize<=8?6200:7600;
    const themes=['islands','plains','desert','winter']; const theme = map==='random'?themes[Math.floor(Math.random()*4)]:map;
    const seed = Math.floor(Math.random()*1e9);
    const world = World.create(theme, worldSize, seed);
    S = { state:'battle', mode, diff, world, size:worldSize, t:0, time: mode==='test'?1e9:(mode==='air'?9*60:11*60), planes:[], bullets:[], missiles:[], bombs:[], flares:[], ground:[], parts:[], fx:[], decals:[], feed:[], tickets:[mode==='ground'?150:100, mode==='ground'?150:100], maxTickets:mode==='ground'?150:100,
      cam:{x:0,y:0,zoom:1.3,userZoom:1,shake:0}, player:null, respawnT:0, lockedMissile:null, score:{kills:0,assists:0,ground:0,bases:0,deaths:0,damage:0,sl:0,rp:0,events:[]}, ended:false, warn:false, mini:null, playerDef: planeById(planeId), flybyT:0 };
    // bases
    const R = Art.rng(seed+5);
    const b0 = world.findLand(Art.rng(seed+11)); let b1 = world.findLand(Art.rng(seed+17));
    // push bases toward opposite corners
    b0.x = worldSize*0.18 + (b0.x-worldSize/2)*0.2; b0.y = worldSize*0.5 + (b0.y-worldSize/2)*0.5; b1.x = worldSize*0.82 + (b1.x-worldSize/2)*0.2; b1.y = worldSize*0.5 + (b1.y-worldSize/2)*0.5;
    S.bases=[ mkBase(0,b0.x,b0.y,R()*TAU), mkBase(1,b1.x,b1.y,R()*TAU) ];
    S.ground.push(...S.bases);
    const nTanks = mode==='ground'?8:mode==='test'?6:3, nAA = mode==='ground'?4:mode==='test'?2:2;
    for (const team of [0,1]){ const base=S.bases[team];
      for (let i=0;i<nTanks;i++){ const p=nearLand(base.x,base.y,300,1400,R); S.ground.push({kind:'tank',team,x:p.x,y:p.y,hd:R()*TAU,hp:130,maxhp:130,alive:true,r:16,cd:R()*3}); }
      for (let i=0;i<nAA;i++){ const p=nearLand(base.x,base.y,200,900,R); S.ground.push({kind:'aa',team,x:p.x,y:p.y,hd:0,hp:160,maxhp:160,alive:true,r:14,cd:R()*2}); }
    }
    // planes
    const pdef = planeById(planeId);
    const player = mkPlane(pdef, 0, settings.name||'Pilot', true); S.player=player; S.planes.push(player);
    const pool = t => { const rk=pdef.rank; const c=window.PLANES.filter(p=>Math.abs(p.rank-rk)<=1 && (mode!=='air' || p.role!=='Bomber')); return c.length?c:window.PLANES.filter(p=>p.rank===rk); };
    const names = AI_NAMES.slice().sort(()=>Math.random()-0.5);
    for (let team of [0,1]){ const n = team===0?teamSize-1:teamSize; for (let i=0;i<n;i++){ const c=pool(team); let def=c[Math.floor(Math.random()*c.length)]; if (mode==='ground' && i%3===1) { const at=c.filter(p=>p.bombs); if(at.length) def=at[Math.floor(Math.random()*at.length)]; } if (mode==='test'){ def = c.filter(p=>!p.bombs)[0]||def; }
      const ai = mkPlane(def, team, names.pop(), false); S.planes.push(ai); } }
    S.planes.forEach(p=>spawnAt(p, true));
    S.cam.x=player.x; S.cam.y=player.y;
    S.mini = makeMinimap(world);
    Audio2.ensure(); Audio2.engineStart(pdef.jet, pdef.ab); Audio2.music('battle'); Audio2.duck(true);
    feed('Battle started: '+ (mode==='air'?'Air Battle':mode==='ground'?'Ground Strike':'Test Flight') +' · '+theme);
    lastT=performance.now(); acc=0;
  }
  function nearLand(x,y,rmin,rmax,R){ for (let i=0;i<80;i++){ const a=R()*TAU, r=rmin+R()*(rmax-rmin); const px=clamp(x+Math.cos(a)*r,150,S.size-150), py=clamp(y+Math.sin(a)*r,150,S.size-150); if (S.world.isLand(px,py)) return {x:px,y:py}; } return {x,y}; }
  function mkBase(team,x,y,hd){ return {kind:'base',team,x,y,hd,hp:2600,maxhp:2600,alive:true,r:120,w:300,h:170}; }
  function mkPlane(def, team, name, isPlayer){
    const p={ def, team, name, isPlayer, x:0,y:0,hd:0, speed:def.speed*0.7, throttle:1, hp:def.hp, maxhp:def.hp, alive:true, ammo:0, maxAmmo:0, heat:0, cd:0, cd2:0, tcd:0, missiles:[], missileIdx:0, mcd:0, flares:def.flares||0, maxFlares:def.flares||0, fcd:0, bombs:def.bombs?def.bombs.n:0, bcd:0, bombReload:0, target:null, lockT:0, locked:false, dmgBy:new Map(), lastHitBy:null, lastHitT:-99, kills:0, score:0, deadT:0, spawnProt:0, ai:{ state:'hunt', retarget:0, evadeDir:1, evadeT:0, jinkT:0, fireT:0, throttle:1, gtarget:null, bombRun:0 }, prop:0, omega:0, sprite:null, wreck:null, respawns:0, smokeT:0, gunSoundT:0, trailT:0, alt:1 };
    if (def.guns){ p.ammo = Math.round(def.guns.rof*def.guns.n*28/Math.max(1,def.guns.n)) * (def.guns.cal==='gau'||def.guns.cal==='vulcan'?1:1); p.ammo = Math.max(150, Math.round(def.guns.rof*30)); p.maxAmmo=p.ammo; }
    if (def.guns2){ p.ammo2 = Math.max(200, Math.round(def.guns2.rof*30)); p.maxAmmo2=p.ammo2; }
    if (def.missiles) p.missiles = def.missiles.map(([key,n])=>({key,n,max:n}));
    Art.plane(def.id).then(sp=>p.sprite=sp);
    return p;
  }
  function spawnAt(p, initial){
    const base=S.bases[p.team]; const R=Math.random;
    const a = Math.atan2(S.size/2-base.y, S.size/2-base.x);
    const off = initial? (S.planes.indexOf(p)%8) : R()*8;
    p.x = base.x + Math.cos(a+Math.PI)*120 + Math.cos(a+Math.PI/2)*(off-3.5)*70 + (initial?0:rnd(-80,80));
    p.y = base.y + Math.sin(a+Math.PI)*120 + Math.sin(a+Math.PI/2)*(off-3.5)*70 + (initial?0:rnd(-80,80));
    p.hd = Math.atan2(Math.cos(a), -Math.sin(a)) ; // heading such that velocity points along a: vel=(sin hd,-cos hd)
    p.hd = Math.atan2(Math.cos(a), -Math.sin(a));
    p.speed=p.def.speed*0.6; p.throttle=1; p.hp=p.maxhp; p.alive=true; p.ammo=p.maxAmmo; p.ammo2=p.maxAmmo2; p.heat=0; p.flares=p.maxFlares; p.bombs=p.def.bombs?p.def.bombs.n:0; p.missiles.forEach(m=>m.n=m.max); p.target=null; p.lockT=0; p.locked=false; p.dmgBy=new Map(); p.spawnProt=3; p.wreck=null; p.ai.state='hunt'; p.ai.retarget=0;
  }

  // ------------------------------------------------------------ minimap thumbnail
  function makeMinimap(world){ const n=96; const c=document.createElement('canvas'); c.width=n; c.height=n; const x=c.getContext('2d'); const img=x.createImageData(n,n); const T=world.T; for(let j=0;j<n;j++) for(let i=0;i<n;i++){ const h=world.height((i+0.5)*world.size/n,(j+0.5)*world.size/n); const k=(j*n+i)*4; let col; if (h<T.sea) col=T.deep; else if (h-T.sea<0.02) col=T.sand; else if (h-T.sea>0.3) col=T.rock; else col=T.grass[1]; img.data[k]=col[0]; img.data[k+1]=col[1]; img.data[k+2]=col[2]; img.data[k+3]=255; } x.putImageData(img,0,0); return c; }

  // ------------------------------------------------------------ main loop
  function frame(now){
    requestAnimationFrame(frame);
    const dtReal=Math.min(0.1,(now-lastT)/1000); lastT=now;
    if (S && S.state==='battle'){ acc+=dtReal; let n=0; while(acc>=DT && n<4){ step(DT); acc-=DT; n++; } if(n===4) acc=0; }
    render(dtReal);
  }

  // ------------------------------------------------------------ simulation
  function step(dt){
    S.t+=dt; if (S.mode!=='test') S.time-=dt;
    pollGamepad();
    const P=S.player;
    if (P.alive) playerControl(P, dt); else { S.respawnT-=dt; if (S.respawnT<=0 && (input.keys.Space||input.lmb||input.keys.KeyR||input.keys.Enter)) respawn(); }
    for (const p of S.planes){ if (!p.isPlayer && p.alive) aiControl(p, dt); }
    for (const p of S.planes) updatePlane(p, dt);
    updateBullets(dt); updateMissiles(dt); updateBombs(dt); updateFlares(dt); updateGround(dt); updateParticles(dt);
    // camera
    const cam=S.cam; const tgt = P.alive?P:(P.wreck||P);
    const vx=Math.sin(tgt.hd)*(tgt.speed||0), vy=-Math.cos(tgt.hd)*(tgt.speed||0);
    cam.x=lerp(cam.x, tgt.x+vx*0.28, 1-Math.pow(0.02,dt)); cam.y=lerp(cam.y, tgt.y+vy*0.28, 1-Math.pow(0.02,dt));
    const speedZoom = 1 - clamp((P.speed-300)/900,0,1)*0.3; const base = Math.min(1, W/1400)*1.35;
    cam.zoom = lerp(cam.zoom, base*cam.userZoom*speedZoom, 1-Math.pow(0.05,dt)); cam.shake*=Math.pow(0.02,dt);
    // sound
    Audio2.engineUpdate(P.alive?P.throttle:0, P.speed/P.def.speed, P.def.ab && P.throttle>0.92);
    let warn=false; for (const m of S.missiles) if (m.target===P) warn=true; if (warn!==S.warn){ S.warn=warn; Audio2.warning(warn); }
    // fly-by sounds
    S.flybyT-=dt; if (S.flybyT<=0){ for (const p of S.planes){ if (p!==P&&p.alive&&P.alive&&dist(p,P)<140&&p.speed>250){ Audio2.flyby((p.x-P.x)/200); S.flybyT=1.5; break; } } }
    // win check
    if (S.mode!=='test'){ if (S.tickets[0]<=0||S.tickets[1]<=0||S.time<=0) endBattle(); }
  }
  function respawn(){ const P=S.player; if (S.tickets[0]<=0) return; spawnAt(P,false); P.respawns++; S.respawnT=0; Audio2.engineStart(P.def.jet,P.def.ab); }

  // ---------------- player control
  function playerControl(p, dt){
    const def=p.def;
    let turnCmd=0, thrCmd=0;
    const k=input.keys;
    if (k.KeyW||k.ArrowUp) thrCmd=1; if (k.KeyS||k.ArrowDown) thrCmd=-1;
    p.throttle=clamp(p.throttle+thrCmd*0.9*dt,0,1);
    const gp=input.gp;
    if (gp){ const lx=gp.axes[0], ly=gp.axes[1]; if (gp.buttons[5]&&gp.buttons[5].pressed) p.throttle=clamp(p.throttle+0.9*dt,0,1); if (gp.buttons[4]&&gp.buttons[4].pressed) p.throttle=clamp(p.throttle-0.9*dt,0,1);
      if (Math.hypot(lx,ly)>0.35){ if (settings.control==='mouse'){ const want=Math.atan2(lx,-ly); turnCmd=clamp(norm(want-p.hd)*4,-1,1); p.gpAim=true; } else turnCmd=lx; } }
    if (settings.control==='mouse' && !p.gpAim){
      const wx=S.cam.x+(input.mx-W/2)/S.cam.zoom, wy=S.cam.y+(input.my-H/2)/S.cam.zoom;
      const d=Math.hypot(wx-p.x,wy-p.y); if (d>28){ const want=Math.atan2(wx-p.x,-(wy-p.y)); turnCmd=clamp(norm(want-p.hd)*3.5,-1,1); }
      if (k.KeyA||k.ArrowLeft) turnCmd=-1; if (k.KeyD||k.ArrowRight) turnCmd=1;
    } else { if (k.KeyA||k.ArrowLeft) turnCmd=-1; if (k.KeyD||k.ArrowRight) turnCmd=1; }
    p.gpAim=false;
    p.turnCmd=turnCmd;
    const firing = k.Space||input.lmb||(gp&&gp.buttons[7]&&gp.buttons[7].value>0.5);
    if (firing) fireGuns(p, dt);
    if (gp){ if (gp.buttons[6]&&gp.buttons[6].value>0.5) fireMissile(p); if (gp.buttons[0]&&gp.buttons[0].pressed) dropFlares(p); if (gp.buttons[2]&&gp.buttons[2].pressed) dropBomb(p); if (gp.buttons[3]&&gp.buttons[3].pressed&&!p.gpY) cycleTarget(p); p.gpY=gp.buttons[3]&&gp.buttons[3].pressed; }
    // target selection: auto pick nearest enemy in front if none
    const acq = Math.max(3200, ...p.missiles.map(m=>window.MISSILES[m.key].range*1.3)); if (!p.target||!p.target.alive||dist(p,p.target)>acq*1.4) p.target=pickTarget(p, acq, 75);
    updateLock(p, dt);
  }
  function pollGamepad(){ input.gp=null; if (!navigator.getGamepads) return; const gps=navigator.getGamepads(); for (const g of gps){ if (g&&g.connected){ input.gp=g; break; } } }
  function pickTarget(p, range, coneDeg, exclude){
    let best=null, bs=1e9; for (const e of S.planes){ if (e.team===p.team||!e.alive||e===exclude) continue; const d=dist(p,e); if (d>range) continue; const a=Math.abs(norm(Math.atan2(e.x-p.x,-(e.y-p.y))-p.hd)); if (a>coneDeg*DEG) continue; const s=d*(0.4+a); if (s<bs){ bs=s; best=e; } } return best;
  }
  function cycleTarget(p){ const cands=S.planes.filter(e=>e.team!==p.team&&e.alive&&dist(p,e)<3200).sort((a,b)=>dist(p,a)-dist(p,b)); if(!cands.length) return; const i=cands.indexOf(p.target); p.target=cands[(i+1)%cands.length]; p.lockT=0; p.locked=false; Audio2.click(); }
  function updateLock(p, dt){
    const m=p.missiles&&p.missiles[p.missileIdx]; if (!m||m.n<=0||!p.target||!p.target.alive){ p.lockT=0; p.locked=false; return; }
    const md=window.MISSILES[m.key]; const t=p.target; const d=dist(p,t); const a=Math.abs(norm(Math.atan2(t.x-p.x,-(t.y-p.y))-p.hd));
    const cone = (md.ir?22:40)*DEG;
    if (d<md.range && a<cone){ p.lockT+=dt; if (!p.locked && p.lockT>=(md.ir?0.9:1.4)){ p.locked=true; if(p.isPlayer) Audio2.lock(); } else if (p.isPlayer && !p.locked && Math.floor(p.lockT*6)!==Math.floor((p.lockT-dt)*6)) Audio2.lockTone(); }
    else { p.lockT=Math.max(0,p.lockT-dt*2); if (p.lockT<=0) p.locked=false; }
  }

  // ---------------- AI
  function aiControl(p, dt){
    const ai=p.ai, def=p.def, diff=S.diff; const react = diff===0?0.5:diff===1?0.8:1.0;
    ai.retarget-=dt;
    const isBomber = !!def.bombs && (def.role==='Bomber' || def.role==='Attacker');
    const enemies = S.planes.filter(e=>e.team!==p.team&&e.alive);
    if (ai.retarget<=0){ ai.retarget=1.5+Math.random();
      let best=null,bs=1e9; for (const e of enemies){ let s=dist(p,e); if (e===p.lastHitBy && S.t-p.lastHitT<4) s*=0.4; if (e.isPlayer) s*=0.85; if (e.target===p) s*=0.7; if (e.def.role==='Bomber') s*=0.8; if (s<bs){bs=s;best=e;} }
      p.target=best;
      if (isBomber){ let gb=null, gs=1e9; for (const g of S.ground){ if (g.team===p.team||!g.alive) continue; let s=dist(p,g); if (g.kind==='base') s*=0.5; if (s<gs){gs=s;gb=g;} } ai.gtarget=gb; }
    }
    // threats
    let threat=null, td=1e9;
    for (const e of enemies){ const d=dist(p,e); if (d<560){ const a=Math.abs(norm(Math.atan2(p.x-e.x,-(p.y-e.y))-e.hd)); if (a<25*DEG && d<td){ td=d; threat=e; } } }
    let missileIn=null; for (const m of S.missiles) if (m.target===p && dist(m,p)<900) missileIn=m;
    let want=p.hd, thr=1, turnMax=1;
    ai.evadeT-=dt; ai.jinkT-=dt;
    if (missileIn && Math.random()<react*0.9){ if (p.fcd<=0 && p.flares>0) dropFlares(p); ai.state='evade'; ai.evadeT=Math.max(ai.evadeT,0.8); }
    if (threat && ai.state!=='evade' && Math.random()<react*dt*3){ ai.state='evade'; ai.evadeT=1.2+Math.random()*1.6; ai.evadeDir=Math.random()<0.5?-1:1; }
    if (ai.state==='evade'){ want=p.hd+ai.evadeDir*1.2; thr=1; if (ai.evadeT<=0){ ai.state='hunt'; } if (ai.jinkT<=0){ ai.jinkT=0.6+Math.random()*0.8; if (Math.random()<0.35) ai.evadeDir*=-1; } }
    else if (isBomber && ai.gtarget && p.bombs>0){
      const g=ai.gtarget; const d=dist(p,g); want=Math.atan2(g.x-p.x,-(g.y-p.y)); thr=1;
      if (d < (g.kind==='base'?90:40) + p.speed*0.35 && p.bcd<=0){ dropBomb(p); }
      if (def.guns && def.guns.cal==='gau' && d<500 && Math.abs(norm(want-p.hd))<4*DEG) fireGuns(p,dt);
    }
    else if (p.target){
      const t=p.target; const d=dist(p,t);
      const gs = def.guns?def.guns.speed:1500; const tt=d/(gs+p.speed*0.5);
      const jit = diff===0?90:diff===1?35:10;
      const lx=t.x+Math.sin(t.hd)*t.speed*tt + rnd(-jit,jit), ly=t.y-Math.cos(t.hd)*t.speed*tt + rnd(-jit,jit);
      want=Math.atan2(lx-p.x,-(ly-p.y));
      const off=Math.abs(norm(want-p.hd));
      const closing = (Math.sin(p.hd)*p.speed-Math.sin(t.hd)*t.speed)*(t.x-p.x) + (-Math.cos(p.hd)*p.speed+Math.cos(t.hd)*t.speed)*(t.y-p.y) > 0;
      thr = (d<170 && closing && off<0.5)?0.45:1;
      if (def.guns && d<def.guns.range*0.95 && off<(diff===2?4:diff===1?6:9)*DEG) fireGuns(p,dt);
      // missiles
      if (p.missiles.length){ updateLock(p,dt); if (p.locked && d>250 && Math.random()<dt*react*1.5) fireMissile(p); }
      if (isBomber && p.bombs<=0 && def.role==='Bomber'){ // bombers without bombs: circle home
        const b=S.bases[p.team]; if (b) want=Math.atan2(b.x-p.x,-(b.y-p.y)); }
    } else { // wander toward map center-ish
      const cx=S.size/2+Math.sin(S.t*0.1+p.x*0.001)*S.size*0.25, cy=S.size/2+Math.cos(S.t*0.13)*S.size*0.25; want=Math.atan2(cx-p.x,-(cy-p.y)); thr=0.8;
    }
    // boundaries
    const m=250; if (p.x<m||p.y<m||p.x>S.size-m||p.y>S.size-m){ want=Math.atan2(S.size/2-p.x,-(S.size/2-p.y)); }
    // collision avoidance
    for (const o of S.planes){ if (o===p||!o.alive) continue; const d=dist(p,o); if (d<60){ const a=Math.atan2(o.x-p.x,-(o.y-p.y)); const s=norm(a-p.hd); want=p.hd-(s>0?1:-1)*1.0; break; } }
    const diffA=norm(want-p.hd); p.turnCmd=clamp(diffA*3,-1,1)*turnMax;
    p.throttle=lerp(p.throttle,thr,dt*2);
    // stall avoidance
    if (p.speed<def.speed*0.4) p.throttle=1;
  }

  // ---------------- plane physics
  function updatePlane(p, dt){
    const def=p.def;
    if (!p.alive){ if (p.wreck) updateWreck(p, dt); return; }
    p.spawnProt=Math.max(0,p.spawnProt-dt); p.cd-=dt; p.cd2-=dt; p.mcd-=dt; p.fcd-=dt; p.bcd-=dt; p.tcd-=dt; p.heat=Math.max(0,p.heat-dt*0.35);
    if (def.bombs && p.bombs===0){ p.bombReload-=dt; if (p.bombReload<=0){ p.bombs=def.bombs.n; if (p.isPlayer) toast('Bombs reloaded'); } }
    const vmax=def.speed, vmin=vmax*0.32; const tgt=vmin+(vmax-vmin)*p.throttle;
    const dv=tgt-p.speed; p.speed += clamp(dv, -def.accel*dt*1.6, def.accel*dt*(def.ab&&p.throttle>0.92?1.3:1));
    const sf=p.speed/vmax; const f = sf<0.55 ? 0.42+0.58*(sf/0.55) : 1-(sf-0.55)/0.45*0.42;
    const turnAvail = def.turn*DEG*f;
    const omega = clamp(p.turnCmd||0,-1,1)*turnAvail; p.omega=omega;
    p.hd=norm(p.hd+omega*dt);
    p.speed -= Math.abs(omega)*p.speed*0.055*dt; p.speed=Math.max(vmin*0.8,p.speed);
    p.x+=Math.sin(p.hd)*p.speed*dt; p.y-=Math.cos(p.hd)*p.speed*dt;
    // hard boundary
    p.x=clamp(p.x,40,S.size-40); p.y=clamp(p.y,40,S.size-40);
    p.prop+=p.speed*0.08*dt+p.throttle*30*dt;
    // effects
    const q=onScreen(p)?settings.quality:0;
    if (p.hp<p.maxhp*0.5){ p.smokeT-=dt; if (p.smokeT<=0){ p.smokeT=p.hp<p.maxhp*0.25?0.035:0.08; const tail=tailPos(p); addPart({x:tail.x,y:tail.y,vx:rnd(-15,15),vy:rnd(-15,15),life:rnd(1.2,2.2),r:rnd(6,10),grow:14,col:p.hp<p.maxhp*0.25?[40,40,40]:[120,120,120],a:0.55,type:'smoke'}); if (p.hp<p.maxhp*0.25 && q>0) addPart({x:tail.x,y:tail.y,vx:rnd(-20,20),vy:rnd(-20,20),life:rnd(0.2,0.45),r:rnd(4,7),grow:-6,col:[255,150,40],a:0.9,type:'fire'}); } }
    if (q>0 && Math.abs(omega)>turnAvail*0.7 && sf>0.5){ const s=wingtips(p); if (p.prevTips){ for (let i=0;i<2;i++) addPart({x:s[i].x,y:s[i].y,x2:p.prevTips[i].x,y2:p.prevTips[i].y,vx:0,vy:0,life:0.55,r:2,grow:0,col:[255,255,255],a:0.55,type:'vortex'}); } p.prevTips=s; } else p.prevTips=null;
    if (q>1 && def.jet && p.throttle>0.85 && sf>0.7){ const tail=tailPos(p); if (p.prevTail) addPart({x:tail.x,y:tail.y,x2:p.prevTail.x,y2:p.prevTail.y,vx:0,vy:0,life:1.4,r:3,grow:0,col:[255,255,255],a:0.22,type:'vortex'}); p.prevTail=tail; } else p.prevTail=null;
    // turrets
    if (def.turret && p.tcd<=0){ const e=nearestEnemy(p, def.turret.range); if (e){ p.tcd=1/def.turret.rof; const a=Math.atan2(e.x-p.x,-(e.y-p.y))+rnd(-1,1)*def.turret.spread*DEG; spawnBullet(p,p.x,p.y,a,def.turret,p.speed*0.3); } }
    // ground collision at very low speed? (none: arcade)
  }
  function onScreen(p, margin){ const c=S.cam; const hw=W/2/c.zoom+(margin||120), hh=H/2/c.zoom+(margin||120); return Math.abs(p.x-c.x)<hw && Math.abs(p.y-c.y)<hh; }
  function tailPos(p){ const L=p.def.size; return {x:p.x-Math.sin(p.hd)*L*0.45, y:p.y+Math.cos(p.hd)*L*0.45}; }
  function nosePos(p){ const L=p.def.size; return {x:p.x+Math.sin(p.hd)*L*0.5, y:p.y-Math.cos(p.hd)*L*0.5}; }
  function wingtips(p){ const sp=p.sprite; const half=(sp?sp.span:p.def.size)*0.5; const cx=Math.cos(p.hd), sx=Math.sin(p.hd); return [{x:p.x+cx*half,y:p.y+sx*half},{x:p.x-cx*half,y:p.y-sx*half}]; }
  function nearestEnemy(p, range){ let b=null,bd=range; for (const e of S.planes){ if (e.team===p.team||!e.alive) continue; const d=dist(p,e); if (d<bd){bd=d;b=e;} } return b; }
  function updateWreck(p, dt){
    const w=p.wreck; w.t+=dt; p.x+=Math.sin(p.hd)*p.speed*dt; p.y-=Math.cos(p.hd)*p.speed*dt; p.speed*=Math.pow(0.5,dt); p.hd+=w.spin*dt; p.alt=Math.max(0,1-w.t/w.dur);
    w.st-=dt; if (w.st<=0){ w.st=0.05; addPart({x:p.x,y:p.y,vx:rnd(-20,20),vy:rnd(-20,20),life:1.6,r:8,grow:16,col:[30,30,30],a:0.6,type:'smoke'}); addPart({x:p.x+rnd(-8,8),y:p.y+rnd(-8,8),vx:0,vy:0,life:0.3,r:6,grow:-8,col:[255,140,40],a:0.9,type:'fire'}); }
    if (w.t>=w.dur){ p.wreck=null; explosionFx(p.x,p.y,0.8,true); Audio2.explosion((p.x-S.player.x)/600, dist(p,S.player), 0.8); }
  }

  // ---------------- weapons
  function fireGuns(p, dt){
    const def=p.def; if (!def.guns&&!def.guns2) return; if (p.heat>=1) return;
    const shoot=(g, which)=>{
      const cdKey = which===1?'cd':'cd2', ammoKey=which===1?'ammo':'ammo2';
      if (p[cdKey]>0 || p[ammoKey]<=0) return;
      p[cdKey] = 1/(g.rof*(g.n>1?1:1)); p[ammoKey]--; p.heat+=0.012*(g.cal==='gau'||g.cal==='vulcan'?0.5:1)*(1/(g.rof/9));
      p.shotIdx=(p.shotIdx||0)+1;
      const L=def.size; const spanH=(p.sprite?p.sprite.span:L)*0.5;
      let ox=0, oy=-L*0.42; if (g.n>=2 && g.cal!=='c37' && g.cal!=='c30' && !(g.n===1)){ const side=(p.shotIdx%2?1:-1); ox=side*spanH*(g.n>=4?0.28:0.2); oy=-L*0.12; }
      // Correct rotation: world = (lx*cos - ly*sin?, ...). With heading hd (0 = up), forward = (sin hd, -cos hd), right = (cos hd, sin hd).
      const fwd={x:Math.sin(p.hd),y:-Math.cos(p.hd)}, right={x:Math.cos(p.hd),y:Math.sin(p.hd)};
      const sxp=p.x+right.x*ox+fwd.x*(-oy), syp=p.y+right.y*ox+fwd.y*(-oy);
      const a=p.hd+rnd(-1,1)*g.spread*DEG*(p.isPlayer?0.8:(S.diff===0?2.6:S.diff===1?1.9:1.3));
      spawnBullet(p, sxp, syp, a, g, p.speed);
      addPart({x:sxp,y:syp,vx:fwd.x*p.speed,vy:fwd.y*p.speed,life:0.04,r:g.size*1.2+1.5,grow:0,col:[255,220,120],a:0.8,type:'flash'});
      if (S.t-p.gunSoundT>0.055){ p.gunSoundT=S.t; Audio2.gun(g.cal,(p.x-S.cam.x)/900, p.isPlayer?0:dist(p,S.player)); }
    };
    if (def.guns) shoot(def.guns,1); if (def.guns2) shoot(def.guns2,2);
    p.firing=true;
  }
  function spawnBullet(p, x, y, a, g, baseSpeed){ const sp=g.speed+baseSpeed*0.6; S.bullets.push({x,y,px:x,py:y,vx:Math.sin(a)*sp,vy:-Math.cos(a)*sp,life:g.range/g.speed,dmg:g.dmg,team:p.team,owner:p,col:g.col,size:g.size}); }
  function fireMissile(p){
    if (!p||!p.alive||!p.missiles.length||p.mcd>0) return; const m=p.missiles[p.missileIdx]; if (!m||m.n<=0){ if (p.isPlayer){ const alt=p.missiles.findIndex(x=>x.n>0); if (alt>=0){ p.missileIdx=alt; toast(window.MISSILES[p.missiles[alt].key].name+' selected'); } } return; }
    if (!p.locked||!p.target){ if (p.isPlayer) toast('No lock — keep the target in the seeker cone'); return; }
    const md=window.MISSILES[m.key]; m.n--; p.mcd=0.6; p.locked=false; p.lockT=0.3;
    const side=(m.n%2?1:-1); const right={x:Math.cos(p.hd),y:Math.sin(p.hd)}; const spanH=(p.sprite?p.sprite.span:p.def.size)*0.5;
    S.missiles.push({x:p.x+right.x*spanH*0.35*side, y:p.y+right.y*spanH*0.35*side, hd:p.hd, speed:p.speed+150, def:md, key:m.key, target:p.target, team:p.team, owner:p, life:md.life, t:0, trailT:0, spr:null});
    Art.missile(m.key).then(s=>{ const last=S.missiles[S.missiles.length-1]; S.missiles.forEach(mm=>{ if(mm.key===m.key&&!mm.spr) mm.spr=s; }); });
    Audio2.missileLaunch((p.x-S.cam.x)/900, p.isPlayer?0:dist(p,S.player));
    if (p.target.isPlayer) feed(p.name+' launched a '+md.name+' at you!');
  }
  function dropFlares(p){ if (!p.alive||p.flares<=0||p.fcd>0) return; p.fcd=0.35; p.flares-=2; if (p.flares<0) p.flares=0; const tail=tailPos(p); for (let i=0;i<2;i++){ const side=i?1:-1; S.flares.push({x:tail.x,y:tail.y,vx:Math.sin(p.hd)*p.speed*0.5+Math.cos(p.hd)*side*90+rnd(-30,30),vy:-Math.cos(p.hd)*p.speed*0.5+Math.sin(p.hd)*side*90+rnd(-30,30),life:2.6,owner:p,t:0}); } Audio2.flare((p.x-S.cam.x)/900, p.isPlayer?0:dist(p,S.player)); }
  function dropBomb(p){ if (!p.alive||p.bombs<=0||p.bcd>0) return; p.bombs--; p.bcd=0.28; if (p.bombs===0) p.bombReload=30; const b=p.def.bombs; S.bombs.push({x:p.x,y:p.y,vx:Math.sin(p.hd)*p.speed*0.75,vy:-Math.cos(p.hd)*p.speed*0.75,t:1.35,dmg:b.dmg,r:b.r,owner:p,team:p.team,hd:p.hd,sc:1}); if (p.isPlayer) Audio2.bombDrop(); }

  function updateBullets(dt){
    const B=S.bullets;
    for (let i=B.length-1;i>=0;i--){ const b=B[i]; b.px=b.x; b.py=b.y; b.x+=b.vx*dt; b.y+=b.vy*dt; b.life-=dt; let dead=b.life<=0;
      if (!dead){ // planes
        for (const p of S.planes){ if (!p.alive||p.team===b.team) continue; if (Math.abs(p.x-b.x)>90||Math.abs(p.y-b.y)>90) continue; if (hitPlane(p,b.x,b.y)||hitPlane(p,(b.x+b.px)/2,(b.y+b.py)/2)){ damagePlane(p,b.dmg,b.owner,'gun'); hitFx(b.x,b.y,b.dmg>15); dead=true; break; } }
        if (!dead) for (const g of S.ground){ if (!g.alive||g.team===b.team) continue; const rr=g.kind==='base'?g.r:g.r+4; if (Math.abs(g.x-b.x)<rr&&Math.abs(g.y-b.y)<rr && (g.kind==='base'?inBase(g,b.x,b.y):Math.hypot(g.x-b.x,g.y-b.y)<rr)){ damageGround(g,b.dmg*(g.kind==='base'?0.25:g.kind==='tank'?(b.dmg>15?0.9:0.25):0.8),b.owner); hitFx(b.x,b.y,false); dead=true; break; } }
      }
      if (dead){ B[i]=B[B.length-1]; B.pop(); }
    }
  }
  function hitPlane(p,x,y){ const dx=x-p.x, dy=y-p.y; const c=Math.cos(p.hd), s=Math.sin(p.hd); const lx=dx*c+dy*s, ly=-dx*s+dy*c; const sp=p.sprite; const a=(sp?sp.span:p.def.size)*0.5*0.88, b=p.def.size*0.5*0.95; return (lx*lx)/(a*a)+(ly*ly)/(b*b)<=1; }
  function inBase(g,x,y){ const dx=x-g.x, dy=y-g.y; const c=Math.cos(g.hd), s=Math.sin(g.hd); const lx=dx*c+dy*s, ly=-dx*s+dy*c; return Math.abs(lx)<g.w/2&&Math.abs(ly)<g.h/2; }
  function updateMissiles(dt){
    const M=S.missiles;
    for (let i=M.length-1;i>=0;i--){ const m=M[i]; m.t+=dt; m.life-=dt; const md=m.def;
      m.speed=Math.min(md.speed, m.speed+ (m.t<0.35?400:1900)*dt);
      // decoy by flares
      if (m.target && m.target.alive!==undefined && m.t>0.3){ for (const f of S.flares){ if (f.owner===m.target && Math.hypot(f.x-m.x,f.y-m.y)<520 && Math.random()<dt*(md.ir?2.2:0.6)){ m.target=f; break; } } }
      if (m.target && (m.target.alive===false || (m.target.life!==undefined&&m.target.life<=0))) m.target=null;
      if (m.target && m.t>0.25){ const t=m.target; const tv = t.speed!==undefined?{x:Math.sin(t.hd)*t.speed,y:-Math.cos(t.hd)*t.speed}:{x:t.vx||0,y:t.vy||0}; const d=Math.hypot(t.x-m.x,t.y-m.y); const tt=d/Math.max(200,m.speed); const lx=t.x+tv.x*tt*0.85, ly=t.y+tv.y*tt*0.85; const want=Math.atan2(lx-m.x,-(ly-m.y)); const diff=norm(want-m.hd); const tr=md.turn*DEG*dt; m.hd=norm(m.hd+clamp(diff,-tr,tr)); if (Math.abs(diff)>75*DEG && d<160) m.target=null; }
      m.x+=Math.sin(m.hd)*m.speed*dt; m.y-=Math.cos(m.hd)*m.speed*dt;
      m.trailT-=dt; if (m.trailT<=0 && onScreen(m,300)){ m.trailT=0.022; addPart({x:m.x-Math.sin(m.hd)*12,y:m.y+Math.cos(m.hd)*12,vx:rnd(-8,8),vy:rnd(-8,8),life:1.1,r:3,grow:9,col:[230,230,230],a:0.55,type:'smoke'}); if (m.t<2.2&&settings.quality>0) addPart({x:m.x-Math.sin(m.hd)*12,y:m.y+Math.cos(m.hd)*12,vx:0,vy:0,life:0.08,r:5,grow:0,col:[255,200,90],a:0.9,type:'fire'}); }
      let dead=m.life<=0;
      if (!dead){ for (const p of S.planes){ if (!p.alive||p.team===m.team) continue; const d=Math.hypot(p.x-m.x,p.y-m.y); if (d<26+ (p.def.size*0.15)){ damagePlane(p,md.dmg,m.owner,'missile'); for (const o of S.planes){ if (o!==p&&o.alive&&o.team!==m.team&&dist(o,m)<80) damagePlane(o,md.dmg*0.35,m.owner,'missile'); } explosionFx(m.x,m.y,0.55,false); Audio2.explosion((m.x-S.cam.x)/900, dist(m,S.player), 0.6); dead=true; break; } }
        if (!dead && m.target && m.target.life!==undefined && Math.hypot(m.target.x-m.x,m.target.y-m.y)<20){ explosionFx(m.x,m.y,0.4,false); dead=true; }
        if (!dead && (m.x<0||m.y<0||m.x>S.size||m.y>S.size)) dead=true;
      }
      if (dead){ if (m.life<=0) { explosionFx(m.x,m.y,0.3,false); } M[i]=M[M.length-1]; M.pop(); }
    }
  }
  function updateBombs(dt){ const B=S.bombs; for (let i=B.length-1;i>=0;i--){ const b=B[i]; b.x+=b.vx*dt; b.y+=b.vy*dt; b.vx*=Math.pow(0.35,dt); b.vy*=Math.pow(0.35,dt); b.t-=dt; b.sc=0.5+b.t/1.35*0.5;
    if (b.t<=0){ explosionFx(b.x,b.y,1.0,true); Audio2.explosion((b.x-S.cam.x)/900, dist(b,S.player), 1.1); S.decals.push({x:b.x,y:b.y,r:b.r*0.55,life:40});
      for (const g of S.ground){ if (!g.alive) continue; const d=g.kind==='base'?(inBase(g,b.x,b.y)?0:Math.hypot(g.x-b.x,g.y-b.y)-80):Math.hypot(g.x-b.x,g.y-b.y); if (d<b.r){ damageGround(g, b.dmg*(1-Math.max(0,d)/b.r*0.6)*(g.team===b.team?0.3:1), b.owner); } }
      for (const p of S.planes){ if (!p.alive||p===b.owner) continue; const d=dist(p,b); if (d<b.r*0.6) damagePlane(p,b.dmg*0.25,b.owner,'bomb'); }
      B[i]=B[B.length-1]; B.pop(); } } }
  function updateFlares(dt){ const F=S.flares; for (let i=F.length-1;i>=0;i--){ const f=F[i]; f.t+=dt; f.life-=dt; f.x+=f.vx*dt; f.y+=f.vy*dt; f.vx*=Math.pow(0.2,dt); f.vy*=Math.pow(0.2,dt); if (settings.quality>0&&Math.random()<dt*30) addPart({x:f.x,y:f.y,vx:rnd(-6,6),vy:rnd(-6,6),life:0.9,r:3,grow:6,col:[220,220,220],a:0.5,type:'smoke'}); if (f.life<=0){ F[i]=F[F.length-1]; F.pop(); } } }
  function updateGround(dt){
    for (const g of S.ground){ if (!g.alive) continue; g.cd-=dt;
      if (g.kind==='tank'){ if (g.cd<=0){ g.cd=rnd(2,6); g.want=g.hd+rnd(-1.2,1.2); } if (g.want!==undefined) g.hd+=clamp(norm(g.want-g.hd),-0.6*dt,0.6*dt); const nx=g.x+Math.sin(g.hd)*14*dt, ny=g.y-Math.cos(g.hd)*14*dt; if (S.world.isLand(nx,ny)&&nx>100&&ny>100&&nx<S.size-100&&ny<S.size-100){ g.x=nx; g.y=ny; } else { g.want=g.hd+Math.PI; g.cd=2; } }
      else if (g.kind==='aa'){ const e=nearestEnemyPlaneTo(g, 720); if (e){ const tt=dist(g,e)/900; const lx=e.x+Math.sin(e.hd)*e.speed*tt, ly=e.y-Math.cos(e.hd)*e.speed*tt; g.hd=Math.atan2(lx-g.x,-(ly-g.y)); if (g.cd<=0){ g.cd=1.15; const fx=lx+rnd(-70,70), fy=ly+rnd(-70,70); S.fx.push({type:'flak',x:fx,y:fy,t:0,delay:tt*0.9,r:22,team:g.team,owner:g}); } } }
      else if (g.kind==='base' && g.hp<g.maxhp*0.5 && Math.random()<dt*6){ addPart({x:g.x+rnd(-100,100),y:g.y+rnd(-50,50),vx:rnd(-6,6),vy:rnd(-6,6),life:2.5,r:8,grow:18,col:[50,50,50],a:0.5,type:'smoke'}); }
    }
  }
  function nearestEnemyPlaneTo(g, range){ let b=null,bd=range; for (const e of S.planes){ if (e.team===g.team||!e.alive) continue; const d=dist(g,e); if (d<bd){bd=d;b=e;} } return b; }

  // ---------------- damage
  function damagePlane(p, dmg, attacker, kind){
    if (!p.alive) return; if (p.spawnProt>0) dmg*=0.15; if (S.mode==='test'&&p.isPlayer) dmg*=0.3;
    p.hp-=dmg; if (attacker){ p.dmgBy.set(attacker,(p.dmgBy.get(attacker)||0)+dmg); p.lastHitBy=attacker; p.lastHitT=S.t; if (attacker.isPlayer) S.score.damage+=dmg; }
    if (p.isPlayer){ S.cam.shake=Math.min(14,S.cam.shake+dmg*0.4); Audio2.hit((p.x-S.cam.x)/900,0,dmg>15); p.hitFlash=0.25; }
    else if (attacker&&attacker.isPlayer){ Audio2.hit((p.x-S.cam.x)/900, dist(p,S.player)*0.5, dmg>15); S.hitMarker=0.12; }
    if (p.hp<=0) killPlane(p, attacker, kind);
  }
  function killPlane(p, attacker, kind){
    p.alive=false; p.hp=0; p.deadT=S.t; p.locked=false; p.target=null;
    p.wreck={t:0,dur:rnd(1.4,2.4),spin:rnd(-3,3),st:0};
    explosionFx(p.x,p.y,0.9+p.def.size/120,false); Audio2.explosion((p.x-S.cam.x)/900, p.isPlayer?0:dist(p,S.player), 1+p.def.size/150);
    for (const m of S.missiles) if (m.target===p) m.target=null;
    const rankMul = 1+0.35*(S.playerDef.rank-1);
    S.tickets[p.team]-= S.mode==='ground'?4:5;
    let who = attacker?attacker.name:'flak';
    if (attacker && attacker.alive!==undefined && attacker.kind===undefined){ attacker.kills++; attacker.score+=100; }
    if (attacker && attacker.isPlayer){ S.score.kills++; const sl=Math.round(420*rankMul*(p.def.role==='Bomber'?1.3:1)), rp=Math.round(70*rankMul); reward(sl,rp,'Shot down '+p.name+' ('+p.def.name+')'); Audio2.kill(); S.killFlash={t:0,text:'TARGET DESTROYED',sub:p.name+' · '+p.def.name}; }
    // assists
    for (const [a,d] of p.dmgBy){ if (a!==attacker && a.isPlayer && d>=p.maxhp*0.15){ S.score.assists++; reward(Math.round(150*rankMul),Math.round(25*rankMul),'Assist on '+p.name); } }
    feed(`${who} ${kind==='missile'?'⟿':kind==='bomb'?'💣':'✕'} ${p.name} (${p.def.name})`, p.team===0?'#ff7070':'#7fb8ff');
    if (p.isPlayer){ S.score.deaths++; S.respawnT=4; S.killedBy=who; Audio2.died(); Audio2.engineStop(); S.cam.shake=20; }
    else { p.respawnAt = S.t + rnd(10,16); scheduleRespawn(p); }
  }
  function scheduleRespawn(p){ const check=()=>{ if (!S||S.state==='ended'||p.alive||!S.planes.includes(p)) return; if (S.t>=p.respawnAt){ if (S.tickets[p.team]>15 && !p.wreck){ spawnAt(p,false); } else if (S.tickets[p.team]<=15) return; } setTimeout(check,500); }; setTimeout(check,500); }
  function damageGround(g, dmg, attacker){
    if (!g.alive) return; g.hp-=dmg; if (attacker&&attacker.isPlayer) S.score.damage+=dmg*0.5;
    if (g.hp<=0){ g.alive=false; g.hp=0; const big=g.kind==='base'; explosionFx(g.x,g.y,big?2.2:1.1,true); Audio2.explosion((g.x-S.cam.x)/900, dist(g,S.player), big?2.2:1.1); S.decals.push({x:g.x,y:g.y,r:big?140:30,life:1e9});
      if (big){ for (let i=0;i<6;i++) setTimeout(()=>{ if(S) explosionFx(g.x+rnd(-120,120),g.y+rnd(-70,70),1.2,true); },i*220); }
      const rankMul = 1+0.35*(S.playerDef.rank-1);
      S.tickets[g.team]-= big?(S.mode==='ground'?40:15):(S.mode==='ground'?3:1);
      if (attacker&&attacker.isPlayer){ if (big){ S.score.bases++; reward(Math.round(800*rankMul),Math.round(120*rankMul),'Destroyed enemy airfield'); S.killFlash={t:0,text:'AIRFIELD DESTROYED',sub:'+ tickets'}; } else { S.score.ground++; reward(Math.round(120*rankMul),Math.round(20*rankMul),'Destroyed '+(g.kind==='tank'?'tank':'AA gun')); } }
      feed(`${attacker?attacker.name:'?'} destroyed ${g.team===0?'friendly':'enemy'} ${g.kind==='base'?'airfield':g.kind==='tank'?'tank':'AA gun'}`, g.team===0?'#ff7070':'#7fb8ff');
    }
  }
  function reward(sl,rp,text){ if (S.mode==='test') return; S.score.sl+=sl; S.score.rp+=rp; S.score.events.push({text,sl,rp}); toast(`+${sl} SL  +${rp} RP · ${text}`); }
  function feed(text,col){ S.feed.unshift({text,col:col||'#e8e4d8',t:0}); if (S.feed.length>6) S.feed.pop(); }

  // ---------------- particles & fx
  function addPart(p){ if (S.parts.length>2200) return; S.parts.push(p); }
  function updateParticles(dt){ const P=S.parts; for (let i=P.length-1;i>=0;i--){ const p=P[i]; p.life-=dt; p.x+=p.vx*dt; p.y+=p.vy*dt; p.r+=p.grow*dt; if (p.type==='debris'){ p.vx*=Math.pow(0.3,dt); p.vy*=Math.pow(0.3,dt); if (Math.random()<dt*20) addPart({x:p.x,y:p.y,vx:0,vy:0,life:0.8,r:3,grow:6,col:[60,60,60],a:0.5,type:'smoke'}); } if (p.life<=0){ P[i]=P[P.length-1]; P.pop(); } }
    const F=S.fx; for (let i=F.length-1;i>=0;i--){ const f=F[i]; f.t+=dt; if (f.type==='flak'){ if (f.delay>0){ f.delay-=dt; if (f.delay<=0){ for (const p of S.planes){ if (p.alive&&p.team!==f.team&&Math.hypot(p.x-f.x,p.y-f.y)<f.r+p.def.size*0.35) damagePlane(p,rnd(8,16),null,'flak'); } Audio2.hit((f.x-S.cam.x)/900, dist(f,S.player)*0.6, true); f.t=0; } continue; } if (f.t>1.4){ F[i]=F[F.length-1]; F.pop(); } } else if (f.t>f.dur){ F[i]=F[F.length-1]; F.pop(); } }
    for (let i=S.decals.length-1;i>=0;i--){ S.decals[i].life-=dt; if (S.decals[i].life<=0) S.decals.splice(i,1); }
    for (const p of S.planes){ if (p.hitFlash>0) p.hitFlash-=dt; }
    if (S.hitMarker>0) S.hitMarker-=dt; if (S.killFlash){ S.killFlash.t+=dt; if (S.killFlash.t>2.2) S.killFlash=null; }
    for (const f of S.feed) f.t+=dt;
    for (let i=hudMsgs.length-1;i>=0;i--){ hudMsgs[i].life-=dt; if (hudMsgs[i].life<=0) hudMsgs.splice(i,1); }
  }
  function explosionFx(x,y,size,ground){
    S.fx.push({type:'boom',x,y,t:0,dur:0.9*size,size,ground});
    const q=settings.quality; const n=Math.round((q===2?26:q===1?14:6)*size);
    for (let i=0;i<n;i++){ const a=rnd(0,TAU), s=rnd(20,160)*size; addPart({x:x+rnd(-4,4)*size,y:y+rnd(-4,4)*size,vx:Math.cos(a)*s,vy:Math.sin(a)*s,life:rnd(0.3,0.7)*size,r:rnd(5,12)*size,grow:-8,col:[255,rnd(90,180),30],a:0.95,type:'fire'}); }
    for (let i=0;i<n*0.8;i++){ const a=rnd(0,TAU), s=rnd(10,70)*size; addPart({x,y,vx:Math.cos(a)*s,vy:Math.sin(a)*s,life:rnd(1.2,2.6)*size,r:rnd(8,16)*size,grow:14,col:[40,38,36],a:0.55,type:'smoke'}); }
    if (q>0 && !ground) for (let i=0;i<Math.round(5*size);i++){ const a=rnd(0,TAU), s=rnd(120,320); addPart({x,y,vx:Math.cos(a)*s,vy:Math.sin(a)*s,life:rnd(0.8,1.6),r:rnd(2,4),grow:0,col:[70,60,50],a:1,type:'debris',rot:rnd(0,TAU),spin:rnd(-10,10)}); }
  }
  function hitFx(x,y,big){ for (let i=0;i<(big?6:3);i++){ const a=rnd(0,TAU), s=rnd(40,140); addPart({x,y,vx:Math.cos(a)*s,vy:Math.sin(a)*s,life:rnd(0.12,0.3),r:rnd(1.5,3),grow:0,col:[255,220,120],a:1,type:'spark'}); } if (big) addPart({x,y,vx:0,vy:0,life:0.5,r:5,grow:10,col:[80,80,80],a:0.5,type:'smoke'}); }

  // ------------------------------------------------------------ end of battle
  function endBattle(){
    if (S.ended) return; S.ended=true; S.state='ended';
    const win = S.tickets[1]<=0 || (S.time<=0 && S.tickets[0]>S.tickets[1]); const draw = S.time<=0 && S.tickets[0]===S.tickets[1];
    Audio2.engineStop(); Audio2.warning(false); Audio2.music('menu'); Audio2.duck(false);
    const sc=S.score; const rankMul = 1+0.35*(S.playerDef.rank-1);
    const base = {sl:Math.round(200*rankMul), rp:Math.round(40*rankMul)};
    const winB = win?{sl:Math.round(500*rankMul), rp:Math.round(90*rankMul)}:{sl:0,rp:0};
    const timeB = {sl:Math.round(Math.min(600,(S.mode==='air'?9*60:11*60)-Math.max(0,S.time))*0.6*rankMul), rp:Math.round(Math.min(600,(S.mode==='air'?9*60:11*60)-Math.max(0,S.time))*0.1*rankMul)};
    const total = {sl: Math.round((sc.sl+base.sl+timeB.sl)*(win?1.35:1)+winB.sl), rp: Math.round((sc.rp+base.rp+timeB.rp)*(win?1.35:1)+winB.rp)};
    const result={ win, draw, kills:sc.kills, assists:sc.assists, ground:sc.ground, bases:sc.bases, deaths:sc.deaths, damage:Math.round(sc.damage), events:sc.events, base, winB, timeB, total, mode:S.mode, tickets:S.tickets.slice(), duration:(S.mode==='air'?9*60:11*60)-Math.max(0,S.time) };
    setTimeout(()=>{ onEnd&&onEnd(result); }, 900);
  }
  function quit(){ if (!S) return; const wasTest=S.mode==='test'; const r=S.state!=='ended'&&!wasTest? {abandoned:true} : null; S=null; Audio2.engineStop(); Audio2.warning(false); Audio2.duck(false); return r; }
  function pause(){ if (S&&S.state==='battle'){ S.state='paused'; Audio2.engineUpdate(0,0,false); Audio2.warning(false); } }
  function resume(){ if (S&&S.state==='paused'){ S.state='battle'; lastT=performance.now(); acc=0; } }

  // ------------------------------------------------------------ rendering
  function render(dtReal){
    ctx.setTransform(dpr,0,0,dpr,0,0);
    if (!S){ renderBackdrop(dtReal); return; }
    const cam=S.cam; const z=cam.zoom; const shx=(Math.random()-0.5)*cam.shake, shy=(Math.random()-0.5)*cam.shake;
    ctx.save(); ctx.translate(W/2+shx,H/2+shy); ctx.scale(z,z); ctx.translate(-cam.x,-cam.y);
    S.world.draw(ctx, cam, W, H);
    // cloud shadows
    drawClouds(ctx, cam, true);
    // decals
    for (const d of S.decals){ ctx.fillStyle=`rgba(20,16,12,${Math.min(0.55,d.life/10)})`; ctx.beginPath(); ctx.arc(d.x,d.y,d.r,0,TAU); ctx.fill(); }
    // ground units
    for (const g of S.ground) drawGround(ctx,g);
    // plane shadows
    for (const p of S.planes){ if (!p.sprite) continue; if (!p.alive&&!p.wreck) continue; const sp=p.sprite; const alt=p.alt||1; const off=26*alt; ctx.save(); ctx.translate(p.x+off,p.y+off*1.15); ctx.rotate(p.hd); ctx.globalAlpha=0.32*(p.alive?1:alt); const sc=(p.alive?1:0.5+alt*0.5); ctx.drawImage(sp.shadow,-sp.shadow.width/sp.res/2*sc,-sp.shadow.height/sp.res/2*sc,sp.shadow.width/sp.res*sc,sp.shadow.height/sp.res*sc); ctx.restore(); }
    // bombs
    for (const b of S.bombs){ ctx.save(); ctx.translate(b.x,b.y); ctx.rotate(b.hd); ctx.scale(b.sc,b.sc); ctx.fillStyle='#2a2d30'; ctx.beginPath(); ctx.ellipse(0,0,3,9,0,0,TAU); ctx.fill(); ctx.fillStyle='#8a8f94'; ctx.fillRect(-3,5,6,2); ctx.restore(); }
    // low particles (smoke)
    drawParticles(ctx,'low');
    // flares
    for (const f of S.flares){ const a=Math.max(0,f.life/2.6); ctx.save(); ctx.globalCompositeOperation='lighter'; const g=ctx.createRadialGradient(f.x,f.y,0,f.x,f.y,14); g.addColorStop(0,`rgba(255,255,220,${a})`); g.addColorStop(0.3,`rgba(255,200,90,${a*0.8})`); g.addColorStop(1,'rgba(255,120,30,0)'); ctx.fillStyle=g; ctx.beginPath(); ctx.arc(f.x,f.y,14,0,TAU); ctx.fill(); ctx.restore(); }
    // planes
    for (const p of S.planes) drawPlane(ctx,p);
    // bullets
    ctx.lineCap='round';
    for (const b of S.bullets){ ctx.strokeStyle=b.col; ctx.lineWidth=b.size; ctx.globalAlpha=0.9; ctx.beginPath(); ctx.moveTo(b.px,b.py); ctx.lineTo(b.x,b.y); ctx.stroke(); }
    ctx.globalAlpha=1;
    // missiles
    for (const m of S.missiles){ ctx.save(); ctx.translate(m.x,m.y); ctx.rotate(m.hd); if (m.spr){ ctx.drawImage(m.spr.cv,-m.spr.w/2,-m.spr.h/2,m.spr.w,m.spr.h); } else { ctx.fillStyle='#ddd'; ctx.fillRect(-2,-12,4,24); } ctx.restore(); }
    // high particles
    drawParticles(ctx,'high');
    for (const f of S.fx) drawFx(ctx,f);
    // clouds above
    drawClouds(ctx, cam, false);
    ctx.restore();
    drawHUD(dtReal);
  }
  function drawClouds(ctx, cam, shadow){
    const z=cam.zoom; const par = shadow?1:1.18; const vw=W/z/2+300, vh=H/z/2+300; const q=settings.quality;
    for (const c of S.world.clouds){ const cx=c.x+S.t*c.vx, cy=c.y+S.t*c.vy; const wx=((cx%S.size)+S.size)%S.size, wy=((cy%S.size)+S.size)%S.size;
      let px=wx, py=wy; if (!shadow){ px=cam.x+(wx-cam.x)*par; py=cam.y+(wy-cam.y)*par; } else { px=wx+60; py=wy+70; }
      if (Math.abs(px-cam.x)>vw||Math.abs(py-cam.y)>vh) continue;
      ctx.save(); ctx.translate(px,py);
      if (shadow){ ctx.fillStyle='rgba(0,0,0,0.16)'; ctx.beginPath(); for (const [ox,oy,r] of c.parts){ ctx.moveTo(ox+r*0.9,oy); ctx.arc(ox,oy,r*0.9,0,TAU); } ctx.fill(); ctx.restore(); continue; }
      for (const [ox,oy,r] of c.parts){ if (q>0){ const g=ctx.createRadialGradient(ox-r*0.25,oy-r*0.3,r*0.05,ox,oy,r); g.addColorStop(0,`rgba(255,255,255,${c.a*0.75})`); g.addColorStop(0.55,`rgba(246,249,253,${c.a*0.45})`); g.addColorStop(1,'rgba(236,242,250,0)'); ctx.fillStyle=g; ctx.beginPath(); ctx.arc(ox,oy,r,0,TAU); ctx.fill(); } else { ctx.fillStyle=`rgba(255,255,255,${c.a*0.7})`; ctx.beginPath(); ctx.arc(ox,oy,r*0.8,0,TAU); ctx.fill(); } }
      ctx.restore(); }
  }
  function drawParticles(ctx, layer){
    for (const p of S.parts){ const isLow = p.type==='smoke'||p.type==='vortex'; if ((layer==='low')!==isLow) continue; const lf=Math.max(0,Math.min(1,p.life/ (p.type==='smoke'?1.5:0.5))); const a=p.a*(p.type==='smoke'?Math.min(1,p.life*1.2):p.type==='vortex'?p.life*2:1);
      if (p.type==='fire'||p.type==='flash'||p.type==='spark'){ ctx.globalCompositeOperation='lighter'; ctx.fillStyle=`rgba(${p.col[0]},${p.col[1]},${p.col[2]},${clamp(a,0,1)})`; ctx.beginPath(); ctx.arc(p.x,p.y,Math.max(0.5,p.r),0,TAU); ctx.fill(); ctx.globalCompositeOperation='source-over'; }
      else if (p.type==='debris'){ ctx.save(); ctx.translate(p.x,p.y); ctx.rotate(p.rot+= (p.spin||0)*0.016); ctx.fillStyle='#3a342e'; ctx.fillRect(-p.r,-p.r*0.5,p.r*2,p.r); ctx.restore(); }
      else if (p.type==='vortex'){ ctx.strokeStyle=`rgba(255,255,255,${clamp(a,0,1)})`; ctx.lineWidth=p.r; ctx.beginPath(); ctx.moveTo(p.x2,p.y2); ctx.lineTo(p.x,p.y); ctx.stroke(); }
      else { ctx.fillStyle=`rgba(${p.col[0]},${p.col[1]},${p.col[2]},${clamp(a,0,1)})`; ctx.beginPath(); ctx.arc(p.x,p.y,Math.max(0.5,p.r),0,TAU); ctx.fill(); } }
  }
  function drawFx(ctx,f){
    if (f.type==='boom'){ const k=f.t/f.dur; const r=(20+140*k)*f.size; ctx.save(); ctx.globalCompositeOperation='lighter'; ctx.strokeStyle=`rgba(255,220,160,${(1-k)*0.8})`; ctx.lineWidth=6*(1-k)+1; ctx.beginPath(); ctx.arc(f.x,f.y,r,0,TAU); ctx.stroke(); if (k<0.35){ const g=ctx.createRadialGradient(f.x,f.y,0,f.x,f.y,60*f.size); g.addColorStop(0,`rgba(255,255,230,${(1-k/0.35)})`); g.addColorStop(0.4,`rgba(255,160,60,${(1-k/0.35)*0.8})`); g.addColorStop(1,'rgba(255,80,20,0)'); ctx.fillStyle=g; ctx.beginPath(); ctx.arc(f.x,f.y,60*f.size,0,TAU); ctx.fill(); } ctx.restore(); }
    else if (f.type==='flak'){ if (f.delay>0) return; const k=f.t/1.4; ctx.fillStyle=`rgba(30,28,26,${(1-k)*0.7})`; ctx.beginPath(); ctx.arc(f.x,f.y,10+30*k,0,TAU); ctx.fill(); if (k<0.15){ ctx.globalCompositeOperation='lighter'; ctx.fillStyle=`rgba(255,200,120,${1-k/0.15})`; ctx.beginPath(); ctx.arc(f.x,f.y,14,0,TAU); ctx.fill(); ctx.globalCompositeOperation='source-over'; } }
  }
  function drawGround(ctx,g){
    ctx.save(); ctx.translate(g.x,g.y);
    if (g.kind==='base'){ ctx.rotate(g.hd); const dead=!g.alive;
      ctx.fillStyle='rgba(0,0,0,0.25)'; ctx.fillRect(-g.w/2+6,-g.h/2+8,g.w,g.h);
      ctx.fillStyle=dead?'#4a4640':'#6a6f66'; ctx.fillRect(-g.w/2,-g.h/2,g.w,g.h);
      ctx.fillStyle=dead?'#2a2826':'#3a3d40'; ctx.fillRect(-g.w/2+10,-22,g.w-20,44);
      if (!dead){ ctx.strokeStyle='rgba(255,255,255,0.7)'; ctx.setLineDash([14,12]); ctx.lineWidth=2; ctx.beginPath(); ctx.moveTo(-g.w/2+24,0); ctx.lineTo(g.w/2-24,0); ctx.stroke(); ctx.setLineDash([]); ctx.fillStyle='#fff'; for (let i=0;i<6;i++){ ctx.fillRect(-g.w/2+14+i*6,-18,3,8); ctx.fillRect(g.w/2-20-i*6,10,3,8); } }
      // hangars
      for (let i=-1;i<=1;i++){ const hx=i*70, hy=-g.h/2+30; ctx.fillStyle='rgba(0,0,0,0.3)'; ctx.fillRect(hx-22+4,hy-14+5,44,28); ctx.fillStyle=dead?'#3a3632':(g.team===0?'#5a6c86':'#86645a'); ctx.fillRect(hx-22,hy-14,44,28); ctx.fillStyle='rgba(255,255,255,0.25)'; ctx.fillRect(hx-22,hy-14,44,6); }
      // tower + tanks
      ctx.fillStyle=dead?'#333':'#c9c2b0'; ctx.fillRect(g.w/2-40,g.h/2-40,18,18); ctx.fillStyle=dead?'#333':'#9aa3ad'; for (let i=0;i<3;i++){ ctx.beginPath(); ctx.arc(-g.w/2+30+i*20,g.h/2-30,7,0,TAU); ctx.fill(); }
      ctx.fillStyle=g.team===0?'#4fa3ff':'#ff4d4d'; ctx.fillRect(-g.w/2+8,-g.h/2+8,20,12);
      if (dead){ ctx.fillStyle='rgba(0,0,0,0.5)'; for (let i=0;i<8;i++){ ctx.beginPath(); ctx.arc((i*67%g.w)-g.w/2,(i*41%g.h)-g.h/2,18,0,TAU); ctx.fill(); } }
    } else if (g.kind==='tank'){ ctx.rotate(g.hd); const dead=!g.alive; ctx.fillStyle='rgba(0,0,0,0.3)'; ctx.fillRect(-11+4,-17+5,22,34);
      ctx.fillStyle=dead?'#2b2724':'#3c3a30'; ctx.fillRect(-13,-17,5,34); ctx.fillRect(8,-17,5,34); ctx.fillStyle=dead?'#3a3632':(g.team===0?'#5b6f5a':'#6f5f4a'); ctx.fillRect(-9,-15,18,30); ctx.fillStyle=dead?'#2a2624':(g.team===0?'#4b5e4a':'#5f4f3c'); ctx.beginPath(); ctx.arc(0,-2,7,0,TAU); ctx.fill(); ctx.fillStyle=dead?'#222':'#2f2d28'; ctx.fillRect(-1.5,-22,3,20); if (!dead){ ctx.fillStyle=g.team===0?'#4fa3ff':'#ff4d4d'; ctx.fillRect(-4,8,8,3); } else { ctx.fillStyle='rgba(0,0,0,.6)'; ctx.beginPath(); ctx.arc(0,0,14,0,TAU); ctx.fill(); }
    } else if (g.kind==='aa'){ const dead=!g.alive; ctx.fillStyle='rgba(0,0,0,0.25)'; ctx.beginPath(); ctx.arc(3,4,15,0,TAU); ctx.fill(); ctx.fillStyle=dead?'#3a3632':'#b9a878'; ctx.beginPath(); ctx.arc(0,0,15,0,TAU); ctx.fill(); ctx.fillStyle=dead?'#222':'#6f6a58'; ctx.beginPath(); ctx.arc(0,0,10,0,TAU); ctx.fill(); ctx.rotate(g.hd); ctx.fillStyle=dead?'#222':'#2f2d28'; for (const o of [-4,-1.5,1.5,4]) ctx.fillRect(o-0.8,-18,1.6,16); if (!dead){ ctx.rotate(-g.hd); ctx.fillStyle=g.team===0?'#4fa3ff':'#ff4d4d'; ctx.fillRect(-3,10,6,3); } }
    ctx.restore();
  }
  function drawPlane(ctx,p){
    const sp=p.sprite; if (!sp) return; if (!p.alive&&!p.wreck) return;
    const def=p.def; const alt=p.alt||1; const sc=p.alive?1:0.55+alt*0.45;
    ctx.save(); ctx.translate(p.x,p.y); ctx.rotate(p.hd); ctx.scale(sc,sc);
    // afterburner / exhaust
    if (p.alive && def.jet && p.throttle>0.5){ const L=def.size; const ab=def.ab&&p.throttle>0.92; const n=def.role==='Bomber'?1:1; ctx.save(); ctx.globalCompositeOperation='lighter'; const len=(ab?38:16)*(0.8+Math.random()*0.4); const g=ctx.createLinearGradient(0,L*0.44,0,L*0.44+len); g.addColorStop(0,ab?'rgba(190,220,255,0.95)':'rgba(255,200,120,0.5)'); g.addColorStop(0.4,ab?'rgba(255,170,70,0.8)':'rgba(255,150,60,0.25)'); g.addColorStop(1,'rgba(255,90,30,0)'); ctx.fillStyle=g; ctx.beginPath(); ctx.moveTo(-5,L*0.44); ctx.lineTo(5,L*0.44); ctx.lineTo(0,L*0.44+len); ctx.closePath(); ctx.fill(); ctx.restore(); }
    ctx.drawImage(sp.cv,-sp.w/2,-sp.h/2,sp.w,sp.h);
    if (p.hitFlash>0 && sp.flash){ ctx.globalAlpha=Math.min(1,p.hitFlash*2.5); ctx.drawImage(sp.flash,-sp.w/2,-sp.h/2,sp.w,sp.h); ctx.globalAlpha=1; }
    if (p.spawnProt>0 && p.alive){ ctx.globalAlpha=0.35+0.25*Math.sin(S.t*20); ctx.strokeStyle='#8fd3ff'; ctx.lineWidth=2; ctx.beginPath(); ctx.ellipse(0,0,sp.w/2+6,sp.h/2+6,0,0,TAU); ctx.stroke(); ctx.globalAlpha=1; }
    // propeller
    if (!def.jet && p.alive){ const L=def.size; const r=L*0.15; const engines = def.role==='Bomber'||def.role==='Heavy Fighter' ? (def.size>125?[[-sp.w*0.34,-L*0.1],[-sp.w*0.16,-L*0.04],[sp.w*0.16,-L*0.04],[sp.w*0.34,-L*0.1]]:[[-sp.w*0.22,-L*0.1],[sp.w*0.22,-L*0.1]]) : [[0,-L*0.5+r*0.5]];
      for (const [ex,ey] of engines){ ctx.save(); ctx.translate(ex,ey); ctx.fillStyle='rgba(210,210,215,0.16)'; ctx.beginPath(); ctx.arc(0,0,r*(engines.length>1?0.8:1),0,TAU); ctx.fill(); ctx.rotate(p.prop); ctx.strokeStyle='rgba(30,30,30,0.5)'; ctx.lineWidth=2; const rr=r*(engines.length>1?0.8:1); for (let k=0;k<3;k++){ ctx.rotate(TAU/3); ctx.beginPath(); ctx.moveTo(0,0); ctx.lineTo(0,-rr); ctx.stroke(); } ctx.restore(); } }
    ctx.restore();
  }

  // ------------------------------------------------------------ HUD
  function w2s(x,y){ const c=S.cam; return {x:W/2+(x-c.x)*c.zoom, y:H/2+(y-c.y)*c.zoom}; }
  function drawHUD(dt){
    const P=S.player; const cam=S.cam; ctx.save(); ctx.font='600 13px '+getFont(); ctx.textBaseline='middle';
    // markers
    for (const p of S.planes){ if (p===P||!p.alive) continue; const s=w2s(p.x,p.y); const d=dist(P,p); const enemy=p.team!==P.team; const col=enemy?'#ff5a5a':'#5fb0ff';
      const on = s.x>-40&&s.y>-40&&s.x<W+40&&s.y<H+40;
      if (on){ const r=Math.max(16,p.def.size*0.5*cam.zoom+6); ctx.strokeStyle=col; ctx.lineWidth=1.5; ctx.globalAlpha=0.9; const isT=p===P.target;
        if (enemy){ ctx.beginPath(); for (const [sx,sy] of [[-1,-1],[1,-1],[1,1],[-1,1]]){ ctx.moveTo(s.x+sx*r,s.y+sy*r-sy*7); ctx.lineTo(s.x+sx*r,s.y+sy*r); ctx.lineTo(s.x+sx*r-sx*7,s.y+sy*r); } ctx.stroke(); if (isT){ ctx.beginPath(); ctx.arc(s.x,s.y,r+6,0,TAU); ctx.stroke(); } }
        else { ctx.beginPath(); ctx.arc(s.x,s.y,r,0,TAU); ctx.stroke(); }
        ctx.fillStyle=col; ctx.textAlign='center'; ctx.fillText(`${p.name} · ${p.def.name}`, s.x, s.y-r-16); ctx.fillStyle='#fff'; ctx.fillText(`${(d*2/1000).toFixed(1)} km`, s.x, s.y-r-4);
        // health bar
        ctx.fillStyle='rgba(0,0,0,0.5)'; ctx.fillRect(s.x-16,s.y+r+4,32,4); ctx.fillStyle=col; ctx.fillRect(s.x-16,s.y+r+4,32*p.hp/p.maxhp,4); ctx.globalAlpha=1;
      } else if (enemy && d<3500){ // off-screen arrow
        const a=Math.atan2(s.y-H/2,s.x-W/2); const ex=clamp(s.x,30,W-30), ey=clamp(s.y,70,H-30); ctx.save(); ctx.translate(ex,ey); ctx.rotate(a); ctx.fillStyle=col; ctx.globalAlpha=0.7; ctx.beginPath(); ctx.moveTo(10,0); ctx.lineTo(-6,-6); ctx.lineTo(-6,6); ctx.closePath(); ctx.fill(); ctx.restore(); }
    }
    for (const g of S.ground){ if (!g.alive) continue; const s=w2s(g.x,g.y); if (s.x<-60||s.y<-60||s.x>W+60||s.y>H+60) continue; const enemy=g.team!==P.team; const col=enemy?'#ff5a5a':'#5fb0ff'; ctx.strokeStyle=col; ctx.globalAlpha=0.7; ctx.lineWidth=1.2; const r=g.kind==='base'?22:10; ctx.beginPath(); ctx.moveTo(s.x,s.y-r); ctx.lineTo(s.x+r,s.y); ctx.lineTo(s.x,s.y+r); ctx.lineTo(s.x-r,s.y); ctx.closePath(); ctx.stroke(); if (g.kind==='base'){ ctx.fillStyle=col; ctx.textAlign='center'; ctx.fillText((enemy?'ENEMY':'ALLIED')+' AIRFIELD  '+Math.round(g.hp/g.maxhp*100)+'%', s.x, s.y-r-10); } ctx.globalAlpha=1; }
    // missiles heading for player
    for (const m of S.missiles){ if (m.target!==P) continue; const s=w2s(m.x,m.y); ctx.strokeStyle='#ffcf3a'; ctx.lineWidth=2; ctx.beginPath(); ctx.arc(s.x,s.y,10+Math.sin(S.t*20)*3,0,TAU); ctx.stroke(); }
    // lead indicator + gun reticle
    if (P.alive){
      const g=P.def.guns||P.def.guns2; if (g){ const nose=nosePos(P); const rx=nose.x+Math.sin(P.hd)*g.range*0.55, ry=nose.y-Math.cos(P.hd)*g.range*0.55; const s=w2s(rx,ry); ctx.strokeStyle='rgba(255,255,255,0.75)'; ctx.lineWidth=1.5; ctx.beginPath(); ctx.arc(s.x,s.y,6,0,TAU); ctx.moveTo(s.x-12,s.y); ctx.lineTo(s.x-8,s.y); ctx.moveTo(s.x+8,s.y); ctx.lineTo(s.x+12,s.y); ctx.moveTo(s.x,s.y-12); ctx.lineTo(s.x,s.y-8); ctx.stroke(); }
      const t=P.target; if (t&&t.alive&&g){ const d=dist(P,t); if (d<g.range*1.6){ const tt=d/(g.speed+P.speed*0.6); const lx=t.x+Math.sin(t.hd)*t.speed*tt, ly=t.y-Math.cos(t.hd)*t.speed*tt; const s=w2s(lx,ly); ctx.strokeStyle='#7dff7d'; ctx.lineWidth=2; ctx.beginPath(); ctx.arc(s.x,s.y,7,0,TAU); ctx.stroke(); ctx.fillStyle='#7dff7d'; ctx.beginPath(); ctx.arc(s.x,s.y,2,0,TAU); ctx.fill(); } }
      if (settings.control==='mouse'){ ctx.strokeStyle='rgba(255,255,255,0.6)'; ctx.lineWidth=1; ctx.beginPath(); ctx.arc(input.mx,input.my,10,0,TAU); ctx.stroke(); ctx.fillStyle='#fff'; ctx.fillRect(input.mx-1,input.my-1,2,2); }
      if (S.hitMarker>0){ ctx.strokeStyle='#fff'; ctx.lineWidth=2; const c=w2s(P.target?P.target.x:P.x, P.target?P.target.y:P.y); for (const [sx,sy] of [[-1,-1],[1,-1],[1,1],[-1,1]]){ ctx.beginPath(); ctx.moveTo(c.x+sx*6,c.y+sy*6); ctx.lineTo(c.x+sx*12,c.y+sy*12); ctx.stroke(); } }
    }
    // ---------- panels
    const pad=16; ctx.textAlign='left';
    // top: tickets + time
    const tw=Math.min(520,W-240); const tx=W/2-tw/2, ty=14; ctx.fillStyle='rgba(0,0,0,0.55)'; ctx.fillRect(tx,ty,tw,40);
    const t0=S.tickets[0]/S.maxTickets, t1=S.tickets[1]/S.maxTickets; ctx.fillStyle='#5fb0ff'; ctx.fillRect(tx+6,ty+6,(tw/2-46)*clamp(t0,0,1),10); ctx.fillStyle='#ff5a5a'; ctx.fillRect(tx+tw-6-(tw/2-46)*clamp(t1,0,1),ty+6,(tw/2-46)*clamp(t1,0,1),10);
    ctx.fillStyle='#fff'; ctx.font='700 18px '+getFont(); ctx.textAlign='center'; ctx.fillText(S.mode==='test'?'TEST FLIGHT':fmtTime(S.time), W/2, ty+20); ctx.font='700 14px '+getFont(); ctx.textAlign='left'; ctx.fillStyle='#5fb0ff'; ctx.fillText(Math.max(0,Math.ceil(S.tickets[0])), tx+6, ty+28); ctx.textAlign='right'; ctx.fillStyle='#ff5a5a'; ctx.fillText(Math.max(0,Math.ceil(S.tickets[1])), tx+tw-6, ty+28);
    // kill feed (top-left)
    ctx.textAlign='left'; ctx.font='600 14px '+getFont(); let fy=pad+6; for (const f of S.feed){ const a=clamp(1-(f.t-6)/2,0,1); if (a<=0) continue; ctx.fillStyle=`rgba(0,0,0,${0.45*a})`; const tw2=ctx.measureText(f.text).width; ctx.fillRect(pad-6,fy-10,tw2+12,20); ctx.globalAlpha=a; ctx.fillStyle=f.col; ctx.fillText(f.text,pad,fy); ctx.globalAlpha=1; fy+=22; }
    // toasts
    let my=H*0.22; ctx.textAlign='center'; ctx.font='700 16px '+getFont(); for (const m of hudMsgs){ const a=clamp(m.life/0.5,0,1); ctx.globalAlpha=a; ctx.fillStyle='rgba(0,0,0,0.5)'; const w=ctx.measureText(m.t).width+24; ctx.fillRect(W/2-w/2,my-12,w,24); ctx.fillStyle='#f3c14b'; ctx.fillText(m.t,W/2,my); my+=28; } ctx.globalAlpha=1;
    if (S.killFlash){ const k=S.killFlash.t; const a=k<0.2?k/0.2:k>1.7?(2.2-k)/0.5:1; ctx.globalAlpha=a; ctx.fillStyle='#ffd35a'; ctx.font='800 36px '+getFont(); ctx.fillText(S.killFlash.text,W/2,H*0.3); ctx.font='600 16px '+getFont(); ctx.fillStyle='#fff'; ctx.fillText(S.killFlash.sub,W/2,H*0.3+28); ctx.globalAlpha=1; }
    // bottom-left: flight panel
    const bw=250, bh=112; const bx=pad, by=H-pad-bh; panel(bx,by,bw,bh);
    ctx.textAlign='left'; ctx.fillStyle='#fff'; ctx.font='800 30px '+getFont(); const spdTxt=Math.round(P.speed*1.6)+''; ctx.fillText(spdTxt, bx+12, by+26); const spdW=ctx.measureText(spdTxt).width; ctx.font='600 12px '+getFont(); ctx.fillStyle='#9aa3ad'; ctx.fillText('KM/H', bx+18+spdW, by+30);
    ctx.fillStyle='#9aa3ad'; ctx.fillText('THROTTLE', bx+12, by+52); bar(bx+80,by+46,bw-92,10,P.throttle,P.def.ab&&P.throttle>0.92?'#8fd3ff':'#f3c14b');
    ctx.fillStyle='#9aa3ad'; ctx.fillText('HULL', bx+12, by+72); bar(bx+80,by+66,bw-92,10,P.hp/P.maxhp,P.hp/P.maxhp>0.5?'#61d47a':P.hp/P.maxhp>0.25?'#f3c14b':'#ff4d4d');
    ctx.fillStyle='#e8e4d8'; ctx.font='700 13px '+getFont(); ctx.fillText(P.def.name.toUpperCase(), bx+12, by+94); ctx.fillStyle='#9aa3ad'; ctx.textAlign='right'; ctx.fillText(P.kills+' KILLS', bx+bw-12, by+94);
    // bottom-right: weapons panel
    const ww=250, wh=112; const wx=W-pad-ww, wy=H-pad-wh; panel(wx,wy,ww,wh); ctx.textAlign='left'; let ly=wy+16;
    ctx.font='600 12px '+getFont();
    const g1=P.def.guns, g2=P.def.guns2;
    if (g1||g2){ ctx.fillStyle='#9aa3ad'; ctx.fillText('GUNS', wx+12, ly); ctx.fillStyle=P.heat>=1?'#ff4d4d':'#fff'; ctx.font='700 14px '+getFont(); ctx.fillText((g1?P.ammo:P.ammo2)+(g2&&g1?' / '+P.ammo2:''), wx+60, ly); bar(wx+150,wy+10,ww-162,8,P.heat,P.heat>0.8?'#ff4d4d':'#ff9f4a'); ctx.font='600 12px '+getFont(); ly+=22; }
    else { ctx.fillStyle='#9aa3ad'; ctx.fillText('NO GUNS', wx+12, ly); ly+=22; }
    if (P.missiles.length){ P.missiles.forEach((m,i)=>{ const md=window.MISSILES[m.key]; const sel=i===P.missileIdx; ctx.fillStyle=sel?'#f3c14b':'#9aa3ad'; ctx.font=(sel?'700':'600')+' 12px '+getFont(); ctx.fillText((sel?'▶ ':'   ')+md.name.toUpperCase(), wx+12, ly); ctx.fillStyle='#fff'; ctx.textAlign='right'; ctx.fillText('×'+m.n, wx+ww-12, ly); ctx.textAlign='left'; ly+=18; });
      const m=P.missiles[P.missileIdx]; if (m&&m.n>0&&P.target&&P.target.alive){ const md=window.MISSILES[m.key]; if (P.locked){ ctx.fillStyle='#7dff7d'; ctx.font='800 13px '+getFont(); ctx.fillText('LOCKED  · RMB / E to fire', wx+12, ly); } else if (P.lockT>0){ ctx.fillStyle='#f3c14b'; ctx.fillText('LOCKING…', wx+12, ly); bar(wx+90,ly-4,ww-102,8,P.lockT/(md.ir?0.9:1.4),'#f3c14b'); } else { ctx.fillStyle='#9aa3ad'; ctx.fillText('SEEKER: aim at target', wx+12, ly); } ly+=18; } }
    if (P.def.bombs){ ctx.fillStyle='#9aa3ad'; ctx.font='600 12px '+getFont(); ctx.fillText('BOMBS', wx+12, ly); ctx.fillStyle='#fff'; ctx.textAlign='right'; ctx.fillText(P.bombs>0?'×'+P.bombs:'reload '+Math.ceil(P.bombReload)+'s', wx+ww-12, ly); ctx.textAlign='left'; ly+=18; }
    if (P.maxFlares){ ctx.fillStyle='#9aa3ad'; ctx.fillText('FLARES', wx+12, ly); ctx.fillStyle='#fff'; ctx.textAlign='right'; ctx.fillText('×'+P.flares, wx+ww-12, ly); ctx.textAlign='left'; ly+=18; }
    // minimap (bottom center)
    const ms=Math.min(170,H*0.24); const mx=W/2-ms/2, mmy=H-pad-ms; ctx.fillStyle='rgba(0,0,0,0.55)'; ctx.fillRect(mx-4,mmy-4,ms+8,ms+8); ctx.drawImage(S.mini,mx,mmy,ms,ms); ctx.strokeStyle='rgba(243,193,75,0.5)'; ctx.strokeRect(mx-4,mmy-4,ms+8,ms+8);
    const k=ms/S.size; for (const g of S.ground){ if (!g.alive) continue; ctx.fillStyle=g.team===0?'#5fb0ff':'#ff5a5a'; const r=g.kind==='base'?4:1.5; ctx.fillRect(mx+g.x*k-r,mmy+g.y*k-r,r*2,r*2); }
    for (const p of S.planes){ if (!p.alive) continue; ctx.save(); ctx.translate(mx+p.x*k,mmy+p.y*k); ctx.rotate(p.hd); ctx.fillStyle=p.isPlayer?'#fff':p.team===0?'#5fb0ff':'#ff5a5a'; ctx.beginPath(); ctx.moveTo(0,-4); ctx.lineTo(3,3); ctx.lineTo(-3,3); ctx.closePath(); ctx.fill(); ctx.restore(); }
    for (const m of S.missiles){ ctx.fillStyle='#ffcf3a'; ctx.fillRect(mx+m.x*k-1,mmy+m.y*k-1,2,2); }
    // view rect
    ctx.strokeStyle='rgba(255,255,255,0.35)'; ctx.strokeRect(mx+(cam.x-W/2/cam.zoom)*k, mmy+(cam.y-H/2/cam.zoom)*k, W/cam.zoom*k, H/cam.zoom*k);
    if (P.alive){ const m=140; if (P.x<m||P.y<m||P.x>S.size-m||P.y>S.size-m){ ctx.textAlign='center'; ctx.fillStyle='#ffd35a'; ctx.font='800 22px '+getFont(); ctx.fillText('⚠ LEAVING THE BATTLE AREA — TURN BACK', W/2, H*0.12); } }
    // missile warning
    if (S.warn && P.alive){ ctx.textAlign='center'; ctx.fillStyle=Math.sin(S.t*18)>0?'#ff4d4d':'#ffd35a'; ctx.font='800 26px '+getFont(); ctx.fillText('⚠ MISSILE — FLARES (F)', W/2, H*0.16); }
    // death screen
    if (!P.alive){ ctx.fillStyle='rgba(0,0,0,0.45)'; ctx.fillRect(0,0,W,H); ctx.textAlign='center'; ctx.fillStyle='#ff5a5a'; ctx.font='800 44px '+getFont(); ctx.fillText('SHOT DOWN', W/2, H*0.4); ctx.fillStyle='#fff'; ctx.font='600 18px '+getFont(); ctx.fillText('by '+(S.killedBy||'?'), W/2, H*0.4+36);
      if (S.tickets[0]>0){ ctx.fillStyle='#f3c14b'; ctx.font='700 20px '+getFont(); ctx.fillText(S.respawnT>0?'Respawn in '+Math.ceil(S.respawnT)+'…':'Press SPACE / click to respawn', W/2, H*0.4+80); } }
    // score strip
    ctx.textAlign='left'; ctx.font='600 12px '+getFont(); ctx.fillStyle='rgba(255,255,255,0.7)'; ctx.fillText(`SL +${S.score.sl}   RP +${S.score.rp}   K ${S.score.kills}  A ${S.score.assists}  G ${S.score.ground+S.score.bases}`, pad, H-pad-bh-14);
    // controls hint
    if (S.t<12){ ctx.textAlign='center'; ctx.fillStyle=`rgba(255,255,255,${clamp((12-S.t)/2,0,0.8)})`; ctx.font='600 14px '+getFont(); ctx.fillText(settings.control==='mouse'?'Mouse to steer · W/S throttle · LMB/Space guns · RMB/E missile · F flares · B bombs · Q target · wheel zoom':'A/D turn · W/S throttle · Space guns · E missile · F flares · B bombs · Q target', W/2, H-pad-ms-24); }
    ctx.restore();
  }
  function panel(x,y,w,h){ ctx.fillStyle='rgba(6,10,16,0.62)'; ctx.fillRect(x,y,w,h); ctx.strokeStyle='rgba(243,193,75,0.35)'; ctx.lineWidth=1; ctx.strokeRect(x+0.5,y+0.5,w-1,h-1); }
  function bar(x,y,w,h,v,col){ ctx.fillStyle='rgba(255,255,255,0.1)'; ctx.fillRect(x,y,w,h); ctx.fillStyle=col; ctx.fillRect(x,y,w*clamp(v,0,1),h); }
  function fmtTime(t){ t=Math.max(0,t); return Math.floor(t/60)+':'+String(Math.floor(t%60)).padStart(2,'0'); }
  function getFont(){ return '"Avenir Next Condensed","Roboto Condensed","Arial Narrow",Arial,sans-serif'; }

  // hangar backdrop: slow flyover of a world with clouds
  let bdT=0;
  function renderBackdrop(dt){
    if (!backdrop){ backdrop={ world: World.create('islands', 4000, 4242), x:1200, y:1200, cam:{x:1200,y:1200,zoom:0.7,userZoom:1} }; }
    bdT+=dt; const b=backdrop; b.cam.x=1200+Math.sin(bdT*0.05)*900+bdT*12; b.cam.y=1300+Math.cos(bdT*0.04)*800; b.cam.x=((b.cam.x%3000)+3000)%3000+500;
    ctx.save(); ctx.translate(W/2,H/2); ctx.scale(b.cam.zoom,b.cam.zoom); ctx.translate(-b.cam.x,-b.cam.y); b.world.draw(ctx,b.cam,W,H);
    const fakeS={t:bdT,world:b.world,size:4000}; const save=S; S=fakeS; drawClouds(ctx,b.cam,true); drawClouds(ctx,b.cam,false); S=save; ctx.restore();
    ctx.fillStyle='rgba(4,8,14,0.45)'; ctx.fillRect(0,0,W,H);
  }

  return { debug:{ kill:()=>S&&killPlane(S.player,S.planes[1],'gun'), end:()=>{ if(S) S.tickets[1]=0; }, lose:()=>{ if(S) S.tickets[0]=0; } }, init, start, pause, resume, respawn, quit, set onEnd(f){onEnd=f;}, get state(){ return S?S.state:'idle'; }, settings, get S(){return S;}, toast };
})();
