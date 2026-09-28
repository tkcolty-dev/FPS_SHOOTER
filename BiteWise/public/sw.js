// BiteWise service worker — the whole app shell is cached so BiteWise opens and works with no internet.
// Bump VERSION when shipping changes; the page picks up the new files on the next open.
const VERSION = 'bitewise-v22';
const SHELL = ['/', '/index.html', '/styles.css', '/app.js', '/data.js', '/parse.js', '/foods.js', '/manifest.webmanifest', '/icons/icon.svg', '/icons/icon-180.png', '/icons/icon-192.png', '/icons/icon-512.png', '/usda-foods.json', '/version.json'];

// cache each file on its own so one slow/failed file (like the big food list) can't block the whole update
self.addEventListener('install', e => { e.waitUntil(caches.open(VERSION).then(c => Promise.allSettled(SHELL.map(u => fetch(u, { cache: 'no-store' }).then(r => r.ok && c.put(u === '/' ? '/index.html' : u, r))))).then(() => self.skipWaiting())); });
self.addEventListener('activate', e => { e.waitUntil(caches.keys().then(ks => Promise.all(ks.filter(k => k !== VERSION).map(k => caches.delete(k)))).then(() => self.clients.claim())); });

self.addEventListener('fetch', e => {
  const url = new URL(e.request.url);
  if (e.request.method !== 'GET' || url.origin !== location.origin) return;
  if (url.pathname.startsWith('/api/')) {
    // status is cached so the app knows whether the coach exists even offline; everything else is network-only
    if (url.pathname === '/api/status') e.respondWith(fetch(e.request).then(r => { const c = r.clone(); caches.open(VERSION).then(x => x.put(e.request, c)); return r; }).catch(() => caches.match(e.request).then(r => r || new Response('{"ok":false,"ai":false}', { headers: { 'Content-Type': 'application/json' } }))));
    return;
  }
  // app shell: network first (so updates show up right away), falling back to the cache when offline or slow
  const key = e.request.mode === 'navigate' ? '/index.html' : url.pathname;
  e.respondWith((async () => {
    const cache = await caches.open(VERSION);
    try {
      // wait longer for the page itself; fall back to the saved copy only when the network is really gone or very slow
      const wait = e.request.mode === 'navigate' || /\.(js|css|json)$/.test(url.pathname) ? 9000 : 4000;
      const r = await Promise.race([e.request.mode === 'navigate' ? fetch(e.request) : fetch(e.request.url, { cache: 'no-cache', credentials: 'same-origin' }), new Promise((_, rej) => setTimeout(() => rej(new Error('slow')), wait))]);
      if (r.ok) { cache.put(key, r.clone()); return r; }
      // server hiccup (like a 503 while it restarts): use the saved copy if there is one
      if (r.status >= 500) { const hit = await cache.match(key); if (hit) return hit; }
      return r;
    } catch {
      return (await cache.match(key)) || (await cache.match('/index.html')) || Response.error();
    }
  })());
});
