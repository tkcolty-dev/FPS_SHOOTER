// Shared by both engines: the CM global, logging, "which file defined this", input (keyboard + gamepad), and the synth.
(function () {
  'use strict';
  const CM = (window.CM = { version: '1.0.0' });
  const ENGINE_FILES = /\/(engine|engine3d|common|editor|app)\.js(\?|:|$)/;

  // which project file and line called into the engine ("scripts/entities.js:12")
  CM.srcOf = function () {
    const st = (new Error().stack || '').split('\n');
    for (const line of st) {
      const m = line.match(/(https?:\/\/[^\s)]+?\.js)(\?[^\s:)]*)?:(\d+):(\d+)/);
      if (!m || ENGINE_FILES.test(m[1])) continue;
      return m[1].replace(/^https?:\/\/[^/]+\/p\/[^/]+\//, '') + ':' + m[3];
    }
    return null;
  };

  // ---------- events + logging ----------
  CM.listeners = { log: [], error: [], frame: [], scene: [] };
  CM.on = (ev, fn) => { CM.listeners[ev].push(fn); return () => { CM.listeners[ev] = CM.listeners[ev].filter(f => f !== fn); }; };
  CM.emit = (ev, ...a) => CM.listeners[ev].forEach(f => { try { f(...a); } catch (e) { console.error(e); } });
  const logBuf = (CM.logs = []);
  const safeJson = v => { try { return JSON.stringify(v); } catch { return String(v); } };
  CM.log = (...args) => {
    const entry = { t: CM.time || 0, text: args.map(a => typeof a === 'string' ? a : safeJson(a)).join(' '), level: 'log' };
    logBuf.push(entry); if (logBuf.length > 200) logBuf.shift(); console.log('[game]', ...args); CM.emit('log', entry);
  };
  const errSeen = new Map(); CM._errSeen = errSeen;
  CM.reportError = function (where, err, entity) {
    const key = where + ':' + (err && err.message); const n = (errSeen.get(key) || 0) + 1; errSeen.set(key, n);
    if (n > 3) return; // the same crash every frame is reported three times, then goes quiet until a reload
    const entry = { t: CM.time || 0, text: `${where}: ${err && err.message}`, level: 'error', stack: err && err.stack, entity: entity ? entity.id : null, where };
    logBuf.push(entry); if (logBuf.length > 200) logBuf.shift(); console.error('[game]', where, err); CM.emit('log', entry); CM.emit('error', entry);
  };
  CM.safe = function (fn, where, entity) { try { return fn(); } catch (err) { if (entity) entity.error = err.message; CM.reportError(where, err, entity); } };

  // ---------- input ----------
  const ALIASES = { left: ['ArrowLeft', 'a', 'A'], right: ['ArrowRight', 'd', 'D'], up: ['ArrowUp', 'w', 'W'], down: ['ArrowDown', 's', 'S'],
    jump: [' ', 'ArrowUp', 'w', 'W', 'z', 'Z'], action: ['x', 'X', 'e', 'E', 'Enter', 'Shift', 'k', 'K'], action2: ['c', 'C', 'q', 'Q', 'l', 'L'], pause: ['Escape', 'p', 'P'] };
  const keys = new Set(), pressed = new Set(), released = new Set(), padHeld = new Set(), padPressed = new Set();
  const input = (CM.input = {
    aliases: ALIASES, enabled: true,
    held(k) { if (!input.enabled) return false; const ks = ALIASES[k] || [k]; return ks.some(x => keys.has(x)) || padHeld.has(k); },
    pressed(k) { if (!input.enabled) return false; const ks = ALIASES[k] || [k]; return ks.some(x => pressed.has(x)) || padPressed.has(k); },
    released(k) { const ks = ALIASES[k] || [k]; return ks.some(x => released.has(x)); },
    axis() { return (input.held('right') ? 1 : 0) - (input.held('left') ? 1 : 0); },
    axisY() { return (input.held('down') ? 1 : 0) - (input.held('up') ? 1 : 0); },
    pointer: { x: 0, y: 0, z: 0, sx: 0, sy: 0, down: false, pressed: false, inside: false },
    anyPressed() { return pressed.size > 0 || padPressed.size > 0; },
    endFrame() { pressed.clear(); released.clear(); input.pointer.pressed = false; },
    pollPads, bindCanvas
  });
  addEventListener('keydown', e => { if (e.target && /INPUT|TEXTAREA|SELECT/.test(e.target.tagName)) return; if (!keys.has(e.key)) pressed.add(e.key); keys.add(e.key); if ([' ', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(e.key) && input.enabled) e.preventDefault(); });
  addEventListener('keyup', e => { keys.delete(e.key); released.add(e.key); });
  addEventListener('blur', () => keys.clear());
  let prevPad = new Set();
  function pollPads() {
    padHeld.clear(); const pads = navigator.getGamepads ? navigator.getGamepads() : [];
    for (const p of pads) { if (!p) continue; const b = i => p.buttons[i] && p.buttons[i].pressed, ax = p.axes[0] || 0, ay = p.axes[1] || 0;
      if (b(14) || ax < -0.4) padHeld.add('left'); if (b(15) || ax > 0.4) padHeld.add('right'); if (b(12) || ay < -0.4) padHeld.add('up'); if (b(13) || ay > 0.4) padHeld.add('down');
      if (b(0)) padHeld.add('jump'); if (b(2) || b(1)) padHeld.add('action'); if (b(3)) padHeld.add('action2'); if (b(9)) padHeld.add('pause'); }
    padPressed.clear(); for (const k of padHeld) if (!prevPad.has(k)) padPressed.add(k); prevPad = new Set(padHeld);
  }
  function bindCanvas(canvas, toLogical) {
    canvas.addEventListener('pointermove', e => { const p = toLogical(e); input.pointer.sx = p.x; input.pointer.sy = p.y; input.pointer.inside = true; });
    canvas.addEventListener('pointerleave', () => { input.pointer.inside = false; });
    canvas.addEventListener('pointerdown', e => { const p = toLogical(e); input.pointer.sx = p.x; input.pointer.sy = p.y; input.pointer.down = true; input.pointer.pressed = true; });
    addEventListener('pointerup', () => { input.pointer.down = false; });
  }

  // ---------- audio: a tiny synth, no sound files needed ----------
  let actx = null; const ac = () => { if (!actx) { try { actx = new (window.AudioContext || window.webkitAudioContext)(); } catch { return null; } } if (actx.state === 'suspended') actx.resume(); return actx; };
  addEventListener('pointerdown', ac, { once: true }); addEventListener('keydown', ac, { once: true });
  CM.volume = 0.5; CM.muted = false;
  CM.tone = function ({ freq = 440, type = 'square', dur = 0.12, slide = 0, vol = 0.3, delay = 0 } = {}) {
    const a = ac(); if (!a || CM.muted) return; const o = a.createOscillator(), g = a.createGain(), t = a.currentTime + delay;
    o.type = type; o.frequency.setValueAtTime(freq, t); if (slide) o.frequency.exponentialRampToValueAtTime(Math.max(30, freq + slide), t + dur);
    g.gain.setValueAtTime(vol * CM.volume, t); g.gain.exponentialRampToValueAtTime(0.001, t + dur);
    o.connect(g).connect(a.destination); o.start(t); o.stop(t + dur + 0.02);
  };
  const SFX = {
    jump: () => CM.tone({ freq: 300, slide: 300, dur: 0.15, type: 'square', vol: 0.2 }),
    coin: () => { CM.tone({ freq: 900, dur: 0.08, type: 'square', vol: 0.2 }); CM.tone({ freq: 1400, dur: 0.18, type: 'square', vol: 0.2, delay: 0.08 }); },
    hit: () => CM.tone({ freq: 200, slide: -150, dur: 0.2, type: 'sawtooth', vol: 0.3 }),
    explode: () => { for (let i = 0; i < 4; i++) CM.tone({ freq: 120 - i * 20, slide: -60, dur: 0.3, type: 'sawtooth', vol: 0.25, delay: i * 0.03 }); },
    shoot: () => CM.tone({ freq: 700, slide: -500, dur: 0.1, type: 'square', vol: 0.18 }),
    select: () => CM.tone({ freq: 600, dur: 0.06, type: 'square', vol: 0.15 }),
    win: () => [523, 659, 784, 1046].forEach((f, i) => CM.tone({ freq: f, dur: 0.18, type: 'square', vol: 0.2, delay: i * 0.12 })),
    lose: () => [400, 350, 300, 200].forEach((f, i) => CM.tone({ freq: f, dur: 0.25, type: 'triangle', vol: 0.25, delay: i * 0.15 })),
    powerup: () => [400, 600, 800, 1200].forEach((f, i) => CM.tone({ freq: f, dur: 0.1, type: 'square', vol: 0.18, delay: i * 0.06 })),
    step: () => CM.tone({ freq: 150, dur: 0.04, type: 'triangle', vol: 0.1 })
  };
  // single-tone starting points for the Sounds tool (the built-ins above may layer several tones)
  CM.PRESETS = { jump: { freq: 300, slide: 300, dur: 0.15, type: 'square', vol: 0.2 }, coin: { freq: 1200, slide: 300, dur: 0.18, type: 'square', vol: 0.2 }, hit: { freq: 200, slide: -150, dur: 0.2, type: 'sawtooth', vol: 0.3 }, explode: { freq: 110, slide: -80, dur: 0.4, type: 'sawtooth', vol: 0.3 }, shoot: { freq: 700, slide: -500, dur: 0.1, type: 'square', vol: 0.18 }, select: { freq: 600, slide: 0, dur: 0.06, type: 'square', vol: 0.15 }, win: { freq: 523, slide: 500, dur: 0.5, type: 'square', vol: 0.2 }, lose: { freq: 400, slide: -250, dur: 0.6, type: 'triangle', vol: 0.25 }, powerup: { freq: 400, slide: 800, dur: 0.3, type: 'square', vol: 0.18 }, step: { freq: 150, slide: 0, dur: 0.04, type: 'triangle', vol: 0.1 } };
  CM.SFX_NAMES = Object.keys(SFX);
  // project sounds.json can swap any sound for a synth setting or a file: { "jump": { "synth": {...} }, "hit": { "file": "sounds/hit.wav" } }
  CM.sounds = {}; const buffers = {};
  CM.loadSounds = obj => { CM.sounds = obj || {}; for (const k of Object.keys(buffers)) delete buffers[k]; };
  async function playFile(url) {
    const a = ac(); if (!a || CM.muted) return;
    const full = url.startsWith('data:') || url.startsWith('/') ? url : `/p/${CM.projectId || ''}/${url}`;
    try { if (!buffers[full]) buffers[full] = fetch(full).then(r => r.arrayBuffer()).then(b => a.decodeAudioData(b)); const buf = await buffers[full]; const src = a.createBufferSource(), g = a.createGain(); src.buffer = buf; g.gain.value = CM.volume; src.connect(g).connect(a.destination); src.start(); } catch (e) { console.warn('sound', url, e.message); }
  }
  CM.playFile = playFile;
  CM.sfx = (name, opts) => { const o = CM.sounds[name]; if (o && o.file) return playFile(o.file); if (o && o.synth) return CM.tone(o.synth); const f = SFX[name]; if (f) f(opts); else CM.tone(opts || { freq: 440 }); };
  CM.PALETTE = {
    K: '#1a1a1e', D: '#4a4a55', L: '#a8a8b3', W: '#ffffff', R: '#e23d3d', O: '#ff8c2b', Y: '#ffd93d', G: '#49c94c',
    B: '#3a7bff', C: '#4fd4e6', P: '#9b5de5', M: '#ff5fa8', N: '#8a5a2b', S: '#f3c79b', T: '#1f8a7a', E: '#ffb3c6',
    g: '#2e7d32', b: '#1f3f8a', r: '#8a1f1f', y: '#b8961f', d: '#2a2a33', w: '#e4e4ea', n: '#5a3a1a', s: '#c98d62'
  };
  // ---------- saving (per game, in this browser) ----------
  // CM.saveGame({ level: 2, coins: 10 }) / CM.loadGame() / CM.hasSave() / CM.deleteSave(); slots: CM.saveGame(data, 'slot2')
  const saveKey = slot => 'cm.game.' + (CM.projectId || 'game') + '.' + (slot || 'main');
  CM.saveGame = (data, slot) => { try { localStorage.setItem(saveKey(slot), JSON.stringify({ at: Date.now(), data })); CM.log('saved ' + (slot || 'main')); return true; } catch { return false; } };
  CM.loadGame = (slot, def) => { try { const v = JSON.parse(localStorage.getItem(saveKey(slot)) || 'null'); return v ? v.data : (def === undefined ? null : def); } catch { return def === undefined ? null : def; } };
  CM.hasSave = slot => { try { return !!localStorage.getItem(saveKey(slot)); } catch { return false; } };
  CM.saveInfo = slot => { try { const v = JSON.parse(localStorage.getItem(saveKey(slot)) || 'null'); return v ? { at: v.at, data: v.data } : null; } catch { return null; } };
  CM.deleteSave = slot => { try { localStorage.removeItem(saveKey(slot)); } catch {} };
  CM.listSaves = () => { const out = []; try { const pre = 'cm.game.' + (CM.projectId || 'game') + '.'; for (let i = 0; i < localStorage.length; i++) { const k = localStorage.key(i); if (k.startsWith(pre)) out.push(k.slice(pre.length)); } } catch {} return out; };
  CM.rand = (a, b) => b == null ? Math.random() * a : a + Math.random() * (b - a);
  CM.pick = arr => arr[Math.floor(Math.random() * arr.length)];
  CM.clamp = (v, a, b) => Math.max(a, Math.min(b, v));
})();
