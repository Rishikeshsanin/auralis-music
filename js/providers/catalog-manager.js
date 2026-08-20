import { audiusProvider } from './audius.js';
import { jamendoProvider } from './jamendo.js';
import { radioBrowserProvider } from './radio-browser.js';

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

class CatalogManager {
  constructor() {
    this.songProviders = [audiusProvider, jamendoProvider];
    this.radioProvider = radioBrowserProvider;
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
    const groups = await Promise.all([
      this.settle(audiusProvider, () => audiusProvider.trending(perProvider, time, providerOffset)),
      this.settle(jamendoProvider, () => jamendoProvider.popular(perProvider, providerOffset))
    ]);
    return interleave(groups, limit);
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
