# Wings of Glory — top-down air combat

A War Thunder–style arcade air battle game, top-down, built as a standalone web game.
The aircraft and missile silhouettes come from the original "Wings of Glory" Scratch project
(`assets/src/`), re-painted in-game with nation colours, camo, insignia, shading and outlines.

**Play:** double-click `index.html` (or `start.command`). Press ⛶ Fullscreen / F11.

## Scale
One world unit is one metre and time is real, so every number on screen is honest. A P-40 does
551 km/h, is 9.7 m long, pulls 6.5 G and climbs 32 m/s. Aircraft are *drawn* seven times their true
size so they stay readable from a top-down camera, and the camera pulls back for faster aircraft.

## Flight model
Turning is real physics, not a fixed spin rate: you pull G, and turn rate is G times gravity divided
by speed. Below corner speed the wing runs out of lift, above it the airframe limits you, so every
aircraft turns best at one particular speed and turns terribly at the top end. A P-40 manages 24°/s
at 550 km/h but 43°/s when throttled back to 307 km/h, and hard turns bleed energy. Fly fast and you
cannot follow anyone; slow down too far and you stall.

Altitude is real: climb with Shift/↑, dive with Ctrl/↓, and the whole world scales with distance —
planes far below you shrink, clouds sit at 2000 m and you can fly above or under them.
Fuel burns faster at full throttle and on afterburner; a fuel leak drains it fast and an empty tank
kills the engine. Hits can knock out the engine, shoot away control response, start a fire (dive to blow
it out) or kill the pilot outright. Respawns put you on the runway: full throttle, rotate, and climb away.
Land back on your own airfield to repair, refuel and rearm in 8 seconds.

## Missiles
Missiles steer by proportional navigation, the way real seekers do: they turn at a multiple of the
rate the line of sight rotates, which puts them on a collision course rather than chasing the tail.
They are limited by their airframe G, so a hard break turn at the right moment defeats them.
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

**Combat assist** (Settings) is on by default: seekers are all-aspect and wide, missiles pull double
G, and locks come quickly. Switch it to Realistic for rear-aspect-only heat seekers and true missile G.

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
