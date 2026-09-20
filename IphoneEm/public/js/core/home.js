// Home Screen: pages + dock, jiggle mode (reorder / delete), widgets, App Library, badges
(function () {
  const { el, esc, clamp } = OS.util;
  const COLS = 4, X0 = 27, DX = 62 + 33.34, Y0 = 78, DY = 104, DOCK_X0 = 19 + 12 - 12, DOCK_Y = 15;
  const DEFAULT_DOCK = ['phone', 'safari', 'messages', 'music'];
  const DEFAULT_PAGES = [
    ['facetime', 'calendar', 'photos', 'camera', 'mail', 'notes', 'reminders', 'clock', 'weather', 'maps', 'wallet', 'settings', 'appstore', 'appmaker'],
    ['files', 'calculator', 'voicememos', 'contacts'],
  ];
  const CATEGORY = { phone: 'Social', messages: 'Social', facetime: 'Social', mail: 'Social', contacts: 'Social', settings: 'Utilities', calculator: 'Utilities', clock: 'Utilities', files: 'Utilities', voicememos: 'Utilities', safari: 'Utilities',
    camera: 'Creativity', photos: 'Creativity', appmaker: 'Creativity', music: 'Entertainment', appstore: 'Entertainment', weather: 'Information', maps: 'Information', notes: 'Productivity', reminders: 'Productivity', calendar: 'Productivity', wallet: 'Productivity' };
  let home, pagesEl, pageIdx = 0, jiggle = false, layout = null, renderQueued = false, dotsTimer = 0;

  const slotsOn = (p) => (p === 0 ? 16 : 24);
  const slotPos = (p, i) => { const off = p === 0 ? 8 : 0; const k = i + off; return { x: X0 + (k % COLS) * DX, y: Y0 + Math.floor(k / COLS) * DY }; };
  const dockPos = (i, n) => { const total = n * 62 + (n - 1) * 33.34; const x0 = (378 - total) / 2; return { x: x0 + i * DX, y: DOCK_Y }; };

  function load() {
    layout = OS.store.get('home.layout', null);
    if (!layout || !Array.isArray(layout.pages)) layout = { dock: DEFAULT_DOCK.slice(), pages: DEFAULT_PAGES.map((p) => p.slice()) };
  }
  const save = () => OS.store.set('home.layout', layout);
  function reconcile() {
    const ok = (id) => OS.isInstalled(id);
    const seen = new Set();
    const uniq = (arr) => arr.filter((id) => { if (seen.has(id)) return false; seen.add(id); return true; });
    layout.dock = uniq(layout.dock); layout.pages = layout.pages.map(uniq);
    const missing = OS.apps.filter((a) => ok(a.id) && !seen.has(a.id)).map((a) => a.id);
    missing.forEach((id) => {
      let p = layout.pages.findIndex((pg, i) => i > 0 && pg.filter(ok).length < slotsOn(i));
      if (p < 0) p = layout.pages.findIndex((pg, i) => pg.filter(ok).length < slotsOn(i));
      if (p < 0) { layout.pages.push([]); p = layout.pages.length - 1; }
      layout.pages[p].push(id);
    });
    // overflow → next page
    for (let p = 0; p < layout.pages.length; p++) { const vis = layout.pages[p].filter(ok); while (vis.length > slotsOn(p)) { const id = vis.pop(); layout.pages[p].splice(layout.pages[p].indexOf(id), 1); if (!layout.pages[p + 1]) layout.pages[p + 1] = []; layout.pages[p + 1].unshift(id); } }
  }
  const visiblePages = () => { const out = []; layout.pages.forEach((pg, i) => { const v = pg.filter((id) => OS.isInstalled(id)); if (v.length || i === 0 || jiggle) out.push({ src: i, ids: v }); }); return out; };

  function iconNode(id) {
    const def = OS.getApp(id); const badge = OS.badges()[id];
    const n = el(`<div class="icon-slot ${def.system ? 'no-del' : ''}" data-app="${esc(id)}"><div class="icon-del"></div><div class="icon">${OS.iconHTML(def)}${badge ? `<div class="icon-badge">${esc(badge)}</div>` : ''}<div class="icon-label">${esc(def.name)}</div></div></div>`);
    const prog = OS.webapps && OS.webapps.installing && OS.webapps.installing[id];
    if (prog != null) n.querySelector('.icon-img').appendChild(el(`<div class="icon-progress"><i style="--p:${prog}%"></i></div>`));
    return n;
  }

  function render() {
    renderQueued = false; if (!home) return;
    reconcile();
    const vp = visiblePages(); const total = vp.length + 1;
    pageIdx = clamp(pageIdx, 0, total - 1);
    pagesEl.innerHTML = '';
    vp.forEach((pg, pi) => {
      const page = el(`<div class="home-page" data-src="${pg.src}"></div>`);
      if (pg.src === 0) buildWidgets(page);
      pg.ids.forEach((id, i) => { const n = iconNode(id); const pos = slotPos(pg.src, i); n.style.left = pos.x + 'px'; n.style.top = pos.y + 'px'; page.appendChild(n); });
      pagesEl.appendChild(page);
    });
    pagesEl.appendChild(buildLibrary());
    pagesEl.style.width = total * OS.W + 'px';
    const dock = home.querySelector('.dock'); dock.innerHTML = '';
    const dockIds = layout.dock.filter((id) => OS.isInstalled(id));
    dockIds.forEach((id, i) => { const n = iconNode(id); const pos = dockPos(i, dockIds.length); n.style.left = pos.x + 'px'; n.style.top = pos.y + 'px'; dock.appendChild(n); });
    const dots = home.querySelector('.home-search .dots'); dots.innerHTML = Array.from({ length: total }, (_, i) => `<i class="${i === pageIdx ? 'on' : ''}"></i>`).join('');
    goPage(pageIdx, false);
  }
  const queueRender = () => { if (!renderQueued) { renderQueued = true; requestAnimationFrame(render); } };

  // ── widgets (pinned to the top of the first page) ──
  function buildWidgets(page) {
    const w = 62 * 2 + 33.34, h = 62 + DY - 4;
    const d = new Date();
    const wx = el(`<div class="widget w-weather" style="left:${X0}px;top:${Y0}px;width:${w}px;height:${h}px"></div>`);
    const cur = OS.weather && OS.weather.current && OS.weather.current();
    wx.innerHTML = cur ? `<div class="city">${esc(cur.city || 'My Location')}</div><div class="temp">${Math.round(cur.temp)}°</div><div class="cond">${esc(cur.condition || '')}<br>H:${Math.round(cur.high)}° L:${Math.round(cur.low)}°</div>`
      : `<div class="city">Cupertino</div><div class="temp">72°</div><div class="cond">Mostly Sunny<br>H:76° L:58°</div>`;
    wx.addEventListener('click', () => !jiggle && OS.openApp('weather', null, { fromRect: OS.util.rect(wx) }));
    const cal = el(`<div class="widget w-cal" style="left:${X0 + 2 * DX}px;top:${Y0}px;width:${w}px;height:${h}px"><div class="dow">${d.toLocaleDateString('en-US', { weekday: 'long' })}</div><div class="day">${d.getDate()}</div><div class="ev" style="border-color:var(--label3)">No more events today</div></div>`);
    cal.addEventListener('click', () => !jiggle && OS.openApp('calendar', null, { fromRect: OS.util.rect(cal) }));
    page.append(wx, cal);
    page.append(el(`<div class="widget-label" style="left:${X0}px;right:auto;width:${w}px;top:${Y0 + h + 5}px">Weather</div>`), el(`<div class="widget-label" style="left:${X0 + 2 * DX}px;right:auto;width:${w}px;top:${Y0 + h + 5}px">Calendar</div>`));
  }

  // ── App Library ──
  function buildLibrary() {
    const page = el('<div class="home-page app-library"><div class="al-scroll ios-scroll"><div style="height:62px"></div><div class="al-search"><span style="display:inline-flex;width:17px;height:17px;fill:none;stroke:currentColor;stroke-width:2.2">' + OS.icons.search + '</span>App Library</div><div class="al-grid"></div></div></div>');
    const grid = page.querySelector('.al-grid'); const groups = {};
    OS.apps.filter((a) => OS.isInstalled(a.id)).forEach((a) => { const c = a.category || CATEGORY[a.id] || (a.store ? (a.store.category || 'Other') : 'Other'); (groups[c] = groups[c] || []).push(a); });
    const order = ['Social', 'Utilities', 'Creativity', 'Productivity', 'Entertainment', 'Information', 'Games'];
    Object.keys(groups).sort((a, b) => (order.indexOf(a) + 1 || 99) - (order.indexOf(b) + 1 || 99)).forEach((c) => {
      const cell = el(`<div><div class="al-box"></div><div class="al-name" style="margin-top:8px">${esc(c)}</div></div>`); const box = cell.firstElementChild;
      groups[c].slice(0, 4).forEach((a) => { const n = el(`<div class="icon" data-app="${esc(a.id)}">${OS.iconHTML(a)}</div>`); n.addEventListener('click', () => OS.openApp(a.id, null, { fromRect: OS.util.rect(n) })); box.appendChild(n); });
      grid.appendChild(cell);
    });
    page.querySelector('.al-search').addEventListener('click', () => OS.spotlight.open());
    return page;
  }

  function goPage(i, animate = true) {
    const total = pagesEl.children.length; pageIdx = clamp(i, 0, total - 1);
    pagesEl.classList.toggle('dragging', !animate); pagesEl.style.transform = `translateX(${-pageIdx * OS.W}px)`;
    if (!animate) { pagesEl.getBoundingClientRect(); pagesEl.classList.remove('dragging'); }
    home.querySelectorAll('.home-search .dots i').forEach((d, k) => d.classList.toggle('on', k === pageIdx));
    const lib = pageIdx === total - 1; home.querySelector('.dock').style.cssText = lib ? 'opacity:0;pointer-events:none;transition:opacity .3s' : 'transition:opacity .3s'; home.querySelector('.home-search').style.opacity = lib ? '0' : '';
  }
  function flashDots() { const s = home.querySelector('.home-search'); s.classList.add('paging'); clearTimeout(dotsTimer); dotsTimer = setTimeout(() => s.classList.remove('paging'), 1400); }

  // ── jiggle mode ──
  function startJiggle() { if (jiggle) return; jiggle = true; home.classList.add('jiggle'); OS.haptic('medium'); }
  function endJiggle() { if (!jiggle) return; jiggle = false; home.classList.remove('jiggle'); save(); queueRender(); }
  async function removeApp(id) {
    const def = OS.getApp(id); if (!def || def.system) return;
    const i = await OS.ui.alert({ title: `Remove “${def.name}”?`, message: 'Removing from Home Screen will delete the app and its data.', buttons: [{ label: 'Delete App', style: 'destructive' }, { label: 'Cancel', style: 'cancel' }] });
    if (i !== 0) return;
    OS.killApp(id);
    if (OS.webapps && OS.webapps.isWebApp(id)) OS.webapps.uninstall(id);
    else { const r = OS.store.get('home.removed', []); r.push(id); OS.store.set('home.removed', r); }
    layout.dock = layout.dock.filter((x) => x !== id); layout.pages = layout.pages.map((p) => p.filter((x) => x !== id)); save(); OS.badge(id, 0); render();
  }

  function initIconDrag() {
    let slot = null, id = null, ghostHome = null, edgeTimer = 0, offX = 0, offY = 0;
    const place = (p) => { slot.style.left = p.x - offX + 'px'; slot.style.top = p.y - offY + 'px'; };
    const removeFromLayout = () => { layout.dock = layout.dock.filter((x) => x !== id); layout.pages = layout.pages.map((pg) => pg.filter((x) => x !== id)); };
    function retarget(p) {
      const vp = visiblePages(); const cur = vp[pageIdx]; if (!cur) return;
      const cx = p.x - offX + 31, cy = p.y - offY + 31;
      removeFromLayout();
      if (cy > 752) { // dock
        const ids = layout.dock.filter((x) => OS.isInstalled(x)); if (ids.length >= 4) { layout.pages[cur.src].push(id); } else { const idx = clamp(Math.round((cx - 60) / DX), 0, ids.length); layout.dock.splice(idx, 0, id); }
      } else {
        const off = cur.src === 0 ? 8 : 0; const col = clamp(Math.round((cx - X0 - 31) / DX), 0, 3), row = clamp(Math.round((cy - Y0 - 31) / DY), 0, 5);
        const pg = layout.pages[cur.src]; const vis = pg.filter((x) => OS.isInstalled(x));
        let idx = clamp(row * COLS + col - off, 0, vis.length);
        if (vis.length >= slotsOn(cur.src)) { const last = vis[vis.length - 1]; pg.splice(pg.indexOf(last), 1); if (!layout.pages[cur.src + 1]) layout.pages[cur.src + 1] = []; layout.pages[cur.src + 1].unshift(last); }
        const before = vis[idx]; const at = before ? pg.indexOf(before) : pg.length; pg.splice(at < 0 ? pg.length : at, 0, id);
      }
      relayout();
    }
    function relayout() {   // move existing nodes to their new slots without rebuilding (keeps the jiggle smooth)
      const vp = visiblePages();
      vp.forEach((pg, pi) => { const pageEl = pagesEl.children[pi]; if (!pageEl) return; pg.ids.forEach((aid, i) => { if (aid === id) return; let n = home.querySelector(`.icon-slot[data-app="${CSS.escape(aid)}"]`); if (!n) return; if (n.parentElement !== pageEl) pageEl.appendChild(n); const pos = slotPos(pg.src, i); n.style.left = pos.x + 'px'; n.style.top = pos.y + 'px'; }); });
      const dock = home.querySelector('.dock'); const dIds = layout.dock.filter((x) => OS.isInstalled(x));
      dIds.forEach((aid, i) => { if (aid === id) return; const n = home.querySelector(`.icon-slot[data-app="${CSS.escape(aid)}"]`); if (!n) return; if (n.parentElement !== dock) dock.appendChild(n); const pos = dockPos(i, dIds.length); n.style.left = pos.x + 'px'; n.style.top = pos.y + 'px'; });
    }
    OS.util.drag(home, {
      threshold: 5, filter: (e) => jiggle && !!e.target.closest('.icon-slot') && !e.target.closest('.icon-del') && !e.target.closest('.app-library'),
      onStart(p, e) { slot = e.target.closest('.icon-slot'); id = slot.dataset.app; const r = OS.util.rect(slot); offX = p.startX - r.x; offY = p.startY - r.y; slot.classList.add('dragging'); home.appendChild(slot); place(p); OS.haptic('light'); },
      onMove(p) {
        place(p); clearTimeout(edgeTimer);
        const total = pagesEl.children.length - 1;
        if (p.x > OS.W - 26 && pageIdx < total - 1 + (jiggle ? 0 : 0)) edgeTimer = setTimeout(() => { if (pageIdx + 1 >= visiblePages().length) { layout.pages.push([]); render(); home.appendChild(slot); } goPage(pageIdx + 1); flashDots(); }, 550);
        else if (p.x < 26 && pageIdx > 0) edgeTimer = setTimeout(() => { goPage(pageIdx - 1); flashDots(); }, 550);
        else edgeTimer = setTimeout(() => retarget(p), 140);
      },
      onEnd(p) { clearTimeout(edgeTimer); retarget(p); slot.classList.remove('dragging'); slot = null; layout.pages = layout.pages.filter((pg, i) => i === 0 || pg.length); save(); render(); },
    });
  }

  OS.home = {
    render: queueRender, endJiggle, startJiggle,
    get jiggling() { return jiggle; },
    visibleIcon(id) {
      const sel = `.icon-slot[data-app="${CSS.escape(id)}"] .icon-img, .al-box .icon[data-app="${CSS.escape(id)}"] .icon-img`;
      const page = pagesEl && pagesEl.children[pageIdx];
      return (page && page.querySelector(sel)) || home.querySelector(`.dock ${sel.split(',')[0]}`) || null;
    },
    goFirstPageOrStay() { if (pageIdx !== 0) { goPage(0); flashDots(); } },
    resetLayout() { OS.store.remove('home.layout'); OS.store.remove('home.removed'); load(); render(); },
    pageOf(id) { const vp = visiblePages(); return vp.findIndex((pg) => pg.ids.includes(id)); },
    showApp(id) { const p = OS.home.pageOf(id); if (p >= 0) goPage(p); },
  };

  OS.initHome = function () {
    home = document.getElementById('home');
    home.innerHTML = `<div class="home-pages"></div><div class="home-done">Done</div><div class="home-search"><svg viewBox="0 0 24 24">${OS.icons.search.replace(/<\/?svg[^>]*>/g, '')}</svg><span>Search</span><div class="dots"></div></div><div class="dock"></div>`;
    pagesEl = home.querySelector('.home-pages');
    load(); render();
    home.querySelector('.home-done').addEventListener('click', endJiggle);
    home.querySelector('.home-search').addEventListener('click', () => !jiggle && OS.spotlight.open());
    home.addEventListener('click', (e) => {
      const del = e.target.closest('.icon-del'); if (del) return removeApp(del.parentElement.dataset.app);
      const slot = e.target.closest('.icon-slot'); if (slot) { if (jiggle) return; if (OS.webapps && OS.webapps.installing[slot.dataset.app] != null) return; return OS.openApp(slot.dataset.app); }
      if (jiggle && !e.target.closest('.widget')) endJiggle();
    });
    OS.util.longPress(home, (e) => { if (e.target.closest('.app-library')) return; startJiggle(); }, 520);
    // page swipes + pull-down for Spotlight
    let startX = 0;
    OS.util.drag(home, { axis: 'x', threshold: 8, filter: (e) => !(jiggle && e.target.closest('.icon-slot')),
      onStart() { startX = -pageIdx * OS.W; pagesEl.classList.add('dragging'); flashDots(); },
      onMove(p) { const total = pagesEl.children.length; let x = startX + p.dx; const min = -(total - 1) * OS.W; if (x > 0) x *= .35; if (x < min) x = min + (x - min) * .35; pagesEl.style.transform = `translateX(${x}px)`; },
      onEnd(p) { pagesEl.classList.remove('dragging'); let t = pageIdx; if (p.dx < -70 || p.vx < -.4) t++; else if (p.dx > 70 || p.vx > .4) t--; goPage(t); flashDots(); } });
    OS.util.drag(home, { axis: 'y', threshold: 14, filter: (e) => !jiggle && !e.target.closest('.app-library') && OS.util.screenPoint(e).y < 720,
      onEnd(p) { if (p.dy > 60) OS.spotlight.open(); } });
    initIconDrag();
    OS.on('apps:change', queueRender); OS.on('badge', queueRender); OS.on('weather:update', queueRender); OS.on('webapps:progress', queueRender);
    OS.on('minute', (d) => { if (d.getHours() === 0 && d.getMinutes() === 0) queueRender(); });
  };
})();
