/* Spark Engine — feature pack: ~100 extra game-engine blocks and behaviours.
   Registers blocks (SparkBlocks), code generators (SparkCompiler) and a runtime plugin (SparkRuntime.plugins). */
(function () {
  const SR = window.SparkRuntime, Lib = window.SparkLib, C = window.SparkCompiler, BL = window.SparkBlocks;
  const TP = SR.Target.prototype, RP = SR.prototype;
  const { toNum, toStr, toBool, clamp, uid, STOP } = SR.util; const W = SR.W, H = SR.H;
  const { n, s, bool, f, q } = C.helpers; const A = BL.args;
  const COLOUR_FOR = { sound: 'sounds', events: 'event' };
  const EX = BL.EXTRA;
  function add(cat, type, msg, args, shape, spriteOnly) {
    BL.def(type, COLOUR_FOR[cat] || cat, msg, args || [], shape || 'statement');
    (EX[cat] = EX[cat] || []).push(spriteOnly ? { type, spriteOnly: true } : type);
  }
  const sep = cat => (EX[cat] = EX[cat] || []).push('sep');
  const stmt = (t, g) => C.STMT[t] = g, expr = (t, g) => C.EXPR[t] = g, hat = (t, g) => C.HATS[t] = g;
  const spriteMenu = (name = 'TARGET') => A.menu(name, 'spark_menu_sprite'), targetMenu = (name = 'TARGET') => A.menu(name, 'spark_menu_target'), cloneMenu = (name = 'TARGET') => A.menu(name, 'spark_menu_clone');
  const TILES = SR.TILE_NAMES.filter(t => t !== 'empty');
  const EASE = { linear: t => t, 'ease in': t => t * t, 'ease out': t => 1 - (1 - t) * (1 - t), 'ease in-out': t => t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2, bounce: t => { const n1 = 7.5625, d1 = 2.75; if (t < 1 / d1) return n1 * t * t; if (t < 2 / d1) return n1 * (t -= 1.5 / d1) * t + 0.75; if (t < 2.5 / d1) return n1 * (t -= 2.25 / d1) * t + 0.9375; return n1 * (t -= 2.625 / d1) * t + 0.984375; }, elastic: t => t === 0 ? 0 : t === 1 ? 1 : Math.pow(2, -10 * t) * Math.sin((t * 10 - 0.75) * (2 * Math.PI) / 3) + 1, overshoot: t => 1 + 2.70158 * Math.pow(t - 1, 3) + 1.70158 * Math.pow(t - 1, 2) };

  /* =================================================================== MOTION =================================================================== */
  sep('motion');
  add('motion', 'spark_m_tween', 'move to x: %1 y: %2 in %3 secs %4', [A.num('X', 0), A.num('Y', 0), A.num('SECS', 1), A.dd('EASE', Object.keys(EASE))], 'statement', true);
  stmt('spark_m_tween', (b, c) => `await S.tween(T, ${n(c, b, 'X')}, ${n(c, b, 'Y')}, ${n(c, b, 'SECS', '1')}, ${f(c, b, 'EASE')});`);
  TP.tween = async function (T, x, y, secs, ease) {
    const fn = EASE[ease] || EASE.linear, sx = this.x, sy = this.y, t0 = this.R.time, dur = Math.max(0.001, secs);
    while (true) { await T.yield(); const k = Math.min(1, (this.R.time - t0) / dur); const e = fn(k); this.goTo(sx + (x - sx) * e, sy + (y - sy) * e); if (k >= 1) break; }
  };
  add('motion', 'spark_m_chase', 'chase %1 at speed %2 if within %3', [targetMenu(), A.num('SPEED', 3), A.num('RANGE', 300)], 'statement', true);
  stmt('spark_m_chase', (b, c) => `S.behave("chase", ${s(c, b, 'TARGET')}, ${n(c, b, 'SPEED')}, ${n(c, b, 'RANGE')});`);
  add('motion', 'spark_m_flee', 'run away from %1 at speed %2 if within %3', [targetMenu(), A.num('SPEED', 3), A.num('RANGE', 150)], 'statement', true);
  stmt('spark_m_flee', (b, c) => `S.behave("flee", ${s(c, b, 'TARGET')}, ${n(c, b, 'SPEED')}, ${n(c, b, 'RANGE')});`);
  add('motion', 'spark_m_wander', 'wander around at speed %1', [A.num('SPEED', 2)], 'statement', true);
  stmt('spark_m_wander', (b, c) => `S.behave("wander", null, ${n(c, b, 'SPEED')});`);
  add('motion', 'spark_m_patrol', 'patrol between x: %1 and x: %2 at speed %3', [A.num('X1', -150), A.num('X2', 150), A.num('SPEED', 3)], 'statement', true);
  stmt('spark_m_patrol', (b, c) => `S.patrol(${n(c, b, 'X1')}, ${n(c, b, 'X2')}, ${n(c, b, 'SPEED')});`);
  add('motion', 'spark_m_follow', 'follow %1 keeping %2 steps away at speed %3', [targetMenu(), A.num('GAP', 60), A.num('SPEED', 4)], 'statement', true);
  stmt('spark_m_follow', (b, c) => `S.behave("follow", ${s(c, b, 'TARGET')}, ${n(c, b, 'SPEED')}, ${n(c, b, 'GAP')});`);
  add('motion', 'spark_m_orbit', 'orbit around %1 radius %2 at %3 degrees per frame', [targetMenu(), A.num('RADIUS', 80), A.num('SPEED', 2)], 'statement', true);
  stmt('spark_m_orbit', (b, c) => `S.orbit(${s(c, b, 'TARGET')}, ${n(c, b, 'RADIUS')}, ${n(c, b, 'SPEED')});`);
  add('motion', 'spark_m_turntoward', 'turn toward %1 by %2 degrees', [targetMenu(), A.num('DEG', 5)], 'statement', true);
  stmt('spark_m_turntoward', (b, c) => `S.turnToward(${s(c, b, 'TARGET')}, ${n(c, b, 'DEG')});`);
  add('motion', 'spark_m_facemove', 'point in direction of movement', [], 'statement', true);
  stmt('spark_m_facemove', () => `S.faceMovement();`);
  add('motion', 'spark_m_dash', 'dash %1 with power %2', [A.dd('DIR', ['forward', 'left', 'right', 'up', 'down', 'toward mouse']), A.num('POWER', 15)], 'statement', true);
  stmt('spark_m_dash', (b, c) => `S.dash(${f(c, b, 'DIR')}, ${n(c, b, 'POWER')});`);
  add('motion', 'spark_m_snap', 'snap to grid of %1', [A.num('SIZE', 48)], 'statement', true);
  stmt('spark_m_snap', (b, c) => `S.snap(${n(c, b, 'SIZE', '48')});`);
  add('motion', 'spark_m_dirto', 'direction to %1', [targetMenu()], 'number', true);
  expr('spark_m_dirto', (b, c) => `S.directionTo(${s(c, b, 'TARGET')})`);
  add('motion', 'spark_m_distxy', 'distance to x: %1 y: %2', [A.num('X', 0), A.num('Y', 0)], 'number', true);
  expr('spark_m_distxy', (b, c) => `Math.hypot(S.x - ${n(c, b, 'X')}, S.y - ${n(c, b, 'Y')})`);
  add('motion', 'spark_m_onscreen', 'on screen?', [], 'boolean', true);
  expr('spark_m_onscreen', () => `R.onScreen(S)`);
  add('motion', 'spark_m_screenxy', 'screen %1', [A.dd('WHICH', ['x', 'y'])], 'number', true);
  expr('spark_m_screenxy', (b, c) => `R.screenPos(S, ${f(c, b, 'WHICH')})`);
  add('motion', 'spark_m_nearest', '%1 to nearest %2', [A.dd('WHICH', ['distance', 'direction']), cloneMenu()], 'number', true);
  expr('spark_m_nearest', (b, c) => `R.nearest(S, ${s(c, b, 'TARGET')}, ${f(c, b, 'WHICH')})`);
  add('motion', 'spark_m_gonearest', 'go to nearest %1', [cloneMenu()], 'statement', true);
  stmt('spark_m_gonearest', (b, c) => `{ const o = R.nearestTarget(S, ${s(c, b, 'TARGET')}); if (o) S.goTo(o.x, o.y); }`);

  TP.directionTo = function (name) { const p = this.R.pointFor(this, name); if (!p) return this.direction; return 90 - Math.atan2(p.y - this.y, p.x - this.x) * 180 / Math.PI; };
  TP.behave = function (mode, name, speed, range) {
    const p = name ? this.R.pointFor(this, name) : null;
    const dist = p ? Math.hypot(p.x - this.x, p.y - this.y) : 0;
    const step = (dx, dy, k) => { const L = Math.hypot(dx, dy) || 1; const vx = dx / L * k, vy = dy / L * k; if (this.phys.mode !== 'off') { this.phys.vx = vx; if (this.phys.mode === 'top-down') this.phys.vy = vy; } else this.goTo(this.x + vx, this.y + vy); if (this.rotationStyle === 'left-right' && vx) this.direction = vx > 0 ? 90 : -90; };
    if (mode === 'chase' && p && dist <= range && dist > 2) step(p.x - this.x, p.y - this.y, speed);
    else if (mode === 'flee' && p && dist <= range) step(this.x - p.x, this.y - p.y, speed);
    else if (mode === 'follow' && p && dist > range) step(p.x - this.x, p.y - this.y, Math.min(speed, dist - range));
    else if (mode === 'wander') { this._wander = this._wander || { dir: Math.random() * 360, t: 0 }; this._wander.t -= 1; if (this._wander.t <= 0) { this._wander.dir = Math.random() * 360; this._wander.t = 30 + Math.random() * 60; } const r = this._wander.dir * Math.PI / 180; const bx = this.x, by = this.y; step(Math.sin(r), Math.cos(r), speed); if (this.phys.mode === 'off' && this.R.world.active && this.R.world.solidRects(this.bounds()).length) { this.goTo(bx, by); this._wander.t = 0; } }
    else if (this.phys.mode === 'top-down') { this.phys.vx *= 0.8; this.phys.vy *= 0.8; }
  };
  TP.patrol = function (x1, x2, speed) { const lo = Math.min(x1, x2), hi = Math.max(x1, x2); if (this._patrolDir === undefined) this._patrolDir = 1; if (this.x >= hi) this._patrolDir = -1; if (this.x <= lo) this._patrolDir = 1; if (this.phys.mode !== 'off') this.phys.vx = this._patrolDir * speed; else this.goTo(this.x + this._patrolDir * speed, this.y); if (this.rotationStyle === 'left-right') this.direction = this._patrolDir > 0 ? 90 : -90; };
  TP.orbit = function (name, radius, speed) { const p = this.R.pointFor(this, name); if (!p) return; this._orbit = (this._orbit || 0) + speed; const r = this._orbit * Math.PI / 180; this.goTo(p.x + Math.cos(r) * radius, p.y + Math.sin(r) * radius); };
  TP.turnToward = function (name, deg) { const target = this.directionTo(name); let d = ((target - this.direction + 540) % 360) - 180; this.setDirection(this.direction + clamp(d, -Math.abs(deg), Math.abs(deg))); };
  TP.faceMovement = function () { const vx = this.phys.mode !== 'off' ? this.phys.vx : this.x - (this._lx ?? this.x), vy = this.phys.mode !== 'off' ? this.phys.vy : this.y - (this._ly ?? this.y); if (Math.hypot(vx, vy) > 0.1) this.setDirection(90 - Math.atan2(vy, vx) * 180 / Math.PI); };
  TP.dash = function (dir, power) { let a = this.direction; if (dir === 'left') a = -90; else if (dir === 'right') a = 90; else if (dir === 'up') a = 0; else if (dir === 'down') a = 180; else if (dir === 'toward mouse') a = this.directionTo('_mouse_'); const r = a * Math.PI / 180; if (this.phys.mode === 'off') this.setPhysics('top-down'); this.phys.vx = Math.sin(r) * power; this.phys.vy = Math.cos(r) * power; };
  TP.snap = function (size) { size = Math.max(1, size); this.goTo(Math.round(this.x / size) * size, Math.round(this.y / size) * size); };
  RP.onScreen = function (t) { const v = this.viewRect(t.sticky), b = t.bounds(); return this.aabb(b, v); };
  RP.screenPos = function (t, which) { const z = this.cam.zoom; return which === 'x' ? (t.x - this.cam.x) * z : (t.y - this.cam.y) * z; };
  RP.nearestTarget = function (S, name) { const orig = this.findTarget(S, name); if (!orig) return null; let best = null, bd = Infinity; for (const o of this.targets) { if (o === S || !o.visible) continue; if (o !== orig && o.original !== orig) continue; const d = Math.hypot(o.x - S.x, o.y - S.y); if (d < bd) { bd = d; best = o; } } return best; };
  RP.nearest = function (S, name, which) { const o = this.nearestTarget(S, name); if (!o) return which === 'distance' ? 10000 : S.direction; return which === 'distance' ? Math.hypot(o.x - S.x, o.y - S.y) : 90 - Math.atan2(o.y - S.y, o.x - S.x) * 180 / Math.PI; };

  /* =================================================================== PHYSICS =================================================================== */
  sep('physics');
  add('physics', 'spark_p_veltoward', 'set velocity toward %1 speed %2', [targetMenu(), A.num('SPEED', 8)], 'statement', true);
  stmt('spark_p_veltoward', (b, c) => `{ const d = S.directionTo(${s(c, b, 'TARGET')}) * Math.PI / 180, sp = ${n(c, b, 'SPEED')}; S.phys.vx = Math.sin(d) * sp; S.phys.vy = Math.cos(d) * sp; }`);
  add('physics', 'spark_p_knockback', 'knockback away from %1 with power %2', [targetMenu(), A.num('POWER', 10)], 'statement', true);
  stmt('spark_p_knockback', (b, c) => `S.knockback(${s(c, b, 'TARGET')}, ${n(c, b, 'POWER')});`);
  add('physics', 'spark_p_oneway', 'make this sprite a %1', [A.dd('KIND', ['one-way platform (jump through from below)', 'normal solid', 'ladder', 'water'])], 'statement', true);
  stmt('spark_p_oneway', (b, c) => `S.setSolidKind(${f(c, b, 'KIND')});`);
  add('physics', 'spark_p_wall', 'touching a wall on the %1?', [A.dd('SIDE', ['left', 'right', 'any side'])], 'boolean', true);
  expr('spark_p_wall', (b, c) => `S.wallSide(${f(c, b, 'SIDE')})`);
  add('physics', 'spark_p_climb', 'climb ladders with %1 at speed %2', [A.dd('KEYS', ['arrow keys', 'WASD']), A.num('SPEED', 4)], 'statement', true);
  stmt('spark_p_climb', (b, c) => `S.climb(${f(c, b, 'KEYS')}, ${n(c, b, 'SPEED')});`);
  add('physics', 'spark_p_walljump', 'wall jump with power %1', [A.num('POWER', 12)], 'statement', true);
  stmt('spark_p_walljump', (b, c) => `S.wallJump(${n(c, b, 'POWER')});`);
  add('physics', 'spark_p_moving', 'carried by moving platforms %1', [A.dd('ON', ['on', 'off'])], 'statement', true);
  stmt('spark_p_moving', (b, c) => `S.phys.carried = ${f(c, b, 'ON')} === "on";`);
  add('physics', 'spark_p_speed', 'speed', [], 'number', true);
  expr('spark_p_speed', () => `Math.hypot(S.phys.vx, S.phys.vy)`);
  TP.knockback = function (name, power) { const p = this.R.pointFor(this, name); if (!p) return; const dx = this.x - p.x, dy = this.y - p.y, L = Math.hypot(dx, dy) || 1; if (this.phys.mode === 'off') this.setPhysics('top-down'); this.phys.vx = dx / L * power; this.phys.vy = this.phys.mode === 'platformer' ? Math.max(4, power * 0.6) : dy / L * power; this.phys.onGround = false; };
  TP.setSolidKind = function (kind) { this.phys.solid = kind.startsWith('one-way') || kind === 'normal solid'; this.phys.oneWay = kind.startsWith('one-way'); this.phys.ladder = kind === 'ladder'; this.phys.water = kind === 'water'; };
  TP.wallSide = function (side) { const w = this.phys.wall || 0; return side === 'left' ? w < 0 : side === 'right' ? w > 0 : w !== 0; };
  TP.climb = function (keys, speed) {
    const R = this.R, b = this.bounds(); const ladder = R.sprites().find(o => o !== this && o.phys.ladder && o.visible && R.aabb(b, o.bounds()));
    if (!ladder) { this.phys.onLadder = false; return; }
    const wasd = keys === 'WASD'; const up = R.keyPressed(wasd ? 'w' : 'up arrow') || R.pad.button(1, 'up'), down = R.keyPressed(wasd ? 's' : 'down arrow') || R.pad.button(1, 'down');
    this.phys.onLadder = true; this.phys.vy = (up ? speed : 0) - (down ? speed : 0); this.phys.onGround = true;
  };
  TP.wallJump = function (power) { if (this.phys.wall && !this.phys.onGround) { this.phys.vy = power; this.phys.vx = -this.phys.wall * power * 0.7; this.phys.wall = 0; } };
  const origJump = TP.jump;
  TP.jump = function (power) { const p = this.phys; if (p.mode === 'off') this.setPhysics('platformer'); const coyote = p.leftGroundAt != null && this.R.time - p.leftGroundAt < 0.12 && p.vy <= 0; if (p.onGround || coyote) { p.vy = power; p.onGround = false; p.leftGroundAt = null; } };
  // physics step with one-way platforms, ladders, water, moving platforms, wall contact and coyote time
  RP.physicsStep = function () {
    const solids = this.targets.filter(t => t.phys.solid && t.visible);
    for (const t of this.targets) {
      const p = t.phys; if (p.mode === 'off' || !t.visible) { t._lx = t.x; t._ly = t.y; continue; }
      const b0 = t.bounds();
      const inWater = this.sprites().some(o => o !== t && o.phys.water && o.visible && this.aabb(b0, o.bounds()));
      if (p.mode === 'platformer' && !p.onLadder) p.vy -= p.gravity * (inWater ? 0.25 : 1); else if (p.mode === 'top-down') { p.vx *= p.friction; p.vy *= p.friction; if (Math.abs(p.vx) < 0.05) p.vx = 0; if (Math.abs(p.vy) < 0.05) p.vy = 0; }
      if (inWater) { p.vx *= 0.92; p.vy *= 0.9; }
      const sp = Math.hypot(p.vx, p.vy); if (sp > p.maxSpeed) { p.vx *= p.maxSpeed / sp; p.vy *= p.maxSpeed / sp; }
      const mine = solids.filter(s => s !== t && s.original !== t && t.original !== s);
      const rectsFor = (b, axis) => mine.filter(s => !(s.phys.oneWay && (axis === 'x' || p.vy > 0 || b0.bottom < s.bounds().top - 1))).map(s => Object.assign(s.bounds(), { _s: s })).concat(this.world.solidRects(b));
      p.wall = 0;
      if (p.vx) { t.goTo(t.x + p.vx, t.y); let b = t.bounds(); for (const o of rectsFor(b, 'x')) { if (this.aabb(b, o)) { p.wall = p.vx > 0 ? 1 : -1; if (p.vx > 0) t.x -= (b.right - o.left) + 0.01; else t.x += (o.right - b.left) + 0.01; p.vx = -p.vx * p.bounce; if (Math.abs(p.vx) < 0.5) p.vx = 0; b = t.bounds(); } } }
      let landed = false, ride = null;
      t.goTo(t.x, t.y + p.vy); let b = t.bounds();
      for (const o of rectsFor(b, 'y')) { if (this.aabb(b, o)) { if (p.vy <= 0) { t.y += (o.top - b.bottom) + 0.01; landed = true; ride = o._s || null; } else t.y -= (b.top - o.bottom) + 0.01; p.vy = -p.vy * p.bounce; if (Math.abs(p.vy) < 1) p.vy = 0; b = t.bounds(); } }
      if (p.mode === 'platformer') {
        if (p.onGround && !landed && !p.onLadder) p.leftGroundAt = this.time; if (landed) p.leftGroundAt = null;
        p.onGround = landed || !!p.onLadder; if (landed) { p.vx *= p.friction; if (Math.abs(p.vx) < 0.05) p.vx = 0; }
        if (ride && p.carried !== false && ride._lx != null) { const dx = ride.x - ride._lx, dy = ride.y - ride._ly; if (dx || dy) t.goTo(t.x + dx, t.y + dy); }
      } else p.onGround = true;
      p.onLadder = false;
    }
    for (const t of this.targets) { t._lx = t.x; t._ly = t.y; }
  };

  /* =================================================================== PREMADE BEHAVIOURS (one block = a whole game piece) =================================================================== */
  sep('game');
  add('game', 'spark_pre_player', 'set me up as a %1 player', [A.dd('KIND', ['platformer', 'top-down'])], 'statement', true);
  stmt('spark_pre_player', (b, c) => `S.presetPlayer(${f(c, b, 'KIND')});`);
  add('game', 'spark_pre_coin', 'act like a coin for %1 worth %2 points', [targetMenu(), A.num('PTS', 1)], 'statement', true);
  stmt('spark_pre_coin', (b, c) => `S.actCoin(${s(c, b, 'TARGET')}, ${n(c, b, 'PTS', '1')});`);
  add('game', 'spark_pre_chaser', 'act like an enemy chasing %1 at speed %2, %3 damage', [targetMenu(), A.num('SPEED', 2), A.num('DMG', 5)], 'statement', true);
  stmt('spark_pre_chaser', (b, c) => `S.actChaser(${s(c, b, 'TARGET')}, ${n(c, b, 'SPEED')}, ${n(c, b, 'DMG')});`);
  add('game', 'spark_pre_patrol', 'act like a patrolling enemy at speed %1 (hurts %2, squashable)', [A.num('SPEED', 2), targetMenu()], 'statement', true);
  stmt('spark_pre_patrol', (b, c) => `S.actPatroller(${n(c, b, 'SPEED')}, ${s(c, b, 'TARGET')});`);
  add('game', 'spark_pre_bullet', 'act like a bullet at speed %1 that hits %2', [A.num('SPEED', 12), cloneMenu()], 'statement', true);
  stmt('spark_pre_bullet', (b, c) => `S.actBullet(${n(c, b, 'SPEED')}, ${s(c, b, 'TARGET')});`);
  add('game', 'spark_pre_platform', 'act like a moving platform between x: %1 and x: %2 at speed %3', [A.num('X1', -150), A.num('X2', 150), A.num('SPEED', 2)], 'statement', true);
  stmt('spark_pre_platform', (b, c) => `S.actPlatform(${n(c, b, 'X1')}, ${n(c, b, 'X2')}, ${n(c, b, 'SPEED')});`);
  add('game', 'spark_pre_hazard', 'act like a hazard that hurts %1 by %2', [targetMenu(), A.num('DMG', 10)], 'statement', true);
  stmt('spark_pre_hazard', (b, c) => `S.actHazard(${s(c, b, 'TARGET')}, ${n(c, b, 'DMG')});`);
  add('game', 'spark_pre_goal', 'act like the goal for %1 (win when touched)', [targetMenu()], 'statement', true);
  stmt('spark_pre_goal', (b, c) => `S.actGoal(${s(c, b, 'TARGET')});`);
  TP.presetPlayer = function (kind) {
    this.setPhysics(kind === 'top-down' ? 'top-down' : 'platformer'); this.rotationStyle = 'left-right'; this.visible = true;
    if (this.R.world.active) this.goToWorldStart(); this.R.cam.follow = this; this.R.cameraInsideWorld();
    this.hp.show = false; this.R.game.hud('score', true); this.R.game.hud('lives', true);
    if (!this.sounds.some(sn => sn.name === 'Jump')) this.sounds.push({ name: 'Jump', preset: 'Jump' });
    this.phys.carried = true;
  };
  TP.actCoin = function (name, pts) { this.R.game.hud('score', true); this.goTo(this.x, this.y + Math.sin(this.R.time * 5) * 0.6); if (this.touching(name)) { this.R.game.change('score', pts); this.playPreset('Coin'); this.R.particles.burst('coins', this.x, this.y); this.R.floatText('+' + toStr(pts), this.x, this.y + 20, '#ffd740'); if (this.isClone) { this.R.deleteClone(this); throw STOP; } this.visible = false; } };
  TP.actChaser = function (name, speed, dmg) {
    if (this.phys.mode === 'off') this.setPhysics(this.R.world.sideView ? 'platformer' : 'top-down');
    this.behave('chase', name, speed, 100000);
    const t = this.R.findTarget(this, name); if (!t) return; this.R.game.hud('health', true);
    if (this.touching(name) && this.R.time >= (t.hp.invUntil || 0)) { this.R.game.change('health', -dmg); t.hp.invUntil = this.R.time + 0.5; t.tintFor('#ff0000', 0.2); this.playPreset('Hit'); this.R.cam.shakeFor(5, 0.2); }
  };
  TP.actPatroller = function (speed, name) {
    if (this.phys.mode === 'off') { this.setPhysics(this.R.world.sideView ? 'platformer' : 'top-down'); this.rotationStyle = 'left-right'; }
    if (this._pdir === undefined) this._pdir = 1;
    this.phys.vx = this._pdir * speed; if (this.phys.mode === 'top-down') this.phys.vy = 0;
    const b = this.bounds(); const ahead = { left: b.left + this._pdir * speed * 2, right: b.right + this._pdir * speed * 2, top: b.top, bottom: b.bottom };
    const blocked = this.phys.wall || this.R.world.solidRects(ahead).some(r => this.R.aabb(ahead, r)) || (this.phys.mode === 'platformer' && this.R.world.active && this.phys.onGround && !this.R.world.isSolid(this.R.world.get(this.R.world.colOf(this._pdir > 0 ? b.right + 4 : b.left - 4), this.R.world.rowOf(b.bottom - 4)))) || this.touchingEdge(this._pdir > 0 ? 'right' : 'left');
    if (blocked) this._pdir = -this._pdir;
    this.direction = this._pdir > 0 ? 90 : -90;
    const t = this.R.findTarget(this, name); if (!t || !this.touching(name)) return;
    if (t.phys.mode === 'platformer' && t.phys.vy < 0 && t.y > this.y + 10) { this.playPreset('Pop'); this.R.particles.burst('smoke', this.x, this.y); this.R.game.change('score', 2); t.phys.vy = 8; if (this.isClone) { this.R.deleteClone(this); throw STOP; } this.visible = false; }
    else if (this.R.time >= (t.hp.invUntil || 0)) { this.R.game.change('lives', -1); this.R.game.hud('lives', true); t.hp.invUntil = this.R.time + 1; t.tintFor('#ff0000', 0.3); this.playPreset('Hit'); this.R.cam.shakeFor(8, 0.3); t.knockback(this.name, 8); }
  };
  TP.actBullet = function (speed, name) { this.move(speed); if (this.touching(name)) { this.R.hurt(this, name, 10); this.R.game.change('score', 1); this.R.particles.burst('sparkles', this.x, this.y, 0.6); if (this.isClone) { this.R.deleteClone(this); throw STOP; } this.visible = false; return; } if (this.touchingEdge('any') || (this.R.world.active && this.R.world.solidRects(this.bounds()).length)) { if (this.isClone) { this.R.deleteClone(this); throw STOP; } this.visible = false; } };
  TP.actPlatform = function (x1, x2, speed) { this.phys.solid = true; this.patrol(x1, x2, speed); if (this.phys.mode !== 'off') this.phys.mode = 'off'; this.goTo(this.x + (this._patrolDir || 1) * speed, this.y); };
  TP.actHazard = function (name, dmg) { const t = this.R.findTarget(this, name); if (!t) return; if (this.touching(name) && this.R.time >= (t.hp.invUntil || 0)) { this.R.game.hud('health', true); this.R.game.change('health', -dmg); t.hp.invUntil = this.R.time + 0.6; t.tintFor('#ff0000', 0.2); this.playPreset('Hit'); } };
  TP.actGoal = function (name) { if (this.touching(name)) { this.playPreset('Win'); this.R.particles.burst('confetti', this.x, this.y, 1.5); this.R.game.over('Level complete!', true); throw STOP; } };

  /* =================================================================== GAME: HEALTH, COMBAT, LEVELS, XP, INVENTORY, SAVING =================================================================== */
  sep('game');
  add('game', 'spark_g_sethp', 'set my health to %1', [A.num('HP', 100)], 'statement', true);
  stmt('spark_g_sethp', (b, c) => `S.setHp(${n(c, b, 'HP')}, true);`);
  add('game', 'spark_g_chhp', 'change my health by %1', [A.num('HP', -10)], 'statement', true);
  stmt('spark_g_chhp', (b, c) => `S.setHp(S.hp.value + ${n(c, b, 'HP')});`);
  add('game', 'spark_g_hp', 'my health', [], 'number', true);
  expr('spark_g_hp', () => `S.hp.value`);
  add('game', 'spark_g_hpbar', 'show health bar above me %1', [A.dd('ON', ['on', 'off'])], 'statement', true);
  stmt('spark_g_hpbar', (b, c) => `S.hp.show = ${f(c, b, 'ON')} === "on";`);
  add('game', 'spark_g_whenhp0', 'when my health reaches 0', [], 'hat', true);
  hat('spark_g_whenhp0', () => ({ hat: 'hp0' }));
  add('game', 'spark_g_hurt', 'hurt %1 by %2', [cloneMenu(), A.num('DMG', 10)], 'statement', true);
  stmt('spark_g_hurt', (b, c) => `R.hurt(S, ${s(c, b, 'TARGET')}, ${n(c, b, 'DMG')});`);
  add('game', 'spark_g_invincible', 'become invincible for %1 seconds', [A.num('SECS', 1)], 'statement', true);
  stmt('spark_g_invincible', (b, c) => `S.hp.invUntil = R.time + ${n(c, b, 'SECS')};`);
  add('game', 'spark_g_isinv', 'invincible?', [], 'boolean', true);
  expr('spark_g_isinv', () => `(R.time < S.hp.invUntil)`);
  add('game', 'spark_g_shoot', 'shoot %1 toward %2 at speed %3', [cloneMenu(), A.dd('AIM', ['my direction', 'mouse-pointer', 'nearest enemy']), A.num('SPEED', 12)], 'statement', true);
  stmt('spark_g_shoot', (b, c) => `R.shoot(S, ${s(c, b, 'TARGET')}, ${f(c, b, 'AIM')}, ${n(c, b, 'SPEED')});`);
  add('game', 'spark_g_spawner', 'spawn %1 every %2 seconds at a random free spot', [cloneMenu(), A.num('SECS', 3)], 'statement', true);
  stmt('spark_g_spawner', (b, c) => `S.spawner = { name: ${s(c, b, 'TARGET')}, every: Math.max(0.1, ${n(c, b, 'SECS')}), acc: 0 };`);
  add('game', 'spark_g_stopspawner', 'stop spawning', [], 'statement', true);
  stmt('spark_g_stopspawner', () => `S.spawner = null;`);
  add('game', 'spark_g_los', 'can see %1? (no walls between)', [targetMenu()], 'boolean', true);
  expr('spark_g_los', (b, c) => `R.lineOfSight(S, ${s(c, b, 'TARGET')})`);
  sep('game');
  add('game', 'spark_g_level', 'go to level %1', [A.num('LEVEL', 2)]);
  stmt('spark_g_level', (b, c) => `R.goToLevel(${n(c, b, 'LEVEL')});`);
  add('game', 'spark_g_nextlevel', 'next level', []);
  stmt('spark_g_nextlevel', () => `R.goToLevel(R.game.get("level") + 1);`);
  add('game', 'spark_g_whenlevel', 'when a level starts', [], 'hat');
  hat('spark_g_whenlevel', () => ({ hat: 'levelstart' }));
  add('game', 'spark_g_checkpoint', 'checkpoint here', [], 'statement', true);
  stmt('spark_g_checkpoint', () => `S.checkpoint = { x: S.x, y: S.y }; R.toast("Checkpoint!", 1);`);
  add('game', 'spark_g_respawn', 'respawn at checkpoint', [], 'statement', true);
  stmt('spark_g_respawn', () => `{ const cp = S.checkpoint || R.world.start; S.goTo(cp.x, cp.y); S.phys.vx = 0; S.phys.vy = 0; }`);
  add('game', 'spark_g_xp', 'change XP by %1', [A.num('XP', 10)]);
  stmt('spark_g_xp', (b, c) => `R.addXp(${n(c, b, 'XP')});`);
  add('game', 'spark_g_getxp', '%1', [A.dd('WHICH', ['XP', 'XP level', 'XP to next level'])], 'number');
  expr('spark_g_getxp', (b, c) => `R.xpInfo(${f(c, b, 'WHICH')})`);
  add('game', 'spark_g_whenlevelup', 'when I level up', [], 'hat');
  hat('spark_g_whenlevelup', () => ({ hat: 'levelup' }));
  add('game', 'spark_g_spend', 'spend %1 coins?', [A.num('N', 10)], 'boolean');
  expr('spark_g_spend', (b, c) => `R.spend(${n(c, b, 'N')})`);
  sep('game');
  add('game', 'spark_g_invadd', 'add %1 to inventory', [A.txt('ITEM', 'key')]);
  stmt('spark_g_invadd', (b, c) => `R.inv(${s(c, b, 'ITEM')}, 1);`);
  add('game', 'spark_g_invremove', 'remove %1 from inventory', [A.txt('ITEM', 'key')]);
  stmt('spark_g_invremove', (b, c) => `R.inv(${s(c, b, 'ITEM')}, -1);`);
  add('game', 'spark_g_invhas', 'have %1?', [A.txt('ITEM', 'key')], 'boolean');
  expr('spark_g_invhas', (b, c) => `(R.inventory[${s(c, b, 'ITEM')}] > 0)`);
  add('game', 'spark_g_invcount', 'how many %1', [A.txt('ITEM', 'key')], 'number');
  expr('spark_g_invcount', (b, c) => `(R.inventory[${s(c, b, 'ITEM')}] || 0)`);
  add('game', 'spark_g_invshow', 'show inventory %1', [A.dd('ON', ['on', 'off'])]);
  stmt('spark_g_invshow', (b, c) => `R.showInventory = ${f(c, b, 'ON')} === "on";`);
  add('game', 'spark_g_invtext', 'inventory as text', [], 'string');
  expr('spark_g_invtext', () => `Object.entries(R.inventory).filter(e => e[1] > 0).map(e => e[0] + (e[1] > 1 ? " x" + e[1] : "")).join(", ")`);
  sep('game');
  add('game', 'spark_g_save', 'save game to slot %1', [A.num('SLOT', 1)]);
  stmt('spark_g_save', (b, c) => `R.saveGame(${n(c, b, 'SLOT', '1')});`);
  add('game', 'spark_g_loadgame', 'load game from slot %1', [A.num('SLOT', 1)]);
  stmt('spark_g_loadgame', (b, c) => `R.loadGame(${n(c, b, 'SLOT', '1')});`);
  add('game', 'spark_g_hassave', 'saved game in slot %1?', [A.num('SLOT', 1)], 'boolean');
  expr('spark_g_hassave', (b, c) => `(R.load("slot" + ${n(c, b, 'SLOT', '1')}) !== 0)`);
  add('game', 'spark_g_later', 'in %1 seconds broadcast %2', [A.num('SECS', 2), A.menu('MSG', 'event_broadcast_menu')]);
  stmt('spark_g_later', (b, c) => `R.later(${n(c, b, 'SECS')}, ${s(c, b, 'MSG')});`);
  add('game', 'spark_g_freeze', 'freeze everything for %1 seconds', [A.num('SECS', 0.5)]);
  stmt('spark_g_freeze', (b, c) => `R.freeze(${n(c, b, 'SECS')});`);
  add('game', 'spark_g_timefmt', 'time as %1', [A.dd('FMT', ['mm:ss', 'seconds', 'countdown mm:ss'])], 'string');
  expr('spark_g_timefmt', (b, c) => `R.timeFormat(${f(c, b, 'FMT')})`);
  add('game', 'spark_g_seed', 'set random seed to %1', [A.num('SEED', 1)]);
  stmt('spark_g_seed', (b, c) => `R.setSeed(${n(c, b, 'SEED')});`);
  add('game', 'spark_g_photo', 'save a picture of the stage', []);
  stmt('spark_g_photo', () => `R.photo();`);
  add('game', 'spark_g_vibrate', 'vibrate phone for %1 ms', [A.num('MS', 100)]);
  stmt('spark_g_vibrate', (b, c) => `navigator.vibrate && navigator.vibrate(${n(c, b, 'MS')});`);
  add('game', 'spark_g_fullscreen', 'go fullscreen', []);
  stmt('spark_g_fullscreen', () => `R.canvas.parentElement.requestFullscreen && R.canvas.parentElement.requestFullscreen().catch(() => {});`);
  sep('game');
  add('game', 'spark_g_submit', 'submit score to online leaderboard as %1', [A.txt('NAME', 'player')]);
  stmt('spark_g_submit', (b, c) => `R.submitScore(${s(c, b, 'NAME')});`);
  add('game', 'spark_g_board', 'show online leaderboard %1', [A.dd('ON', ['on', 'off'])]);
  stmt('spark_g_board', (b, c) => `R.showBoard(${f(c, b, 'ON')} === "on");`);
  add('game', 'spark_g_boardget', 'leaderboard #%1 %2', [A.num('RANK', 1), A.dd('WHICH', ['name', 'score'])], 'string');
  expr('spark_g_boardget', (b, c) => `R.boardGet(${n(c, b, 'RANK', '1')}, ${f(c, b, 'WHICH')})`);
  add('game', 'spark_g_online', 'broadcast %1 to everyone online', [A.menu('MSG', 'event_broadcast_menu')]);
  stmt('spark_g_online', (b, c) => `R.onlineBroadcast(${s(c, b, 'MSG')});`);
  add('game', 'spark_g_players', 'players online', [], 'number');
  expr('spark_g_players', () => `R.playersOnline()`);

  TP.setHp = function (v, isMax) { const h = this.hp; const was = h.value; if (isMax) h.max = Math.max(1, v); h.value = clamp(v, 0, h.max); if (was > 0 && h.value <= 0) this.R.startHats(sc => sc.hat === 'hp0', true, [this]); };
  RP.hurt = function (S, name, dmg) { const orig = this.findTarget(S, name); if (!orig) return; for (const o of this.targets) { if (o === S || (o !== orig && o.original !== orig) || !o.visible) continue; if (this.time < o.hp.invUntil) continue; if (!this.aabb(S.bounds(), o.bounds()) || !this.pixelOverlap(S, o)) continue; o.setHp(o.hp.value - dmg); o.tintFor('#ff0000', 0.15); o.hp.invUntil = this.time + 0.3; this.floatText('-' + toStr(dmg), o.x, o.y + 30, '#ff5252'); } };
  RP.shoot = function (S, name, aim, speed) {
    const c = this.createClone(S, name); if (!c) return;
    let dir = S.direction; if (aim === 'mouse-pointer') dir = S.directionTo('_mouse_'); else if (aim === 'nearest enemy') { const e = this.targets.find(t => t.visible && t !== S && t.name !== S.name && !t.phys.solid && t.original !== S); dir = e ? 90 - Math.atan2(e.y - S.y, e.x - S.x) * 180 / Math.PI : dir; }
    c.x = S.x; c.y = S.y; c.visible = true; c.setDirection(dir); const r = dir * Math.PI / 180; c.proj = { vx: Math.sin(r) * speed, vy: Math.cos(r) * speed, born: this.time }; c.phys.mode = 'off';
  };
  RP.lineOfSight = function (S, name) {
    const p = this.pointFor(S, name); if (!p) return false; const Wd = this.world; if (!Wd.active) return true;
    const steps = Math.ceil(Math.hypot(p.x - S.x, p.y - S.y) / (Wd.size / 2)); for (let i = 1; i < steps; i++) { const k = i / steps; const x = S.x + (p.x - S.x) * k, y = S.y + (p.y - S.y) * k; if (Wd.isSolid(Wd.get(Wd.colOf(x), Wd.rowOf(y)))) return false; } return true;
  };
  RP.goToLevel = function (lv) { this.game.set('level', Math.max(1, Math.round(lv))); this.toast('Level ' + this.game.get('level'), 1.5); this.startHats(s => s.hat === 'levelstart'); };
  RP.addXp = function (d) { this.xp = (this.xp || 0) + d; let lv = this.xpLevel || 1; let leveled = false; while (this.xp >= lv * 100) { this.xp -= lv * 100; lv++; leveled = true; } this.xpLevel = lv; if (leveled) { this.toast('Level up! ' + lv, 2); this.particles.burst('stars', this.cam.x, this.cam.y, 1.5); this.startHats(s => s.hat === 'levelup'); } };
  RP.xpInfo = function (w) { return w === 'XP' ? (this.xp || 0) : w === 'XP level' ? (this.xpLevel || 1) : (this.xpLevel || 1) * 100 - (this.xp || 0); };
  RP.spend = function (nCoins) { if (this.game.get('coins') >= nCoins) { this.game.change('coins', -nCoins); return true; } return false; };
  RP.inv = function (item, d) { item = toStr(item); this.inventory[item] = Math.max(0, (this.inventory[item] || 0) + d); if (this.inventory[item] === 0) delete this.inventory[item]; };
  RP.saveGame = function (slot) {
    const data = { vars: { ...this.stage.vars }, lists: this.stage.lists, stats: { ...this.game.stats }, inventory: this.inventory, xp: this.xp || 0, xpLevel: this.xpLevel || 1, sprites: this.originals().map(t => ({ name: t.name, x: t.x, y: t.y, dir: t.direction, costume: t.currentCostume, visible: t.visible, hp: t.hp.value, vars: t.vars })), world: this.world.active ? { type: this.world.type, w: this.world.w, h: this.world.h, tiles: Array.from(this.world.tiles), start: this.world.start, sideView: this.world.sideView } : null };
    this.save('slot' + slot, data); this.toast('Game saved', 1.5);
  };
  RP.loadGame = function (slot) {
    const d = this.load('slot' + slot); if (!d || !d.sprites) { this.toast('No saved game', 1.5); return; }
    Object.assign(this.stage.vars, d.vars || {}); for (const k in d.lists || {}) this.stage.lists[k] = d.lists[k]; Object.assign(this.game.stats, d.stats || {}); this.inventory = d.inventory || {}; this.xp = d.xp || 0; this.xpLevel = d.xpLevel || 1;
    for (const sd of d.sprites) { const t = this.findTarget(null, sd.name); if (!t) continue; t.goTo(sd.x, sd.y); t.direction = sd.dir; t.currentCostume = sd.costume; t.visible = sd.visible; t.hp.value = sd.hp; Object.assign(t.vars, sd.vars || {}); }
    if (d.world) { const Wd = this.world; Wd.w = d.world.w; Wd.h = d.world.h; Wd.tiles = Uint8Array.from(d.world.tiles); Wd.type = d.world.type; Wd.start = d.world.start; Wd.sideView = d.world.sideView; this.cameraInsideWorld(); }
    this.toast('Game loaded', 1.5);
  };
  RP.later = function (secs, msg) { this.timers.push({ at: this.time + secs, msg }); };
  RP.freeze = function (secs) { this.frozenUntil = performance.now() + secs * 1000; this._savedScale = this.timeScale; this.timeScale = 0; };
  RP.timeFormat = function (fmt) { const t = fmt === 'countdown mm:ss' ? this.game.countdown() : this.timer(); if (fmt === 'seconds') return Math.floor(t); const m = Math.floor(t / 60), sN = Math.floor(t % 60); return m + ':' + String(sN).padStart(2, '0'); };
  RP.setSeed = function (seed) { const r = SR.util.rng(seed); this.random = function (a, b) { const na = toNum(a), nb = toNum(b), lo = Math.min(na, nb), hi = Math.max(na, nb); const ints = Number.isInteger(na) && Number.isInteger(nb); return ints ? lo + Math.floor(r() * (hi - lo + 1)) : lo + r() * (hi - lo); }; };
  RP.photo = function () { try { const a = document.createElement('a'); a.href = this.canvas.toDataURL('image/png'); a.download = (this.projectName || 'spark') + '.png'; a.click(); } catch (e) {} };
  RP.submitScore = function (name) { this.cloudEnsure(); const base = window.SPARK_CLOUD_URL || ''; fetch(`${base}/api/cloud/${this.cloudId}/leaderboard`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ name: toStr(name), score: this.game.get('score') }) }).then(r => r.json()).then(b => { this.leaderboard = b; }).catch(() => {}); };
  RP.showBoard = function (on) { this.boardVisible = on; if (on) { this.cloudEnsure(); const base = window.SPARK_CLOUD_URL || ''; fetch(`${base}/api/cloud/${this.cloudId}/leaderboard`).then(r => r.json()).then(b => { this.leaderboard = b; }).catch(() => {}); } };
  RP.boardGet = function (rank, which) { const e = (this.leaderboard || [])[Math.round(rank) - 1]; return e ? (which === 'name' ? e.name : e.score) : ''; };
  RP.onlineBroadcast = function (msg) { this.cloudEnsure(); const base = window.SPARK_CLOUD_URL || ''; fetch(`${base}/api/cloud/${this.cloudId}/broadcast`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ name: toStr(msg) }) }).catch(() => {}); };
  RP.playersOnline = function () { this.cloudEnsure(); if (!this._playersAt || performance.now() - this._playersAt > 4000) { this._playersAt = performance.now(); const base = window.SPARK_CLOUD_URL || ''; fetch(`${base}/api/cloud/${this.cloudId}/players`).then(r => r.json()).then(j => { this._players = j.players; }).catch(() => {}); } return this._players || 1; };

  /* =================================================================== LOOKS & EFFECTS =================================================================== */
  sep('looks');
  add('looks', 'spark_l_opacity', 'set opacity to %1 %', [A.num('PCT', 50)], 'statement', true);
  stmt('spark_l_opacity', (b, c) => `S.setEffect("GHOST", 100 - ${n(c, b, 'PCT')});`);
  add('looks', 'spark_l_tint', 'set color tint to %1', [A.col('COLOR', '#ff8800')], 'statement', true);
  stmt('spark_l_tint', (b, c) => `S.tint = { color: ${s(c, b, 'COLOR')}, until: Infinity };`);
  add('looks', 'spark_l_untint', 'clear color tint', [], 'statement', true);
  stmt('spark_l_untint', () => `S.tint = null;`);
  add('looks', 'spark_l_outline', 'outline %1 color %2 thickness %3', [A.dd('ON', ['on', 'off']), A.col('COLOR', '#000000'), A.num('SIZE', 2)], 'statement', true);
  stmt('spark_l_outline', (b, c) => `S.outline = ${f(c, b, 'ON')} === "on" ? { color: ${s(c, b, 'COLOR')}, size: Math.max(1, ${n(c, b, 'SIZE')}) } : null;`);
  add('looks', 'spark_l_stretch', 'stretch width %1 % height %2 %', [A.num('X', 100), A.num('Y', 100)], 'statement', true);
  stmt('spark_l_stretch', (b, c) => `S.stretch = { x: ${n(c, b, 'X', '100')} / 100, y: ${n(c, b, 'Y', '100')} / 100 };`);
  add('looks', 'spark_l_layer', 'go to layer %1', [A.num('LAYER', 1)], 'statement', true);
  stmt('spark_l_layer', (b, c) => `{ const i = R.targets.indexOf(S); if (i >= 0) { R.targets.splice(i, 1); R.targets.splice(Math.max(0, Math.min(R.targets.length, Math.round(${n(c, b, 'LAYER', '1')}) - 1)), 0, S); } }`);
  add('looks', 'spark_l_anim', 'animate costumes %1 to %2 at %3 fps', [A.num('FROM', 1), A.num('TO', 2), A.num('FPS', 8)], 'statement', true);
  stmt('spark_l_anim', (b, c) => `S.anim = { a: Math.round(${n(c, b, 'FROM', '1')}) - 1, b: Math.round(${n(c, b, 'TO', '2')}) - 1, fps: Math.max(0.1, ${n(c, b, 'FPS', '8')}), acc: 0 };`);
  add('looks', 'spark_l_stopanim', 'stop animating', [], 'statement', true);
  stmt('spark_l_stopanim', () => `S.anim = null;`);
  add('looks', 'spark_l_button', 'look like a button that says %1', [A.txt('TEXT', 'PLAY')], 'statement', true);
  stmt('spark_l_button', (b, c) => `S.showButton(${s(c, b, 'TEXT')});`);
  add('looks', 'spark_l_emote', 'show %1 above me for %2 seconds', [A.dd('EMOJI', ['❤️', '❗', '❓', '💤', '💢', '✨', '💧', '🎵', '👍', '💀']), A.num('SECS', 1.5)], 'statement', true);
  stmt('spark_l_emote', (b, c) => `S.emote = { text: ${f(c, b, 'EMOJI')}, until: R.time + ${n(c, b, 'SECS')} };`);
  add('looks', 'spark_l_float', 'float text %1 here color %2', [A.txt('TEXT', '+10'), A.col('COLOR', '#ffeb3b')], 'statement', true);
  stmt('spark_l_float', (b, c) => `R.floatText(${s(c, b, 'TEXT')}, S.x, S.y + 20, ${s(c, b, 'COLOR')});`);
  sep('fx');
  add('fx', 'spark_f_screentint', 'tint screen %1 at %2 %', [A.col('COLOR', '#000066'), A.num('PCT', 40)]);
  stmt('spark_f_screentint', (b, c) => `R.screenTint = ${n(c, b, 'PCT')} > 0 ? { color: ${s(c, b, 'COLOR')}, alpha: Math.min(1, ${n(c, b, 'PCT')} / 100) } : null;`);
  add('fx', 'spark_f_dark', 'darkness %1 %', [A.num('PCT', 80)]);
  stmt('spark_f_dark', (b, c) => `R.darkness = Math.max(0, Math.min(1, ${n(c, b, 'PCT')} / 100));`);
  add('fx', 'spark_f_light', 'glow with light of radius %1', [A.num('RADIUS', 120)], 'statement', true);
  stmt('spark_f_light', (b, c) => `S.light = Math.max(0, ${n(c, b, 'RADIUS')}) || null;`);
  add('fx', 'spark_f_weather', 'weather %1', [A.dd('KIND', ['off', 'rain', 'snow', 'falling leaves', 'stars', 'fireflies', 'ash'])]);
  stmt('spark_f_weather', (b, c) => `R.weather = ${f(c, b, 'KIND')} === "off" ? null : ${f(c, b, 'KIND')};`);
  add('fx', 'spark_f_parallax', 'backdrop scrolls with camera at %1 %', [A.num('PCT', 30)]);
  stmt('spark_f_parallax', (b, c) => `R.parallax = Math.max(0, ${n(c, b, 'PCT')} / 100);`);
  add('fx', 'spark_f_transition', 'transition %1 for %2 seconds', [A.dd('MODE', ['circle close', 'circle open', 'wipe left', 'wipe right', 'pixelate in', 'pixelate out']), A.num('SECS', 0.8)]);
  stmt('spark_f_transition', (b, c) => `await R.transition(T, ${f(c, b, 'MODE')}, ${n(c, b, 'SECS')});`);
  add('fx', 'spark_f_zoomto', 'zoom camera to %1 % in %2 seconds', [A.num('ZOOM', 150), A.num('SECS', 1)]);
  stmt('spark_f_zoomto', (b, c) => `await R.zoomTo(T, ${n(c, b, 'ZOOM', '100')} / 100, ${n(c, b, 'SECS')});`);
  add('fx', 'spark_f_hitstop', 'hit-stop for %1 seconds', [A.num('SECS', 0.08)]);
  stmt('spark_f_hitstop', (b, c) => `R.freeze(${n(c, b, 'SECS')});`);
  TP.showButton = function (text) { const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="160" height="52" viewBox="0 0 160 52"><rect x="2" y="2" width="156" height="48" rx="14" fill="#4C97FF" stroke="#3373CC" stroke-width="3"/><text x="80" y="34" font-size="22" font-family="Helvetica, Arial, sans-serif" font-weight="bold" text-anchor="middle" fill="#fff">${toStr(text).replace(/&/g, '&amp;').replace(/</g, '&lt;')}</text></svg>`; this.textCostume = { name: '_text_', text: toStr(text), src: Lib.svgToDataURL(svg), w: 160, h: 52, cx: 80, cy: 26 }; this.R.img(this.textCostume); };
  RP.floatText = function (text, x, y, color) { this.floats.push({ text: toStr(text), x, y, color: color || '#fff', life: 1.2 }); };
  RP.transition = async function (T, mode, secs) { const t0 = this.time, dur = Math.max(0.05, secs); while (true) { const k = Math.min(1, (this.time - t0) / dur); this.transitionFx = { mode, k }; if (k >= 1) break; await T.yield(); } if (!/close|wipe|pixelate out/.test(mode)) this.transitionFx = null; };
  RP.zoomTo = async function (T, z, secs) { const z0 = this.cam.zoom, t0 = this.time, dur = Math.max(0.01, secs); while (true) { const k = Math.min(1, (this.time - t0) / dur); this.cam.zoom = z0 + (z - z0) * EASE['ease in-out'](k); if (k >= 1) break; await T.yield(); } };
  const origScaleX = TP.scaleX, origScaleY = TP.scaleY;
  TP.scaleX = function () { return origScaleX.call(this) * (this.stretch ? this.stretch.x : 1); };
  TP.scaleY = function () { return origScaleY.call(this) * (this.stretch ? this.stretch.y : 1); };
  const origDraw = RP.drawSprite;
  RP.drawSprite = function (ctx, t, map, zoom, plain) {
    if (!plain && t.outline && t.visible) {
      const im = t.img(); if (im && im.ready) {
        const { w, h } = t.costumeSize(); const key = im.src + '|' + t.outline.color + '|' + w + 'x' + h;
        let cache = t._outlineCache;
        if (!cache || cache.key !== key) { const c = document.createElement('canvas'); c.width = w; c.height = h; const tc = c.getContext('2d'); tc.drawImage(im, 0, 0, w, h); tc.globalCompositeOperation = 'source-in'; tc.fillStyle = t.outline.color; tc.fillRect(0, 0, w, h); c.ready = true; cache = t._outlineCache = { key, canvas: c }; }
        const o = t.outline.size; const dirs = [[o, 0], [-o, 0], [0, o], [0, -o], [o, o], [-o, -o], [o, -o], [-o, o]];
        const saveImg = t.img; t.img = () => cache.canvas;
        for (const [dx, dy] of dirs) { const m2 = (x, y) => { const p = map(x, y); return [p[0] + dx, p[1] + dy]; }; origDraw.call(this, ctx, t, m2, zoom, true); }
        t.img = saveImg;
      }
    }
    origDraw.call(this, ctx, t, map, zoom, plain);
  };

  /* =================================================================== SOUND =================================================================== */
  sep('sound');
  add('sound', 'spark_s_music', 'start music %1', [A.dd('STYLE', ['adventure', 'chase', 'calm', 'boss', 'victory', 'space', 'spooky', 'happy'])]);
  stmt('spark_s_music', (b, c) => `R.music.start(${f(c, b, 'STYLE')});`);
  add('sound', 'spark_s_stopmusic', 'stop music', []);
  stmt('spark_s_stopmusic', () => `R.music.stop();`);
  add('sound', 'spark_s_musicvol', 'set music volume to %1 %', [A.num('VOL', 50)]);
  stmt('spark_s_musicvol', (b, c) => `R.music.volume(${n(c, b, 'VOL', '50')} / 100);`);
  add('sound', 'spark_s_at', 'play sound %1 from where I am', [A.menu('SOUND_MENU', 'sound_sounds_menu')], 'statement', true);
  stmt('spark_s_at', (b, c) => `{ const was = S.soundEffects.PAN; S.soundEffects.PAN = Math.max(-100, Math.min(100, (S.x - R.cam.x) / 2.4)); S.playSound(${c.val(b, 'SOUND_MENU', '""')}); S.soundEffects.PAN = was; }`);
  add('sound', 'spark_s_randpitch', 'play sound %1 with a random pitch', [A.menu('SOUND_MENU', 'sound_sounds_menu')]);
  stmt('spark_s_randpitch', (b, c) => `{ const was = S.soundEffects.PITCH; S.soundEffects.PITCH = was + (Math.random() * 80 - 40); S.playSound(${c.val(b, 'SOUND_MENU', '""')}); S.soundEffects.PITCH = was; }`);
  add('sound', 'spark_s_pauseall', '%1 all sounds', [A.dd('MODE', ['pause', 'resume'])]);
  stmt('spark_s_pauseall', (b, c) => `{ const cx = R.audio.ctx(); ${f(c, b, 'MODE')} === "pause" ? cx.suspend() : cx.resume(); }`);
  add('sound', 'spark_s_beats', 'beats so far', [], 'number');
  expr('spark_s_beats', () => `Math.floor(R.timer() * R.tempo / 60)`);
  const MUSIC = {
    adventure: { bpm: 140, wave: 'square', notes: [60, 64, 67, 72, 67, 64, 62, 65, 69, 74, 69, 65, 64, 67, 71, 76, 71, 67, 65, 69, 72, 77, 72, 69], bass: [48, 48, 50, 50, 52, 52, 53, 53] },
    chase: { bpm: 180, wave: 'sawtooth', notes: [57, 57, 60, 57, 55, 57, 60, 62, 57, 57, 60, 57, 55, 53, 52, 50], bass: [45, 45, 45, 45, 43, 43, 41, 41] },
    calm: { bpm: 80, wave: 'triangle', notes: [60, 64, 67, 71, 67, 64, 62, 65, 69, 72, 69, 65, 59, 62, 67, 71, 67, 62, 60, 64, 67, 72, 67, 64], bass: [48, 48, 50, 50, 47, 47, 48, 48] },
    boss: { bpm: 160, wave: 'sawtooth', notes: [48, 48, 51, 48, 54, 48, 51, 53, 48, 48, 51, 48, 46, 48, 51, 46], bass: [36, 36, 36, 36, 39, 39, 34, 34] },
    victory: { bpm: 150, wave: 'square', notes: [60, 64, 67, 72, 72, 72, 71, 72, 74, 72, 71, 69, 67, 67, 67, 67], bass: [48, 48, 53, 53, 55, 55, 48, 48] },
    space: { bpm: 100, wave: 'triangle', notes: [62, 69, 74, 76, 74, 69, 62, 57, 60, 67, 72, 74, 72, 67, 60, 55], bass: [38, 38, 36, 36, 38, 38, 43, 43] },
    spooky: { bpm: 90, wave: 'triangle', notes: [57, 60, 56, 57, 63, 60, 56, 54, 57, 60, 56, 57, 51, 54, 56, 57], bass: [33, 33, 32, 32, 33, 33, 30, 30] },
    happy: { bpm: 160, wave: 'square', notes: [67, 67, 69, 71, 67, 71, 69, 62, 67, 67, 69, 71, 67, 71, 74, 72], bass: [43, 43, 45, 45, 47, 47, 43, 43] }
  };
  function musicBuffer(ctx, m) {
    const sr = ctx.sampleRate, beat = 60 / m.bpm, step = beat / 2, len = m.notes.length * step; const buf = ctx.createBuffer(1, Math.floor(sr * len), sr), d = buf.getChannelData(0);
    const mix = (midi, t0, dur, wave, vol) => { const f = 440 * Math.pow(2, (midi - 69) / 12); const s0 = Math.floor(t0 * sr), s1 = Math.min(d.length, Math.floor((t0 + dur) * sr)); for (let i = s0; i < s1; i++) { const t = (i - s0) / sr; const ph = t * f; const v = wave === 'square' ? ((ph % 1) < 0.5 ? 1 : -1) * 0.3 : wave === 'sawtooth' ? ((ph % 1) * 2 - 1) * 0.35 : Math.sin(ph * 6.283) * 0.6; const env = Math.min(1, t / 0.01) * Math.min(1, (dur - t) / 0.05) * Math.exp(-t * 2); d[i] += v * env * vol; } };
    m.notes.forEach((nn, i) => mix(nn, i * step, step * 0.9, m.wave, 0.5));
    m.bass.forEach((nn, i) => mix(nn, i * beat, beat * 0.8, 'triangle', 0.9));
    for (let i = 0; i < m.notes.length; i += 2) { const s0 = Math.floor(i * step * sr); for (let j = 0; j < sr * 0.05; j++) if (s0 + j < d.length) d[s0 + j] += (Math.random() * 2 - 1) * 0.25 * (1 - j / (sr * 0.05)); }
    return buf;
  }
  RP.musicInit = function () {
    const R = this; this.music = {
      src: null, gain: null, vol: 0.5, name: null,
      start(name) { const m = MUSIC[name]; if (!m) return; this.stop(); const ctx = R.audio.ctx(); this.gain = ctx.createGain(); this.gain.gain.value = this.vol; this.gain.connect(R.audio.master); const src = ctx.createBufferSource(); R._musicCache = R._musicCache || {}; src.buffer = R._musicCache[name] = R._musicCache[name] || musicBuffer(ctx, m); src.loop = true; src.connect(this.gain); src.start(); this.src = src; this.name = name; },
      stop() { if (this.src) { try { this.src.stop(); } catch (e) {} this.src = null; this.name = null; } },
      volume(v) { this.vol = clamp(v, 0, 1); if (this.gain) this.gain.gain.value = this.vol; }
    };
  };

  /* =================================================================== SENSING & INPUT =================================================================== */
  sep('sensing');
  add('sensing', 'spark_i_just', 'key %1 just pressed?', [A.menu('KEY_OPTION', 'sensing_keyoptions')], 'boolean');
  expr('spark_i_just', (b, c) => `R.keyJust(${s(c, b, 'KEY_OPTION')})`);
  add('sensing', 'spark_i_lastkey', 'last key pressed', [], 'string');
  expr('spark_i_lastkey', () => `(R.lastKey || "")`);
  add('sensing', 'spark_i_mbutton', 'mouse %1 button down?', [A.dd('BTN', ['left', 'right', 'middle'])], 'boolean');
  expr('spark_i_mbutton', (b, c) => `R.mouseButtons.has(${f(c, b, 'BTN')})`);
  add('sensing', 'spark_i_scroll', 'scroll wheel amount', [], 'number');
  expr('spark_i_scroll', () => `R.scrollAmt`);
  add('sensing', 'spark_i_swipe', 'swiped %1?', [A.dd('DIR', ['up', 'down', 'left', 'right'])], 'boolean');
  expr('spark_i_swipe', (b, c) => `(R.swipe === ${f(c, b, 'DIR')})`);
  add('sensing', 'spark_i_tilt', 'phone tilt %1', [A.dd('AXIS', ['x', 'y'])], 'number');
  expr('spark_i_tilt', (b, c) => `R.tilt[${f(c, b, 'AXIS')}]`);
  add('sensing', 'spark_i_touch', 'show touch controls %1', [A.dd('ON', ['on', 'off'])]);
  stmt('spark_i_touch', (b, c) => `R.touchControls(${f(c, b, 'ON')} === "on");`);
  add('sensing', 'spark_i_dropped', 'when I am dropped', [], 'hat', true);
  hat('spark_i_dropped', () => ({ hat: 'dropped' }));
  add('sensing', 'spark_i_now', 'time now as text', [], 'string');
  expr('spark_i_now', () => `new Date().toLocaleTimeString()`);
  add('sensing', 'spark_i_clip', 'copy %1 to clipboard', [A.txt('TEXT', 'hello')]);
  stmt('spark_i_clip', (b, c) => `navigator.clipboard && navigator.clipboard.writeText(${s(c, b, 'TEXT')}).catch(() => {});`);
  add('sensing', 'spark_i_link', 'open link %1', [A.txt('URL', 'https://scratch.mit.edu')]);
  stmt('spark_i_link', (b, c) => `window.open(${s(c, b, 'URL')}, "_blank");`);
  add('sensing', 'spark_i_fps', 'frames per second', [], 'number');
  expr('spark_i_fps', () => `R.fps`);
  RP.keyJust = function (k) { k = toStr(k); if (k.length === 1) k = k.toLowerCase(); return k === 'any' ? this.keysJust.size > 0 : this.keysJust.has(k); };
  RP.touchControls = function (on) {
    if (!this.overlay) return;
    if (!on) { if (this.touchUI) { this.touchUI.remove(); this.touchUI = null; } return; }
    if (this.touchUI) return;
    const ui = document.createElement('div'); ui.className = 'spark-touch';
    ui.innerHTML = `<div class="dpad"><button data-k="up arrow" style="grid-area:u">▲</button><button data-k="left arrow" style="grid-area:l">◀</button><button data-k="right arrow" style="grid-area:r">▶</button><button data-k="down arrow" style="grid-area:d">▼</button></div><div class="btns"><button data-k="z" class="b">B</button><button data-k="space,up arrow" class="a">A</button></div>`;
    const style = document.createElement('style'); style.textContent = `.spark-touch{position:absolute;inset:0;pointer-events:none}.spark-touch button{pointer-events:auto;width:52px;height:52px;border-radius:50%;border:0;background:rgba(255,255,255,.45);color:#222;font-size:20px;font-weight:700;touch-action:none;-webkit-user-select:none;user-select:none}.spark-touch .dpad{position:absolute;left:14px;bottom:14px;display:grid;grid-template-areas:". u ." "l . r" ". d .";gap:4px}.spark-touch .btns{position:absolute;right:14px;bottom:14px;display:flex;gap:10px;align-items:flex-end}.spark-touch .a{width:64px;height:64px;background:rgba(76,151,255,.7);color:#fff}.spark-touch .b{background:rgba(255,102,128,.7);color:#fff}`;
    ui.appendChild(style); this.overlay.appendChild(ui); this.touchUI = ui;
    const press = (keys, down) => keys.split(',').forEach(k => { if (down) { if (!this.keys.has(k)) { this.keys.add(k); this.keysJust.add(k); this.startHats(sc => sc.hat === 'key' && (sc.key === k || sc.key === 'any'), false); } } else this.keys.delete(k); });
    ui.querySelectorAll('button').forEach(b => { b.addEventListener('pointerdown', e => { e.preventDefault(); b.setPointerCapture(e.pointerId); press(b.dataset.k, true); }); const up = () => press(b.dataset.k, false); b.addEventListener('pointerup', up); b.addEventListener('pointercancel', up); b.addEventListener('pointerleave', up); });
  };

  /* =================================================================== WORLD =================================================================== */
  sep('world');
  add('world', 'spark_w_under', 'tile under me', [], 'string', true);
  expr('spark_w_under', () => `R.world.nameAt(S.x, S.y)`);
  add('world', 'spark_w_setunder', 'set tile under me to %1', [A.dd('TILE', ['empty', ...TILES])], 'statement', true);
  stmt('spark_w_setunder', (b, c) => `R.world.set(R.world.colOf(S.x), R.world.rowOf(S.y), R.world.kindOf(${f(c, b, 'TILE')}));`);
  add('world', 'spark_w_front', '%1 tile in front of me %2', [A.dd('ACTION', ['break', 'place']), A.dd('TILE', ['grass', ...TILES.filter(t => t !== 'grass')])], 'statement', true);
  stmt('spark_w_front', (b, c) => `R.tileInFront(S, ${f(c, b, 'ACTION')}, ${f(c, b, 'TILE')});`);
  add('world', 'spark_w_count', 'number of %1 tiles', [A.dd('TILE', TILES)], 'number');
  expr('spark_w_count', (b, c) => `R.countTiles(${f(c, b, 'TILE')})`);
  add('world', 'spark_w_nearest', 'distance to nearest %1 tile', [A.dd('TILE', TILES)], 'number', true);
  expr('spark_w_nearest', (b, c) => `R.nearestTile(S, ${f(c, b, 'TILE')}, "distance")`);
  add('world', 'spark_w_gonearest', 'go to nearest %1 tile', [A.dd('TILE', TILES)], 'statement', true);
  stmt('spark_w_gonearest', (b, c) => `{ const p = R.nearestTile(S, ${f(c, b, 'TILE')}, "point"); if (p) S.goTo(p.x, p.y); }`);
  add('world', 'spark_w_fromtext', 'build %2 world from text %1 (rows split by |)', [A.txt('TEXT', '#########|#S..C...#|#..##...#|#.....E.#|#########'), A.dd('VIEW', ['top-down', 'side-view'])]);
  stmt('spark_w_fromtext', (b, c) => `R.worldFromText(${s(c, b, 'TEXT')}, ${f(c, b, 'VIEW')});`);
  add('world', 'spark_w_totext', 'world as text', [], 'string');
  expr('spark_w_totext', () => `R.worldToText()`);
  add('world', 'spark_w_minimap', 'mini-map %1', [A.dd('ON', ['on', 'off'])]);
  stmt('spark_w_minimap', (b, c) => `R.minimap = ${f(c, b, 'ON')} === "on";`);
  add('world', 'spark_w_whentile', 'when I touch a %1 tile', [A.dd('TILE', ['any hazard', ...TILES])], 'hat', true);
  hat('spark_w_whentile', (b, c) => ({ hat: 'tiletouch', cond: `S.touchingTile(${f(c, b, 'TILE')})` }));
  var TEXT_TILES = { '#': 'wall', '.': 'empty', G: 'grass', D: 'dirt', W: 'water', T: 'tree', C: 'chest', E: 'door', L: 'lava', '^': 'spike', B: 'brick', F: 'floor', P: 'path', R: 'rock', I: 'ice', O: 'wood', U: 'bush', A: 'sand', N: 'snow', K: 'cloud', X: 'stone', S: 'empty' };
  RP.worldFromText = function (text, view) {
    const rows = toStr(text).replace(/\r/g, '').split(/\n|\||\//).filter(r => r.length); if (!rows.length) return;
    const w = Math.max(...rows.map(r => r.length)), h = rows.length; const Wd = this.world; Wd.generate('empty', w, h, 1); Wd.sideView = view === 'side-view'; Wd.type = 'text';
    rows.forEach((row, r) => { for (let c = 0; c < row.length; c++) { const ch = row[c]; const name = TEXT_TILES[ch] ?? TEXT_TILES[ch.toUpperCase()]; if (name) Wd.set(c, r, Wd.kindOf(name)); if (ch === 'S') Wd.start = Wd.centerOf(c, r); } });
    this.cameraInsideWorld();
  };
  RP.worldToText = function () { const Wd = this.world; if (!Wd.active) return ''; const inv = Object.fromEntries(Object.entries(TEXT_TILES).map(([k, v]) => [v, k])); const out = []; for (let r = 0; r < Wd.h; r++) { let row = ''; for (let c = 0; c < Wd.w; c++) row += inv[SR.TILE_NAMES[Wd.get(c, r)]] || '.'; out.push(row); } return out.join('\n'); };
  RP.tileInFront = function (S, action, tile) { const Wd = this.world; if (!Wd.active) return; const r = S.direction * Math.PI / 180; const x = S.x + Math.sin(r) * Wd.size, y = S.y + Math.cos(r) * Wd.size; const c = Wd.colOf(x), rr = Wd.rowOf(y); if (action === 'break') { if (Wd.get(c, rr)) { this.particles.burst('dust', Wd.centerOf(c, rr).x, Wd.centerOf(c, rr).y, 0.8); Wd.set(c, rr, 0); } } else Wd.set(c, rr, Wd.kindOf(tile)); };
  RP.countTiles = function (name) { const Wd = this.world; if (!Wd.active) return 0; const k = Wd.kindOf(name); let n2 = 0; for (let i = 0; i < Wd.tiles.length; i++) if (Wd.tiles[i] === k) n2++; return n2; };
  RP.nearestTile = function (S, name, what) { const Wd = this.world; if (!Wd.active) return what === 'distance' ? 10000 : null; const k = Wd.kindOf(name); let best = null, bd = Infinity; for (let r = 0; r < Wd.h; r++) for (let c = 0; c < Wd.w; c++) if (Wd.tiles[r * Wd.w + c] === k) { const p = Wd.centerOf(c, r); const d = Math.hypot(p.x - S.x, p.y - S.y); if (d < bd) { bd = d; best = p; } } return what === 'distance' ? (best ? bd : 10000) : best; };

  /* ---- world building blocks (no presets: you place chunks, fill areas, scatter tiles) ---- */
  BL.def('spark_world_new', 'world', 'make a %1 world %2 tiles wide %3 tall', [A.dd('VIEW', ['top-down', 'side-view']), A.num('W', 30), A.num('H', 20)]);
  stmt('spark_world_new', (b, c) => `R.worldNew(${f(c, b, 'VIEW')}, ${n(c, b, 'W', '30')}, ${n(c, b, 'H', '20')});`);
  BL.def('spark_world_chunk', 'world', 'place chunk %1 at column %2 row %3  (rows split by |  # wall . empty G grass D dirt W water T tree C chest E door L lava ^ spike S start)', [A.txt('TEXT', '#####|#S..#|#.C.#|#####'), A.num('COL', 0), A.num('ROW', 0)]);
  stmt('spark_world_chunk', (b, c) => `R.worldChunk(${s(c, b, 'TEXT')}, ${n(c, b, 'COL')}, ${n(c, b, 'ROW')});`);
  BL.def('spark_world_scatter', 'world', 'scatter %1 tiles on %2 % of empty spots', [A.dd('TILE', TILES), A.num('PCT', 5)]);
  stmt('spark_world_scatter', (b, c) => `R.worldScatter(${f(c, b, 'TILE')}, ${n(c, b, 'PCT', '5')});`);
  BL.def('spark_world_ground', 'world', 'ground of %1 from column %2 to %3, %4 tiles high', [A.dd('TILE', ['grass', ...TILES.filter(t => t !== 'grass')]), A.num('C1', 0), A.num('C2', 29), A.num('H', 3)]);
  stmt('spark_world_ground', (b, c) => `R.worldGround(${f(c, b, 'TILE')}, ${n(c, b, 'C1')}, ${n(c, b, 'C2', '29')}, ${n(c, b, 'H', '3')});`);
  RP.worldNew = function (view, w, h) { const Wd = this.world; Wd.generate('empty', w, h, 1); Wd.sideView = view === 'side-view'; Wd.type = 'custom'; Wd.start = Wd.sideView ? Wd.centerOf(1, Math.max(0, Wd.h - 5)) : Wd.centerOf(Math.floor(Wd.w / 2), Math.floor(Wd.h / 2)); this.cameraInsideWorld(); };
  RP.worldChunk = function (text, col, row) {
    const Wd = this.world; if (!Wd.active) this.worldNew('top-down', 30, 20);
    const rows = toStr(text).replace(/\r/g, '').split(/\n|\||\//); col = Math.round(col); row = Math.round(row);
    rows.forEach((line, r) => { for (let c = 0; c < line.length; c++) { const ch = line[c]; if (ch === ' ') continue; const name = TEXT_TILES[ch] ?? TEXT_TILES[ch.toUpperCase()]; if (name === undefined) continue; Wd.set(col + c, row + r, Wd.kindOf(name)); if (ch === 'S') Wd.start = Wd.centerOf(col + c, row + r); } });
  };
  RP.worldScatter = function (tile, pct) { const Wd = this.world; if (!Wd.active) return; const k = Wd.kindOf(tile); for (let i = 0; i < Wd.tiles.length; i++) if (Wd.tiles[i] === 0 && Math.random() * 100 < pct) { if (Wd.sideView && !Wd.isSolid(Wd.get(i % Wd.w, Math.floor(i / Wd.w) + 1))) continue; Wd.tiles[i] = k; } };
  RP.worldGround = function (tile, c1, c2, h) { const Wd = this.world; if (!Wd.active) this.worldNew('side-view', 30, 20); const k = Wd.kindOf(tile), kd = Wd.kindOf('dirt'); for (let c = Math.min(c1, c2); c <= Math.max(c1, c2); c++) for (let r = 0; r < h; r++) Wd.set(c, Wd.h - 1 - r, r === h - 1 || tile !== 'grass' ? k : kd); };

  /* =================================================================== SPRITES & COSTUMES (make things with blocks) =================================================================== */
  const LIBS = Lib.costumeNames;
  add('sprites', 'spark_sprite_create', 'create sprite named %1 with %2 costume color %3 at x: %4 y: %5', [A.txt('NAME', 'Enemy'), A.dd('LIB', LIBS), A.col('COLOR', '#59C059'), A.num('X', 0), A.num('Y', 0)]);
  stmt('spark_sprite_create', (b, c) => `R.createSprite(${s(c, b, 'NAME')}, ${f(c, b, 'LIB')}, ${s(c, b, 'COLOR')}, ${n(c, b, 'X')}, ${n(c, b, 'Y')});`);
  add('sprites', 'spark_sprite_delete', 'delete sprite %1', [spriteMenu()]);
  stmt('spark_sprite_delete', (b, c) => `R.deleteSprite(${s(c, b, 'TARGET')});`);
  add('sprites', 'spark_sprite_addcostume', 'add %1 costume named %2 color %3', [A.dd('LIB', LIBS), A.txt('NAME', 'costume2'), A.col('COLOR', '#4C97FF')], 'statement', true);
  stmt('spark_sprite_addcostume', (b, c) => `S.addLibCostume(${f(c, b, 'LIB')}, ${s(c, b, 'NAME')}, ${s(c, b, 'COLOR')});`);
  add('sprites', 'spark_sprite_pixel', 'add pixel art costume %1 named %2 colors %3 scale %4', [A.txt('ART', '.rr.\nrrrr\n.rr.\n.bb.'), A.txt('NAME', 'pixel'), A.txt('PAL', 'r=#ff0000 b=#0000ff'), A.num('SCALE', 8)], 'statement', true);
  stmt('spark_sprite_pixel', (b, c) => `S.addPixelCostume(${s(c, b, 'ART')}, ${s(c, b, 'NAME')}, ${s(c, b, 'PAL')}, ${n(c, b, 'SCALE', '8')});`);
  add('sprites', 'spark_sprite_shape', 'look like a %1 color %2 size %3', [A.dd('SHAPE', ['circle', 'square', 'triangle', 'star', 'heart', 'diamond', 'ring', 'arrow']), A.col('COLOR', '#4C97FF'), A.num('SIZE', 48)], 'statement', true);
  stmt('spark_sprite_shape', (b, c) => `S.showShape(${f(c, b, 'SHAPE')}, ${s(c, b, 'COLOR')}, ${n(c, b, 'SIZE', '48')});`);
  add('sprites', 'spark_sprite_emoji', 'look like emoji %1 size %2', [A.txt('EMOJI', '🐱'), A.num('SIZE', 64)], 'statement', true);
  stmt('spark_sprite_emoji', (b, c) => `S.showEmoji(${s(c, b, 'EMOJI')}, ${n(c, b, 'SIZE', '64')});`);
  add('sprites', 'spark_sprite_delcostume', 'delete costume %1', [A.menu('COSTUME', 'looks_costume')], 'statement', true);
  stmt('spark_sprite_delcostume', (b, c) => `S.deleteCostume(${c.val(b, 'COSTUME', '""')});`);
  add('sprites', 'spark_sprite_costumecount', 'number of costumes', [], 'number', true);
  expr('spark_sprite_costumecount', () => `S.costumes.length`);
  sep('sprites');
  add('sprites', 'spark_sprite_grid', 'make %1 by %2 clones of %3 spaced %4 starting here', [A.num('COLS', 5), A.num('ROWS', 1), cloneMenu(), A.num('GAP', 48)], 'statement', true);
  stmt('spark_sprite_grid', (b, c) => `R.cloneGrid(S, ${s(c, b, 'TARGET')}, ${n(c, b, 'COLS', '5')}, ${n(c, b, 'ROWS', '1')}, ${n(c, b, 'GAP', '48')});`);
  add('sprites', 'spark_sprite_cloneindex', 'my clone number', [], 'number', true);
  expr('spark_sprite_cloneindex', () => `(S.cloneIndex || 0)`);
  add('sprites', 'spark_sprite_cloneat', 'clone of %1 nearest to x: %2 y: %3 %4', [cloneMenu(), A.num('X', 0), A.num('Y', 0), A.dd('WHICH', ['x position', 'y position', 'clone number'])], 'number');
  expr('spark_sprite_cloneat', (b, c) => `R.cloneNear(${s(c, b, 'TARGET')}, ${n(c, b, 'X')}, ${n(c, b, 'Y')}, ${f(c, b, 'WHICH')})`);
  sep('sprites');
  add('sprites', 'spark_sprite_offscreen', 'off screen?', [], 'boolean', true);
  expr('spark_sprite_offscreen', () => `(!R.onScreen(S))`);
  add('sprites', 'spark_sprite_whenoff', 'when I go off screen', [], 'hat', true);
  hat('spark_sprite_whenoff', () => ({ hat: 'offscreen', cond: `(!R.onScreen(S))` }));
  add('sprites', 'spark_sprite_wrap', 'wrap around the screen edges', [], 'statement', true);
  stmt('spark_sprite_wrap', () => `S.wrapScreen();`);
  add('sprites', 'spark_sprite_edge', '%1 edge of %2', [A.dd('EDGE', ['left', 'right', 'top', 'bottom']), cloneMenu()], 'number');
  expr('spark_sprite_edge', (b, c) => `R.edgeOf(S, ${s(c, b, 'TARGET')}, ${f(c, b, 'EDGE')})`);
  add('sprites', 'spark_sprite_size', 'my %1', [A.dd('WHICH', ['width', 'height'])], 'number', true);
  expr('spark_sprite_size', (b, c) => `S.bounds()[${f(c, b, 'WHICH') === 'width' ? '"w"' : '"h"'}]`);
  RP.createSprite = function (name, lib, color, x, y) {
    name = toStr(name) || 'Sprite'; let nm = name, i = 2; while (this.originals().some(o => o.name === nm)) nm = name + (i++);
    const t = this.addSprite({ id: uid(), name: nm, x, y, costumes: [{ name: 'costume1', src: Lib.svgToDataURL(Lib.costumeSVG(lib, color)) }], currentCostume: 0, sounds: [], xml: '<xml></xml>', variables: [] });
    t.hp = { value: 100, max: 100, show: false, invUntil: 0 }; this.onEvent('dirty'); return t;
  };
  RP.deleteSprite = function (name) { const t = this.findTarget(null, name); if (t && !t.isStage) { this.removeSprite(t); this.onEvent('dirty'); } };
  TP.addLibCostume = function (lib, name, color) { const c = { name: toStr(name) || lib, src: Lib.svgToDataURL(Lib.costumeSVG(lib, color)) }; this.costumes.push(c); this.R.img(c); this.R.onEvent('costumesChanged', this); };
  TP.addPixelCostume = function (art, name, pal, scale) {
    const palette = {}; for (const m of toStr(pal).matchAll(/(\S)\s*=\s*(#[0-9a-f]{3,8}|\w+)/gi)) palette[m[1]] = m[2];
    const rows = toStr(art).replace(/\r/g, '').split('\n').filter(r => r.length); const w = Math.max(...rows.map(r => r.length)), h = rows.length; scale = clamp(Math.round(scale) || 8, 1, 40);
    const cv = document.createElement('canvas'); cv.width = w * scale; cv.height = h * scale; const g = cv.getContext('2d');
    rows.forEach((row, y) => { for (let x = 0; x < row.length; x++) { const ch = row[x]; if (ch === '.' || ch === ' ') continue; g.fillStyle = palette[ch] || (/^[0-9a-f]$/i.test(ch) ? '#' + ch + ch + ch : '#333'); g.fillRect(x * scale, y * scale, scale, scale); } });
    const c = { name: toStr(name) || 'pixel', src: cv.toDataURL(), w: cv.width, h: cv.height, cx: cv.width / 2, cy: cv.height / 2 }; this.costumes.push(c); this.R.img(c); this.R.onEvent('costumesChanged', this);
  };
  TP.deleteCostume = function (v) { if (this.costumes.length <= 1) return; let i = -1; if (typeof v === 'string' && !/^\d+$/.test(v)) i = this.costumes.findIndex(c => c.name === v); else i = Math.round(toNum(v)) - 1; if (i < 0 || i >= this.costumes.length) return; this.costumes.splice(i, 1); this.currentCostume = Math.min(this.currentCostume, this.costumes.length - 1); this.R.onEvent('costumesChanged', this); };
  TP.showShape = function (shape, color, size) {
    const S2 = Math.max(4, size), h = S2 / 2; let path;
    switch (shape) { case 'square': path = `<rect x="1" y="1" width="${S2 - 2}" height="${S2 - 2}" rx="${S2 / 10}"/>`; break; case 'triangle': path = `<path d="M${h} 1 L${S2 - 1} ${S2 - 1} L1 ${S2 - 1} Z"/>`; break; case 'star': { let d = ''; for (let i = 0; i < 10; i++) { const r = i % 2 ? h * 0.45 : h - 1, a = i * Math.PI / 5 - Math.PI / 2; d += (i ? 'L' : 'M') + (h + Math.cos(a) * r) + ' ' + (h + Math.sin(a) * r) + ' '; } path = `<path d="${d}Z"/>`; break; } case 'heart': path = `<path d="M${h} ${S2 - 2} L${S2 * 0.1} ${S2 * 0.5} Q0 ${S2 * 0.25} ${S2 * 0.2} ${S2 * 0.1} Q${S2 * 0.4} 0 ${h} ${S2 * 0.2} Q${S2 * 0.6} 0 ${S2 * 0.8} ${S2 * 0.1} Q${S2} ${S2 * 0.25} ${S2 * 0.9} ${S2 * 0.5} Z"/>`; break; case 'diamond': path = `<path d="M${h} 1 L${S2 - 1} ${h} L${h} ${S2 - 1} L1 ${h} Z"/>`; break; case 'ring': path = `<circle cx="${h}" cy="${h}" r="${h - S2 / 8}" fill="none" stroke="${color}" stroke-width="${S2 / 5}"/>`; break; case 'arrow': path = `<path d="M1 ${S2 * 0.35} L${S2 * 0.55} ${S2 * 0.35} L${S2 * 0.55} ${S2 * 0.1} L${S2 - 1} ${h} L${S2 * 0.55} ${S2 * 0.9} L${S2 * 0.55} ${S2 * 0.65} L1 ${S2 * 0.65} Z"/>`; break; default: path = `<circle cx="${h}" cy="${h}" r="${h - 1}"/>`; }
    const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${S2}" height="${S2}" viewBox="0 0 ${S2} ${S2}"><g fill="${color}">${path}</g></svg>`;
    this.textCostume = { name: '_shape_', text: shape, src: Lib.svgToDataURL(svg), w: S2, h: S2, cx: h, cy: h }; this.R.img(this.textCostume);
  };
  TP.showEmoji = function (emoji, size) { const svg = Lib.emojiSVG(toStr(emoji) || '🙂', Math.max(8, size)); const m = svg.match(/width="(\d+)" height="(\d+)"/); this.textCostume = { name: '_emoji_', text: emoji, src: Lib.svgToDataURL(svg), w: +m[1], h: +m[2], cx: +m[1] / 2, cy: +m[2] / 2 }; this.R.img(this.textCostume); };
  RP.cloneGrid = function (S, name, cols, rows, gap) { let idx = 0; for (let r = 0; r < Math.round(rows); r++) for (let c = 0; c < Math.round(cols); c++) { const cl = this.createClone(S, name); if (!cl) return; cl.x = S.x + c * gap; cl.y = S.y - r * gap; cl.visible = true; cl.cloneIndex = ++idx; } };
  RP.cloneNear = function (name, x, y, which) { const orig = this.findTarget(null, name); if (!orig) return 0; let best = null, bd = Infinity; for (const o of this.targets) if ((o === orig || o.original === orig) && o.visible) { const d = Math.hypot(o.x - x, o.y - y); if (d < bd) { bd = d; best = o; } } if (!best) return 0; return which === 'x position' ? best.x : which === 'y position' ? best.y : (best.cloneIndex || 0); };
  RP.edgeOf = function (S, name, edge) { const t = this.findTarget(S, name); if (!t || t.isStage) return 0; const b = t.bounds(); return b[edge]; };
  TP.wrapScreen = function () { const v = this.R.viewRect(this.sticky); const b = this.bounds(); const w = b.right - b.left, h = b.top - b.bottom; if (b.left > v.right) this.x -= (v.right - v.left) + w; else if (b.right < v.left) this.x += (v.right - v.left) + w; if (b.bottom > v.top) this.y -= (v.top - v.bottom) + h; else if (b.top < v.bottom) this.y += (v.top - v.bottom) + h; };
  const origCloneForIndex = RP.createClone;

  /* =================================================================== TEXT ENGINE (styles, outline, shadow, background, wrap, speed) =================================================================== */
  sep('text');
  add('text', 'spark_t_bold', 'text %1 %2', [A.dd('WHAT', ['bold', 'italic', 'shadow']), A.dd('ON', ['on', 'off'])], 'statement', true);
  stmt('spark_t_bold', (b, c) => `S.setTextStyle(${f(c, b, 'WHAT')}, ${f(c, b, 'ON')} === "on");`);
  add('text', 'spark_t_outline', 'text outline %1 thickness %2', [A.col('COLOR', '#000000'), A.num('SIZE', 2)], 'statement', true);
  stmt('spark_t_outline', (b, c) => `S.setTextStyle("outline", { color: ${s(c, b, 'COLOR')}, size: ${n(c, b, 'SIZE', '2')} });`);
  add('text', 'spark_t_bg', 'text background %1 padding %2', [A.col('COLOR', '#ffffff'), A.num('PAD', 8)], 'statement', true);
  stmt('spark_t_bg', (b, c) => `S.setTextStyle("bg", { color: ${s(c, b, 'COLOR')}, pad: ${n(c, b, 'PAD', '8')} });`);
  add('text', 'spark_t_nobg', 'no text background', [], 'statement', true);
  stmt('spark_t_nobg', () => `S.setTextStyle("bg", null);`);
  add('text', 'spark_t_wrap', 'wrap text every %1 letters', [A.num('N', 20)], 'statement', true);
  stmt('spark_t_wrap', (b, c) => `S.setTextStyle("wrap", ${n(c, b, 'N', '20')});`);
  add('text', 'spark_t_align', 'align text %1', [A.dd('ALIGN', ['center', 'left', 'right'])], 'statement', true);
  stmt('spark_t_align', (b, c) => `S.setTextStyle("align", ${f(c, b, 'ALIGN')});`);
  add('text', 'spark_t_speed', 'set typing speed to %1 letters per second', [A.num('N', 30)], 'statement', true);
  stmt('spark_t_speed', (b, c) => `S.setTextStyle("speed", Math.max(1, ${n(c, b, 'N', '30')}));`);
  add('text', 'spark_t_dialogstyle', 'dialogue box color %1 text %2 speed %3', [A.col('BG', '#141828'), A.col('FG', '#ffffff'), A.num('SPEED', 40)]);
  stmt('spark_t_dialogstyle', (b, c) => `R.dialogStyle = { bg: ${s(c, b, 'BG')}, fg: ${s(c, b, 'FG')}, speed: Math.max(1, ${n(c, b, 'SPEED', '40')}) };`);
  add('text', 'spark_t_rainbow', 'rainbow text %1', [A.dd('ON', ['on', 'off'])], 'statement', true);
  stmt('spark_t_rainbow', (b, c) => `S.setTextStyle("rainbow", ${f(c, b, 'ON')} === "on");`);
  add('text', 'spark_t_text', 'my text', [], 'string', true);
  expr('spark_t_text', () => `(S.textCostume && S.textCostume.text || "")`);
  TP.setTextStyle = function (k, v) { this.textStyle = this.textStyle || {}; this.textStyle[k] = v; if (this.textCostume && this.textCostume.text !== undefined && this.textCostume.name === '_text_') this.showText(this.textCostume.text); };
  const escX = s2 => String(s2).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/"/g, '&quot;');
  TP.showText = function (text, size, color) {
    if (text === null || text === undefined) { this.textCostume = null; return; }
    const st = this.textStyle = this.textStyle || {}; if (size) st.size = size; if (color) st.color = color;
    const fs = clamp(st.size || 24, 6, 200), col = st.color || '#333333', font = Lib.FONTS[this.font] || Lib.FONTS.Sans;
    let raw = toStr(text); if (st.wrap > 0) { const words = raw.split(/(\s+)/); const lines = []; let cur = ''; for (const w of words) { if (w.includes('\n')) { lines.push(cur); cur = ''; continue; } if ((cur + w).length > st.wrap && cur.trim()) { lines.push(cur.trimEnd()); cur = w.trimStart(); } else cur += w; } lines.push(cur); raw = lines.join('\n'); }
    const lines = raw.split('\n'); const lh = fs * 1.25; const pad = st.bg ? (st.bg.pad || 8) : 2; const ol = st.outline ? Math.max(0, st.outline.size) : 0;
    const cw = fs * 0.6; const tw = Math.max(1, ...lines.map(l => l.length)) * cw; const w = Math.ceil(tw + pad * 2 + ol * 2 + 8), h = Math.ceil(lines.length * lh + pad * 2 + ol * 2 + 4);
    const anchor = st.align === 'left' ? 'start' : st.align === 'right' ? 'end' : 'middle'; const x = st.align === 'left' ? pad + ol + 4 : st.align === 'right' ? w - pad - ol - 4 : w / 2;
    const weight = st.bold === false ? 'normal' : 'bold', style = st.italic ? 'italic' : 'normal';
    const fill = st.rainbow ? 'url(#rb)' : col;
    const defs = st.rainbow ? `<defs><linearGradient id="rb" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stop-color="#f44336"/><stop offset=".2" stop-color="#ff9800"/><stop offset=".4" stop-color="#ffeb3b"/><stop offset=".6" stop-color="#4caf50"/><stop offset=".8" stop-color="#2196f3"/><stop offset="1" stop-color="#9c27b0"/></linearGradient></defs>` : '';
    const bg = st.bg ? `<rect x="${ol}" y="${ol}" width="${w - ol * 2}" height="${h - ol * 2}" rx="${Math.min(12, pad)}" fill="${st.bg.color}"/>` : '';
    const common = `font-size="${fs}" font-family="${font}" font-weight="${weight}" font-style="${style}" text-anchor="${anchor}"`;
    const rows = (attrs) => lines.map((l, i) => `<text x="${x}" y="${pad + ol + fs + i * lh}" ${common} ${attrs}>${escX(l)}</text>`).join('');
    const shadow = st.shadow ? rows(`fill="rgba(0,0,0,0.35)" transform="translate(2,3)"`) : '';
    const outline = ol ? rows(`fill="none" stroke="${st.outline.color}" stroke-width="${ol * 2}" stroke-linejoin="round"`) : '';
    const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}" viewBox="0 0 ${w} ${h}">${defs}${bg}${shadow}${outline}${rows(`fill="${fill}"`)}</svg>`;
    this.textCostume = { name: '_text_', text: toStr(text), src: Lib.svgToDataURL(svg), w, h, cx: w / 2, cy: h / 2 }; this.R.img(this.textCostume);
  };
  TP.typeText = async function (T, text, size, color) { const s2 = toStr(text); const speed = (this.textStyle && this.textStyle.speed) || 30; for (let i = 1; i <= s2.length; i++) { this.showText(s2.slice(0, i), size, color); await T.wait(1 / speed); } if (!s2.length) this.showText('', size, color); };
  // dialogue box honours the style block
  const origDrawDialog = RP.drawDialog;
  RP.drawDialog = function (ctx) {
    const d = this.dialog; const st = this.dialogStyle || { bg: 'rgba(20,24,40,0.92)', fg: '#ffffff', speed: 40 };
    if (!d.done) { d.shown = Math.min(d.text.length, Math.floor((this.time - d.start) * st.speed)); if (d.shown >= d.text.length) d.done = true; }
    if (this.wantAdvance()) { if (!d.advArmed) { d.advArmed = true; this.dialogAdvance = true; } } else d.advArmed = false;
    const x = 12, y = H - 96, w = W - 24, h = 84;
    ctx.fillStyle = st.bg; this.roundRect(ctx, x, y, w, h, 10); ctx.fill(); ctx.strokeStyle = st.fg; ctx.lineWidth = 2; this.roundRect(ctx, x + 3, y + 3, w - 6, h - 6, 8); ctx.stroke();
    if (d.name) { ctx.font = 'bold 13px Helvetica, Arial, sans-serif'; ctx.textBaseline = 'middle'; const nw = ctx.measureText(d.name).width + 16; ctx.fillStyle = '#4C97FF'; this.roundRect(ctx, x + 10, y - 11, nw, 22, 11); ctx.fill(); ctx.fillStyle = '#fff'; ctx.textAlign = 'left'; ctx.fillText(d.name, x + 18, y); }
    ctx.font = '15px Helvetica, Arial, sans-serif'; ctx.textBaseline = 'top'; ctx.fillStyle = st.fg; ctx.textAlign = 'left';
    d.text.slice(0, d.shown).split('\n').forEach((line, i) => ctx.fillText(line, x + 16, y + 16 + i * 20));
    if (d.done && Math.floor(this.time * 2) % 2 === 0) { ctx.fillStyle = st.fg; ctx.beginPath(); ctx.moveTo(x + w - 24, y + h - 20); ctx.lineTo(x + w - 12, y + h - 20); ctx.lineTo(x + w - 18, y + h - 12); ctx.fill(); }
  };

  /* =================================================================== VARIABLE MONITOR COLOURS & MODES =================================================================== */
  const varArg = { json: { type: 'field_variable', name: 'VAR', variableTypes: [''], defaultType: '' }, shadow: '' };
  add('data', 'spark_d_varcolor', 'set color of %1 display to %2', [varArg, A.col('COLOR', '#FF8C1A')]);
  stmt('spark_d_varcolor', (b, c) => `R.monitorStyle(S, ${f(c, b, 'VAR')}, { color: ${s(c, b, 'COLOR')} });`);
  add('data', 'spark_d_varmode', 'show %1 as %2', [varArg, A.dd('MODE', ['normal', 'large readout', 'slider'])]);
  stmt('spark_d_varmode', (b, c) => `R.monitorStyle(S, ${f(c, b, 'VAR')}, { mode: ${f(c, b, 'MODE')} === "large readout" ? "large" : ${f(c, b, 'MODE')} });`);
  add('data', 'spark_d_varpos', 'move %1 display to x: %2 y: %3', [varArg, A.num('X', 5), A.num('Y', 5)]);
  stmt('spark_d_varpos', (b, c) => `R.monitorStyle(S, ${f(c, b, 'VAR')}, { x: ${n(c, b, 'X')}, y: ${n(c, b, 'Y')} });`);
  add('data', 'spark_d_slider', 'slider for %1 from %2 to %3', [varArg, A.num('MIN', 0), A.num('MAX', 100)]);
  stmt('spark_d_slider', (b, c) => `R.monitorStyle(S, ${f(c, b, 'VAR')}, { mode: "slider", min: ${n(c, b, 'MIN')}, max: ${n(c, b, 'MAX', '100')} });`);
  RP.monitorStyle = function (S, name, style) { const targetName = S && !S.isStage && (name in S.vars) ? S.name : null; let m = this.monitors.find(x => x.name === name && x.target === targetName && !x.isList); if (!m) { m = { target: targetName, name, isList: false, visible: true, x: null, y: null }; this.monitors.push(m); } Object.assign(m, style); m.visible = true; this.onEvent('monitorsChanged'); };

  /* =================================================================== LISTS & DATA (shown in Operators) =================================================================== */
  sep('operators');
  const listArg = { json: { type: 'field_variable', name: 'LIST', variableTypes: ['list'], defaultType: 'list' }, shadow: '' };
  add('operators', 'spark_d_listop', '%1 list %2', [A.dd('OP', ['shuffle', 'sort', 'sort as numbers', 'reverse', 'remove duplicates']), listArg]);
  stmt('spark_d_listop', (b, c) => `R.listOp(R.l(S, ${f(c, b, 'LIST')}), ${f(c, b, 'OP')});`);
  add('operators', 'spark_d_listcalc', '%1 of %2', [A.dd('OP', ['sum', 'max', 'min', 'average']), listArg], 'number');
  expr('spark_d_listcalc', (b, c) => `R.listCalc(R.l(S, ${f(c, b, 'LIST')}), ${f(c, b, 'OP')})`);
  add('operators', 'spark_d_listjoin', 'join %1 with %2', [listArg, A.txt('SEP', ', ')], 'string');
  expr('spark_d_listjoin', (b, c) => `R.l(S, ${f(c, b, 'LIST')}).map(x => R.str(x)).join(${s(c, b, 'SEP')})`);
  add('operators', 'spark_d_cell', 'cell x: %1 y: %2 of %3 (width %4)', [A.num('X', 1), A.num('Y', 1), listArg, A.num('W', 10)], 'string');
  expr('spark_d_cell', (b, c) => `R.listItem(R.l(S, ${f(c, b, 'LIST')}), (Math.round(${n(c, b, 'Y', '1')}) - 1) * Math.round(${n(c, b, 'W', '10')}) + Math.round(${n(c, b, 'X', '1')}))`);
  add('operators', 'spark_d_setcell', 'set cell x: %1 y: %2 of %3 (width %4) to %5', [A.num('X', 1), A.num('Y', 1), listArg, A.num('W', 10), A.txt('VALUE', 'x')]);
  stmt('spark_d_setcell', (b, c) => `R.listSetGrid(R.l(S, ${f(c, b, 'LIST')}), Math.round(${n(c, b, 'X', '1')}), Math.round(${n(c, b, 'Y', '1')}), Math.round(${n(c, b, 'W', '10')}), ${c.val(b, 'VALUE', '""')});`);
  add('operators', 'spark_d_dictget', 'value of %1 in %2', [A.txt('KEY', 'name'), listArg], 'string');
  expr('spark_d_dictget', (b, c) => `R.dictGet(R.l(S, ${f(c, b, 'LIST')}), ${s(c, b, 'KEY')})`);
  add('operators', 'spark_d_dictset', 'set %1 to %2 in %3', [A.txt('KEY', 'name'), A.txt('VALUE', 'Sam'), listArg]);
  stmt('spark_d_dictset', (b, c) => `R.dictSet(R.l(S, ${f(c, b, 'LIST')}), ${s(c, b, 'KEY')}, ${c.val(b, 'VALUE', '""')});`);
  add('operators', 'spark_d_clamp', 'keep %1 between %2 and %3', [A.num('V', 150), A.num('LO', 0), A.num('HI', 100)], 'number');
  expr('spark_d_clamp', (b, c) => `Math.max(${n(c, b, 'LO')}, Math.min(${n(c, b, 'HI', '100')}, ${n(c, b, 'V')}))`);
  add('operators', 'spark_d_map', 'map %1 from %2 - %3 to %4 - %5', [A.num('V', 50), A.num('A', 0), A.num('B', 100), A.num('C', 0), A.num('D', 1)], 'number');
  expr('spark_d_map', (b, c) => `((${n(c, b, 'V')} - ${n(c, b, 'A')}) / ((${n(c, b, 'B', '100')} - ${n(c, b, 'A')}) || 1) * (${n(c, b, 'D', '1')} - ${n(c, b, 'C')}) + ${n(c, b, 'C')})`);
  add('operators', 'spark_d_lerp', 'blend %1 toward %2 by %3 %', [A.num('A', 0), A.num('B', 100), A.num('PCT', 10)], 'number');
  expr('spark_d_lerp', (b, c) => `(${n(c, b, 'A')} + (${n(c, b, 'B', '100')} - ${n(c, b, 'A')}) * ${n(c, b, 'PCT', '10')} / 100)`);
  add('operators', 'spark_d_chance', '%1 % chance', [A.num('PCT', 50)], 'boolean');
  expr('spark_d_chance', (b, c) => `(Math.random() * 100 < ${n(c, b, 'PCT', '50')})`);
  add('operators', 'spark_d_pick', 'pick random of %1 %2 %3', [A.txt('A', 'red'), A.txt('B', 'green'), A.txt('C', 'blue')], 'string');
  expr('spark_d_pick', (b, c) => `[${c.val(b, 'A', '""')}, ${c.val(b, 'B', '""')}, ${c.val(b, 'C', '""')}][Math.floor(Math.random() * 3)]`);
  add('operators', 'spark_d_between', '%1 is between %2 and %3?', [A.num('V', 5), A.num('LO', 1), A.num('HI', 10)], 'boolean');
  expr('spark_d_between', (b, c) => `(${n(c, b, 'V')} >= ${n(c, b, 'LO')} && ${n(c, b, 'V')} <= ${n(c, b, 'HI', '10')})`);
  add('operators', 'spark_d_sign', '%1 of %2', [A.dd('OP', ['sign', 'squared', 'cubed', 'distance from 0', 'angle wrap'])  , A.num('V', -4)], 'number');
  expr('spark_d_sign', (b, c) => `R.mathExtra(${f(c, b, 'OP')}, ${n(c, b, 'V')})`);
  RP.listOp = function (list, op) { if (op === 'shuffle') { for (let i = list.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [list[i], list[j]] = [list[j], list[i]]; } } else if (op === 'sort') list.sort((a, b) => this.compare(a, b)); else if (op === 'sort as numbers') list.sort((a, b) => toNum(a) - toNum(b)); else if (op === 'reverse') list.reverse(); else if (op === 'remove duplicates') { const seen = new Set(); for (let i = 0; i < list.length; i++) { const k = toStr(list[i]).toLowerCase(); if (seen.has(k)) list.splice(i--, 1); else seen.add(k); } } };
  RP.listCalc = function (list, op) { const nums = list.map(toNum); if (!nums.length) return 0; if (op === 'sum') return nums.reduce((a, b) => a + b, 0); if (op === 'max') return Math.max(...nums); if (op === 'min') return Math.min(...nums); return nums.reduce((a, b) => a + b, 0) / nums.length; };
  RP.listSetGrid = function (list, x, y, w, v) { const i = (y - 1) * w + x; if (i < 1) return; while (list.length < i) list.push(''); list[i - 1] = v; };
  RP.dictGet = function (list, key) { const k = toStr(key).toLowerCase() + '='; const e = list.find(x => toStr(x).toLowerCase().startsWith(k)); return e ? toStr(e).slice(k.length) : ''; };
  RP.dictSet = function (list, key, v) { const k = toStr(key); const kl = k.toLowerCase() + '='; const i = list.findIndex(x => toStr(x).toLowerCase().startsWith(kl)); const entry = k + '=' + toStr(v); if (i >= 0) list[i] = entry; else list.push(entry); };
  RP.mathExtra = function (op, v) { switch (op) { case 'sign': return Math.sign(v); case 'squared': return v * v; case 'cubed': return v * v * v; case 'distance from 0': return Math.abs(v); case 'angle wrap': return ((v + 179) % 360 + 360) % 360 - 179; } return v; };

  /* =================================================================== CONTROLLER: more players =================================================================== */
  const origControl = TP.controlWith;
  TP.controlWith = function (keys, speed) {
    const R = this.R, k = R.keyPressed.bind(R), pad = R.pad; let left, right, up, down;
    if (keys === 'controller 1' || keys === 'controller 2') { const p = keys.endsWith('2') ? 2 : 1; left = pad.button(p, 'left') || pad.stick(p, 'left', 'x') < -0.4; right = pad.button(p, 'right') || pad.stick(p, 'left', 'x') > 0.4; up = pad.button(p, 'up') || pad.button(p, 'A') || pad.stick(p, 'left', 'y') < -0.4; down = pad.button(p, 'down') || pad.stick(p, 'left', 'y') > 0.4; }
    else if (keys === 'IJKL') { left = k('j'); right = k('l'); up = k('i'); down = k('k'); }
    else return origControl.call(this, keys, speed);
    const h = (right ? 1 : 0) - (left ? 1 : 0), v = (up ? 1 : 0) - (down ? 1 : 0);
    if (this.phys.mode === 'platformer') { this.phys.vx = h * speed; if (up) this.jump(Math.max(8, speed * 2.2)); }
    else if (this.phys.mode === 'top-down') { if (h || v) { const L = Math.hypot(h, v); this.phys.vx = h / L * speed; this.phys.vy = v / L * speed; } }
    else if (h || v) { const L = Math.hypot(h, v); this.goTo(this.x + h / L * speed, this.y + v / L * speed); }
    if (h !== 0 && this.rotationStyle === 'left-right') this.direction = h > 0 ? 90 : -90;
  };
  // widen the dropdown on the existing "move with" block
  BL.def('spark_phys_control', 'physics', 'move with %1 at speed %2', [A.dd('KEYS', ['arrow keys', 'WASD', 'IJKL', 'controller 1', 'controller 2']), A.num('SPEED', 5)]);

  /* =================================================================== RUNTIME PLUGIN =================================================================== */
  const WEATHER = {
    rain: { color: '#9ecbff', size: 3, vy: -14, vx: -1, life: 1.2, n: 4, shape: 'square' },
    snow: { color: '#ffffff', size: 4, vy: -1.5, vx: 0.3, life: 5, n: 1, shape: 'circle', sway: true },
    'falling leaves': { color: '#e07b2a', size: 6, vy: -1.2, vx: 0.8, life: 6, n: 0.4, shape: 'square', sway: true },
    stars: { color: '#ffffff', size: 2, vy: 0, vx: 0, life: 2, n: 0.6, shape: 'star', still: true },
    fireflies: { color: '#ffee58', size: 3, vy: 0.3, vx: 0, life: 3, n: 0.3, shape: 'circle', sway: true, glow: true },
    ash: { color: '#9e9e9e', size: 3, vy: -0.8, vx: 0.5, life: 5, n: 0.8, shape: 'circle', sway: true }
  };
  const plugin = {
    init(R) {
      R.inventory = {}; R.floats = []; R.timers = []; R.keysJust = new Set(); R.mouseButtons = new Set(); R.scrollAmt = 0; R.swipe = null; R.tilt = { x: 0, y: 0 }; R.fps = 60; R.leaderboard = []; R.musicInit();
      const hpOf = t => { if (!t.hp) t.hp = { value: 100, max: 100, show: false, invUntil: 0 }; return t.hp; };
      const origCreate = R.createClone.bind(R);
      R.createClone = (S, name) => { const c = origCreate(S, name); if (c) { const src = R.findTarget(S, name); c.hp = { ...hpOf(src), invUntil: 0 }; c.proj = null; c.anim = src.anim ? { ...src.anim } : null; c.spawner = null; } return c; };
      // make sure every target has hp
      const origLoad = R.loadProject.bind(R); R.loadProject = p => { origLoad(p); for (const t of R.allTargets()) hpOf(t); };
      const origAdd = R.addSprite.bind(R); R.addSprite = d => { const t = origAdd(d); hpOf(t); return t; };
      for (const t of R.allTargets()) hpOf(t);
      // input extras
      window.addEventListener('keydown', e => { if (e.target && (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA' || e.target.isContentEditable)) return; const k = { ' ': 'space', ArrowUp: 'up arrow', ArrowDown: 'down arrow', ArrowLeft: 'left arrow', ArrowRight: 'right arrow', Enter: 'enter' }[e.key] || e.key.toLowerCase(); if (!e.repeat) { R.keysJust.add(k); R.lastKey = k; } });
      R.canvas.addEventListener('pointerdown', e => { R.mouseButtons.add(['left', 'middle', 'right'][e.button] || 'left'); R._swipeStart = { x: e.clientX, y: e.clientY, t: performance.now() }; });
      const upB = e => { R.mouseButtons.delete(['left', 'middle', 'right'][e.button] || 'left'); if (R._swipeStart) { const dx = e.clientX - R._swipeStart.x, dy = e.clientY - R._swipeStart.y; if (performance.now() - R._swipeStart.t < 600 && Math.hypot(dx, dy) > 40) R.swipe = Math.abs(dx) > Math.abs(dy) ? (dx > 0 ? 'right' : 'left') : (dy > 0 ? 'down' : 'up'); R._swipeStart = null; } };
      R.canvas.addEventListener('pointerup', upB); R.canvas.addEventListener('pointercancel', upB);
      R.canvas.addEventListener('wheel', e => { R.scrollAmt += e.deltaY / 100; if (R.running) e.preventDefault(); }, { passive: false });
      window.addEventListener('deviceorientation', e => { R.tilt.x = Math.round((e.gamma || 0) * 10) / 10; R.tilt.y = Math.round((e.beta || 0) * 10) / 10; });
      R.on('targetMoved', (t, done) => { if (done && R.running) R.startHats(sc => sc.hat === 'dropped', true, [t]); });
      let frames = 0, last = performance.now(); const fpsLoop = () => { frames++; const now = performance.now(); if (now - last >= 1000) { R.fps = frames; frames = 0; last = now; } requestAnimationFrame(fpsLoop); }; fpsLoop();
    },
    reset(R) { R.inventory = {}; R.floats = []; R.timers = []; R.screenTint = null; R.darkness = 0; R.weather = null; R.parallax = 0; R.transitionFx = null; R.minimap = false; R.showInventory = false; R.boardVisible = false; R.xp = 0; R.xpLevel = 1; R.scrollAmt = 0; R.music.stop(); for (const t of R.allTargets()) { t.hp = { value: 100, max: 100, show: false, invUntil: 0 }; t.anim = null; t.proj = null; t.spawner = null; t.outline = null; t.stretch = null; t.light = null; t.emote = null; t.checkpoint = null; t.phys.oneWay = false; t.phys.ladder = false; t.phys.water = false; } },
    stop(R) { R.music.stop(); R.touchControls(false); R.timers = []; },
    tick(R, dt) {
      if (R.frozenUntil) { if (performance.now() >= R.frozenUntil) { R.timeScale = R._savedScale ?? 1; R.frozenUntil = null; } }
      // timers
      for (let i = R.timers.length - 1; i >= 0; i--) if (R.time >= R.timers[i].at) { const tm = R.timers.splice(i, 1)[0]; R.broadcast(tm.msg); }
      // per-sprite systems
      for (const t of R.targets) {
        if (t.anim && t.costumes.length) { t.anim.acc += dt; while (t.anim.acc >= 1 / t.anim.fps) { t.anim.acc -= 1 / t.anim.fps; const a = clamp(t.anim.a, 0, t.costumes.length - 1), b = clamp(t.anim.b, 0, t.costumes.length - 1); let i = t.currentCostume + 1; if (i > Math.max(a, b) || i < Math.min(a, b)) i = Math.min(a, b); t.currentCostume = i; } }
        if (t.proj) { t.goTo(t.x + t.proj.vx, t.y + t.proj.vy); const v = R.viewRect(false); const far = t.x < v.left - 300 || t.x > v.right + 300 || t.y < v.bottom - 300 || t.y > v.top + 300; const hitTile = R.world.active && R.world.solidRects(t.bounds()).length > 0; if (far || hitTile || R.time - t.proj.born > 6) { if (hitTile) R.particles.burst('dust', t.x, t.y, 0.5); if (t.isClone) R.deleteClone(t); else { t.proj = null; t.visible = false; } } }
        if (t.spawner) { t.spawner.acc += dt; if (t.spawner.acc >= t.spawner.every) { t.spawner.acc = 0; const c = R.createClone(t, t.spawner.name); if (c) { const p = R.world.randomFree(); c.x = p.x; c.y = p.y; c.visible = true; } } }
        if (t.emote && R.time > t.emote.until) t.emote = null;
      }
      for (let i = R.floats.length - 1; i >= 0; i--) { const fl = R.floats[i]; fl.life -= dt; fl.y += 40 * dt; if (fl.life <= 0) R.floats.splice(i, 1); }
      // weather
      if (R.weather && WEATHER[R.weather]) { const w = WEATHER[R.weather], v = R.viewRect(false); const count = w.n * (w.still ? 0.3 : 1); for (let i = 0; i < count || (i < 1 && Math.random() < count); i++) { const x = v.left + Math.random() * (v.right - v.left) * 1.3 - (v.right - v.left) * 0.15, y = w.still || w.vy > 0 ? v.bottom + Math.random() * (v.top - v.bottom) : v.top + 10; R.particles.list.push({ x, y, vx: w.vx + (w.sway ? (Math.random() - 0.5) : 0), vy: w.vy, life: w.life, max: w.life, size: w.size, color: w.color, shape: w.shape, g: 0, fade: true, rot: 0, sway: w.sway }); } for (const p of R.particles.list) if (p.sway) p.vx += (Math.random() - 0.5) * 0.3; }
      R.keysJust.clear(); R.swipe = null;
    },
    drawWorld(R, ctx, map) {
      const z = R.cam.zoom;
      for (const t of R.targets) {
        if (!t.visible) continue;
        if (t.hp && t.hp.show) { const b = t.bounds(); const [sx, sy] = map(t.x, b.top); const w = Math.max(30, b.w * z * 0.8); ctx.fillStyle = 'rgba(0,0,0,0.6)'; ctx.fillRect(sx - w / 2, sy - 12, w, 6); ctx.fillStyle = t.hp.value / t.hp.max > 0.5 ? '#4caf50' : t.hp.value / t.hp.max > 0.25 ? '#ff9800' : '#f44336'; ctx.fillRect(sx - w / 2 + 1, sy - 11, (w - 2) * clamp(t.hp.value / t.hp.max, 0, 1), 4); }
        if (t.emote) { const b = t.bounds(); const [sx, sy] = map(t.x, b.top); ctx.font = '22px sans-serif'; ctx.textAlign = 'center'; ctx.textBaseline = 'bottom'; const bob = Math.sin(R.time * 6) * 3; ctx.fillText(t.emote.text, sx, sy - 6 + bob); ctx.textAlign = 'left'; }
      }
      ctx.font = 'bold 16px Helvetica, Arial, sans-serif'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      for (const fl of R.floats) { const [sx, sy] = map(fl.x, fl.y); ctx.globalAlpha = clamp(fl.life, 0, 1); ctx.lineWidth = 3; ctx.strokeStyle = 'rgba(0,0,0,0.6)'; ctx.strokeText(fl.text, sx, sy); ctx.fillStyle = fl.color; ctx.fillText(fl.text, sx, sy); }
      ctx.globalAlpha = 1; ctx.textAlign = 'left';
      if (R.screenTint) { ctx.globalAlpha = R.screenTint.alpha; ctx.fillStyle = R.screenTint.color; ctx.fillRect(0, 0, W, H); ctx.globalAlpha = 1; }
      if (R.darkness > 0) {
        const c = R._darkCanvas = R._darkCanvas || document.createElement('canvas'); c.width = W; c.height = H; const dc = c.getContext('2d');
        dc.fillStyle = `rgba(0,0,10,${R.darkness})`; dc.fillRect(0, 0, W, H); dc.globalCompositeOperation = 'destination-out';
        for (const t of R.targets) if (t.light && t.visible) { const [sx, sy] = map(t.x, t.y); const r = t.light * z; const g = dc.createRadialGradient(sx, sy, 0, sx, sy, r); g.addColorStop(0, 'rgba(0,0,0,1)'); g.addColorStop(0.6, 'rgba(0,0,0,0.8)'); g.addColorStop(1, 'rgba(0,0,0,0)'); dc.fillStyle = g; dc.beginPath(); dc.arc(sx, sy, r, 0, 6.283); dc.fill(); }
        ctx.drawImage(c, 0, 0);
      }
      if (R.transitionFx) {
        const { mode, k } = R.transitionFx; ctx.fillStyle = '#000';
        if (mode.startsWith('circle')) { const r = (mode === 'circle close' ? 1 - k : k) * Math.hypot(W, H) / 2; ctx.beginPath(); ctx.rect(0, 0, W, H); ctx.arc(W / 2, H / 2, Math.max(0, r), 0, 6.283, true); ctx.fill(); }
        else if (mode === 'wipe left') ctx.fillRect(0, 0, W * k, H); else if (mode === 'wipe right') ctx.fillRect(W - W * k, 0, W * k, H);
        else { const px = Math.max(1, Math.round((mode === 'pixelate out' ? k : 1 - k) * 40)); if (px > 1) { const c = R._pixCanvas = R._pixCanvas || document.createElement('canvas'); c.width = Math.ceil(W / px); c.height = Math.ceil(H / px); const pc = c.getContext('2d'); pc.imageSmoothingEnabled = false; pc.drawImage(R.canvas, 0, 0, c.width, c.height); ctx.imageSmoothingEnabled = false; ctx.drawImage(c, 0, 0, W, H); ctx.imageSmoothingEnabled = true; } }
      }
    },
    drawScreen(R, ctx) {
      if (R.showInventory) { const items = Object.entries(R.inventory).filter(e => e[1] > 0); ctx.font = 'bold 13px Helvetica, Arial, sans-serif'; ctx.textBaseline = 'middle'; let x = 8; const y = H - 30; if (!items.length) { ctx.fillStyle = 'rgba(0,0,0,0.5)'; R.roundRect(ctx, x, y, 90, 22, 11); ctx.fill(); ctx.fillStyle = '#ccc'; ctx.fillText('(empty bag)', x + 8, y + 11); } for (const [name, count] of items) { const txt = name + (count > 1 ? ' ×' + count : ''); const w = ctx.measureText(txt).width + 16; ctx.fillStyle = 'rgba(0,0,0,0.6)'; R.roundRect(ctx, x, y, w, 22, 11); ctx.fill(); ctx.fillStyle = '#fff'; ctx.fillText(txt, x + 8, y + 11); x += w + 6; } }
      if (R.boardVisible) { const b = R.leaderboard || []; const x = W - 150, y = 36; ctx.fillStyle = 'rgba(0,0,0,0.65)'; R.roundRect(ctx, x, y, 142, 24 + Math.max(1, b.length) * 18, 8); ctx.fill(); ctx.fillStyle = '#ffd740'; ctx.font = 'bold 13px Helvetica, Arial, sans-serif'; ctx.textBaseline = 'top'; ctx.fillText('🏆 Top players', x + 10, y + 6); ctx.font = '12px Helvetica, Arial, sans-serif'; ctx.fillStyle = '#fff'; if (!b.length) ctx.fillText('no scores yet', x + 10, y + 24); b.slice(0, 10).forEach((e, i) => { ctx.fillText((i + 1) + '. ' + e.name, x + 10, y + 24 + i * 18); ctx.textAlign = 'right'; ctx.fillText(toStr(e.score), x + 132, y + 24 + i * 18); ctx.textAlign = 'left'; }); }
      if (R.minimap && R.world.active) { const Wd = R.world; const mw = 110, mh = Math.round(mw * Wd.h / Wd.w); const x = W - mw - 8, y = H - mh - 8; const sx = mw / Wd.w, sy = mh / Wd.h; ctx.fillStyle = 'rgba(0,0,0,0.5)'; ctx.fillRect(x - 2, y - 2, mw + 4, mh + 4); const COLORS = { grass: '#5cb83a', dirt: '#8b5a2b', stone: '#8f949c', wall: '#4a4e5a', water: '#3f9be8', tree: '#2e8b3a', flower: '#7fc85a', path: '#d9b876', floor: '#cfd3dc', sand: '#f0dc9c', lava: '#ff5a1f', brick: '#c0564a', wood: '#c89550', ice: '#bfe9ff', bush: '#2e8b3a', rock: '#8f949c', spike: '#9aa0a6', chest: '#ffd93b', door: '#a5743a', cloud: '#fff', snow: '#eef6ff' }; for (let r = 0; r < Wd.h; r++) for (let c = 0; c < Wd.w; c++) { const k = Wd.tiles[r * Wd.w + c]; if (!k) continue; ctx.fillStyle = COLORS[SR.TILE_NAMES[k]] || '#888'; ctx.fillRect(x + c * sx, y + r * sy, Math.ceil(sx), Math.ceil(sy)); } for (const t of R.targets) if (t.visible && !t.sticky) { ctx.fillStyle = t.phys.mode !== 'off' && !t.isClone ? '#fff' : '#ff4081'; const cx = x + (t.x - Wd.left()) / Wd.size * sx, cy = y + (Wd.top() - t.y) / Wd.size * sy; ctx.fillRect(cx - 2, cy - 2, 4, 4); } }
    }
  };
  SR.plugins.push(plugin);
  // sprites that already exist get hp etc. when the runtime is created (init runs in the constructor)
})();
