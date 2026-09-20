// Safari — real browsing. Sites that allow framing load directly; the rest come through the server's /proxy.
(function () {
  const { el, esc, uid } = OS.util;
  const FAVORITES = [
    { t: 'Wikipedia', u: 'https://en.m.wikipedia.org/', c: '#f2f2f2', g: 'W', fg: '#111' },
    { t: 'DuckDuckGo', u: 'https://duckduckgo.com/', c: '#de5833', g: '🦆' },
    { t: 'Scratch', u: 'https://scratch.mit.edu/', c: '#f9a825', g: 'S' },
    { t: 'NASA', u: 'https://www.nasa.gov/', c: '#0b3d91', g: '🚀' },
    { t: 'Hacker News', u: 'https://news.ycombinator.com/', c: '#ff6600', g: 'Y' },
    { t: 'MDN', u: 'https://developer.mozilla.org/', c: '#111', g: 'M' },
    { t: 'StateLocater', u: 'https://statelocater.apps.tas-ndc.kuhn-labs.com/', c: '#2e7d32', g: '🗺️' },
    { t: 'BlockBuddy', u: 'https://blockbuddy.apps.tas-ndc.kuhn-labs.com/', c: '#7e57c2', g: '🧩' },
  ];
  const SEARCH = (q) => 'https://html.duckduckgo.com/html/?q=' + encodeURIComponent(q);

  OS.addStyle('safari', `
    .app-safari{background:var(--bg2)}
    .app-safari .sf-top{position:absolute;left:0;right:0;top:0;height:54px;background:var(--sf-theme,var(--bg));transition:background .3s}
    .app-safari .sf-view{position:absolute;left:0;right:0;top:54px;bottom:84px;background:var(--bg)}
    .app-safari .sf-view iframe{position:absolute;inset:0;width:100%;height:100%;border:0;background:#fff}
    .app-safari .sf-start{position:absolute;inset:0;padding:26px 22px 40px;background:var(--bg2)}
    .app-safari .sf-start h2{font-size:22px;font-weight:700;margin:6px 4px 14px;letter-spacing:.3px}
    .app-safari .sf-favs{display:grid;grid-template-columns:repeat(4,1fr);gap:18px 8px;margin-bottom:26px}
    .app-safari .sf-fav{text-align:center;font-size:12px;cursor:pointer;color:var(--label);letter-spacing:-.1px} .app-safari .sf-fav i{display:flex;align-items:center;justify-content:center;width:62px;height:62px;border-radius:14px;margin:0 auto 6px;font-style:normal;font-size:30px;font-weight:700;color:#fff;box-shadow:0 1px 4px rgba(0,0,0,.12)}
    .app-safari .sf-fav:active i{filter:brightness(.8)} .app-safari .sf-fav span{display:block;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
    .app-safari .sf-card{background:var(--cell);border-radius:14px;padding:14px 16px;margin-bottom:22px;font-size:15px;display:flex;gap:12px;align-items:center}.app-safari .sf-card b{font-size:28px;font-weight:700}
    .app-safari .sf-bar{position:absolute;left:0;right:0;bottom:0;height:84px;padding:8px 12px 0;display:flex;gap:8px;align-items:flex-start;background:var(--bar);backdrop-filter:var(--blur);-webkit-backdrop-filter:var(--blur);box-shadow:0 -.5px 0 var(--sep);transition:bottom .3s var(--ease);z-index:5}
    .app-safari.kb .sf-bar{bottom:calc(var(--kb-h) - 30px)}
    .app-safari .sf-rb{width:44px;height:44px;border-radius:22px;background:var(--cell);box-shadow:0 1px 5px rgba(0,0,0,.1);display:flex;align-items:center;justify-content:center;color:var(--label);flex:none;cursor:pointer;transition:transform .15s,opacity .2s}
    .app-safari .sf-rb:active{transform:scale(.9)} .app-safari .sf-rb.off{opacity:.35;pointer-events:none} .app-safari .sf-rb svg{width:22px;height:22px;fill:none;stroke:currentColor;stroke-width:2.200;stroke-linecap:round;stroke-linejoin:round}
    .app-safari .sf-pill{position:relative;flex:1;min-width:0;height:44px;border-radius:22px;background:var(--cell);box-shadow:0 1px 5px rgba(0,0,0,.1);display:flex;align-items:center;padding:0 6px 0 14px;gap:6px;overflow:hidden}
    .app-safari .sf-pill input{flex:1;min-width:0;border:0;background:none;font-size:16px;text-align:center;text-overflow:ellipsis} .app-safari.kb .sf-pill input{text-align:left}
    .app-safari .sf-pill .lk{width:11px;height:14px;flex:none;fill:var(--label2)} .app-safari.kb .sf-pill .lk{display:none}
    .app-safari .sf-reload{width:32px;height:32px;display:flex;align-items:center;justify-content:center;cursor:pointer;color:var(--label);flex:none} .app-safari .sf-reload svg{width:17px;height:17px;fill:none;stroke:currentColor;stroke-width:2.200;stroke-linecap:round;stroke-linejoin:round}
    .app-safari .sf-prog{position:absolute;left:0;bottom:0;height:2.500px;background:var(--tint);width:0;opacity:0;transition:width .3s,opacity .3s}
    .app-safari .sf-tabs{position:absolute;inset:0;z-index:8;background:var(--bg2);display:none;flex-direction:column}.app-safari .sf-tabs.on{display:flex}
    .app-safari .sf-tabgrid{flex:1;padding:70px 16px 20px;display:grid;grid-template-columns:1fr 1fr;gap:18px 14px;align-content:start}
    .app-safari .sf-tcard{cursor:pointer;animation:sfpop .3s var(--ease)}@keyframes sfpop{from{transform:scale(.8);opacity:0}}
    .app-safari .sf-tcard .pv{position:relative;height:210px;border-radius:14px;background:var(--cell);box-shadow:0 3px 14px rgba(0,0,0,.14);overflow:hidden;display:flex;align-items:center;justify-content:center;font-size:64px;font-weight:700;color:var(--label3)}
    .app-safari .sf-tcard.cur .pv{outline:3px solid var(--tint);outline-offset:1px}
    .app-safari .sf-tcard .x{position:absolute;right:7px;top:7px;width:24px;height:24px;border-radius:50%;background:var(--fill);display:flex;align-items:center;justify-content:center;font-size:13px;font-weight:700;color:var(--label2)}
    .app-safari .sf-tcard .nm{font-size:13px;text-align:center;margin-top:7px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;font-weight:500}
    .app-safari .sf-tbar{height:88px;padding:0 20px 34px;display:flex;align-items:center;justify-content:space-between;background:var(--bar);box-shadow:0 -.5px 0 var(--sep);font-size:17px}
    .app-safari .sf-tbar b{font-weight:600} .app-safari .sf-tbar span{color:var(--tint);cursor:pointer;min-width:50px} .app-safari .sf-tbar span:last-child{text-align:right;font-weight:600}
    .app-safari .sf-err{position:absolute;inset:0;display:flex;flex-direction:column;align-items:center;justify-content:center;text-align:center;padding:40px;color:var(--label2);background:var(--bg)} .app-safari .sf-err h3{color:var(--label);font-size:22px;margin:0 0 8px}
  `);

  const ICON = { back: '<svg viewBox="0 0 24 24"><path d="M15 4.500 7.500 12l7.500 7.500"/></svg>', fwd: '<svg viewBox="0 0 24 24"><path d="M9 4.500 16.500 12 9 19.500"/></svg>', more: '<svg viewBox="0 0 24 24"><circle cx="5" cy="12" r="1.300" fill="currentColor"/><circle cx="12" cy="12" r="1.300" fill="currentColor"/><circle cx="19" cy="12" r="1.300" fill="currentColor"/></svg>',
    reload: '<svg viewBox="0 0 24 24"><path d="M19.500 12a7.500 7.500 0 1 1-2.400-5.500M19.500 4v4.500H15"/></svg>', stop: '<svg viewBox="0 0 24 24"><path d="M6 6l12 12M18 6 6 18"/></svg>', lock: '<svg class="lk" viewBox="0 0 11 14"><rect x="0" y="6" width="11" height="8" rx="2"/><path d="M2.500 6V4a3 3 0 0 1 6 0v2" fill="none" stroke="var(--label2)" stroke-width="1.500"/></svg>' };

  let ctx, root, view, input, prog, tabs = [], cur = null, loadToken = 0;
  const state = () => OS.store.get('safari', { bookmarks: [], history: [] });
  const saveState = (s) => OS.store.set('safari', s);

  function normalize(text) {
    text = String(text || '').trim(); if (!text) return null;
    if (/^https?:\/\//i.test(text)) return text;
    if (/^(localhost|\d{1,3}(\.\d{1,3}){3})(:\d+)?(\/|$)/i.test(text)) return 'http://' + text;
    if (/^[^\s]+\.[a-z]{2,}(:\d+)?(\/\S*)?$/i.test(text)) return 'https://' + text;
    return SEARCH(text);
  }
  function unwrap(url) {   // DuckDuckGo result links are redirects — go straight to the target
    try { const u = new URL(url); if (/duckduckgo\.com$/.test(u.hostname) && u.pathname === '/l/' && u.searchParams.get('uddg')) return u.searchParams.get('uddg'); if (u.hostname === 'duckduckgo.com' && u.searchParams.get('q') && (u.pathname === '/' || u.pathname === '/html' || u.pathname === '/html/')) return SEARCH(u.searchParams.get('q')); } catch {}
    return url;
  }
  const host = (u) => { try { return new URL(u).hostname.replace(/^www\.|^en\.m\.|^m\./, ''); } catch { return u; } };
  const display = (t) => { if (!t.url) return ''; try { const u = new URL(t.url); if (u.hostname === 'html.duckduckgo.com') return u.searchParams.get('q') || 'duckduckgo.com'; } catch {} return host(t.url); };

  function newTab(url) { const t = { id: uid(), url: null, title: 'Start Page', hist: [], idx: -1, frame: null, mode: null }; tabs.push(t); select(t); if (url) go(url); else showStart(); return t; }
  function select(t) { cur = t; view.querySelectorAll('iframe').forEach((f) => { f.style.display = f === t.frame ? '' : 'none'; }); const st = view.querySelector('.sf-start'); if (st) st.style.display = t.url ? 'none' : ''; if (!t.url) showStart(); sync(); }
  function closeTab(t) { t.frame && t.frame.remove(); tabs = tabs.filter((x) => x !== t); if (!tabs.length) newTab(); else if (cur === t) select(tabs[tabs.length - 1]); }

  function showStart() {
    let st = view.querySelector('.sf-start');
    if (!st) { st = el('<div class="sf-start ios-scroll"></div>'); view.appendChild(st); }
    st.style.display = ''; const s = state();
    st.innerHTML = `<h2>Favorites</h2><div class="sf-favs"></div><h2>Privacy Report</h2><div class="sf-card"><b>${12 + (s.history.length * 3) % 60}</b><span>In the last seven days, Safari has prevented trackers from profiling you.</span></div>${s.bookmarks.length ? '<h2>Bookmarks</h2><div class="sf-favs bm"></div>' : ''}`;
    const add = (hostEl, f) => { const n = el(`<div class="sf-fav"><i style="background:${f.c || '#8e8e93'};color:${f.fg || '#fff'}">${esc(f.g || (f.t || '?')[0].toUpperCase())}</i><span>${esc(f.t)}</span></div>`); n.addEventListener('click', () => go(f.u)); hostEl.appendChild(n); };
    FAVORITES.forEach((f) => add(st.querySelector('.sf-favs'), f));
    s.bookmarks.forEach((b) => add(st.querySelector('.sf-favs.bm'), { t: b.title, u: b.url, c: 'var(--gray)' }));
    cur && cur.frame && (cur.frame.style.display = 'none'); root.style.setProperty('--sf-theme', 'var(--bg2)');
  }

  async function go(raw, opts = {}) {
    const url = unwrap(normalize(raw) || ''); if (!url || !cur) return;
    const t = cur; const token = ++loadToken;
    input.blur(); t.url = url; t.title = host(url);
    if (!opts.fromHistory) { t.hist = t.hist.slice(0, t.idx + 1); t.hist.push(url); t.idx = t.hist.length - 1; }
    const st = view.querySelector('.sf-start'); if (st) st.style.display = 'none'; view.querySelectorAll('.sf-err').forEach((n) => n.remove());
    sync(); progress(.15);
    if (!OS.settings.get('wifi') && !OS.settings.get('cellular')) { progress(0); return fail(t, 'Safari cannot open the page because your iPhone is not connected to the internet.'); }
    let direct = false;
    try { const r = await (await fetch('/api/frameable?url=' + encodeURIComponent(url))).json(); direct = !!r.frameable; } catch {}
    if (token !== loadToken) return;
    progress(.55);
    const f = document.createElement('iframe');
    f.setAttribute('allow', 'fullscreen; autoplay; clipboard-write; geolocation');
    f.setAttribute('sandbox', direct ? 'allow-scripts allow-same-origin allow-forms allow-popups allow-modals allow-downloads' : 'allow-scripts allow-forms allow-popups allow-modals');
    f.src = direct ? url : '/proxy?url=' + encodeURIComponent(url);
    f.addEventListener('load', () => { if (t.frame === f) { progress(1); } });
    t.frame && t.frame.remove(); t.frame = f; t.mode = direct ? 'direct' : 'proxy'; view.appendChild(f);
    root.style.setProperty('--sf-theme', 'var(--bg)');
    const s = state(); s.history = [{ url, title: t.title, time: Date.now() }, ...s.history.filter((h) => h.url !== url)].slice(0, 60); saveState(s);
    setTimeout(() => { if (token === loadToken) progress(1); }, 9000);
  }
  function fail(t, msg) { const e = el(`<div class="sf-err"><h3>Safari Can’t Open the Page</h3><div>${esc(msg)}</div></div>`); view.appendChild(e); }
  function progress(p) { prog.style.opacity = p > 0 && p < 1 ? '1' : '0'; prog.style.width = p * 100 + '%'; root.querySelector('.sf-reload').innerHTML = p > 0 && p < 1 ? ICON.stop : ICON.reload; if (p >= 1) setTimeout(() => { prog.style.width = '0'; }, 350); }
  function sync() {
    if (!cur) return;
    if (document.activeElement !== input) input.value = display(cur);
    root.querySelector('.sf-back').classList.toggle('off', cur.idx <= 0 && !!cur.url === false);
    root.querySelector('.lk').style.visibility = cur.url && /^https:/.test(cur.url) ? '' : 'hidden';
  }
  function back() { if (!cur) return; if (cur.idx > 0) { cur.idx--; go(cur.hist[cur.idx], { fromHistory: true }); } else if (cur.url) { cur.url = null; cur.idx = -1; cur.hist = []; cur.frame && cur.frame.remove(); cur.frame = null; cur.title = 'Start Page'; showStart(); sync(); } }
  function forward() { if (cur && cur.idx < cur.hist.length - 1) { cur.idx++; go(cur.hist[cur.idx], { fromHistory: true }); } }

  function showTabs() {
    const ov = root.querySelector('.sf-tabs'); ov.classList.add('on'); const grid = ov.querySelector('.sf-tabgrid'); grid.innerHTML = '';
    tabs.forEach((t) => { const c = el(`<div class="sf-tcard ${t === cur ? 'cur' : ''}"><div class="pv">${esc((t.title || 'S')[0].toUpperCase())}<div class="x">✕</div></div><div class="nm">${esc(t.title || 'Start Page')}</div></div>`);
      c.addEventListener('click', (e) => { if (e.target.closest('.x')) { closeTab(t); return showTabs(); } select(t); ov.classList.remove('on'); }); grid.appendChild(c); });
    ov.querySelector('b').textContent = tabs.length + (tabs.length === 1 ? ' Tab' : ' Tabs');
  }
  function moreMenu(anchor) {
    const t = cur; const hasPage = !!(t && t.url);
    OS.ui.contextMenu(anchor, [
      hasPage && { label: 'Share…', icon: '⬆︎', onTap: share }, hasPage && { label: 'Add Bookmark', icon: '📖', onTap() { const s = state(); if (!s.bookmarks.some((b) => b.url === t.url)) s.bookmarks.push({ url: t.url, title: t.title }); saveState(s); OS.ui.toast('Bookmark Added'); } },
      hasPage && { label: 'Add to Home Screen', icon: '＋', onTap: addToHome }, { label: 'Bookmarks & History', icon: '🕘', onTap: showBookmarks },
      { label: 'New Tab', icon: '⊕', onTap: () => newTab() }, { label: `All Tabs (${tabs.length})`, icon: '▢', onTap: showTabs },
      t && t.idx < t.hist.length - 1 && { label: 'Forward', icon: '›', onTap: forward },
    ]);
  }
  function share() {
    const t = cur; OS.ui.actionSheet({ title: t.title, message: t.url, buttons: [{ label: 'Copy Link' }, { label: 'Add to Home Screen' }, { label: 'Send in Messages' }, { label: 'Open in Mac Browser' }] }).then((i) => {
      if (i === 0) { try { navigator.clipboard.writeText(t.url); } catch {} OS.ui.toast('Copied'); } else if (i === 1) addToHome(); else if (i === 2) OS.openApp('messages', { body: t.url }); else if (i === 3) window.open(t.url, '_blank', 'noopener');
    });
  }
  async function addToHome() {
    const t = cur; const name = await OS.ui.prompt({ title: 'Add to Home Screen', message: 'An icon will be added to your Home Screen so you can quickly open this website.', value: (t.title || host(t.url)).slice(0, 18), okLabel: 'Add' }); if (!name) return;
    const hue = [...host(t.url)].reduce((a, c) => a + c.charCodeAt(0), 0) % 360;
    await OS.goHome(); OS.webapps.install({ id: 'web' + uid(), name, kind: 'web', url: t.url, proxy: t.mode === 'proxy', category: 'Web Apps', statusBar: 'auto', icon: { bg: `linear-gradient(160deg,hsl(${hue} 75% 58%),hsl(${(hue + 40) % 360} 75% 42%))`, glyph: name[0].toUpperCase() } }, { duration: 900 });
  }
  function showBookmarks() {
    OS.ui.sheet({ title: 'Bookmarks', right: { label: 'Done', bold: true }, render(body, sh) {
      const s = state(); const seg = el('<div style="padding:4px 16px 14px"><div class="ios-seg"><button class="on">Bookmarks</button><button>History</button></div></div>'); body.appendChild(seg); const out = el('<div></div>'); body.appendChild(out);
      const draw = (which) => { const items = which ? s.history : [...FAVORITES.map((f) => ({ url: f.u, title: f.t })), ...s.bookmarks]; out.innerHTML = items.length ? '' : '<div style="text-align:center;color:var(--label2);padding:60px 0">No History</div>'; if (!items.length) return; const l = el('<div class="ios-list"></div>'); items.forEach((it) => { const r = el(`<div class="ios-row tappable"><span class="ios-row-label">${esc(it.title || host(it.url))}<span class="ios-row-sub">${esc(it.url)}</span></span></div>`); r.addEventListener('click', () => { sh.close(); go(it.url); }); l.appendChild(r); }); out.appendChild(l);
        if (which) { const c = el('<div class="ios-btn-plain" style="text-align:center;padding:18px;color:var(--red)!important">Clear History</div>'); c.addEventListener('click', () => { s.history = []; saveState(s); draw(1); }); out.appendChild(c); } };
      seg.querySelectorAll('button').forEach((b, i) => b.addEventListener('click', () => { seg.querySelectorAll('button').forEach((x) => x.classList.toggle('on', x === b)); draw(i); })); draw(0);
    } });
  }

  // navigation + titles reported by proxied pages
  window.addEventListener('message', (e) => {
    const d = e.data; if (!d || !d.__safari) return; const t = tabs.find((x) => x.frame && x.frame.contentWindow === e.source); if (!t) return;
    if (d.type === 'nav' && typeof d.url === 'string' && /^https?:/i.test(d.url)) { if (t !== cur) select(t); go(d.url); }
    else if (d.type === 'loaded') { if (d.title) t.title = String(d.title).slice(0, 80); if (typeof d.url === 'string' && /^https?:/.test(d.url) && !/\/proxy\?url=/.test(d.url)) { t.url = d.url; t.hist[t.idx] = d.url; } if (t === cur) { sync(); progress(1); if (d.theme && /^#|^rgb/.test(d.theme)) root.style.setProperty('--sf-theme', d.theme); } }
  });

  OS.registerApp({
    id: 'safari', name: 'Safari', system: true, statusBar: 'auto',
    icon: { bg: '#fff', glyph: `<svg viewBox="0 0 60 60"><circle cx="30" cy="30" r="23.500" fill="#1a8cf0"/><circle cx="30" cy="30" r="23.500" fill="none" stroke="#d9d9de" stroke-width="1"/><g stroke="#fff" stroke-width="1.100" opacity=".9">${Array.from({ length: 36 }, (_, i) => { const a = (i * 10 * Math.PI) / 180, r1 = i % 3 === 0 ? 18.500 : 20; return `<path d="M${30 + Math.cos(a) * r1} ${30 + Math.sin(a) * r1}L${30 + Math.cos(a) * 22} ${30 + Math.sin(a) * 22}"/>`; }).join('')}</g><path d="M44 16 33 33 27 27z" fill="#ff3b30"/><path d="M16 44 27 27l6 6z" fill="#fff"/></svg>` },
    launch(c) {
      ctx = c; root = c.root;
      root.innerHTML = `<div class="sf-top"></div><div class="sf-view"></div>
        <div class="sf-bar"><div class="sf-rb sf-back">${ICON.back}</div><div class="sf-pill">${ICON.lock}<input type="text" inputmode="url" enterkeyhint="go" placeholder="Search or enter website name" autocapitalize="off" autocomplete="off" spellcheck="false"><div class="sf-reload">${ICON.reload}</div><div class="sf-prog"></div></div><div class="sf-rb sf-more">${ICON.more}</div></div>
        <div class="sf-tabs"><div class="sf-tabgrid ios-scroll"></div><div class="sf-tbar"><span class="add">＋</span><b></b><span class="done">Done</span></div></div>`;
      view = root.querySelector('.sf-view'); input = root.querySelector('input'); prog = root.querySelector('.sf-prog');
      input.addEventListener('focus', () => { root.classList.add('kb'); input.value = cur && cur.url ? (display(cur) === host(cur.url) ? cur.url : display(cur)) : ''; setTimeout(() => input.select(), 30); });
      input.addEventListener('blur', () => { root.classList.remove('kb'); sync(); });
      input.addEventListener('keydown', (e) => { if (e.key === 'Enter') { e.preventDefault(); const v = input.value; input.blur(); if (v.trim()) go(v); } });
      root.querySelector('.sf-back').addEventListener('click', back);
      root.querySelector('.sf-more').addEventListener('click', (e) => moreMenu(e.currentTarget));
      OS.util.longPress(root.querySelector('.sf-more'), showTabs);
      root.querySelector('.sf-reload').addEventListener('click', () => { if (cur && cur.url) go(cur.url, { fromHistory: true }); });
      root.querySelector('.sf-tabs .add').addEventListener('click', () => { newTab(); root.querySelector('.sf-tabs').classList.remove('on'); });
      root.querySelector('.sf-tabs .done').addEventListener('click', () => root.querySelector('.sf-tabs').classList.remove('on'));
      newTab();
    },
    onResume(c, params) { if (!params) return; const target = params.url || (params.search ? SEARCH(params.search) : null); if (!target) return; if (cur && cur.url) newTab(target); else go(target); },
    onClose() { tabs = []; cur = null; },
  });
  OS.safari = { open: (url) => OS.openApp('safari', { url }) };
})();
