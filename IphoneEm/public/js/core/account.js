// Real accounts: OS.account. The phone asks you to make one the first time, then your contacts are the
// other real accounts on this server and your texts actually travel between them.
(function () {
  const { el, esc } = OS.util;
  let me = OS.store.get('account.me', null);
  let token = OS.store.get('account.token', '');
  let people = OS.store.get('account.people', []);
  let msgs = OS.store.get('account.msgs', []);
  let seq = OS.store.get('account.seq', 0);
  let poll = 0, polling = false;

  async function api(action, body, method) {
    const opts = { method: method || (body ? 'POST' : 'GET'), headers: {} };
    if (token) opts.headers.Authorization = 'Bearer ' + token;
    if (body) { opts.headers['Content-Type'] = 'application/json'; opts.body = JSON.stringify(body); }
    const r = await fetch('/api/acct/' + action, opts);
    const j = await r.json().catch(() => ({ error: 'Network problem' }));
    if (!r.ok) { if (r.status === 401) signOut(true); throw new Error(j.error || 'Something went wrong'); }
    return j;
  }
  const save = () => { OS.store.set('account.me', me); OS.store.set('account.token', token); OS.store.set('account.people', people); OS.store.set('account.msgs', msgs); OS.store.set('account.seq', seq); };

  function person(id) { return (me && id === me.id ? me : people.find((p) => p.id === id)) || null; }
  function threads() {
    const map = new Map();
    msgs.forEach((m) => {
      const other = m.from === me.id ? m.to : m.from;
      const t = map.get(other) || { id: other, msgs: [], unread: 0 };
      t.msgs.push(m); if (m.to === me.id && !m.read) t.unread++;
      map.set(other, t);
    });
    const out = [...map.values()];
    out.forEach((t) => t.msgs.sort((a, b) => a.t - b.t));
    return out.sort((a, b) => (b.msgs[b.msgs.length - 1] || {}).t - (a.msgs[a.msgs.length - 1] || {}).t);
  }
  function badge() {
    const n = msgs.filter((m) => m.to === me.id && !m.read).length;
    OS.badge('messages', n); return n;
  }

  async function refresh(quiet) {
    if (!token || polling) return;
    polling = true;
    try {
      const r = await api('inbox?since=' + seq);
      people = r.people || people; seq = r.seq || seq;
      const fresh = (r.msgs || []).filter((m) => !msgs.some((x) => x.id === m.id));
      if (fresh.length) {
        msgs = msgs.concat(fresh).slice(-2000);
        fresh.filter((m) => m.to === me.id).forEach((m) => {
          const from = person(m.from);
          const open = OS.activeApp === 'messages' && OS.messages && OS.messages.viewing && OS.messages.viewing() === m.from && !OS.lock.locked;
          if (open) { m.read = true; OS.sound.play('received'); }
          else OS.notify({ appId: 'messages', title: from ? from.name : 'Message', body: m.text, sound: OS.sound.textTone(), onTap: () => OS.openApp('messages', { to: m.from }) });
        });
        OS.emit('account:messages');
      }
      badge(); save();
      OS.emit('account:people');
    } catch (e) { if (!quiet) console.warn('[account]', e.message); }
    polling = false;
  }
  function startPolling() { clearInterval(poll); if (token) { refresh(true); poll = setInterval(() => refresh(true), 4000); } }

  function signOut(silent) {
    const t = token;
    me = null; token = ''; people = []; msgs = []; seq = 0; clearInterval(poll);
    OS.store.set('account.me', null); OS.store.set('account.token', ''); OS.store.set('account.people', []); OS.store.set('account.msgs', []); OS.store.set('account.seq', 0);
    OS.badge('messages', 0); OS.emit('account:change');
    if (t && !silent) api('logout', {}).catch(() => {});
    setup();
  }

  const A = OS.account = {
    get me() { return me; },
    get signedIn() { return !!(me && token); },
    people: () => people.slice(),
    person, threads, badge, refresh,
    msgsWith(id) { return msgs.filter((m) => m.from === id || m.to === id).sort((a, b) => a.t - b.t); },
    async send(to, text) {
      const m = await api('send', { to, text });
      msgs = msgs.concat([m]).slice(-2000); seq = Math.max(seq, m.n || 0); save();
      OS.emit('account:messages'); return m;
    },
    async markRead(otherId) {
      let changed = false;
      msgs.forEach((m) => { if (m.from === otherId && m.to === me.id && !m.read) { m.read = true; changed = true; } });
      if (changed) { save(); badge(); api('read', { with: otherId }).catch(() => {}); OS.emit('account:messages'); }
    },
    async updateProfile(patch) { me = await api('update', patch); save(); OS.emit('account:change'); return me; },
    signOut, setup,
    avatar(p, size = 40) {
      p = p || {}; const col = p.color || '#8E8E93';
      const inner = p.emoji ? `<span style="font-size:${size * .52}px;line-height:1">${p.emoji}</span>` : esc((p.name || '?').trim()[0].toUpperCase());
      return `<span style="display:inline-flex;align-items:center;justify-content:center;flex:none;width:${size}px;height:${size}px;border-radius:50%;background:linear-gradient(180deg, color-mix(in srgb, ${col} 72%, #fff), ${col});color:#fff;font-weight:600;font-size:${size * .42}px;font-family:'SF Pro Rounded',system-ui,-apple-system,sans-serif">${inner}</span>`;
    },
  };

  // ───────── setup / sign-in screen ─────────
  OS.addStyle('account', `
    #setup{position:absolute;inset:0;z-index:88;display:none;background:var(--bg);color:var(--label);overflow:hidden}
    #setup.on{display:block}
    #setup .pane{position:absolute;inset:0;padding:calc(var(--safe-top) + 30px) 30px calc(var(--safe-bottom) + 20px);display:flex;flex-direction:column;transition:transform .45s var(--ease),opacity .3s;overflow-y:auto}
    #setup .pane.out{transform:translateX(-30%);opacity:0;pointer-events:none} #setup .pane.next{transform:translateX(100%);opacity:0;pointer-events:none}
    #setup h1{font-size:36px;font-weight:700;letter-spacing:-.5px;margin:0 0 10px}
    #setup p{font-size:15px;line-height:21px;color:var(--label2);margin:0 0 26px}
    #setup .hello{font-family:'SF Pro Rounded',system-ui,-apple-system,sans-serif;font-size:64px;font-weight:600;letter-spacing:-2px;text-align:center;margin:auto 0 14px}
    #setup .sub{text-align:center;color:var(--label2);font-size:16px;margin-bottom:auto}
    #setup label{display:block;font-size:13px;font-weight:600;color:var(--label2);margin:0 0 6px 4px;text-transform:uppercase;letter-spacing:.4px}
    #setup input{width:100%;height:52px;border:0;border-radius:14px;background:var(--cell2);padding:0 16px;font-size:17px;margin-bottom:18px}
    #setup .row{display:flex;gap:10px;align-items:center;margin-bottom:18px}
    #setup .emoji{display:flex;flex-wrap:wrap;gap:8px;margin-bottom:22px}
    #setup .emoji span{width:42px;height:42px;border-radius:50%;background:var(--cell2);display:flex;align-items:center;justify-content:center;font-size:22px;cursor:pointer}
    #setup .emoji span.on{outline:3px solid var(--tint);outline-offset:2px}
    #setup .err{color:var(--red);font-size:14px;min-height:20px;margin-bottom:6px}
    #setup .btns{margin-top:auto;display:flex;flex-direction:column;gap:10px}
    #setup .link{text-align:center;color:var(--tint);font-size:16px;cursor:pointer;padding:8px}
    #setup .who{display:flex;align-items:center;gap:12px;padding:14px;border-radius:16px;background:var(--cell2);margin-bottom:20px}
    #setup .who b{display:block;font-size:17px}#setup .who small{color:var(--label2);font-size:14px}
  `);
  const EMOJI = ['🙂', '😎', '🐱', '🐶', '🦖', '🚀', '⚽', '🎮', '🎨', '🍕', '⭐', '🔥'];
  let host = null, pick = '🙂';

  function pane(html) { const n = el(`<div class="pane next">${html}</div>`); host.appendChild(n); n.getBoundingClientRect(); requestAnimationFrame(() => n.classList.remove('next')); return n; }
  function replace(n, html) { n.classList.add('out'); setTimeout(() => n.remove(), 450); return pane(html); }

  function setup() {
    host = document.getElementById('setup');
    host.classList.add('on'); host.innerHTML = '';
    OS.keyboard.hide(true);
    hello();
  }
  function hello() {
    const n = pane(`<div class="hello">hello</div><div class="sub">Set up this iPhone to text real people</div>
      <div class="btns"><button class="ios-btn" data-a="new">Create Account</button><div class="link" data-a="in">I already have an account</div></div>`);
    n.querySelector('[data-a="new"]').addEventListener('click', () => { OS.haptic('light'); signUpPane(n); });
    n.querySelector('[data-a="in"]').addEventListener('click', () => { OS.haptic('light'); signInPane(n); });
  }
  function signUpPane(prev) {
    const n = replace(prev, `<h1>Create Account</h1><p>Your username is how friends find you. Anyone else who opens this iPhone can text you.</p>
      <label>Your name</label><input class="nm" maxlength="30" placeholder="Colton" enterkeyhint="next" autocomplete="off">
      <label>Username</label><input class="hd" maxlength="20" placeholder="colton" autocapitalize="off" autocomplete="off" enterkeyhint="next">
      <label>Passcode</label><input class="pw" type="password" placeholder="At least 4 characters" enterkeyhint="go" autocomplete="off">
      <label>Picture</label><div class="emoji">${EMOJI.map((e, i) => `<span class="${i === 0 ? 'on' : ''}">${e}</span>`).join('')}</div>
      <div class="err"></div><div class="btns"><button class="ios-btn">Create Account</button><div class="link" data-a="back">Back</div></div>`);
    pick = '🙂';
    n.querySelectorAll('.emoji span').forEach((s) => s.addEventListener('click', () => { pick = s.textContent; n.querySelectorAll('.emoji span').forEach((x) => x.classList.toggle('on', x === s)); OS.haptic('selection'); }));
    const go = async () => {
      const b = n.querySelector('button'), err = n.querySelector('.err');
      b.style.opacity = '.5'; b.style.pointerEvents = 'none'; err.textContent = '';
      try {
        const r = await api('signup', { name: n.querySelector('.nm').value, handle: n.querySelector('.hd').value, pass: n.querySelector('.pw').value, emoji: pick });
        finish(r);
      } catch (e) { err.textContent = e.message; OS.haptic('error'); b.style.opacity = ''; b.style.pointerEvents = ''; }
    };
    n.querySelector('button').addEventListener('click', go);
    n.querySelector('.pw').addEventListener('keydown', (e) => { if (e.key === 'Enter') go(); });
    n.querySelector('[data-a="back"]').addEventListener('click', () => hello(n.classList.add('out')));
    setTimeout(() => n.querySelector('.nm').focus(), 500);
  }
  function signInPane(prev) {
    const n = replace(prev, `<h1>Sign In</h1><p>Use the username and passcode you made before.</p>
      <label>Username</label><input class="hd" maxlength="20" placeholder="colton" autocapitalize="off" autocomplete="off" enterkeyhint="next">
      <label>Passcode</label><input class="pw" type="password" enterkeyhint="go" autocomplete="off">
      <div class="err"></div><div class="btns"><button class="ios-btn">Sign In</button><div class="link" data-a="back">Back</div></div>`);
    const go = async () => {
      const b = n.querySelector('button'), err = n.querySelector('.err');
      b.style.opacity = '.5'; b.style.pointerEvents = 'none'; err.textContent = '';
      try { finish(await api('login', { handle: n.querySelector('.hd').value, pass: n.querySelector('.pw').value })); }
      catch (e) { err.textContent = e.message; OS.haptic('error'); b.style.opacity = ''; b.style.pointerEvents = ''; }
    };
    n.querySelector('button').addEventListener('click', go);
    n.querySelector('.pw').addEventListener('keydown', (e) => { if (e.key === 'Enter') go(); });
    n.querySelector('[data-a="back"]').addEventListener('click', () => hello(n.classList.add('out')));
    setTimeout(() => n.querySelector('.hd').focus(), 500);
  }
  function finish(r) {
    me = r.user; token = r.token; msgs = []; seq = 0; save();
    OS.settings.set('ownerName', me.name); OS.settings.set('deviceName', me.name + '’s iPhone');
    OS.keyboard.hide(true); OS.haptic('success'); OS.sound.play('pay');
    const n = host.querySelector('.pane:not(.out)');
    replace(n, `<div style="margin:auto 0;text-align:center">${A.avatar(me, 110)}<h1 style="margin-top:22px">Welcome, ${esc(me.name.split(' ')[0])}</h1>
      <p style="text-align:center">You’re signed in as <b>@${esc(me.handle)}</b>. Anyone else with an account here can text you — and you can text them from Messages.</p></div>
      <div class="btns"><button class="ios-btn">Start Using iPhone</button></div>`)
      .querySelector('button').addEventListener('click', () => { host.classList.remove('on'); host.innerHTML = ''; OS.emit('account:change'); startPolling(); OS.lock.sleep({ silent: true }); setTimeout(() => OS.lock.wake(), 400); });
    startPolling();
  }

  OS.initAccount = function () {
    if (!document.getElementById('setup')) { const d = document.createElement('div'); d.id = 'setup'; OS.screen.appendChild(d); }
    if (A.signedIn) {
      startPolling();
      api('me').then((u) => { me = u; save(); OS.emit('account:change'); }).catch(() => {});
    } else setup();
  };
})();
