# BlockWorld 3D Studio

Scratch-style block coding for real 3D games. Drag blocks, press ▶, and your objects
move, fall, bounce, collide, animate and cast shadows — then export a single `.html`
you can send to anyone.

```
npm install
npm start          # → http://localhost:4770
```

## Editor
- **Dark studio UI**, Scratch 3-tone blocks (Blockly Zelos renderer), one script workspace per object.
- **3D viewport**: click to select, drag objects across the ground (⇧ = up/down), move/turn/size gizmo,
  right-drag to look around + WASD to fly, scroll to zoom, right-click menu, snap, focus, drop-to-ground.
- **Undo / redo** for everything in the scene (⌘Z / ⇧⌘Z). Scripts have Blockly's own undo.
- **Object tiles** are live 3D thumbnails; the Stage tile is a live render of the scene.
- **Terrain maker**: add a Terrain, then sculpt with Raise / Lower / Smooth / Flatten brushes and paint
  colors on it. Sculpted terrain is saved with the project and drives a real physics heightfield.
- **World settings**: time-of-day sky (sunrise → noon → sunset → stars), space, or flat color; sun,
  ambient, fog, gravity.
- **Objects**: cube, ball, cylinder, cone, capsule, ring, ramp, floor, terrain, point light, spotlight,
  3D text, and models from the Workshop. 15 procedural textures (grass, brick, wood, lava, water…).
- **Smart objects** (already scripted): Player, Coin, Enemy, Moving platform, Ball spawner, Goal, Button, Lamp, Sign.
- **Model Workshop**: free models from trusted sources only (Khronos glTF samples; poly.pizza with
  `POLY_PIZZA_KEY=…`), downloaded and cached by the server; upload your own `.glb/.obj`; upload sounds.
- **Saves**: autosaved draft + named projects in the browser (localStorage) and on the server (`projects/`).
- **Export** (File → Export playable game): one offline `.html` — engine bundled with esbuild, models and
  sounds inlined.

## Blocks
Motion (steps, turn, glide, towards, look at) · Looks (say, color, texture, material, transparency, size,
model animations, text, lights, big text) · Sound (sfx, notes, uploaded files) · Events (flag, key held,
click, touch, broadcast, timer) · Control (wait, loops, if, clones, spawn, stop) · Physics (push, jump,
velocity, mass, bounce, friction, gravity, collisions on/off, explode, on ground?) · Effects (particles,
flash, HUD text, game speed, sky, time of day) · Camera (follow, top-down, first person, offset, fixed,
mouse look, zoom, shake) · Sensing (touching, distance, raycast in front, height above ground, ground height
at x/z, keys, mouse, timer) · Operators · Variables & Lists (with on-screen monitors) · My Blocks
(define / run with argument).

## Layout
`server.js` backend · `public/js/engine.js` renderer/physics/runtime · `public/js/blocks.js` blocks +
generators · `public/js/app.js` editor · `public/js/examples.js` smart objects + examples ·
`public/js/textures.js` procedural textures · `public/js/player.js` exported-game entry.
