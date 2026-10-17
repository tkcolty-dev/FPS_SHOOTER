// Top-down: no gravity, 8-direction movement, projectiles, enemies that chase or shoot, a spawner.
const G = window.G || (window.G = { score: 0, best: CM.load('best', 0) });

function hurt(e, s, n, why) {
  if (e.props.invuln > 0 || s.data.over) return;
  e.props.hp -= n; e.props.invuln = 1; e.flash(0.2); CM.sfx('hit'); s.camera.shake(3, 0.2);
  CM.log('knight hit by', why, '→ hp', e.props.hp);
  if (e.props.hp <= 0) { CM.sfx('lose'); s.data.over = 'lose'; s.after(1.8, () => CM.go('lose', { fade: 0.6 })); }
}

CM.entity('knight', {
  sprite: 'knight', tags: ['player'], keepInBounds: true,
  props: { speed: 85, hp: 5, maxHp: 5, keys: 0, coins: 0, invuln: 0, fireRate: 0.35, cooldown: 0, arrowSpeed: 230 },
  update(e, dt, s) {
    if (s.data.over) { e.vx = 0; e.vy = 0; return; }
    const ax = CM.input.axis(), ay = CM.input.axisY(); const l = Math.hypot(ax, ay) || 1;
    e.vx = ax / l * e.props.speed; e.vy = ay / l * e.props.speed;
    if (ax || ay) { e.face(ax, ay); e.fps = 8; } else { e.fps = 0; e.frame = 0; e.animT = 0; }
    e.props.cooldown -= dt;
    if (CM.input.held('action') && e.props.cooldown <= 0) { e.props.cooldown = e.props.fireRate; e.shoot('arrow', { speed: e.props.arrowSpeed, offset: 6 }); CM.sfx('shoot'); }
    if (e.props.invuln > 0) { e.props.invuln -= dt; e.alpha = Math.floor(e.age * 20) % 2 ? 0.35 : 1; } else e.alpha = 1;
  },
  hit: {
    enemy(e, o, s) { hurt(e, s, 1, o.type); },
    bone(e, o, s) { o.destroy(); hurt(e, s, 1, 'a bone'); },
    coin(e, c) { c.destroy(); e.props.coins += 1; G.score += 10; CM.sfx('coin'); CM.burst(c.cx, c.cy, { color: ['#ffd93d', '#fff'], count: 8, speed: 50 }); },
    key(e, k) { k.destroy(); e.props.keys += 1; CM.sfx('powerup'); e.say('A key!', 1.5); },
    potion(e, p) { if (e.props.hp >= e.props.maxHp) return; p.destroy(); e.props.hp = e.props.maxHp; CM.sfx('powerup'); e.say('Full health', 1.5); },
    door(e, d, s) { if (e.props.keys > 0) { e.props.keys -= 1; d.destroy(); CM.sfx('select'); CM.burst(d.cx, d.cy, { color: '#8a5a2b', count: 12 }); } else if (e.every(1.5, 'doorHint')) e.say('Need a key', 1.2); },
    chest(e, c, s) { c.destroy(); G.score += 100; CM.sfx('win'); CM.burst(c.cx, c.cy, { color: ['#ffd93d', '#fff', '#ff8c2b'], count: 24, speed: 90 }); e.say('+100!', 1.5); },
    stairs(e, o, s) { if (!s.data.over) { s.data.over = 'win'; G.best = Math.max(G.best, G.score); CM.save('best', G.best); CM.sfx('win'); s.after(1.2, () => CM.go('win', { fade: 0.8 })); } }
  }
});

CM.entity('arrow', {
  sprite: 'arrow', tags: ['arrow'], collides: false, rotate: true, layer: 1,
  props: { damage: 1, life: 1.2 },
  update(e, dt, s) { if (e.age > e.props.life || s.solidAt(e.cx, e.cy)) e.destroy(); },
  hit: { enemy(e, o, s) { e.destroy(); CM.burst(o.cx, o.cy, { color: o.type === 'slime' ? '#49c94c' : '#e4e4ea', count: 8, speed: 60 }); if (o.damage(e.props.damage, e.owner)) { G.score += o.props.points || 20; CM.sfx('explode'); } else CM.sfx('hit'); } }
});

