// Things on the island. x and z are the ground plane, y is up. Speeds are in units per second (a hero is ~1.6 tall).
const G = window.G || (window.G = { best: 0 });

function hurt(e, s, why) {
  if (e.props.invuln > 0 || s.data.over) return;
  e.props.hp -= 1; e.props.invuln = 1.5; e.flash(0.25); CM.sfx('hit'); s.camera.shake(0.25, 0.25);
  CM.log('hero hurt by', why, '→ hp', e.props.hp);
  e.vy = 6; // bounce up a little
  if (e.props.hp <= 0) { CM.sfx('lose'); s.data.over = 'lose'; s.data.overT = 0; }
}

CM.entity('hero', {
  model: 'hero', tags: ['player'], gravity: true, keepInBounds: true,
  props: { speed: 6, jump: 8.5, hp: 3, gems: 0, invuln: 0 },
  update(e, dt, s) {
    if (s.data.over) { e.vx = 0; e.vz = 0; return; }
    const ax = CM.input.axis(), az = CM.input.axisY(); const l = Math.hypot(ax, az) || 1;
    e.vx = ax / l * e.props.speed; e.vz = az / l * e.props.speed;
    if (ax || az) e.face(ax, az);
    if (CM.input.pressed('jump') && e.grounded) { e.jump(e.props.jump); CM.sfx('jump'); }
    if (e.props.invuln > 0) { e.props.invuln -= dt; e.visible = Math.floor(e.age * 16) % 2 === 0; } else e.visible = true;
  },
  hit: {
    gem(e, g, s) {
      g.destroy(); e.props.gems += 1; CM.sfx('coin'); CM.burst(g.x, g.y + 0.5, g.z, { color: ['C', 'W'], count: 14, speed: 3 });
      const left = s.count('gem') - 1; if (left > 0 && left % 3 === 0) e.say(left + ' to go!', 1.5);
      if (left <= 0) { s.data.over = 'win'; s.data.overT = 0; CM.sfx('win'); e.say('Got them all!', 3); G.best = Math.max(G.best, e.props.gems); }
    },
    enemy(e, o, s) { hurt(e, s, o.type); }
  }
});

CM.entity('gem', {
  model: 'gem', tags: ['gem'], collides: false,
  props: { spin: 2, bob: 0.15 },
  update(e, dt) { e.ry += e.props.spin * dt; e.y = 0.25 + Math.sin(e.age * 3) * e.props.bob; }
});

CM.entity('crab', {
  model: 'crab', tags: ['enemy'], gravity: true, keepInBounds: true,
  props: { speed: 2.5, sight: 7, wander: 1.2 },
  init(e) { e.props.homeX = e.x; e.props.homeZ = e.z; e.props.tx = e.x; e.props.tz = e.z; },
  update(e, dt, s) {
    const p = s.find('player');
    if (p && e.dist(p) < e.props.sight && !s.data.over) { e.moveToward(p, e.props.speed); e.props.chasing = true; return; }
    e.props.chasing = false;
    if (e.every(2.5, 'wander')) { e.props.tx = e.props.homeX + CM.rand(-4, 4); e.props.tz = e.props.homeZ + CM.rand(-4, 4); }
    if (Math.hypot(e.props.tx - e.x, e.props.tz - e.z) > 0.3) e.moveToward({ x: e.props.tx, z: e.props.tz }, e.props.wander); else { e.vx = 0; e.vz = 0; }
  }
});

CM.entity('palm', { model: 'palm', solid: true, static: true, tags: ['tree'], w: 0.6, d: 0.6 });
CM.entity('rock', { model: 'rock', solid: true, static: true, tags: ['rock'] });
CM.entity('flag', { model: 'flag', collides: false, tags: ['goal'] });
