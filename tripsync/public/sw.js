// Minimal no-op Service Worker (prod only)
self.addEventListener('install', () => {
  // activate immediately on update
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  // take control of open pages
  event.waitUntil(self.clients.claim());
});

// No caching yet; all requests pass through to the network
self.addEventListener('fetch', () => {});