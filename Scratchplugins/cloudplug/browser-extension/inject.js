// CloudPlug — page script injected into scratch.mit.edu (built from src/).
// CloudPlug block core — one implementation used by:
//   • the browser plugin injected into scratch.mit.edu (live blocks inside the real Scratch editor/player)
//   • the TurboWarp custom extension
//   • the headless tests
// Talks to the CloudPlug server over a WebSocket: {type:'call', id, name, args} → {type:'result', id, result}
(function (root) {
  'use strict';
  const C = 'command', R = 'reporter', BOOL = 'Boolean', HAT = 'hat', STR = 'string', NUM = 'number';

  class CloudPlugBlocks {
    constructor(opts = {}) {
      this.runtime = opts.runtime || null;
      this.server = (opts.server || 'https://cloudplug.apps.tas-ndc.kuhn-labs.com').replace(/\/$/, '');
      this.WS = opts.WebSocket || (typeof WebSocket !== 'undefined' ? WebSocket : null);
      this.getProject = opts.getProject || (() => 'default');
      this.getUser = opts.getUser || (() => 'player');
      this.onStatus = opts.onStatus || (() => {});
      this.project = null; this.user = null; this.ws = null; this.nextId = 1; this.pending = new Map();
      this.vars = {}; this.changed = new Set(); this.messages = []; this._lastMessage = ''; this.status = 'disconnected';
      this.autoConnect = opts.autoConnect !== false;
    }
    getInfo() {
      return {
        id: 'cloudplug', name: 'CloudPlug', color1: '#4c97ff', color2: '#3373cc', color3: '#2f5fae',
        blocks: [
          { opcode: 'connect', blockType: C, text: 'connect to project [PROJECT] as [USER]', arguments: { PROJECT: { type: STR, defaultValue: 'my game' }, USER: { type: STR, defaultValue: 'player' } } },
          { opcode: 'connected', blockType: BOOL, text: 'connected?' },
          { opcode: 'statusR', blockType: R, text: 'status' },
          { opcode: 'whoami', blockType: R, text: 'my name' },
          '---',
          { opcode: 'save', blockType: C, text: 'save [KEY] as [VALUE]', arguments: { KEY: { type: STR, defaultValue: 'high score' }, VALUE: { type: STR, defaultValue: '100' } } },
          { opcode: 'load', blockType: R, text: 'load [KEY]', arguments: { KEY: { type: STR, defaultValue: 'high score' } } },
          { opcode: 'addTo', blockType: R, text: 'add [N] to [KEY]', arguments: { N: { type: NUM, defaultValue: 1 }, KEY: { type: STR, defaultValue: 'total plays' } } },
          { opcode: 'has', blockType: BOOL, text: 'saved [KEY] exists?', arguments: { KEY: { type: STR, defaultValue: 'high score' } } },
          { opcode: 'userSave', blockType: C, text: 'save my [KEY] as [VALUE]', arguments: { KEY: { type: STR, defaultValue: 'level' }, VALUE: { type: STR, defaultValue: '3' } } },
          { opcode: 'userLoad', blockType: R, text: 'load my [KEY]', arguments: { KEY: { type: STR, defaultValue: 'level' } } },
          { opcode: 'otherLoad', blockType: R, text: 'load [KEY] of player [WHO]', arguments: { KEY: { type: STR, defaultValue: 'level' }, WHO: { type: STR, defaultValue: 'griffpatch' } } },
          '---',
          { opcode: 'score', blockType: R, text: 'submit score [SCORE] to [BOARD] → my rank', arguments: { SCORE: { type: NUM, defaultValue: 10 }, BOARD: { type: STR, defaultValue: 'high scores' } } },
          { opcode: 'scoreLow', blockType: R, text: 'submit time [SCORE] to [BOARD] (lower wins) → my rank', arguments: { SCORE: { type: NUM, defaultValue: 30 }, BOARD: { type: STR, defaultValue: 'fastest' } } },
          { opcode: 'top', blockType: R, text: 'top [N] of [BOARD]', arguments: { N: { type: NUM, defaultValue: 10 }, BOARD: { type: STR, defaultValue: 'high scores' } } },
          { opcode: 'topItem', blockType: R, text: 'place [I] on [BOARD]', arguments: { I: { type: NUM, defaultValue: 1 }, BOARD: { type: STR, defaultValue: 'high scores' } } },
          { opcode: 'rank', blockType: R, text: 'my rank on [BOARD]', arguments: { BOARD: { type: STR, defaultValue: 'high scores' } } },
          { opcode: 'best', blockType: R, text: 'my best on [BOARD]', arguments: { BOARD: { type: STR, defaultValue: 'high scores' } } },
          '---',
          { opcode: 'cset', blockType: C, text: 'set super cloud [NAME] to [VALUE]', arguments: { NAME: { type: STR, defaultValue: 'message of the day' }, VALUE: { type: STR, defaultValue: 'hello!' } } },
          { opcode: 'cget', blockType: R, text: 'super cloud [NAME]', arguments: { NAME: { type: STR, defaultValue: 'message of the day' } } },
          { opcode: 'cadd', blockType: R, text: 'add [N] to super cloud [NAME]', arguments: { N: { type: NUM, defaultValue: 1 }, NAME: { type: STR, defaultValue: 'coins collected' } } },
          { opcode: 'whenVar', blockType: HAT, text: 'when super cloud [NAME] changes', arguments: { NAME: { type: STR, defaultValue: 'message of the day' } } },
          '---',
          { opcode: 'listAdd', blockType: C, text: 'add [ITEM] to cloud list [LIST]', arguments: { ITEM: { type: STR, defaultValue: 'thing' }, LIST: { type: STR, defaultValue: 'my list' } } },
          { opcode: 'listItem', blockType: R, text: 'item [I] of cloud list [LIST]', arguments: { I: { type: NUM, defaultValue: 1 }, LIST: { type: STR, defaultValue: 'my list' } } },
          { opcode: 'listLen', blockType: R, text: 'length of cloud list [LIST]', arguments: { LIST: { type: STR, defaultValue: 'my list' } } },
          { opcode: 'listText', blockType: R, text: 'cloud list [LIST] as text', arguments: { LIST: { type: STR, defaultValue: 'my list' } } },
          { opcode: 'listDel', blockType: C, text: 'delete item [I] of cloud list [LIST]', arguments: { I: { type: NUM, defaultValue: 1 }, LIST: { type: STR, defaultValue: 'my list' } } },
          { opcode: 'listClear', blockType: C, text: 'clear cloud list [LIST]', arguments: { LIST: { type: STR, defaultValue: 'my list' } } },
          '---',
          { opcode: 'chat', blockType: C, text: 'send chat [TEXT]', arguments: { TEXT: { type: STR, defaultValue: 'hi!' } } },
          { opcode: 'chatlog', blockType: R, text: 'last [N] chat messages', arguments: { N: { type: NUM, defaultValue: 10 } } },
          { opcode: 'mail', blockType: C, text: 'send mail [TEXT] to [TO]', arguments: { TEXT: { type: STR, defaultValue: 'hello' }, TO: { type: STR, defaultValue: 'friend' } } },
          { opcode: 'inbox', blockType: R, text: 'my inbox' },
          { opcode: 'broadcastAll', blockType: C, text: 'broadcast [TEXT] to every player', arguments: { TEXT: { type: STR, defaultValue: 'round over!' } } },
          { opcode: 'whenMessage', blockType: HAT, text: 'when a message arrives' },
          { opcode: 'lastMessage', blockType: R, text: 'message' },
          { opcode: 'online', blockType: R, text: 'players online' },
          '---',
          { opcode: 'fetchUrl', blockType: R, text: 'fetch [URL]', arguments: { URL: { type: STR, defaultValue: 'https://api.github.com/zen' } } },
          { opcode: 'jsonUrl', blockType: R, text: 'json [URL] → [PATH]', arguments: { URL: { type: STR, defaultValue: 'https://api.open-meteo.com/v1/forecast?latitude=40&longitude=-74&current=temperature_2m' }, PATH: { type: STR, defaultValue: 'current.temperature_2m' } } },
          { opcode: 'weather', blockType: R, text: 'weather in [CITY]', arguments: { CITY: { type: STR, defaultValue: 'New York' } } },
          { opcode: 'define', blockType: R, text: 'definition of [WORD]', arguments: { WORD: { type: STR, defaultValue: 'cat' } } },
          { opcode: 'joke', blockType: R, text: 'random joke' },
          { opcode: 'ai', blockType: R, text: 'ask AI [Q]', arguments: { Q: { type: STR, defaultValue: 'give me a riddle' } } },
          { opcode: 'aichar', blockType: R, text: 'AI as [CHAR] says [Q]', arguments: { CHAR: { type: STR, defaultValue: 'a pirate' }, Q: { type: STR, defaultValue: 'hello' } } },
          { opcode: 'serverTime', blockType: R, text: 'server time (ms)' },
          { opcode: 'serverRandom', blockType: R, text: 'server random [A] to [B]', arguments: { A: { type: NUM, defaultValue: 1 }, B: { type: NUM, defaultValue: 10 } } },
          '---',
          { opcode: 'raw', blockType: R, text: 'request [REQ]', arguments: { REQ: { type: STR, defaultValue: 'ping' } } },
        ],
      };
    }

    // ---- connection ----
    connect(args) { this.project = String(args.PROJECT || 'default'); this.user = String(args.USER || 'player'); return this.open(); }
    ensure() {
      if (this.ws && this.ws.readyState === 1) return Promise.resolve();
      if (this.opening) return this.opening;
      if (!this.autoConnect && !this.project) return Promise.resolve();
      if (!this.project) this.project = String(this.getProject() || 'default');
      if (!this.user) this.user = String(this.getUser() || 'player');
      return this.open();
    }
    open() {
      if (this.ws && this.ws.readyState <= 1) { const old = this.ws; this.ws = null; try { old.close(); } catch {} }
      if (!this.WS) { this.setStatus('no websocket'); return Promise.resolve(); }
      this.setStatus('connecting');
      this.opening = new Promise((resolve) => {
        let ws;
        try { ws = new this.WS(this.server.replace(/^http/, 'ws') + '/plug'); } catch (e) { this.setStatus('error'); this.opening = null; return resolve(); }
        this.ws = ws;
        let settled = false;
        const settle = () => { if (!settled) { settled = true; this.opening = null; resolve(); } };
        ws.onopen = () => ws.send(JSON.stringify({ type: 'hello', project: this.project, user: this.user }));
        ws.onmessage = (ev) => {
          let m; try { m = JSON.parse(ev.data); } catch { return; }
          if (m.type === 'hello') { this.vars = m.vars || {}; this.setStatus('connected'); settle(); }
          else if (m.type === 'result') { const p = this.pending.get(m.id); if (p) { this.pending.delete(m.id); p(m.result); } }
          else if (m.type === 'var') { this.vars[m.name] = m.value; this.changed.add(m.name); }
          else if (m.type === 'message') { this.messages.push(String(m.text)); }
        };
        ws.onclose = () => { this.setStatus('disconnected'); for (const p of this.pending.values()) p(''); this.pending.clear(); settle(); if (this.ws === ws) { this.ws = null; setTimeout(() => { if (!this.ws) this.open(); }, 3000); } };
        ws.onerror = () => { this.setStatus('error'); };
        setTimeout(settle, 6000);
      });
      return this.opening;
    }
    setStatus(s) { this.status = s; try { this.onStatus(s, this); } catch {} }
    connected() { return this.status === 'connected'; }
    statusR() { return this.status; }
    whoami() { return this.user || String(this.getUser() || 'player'); }
    async call(name, ...args) {
      await this.ensure();
      if (!this.ws || this.ws.readyState !== 1) return '';
      const id = this.nextId++;
      return new Promise((resolve) => {
        this.pending.set(id, resolve);
        this.ws.send(JSON.stringify({ type: 'call', id, name, args: args.map((a) => String(a)) }));
        setTimeout(() => { if (this.pending.has(id)) { this.pending.delete(id); resolve(''); } }, 20000);
      });
    }
    async text(name, ...args) { const r = await this.call(name, ...args); if (Array.isArray(r)) return r.join('\n'); return r == null ? '' : String(r); }
    async list(name, ...args) { const r = await this.call(name, ...args); return Array.isArray(r) ? r : (r === '' || r == null ? [] : [String(r)]); }

    // ---- blocks ----
    save(a) { return this.text('save', a.KEY, a.VALUE); }
    load(a) { return this.text('load', a.KEY); }
    addTo(a) { return this.text('add', a.KEY, a.N); }
    async has(a) { return (await this.text('has', a.KEY)) === '1'; }
    userSave(a) { return this.text('usersave', this.whoami(), a.KEY, a.VALUE); }
    userLoad(a) { return this.text('userload', this.whoami(), a.KEY); }
    otherLoad(a) { return this.text('userload', a.WHO, a.KEY); }
    score(a) { return this.text('score', a.BOARD, this.whoami(), a.SCORE); }
    scoreLow(a) { return this.text('scorelow', a.BOARD, this.whoami(), a.SCORE); }
    top(a) { return this.text('top', a.BOARD, a.N); }
    async topItem(a) { const l = await this.list('top', a.BOARD, Math.max(1, Number(a.I) || 1)); return l[Number(a.I) - 1] || ''; }
    rank(a) { return this.text('rank', a.BOARD, this.whoami()); }
    best(a) { return this.text('best', a.BOARD, this.whoami()); }
    async cset(a) { this.vars[String(a.NAME)] = String(a.VALUE); await this.text('cset', a.NAME, a.VALUE); }
    cget(a) { const v = this.vars[String(a.NAME)]; if (v === undefined && this.autoConnect) this.ensure(); return v === undefined ? '' : v; }
    cadd(a) { return this.text('cadd', a.NAME, a.N); }
    whenVar(a) { const n = String(a.NAME); if (this.changed.has(n)) { this.changed.delete(n); return true; } return false; }
    listAdd(a) { return this.text('listadd', a.LIST, a.ITEM); }
    listItem(a) { return this.text('listitem', a.LIST, a.I); }
    listLen(a) { return this.text('listlen', a.LIST); }
    listText(a) { return this.text('listget', a.LIST); }
    listDel(a) { return this.text('listdel', a.LIST, a.I); }
    listClear(a) { return this.text('listclear', a.LIST); }
    chat(a) { return this.text('chat', this.whoami(), a.TEXT); }
    chatlog(a) { return this.text('chatlog', a.N); }
    mail(a) { return this.text('mail', a.TO, this.whoami(), a.TEXT); }
    inbox() { return this.text('inbox', this.whoami()); }
    broadcastAll(a) { return this.text('broadcast', a.TEXT); }
    whenMessage() { if (this.messages.length) { this._lastMessage = this.messages.shift(); return true; } this.ensure(); return false; }
    lastMessage() { return this._lastMessage; }
    online() { return this.text('online'); }
    fetchUrl(a) { return this.text('fetch', a.URL); }
    jsonUrl(a) { return this.text('json', a.URL, a.PATH); }
    weather(a) { return this.text('weather', a.CITY); }
    define(a) { return this.text('define', a.WORD); }
    joke() { return this.text('joke'); }
    ai(a) { return this.text('ai', a.Q); }
    aichar(a) { return this.text('aichar', a.CHAR, a.Q); }
    serverTime() { return this.text('time'); }
    serverRandom(a) { return this.text('random', a.A, a.B); }
    raw(a) { const parts = String(a.REQ).split('&'); return this.text(parts[0], ...parts.slice(1)); }
  }
  if (typeof module !== 'undefined' && module.exports) module.exports = CloudPlugBlocks;
  root.CloudPlugBlocks = CloudPlugBlocks;
})(typeof globalThis !== 'undefined' ? globalThis : this);

