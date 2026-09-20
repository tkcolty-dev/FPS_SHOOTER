# Built-in app API (iPhone 17 emulator)

Built-in apps are plain scripts in `public/js/apps/<id>.js`. Every `.js` file in that folder is auto-loaded
(alphabetically) after the core, so **no registration in index.html is needed**. One app per file (a file may register
closely related apps). Wrap the file in an IIFE. No build step, no modules, no external libraries unless stated.

The screen is **402 × 874 CSS px**. The OS draws the status bar / Dynamic Island over the top **62px** (`var(--safe-top)`)
and the home indicator over the bottom **34px** (`var(--safe-bottom)`). App content goes edge to edge underneath them.

```js
(function () {
  OS.addStyle('notes', `
    .app-notes .thing { color: var(--label); }      /* ALWAYS scope rules under .app-<id> */
  `);

  OS.registerApp({
    id: 'notes',                      // lowercase, unique
    name: 'Notes',                    // label under the icon
    icon: {                           // 60×60 squircle, drawn by the OS
      bg: 'linear-gradient(180deg,#FFE259,#FFA751)',          // any CSS background
      glyph: `<svg viewBox="0 0 60 60">…</svg>`              // centred, fills the icon; NO id="" attributes inside (shared document)
    },
    system: true,                     // true = can't be deleted from the Home Screen
    statusBar: 'auto',                // 'auto' (black in light mode, white in dark) | 'light' (white text) | 'dark' (black text)
    background: 'var(--bg)',          // optional, root background
    launch(ctx) {},                   // once per process: build the UI into ctx.root
    onResume(ctx, params) {},         // every time it comes to the foreground (also right after launch). params from OS.openApp(id, params)
    onPause(ctx) {},                  // left the foreground (home / switcher / lock) — pause video, audio previews, rAF loops
    onClose(ctx) {},                  // swiped away in the App Switcher — stop timers, release camera/mic
  });
})();
```

`ctx` = `{ root, app, setStatusBar(style), close(), isActive() }`.
`ctx.root` is `<div class="app-root app-<id>">`, absolutely positioned, 402×874, `overflow:hidden`. The app stays alive
(DOM kept) while in the background until killed from the switcher.

Icons matter: make each one look like the real iOS icon's *idea* (own drawing — gradients, simple shapes), crisp at 60px.

## Design tokens (CSS variables, flip automatically in Dark Mode)

| var | light | dark | use |
|---|---|---|---|
| `--bg` | #fff | #000 | plain screens |
| `--bg2` | #F2F2F7 | #000 | grouped-list screens (Settings style) |
| `--cell` | #fff | #1C1C1E | list cells / cards on `--bg2` |
| `--cell2` | #F2F2F7 | #2C2C2E | nested fills, text fields |
| `--label` `--label2` `--label3` | #000 / 60% / 30% | #fff / 60% / 30% | primary / secondary / tertiary text |
| `--sep` | rgba(60,60,67,.29) | rgba(84,84,88,.65) | hairlines (use `0.5px`) |
| `--fill` `--fill2` | rgba(120,120,128,.2/.12) | (.36/.24) | button + control fills |
| `--tint` | #007AFF | #0A84FF | links, active controls |
| `--red --green --orange --yellow --teal --cyan --indigo --purple --pink --mint --brown --gray` | iOS system colours | dark variants | |
| `--bar` | rgba(249,249,249,.8) | rgba(22,22,24,.8) | translucent nav/tab bars (`backdrop-filter: var(--blur)`) |
| `--safe-top` 62px · `--safe-bottom` 34px · `--kb-h` keyboard height (0px when hidden) | | | |

Font is inherited (`-apple-system`, SF Pro). iOS type sizes: Large Title 34/700, Title 28, Title2 22/700, Headline 17/600,
Body 17, Callout 16, Subhead 15, Footnote 13, Caption 12. Letter-spacing ≈ -0.4px on 17px text.
Dark mode: `#screen[data-theme="dark"]`; listen with `OS.on('themechange', fn)` only if you draw to canvas.

## Ready-made components (class names)

- `.ios-scroll` – scrolling container (hidden scrollbar, momentum, overscroll contained). Mouse-drag scrolling is provided by the OS: any
  `.ios-scroll` can be dragged with the mouse like a finger. Mouse wheel also works.
- `.ios-list` (inset grouped card) > `.ios-row` (44px min, hairline separators automatic). Inside a row:
  `.ios-row-icon` (29×29 rounded colour square, put an svg/emoji in it, set `style="background:…"`), `.ios-row-label`,
  `.ios-row-sub` (second line), `.ios-row-value` (right grey text), `.ios-chevron` (the › disclosure). `.ios-row.tappable` gets a pressed state.
