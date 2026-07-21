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

## Owner working style

Fast iteration, many mid-turn voice-dictated messages (parse generously). Wants patch notes (UC_SLIDES + chronicle panel) updated every version. Tests on real Xbox and reports UX issues in bursts — fix ALL of them, verify with mock-pad tests, screenshot before/after. Full detailed history lives in the Claude memory file `kenna-game.md` (memory dir), which is the deep-dive companion to this doc.
