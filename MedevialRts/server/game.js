// Authoritative RTS simulation. The server owns all game state; clients only
// send commands and render snapshots.

import {
  START_MONEY, INCOME_INTERVAL, AGGRO_RANGE, MAX_QUEUE,
  BUILDINGS, UNITS, unitRadius, FARM_RADIUS, makeMap, teamOf,
} from '../shared/gamedata.js';

let NEXT_ID = 1;

function dist(a, b) { return Math.hypot(a.x - b.x, a.y - b.y); }
function clamp(v, lo, hi) { return v < lo ? lo : v > hi ? hi : v; }

export class Game {
  // players: [{ slot, name, bot }], mode: 'ffa' | '2v2' | '1v1'
  constructor(players, broadcast, mode = 'ffa') {
    this.players = players;
    this.broadcast = broadcast;
    this.mode = mode;
    this.map = makeMap(mode);
    this.w = this.map.w;
    this.h = this.map.h;
    this.team = {};                       // slot -> team id
    this.walls = [];
    this.ents = new Map();
    this.money = {};
    this.shots = [];
    this.deaths = [];
    this.time = 0;
    this.incomeTimer = 0;
    this.botTimer = 0;
    this.over = false;

    for (const p of players) {
      const c = this.map.spots[p.slot];
      this.team[p.slot] = teamOf(mode, p.slot);
      this.money[p.slot] = START_MONEY;
      this.addBuilding('castle', p.slot, c.x, c.y, true);
      this.addUnit('builder', p.slot, c.x + 90, c.y + 90);
      this.addUnit('builder', p.slot, c.x + 110, c.y + 60);
      p.botState = { attackMode: false };
    }
    for (const f of this.map.farms) {
      this.ents.set(NEXT_ID, { id: NEXT_ID++, cat: 'farm', kind: 'farm', owner: -1, x: f.x, y: f.y, hp: 1, maxHp: 1, r: FARM_RADIUS });
    }
  }

  isEnemy(a, b) {
    if (b.owner === -1 || b.cat === 'farm' || b.hp <= 0) return false;
    return this.team[a.owner] !== this.team[b.owner];
  }

  canHit(attacker, spec, target) {
    if (target.kind && UNITS[target.kind] && UNITS[target.kind].flying) return !!spec.aa;
    return true;
  }

  addUnit(kind, owner, x, y) {
    const s = UNITS[kind];
    const e = {
      id: NEXT_ID++, cat: 'unit', kind, owner,
      x: clamp(x, 20, this.w - 20), y: clamp(y, 20, this.h - 20),
      hp: s.hp, maxHp: s.hp, r: unitRadius(kind),
      dest: null, tgt: 0, forced: 0, buildId: 0, cd: 0,
      flying: !!s.flying,
    };
    this.ents.set(e.id, e);
    return e;
  }

  addBuilding(kind, owner, x, y, built) {
    const s = BUILDINGS[kind];
    const e = {
      id: NEXT_ID++, cat: 'bld', kind, owner, x, y,
      hp: built ? s.hp : Math.max(1, s.hp * 0.1), maxHp: s.hp, r: s.size / 2,
      done: built, queue: [], qt: 0, cd: 0,
    };
    this.ents.set(e.id, e);
    return e;
  }

  // ---- commands from clients (and bots — bots reuse the same paths) ----

