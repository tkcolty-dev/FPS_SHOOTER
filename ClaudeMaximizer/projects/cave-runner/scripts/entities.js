// Every kind of thing in the game. Numbers that might need tuning live in props so they show up
// in the Inspector and can be tweaked while playing.
const G = window.G || (window.G = { score: 0, best: CM.load('best', 0) }); // best score is saved in this browser

function hurt(e, s, why) {
  if (e.props.invuln > 0) return;
  e.props.hp -= 1; e.props.invuln = 1.5; e.flash(0.2); CM.sfx('hit'); s.camera.shake(3, 0.2);
  CM.log('player hurt by', why, '→ hp', e.props.hp);
  if (e.props.hp <= 0) { CM.sfx('lose'); s.data.over = 'lose'; s.data.overT = 0; return; }
  if (why === 'fell') { e.x = e.props.spawnX; e.y = e.props.spawnY; e.vx = 0; e.vy = 0; }
  else e.vy = -150;
}

CM.entity('player', {
  sprite: 'player', tags: ['player'], gravity: true,
  props: { speed: 90, jump: 230, hp: 3, coins: 0, invuln: 0 },
  init(e) { e.props.spawnX = e.x; e.props.spawnY = e.y; },
  update(e, dt, s) {
    if (s.data.over) { e.vx = 0; return; }
    const ax = CM.input.axis();
    e.vx = ax * e.props.speed; if (ax) e.flip = ax < 0;
    e.fps = ax && e.grounded ? 8 : 0; if (!ax) { e.frame = 0; e.animT = 0; }
    if (CM.input.pressed('jump') && e.grounded) { e.jump(e.props.jump); CM.sfx('jump'); }
    if (!CM.input.held('jump') && e.vy < -80) e.vy = -80; // let go of jump early for a short hop
    if (e.props.invuln > 0) { e.props.invuln -= dt; e.alpha = Math.floor(e.age * 20) % 2 ? 0.35 : 1; } else e.alpha = 1;
    if (e.y > s.bounds.h + 30) hurt(e, s, 'fell');
  },
  hit: {
    coin(e, c, s) { c.destroy(); e.props.coins += 1; G.score += 10; CM.sfx('coin'); CM.burst(c.cx, c.cy, { color: ['#ffd93d', '#fff'], count: 8, speed: 60 }); },
    enemy(e, o, s) {
      if (e.vy > 0 && e.bottom - o.top < 8) { o.destroy(); e.vy = -170; G.score += 50; CM.sfx('hit'); CM.burst(o.cx, o.cy, { color: o.type === 'bat' ? '#9b5de5' : '#49c94c', count: 12 }); s.camera.shake(2, 0.1); }
      else hurt(e, s, o.type);
    },
    hazard(e, o, s) { hurt(e, s, 'spikes'); },
    goal(e, o, s) { if (!s.data.over) { s.data.over = 'win'; s.data.overT = 0; CM.sfx('win'); e.say('Made it!', 3); G.best = Math.max(G.best, G.score); CM.save('best', G.best); } }
  }
});

CM.entity('coin', { sprite: 'coin', tags: ['coin'] });

CM.entity('bat', {
  sprite: 'bat', tags: ['enemy'], gravity: false,
  props: { speed: 50, dir: -1, bob: 25 },
  update(e) {
    if (e.onWall) e.props.dir = -e.onWall;
    e.vx = e.props.dir * e.props.speed; e.flip = e.props.dir > 0;
    e.vy = Math.cos(e.age * 4) * e.props.bob;
  }
});

CM.entity('slime', {
  sprite: 'slime', tags: ['enemy'], gravity: true,
  props: { speed: 25, dir: 1 },
  update(e, dt, s) {
    if (e.onWall) e.props.dir = -e.onWall;
    // turn around at a ledge so slimes never walk off
    const aheadX = e.props.dir > 0 ? e.right + 1 : e.left - 1;
    if (e.grounded && !s.solidAt(aheadX, e.bottom + 2)) e.props.dir = -e.props.dir;
    e.vx = e.props.dir * e.props.speed; e.flip = e.props.dir < 0;
  }
});

CM.entity('spike', { sprite: 'spike', tags: ['hazard'], collides: false });
CM.entity('flag', { sprite: 'flag', tags: ['goal'], collides: false });
