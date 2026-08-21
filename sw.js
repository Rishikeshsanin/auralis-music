const CACHE='auralis-shell-v13';
const SHELL=[
  './','./index.html','./styles.css','./fixes.css','./experience.css','./experience-v3.css','./experience-v4.css','./experience-v5.css','./experience-v6.css','./experience-v7.css','./experience-v7-aura.css','./experience-v8-aura.css','./experience-v9.css',
  './js/app-v3.js','./js/row-play-targets.js','./js/radio-reliability-v6.js','./js/auralis-experience-v7.js','./js/konkani-radio-v7.js','./js/music-graph-v9.js','./js/store.js','./js/fallback.js','./js/collections.js','./js/library-map.js',
  './js/providers/audius.js','./js/providers/jamendo.js','./js/providers/radio-browser.js',
  './js/providers/catalog-manager.js','./assets/icon.svg'
];

self.addEventListener('install', event => {
  self.skipWaiting();
  event.waitUntil(caches.open(CACHE).then(cache => cache.addAll(SHELL)));
});

self.addEventListener('activate', event => {
  event.waitUntil(Promise.all([
    self.clients.claim(),
    caches.keys().then(keys => Promise.all(keys.filter(key => key !== CACHE).map(key => caches.delete(key))))
  ]));
});

self.addEventListener('fetch', event => {
  if (event.request.method !== 'GET') return;
  const url = new URL(event.request.url);
  if (url.origin !== location.origin) return;

  if (url.pathname.startsWith('/api/')) {
    event.respondWith(fetch(event.request));
    return;
  }

  if (event.request.mode === 'navigate') {
    event.respondWith(fetch(event.request).then(response => {
      const copy = response.clone();
      caches.open(CACHE).then(cache => cache.put('./index.html', copy));
      return response;
    }).catch(() => caches.match('./index.html')));
    return;
  }

  event.respondWith(caches.match(event.request).then(cached => cached || fetch(event.request).then(response => {
    const copy = response.clone();
    caches.open(CACHE).then(cache => cache.put(event.request, copy));
    return response;
  })));
});