  handleCmd(slot, c) {
    if (this.over) return;
    if (c.kind === 'move') {
      for (const id of c.ids || []) {
        const u = this.ents.get(id);
        if (u && u.cat === 'unit' && u.owner === slot) {
          u.dest = { x: clamp(c.x, 10, this.w - 10), y: clamp(c.y, 10, this.h - 10) };
          u.forced = 0; u.tgt = 0; u.buildId = 0;
        }
      }
    } else if (c.kind === 'attack') {
      const t = this.ents.get(c.target);
      if (!t || t.cat === 'farm' || t.owner === -1 || this.team[t.owner] === this.team[slot]) return;
      for (const id of c.ids || []) {
        const u = this.ents.get(id);
        if (u && u.cat === 'unit' && u.owner === slot && UNITS[u.kind].dmg && this.canHit(u, UNITS[u.kind], t)) {
          u.forced = t.id; u.tgt = t.id; u.dest = null; u.buildId = 0;
        }
      }
    } else if (c.kind === 'build') {
      const spec = BUILDINGS[c.b];
      if (!spec || !spec.cost || c.b === 'castle') return 'Cannot build that';
      if (this.money[slot] < spec.cost) return `Need $${spec.cost}`;
      const x = clamp(c.x, 60, this.w - 60), y = clamp(c.y, 60, this.h - 60);
      for (const e of this.ents.values()) {
        // walls may sit close to other walls so lines connect tightly
        const gap = (c.b === 'wall' && e.kind === 'wall') ? 2 : 10;
        if ((e.cat === 'bld' || e.cat === 'farm') && dist(e, { x, y }) < e.r + spec.size / 2 + gap) {
          return 'Too close to something else — pick an open spot';
        }
      }
      const builders = (c.ids || [])
        .map(id => this.ents.get(id))
        .filter(u => u && u.cat === 'unit' && u.kind === 'builder' && u.owner === slot);
      if (!builders.length) return 'No builder selected';
      this.money[slot] -= spec.cost;
      const site = this.addBuilding(c.b, slot, x, y, false);
      for (const b of builders) { b.buildId = site.id; b.dest = null; b.tgt = 0; b.forced = 0; }
    } else if (c.kind === 'train') {
      const b = this.ents.get(c.building);
      if (!b || b.cat !== 'bld' || b.owner !== slot || !b.done) return;
      const trains = BUILDINGS[b.kind].trains || [];
      if (!trains.includes(c.unit) || b.queue.length >= MAX_QUEUE) return;
      const cost = UNITS[c.unit].cost;
      if (this.money[slot] < cost) return;
      this.money[slot] -= cost;
      b.queue.push(c.unit);
    }
  }

  // ---- simulation ----

  tick(dt) {
    if (this.over) return;
    this.time += dt;

    this.incomeTimer += dt;
    if (this.incomeTimer >= INCOME_INTERVAL) {
      this.incomeTimer -= INCOME_INTERVAL;
      this.payIncome();
    }

    this.botTimer += dt;
    const botTurn = this.botTimer >= 2;
    if (botTurn) this.botTimer = 0;

    this.walls = [];
    for (const e of this.ents.values()) if (e.kind === 'wall') this.walls.push(e);

    for (const e of [...this.ents.values()]) {
      if (e.cat === 'unit') this.tickUnit(e, dt);
      else if (e.cat === 'bld') this.tickBuilding(e, dt);
    }

    // enemy walls block ground units; blocked fighters start bashing the wall
    if (this.walls.length) {
      for (const u of this.ents.values()) {
        if (u.cat !== 'unit' || u.flying) continue;
        const blocked = this.collideWalls(u);
        if (blocked && UNITS[u.kind].dmg && !u.tgt && !u.forced) u.tgt = blocked.id;
      }
    }
    this.separate();

    for (const e of [...this.ents.values()]) {
      if (e.hp <= 0 && e.cat !== 'farm') {
        this.ents.delete(e.id);
        this.deaths.push(e.id);
        if (e.kind === 'castle') this.eliminate(e.owner);
      }
    }

    if (botTurn) for (const p of this.players) if (p.bot && !p.dead) this.botThink(p);

    this.checkVictory();
  }

  payIncome() {
    const w = BUILDINGS.windmill;
    for (const e of this.ents.values()) {
      if (e.kind !== 'windmill' || !e.done) continue;
      let near = false;
      for (const f of this.ents.values()) {
        if (f.cat === 'farm' && dist(e, f) < w.farmRange + f.r) { near = true; break; }
      }
      // income values are $/min; payouts happen every INCOME_INTERVAL seconds
      this.money[e.owner] += (near ? w.income : w.incomeFar) / 60 * INCOME_INTERVAL;
    }
    for (const p of this.players) if (!p.dead) this.money[p.slot] += 6 / 60 * INCOME_INTERVAL;
  }

