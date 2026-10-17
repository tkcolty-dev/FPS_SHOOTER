# Engine reference

Both engines share one shape: **sprites/models** (how things look) → **entity types** (what things are and do) →
**scenes** (where they live). Scripts in `game.json` run in order, each in its own function scope; share values
between files with `window.X`. Everything is on the `CM` global. Every `CM.sprite / CM.model / CM.entity /
CM.scene` call remembers the file and line that made it, and playtest notes quote it.

Common to both: `CM.input`, `CM.sfx`, `CM.log`, `CM.rand(a,b)`, `CM.pick(arr)`, `CM.clamp(v,a,b)`, `CM.PALETTE`,
`CM.go(scene)`, `CM.time`, `CM.dt`, `CM.paused`, `CM.speed`.

## Input

```js
CM.input.held('left')      // true while held.  Aliases: left right up down jump action action2 pause
CM.input.pressed('jump')   // true on the frame it went down
CM.input.released('jump')
CM.input.axis()            // -1, 0, 1 from left/right        CM.input.axisY()  // up/down
CM.input.held('q')         // any raw key name works too
CM.input.pointer           // { x, y (world, 2D) | x,y,z (ground point, 3D), sx, sy (screen), down, pressed }
```
Arrows and WASD both work; Space / W / Z jump; X / E / Enter / Shift = action; C / Q = action2. Gamepads map
automatically (stick + d-pad, A = jump, B/X = action, Y = action2, Start = pause).

## Saving (per game, in the player's browser)

```js
CM.saveGame({ level: 2, coins: 10, hp: 3 })   // one save slot called 'main'
CM.loadGame()                                 // → the object, or null
CM.hasSave(), CM.deleteSave(), CM.saveInfo()  // info gives { at, data }
CM.saveGame(data, 'slot2'); CM.loadGame('slot2'); CM.listSaves()
CM.save('best', 120); CM.load('best', 0)      // tiny values like a high score
```
Typical: in the first scene's `setup`, `if (CM.hasSave()) show a Continue option`; on a checkpoint or level end,
`CM.saveGame({...})`; `update` → `if (CM.input.pressed('action') && CM.hasSave()) { const s = CM.loadGame(); CM.go(s.level); }`.

## Sound (no files needed)

```js
CM.sfx('jump' | 'coin' | 'hit' | 'explode' | 'shoot' | 'select' | 'win' | 'lose' | 'powerup' | 'step' | 'anything')
CM.tone({ freq: 440, type: 'square', dur: 0.12, slide: -200, vol: 0.3, delay: 0 })
CM.muted = true
```
Any name works with `CM.sfx`. The Sounds tool (and `projects/<id>/sounds.json`) can swap a name for a synth setting
or an uploaded/recorded file: `{ "shoot": { "synth": { "freq": 900, ... } }, "hit": { "file": "sounds/hit.wav" } }`.

---

# 2D engine (`"mode": "2d"`)

Logical size comes from `game.json` (`width`, `height`, default 320×180) and is scaled up pixel-perfect.
Units are pixels, y goes down, gravity in px/s².

## Sprites

```js
CM.sprite('coin', ['.YY.', 'YyyY', 'YyyY', '.YY.'])                   // one frame, letters from CM.PALETTE
CM.sprite('coin', { fps: 6, frames: [rows, rows], palette: { Y: '#ffd93d' } })   // animation + custom colors
```
`.` or space = transparent. Palette letters: `K` black `D` dark gray `L` light gray `W` white `R` red `O` orange
`Y` yellow `G` green `B` blue `C` cyan `P` purple `M` pink `N` brown `S` skin `T` teal `E` light pink; lowercase
`g b r y d w n s` are darker shades. Any other letter must be in your `palette`.

## Entity types

```js
CM.entity('bat', {
  sprite: 'bat',            // or shape: 'rect' | 'circle' with color: '#f00' and w, h
  tags: ['enemy'],          // used by hit handlers, find(), all()
  props: { speed: 60 },     // tunable numbers: show in the Inspector, can be tweaked live
  gravity: false,           // falls? (default: scene.gravityDefault, false)
  solid: false,             // other things collide with it like a wall
  collides: true,           // false = passes through tiles and solids (coins, spikes)
  bounce: 0, friction: 0, layer: 0, scale: 1, keepInBounds: false,
  init(e, s) {},            // once when spawned
  update(e, dt, s) {},      // every frame (60/s)
  draw(e, ctx) {},          // custom drawing instead of the sprite (world space)
  hit: { player(e, other, s) {}, coin(e, o, s) {}, '*'(e, o, s) {} }   // overlaps, by the other's tag or type
});
```
An entity instance `e` has: `id` (`bat#3`), `type`, `name`, `x y w h` (top-left + size), `vx vy`, `cx cy`
(center), `left right top bottom`, `flip`, `alpha`, `visible`, `layer`, `scale`, `sprite`, `frame`, `fps`,
`grounded`, `onWall` (-1/0/1), `age`, `props`, `tags` (Set), `alive`.
Methods: `e.has(tag)`, `e.destroy()`, `e.overlaps(o)`, `e.dist(o)`, `e.jump(v)`, `e.say('Hi!', secs)`
(speech bubble), `e.flash(secs)`, `e.every(secs, key)` (true every N seconds), `e.after(secs, key)` (true once).

