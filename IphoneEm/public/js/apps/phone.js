/* Phone + Contacts — iPhone 17 emulator built-in apps.
   Registers two apps: `phone` (Favorites / Recents / Contacts / Keypad / Voicemail + the whole call UI)
   and `contacts` (same list / card / editor UI in its own app).
   Exports OS.phone = { incomingCall(contactIdOrNumber), call(number), endCall(), active } */
(function () {
  'use strict';

  const U = OS.util;
  const esc = (s) => U.esc(s == null ? '' : String(s));
  const EASE = 'cubic-bezier(.32,.72,0,1)';
  const ME_ID = '__me';

  /* ------------------------------------------------------------------ icons */
  const HANDSET = 'M6.62 10.79c1.44 2.83 3.76 5.14 6.59 6.59l2.2-2.2c.27-.27.67-.36 1.02-.24 1.12.37 2.33.57 3.57.57.55 0 1 .45 1 1V20c0 .55-.45 1-1 1C10.61 21 3 13.39 3 4c0-.55.45-1 1-1h3.5c.55 0 1 .45 1 1 0 1.25.2 2.45.57 3.57.11.35.03.74-.25 1.02l-2.2 2.2z';
  const svg = (inner, extra) => `<svg viewBox="0 0 24 24" fill="currentColor" ${extra || ''}>${inner}</svg>`;
  const stroke = (inner, w) => `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="${w || 2}" stroke-linecap="round" stroke-linejoin="round">${inner}</svg>`;
  const I = {
    phone: svg(`<path d="${HANDSET}"/>`),
    phoneDown: svg(`<path d="${HANDSET}" transform="rotate(135 12 12)"/>`),
    star: svg('<path d="M12 2.6l2.85 6.05 6.55.85-4.8 4.55 1.22 6.55L12 17.45 6.18 20.6l1.22-6.55-4.8-4.55 6.55-.85z"/>'),
    clock: svg('<path fill-rule="evenodd" d="M12 2.5a9.5 9.5 0 110 19 9.5 9.5 0 010-19zm0 3.6a1 1 0 00-1 1V12c0 .3.13.57.35.76l3.3 2.9a1 1 0 001.32-1.5L13 11.55V7.1a1 1 0 00-1-1z"/>'),
    person: svg('<path fill-rule="evenodd" d="M12 2.5a9.5 9.5 0 110 19 9.5 9.5 0 010-19zm0 4.2a3.3 3.3 0 100 6.6 3.3 3.3 0 000-6.6zm0 8.1c-2.5 0-4.7 1.05-5.95 2.75A7.95 7.95 0 0012 20a7.95 7.95 0 005.95-2.45C16.7 15.85 14.5 14.8 12 14.8z"/>'),
    keypad: svg('<circle cx="5.5" cy="4.5" r="2"/><circle cx="12" cy="4.5" r="2"/><circle cx="18.5" cy="4.5" r="2"/><circle cx="5.5" cy="10.2" r="2"/><circle cx="12" cy="10.2" r="2"/><circle cx="18.5" cy="10.2" r="2"/><circle cx="5.5" cy="15.9" r="2"/><circle cx="12" cy="15.9" r="2"/><circle cx="18.5" cy="15.9" r="2"/><circle cx="12" cy="21.4" r="2"/>'),
    voicemail: stroke('<circle cx="6.5" cy="12" r="4.2"/><circle cx="17.5" cy="12" r="4.2"/><path d="M6.5 16.2h11"/>', 2.2),
    info: stroke('<circle cx="12" cy="12" r="9.2"/><path d="M12 11v5.5"/><circle cx="12" cy="7.6" r=".6" fill="currentColor"/>', 1.6),
    message: svg('<path d="M12 3C6.48 3 2 6.8 2 11.5c0 2.62 1.4 4.96 3.6 6.52-.2 1.2-.8 2.4-1.72 3.3 1.92-.12 3.62-.8 4.92-1.9 1.02.3 2.1.43 3.2.43 5.52 0 10-3.8 10-8.35S17.52 3 12 3z"/>'),
    video: svg('<rect x="1.5" y="6" width="14.5" height="12" rx="3.2"/><path d="M17.4 10.3l3.7-2.5c.6-.42 1.4 0 1.4.75v6.9c0 .75-.8 1.17-1.4.75l-3.7-2.5z"/>'),
    mail: svg('<path d="M4.8 5h14.4A2.8 2.8 0 0122 7.6l-10 6.1L2 7.6A2.8 2.8 0 014.8 5zM2 9.9l9.2 5.6c.5.3 1.1.3 1.6 0L22 9.9v6.3a2.8 2.8 0 01-2.8 2.8H4.8A2.8 2.8 0 012 16.2z"/>'),
    mute: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round"><rect x="9" y="2.6" width="6" height="11.4" rx="3" fill="currentColor" stroke="none"/><path d="M5.6 11.2a6.4 6.4 0 0012.8 0M12 17.8v3.4M8.8 21.2h6.4"/><path d="M4 3.5l16 17" stroke-width="2.2"/></svg>`,
    speaker: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round"><path d="M3 9.6v4.8h3.4l4.9 4.2V5.4L6.4 9.6z" fill="currentColor" stroke-linejoin="round"/><path d="M14.8 9.2a4 4 0 010 5.6M17.4 6.6a7.6 7.6 0 010 10.8M20 4.2a11 11 0 010 15.6"/></svg>`,
    plus: stroke('<path d="M12 4.5v15M4.5 12h15"/>', 2.2),
    backspace: `<svg viewBox="0 0 30 24"><path fill="currentColor" d="M11.2 2.5h13.3a4 4 0 014 4v11a4 4 0 01-4 4H11.2a4 4 0 01-3-1.36l-6.3-7.2a1.4 1.4 0 010-1.88l6.3-7.2a4 4 0 013-1.36z"/><path d="M13.6 8.2l7.6 7.6m0-7.6l-7.6 7.6" stroke="var(--bg)" stroke-width="2" stroke-linecap="round"/></svg>`,
    play: svg('<path d="M7 4.3c0-1 1.1-1.6 1.95-1.07l11.2 7.2c.8.5.8 1.64 0 2.14l-11.2 7.2A1.27 1.27 0 017 18.7z"/>'),
    pause: svg('<rect x="5.5" y="3.5" width="4.6" height="17" rx="1.4"/><rect x="13.9" y="3.5" width="4.6" height="17" rx="1.4"/>'),
    trash: stroke('<path d="M4 6.5h16M9.5 6V4.4c0-.5.4-.9.9-.9h3.2c.5 0 .9.4.9.9V6M6 6.5l.9 12.6c.06.8.7 1.4 1.5 1.4h7.2c.8 0 1.44-.6 1.5-1.4L18 6.5M10 10.5v6M14 10.5v6"/>', 1.7),
    out: `<svg viewBox="0 0 24 24" fill="currentColor"><path d="${HANDSET}" transform="translate(0 3) scale(.82)"/><path d="M14.5 3.2h6.3v6.3M20.4 3.6l-6.2 6.2" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>`,
    minus: `<svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="11" fill="var(--red)"/><path d="M6.5 12h11" stroke="#fff" stroke-width="2.4" stroke-linecap="round"/></svg>`,
    share: stroke('<path d="M12 15V3.5M7.8 7.2L12 3l4.2 4.2M7 10.5H6a2 2 0 00-2 2V19a2 2 0 002 2h12a2 2 0 002-2v-6.5a2 2 0 00-2-2h-1"/>', 1.8),
    bell: svg('<path d="M12 2.5a1.4 1.4 0 011.4 1.4v.5a6 6 0 014.6 5.85v3.6l1.7 2.7c.4.65-.05 1.5-.82 1.5H5.12c-.77 0-1.23-.85-.82-1.5L6 13.85v-3.6a6 6 0 014.6-5.85v-.5A1.4 1.4 0 0112 2.5zM9.6 19.6h4.8a2.4 2.4 0 01-4.8 0z"/>'),
    silhouette: '<svg viewBox="0 0 40 40"><circle cx="20" cy="15" r="7.2" fill="#fff"/><path d="M5.5 37c1.2-8.2 7-12.4 14.5-12.4S33.3 28.8 34.5 37z" fill="#fff"/></svg>',
  };

  /* ------------------------------------------------------------------ seed data */
  const SEED_CONTACTS = [
    { first: 'Mom', last: '', phone: '(555) 201-0142', email: 'mom@brightmail.example', color: '#FF2D55', favorite: true, notes: 'Best mom ever. Birthday: May 12.' },
    { first: 'Ava', last: 'Brightwood', phone: '(555) 314-0198', email: 'ava.brightwood@skymail.example', color: '#FF9500', favorite: true, notes: 'Best friend since 2nd grade.' },
    { first: 'Milo', last: 'Fernsby', phone: '(555) 482-0113', email: 'milo.fernsby@skymail.example', color: '#34C759', favorite: true, notes: 'Gamer tag: MiloBuilds' },
    { first: 'Grandma', last: 'Rosie', phone: '(555) 268-0121', email: 'rosie.bakes@brightmail.example', color: '#AF52DE', favorite: true, notes: 'Cookies every Sunday.' },
    { first: 'Coach', last: 'Tanaka', phone: '(555) 730-0156', email: 'coach.tanaka@riversidefc.example', color: '#00C7BE', notes: 'Riverside FC — practice Tue/Thu 4:00.' },
    { first: 'Zoe', last: 'Quillfeather', phone: '(555) 907-0165', email: 'zoe.q@skymail.example', color: '#5856D6', notes: 'Cousin. Loves horses and mystery books.' },
    { first: 'Theo', last: 'Pemberton', phone: '(555) 644-0129', email: 't.pemberton@maplegrove.example', color: '#A2845E', notes: 'Mr. Pemberton — science teacher, room 14.' },
    { first: 'Piper', last: 'Nightingale', phone: '(555) 615-0139', email: 'piper.n@skymail.example', color: '#FF3B30', notes: 'Band — plays drums.' },
    { first: 'Jasper', last: 'Holloway', phone: '(555) 552-0184', email: 'jasper.holloway@brightmail.example', color: '#FFCC00', notes: 'Next-door neighbor. Dog is named Biscuit.' },
    { first: 'Luna', last: 'Marchetti', phone: '(555) 349-0107', email: 'luna.marchetti@skymail.example', color: '#FF6482', notes: 'Art club.' },
    { first: 'Uncle', last: 'Finn', phone: '(555) 433-0190', email: 'finn.outdoors@brightmail.example', color: '#30B0C7', notes: 'Camping trips every summer.' },
    { first: 'Wren', last: 'Okafor', phone: '(555) 778-0162', email: 'frontdesk@sunnysmiles.example', color: '#64D2FF', notes: 'Dr. Okafor — Sunny Smiles Dental.' },
    { first: 'Slice Palace', last: 'Pizza', phone: '(555) 876-0100', email: 'orders@slicepalace.example', color: '#FF453A', notes: 'Large pepperoni, extra cheese.' },
  ];
  const COLORS = ['#FF3B30', '#FF9500', '#FFCC00', '#34C759', '#00C7BE', '#30B0C7', '#007AFF', '#5856D6', '#AF52DE', '#FF2D55', '#A2845E', '#8E8E93'];

  function allContacts() { try { return OS.contacts.all() || []; } catch (e) { return []; } }

  function ensureContacts() {
    try {
      if (!allContacts().length) SEED_CONTACTS.forEach((c) => OS.contacts.add(Object.assign({}, c)));
    } catch (e) { /* core not ready yet */ }
  }

  function ensureData() {
    ensureContacts();
    if (OS.store.get('phone.seeded', false)) return;
    const all = allContacts();
    if (!all.length) return;                    // try again later
    const bySeed = (i) => lookup(SEED_CONTACTS[i].phone) || all[i % all.length];
    const MIN = 60000, now = Date.now();
    const rec = (c, type, minsAgo, dur) => ({ id: U.uid(), number: c.phone || c, contactId: c.id || null, type, date: now - minsAgo * MIN, duration: dur || 0 });
    const recents = [
      rec(bySeed(2), 'outgoing', 42, 192),
      rec(bySeed(3), 'missed', 128, 0),
      rec(bySeed(0), 'incoming', 305, 431),
      rec(bySeed(13), 'outgoing', 60 * 25, 74),
      rec('(555) 019-0175', 'missed', 60 * 27, 0),
      rec(bySeed(4), 'incoming', 60 * 50, 905),
      rec(bySeed(1), 'outgoing', 60 * 75, 48),
      rec(bySeed(5), 'incoming', 60 * 98, 121),
      rec(bySeed(6), 'outgoing', 60 * 146, 388),
    ];
    const vm = (c, minsAgo, dur, text, heard) => ({ id: U.uid(), number: c.phone || c, date: now - minsAgo * MIN, duration: dur, transcript: text, heard: !!heard, deleted: false });
    const voicemail = [
      vm(bySeed(4), 190, 24, 'Hi sweetie, it\'s me. I just wanted to say the cookies are out of the oven and I saved you the big one. Call me back when you can. Love you, bye-bye!'),
      vm(bySeed(5), 60 * 29, 18, 'Hey, quick heads-up: practice is moved to four thirty on Thursday because of the field. Bring water and your cleats. See you there.'),
      vm('(555) 867-0142', 60 * 77, 15, 'Hello, this is the Maple Street Library. The book you reserved is ready for pickup at the front desk. We will hold it for seven days. Thank you!', true),
    ];
    OS.store.set('phone.recents', recents);
    OS.store.set('phone.voicemail', voicemail);
    OS.store.set('phone.unseenMissed', 1);
    OS.store.set('phone.seeded', true);
  }

  /* ------------------------------------------------------------------ helpers */
  const digits = (s) => String(s == null ? '' : s).replace(/[^\d]/g, '');
  const dialable = (s) => String(s == null ? '' : s).replace(/[^\d*#+]/g, '');

  function fmtNumber(raw) {
    const s = dialable(raw);
    if (!s) return '';
    if (/[*#]/.test(s)) return s;
    const plus = s[0] === '+';
    let d = digits(s);
    if (plus && !(d.length === 11 && d[0] === '1')) return '+' + d;
    let cc = '';
    if (d.length === 11 && d[0] === '1') { cc = (plus ? '+1 ' : '1 '); d = d.slice(1); }
    if (d.length <= 3) return cc + d;
    if (d.length <= 7) return cc + d.slice(0, 3) + '-' + d.slice(3);
    if (d.length <= 10) return cc + '(' + d.slice(0, 3) + ') ' + d.slice(3, 6) + '-' + d.slice(6);
    return (plus ? '+' : '') + digits(s);
  }

  function sameNumber(a, b) {
    let x = digits(a), y = digits(b);
    if (!x || !y) return false;
    if (x.length === 11 && x[0] === '1') x = x.slice(1);
    if (y.length === 11 && y[0] === '1') y = y.slice(1);
    return x === y;
  }

  function lookup(idOrPhone) {
    if (idOrPhone == null || idOrPhone === '') return null;
    let c = null;
    try { c = OS.contacts.find(idOrPhone) || null; } catch (e) { c = null; }
    if (c) return c;
    const all = allContacts();
    return all.find((k) => k.id === idOrPhone) || all.find((k) => sameNumber(k.phone, idOrPhone)) || null;
  }

  function cname(c) {
    if (!c) return '';
    let n = '';
    try { n = OS.contacts.name(c) || ''; } catch (e) { n = ''; }
    n = (n || [c.first, c.last].filter(Boolean).join(' ')).trim();
    return n || fmtNumber(c.phone) || c.email || 'No Name';
  }

  function avatar(c, size) {
    if (c && (c.first || c.last || c.emoji)) {
      try { return OS.contacts.avatar(c, size); } catch (e) { /* fall through */ }
    }
    return `<span class="pc-anon" style="width:${size}px;height:${size}px">${I.silhouette}</span>`;
  }

  function myCard() {
    const saved = OS.store.get('phone.myCard', null) || {};
    let owner = '';
    try { owner = OS.settings.get('ownerName') || ''; } catch (e) { owner = ''; }
    const parts = String(owner).trim().split(/\s+/);
    return Object.assign({
      id: ME_ID, first: parts[0] || 'Me', last: parts.slice(1).join(' '),
      phone: '(555) 010-2017', email: 'me@icloud.example', color: '#8E8E93', notes: '',
    }, saved, { id: ME_ID });
  }

  const pad2 = (n) => (n < 10 ? '0' : '') + n;
  function fmtDur(sec) {
    sec = Math.max(0, Math.floor(sec));
    const h = Math.floor(sec / 3600), m = Math.floor((sec % 3600) / 60), s = sec % 60;
    return h ? `${h}:${pad2(m)}:${pad2(s)}` : `${m}:${pad2(s)}`;
  }
  function durWords(sec) {
    if (sec < 60) return `${sec} second${sec === 1 ? '' : 's'}`;
    const m = Math.round(sec / 60);
    if (m < 60) return `${m} minute${m === 1 ? '' : 's'}`;
    const h = Math.floor(m / 60), r = m % 60;
    return `${h} hour${h === 1 ? '' : 's'}${r ? ` ${r} min` : ''}`;
  }
  function clockLabel(d) {
    let t = U.time(d), ap = '';
    try { ap = U.ampm(d) || ''; } catch (e) { ap = ''; }
    if (ap && !/[ap]m/i.test(t)) t += ' ' + ap;
    return t;
  }
  const dayStart = (d) => new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
  function whenLabel(ts) {
    const d = new Date(ts), diff = Math.round((dayStart(new Date()) - dayStart(d)) / 86400000);
    if (diff <= 0) return clockLabel(d);
    if (diff === 1) return 'Yesterday';
    if (diff < 7) return ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'][d.getDay()];
    return `${d.getMonth() + 1}/${d.getDate()}/${String(d.getFullYear()).slice(2)}`;
  }
  function dayLabel(ts) {
    const d = new Date(ts), diff = Math.round((dayStart(new Date()) - dayStart(d)) / 86400000);
    if (diff <= 0) return 'Today';
    if (diff === 1) return 'Yesterday';
    return d.toLocaleDateString(undefined, { weekday: 'long', month: 'long', day: 'numeric' });
  }

  function clientPt(e) {
    if (!e) return null;
    const t = (e.touches && e.touches[0]) || (e.changedTouches && e.changedTouches[0]) || e;
    return (typeof t.clientX === 'number') ? { x: t.clientX, y: t.clientY } : null;
  }
  /* fraction (0..1) of where an event sits inside an element — independent of the device's CSS scale */
  function fracIn(el, e, axis) {
    const p = clientPt(e); if (!p) return null;
    const r = el.getBoundingClientRect();
    return axis === 'y' ? (p.y - r.top) / (r.height || 1) : (p.x - r.left) / (r.width || 1);
  }

  function openSheet(opts) {
    let raw = null, closed = false;
    const api = { close() { if (closed) return; closed = true; try { raw && raw.close(); } catch (e) { /* already closed */ } } };
    const o = Object.assign({}, opts, { render(body, s) { if (!raw && s) raw = s; opts.render(body, api); } });
    const r = OS.ui.sheet(o);
    if (r) raw = r;
    return api;
  }

  function copyText(text, msg) {
    try { if (navigator.clipboard) navigator.clipboard.writeText(text).catch(() => {}); } catch (e) { /* ignore */ }
    OS.ui.toast(msg || 'Copied');
  }

  /* change bus: pages subscribe while they exist so edits show up everywhere (both apps) */
  const bus = new Map();
  const subscribe = (fn, appId) => bus.set(fn, appId);
  const unsubscribe = (fn) => bus.delete(fn);
  const unsubscribeApp = (appId) => { bus.forEach((v, k) => { if (v === appId) bus.delete(k); }); };
  function changed() { bus.forEach((v, fn) => { try { fn(); } catch (e) { /* stale page */ } }); }

  /* ------------------------------------------------------------------ stores */
  const getRecents = () => OS.store.get('phone.recents', []) || [];
  const setRecents = (v) => OS.store.set('phone.recents', v.slice(0, 200));
  const getVM = () => OS.store.get('phone.voicemail', []) || [];
  const setVM = (v) => OS.store.set('phone.voicemail', v);

  function logCall(entry) {
    const list = getRecents();
    list.unshift(Object.assign({ id: U.uid(), date: Date.now(), duration: 0 }, entry));
    setRecents(list);
  }

  function updateBadge() {
    const missed = OS.store.get('phone.unseenMissed', 0) || 0;
    const unheard = getVM().filter((v) => !v.heard && !v.deleted).length;
    try { OS.badge('phone', missed + unheard); } catch (e) { /* core not ready */ }
    if (P.root) {
      const set = (tab, n) => {
        const b = P.root.querySelector(`.ios-tab[data-tab="${tab}"] .pc-tabbadge`);
        if (b) { b.textContent = n; b.style.display = n ? '' : 'none'; }
      };
      set('recents', missed); set('voicemail', unheard);
    }
  }

  /* ------------------------------------------------------------------ CSS */
  const S = ':is(.app-phone,.app-contacts,.pc-sheet)';
  OS.addStyle('phone', `
    .app-phone .pc-pane{position:absolute;inset:0;visibility:hidden;opacity:0;pointer-events:none}
    .app-phone .pc-pane.on{visibility:visible;opacity:1;pointer-events:auto}
    .app-phone .ios-tabbar{position:absolute;left:0;right:0;bottom:0;z-index:20}
    .app-phone .ios-tab{position:relative}
    .app-phone .pc-tabbadge{position:absolute;top:2px;left:50%;margin-left:6px;min-width:18px;height:18px;padding:0 5px;box-sizing:border-box;border-radius:9px;background:var(--red);color:#fff;font:600 12px/18px system-ui,-apple-system,system-ui,sans-serif;text-align:center;font-style:normal}
    .app-contacts .pc-host{position:absolute;inset:0}

    ${S} .pc-anon{display:inline-flex;border-radius:50%;background:linear-gradient(180deg,#A5ABB8,#858A96);overflow:hidden;flex:none;vertical-align:middle}
    ${S} .pc-anon svg{width:100%;height:100%;display:block}
    ${S} .pc-empty{padding:120px 40px 0;text-align:center;color:var(--label2)}
    ${S} .pc-empty h3{font-size:22px;font-weight:700;color:var(--label);margin:0 0 6px;letter-spacing:-.4px}
    ${S} .pc-empty p{font-size:15px;line-height:20px;margin:0}

    /* plain full-width rows (favorites / recents / voicemail / contacts) */
    ${S} .pc-row{position:relative;display:flex;align-items:center;min-height:60px;padding:0 0 0 16px;background:var(--bg);cursor:pointer;transition:background-color .2s}
    ${S} .pc-row:active{background:var(--fill2)}
    ${S} .pc-row-main{flex:1;min-width:0;align-self:stretch;display:flex;align-items:center;gap:12px;padding:8px 8px 8px 0;border-bottom:.5px solid var(--sep)}
    ${S} .pc-row-text{flex:1;min-width:0}
    ${S} .pc-row-name{font-size:17px;font-weight:600;letter-spacing:-.4px;color:var(--label);white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
    ${S} .pc-row-name.missed{color:var(--red)}
    ${S} .pc-row-name em{font-style:normal;font-weight:400}
    ${S} .pc-row-sub{font-size:15px;color:var(--label2);letter-spacing:-.2px;display:flex;align-items:center;gap:4px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
    ${S} .pc-row-sub svg{width:13px;height:13px;flex:none}
    ${S} .pc-row-when{font-size:15px;color:var(--label2);flex:none;letter-spacing:-.2px}
    ${S} .pc-info{flex:none;width:44px;height:44px;border:0;background:none;color:var(--tint);padding:10px;margin-right:4px;cursor:pointer}
    ${S} .pc-info svg{width:24px;height:24px;display:block}
    ${S} .pc-gutter{flex:none;width:22px;margin-left:-6px;color:var(--label3);display:flex;align-items:center;justify-content:flex-start}
    ${S} .pc-gutter svg{width:15px;height:15px}
    ${S} .pc-minus{flex:none;width:0;overflow:hidden;opacity:0;border:0;background:none;padding:0;transition:width .3s ${EASE},opacity .3s ${EASE},margin .3s ${EASE};cursor:pointer}
    ${S} .pc-minus svg{width:22px;height:22px;display:block}
    ${S} .editing .pc-minus{width:22px;opacity:1;margin-right:12px}
    ${S} .pc-segwrap{padding:4px 16px 10px;background:var(--bg)}
    ${S} .pc-segwrap .ios-seg{width:200px;margin:0 auto}

    /* swipe to delete */
    ${S} .pc-sw{position:relative;overflow:hidden;background:var(--red);transition:height .3s ${EASE},opacity .3s ${EASE}}
    ${S} .pc-sw-del{position:absolute;top:0;right:0;bottom:0;width:84px;border:0;background:var(--red);color:#fff;font-size:16px;letter-spacing:-.3px;cursor:pointer}
    ${S} .pc-sw > .pc-row{transition:transform .32s ${EASE},background-color .2s}
    ${S} .pc-sw.dragging > .pc-row{transition:none}

    /* contacts list */
    ${S} .pc-me{display:flex;align-items:center;gap:14px;padding:10px 16px 12px;background:var(--bg);cursor:pointer;border-bottom:.5px solid var(--sep)}
    ${S} .pc-me b{display:block;font-size:20px;font-weight:600;letter-spacing:-.4px;color:var(--label)}
    ${S} .pc-me span{font-size:13px;color:var(--label2)}
    ${S} .pc-sec{padding:4px 16px;font-size:15px;font-weight:600;color:var(--label2);background:var(--bg2);letter-spacing:-.2px}
    ${S} .pc-list{background:var(--bg);min-height:100%;padding-bottom:24px}
    ${S} .pc-crow{margin-left:16px;padding:11px 30px 11px 0;font-size:17px;letter-spacing:-.4px;color:var(--label);border-bottom:.5px solid var(--sep);white-space:nowrap;overflow:hidden;text-overflow:ellipsis;cursor:pointer}
    ${S} .pc-crow:active{opacity:.5}
    ${S} .pc-crow.pick{display:flex;align-items:center;gap:12px;padding:8px 16px 8px 0}
    ${S} .pc-crow.pick small{display:block;font-size:13px;color:var(--label2);letter-spacing:0}
    ${S} .pc-count{text-align:center;color:var(--label2);font-size:17px;padding:22px 0 6px;letter-spacing:-.4px}
    ${S} .pc-index{position:absolute;right:1px;top:50%;transform:translateY(-44%);z-index:6;display:flex;flex-direction:column;align-items:center;padding:6px 3px;cursor:pointer;touch-action:none;user-select:none;-webkit-user-select:none}
    ${S} .pc-index span{font-size:11px;font-weight:600;line-height:14.5px;color:var(--tint);width:14px;text-align:center}
    ${S} .pc-bubble{position:absolute;right:34px;z-index:7;width:54px;height:54px;border-radius:50%;background:var(--fill);backdrop-filter:var(--blur);-webkit-backdrop-filter:var(--blur);color:var(--label);font-size:28px;font-weight:600;display:flex;align-items:center;justify-content:center;opacity:0;transition:opacity .2s;pointer-events:none}
    ${S} .pc-bubble.on{opacity:1}

    /* contact card */
    ${S} .pc-card-page{padding:0 16px 40px}
    ${S} .pc-hero{display:flex;flex-direction:column;align-items:center;padding:6px 0 16px;text-align:center}
    ${S} .pc-hero-name{font-size:28px;font-weight:400;letter-spacing:-.2px;color:var(--label);margin-top:10px;line-height:34px;word-break:break-word}
    ${S} .pc-hero-sub{font-size:15px;color:var(--label2);margin-top:2px}
    ${S} .pc-actions{display:grid;grid-template-columns:repeat(4,1fr);gap:8px;margin-bottom:16px}
    ${S} .pc-act{border:0;background:var(--cell);border-radius:12px;height:58px;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:4px;color:var(--tint);font-size:11px;letter-spacing:0;cursor:pointer;font-family:inherit;transition:opacity .15s}
    ${S} .pc-act svg{width:22px;height:22px}
    ${S} .pc-act:active{opacity:.5}
    ${S} .pc-act[disabled]{color:var(--label3);pointer-events:none}
    ${S} .pc-card{background:var(--cell);border-radius:12px;margin-bottom:16px;overflow:hidden}
    ${S} .pc-field{position:relative;padding:9px 16px 10px;cursor:pointer}
    ${S} .pc-field + .pc-field::before,${S} .pc-link + .pc-link::before,${S} .pc-logrow + .pc-logrow::before{content:'';position:absolute;left:16px;right:0;top:0;border-top:.5px solid var(--sep)}
    ${S} .pc-field span{display:block;font-size:14px;color:var(--label);letter-spacing:-.2px}
    ${S} .pc-field b{display:block;font-size:17px;font-weight:400;color:var(--tint);letter-spacing:-.4px;word-break:break-word}
    ${S} .pc-field p{margin:0;font-size:17px;color:var(--label);letter-spacing:-.4px;line-height:22px;white-space:pre-wrap;word-break:break-word}
    ${S} .pc-field.static{cursor:default}
    ${S} .pc-field:not(.static):active{background:var(--fill2)}
    ${S} .pc-link{position:relative;padding:11px 16px;font-size:17px;letter-spacing:-.4px;color:var(--tint);cursor:pointer}
    ${S} .pc-link.red{color:var(--red)}
    ${S} .pc-link:active{background:var(--fill2)}
    ${S} .pc-loghead{padding:10px 16px 2px;font-size:15px;font-weight:600;color:var(--label)}
    ${S} .pc-logrow{position:relative;display:flex;gap:10px;padding:7px 16px;font-size:14px;color:var(--label2)}
    ${S} .pc-logrow i{font-style:normal;width:72px;flex:none}
    ${S} .pc-logrow u{text-decoration:none;flex:1;color:var(--label)}
    ${S} .pc-logrow.missed u{color:var(--red)}

    /* editor */
    ${S} .pc-ed{padding:18px 16px 60px;background:var(--bg2);min-height:100%;box-sizing:border-box}
    ${S} .pc-ed-av{display:flex;flex-direction:column;align-items:center;gap:12px;margin-bottom:18px}
    ${S} .pc-swatches{display:flex;gap:9px;flex-wrap:wrap;justify-content:center}
    ${S} .pc-swatch{width:24px;height:24px;border-radius:50%;border:0;padding:0;cursor:pointer;box-shadow:0 0 0 0 var(--tint);transition:box-shadow .2s}
    ${S} .pc-swatch.on{box-shadow:0 0 0 2px var(--bg2),0 0 0 4px var(--tint)}
    ${S} .pc-ed .pc-card input,${S} .pc-ed .pc-card textarea{display:block;width:100%;box-sizing:border-box;border:0;outline:0;background:none;color:var(--label);font:inherit;font-size:17px;letter-spacing:-.4px;padding:11px 16px;resize:none}
    ${S} .pc-ed .pc-card input::placeholder,${S} .pc-ed .pc-card textarea::placeholder{color:var(--label3)}
    ${S} .pc-ed .pc-card > * + *{border-top:.5px solid var(--sep)}
    ${S} .pc-ed-lbl{display:flex;align-items:center}
    ${S} .pc-ed-lbl > span{flex:none;width:70px;padding-left:16px;font-size:15px;color:var(--tint)}
    ${S} .pc-ed-lbl > input{padding-left:6px !important}
    ${S} .pc-pick-search{padding:8px 16px 8px}
    ${S}.pc-sheet{background:var(--bg);min-height:100%}

    /* ---------------- keypad ---------------- */
    .app-phone .pc-kp{position:absolute;left:0;right:0;top:0;bottom:83px;background:var(--bg);display:flex;flex-direction:column;align-items:center;user-select:none;-webkit-user-select:none}
    .app-phone .pc-kp-display{margin-top:92px;height:92px;width:100%;display:flex;flex-direction:column;align-items:center;justify-content:flex-end}
    .app-phone .pc-kp-num{max-width:340px;font-size:38px;font-weight:400;letter-spacing:.3px;color:var(--label);white-space:nowrap;overflow:hidden;line-height:46px;height:46px;direction:rtl;text-overflow:ellipsis}
    .app-phone .pc-kp-num bdi{direction:ltr;unicode-bidi:isolate}
    .app-phone .pc-kp-num.sm{font-size:30px}
    .app-phone .pc-kp-num.xs{font-size:24px}
    .app-phone .pc-kp-name{height:24px;line-height:24px;font-size:16px;color:var(--label2);letter-spacing:-.3px;margin-top:2px}
    .app-phone .pc-kp-name.add{color:var(--tint);cursor:pointer}
    .app-phone .pc-kp-grid{display:grid;grid-template-columns:repeat(3,80px);gap:17px 27px;margin-top:22px}
    ${S} .pc-key{width:80px;height:80px;border-radius:50%;border:0;padding:0;background:var(--fill);color:var(--label);display:flex;flex-direction:column;align-items:center;justify-content:center;font-family:inherit;cursor:pointer;transition:background-color .4s ease-out;-webkit-tap-highlight-color:transparent}
    ${S} .pc-key.down{background:var(--label3);transition:none}
    ${S} .pc-key b{font-size:37px;font-weight:400;line-height:38px;letter-spacing:0;margin-top:-2px}
    ${S} .pc-key i{font-style:normal;font-size:10px;font-weight:700;letter-spacing:2.4px;height:13px;line-height:13px;margin-right:-2.4px}
    ${S} .pc-key.sym b{font-size:46px;line-height:80px;margin-top:0}
    ${S} .pc-key.star b{font-size:54px;line-height:80px;margin-top:16px}
    ${S} .pc-key.sym i{display:none}
    .app-phone .pc-kp-callrow{display:grid;grid-template-columns:repeat(3,80px);gap:27px;margin-top:17px;align-items:center}
    .app-phone .pc-kp-call{width:80px;height:80px;border-radius:50%;border:0;background:var(--green);color:#fff;display:flex;align-items:center;justify-content:center;cursor:pointer;transition:filter .3s,transform .3s ${EASE}}
    .app-phone .pc-kp-call:active{filter:brightness(.75);transition:none}
    .app-phone .pc-kp-call svg{width:38px;height:38px}
    .app-phone .pc-kp-bksp{width:80px;height:80px;border:0;background:none;color:var(--label3);display:flex;align-items:center;justify-content:center;cursor:pointer;opacity:0;pointer-events:none;transition:opacity .2s}
    .app-phone .pc-kp-bksp.on{opacity:1;pointer-events:auto}
    .app-phone .pc-kp-bksp:active{color:var(--label2)}
    .app-phone .pc-kp-bksp svg{width:34px;height:27px}

    /* ---------------- voicemail ---------------- */
    .app-phone .pc-vm-dot{flex:none;width:10px;height:10px;border-radius:50%;background:var(--tint);margin-left:-13px;margin-right:3px;transition:opacity .3s,transform .3s}
    .app-phone .pc-vm-dot.off{opacity:0;transform:scale(.3)}
    .app-phone .pc-vm-item{background:var(--bg)}
    .app-phone .pc-vm-player{overflow:hidden;height:0;opacity:0;transition:height .35s ${EASE},opacity .3s ${EASE};margin-left:16px;border-bottom:0 solid var(--sep)}
    .app-phone .pc-vm-item.open .pc-vm-player{opacity:1;border-bottom-width:.5px}
    .app-phone .pc-vm-item.open .pc-row-main{border-bottom-color:transparent}
    .app-phone .pc-vm-inner{padding:2px 16px 14px 0}
    .app-phone .pc-vm-track{position:relative;height:24px;cursor:pointer;touch-action:none}
    .app-phone .pc-vm-track::before{content:'';position:absolute;left:0;right:0;top:10.5px;height:3px;border-radius:2px;background:var(--fill)}
    .app-phone .pc-vm-fill{position:absolute;left:0;top:10.5px;height:3px;border-radius:2px;background:var(--label2);width:0}
    .app-phone .pc-vm-knob{position:absolute;top:8.5px;left:0;width:7px;height:7px;margin-left:-3.5px;border-radius:50%;background:var(--label);transition:transform .2s ${EASE}}
    .app-phone .pc-vm-track.drag .pc-vm-knob{transform:scale(2.4)}
    .app-phone .pc-vm-times{display:flex;justify-content:space-between;font-size:12px;color:var(--label2);font-variant-numeric:tabular-nums;margin-top:-2px}
    .app-phone .pc-vm-btns{display:flex;align-items:center;gap:10px;margin-top:8px}
    .app-phone .pc-vm-play{width:40px;height:40px;border:0;background:none;color:var(--tint);padding:7px;cursor:pointer;margin-left:-7px}
    .app-phone .pc-vm-play svg{width:26px;height:26px;display:block}
    .app-phone .pc-vm-pill{height:34px;padding:0 16px;border-radius:17px;border:0;background:var(--fill2);color:var(--tint);font:inherit;font-size:15px;letter-spacing:-.2px;cursor:pointer;display:flex;align-items:center;gap:6px;transition:background-color .2s,color .2s}
    .app-phone .pc-vm-pill svg{width:16px;height:16px}
    .app-phone .pc-vm-pill.on{background:var(--tint);color:#fff}
    .app-phone .pc-vm-pill:active{opacity:.6}
    .app-phone .pc-vm-trash{margin-left:auto;width:40px;height:40px;border:0;background:none;color:var(--red);padding:8px;cursor:pointer}
    .app-phone .pc-vm-trash svg{width:24px;height:24px;display:block}
    .app-phone .pc-vm-tr h5{margin:12px 0 3px;font-size:13px;font-weight:600;color:var(--label2);letter-spacing:-.1px}
    .app-phone .pc-vm-tr p{margin:0;font-size:15px;line-height:20px;color:var(--label);letter-spacing:-.2px}
    .app-phone .pc-vm-tr small{display:block;margin-top:6px;font-size:12px;color:var(--label3)}
    .app-phone .pc-vm-deleted{margin:24px 16px;border-radius:12px;overflow:hidden;background:var(--cell2)}

    /* ---------------- call screen (intentionally dark in both themes) ---------------- */
    .app-phone .pc-call{position:absolute;inset:0;z-index:200;color:#fff;background:#101114;overflow:hidden;opacity:0;transform:scale(1.06);transition:opacity .38s ${EASE},transform .38s ${EASE};user-select:none;-webkit-user-select:none}
    .app-phone .pc-call.in{opacity:1;transform:none}
    .app-phone .pc-call.out{opacity:0;transform:scale(.96);pointer-events:none}
    .app-phone .pc-call-bg{position:absolute;inset:-90px;filter:blur(70px);opacity:.9;animation:pc-drift 16s ease-in-out infinite alternate}
    .app-phone .pc-call-shade{position:absolute;inset:0;background:linear-gradient(180deg,rgba(0,0,0,.28) 0%,rgba(0,0,0,.42) 45%,rgba(0,0,0,.66) 100%)}
    @keyframes pc-drift{0%{transform:translate3d(0,0,0) rotate(0deg) scale(1)}100%{transform:translate3d(30px,-40px,0) rotate(14deg) scale(1.15)}}
    .app-phone .pc-call-top{position:absolute;left:24px;right:24px;top:96px;text-align:center;transition:top .35s ${EASE}}
    .app-phone .pc-call-status{font-size:18px;color:rgba(255,255,255,.62);letter-spacing:-.3px;height:24px;line-height:24px;font-variant-numeric:tabular-nums}
    .app-phone .pc-call-name{font-size:34px;font-weight:600;letter-spacing:-.2px;line-height:40px;margin-top:2px;overflow:hidden;text-overflow:ellipsis;display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical}
    .app-phone .pc-call-name.long{font-size:26px;line-height:32px}
    .app-phone .pc-call-dtmf{font-size:32px;letter-spacing:1px;height:40px;line-height:40px;white-space:nowrap;overflow:hidden;direction:rtl;display:none}
    .app-phone .pc-call-avatar{position:absolute;left:0;right:0;top:214px;display:flex;justify-content:center;transition:opacity .3s,transform .35s ${EASE}}
    .app-phone .pc-call-avatar > *{box-shadow:0 12px 40px rgba(0,0,0,.35)}
    .app-phone .pc-call-avatar::before{content:'';position:absolute;left:50%;top:50%;width:132px;height:132px;margin:-66px 0 0 -66px;border-radius:50%;border:1.5px solid rgba(255,255,255,.35);opacity:0}
    .app-phone .pc-call[data-state="ringing"] .pc-call-avatar::before,.app-phone .pc-call[data-state="incoming"] .pc-call-avatar::before{animation:pc-ping 1.9s ease-out infinite}
    @keyframes pc-ping{0%{opacity:.7;transform:scale(.92)}100%{opacity:0;transform:scale(1.55)}}
    .app-phone .pc-call-grid{position:absolute;left:0;right:0;bottom:214px;display:grid;grid-template-columns:repeat(3,78px);justify-content:center;gap:20px 32px;transition:opacity .3s,transform .35s ${EASE}}
    .app-phone .pc-cbtn{border:0;background:none;padding:0;color:#fff;font:inherit;display:flex;flex-direction:column;align-items:center;gap:7px;cursor:pointer;transition:opacity .25s}
    .app-phone .pc-cbtn > span{width:78px;height:78px;border-radius:50%;background:rgba(255,255,255,.16);backdrop-filter:blur(20px);-webkit-backdrop-filter:blur(20px);display:flex;align-items:center;justify-content:center;transition:background-color .25s,color .25s,transform .25s ${EASE}}
    .app-phone .pc-cbtn > span svg{width:34px;height:34px}
    .app-phone .pc-cbtn:active > span{transform:scale(.92);background:rgba(255,255,255,.32)}
    .app-phone .pc-cbtn.on > span{background:#fff;color:#111}
    .app-phone .pc-cbtn > em{font-style:normal;font-size:13px;letter-spacing:-.1px;color:rgba(255,255,255,.92)}
    .app-phone .pc-cbtn.dim{opacity:.32;pointer-events:none}
    .app-phone .pc-call-pad{position:absolute;left:0;right:0;bottom:214px;display:grid;grid-template-columns:repeat(3,78px);justify-content:center;gap:14px 28px;opacity:0;pointer-events:none;transform:translateY(16px);transition:opacity .3s,transform .35s ${EASE}}
    .app-phone .pc-call-pad .pc-key{width:78px;height:78px;background:rgba(255,255,255,.16);color:#fff;backdrop-filter:blur(20px);-webkit-backdrop-filter:blur(20px)}
    .app-phone .pc-call-pad .pc-key.down{background:rgba(255,255,255,.5)}
    .app-phone .pc-call-pad .pc-key.star b{margin-top:16px}
    .app-phone .pc-call-bottom{position:absolute;left:0;right:0;bottom:84px;display:grid;grid-template-columns:repeat(3,78px);justify-content:center;gap:32px;align-items:center}
    .app-phone .pc-call-end > span,.app-phone .pc-call-decline > span{background:#FF3B30 !important}
    .app-phone .pc-call-accept > span{background:#30D158 !important;animation:pc-accept 1.6s ease-in-out infinite}
    @keyframes pc-accept{0%,100%{box-shadow:0 0 0 0 rgba(48,209,88,.55)}60%{box-shadow:0 0 0 16px rgba(48,209,88,0)}}
    .app-phone .pc-call-end > span svg,.app-phone .pc-call-decline > span svg,.app-phone .pc-call-accept > span svg{width:40px;height:40px}
    .app-phone .pc-call-hide{border:0;background:none;color:#fff;font:inherit;font-size:17px;letter-spacing:-.4px;cursor:pointer;opacity:0;pointer-events:none;transition:opacity .25s}
    .app-phone .pc-call-in{position:absolute;left:0;right:0;bottom:84px;display:none;grid-template-columns:repeat(2,78px);justify-content:center;gap:34px 118px}
    .app-phone .pc-call-in .pc-mini > span{width:44px;height:44px;background:none;backdrop-filter:none;-webkit-backdrop-filter:none}
    .app-phone .pc-call-in .pc-mini > span svg{width:26px;height:26px}
    .app-phone .pc-call-in .pc-mini{gap:0}
    /* states */
    .app-phone .pc-call[data-state="incoming"] .pc-call-grid,.app-phone .pc-call[data-state="incoming"] .pc-call-bottom{display:none}
    .app-phone .pc-call[data-state="incoming"] .pc-call-in{display:grid}
    .app-phone .pc-call[data-pad="1"] .pc-call-grid{opacity:0;pointer-events:none;transform:translateY(-16px)}
    .app-phone .pc-call[data-pad="1"] .pc-call-avatar{opacity:0;transform:scale(.8)}
    .app-phone .pc-call[data-pad="1"] .pc-call-pad{opacity:1;pointer-events:auto;transform:none}
    .app-phone .pc-call[data-pad="1"] .pc-call-hide{opacity:1;pointer-events:auto}
    .app-phone .pc-call[data-pad="1"] .pc-call-top{top:74px}
    .app-phone .pc-call[data-pad="1"][data-dtmf="1"] .pc-call-dtmf{display:block}
    .app-phone .pc-call[data-pad="1"][data-dtmf="1"] .pc-call-name{display:none}
    .app-phone .pc-call[data-state="ended"] .pc-call-grid,.app-phone .pc-call[data-state="ended"] .pc-call-bottom,.app-phone .pc-call[data-state="ended"] .pc-call-pad,.app-phone .pc-call[data-state="ended"] .pc-call-in{opacity:.3;pointer-events:none}
  `);

  /* ------------------------------------------------------------------ swipe-to-delete helper */
  let openSwipeRow = null;
  function closeSwipe() { if (openSwipeRow) { openSwipeRow.firstElementChild.style.transform = ''; openSwipeRow = null; } }
  function makeSwipe(rowEl, onDelete) {
    const wrap = U.el('<div class="pc-sw"></div>');
    const del = U.el('<button class="pc-sw-del">Delete</button>');
    wrap.appendChild(rowEl); wrap.appendChild(del);
    let mode = null, base = 0, x = 0;
    const W = 84;
    const remove = () => {
      if (openSwipeRow === wrap) openSwipeRow = null;
      rowEl.style.transform = 'translateX(-100%)';
      wrap.style.height = wrap.offsetHeight + 'px';
      requestAnimationFrame(() => { wrap.style.height = '0px'; wrap.style.opacity = '0'; });
      setTimeout(onDelete, 300);
    };
    del.addEventListener('click', (e) => { e.stopPropagation(); remove(); });
    U.drag(rowEl, {
      onStart() { mode = null; base = (openSwipeRow === wrap) ? -W : 0; x = base; },
      onMove(p) {
        if (mode === null) {
          if (Math.abs(p.dx) < 8 && Math.abs(p.dy) < 8) return;
          mode = Math.abs(p.dx) > Math.abs(p.dy) * 1.4 ? 'h' : 'v';
          if (mode === 'h') { if (openSwipeRow && openSwipeRow !== wrap) closeSwipe(); wrap.classList.add('dragging'); }
        }
        if (mode !== 'h') return;
        x = Math.min(0, base + p.dx);
        if (x < -W) x = -W + (x + W) * 0.85;
        rowEl.style.transform = `translateX(${x}px)`;
        wrap._swiped = true;
      },
      onEnd(p) {
        wrap.classList.remove('dragging');
        if (mode !== 'h') return;
        setTimeout(() => { wrap._swiped = false; }, 60);
        if (x < -230 || (p && p.vx < -1.4 && x < -120)) { remove(); return; }
        if (x < -W / 2) { rowEl.style.transform = `translateX(${-W}px)`; openSwipeRow = wrap; }
        else { rowEl.style.transform = ''; if (openSwipeRow === wrap) openSwipeRow = null; }
      },
    });
    return wrap;
  }

  /* ==================================================================
     Shared Contacts UI (list, card, editor, picker)
     ================================================================== */
  const sortKey = (c) => ((c.last || c.first || '') + ' ' + (c.last ? (c.first || '') : '')).trim().toLowerCase();
  const sectionOf = (c) => { const ch = (sortKey(c)[0] || '#').toUpperCase(); return /[A-Z]/.test(ch) ? ch : '#'; };
  function sortedContacts() {
    return allContacts().slice().sort((a, b) => sortKey(a).localeCompare(sortKey(b)));
  }
  function nameHTML(c) {
    if (c.last && c.first) return `${esc(c.first)} <b>${esc(c.last)}</b>`;
    return `<b>${esc(cname(c))}</b>`;
  }
  function matches(c, q) {
    if (!q) return true;
    q = q.trim().toLowerCase();
    if (!q) return true;
    const qd = digits(q);
    return cname(c).toLowerCase().includes(q) || (c.email || '').toLowerCase().includes(q) || (qd.length > 1 && digits(c.phone).includes(qd));
  }

  function dial(number) {
    if (!dialable(number)) { OS.ui.toast('No phone number'); return; }
    if (P.ctx && P.ctx.isActive()) startCall(number);
    else OS.openApp('phone', { number });
  }

  function pushContactList(nav, appId) {
    let q = '', bodyEl = null, pageEl = null, strip = null, bubble = null, bubbleT = 0;
    const redraw = () => draw();

    function scrollToLetter(letter) {
      if (!bodyEl) return;
      const secs = Array.from(bodyEl.querySelectorAll('.pc-sec'));
      if (!secs.length) return;
      let target = secs.find((s) => s.dataset.l === letter);
      if (!target) {
        const order = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ#';
        target = secs.find((s) => order.indexOf(s.dataset.l) >= order.indexOf(letter)) || secs[secs.length - 1];
      }
      const br = bodyEl.getBoundingClientRect(), tr = target.getBoundingClientRect();
      const scale = (br.height / (bodyEl.offsetHeight || 1)) || 1;
      const padTop = parseFloat(getComputedStyle(bodyEl).paddingTop) || 0;
      bodyEl.scrollTop += (tr.top - br.top) / scale - padTop;
      if (bubble) {
        bubble.textContent = letter; bubble.classList.add('on');
        clearTimeout(bubbleT); bubbleT = setTimeout(() => bubble && bubble.classList.remove('on'), 500);
      }
    }

    function buildStrip() {
      if (!pageEl || strip) return;
      const letters = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ#'.split('');
      strip = U.el(`<div class="pc-index">${letters.map((l) => `<span>${l}</span>`).join('')}</div>`);
      bubble = U.el('<div class="pc-bubble"></div>');
      pageEl.appendChild(strip); pageEl.appendChild(bubble);
      let last = '', f0 = 0;
      const at = (f) => {
        const i = U.clamp(Math.floor(f * letters.length), 0, letters.length - 1);
        if (bubble) bubble.style.top = (strip.offsetTop - strip.offsetHeight * 0.44 + (i + 0.5) * (strip.offsetHeight / letters.length) - 27) + 'px';
        if (letters[i] !== last) { last = letters[i]; try { OS.haptic('selection'); } catch (e) { /* no haptics */ } scrollToLetter(last); }
      };
      U.drag(strip, {
        onStart(p, e) { last = ''; const f = fracIn(strip, e, 'y'); f0 = f == null ? 0 : f; at(f0); },
        onMove(p) { at(f0 + p.dy / (strip.offsetHeight || 1)); },
        onEnd() { last = ''; },
      });
    }

    function draw() {
      if (!bodyEl) return;
      const me = myCard();
      const list = sortedContacts().filter((c) => matches(c, q));
      let html = '<div class="pc-list">';
      if (!q) {
        html += `<div class="pc-me" data-me="1">${avatar(me, 60)}<div><b>${esc(cname(me))}</b><span>My Card</span></div></div>`;
      }
      if (!list.length) {
        html += q ? `<div class="pc-empty"><h3>No Results</h3><p>for “${esc(q)}”</p></div>`
                  : '<div class="pc-empty"><h3>No Contacts</h3><p>Tap + to add someone.</p></div>';
      }
      let sec = '';
      list.forEach((c) => {
        const s = sectionOf(c);
        if (s !== sec) { sec = s; html += `<div class="pc-sec" data-l="${s}">${s}</div>`; }
        html += `<div class="pc-crow" data-id="${esc(c.id)}">${nameHTML(c)}</div>`;
      });
      if (list.length && !q) html += `<div class="pc-count">${list.length} Contacts</div>`;
      html += '</div>';
      bodyEl.innerHTML = html;
      if (strip) strip.style.display = q ? 'none' : '';
    }

    nav.push({
      title: 'Contacts', largeTitle: true, background: 'var(--bg)',
      right: [{ icon: I.plus, label: 'Add', onTap() { openEditor(null, {}, (c) => { if (c) pushDetail(nav, { id: c.id }, appId); }); } }],
      search: { placeholder: 'Search', onInput(t) { q = t || ''; draw(); } },
      render(body, page) {
        bodyEl = body; pageEl = (page && page.el) || null;
        body.addEventListener('click', (e) => {
          const row = e.target.closest('.pc-crow');
          if (row) { pushDetail(nav, { id: row.dataset.id }, appId); return; }
          if (e.target.closest('.pc-me')) pushDetail(nav, { me: true }, appId);
        });
        draw(); buildStrip();
      },
      onShow() { subscribe(redraw, appId); draw(); },
      onHide() { unsubscribe(redraw); },
    });
  }

  function pushDetail(nav, ref, appId, opts) {
    opts = opts || {};
    let bodyEl = null, pageRef = null, gone = false;
    const get = () => (ref.me ? myCard() : ref.id ? lookup(ref.id) : null);
    const redraw = () => draw();

    function draw() {
      if (!bodyEl || gone) return;
      const c = get();
      if (ref.id && !c) { gone = true; unsubscribe(redraw); try { nav.pop(); } catch (e) { /* not top */ } return; }
      const number = c ? c.phone : ref.number;
      const email = c ? c.email : '';
      const title = c ? cname(c) : fmtNumber(number);
      let html = '<div class="pc-card-page">';
      html += `<div class="pc-hero">${avatar(c, 104)}<div class="pc-hero-name">${esc(title)}</div>${ref.me ? '<div class="pc-hero-sub">My Card</div>' : (!c ? '<div class="pc-hero-sub">Unknown caller</div>' : '')}</div>`;
      html += `<div class="pc-actions">
        <button class="pc-act" data-a="message" ${number ? '' : 'disabled'}>${I.message}<span>message</span></button>
        <button class="pc-act" data-a="call" ${number ? '' : 'disabled'}>${I.phone}<span>call</span></button>
        <button class="pc-act" data-a="video" ${number || email ? '' : 'disabled'}>${I.video}<span>video</span></button>
        <button class="pc-act" data-a="mail" ${email ? '' : 'disabled'}>${I.mail}<span>mail</span></button>
      </div>`;
      if (opts.showLog && number) {
        const log = getRecents().filter((r) => sameNumber(r.number, number)).slice(0, 4);
        if (log.length) {
          html += `<div class="pc-card"><div class="pc-loghead">${esc(dayLabel(log[0].date))}</div>`;
          log.forEach((r) => {
            const kind = r.type === 'missed' ? 'Missed Call' : r.type === 'incoming' ? 'Incoming Call' : (r.duration ? 'Outgoing Call' : 'Canceled Call');
            html += `<div class="pc-logrow ${r.type === 'missed' ? 'missed' : ''}"><i>${esc(clockLabel(new Date(r.date)))}</i><u>${kind}</u><span>${r.duration ? esc(durWords(r.duration)) : ''}</span></div>`;
          });
          html += '</div>';
        }
      }
      if (number || email) {
        html += '<div class="pc-card">';
        if (number) html += `<div class="pc-field" data-a="call"><span>mobile</span><b>${esc(fmtNumber(number) || number)}</b></div>`;
        if (number) html += `<div class="pc-field" data-a="video"><span>FaceTime</span><b>${esc(fmtNumber(number) || number)}</b></div>`;
        if (email) html += `<div class="pc-field" data-a="mail"><span>email</span><b>${esc(email)}</b></div>`;
        html += '</div>';
      }
      if (c && c.notes) html += `<div class="pc-card"><div class="pc-field static"><span>Notes</span><p>${esc(c.notes)}</p></div></div>`;
      html += '<div class="pc-card">';
      if (number) html += '<div class="pc-link" data-a="message">Send Message</div>';
      html += '<div class="pc-link" data-a="share">Share Contact</div>';
      if (c && !ref.me) html += `<div class="pc-link" data-a="fav">${c.favorite ? 'Remove from Favorites' : 'Add to Favorites'}</div>`;
      if (!c) html += '<div class="pc-link" data-a="create">Create New Contact</div><div class="pc-link" data-a="addto">Add to Existing Contact</div>';
      html += '</div>';
      if (c && !ref.me) html += '<div class="pc-card"><div class="pc-link red" data-a="delete">Delete Contact</div></div>';
      html += '</div>';
      bodyEl.innerHTML = html;
      if (pageRef && pageRef.setRight) {
        pageRef.setRight(c ? [{ label: 'Edit', onTap() { openEditor(get(), {}, () => {}); } }] : []);
      }
    }

    function act(a) {
      const c = get();
      const number = c ? c.phone : ref.number;
      const to = c && !ref.me ? c.id : number;
      if (a === 'message') OS.openApp('messages', { to });
      else if (a === 'call') dial(number);
      else if (a === 'video') OS.openApp('facetime', { to: to || (c && c.email) });
      else if (a === 'mail' && c && c.email) OS.openURL('mailto:' + c.email);
      else if (a === 'share') {
        copyText([cname(c) || fmtNumber(number), number ? fmtNumber(number) : '', c && c.email ? c.email : ''].filter(Boolean).join('\n'), 'Contact Copied');
      } else if (a === 'fav' && c) {
        OS.contacts.update(c.id, { favorite: !c.favorite });
        try { OS.haptic('success'); } catch (e) { /* no haptics */ }
        OS.ui.toast(c.favorite ? 'Removed from Favorites' : 'Added to Favorites');
        changed();
      } else if (a === 'create') {
        openEditor(null, { phone: fmtNumber(number) }, (nc) => { if (nc) { ref = { id: nc.id }; draw(); if (pageRef && pageRef.setTitle) pageRef.setTitle(''); } });
      } else if (a === 'addto') {
        pickContact({ title: 'Add to Contact', onPick(k) { OS.contacts.update(k.id, { phone: fmtNumber(number) }); ref = { id: k.id }; changed(); draw(); OS.ui.toast('Number Added'); } });
      } else if (a === 'delete' && c) {
        OS.ui.actionSheet({ buttons: [{ label: 'Delete Contact', style: 'destructive' }], cancel: 'Cancel' }).then((i) => {
          if (i !== 0) return;
          gone = true; unsubscribe(redraw);
          OS.contacts.remove(c.id);
          try { nav.pop(); } catch (e) { /* ignore */ }
          changed();
        });
      }
    }

    nav.push({
      title: '', background: 'var(--bg2)',
      back: opts.back,
      render(body, page) {
        bodyEl = body; pageRef = page || null;
        body.addEventListener('click', (e) => { const t = e.target.closest('[data-a]'); if (t && !t.disabled) act(t.dataset.a); });
        draw();
      },
      onShow(page) { if (page && !pageRef) pageRef = page; if (!gone) { subscribe(redraw, appId); draw(); } },
      onHide() { unsubscribe(redraw); },
    });
  }

  function openEditor(contact, preset, onSaved) {
    const isNew = !contact, isMe = !!contact && contact.id === ME_ID;
    const d = Object.assign({ first: '', last: '', phone: '', email: '', notes: '', color: COLORS[Math.floor(Math.random() * COLORS.length)] }, preset || {}, contact || {});
    let root = null;
    const val = (n) => (root ? (root.querySelector(`[name="${n}"]`).value || '').trim() : '');
    const sheet = openSheet({
      title: isNew ? 'New Contact' : isMe ? 'My Card' : 'Edit Contact', height: 'large',
      left: { label: 'Cancel', onTap() { sheet.close(); } },
      right: { label: 'Done', bold: true, onTap() { save(); } },
      render(body) {
        body.innerHTML = `<div class="pc-sheet"><div class="pc-ed">
          <div class="pc-ed-av"><div class="pc-ed-avatar"></div><div class="pc-swatches">${COLORS.map((c) => `<button class="pc-swatch${c.toLowerCase() === String(d.color).toLowerCase() ? ' on' : ''}" data-c="${c}" style="background:${c}"></button>`).join('')}</div></div>
          <div class="pc-card">
            <input name="first" placeholder="First name" autocapitalize="words" enterkeyhint="next" value="${esc(d.first)}">
            <input name="last" placeholder="Last name" autocapitalize="words" enterkeyhint="next" value="${esc(d.last)}">
          </div>
          <div class="pc-card"><label class="pc-ed-lbl"><span>mobile</span><input name="phone" placeholder="Phone" inputmode="tel" enterkeyhint="next" value="${esc(d.phone)}"></label></div>
          <div class="pc-card"><label class="pc-ed-lbl"><span>email</span><input name="email" placeholder="Email" inputmode="email" autocapitalize="off" enterkeyhint="next" value="${esc(d.email)}"></label></div>
          <div class="pc-card"><textarea name="notes" rows="4" placeholder="Notes">${esc(d.notes)}</textarea></div>
        </div></div>`;
        root = body.querySelector('.pc-ed');
        const av = root.querySelector('.pc-ed-avatar');
        const paint = () => { av.innerHTML = avatar({ first: val('first'), last: val('last'), color: d.color, emoji: d.emoji }, 96); };
        paint();
        root.addEventListener('input', (e) => { if (e.target.name === 'first' || e.target.name === 'last') paint(); });
        root.addEventListener('click', (e) => {
          const sw = e.target.closest('.pc-swatch'); if (!sw) return;
          d.color = sw.dataset.c;
          root.querySelectorAll('.pc-swatch').forEach((x) => x.classList.toggle('on', x === sw));
          paint();
        });
        const ph = root.querySelector('[name="phone"]');
        ph.addEventListener('change', () => { const f = fmtNumber(ph.value); if (f && digits(ph.value).length >= 7) ph.value = f; });
      },
    });

    function save() {
      const data = { first: val('first'), last: val('last'), phone: val('phone'), email: val('email'), notes: val('notes'), color: d.color };
      if (digits(data.phone).length >= 7) data.phone = fmtNumber(data.phone) || data.phone;
      if (!data.first && !data.last && !data.phone && !data.email) {
        OS.ui.alert({ title: 'Nothing to Save', message: 'Enter a name, phone number or email first.', buttons: [{ label: 'OK' }] });
        return;
      }
      if (document.activeElement && document.activeElement.blur) document.activeElement.blur();
      let result = null;
      if (isMe) { OS.store.set('phone.myCard', data); result = myCard(); }
      else if (isNew) {
        const before = new Set(allContacts().map((c) => c.id));
        const r = OS.contacts.add(Object.assign({ favorite: false }, data));
        result = (r && r.id) ? r : allContacts().find((c) => !before.has(c.id)) || null;
      } else { OS.contacts.update(contact.id, data); result = lookup(contact.id); }
      sheet.close();
      changed();
      if (onSaved) onSaved(result);
    }
  }

  function pickContact(o) {
    const sheet = openSheet({
      title: o.title || 'Contacts', height: 'large',
      left: { label: 'Cancel', onTap() { sheet.close(); } },
      render(body) {
        body.innerHTML = `<div class="pc-sheet"><div class="pc-pick-search"><div class="ios-search"><input placeholder="Search" enterkeyhint="search" autocapitalize="off"></div></div><div class="pc-pick-list"></div></div>`;
        const listEl = body.querySelector('.pc-pick-list');
        const paint = (q) => {
          const list = sortedContacts().filter((c) => matches(c, q) && (!o.filter || o.filter(c)));
          listEl.innerHTML = list.length ? list.map((c) => `<div class="pc-crow pick" data-id="${esc(c.id)}">${avatar(c, 38)}<div>${nameHTML(c)}<small>${esc(fmtNumber(c.phone) || c.email || '')}</small></div></div>`).join('')
            : '<div class="pc-empty" style="padding-top:60px"><h3>No Results</h3></div>';
        };
        paint('');
        body.querySelector('input').addEventListener('input', (e) => paint(e.target.value));
        listEl.addEventListener('click', (e) => {
          const row = e.target.closest('.pc-crow'); if (!row) return;
          const c = lookup(row.dataset.id);
          if (document.activeElement && document.activeElement.blur) document.activeElement.blur();
          sheet.close();
          if (c) o.onPick(c);
        });
      },
    });
    return sheet;
  }

  /* ==================================================================
     Phone app
     ================================================================== */
  const P = { ctx: null, root: null, navs: {}, tab: 'keypad', draw: {}, number: '', keyHandler: null, vmTimer: 0, vmStop: null };

  /* ---------------- call engine (module level: a call can start before the app has ever been opened) */
  let call = null;          // { number, contactId, name, color, dir, state, connectedAt, muted, speaker, pad, dtmf, others[] }
  let callEl = null;
  const callSnd = {};
  const callT = { a: 0, tick: 0, end: 0, party: 0 };

  function stopSnd(k) { if (callSnd[k]) { try { callSnd[k].stop(); } catch (e) { /* already stopped */ } callSnd[k] = null; } }
  function playSnd(k, id, opts) { stopSnd(k); try { callSnd[k] = OS.sound.play(id, opts) || null; } catch (e) { callSnd[k] = null; } }
  const elapsed = () => (call && call.connectedAt ? (Date.now() - call.connectedAt) / 1000 : 0);
  const callTitle = () => (call ? [call.name].concat(call.others.map((o) => o.name)).join(' & ') : '');

  function statusText() {
    if (!call) return '';
    switch (call.state) {
      case 'ringing': return 'calling mobile…';
      case 'incoming': return call.contactId ? 'mobile' : 'incoming call';
      case 'busy': return 'busy';
      case 'failed': return 'call failed';
      case 'ended': return 'call ended';
      default: return call.partyRinging ? `calling ${call.partyRinging}…` : fmtDur(elapsed());
    }
  }

  function newCall(number, dir) {
    const c = lookup(number);
    return {
      number: c ? (c.phone || String(number)) : String(number), contactId: c ? c.id : null,
      name: c ? cname(c) : (fmtNumber(number) || String(number)), color: (c && c.color) || '#5E6A7D', contact: c,
      dir, state: dir === 'incoming' ? 'incoming' : 'ringing', connectedAt: 0, answered: false,
      muted: false, speaker: false, pad: false, dtmf: '', others: [], partyRinging: '',
    };
  }

  function startCall(number) {
    number = dialable(number);
    if (!number) return false;
    if (call) { OS.ui.toast('Already on a call'); return false; }
    const d = digits(number);
    if (['911', '112', '999', '000'].includes(d)) {
      OS.ui.alert({ title: 'Emergency Calls Unavailable', message: 'This iPhone is an emulator and can\'t place real calls. In a real emergency, use a real phone.', buttons: [{ label: 'OK' }] });
      return false;
    }
    call = newCall(number, 'outgoing');
    OS.store.set('phone.lastDialed', number);
    mountCall();
    const fails = d.length < 3 || /[*#]/.test(number);
    const busy = !fails && !call.contactId && /[05]$/.test(d);
    playSnd('ring', 'ringback', { loop: true, category: 'media' });
    callT.a = setTimeout(() => {
      if (!call) return;
      if (fails) { call.state = 'failed'; stopSnd('ring'); renderCall(); callT.a = setTimeout(() => endCall(), 1600); }
      else if (busy) goBusy();
      else connectCall();
    }, fails ? 1800 : busy ? 2400 : 3200 + Math.random() * 3400);
    return true;
  }

  function goBusy() {
    if (!call) return;
    stopSnd('ring');
    call.state = 'busy';
    playSnd('busy', 'busy', { loop: true, category: 'media' });
    renderCall(); syncIsland();
    callT.a = setTimeout(() => endCall(), 4800);
  }

  function connectCall() {
    if (!call) return;
    clearTimeout(callT.a);
    stopSnd('ring');
    call.state = 'connected'; call.answered = true; call.connectedAt = Date.now();
    try { OS.haptic('medium'); } catch (e) { /* no haptics */ }
    clearInterval(callT.tick);
    callT.tick = setInterval(() => { renderCallStatus(); syncIsland(); }, 500);
    renderCall(); syncIsland();
  }

  function incomingCall(who) {
    if (call) return false;
    ensureContacts();
    const c = lookup(who);
    if (!c && !dialable(who)) return false;
    call = newCall(c ? (c.phone || who) : who, 'incoming');
    if (c) { call.contactId = c.id; call.name = cname(c); call.contact = c; call.color = c.color || call.color; }
    let tone = 'ringtone:Reflection';
    try { tone = OS.sound.ringtone() || tone; } catch (e) { /* default */ }
    playSnd('ring', tone, { loop: true, category: 'ringer' });
    try { OS.haptic('heavy'); } catch (e) { /* no haptics */ }
    callT.a = setTimeout(() => missCall(false), 30000);
    if (P.ctx) mountCall();
    if (!P.ctx || !P.ctx.isActive()) { try { OS.openApp('phone', { incoming: who }); } catch (e) { /* stays a background ring */ } }
    return true;
  }

  function acceptCall() {
    if (!call || call.state !== 'incoming') return;
    connectCall();
  }

  function missCall(declined) {
    if (!call || call.state !== 'incoming') return;
    clearTimeout(callT.a);
    stopSnd('ring');
    const c = call;
    logCall({ number: c.number, contactId: c.contactId, type: 'missed' });
    OS.store.set('phone.unseenMissed', (OS.store.get('phone.unseenMissed', 0) || 0) + 1);
    try {
      OS.notify({ appId: 'phone', title: c.name, body: 'Missed Call', sound: false, onTap() { OS.openApp('phone', { tab: 'recents' }); } });
    } catch (e) { /* notifications unavailable */ }
    finishCall(declined ? 250 : 600);
  }

  function endCall() {
    if (!call || call.state === 'ended') return;
    if (call.state === 'incoming') { missCall(true); return; }
    clearTimeout(callT.a); clearTimeout(callT.party);
    stopSnd('ring'); stopSnd('busy');
    const dur = Math.round(elapsed());
    logCall({ number: call.number, contactId: call.contactId, type: call.dir === 'incoming' ? 'incoming' : 'outgoing', duration: dur });
    playSnd('end', 'endcall', { category: 'media' });
    finishCall(1200);
  }

  function finishCall(delay) {
    clearInterval(callT.tick); callT.tick = 0;
    if (call) { call.finalTime = fmtDur(elapsed()); call.state = 'ended'; call.pad = false; }
    renderCall();
    try { OS.island.end('phone-call'); } catch (e) { /* none */ }
    islandOn = false;
    updateBadge();
    clearTimeout(callT.end);
    callT.end = setTimeout(teardownCall, delay);
  }

  function teardownCall() {
    clearTimeout(callT.end); clearTimeout(callT.a); clearTimeout(callT.party); clearInterval(callT.tick);
    stopSnd('ring'); stopSnd('busy');
    call = null;
    const el = callEl; callEl = null;
    if (el) { el.classList.add('out'); setTimeout(() => el.remove(), 400); }
    if (P.ctx) { try { P.ctx.setStatusBar('auto'); } catch (e) { /* ignore */ } }
    if (P.draw.recents) P.draw.recents();
    updateBadge();
  }

  function addParty(c) {
    if (!call || call.state !== 'connected') return;
    if (c.id === call.contactId || call.others.some((o) => o.id === c.id)) { OS.ui.toast('Already on this call'); return; }
    if (call.others.length >= 4) { OS.ui.toast('Conference is full'); return; }
    call.partyRinging = cname(c);
    playSnd('ring', 'ringback', { loop: true, category: 'media' });
    renderCall();
    clearTimeout(callT.party);
    callT.party = setTimeout(() => {
      if (!call || call.state !== 'connected') return;
      stopSnd('ring');
      call.partyRinging = '';
      call.others.push({ id: c.id, name: cname(c) });
      logCall({ number: c.phone, contactId: c.id, type: 'outgoing', duration: 0 });
      try { OS.haptic('light'); } catch (e) { /* no haptics */ }
      renderCall(); syncIsland();
    }, 2600 + Math.random() * 1800);
  }

  /* ---------------- call screen */
  function padKeysHTML() {
    const keys = [['1', ''], ['2', 'ABC'], ['3', 'DEF'], ['4', 'GHI'], ['5', 'JKL'], ['6', 'MNO'], ['7', 'PQRS'], ['8', 'TUV'], ['9', 'WXYZ'], ['*', ''], ['0', '+'], ['#', '']];
    return keys.map(([k, l]) => {
      const cls = k === '*' ? ' sym star' : k === '#' ? ' sym' : '';
      return `<button class="pc-key${cls}" data-k="${k}"><b>${k === '*' ? '*' : k}</b><i>${l}</i></button>`;
    }).join('');
  }
  const dtmfId = (k) => (k === '*' ? 'dtmf-star' : k === '#' ? 'dtmf-pound' : 'dtmf-' + k);

  /* immediate press feedback (sound on touch-down like the real keypad) with a click fallback */
  function bindKeys(container, onKey) {
    const press = (btn) => {
      btn.classList.add('down');
      setTimeout(() => btn.classList.remove('down'), 140);
      onKey(btn.dataset.k, btn);
    };
    container.addEventListener('pointerdown', (e) => {
      const b = e.target.closest('.pc-key'); if (!b || (e.button != null && e.button > 0)) return;
      b._pd = Date.now(); press(b);
    });
    container.addEventListener('click', (e) => {
      const b = e.target.closest('.pc-key'); if (!b) return;
      if (b._pd && Date.now() - b._pd < 900) return;
      press(b);
    });
  }

  function mountCall() {
    if (!P.ctx || !call) return;
    if (callEl) callEl.remove();
    const col = call.color;
    callEl = U.el(`<div class="pc-call" data-state="${call.state}">
      <div class="pc-call-bg" style="background:radial-gradient(circle at 24% 22%, ${col} 0, transparent 46%),radial-gradient(circle at 82% 38%, #2E5BFF55 0, transparent 44%),radial-gradient(circle at 60% 84%, ${col}AA 0, transparent 50%),#15171C"></div>
      <div class="pc-call-shade"></div>
      <div class="pc-call-top"><div class="pc-call-status"></div><div class="pc-call-name"></div><div class="pc-call-dtmf"><bdi></bdi></div></div>
      <div class="pc-call-avatar">${avatar(call.contact, 118)}</div>
      <div class="pc-call-grid">
        <button class="pc-cbtn" data-a="mute"><span>${I.mute}</span><em>mute</em></button>
        <button class="pc-cbtn" data-a="pad"><span>${I.keypad}</span><em>keypad</em></button>
        <button class="pc-cbtn" data-a="speaker"><span>${I.speaker}</span><em>speaker</em></button>
        <button class="pc-cbtn" data-a="add"><span>${I.plus}</span><em>add call</em></button>
        <button class="pc-cbtn" data-a="facetime"><span>${I.video}</span><em>FaceTime</em></button>
        <button class="pc-cbtn" data-a="contacts"><span>${I.person}</span><em>contacts</em></button>
      </div>
      <div class="pc-call-pad">${padKeysHTML()}</div>
      <div class="pc-call-bottom"><i></i><button class="pc-cbtn pc-call-end" data-a="end"><span>${I.phoneDown}</span></button><button class="pc-call-hide" data-a="hide">Hide</button></div>
      <div class="pc-call-in">
        <button class="pc-cbtn pc-mini" data-a="remind"><span>${I.bell}</span><em>Remind Me</em></button>
        <button class="pc-cbtn pc-mini" data-a="reply"><span>${I.message}</span><em>Message</em></button>
        <button class="pc-cbtn pc-call-decline" data-a="decline"><span>${I.phoneDown}</span><em>Decline</em></button>
        <button class="pc-cbtn pc-call-accept" data-a="accept"><span>${I.phone}</span><em>Accept</em></button>
      </div>
    </div>`);
    callEl.addEventListener('click', (e) => { const b = e.target.closest('[data-a]'); if (b) callAction(b.dataset.a); });
    bindKeys(callEl.querySelector('.pc-call-pad'), (k) => {
      if (!call) return;
      call.dtmf += k;
      try { OS.sound.play(dtmfId(k), { category: 'media', volume: 0.8 }); } catch (e) { /* no sound */ }
      renderCall();
    });
    if (document.activeElement && document.activeElement.blur) document.activeElement.blur();
    P.ctx.root.appendChild(callEl);
    const el = callEl;
    requestAnimationFrame(() => requestAnimationFrame(() => el.classList.add('in')));
    try { P.ctx.setStatusBar('light'); } catch (e) { /* ignore */ }
    renderCall();
  }

  function renderCallStatus() {
    if (!callEl || !call) return;
    callEl.querySelector('.pc-call-status').textContent = call.state === 'ended' && call.answered ? `call ended · ${call.finalTime || ''}` : statusText();
  }

  function renderCall() {
    if (!callEl || !call) return;
    callEl.dataset.state = call.state;
    callEl.dataset.pad = call.pad ? '1' : '0';
    callEl.dataset.dtmf = call.dtmf ? '1' : '0';
    const title = callTitle();
    const nameEl = callEl.querySelector('.pc-call-name');
    nameEl.textContent = title; nameEl.classList.toggle('long', title.length > 18);
    callEl.querySelector('.pc-call-dtmf bdi').textContent = call.dtmf;
    renderCallStatus();
    const q = (a) => callEl.querySelector(`.pc-cbtn[data-a="${a}"]`);
    q('mute').classList.toggle('on', call.muted);
    q('speaker').classList.toggle('on', call.speaker);
    const live = call.state === 'connected' && !call.partyRinging;
    q('add').classList.toggle('dim', !live);
    q('facetime').classList.toggle('dim', !live || call.others.length > 0);
  }

  function callAction(a) {
    if (!call) return;
    try { OS.haptic('light'); } catch (e) { /* no haptics */ }
    if (a === 'end') endCall();
    else if (a === 'accept') acceptCall();
    else if (a === 'decline') missCall(true);
    else if (a === 'mute') { call.muted = !call.muted; renderCall(); }
    else if (a === 'speaker') { call.speaker = !call.speaker; renderCall(); }
    else if (a === 'pad') { call.pad = true; renderCall(); }
    else if (a === 'hide') { call.pad = false; renderCall(); }
    else if (a === 'add') pickContact({ title: 'Add Call', filter: (c) => !!c.phone, onPick: addParty });
    else if (a === 'contacts') {
      pickContact({ title: 'Contacts', onPick(c) { OS.ui.alert({ title: cname(c), message: [fmtNumber(c.phone), c.email].filter(Boolean).join('\n') || 'No details', buttons: [{ label: 'OK' }] }); } });
    } else if (a === 'facetime') {
      const to = call.contactId || call.number;
      endCall();
      setTimeout(() => OS.openApp('facetime', { to }), 350);
    } else if (a === 'remind') {
      const who = call.contactId || call.number, name = call.name;
      missCall(true);
      OS.ui.toast('Reminder set for 1 minute');
      setTimeout(() => {
        try { OS.notify({ appId: 'phone', title: 'Call Back ' + name, body: 'Reminder', sound: true, onTap() { OS.openApp('phone', { number: (lookup(who) || {}).phone || who }); } }); } catch (e) { /* ignore */ }
      }, 60000);
    } else if (a === 'reply') {
      const replies = ['Sorry, I can\'t talk right now.', 'I\'m on my way.', 'Can I call you later?'];
      const who = call.contactId || call.number;
      OS.ui.actionSheet({ title: 'Respond with:', buttons: replies.map((r) => ({ label: r })).concat([{ label: 'Custom…' }]), cancel: 'Cancel' }).then((i) => {
        if (i < 0) return;
        if (call && call.state === 'incoming') missCall(true);
        OS.openApp('messages', { to: who, body: replies[i] || '' });
      });
    }
  }

  /* ---------------- Dynamic Island */
  let islandOn = false;
  function islandBits() {
    const t = call.state === 'connected' ? fmtDur(elapsed()) : call.state === 'incoming' ? 'Ringing' : call.state === 'busy' ? 'Busy' : 'Calling';
    const g = '#30D158', font = 'system-ui,-apple-system,system-ui,sans-serif';
    return {
      leading: `<span style="display:flex;align-items:center;color:${g};padding-left:2px"><svg viewBox="0 0 24 24" width="17" height="17" fill="currentColor"><path d="${HANDSET}"/></svg></span>`,
      trailing: `<span style="color:${g};font:600 14px ${font};font-variant-numeric:tabular-nums;letter-spacing:-.2px">${t}</span>`,
      expanded: `<div style="display:flex;align-items:center;gap:12px;width:100%;box-sizing:border-box;padding:4px 2px;color:#fff;font-family:${font}">${avatar(call.contact, 44)}<div style="flex:1;min-width:0"><div style="font-size:13px;color:${g};font-variant-numeric:tabular-nums">${esc(t)}</div><div style="font-size:17px;font-weight:600;letter-spacing:-.4px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${esc(callTitle())}</div></div><button onclick="event.stopPropagation();OS.phone.endCall()" style="flex:none;width:46px;height:46px;border-radius:50%;border:0;background:#FF3B30;color:#fff;display:flex;align-items:center;justify-content:center;cursor:pointer"><svg viewBox="0 0 24 24" width="26" height="26" fill="currentColor"><path d="${HANDSET}" transform="rotate(135 12 12)"/></svg></button></div>`,
    };
  }
  function syncIsland() {
    if (!islandOn || !call || call.state === 'ended') return;
    try { OS.island.update('phone-call', islandBits()); } catch (e) { /* island unavailable */ }
  }
  function islandStart() {
    if (islandOn || !call || call.state === 'ended') return;
    try {
      OS.island.start(Object.assign({ id: 'phone-call', appId: 'phone', onTap() { OS.openApp('phone'); } }, islandBits()));
      islandOn = true;
    } catch (e) { islandOn = false; }
  }
  function islandStop() {
    if (!islandOn) return;
    islandOn = false;
    try { OS.island.end('phone-call'); } catch (e) { /* ignore */ }
  }

  /* ---------------- tabs */
  function switchTab(name) {
    if (!P.root) return;
    if (!['favorites', 'recents', 'contacts', 'keypad', 'voicemail'].includes(name)) name = 'keypad';
    if (P.tab === 'recents' && name !== 'recents') clearMissed();
    if (P.tab === 'voicemail' && name !== 'voicemail' && P.vmStop) P.vmStop();
    closeSwipe();
    P.tab = name;
    OS.store.set('phone.tab', name);
    P.root.querySelectorAll('.pc-pane').forEach((p) => p.classList.toggle('on', p.dataset.tab === name));
    P.root.querySelectorAll('.ios-tab').forEach((t) => t.classList.toggle('on', t.dataset.tab === name));
    if (document.activeElement && document.activeElement.blur) document.activeElement.blur();
    if (P.draw[name]) P.draw[name]();
  }
  function clearMissed() {
    if (OS.store.get('phone.unseenMissed', 0)) { OS.store.set('phone.unseenMissed', 0); updateBadge(); }
  }

  /* ---------------- Favorites */
  function buildFavorites(pane) {
    const nav = P.navs.favorites = OS.ui.createNav(pane, { tabBarInset: true });
    let bodyEl = null, pageRef = null, editing = false;
    const setRight = () => {
      if (!pageRef || !pageRef.setRight) return;
      pageRef.setRight([editing ? { label: 'Done', bold: true, onTap() { editing = false; setRight(); draw(); } } : { label: 'Edit', onTap() { editing = true; setRight(); draw(); } }]);
    };
    function draw() {
      if (!bodyEl) return;
      const favs = sortedContacts().filter((c) => c.favorite);
      if (!favs.length) { editing = false; bodyEl.innerHTML = '<div class="pc-empty"><h3>No Favorites</h3><p>Tap + to add the people you call the most.</p></div>'; return; }
      bodyEl.innerHTML = `<div class="${editing ? 'editing' : ''}">` + favs.map((c) => `
        <div class="pc-row" data-id="${esc(c.id)}"><button class="pc-minus" data-rm="1">${I.minus}</button>
          <div class="pc-row-main">${avatar(c, 44)}<div class="pc-row-text"><div class="pc-row-name">${esc(cname(c))}</div><div class="pc-row-sub">${I.phone}<span>mobile</span></div></div>
          <button class="pc-info" data-info="1">${I.info}</button></div></div>`).join('') + '</div>';
    }
    P.draw.favorites = draw;
    nav.push({
      title: 'Favorites', largeTitle: true, background: 'var(--bg)',
      left: { label: '+', icon: I.plus, onTap() { pickContact({ title: 'Add to Favorites', filter: (c) => !c.favorite, onPick(c) { OS.contacts.update(c.id, { favorite: true }); changed(); draw(); } }); } },
      right: [{ label: 'Edit', onTap() { editing = true; setRight(); draw(); } }],
      render(body, page) {
        bodyEl = body; pageRef = page || null;
        body.addEventListener('click', (e) => {
          const row = e.target.closest('.pc-row'); if (!row) return;
          const c = lookup(row.dataset.id); if (!c) return;
          if (e.target.closest('[data-rm]')) { OS.contacts.update(c.id, { favorite: false }); changed(); draw(); return; }
          if (e.target.closest('[data-info]')) { pushDetail(nav, { id: c.id }, 'phone', { back: 'Favorites' }); return; }
          if (!editing) startCall(c.phone);
        });
        draw();
      },
      onShow(page) { if (page && !pageRef) pageRef = page; subscribe(draw, 'phone'); draw(); },
      onHide() { unsubscribe(draw); },
    });
  }

  /* ---------------- Recents */
  function buildRecents(pane) {
    const nav = P.navs.recents = OS.ui.createNav(pane, { tabBarInset: true });
    let bodyEl = null, pageRef = null, editing = false, filter = 'all';
    const setRight = () => {
      if (!pageRef || !pageRef.setRight) return;
      pageRef.setRight(editing
        ? [{ label: 'Clear', onTap() {
            OS.ui.actionSheet({ buttons: [{ label: 'Clear All Recents', style: 'destructive' }], cancel: 'Cancel' }).then((i) => {
              if (i === 0) { setRecents([]); editing = false; setRight(); clearMissed(); draw(); }
            });
          } }, { label: 'Done', bold: true, onTap() { editing = false; setRight(); draw(); } }]
        : [{ label: 'Edit', onTap() { editing = true; closeSwipe(); setRight(); draw(); } }]);
    };
    function groups() {
      const out = [];
      getRecents().forEach((r) => {
        if (filter === 'missed' && r.type !== 'missed') return;
        const g = out[out.length - 1];
        if (g && sameNumber(g.number, r.number) && g.type === r.type && dayStart(new Date(g.date)) === dayStart(new Date(r.date))) { g.ids.push(r.id); g.count++; }
        else out.push({ number: r.number, type: r.type, date: r.date, ids: [r.id], count: 1 });
      });
      return out;
    }
    function draw() {
      if (!bodyEl) return;
      const gs = groups();
      bodyEl.innerHTML = `<div class="pc-segwrap"><div class="ios-seg"><button data-f="all" class="${filter === 'all' ? 'on' : ''}">All</button><button data-f="missed" class="${filter === 'missed' ? 'on' : ''}">Missed</button></div></div><div class="pc-rlist ${editing ? 'editing' : ''}"></div>`;
      const listEl = bodyEl.querySelector('.pc-rlist');
      if (!gs.length) { listEl.innerHTML = `<div class="pc-empty" style="padding-top:90px"><h3>${filter === 'missed' ? 'No Missed Calls' : 'No Recents'}</h3><p>Calls you make and receive appear here.</p></div>`; return; }
      gs.forEach((g) => {
        const c = lookup(g.number);
        const row = U.el(`<div class="pc-row"><button class="pc-minus" data-rm="1">${I.minus}</button><div class="pc-gutter">${g.type === 'outgoing' ? I.out : ''}</div>
          <div class="pc-row-main"><div class="pc-row-text"><div class="pc-row-name ${g.type === 'missed' ? 'missed' : ''}">${esc(c ? cname(c) : fmtNumber(g.number) || g.number)}${g.count > 1 ? ` <em>(${g.count})</em>` : ''}</div><div class="pc-row-sub"><span>${c ? 'mobile' : 'unknown'}</span></div></div>
          <span class="pc-row-when">${esc(whenLabel(g.date))}</span><button class="pc-info" data-info="1">${I.info}</button></div></div>`);
        const removeIt = () => { setRecents(getRecents().filter((r) => !g.ids.includes(r.id))); draw(); };
        const wrap = makeSwipe(row, removeIt);
        row.addEventListener('click', (e) => {
          if (wrap._swiped) return;
          if (openSwipeRow) { closeSwipe(); return; }
          if (e.target.closest('[data-rm]')) { removeIt(); return; }
          if (e.target.closest('[data-info]')) { pushDetail(nav, c ? { id: c.id } : { number: g.number }, 'phone', { showLog: true, back: 'Recents' }); return; }
          if (!editing) startCall(g.number);
        });
        listEl.appendChild(wrap);
      });
    }
    P.draw.recents = draw;
    nav.push({
      title: 'Recents', largeTitle: true, background: 'var(--bg)',
      right: [{ label: 'Edit', onTap() { editing = true; setRight(); draw(); } }],
      render(body, page) {
        bodyEl = body; pageRef = page || null;
        body.addEventListener('click', (e) => { const f = e.target.closest('[data-f]'); if (f) { filter = f.dataset.f; closeSwipe(); draw(); } });
        draw();
      },
      onShow(page) { if (page && !pageRef) pageRef = page; subscribe(draw, 'phone'); draw(); },
      onHide() { unsubscribe(draw); closeSwipe(); },
    });
  }

  /* ---------------- Keypad */
  function buildKeypad(pane) {
    const keys = [['1', ''], ['2', 'ABC'], ['3', 'DEF'], ['4', 'GHI'], ['5', 'JKL'], ['6', 'MNO'], ['7', 'PQRS'], ['8', 'TUV'], ['9', 'WXYZ'], ['*', ''], ['0', '+'], ['#', '']];
    pane.innerHTML = `<div class="pc-kp">
      <div class="pc-kp-display"><div class="pc-kp-num"><bdi></bdi></div><div class="pc-kp-name"></div></div>
      <div class="pc-kp-grid">${keys.map(([k, l]) => `<button class="pc-key${k === '*' ? ' sym star' : k === '#' ? ' sym' : ''}" data-k="${k}"><b>${k}</b><i>${l}</i></button>`).join('')}</div>
      <div class="pc-kp-callrow"><i></i><button class="pc-kp-call" aria-label="Call">${I.phone}</button><button class="pc-kp-bksp" aria-label="Delete">${I.backspace}</button></div>
    </div>`;
    const numEl = pane.querySelector('.pc-kp-num'), numTxt = numEl.querySelector('bdi'), nameEl = pane.querySelector('.pc-kp-name'), bksp = pane.querySelector('.pc-kp-bksp');

    function paint() {
      const f = fmtNumber(P.number);
      numTxt.textContent = f;
      numEl.classList.toggle('sm', f.length > 14 && f.length <= 18);
      numEl.classList.toggle('xs', f.length > 18);
      bksp.classList.toggle('on', !!P.number);
      const c = digits(P.number).length >= 7 ? lookup(P.number) : null;
      nameEl.classList.toggle('add', !!P.number && !c);
      nameEl.textContent = c ? cname(c) : (P.number ? 'Add Number' : '');
    }
    function type(k) {
      if (P.number.length >= 24) return;
      P.number += k;
      try { OS.sound.play(dtmfId(k), { volume: 0.7 }); } catch (e) { /* no sound */ }
      paint();
    }
    function erase() {
      if (!P.number) return;
      P.number = P.number.slice(0, -1);
      paint();
    }
    function go() {
      if (!P.number) { P.number = OS.store.get('phone.lastDialed', '') || ''; paint(); return; }
      const n = P.number;
      if (startCall(n)) { P.number = ''; paint(); }
    }
    P.kp = { type, erase, go, paint };

    bindKeys(pane.querySelector('.pc-kp-grid'), (k) => type(k));
    const zero = pane.querySelector('.pc-key[data-k="0"]');
    U.longPress(zero, () => { if (P.number.endsWith('0')) { P.number = P.number.slice(0, -1) + '+'; try { OS.haptic('light'); } catch (e) { /* none */ } paint(); } }, 600);
    pane.querySelector('.pc-kp-call').addEventListener('click', go);
    bksp.addEventListener('click', () => { if (bksp._held) { bksp._held = false; return; } erase(); });
    U.longPress(bksp, () => { bksp._held = true; P.number = ''; try { OS.haptic('light'); } catch (e) { /* none */ } paint(); setTimeout(() => { bksp._held = false; }, 500); }, 550);
    nameEl.addEventListener('click', () => {
      if (!nameEl.classList.contains('add')) return;
      const n = fmtNumber(P.number);
      OS.ui.actionSheet({ title: n, buttons: [{ label: 'Create New Contact' }, { label: 'Add to Existing Contact' }], cancel: 'Cancel' }).then((i) => {
        if (i === 0) openEditor(null, { phone: n }, () => paint());
        else if (i === 1) pickContact({ title: 'Add to Contact', onPick(c) { OS.contacts.update(c.id, { phone: n }); changed(); paint(); OS.ui.toast('Number Added'); } });
      });
    });
    P.draw.keypad = paint;
    paint();
  }

  /* ---------------- Voicemail */
  function buildVoicemail(pane) {
    const nav = P.navs.voicemail = OS.ui.createNav(pane, { tabBarInset: true });
    let bodyEl = null, openId = null, playing = false, pos = 0, speaker = true, showDeleted = false, lastTick = 0;

    const stop = () => { playing = false; clearInterval(P.vmTimer); P.vmTimer = 0; paintPlayer(); };
    P.vmStop = stop;
    const cur = () => getVM().find((v) => v.id === openId) || null;

    function paintPlayer() {
      if (!bodyEl || !openId) return;
      const item = bodyEl.querySelector(`.pc-vm-item[data-id="${openId}"]`), v = cur();
      if (!item || !v) return;
      const f = U.clamp(pos / v.duration, 0, 1);
      item.querySelector('.pc-vm-fill').style.width = (f * 100) + '%';
      item.querySelector('.pc-vm-knob').style.left = (f * 100) + '%';
      const t = item.querySelectorAll('.pc-vm-times span');
      t[0].textContent = fmtDur(pos); t[1].textContent = '-' + fmtDur(Math.ceil(v.duration - pos));
      item.querySelector('.pc-vm-play').innerHTML = playing ? I.pause : I.play;
      item.querySelector('[data-v="speaker"]').classList.toggle('on', speaker);
    }
    function play() {
      const v = cur(); if (!v) return;
      if (pos >= v.duration - 0.05) pos = 0;
      playing = true; lastTick = Date.now();
      if (!v.heard) { setVM(getVM().map((x) => (x.id === v.id ? Object.assign({}, x, { heard: true }) : x))); updateBadge(); const dot = bodyEl.querySelector(`.pc-vm-item[data-id="${v.id}"] .pc-vm-dot`); if (dot) dot.classList.add('off'); }
      clearInterval(P.vmTimer);
      P.vmTimer = setInterval(() => {
        const now = Date.now(); pos += (now - lastTick) / 1000; lastTick = now;
        if (pos >= v.duration) { pos = v.duration; stop(); return; }
        paintPlayer();
      }, 100);
      paintPlayer();
    }
    function setOpen(id) {
      stop(); pos = 0;
      const prev = openId; openId = (prev === id) ? null : id;
      bodyEl.querySelectorAll('.pc-vm-item').forEach((it) => {
        const pl = it.querySelector('.pc-vm-player'), on = it.dataset.id === openId;
        it.classList.toggle('open', on);
        pl.style.height = on ? pl.firstElementChild.offsetHeight + 'px' : '0px';
      });
      paintPlayer();
    }
    function draw() {
      if (!bodyEl) return;
      const all = getVM(), live = all.filter((v) => !v.deleted), dead = all.filter((v) => v.deleted);
      const list = showDeleted ? dead : live;
      let html = '';
      if (showDeleted) html += '<div class="pc-segwrap" style="padding-bottom:4px"><div class="pc-link" data-v="back" style="padding-left:0">‹ Voicemail</div></div>';
      if (!list.length) html += `<div class="pc-empty"><h3>${showDeleted ? 'No Deleted Messages' : 'No Voicemail'}</h3><p>${showDeleted ? '' : 'New messages will appear here.'}</p></div>`;
      list.forEach((v) => {
        const c = lookup(v.number);
        html += `<div class="pc-vm-item" data-id="${v.id}">
          <div class="pc-row"><span class="pc-vm-dot ${v.heard ? 'off' : ''}"></span>
            <div class="pc-row-main"><div class="pc-row-text"><div class="pc-row-name">${esc(c ? cname(c) : fmtNumber(v.number))}</div><div class="pc-row-sub"><span>${c ? 'mobile' : 'unknown'}</span></div></div>
            <div style="text-align:right"><div class="pc-row-when">${esc(whenLabel(v.date))}</div><div class="pc-row-when" style="font-size:13px">${fmtDur(v.duration)}</div></div>
            <button class="pc-info" data-v="info">${I.info}</button></div></div>
          <div class="pc-vm-player"><div class="pc-vm-inner">
            <div class="pc-vm-track"><div class="pc-vm-fill"></div><div class="pc-vm-knob"></div></div>
            <div class="pc-vm-times"><span>0:00</span><span>-${fmtDur(v.duration)}</span></div>
            <div class="pc-vm-btns"><button class="pc-vm-play" data-v="play">${I.play}</button>
              <button class="pc-vm-pill on" data-v="speaker">${I.speaker}Speaker</button>
              ${showDeleted ? '<button class="pc-vm-pill" data-v="undelete">Undelete</button>' : `<button class="pc-vm-pill" data-v="callback">${I.phone}Call Back</button>`}
              <button class="pc-vm-trash" data-v="trash">${I.trash}</button></div>
            <div class="pc-vm-tr"><h5>Transcription</h5><p>“${esc(v.transcript)}”</p><small>Transcribed on this iPhone.</small></div>
          </div></div></div>`;
      });
      if (!showDeleted && dead.length) html += `<div class="pc-vm-deleted"><div class="pc-link" data-v="deleted" style="color:var(--label);display:flex;justify-content:space-between">Deleted Messages<span style="color:var(--label2)">${dead.length} ›</span></div></div>`;
      if (showDeleted && dead.length) html += '<div class="pc-vm-deleted"><div class="pc-link red" data-v="clearall" style="text-align:center">Clear All</div></div>';
      bodyEl.innerHTML = html;
      bodyEl.querySelectorAll('.pc-vm-track').forEach((track) => {
        let f0 = 0, was = false;
        const seek = (f) => { const v = cur(); if (!v) return; pos = U.clamp(f, 0, 1) * v.duration; paintPlayer(); };
        U.drag(track, {
          onStart(p, e) { was = playing; if (playing) { playing = false; clearInterval(P.vmTimer); } track.classList.add('drag'); const f = fracIn(track, e, 'x'); const v = cur(); f0 = f == null ? (v ? pos / v.duration : 0) : f; seek(f0); },
          onMove(p) { seek(f0 + p.dx / (track.offsetWidth || 1)); },
          onEnd() { track.classList.remove('drag'); if (was) play(); },
        });
      });
      if (openId) {
        const it = bodyEl.querySelector(`.pc-vm-item[data-id="${openId}"]`);
        if (it) { it.classList.add('open'); const pl = it.querySelector('.pc-vm-player'); pl.style.transition = 'none'; pl.style.height = pl.firstElementChild.offsetHeight + 'px'; requestAnimationFrame(() => { pl.style.transition = ''; }); paintPlayer(); }
        else openId = null;
      }
    }
    P.draw.voicemail = draw;

    function onClick(e) {
      const a = e.target.closest('[data-v]');
      const item = e.target.closest('.pc-vm-item');
      if (a) {
        const k = a.dataset.v, v = item ? getVM().find((x) => x.id === item.dataset.id) : null;
        if (k === 'play') { playing ? stop() : play(); }
        else if (k === 'speaker') { speaker = !speaker; paintPlayer(); }
        else if (k === 'callback' && v) { stop(); startCall(v.number); }
        else if (k === 'info' && v) { const c = lookup(v.number); pushDetail(nav, c ? { id: c.id } : { number: v.number }, 'phone', { back: 'Voicemail' }); }
        else if (k === 'trash' && v) {
          stop(); openId = null;
          try { OS.sound.play('trash'); } catch (err) { /* no sound */ }
          setVM(showDeleted ? getVM().filter((x) => x.id !== v.id) : getVM().map((x) => (x.id === v.id ? Object.assign({}, x, { deleted: true, heard: true }) : x)));
          updateBadge(); draw();
        } else if (k === 'undelete' && v) { stop(); openId = null; setVM(getVM().map((x) => (x.id === v.id ? Object.assign({}, x, { deleted: false }) : x))); draw(); }
        else if (k === 'deleted') { stop(); openId = null; showDeleted = true; draw(); bodyEl.scrollTop = 0; }
        else if (k === 'back') { stop(); openId = null; showDeleted = false; draw(); }
        else if (k === 'clearall') {
          OS.ui.actionSheet({ message: 'These messages will be permanently erased.', buttons: [{ label: 'Clear All', style: 'destructive' }], cancel: 'Cancel' }).then((i) => {
            if (i === 0) { try { OS.sound.play('trash'); } catch (err) { /* none */ } setVM(getVM().filter((x) => !x.deleted)); showDeleted = false; draw(); }
          });
        }
        return;
      }
      if (item && e.target.closest('.pc-row')) setOpen(item.dataset.id);
    }

    nav.push({
      title: 'Voicemail', largeTitle: true, background: 'var(--bg)',
      right: [{ label: 'Greeting', onTap() {
        const custom = OS.store.get('phone.greeting', 'default') === 'custom';
        OS.ui.actionSheet({ title: 'Voicemail Greeting', message: `Callers currently hear your ${custom ? 'custom' : 'default'} greeting.`, buttons: [{ label: 'Default' }, { label: 'Custom' }], cancel: 'Cancel' }).then((i) => {
          if (i < 0) return;
          OS.store.set('phone.greeting', i === 1 ? 'custom' : 'default');
          if (i === 1) { try { OS.sound.play('begin_record'); } catch (e) { /* none */ } setTimeout(() => { try { OS.sound.play('end_record'); } catch (e) { /* none */ } OS.ui.toast('Custom Greeting Saved'); }, 1800); }
          else OS.ui.toast('Default Greeting On');
        });
      } }],
      render(body) { bodyEl = body; body.addEventListener('click', onClick); draw(); },
      onShow() { subscribe(draw, 'phone'); draw(); },
      onHide() { unsubscribe(draw); stop(); },
    });
  }

  /* ---------------- app lifecycle */
  function handleParams(params) {
    if (!params) return;
    if (typeof params === 'string') params = { url: params };
    if (params.tab) switchTab(params.tab);
    let num = params.number || params.tel || params.phone || params.to || '';
    let confirmFirst = false;
    if (!num && typeof params.url === 'string' && /^tel:/i.test(params.url)) {
      try { num = decodeURIComponent(params.url.replace(/^tel:(\/\/)?/i, '')); } catch (e) { num = params.url.replace(/^tel:(\/\/)?/i, ''); }
      confirmFirst = true;
    }
    if (params.contactId) {
      const c = lookup(params.contactId);
      if (c) { switchTab('contacts'); try { P.navs.contacts.popToRoot(); } catch (e) { /* ignore */ } pushDetail(P.navs.contacts, { id: c.id }, 'phone'); }
    }
    if (num && !call) {
      const c = lookup(num);
      if (c && c.phone) num = c.phone;
      if (confirmFirst) {
        OS.ui.alert({ title: fmtNumber(num) || num, buttons: [{ label: 'Cancel', style: 'cancel' }, { label: 'Call' }] }).then((i) => { if (i === 1) startCall(num); });
      } else startCall(num);
    }
  }

  OS.registerApp({
    id: 'phone',
    name: 'Phone',
    icon: {
      bg: 'linear-gradient(180deg,#6BEA74 0%,#1FC63C 100%)',
      glyph: `<svg viewBox="0 0 60 60"><g transform="translate(11.5 11.5) scale(1.54)"><path fill="#fff" d="${HANDSET}"/></g></svg>`,
    },
    system: true,
    statusBar: 'auto',
    background: 'var(--bg)',
    launch(ctx) {
      ensureData();
      P.ctx = ctx; P.root = ctx.root;
      const tabs = [['favorites', 'Favorites', I.star], ['recents', 'Recents', I.clock], ['contacts', 'Contacts', I.person], ['keypad', 'Keypad', I.keypad], ['voicemail', 'Voicemail', I.voicemail]];
      ctx.root.innerHTML = tabs.map(([id]) => `<div class="pc-pane" data-tab="${id}"></div>`).join('') +
        `<div class="ios-tabbar">${tabs.map(([id, label, icon]) => `<button class="ios-tab" data-tab="${id}">${icon}<span>${label}</span><i class="pc-tabbadge" style="display:none"></i></button>`).join('')}</div>`;
      const pane = (id) => ctx.root.querySelector(`.pc-pane[data-tab="${id}"]`);
      buildFavorites(pane('favorites'));
      buildRecents(pane('recents'));
      P.navs.contacts = OS.ui.createNav(pane('contacts'), { tabBarInset: true });
      pushContactList(P.navs.contacts, 'phone');
      buildKeypad(pane('keypad'));
      buildVoicemail(pane('voicemail'));
      ctx.root.querySelector('.ios-tabbar').addEventListener('click', (e) => {
        const t = e.target.closest('.ios-tab'); if (!t) return;
        if (t.dataset.tab === P.tab) { const n = P.navs[P.tab]; if (n) { try { n.popToRoot(); } catch (err) { /* ignore */ } } return; }
        try { OS.haptic('selection'); } catch (err) { /* none */ }
        switchTab(t.dataset.tab);
      });
      P.keyHandler = (e) => {
        if (!P.ctx || !P.ctx.isActive() || P.tab !== 'keypad' || call || !P.kp) return;
        const t = e.target;
        if (t && (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA' || t.isContentEditable)) return;
        if (e.metaKey || e.ctrlKey || e.altKey) return;
        if (/^[0-9*#]$/.test(e.key)) { P.kp.type(e.key); const b = P.root.querySelector(`.pc-kp .pc-key[data-k="${e.key === '*' ? '\\*' : e.key}"]`); if (b) { b.classList.add('down'); setTimeout(() => b.classList.remove('down'), 140); } }
        else if (e.key === '+') { P.number += '+'; P.kp.paint(); }
        else if (e.key === 'Backspace') P.kp.erase();
        else if (e.key === 'Enter') P.kp.go();
      };
      document.addEventListener('keydown', P.keyHandler);
      switchTab(OS.store.get('phone.tab', 'keypad'));
      updateBadge();
    },
    onResume(ctx, params) {
      P.ctx = ctx;
      islandStop();
      if (call) { if (!callEl) mountCall(); else { try { ctx.setStatusBar('light'); } catch (e) { /* ignore */ } renderCall(); } }
      handleParams(params);
      if (P.draw[P.tab]) P.draw[P.tab]();
      updateBadge();
    },
    onPause() {
      if (P.vmStop) P.vmStop();
      if (P.tab === 'recents') clearMissed();
      closeSwipe();
      if (call && call.state !== 'ended') islandStart();
    },
    onClose() {
      if (call) {
        if (call.state === 'incoming') missCall(true);
        else if (call.state !== 'ended') endCall();
      }
      teardownCall();
      stopSnd('end');
      islandStop();
      if (P.vmStop) P.vmStop();
      clearInterval(P.vmTimer);
      if (P.keyHandler) document.removeEventListener('keydown', P.keyHandler);
      unsubscribeApp('phone');
      openSwipeRow = null;
      P.ctx = null; P.root = null; P.navs = {}; P.draw = {}; P.kp = null; P.keyHandler = null; P.vmStop = null; P.number = '';
    },
  });

  /* ==================================================================
     Contacts app (same list / card / editor)
     ================================================================== */
  const C = { ctx: null, nav: null };
  OS.registerApp({
    id: 'contacts',
    name: 'Contacts',
    icon: {
      bg: 'linear-gradient(180deg,#D9D9DE 0%,#A4A4AB 100%)',
      glyph: `<svg viewBox="0 0 60 60">
        <rect x="0" y="0" width="50" height="60" fill="#E9E9ED"/>
        <rect x="50" y="0" width="10" height="60" fill="#8E8E93"/>
        <path d="M50 3h7a3 3 0 013 3v8.5H50z" fill="#FF9F0A"/><rect x="50" y="16" width="10" height="13" fill="#34C759"/><rect x="50" y="30.5" width="10" height="13" fill="#0A84FF"/><path d="M50 45h10v9a3 3 0 01-3 3h-7z" fill="#FF375F"/>
        <rect x="49" y="0" width="1.2" height="60" fill="#00000022"/>
        <circle cx="25" cy="30" r="18" fill="#C4C4CA"/>
        <circle cx="25" cy="24.5" r="6.6" fill="#fff"/>
        <path d="M12.2 42.6C13.8 36.4 18.8 33.4 25 33.4s11.2 3 12.8 9.2A18 18 0 0125 48a18 18 0 01-12.8-5.4z" fill="#fff"/>
      </svg>`,
    },
    system: true,
    statusBar: 'auto',
    background: 'var(--bg)',
    launch(ctx) {
      ensureData();
      C.ctx = ctx;
      ctx.root.innerHTML = '<div class="pc-host"></div>';
      C.nav = OS.ui.createNav(ctx.root.firstElementChild, { tabBarInset: false });
      pushContactList(C.nav, 'contacts');
    },
    onResume(ctx, params) {
      if (!params || !C.nav) return;
      const id = params.id || params.contactId || params.to;
      if (id) {
        const c = lookup(id);
        if (c) { try { C.nav.popToRoot(); } catch (e) { /* ignore */ } pushDetail(C.nav, { id: c.id }, 'contacts'); }
      } else if (params.new) {
        openEditor(null, typeof params.new === 'object' ? params.new : {}, (c) => { if (c) pushDetail(C.nav, { id: c.id }, 'contacts'); });
      }
    },
    onPause() {},
    onClose() { unsubscribeApp('contacts'); C.ctx = null; C.nav = null; },
  });

  /* ==================================================================
     Public API + session life
     ================================================================== */
  OS.phone = {
    incomingCall,
    call(number) { dial(number); },
    endCall() { endCall(); },
    get active() { return !!call && call.state !== 'ended'; },
  };

  setTimeout(() => { try { ensureData(); updateBadge(); } catch (e) { /* core still booting */ } }, 0);

  /* one surprise incoming call per page load so the phone feels alive */
  if (!window.__pcIncomingScheduled) {
    window.__pcIncomingScheduled = true;
    const tryRing = (retries) => {
      if (call) { if (retries > 0) setTimeout(() => tryRing(retries - 1), 45000); return; }
      const favs = allContacts().filter((c) => c.favorite && c.phone);
      const pool = favs.length ? favs : allContacts().filter((c) => c.phone);
      if (!pool.length) return;
      incomingCall(pool[Math.floor(Math.random() * pool.length)].id);
    };
    setTimeout(() => tryRing(2), 90000 + Math.random() * 60000);
  }
})();
