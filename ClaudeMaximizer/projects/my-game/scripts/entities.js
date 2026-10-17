// Slime Siege — everything that lives in the arena. Numbers worth tuning are props (see them in Inspector).
const G = window.G || (window.G = { score: 0, kills: 0, bestWave: CM.load('bestWave', 0) });

// upgrades the player can pick when leveling up
const UPGRADES = [
  { id: 'dmg', name: 'Sharper shots', text: '+1 damage', apply: h => { h.props.dmg += 1; } },
  { id: 'rate', name: 'Quick trigger', text: 'Shoot 25% faster', apply: h => { h.props.fireRate *= 0.75; } },
  { id: 'speed', name: 'Fast feet', text: '+15% speed', apply: h => { h.props.speed *= 1.15; } },
  { id: 'hp', name: 'Tough skin', text: '+2 max HP, heal 2', apply: h => { h.props.maxHp += 2; h.props.hp = Math.min(h.props.maxHp, h.props.hp + 2); } },
  { id: 'multi', name: 'Split shot', text: '+1 bullet', apply: h => { h.props.bullets += 1; } },
  { id: 'range', name: 'Eagle eye', text: '+40 range', apply: h => { h.props.range += 40; } },
  { id: 'magnet', name: 'Gem magnet', text: 'Pull gems from farther', apply: h => { h.props.magnet += 40; } },
  { id: 'heal', name: 'Full heal', text: 'Back to full HP', apply: h => { h.props.hp = h.props.maxHp; } }
];
window.UPGRADES = UPGRADES;

function hurt(h, s, n, why) {
  if (h.props.invuln > 0 || s.data.over || s.data.freeze) return;
  h.props.hp -= n; h.props.invuln = 0.8; h.flash(0.2); CM.sfx('hit'); s.camera.shake(3, 0.2);
  CM.log('hero hit by', why, '→ hp', h.props.hp);
  if (h.props.hp <= 0) { h.props.hp = 0; CM.sfx('lose'); s.data.over = true; CM.deleteSave(); G.bestWave = Math.max(G.bestWave, s.data.wave); CM.save('bestWave', G.bestWave); CM.burst(h.cx, h.cy, { color: ['#4fd4e6', '#fff'], count: 30, speed: 90 }); h.visible = false; s.after(2, () => CM.go('gameover', { fade: 0.8 })); }
}

