const BASE = 'https://api.audius.co/v1';
const APP_NAME = 'AuralisMusic';

function artworkOf(track) {
  const art = track?.artwork;
  if (!art) return '';
  return art['480x480'] || art['150x150'] || art['1000x1000'] || '';
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
    playCount: Number(track.play_count || 0),
    permalink: track.permalink || '',
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
  return data.map(normalize);
}

export const audiusProvider = {
  name: 'Audius',
  async trending(limit = 20) {
    return request('/tracks/trending', { time: 'week', limit });
  },
  async search(query, limit = 30) {
    if (!query?.trim()) return [];
    return request('/tracks/search', { query: query.trim(), limit });
  }
};
