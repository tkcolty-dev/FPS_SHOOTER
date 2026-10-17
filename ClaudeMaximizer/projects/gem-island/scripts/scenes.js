// The island scene: a floor, water around it, trees and rocks to dodge, gems to grab, crabs that chase.
const G = window.G;

CM.scene('island', {
  sky: '#8fd3ff', fog: 90, gravity: 24,
  setup(s) {
    s.floor({ size: 36, color: '#efe0a8', color2: '#e6d494' });
    // water all around (plain Three.js is always available through window.THREE)
    const water = new THREE.Mesh(new THREE.PlaneGeometry(400, 400), new THREE.MeshLambertMaterial({ color: 0x3a9ad9 }));
    water.rotation.x = -Math.PI / 2; water.position.y = -0.08; s.three.add(water);

    const hero = s.spawn('hero', 0, 2);
    hero.name = 'Hero';
    s.camera.follow(hero, { offset: { x: 0, y: 10, z: 12 }, lerp: 0.08 });

    const trees = [[-12, -10], [10, -12], [13, 8], [-9, 11], [3, -14], [-14, 2]];
    trees.forEach(([x, z]) => s.spawn('palm', x, z));
    [[-5, -6], [7, 3], [-8, 6], [9, -5], [0, -9]].forEach(([x, z]) => s.spawn('rock', x, z));
    // stepping blocks you can jump on
    s.block(4, 0, 8, 2, 1, 2, 'D'); s.block(6, 0, 10, 2, 2, 2, 'D'); s.block(8, 0, 12, 2, 3, 2, 'L');

    for (let i = 0; i < 12; i++) { const a = i / 12 * Math.PI * 2, r = 6 + (i % 3) * 4; s.spawn('gem', Math.cos(a) * r, Math.sin(a) * r); }
    s.spawn('gem', 8, 3.1, 12); // on top of the tallest block
    [[-11, 0], [11, -9], [-6, -12], [8, 9]].forEach(([x, z]) => s.spawn('crab', x, z));
    s.spawn('flag', 0, -16);
    s.data.over = null; s.data.gemsTotal = s.count('gem');
  },
  update(s, dt) {
    if (s.data.over) { s.data.overT += dt; if (s.data.overT > 2.5) CM.go(s.data.over === 'win' ? 'win' : 'lose'); }
  },
  ui(s, ctx) {
    const h = s.find('player'); if (!h) return;
    CM.draw.text(ctx, `Gems ${h.props.gems} / ${s.data.gemsTotal}`, 16, 14, { size: 22, color: '#4fd4e6' });
    CM.draw.hearts(ctx, 16, 48, h.props.hp, 3);
    if (s.time < 4) CM.draw.text(ctx, 'Arrows or WASD to move · Space to jump · grab every gem, dodge the crabs', CM.W / 2, CM.H - 40, { size: 16, align: 'center', color: '#ffffff' });
  }
});

CM.scene('win', {
  sky: '#1b2030',
  setup(s) { s.floor({ size: 10, color: '#2b303a', color2: '#333945' }); const g = s.spawn('gem', 0, 0.5, 0); g.props.spin = 1.5; s.camera.look(0, 2, 5); s.camera.lookX = 0; s.camera.lookY = 0.8; s.camera.lookZ = 0; },
  update(s) { if (CM.input.pressed('jump') || CM.input.pressed('action')) CM.go('island'); },
  ui(s, ctx) { CM.draw.text(ctx, 'You got every gem!', CM.W / 2, 60, { size: 40, align: 'center', color: '#4fd4e6' }); CM.draw.text(ctx, 'Press Space to play again', CM.W / 2, 120, { size: 18, align: 'center', color: '#9aa3b2' }); }
});

CM.scene('lose', {
  sky: '#2a1b20',
  setup(s) { s.floor({ size: 10, color: '#3a2a2e', color2: '#44323a' }); s.spawn('crab', 0, 0); s.camera.look(0, 2, 5); s.camera.lookX = 0; s.camera.lookY = 0.5; s.camera.lookZ = 0; },
  update(s) { if (CM.input.pressed('jump') || CM.input.pressed('action')) CM.go('island'); },
  ui(s, ctx) { CM.draw.text(ctx, 'The crabs got you', CM.W / 2, 60, { size: 40, align: 'center', color: '#ff7b72' }); CM.draw.text(ctx, 'Press Space to try again', CM.W / 2, 120, { size: 18, align: 'center', color: '#9aa3b2' }); }
});
