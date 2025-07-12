self.addEventListener("install", e => {
  e.waitUntil(
    caches.open("expense-tracker-cache").then(cache =>
      cache.addAll([
        "./",
        "./index.html",
        "./manifest.json",
        "./css/style.css",
        "./js/app.js"
      ])
    )
  );
});

self.addEventListener("fetch", e => {
  e.respondWith(
    caches.match(e.request).then(response => response || fetch(e.request))
  );
});
