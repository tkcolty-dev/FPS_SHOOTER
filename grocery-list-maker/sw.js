const CACHE = "tote-v8";
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

  // Navigations: try the network for freshness, but fall back to the cached
  // shell instantly when offline or slow — so it works as a true offline app.
  if (req.mode === "navigate") {
    e.respondWith((async () => {
      const cached = await caches.match("./index.html");
      const net = fetch(req).then(res => {
        caches.open(CACHE).then(c => c.put("./index.html", res.clone())).catch(() => {});
        return res;
      });
      if (!cached) {
        try { return await net; } catch (e) { return (await caches.match("./")) || Response.error(); }
      }
      // Have a cached copy: prefer a fresh response, but don't wait more than ~2.5s.
      const timeout = new Promise(r => setTimeout(() => r(null), 2500));
      const res = await Promise.race([net.catch(() => null), timeout]);
      return res || cached;
    })());
    return;
  }

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
