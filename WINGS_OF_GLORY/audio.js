// audio.js — all sound is synthesized with WebAudio (engines, guns, missiles, explosions, UI, music).
window.Audio2 = (function(){
  let ctx=null, master=null, sfxBus=null, musicBus=null, engineNodes=null, warnOsc=null;
  let vol=0.8, musicOn=true, musicTimer=null, musicMode=null;
  const noiseBufs={};
  function ensure(){
    if (ctx) { if (ctx.state==='suspended') ctx.resume(); return ctx; }
    ctx = new (window.AudioContext||window.webkitAudioContext)();
    master = ctx.createGain(); master.gain.value=vol; master.connect(ctx.destination);
    sfxBus = ctx.createGain(); sfxBus.connect(master);
    musicBus = ctx.createGain(); musicBus.gain.value = musicOn?0.5:0; musicBus.connect(master);
    return ctx;
  }
  function noise(len){ const key=Math.round(len*10); if (noiseBufs[key]) return noiseBufs[key]; const b=ctx.createBuffer(1, Math.ceil(ctx.sampleRate*len), ctx.sampleRate); const d=b.getChannelData(0); for(let i=0;i<d.length;i++) d[i]=Math.random()*2-1; noiseBufs[key]=b; return b; }
  function env(g, t, a, d, s, r, peak){ peak=peak||1; g.gain.cancelScheduledValues(t); g.gain.setValueAtTime(0.0001,t); g.gain.linearRampToValueAtTime(peak,t+a); g.gain.exponentialRampToValueAtTime(Math.max(0.0001,peak*s),t+a+d); g.gain.exponentialRampToValueAtTime(0.0001,t+a+d+r); }
  function pan(x){ if (!ctx.createStereoPanner) return null; const p=ctx.createStereoPanner(); p.pan.value=Math.max(-1,Math.min(1,x||0)); return p; }
  function out(node, x, gain){ const g=ctx.createGain(); g.gain.value=gain==null?1:gain; const p=pan(x); node.connect(g); if(p){ g.connect(p); p.connect(sfxBus);} else g.connect(sfxBus); return g; }

  // ---------------- SFX ----------------
  function gun(cal, x, dist){
    if (!ctx) return; const t=ctx.now||ctx.currentTime; const d=Math.max(0,1-(dist||0)/1400); if (d<=0) return;
    const big = cal==='c30'||cal==='c37'||cal==='gau'; const mid=cal==='c20'||cal==='c23'||cal==='vulcan';
    const src=ctx.createBufferSource(); src.buffer=noise(0.5);
    const f=ctx.createBiquadFilter(); f.type='bandpass'; f.frequency.value= big?260:mid?520:1100; f.Q.value=0.7;
    const g=ctx.createGain(); env(g,t,0.003, big?0.09:0.05, 0.15, big?0.16:0.07, (big?0.9:mid?0.6:0.35)*d);
    src.connect(f); f.connect(g); out(g,x,1); src.start(t); src.stop(t+0.5);
    if (big||mid){ const o=ctx.createOscillator(); o.type='triangle'; o.frequency.setValueAtTime(big?140:220,t); o.frequency.exponentialRampToValueAtTime(40,t+0.12); const og=ctx.createGain(); env(og,t,0.002,0.06,0.1,0.1,0.5*d); o.connect(og); out(og,x,1); o.start(t); o.stop(t+0.3); }
  }
  function hit(x, dist, heavy){
    if (!ctx) return; const t=ctx.currentTime; const d=Math.max(0,1-(dist||0)/1200); if(d<=0) return;
    const src=ctx.createBufferSource(); src.buffer=noise(0.3); const f=ctx.createBiquadFilter(); f.type='lowpass'; f.frequency.value=heavy?900:2600;
    const g=ctx.createGain(); env(g,t,0.002,0.04,0.2,0.12,(heavy?0.8:0.45)*d); src.connect(f); f.connect(g); out(g,x,1); src.start(t); src.stop(t+0.3);
    const o=ctx.createOscillator(); o.type='square'; o.frequency.setValueAtTime(heavy?180:600,t); o.frequency.exponentialRampToValueAtTime(60,t+0.08); const og=ctx.createGain(); env(og,t,0.001,0.05,0.05,0.06,0.25*d); o.connect(og); out(og,x,1); o.start(t); o.stop(t+0.2);
  }
  function explosion(x, dist, size){
    if (!ctx) return; const t=ctx.currentTime; size=size||1; const d=Math.max(0.05,1-(dist||0)/3000);
    const src=ctx.createBufferSource(); src.buffer=noise(2.5); const f=ctx.createBiquadFilter(); f.type='lowpass'; f.frequency.setValueAtTime(3000*size,t); f.frequency.exponentialRampToValueAtTime(80,t+1.2*size);
    const g=ctx.createGain(); env(g,t,0.01,0.3*size,0.35,1.2*size,1.3*d*Math.min(1.4,size)); src.connect(f); f.connect(g); out(g,x,1); src.start(t); src.stop(t+2.5);
    const o=ctx.createOscillator(); o.type='sine'; o.frequency.setValueAtTime(110,t); o.frequency.exponentialRampToValueAtTime(28,t+0.9*size); const og=ctx.createGain(); env(og,t,0.005,0.2,0.4,0.9*size,1.0*d*size); o.connect(og); out(og,x,1); o.start(t); o.stop(t+1.5*size);
  }
  function missileLaunch(x, dist){
    if (!ctx) return; const t=ctx.currentTime; const d=Math.max(0,1-(dist||0)/2000); if(d<=0) return;
    const src=ctx.createBufferSource(); src.buffer=noise(1.5); const f=ctx.createBiquadFilter(); f.type='bandpass'; f.frequency.setValueAtTime(400,t); f.frequency.exponentialRampToValueAtTime(2400,t+0.35); f.frequency.exponentialRampToValueAtTime(500,t+1.3); f.Q.value=1.2;
    const g=ctx.createGain(); env(g,t,0.02,0.3,0.5,0.9,0.9*d); src.connect(f); f.connect(g); out(g,x,1); src.start(t); src.stop(t+1.5);
  }
  function flare(x,dist){ if(!ctx) return; const t=ctx.currentTime; const d=Math.max(0,1-(dist||0)/1200); if(d<=0)return; const src=ctx.createBufferSource(); src.buffer=noise(0.25); const f=ctx.createBiquadFilter(); f.type='highpass'; f.frequency.value=1800; const g=ctx.createGain(); env(g,t,0.002,0.05,0.2,0.15,0.35*d); src.connect(f); f.connect(g); out(g,x,1); src.start(t); src.stop(t+0.3); }
  function bombDrop(){ if(!ctx) return; const t=ctx.currentTime; const o=ctx.createOscillator(); o.type='sine'; o.frequency.setValueAtTime(900,t); o.frequency.exponentialRampToValueAtTime(300,t+1.4); const g=ctx.createGain(); env(g,t,0.05,0.5,0.6,0.8,0.2); o.connect(g); out(g,0,1); o.start(t); o.stop(t+1.5); }
  function beep(freq, len, gain, type){ if(!ctx) return; const t=ctx.currentTime; const o=ctx.createOscillator(); o.type=type||'square'; o.frequency.value=freq; const g=ctx.createGain(); env(g,t,0.005,len*0.5,0.5,len*0.5,gain||0.15); o.connect(g); out(g,0,1); o.start(t); o.stop(t+len+0.1); }
  function lock(){ beep(1400,0.12,0.18,'square'); }
  function lockTone(){ beep(980,0.06,0.09,'square'); }
  function click(){ beep(2200,0.03,0.12,'triangle'); setTimeout(()=>beep(1600,0.03,0.08,'triangle'),25); }
  function kill(){ if(!ctx) return; beep(660,0.08,0.18,'square'); setTimeout(()=>beep(880,0.08,0.18,'square'),90); setTimeout(()=>beep(1320,0.16,0.2,'square'),180); }
  function died(){ if(!ctx) return; beep(300,0.2,0.2,'sawtooth'); setTimeout(()=>beep(220,0.3,0.2,'sawtooth'),200); setTimeout(()=>beep(140,0.6,0.22,'sawtooth'),450); }
  function warning(on){ if(!ctx) return; if (on && !warnOsc){ warnOsc={}; const tick=()=>{ if(!warnOsc) return; beep(1800,0.05,0.12,'square'); warnOsc.t=setTimeout(tick,180); }; tick(); } else if (!on && warnOsc){ clearTimeout(warnOsc.t); warnOsc=null; } }
  function flyby(x){ if(!ctx) return; const t=ctx.currentTime; const src=ctx.createBufferSource(); src.buffer=noise(1.2); const f=ctx.createBiquadFilter(); f.type='bandpass'; f.frequency.setValueAtTime(300,t); f.frequency.exponentialRampToValueAtTime(1500,t+0.4); f.frequency.exponentialRampToValueAtTime(200,t+1.1); const g=ctx.createGain(); env(g,t,0.3,0.2,0.6,0.5,0.35); src.connect(f); f.connect(g); out(g,x,1); src.start(t); src.stop(t+1.3); }

  // ---------------- ENGINE ----------------
  function engineStart(jet, ab){
    ensure(); engineStop();
    const g=ctx.createGain(); g.gain.value=0; g.connect(sfxBus);
    const nodes={g, jet, oscs:[]};
    if (!jet){
      const lp=ctx.createBiquadFilter(); lp.type='lowpass'; lp.frequency.value=900; lp.connect(g);
      for (const [type,mult,gain] of [['sawtooth',1,0.5],['square',0.5,0.25],['sawtooth',2.01,0.18],['triangle',3,0.12]]){
        const o=ctx.createOscillator(); o.type=type; o.frequency.value=60*mult; const og=ctx.createGain(); og.gain.value=gain; o.connect(og); og.connect(lp); o.start(); nodes.oscs.push({o,mult});
      }
      const lfo=ctx.createOscillator(); lfo.frequency.value=11; const lg=ctx.createGain(); lg.gain.value=180; lfo.connect(lg); lg.connect(lp.frequency); lfo.start(); nodes.lfo=lfo;
      nodes.lp=lp;
    } else {
      const src=ctx.createBufferSource(); src.buffer=noise(3); src.loop=true; const bp=ctx.createBiquadFilter(); bp.type='bandpass'; bp.frequency.value=500; bp.Q.value=0.6; const ng=ctx.createGain(); ng.gain.value=0.55; src.connect(bp); bp.connect(ng); ng.connect(g); src.start(); nodes.src=src; nodes.bp=bp;
      const o=ctx.createOscillator(); o.type='sawtooth'; o.frequency.value=180; const lp=ctx.createBiquadFilter(); lp.type='lowpass'; lp.frequency.value=1200; const og=ctx.createGain(); og.gain.value=0.16; o.connect(lp); lp.connect(og); og.connect(g); o.start(); nodes.oscs.push({o,mult:1});
      const w=ctx.createOscillator(); w.type='sine'; w.frequency.value=2200; const wg=ctx.createGain(); wg.gain.value=0.03; w.connect(wg); wg.connect(g); w.start(); nodes.whine=w; nodes.wg=wg;
      const ab2=ctx.createBufferSource(); ab2.buffer=noise(2); ab2.loop=true; const abf=ctx.createBiquadFilter(); abf.type='lowpass'; abf.frequency.value=220; const abg=ctx.createGain(); abg.gain.value=0; ab2.connect(abf); abf.connect(abg); abg.connect(g); ab2.start(); nodes.abg=abg; nodes.ab=ab2;
    }
    engineNodes=nodes;
  }
  function engineUpdate(throttle, speedFrac, ab){
    if (!engineNodes||!ctx) return; const n=engineNodes; const t=ctx.currentTime;
    const target = 0.16 + throttle*0.22;
    n.g.gain.setTargetAtTime(target, t, 0.15);
    if (!n.jet){
      const base = 48 + throttle*70 + speedFrac*25;
      n.oscs.forEach(({o,mult})=>o.frequency.setTargetAtTime(base*mult,t,0.25));
      n.lp.frequency.setTargetAtTime(500+throttle*900,t,0.3);
    } else {
      n.bp.frequency.setTargetAtTime(350+throttle*900+speedFrac*400,t,0.3);
      n.oscs[0].o.frequency.setTargetAtTime(120+throttle*200,t,0.3);
      n.whine.frequency.setTargetAtTime(1800+throttle*1600,t,0.3); n.wg.gain.setTargetAtTime(0.02+throttle*0.03,t,0.3);
      n.abg.gain.setTargetAtTime(ab?0.6:0,t,0.2);
    }
  }
  function engineStop(){ if(!engineNodes) return; const n=engineNodes; try{ n.g.gain.setTargetAtTime(0,ctx.currentTime,0.1); setTimeout(()=>{ n.oscs.forEach(x=>x.o.stop()); n.lfo&&n.lfo.stop(); n.src&&n.src.stop(); n.whine&&n.whine.stop(); n.ab&&n.ab.stop(); n.g.disconnect(); },400);}catch(e){} engineNodes=null; }

  // ---------------- MUSIC ----------------
  // Simple sequencer: military snare + timpani + brass-like pad in a minor key.
  const scale=[0,2,3,5,7,8,10,12];
  function note(freq, t, len, type, gain, dest){ const o=ctx.createOscillator(); o.type=type; o.frequency.value=freq; const g=ctx.createGain(); g.gain.setValueAtTime(0.0001,t); g.gain.linearRampToValueAtTime(gain,t+0.04); g.gain.setValueAtTime(gain,t+len*0.7); g.gain.exponentialRampToValueAtTime(0.0001,t+len); o.connect(g); g.connect(dest||musicBus); o.start(t); o.stop(t+len+0.05); }
  function snare(t,gain){ const s=ctx.createBufferSource(); s.buffer=noise(0.3); const f=ctx.createBiquadFilter(); f.type='highpass'; f.frequency.value=1500; const g=ctx.createGain(); env(g,t,0.002,0.05,0.2,0.1,gain); s.connect(f); f.connect(g); g.connect(musicBus); s.start(t); s.stop(t+0.3); }
  function timp(t,freq,gain){ const o=ctx.createOscillator(); o.type='sine'; o.frequency.setValueAtTime(freq,t); o.frequency.exponentialRampToValueAtTime(freq*0.6,t+0.4); const g=ctx.createGain(); env(g,t,0.005,0.2,0.3,0.5,gain); o.connect(g); g.connect(musicBus); o.start(t); o.stop(t+0.9); }
  function music(mode){
    if (mode===musicMode) return; musicMode=mode; if (musicTimer){ clearInterval(musicTimer); musicTimer=null; }
    if (!mode||!ctx) return;
    const bpm = mode==='battle'?132:84; const beat=60/bpm; let bar=0; let next=ctx.currentTime+0.1;
    const root = mode==='battle'?110:82.4; // A2 / E2
    const prog = mode==='battle'?[[0,3,7],[5,8,12],[3,7,10],[7,10,14]]:[[0,3,7],[8,12,15],[5,8,12],[7,10,14]];
    function schedule(){
      while (next < ctx.currentTime+1.2){
        const t=next; const chord=prog[bar%prog.length];
        for (let b=0;b<4;b++){
          const bt=t+b*beat;
          if (mode==='battle'){ snare(bt,b%2?0.18:0.1); snare(bt+beat*0.5,0.06); snare(bt+beat*0.75,0.05); if(b===0||b===2) timp(bt,root*0.5,0.5); }
          else { if(b===0) timp(bt,root*0.5,0.35); if(b===2) snare(bt,0.05); }
          chord.forEach((n,i)=>{ const f=root*Math.pow(2,n/12)*(i===0?1:2); note(f,bt,beat*0.95,'sawtooth',0.035, undefined); });
          if (mode==='battle' && b%2===1){ const m=scale[(bar*3+b*2)%scale.length]; note(root*4*Math.pow(2,m/12),bt,beat*0.5,'square',0.03); }
        }
        if (mode!=='battle' && bar%2===0){ const m=scale[(bar*5)%scale.length]; note(root*4*Math.pow(2,m/12),t,beat*3,'triangle',0.05); }
        next += beat*4; bar++;
      }
    }
    schedule(); musicTimer=setInterval(schedule, 250);
  }
  function setVolume(v){ vol=v; if(master) master.gain.setTargetAtTime(v,ctx.currentTime,0.05); }
  function setMusic(on){ musicOn=on; if(musicBus) musicBus.gain.setTargetAtTime(on?0.5:0,ctx.currentTime,0.1); }
  function duck(on){ if(!musicBus) return; musicBus.gain.setTargetAtTime(musicOn?(on?0.18:0.5):0,ctx.currentTime,0.3); }
  return { ensure, gun, hit, explosion, missileLaunch, flare, bombDrop, lock, lockTone, click, kill, died, warning, flyby, engineStart, engineUpdate, engineStop, music, setVolume, setMusic, duck, get ctx(){return ctx;} };
})();