- `.ios-list-header` / `.ios-list-footer` – small grey caption above/below a list.
- `<label class="ios-switch"><input type="checkbox"><i></i></label>` – the green toggle.
- `<input type="range" class="ios-slider">` – slider.
- `.ios-seg` > `button` (add `.on` to the selected one) – segmented control.
- `.ios-search` > `input` – rounded search field with magnifier.
- `.ios-btn` (filled tint, 50px, radius 14) · `.ios-btn.gray` · `.ios-btn.red` · `.ios-btn-plain` (text button, tint colour) · `.ios-pill` (small capsule, App Store "GET" style).
- `.ios-tabbar` > `.ios-tab` (each: an svg + `<span>` label; add `.on`) – bottom tab bar, already padded for the home indicator (total 83px).
- `.ios-nav` – manual top bar if you don't use `createNav` (already padded for the status bar).
- `.ios-large-title` – 34px bold heading.
- `.pressable` – dims to 60% while pressed.
- `.ios-sheet-backdrop` + `.ios-sheet` – see `OS.ui.sheet`.
- `.sf` – inline svg icon sizing helper (1em, currentColor).

### Navigation stack (use it for any app with drill-down screens)

```js
const nav = OS.ui.createNav(container, { tabBarInset: false });   // container: a positioned element you own
nav.push({
  title: 'Notes',
  largeTitle: true,                       // big title that collapses into the bar on scroll
  back: 'Folders',                        // back label (default = previous page title)
  left:  { label: 'Edit', onTap() {} },   // optional, replaces the back button
  right: [{ label: 'Done', bold: true, onTap() {} }, { icon: '<svg…>', onTap() {} }],
  background: 'var(--bg2)',
  search: { placeholder: 'Search', onInput(text) {} },   // optional search field under the large title
  render(body, page) { body.innerHTML = '…'; },           // body is an .ios-scroll already padded for bars
  onShow(page) {}, onHide(page) {},
});
nav.pop(); nav.popToRoot(); nav.top;      // page objects: page.setTitle(t), page.setRight([...]), page.body, page.el
```
Slide transitions, the ‹ back button and edge-swipe-back are handled for you.
If the app has a bottom tab bar, give each tab its own container + nav and pass `{ tabBarInset: true }` so content clears the 83px bar.

## OS services

