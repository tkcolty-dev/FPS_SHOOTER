// Slime Siege — title, the arena with waves, and game over.
const G = window.G;
const wrap = (t, n) => t.split(' ').reduce((lines, w) => { const l = lines[lines.length - 1]; if (l && (l + ' ' + w).length <= n) lines[lines.length - 1] = l + ' ' + w; else lines.push(w); return lines; }, []);

const ARENA = [
  '########################################',
  '#......................................#',
  '#......................................#',
  '#....XX.........................XX.....#',
  '#....XX.........................XX.....#',
  '#......................................#',
  '#......................................#',
  '#..............X........X..............#',
  '#......................................#',
  '#......................................#',
  '#..................P...................#',
  '#......................................#',
  '#......................................#',
  '#..............X........X..............#',
  '#......................................#',
  '#......................................#',
  '#....XX.........................XX.....#',
  '#....XX.........................XX.....#',
  '#......................................#',
  '#......................................#',
  '########################################'
];
const LEGEND = { '#': { solid: true, sprite: 'wall' }, 'X': { solid: true, sprite: 'rock' }, 'P': { spawn: 'hero' } };
const FLOOR = ARENA.map(r => r.replace(/[^#]/g, 'f'));

// what a wave throws at you: more and nastier as the number climbs
function waveList(n) {
  const list = []; const add = (t, k) => { for (let i = 0; i < k; i++) list.push(t); };
  if (n % 5 === 0) { add('boss', 1); add('slime', 3 + n); add('bat', Math.floor(n / 2)); return list; }
  add('slime', 4 + n * 2); if (n >= 2) add('bat', n); if (n >= 3) add('spitter', Math.floor(n / 2)); if (n >= 4) add('tank', Math.floor(n / 3));
  return list;
}
function startWave(s, n) {
  s.data.wave = n; s.data.queue = waveList(n); s.data.timeLeft = 20 + n * 3; s.data.spawnEvery = Math.max(0.35, 1.6 - n * 0.08); s.data.spawnT = 0.5; s.data.banner = { text: n % 5 === 0 ? 'BOSS WAVE ' + n : 'WAVE ' + n, t: 2.2 };
  CM.sfx(n % 5 === 0 ? 'lose' : 'select');
  const h = s.find('player'); if (h) CM.saveGame({ wave: n, score: G.score, kills: G.kills, props: { ...h.props, hp: Math.max(h.props.hp, 2), invuln: 0, cooldown: 0, dashT: 0, dashCd: 0 } });
}
function spawnEnemy(s, type) {
  const h = s.find('player'); const b = s.bounds; let x, y, tries = 0;
  do { const side = Math.floor(Math.random() * 4); x = side === 0 ? 24 : side === 1 ? b.w - 40 : 24 + Math.random() * (b.w - 64); y = side === 2 ? 24 : side === 3 ? b.h - 40 : 24 + Math.random() * (b.h - 64); tries++; } while (h && Math.hypot(x - h.cx, y - h.cy) < 90 && tries < 20);
  const e = s.spawn(type, x, y); e.alpha = 0; e.tween({ alpha: 1 }, 0.4); CM.burst(e.cx, e.cy, { color: '#9b5de5', count: 6, speed: 30, gravity: 0 });
}

CM.scene('title', {
  bg: '#1b2030',
  setup(s) { s.data.blink = 0; s.spawn('hero', 156, 106).fps = 0; },
  update(s, dt) {
    s.data.blink += dt;
    if (CM.input.pressed('jump') || CM.input.pressed('action')) { G.score = 0; G.kills = 0; CM.deleteSave(); CM.go('arena', { fade: 0.5 }); }
    if (CM.hasSave() && (CM.input.held('c') || CM.input.held('C'))) { CM.go('arena', { fade: 0.5 }); }
  },
  ui(s, ctx) {
    CM.draw.text(ctx, 'SLIME SIEGE', CM.W / 2, 28, { size: 16, align: 'center', color: '#4fd4e6' });
    CM.draw.text(ctx, 'SURVIVE THE WAVES', CM.W / 2, 52, { size: 7, align: 'center', color: '#9aa3b2' });
    if (Math.floor(s.data.blink * 2) % 2 === 0) CM.draw.text(ctx, 'PRESS SPACE TO START', CM.W / 2, 130, { size: 8, align: 'center' });
    const sv = CM.loadGame(); if (sv) CM.draw.text(ctx, 'PRESS C TO CONTINUE WAVE ' + sv.wave, CM.W / 2, 146, { size: 7, align: 'center', color: '#ffd93d' });
    if (G.bestWave) CM.draw.text(ctx, 'BEST WAVE ' + G.bestWave, CM.W / 2, 164, { size: 7, align: 'center', color: '#9aa3b2' });
    CM.draw.text(ctx, 'MOVE: ARROWS   DASH: X', CM.W / 2, 78, { size: 7, align: 'center', color: '#5c6473' }); CM.draw.text(ctx, 'YOU SHOOT AUTOMATICALLY', CM.W / 2, 90, { size: 7, align: 'center', color: '#5c6473' });
  }
});

CM.scene('arena', {
  bg: '#1b2030',
  setup(s) {
    s.tiles(FLOOR, { size: 16, legend: { 'f': { sprite: 'floor' } }, layer: -1, name: 'floor' });
    s.tiles(ARENA, { size: 16, legend: LEGEND, main: true, name: 'arena' });
    const h = s.find('player'); s.camera.follow(h, { lerp: 0.15 });
    s.data.over = false; s.data.freeze = false; s.data.choices = null;
    const sv = CM.loadGame();
    if (sv && sv.wave) { Object.assign(h.props, sv.props); G.score = sv.score || 0; G.kills = sv.kills || 0; startWave(s, sv.wave); h.say('Welcome back', 1.5); }
    else startWave(s, 1);
  },
  update(s, dt) {
    const h = s.find('player'); if (!h || s.data.over) return;
    if (s.data.banner) { s.data.banner.t -= dt; if (s.data.banner.t <= 0) s.data.banner = null; }
    if (s.data.freeze) { // picking an upgrade
      const n = s.data.choices.length;
      if (CM.input.pressed('left') || CM.input.pressed('up')) { s.data.choice = (s.data.choice + n - 1) % n; CM.sfx('select'); }
      if (CM.input.pressed('right') || CM.input.pressed('down')) { s.data.choice = (s.data.choice + 1) % n; CM.sfx('select'); }
      for (let i = 0; i < n; i++) if (CM.input.pressed(String(i + 1))) { s.data.choice = i; pick(); }
      if (CM.input.pressed('action') || CM.input.pressed('jump')) pick();
      function pick() { const u = s.data.choices[s.data.choice]; u.apply(h); h.say(u.name, 1.5); CM.sfx('powerup'); s.data.freeze = false; s.data.choices = null; h.props.invuln = 0.6; }
      return;
    }
    // spawning + the wave clock
    s.data.timeLeft -= dt; s.data.spawnT -= dt;
    if (s.data.queue.length && s.data.queue[0] !== '-' && s.data.spawnT <= 0) { s.data.spawnT = s.data.spawnEvery; spawnEnemy(s, s.data.queue.shift()); }
    if (!s.data.queue.length && s.count('enemy') === 0) { s.data.banner = { text: 'WAVE ' + s.data.wave + ' CLEARED', t: 1.6 }; s.data.queue = ['-']; s.after(1.6, () => startWave(s, s.data.wave + 1)); }
    if (s.data.timeLeft <= 0 && s.data.queue.length && s.data.queue[0] !== '-') { s.data.timeLeft = 8; while (s.data.queue.length) spawnEnemy(s, s.data.queue.shift()); } // time's up: the rest arrives at once
  },
  ui(s, ctx) {
    const h = s.find('player'); if (!h) return;
    CM.draw.bar(ctx, 6, 6, 70, 8, h.props.hp / h.props.maxHp, { color: h.props.hp > 2 ? '#e23d3d' : '#ff8c2b' });
    CM.draw.text(ctx, h.props.hp + '/' + h.props.maxHp, 80, 6, { size: 7, color: '#9aa3b2' });
    CM.draw.text(ctx, 'WAVE ' + s.data.wave, CM.W / 2, 6, { size: 8, align: 'center' });
    CM.draw.text(ctx, s.data.queue.length && s.data.queue[0] !== '-' ? Math.ceil(Math.max(0, s.data.timeLeft)) + 's' : (s.count('enemy') + ' LEFT'), CM.W / 2, 17, { size: 7, align: 'center', color: '#9aa3b2' });
    CM.draw.text(ctx, 'SCORE ' + G.score, CM.W - 6, 6, { size: 7, align: 'right', color: '#ffd93d' });
    CM.draw.bar(ctx, 6, CM.H - 12, CM.W - 12, 6, h.props.xp / h.props.nextXp, { color: '#4fd4e6' });
    CM.draw.text(ctx, 'LV ' + h.props.level, 6, CM.H - 21, { size: 7, color: '#4fd4e6' });
    if (h.props.dashCd > 0) CM.draw.bar(ctx, CM.W - 46, CM.H - 20, 40, 4, 1 - h.props.dashCd / 1.5, { color: '#9aa3b2' }); else CM.draw.text(ctx, 'DASH X', CM.W - 6, CM.H - 22, { size: 7, align: 'right', color: '#9aa3b2' });
    if (s.data.banner) { const a = Math.min(1, s.data.banner.t); ctx.globalAlpha = a; CM.draw.text(ctx, s.data.banner.text, CM.W / 2, 70, { size: 14, align: 'center', color: s.data.banner.text.startsWith('BOSS') ? '#ff5fa8' : '#ffd93d' }); ctx.globalAlpha = 1; }
    if (s.data.freeze && s.data.choices) {
      ctx.fillStyle = 'rgba(10,12,20,.78)'; ctx.fillRect(0, 0, CM.W, CM.H);
      CM.draw.text(ctx, 'LEVEL ' + h.props.level + '!  PICK ONE', CM.W / 2, 22, { size: 10, align: 'center', color: '#ffd93d' });
      s.data.choices.forEach((u, i) => { const x = 14 + i * 100, y = 50, on = i === s.data.choice; ctx.fillStyle = on ? '#2b3a55' : '#1c2230'; ctx.fillRect(x, y, 92, 80); ctx.strokeStyle = on ? '#4fd4e6' : '#3e4654'; ctx.lineWidth = on ? 2 : 1; ctx.strokeRect(x + 0.5, y + 0.5, 91, 79); CM.draw.text(ctx, String(i + 1), x + 6, y + 6, { size: 8, color: '#4fd4e6' }); CM.draw.text(ctx, u.name.toUpperCase(), x + 46, y + 24, { size: 7, align: 'center' }); wrap(u.text.toUpperCase(), 13).forEach((line, j) => CM.draw.text(ctx, line, x + 46, y + 44 + j * 10, { size: 7, align: 'center', color: '#9aa3b2' })); });
      CM.draw.text(ctx, 'ARROWS + X, OR PRESS 1 2 3', CM.W / 2, 150, { size: 7, align: 'center', color: '#9aa3b2' });
    }
    if (s.time < 3 && s.data.wave === 1) CM.draw.text(ctx, 'ARROWS MOVE · X DASHES · SHOOTING IS AUTOMATIC', CM.W / 2, CM.H - 32, { size: 7, align: 'center', color: '#9aa3b2' });
  }
});

CM.scene('gameover', {
  bg: '#2a1b20',
  update(s) { if (CM.input.pressed('jump') || CM.input.pressed('action')) CM.go('title', { fade: 0.5 }); },
  ui(s, ctx) {
    CM.draw.text(ctx, 'THE SLIMES WIN', CM.W / 2, 40, { size: 14, align: 'center', color: '#ff7b72' });
    CM.draw.text(ctx, 'SCORE ' + G.score + '   KILLS ' + G.kills, CM.W / 2, 78, { size: 8, align: 'center' });
    CM.draw.text(ctx, 'BEST WAVE ' + G.bestWave, CM.W / 2, 96, { size: 7, align: 'center', color: '#ffd93d' });
    CM.draw.text(ctx, 'PRESS SPACE', CM.W / 2, 130, { size: 7, align: 'center', color: '#9aa3b2' });
  }
});
