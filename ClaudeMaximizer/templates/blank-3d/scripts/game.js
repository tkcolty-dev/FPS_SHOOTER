// A tiny 3D starting point. Models are parts or text voxels, every number worth tuning is a prop.
// See docs/ENGINE.md for everything the engine can do.

CM.model('hero', { parts: [{ capsule: [0.3, 0.6], color: 'B', y: 0.7 }, { sphere: 0.28, color: 'Y', y: 1.45 }] });
CM.model('crate', { box: [1, 1, 1], color: 'N' });

CM.entity('hero', {
  model: 'hero', tags: ['player'], gravity: true, keepInBounds: true,
  props: { speed: 6, jump: 8 },
  update(e) {
    const ax = CM.input.axis(), az = CM.input.axisY(); const l = Math.hypot(ax, az) || 1;
    e.vx = ax / l * e.props.speed; e.vz = az / l * e.props.speed; if (ax || az) e.face(ax, az);
    if (CM.input.pressed('jump') && e.grounded) { e.jump(e.props.jump); CM.sfx('jump'); }
  }
});
CM.entity('crate', { model: 'crate', solid: true, static: true });

CM.scene('main', {
  sky: '#8fd3ff',
  setup(s) {
    s.floor({ size: 30 });
    const hero = s.spawn('hero', 0, 0);
    s.camera.follow(hero, { offset: { x: 0, y: 9, z: 11 } });
    s.spawn('crate', 3, -2); s.spawn('crate', -4, 3); s.spawn('crate', 3, 1, -2);
  },
  ui(s, ctx) { CM.draw.text(ctx, 'Arrows move · Space jumps', 16, 14, { size: 18 }); }
});
