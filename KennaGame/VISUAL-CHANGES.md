# Visual audit — warm royal storybook pass

## Changed

- **Full interface system:** rebuilt the shared canvas plates, ornate HUD frames, titles, action buttons, hint bar keycaps, state chips, and DOM black-glass panels around one heavier, warmer royal style. Choice screens now distinguish selected, inspecting, locked, owned/ranked, ready, available, and primary-action states at a glance.
- **Player decisions:** character select makes selection and locks explicit while preserving the detailed weapon/trait sidebar; the Atlas gives the active realm an unmistakable state; Armory cards separate the inspected item from owned ranks; lobby, level-up, pause, victory, defeat, Arsenal, Field Guide, and story screens inherit the stronger hierarchy without moving hit areas.
- **Home composition:** retained `title-bg.png` byte-for-byte and built around its gold, green, black, and parchment cues. The settled selection-only lighting behavior is unchanged.
- **Motion and console language:** added a short eased fade-and-gold-sweep between canvas states, responsive sheen on focused action buttons, smooth DOM panel scrolling/focus motion, and consistent Xbox-colored A/B/X/Y plus Menu prompts. Keyboard equivalents remain visible without competing with the controller-first reading order.
- **Typography and decision copy:** enabled browser legibility/kerning hints, removed forced pixelated scaling from the finished canvas, raised important body copy to semibold, strengthened Royal Gift descriptions, and changed unaffordable Armory actions from a bare price to the exact remaining-gold requirement.
- **In-battle readability:** strengthened the common contact shadow beneath every enemy, added a restrained warm rim that works on every realm, made each active knight's player-color locator ring visible in solo and co-op, outlined damage numbers, and gave hostile curse bolts a dark silhouette. The result separates heroes, threats, and rewards at TV distance without adding filters or gradients to hot loops.
- **Hand-drawn monsters:** replaced the per-frame radial body gradient with bold two-tone paint. Shade, charger, warlock, reaper, golem, wraith, and Concur now share the composited blobs' flatter painterly language, existing ink weight, glossy top-light, shadows, and disciplined per-kind palettes.
- **Patch surfaces:** updated the home update-card copy and Chronicle's latest entry to describe the visual pass. The sacred `title-bg.png` and settled selection-only home lighting remain untouched.

## Audited and intentionally retained

- **Canvas screens:** character select, Battlefield Atlas, war council lobby, armory, Royal Gift cards, victory, defeat, pause, Royal Arsenal, Royal Field Guide, and story cinematic already use the shared plate/gold typography system, bounded copy, and matching `cardRects`; no layout changes were warranted.
- **Combat effects:** swords, axes, strike poses, slashes, novas, superweapon beams, death pops, chest wheel, shrine, and forge already use bold silhouettes and cached glows. No additional particles or filters were added, preserving the 60fps target.
- **Drawn icon fallbacks:** all 46×46 fallbacks were checked at HUD/card scale. Their simple forms remain more readable than added fine detail and continue to provide safe fallbacks for the pending painted replacements.
- **DOM panels:** black-glass panels, rows, and focus scrolling remain consistent and opaque. Home overlays retain no hover fill, border, or permanent glow.

## Verification

- Script syntax and `git diff --check` passed after each concern.
- Battle was exercised from home through character select, Atlas, and lobby into a live run.
- Before/after captures live in `.playwright-mcp/visual-before-battle-chaos.png`, `.playwright-mcp/visual-after-battle-readability.png`, and `.playwright-mcp/visual-after-monsters.png`.
- UI refresh captures live in `.playwright-mcp/ui-redo-select.png`, `ui-redo-map.png`, `ui-redo-lobby.png`, `ui-redo-battle.png`, and `ui-redo-pause.png`.
- `title-bg.png`, gameplay/balance/control logic, network fields, save keys, and prank pages were not changed.
