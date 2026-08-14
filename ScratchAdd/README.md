# Scratch+ Studio

A multi-user, Scratch-style game studio that runs in the browser. Build together live,
upload your own images and sounds, draw costumes, use one-click recipes — then export a
real `.sb3` file and upload it to [scratch.mit.edu](https://scratch.mit.edu) as a normal
Scratch project.

## Start it

```
npm start          # or double-click start.command
```

Open **http://localhost:4900**. Anyone else on your wifi can join at
`http://<your-computer-ip>:4900` and edit the same project with you, live.

## What it does

- **Same coding as Scratch** — motion, looks, sound, events, control, sensing, operators,
  and variables blocks, with the exact Scratch shapes and colors (Blockly Zelos renderer).
- **Multi-user** — everyone sees sprite changes, block edits, and green-flag runs live.
  Colored dots show who's editing which sprite.
- **Upload files** — drop in PNG/JPG/SVG images as costumes and WAV/MP3 sounds.
- **Design help** — 🎨 Paint editor (brush, shapes, fill, undo) and a ✨ random creature
  generator for instant sprites. ✨ Recipes add ready-made scripts: arrow-key movement,
  bounce, chase the mouse, clicker scoring, jumping, wandering.
- **Fast runtime** — projects run on a 60 fps canvas with say bubbles, variable monitors,
  key/click events, broadcasts, collisions, glide, sounds, and ask-and-wait.
- **Export to Scratch** — the ⬇ button downloads a `.sb3`. On scratch.mit.edu:
  Create → File → Load from your computer → pick the file. Everything opens as native
  Scratch blocks.

## Files

- `server.js` — Express + WebSocket server; project state, asset uploads (port 4900)
- `public/blocks.js` — block definitions (types are real Scratch opcodes)
- `public/runtime.js` — the interpreter + stage renderer
- `public/export.js` — `.sb3` builder
- `public/paint.js` — paint editor + creature generator
- `public/app.js` — editor UI, live sync, recipes
- `data/project.json`, `assets/` — the saved project and uploaded files (auto-created)