// --- scratch.mit.edu glue: find the running VM and plug the block category in, live ---
(function () {
  'use strict';
  if (window.__cloudplugInstalled) return; window.__cloudplugInstalled = true;
  const cfg = (() => { try { return JSON.parse(document.documentElement.dataset.cloudplug || '{}'); } catch { return {}; } })();
  const SERVER = cfg.server || 'https://cloudplug.apps.tas-ndc.kuhn-labs.com';
  let vm = null, ext = null, pill = null;

  const projectFromUrl = () => { const m = location.pathname.match(/projects\/(\d+)/); return m ? m[1] : 'scratch-editor'; };
  const username = () => { try { const u = vm && vm.runtime.ioDevices.userData._username; if (u) return u; } catch {} try { const el = document.querySelector('.profile-name, [class*="user-name"], .account-nav .profile-name'); if (el && el.textContent.trim()) return el.textContent.trim(); } catch {} return 'player'; };

  function install(v) {
    if (vm || !v || !v.extensionManager) return;
    vm = v;
    ext = new CloudPlugBlocks({ runtime: v.runtime, server: SERVER, getProject: projectFromUrl, getUser: username, onStatus: updatePill });
    const em = v.extensionManager;
    if (em.isExtensionLoaded && em.isExtensionLoaded('cloudplug')) return;
    const serviceName = em._registerInternalExtension(ext);
    em._loadedExtensions.set('cloudplug', serviceName);
    // if the blocks workspace (the editor) mounts later — e.g. "See inside" — tell it about our category again
    const reannounce = () => { const info = v.runtime._blockInfo.find((c) => c.id === 'cloudplug'); if (info) v.runtime.emit('EXTENSION_ADDED', info); };
    let hadWorkspace = !!document.querySelector('.blocklyWorkspace');
    new MutationObserver(() => { const has = !!document.querySelector('.blocklyWorkspace'); if (has && !hadWorkspace) setTimeout(reannounce, 50); hadWorkspace = has; }).observe(document.documentElement, { childList: true, subtree: true });
    makePill();
    window.CloudPlug = ext;
    console.log('[CloudPlug] blocks plugged into Scratch →', SERVER);
  }

  // 1) early: catch the VM the moment scratch-gui binds one of its methods (before the project loads)
  const origBind = Function.prototype.bind;
  Function.prototype.bind = function (...args) {
    const t = args[0];
    if (!vm && t && typeof t === 'object' && t.runtime && t.extensionManager && typeof t.loadProject === 'function') { Function.prototype.bind = origBind; try { install(t); } catch (e) { console.warn('[CloudPlug] install failed', e); } }
    return origBind.apply(this, args);
  };
  // 2) late: walk React's tree to the redux store (works when injected after the page loaded)
  function findVM() {
    const app = document.getElementById('app'); if (!app) return null;
    let fiber = null;
    for (const k of Object.keys(app)) { if (k.startsWith('__reactContainer')) fiber = app[k]; if (k.startsWith('__reactInternalInstance')) fiber = app[k]; }
    if (!fiber && app._reactRootContainer) fiber = app._reactRootContainer._internalRoot ? app._reactRootContainer._internalRoot.current : app._reactRootContainer.current;
    let n = 0; const stack = [fiber];
    while (stack.length && n++ < 5000) {
      const f = stack.pop(); if (!f) continue;
      const props = f.memoizedProps || (f.stateNode && f.stateNode.props);
      const store = props && props.store;
      if (store && typeof store.getState === 'function') { try { const s = store.getState(); if (s.scratchGui && s.scratchGui.vm) return s.scratchGui.vm; } catch {} }
      if (f.child) stack.push(f.child); if (f.sibling) stack.push(f.sibling);
    }
    return null;
  }
  const poll = setInterval(() => { if (vm) return clearInterval(poll); try { const v = findVM(); if (v) install(v); } catch {} }, 400);
  setTimeout(() => clearInterval(poll), 120000);

  // little status pill so you can see it's alive
  function makePill() {
    if (pill || !document.body) return;
    pill = document.createElement('div');
    pill.style.cssText = 'position:fixed;left:50%;transform:translateX(-50%);bottom:10px;z-index:99999;background:#4c97ff;color:#fff;font:600 12px/1 -apple-system,Segoe UI,Helvetica,Arial,sans-serif;padding:7px 10px;border-radius:999px;box-shadow:0 2px 8px rgba(0,0,0,.25);cursor:pointer;opacity:.92';
    pill.title = 'CloudPlug — click to open the dashboard';
    pill.onclick = () => window.open(SERVER, '_blank');
    document.body.appendChild(pill);
    updatePill(ext ? ext.status : 'ready');
  }
  function updatePill(s) { if (!pill) return; const icon = { connected: '🟢', connecting: '🟡', error: '🔴', disconnected: '⚪' }[s] || '🔌'; pill.textContent = `${icon} CloudPlug ${s === 'disconnected' ? 'ready' : s}`; }
})();
