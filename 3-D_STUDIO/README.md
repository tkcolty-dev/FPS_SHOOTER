# BlockWorld 3D Studio

Scratch-style block coding for real 3D games. Drag blocks, press ▶, and your
objects move, fall, bounce, collide, animate and cast soft shadows.

```
npm install
npm start          # → http://localhost:4770
```

## What's inside
- **Editor** (`public/`) — Blockly (Zelos renderer = Scratch-look blocks), one script
  workspace per object, 3D viewport with move/rotate/scale gizmo, object tiles, an
  Object settings tab and a Stage tab (sky, gravity, sun, fog).
- **Engine** (`public/js/engine.js`) — Three.js renderer (shadow maps, ACES tone
  mapping, fog) + cannon-es rigid-body physics + a Scratch-like green-thread runtime.
  Every hat block becomes a generator function; loops yield once per frame so all
  scripts run in parallel exactly like Scratch.
- **Blocks** (`public/js/blocks.js`) — Motion (x/y/z, turn, glide, point towards),
  Looks (say, color, material, transparency, size, model animations, big text),
  Sound (synth sfx + notes), Events (flag, key held, click, touch, broadcast),
  Control (wait/repeat/forever/if/clones/stop), Physics (push, jump, velocity,
  mass, bounciness, friction, gravity, on ground?), Camera (follow / top-down /
  first-person / offset / fixed / mouse look / zoom / shake), Sensing, Operators,
  Variables (with on-screen monitors).
- **Backend** (`server.js`) — Express. Saves projects to `projects/`, runs the
  **Model Workshop**: downloads models only from trusted hosts (Khronos glTF sample
  assets, optionally poly.pizza with `POLY_PIZZA_KEY=…`), caches them in
  `cache/models/`, accepts your own `.glb/.gltf/.obj` uploads, and **exports** a
  finished game as a single offline `.html` (engine bundled with esbuild, models
  inlined as data URLs).

## Keys in the editor
`W` move · `E` rotate · `R` scale · `F` focus · `Del` delete · `⌘D` duplicate · `⌘S` save
Left-drag orbits, right-drag pans, scroll zooms.

## Examples
File → Examples: **Coin Collector** (clones, variables, touch events),
**Bouncy Balls** (physics + random colors), **Dodge the Blocks** (spawner + game over).
