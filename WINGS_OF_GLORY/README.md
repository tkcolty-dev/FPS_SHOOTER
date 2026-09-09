# Wings of Glory — top-down air combat

A War Thunder–style arcade air battle game, top-down, built as a standalone web game.
The aircraft and missile silhouettes come from the original "Wings of Glory" Scratch project
(`assets/src/`), re-painted in-game with nation colours, camo, insignia, shading and outlines.

**Play:** double-click `index.html` (or `start.command`). Press ⛶ Fullscreen / F11.

## Flight model
Altitude is real: climb with Shift/↑, dive with Ctrl/↓, and the whole world scales with distance —
planes far below you shrink, clouds sit at 2000 m and you can fly above or under them.
Fuel burns faster at full throttle and on afterburner; a fuel leak drains it fast and an empty tank
kills the engine. Hits can knock out the engine, shoot away control response, start a fire (dive to blow
it out) or kill the pilot outright. Respawns put you on the runway: full throttle, rotate, and climb away.
Land back on your own airfield to repair, refuel and rearm in 8 seconds.

## Missiles
Each missile is modelled on the real thing: motor burn then an unpowered coast that bleeds speed,
a turn rate that fades as it slows, a seeker gimbal it can be dragged outside of, an arming distance,
and a proximity fuse that scores near misses as fragment damage instead of a guaranteed kill.
Early heat seekers (AIM-9B, R-3S, R-13M, AIM-4) only see a hot tailpipe, so you must be behind the
target; the R-60M is all-aspect. Semi-active radar missiles (AIM-7, R-23R, R-40) go stupid the moment
you break your own lock, while active radar (AIM-120, AIM-54) goes autonomous in the terminal phase.
Flares decoy heat seekers, and later seekers reject them more often.
The HUD draws the seeker cone as a dashed wedge and fills a ring around the target as the lock builds,
the lock survives a brief wobble instead of dropping instantly, and the game auto-selects whichever
missile on the rails can actually take the shot you are lined up for.

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
