# Task: Visual review & enhancement pass — Kingdom Deluxe: The Last Knight

You are working on **KennaGame** (repo root = this folder; read `HANDOFF.md` first — it has the architecture, test loop, and hard rules). Your job in THIS session is purely **visual**: audit every screen, then enhance polish, cohesion, and game-feel WITHOUT changing gameplay logic, balance, or controls.

## Context you must respect

- The whole game is ONE file: `index.html` (~7,500 lines: CSS + HTML + one `<script>`). Canvas-rendered game at 1136×640 (`ROOM_W`/`CX` constants), scaled to fill the window. No build step, no frameworks, no external requests.
- It is a **birthday gift for a young person (Kenna)** — the aesthetic is "warm royal storybook": Cinzel display font, Inter body, gold-on-dark (`UI.gold`, `UI.goldLight`, plate/ornate helpers), painterly. Charming, not gritty. Monsters are "spooky-charming" — menacing eyes/fangs OK, gore never.
- Test on `http://localhost:8912` (server usually running; else `node server.js`). Syntax-check after every edit:
  `node -e "const m=require('fs').readFileSync('index.html','utf8').match(/<script>([\s\S]*)<\/script>/); new Function(m[1]); console.log('OK');"`
- Screenshot BEFORE and AFTER for every screen you change. The owner judges by screenshots on a TV — favor bold silhouettes and readable contrast at couch distance.
- Performance floor: 60fps with 200+ enemies. No per-frame gradient/filter creation in hot loops (cache like `GLOWS`/`COVER_CACHE` do). `ctx.filter` writes are expensive — keep them gated.

## ABSOLUTE rules (violating these gets the work reverted)

1. **NEVER edit or replace `title-bg.png`.** The home screen's painted buttons/chips/cards live in that image; DOM overlays sit on top as hit areas. Don't "fix" painted text (e.g. "v1.0 REMASTER" is painted — leave it).
2. **Home focus behavior is SETTLED after 4 owner iterations:** painted-stack buttons light up ONLY when selected, via the `padFlash` brightness animation. NO borders, NO translucent fills, NO hover effects, NO permanent glows on PLAY. Solid overlay elements (UPGRADES plate, chips, icon buttons) must stay fully opaque in every state — translucency reveals the painted UI beneath ("the ugliness behind").
3. Don't touch: gameplay math, spawn/balance numbers, control mappings, net protocol (`snap` fields), save keys (`kd_meta`/`kd_stats`/`kd_settings`), `decoy.html`, `fortnite.html`.
4. All 24 `const` declarations in the script initialize in ORDER and early code runs at image-load — never reference a later const from earlier code (boot-crash TDZ; it has bitten twice).
5. Keep everything self-contained: no CDNs, no new asset downloads without CC0 license + credit in the credits panel + `sounds/`-style credits file.

## Visual inventory to audit (in priority order)

1. **In-battle readability** (`render()` ~line 6650+): enemy/player separation from ground, projectile visibility (`waves` draw block), damage numbers, HUD plates (`ornate`, hero plates, boss bar, forge/arsenal badges). The owner has 4-player couch co-op — check chaos scenes.
2. **Hand-drawn monsters** (`drawEnemy` + `DRAWN_KINDS` set: shade, charger, warlock, reaper, golem, wraith, concur) — these coexist with sprite blobs (`ENEMY_IMG`/`monsters/*.png`); make the two families feel like ONE art style (shared outline weight, shadow, palette discipline). Owner has called weak versions "poop" — bold shapes win.
3. **Canvas screens**: character select (`renderSelect` + sidebar), Battlefield Atlas (`renderMapSelect` + `buildMapCover` vista covers — owner already rejected one flat-vector iteration; keep the "real game art" approach), war council lobby (`renderLobby` + join animation), armory (`renderArmory`), level-up cards, victory/defeat/pause panels, Royal Arsenal tree (`treeOpen` block), Royal Field Guide (`helpOpen` block), story cinematic (`renderStory` + `storyFireworks`).
4. **Weapon/combat effects**: `drawSword`/`drawAxe`, strike poses (`strikes`), slashes, novas (incl. gold `slam`), beams (superweapon lasers), death pops (`dying`), chest prize wheel (`drawChest`), shrine/forge structures (`drawStructure`).
5. **Drawn icon fallbacks** in `drawUpgradeIcon` (thorn, frost, clover, phoenix, goldrush, crit, echo, stomp, crown, barrier, plate, mend, tailwind, giantup, charter, orbfire, ward, rally, bounty, pierce, prism/stormray/dragonray fallbacks) — several are rough; owner's painted replacements may arrive later, so improve the drawn versions in place (46×46 design space, `s` scale param).
6. **DOM panels** (settings/chronicle/achievements etc.): consistency of the black-glass style (`#menu.hasImage .panel`), row spacing, no clipped controls (test with the d-pad walk — `panelFocusMove` must reach and reveal everything).

## What "enhance" means here

- Micro-animation and juice (eased transitions, subtle idle motion) over redesigns.
- Consistency: one outline weight, one shadow direction, one gold, one green (#a3d977 family), one danger red.
- TV-readable: bigger silhouettes > fine detail; check every text against `wrapText` (never let text escape a box — owner complaint history).
- If you change a screen's layout, keyboard/mouse/pad hit areas (`cardRects` pushes) MUST move with the visuals, and the mock-gamepad test must still reach everything.

## Deliverables

1. Commits in the established style (`KennaGame: <what>`), one concern per commit, each verified (syntax check + screenshot + relevant interaction test).
2. A short `VISUAL-CHANGES.md` summarizing every screen touched with before/after notes.
3. Update the in-game patch notes (`UC_SLIDES[0]` + chronicle panel `verHead` block) — the owner requires patch notes for every version.
4. Do NOT push anywhere; leave commits local for the owner to review.