CM.entity('hero', {
  sprite: 'hero', tags: ['player'], keepInBounds: true,
  props: { speed: 95, hp: 6, maxHp: 6, dmg: 1, fireRate: 0.45, bullets: 1, range: 130, magnet: 40, xp: 0, level: 1, nextXp: 5, invuln: 0, cooldown: 0, dashCd: 0, dashT: 0 },
  update(h, dt, s) {
    if (s.data.over || s.data.freeze) { h.vx = 0; h.vy = 0; return; }
    const ax = CM.input.axis(), ay = CM.input.axisY(); const l = Math.hypot(ax, ay) || 1;
    const dashing = h.props.dashT > 0; const sp = h.props.speed * (dashing ? 3 : 1);
    if (dashing) { h.props.dashT -= dt; h.props.invuln = Math.max(h.props.invuln, 0.05); }
    else { h.vx = ax / l * sp; h.vy = ay / l * sp; if (ax || ay) { h.flip = ax < 0; h.fps = 8; } else { h.fps = 0; h.frame = 0; } }
    h.props.dashCd -= dt;
    if (CM.input.pressed('action') && h.props.dashCd <= 0 && (ax || ay)) { h.props.dashCd = 1.5; h.props.dashT = 0.16; h.vx = ax / l * sp * 3; h.vy = ay / l * sp * 3; CM.sfx('powerup'); CM.burst(h.cx, h.cy, { color: '#4fd4e6', count: 8, speed: 40, gravity: 0 }); }
    // auto-aim: shoot the nearest enemy in range
    h.props.cooldown -= dt;
    if (h.props.cooldown <= 0) {
      let best = null, bd = h.props.range; for (const e of s.all('enemy')) { const d = h.dist(e); if (d < bd && s.lineClear(h.cx, h.cy, e.cx, e.cy)) { bd = d; best = e; } }
      if (best) { h.props.cooldown = h.props.fireRate; const n = h.props.bullets; for (let i = 0; i < n; i++) { const spread = n > 1 ? (i - (n - 1) / 2) * 0.18 : 0; const b = h.shoot('bullet', { at: best, speed: 260, offset: 5, over: { props: { dmg: h.props.dmg } } }); if (spread) { const a = Math.atan2(b.vy, b.vx) + spread; b.vx = Math.cos(a) * 260; b.vy = Math.sin(a) * 260; b.angle = a; } } CM.sfx('shoot'); h.flip = best.cx < h.cx; }
    }
    if (h.props.invuln > 0) { h.props.invuln -= dt; h.alpha = Math.floor(h.age * 20) % 2 ? 0.4 : 1; } else h.alpha = 1;
    // gems fly to the hero when close
    for (const g of s.all('gem')) if (g.dist(h) < h.props.magnet) g.moveToward(h, 180 + (h.props.magnet - g.dist(h)) * 3);
  },
  hit: {
    enemy(h, e, s) { hurt(h, s, e.props.touch || 1, e.type); },
    spit(h, p, s) { p.destroy(); hurt(h, s, 1, 'spit'); },
    gem(h, g, s) { g.destroy(); h.props.xp += g.props.xp; G.score += 5; CM.sfx('coin'); if (h.props.xp >= h.props.nextXp) levelUp(h, s); },
    heart(h, p, s) { if (h.props.hp >= h.props.maxHp) return; p.destroy(); h.props.hp = Math.min(h.props.maxHp, h.props.hp + 2); CM.sfx('powerup'); h.say('+2', 1); }
  }
});
function levelUp(h, s) {
  h.props.xp -= h.props.nextXp; h.props.level += 1; h.props.nextXp = Math.round(h.props.nextXp * 1.4 + 2);
  const pool = UPGRADES.filter(u => u.id !== 'heal' || h.props.hp < h.props.maxHp); const picks = []; while (picks.length < 3 && pool.length) picks.push(pool.splice(Math.floor(Math.random() * pool.length), 1)[0]);
  s.data.freeze = true; s.data.choices = picks; s.data.choice = 0; CM.sfx('win'); CM.log('level', h.props.level, 'choose:', picks.map(p => p.name).join(' / '));
}
window.levelUp = levelUp;

CM.entity('bullet', {
  sprite: 'bullet', tags: ['bullet'], collides: false, rotate: true, layer: 1,
  props: { dmg: 1, life: 0.9 },
  update(b, dt, s) { if (b.age > b.props.life || s.solidAt(b.cx, b.cy)) b.destroy(); },
  hit: { enemy(b, e, s) { b.destroy(); e.flash(0.1); CM.burst(e.cx, e.cy, { color: e.def.color || '#49c94c', count: 5, speed: 50 }); if (e.damage(b.props.dmg)) kill(e, s); else CM.sfx('hit', { vol: 0.1 }); } }
});
function kill(e, s) {
  G.kills += 1; G.score += e.props.points || 10; CM.sfx(e.type === 'boss' ? 'explode' : 'hit');
  CM.burst(e.cx, e.cy, { color: [e.def.color || '#49c94c', '#fff'], count: e.type === 'boss' ? 40 : 12, speed: 80 });
  for (let i = 0; i < (e.props.xp || 1); i++) { const g = s.spawn('gem', e.cx - 2 + (Math.random() - 0.5) * 10, e.cy - 2 + (Math.random() - 0.5) * 10); g.vx = (Math.random() - 0.5) * 60; g.vy = (Math.random() - 0.5) * 60; }
  if (Math.random() < (e.props.heartChance || 0.06)) s.spawn('heart', e.cx, e.cy);
  if (e.def.onKill) e.def.onKill(e, s);
}
window.killEnemy = kill;

