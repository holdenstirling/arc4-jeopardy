const CACHE = 'jeopardy-v46';
const ASSETS = [
  '/',
  '/play',
  '/builder',
  '/library',
  '/manifest.json',
  '/icon-192.png',
  '/icon-512.png',
  '/buzzer'
];

// Install: pre-cache all core assets
self.addEventListener('install', e => {
  e.waitUntil(
    caches.open(CACHE).then(c => c.addAll(ASSETS))
  );
  self.skipWaiting();
});

// Activate: delete old caches
self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys().then(keys =>
      Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k)))
    )
  );
  self.clients.claim();
});

// Fetch strategy:
//  - HTML / navigation requests  -> NETWORK-FIRST (always get the latest app,
//    fall back to cache only when offline). This prevents stale pages.
//  - Everything else (icons, etc) -> cache-first.
self.addEventListener('fetch', e => {
  // Only handle same-origin GET requests
  if (e.request.method !== 'GET') return;

  const isHTML =
    e.request.mode === 'navigate' ||
    e.request.destination === 'document' ||
    (e.request.headers.get('accept') || '').includes('text/html');

  if (isHTML) {
    // Network-first for pages
    e.respondWith(
      fetch(e.request)
        .then(response => {
          if (response && response.status === 200) {
            const clone = response.clone();
            caches.open(CACHE).then(c => c.put(e.request, clone));
          }
          return response;
        })
        .catch(() =>
          caches.match(e.request).then(cached => cached || caches.match('/index.html'))
        )
    );
    return;
  }

  // Cache-first for static assets
  e.respondWith(
    caches.match(e.request).then(cached => {
      if (cached) return cached;
      return fetch(e.request).then(response => {
        if (response && response.status === 200) {
          const clone = response.clone();
          caches.open(CACHE).then(c => c.put(e.request, clone));
        }
        return response;
      }).catch(() => caches.match('/index.html'));
    })
  );
});
