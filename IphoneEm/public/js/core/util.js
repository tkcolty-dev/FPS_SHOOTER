// OS namespace, events, and pointer helpers that understand the CSS-scaled screen.
(function () {
  const listeners = {};
  const OS = window.OS = {
    W: 402, H: 874,
    apps: [],
    on(evt, fn) { (listeners[evt] = listeners[evt] || []).push(fn); return fn; },
    off(evt, fn) { const l = listeners[evt]; if (l) { const i = l.indexOf(fn); if (i >= 0) l.splice(i, 1); } },
    emit(evt, ...args) { (listeners[evt] || []).slice().forEach((fn) => { try { fn(...args); } catch (e) { console.error('[OS.on ' + evt + ']', e); } }); },
    addStyle(id, css) {
      let el = document.getElementById('style-' + id);
      if (!el) { el = document.createElement('style'); el.id = 'style-' + id; document.head.appendChild(el); }
      el.textContent = css;
    },
  };
  const $screen = () => document.getElementById('screen');
  OS.screen = null;
  document.addEventListener('DOMContentLoaded', () => { OS.screen = $screen(); });

  const util = OS.util = {
    el(html) { const t = document.createElement('template'); t.innerHTML = String(html).trim(); return t.content.firstElementChild; },
    esc(s) { return String(s == null ? '' : s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c])); },
    uid() { return Date.now().toString(36) + Math.random().toString(36).slice(2, 8); },
    clamp(v, a, b) { return Math.min(b, Math.max(a, v)); },
    wait(ms) { return new Promise((r) => setTimeout(r, ms)); },
    time(d = new Date()) {
      d = new Date(d);
      if (OS.settings && OS.settings.get('use24h')) return String(d.getHours()).padStart(2, '0') + ':' + String(d.getMinutes()).padStart(2, '0');
      return ((d.getHours() % 12) || 12) + ':' + String(d.getMinutes()).padStart(2, '0');
    },
    ampm(d = new Date()) { return OS.settings && OS.settings.get('use24h') ? '' : (new Date(d).getHours() < 12 ? 'AM' : 'PM'); },
    timeFull(d = new Date()) { const a = util.ampm(d); return util.time(d) + (a ? ' ' + a : ''); },
    relDate(d) {
      d = new Date(d); const now = new Date();
      const day = (x) => new Date(x.getFullYear(), x.getMonth(), x.getDate()).getTime();
      const diff = Math.round((day(now) - day(d)) / 864e5);
      if (diff === 0) return util.timeFull(d);
      if (diff === 1) return 'Yesterday';
      if (diff > 1 && diff < 7) return d.toLocaleDateString('en-US', { weekday: 'long' });
      return d.toLocaleDateString('en-US', { month: 'numeric', day: 'numeric', year: '2-digit' });
    },
    scale() { const s = OS.screen || $screen(); const r = s.getBoundingClientRect(); return r.width / OS.W || 1; },
    screenPoint(e) {
      const s = OS.screen || $screen(); const r = s.getBoundingClientRect(); const k = r.width / OS.W || 1;
      return { x: (e.clientX - r.left) / k, y: (e.clientY - r.top) / k };
    },
    // rect of an element in screen px
    rect(el) {
      const s = OS.screen || $screen(); const sr = s.getBoundingClientRect(); const k = sr.width / OS.W || 1; const r = el.getBoundingClientRect();
      return { x: (r.left - sr.left) / k, y: (r.top - sr.top) / k, w: r.width / k, h: r.height / k };
    },
    /* Drag gesture in SCREEN px.  opts: { axis:'x'|'y', threshold:6, onStart(p,e) → return false to cancel, onMove(p,e), onEnd(p,e), onTap(e) } */
    drag(el, opts) {
      const th = opts.threshold == null ? 6 : opts.threshold;
      const down = (e) => {
        if (e.button != null && e.button > 0) return;
        if (opts.filter && !opts.filter(e)) return;
        const start = util.screenPoint(e); let started = false, dead = false, last = start, lastT = performance.now(), vx = 0, vy = 0;
        const mk = (ev) => { const q = util.screenPoint(ev); return { x: q.x, y: q.y, dx: q.x - start.x, dy: q.y - start.y, vx, vy, startX: start.x, startY: start.y }; };
        const move = (ev) => {
          if (dead) return;
          const q = util.screenPoint(ev), now = performance.now(), dt = Math.max(1, now - lastT);
          vx = vx * .6 + ((q.x - last.x) / dt) * .4; vy = vy * .6 + ((q.y - last.y) / dt) * .4; last = q; lastT = now;
          const p = mk(ev);
          if (!started) {
            if (Math.hypot(p.dx, p.dy) < th) return;
            if (opts.axis === 'x' && Math.abs(p.dy) > Math.abs(p.dx)) { dead = true; return; }
            if (opts.axis === 'y' && Math.abs(p.dx) > Math.abs(p.dy)) { dead = true; return; }
            if (OS._scrollClaimed) { dead = true; return; }
            if (opts.onStart && opts.onStart(p, ev) === false) { dead = true; return; }
            started = true; OS._dragClaimed = true; document.body.classList.add('os-dragging');
          }
          ev.preventDefault();
          opts.onMove && opts.onMove(p, ev);
        };
        const up = (ev) => {
          window.removeEventListener('pointermove', move, true); window.removeEventListener('pointerup', up, true); window.removeEventListener('pointercancel', up, true);
          document.body.classList.remove('os-dragging');
          if (started) {
            util.suppressClick();
            // stale velocity → zero
            if (performance.now() - lastT > 90) { vx = 0; vy = 0; }
            opts.onEnd && opts.onEnd(mk(ev), ev);
          } else if (!dead && opts.onTap) opts.onTap(ev);
          setTimeout(() => { OS._dragClaimed = false; }, 0);
        };
        window.addEventListener('pointermove', move, true); window.addEventListener('pointerup', up, true); window.addEventListener('pointercancel', up, true);
      };
      el.addEventListener('pointerdown', down);
      return () => el.removeEventListener('pointerdown', down);
    },
    suppressClick() {
      const kill = (e) => { e.stopPropagation(); e.preventDefault(); };
      window.addEventListener('click', kill, { capture: true, once: true });
      setTimeout(() => window.removeEventListener('click', kill, true), 60);
    },
    longPress(el, fn, ms = 500) {
      let t = null, sx = 0, sy = 0, fired = false;
      const clear = () => { if (t) { clearTimeout(t); t = null; } };
      el.addEventListener('pointerdown', (e) => {
        if (e.button > 0) return;
        sx = e.clientX; sy = e.clientY; fired = false; clear();
        t = setTimeout(() => { t = null; fired = true; OS.haptic && OS.haptic('medium'); fn(e); }, ms);
      });
      el.addEventListener('pointermove', (e) => { if (t && Math.hypot(e.clientX - sx, e.clientY - sy) > 8) clear(); });
      ['pointerup', 'pointercancel', 'pointerleave'].forEach((n) => el.addEventListener(n, clear));
      el.addEventListener('click', (e) => { if (fired) { e.stopPropagation(); e.preventDefault(); fired = false; } }, true);
      el.addEventListener('contextmenu', (e) => { e.preventDefault(); if (!fired) { clear(); fired = true; fn(e); setTimeout(() => { fired = false; }, 50); } });
    },
  };

  // ── finger-style drag scrolling for the mouse on every .ios-scroll (wheel keeps working natively) ──
  const canScroll = (el, axis) => axis === 'y' ? el.scrollHeight > el.clientHeight + 1 : el.scrollWidth > el.clientWidth + 1;
  document.addEventListener('pointerdown', (e) => {
    if (e.pointerType !== 'mouse' || e.button !== 0) return;
    const t = e.target;
    if (!t.closest || !t.closest('#screen')) return;
    if (t.closest('input, textarea, select, [contenteditable=""], [contenteditable="true"], [data-no-dragscroll], .leaflet-container')) return;
    const first = t.closest('.ios-scroll'); if (!first) return;
    const k = util.scale(); const sx = e.clientX, sy = e.clientY;
    let target = null, axis = null, lastX = sx, lastY = sy, lastT = performance.now(), v = 0, raf = 0;
    if (first._momentum) { cancelAnimationFrame(first._momentum); first._momentum = 0; }
    const move = (ev) => {
      const dx = (ev.clientX - sx) / k, dy = (ev.clientY - sy) / k;
      if (!target) {
        if (OS._dragClaimed) return end();
        if (Math.hypot(dx, dy) < 6) return;
        axis = Math.abs(dy) >= Math.abs(dx) ? 'y' : 'x';
        let c = first;
        while (c && !(canScroll(c, axis) && (axis === 'y' ? !c.classList.contains('x') : getComputedStyle(c).overflowX !== 'hidden'))) c = c.parentElement && c.parentElement.closest('.ios-scroll');
        if (!c) return end();
        target = c; OS._scrollClaimed = true; document.body.classList.add('os-dragging');
      }
      const now = performance.now(), dt = Math.max(1, now - lastT);
      const step = axis === 'y' ? (ev.clientY - lastY) / k : (ev.clientX - lastX) / k;
      if (axis === 'y') target.scrollTop -= step; else target.scrollLeft -= step;
      v = v * .7 + (step / dt) * .3; lastX = ev.clientX; lastY = ev.clientY; lastT = now;
      ev.preventDefault();
    };
    const end = () => {
      window.removeEventListener('pointermove', move, true); window.removeEventListener('pointerup', end, true); window.removeEventListener('pointercancel', end, true);
      document.body.classList.remove('os-dragging');
      setTimeout(() => { OS._scrollClaimed = false; }, 0);
      if (!target) return;
      util.suppressClick();
      if (performance.now() - lastT > 80) v = 0;
      const el = target; let vel = v * 16; // px per frame
      const tick = () => {
        if (Math.abs(vel) < .3) { el._momentum = 0; return; }
        if (axis === 'y') el.scrollTop -= vel; else el.scrollLeft -= vel;
        vel *= .955; el._momentum = requestAnimationFrame(tick);
      };
      el._momentum = requestAnimationFrame(tick);
    };
    window.addEventListener('pointermove', move, true); window.addEventListener('pointerup', end, true); window.addEventListener('pointercancel', end, true);
  }, true);

  const st = document.createElement('style');
  st.textContent = 'body.os-dragging iframe{pointer-events:none!important} body.os-dragging{cursor:grabbing}';
  document.head.appendChild(st);
})();
