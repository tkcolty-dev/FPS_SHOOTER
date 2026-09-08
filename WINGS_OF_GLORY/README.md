# Wings of Glory — top-down air combat

A War Thunder–style arcade air battle game, top-down, built as a standalone web game.
The aircraft and missile silhouettes come from the original "Wings of Glory" Scratch project
(`assets/src/`), re-painted in-game with nation colours, camo, insignia, shading and outlines.

**Play:** double-click `index.html` (or `start.command`). Press ⛶ Fullscreen / F11.

## Features
- 55 aircraft across 7 nations (USA, Germany, USSR, Britain, Japan, France, Sweden), ranks I–VI:
  WW2 props → early jets → supersonic missile fighters, bombers, attackers.
- Tech tree with Research Points + Silver Lions, saved in the browser.
- Modes: Air Battle (dogfight tickets), Ground Strike (airfields, tanks, AA), Test Flight.
- 4 procedural map themes: Islands, Plains, Desert, Winter (forests, fields, towns, rivers, clouds).
- Guns with overheat, IR/radar missiles with lock-on and flares, bombs, defensive turrets, flak.
- AI wingmen and enemies with pursuit / evade / bombing behaviour, 3 skill levels, 4v4 – 12v12.
- WT-style HUD: lead indicator, target brackets, minimap, kill feed, missile warning, rewards.
- All sound synthesized (engines, guns, missiles, explosions, UI, music). Gamepad supported.

## Controls
Mouse steer · W/S throttle · LMB/Space guns · RMB/E missile · F flares · B bombs · Q target · wheel zoom · Esc pause.

## Files
`index.html` UI · `planes.js` roster/stats · `art.js` sprite painting · `world.js` terrain · `game.js` simulation/HUD · `audio.js` synth · `ui.js` hangar/save · `assets.js` embedded SVG art.
