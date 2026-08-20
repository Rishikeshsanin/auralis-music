const BASE = 'https://api.audius.co/v1';
const APP_NAME = 'AuralisMusic';

function artworkOf(track) {
  const art = track?.artwork;
  if (!art) return '';
  return art['480x480'] || art['150x150'] || art['1000x1000'] || art._480x480 || art._150x150 || art._1000x1000 || '';
}

function streamableValue(track) {
  const value = track?.is_streamable ?? track?.isStreamable;
  if (value === undefined || value === null) return true;
  if (typeof value === 'string') return value.toLowerCase() !== 'false';
  return value !== false;
}

function normalize(track) {
  return {
    id: `audius:${track.id}`,
    providerId: track.id,
    provider: 'Audius',
    title: track.title || 'Untitled',
    artist: track.user?.name || track.user?.handle || 'Unknown artist',
    artistHandle: track.user?.handle || '',
    artwork: artworkOf(track),
    duration: Number(track.duration || 0),
    genre: track.genre || track.mood || 'Open music',
    playCount: Number(track.play_count ?? track.playCount ?? 0),
    permalink: track.permalink || '',
    isStreamable: streamableValue(track),
    isLive: false,
    streamUrl: `${BASE}/tracks/${encodeURIComponent(track.id)}/stream?app_name=${APP_NAME}`
  };
}

async function request(path, params = {}) {
  const url = new URL(`${BASE}${path}`);
  url.searchParams.set('app_name', APP_NAME);
  Object.entries(params).forEach(([key, value]) => {
    if (value !== undefined && value !== null && value !== '') url.searchParams.set(key, String(value));
  });
  const response = await fetch(url, { headers: { Accept: 'application/json' } });
  if (!response.ok) throw new Error(`Audius request failed (${response.status})`);
  const json = await response.json();
  const data = Array.isArray(json.data) ? json.data : [];
  return data.map(normalize).filter(track => track.isStreamable && track.streamUrl);
}

async function endpointOrSearch(path, searchQuery, limit = 30, offset = 0, params = {}) {
  try {
    const tracks = await request(path, { ...params, limit, offset });
    if (tracks.length) return tracks;
  } catch {}
  return request('/tracks/search', { query: searchQuery, limit, offset, sort_method: 'popular' });
}

export const audiusProvider = {
  id: 'audius',
  name: 'Audius',
  kind: 'tracks',
  capabilities: ['search','trending','collections','full-stream','pagination'],

  async trending(limit = 20, time = 'week', offset = 0) {
    return request('/tracks/trending', { time, limit, offset });
  },

  async trendingByGenre(genre, limit = 30, offset = 0) {
    return request('/tracks/trending', { genre, time: 'week', limit, offset });
  },

  async search(query, limit = 30, offset = 0) {
    if (!query?.trim()) return [];
    return request('/tracks/search', { query: query.trim(), limit, offset, sort_method: 'relevant' });
  },

  async latest(limit = 30, offset = 0) { return endpointOrSearch('/tracks/latest', 'new releases', limit, offset); },
  async bestNewReleases(limit = 30, offset = 0) { return endpointOrSearch('/tracks/best_new_releases', 'best new releases', limit, offset); },
  async mostLoved(limit = 30, offset = 0) { return endpointOrSearch('/tracks/most_loved', 'popular', limit, offset); },
  async underTheRadar(limit = 30, offset = 0) { return endpointOrSearch('/tracks/under_the_radar', 'underground indie', limit, offset); },
  async remixables(limit = 30, offset = 0) { return endpointOrSearch('/tracks/remixables', 'remix', limit, offset); },
  async recommended(limit = 30, offset = 0) { return endpointOrSearch('/tracks/recommended', 'recommended', limit, offset); },
  async feelingLucky(limit = 30, offset = 0) { return endpointOrSearch('/tracks/feeling-lucky', 'discover', limit, offset); }
};
