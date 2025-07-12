const CACHE_NAME = 'expense-tracker-cache-v1';
const urlsToCache = [
  '/',
  '/index.html',
  '/css/style.css', // This will be handled by Tailwind in React, but included for completeness if a separate CSS file were used.
  '/js/app.js',     // This will be your bundled React app.
  '/manifest.json',
  // Add paths for your icons here. Make sure these exist in your 'public' folder.
  '/icons/icon-192x192.png',
  '/icons/icon-512x512.png'
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then((cache) => {
        console.log('Opened cache');
        return cache.addAll(urlsToCache);
      })
      .catch(error => {
        console.error('Failed to open cache or add URLs:', error);
      })
  );
});

self.addEventListener('fetch', (event) => {
  event.respondWith(
    caches.match(event.request)
      .then((response) => {
        // Cache hit - return response
        if (response) {
          return response;
        }
        // No cache hit - fetch from network
        return fetch(event.request).catch(() => {
          // If network fails, you could return an offline fallback page
          // For example, caches.match('/offline.html');
          console.log('Network request failed and no cache match for:', event.request.url);
          // Return a generic offline response or a specific fallback for images/assets
          if (event.request.mode === 'navigate') {
            // For navigation requests, you might want to return a specific offline page
            // return caches.match('/offline.html'); // You would need to create an offline.html
          }
          // For other assets, just let the fetch error propagate or return a placeholder
          return new Response('Network is unavailable and no cache found.', { status: 503, statusText: 'Service Unavailable' });
        });
      })
  );
});

self.addEventListener('activate', (event) => {
  const cacheWhitelist = [CACHE_NAME];
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames.map((cacheName) => {
          if (cacheWhitelist.indexOf(cacheName) === -1) {
            console.log('Deleting old cache:', cacheName);
            return caches.delete(cacheName);
          }
        })
      );
    })
  );
});
