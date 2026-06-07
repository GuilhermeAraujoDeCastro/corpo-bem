const CACHE_NAME = 'corpo-bem-v2';
const ASSETS_TO_CACHE = [
  '/index.html',
  '/Style.css',
  '/App.js',
  '/manifest.json'
];

self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME).then(cache => {
      return cache.addAll(ASSETS_TO_CACHE).catch(err => {
        console.warn('Alguns assets não puderam ser cacheados:', err);
      });
    })
  );
  self.skipWaiting();
});

self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys().then(keys =>
      Promise.all(keys.filter(k => k !== CACHE_NAME).map(k => caches.delete(k)))
    )
  );
  self.clients.claim();
});

self.addEventListener('fetch', event => {
  const url = event.request.url;

  // Ignora tudo que não seja http/https (ex: chrome-extension://)
  if (!url.startsWith('http')) return;

  // Ignora Firebase, Google APIs, CDNs externos, placeholders
  const skipDomains = [
    'firestore.googleapis.com',
    'firebase',
    'gstatic.com/firebasejs',
    'googleapis.com',
    'placeholder.com',
    'cdn.jsdelivr.net',
    'cdnjs.cloudflare.com'
  ];
  if (skipDomains.some(d => url.includes(d))) return;

  event.respondWith(
    fetch(event.request)
      .then(response => {
        if (response && response.status === 200 && response.type === 'basic') {
          const cloned = response.clone();
          caches.open(CACHE_NAME).then(cache => cache.put(event.request, cloned));
        }
        return response;
      })
      .catch(() => {
        return caches.match(event.request).then(cached => {
          if (cached) return cached;
          if (event.request.mode === 'navigate') {
            return caches.match('/index.html');
          }
        });
      })
  );
});