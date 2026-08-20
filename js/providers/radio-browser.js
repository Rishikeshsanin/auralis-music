const ENDPOINT = '/api/radio';

function normalize(station) {
  const tags = String(station.tags || '').split(',').map(tag => tag.trim()).filter(Boolean);
  const location = [station.country, station.language].filter(Boolean).join(' · ');
  return {
    id: `radio:${station.stationuuid}`,
    providerId: station.stationuuid,
    provider: 'Radio Browser',
    title: station.name || 'Live radio',
    artist: location || 'Live station',
    artistHandle: '',
    artwork: station.favicon || '',
    duration: 0,
    genre: tags[0] || 'Live radio',
    playCount: Number(station.clickcount || station.votes || 0),
    permalink: station.homepage || '',
    isLive: true,
    codec: station.codec || '',
    bitrate: Number(station.bitrate || 0),
    country: station.country || '',
    language: station.language || '',
    streamUrl: station.url_resolved || station.url || ''
  };
}

async function request(params = {}) {
  const url = new URL(ENDPOINT, window.location.origin);
  Object.entries(params).forEach(([key, value]) => {
    if (value !== undefined && value !== null && value !== '') url.searchParams.set(key, String(value));
  });
  const response = await fetch(url, { headers: { Accept: 'application/json' } });
  if (!response.ok) throw new Error(`Radio Browser request failed (${response.status})`);
  const json = await response.json();
  return (json.stations || []).map(normalize).filter(station => station.streamUrl);
}

export const radioBrowserProvider = {
  id: 'radio-browser',
  name: 'Radio Browser',
  kind: 'radio',
  capabilities: ['live-radio','search','genres','pagination'],

  async top(limit = 24, offset = 0) {
    return request({ mode: 'top', limit, offset });
  },

  async search(query, limit = 24, offset = 0) {
    if (!query?.trim()) return this.top(limit, offset);
    return request({ mode: 'search', q: query.trim(), limit, offset });
  },

  async byTag(tag, limit = 24, offset = 0) {
    if (!tag?.trim()) return this.top(limit, offset);
    return request({ mode: 'tag', q: tag.trim(), limit, offset });
  }
};
