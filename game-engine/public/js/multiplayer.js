/* Spark Engine — built-in multiplayer: rooms over WebSocket, automatic remote players, shared variables, room messages, host sync */
(function () {
  const SR = window.SparkRuntime, C = window.SparkCompiler, BL = window.SparkBlocks;
  const TP = SR.Target.prototype, RP = SR.prototype; const { toNum, toStr, clamp, uid } = SR.util;
  const { n, s, f } = C.helpers; const A = BL.args;
  BL.CATS.mp = { name: 'Multiplayer', primary: '#0EA5E9', secondary: '#0C8DC7', tertiary: '#0A78AA' };
  const EX = BL.EXTRA; EX.mp = [];
  const add = (type, msg, args, shape, spriteOnly) => { BL.def(type, 'mp', msg, args || [], shape || 'statement'); EX.mp.push(spriteOnly ? { type, spriteOnly: true } : type); };
  const sep = () => EX.mp.push('sep');
  const stmt = (t, g) => C.STMT[t] = g, expr = (t, g) => C.EXPR[t] = g, hat = (t, g) => C.HATS[t] = g;

  add('spark_mp_join', 'join online room %1 as %2', [A.txt('ROOM', 'my room'), A.txt('NAME', 'player')]);
  stmt('spark_mp_join', (b, c) => `await R.mp.join(T, ${s(c, b, 'ROOM')}, ${s(c, b, 'NAME')});`);
  add('spark_mp_leave', 'leave room', []);
  stmt('spark_mp_leave', () => `R.mp.leave();`);
  add('spark_mp_me', 'this sprite is my player (others see it)', [], 'statement', true);
  stmt('spark_mp_me', () => `S.mpPlayer = true;`);
  add('spark_mp_sync', 'everyone sees this sprite from the host', [], 'statement', true);
  stmt('spark_mp_sync', () => `S.mpSync = true;`);
  add('spark_mp_connected', 'connected to a room?', [], 'boolean');
  expr('spark_mp_connected', () => `R.mp.connected()`);
  add('spark_mp_host', 'am I the host?', [], 'boolean');
  expr('spark_mp_host', () => `R.mp.isHost()`);
  add('spark_mp_num', '%1', [A.dd('WHICH', ['my player number', 'players in room', 'my player name', 'room name', 'ping (ms)'])], 'number');
  expr('spark_mp_num', (b, c) => `R.mp.info(${f(c, b, 'WHICH')})`);
  add('spark_mp_player', 'player %1 %2', [A.num('N', 1), A.dd('WHICH', ['name', 'x position', 'y position', 'score', 'direction', 'costume #'])], 'string');
  expr('spark_mp_player', (b, c) => `R.mp.playerInfo(${n(c, b, 'N', '1')}, ${f(c, b, 'WHICH')})`);
  sep();
  add('spark_mp_whenjoin', 'when a player %1', [A.dd('EV', ['joins', 'leaves'])], 'hat');
  hat('spark_mp_whenjoin', (b, c) => ({ hat: 'mp_' + c.field(b, 'EV') }));
  add('spark_mp_lastjoined', 'name of player who last %1', [A.dd('EV', ['joined', 'left'])], 'string');
  expr('spark_mp_lastjoined', (b, c) => `R.mp.last[${f(c, b, 'EV')}]`);
  sep();
  add('spark_mp_send', 'send %1 with value %2 to %3', [A.txt('MSG', 'hello'), A.txt('VALUE', ''), A.dd('TO', ['everyone in room', 'the host'])]);
  stmt('spark_mp_send', (b, c) => `R.mp.send(${s(c, b, 'MSG')}, ${c.val(b, 'VALUE', '""')}, ${f(c, b, 'TO')});`);
  add('spark_mp_whenmsg', 'when I receive online %1', [A.txt('MSG', 'hello')], 'hat');
  hat('spark_mp_whenmsg', (b, c) => ({ hat: 'mpmsg', name: c.field(b, 'MSG') === undefined ? '' : null, msgExpr: null }));
  add('spark_mp_received', 'received %1', [A.dd('WHICH', ['value', 'sender name', 'sender number'])], 'string');
  expr('spark_mp_received', (b, c) => `R.mp.received(${f(c, b, 'WHICH')})`);
  sep();
  add('spark_mp_setvar', 'set shared %1 to %2', [A.txt('NAME', 'round'), A.txt('VALUE', '1')]);
  stmt('spark_mp_setvar', (b, c) => `R.mp.setShared(${s(c, b, 'NAME')}, ${c.val(b, 'VALUE', '0')});`);
  add('spark_mp_changevar', 'change shared %1 by %2', [A.txt('NAME', 'round'), A.num('BY', 1)]);
  stmt('spark_mp_changevar', (b, c) => `R.mp.setShared(${s(c, b, 'NAME')}, R.num(R.mp.shared[${s(c, b, 'NAME')}]) + ${n(c, b, 'BY', '1')});`);
  add('spark_mp_getvar', 'shared %1', [A.txt('NAME', 'round')], 'string');
  expr('spark_mp_getvar', (b, c) => `(R.mp.shared[${s(c, b, 'NAME')}] ?? 0)`);
  add('spark_mp_tags', 'show player names above players %1', [A.dd('ON', ['on', 'off'])]);
  stmt('spark_mp_tags', (b, c) => `R.mp.tags = ${f(c, b, 'ON')} === "on";`);

  sep();
  add('spark_mp_syncopt', 'share my player %1 %2', [A.dd('WHAT', ['position', 'costume', 'size', 'direction', 'visibility', 'say bubble', 'effects']), A.dd('ON', ['on', 'off'])], 'statement', true);
  stmt('spark_mp_syncopt', (b, c) => `S.mpFlags = S.mpFlags || {}; S.mpFlags[${f(c, b, 'WHAT')}] = ${f(c, b, 'ON')} === "on";`);
  add('spark_mp_setdata', 'set my player %1 to %2', [A.txt('KEY', 'team'), A.txt('VALUE', 'red')]);
  stmt('spark_mp_setdata', (b, c) => `R.mp.data[${s(c, b, 'KEY')}] = ${c.val(b, 'VALUE', '""')};`);
  add('spark_mp_getdata', 'player %1 %2', [A.num('N', 2), A.txt('KEY', 'team')], 'string');
  expr('spark_mp_getdata', (b, c) => `R.mp.playerData(${n(c, b, 'N', '2')}, ${s(c, b, 'KEY')})`);
  add('spark_mp_sendto', 'send %1 with value %2 to player %3', [A.txt('MSG', 'hit'), A.txt('VALUE', '10'), A.num('N', 2)]);
  stmt('spark_mp_sendto', (b, c) => `R.mp.send(${s(c, b, 'MSG')}, ${c.val(b, 'VALUE', '""')}, R.mp.idOf(${n(c, b, 'N', '2')}));`);
  const listArg = { json: { type: 'field_variable', name: 'LIST', variableTypes: ['list'], defaultType: 'list' }, shadow: '' };
  add('spark_mp_names', 'put player %1 into list %2', [A.dd('WHAT', ['names', 'numbers', 'scores']), listArg]);
  stmt('spark_mp_names', (b, c) => `R.mp.fillList(R.l(S, ${f(c, b, 'LIST')}), ${f(c, b, 'WHAT')});`);
  add('spark_mp_color', 'set my player color to %1', [A.col('COLOR', '#4C97FF')]);
  stmt('spark_mp_color', (b, c) => `R.mp.color = ${s(c, b, 'COLOR')};`);
  add('spark_mp_chart', 'show players chart %1', [A.dd('ON', ['on', 'off'])]);
  stmt('spark_mp_chart', (b, c) => `R.mp.chart = ${f(c, b, 'ON')} === "on";`);
  add('spark_mp_kick', 'kick player %1 (host only)', [A.num('N', 2)]);
  stmt('spark_mp_kick', (b, c) => `R.mp.kick(${n(c, b, 'N', '2')});`);
  add('spark_mp_isme', 'player %1 is me?', [A.num('N', 1)], 'boolean');
  expr('spark_mp_isme', (b, c) => `(R.mp.idOf(${n(c, b, 'N', '1')}) === R.mp.id)`);

  // the "when I receive online X" hat needs its text at compile time
  C.HATS.spark_mp_whenmsg = (b, c) => ({ hat: 'mpmsg', name: toStr(c.field(b, 'MSG') || (b.values.MSG && b.values.MSG.fields.TEXT && b.values.MSG.fields.TEXT.text) || '').toLowerCase() });

  class Multiplayer {
    constructor(R) { this.R = R; this.ws = null; this.id = 0; this.name = ''; this.room = ''; this.players = []; this.states = {}; this.shared = {}; this.remotes = new Map(); this.last = { joined: '', left: '' }; this.rx = { value: '', sender: '', senderId: 0 }; this.ping = 0; this.tags = true; this.lastSend = 0; this.data = {}; this.color = '#4C97FF'; this.chart = false; }
    idOf(nth) { const p = this.players[Math.round(nth) - 1]; return p ? p.id : -1; }
    playerData(nth, key) { const p = this.players[Math.round(nth) - 1]; if (!p) return ''; if (p.id === this.id) return this.data[key] ?? ''; const st = this.states[p.id]; return st && st.d ? (st.d[key] ?? '') : ''; }
    fillList(list, what) { list.length = 0; for (const p of this.players) { if (what === 'names') list.push(p.name); else if (what === 'numbers') list.push(p.id); else { const st = p.id === this.id ? this.myState() : this.states[p.id]; list.push(st ? (st.score || 0) : 0); } } }
    kick(nth) { if (!this.isHost() || !this.connected()) return; const id = this.idOf(nth); if (id > 0 && id !== this.id) this.ws.send(JSON.stringify({ t: 'kick', id })); }
    url() { const base = window.SPARK_CLOUD_URL || location.origin; return base.replace(/^http/, 'ws') + '/ws'; }
    connected() { return !!(this.ws && this.ws.readyState === 1 && this.id); }
    isHost() { return this.connected() && this.players.length > 0 && Math.min(...this.players.map(p => p.id)) === this.id; }
    async join(T, room, name) {
      this.leave(); this.room = toStr(room); this.name = toStr(name) || 'player';
      let done = false, ok = false;
      try {
        const ws = new WebSocket(this.url()); this.ws = ws;
        ws.onopen = () => ws.send(JSON.stringify({ t: 'join', project: this.R.cloudId || (this.R.projectName || 'project').replace(/\W/g, ''), room: this.room, name: this.name }));
        ws.onmessage = e => this.onMessage(JSON.parse(e.data), () => { done = true; ok = true; });
        ws.onclose = () => { if (this.ws === ws) { this.id = 0; this.players = []; this.clearRemotes(); done = true; } };
        ws.onerror = () => { done = true; };
      } catch (e) { done = true; }
      const t0 = this.R.time; while (!done && this.R.time - t0 < 8) await T.yield();
      this.R.toast(ok ? `Joined "${this.room}" as ${this.name}` : 'Could not connect to the room', 2);
      if (ok) this.pingLoop();
    }
    leave() { if (this.ws) { try { this.ws.send(JSON.stringify({ t: 'leave' })); this.ws.close(); } catch (e) {} } this.ws = null; this.id = 0; this.players = []; this.states = {}; this.clearRemotes(); }
    pingLoop() { if (this._pingTimer) clearInterval(this._pingTimer); this._pingTimer = setInterval(() => { if (this.connected()) this.ws.send(JSON.stringify({ t: 'ping', at: performance.now() })); }, 3000); }
    onMessage(m, onWelcome) {
      const R = this.R;
      switch (m.t) {
        case 'welcome': this.id = m.id; this.players = m.players; this.shared = m.vars || {}; onWelcome && onWelcome(); break;
        case 'players': { const before = new Set(this.players.map(p => p.id)); this.players = m.players; if (m.joined) { this.last.joined = m.joined.name; if (R.running) R.startHats(sc => sc.hat === 'mp_joins'); } if (m.left) { this.last.left = m.left.name; delete this.states[m.left.id]; this.removeRemotesOf(m.left.id); if (R.running) R.startHats(sc => sc.hat === 'mp_leaves'); } for (const p of this.players) if (!before.has(p.id) && !m.joined) this.last.joined = p.name; break; }
        case 's': this.states[m.id] = { ...(this.states[m.id] || {}), ...m.s, at: performance.now() }; if (R.running) this.applyRemote(m.id, m.s); break;
        case 'h': if (R.running && !this.isHost()) this.applyHost(m.id, m.s); break;
        case 'var': this.shared[m.name] = m.value; break;
        case 'msg': if (m.to === 'the host' && !this.isHost()) break; this.rx = { value: m.value, sender: m.fromName, senderId: m.from }; if (R.running) R.startHats(sc => sc.hat === 'mpmsg' && sc.name === toStr(m.name).toLowerCase()); break;
        case 'pong': this.ping = Math.round(performance.now() - m.at); break;
        case 'error': R.toast('Room: ' + m.msg, 2); break;
      }
    }
    info(which) { switch (which) { case 'my player number': return this.id; case 'players in room': return this.players.length; case 'my player name': return this.name; case 'room name': return this.room; case 'ping (ms)': return this.ping; } return 0; }
    playerInfo(nth, which) { const p = this.players[Math.round(nth) - 1]; if (!p) return ''; if (which === 'name') return p.name; const st = p.id === this.id ? this.myState() : this.states[p.id]; if (!st) return 0; const first = st.p && Object.values(st.p)[0]; switch (which) { case 'x position': return first ? first.x : 0; case 'y position': return first ? first.y : 0; case 'direction': return first ? first.d : 90; case 'costume #': return first ? first.c + 1 : 1; case 'score': return st.score || 0; } return 0; }
    received(which) { return which === 'value' ? this.rx.value : which === 'sender name' ? this.rx.sender : this.rx.senderId; }
    send(name, value, to) { if (!this.connected()) return; this.ws.send(JSON.stringify({ t: 'msg', name: toStr(name), value, to })); }
    setShared(name, value) { this.shared[toStr(name)] = value; if (this.connected()) this.ws.send(JSON.stringify({ t: 'var', name: toStr(name), value })); }
    myState() {
      const R = this.R; const p = {};
      for (const t of R.originals()) if (t.mpPlayer) { const fl = t.mpFlags || {}; const on = k => fl[k] !== false; p[t.name] = { x: on('position') ? Math.round(t.x * 10) / 10 : undefined, y: on('position') ? Math.round(t.y * 10) / 10 : undefined, d: on('direction') ? Math.round(t.direction) : undefined, c: on('costume') ? t.currentCostume : undefined, v: on('visibility') ? (t.visible ? 1 : 0) : undefined, sz: on('size') ? Math.round(t.size) : undefined, say: on('say bubble') ? (t.bubble ? t.bubble.text : '') : undefined, rs: t.rotationStyle === 'left-right' ? 1 : 0, g: on('effects') ? (t.effects.GHOST || 0) : undefined, tc: t.textCostume && t.textCostume.text !== undefined ? { t: t.textCostume.text, s: t.textCostume.src.length < 4000 ? t.textCostume.src : null, w: t.textCostume.w, h: t.textCostume.h } : undefined }; }
      return { p, score: R.game.get('score'), d: this.data, col: this.color };
    }
    tick() {
      const R = this.R; if (!this.connected() || !R.running) return;
      const now = performance.now();
      if (now - this.lastSend >= 50) {
        this.lastSend = now; const st = this.myState();
        if (Object.keys(st.p).length) this.ws.send(JSON.stringify({ t: 's', s: st }));
        if (this.isHost()) { const list = []; for (const t of R.targets) if ((t.mpSync || (t.original && t.original.mpSync)) && !t.isRemote) list.push({ n: t.original ? t.original.name : t.name, id: t.id, x: Math.round(t.x), y: Math.round(t.y), d: Math.round(t.direction), c: t.currentCostume, v: t.visible ? 1 : 0, sz: Math.round(t.size) }); if (list.length || this._sentHost) { this.ws.send(JSON.stringify({ t: 'h', s: list })); this._sentHost = list.length > 0; } }
      }
      // smooth remote movement toward the latest known position
      for (const rt of this.remotes.values()) if (rt._net) { rt.x += (rt._net.x - rt.x) * 0.35; rt.y += (rt._net.y - rt.y) * 0.35; }
    }
    remoteFor(key, orig, playerId, playerName) {
      const R = this.R; let rt = this.remotes.get(key);
      if (rt && R.targets.includes(rt)) return rt;
      rt = Object.create(SR.Target.prototype); Object.assign(rt, orig); rt.id = uid(); rt.isClone = true; rt.isRemote = true; rt.original = orig; rt.playerId = playerId; rt.playerName = playerName || '';
      rt.vars = { ...orig.vars }; rt.lists = {}; rt.effects = { ...orig.effects }; rt.soundEffects = { ...orig.soundEffects }; rt.phys = { ...orig.phys, mode: 'off', solid: orig.phys.solid }; rt.pen = { ...orig.pen }; rt.activeSounds = new Set(); rt.bubble = null; rt.tint = null; rt.mpPlayer = false; rt.mpSync = false; rt.hp = { value: 100, max: 100, show: false, invUntil: 0 }; rt.anim = null; rt.proj = null; rt.spawner = null;
      const i = R.targets.indexOf(orig); R.targets.splice(Math.max(0, i), 0, rt); this.remotes.set(key, rt); return rt;
    }
    applyRemote(playerId, st) {
      const R = this.R; const player = this.players.find(p => p.id === playerId); const keys = new Set();
      for (const [name, v] of Object.entries(st.p || {})) {
        const orig = R.findTarget(null, name); if (!orig) continue; const key = playerId + ':' + name; keys.add(key);
        const rt = this.remoteFor(key, orig, playerId, player ? player.name : ''); const fresh = !rt._net;
        if (v.x !== undefined) { rt._net = { x: v.x, y: v.y }; if (fresh) { rt.x = v.x; rt.y = v.y; } }
        if (v.d !== undefined) rt.direction = v.d; if (v.c !== undefined) rt.currentCostume = v.c; if (v.v !== undefined) rt.visible = !!v.v; if (v.sz !== undefined) rt.size = v.sz; rt.rotationStyle = v.rs ? 'left-right' : orig.rotationStyle; if (v.g !== undefined) rt.effects.GHOST = v.g || 0;
        if (v.say !== undefined) rt.bubble = v.say ? { text: v.say, think: false, id: 'r' } : null;
        if (v.tc && v.tc.s) { if (!rt.textCostume || rt.textCostume.src !== v.tc.s) { rt.textCostume = { name: '_text_', text: v.tc.t, src: v.tc.s, w: v.tc.w, h: v.tc.h, cx: v.tc.w / 2, cy: v.tc.h / 2 }; R.img(rt.textCostume); } } else if (v.tc === undefined || !v.tc) rt.textCostume = null;
        rt.playerColor = st.col || '#4C97FF';
      }
      for (const [key, rt] of this.remotes) if (key.startsWith(playerId + ':') && !keys.has(key)) { R.targets = R.targets.filter(t => t !== rt); this.remotes.delete(key); }
    }
    applyHost(hostId, list) {
      const R = this.R; const keys = new Set();
      for (const v of list) { const orig = R.findTarget(null, v.n); if (!orig) continue; const key = 'h:' + v.id; keys.add(key); const rt = this.remoteFor(key, orig, hostId, ''); const fresh = !rt._net; rt._net = { x: v.x, y: v.y }; if (fresh) { rt.x = v.x; rt.y = v.y; } rt.direction = v.d; rt.currentCostume = v.c; rt.visible = !!v.v; rt.size = v.sz; rt.hostSynced = true; }
      for (const [key, rt] of this.remotes) if (key.startsWith('h:') && !keys.has(key)) { R.targets = R.targets.filter(t => t !== rt); this.remotes.delete(key); }
    }
    removeRemotesOf(playerId) { const R = this.R; for (const [key, rt] of this.remotes) if (key.startsWith(playerId + ':')) { R.targets = R.targets.filter(t => t !== rt); this.remotes.delete(key); } }
    clearRemotes() { const R = this.R; for (const rt of this.remotes.values()) R.targets = R.targets.filter(t => t !== rt); this.remotes.clear(); }
    draw(ctx, map) {
      if (!this.tags) return; ctx.font = 'bold 11px Helvetica, Arial, sans-serif'; ctx.textAlign = 'center'; ctx.textBaseline = 'bottom';
      const label = (t, text, color) => { const b = t.bounds(); const [sx, sy] = map(t.x, b.top); const w = ctx.measureText(text).width + 10; ctx.fillStyle = 'rgba(0,0,0,0.55)'; this.R.roundRect(ctx, sx - w / 2, sy - 18, w, 15, 7); ctx.fill(); ctx.fillStyle = color; ctx.fillText(text, sx, sy - 5); };
      for (const rt of this.remotes.values()) if (rt.visible && rt.playerName && !rt.hostSynced) label(rt, rt.playerName, rt.playerColor || '#fff');
      if (this.connected()) for (const t of this.R.originals()) if (t.mpPlayer && t.visible) label(t, this.name + ' (you)', this.color);
      ctx.textAlign = 'left';
    }
    drawChart(ctx) {
      if (!this.chart || !this.connected()) return;
      const rows = this.players.map(p => { const st = p.id === this.id ? this.myState() : this.states[p.id]; return { name: p.name, id: p.id, score: st ? (st.score || 0) : 0, col: p.id === this.id ? this.color : (st && st.col) || '#888', host: p.id === Math.min(...this.players.map(q => q.id)), me: p.id === this.id }; });
      const x = 8, y = 36, w = 170, h = 26 + rows.length * 20;
      ctx.fillStyle = 'rgba(0,0,0,0.65)'; this.R.roundRect(ctx, x, y, w, h, 8); ctx.fill();
      ctx.font = 'bold 12px Helvetica, Arial, sans-serif'; ctx.textBaseline = 'top'; ctx.fillStyle = '#9ff'; ctx.textAlign = 'left'; ctx.fillText(`👥 ${rows.length} in "${this.room}"`, x + 10, y + 7);
      ctx.font = '12px Helvetica, Arial, sans-serif';
      rows.forEach((r, i) => { const ry = y + 26 + i * 20; ctx.fillStyle = r.col; ctx.beginPath(); ctx.arc(x + 16, ry + 7, 5, 0, 6.283); ctx.fill(); ctx.fillStyle = '#fff'; ctx.fillText((r.host ? '★ ' : '') + r.name + (r.me ? ' (you)' : ''), x + 28, ry); ctx.textAlign = 'right'; ctx.fillText(String(r.score), x + w - 10, ry); ctx.textAlign = 'left'; });
    }
  }

  SR.plugins.push({
    init(R) { R.mp = new Multiplayer(R); },
    tick(R) { R.mp.tick(); },
    stop(R) { R.mp.clearRemotes(); R.mp.states = {}; for (const t of R.allTargets()) { t.mpPlayer = false; t.mpSync = false; } },
    drawWorld(R, ctx, map) { R.mp.draw(ctx, map); },
    drawScreen(R, ctx) { R.mp.drawChart(ctx); },
    reset(R) { R.mp.chart = false; R.mp.data = {}; }
  });
})();
