// ═══════════════════════════════════════════════
//  CORPO BEM — Service Worker (sw.js)
//  Versão: 1.0.0
// ═══════════════════════════════════════════════

const CACHE_NAME = "corpo-bem-v1";

// Arquivos para cache offline
const STATIC_ASSETS = [
  "/",
  "/index.html",
  "/style.css",
  "/app.js",
  "/manifest.json",
  "/icons/icon-192.png",
  "/icons/icon-512.png",
  "https://fonts.googleapis.com/css2?family=Bebas+Neue&family=DM+Sans:wght@300;400;500;600&family=Space+Mono:wght@400;700&display=swap",
  "https://cdn.jsdelivr.net/npm/canvas-confetti@1.9.2/dist/confetti.browser.min.js"
];

// ── INSTALL ──────────────────────────────────
self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      return cache.addAll(STATIC_ASSETS.map(url => {
        return new Request(url, { mode: "no-cors" });
      }));
    }).catch(() => {})
  );
  self.skipWaiting();
});

// ── ACTIVATE ─────────────────────────────────
self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(
        keys.filter(k => k !== CACHE_NAME).map(k => caches.delete(k))
      )
    )
  );
  self.clients.claim();
});

// ── FETCH ────────────────────────────────────
self.addEventListener("fetch", (event) => {
  // Skip non-GET requests and Firebase/API calls
  if (event.request.method !== "GET") return;
  if (event.request.url.includes("firebase") || event.request.url.includes("googleapis.com/identitytoolkit")) return;

  event.respondWith(
    caches.match(event.request).then((cached) => {
      if (cached) return cached;
      return fetch(event.request).then((response) => {
        // Cache successful responses
        if (response && response.status === 200 && response.type === "basic") {
          const copy = response.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put(event.request, copy));
        }
        return response;
      }).catch(() => {
        // Offline fallback
        if (event.request.destination === "document") {
          return caches.match("/index.html");
        }
      });
    })
  );
});

// ── PUSH NOTIFICATIONS ────────────────────────
self.addEventListener("push", (event) => {
  const data = event.data?.json() || {};
  const title = data.title || "Corpo Bem 💪";
  const options = {
    body: data.body || "Não esqueça do seu treino hoje!",
    icon: "/icons/icon-192.png",
    badge: "/icons/icon-192.png",
    vibrate: [200, 100, 200],
    data: { url: data.url || "/" }
  };
  event.waitUntil(self.registration.showNotification(title, options));
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  event.waitUntil(
    clients.openWindow(event.notification.data?.url || "/")
  );
});
