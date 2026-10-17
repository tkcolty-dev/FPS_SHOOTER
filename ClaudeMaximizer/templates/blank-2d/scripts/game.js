// A tiny starting point. Sprites are text art, levels are text, and every number worth tuning is a prop.
// See docs/ENGINE.md for everything the engine can do.

CM.sprite('hero', [
  '.YYYY.',
  'YKYYKY',
  'YYYYYY',
  '.BBBB.',
  '.B..B.',
  '.K..K.'
]);

CM.entity('hero', {
  sprite: 'hero', tags: ['player'], gravity: true,
  props: { speed: 80, jump: 220 },
  update(e) {
    const ax = CM.input.axis(); e.vx = ax * e.props.speed; if (ax) e.flip = ax < 0;
    if (CM.input.pressed('jump') && e.grounded) { e.jump(e.props.jump); CM.sfx('jump'); }
  }
});

CM.scene('main', {
  bg: '#1b2030',
  setup(s) {
    s.tiles([
      '....................',
      '....................',
      '....................',
      '..P.........====....',
      '.....=====..........',
      '####################',
      '####################'
    ], { size: 16, legend: { '#': { solid: true, color: '#5b4636', top: '#49c94c' }, '=': { solid: true, oneWay: true, color: '#8a5a2b' }, 'P': { spawn: 'hero' } } });
    s.camera.follow(s.find('player'));
  },
  ui(s, ctx) { CM.draw.text(ctx, 'ARROWS + SPACE', 6, 6, { size: 8 }); }
});
