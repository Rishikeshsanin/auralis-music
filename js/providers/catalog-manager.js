import { audiusProvider } from './audius.js';
import { jamendoProvider } from './jamendo.js';
import { radioBrowserProvider } from './radio-browser.js';

const HOME_FEED_CACHE_KEY = 'auralis:home-feed:v2';
const HOME_FEED_CACHE_MAX = 36;
const HOME_FEED_FAST_TIMEOUT_MS = 1600;

function clean(value) {
  return String(value || '').toLowerCase().replace(/[^a-z0-9]+/g, '').slice(0, 90);
}

export function canonicalTrackKey(track) {
  return `${clean(track.title)}::${clean(track.artist)}`;
}

export function dedupeTracks(tracks) {
  const seen = new Set();
  return tracks.filter(track => {
    const key = canonicalTrackKey(track);
    if (!key || seen.has(key) || !track.streamUrl) return false;
    seen.add(key);
    return true;
  });
}

export function interleave(groups, limit = 50) {
  const pools = groups.filter(group => Array.isArray(group) && group.length).map(group => [...group]);
  const merged = [];
  while (pools.some(pool => pool.length) && merged.length < limit) {
    for (const pool of pools) {
      if (pool.length && merged.length < limit) merged.push(pool.shift());
    }
  }
  return dedupeTracks(merged).slice(0, limit);
}

function validCachedTrack(track) {
  return Boolean(
    track &&
    typeof track === 'object' &&
    track.id &&
    track.title &&
    track.artist &&
    track.provider &&
    track.streamUrl
  );
}

