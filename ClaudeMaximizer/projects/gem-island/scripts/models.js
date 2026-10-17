// 3D models are built from text voxels (like sprites, stacked in layers) or simple parts (box, sphere,
// cylinder, cone, capsule). Colors use the same letters as 2D sprites (CM.PALETTE) or any CSS color.
// A model's origin is the center of its feet, so y is where it stands.

// Voxel layers go bottom → top. In each layer, rows go back → front and characters go left → right.
CM.model('hero', {
  size: 0.18,
  voxels: [
    ['.B...B.', '.B...B.'],            // feet
    ['.B...B.', '.B...B.'],
    ['BBBBBBB', 'BBBBBBB'],            // body
    ['BBBBBBB', 'BBBBBBB'],
    ['SBBBBBS', 'SBBBBBS'],            // arms
    ['.SSSSS.', '.SSSSS.'],            // neck
    ['.YYYYY.', '.YKYKY.', '.YYYYY.'], // head, eyes facing front (last row)
    ['.YYYYY.', '.YYYYY.', '.YYYYY.'],
    ['..YYY..', '..YYY..', '..YYY..']
  ]
});

CM.model('gem', {
  parts: [
    { cone: [0.32, 0.4], color: 'C', y: 0.6 },
    { cone: [0.32, 0.4], color: 'C', y: 0.2, rx: Math.PI }
  ]
});

CM.model('crab', {
  parts: [
    { box: [0.9, 0.4, 0.6], color: 'R', y: 0.35 },
    { sphere: 0.1, color: 'W', x: -0.22, y: 0.62, z: 0.25 },
    { sphere: 0.1, color: 'W', x: 0.22, y: 0.62, z: 0.25 },
    { sphere: 0.05, color: 'K', x: -0.22, y: 0.62, z: 0.34 },
    { sphere: 0.05, color: 'K', x: 0.22, y: 0.62, z: 0.34 },
    { box: [0.25, 0.2, 0.3], color: 'r', x: -0.55, y: 0.3, z: 0.2 },
    { box: [0.25, 0.2, 0.3], color: 'r', x: 0.55, y: 0.3, z: 0.2 },
    { cylinder: [0.04, 0.3], color: 'r', x: -0.3, y: 0.15, z: -0.2 },
    { cylinder: [0.04, 0.3], color: 'r', x: 0.3, y: 0.15, z: -0.2 },
    { cylinder: [0.04, 0.3], color: 'r', x: -0.4, y: 0.15, z: 0 },
    { cylinder: [0.04, 0.3], color: 'r', x: 0.4, y: 0.15, z: 0 }
  ]
});

CM.model('palm', {
  parts: [
    { cylinder: [0.18, 0.25, 3], color: 'N', y: 1.5 },
    { box: [2.4, 0.12, 0.5], color: 'G', y: 3.05, rz: 0.25 },
    { box: [2.4, 0.12, 0.5], color: 'g', y: 3.05, ry: Math.PI / 2, rz: -0.25 },
    { box: [2.4, 0.12, 0.5], color: 'G', y: 3.1, ry: Math.PI / 4, rz: 0.2 },
    { box: [2.4, 0.12, 0.5], color: 'g', y: 3.1, ry: -Math.PI / 4, rz: -0.2 },
    { sphere: 0.18, color: 'N', y: 2.95, x: 0.2 },
    { sphere: 0.18, color: 'N', y: 2.95, x: -0.15, z: 0.2 }
  ]
});

CM.model('rock', { parts: [{ sphere: 0.7, color: 'D', y: 0.4, scale: 1 }, { sphere: 0.45, color: 'L', x: 0.4, y: 0.35, z: 0.3 }] });

CM.model('flag', {
  parts: [
    { cylinder: [0.05, 2.2], color: 'L', y: 1.1 },
    { box: [0.9, 0.5, 0.04], color: 'R', x: 0.45, y: 1.9 }
  ]
});
