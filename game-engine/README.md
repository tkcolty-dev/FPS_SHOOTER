# ⚡ Spark

A web game engine that looks and codes exactly like Scratch 3.0 (it uses the real
`scratch-blocks` library) with a lot more built in: physics, a scrolling camera,
particles, score/lives/health HUD, game controllers, speech, a paint editor,
synth sounds and one-click export to a single HTML file.

```
npm start      # → http://localhost:4860
```

Everything lives in `public/` and needs no build step:

| file | what |
| --- | --- |
| `vendor/scratch-blocks/` | the Scratch 3.0 block editor |
| `js/blocks.js` | extra block categories + toolbox |
| `js/compiler.js` | block XML → async JavaScript |
| `js/runtime.js` | stage renderer, sprites, threads, physics, camera, audio, HUD |
| `js/library.js` | built-in costumes, backdrops and sounds |
| `js/app.js` | the editor |
| `js/examples.js` | example games (File › Examples) |
