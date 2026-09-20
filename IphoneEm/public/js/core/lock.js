// Lock Screen, sleep / wake, Always-On display, Face ID, passcode, power down + boot
(function () {
  const { el, esc } = OS.util;
  const $ = (id) => document.getElementById(id);
  let lockEl, pending = null, authed = false, lastActivity = Date.now(), faceTimer = 0, entry = '', needPasscodeAfterBoot = false, hintTimer = 0;

  const L = OS.lock = {
    locked: true, asleep: false,
    // ── sleep / wake ──
    sleep(opts = {}) {
      if (OS.power.off || L.asleep) return;
      const wasUnlocked = !L.locked;
      OS.overlays.closeAll(); OS.keyboard.hide(true); OS.siri && OS.siri.close(); if (OS.switcherOpen) OS.closeSwitcher();
      if (!opts.silent) OS.sound.play('lock');
      if (wasUnlocked) { OS.pauseActive(); OS.home.endJiggle(); }
      L.locked = true; L.asleep = true; authed = false; pending = null; entry = '';
      show(); lockEl.querySelector('.passcode').classList.remove('on');
      const off = $('screen-off'); const aod = OS.settings.get('alwaysOn');
      off.classList.toggle('aod', aod); off.classList.add('on'); lockEl.classList.toggle('aod', aod);
      setGlyph(false); OS.island.clearFlash(); OS.refreshChrome(); $('statusbar').style.opacity = aod ? '.5' : '';
      if (wasUnlocked) OS.emit('lock');
    },
    wake(fromNotification) {
      if (OS.power.off) return;
      lastActivity = Date.now();
      if (!L.asleep) return;
      L.asleep = false; $('screen-off').classList.remove('on', 'aod'); lockEl.classList.remove('aod'); $('statusbar').style.opacity = '';
      tick(); OS.overlays.renderLists();
      if (L.locked) startFaceID();
      clearTimeout(hintTimer); hintTimer = setTimeout(() => lockEl.querySelector('.lock-hint').classList.add('show'), 1400);
    },
    toggle() { if (L.asleep) L.wake(); else L.sleep(); },
    requestUnlock(cb) { pending = cb || null; if (L.asleep) L.wake(); if (!L.locked) { const f = pending; pending = null; f && f(); return; } if (authed) return unlock(); if (needsPasscode()) showPasscode(); },
    // ── swipe-up (driven by the home indicator gesture in os.js) ──
    dragStart() { lockEl.classList.remove('anim'); lastActivity = Date.now(); if (L.asleep) L.wake(); },
    dragMove(up) { if (lockEl.querySelector('.passcode').classList.contains('on')) return; lockEl.style.transform = `translateY(${-up}px)`; },
    dragEnd(up, flick) {
      lockEl.classList.add('anim'); lockEl.style.transform = '';
      if (up < 170 && !flick) return;
      if (authed || !needsPasscode()) return unlock();
      showPasscode();
    },
    powerDown() {
      OS.recents().forEach((id) => OS.killApp(id)); OS.nowPlaying.clear();
      L.sleep({ silent: true }); const off = $('screen-off'); off.classList.remove('aod'); lockEl.classList.remove('aod'); OS.power.off = true; $('statusbar').style.opacity = '0'; OS.flashlight.set(false);
      needPasscodeAfterBoot = true;
    },
    boot(fast) {
      const b = $('boot'); b.innerHTML = '<span style="font-family:system-ui,-apple-system,sans-serif">\uF8FF</span>'; b.classList.remove('fade'); b.classList.add('on');
      OS.power.off = false; $('statusbar').style.opacity = '';
      L.locked = true; L.asleep = true; show(); $('screen-off').classList.remove('on', 'aod'); lockEl.classList.remove('aod');
      setTimeout(() => { b.classList.add('fade'); L.asleep = true; L.wake(); setTimeout(() => b.classList.remove('on'), 650); }, fast ? 1500 : 3200);
    },
  };

  const needsPasscode = () => !!OS.settings.get('passcode') && (!OS.settings.get('faceId') || needPasscodeAfterBoot);
  function show() { lockEl.classList.remove('away', 'anim'); lockEl.classList.add('on'); lockEl.style.transform = ''; lockEl.querySelector('.lock-hint').classList.remove('show'); tick(); }
  function setGlyph(open) { lockEl.querySelector('.lock-glyph').classList.toggle('open', open); }

  function startFaceID() {
    clearTimeout(faceTimer); authed = false; setGlyph(false);
    if (needsPasscode()) return;
    faceTimer = setTimeout(() => {
      if (!L.locked || L.asleep) return;
      authed = true; setGlyph(true); OS.haptic('success');
      if (pending) setTimeout(unlock, 250);
    }, OS.settings.get('passcode') ? 750 : 450);
  }
  function unlock() {
    if (!L.locked) return;
    L.locked = false; authed = false; needPasscodeAfterBoot = false; entry = '';
    lockEl.classList.add('anim', 'away'); lockEl.querySelector('.passcode').classList.remove('on');
    setTimeout(() => { if (!L.locked) lockEl.classList.remove('on'); }, 520);
    lastActivity = Date.now(); OS.haptic('light');
    OS.resumeActive(); OS.emit('unlock'); OS.refreshChrome();
    const f = pending; pending = null; if (f) setTimeout(f, 60);
  }

  // ── passcode ──
  function showPasscode() { entry = ''; const pc = lockEl.querySelector('.passcode'); pc.classList.add('on'); renderDots(); lockEl.style.transform = ''; }
  function renderDots() { const n = (OS.settings.get('passcode') || '0000').length; lockEl.querySelector('.pc-dots').innerHTML = Array.from({ length: n }, (_, i) => `<i class="${i < entry.length ? 'on' : ''}"></i>`).join(''); lockEl.querySelector('.pc-del').textContent = entry ? 'Delete' : 'Cancel'; }
  function pcKey(d) {
    const code = OS.settings.get('passcode'); if (entry.length >= code.length) return;
    entry += d; OS.sound.play('key'); renderDots();
    if (entry.length === code.length) setTimeout(() => {
      if (entry === code) unlock();
      else { entry = ''; renderDots(); const dots = lockEl.querySelector('.pc-dots'); dots.classList.remove('shake'); dots.getBoundingClientRect(); dots.classList.add('shake'); OS.haptic('error'); }
    }, 160);
  }

  function tick() {
    if (!lockEl) return; const d = new Date();
    lockEl.querySelector('.lock-time').textContent = OS.util.time(d);
    lockEl.querySelector('.lock-date').textContent = d.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' });
  }
  function syncNP() {
    const np = OS.nowPlaying.current, box = lockEl.querySelector('.lock-np'); box.classList.toggle('on', !!np); if (!np) return;
    box.innerHTML = `<div style="display:flex;gap:12px;align-items:center"><div style="width:52px;height:52px;border-radius:10px;flex:none;background:${np.artwork || 'rgba(255,255,255,.2)'};background-size:cover"></div><div style="min-width:0;flex:1"><div style="font-weight:600;font-size:16px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${esc(np.title || '')}</div><div style="opacity:.7;font-size:15px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${esc(np.artist || '')}</div></div></div>
      <div style="display:flex;justify-content:center;gap:44px;margin-top:12px;fill:#fff"><span data-a="prev" style="width:34px;height:34px;cursor:pointer">${OS.icons.prev}</span><span data-a="toggle" style="width:38px;height:38px;cursor:pointer">${np.playing ? OS.icons.pause : OS.icons.play}</span><span data-a="next" style="width:34px;height:34px;cursor:pointer">${OS.icons.next}</span></div>`;
    box.querySelectorAll('[data-a]').forEach((b) => b.addEventListener('click', (e) => { e.stopPropagation(); const c = OS.nowPlaying.current; if (!c) return; const fn = b.dataset.a === 'toggle' ? c.onToggle : b.dataset.a === 'next' ? c.onNext : c.onPrev; fn && fn(); OS.haptic('light'); }));
  }

  OS.initLock = function () {
    lockEl = $('lock');
    const letters = ['', 'ABC', 'DEF', 'GHI', 'JKL', 'MNO', 'PQRS', 'TUV', 'WXYZ'];
    lockEl.innerHTML = `<div class="wp"></div><div class="lock-content">
      <div class="lock-glyph"><svg viewBox="0 0 26 34"><path class="shackle" d="M7.500 15V9.500a5.500 5.500 0 0 1 11 0V15" fill="none" stroke="#fff" stroke-width="3" stroke-linecap="round"/><rect x="3" y="14" width="20" height="17" rx="4.500"/></svg></div>
      <div class="lock-date"></div><div class="lock-time"></div><div class="lock-charge"></div>
      <div class="lock-np"></div><div class="lock-notifs"></div>
      <div class="lock-btn left" data-a="flash">${OS.icons.flashlight}</div><div class="lock-btn right" data-a="camera">${OS.icons.camera}</div>
      <div class="lock-hint">Swipe up to open</div></div>
      <div class="passcode"><div class="pc-title">Enter Passcode</div><div class="pc-dots"></div><div class="pc-grid">${[1, 2, 3, 4, 5, 6, 7, 8, 9].map((n) => `<div class="pc-key" data-d="${n}"><b>${n}</b><small>${letters[n - 1]}</small></div>`).join('')}<div class="pc-key blank"></div><div class="pc-key" data-d="0"><b>0</b><small></small></div><div class="pc-key blank"></div></div>
      <div class="pc-foot"><span>Emergency</span><span class="pc-del">Cancel</span></div></div>`;
    OS.applyWallpaper();
    lockEl.querySelector('[data-a="flash"]').addEventListener('click', () => { OS.flashlight.set(!OS.flashlight.on); OS.haptic('medium'); });
    lockEl.querySelector('[data-a="camera"]').addEventListener('click', () => { OS.haptic('medium'); L.requestUnlock(() => OS.openApp('camera')); });
    OS.on('flashlight', (on) => lockEl.querySelector('[data-a="flash"]').classList.toggle('on', on));
    lockEl.querySelectorAll('.pc-key[data-d]').forEach((k) => k.addEventListener('pointerdown', () => pcKey(k.dataset.d)));
    lockEl.querySelector('.pc-del').addEventListener('click', () => { if (entry) { entry = entry.slice(0, -1); renderDots(); } else { lockEl.querySelector('.passcode').classList.remove('on'); pending = null; } });
    // the whole lock screen can be swiped up too, not just the home bar
    OS.util.drag(lockEl.querySelector('.lock-content'), { axis: 'y', threshold: 10, filter: (e) => !e.target.closest('.lock-btn, .notif, .lock-np'),
      onStart(p) { if (p.dy > 0) return false; L.dragStart(); }, onMove(p) { L.dragMove(Math.max(0, -p.dy)); }, onEnd(p) { L.dragEnd(Math.max(0, -p.dy), p.vy < -.45); } });
    $('screen-off').addEventListener('click', () => { if (!OS.power.off) L.wake(); });
    OS.on('minute', tick); OS.on('setting:use24h', tick); OS.on('nowplaying', syncNP);
    OS.on('power:connected', () => {
      if (L.asleep) L.wake();
      const pct = Math.round(OS.power.level * 100);
      if (L.locked) { const c = lockEl.querySelector('.lock-charge'); c.textContent = `${pct}% Charged`; c.classList.add('show'); setTimeout(() => c.classList.remove('show'), 3200); }
      else OS.island.flash({ ms: 2200, html: `<div class="isl-row" style="justify-content:space-between;padding:0 4px"><span style="font-size:15px;font-weight:600">Charging</span><span style="display:flex;align-items:center;gap:6px;color:#30D158;font-weight:600;font-size:15px">${pct}%<span style="display:inline-block;width:27px;height:13px;border-radius:4px;background:rgba(48,209,88,.35);overflow:hidden"><i style="display:block;height:100%;width:${pct}%;background:#30D158"></i></span></span></div>` });
    });
    // activity + auto-lock
    const touch = () => { lastActivity = Date.now(); };
    window.addEventListener('pointerdown', touch, true); window.addEventListener('keydown', touch, true); window.addEventListener('wheel', touch, { capture: true, passive: true });
    setInterval(() => {
      if (L.asleep || OS.power.off) return;
      const idle = (Date.now() - lastActivity) / 1000, auto = OS.settings.get('autoLock');
      if (L.locked) { if (idle > 20) L.sleep({ silent: true }); return; }
      const np = OS.nowPlaying.current; const busy = (np && np.playing && OS.activeApp) || document.querySelector('#apps .app-window.active video');
      if (auto > 0 && idle > auto && !busy) L.sleep();
    }, 1000);
  };
})();
