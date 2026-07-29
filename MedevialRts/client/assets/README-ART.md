# 🎨 ART CONTRACT — Medieval RTS

Drop PNG files into **this folder** (`client/assets/`). The game auto-loads any
file that exists and instantly uses it in place of the built-in vector
placeholder. **No code changes needed** — just match the filenames below.
Missing files are fine; the game stays fully playable.

General rules:
- **PNG with transparency**, top-down/¾ view, centered subject.
- Keep units/buildings **neutral colored** (no team colors) — the game draws a
  colored banner/dot on top for player ownership. (Optional later: per-player
  variants like `swordsman_p0.png` … `_p3.png` — not wired up yet, ask first.)
- Sprites are drawn scaled to the sizes below (game pixels at zoom 1). Make
  source images ~2× that for crispness.

## Title screen
| File | Size (display) | Notes |
|---|---|---|
| `title_logo.png` | up to 560×300 | Game logo. Replaces the text logo automatically. |
| `title_bg.png` | fullscreen (1920×1080) | Title background. Replaces the animated castle-sunset placeholder. |

## Terrain
| File | Size | Notes |
|---|---|---|
| `tile_grass.png` | 256×256, **tileable** | Ground texture, repeats everywhere. |
| `farm.png` | 110×110 | Neutral wheat farm (windmills earn more next to these). |
| `tree_1.png` `tree_2.png` `tree_3.png` | 52×60 | Decorative tree variants. |

## Buildings (square footprint, drawn centered)
| File | Size | Notes |
|---|---|---|
| `castle.png` | 130×130 | The heart of each player's base. |
| `windmill.png` | 76×76 | Body only — blades are separate so they can spin. |
| `windmill_blades.png` | ~68×68 | Blades centered on the image; game rotates it. |
| `barracks.png` | 96×96 | Trains swordsmen + archers. |
| `stables.png` | 96×96 | Trains knights. |
| `workshop.png` | 96×96 | Siege workshop, trains catapults. |
| `tower.png` | 60×60 (tall ok, keep base centered) | Defensive arrow tower. |
| `wall.png` | 40×40 | 🧱 **NEW** — one wall chunk. Walls placed near each other auto-connect with a drawn rampart line, so make this a square stone block that reads well alone AND in a row. Skin variants (`wall__royal.png` etc.) welcome. |

## Units (drawn ~34×34, catapult ~50×50, balloon ~56×56)
| File | Notes |
|---|---|
| `builder.png` | Peasant with hammer. |
| `swordsman.png` | Basic melee. |
| `archer.png` | Ranged, shoots arrows. |
| `knight.png` | Heavy cavalry, fast. |
| `catapult.png` | Siege engine, lobs rocks. |
| `balloon.png` | 🎈 **NEW** — Hot air balloon (flying unit, drawn hovering with a ground shadow). Balloon envelope + basket, neutral colors. |

**Walk animation (optional, auto-detected):** `<unit>_walk_0.png` +
`<unit>_walk_1.png` alternate while a unit moves. Already done for builder,
swordsman, archer, knight — a `balloon` doesn't walk, skip it.

## Projectiles
| File | Size | Notes |
|---|---|---|
| `arrow.png` | 20×6 | Drawn rotated toward target, pointing **right**. |
| `rock.png` | 18×18 | Catapult boulder. |

## Kingdom skins (wired up!)
Players pick a **kingdom skin** in the lobby: `kingdom` (default), `royal`,
`dark`, `forest`. Buildings can have per-skin art — add a variant file named
`<building>__<skin>.png` and it's used automatically for players on that skin:

- `castle__royal.png`, `castle__dark.png`, `castle__forest.png`
- same pattern works for `windmill`, `barracks`, `stables`, `workshop`, `tower`
- plain `castle.png` etc. is the `kingdom` default and the fallback

Until variants exist, the game recolors the placeholder buildings per skin
(gold/purple for royal, black stone for dark, mossy green for forest).

## Nice-to-have later (not wired up yet — ask before making)
- Sounds (`.mp3`): battle, building placed, coin, victory/defeat, title music.
- Death/attack animation frames.
- Per-player colored sprite variants.
