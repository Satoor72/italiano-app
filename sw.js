const CACHE = 'ncx-italiano-v6';
const ASSETS = [
  './index.html',
  './style.css',
  './data1.js',
  './data2.js',
  './app.js',
  './manifest.json',
  './icon.svg',
  './icon-maskable.svg',
  './icon.png',
  './icon-192.png',
  './apple-touch-icon.png',
  './favicon-32.png',
  './hero-bg.jpg',
  './sections-bg.jpg'
];

self.addEventListener('install', e => {
  e.waitUntil(caches.open(CACHE).then(c => c.addAll(ASSETS)));
  self.skipWaiting();
});

self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys().then(keys =>
      Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k)))
    )
  );
  self.clients.claim();
});

self.addEventListener('fetch', e => {
  e.respondWith(
    caches.match(e.request).then(cached =>
      cached ||
      fetch(e.request).then(resp => {
        if (e.request.method === 'GET' && resp.ok) {
          const clone = resp.clone();
          caches.open(CACHE).then(c => c.put(e.request, clone));
        }
        return resp;
      }).catch(() => caches.match('./index.html'))
    )
  );
});