  tickUnit(u, dt) {
    if (u.cd > 0) u.cd -= dt;
    const s = UNITS[u.kind];

    if (u.kind === 'builder') {
      if (u.buildId) {
        const site = this.ents.get(u.buildId);
        if (!site || site.done) { u.buildId = 0; }
        else {
          const d = dist(u, site);
          if (d > site.r + u.r + 8) this.step(u, site, dt);
          else {
            site.hp = Math.min(site.maxHp, site.hp + s.buildRate * dt);
            if (site.hp >= site.maxHp) { site.done = true; u.buildId = 0; }
          }
          return;
        }
      }
      if (u.dest) this.moveToDest(u, dt);
      return;
    }

    let tgt = u.tgt ? this.ents.get(u.tgt) : null;
    if (tgt && (tgt.hp <= 0 || tgt.cat === 'farm' || !this.canHit(u, s, tgt))) tgt = null;
    if (u.forced) {
      const f = this.ents.get(u.forced);
      if (f && f.hp > 0 && this.canHit(u, s, f)) tgt = f; else { u.forced = 0; }
    }
    if (!tgt) {
      tgt = this.nearestEnemy(u, s.range + AGGRO_RANGE, s);
      u.tgt = tgt ? tgt.id : 0;
    } else u.tgt = tgt.id;

    if (tgt) {
      const d = dist(u, tgt) - tgt.r;
      if (d > s.range) this.step(u, tgt, dt);
      else if (u.cd <= 0) {
        u.cd = s.atkCd;
        if (s.projectile) this.shots.push([u.id, tgt.id, s.projectile]);
        if (s.splash) {
          for (const e of this.ents.values()) {
            if (this.isEnemy(u, e) && !e.flying && dist(e, tgt) < s.splash) e.hp -= s.dmg;
          }
        } else tgt.hp -= s.dmg;
      }
      return;
    }
    if (u.dest) this.moveToDest(u, dt);
  }

  moveToDest(u, dt) {
    const d = dist(u, u.dest);
    if (d < Math.max(12, u.r)) { u.dest = null; return; }
    this.step(u, u.dest, dt);
  }

  step(u, to, dt) {
    const s = UNITS[u.kind];
    const d = Math.max(0.001, dist(u, to));
    u.x = clamp(u.x + (to.x - u.x) / d * s.speed * dt, 10, this.w - 10);
    u.y = clamp(u.y + (to.y - u.y) / d * s.speed * dt, 10, this.h - 10);
  }

  nearestEnemy(from, range, spec) {
    let best = null, bd = range;
    for (const e of this.ents.values()) {
      if (!this.isEnemy(from, e)) continue;
      if (e.kind === 'wall') continue; // walls only fought when blocking or force-attacked
      if (spec && !this.canHit(from, spec, e)) continue;
      const d = dist(from, e) - e.r;
      if (d < bd) { bd = d; best = e; }
    }
    return best;
  }

  // push a ground unit out of enemy walls; returns the wall it hit (if any)
  collideWalls(u) {
    let hit = null;
    for (const w of this.walls) {
      if (this.team[w.owner] === this.team[u.owner]) continue;
      const dx = u.x - w.x, dy = u.y - w.y;
      const min = w.r + u.r;
      const d = Math.hypot(dx, dy);
      if (d < min) {
        const nd = d || 0.001;
        u.x = w.x + dx / nd * min;
        u.y = w.y + dy / nd * min;
        hit = w;
      }
    }
    return hit;
  }

  tickBuilding(b, dt) {
    if (!b.done) return;
    const spec = BUILDINGS[b.kind];

    if (b.queue.length) {
      b.qt += dt;
      const kind = b.queue[0];
      if (b.qt >= UNITS[kind].trainTime) {
        b.qt = 0; b.queue.shift();
        const a = Math.random() * Math.PI * 2;
        this.addUnit(kind, b.owner, b.x + Math.cos(a) * (b.r + 25), b.y + Math.sin(a) * (b.r + 25));
      }
    }

    if (spec.dmg) { // tower
      if (b.cd > 0) b.cd -= dt;
      if (b.cd <= 0) {
        const t = this.nearestEnemy(b, spec.range, spec);
        if (t) { b.cd = spec.atkCd; t.hp -= spec.dmg; this.shots.push([b.id, t.id, 'arrow']); }
      }
    }
  }

  // cheap separation; flyers only push against other flyers
  separate() {
    const units = [];
    for (const e of this.ents.values()) if (e.cat === 'unit') units.push(e);
    for (let i = 0; i < units.length; i++) {
      const a = units[i];
      for (let j = i + 1; j < units.length; j++) {
        const b = units[j];
        if (a.flying !== b.flying) continue;
        const dx = b.x - a.x, dy = b.y - a.y;
        const d = Math.hypot(dx, dy), min = a.r + b.r;
        if (d < min && d > 0.001) {
          const push = (min - d) / 2, nx = dx / d, ny = dy / d;
          a.x -= nx * push; a.y -= ny * push;
          b.x += nx * push; b.y += ny * push;
        }
      }
    }
  }