// ---- enemies: they all chase the hero in their own way
CM.entity('slime', {
  sprite: 'slime', tags: ['enemy'], color: '#49c94c',
  props: { hp: 2, speed: 42, points: 10, xp: 1, touch: 1 },
  update(e, dt, s) { const h = s.find('player'); if (!h || s.data.freeze) { e.vx = 0; e.vy = 0; return; } e.moveToward(h, e.props.speed); }
});
CM.entity('bat', {
  sprite: 'bat', tags: ['enemy'], collides: false, layer: 1, color: '#9b5de5',
  props: { hp: 1, speed: 75, points: 15, xp: 1, touch: 1 },
  update(e, dt, s) { const h = s.find('player'); if (!h || s.data.freeze) { e.vx = 0; e.vy = 0; return; } e.moveToward(h, e.props.speed); e.vx += Math.cos(e.age * 7) * 40; e.vy += Math.sin(e.age * 5) * 40; }
});
CM.entity('spitter', {
  sprite: 'spitter', tags: ['enemy'], color: '#2e7d32',
  props: { hp: 3, speed: 30, keep: 90, every: 2.2, points: 25, xp: 2, touch: 1 },
  update(e, dt, s) {
    const h = s.find('player'); if (!h || s.data.freeze) { e.vx = 0; e.vy = 0; return; }
    const d = e.dist(h); if (d > e.props.keep + 15) e.moveToward(h, e.props.speed); else if (d < e.props.keep - 15) { e.moveToward(h, -e.props.speed); } else { e.vx = 0; e.vy = 0; }
    e.flip = h.cx < e.cx;
    if (d < e.props.keep + 60 && e.every(e.props.every, 'spit') && s.lineClear(e.cx, e.cy, h.cx, h.cy)) { e.shoot('spit', { at: h, speed: 110, offset: 5 }); CM.sfx('shoot', { vol: 0.08 }); }
  }
});
CM.entity('spit', { sprite: 'spit', tags: ['spit'], collides: false, update(p, dt, s) { if (p.age > 2.5 || s.solidAt(p.cx, p.cy)) p.destroy(); } });
CM.entity('tank', {
  sprite: 'tank', tags: ['enemy'], color: '#1f8a7a',
  props: { hp: 10, speed: 24, points: 40, xp: 4, touch: 2 },
  update(e, dt, s) { const h = s.find('player'); if (!h || s.data.freeze) { e.vx = 0; e.vy = 0; return; } e.moveToward(h, e.props.speed); },
  onKill(e, s) { for (let i = 0; i < 2; i++) { const sl = s.spawn('slime', e.cx - 4 + i * 8, e.cy); sl.props.hp = 1; } } // bursts into two little slimes
});
CM.entity('boss', {
  sprite: 'boss', tags: ['enemy', 'boss'], color: '#9b5de5', solid: false,
  props: { hp: 60, speed: 30, chargeEvery: 3, chargeSpeed: 170, points: 300, xp: 20, touch: 2, heartChance: 1 },
  update(e, dt, s) {
    const h = s.find('player'); if (!h || s.data.freeze) { e.vx = 0; e.vy = 0; return; }
    if (e.props.charging > 0) { e.props.charging -= dt; return; } // keeps its charge velocity
    if (e.every(e.props.chargeEvery, 'charge')) { e.props.charging = 0.6; e.moveToward(h, e.props.chargeSpeed); e.say('ROAR', 0.6); s.camera.shake(2, 0.3); return; }
    if (e.every(4, 'summon')) { for (let i = 0; i < 2; i++) s.spawn('slime', e.cx + (i ? 20 : -20), e.cy + 10); CM.sfx('select'); }
    e.moveToward(h, e.props.speed);
  }
});

CM.entity('gem', { sprite: 'gem', tags: ['gem'], collides: false, friction: 3, props: { xp: 1 }, update(g, dt) { if (g.age > 25) g.alpha = Math.floor(g.age * 6) % 2 ? 0.3 : 1; if (g.age > 30) g.destroy(); g.vx *= 0.9; g.vy *= 0.9; } });
CM.entity('heart', { sprite: 'heart', tags: ['heart'], collides: false, update(p, dt) { p.y += Math.sin(p.age * 4) * 0.1; if (p.age > 15) p.destroy(); } });
