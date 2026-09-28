// BiteWise UI. Screens: Today, Progress, Coach, Me + the Log sheet (Quick / Voice / Type) and onboarding.
(function () {
  const $ = (s, r = document) => r.querySelector(s);
  const $$ = (s, r = document) => [...r.querySelectorAll(s)];
  const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const fmt = n => Math.round(n).toLocaleString();
  const haptic = (ms = 8) => { try { navigator.vibrate?.(ms); } catch {} };
  const cap = s => s.charAt(0).toUpperCase() + s.slice(1);
  const { LS } = BW;

  // ---------- icons (SF Symbols-style line icons) ----------
  const P = {
    today: '<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/>',
    chart: '<path d="M4 20V10M10 20V4M16 20v-7M22 20H2"/>',
    plus: '<path d="M12 5v14M5 12h14"/>',
    coach: '<path d="M12 3l1.8 4.7L18.5 9.5l-4.7 1.8L12 16l-1.8-4.7L5.5 9.5l4.7-1.8z"/><path d="M19 15l.8 2.2L22 18l-2.2.8L19 21l-.8-2.2L16 18l2.2-.8z"/>',
    me: '<circle cx="12" cy="8" r="4"/><path d="M4 21c1.5-4 4.5-6 8-6s6.5 2 8 6"/>',
    mic: '<rect x="9" y="3" width="6" height="11" rx="3"/><path d="M5 11a7 7 0 0014 0M12 18v3"/>',
    keyboard: '<rect x="2" y="6" width="20" height="12" rx="2"/><path d="M6 10h.01M10 10h.01M14 10h.01M18 10h.01M7 14h10"/>',
    grid: '<path d="M5 5h.01M12 5h.01M19 5h.01M5 12h.01M12 12h.01M19 12h.01M5 19h.01M12 19h.01M19 19h.01" stroke-width="3.2"/>',
    flame: '<path d="M12 22c4 0 7-2.7 7-7 0-3-1.6-5.4-3.4-7.4-.4 1.7-1.3 3-2.6 3.4C13.5 7.4 12 4.5 9.5 2 9.8 5.5 5 8.5 5 15c0 4.3 3 7 7 7z"/>',
    drop: '<path d="M12 3s6 6.4 6 11a6 6 0 01-12 0c0-4.6 6-11 6-11z"/>',
    shoe: '<path d="M3 16l1-8c2 0 3 1.5 4.5 1.5S11 8 12 8c.5 3 3 5 6 5.5 2 .4 3 1.2 3 2.5v1H3z"/><path d="M3 19h18"/>',
    scale: '<rect x="3" y="3" width="18" height="18" rx="4"/><path d="M8 9a5 5 0 018 0M12 9l1.5-2"/>',
    trophy: '<path d="M8 21h8M12 17v4M7 4h10v5a5 5 0 01-10 0zM7 6H4v1a3 3 0 003 3M17 6h3v1a3 3 0 01-3 3"/>',
    target: '<circle cx="12" cy="12" r="9"/><circle cx="12" cy="12" r="5"/><circle cx="12" cy="12" r="1"/>',
    crown: '<path d="M3 8l4 4 5-7 5 7 4-4-2 11H5z"/>',
    sun: '<circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4"/>',
    heart: '<path d="M12 20s-7-4.4-7-10a4 4 0 017-2.6A4 4 0 0119 10c0 5.6-7 10-7 10z"/>',
    spark: '<path d="M12 3l1.8 4.7L18.5 9.5l-4.7 1.8L12 16l-1.8-4.7L5.5 9.5l4.7-1.8z"/>',
    bite: '<path d="M12 7c-1-2-3-3-5-2.5C4 5.3 3 8.5 3.6 12c.8 4.5 3.4 8 5.9 8 1 0 1.6-.5 2.5-.5s1.5.5 2.5.5c2.5 0 5.1-3.5 5.9-8 .2-1.4.2-2.6-.1-3.7a2.5 2.5 0 01-3.3-3A5.3 5.3 0 0012 7zM12 7c0-2 1-3.5 3-4"/>',
    check: '<path d="M5 12.5l4.5 4.5L19 7.5"/>',
    x: '<path d="M6 6l12 12M18 6L6 18"/>',
    xcircle: '<circle cx="12" cy="12" r="9"/><path d="M9 9l6 6M15 9l-6 6"/>',
    right: '<path d="M9 5l7 7-7 7"/>',
    left: '<path d="M15 5l-7 7 7 7"/>',
    trash: '<path d="M4 7h16M10 11v6M14 11v6M6 7l1 13h10l1-13M9 7V4h6v3"/>',
    up: '<path d="M12 19V5M5 12l7-7 7 7"/>',
    offline: '<path d="M2 8.5a15 15 0 015-3M22 8.5A15 15 0 0010.5 4M5 12a10 10 0 014-2.3M19 12a10 10 0 00-3.2-2M8.5 15.5a5 5 0 016.2-.6M12 19.5h.01M3 3l18 18"/>',
    sync: '<path d="M20 11a8 8 0 00-14.5-4.5L4 8M4 4v4h4M4 13a8 8 0 0014.5 4.5L20 16M20 20v-4h-4"/>',
    watch: '<rect x="6" y="6" width="12" height="12" rx="3"/><path d="M9 6l.5-3h5l.5 3M9 18l.5 3h5l.5-3M12 9.5v2.5l1.5 1"/>',
    lock: '<rect x="5" y="11" width="14" height="10" rx="2"/><path d="M8 11V8a4 4 0 018 0v3"/>',
    gift: '<rect x="3" y="8" width="18" height="4" rx="1"/><path d="M5 12v9h14v-9M12 8v13M12 8S10.5 3 8 4s0 4 4 4zM12 8s1.5-5 4-4 0 4-4 4z"/>',
    star: '<path d="M12 3l2.7 5.6 6.1.9-4.4 4.3 1 6.1L12 17l-5.4 2.9 1-6.1L3.2 9.5l6.1-.9z"/>',
    bolt: '<path d="M13 2L4 14h7l-1 8 9-12h-7z"/>',
    fork: '<path d="M7 3v8M5 3v5a2 2 0 004 0V3M7 11v10M17 21V3c-2 0-3.5 2.5-3.5 6s1.5 4 3.5 4"/>',
    edit: '<path d="M4 20h4L19 9l-4-4L4 16zM13.5 6.5l4 4"/>',
    download: '<path d="M12 4v11M7 10l5 5 5-5M5 20h14"/>',
    share: '<path d="M12 3v12M8 7l4-4 4 4M6 11H5v9h14v-9h-1"/>',
    delete: '<path d="M22 5H9l-6 7 6 7h13zM17 9l-6 6M11 9l6 6"/>',
    cloud: '<path d="M7 18h10a4 4 0 00.5-8 6 6 0 00-11.3 1.5A3.3 3.3 0 007 18z"/>',
    info: '<circle cx="12" cy="12" r="9"/><path d="M12 11v6M12 7.5h.01"/>',
    palette: '<path d="M12 3a9 9 0 000 18c1.5 0 2-1 2-2s-1-1.5-1-2.5 1-1.5 2-1.5h2a4 4 0 004-4c0-4.4-4-8-9-8z"/><circle cx="7.5" cy="11" r="1"/><circle cx="10" cy="7" r="1"/><circle cx="15" cy="7" r="1"/>',
    snow: '<path d="M12 2v20M4 6l16 12M20 6L4 18"/>',
    person: '<circle cx="12" cy="8" r="4"/><path d="M4 21c1.5-4 4.5-6 8-6s6.5 2 8 6"/>',
  };
  const I = (n, extra = '') => `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" ${extra}>${P[n] || ''}</svg>`;
  const BADGE_COLORS = { bite: '#FF9500', flame: '#FF3B30', crown: '#FFB800', drop: '#32ADE6', shoe: '#34C759', target: '#AF52DE', scale: '#5AC8FA', trophy: '#FFB800', mic: '#FF2D55', spark: '#5856D6', sun: '#FF9500', heart: '#FF2D55' };

  // ---------- themes (rewards) ----------
  const THEMES = [
    { id: 'fresh', name: 'Fresh', color: '#2FB866', dark: '#34D07A', level: 1 },
    { id: 'ocean', name: 'Ocean', color: '#007AFF', dark: '#0A84FF', level: 2 },
    { id: 'sunset', name: 'Sunset', color: '#FF7A2F', dark: '#FF8A45', level: 3 },
    { id: 'berry', name: 'Berry', color: '#FF2D6F', dark: '#FF4D85', level: 5 },
    { id: 'grape', name: 'Grape', color: '#8E5CF7', dark: '#A77BFF', level: 7 },
    { id: 'gold', name: 'Gold', color: '#D99A00', dark: '#FFC53D', level: 9 },
  ];
  const darkMode = () => matchMedia('(prefers-color-scheme: dark)').matches;
  function applyTheme() {
    const t = THEMES.find(x => x.id === BW.profile().theme) || THEMES[0];
    document.documentElement.style.setProperty('--accent', darkMode() ? t.dark : t.color);
    $('meta[name="theme-color"]')?.setAttribute('content', darkMode() ? '#000000' : '#F2F2F7');
  }
  matchMedia('(prefers-color-scheme: dark)').addEventListener?.('change', applyTheme);

  // ---------- app state ----------
  const S = { tab: 'today', date: BW.dayKey(), progRange: 7, status: { ai: false, fitbit: false, model: '' }, online: navigator.onLine, coachBusy: false, installEvt: null };
  const MEALS = [['breakfast', 'Breakfast'], ['lunch', 'Lunch'], ['dinner', 'Dinner'], ['snack', 'Snacks']];
  const dayLabel = k => { const t = BW.dayKey(); if (k === t) return 'Today'; if (k === BW.addDays(t, -1)) return 'Yesterday'; return BW.parseDay(k).toLocaleDateString(undefined, { weekday: 'long' }); };
  const longDate = k => BW.parseDay(k).toLocaleDateString(undefined, { weekday: 'long', month: 'long', day: 'numeric' });

  // ---------- toast ----------
  let toastT;
  function toast(msg, { undo, icon = 'check' } = {}) {
    let t = $('#toast');
    if (!t) { t = document.createElement('div'); t.id = 'toast'; t.className = 'toast'; t.setAttribute('role', 'status'); document.body.appendChild(t); }
    t.innerHTML = `<span class="ticon">${I(icon)}</span><span>${esc(msg)}</span>${undo ? '<button class="undo" type="button">Undo</button>' : '<span style="width:6px"></span>'}`;
    if (undo) t.querySelector('.undo').onclick = () => { undo(); t.classList.remove('show'); haptic(); };
    requestAnimationFrame(() => t.classList.add('show'));
    clearTimeout(toastT); toastT = setTimeout(() => t.classList.remove('show'), undo ? 4200 : 2400);
  }

  // ---------- confetti ----------
  function confetti(n = 120) {
    if (matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    let c = $('#confetti'); if (!c) { c = document.createElement('canvas'); c.id = 'confetti'; document.body.appendChild(c); }
    const dpr = devicePixelRatio || 1; c.width = innerWidth * dpr; c.height = innerHeight * dpr;
    const x = c.getContext('2d'), cols = ['#FF3B30', '#FF9500', '#FFCC00', '#34C759', '#007AFF', '#AF52DE', '#FF2D55'];
    const bits = Array.from({ length: n }, (_, i) => ({ x: innerWidth / 2 + (Math.random() - .5) * 80, y: innerHeight * .35, vx: (Math.random() - .5) * 16, vy: -Math.random() * 16 - 5, s: 6 + Math.random() * 6, a: Math.random() * 6, va: (Math.random() - .5) * .4, c: cols[i % cols.length], life: 1 }));
    const step = () => {
      x.setTransform(dpr, 0, 0, dpr, 0, 0); x.clearRect(0, 0, innerWidth, innerHeight);
      let alive = 0;
      for (const b of bits) { b.vy += .42; b.vx *= .985; b.x += b.vx; b.y += b.vy; b.a += b.va; b.life -= .007; if (b.life > 0 && b.y < innerHeight + 30) { alive++; x.save(); x.globalAlpha = Math.max(0, b.life); x.translate(b.x, b.y); x.rotate(b.a); x.fillStyle = b.c; x.fillRect(-b.s / 2, -b.s / 4, b.s, b.s / 2); x.restore(); } }
      if (alive) requestAnimationFrame(step); else x.clearRect(0, 0, innerWidth, innerHeight);
    };
    requestAnimationFrame(step);
  }

  // ---------- sheets ----------
  const sheets = [];
  function openSheet({ title = '', left = 'Cancel', right = '', onRight, body, mount, onClose, tall }) {
    const scrim = document.createElement('div'); scrim.className = 'scrim';
    const sh = document.createElement('div'); sh.className = 'sheet'; sh.setAttribute('role', 'dialog'); sh.setAttribute('aria-modal', 'true'); sh.setAttribute('aria-label', title || 'Sheet');
    if (tall) sh.style.height = 'calc(100% - env(safe-area-inset-top, 0px) - 18px)';
    sh.innerHTML = `<div class="grabber"></div><div class="sheet-head"><button class="link-btn l" type="button" data-close>${esc(left)}</button><h3>${esc(title)}</h3><span class="r">${right ? `<button class="link-btn" type="button" data-right>${esc(right)}</button>` : ''}</span></div><div class="sheet-body"></div>`;
    sh.querySelector('.sheet-body').innerHTML = body || '';
    document.body.append(scrim, sh);
    const entry = { sh, scrim, onClose };
    sheets.push(entry);
    const close = () => closeSheet(entry);
    entry.close = close;
    scrim.onclick = close;
    sh.querySelector('[data-close]').onclick = close;
    if (onRight) sh.querySelector('[data-right]').onclick = () => onRight(close);
    // drag down on the grabber/header to dismiss
    let y0 = null, dy = 0;
    const head = sh.querySelector('.sheet-head'), grab = sh.querySelector('.grabber');
    [head, grab].forEach(el => {
      el.addEventListener('pointerdown', e => { if (e.target.closest('button')) return; y0 = e.clientY; dy = 0; sh.style.transition = 'none'; el.setPointerCapture(e.pointerId); });
      el.addEventListener('pointermove', e => { if (y0 == null) return; dy = Math.max(0, e.clientY - y0); sh.style.transform = `translateY(${dy}px)`; });
      el.addEventListener('pointerup', () => { if (y0 == null) return; sh.style.transition = ''; sh.style.transform = ''; y0 = null; if (dy > 110) close(); });
    });
    requestAnimationFrame(() => { scrim.classList.add('show'); sh.classList.add('show'); });
    mount && mount(sh.querySelector('.sheet-body'), close, sh);
    return entry;
  }
  function closeSheet(entry) {
    const i = sheets.indexOf(entry); if (i < 0) return; sheets.splice(i, 1);
    entry.sh.classList.remove('show'); entry.scrim.classList.remove('show');
    entry.onClose && entry.onClose();
    setTimeout(() => { entry.sh.remove(); entry.scrim.remove(); }, 380);
  }
  document.addEventListener('keydown', e => {
    if (e.key === 'Escape' && sheets.length) return sheets[sheets.length - 1].close();
    if (e.target.closest?.('input, textarea, select, [contenteditable]') || e.metaKey || e.ctrlKey || e.altKey || sheets.length || !BW.profile().setup) return;
    const k = e.key.toLowerCase();
    if (k === 'n' || k === 'l') { e.preventDefault(); openLog(); }
    else if (k === 'v') { e.preventDefault(); openLog({ mode: 'voice' }); }
    else if (k === 't') { e.preventDefault(); openLog({ mode: 'type' }); }
    else if ('1234'.includes(k) && k) go(['today', 'progress', 'coach', 'me'][+k - 1]);
    else if (k === 'arrowleft' && S.tab === 'today') { S.date = BW.addDays(S.date, -1); render(); }
    else if (k === 'arrowright' && S.tab === 'today' && S.date < BW.dayKey()) { S.date = BW.addDays(S.date, 1); render(); }
  });

  // ---------- small SVG helpers ----------
  function ringSVG(rings, size = 168) {
    const c = size / 2, w = size * .1;
    return `<svg viewBox="0 0 ${size} ${size}">${rings.map((r, i) => {
      const rad = c - w / 2 - i * (w + 3), L = 2 * Math.PI * rad, p = Math.max(0, Math.min(r.pct, 1));
      return `<circle cx="${c}" cy="${c}" r="${rad}" fill="none" stroke="${r.color}" stroke-opacity=".2" stroke-width="${w}"/>
        <circle cx="${c}" cy="${c}" r="${rad}" fill="none" stroke-linecap="round" stroke="${r.color}" stroke-width="${w}" stroke-dasharray="${L}" stroke-dashoffset="${L * (1 - p)}"/>
        ${r.pct > 1 ? `<circle cx="${c}" cy="${c}" r="${rad}" fill="none" stroke-linecap="round" stroke="${r.over || r.color}" stroke-width="${w}" stroke-dasharray="${L}" stroke-dashoffset="${L * (1 - Math.min(1, r.pct - 1))}" opacity=".9"/>` : ''}`;
    }).join('')}</svg>`;
  }
  const miniRing = (pct, color, label) => `<div class="mini">${ringSVG([{ pct, color }], 34)}<b>${label}</b></div>`;

  // ---------- rendering ----------
  function render() {
    const p = BW.profile();
    if (!p.setup) return renderOnboarding();
    applyTheme();
    const active = document.activeElement, focusId = active?.id, selS = active?.selectionStart, selE = active?.selectionEnd;
    const view = $('#view');
    const html = S.tab === 'today' ? viewToday() : S.tab === 'progress' ? viewProgress() : S.tab === 'coach' ? viewCoach() : viewMe();
    view.innerHTML = html;
    $$('.tab').forEach(t => t.setAttribute('aria-selected', t.dataset.tab === S.tab));
    $('#tabbar').hidden = false;
    bindView();
    updateMinibar();
    if (focusId && $('#' + focusId)) { const el = $('#' + focusId); el.focus({ preventScroll: true }); try { el.setSelectionRange(selS, selE); } catch {} }
  }

  function offlinePill() {
    if (!S.online) return `<span class="pill" title="You're offline — everything still works">${I('offline')}Offline</span>`;
    if (BW.acct() && BW.syncing) return `<span class="pill">${I('sync')}Syncing</span>`;
    return '';
  }

  const finePointer = matchMedia('(hover: hover) and (pointer: fine)').matches;
  function qHint(v = S.qdraft || '') {
    const meal = cap(S.date === BW.dayKey() ? BW.mealForNow() : 'lunch');
    v = v.trim();
    if (!v) return `${finePointer ? 'Type a number or what you ate · ' : ''}Adds to <b>${meal}</b>${S.date !== BW.dayKey() ? ' on ' + BW.parseDay(S.date).toLocaleDateString(undefined, { month: 'short', day: 'numeric' }) : ''} · <button type="button" class="link-btn" data-act="log" style="font-size:13px">more options</button>`;
    if (/^\d+$/.test(v)) return `Add <b>${fmt(+v)} cal</b> to ${meal} · press Enter`;
    const r = BW_PARSE.parseLog(v);
    if (!r.items.length) return 'Type a number, or what you ate';
    return r.items.map(i => `${esc(i.name)} <b>${i.calories ?? '?'}</b>`).join(' · ') + (r.allKnown ? ` = <b>${fmt(r.total)} cal</b>` : ' · Enter to finish');
  }
  function viewToday() {
    const p = BW.profile(), k = S.date, d = BW.day(k), st = BW.streak(), h = BW.health(k), today = BW.dayKey();
    const pctCal = d.eaten / d.budget, over = d.remaining < 0;
    const ws = BW.weekStart(k);
    const week = Array.from({ length: 7 }, (_, i) => {
      const dk = BW.addDays(ws, i), dd = BW.day(dk);
      const pct = dd.eaten / dd.budget, col = pct > 1.1 ? 'var(--orange)' : 'var(--accent)';
      return `<button class="wd ${dk > today ? 'future' : ''}" type="button" data-day="${dk}" aria-current="${dk === k}" aria-label="${longDate(dk)}"><span class="n">${BW.parseDay(dk).toLocaleDateString(undefined, { weekday: 'narrow' })}</span>${miniRing(pct, col, BW.parseDay(dk).getDate())}</button>`;
    }).join('');
    const ch = BW.challenge();
    const usuals = BW.frequent().slice(0, 6);
    const src = s => s === 'voice' ? 'mic' : s === 'text' ? 'keyboard' : s === 'coach' ? 'spark' : 'bolt';
    return `
    <div class="topbar fade-in">
      <div><div class="subtitle">${longDate(k)}</div><h1 class="large-title">${dayLabel(k)}</h1></div>
      <div style="display:flex;gap:6px;align-items:center">${offlinePill()}<button class="pill" type="button" data-act="streak" style="color:var(--orange)">${I('flame')}<span class="num">${st.days}</span></button></div>
    </div>
    <div class="cols"><div class="col-main">
    <div class="card" id="heroCard">
      <div class="hero">
        <button class="rings" type="button" data-act="rings" aria-label="Calories, steps and water rings">
          ${ringSVG([{ pct: pctCal, color: over ? 'var(--orange)' : 'var(--accent)', over: 'var(--orange)' }, { pct: d.steps / p.stepGoal, color: 'var(--pink)' }, { pct: d.water / p.waterGoal, color: 'var(--cyan)' }])}
          <div class="center"><div><div class="big num">${fmt(Math.abs(d.remaining))}</div><div class="lbl">${over ? 'Over' : 'Left'}</div></div></div>
        </button>
        <div class="legend">
          <div class="li"><div class="k"><i style="background:${over ? 'var(--orange)' : 'var(--accent)'}"></i>Eaten</div><div class="v num">${fmt(d.eaten)}<small>/ ${fmt(d.budget)}</small></div></div>
          <div class="li"><div class="k"><i style="background:var(--pink)"></i>Steps</div><div class="v num">${fmt(d.steps)}${d.bonus ? `<small>+${d.bonus} cal</small>` : ''}</div></div>
          <div class="li"><div class="k"><i style="background:var(--cyan)"></i>Water</div><div class="v num">${d.water}<small>/ ${p.waterGoal} glasses</small></div></div>
        </div>
      </div>
      <form class="qlog" id="qlogForm" autocomplete="off">
        <label class="qfield"><input id="qcal" inputmode="${finePointer ? 'text' : 'numeric'}" enterkeyhint="done" placeholder="Add calories" value="${esc(S.qdraft || '')}" aria-label="Add calories"><span class="u">cal</span></label>
        <button class="qadd" type="submit" ${S.qdraft ? '' : 'disabled'} aria-label="Add">${I('plus')}</button>
        <button class="qicon" type="button" data-act="voice" aria-label="Log with your voice">${I('mic')}</button>
        <button class="qicon" type="button" data-act="type" aria-label="Type what you ate">${I('keyboard')}</button>
      </form>
      <div class="qhint" id="qhint">${qHint()}</div>
      ${usuals.length ? `<div class="chips" style="margin-top:10px">${usuals.map((u, i) => `<button class="chip fill" type="button" data-usual="${i}">${esc(u.name)} <span class="k num">${u.calories}</span></button>`).join('')}</div>` : ''}
    </div>

    <div class="week" style="margin:18px -4px 0">${week}</div>

    ${MEALS.map(([m, label]) => {
      const es = d.meals[m], tot = es.reduce((a, e) => a + e.calories, 0);
      return `<div class="meal-head"><h3>${label}</h3><span class="t">${tot ? fmt(tot) + ' cal' : ''}</span></div>
      <div class="group">${es.map(e => `<div class="swipe"><div class="del" data-del="${e.id}">Delete</div><div class="row entry tap" data-entry="${e.id}" role="button" tabindex="0"><span class="src">${I(src(e.source))}</span><div class="grow"><div class="title">${esc(e.name)}</div><div class="sub">${new Date(e.time).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })}</div></div><span class="kcal">${fmt(e.calories)}</span></div></div>`).join('')}
      <button class="row add-row" type="button" data-addmeal="${m}">${I('plus', 'style="width:20px;height:20px"')} Add ${label === 'Snacks' ? 'a snack' : label.toLowerCase()}</button></div>`;
    }).join('')}
    </div><div class="col-side">
    <div class="section">
      <div class="duo">
        <div class="card">
          <div class="card-title"><span class="dot" style="background:var(--cyan)">${I('drop', 'style="width:13px;height:13px"')}</span>Water</div>
          <div class="stat"><div class="v num">${d.water}<small> / ${p.waterGoal}</small></div></div>
          <div class="water-glasses" style="margin:10px 0 12px">${Array.from({ length: Math.max(p.waterGoal, d.water) }, (_, i) => `<span class="glass ${i < d.water ? 'on' : ''}"></span>`).join('')}</div>
          <div class="stepper" style="width:max-content"><button type="button" data-water="-1" aria-label="Remove a glass">−</button><button type="button" data-water="1" aria-label="Add a glass">+</button></div>
        </div>
        <button class="card" type="button" data-act="steps" style="text-align:left">
          <div class="card-title"><span class="dot" style="background:var(--pink)">${I('shoe', 'style="width:13px;height:13px"')}</span>Steps<span class="more">›</span></div>
          <div class="stat"><div class="v num">${fmt(d.steps)}</div></div>
          <div class="bar" style="margin:12px 0 8px"><i style="width:${Math.min(100, d.steps / p.stepGoal * 100)}%;background:var(--pink)"></i></div>
          <div class="caption">${BW.stepSource(k) === 'fitbit' ? 'From Fitbit · ' : ''}Goal ${fmt(p.stepGoal)}${p.earnSteps ? ` · earned <b style="color:var(--label)">${d.bonus} cal</b>` : ''}</div>
        </button>
      </div>
    </div>

    <div class="section">
      <button class="card" type="button" data-act="health" style="width:100%;text-align:left">
        <div style="display:flex;gap:14px;align-items:center">
          <div class="score-ring">${ringSVG([{ pct: h.score / 100, color: h.score >= 70 ? 'var(--green)' : h.score >= 40 ? 'var(--yellow)' : 'var(--orange)' }], 64)}<b class="num">${h.score}</b></div>
          <div class="grow" style="flex:1"><div style="font-size:17px;font-weight:600">Health Score</div><div class="caption" style="font-size:14px">${h.score >= 80 ? 'Crushing it today.' : h.score >= 60 ? 'Solid day — keep it going.' : h.score >= 35 ? 'A few easy wins left today.' : 'Log food, water and steps to fill it up.'}</div></div>
          <span style="color:var(--label3);font-size:22px">›</span>
        </div>
        <div class="parts">${Object.entries(h.parts).map(([n, v]) => `<div><div class="pb"><i style="height:${v / h.max[n] * 100}%;background:${n === 'Calories' ? 'var(--accent)' : n === 'Steps' ? 'var(--pink)' : n === 'Water' ? 'var(--cyan)' : n === 'Logging' ? 'var(--purple)' : 'var(--orange)'}"></i></div><span>${n}</span></div>`).join('')}</div>
      </button>
    </div>

    <div class="section">
      <div class="card">
        <div class="card-title"><span class="dot" style="background:var(--purple)">${I('target', 'style="width:13px;height:13px"')}</span>Weekly challenge<span class="more caption">${ch.done ? 'Done!' : ch.daysLeft === 0 ? 'Ends today' : ch.daysLeft === 1 ? '1 day left' : ch.daysLeft + ' days left'}</span></div>
        <div style="font-size:20px;font-weight:700">${ch.title}</div>
        <div class="muted" style="font-size:15px;margin:2px 0 10px">${ch.desc} · <b style="color:var(--label)">+${ch.xp} XP</b></div>
        <div class="bar"><i style="width:${ch.progress / ch.need * 100}%;background:var(--purple)"></i></div>
        <div class="caption" style="margin-top:6px">${ch.progress} of ${ch.need}</div>
      </div>
    </div>
    </div></div>`;
  }

  // ---------- progress ----------
  function calChart(n) {
    const today = BW.dayKey(), days = Array.from({ length: n }, (_, i) => BW.day(BW.addDays(today, i - n + 1)));
    const W = 340, H = 170, pad = 22, max = Math.max(...days.map(d => Math.max(d.eaten, d.budget))) * 1.1 || 2500;
    const bw = (W - pad) / n, y = v => H - 18 - (v / max) * (H - 30);
    const budget = BW.goals().budget;
    const bars = days.map((d, i) => { const hh = H - 18 - y(d.eaten), col = d.eaten > d.budget * 1.1 ? 'var(--orange)' : 'var(--accent)'; return `<rect x="${pad + i * bw + bw * .18}" y="${y(d.eaten)}" width="${bw * .64}" height="${Math.max(0, hh)}" rx="${Math.min(4, bw * .25)}" fill="${col}" opacity="${d.k === today ? 1 : .85}"/>`; }).join('');
    const labels = days.map((d, i) => (n <= 7 || i % 5 === 0 || i === n - 1) ? `<text x="${pad + i * bw + bw / 2}" y="${H - 3}" text-anchor="middle">${n <= 7 ? BW.parseDay(d.k).toLocaleDateString(undefined, { weekday: 'narrow' }) : BW.parseDay(d.k).getDate()}</text>` : '').join('');
    return `<svg class="chart" viewBox="0 0 ${W} ${H}" role="img" aria-label="Calories per day">
      <line x1="${pad}" x2="${W}" y1="${y(budget)}" y2="${y(budget)}" stroke="var(--label2)" stroke-dasharray="4 4" stroke-width="1"/>
      <text x="0" y="${y(budget) + 4}">${(budget / 1000).toFixed(1)}k</text>
      <text x="0" y="${y(0) + 4}">0</text>
      ${bars}${labels}</svg>`;
  }
  function weightChart(tr) {
    const pts = tr.pts.slice(-45), p = BW.profile();
    const W = 340, H = 160, pad = 30;
    const vals = pts.flatMap(x => [x.lb, x.trend]).concat(p.goalLb < Math.min(...pts.map(x => x.lb)) + 8 ? [p.goalLb] : []);
    const lo = Math.floor(Math.min(...vals) - 1), hi = Math.ceil(Math.max(...vals) + 1);
    const t0 = BW.parseDay(pts[0].date).getTime(), t1 = Math.max(t0 + 864e5, BW.parseDay(pts[pts.length - 1].date).getTime());
    const x = k => pad + (BW.parseDay(k).getTime() - t0) / (t1 - t0) * (W - pad - 6), y = v => 8 + (hi - v) / (hi - lo) * (H - 28);
    const line = pts.map((q, i) => `${i ? 'L' : 'M'}${x(q.date).toFixed(1)},${y(q.trend).toFixed(1)}`).join('');
    const goalIn = p.goalLb >= lo && p.goalLb <= hi;
    return `<svg class="chart" viewBox="0 0 ${W} ${H}" role="img" aria-label="Weight trend">
      ${[hi, (hi + lo) / 2, lo].map(v => `<line x1="${pad}" x2="${W}" y1="${y(v)}" y2="${y(v)}" stroke="var(--sep)"/><text x="0" y="${y(v) + 4}">${Math.round(v)}</text>`).join('')}
      ${goalIn ? `<line x1="${pad}" x2="${W}" y1="${y(p.goalLb)}" y2="${y(p.goalLb)}" stroke="var(--green)" stroke-dasharray="4 4"/><text x="${W - 2}" y="${y(p.goalLb) - 4}" text-anchor="end" style="fill:var(--green)">goal</text>` : ''}
      ${pts.map(q => `<circle cx="${x(q.date)}" cy="${y(q.lb)}" r="2.6" fill="var(--label3)"/>`).join('')}
      <path d="${line}" fill="none" stroke="var(--accent)" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"/>
      <circle cx="${x(pts[pts.length - 1].date)}" cy="${y(pts[pts.length - 1].trend)}" r="5" fill="var(--accent)" stroke="var(--card)" stroke-width="2"/>
      <text x="${pad}" y="${H - 2}">${BW.parseDay(pts[0].date).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}</text>
      <text x="${W}" y="${H - 2}" text-anchor="end">${BW.parseDay(pts[pts.length - 1].date).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}</text></svg>`;
  }
  function viewProgress() {
    const n = S.progRange, today = BW.dayKey(), g = BW.goals();
    const days = Array.from({ length: n }, (_, i) => BW.day(BW.addDays(today, i - n + 1))).filter(d => d.entries.length);
    const done = days.filter(d => d.k !== today);
    const avg = done.length ? done.reduce((a, d) => a + d.eaten, 0) / done.length : 0;
    const inBudget = done.filter(d => Math.abs(1 - d.eaten / d.budget) <= .1 || d.eaten <= d.budget).length;
    const tr = BW.trend(), lv = BW.level(), bs = BW.badges(), st = BW.streak();
    const next = THEMES.find(t => t.level > lv.n);
    // streak calendar: last 5 weeks
    const start = BW.addDays(BW.weekStart(), -28);
    const cal = Array.from({ length: 35 }, (_, i) => { const k = BW.addDays(start, i), d = BW.day(k); const cls = k > today ? '' : d.entries.length ? (d.eaten > d.budget * 1.1 && k !== today ? 'over' : 'hit') : ''; return `<div class="${cls} ${k === today ? 'today' : ''}" style="${k > today ? 'opacity:.3' : ''}">${BW.parseDay(k).getDate()}</div>`; }).join('');
    return `
    <div class="topbar"><div><div class="subtitle">${g.teen ? 'Healthy habits' : 'Your journey'}</div><h1 class="large-title">Progress</h1></div>${offlinePill()}</div>
    <div class="cols"><div class="col-main">
    <div class="level-card">
      <div style="display:flex;justify-content:space-between;align-items:flex-start">
        <div><small>Level</small><div class="lv num">${lv.n}</div><div style="font-weight:700;font-size:18px">${lv.name}</div></div>
        <div style="text-align:right"><small>Streak</small><div style="font:800 28px var(--round)" class="num">${st.days}d</div><small>${st.freezes ? `${st.freezes} freeze${st.freezes > 1 ? 's' : ''} saved` : `Best ${st.best}d`}</small></div>
      </div>
      <div class="bar"><i style="width:${lv.pct * 100}%"></i></div>
      <div style="display:flex;justify-content:space-between;margin-top:6px"><small class="num">${fmt(lv.xp)} XP</small><small class="num">${lv.next ? fmt(lv.next - lv.xp) + ' XP to level ' + (lv.n + 1) : 'Max level!'}</small></div>
      ${next ? `<div style="margin-top:10px;font-size:13px;opacity:.9">${I('gift', 'style="width:14px;height:14px;vertical-align:-2px"')} Level ${next.level} unlocks the <b>${next.name}</b> theme</div>` : ''}
    </div>

    <div class="section">
      <div class="section-head"><h2>Calories</h2><div class="seg" style="width:150px"><button type="button" data-range="7" aria-pressed="${n === 7}">Week</button><button type="button" data-range="30" aria-pressed="${n === 30}">Month</button></div></div>
      <div class="card">
        <div class="duo" style="margin-bottom:12px"><div class="stat"><div class="caption">Daily average</div><div class="v num">${fmt(avg)}<small> cal</small></div></div><div class="stat"><div class="caption">On budget</div><div class="v num">${inBudget}<small> / ${done.length} days</small></div></div></div>
        ${calChart(n)}
        <div class="caption" style="margin-top:6px">Dashed line = your ${fmt(g.budget)} cal budget${BW.profile().earnSteps ? ' (before step bonus)' : ''}</div>
      </div>
    </div>

    <div class="section">
      <div class="section-head"><h2>Weight</h2><button class="link" type="button" data-act="weight">Log weight</button></div>
      <div class="card">${tr ? `
        <div class="duo" style="margin-bottom:12px">
          <div class="stat"><div class="caption">Trend weight</div><div class="v num">${tr.now.toFixed(1)}<small> lb</small></div></div>
          <div class="stat"><div class="caption">${tr.lost >= 0 ? 'Lost so far' : 'Gained'}</div><div class="v num" style="color:${tr.lost > 0 ? 'var(--green)' : 'var(--label)'}">${Math.abs(tr.lost).toFixed(1)}<small> lb</small></div></div>
        </div>
        ${tr.pts.length > 1 ? weightChart(tr) : ''}
        <div class="banner info" style="margin:12px 0 0">${I('info')}<span>${tr.eta ? `At ${Math.abs(tr.perWeek).toFixed(1)} lb/week you'll reach ${BW.profile().goalLb} lb around <b>${tr.eta.toLocaleDateString(undefined, { month: 'long', day: 'numeric' })}</b>.` : tr.perWeek != null ? `Your trend is ${tr.perWeek > 0 ? 'up' : 'steady'} (${tr.perWeek > 0 ? '+' : ''}${tr.perWeek.toFixed(1)} lb/week). The trend line ignores daily water-weight swings.` : 'Log your weight a few times a week. The trend line smooths out daily water-weight swings.'}</span></div>`
        : `<div style="text-align:center;padding:14px 0"><div class="icon-sq" style="background:var(--teal);margin:0 auto 10px;width:44px;height:44px;border-radius:12px">${I('scale')}</div><div style="font-weight:600">No weigh-ins yet</div><div class="caption" style="margin:4px 0 12px">Weigh in 2–3 times a week, same time of day.</div><button class="btn tinted small" type="button" data-act="weight">Log weight</button></div>`}
      </div>
    </div>

    </div><div class="col-side">
    <div class="section">
      <div class="section-head"><h2>Streak calendar</h2><span class="caption">last 5 weeks</span></div>
      <div class="card"><div class="cal-grid">${['M', 'T', 'W', 'T', 'F', 'S', 'S'].map(x => `<span class="caption" style="text-align:center;font-weight:600">${x}</span>`).join('')}${cal}</div>
      <div class="caption" style="margin-top:10px;display:flex;gap:14px"><span><i style="display:inline-block;width:9px;height:9px;border-radius:3px;background:var(--accent)"></i> Logged</span><span><i style="display:inline-block;width:9px;height:9px;border-radius:3px;background:var(--orange)"></i> Over budget</span></div></div>
    </div>

    <div class="section">
      <div class="section-head"><h2>Badges</h2><span class="caption">${bs.filter(b => b.earned).length} of ${bs.length}</span></div>
      <div class="card"><div class="badges">${bs.map(b => `<button class="badge ${b.earned ? '' : 'off'}" type="button" data-badge="${b.id}"><div class="med" style="background:${BADGE_COLORS[b.icon] || 'var(--accent)'}">${I(b.icon === 'bite' ? 'bite' : b.icon)}</div>${esc(b.name)}</button>`).join('')}</div></div>
    </div>
    </div></div>`;
  }

  // ---------- coach ----------
  const chat = () => LS.get('coachChat', []);
  const saveChat = m => LS.set('coachChat', m.slice(-40));
  function coachContext() {
    const p = BW.profile(), g = BW.goals(), today = BW.dayKey(), d = BW.day(today), tr = BW.trend();
    return {
      now: new Date().toLocaleString(), user: { name: p.name || undefined, age: p.age, sex: p.sex, heightIn: p.heightIn, weightLb: p.weightLb, goalLb: p.goalLb, under18: g.teen },
      plan: { dailyBudget: g.budget, maintenanceCalories: g.tdee, lossPaceLbPerWeek: g.pace, stepGoal: p.stepGoal, waterGoalGlasses: p.waterGoal, stepsEarnCalories: p.earnSteps },
      today: { eaten: d.eaten, budgetWithStepBonus: d.budget, remaining: d.remaining, stepBonus: d.bonus, steps: d.steps, waterGlasses: d.water, foods: d.entries.map(e => `${e.meal}: ${e.name} (${e.calories})`) },
      last7days: Array.from({ length: 7 }, (_, i) => { const x = BW.day(BW.addDays(today, i - 7)); return { date: x.k, eaten: x.eaten, budget: x.budget, steps: x.steps }; }),
      weight: tr ? { trendLb: tr.now, changePerWeek: tr.perWeek && +tr.perWeek.toFixed(2), goalEta: tr.eta && tr.eta.toDateString() } : null,
      streakDays: BW.streak().days, level: BW.level().name, usualFoods: BW.frequent().slice(0, 6).map(f => `${f.name} (${f.calories})`),
    };
  }
  function viewCoach() {
    const msgs = chat();
    const g = BW.goals(), d = BW.day(BW.dayKey());
    const starters = [d.remaining > 200 ? `I have ${fmt(d.remaining)} cal left. What should I eat for dinner?` : 'Ideas for a filling snack under 200 cal?', 'I had a Big Mac and medium fries for lunch', 'How am I doing this week?', g.teen ? 'Tips for having more energy at practice?' : 'Why did my weight go up today?'];
    const note = !S.online ? `<div class="banner">${I('offline')}<span>You're offline. The coach needs internet, but logging still works.</span></div>`
      : !S.status.ai ? `<div class="banner">${I('info')}<span>The AI coach isn't turned on for this server yet.</span></div>` : '';
    return `
    <div class="coach-wrap">
    <div class="topbar"><div><div class="subtitle">AI coach</div><h1 class="large-title">Bitey</h1></div>${msgs.length ? `<button class="link-btn" type="button" data-act="clearchat">Clear</button>` : ''}</div>
    ${note}
    ${msgs.length ? '' : `<div class="coach-hero"><div class="av">${I('coach')}</div><div style="font-size:20px;font-weight:700">Hi${BW.profile().name ? ', ' + esc(BW.profile().name) : ''}! I'm Bitey.</div><div class="muted" style="margin:4px auto 0;max-width:34ch;font-size:15px">Tell me what you ate and I'll log it. Ask for meal ideas, or ask how your week is going.</div></div>`}
    <div class="chat" id="chat">${msgs.map((m, i) => m.role === 'user' ? `<div class="msg me">${esc(m.content)}</div>` : `<div class="msg ai">${esc(m.content)}</div>${(m.done || []).length ? `<div class="action-card">${m.done.map(a => `<div class="ln"><span>${esc(a.label)}</span><b class="num">${esc(a.value)}</b></div>`).join('')}<div class="ln" style="margin-top:2px"><span class="ok">${I('check')}${m.undone ? 'Removed' : 'Added to your day'}</span>${m.undone ? '' : `<button class="link-btn" style="font-size:14px" type="button" data-undoact="${i}">Undo</button>`}</div></div>` : ''}`).join('')}
    ${S.coachBusy ? '<div class="msg ai typing"><i></i><i></i><i></i></div>' : ''}</div>
    <div class="chips wrap" style="margin-top:12px">${(msgs.length ? (msgs[msgs.length - 1].chips || []) : starters).map(c => `<button class="chip" type="button" data-say="${esc(c)}">${esc(c)}</button>`).join('')}</div>
    <div style="height:70px"></div>
    </div>
    <div class="composer"><form class="composer-in" id="coachForm"><textarea id="coachInput" rows="1" placeholder="Message Bitey" aria-label="Message Bitey">${esc(LS.get('coachDraft', ''))}</textarea><button class="send" type="submit" aria-label="Send" ${!S.online || !S.status.ai || S.coachBusy ? 'disabled' : ''}>${I('up')}</button></form></div>`;
  }
  async function sendCoach(text) {
    text = text.trim(); if (!text || S.coachBusy) return;
    if (!S.online) return toast('You’re offline — the coach needs internet', { icon: 'offline' });
    const msgs = chat(); msgs.push({ role: 'user', content: text }); saveChat(msgs); LS.set('coachDraft', ''); LS.set('usedCoach', true);
    S.coachBusy = true; render(); scrollChat();
    try {
      const r = await fetch('/api/coach', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ messages: msgs.map(m => ({ role: m.role, content: m.content })), context: coachContext() }) });
      const j = await r.json(); if (!r.ok) throw new Error(j.error || 'Coach is unavailable');
      const done = [], ids = [];
      const today = BW.dayKey();
      for (const a of j.actions || []) {
        if (a.type === 'log' && a.name && Number.isFinite(+a.calories)) { const e = BW.addEntry({ name: a.name, calories: +a.calories, meal: ['breakfast', 'lunch', 'dinner', 'snack'].includes(a.meal) ? a.meal : undefined, source: 'coach' }); ids.push({ id: e.id }); done.push({ label: a.name, value: fmt(+a.calories) + ' cal' }); }
        if (a.type === 'water' && +a.glasses) { const before = BW.day(today).water; BW.setWater(today, before + Math.round(+a.glasses)); ids.push({ water: before }); done.push({ label: 'Water', value: `+${Math.round(+a.glasses)} glass${+a.glasses > 1 ? 'es' : ''}` }); }
        if (a.type === 'weight' && +a.value > 50 && +a.value < 700) { const before = BW.day(today).weight; BW.setWeight(today, +a.value); ids.push({ weight: before }); done.push({ label: 'Weight', value: (+a.value).toFixed(1) + ' lb' }); }
      }
      const m2 = chat(); m2.push({ role: 'assistant', content: j.reply || '…', chips: j.chips || [], done, ids }); saveChat(m2);
      if (done.length) haptic(12);
    } catch (e) {
      const m2 = chat(); m2.push({ role: 'assistant', content: 'I couldn’t reach the coach right now (' + e.message + '). Your logging still works — try me again in a bit.' }); saveChat(m2);
    }
    S.coachBusy = false; render(); scrollChat();
  }
  const scrollChat = () => requestAnimationFrame(() => window.scrollTo({ top: document.body.scrollHeight, behavior: 'smooth' }));

  // ---------- me ----------
  function viewMe() {
    const p = BW.profile(), g = BW.goals(), lv = BW.level(), a = BW.acct();
    const fitbitOn = !!LS.get('fitbitLinked', false);
    const lastSync = LS.get('lastSync', 0);
    const theme = THEMES.find(t => t.id === p.theme) || THEMES[0];
    const initials = (p.name || 'You').split(' ').map(s => s[0]).join('').slice(0, 2).toUpperCase();
    const standalone = matchMedia('(display-mode: standalone)').matches || navigator.standalone;
    const row = (icon, color, title, value, attrs, sub) => `<button class="row indent" type="button" ${attrs}><span class="icon-sq" style="background:${color}">${I(icon)}</span><div class="grow"><div class="title">${title}</div>${sub ? `<div class="sub">${sub}</div>` : ''}</div><span class="value">${value}</span><span class="chev">›</span></button>`;
    return `
    <div class="topbar"><div><div class="subtitle">Settings</div><h1 class="large-title">Me</h1></div>${offlinePill()}</div>
    <div class="cols"><div class="col-main">
    <button class="card" type="button" data-act="profile" style="display:flex;align-items:center;gap:14px;width:100%;text-align:left">
      <span style="width:58px;height:58px;border-radius:50%;background:var(--accent);color:var(--accent-ink);display:grid;place-items:center;font:700 22px var(--round)">${esc(initials)}</span>
      <div style="flex:1"><div style="font-size:20px;font-weight:600">${esc(p.name || 'Your profile')}</div><div class="caption" style="font-size:14px">Level ${lv.n} · ${lv.name}${p.demo ? ' · sample data' : ''}</div></div><span class="chev" style="color:var(--label3);font-size:22px">›</span>
    </button>

    <div class="section"><div class="footnote" style="margin:0 16px 6px;text-transform:uppercase">Goals</div><div class="group">
      ${row('target', 'var(--accent)', 'Daily budget', fmt(g.budget) + ' cal', 'data-act="goals"', g.teen ? 'Teen mode · maintenance, no cutting' : g.pace ? `Lose ${g.pace} lb/week` : 'Maintain')}
      ${row('scale', 'var(--teal)', 'Goal weight', g.teen ? '—' : p.goalLb + ' lb', 'data-act="goals"')}
      ${row('shoe', 'var(--pink)', 'Step goal', fmt(p.stepGoal), 'data-act="stepgoal"')}
      ${row('drop', 'var(--cyan)', 'Water goal', p.waterGoal + ' glasses', 'data-act="watergoal"')}
    </div></div>

    <div class="section"><div class="footnote" style="margin:0 16px 6px;text-transform:uppercase">Health data</div><div class="group">
      ${row('watch', '#00B0B9', 'Fitbit', fitbitOn ? 'Connected' : 'Connect', 'data-act="fitbit"', fitbitOn ? `Steps and weight sync automatically${LS.get('fitbitPulled', 0) ? ' · last pulled ' + new Date(LS.get('fitbitPulled', 0)).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' }) : ''}` : 'Sync your steps into your Health Score')}
      <div class="row indent"><span class="icon-sq" style="background:var(--orange)">${I('flame')}</span><div class="grow"><div class="title">Steps earn calories</div><div class="sub">Walking more adds to your daily budget</div></div><button class="switch" type="button" role="switch" aria-checked="${p.earnSteps}" data-act="earnsteps" aria-label="Steps earn calories"></button></div>
      ${row('edit', 'var(--label3)', 'Enter steps by hand', '', 'data-act="steps"')}
    </div></div>

    <div class="section"><div class="footnote" style="margin:0 16px 6px;text-transform:uppercase">Account & sync</div><div class="group">
      ${a ? `${row('cloud', 'var(--blue)', a.username, BW.syncing ? 'Syncing…' : BW.dirtyCount ? BW.dirtyCount + ' to sync' : 'Up to date', 'data-act="syncnow"', lastSync ? 'Last synced ' + new Date(lastSync).toLocaleString([], { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' }) : 'Tap to sync now')}
        <button class="row" type="button" data-act="signout" style="color:var(--red)">Sign out</button>`
      : `${row('cloud', 'var(--blue)', 'Back up & sync', 'Sign in', 'data-act="signin"', 'Keep your log safe and use it on more devices')}`}
    </div>${BW.syncError && a ? `<div class="footnote" style="color:var(--red)">${esc(BW.syncError)}</div>` : '<div class="footnote">BiteWise saves everything on this device first, so it works with no internet. Signing in adds a cloud backup.</div>'}</div>

    </div><div class="col-side">
    <div class="section"><div class="footnote" style="margin:0 16px 6px;text-transform:uppercase">Rewards</div><div class="group">
      ${row('palette', theme.color, 'App theme', theme.name, 'data-act="themes"', `${THEMES.filter(t => t.level <= lv.n).length} of ${THEMES.length} unlocked`)}
      ${row('trophy', '#FFB800', 'Badges', `${BW.badges().filter(b => b.earned).length} / ${BW.badges().length}`, 'data-go="progress"')}
    </div></div>

    <div class="section"><div class="footnote" style="margin:0 16px 6px;text-transform:uppercase">App</div><div class="group">
      ${standalone ? '' : row('download', 'var(--purple)', 'Install BiteWise', '', 'data-act="install"', 'Add to your home screen — works offline')}
      ${row('mic', 'var(--pink)', 'Offline voice', '', 'data-act="voicehelp"', 'How voice logging works with no internet')}
      ${row('share', 'var(--label3)', 'Export my data', 'CSV', 'data-act="export"')}
      <button class="row" type="button" data-act="wipe" style="color:var(--red)">Delete all data</button>
    </div>
    <div class="footnote">BiteWise ${S.status.ai ? `· Coach runs on Cloud Foundry open models (${esc(String(S.status.model).split('/').pop())})` : '· Coach offline'} · Not medical advice. For weight goals under 18, talk with a doctor or parent.</div></div>
    </div></div>`;
  }

  // ---------- log sheet ----------
  function openLog({ mode = LS.get('logMode', 'quick'), meal, date = S.date, text = '' } = {}) {
    const st = { mode, meal: meal || (date === BW.dayKey() ? BW.mealForNow() : 'lunch'), amount: '', name: '', text, items: [], transcript: '', listening: false };
    if (text) { const r = BW_PARSE.parseLog(text); st.items = r.items; if (r.meal) st.meal = r.meal; }
    let rec = null;
    const entry = {};
    openSheet({
      title: date === BW.dayKey() ? 'Log food' : 'Log · ' + BW.parseDay(date).toLocaleDateString(undefined, { month: 'short', day: 'numeric' }), tall: true,
      onClose: () => { try { rec && rec.abort(); } catch {} },
      mount: (body, close) => { function draw() { body.innerHTML = html(); bind(body); } entry.close = close; entry.redraw = draw; draw(); },
    });
    function itemsHTML() {
      if (!st.items.length) return '';
      const total = st.items.reduce((a, i) => a + (+i.calories || 0), 0), unknown = st.items.filter(i => i.calories == null || i.calories === '').length;
      return `<div class="group parsed" style="margin-top:14px">${st.items.map((it, i) => `<div class="row ${it.calories == null || it.calories === '' ? 'unk' : ''}"><input class="nm" data-nm="${i}" value="${esc(it.name)}" aria-label="Food name"><input class="kc num" data-kc="${i}" inputmode="numeric" value="${it.calories ?? ''}" placeholder="cal" aria-label="Calories"><button class="x" type="button" data-rm="${i}" aria-label="Remove">${I('xcircle')}</button></div>`).join('')}</div>
        ${unknown ? `<div class="banner" style="margin-top:10px">${I('info')}<span>${unknown === 1 ? 'One item' : unknown + ' items'} not in the offline food list. Type the calories${S.online && S.status.ai ? ', or' : '.'}</span>${S.online && S.status.ai ? `<button class="btn small tinted" type="button" data-act="estimate" style="margin-left:auto">${I('spark')}Ask AI</button>` : ''}</div>` : ''}
        <button class="btn" type="button" data-act="additems" style="margin-top:14px" ${total <= 0 && unknown === st.items.length ? 'disabled' : ''}>Add ${st.items.length} item${st.items.length > 1 ? 's' : ''} · ${fmt(total)} cal</button>`;
    }
    function html() {
      const recent = BW.recentAmounts(), usual = BW.frequent().slice(0, 6);
      return `
      <div class="seg" style="margin-bottom:12px">${[['quick', 'Quick'], ['voice', 'Voice'], ['type', 'Type']].map(([m, l]) => `<button type="button" data-mode="${m}" aria-pressed="${st.mode === m}">${l}</button>`).join('')}</div>
      <div class="seg" style="margin-bottom:6px">${MEALS.map(([m, l]) => `<button type="button" data-meal="${m}" aria-pressed="${st.meal === m}">${l}</button>`).join('')}</div>
      ${st.mode === 'quick' ? `
        <div class="amount"><div class="n ${st.amount ? '' : 'empty'}" id="amt">${st.amount ? fmt(+st.amount) : '0'}</div><div class="u">calories</div></div>
        <input class="field" id="qname" placeholder="What was it? (optional)" value="${esc(st.name)}" style="text-align:center;background:transparent;height:36px" autocomplete="off">
        ${recent.length ? `<div class="chips" style="justify-content:center;margin-top:8px">${recent.map(n => `<button class="chip fill" type="button" data-amt="${n}">${fmt(n)}</button>`).join('')}</div>` : ''}
        <div class="keypad">${[1, 2, 3, 4, 5, 6, 7, 8, 9].map(n => `<button type="button" data-key="${n}">${n}</button>`).join('')}<button type="button" data-key="00">00</button><button type="button" data-key="0">0</button><button type="button" data-key="del" aria-label="Delete">${I('delete')}</button></div>
        <button class="btn" type="button" data-act="addquick" ${+st.amount > 0 ? '' : 'disabled'}>${+st.amount > 0 ? `Add ${fmt(+st.amount)} cal` : 'Enter calories'}</button>
        ${usual.length ? `<div class="footnote" style="margin:16px 4px 6px">YOUR USUALS</div><div class="chips">${usual.map((u, i) => `<button class="chip" type="button" data-usual="${i}">${esc(u.name)} <span class="k num">${u.calories}</span></button>`).join('')}</div>` : ''}`
      : st.mode === 'voice' ? `
        <button class="mic-orb ${st.listening ? 'on' : ''}" type="button" data-act="listen" aria-label="${st.listening ? 'Stop listening' : 'Start listening'}">${I('mic')}</button>
        <div class="transcript ${st.transcript ? '' : 'hint'}" aria-live="polite">${st.transcript ? '“' + esc(st.transcript) + '”' : st.listening ? 'Listening…' : 'Tap and say what you ate.<br><span style="font-size:14px">“Two eggs, toast and an orange juice” · “Chipotle bowl 900”</span>'}</div>
        ${st.voiceErr ? `<div class="banner">${I('info')}<span>${st.voiceErr}</span></div>` : ''}
        ${itemsHTML()}`
      : `
        <textarea class="field" id="ltext" placeholder="e.g. 2 eggs, toast and orange juice\nor: burrito 750" aria-label="What did you eat?" style="margin-top:8px">${esc(st.text)}</textarea>
        <div class="footnote" style="margin:6px 4px 0">Works offline for ${window.BW_FOODS.length}+ common foods. Add a number like “burrito 750” to set calories yourself.</div>
        <div id="typedItems">${itemsHTML()}</div>`}
      `;
    }
    function bind(body) {
      body.onclick = e => {
        const b = e.target.closest('button'); if (!b) return;
        if (b.dataset.mode) { st.mode = b.dataset.mode; LS.set('logMode', st.mode); st.items = []; st.transcript = ''; st.voiceErr = ''; try { rec && rec.abort(); } catch {} st.listening = false; entry.redraw(); if (st.mode === 'type') setTimeout(() => $('#ltext')?.focus(), 50); if (st.mode === 'voice') listen(); return; }
        if (b.dataset.meal) { st.meal = b.dataset.meal; $$('[data-meal]', body).forEach(x => x.setAttribute('aria-pressed', x === b)); haptic(5); return; }
        if (b.dataset.key) {
          haptic(5);
          if (b.dataset.key === 'del') st.amount = st.amount.slice(0, -1); else if ((st.amount + b.dataset.key).length <= 5) st.amount = (st.amount + b.dataset.key).replace(/^0+/, '');
          $('#amt').textContent = st.amount ? fmt(+st.amount) : '0'; $('#amt').classList.toggle('empty', !st.amount);
          const add = $('[data-act="addquick"]', body); add.disabled = !(+st.amount > 0); add.textContent = +st.amount > 0 ? `Add ${fmt(+st.amount)} cal` : 'Enter calories';
          return;
        }
        if (b.dataset.amt) { st.amount = b.dataset.amt; entry.redraw(); return; }
        if (b.dataset.usual) { const u = BW.frequent()[+b.dataset.usual]; if (u) commit([{ name: u.name, calories: u.calories }], 'quick'); return; }
        if (b.dataset.rm) { st.items.splice(+b.dataset.rm, 1); refreshItems(); return; }
        const act = b.dataset.act;
        if (act === 'addquick') commit([{ name: st.name.trim() || 'Quick add', calories: +st.amount }], 'quick');
        if (act === 'listen') st.listening ? stop() : listen();
        if (act === 'additems') commit(st.items.filter(i => +i.calories > 0 || i.calories === 0).map(i => ({ name: i.name, calories: +i.calories || 0 })), st.mode === 'voice' ? 'voice' : 'text');
        if (act === 'estimate') estimate(b);
      };
      body.oninput = e => {
        const t = e.target;
        if (t.id === 'qname') st.name = t.value;
        if (t.id === 'ltext') { st.text = t.value; const r = BW_PARSE.parseLog(t.value); st.items = r.items; if (r.meal) { st.meal = r.meal; $$('[data-meal]', body).forEach(x => x.setAttribute('aria-pressed', x.dataset.meal === st.meal)); } $('#typedItems', body).innerHTML = itemsHTML(); }
        if (t.dataset.nm) st.items[+t.dataset.nm].name = t.value;
        if (t.dataset.kc) { st.items[+t.dataset.kc].calories = t.value === '' ? null : Math.max(0, parseInt(t.value.replace(/\D/g, ''), 10) || 0); const btn = $('[data-act="additems"]', body); const total = st.items.reduce((a, i) => a + (+i.calories || 0), 0); if (btn) btn.textContent = `Add ${st.items.length} item${st.items.length > 1 ? 's' : ''} · ${fmt(total)} cal`; if (btn) btn.disabled = false; t.closest('.row').classList.toggle('unk', t.value === ''); }
      };
    }
    function refreshItems() { if (st.mode === 'type') $('#typedItems').innerHTML = itemsHTML(); else entry.redraw(); }
    function commit(items, source) {
      items = items.filter(i => i.name || i.calories);
      if (!items.length) return;
      const made = items.map(i => BW.addEntry({ date, meal: st.meal, name: i.name, calories: i.calories, source }));
      haptic(15); entry.close();
      const total = items.reduce((a, i) => a + (+i.calories || 0), 0);
      toast(`${items.length > 1 ? items.length + ' items' : items[0].name} · ${fmt(total)} cal`, { undo: () => made.forEach(m => BW.remove(m.id)) });
    }
    async function estimate(btn) {
      const unk = st.items.filter(i => i.calories == null || i.calories === '');
      btn.disabled = true; btn.innerHTML = 'Thinking…';
      try {
        const r = await fetch('/api/estimate', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ text: unk.map(i => i.name).join(', ') }) });
        const j = await r.json(); if (!r.ok) throw new Error(j.error);
        unk.forEach((it, i) => { const m = j.items.find(x => x.name.toLowerCase().includes(it.name.toLowerCase().split(' ')[0])) || j.items[i]; if (m) { it.calories = m.calories; } });
        refreshItems();
      } catch (e) { toast('Couldn’t estimate: ' + e.message, { icon: 'info' }); btn.disabled = false; btn.textContent = 'Ask AI'; }
    }
    // ----- voice -----
    async function listen() {
      const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
      st.voiceErr = '';
      if (!SR) { st.voiceErr = 'This browser can’t listen. Switch to <b>Type</b> and tap the microphone key on your keyboard. That works offline on iPhone.'; entry.redraw(); return; }
      try {
        rec = new SR(); rec.lang = navigator.language || 'en-US'; rec.interimResults = true; rec.continuous = false; rec.maxAlternatives = 1;
        const local = await voiceMode();
        if (local === 'local' && 'processLocally' in rec) rec.processLocally = true;
        let finalText = '';
        rec.onresult = ev => {
          let interim = ''; for (let i = ev.resultIndex; i < ev.results.length; i++) { const r = ev.results[i]; if (r.isFinal) finalText += r[0].transcript + ' '; else interim += r[0].transcript; }
          st.transcript = (finalText + interim).trim(); const tr = $('.transcript'); if (tr) { tr.classList.remove('hint'); tr.textContent = '“' + st.transcript + '”'; }
        };
        rec.onerror = ev => {
          st.listening = false;
          st.voiceErr = ev.error === 'network' || (!navigator.onLine && ev.error !== 'no-speech') ? 'This browser needs internet for voice. Offline, switch to <b>Type</b> and tap the microphone key on your keyboard. Your phone’s built-in dictation works offline.'
            : ev.error === 'not-allowed' || ev.error === 'service-not-allowed' ? 'Microphone access is off. Allow it in your browser settings, or use <b>Type</b>.'
            : ev.error === 'no-speech' ? 'I didn’t hear anything. Tap the mic and try again.' : 'Voice stopped (' + ev.error + '). Tap the mic to try again.';
          entry.redraw();
        };
        rec.onend = () => {
          st.listening = false;
          if (st.transcript) { const r = BW_PARSE.parseLog(st.transcript); st.items = r.items; if (r.meal) st.meal = r.meal; }
          entry.redraw();
        };
        st.listening = true; st.transcript = ''; st.items = []; entry.redraw(); haptic(10);
        rec.start();
      } catch (e) { st.listening = false; st.voiceErr = 'Couldn’t start the mic: ' + esc(e.message); entry.redraw(); }
    }
    function stop() { try { rec && rec.stop(); } catch {} }
    if (mode === 'voice' && !text) setTimeout(listen, 350);
    if (mode === 'type') setTimeout(() => $('#ltext')?.focus(), 400);
  }
  async function voiceMode() {
    const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SR) return 'none';
    if (typeof SR.available === 'function') { try { const a = await SR.available({ langs: [navigator.language || 'en-US'], processLocally: true }); return a === 'available' ? 'local' : (a === 'downloadable' || a === 'downloading') ? 'downloadable' : 'cloud'; } catch { return 'cloud'; } }
    return 'cloud';
  }

  // ---------- other sheets ----------
  function editEntry(id) {
    const e = BW.get(id); if (!e) return;
    const st = { ...e };
    openSheet({
      title: 'Edit food', right: 'Save',
      body: `<div class="group"><div class="row"><span class="grow">Name</span><input class="inline-input" id="en" value="${esc(e.name)}" style="width:60%"></div><div class="row"><span class="grow">Calories</span><input class="inline-input num" id="ec" inputmode="numeric" value="${e.calories}"></div></div>
        <div class="footnote" style="margin:18px 16px 6px">MEAL</div><div class="seg">${MEALS.map(([m, l]) => `<button type="button" data-m="${m}" aria-pressed="${e.meal === m}">${l}</button>`).join('')}</div>
        <button class="btn danger" type="button" id="edel" style="margin-top:22px">${I('trash')} Delete</button>`,
      mount: (b, close) => {
        b.onclick = ev => { const m = ev.target.closest('[data-m]'); if (m) { st.meal = m.dataset.m; $$('[data-m]', b).forEach(x => x.setAttribute('aria-pressed', x === m)); } };
        $('#edel', b).onclick = () => { close(); delEntry(id); };
      },
      onRight: close => { BW.put({ ...BW.get(id), name: $('#en').value.trim() || 'Quick add', calories: Math.max(0, parseInt($('#ec').value, 10) || 0), meal: st.meal }); close(); toast('Saved'); },
    });
  }
  function delEntry(id) { const e = BW.get(id); BW.remove(id); haptic(10); toast(`Deleted ${e.name}`, { icon: 'trash', undo: () => BW.put({ ...e, deleted: false }) }); }

  function numberSheet({ title, label, value, unit, step = 1, min = 0, max = 99999, decimals = 0, onSave, footer = '' }) {
    let v = value;
    openSheet({
      title, right: 'Save',
      body: `<div class="card" style="text-align:center;padding:22px 16px"><div class="caption" style="font-size:14px">${label}</div>
        <div style="display:flex;align-items:center;justify-content:center;gap:14px;margin-top:8px"><button class="btn gray small" type="button" data-d="-1" aria-label="Less" style="width:44px;height:44px;border-radius:50%;padding:0;font-size:24px">−</button>
        <input id="nv" class="num" inputmode="decimal" value="${(+v).toFixed(decimals)}" style="width:170px;text-align:center;border:0;background:transparent;font:700 52px var(--round)" aria-label="${label}">
        <button class="btn gray small" type="button" data-d="1" aria-label="More" style="width:44px;height:44px;border-radius:50%;padding:0;font-size:24px">+</button></div><div class="muted" style="font-weight:600">${unit}</div></div>${footer}`,
      mount: b => { b.onclick = e => { const d = e.target.closest('[data-d]'); if (!d) return; v = Math.min(max, Math.max(min, (parseFloat($('#nv').value) || 0) + d.dataset.d * step)); $('#nv').value = v.toFixed(decimals); haptic(5); }; },
      onRight: close => { const n = parseFloat($('#nv').value); if (!Number.isFinite(n) || n < min || n > max) return toast(`Enter a number from ${min} to ${fmt(max)}`, { icon: 'info' }); onSave(n); close(); },
    });
  }

  function healthSheet() {
    const h = BW.health(S.date), p = BW.profile();
    const tips = { Calories: 'Land within 10% of your budget.', Steps: `Reach ${fmt(p.stepGoal)} steps.`, Water: `Drink ${p.waterGoal} glasses.`, Logging: 'Log at least 2 meals or snacks.', Streak: 'Log 3+ days in a row.' };
    openSheet({ title: 'Health Score', left: 'Done', body: `<div style="text-align:center;margin:6px 0 16px"><div class="score-ring" style="width:120px;height:120px;margin:0 auto">${ringSVG([{ pct: h.score / 100, color: 'var(--green)' }], 120)}<b style="font-size:38px" class="num">${h.score}</b></div><div class="muted" style="margin-top:8px">out of 100, for ${dayLabel(S.date).toLowerCase()}</div></div>
      <div class="group">${Object.entries(h.parts).map(([n, v]) => `<div class="row"><div class="grow"><div class="title">${n}</div><div class="sub">${tips[n]}</div></div><span class="value num"><b style="color:var(--label)">${v}</b> / ${h.max[n]}</span></div>`).join('')}</div>
      <div class="footnote">Your Health Score mixes eating near your budget with moving, drinking water and showing up every day. Connect Fitbit so your steps count automatically.</div>` });
  }

  function stepsSheet() {
    const has = !!LS.get('fitbitLinked', false);
    numberSheet({ title: 'Steps', label: dayLabel(S.date), value: BW.day(S.date).steps, unit: 'steps', step: 500, max: 100000, onSave: n => { BW.setSteps(S.date, n, 'manual'); toast('Steps saved'); },
      footer: `<div class="footnote">${has ? 'Fitbit is connected, so steps sync automatically. A number you enter here is used until the next sync.' : 'Tip: connect Fitbit in Me → Health data so steps fill in automatically.'}</div>` });
  }

  function weightSheet() {
    const tr = BW.trend(), cur = BW.day(BW.dayKey()).weight || (tr ? tr.pts[tr.pts.length - 1].lb : BW.profile().weightLb);
    numberSheet({ title: 'Log weight', label: 'Today', value: cur, unit: 'lb', step: .2, min: 50, max: 700, decimals: 1, onSave: n => { BW.setWeight(BW.dayKey(), n); BW.saveProfile({ weightLb: Math.round(n) }); toast('Weight logged'); },
      footer: `<div class="footnote">Weigh in the morning after using the bathroom, before eating, for the most consistent numbers.</div>` });
  }

  function signInSheet() {
    let mode = 'signup';
    openSheet({
      title: 'Back up & sync', body: '', mount: (b, close) => {
        const draw = (err = '') => {
          b.innerHTML = `<div style="text-align:center;margin:4px 0 16px"><div class="icon-sq" style="background:var(--blue);width:56px;height:56px;border-radius:15px;margin:0 auto 10px">${I('cloud', 'style="width:30px;height:30px"')}</div><div class="muted" style="font-size:15px">Your log stays on this phone and gets backed up to the cloud.</div></div>
            <div class="seg" style="margin-bottom:14px"><button type="button" data-m="signup" aria-pressed="${mode === 'signup'}">Create account</button><button type="button" data-m="login" aria-pressed="${mode === 'login'}">Sign in</button></div>
            <form id="af"><div class="group"><div class="row"><input class="field" style="background:transparent;padding:0" id="au" placeholder="Username" autocomplete="username" autocapitalize="off" required></div><div class="row"><input class="field" style="background:transparent;padding:0" id="ap" type="password" placeholder="Password (6+ characters)" autocomplete="${mode === 'signup' ? 'new-password' : 'current-password'}" required></div></div>
            ${err ? `<div class="footnote" style="color:var(--red)">${esc(err)}</div>` : ''}
            <button class="btn" style="margin-top:16px" id="ab">${mode === 'signup' ? 'Create account' : 'Sign in'}</button></form>
            ${!S.online ? `<div class="footnote">You're offline. Connect to the internet to sign in. Logging keeps working in the meantime.</div>` : ''}`;
          b.querySelectorAll('[data-m]').forEach(x => x.onclick = () => { mode = x.dataset.m; draw(); });
          $('#af', b).onsubmit = async e => {
            e.preventDefault(); const btn = $('#ab', b); btn.disabled = true; btn.textContent = 'One sec…';
            try { await BW.signIn(mode, $('#au', b).value, $('#ap', b).value); close(); toast(mode === 'signup' ? 'Account created — you’re backed up' : 'Signed in and synced', { icon: 'cloud' }); await refreshMe(); }
            catch (err) { draw(err.message); }
          };
        };
        draw();
      },
    });
  }

  async function refreshMe() {
    if (!BW.acct() || !navigator.onLine) return;
    try { const me = await BW.api('me', null, 'GET'); LS.set('fitbitLinked', !!me.fitbit); if (me.fitbit) autoFitbit(); render(); } catch {}
  }
  async function autoFitbit(force) {
    if (!LS.get('fitbitLinked', false) || !navigator.onLine) return;
    if (!force && Date.now() - LS.get('fitbitPulled', 0) < 15 * 60e3) return;
    try { const r = await BW.pullFitbit(7); if (force) toast(`Fitbit synced · ${r.days} day${r.days === 1 ? '' : 's'} updated`, { icon: 'watch' }); }
    catch (e) { if (e.status === 401 || e.status === 404) LS.set('fitbitLinked', false); if (force) toast(e.message, { icon: 'info' }); }
  }

  function fitbitSheet() {
    const linked = !!LS.get('fitbitLinked', false);
    openSheet({
      title: 'Fitbit', left: 'Done',
      body: `<div style="text-align:center;margin:4px 0 16px"><div class="icon-sq" style="background:#00B0B9;width:60px;height:60px;border-radius:16px;margin:0 auto 10px">${I('watch', 'style="width:32px;height:32px"')}</div>
        <div style="font-size:20px;font-weight:700">${linked ? 'Fitbit is connected' : 'Connect your Fitbit'}</div>
        <div class="muted" style="font-size:15px;margin-top:4px">${linked ? 'Your steps (and weigh-ins from an Aria scale) sync in every time you open BiteWise.' : 'Steps flow into your Health Score and can earn back calories. Weigh-ins from a Fitbit scale come in too.'}</div></div>
        ${!BW.acct() ? `<div class="banner info">${I('info')}<span>Fitbit links to your BiteWise account, so sign in first. It's free.</span></div><button class="btn" type="button" id="fs">Sign in</button>`
          : !S.status.fitbit ? `<div class="banner">${I('info')}<span>Fitbit isn't set up on this server yet. The app owner needs to add a Fitbit Client ID. Until then, you can enter steps by hand.</span></div>`
          : linked ? `<button class="btn" type="button" id="fp">${I('sync')} Sync now</button><button class="btn danger" type="button" id="fd" style="margin-top:10px">Disconnect</button>`
          : `<button class="btn" type="button" id="fc" style="background:#00B0B9">Connect Fitbit</button><div class="footnote">You'll sign in on Fitbit's website and come right back.</div>`}`,
      mount: (b, close) => {
        $('#fs', b) && ($('#fs', b).onclick = () => { close(); signInSheet(); });
        $('#fp', b) && ($('#fp', b).onclick = async () => { close(); await autoFitbit(true); });
        $('#fd', b) && ($('#fd', b).onclick = async () => { try { await BW.api('fitbit/disconnect'); } catch {} LS.set('fitbitLinked', false); close(); render(); toast('Fitbit disconnected'); });
        $('#fc', b) && ($('#fc', b).onclick = async () => { try { const j = await BW.api('fitbit/start'); location.href = j.url; } catch (e) { toast(e.message, { icon: 'info' }); } });
      },
    });
  }

  function themesSheet() {
    const lv = BW.level().n, p = BW.profile();
    openSheet({
      title: 'App theme', left: 'Done',
      body: `<div class="footnote" style="margin:0 4px 12px">Level up to unlock new colors. You're level ${lv}.</div><div class="group">${THEMES.map(t => `<button class="row" type="button" data-t="${t.id}" ${t.level > lv ? 'aria-disabled="true"' : ''}><span style="width:30px;height:30px;border-radius:50%;background:${t.color};flex:none;${t.level > lv ? 'opacity:.35' : ''}"></span><div class="grow"><div class="title">${t.name}</div><div class="sub">${t.level > lv ? 'Unlocks at level ' + t.level : 'Unlocked'}</div></div>${t.level > lv ? `<span style="color:var(--label3);width:20px">${I('lock')}</span>` : p.theme === t.id ? `<span style="color:var(--accent);width:22px">${I('check')}</span>` : ''}</button>`).join('')}</div>`,
      mount: (b, close) => { b.onclick = e => { const r = e.target.closest('[data-t]'); if (!r) return; const t = THEMES.find(x => x.id === r.dataset.t); if (t.level > lv) return toast(`Reach level ${t.level} to unlock ${t.name}`, { icon: 'lock' }); BW.saveProfile({ theme: t.id }); haptic(8); close(); }; },
    });
  }

  function goalsSheet() {
    const p = { ...BW.profile() };
    openSheet({
      title: 'Goals', right: 'Save', tall: true, body: '',
      mount: b => {
        const draw = () => {
          const g = BW.goals(p);
          b.innerHTML = `
            <div class="card" style="text-align:center"><div class="caption" style="font-size:14px">Daily budget</div><div class="big-num num" style="font-size:52px">${fmt(g.budget)}</div><div class="muted" style="font-size:14px">${g.teen ? 'Maintenance for growing bodies' : `Maintenance ${fmt(g.tdee)} − ${fmt(g.pace * 500)} for ${g.pace} lb/week`}</div>${g.clamped ? `<div class="banner" style="margin:10px 0 0;text-align:left">${I('info')}<span>Raised to the ${fmt(g.floor)} cal safety minimum.</span></div>` : ''}</div>
            <div class="footnote" style="margin:18px 16px 6px">ABOUT YOU</div>
            <div class="group">
              <div class="row"><span class="grow">Name</span><input class="inline-input" id="g_name" value="${esc(p.name)}" placeholder="Optional" style="width:55%"></div>
              <div class="row"><span class="grow">Sex</span><div class="seg" style="width:160px"><button type="button" data-sex="female" aria-pressed="${p.sex === 'female'}">Female</button><button type="button" data-sex="male" aria-pressed="${p.sex === 'male'}">Male</button></div></div>
              <div class="row"><span class="grow">Age</span><input class="inline-input num" id="g_age" inputmode="numeric" value="${p.age}"></div>
              <div class="row"><span class="grow">Height</span><span class="value"><input class="inline-input num" id="g_ft" inputmode="numeric" value="${Math.floor(p.heightIn / 12)}" style="width:28px"> ft <input class="inline-input num" id="g_in" inputmode="numeric" value="${p.heightIn % 12}" style="width:28px"> in</span></div>
              <div class="row"><span class="grow">Weight</span><span class="value"><input class="inline-input num" id="g_w" inputmode="decimal" value="${p.weightLb}" style="width:60px"> lb</span></div>
              ${g.teen ? '' : `<div class="row"><span class="grow">Goal weight</span><span class="value"><input class="inline-input num" id="g_goal" inputmode="decimal" value="${p.goalLb}" style="width:60px"> lb</span></div>`}
            </div>
            ${g.teen ? `<div class="banner info" style="margin-top:14px">${I('heart')}<span><b>Teen mode.</b> Under 18, BiteWise focuses on habits (steps, water, regular meals) instead of cutting calories. For weight goals, talk with a doctor or parent.</span></div>` : `
            <div class="footnote" style="margin:18px 16px 6px">PACE</div>
            <div class="stack" style="display:flex;flex-direction:column;gap:8px">${[[0, 'Maintain', 'Keep my weight'], [0.5, 'Relaxed', '½ lb a week'], [1, 'Steady', '1 lb a week · recommended'], [1.5, 'Ambitious', '1½ lb a week'], [2, 'Fast', '2 lb a week']].map(([v, n, d]) => `<button class="opt" type="button" data-pace="${v}" aria-pressed="${p.pace === v}" ${v > g.maxPace ? 'disabled style="opacity:.4"' : ''}><div><b>${n}</b><span>${v > g.maxPace ? 'Too fast for your weight' : d}</span></div><span class="ck">${I('check')}</span></button>`).join('')}</div>`}
            <div class="footnote" style="margin:18px 16px 6px">ACTIVITY</div>
            <div class="seg">${[[1.2, 'Low'], [1.375, 'Light'], [1.55, 'Active'], [1.725, 'Very']].map(([v, n]) => `<button type="button" data-act2="${v}" aria-pressed="${p.activity === v}">${n}</button>`).join('')}</div>
            <div class="footnote">Low = mostly sitting. Light = some walking. Active = sports or workouts most days. Very = hard training daily.</div>`;
        };
        draw();
        b.oninput = e => { const t = e.target, n = parseFloat(t.value); if (t.id === 'g_name') p.name = t.value; if (t.id === 'g_age' && n > 0) p.age = n; if ((t.id === 'g_ft' || t.id === 'g_in')) p.heightIn = (parseInt($('#g_ft').value) || 0) * 12 + (parseInt($('#g_in').value) || 0); if (t.id === 'g_w' && n > 0) p.weightLb = n; if (t.id === 'g_goal' && n > 0) p.goalLb = n; };
        b.onchange = () => { const f = document.activeElement?.id; draw(); if (f && $('#' + f)) $('#' + f).focus(); };
        b.onclick = e => { const x = e.target.closest('button'); if (!x) return; if (x.dataset.sex) p.sex = x.dataset.sex; if (x.dataset.pace) p.pace = +x.dataset.pace; if (x.dataset.act2) p.activity = +x.dataset.act2; if (x.dataset.sex || x.dataset.pace || x.dataset.act2) { draw(); haptic(5); } };
      },
      onRight: close => { if (p.age < 5 || p.age > 110 || p.heightIn < 36 || p.weightLb < 50) return toast('Check your age, height and weight', { icon: 'info' }); if (p.goalLb >= p.weightLb) p.pace = Math.min(p.pace, 0); BW.saveProfile({ ...p, customBudget: null }); close(); toast('Goals updated'); },
    });
  }

  function confirmSheet({ title, text, confirm, danger, onConfirm }) {
    openSheet({ title, body: `<p class="muted" style="text-align:center;margin:6px 10px 20px">${text}</p><button class="btn ${danger ? 'danger' : ''}" type="button" id="cf">${confirm}</button>`, mount: (b, close) => { $('#cf', b).onclick = () => { close(); onConfirm(); }; } });
  }

  function badgeSheet(id) {
    const b = BW.badges().find(x => x.id === id); if (!b) return;
    openSheet({ title: b.earned ? 'Badge earned' : 'Locked badge', left: 'Done', body: `<div class="celebrate"><div class="med" style="background:${b.earned ? BADGE_COLORS[b.icon] || 'var(--accent)' : 'var(--fill)'};color:${b.earned ? '#fff' : 'var(--label3)'}">${I(b.icon)}</div><div style="font-size:24px;font-weight:700">${esc(b.name)}</div><div class="muted" style="margin-top:4px">${esc(b.desc)}</div><div class="pill" style="margin-top:14px">${I('star')} +40 XP</div></div>` });
  }

  // ---------- rewards watcher: celebrate level-ups, badges and challenges ----------
  let celebrating = false;
  function checkRewards() {
    if (!BW.profile().setup || celebrating) return;
    const lv = BW.level(), earned = BW.badges().filter(b => b.earned).map(b => b.id), ch = BW.challenge();
    const seenL = LS.get('seenLevel', null), seenB = LS.get('seenBadges', null), seenC = LS.get('seenChallenge', null);
    if (seenL == null || seenB == null) { LS.set('seenLevel', lv.n); LS.set('seenBadges', earned); LS.set('seenChallenge', ch.done ? ch.week : null); return; }
    let show = null;
    if (lv.n > seenL) { const th = THEMES.find(t => t.level === lv.n); show = { color: 'var(--accent)', icon: 'star', title: `Level ${lv.n}!`, sub: `You're now a <b>${lv.name}</b>.${th ? ` You unlocked the <b>${th.name}</b> theme.` : ''}` }; LS.set('seenLevel', lv.n); }
    else { const nb = earned.find(x => !seenB.includes(x)); if (nb) { const b = BW.badges().find(x => x.id === nb); show = { color: BADGE_COLORS[b.icon] || 'var(--accent)', icon: b.icon, title: b.name, sub: b.desc + ' · +40 XP' }; LS.set('seenBadges', [...seenB, nb]); } }
    if (!show && ch.done && seenC !== ch.week) { show = { color: 'var(--purple)', icon: 'target', title: 'Challenge complete!', sub: `${ch.title} · +${ch.xp} XP` }; LS.set('seenChallenge', ch.week); }
    if (!show) return;
    celebrating = true; confetti(); haptic(30);
    openSheet({ title: '', left: 'Done', body: `<div class="celebrate"><div class="med" style="background:${show.color}">${I(show.icon)}</div><div style="font-size:28px;font-weight:800">${esc(show.title)}</div><div class="muted" style="margin:6px 12px 18px;font-size:16px">${show.sub}</div><button class="btn" type="button" data-close2>Nice!</button></div>`, mount: (b, close) => { $('[data-close2]', b).onclick = close; }, onClose: () => { celebrating = false; setTimeout(checkRewards, 500); } });
  }

  // ---------- view events ----------
  function bindView() {
    const v = $('#view');
    v.onclick = async e => {
      const t = e.target.closest('button, [data-entry]'); if (!t) return;
      const d = t.dataset;
      if (d.day) { S.date = d.day; render(); haptic(5); return; }
      if (d.quick) { const en = BW.addEntry({ date: S.date, calories: +d.quick, source: 'quick' }); haptic(12); toast(`Added ${d.quick} cal to ${cap(en.meal)}`, { undo: () => BW.remove(en.id) }); return; }
      if (d.usual) { const u = BW.frequent()[+d.usual]; const en = BW.addEntry({ date: S.date, name: u.name, calories: u.calories, source: 'quick' }); haptic(12); toast(`${u.name} · ${u.calories} cal`, { undo: () => BW.remove(en.id) }); return; }
      if (d.entry) { if (t.closest('.swipe')?.classList.contains('open')) { closeSwipes(); return; } editEntry(d.entry); return; }
      if (d.del) { delEntry(d.del); return; }
      if (d.addmeal) return openLog({ meal: d.addmeal });
      if (d.water) { BW.setWater(S.date, BW.day(S.date).water + +d.water); haptic(6); return; }
      if (d.range) { S.progRange = +d.range; render(); return; }
      if (d.badge) return badgeSheet(d.badge);
      if (d.say) { if (!S.online || !S.status.ai) return toast(!S.online ? 'You’re offline — the coach needs internet' : 'The coach isn’t turned on yet', { icon: 'info' }); return sendCoach(d.say); }
      if (d.undoact) { undoCoach(+d.undoact); return; }
      if (d.go) { go(d.go); return; }
      switch (d.act) {
        case 'log': return openLog({ mode: 'quick' });
        case 'voice': return openLog({ mode: 'voice' });
        case 'type': return openLog({ mode: 'type', text: S.qdraft || '' });
        case 'rings': case 'health': return healthSheet();
        case 'streak': { const s = BW.streak(); return openSheet({ title: 'Streak', left: 'Done', body: `<div class="celebrate"><div class="med" style="background:var(--orange)">${I('flame')}</div><div style="font-size:44px;font-weight:800" class="num">${s.days} day${s.days === 1 ? '' : 's'}</div><div class="muted" style="margin:6px 10px 14px">${s.loggedToday ? 'You logged today. See you tomorrow!' : 'Log anything today to keep it going.'}</div></div><div class="group"><div class="row"><span class="grow">Best streak</span><span class="value num">${s.best} days</span></div><div class="row"><span class="grow">Streak freezes</span><span class="value num">${s.freezes} / 2</span></div></div><div class="footnote">Every 7 days in a row earns a freeze. It saves your streak if you miss a day.</div>` }); }
        case 'steps': return stepsSheet();
        case 'weight': return weightSheet();
        case 'clearchat': saveChat([]); render(); return;
        case 'profile': case 'goals': return goalsSheet();
        case 'stepgoal': return numberSheet({ title: 'Step goal', label: 'Every day', value: BW.profile().stepGoal, unit: 'steps', step: 500, min: 1000, max: 40000, onSave: n => BW.saveProfile({ stepGoal: Math.round(n) }) });
        case 'watergoal': return numberSheet({ title: 'Water goal', label: 'Every day', value: BW.profile().waterGoal, unit: 'glasses (8 oz)', step: 1, min: 1, max: 20, onSave: n => BW.saveProfile({ waterGoal: Math.round(n) }) });
        case 'earnsteps': BW.saveProfile({ earnSteps: !BW.profile().earnSteps }); haptic(6); return;
        case 'fitbit': return fitbitSheet();
        case 'signin': return signInSheet();
        case 'syncnow': await BW.sync(); await refreshMe(); toast(BW.syncError ? 'Sync failed: ' + BW.syncError : 'Synced', { icon: 'cloud' }); return;
        case 'signout': return confirmSheet({ title: 'Sign out?', text: 'Your log stays on this device. Sign back in any time to sync again.', confirm: 'Sign out', danger: true, onConfirm: async () => { await BW.signOut(); LS.set('fitbitLinked', false); toast('Signed out'); } });
        case 'themes': return themesSheet();
        case 'install': return installSheet();
        case 'voicehelp': return voiceHelpSheet();
        case 'export': return exportData();
        case 'wipe': return confirmSheet({ title: 'Delete all data?', text: 'This removes every food, weigh-in, badge and setting from this device. Your cloud backup (if you have one) stays until you sign in again.', confirm: 'Delete everything', danger: true, onConfirm: async () => { if (BW.acct()) await BW.signOut(); BW.wipe(); LS.del('coachDraft'); S.tab = 'today'; location.hash = ''; render(); } });
      }
    };
    // swipe-to-delete on food rows
    $$('.swipe .row', v).forEach(row => {
      let x0 = null, y0 = 0, dx = 0, drag = false;
      row.addEventListener('pointerdown', e => { if (e.pointerType === 'mouse') return; x0 = e.clientX; y0 = e.clientY; dx = 0; drag = false; });
      row.addEventListener('pointermove', e => { if (x0 == null) return; const mx = e.clientX - x0, my = e.clientY - y0; if (!drag && Math.abs(mx) > 8 && Math.abs(mx) > Math.abs(my)) { drag = true; closeSwipes(row.parentNode); row.parentNode.classList.add('dragging'); row.style.transition = 'none'; } if (drag) { dx = Math.min(0, mx + (row.parentNode.classList.contains('open') ? -88 : 0)); row.style.transform = `translateX(${Math.max(-120, dx)}px)`; } });
      const end = () => { if (x0 == null) return; x0 = null; row.style.transition = ''; row.parentNode.classList.remove('dragging'); if (!drag) return; const open = dx < -50; row.parentNode.classList.toggle('open', open); row.style.transform = open ? 'translateX(-88px)' : ''; if (dx < -150) { delEntry(row.dataset.entry); } setTimeout(() => drag = false, 50); };
      row.addEventListener('pointerup', end); row.addEventListener('pointercancel', end);
      row.addEventListener('click', e => { if (drag) { e.stopPropagation(); e.preventDefault(); } }, true);
      row.addEventListener('keydown', e => { if (e.key === 'Enter') editEntry(row.dataset.entry); if (e.key === 'Delete' || e.key === 'Backspace') delEntry(row.dataset.entry); });
    });
    const qf = $('#qlogForm');
    if (qf) {
      const qi = $('#qcal'), add = qf.querySelector('.qadd');
      qi.oninput = () => { S.qdraft = qi.value; add.disabled = !qi.value.trim(); $('#qhint').innerHTML = qHint(); };
      qf.onsubmit = e => {
        e.preventDefault();
        const v = qi.value.trim(); if (!v) return;
        const date = S.date;
        if (/^\d+$/.test(v)) {
          const n = +v; if (n <= 0 || n > 9999) return toast('Enter between 1 and 9,999 calories', { icon: 'info' });
          const en = BW.addEntry({ date, calories: n, source: 'quick' });
          S.qdraft = ''; haptic(12); toast(`Added ${fmt(n)} cal to ${cap(en.meal)}`, { undo: () => BW.remove(en.id) });
        } else {
          const r = BW_PARSE.parseLog(v);
          if (r.allKnown && r.total > 0) {
            const made = r.items.map(i => BW.addEntry({ date, meal: r.meal || undefined, name: i.name, calories: i.calories, source: 'text' }));
            S.qdraft = ''; haptic(12); toast(`${made.length > 1 ? made.length + ' items' : made[0].name} · ${fmt(r.total)} cal`, { undo: () => made.forEach(m => BW.remove(m.id)) });
          } else { S.qdraft = ''; openLog({ mode: 'type', text: v }); }
        }
        if (!finePointer) qi.blur();
      };
    }
    const f = $('#coachForm');
    if (f) {
      const ta = $('#coachInput');
      const grow = () => { ta.style.height = 'auto'; ta.style.height = Math.min(120, ta.scrollHeight) + 'px'; };
      ta.oninput = () => { LS.set('coachDraft', ta.value); grow(); };
      ta.onkeydown = e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); f.requestSubmit(); } };
      f.onsubmit = e => { e.preventDefault(); if (!S.online || !S.status.ai) return; sendCoach(ta.value); };
      grow();
    }
  }
  function closeSwipes(except) { $$('.swipe.open').forEach(s => { if (s !== except) { s.classList.remove('open'); s.querySelector('.row').style.transform = ''; } }); }
  function undoCoach(i) {
    const msgs = chat(), m = msgs[i]; if (!m || m.undone) return;
    const today = BW.dayKey();
    (m.ids || []).forEach(x => { if (x.id) BW.remove(x.id); if ('water' in x) BW.setWater(today, x.water); if ('weight' in x) { x.weight ? BW.setWeight(today, x.weight) : BW.remove('weight:' + today); } });
    m.undone = true; saveChat(msgs); render(); toast('Removed from your day');
  }

  function exportData() {
    const blob = new Blob([BW.exportCSV()], { type: 'text/csv' }), a = document.createElement('a');
    a.href = URL.createObjectURL(blob); a.download = `bitewise-${BW.dayKey()}.csv`; document.body.appendChild(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(a.href), 2000); toast('Exported your log', { icon: 'download' });
  }
  function installSheet() {
    const ios = /iphone|ipad|ipod/i.test(navigator.userAgent);
    openSheet({ title: 'Install BiteWise', left: 'Done', body: `<div class="footnote" style="margin:0 4px 14px;font-size:15px">Installed, BiteWise opens full screen like a real app and works with no internet.</div>
      ${S.installEvt ? `<button class="btn" type="button" id="ib">${I('download')} Install now</button>` : `<div class="group">${(ios ? [['share', 'Tap the Share button in Safari'], ['plus', 'Scroll down and tap “Add to Home Screen”'], ['check', 'Tap Add. Open BiteWise from your home screen.']] : [['right', 'Open your browser menu (⋮)'], ['download', 'Tap “Install app” or “Add to Home screen”'], ['check', 'Open BiteWise from your home screen.']]).map(([ic, t], i) => `<div class="row"><span class="icon-sq" style="background:var(--accent)">${I(ic)}</span><div class="grow"><div class="title" style="white-space:normal;font-size:16px">${i + 1}. ${t}</div></div></div>`).join('')}</div>`}`,
      mount: (b, close) => { $('#ib', b) && ($('#ib', b).onclick = async () => { S.installEvt.prompt(); await S.installEvt.userChoice; S.installEvt = null; close(); }); } });
  }
  async function voiceHelpSheet() {
    const vm = await voiceMode();
    openSheet({ title: 'Offline voice', left: 'Done', body: `
      <div class="group">
        <div class="row"><span class="icon-sq" style="background:var(--green)">${I('check')}</span><div class="grow"><div class="title" style="white-space:normal;font-size:16px">Understanding what you say is always offline</div><div class="sub">BiteWise turns “two eggs and toast” into calories on your phone. No internet needed.</div></div></div>
        <div class="row"><span class="icon-sq" style="background:${vm === 'local' ? 'var(--green)' : 'var(--orange)'}">${I('mic')}</span><div class="grow"><div class="title" style="white-space:normal;font-size:16px">${vm === 'local' ? 'This browser hears you offline too' : vm === 'downloadable' ? 'Download offline listening' : 'Your keyboard mic works offline'}</div><div class="sub">${vm === 'local' ? 'Speech is turned into text right on this device.' : vm === 'downloadable' ? 'One-time download so this browser can turn speech into text with no internet.' : 'The Voice tab uses your browser, which may need internet to listen. With no signal, open Type and tap the microphone key on your keyboard. iPhone and Android dictation work offline.'}</div></div></div>
      </div>
      ${vm === 'downloadable' ? `<button class="btn" type="button" id="vd" style="margin-top:14px">${I('download')} Download offline voice</button>` : ''}`,
      mount: (b, close) => { $('#vd', b) && ($('#vd', b).onclick = async () => { const SR = window.SpeechRecognition || window.webkitSpeechRecognition; try { const ok = await SR.install({ langs: [navigator.language || 'en-US'], processLocally: true }); toast(ok ? 'Offline voice ready' : 'Couldn’t download it right now', { icon: 'mic' }); } catch (e) { toast('Couldn’t download: ' + e.message, { icon: 'info' }); } close(); }); } });
  }

  // ---------- onboarding ----------
  const ob = { step: 0, p: null };
  function renderOnboarding() {
    $('#tabbar').hidden = true;
    ob.p ||= { ...BW.profile() };
    const p = ob.p, g = BW.goals(p), view = $('#view');
    const steps = `<div class="steps">${[1, 2, 3, 4].map(i => `<i class="${i <= ob.step ? 'on' : ''}"></i>`).join('')}</div>`;
    let body = '', foot = '';
    if (ob.step === 0) {
      body = `<div style="margin-top:6vh"><div class="logo">${I('bite')}</div></div><h1>Eat smart.<br>Log in seconds.</h1><p class="lead">BiteWise is the calorie counter you'll actually keep using. It works even with no internet.</p>
        <div style="display:flex;flex-direction:column;gap:18px;margin-top:10px">
          <div class="feature"><span class="icon-sq" style="background:var(--orange)">${I('bolt')}</span><div><b>Quick log</b><span>Just type the number. 450, done.</span></div></div>
          <div class="feature"><span class="icon-sq" style="background:var(--pink)">${I('mic')}</span><div><b>Say it or type it</b><span>“Two eggs and toast” becomes calories. Works offline.</span></div></div>
          <div class="feature"><span class="icon-sq" style="background:var(--purple)">${I('coach')}</span><div><b>Bitey, your AI coach</b><span>Meal ideas, check-ins, and it logs for you.</span></div></div>
          <div class="feature"><span class="icon-sq" style="background:#00B0B9">${I('watch')}</span><div><b>Steps, streaks and rewards</b><span>Fitbit steps, a Health Score, levels, badges and themes.</span></div></div>
        </div>`;
      foot = `<button class="btn" type="button" data-ob="next">Get started</button><button class="btn gray" type="button" data-ob="demo">Explore with sample data</button>`;
    } else if (ob.step === 1) {
      body = `${steps}<h1>About you</h1><p class="lead">This sets your daily calorie budget. It stays on your phone.</p>
        <div class="group">
          <div class="row"><span class="grow">Name</span><input class="inline-input" id="o_name" value="${esc(p.name)}" placeholder="Optional" style="width:55%"></div>
          <div class="row"><span class="grow">Sex</span><div class="seg" style="width:160px"><button type="button" data-sex="female" aria-pressed="${p.sex === 'female'}">Female</button><button type="button" data-sex="male" aria-pressed="${p.sex === 'male'}">Male</button></div></div>
          <div class="row"><span class="grow">Age</span><input class="inline-input num" id="o_age" inputmode="numeric" value="${p.age}"></div>
          <div class="row"><span class="grow">Height</span><span class="value"><input class="inline-input num" id="o_ft" inputmode="numeric" value="${Math.floor(p.heightIn / 12)}" style="width:28px"> ft <input class="inline-input num" id="o_in" inputmode="numeric" value="${p.heightIn % 12}" style="width:28px"> in</span></div>
          <div class="row"><span class="grow">Weight</span><span class="value"><input class="inline-input num" id="o_w" inputmode="decimal" value="${p.weightLb}" style="width:60px"> lb</span></div>
        </div>`;
      foot = `<button class="btn" type="button" data-ob="next">Continue</button><button class="btn gray" type="button" data-ob="back">Back</button>`;
    } else if (ob.step === 2) {
      body = g.teen ? `${steps}<h1>Healthy habits mode</h1><div class="card"><div class="feature"><span class="icon-sq" style="background:var(--green)">${I('heart')}</span><div><b>Under 18? We do this differently.</b><span>Your body is still growing and needs fuel. BiteWise won't set a calorie cut. Instead you'll earn XP for regular meals, water, steps and streaks. For any weight goal, talk with a doctor or a parent first.</span></div></div></div>`
        : `${steps}<h1>Your goal</h1><div class="group"><div class="row"><span class="grow">Goal weight</span><span class="value"><input class="inline-input num" id="o_goal" inputmode="decimal" value="${p.goalLb}" style="width:60px"> lb</span></div></div>
        <div style="display:flex;flex-direction:column;gap:8px">${[[0, 'Maintain', 'Keep my weight'], [0.5, 'Relaxed', '½ lb a week'], [1, 'Steady', '1 lb a week · recommended'], [1.5, 'Ambitious', '1½ lb a week'], [2, 'Fast', '2 lb a week']].map(([v, n, d]) => `<button class="opt" type="button" data-pace="${v}" aria-pressed="${p.pace === v}" ${v > g.maxPace ? 'disabled style="opacity:.4"' : ''}><div><b>${n}</b><span>${v > g.maxPace ? 'Too fast to be safe for your weight' : d}</span></div><span class="ck">${I('check')}</span></button>`).join('')}</div>`;
      foot = `<button class="btn" type="button" data-ob="next">Continue</button><button class="btn gray" type="button" data-ob="back">Back</button>`;
    } else if (ob.step === 3) {
      body = `${steps}<h1>How active are you?</h1><div style="display:flex;flex-direction:column;gap:8px">${[[1.2, 'Mostly sitting', 'School or desk, little exercise'], [1.375, 'Lightly active', 'Walk around, exercise 1–3 days'], [1.55, 'Active', 'Sports or workouts most days'], [1.725, 'Very active', 'Hard training every day']].map(([v, n, d]) => `<button class="opt" type="button" data-act2="${v}" aria-pressed="${p.activity === v}"><div><b>${n}</b><span>${d}</span></div><span class="ck">${I('check')}</span></button>`).join('')}</div>`;
      foot = `<button class="btn" type="button" data-ob="next">See my plan</button><button class="btn gray" type="button" data-ob="back">Back</button>`;
    } else {
      body = `${steps}<h1>${p.name ? esc(p.name) + ', your' : 'Your'} daily budget</h1><div class="card" style="text-align:center;padding:26px 16px"><div class="big-num num">${fmt(g.budget)}</div><div class="muted" style="font-weight:600">calories a day</div></div>
        <div class="group">
          <div class="row"><span class="grow">Maintenance</span><span class="value num">${fmt(g.tdee)}</span></div>
          ${g.teen ? `<div class="row"><span class="grow">Mode</span><span class="value">Healthy habits</span></div>` : `<div class="row"><span class="grow">Goal pace</span><span class="value">${g.pace ? g.pace + ' lb/week' : 'Maintain'}</span></div>
          ${g.pace && p.goalLb < p.weightLb ? `<div class="row"><span class="grow">Goal date (about)</span><span class="value">${(() => { const d = new Date(); d.setDate(d.getDate() + Math.round((p.weightLb - p.goalLb) / g.pace * 7)); return d.toLocaleDateString(undefined, { month: 'long', year: 'numeric' }); })()}</span></div>` : ''}`}
          <div class="row"><span class="grow">Walking bonus</span><span class="value">On · steps add calories</span></div>
        </div>${g.clamped ? `<div class="banner">${I('info')}<span>We raised your budget to the ${fmt(g.floor)} cal safety minimum.</span></div>` : ''}`;
      foot = `<button class="btn" type="button" data-ob="finish">Start logging</button><button class="btn gray" type="button" data-ob="back">Back</button>`;
    }
    view.innerHTML = `<div class="onb fade-in"><div class="body">${body}</div><div class="foot">${foot}</div></div>`;
    view.style.padding = '0';
    view.oninput = e => { const t = e.target, n = parseFloat(t.value); if (t.id === 'o_name') p.name = t.value; if (t.id === 'o_age' && n > 0) p.age = n; if (t.id === 'o_ft' || t.id === 'o_in') p.heightIn = (parseInt($('#o_ft').value) || 0) * 12 + (parseInt($('#o_in').value) || 0); if (t.id === 'o_w' && n > 0) { p.weightLb = n; if (p.goalLb >= n) p.goalLb = Math.round(n * .9); } if (t.id === 'o_goal' && n > 0) p.goalLb = n; };
    view.onclick = e => {
      const b = e.target.closest('button'); if (!b) return;
      if (b.dataset.sex) { p.sex = b.dataset.sex; renderOnboarding(); return; }
      if (b.dataset.pace) { p.pace = +b.dataset.pace; renderOnboarding(); return; }
      if (b.dataset.act2) { p.activity = +b.dataset.act2; renderOnboarding(); return; }
      const a = b.dataset.ob;
      if (a === 'next') { if (ob.step === 1 && (p.age < 5 || p.age > 110 || p.heightIn < 36 || p.weightLb < 50)) return toast('Check your age, height and weight', { icon: 'info' }); if (ob.step === 2 && !BW.goals(p).teen && p.goalLb >= p.weightLb) p.pace = 0; ob.step++; renderOnboarding(); window.scrollTo(0, 0); }
      if (a === 'back') { ob.step--; renderOnboarding(); }
      if (a === 'demo') { BW.seedDemo(); finishOnboarding(); toast('Sample data loaded — delete it any time in Me', { icon: 'info' }); }
      if (a === 'finish') { BW.saveProfile({ ...p, setup: true }); BW.setWeight(BW.dayKey(), p.weightLb); finishOnboarding(); confetti(80); }
    };
  }
  function finishOnboarding() { $('#view').style.padding = ''; $('#view').oninput = null; S.tab = 'today'; S.date = BW.dayKey(); render(); setTimeout(() => { LS.set('seenLevel', BW.level().n); LS.set('seenBadges', BW.badges().filter(b => b.earned).map(b => b.id)); LS.set('seenChallenge', BW.challenge().done ? BW.challenge().week : null); }, 50); }

  // ---------- sticky summary: "825 left" stays in view while scrolling Today ----------
  function updateMinibar() {
    const mb = $('#minibar'), hero = $('#heroCard');
    if (!mb) return;
    if (S.tab !== 'today' || !hero || !BW.profile().setup) { mb.classList.remove('show'); return; }
    const d = BW.day(S.date), over = d.remaining < 0;
    $('#mbText').innerHTML = `<b class="num" style="color:${over ? 'var(--orange)' : 'var(--accent)'}">${fmt(Math.abs(d.remaining))}</b> ${over ? 'over' : 'left'} <span class="muted num">· ${fmt(d.eaten)} / ${fmt(d.budget)}</span>${S.date !== BW.dayKey() ? ` <span class="muted">· ${dayLabel(S.date)}</span>` : ''}`;
    mb.classList.toggle('show', hero.getBoundingClientRect().bottom < 40);
  }
  addEventListener('scroll', () => requestAnimationFrame(updateMinibar), { passive: true });
  $('#mbAdd').onclick = () => { haptic(5); openLog(); };

  // ---------- routing ----------
  function go(tab) { S.tab = tab; if (location.hash.slice(1).split('?')[0] !== tab) history.replaceState(null, '', '#' + tab); render(); window.scrollTo(0, 0); }
  $('#tabbar').onclick = e => { const t = e.target.closest('[data-tab]'); if (t) { haptic(5); if (t.dataset.tab === 'log') return openLog(); if (t.dataset.tab === S.tab) { window.scrollTo({ top: 0, behavior: 'smooth' }); if (t.dataset.tab === 'today') { S.date = BW.dayKey(); render(); } return; } go(t.dataset.tab); } };
  function readHash() {
    const [tab, q] = location.hash.slice(1).split('?');
    if (['today', 'progress', 'coach', 'me'].includes(tab)) S.tab = tab;
    if (tab === 'log' || tab === 'voice') { S.tab = 'today'; history.replaceState(null, '', '#today'); setTimeout(() => BW.profile().setup && openLog({ mode: tab === 'voice' ? 'voice' : 'quick' }), 300); }
    const fb = new URLSearchParams(q || '').get('fitbit');
    if (fb) {
      history.replaceState(null, '', '#' + S.tab);
      setTimeout(() => {
        if (fb === 'connected') { LS.set('fitbitLinked', true); toast('Fitbit connected', { icon: 'watch' }); autoFitbit(true); }
        else toast(fb === 'error' ? 'Fitbit didn’t connect. Try again.' : 'Fitbit isn’t available', { icon: 'info' });
      }, 400);
    }
  }

  // ---------- boot ----------
  let renderQueued = false;
  BW.on(() => { if (renderQueued) return; renderQueued = true; requestAnimationFrame(() => { renderQueued = false; if (BW.profile().setup) render(); else if (!ob.p) renderOnboarding(); checkRewards(); }); });
  const setOnline = () => { S.online = navigator.onLine; if (BW.profile().setup) render(); if (S.online) { BW.sync(); autoFitbit(); } };
  addEventListener('online', setOnline); addEventListener('offline', setOnline);
  addEventListener('beforeinstallprompt', e => { e.preventDefault(); S.installEvt = e; });
  addEventListener('hashchange', () => { readHash(); render(); });
  document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'visible') { const t = BW.dayKey(); if (S.date !== t && S._lastToday !== t) { S.date = t; } S._lastToday = t; render(); BW.sync(); autoFitbit(); } });
  S._lastToday = BW.dayKey();

  readHash(); render(); checkRewards();
  fetch('/api/status').then(r => r.json()).then(j => { S.status = j; if (BW.profile().setup) render(); }).catch(() => {});
  BW.sync(); refreshMe();
  if ('serviceWorker' in navigator && location.protocol !== 'file:') navigator.serviceWorker.register('/sw.js').catch(() => {});
})();
