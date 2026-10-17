// Levels are text too. Each character is one 16px tile; the legend says what each letter means.
// Letters with "spawn" put an entity there (and leave the tile empty underneath it).
const G = window.G; // shared score, made in entities.js (each script file has its own scope; share through window)
const LEGEND = {
  '#': { solid: true, sprite: 'grass' },
  'X': { solid: true, sprite: 'rock' },
  '=': { solid: true, oneWay: true, sprite: 'plank' },
  'P': { spawn: 'player' },
  'c': { spawn: 'coin' },
  'b': { spawn: 'bat' },
  's': { spawn: 'slime' },
  '^': { spawn: 'spike' },
  'F': { spawn: 'flag' }
};

const LEVEL1 = [
  '............................................................',
  '............................................................',
  '............................................................',
  '.............ccc..............b.............ccc.............',
  '............=====..........................=====............',
  '.........c.........c..c.........ccc...................c.c...',
  '..P.....====......=====........=====..........b......====.F.',
  '..................................................s......XX.',
  '#######..s..####..^^^..####..s.####...####^^^#####......XXX.',
  '#######.#######..#####.####.######...#####.######.......XXX.',
  '#######.#######..#####.####.######...#####.######.......XXXX',
  '#######.#######..#####.####.######...#####.######.......XXXX'
];

CM.scene('level1', {
  bg: '#1b2030', gravity: 900,
  setup(s) {
    G.score = 0;
    s.tiles(LEVEL1, { size: 16, legend: LEGEND });
    s.camera.follow(s.find('player'), { lerp: 0.15 });
    s.data.over = null;
  },
  update(s, dt) {
    if (s.data.over) { s.data.overT += dt; if (s.data.overT > 2.2) CM.go(s.data.over === 'win' ? 'win' : 'lose'); }
  },
  background(s, ctx) {
    // far cave wall that scrolls slower than the level
    const cx = s.camera.x * 0.4;
    ctx.fillStyle = '#242b3f';
    for (let i = -1; i < 12; i++) { const x = i * 90 - (cx % 90); ctx.fillRect(x, 40 + (i % 3) * 18, 60, 200); }
    ctx.fillStyle = '#20263a';
    for (let i = -1; i < 12; i++) { const x = i * 70 - ((s.camera.x * 0.6) % 70); ctx.fillRect(x + 20, 80 + (i % 2) * 24, 40, 200); }
  },
  ui(s, ctx) {
    const p = s.find('player');
    CM.draw.text(ctx, 'SCORE ' + G.score, 6, 6, { size: 8 });
    if (p) CM.draw.hearts(ctx, 6, 18, p.props.hp, 3);
    if (p) CM.draw.text(ctx, 'x' + p.props.coins, CM.W - 6, 6, { size: 8, align: 'right', color: '#ffd93d' });
    if (s.time < 3) CM.draw.text(ctx, 'ARROWS MOVE  SPACE JUMPS', CM.W / 2, CM.H - 16, { size: 7, align: 'center', color: '#9aa3b2' });
  }
});

CM.scene('win', {
  bg: '#1b2030',
  update(s) { if (CM.input.pressed('jump') || CM.input.pressed('action')) CM.go('level1'); },
  ui(s, ctx) {
    CM.draw.text(ctx, 'YOU MADE IT!', CM.W / 2, 50, { size: 14, align: 'center', color: '#ffd93d' });
    CM.draw.text(ctx, 'SCORE ' + G.score + '   BEST ' + G.best, CM.W / 2, 85, { size: 8, align: 'center' });
    CM.draw.text(ctx, 'PRESS SPACE TO PLAY AGAIN', CM.W / 2, 120, { size: 7, align: 'center', color: '#9aa3b2' });
  }
});

CM.scene('lose', {
  bg: '#2a1b20',
  update(s) { if (CM.input.pressed('jump') || CM.input.pressed('action')) CM.go('level1'); },
  ui(s, ctx) {
    CM.draw.text(ctx, 'OUCH', CM.W / 2, 50, { size: 16, align: 'center', color: '#ff7b72' });
    CM.draw.text(ctx, 'SCORE ' + G.score, CM.W / 2, 85, { size: 8, align: 'center' });
    CM.draw.text(ctx, 'PRESS SPACE TO TRY AGAIN', CM.W / 2, 120, { size: 7, align: 'center', color: '#9aa3b2' });
  }
});
