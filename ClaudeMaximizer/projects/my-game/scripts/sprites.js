// Slime Siege — art. Every sprite is text: one letter per pixel, '.' is see-through.
// Letters come from CM.PALETTE (K black, D dark, L light, W white, R red, O orange, Y yellow, G green, B blue,
// C cyan, P purple, M pink, N brown, S skin, T teal; lowercase = darker). Draw new ones in Tools → Sprites.

// The hero: armored space ranger with a visor, cape and blaster. 'x' is the soft shadow under the feet.
const HERO_PAL = { x: 'rgba(0,0,0,0.3)', v: '#7cf0ff' };
const HERO_TOP = [
  '...LLLLL....',
  '..LWLLLLL...',
  '..LCvCCCL...',
  '..LCCCCCL...',
  '..LLLLLLL...',
  '.rBBBBBBBr..',
  'rRBBYBBBBDDD',
  'rRBBBBBBBDDK',
  'rR.BBBBBB...',
  '.R.bYbbbb...'
];
CM.sprite('hero-idle', { palette: HERO_PAL, frames: [[...HERO_TOP, '...BB..BB...', '...BB..BB...', '..KKK.KKK...', '.xxxxxxxxx..']] });
CM.sprite('hero', {
  fps: 9, palette: HERO_PAL,
  frames: [
    [...HERO_TOP, '...BB..BB...', '..BB....BB..', '.KKK....KKK.', '.xxxxxxxxx..'],
    [...HERO_TOP, '....BBBB....', '....BBBB....', '...KKKKK....', '.xxxxxxxxx..']
  ]
});
CM.sprite('bullet', ['CWWC', 'CWWC']);
CM.sprite('spit', ['.G.', 'GgG', '.G.']);

CM.sprite('slime', {
  fps: 4,
  frames: [
    ['..GGGG..', '.GWGGGG.', 'GGKGGKGG', 'GGGGGGGG', '.gGGGGg.', 'xxxxxxxx'],
    ['........', '..GGGG..', '.GWGGGG.', 'GGKGGKGG', 'gGGGGGGg', 'xxxxxxxx']
  ],
  palette: { x: 'rgba(0,0,0,0.3)' }
});
CM.sprite('bat', {
  fps: 10,
  frames: [
    ['P..PP..P', 'PPPKKPPP', '..PPPP..'],
    ['........', 'P..PP..P', 'PPPKKPPP']
  ]
});
CM.sprite('spitter', {
  fps: 3,
  frames: [
    ['..gggg..', '.gGGGGg.', 'gGKGGKGg', 'gGGggGGg', '.gGGGGg.', '..g..g..', 'xxxxxxxx'],
    ['..gggg..', '.gGGGGg.', 'gGKGGKGg', 'gGgGGgGg', '.gGGGGg.', '..g..g..', 'xxxxxxxx']
  ],
  palette: { x: 'rgba(0,0,0,0.3)' }
});
CM.sprite('tank', {
  fps: 2,
  frames: [
    ['...TTTTTT...', '.TTTTTTTTTT.', 'TTTKTTTTKTTT', 'TTTTTTTTTTTT', 'TTTTTTTTTTTT', 'TTTTTTTTTTTT', '.TTTTTTTTTT.', '..TT.TT.TT..', 'xxxxxxxxxxxx'],
    ['...TTTTTT...', '.TTTTTTTTTT.', 'TTTKTTTTKTTT', 'TTTTTTTTTTTT', 'TTTTTTTTTTTT', 'TTTTTTTTTTTT', '.TTTTTTTTTT.', '.TT..TT..TT.', 'xxxxxxxxxxxx']
  ],
  palette: { x: 'rgba(0,0,0,0.3)' }
});
CM.sprite('boss', {
  fps: 3,
  frames: [
    ['.....PPPPPP.....', '...PPPPPPPPPP...', '..PPPPPPPPPPPP..', '.PPPKKPPPPKKPPP.', '.PPPKKPPPPKKPPP.', 'PPPPPPPPPPPPPPPP', 'PPPPPRRRRRRPPPPP', 'PPPPPPWWWWPPPPPP', 'PPPPPPPPPPPPPPPP', '.PPPPPPPPPPPPPP.', '..PPPPPPPPPPPP..', '...PP.PPPP.PP...', '.xxxxxxxxxxxxxx.'],
    ['.....PPPPPP.....', '...PPPPPPPPPP...', '..PPPPPPPPPPPP..', '.PPPKKPPPPKKPPP.', '.PPPKKPPPPKKPPP.', 'PPPPPPPPPPPPPPPP', 'PPPPPRRRRRRPPPPP', 'PPPPPWWWWWWPPPPP', 'PPPPPPPPPPPPPPPP', '.PPPPPPPPPPPPPP.', '..PPPPPPPPPPPP..', '..PP.PP..PP.PP..', '.xxxxxxxxxxxxxx.']
  ],
  palette: { x: 'rgba(0,0,0,0.3)' }
});
CM.sprite('gem', { fps: 4, frames: [['.C.', 'CWC', '.C.'], ['.C.', 'CCC', '.C.']] });
CM.sprite('heart', ['.R.R.', 'RRRRR', 'RRRRR', '.RRR.', '..R..']);

