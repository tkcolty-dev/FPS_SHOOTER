# Engine reference

One shape: **sprites** (how things look) → **entity types** (what things are and do) → **scenes** (where they live). Scripts in `game.json` run in order, each in its own function scope; share values
between files with `window.X`. Everything is on the `CM` global. Every `CM.sprite / CM.entity / CM.scene` call remembers the file and line that made it, and playtest notes quote it.

Always available: `CM.input`, `CM.sfx`, `CM.log`, `CM.rand(a,b)`, `CM.pick(arr)`, `CM.clamp(v,a,b)`, `CM.PALETTE`,
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

# The engine

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

# Good habits

- Everything visible is an entity so it can be clicked and noted; HUD goes in `ui()`.
- Tunable numbers live in `props`. Names like `speed`, `jump`, `hp` read well in notes.
- `CM.log('boss phase', 2)` for anything a playtester might ask about; it shows in the Log tab and in notes.
- Scenes: `level1` → `win` / `lose` scenes that restart on `CM.input.pressed('jump')`.
- Give important things a `name` (`s.spawn('crab', 4, 3, { name: 'Boss' })`) so notes read "Boss · crab#1".