CM.entity('slime', {
  sprite: 'slime', tags: ['enemy'],
  props: { hp: 2, speed: 38, sight: 90, points: 20 },
  update(e, dt, s) {
    const p = s.find('player'); if (!p || s.data.over) { e.vx = 0; e.vy = 0; return; }
    if (e.dist(p) < e.props.sight && s.lineClear(e.cx, e.cy, p.cx, p.cy)) e.moveToward(p, e.props.speed);
    else { if (e.every(1.5, 'wander')) { const a = Math.random() * Math.PI * 2; e.props.wx = Math.cos(a); e.props.wy = Math.sin(a); } e.vx = (e.props.wx || 0) * e.props.speed * 0.4; e.vy = (e.props.wy || 0) * e.props.speed * 0.4; }
  }
});

CM.entity('skeleton', {
  sprite: 'skeleton', tags: ['enemy'],
  props: { hp: 3, speed: 25, range: 120, fireEvery: 2, boneSpeed: 90, points: 40 },
  update(e, dt, s) {
    const p = s.find('player'); if (!p || s.data.over) { e.vx = 0; e.vy = 0; return; }
    const d = e.dist(p), sees = d < e.props.range && s.lineClear(e.cx, e.cy, p.cx, p.cy);
    if (sees) { e.vx = 0; e.vy = 0; e.flip = p.cx < e.cx; if (e.every(e.props.fireEvery, 'fire')) { e.shoot('bone', { at: p, speed: e.props.boneSpeed, offset: 6 }); CM.sfx('shoot'); } }
    else { if (e.every(2, 'patrol')) { e.props.dir = (e.props.dir || 1) * -1; } e.vx = (e.props.dir || 1) * e.props.speed; e.vy = 0; if (e.onWall) e.props.dir = -e.onWall; e.flip = e.vx < 0; }
  }
});

CM.entity('bat', {
  sprite: 'bat', tags: ['enemy'], collides: false, layer: 1,
  props: { hp: 1, speed: 55, sight: 110, points: 15 },
  init(e) { e.props.homeX = e.cx; e.props.homeY = e.cy; },
  update(e, dt, s) {
    const p = s.find('player');
    if (p && !s.data.over && e.dist(p) < e.props.sight) e.moveToward(p, e.props.speed);
    else e.moveToward({ x: e.props.homeX + Math.cos(e.age) * 30, y: e.props.homeY + Math.sin(e.age * 1.3) * 20 }, e.props.speed * 0.5);
    e.vx += Math.cos(e.age * 6) * 20; e.vy += Math.sin(e.age * 5) * 20;
  }
});
CM.entity('bone', { sprite: 'bone', tags: ['bone'], collides: false, rotate: true, update(e, dt, s) { if (e.age > 3 || s.solidAt(e.cx, e.cy)) e.destroy(); } });

// a portal keeps spawning slimes until it is shot
CM.entity('portal', {
  sprite: 'portal', tags: ['enemy', 'spawner'], collides: false,
  props: { hp: 4, every: 4, max: 3, points: 60 },
  update(e, dt, s) { if (s.data.over) return; if (e.every(e.props.every, 'spawn') && s.all('slime').filter(x => x.dist(e) < 80).length < e.props.max) { const sl = s.spawn('slime', e.x, e.y + 12); sl.tween({ alpha: 1 }, 0.4); sl.alpha = 0; CM.burst(e.cx, e.cy, { color: ['#9b5de5', '#ff5fa8'], count: 10, speed: 40 }); } },
  onDie(e, s) { CM.burst(e.cx, e.cy, { color: ['#9b5de5', '#ff5fa8', '#fff'], count: 30, speed: 90 }); s.camera.shake(4, 0.3); }
});

CM.entity('coin', { sprite: 'coin', tags: ['coin'], collides: false });
CM.entity('key', { sprite: 'key', tags: ['key'], collides: false, update(e) { e.y += Math.sin(e.age * 4) * 0.15; } });
CM.entity('potion', { sprite: 'potion', tags: ['potion'], collides: false });
CM.entity('chest', { sprite: 'chest', tags: ['chest'], collides: false });
CM.entity('door', { sprite: 'door', tags: ['door'], solid: true, collides: false });
CM.entity('stairs', { sprite: 'stairs', tags: ['stairs'], collides: false, layer: -1 });
