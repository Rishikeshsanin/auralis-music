import '../radio-reliability-v6.js';
import '../auralis-experience-v7.js';
import '../konkani-radio-v7.js';

const ENDPOINT = '/api/radio';

[
  ['auralisRadioV6', './experience-v6.css'],
  ['auralisExperienceV7', './experience-v7.css'],
  ['auralisAuraSurfaceV7', './experience-v7-aura.css']
].forEach(([key, href]) => {
  if (document.querySelector(`link[data-${key.replace(/[A-Z]/g, letter => `-${letter.toLowerCase()}`)}]`)) return;
  const link = document.createElement('link');
  link.rel = 'stylesheet';
  link.href = href;
  link.dataset[key] = 'true';
  document.head.append(link);
});

function normalize(station) {
  const tags = String(station.tags || '').split(',').map(tag => tag.trim()).filter(Boolean);
  const location = [station.country, station.language].filter(Boolean).join(' · ');
  const rawStream = station.url_resolved || station.url || '';
  const streamUrl = station.auralis_stream_type === 'hls' && rawStream && !/\.m3u8(?:$|\?)/i.test(rawStream)
    ? `${rawStream}#auralis-hls`
    : rawStream;
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
    verified: Boolean(station.auralis_verified),
    streamType: station.auralis_stream_type || 'direct',
    codec: station.codec || '',
    bitrate: Number(station.bitrate || 0),
    country: station.country || '',
    language: station.language || '',
    streamUrl
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
  capabilities: ['live-radio','search','genres','pagination','verified-streams','hls'],

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