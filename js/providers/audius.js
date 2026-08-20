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

async function endpointOrSearch(path, searchQuery, limit = 30, params = {}) {
  try {
    const tracks = await request(path, { ...params, limit });
    if (tracks.length) return tracks;
  } catch {}
  return request('/tracks/search', { query: searchQuery, limit, sort_method: 'popular' });
}

export const audiusProvider = {
  name: 'Audius',
  async trending(limit = 20, time = 'week') {
    return request('/tracks/trending', { time, limit });
  },
  async search(query, limit = 30) {
    if (!query?.trim()) return [];
    return request('/tracks/search', { query: query.trim(), limit, sort_method: 'relevant' });
  },
  async latest(limit = 30) {
    return endpointOrSearch('/tracks/latest', 'new releases', limit);
  },
  async bestNewReleases(limit = 30) {
    return endpointOrSearch('/tracks/best_new_releases', 'best new releases', limit);
  },
  async mostLoved(limit = 30) {
    return endpointOrSearch('/tracks/most_loved', 'popular', limit);
  },
  async underTheRadar(limit = 30) {
    return endpointOrSearch('/tracks/under_the_radar', 'underground indie', limit);
  },
  async remixables(limit = 30) {
    return endpointOrSearch('/tracks/remixables', 'remix', limit);
  },
  async recommended(limit = 30) {
    return endpointOrSearch('/tracks/recommended', 'recommended', limit);
  },
  async feelingLucky(limit = 30) {
    return endpointOrSearch('/tracks/feeling-lucky', 'discover', limit);
  }
};
