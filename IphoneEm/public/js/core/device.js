// The physical device: hardware buttons, finishes + cases, flip, charger, shake, window scaling, keyboard shortcuts.
(function () {
  const $ = (id) => document.getElementById(id);
  const COLORS = [['lavender', '#cfc3e6'], ['sage', '#c3cdb0'], ['mist', '#b9cbe2'], ['white', '#efefec'], ['black', '#3a3b40']];
  const CASES = [['', ''], ['clear', 'linear-gradient(140deg,rgba(255,255,255,.55),rgba(255,255,255,.15))'], ['midnight', '#1f222b'], ['clay', '#b97a5c'], ['lake', '#3f7396'], ['forest', '#445d4a'], ['pink', '#e8a3b8']];

  function fit() {
    const panel = $('panel'); const pw = panel && getComputedStyle(panel).display !== 'none' ? 250 : 0;
    const s = Math.min((window.innerHeight - 36) / 922, (window.innerWidth - pw * 2 - 20) / 460, 1.35);
    $('device').style.setProperty('--scale', String(Math.max(.3, s)));
  }

  function swatches() {
    const dev = $('device');
    const mk = (host, list, cur, onPick, noneClass) => { host.innerHTML = ''; list.forEach(([id, css]) => { const s = document.createElement('div'); s.className = 'swatch' + (id === cur ? ' on' : '') + (!id ? ' none' : ''); if (id) s.style.background = css; s.title = id || 'No case'; s.addEventListener('click', () => onPick(id)); host.appendChild(s); }); };
    const draw = () => {
      dev.dataset.color = OS.settings.get('color'); const c = OS.settings.get('caseColor'); if (c) dev.dataset.case = c; else delete dev.dataset.case;
      mk($('swatches'), COLORS, OS.settings.get('color'), (id) => { OS.settings.set('color', id); draw(); });
      mk($('case-swatches'), CASES, c, (id) => { OS.settings.set('caseColor', id); draw(); });
    };
    draw(); OS.on('setting:color', draw); OS.on('setting:caseColor', draw);
  }

  function buttons() {
    const press = (n, on) => n.classList.toggle('pressed', on);
    let lastVolUp = 0, powerTimer = 0, powerHeld = false, clickTimer = 0, clicks = 0;

    const vol = (dir) => {
      if (OS.power.off) return;
      if (dir > 0) lastVolUp = Date.now();
      if (OS.activeApp === 'camera' && !OS.lock.locked) return OS.openApp('camera', { capture: true });
      if (OS.lock.asleep) OS.lock.wake();
      OS.volume.change(dir / 16);
    };
    const bind = (sel, down, up) => { const n = document.querySelector(sel); n.addEventListener('pointerdown', (e) => { e.preventDefault(); press(n, true); down && down(e); const rel = () => { press(n, false); window.removeEventListener('pointerup', rel); up && up(); }; window.addEventListener('pointerup', rel); }); };

    let volRepeat = 0;
    bind('.hw-volup', () => { vol(1); volRepeat = setTimeout(() => (volRepeat = setInterval(() => vol(1), 110)), 450); }, () => { clearTimeout(volRepeat); clearInterval(volRepeat); });
    bind('.hw-voldown', () => { vol(-1); volRepeat = setTimeout(() => (volRepeat = setInterval(() => vol(-1), 110)), 450); }, () => { clearTimeout(volRepeat); clearInterval(volRepeat); });
    bind('.hw-action', () => OS.toggleSilent());
    bind('.hw-camera', () => { if (OS.power.off) return; if (OS.lock.asleep) OS.lock.wake(); if (OS.activeApp === 'camera' && !OS.lock.locked) OS.openApp('camera', { capture: true }); else OS.lock.requestUnlock(() => OS.openApp('camera')); OS.haptic('light'); });

    bind('.hw-power', (e) => {
      powerHeld = false; const combo = Date.now() - lastVolUp < 900 || e.shiftKey;
      powerTimer = setTimeout(() => {
        powerHeld = true;
        if (OS.power.off) return OS.lock.boot();
        if (combo) return OS.showPowerOff();
        OS.siri.open();
      }, OS.power.off ? 700 : 850);
      powerTimer._combo = combo;
    }, () => {
      clearTimeout(powerTimer); if (powerHeld || OS.power.off) return;
      if (Date.now() - lastVolUp < 900) { lastVolUp = 0; return OS.screenshot(); }
      if (OS.siri.active) return OS.siri.close();
      if ($('poweroff').classList.contains('on')) return;
      clicks++; clearTimeout(clickTimer);
      if (clicks >= 2 && OS._sideDouble) { clicks = 0; const fn = OS._sideDouble; OS._sideDouble = null; return fn(); }
      if (clicks >= 2) { clicks = 0; if (!OS.lock.asleep && OS.getApp('wallet')) { OS.haptic('medium'); return OS.lock.requestUnlock(() => OS.openApp('wallet', { pay: true })); } }
      clickTimer = setTimeout(() => { const n = clicks; clicks = 0; if (n === 1) OS.lock.toggle(); }, OS.lock.asleep ? 0 : 230);
    });
  }

  function panel() {
    $('btn-flip').addEventListener('click', () => $('phone').classList.toggle('flipped'));
    const ch = $('btn-charge'); ch.addEventListener('click', () => { const on = !OS.power.plugged; OS.power.plug(on); ch.classList.toggle('on', on); ch.textContent = on ? 'Unplug' : 'Plug in'; $('cable').classList.toggle('in', on); });
    $('btn-shake').addEventListener('click', () => { const p = $('phone'); if (p.classList.contains('flipped')) return; p.classList.remove('shake'); p.getBoundingClientRect(); p.classList.add('shake'); setTimeout(() => p.classList.remove('shake'), 520); OS.emit('shake'); if (!OS.lock.locked && OS.keyboard.visible) OS.ui.alert({ title: 'Undo Typing', buttons: [{ label: 'Cancel', style: 'cancel' }, { label: 'Undo', onTap() { try { document.execCommand('undo'); } catch {} } }] }); });
  }

  function keys() {
    const typing = () => { const a = document.activeElement; return a && (a.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(a.tagName)); };
    window.addEventListener('keydown', (e) => {
      if (e.metaKey || e.ctrlKey || e.altKey) return;
      if (e.key === 'Escape') { if (OS.power.off) return; e.preventDefault(); if (OS.lock.locked) return; if (typing()) document.activeElement.blur(); if (OS.siri.active) return OS.siri.close(); if (OS.overlays.anyOpen()) return OS.overlays.closeAll(); if (OS.switcherOpen) return OS.closeSwitcher(); return OS.goHome({ fromButton: true }); }
      if (typing()) return;
      if (e.key === 'l' || e.key === 'L') { e.preventDefault(); OS.power.off ? OS.lock.boot() : OS.lock.toggle(); }
      else if (e.key === 'ArrowUp' && !OS.activeApp) { e.preventDefault(); OS.volume.change(1 / 16); }
      else if (e.key === 'ArrowDown' && !OS.activeApp) { e.preventDefault(); OS.volume.change(-1 / 16); }
    });
  }

  OS.initDevice = function () { fit(); window.addEventListener('resize', fit); swatches(); buttons(); panel(); keys(); };
})();
