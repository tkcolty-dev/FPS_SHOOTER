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

  const slotsOn = (p) => (p === 0 ? 24 - widgetSlots() : 24);
  const slotPos = (p, i) => { const off = p === 0 ? widgetSlots() : 0; const k = i + off; return { x: X0 + (k % COLS) * DX, y: Y0 + Math.floor(k / COLS) * DY }; };
  const dockPos = (i, n) => { const total = n * 62 + (n - 1) * 33.34; const x0 = (378 - total) / 2; return { x: x0 + i * DX, y: DOCK_Y }; };

  function load() {
    layout = OS.store.get('home.layout', null);
    if (!layout || !Array.isArray(layout.pages)) layout = { dock: DEFAULT_DOCK.slice(), pages: DEFAULT_PAGES.map((p) => p.slice()), widgets: ['weather', 'calendar'] };
  }
  const save = () => OS.store.set('home.layout', layout);
  if (false) {}
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
    goPage(pageIdx, false); startWidgetTimer();
  }
  const queueRender = () => { if (!renderQueued) { renderQueued = true; requestAnimationFrame(render); } };

  // ── widgets (top of the first page; add/remove in jiggle mode) ──
  const WSIZE = { w: 62 * 2 + 33.34, h: 62 + DY - 4 };
  const WIDGETS = {
    weather: { name: 'Weather', app: 'weather', cls: 'w-weather', render(n) {
      const c = OS.weather && OS.weather.current && OS.weather.current();
      n.innerHTML = c ? `<div class="city">${esc(c.city || 'My Location')}</div><div class="temp">${Math.round(c.temp)}°</div><div class="cond">${esc(c.condition || '')}<br>H:${Math.round(c.high)}° L:${Math.round(c.low)}°</div>`
        : `<div class="city">Cupertino</div><div class="temp">72°</div><div class="cond">Mostly Sunny<br>H:76° L:58°</div>`;
    } },
    calendar: { name: 'Calendar', app: 'calendar', cls: 'w-cal', render(n) {
      const d = new Date(); const ev = (OS.calendar && OS.calendar.next && OS.calendar.next()) || null;
      n.innerHTML = `<div class="dow">${d.toLocaleDateString('en-US', { weekday: 'long' })}</div><div class="day">${d.getDate()}</div>` +
        (ev ? `<div class="ev" style="border-color:${ev.color || 'var(--red)'}"><b>${esc(ev.title)}</b>${esc(ev.when || '')}</div>` : '<div class="ev" style="border-color:var(--label3)">No more events today</div>');
    } },
    clock: { name: 'Clock', app: 'clock', cls: 'w-clock', tick: true, render(n) {
      const d = new Date(), s = d.getSeconds(), m = d.getMinutes(), h = d.getHours() % 12 + m / 60;
      const hand = (a, len, w, col) => `<line x1="50" y1="50" x2="${50 + Math.sin(a) * len}" y2="${50 - Math.cos(a) * len}" stroke="${col}" stroke-width="${w}" stroke-linecap="round"/>`;
      n.innerHTML = `<svg viewBox="0 0 100 100" style="width:118px;height:118px">
        <circle cx="50" cy="50" r="47" fill="#000" stroke="rgba(255,255,255,.15)"/>
        ${Array.from({ length: 12 }, (_, i) => { const a = i * Math.PI / 6; return `<line x1="${50 + Math.sin(a) * 41}" y1="${50 - Math.cos(a) * 41}" x2="${50 + Math.sin(a) * 45}" y2="${50 - Math.cos(a) * 45}" stroke="#fff" stroke-width="${i % 3 ? 1.6 : 3}" stroke-linecap="round"/>`; }).join('')}
        ${hand(h * Math.PI / 6, 25, 5.5, '#fff')}${hand(m * Math.PI / 30, 36, 4, '#fff')}${hand(s * Math.PI / 30, 39, 1.6, '#FF9F0A')}
        <circle cx="50" cy="50" r="3.4" fill="#FF9F0A"/></svg>`;
    } },
    battery: { name: 'Battery', app: 'settings', cls: 'w-batt', tick: true, render(n) {
      const p = Math.round(OS.power.level * 100), col = OS.power.charging ? '#30D158' : p <= 20 ? '#FF3B30' : '#30D158';
      n.innerHTML = `<div class="lbl">Battery</div><svg viewBox="0 0 100 100" style="width:96px;height:96px">
        <circle cx="50" cy="50" r="41" fill="none" stroke="var(--fill2)" stroke-width="11"/>
        <circle cx="50" cy="50" r="41" fill="none" stroke="${col}" stroke-width="11" stroke-linecap="round" stroke-dasharray="${2.575 * p} 999" transform="rotate(-90 50 50)"/>
        <text x="50" y="57" text-anchor="middle" font-size="25" font-weight="600" fill="var(--label)">${p}</text></svg>
        <div class="sub">${OS.power.charging ? 'Charging' : 'iPhone'}</div>`;
    } },
    music: { name: 'Music', app: 'music', cls: 'w-music', render(n) {
      const np = OS.nowPlaying.current;
      n.innerHTML = `<div class="art" style="background:${np && np.artwork ? np.artwork : 'linear-gradient(140deg,#FA5C6F,#FA233B)'};background-size:cover"></div>
        <b>${esc(np ? np.title : 'Music')}</b><span>${esc(np ? np.artist : 'Tap to listen')}</span>
        <div class="ctl">${np && np.playing ? OS.icons.pause : OS.icons.play}</div>`;
      const c = n.querySelector('.ctl');
      c.addEventListener('click', (e) => { e.stopPropagation(); if (jiggle) return; const cur = OS.nowPlaying.current; if (cur && cur.onToggle) { cur.onToggle(); OS.haptic('light'); } else OS.openApp('music'); });
    } },
    photos: { name: 'Photos', app: 'photos', cls: 'w-photos', render(n) {
      n.innerHTML = '<div class="ph"></div><div class="cap">Photos</div>';
      OS.photos.all().then((all) => { const p = all.filter((x) => x.kind !== 'video').slice(-1)[0]; if (p) { n.querySelector('.ph').style.backgroundImage = `url(${p.src})`; n.querySelector('.cap').textContent = OS.util.relDate(p.date); } });
    } },
    notes: { name: 'Notes', app: 'notes', cls: 'w-notes', render(n) {
      const list = OS.store.get('notes.items', []) || [];
      const top = list.filter((x) => !x.deleted).sort((a, b) => (b.updated || 0) - (a.updated || 0))[0];
      const body = top ? String(top.body || top.text || '').replace(/<[^>]*>/g, ' ').trim() : '';
      n.innerHTML = `<div class="band"></div><b>${esc(top ? (top.title || body.split('\n')[0] || 'Note') : 'Notes')}</b><span>${esc(top ? body.slice(0, 90) : 'Tap to write something')}</span>`;
    } },
  };
  const widgetList = () => (layout.widgets || []).filter((t) => WIDGETS[t]).slice(0, 4);
  const widgetSlots = () => Math.ceil(widgetList().length / 2) * 8;

  function buildWidgets(page) {
    widgetList().forEach((type, i) => {
      const W = WIDGETS[type]; const col = (i % 2) * 2, row = Math.floor(i / 2) * 2;
      const n = el(`<div class="widget ${W.cls}" data-w="${esc(type)}" style="left:${X0 + col * DX}px;top:${Y0 + row * DY}px;width:${WSIZE.w}px;height:${WSIZE.h}px"></div>`);
      try { W.render(n); } catch (e) { console.error('[widget ' + type + ']', e); }
      n.appendChild(el('<div class="icon-del widget-del"></div>'));
      n.addEventListener('click', (e) => {
        if (e.target.closest('.widget-del')) { layout.widgets = layout.widgets.filter((x) => x !== type); save(); OS.haptic('light'); return render(); }
        if (!jiggle && W.app) OS.openApp(W.app, null, { fromRect: OS.util.rect(n) });
      });
      page.appendChild(n);
      page.appendChild(el(`<div class="widget-label" style="left:${X0 + col * DX}px;right:auto;width:${WSIZE.w}px;top:${Y0 + row * DY + WSIZE.h + 5}px">${esc(W.name)}</div>`));
    });
  }
  function widgetGallery() {
    const taken = widgetList();
    OS.ui.sheet({ title: 'Add Widget', height: 'medium', left: { label: 'Done' }, render(body, sh) {
      body.appendChild(el('<div class="ios-list-footer" style="margin:4px 20px 12px">Widgets sit at the top of your first Home Screen. You can have four.</div>'));
      const l = el('<div class="ios-list"></div>');
      Object.entries(WIDGETS).forEach(([type, W]) => {
        const on = taken.includes(type);
        const r = el(`<div class="ios-row ${on ? '' : 'tappable'}"><span class="ios-row-label">${esc(W.name)}${on ? '<span class="ios-row-sub">Already on your Home Screen</span>' : ''}</span>${on ? '' : '<span class="ios-pill">Add</span>'}</div>`);
        if (!on) r.addEventListener('click', () => {
          if (widgetList().length >= 4) return OS.ui.toast('Remove one first — four is the limit');
          layout.widgets = widgetList().concat([type]); save(); OS.haptic('success'); sh.close(); render();
        });
        l.appendChild(r);
      });
      body.appendChild(l); body.appendChild(el('<div style="height:40px"></div>'));
    } });
  }
  let widgetTimer = 0;
  function startWidgetTimer() {
    clearInterval(widgetTimer);
    if (!widgetList().some((t) => WIDGETS[t].tick)) return;
    widgetTimer = setInterval(() => {
      if (!home || OS.lock.asleep || OS.activeApp) return;
      widgetList().forEach((t) => { if (!WIDGETS[t].tick) return; const n = home.querySelector(`.widget[data-w="${CSS.escape(t)}"]`); if (n) try { WIDGETS[t].render(n); } catch {} });
    }, 1000);
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
        const off = cur.src === 0 ? widgetSlots() : 0; const col = clamp(Math.round((cx - X0 - 31) / DX), 0, 3), row = clamp(Math.round((cy - Y0 - 31) / DY), 0, 5);
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
    home.innerHTML = `<div class="home-pages"></div><div class="home-done">Done</div><div class="home-addw">＋ Widget</div><div class="home-search"><svg viewBox="0 0 24 24">${OS.icons.search.replace(/<\/?svg[^>]*>/g, '')}</svg><span>Search</span><div class="dots"></div></div><div class="dock"></div>`;
    pagesEl = home.querySelector('.home-pages');
    load(); render();
    home.querySelector('.home-done').addEventListener('click', endJiggle);
    home.querySelector('.home-addw').addEventListener('click', widgetGallery);
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
    ['nowplaying', 'photos:change', 'power', 'weather:update'].forEach((e) => OS.on(e, queueRender));
    OS.on('apps:change', queueRender); OS.on('badge', queueRender); OS.on('weather:update', queueRender); OS.on('webapps:progress', queueRender);
    OS.on('minute', (d) => { if (d.getHours() === 0 && d.getMinutes() === 0) queueRender(); });
  };
})();
