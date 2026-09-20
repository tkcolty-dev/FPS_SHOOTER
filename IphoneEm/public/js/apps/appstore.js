// App Store — real installable apps: bundled store apps (/public/store), Colton's live web apps, and apps published from App Maker.
(function () {
  const { el, esc } = OS.util;
  const WEB = [
    { id: 'wstatelocater', name: 'StateLocater', subtitle: '50 states in 4 weeks', url: 'https://statelocater.apps.tas-ndc.kuhn-labs.com/', category: 'Education', developer: 'Colton', icon: { bg: 'linear-gradient(160deg,#43c06b,#1b7f4c)', glyph: '🗺️' }, accent: '#2e9e5b', description: 'Learn all 50 states and capitals with a map game, spaced repetition and checkpoints every 10 states. Made by Colton — this is the real, live app.' },
    { id: 'wblockbuddy', name: 'BlockBuddy', subtitle: 'AI Scratch coach', url: 'https://blockbuddy.apps.tas-ndc.kuhn-labs.com/', category: 'Education', developer: 'Colton', icon: { bg: 'linear-gradient(160deg,#9b7bff,#5b3fd6)', glyph: '🧩' }, accent: '#7e57c2', description: 'Ask anything about Scratch and get answers rendered as real Scratch blocks. Made by Colton — this is the real, live app.' },
    { id: 'wscratchtogether', name: 'Scratch Together', subtitle: 'Multiplayer Scratch editor', url: 'https://scratch-together.apps.tas-ndc.kuhn-labs.com/', category: 'Productivity', developer: 'Colton', icon: { bg: 'linear-gradient(160deg,#ffb74d,#f57c00)', glyph: '🐱' }, accent: '#f57c00', description: 'Edit the same Scratch project with friends at the same time, in the real Scratch 3 editor. Rooms with join codes. Made by Colton.' },
    { id: 'wsuggest', name: 'Suggest', subtitle: 'Comment on Colton’s projects', url: 'https://suggest.apps.tas-ndc.kuhn-labs.com/', category: 'Productivity', developer: 'Colton', icon: { bg: 'linear-gradient(160deg,#4fc3f7,#0277bd)', glyph: '💡' }, accent: '#0288d1', description: 'Leave ideas and comments on Colton’s projects — he picks which ones get built.' },
    { id: 'wcloudlift', name: 'CloudLift', subtitle: 'Cloud variables for Scratch', url: 'https://cloudlift.apps.tas-ndc.kuhn-labs.com/', category: 'Utilities', developer: 'Colton', icon: { bg: 'linear-gradient(160deg,#81d4fa,#3f51b5)', glyph: '☁️' }, accent: '#3f51b5', description: 'Your own cloud-variable server for Scratch games, with a bridge to scratch.mit.edu.' },
    { id: 'wturbowarp', name: 'TurboWarp', subtitle: 'Run Scratch projects fast', url: 'https://turbowarp.org/', category: 'Entertainment', developer: 'TurboWarp', icon: { bg: 'linear-gradient(160deg,#ff6b6b,#c62828)', glyph: '⚡' }, accent: '#e53935', description: 'A Scratch mod that compiles projects to JavaScript so they run really fast. Open any Scratch project by ID.' },
    { id: 'wwikipedia', name: 'Wikipedia', subtitle: 'The free encyclopedia', url: 'https://en.m.wikipedia.org/', category: 'Education', developer: 'Wikimedia Foundation', icon: { bg: '#fff', glyph: '<span style="color:#111;font-family:Georgia,serif;font-size:38px">W</span>' }, accent: '#636366', description: 'Explore more than 6 million articles, right on your Home Screen.' },
  ].map((w) => ({ kind: 'web', rating: 4.8, ratings: '1.2K', age: '4+', size: '0.3 MB', version: '1.0', statusBar: 'auto', whatsNew: 'Now available on iPhone 17.', genre: 'Web App', ...w }));

  OS.addStyle('appstore', `
    .app-appstore .as-tab{position:absolute;inset:0;display:none}.app-appstore .as-tab.on{display:block}
    .as-today-date{font-size:13px;font-weight:600;color:var(--label2);text-transform:uppercase;letter-spacing:.2px;padding:0 20px;margin-top:6px}
    .as-head{display:flex;justify-content:space-between;align-items:center;padding:0 20px 10px}.as-head h1{font-size:34px;font-weight:700;margin:0;letter-spacing:.37px}
    .as-acct{cursor:pointer}
    .as-card{position:relative;margin:0 20px 28px;height:410px;border-radius:20px;overflow:hidden;color:#fff;cursor:pointer;box-shadow:0 8px 30px rgba(0,0,0,.18);transition:transform .25s var(--ease)}.as-card:active{transform:scale(.97)}
    .as-card .bgi{position:absolute;inset:0;display:flex;align-items:center;justify-content:center}.as-card .bgi .icon-img{width:170px;height:170px;border-radius:38px;font-size:90px;box-shadow:0 20px 50px rgba(0,0,0,.35);transform:rotate(-8deg)}
    .as-card .kick{position:absolute;left:20px;top:18px;font-size:13px;font-weight:700;text-transform:uppercase;opacity:.75;letter-spacing:.3px}.as-card h2{position:absolute;left:20px;right:20px;top:36px;margin:0;font-size:28px;line-height:32px;font-weight:700;letter-spacing:.3px}
    .as-card .foot{position:absolute;left:0;right:0;bottom:0;padding:12px 16px;display:flex;align-items:center;gap:12px;background:rgba(0,0,0,.28);backdrop-filter:blur(20px);-webkit-backdrop-filter:blur(20px)}
    .as-card .foot .icon-img{width:46px;height:46px;border-radius:11px;font-size:24px;flex:none}.as-card .foot b{display:block;font-size:15px;font-weight:600}.as-card .foot small{font-size:13px;opacity:.75}
    .as-card .foot .ios-pill{background:rgba(255,255,255,.28)!important;color:#fff!important;margin-left:auto}
    .as-sec{display:flex;justify-content:space-between;align-items:baseline;padding:4px 20px 10px;border-top:.5px solid var(--sep);margin-top:4px;padding-top:14px}.as-sec h3{font-size:22px;font-weight:700;margin:0;letter-spacing:.3px}
    .as-hrow{display:flex;gap:14px;padding:0 20px 22px;scroll-snap-type:x mandatory}.as-hrow>*{flex:none;scroll-snap-align:start}
    .as-col{width:300px}
    .as-item{display:flex;align-items:center;gap:12px;padding:9px 0;cursor:pointer;min-width:0}.as-item+.as-item{border-top:.5px solid var(--sep)}
    .as-item .icon-img{width:62px;height:62px;border-radius:14px;font-size:32px;flex:none}.as-item .tx{flex:1;min-width:0}.as-item b{display:block;font-size:16px;font-weight:500;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}.as-item small{display:block;font-size:13px;color:var(--label2);white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
    .as-list{padding:0 20px 20px}
    .as-big{width:250px;cursor:pointer}.as-big .art{height:150px;border-radius:14px;display:flex;align-items:center;justify-content:center;margin-bottom:8px}.as-big .art .icon-img{width:84px;height:84px;border-radius:19px;font-size:44px;box-shadow:0 10px 24px rgba(0,0,0,.3)}
    .as-get{position:relative;overflow:hidden}.as-get.loading{min-width:30px;width:30px;padding:0;background:none!important}.as-get.loading::after{content:'';position:absolute;inset:2px;border-radius:50%;border:2.500px solid var(--fill);border-top-color:var(--tint);animation:asspin .8s linear infinite}
    .as-get.prog{min-width:30px;width:30px;padding:0;background:conic-gradient(var(--tint) var(--p,0%),var(--fill) 0)!important;color:transparent!important}.as-get.prog::after{content:'';position:absolute;inset:3px;border-radius:50%;background:var(--bg)}.as-get.prog::before{content:'';position:absolute;left:11px;top:11px;width:8px;height:8px;border-radius:2px;background:var(--tint);z-index:1}
    @keyframes asspin{to{transform:rotate(360deg)}}
    .as-det-head{display:flex;gap:16px;padding:6px 20px 16px}.as-det-head .icon-img{width:118px;height:118px;border-radius:26px;font-size:60px;flex:none;box-shadow:0 2px 12px rgba(0,0,0,.12)}.as-det-head h1{font-size:22px;margin:2px 0 2px;font-weight:700;line-height:26px}.as-det-head p{margin:0;color:var(--label2);font-size:15px}
    .as-det-head .row{display:flex;justify-content:space-between;align-items:center;margin-top:18px}.as-det-head .ios-pill{min-width:76px;height:32px}
    .as-facts{display:flex;padding:12px 8px;margin:0 20px;border-top:.5px solid var(--sep);border-bottom:.5px solid var(--sep)}.as-facts div{flex:1;text-align:center;font-size:11px;color:var(--label2);text-transform:uppercase;letter-spacing:.2px}.as-facts div+div{border-left:.5px solid var(--sep)}.as-facts b{display:block;font-size:20px;color:var(--label2);font-weight:700;margin:4px 0 2px;text-transform:none}
    .as-h{font-size:22px;font-weight:700;margin:22px 20px 8px;letter-spacing:.3px}.as-p{margin:0 20px;font-size:15px;line-height:21px;color:var(--label);white-space:pre-wrap}
    .as-prev{display:flex;gap:12px;padding:0 20px}.as-prev .ph{width:221px;height:480px;border-radius:26px;overflow:hidden;position:relative;flex:none;background:#000;box-shadow:0 2px 14px rgba(0,0,0,.18)}.as-prev iframe{width:402px;height:874px;border:0;transform:scale(.55);transform-origin:0 0;pointer-events:none;background:#fff}
    .as-prev .promo{display:flex;flex-direction:column;align-items:center;justify-content:center;color:#fff;text-align:center;padding:24px;font-size:24px;font-weight:700;line-height:29px}.as-prev .promo .icon-img{width:90px;height:90px;border-radius:20px;font-size:46px;margin-bottom:22px;box-shadow:0 12px 30px rgba(0,0,0,.35)}
    .as-rev{margin:0 20px 10px;padding:16px;border-radius:14px;background:var(--cell2);font-size:15px;line-height:20px}.as-rev b{display:block}.as-rev .st{color:var(--orange);letter-spacing:2px;font-size:12px;margin:2px 0 6px}
    .as-rate{display:flex;align-items:center;gap:18px;margin:0 20px 14px}.as-rate b{font-size:56px;font-weight:700;line-height:56px}.as-rate small{color:var(--label2);font-size:13px}
    .as-pay{position:absolute;left:8px;right:8px;bottom:8px;border-radius:34px;background:var(--material-thick);backdrop-filter:blur(40px) saturate(1.800);-webkit-backdrop-filter:blur(40px) saturate(1.800);padding:20px 20px 26px;transform:translateY(110%);transition:transform .5s var(--ease);box-shadow:0 -4px 40px rgba(0,0,0,.2)}.as-pay.in{transform:none}
    .as-pay .top{display:flex;justify-content:space-between;align-items:center;font-weight:600;font-size:17px;margin-bottom:16px}.as-pay .x{width:30px;height:30px;border-radius:50%;background:var(--fill);display:flex;align-items:center;justify-content:center;cursor:pointer;color:var(--label2);font-size:14px;font-weight:700}
    .as-pay .app{display:flex;gap:12px;align-items:center;padding:12px 0;border-top:.5px solid var(--sep);border-bottom:.5px solid var(--sep)}.as-pay .app .icon-img{width:56px;height:56px;border-radius:13px;font-size:28px;flex:none}.as-pay .app small{display:block;color:var(--label2);font-size:13px}
    .as-pay .acct{font-size:13px;color:var(--label2);padding:10px 0 16px}.as-pay .confirm{text-align:center;cursor:pointer;color:var(--label)}.as-pay .confirm svg{width:46px;height:46px;color:var(--tint);margin-bottom:6px}.as-pay .confirm.done svg{color:var(--green)}
    .as-side-hint{position:absolute;right:6px;top:212px;padding:8px 12px;border-radius:14px;background:var(--material-thick);font-size:13px;font-weight:600;box-shadow:0 4px 20px rgba(0,0,0,.2);animation:ashint 1.100s ease-in-out infinite;color:var(--label);text-align:center;line-height:16px}@keyframes ashint{50%{transform:translateX(-7px)}}
  `);

  let catalog = [], navs = {}, root, ctxRef, curTab = 'today';
  const makerApps = () => (OS.store.get('maker.apps', []) || []).filter((a) => a.published).map((a) => ({ id: a.id, kind: 'maker', name: a.name, subtitle: a.subtitle || 'Made in App Maker', category: a.category || 'Made by You', genre: 'App Maker', developer: OS.settings.get('ownerName'), icon: a.icon, html: a.html, rating: 5, ratings: '1', age: '4+', size: Math.max(1, Math.round((a.html || '').length / 1024)) + ' KB', version: a.version || '1.0', statusBar: a.statusBar || 'auto', description: a.description || `${a.name} was built right here on this iPhone with App Maker.`, whatsNew: 'Freshly built.', accent: '#5856D6', mine: true }));
  const all = () => [...makerApps(), ...catalog, ...WEB];
  const installed = (a) => OS.webapps.isInstalled(a.id);
  const purchased = () => OS.store.get('appstore.purchased', []);
  const tint = (a) => a.accent || '#007AFF';
  const artBg = (a) => `linear-gradient(150deg, color-mix(in srgb, ${tint(a)} 85%, #fff), color-mix(in srgb, ${tint(a)} 70%, #000))`;
  const entryOf = (a) => ({ id: a.id, name: a.name, icon: a.icon, kind: a.kind || 'store', url: a.url, html: a.html, statusBar: a.statusBar || 'auto', category: a.category === 'Games' ? 'Games' : a.category, proxy: false });

  // ── GET / OPEN button with the side-button confirmation sheet ──
  function getButton(a, extra = '') {
    const b = el(`<button class="ios-pill as-get ${extra}"></button>`);
    const paint = () => { b.classList.remove('loading', 'prog'); b.textContent = OS.webapps.installing[a.id] != null ? '' : installed(a) ? 'Open' : purchased().includes(a.id) ? '⤓' : 'Get'; if (OS.webapps.installing[a.id] != null) b.classList.add('prog'); };
    paint(); b._paint = paint; b.dataset.appid = a.id;
    b.addEventListener('click', async (e) => {
      e.stopPropagation();
      if (OS.webapps.installing[a.id] != null) return;
      if (installed(a)) return OS.openApp(a.id);
      b.classList.add('loading'); b.textContent = '';
      const ok = purchased().includes(a.id) ? true : await confirmSheet(a);
      if (!ok) return paint();
      OS.store.set('appstore.purchased', [...new Set([...purchased(), a.id])]);
      b.classList.remove('loading'); b.classList.add('prog');
      const tick = setInterval(() => { const p = OS.webapps.installing[a.id]; root.querySelectorAll(`.as-get[data-appid="${CSS.escape(a.id)}"]`).forEach((x) => { x.classList.remove('loading'); x.classList.add('prog'); x.textContent = ''; x.style.setProperty('--p', (p || 0) + '%'); }); }, 60);
      await OS.webapps.install(entryOf(a), { duration: 3200 }); clearInterval(tick);
      root.querySelectorAll('.as-get').forEach((x) => x._paint && x._paint());
      OS.notify({ appId: 'appstore', title: a.name, body: 'is ready to use. Find it on your Home Screen.', sound: false });
    });
    return b;
  }
  function confirmSheet(a) {
    return new Promise((resolve) => {
      const wrap = el(`<div style="position:absolute;inset:0;z-index:50"><div class="ios-sheet-backdrop"></div><div class="as-side-hint">Double Click<br>to Install ▶</div><div class="as-pay"><div class="top"><span>App Store</span><div class="x">✕</div></div>
        <div class="app">${OS.iconHTML(a)}<div><b>${esc(a.name)}</b><small>${esc(a.developer || '')} · ${esc(a.age || '4+')}</small><small>${a.kind === 'web' ? 'Web App' : 'App'} · Free</small></div></div>
        <div class="acct">ACCOUNT &nbsp; ${esc(OS.settings.get('ownerName').toLowerCase().replace(/\s+/g, ''))}@icloud.com</div>
        <div class="confirm">${OS.icons.faceid.replace('<svg', '<svg style="display:block;margin:0 auto 6px"')}<div class="lbl">Confirm with Side Button</div><small style="color:var(--label2);font-size:12px">(or tap here)</small></div></div></div>`);
      root.appendChild(wrap); const pay = wrap.querySelector('.as-pay'), bd = wrap.querySelector('.ios-sheet-backdrop'); wrap.getBoundingClientRect(); requestAnimationFrame(() => { pay.classList.add('in'); bd.classList.add('in'); });
      let settled = false;
      const close = (val) => { if (settled) return; settled = true; OS._sideDouble = null; pay.classList.remove('in'); bd.classList.remove('in'); wrap.querySelector('.as-side-hint').remove(); setTimeout(() => wrap.remove(), 450); resolve(val); };
      const confirm = () => {
        if (settled) return; OS._sideDouble = null; const c = wrap.querySelector('.confirm'); wrap.querySelector('.as-side-hint').style.display = 'none';
        c.querySelector('.lbl').textContent = 'Face ID'; OS.haptic('light');
        setTimeout(() => { c.classList.add('done'); c.querySelector('svg').outerHTML = OS.icons.check.replace('<svg', '<svg style="display:block;margin:0 auto 6px;width:46px;height:46px;color:var(--green)"'); c.querySelector('.lbl').textContent = 'Done'; OS.sound.play('pay'); OS.haptic('success'); setTimeout(() => close(true), 900); }, 900);
      };
      OS._sideDouble = confirm; wrap.querySelector('.confirm').addEventListener('click', confirm);
      wrap.querySelector('.x').addEventListener('click', () => close(false)); bd.addEventListener('click', () => close(false));
    });
  }

  // ── building blocks ──
  function item(a, nav) { const n = el(`<div class="as-item">${OS.iconHTML(a)}<div class="tx"><b>${esc(a.name)}</b><small>${esc(a.subtitle || a.genre || a.category || '')}</small></div></div>`); n.appendChild(getButton(a)); n.addEventListener('click', () => nav.push(detail(a, nav))); return n; }
  function section(body, title, apps, nav, style = 'cols') {
    if (!apps.length) return;
    body.appendChild(el(`<div class="as-sec"><h3>${esc(title)}</h3></div>`));
    if (style === 'big') { const row = el('<div class="as-hrow ios-scroll x"></div>'); apps.forEach((a) => { const c = el(`<div class="as-big"><div class="art" style="background:${artBg(a)}">${OS.iconHTML(a)}</div></div>`); c.appendChild(item(a, nav)); c.querySelector('.art').addEventListener('click', () => nav.push(detail(a, nav))); row.appendChild(c); }); return body.appendChild(row); }
    if (style === 'list') { const l = el('<div class="as-list"></div>'); apps.forEach((a) => l.appendChild(item(a, nav))); return body.appendChild(l); }
    const row = el('<div class="as-hrow ios-scroll x"></div>');
    for (let i = 0; i < apps.length; i += 3) { const col = el('<div class="as-col"></div>'); apps.slice(i, i + 3).forEach((a) => col.appendChild(item(a, nav))); row.appendChild(col); }
    body.appendChild(row);
  }
  const header = (body, title, withDate) => {
    if (withDate) body.appendChild(el(`<div class="as-today-date">${new Date().toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' })}</div>`));
    const h = el(`<div class="as-head"><h1>${esc(title)}</h1><div class="as-acct">${OS.contacts.avatar({ first: OS.settings.get('ownerName'), color: '#8E8E93' }, 36)}</div></div>`); h.querySelector('.as-acct').addEventListener('click', account); body.appendChild(h);
  };
  const seeded = (arr, salt) => arr.map((a, i) => [a, (Math.sin((i + 1) * 99.7 + salt) + 1) % 1]).sort((x, y) => x[1] - y[1]).map((x) => x[0]);

  function detail(a, nav) {
    return { title: '', background: 'var(--bg)', render(body) {
      const head = el(`<div class="as-det-head">${OS.iconHTML(a)}<div style="flex:1;min-width:0"><h1>${esc(a.name)}</h1><p>${esc(a.subtitle || '')}</p><div class="row"></div></div></div>`); head.querySelector('.row').appendChild(getButton(a, 'filled'));
      const shareB = el('<span style="color:var(--tint);cursor:pointer;font-size:20px">⬆︎</span>'); shareB.addEventListener('click', () => OS.ui.toast('Link Copied')); head.querySelector('.row').appendChild(shareB); body.appendChild(head);
      body.appendChild(el(`<div class="as-facts"><div>${esc(a.ratings || '0')} Ratings<b>${(a.rating || 0).toFixed(1)}</b>${'★'.repeat(Math.round(a.rating || 0))}</div><div>Age<b>${esc(a.age || '4+')}</b>Years Old</div><div>Category<b style="font-size:17px;line-height:24px">${a.category === 'Games' ? '🎮' : a.kind === 'web' ? '🌐' : '📱'}</b>${esc(a.category || '')}</div><div>Size<b style="font-size:16px;line-height:24px">${esc(String(a.size || '1 MB').split(' ')[0])}</b>${esc(String(a.size || '1 MB').split(' ')[1] || 'MB')}</div></div>`));
      body.appendChild(el(`<div class="as-h">What’s New</div><div class="as-p" style="color:var(--label2);font-size:13px;margin-bottom:4px">Version ${esc(a.version || '1.0')}</div><div class="as-p">${esc(a.whatsNew || 'Bug fixes and improvements.')}</div><div class="as-h">Preview</div>`));
      const prev = el('<div class="as-prev ios-scroll x"></div>');
      const live = el('<div class="ph"></div>'); const f = document.createElement('iframe'); f.setAttribute('sandbox', a.kind === 'maker' ? 'allow-scripts' : 'allow-scripts allow-same-origin'); f.setAttribute('tabindex', '-1'); f.loading = 'lazy';
      if (a.kind === 'maker') f.srcdoc = a.html || ''; else f.src = a.url; live.appendChild(f); prev.appendChild(live);
      [a.subtitle || a.name, a.kind === 'web' ? 'The real, live web app — right on your Home Screen' : 'Built for iPhone 17'].forEach((t) => prev.appendChild(el(`<div class="ph promo" style="background:${artBg(a)}">${OS.iconHTML(a)}${esc(t)}</div>`)));
      body.appendChild(prev);
      body.appendChild(el(`<div class="as-p" style="margin-top:20px">${esc(a.description || '')}</div><div class="as-p" style="margin-top:14px;color:var(--tint)">${esc(a.developer || '')}<br><span style="color:var(--label2);font-size:13px">Developer</span></div>`));
      body.appendChild(el(`<div class="as-h">Ratings &amp; Reviews</div><div class="as-rate"><b>${(a.rating || 0).toFixed(1)}</b><small>out of 5<br>${esc(a.ratings || '0')} Ratings</small></div>`));
      const REV = [['So good', 'I play this every day after school. Super smooth on my iPhone 17.'], ['Exactly what I wanted', 'Simple, fast, no ads. Five stars.'], ['Love the haptics', 'Little details everywhere. You can tell the developer cares.']];
      if (!a.mine) seeded(REV, a.id.length).slice(0, 2).forEach((r, i) => body.appendChild(el(`<div class="as-rev"><b>${esc(r[0])}</b><div class="st">★★★★★</div>${esc(r[1])}</div>`)));
      body.appendChild(el('<div class="as-h">Information</div>'));
      const info = el('<div style="margin:0 20px 50px;font-size:15px"></div>'); [['Provider', a.developer || '—'], ['Size', a.size || '—'], ['Category', a.category || '—'], ['Compatibility', 'Works on this iPhone'], ['Languages', 'English'], ['Age Rating', a.age || '4+'], ['Price', 'Free']].forEach(([k, v]) => info.appendChild(el(`<div style="display:flex;justify-content:space-between;padding:11px 0;border-bottom:.5px solid var(--sep)"><span style="color:var(--label2)">${k}</span><span>${esc(v)}</span></div>`)));
      if (installed(a)) { const del = el('<div class="ios-btn-plain" style="padding:16px 0;color:var(--red)!important">Delete App</div>'); del.addEventListener('click', async () => { const i = await OS.ui.actionSheet({ message: `Delete “${a.name}” from this iPhone?`, buttons: [{ label: 'Delete App', style: 'destructive' }] }); if (i === 0) { OS.webapps.uninstall(a.id); nav.pop(); } }); info.appendChild(del); }
      body.appendChild(info);
    } };
  }

  function account() {
    OS.ui.sheet({ title: 'Account', right: { label: 'Done', bold: true }, render(body) {
      body.appendChild(el(`<div class="ios-list" style="margin-top:6px"><div class="ios-row" style="min-height:70px">${OS.contacts.avatar({ first: OS.settings.get('ownerName'), color: '#8E8E93' }, 52)}<span class="ios-row-label">${esc(OS.settings.get('ownerName'))}<span class="ios-row-sub">${esc(OS.settings.get('ownerName').toLowerCase().replace(/\s+/g, ''))}@icloud.com</span></span></div></div>`));
      const mine = all().filter((a) => purchased().includes(a.id) || installed(a));
      body.appendChild(el('<div class="ios-list-header">Purchased</div>'));
      if (!mine.length) return body.appendChild(el('<div class="ios-list"><div class="ios-row" style="color:var(--label2)">Nothing yet — tap GET on any app.</div></div>'));
      const l = el('<div class="ios-list" style="padding:0 16px"></div>'); mine.forEach((a) => { const n = el(`<div class="as-item">${OS.iconHTML(a)}<div class="tx"><b>${esc(a.name)}</b><small>${installed(a) ? 'Installed' : 'Not on this iPhone'}</small></div></div>`); n.appendChild(getButton(a)); l.appendChild(n); }); body.appendChild(l);
      body.appendChild(el('<div class="ios-list-header">Available Updates</div><div class="ios-list"><div class="ios-row" style="color:var(--label2)">All apps are up to date.</div></div><div style="height:40px"></div>'));
    } });
  }

  // ── tabs ──
  const TABS = [['today', 'Today', '<svg viewBox="0 0 26 26"><rect x="4" y="3.500" width="18" height="19" rx="3.500"/><rect x="7.500" y="7" width="7" height="6" rx="1" fill="var(--bar)"/><path d="M7.500 16.500h11M7.500 19h7" stroke="var(--bar)" stroke-width="1.500"/></svg>'], ['games', 'Games', '<svg viewBox="0 0 26 26"><path d="M8.500 7h9a6 6 0 0 1 5.900 5l.9 5.200a2.800 2.800 0 0 1-5 2.100L17.500 17h-9l-1.800 2.300a2.800 2.800 0 0 1-5-2.100l.9-5.200A6 6 0 0 1 8.500 7z"/></svg>'], ['apps', 'Apps', '<svg viewBox="0 0 26 26"><path d="M13 3 23 8l-10 5L3 8z"/><path d="M4.500 12.500 13 17l8.500-4.500M4.500 17 13 21.500 21.500 17" fill="none" stroke="currentColor" stroke-width="2" stroke-linejoin="round"/></svg>'], ['search', 'Search', '<svg viewBox="0 0 26 26"><circle cx="11.500" cy="11.500" r="7" fill="none" stroke="currentColor" stroke-width="2.600"/><path d="M17 17l5.500 5.500" stroke="currentColor" stroke-width="2.800" stroke-linecap="round"/></svg>']];
  const pageDef = { today: todayPage, games: gamesPage, apps: appsPage, search: searchPage };
  function rebuild() { Object.keys(navs).forEach((k) => { const host = root.querySelector(`.as-tab[data-t="${k}"]`); host.innerHTML = ''; navs[k] = OS.ui.createNav(host, { tabBarInset: true }); navs[k].push(pageDef[k](navs[k])); }); }
  function show(t) { curTab = t; root.querySelectorAll('.as-tab').forEach((n) => n.classList.toggle('on', n.dataset.t === t)); root.querySelectorAll('.ios-tab').forEach((n) => n.classList.toggle('on', n.dataset.t === t)); }

  function todayPage(nav) { return { title: 'Today', largeTitle: 'custom', background: 'var(--bg)', render(body) {
    header(body, 'Today', true);
    const games = catalog.filter((a) => a.category === 'Games'), apps = catalog.filter((a) => a.category !== 'Games'); const day = new Date().getDate();
    const card = (a, kick, title) => { if (!a) return; const c = el(`<div class="as-card" style="background:${artBg(a)}"><div class="bgi">${OS.iconHTML(a)}</div><div class="kick">${esc(kick)}</div><h2>${esc(title)}</h2><div class="foot">${OS.iconHTML(a)}<div><b>${esc(a.name)}</b><small>${esc(a.subtitle || '')}</small></div></div></div>`); c.querySelector('.foot').appendChild(getButton(a)); c.addEventListener('click', () => nav.push(detail(a, nav))); body.appendChild(c); };
    const mine = makerApps(); if (mine.length) card(mine[mine.length - 1], 'Made by you', `${mine[mine.length - 1].name} is live on the App Store`);
    card(games[day % Math.max(1, games.length)], 'Game of the day', 'Today’s pick to beat your high score');
    card(WEB[0], 'From the developer of this iPhone', 'Colton’s real apps, one tap away');
    card(apps[day % Math.max(1, apps.length)], 'App of the day', 'A small app that does one thing really well');
    section(body, 'Colton’s Apps', WEB.filter((w) => w.developer === 'Colton'), nav, 'list');
    body.appendChild(el('<div style="height:30px"></div>'));
  } }; }
  function gamesPage(nav) { return { title: 'Games', largeTitle: 'custom', background: 'var(--bg)', render(body) { header(body, 'Games'); const g = catalog.filter((a) => a.category === 'Games'); section(body, 'What to Play Now', seeded(g, 1).slice(0, 5), nav, 'big'); section(body, 'Top Free Games', seeded(g, 2), nav); section(body, 'All Games', g, nav, 'list'); } }; }
  function appsPage(nav) { return { title: 'Apps', largeTitle: 'custom', background: 'var(--bg)', render(body) { header(body, 'Apps'); const a = catalog.filter((x) => x.category !== 'Games'); const mine = makerApps(); section(body, 'Made by You', mine, nav, 'big'); section(body, 'Must-Have Apps', seeded(a, 3).slice(0, 5), nav, 'big'); section(body, 'Colton’s Apps', WEB.filter((w) => w.developer === 'Colton'), nav); section(body, 'Top Free Apps', seeded(a, 4), nav); section(body, 'Web Apps', WEB.filter((w) => w.developer !== 'Colton'), nav, 'list'); } }; }
  function searchPage(nav) { return { title: 'Search', largeTitle: true, background: 'var(--bg)', search: { placeholder: 'Games, Apps and More', onInput(q, pg) { draw(pg.body, q, nav); } }, render(body) { draw(body, '', nav); } }; }
  function draw(body, q, nav) {
    body.querySelectorAll('.as-res').forEach((n) => n.remove()); const out = el('<div class="as-res"></div>'); q = q.trim().toLowerCase();
    if (!q) { out.appendChild(el('<div class="as-sec" style="border:0"><h3>Discover</h3></div>')); const l = el('<div class="as-list"></div>'); ['puzzle games', 'drawing', 'scratch', 'timer', 'music', 'made by colton'].forEach((s) => { const r = el(`<div style="padding:11px 0;border-bottom:.5px solid var(--sep);color:var(--tint);font-size:20px;cursor:pointer">🔍&nbsp; ${esc(s)}</div>`); r.addEventListener('click', () => { const i = body.querySelector('.nv-search input'); i.value = s; draw(body, s, nav); }); l.appendChild(r); }); out.appendChild(l); }
    else { const words = q.split(/\s+/); const res = all().filter((a) => { const hay = [a.name, a.subtitle, a.category, a.genre, a.developer, a.description, a.mine ? 'made by you' : '', a.developer === 'Colton' ? 'made by colton' : ''].join(' ').toLowerCase(); return words.every((w) => hay.includes(w) || hay.includes(w.replace(/s$/, ''))); }); const l = el('<div class="as-list"></div>'); res.forEach((a) => l.appendChild(item(a, nav))); out.appendChild(res.length ? l : el('<div style="text-align:center;color:var(--label2);padding:70px 30px"><b style="display:block;font-size:22px;color:var(--label);margin-bottom:6px">No Results</b>for “' + esc(q) + '”</div>')); }
    body.appendChild(out);
  }

  OS.registerApp({
    id: 'appstore', name: 'App Store', system: true, statusBar: 'auto',
    icon: { bg: 'linear-gradient(180deg,#1ac8fc,#1a73f0)', glyph: '<svg viewBox="0 0 60 60"><g stroke="#fff" stroke-width="5" stroke-linecap="round" fill="none"><path d="M26.500 15.500 37.800 35M33.500 15.500 18.200 42M13.500 35h22M41.500 35h5M38.800 36.800l3 5.200"/></g></svg>' },
    launch(ctx) {
      ctxRef = ctx; root = ctx.root;
      root.innerHTML = TABS.map(([id]) => `<div class="as-tab" data-t="${id}"></div>`).join('') + `<div class="ios-tabbar">${TABS.map(([id, label, svg]) => `<div class="ios-tab" data-t="${id}">${svg}<span>${label}</span></div>`).join('')}</div>`;
      root.querySelectorAll('.ios-tab').forEach((t) => t.addEventListener('click', () => { if (curTab === t.dataset.t) navs[curTab].popToRoot(); show(t.dataset.t); OS.haptic('selection'); }));
      TABS.forEach(([id]) => { navs[id] = null; });
      fetch('/api/store-catalog').then((r) => r.json()).catch(() => []).then((list) => { catalog = (list || []).map((a) => ({ kind: 'store', ...a })); rebuild(); show(curTab); });
      OS.on('apps:change', () => root.querySelectorAll('.as-get').forEach((x) => x._paint && OS.webapps.installing[x.dataset.appid] == null && x._paint()));
    },
    onResume(ctx, params) { if (params && params.app) { const a = all().find((x) => x.id === params.app); if (a && navs.apps) { show('apps'); navs.apps.push(detail(a, navs.apps)); } } else if (params && params.refresh && navs.today) { rebuild(); show(curTab); } },
  });
  OS.appstore = { refresh() { if (root && navs.today) { rebuild(); show(curTab); } } };
})();