  eliminate(slot) {
    const p = this.players.find(p => p.slot === slot);
    if (!p || p.dead) return;
    p.dead = true;
    for (const e of [...this.ents.values()]) {
      if (e.owner === slot) { this.ents.delete(e.id); this.deaths.push(e.id); }
    }
    this.broadcast({ t: 'eliminated', slot });
  }

  checkVictory() {
    if (this.players.length < 2) return; // sandbox solo game never ends
    const aliveTeams = new Set(this.players.filter(p => !p.dead).map(p => this.team[p.slot]));
    if (aliveTeams.size <= 1) {
      this.over = true;
      const winners = this.players.filter(p => !p.dead).map(p => p.slot);
      this.broadcast({ t: 'gameover', winners });
    }
  }

  // ---- simple bot: economy → army → attack ----

  botThink(p) {
    const slot = p.slot;
    const mine = [...this.ents.values()].filter(e => e.owner === slot);
    const castle = mine.find(e => e.kind === 'castle');
    if (!castle) return;
    const builders = mine.filter(e => e.kind === 'builder');
    const windmills = mine.filter(e => e.kind === 'windmill');
    const barracks = mine.filter(e => e.kind === 'barracks' && e.done);
    const army = mine.filter(e => e.cat === 'unit' && UNITS[e.kind].dmg);
    const idleBuilder = builders.find(b => !b.buildId);

    if (builders.length < 2 && this.money[slot] >= UNITS.builder.cost && !castle.queue.length) {
      this.handleCmd(slot, { kind: 'train', building: castle.id, unit: 'builder' });
    }
    if (idleBuilder && windmills.length < 5 && this.money[slot] >= BUILDINGS.windmill.cost) {
      const farm = [...this.ents.values()]
        .filter(e => e.cat === 'farm')
        .sort((a, b) => dist(a, castle) - dist(b, castle))[windmills.length % 4];
      if (farm) {
        const a = Math.random() * Math.PI * 2;
        this.handleCmd(slot, { kind: 'build', b: 'windmill', ids: [idleBuilder.id], x: farm.x + Math.cos(a) * 110, y: farm.y + Math.sin(a) * 110 });
      }
    } else if (idleBuilder && windmills.length >= 3 && mine.filter(e => e.kind === 'barracks').length < 2 && this.money[slot] >= BUILDINGS.barracks.cost) {
      const a = Math.random() * Math.PI * 2;
      this.handleCmd(slot, { kind: 'build', b: 'barracks', ids: [idleBuilder.id], x: castle.x + Math.cos(a) * 220, y: castle.y + Math.sin(a) * 220 });
    }
    for (const bk of barracks) {
      if (!bk.queue.length && this.money[slot] >= 60) {
        this.handleCmd(slot, { kind: 'train', building: bk.id, unit: Math.random() < 0.6 ? 'swordsman' : 'archer' });
      }
    }
    if (army.length >= 10) p.botState.attackMode = true;
    if (army.length <= 3) p.botState.attackMode = false;
    if (p.botState.attackMode) {
      const target = [...this.ents.values()].find(e => e.kind === 'castle' && this.team[e.owner] !== this.team[slot]);
      if (target) this.handleCmd(slot, { kind: 'move', ids: army.map(u => u.id), x: target.x, y: target.y });
    }
  }

  // ---- snapshot for clients ----

  snapshot() {
    const ents = [];
    for (const e of this.ents.values()) {
      const o = { i: e.id, k: e.kind, o: e.owner, x: Math.round(e.x), y: Math.round(e.y), h: Math.ceil(e.hp) };
      if (e.cat === 'bld') {
        o.d = e.done ? 1 : 0;
        if (e.queue.length) { o.q = e.queue.length; o.p = Math.round(e.qt / UNITS[e.queue[0]].trainTime * 100) / 100; o.u = e.queue[0]; }
      }
      ents.push(o);
    }
    const money = {};
    for (const p of this.players) money[p.slot] = Math.floor(this.money[p.slot]);
    const snap = { t: 'state', time: Math.round(this.time), money, ents, shots: this.shots, deaths: this.deaths };
    this.shots = [];
    this.deaths = [];
    return snap;
  }
}
