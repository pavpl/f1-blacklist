/* Offline-friendly shell. API data is cached by the app in localStorage. */
const CACHE = "f1-blacklist-v6";
const ASSETS = [
  "./",
  "./index.html",
  "./styles.css",
  "./app.js",
  "./calc.js",
  "./api.js",
  "./data.js",
  "./render.js",
  "./assets/flags/ar.svg",
  "./assets/flags/au.svg",
  "./assets/flags/br.svg",
  "./assets/flags/ca.svg",
  "./assets/flags/de.svg",
  "./assets/flags/es.svg",
  "./assets/flags/fi.svg",
  "./assets/flags/fr.svg",
  "./assets/flags/gb.svg",
  "./assets/flags/it.svg",
  "./assets/flags/jp.svg",
  "./assets/flags/mc.svg",
  "./assets/flags/mx.svg",
  "./assets/flags/nl.svg",
  "./assets/flags/nz.svg",
  "./assets/flags/th.svg",
  "./favicon.svg",
  "./site.webmanifest",
  "./icon-192.png",
  "./icon-512.png",
  "./apple-touch-icon.png",
];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE).then(async (cache) => {
      // Cache each shell asset independently: one unavailable icon must not
      // abort the whole installation and leave the app without a worker.
      await Promise.allSettled(ASSETS.map((asset) => cache.add(asset)));
      await self.skipWaiting();
    })
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.filter((key) => key !== CACHE).map((key) => caches.delete(key))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener("fetch", (event) => {
  const request = event.request;
  if (request.method !== "GET") return;

  const url = new URL(request.url);

  if (url.origin !== self.location.origin) return;

  if (request.mode === "navigate") {
    event.respondWith(
      fetch(request)
        .then((response) => {
          if (response.ok) {
            const copy = response.clone();
            caches.open(CACHE).then((cache) => cache.put(request, copy));
          }
          return response;
        })
        .catch(() => caches.match("./index.html"))
    );
    return;
  }

  event.respondWith(
    fetch(request)
      .then((response) => {
        if (response.ok) {
          const copy = response.clone();
          caches.open(CACHE).then((cache) => cache.put(request, copy));
        }
        return response;
      })
      .catch(() => caches.match(request))
  );
});
