// Hosts App Store apps, App Maker apps and web clips: each runs in an <iframe> and talks to the OS through /sdk.js.
(function () {
  const { el, esc } = OS.util;
  const frames = new Map();   // appId -> iframe
  let sdkText = '';
  fetch('/sdk.js').then((r) => r.text()).then((t) => { sdkText = t; }).catch(() => {});

  const load = () => OS.store.get('webapps', []);
  const save = (l) => OS.store.set('webapps', l);

  function post(id, msg) { const f = frames.get(id); if (f && f.contentWindow) { try { f.contentWindow.postMessage({ __iphoneHost: true, ...msg }, '*'); } catch {} } }
  const theme = () => (OS.settings.get('darkMode') ? 'dark' : 'light');

  function makerDoc(entry) {
    const html = String(entry.html || '');
    const boot = `<script>${sdkText}<\/script><style>html,body{margin:0;height:100%}body{font-family:system-ui,-apple-system,'SF Pro Text','Helvetica Neue',sans-serif;-webkit-tap-highlight-color:transparent}::-webkit-scrollbar{display:none}</style>`;
    if (/<head[^>]*>/i.test(html)) return html.replace(/<head[^>]*>/i, (m) => m + '<meta name="viewport" content="width=device-width,initial-scale=1">' + boot);
    return `<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">${boot}</head><body>${html}</body></html>`;
  }

  function defFor(entry) {
    return {
      id: entry.id, name: entry.name, icon: entry.icon || { bg: '#8E8E93', glyph: (entry.name || '?')[0] }, system: false,
      statusBar: entry.statusBar || 'auto', background: '#000', category: entry.category, store: entry, webapp: true,
      launch(ctx) {
        const host = el(`<div class="webapp-host"><div class="webapp-splash">${OS.iconHTML({ name: entry.name, icon: entry.icon })}</div></div>`);
        const f = document.createElement('iframe');
        f.setAttribute('allow', 'camera; microphone; geolocation; autoplay; fullscreen; clipboard-write');
        if (entry.kind === 'maker') { f.setAttribute('sandbox', 'allow-scripts allow-forms allow-modals allow-pointer-lock allow-downloads'); f.srcdoc = makerDoc(entry); }
        else if (entry.kind === 'web') { f.setAttribute('sandbox', 'allow-scripts allow-same-origin allow-forms allow-popups allow-modals allow-pointer-lock allow-downloads'); f.src = entry.proxy ? '/proxy?url=' + encodeURIComponent(entry.url) : entry.url; }
        else { f.src = entry.url; }
        const splash = host.firstElementChild; let gone = false;
        const reveal = () => { if (gone) return; gone = true; splash.classList.add('out'); setTimeout(() => splash.remove(), 400); post(entry.id, { type: 'theme', theme: theme() }); };
        f.addEventListener('load', () => setTimeout(reveal, 250)); setTimeout(reveal, 4000);
        host.appendChild(f); ctx.root.appendChild(host); frames.set(entry.id, f);
      },
      onResume() { post(entry.id, { type: 'theme', theme: theme() }); post(entry.id, { type: 'resume' }); const f = frames.get(entry.id); f && setTimeout(() => { try { f.contentWindow.focus(); } catch {} }, 350); },
      onPause() { post(entry.id, { type: 'pause' }); },
      onClose() { frames.delete(entry.id); },
    };
  }

  const W = OS.webapps = {
    installing: {},
    list: load,
    get(id) { return load().find((e) => e.id === id) || null; },
    isWebApp(id) { return !!W.get(id); },
    isInstalled(id) { return !!W.get(id); },
    // entry: { id, name, icon, kind:'store'|'maker'|'web', url?, html?, statusBar?, category?, proxy? }
    install(entry, opts = {}) {
      const list = load().filter((e) => e.id !== entry.id); list.push(entry); save(list);
      OS.killApp(entry.id);
      const removed = OS.store.get('home.removed', []).filter((x) => x !== entry.id); OS.store.set('home.removed', removed);
      if (opts.animate === false) { OS.registerApp(defFor(entry)); return Promise.resolve(); }
      return new Promise((resolve) => {
        W.installing[entry.id] = 0; OS.registerApp(defFor(entry));
        const t0 = performance.now(), dur = opts.duration || 2600;
        const step = () => {
          const p = Math.min(1, (performance.now() - t0) / dur); W.installing[entry.id] = Math.round((1 - Math.pow(1 - p, 2)) * 100);
          const pie = document.querySelector(`#home .icon-slot[data-app="${CSS.escape(entry.id)}"] .icon-progress i`); if (pie) pie.style.setProperty('--p', W.installing[entry.id] + '%'); else OS.emit('webapps:progress');
          if (p < 1) return requestAnimationFrame(step);
          delete W.installing[entry.id]; OS.emit('webapps:progress'); OS.haptic('success'); resolve();
        };
        requestAnimationFrame(step);
      });
    },
    update(id, patch) { const list = load(); const e = list.find((x) => x.id === id); if (!e) return; Object.assign(e, patch); save(list); OS.killApp(id); OS.registerApp(defFor(e)); },
    uninstall(id) { save(load().filter((e) => e.id !== id)); OS.store.keys('appdata.' + id + '.').forEach((k) => OS.store.remove(k)); OS.unregisterApp(id); },
  };

  // SDK bridge
  window.addEventListener('message', (e) => {
    const d = e.data; if (!d || !d.__iphone) return;
    let id = null; frames.forEach((f, k) => { if (f.contentWindow === e.source) id = k; });
    if (!id) { if (OS.maker && OS.maker.onPreviewMessage) OS.maker.onPreviewMessage(e); return; }
    const reply = (value) => { try { e.source.postMessage({ __iphoneHost: true, type: 'reply', reqId: d.reqId, value }, '*'); } catch {} };
    const p = OS.procs.get(id); const key = 'appdata.' + id + '.' + String(d.key || '').slice(0, 80);
    switch (d.type) {
      case 'ready': post(id, { type: 'theme', theme: theme() }); break;
      case 'haptic': OS.haptic(d.value); break;
      case 'sound': if (typeof d.value === 'string') OS.sound.play(d.value.slice(0, 60)); break;
      case 'notify': { const def = OS.getApp(id); OS.notify({ appId: id, title: String(d.title || def.name).slice(0, 80), body: String(d.body || '').slice(0, 240) }); break; }
      case 'statusbar': if (p && /^(light|dark|auto)$/.test(d.value)) p.ctx.setStatusBar(d.value); break;
      case 'close': if (OS.activeApp === id) OS.goHome(); break;
      case 'openurl': if (/^(https?:|tel:|sms:|mailto:)/i.test(d.value)) OS.openURL(d.value); break;
      case 'storage.get': reply(OS.store.get(key, null)); break;
      case 'storage.set': try { if (JSON.stringify(d.value).length < 400000) OS.store.set(key, d.value); } catch {} reply(true); break;
      case 'storage.remove': OS.store.remove(key); reply(true); break;
    }
  });
  OS.on('themechange', (t) => frames.forEach((f, id) => post(id, { type: 'theme', theme: t })));

  OS.initWebApps = function () { load().forEach((e) => OS.registerApp(defFor(e))); };
})();
