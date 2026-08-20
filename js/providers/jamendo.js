const BASE = 'https://api.jamendo.com/v3.0';
const TEST_CLIENT_ID = '709fa152';

function getClientId() { return window.AURALIS_CONFIG?.jamendoClientId || TEST_CLIENT_ID; }
function genreOf(track) { const tags = track?.musicinfo?.tags; return tags?.genres?.[0] || tags?.vartags?.[0] || 'Independent'; }

function normalize(track) {
  return {
    id: `jamendo:${track.id}`,
    providerId: String(track.id),
    provider: 'Jamendo',
    providerMode: getClientId() === TEST_CLIENT_ID ? 'demo' : 'configured',
    title: track.name || 'Untitled',
    artist: track.artist_name || 'Unknown artist',
    artistHandle: track.artist_id ? String(track.artist_id) : '',
    artwork: track.image || track.album_image || '',
    duration: Number(track.duration || 0),
    genre: genreOf(track),
    playCount: Number(track?.stats?.listens || 0),
    permalink: track.shareurl || '',
    licenseUrl: track?.license_ccurl || track?.licenses?.ccurl || '',
    isLive: false,
    streamUrl: track.audio || ''
  };
}

async function request(params = {}) {
  const url = new URL(`${BASE}/tracks/`);
  const defaults = { client_id: getClientId(), format: 'json', limit: 30, offset: 0, imagesize: 300, audioformat: 'mp32', include: 'musicinfo stats licenses', type: 'single albumtrack' };
  Object.entries({ ...defaults, ...params }).forEach(([key, value]) => { if (value !== undefined && value !== null && value !== '') url.searchParams.set(key, String(value)); });
  const response = await fetch(url, { headers: { Accept: 'application/json' } });
  if (!response.ok) throw new Error(`Jamendo request failed (${response.status})`);
  const json = await response.json();
  if (json?.headers?.status && json.headers.status !== 'success') throw new Error(json.headers.error_message || 'Jamendo request failed');
  return (json.results || []).map(normalize).filter(track => track.streamUrl);
}

export const jamendoProvider = {
  id: 'jamendo',
  name: 'Jamendo',
  kind: 'tracks',
  capabilities: ['search','popular','collections','full-stream','pagination'],
  get usingTestClient() { return getClientId() === TEST_CLIENT_ID; },
  async search(query, limit = 24, offset = 0) { if (!query?.trim()) return []; return request({ search: query.trim(), limit, offset, order: 'relevance', boost: 'popularity_month' }); },
  async featured(tag, limit = 30, offset = 0) { return request({ tags: tag, featured: 1, limit, offset, groupby: 'artist_id', boost: 'popularity_month' }); },
  async popular(limit = 30, offset = 0) { return request({ limit, offset, order: 'popularity_week', groupby: 'artist_id' }); },
  async latest(limit = 30, offset = 0) { return request({ limit, offset, order: 'releasedate_desc', groupby: 'artist_id' }); }
};
