// Window manager: app registry + lifecycle, open/close animations, home gesture, App Switcher, status bar, theme
(function () {
  const { el, esc, clamp } = OS.util;
  const $ = (id) => document.getElementById(id);
  const procs = new Map();     // id -> { def, win, root, ctx, statusBar }
  let recents = [];            // most recent first
  OS.activeApp = null;
  OS.procs = procs;

  // ───────── registry ─────────
  OS.registerApp = function (def) {
    if (!def || !def.id) return;
    const i = OS.apps.findIndex((a) => a.id === def.id);
    if (i >= 0) OS.apps[i] = def; else OS.apps.push(def);
    OS.emit('apps:change', def);
  };
  OS.unregisterApp = function (id) {
    OS.killApp(id);
    const i = OS.apps.findIndex((a) => a.id === id); if (i >= 0) OS.apps.splice(i, 1);
    OS.emit('apps:change');
  };
  OS.getApp = (id) => OS.apps.find((a) => a.id === id) || null;
  OS.isInstalled = (id) => !!OS.getApp(id) && !(OS.store.get('home.removed', []).includes(id));
  OS.iconHTML = function (def, extraClass = '') {
    const ic = (def && def.icon) || {};
    const g = ic.glyph == null ? (def ? (def.name || '?')[0] : '?') : String(ic.glyph);
    const inner = g.trim().startsWith('<') ? g : `<span>${esc(g)}</span>`;
    return `<div class="icon-img ${extraClass}" style="background:${ic.bg || '#8E8E93'};${ic.color ? 'color:' + ic.color : ''}">${inner}</div>`;
  };

  // ───────── status bar ─────────
  const SIGNAL = '<svg viewBox="0 0 19 12.5"><rect x="0" y="8" width="3.2" height="4.5" rx=".9"/><rect x="5.2" y="5.6" width="3.2" height="6.9" rx=".9"/><rect x="10.4" y="3" width="3.2" height="9.5" rx=".9"/><rect x="15.6" y="0" width="3.2" height="12.5" rx=".9"/></svg>';
  const WIFI = '<svg viewBox="0 0 17 12.5"><g fill="none" stroke="currentColor" stroke-width="2.1"><path d="M1.1 4.7a10.4 10.4 0 0 1 14.8 0"/><path d="M3.9 7.4a6.5 6.5 0 0 1 9.2 0"/></g><path d="M8.5 12.3l2.4-2.5a3.3 3.3 0 0 0-4.8 0z"/></svg>';
  const PLANE = '<svg viewBox="0 0 16 16"><path d="M8 .5c.7 0 1.200.9 1.200 2.200v3l6 3.700v1.500l-6-1.900v3.200l1.800 1.400V15L8 14.200 5 15v-1.400l1.800-1.400V9L.8 10.900V9.400l6-3.700v-3C6.800 1.400 7.300.5 8 .5z"/></svg>';
  let sbStyle = 'light';
  function renderStatusBar() {
    const sb = $('statusbar'); const s = OS.settings;
    const pct = Math.round(OS.power.level * 100);
    const cls = OS.power.charging ? 'charging' : pct <= 20 ? 'low' : s.get('lowPower') ? 'lpm' : '';
    let right = '';
    if (s.get('airplane')) right += PLANE + (s.get('wifi') ? WIFI : '');
    else right += (s.get('cellular') ? SIGNAL : '<span class="sb-net" style="font-size:12px">SOS</span>') + (s.get('wifi') ? WIFI : (s.get('cellular') ? '<span class="sb-net">5G</span>' : ''));
    sb.innerHTML = `<div class="sb-left"><span class="sb-time">${OS.util.time()}</span>${s.get('focus') ? '<svg viewBox="0 0 14 14"><path d="M9.8 1.200A6.300 6.300 0 1 0 12.900 9.700 5.200 5.200 0 0 1 9.800 1.200z"/></svg>' : ''}</div>
      <div class="sb-right">${right}<span class="sb-batt-wrap"><span class="sb-batt ${cls}"><i style="width:${pct}%"></i>${s.get('batteryPercent') ? `<b>${pct}</b>` : ''}</span></span></div>`;
  }
  OS.setStatusBarStyle = function (style) {           // 'light' | 'dark' | 'auto' | 'hidden'
    if (style === 'auto' || !style) style = OS.settings.get('darkMode') ? 'light' : 'dark';
    sbStyle = style;
    $('statusbar').classList.toggle('dark', style === 'dark'); $('statusbar').classList.toggle('hidden', style === 'hidden');
    $('homebar').classList.toggle('dark', style === 'dark');
  };
  function refreshChrome() {
    const p = OS.activeApp && procs.get(OS.activeApp);
    if (OS.lock && OS.lock.locked) return OS.setStatusBarStyle('light');
    if (p && !OS.switcherOpen) OS.setStatusBarStyle(p.statusBar || 'auto'); else OS.setStatusBarStyle('light');
  }
  OS.refreshChrome = refreshChrome;

  // ───────── power ─────────
  OS.power = { level: .87, charging: false, plugged: false, real: false };
  function initBattery() {
    if (!navigator.getBattery) return;
    navigator.getBattery().then((b) => {
      const sync = () => { OS.power.real = true; OS.power.level = b.level; OS.power.charging = b.charging || OS.power.plugged; renderStatusBar(); OS.emit('power'); };
      sync(); b.addEventListener('levelchange', sync); b.addEventListener('chargingchange', sync);
    }).catch(() => {});
  }
  OS.power.plug = function (on) {
    OS.power.plugged = on; const was = OS.power.charging; OS.power.charging = on || (OS.power._realCharging || false);
    renderStatusBar(); OS.emit('power');
    if (on && !was) { OS.sound.play('charge'); OS.haptic('medium'); OS.emit('power:connected'); }
  };

  // ───────── theme / brightness ─────────
  function applyTheme() {
    const dark = !!OS.settings.get('darkMode');
    $('screen').setAttribute('data-theme', dark ? 'dark' : 'light');
    refreshChrome(); OS.emit('themechange', dark ? 'dark' : 'light');
  }
  function applyBrightness() { $('dimmer').style.opacity = String((1 - OS.settings.get('brightness')) * .72); }
  function applyWallpaper() {
    const w = OS.settings.get('wallpaper') || 'aurora';
    document.querySelectorAll('#wallpaper, #lock .wp, #nc .wp').forEach((n) => {
      n.className = (n.id === 'wallpaper' ? '' : 'wp '); n.style.backgroundImage = '';
      if (w.startsWith('photo:')) { OS.photos.get(w.slice(6)).then((p) => { if (p) n.style.backgroundImage = `url(${p.src})`; else n.classList.add('wp-aurora'); }); }
      else n.classList.add('wp-' + w);
    });
  }
  OS.applyWallpaper = applyWallpaper;

  // ───────── app lifecycle ─────────
  function ensureProc(def) {
    let p = procs.get(def.id); if (p) return p;
    const win = el(`<div class="app-window" data-app="${esc(def.id)}"><div class="app-root app-${esc(def.id)}"></div><div class="launch-icon">${OS.iconHTML(def)}</div></div>`);
    $('apps').appendChild(win);
    const root = win.firstElementChild; if (def.background) root.style.background = def.background;
    p = { def, win, root, statusBar: def.statusBar || 'auto', launched: false };
    p.ctx = {
      root, app: def, params: null,
      setStatusBar(style) { p.statusBar = style; if (OS.activeApp === def.id) refreshChrome(); },
      close() { if (OS.activeApp === def.id) OS.goHome(); },
      isActive() { return OS.activeApp === def.id && !(OS.lock && OS.lock.locked); },
    };
    procs.set(def.id, p);
    return p;
  }
  const call = (p, name, ...a) => { try { p.def[name] && p.def[name](p.ctx, ...a); } catch (e) { console.error(`[${p.def.id}.${name}]`, e); } };

  function iconRect(id) {
    const page = OS.home && OS.home.visibleIcon ? OS.home.visibleIcon(id) : null;
    if (page) {
      const r = OS.util.rect(page);
      // Home is shrunk to .92 while an app covers it — measure where the icon sits once home is back to full size,
      // or the closing app lands short of its icon and snaps at the end.
      const hr = OS.util.rect($('home')), s = hr.w / OS.W;
      if (r.w > 0) return s > 0 && Math.abs(s - 1) > .001 ? { x: (r.x - hr.x) / s, y: (r.y - hr.y) / s, w: r.w / s, h: r.h / s } : r;
    }
    return { x: OS.W / 2 - 31, y: OS.H / 2 - 31, w: 62, h: 62 };
  }
  const rectTransform = (r) => `translate(${r.x}px, ${r.y}px) scale(${r.w / OS.W}, ${r.h / OS.H})`;
  const rectRadius = (r) => `${14.5 / (r.w / OS.W)}px / ${14.5 / (r.h / OS.H)}px`;

  let animToken = 0;
  OS.openApp = function (id, params, opts = {}) {
    const def = OS.getApp(id);
    if (!def) { console.warn('openApp: no such app', id); return false; }
    if (OS.lock && OS.lock.locked && !opts.overLock) { OS.lock.requestUnlock(() => OS.openApp(id, params, opts)); return true; }
    if (OS.power.off) return false;
    OS.overlays && OS.overlays.closeAll && OS.overlays.closeAll();
    OS.home && OS.home.endJiggle && OS.home.endJiggle();
    if (OS.switcherOpen) closeSwitcher(true);

    const p = ensureProc(def);
    p.ctx.params = params || null;
    const prev = OS.activeApp && OS.activeApp !== id ? procs.get(OS.activeApp) : null;
    if (OS.activeApp === id) { call(p, 'onResume', params || null); return true; }
    if (prev) { call(prev, 'onPause'); OS.keyboard && OS.keyboard.hide(true); }

    recents = [id, ...recents.filter((x) => x !== id)];
    OS.activeApp = id;
    if (!p.launched) { p.launched = true; call(p, 'launch'); }
    const token = ++animToken;
    const win = p.win; win.style.zIndex = String(10 + animToken);
    win.classList.remove('dragging');

    if (prev) {   // app → app: slide in from the right
      win.classList.add('active'); win.style.transition = 'none'; win.style.transform = `translateX(${OS.W}px)`; win.style.borderRadius = '58px';
      win.getBoundingClientRect(); win.style.transition = ''; win.classList.add('animating'); win.style.transform = 'none';
      prev.win.classList.add('animating'); prev.win.style.transform = `translateX(${-OS.W * .3}px) scale(.94)`;
      setTimeout(() => { if (token !== animToken) return; win.classList.remove('animating'); prev.win.classList.remove('animating', 'active'); prev.win.style.transform = ''; }, 520);
    } else {
      const r = opts.fromRect || iconRect(id);
      win.classList.add('active', 'as-icon'); win.style.transition = 'none';
      win.style.transform = rectTransform(r); win.style.borderRadius = rectRadius(r);
      win.getBoundingClientRect(); win.style.transition = '';
      win.classList.add('animating');
      requestAnimationFrame(() => { win.classList.remove('as-icon'); win.style.transform = 'none'; win.style.borderRadius = '58px'; });
      $('home').classList.add('behind');
      setTimeout(() => { if (token !== animToken) return; win.classList.remove('animating'); }, 520);
    }
    refreshChrome();
    call(p, 'onResume', params || null);
    OS.emit('appopen', id);
    return true;
  };

  OS.goHome = function (opts = {}) {
    OS.overlays && OS.overlays.closeAll && OS.overlays.closeAll();
    OS.keyboard && OS.keyboard.hide();
    if (OS.switcherOpen) closeSwitcher(true);
    const id = OS.activeApp; if (!id) { $('home').classList.remove('behind'); OS.home && OS.home.goFirstPageOrStay && opts.fromButton && OS.home.goFirstPageOrStay(); refreshChrome(); return; }
    const p = procs.get(id); OS.activeApp = null;
    call(p, 'onPause');
    const token = ++animToken; const win = p.win; const r = iconRect(id);
    win.classList.remove('dragging'); win.classList.add('animating'); win.getBoundingClientRect();
    win.style.transform = rectTransform(r); win.style.borderRadius = rectRadius(r);
    setTimeout(() => win.classList.add('as-icon'), 180);
    $('home').classList.remove('behind');
    setTimeout(() => { if (token !== animToken && OS.activeApp === id) return; win.classList.remove('animating', 'active', 'as-icon'); win.style.transform = ''; }, 500);
    refreshChrome(); OS.emit('appclose', id);
  };

  OS.killApp = function (id) {
    const p = procs.get(id); if (!p) return;
    if (OS.activeApp === id) { OS.activeApp = null; $('home').classList.remove('behind'); }
    if (p.launched) { call(p, 'onPause'); call(p, 'onClose'); }
    p.win.remove(); procs.delete(id); recents = recents.filter((x) => x !== id);
    OS.island && OS.island.endForApp && OS.island.endForApp(id);
    refreshChrome();
  };
  OS.pauseActive = function () { const p = OS.activeApp && procs.get(OS.activeApp); if (p) call(p, 'onPause'); };
  OS.resumeActive = function () { const p = OS.activeApp && procs.get(OS.activeApp); if (p) call(p, 'onResume', null); refreshChrome(); };
  OS.recents = () => recents.filter((id) => procs.has(id));

  OS.openURL = function (url) {
    url = String(url || '');
    let m;
    if ((m = /^tel:(.*)$/i.exec(url))) return OS.openApp('phone', { number: decodeURIComponent(m[1]) });
    if ((m = /^sms:([^?&]*)(?:[?&]body=(.*))?$/i.exec(url))) return OS.openApp('messages', { to: decodeURIComponent(m[1]), body: m[2] ? decodeURIComponent(m[2]) : '' });
    if ((m = /^mailto:([^?]*)(?:\?subject=(.*))?$/i.exec(url))) return OS.openApp('mail', { to: decodeURIComponent(m[1]), subject: m[2] ? decodeURIComponent(m[2]) : '' });
    if ((m = /^facetime:(.*)$/i.exec(url))) return OS.openApp('facetime', { to: decodeURIComponent(m[1]) });
    if ((m = /^maps:(.*)$/i.exec(url))) return OS.openApp('maps', { query: decodeURIComponent(m[1].replace(/^\?q=/, '')) });
    return OS.openApp('safari', { url });
  };

  // ───────── App Switcher ─────────
  OS.switcherOpen = false;
  const K = .68, CARD_W = OS.W * K, SPACING = 296, CARD_Y = 148;
  let swScroll = 0, swHeads = [];
  function cardX(i) { return (OS.W - CARD_W) / 2 - i * SPACING + swScroll; }
  function layoutSwitcher(animate) {
    const ids = OS.recents();
    ids.forEach((id, i) => {
      const p = procs.get(id), x = cardX(i);
      const depth = clamp((x - (OS.W - CARD_W) / 2) / SPACING, -2, 2);
      const s = K * (1 - Math.max(0, -depth) * .04);
      p.win.style.transition = animate ? '' : 'none';
      p.win.style.transform = `translate(${x + Math.max(0, -depth) * 40}px, ${CARD_Y + (K - s) * OS.H / 2}px) scale(${s})`;
      p.win.style.zIndex = String(100 - i);
      const h = swHeads[i]; if (h) { h.style.transition = animate ? 'transform .45s var(--ease), opacity .3s' : 'none'; h.style.transform = `translate(${x + Math.max(0, -depth) * 40 + 4}px, ${CARD_Y - 52}px)`; }
    });
  }
  function openSwitcher() {
    if (OS.lock && OS.lock.locked) return;
    OS.keyboard && OS.keyboard.hide(true);
    OS.overlays && OS.overlays.closeAll && OS.overlays.closeAll();
    const ids = OS.recents(); const sw = $('switcher');
    if (OS.activeApp) call(procs.get(OS.activeApp), 'onPause');
    OS.switcherOpen = true; sw.classList.add('on'); sw.innerHTML = ids.length ? '' : '<div class="sw-empty">No Recent Apps</div>';
    $('apps').classList.add('switching'); $('home').classList.add('behind');
    swScroll = 0;
    swHeads = ids.map((id) => { const d = procs.get(id).def; const h = el(`<div class="sw-head" style="position:absolute;left:0;top:0">${OS.iconHTML(d)}<span>${esc(d.name)}</span></div>`); h.style.fontSize = '17px'; sw.appendChild(h); return h; });
    ids.forEach((id) => { const w = procs.get(id).win; w.classList.add('active', 'card', 'animating'); w.classList.remove('dragging', 'as-icon'); w.style.borderRadius = '58px'; });
    requestAnimationFrame(() => layoutSwitcher(true));
    setTimeout(() => ids.forEach((id) => procs.get(id) && procs.get(id).win.classList.remove('animating')), 480);
    OS.haptic('light'); OS.setStatusBarStyle('hidden');
  }
  function closeSwitcher(silent) {
    if (!OS.switcherOpen) return;
    OS.switcherOpen = false; $('switcher').classList.remove('on'); $('switcher').innerHTML = ''; $('apps').classList.remove('switching');
    procs.forEach((p, id) => { p.win.classList.remove('card'); p.win.style.transition = ''; p.win.style.zIndex = ''; if (id !== OS.activeApp) { p.win.classList.remove('active'); p.win.style.transform = ''; } });
    if (!silent) refreshChrome();
  }
  function switcherSelect(id) {
    const p = procs.get(id); if (!p) return;
    const wasActive = OS.activeApp === id;
    OS.switcherOpen = false; $('switcher').classList.remove('on'); $('switcher').innerHTML = ''; $('apps').classList.remove('switching');
    procs.forEach((q, qid) => { q.win.classList.remove('card'); q.win.style.transition = ''; if (qid !== id) { q.win.classList.remove('active'); q.win.style.transform = ''; q.win.style.zIndex = ''; } });
    const prevActive = OS.activeApp; OS.activeApp = id; recents = [id, ...recents.filter((x) => x !== id)];
    const token = ++animToken; p.win.style.zIndex = String(10 + animToken);
    p.win.classList.add('animating'); p.win.getBoundingClientRect(); p.win.style.transform = 'none';
    setTimeout(() => { if (token === animToken) p.win.classList.remove('animating'); }, 500);
    $('home').classList.add('behind');
    if (prevActive && !wasActive) { /* previous app was already paused when the switcher opened */ }
    call(p, 'onResume', null); refreshChrome(); OS.emit('appopen', id);
  }
  function switcherToHome() {
    const was = OS.activeApp; closeSwitcher(true);
    if (was) { const p = procs.get(was); OS.activeApp = null; if (p) { p.win.classList.remove('active'); p.win.style.transform = ''; } OS.emit('appclose', was); }
    $('home').classList.remove('behind'); refreshChrome();
  }
  OS.openSwitcher = openSwitcher; OS.closeSwitcher = switcherToHome;

  function initSwitcherGestures() {
    const apps = $('apps');
    // drag on cards: horizontal = scroll, vertical up = kill
    let mode = null, dragId = null, startScroll = 0;
    OS.util.drag(apps, {
      threshold: 5,
      filter: (e) => OS.switcherOpen && !!e.target.closest('.app-window.card'),
      onStart(p, e) { const w = e.target.closest('.app-window.card'); dragId = w.dataset.app; mode = Math.abs(p.dy) > Math.abs(p.dx) && p.dy < 0 ? 'kill' : 'scroll'; startScroll = swScroll; },
      onMove(p) {
        if (mode === 'scroll') { const n = OS.recents().length; swScroll = clamp(startScroll + p.dx, -40, (n - 1) * SPACING + 40); layoutSwitcher(false); }
        else { const w = procs.get(dragId).win; const i = OS.recents().indexOf(dragId); w.style.transition = 'none'; w.style.transform = `translate(${cardX(i)}px, ${CARD_Y + Math.min(30, p.dy)}px) scale(${K})`; if (swHeads[i]) swHeads[i].style.opacity = String(clamp(1 + p.dy / 200, 0, 1)); }
      },
      onEnd(p) {
        if (mode === 'scroll') { const n = OS.recents().length; swScroll = clamp(Math.round((swScroll + p.vx * 220) / SPACING) * SPACING, 0, Math.max(0, (n - 1) * SPACING)); layoutSwitcher(true); }
        else if (p.dy < -160 || p.vy < -.7) {
          const pr = procs.get(dragId), i = OS.recents().indexOf(dragId); pr.win.style.transition = 'transform .3s ease-in, opacity .3s'; pr.win.style.transform = `translate(${cardX(i)}px, -700px) scale(${K})`;
          OS.haptic('light'); const id = dragId;
          setTimeout(() => { OS.killApp(id); if (!OS.switcherOpen) return; const ids = OS.recents(); if (!ids.length) return switcherToHome(); $('switcher').innerHTML = ''; swHeads = ids.map((x) => { const d = procs.get(x).def; const h = el(`<div class="sw-head" style="position:absolute;left:0;top:0;font-size:17px">${OS.iconHTML(d)}<span>${esc(d.name)}</span></div>`); $('switcher').appendChild(h); return h; }); swScroll = clamp(swScroll, 0, (ids.length - 1) * SPACING); layoutSwitcher(true); }, 260);
        } else layoutSwitcher(true);
        mode = null;
      },
    });
    apps.addEventListener('click', (e) => { if (!OS.switcherOpen) return; const w = e.target.closest('.app-window.card'); if (w) { e.stopPropagation(); e.preventDefault(); switcherSelect(w.dataset.app); } }, true);
    $('switcher').addEventListener('click', (e) => { if (e.target === $('switcher') || e.target.classList.contains('sw-empty')) switcherToHome(); });
  }

  // ───────── the home-indicator gesture ─────────
  function initHomeGesture() {
    let mode = null, p0 = null, pauseTimer = 0, paused = false, lastMoveT = 0;
    OS.util.drag($('homebar'), {
      threshold: 4,
      onTap() { const b = $('homebar').firstElementChild; b.animate([{ transform: 'translateY(0)' }, { transform: 'translateY(-7px)' }, { transform: 'translateY(0)' }], { duration: 380, easing: 'ease-out' }); },
      onStart(p) {
        paused = false;
        if (OS.power.off) return false;
        if (OS.lock && OS.lock.locked) { mode = 'lock'; OS.lock.dragStart(); return; }
        if (OS.overlays && OS.overlays.anyOpen()) { mode = 'overlay'; return; }
        if (OS.siri && OS.siri.active) { mode = 'overlay'; return; }
        if (OS.switcherOpen) { mode = 'switcher'; return; }
        if (OS.activeApp) { mode = 'app'; p0 = procs.get(OS.activeApp); p0.win.classList.add('dragging'); OS.keyboard && OS.keyboard.hide(); return; }
        mode = 'home';
      },
      onMove(p) {
        const up = Math.max(0, -p.dy);
        if (mode === 'lock') return OS.lock.dragMove(up);
        if (mode === 'app') {
          const s = clamp(1 - up / 760, .32, 1); const w = p0.win;
          const x = (OS.W - OS.W * s) / 2 + p.dx * .85, y = (OS.H - OS.H * s) - up * .55;
          w.style.transform = `translate(${x}px, ${y}px) scale(${s})`; w.style.borderRadius = '58px';
          $('home').classList.toggle('behind', up < 40);
        }
        if (mode === 'app' || mode === 'home') {
          lastMoveT = performance.now(); clearTimeout(pauseTimer);
          if (up > 70 && !paused) pauseTimer = setTimeout(() => { if (Math.abs(p.vy) < .08) { paused = true; OS.haptic('light'); } }, 170);
          if (paused && Math.hypot(p.vx, p.vy) > .5) paused = false;
        }
      },
      onEnd(p) {
        clearTimeout(pauseTimer);
        const up = Math.max(0, -p.dy), flick = p.vy < -.45;
        if (mode === 'lock') return OS.lock.dragEnd(up, flick);
        if (mode === 'overlay') { if (up > 30 || flick) { OS.overlays.closeAll(); OS.siri && OS.siri.close(); } return; }
        if (mode === 'switcher') { if (up > 30 || flick) switcherToHome(); return; }
        if (mode === 'app') {
          const w = p0.win; w.classList.remove('dragging');
          if (Math.abs(p.dx) > 90 && up < 70) {   // sideways flick: previous app
            const ids = OS.recents(); const other = ids[1];
            w.classList.add('animating'); w.style.transform = 'none'; setTimeout(() => w.classList.remove('animating'), 400);
            if (other) return void OS.openApp(other);
            return;
          }
          if (paused || (up > 90 && !flick && performance.now() - lastMoveT > 140)) { w.classList.add('animating'); return openSwitcher(); }
          if (up > 110 || flick) return OS.goHome();
          w.classList.add('animating'); w.style.transform = 'none'; $('home').classList.add('behind'); setTimeout(() => w.classList.remove('animating'), 500);
          return;
        }
        if (mode === 'home') {
          if (paused || (up > 90 && !flick)) return openSwitcher();
          if (up > 20 || flick) { OS.home && OS.home.endJiggle(); OS.home && OS.home.goFirstPageOrStay(); }
        }
      },
    });
  }

  // ───────── badges / AI / now playing ─────────
  OS.badge = function (appId, n) { const b = OS.store.get('badges', {}); if (n) b[appId] = n; else delete b[appId]; OS.store.set('badges', b); OS.emit('badge', appId, n); };
  OS.badges = () => OS.store.get('badges', {});

  OS.ai = function (prompt, opts = {}) {
    return new Promise((resolve, reject) => {
      const ctl = new AbortController(); let text = '', finished = false;
      const timer = setTimeout(() => { ctl.abort(); if (!finished) reject(new Error('timeout')); }, opts.timeout || 120000);
      fetch('/api/ai', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ prompt, system: opts.system || '', fast: opts.fast !== false }), signal: ctl.signal })
        .then(async (res) => {
          if (!res.ok || !res.body) throw new Error('AI unavailable');
          const reader = res.body.getReader(); const dec = new TextDecoder(); let buf = '', err = null;
          for (;;) {
            const { done, value } = await reader.read(); if (done) break;
            buf += dec.decode(value, { stream: true }); const parts = buf.split('\n\n'); buf = parts.pop();
            for (const part of parts) {
              const line = part.split('\n').find((l) => l.startsWith('data: ')); if (!line) continue;
              let o; try { o = JSON.parse(line.slice(6)); } catch { continue; }
              if (o.t) { text += o.t; opts.onText && opts.onText(text); }
              if (o.error) err = o.error;
            }
          }
          finished = true; clearTimeout(timer);
          if (text.trim()) resolve(text.trim()); else reject(new Error(err || 'No answer'));
        }).catch((e) => { finished = true; clearTimeout(timer); reject(e); });
      if (opts.signal) opts.signal.addEventListener('abort', () => ctl.abort());
    });
  };

  let np = null;
  OS.nowPlaying = {
    get current() { return np; },
    set(info) { np = { ...(np || {}), ...info }; OS.emit('nowplaying', np); },
    clear() { np = null; OS.emit('nowplaying', null); },
  };

  // ───────── boot-time wiring ─────────
  OS.initCore = function () {
    applyTheme(); applyBrightness(); applyWallpaper(); renderStatusBar(); initBattery(); initHomeGesture(); initSwitcherGestures();
    OS.on('setting:darkMode', applyTheme); OS.on('setting:brightness', applyBrightness); OS.on('setting:wallpaper', applyWallpaper);
    ['airplane', 'wifi', 'cellular', 'focus', 'use24h', 'lowPower', 'batteryPercent'].forEach((k) => OS.on('setting:' + k, renderStatusBar));
    OS.on('setting:airplane', (on) => { if (on) { OS.settings.set('cellular', false); } else OS.settings.set('cellular', true); });
    let lastMin = new Date().getMinutes();
    setInterval(() => {
      const m = new Date().getMinutes();
      if (m !== lastMin) { lastMin = m; renderStatusBar(); OS.emit('minute', new Date()); }
      if (!OS.power.real && !OS.power.charging && Math.random() < .0008) { OS.power.level = Math.max(.05, OS.power.level - .01); renderStatusBar(); }
      if (!OS.power.real && OS.power.charging && Math.random() < .02) { OS.power.level = Math.min(1, OS.power.level + .01); renderStatusBar(); }
    }, 1000);
    OS.on('power', renderStatusBar);
    const st = document.createElement('style');
    st.textContent = '#apps.switching{z-index:31;pointer-events:auto}#apps.switching .app-window.card{display:block;cursor:pointer;box-shadow:0 14px 60px rgba(0,0,0,.5);transition:transform .45s var(--ease),opacity .3s}#apps.switching .app-window.card > *{pointer-events:none}';
    document.head.appendChild(st);
  };
})();
