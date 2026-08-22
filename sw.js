const WORKER_VERSION = '18';
const CACHE = 'auralis-runtime-v18';
const CACHE_PREFIXES = ['auralis-shell-', 'auralis-runtime-'];
const OFFLINE_FALLBACK = new URL('./index.html', self.location.href).href;
const PRECACHE = [
  new URL('./index.html', self.location.href).href,
  new URL('./assets/icon.svg', self.location.href).href
];

function isCacheable(response) {
  return Boolean(response && response.ok && (response.type === 'basic' || response.type === 'default'));
}

async function putSafe(cache, request, response) {
  if (!isCacheable(response)) return response;
  try { await cache.put(request, response.clone()); } catch {}
  return response;
}

async function networkFirst(request, fallbackRequest = request) {
  const cache = await caches.open(CACHE);
  try {
    const response = await fetch(request);
    await putSafe(cache, fallbackRequest, response);
    return response;
  } catch (error) {
    const cached = await cache.match(fallbackRequest, { ignoreSearch: false });
    if (cached) return cached;
    throw error;
  }
}

async function staleWhileRevalidate(request) {
  const cache = await caches.open(CACHE);
  const cached = await cache.match(request);
  const refresh = fetch(request)
    .then(response => putSafe(cache, request, response))
    .catch(() => null);
  if (cached) {
    refresh.catch(() => {});
    return cached;
  }
  return (await refresh) || Response.error();
}

self.addEventListener('install', event => {
  // Updates intentionally remain in the waiting state. The page-side update
  // manager activates them only when playback is idle (or the user accepts
  // the refresh), preventing mid-song/mid-runtime worker takeovers.
  event.waitUntil((async () => {
    const cache = await caches.open(CACHE);
    await Promise.allSettled(PRECACHE.map(async url => {
      const request = new Request(url, { cache: 'reload' });
      try {
        const response = await fetch(request);
        await putSafe(cache, url, response);
      } catch {}
    }));
  })());
});

self.addEventListener('message', event => {
  const type = event.data?.type;
  if (type === 'AURALIS_VERSION') {
    const port = event.ports?.[0];
    if (port) port.postMessage({ version: WORKER_VERSION, cache: CACHE });
    else event.source?.postMessage?.({ type: 'AURALIS_VERSION', version: WORKER_VERSION, cache: CACHE });
    return;
  }
  if (type === 'SKIP_WAITING') self.skipWaiting();
});

self.addEventListener('activate', event => {
  event.waitUntil((async () => {
    const keys = await caches.keys();
    await Promise.all(keys
      .filter(key => CACHE_PREFIXES.some(prefix => key.startsWith(prefix)) && key !== CACHE)
      .map(key => caches.delete(key)));
    await self.clients.claim();
  })());
});

self.addEventListener('fetch', event => {
  const request = event.request;
  if (request.method !== 'GET') return;

  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;

  if (url.pathname.startsWith('/api/')) {
    // API responses remain live/network driven. Server-side endpoints own
    // their own caching policies and should never be trapped in a PWA shell.
    event.respondWith(fetch(request));
    return;
  }

  if (request.mode === 'navigate') {
    event.respondWith((async () => {
      try {
        return await networkFirst(request, OFFLINE_FALLBACK);
      } catch {
        return (await caches.match(OFFLINE_FALLBACK)) || Response.error();
      }
    })());
    return;
  }

  const destination = request.destination;
  if (destination === 'script' || destination === 'style' || destination === 'worker' || destination === 'manifest') {
    // Version-sensitive runtime assets always revalidate from the network
    // first. Cached copies are fallback-only, so new HTML cannot be paired
    // with an old JavaScript/CSS runtime.
    event.respondWith(networkFirst(request));
    return;
  }

  if (destination === 'image' || destination === 'font') {
    event.respondWith(staleWhileRevalidate(request));
    return;
  }

  // Everything else prefers the network and only falls back to a matching
  // response from this worker's own versioned cache.
  event.respondWith(networkFirst(request));
});
