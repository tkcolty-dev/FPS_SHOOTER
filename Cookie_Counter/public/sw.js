const CACHE_NAME = 'cc-v1';

const APP_SHELL = [
  '/',
  '/index.html',
  '/cookies/thin-mints.png',
  '/cookies/caramel-delites.png',
  '/cookies/pb-patties.png',
  '/cookies/pb-sandwich.png',
  '/cookies/adventurefuls.png',
  '/cookies/exploremores.png',
  '/cookies/lemonades.png',
  '/cookies/trefoils.png',
];

// Install: cache app shell
self.addEventListener('install', (e) => {
  e.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(APP_SHELL))
  );
  self.skipWaiting();
});

// Activate: clean old caches
self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((k) => k !== CACHE_NAME).map((k) => caches.delete(k)))
    )
  );
  self.clients.claim();
});

// Fetch strategy
self.addEventListener('fetch', (e) => {
  const { request } = e;
  const url = new URL(request.url);

  // API calls: network-first, no cache fallback (handled by app layer)
  if (url.pathname.startsWith('/api')) {
    return;
  }

  // Static assets (images, fonts): cache-first
  if (
    request.destination === 'image' ||
    request.destination === 'font' ||
    url.hostname === 'fonts.googleapis.com' ||
    url.hostname === 'fonts.gstatic.com'
  ) {
    e.respondWith(
      caches.match(request).then((cached) => {
        if (cached) return cached;
        return fetch(request).then((res) => {
          if (res.ok) {
            const clone = res.clone();
            caches.open(CACHE_NAME).then((cache) => cache.put(request, clone));
          }
          return res;
        });
      })
    );
    return;
  }

  // App shell (HTML, JS, CSS): network-first, fallback to cache
  e.respondWith(
    fetch(request)
      .then((res) => {
        if (res.ok) {
          const clone = res.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put(request, clone));
        }
        return res;
      })
      .catch(() => caches.match(request).then((cached) => cached || caches.match('/')))
  );
});
