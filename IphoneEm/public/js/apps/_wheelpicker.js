/* Shared iOS-style wheel picker (UIPickerView look-alike).
 *
 *   const p = OS.ui.wheelPicker(container, {
 *     columns: [{ values:[…], labels?:[…], value, width?, loop?, unit?, align? }],
 *     onChange(values) {},          // fired when a wheel settles on a new value
 *     onTick(values) {},            // optional: fired every time the centred row changes while spinning
 *     height: 216,
 *   });
 *   p.getValues(); p.setValue(colIndex, value, animated); p.setColumn(colIndex, colDef); p.destroy(); p.el
 *
 * Sorts first in public/js/apps so calendar.js / clock.js / reminders.js can all use it.
 */
(function () {
  if (!window.OS) return;
  OS.ui = OS.ui || {};
  if (OS.ui.wheelPicker) return;

  const ITEM_H = 34;
  const STEP = (18 * Math.PI) / 180;       // angle between rows on the drum
  const RADIUS = ITEM_H / STEP;            // ≈108px → 216px tall drum
  const HALF = 5;
  const POOL = HALF * 2 + 1;

  const css = `
  .ios-wheel{position:relative;display:flex;justify-content:center;height:216px;overflow:hidden;
    -webkit-user-select:none;user-select:none;touch-action:none;cursor:grab;font-variant-numeric:tabular-nums;
    -webkit-mask-image:linear-gradient(180deg,transparent 0,#000 22%,#000 78%,transparent 100%);
            mask-image:linear-gradient(180deg,transparent 0,#000 22%,#000 78%,transparent 100%);}
  .ios-wheel.grabbing{cursor:grabbing}
  .ios-wheel-sel{position:absolute;left:8px;right:8px;top:50%;height:${ITEM_H}px;margin-top:-${ITEM_H / 2}px;
    border-radius:8px;background:var(--fill2,rgba(120,120,128,.16));pointer-events:none}
  .ios-wheel-col{position:relative;flex:1 1 0;min-width:0;height:100%;overflow:hidden}
  .ios-wheel-item{position:absolute;left:0;right:0;top:50%;height:${ITEM_H}px;margin-top:-${ITEM_H / 2}px;
    line-height:${ITEM_H}px;font-size:23px;letter-spacing:-.3px;color:var(--label,#000);text-align:center;
    white-space:nowrap;overflow:hidden;text-overflow:ellipsis;will-change:transform,opacity;backface-visibility:hidden}
  .ios-wheel-col.al-right .ios-wheel-item{text-align:right;padding-right:14px;box-sizing:border-box}
  .ios-wheel-col.al-left .ios-wheel-item{text-align:left;padding-left:14px;box-sizing:border-box}
  .ios-wheel-col.has-unit .ios-wheel-item{right:auto;width:44%;text-align:right;padding:0}
  .ios-wheel-unit{position:absolute;left:calc(44% + 6px);top:50%;height:${ITEM_H}px;margin-top:-${ITEM_H / 2}px;
    line-height:${ITEM_H}px;font-size:17px;font-weight:600;letter-spacing:-.4px;color:var(--label,#000);pointer-events:none;white-space:nowrap}
  `;
  if (OS.addStyle) OS.addStyle('_wheelpicker', css);
  else { const st = document.createElement('style'); st.textContent = css; document.head.appendChild(st); }

  const now = () => (window.performance && performance.now ? performance.now() : Date.now());
  const easeOut = (t) => 1 - Math.pow(1 - t, 4);

  // Gesture helper: OS.util.drag (screen-px aware) with a plain pointer-event fallback.
  function attachDrag(el, h) {
    if (OS.util && typeof OS.util.drag === 'function') { OS.util.drag(el, h); return; }
    let sx = 0, sy = 0, scale = 1, active = false;
    const pt = (e) => ({ x: e.clientX / scale, y: e.clientY / scale, dx: (e.clientX - sx) / scale, dy: (e.clientY - sy) / scale, vx: 0, vy: 0 });
    el.addEventListener('pointerdown', (e) => {
      if (e.button) return;
      const r = el.getBoundingClientRect();
      scale = el.offsetHeight ? r.height / el.offsetHeight || 1 : 1;
      sx = e.clientX; sy = e.clientY; active = true;
      try { el.setPointerCapture(e.pointerId); } catch (_) {}
      h.onStart && h.onStart(pt(e), e);
    });
    el.addEventListener('pointermove', (e) => { if (active) h.onMove && h.onMove(pt(e), e); });
    const end = (e) => { if (!active) return; active = false; h.onEnd && h.onEnd(pt(e), e); };
    el.addEventListener('pointerup', end);
    el.addEventListener('pointercancel', end);
  }

  function wheelPicker(container, opts) {
    opts = opts || {};
    const root = document.createElement('div');
    root.className = 'ios-wheel';
    if (opts.height) root.style.height = opts.height + 'px';
    const sel = document.createElement('div');
    sel.className = 'ios-wheel-sel';
    root.appendChild(sel);

    const cols = [];
    let raf = 0, destroyed = false, lastTick = 0;

    function norm(col, i) { const n = col.values.length; return col.loop ? ((i % n) + n) % n : Math.max(0, Math.min(n - 1, i)); }
    function labelOf(col, i) { const l = col.labels && col.labels[i]; return l != null ? String(l) : String(col.values[i]); }
    function getValues() { return cols.map((c) => c.values[c.index]); }

    function render(col) {
      const n = col.values.length;
      const base = Math.round(col.pos);
      for (let s = 0; s < POOL; s++) {
        const it = col.items[s];
        const vi = base + s - HALF;
        if (!n || (!col.loop && (vi < 0 || vi >= n))) { if (it._shown) { it.style.display = 'none'; it._shown = false; } continue; }
        const a = (vi - col.pos) * STEP;
        if (Math.abs(a) >= Math.PI / 2) { if (it._shown) { it.style.display = 'none'; it._shown = false; } continue; }
        const idx = norm(col, vi);
        if (it._idx !== idx || it._ver !== col.ver) { it.textContent = labelOf(col, idx); it._idx = idx; it._ver = col.ver; }
        it._vi = vi;
        if (!it._shown) { it.style.display = ''; it._shown = true; }
        const d = Math.abs(vi - col.pos);
        const c = Math.cos(a);
        it.style.transform = 'translateY(' + (RADIUS * Math.sin(a)).toFixed(2) + 'px) scaleY(' + c.toFixed(4) + ')';
        it.style.opacity = (Math.max(0.12, 1 - 0.58 * Math.min(1, d)) * Math.pow(c, 0.8)).toFixed(3);
      }
    }

    function tick(col) {
      const r = norm(col, Math.round(col.pos));
      if (r === col.tickIdx) return;
      col.tickIdx = r;
      const t = now();
      if (t - lastTick > 28) { lastTick = t; try { OS.haptic && OS.haptic('selection'); } catch (_) {} }
      if (opts.onTick) { const v = getValues(); v[cols.indexOf(col)] = col.values[r]; try { opts.onTick(v); } catch (_) {} }
    }

    function settle(col) {
      const n = col.values.length;
      let i = Math.round(col.pos);
      if (col.loop && n) { i = norm(col, i); }
      col.pos = i; col.anim = null;
      render(col);
      if (i !== col.index) {
        col.index = i;
        if (opts.onChange) { try { opts.onChange(getValues()); } catch (e) { console.error(e); } }
      }
    }

    function frame() {
      raf = 0;
      if (destroyed) return;
      let busy = false;
      const t = now();
      for (const col of cols) {
        if (!col.anim) continue;
        const k = Math.min(1, (t - col.anim.t0) / col.anim.dur);
        col.pos = col.anim.from + (col.anim.to - col.anim.from) * easeOut(k);
        tick(col);
        if (k >= 1) settle(col); else { render(col); busy = true; }
      }
      if (busy) raf = requestAnimationFrame(frame);
    }

    function animateTo(col, target, dur) {
      if (!col.loop) target = Math.max(0, Math.min(col.values.length - 1, target));
      col.anim = { from: col.pos, to: target, t0: now(), dur: dur || Math.max(260, Math.min(1600, 220 + Math.abs(target - col.pos) * 70)) };
      if (!raf) raf = requestAnimationFrame(frame);
    }

    function buildCol(def, i) {
      const el = document.createElement('div');
      el.className = 'ios-wheel-col';
      const col = { el, items: [], ver: 0, anim: null, pos: 0, index: 0, tickIdx: 0 };
      for (let s = 0; s < POOL; s++) {
        const it = document.createElement('div');
        it.className = 'ios-wheel-item';
        it._shown = true;
        el.appendChild(it);
        col.items.push(it);
      }
      col.unitEl = document.createElement('div');
      col.unitEl.className = 'ios-wheel-unit';
      el.appendChild(col.unitEl);
      applyDef(col, def);

      // drag
      let startPos = 0, samples = [], moved = false, tapVi = null, t0 = 0;
      attachDrag(el, {
        onStart(p, e) {
          col.anim = null;
          startPos = col.pos; moved = false; t0 = now();
          samples = [{ t: t0, pos: col.pos }];
          const item = e && e.target && e.target.closest ? e.target.closest('.ios-wheel-item') : null;
          tapVi = item && item._shown ? item._vi : null;
          root.classList.add('grabbing');
        },
        onMove(p) {
          if (Math.abs(p.dy) > 3) moved = true;
          let pos = startPos - p.dy / ITEM_H;
          const max = col.values.length - 1;
          if (!col.loop) {
            if (pos < 0) pos = pos * 0.35;
            else if (pos > max) pos = max + (pos - max) * 0.35;
          }
          col.pos = pos;
          const t = now();
          samples.push({ t, pos });
          while (samples.length > 2 && t - samples[0].t > 90) samples.shift();
          tick(col);
          render(col);
        },
        onEnd() {
          root.classList.remove('grabbing');
          if (!moved) {
            if (tapVi != null && now() - t0 < 400 && tapVi !== Math.round(col.pos)) animateTo(col, tapVi, 320);
            else animateTo(col, Math.round(col.pos), 200);
            return;
          }
          const a = samples[0], b = samples[samples.length - 1];
          let v = b.t > a.t && now() - b.t < 80 ? (b.pos - a.pos) / ((b.t - a.t) / 1000) : 0;   // rows / second
          v = Math.max(-90, Math.min(90, v));
          let target = Math.round(col.pos + v * 0.32);
          animateTo(col, target);
        },
      });
      // keep parent drag-scrollers / sheet pan gestures from also moving
      ['pointerdown', 'mousedown', 'touchstart'].forEach((ev) => el.addEventListener(ev, (e) => e.stopPropagation(), { passive: true }));
      return col;
    }

    function applyDef(col, def) {
      col.values = (def.values || []).slice();
      col.labels = def.labels ? def.labels.slice() : null;
      col.loop = !!def.loop && col.values.length > 6;
      col.ver++;
      let idx = col.values.indexOf(def.value);
      if (idx < 0 && def.value != null) idx = col.values.findIndex((v) => String(v) === String(def.value));
      if (idx < 0) idx = 0;
      col.index = idx; col.pos = idx; col.tickIdx = idx; col.anim = null;
      col.el.style.flex = def.width ? '0 0 ' + def.width + 'px' : '1 1 0';
      col.el.classList.toggle('al-right', def.align === 'right');
      col.el.classList.toggle('al-left', def.align === 'left');
      col.el.classList.toggle('has-unit', !!def.unit);
      col.unitEl.textContent = def.unit || '';
      col.unitEl.style.display = def.unit ? '' : 'none';
      render(col);
    }

    (opts.columns || []).forEach((def, i) => { const c = buildCol(def, i); cols.push(c); root.appendChild(c.el); });

    // mouse wheel / trackpad
    let wheelTimer = 0;
    root.addEventListener('wheel', (e) => {
      const colEl = e.target.closest ? e.target.closest('.ios-wheel-col') : null;
      const col = cols.find((c) => c.el === colEl);
      if (!col) return;
      e.preventDefault(); e.stopPropagation();
      col.anim = null;
      const dy = e.deltaMode === 1 ? e.deltaY * 34 : e.deltaY;
      let pos = col.pos + dy / 64;
      if (!col.loop) pos = Math.max(-0.4, Math.min(col.values.length - 0.6, pos));
      col.pos = pos;
      tick(col); render(col);
      clearTimeout(wheelTimer);
      wheelTimer = setTimeout(() => cols.forEach((c) => { if (!c.anim && c.pos !== Math.round(c.pos)) animateTo(c, Math.round(c.pos), 220); else if (!c.anim) settle(c); }), 130);
    }, { passive: false });

    if (container) container.appendChild(root);

    return {
      el: root,
      getValues,
      get values() { return getValues(); },
      setValue(i, value, animated) {
        const col = cols[i]; if (!col) return;
        let idx = col.values.indexOf(value);
        if (idx < 0) idx = col.values.findIndex((v) => String(v) === String(value));
        if (idx < 0) return;
        if (animated === false) { col.anim = null; col.index = idx; col.pos = idx; col.tickIdx = idx; render(col); return; }
        let target = idx;
        if (col.loop) {           // shortest way round the drum
          const n = col.values.length, cur = Math.round(col.pos);
          let diff = (idx - norm(col, cur)) % n; if (diff > n / 2) diff -= n; if (diff < -n / 2) diff += n;
          target = cur + diff;
        }
        col.index = idx;          // programmatic change → no onChange
        animateTo(col, target);
      },
      setColumn(i, def) { const col = cols[i]; if (col) applyDef(col, def); },
      destroy() { destroyed = true; if (raf) cancelAnimationFrame(raf); clearTimeout(wheelTimer); root.remove(); },
    };
  }

  OS.ui.wheelPicker = wheelPicker;
})();
