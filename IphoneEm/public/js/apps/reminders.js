/* Reminders — smart lists, My Lists, inline editing, details sheet, due notifications + icon badge. */
(function () {
  'use strict';
  if (!window.OS) return;
  const U = OS.util;
  const esc = (s) => U.esc(s == null ? '' : String(s));
  const el = (html) => U.el(String(html).trim());
  const EASE = 'cubic-bezier(.32,.72,0,1)';

  /* ───────────────────────── icons ───────────────────────── */
  const svg = (inner, attrs) => `<svg viewBox="0 0 24 24" fill="currentColor" ${attrs || ''}>${inner}</svg>`;
  const GLYPHS = {
    list: svg('<circle cx="5" cy="7" r="1.7"/><rect x="9" y="6" width="11.5" height="2" rx="1"/><circle cx="5" cy="12" r="1.7"/><rect x="9" y="11" width="11.5" height="2" rx="1"/><circle cx="5" cy="17" r="1.7"/><rect x="9" y="16" width="11.5" height="2" rx="1"/>'),
    bookmark: svg('<path d="M7 3.5h10a1.2 1.2 0 0 1 1.2 1.2v15.8L12 16.4l-6.2 4.1V4.7A1.2 1.2 0 0 1 7 3.5z"/>'),
    star: svg('<path d="M12 3.2l2.7 5.5 6 .9-4.4 4.2 1.1 6L12 17l-5.4 2.8 1.1-6L3.3 9.6l6-.9z"/>'),
    heart: svg('<path d="M12 20.5S4 15.6 4 9.9A4.4 4.4 0 0 1 12 7.4a4.4 4.4 0 0 1 8 2.5c0 5.700-8 10.600-8 10.600z"/>'),
    cart: svg('<path d="M3 5h2.400l2.300 9.200h9.900l2-7.200H7.300" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/><circle cx="9.200" cy="18.600" r="1.600"/><circle cx="16.400" cy="18.600" r="1.600"/>'),
    book: svg('<path fill-rule="evenodd" d="M6.500 3.500H17A1.500 1.500 0 0 1 18.500 5v15.500h-11a2 2 0 0 1-2-2v-14a1 1 0 0 1 1-1zM8.500 7v2h7V7z"/>'),
    cap: svg('<path d="M12 4 1.800 9 12 14l8-3.900V16h2V9z"/><path d="M6 12.900V17c0 1.600 2.700 3 6 3s6-1.400 6-3v-4.100l-6 3z"/>'),
    gamepad: svg('<path fill-rule="evenodd" d="M7.500 7h9a5.500 5.500 0 0 1 5.300 7l-.600 2.400a2.600 2.600 0 0 1-4.500 1L15 15.500H9l-1.700 1.900a2.600 2.600 0 0 1-4.500-1L2.200 14A5.500 5.500 0 0 1 7.500 7zM8 9.300v1.500H6.500v1.600H8v1.500h1.600v-1.500H11v-1.600H9.600V9.300zm7.300 1.300a1.100 1.100 0 1 0 0-2.200 1.100 1.100 0 0 0 0 2.200zm2.100 2.800a1.100 1.100 0 1 0 0-2.200 1.100 1.100 0 0 0 0 2.200z"/>'),
    house: svg('<path d="M12 3.300 2.800 11h2.700v9h5v-5.800h3V20h5v-9h2.700z"/>'),
    bulb: svg('<path d="M12 2.800a6.200 6.200 0 0 0-3.600 11.200c.700.500 1.100 1.200 1.100 2v.300h5V16c0-.800.400-1.500 1.100-2A6.200 6.200 0 0 0 12 2.800zM9.600 17.800h4.800v1.300a1.400 1.400 0 0 1-1.400 1.400h-2a1.400 1.400 0 0 1-1.400-1.400z"/>'),
    music: svg('<path d="M9 5.600 19 3.500v11.800a2.900 2.900 0 1 1-2-2.800V7.400l-6 1.200v8.800a2.900 2.900 0 1 1-2-2.800z"/>'),
    paw: svg('<ellipse cx="6.300" cy="10" rx="1.900" ry="2.500"/><ellipse cx="10" cy="6.500" rx="1.900" ry="2.500"/><ellipse cx="14" cy="6.500" rx="1.900" ry="2.500"/><ellipse cx="17.700" cy="10" rx="1.900" ry="2.500"/><path d="M12 11.500c-3 0-5.500 3-5.500 5.300 0 1.500 1.100 2.400 2.500 2.400 1.200 0 1.900-.600 3-.600s1.800.600 3 .600c1.400 0 2.500-.900 2.500-2.400 0-2.300-2.500-5.300-5.500-5.300z"/>'),
    gift: svg('<path d="M4 8.500h7v3.500H4zM13 8.500h7v3.500h-7zM5.500 13.500H11V20H5.500zM13 13.500h5.500V20H13z"/><path d="M12 8.300C11 4.800 7 4 6.600 6s2.400 2.300 5.400 2.300zm0 0C13 4.800 17 4 17.400 6S15 8.300 12 8.300z" fill="none" stroke="currentColor" stroke-width="1.700"/>'),
    plane: svg('<path d="M21 15.500v-2l-7.500-4.700V4a1.500 1.500 0 0 0-3 0v4.800L3 13.500v2l7.500-2.300V18l-2 1.500V21l3.500-1 3.500 1v-1.500l-2-1.500v-4.800z"/>'),
    dumbbell: svg('<rect x="1.800" y="9" width="3" height="6" rx="1"/><rect x="5.300" y="6.500" width="3.200" height="11" rx="1.200"/><rect x="8.500" y="11" width="7" height="2"/><rect x="15.500" y="6.500" width="3.200" height="11" rx="1.200"/><rect x="19.200" y="9" width="3" height="6" rx="1"/>'),
    pencil: svg('<path d="M4 20l1-4.600L16.400 4a2 2 0 0 1 2.800 0l.800.800a2 2 0 0 1 0 2.800L8.600 19z"/>'),
    leaf: svg('<path d="M19.500 4.500C11 4 5 8 5 14.500c0 1 .200 2 .500 2.800C8 12.500 11.500 10 15 8.800 11.500 11 8.500 14 6.800 19.500l1.700.500c.400-1.200.900-2.300 1.500-3.300 6.500.800 10.500-4.200 9.500-12.200z"/>'),
    pin: svg('<path d="M12 2.800a6.300 6.300 0 0 0-6.300 6.300c0 4.600 6.300 12 6.300 12s6.300-7.400 6.300-12A6.300 6.300 0 0 0 12 2.800zm0 8.600a2.400 2.400 0 1 1 0-4.800 2.400 2.400 0 0 1 0 4.800z"/>'),
  };
  const GLYPH_KEYS = Object.keys(GLYPHS);
  const ICON = {
    ellipsis: '<svg viewBox="0 0 24 24" width="24" height="24" fill="none" stroke="currentColor" stroke-width="1.700"><circle cx="12" cy="12" r="9.200"/><g fill="currentColor" stroke="none"><circle cx="7.800" cy="12" r="1.300"/><circle cx="12" cy="12" r="1.300"/><circle cx="16.200" cy="12" r="1.300"/></g></svg>',
    plusCircle: svg('<path fill-rule="evenodd" d="M12 2a10 10 0 1 0 0 20 10 10 0 0 0 0-20zm-1 5.500h2V11h3.500v2H13v3.500h-2V13H7.500v-2H11z"/>'),
    info: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.600"><circle cx="12" cy="12" r="9.200"/><path d="M12 11v6" stroke-width="2" stroke-linecap="round"/><circle cx="12" cy="7.600" r="1.200" fill="currentColor" stroke="none"/></svg>',
    flag: svg('<path d="M5 3h1.800v18H5z"/><path d="M8 4.300c3.800-1.700 6.400 1.700 10.800 0v8.200c-4.400 1.700-7-1.700-10.800 0z"/>'),
    chevron: '<svg viewBox="0 0 8 14" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M1.500 1.500 6.500 7l-5 5.500"/></svg>',
    check: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><path d="M5.500 12.500l4.300 4.300 8.700-9.300"/></svg>',
    calendar: svg('<path fill-rule="evenodd" d="M6.500 4h11A2.500 2.500 0 0 1 20 6.500v11a2.500 2.500 0 0 1-2.500 2.500h-11A2.500 2.500 0 0 1 4 17.500v-11A2.500 2.500 0 0 1 6.500 4zM6 9v8.300c0 .400.300.700.700.700h10.600c.400 0 .700-.300.700-.700V9z"/><g><circle cx="9" cy="12" r="1"/><circle cx="12" cy="12" r="1"/><circle cx="15" cy="12" r="1"/><circle cx="9" cy="15.200" r="1"/><circle cx="12" cy="15.200" r="1"/></g>'),
    clock: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="8.500"/><path d="M12 7.500V12l3 2"/></svg>',
    tray: svg('<path fill-rule="evenodd" d="M6.300 5h11.400l2.800 8v4.500A1.500 1.500 0 0 1 19 19H5a1.500 1.500 0 0 1-1.500-1.500V13zm1.400 2-2 6h3.800a2.500 2.500 0 0 0 5 0h3.800l-2-6z"/>'),
    priority: svg('<path d="M10.800 4h2.400l-.400 10h-1.600z"/><circle cx="12" cy="18" r="1.500"/>'),
    trash: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.800" stroke-linecap="round" stroke-linejoin="round"><path d="M4.500 6.500h15M9.500 6V4.500h5V6M6.500 6.500l.800 12.500a1.500 1.500 0 0 0 1.500 1.400h6.400a1.500 1.500 0 0 0 1.500-1.400l.800-12.500"/></svg>',
    eye: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.800"><path d="M2.500 12S6 5.500 12 5.500 21.500 12 21.500 12 18 18.500 12 18.500 2.500 12 2.500 12z"/><circle cx="12" cy="12" r="3"/></svg>',
  };
  const todayGlyph = () => `<svg viewBox="0 0 24 24"><rect x="4.500" y="5" width="15" height="14.500" rx="3" fill="none" stroke="currentColor" stroke-width="1.700"/><text x="12" y="16.300" text-anchor="middle" font-size="8.500" font-weight="700" fill="currentColor" font-family="system-ui,-apple-system,system-ui,sans-serif">${new Date().getDate()}</text></svg>`;

  const COLORS = ['#FF3B30', '#FF9500', '#FFCC00', '#34C759', '#32ADE6', '#007AFF', '#5856D6', '#FF2D55', '#AF52DE', '#A2845E', '#5B626A', '#E8A69F'];

  /* ───────────────────────── dates ───────────────────────── */
  const HOUR = 3600000;
  function sod(t) { const d = new Date(t); d.setHours(0, 0, 0, 0); return d.getTime(); }
  function addDays(t, n) { const d = new Date(t); d.setDate(d.getDate() + n); return d.getTime(); }
  function endOfToday() { return addDays(sod(Date.now()), 1); }
  function at(dayOffset, h, m) { const d = new Date(); d.setHours(0, 0, 0, 0); d.setDate(d.getDate() + dayOffset); d.setHours(h || 0, m || 0, 0, 0); return d.getTime(); }
  function use24() { try { return !!OS.settings.get('use24h'); } catch (_) { return false; } }
  function fmtTime(t) {
    const d = new Date(t);
    try { const s = U.time(d); return use24() ? s : s + ' ' + U.ampm(d); }
    catch (_) { return d.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' }); }
  }
  function fmtDay(t) {
    const s = sod(t), t0 = sod(Date.now());
    if (s === t0) return 'Today';
    if (s === addDays(t0, 1)) return 'Tomorrow';
    if (s === addDays(t0, -1)) return 'Yesterday';
    const d = new Date(s), sameYear = d.getFullYear() === new Date().getFullYear();
    return d.toLocaleDateString('en-US', sameYear ? { weekday: 'short', month: 'short', day: 'numeric' } : { month: 'short', day: 'numeric', year: 'numeric' });
  }
  function fmtDue(it) { return it.due == null ? '' : fmtDay(it.due) + (it.hasTime ? ', ' + fmtTime(it.due) : ''); }
  function isOverdue(it) { const now = Date.now(); return !it.done && it.due != null && (it.hasTime ? it.due < now : it.due < sod(now)); }

  /* ───────────────────────── data ───────────────────────── */
  const K_LISTS = 'reminders.lists', K_ITEMS = 'reminders.items', K_PREFS = 'reminders.prefs';
  let lists = OS.store.get(K_LISTS, null);
  let items = OS.store.get(K_ITEMS, null);
  let prefs = OS.store.get(K_PREFS, null);
  if (!prefs || typeof prefs !== 'object') prefs = {};
  if (!prefs.showCompleted) prefs.showCompleted = {};

  function notifyAt(it) { return it.due == null ? null : it.hasTime ? it.due : it.due + 9 * HOUR; }   // all-day → 9:00 AM like iOS
  function normalizeNotified(it) { const t = notifyAt(it); it.notified = t != null && t <= Date.now(); }
  function mk(listId, title, o) {
    const it = Object.assign({ id: U.uid(), listId, title, notes: '', due: null, hasTime: false, flagged: false, priority: 0, done: false, doneAt: null, created: Date.now(), notified: false }, o || {});
    normalizeNotified(it);
    return it;
  }
  function seed() {
    lists = [{ id: U.uid(), name: 'Reminders', color: '#007AFF', icon: 'list' }]; items = [];
    OS.store.set(K_LISTS, lists); OS.store.set(K_ITEMS, items); return;
    const L = (name, color, icon) => ({ id: U.uid(), name, color, icon });
    const rem = L('Reminders', '#007AFF', 'list'), school = L('School', '#FF3B30', 'cap'), groc = L('Groceries', '#34C759', 'cart'), games = L('Game Ideas', '#AF52DE', 'gamepad');
    lists = [rem, school, groc, games];
    const now = Date.now();
    items = [
      mk(rem.id, 'Take out the trash', { due: at(0, 19, 0), hasTime: true }),
      mk(rem.id, 'Return library books', { due: at(-1), notes: '3 books — they close at 6' }),
      mk(rem.id, 'Call Grandma', { due: at(1, 17, 30), hasTime: true, flagged: true }),
      mk(rem.id, 'Charge Xbox controller'),
      mk(rem.id, 'Feed the cat', { done: true, doneAt: now - 5 * HOUR, due: at(0, 7, 30), hasTime: true }),
      mk(school.id, 'Math homework p. 142 #1–25', { due: at(0) }),
      mk(school.id, 'Study for science quiz', { due: at(2, 16, 0), hasTime: true, priority: 3, flagged: true, notes: 'Chapters 4 and 5 — cells + photosynthesis' }),
      mk(school.id, 'Get permission slip signed', { due: at(1), priority: 2 }),
      mk(school.id, 'Bring gym clothes', { due: at(3, 7, 15), hasTime: true }),
      mk(school.id, 'Finish history poster', { done: true, doneAt: now - 26 * HOUR }),
      mk(groc.id, 'Milk'), mk(groc.id, 'Eggs'), mk(groc.id, 'Bread'), mk(groc.id, 'Cheese sticks'), mk(groc.id, 'Cereal (the good kind)'),
      mk(groc.id, 'Apples', { done: true, doneAt: now - 30 * HOUR }),
      mk(games.id, 'Subway survival: flashlight battery that runs out', { flagged: true }),
      mk(games.id, 'Cat RPG — fishing minigame', { notes: 'Different fish per biome, rare golden koi' }),
      mk(games.id, 'Plane game: carrier landings'),
      mk(games.id, 'Horror game where the ghost is actually friendly'),
      mk(games.id, 'Game jam theme ideas', { due: at(5), notes: 'Jam starts next weekend' }),
    ];
    items.forEach((it, i) => { it.created = now - (items.length - i) * 60000; });
    OS.store.set(K_LISTS, lists); OS.store.set(K_ITEMS, items);
  }
  if (!Array.isArray(lists) || !Array.isArray(items) || !lists.length) seed();

  function saveLists() { OS.store.set(K_LISTS, lists); }
  function saveItems() { OS.store.set(K_ITEMS, items); updateBadge(); }
  function savePrefs() { OS.store.set(K_PREFS, prefs); }
  function listById(id) { return lists.find((l) => l.id === id) || lists[0]; }
  function defaultList() {
    if (!lists.length) { lists.push({ id: U.uid(), name: 'Reminders', color: '#007AFF', icon: 'list' }); saveLists(); }
    return lists[0];
  }
  function listGlyph(l) { return GLYPHS[l.icon] || GLYPHS.list; }

  const SMART = {
    today: { title: 'Today', color: '#007AFF', match: (it) => it.due != null && it.due < endOfToday() },
    scheduled: { title: 'Scheduled', color: '#FF3B30', match: (it) => it.due != null },
    all: { title: 'All', color: 'var(--label)', match: () => true },
    flagged: { title: 'Flagged', color: '#FF9500', match: (it) => it.flagged },
    completed: { title: 'Completed', color: '#8E8E93', match: (it) => it.done },
  };
  function smartCount(key) { const s = SMART[key]; return items.filter((it) => (key === 'completed' ? it.done : !it.done && s.match(it))).length; }

  /* ─────────────── background: due notifications + badge (module level, runs from script load) ─────────────── */
  function updateBadge() {
    try { const end = endOfToday(); OS.badge('reminders', items.filter((it) => !it.done && it.due != null && it.due < end).length); } catch (_) {}
  }
  function fire(it) {
    try {
      OS.notify({
        appId: 'reminders', title: it.title || 'Reminder',
        body: it.notes || (it.hasTime ? fmtDay(it.due) + ', ' + fmtTime(it.due) : 'Due today'),
        sound: true,
        onTap() { OS.openApp('reminders', { item: it.id }); },
      });
    } catch (e) { console.error(e); }
  }
  function checkDue() {
    const now = Date.now();
    let changed = false, fired = false;
    for (const it of items) {
      if (it.done || it.notified || it.due == null) continue;
      const t = notifyAt(it);
      if (t <= now) { it.notified = true; changed = true; if (now - t < 12 * HOUR) { fire(it); fired = true; } }
    }
    if (changed) OS.store.set(K_ITEMS, items);
    updateBadge();
    if (fired) softRefresh();
  }
  try { OS.on('minute', checkDue); } catch (_) {}
  setInterval(checkDue, 20000);
  setTimeout(checkDue, 0);
  setTimeout(updateBadge, 1500);

  /* ───────────────────────── styles ───────────────────────── */
  OS.addStyle('reminders', `
  .app-reminders .rem-host{position:absolute;inset:0}
  .app-reminders .rem-landing{padding:4px 16px 0}
  .app-reminders .rem-search{margin:0 0 16px}
  .app-reminders .rem-spacer{height:calc(96px + var(--kb-h,0px))}
  .app-reminders .rem-tiles{display:grid;grid-template-columns:1fr 1fr;gap:14px}
  .app-reminders .rem-tile{position:relative;height:82px;border-radius:14px;background:var(--cell);padding:10px 12px;box-sizing:border-box;cursor:pointer;
    transition:transform .25s ${EASE},opacity .2s}
  .app-reminders .rem-tile:active{transform:scale(.97);opacity:.75}
  .app-reminders .rem-tile-ic{width:32px;height:32px;border-radius:50%;display:flex;align-items:center;justify-content:center;color:#fff}
  .app-reminders .rem-tile-ic svg{width:20px;height:20px}
  .app-reminders .rem-tile-ic.all{background:var(--label);color:var(--cell)}
  .app-reminders .rem-tile-n{position:absolute;right:14px;top:9px;font-size:28px;font-weight:700;letter-spacing:-.4px;color:var(--label);font-variant-numeric:tabular-nums}
  .app-reminders .rem-tile-l{position:absolute;left:13px;bottom:9px;font-size:16px;font-weight:600;letter-spacing:-.3px;color:var(--label2)}
  .app-reminders .rem-h2{font-size:22px;font-weight:700;letter-spacing:-.4px;color:var(--label);margin:26px 8px 10px}
  .app-reminders .rem-card{border-radius:12px;background:var(--cell);overflow:hidden}
  .app-reminders .rem-lrow{display:flex;align-items:center;min-height:54px;padding-left:12px;cursor:pointer;position:relative}
  .app-reminders .rem-lrow:active{background:var(--fill2)}
  .app-reminders .rem-lic{flex:0 0 32px;width:32px;height:32px;border-radius:50%;display:flex;align-items:center;justify-content:center;color:#fff;margin-right:12px}
  .app-reminders .rem-lic svg{width:19px;height:19px}
  .app-reminders .rem-lrow-in{flex:1;min-width:0;display:flex;align-items:center;align-self:stretch;padding-right:14px;border-bottom:.5px solid var(--sep)}
  .app-reminders .rem-lrow:last-child .rem-lrow-in{border-bottom:0}
  .app-reminders .rem-lname{flex:1;min-width:0;font-size:17px;letter-spacing:-.4px;color:var(--label);white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
  .app-reminders .rem-lcount{font-size:17px;color:var(--label2);margin:0 8px 0 10px;font-variant-numeric:tabular-nums}
  .app-reminders .rem-chev{width:8px;height:14px;color:var(--label3);flex:0 0 8px}
  .app-reminders .rem-chev svg{width:8px;height:14px;display:block}

  .app-reminders .rem-toolbar{position:absolute;left:0;right:0;bottom:0;height:calc(50px + var(--safe-bottom,34px));padding:0 16px var(--safe-bottom,34px);box-sizing:border-box;
    display:flex;align-items:center;justify-content:space-between;background:var(--bar);-webkit-backdrop-filter:var(--blur,blur(20px));backdrop-filter:var(--blur,blur(20px));z-index:5}
  .app-reminders .rem-toolbar.plain{background:var(--bg)}
  .app-reminders .rem-tb-new{display:flex;align-items:center;gap:7px;font-size:17px;font-weight:600;letter-spacing:-.4px;color:var(--rem-c,var(--tint));background:none;border:0;padding:6px 0;cursor:pointer;font-family:inherit}
  .app-reminders .rem-tb-new svg{width:25px;height:25px}
  .app-reminders .rem-tb-add{font-size:17px;letter-spacing:-.4px;color:var(--tint);background:none;border:0;padding:6px 0;cursor:pointer;font-family:inherit}
  .app-reminders .rem-tb-new:active,.app-reminders .rem-tb-add:active{opacity:.5}

  .app-reminders .rem-listpage{padding-top:0}
  .app-reminders .rem-title-big{font-size:34px;font-weight:700;letter-spacing:.3px;padding:2px 16px 6px;line-height:41px;word-break:break-word}
  .app-reminders .rem-cline{display:flex;gap:6px;align-items:center;padding:0 16px 8px;font-size:15px;color:var(--label2)}
  .app-reminders .rem-cline button{background:none;border:0;padding:0;font:inherit;color:var(--tint);cursor:pointer}
  .app-reminders .rem-sec-h{font-size:20px;font-weight:700;letter-spacing:-.3px;padding:18px 16px 4px;color:var(--label)}
  .app-reminders .rem-sec-h.past{color:var(--red)}
  .app-reminders .rem-row{position:relative;overflow:hidden;transition:height .32s ${EASE},opacity .28s}
  .app-reminders .rem-row-main{position:relative;display:flex;align-items:flex-start;background:var(--bg);will-change:transform}
  .app-reminders .rem-landing .rem-row-main{background:var(--bg2)}
  .app-reminders .rem-check{flex:0 0 50px;height:44px;display:flex;align-items:center;justify-content:center;cursor:pointer}
  .app-reminders .rem-check b{display:block;width:22px;height:22px;border-radius:50%;border:1.5px solid var(--label3);box-sizing:border-box;position:relative;transition:border-color .2s}
  .app-reminders .rem-check i{position:absolute;inset:2.5px;border-radius:50%;background:var(--c);transform:scale(0);transition:transform .32s ${EASE}}
  .app-reminders .rem-row.done .rem-check b{border-color:var(--c)}
  .app-reminders .rem-row.done .rem-check i{transform:scale(1)}
  .app-reminders .rem-check:active b{transform:scale(.88)}
  .app-reminders .rem-new .rem-check b{opacity:.55;border-style:dashed}
  .app-reminders .rem-row-body{flex:1;min-width:0;display:flex;align-items:flex-start;min-height:44px;border-bottom:.5px solid var(--sep);padding:11px 12px 10px 0;box-sizing:border-box}
  .app-reminders .rem-new .rem-row-body{border-bottom-color:transparent}
  .app-reminders .rem-row-text{flex:1;min-width:0}
  .app-reminders .rem-row-line{display:flex;align-items:center;gap:4px}
  .app-reminders .rem-pri{font-size:17px;font-weight:600;color:var(--c);flex:none}
  .app-reminders input.rem-title{flex:1;min-width:0;width:100%;border:0;outline:0;background:transparent;padding:0;margin:0;font:inherit;font-size:17px;letter-spacing:-.4px;line-height:22px;height:22px;color:var(--label);caret-color:var(--c,var(--tint));text-overflow:ellipsis;border-radius:0;-webkit-appearance:none;appearance:none}
  .app-reminders input.rem-title::placeholder{color:var(--label3)}
  .app-reminders .rem-row.done input.rem-title{color:var(--label2)}
  .app-reminders .rem-notes{font-size:15px;line-height:20px;letter-spacing:-.2px;color:var(--label2);margin-top:1px;display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;overflow:hidden}
  .app-reminders .rem-sub{font-size:15px;line-height:20px;letter-spacing:-.2px;color:var(--label2);margin-top:1px}
  .app-reminders .rem-sub .od{color:var(--red)}
  .app-reminders .rem-flagic{flex:none;width:18px;height:22px;color:var(--orange);margin-left:8px;display:none}
  .app-reminders .rem-flagic svg{width:16px;height:16px;margin-top:3px}
  .app-reminders .rem-row.flagged .rem-flagic{display:block}
  .app-reminders .rem-info{flex:none;width:24px;height:24px;margin:-1px 0 0 10px;padding:0;border:0;background:none;color:var(--tint);cursor:pointer;display:none}
  .app-reminders .rem-info svg{width:24px;height:24px;display:block}
  .app-reminders .rem-row.editing .rem-info{display:block}
  .app-reminders .rem-actions{position:absolute;top:0;right:0;bottom:0;width:0;display:flex;overflow:hidden}
  .app-reminders .rem-act{flex:1 1 0;min-width:0;border:0;padding:0;margin:0;color:#fff;font:inherit;font-size:15px;letter-spacing:-.2px;cursor:pointer;white-space:nowrap;overflow:hidden;transition:flex-grow .25s ${EASE}}
  .app-reminders .rem-act.det{background:var(--gray,#8E8E93)}
  .app-reminders .rem-act.flag{background:var(--orange,#FF9500)}
  .app-reminders .rem-act.del{background:var(--red,#FF3B30)}
  .app-reminders .rem-row.full .rem-act:not(.del){flex-grow:0}
  .app-reminders .rem-empty{text-align:center;color:var(--label3);font-size:20px;letter-spacing:-.3px;padding:150px 20px 0;pointer-events:none}
  .app-reminders .rem-noresults{text-align:center;color:var(--label2);padding:80px 20px 0}
  .app-reminders .rem-noresults b{display:block;font-size:22px;color:var(--label);margin-bottom:6px}

  /* sheets (rendered by the OS outside .app-reminders) */
  .rem-sheet{padding-bottom:calc(40px + var(--kb-h,0px))}
  .rem-sheet .rem-d-card{margin:8px 16px 22px;border-radius:12px;background:var(--cell);overflow:hidden}
  .rem-sheet .rem-d-card input,.rem-sheet .rem-d-card textarea{display:block;width:100%;box-sizing:border-box;border:0;outline:0;background:transparent;font:inherit;font-size:17px;letter-spacing:-.4px;color:var(--label);padding:12px 16px;margin:0;resize:none;border-radius:0;-webkit-appearance:none;appearance:none}
  .rem-sheet .rem-d-card input::placeholder,.rem-sheet .rem-d-card textarea::placeholder{color:var(--label3)}
  .rem-sheet .rem-d-card textarea{min-height:92px;border-top:.5px solid var(--sep);line-height:22px}
  .rem-sheet .ios-list{margin-bottom:22px}
  .rem-sheet .rem-d-lab{flex:1;min-width:0}
  .rem-sheet .rem-d-l1{font-size:17px;letter-spacing:-.4px;color:var(--label)}
  .rem-sheet .rem-d-l2{font-size:13px;color:var(--tint);margin-top:1px}
  .rem-sheet .rem-d-l2:empty{display:none}
  .rem-sheet .ios-row .ios-switch{margin-left:auto;flex:none}
  .rem-sheet .ios-row-icon{color:#fff;display:flex;align-items:center;justify-content:center;flex:none}
  .rem-sheet .ios-row-icon svg{width:19px;height:19px}
  .rem-sheet .rem-pick{height:0;overflow:hidden;transition:height .35s ${EASE};position:relative}
  .rem-sheet .rem-pick.open{height:216px;border-top:.5px solid var(--sep)}
  .rem-sheet .rem-pick .ios-wheel{max-width:340px;margin:0 auto}
  .rem-sheet .rem-d-value{margin-left:auto;display:flex;align-items:center;gap:6px;color:var(--label2);font-size:17px;letter-spacing:-.4px;min-width:0}
  .rem-sheet .rem-d-value .dot{width:10px;height:10px;border-radius:50%;flex:none}
  .rem-sheet .rem-d-value svg{width:8px;height:14px;color:var(--label3);flex:none;margin-left:4px}
  .rem-sheet .rem-d-del{justify-content:center;color:var(--red);font-size:17px;letter-spacing:-.4px;cursor:pointer}
  .rem-sheet .rem-tap{cursor:pointer}

  .rem-sheet .rem-ls-card{margin:8px 16px 16px;border-radius:14px;background:var(--cell);padding:18px 16px}
  .rem-sheet .rem-ls-icon{width:96px;height:96px;border-radius:50%;margin:2px auto 18px;display:flex;align-items:center;justify-content:center;color:#fff;background:var(--c);box-shadow:0 6px 22px color-mix(in srgb,var(--c) 45%,transparent);transition:background .25s,box-shadow .25s}
  .rem-sheet .rem-ls-icon svg{width:54px;height:54px}
  .rem-sheet input.rem-ls-name{display:block;width:100%;box-sizing:border-box;height:56px;border:0;outline:0;border-radius:12px;background:var(--cell2);text-align:center;font:inherit;font-size:22px;font-weight:700;letter-spacing:-.3px;color:var(--c);caret-color:var(--c);padding:0 14px;-webkit-appearance:none;appearance:none}
  .rem-sheet input.rem-ls-name::placeholder{color:var(--label3)}
  .rem-sheet .rem-ls-grid{display:grid;grid-template-columns:repeat(6,40px);justify-content:space-between;row-gap:16px}
  .rem-sheet .rem-sw{position:relative;width:40px;height:40px;border-radius:50%;border:0;padding:0;background:var(--c,var(--cell2));color:var(--label2);cursor:pointer;display:flex;align-items:center;justify-content:center;transition:transform .2s ${EASE}}
  .rem-sheet .rem-sw:active{transform:scale(.9)}
  .rem-sheet .rem-sw svg{width:22px;height:22px}
  .rem-sheet .rem-sw.on::after{content:'';position:absolute;inset:-6px;border-radius:50%;border:3px solid var(--label3)}
  `);

  /* ───────────────────────── app state ───────────────────────── */
  let ctxRef = null, nav = null, landing = null, currentView = null, openRow = null;

  function editingInside() {
    const a = document.activeElement;
    return !!(a && ctxRef && ctxRef.root.contains(a) && /INPUT|TEXTAREA/.test(a.tagName));
  }
  function softRefresh() {
    if (!ctxRef || editingInside()) return;
    if (currentView) renderList(currentView); else if (landing) renderLanding();
  }
  function haptic(t) { try { OS.haptic(t); } catch (_) {} }

  /* ───────────────────────── landing ───────────────────────── */
  function buildLanding(body, page) {
    const wrap = el(`<div class="rem-landing">
      <div class="ios-search rem-search"><input type="text" placeholder="Search" enterkeyhint="search" autocomplete="off" spellcheck="false"></div>
      <div class="rem-landing-content"></div>
      <div class="rem-spacer"></div>
    </div>`);
    body.appendChild(wrap);
    const input = wrap.querySelector('input');
    landing = { body, page, content: wrap.querySelector('.rem-landing-content'), input, query: '' };
    input.addEventListener('input', () => { landing.query = input.value.trim(); renderLanding(); });
    input.addEventListener('keydown', (e) => { if (e.key === 'Enter') input.blur(); });
    body.addEventListener('pointerdown', (e) => { if (openRow && !openRow.contains(e.target)) setOpen(openRow, 0, true); }, true);

    const bar = el(`<div class="rem-toolbar">
      <button class="rem-tb-new">${ICON.plusCircle}<span>New Reminder</span></button>
      <button class="rem-tb-add">Add List</button>
    </div>`);
    bar.querySelector('.rem-tb-new').addEventListener('click', () => {
      openDetails(mk(defaultList().id, ''), { isNew: true, onDone: renderLanding });
    });
    bar.querySelector('.rem-tb-add').addEventListener('click', () => openListSheet(null));
    (page && page.el ? page.el : body.parentNode).appendChild(bar);
    renderLanding();
  }

  function renderLanding() {
    if (!landing) return;
    const c = landing.content;
    c.innerHTML = '';
    openRow = null;
    if (landing.query) { renderSearch(c, landing.query); return; }

    const tiles = el('<div class="rem-tiles"></div>');
    const tile = (key, glyph, cls) => {
      const s = SMART[key];
      const t = el(`<div class="rem-tile" data-smart="${key}">
        <div class="rem-tile-ic ${cls || ''}" ${cls ? '' : `style="background:${s.color}"`}>${glyph}</div>
        <div class="rem-tile-n">${smartCount(key)}</div><div class="rem-tile-l">${s.title}</div></div>`);
      t.addEventListener('click', () => openList({ smart: key }));
      tiles.appendChild(t);
    };
    tile('today', todayGlyph());
    tile('scheduled', ICON.calendar);
    tile('all', ICON.tray, 'all');
    tile('flagged', ICON.flag);
    tile('completed', ICON.check);
    c.appendChild(tiles);

    c.appendChild(el('<div class="rem-h2">My Lists</div>'));
    const card = el('<div class="rem-card"></div>');
    lists.forEach((l) => {
      const n = items.filter((it) => it.listId === l.id && !it.done).length;
      const row = el(`<div class="rem-lrow"><div class="rem-lic" style="background:${esc(l.color)}">${listGlyph(l)}</div>
        <div class="rem-lrow-in"><div class="rem-lname">${esc(l.name)}</div><div class="rem-lcount">${n}</div><div class="rem-chev">${ICON.chevron}</div></div></div>`);
      let pressedAt = 0;
      row.addEventListener('click', () => { if (Date.now() - pressedAt < 700) return; openList({ listId: l.id }); });
      U.longPress(row, () => {
        pressedAt = Date.now(); haptic('medium');
        menu(row, [
          { label: 'Show List Info', icon: ICON.info, onTap: () => openListSheet(l) },
          { label: 'Delete List', icon: ICON.trash, style: 'destructive', onTap: () => deleteList(l) },
        ]);
      });
      card.appendChild(row);
    });
    c.appendChild(card);
  }

  function renderSearch(c, q) {
    const needle = q.toLowerCase();
    const found = items.filter((it) => (it.title + '\n' + (it.notes || '')).toLowerCase().includes(needle));
    if (!found.length) { c.appendChild(el(`<div class="rem-noresults"><b>No Results</b>for “${esc(q)}”</div>`)); return; }
    const view = { spec: { search: true }, body: landing.body, showCompleted: true };
    lists.forEach((l) => {
      const sub = found.filter((it) => it.listId === l.id);
      if (!sub.length) return;
      c.appendChild(el(`<div class="rem-sec-h" style="color:${esc(l.color)};padding-left:4px">${esc(l.name)}</div>`));
      sub.forEach((it) => c.appendChild(buildRow(it, view)));
    });
  }

  function landingMenu(ev) {
    const anchor = ev && (ev.currentTarget || ev.target);
    menu(anchor, [
      { label: 'Add List', icon: GLYPHS.list, onTap: () => openListSheet(null) },
      { label: 'New Reminder', icon: ICON.plusCircle, onTap: () => openDetails(mk(defaultList().id, ''), { isNew: true, onDone: renderLanding }) },
      { label: 'Clear Completed', icon: ICON.trash, style: 'destructive', onTap: () => clearCompleted(null, renderLanding) },
    ]);
  }

  // popup menu next to an element, action sheet when we have nothing to anchor to
  function menu(anchor, entries, title) {
    if (anchor instanceof Element && OS.ui.contextMenu) { OS.ui.contextMenu(anchor, entries); return; }
    OS.ui.actionSheet({ title, buttons: entries.map((e) => ({ label: e.label, style: e.style, icon: e.icon })), cancel: 'Cancel' })
      .then((i) => { if (i >= 0 && entries[i] && entries[i].onTap) entries[i].onTap(); });
  }

  function clearCompleted(listId, after) {
    const victims = items.filter((it) => it.done && (!listId || it.listId === listId));
    if (!victims.length) { OS.ui.toast('No Completed Reminders'); return; }
    OS.ui.alert({
      title: `Delete ${victims.length} completed reminder${victims.length === 1 ? '' : 's'}?`, message: 'This cannot be undone.',
      buttons: [{ label: 'Cancel', style: 'cancel' }, { label: 'Delete', style: 'destructive' }],
    }).then((i) => {
      if (i !== 1) return;
      items = items.filter((it) => !victims.includes(it));
      saveItems(); haptic('success');
      if (after) after();
    });
  }

  function deleteList(l) {
    if (lists.length <= 1) { OS.ui.alert({ title: 'Can’t Delete List', message: 'You need at least one list.', buttons: [{ label: 'OK' }] }); return; }
    const n = items.filter((it) => it.listId === l.id).length;
    OS.ui.alert({
      title: `Delete “${l.name}”?`, message: n ? 'This will delete all reminders in this list.' : '',
      buttons: [{ label: 'Cancel', style: 'cancel' }, { label: 'Delete', style: 'destructive' }],
    }).then((i) => {
      if (i !== 1) return;
      lists = lists.filter((x) => x.id !== l.id);
      items = items.filter((it) => it.listId !== l.id);
      saveLists(); saveItems();
      try { OS.sound.play('trash'); } catch (_) {}
      if (currentView && currentView.spec.listId === l.id) nav.pop(); else renderLanding();
    });
  }

  /* ───────────────────────── list pages ───────────────────────── */
  function specKey(spec) { return spec.smart ? 'smart:' + spec.smart : 'list:' + spec.listId; }
  function specInfo(spec) {
    if (spec.smart) return { title: SMART[spec.smart].title, color: SMART[spec.smart].color };
    const l = listById(spec.listId); return { title: l.name, color: l.color };
  }

  function openList(spec) {
    const view = { spec, body: null, page: null, showCompleted: spec.smart === 'completed' || !!prefs.showCompleted[specKey(spec)], collapsed: null };
    nav.push({
      title: '', back: 'Lists', background: 'var(--bg)',
      right: [{ icon: ICON.ellipsis, onTap(ev) { listMenu(view, ev); } }],
      render(body, page) {
        view.body = body; view.page = page;
        body.addEventListener('scroll', () => {
          const show = body.scrollTop > 40;
          if (show !== view.collapsed) { view.collapsed = show; try { page.setTitle(show ? specInfo(view.spec).title : ''); } catch (_) {} }
        });
        body.addEventListener('pointerdown', (e) => { if (openRow && !openRow.contains(e.target)) setOpen(openRow, 0, true); }, true);
        const info = specInfo(spec);
        const bar = el(`<div class="rem-toolbar plain" style="--rem-c:${spec.smart === 'all' || spec.smart === 'completed' ? 'var(--tint)' : esc(info.color)}"><button class="rem-tb-new">${ICON.plusCircle}<span>New Reminder</span></button></div>`);
        bar.querySelector('button').addEventListener('click', () => {
          const inputs = body.querySelectorAll('.rem-new input');
          const target = inputs[spec.smart === 'scheduled' ? 0 : inputs.length - 1];
          if (target) { target.focus(); setTimeout(() => ensureVisible(body, target), 380); }
          else openDetails(mk(defaultList().id, ''), { isNew: true, onDone: () => renderList(view) });
        });
        view.bar = bar;
        (page && page.el ? page.el : body.parentNode).appendChild(bar);
        renderList(view);
      },
      onShow() { currentView = view; },
      onHide() { if (currentView === view) currentView = null; },
    });
    currentView = view;
  }

  function listMenu(view, ev) {
    const spec = view.spec, entries = [];
    const l = spec.listId ? listById(spec.listId) : null;
    if (l) entries.push({ label: 'Show List Info', icon: ICON.info, onTap: () => openListSheet(l, () => renderList(view)) });
    if (spec.smart !== 'completed') {
      entries.push({
        label: view.showCompleted ? 'Hide Completed' : 'Show Completed', icon: ICON.eye,
        onTap: () => { view.showCompleted = !view.showCompleted; prefs.showCompleted[specKey(spec)] = view.showCompleted; savePrefs(); renderList(view); },
      });
    }
    entries.push({ label: 'Clear Completed', icon: ICON.check, onTap: () => clearCompleted(l ? l.id : null, () => renderList(view)) });
    if (l) entries.push({ label: 'Delete List', icon: ICON.trash, style: 'destructive', onTap: () => deleteList(l) });
    menu(ev && (ev.currentTarget || ev.target), entries, specInfo(spec).title);
  }

  function computeSections(view) {
    const spec = view.spec, show = view.showCompleted;
    const vis = (it) => show || !it.done;
    const byOrder = (a, b) => (a.done - b.done) || (a.created - b.created);
    const byDue = (a, b) => (a.due - b.due) || (a.created - b.created);
    if (spec.listId) return [{ items: items.filter((it) => it.listId === spec.listId && vis(it)).sort(byOrder), add: { listId: spec.listId } }];
    const key = spec.smart, s = SMART[key];
    if (key === 'completed') return [{ items: items.filter((it) => it.done).sort((a, b) => (b.doneAt || 0) - (a.doneAt || 0)), add: null }];
    if (key === 'all') {
      return lists.map((l) => ({ header: l.name, color: l.color, items: items.filter((it) => it.listId === l.id && vis(it)).sort(byOrder), add: { listId: l.id } }));
    }
    const pool = items.filter((it) => s.match(it) && vis(it));
    if (key === 'today') return [{ items: pool.sort(byDue), add: { due: sod(Date.now()) } }];
    if (key === 'flagged') return [{ items: pool.sort(byOrder), add: { flagged: true } }];
    // scheduled → grouped by day, today's section always present
    const days = new Map();
    const today = sod(Date.now());
    days.set(today, []);
    pool.sort(byDue).forEach((it) => { const d = sod(it.due); if (!days.has(d)) days.set(d, []); days.get(d).push(it); });
    return Array.from(days.keys()).sort((a, b) => a - b).map((d) => ({ header: fmtDay(d), past: d < today, items: days.get(d), add: { due: d } }));
  }

  function renderList(view) {
    const body = view.body;
    if (!body) return;
    const spec = view.spec, info = specInfo(spec);
    const keepTop = body.scrollTop;
    body.innerHTML = '';
    openRow = null;
    const wrap = el('<div class="rem-listpage"></div>');
    wrap.appendChild(el(`<div class="rem-title-big" style="color:${esc(info.color)}">${esc(info.title)}</div>`));
    if (view.bar && spec.listId) view.bar.style.setProperty('--rem-c', info.color);

    if (view.showCompleted) {
      const n = items.filter((it) => it.done && (spec.listId ? it.listId === spec.listId : spec.smart === 'completed' || spec.smart === 'all' || SMART[spec.smart].match(it))).length;
      const line = el(`<div class="rem-cline"><span>${n} Completed</span><span>•</span><button>Clear</button></div>`);
      line.querySelector('button').addEventListener('click', () => clearCompleted(spec.listId || null, () => renderList(view)));
      wrap.appendChild(line);
    }

    const sections = computeSections(view);
    let total = 0;
    sections.forEach((sec) => {
      const box = el('<div class="rem-sec"></div>');
      if (sec.header) box.appendChild(el(`<div class="rem-sec-h${sec.past ? ' past' : ''}"${sec.color ? ` style="color:${esc(sec.color)}"` : ''}>${esc(sec.header)}</div>`));
      sec.items.forEach((it) => { total++; box.appendChild(buildRow(it, view)); });
      if (sec.add) box.appendChild(buildNewRow(sec.add, view));
      wrap.appendChild(box);
    });
    if (!total) wrap.appendChild(el(`<div class="rem-empty">${spec.smart === 'completed' ? 'No Completed Reminders' : 'No Reminders'}</div>`));
    wrap.appendChild(el('<div class="rem-spacer"></div>'));
    body.appendChild(wrap);
    body.scrollTop = keepTop;
  }

  function ensureVisible(body, target) {
    if (!body || !target || !target.isConnected) return;
    const br = body.getBoundingClientRect(), r = target.getBoundingClientRect();
    const scale = body.offsetHeight ? br.height / body.offsetHeight || 1 : 1;
    const kb = parseFloat(getComputedStyle(body).getPropertyValue('--kb-h')) || 0;
    const visibleBottom = body.offsetHeight - Math.max(kb, 84) - 16;
    const bottom = (r.bottom - br.top) / scale;
    if (bottom > visibleBottom) body.scrollTop += bottom - visibleBottom;
  }

  /* ───────────────────────── rows ───────────────────────── */
  const ACT_W = 222, FULL_W = 290;

  function setOpen(row, px, animate) {
    const main = row._main, acts = row._acts;
    if (!main || !acts) return;
    const tr = animate ? `.32s ${EASE}` : '0s';
    main.style.transition = 'transform ' + tr;
    acts.style.transition = 'width ' + tr;
    main.style.transform = px ? `translateX(${-px}px)` : '';
    acts.style.width = px + 'px';
    row._open = px;
    row.classList.toggle('full', px >= FULL_W);
    if (px > 0) openRow = row; else if (openRow === row) openRow = null;
  }

  function collapseRow(row, then) {
    if (!row.isConnected) { if (then) then(); return; }
    row.style.height = row.offsetHeight + 'px';
    void row.offsetHeight;
    row.style.height = '0px'; row.style.opacity = '0';
    setTimeout(() => { row.remove(); if (then) then(); }, 340);
  }

  function fillRow(row, it, view) {
    const l = listById(it.listId);
    row.style.setProperty('--c', l.color);
    row.classList.toggle('done', !!it.done);
    row.classList.toggle('flagged', !!it.flagged);
    row.querySelector('.rem-pri').textContent = it.priority ? '!'.repeat(it.priority) : '';
    row.querySelector('.rem-pri').style.display = it.priority ? '' : 'none';
    const notes = row.querySelector('.rem-notes');
    notes.textContent = it.notes || ''; notes.style.display = it.notes ? '' : 'none';
    const sub = row.querySelector('.rem-sub');
    const bits = [];
    const smart = view.spec.smart;
    if (smart && smart !== 'all') bits.push(esc(l.name));
    if (it.due != null) bits.push(`<span class="${isOverdue(it) ? 'od' : ''}">${esc(fmtDue(it))}</span>`);
    if (it.done && smart === 'completed' && it.doneAt) bits.push('Completed: ' + esc(fmtDay(it.doneAt)));
    sub.innerHTML = bits.join(' · '); sub.style.display = bits.length ? '' : 'none';
    row.querySelector('.rem-act.flag').textContent = it.flagged ? 'Unflag' : 'Flag';
  }

  function buildRow(it, view) {
    const row = el(`<div class="rem-row" data-id="${esc(it.id)}">
      <div class="rem-actions"><button class="rem-act det">Details</button><button class="rem-act flag">Flag</button><button class="rem-act del">Delete</button></div>
      <div class="rem-row-main">
        <div class="rem-check"><b><i></i></b></div>
        <div class="rem-row-body">
          <div class="rem-row-text">
            <div class="rem-row-line"><span class="rem-pri"></span><input class="rem-title" type="text" enterkeyhint="done" autocomplete="off" spellcheck="false"></div>
            <div class="rem-notes"></div><div class="rem-sub"></div>
          </div>
          <div class="rem-flagic">${ICON.flag}</div>
          <button class="rem-info" aria-label="Details">${ICON.info}</button>
        </div>
      </div></div>`);
    const main = row.querySelector('.rem-row-main'), acts = row.querySelector('.rem-actions');
    const input = row.querySelector('input'), infoBtn = row.querySelector('.rem-info');
    row._main = main; row._acts = acts; row._open = 0;
    input.value = it.title;
    fillRow(row, it, view);

    let swipedAt = 0, doneTimer = 0, editTimer = 0;
    const details = () => { setOpen(row, 0, true); input.blur(); openDetails(it, { onDone: () => (view.spec.search ? renderLanding() : renderList(view)) }); };
    const removeItem = () => {
      items = items.filter((x) => x !== it); saveItems();
      clearTimeout(doneTimer);
      collapseRow(row);
    };

    // complete / un-complete
    row.querySelector('.rem-check').addEventListener('click', () => {
      if (Date.now() - swipedAt < 250) return;
      it.done = !it.done; it.doneAt = it.done ? Date.now() : null;
      saveItems(); haptic(it.done ? 'success' : 'light');
      fillRow(row, it, view);
      clearTimeout(doneTimer);
      const leaves = view.spec.smart === 'completed' ? !it.done : it.done && !view.showCompleted;
      if (leaves) doneTimer = setTimeout(() => { if (view.spec.smart === 'completed' ? !it.done : it.done) collapseRow(row); }, 1500);
    });

    // inline title editing
    input.addEventListener('focus', () => { clearTimeout(editTimer); row.classList.add('editing'); if (openRow) setOpen(openRow, 0, true); setTimeout(() => ensureVisible(view.body, row), 380); });
    input.addEventListener('blur', () => {
      editTimer = setTimeout(() => row.classList.remove('editing'), 220);
      const t = input.value.trim();
      if (!t) { if (items.includes(it)) removeItem(); return; }     // emptied title → reminder is deleted, like iOS
      if (t !== it.title) { it.title = t; saveItems(); }
    });
    input.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') {
        e.preventDefault(); input.blur();
        const next = row.parentNode && row.parentNode.querySelector('.rem-new input');
        if (next && input.value.trim()) next.focus();
      } else if (e.key === 'Escape') { input.value = it.title; input.blur(); }
    });
    infoBtn.addEventListener('pointerdown', (e) => e.preventDefault());
    infoBtn.addEventListener('mousedown', (e) => e.preventDefault());
    infoBtn.addEventListener('click', (e) => { e.stopPropagation(); details(); });

    // tap on the rest of the row → details
    main.addEventListener('click', (e) => {
      if (Date.now() - swipedAt < 250) return;
      if (row._open) { setOpen(row, 0, true); return; }
      if (e.target.closest('.rem-check') || e.target.closest('input') || e.target.closest('.rem-info')) return;
      details();
    });

    // swipe actions
    acts.querySelector('.det').addEventListener('click', details);
    acts.querySelector('.flag').addEventListener('click', () => {
      it.flagged = !it.flagged; saveItems(); haptic('light'); setOpen(row, 0, true);
      if (view.spec.smart === 'flagged' && !it.flagged) collapseRow(row); else fillRow(row, it, view);
    });
    acts.querySelector('.del').addEventListener('click', () => { haptic('medium'); removeItem(); });

    let startOpen = 0, mode = null, lockTop = 0, x = 0;
    U.drag(main, {
      onStart() { startOpen = row._open || 0; mode = null; x = -startOpen; },
      onMove(p) {
        if (!mode) {
          if (Math.abs(p.dx) > 8 && Math.abs(p.dx) > Math.abs(p.dy) * 1.2) {
            mode = 'h'; lockTop = view.body ? view.body.scrollTop : 0;
            if (openRow && openRow !== row) setOpen(openRow, 0, true);
            if (document.activeElement === input) input.blur();
          } else if (Math.abs(p.dy) > 8) mode = 'v';
        }
        if (mode !== 'h') return;
        if (view.body) view.body.scrollTop = lockTop;
        x = -startOpen + p.dx;
        if (x > 0) x = x * 0.15;
        const was = row.classList.contains('full');
        setOpen(row, Math.max(0, -x), false);
        if (x > 0) main.style.transform = `translateX(${x}px)`;
        if (row.classList.contains('full') !== was) haptic('medium');
      },
      onEnd(p) {
        if (mode !== 'h') return;
        swipedAt = Date.now();
        const vx = p && typeof p.vx === 'number' ? p.vx : 0;
        if (-x >= FULL_W) {
          main.style.transition = acts.style.transition = `all .28s ${EASE}`;
          main.style.transform = 'translateX(-420px)'; acts.style.width = '402px';
          try { OS.sound.play('trash', { volume: 0.5 }); } catch (_) {}
          setTimeout(removeItem, 200);
        } else if (-x > ACT_W / 2 || (startOpen === 0 && p.dx < -40 && vx <= 0)) setOpen(row, ACT_W, true);
        else setOpen(row, 0, true);
      },
    });
    return row;
  }

  function buildNewRow(defaults, view) {
    const l = listById(defaults.listId || defaultList().id);
    const row = el(`<div class="rem-row rem-new" style="--c:${esc(l.color)}"><div class="rem-row-main">
      <div class="rem-check"><b><i></i></b></div>
      <div class="rem-row-body"><div class="rem-row-text"><div class="rem-row-line">
        <input class="rem-title" type="text" placeholder="New Reminder" enterkeyhint="done" autocomplete="off" spellcheck="false"></div></div></div>
    </div></div>`);
    const input = row.querySelector('input');
    const commit = () => {
      const t = input.value.trim();
      if (!t) return false;
      input.value = '';
      const it = mk(defaults.listId || defaultList().id, t, { due: defaults.due != null ? defaults.due : null, flagged: !!defaults.flagged });
      items.push(it); saveItems(); haptic('light');
      const r = buildRow(it, view);
      row.parentNode.insertBefore(r, row);
      const empty = view.body && view.body.querySelector('.rem-empty');
      if (empty) empty.remove();
      return true;
    };
    row.querySelector('.rem-check').addEventListener('click', () => input.focus());
    input.addEventListener('focus', () => { if (openRow) setOpen(openRow, 0, true); setTimeout(() => ensureVisible(view.body, row), 380); });
    input.addEventListener('blur', commit);
    input.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') { e.preventDefault(); if (commit()) setTimeout(() => ensureVisible(view.body, row), 30); else input.blur(); }
      else if (e.key === 'Escape') { input.value = ''; input.blur(); }
    });
    return row;
  }

  /* ───────────────────────── details sheet ───────────────────────── */
  const PRI = ['None', 'Low', 'Medium', 'High'];
  const pad2 = (n) => (n < 10 ? '0' : '') + n;

  function openDetails(it, opts) {
    opts = opts || {};
    const isNew = !!opts.isNew;
    const now = new Date();
    const d = {
      title: it.title, notes: it.notes || '', flagged: !!it.flagged, priority: it.priority || 0, listId: it.listId,
      dateOn: it.due != null, day: it.due != null ? sod(it.due) : sod(now),
      timeOn: it.due != null && !!it.hasTime,
      minutes: it.due != null && it.hasTime ? new Date(it.due).getHours() * 60 + new Date(it.due).getMinutes() : Math.min(23, now.getHours() + 1) * 60,
    };
    let sheetRef = null, closed = false;
    const close = () => { if (closed) return; closed = true; try { sheetRef && sheetRef.close(); } catch (_) {} };

    function commit() {
      const title = d.title.trim();
      if (!title) { haptic('error'); return false; }
      it.title = title; it.notes = d.notes.trim(); it.flagged = d.flagged; it.priority = d.priority; it.listId = d.listId;
      let due = null;
      if (d.dateOn) { const x = new Date(d.day); if (d.timeOn) x.setHours(Math.floor(d.minutes / 60), d.minutes % 60, 0, 0); due = x.getTime(); }
      const hasTime = d.dateOn && d.timeOn;
      if (due !== it.due || hasTime !== !!it.hasTime) { it.due = due; it.hasTime = hasTime; normalizeNotified(it); }
      if (isNew && !items.includes(it)) items.push(it);
      saveItems();
      return true;
    }

    const s = OS.ui.sheet({
      title: isNew ? 'New Reminder' : 'Details', height: 'large',
      left: { label: 'Cancel', onTap() { close(); } },
      right: { label: isNew ? 'Add' : 'Done', bold: true, onTap() { if (commit()) { close(); if (opts.onDone) opts.onDone(); } } },
      render(body, sh) {
        if (sh) sheetRef = sh;
        body.classList.add('rem-sheet');
        body.innerHTML = `
          <div class="rem-d-card"><input class="rem-d-title" type="text" placeholder="Title" enterkeyhint="done" autocomplete="off"><textarea class="rem-d-notes" placeholder="Notes" rows="3"></textarea></div>
          <div class="ios-list">
            <div class="ios-row rem-tap" data-row="date"><div class="ios-row-icon" style="background:#FF3B30">${ICON.calendar}</div><div class="rem-d-lab"><div class="rem-d-l1">Date</div><div class="rem-d-l2" data-v="date"></div></div><label class="ios-switch"><input type="checkbox" data-sw="date"><i></i></label></div>
            <div class="rem-pick" data-pick="date"></div>
            <div class="ios-row rem-tap" data-row="time"><div class="ios-row-icon" style="background:#007AFF">${ICON.clock}</div><div class="rem-d-lab"><div class="rem-d-l1">Time</div><div class="rem-d-l2" data-v="time"></div></div><label class="ios-switch"><input type="checkbox" data-sw="time"><i></i></label></div>
            <div class="rem-pick" data-pick="time"></div>
          </div>
          <div class="ios-list">
            <div class="ios-row"><div class="ios-row-icon" style="background:#FF9500">${ICON.flag}</div><div class="rem-d-lab"><div class="rem-d-l1">Flag</div></div><label class="ios-switch"><input type="checkbox" data-sw="flag"><i></i></label></div>
          </div>
          <div class="ios-list">
            <div class="ios-row tappable rem-tap" data-row="priority"><div class="ios-row-icon" style="background:#FF3B30">${ICON.priority}</div><div class="rem-d-lab"><div class="rem-d-l1">Priority</div></div><div class="rem-d-value"><span data-v="priority"></span>${ICON.chevron}</div></div>
            <div class="ios-row tappable rem-tap" data-row="list"><div class="ios-row-icon" data-v="listicon">${GLYPHS.list}</div><div class="rem-d-lab"><div class="rem-d-l1">List</div></div><div class="rem-d-value"><i class="dot" data-v="listdot"></i><span data-v="list"></span>${ICON.chevron}</div></div>
          </div>
          ${isNew ? '' : '<div class="ios-list"><div class="ios-row tappable rem-d-del" data-row="delete">Delete Reminder</div></div>'}`;
        const $ = (q) => body.querySelector(q);
        const titleIn = $('.rem-d-title'), notesIn = $('.rem-d-notes');
        titleIn.value = d.title; notesIn.value = d.notes;
        titleIn.addEventListener('input', () => { d.title = titleIn.value; });
        titleIn.addEventListener('keydown', (e) => { if (e.key === 'Enter') titleIn.blur(); });
        notesIn.addEventListener('input', () => { d.notes = notesIn.value; notesIn.style.height = 'auto'; notesIn.style.height = Math.max(92, notesIn.scrollHeight) + 'px'; });

        const swDate = $('[data-sw="date"]'), swTime = $('[data-sw="time"]'), swFlag = $('[data-sw="flag"]');
        const pickDate = $('[data-pick="date"]'), pickTime = $('[data-pick="time"]');
        let dateWheel = null, timeWheel = null;

        function refresh() {
          swDate.checked = d.dateOn; swTime.checked = d.timeOn; swFlag.checked = d.flagged;
          const dayLabel = fmtDay(d.day);
          $('[data-v="date"]').textContent = d.dateOn ? (/^(Today|Tomorrow|Yesterday)$/.test(dayLabel) ? dayLabel : new Date(d.day).toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' })) : '';
          const tm = new Date(d.day); tm.setHours(Math.floor(d.minutes / 60), d.minutes % 60, 0, 0);
          $('[data-v="time"]').textContent = d.timeOn ? fmtTime(tm.getTime()) : '';
          $('[data-v="priority"]').textContent = PRI[d.priority];
          const l = listById(d.listId);
          $('[data-v="list"]').textContent = l.name;
          $('[data-v="listdot"]').style.background = l.color;
          const li = $('[data-v="listicon"]'); li.style.background = l.color; li.innerHTML = listGlyph(l);
        }
        function expand(which) {
          pickDate.classList.toggle('open', which === 'date');
          pickTime.classList.toggle('open', which === 'time');
          if (which === 'date' && !dateWheel) buildDateWheel();
          if (which === 'time' && !timeWheel) buildTimeWheel();
        }
        function buildDateWheel() {
          const t0 = sod(Date.now());
          let start = Math.min(addDays(t0, -14), d.day), vals = [], t = start;
          const end = Math.max(addDays(t0, 400), addDays(d.day, 30));
          while (t <= end && vals.length < 1500) { vals.push(t); t = addDays(t, 1); }
          if (!vals.includes(d.day)) { vals.push(d.day); vals.sort((a, b) => a - b); }
          const labels = vals.map((v) => (v === t0 ? 'Today' : new Date(v).toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' }).replace(',', '')));
          dateWheel = OS.ui.wheelPicker(pickDate, { columns: [{ values: vals, labels, value: d.day }], onChange(v) { d.day = v[0]; refresh(); } });
        }
        function buildTimeWheel() {
          const h = Math.floor(d.minutes / 60), m = d.minutes % 60;
          const mins = Array.from({ length: 60 }, (_, i) => i);
          if (use24()) {
            const hrs = Array.from({ length: 24 }, (_, i) => i);
            timeWheel = OS.ui.wheelPicker(pickTime, {
              columns: [{ values: hrs, labels: hrs.map(pad2), value: h, width: 80, loop: true }, { values: mins, labels: mins.map(pad2), value: m, width: 80, loop: true }],
              onChange(v) { d.minutes = v[0] * 60 + v[1]; refresh(); },
            });
          } else {
            const hrs = [12, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11];
            timeWheel = OS.ui.wheelPicker(pickTime, {
              columns: [{ values: hrs, value: h % 12 || 12, width: 70, loop: true, align: 'right' }, { values: mins, labels: mins.map(pad2), value: m, width: 70, loop: true }, { values: ['AM', 'PM'], value: h < 12 ? 'AM' : 'PM', width: 70, align: 'left' }],
              onChange(v) { d.minutes = ((v[0] % 12) + (v[2] === 'PM' ? 12 : 0)) * 60 + v[1]; refresh(); },
            });
          }
        }

        swDate.addEventListener('change', () => {
          d.dateOn = swDate.checked;
          if (!d.dateOn) d.timeOn = false;
          expand(d.dateOn ? 'date' : null); refresh();
        });
        swTime.addEventListener('change', () => {
          d.timeOn = swTime.checked;
          if (d.timeOn) d.dateOn = true;
          expand(d.timeOn ? 'time' : d.dateOn ? 'date' : null); refresh();
        });
        swFlag.addEventListener('change', () => { d.flagged = swFlag.checked; haptic('light'); });

        body.addEventListener('click', (e) => {
          if (e.target.closest('.ios-switch')) return;
          const row = e.target.closest('[data-row]');
          if (!row) return;
          const kind = row.getAttribute('data-row');
          if (kind === 'date') { if (d.dateOn) expand(pickDate.classList.contains('open') ? null : 'date'); else { swDate.checked = true; swDate.dispatchEvent(new Event('change')); } }
          else if (kind === 'time') { if (d.timeOn) expand(pickTime.classList.contains('open') ? null : 'time'); else { swTime.checked = true; swTime.dispatchEvent(new Event('change')); } }
          else if (kind === 'priority') menu(row.querySelector('.rem-d-value'), PRI.map((label, i) => ({ label, icon: d.priority === i ? ICON.check : undefined, onTap: () => { d.priority = i; refresh(); } })), 'Priority');
          else if (kind === 'list') menu(row.querySelector('.rem-d-value'), lists.map((l) => ({ label: l.name, icon: d.listId === l.id ? ICON.check : undefined, onTap: () => { d.listId = l.id; refresh(); } })), 'List');
          else if (kind === 'delete') {
            OS.ui.alert({ title: 'Delete Reminder?', buttons: [{ label: 'Cancel', style: 'cancel' }, { label: 'Delete', style: 'destructive' }] }).then((i) => {
              if (i !== 1) return;
              items = items.filter((x) => x !== it); saveItems();
              close(); if (opts.onDone) opts.onDone();
            });
          }
        });
        refresh();
        if (isNew) setTimeout(() => { try { titleIn.focus(); } catch (_) {} }, 420);
      },
    });
    if (s) sheetRef = s;
  }

  /* ───────────────────────── new list / list info sheet ───────────────────────── */
  function openListSheet(list, after) {
    const isNew = !list;
    const d = { name: list ? list.name : '', color: list ? list.color : '#007AFF', icon: list ? list.icon || 'list' : 'list' };
    let sheetRef = null, closed = false;
    const close = () => { if (closed) return; closed = true; try { sheetRef && sheetRef.close(); } catch (_) {} };
    const s = OS.ui.sheet({
      title: isNew ? 'New List' : 'List Info', height: 'large',
      left: { label: 'Cancel', onTap() { close(); } },
      right: {
        label: 'Done', bold: true,
        onTap() {
          const name = d.name.trim();
          if (!name) { haptic('error'); OS.ui.toast('Enter a list name'); return; }
          if (isNew) lists.push({ id: U.uid(), name, color: d.color, icon: d.icon });
          else { list.name = name; list.color = d.color; list.icon = d.icon; }
          saveLists(); haptic('success'); close();
          if (after) after();
          renderLanding();
        },
      },
      render(body, sh) {
        if (sh) sheetRef = sh;
        body.classList.add('rem-sheet');
        body.innerHTML = `
          <div class="rem-ls-card rem-ls-top"><div class="rem-ls-icon"></div><input class="rem-ls-name" type="text" placeholder="List Name" enterkeyhint="done" autocomplete="off" maxlength="40"></div>
          <div class="rem-ls-card"><div class="rem-ls-grid" data-g="colors">${COLORS.map((c) => `<button class="rem-sw" data-color="${c}" style="--c:${c}"></button>`).join('')}</div></div>
          <div class="rem-ls-card"><div class="rem-ls-grid" data-g="icons">${GLYPH_KEYS.map((k) => `<button class="rem-sw" data-icon="${k}">${GLYPHS[k]}</button>`).join('')}</div></div>`;
        const top = body.querySelector('.rem-ls-top'), iconEl = body.querySelector('.rem-ls-icon'), nameIn = body.querySelector('.rem-ls-name');
        nameIn.value = d.name;
        const refresh = () => {
          top.style.setProperty('--c', d.color);
          iconEl.innerHTML = GLYPHS[d.icon] || GLYPHS.list;
          body.querySelectorAll('[data-color]').forEach((b) => b.classList.toggle('on', b.getAttribute('data-color') === d.color));
          body.querySelectorAll('[data-icon]').forEach((b) => b.classList.toggle('on', b.getAttribute('data-icon') === d.icon));
        };
        nameIn.addEventListener('input', () => { d.name = nameIn.value; });
        nameIn.addEventListener('keydown', (e) => { if (e.key === 'Enter') nameIn.blur(); });
        body.addEventListener('click', (e) => {
          const b = e.target.closest('.rem-sw'); if (!b) return;
          if (b.hasAttribute('data-color')) d.color = b.getAttribute('data-color'); else d.icon = b.getAttribute('data-icon');
          haptic('selection'); refresh();
        });
        refresh();
        if (isNew) setTimeout(() => { try { nameIn.focus(); } catch (_) {} }, 420);
      },
    });
    if (s) sheetRef = s;
  }

  /* ───────────────────────── registration ───────────────────────── */
  function handleParams(params) {
    if (!params || !nav) return;
    let spec = null;
    if (params.smart && SMART[params.smart]) spec = { smart: params.smart };
    else if (params.list && lists.some((l) => l.id === params.list)) spec = { listId: params.list };
    else if (params.item) spec = { smart: 'today' };
    if (!spec) return;
    if (currentView && specKey(currentView.spec) === specKey(spec)) { renderList(currentView); return; }
    if (currentView) { nav.popToRoot(); setTimeout(() => openList(spec), 450); } else openList(spec);
  }

  OS.registerApp({
    id: 'reminders',
    name: 'Reminders',
    icon: {
      bg: 'linear-gradient(180deg,#FFFFFF,#F4F4F6)',
      glyph: `<svg viewBox="0 0 60 60">
        ${[['#007AFF', 16], ['#FF3B30', 30], ['#FF9500', 44]].map(([c, y]) => `<circle cx="14" cy="${y}" r="4.600" fill="none" stroke="${c}" stroke-width="1.300"/><circle cx="14" cy="${y}" r="2.900" fill="${c}"/><rect x="24" y="${y + 6.200}" width="36" height="1" fill="#D1D1D6"/>`).join('')}
      </svg>`,
    },
    system: true,
    statusBar: 'auto',
    background: 'var(--bg2)',
    launch(ctx) {
      ctxRef = ctx;
      const host = el('<div class="rem-host"></div>');
      ctx.root.appendChild(host);
      nav = OS.ui.createNav(host, { tabBarInset: false });
      nav.push({
        title: '', largeTitle: false, background: 'var(--bg2)',
        right: [{ icon: ICON.ellipsis, onTap(ev) { landingMenu(ev); } }],
        render(body, page) { buildLanding(body, page); },
        onShow() { currentView = null; renderLanding(); },
      });
    },
    onResume(ctx, params) {
      checkDue();
      if (!editingInside()) softRefresh();
      handleParams(params);
    },
    onPause() { const a = document.activeElement; if (a && ctxRef && ctxRef.root.contains(a) && a.blur) a.blur(); if (openRow) setOpen(openRow, 0, false); },
    onClose() { ctxRef = null; nav = null; landing = null; currentView = null; openRow = null; },
  });
})();
