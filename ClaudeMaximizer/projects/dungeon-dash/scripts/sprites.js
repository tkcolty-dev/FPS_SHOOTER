// Top-down dungeon art. Sprites face right; the engine flips them when things move left.

CM.sprite('knight', {
  fps: 8,
  frames: [
    ['..LLLL..', '.LLLLLL.', '.LKLLKL.', '.LLLLLL.', '..BBBB..', '.BBBBBB.', 'LBBBBBBL', '..B..B..', '..D..D..'],
    ['..LLLL..', '.LLLLLL.', '.LKLLKL.', '.LLLLLL.', '..BBBB..', '.BBBBBB.', 'LBBBBBBL', '.B....B.', '.D....D.']
  ]
});
CM.sprite('arrow', ['NNNNNNLL', '......LL']);
CM.sprite('slime', {
  fps: 4,
  frames: [
    ['..GGGG..', '.GGGGGG.', 'GGKGGKGG', 'GGGGGGGG', '.GGGGGG.'],
    ['........', '..GGGG..', '.GGGGGG.', 'GGKGGKGG', 'GGGGGGGG']
  ]
});
CM.sprite('skeleton', {
  fps: 6,
  frames: [
    ['..WWWW..', '.WKWWKW.', '.WWWWWW.', '..WWWW..', '.WWWWWW.', 'W.WWWW.W', '..W..W..', '..W..W..'],
    ['..WWWW..', '.WKWWKW.', '.WWWWWW.', '..WWWW..', '.WWWWWW.', 'W.WWWW.W', '.W....W.', '.W....W.']
  ]
});
CM.sprite('bone', ['W....W', '.WWWW.', 'W....W']);
CM.sprite('bat', { fps: 10, frames: [['P..PP..P', 'PPPKKPPP', '..PPPP..'], ['........', 'P..PP..P', 'PPPKKPPP']] });
CM.sprite('chest', ['.NNNNNN.', 'NnnnnnnN', 'NnYYYYnN', 'NNNNNNNN', 'NnnYYnnN', 'NNNNNNNN']);
CM.sprite('key', ['.YY.....', 'Y..YYYYY', 'Y..Y.Y.Y', '.YY....Y']);
CM.sprite('door', ['NNNNNNNN', 'NnnnnnnN', 'NnNNNNnN', 'NnNYYNnN', 'NnNNNNnN', 'NnnnnnnN', 'NNNNNNNN', 'NNNNNNNN']);
CM.sprite('potion', ['..WW..', '..WW..', '.RRRR.', 'RRRRRR', 'RRRRRR', '.RRRR.']);
CM.sprite('portal', { fps: 6, frames: [['.PPPP.', 'PMMMMP', 'PM..MP', 'PM..MP', 'PMMMMP', '.PPPP.'], ['.MMMM.', 'MPPPPM', 'MP..PM', 'MP..PM', 'MPPPPM', '.MMMM.']] });
CM.sprite('stairs', ['DDDDDDDD', 'DLLLLLLD', 'DLDDDDLD', 'DLDLLDLD', 'DLDDDDLD', 'DLLLLLLD', 'DDDDDDDD', 'DDDDDDDD']);
CM.sprite('coin', { fps: 5, frames: [['.YYYY.', 'YYyyYY', 'YyYYyY', 'YyYYyY', 'YYyyYY', '.YYYY.'], ['..YY..', '.YyyY.', '.YyyY.', '.YyyY.', '.YyyY.', '..YY..']] });

CM.sprite('wall', [
  'DDDDDDDLDDDDDDDL',
  'DdddddDLDdddddDL',
  'DdddddDLDdddddDL',
  'DDDDDDDLDDDDDDDL',
  'LLLLLLLLLLLLLLLL',
  'DDDLDDDDDDDLDDDD',
  'DddLDdddddDLDddD',
  'DddLDdddddDLDddD',
  'DDDLDDDDDDDLDDDD',
  'LLLLLLLLLLLLLLLL',
  'DDDDDDDLDDDDDDDL',
  'DdddddDLDdddddDL',
  'DdddddDLDdddddDL',
  'DDDDDDDLDDDDDDDL',
  'LLLLLLLLLLLLLLLL',
  'DDDLDDDDDDDLDDDD'
]);
CM.sprite('floor', {
  palette: { f: '#2f2a3a', e: '#352f42' },
  frames: [[
    'ffffffffffffffff', 'feeeeeeeffeeeeef', 'feffffffffffffef', 'feffffffffffffef', 'feffffffffffffef', 'feffffffffffffef', 'feffffffffffffef', 'ffffffffffffffff',
    'ffffffffffffffff', 'feeeeeeeffeeeeef', 'feffffffffffffef', 'feffffffffffffef', 'feffffffffffffef', 'feffffffffffffef', 'feffffffffffffef', 'ffffffffffffffff'
  ]]
});