## Scenes

```js
CM.scene('level1', {
  bg: '#1b2030', gravity: 900, gravityDefault: false,
  setup(s) {},                 // build the level, spawn things, s.camera.follow(...)
  update(s, dt) {},            // scene logic each frame
  background(s, ctx) {},       // drawn behind tiles (world space, after camera)
  draw(s, ctx) {},             // drawn over entities (world space)
  ui(s, ctx) {}                // HUD, screen space (CM.W × CM.H)
});
```
Scene `s`: `s.spawn(type, x, y, { name, props: {...}, w, h, color, ... })`, `s.find('player')`, `s.all('enemy')`,
`s.each('coin', fn)`, `s.count('coin')`, `s.byId('bat#3')`, `s.data` (your own state; shows in notes), `s.time`,
`s.go('win')`, `s.restart()`, `s.bounds` (from the tilemap), `s.tileAt(x, y)`, `s.solidAt(x, y)`,
`s.setTile(tx, ty, '#')`.

Camera: `s.camera.follow(e, { lerp: 0.12, bounds })`, `s.camera.look(x, y)`, `s.camera.shake(px, secs)`,
`s.camera.zoom`.

Tile maps are text:
```js
s.tiles([
  '....c....',
  '..P...b..',
  '#########'
], { size: 16, legend: {
  '#': { solid: true, sprite: 'grass' },              // or color: '#5b4636', top: '#49c94c'
  '=': { solid: true, oneWay: true, color: '#8a5a2b' }, // jump up through it
  'P': { spawn: 'player' }, 'c': { spawn: 'coin' }, 'b': { spawn: 'bat', props: { speed: 90 } }
}});
```
Spawned letters leave an empty tile (`under: '#'` to keep a tile beneath, `keep: true` to keep the letter).

Top-down helpers (no gravity): `e.moveToward(target, speed)` (chases a thing or `{x, y}`), `e.face(dx, dy)` sets
`e.angle` + flip, `e.angleTo(o)`, `e.forward()`, `e.shoot('arrow', { speed: 220, at: target, angle, spread, offset })`
spawns a projectile from this thing's center (set `rotate: true` on the projectile type to draw it turned),
`e.damage(n, by)` lowers `props.hp` and destroys at 0 (calls the type's `onDie(e, s, by)`), `s.lineClear(x0, y0,
x1, y1)` = no solid tiles between two points. Use `CM.input.axisY()` with `axis()` for 8-way movement.

More scene tools: `s.after(secs, fn)` and `s.every(secs, fn)` timers, `CM.tween(thing, { x: 100, alpha: 0 }, 0.5,
{ ease: 'out' | 'in' | 'inout' | 'bounce' | 'linear', onDone })` (or `e.tween(...)`), `CM.go('win', { fade: 0.6 })`
for a fade transition, `CM.save('best', 10)` / `CM.load('best', 0)` persist per game. Several tile layers:
`s.tiles(rows, { layer: -1, name: 'floor' })` draws under things, `{ over: true }` draws above them, `{ main: true }`
picks which one `s.tilemap` and the level painter use.

Drawing helpers for `ui`/`draw`: `CM.draw.text(ctx, 'SCORE 10', x, y, { size: 8, color, align: 'center' })`,
`CM.draw.bar(ctx, x, y, w, h, pct, { color })`, `CM.draw.hearts(ctx, x, y, n, max)`, `CM.draw.sprite(ctx,
'coin', x, y, { frame, flip, scale })`, `CM.draw.rect(ctx, x, y, w, h, color)`.
Particles: `CM.burst(x, y, { count: 10, color: ['#ffd93d', '#fff'], speed: 80, up: 40, life: 0.5, size: 2 })`.

---

# 3D engine (`"mode": "3d"`)

Three.js under the hood (`window.THREE` is available, `s.three` is the THREE.Scene). Units: a hero is about 1.6
tall. `x` right, `y` up, `z` toward the camera. An entity's `x, z` is the center of its feet and `y` the floor it
stands on. Gravity in units/s² (default 24).

## Models

```js
CM.model('crate', { box: [1, 1, 1], color: 'N' })                 // one primitive: box [w,h,d], sphere r,
                                                                   // cylinder [r, h] or [rTop, rBottom, h], cone [r, h], capsule [r, len]
