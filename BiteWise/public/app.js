// BiteWise UI. Screens: Today, Progress, Coach, Me + the Log sheet (Quick / Voice / Type) and onboarding.
(function () {
  const $ = (s, r = document) => r.querySelector(s);
  const $$ = (s, r = document) => [...r.querySelectorAll(s)];
  const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const fmt = n => Math.round(n).toLocaleString();
  const haptic = (ms = 8) => { try { navigator.vibrate?.(ms); } catch {} };
  const cap = s => s.charAt(0).toUpperCase() + s.slice(1);
  const { LS } = BW;
  // ---------- version + updates (keep in sync with version.json; bump both when shipping) ----------
  const APP_VERSION = '1.6.0';
  const vcmp = (a, b) => { const x = String(a).split('.').map(Number), y = String(b).split('.').map(Number); for (let i = 0; i < 3; i++) { if ((x[i] || 0) !== (y[i] || 0)) return (x[i] || 0) - (y[i] || 0); } return 0; };

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
    moon: '<path d="M20 14.5A8 8 0 019.5 4a8 8 0 1010.5 10.5z"/>',
    hash: '<path d="M5 9h14M5 15h14M10 4L8 20M16 4l-2 16"/>',
    eye: '<path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7S2 12 2 12z"/><circle cx="12" cy="12" r="3"/>',
    search: '<circle cx="11" cy="11" r="7"/><path d="M20 20l-4-4"/>',
    play: '<path d="M7 4l13 8-13 8z"/>',
    book: '<path d="M4 5a2 2 0 012-2h13v16H6a2 2 0 00-2 2zM4 19V5M19 17H6"/>',
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
  const S = { tab: 'today', date: BW.dayKey(), progRange: 7, status: { ai: false, health: null, model: '' }, online: navigator.onLine, coachBusy: false, installEvt: null };
  const MEALS = [['breakfast', 'Breakfast'], ['lunch', 'Lunch'], ['dinner', 'Dinner'], ['snack', 'Snacks']];
  const MEAL_ICON = { breakfast: ['sun', '#FF9F0A'], lunch: ['fork', '#30B0C7'], dinner: ['moon', '#5E5CE6'], snack: ['bite', '#FF375F'] };
  const mealPills = (cur, attr = 'data-meal') => `<div class="meal-pills" role="radiogroup" aria-label="Meal">${MEALS.map(([m, l]) => `<button type="button" ${attr}="${m}" role="radio" aria-checked="${cur === m}" aria-pressed="${cur === m}" style="--mc:${MEAL_ICON[m][1]}">${I(MEAL_ICON[m][0])}${l}</button>`).join('')}</div>`;
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
    sheets.push(entry); document.body.classList.add('sheet-open');
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
    const i = sheets.indexOf(entry); if (i < 0) return; sheets.splice(i, 1); if (!sheets.length) document.body.classList.remove('sheet-open');
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

  // ---------- smooth rendering: patch the page in place instead of replacing it ----------
  // Keeps elements alive between renders so CSS transitions (bars, rings) animate and focus/scroll never jump.
  function morph(from, to) {
    if (from.nodeType !== to.nodeType || from.nodeName !== to.nodeName || (from.dataset && to.dataset && from.dataset.key !== to.dataset.key)) { from.replaceWith(to); return; }
    if (from.nodeType === 3) { if (from.nodeValue !== to.nodeValue) from.nodeValue = to.nodeValue; return; }
    if (from.nodeType !== 1) return;
    for (const a of [...from.attributes]) if (!to.hasAttribute(a.name)) from.removeAttribute(a.name);
    for (const a of [...to.attributes]) {
      if (from.getAttribute(a.name) === a.value) continue;
      if (a.name === 'value' && from === document.activeElement) continue;
      from.setAttribute(a.name, a.value);
    }
    if ((from.tagName === 'INPUT' || from.tagName === 'TEXTAREA') && from !== document.activeElement && from.value !== (to.getAttribute('value') ?? to.value ?? '')) from.value = to.tagName === 'TEXTAREA' ? to.value : (to.getAttribute('value') ?? '');
    if (from.tagName === 'svg' || from.namespaceURI === 'http://www.w3.org/2000/svg') { if (from.innerHTML !== to.innerHTML) { morphChildren(from, to); } return; }
    morphChildren(from, to);
  }
  function morphChildren(from, to) {
    const a = [...from.childNodes], b = [...to.childNodes];
    // keyed children (food rows) are matched by data-key so inserting one doesn't rebuild the list
    const keyed = new Map(); a.forEach(n => n.dataset?.key && keyed.set(n.dataset.key, n));
    let i = 0;
    for (const nb of b) {
      const k = nb.dataset?.key; let na = k ? keyed.get(k) : a[i];
      if (k && na && from.childNodes[i] !== na) from.insertBefore(na, from.childNodes[i] || null);
      na = from.childNodes[i];
      if (!na) from.appendChild(nb);
      else if (k && na.dataset?.key !== k) from.insertBefore(nb, na);
      else morph(na, nb);
      i++;
    }
    while (from.childNodes.length > b.length) from.lastChild.remove();
  }
  const counts = new WeakMap();
  function animateCounts(root) {
    if (matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    $$('[data-count]', root).forEach(el => {
      const to = +el.dataset.count, from = counts.has(el) ? counts.get(el) : null; counts.set(el, to);
      if (from == null || from === to) { el.textContent = fmt(to); return; }
      const t0 = performance.now(), dur = 520;
      const step = now => { const k = Math.min(1, (now - t0) / dur), e = 1 - Math.pow(1 - k, 3); el.textContent = fmt(from + (to - from) * e); if (k < 1 && counts.get(el) === to) requestAnimationFrame(step); };
      requestAnimationFrame(step);
    });
  }

  // ---------- rendering ----------
  function render() {
    const p = BW.profile();
    if (!p.setup) return renderOnboarding();
    applyTheme();
    const active = document.activeElement, focusId = active?.id, selS = active?.selectionStart, selE = active?.selectionEnd;
    const view = $('#view');
    if (view.style.padding) { view.style.padding = ''; view.oninput = null; view.innerHTML = ''; ob.p = null; } // leaving onboarding (also after signing in on a new device)
    const html = S.tab === 'today' ? viewToday() : S.tab === 'progress' ? viewProgress() : S.tab === 'coach' ? viewCoach() : viewMe();
    const next = document.createElement('main'); next.innerHTML = html;
    if (view.dataset.tab !== S.tab || !view.firstElementChild) { view.innerHTML = html; view.dataset.tab = S.tab; view.classList.remove('tab-in'); void view.offsetWidth; view.classList.add('tab-in'); }
    else morphChildren(view, next);
    animateCounts(view);
    $$('.tab').forEach(t => t.setAttribute('aria-selected', t.dataset.tab === S.tab)); document.body.dataset.tab = S.tab; document.body.dataset.cview = S.coachView || 'chat';
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
  // allergies: the person's list vs a food's allergens
  const myAllergies = () => BW.profile().allergies || [];
  const clash = al => (al || []).filter(a => myAllergies().includes(a));
  const warnTag = al => { const c = clash(al); return c.length ? `<span class="alg" title="Contains ${esc(c.join(', '))}">${I('info')}${esc(c.join(', '))}</span>` : ''; };
  // meal for the Today quick log: follows the clock unless the person taps the meal name to change it
  const qMeal = () => S.qmeal || (S.date === BW.dayKey() ? BW.mealForNow() : 'lunch');
  function qHint(v = S.qdraft || '') {
    const m = qMeal(), label = MEALS.find(x => x[0] === m)[1];
    const mealBtn = `<button type="button" class="meal-link" data-act="cyclemeal" style="--mc:${MEAL_ICON[m][1]}">${I(MEAL_ICON[m][0])}${label}</button>`;
    v = v.trim();
    if (!v) return `Adds to ${mealBtn}`;
    if (/^\d+$/.test(v)) return `Adds <b>${fmt(+v)} cal</b> to ${mealBtn}`;
    const r = BW_PARSE.parseLog(v);
    if (!r.items.length) return `Adds to ${mealBtn}`;
    return r.items.map(i => `${esc(i.name)} <b>${i.calories ?? '?'}</b>${warnTag(i.allergens)}`).join(' · ') + (r.allKnown ? ` = <b>${fmt(r.total)}</b>` : '');
  }

  const ago = t => { const m = Math.round((Date.now() - t) / 60000); return m < 1 ? 'just now' : m < 60 ? m + ' min ago' : m < 1440 ? Math.round(m / 60) + ' hr ago' : 'a while ago'; };
  // while typing a food name on Today, the chips turn into matching foods from the database (one tap logs it)
  function qChips(fallback) {
    const v = (S.qdraft || '').trim();
    if (!v || /^\d+$/.test(v)) { S.sugg = []; return fallback; }
    S.sugg = BW_PARSE.searchAll(v.split(/,| and /).pop().trim(), 6).map(f => ({ ...f, name: f.name.length > 34 ? f.name.slice(0, 32) + '…' : f.name }));
    return S.sugg.length ? S.sugg.map((f, i) => `<button class="chip fill" type="button" data-sugg="${i}">${esc(f.name)} <span class="k num">${f.calories}</span>${warnTag(f.allergens)}</button>`).join('') : fallback;
  }
  function weekCard() {
    const today = BW.dayKey(), days = Array.from({ length: 7 }, (_, i) => BW.day(BW.addDays(today, i - 6)));
    const done = days.filter(d => d.entries.length && d.k !== today);
    const avg = done.length ? done.reduce((a, d) => a + d.eaten, 0) / done.length : 0, on = done.filter(d => d.eaten <= d.budget * 1.1).length;
    const tr = BW.trend(), st = BW.streak(), g = BW.goals();
    const title = !done.length ? (days.some(d => d.entries.length) ? 'Nice start' : 'Your week starts here') : on === done.length ? 'Every day on track' : `${on} of ${done.length} days on track`;
    const stat = (k, v, sub, color) => `<div class="wstat"><span class="st-k">${k}</span><b class="num" ${color ? `style="color:${color}"` : ''}>${v}</b><span class="caption">${sub}</span></div>`;
    return `<div class="card week-card">
      <div class="card-head"><div><div class="st-k">This week</div><div class="big-stat" style="font-size:20px">${title}</div></div><button class="link-btn" type="button" data-go="progress" style="font-size:15px">More</button></div>
      <div class="wdays">${days.map(d => { const pct = d.budget ? d.eaten / d.budget : 0, over = d.eaten > d.budget * 1.1, has = d.entries.length > 0;
        return `<button type="button" class="wday ${d.k === S.date ? 'sel' : ''} ${d.k === today ? 'today' : ''}" data-day="${d.k}" aria-label="${longDate(d.k)}: ${fmt(d.eaten)} calories"><span class="wring">${ringSVG([{ pct: has ? pct : 0, color: !has ? 'var(--label3)' : over ? 'var(--orange)' : 'var(--accent)' }], 36)}</span><b class="num">${has ? (d.eaten >= 1000 ? (d.eaten / 1000).toFixed(1) + 'k' : fmt(d.eaten)) : '–'}</b><span>${BW.parseDay(d.k).toLocaleDateString(undefined, { weekday: 'narrow' })}</span></button>`; }).join('')}</div>
      <div class="wstats">
        ${stat('Average', done.length ? fmt(avg) : '–', done.length ? (avg <= g.budget ? `${fmt(g.budget - avg)} under goal` : `${fmt(avg - g.budget)} over goal`) : 'cal a day')}
        ${stat('On track', done.length ? `${on}/${done.length}` : '–', 'days this week')}
        ${stat('Streak', st.days, st.days === 1 ? 'day' : 'days', st.days ? 'var(--orange)' : '')}
        ${stat('Weight', tr ? tr.now.toFixed(1) : '–', tr && tr.perWeek != null ? (Math.abs(tr.perWeek) < .1 ? 'steady' : `${tr.perWeek < 0 ? '↓' : '↑'} ${Math.abs(tr.perWeek).toFixed(1)} lb/wk`) : tr ? 'lb trend' : 'log a weigh-in')}
      </div>
    </div>`;
  }

  // "Fits your day": foods you eat often (then everyday staples) that fit in what's left, sized for the next meal
  const STAPLES = ['Greek yogurt', 'Apple', 'Banana', 'String cheese', 'Turkey sandwich', 'Grilled chicken', 'Side salad', 'Oatmeal', '2 eggs', 'Hummus', 'Almonds', 'Burrito bowl', 'Chicken wrap', 'Rice', 'Soup', 'Popcorn', 'Protein bar', 'Carrots', 'Grapes'];
  function fitsList(remaining, meal) {
    const target = { breakfast: 400, lunch: 600, dinner: 700, snack: 250 }[meal] || 400;
    const want = Math.min(remaining, target);
    const foodAl = n => (window.BW_FOODS.find(f => f.aliases.some(a => a.toLowerCase() === n.toLowerCase().replace(/^\d+ /, ''))) || {}).allergens || [];
    const pool = [];
    for (const u of BW.frequent()) pool.push({ name: u.name, calories: u.calories, usual: true });
    for (const n of STAPLES) { const r = BW_PARSE.parseLog(n).items[0]; if (r?.calories) pool.push({ name: r.name, calories: r.calories, allergens: r.allergens }); }
    const seen = new Set();
    return pool.filter(f => f.calories > 0 && f.calories <= remaining && !clash(f.allergens || foodAl(f.name)).length && !seen.has(f.name.toLowerCase()) && seen.add(f.name.toLowerCase()))
      .sort((a, b) => (Math.abs(a.calories - want) - (a.usual ? 60 : 0)) - (Math.abs(b.calories - want) - (b.usual ? 60 : 0))).slice(0, 3);
  }
  function fitsCard(d) {
    const meal = qMeal(), label = MEALS.find(x => x[0] === meal)[1].replace('Snacks', 'a snack').toLowerCase();
    if (d.remaining <= 50) return `<div class="card t-fits"><div class="st-k">Fits your day</div><div class="big-stat" style="font-size:20px">${d.remaining < 0 ? 'Over for today, and that’s okay' : 'You’ve hit your goal'}</div><p class="insight" style="margin-bottom:0">${d.remaining < 0 ? 'One day doesn’t undo a week. Tomorrow is a fresh start.' : 'Water and veggies are free wins if you’re still hungry.'}</p></div>`;
    const list = fitsList(d.remaining, meal);
    if (!list.length) return '';
    S.fits = list;
    return `<div class="card t-fits"><div class="card-head"><div><div class="st-k">Fits your day</div><div class="big-stat" style="font-size:20px">Ideas for ${esc(label)}</div></div><span class="caption num">${fmt(d.remaining)} left</span></div>
      <div class="fits">${list.map((f, i) => `<button class="fit" type="button" data-fit="${i}"><span class="grow"><b>${esc(f.name)}</b><span class="caption">${f.usual ? 'You have this a lot' : 'Everyday pick'}</span></span><span class="kcal num">${fmt(f.calories)}</span><span class="fit-add">${I('plus')}</span></button>`).join('')}</div></div>`;
  }
  function viewToday() {
    const p = BW.profile(), k = S.date, d = BW.day(k), st = BW.streak(), today = BW.dayKey(), isToday = k === today;
    const over = d.remaining < 0, calPct = Math.min(100, d.eaten / d.budget * 100), stepPct = Math.min(100, d.steps / p.stepGoal * 100);
    const linked = !!LS.get('healthLinked', false), pulled = LS.get('healthPulled', 0), src = BW.stepSource(k);
    const usuals = BW.frequent().slice(0, 8);
    const chips = usuals.length ? usuals.map((u, i) => `<button class="chip fill" type="button" data-usual="${i}">${esc(u.name)} <span class="k num">${u.calories}</span></button>`).join('')
      : [100, 200, 300, 500].map(n => `<button class="chip fill" type="button" data-quick="${n}">+${n}</button>`).join('');
    const stepLine = S.syncingSteps ? `<span class="sync-dot"></span>Syncing Fitbit…`
      : src === 'fitbit' ? `${I('watch')}Fitbit · ${ago(pulled)}` : linked ? `${I('watch')}Fitbit · tap to sync` : S.status.health ? 'Tap to connect Fitbit' : 'Tap to add steps';
    const es = d.entries.slice().sort((a, b) => b.time - a.time);
    const mealTot = MEALS.map(([m, l]) => [m, l, d.meals[m].reduce((a, e) => a + e.calories, 0)]);
    return `
    <div class="topbar">
      <div class="daynav">
        <div class="subtitle">${longDate(k)}</div>
        <div class="daynav-row"><button class="dn" type="button" data-shift="-1" aria-label="Previous day">${I('left')}</button><h1 class="large-title">${dayLabel(k)}</h1>${isToday ? '' : `<button class="dn" type="button" data-shift="1" aria-label="Next day">${I('right')}</button>`}</div>
      </div>
      <div style="display:flex;gap:6px;align-items:center">${offlinePill()}${st.days ? `<button class="pill streak" type="button" data-act="streak" aria-label="${st.days} day streak">${I('flame')}<span class="num">${st.days}</span></button>` : ''}</div>
    </div>
    <div class="today-grid">
      <div class="card t-cal" id="heroCard">
        <button class="t-cal-main" type="button" data-act="calinfo">
          <div class="st-k">Calories eaten</div>
          <div class="t-big"><span class="num" data-count="${d.eaten}">${fmt(d.eaten)}</span><small class="num"> / ${fmt(d.budget)}</small></div>
          <div class="bar big"><i style="width:${calPct}%;${over ? 'background:var(--orange)' : ''}"></i></div>
          <div class="st-sub ${over ? 'warn' : ''}"><b class="num">${fmt(Math.abs(d.remaining))}</b>&nbsp;${over ? 'over your goal' : 'left today'}${d.bonus ? ` · includes +${d.bonus} from steps` : ''}</div>
        </button>
        <div class="meal-split">${mealTot.map(([m, l, v]) => `<button type="button" data-addmeal="${m}" style="--mc:${MEAL_ICON[m][1]}" aria-label="${l}: ${fmt(v)} calories. Add to ${l}"><span class="ms-ic">${I(MEAL_ICON[m][0])}</span><b class="num">${v ? fmt(v) : '—'}</b><span>${l}</span></button>`).join('')}</div>
      </div>
      <button class="card t-steps" type="button" data-act="steps">
        <div class="st-k">Steps</div>
        <div class="t-big"><span class="num" data-count="${d.steps}">${fmt(d.steps)}</span></div>
        <div class="bar big"><i style="width:${stepPct}%;background:var(--pink)"></i></div>
        <div class="st-sub">${d.steps >= p.stepGoal ? '<b>Goal reached!</b>' : `<b class="num">${fmt(Math.max(0, p.stepGoal - d.steps))}</b>&nbsp;to your ${fmt(p.stepGoal)} goal`}</div>
        <div class="st-sub src">${stepLine}${p.earnSteps && d.bonus ? ` · <b>+${d.bonus} cal</b>` : ''}</div>
        <div class="spark" aria-hidden="true">${(() => { const ds = Array.from({ length: 7 }, (_, i) => BW.day(BW.addDays(today, i - 6))), mx = Math.max(p.stepGoal, ...ds.map(x => x.steps)); return ds.map(x => `<span><i style="height:${Math.max(3, x.steps / mx * 100)}%;${x.steps >= p.stepGoal ? '' : 'opacity:.45'}"></i><em>${BW.parseDay(x.k).toLocaleDateString(undefined, { weekday: 'narrow' })}</em></span>`).join(''); })()}</div>
      </button>
      <div class="card t-log">
        <form class="qlog" id="qlogForm" autocomplete="off" style="margin-top:0">
          <label class="qfield"><input id="qcal" inputmode="${finePointer ? 'text' : 'numeric'}" enterkeyhint="done" placeholder="Add calories" value="${esc(S.qdraft || '')}" aria-label="Add calories"><span class="u">cal</span></label>
          <button class="qadd" type="submit" ${S.qdraft ? '' : 'disabled'} aria-label="Add">${I('plus')}</button>
          <button class="qicon" type="button" data-act="search" aria-label="Search foods">${I('search')}</button>
          <button class="qicon" type="button" data-act="voice" aria-label="Say what you ate">${I('mic')}</button>
        </form>
        <div class="qhint" id="qhint">${qHint()}</div>
        <div class="chips" id="qchips" style="margin-top:10px">${qChips(chips)}</div>
      </div>
      <div class="t-food">
      ${!linked && isToday && !LS.get('hideFitbitCard', false) && S.status.health ? `<div class="card connect-card t-connect" style="margin-bottom:12px"><span class="icon-sq" style="background:#00B0B9">${I('watch')}</span><div class="grow"><b>Count your Fitbit steps</b><span>Connect once. Steps fill in on their own.</span></div><button class="btn small" type="button" data-act="fitbit">Connect</button><button class="x-close" type="button" data-act="hidefitbit" aria-label="Hide">${I('x')}</button></div>` : ''}
        <div class="section-head food-head"><h2>${isToday ? 'Today’s food' : 'Food'}</h2>${es.length ? `<span class="caption num">${es.length} item${es.length > 1 ? 's' : ''} · ${finePointer ? 'click to edit' : 'swipe to delete'}</span>` : ''}</div>
        ${es.length ? `<div class="group food-list">${es.map(e => `<div class="swipe" data-key="${e.id}"><div class="del" data-del="${e.id}">Delete</div><div class="row entry tap" data-entry="${e.id}" role="button" tabindex="0"><span class="meal-ic" style="--mc:${MEAL_ICON[e.meal]?.[1] || 'var(--accent)'}">${I(MEAL_ICON[e.meal]?.[0] || 'bite')}</span><div class="grow"><div class="title">${esc(e.name)}</div><div class="sub">${cap(e.meal)} · ${new Date(e.time).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })}${warnTag(e.allergens)}</div></div><span class="kcal num">${fmt(e.calories)}</span></div></div>`).join('')}</div>`
        : `<div class="card empty"><div class="icon-sq" style="background:var(--fill);color:var(--label2);width:44px;height:44px;border-radius:12px">${I('fork')}</div><b>${isToday ? 'Nothing logged yet' : 'Nothing logged this day'}</b><span>Type a number above and press ${finePointer ? 'Enter' : 'Add'}. That's it.</span></div>`}
      </div>
      ${isToday ? fitsCard(d) : ''}
      <div class="t-week">${weekCard()}</div>
    </div>`;
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
  function stepsChart(n) {
    const today = BW.dayKey(), goal = BW.profile().stepGoal, days = Array.from({ length: n }, (_, i) => BW.day(BW.addDays(today, i - n + 1)));
    const W = 340, H = 150, pad = 26, max = Math.max(goal * 1.15, ...days.map(d => d.steps)) || 10000;
    const bw = (W - pad) / n, y = v => H - 18 - (v / max) * (H - 30);
    return `<svg class="chart" viewBox="0 0 ${W} ${H}" role="img" aria-label="Steps per day">
      <line x1="${pad}" x2="${W}" y1="${y(goal)}" y2="${y(goal)}" stroke="var(--label2)" stroke-dasharray="4 4"/>
      <text x="0" y="${y(goal) + 4}">${Math.round(goal / 1000)}k</text><text x="0" y="${y(0) + 4}">0</text>
      ${days.map((d, i) => `<rect x="${pad + i * bw + bw * .18}" y="${y(d.steps)}" width="${bw * .64}" height="${Math.max(0, H - 18 - y(d.steps))}" rx="${Math.min(4, bw * .25)}" fill="var(--pink)" opacity="${d.steps >= goal ? 1 : .55}"/>`).join('')}
      ${days.map((d, i) => (n <= 7 || i % 5 === 0 || i === n - 1) ? `<text x="${pad + i * bw + bw / 2}" y="${H - 3}" text-anchor="middle">${n <= 7 ? BW.parseDay(d.k).toLocaleDateString(undefined, { weekday: 'narrow' }) : BW.parseDay(d.k).getDate()}</text>` : '').join('')}</svg>`;
  }
  function viewProgress() {
    const n = S.progRange, today = BW.dayKey(), g = BW.goals(), p = BW.profile();
    const range = Array.from({ length: n }, (_, i) => BW.day(BW.addDays(today, i - n + 1)));
    const logged = range.filter(d => d.entries.length && d.k !== today);
    const avg = logged.length ? logged.reduce((a, d) => a + d.eaten, 0) / logged.length : 0;
    const onBudget = logged.filter(d => d.eaten <= d.budget * 1.1).length;
    const stepDays = range.filter(d => d.steps > 0), avgSteps = stepDays.length ? stepDays.reduce((a, d) => a + d.steps, 0) / stepDays.length : 0;
    const tr = BW.trend(), lv = BW.level(), st = BW.streak(), ch = BW.challenge(), h = BW.health(today), d0 = BW.day(today);
    const earned = BW.badges().filter(b => b.earned);
    const word = n === 7 ? 'this week' : 'this month';
    const calLine = !logged.length ? 'Log a few days to see your average.' : avg <= g.budget ? `You're averaging <b>${fmt(g.budget - avg)} under</b> your budget ${word}. Nice.` : `You're averaging <b>${fmt(avg - g.budget)} over</b> your budget ${word}.`;
    const stepLine = !stepDays.length ? 'Connect Fitbit or add steps to see them here.' : avgSteps >= p.stepGoal ? `Averaging <b>${fmt(avgSteps)}</b> a day. Above your goal!` : `Averaging <b>${fmt(avgSteps)}</b> a day, <b>${fmt(p.stepGoal - avgSteps)}</b> short of your goal.`;
    return `
    <div class="topbar"><div><div class="subtitle">${g.teen ? 'Healthy habits' : 'How you’re doing'}</div><h1 class="large-title">Progress</h1></div>
      <div class="seg" style="width:150px"><button type="button" data-range="7" aria-pressed="${n === 7}">Week</button><button type="button" data-range="30" aria-pressed="${n === 30}">Month</button></div></div>
    <div class="cols"><div class="col-main">
      ${groupsCard()}
      <div class="card">
        <div class="card-head"><div><div class="st-k">Calories · average</div><div class="big-stat"><span class="num" data-count="${Math.round(avg)}">${fmt(avg)}</span><small> / day</small></div></div><div class="mini-stat"><b class="num">${onBudget}/${logged.length || 0}</b><span>days on budget</span></div></div>
        <p class="insight">${calLine}</p>
        ${calChart(n)}
      </div>
      <div class="card">
        <div class="card-head"><div><div class="st-k">Steps · average</div><div class="big-stat"><span class="num" data-count="${Math.round(avgSteps)}">${fmt(avgSteps)}</span><small> / day</small></div></div>${LS.get('healthLinked', false) ? `<span class="pill">${I('watch')}Fitbit</span>` : `<button class="btn small tinted" type="button" data-act="fitbit">Connect Fitbit</button>`}</div>
        <p class="insight">${stepLine}</p>
        ${stepsChart(n)}
      </div>
      <div class="card">
        <div class="card-head"><div><div class="st-k">Weight · trend</div><div class="big-stat">${tr ? `<span class="num">${tr.now.toFixed(1)}</span><small> lb</small>` : '<small>No weigh-ins yet</small>'}</div></div><button class="btn small tinted" type="button" data-act="weight">Log weight</button></div>
        ${tr ? `<p class="insight">${tr.eta ? `Down <b>${tr.lost.toFixed(1)} lb</b> so far. At this pace you'll hit ${p.goalLb} lb around <b>${tr.eta.toLocaleDateString(undefined, { month: 'long', day: 'numeric' })}</b>.` : tr.lost > 0 ? `Down <b>${tr.lost.toFixed(1)} lb</b> so far. Keep weighing in a few times a week.` : 'The line smooths out daily water-weight ups and downs.'}</p>${tr.pts.length > 1 ? weightChart(tr) : ''}` : `<p class="insight">Weigh in 2–3 times a week, in the morning. The trend line ignores day-to-day swings.</p>`}
      </div>
    </div><div class="col-side">
      <div class="card">
        <div class="card-head"><div><div class="st-k">Today’s habits</div></div><button class="link-btn" type="button" data-act="health" style="font-size:15px">Health Score ${h.score}</button></div>
        <div class="habit"><span class="icon-sq" style="background:var(--cyan)">${I('drop')}</span><div class="grow"><b>Water</b><span class="num">${d0.water} of ${p.waterGoal} glasses</span></div><div class="stepper"><button type="button" data-water="-1" aria-label="Remove a glass">−</button><button type="button" data-water="1" aria-label="Add a glass">+</button></div></div>
        <div class="bar" style="margin:10px 0 2px"><i style="width:${Math.min(100, d0.water / p.waterGoal * 100)}%;background:var(--cyan)"></i></div>
      </div>
      <div class="card rewards">
        <div class="card-head"><div><div class="st-k">Level ${lv.n}</div><div class="big-stat" style="font-size:24px">${lv.name}</div></div><button class="pill streak" type="button" data-act="streak">${I('flame')}<span class="num">${st.days} days</span></button></div>
        <div class="bar" style="margin-top:4px"><i style="width:${lv.pct * 100}%"></i></div>
        <div class="caption num" style="margin-top:6px">${lv.next ? `${fmt(lv.next - lv.xp)} XP to level ${lv.n + 1}` : 'Max level!'}</div>
        <div class="challenge"><div class="grow"><b>${ch.title}</b><span>${ch.desc} · ${ch.done ? 'done!' : `${ch.progress} of ${ch.need}`}</span></div><span class="pill" style="color:var(--purple)">+${ch.xp} XP</span></div>
        <button class="badge-row" type="button" data-act="badges">${earned.slice(0, 6).map(b => `<span class="med sm" style="background:${BADGE_COLORS[b.icon] || 'var(--accent)'}">${I(b.icon)}</span>`).join('')}<span class="caption" style="margin-left:auto">${earned.length} of ${BW.badges().length} badges ›</span></button>
      </div>
    </div></div>`;
  }
  function badgesSheet() {
    const bs = BW.badges();
    openSheet({ title: 'Badges', left: 'Done', body: `<div class="badges" style="padding:6px 0 10px">${bs.map(b => `<button class="badge ${b.earned ? '' : 'off'}" type="button" data-badge="${b.id}"><div class="med" style="background:${BADGE_COLORS[b.icon] || 'var(--accent)'}">${I(b.icon)}</div>${esc(b.name)}</button>`).join('')}</div>`, mount: b => { b.onclick = e => { const x = e.target.closest('[data-badge]'); if (x) badgeSheet(x.dataset.badge); }; } });
  }

  // ---------- coach ----------
  // make web addresses in coach replies tappable (text is escaped first, so only real links become links)
  const linkify = t => esc(t).replace(/\bhttps?:\/\/[^\s<>"')]+[^\s<>"').,!?]/g, u => `<a href="${u}" target="_blank" rel="noopener noreferrer">${u}</a>`);
  const chat = () => LS.get('coachChat', []);
  const saveChat = m => LS.set('coachChat', m.slice(-40));
  function coachContext() {
    const p = BW.profile(), g = BW.goals(), today = BW.dayKey(), d = BW.day(today), tr = BW.trend();
    return {
      now: new Date().toLocaleString(), user: { name: p.name || undefined, age: p.age, gender: p.sex, allergies: p.allergies || [], heightIn: p.heightIn, weightLb: p.weightLb, goalLb: p.goalLb, under18: g.teen },
      plan: { dailyBudget: g.budget, maintenanceCalories: g.tdee, lossPaceLbPerWeek: g.pace, stepGoal: p.stepGoal, waterGoalGlasses: p.waterGoal, stepsEarnCalories: p.earnSteps },
      today: { eaten: d.eaten, budgetWithStepBonus: d.budget, remaining: d.remaining, stepBonus: d.bonus, steps: d.steps, stepGoal: p.stepGoal, waterGlasses: d.water, foods: d.entries.map(e => `${e.meal}: ${e.name} (${e.calories})`) },
      goalIsCustomNumber: !!p.customBudget, safetyMinimum: g.floor,
      last7days: Array.from({ length: 7 }, (_, i) => { const x = BW.day(BW.addDays(today, i - 7)); return { date: x.k, eaten: x.eaten, budget: x.budget, steps: x.steps }; }),
      weight: tr ? { trendLb: tr.now, changePerWeek: tr.perWeek && +tr.perWeek.toFixed(2), goalEta: tr.eta && tr.eta.toDateString() } : null,
      streakDays: BW.streak().days, level: BW.level().name, usualFoods: BW.frequent().slice(0, 6).map(f => `${f.name} (${f.calories})`),
    };
  }
  const coachSwitch = () => `<div class="seg coach-switch"><button type="button" data-cview="chat" aria-pressed="${S.coachView !== 'recipes'}">${I('coach')}Bitey</button><button type="button" data-cview="recipes" aria-pressed="${S.coachView === 'recipes'}">${I('book')}Recipes</button></div>`;
  const REC_CATS = ['Chicken', 'Beef', 'Pasta', 'Seafood', 'Vegetarian', 'Breakfast', 'Dessert', 'Side'];
  function viewRecipes() {
    const rs = S.recipes || [];
    return `<div class="coach-wrap">
      <div class="topbar"><div><div class="subtitle">Ideas to cook</div><h1 class="large-title">Recipes</h1></div></div>
      ${coachSwitch()}
      <form class="search-bar" id="rform"><span class="sb-ic">${I('search')}</span><input id="rq" type="search" enterkeyhint="search" placeholder="Search recipes" value="${esc(S.rq || '')}" autocomplete="off" aria-label="Search recipes"></form>
      <div class="chips" style="margin-top:10px">${REC_CATS.map(c => `<button class="chip ${S.rcat === c ? 'on' : 'fill'}" type="button" data-rcat="${c}">${c}</button>`).join('')}</div>
      ${!S.online ? `<div class="banner" style="margin-top:14px">${I('offline')}<span>Recipes need internet. Everything else in BiteWise works offline.</span></div>` : ''}
      ${S.rloading ? '<div class="muted" style="text-align:center;padding:40px 0">Finding recipes…</div>' : S.rerror ? `<div class="banner" style="margin-top:14px">${I('info')}<span>${esc(S.rerror)}</span></div>`
        : rs.length ? `<div class="rgrid">${rs.map((r, i) => `<button class="rcard" type="button" data-recipe="${i}"><div class="rimg"><img src="${esc(r.thumb)}/medium" alt="" loading="lazy">${r.youtube ? `<span class="rplay">${I('play')}</span>` : ''}</div><div class="rname">${esc(r.name)}</div><div class="caption">${esc([r.area, r.category].filter(Boolean).join(' · '))}${warnTag(r.allergens)}</div></button>`).join('')}</div>`
        : S.online ? '<div class="muted" style="text-align:center;padding:40px 0">No recipes found. Try another word.</div>' : ''}
      <div class="caption" style="text-align:center;margin:18px 0 90px">Recipes from TheMealDB</div>
    </div>`;
  }
  async function loadRecipes({ q = S.rq || '', c = S.rcat || '' } = {}) {
    if (!S.online) { render(); return; }
    S.rloading = true; S.rerror = null; render();
    try { const j = await fetch('/api/recipes?' + new URLSearchParams({ q, c })).then(r => r.json()); S.recipes = j.recipes || []; if (j.error) S.rerror = j.error; }
    catch { S.rerror = 'Couldn\u2019t load recipes. Check your connection.'; }
    S.rloading = false; render();
  }
  function recipeSheet(r) {
    const bad = clash(r.allergens);
    openSheet({ title: r.name, left: 'Done', tall: true, body: `
      <img class="rhero" src="${esc(r.thumb)}" alt="">
      <div class="caption" style="text-align:center;margin-top:8px">${esc([r.area, r.category].filter(Boolean).join(' · '))}</div>
      ${bad.length ? `<div class="banner" style="margin-top:10px">${I('info')}<span>Has <b>${esc(bad.join(', '))}</b>, which you marked as an allergy.</span></div>` : ''}
      <div class="acct-btns flat" style="margin-top:12px">${r.youtube ? `<a class="btn small yt" href="${esc(r.youtube)}" target="_blank" rel="noopener">${I('play')} Watch on YouTube</a>` : ''}<a class="btn small tinted" href="https://www.youtube.com/results?search_query=${encodeURIComponent(r.name + ' recipe')}" target="_blank" rel="noopener">More videos</a></div>
      <div class="card" id="rcal" style="margin-top:14px"><div class="card-head"><div><div class="st-k">Calories per serving</div><div class="big-stat" id="rcalv" style="font-size:24px">—</div></div><button class="btn small tinted" type="button" id="rest" ${S.online && S.status.ai ? '' : 'disabled'}>${I('spark')} Estimate</button></div><div class="caption" id="rcalnote">Bitey estimates it from the ingredients (about 4 servings).</div></div>
      <div class="footnote" style="margin:18px 16px 6px">INGREDIENTS · ${r.ingredients.length}</div>
      <div class="group">${r.ingredients.map(x => `<div class="row"><span class="grow">${esc(x.item)}</span><span class="value">${esc(x.measure)}</span></div>`).join('')}</div>
      <div class="footnote" style="margin:18px 16px 6px">STEPS</div>
      <ol class="steps-list">${r.steps.map(t => `<li>${esc(t)}</li>`).join('')}</ol>
      ${r.source ? `<div class="caption" style="text-align:center;margin-top:10px"><a href="${esc(r.source)}" target="_blank" rel="noopener" style="color:var(--accent)">Original recipe</a></div>` : ''}`,
      mount: (b, close) => {
        const btn = $('#rest', b); let per = null;
        btn && (btn.onclick = async () => {
          if (per != null) { BW.addEntry({ name: r.name, calories: per, source: 'search', allergens: r.allergens }); close(); toast(`${r.name} · ${fmt(per)} cal`); return; }
          btn.disabled = true; btn.innerHTML = 'Thinking…';
          try {
            const text = `ONE serving (the recipe makes about 4) of ${r.name}. Whole recipe ingredients: ${r.ingredients.map(x => `${x.measure} ${x.item}`).join(', ')}. Give a single item for one serving.`;
            const j = await fetch('/api/estimate', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ text }) }).then(x => x.json());
            per = Math.round((j.items || []).reduce((a, i) => a + i.calories, 0) / 5) * 5;
            if (!per) throw new Error(j.error || 'no estimate');
            $('#rcalv', b).innerHTML = `~${fmt(per)} <small>cal</small>`; $('#rcalnote', b).textContent = 'An estimate. Portions at home vary.';
            btn.disabled = false; btn.innerHTML = `${I('plus')} Log a serving`;
          } catch (e) { btn.disabled = false; btn.innerHTML = `${I('spark')} Estimate`; toast('Couldn\u2019t estimate right now', { icon: 'info' }); }
        });
      } });
  }
  function viewCoach() {
    if (S.coachView === 'recipes') return viewRecipes();
    const msgs = chat();
    const g = BW.goals(), d = BW.day(BW.dayKey());
    const starters = [d.remaining > 200 ? `I have ${fmt(d.remaining)} cal left. What should I eat for dinner?` : 'Ideas for a filling snack under 200 cal?', 'I had a Big Mac and medium fries for lunch', 'How am I doing this week?', g.teen ? 'Tips for having more energy at practice?' : BW.trend() ? 'Why did my weight go up today?' : 'A high-protein lunch idea?'];
    const note = !S.online ? `<div class="banner">${I('offline')}<span>You're offline. The coach needs internet, but logging still works.</span></div>`
      : !S.status.ai ? `<div class="banner">${I('info')}<span>The AI coach isn't turned on for this server yet.</span></div>` : '';
    return `
    <div class="coach-wrap">
    <div class="topbar"><div><div class="subtitle">AI coach</div><h1 class="large-title">Bitey</h1></div>${msgs.length ? `<button class="link-btn" type="button" data-act="clearchat">Clear</button>` : ''}</div>
    ${coachSwitch()}
    ${note}
    ${msgs.length ? '' : `<div class="coach-hero"><div class="av">${I('coach')}</div><div style="font-size:20px;font-weight:700">Hi${BW.profile().name ? ', ' + esc(BW.profile().name) : ''}! I'm Bitey.</div><div class="muted" style="margin:4px auto 0;max-width:34ch;font-size:15px">Tell me what you ate and I'll log it. Ask for meal ideas, or ask how your week is going.</div></div>`}
    <div class="chat" id="chat">${msgs.map((m, i) => m.role === 'user' ? `<div class="msg me">${esc(m.content)}</div>` : `<div class="msg ai">${linkify(m.content)}</div>${(m.done || []).length ? `<div class="action-card">${m.done.map(a => `<div class="ln"><span>${esc(a.label)}</span><b class="num">${esc(a.value)}</b></div>`).join('')}<div class="ln" style="margin-top:2px"><span class="ok">${I('check')}${m.undone ? 'Undone' : 'Done'}</span>${m.undone ? '' : `<button class="link-btn" style="font-size:14px" type="button" data-undoact="${i}">Undo</button>`}</div></div>` : ''}`).join('')}
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
      const yesterday = BW.addDays(today, -1);
      for (const a of j.actions || []) {
        const day = a.day === 'yesterday' ? yesterday : today;
        if (a.type === 'log' && a.name && Number.isFinite(+a.calories)) { const e = BW.addEntry({ date: day, name: a.name, calories: +a.calories, meal: ['breakfast', 'lunch', 'dinner', 'snack'].includes(a.meal) ? a.meal : undefined, source: 'coach' }); ids.push({ id: e.id }); done.push({ label: a.name + (day === yesterday ? ' (yesterday)' : ''), value: fmt(+a.calories) + ' cal' }); }
        if (a.type === 'water' && +a.glasses) { const before = BW.day(today).water; BW.setWater(today, before + Math.round(+a.glasses)); ids.push({ water: before }); done.push({ label: 'Water', value: `+${Math.round(+a.glasses)} glass${+a.glasses > 1 ? 'es' : ''}` }); }
        if (a.type === 'weight' && +a.value > 50 && +a.value < 700) { const before = BW.day(today).weight; BW.setWeight(today, +a.value); ids.push({ weight: before }); done.push({ label: 'Weight', value: (+a.value).toFixed(1) + ' lb' }); }
        if (a.type === 'steps' && Number.isFinite(+a.value) && +a.value >= 0 && +a.value <= 100000) {
          const before = BW.day(day).steps, src = BW.stepSource(day), next = a.mode === 'add' ? before + Math.round(+a.value) : Math.round(+a.value);
          BW.setSteps(day, next, 'manual'); ids.push({ steps: before, stepsDay: day, stepsSrc: src }); done.push({ label: 'Steps' + (day === yesterday ? ' (yesterday)' : ''), value: a.mode === 'add' ? `+${fmt(+a.value)} → ${fmt(next)}` : fmt(next) });
        }
        if (a.type === 'goal' && (a.calories === null || (Number.isFinite(+a.calories) && +a.calories >= 500 && +a.calories <= 6000))) {
          const before = BW.profile().customBudget ?? null, want = a.calories === null ? null : Math.round(+a.calories);
          BW.saveProfile({ customBudget: want ? Math.max(BW.goals().floor, want) : null }); ids.push({ goal: before });
          done.push({ label: 'Daily goal', value: want ? `${fmt(BW.goals().budget)} cal${want < BW.goals().floor ? ' (lowest allowed)' : ''}` : `automatic · ${fmt(BW.goals().budget)} cal` });
        }
        if (a.type === 'remove' && a.name) {
          const q = String(a.name).toLowerCase(), es = BW.day(today).entries.slice().reverse();
          const e = es.find(x => x.name.toLowerCase() === q) || es.find(x => x.name.toLowerCase().includes(q) || q.includes(x.name.toLowerCase()));
          if (e) { BW.remove(e.id); ids.push({ restore: e }); done.push({ label: 'Removed ' + e.name, value: '−' + fmt(e.calories) + ' cal' }); }
        }
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
    const fitbitOn = !!LS.get('healthLinked', false);
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

    ${a && !a.auto ? `<button class="card acct-card" type="button" data-act="syncnow"><span class="icon-sq" style="background:var(--blue)">${I('cloud')}</span><div class="grow"><b>Signed in as ${esc(a.username)}</b><span>${BW.syncing ? 'Syncing…' : BW.dirtyCount ? BW.dirtyCount + ' change' + (BW.dirtyCount > 1 ? 's' : '') + ' waiting to sync' : lastSync ? 'Backed up ' + ago(lastSync) + ' · stays signed in' : 'Backed up · stays signed in'}</span></div><span class="sync-ic ${BW.syncing ? 'spin' : ''}">${I('sync')}</span></button>`
      : `<div class="card acct-card cta"><span class="icon-sq" style="background:var(--blue)">${I('cloud')}</span><div class="grow"><b>${a ? 'Use BiteWise on other devices' : 'Save your log to the cloud'}</b><span>${a ? 'Add a username and password' : 'Open it on your iPad, Mac or a new phone'}</span></div></div>
      <div class="acct-btns">${a ? `<button class="btn small" type="button" data-act="claim">Create login</button>` : `<button class="btn small" type="button" data-act="signup">Create account</button><button class="btn small tinted" type="button" data-act="signin">Sign in</button>`}</div>`}
    <div class="section"><div class="footnote" style="margin:0 16px 6px;text-transform:uppercase">Goals</div><div class="group">
      ${row('target', 'var(--accent)', 'Daily goal', fmt(g.budget) + ' cal', 'data-act="goals"', g.custom ? 'Your own number' : g.goalType === 'lose' ? `Lose ${g.pace} lb a week` : g.goalType === 'gain' ? `Gain ${g.gain} lb a week` : 'Stay steady')}
      ${row('scale', 'var(--teal)', 'Goal weight', g.goalType === 'maintain' ? '—' : p.goalLb + ' lb', 'data-act="goals"')}
      ${row('shoe', 'var(--pink)', 'Step goal', fmt(p.stepGoal), 'data-act="stepgoal"')}
      ${row('drop', 'var(--cyan)', 'Water goal', p.waterGoal + ' glasses', 'data-act="watergoal"')}
      ${row('info', 'var(--red)', 'Allergies', (p.allergies || []).length ? (p.allergies.length > 2 ? p.allergies.length + ' set' : p.allergies.map(cap).join(', ')) : 'None', 'data-act="allergies"', 'Get a heads-up when a food has them')}
    </div></div>

    <div class="section"><div class="footnote" style="margin:0 16px 6px;text-transform:uppercase">Health data</div><div class="group">
      ${row('watch', '#00B0B9', 'Fitbit', fitbitOn ? 'Connected' : 'Connect', 'data-act="fitbit"', fitbitOn ? `Steps sync on their own · ${LS.get('healthPulled', 0) ? 'last ' + ago(LS.get('healthPulled', 0)) : 'syncing soon'}` : 'Count your steps automatically')}
      <div class="row indent"><span class="icon-sq" style="background:var(--orange)">${I('flame')}</span><div class="grow"><div class="title">Steps earn calories</div><div class="sub">Walking more adds to your daily budget</div></div><button class="switch" type="button" role="switch" aria-checked="${p.earnSteps}" data-act="earnsteps" aria-label="Steps earn calories"></button></div>
      ${row('edit', 'var(--label3)', 'Enter steps by hand', '', 'data-act="steps"')}
    </div></div>

    </div><div class="col-side">
    <div class="section"><div class="footnote" style="margin:0 16px 6px;text-transform:uppercase">Rewards</div><div class="group">
      ${row('palette', theme.color, 'App theme', theme.name, 'data-act="themes"', `${THEMES.filter(t => t.level <= lv.n).length} of ${THEMES.length} unlocked`)}
      ${row('person', 'var(--purple)', 'Groups', (S.groups || LS.get('groupsCache', [])).length || 'None', 'data-go="progress"', 'Friends and family see each other\u2019s progress')}
      ${row('eye', 'var(--label3)', 'What groups see', '', 'data-act="shareprefs"')}
      ${row('trophy', '#FFB800', 'Badges', `${BW.badges().filter(b => b.earned).length} / ${BW.badges().length}`, 'data-go="progress"')}
    </div></div>

    <div class="section"><div class="footnote" style="margin:0 16px 6px;text-transform:uppercase">App</div><div class="group">
      ${standalone ? '' : row('download', 'var(--purple)', 'Install BiteWise', '', 'data-act="install"', 'Add to your home screen — works offline')}
      ${row('mic', 'var(--pink)', 'Offline voice', '', 'data-act="voicehelp"', 'How voice logging works with no internet')}
      ${row('share', 'var(--label3)', 'Export my data', 'CSV', 'data-act="export"')}
      ${row('info', 'var(--accent)', 'Version ' + APP_VERSION, S.updateReady ? 'Update ready' : navigator.onLine ? 'Up to date' : 'Offline', 'data-act="versions"', S.updateReady ? `Version ${S.updateReady} is out. Tap to see what\u2019s new` : 'What\u2019s new and past updates')}
      ${a && !a.auto ? `<button class="row" type="button" data-act="signout" style="color:var(--red)">Sign out</button>` : ''}
      <button class="row" type="button" data-act="wipe" style="color:var(--red)">Delete all data</button>
    </div>
    <div class="footnote">BiteWise ${S.status.ai ? `· Coach runs on Cloud Foundry open models (${esc(String(S.status.model).split('/').pop())})` : '· Coach offline'} · Not medical advice.</div></div>
    </div></div>`;
  }

  // ---------- log sheet ----------
  function openLog({ mode = LS.get('logMode', 'quick'), meal = S.tab === 'today' ? S.qmeal : null, date = S.date, text = '' } = {}) {
    const st = { mode, meal: meal || (date === BW.dayKey() ? BW.mealForNow() : 'lunch'), amount: '', name: '', text, items: [], transcript: '', listening: false };
    if (text) { const r = BW_PARSE.parseLog(text); st.items = r.items; if (r.meal) st.meal = r.meal; }
    let rec = null;
    const entry = {};
    openSheet({
      title: date === BW.dayKey() ? 'Log food' : 'Log · ' + BW.parseDay(date).toLocaleDateString(undefined, { month: 'short', day: 'numeric' }), tall: true,
      onClose: () => { try { rec && rec.abort(); } catch {} document.removeEventListener('keydown', keys); },
      mount: (body, close) => { body.classList.add('log-body'); function draw() { body.innerHTML = html(); bind(body); } entry.close = close; entry.redraw = draw; draw(); },
    });
    function itemsHTML() {
      if (!st.items.length) return '';
      const total = st.items.reduce((a, i) => a + (+i.calories || 0), 0), unknown = st.items.filter(i => i.calories == null || i.calories === '').length;
      return `<div class="group parsed" style="margin-top:14px">${st.items.map((it, i) => `<div class="row ${it.calories == null || it.calories === '' ? 'unk' : ''}"><input class="nm" data-nm="${i}" value="${esc(it.name)}" aria-label="Food name"><input class="kc num" data-kc="${i}" inputmode="numeric" value="${it.calories ?? ''}" placeholder="cal" aria-label="Calories"><button class="x" type="button" data-rm="${i}" aria-label="Remove">${I('xcircle')}</button></div>${clash(it.allergens).length ? `<div class="row alg-row">${warnTag(it.allergens)} <span class="caption">You marked this as an allergy</span></div>` : ''}`).join('')}</div>
        ${unknown ? `<div class="banner" style="margin-top:10px">${I('info')}<span>${unknown === 1 ? 'One item' : unknown + ' items'} not in the offline food list. Type the calories${S.online && S.status.ai ? ', or' : '.'}</span>${S.online && S.status.ai ? `<button class="btn small tinted" type="button" data-act="estimate" style="margin-left:auto">${I('spark')}Ask AI</button>` : ''}</div>` : ''}
        <button class="btn" type="button" data-act="additems" style="margin-top:14px" ${total <= 0 && unknown === st.items.length ? 'disabled' : ''}>Add ${st.items.length} item${st.items.length > 1 ? 's' : ''} · ${fmt(total)} cal</button>`;
    }
    function html() {
      const recent = BW.recentAmounts(), usual = BW.frequent().slice(0, 6);
      const quickChips = usual.length ? usual.map((u, i) => `<button class="chip fill" type="button" data-usual="${i}">${esc(u.name)} <span class="k num">${u.calories}</span></button>`).join('')
        : recent.map(n => `<button class="chip fill" type="button" data-amt="${n}">${fmt(n)}</button>`).join('');
      return `
      <div class="seg log-modes">${[['quick', 'hash', 'Number'], ['search', 'search', 'Search'], ['voice', 'mic', 'Voice'], ['type', 'keyboard', 'Type']].map(([m, ic, l]) => `<button type="button" data-mode="${m}" aria-pressed="${st.mode === m}">${I(ic)}${l}</button>`).join('')}</div>
      ${mealPills(st.meal)}
      ${st.mode === 'quick' ? `
        <div class="log-quick">
          <div class="amount"><div class="n ${st.amount ? '' : 'empty'}" id="amt">${st.amount ? fmt(+st.amount) : '0'}</div><div class="u">calories</div></div>
          <input class="name-input" id="qname" placeholder="Name it (optional)" value="${esc(st.name)}" autocomplete="off" aria-label="Food name, optional">
          ${quickChips ? `<div class="chips center">${quickChips}</div>` : ''}
          <div class="grow-space"></div>
          <div class="keypad">${[1, 2, 3, 4, 5, 6, 7, 8, 9].map(n => `<button type="button" data-key="${n}">${n}</button>`).join('')}<button type="button" data-key="00">00</button><button type="button" data-key="0">0</button><button type="button" data-key="del" aria-label="Delete">${I('delete')}</button></div>
          <button class="btn" type="button" data-act="addquick" ${+st.amount > 0 ? '' : 'disabled'}>${+st.amount > 0 ? `Add ${fmt(+st.amount)} cal` : 'Type calories'}</button>
        </div>`
      : st.mode === 'search' ? `
        <form class="search-bar" id="fsform"><span class="sb-ic">${I('search')}</span><input id="fsq" type="search" enterkeyhint="search" placeholder="Search ${BW_PARSE.usdaReady ? fmt(BW_PARSE.usdaCount + window.BW_FOODS.length) + '+' : 'thousands of'} foods" value="${esc(st.sq || '')}" autocomplete="off" aria-label="Search foods"></form>
        <div id="fsres">${searchResultsHTML()}</div>`
      : st.mode === 'voice' ? `
        <button class="mic-orb ${st.listening ? 'on' : ''}" type="button" data-act="listen" aria-label="${st.listening ? 'Stop listening' : 'Start listening'}">${I('mic')}</button>
        <div class="transcript ${st.transcript ? '' : 'hint'}" aria-live="polite">${st.transcript ? '“' + esc(st.transcript) + '”' : st.listening ? 'Listening…' : 'Tap and say what you ate<br><span style="font-size:14px">“Two eggs and toast” · “Burrito 750”</span>'}</div>
        ${st.voiceErr ? `<div class="banner">${I('info')}<span>${st.voiceErr}</span></div>` : ''}
        ${itemsHTML()}`
      : `
        <textarea class="field" id="ltext" placeholder="2 eggs, toast and orange juice" aria-label="What did you eat?" style="margin-top:4px">${esc(st.text)}</textarea>
        <div class="footnote" style="margin:6px 4px 0">Knows ${window.BW_FOODS.length}+ foods, even offline. Add a number like “burrito 750” to set the calories yourself.</div>
        <div class="chips wrap" id="typeSugg" style="margin-top:8px"></div>
        <div id="typedItems">${itemsHTML()}</div>`}
      `;
    }
    // ----- search mode -----
    const normPortions = f => f.source === 'usda' ? f.portions.map(([l, g]) => ({ label: l, kcal: Math.round(f.kcal100 * g / 100) }))
      : f.source === 'off' ? f.portions.map(([l, g, k]) => ({ label: l, kcal: k })) : [{ label: f.unit || f.portions?.[0]?.[0] || 'serving', kcal: f.calories }];
    const QTY = [[0.5, '½'], [1, '1'], [1.5, '1½'], [2, '2'], [3, '3']];
    function resultRow(f, key) {
      const ps = normPortions(f), open = st.open === key, pi = open ? st.pi || 0 : 0, q = open ? st.qty || 1 : 1;
      const kcal = Math.round(ps[pi].kcal * q);
      return `<div class="fs-item ${open ? 'open' : ''}"><button class="fs-row" type="button" data-pick="${key}"><div class="grow"><div class="title">${esc(f.name)}</div><div class="sub">${esc(ps[0].label)}${f.source === 'off' ? ' · brand' : ''}${warnTag(f.allergens)}</div></div><span class="kcal num">${fmt(ps[0].kcal)}</span></button>
        ${open ? `<div class="fs-pick">
          ${ps.length > 1 ? `<div class="chips wrap">${ps.map((p, i) => `<button class="chip ${i === pi ? 'on' : 'fill'}" type="button" data-por="${i}">${esc(p.label)} <span class="k num">${fmt(p.kcal)}</span></button>`).join('')}</div>` : ''}
          <div class="fs-qty"><span class="caption">How many</span><div class="seg" style="flex:1">${QTY.map(([v, l]) => `<button type="button" data-q="${v}" aria-pressed="${q === v}">${l}</button>`).join('')}</div></div>
          ${clash(f.allergens).length ? `<div class="banner" style="margin:8px 0 0">${I('info')}<span>Contains <b>${esc(clash(f.allergens).join(', '))}</b>, which you marked as an allergy.</span></div>` : ''}
          <button class="btn" type="button" data-fadd="${key}" style="margin-top:10px">Add ${fmt(kcal)} cal</button></div>` : ''}</div>`;
    }
    function searchResultsHTML() {
      const q = (st.sq || '').trim();
      if (q.length < 2) {
        const usual = BW.frequent().slice(0, 6);
        return usual.length ? `<div class="footnote" style="margin:14px 4px 6px">YOUR USUALS</div><div class="group">${usual.map((u, i) => `<button class="row" type="button" data-usual="${i}"><div class="grow"><div class="title">${esc(u.name)}</div></div><span class="kcal num">${u.calories}</span></button>`).join('')}</div>` : `<div class="empty" style="padding:30px 10px"><b>Search any food</b><span>Try “banana”, “pad thai” or “doritos”.</span></div>`;
      }
      st.local = BW_PARSE.searchAll(q, 25);
      const brands = st.brands && st.brandsFor === q ? st.brands : null;
      return `${st.local.length ? `<div class="group fs-list">${st.local.map((f, i) => resultRow(f, 'L' + i)).join('')}</div>` : ''}
        <div class="footnote" style="margin:16px 4px 6px">BRAND NAMES${brands ? '' : S.online ? ' · searching…' : ''}</div>
        ${!S.online ? '<div class="caption" style="margin:0 4px">Brand search needs internet. The foods above work offline.</div>'
          : brands ? (brands.length ? `<div class="group fs-list">${brands.map((f, i) => resultRow(f, 'B' + i)).join('')}</div>` : '<div class="caption" style="margin:0 4px">No brand matches.</div>') : ''}
        ${!st.local.length && brands && !brands.length ? `<div class="banner" style="margin-top:12px">${I('info')}<span>No match. Try fewer words, or use <b>Number</b> to type the calories.</span></div>` : ''}
        <div class="caption" style="margin:14px 4px 0">Foods: USDA FoodData Central · Brands: Open Food Facts</div>`;
    }
    let brandT = null;
    function runSearch() {
      const box = $('#fsres'); if (!box) return;
      box.innerHTML = searchResultsHTML();
      const q = (st.sq || '').trim();
      clearTimeout(brandT);
      if (q.length >= 2 && S.online && st.brandsFor !== q) brandT = setTimeout(async () => {
        try { const j = await fetch('/api/foods/search?q=' + encodeURIComponent(q)).then(r => r.json()); if ((st.sq || '').trim() !== q) return; st.brands = j.foods || []; st.brandsFor = q; }
        catch { st.brands = []; st.brandsFor = q; }
        const b2 = $('#fsres'); if (b2 && st.mode === 'search') b2.innerHTML = searchResultsHTML();
      }, 450);
    }
    const pickFood = key => key[0] === 'L' ? st.local[+key.slice(1)] : (st.brands || [])[+key.slice(1)];

    function bind(body) {
      body.onclick = e => {
        const b = e.target.closest('button'); if (!b) return;
        if (b.dataset.mode) { st.mode = b.dataset.mode; LS.set('logMode', st.mode); st.items = []; st.transcript = ''; st.voiceErr = ''; try { rec && rec.abort(); } catch {} st.listening = false; entry.redraw(); if (st.mode === 'type') setTimeout(() => $('#ltext')?.focus(), 50); if (st.mode === 'search') { setTimeout(() => $('#fsq')?.focus(), 50); BW_PARSE.loadUSDA().then(() => st.mode === 'search' && runSearch()); } if (st.mode === 'voice') listen(); return; }
        if (b.dataset.meal) { st.meal = b.dataset.meal; $$('[data-meal]', body).forEach(x => { x.setAttribute('aria-pressed', x === b); x.setAttribute('aria-checked', x === b); }); haptic(5); return; }
        if (b.dataset.key) {
          haptic(5);
          if (b.dataset.key === 'del') st.amount = st.amount.slice(0, -1); else if ((st.amount + b.dataset.key).length <= 5) st.amount = (st.amount + b.dataset.key).replace(/^0+/, '');
          $('#amt').textContent = st.amount ? fmt(+st.amount) : '0'; $('#amt').classList.toggle('empty', !st.amount);
          const add = $('[data-act="addquick"]', body); add.disabled = !(+st.amount > 0); add.textContent = +st.amount > 0 ? `Add ${fmt(+st.amount)} cal` : 'Type calories';
          return;
        }
        if (b.dataset.amt) { st.amount = b.dataset.amt; entry.redraw(); return; }
        if (b.dataset.usual) { const u = BW.frequent()[+b.dataset.usual]; if (u) commit([{ name: u.name, calories: u.calories }], 'quick'); return; }
        if (b.dataset.pick) { st.open = st.open === b.dataset.pick ? null : b.dataset.pick; st.pi = 0; st.qty = 1; $('#fsres').innerHTML = searchResultsHTML(); haptic(5); return; }
        if (b.dataset.por) { st.pi = +b.dataset.por; $('#fsres').innerHTML = searchResultsHTML(); return; }
        if (b.dataset.q) { st.qty = +b.dataset.q; $('#fsres').innerHTML = searchResultsHTML(); return; }
        if (b.dataset.fadd) { const f = pickFood(b.dataset.fadd); if (!f) return; const p = normPortions(f)[st.pi || 0], q = st.qty || 1; const ql = QTY.find(x => x[0] === q)?.[1] || q;
          commit([{ name: q === 1 ? f.name : `${ql} × ${f.name}`, calories: Math.round(p.kcal * q), allergens: f.allergens }], 'search'); return; }
        if (b.dataset.rm) { st.items.splice(+b.dataset.rm, 1); refreshItems(); return; }
        if (b.dataset.tsugg) { const f = st.sugg[+b.dataset.tsugg], ta = $('#ltext', body); const parts = ta.value.split(/(,| and |\n)/); parts[parts.length - 1] = (parts.length > 1 ? ' ' : '') + f.name.toLowerCase(); ta.value = parts.join('') + ', '; ta.dispatchEvent(new Event('input', { bubbles: true })); ta.focus(); return; }
        const act = b.dataset.act;
        if (act === 'addquick') commit([{ name: st.name.trim() || 'Quick add', calories: +st.amount }], 'quick');
        if (act === 'listen') st.listening ? stop() : listen();
        if (act === 'additems') commit(st.items.filter(i => +i.calories > 0 || i.calories === 0).map(i => ({ name: i.name, calories: +i.calories || 0, allergens: i.allergens })), st.mode === 'voice' ? 'voice' : 'text');
        if (act === 'estimate') estimate(b);
      };
      body.onsubmit = e => { if (e.target.id === 'fsform') { e.preventDefault(); $('#fsq')?.blur(); } };
      body.oninput = e => {
        const t = e.target;
        if (t.id === 'fsq') { st.sq = t.value; st.open = null; runSearch(); return; }
        if (t.id === 'qname') st.name = t.value;
        if (t.id === 'ltext') { const last = t.value.split(/,| and |\n/).pop().trim(); const sg = /^\d/.test(last) ? [] : BW_PARSE.search(last, 5); st.sugg = sg; $('#typeSugg', body).innerHTML = sg.map((f, i) => `<button class="chip fill" type="button" data-tsugg="${i}">${esc(f.name)} <span class="k num">${f.calories}</span>${warnTag(f.allergens)}</button>`).join(''); st.text = t.value; const r = BW_PARSE.parseLog(t.value); st.items = r.items; if (r.meal) { st.meal = r.meal; $$('[data-meal]', body).forEach(x => x.setAttribute('aria-pressed', x.dataset.meal === st.meal)); } $('#typedItems', body).innerHTML = itemsHTML(); }
        if (t.dataset.nm) st.items[+t.dataset.nm].name = t.value;
        if (t.dataset.kc) { st.items[+t.dataset.kc].calories = t.value === '' ? null : Math.max(0, parseInt(t.value.replace(/\D/g, ''), 10) || 0); const btn = $('[data-act="additems"]', body); const total = st.items.reduce((a, i) => a + (+i.calories || 0), 0); if (btn) btn.textContent = `Add ${st.items.length} item${st.items.length > 1 ? 's' : ''} · ${fmt(total)} cal`; if (btn) btn.disabled = false; t.closest('.row').classList.toggle('unk', t.value === ''); }
      };
    }
    function refreshItems() { if (st.mode === 'type') $('#typedItems').innerHTML = itemsHTML(); else entry.redraw(); }
    function commit(items, source) {
      items = items.filter(i => i.name || i.calories);
      if (!items.length) return;
      const made = items.map(i => BW.addEntry({ date, meal: st.meal, name: i.name, calories: i.calories, source, allergens: i.allergens }));
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
    // physical keyboard (Mac / iPad keyboard): type digits straight into the amount, Enter adds
    const keys = e => {
      if (st.mode !== 'quick' || e.metaKey || e.ctrlKey || e.target.id === 'qname' || !document.body.contains(entry.body || document.body)) return;
      const k = e.key, pad = k === 'Backspace' ? 'del' : /^[0-9]$/.test(k) ? k : null;
      if (pad) { e.preventDefault(); $(`.sheet.show [data-key="${pad}"]`)?.click(); }
      else if (k === 'Enter' && +st.amount > 0) { e.preventDefault(); $('.sheet.show [data-act="addquick"]')?.click(); }
    };
    document.addEventListener('keydown', keys);
    const prevClose = entry.close; entry.close = () => { document.removeEventListener('keydown', keys); prevClose(); };
    if (mode === 'voice' && !text) setTimeout(listen, 350);
    if (mode === 'type') setTimeout(() => $('#ltext')?.focus(), 400);
    if (mode === 'search') setTimeout(() => { $('#fsq')?.focus(); BW_PARSE.loadUSDA().then(() => st.mode === 'search' && runSearch()); }, 400);
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
    const st = { meal: e.meal };
    openSheet({
      title: 'Edit food', left: 'Cancel',
      body: `<div class="edit-amount"><input id="ec" class="num" inputmode="numeric" value="${e.calories}" aria-label="Calories"><span>calories</span></div>
        <input class="name-input" id="en" value="${esc(e.name)}" placeholder="Name" aria-label="Food name">
        ${mealPills(e.meal, 'data-m')}
        <div class="caption" style="text-align:center;margin-top:10px">Logged ${new Date(e.time).toLocaleString([], { weekday: 'short', hour: 'numeric', minute: '2-digit' })}</div>
        <button class="btn" type="button" id="esave" style="margin-top:22px">Save</button>
        <button class="btn danger" type="button" id="edel" style="margin-top:10px">${I('trash')} Delete</button>`,
      mount: (b, close) => {
        b.onclick = ev => { const m = ev.target.closest('[data-m]'); if (m) { st.meal = m.dataset.m; $$('[data-m]', b).forEach(x => { x.setAttribute('aria-pressed', x === m); x.setAttribute('aria-checked', x === m); }); haptic(5); } };
        const save = () => { BW.put({ ...BW.get(id), name: $('#en').value.trim() || 'Quick add', calories: Math.max(0, parseInt($('#ec').value, 10) || 0), meal: st.meal }); close(); toast('Saved'); };
        $('#esave', b).onclick = save;
        $('#ec', b).onkeydown = ev => { if (ev.key === 'Enter') save(); };
        $('#en', b).onkeydown = ev => { if (ev.key === 'Enter') save(); };
        $('#edel', b).onclick = () => { close(); delEntry(id); };
      },
    });
  }
  function delEntry(id) { const e = BW.get(id); if (!e) return; const el = $(`.swipe[data-key="${id}"]`); if (el && !matchMedia('(prefers-reduced-motion: reduce)').matches) { el.style.height = el.offsetHeight + 'px'; el.classList.add('row-out'); requestAnimationFrame(() => { el.style.height = '0px'; }); setTimeout(() => BW.remove(id), 230); } else BW.remove(id); haptic(10); toast(`Deleted ${e.name}`, { icon: 'trash', undo: () => BW.put({ ...e, deleted: false }) }); }

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
    const linked = !!LS.get('healthLinked', false), k = S.date, p = BW.profile();
    openSheet({
      title: 'Steps', left: 'Done', body: '', mount: (b, close) => {
        const draw = () => {
          const dd = BW.day(k);
          b.innerHTML = `<div class="card" style="text-align:center;padding:20px 16px">
              <div class="caption" style="font-size:14px">${dayLabel(k)}</div>
              <div class="big-num num" style="color:var(--pink);font-size:60px">${fmt(dd.steps)}</div>
              <div class="bar big" style="margin:12px 0 8px"><i style="width:${Math.min(100, dd.steps / p.stepGoal * 100)}%;background:var(--pink)"></i></div>
              <div class="muted" style="font-size:15px">${dd.steps >= p.stepGoal ? 'Goal reached!' : fmt(p.stepGoal - dd.steps) + ' to your ' + fmt(p.stepGoal) + ' goal'}${p.earnSteps && dd.bonus ? ` · earned <b style="color:var(--label)">${dd.bonus} cal</b>` : ''}</div></div>
            ${linked ? `<div class="group" style="margin-top:14px"><div class="row"><span class="icon-sq" style="background:#00B0B9">${I('watch')}</span><div class="grow"><div class="title">Fitbit</div><div class="sub">${S.syncingSteps ? 'Syncing…' : 'Synced ' + ago(LS.get('healthPulled', 0))}</div></div><button class="btn small tinted" type="button" id="ssync" ${S.syncingSteps ? 'disabled' : ''}>${I('sync')} Sync</button></div></div>`
              : `<button class="btn" type="button" id="sconn" style="margin-top:14px;background:#00B0B9">${I('watch')} Connect Fitbit</button>`}
            <div class="footnote" style="margin:18px 16px 6px">ADD STEPS BY HAND</div>
            <form class="qlog" id="sform" style="margin-top:0"><label class="qfield"><input id="sval" inputmode="numeric" placeholder="${fmt(dd.steps)}" aria-label="Steps"><span class="u">steps</span></label><button class="qadd" type="submit" aria-label="Save">${I('check')}</button></form>
            <div class="footnote">${linked ? 'Fitbit replaces a hand-entered number the next time it syncs.' : 'Or connect Fitbit and never type steps again.'}</div>`;
          $('#ssync', b) && ($('#ssync', b).onclick = async () => { await autoHealth(true); draw(); });
          $('#sconn', b) && ($('#sconn', b).onclick = () => { close(); connectHealth(); });
          $('#sform', b).onsubmit = e => { e.preventDefault(); const n = parseInt($('#sval', b).value.replace(/\D/g, ''), 10); if (!(n >= 0 && n <= 100000)) return toast('Enter a step count', { icon: 'info' }); BW.setSteps(k, n, 'manual'); haptic(10); close(); toast(`${fmt(n)} steps saved`); };
        };
        draw();
      },
    });
  }

  function calSheet() {
    const k = S.date, d = BW.day(k), g = BW.goals(), over = d.remaining < 0;
    const meals = MEALS.map(([m, l]) => [l, d.meals[m].reduce((a, e) => a + e.calories, 0)]);
    openSheet({ title: 'Calories', left: 'Done', body: `
      <div class="card" style="text-align:center;padding:20px 16px"><div class="caption" style="font-size:14px">${dayLabel(k)}</div>
        <div class="big-num num" style="font-size:60px;color:${over ? 'var(--orange)' : 'var(--accent)'}">${fmt(Math.abs(d.remaining))}</div><div class="muted" style="font-weight:600">${over ? 'calories over' : 'calories left'}</div></div>
      <div class="group" style="margin-top:14px">
        <div class="row"><span class="grow">Daily budget</span><span class="value num">${fmt(d.base)}</span></div>
        ${d.bonus ? `<div class="row"><span class="grow">Earned from steps</span><span class="value num" style="color:var(--pink)">+${fmt(d.bonus)}</span></div>` : ''}
        <div class="row"><span class="grow">Eaten</span><span class="value num">−${fmt(d.eaten)}</span></div>
        <div class="row"><b class="grow">${over ? 'Over by' : 'Left'}</b><b class="num">${fmt(Math.abs(d.remaining))}</b></div>
      </div>
      <div class="footnote" style="margin:18px 16px 6px">BY MEAL</div>
      <div class="group">${meals.map(([l, v]) => `<div class="row"><span class="grow">${l}</span><span class="value num">${v ? fmt(v) : '—'}</span></div>`).join('')}</div>
      <div class="footnote">${g.teen ? 'Teen mode: your budget is set to maintenance, so you have plenty of fuel for growing and sports.' : `Your budget is ${fmt(g.tdee)} (what you burn) minus ${fmt(g.pace * 500)} to lose about ${g.pace} lb a week. Change it in Me → Goals.`}</div>` });
  }

  function weightSheet() {
    const tr = BW.trend(), cur = BW.day(BW.dayKey()).weight || (tr ? tr.pts[tr.pts.length - 1].lb : BW.profile().weightLb);
    numberSheet({ title: 'Log weight', label: 'Today', value: cur, unit: 'lb', step: .2, min: 50, max: 700, decimals: 1, onSave: n => { BW.setWeight(BW.dayKey(), n); BW.saveProfile({ weightLb: Math.round(n) }); toast('Weight logged'); },
      footer: `<div class="footnote">Weigh in the morning after using the bathroom, before eating, for the most consistent numbers.</div>` });
  }

  function signInSheet(startMode = 'signup') {
    let mode = startMode;
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
            try {
              const r = await BW.signIn(mode, $('#au', b).value, $('#ap', b).value); close();
              const onboarding = !$('#tabbar') || $('#tabbar').hidden;
              if (onboarding && BW.profile().setup) { ob.p = null; finishOnboarding(); }
              toast(mode === 'signup' ? 'Account created · you\u2019re backed up' : r.restored ? 'Welcome back · your log is here' : 'Signed in and synced', { icon: 'cloud' });
              await refreshMe();
            }
            catch (err) { draw(err.message); }
          };
        };
        draw();
      },
    });
  }

  async function refreshMe() {
    if (!BW.acct() || !navigator.onLine) return;
    try { const me = await BW.api('me', null, 'GET'); LS.set('healthLinked', !!me.health); if (me.health) autoHealth(); render(); } catch {}
  }
  // Steps sync quietly: on open, when the app comes back to the front, and every 10 minutes while it's open.
  async function autoHealth(force) {
    if (!LS.get('healthLinked', false) || !navigator.onLine || !BW.acct()) return;
    if (!force && Date.now() - LS.get('healthPulled', 0) < 5 * 60e3) return;
    S.syncingSteps = true; render();
    try {
      const r = await BW.pullHealth();
      if (force) toast(`Fitbit synced · ${fmt(r.today)} steps today`, { icon: 'watch' });
    } catch (e) {
      if (e.status === 401 || e.status === 404) { LS.set('healthLinked', false); toast('Fitbit needs to be connected again', { icon: 'info' }); }
      else if (force) toast(e.message, { icon: 'info' });
    }
    S.syncingSteps = false; render();
  }
  setInterval(() => { if (document.visibilityState === 'visible') autoHealth(); }, 10 * 60e3);

  async function connectHealth() {
    if (!S.online) return toast('Connect to the internet to link Fitbit', { icon: 'offline' });
    if (S.status.health === false) return fitbitSheet();
    try {
      toast('Opening Google sign-in…', { icon: 'watch' });
      await BW.ensureAccount();
      const j = await BW.api('health/start');
      location.href = j.url;
    } catch (e) { e.status === 501 ? fitbitSheet() : toast(e.message, { icon: 'info' }); }
  }

  function fitbitSheet() {
    const linked = !!LS.get('healthLinked', false), ready = S.status.health !== false;
    openSheet({
      title: 'Fitbit', left: 'Done',
      body: `<div style="text-align:center;margin:4px 0 18px"><div class="icon-sq" style="background:#00B0B9;width:64px;height:64px;border-radius:17px;margin:0 auto 12px">${I('watch', 'style="width:34px;height:34px"')}</div>
        <div style="font-size:22px;font-weight:700">${linked ? 'Fitbit is connected' : 'Connect Fitbit'}</div>
        <div class="muted" style="font-size:15px;margin:6px 8px 0">${linked ? `Steps sync on their own every time you open BiteWise. Last sync ${ago(LS.get('healthPulled', 0))}.` : 'Your steps show up on the home screen by themselves. Walking more can earn you extra calories.'}</div></div>
        ${linked ? `<button class="btn" type="button" id="fp">${I('sync')} Sync now</button><button class="btn gray" type="button" id="ft" style="margin-top:10px">Test Fitbit sync</button><button class="btn danger" type="button" id="fd" style="margin-top:10px">Disconnect</button>`
          : ready ? `<div class="group" style="margin-bottom:16px">${[['1', 'Tap Connect'], ['2', 'Sign in with the Google account your Fitbit uses'], ['3', 'Tap Allow. You’ll come right back here.']].map(([n, t]) => `<div class="row"><span class="step-n">${n}</span><div class="grow"><div class="title" style="white-space:normal;font-size:16px">${t}</div></div></div>`).join('')}</div><button class="btn" type="button" id="fc" style="background:#00B0B9">Connect</button><div class="footnote" style="text-align:center">Fitbit data now comes through Google Health. BiteWise only reads your steps and weight.</div>`
          : `<div class="banner">${I('info')}<span>Fitbit sync needs a one-time setup on the BiteWise server before anyone can connect. Until then, add steps by hand from the Steps card.</span></div>`}`,
      mount: (b, close) => {
        $('#fp', b) && ($('#fp', b).onclick = async () => { close(); await autoHealth(true); });
        $('#fd', b) && ($('#fd', b).onclick = async () => { try { await BW.api('health/disconnect'); } catch {} LS.set('healthLinked', false); close(); render(); toast('Fitbit disconnected'); });
        $('#fc', b) && ($('#fc', b).onclick = () => { close(); connectHealth(); });
        $('#ft', b) && ($('#ft', b).onclick = () => { close(); healthTest(); });
      },
    });
  }

  // Test screen: shows exactly what Google Health returns for the last 7 days, so a real Fitbit can be checked.
  function healthTest() {
    openSheet({ title: 'Fitbit test', left: 'Done', tall: true, body: '<div class="muted" style="text-align:center;padding:30px 0">Asking Google Health for your last 7 days…</div>', mount: async b => {
      const today = BW.dayKey();
      try {
        const j = await BW.api('health/test', { start: BW.addDays(today, -6), end: BW.addDays(today, 1) });
        if (!j.connected) { b.innerHTML = `<div class="banner">${I('info')}<span>Fitbit isn't connected yet. Tap Connect Fitbit first.</span></div>`; return; }
        const ok = !j.error, max = Math.max(1, ...j.steps.map(s => s.steps));
        b.innerHTML = `<div class="banner ${ok ? 'info' : ''}">${I(ok ? 'check' : 'info')}<span>${ok ? `It works. Google sent <b>${j.steps.length} days</b> of steps.` : 'Google Health answered with an error: <b>' + esc(j.error) + '</b>'}</span></div>
          ${ok ? `<div class="group">${j.steps.map(s => `<div class="row"><div class="grow"><div class="title">${esc(dayLabel(s.date) === 'Today' || dayLabel(s.date) === 'Yesterday' ? dayLabel(s.date) : BW.parseDay(s.date).toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric' }))}</div><div class="bar" style="margin-top:6px"><i style="width:${s.steps / max * 100}%;background:var(--pink)"></i></div></div><span class="value num" style="color:var(--label);font-weight:600">${fmt(s.steps)}</span></div>`).join('') || '<div class="row"><span class="muted">No days came back.</span></div>'}</div>
          <button class="btn" type="button" id="tsave" style="margin-top:14px">Use these steps</button>` : ''}
          <div class="footnote" style="margin:18px 4px 6px">WHAT GOOGLE SENT (for fixing problems)</div>
          <pre style="background:var(--card);border-radius:12px;padding:12px;font-size:11px;overflow:auto;max-height:260px;white-space:pre-wrap;word-break:break-all;margin:0">${esc(JSON.stringify(j.raw, null, 1)).slice(0, 6000)}</pre>`;
        $('#tsave', b) && ($('#tsave', b).onclick = async () => { await autoHealth(true); });
      } catch (e) { b.innerHTML = `<div class="banner">${I('info')}<span>${esc(e.message)}</span></div>`; }
    } });
  }

  // ---------- groups ----------
  const SHARE_DEFAULTS = { goal: true, streak: true, today: true, steps: true, level: true, lost: false };
  const sharePrefs = () => ({ ...SHARE_DEFAULTS, ...(BW.profile().share || {}) });
  const MEMBER_COLORS = ['#FF9500', '#34C759', '#007AFF', '#AF52DE', '#FF2D55', '#30B0C7', '#FFB800', '#5856D6'];
  function myShareStats() {
    const p = BW.profile(), g = BW.goals(), pr = sharePrefs(), k = BW.dayKey(), d = BW.day(k), tr = BW.trend(), lv = BW.level();
    const week = Array.from({ length: 7 }, (_, i) => BW.day(BW.addDays(k, -i - 1))).filter(x => x.entries.length && x.eaten <= x.budget * 1.1).length;
    return {
      name: p.name || 'Friend',
      goal: pr.goal ? (g.custom ? `${fmt(g.budget)} cal a day` : g.goalType === 'lose' ? `Lose ${g.pace} lb a week` : g.goalType === 'gain' ? `Gain ${g.gain} lb a week` : 'Stay steady') : null,
      budget: pr.goal ? g.budget : null,
      streak: pr.streak ? BW.streak().days : null, onTrackDays: pr.streak ? week : null,
      todayPct: pr.today ? Math.round(d.eaten / d.budget * 100) : null, steps: pr.steps ? d.steps : null,
      level: pr.level ? lv.n : null, levelName: pr.level ? lv.name : null, lostLb: pr.lost && tr ? tr.lost : null,
      color: THEMES.find(t => t.id === p.theme)?.color || null,
    };
  }
  let shareT = null, lastShared = '';
  function scheduleShare(now) {
    if (!LS.get('inGroups', false) || !BW.acct()) return;
    clearTimeout(shareT);
    shareT = setTimeout(async () => {
      if (!navigator.onLine) return;
      const stats = myShareStats(), key = JSON.stringify(stats);
      if (key === lastShared) return;
      try { await BW.api('share', { stats }); lastShared = key; } catch {}
    }, now ? 50 : 4000);
  }
  async function loadGroups() {
    if (!BW.acct() || !navigator.onLine) return (S.groups ||= LS.get('groupsCache', []));
    try { const j = await BW.api('groups', null, 'GET'); S.groups = j.groups; LS.set('groupsCache', j.groups); LS.set('inGroups', j.groups.length > 0); }
    catch { S.groups ||= LS.get('groupsCache', []); }
    return S.groups;
  }
  const face = (st, fallbackName, i, big) => `<span class="face ${big ? 'big' : ''}" style="background:${st?.color || MEMBER_COLORS[i % 8]}">${esc(((st?.name || fallbackName || '?')[0] || '?').toUpperCase())}</span>`;
  function groupsCard() {
    const gs = S.groups || LS.get('groupsCache', []);
    if (!gs.length) return `<div class="card group-cta"><div class="card-head"><div><div class="st-k">Groups</div><div class="big-stat" style="font-size:22px">Do it together</div></div><span class="icon-sq" style="background:var(--purple)">${I('person')}</span></div>
      <p class="insight">Make a group with friends or family. Everyone sees each other's goals, streaks and progress, never your food list.</p>
      <div class="acct-btns flat"><button class="btn small" type="button" data-act="newgroup">Make a group</button><button class="btn small tinted" type="button" data-act="joingroup">Join with code</button></div></div>`;
    return gs.map(g => {
      const ms = g.members.slice().sort((a, b) => (b.stats?.streak ?? -1) - (a.stats?.streak ?? -1));
      const lead = ms[0];
      return `<button class="card group-card" type="button" data-group="${g.id}"><div class="card-head"><div><div class="st-k">Group · ${g.members.length} ${g.members.length === 1 ? 'person' : 'people'}</div><div class="big-stat" style="font-size:22px">${esc(g.name)}</div></div><span style="color:var(--label3);font-size:22px">›</span></div>
        <div class="faces">${ms.slice(0, 6).map((m, i) => face(m.stats, m.username, i)).join('')}${ms.length > 6 ? `<span class="face more">+${ms.length - 6}</span>` : ''}
        <span class="caption" style="margin-left:auto">${lead?.stats?.streak ? `${esc(lead.you ? 'You lead' : (lead.stats.name || 'Friend') + ' leads')} · ${lead.stats.streak} days` : g.members.length === 1 ? 'Send the code to invite people' : 'Tap to see everyone'}</span></div></button>`;
    }).join('') + `<div class="acct-btns flat" style="margin-top:8px"><button class="btn small tinted" type="button" data-act="newgroup">Make another</button><button class="btn small tinted" type="button" data-act="joingroup">Join with code</button></div>`;
  }
  async function needAccountFor(what) {
    if (!S.online) { toast(`Connect to the internet to ${what}`, { icon: 'offline' }); return false; }
    try { await BW.ensureAccount(); return true; } catch (e) { toast(e.message, { icon: 'info' }); return false; }
  }
  function newGroupSheet() {
    openSheet({ title: 'New group', body: `<div style="text-align:center;margin:4px 0 16px"><div class="icon-sq" style="background:var(--purple);width:60px;height:60px;border-radius:16px;margin:0 auto 10px">${I('person', 'style="width:32px;height:32px"')}</div><div class="muted" style="font-size:15px">Give it a name. You'll get a code to send to friends.</div></div>
      <form id="ngf"><div class="group"><div class="row"><input class="field" id="gname" placeholder="Like “Family” or “Soccer team”" maxlength="40" style="background:transparent;padding:0" required aria-label="Group name"></div></div><div class="footnote" id="gerr"></div><button class="btn" style="margin-top:12px" id="gbtn">Make group</button></form>`,
      mount: (b, close) => {
        setTimeout(() => $('#gname', b)?.focus(), 350);
        $('#ngf', b).onsubmit = async e => {
          e.preventDefault(); const btn = $('#gbtn', b); btn.disabled = true; btn.textContent = 'Making…';
          if (!await needAccountFor('make a group')) { btn.disabled = false; btn.textContent = 'Make group'; return; }
          try { const j = await BW.api('groups', { name: $('#gname', b).value }); LS.set('inGroups', true); lastShared = ''; scheduleShare(true); await loadGroups(); close(); render(); confetti(50); setTimeout(() => groupSheet(j.group.id), 350); }
          catch (err) { $('#gerr', b).innerHTML = `<span style="color:var(--red)">${esc(err.message)}</span>`; btn.disabled = false; btn.textContent = 'Make group'; }
        };
      } });
  }
  function joinGroupSheet() {
    openSheet({ title: 'Join a group', body: `<p class="muted" style="text-align:center;margin:4px 12px 16px;font-size:15px">Type the 6-letter code a friend sent you.</p>
      <form id="jgf"><input class="code-input" id="gcode" maxlength="6" autocapitalize="characters" autocomplete="off" spellcheck="false" placeholder="ABC123" aria-label="Group code"><div class="footnote" id="jerr" style="text-align:center"></div><button class="btn" style="margin-top:12px" id="jbtn">Join</button></form>`,
      mount: (b, close) => {
        setTimeout(() => $('#gcode', b)?.focus(), 350);
        $('#gcode', b).oninput = e => { e.target.value = e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, ''); };
        $('#jgf', b).onsubmit = async e => {
          e.preventDefault(); const btn = $('#jbtn', b); btn.disabled = true; btn.textContent = 'Joining…';
          if (!await needAccountFor('join a group')) { btn.disabled = false; btn.textContent = 'Join'; return; }
          try { const j = await BW.api('groups/join', { code: $('#gcode', b).value }); LS.set('inGroups', true); lastShared = ''; scheduleShare(true); await loadGroups(); close(); render(); toast(`You joined ${j.group.name}`, { icon: 'person' }); setTimeout(() => groupSheet(j.group.id), 400); }
          catch (err) { $('#jerr', b).innerHTML = `<span style="color:var(--red)">${esc(err.message)}</span>`; btn.disabled = false; btn.textContent = 'Join'; }
        };
      } });
  }
  function groupSheet(id) {
    const draw = (b, g) => {
      const ms = g.members.slice().sort((a, b2) => (b2.stats?.streak ?? -1) - (a.stats?.streak ?? -1));
      b.innerHTML = `<div class="code-card"><div class="caption">Invite code</div><div class="code num">${esc(g.code)}</div><div class="acct-btns flat" style="padding:0;margin-top:10px"><button class="btn small tinted" type="button" id="gcopy">Copy code</button>${navigator.share ? '<button class="btn small tinted" type="button" id="gshare">Share</button>' : ''}</div></div>
        <div class="footnote" style="margin:18px 16px 6px">${g.members.length} ${g.members.length === 1 ? 'PERSON' : 'PEOPLE'} · LONGEST STREAK FIRST</div>
        <div class="group">${ms.map((m, i) => { const st = m.stats || {}, nm = m.you ? 'You' : st.name || m.username || 'Friend';
          const info = [st.goal, st.level ? `Level ${st.level}` : null, st.lostLb > 0 ? `down ${st.lostLb} lb` : null].filter(Boolean).map(esc).join(' · ');
          return `<div class="row member">${face(st, m.username, i, true)}
            <div class="grow"><div class="title">${esc(nm)}${m.owner ? ' <span class="caption">· started it</span>' : ''}</div>
              <div class="sub">${info || (m.stats ? 'Keeps their numbers private' : 'Hasn’t opened BiteWise yet')}</div>
              ${st.todayPct != null ? `<div class="bar" style="margin-top:6px"><i style="width:${Math.min(100, st.todayPct)}%;${st.todayPct > 110 ? 'background:var(--orange)' : ''}"></i></div><div class="caption num" style="margin-top:3px">Today ${st.todayPct}% of goal${st.steps ? ` · ${fmt(st.steps)} steps` : ''}</div>` : ''}
            </div>${st.streak != null ? `<span class="pill streak">${I('flame')}<span class="num">${st.streak}</span></span>` : ''}</div>`; }).join('')}</div>
        <button class="btn gray" type="button" id="gprefs" style="margin-top:16px">${I('eye')} What I share</button>
        <button class="btn danger" type="button" id="gleave" style="margin-top:10px">Leave group</button>
        <div class="footnote" style="text-align:center">Groups only see what you choose to share, never your food list or exact weight.</div>`;
      $('#gcopy', b).onclick = async () => { try { await navigator.clipboard.writeText(g.code); toast('Code copied'); } catch { toast('Code: ' + g.code, { icon: 'info' }); } };
      $('#gshare', b) && ($('#gshare', b).onclick = () => navigator.share({ title: 'Join my BiteWise group', text: `Join my BiteWise group “${g.name}” with code ${g.code}`, url: location.origin }).catch(() => {}));
      $('#gprefs', b).onclick = () => sharePrefsSheet();
      $('#gleave', b).onclick = () => confirmSheet({ title: `Leave ${g.name}?`, text: 'You can join again later with the code.', confirm: 'Leave group', danger: true, onConfirm: async () => { try { await BW.api(`groups/${g.id}/leave`); } catch {} await loadGroups(); LS.set('inGroups', (S.groups || []).length > 0); sheets.slice().forEach(x => x.close()); render(); toast('You left the group'); } });
    };
    const cached = (S.groups || LS.get('groupsCache', [])).find(x => x.id === id);
    openSheet({ title: cached ? cached.name : 'Group', left: 'Done', tall: true, body: '<div class="muted" style="text-align:center;padding:30px">Loading…</div>',
      mount: async b => {
        if (cached) draw(b, cached);
        scheduleShare(true); await new Promise(r => setTimeout(r, 400));
        const g = ((await loadGroups()) || []).find(x => x.id === id);
        if (g) draw(b, g); else if (!cached) b.innerHTML = `<div class="banner">${I('info')}<span>${S.online ? 'That group is gone.' : 'Connect to the internet to see your group.'}</span></div>`;
      } });
  }
  function sharePrefsSheet() {
    const pr = sharePrefs();
    const rows = [['goal', 'My goal', 'Like “Lose 1 lb a week”'], ['streak', 'Streak', 'Days in a row you logged'], ['today', 'Today’s progress', 'How much of your calorie goal you’ve used'], ['steps', 'Steps', 'Today’s step count'], ['level', 'Level', 'Your BiteWise level'], ['lost', 'Weight lost', 'Only “down 3 lb”, never your actual weight']];
    openSheet({ title: 'What I share', left: 'Cancel', right: 'Save', body: `<p class="muted" style="text-align:center;margin:4px 12px 14px;font-size:15px">Everyone in your groups sees your name, plus whatever you turn on here.</p><div class="group">${rows.map(([k, t, d]) => `<div class="row"><div class="grow"><div class="title">${t}</div><div class="sub">${d}</div></div><button class="switch" type="button" role="switch" data-pk="${k}" aria-checked="${pr[k]}" aria-label="${t}"></button></div>`).join('')}</div>`,
      mount: b => { b.onclick = e => { const x = e.target.closest('[data-pk]'); if (!x) return; pr[x.dataset.pk] = !pr[x.dataset.pk]; x.setAttribute('aria-checked', pr[x.dataset.pk]); haptic(5); }; },
      onRight: close => { BW.saveProfile({ share: pr }); lastShared = ''; scheduleShare(true); close(); toast('Sharing updated'); } });
  }

  function allergySheet() {
    const sel = new Set(BW.profile().allergies || []);
    const all = Object.values(window.BW_ALLERGENS);
    openSheet({ title: 'Allergies', left: 'Cancel', right: 'Save', body: `<p class="muted" style="text-align:center;margin:4px 12px 14px;font-size:15px">BiteWise warns you when a food you log has one of these, and Bitey won't suggest them.</p>
      <div class="group">${all.map(a => `<div class="row"><span class="grow">${cap(a)}</span><button class="switch" type="button" role="switch" data-al="${a}" aria-checked="${sel.has(a)}" aria-label="${cap(a)}"></button></div>`).join('')}</div>
      <div class="footnote">Warnings use typical ingredients. Always check the label or ask. Recipes and restaurants can differ.</div>`,
      mount: b => { b.onclick = e => { const x = e.target.closest('[data-al]'); if (!x) return; const a = x.dataset.al; sel.has(a) ? sel.delete(a) : sel.add(a); x.setAttribute('aria-checked', sel.has(a)); haptic(5); }; },
      onRight: close => { BW.saveProfile({ allergies: [...sel] }); close(); toast(sel.size ? `Allergies saved · ${sel.size}` : 'No allergies set'); } });
  }

  function claimSheet() {
    openSheet({ title: 'Create a login', body: `<p class="muted" style="text-align:center;margin:4px 12px 16px;font-size:15px">Your log is already backed up. Add a username and password to open it on another phone, iPad or Mac.</p>
      <form id="cf2"><div class="group"><div class="row"><input class="field" style="background:transparent;padding:0" id="cu" placeholder="Username" autocomplete="username" autocapitalize="off" required></div><div class="row"><input class="field" style="background:transparent;padding:0" id="cp" type="password" placeholder="Password (6+ characters)" autocomplete="new-password" required></div></div><div class="footnote" id="cerr"></div><button class="btn" style="margin-top:12px">Save login</button></form>`,
      mount: (b, close) => { $('#cf2', b).onsubmit = async e => { e.preventDefault(); try { await BW.claimAccount($('#cu', b).value, $('#cp', b).value); close(); toast('Login saved'); } catch (err) { $('#cerr', b).style.color = 'var(--red)'; $('#cerr', b).textContent = err.message; } }; } });
  }

  function themesSheet() {
    const lv = BW.level().n, p = BW.profile();
    openSheet({
      title: 'App theme', left: 'Done',
      body: `<div class="footnote" style="margin:0 4px 12px">Level up to unlock new colors. You're level ${lv}.</div><div class="group">${THEMES.map(t => `<button class="row" type="button" data-t="${t.id}" ${t.level > lv ? 'aria-disabled="true"' : ''}><span style="width:30px;height:30px;border-radius:50%;background:${t.color};flex:none;${t.level > lv ? 'opacity:.35' : ''}"></span><div class="grow"><div class="title">${t.name}</div><div class="sub">${t.level > lv ? 'Unlocks at level ' + t.level : 'Unlocked'}</div></div>${t.level > lv ? `<span style="color:var(--label3);width:20px">${I('lock')}</span>` : p.theme === t.id ? `<span style="color:var(--accent);width:22px">${I('check')}</span>` : ''}</button>`).join('')}</div>`,
      mount: (b, close) => { b.onclick = e => { const r = e.target.closest('[data-t]'); if (!r) return; const t = THEMES.find(x => x.id === r.dataset.t); if (t.level > lv) return toast(`Reach level ${t.level} to unlock ${t.name}`, { icon: 'lock' }); BW.saveProfile({ theme: t.id }); haptic(8); close(); }; },
    });
  }

  // what the "Set my own number" box can go down to, said plainly
  function ownNote(g, typed) {
    const low = typed != null && typed > 0 && typed < g.floor;
    const why = g.teen ? 'because you\u2019re under 18, BiteWise keeps you close to what you burn (' + fmt(g.tdee) + ') so you have fuel to grow' : 'the safety minimum';
    return low ? `<b>${fmt(typed)} is too low.</b> The lowest you can set is <b>${fmt(g.floor)}</b>, ${why}.` : `Lowest you can set: ${fmt(g.floor)}${g.teen ? ' (under 18)' : ''}`;
  }
  function goalsSheet() {
    const p = { ...BW.profile() };
    p.goalType ||= p.pace > 0 ? 'lose' : 'maintain';
    openSheet({
      title: 'Your goal', left: 'Cancel', tall: true, body: '',
      mount: (b, close) => {
        const summary = () => {
          const g = BW.goals(p), wk = g.weeklyChange;
          const line = g.custom ? (Math.abs(wk) < .1 ? 'About the same as you burn, so your weight stays steady' : `That's about <b>${Math.abs(wk).toFixed(1)} lb a week</b> ${wk < 0 ? 'down' : 'up'}`)
            : g.goalType === 'lose' ? `To lose about <b>${g.pace} lb a week</b>` : g.goalType === 'gain' ? `To gain about <b>${g.gain} lb a week</b>` : 'Keeps your weight steady';
          const eta = g.goalType === 'lose' && p.goalLb < p.weightLb && wk < -0.05 ? (() => { const d = new Date(); d.setDate(d.getDate() + Math.round((p.weightLb - p.goalLb) / -wk * 7)); return d.toLocaleDateString(undefined, { month: 'long', year: 'numeric' }); })() : null;
          return `<div class="caption" style="font-size:14px">Calories a day</div>
            <div class="big-num num">${fmt(g.budget)}</div>
            <div class="muted" style="font-size:15px;margin-top:2px">${line}${eta ? ` · reach ${p.goalLb} lb around <b>${eta}</b>` : ''}</div>
            ${g.clamped ? `<div class="banner" style="margin:12px 0 0;text-align:left">${I('info')}<span>${g.teen ? `Under 18, BiteWise keeps you within 250 of maintenance (${fmt(g.tdee)}) so you have fuel to grow.` : `Raised to the ${fmt(g.floor)} cal safety minimum.`}</span></div>` : ''}`;
        };
        const draw = () => {
          const g = BW.goals(p), own = !!p.customBudget;
          b.innerHTML = `
            <div class="card goal-hero" id="gsum">${summary()}</div>
            <div class="seg goal-type" style="margin-top:16px">${[['lose', 'Lose'], ['maintain', 'Maintain'], ['gain', 'Gain']].map(([v, l]) => `<button type="button" data-gt="${v}" aria-pressed="${p.goalType === v && !own}">${l}</button>`).join('')}</div>
            ${own ? '' : p.goalType === 'lose' ? `<div class="pace-row">${[[0.5, 'Easy', '½ lb/wk'], [1, 'Steady', '1 lb/wk'], [1.5, 'Faster', '1½ lb/wk'], [2, 'Fast', '2 lb/wk']].map(([v, n, d]) => `<button type="button" data-pace="${v}" aria-pressed="${g.pace === v}" ${v > g.maxPace ? 'disabled' : ''}><b>${n}</b><span>${v > g.maxPace ? (g.teen ? 'Not under 18' : 'Too fast') : d}</span></button>`).join('')}</div>`
              : p.goalType === 'gain' ? `<div class="pace-row">${[[0.25, 'Slow', '¼ lb/wk'], [0.5, 'Steady', '½ lb/wk'], [1, 'Faster', '1 lb/wk']].map(([v, n, d]) => `<button type="button" data-gain="${v}" aria-pressed="${g.gain === v}"><b>${n}</b><span>${d}</span></button>`).join('')}</div>` : ''}
            ${own || p.goalType === 'maintain' ? '' : `<div class="group" style="margin-top:12px"><div class="row"><span class="grow">Goal weight</span><span class="value"><input class="inline-input num" id="g_goal" inputmode="decimal" value="${p.goalLb}" style="width:64px"> lb</span></div></div>`}

            <div class="group" style="margin-top:16px">
              <div class="row"><div class="grow"><div class="title">Set my own number</div><div class="sub">Type any daily calorie goal instead</div></div><button class="switch" type="button" role="switch" aria-checked="${own}" data-own aria-label="Set my own number"></button></div>
              ${own ? `<div class="row"><button class="stepbtn" type="button" data-cb="-50" aria-label="50 less" ${p.customBudget <= g.floor ? 'disabled' : ''}>−</button><input class="own-input num" id="g_cb" inputmode="numeric" value="${p.customBudget}" aria-label="Daily calories"><button class="stepbtn" type="button" data-cb="50" aria-label="50 more">+</button></div>
              <div class="own-note" id="g_note">${ownNote(g)}</div>` : ''}
            </div>

            <div class="footnote" style="margin:22px 16px 6px">ABOUT YOU · USED FOR THE MATH</div>
            <div class="group">
              <div class="row"><span class="grow">Name</span><input class="inline-input" id="g_name" value="${esc(p.name)}" placeholder="Optional" style="width:55%"></div>
              <div class="row"><span class="grow">Gender</span><div class="seg" style="width:210px"><button type="button" data-sex="female" aria-pressed="${p.sex === 'female'}">Female</button><button type="button" data-sex="male" aria-pressed="${p.sex === 'male'}">Male</button><button type="button" data-sex="other" aria-pressed="${p.sex === 'other'}">Other</button></div></div>
              <div class="row"><span class="grow">Age</span><input class="inline-input num" id="g_age" inputmode="numeric" value="${p.age}"></div>
              <div class="row"><span class="grow">Height</span><span class="value"><input class="inline-input num" id="g_ft" inputmode="numeric" value="${Math.floor(p.heightIn / 12)}" style="width:28px"> ft <input class="inline-input num" id="g_in" inputmode="numeric" value="${p.heightIn % 12}" style="width:28px"> in</span></div>
              <div class="row"><span class="grow">Weight now</span><span class="value"><input class="inline-input num" id="g_w" inputmode="decimal" value="${p.weightLb}" style="width:64px"> lb</span></div>
              <div class="row"><span class="grow">Activity</span><div class="seg" style="width:210px">${[[1.2, 'Low'], [1.375, 'Light'], [1.55, 'Active'], [1.725, 'Very']].map(([v, n]) => `<button type="button" data-act2="${v}" aria-pressed="${p.activity === v}">${n}</button>`).join('')}</div></div>
            </div>
            <div class="footnote">Low = mostly sitting · Light = some walking · Active = sports or workouts most days · Very = hard training daily. You burn about <b>${fmt(g.tdee)}</b> a day.</div>
            <button class="btn" type="button" id="gsave" style="margin-top:20px">Save goal</button>`;
          $('#gsave', b).onclick = save;
        };
        const refresh = () => { const el = $('#gsum', b); if (el) el.innerHTML = summary(); };
        const save = () => {
          if (p.age < 5 || p.age > 110 || p.heightIn < 36 || p.weightLb < 50) return toast('Check your age, height and weight', { icon: 'info' });
          if (p.customBudget && p.customBudget > 6000) return toast('Pick a number up to 6,000', { icon: 'info' });
          let raised = snapped && !!p.customBudget;
          if (p.customBudget) { const fl = BW.goals(p).floor; if (p.customBudget < fl) { p.customBudget = fl; raised = true; } }
          BW.saveProfile({ ...p }); haptic(12); close();
          toast(raised ? `Set to ${fmt(p.customBudget)}, the lowest allowed for you` : `Goal saved · ${fmt(BW.goals().budget)} cal a day`, { icon: raised ? 'info' : 'check' });
        };
        draw();
        let snapped = false;
        b.addEventListener('focusout', e => { if (e.target.id !== 'g_cb' || !p.customBudget) return; const fl = BW.goals(p).floor; if (p.customBudget < fl) { p.customBudget = fl; e.target.value = fl; snapped = true; const note = $('#g_note', b); if (note) { note.innerHTML = ownNote(BW.goals(p)); note.classList.remove('warn'); } refresh(); haptic(10); } });
        b.oninput = e => {
          const t = e.target, n = parseFloat(t.value);
          if (t.id === 'g_name') p.name = t.value;
          if (t.id === 'g_age' && n > 0) p.age = n;
          if (t.id === 'g_ft' || t.id === 'g_in') p.heightIn = (parseInt($('#g_ft').value) || 0) * 12 + (parseInt($('#g_in').value) || 0);
          if (t.id === 'g_w' && n > 0) p.weightLb = n;
          if (t.id === 'g_goal' && n > 0) p.goalLb = n;
          if (t.id === 'g_cb') { if (n > 0) p.customBudget = Math.round(n); const g2 = BW.goals(p), note = $('#g_note', b); if (note) { note.innerHTML = ownNote(g2, n); note.classList.toggle('warn', n > 0 && n < g2.floor); } }
          refresh();
        };
        b.onclick = e => {
          const x = e.target.closest('button'); if (!x) return;
          const d = x.dataset;
          if (d.gt) { p.goalType = d.gt; p.customBudget = null; if (d.gt === 'lose' && !(p.pace > 0)) p.pace = 1; if (d.gt === 'lose' && p.goalLb >= p.weightLb) p.goalLb = Math.round(p.weightLb * .92); if (d.gt === 'gain' && p.goalLb <= p.weightLb) p.goalLb = Math.round(p.weightLb * 1.05); }
          else if (d.pace) p.pace = +d.pace;
          else if (d.gain) p.gainPace = +d.gain;
          else if ('own' in d) p.customBudget = p.customBudget ? null : BW.goals(p).budget;
          else if (d.cb) p.customBudget = Math.max(BW.goals(p).floor, Math.min(6000, (p.customBudget || BW.goals(p).budget) + +d.cb));
          else if (d.sex) p.sex = d.sex;
          else if (d.act2) p.activity = +d.act2;
          else return;
          haptic(5);
          if (d.cb) { $('#g_cb', b).value = p.customBudget; const g2 = BW.goals(p); const minus = $('[data-cb="-50"]', b); if (minus) minus.disabled = p.customBudget <= g2.floor; const note = $('#g_note', b); if (note) { note.innerHTML = ownNote(g2); note.classList.remove('warn'); } refresh(); } else draw();
        };
      },
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
      if (d.shift) { const nd = BW.addDays(S.date, +d.shift); if (nd <= BW.dayKey()) { S.date = nd; S.qmeal = null; render(); haptic(5); } return; }
      if (d.quick) { const en = BW.addEntry({ date: S.date, meal: qMeal(), calories: +d.quick, source: 'quick' }); haptic(12); toast(`Added ${d.quick} cal to ${cap(en.meal)}`, { undo: () => BW.remove(en.id) }); return; }
      if (d.sugg) { const f = S.sugg[+d.sugg]; if (!f) return; const en = BW.addEntry({ date: S.date, meal: qMeal(), name: f.name, calories: f.calories, source: 'text', allergens: f.allergens }); S.qdraft = ''; const qi = $('#qcal'); if (qi) qi.value = ''; S.sugg = []; haptic(12); render(); toast(`${f.name} · ${f.calories} cal`, { undo: () => BW.remove(en.id) }); const bad = clash(f.allergens); if (bad.length) setTimeout(() => toast(`Heads up: contains ${bad.join(', ')}`, { icon: 'info' }), 2600); return; }
      if (d.fit) { const f = (S.fits || [])[+d.fit]; if (!f) return; const en = BW.addEntry({ date: S.date, meal: qMeal(), name: f.name, calories: f.calories, source: 'quick', allergens: f.allergens }); haptic(12); toast(`${f.name} · ${f.calories} cal`, { undo: () => BW.remove(en.id) }); return; }
      if (d.usual) { const u = BW.frequent()[+d.usual]; const en = BW.addEntry({ date: S.date, meal: qMeal(), name: u.name, calories: u.calories, source: 'quick' }); haptic(12); toast(`${u.name} · ${u.calories} cal`, { undo: () => BW.remove(en.id) }); return; }
      if (d.entry) { if (t.closest('.swipe')?.classList.contains('open')) { closeSwipes(); return; } editEntry(d.entry); return; }
      if (d.del) { delEntry(d.del); return; }
      if (d.addmeal) return openLog({ meal: d.addmeal });
      if (d.water) { BW.setWater(S.date, BW.day(S.date).water + +d.water); haptic(6); return; }
      if (d.range) { S.progRange = +d.range; render(); return; }
      if (d.badge) return badgeSheet(d.badge);
      if (d.say) { if (!S.online || !S.status.ai) return toast(!S.online ? 'You’re offline — the coach needs internet' : 'The coach isn’t turned on yet', { icon: 'info' }); return sendCoach(d.say); }
      if (d.undoact) { undoCoach(+d.undoact); return; }
      if (d.group) return groupSheet(d.group);
      if (d.cview) { S.coachView = d.cview; if (d.cview === 'recipes' && !S.recipes && !S.rloading) loadRecipes(); else render(); haptic(5); return; }
      if (d.rcat) { S.rcat = S.rcat === d.rcat ? '' : d.rcat; S.rq = ''; loadRecipes(); return; }
      if (d.recipe) return recipeSheet(S.recipes[+d.recipe]);
      if (d.go) { go(d.go); return; }
      switch (d.act) {
        case 'log': return openLog({ mode: 'quick' });
        case 'voice': return openLog({ mode: 'voice' });
        case 'search': return openLog({ mode: 'search' });
        case 'type': return openLog({ mode: 'type', text: S.qdraft || '' });
        case 'rings': case 'health': return healthSheet();
        case 'streak': { const s = BW.streak(); return openSheet({ title: 'Streak', left: 'Done', body: `<div class="celebrate"><div class="med" style="background:var(--orange)">${I('flame')}</div><div style="font-size:44px;font-weight:800" class="num">${s.days} day${s.days === 1 ? '' : 's'}</div><div class="muted" style="margin:6px 10px 14px">${s.loggedToday ? 'You logged today. See you tomorrow!' : 'Log anything today to keep it going.'}</div></div><div class="group"><div class="row"><span class="grow">Best streak</span><span class="value num">${s.best} days</span></div><div class="row"><span class="grow">Streak freezes</span><span class="value num">${s.freezes} / 2</span></div></div><div class="footnote">Every 7 days in a row earns a freeze. It saves your streak if you miss a day.</div>` }); }
        case 'steps': return stepsSheet();
        case 'calinfo': return calSheet();
        case 'cyclemeal': { const order = MEALS.map(x => x[0]); S.qmeal = order[(order.indexOf(qMeal()) + 1) % 4]; $('#qhint').innerHTML = qHint(); haptic(5); return; }
        case 'hidefitbit': LS.set('hideFitbitCard', true); render(); return;
        case 'badges': return badgesSheet();
        case 'claim': return claimSheet();
        case 'allergies': return allergySheet();
        case 'versions': checkVersion(); return whatsNew(true);
        case 'newgroup': return newGroupSheet();
        case 'joingroup': return joinGroupSheet();
        case 'shareprefs': return sharePrefsSheet();
        case 'weight': return weightSheet();
        case 'clearchat': saveChat([]); render(); return;
        case 'profile': case 'goals': return goalsSheet();
        case 'stepgoal': return numberSheet({ title: 'Step goal', label: 'Every day', value: BW.profile().stepGoal, unit: 'steps', step: 500, min: 1000, max: 40000, onSave: n => BW.saveProfile({ stepGoal: Math.round(n) }) });
        case 'watergoal': return numberSheet({ title: 'Water goal', label: 'Every day', value: BW.profile().waterGoal, unit: 'glasses (8 oz)', step: 1, min: 1, max: 20, onSave: n => BW.saveProfile({ waterGoal: Math.round(n) }) });
        case 'earnsteps': BW.saveProfile({ earnSteps: !BW.profile().earnSteps }); haptic(6); return;
        case 'fitbit': return fitbitSheet();
        case 'signin': return signInSheet('login');
        case 'signup': return signInSheet('signup');
        case 'syncnow': await BW.sync(); await refreshMe(); toast(BW.syncError ? 'Sync failed: ' + BW.syncError : 'Synced', { icon: 'cloud' }); return;
        case 'signout': return confirmSheet({ title: 'Sign out?', text: 'Your log stays on this device. Sign back in any time to sync again.', confirm: 'Sign out', danger: true, onConfirm: async () => { await BW.signOut(); LS.set('healthLinked', false); toast('Signed out'); } });
        case 'themes': return themesSheet();
        case 'install': return installSheet();
        case 'voicehelp': return voiceHelpSheet();
        case 'export': return exportData();
        case 'wipe': return confirmSheet({ title: 'Delete all data?', text: 'This removes every food, weigh-in, badge and setting from this device. Your cloud backup (if you have one) stays until you sign in again.', confirm: 'Delete everything', danger: true, onConfirm: async () => { if (BW.acct()) await BW.signOut(); BW.wipe(); LS.del('coachDraft'); S.tab = 'today'; location.hash = ''; render(); } });
      }
    };
    // swipe-to-delete on food rows
    $$('.swipe .row', v).forEach(row => {
      if (row._sw) return; row._sw = true; // rows survive re-renders now, so bind once
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
      const baseChips = $('#qchips').innerHTML;
      qi.oninput = () => { S.qdraft = qi.value; add.disabled = !qi.value.trim(); $('#qhint').innerHTML = qHint(); if (!qi.value.trim() || /^\d+$/.test(qi.value.trim())) { S.sugg = []; render(); } else $('#qchips').innerHTML = qChips(baseChips); };
      qf.onsubmit = e => {
        e.preventDefault();
        const v = qi.value.trim(); if (!v) return;
        const date = S.date;
        if (/^\d+$/.test(v)) {
          const n = +v; if (n <= 0 || n > 9999) return toast('Enter between 1 and 9,999 calories', { icon: 'info' });
          const en = BW.addEntry({ date, meal: qMeal(), calories: n, source: 'quick' });
          S.qdraft = ''; haptic(12); toast(`Added ${fmt(n)} cal to ${cap(en.meal)}`, { undo: () => BW.remove(en.id) });
        } else {
          const r = BW_PARSE.parseLog(v);
          if (r.allKnown && r.total > 0) {
            const made = r.items.map(i => BW.addEntry({ date, meal: r.meal || qMeal(), name: i.name, calories: i.calories, source: 'text', allergens: i.allergens }));
            const bad = clash(r.items.flatMap(i => i.allergens || []));
            if (bad.length) setTimeout(() => toast(`Heads up: contains ${[...new Set(bad)].join(', ')}`, { icon: 'info' }), 2600);
            S.qdraft = ''; haptic(12); toast(`${made.length > 1 ? made.length + ' items' : made[0].name} · ${fmt(r.total)} cal`, { undo: () => made.forEach(m => BW.remove(m.id)) });
          } else { S.qdraft = ''; openLog({ mode: 'type', text: v }); }
        }
        qi.value = S.qdraft || ''; add.disabled = !qi.value.trim(); $('#qhint').innerHTML = qHint();
        if (!finePointer) qi.blur();
      };
    }
    const rf = $('#rform');
    if (rf) { const ri = $('#rq'); ri.oninput = () => { S.rq = ri.value; }; rf.onsubmit = e => { e.preventDefault(); S.rcat = ''; ri.blur(); loadRecipes(); }; }
    const f = $('#coachForm');
    if (f) {
      const ta = $('#coachInput');
      const grow = () => { ta.style.height = 'auto'; ta.style.height = Math.min(120, ta.scrollHeight) + 'px'; };
      ta.oninput = () => { LS.set('coachDraft', ta.value); grow(); };
      ta.onkeydown = e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); f.requestSubmit(); } };
      // clear the box right away: the page keeps a focused box's text between redraws, so it must be emptied by hand
      f.onsubmit = e => { e.preventDefault(); if (!S.online || !S.status.ai || !ta.value.trim()) return; const text = ta.value; ta.value = ''; LS.set('coachDraft', ''); grow(); sendCoach(text); };
      grow();
    }
  }
  function closeSwipes(except) { $$('.swipe.open').forEach(s => { if (s !== except) { s.classList.remove('open'); s.querySelector('.row').style.transform = ''; } }); }
  function undoCoach(i) {
    const msgs = chat(), m = msgs[i]; if (!m || m.undone) return;
    const today = BW.dayKey();
    (m.ids || []).forEach(x => {
      if (x.id) BW.remove(x.id);
      if ('water' in x) BW.setWater(today, x.water);
      if ('weight' in x) { x.weight ? BW.setWeight(today, x.weight) : BW.remove('weight:' + today); }
      if ('steps' in x) { x.steps || x.stepsSrc ? BW.setSteps(x.stepsDay, x.steps, x.stepsSrc || 'manual') : BW.remove('steps:' + x.stepsDay); }
      if ('goal' in x) BW.saveProfile({ customBudget: x.goal });
      if (x.restore) BW.put({ ...x.restore, deleted: false });
    });
    m.undone = true; saveChat(msgs); render(); toast('Undone');
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
    const steps = `<div class="steps">${[1, 2, 3, 4, 5].map(i => `<i class="${i <= ob.step ? 'on' : ''}"></i>`).join('')}</div>`;
    let body = '', foot = '';
    if (ob.step === 0) {
      body = `<div style="margin-top:6vh"><div class="logo">${I('bite')}</div></div><h1>Eat smart.<br>Log in seconds.</h1><p class="lead">BiteWise is the calorie counter you'll actually keep using. It works even with no internet.</p>
        <div style="display:flex;flex-direction:column;gap:18px;margin-top:10px">
          <div class="feature"><span class="icon-sq" style="background:var(--orange)">${I('bolt')}</span><div><b>Quick log</b><span>Just type the number. 450, done.</span></div></div>
          <div class="feature"><span class="icon-sq" style="background:var(--pink)">${I('mic')}</span><div><b>Say it or type it</b><span>“Two eggs and toast” becomes calories. Works offline.</span></div></div>
          <div class="feature"><span class="icon-sq" style="background:var(--purple)">${I('coach')}</span><div><b>Bitey, your AI coach</b><span>Meal ideas, check-ins, and it logs for you.</span></div></div>
          <div class="feature"><span class="icon-sq" style="background:#00B0B9">${I('watch')}</span><div><b>Steps, streaks and rewards</b><span>Fitbit steps, a Health Score, levels, badges and themes.</span></div></div>
        </div>`;
      foot = `<button class="btn" type="button" data-ob="next">Get started</button><button class="btn gray" type="button" data-ob="signin">I already have an account</button><button class="link-btn" type="button" data-ob="demo" style="font-size:15px;padding:6px">Just look around with sample data</button>`;
    } else if (ob.step === 1) {
      body = `${steps}<h1>About you</h1><p class="lead">This sets your daily calorie budget. It stays on your phone.</p>
        <div class="group">
          <div class="row"><span class="grow">Name</span><input class="inline-input" id="o_name" value="${esc(p.name)}" placeholder="Optional" style="width:55%"></div>
          <div class="row"><span class="grow">Gender</span><div class="seg" style="width:210px"><button type="button" data-sex="female" aria-pressed="${p.sex === 'female'}">Female</button><button type="button" data-sex="male" aria-pressed="${p.sex === 'male'}">Male</button><button type="button" data-sex="other" aria-pressed="${p.sex === 'other'}">Other</button></div></div>
          <div class="row"><span class="grow">Age</span><input class="inline-input num" id="o_age" inputmode="numeric" value="${p.age}"></div>
          <div class="row"><span class="grow">Height</span><span class="value"><input class="inline-input num" id="o_ft" inputmode="numeric" value="${Math.floor(p.heightIn / 12)}" style="width:28px"> ft <input class="inline-input num" id="o_in" inputmode="numeric" value="${p.heightIn % 12}" style="width:28px"> in</span></div>
          <div class="row"><span class="grow">Weight</span><span class="value"><input class="inline-input num" id="o_w" inputmode="decimal" value="${p.weightLb}" style="width:60px"> lb</span></div>
        </div>`;
      foot = `<button class="btn" type="button" data-ob="next">Continue</button><button class="btn gray" type="button" data-ob="back">Back</button>`;
    } else if (ob.step === 2) {
      const gt = p.goalType || 'lose';
      body = `${steps}<h1>What's your goal?</h1>
        <div style="display:flex;flex-direction:column;gap:8px">${[['lose', 'Lose weight', g.teen ? 'Gently, with plenty of fuel to grow' : 'Eat a little less than you burn'], ['maintain', 'Stay where I am', 'Build healthy habits and keep steady'], ['gain', 'Gain weight', 'Build up, like for sports']].map(([v, n, d]) => `<button class="opt" type="button" data-gt="${v}" aria-pressed="${gt === v}"><div><b>${n}</b><span>${d}</span></div><span class="ck">${I('check')}</span></button>`).join('')}</div>
        ${gt === 'maintain' ? '' : `<div class="group"><div class="row"><span class="grow">Goal weight</span><span class="value"><input class="inline-input num" id="o_goal" inputmode="decimal" value="${p.goalLb}" style="width:64px"> lb</span></div></div>`}
        ${gt === 'lose' ? `<div class="pace-row">${[[0.5, 'Easy', '½ lb/wk'], [1, 'Steady', '1 lb/wk'], [1.5, 'Faster', '1½ lb/wk'], [2, 'Fast', '2 lb/wk']].map(([v, n, d]) => `<button type="button" data-pace="${v}" aria-pressed="${g.pace === v}" ${v > g.maxPace ? 'disabled' : ''}><b>${n}</b><span>${v > g.maxPace ? (g.teen ? 'Not under 18' : 'Too fast') : d}</span></button>`).join('')}</div>`
          : gt === 'gain' ? `<div class="pace-row">${[[0.25, 'Slow', '¼ lb/wk'], [0.5, 'Steady', '½ lb/wk'], [1, 'Faster', '1 lb/wk']].map(([v, n, d]) => `<button type="button" data-gain="${v}" aria-pressed="${g.gain === v}"><b>${n}</b><span>${d}</span></button>`).join('')}</div>` : ''}
        ${g.teen && gt !== 'maintain' ? `<div class="banner info">${I('heart')}<span>Under 18, BiteWise keeps changes gentle so you have energy for school and sports. It's a good idea to check weight goals with a parent or doctor.</span></div>` : ''}
        <div class="footnote" style="margin:0 4px">You can change this any time in Me → Goals, or type your own calorie number there.</div>`;
      foot = `<button class="btn" type="button" data-ob="next">Continue</button><button class="btn gray" type="button" data-ob="back">Back</button>`;
    } else if (ob.step === 3) {
      body = `${steps}<h1>How active are you?</h1><div style="display:flex;flex-direction:column;gap:8px">${[[1.2, 'Mostly sitting', 'School or desk, little exercise'], [1.375, 'Lightly active', 'Walk around, exercise 1–3 days'], [1.55, 'Active', 'Sports or workouts most days'], [1.725, 'Very active', 'Hard training every day']].map(([v, n, d]) => `<button class="opt" type="button" data-act2="${v}" aria-pressed="${p.activity === v}"><div><b>${n}</b><span>${d}</span></div><span class="ck">${I('check')}</span></button>`).join('')}</div>`;
      foot = `<button class="btn" type="button" data-ob="next">See my plan</button><button class="btn gray" type="button" data-ob="back">Back</button>`;
    } else if (ob.step === 4) {
      const wk = g.weeklyChange;
      body = `${steps}<h1>${p.name ? esc(p.name) + ', your' : 'Your'} daily goal</h1><div class="card" style="text-align:center;padding:26px 16px"><div class="big-num num">${fmt(g.budget)}</div><div class="muted" style="font-weight:600">calories a day</div></div>
        <div class="group">
          <div class="row"><span class="grow">You burn about</span><span class="value num">${fmt(g.tdee)}</span></div>
          <div class="row"><span class="grow">Goal</span><span class="value">${g.goalType === 'lose' ? `Lose ${g.pace} lb a week` : g.goalType === 'gain' ? `Gain ${g.gain} lb a week` : 'Stay steady'}</span></div>
          ${g.goalType !== 'maintain' && Math.abs(wk) > .05 && ((g.goalType === 'lose' && p.goalLb < p.weightLb) || (g.goalType === 'gain' && p.goalLb > p.weightLb)) ? `<div class="row"><span class="grow">Reach ${p.goalLb} lb around</span><span class="value">${(() => { const d = new Date(); d.setDate(d.getDate() + Math.round(Math.abs(p.weightLb - p.goalLb) / Math.abs(wk) * 7)); return d.toLocaleDateString(undefined, { month: 'long', year: 'numeric' }); })()}</span></div>` : ''}
          <div class="row"><span class="grow">Walking bonus</span><span class="value">Steps add calories</span></div>
        </div>${g.clamped ? `<div class="banner">${I('info')}<span>${g.teen ? 'Kept gentle because you’re under 18.' : `Raised to the ${fmt(g.floor)} cal safety minimum.`}</span></div>` : ''}`;
      foot = `<button class="btn" type="button" data-ob="next">Looks good</button><button class="btn gray" type="button" data-ob="back">Back</button>`;
    } else {
      body = `${steps}<div style="margin-top:2vh"><div class="icon-sq" style="background:var(--blue);width:64px;height:64px;border-radius:17px">${I('cloud', 'style="width:34px;height:34px"')}</div></div><h1>Save your progress</h1><p class="lead">Make an account to keep your log safe and open it on your iPad, Mac or a new phone. You'll stay signed in.</p>
        <form id="obacct" class="group" autocomplete="on"><div class="row"><input class="field" style="background:transparent;padding:0" id="ob_u" placeholder="Pick a username" autocomplete="username" autocapitalize="off" spellcheck="false"></div><div class="row"><input class="field" style="background:transparent;padding:0" id="ob_p" type="password" placeholder="Password (6+ characters)" autocomplete="new-password"></div></form>
        <div class="footnote" id="ob_err" style="margin:0 4px">${S.online ? 'Everything still works offline. The account just backs it up.' : 'You’re offline. You can make an account later in Me.'}</div>`;
      foot = `<button class="btn" type="button" data-ob="create" ${S.online ? '' : 'disabled'}>Create account & start</button><button class="btn gray" type="button" data-ob="finish">Skip for now</button>`;
    }
    view.innerHTML = `<div class="onb fade-in"><div class="body">${body}</div><div class="foot">${foot}</div></div>`;
    view.style.padding = '0';
    view.oninput = e => { const t = e.target, n = parseFloat(t.value); if (t.id === 'o_name') p.name = t.value; if (t.id === 'o_age' && n > 0) p.age = n; if (t.id === 'o_ft' || t.id === 'o_in') p.heightIn = (parseInt($('#o_ft').value) || 0) * 12 + (parseInt($('#o_in').value) || 0); if (t.id === 'o_w' && n > 0) { p.weightLb = n; if (p.goalLb >= n) p.goalLb = Math.round(n * .9); } if (t.id === 'o_goal' && n > 0) p.goalLb = n; };
    view.onclick = e => {
      const b = e.target.closest('button'); if (!b) return;
      if (b.dataset.sex) { p.sex = b.dataset.sex; renderOnboarding(); return; }
      if (b.dataset.pace) { p.pace = +b.dataset.pace; renderOnboarding(); return; }
      if (b.dataset.gain) { p.gainPace = +b.dataset.gain; renderOnboarding(); return; }
      if (b.dataset.gt) { p.goalType = b.dataset.gt; if (p.goalType === 'lose') { p.pace ||= BW.goals(p).teen ? 0.5 : 1; if (p.goalLb >= p.weightLb) p.goalLb = Math.round(p.weightLb * .92); } if (p.goalType === 'gain' && p.goalLb <= p.weightLb) p.goalLb = Math.round(p.weightLb * 1.05); renderOnboarding(); return; }
      if (b.dataset.act2) { p.activity = +b.dataset.act2; renderOnboarding(); return; }
      const a = b.dataset.ob;
      if (a === 'next') { if (ob.step === 1 && (p.age < 5 || p.age > 110 || p.heightIn < 36 || p.weightLb < 50)) return toast('Check your age, height and weight', { icon: 'info' }); if (ob.step === 1) p.goalType ||= 'lose'; if (ob.step === 2 && p.goalType === 'lose' && p.goalLb >= p.weightLb) p.goalType = 'maintain'; ob.step++; renderOnboarding(); window.scrollTo(0, 0); }
      if (a === 'back') { ob.step--; renderOnboarding(); }
      if (a === 'demo') { BW.seedDemo(); finishOnboarding(); toast('Sample data loaded — delete it any time in Me', { icon: 'info' }); }
      if (a === 'finish') { BW.saveProfile({ ...p, setup: true }); BW.setWeight(BW.dayKey(), p.weightLb); finishOnboarding(); confetti(80); }
      if (a === 'signin') { signInSheet('login'); }
      if (a === 'create') {
        const u = $('#ob_u').value.trim(), pw = $('#ob_p').value;
        if (!u || pw.length < 6) { $('#ob_err').innerHTML = '<span style="color:var(--red)">Pick a username and a password with 6+ characters.</span>'; return; }
        b.disabled = true; b.textContent = 'Creating…';
        BW.signIn('signup', u, pw).then(() => { BW.saveProfile({ ...p, setup: true }); BW.setWeight(BW.dayKey(), p.weightLb); finishOnboarding(); confetti(80); toast('Account created · you\u2019re backed up', { icon: 'cloud' }); })
          .catch(err => { b.disabled = false; b.textContent = 'Create account & start'; $('#ob_err').innerHTML = `<span style="color:var(--red)">${esc(err.message)}</span>`; });
      }
    };
  }
  function finishOnboarding() { LS.set('seenVersion', APP_VERSION); $('#view').style.padding = ''; $('#view').oninput = null; S.tab = 'today'; S.date = BW.dayKey(); render(); setTimeout(() => { LS.set('seenLevel', BW.level().n); LS.set('seenBadges', BW.badges().filter(b => b.earned).map(b => b.id)); LS.set('seenChallenge', BW.challenge().done ? BW.challenge().week : null); }, 50); }

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

  // ---------- updates + What's new ----------
  async function checkVersion(manual) {
    if (!navigator.onLine) { if (manual) toast('You\u2019re offline. Connect to check for updates', { icon: 'offline' }); return; }
    try {
      const j = await fetch('/version.json', { cache: 'no-store' }).then(r => r.json());
      S.versionInfo = j; LS.set('remoteVersion', j.version); LS.set('versionChecked', Date.now());
      S.updateReady = vcmp(j.version, APP_VERSION) > 0 ? j.version : null;
      updateBar();
      if (manual) toast(S.updateReady ? `Version ${S.updateReady} is ready` : `You\u2019re up to date · ${APP_VERSION}`, { icon: S.updateReady ? 'download' : 'check' });
      if (S.tab === 'me') render();
    } catch { if (manual) toast('Couldn\u2019t check for updates', { icon: 'info' }); }
  }
  function updateBar() {
    let b = $('#updbar');
    if (!b) { b = document.createElement('button'); b.id = 'updbar'; b.type = 'button'; b.className = 'update-bar'; b.onclick = applyUpdate; document.body.appendChild(b); }
    const waiting = S.updateReady || (!navigator.onLine && vcmp(LS.get('remoteVersion', APP_VERSION), APP_VERSION) > 0 ? LS.get('remoteVersion') : null);
    b.hidden = !waiting || !BW.profile().setup;
    if (waiting) b.innerHTML = `${I('download')}<span>${S.updateReady ? `Update ready · <b>${esc(waiting)}</b> · tap to update` : `Update ${esc(waiting)} is waiting · connect to the internet`}</span>`;
  }
  async function applyUpdate() {
    if (!navigator.onLine) return toast('Connect to the internet to update', { icon: 'offline' });
    const b = $('#updbar'); if (b) b.innerHTML = `${I('sync')}<span>Updating…</span>`;
    try { const reg = await navigator.serviceWorker?.getRegistration(); await reg?.update(); } catch {}
    location.reload();
  }
  async function whatsNew(all) {
    let info = S.versionInfo;
    if (!info) { try { info = await fetch('/version.json').then(r => r.json()); } catch { return toast('Connect to the internet to see what\u2019s new', { icon: 'offline' }); } }
    const seen = LS.get('seenVersion', '0.0.0');
    const list = info.history.filter(h => all || (vcmp(h.version, seen) > 0 && vcmp(h.version, APP_VERSION) <= 0));
    if (!list.length) return;
    openSheet({ title: all ? 'Version history' : 'What\u2019s new', left: 'Done', tall: all, body: `
      ${all ? `<div class="card" style="text-align:center;margin-bottom:14px"><div class="caption">You have</div><div class="big-stat">BiteWise ${APP_VERSION}</div><div class="caption" style="margin-top:4px">${S.updateReady ? `Version ${esc(S.updateReady)} is ready. <button class="link-btn" type="button" id="wnup" style="font-size:13px">Update now</button>` : navigator.onLine ? 'Up to date' : 'Offline · connect to check for updates'}</div></div>` : ''}
      ${list.map(h => `<div class="wn"><div class="wn-head"><span class="pill ${h.version === APP_VERSION ? 'cur' : ''}">${esc(h.version)}</span><b>${esc(h.title)}</b></div><ul>${h.changes.map(c => { const m = c.match(/^(New|Fixed|Changed):\s*/); return `<li>${m ? `<span class="wn-tag ${m[1].toLowerCase()}">${m[1]}</span>` : ''}${esc(m ? c.slice(m[0].length) : c)}</li>`; }).join('')}</ul></div>`).join('')}
      ${all ? '' : '<button class="btn" type="button" data-close3 style="margin-top:6px">Got it</button>'}`,
      mount: (b, close) => { $('[data-close3]', b) && ($('[data-close3]', b).onclick = close); $('#wnup', b) && ($('#wnup', b).onclick = applyUpdate); },
      onClose: () => LS.set('seenVersion', APP_VERSION) });
    LS.set('seenVersion', APP_VERSION);
  }

  // ---------- routing ----------
  function go(tab) { S.tab = tab; if (location.hash.slice(1).split('?')[0] !== tab) history.replaceState(null, '', '#' + tab); render(); window.scrollTo(0, 0); }
  $('#tabbar').onclick = e => { const t = e.target.closest('[data-tab]'); if (t) { haptic(5); if (t.dataset.tab === 'log') return openLog(); if (t.dataset.tab === S.tab) { window.scrollTo({ top: 0, behavior: 'smooth' }); if (t.dataset.tab === 'today') { S.date = BW.dayKey(); render(); } return; } go(t.dataset.tab); } };
  function readHash() {
    const [tab, q] = location.hash.slice(1).split('?');
    if (['today', 'progress', 'coach', 'me'].includes(tab)) S.tab = tab;
    if (tab === 'log' || tab === 'voice') { S.tab = 'today'; history.replaceState(null, '', '#today'); setTimeout(() => BW.profile().setup && openLog({ mode: tab === 'voice' ? 'voice' : 'quick' }), 300); }
    const hl = new URLSearchParams(q || '').get('health');
    if (hl) {
      history.replaceState(null, '', '#' + S.tab);
      setTimeout(async () => {
        if (hl === 'connected') { LS.set('healthLinked', true); haptic(20); confetti(60); await autoHealth(true); }
        else toast(hl === 'denied' ? 'Fitbit wasn\u2019t connected. You can try again any time.' : 'Fitbit didn\u2019t connect. Try again.', { icon: 'info' });
      }, 350);
    }
  }

  // ---------- boot ----------
  let renderQueued = false;
  BW.on(() => scheduleShare());
  BW.on(() => { if (renderQueued) return; renderQueued = true; requestAnimationFrame(() => { renderQueued = false; if (BW.profile().setup) render(); else if (!ob.p) renderOnboarding(); checkRewards(); }); });
  const setOnline = () => { S.online = navigator.onLine; if (BW.profile().setup) render(); if (S.online) { BW.sync(); autoHealth(); } };
  addEventListener('online', setOnline); addEventListener('offline', setOnline);
  addEventListener('beforeinstallprompt', e => { e.preventDefault(); S.installEvt = e; });
  addEventListener('hashchange', () => { readHash(); render(); });
  document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'visible') { const t = BW.dayKey(); if (S.date !== t && S._lastToday !== t) { S.date = t; } S._lastToday = t; render(); BW.sync(); autoHealth(); } });
  S._lastToday = BW.dayKey();

  readHash(); render(); checkRewards();
  (window.requestIdleCallback || (f => setTimeout(f, 1200)))(() => BW_PARSE.loadUSDA());
  fetch('/api/status').then(r => r.json()).then(j => { S.status = j; if (BW.profile().setup) render(); }).catch(() => {});
  checkVersion().then(() => { if (BW.profile().setup) { if (LS.get('seenVersion', null) == null && !BW.hasData()) LS.set('seenVersion', APP_VERSION); else if (vcmp(APP_VERSION, LS.get('seenVersion', '0.0.0')) > 0) setTimeout(() => whatsNew(false), 900); } });
  setInterval(() => document.visibilityState === 'visible' && checkVersion(), 30 * 60e3);
  addEventListener('online', () => checkVersion());
  BW.sync(); refreshMe(); loadGroups().then(() => { if (S.tab === 'progress' || S.tab === 'me') render(); scheduleShare(true); });
  if ('serviceWorker' in navigator && location.protocol !== 'file:') navigator.serviceWorker.register('/sw.js').catch(() => {});
})();