function readHomeFeedCache(limit = HOME_FEED_CACHE_MAX) {
  try {
    const raw = window.localStorage?.getItem(HOME_FEED_CACHE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    const tracks = Array.isArray(parsed?.tracks) ? parsed.tracks : [];
    return dedupeTracks(tracks.filter(validCachedTrack)).slice(0, limit);
  } catch {
    return [];
  }
}

function writeHomeFeedCache(tracks) {
  const safe = dedupeTracks((Array.isArray(tracks) ? tracks : []).filter(validCachedTrack)).slice(0, HOME_FEED_CACHE_MAX);
  if (!safe.length) return;
  try {
    window.localStorage?.setItem(HOME_FEED_CACHE_KEY, JSON.stringify({
      version: 2,
      savedAt: Date.now(),
      tracks: safe
    }));
  } catch {}
}

function timeoutValue(ms, value = []) {
  return new Promise(resolve => setTimeout(() => resolve(value), ms));
}

class CatalogManager {
  constructor() {
    this.songProviders = [audiusProvider, jamendoProvider];
    this.radioProvider = radioBrowserProvider;
    this.homeBootCacheUsed = false;
    this.health = new Map([
      ['Audius', 'checking'],
      ['Jamendo', jamendoProvider.usingTestClient ? 'demo' : 'checking'],
      ['Radio Browser', 'checking']
    ]);
    this.failures = new Map();
  }

  setHealth(name, status) {
    this.health.set(name, status);
    if (status === 'online' || status === 'demo') this.failures.set(name, 0);
  }

  noteFailure(name) {
    const count = (this.failures.get(name) || 0) + 1;
    this.failures.set(name, count);
    this.health.set(name, count >= 2 ? 'offline' : 'degraded');
  }

  async settle(provider, task) {
    try {
      const value = await task();
      const status = provider.name === 'Jamendo' && jamendoProvider.usingTestClient ? 'demo' : 'online';
      this.setHealth(provider.name, status);
      return Array.isArray(value) ? value : [];
    } catch (error) {
      this.noteFailure(provider.name);
      return [];
    }
  }

  async searchTracks(query, { limit = 48, offset = 0 } = {}) {
    const perProvider = Math.max(12, Math.ceil(limit / this.songProviders.length));
    const providerOffset = Math.floor(offset / this.songProviders.length);
    const groups = await Promise.all(this.songProviders.map(provider =>
      this.settle(provider, () => provider.search(query, perProvider, providerOffset))
    ));
    return interleave(groups, limit);
  }

  async trendingTracks({ limit = 36, offset = 0, time = 'week' } = {}) {
    const perProvider = Math.max(10, Math.ceil(limit / this.songProviders.length));
    const providerOffset = Math.floor(offset / this.songProviders.length);

    // Pagination should remain a full live-provider request. The fast path is only
    // for the initial Home feed, so Show more / subsequent pages lose nothing.
    if (offset > 0) {
      const groups = await Promise.all([
        this.settle(audiusProvider, () => audiusProvider.trending(perProvider, time, providerOffset)),
        this.settle(jamendoProvider, () => jamendoProvider.popular(perProvider, providerOffset))
      ]);
      return interleave(groups, limit);
    }

    const audiusTask = this.settle(audiusProvider, () => audiusProvider.trending(perProvider, time, 0));
    const jamendoTask = this.settle(jamendoProvider, () => jamendoProvider.popular(perProvider, 0));
    const liveMergeTask = Promise.all([audiusTask, jamendoTask]).then(groups => {
      const merged = interleave(groups, limit);
      if (merged.length) writeHomeFeedCache(merged);
      return merged;
    });

    // Only the boot request may return stale-but-playable cached Home content.
    // Manual refreshes in the same page bypass this cache and sample live providers.
    if (!this.homeBootCacheUsed) {
      this.homeBootCacheUsed = true;
      const cached = readHomeFeedCache(limit);
      if (cached.length) {
        void liveMergeTask.catch(() => []);
        return cached;
      }
    }

    // Never make first paint wait 5–7 seconds for a slow provider. Give both
    // providers a short shared budget; merge whichever ones respond in time.
    // The original requests continue in the background and populate the next
    // boot cache when both eventually settle.
    const fastGroups = await Promise.all([
      Promise.race([audiusTask, timeoutValue(HOME_FEED_FAST_TIMEOUT_MS)]),
      Promise.race([jamendoTask, timeoutValue(HOME_FEED_FAST_TIMEOUT_MS)])
    ]);
    const fastTracks = interleave(fastGroups, limit);
    if (fastTracks.length) {
      void liveMergeTask.catch(() => []);
      return fastTracks;
    }

    void liveMergeTask.catch(() => []);
    return [];
  }

  async collection(collection, { limit = 48, offset = 0 } = {}) {
    if (!collection) return [];
    if (collection.source === 'audius' && typeof audiusProvider[collection.loader] === 'function') {
      const tracks = await this.settle(audiusProvider, () => audiusProvider[collection.loader](limit, offset));
      return dedupeTracks(tracks);
    }
    if (collection.source === 'jamendo') {
      const tracks = await this.settle(jamendoProvider, () => jamendoProvider.featured(collection.tag || collection.query, limit, offset));
      if (tracks.length) return dedupeTracks(tracks);
    }
    return this.searchTracks(collection.query, { limit, offset });
  }

  async radioTop({ limit = 24, offset = 0 } = {}) {
    return this.settle(this.radioProvider, () => this.radioProvider.top(limit, offset));
  }

  async radioSearch(query, { limit = 24, offset = 0, tag = false } = {}) {
    return this.settle(this.radioProvider, () =>
      tag ? this.radioProvider.byTag(query, limit, offset) : this.radioProvider.search(query, limit, offset)
    );
  }

  providerCards() {
    return [
      {
        name: 'Audius',
        status: this.health.get('Audius') || 'checking',
        role: 'Full streams',
        text: 'Primary open music backbone with search, trending, underground and discovery feeds.'
      },
      {
        name: 'Jamendo',
        status: this.health.get('Jamendo') || (jamendoProvider.usingTestClient ? 'demo' : 'checking'),
        role: 'Full streams',
        text: jamendoProvider.usingTestClient
          ? 'Independent full-track catalog running with Jamendo’s official read-API test client for this college build.'
          : 'Independent full-track catalog with a configured developer client.'
      },
      {
        name: 'Radio Browser',
        status: this.health.get('Radio Browser') || 'checking',
        role: 'Live radio',
        text: 'Open live-station network for genre radio, global stations and always-on listening.'
      },
      {
        name: 'SoundCloud',
        status: 'planned',
        role: 'Credentialed next',
        text: 'Adapter is intentionally staged until an approved SoundCloud app and OAuth credentials are available.'
      },
      {
        name: 'Auralis Cloud',
        status: 'planned',
        role: 'Library sync',
        text: 'Supabase App #1 powers account-backed playlists, likes, history and profiles.'
      }
    ];
  }
}

export const catalogManager = new CatalogManager();