```js
// Sound — REAL iPhone sounds (served from the Mac's system files) with synthesized fallbacks
OS.sound.play(id, { volume: 1, loop: false, category: 'ui' }) → { stop() }
//   ids: 'key' 'key_delete' 'key_modifier' 'lock' 'shutter' 'screenshot' 'sent' 'received' 'charge' 'pay' 'payfail'
//        'begin_record' 'end_record' 'mail_sent' 'new_mail' 'siri_begin' 'siri_confirm' 'siri_cancel' 'trash'
//        'ringback' 'busy' 'endcall' 'callwaiting' 'facetime_ring' 'facetime_join' 'facetime_leave'
//        'dtmf-0'…'dtmf-9' 'dtmf-star' 'dtmf-pound'  'tapback_heart|up|down|haha|exclaim|question'
//        'ringtone:<Name>' (Reflection, Opening, Marimba, Radar, …)   'tone:<Name>' (Note, Tri-Tone, Chord, Rebound, …)
//   category: 'ui' (muted by the silent switch, follows ringer volume) | 'ringer' (same, for ringtones/alerts/alarms)
//             | 'media' (follows media volume, ignores silent switch)
OS.sound.ringtone()   // current ringtone id from Settings, e.g. 'ringtone:Reflection'
OS.sound.textTone()   // current text tone id
OS.sound.list()       // Promise<string[]> of every available id
OS.sound.ctx          // the shared AudioContext (for apps that synthesize audio: connect to OS.sound.mediaOut, not ctx.destination)
OS.haptic(type)       // 'light'|'medium'|'heavy'|'selection'|'success'|'warning'|'error'  → tiny taptic thud + screen nudge

// Persistence (localStorage JSON, namespaced). Use keys like 'notes.items'
OS.store.get(key, fallback); OS.store.set(key, value); OS.store.remove(key); OS.store.on(key, fn)
// Big blobs (photos, recordings) → IndexedDB
OS.db.put(storeName, obj) → Promise<id>;  OS.db.all(storeName) → Promise<obj[]>;  OS.db.get(storeName, id);  OS.db.del(storeName, id)
//   stores available: 'photos', 'recordings', 'files'

// System settings (read/write; Settings app edits the same ones)
OS.settings.get(name); OS.settings.set(name, value); OS.on('setting:<name>', fn)
//   darkMode(bool) brightness(0..1) volume(0..1 media) ringerVolume(0..1) silent(bool) wifi bluetooth airplane cellular (bool)
//   use24h(bool) ownerName(string) wallpaper(string id) keyboardClicks(bool) lockSound(bool) haptics(bool)

// Apps & system
OS.openApp(id, params); OS.goHome(); OS.apps (array of registered defs); OS.isInstalled(id)
OS.openURL('https://…')            // opens Safari on that URL;  'tel:555…' opens Phone;  'sms:' Messages;  'mailto:' Mail
OS.notify({ appId, title, body, sound /* true | false | sound id */, onTap() {} })   // banner + Notification Center + lock screen
OS.badge(appId, n)                  // red badge on the icon (0 clears)
OS.on(evt, fn) / OS.off(evt, fn)    // 'themechange' 'lock' 'unlock' 'minute' 'keyboard' 'volumechange' 'appopen' 'appclose'
OS.ai(prompt, { system, fast: true, onText(chunkSoFar) {} }) → Promise<string>   // Claude on the server; rejects if unavailable — ALWAYS have a non-AI fallback

// Dialogs (all return Promises)
OS.ui.alert({ title, message, buttons: [{ label:'Cancel', style:'cancel' }, { label:'Delete', style:'destructive' }] }) → index
OS.ui.prompt({ title, message, placeholder, value, okLabel }) → string | null
OS.ui.actionSheet({ title, message, buttons: [{ label, style, icon }], cancel: 'Cancel' }) → index | -1
OS.ui.toast('Copied')                                          // small HUD
OS.ui.sheet({ title, height: 'large'|'medium'|<px>, left:{label,onTap}, right:{label,bold,onTap}, render(body, sheet) {} }) → sheet ({ close() })
OS.ui.contextMenu(anchorEl, [{ label, icon, style, onTap }])   // long-press style popup menu next to an element

// Dynamic Island live activities
OS.island.start({ id, appId, leading: html, trailing: html, expanded: html, onTap() {} })
OS.island.update(id, { leading, trailing, expanded }); OS.island.end(id)
//   leading/trailing are tiny (≈ 24px tall) html snippets shown either side of the pill; tapping opens appId (or onTap).

// Now Playing (Control Center tile + Lock Screen + Dynamic Island)
OS.nowPlaying.set({ appId, title, artist, artwork /* css background */, playing, duration, position, onToggle, onNext, onPrev, onSeek })
OS.nowPlaying.clear()

// Shared data
OS.contacts.all() → [{ id, first, last, phone, email, color, emoji?, favorite? }];  OS.contacts.add(c); OS.contacts.update(id, patch); OS.contacts.remove(id); OS.contacts.find(idOrPhone)
OS.contacts.name(c) → 'First Last';  OS.contacts.avatar(c, size) → html for a round monogram avatar
OS.photos.add({ src /* dataURL or blob */, kind: 'photo'|'video'|'screenshot' }) → Promise;  OS.photos.all() → Promise<[{id, src, kind, date}]>;  OS.photos.remove(id)

// Helpers
OS.util.el(html) → Element;  OS.util.esc(text);  OS.util.time(date) → '9:41' (respects 24h);  OS.util.ampm(date) → 'AM';
OS.util.relDate(date) → 'Yesterday';  OS.util.uid();  OS.util.clamp(v,a,b);  OS.util.longPress(el, fn, ms=500)
OS.util.drag(el, { onStart(p,e), onMove(p,e), onEnd(p,e) })   // p = {x,y,dx,dy,vx,vy} in SCREEN px (the device is CSS-scaled; always use this for gestures, never raw clientX maths)
OS.util.screenPoint(event) → {x,y} in screen px
```

## Text input

Any `<input>`, `<textarea>` or `[contenteditable]` inside the screen automatically raises the **system keyboard**
(with the real key-click sound); a physical keyboard works too. Hints: `inputmode="numeric|decimal|tel|email|url"`,
`enterkeyhint="search|go|send|done|next"`. While it is up, `--kb-h` (≈ 335px) is set on `#screen` — pin bottom bars with
`bottom: var(--kb-h, 0px)` (or `max(var(--kb-h), 0px)`). Pressing return in a single-line input fires a normal `keydown`
(`key === 'Enter'`) + `change`. Typed text fires normal `input` events. Call `el.blur()` to dismiss.

## Rules

- Mouse-first: everything works with click + drag. Use `click` for taps, `OS.util.drag` for gestures, `OS.util.longPress` for long-press.
- Never use `alert/confirm/prompt` or `position:fixed` (use `absolute` inside `ctx.root`). Never touch DOM outside `ctx.root` (dialogs via OS.ui).
- Persist user data with `OS.store` / `OS.db`. Seed believable sample content on first run so the phone feels lived-in.
- Match real iOS layout, spacing, colours and behaviour as closely as you can in BOTH light and dark mode. No "coming soon", no dead buttons:
  if a control is visible it should do something sensible.
- Guard optional services: `OS.ai` may reject, camera/mic may be denied, fetch may fail → show a graceful iOS-style state.
- Verify with `node --check public/js/apps/<file>.js` before finishing.
