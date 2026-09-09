// game.js — simulation + rendering: altitude & perspective scaling, fuel, component damage,
// runway takeoff/landing, guns, missiles, bombs, ground units, AI, HUD, camera.
window.Game = (function(){
  const TAU=Math.PI*2, DEG=Math.PI/180;
  const clamp=(v,a,b)=>v<a?a:v>b?b:v, lerp=(a,b,t)=>a+(b-a)*t, rnd=(a,b)=>a+Math.random()*(b-a);
  const norm=a=>{ while(a>Math.PI)a-=TAU; while(a<-Math.PI)a+=TAU; return a; };
  const dist=(a,b)=>Math.hypot(a.x-b.x,a.y-b.y);
  const dist3=(a,b)=>Math.hypot(a.x-b.x,a.y-b.y,((a.alt||0)-(b.alt||0))*0.6);
  const HC=4200, ALT_MAX=3000, CLOUD_ALT=2000, GRAV=650;
  const AI_NAMES=['Viper','Ghost','Maverick','Iceman','Red Baron','Falcon','Hawk','Bandit','Cobra','Reaper','Wolf','Sabre','Raven','Duke','Lynx','Storm','Blitz','Jester','Rogue','Hornet','Kestrel','Dagger','Vandal','Comet','Rook','Talon','Zulu','Echo','Bravo','Kilo','Nomad','Ranger','Spectre','Titan','Ivan','Hans','Pierre','Sven','Kenji','Jack','Mick','Boris'];

  let canvas, ctx, W=0, H=0, dpr=1;
  let S=null;
  let settings={ control:'mouse', quality:2, name:'Pilot' };
  let onEnd=null;
  const input={ keys:{}, mx:0, my:0, lmb:false, rmb:false, gp:null };
  let backdrop=null, bdT=0;
  let lastT=0, acc=0; const DT=1/60;
  let hudMsgs=[];
  let shx=0, shy=0;

  // ------------------------------------------------------------ setup
  function init(cv){
    canvas=cv; ctx=cv.getContext('2d'); resize(); window.addEventListener('resize',resize);
    window.addEventListener('keydown',e=>{ if(e.target.tagName==='INPUT'||e.target.tagName==='SELECT') return; input.keys[e.code]=true; if (S&&S.state!=='ended' && !e.repeat) keyPress(e.code); if(['Space','ArrowUp','ArrowDown','ArrowLeft','ArrowRight','Tab'].includes(e.code)) e.preventDefault(); });
    window.addEventListener('keyup',e=>{ input.keys[e.code]=false; });
    cv.addEventListener('mousemove',e=>{ input.mx=e.clientX; input.my=e.clientY; });
    cv.addEventListener('mousedown',e=>{ input.mx=e.clientX; input.my=e.clientY; if(e.button===0) input.lmb=true; if(e.button===2){ input.rmb=true; fireMissile(S&&S.player); } e.preventDefault(); });
    window.addEventListener('mouseup',e=>{ if(e.button===0) input.lmb=false; if(e.button===2) input.rmb=false; });
    cv.addEventListener('contextmenu',e=>e.preventDefault());
    cv.addEventListener('wheel',e=>{ if(!S) return; S.cam.userZoom=clamp(S.cam.userZoom*(e.deltaY>0?0.9:1.1),0.45,1.8); e.preventDefault(); },{passive:false});
    cv.addEventListener('touchstart',e=>{ const t=e.touches[0]; input.mx=t.clientX; input.my=t.clientY; input.lmb=true; e.preventDefault(); },{passive:false});
    cv.addEventListener('touchmove',e=>{ const t=e.touches[0]; input.mx=t.clientX; input.my=t.clientY; e.preventDefault(); },{passive:false});
    cv.addEventListener('touchend',()=>{ input.lmb=false; });
    window.addEventListener('gamepadconnected',()=>{ toast('Gamepad connected'); });
    requestAnimationFrame(frame);
  }
  function resize(){ dpr=Math.min(2,window.devicePixelRatio||1); W=window.innerWidth; H=window.innerHeight; canvas.width=W*dpr; canvas.height=H*dpr; canvas.style.width=W+'px'; canvas.style.height=H+'px'; }
  function toast(t){ hudMsgs.push({t, life:2.8}); }
  function keyPress(code){
    const p=S.player; if(!p) return;
    if (code==='KeyF') dropFlares(p);
    if (code==='KeyB') dropBomb(p);
    if (code==='KeyE') fireMissile(p);
    if (code==='KeyQ'||code==='KeyT'||code==='Tab') cycleTarget(p);
    if ((code==='KeyR'||code==='Space'||code==='Enter') && !p.alive && S.respawnT<=0) respawn();
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
    S = { state:'battle', mode, diff, world, size:worldSize, t:0, time: mode==='test'?1e9:(mode==='air'?12*60:14*60), planes:[], bullets:[], missiles:[], bombs:[], flares:[], ground:[], parts:[], fx:[], decals:[], feed:[], tickets:[mode==='ground'?150:100, mode==='ground'?150:100], maxTickets:mode==='ground'?150:100,
      cam:{x:0,y:0,alt:700,zoom:1.2,userZoom:1,shake:0}, player:null, respawnT:0, score:{kills:0,assists:0,ground:0,bases:0,deaths:0,damage:0,sl:0,rp:0,events:[]}, ended:false, warn:false, mini:null, playerDef: planeById(planeId), flybyT:0, killedBy:null, hitMarker:0, killFlash:null };
    const R = Art.rng(seed+5);
    const b0 = world.findLand(Art.rng(seed+11)); const b1 = world.findLand(Art.rng(seed+17));
    b0.x = worldSize*0.18 + (b0.x-worldSize/2)*0.2; b0.y = worldSize*0.5 + (b0.y-worldSize/2)*0.5; b1.x = worldSize*0.82 + (b1.x-worldSize/2)*0.2; b1.y = worldSize*0.5 + (b1.y-worldSize/2)*0.5;
    const runwayDir = t => Math.atan2(worldSize/2 - (t?b1.y:b0.y), worldSize/2 - (t?b1.x:b0.x)) + (R()-0.5)*0.5;
    S.bases=[ mkBase(0,b0.x,b0.y,runwayDir(0)), mkBase(1,b1.x,b1.y,runwayDir(1)) ];
    S.ground.push(...S.bases);
    const nTanks = mode==='ground'?8:mode==='test'?6:3, nAA = mode==='ground'?4:mode==='test'?2:2;
    for (const team of [0,1]){ const base=S.bases[team];
      for (let i=0;i<nTanks;i++){ const p=nearLand(base.x,base.y,300,1400,R); S.ground.push({kind:'tank',team,x:p.x,y:p.y,alt:0,hd:R()*TAU,hp:130,maxhp:130,alive:true,r:16,cd:R()*3}); }
      for (let i=0;i<nAA;i++){ const p=nearLand(base.x,base.y,200,900,R); S.ground.push({kind:'aa',team,x:p.x,y:p.y,alt:0,hd:0,hp:160,maxhp:160,alive:true,r:14,cd:R()*2}); }
    }
    const pdef = planeById(planeId);
    const player = mkPlane(pdef, 0, settings.name||'Pilot', true); S.player=player; S.planes.push(player);
    const pool = () => { const rk=pdef.rank; const c=window.PLANES.filter(p=>Math.abs(p.rank-rk)<=1 && (mode!=='air' || p.role!=='Bomber')); return c.length?c:window.PLANES.filter(p=>p.rank===rk); };
    const names = AI_NAMES.slice().sort(()=>Math.random()-0.5);
    // both teams fly the same mix so neither side is handed a better line-up
    const roster=[]; const c=pool();
    for (let i=0;i<teamSize;i++){ let def=c[Math.floor(Math.random()*c.length)];
      if (mode==='ground' && i%3===1){ const at=c.filter(p=>p.bombs); if(at.length) def=at[Math.floor(Math.random()*at.length)]; }
      if (mode==='test') def = c.filter(p=>!p.bombs)[0]||def;
      roster.push(def); }
    for (const team of [0,1]){ const list = team===0 ? roster.slice(1) : roster; // your slot replaces one of them
      list.forEach((def,i)=>S.planes.push(mkPlane(def, team, names.pop()||('Pilot'+team+i), false))); }
    S.planes.forEach(p=>spawnAt(p, true));
    S.cam.x=player.x; S.cam.y=player.y; S.cam.alt=player.alt;
    S.mini = makeMinimap(world);
    Audio2.ensure(); Audio2.engineStart(pdef.jet, pdef.ab); Audio2.music('battle'); Audio2.duck(true);
    feed('Battle started: '+ (mode==='air'?'Air Battle':mode==='ground'?'Ground Strike':'Test Flight') +' · '+theme);
    lastT=performance.now(); acc=0;
  }
  function nearLand(x,y,rmin,rmax,R){ for (let i=0;i<80;i++){ const a=R()*TAU, r=rmin+R()*(rmax-rmin); const px=clamp(x+Math.cos(a)*r,150,S.size-150), py=clamp(y+Math.sin(a)*r,150,S.size-150); if (S.world.isLand(px,py)) return {x:px,y:py}; } return {x,y}; }
  function mkBase(team,x,y,hd){ return {kind:'base',team,x,y,alt:0,hd,hp:2600,maxhp:2600,alive:true,r:120,w:340,h:170}; }
  function mkPlane(def, team, name, isPlayer){
    const p={ def, team, name, isPlayer, x:0,y:0,alt:0,vz:0,climbCmd:0, hd:0, speed:0, throttle:1, hp:def.hp, maxhp:def.hp, alive:true, ammo:0, maxAmmo:0, ammo2:0, maxAmmo2:0, heat:0, cd:0, cd2:0, tcd:0, missiles:[], missileIdx:0, mcd:0, flares:def.flares||0, maxFlares:def.flares||0, fcd:0, bombs:def.bombs?def.bombs.n:0, bcd:0, target:null, lockT:0, locked:false, dmgBy:new Map(), lastHitBy:null, lastHitT:-99, kills:0, spawnProt:0, ai:{ state:'hunt', retarget:0, evadeDir:1, evadeT:0, jinkT:0, gtarget:null, vDir:0, rtb:false }, prop:0, omega:0, sprite:null, wreck:null, respawns:0, smokeT:0, gunSoundT:0, hitFlash:0, fuel:def.fuel, maxFuel:def.fuel, dmg:{engine:0,controls:0,leak:false,fire:0}, takeoff:false, landed:false, repairT:0, onGround:false, stall:false, turnCmd:0 };
    if (def.guns){ p.ammo = Math.max(150, Math.round(def.guns.rof*30)); p.maxAmmo=p.ammo; }
    if (def.guns2){ p.ammo2 = Math.max(200, Math.round(def.guns2.rof*30)); p.maxAmmo2=p.ammo2; }
    if (def.missiles) p.missiles = def.missiles.map(([key,n])=>({key,n,max:n}));
    Art.plane(def.id).then(sp=>p.sprite=sp);
    return p;
  }
  function restock(p){ p.hp=p.maxhp; p.ammo=p.maxAmmo; p.ammo2=p.maxAmmo2; p.heat=0; p.flares=p.maxFlares; p.bombs=p.def.bombs?p.def.bombs.n:0; p.missiles.forEach(m=>m.n=m.max); p.fuel=p.maxFuel; p.dmg={engine:0,controls:0,leak:false,fire:0}; }
  function spawnAt(p, initial){
    const base=S.bases[p.team];
    restock(p); p.alive=true; p.wreck=null; p.target=null; p.lockT=0; p.locked=false; p.dmgBy=new Map(); p.spawnProt=4; p.ai.state='hunt'; p.ai.retarget=0; p.ai.rtb=false; p.landed=false; p.repairT=0; p.vz=0; p.climbCmd=0; p.stall=false;
    const a = Math.atan2(S.size/2-base.y, S.size/2-base.x);
    if (initial){
      const idx=S.planes.indexOf(p)%8;
      p.x = base.x + Math.cos(a+Math.PI)*160 + Math.cos(a+Math.PI/2)*(idx-3.5)*80; p.y = base.y + Math.sin(a+Math.PI)*160 + Math.sin(a+Math.PI/2)*(idx-3.5)*80;
      p.hd = Math.atan2(Math.cos(a), -Math.sin(a)); p.alt = 600 + (idx%3)*120; p.speed=p.def.speed*0.7; p.throttle=1; p.takeoff=false; p.onGround=false;
    } else {
      const rd = base.hd; const toward = (Math.cos(rd)*Math.cos(a)+Math.sin(rd)*Math.sin(a)) >= 0 ? 1 : -1;
      const dirx=Math.cos(rd)*toward, diry=Math.sin(rd)*toward;
      p.x = base.x - dirx*(base.w/2-30); p.y = base.y - diry*(base.w/2-30);
      p.hd = Math.atan2(dirx, -diry);
      p.alt=0; p.speed=0; p.throttle=1; p.takeoff=true; p.onGround=true;
      if (p.isPlayer) toast('On the runway — hold W for full throttle, then Shift to rotate');
    }
  }

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
    const cam=S.cam;
    const vx=Math.sin(P.hd)*(P.speed||0), vy=-Math.cos(P.hd)*(P.speed||0);
    cam.x=lerp(cam.x, P.x+vx*0.25, 1-Math.pow(0.02,dt)); cam.y=lerp(cam.y, P.y+vy*0.25, 1-Math.pow(0.02,dt));
    cam.alt=lerp(cam.alt, P.alt, 1-Math.pow(0.05,dt));
    const base = Math.min(1, W/1400)*1.25; const speedZoom = 1 - clamp((P.speed-350)/900,0,1)*0.2;
    cam.zoom = lerp(cam.zoom, base*cam.userZoom*speedZoom, 1-Math.pow(0.05,dt)); cam.shake*=Math.pow(0.02,dt);
    Audio2.engineUpdate(P.alive?P.throttle*(P.fuel>0?1:0)*(1-0.5*P.dmg.engine):0, P.speed/P.def.speed, P.def.ab && P.throttle>0.92 && P.fuel>0);
    let warn=false; for (const m of S.missiles) if (m.target===P) warn=true; if (warn!==S.warn){ S.warn=warn; Audio2.warning(warn); }
    S.flybyT-=dt; if (S.flybyT<=0){ for (const p of S.planes){ if (p!==P&&p.alive&&P.alive&&dist3(p,P)<150&&p.speed>250){ Audio2.flyby((p.x-P.x)/200); S.flybyT=1.5; break; } } }
    if (S.mode!=='test'){ if (S.tickets[0]<=0||S.tickets[1]<=0||S.time<=0) endBattle(); }
  }
  function respawn(){ const P=S.player; if (S.tickets[0]<=0) return; if (!S.bases[0].alive){ toast('Your airfield is destroyed — no respawn possible'); return; } spawnAt(P,false); P.respawns++; S.respawnT=0; S.killedBy=null; Audio2.engineStart(P.def.jet,P.def.ab); }

  // ---------------- player control
  function playerControl(p, dt){
    let turnCmd=0, thrCmd=0, climb=0;
    const k=input.keys;
    if (k.KeyW) thrCmd=1; if (k.KeyS) thrCmd=-1;
    if (k.ArrowUp||k.ShiftLeft||k.ShiftRight) climb=1; if (k.ArrowDown||k.ControlLeft||k.ControlRight) climb=-1;
    p.throttle=clamp(p.throttle+thrCmd*0.9*dt,0,1);
    const gp=input.gp; let gpAim=false;
    if (gp){ const lx=gp.axes[0], ly=gp.axes[1], ry=gp.axes[3]||0; if (gp.buttons[5]&&gp.buttons[5].pressed) p.throttle=clamp(p.throttle+0.9*dt,0,1); if (gp.buttons[4]&&gp.buttons[4].pressed) p.throttle=clamp(p.throttle-0.9*dt,0,1);
      if (Math.abs(ry)>0.3) climb=-ry;
      if (Math.hypot(lx,ly)>0.35){ if (settings.control==='mouse'){ const want=Math.atan2(lx,-ly); turnCmd=clamp(norm(want-p.hd)*4,-1,1); gpAim=true; } else turnCmd=lx; } }
    if (settings.control==='mouse' && !gpAim){
      const s=scaleFor(p.alt)*S.cam.zoom; const wx=S.cam.x+(input.mx-W/2)/s, wy=S.cam.y+(input.my-H/2)/s;
      const d=Math.hypot(wx-p.x,wy-p.y); if (d>26){ const want=Math.atan2(wx-p.x,-(wy-p.y)); turnCmd=clamp(norm(want-p.hd)*3.5,-1,1); }
    }
    if (k.KeyA||k.ArrowLeft) turnCmd=-1; if (k.KeyD||k.ArrowRight) turnCmd=1;
    p.turnCmd=turnCmd; p.climbCmd=climb;
    const firing = k.Space||input.lmb||(gp&&gp.buttons[7]&&gp.buttons[7].value>0.5);
    if (firing && !p.landed) fireGuns(p, dt);
    if (gp){ if (gp.buttons[6]&&gp.buttons[6].value>0.5) fireMissile(p); if (gp.buttons[0]&&gp.buttons[0].pressed) dropFlares(p); if (gp.buttons[2]&&gp.buttons[2].pressed) dropBomb(p); if (gp.buttons[3]&&gp.buttons[3].pressed&&!p.gpY) cycleTarget(p); p.gpY=gp.buttons[3]&&gp.buttons[3].pressed; }
    const acq = Math.max(3200, ...p.missiles.map(m=>window.MISSILES[m.key].range*1.3));
    if (!p.target||!p.target.alive||dist(p,p.target)>acq*1.4) p.target=pickTarget(p, acq, 75);
    updateLock(p, dt);
  }
  function pollGamepad(){ input.gp=null; if (!navigator.getGamepads) return; const gps=navigator.getGamepads(); for (const g of gps){ if (g&&g.connected){ input.gp=g; break; } } }
  function pickTarget(p, range, coneDeg){
    const m=p.missiles&&p.missiles[p.missileIdx]; const md=m&&m.n>0?window.MISSILES[m.key]:null;
    let best=null, bs=1e9;
    for (const e of S.planes){ if (e.team===p.team||!e.alive) continue; const d=dist(p,e); if (d>range) continue;
      const a=Math.abs(norm(Math.atan2(e.x-p.x,-(e.y-p.y))-p.hd)); if (a>coneDeg*DEG) continue;
      let s=d*(0.4+a)+Math.abs(e.alt-p.alt)*0.5;
      if (md && lockCheck(p, md, e).ok) s*=0.35;   // prefer a target the seeker can actually take
      if (s<bs){ bs=s; best=e; } }
    return best;
  }
  function cycleTarget(p){ const cands=S.planes.filter(e=>e.team!==p.team&&e.alive&&dist(p,e)<3600).sort((a,b)=>dist(p,a)-dist(p,b)); if(!cands.length) return; const i=cands.indexOf(p.target); p.target=cands[(i+1)%cands.length]; p.lockT=0; p.locked=false; Audio2.click(); }
  // Aspect angle: 0 = dead astern of the target (hot tailpipe in view), 180 = head-on.
  function aspectAngle(shooter, target){ const toShooter=Math.atan2(shooter.x-target.x,-(shooter.y-target.y)); return Math.abs(norm(toShooter - (target.hd+Math.PI))); }
  function lockCheck(p, md, t){
    if (!t||!t.alive) return {ok:false, why:'NO TARGET'};
    const d=dist3(p,t);
    if (d>md.range) return {ok:false, why:'OUT OF RANGE', far:true};
    if (d<md.minRange) return {ok:false, why:'TOO CLOSE'};
    const off=Math.abs(norm(Math.atan2(t.x-p.x,-(t.y-p.y))-p.hd));
    // once you have the lock the seeker holds a wider cone than it needed to acquire it
    const cone = (p.locked ? md.lockFov*1.5 : md.lockFov)*DEG;
    if (off>cone) return {ok:false, why:'AIM AT TARGET'};
    if (Math.abs(t.alt-p.alt) > (md.guidance==='ir'?900:1600)) return {ok:false, why:'ALTITUDE'};
    if (md.guidance==='ir' && md.rearOnly && aspectAngle(p,t) > (md.rearArc||95)*DEG) return {ok:false, why:'GET BEHIND THE TARGET'};
    if (md.guidance==='ir' && t.onGround) return {ok:false, why:'NO HEAT SOURCE'};
    return {ok:true, why:md.guidance==='sarh'?'HOLD THE LOCK':'LOCKED'};
  }
  function updateLock(p, dt){
    let m=p.missiles&&p.missiles[p.missileIdx];
    if (!m||m.n<=0||!p.target){ p.lockT=0; p.locked=false; p.lockWhy=null; return; }
    // if the selected seeker can't take this shot but another one can, switch to it
    if (!p.locked && p.missiles.length>1 && !lockCheck(p, window.MISSILES[m.key], p.target).ok){
      for (let i=0;i<p.missiles.length;i++){
        const alt=p.missiles[i]; if (i===p.missileIdx||alt.n<=0) continue;
        if (lockCheck(p, window.MISSILES[alt.key], p.target).ok){ p.missileIdx=i; m=alt; p.lockT=0; if (p.isPlayer) toast(window.MISSILES[alt.key].name+' — better shot'); break; }
      }
    }
    const md=window.MISSILES[m.key];
    const c=lockCheck(p, md, p.target);
    p.lockWhy=c.why;
    if (c.ok){ p.lockGrace=1.1; p.lockT+=dt; if (!p.locked && p.lockT>=md.lockTime){ p.locked=true; if(p.isPlayer) Audio2.lock(); } else if (p.isPlayer && !p.locked && Math.floor(p.lockT*6)!==Math.floor((p.lockT-dt)*6)) Audio2.lockTone(); }
    else if (p.locked){ // don't drop a good lock over a momentary wobble
      p.lockGrace=(p.lockGrace||0)-dt; if (p.lockGrace<=0){ p.locked=false; p.lockT=0; if (p.isPlayer) toast('LOCK LOST · '+c.why); } }
    else { p.lockT=Math.max(0,p.lockT-dt*1.2); }
    p.lockProgress = p.locked?1:clamp(p.lockT/md.lockTime,0,1); p.lockMd=md;
  }

  // ---------------- AI
  function aiControl(p, dt){
    const ai=p.ai, def=p.def, diff=S.diff; const react = diff===0?0.5:diff===1?0.8:1.0;
    ai.retarget-=dt;
    const isBomber = !!def.bombs && (def.role==='Bomber' || def.role==='Attacker');
    const enemies = S.planes.filter(e=>e.team!==p.team&&e.alive);
    const base=S.bases[p.team];
    if (p.landed){ p.turnCmd=0; p.climbCmd=0; p.throttle = p.repairT<=0 ? 1 : 0; return; }
    if (p.takeoff){ p.throttle=1; p.turnCmd=0; p.climbCmd=1; return; }
    const noAmmo = (!def.guns||p.ammo<=0) && (!def.guns2||p.ammo2<=0) && p.bombs<=0 && !p.missiles.some(m=>m.n>0);
    if (!ai.rtb && base.alive && (p.fuel<p.maxFuel*0.12 || noAmmo || (p.hp<p.maxhp*0.3 && Math.random()<dt*0.2))) ai.rtb=true;
    if (ai.rtb){
      if (!base.alive) ai.rtb=false;
      else { const d=dist(p,base); const want=Math.atan2(base.x-p.x,-(base.y-p.y)); p.turnCmd=clamp(norm(want-p.hd)*3,-1,1);
        if (d>600){ p.throttle=0.8; p.climbCmd=clamp((400-p.alt)/200,-1,1); }
        else { p.throttle=0.25; p.climbCmd=-1; }
        return; }
    }
    if (ai.retarget<=0){ ai.retarget=1.5+Math.random();
      let best=null,bs=1e9; for (const e of enemies){ let s=dist3(p,e); if (e===p.lastHitBy && S.t-p.lastHitT<4) s*=0.4; if (e.isPlayer) s*=0.85; if (e.target===p) s*=0.7; if (e.def.role==='Bomber') s*=0.8; if (s<bs){bs=s;best=e;} }
      p.target=best;
      if (isBomber){ let gb=null, gs=1e9; for (const g of S.ground){ if (g.team===p.team||!g.alive) continue; let s=dist(p,g); if (g.kind==='base') s*=0.5; if (s<gs){gs=s;gb=g;} } ai.gtarget=gb; }
    }
    let threat=null, td=1e9;
    for (const e of enemies){ const d=dist3(p,e); if (d<560){ const a=Math.abs(norm(Math.atan2(p.x-e.x,-(p.y-e.y))-e.hd)); if (a<25*DEG && d<td){ td=d; threat=e; } } }
    let missileIn=null; for (const m of S.missiles) if (m.target===p && dist(m,p)<900) missileIn=m;
    let want=p.hd, thr=1; let wantAlt = def.role==='Bomber'?2100:def.role==='Attacker'?450:1100;
    ai.evadeT-=dt; ai.jinkT-=dt;
    if (missileIn && Math.random()<react*0.9){ if (p.fcd<=0 && p.flares>0) dropFlares(p); ai.state='evade'; ai.evadeT=Math.max(ai.evadeT,0.8); }
    if (threat && ai.state!=='evade' && Math.random()<react*dt*3){ ai.state='evade'; ai.evadeT=1.2+Math.random()*1.6; ai.evadeDir=Math.random()<0.5?-1:1; ai.vDir=Math.random()<0.5?-1:1; }
    if (ai.state==='evade'){ want=p.hd+ai.evadeDir*1.2; thr=1; wantAlt=p.alt+ai.vDir*500; if (ai.evadeT<=0) ai.state='hunt'; if (ai.jinkT<=0){ ai.jinkT=0.6+Math.random()*0.8; if (Math.random()<0.35) ai.evadeDir*=-1; } }
    else if (isBomber && ai.gtarget && p.bombs>0){
      const g=ai.gtarget; const d=dist(p,g); want=Math.atan2(g.x-p.x,-(g.y-p.y)); thr=1;
      wantAlt = def.role==='Bomber'?1600:380;
      const ip=bombImpact(p);
      if (Math.hypot(ip.x-g.x,ip.y-g.y) < (g.kind==='base'?110:45) && p.bcd<=0) dropBomb(p);
      if (def.guns && def.guns.cal==='gau' && d<500 && Math.abs(norm(want-p.hd))<4*DEG && p.alt<600) fireGuns(p,dt);
    }
    else if (p.target){
      const t=p.target; const d=dist(p,t);
      const gs = def.guns?def.guns.speed:1500; const tt=d/(gs+p.speed*0.5);
      const jit = diff===0?90:diff===1?35:10;
      const lx=t.x+Math.sin(t.hd)*t.speed*tt + rnd(-jit,jit), ly=t.y-Math.cos(t.hd)*t.speed*tt + rnd(-jit,jit);
      want=Math.atan2(lx-p.x,-(ly-p.y)); wantAlt=t.alt + (diff===0?rnd(-150,150):0);
      const off=Math.abs(norm(want-p.hd));
      const closing = (Math.sin(p.hd)*p.speed-Math.sin(t.hd)*t.speed)*(t.x-p.x) + (-Math.cos(p.hd)*p.speed+Math.cos(t.hd)*t.speed)*(t.y-p.y) > 0;
      thr = (d<170 && closing && off<0.5)?0.45:1;
      if (def.guns && d<def.guns.range*0.95 && off<(diff===2?4:diff===1?6:9)*DEG && Math.abs(t.alt-p.alt)<260) fireGuns(p,dt);
      if (p.missiles.length){ updateLock(p,dt); const mm=p.missiles[p.missileIdx]; if (mm&&mm.n<=0){ const alt=p.missiles.findIndex(x=>x.n>0); if (alt>=0) p.missileIdx=alt; } if (p.locked && Math.random()<dt*react*1.5) fireMissile(p); }
    } else {
      const cx=S.size/2+Math.sin(S.t*0.1+p.x*0.001)*S.size*0.25, cy=S.size/2+Math.cos(S.t*0.13)*S.size*0.25; want=Math.atan2(cx-p.x,-(cy-p.y)); thr=0.8;
    }
    const m=250; if (p.x<m||p.y<m||p.x>S.size-m||p.y>S.size-m) want=Math.atan2(S.size/2-p.x,-(S.size/2-p.y));
    for (const o of S.planes){ if (o===p||!o.alive) continue; if (Math.abs(o.alt-p.alt)>80) continue; const d=dist(p,o); if (d<60){ const a=Math.atan2(o.x-p.x,-(o.y-p.y)); const s=norm(a-p.hd); want=p.hd-(s>0?1:-1)*1.0; wantAlt=p.alt+(o.alt>p.alt?-200:200); break; } }
    p.turnCmd=clamp(norm(want-p.hd)*3,-1,1);
    p.throttle=lerp(p.throttle,thr,dt*2);
    if (p.speed<def.speed*0.4){ p.throttle=1; wantAlt=Math.min(wantAlt,p.alt-100); }
    if (p.alt<200) wantAlt=Math.max(wantAlt,340);
    p.climbCmd=clamp((wantAlt-p.alt)/220,-1,1);
    if (p.fuel<=0) p.climbCmd=-0.5;
  }

  // ---------------- plane physics
  function updatePlane(p, dt){
    const def=p.def;
    if (!p.alive){ if (p.wreck) updateWreck(p, dt); return; }
    p.spawnProt=Math.max(0,p.spawnProt-dt); p.cd-=dt; p.cd2-=dt; p.mcd-=dt; p.fcd-=dt; p.bcd-=dt; p.tcd-=dt; p.heat=Math.max(0,p.heat-dt*0.35);
    const vmax=def.speed, vmin=vmax*0.32;
    const abOn = def.ab && p.throttle>0.92;
    if (p.fuel>0){ p.fuel -= (0.15+0.85*p.throttle*p.throttle)*(abOn?2.6:1)*dt; if (p.dmg.leak) p.fuel -= 4*dt; if (p.fuel<=0){ p.fuel=0; if (p.isPlayer) toast('ENGINE OUT — no fuel. Glide to your airfield'); } }
    const power = (p.fuel>0?1:0)*(1-0.6*p.dmg.engine);
    if (p.dmg.fire>0){ p.dmg.fire-=dt; p.hp-=p.maxhp*0.045*dt; if (p.speed>vmax*0.95 && Math.random()<dt*0.5){ p.dmg.fire=0; if (p.isPlayer) toast('Fire extinguished'); } if (p.hp<=0){ killPlane(p,p.lastHitBy,'fire'); return; } }
    if (p.landed){
      p.speed=Math.max(0,p.speed-200*dt); p.alt=0; p.vz=0;
      if (p.repairT>0){ p.repairT-=dt; if (p.repairT<=0){ restock(p); if (p.isPlayer) toast('Repaired, refuelled and rearmed — throttle up to take off'); } }
      if (p.repairT<=0 && p.throttle>0.6 && p.speed<5){ p.landed=false; p.takeoff=true; p.onGround=true; }
      return;
    }
    const tgt = p.onGround ? (p.throttle*vmax*0.9*power) : vmin+(vmax-vmin)*p.throttle*power;
    const accel=def.accel*(p.onGround?0.9:1)*(abOn?1.3:1)*(0.3+0.7*power);
    p.speed += clamp(tgt-p.speed, -def.accel*dt*(p.fuel>0?1.2:0.35), accel*dt);
    const sf=p.speed/vmax; const f = sf<0.55 ? 0.42+0.58*(sf/0.55) : 1-(sf-0.55)/0.45*0.42;
    let turnAvail = def.turn*DEG*f*(1-0.5*p.dmg.controls); if (p.onGround) turnAvail*=0.12;
    const omega = clamp(p.turnCmd||0,-1,1)*turnAvail; p.omega=omega;
    p.hd=norm(p.hd+omega*dt);
    p.speed -= Math.abs(omega)*p.speed*0.055*dt;
    const stall = !p.onGround && p.speed < vmin*0.95; p.stall=stall;
    if (p.onGround){
      if (p.speed > vmin*1.05 && (p.climbCmd>0 || p.takeoff)){ p.vz = def.climb*0.5; p.alt += p.vz*dt; if (p.alt>60){ p.onGround=false; p.takeoff=false; if (p.isPlayer) toast('Airborne'); } }
      else { p.alt=0; p.vz=0; }
    } else {
      const cap = def.climb*clamp((p.speed-vmin)/(vmax-vmin),0,1)*(0.35+0.65*power);
      let vzT = p.climbCmd>0 ? p.climbCmd*cap : p.climbCmd*def.climb*1.5;
      if (p.alt<90 && p.climbCmd<=0) vzT = Math.min(vzT, -70); // sink into the flare when you get low
      if (stall) vzT = Math.min(vzT, -180);
      if (p.fuel<=0 && p.climbCmd>=0) vzT = Math.min(vzT, -40);
      p.vz = lerp(p.vz, vzT, 1-Math.pow(0.02,dt));
      p.speed -= p.vz*0.26*dt;
      p.alt += p.vz*dt;
      if (p.alt>=ALT_MAX){ p.alt=ALT_MAX; p.vz=Math.min(0,p.vz); }
      if (p.alt<=0){
        p.alt=0; const base=S.bases[p.team];
        if (base.alive && inBase(base,p.x,p.y) && p.speed<vmin*2.1 && p.vz>-220){ p.landed=true; p.repairT=8; p.vz=0; p.throttle=0; p.onGround=true; if (p.isPlayer) toast('LANDED — repairing & rearming (8 s)'); feed(p.name+' landed to rearm', p.team===0?'#7fb8ff':'#ff7070'); return; }
        crash(p); return;
      }
    }
    p.speed = clamp(p.speed, 0, vmax*1.25);
    p.x+=Math.sin(p.hd)*p.speed*dt; p.y-=Math.cos(p.hd)*p.speed*dt;
    p.x=clamp(p.x,40,S.size-40); p.y=clamp(p.y,40,S.size-40);
    p.prop+=p.speed*0.08*dt+p.throttle*30*dt*power;
    const q=onScreen(p)?settings.quality:0;
    const tail=tailPos(p);
    if (q>0 && (p.dmg.engine>0.3 || p.hp<p.maxhp*0.5)){ p.smokeT-=dt; if (p.smokeT<=0){ p.smokeT=p.hp<p.maxhp*0.25?0.04:0.08; addPart({x:tail.x,y:tail.y,alt:p.alt,vx:rnd(-15,15),vy:rnd(-15,15),life:rnd(1.2,2.2),r:rnd(6,10),grow:14,col:p.hp<p.maxhp*0.25?[40,40,40]:[120,120,120],a:0.55,type:'smoke'}); } }
    if (q>0 && p.dmg.fire>0 && Math.random()<dt*40) addPart({x:tail.x+rnd(-6,6),y:tail.y+rnd(-6,6),alt:p.alt,vx:rnd(-20,20),vy:rnd(-20,20),life:rnd(0.2,0.5),r:rnd(4,8),grow:-6,col:[255,150,40],a:0.9,type:'fire'});
    if (q>0 && p.dmg.leak && Math.random()<dt*30) addPart({x:tail.x,y:tail.y,alt:p.alt,vx:0,vy:0,life:1.2,r:3,grow:5,col:[235,235,235],a:0.45,type:'smoke'});
    if (q>0 && Math.abs(omega)>turnAvail*0.7 && sf>0.5 && !p.onGround){ const s=wingtips(p); if (p.prevTips){ for (let i=0;i<2;i++) addPart({x:s[i].x,y:s[i].y,x2:p.prevTips[i].x,y2:p.prevTips[i].y,alt:p.alt,vx:0,vy:0,life:0.55,r:2,grow:0,col:[255,255,255],a:0.55,type:'vortex'}); } p.prevTips=s; } else p.prevTips=null;
    if (q>1 && def.jet && p.throttle>0.85 && sf>0.7 && p.alt>900 && p.fuel>0){ if (p.prevTail) addPart({x:tail.x,y:tail.y,x2:p.prevTail.x,y2:p.prevTail.y,alt:p.alt,vx:0,vy:0,life:1.6,r:3,grow:0,col:[255,255,255],a:0.22,type:'vortex'}); p.prevTail=tail; } else p.prevTail=null;
    if (q>0 && p.onGround && p.speed>20 && Math.random()<dt*20) addPart({x:tail.x,y:tail.y,alt:0,vx:rnd(-10,10),vy:rnd(-10,10),life:0.8,r:4,grow:8,col:[200,190,160],a:0.3,type:'smoke'});
    if (def.turret && p.tcd<=0 && !p.onGround){ const e=nearestEnemy(p, def.turret.range); if (e){ p.tcd=1/def.turret.rof; const a=Math.atan2(e.x-p.x,-(e.y-p.y))+rnd(-1,1)*def.turret.spread*DEG; spawnBullet(p,p.x,p.y,a,def.turret,p.speed*0.3,e); } }
  }
  function crash(p){ if (!p.alive) return; explosionFx(p.x,p.y,0,1.2,true); Audio2.explosion((p.x-S.cam.x)/900, p.isPlayer?0:dist(p,S.player), 1.3); S.decals.push({x:p.x,y:p.y,r:40,life:60}); killPlane(p,null,'crash',true); }
  function onScreen(p, margin){ const c=S.cam; const s=scaleFor(p.alt||0); const hw=W/2/(c.zoom*s)+(margin||120), hh=H/2/(c.zoom*s)+(margin||120); return Math.abs(p.x-c.x)<hw && Math.abs(p.y-c.y)<hh; }
  function tailPos(p){ const L=p.def.size; return {x:p.x-Math.sin(p.hd)*L*0.45, y:p.y+Math.cos(p.hd)*L*0.45}; }
  function nosePos(p){ const L=p.def.size; return {x:p.x+Math.sin(p.hd)*L*0.5, y:p.y-Math.cos(p.hd)*L*0.5}; }
  function wingtips(p){ const sp=p.sprite; const half=(sp?sp.span:p.def.size)*0.5; const cx=Math.cos(p.hd), sx=Math.sin(p.hd); return [{x:p.x+cx*half,y:p.y+sx*half},{x:p.x-cx*half,y:p.y-sx*half}]; }
  function nearestEnemy(p, range){ let b=null,bd=range; for (const e of S.planes){ if (e.team===p.team||!e.alive) continue; const d=dist3(p,e); if (d<bd){bd=d;b=e;} } return b; }
  function updateWreck(p, dt){
    const w=p.wreck; w.t+=dt; p.x+=Math.sin(p.hd)*p.speed*dt; p.y-=Math.cos(p.hd)*p.speed*dt; p.speed*=Math.pow(0.6,dt); p.hd+=w.spin*dt; w.vz-=380*dt; p.alt+=w.vz*dt;
    w.st-=dt; if (w.st<=0){ w.st=0.05; addPart({x:p.x,y:p.y,alt:p.alt,vx:rnd(-20,20),vy:rnd(-20,20),life:1.6,r:8,grow:16,col:[30,30,30],a:0.6,type:'smoke'}); addPart({x:p.x+rnd(-8,8),y:p.y+rnd(-8,8),alt:p.alt,vx:0,vy:0,life:0.3,r:6,grow:-8,col:[255,140,40],a:0.9,type:'fire'}); }
    if (p.alt<=0){ p.alt=0; p.wreck=null; explosionFx(p.x,p.y,0,0.9,true); S.decals.push({x:p.x,y:p.y,r:30,life:60}); Audio2.explosion((p.x-S.cam.x)/900, dist(p,S.player), 0.9); }
  }

  // ---------------- weapons
  function fireGuns(p, dt){
    const def=p.def; if (!def.guns&&!def.guns2) return; if (p.heat>=1) return;
    const t=p.target&&p.target.alive?p.target:null;
    const shoot=(g, which)=>{
      const cdKey = which===1?'cd':'cd2', ammoKey=which===1?'ammo':'ammo2';
      if (p[cdKey]>0 || p[ammoKey]<=0) return;
      p[cdKey] = 1/g.rof; p[ammoKey]--; p.heat+=0.012*(g.cal==='gau'||g.cal==='vulcan'?0.5:1)*(1/(g.rof/9));
      p.shotIdx=(p.shotIdx||0)+1;
      const L=def.size; const spanH=(p.sprite?p.sprite.span:L)*0.5;
      let ox=0, oy=-L*0.42; if (g.n>=2 && g.cal!=='c37' && g.cal!=='c30'){ const side=(p.shotIdx%2?1:-1); ox=side*spanH*(g.n>=4?0.28:0.2); oy=-L*0.12; }
      const fwd={x:Math.sin(p.hd),y:-Math.cos(p.hd)}, right={x:Math.cos(p.hd),y:Math.sin(p.hd)};
      const sxp=p.x+right.x*ox+fwd.x*(-oy), syp=p.y+right.y*ox+fwd.y*(-oy);
      const a=p.hd+rnd(-1,1)*g.spread*DEG*(p.isPlayer?0.8:(S.diff===0?2.6:S.diff===1?1.9:1.3));
      spawnBullet(p, sxp, syp, a, g, p.speed, t);
      addPart({x:sxp,y:syp,alt:p.alt,vx:fwd.x*p.speed,vy:fwd.y*p.speed,life:0.04,r:g.size*1.2+1.5,grow:0,col:[255,220,120],a:0.8,type:'flash'});
      if (S.t-p.gunSoundT>0.055){ p.gunSoundT=S.t; Audio2.gun(g.cal,(p.x-S.cam.x)/900, p.isPlayer?0:dist(p,S.player)); }
    };
    if (def.guns) shoot(def.guns,1); if (def.guns2) shoot(def.guns2,2);
  }
  function spawnBullet(p, x, y, a, g, baseSpeed, target){
    const sp=g.speed+baseSpeed*0.6; const life=g.range/g.speed; let vz=0;
    if (target){ const d=dist(p,target); if (d<g.range*1.4 && Math.abs(target.alt-p.alt)<700) vz=(target.alt-p.alt)/(d/sp); }
    else if (p.alt<450 && !g.turret) vz=-p.alt/life;
    S.bullets.push({x,y,px:x,py:y,alt:p.alt,vz,vx:Math.sin(a)*sp,vy:-Math.cos(a)*sp,life,dmg:g.dmg,team:p.team,owner:p,col:g.col,size:g.size});
  }
  function fireMissile(p){
    if (!p||!p.alive||p.landed||p.onGround||!p.missiles.length||p.mcd>0) return;
    const m=p.missiles[p.missileIdx];
    if (!m||m.n<=0){ if (p.isPlayer){ const alt=p.missiles.findIndex(x=>x.n>0); if (alt>=0){ p.missileIdx=alt; toast(window.MISSILES[p.missiles[alt].key].name+' selected'); } else toast('No missiles left — land at your airfield to rearm'); } return; }
    if (!p.locked||!p.target){ if (p.isPlayer) toast(p.lockWhy? 'NO LAUNCH · '+p.lockWhy : 'No lock — hold the target in the seeker'); return; }
    const md=window.MISSILES[m.key]; m.n--; p.mcd=0.7; p.locked=false; p.lockT=0;
    const side=(m.n%2?1:-1); const right={x:Math.cos(p.hd),y:Math.sin(p.hd)}; const spanH=(p.sprite?p.sprite.span:p.def.size)*0.5;
    const ms={ x:p.x+right.x*spanH*0.35*side, y:p.y+right.y*spanH*0.35*side, alt:p.alt, hd:p.hd,
      speed:p.speed*0.9, def:md, key:m.key, target:p.target, team:p.team, owner:p, life:md.life, t:0, trailT:0, spr:null,
      travelled:0, active:md.guidance!=='sarh' && md.guidance!=='arh', lost:false, decoy:null };
    S.missiles.push(ms); Art.missile(m.key).then(s=>{ ms.spr=s; });
    Audio2.missileLaunch((p.x-S.cam.x)/900, p.isPlayer?0:dist(p,S.player));
    if (p.target.isPlayer) feed(p.name+' launched a '+md.name+' at you!');
  }
  function dropFlares(p){ if (!p.alive||p.flares<=0||p.fcd>0||p.onGround) return; p.fcd=0.35; p.flares=Math.max(0,p.flares-2); const tail=tailPos(p); for (let i=0;i<2;i++){ const side=i?1:-1; S.flares.push({x:tail.x,y:tail.y,alt:p.alt,vx:Math.sin(p.hd)*p.speed*0.5+Math.cos(p.hd)*side*90+rnd(-30,30),vy:-Math.cos(p.hd)*p.speed*0.5+Math.sin(p.hd)*side*90+rnd(-30,30),life:2.6,owner:p,t:0}); } Audio2.flare((p.x-S.cam.x)/900, p.isPlayer?0:dist(p,S.player)); }
  function dropBomb(p){ if (!p.alive||p.bombs<=0||p.bcd>0||p.onGround) return; p.bombs--; p.bcd=0.28; const b=p.def.bombs; S.bombs.push({x:p.x,y:p.y,alt:p.alt,vz:p.vz*0.5,vx:Math.sin(p.hd)*p.speed,vy:-Math.cos(p.hd)*p.speed,dmg:b.dmg,r:b.r,owner:p,team:p.team,hd:p.hd}); if (p.isPlayer){ Audio2.bombDrop(); if (p.bombs===0) toast('Bombs expended — land at your airfield to rearm'); } }
  function bombImpact(p){ const tf=Math.sqrt(2*Math.max(0,p.alt)/GRAV); const k=(1-Math.pow(0.55,tf))/Math.log(1/0.55); return {x:p.x+Math.sin(p.hd)*p.speed*k, y:p.y-Math.cos(p.hd)*p.speed*k, t:tf}; }

  function updateBullets(dt){
    const B=S.bullets;
    for (let i=B.length-1;i>=0;i--){ const b=B[i]; b.px=b.x; b.py=b.y; b.x+=b.vx*dt; b.y+=b.vy*dt; b.alt+=b.vz*dt; b.life-=dt; let dead=b.life<=0;
      if (!dead){
        for (const p of S.planes){ if (!p.alive||p.team===b.team) continue; if (Math.abs(p.x-b.x)>90||Math.abs(p.y-b.y)>90) continue; if (Math.abs(p.alt-b.alt)>55+p.def.size*0.25) continue; if (hitPlane(p,b.x,b.y)||hitPlane(p,(b.x+b.px)/2,(b.y+b.py)/2)){ damagePlane(p,b.dmg,b.owner,'gun'); hitFx(b.x,b.y,p.alt,b.dmg>12); dead=true; break; } }
        if (!dead && b.alt<=0){ dead=true;
          for (const g of S.ground){ if (!g.alive||g.team===b.team) continue; const rr=g.kind==='base'?g.r:g.r+6; if (Math.abs(g.x-b.x)<rr&&Math.abs(g.y-b.y)<rr && (g.kind==='base'?inBase(g,b.x,b.y):Math.hypot(g.x-b.x,g.y-b.y)<rr)){ damageGround(g,b.dmg*(g.kind==='base'?0.25:g.kind==='tank'?(b.dmg>12?0.9:0.25):0.8),b.owner); hitFx(b.x,b.y,0,false); break; } }
          if (settings.quality>0 && onScreen(b,0)) addPart({x:b.x,y:b.y,alt:0,vx:0,vy:0,life:0.5,r:3,grow:6,col:[190,180,150],a:0.4,type:'smoke'}); }
      }
      if (dead){ B[i]=B[B.length-1]; B.pop(); }
    }
  }
  function hitPlane(p,x,y){ const dx=x-p.x, dy=y-p.y; const c=Math.cos(p.hd), s=Math.sin(p.hd); const lx=dx*c+dy*s, ly=-dx*s+dy*c; const sp=p.sprite; const a=(sp?sp.span:p.def.size)*0.5*0.88, b=p.def.size*0.5*0.95; return (lx*lx)/(a*a)+(ly*ly)/(b*b)<=1; }
  function inBase(g,x,y){ const dx=x-g.x, dy=y-g.y; const c=Math.cos(g.hd), s=Math.sin(g.hd); const lx=dx*c+dy*s, ly=-dx*s+dy*c; return Math.abs(lx)<g.w/2&&Math.abs(ly)<g.h/2; }
  function updateMissiles(dt){
    const M=S.missiles;
    for (let i=M.length-1;i>=0;i--){
      const m=M[i]; const md=m.def; m.t+=dt; m.life-=dt;
      // --- propulsion: motor burn, then unpowered coast with drag
      if (m.t < md.boost) m.speed = Math.min(md.speed, m.speed + md.accel*dt);
      else m.speed = Math.max(280, m.speed - md.drag*dt);
      const spdFrac = clamp(m.speed/md.speed, 0.25, 1);

      // --- seeker / datalink checks
      let t = m.target;
      if (t && (t.alive===false || (t.life!==undefined && t.life<=0))) { t=m.target=null; m.lost=true; }
      if (t && !m.lost){
        const bearing = Math.abs(norm(Math.atan2(t.x-m.x,-(t.y-m.y)) - m.hd));
        if (bearing > md.fov*DEG){ m.lost=true; }                       // slid outside the seeker gimbal
        else if (md.guidance==='ir' && md.rearOnly && m.t>0.5 && t.alive && aspectAngle(m,t) > 78*DEG) m.lost=true; // lost the tailpipe
        else if (md.guidance==='sarh'){                                  // needs the launcher to keep illuminating
          const o=m.owner;
          const ok = o && o.alive && !o.onGround && o.target===t && Math.abs(norm(Math.atan2(t.x-o.x,-(t.y-o.y))-o.hd)) < 45*DEG && dist3(o,t) < md.range*1.25;
          if (!ok) m.lost=true;
        } else if (md.guidance==='arh' && !m.active){
          const d=Math.hypot(t.x-m.x,t.y-m.y);
          if (d < 900 || m.t > md.life*0.55){ m.active=true; if (t.isPlayer) toast('⚠ MISSILE WENT ACTIVE'); }
          else { const o=m.owner; if (!(o&&o.alive&&o.target===t)) m.lost=true; }
        }
        // --- IR decoys: flares only fool heat seekers, and modern seekers reject them
        if (md.guidance==='ir' && m.t>0.35){
          for (const f of S.flares){
            if (f.owner!==t) continue;
            const fd=Math.hypot(f.x-m.x,f.y-m.y); if (fd>560) continue;
            const rejection = md.ccm + (aspectAngle(m,t)<40*DEG ? 0.25 : 0);  // a hot tailpipe competes with the flare
            if (Math.random() < dt*2.6*(1-clamp(rejection,0,0.9))){ m.decoy=f; m.target=null; t=null; break; }
          }
        }
      }
      const guideOn = !m.lost && (t || m.decoy);
      const gt = m.decoy && (m.decoy.life>0) ? m.decoy : t;
      if (guideOn && gt && m.t>0.18){
        const tv = gt.speed!==undefined ? {x:Math.sin(gt.hd)*gt.speed, y:-Math.cos(gt.hd)*gt.speed} : {x:gt.vx||0,y:gt.vy||0};
        const d=Math.hypot(gt.x-m.x, gt.y-m.y); const tof=d/Math.max(250,m.speed);
        const lx=gt.x+tv.x*tof*0.9, ly=gt.y+tv.y*tof*0.9;
        const evasion = gt.omega!==undefined ? Math.min(1, Math.abs(gt.omega)/(2.2)) : 0;
        const noise = (Math.random()-0.5)*(0.02 + evasion*0.08) * (md.guidance==='ir'?1.2:0.8);
        const want=Math.atan2(lx-m.x,-(ly-m.y))+noise; const diff=norm(want-m.hd);
        const turnRate = md.turn*DEG*spdFrac*(m.t<md.boost?1:0.8);       // less authority once the motor burns out
        const applied = clamp(diff, -turnRate*dt, turnRate*dt);
        m.hd=norm(m.hd+applied);
        m.speed -= Math.abs(applied)/dt * 26 * dt;                        // hard turns bleed energy
        const da=(gt.alt||0)-m.alt; m.alt += clamp(da*2.2, -md.turn*10, md.turn*10)*dt;
        if (Math.abs(diff) > md.fov*DEG) m.lost=true;
      } else { m.alt -= 90*dt; }                                          // gone ballistic: it falls away
      if (m.decoy && m.decoy.life<=0) m.decoy=null;

      const step=m.speed*dt; m.x+=Math.sin(m.hd)*step; m.y-=Math.cos(m.hd)*step; m.travelled+=step;
      m.trailT-=dt;
      if (m.trailT<=0 && onScreen(m,300)){
        m.trailT=0.022; const burning=m.t<md.boost;
        addPart({x:m.x-Math.sin(m.hd)*12,y:m.y+Math.cos(m.hd)*12,alt:m.alt,vx:rnd(-8,8),vy:rnd(-8,8),life:burning?1.4:0.7,r:3,grow:burning?11:6,col:[228,228,230],a:burning?0.6:0.32,type:'smoke'});
        if (burning && settings.quality>0) addPart({x:m.x-Math.sin(m.hd)*12,y:m.y+Math.cos(m.hd)*12,alt:m.alt,vx:0,vy:0,life:0.08,r:5,grow:0,col:[255,200,90],a:0.9,type:'fire'});
      }

      const armed = m.travelled > md.minRange*0.6;
      let dead = m.life<=0 || m.alt<=0 || m.x<0||m.y<0||m.x>S.size||m.y>S.size;
      if (!dead && armed){
        const fuse = md.fuse||20;
        // proximity fuse on closest point of approach: it fires as the miss distance starts opening again
        let near=null, nd=1e9;
        for (const p of S.planes){ if (!p.alive||p.team===m.team) continue; const d=dist3(p,m); if (d<nd){ nd=d; near=p; } }
        if (near && nd < fuse*3.2){
          const opening = m.lastNear!==undefined && nd > m.lastNear;
          if (nd < fuse*0.55 || opening){
            const miss = Math.min(nd, m.lastNear===undefined?nd:m.lastNear);
            if (miss < fuse*2.4){
              const eff = clamp(1 - miss/(fuse*2.4), 0, 1);        // full warhead at contact, fragments at the edge
              const dmgOut = md.dmg*(0.25+0.75*eff*eff);
              damagePlane(near, dmgOut, m.owner, 'missile');
              for (const o of S.planes){ if (o!==near&&o.alive&&o.team!==m.team&&dist3(o,m)<fuse*2.5) damagePlane(o,md.dmg*0.25,m.owner,'missile'); }
              if (m.owner&&m.owner.isPlayer&&near.alive&&eff<0.45) toast('Near miss — fragment damage only');
            } else if (m.owner&&m.owner.isPlayer) toast('Missile missed');
            explosionFx(m.x,m.y,m.alt,0.55,false); Audio2.explosion((m.x-S.cam.x)/900, dist(m,S.player), 0.6);
            dead=true;
          }
        }
        m.lastNear = near ? nd : undefined;
        if (!dead && m.decoy && Math.hypot(m.decoy.x-m.x,m.decoy.y-m.y)<24){ explosionFx(m.x,m.y,m.alt,0.4,false); if (m.owner&&m.owner.isPlayer) toast('Decoyed by flares'); dead=true; }
      }
      if (dead){ if (m.life<=0||m.alt<=0) explosionFx(m.x,m.y,Math.max(0,m.alt),0.3,m.alt<=0); M[i]=M[M.length-1]; M.pop(); }
    }
  }
  function updateBombs(dt){ const B=S.bombs; for (let i=B.length-1;i>=0;i--){ const b=B[i]; b.x+=b.vx*dt; b.y+=b.vy*dt; b.vx*=Math.pow(0.55,dt); b.vy*=Math.pow(0.55,dt); b.vz-=GRAV*dt; b.alt+=b.vz*dt;
    if (b.alt<=0){ explosionFx(b.x,b.y,0,1.0,true); Audio2.explosion((b.x-S.cam.x)/900, dist(b,S.player), 1.1); S.decals.push({x:b.x,y:b.y,r:b.r*0.55,life:40});
      for (const g of S.ground){ if (!g.alive) continue; const d=g.kind==='base'?(inBase(g,b.x,b.y)?0:Math.hypot(g.x-b.x,g.y-b.y)-80):Math.hypot(g.x-b.x,g.y-b.y); if (d<b.r) damageGround(g, b.dmg*(1-Math.max(0,d)/b.r*0.6)*(g.team===b.team?0.3:1), b.owner); }
      for (const p of S.planes){ if (!p.alive||p===b.owner||p.alt>120) continue; if (dist(p,b)<b.r*0.6) damagePlane(p,b.dmg*0.25,b.owner,'bomb'); }
      B[i]=B[B.length-1]; B.pop(); } } }
  function updateFlares(dt){ const F=S.flares; for (let i=F.length-1;i>=0;i--){ const f=F[i]; f.t+=dt; f.life-=dt; f.x+=f.vx*dt; f.y+=f.vy*dt; f.vx*=Math.pow(0.2,dt); f.vy*=Math.pow(0.2,dt); f.alt=Math.max(0,f.alt-90*dt); if (settings.quality>0&&Math.random()<dt*30) addPart({x:f.x,y:f.y,alt:f.alt,vx:rnd(-6,6),vy:rnd(-6,6),life:0.9,r:3,grow:6,col:[220,220,220],a:0.5,type:'smoke'}); if (f.life<=0){ F[i]=F[F.length-1]; F.pop(); } } }
  function updateGround(dt){
    for (const g of S.ground){ if (!g.alive) continue; g.cd-=dt;
      if (g.kind==='tank'){ if (g.cd<=0){ g.cd=rnd(2,6); g.want=g.hd+rnd(-1.2,1.2); } if (g.want!==undefined) g.hd+=clamp(norm(g.want-g.hd),-0.6*dt,0.6*dt); const nx=g.x+Math.sin(g.hd)*14*dt, ny=g.y-Math.cos(g.hd)*14*dt; if (S.world.isLand(nx,ny)&&nx>100&&ny>100&&nx<S.size-100&&ny<S.size-100){ g.x=nx; g.y=ny; } else { g.want=g.hd+Math.PI; g.cd=2; } }
      else if (g.kind==='aa'){ const e=nearestEnemyPlaneTo(g, 760); if (e && !e.onGround){ const tt=dist3(g,e)/900; const lx=e.x+Math.sin(e.hd)*e.speed*tt, ly=e.y-Math.cos(e.hd)*e.speed*tt; g.hd=Math.atan2(lx-g.x,-(ly-g.y)); if (g.cd<=0){ g.cd=1.15; S.fx.push({type:'flak',x:lx+rnd(-70,70),y:ly+rnd(-70,70),alt:Math.max(30,e.alt+e.vz*tt+rnd(-60,60)),t:0,delay:tt*0.9,r:24,team:g.team,owner:g}); } } }
      else if (g.kind==='base' && g.hp<g.maxhp*0.5 && Math.random()<dt*6) addPart({x:g.x+rnd(-100,100),y:g.y+rnd(-50,50),alt:0,vx:rnd(-6,6),vy:rnd(-6,6),life:2.5,r:8,grow:18,col:[50,50,50],a:0.5,type:'smoke'});
    }
  }
  function nearestEnemyPlaneTo(g, range){ let b=null,bd=range; for (const e of S.planes){ if (e.team===g.team||!e.alive) continue; const d=dist3(g,e); if (d<bd){bd=d;b=e;} } return b; }

  // ---------------- damage model
  function damagePlane(p, dmg, attacker, kind){
    if (!p.alive) return; if (p.spawnProt>0) dmg*=0.15; if (p.landed){ dmg*=0.3; if (p.isPlayer && Math.random()<0.25) toast('UNDER ATTACK on the ground!'); } if (S.mode==='test'&&p.isPlayer) dmg*=0.3;
    p.hp-=dmg; if (attacker){ p.dmgBy.set(attacker,(p.dmgBy.get(attacker)||0)+dmg); p.lastHitBy=attacker; p.lastHitT=S.t; if (attacker.isPlayer) S.score.damage+=dmg; }
    const k = dmg/p.maxhp; const roll=Math.random(); let note=null;
    const mult = kind==='gun'?1: kind==='flak'?2.5:6;
    if (roll < 0.004*mult && kind==='gun'){ note='PILOT KILLED'; p.hp=0; }
    else if (roll < 0.05*mult*(1+k*6)){ p.dmg.engine=Math.min(1,p.dmg.engine+0.35); note='ENGINE DAMAGED'; }
    else if (roll < 0.10*mult*(1+k*6)){ if (p.dmg.leak){ if (Math.random()<0.5){ p.dmg.fire=Math.max(p.dmg.fire,8); note='FIRE!'; } } else { p.dmg.leak=true; note='FUEL LEAK'; } }
    else if (roll < 0.14*mult*(1+k*6)){ p.dmg.controls=Math.min(1,p.dmg.controls+0.4); note='CONTROLS DAMAGED'; }
    else if (kind!=='gun' && roll < 0.4){ p.dmg.fire=Math.max(p.dmg.fire,6); note='FIRE!'; }
    if (note && p.isPlayer) toast(note);
    if (p.isPlayer){ S.cam.shake=Math.min(14,S.cam.shake+dmg*0.4); Audio2.hit((p.x-S.cam.x)/900,0,dmg>12); p.hitFlash=0.25; }
    else if (attacker&&attacker.isPlayer){ Audio2.hit((p.x-S.cam.x)/900, dist(p,S.player)*0.5, dmg>12); S.hitMarker=0.12; }
    if (p.hp<=0) killPlane(p, attacker, note==='PILOT KILLED'?'pilot':kind);
  }
  function killPlane(p, attacker, kind, groundHit){
    p.alive=false; p.hp=0; p.locked=false; p.target=null; p.landed=false; p.takeoff=false;
    p.wreck = groundHit ? null : {t:0,vz:Math.min(p.vz,-60),spin:rnd(-3,3),st:0};
    if (!groundHit){ explosionFx(p.x,p.y,p.alt,0.9+p.def.size/120,false); Audio2.explosion((p.x-S.cam.x)/900, p.isPlayer?0:dist(p,S.player), 1+p.def.size/150); }
    for (const m of S.missiles) if (m.target===p) m.target=null;
    const rankMul = 1+0.35*(S.playerDef.rank-1);
    S.tickets[p.team]-= S.mode==='ground'?4:5;
    const who = attacker?attacker.name:(kind==='crash'?'the ground':kind==='fire'?'fire':'flak');
    if (attacker && attacker.kills!==undefined) attacker.kills++;
    if (attacker && attacker.isPlayer){ S.score.kills++; const sl=Math.round(420*rankMul*(p.def.role==='Bomber'?1.3:1)), rp=Math.round(70*rankMul); reward(sl,rp,'Shot down '+p.name+' ('+p.def.name+')'); Audio2.kill(); S.killFlash={t:0,text:kind==='pilot'?'PILOT KILLED':'TARGET DESTROYED',sub:p.name+' · '+p.def.name}; }
    for (const [a,d] of p.dmgBy){ if (a!==attacker && a.isPlayer && d>=p.maxhp*0.15){ S.score.assists++; reward(Math.round(150*rankMul),Math.round(25*rankMul),'Assist on '+p.name); } }
    const verb = kind==='crash'?'crashed':kind==='fire'?'burned':kind==='missile'?'⟿':kind==='bomb'?'💣':'✕';
    feed(kind==='crash'||kind==='fire' ? `${p.name} (${p.def.name}) ${verb}` : `${who} ${verb} ${p.name} (${p.def.name})`, p.team===0?'#ff7070':'#7fb8ff');
    if (p.isPlayer){ S.score.deaths++; S.respawnT=4; S.killedBy=who; Audio2.died(); Audio2.engineStop(); S.cam.shake=20; }
    else { p.respawnAt = S.t + rnd(10,16); scheduleRespawn(p); }
  }
  function scheduleRespawn(p){ const check=()=>{ if (!S||S.state==='ended'||p.alive||!S.planes.includes(p)) return; if (S.t>=p.respawnAt){ if (S.tickets[p.team]>15 && !p.wreck && S.bases[p.team].alive){ spawnAt(p,false); return; } if (S.tickets[p.team]<=15 || !S.bases[p.team].alive) return; } setTimeout(check,500); }; setTimeout(check,500); }
  function damageGround(g, dmg, attacker){
    if (!g.alive) return; g.hp-=dmg; if (attacker&&attacker.isPlayer) S.score.damage+=dmg*0.5;
    if (g.hp<=0){ g.alive=false; g.hp=0; const big=g.kind==='base'; explosionFx(g.x,g.y,0,big?2.2:1.1,true); Audio2.explosion((g.x-S.cam.x)/900, dist(g,S.player), big?2.2:1.1); S.decals.push({x:g.x,y:g.y,r:big?140:30,life:1e9});
      if (big) for (let i=0;i<6;i++) setTimeout(()=>{ if(S) explosionFx(g.x+rnd(-120,120),g.y+rnd(-70,70),0,1.2,true); },i*220);
      const rankMul = 1+0.35*(S.playerDef.rank-1);
      S.tickets[g.team]-= big?(S.mode==='ground'?40:15):(S.mode==='ground'?3:1);
      if (attacker&&attacker.isPlayer){ if (big){ S.score.bases++; reward(Math.round(800*rankMul),Math.round(120*rankMul),'Destroyed enemy airfield'); S.killFlash={t:0,text:'AIRFIELD DESTROYED',sub:'the enemy can no longer respawn or rearm'}; } else { S.score.ground++; reward(Math.round(120*rankMul),Math.round(20*rankMul),'Destroyed '+(g.kind==='tank'?'tank':'AA gun')); } }
      feed(`${attacker?attacker.name:'?'} destroyed ${g.team===0?'friendly':'enemy'} ${g.kind==='base'?'airfield':g.kind==='tank'?'tank':'AA gun'}`, g.team===0?'#ff7070':'#7fb8ff');
    }
  }
  function reward(sl,rp,text){ if (S.mode==='test') return; S.score.sl+=sl; S.score.rp+=rp; S.score.events.push({text,sl,rp}); toast(`+${sl} SL  +${rp} RP · ${text}`); }
  function feed(text,col){ S.feed.unshift({text,col:col||'#e8e4d8',t:0}); if (S.feed.length>6) S.feed.pop(); }

  // ---------------- particles & fx
  function addPart(p){ if (S.parts.length>2200) return; if (p.alt===undefined) p.alt=0; S.parts.push(p); }
  function updateParticles(dt){ const P=S.parts; for (let i=P.length-1;i>=0;i--){ const p=P[i]; p.life-=dt; p.x+=p.vx*dt; p.y+=p.vy*dt; p.r+=p.grow*dt; if (p.type==='debris'){ p.vx*=Math.pow(0.3,dt); p.vy*=Math.pow(0.3,dt); p.alt=Math.max(0,p.alt-250*dt); if (Math.random()<dt*20) addPart({x:p.x,y:p.y,alt:p.alt,vx:0,vy:0,life:0.8,r:3,grow:6,col:[60,60,60],a:0.5,type:'smoke'}); } if (p.life<=0){ P[i]=P[P.length-1]; P.pop(); } }
    const F=S.fx; for (let i=F.length-1;i>=0;i--){ const f=F[i]; f.t+=dt;
      if (f.type==='flak'){ if (f.delay>0){ f.delay-=dt; if (f.delay<=0){ for (const p of S.planes){ if (p.alive&&p.team!==f.team&&Math.hypot(p.x-f.x,p.y-f.y)<f.r+p.def.size*0.35 && Math.abs(p.alt-f.alt)<90) damagePlane(p,rnd(8,16),null,'flak'); } Audio2.hit((f.x-S.cam.x)/900, dist(f,S.player)*0.6, true); f.t=0; } continue; } if (f.t>1.4){ F[i]=F[F.length-1]; F.pop(); } }
      else if (f.t>f.dur){ F[i]=F[F.length-1]; F.pop(); } }
    for (let i=S.decals.length-1;i>=0;i--){ S.decals[i].life-=dt; if (S.decals[i].life<=0) S.decals.splice(i,1); }
    for (const p of S.planes) if (p.hitFlash>0) p.hitFlash-=dt;
    if (S.hitMarker>0) S.hitMarker-=dt; if (S.killFlash){ S.killFlash.t+=dt; if (S.killFlash.t>2.2) S.killFlash=null; }
    for (const f of S.feed) f.t+=dt;
    for (let i=hudMsgs.length-1;i>=0;i--){ hudMsgs[i].life-=dt; if (hudMsgs[i].life<=0) hudMsgs.splice(i,1); }
  }
  function explosionFx(x,y,alt,size,ground){
    S.fx.push({type:'boom',x,y,alt,t:0,dur:0.9*size,size,ground});
    const q=settings.quality; const n=Math.round((q===2?26:q===1?14:6)*size);
    for (let i=0;i<n;i++){ const a=rnd(0,TAU), s=rnd(20,160)*size; addPart({x:x+rnd(-4,4)*size,y:y+rnd(-4,4)*size,alt,vx:Math.cos(a)*s,vy:Math.sin(a)*s,life:rnd(0.3,0.7)*size,r:rnd(5,12)*size,grow:-8,col:[255,rnd(90,180),30],a:0.95,type:'fire'}); }
    for (let i=0;i<n*0.8;i++){ const a=rnd(0,TAU), s=rnd(10,70)*size; addPart({x,y,alt,vx:Math.cos(a)*s,vy:Math.sin(a)*s,life:rnd(1.2,2.6)*size,r:rnd(8,16)*size,grow:14,col:[40,38,36],a:0.55,type:'smoke'}); }
    if (q>0 && !ground) for (let i=0;i<Math.round(5*size);i++){ const a=rnd(0,TAU), s=rnd(120,320); addPart({x,y,alt,vx:Math.cos(a)*s,vy:Math.sin(a)*s,life:rnd(0.8,1.6),r:rnd(2,4),grow:0,col:[70,60,50],a:1,type:'debris',rot:rnd(0,TAU),spin:rnd(-10,10)}); }
  }
  function hitFx(x,y,alt,big){ for (let i=0;i<(big?6:3);i++){ const a=rnd(0,TAU), s=rnd(40,140); addPart({x,y,alt,vx:Math.cos(a)*s,vy:Math.sin(a)*s,life:rnd(0.12,0.3),r:rnd(1.5,3),grow:0,col:[255,220,120],a:1,type:'spark'}); } if (big) addPart({x,y,alt,vx:0,vy:0,life:0.5,r:5,grow:10,col:[80,80,80],a:0.5,type:'smoke'}); }

  // ------------------------------------------------------------ end of battle
  function endBattle(){
    if (S.ended) return; S.ended=true; S.state='ended';
    const win = S.tickets[1]<=0 || (S.time<=0 && S.tickets[0]>S.tickets[1]); const draw = S.time<=0 && S.tickets[0]===S.tickets[1];
    Audio2.engineStop(); Audio2.warning(false); Audio2.music('menu'); Audio2.duck(false);
    const sc=S.score; const rankMul = 1+0.35*(S.playerDef.rank-1);
    const total0 = S.mode==='air'?12*60:14*60;
    const base = {sl:Math.round(200*rankMul), rp:Math.round(40*rankMul)};
    const winB = win?{sl:Math.round(500*rankMul), rp:Math.round(90*rankMul)}:{sl:0,rp:0};
    const played = Math.min(600, total0-Math.max(0,S.time));
    const timeB = {sl:Math.round(played*0.6*rankMul), rp:Math.round(played*0.1*rankMul)};
    const total = {sl: Math.round((sc.sl+base.sl+timeB.sl)*(win?1.35:1)+winB.sl), rp: Math.round((sc.rp+base.rp+timeB.rp)*(win?1.35:1)+winB.rp)};
    const result={ win, draw, kills:sc.kills, assists:sc.assists, ground:sc.ground, bases:sc.bases, deaths:sc.deaths, damage:Math.round(sc.damage), events:sc.events, base, winB, timeB, total, mode:S.mode, tickets:S.tickets.slice(), duration:total0-Math.max(0,S.time) };
    setTimeout(()=>{ onEnd&&onEnd(result); }, 900);
  }
  function quit(){ if (!S) return; S=null; Audio2.engineStop(); Audio2.warning(false); Audio2.duck(false); }
  function pause(){ if (S&&S.state==='battle'){ S.state='paused'; Audio2.engineUpdate(0,0,false); Audio2.warning(false); } }
  function resume(){ if (S&&S.state==='paused'){ S.state='battle'; lastT=performance.now(); acc=0; } }

  // ------------------------------------------------------------ projection: farther below the camera = smaller
  function scaleFor(alt){ return clamp(HC/(HC + (S.cam.alt - (alt||0))), 0.3, 1.9); }
  function layer(alt){ const s=scaleFor(alt)*S.cam.zoom; ctx.setTransform(dpr*s,0,0,dpr*s, dpr*(W/2-S.cam.x*s+shx), dpr*(H/2-S.cam.y*s+shy)); return s; }
  function w2s(x,y,alt){ const s=scaleFor(alt)*S.cam.zoom; return {x:W/2+(x-S.cam.x)*s+shx, y:H/2+(y-S.cam.y)*s+shy, s}; }

  // ------------------------------------------------------------ rendering
  function render(dtReal){
    ctx.setTransform(dpr,0,0,dpr,0,0);
    if (!S){ renderBackdrop(dtReal); return; }
    const cam=S.cam; shx=(Math.random()-0.5)*cam.shake; shy=(Math.random()-0.5)*cam.shake;
    const s0=layer(0);
    S.world.draw(ctx, {x:cam.x,y:cam.y,zoom:s0}, W, H);
    drawCloudShadows();
    for (const d of S.decals){ ctx.fillStyle=`rgba(20,16,12,${Math.min(0.55,d.life/10)})`; ctx.beginPath(); ctx.arc(d.x,d.y,d.r,0,TAU); ctx.fill(); }
    for (const g of S.ground) drawGround(ctx,g);
    for (const p of S.planes){ if (!p.sprite||(!p.alive&&!p.wreck)) continue; const sp=p.sprite; const k=1-clamp(p.alt/ALT_MAX,0,1)*0.45; ctx.save(); ctx.translate(p.x+p.alt*0.09+8, p.y+p.alt*0.11+10); ctx.rotate(p.hd); ctx.globalAlpha=0.38*k; ctx.drawImage(sp.shadow,-sp.shadow.width/sp.res/2*k,-sp.shadow.height/sp.res/2*k,sp.shadow.width/sp.res*k,sp.shadow.height/sp.res*k); ctx.restore(); }
    const below = o=>o.alt<CLOUD_ALT;
    const sortedPlanes = S.planes.filter(p=>p.sprite&&(p.alive||p.wreck)).sort((a,b)=>a.alt-b.alt);
    const pass = (filt)=>{
      drawParticles('low', filt);
      for (const b of S.bombs) if (filt(b)){ layer(b.alt); ctx.save(); ctx.translate(b.x,b.y); ctx.rotate(b.hd); ctx.fillStyle='#2a2d30'; ctx.beginPath(); ctx.ellipse(0,0,3,9,0,0,TAU); ctx.fill(); ctx.fillStyle='#8a8f94'; ctx.fillRect(-3,5,6,2); ctx.restore(); }
      for (const f of S.flares) if (filt(f)){ layer(f.alt); const a=Math.max(0,f.life/2.6); ctx.save(); ctx.globalCompositeOperation='lighter'; const g=ctx.createRadialGradient(f.x,f.y,0,f.x,f.y,14); g.addColorStop(0,`rgba(255,255,220,${a})`); g.addColorStop(0.3,`rgba(255,200,90,${a*0.8})`); g.addColorStop(1,'rgba(255,120,30,0)'); ctx.fillStyle=g; ctx.beginPath(); ctx.arc(f.x,f.y,14,0,TAU); ctx.fill(); ctx.restore(); }
      for (const p of sortedPlanes) if (filt(p)) drawPlane(p);
      drawBullets(filt);
      for (const m of S.missiles) if (filt(m)) drawMissile(m);
      drawParticles('high', filt);
      for (const f of S.fx) if (filt(f)) drawFx(f);
    };
    pass(below);
    drawClouds();
    pass(o=>!below(o));
    ctx.setTransform(dpr,0,0,dpr,0,0);
    drawHUD(dtReal);
  }
  function drawCloudShadows(){ const c=S.cam; const s=scaleFor(0)*c.zoom; const vw=W/s/2+300, vh=H/s/2+300;
    for (const cl of S.world.clouds){ const wx=((cl.x+S.t*cl.vx)%S.size+S.size)%S.size, wy=((cl.y+S.t*cl.vy)%S.size+S.size)%S.size; const px=wx+CLOUD_ALT*0.09, py=wy+CLOUD_ALT*0.11; if (Math.abs(px-c.x)>vw||Math.abs(py-c.y)>vh) continue;
      ctx.save(); ctx.translate(px,py); ctx.fillStyle='rgba(0,0,0,0.16)'; ctx.beginPath(); for (const [ox,oy,r] of cl.parts){ ctx.moveTo(ox+r*0.9,oy); ctx.arc(ox,oy,r*0.9,0,TAU); } ctx.fill(); ctx.restore(); } }
  function drawClouds(){ const c=S.cam; const near=clamp(1-(CLOUD_ALT-c.alt)/1500,0.1,1); const s=layer(CLOUD_ALT); const vw=W/s/2+300, vh=H/s/2+300; const q=settings.quality;
    for (const cl of S.world.clouds){ const wx=((cl.x+S.t*cl.vx)%S.size+S.size)%S.size, wy=((cl.y+S.t*cl.vy)%S.size+S.size)%S.size; if (Math.abs(wx-c.x)>vw||Math.abs(wy-c.y)>vh) continue;
      ctx.save(); ctx.translate(wx,wy);
      for (const [ox,oy,r] of cl.parts){ if (q>0){ const g=ctx.createRadialGradient(ox-r*0.25,oy-r*0.3,r*0.05,ox,oy,r); g.addColorStop(0,`rgba(255,255,255,${cl.a*0.75*near})`); g.addColorStop(0.55,`rgba(246,249,253,${cl.a*0.45*near})`); g.addColorStop(1,'rgba(236,242,250,0)'); ctx.fillStyle=g; ctx.beginPath(); ctx.arc(ox,oy,r,0,TAU); ctx.fill(); } else { ctx.fillStyle=`rgba(255,255,255,${cl.a*0.7*near})`; ctx.beginPath(); ctx.arc(ox,oy,r*0.8,0,TAU); ctx.fill(); } }
      ctx.restore(); } }
  function drawParticles(which, filt){
    ctx.setTransform(dpr,0,0,dpr,0,0); const c=S.cam;
    for (const p of S.parts){ const isLow = p.type==='smoke'||p.type==='vortex'; if ((which==='low')!==isLow) continue; if (!filt(p)) continue;
      const s=scaleFor(p.alt)*c.zoom; const sx=W/2+(p.x-c.x)*s+shx, sy=H/2+(p.y-c.y)*s+shy; if (sx<-80||sy<-80||sx>W+80||sy>H+80) continue;
      const a=p.a*(p.type==='smoke'?Math.min(1,p.life*1.2):p.type==='vortex'?p.life*2:1); const r=Math.max(0.5,p.r)*s;
      if (p.type==='fire'||p.type==='flash'||p.type==='spark'){ ctx.globalCompositeOperation='lighter'; ctx.fillStyle=`rgba(${p.col[0]},${p.col[1]},${p.col[2]},${clamp(a,0,1)})`; ctx.beginPath(); ctx.arc(sx,sy,r,0,TAU); ctx.fill(); ctx.globalCompositeOperation='source-over'; }
      else if (p.type==='debris'){ ctx.save(); ctx.translate(sx,sy); ctx.rotate(p.rot+= (p.spin||0)*0.016); ctx.fillStyle='#3a342e'; ctx.fillRect(-r,-r*0.5,r*2,r); ctx.restore(); }
      else if (p.type==='vortex'){ const sx2=W/2+(p.x2-c.x)*s+shx, sy2=H/2+(p.y2-c.y)*s+shy; ctx.strokeStyle=`rgba(255,255,255,${clamp(a,0,1)})`; ctx.lineWidth=p.r*s; ctx.beginPath(); ctx.moveTo(sx2,sy2); ctx.lineTo(sx,sy); ctx.stroke(); }
      else { ctx.fillStyle=`rgba(${p.col[0]},${p.col[1]},${p.col[2]},${clamp(a,0,1)})`; ctx.beginPath(); ctx.arc(sx,sy,r,0,TAU); ctx.fill(); } }
  }
  function drawBullets(filt){ ctx.setTransform(dpr,0,0,dpr,0,0); const c=S.cam; ctx.lineCap='round'; ctx.globalAlpha=0.9;
    for (const b of S.bullets){ if (!filt(b)) continue; const s=scaleFor(b.alt)*c.zoom; const x1=W/2+(b.x-c.x)*s+shx, y1=H/2+(b.y-c.y)*s+shy, x2=W/2+(b.px-c.x)*s+shx, y2=H/2+(b.py-c.y)*s+shy; if (x1<-40||y1<-40||x1>W+40||y1>H+40) continue; ctx.strokeStyle=b.col; ctx.lineWidth=b.size*s; ctx.beginPath(); ctx.moveTo(x2,y2); ctx.lineTo(x1,y1); ctx.stroke(); }
    ctx.globalAlpha=1; }
  function drawMissile(m){ layer(m.alt); ctx.save(); ctx.translate(m.x,m.y); ctx.rotate(m.hd); if (m.spr){ ctx.drawImage(m.spr.cv,-m.spr.w/2,-m.spr.h/2,m.spr.w,m.spr.h); } else { ctx.fillStyle='#ddd'; ctx.fillRect(-2,-12,4,24); } ctx.restore(); }
  function drawFx(f){
    layer(f.alt||0);
    if (f.type==='boom'){ const k=f.t/f.dur; const r=(20+140*k)*f.size; ctx.save(); ctx.globalCompositeOperation='lighter'; ctx.strokeStyle=`rgba(255,220,160,${(1-k)*0.8})`; ctx.lineWidth=6*(1-k)+1; ctx.beginPath(); ctx.arc(f.x,f.y,r,0,TAU); ctx.stroke(); if (k<0.35){ const g=ctx.createRadialGradient(f.x,f.y,0,f.x,f.y,60*f.size); g.addColorStop(0,`rgba(255,255,230,${(1-k/0.35)})`); g.addColorStop(0.4,`rgba(255,160,60,${(1-k/0.35)*0.8})`); g.addColorStop(1,'rgba(255,80,20,0)'); ctx.fillStyle=g; ctx.beginPath(); ctx.arc(f.x,f.y,60*f.size,0,TAU); ctx.fill(); } ctx.restore(); }
    else if (f.type==='flak'){ if (f.delay>0) return; const k=f.t/1.4; ctx.fillStyle=`rgba(30,28,26,${(1-k)*0.7})`; ctx.beginPath(); ctx.arc(f.x,f.y,10+30*k,0,TAU); ctx.fill(); if (k<0.15){ ctx.globalCompositeOperation='lighter'; ctx.fillStyle=`rgba(255,200,120,${1-k/0.15})`; ctx.beginPath(); ctx.arc(f.x,f.y,14,0,TAU); ctx.fill(); ctx.globalCompositeOperation='source-over'; } }
  }
  function drawGround(ctx,g){
    ctx.save(); ctx.translate(g.x,g.y);
    if (g.kind==='base'){ ctx.rotate(g.hd); const dead=!g.alive;
      ctx.fillStyle='rgba(0,0,0,0.25)'; ctx.fillRect(-g.w/2+6,-g.h/2+8,g.w,g.h);
      ctx.fillStyle=dead?'#4a4640':'#6a6f66'; ctx.fillRect(-g.w/2,-g.h/2,g.w,g.h);
      ctx.fillStyle=dead?'#2a2826':'#3a3d40'; ctx.fillRect(-g.w/2+10,-24,g.w-20,48);
      if (!dead){ ctx.strokeStyle='rgba(255,255,255,0.7)'; ctx.setLineDash([16,14]); ctx.lineWidth=2; ctx.beginPath(); ctx.moveTo(-g.w/2+24,0); ctx.lineTo(g.w/2-24,0); ctx.stroke(); ctx.setLineDash([]); ctx.fillStyle='#fff'; for (let i=0;i<6;i++){ ctx.fillRect(-g.w/2+14+i*6,-20,3,9); ctx.fillRect(g.w/2-20-i*6,11,3,9); } }
      for (let i=-1;i<=1;i++){ const hx=i*70, hy=-g.h/2+30; ctx.fillStyle='rgba(0,0,0,0.3)'; ctx.fillRect(hx-22+4,hy-14+5,44,28); ctx.fillStyle=dead?'#3a3632':(g.team===0?'#5a6c86':'#86645a'); ctx.fillRect(hx-22,hy-14,44,28); ctx.fillStyle='rgba(255,255,255,0.25)'; ctx.fillRect(hx-22,hy-14,44,6); }
      ctx.fillStyle=dead?'#333':'#c9c2b0'; ctx.fillRect(g.w/2-40,g.h/2-40,18,18); ctx.fillStyle=dead?'#333':'#9aa3ad'; for (let i=0;i<3;i++){ ctx.beginPath(); ctx.arc(-g.w/2+30+i*20,g.h/2-30,7,0,TAU); ctx.fill(); }
      ctx.fillStyle=g.team===0?'#4fa3ff':'#ff4d4d'; ctx.fillRect(-g.w/2+8,-g.h/2+8,20,12);
      if (dead){ ctx.fillStyle='rgba(0,0,0,0.5)'; for (let i=0;i<8;i++){ ctx.beginPath(); ctx.arc((i*67%g.w)-g.w/2,(i*41%g.h)-g.h/2,18,0,TAU); ctx.fill(); } }
    } else if (g.kind==='tank'){ ctx.rotate(g.hd); const dead=!g.alive; ctx.fillStyle='rgba(0,0,0,0.3)'; ctx.fillRect(-11+4,-17+5,22,34);
      ctx.fillStyle=dead?'#2b2724':'#3c3a30'; ctx.fillRect(-13,-17,5,34); ctx.fillRect(8,-17,5,34); ctx.fillStyle=dead?'#3a3632':(g.team===0?'#5b6f5a':'#6f5f4a'); ctx.fillRect(-9,-15,18,30); ctx.fillStyle=dead?'#2a2624':(g.team===0?'#4b5e4a':'#5f4f3c'); ctx.beginPath(); ctx.arc(0,-2,7,0,TAU); ctx.fill(); ctx.fillStyle=dead?'#222':'#2f2d28'; ctx.fillRect(-1.5,-22,3,20); if (!dead){ ctx.fillStyle=g.team===0?'#4fa3ff':'#ff4d4d'; ctx.fillRect(-4,8,8,3); } else { ctx.fillStyle='rgba(0,0,0,.6)'; ctx.beginPath(); ctx.arc(0,0,14,0,TAU); ctx.fill(); }
    } else if (g.kind==='aa'){ const dead=!g.alive; ctx.fillStyle='rgba(0,0,0,0.25)'; ctx.beginPath(); ctx.arc(3,4,15,0,TAU); ctx.fill(); ctx.fillStyle=dead?'#3a3632':'#b9a878'; ctx.beginPath(); ctx.arc(0,0,15,0,TAU); ctx.fill(); ctx.fillStyle=dead?'#222':'#6f6a58'; ctx.beginPath(); ctx.arc(0,0,10,0,TAU); ctx.fill(); ctx.rotate(g.hd); ctx.fillStyle=dead?'#222':'#2f2d28'; for (const o of [-4,-1.5,1.5,4]) ctx.fillRect(o-0.8,-18,1.6,16); if (!dead){ ctx.rotate(-g.hd); ctx.fillStyle=g.team===0?'#4fa3ff':'#ff4d4d'; ctx.fillRect(-3,10,6,3); } }
    ctx.restore();
  }
  function drawPlane(p){
    const sp=p.sprite; const def=p.def;
    layer(p.alt);
    ctx.save(); ctx.translate(p.x,p.y); ctx.rotate(p.hd);
    if (p.alive && def.jet && p.throttle>0.5 && p.fuel>0){ const L=def.size; const ab=def.ab&&p.throttle>0.92; ctx.save(); ctx.globalCompositeOperation='lighter'; const len=(ab?38:16)*(0.8+Math.random()*0.4); const g=ctx.createLinearGradient(0,L*0.44,0,L*0.44+len); g.addColorStop(0,ab?'rgba(190,220,255,0.95)':'rgba(255,200,120,0.5)'); g.addColorStop(0.4,ab?'rgba(255,170,70,0.8)':'rgba(255,150,60,0.25)'); g.addColorStop(1,'rgba(255,90,30,0)'); ctx.fillStyle=g; ctx.beginPath(); ctx.moveTo(-5,L*0.44); ctx.lineTo(5,L*0.44); ctx.lineTo(0,L*0.44+len); ctx.closePath(); ctx.fill(); ctx.restore(); }
    ctx.drawImage(sp.cv,-sp.w/2,-sp.h/2,sp.w,sp.h);
    if (p.hitFlash>0 && sp.flash){ ctx.globalAlpha=Math.min(1,p.hitFlash*2.5); ctx.drawImage(sp.flash,-sp.w/2,-sp.h/2,sp.w,sp.h); ctx.globalAlpha=1; }
    if (p.spawnProt>0 && p.alive && !p.onGround){ ctx.globalAlpha=0.35+0.25*Math.sin(S.t*20); ctx.strokeStyle='#8fd3ff'; ctx.lineWidth=2; ctx.beginPath(); ctx.ellipse(0,0,sp.w/2+6,sp.h/2+6,0,0,TAU); ctx.stroke(); ctx.globalAlpha=1; }
    if (!def.jet && p.alive && (p.fuel>0||p.speed>50)){ const L=def.size; const r=L*0.15; const engines = def.role==='Bomber'||def.role==='Heavy Fighter' ? (def.size>125?[[-sp.w*0.34,-L*0.1],[-sp.w*0.16,-L*0.04],[sp.w*0.16,-L*0.04],[sp.w*0.34,-L*0.1]]:[[-sp.w*0.22,-L*0.1],[sp.w*0.22,-L*0.1]]) : [[0,-L*0.5+r*0.5]];
      for (const [ex,ey] of engines){ ctx.save(); ctx.translate(ex,ey); const rr=r*(engines.length>1?0.8:1); ctx.fillStyle='rgba(210,210,215,0.16)'; ctx.beginPath(); ctx.arc(0,0,rr,0,TAU); ctx.fill(); ctx.rotate(p.prop); ctx.strokeStyle='rgba(30,30,30,0.5)'; ctx.lineWidth=2; for (let k=0;k<3;k++){ ctx.rotate(TAU/3); ctx.beginPath(); ctx.moveTo(0,0); ctx.lineTo(0,-rr); ctx.stroke(); } ctx.restore(); } }
    ctx.restore();
  }

  // ------------------------------------------------------------ HUD
  function drawHUD(){
    const P=S.player; const cam=S.cam; ctx.save();
    const U=clamp(Math.min(W/1400,H/820),0.62,1); ctx.font='600 13px '+getFont(); ctx.textBaseline='middle';
    for (const p of S.planes){ if (p===P||!p.alive) continue; const s=w2s(p.x,p.y,p.alt); const d=dist3(P,p); const enemy=p.team!==P.team; const col=enemy?'#ff5a5a':'#5fb0ff';
      const on = s.x>-40&&s.y>-40&&s.x<W+40&&s.y<H+40;
      if (on){ const r=Math.max(14,p.def.size*0.5*s.s+6); ctx.strokeStyle=col; ctx.lineWidth=1.5; ctx.globalAlpha=0.9; const isT=p===P.target;
        if (enemy){ ctx.beginPath(); for (const [sx,sy] of [[-1,-1],[1,-1],[1,1],[-1,1]]){ ctx.moveTo(s.x+sx*r,s.y+sy*r-sy*7); ctx.lineTo(s.x+sx*r,s.y+sy*r); ctx.lineTo(s.x+sx*r-sx*7,s.y+sy*r); } ctx.stroke(); if (isT){ ctx.beginPath(); ctx.arc(s.x,s.y,r+6,0,TAU); ctx.stroke(); } }
        else { ctx.beginPath(); ctx.arc(s.x,s.y,r,0,TAU); ctx.stroke(); }
        ctx.fillStyle=col; ctx.textAlign='center'; ctx.fillText(`${p.name} · ${p.def.name}`, s.x, s.y-r-16);
        const da=p.alt-P.alt; ctx.fillStyle='#fff'; ctx.fillText(`${(d*2/1000).toFixed(1)} km  ${da>40?'▲':da<-40?'▼':'●'}${Math.abs(Math.round(da))} m`, s.x, s.y-r-4);
        ctx.fillStyle='rgba(0,0,0,0.5)'; ctx.fillRect(s.x-16,s.y+r+4,32,4); ctx.fillStyle=col; ctx.fillRect(s.x-16,s.y+r+4,32*p.hp/p.maxhp,4); ctx.globalAlpha=1;
      } else if (enemy && d<3800){ const a=Math.atan2(s.y-H/2,s.x-W/2); const ex=clamp(s.x,30,W-30), ey=clamp(s.y,70,H-30); ctx.save(); ctx.translate(ex,ey); ctx.rotate(a); ctx.fillStyle=col; ctx.globalAlpha=0.7; ctx.beginPath(); ctx.moveTo(10,0); ctx.lineTo(-6,-6); ctx.lineTo(-6,6); ctx.closePath(); ctx.fill(); ctx.restore(); }
    }
    for (const g of S.ground){ if (!g.alive) continue; const s=w2s(g.x,g.y,0); if (s.x<-60||s.y<-60||s.x>W+60||s.y>H+60) continue; const enemy=g.team!==P.team; const col=enemy?'#ff5a5a':'#5fb0ff'; ctx.strokeStyle=col; ctx.globalAlpha=0.7; ctx.lineWidth=1.2; const r=g.kind==='base'?22:10; ctx.beginPath(); ctx.moveTo(s.x,s.y-r); ctx.lineTo(s.x+r,s.y); ctx.lineTo(s.x,s.y+r); ctx.lineTo(s.x-r,s.y); ctx.closePath(); ctx.stroke(); if (g.kind==='base'){ ctx.fillStyle=col; ctx.textAlign='center'; ctx.fillText((enemy?'ENEMY':'YOUR')+' AIRFIELD  '+Math.round(g.hp/g.maxhp*100)+'%'+(enemy?'':' · land to rearm'), s.x, s.y-r-10); } ctx.globalAlpha=1; }
    for (const m of S.missiles){ if (m.target!==P) continue; const s=w2s(m.x,m.y,m.alt); ctx.strokeStyle='#ffcf3a'; ctx.lineWidth=2; ctx.beginPath(); ctx.arc(s.x,s.y,10+Math.sin(S.t*20)*3,0,TAU); ctx.stroke(); }
    if (P.alive){
      const g=P.def.guns||P.def.guns2; if (g && !P.onGround){ const nose=nosePos(P); const rx=nose.x+Math.sin(P.hd)*g.range*0.55, ry=nose.y-Math.cos(P.hd)*g.range*0.55; const s=w2s(rx,ry,P.alt); ctx.strokeStyle='rgba(255,255,255,0.75)'; ctx.lineWidth=1.5; ctx.beginPath(); ctx.arc(s.x,s.y,6,0,TAU); ctx.moveTo(s.x-12,s.y); ctx.lineTo(s.x-8,s.y); ctx.moveTo(s.x+8,s.y); ctx.lineTo(s.x+12,s.y); ctx.moveTo(s.x,s.y-12); ctx.lineTo(s.x,s.y-8); ctx.stroke(); }
      const t=P.target; if (t&&t.alive&&g){ const d=dist(P,t); if (d<g.range*1.6){ const tt=d/(g.speed+P.speed*0.6); const lx=t.x+Math.sin(t.hd)*t.speed*tt, ly=t.y-Math.cos(t.hd)*t.speed*tt; const s=w2s(lx,ly,t.alt); const inAlt=Math.abs(t.alt-P.alt)<260; ctx.strokeStyle=inAlt?'#7dff7d':'#ffb347'; ctx.lineWidth=2; ctx.beginPath(); ctx.arc(s.x,s.y,7,0,TAU); ctx.stroke(); ctx.fillStyle=ctx.strokeStyle; ctx.beginPath(); ctx.arc(s.x,s.y,2,0,TAU); ctx.fill(); if (!inAlt){ ctx.textAlign='left'; ctx.fillText(t.alt>P.alt?'climb ▲':'dive ▼', s.x+12, s.y); } } }
      if (P.def.bombs && P.bombs>0 && !P.onGround){ const ip=bombImpact(P); const s=w2s(ip.x,ip.y,0); ctx.strokeStyle='rgba(255,210,80,0.9)'; ctx.lineWidth=1.5; ctx.setLineDash([4,4]); ctx.beginPath(); ctx.arc(s.x,s.y,P.def.bombs.r*0.5*s.s,0,TAU); ctx.stroke(); ctx.setLineDash([]); ctx.beginPath(); ctx.moveTo(s.x-6,s.y); ctx.lineTo(s.x+6,s.y); ctx.moveTo(s.x,s.y-6); ctx.lineTo(s.x,s.y+6); ctx.stroke(); }
      // seeker cone and lock ring
      const mm=P.missiles&&P.missiles[P.missileIdx];
      if (mm&&mm.n>0&&!P.onGround){ const md=window.MISSILES[mm.key];
        const half=(P.locked?md.lockFov*1.5:md.lockFov)*DEG; const L=Math.min(md.range,2000);
        const c0=w2s(P.x,P.y,P.alt);
        const e1=w2s(P.x+Math.sin(P.hd-half)*L, P.y-Math.cos(P.hd-half)*L, P.alt);
        const e2=w2s(P.x+Math.sin(P.hd+half)*L, P.y-Math.cos(P.hd+half)*L, P.alt);
        ctx.strokeStyle=P.locked?'rgba(125,255,125,0.35)':'rgba(255,255,255,0.22)'; ctx.lineWidth=1.5; ctx.setLineDash([7,7]);
        ctx.beginPath(); ctx.moveTo(e1.x,e1.y); ctx.lineTo(c0.x,c0.y); ctx.lineTo(e2.x,e2.y); ctx.stroke(); ctx.setLineDash([]);
        const t2=P.target;
        if (t2&&t2.alive){ const s=w2s(t2.x,t2.y,t2.alt); const rr=Math.max(22,t2.def.size*0.5*s.s+16);
          const prog=P.lockProgress||0;
          ctx.strokeStyle='rgba(255,255,255,0.25)'; ctx.lineWidth=3; ctx.beginPath(); ctx.arc(s.x,s.y,rr,0,TAU); ctx.stroke();
          if (prog>0){ ctx.strokeStyle=P.locked?'#7dff7d':'#f3c14b'; ctx.lineWidth=3; ctx.beginPath(); ctx.arc(s.x,s.y,rr,-Math.PI/2,-Math.PI/2+TAU*prog); ctx.stroke(); }
          if (P.locked){ ctx.fillStyle='#7dff7d'; ctx.textAlign='center'; ctx.font='800 15px '+getFont(); ctx.fillText('LOCK', s.x, s.y+rr+16); }
          else if (P.lockWhy && P.lockWhy!=='LOCKED'){ ctx.fillStyle='#ffd35a'; ctx.textAlign='center'; ctx.font='700 13px '+getFont(); ctx.fillText(P.lockWhy, s.x, s.y+rr+16); }
        }
      }
      if (settings.control==='mouse'){ ctx.strokeStyle='rgba(255,255,255,0.6)'; ctx.lineWidth=1; ctx.beginPath(); ctx.arc(input.mx,input.my,10,0,TAU); ctx.stroke(); ctx.fillStyle='#fff'; ctx.fillRect(input.mx-1,input.my-1,2,2); }
      if (S.hitMarker>0){ ctx.strokeStyle='#fff'; ctx.lineWidth=2; const c=P.target?w2s(P.target.x,P.target.y,P.target.alt):w2s(P.x,P.y,P.alt); for (const [sx,sy] of [[-1,-1],[1,-1],[1,1],[-1,1]]){ ctx.beginPath(); ctx.moveTo(c.x+sx*6,c.y+sy*6); ctx.lineTo(c.x+sx*12,c.y+sy*12); ctx.stroke(); } }
    }
    const pad=16; ctx.textAlign='left';
    const tw=Math.min(520,W-240); const tx=W/2-tw/2, ty=14; ctx.fillStyle='rgba(0,0,0,0.55)'; ctx.fillRect(tx,ty,tw,40);
    const t0=S.tickets[0]/S.maxTickets, t1=S.tickets[1]/S.maxTickets; ctx.fillStyle='#5fb0ff'; ctx.fillRect(tx+6,ty+6,(tw/2-46)*clamp(t0,0,1),10); ctx.fillStyle='#ff5a5a'; ctx.fillRect(tx+tw-6-(tw/2-46)*clamp(t1,0,1),ty+6,(tw/2-46)*clamp(t1,0,1),10);
    ctx.fillStyle='#fff'; ctx.font='700 18px '+getFont(); ctx.textAlign='center'; ctx.fillText(S.mode==='test'?'TEST FLIGHT':fmtTime(S.time), W/2, ty+20); ctx.font='700 14px '+getFont(); ctx.textAlign='left'; ctx.fillStyle='#5fb0ff'; ctx.fillText(Math.max(0,Math.ceil(S.tickets[0])), tx+6, ty+28); ctx.textAlign='right'; ctx.fillStyle='#ff5a5a'; ctx.fillText(Math.max(0,Math.ceil(S.tickets[1])), tx+tw-6, ty+28);
    ctx.textAlign='left'; ctx.font='600 14px '+getFont(); let fy=pad+6; for (const f of S.feed){ const a=clamp(1-(f.t-6)/2,0,1); if (a<=0) continue; ctx.fillStyle=`rgba(0,0,0,${0.45*a})`; const tw2=ctx.measureText(f.text).width; ctx.fillRect(pad-6,fy-10,tw2+12,20); ctx.globalAlpha=a; ctx.fillStyle=f.col; ctx.fillText(f.text,pad,fy); ctx.globalAlpha=1; fy+=22; }
    let my=H*0.22; ctx.textAlign='center'; ctx.font='700 16px '+getFont(); for (const m of hudMsgs){ const a=clamp(m.life/0.5,0,1); ctx.globalAlpha=a; ctx.fillStyle='rgba(0,0,0,0.5)'; const w=ctx.measureText(m.t).width+24; ctx.fillRect(W/2-w/2,my-12,w,24); ctx.fillStyle='#f3c14b'; ctx.fillText(m.t,W/2,my); my+=28; } ctx.globalAlpha=1;
    if (S.killFlash){ const k=S.killFlash.t; const a=k<0.2?k/0.2:k>1.7?(2.2-k)/0.5:1; ctx.globalAlpha=a; ctx.fillStyle='#ffd35a'; ctx.font='800 36px '+getFont(); ctx.fillText(S.killFlash.text,W/2,H*0.3); ctx.font='600 16px '+getFont(); ctx.fillStyle='#fff'; ctx.fillText(S.killFlash.sub,W/2,H*0.3+28); ctx.globalAlpha=1; }
    // flight panel
    const bw=270*U, bh=150*U; const bx=pad, by=H-pad-bh; panel(bx,by,bw,bh);
    ctx.textAlign='left'; ctx.fillStyle='#fff'; ctx.font=`800 ${Math.round(28*U)}px `+getFont(); const spdTxt=Math.round(P.speed*1.6)+''; ctx.fillText(spdTxt, bx+12, by+24*U); const sw=ctx.measureText(spdTxt).width; ctx.font=`600 ${Math.round(11*U)}px `+getFont(); ctx.fillStyle='#9aa3ad'; ctx.fillText('KM/H', bx+16+sw, by+28*U);
    ctx.font=`800 ${Math.round(28*U)}px `+getFont(); ctx.fillStyle=(P.alt<150&&P.vz<-40&&!P.onGround)?'#ff5a5a':'#fff'; ctx.textAlign='right'; ctx.fillText(Math.round(P.alt)+'', bx+bw-40*U, by+24*U); ctx.font=`600 ${Math.round(11*U)}px `+getFont(); ctx.fillStyle='#9aa3ad'; ctx.textAlign='left'; ctx.fillText('M '+(P.vz>15?'▲':P.vz<-15?'▼':'—'), bx+bw-36*U, by+28*U);
    ctx.font=`600 ${Math.round(11*U)}px `+getFont();
    ctx.fillStyle='#9aa3ad'; ctx.fillText('THROTTLE', bx+12, by+50*U); bar(bx+72*U,by+44*U,bw-84*U,9*U,P.throttle,P.def.ab&&P.throttle>0.92?'#8fd3ff':'#f3c14b');
    ctx.fillStyle='#9aa3ad'; ctx.fillText('FUEL', bx+12, by+68*U); bar(bx+72*U,by+62*U,bw-84*U,9*U,P.fuel/P.maxFuel,P.fuel/P.maxFuel>0.25?'#7fd0ff':'#ff5a5a');
    ctx.fillStyle='#9aa3ad'; ctx.fillText('HULL', bx+12, by+86*U); bar(bx+72*U,by+80*U,bw-84*U,9*U,P.hp/P.maxhp,P.hp/P.maxhp>0.5?'#61d47a':P.hp/P.maxhp>0.25?'#f3c14b':'#ff4d4d');
    const flags=[]; if (P.dmg.fire>0) flags.push('FIRE'); if (P.fuel<=0) flags.push('NO FUEL'); if (P.dmg.engine>0) flags.push('ENGINE'); if (P.dmg.leak) flags.push('LEAK'); if (P.dmg.controls>0) flags.push('CONTROLS'); if (P.stall) flags.push('STALL');
    ctx.font=`700 ${Math.round(11*U)}px `+getFont(); let fx0=bx+12; for (const f of flags){ const w=ctx.measureText(f).width+10; if (fx0+w>bx+bw-10) break; ctx.fillStyle=(f==='FIRE'||f==='NO FUEL'||f==='STALL')?'#ff4d4d':'#f3c14b'; ctx.fillRect(fx0,by+98*U,w,16*U); ctx.fillStyle='#000'; ctx.fillText(f,fx0+5,by+106*U); fx0+=w+6; }
    ctx.fillStyle='#e8e4d8'; ctx.font=`700 ${Math.round(13*U)}px `+getFont(); ctx.fillText(P.def.name.toUpperCase(), bx+12, by+bh-16*U); ctx.fillStyle='#9aa3ad'; ctx.textAlign='right'; ctx.fillText(P.kills+' KILLS', bx+bw-12, by+bh-16*U);
    // weapons panel
    const ww=250*U, wh=130*U; const wx=W-pad-ww, wy=H-pad-wh; panel(wx,wy,ww,wh); ctx.textAlign='left'; let ly=wy+16;
    ctx.font='600 12px '+getFont();
    const g1=P.def.guns, g2=P.def.guns2;
    if (g1||g2){ ctx.fillStyle='#9aa3ad'; ctx.fillText('GUNS', wx+12, ly); ctx.fillStyle=P.heat>=1?'#ff4d4d':'#fff'; ctx.font='700 14px '+getFont(); ctx.fillText((g1?P.ammo:P.ammo2)+(g2&&g1?' / '+P.ammo2:''), wx+60, ly); bar(wx+150,wy+10,ww-162,8,P.heat,P.heat>0.8?'#ff4d4d':'#ff9f4a'); ctx.font='600 12px '+getFont(); ly+=22; }
    else { ctx.fillStyle='#9aa3ad'; ctx.fillText('NO GUNS', wx+12, ly); ly+=22; }
    if (P.missiles.length){ P.missiles.forEach((m,i)=>{ const md=window.MISSILES[m.key]; const sel=i===P.missileIdx; ctx.fillStyle=sel?'#f3c14b':'#9aa3ad'; ctx.font=(sel?'700':'600')+' 12px '+getFont(); ctx.fillText((sel?'▶ ':'   ')+md.name.toUpperCase(), wx+12, ly); ctx.fillStyle='#fff'; ctx.textAlign='right'; ctx.fillText('×'+m.n, wx+ww-12, ly); ctx.textAlign='left'; ly+=18; });
      const m=P.missiles[P.missileIdx]; if (m&&m.n>0){ const md=window.MISSILES[m.key];
        if (P.locked){ ctx.fillStyle='#7dff7d'; ctx.font='800 13px '+getFont(); ctx.fillText(md.guidance==='sarh'?'LOCKED · HOLD THE TARGET':'LOCKED · RMB / E', wx+12, ly); }
        else if (P.lockT>0){ ctx.fillStyle='#f3c14b'; ctx.fillText('LOCKING…', wx+12, ly); bar(wx+90,ly-4,ww-102,8,P.lockT/md.lockTime,'#f3c14b'); }
        else { ctx.fillStyle='#9aa3ad'; ctx.font='600 11px '+getFont(); ctx.fillText(P.lockWhy||('SEEKER '+md.guidance.toUpperCase()), wx+12, ly); ctx.font='600 12px '+getFont(); }
        ly+=18; } }
    if (P.def.bombs){ ctx.fillStyle='#9aa3ad'; ctx.font='600 12px '+getFont(); ctx.fillText('BOMBS', wx+12, ly); ctx.fillStyle='#fff'; ctx.textAlign='right'; ctx.fillText('×'+P.bombs, wx+ww-12, ly); ctx.textAlign='left'; ly+=18; }
    if (P.maxFlares){ ctx.fillStyle='#9aa3ad'; ctx.fillText('FLARES', wx+12, ly); ctx.fillStyle='#fff'; ctx.textAlign='right'; ctx.fillText('×'+P.flares, wx+ww-12, ly); ctx.textAlign='left'; ly+=18; }
    // minimap
    const ms=Math.min(170*U,H*0.22); const mx=W/2-ms/2, mmy=H-pad-ms; ctx.fillStyle='rgba(0,0,0,0.55)'; ctx.fillRect(mx-4,mmy-4,ms+8,ms+8); ctx.drawImage(S.mini,mx,mmy,ms,ms); ctx.strokeStyle='rgba(243,193,75,0.5)'; ctx.strokeRect(mx-4,mmy-4,ms+8,ms+8);
    const k=ms/S.size; for (const g of S.ground){ if (!g.alive) continue; ctx.fillStyle=g.team===0?'#5fb0ff':'#ff5a5a'; const r=g.kind==='base'?4:1.5; ctx.fillRect(mx+g.x*k-r,mmy+g.y*k-r,r*2,r*2); }
    for (const p of S.planes){ if (!p.alive) continue; ctx.save(); ctx.translate(mx+p.x*k,mmy+p.y*k); ctx.rotate(p.hd); ctx.fillStyle=p.isPlayer?'#fff':p.team===0?'#5fb0ff':'#ff5a5a'; ctx.beginPath(); ctx.moveTo(0,-4); ctx.lineTo(3,3); ctx.lineTo(-3,3); ctx.closePath(); ctx.fill(); ctx.restore(); }
    for (const m of S.missiles){ ctx.fillStyle='#ffcf3a'; ctx.fillRect(mx+m.x*k-1,mmy+m.y*k-1,2,2); }
    const sv=scaleFor(0)*cam.zoom; ctx.strokeStyle='rgba(255,255,255,0.35)'; ctx.strokeRect(mx+(cam.x-W/2/sv)*k, mmy+(cam.y-H/2/sv)*k, W/sv*k, H/sv*k);
    ctx.textAlign='center';
    if (P.alive){ const m=140; if (P.x<m||P.y<m||P.x>S.size-m||P.y>S.size-m){ ctx.fillStyle='#ffd35a'; ctx.font='800 22px '+getFont(); ctx.fillText('⚠ LEAVING THE BATTLE AREA — TURN BACK', W/2, H*0.12); } }
    if (S.warn && P.alive){ ctx.fillStyle=Math.sin(S.t*18)>0?'#ff4d4d':'#ffd35a'; ctx.font='800 26px '+getFont(); ctx.fillText('⚠ MISSILE — FLARES (F)', W/2, H*0.16); }
    if (P.alive && !P.onGround && P.alt<160 && P.vz<-50){ ctx.fillStyle=Math.sin(S.t*20)>0?'#ff4d4d':'#fff'; ctx.font='800 30px '+getFont(); ctx.fillText('PULL UP', W/2, H*0.38); }
    if (P.alive && P.landed){ ctx.fillStyle='rgba(0,0,0,0.5)'; ctx.fillRect(W/2-200,H*0.34-20,400,40); ctx.fillStyle='#7dff7d'; ctx.font='700 18px '+getFont(); ctx.fillText(P.repairT>0?`LANDED · repairing & rearming ${Math.ceil(P.repairT)} s`:'READY · hold W to take off', W/2, H*0.34); }
    else if (P.alive && P.onGround){ ctx.fillStyle='#fff'; ctx.font='700 16px '+getFont(); ctx.fillText(`TAKEOFF ROLL · rotate at ${Math.round(P.def.speed*0.336*1.6)} km/h (Shift)`, W/2, H*0.34); }
    if (P.alive && P.fuel<P.maxFuel*0.15 && P.fuel>0 && Math.sin(S.t*6)>0){ ctx.fillStyle='#ffd35a'; ctx.font='800 18px '+getFont(); ctx.fillText('LOW FUEL — return to your airfield and land', W/2, H*0.2); }
    if (!P.alive){ ctx.fillStyle='rgba(0,0,0,0.45)'; ctx.fillRect(0,0,W,H); ctx.fillStyle='#ff5a5a'; ctx.font='800 44px '+getFont(); ctx.fillText(S.killedBy==='the ground'?'CRASHED':'SHOT DOWN', W/2, H*0.4); ctx.fillStyle='#fff'; ctx.font='600 18px '+getFont(); ctx.fillText('by '+(S.killedBy||'?'), W/2, H*0.4+36);
      if (S.tickets[0]>0){ ctx.fillStyle='#f3c14b'; ctx.font='700 20px '+getFont(); ctx.fillText(S.respawnT>0?'Respawn in '+Math.ceil(S.respawnT)+'…':(S.bases[0].alive?'Press SPACE / click to respawn on the runway':'Your airfield is destroyed — no respawns'), W/2, H*0.4+80); } }
    ctx.textAlign='left'; ctx.font='600 12px '+getFont(); ctx.fillStyle='rgba(255,255,255,0.7)'; ctx.fillText(`SL +${S.score.sl}   RP +${S.score.rp}   K ${S.score.kills}  A ${S.score.assists}  G ${S.score.ground+S.score.bases}`, pad, H-pad-bh-14);
    if (S.t<14){ ctx.textAlign='center'; ctx.fillStyle=`rgba(255,255,255,${clamp((14-S.t)/2,0,0.8)})`; ctx.font='600 14px '+getFont(); ctx.fillText(settings.control==='mouse'?'Mouse steer · W/S throttle · Shift/↑ climb · Ctrl/↓ dive · LMB guns · RMB/E missile · F flares · B bombs · Q target':'A/D turn · W/S throttle · ↑/↓ climb & dive · Space guns · E missile · F flares · B bombs · Q target', W/2, H-pad-ms-24); }
    ctx.restore();
  }
  function panel(x,y,w,h){ ctx.fillStyle='rgba(6,10,16,0.62)'; ctx.fillRect(x,y,w,h); ctx.strokeStyle='rgba(243,193,75,0.35)'; ctx.lineWidth=1; ctx.strokeRect(x+0.5,y+0.5,w-1,h-1); }
  function bar(x,y,w,h,v,col){ ctx.fillStyle='rgba(255,255,255,0.1)'; ctx.fillRect(x,y,w,h); ctx.fillStyle=col; ctx.fillRect(x,y,w*clamp(v,0,1),h); }
  function fmtTime(t){ t=Math.max(0,t); return Math.floor(t/60)+':'+String(Math.floor(t%60)).padStart(2,'0'); }
  function getFont(){ return '"Avenir Next Condensed","Roboto Condensed","Arial Narrow",Arial,sans-serif'; }

  function renderBackdrop(dt){
    if (!backdrop) backdrop={ world: World.create('islands', 4000, 4242) };
    bdT+=dt; const b=backdrop; const cx=((1200+Math.sin(bdT*0.05)*900+bdT*12)%3000+3000)%3000+500, cy=1300+Math.cos(bdT*0.04)*800; const z=0.7;
    ctx.save(); ctx.translate(W/2,H/2); ctx.scale(z,z); ctx.translate(-cx,-cy); b.world.draw(ctx,{x:cx,y:cy,zoom:z},W,H);
    for (const cl of b.world.clouds){ const wx=((cl.x+bdT*cl.vx)%4000+4000)%4000, wy=((cl.y+bdT*cl.vy)%4000+4000)%4000; if (Math.abs(wx-cx)>W/z||Math.abs(wy-cy)>H/z) continue; ctx.save(); ctx.translate(wx,wy); for (const [ox,oy,r] of cl.parts){ const g=ctx.createRadialGradient(ox-r*0.25,oy-r*0.3,r*0.05,ox,oy,r); g.addColorStop(0,`rgba(255,255,255,${cl.a*0.75})`); g.addColorStop(0.55,`rgba(246,249,253,${cl.a*0.45})`); g.addColorStop(1,'rgba(236,242,250,0)'); ctx.fillStyle=g; ctx.beginPath(); ctx.arc(ox,oy,r,0,TAU); ctx.fill(); } ctx.restore(); }
    ctx.restore();
    ctx.fillStyle='rgba(4,8,14,0.3)'; ctx.fillRect(0,0,W,H); const vg=ctx.createRadialGradient(W*0.6,H*0.45,H*0.2,W*0.6,H*0.45,H*0.95); vg.addColorStop(0,'rgba(0,0,0,0)'); vg.addColorStop(1,'rgba(0,0,0,0.55)'); ctx.fillStyle=vg; ctx.fillRect(0,0,W,H);
  }

  function debugProbe(range, aspectDeg, idx, offDeg){
    const P=S.player; if (!P) return null; if (idx!==undefined) P.missileIdx=idx;
    const m=P.missiles[P.missileIdx]; if (!m) return null; const md=window.MISSILES[m.key];
    const off=(offDeg||0)*DEG;
    const t={ x:P.x+Math.sin(P.hd+off)*range, y:P.y-Math.cos(P.hd+off)*range, alt:P.alt, hd:P.hd+off+Math.PI-aspectDeg*DEG, alive:true, speed:200, onGround:false, def:{size:70} };
    const c=lockCheck(P, md, t); return {missile:md.name, guidance:md.guidance, rearOnly:!!md.rearOnly, range, aspectDeg, ok:c.ok, why:c.why};
  }
  return { debug:{ probe:debugProbe, kill:()=>S&&killPlane(S.player,S.planes[1],'gun'), end:()=>{ if(S) S.tickets[1]=0; }, lose:()=>{ if(S) S.tickets[0]=0; } }, init, start, pause, resume, respawn, quit, set onEnd(f){onEnd=f;}, get state(){ return S?S.state:'idle'; }, settings, get S(){return S;}, toast };
})();
