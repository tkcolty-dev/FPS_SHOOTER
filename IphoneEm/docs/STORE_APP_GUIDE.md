# Writing an App Store app for the iPhone 17 emulator

Store apps are **self-contained web apps** shown inside the emulated phone screen in an `<iframe>`.
The App Store scans `public/store/*/manifest.json` automatically — no registration step.

```
public/store/<id>/manifest.json
public/store/<id>/index.html      (everything inline: CSS + JS, NO external network requests)
```

## manifest.json

```json
{
  "id": "g2048",
  "name": "2048",
  "subtitle": "Slide. Merge. Repeat.",
  "category": "Games",
  "genre": "Puzzle",
  "developer": "Tile Works",
  "rating": 4.7,
  "ratings": "12K",
  "age": "4+",
  "size": "1.2 MB",
  "version": "1.0",
  "statusBar": "dark",
  "icon": { "bg": "linear-gradient(160deg,#f6d365,#fda085)", "glyph": "<svg viewBox='0 0 60 60'>…</svg>" },
  "description": "Two or three short paragraphs, App Store voice.",
  "whatsNew": "One or two lines.",
  "accent": "#f59e0b"
}
```

- `id` = folder name, lowercase letters/digits only.
- `category`: `"Games"` | `"Utilities"` | `"Productivity"` | `"Entertainment"` | `"Music"` | `"Education"` | `"Lifestyle"`.
- `statusBar`: `"light"` = white clock/battery (use on dark app backgrounds), `"dark"` = black (light backgrounds).
- `icon.bg` is any CSS background. `icon.glyph` is inline HTML centered in the icon: an `<svg viewBox='0 0 60 60'>`
  (drawn white/light on the bg, no background rect, **no `id=` attributes** — several icons share one document),
  or a short text/emoji. Make the icon look like a real, polished App Store icon — not a plain emoji on a flat color.
- Use single quotes inside the glyph SVG so the JSON stays readable.

## index.html rules

1. The iframe is exactly **402 × 874 CSS px** (iPhone 17) — design for that, but lay out with `100vw/100vh`/flex so nothing overflows.
   `html,body{margin:0;height:100%;overflow:hidden}`. Include `<meta name="viewport" content="width=device-width,initial-scale=1">`.
2. **Safe areas**: the OS draws the status bar + Dynamic Island over the top **62px**, and the home indicator over the
   bottom **34px**. Backgrounds should extend under them, but keep all text and controls out of those zones
   (`padding-top:62px; padding-bottom:34px` on your main layout).
3. **Input**: people use a mouse on a laptop. Everything must work with click + mouse drag (use Pointer Events:
   `pointerdown/move/up` + `touch-action:none` on drag surfaces). Games should ALSO accept arrow keys / WASD / space where natural,
   but must be fully playable with pointer only (swipes = pointer drags, on-screen buttons where needed).
4. Look and feel: this is an iPhone app. `font-family:-apple-system,'SF Pro Text','Helvetica Neue',sans-serif`,
   rounded shapes, smooth 60fps animation, proper game-over/restart flows, high score. No scrollbars visible
   (`::-webkit-scrollbar{display:none}`), `user-select:none`, `-webkit-tap-highlight-color:transparent`, `cursor:default`.
   Polish matters more than feature count. No placeholder/"coming soon" anything.
5. No external requests of any kind (no CDNs, fonts, images). Draw with CSS/canvas/SVG. Audio via WebAudio only (keep it subtle), and
   create/resume the AudioContext on the first pointerdown.
6. Load the SDK as the first script: `<script src="/sdk.js"></script>` → `window.iPhone`:

```js
iPhone.haptic('light')            // 'light'|'medium'|'heavy'|'selection'|'success'|'warning'|'error' — use on merges, hits, wins
iPhone.sound('pay')               // real system sounds: 'key','pay','shutter','sent','received','tone:Note', …  (use sparingly)
iPhone.notify('Title', 'Body')    // posts a notification banner
iPhone.setStatusBar('light')      // switch status bar text colour at runtime
await iPhone.storage.get('best', 0)   // persistent per-app storage (async!). DO NOT use localStorage — it may throw in the sandbox.
await iPhone.storage.set('best', 42)
iPhone.onPause(fn) / iPhone.onResume(fn)   // app left / returned to foreground: pause game loops, timers, audio
iPhone.onTheme(fn); iPhone.theme           // 'light' | 'dark' (also set as <html data-theme>)
iPhone.close()
```

7. Pause `requestAnimationFrame` loops and audio in `onPause`; resume in `onResume`.
8. Must also work when opened directly in a browser tab (SDK calls silently no-op there).
9. Verify before finishing: the inline script parses (extract it and run `node --check`), and the manifest is valid JSON.
