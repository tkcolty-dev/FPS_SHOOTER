// Slime Siege — art. Every sprite is text: one letter per pixel, '.' is see-through.
// Letters come from CM.PALETTE (K black, D dark, L light, W white, R red, O orange, Y yellow, G green, B blue,
// C cyan, P purple, M pink, N brown, S skin, T teal; lowercase = darker). Draw new ones in Tools → Sprites.

CM.sprite('hero', {
  fps: 8,
  frames: [
    ['..SSSS..', '.SSSSSS.', '.SKSSKS.', '.SSSSSS.', '..CCCC..', '.CCCCCC.', 'SCCCCCCS', '..C..C..', '..B..B..'],
    ['..SSSS..', '.SSSSSS.', '.SKSSKS.', '.SSSSSS.', '..CCCC..', '.CCCCCC.', 'SCCCCCCS', '.C....C.', '.B....B.']
  ]
});
CM.sprite('bullet', ['CWWC', 'CWWC']);
CM.sprite('spit', ['.G.', 'GgG', '.G.']);

CM.sprite('slime', {
  fps: 4,
  frames: [
    ['..GGGG..', '.GGGGGG.', 'GGKGGKGG', 'GGGGGGGG', '.GGGGGG.'],
    ['........', '..GGGG..', '.GGGGGG.', 'GGKGGKGG', 'GGGGGGGG']
  ]
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
    ['..gggg..', '.gGGGGg.', 'gGKGGKGg', 'gGGggGGg', '.gGGGGg.', '..g..g..'],
    ['..gggg..', '.gGGGGg.', 'gGKGGKGg', 'gGgGGgGg', '.gGGGGg.', '..g..g..']
  ]
});
CM.sprite('tank', {
  fps: 2,
  frames: [
    ['...TTTTTT...', '.TTTTTTTTTT.', 'TTTKTTTTKTTT', 'TTTTTTTTTTTT', 'TTTTTTTTTTTT', 'TTTTTTTTTTTT', '.TTTTTTTTTT.', '..TT.TT.TT..'],
    ['...TTTTTT...', '.TTTTTTTTTT.', 'TTTKTTTTKTTT', 'TTTTTTTTTTTT', 'TTTTTTTTTTTT', 'TTTTTTTTTTTT', '.TTTTTTTTTT.', '.TT..TT..TT.']
  ]
});
CM.sprite('boss', {
  fps: 3,
  frames: [
    ['.....PPPPPP.....', '...PPPPPPPPPP...', '..PPPPPPPPPPPP..', '.PPPKKPPPPKKPPP.', '.PPPKKPPPPKKPPP.', 'PPPPPPPPPPPPPPPP', 'PPPPPRRRRRRPPPPP', 'PPPPPPWWWWPPPPPP', 'PPPPPPPPPPPPPPPP', '.PPPPPPPPPPPPPP.', '..PPPPPPPPPPPP..', '...PP.PPPP.PP...'],
    ['.....PPPPPP.....', '...PPPPPPPPPP...', '..PPPPPPPPPPPP..', '.PPPKKPPPPKKPPP.', '.PPPKKPPPPKKPPP.', 'PPPPPPPPPPPPPPPP', 'PPPPPRRRRRRPPPPP', 'PPPPPWWWWWWPPPPP', 'PPPPPPPPPPPPPPPP', '.PPPPPPPPPPPPPP.', '..PPPPPPPPPPPP..', '..PP.PP..PP.PP..']
  ]
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
