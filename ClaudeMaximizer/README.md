# Claude Maximizer

Make games with Claude without screenshots. Play the game in the browser, click on anything that should change,
and leave a note. Each note captures the exact thing (its id, type, file and line, its numbers, a picture).
Claude reads `NOTES.md`, changes the code, and replies on the note.

```
npm start      →  http://localhost:4990
npm test       →  server + notes checks
```

- **N** or **right-click** anything → write a note. Drag a box to note an area. Flag button = note the whole game.
- **Inspector**: double-click a thing while playing, change its numbers live, then "Save tweaks as a note".
- **Things**: everything in the scene, grouped by type, with the file that defines it.
- **Log**: `CM.log()` output and crashes, with "Note this crash".
- Speed slider, frame step, hitboxes, restart, reload. The page hot-reloads when a script is saved.

- **Claude tab**: Claude Code runs on the game from inside the app. "Fix my notes" or ask for anything; watch it edit.
  Needs the `claude` command on the computer running the server (the cloud copy can only take notes).
- **Tools**: a pixel art editor that saves into the code, a level painter, a Sounds tool (synth, upload, record), and Sketch to draw what you want over the game.

It opens with one game of yours (My Game). Finished examples live in `examples/` (platformer, top-down) for Claude to learn from.
For Claude: see `CLAUDE.md` (the loop) and `docs/ENGINE.md` (the API). Games live in `projects/<id>/`.
