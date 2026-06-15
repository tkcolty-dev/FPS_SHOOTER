const CACHE = "quicklog-v8";
const ASSETS = ["./", "./index.html", "./manifest.json", "./icon.svg"];

self.addEventListener("install", e => {
  e.waitUntil(caches.open(CACHE).then(c => c.addAll(ASSETS)).then(() => self.skipWaiting()));
});

self.addEventListener("activate", e => {
  e.waitUntil(
    caches.keys().then(keys => Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener("fetch", e => {
  const req = e.request;
  if (req.method !== "GET") return;

  // Navigations: serve the cached app shell first so it always opens offline.
  if (req.mode === "navigate") {
    e.respondWith(
      caches.match("./index.html").then(cached =>
        cached || fetch(req).catch(() => caches.match("./index.html"))
      )
    );
    return;
  }

  // Everything else: cache-first, then network (and cache the result).
  e.respondWith(
    caches.match(req).then(cached =>
      cached || fetch(req).then(res => {
        if (res && res.status === 200 && res.type === "basic") {
          const copy = res.clone();
          caches.open(CACHE).then(c => c.put(req, copy)).catch(() => {});
        }
        return res;
      }).catch(() => cached)
    )
  );
});
