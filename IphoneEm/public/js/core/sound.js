// OS.sound — genuine iPhone sounds streamed from the Mac's own system files (see server.js),
// the kid's verified keyboard recordings, and carefully synthesized stand-ins for the few that macOS doesn't ship
// (the lock latch) or when running on a non-Mac host.
(function () {
  let ctx = null, master, uiGain, mediaGain, hapticGain;
  const buffers = {};      // id -> AudioBuffer | Promise
  let available = null;    // Set of ids the server can provide
  let listPromise = null;

  function ensure() {
    if (ctx) { if (ctx.state === 'suspended') ctx.resume().catch(() => {}); return ctx; }
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return null;
    ctx = new AC({ latencyHint: 'interactive' });
    master = ctx.createGain(); master.connect(ctx.destination);
    uiGain = ctx.createGain(); uiGain.connect(master);
    mediaGain = ctx.createGain(); mediaGain.connect(master);
    hapticGain = ctx.createGain(); hapticGain.connect(master);
    applyVolumes();
    return ctx;
  }
  function applyVolumes() {
    if (!ctx) return;
    const s = OS.settings;
    const ring = s.get('silent') ? 0 : Math.pow(s.get('ringerVolume'), 1.5);
    uiGain.gain.setTargetAtTime(ring, ctx.currentTime, .01);
    mediaGain.gain.setTargetAtTime(Math.pow(s.get('volume'), 1.5), ctx.currentTime, .01);
    hapticGain.gain.value = s.get('haptics') ? 1 : 0;
  }
  ['silent', 'ringerVolume', 'volume', 'haptics'].forEach((k) => OS.on('setting:' + k, applyVolumes));
  // browsers only allow audio after a user gesture
  const unlock = () => { ensure(); };
  window.addEventListener('pointerdown', unlock, true); window.addEventListener('keydown', unlock, true);

  function fetchList() {
    if (!listPromise) listPromise = fetch('/sys/list').then((r) => r.json()).then((l) => { available = new Set(l); return l; }).catch(() => { available = new Set(); return []; });
    return listPromise;
  }
  function load(id) {
    if (buffers[id]) return Promise.resolve(buffers[id]);
    const p = fetchList().then(() => {
      if (!available.has(id)) return null;
      return fetch('/sys/sound/' + encodeURIComponent(id)).then((r) => r.ok ? r.arrayBuffer() : null)
        .then((ab) => ab && ensure() ? new Promise((res) => ctx.decodeAudioData(ab, res, () => res(null))) : null);
    }).then((buf) => { buffers[id] = buf || false; return buffers[id]; }).catch(() => (buffers[id] = false));
    buffers[id] = p; return p;
  }

  // ───────── synthesis helpers ─────────
  let noiseBuf = null;
  function noise() {
    if (!noiseBuf) { noiseBuf = ctx.createBuffer(1, ctx.sampleRate * .5, ctx.sampleRate); const d = noiseBuf.getChannelData(0); for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1; }
    const n = ctx.createBufferSource(); n.buffer = noiseBuf; n.loop = true; n.loopStart = Math.random() * .2; return n;
  }
  function burst(out, t, freq, q, gain, decay, type = 'bandpass') {
    const n = noise(), f = ctx.createBiquadFilter(), g = ctx.createGain();
    f.type = type; f.frequency.value = freq; f.Q.value = q;
    g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(gain, t + .0008); g.gain.exponentialRampToValueAtTime(.0001, t + decay);
    n.connect(f); f.connect(g); g.connect(out); n.start(t); n.stop(t + decay + .02);
  }
  function tone(out, t, freq, gain, attack, decay, type = 'sine', endFreq) {
    const o = ctx.createOscillator(), g = ctx.createGain(); o.type = type; o.frequency.setValueAtTime(freq, t);
    if (endFreq) o.frequency.exponentialRampToValueAtTime(endFreq, t + decay);
    g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(gain, t + attack); g.gain.exponentialRampToValueAtTime(.0001, t + attack + decay);
    o.connect(g); g.connect(out); o.start(t); o.stop(t + attack + decay + .05);
  }
  function dual(out, t, f1, f2, dur, gain = .16) {
    [f1, f2].forEach((f) => { const o = ctx.createOscillator(), g = ctx.createGain(); o.frequency.value = f; g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(gain, t + .008); g.gain.setValueAtTime(gain, t + dur - .01); g.gain.linearRampToValueAtTime(0, t + dur); o.connect(g); g.connect(out); o.start(t); o.stop(t + dur + .02); });
  }
  const DTMF = { 1: [697, 1209], 2: [697, 1336], 3: [697, 1477], 4: [770, 1209], 5: [770, 1336], 6: [770, 1477], 7: [852, 1209], 8: [852, 1336], 9: [852, 1477], star: [941, 1209], 0: [941, 1336], pound: [941, 1477] };
  const marimba = (out, t, notes, step = .16, gain = .3) => notes.forEach((m, i) => { const f = 440 * Math.pow(2, (m - 69) / 12); tone(out, t + i * step, f, gain, .003, .5); tone(out, t + i * step, f * 4, gain * .25, .002, .12); });

  // Returns duration (s). `out` is the category gain node.
  const SYNTH = {
    // The iPhone lock latch: a bright tick, then the heavier clack of the latch seating ~60 ms later.
    lock(out, t) {
      burst(out, t, 4300, 1.1, .55, .013); burst(out, t, 2100, 1.4, .35, .02); tone(out, t, 1900, .06, .0005, .012, 'triangle');
      const t2 = t + .062;
      burst(out, t2, 2600, 1.6, .75, .024); burst(out, t2, 6200, .9, .3, .007); burst(out, t2 + .004, 900, 1.2, .35, .035);
      tone(out, t2, 175, .3, .001, .05, 'sine', 90);
      return .2;
    },
    key(out, t) { burst(out, t, 1700 + Math.random() * 300, 1.2, .5, .012); tone(out, t, 240, .2, .0008, .03, 'sine', 140); return .06; },
    key_delete(out, t) { burst(out, t, 1100, 1.3, .5, .014); tone(out, t, 185, .25, .0008, .035, 'sine', 110); return .06; },
    key_modifier(out, t) { burst(out, t, 1350, 1.2, .5, .013); tone(out, t, 210, .22, .0008, .032, 'sine', 120); return .06; },
    haptic_light(out, t) { tone(out, t, 170, .22, .001, .022, 'sine', 80); return .04; },
    haptic_medium(out, t) { tone(out, t, 150, .38, .001, .03, 'sine', 65); return .05; },
    haptic_heavy(out, t) { tone(out, t, 125, .6, .001, .045, 'sine', 50); burst(out, t, 300, .8, .1, .02); return .07; },
    shutter(out, t) { burst(out, t, 3200, .8, .6, .02); burst(out, t, 900, 1, .4, .04); burst(out, t + .075, 2400, .9, .5, .03); burst(out, t + .08, 700, 1, .35, .06); return .2; },
    screenshot(out, t) { return SYNTH.shutter(out, t); },
    sent(out, t) { const n = noise(), f = ctx.createBiquadFilter(), g = ctx.createGain(); f.type = 'bandpass'; f.Q.value = 2.5; f.frequency.setValueAtTime(500, t); f.frequency.exponentialRampToValueAtTime(3800, t + .28);
      g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(.4, t + .1); g.gain.exponentialRampToValueAtTime(.001, t + .36); n.connect(f); f.connect(g); g.connect(out); n.start(t); n.stop(t + .4); tone(out, t + .02, 620, .1, .02, .25, 'sine', 1500); return .4; },
    received(out, t) { tone(out, t, 1174.7, .28, .004, .22); tone(out, t + .1, 1568, .3, .004, .4); return .6; },
    charge(out, t) { tone(out, t, 880, .22, .005, .5); tone(out, t + .09, 1318.5, .22, .005, .9); tone(out, t + .09, 2637, .05, .005, .5); return 1.1; },
    pay(out, t) { tone(out, t, 1568, .25, .003, .25); tone(out, t + .12, 2093, .3, .003, .7); tone(out, t + .12, 4186, .06, .003, .4); return .9; },
    payfail(out, t) { tone(out, t, 330, .3, .005, .2, 'triangle'); tone(out, t + .18, 262, .3, .005, .4, 'triangle'); return .7; },
    begin_record(out, t) { tone(out, t, 1046.5, .3, .004, .16); return .25; },
    end_record(out, t) { tone(out, t, 1046.5, .28, .004, .12); tone(out, t + .13, 784, .28, .004, .2); return .4; },
    mail_sent(out, t) { return SYNTH.sent(out, t); },
    new_mail(out, t) { tone(out, t, 1318.5, .25, .004, .3); tone(out, t + .13, 1760, .25, .004, .5); return .7; },
    siri_begin(out, t) { tone(out, t, 587, .2, .01, .14); tone(out, t + .1, 880, .22, .01, .25); return .4; },
    siri_confirm(out, t) { tone(out, t, 880, .2, .01, .12); tone(out, t + .09, 1174.7, .2, .01, .25); return .4; },
    siri_cancel(out, t) { tone(out, t, 880, .2, .01, .12); tone(out, t + .09, 587, .2, .01, .25); return .4; },
    trash(out, t) { burst(out, t, 1200, .7, .4, .08); burst(out, t + .05, 600, .8, .35, .16); return .3; },
    ringback(out, t) { dual(out, t, 440, 480, 2, .12); return 6; },
    busy(out, t) { dual(out, t, 480, 620, .5, .12); return 1; },
    endcall(out, t) { [0, .22, .44].forEach((d) => dual(out, t + d, 425, 425, .14, .1)); return .7; },
    callwaiting(out, t) { dual(out, t, 440, 440, .3, .12); return 4; },
    facetime_ring(out, t) { marimba(out, t, [76, 79, 83, 79], .2, .25); return 2.4; },
    facetime_join(out, t) { marimba(out, t, [72, 79], .1, .25); return .6; },
    facetime_leave(out, t) { marimba(out, t, [79, 72], .1, .25); return .6; },
    ringtone(out, t) { marimba(out, t, [76, 79, 84, 83, 79, 76, 72, 74, 76, 79, 84, 83], .17, .3); return 3; },
    alert(out, t) { marimba(out, t, [81, 85, 88], .11, .3); return .9; },
    tapback(out, t) { tone(out, t, 1400, .2, .003, .12); return .2; },
  };
  function synthFor(id) {
    if (SYNTH[id]) return SYNTH[id];
    if (id.startsWith('dtmf-')) { const f = DTMF[id.slice(5)]; return f ? (out, t) => { dual(out, t, f[0], f[1], .16); return .2; } : null; }
    if (id.startsWith('ringtone:')) return SYNTH.ringtone;
    if (id.startsWith('tone:')) return SYNTH.alert;
    if (id.startsWith('tapback_')) return SYNTH.tapback;
    return null;
  }

  const KEY_VARIANTS = ['key_tap', 'key_tap_2', 'key_tap_3'];
  function resolve(id) {
    if (id === 'key') return { id: KEY_VARIANTS[Math.floor(Math.random() * 3)], rate: .97 + Math.random() * .06, synth: 'key' };
    if (id === 'key_delete') return { id: 'key_delete', rate: 1, synth: 'key_delete' };
    if (id === 'key_modifier') return { id: 'key_tap_2', rate: .84, synth: 'key_modifier' };
    return { id, rate: 1, synth: id };
  }

  OS.sound = {
    get ctx() { return ensure(); },
    get mediaOut() { ensure(); return mediaGain; },
    get uiOut() { ensure(); return uiGain; },
    list() { return fetchList().then((l) => l.slice()); },
    has(id) { return !!(available && available.has(id)); },
    url(id) { return '/sys/sound/' + encodeURIComponent(id); },
    ringtone() { return OS.settings.get('ringtone'); },
    textTone() { return OS.settings.get('textTone'); },
    alertTone() { return OS.settings.get('alertTone'); },
    preload(ids) { ids.forEach((i) => { if (ensure()) load(resolve(i).id); }); },
    play(name, opts = {}) {
      const handle = { stopped: false, node: null, timer: null, stop() { this.stopped = true; clearTimeout(this.timer); try { this.node && this.node.stop(); } catch {} if (this.gain && ctx) { try { this.gain.gain.setTargetAtTime(0, ctx.currentTime, .015); } catch {} } } };
      if (!ensure()) return handle;
      if (name === 'key' || name === 'key_delete' || name === 'key_modifier') { if (!OS.settings.get('keyboardClicks')) return handle; }
      if (name === 'lock' && !OS.settings.get('lockSound')) return handle;
      const cat = opts.category || (/^ringtone:/.test(name) ? 'ringer' : 'ui');
      const out = cat === 'media' ? mediaGain : uiGain;
      const r = resolve(name);
      const vol = opts.volume == null ? 1 : opts.volume;
      const g = ctx.createGain(); g.gain.value = vol; g.connect(out); handle.gain = g;

      const startSynth = () => {
        const fn = synthFor(r.synth); if (!fn || handle.stopped) return;
        const once = () => { if (handle.stopped) return; const d = fn(g, ctx.currentTime + .005) || .5; if (opts.loop) handle.timer = setTimeout(once, d * 1000 + 600); };
        once();
      };
      const startBuf = (buf) => {
        if (handle.stopped) return;
        const src = ctx.createBufferSource(); src.buffer = buf; src.playbackRate.value = r.rate; src.loop = !!opts.loop; src.connect(g); src.start(); handle.node = src;
        src.onended = () => { try { g.disconnect(); } catch {} opts.onEnd && opts.onEnd(); };
      };
      const cached = buffers[r.id];
      if (cached && !(cached instanceof Promise)) startBuf(cached);
      else if (cached === false) startSynth();
      else load(r.id).then((buf) => buf ? startBuf(buf) : startSynth());
      return handle;
    },
  };

  OS.haptic = function (type = 'light') {
    if (!OS.settings.get('haptics') || !ensure()) return;
    const t = ctx.currentTime + .003;
    const H = { light: ['haptic_light'], selection: ['haptic_light'], medium: ['haptic_medium'], heavy: ['haptic_heavy'], rigid: ['haptic_medium'], soft: ['haptic_light'],
      success: ['haptic_light', 'haptic_medium'], warning: ['haptic_medium', 'haptic_light'], error: ['haptic_medium', 'haptic_medium', 'haptic_heavy'] }[type] || ['haptic_light'];
    H.forEach((h, i) => SYNTH[h](hapticGain, t + i * .11));
    try { navigator.vibrate && navigator.vibrate(H.map(() => 12)); } catch {}
  };

  // warm the cache with the sounds that need to be instant
  const warm = () => { window.removeEventListener('pointerdown', warm, true); OS.sound.preload(['key', 'key_delete', 'key_modifier', 'key_tap', 'key_tap_3', 'sent', 'received', 'shutter', 'charge', 'pay']); };
  window.addEventListener('pointerdown', warm, true);
  fetchList();
})();
