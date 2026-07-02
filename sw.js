// Rede primeiro, cache como reserva offline. O build troca __BUILD_ID__ a cada deploy.
const CACHE_NAME = 'corpo-bem-__BUILD_ID__';
const ASSETS_TO_CACHE = [
  '/index.html',
  '/css/style.css',
  '/js/main.js',
  '/manifest.json',
  '/assets/icons/icon-192.svg',
  '/assets/icons/icon-512.svg'
];

self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME).then(cache =>
      cache.addAll(ASSETS_TO_CACHE).catch(err => console.warn('Alguns assets não puderam ser cacheados:', err))
    )
  );
  self.skipWaiting();
});

self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys().then(keys => Promise.all(keys.filter(k => k !== CACHE_NAME).map(k => caches.delete(k))))
  );
  self.clients.claim();
});

self.addEventListener('fetch', event => {
  const url = event.request.url;
  if (!url.startsWith('http')) return;
  const skipDomains = ['firestore.googleapis.com', 'firebase', 'gstatic.com/firebasejs', 'googleapis.com', 'placeholder.com', 'cdn.jsdelivr.net', 'cdnjs.cloudflare.com'];
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
      .catch(() => caches.match(event.request).then(cached => {
        if (cached) return cached;
        if (event.request.mode === 'navigate') return caches.match('/index.html');
      }))
  );
});

// ===== PUSH: recebe e exibe notificações mesmo com o app fechado =====
self.addEventListener('push', event => {
  let data = {};
  try { data = event.data ? event.data.json() : {}; } catch (e) { data = { title: 'Corpo Bem', body: event.data ? event.data.text() : '' }; }
  const title = data.title || 'Corpo Bem';
  const options = {
    body: data.body || '',
    icon: 'assets/icons/icon-192.svg',
    badge: 'assets/icons/icon-192.svg',
    data: { url: data.url || '/index.html' }
  };
  event.waitUntil(self.registration.showNotification(title, options));
});

self.addEventListener('notificationclick', event => {
  event.notification.close();
  const url = (event.notification.data && event.notification.data.url) || '/index.html';
  event.waitUntil(
    self.clients.matchAll({ type: 'window' }).then(clientsArr => {
      const existing = clientsArr.find(c => c.url.includes(self.registration.scope));
      // App já aberto: navega pra URL da notificação (ex.: ?action=quick-water) em vez de só focar e perder a ação.
      const alvo = new URL(url, self.registration.scope).href;
      if (existing) return existing.navigate(alvo).then(c => (c || existing).focus());
      return self.clients.openWindow(alvo);
    })
  );
});
