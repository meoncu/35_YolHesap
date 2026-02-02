self.addEventListener('install', () => {
    self.skipWaiting();
});

self.addEventListener('activate', () => {
    self.clients.claim();
});

self.addEventListener('fetch', (event) => {
    // Minimal fetch handler required for PWA installability
    event.respondWith(fetch(event.request));
});
