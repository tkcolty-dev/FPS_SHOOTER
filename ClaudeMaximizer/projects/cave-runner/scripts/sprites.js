// Sprites are text art. One letter = one pixel. '.' is transparent. Letters come from CM.PALETTE
// (K black, D dark, L light, W white, R red, O orange, Y yellow, G green, B blue, C cyan, P purple, M pink,
// N brown, S skin, T teal; lowercase = darker shade). Add your own colors with a palette object.

CM.sprite('player', {
  fps: 8,
  frames: [
    [
      '..YYYY..',
      '.YYYYYY.',
      '.YKYYKY.',
      '.YYYYYY.',
      '..SSSS..',
      '.BBBBBB.',
      '.BBBBBB.',
      '..B..B..',
      '..B..B..',
      '.KK..KK.'
    ],
    [
      '..YYYY..',
      '.YYYYYY.',
      '.YKYYKY.',
      '.YYYYYY.',
      '..SSSS..',
      '.BBBBBB.',
      '.BBBBBB.',
      '..B..B..',
      '.B....B.',
      'KK....KK'
    ]
  ]
});

CM.sprite('coin', {
  fps: 5,
  frames: [
    ['.YYYY.', 'YYyyYY', 'YyYYyY', 'YyYYyY', 'YYyyYY', '.YYYY.'],
    ['..YY..', '.YyyY.', '.YyyY.', '.YyyY.', '.YyyY.', '..YY..']
  ]
});

CM.sprite('bat', {
  fps: 10,
  frames: [
    ['P........P', 'PP..PP..PP', '.PPPKPKPP.', '..PPPPPP..', '...P..P...'],
    ['..........', '...PPPP...', 'PPPPKPKPPP', 'P..PPPP..P', '...P..P...']
  ]
});

CM.sprite('slime', {
  fps: 4,
  frames: [
    ['..GGGG..', '.GGGGGG.', 'GGKGGKGG', 'GGGGGGGG', 'GGGGGGGG', '.GGGGGG.'],
    ['........', '..GGGG..', '.GGGGGG.', 'GGKGGKGG', 'GGGGGGGG', 'GGGGGGGG']
  ]
});

CM.sprite('spike', [
  '...L....',
  '..LWL...',
  '..LWL...',
  '.LWWWL..',
  '.LWWWL..',
  'LWWWWWL.',
  'LWWWWWL.',
  'DDDDDDDD'
]);

CM.sprite('flag', [
  'LRRRR...',
  'LRRRRRR.',
  'LRRRRRR.',
  'LRRRR...',
  'L.......',
  'L.......',
  'L.......',
  'L.......',
  'L.......',
  'L.......',
  'L.......',
  'DDD.....'
]);

CM.sprite('rock', [
  'DDDDLDDDDDDDDDDL',
  'DLDDDDDDLDDDDDDD',
  'DDDDDDDDDDDDDLDD',
  'DDDLDDDDDDDDDDDD',
  'DDDDDDDLDDDDDDDD',
  'DDDDDDDDDDDLDDDD',
  'DLDDDDDDDDDDDDDD',
  'DDDDDDDDDDDDDDLD',
  'DDDDLDDDDDDDDDDD',
  'DDDDDDDDDLDDDDDD',
  'DDLDDDDDDDDDDDDD',
  'DDDDDDDDDDDDLDDD',
  'DDDDDDLDDDDDDDDD',
  'DLDDDDDDDDDDDDDD',
  'DDDDDDDDDLDDDDDD',
  'DDDDLDDDDDDDDDLD'
]);

CM.sprite('grass', [
  'GGgGGGGgGGGGGgGG',
  'gGGGgGGGGGgGGGGg',
  'NnNNNNnNNNNNNnNN',
  'NNNNnNNNNnNNNNNN',
  'NNnNNNNNNNNNnNNN',
  'NNNNNNnNNNNNNNNN',
  'NnNNNNNNNnNNNNNN',
  'NNNNnNNNNNNNnNNN',
  'NNNNNNNNnNNNNNNN',
  'NnNNNNNNNNNNNNnN',
  'NNNNNnNNNNnNNNNN',
  'NNNNNNNNNNNNNNNN',
  'NNnNNNNNnNNNNnNN',
  'NNNNNNNNNNNNNNNN',
  'NNNNnNNNNNNnNNNN',
  'NNNNNNNNNNNNNNNN'
]);

CM.sprite('plank', [
  'ssssssssssssssss',
  'NNNNNNNNNNNNNNNN',
  'nNnnnnnnNnnnnnnN'
]);
