# KennaGame — Agent Handoff

**What this is:** *Kingdom Deluxe: The Last Knight* — a birthday gift for Kenna Kuhn, remaking a math game she made for school long ago ("Math Fact Kingdom Deluxe") as a Vampire-Survivors-style co-op action game. **NO math anywhere** (owner rejected even math jokes). The villain is the sorcerer **Concur** — an homage to the beloved "Concur your math facts" typo on her original game case. Keep that typo alive ("Step 1: Concur your fears.").

## The one-file architecture

- `index.html` (~7,500 lines) — the ENTIRE game: CSS, HTML, one giant `<script>`. No build step, no framework.
- `server.js` — Node + `ws`: serves files AND relays LAN multiplayer (host-authoritative). Run: `node server.js` → port **8912**. It's usually already running (check `lsof -iTCP:8912`).
- Assets: `title-bg.png` (SACRED — see gotchas), `sprites/` (24 knight PNGs), `icons/` (upgrade/weapon icons), `monsters/` (18 composited enemy sprites), `sounds/` (CC0 music + UI samples, credits in txt files).
- `decoy.html` / `fortnite.html` — pranks for the birthday reveal; don't touch.
- Owner plays on **Xbox via Edge** at `http://192.168.1.178:8912` (the Mac's LAN IP — must go in the ADDRESS BAR; typing localhost on Xbox hits the Xbox itself).

## How to test (the established loop)

1. Edit `index.html`.
2. Syntax check: `node -e "const m=require('fs').readFileSync('index.html','utf8').match(/<script>([\s\S]*)<\/script>/); new Function(m[1]); console.log('OK');"`
3. Playwright against `http://localhost:8912` (goto `about:blank` first if state seems stale).
4. Debug handle: `window.__game` = `{ players, enemies(), game, keys, menuOpen, hideMenu, showMenu, chests(), structures(), world() }`. Use bare `game` in page-scope `new Function(...)` probes — `__game.game.phase` can be stale for reads through closures; `window.X` overrides can't intercept script-scope calls (lexical binding).
5. Mock gamepad: override `navigator.getGamepads` with a fake pad object; d-pad 12-15, A=0, B=1, X=2, Y=3, LB=4, RB=5, Start=9.
6. Quick flow: `btnPlay.click()` → Space (hero) → Space (map=RIDE OUT) → Space (lobby=START) → in run. Level-ups PAUSE the game (choices) — clear `game.choices = null` in tests or pick with Digit1-3.
7. Commit style: `KennaGame: <what>` + Co-Authored-By Claude line. Commit often; owner says "save".

## CRITICAL gotchas (learned the hard way)

- **`title-bg.png` is SACRED.** Never edit/replace it. The home screen's painted UI (buttons, chips, cards) is part of that image; real DOM elements are positioned OVER the painted plates as (mostly invisible) hit areas inside `#imgAnchor`, in image-percent coordinates. The "v1.0 REMASTER" text on the update card is painted — can't change it.
- **Home focus philosophy (owner iterated 4x — SETTLED):** painted-stack buttons (PLAY/UPGRADES/CREDITS/EXIT) light up ONLY when selected (`.padFocus` → `padFlash` brightness animation). NO borders, NO translucent fills (they reveal the painted "ugliness" beneath), NO hover effects, NO permanent glow.
- **TDZ trap:** this file's `const`s initialize in order and early UI code runs at image-load. Referencing a later const (ACH_DEFS, SONGBOOK…) from early code = boot crash that kills input AND audio ("everything broken" reports usually = a stale half-deployed build; tell owner to hard-refresh).
- **Region-splice bug:** when python-splicing code regions, check for doubled function openers (`function foo() {` twice) — has caused "Unexpected end of input" repeatedly. Assert `s.count(...) == 1` on every replace.
- **Audio:** `flushMusic()` (replace the `musicBus` gain node) is the ONLY way to silence pre-scheduled WebAudio notes. `initAudio` listeners are permanent (not `once`) and resume suspended contexts — do not regress this; real browsers hand out suspended contexts (was a total-silence bug).
- **First physical click after load** can be eaten by first-gesture handlers — retest before diagnosing.
- Browser caches `title-bg.png` etc. hard — bust with `fetch(url, {cache:'reload'})` when testing image swaps. Xbox Edge caches HARD — close tab + reopen.

## Current game state (all shipped & committed, branch `blockforge`)

v2.0 "THE WIDESCREEN WAR"+: 1136×640 16:9 render (`ROOM_W`, `CX`); 24 knights (5 free) with **knight ranks** (5 gold-bought ranks, X/U to upgrade, button beside the gold in the picker); 14 weapon types with painted icons + weapon strike poses; per-player **3 weapon slots + 3 effect slots** (`p.arsenal`, `p.fx`), per-player stat gifts (`p.up`, STAT_KEYS), rotating gift turns in co-op (chooser's controller ONLY, screen tinted their color); SUNBREAKER evolution (hammer + maxed sharp → chest) and 3 laser SUPERWEAPON fusions (per-player recipes); 31 Royal Gifts w/ flavor text; buyable rerolls; 12 realms with per-realm army budgets (`MAP_SPAWN`) + **Battlefield Atlas** (vertical list + war ledger, pre-rendered vista covers via `buildMapCover`/`COVER_CACHE`); 4 bosses + Concur (throne map only, triggers the birthday ENDING cinematic); intro story cinematic on first PLAY (`kdStats.introSeen`); 16 enemy kinds (yeti/magmite are realm-specific) + elites; enemy art = MIX of composited Kenney blob sprites (`ENEMY_IMG`, `monsters/`) and hand-drawn kinds (`DRAWN_KINDS` set); hit-pop flash + death animations (`dying[]`); **Royal Arsenal tech tree** + Help on pause (`treeOpen`/`helpOpen`, buttons -34/-33); 37-song SONGBOOK incl 5 real CC0 recordings (style `'file'`), ONE soundtrack everywhere (no menu/battle split); Kenney UI samples via `playSample` w/ synth fallback; 12 armory powers incl Royal Summons; shrines/forges/prize-wheel chests (6/run, rare); LAN multiplayer + 4-pad couch co-op; achievements (17); save = localStorage (`kd_meta`, `kd_stats`, `kd_settings`).

## Pending / next steps

1. **Owner's pending art** (12-cell sheets, black bg; slicers in the session scratchpad are gone — rewrite from memory notes if needed, it's ~40 lines of PIL: corner-sampled color-distance key, trim, square, resize): monster sheet (4×4, 14 kinds + spares), boss sheet, 15 upgrade icons (thorn/frost/clover/phoenix/goldrush still 404 as `icons/*.png` — expected console errors), 8 new-gift icons, 3 super icons. Mystery purple dagger from the weapon sheet is STILL unused (idea: secret weapon/25th knight).
2. **Cloud Foundry deploy** — researched, not done: `cf push` the node app (owner already uses CF org `tks` for another project). WebSockets work on CF.
3. **Xbox Store** — researched: PWABuilder → Microsoft Store PWA (manifest.json already exists). **Steam** — Electron wrap + $100 fee.
4. Unreproduced owner reports (suspect stale builds, retest on request): "second map does not work", "mouse upgrades broken", "moving bugs".
5. Wishlist: more pets, Royal Quests (in-run challenges), per-realm music variants, more evolutions (pattern: `evolutionReady()`-style check + chest reward kind).

## Git / publishing

Standalone **private repo: https://github.com/tkcolty-dev/KennaGame** (full 85-commit history, default `main`). The working copy is STILL the `KennaGame/` subdirectory of the big `/Users/colton/claude` repo (branch `blockforge`) — to publish new work to the private repo, commit in the parent repo as usual, then:
`cd /Users/colton/claude && git subtree split --prefix=KennaGame -b tmp && git push kennagame tmp:main && git branch -D tmp`
(the `kennagame` remote is already configured in the parent repo).

## Owner working style

Fast iteration, many mid-turn voice-dictated messages (parse generously). Wants patch notes (UC_SLIDES + chronicle panel) updated every version. Tests on real Xbox and reports UX issues in bursts — fix ALL of them, verify with mock-pad tests, screenshot before/after. Full detailed history lives in the Claude memory file `kenna-game.md` (memory dir), which is the deep-dive companion to this doc.

## July 21, 2026 Codex visual-pass continuation state

This section is the authoritative continuation note for the latest Codex UI/art work.

### Latest product decisions from the owner

- Preserve `title-bg.png` exactly. Build the home UI around it; never regenerate, crop, replace, or edit it.
- Home has four commands: Play, Upgrades, Credits, Exit Game. They remain separate and generously spaced. The complete button brightens and grows slightly only when selected; avoid partial/off-center shine.
- The visible home label remains **PLAY**, even after returning from Upgrades or an existing run. Its subtitle may explain that it returns to the adventure.
- Xbox-first interaction language is required. Use recognizable A/B/X/Y/Menu symbols and make controller focus unmistakable at TV distance.
- X remains the Royal Gift reroll command. In the permanent Upgrades/Armory screen, Y opens and closes a large explanation for the selected item.
- Upgrade level/rank information must remain visible while an item is selected. Selection must never hide the current level.
- Pause uses a Vampire-Survivors-like hierarchy: large realm map in the center, primary actions on the left, reference/system actions on the right. Settings must be directly accessible and closing Settings must return to pause, not home.
- Defeat is a full-screen royal results scene using a darkened crop of the protected home artwork, not a small dialog floating over the battlefield.
- The generated enemies in `enemy-atlas.png` are the approved live monsters. `monsters/*.png` are only temporary loading fallbacks. The atlas must overwrite them when ready.
- Weapons must appear through live swings, thrusts, shots, slams, lashes, projectiles, etc. Do not show idle weapon badges beside/orbiting heroes.
- Battlefield barriers visually render as low storybook hedges/bushes. Their collision footprints stay unchanged. Bushes should be connected foliage silhouettes, not gray walls, buildings, or rows of circular dots.
- Royal Magnet pulls XP gems and coins but does not pull healing hearts. Routine recovery messages should clear quickly so they do not cover combat.
- Four-player HUD plates must compact vertically and clip all weapon/effect circles inside their boxes.

### Latest implemented state

- Home Royal Command stack uses opaque real UI over the protected background. Settled controls remain calm; selected buttons receive the whole-surface brightness/scale treatment.
- Battle HUD uses a thin near-full-width XP strip, compact hero/build plates at left, small Time/Level center information, and a combined Banished/Treasury plate at right.
- XP fill and treasury totals ease toward collected values instead of snapping.
- Banished uses a compact inked skull with a clear cranium, sockets, cheek/jaw shape, and teeth.
- Pause has six working actions: Resume and Arsenal on the left; Field Guide, Settings, Home Menu, and Retreat on the right. D-pad navigation understands the two-column layout. The selected action receives a full border and subtle whole-button lift; the broken diagonal sheen was removed.
- Pause Settings uses `game.settingsFromPause`; `closePanels()` hides the DOM menu and restores `game.paused = true` with Settings selected.
- Armory cards always show `LEVEL current / max`. `game.armoryInspect` drives the Y-button expanded explanation.
- Defeat fills most of the canvas with a large royal results plate over `drawScreenBg(t)`.
- Generated enemy atlas loading alpha-scans, trims, centers, and pads all 18 cells into 320×320 canvases; its images overwrite individual fallbacks.
- Static equipped/orbiting weapon badges were removed. Existing live weapon renderers remain authoritative and received shared shadow/impact-glint polish.
- Hedges now draw one continuous irregular silhouette plus connected highlight patches, leaf strokes, small flowers, and a contact shadow.
- `gameToast(text, ttl)` supports shorter messages; heart recovery uses a 0.9-second lifetime.
- Royal Magnet drop attraction checks `dr.kind === 'coin'`; gem attraction remains in the gem loop. Hearts remain stationary except during the separate global vacuum effect.
- `title-bg.png` last verified SHA-1: `814b544a38062af192b7338b8fcf8accb8cf5d4c`.

### Verification and useful captures

- Required syntax command currently passes.
- `git diff --check` currently passes.
- Pause visual: `.playwright-mcp/pause-menu-final.png` (local test artifact, intentionally untracked).
- Generated enemies/bushes/skull visual: `.playwright-mcp/generated-enemies-bushes-skull.png` (local test artifact, intentionally untracked).
- Latest parent-repo commits before this handoff: `7797dd1` (painted enemies/battle props), `c7c53be` (pause/upgrades/battle feedback), `a017735` (bushes/active weapons).
- KennaGame subtree was pushed to private remote `kennagame`, branch `main`, at subtree commit `002d5a7` before this handoff update.
- Do not commit `.playwright-mcp/`, `*-chroma.png`, or other intermediate chroma-key/reference exports unless the owner explicitly asks to ship them.

### Remaining audit watch-outs

- Test all 18 generated enemies in a longer run or controlled preview, especially atlas cell assignment and boss scale.
- Exercise pause by mouse and mock Xbox pad: all six buttons, Settings open/close return, Arsenal/Guide overlays, Resume, Home, and Retreat.
- Exercise Armory Y details and confirm X still rerolls only on Royal Gift choices.
- Recheck four-player HUD at 1136×640 and at browser-scaled TV sizes; ensure names, hearts, and all six slot rings remain inside each plate.
- Continue visual-only discipline unless the owner explicitly requests behavior changes. Do not alter spawn, damage, balance, controls, networking, or saves.

## Ready-to-paste kickoff prompt for the next agent

> Work in `/Users/colton/claude/KennaGame`. Read `HANDOFF.md` completely, then read `CODEX-VISUAL-BRIEF.md` completely before acting. Continue from the “July 21, 2026 Codex visual-pass continuation state” section; do not restart or undo the approved direction. Preserve `title-bg.png` byte-for-byte. First verify the generated `enemy-atlas.png` monsters are the live in-game art, then test the rebuilt pause menu (including Settings returning to pause), Armory level persistence/Y details, four-player HUD clipping, connected bushes, active weapon animations, Royal Magnet behavior, and full-screen defeat UI. Use the established syntax check, browser screenshots, mouse hit-area tests, and mock Xbox-pad tests. Fix only demonstrated issues, update both in-game patch notes and `VISUAL-CHANGES.md`, make local commits by concern, and do not push unless I explicitly ask.