CM.model('tree', { parts: [                                        // several, positioned by their centers
  { cylinder: [0.2, 1], color: 'n', y: 0.5 },
  { cone: [0.9, 1.6], color: 'g', y: 1.8, rx: 0, ry: 0, rz: 0, scale: 1 }
]});
CM.model('hero', { size: 0.2, voxels: [                            // text voxels: layers bottom → top,
  ['.B.B.', '.B.B.'],                                              // rows back → front, letters left → right
  ['BBBBB', 'BBBBB'],
  ['.YYY.', '.YKY.']
], palette: { B: '#3a7bff' } });
CM.model('custom', { build(THREE) { return new THREE.Mesh(...); } }) // anything Three.js can make
```
Colors: palette letters or any CSS color. Models stand on their origin (bottom center).

## Entity types

Same shape as 2D with `model` instead of `sprite`:
```js
CM.entity('crab', { model: 'crab', tags: ['enemy'], gravity: true, solid: false, static: false,
  keepInBounds: true, collides: true, bounce: 0, props: { speed: 2.5 },
  init(e, s) {}, update(e, dt, s) {}, hit: { player(e, o, s) {} } });
```
`static: true` = never moves (trees, walls). `solid: true` = others bump into it. Instance fields: `x y z`,
`vx vy vz`, `ry` (facing, radians), `w h d`, `scale`, `color` (tints the model), `visible`, `grounded`, `obj`
(the THREE.Group), plus `id type name props tags age alive`.
Methods: `e.face(dx, dz)`, `e.lookAt(other)`, `e.forward()` → `{x, z}`, `e.moveToward(target, speed)`,
`e.dist(o)`, `e.overlaps(o)`, `e.jump(v)`, `e.say(text, secs)`, `e.flash()`, `e.every()`, `e.after()`,
`e.destroy()`, `e.has(tag)`.

## Scenes

```js
CM.scene('island', { sky: '#8fd3ff', fog: 90, gravity: 24,
  setup(s) {
    s.floor({ size: 40, color: '#efe0a8', color2: '#e6d494', y: 0 });  // checkered ground; sets s.bounds
    const hero = s.spawn('hero', 0, 2);            // spawn(type, x, z) on the ground
    s.spawn('gem', 8, 3.1, 12);                    // spawn(type, x, y, z) at a height
    s.spawn('crab', 4, -3, { name: 'Pinchy', props: { speed: 3 } });
    s.block(4, 0, 8, 2, 1, 2, 'D');                // solid box at x,y,z with size w,h,d (a 'block' entity)
    s.camera.follow(hero, { offset: { x: 0, y: 10, z: 12 }, lerp: 0.08, behind: false, lookUp: 0.8 });
  },
  update(s, dt) {}, draw(s) {}, ui(s, ctx) {}      // ui draws on a 2D canvas over the 3D view (CM.W × CM.H)
});
```
`behind: true` makes a chase camera that turns with the target. `s.camera.look(x, y, z)` for a fixed camera
(then set `s.camera.lookX/lookY/lookZ`). `s.camera.shake(units, secs)`. Everything else (`find`, `all`,
`each`, `count`, `byId`, `data`, `go`, `restart`) is the same as 2D.

HUD: `CM.draw.text(ctx, 'Gems 3', x, y, { size: 22, color, align })`, `CM.draw.bar(...)`,
`CM.draw.hearts(ctx, x, y, n, max, { size: 20 })`. Particles: `CM.burst(x, y, z, { count, color, speed, up })`.
Picking: `CM.entityAt(sx, sy)`, `CM.groundAt(sx, sy)`, `CM.project(x, y, z)` → screen point.

---

# Good habits (both)

- Everything visible is an entity so it can be clicked and noted; HUD goes in `ui()`.
- Tunable numbers live in `props`. Names like `speed`, `jump`, `hp` read well in notes.
- `CM.log('boss phase', 2)` for anything a playtester might ask about; it shows in the Log tab and in notes.
- Scenes: `level1` → `win` / `lose` scenes that restart on `CM.input.pressed('jump')`.
- Give important things a `name` (`s.spawn('crab', 4, 3, { name: 'Boss' })`) so notes read "Boss · crab#1".
