// BiteWise service worker — the whole app shell is cached so BiteWise opens and works with no internet.
// Bump VERSION when shipping changes; the page picks up the new files on the next open.
const VERSION = 'bitewise-v8';
const SHELL = ['/', '/index.html', '/styles.css', '/app.js', '/data.js', '/parse.js', '/foods.js', '/manifest.webmanifest', '/icons/icon.svg', '/icons/icon-180.png', '/icons/icon-192.png', '/icons/icon-512.png'];

self.addEventListener('install', e => { e.waitUntil(caches.open(VERSION).then(c => c.addAll(SHELL)).then(() => self.skipWaiting())); });
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
      const r = await Promise.race([fetch(e.request), new Promise((_, rej) => setTimeout(() => rej(new Error('slow')), 3500))]);
      if (r.ok) cache.put(key, r.clone());
      return r;
    } catch {
      return (await cache.match(key)) || (await cache.match('/index.html')) || Response.error();
    }
  })());
});
