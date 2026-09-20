// Notifications (banner / Notification Center / Lock Screen), Control Center, volume HUD, silent switch,
// screenshots, power-off slider, Spotlight.
(function () {
  const { el, esc, clamp } = OS.util;
  const $ = (id) => document.getElementById(id);

  const I = OS.icons = {
    airplane: '<svg viewBox="0 0 24 24"><path d="M12 2c1 0 1.700 1.300 1.700 3.200v4.300l8.300 5v2.200l-8.300-2.600v4.400l2.500 1.900V22L12 20.900 7.800 22v-1.600l2.500-1.900v-4.400L2 16.700v-2.200l8.300-5V5.200C10.300 3.300 11 2 12 2z"/></svg>',
    cellular: '<svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="2.200"/><path d="M7.400 16.600a6.500 6.500 0 0 1 0-9.200M16.600 7.400a6.500 6.500 0 0 1 0 9.200M4.600 19.400a10.500 10.500 0 0 1 0-14.800M19.400 4.600a10.500 10.500 0 0 1 0 14.800" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"/></svg>',
    wifi: '<svg viewBox="0 0 24 24"><g fill="none" stroke="currentColor" stroke-width="2.400" stroke-linecap="round"><path d="M2.800 9.300a13.300 13.300 0 0 1 18.400 0"/><path d="M6.300 13a8.300 8.300 0 0 1 11.400 0"/></g><circle cx="12" cy="17.500" r="2"/></svg>',
    bluetooth: '<svg viewBox="0 0 24 24"><path d="M7 7.500l10 9-5 4.500V3l5 4.500-10 9" fill="none" stroke="currentColor" stroke-width="2.200" stroke-linecap="round" stroke-linejoin="round"/></svg>',
    play: '<svg viewBox="0 0 24 24"><path d="M7 4.500v15a1 1 0 0 0 1.500.860l12.500-7.500a1 1 0 0 0 0-1.720L8.500 3.640A1 1 0 0 0 7 4.500z"/></svg>',
    pause: '<svg viewBox="0 0 24 24"><rect x="5.500" y="4" width="4.500" height="16" rx="1.300"/><rect x="14" y="4" width="4.500" height="16" rx="1.300"/></svg>',
    next: '<svg viewBox="0 0 24 24"><path d="M2.500 6.300v11.400a.8.8 0 0 0 1.240.670L12 13v4.700a.8.8 0 0 0 1.240.670l8.400-5.700a.8.8 0 0 0 0-1.340l-8.400-5.700A.8.8 0 0 0 12 6.300V11L3.740 5.630a.8.8 0 0 0-1.240.670z"/></svg>',
    prev: '<svg viewBox="0 0 24 24"><g transform="translate(24 0) scale(-1 1)"><path d="M2.500 6.300v11.400a.8.8 0 0 0 1.240.670L12 13v4.700a.8.8 0 0 0 1.240.670l8.400-5.700a.8.8 0 0 0 0-1.340l-8.400-5.700A.8.8 0 0 0 12 6.300V11L3.740 5.630a.8.8 0 0 0-1.240.670z"/></g></svg>',
    rotlock: '<svg viewBox="0 0 24 24"><path d="M20 12a8 8 0 1 1-3-6.240" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"/><path d="M17.500 2v4.500H13" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/><rect x="8.500" y="11" width="7" height="5.500" rx="1.200"/><path d="M10 11V9.500a2 2 0 0 1 4 0V11" fill="none" stroke="currentColor" stroke-width="1.600"/></svg>',
    moon: '<svg viewBox="0 0 24 24"><path d="M14.500 3a9.500 9.500 0 1 0 6.800 14.300A8 8 0 0 1 14.500 3z"/></svg>',
    sun: '<svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="4.300"/><g stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M12 2.500v2.300M12 19.200v2.300M2.500 12h2.300M19.200 12h2.300M5.300 5.300l1.600 1.600M17.100 17.100l1.600 1.600M5.300 18.700l1.600-1.600M17.100 6.900l1.600-1.600"/></g></svg>',
    speaker: '<svg viewBox="0 0 24 24"><path d="M3 9.500v5a1 1 0 0 0 1 1h3l4.400 3.700a.8.8 0 0 0 1.300-.600V5.400a.8.8 0 0 0-1.300-.600L7 8.500H4a1 1 0 0 0-1 1z"/><path d="M15.500 8.500a5 5 0 0 1 0 7M18 5.500a9 9 0 0 1 0 13" fill="none" stroke="currentColor" stroke-width="1.900" stroke-linecap="round"/></svg>',
    mute: '<svg viewBox="0 0 24 24"><path d="M3 9.500v5a1 1 0 0 0 1 1h3l4.400 3.700a.8.8 0 0 0 1.300-.600V5.400a.8.8 0 0 0-1.300-.600L7 8.500H4a1 1 0 0 0-1 1z"/><path d="M16 9.500l5 5m0-5l-5 5" stroke="currentColor" stroke-width="1.900" stroke-linecap="round"/></svg>',
    flashlight: '<svg viewBox="0 0 24 24"><path d="M8 2.500h8v3.200l-1.800 3V20a1.500 1.500 0 0 1-1.500 1.500h-1.400A1.500 1.500 0 0 1 9.800 20V8.700L8 5.700z"/><circle cx="12" cy="12.500" r="1.200" fill="#000" opacity=".45"/></svg>',
    timer: '<svg viewBox="0 0 24 24"><circle cx="12" cy="13.500" r="8" fill="none" stroke="currentColor" stroke-width="2"/><path d="M12 13.500V8.500M9.500 2.500h5M12 2.500v3" stroke="currentColor" stroke-width="2" stroke-linecap="round" fill="none"/></svg>',
    calculator: '<svg viewBox="0 0 24 24"><rect x="4.500" y="2.500" width="15" height="19" rx="3" fill="none" stroke="currentColor" stroke-width="2"/><rect x="7.500" y="5.500" width="9" height="3.500" rx="1"/><g><circle cx="8.700" cy="12.700" r="1.150"/><circle cx="12" cy="12.700" r="1.150"/><circle cx="15.300" cy="12.700" r="1.150"/><circle cx="8.700" cy="16.700" r="1.150"/><circle cx="12" cy="16.700" r="1.150"/><circle cx="15.300" cy="16.700" r="1.150"/></g></svg>',
    camera: '<svg viewBox="0 0 24 24"><path d="M8.300 5l1-1.700A1.500 1.500 0 0 1 10.600 2.500h2.800a1.500 1.500 0 0 1 1.300.800l1 1.700h2.800A2.500 2.500 0 0 1 21 7.500v10a2.500 2.500 0 0 1-2.500 2.500h-13A2.500 2.500 0 0 1 3 17.500v-10A2.500 2.500 0 0 1 5.500 5zM12 8.300a4.200 4.200 0 1 0 0 8.400 4.200 4.200 0 0 0 0-8.400z" fill-rule="evenodd"/></svg>',
    bell: '<svg viewBox="0 0 24 24"><path d="M12 2.500a6.500 6.500 0 0 0-6.500 6.500v3.600L3.700 16a1 1 0 0 0 .9 1.500h14.800a1 1 0 0 0 .9-1.500l-1.800-3.400V9A6.500 6.500 0 0 0 12 2.500zM9.500 19a2.500 2.500 0 0 0 5 0z"/></svg>',
    bellSlash: '<svg viewBox="0 0 24 24"><path d="M12 2.500a6.500 6.500 0 0 0-6.500 6.500v3.600L3.700 16a1 1 0 0 0 .9 1.500h14.800a1 1 0 0 0 .9-1.500l-1.800-3.400V9A6.500 6.500 0 0 0 12 2.500zM9.500 19a2.500 2.500 0 0 0 5 0z" opacity=".55"/><path d="M3.500 3.500l17 17" stroke="currentColor" stroke-width="2.200" stroke-linecap="round"/></svg>',
    battery: '<svg viewBox="0 0 24 24"><rect x="2" y="7.500" width="17.500" height="9" rx="2.500" fill="none" stroke="currentColor" stroke-width="1.800"/><rect x="4" y="9.500" width="8" height="5" rx="1"/><path d="M21.200 10.500v3" stroke="currentColor" stroke-width="2" stroke-linecap="round"/></svg>',
    screenshot: '<svg viewBox="0 0 24 24"><path d="M3.500 8V5.500a2 2 0 0 1 2-2H8M16 3.500h2.500a2 2 0 0 1 2 2V8M20.500 16v2.500a2 2 0 0 1-2 2H16M8 20.500H5.500a2 2 0 0 1-2-2V16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"/><circle cx="12" cy="12" r="3"/></svg>',
    darkmode: '<svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="8.500" fill="none" stroke="currentColor" stroke-width="2"/><path d="M12 3.500a8.500 8.500 0 0 1 0 17z"/></svg>',
    alarm: '<svg viewBox="0 0 24 24"><circle cx="12" cy="13" r="7.500" fill="none" stroke="currentColor" stroke-width="2"/><path d="M12 9v4.300l2.600 1.600M4 5.500l3-2.500M20 5.500l-3-2.500" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"/></svg>',
    search: '<svg viewBox="0 0 24 24"><circle cx="10.500" cy="10.500" r="6.500"/><path d="M15.500 15.500l5 5" stroke-linecap="round"/></svg>',
    music: '<svg viewBox="0 0 24 24"><path d="M9 17.500V6.200a1 1 0 0 1 .8-1l8-1.700a1 1 0 0 1 1.200 1v11" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"/><ellipse cx="6.500" cy="17.800" rx="3" ry="2.400"/><ellipse cx="16.500" cy="15.800" rx="3" ry="2.400"/></svg>',
    faceid: '<svg viewBox="0 0 74 74" fill="none" stroke="currentColor" stroke-width="4" stroke-linecap="round"><path d="M4 22V14A10 10 0 0 1 14 4h8M52 4h8a10 10 0 0 1 10 10v8M70 52v8a10 10 0 0 1-10 10h-8M22 70h-8A10 10 0 0 1 4 60v-8"/><path d="M25 27v7M49 27v7M38 27v13a3 3 0 0 1-3 3h-1M25 50c3.500 3.300 8 5 12.500 5S46 53.300 49 50"/></svg>',
    check: '<svg viewBox="0 0 74 74" fill="none" stroke="currentColor" stroke-width="5" stroke-linecap="round" stroke-linejoin="round"><circle cx="37" cy="37" r="30"/><path d="M23 38l10 10 19-21"/></svg>',
  };

  // ═════════════ notifications ═════════════
  OS.notifications = [];
  let bannerTimer = 0, bannerEl = null;
  function notifNode(n) {
    const def = OS.getApp(n.appId);
    const node = el(`<div class="notif">${OS.iconHTML(def || { name: '!', icon: { bg: '#8E8E93', glyph: '•' } })}<div class="notif-main"><div class="notif-top"><div class="notif-title">${esc(n.title || (def && def.name) || '')}</div><div class="notif-time">${Date.now() - n.time < 60000 ? 'now' : OS.util.relDate(n.time)}</div></div><div class="notif-body">${esc(n.body || '')}</div></div></div>`);
    node.addEventListener('click', () => tapNotif(n));
    return node;
  }
  function tapNotif(n) {
    dismissBanner(); removeNotif(n.id);
    const go = () => { closeNC(); if (n.onTap) { if (n.appId && OS.getApp(n.appId) && OS.activeApp !== n.appId) OS.openApp(n.appId); try { n.onTap(); } catch (e) { console.error(e); } } else if (n.appId && OS.getApp(n.appId)) OS.openApp(n.appId); };
    if (OS.lock.locked) OS.lock.requestUnlock(go); else go();
  }
  function removeNotif(id) { const i = OS.notifications.findIndex((x) => x.id === id); if (i >= 0) OS.notifications.splice(i, 1); renderLists(); }
  function renderLists() {
    const ln = document.querySelector('#lock .lock-notifs'); if (ln) { ln.innerHTML = ''; OS.notifications.slice(-4).reverse().forEach((n) => ln.appendChild(notifNode(n))); }
    const list = document.querySelector('#nc .nc-items'); if (list) { list.innerHTML = ''; if (!OS.notifications.length) list.innerHTML = '<div class="nc-empty">No Older Notifications</div>'; OS.notifications.slice().reverse().forEach((n) => list.appendChild(notifNode(n))); }
    const cl = document.querySelector('#nc .nc-head'); if (cl) cl.style.visibility = OS.notifications.length ? '' : 'hidden';
  }
  function dismissBanner() { clearTimeout(bannerTimer); if (bannerEl) { const b = bannerEl; bannerEl = null; b.classList.remove('in'); setTimeout(() => b.remove(), 500); } }
  OS.notify = function (n = {}) {
    n = { id: OS.util.uid(), time: Date.now(), sound: true, ...n };
    OS.notifications.push(n); if (OS.notifications.length > 40) OS.notifications.shift();
    renderLists();
    if (OS.power.off) return n.id;
    const dnd = OS.settings.get('focus');
    if (!dnd) {
      if (n.sound) OS.sound.play(typeof n.sound === 'string' ? n.sound : OS.sound.alertTone(), { category: 'ringer' });
      OS.haptic('medium');
    }
    if (OS.lock.locked || OS.lock.asleep) { if (!dnd) OS.lock.wake(true); return n.id; }
    if (dnd) return n.id;
    dismissBanner();
    const b = notifNode(n); bannerEl = b; $('banners').appendChild(b); b.getBoundingClientRect(); requestAnimationFrame(() => b.classList.add('in'));
    OS.util.drag(b, { axis: 'y', onStart() { b.classList.add('dragging'); clearTimeout(bannerTimer); }, onMove(p) { b.style.transform = `translateY(${Math.min(20, p.dy)}px)`; }, onEnd(p) { b.classList.remove('dragging'); b.style.transform = ''; if (p.dy < -20) dismissBanner(); else bannerTimer = setTimeout(dismissBanner, 3000); } });
    bannerTimer = setTimeout(dismissBanner, 5000);
    return n.id;
  };
  OS.clearNotifications = function (appId) { OS.notifications = appId ? OS.notifications.filter((n) => n.appId !== appId) : []; renderLists(); };

  // ── Notification Center (cover sheet) ──
  let ncOpen = false;
  function buildNC() {
    const nc = $('nc');
    nc.innerHTML = `<div class="wp"></div><div class="nc-blur"></div><div class="lock-date"></div><div class="lock-time"></div>
      <div class="nc-list ios-scroll"><div class="nc-head"><span>Notification Center</span><div class="nc-clear">✕</div></div><div class="nc-items" style="display:flex;flex-direction:column;gap:8px"></div></div>`;
    nc.querySelector('.nc-clear').addEventListener('click', () => { OS.clearNotifications(); OS.haptic('light'); });
    nc.addEventListener('click', (e) => { if (e.target.classList.contains('nc-blur') || e.target.classList.contains('nc-list')) closeNC(); });
    OS.applyWallpaper();
  }
  function tickNC() { const nc = $('nc'); const d = new Date(); nc.querySelector('.lock-time').textContent = OS.util.time(d); nc.querySelector('.lock-date').textContent = d.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' }); }
  function openNC() { const nc = $('nc'); ncOpen = true; nc.classList.add('on', 'anim'); tickNC(); renderLists(); requestAnimationFrame(() => nc.classList.add('open')); nc.style.transform = ''; OS.setStatusBarStyle('light'); OS.keyboard.hide(true); }
  function closeNC() { if (!ncOpen) return; ncOpen = false; const nc = $('nc'); nc.classList.add('anim'); nc.classList.remove('open'); nc.style.transform = ''; setTimeout(() => { if (!ncOpen) nc.classList.remove('on'); }, 500); OS.refreshChrome(); }

  // ═════════════ Control Center ═════════════
  let ccOpen = false, flashlight = false;
  OS.flashlight = { get on() { return flashlight; }, set(v) { flashlight = !!v; document.querySelectorAll('.flashled').forEach((n) => n.classList.toggle('on', flashlight)); OS.emit('flashlight', flashlight); syncCC(); } };
  function buildCC() {
    const cc = $('cc');
    cc.innerHTML = `<div class="cc-blur"></div><div class="cc-top"><span class="cc-carrier"></span><span class="cc-battery"></span></div><div class="cc-body"><div class="cc-grid">
      <div class="cc-mod cc-conn"><div class="cc-mod orange" data-set="airplane">${I.airplane}</div><div class="cc-mod green" data-set="cellular">${I.cellular}</div><div class="cc-mod blue" data-set="wifi">${I.wifi}</div><div class="cc-mod blue" data-set="bluetooth">${I.bluetooth}</div></div>
      <div class="cc-mod cc-np idle"><div class="cc-np-top"><div class="cc-np-art">${I.music}</div><div style="min-width:0"><div class="cc-np-t">Not Playing</div><div class="cc-np-a"></div></div></div><div class="cc-np-ctl"><span data-np="prev">${I.prev}</span><span data-np="toggle" class="np-toggle">${I.play}</span><span data-np="next">${I.next}</span></div></div>
      <div class="cc-mod" data-set="rotationLock">${I.rotlock}</div><div class="cc-mod" data-set="darkMode">${I.darkmode}</div><div class="cc-mod cc-wide purple" data-set="focus">${I.moon}<span>Focus</span></div>
      <div class="cc-mod cc-slider" data-slide="brightness"><i></i>${I.sun}</div><div class="cc-mod cc-slider" data-slide="volume"><i></i>${I.speaker}</div>
      <div class="cc-mod" data-act="flashlight">${I.flashlight}</div><div class="cc-mod" data-act="timer">${I.timer}</div><div class="cc-mod" data-act="calculator">${I.calculator}</div><div class="cc-mod" data-act="camera">${I.camera}</div>
      <div class="cc-mod" data-set="silent">${I.bellSlash}</div><div class="cc-mod" data-set="lowPower" style="--on:#FFCC00">${I.battery}</div><div class="cc-mod" data-act="screenshot">${I.screenshot}</div><div class="cc-mod" data-act="alarm">${I.alarm}</div>
    </div></div>`;
    cc.querySelector('.cc-blur').addEventListener('click', closeCC);
    cc.querySelector('.cc-body').addEventListener('click', (e) => { if (e.target.classList.contains('cc-body') || e.target.classList.contains('cc-grid')) closeCC(); });
    cc.querySelectorAll('[data-set]').forEach((m) => m.addEventListener('click', (e) => { e.stopPropagation(); const k = m.dataset.set; OS.settings.set(k, !OS.settings.get(k)); OS.haptic('light'); syncCC(); }));
    cc.querySelectorAll('[data-act]').forEach((m) => m.addEventListener('click', () => {
      const a = m.dataset.act; OS.haptic('light');
      if (a === 'flashlight') return OS.flashlight.set(!flashlight);
      closeCC();
      if (a === 'screenshot') return setTimeout(() => OS.screenshot(), 450);
      if (a === 'timer' || a === 'alarm') return OS.openApp('clock', { tab: a === 'timer' ? 'timers' : 'alarms' });
      OS.openApp(a);
    }));
    cc.querySelectorAll('[data-np]').forEach((b) => b.addEventListener('click', (e) => { e.stopPropagation(); const np = OS.nowPlaying.current; const a = b.dataset.np; OS.haptic('light'); if (!np) { if (a === 'toggle') { closeCC(); OS.openApp('music'); } return; } const fn = a === 'toggle' ? np.onToggle : a === 'next' ? np.onNext : np.onPrev; fn && fn(); }));
    cc.querySelector('.cc-np-top').addEventListener('click', () => { const np = OS.nowPlaying.current; closeCC(); OS.openApp((np && np.appId) || 'music'); });
    cc.querySelectorAll('[data-slide]').forEach((s) => {
      const key = s.dataset.slide; let startV = 0;
      OS.util.drag(s, { threshold: 1, onStart() { startV = OS.settings.get(key); }, onMove(p) { const v = clamp(startV - p.dy / 150, key === 'brightness' ? .08 : 0, 1); OS.settings.set(key, Math.round(v * 100) / 100); syncCC(); } });
    });
    OS.on('nowplaying', syncCC); OS.on('setting', syncCC); OS.on('power', syncCC);
  }
  function syncCC() {
    const cc = $('cc'); if (!cc.firstChild) return; const s = OS.settings;
    cc.querySelectorAll('[data-set]').forEach((m) => m.classList.toggle('on', !!s.get(m.dataset.set)));
    const lp = cc.querySelector('[data-set="lowPower"]'); if (lp.classList.contains('on')) { lp.style.background = '#FFCC00'; lp.style.color = '#000'; } else { lp.style.background = ''; lp.style.color = ''; }
    const si = cc.querySelector('[data-set="silent"]'); si.innerHTML = s.get('silent') ? I.bellSlash : I.bell; if (s.get('silent')) { si.style.background = '#FF3B30'; si.style.color = '#fff'; } else { si.style.background = ''; si.style.color = ''; }
    cc.querySelector('[data-act="flashlight"]').classList.toggle('on', flashlight);
    cc.querySelector('[data-slide="brightness"]').style.setProperty('--v', s.get('brightness') * 100 + '%');
    const vs = cc.querySelector('[data-slide="volume"]'); vs.style.setProperty('--v', s.get('volume') * 100 + '%');
    const np = OS.nowPlaying.current, box = cc.querySelector('.cc-np');
    box.classList.toggle('idle', !np);
    cc.querySelector('.cc-np-t').textContent = np ? np.title || '' : 'Not Playing'; cc.querySelector('.cc-np-a').textContent = np ? np.artist || '' : '';
    const art = cc.querySelector('.cc-np-art'); if (np && np.artwork) { art.style.background = np.artwork; art.style.backgroundSize = 'cover'; art.innerHTML = ''; } else { art.style.background = ''; art.innerHTML = I.music; }
    cc.querySelector('.np-toggle').innerHTML = np && np.playing ? I.pause : I.play;
    cc.querySelector('.cc-carrier').textContent = s.get('airplane') ? 'Airplane Mode' : s.get('cellular') ? 'Fable Mobile 5G' : 'No Service';
    cc.querySelector('.cc-battery').textContent = Math.round(OS.power.level * 100) + '%' + (OS.power.charging ? ' ⚡' : '');
  }
  function setCCProgress(p, anim) { const cc = $('cc'); cc.classList.toggle('anim', !!anim); cc.style.setProperty('--p', String(p)); }
  function openCC() { if (OS.power.off) return; const cc = $('cc'); ccOpen = true; cc.classList.add('on'); syncCC(); cc.getBoundingClientRect(); setCCProgress(1, true); OS.keyboard.hide(true); }
  function closeCC() { if (!ccOpen && !$('cc').classList.contains('on')) return; ccOpen = false; setCCProgress(0, true); setTimeout(() => { if (!ccOpen) $('cc').classList.remove('on'); }, 420); }

  // ═════════════ volume + silent ═════════════
  let hudTimer = 0, hudSlim = 0, hud = null;
  OS.volume = {
    change(delta) {
      if (OS.power.off) return;
      const v = clamp(Math.round((OS.settings.get('volume') + delta) * 16) / 16, 0, 1); OS.settings.set('volume', v);
      OS.emit('volumechange', v); OS.haptic('light'); OS.volume.showHUD();
    },
    showHUD() {
      if (OS.lock.asleep) OS.lock.wake();
      const v = OS.settings.get('volume');
      if (!hud) { hud = el(`<div class="hud-vol"><i></i><span class="hv-ic"></span></div>`); $('hud').appendChild(hud); hud.getBoundingClientRect(); }
      hud.querySelector('.hv-ic').innerHTML = v === 0 ? I.mute : I.speaker; hud.style.setProperty('--v', v * 100 + '%');
      hud.classList.remove('slim'); requestAnimationFrame(() => hud && hud.classList.add('in'));
      clearTimeout(hudTimer); clearTimeout(hudSlim);
      hudSlim = setTimeout(() => hud && hud.classList.add('slim'), 1100);
      hudTimer = setTimeout(() => { if (!hud) return; const h = hud; hud = null; h.classList.remove('in'); setTimeout(() => h.remove(), 500); }, 2200);
    },
  };
  OS.toggleSilent = function () {
    if (OS.power.off) return;
    const on = !OS.settings.get('silent'); OS.settings.set('silent', on);
    if (OS.lock.asleep) OS.lock.wake();
    OS.haptic(on ? 'heavy' : 'medium');
    OS.island.flash({ ms: 1700, html: `<div class="isl-row" style="justify-content:space-between;padding:0 6px"><span style="display:flex;width:30px;height:30px;color:${on ? '#FF453A' : '#fff'}">${on ? I.bellSlash : I.bell}</span><span style="font-size:17px;font-weight:600;color:${on ? '#FF453A' : '#fff'}">${on ? 'Silent' : 'Ring'}</span></div>` });
    const st = document.getElementById('island'); st.style.height = '44px'; setTimeout(() => { st.style.height = ''; }, 1700);
  };

  // ═════════════ screenshot ═════════════
  function collectCSS() {
    let out = '';
    const walk = (sheet) => { let rules; try { rules = sheet.cssRules; } catch { return; } for (const r of rules) { if (r.styleSheet) walk(r.styleSheet); else out += r.cssText + '\n'; } };
    for (const s of document.styleSheets) walk(s);
    return out;
  }
  function snapshotNode() {
    const src = OS.screen; const clone = src.cloneNode(true);
    ['hud', 'flash', 'dimmer', 'screen-off', 'boot', 'poweroff', 'edge-top-left', 'edge-top-right'].forEach((id) => { const n = clone.querySelector('#' + id); n && n.remove(); });
    const oc = src.querySelectorAll('canvas'), cc = clone.querySelectorAll('canvas');
    oc.forEach((c, i) => { try { const img = document.createElement('img'); img.src = c.toDataURL(); img.style.cssText = c.style.cssText; img.className = c.className; img.width = c.clientWidth; img.height = c.clientHeight; cc[i] && cc[i].replaceWith(img); } catch {} });
    const ov = src.querySelectorAll('video'), cv = clone.querySelectorAll('video');
    ov.forEach((v, i) => { try { const k = document.createElement('canvas'); k.width = v.videoWidth || 402; k.height = v.videoHeight || 874; k.getContext('2d').drawImage(v, 0, 0, k.width, k.height); const img = document.createElement('img'); img.src = k.toDataURL('image/jpeg', .8); img.style.cssText = v.style.cssText; img.className = v.className; cv[i] && cv[i].replaceWith(img); } catch {} });
    clone.querySelectorAll('iframe').forEach((f) => { const d = document.createElement('div'); d.style.cssText = 'position:absolute;inset:0;background:#fff'; f.replaceWith(d); });
    clone.querySelectorAll('script').forEach((s) => s.remove());
    return clone;
  }
  async function renderToImage(clone) {
    const css = collectCSS().replace(/@import[^;]+;/g, '');
    clone.setAttribute('xmlns', 'http://www.w3.org/1999/xhtml'); clone.style.cssText = 'position:relative;left:0;top:0;border-radius:0;clip-path:none;width:402px;height:874px';
    const xml = new XMLSerializer().serializeToString(clone);
    const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="402" height="874"><foreignObject width="100%" height="100%"><div xmlns="http://www.w3.org/1999/xhtml" style="width:402px;height:874px;font-family:-apple-system,Helvetica,sans-serif"><style>${css.replace(/</g, '&lt;').replace(/&(?!lt;|amp;)/g, '&amp;')}</style>${xml}</div></foreignObject></svg>`;
    const img = new Image(); img.src = 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(svg);
    await new Promise((res, rej) => { img.onload = res; img.onerror = rej; setTimeout(rej, 4000); });
    const c = document.createElement('canvas'); c.width = 804; c.height = 1748; const g = c.getContext('2d'); g.fillStyle = '#000'; g.fillRect(0, 0, c.width, c.height); g.drawImage(img, 0, 0, c.width, c.height);
    return c.toDataURL('image/jpeg', .9);
  }
  OS.screenshot = async function () {
    if (OS.power.off || OS.lock.asleep) return;
    const clone = snapshotNode();
    const fl = $('flash'); fl.classList.remove('go'); fl.getBoundingClientRect(); fl.classList.add('go');
    OS.sound.play('shutter'); OS.haptic('medium');
    const thumb = el('<div class="shot-thumb"><div></div></div>'); const inner = thumb.firstElementChild;
    const vis = clone.cloneNode(true); vis.removeAttribute('id'); vis.style.cssText = 'position:absolute;inset:0;width:402px;height:874px;border-radius:0;clip-path:none;overflow:hidden'; vis.querySelectorAll('[id]').forEach((n) => n.setAttribute('data-was-id', n.id) || n.removeAttribute('id'));
    // cloned ids lose their #id styles — approximate by pinning z-order of the main layers
    inner.appendChild(vis); $('hud').appendChild(thumb);
    const bye = () => { thumb.classList.add('out'); setTimeout(() => thumb.remove(), 450); };
    const t = setTimeout(bye, 4200);
    thumb.addEventListener('click', () => { clearTimeout(t); bye(); OS.openApp('photos', { album: 'screenshots' }); });
    try { const data = await renderToImage(clone); await OS.photos.add({ src: data, kind: 'screenshot' }); } catch (e) { console.warn('screenshot render failed', e); }
  };

  // ═════════════ power off ═════════════
  function buildPowerOff() {
    const po = $('poweroff');
    po.innerHTML = `<div class="po-track"><span>slide to power off</span><div class="po-knob"><svg viewBox="0 0 30 30"><path d="M15 5v9M9.300 8.700a8.500 8.500 0 1 0 11.400 0"/></svg></div></div><div class="po-cancel"><i>✕</i>Cancel</div>`;
    const knob = po.querySelector('.po-knob'), label = po.querySelector('.po-track span'), max = OS.W - 84 - 76;
    po.querySelector('.po-cancel').addEventListener('click', hidePowerOff);
    OS.util.drag(knob, { threshold: 1, onMove(p) { const x = clamp(p.dx, 0, max); knob.style.transform = `translateX(${x}px)`; label.style.opacity = String(1 - x / 120); },
      onEnd(p) { if (p.dx > max * .8) { hidePowerOff(); OS.lock.powerDown(); } else { knob.style.transition = 'transform .3s'; knob.style.transform = ''; label.style.opacity = ''; setTimeout(() => (knob.style.transition = ''), 320); } } });
  }
  function showPowerOff() { const po = $('poweroff'); closeCC(); closeNC(); po.classList.add('on'); po.getBoundingClientRect(); po.classList.add('in'); OS.haptic('heavy'); const k = po.querySelector('.po-knob'); k.style.transform = ''; po.querySelector('.po-track span').style.opacity = ''; }
  function hidePowerOff() { const po = $('poweroff'); po.classList.remove('in'); setTimeout(() => po.classList.remove('on'), 320); }
  OS.showPowerOff = showPowerOff;

  // ═════════════ Spotlight ═════════════
  let spOpen = false;
  function buildSpotlight() {
    const sp = $('spotlight');
    sp.innerHTML = `<div class="sp-scroll ios-scroll"><div class="sp-out"></div></div><div class="sp-bar">${I.search}<input type="text" placeholder="Search" enterkeyhint="go" autocomplete="off" autocapitalize="off"></div>`;
    const input = sp.querySelector('input');
    input.addEventListener('input', () => renderSpotlight(input.value));
    input.addEventListener('keydown', (e) => { if (e.key === 'Enter') { e.preventDefault(); const first = sp.querySelector('.sp-row, .sp-sugg .icon'); first && first.click(); } });
    sp.addEventListener('click', (e) => { if (e.target === sp || e.target.classList.contains('sp-scroll') || e.target.classList.contains('sp-out')) closeSpotlight(); });
  }
  function calc(q) { if (!/^[\d\s+\-*/().%x×÷^]+$/.test(q) || !/\d/.test(q) || !/[+\-*/x×÷^%]/.test(q)) return null; try { const v = Function('"use strict";return (' + q.replace(/[x×]/g, '*').replace(/÷/g, '/').replace(/\^/g, '**').replace(/%/g, '/100') + ')')(); return Number.isFinite(v) ? String(Math.round(v * 1e10) / 1e10) : null; } catch { return null; } }
  function renderSpotlight(q) {
    const out = $('spotlight').querySelector('.sp-out'); q = (q || '').trim(); out.innerHTML = '';
    const apps = OS.apps.filter((a) => OS.isInstalled(a.id));
    const appIcon = (a) => { const n = el(`<div class="icon" data-app="${esc(a.id)}">${OS.iconHTML(a)}<div class="icon-label">${esc(a.name)}</div></div>`); n.addEventListener('click', () => { closeSpotlight(true); OS.openApp(a.id); }); return n; };
    if (!q) {
      const rec = OS.store.get('spotlight.recent', []); const pick = [...rec.map((id) => OS.getApp(id)).filter(Boolean), ...apps].filter((a, i, arr) => arr.indexOf(a) === i).slice(0, 8);
      out.appendChild(el('<div class="sp-title">Siri Suggestions</div>')); const g = el('<div class="sp-sugg"></div>'); pick.forEach((a) => g.appendChild(appIcon(a))); out.appendChild(g); return;
    }
    const lq = q.toLowerCase(); const rows = [];
    const math = calc(q); if (math != null) rows.push({ html: `${OS.iconHTML(OS.getApp('calculator') || { icon: { bg: '#333', glyph: '=' } })}<div><div style="font-size:24px;font-weight:600">${esc(math)}</div><small>${esc(q)} =</small></div>`, go: () => OS.openApp('calculator') });
    apps.filter((a) => a.name.toLowerCase().includes(lq)).sort((a, b) => a.name.toLowerCase().indexOf(lq) - b.name.toLowerCase().indexOf(lq)).slice(0, 6).forEach((a) => rows.push({ html: `${OS.iconHTML(a)}<div>${esc(a.name)}<small>App</small></div>`, go: () => { const r = [a.id, ...OS.store.get('spotlight.recent', []).filter((x) => x !== a.id)].slice(0, 8); OS.store.set('spotlight.recent', r); OS.openApp(a.id); } }));
    OS.contacts.all().filter((c) => OS.contacts.name(c).toLowerCase().includes(lq)).slice(0, 3).forEach((c) => rows.push({ html: `${OS.contacts.avatar(c, 38)}<div>${esc(OS.contacts.name(c))}<small>${esc(c.phone)}</small></div>`, go: () => OS.openApp('contacts', { contactId: c.id }) }));
    rows.push({ html: `<div class="icon-img" style="background:var(--fill);width:38px;height:38px;border-radius:9px"><span style="display:flex;width:20px;height:20px;fill:none;stroke:#fff;stroke-width:2">${I.search}</span></div><div>${esc(q)}<small>Search the Web</small></div>`, go: () => OS.openApp('safari', { search: q }) });
    const box = el('<div class="sp-results"></div>'); rows.forEach((r) => { const n = el(`<div class="sp-row">${r.html}</div>`); n.addEventListener('click', () => { closeSpotlight(true); r.go(); }); box.appendChild(n); }); out.appendChild(box);
  }
  function openSpotlight() { if (spOpen || OS.lock.locked) return; spOpen = true; const sp = $('spotlight'); sp.classList.add('on'); const input = sp.querySelector('input'); input.value = ''; renderSpotlight(''); sp.getBoundingClientRect(); sp.classList.add('in'); setTimeout(() => input.focus({ preventScroll: true }), 120); }
  function closeSpotlight(fast) { if (!spOpen) return; spOpen = false; const sp = $('spotlight'); sp.querySelector('input').blur(); sp.classList.remove('in'); setTimeout(() => { if (!spOpen) sp.classList.remove('on'); }, fast ? 150 : 300); }
  OS.spotlight = { open: openSpotlight, close: closeSpotlight };

  // ═════════════ wiring ═════════════
  OS.overlays = {
    anyOpen: () => ccOpen || ncOpen || spOpen,
    closeAll() { closeCC(); closeNC(); closeSpotlight(); },
    openCC, closeCC, openNC, closeNC, renderLists,
  };
  OS.initOverlays = function () {
    buildCC(); buildNC(); buildPowerOff(); buildSpotlight(); renderLists();
    // pull down from the top-right corner → Control Center
    OS.util.drag($('edge-top-right'), { axis: 'y', threshold: 3,
      onStart() { if (OS.power.off || OS.lock.asleep) return false; $('cc').classList.add('on'); syncCC(); setCCProgress(0, false); },
      onMove(p) { setCCProgress(clamp(p.dy / 240, 0, 1), false); },
      onEnd(p) { if (p.dy > 90 || p.vy > .4) { ccOpen = true; setCCProgress(1, true); OS.keyboard.hide(true); } else { ccOpen = true; closeCC(); } } });
    // pull down from the top-left / centre → Notification Center
    OS.util.drag($('edge-top-left'), { axis: 'y', threshold: 3,
      onStart() { if (OS.power.off || OS.lock.locked) return false; const nc = $('nc'); nc.classList.add('on'); nc.classList.remove('anim', 'open'); tickNC(); renderLists(); },
      onMove(p) { $('nc').style.transform = `translateY(${clamp(-OS.H + p.dy * 1.6, -OS.H, 0)}px)`; },
      onEnd(p) { const nc = $('nc'); nc.classList.add('anim'); nc.style.transform = ''; if (p.dy > 160 || p.vy > .5) { ncOpen = true; nc.classList.add('open'); OS.setStatusBarStyle('light'); } else { ncOpen = true; closeNC(); } } });
    OS.on('minute', () => { if (ncOpen) tickNC(); });
  };
})();
