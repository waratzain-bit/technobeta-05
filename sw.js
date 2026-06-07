const CACHE_NAME = "aurafeed-pwa-cache-v1";
const ASSETS_TO_CACHE = [
  "/",
  "/index.html",
  "/manifest.json",
  "/icon-512.png"
];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then((cache) => {
        return cache.addAll(ASSETS_TO_CACHE).catch((err) => {
          console.warn("Pre-caching assets failed, caching core only...", err);
          return cache.addAll(["/", "/index.html", "/manifest.json"]);
        });
      })
      .then(() => self.skipWaiting())
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys()
      .then((cacheNames) => {
        return Promise.all(
          cacheNames.map((cacheName) => {
            if (cacheName !== CACHE_NAME) {
              return caches.delete(cacheName);
            }
          })
        );
      })
      .then(() => self.clients.claim())
  );
});

self.addEventListener("fetch", (event) => {
  const url = new URL(event.request.url);
  
  // Skip caching for non-GET requests or dynamic routes / external services
  if (
    event.request.method !== "GET" ||
    url.pathname.startsWith("/api/") ||
    event.request.url.includes("google-analytics") || 
    event.request.url.includes("googleapis") ||
    event.request.url.includes("googleusercontent")
  ) {
    return;
  }

  event.respondWith(
    caches.match(event.request).then((cachedResponse) => {
      // Network first with cache fallback pattern, or stale-while-revalidate for faster loads
      if (cachedResponse) {
        // Fetch new copy in background to keep cache fresh
        fetch(event.request)
          .then((networkResponse) => {
            if (networkResponse && networkResponse.status === 200) {
              caches.open(CACHE_NAME).then((cache) => cache.put(event.request, networkResponse));
            }
          })
          .catch(() => {});
        return cachedResponse;
      }

      return fetch(event.request)
        .then((response) => {
          if (!response || response.status !== 200 || response.type !== "basic") {
            return response;
          }

          const responseToCache = response.clone();
          caches.open(CACHE_NAME).then((cache) => {
            cache.put(event.request, responseToCache);
          });

          return response;
        })
        .catch(() => {
          // Fallback offline handler
          if (event.request.mode === "navigate") {
            return caches.match("/");
          }
        });
    })
  );
});