CM.sprite('wall', [
  'DDDDDDDLDDDDDDDL', 'DdddddDLDdddddDL', 'DdddddDLDdddddDL', 'DDDDDDDLDDDDDDDL', 'LLLLLLLLLLLLLLLL', 'DDDLDDDDDDDLDDDD', 'DddLDdddddDLDddD', 'DddLDdddddDLDddD',
  'DDDLDDDDDDDLDDDD', 'LLLLLLLLLLLLLLLL', 'DDDDDDDLDDDDDDDL', 'DdddddDLDdddddDL', 'DdddddDLDdddddDL', 'DDDDDDDLDDDDDDDL', 'LLLLLLLLLLLLLLLL', 'DDDLDDDDDDDLDDDD'
]);
CM.sprite('rock', [
  '.....DDDDDD.....', '...DDDLLDDDDD...', '..DDLLDDDDDDDD..', '.DDLDDDDDDDDDDD.', '.DDDDDDDDDDDDDD.', 'DDDDDDDDDDDDLDDD', 'DDDDDDDDDDDDDDDD', 'DDDDDDDDDDDDDDDD',
  'DDDDDDDDDDDDDDDD', 'DDDDDDDDDDDDDDDD', '.DDDDDDDDDDDDDD.', '.DDDDDDDDDDDDDD.', '..DDDDDDDDDDDD..', '...DDDDDDDDDD...', '.....DDDDDD.....', '................'
]);
CM.sprite('floor', {
  palette: { f: '#2a3340', e: '#2f3a48' },
  frames: [[
    'ffffffffffffffff', 'feffffffffffffff', 'ffffffffffeeffff', 'ffffffffffffffff', 'ffffeffffffffffff'.slice(0, 16), 'ffffffffffffffff', 'ffffffffffffffef', 'ffffffffffffffff',
    'ffffffffffffffff', 'fffffffeffffffff', 'ffffffffffffffff', 'feeffffffffffeff', 'ffffffffffffffff', 'ffffffffffffffff', 'ffffffeffffffffff'.slice(0, 16), 'ffffffffffffffff'
  ]]
});

// upgrade icons for the level-up cards (8×8)
CM.sprite('up-dmg', ['...WW...', '..WWWW..', '...WW...', '...WW...', '...WW...', '..RRRR..', '...NN...', '...NN...']);
CM.sprite('up-rate', ['..YYYY..', '.Y....Y.', 'Y..Y...Y', 'Y..YYY.Y', 'Y......Y', 'Y......Y', '.Y....Y.', '..YYYY..']);
CM.sprite('up-speed', ['....Y...', '...YY...', '..YYY...', '.YYYYYY.', '...YYY..', '...YY...', '...Y....', '........']);
CM.sprite('up-hp', ['.RR..RR.', 'RRRRRRRR', 'RRWRRRRR', 'RRRRRRRR', '.RRRRRR.', '..RRRR..', '...RR...', '........']);
CM.sprite('up-multi', ['C......C', '.C....C.', '..C..C..', 'CCCCCCCC', '..C..C..', '.C....C.', 'C......C', '........']);
CM.sprite('up-range', ['...CC...', '..C..C..', '.C.CC.C.', 'C.C..C.C', 'C.C..C.C', '.C.CC.C.', '..C..C..', '...CC...']);
CM.sprite('up-magnet', ['RR....BB', 'RR....BB', 'RR....BB', 'RR....BB', 'RR....BB', '.RR..BB.', '..LLLL..', '........']);
CM.sprite('up-heal', ['...GG...', '...GG...', '.GGGGGG.', '.GGGGGG.', '...GG...', '...GG...', '........', '........']);
