# Prompt for Codex — make all the art for Medieval RTS

Copy everything below this line and give it to Codex, run from the `MedevialRts/` folder.

---

You are the artist for **Medieval RTS**, a finished 2-D top-down multiplayer RTS game in this folder. The code is DONE — do not change any `.js`, `.html`, or `.css` files. Your entire job is to create PNG image files in `client/assets/`.

## How the art pipeline works
The game auto-loads any PNG in `client/assets/` that matches the expected filenames and instantly uses it instead of the built-in vector placeholder. Missing files are fine, wrong filenames silently do nothing — so **filenames must match exactly**. The full contract with every filename, display size, and description is in `client/assets/README-ART.md`. Read that file first — it is the source of truth.

## How to make the images
You can't paint by hand, so generate the PNGs programmatically: write a Node script (e.g. `art/generate.js`, use the `canvas` npm package or write SVGs and rasterize them with `sharp`) that draws each sprite and saves it to `client/assets/`. Keep the script in an `art/` folder so sprites can be tweaked and regenerated. Draw at **2× the display size** listed in the contract (crisp on retina), PNG with transparency.

## Art style
- **Cute chunky medieval**, like a mobile strategy game: bold shapes, thick dark outlines (~3px at 2× scale), soft 2-tone shading (base color + darker shade on the right/bottom), tiny highlights. No gradients-everywhere realism, no photo textures.
- Top-down ¾ view (you see roofs AND a bit of the front wall), light source top-left.
- Consistent palette across all sprites: warm stone greys, oak-brown wood, straw yellow, deep green foliage.
- **Units and buildings must stay team-neutral** — no blue/red/etc. The game draws each player's colored banner/dot on top. Use greys/browns/leather tones for clothes and armor.

## Priority order (stop wherever you run out of steam — the game works at every stage)
1. **Title screen**: `title_logo.png` (big ornate "MEDIEVAL RTS" lettering with swords/shield, up to 1120×600 at 2×), `title_bg.png` (1920×1080 painted castle-at-sunset scene).
2. **Buildings**: `castle.png`, `windmill.png` + `windmill_blades.png` (blades are a separate image, centered, the game spins it), `barracks.png`, `stables.png`, `workshop.png`, `tower.png`.
3. **Units**: `builder.png`, `swordsman.png`, `archer.png`, `knight.png`, `catapult.png`.
4. **Terrain**: `tile_grass.png` (256×256 and it MUST tile seamlessly — test by drawing it 2×2), `farm.png`, `tree_1.png`, `tree_2.png`, `tree_3.png`.
5. **Projectiles**: `arrow.png` (points RIGHT — the game rotates it), `rock.png`.
6. **Skin variants** (bonus): recolored building sets `castle__royal.png`, `castle__dark.png`, `castle__forest.png` and the same `__royal` / `__dark` / `__forest` suffixes for windmill, barracks, stables, workshop, tower. Royal = cream stone + purple/gold roofs, Dark = near-black stone + iron, Forest = mossy stone + green wood. Easiest done by parameterizing your generator's palette.

## Verify your work
Run `npm start`, open http://localhost:4720, and check: the title screen shows your logo/background, then Host Game → Add Bot → Start and confirm buildings/units/terrain all show your sprites (anything still looking like flat vector shapes = filename mismatch). Windmill blades should spin. The grass must tile with no visible seams.
