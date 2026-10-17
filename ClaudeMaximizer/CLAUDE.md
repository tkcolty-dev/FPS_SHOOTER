# Claude Maximizer

Colton makes games here with you. He plays the game in the browser, clicks on anything that should change, and
leaves a note. Each note captures the exact thing (its id, type, file:line, numbers, a picture) so you never need
a screenshot. Your job: read the notes, change the code, close the notes with a short reply he sees in the app.

## Run it

```
npm start            # http://localhost:4990  (port 4990, serves public/ and projects/)
node tools/notes.js  # open notes, all games (add --project <id> for one)
```

The page hot-reloads a game's scripts the moment you save a file, and refreshes the notes list when
`notes.json` changes. He is usually looking at the page while you work.

## The loop (do this every time he says "check my notes" or similar)

1. `node tools/notes.js` (or read `projects/<id>/NOTES.md`). Each note gives you the entity id, its type, the
   file and line that defined it, its props and position at that moment, the scene and time, the player's state,
   recent log lines and a picture at `projects/<id>/notes/<n>.png` (Read it if the words aren't enough).
2. Make the change in `projects/<id>/scripts/*.js`. Keep tunable numbers in `props` so they show in the Inspector.
3. Close it: `node tools/notes.js done <n> "what you changed" --project <id>`. The reply shows on his note card.
   Use `reply` instead of `done` to ask a question without closing.
4. Don't close notes you didn't actually fix. If a note is unclear, reply with the question and leave it open.

Note kinds you will see:
- **one thing** (e.g. `bat#3`) or **every bat** — the note says which. "applies to EVERY" means change the type's
  definition, not just one spawn.
- **tweaks** — he changed numbers live in the Inspector (e.g. `speed 60 → 30 for every bat`). Make exactly those
  values permanent in the code.
- **spot / area** — a place in the level (2D: world px + tile column/row + the tilemap's file; 3D: ground point) and
  which things were inside.
- **whole game** / **crash** — general feedback, or an error with its stack.

## Built-in tools (so you know what he can do without you)

- **Claude tab**: runs you (the claude CLI, `tools/claude-runner.js`) on the game with "Fix my notes" or a typed
  request. You then follow the loop above. Keep every save valid: the page reloads on each one.
- **Tools → Sprites/Models**: pixel editor that rewrites `CM.sprite(...)` / `CM.model(...)` in place
  (`tools/art-lib.js`). **Level**: paints tiles and spawn letters into the scene's text rows. **Sounds**: swaps a
  `CM.sfx` name for a synth setting or a file in `projects/<id>/sounds.json`. Don't fight these edits; they are his.
- Right-click anything while playing = note. Inspector tweaks arrive as notes with exact numbers.

## Making a game

- `node tools/notes.js new "Name"` (2D pixel art) or `node tools/notes.js new "Name" --3d`. Or he clicks New game.
- A game is `projects/<id>/game.json` (name, mode `2d`|`3d`, start scene, ordered `scripts` list) plus the scripts.
- Scripts are plain browser JS run in order, each in its own function scope (share across files via `window.X`).
  They use the `CM` global. **Read `docs/ENGINE.md` before writing one** — it is the full API for both engines.
- Everything the player can see should be an entity (`CM.entity` + `spawn`), not raw canvas/Three drawing, so it
  can be clicked and noted. HUD text goes in the scene's `ui()`.
- 2D sprites and levels are text art; 3D models are voxel text or simple parts. No image files needed.
- Top-down games: no gravity, `axis()` + `axisY()`, `e.moveToward`, `e.shoot`, `e.damage`, `s.lineClear`. See
  projects/dungeon-dash for a full example (enemies, projectiles, keys/doors, spawner, fades, save).
- Saving: `CM.saveGame(obj)` / `CM.loadGame()` / `CM.hasSave()` for progress, `CM.save/load` for small values.
  Add a Continue option on the title/first scene when a save exists.
- Keep gameplay numbers in `props`. Use `CM.log()` for anything worth seeing in the Log tab.
- After changes, check the Log tab / console for errors: the page shows red toasts for script errors, and
  `CM.logs` holds them. Script errors never stop the loop; a broken entity shows a red dot.

## Layout

- `public/` — the editor: `common.js` (input, sound, log), `engine.js` (2D), `engine3d.js` (3D, Three.js in
  `vendor/`), `editor.js` (notes, inspector, things, log), `app.js` (boot + hot reload), `index.html`, `style.css`.
- `server.js` — static files, notes API, SSE file watcher. `tools/notes-lib.js` — notes storage + NOTES.md writer.
- `projects/<id>/` — one game: `game.json`, `scripts/`, `notes.json` (truth), `NOTES.md` (for you), `notes/*.png`.
- `templates/blank-2d`, `templates/blank-3d` — what New game copies.
- `test/smoke.js` — `npm test`.
