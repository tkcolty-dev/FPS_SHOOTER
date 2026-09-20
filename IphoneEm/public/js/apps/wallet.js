/* Wallet — card stack, demo payments, passes with generated codes, custom passes. */
(function () {
  'use strict';

  const PAY_H = 233, PASS_H = 430, LIST_TOP = 118, SEL_TOP = 110, PILE_TOP = 800;
  const K_PASSES = 'wallet.passes', K_TX = 'wallet.tx', K_STATE = 'wallet.state';
  const SWATCHES = ['#FF3B30', '#FF9500', '#D9A400', '#34C759', '#00A7A0', '#007AFF', '#5856D6', '#AF52DE', '#FF2D55', '#8E6E53', '#3A3A3C'];
  const EMOJI = ['🎟️', '⭐', '🎮', '📚', '⚽', '🎨', '🍕', '🚲', '🎵', '🏊', '🦖', '🚀'];
  const CREDIT_LIMIT = 50;
  const FARE = 2.25;

  const BUILTIN = [
    { id: 'nova', kind: 'credit', name: 'Nova Card', network: 'Orbita Credit', last4: '2041', device: '7304' },
    { id: 'sunny', kind: 'debit', name: 'Sunny Bank Debit', network: 'Zipp Debit', last4: '4821', device: '1196' },
    { id: 'metro', kind: 'transit', name: 'Metro Hopper', network: 'Express Transit', last4: '0612', device: '5530' },
    { id: 'bean', kind: 'pass', style: 'coffee', name: 'Bean Scene Rewards', code: 'BEAN-2048-7731', format: 'bar' },
    { id: 'star', kind: 'pass', style: 'ticket', name: 'Starlight Cinemas', code: 'SLC-8841-G12-ROBOPUP2', format: 'qr' },
  ];

  const MERCHANTS = [
    { m: 'Frosty Cone Ice Cream', e: '🍦', c: '#FF7EB6', w: 'Dessert', p: [2.75, 3.5, 4.25] },
    { m: 'Pixel Arcade', e: '🕹️', c: '#5856D6', w: 'Entertainment', p: [2, 5, 7.5] },
    { m: 'Book Nook', e: '📚', c: '#34C759', w: 'Books', p: [5.99, 8.99, 11.49] },
    { m: 'Snack Shack', e: '🥨', c: '#FF9500', w: 'Food & Drinks', p: [1.5, 2.25, 3] },
    { m: 'Brick Builders Toy Shop', e: '🧱', c: '#FF3B30', w: 'Toys', p: [6.99, 9.99, 12.99] },
    { m: 'Slice Rocket Pizza', e: '🍕', c: '#E4572E', w: 'Restaurants', p: [3.25, 6.5] },
    { m: 'Comet Comics', e: '💥', c: '#007AFF', w: 'Books', p: [3.99, 4.99] },
    { m: 'Splash Zone Pool', e: '🏊', c: '#32ADE6', w: 'Recreation', p: [4, 6] },
    { m: 'Gummy Galaxy Candy', e: '🍬', c: '#AF52DE', w: 'Dessert', p: [0.99, 1.75, 2.5] },
    { m: 'Game Grove', e: '🎮', c: '#1F9D55', w: 'Games', p: [4.99, 9.99] },
    { m: 'Pedal Power Bike Shop', e: '🚲', c: '#00A7A0', w: 'Sports', p: [3.5, 7.5] },
    { m: 'Bean Scene Cocoa Bar', e: '☕', c: '#8E6E53', w: 'Food & Drinks', p: [2.95, 3.25] },
  ];
  const ROUTES = [
    { m: 'Bus 12 · Maple St', e: '🚌' }, { m: 'Green Line · Central Station', e: '🚇' },
    { m: 'Bus 7 · Library', e: '🚌' }, { m: 'Blue Line · Harbor Park', e: '🚇' },
    { m: 'Bus 3 · Science Museum', e: '🚌' }, { m: 'Red Line · Stadium', e: '🚇' },
  ];

  let S = null; // process state (null when not running)

  /* ───────────────────────── helpers ───────────────────────── */
  const esc = (t) => OS.util.esc(String(t == null ? '' : t));
  const money = (a) => '$' + Math.abs(a).toFixed(2);
  const round2 = (n) => Math.round(n * 100) / 100;
  const ownerName = () => (OS.settings.get('ownerName') || '').trim() || 'Cardholder';

  function later(fn, ms, set) {
    if (!S) return 0;
    const bag = set || S.timers;
    const id = setTimeout(() => { bag.delete(id); if (S) fn(); }, ms);
    bag.add(id);
    return id;
  }
  function clearBag(bag) { bag.forEach(clearTimeout); bag.clear(); }

  function rng(seed) {
    let h = 1779033703 ^ seed.length;
    for (let i = 0; i < seed.length; i++) { h = Math.imul(h ^ seed.charCodeAt(i), 3432918353); h = (h << 13) | (h >>> 19); }
    return function () {
      h = Math.imul(h ^ (h >>> 16), 2246822507); h = Math.imul(h ^ (h >>> 13), 3266489909); h ^= h >>> 16;
      return (h >>> 0) / 4294967296;
    };
  }

  function qrSVG(text) {
    const n = 25, r = rng('qr:' + text), g = [];
    for (let y = 0; y < n; y++) { g[y] = []; for (let x = 0; x < n; x++) g[y][x] = r() < 0.48; }
    const finder = (ox, oy) => {
      for (let y = -1; y <= 7; y++) for (let x = -1; x <= 7; x++) {
        const X = ox + x, Y = oy + y;
        if (X < 0 || Y < 0 || X >= n || Y >= n) continue;
        const edge = x < 0 || y < 0 || x > 6 || y > 6;
        const ring = x === 0 || x === 6 || y === 0 || y === 6;
        const core = x >= 2 && x <= 4 && y >= 2 && y <= 4;
        g[Y][X] = !edge && (ring || core);
      }
    };
    finder(0, 0); finder(n - 7, 0); finder(0, n - 7);
    for (let i = 8; i <= n - 9; i++) { g[6][i] = g[i][6] = i % 2 === 0; }
    for (let y = -2; y <= 2; y++) for (let x = -2; x <= 2; x++) g[18 + y][18 + x] = Math.max(Math.abs(x), Math.abs(y)) !== 1;
    let d = '';
    for (let y = 0; y < n; y++) for (let x = 0; x < n; x++) if (g[y][x]) d += 'M' + x + ' ' + y + 'h1v1h-1z';
    return '<svg viewBox="0 0 ' + n + ' ' + n + '" shape-rendering="crispEdges"><path d="' + d + '" fill="#000"/></svg>';
  }

  function barSVG(text) {
    const r = rng('bar:' + text);
    let x = 0, d = '';
    const bar = (w) => { d += 'M' + x + ' 0h' + w + 'v40h-' + w + 'z'; x += w; };
    bar(2); x += 1; bar(1); x += 1;
    while (x < 112) { bar(1 + Math.floor(r() * 3)); x += 1 + Math.floor(r() * 3); }
    bar(2); x += 1; bar(1); x += 1; bar(2);
    return '<svg viewBox="0 0 ' + x + ' 40" preserveAspectRatio="none" shape-rendering="crispEdges"><path d="' + d + '" fill="#000"/></svg>';
  }

  function shade(hex, f) {
    const n = parseInt(String(hex).slice(1), 16) || 0;
    const m = (v) => Math.round(v * (1 - f));
    return 'rgb(' + m((n >> 16) & 255) + ',' + m((n >> 8) & 255) + ',' + m(n & 255) + ')';
  }

  function firstGrapheme(s) {
    s = (s || '').trim();
    if (!s) return '';
    try {
      if (window.Intl && Intl.Segmenter) {
        const it = new Intl.Segmenter().segment(s)[Symbol.iterator]();
        return it.next().value.segment;
      }
    } catch (e) { /* fall through */ }
    return Array.from(s)[0];
  }

  function clock(d) {
    try {
      let t = OS.util.time(d);
      if (!OS.settings.get('use24h')) { const ap = OS.util.ampm(d); if (ap && t.indexOf(ap) < 0) t += ' ' + ap; }
      return t;
    } catch (e) { return d.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' }); }
  }
  function fmtWhen(ts) {
    const d = new Date(ts), now = new Date();
    const day0 = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
    if (ts >= day0) return clock(d);
    if (ts >= day0 - 864e5) return 'Yesterday';
    if (ts >= day0 - 6 * 864e5) return d.toLocaleDateString('en-US', { weekday: 'long' });
    return d.toLocaleDateString('en-US', { month: 'numeric', day: 'numeric', year: '2-digit' });
  }
  function fmtFull(ts) {
    const d = new Date(ts);
    return d.toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' }) + ' at ' + clock(d);
  }
  function nextSaturday() {
    const d = new Date();
    d.setDate(d.getDate() + (((6 - d.getDay() + 7) % 7) || 7));
    return d.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' });
  }

  /* ───────────────────────── data ───────────────────────── */
  function seedTx() {
    const now = Date.now(), H = 36e5, D = 864e5;
    const mk = (name, a, ago, over) => {
      const base = MERCHANTS.find((x) => x.m === name) || {};
      return Object.assign({ id: OS.util.uid(), m: name, e: base.e || '💳', c: base.c || '#8E8E93', w: base.w || 'Shopping', a: a, t: now - ago }, over || {});
    };
    return {
      nova: [
        mk('Frosty Cone Ice Cream', 3.5, 3 * H), mk('Comet Comics', 4.99, D + 2 * H), mk('Brick Builders Toy Shop', 12.99, 2 * D + 5 * H),
        mk('Book Nook', 8.99, 4 * D + H), mk('Pixel Arcade', 5, 5 * D + 6 * H),
      ],
      sunny: [
        mk('Snack Shack', 2.25, 5 * H), mk('Gummy Galaxy Candy', 1.75, D + 4 * H),
        mk('Weekly Allowance', -10, 3 * D, { e: '🐷', c: '#34C759', w: 'Deposit' }),
        mk('Slice Rocket Pizza', 6.5, 3 * D + 3 * H), mk('Splash Zone Pool', 4, 6 * D),
      ],
      metro: [
        mk('Bus 12 · Maple St', FARE, 7 * H, { e: '🚌', c: '#0B8F86', w: 'Transit Fare' }),
        mk('Green Line · Central Station', FARE, D + 8 * H, { e: '🚇', c: '#0B8F86', w: 'Transit Fare' }),
        mk('Top Up', -10, 4 * D, { e: '➕', c: '#34C759', w: 'Add Money' }),
        mk('Bus 7 · Library', FARE, 5 * D + 2 * H, { e: '🚌', c: '#0B8F86', w: 'Transit Fare' }),
      ],
    };
  }
  function defaultState() { return { bal: { nova: 35.47, sunny: 42.18, metro: 12.5 }, stamps: 6, opts: {} }; }

  function loadData() {
    S.passes = OS.store.get(K_PASSES, null);
    if (!Array.isArray(S.passes)) S.passes = [];
    S.tx = OS.store.get(K_TX, null);
    if (!S.tx || typeof S.tx !== 'object') { S.tx = seedTx(); OS.store.set(K_TX, S.tx); }
    const st = OS.store.get(K_STATE, null), def = defaultState();
    S.state = st && typeof st === 'object' ? st : def;
    S.state.bal = Object.assign({}, def.bal, S.state.bal || {});
    if (typeof S.state.stamps !== 'number') S.state.stamps = def.stamps;
    if (!S.state.opts) S.state.opts = {};
  }
  const saveTx = () => OS.store.set(K_TX, S.tx);
  const saveState = () => OS.store.set(K_STATE, S.state);
  const savePasses = () => OS.store.set(K_PASSES, S.passes);
  function optsFor(id) { return S.state.opts[id] || (S.state.opts[id] = { updates: true, notif: true }); }

  /* ───────────────────────── card faces ───────────────────────── */
  function codeBlock(c) {
    const code = c.code || 'PASS-0000';
    const qr = c.format !== 'bar';
    return '<div class="wl-code ' + (qr ? 'qr' : 'bar') + '"><div class="wl-code-tile">' + (qr ? qrSVG(code) : barSVG(code)) +
      (qr ? '' : '<div class="wl-code-text">' + esc(code) + '</div>') + '</div>' +
      (qr ? '<div class="wl-code-cap">' + esc(code) + '</div>' : '') + '</div>';
  }

  function faceHTML(c) {
    const owner = esc(ownerName());
    if (c.id === 'nova') {
      return '<div class="wl-face wl-pay wl-nova">' +
        '<svg class="wl-nova-logo" viewBox="0 0 24 24"><path d="M12 0c1.2 6.5 5.5 10.8 12 12-6.5 1.2-10.8 5.5-12 12C10.800 17.5 6.500 13.2 0 12 6.500 10.8 10.800 6.5 12 0z"/></svg>' +
        '<div class="wl-nova-word">nova</div>' +
        '<div class="wl-nova-name">' + owner + '</div>' +
        '<div class="wl-nova-net"><i></i>orbita</div></div>';
    }
    if (c.id === 'sunny') {
      return '<div class="wl-face wl-pay wl-sunny">' +
        '<div class="wl-sunny-brand"><svg viewBox="0 0 28 28"><circle cx="14" cy="14" r="6" fill="#fff"/><g stroke="#fff" stroke-width="2.4" stroke-linecap="round"><path d="M14 2v3.500M14 22.500V26M2 14h3.500M22.500 14H26M5.500 5.500 8 8M20 20l2.500 2.500M5.500 22.500 8 20M20 8l2.500-2.500"/></g></svg><span>Sunny Bank</span></div>' +
        '<div class="wl-sunny-type">DEBIT</div>' +
        '<div class="wl-sunny-name">' + owner + '</div>' +
        '<div class="wl-sunny-num">•••• ' + esc(c.last4) + '</div>' +
        '<div class="wl-sunny-net"><b></b><b></b><b></b>ZIPP</div></div>';
    }
    if (c.id === 'metro') {
      return '<div class="wl-face wl-pay wl-metro">' +
        '<svg class="wl-metro-map" viewBox="0 0 370 233" fill="none" stroke="#fff" stroke-linecap="round" stroke-linejoin="round">' +
        '<path d="M-10 172H92l60-60h108l42-42h80" stroke-width="6" opacity=".26"/>' +
        '<path d="M58 243v-52l62-62V62l42-42v-30" stroke-width="6" opacity=".16"/>' +
        '<path d="M380 196H250l-40-40h-90" stroke-width="6" opacity=".14"/>' +
        '<g fill="#0a7f86" stroke-width="3.500" opacity=".5"><circle cx="92" cy="172" r="6.500"/><circle cx="152" cy="112" r="6.500"/><circle cx="260" cy="112" r="6.500"/><circle cx="302" cy="70" r="6.500"/><circle cx="120" cy="129" r="6.500"/><circle cx="250" cy="196" r="6.500"/></g></svg>' +
        '<div class="wl-metro-brand"><span class="wl-metro-m">M</span><span>Metro Hopper</span></div>' +
        '<div class="wl-metro-bal"><small>BALANCE</small><b>' + money(S ? S.state.bal.metro : 0) + '</b></div>' +
        '<div class="wl-metro-foot"><span>Express Transit</span><span>Ride all zones</span></div></div>';
    }
    if (c.style === 'coffee') {
      const st = S ? S.state.stamps : 0;
      let dots = '';
      for (let i = 0; i < 10; i++) {
        dots += '<span class="wl-stamp' + (i < st ? ' on' : '') + (S && S.popStamp === i ? ' pop' : '') + '">' + (i === 9 && i >= st ? '<em>FREE</em>' : (i < st ? '☕' : '')) + '</span>';
      }
      return '<div class="wl-face wl-pass wl-coffee">' +
        '<div class="wl-pass-head"><span class="wl-pass-logo">☕</span><span class="wl-pass-org">Bean Scene</span>' +
        '<span class="wl-pass-hf"><small>STAMPS</small><b>' + st + '/10</b></span></div>' +
        '<div class="wl-pass-primary"><b>Rewards Card</b><span>Buy 10 drinks, get 1 free</span></div>' +
        '<div class="wl-stamps">' + dots + '</div>' +
        '<div class="wl-pass-fields"><div><small>MEMBER</small><b>' + owner + '</b></div><div><small>SINCE</small><b>2025</b></div><div><small>FAVORITE</small><b>Hot Cocoa</b></div></div>' +
        codeBlock(c) + '</div>';
    }
    if (c.style === 'ticket') {
      return '<div class="wl-face wl-pass wl-ticket">' +
        '<div class="wl-pass-head"><span class="wl-pass-logo">🎬</span><span class="wl-pass-org">Starlight Cinemas</span>' +
        '<span class="wl-pass-hf"><small>SCREEN</small><b>4</b></span></div>' +
        '<div class="wl-pass-primary"><small>NOW SHOWING</small><b>Robo Pup 2: Fetch the Future</b></div>' +
        '<div class="wl-pass-fields"><div><small>DATE</small><b>' + esc(nextSaturday()) + '</b></div><div><small>TIME</small><b>7:15 PM</b></div><div><small>SEAT</small><b>G12</b></div></div>' +
        '<div class="wl-pass-fields"><div><small>ADMIT</small><b>1 Child</b></div><div><small>RATED</small><b>PG</b></div><div><small>SNACK</small><b>Sm. Popcorn</b></div></div>' +
        codeBlock(c) + '</div>';
    }
    // custom pass
    const col = c.color || SWATCHES[5];
    const added = c.created ? new Date(c.created).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) : 'Today';
    return '<div class="wl-face wl-pass wl-custom" style="background:linear-gradient(160deg,' + esc(col) + ' 0%,' + shade(col, 0.38) + ' 100%)">' +
      '<span class="wl-custom-mark">' + esc(c.emoji || '🎟️') + '</span>' +
      '<div class="wl-pass-head"><span class="wl-pass-logo">' + esc(c.emoji || '🎟️') + '</span><span class="wl-pass-org">' + esc(c.title || 'New Pass') + '</span>' +
      '<span class="wl-pass-hf"><small>PASS</small><b>' + (c.format === 'bar' ? 'Barcode' : 'QR') + '</b></span></div>' +
      '<div class="wl-pass-primary"><small>MEMBER PASS</small><b>' + esc(c.title || 'New Pass') + '</b></div>' +
      '<div class="wl-pass-fields"><div><small>MEMBER</small><b>' + owner + '</b></div><div><small>ADDED</small><b>' + esc(added) + '</b></div></div>' +
      codeBlock(c) + '</div>';
  }

  /* ───────────────────────── layout ───────────────────────── */
  function allCards() { return S.cards; }
  function cardById(id) { return S.cards.find((c) => c.id === id) || null; }

  function buildCards(newId) {
    const stage = S.els.stage;
    stage.querySelectorAll('.wl-card').forEach((n) => n.remove());
    S.cards = BUILTIN.map((b) => Object.assign({}, b)).concat(S.passes.map((p) => Object.assign({ kind: 'pass', style: 'custom', name: p.title }, p)));
    S.cards.forEach((c) => {
      c.h = c.kind === 'pass' ? PASS_H : PAY_H;
      c.el = OS.util.el('<div class="wl-card" data-id="' + esc(c.id) + '" style="height:' + c.h + 'px">' + faceHTML(c) + '</div>');
      stage.appendChild(c.el);
    });
    layout();
    if (newId) {
      const c = cardById(newId);
      if (c) {
        c.el.style.transition = 'none';
        c.el.style.opacity = '0';
        c.el.style.transform = 'translate3d(0,' + (c.y + 280) + 'px,0)';
        void c.el.offsetHeight;
        c.el.style.transition = '';
        c.el.style.opacity = '';
        layout();
      }
    }
  }

  function refreshFace(id) {
    const c = cardById(id);
    if (c && c.el) c.el.innerHTML = faceHTML(c);
  }
  function refreshAllFaces() { allCards().forEach((c) => { c.el.innerHTML = faceHTML(c); }); }

  function layout() {
    const cards = allCards();
    if (S.sel == null) {
      let y = LIST_TOP;
      cards.forEach((c, i) => {
        c.y = y;
        const next = cards[i + 1];
        y += next ? (c.kind === 'pass' ? 64 : (next.kind === 'pass' ? 108 : 60)) : c.h;
        c.el.style.transitionDelay = (i * 16) + 'ms';
        c.el.style.transform = 'translate3d(0,' + c.y + 'px,0)';
        c.el.classList.remove('is-sel', 'in-pile');
      });
      S.els.stage.style.height = Math.max(874, y + 56) + 'px';
    } else {
      const others = cards.filter((c) => c.id !== S.sel), n = others.length;
      let k = 0;
      cards.forEach((c, i) => {
        c.el.style.transitionDelay = (i * 14) + 'ms';
        if (c.id === S.sel) {
          c.el.style.transform = 'translate3d(0,' + SEL_TOP + 'px,0)';
          c.el.classList.add('is-sel'); c.el.classList.remove('in-pile');
        } else {
          const sc = 1 - (n - 1 - k) * 0.022;
          c.el.style.transform = 'translate3d(0,' + (PILE_TOP + k * 9) + 'px,0) scale(' + sc.toFixed(3) + ')';
          c.el.classList.add('in-pile'); c.el.classList.remove('is-sel');
          k++;
        }
      });
      S.els.stage.style.height = '874px';
    }
  }

  function select(id) {
    const card = cardById(id);
    if (!card || S.sel === id) return;
    const sc = S.els.scroller, stage = S.els.stage, s = sc.scrollTop;
    // freeze the visual position while we reset the scroll offset, then animate
    stage.classList.add('no-anim');
    allCards().forEach((c) => { c.el.style.transform = 'translate3d(0,' + (c.y - s) + 'px,0)'; });
    S.els.header.style.transform = 'translateY(' + (-s) + 'px)';
    stage.style.height = '874px';
    sc.scrollTop = 0;
    void stage.offsetHeight;
    stage.classList.remove('no-anim');

    S.sel = id;
    sc.classList.add('locked');
    S.ctx.root.classList.add('sel');
    layout();
    OS.haptic('light');
    renderDetail();
    const det = S.els.detail;
    det.style.top = (SEL_TOP + card.h + 12) + 'px';
    det.scrollTop = 0;
    clearBag(S.uiTimers);
    later(() => det.classList.add('show'), 140, S.uiTimers);
  }

  function deselect() {
    if (S.sel == null) return;
    resetPay();
    S.sel = null;
    clearBag(S.uiTimers);
    S.els.detail.classList.remove('show');
    S.els.header.style.transform = '';
    S.els.scroller.classList.remove('locked');
    S.ctx.root.classList.remove('sel');
    layout();
  }

  /* ───────────────────────── detail panel ───────────────────────── */
  const SVG_READER = '<svg class="wl-reader" viewBox="0 0 64 64" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round">' +
    '<rect x="9" y="12" width="25" height="42" rx="5.500" transform="rotate(-10 21 33)"/>' +
    '<path class="w1" d="M41 25a12 12 0 0 1 0 16"/><path class="w2" d="M47 20a20 20 0 0 1 0 26"/><path class="w3" d="M53 15a28 28 0 0 1 0 36"/></svg>';
  const SVG_FACE = '<svg class="wl-faceid" viewBox="0 0 64 64" fill="none" stroke="currentColor" stroke-width="3.200" stroke-linecap="round" stroke-linejoin="round">' +
    '<path d="M6 20v-6a8 8 0 0 1 8-8h6M44 6h6a8 8 0 0 1 8 8v6M58 44v6a8 8 0 0 1-8 8h-6M20 58h-6a8 8 0 0 1-8-8v-6"/>' +
    '<g class="wl-faceid-in"><path class="eye" d="M22 24v6M42 24v6"/><path d="M32 24v12a3 3 0 0 1-3 3h-1"/><path d="M22 44c3 3.500 6.500 5 10 5s7-1.500 10-5"/></g></svg>';
  const SVG_CHECK = '<svg class="wl-check" viewBox="0 0 64 64" fill="none" stroke="currentColor" stroke-width="3.400" stroke-linecap="round" stroke-linejoin="round"><circle cx="32" cy="32" r="27"/><path d="M20 33.500 28.500 42 45 24"/></svg>';
  const SVG_FAIL = '<svg class="wl-failg" viewBox="0 0 64 64" fill="none" stroke="currentColor" stroke-width="3.400" stroke-linecap="round"><circle cx="32" cy="32" r="27"/><path d="M32 18v18M32 45v.500"/></svg>';
  const SVG_SIDE = '<svg class="wl-side" viewBox="0 0 20 20"><rect x="3" y="2" width="10" height="16" rx="3" fill="none" stroke="currentColor" stroke-width="1.600"/><rect class="wl-side-btn" x="14.500" y="6" width="2.600" height="7" rx="1.300" fill="currentColor"/></svg>';
  const SVG_CHEV = '<svg class="wl-chev" viewBox="0 0 8 13" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M1.500 1.500 6.500 6.500l-5 5"/></svg>';

  function summaryHTML(card) {
    const b = S.state.bal[card.id] || 0;
    if (card.kind === 'credit') {
      return '<div class="wl-summary"><div><div class="wl-sum-l">Card Balance</div><div class="wl-sum-v">' + money(b) + '</div>' +
        '<div class="wl-sum-s">' + money(Math.max(0, CREDIT_LIMIT - b)) + ' available · ' + money(CREDIT_LIMIT) + ' monthly limit</div></div>' +
        '<button class="ios-pill wl-sum-btn" data-act="paycard">Pay</button></div>';
    }
    return '<div class="wl-summary"><div><div class="wl-sum-l">' + (card.kind === 'transit' ? 'Transit Balance' : 'Available Balance') + '</div><div class="wl-sum-v">' + money(b) + '</div>' +
      '<div class="wl-sum-s">' + (card.kind === 'transit' ? money(FARE) + ' per ride · ' + Math.floor(b / FARE + 1e-9) + ' rides left' : 'Sunny Bank Kids Checking') + '</div></div>' +
      '<button class="ios-pill wl-sum-btn" data-act="addmoney">Add Money</button></div>';
  }

  function txListHTML(card, flashFirst) {
    const list = (S.tx[card.id] || []).slice(0, 12);
    if (!list.length) return '<div class="ios-list"><div class="ios-row wl-tx-empty">No Transactions</div></div>';
    return '<div class="ios-list">' + list.map((t, i) =>
      '<div class="ios-row tappable wl-tx' + (flashFirst && i === 0 ? ' new' : '') + '" data-tx="' + esc(t.id) + '">' +
      '<div class="wl-tx-ic" style="background:' + esc(t.c) + '">' + esc(t.e) + '</div>' +
      '<div class="wl-tx-main"><div class="wl-tx-m">' + esc(t.m) + '</div><div class="wl-tx-s">' + esc(t.w) + ' · ' + esc(fmtWhen(t.t)) + '</div></div>' +
      '<div class="wl-tx-a' + (t.a < 0 ? ' credit' : '') + '">' + (t.a < 0 ? '+' : '') + money(t.a) + '</div>' + SVG_CHEV + '</div>').join('') + '</div>';
  }

  function renderDetail() {
    const card = cardById(S.sel), det = S.els.detail;
    if (!card) { det.innerHTML = ''; return; }
    if (card.kind !== 'pass') {
      det.innerHTML =
        '<div class="wl-payzone" data-state="idle">' +
        '<div class="wl-pz idle">' + SVG_READER + '<button class="wl-paybtn pressable" data-act="pay">' + SVG_SIDE + '<span>Double-Click to Pay</span></button>' +
        '<div class="wl-pz-hint">Demo only — no real money moves.</div></div>' +
        '<div class="wl-pz face">' + SVG_FACE + '<span>Face ID</span></div>' +
        '<div class="wl-pz hold">' + SVG_READER + '<span>Hold Near Reader</span></div>' +
        '<div class="wl-pz done">' + SVG_CHECK + '<span>Done</span></div>' +
        '<div class="wl-pz fail">' + SVG_FAIL + '<span class="wl-fail-text">Declined</span></div>' +
        '</div>' +
        '<div class="wl-sum-wrap">' + summaryHTML(card) + '</div>' +
        '<div class="ios-list-header wl-lh">Latest Transactions</div>' +
        '<div class="wl-txwrap">' + txListHTML(card) + '</div>';
      return;
    }
    const o = optsFor(card.id);
    let top = '';
    if (card.style === 'coffee') {
      const full = S.state.stamps >= 10;
      top = '<div class="wl-btnwrap"><button class="ios-btn wl-wide" data-act="stamp">' + (full ? 'Redeem Free Drink' : 'Collect Stamp') + '</button></div>';
    } else if (card.style === 'ticket') {
      top = '<div class="wl-btnwrap"><button class="ios-btn wl-wide" data-act="directions">Directions to Theater</button></div>';
    }
    det.innerHTML = top +
      '<div class="ios-list">' +
      '<div class="ios-row"><span class="ios-row-label">Automatic Updates</span><label class="ios-switch wl-sw"><input type="checkbox" data-opt="updates"' + (o.updates ? ' checked' : '') + '><i></i></label></div>' +
      '<div class="ios-row"><span class="ios-row-label">Allow Notifications</span><label class="ios-switch wl-sw"><input type="checkbox" data-opt="notif"' + (o.notif ? ' checked' : '') + '><i></i></label></div>' +
      '<div class="ios-row tappable" data-act="passinfo"><span class="ios-row-label">Pass Details</span>' + SVG_CHEV + '</div>' +
      '</div>' +
      (card.style === 'custom' ? '<div class="ios-list wl-gap"><div class="ios-row tappable wl-remove" data-act="remove">Remove Pass</div></div>' : '');
  }

  function refreshMoneyUI(flash) {
    const card = cardById(S.sel);
    if (!card || card.kind === 'pass') return;
    const sw = S.els.detail.querySelector('.wl-sum-wrap'), tw = S.els.detail.querySelector('.wl-txwrap');
    if (sw) sw.innerHTML = summaryHTML(card);
    if (tw) tw.innerHTML = txListHTML(card, flash);
    if (card.id === 'metro') refreshFace('metro');
  }

  /* ───────────────────────── money actions ───────────────────────── */
  function addTx(cardId, tx) {
    (S.tx[cardId] || (S.tx[cardId] = [])).unshift(Object.assign({ id: OS.util.uid(), t: Date.now() }, tx));
    S.tx[cardId] = S.tx[cardId].slice(0, 40);
    saveTx();
  }

  function addMoney(card) {
    const amt = card.kind === 'transit' ? 10 : 20;
    S.state.bal[card.id] = round2((S.state.bal[card.id] || 0) + amt);
    addTx(card.id, card.kind === 'transit'
      ? { m: 'Top Up', e: '➕', c: '#34C759', w: 'Add Money', a: -amt }
      : { m: 'Allowance from Mom & Dad', e: '🐷', c: '#34C759', w: 'Deposit', a: -amt });
    saveState();
    OS.haptic('success');
    OS.ui.toast(money(amt) + ' Added');
    refreshMoneyUI(true);
  }

  function payCard(card) {
    const owed = S.state.bal[card.id] || 0;
    if (owed <= 0) { OS.haptic('warning'); OS.ui.toast('Nothing to Pay'); return; }
    OS.ui.alert({
      title: 'Pay ' + money(owed) + '?', message: 'Pay off your Nova Card balance from Sunny Bank savings.',
      buttons: [{ label: 'Cancel', style: 'cancel' }, { label: 'Pay' }],
    }).then((i) => {
      if (i !== 1 || !S) return;
      S.state.bal[card.id] = 0;
      addTx(card.id, { m: 'Payment — Thank You', e: '✅', c: '#34C759', w: 'Payment', a: -owed });
      saveState();
      OS.sound.play('pay'); OS.haptic('success');
      refreshMoneyUI(true);
    });
  }

  function resetCard(card) {
    OS.ui.alert({
      title: 'Reset Transactions?', message: 'This restores the sample activity and balance for ' + card.name + '.',
      buttons: [{ label: 'Cancel', style: 'cancel' }, { label: 'Reset', style: 'destructive' }],
    }).then((i) => {
      if (i !== 1 || !S) return;
      S.tx[card.id] = seedTx()[card.id] || [];
      S.state.bal[card.id] = defaultState().bal[card.id];
      saveTx(); saveState();
      refreshMoneyUI(false);
    });
  }

  /* ───────────────────────── pay demo ───────────────────────── */
  function zone() { return S.els.detail.querySelector('.wl-payzone'); }

  function resetPay() {
    if (!S) return;
    clearBag(S.payTimers);
    S.paying = false;
    const z = zone();
    if (z) z.dataset.state = 'idle';
  }

  function startPay() {
    const card = cardById(S.sel), z = zone();
    if (!card || card.kind === 'pass' || S.paying || !z) return;
    S.paying = true;
    S.els.detail.scrollTop = 0;
    z.dataset.state = 'face';
    OS.haptic('medium');
    later(() => { z.dataset.state = 'hold'; OS.haptic('selection'); }, 1350, S.payTimers);
    later(() => finishPay(card, z), 2750, S.payTimers);
  }

  function finishPay(card, z) {
    let tx;
    if (card.kind === 'transit') {
      const r = ROUTES[Math.floor(Math.random() * ROUTES.length)];
      tx = { m: r.m, e: r.e, c: '#0B8F86', w: 'Transit Fare', a: FARE };
    } else {
      const m = MERCHANTS[Math.floor(Math.random() * MERCHANTS.length)];
      tx = { m: m.m, e: m.e, c: m.c, w: m.w, a: m.p[Math.floor(Math.random() * m.p.length)] };
    }
    const bal = S.state.bal[card.id] || 0;
    const declined = card.kind === 'credit' ? bal + tx.a > CREDIT_LIMIT : bal < tx.a;
    if (declined) {
      const reason = card.kind === 'credit' ? 'Over Monthly Limit' : 'Insufficient Balance';
      const ft = z.querySelector('.wl-fail-text');
      if (ft) ft.textContent = reason;
      z.dataset.state = 'fail';
      OS.sound.play('payfail'); OS.haptic('error');
      later(() => {
        resetPay();
        OS.ui.alert({
          title: reason,
          message: card.kind === 'credit' ? 'Pay down your Nova Card balance to keep using it this month.' : 'Add money to ' + card.name + ' and try again.',
          buttons: [{ label: 'Not Now', style: 'cancel' }, { label: card.kind === 'credit' ? 'Pay Card' : 'Add Money' }],
        }).then((i) => {
          if (i !== 1 || !S || S.sel !== card.id) return;
          if (card.kind === 'credit') payCard(card); else addMoney(card);
        });
      }, 1500, S.payTimers);
      return;
    }
    S.state.bal[card.id] = round2(card.kind === 'credit' ? bal + tx.a : bal - tx.a);
    addTx(card.id, tx);
    saveState();
    z.dataset.state = 'done';
    OS.sound.play('pay');
    OS.haptic('success');
    refreshMoneyUI(true);
    later(() => resetPay(), 1800, S.payTimers);
  }

  /* ───────────────────────── passes ───────────────────────── */
  function collectStamp() {
    if (S.state.stamps >= 10) {
      S.state.stamps = 0; S.popStamp = -1;
      OS.sound.play('pay'); OS.haptic('success');
      OS.ui.toast('Enjoy your free cocoa!');
    } else {
      S.state.stamps++;
      S.popStamp = S.state.stamps - 1;
      OS.haptic(S.state.stamps >= 10 ? 'success' : 'medium');
      if (S.state.stamps >= 10) OS.ui.toast('Free drink earned!');
    }
    saveState();
    refreshFace('bean');
    S.popStamp = -1;
    const btn = S.els.detail.querySelector('[data-act="stamp"]');
    if (btn) btn.textContent = S.state.stamps >= 10 ? 'Redeem Free Drink' : 'Collect Stamp';
  }

  function removePass(card) {
    OS.ui.actionSheet({
      title: '“' + (card.title || card.name) + '” will be removed from Wallet.',
      buttons: [{ label: 'Remove Pass', style: 'destructive' }], cancel: 'Cancel',
    }).then((i) => {
      if (i !== 0 || !S) return;
      OS.sound.play('trash'); OS.haptic('medium');
      if (card.el) { card.el.style.transitionDelay = '0ms'; card.el.style.opacity = '0'; card.el.style.transform = 'translate3d(0,' + SEL_TOP + 'px,0) scale(.82)'; }
      S.els.detail.classList.remove('show');
      later(() => {
        S.passes = S.passes.filter((p) => p.id !== card.id);
        delete S.state.opts[card.id];
        savePasses(); saveState();
        S.sel = null;
        S.els.header.style.transform = '';
        S.els.scroller.classList.remove('locked');
        S.ctx.root.classList.remove('sel');
        buildCards();
      }, 300, S.uiTimers);
    });
  }

  function copyText(text) {
    const ok = () => OS.ui.toast('Copied');
    try {
      if (navigator.clipboard && navigator.clipboard.writeText) { navigator.clipboard.writeText(text).then(ok, ok); return; }
    } catch (e) { /* ignore */ }
    ok();
  }

  /* ───────────────────────── sheets ───────────────────────── */
  function infoSheet(title, headHTML, rows) {
    let sh = null;
    const close = () => { try { if (sh) sh.close(); } catch (e) { /* already closed */ } };
    sh = OS.ui.sheet({
      title: title, height: 'medium', right: { label: 'Done', bold: true, onTap: close },
      render(body, sheet) {
        sh = sh || sheet;
        body.innerHTML = '<div class="wl-sheet">' + (headHTML || '') + '<div class="ios-list">' + rows.map((r) =>
          '<div class="ios-row"><span class="ios-row-label">' + esc(r[0]) + '</span><span class="ios-row-value wl-val">' + esc(r[1]) + '</span></div>').join('') +
          '</div><div class="ios-list-footer">Wallet on this iPhone is a demo. Cards, passes and payments are pretend.</div></div>';
      },
    });
  }

  function cardInfo(card) {
    if (card.kind === 'pass') {
      const rows = [['Pass', card.title || card.name], ['Code', card.code || '—'], ['Format', card.format === 'bar' ? 'Barcode' : 'QR Code'], ['Holder', ownerName()]];
      if (card.style === 'coffee') rows.push(['Stamps', S.state.stamps + ' of 10']);
      if (card.style === 'ticket') rows.push(['Showtime', nextSaturday() + ', 7:15 PM'], ['Seat', 'G12 · Screen 4']);
      if (card.created) rows.push(['Added', fmtFull(card.created)]);
      infoSheet('Pass Details', '', rows);
    } else {
      infoSheet('Card Details', '', [['Card', card.name], ['Cardholder', ownerName()], ['Card Number', '•••• ' + card.last4],
        ['Device Account Number', '•••• ' + card.device], ['Network', card.network],
        [card.kind === 'credit' ? 'Balance' : 'Available', money(S.state.bal[card.id] || 0)]]);
    }
  }

  function txInfo(card, tx) {
    const head = '<div class="wl-txhead"><div class="wl-tx-ic big" style="background:' + esc(tx.c) + '">' + esc(tx.e) + '</div>' +
      '<div class="wl-txhead-a' + (tx.a < 0 ? ' credit' : '') + '">' + (tx.a < 0 ? '+' : '') + money(tx.a) + '</div><div class="wl-txhead-m">' + esc(tx.m) + '</div></div>';
    infoSheet('Transaction', head, [['Status', tx.a < 0 ? 'Completed' : 'Approved'], ['Date', fmtFull(tx.t)], ['Category', tx.w], ['Card', card.name + ' •••• ' + card.last4]]);
  }

  function openAddPass() {
    const draft = { title: '', color: SWATCHES[5], emoji: EMOJI[0], code: '', format: 'qr' };
    let sh = null, wrap = null;
    const close = () => { try { if (sh) sh.close(); } catch (e) { /* already closed */ } };
    const preview = () => {
      if (!wrap) return;
      wrap.querySelector('.wl-prev-in').innerHTML = faceHTML({ kind: 'pass', style: 'custom', title: draft.title.trim() || 'New Pass', color: draft.color, emoji: draft.emoji, code: draft.code.trim() || 'PASS-0000', format: draft.format, created: Date.now() });
    };
    const submit = () => {
      if (!S) { close(); return; }
      const title = draft.title.trim();
      if (!title) {
        OS.haptic('error');
        const row = wrap && wrap.querySelector('.wl-row-title');
        if (row) { row.classList.remove('shake'); void row.offsetWidth; row.classList.add('shake'); const inp = row.querySelector('input'); if (inp) inp.focus(); }
        return;
      }
      const rnd = () => String(1000 + Math.floor(Math.random() * 9000));
      const pass = { id: 'p_' + OS.util.uid(), title: title, color: draft.color, emoji: draft.emoji || EMOJI[0], code: draft.code.trim() || ('PASS-' + rnd() + '-' + rnd()), format: draft.format, created: Date.now() };
      S.passes.push(pass);
      savePasses();
      if (document.activeElement && document.activeElement.blur) document.activeElement.blur();
      close();
      if (S.sel != null) deselect();
      buildCards(pass.id);
      OS.haptic('success');
      later(() => { const sc = S.els.scroller; try { sc.scrollTo({ top: sc.scrollHeight, behavior: 'smooth' }); } catch (e) { sc.scrollTop = sc.scrollHeight; } }, 60, S.uiTimers);
    };
    sh = OS.ui.sheet({
      title: 'Add Pass', height: 'large',
      left: { label: 'Cancel', onTap: close }, right: { label: 'Add', bold: true, onTap: submit },
      render(body, sheet) {
        sh = sh || sheet;
        body.innerHTML = '<div class="wl-sheet wl-addpass">' +
          '<div class="wl-prev"><div class="wl-prev-in"></div></div>' +
          '<div class="ios-list">' +
          '<div class="ios-row wl-row-title"><span class="ios-row-label">Title</span><input class="wl-in" data-f="title" placeholder="Library Card" maxlength="28" enterkeyhint="next" autocomplete="off"></div>' +
          '<div class="ios-row"><span class="ios-row-label">Code</span><input class="wl-in" data-f="code" placeholder="Optional — made for you" maxlength="40" enterkeyhint="done" autocomplete="off" autocapitalize="characters"></div>' +
          '</div>' +
          '<div class="ios-list-header">Code Style</div>' +
          '<div class="wl-segwrap"><div class="ios-seg"><button class="on" data-fmt="qr">QR Code</button><button data-fmt="bar">Barcode</button></div></div>' +
          '<div class="ios-list-header">Colour</div>' +
          '<div class="wl-swatches">' + SWATCHES.map((c) => '<button class="wl-swatch' + (c === draft.color ? ' on' : '') + '" data-col="' + c + '" style="--c:' + c + '" aria-label="Colour"></button>').join('') + '</div>' +
          '<div class="ios-list-header">Emoji</div>' +
          '<div class="wl-emojis">' + EMOJI.map((e) => '<button class="wl-emoji' + (e === draft.emoji ? ' on' : '') + '" data-emo="' + e + '">' + e + '</button>').join('') + '</div>' +
          '<div class="ios-list wl-gap"><div class="ios-row"><span class="ios-row-label">Custom Emoji</span><input class="wl-in" data-f="emoji" placeholder="Type one" maxlength="8" enterkeyhint="done" autocomplete="off"></div></div>' +
          '<div class="ios-list-footer">Passes you make here stay on this iPhone. The code pattern is generated from your code text.</div>' +
          '</div>';
        wrap = body.querySelector('.wl-addpass');
        wrap.addEventListener('input', (e) => {
          const f = e.target && e.target.dataset ? e.target.dataset.f : null;
          if (!f) return;
          if (f === 'emoji') {
            const g = firstGrapheme(e.target.value);
            if (g) { draft.emoji = g; wrap.querySelectorAll('.wl-emoji').forEach((b) => b.classList.toggle('on', b.dataset.emo === g)); }
          } else draft[f] = e.target.value;
          preview();
        });
        wrap.addEventListener('keydown', (e) => {
          if (e.key !== 'Enter' || !e.target.dataset) return;
          if (e.target.dataset.f === 'title') { const n = wrap.querySelector('[data-f="code"]'); if (n) n.focus(); } else if (e.target.blur) e.target.blur();
        });
        wrap.addEventListener('click', (e) => {
          const sw = e.target.closest('.wl-swatch'), em = e.target.closest('.wl-emoji'), fm = e.target.closest('[data-fmt]');
          if (sw) { draft.color = sw.dataset.col; wrap.querySelectorAll('.wl-swatch').forEach((b) => b.classList.toggle('on', b === sw)); }
          else if (em) { draft.emoji = em.dataset.emo; wrap.querySelectorAll('.wl-emoji').forEach((b) => b.classList.toggle('on', b === em)); const ci = wrap.querySelector('[data-f="emoji"]'); if (ci) ci.value = ''; }
          else if (fm) { draft.format = fm.dataset.fmt; wrap.querySelectorAll('[data-fmt]').forEach((b) => b.classList.toggle('on', b === fm)); }
          else return;
          OS.haptic('selection');
          preview();
        });
        preview();
      },
    });
  }

  /* ───────────────────────── menus ───────────────────────── */
  const IC = {
    info: '<svg class="sf" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><circle cx="12" cy="12" r="9.500"/><path d="M12 11v6M12 7.500v.200"/></svg>',
    copy: '<svg class="sf" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linejoin="round"><rect x="8" y="8" width="12" height="13" rx="2.500"/><path d="M16 8V5.500A2.500 2.500 0 0 0 13.500 3h-7A2.500 2.500 0 0 0 4 5.500v8A2.500 2.500 0 0 0 6.500 16H8"/></svg>',
    plus: '<svg class="sf" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.200" stroke-linecap="round"><path d="M12 5v14M5 12h14"/></svg>',
    reset: '<svg class="sf" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M4 12a8 8 0 1 0 2.600-5.900"/><path d="M4 4v4.500h4.500"/></svg>',
    trash: '<svg class="sf" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M4 7h16M9.500 7V4.500h5V7M6.500 7l1 13h9l1-13"/></svg>',
  };

  function openMenu(anchor) {
    const card = cardById(S.sel);
    if (!card) return;
    const items = [];
    if (card.kind === 'pass') {
      items.push({ label: 'Pass Details', icon: IC.info, onTap: () => cardInfo(card) });
      items.push({ label: 'Copy Code', icon: IC.copy, onTap: () => copyText(card.code || '') });
      if (card.style === 'custom') items.push({ label: 'Remove Pass', icon: IC.trash, style: 'destructive', onTap: () => removePass(card) });
    } else {
      items.push({ label: 'Card Details', icon: IC.info, onTap: () => cardInfo(card) });
      if (card.kind === 'credit') items.push({ label: 'Pay Card', icon: IC.plus, onTap: () => payCard(card) });
      else items.push({ label: 'Add Money', icon: IC.plus, onTap: () => addMoney(card) });
      items.push({ label: 'Reset Transactions', icon: IC.reset, style: 'destructive', onTap: () => resetCard(card) });
    }
    OS.haptic('light');
    if (OS.ui && typeof OS.ui.contextMenu === 'function') { OS.ui.contextMenu(anchor, items); return; }
    OS.ui.actionSheet({ title: card.name, buttons: items.map((i) => ({ label: i.label, style: i.style })), cancel: 'Cancel' })
      .then((i) => { if (i >= 0 && items[i] && S) items[i].onTap(); });
  }

  /* ───────────────────────── events ───────────────────────── */
  function onDetailClick(e) {
    const card = cardById(S.sel);
    if (!card) return;
    const actEl = e.target.closest('[data-act]');
    if (actEl) {
      const act = actEl.dataset.act;
      if (act === 'pay') startPay();
      else if (act === 'addmoney') addMoney(card);
      else if (act === 'paycard') payCard(card);
      else if (act === 'stamp') collectStamp();
      else if (act === 'passinfo') cardInfo(card);
      else if (act === 'remove') removePass(card);
      else if (act === 'directions') {
        if (OS.isInstalled && OS.isInstalled('maps')) OS.openApp('maps', { query: 'movie theater' });
        else OS.ui.toast('Starlight Cinemas · 12 Comet Ave');
      }
      return;
    }
    const row = e.target.closest('.wl-tx[data-tx]');
    if (row) {
      const tx = (S.tx[card.id] || []).find((t) => t.id === row.dataset.tx);
      if (tx) txInfo(card, tx);
    }
  }

  function onDetailChange(e) {
    const opt = e.target && e.target.dataset ? e.target.dataset.opt : null;
    if (!opt || S.sel == null) return;
    optsFor(S.sel)[opt] = !!e.target.checked;
    saveState();
    OS.haptic('selection');
  }

  /* ───────────────────────── lifecycle ───────────────────────── */
  function launch(ctx) {
    S = { ctx: ctx, sel: null, paying: false, popStamp: -1, timers: new Set(), payTimers: new Set(), uiTimers: new Set(), cards: [], els: {}, moved: false, down: null };
    loadData();
    ctx.root.innerHTML =
      '<div class="wl-scroller ios-scroll"><div class="wl-stage">' +
      '<div class="wl-header"><div class="wl-title">Wallet</div>' +
      '<button class="wl-round pressable" data-act="add" aria-label="Add"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.400" stroke-linecap="round"><path d="M12 5v14M5 12h14"/></svg></button></div>' +
      '</div></div>' +
      '<div class="wl-topbar"><button class="wl-pillbtn pressable" data-act="done">Done</button>' +
      '<button class="wl-round pressable" data-act="more" aria-label="More"><svg viewBox="0 0 24 24" fill="currentColor"><circle cx="5" cy="12" r="2"/><circle cx="12" cy="12" r="2"/><circle cx="19" cy="12" r="2"/></svg></button></div>' +
      '<div class="wl-detail ios-scroll"></div>';
    const els = S.els;
    els.scroller = ctx.root.querySelector('.wl-scroller');
    els.stage = ctx.root.querySelector('.wl-stage');
    els.header = ctx.root.querySelector('.wl-header');
    els.topbar = ctx.root.querySelector('.wl-topbar');
    els.detail = ctx.root.querySelector('.wl-detail');

    // ignore the click that ends a drag-scroll
    els.scroller.addEventListener('pointerdown', (e) => { S.down = { x: e.clientX, y: e.clientY }; S.moved = false; });
    els.scroller.addEventListener('pointermove', (e) => { if (S.down && Math.abs(e.clientX - S.down.x) + Math.abs(e.clientY - S.down.y) > 8) S.moved = true; });
    els.scroller.addEventListener('pointerup', () => { S.down = null; });
    els.scroller.addEventListener('pointercancel', () => { S.down = null; });

    els.stage.addEventListener('click', (e) => {
      if (S.moved) { S.moved = false; return; }
      if (e.target.closest('[data-act="add"]')) { OS.haptic('light'); openAddPass(); return; }
      const cardEl = e.target.closest('.wl-card');
      if (!cardEl) return;
      const id = cardEl.dataset.id;
      if (S.sel == null) select(id);
      else if (id !== S.sel) { OS.haptic('light'); deselect(); }
    });
    els.stage.addEventListener('dblclick', (e) => {
      const cardEl = e.target.closest('.wl-card');
      if (cardEl && S.sel != null && cardEl.dataset.id === S.sel) startPay();
    });
    els.topbar.addEventListener('click', (e) => {
      const b = e.target.closest('[data-act]');
      if (!b) return;
      if (b.dataset.act === 'done') deselect(); else openMenu(b);
    });
    els.detail.addEventListener('click', onDetailClick);
    els.detail.addEventListener('change', onDetailChange);

    S.onOwner = () => { if (S) refreshAllFaces(); };
    OS.on('setting:ownerName', S.onOwner);
    buildCards();
  }

  function onResume(ctx, params) {
    if (!S) return;
    refreshAllFaces();
    if (S.sel != null) {
      S.els.detail.classList.add('show');
      if (!S.paying) refreshMoneyUI(false);
    }
    if (params && params.cardId && cardById(params.cardId) && S.sel !== params.cardId) {
      if (S.sel != null) deselect();
      select(params.cardId);
    }
  }

  function onPause() {
    if (!S) return;
    resetPay();
    if (S.sel != null) { clearBag(S.uiTimers); S.els.detail.classList.add('show'); }
  }

  function onClose() {
    if (!S) return;
    clearBag(S.timers); clearBag(S.payTimers); clearBag(S.uiTimers);
    OS.off('setting:ownerName', S.onOwner);
    S = null;
  }

  /* ───────────────────────── styles ───────────────────────── */
  OS.addStyle('wallet', `
    .app-wallet { background: var(--bg2); color: var(--label); }
    .app-wallet button { font-family: inherit; cursor: pointer; -webkit-tap-highlight-color: transparent; }
    .app-wallet .wl-scroller { position: absolute; inset: 0; }
    .app-wallet .wl-scroller.locked { overflow: hidden !important; }
    .app-wallet .wl-stage { position: relative; width: 402px; min-height: 874px; overflow: hidden; }
    .app-wallet .wl-header { position: absolute; left: 0; right: 0; top: 0; box-sizing: border-box; padding: calc(var(--safe-top) + 6px) 16px 0 16px;
      display: flex; align-items: center; justify-content: space-between; transition: opacity .2s ease; }
    .app-wallet.sel .wl-header { opacity: 0; pointer-events: none; }
    .app-wallet .wl-stage.no-anim .wl-header, .app-wallet .wl-stage.no-anim .wl-card { transition: none !important; }
    .app-wallet .wl-title { font-size: 34px; font-weight: 700; letter-spacing: .37px; }
    .app-wallet .wl-round { width: 34px; height: 34px; border-radius: 50%; border: 0; padding: 0; background: var(--fill); color: var(--label);
      display: flex; align-items: center; justify-content: center; }
    .app-wallet .wl-round svg { width: 19px; height: 19px; }
    .app-wallet .wl-topbar { position: absolute; left: 0; right: 0; top: var(--safe-top); height: 44px; padding: 0 16px; box-sizing: border-box; z-index: 5;
      display: flex; align-items: center; justify-content: space-between; opacity: 0; pointer-events: none; transition: opacity .2s ease; }
    .app-wallet.sel .wl-topbar { opacity: 1; pointer-events: auto; transition-delay: .12s; }
    .app-wallet .wl-pillbtn { height: 34px; padding: 0 15px; border-radius: 17px; border: 0; background: var(--fill); color: var(--label);
      font-size: 17px; font-weight: 600; letter-spacing: -.4px; }

    .app-wallet .wl-card { position: absolute; left: 16px; top: 0; width: 370px; border-radius: 14px; cursor: pointer; transform-origin: 50% 0;
      transition: transform .42s cubic-bezier(.32,.72,0,1), opacity .28s ease; will-change: transform;
      box-shadow: 0 -2px 10px rgba(0,0,0,.20), 0 8px 22px rgba(0,0,0,.10); }
    .app-wallet .wl-card.is-sel { cursor: default; box-shadow: 0 10px 30px rgba(0,0,0,.22); }

    /* faces — shared with the Add Pass sheet preview (rendered outside the app root) */
    :is(.app-wallet, .wl-sheet) .wl-face { position: relative; width: 370px; height: 100%; border-radius: 14px; overflow: hidden; box-sizing: border-box; color: #fff;
      user-select: none; -webkit-user-select: none; }
    :is(.app-wallet, .wl-sheet) .wl-face::after { content: ''; position: absolute; inset: 0; border-radius: inherit; pointer-events: none;
      box-shadow: inset 0 0 0 .5px rgba(255,255,255,.28), inset 0 1px 0 rgba(255,255,255,.35); }
    .app-wallet .wl-pay { height: 233px; }

    .app-wallet .wl-nova { color: #4b4b52; background:
      radial-gradient(130px 95px at 80% 28%, rgba(255,159,10,.30), transparent 70%),
      radial-gradient(150px 115px at 62% 78%, rgba(255,55,95,.22), transparent 70%),
      radial-gradient(160px 125px at 28% 58%, rgba(100,210,255,.26), transparent 70%),
      linear-gradient(135deg, #ffffff 0%, #eceef2 45%, #f9f9fb 60%, #dddfe5 100%); }
    .app-wallet .wl-nova::after { box-shadow: inset 0 0 0 .5px rgba(0,0,0,.10), inset 0 1px 0 #fff; }
    .app-wallet .wl-nova-logo { position: absolute; left: 20px; top: 18px; width: 26px; height: 26px; fill: #6c6c74; }
    .app-wallet .wl-nova-word { position: absolute; left: 52px; top: 19px; font-size: 20px; font-weight: 600; letter-spacing: .5px; color: #6c6c74; }
    .app-wallet .wl-nova-name { position: absolute; left: 20px; bottom: 18px; max-width: 230px; font-size: 16px; font-weight: 500; letter-spacing: .2px;
      white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
    .app-wallet .wl-nova-net { position: absolute; right: 20px; bottom: 17px; display: flex; align-items: center; gap: 5px; font-size: 17px; font-weight: 800;
      font-style: italic; letter-spacing: -.3px; color: #7a7a83; }
    .app-wallet .wl-nova-net i { width: 14px; height: 14px; border-radius: 50%; border: 3px solid #7a7a83; border-right-color: transparent; transform: rotate(-30deg); box-sizing: border-box; }

    .app-wallet .wl-sunny { background:
      radial-gradient(circle at 86% 12%, rgba(255,255,255,.34) 0 62px, transparent 63px),
      radial-gradient(circle at 98% 68%, rgba(255,255,255,.17) 0 96px, transparent 97px),
      radial-gradient(circle at 8% 110%, rgba(120,40,200,.35) 0 120px, transparent 121px),
      linear-gradient(135deg, #FF4F8B 0%, #FF8A3D 55%, #FFC93D 100%); }
    .app-wallet .wl-sunny-brand { position: absolute; left: 18px; top: 16px; display: flex; align-items: center; gap: 8px; font-size: 19px; font-weight: 700; letter-spacing: -.3px;
      text-shadow: 0 1px 2px rgba(0,0,0,.15); }
    .app-wallet .wl-sunny-brand svg { width: 28px; height: 28px; }
    .app-wallet .wl-sunny-type { position: absolute; right: 20px; top: 22px; font-size: 12px; font-weight: 700; letter-spacing: 2px; opacity: .95; }
    .app-wallet .wl-sunny-name { position: absolute; left: 20px; bottom: 44px; max-width: 220px; font-size: 13px; font-weight: 600; letter-spacing: .6px; text-transform: uppercase; opacity: .92;
      white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
    .app-wallet .wl-sunny-num { position: absolute; left: 20px; bottom: 17px; font-size: 19px; font-weight: 600; letter-spacing: 1.5px; font-variant-numeric: tabular-nums;
      text-shadow: 0 1px 2px rgba(0,0,0,.18); }
    .app-wallet .wl-sunny-net { position: absolute; right: 20px; bottom: 16px; display: flex; align-items: center; gap: 2px; font-size: 21px; font-weight: 900; font-style: italic; letter-spacing: -.5px; }
    .app-wallet .wl-sunny-net b { display: block; height: 3px; border-radius: 2px; background: #fff; transform: skewX(-18deg); }
    .app-wallet .wl-sunny-net b:nth-child(1) { width: 5px; opacity: .5; } .app-wallet .wl-sunny-net b:nth-child(2) { width: 8px; opacity: .75; }
    .app-wallet .wl-sunny-net b:nth-child(3) { width: 11px; margin-right: 3px; }

    .app-wallet .wl-metro { background: linear-gradient(135deg, #10B78F 0%, #08848C 58%, #0B5A8C 100%); }
    .app-wallet .wl-metro-map { position: absolute; inset: 0; width: 100%; height: 100%; }
    .app-wallet .wl-metro-brand { position: absolute; left: 18px; top: 16px; display: flex; align-items: center; gap: 9px; font-size: 19px; font-weight: 700; letter-spacing: -.3px; }
    .app-wallet .wl-metro-m { width: 28px; height: 28px; border-radius: 50%; background: #fff; color: #08848C; font-size: 17px; font-weight: 900; display: flex; align-items: center; justify-content: center; }
    .app-wallet .wl-metro-bal { position: absolute; right: 20px; top: 14px; text-align: right; }
    .app-wallet .wl-metro-bal small { display: block; font-size: 10px; font-weight: 700; letter-spacing: 1px; opacity: .8; }
    .app-wallet .wl-metro-bal b { font-size: 22px; font-weight: 700; font-variant-numeric: tabular-nums; }
    .app-wallet .wl-metro-foot { position: absolute; left: 20px; right: 20px; bottom: 17px; display: flex; justify-content: space-between; font-size: 14px; font-weight: 600; opacity: .95; }

    :is(.app-wallet, .wl-sheet) .wl-pass { height: 430px; display: flex; flex-direction: column; padding: 0 16px 16px; }
    :is(.app-wallet, .wl-sheet) .wl-pass-head { height: 60px; flex: none; display: flex; align-items: center; gap: 10px; }
    :is(.app-wallet, .wl-sheet) .wl-pass-logo { width: 34px; height: 34px; border-radius: 50%; background: rgba(255,255,255,.2); display: flex; align-items: center; justify-content: center; font-size: 19px; flex: none; }
    :is(.app-wallet, .wl-sheet) .wl-pass-org { flex: 1; min-width: 0; font-size: 18px; font-weight: 600; letter-spacing: -.3px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
    :is(.app-wallet, .wl-sheet) .wl-pass-hf { text-align: right; flex: none; }
    :is(.app-wallet, .wl-sheet) .wl-pass small { display: block; font-size: 10.5px; font-weight: 700; letter-spacing: .8px; opacity: .72; text-transform: uppercase; }
    :is(.app-wallet, .wl-sheet) .wl-pass-hf b { font-size: 18px; font-weight: 500; }
    :is(.app-wallet, .wl-sheet) .wl-pass-primary { padding: 8px 0 12px; position: relative; }
    :is(.app-wallet, .wl-sheet) .wl-pass-primary b { display: block; font-size: 25px; font-weight: 600; letter-spacing: -.4px; line-height: 1.15; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
    :is(.app-wallet, .wl-sheet) .wl-pass-primary span { font-size: 14px; opacity: .8; }
    :is(.app-wallet, .wl-sheet) .wl-pass-fields { display: flex; gap: 14px; justify-content: space-between; padding-bottom: 10px; position: relative; }
    :is(.app-wallet, .wl-sheet) .wl-pass-fields > div { min-width: 0; }
    :is(.app-wallet, .wl-sheet) .wl-pass-fields > div:last-child:not(:first-child) { text-align: right; }
    :is(.app-wallet, .wl-sheet) .wl-pass-fields b { display: block; font-size: 16px; font-weight: 500; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
    :is(.app-wallet, .wl-sheet) .wl-code { margin-top: auto; display: flex; flex-direction: column; align-items: center; gap: 6px; position: relative; }
    :is(.app-wallet, .wl-sheet) .wl-code-tile { background: #fff; border-radius: 8px; padding: 10px; box-sizing: border-box; }
    :is(.app-wallet, .wl-sheet) .wl-code.qr .wl-code-tile { width: 138px; height: 138px; }
    :is(.app-wallet, .wl-sheet) .wl-code.qr svg { width: 100%; height: 100%; display: block; }
    :is(.app-wallet, .wl-sheet) .wl-code.bar .wl-code-tile { width: 290px; padding: 12px 16px 6px; }
    :is(.app-wallet, .wl-sheet) .wl-code.bar svg { width: 100%; height: 58px; display: block; }
    :is(.app-wallet, .wl-sheet) .wl-code-text { color: #000; font-size: 12px; text-align: center; padding-top: 5px; letter-spacing: 1px; font-variant-numeric: tabular-nums; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
    :is(.app-wallet, .wl-sheet) .wl-code-cap { font-size: 12px; opacity: .8; letter-spacing: .6px; max-width: 300px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
    :is(.app-wallet, .wl-sheet) .wl-custom-mark { position: absolute; right: -24px; top: 70px; font-size: 190px; line-height: 1; opacity: .13; transform: rotate(-14deg); pointer-events: none; }

    .app-wallet .wl-coffee { background: radial-gradient(260px 160px at 100% 0%, rgba(255,200,140,.22), transparent 70%), linear-gradient(165deg, #7A5538 0%, #4B2E1E 100%); color: #FFF4E6; }
    .app-wallet .wl-stamps { display: grid; grid-template-columns: repeat(5, 1fr); gap: 8px 0; padding: 2px 0 14px; justify-items: center; }
    .app-wallet .wl-stamp { width: 40px; height: 40px; border-radius: 50%; border: 1.5px dashed rgba(255,244,230,.45); box-sizing: border-box; display: flex; align-items: center; justify-content: center; font-size: 20px; }
    .app-wallet .wl-stamp.on { border: 0; background: #FFF4E6; box-shadow: 0 1px 3px rgba(0,0,0,.3); }
    .app-wallet .wl-stamp em { font-style: normal; font-size: 9.5px; font-weight: 800; letter-spacing: .5px; opacity: .8; }
    .app-wallet .wl-stamp.pop { animation: wl-pop .45s cubic-bezier(.32,.72,0,1); }
    @keyframes wl-pop { 0% { transform: scale(.2) rotate(-40deg); opacity: 0; } 60% { transform: scale(1.18) rotate(6deg); opacity: 1; } 100% { transform: none; } }

    .app-wallet .wl-ticket { color: #F3EEFF; background:
      radial-gradient(1.5px 1.5px at 12% 22%, #fff, transparent), radial-gradient(1.5px 1.5px at 32% 9%, #fff, transparent),
      radial-gradient(1px 1px at 55% 17%, #fff, transparent), radial-gradient(1.5px 1.5px at 78% 28%, #fff, transparent),
      radial-gradient(1px 1px at 90% 12%, #fff, transparent), radial-gradient(1px 1px at 22% 38%, #fff, transparent),
      radial-gradient(1.5px 1.5px at 66% 40%, #fff, transparent), radial-gradient(1px 1px at 44% 31%, #fff, transparent),
      radial-gradient(220px 140px at 85% 0%, rgba(255,110,199,.30), transparent 70%),
      linear-gradient(170deg, #181C4A 0%, #3A1F6E 100%);
      -webkit-mask: radial-gradient(circle 11px at 50% 0, transparent 10.5px, #000 11px); mask: radial-gradient(circle 11px at 50% 0, transparent 10.5px, #000 11px); }
    .app-wallet .wl-ticket .wl-pass-primary b { white-space: normal; font-size: 23px; }

    /* detail panel */
    .app-wallet .wl-detail { position: absolute; left: 0; right: 0; top: 355px; bottom: 84px; z-index: 4; box-sizing: border-box; padding-bottom: 22px;
      opacity: 0; transform: translateY(26px); pointer-events: none; transition: opacity .22s ease, transform .38s cubic-bezier(.32,.72,0,1);
      -webkit-mask-image: linear-gradient(#000 calc(100% - 20px), transparent); mask-image: linear-gradient(#000 calc(100% - 20px), transparent); }
    .app-wallet .wl-detail.show { opacity: 1; transform: none; pointer-events: auto; }
    .app-wallet .wl-detail .ios-list { margin-left: 16px; margin-right: 16px; }
    .app-wallet .wl-gap { margin-top: 16px; }
    .app-wallet .wl-lh { margin-top: 18px; }
    .app-wallet .wl-btnwrap { padding: 2px 16px 14px; }
    .app-wallet .wl-wide { width: 100%; }
    .app-wallet .wl-sw { margin-left: auto; }
    .app-wallet .wl-remove { color: var(--red); justify-content: center; font-size: 17px; }

    .app-wallet .wl-payzone { position: relative; height: 146px; }
    .app-wallet .wl-pz { position: absolute; inset: 0; display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 8px;
      opacity: 0; transform: scale(.82); pointer-events: none; transition: opacity .25s ease, transform .35s cubic-bezier(.32,.72,0,1);
      font-size: 17px; font-weight: 600; letter-spacing: -.4px; color: var(--label); }
    .app-wallet .wl-payzone[data-state="idle"] .wl-pz.idle, .app-wallet .wl-payzone[data-state="face"] .wl-pz.face,
    .app-wallet .wl-payzone[data-state="hold"] .wl-pz.hold, .app-wallet .wl-payzone[data-state="done"] .wl-pz.done,
    .app-wallet .wl-payzone[data-state="fail"] .wl-pz.fail { opacity: 1; transform: none; pointer-events: auto; }
    .app-wallet .wl-pz svg { width: 58px; height: 58px; }
    .app-wallet .wl-pz.idle { gap: 7px; }
    .app-wallet .wl-pz.idle .wl-reader { width: 40px; height: 40px; color: var(--label3); }
    .app-wallet .wl-paybtn { height: 46px; padding: 0 22px 0 16px; border: 0; border-radius: 23px; background: var(--label); color: var(--bg);
      font-size: 17px; font-weight: 600; letter-spacing: -.4px; display: flex; align-items: center; gap: 8px; }
    .app-wallet .wl-paybtn .wl-side { width: 22px; height: 22px; }
    .app-wallet .wl-side-btn { animation: wl-dbl 2.4s ease-in-out infinite; }
    @keyframes wl-dbl { 0%, 8%, 16%, 24%, 100% { transform: translateX(0); } 4%, 20% { transform: translateX(-1.6px); } }
    .app-wallet .wl-pz-hint { font-size: 12px; font-weight: 400; color: var(--label2); letter-spacing: 0; }
    .app-wallet .wl-pz.face, .app-wallet .wl-pz.hold, .app-wallet .wl-pz.done { color: var(--tint); }
    .app-wallet .wl-pz.face span, .app-wallet .wl-pz.hold span, .app-wallet .wl-pz.done span { color: var(--label); }
    .app-wallet .wl-pz.fail { color: var(--red); }
    .app-wallet .wl-payzone[data-state="face"] .wl-faceid { animation: wl-nod 1.3s ease-in-out infinite; }
    .app-wallet .wl-payzone[data-state="face"] .wl-faceid .eye { animation: wl-blink 1.3s ease-in-out infinite; transform-origin: 32px 27px; }
    @keyframes wl-nod { 0%, 100% { transform: perspective(220px) rotateY(-26deg); } 50% { transform: perspective(220px) rotateY(26deg); } }
    @keyframes wl-blink { 0%, 40%, 60%, 100% { transform: scaleY(1); } 50% { transform: scaleY(.15); } }
    .app-wallet .wl-payzone[data-state="hold"] .wl-reader { animation: wl-near 1.2s ease-in-out infinite; }
    .app-wallet .wl-payzone[data-state="hold"] .wl-reader .w1 { animation: wl-wave 1.2s ease-in-out infinite; }
    .app-wallet .wl-payzone[data-state="hold"] .wl-reader .w2 { animation: wl-wave 1.2s ease-in-out .15s infinite; }
    .app-wallet .wl-payzone[data-state="hold"] .wl-reader .w3 { animation: wl-wave 1.2s ease-in-out .3s infinite; }
    @keyframes wl-wave { 0%, 100% { opacity: .15; } 45% { opacity: 1; } }
    @keyframes wl-near { 0%, 100% { transform: translateX(-3px); } 50% { transform: translateX(3px); } }
    .app-wallet .wl-check circle { stroke-dasharray: 170; stroke-dashoffset: 170; }
    .app-wallet .wl-check path { stroke-dasharray: 40; stroke-dashoffset: 40; }
    .app-wallet .wl-payzone[data-state="done"] .wl-check circle { animation: wl-draw .45s cubic-bezier(.32,.72,0,1) forwards; }
    .app-wallet .wl-payzone[data-state="done"] .wl-check path { animation: wl-draw .3s cubic-bezier(.32,.72,0,1) .3s forwards; }
    @keyframes wl-draw { to { stroke-dashoffset: 0; } }
    .app-wallet .wl-payzone[data-state="fail"] .wl-failg { animation: wl-shake .4s ease; }
    @keyframes wl-shake { 0%, 100% { transform: translateX(0); } 20%, 60% { transform: translateX(-7px); } 40%, 80% { transform: translateX(7px); } }

    .app-wallet .wl-summary { margin: 4px 16px 0; padding: 13px 16px; border-radius: 12px; background: var(--cell); display: flex; align-items: center; justify-content: space-between; gap: 12px; }
    .app-wallet .wl-sum-l { font-size: 13px; color: var(--label2); }
    .app-wallet .wl-sum-v { font-size: 28px; font-weight: 700; letter-spacing: -.5px; font-variant-numeric: tabular-nums; line-height: 1.2; }
    .app-wallet .wl-sum-s { font-size: 12px; color: var(--label2); }
    .app-wallet .wl-sum-btn { flex: none; }

    .app-wallet .wl-tx { display: flex; align-items: center; gap: 12px; padding: 9px 14px 9px 14px; min-height: 60px; box-sizing: border-box; }
    .app-wallet .wl-tx-empty { justify-content: center; color: var(--label2); font-size: 15px; }
    :is(.app-wallet, .wl-sheet) .wl-tx-ic { width: 40px; height: 40px; border-radius: 10px; flex: none; display: flex; align-items: center; justify-content: center; font-size: 21px; }
    .app-wallet .wl-tx-main { flex: 1; min-width: 0; }
    .app-wallet .wl-tx-m { font-size: 17px; font-weight: 600; letter-spacing: -.4px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
    .app-wallet .wl-tx-s { font-size: 13px; color: var(--label2); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
    .app-wallet .wl-tx-a { font-size: 17px; font-variant-numeric: tabular-nums; letter-spacing: -.4px; flex: none; }
    .app-wallet .wl-tx-a.credit { color: var(--green); }
    .app-wallet .wl-chev { width: 8px; height: 13px; color: var(--label3); flex: none; margin-left: auto; }
    .app-wallet .wl-tx .wl-chev { margin-left: 0; }
    .app-wallet .wl-tx.new { animation: wl-newrow .7s cubic-bezier(.32,.72,0,1); }
    @keyframes wl-newrow { 0% { opacity: 0; transform: translateY(-14px); background: var(--fill); } 60% { opacity: 1; transform: none; background: var(--fill); } 100% { background: transparent; } }

    /* sheets (rendered by OS.ui.sheet, outside the app root) */
    .wl-sheet { padding: 8px 0 calc(var(--kb-h, 0px) + 40px); color: var(--label); }
    .wl-sheet button { font-family: inherit; cursor: pointer; }
    .wl-sheet .wl-val { max-width: 200px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
    .wl-sheet .wl-gap { margin-top: 16px; }
    .wl-sheet .wl-txhead { display: flex; flex-direction: column; align-items: center; gap: 4px; padding: 6px 16px 18px; }
    .wl-sheet .wl-tx-ic.big { width: 60px; height: 60px; border-radius: 15px; font-size: 32px; margin-bottom: 6px; }
    .wl-sheet .wl-txhead-a { font-size: 34px; font-weight: 700; letter-spacing: -.5px; font-variant-numeric: tabular-nums; }
    .wl-sheet .wl-txhead-a.credit { color: var(--green); }
    .wl-sheet .wl-txhead-m { font-size: 17px; color: var(--label2); text-align: center; }
    .wl-sheet .wl-prev { width: 204px; height: 237px; margin: 4px auto 18px; position: relative; border-radius: 8px; box-shadow: 0 8px 24px rgba(0,0,0,.22); }
    .wl-sheet .wl-prev-in { position: absolute; left: 0; top: 0; width: 370px; height: 430px; transform: scale(.5514); transform-origin: 0 0; }
    .wl-sheet .wl-in { flex: 1; min-width: 0; border: 0; outline: 0; background: none; font: inherit; font-size: 17px; color: var(--label); text-align: right; padding: 0 0 0 12px; height: 44px; }
    .wl-sheet .wl-in::placeholder { color: var(--label3); }
    .wl-sheet .wl-segwrap { padding: 0 16px; }
    .wl-sheet .wl-swatches { display: flex; flex-wrap: wrap; gap: 11px; padding: 4px 20px 2px; }
    .wl-sheet .wl-swatch { width: 38px; height: 38px; border-radius: 50%; border: 0; padding: 0; background: var(--c); position: relative; }
    .wl-sheet .wl-swatch.on::after { content: ''; position: absolute; inset: -4px; border-radius: 50%; border: 2.5px solid var(--c); }
    .wl-sheet .wl-emojis { display: grid; grid-template-columns: repeat(6, 1fr); gap: 8px; padding: 4px 16px 2px; }
    .wl-sheet .wl-emoji { height: 46px; border-radius: 12px; border: 0; background: var(--cell2); font-size: 24px; padding: 0; transition: transform .25s cubic-bezier(.32,.72,0,1); }
    .wl-sheet .wl-emoji.on { background: var(--fill); box-shadow: inset 0 0 0 2px var(--tint); transform: scale(1.04); }
    .wl-sheet .shake { animation: wl-shake .4s ease; }
  `);

  OS.registerApp({
    id: 'wallet',
    name: 'Wallet',
    icon: {
      bg: 'linear-gradient(180deg,#2A2A2D 0%,#000 100%)',
      glyph: '<svg viewBox="0 0 60 60">' +
        '<rect x="9" y="11.500" width="42" height="30" rx="4.500" fill="#32A4F5"/>' +
        '<rect x="9" y="17.500" width="42" height="30" rx="4.500" fill="#FFC800"/>' +
        '<rect x="9" y="23.500" width="42" height="28" rx="4.500" fill="#34C759"/>' +
        '<rect x="9" y="29.500" width="42" height="22" rx="4.500" fill="#FF4B42"/>' +
        '<rect x="9" y="16.700" width="42" height=".8" fill="#000" opacity=".16"/><rect x="9" y="22.700" width="42" height=".8" fill="#000" opacity=".16"/><rect x="9" y="28.700" width="42" height=".8" fill="#000" opacity=".16"/>' +
        '<path d="M9 35.500h13.200c1.700 0 2.700.9 3.500 2.200 1 1.700 2.400 2.900 4.300 2.900s3.300-1.200 4.300-2.900c.8-1.300 1.800-2.200 3.500-2.200H51V45a4.500 4.500 0 0 1-4.500 4.500h-33A4.500 4.500 0 0 1 9 45z" fill="#E6E6EB"/>' +
        '<path d="M9 35.500h13.200c1.700 0 2.700.9 3.500 2.200 1 1.700 2.400 2.900 4.300 2.900s3.300-1.200 4.300-2.900c.8-1.300 1.800-2.200 3.500-2.200H51" fill="none" stroke="#000" stroke-opacity=".14" stroke-width=".8"/>' +
        '</svg>',
    },
    system: true,
    statusBar: 'auto',
    background: 'var(--bg2)',
    launch: launch,
    onResume: onResume,
    onPause: onPause,
    onClose: onClose,
  });
})();
