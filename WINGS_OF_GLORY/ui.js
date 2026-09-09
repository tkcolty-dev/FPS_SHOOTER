// ui.js — hangar, tech tree, profile/save, results, settings, fullscreen.
(function(){
  const $=id=>document.getElementById(id);
  const SAVE_KEY='wingsOfGlory.save.v1';
  const defaultProfile=()=>({ name:'Pilot', sl:1500, rp:0, level:1, xp:0, battles:0, wins:0, kills:0, owned:['p40','bf109','yak1','spit','a6m','d520'], researched:[], selected:'p40', nation:'usa', settings:{vol:0.8,music:true,control:'mouse',quality:2}, sandbox:true, lastMode:'air', lastMap:'random', lastSize:'8', lastDiff:'1' });
  let prof = load(); let showcaseAnim=null; let currentNation=prof.nation||'usa';
  function load(){ try{ const s=JSON.parse(localStorage.getItem(SAVE_KEY)); if (s&&s.owned) return Object.assign(defaultProfile(), s); }catch(e){} return defaultProfile(); }
  function save(){ try{ localStorage.setItem(SAVE_KEY, JSON.stringify(prof)); }catch(e){} }
  const fmt=n=>Math.round(n).toLocaleString();

  // ---------- boot
  async function boot(){
    Game.init($('game'));
    applySettings();
    await Art.preloadAll(f=>{ $('loadBar').style.width=(f*100).toFixed(0)+'%'; $('loadText').textContent='Painting aircraft… '+Math.round(f*100)+'%'; });
    $('loader').classList.add('hidden'); $('hangar').classList.remove('hidden');
    buildNations(); selectNation(currentNation); refreshTop(); refreshSandbox();
    $('selMode').value=prof.lastMode; $('selMap').value=prof.lastMap; $('selSize').value=prof.lastSize; $('selDiff').value=prof.lastDiff;
    const firstClick=()=>{ Audio2.ensure(); Audio2.music('menu'); document.removeEventListener('pointerdown',firstClick); document.removeEventListener('keydown',firstClick); };
    document.addEventListener('pointerdown',firstClick); document.addEventListener('keydown',firstClick);
  }
  function applySettings(){ const s=prof.settings; Game.settings.control=s.control; Game.settings.quality=+s.quality; Game.settings.name=prof.name; Audio2.setVolume(s.vol); Audio2.setMusic(s.music); }
  function refreshTop(){ $('uiSL').textContent=fmt(prof.sl); $('uiRP').textContent=fmt(prof.rp); $('uiLevel').textContent=prof.level; $('uiRecord').textContent=prof.wins+' / '+prof.battles; $('uiKills').textContent=prof.kills; }

  // ---------- nations & tree
  function buildNations(){ const el=$('nations'); el.innerHTML=''; for (const [id,n] of Object.entries(window.NATIONS)){ const d=document.createElement('div'); d.className='nation'; d.dataset.id=id; d.innerHTML=`<span class="flag" style="background:linear-gradient(90deg,${n.flag[0]} 33%,${n.flag[1]} 33% 66%,${n.flag[2]} 66%)"></span>${n.name}`; d.onclick=()=>{ Audio2.click(); selectNation(id); }; el.appendChild(d); } }
  function selectNation(id){ currentNation=id; prof.nation=id; document.querySelectorAll('.nation').forEach(n=>n.classList.toggle('active',n.dataset.id===id)); buildTree(); const sel=window.planeById(prof.selected); if (!sel||sel.nation!==id){ const own=window.PLANES.filter(p=>p.nation===id&&prof.owned.includes(p.id)); const first=own[0]||window.PLANES.find(p=>p.nation===id); selectPlane(first.id); } else selectPlane(prof.selected); save(); }
  function status(p){ if (prof.sandbox) return 'owned'; if (prof.owned.includes(p.id)) return 'owned'; if (prof.researched.includes(p.id)) return 'researched'; const prev = window.PLANES.filter(x=>x.nation===p.nation && x.rank===p.rank-1); const ok = p.rank===1 || prev.length===0 || prev.some(x=>prof.owned.includes(x.id)); return ok?'available':'locked'; }
  async function buildTree(){ const el=$('tree'); el.innerHTML=''; const planes=window.PLANES.filter(p=>p.nation===currentNation); const ranks=[...new Set(planes.map(p=>p.rank))].sort();
    for (const r of ranks){ const col=document.createElement('div'); col.className='rankcol'; col.innerHTML=`<h4>Rank ${['','I','II','III','IV','V','VI'][r]}</h4>`; el.appendChild(col);
      for (const p of planes.filter(x=>x.rank===r)){ const st=status(p); const c=document.createElement('div'); c.className='card'+(st==='locked'?' locked':'')+(p.id===prof.selected?' selected':''); c.dataset.id=p.id;
        c.innerHTML=`<canvas width="200" height="120"></canvas><div class="nm">${p.name}</div><div class="st"><span>${p.role}</span><span class="br">BR ${p.br}</span></div>`+(st==='owned'?'<span class="badge own">Owned</span>':st==='researched'?'<span class="badge res">Buy</span>':st==='available'?'<span class="badge">Research</span>':'');
        c.onclick=()=>{ Audio2.click(); selectPlane(p.id); }; col.appendChild(c);
        Art.thumb(p.id, 140).then(sp=>{ const cv=c.querySelector('canvas'); cv.width=200; cv.height=110; const x=cv.getContext('2d'); const s=Math.min(186/sp.h, 100/sp.w); x.save(); x.translate(100,55); x.rotate(Math.PI/2); x.drawImage(sp.cv,-sp.w*s/2,-sp.h*s/2,sp.w*s,sp.h*s); x.restore(); }); } } }
  function selectPlane(id){ const p=window.planeById(id); if (!p) return; prof.selected=id; save(); document.querySelectorAll('.card').forEach(c=>c.classList.toggle('selected',c.dataset.id===id));
    $('piRole').textContent=`${window.NATIONS[p.nation].name} · Rank ${['','I','II','III','IV','V','VI'][p.rank]} · ${p.role} · BR ${p.br}`; $('piName').textContent=p.name; $('piDesc').textContent=p.desc;
    const fp = firepower(p);
    setStat('stSpeed', p.speed/1100, Math.round(p.speed*1.6)+' km/h'); setStat('stTurn', p.turn/175, p.turn+'°/s'); setStat('stFire', fp/900, Math.round(fp)+' dps'); setStat('stArmor', p.hp/900, p.hp+' hp');
    const w=[]; if (p.guns) w.push(`<div><b>${p.guns.n}×</b> ${calName(p.guns.cal)}</div>`); if (p.guns2) w.push(`<div><b>${p.guns2.n}×</b> ${calName(p.guns2.cal)}</div>`); if (p.turret) w.push(`<div><b>${p.turret.n}×</b> defensive turret guns</div>`); if (p.missiles) p.missiles.forEach(([k,n])=>{ const m=window.MISSILES[k]; const type = m.guidance==='ir' ? (m.rearOnly?'IR, rear-aspect':'IR, all-aspect') : m.guidance==='sarh' ? 'semi-active radar' : 'active radar'; w.push(`<div><b>${n}×</b> ${m.name} <span style="color:#9aa3ad">${type} · ${(m.range*2/1000).toFixed(1)} km</span></div>`); }); if (p.bombs) w.push(`<div><b>${p.bombs.n}×</b> bombs</div>`); if (p.flares) w.push(`<div><b>${p.flares}</b> flares</div>`); if (p.ab) w.push(`<div><b>Afterburner</b></div>`);
    $('weaponsBox').innerHTML=w.join('');
    const st=status(p); const buy=$('btnBuy'); const battle=$('btnBattle');
    if (st==='owned'){ buy.classList.add('hidden'); battle.disabled=false; }
    else { buy.classList.remove('hidden'); battle.disabled=true; if (st==='researched'){ buy.className='midbtn buy'; buy.textContent=`Purchase · ${fmt(p.cost[0])} SL`; buy.disabled=prof.sl<p.cost[0]; } else if (st==='available'){ buy.className='midbtn research'; buy.textContent=`Research · ${fmt(p.cost[1])} RP`; buy.disabled=prof.rp<p.cost[1]; } else { buy.className='midbtn'; buy.textContent='Locked — own a plane of the previous rank'; buy.disabled=true; } }
    startShowcase(p);
  }
  function firepower(p){ let f=0; for (const g of [p.guns,p.guns2]) if (g) f+=g.dmg*g.rof*(g.n>1?Math.min(g.n,4)*0.7:1); if (p.missiles) f+=p.missiles.reduce((a,[k,n])=>a+window.MISSILES[k].dmg*n*0.2,0); if (p.bombs) f+=p.bombs.n*p.bombs.dmg*0.05; return f; }
  function calName(c){ return {mg:'7.7mm machine guns',hmg:'12.7mm heavy MGs',c20:'20mm cannon',c23:'23mm cannon',c30:'30mm cannon',c37:'37mm cannon',vulcan:'20mm Vulcan rotary cannon',gau:'30mm GAU-8 Avenger'}[c]||c; }
  function setStat(id,v,txt){ $(id).style.width=Math.min(100,v*100)+'%'; $(id+'V').textContent=txt; }
  $('btnBuy').onclick=()=>{ const p=window.planeById(prof.selected); const st=status(p); if (st==='researched'&&prof.sl>=p.cost[0]){ prof.sl-=p.cost[0]; prof.owned.push(p.id); Audio2.kill(); } else if (st==='available'&&prof.rp>=p.cost[1]){ prof.rp-=p.cost[1]; prof.researched.push(p.id); Audio2.kill(); } save(); refreshTop(); buildTree(); selectPlane(p.id); };

  // ---------- showcase (big painted plane over the moving backdrop)
  function startShowcase(p){ if (showcaseAnim) cancelAnimationFrame(showcaseAnim); const cv=$('showcaseCv'); let sp=null; Art.showcase(p.id, 560).then(s=>sp=s); let t=0;
    const draw=()=>{ showcaseAnim=requestAnimationFrame(draw); const r=cv.getBoundingClientRect(); if (cv.width!==r.width*2||cv.height!==r.height*2){ cv.width=r.width*2; cv.height=r.height*2; } const x=cv.getContext('2d'); x.setTransform(2,0,0,2,0,0); x.clearRect(0,0,r.width,r.height); if (!sp) return; t+=1/60;
      const scale=Math.min(1, (r.width*0.62)/sp.h, (r.height*0.72)/sp.w); const cx=r.width*0.55, cy=r.height*0.47+Math.sin(t*0.8)*6; const ang=Math.PI/2+Math.sin(t*0.5)*0.06;
      x.save(); x.translate(cx+40,cy+70); x.rotate(ang); x.globalAlpha=0.35; x.drawImage(sp.shadow,-sp.shadow.width*scale/2,-sp.shadow.height*scale/2,sp.shadow.width*scale,sp.shadow.height*scale); x.restore();
      x.save(); x.translate(cx,cy); x.rotate(ang); x.drawImage(sp.cv,-sp.w*scale/2,-sp.h*scale/2,sp.w*scale,sp.h*scale); x.restore(); };
    draw(); }

  // ---------- battle flow
  $('btnBattle').onclick=()=>{ Audio2.ensure(); Audio2.click(); const p=window.planeById(prof.selected); if (status(p)!=='owned') return;
    prof.lastMode=$('selMode').value; prof.lastMap=$('selMap').value; prof.lastSize=$('selSize').value; prof.lastDiff=$('selDiff').value; save();
    if (showcaseAnim) cancelAnimationFrame(showcaseAnim);
    requestFullscreen();
    $('hangar').classList.add('hidden'); $('briefing').classList.remove('hidden');
    const mode=prof.lastMode; $('brTitle').textContent=mode==='air'?'Air Battle':mode==='ground'?'Ground Strike':'Test Flight';
    $('brText').textContent = mode==='air'?'Shoot down enemy aircraft. Each loss costs your team tickets — first to zero loses.':mode==='ground'?'Destroy the enemy airfield, tanks and AA. Bombers and attackers win this one.':'Free practice against soft targets. No rewards, no pressure.';
    let n=3; $('brCount').textContent=n; const iv=setInterval(()=>{ n--; if (n>0){ $('brCount').textContent=n; Audio2.lockTone(); } else { clearInterval(iv); $('briefing').classList.add('hidden'); $('hud').classList.remove('hidden'); Game.start({planeId:p.id, mode, map:prof.lastMap, size:+prof.lastSize, diff:+prof.lastDiff}); } },700);
  };
  Game.onEnd=res=>{ $('hud').classList.add('hidden'); showResults(res); };
  function showResults(res){ const p=window.planeById(prof.selected); prof.battles++; if (res.win) prof.wins++; prof.kills+=res.kills; prof.sl+=res.total.sl; prof.rp+=res.total.rp; prof.xp+=res.total.rp; while (prof.xp>=prof.level*600){ prof.xp-=prof.level*600; prof.level++; } save(); refreshTop();
    const h=$('resTitle'); h.textContent=res.draw?'Draw':res.win?'Victory':'Defeat'; h.className=res.win?'win':res.draw?'':'lose';
    $('resSummary').innerHTML=`${p.name} · ${res.kills} kills · ${res.assists} assists · ${res.ground} ground · ${res.bases} airfields · ${res.deaths} deaths · ${fmt(res.damage)} damage · ${Math.floor(res.duration/60)}:${String(Math.floor(res.duration%60)).padStart(2,'0')}`;
    const rows=[]; const ev={}; for (const e of res.events){ ev[e.text]=ev[e.text]||{n:0,sl:0,rp:0}; ev[e.text].n++; ev[e.text].sl+=e.sl; ev[e.text].rp+=e.rp; }
    for (const [t,v] of Object.entries(ev)) rows.push(`<div>${t}${v.n>1?' ×'+v.n:''}</div><div class="sl">+${fmt(v.sl)}</div><div class="rp">+${fmt(v.rp)}</div>`);
    rows.push(`<div>Battle participation</div><div class="sl">+${fmt(res.base.sl)}</div><div class="rp">+${fmt(res.base.rp)}</div>`);
    rows.push(`<div>Time in battle</div><div class="sl">+${fmt(res.timeB.sl)}</div><div class="rp">+${fmt(res.timeB.rp)}</div>`);
    if (res.win) rows.push(`<div>Victory bonus (×1.35 + bonus)</div><div class="sl">+${fmt(res.winB.sl)}</div><div class="rp">+${fmt(res.winB.rp)}</div>`);
    rows.push(`<div class="tot">Total</div><div class="sl tot">+${fmt(res.total.sl)} SL</div><div class="rp tot">+${fmt(res.total.rp)} RP</div>`);
    $('resRewards').innerHTML=rows.join(''); $('resultsModal').classList.remove('hidden'); }
  $('btnResultsOk').onclick=()=>{ Audio2.click(); $('resultsModal').classList.add('hidden'); Game.quit(); backToHangar(); };
  function backToHangar(){ $('hud').classList.add('hidden'); $('pauseModal').classList.add('hidden'); $('hangar').classList.remove('hidden'); Audio2.music('menu'); buildTree(); selectPlane(prof.selected); refreshTop(); }
  // pause
  function togglePause(){ if (Game.state==='battle'){ Game.pause(); $('pauseModal').classList.remove('hidden'); } else if (Game.state==='paused'){ Game.resume(); $('pauseModal').classList.add('hidden'); } }
  window.addEventListener('keydown',e=>{ if (e.code==='Escape'||e.code==='KeyP'){ if (Game.state==='battle'||Game.state==='paused') togglePause(); } if (e.code==='F11'){ e.preventDefault(); requestFullscreen(true); } });
  $('pauseBtn').onclick=togglePause; $('btnResume').onclick=()=>{ Audio2.click(); togglePause(); };
  $('btnRespawn').onclick=()=>{ Audio2.click(); const S=Game.S; if (S&&S.player){ if (S.player.alive){ S.player.hp=0; S.player.alive=false; } S.respawnT=0; Game.resume(); $('pauseModal').classList.add('hidden'); Game.respawn(); } };
  $('btnQuit').onclick=()=>{ Audio2.click(); const S=Game.S; const test=S&&S.mode==='test'; Game.quit(); if (!test){ prof.battles++; save(); } backToHangar(); };
  // controls text
  const controls=`<div><span class="kbd">Mouse</span> steer toward cursor</div><div><span class="kbd">A</span><span class="kbd">D</span> turn (keyboard)</div><div><span class="kbd">W</span><span class="kbd">S</span> throttle</div><div><span class="kbd">Shift</span><span class="kbd">↑</span> climb</div><div><span class="kbd">Ctrl</span><span class="kbd">↓</span> dive</div><div><span class="kbd">LMB</span><span class="kbd">Space</span> fire guns</div><div><span class="kbd">RMB</span><span class="kbd">E</span> fire missile (needs lock)</div><div><span class="kbd">1</span><span class="kbd">2</span> select missile type</div><div><span class="kbd">F</span> flares</div><div><span class="kbd">B</span><span class="kbd">Ctrl</span> drop bomb</div><div><span class="kbd">Q</span><span class="kbd">Tab</span> cycle target</div><div><span class="kbd">Wheel</span> zoom</div><div><span class="kbd">Esc</span> pause</div><div><span class="kbd">F11</span> fullscreen</div><div style="margin-top:6px;color:#9aa3ad">Take off: full throttle down the runway, then Shift to rotate. Land: line up with your airfield, throttle back, dive gently onto the strip to repair, refuel and rearm.</div><div style="margin-top:6px;color:#9aa3ad">Gamepad: left stick steer, RT guns, LT missile, A flares, X bomb, Y target, LB/RB throttle</div>`;
  $('controlsList').innerHTML=controls; $('controlsList2').innerHTML=controls;
  function refreshSandbox(){ const b=$('btnSandbox'); b.textContent=(prof.sandbox?'🔓 All planes: On':'🔒 All planes: Off'); b.classList.toggle('on',!!prof.sandbox); }
  $('btnSandbox').onclick=()=>{ Audio2.click(); prof.sandbox=!prof.sandbox; save(); refreshSandbox(); buildTree(); selectPlane(prof.selected); };
  $('btnControls').onclick=()=>{ Audio2.click(); $('controlsModal').classList.remove('hidden'); }; $('btnControlsClose').onclick=()=>$('controlsModal').classList.add('hidden');
  // settings
  $('btnSettings').onclick=()=>{ Audio2.click(); const s=prof.settings; $('setVol').value=s.vol; $('setMusic').checked=s.music; $('setControl').value=s.control; $('setQuality').value=s.quality; $('setName').value=prof.name; $('settingsModal').classList.remove('hidden'); };
  $('btnSettingsClose').onclick=()=>{ const s=prof.settings; s.vol=+$('setVol').value; s.music=$('setMusic').checked; s.control=$('setControl').value; s.quality=$('setQuality').value; prof.name=$('setName').value.trim()||'Pilot'; save(); applySettings(); $('settingsModal').classList.add('hidden'); };
  $('setVol').oninput=e=>Audio2.setVolume(+e.target.value); $('setMusic').onchange=e=>Audio2.setMusic(e.target.checked);
  $('btnReset').onclick=()=>{ if (confirm('Reset all progress? This wipes your planes, Silver Lions and stats.')){ prof=defaultProfile(); save(); applySettings(); $('settingsModal').classList.add('hidden'); refreshTop(); selectNation('usa'); } };
  // fullscreen
  function requestFullscreen(toggle){ const d=document; const el=d.documentElement; if (d.fullscreenElement||d.webkitFullscreenElement){ if (toggle) (d.exitFullscreen||d.webkitExitFullscreen).call(d); return; } try{ const r=(el.requestFullscreen||el.webkitRequestFullscreen).call(el); if (r&&r.catch) r.catch(()=>{}); }catch(e){} }
  $('btnFullscreen').onclick=()=>{ Audio2.click(); requestFullscreen(true); }; $('fsBtn').onclick=()=>requestFullscreen(true);
  window.addEventListener('blur',()=>{ if (Game.state==='battle') togglePause(); });
  boot();
})();
