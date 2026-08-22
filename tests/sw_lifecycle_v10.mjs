import fs from 'node:fs';
import vm from 'node:vm';
import assert from 'node:assert/strict';

const source = fs.readFileSync(new URL('../sw.js', import.meta.url), 'utf8');

class MemoryCache {
  constructor() { this.map = new Map(); }
  key(request) { return typeof request === 'string' ? request : request?.url || String(request); }
  async put(request, response) { this.map.set(this.key(request), response.clone()); }
  async match(request) { return this.map.get(this.key(request))?.clone() || undefined; }
  async delete(request) { return this.map.delete(this.key(request)); }
}

function createRuntime(initialNames = []) {
  const listeners = new Map();
  const stores = new Map(initialNames.map(name => [name, new MemoryCache()]));
  const stats = { skipWaiting: 0, claims: 0, navigations: [], fetches: [] };
  let networkText = 'network';

  const caches = {
    async keys() { return [...stores.keys()]; },
    async open(name) {
      if (!stores.has(name)) stores.set(name, new MemoryCache());
      return stores.get(name);
    },
    async delete(name) { return stores.delete(name); },
    async match(request) {
      for (const cache of stores.values()) {
        const hit = await cache.match(request);
        if (hit) return hit;
      }
      return undefined;
    }
  };

  const client = {
    url: 'https://auralis.example/?from=legacy',
    async navigate(url) { stats.navigations.push(url); this.url = url; return this; }
  };

  const self = {
    location: { href: 'https://auralis.example/sw.js', origin: 'https://auralis.example' },
    addEventListener(type, listener) { listeners.set(type, listener); },
    async skipWaiting() { stats.skipWaiting += 1; },
    clients: {
      async claim() { stats.claims += 1; },
      async matchAll() { return [client]; }
    }
  };

  const fetch = async request => {
    const url = typeof request === 'string' ? request : request?.url || String(request);
    stats.fetches.push(url);
    return new Response(`${networkText}:${url}`, { status: 200, headers: { 'content-type': 'text/plain' } });
  };

  const context = vm.createContext({
    self, caches, fetch, Request, Response, URL, Promise, console,
    setTimeout, clearTimeout
  });
  vm.runInContext(source, context, { filename: 'sw.js' });

  async function waitEvent(type, extra = {}) {
    const listener = listeners.get(type);
    assert.ok(listener, `${type} listener missing`);
    let task = Promise.resolve();
    listener({ ...extra, waitUntil(promise) { task = Promise.resolve(promise); } });
    await task;
  }

  async function responseEvent(request) {
    const listener = listeners.get('fetch');
    assert.ok(listener, 'fetch listener missing');
    let responsePromise = null;
    listener({ request, respondWith(value) { responsePromise = Promise.resolve(value); } });
    assert.ok(responsePromise, `request was not handled: ${request.url}`);
    return responsePromise;
  }

  return {
    listeners, stores, stats, caches, waitEvent, responseEvent,
    setNetworkText(value) { networkText = value; }
  };
}

// A returning v15-v17 user gets the one-time emergency bridge: stale shell
// cache is removed, v18 activates immediately, claims, and reloads once.
{
  const runtime = createRuntime(['auralis-shell-v17']);
  await runtime.waitEvent('install');
  assert.equal(runtime.stats.skipWaiting, 1, 'legacy shell migration must activate v18 once');
  assert.equal(runtime.stores.has('auralis-shell-v17'), false, 'legacy shell cache must be retired during migration');
  assert.equal(runtime.stores.has('auralis-runtime-v18'), true, 'v18 cache must be created');

  await runtime.waitEvent('activate');
  assert.equal(runtime.stats.claims, 1, 'migrated worker must claim the clean runtime');
  assert.equal(runtime.stats.navigations.length, 1, 'legacy client must be reloaded once');
  assert.match(runtime.stats.navigations[0], /auralis-sw-migrated=18/, 'reload must carry loop guard');
}

// Clean installs / future v18+ updates do not force skipWaiting or navigation.
{
  const runtime = createRuntime([]);
  await runtime.waitEvent('install');
  assert.equal(runtime.stats.skipWaiting, 0, 'normal install must wait for controlled activation');
  await runtime.waitEvent('activate');
  assert.equal(runtime.stats.claims, 1);
  assert.equal(runtime.stats.navigations.length, 0, 'normal activation must not force page navigation');
}

// The worker reports its version and supports explicit page-controlled activation.
{
  const runtime = createRuntime([]);
  let reported = null;
  const message = runtime.listeners.get('message');
  message({ data: { type: 'AURALIS_VERSION' }, ports: [{ postMessage(value) { reported = value; } }] });
  assert.equal(reported?.version, '18');
  assert.equal(reported?.cache, 'auralis-runtime-v18');

  message({ data: { type: 'SKIP_WAITING' }, ports: [] });
  await Promise.resolve();
  assert.equal(runtime.stats.skipWaiting, 1, 'explicit activation message must call skipWaiting');
}

// Version-sensitive JavaScript is network-first even if a stale-looking cache
// entry exists, preventing new HTML + old JS mixed runtimes.
{
  const runtime = createRuntime(['auralis-runtime-v18']);
  const cache = await runtime.caches.open('auralis-runtime-v18');
  const request = { method: 'GET', url: 'https://auralis.example/js/app-v3.js', destination: 'script', mode: 'cors' };
  await cache.put(request, new Response('cached-old', { status: 200 }));
  runtime.setNetworkText('fresh-network');
  const response = await runtime.responseEvent(request);
  const text = await response.text();
  assert.match(text, /^fresh-network:/, 'runtime JavaScript must prefer the network over cache');
}

// APIs are passed straight to the network and are not trapped in the shell.
{
  const runtime = createRuntime([]);
  runtime.setNetworkText('api-network');
  const request = { method: 'GET', url: 'https://auralis.example/api/youtube?title=test', destination: '', mode: 'cors' };
  const response = await runtime.responseEvent(request);
  assert.match(await response.text(), /^api-network:/);
}

console.log('Auralis Stability v10 service-worker lifecycle tests passed');
