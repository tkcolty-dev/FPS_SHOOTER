// A dungeon drawn as text: # walls, . floor. Letters place things. Two layers: the floor pattern underneath,
// the walls and things on top.
const G = window.G;

const LEGEND = {
  '#': { solid: true, sprite: 'wall' },
  'P': { spawn: 'knight' }, 's': { spawn: 'slime' }, 'k': { spawn: 'skeleton' }, 'b': { spawn: 'bat' }, 'O': { spawn: 'portal' },
  'c': { spawn: 'coin' }, 'K': { spawn: 'key' }, 'h': { spawn: 'potion' }, 'C': { spawn: 'chest' }, 'D': { spawn: 'door', under: '.' }, 'E': { spawn: 'stairs' }
};

const DUNGEON = [
  '##########################################',
  '#........#.......c.c.....#...............#',
  '#..P.....#.......c.c.....#......s........#',
  '#........D......s.......b#...............#',
  '#........#...............D.....k.....C...#',
  '#....c...#.......###.....#...............#',
  '#........#.......#K#.....#...............#',
  '####.#####.......###.....###########.#####',
  '#........#...............#...............#',
  '#..h.....#......k........#....O..........#',
  '#........#...............#...............#',
  '#........#......####.....D......c.c......#',
  '#..s.....D......#..#.....#......c.c......#',
  '#........#......#E.#.....#...............#',
  '#........#......#..#.....#..........h....#',
  '##########################################'
];
const FLOOR = DUNGEON.map(r => r.replace(/[^#]/g, 'f'));

CM.scene('dungeon', {
  bg: '#141019',
  setup(s) {
    G.score = 0;
    s.tiles(FLOOR, { size: 16, legend: { 'f': { sprite: 'floor' } }, layer: -1, name: 'floor' });
    s.tiles(DUNGEON, { size: 16, legend: LEGEND, main: true, name: 'walls' });
    s.camera.follow(s.find('player'), { lerp: 0.12 });
    s.data.over = null;
    s.find('player').say('Find the stairs', 2.5);
  },
  ui(s, ctx) {
    const p = s.find('player'); if (!p) return;
    CM.draw.bar(ctx, 6, 6, 60, 8, p.props.hp / p.props.maxHp, { color: p.props.hp > 1 ? '#49c94c' : '#e23d3d' });
    CM.draw.text(ctx, 'SCORE ' + G.score, 72, 6, { size: 7 });
    CM.draw.text(ctx, 'KEYS ' + p.props.keys, CM.W - 6, 6, { size: 7, align: 'right', color: '#ffd93d' });
    if (s.time < 4) CM.draw.text(ctx, 'ARROWS MOVE · X SHOOTS', CM.W / 2, CM.H - 14, { size: 7, align: 'center', color: '#9aa3b2' });
  }
});

CM.scene('win', {
  bg: '#141019',
  update(s) { if (CM.input.pressed('jump') || CM.input.pressed('action')) CM.go('dungeon', { fade: 0.5 }); },
  ui(s, ctx) {
    CM.draw.text(ctx, 'YOU ESCAPED!', CM.W / 2, 50, { size: 14, align: 'center', color: '#ffd93d' });
    CM.draw.text(ctx, 'SCORE ' + G.score + '   BEST ' + G.best, CM.W / 2, 85, { size: 8, align: 'center' });
    CM.draw.text(ctx, 'PRESS X TO GO AGAIN', CM.W / 2, 120, { size: 7, align: 'center', color: '#9aa3b2' });
  }
});
CM.scene('lose', {
  bg: '#2a1b20',
  update(s) { if (CM.input.pressed('jump') || CM.input.pressed('action')) CM.go('dungeon', { fade: 0.5 }); },
  ui(s, ctx) {
    CM.draw.text(ctx, 'THE DUNGEON WINS', CM.W / 2, 50, { size: 12, align: 'center', color: '#ff7b72' });
    CM.draw.text(ctx, 'SCORE ' + G.score, CM.W / 2, 85, { size: 8, align: 'center' });
    CM.draw.text(ctx, 'PRESS X TO TRY AGAIN', CM.W / 2, 120, { size: 7, align: 'center', color: '#9aa3b2' });
  }
});
