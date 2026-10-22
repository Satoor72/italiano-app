const CACHE = 'ncx-italiano-v16';
const CORE = ['./index.html', './style.css', './data1.js', './data2.js', './audio_index.js', './app.js'];
const ASSETS = [
  './index.html',
  './style.css',
  './data1.js',
  './data2.js',
  './audio_index.js',
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
  const req = e.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  const isCode = /\.(html|js|json)$/.test(url.pathname) || url.pathname.endsWith('/');
  if (isCode) {
    e.respondWith(
      fetch(req).then(resp => {
        const clone = resp.clone();
        caches.open(CACHE).then(c => c.put(req, clone));
        return resp;
      }).catch(() => caches.match(req).then(c => c || caches.match('./index.html')))
    );
    return;
  }
  e.respondWith(
    caches.match(req).then(cached =>
      cached ||
      fetch(req).then(resp => {
        if (resp.ok) {
          const clone = resp.clone();
          caches.open(CACHE).then(c => c.put(req, clone));
        }
        return resp;
      }).catch(() => caches.match('./index.html'))
    )
  );
});
