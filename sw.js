// Koveli Lounge Service Worker
const CACHE_NAME = 'koveli-cache-v1';
const ASSETS_TO_CACHE = [
  '.',
  'index.html',
  'manifest.json',
  // Add your other HTML pages here if they exist
  // 'checklist.html',
  // 'shower.html',
  // 'briefing.html',
  // 'handover.html',
  // 'survey.html',
  // 'maintenance.html',
  // 'roster.html'
];

// Install event - cache core assets
self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(cache => {
        console.log('✅ Service Worker: Caching assets');
        return cache.addAll(ASSETS_TO_CACHE);
      })
      .then(() => self.skipWaiting())
  );
});

// Activate event - clean old caches
self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys().then(cacheNames => {
      return Promise.all(
        cacheNames.map(cache => {
          if (cache !== CACHE_NAME) {
            console.log('🧹 Service Worker: Removing old cache', cache);
            return caches.delete(cache);
          }
        })
      );
    }).then(() => self.clients.claim())
  );
});

// Fetch event - serve from cache, fallback to network
self.addEventListener('fetch', event => {
  event.respondWith(
    caches.match(event.request)
      .then(cachedResponse => {
        // Return cached version if available
        if (cachedResponse) {
          return cachedResponse;
        }
        // Otherwise fetch from network
        return fetch(event.request)
          .then(response => {
            // Cache the new response for future
            if (response && response.status === 200) {
              const responseClone = response.clone();
              caches.open(CACHE_NAME).then(cache => {
                cache.put(event.request, responseClone);
              });
            }
            return response;
          })
          .catch(() => {
            // Offline fallback: return a simple offline page
            return new Response(
              '<h1>Koveli Lounge - Offline</h1><p>Please check your connection.</p>',
              { headers: { 'Content-Type': 'text/html' } }
            );
          });
      })
  );
});
