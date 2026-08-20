const BASES = [
  'https://de1.api.radio-browser.info',
  'https://de2.api.radio-browser.info',
  'https://fi1.api.radio-browser.info'
];

function clampInt(value, fallback, min, max) {
  const parsed = Number.parseInt(value, 10);
  if (!Number.isFinite(parsed)) return fallback;
  return Math.min(max, Math.max(min, parsed));
}

function buildPath(mode, query, limit, offset) {
  const common = new URLSearchParams({
    hidebroken: 'true', order: 'clickcount', reverse: 'true', limit: String(limit), offset: String(offset)
  });
  if (mode === 'tag' && query) return `/json/stations/bytag/${encodeURIComponent(query)}?${common}`;
  if (mode === 'search' && query) { common.set('name', query); return `/json/stations/search?${common}`; }
  return `/json/stations/search?${common}`;
}

async function fetchStations(path) {
  let lastError;
  for (const base of BASES) {
    try {
      const response = await fetch(`${base}${path}`, {
        headers: { 'Accept': 'application/json', 'User-Agent': 'AuralisMusic/3.0 (college portfolio music platform)' }
      });
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      const json = await response.json();
      if (Array.isArray(json)) return json;
    } catch (error) { lastError = error; }
  }
  throw lastError || new Error('Radio Browser unavailable');
}

export default async function handler(req, res) {
  if (req.method !== 'GET') {
    res.setHeader('Allow', 'GET');
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const mode = ['top', 'search', 'tag'].includes(req.query.mode) ? req.query.mode : 'top';
  const query = String(req.query.q || '').trim().slice(0, 80);
  const limit = clampInt(req.query.limit, 24, 1, 60);
  const offset = clampInt(req.query.offset, 0, 0, 500);

  try {
    let stations = await fetchStations(buildPath(mode, query, limit, offset));
    if (mode === 'search' && query && stations.length < Math.min(6, limit)) {
      const byTag = await fetchStations(buildPath('tag', query, limit, offset)).catch(() => []);
      const seen = new Set(stations.map(station => station.stationuuid));
      stations = [...stations, ...byTag.filter(station => !seen.has(station.stationuuid))].slice(0, limit);
    }

    stations = stations.filter(station => {
      const streamUrl = station?.url_resolved || station?.url || '';
      return station?.stationuuid && streamUrl.startsWith('https://') && Number(station.lastcheckok ?? 1) !== 0;
    }).slice(0, limit);

    res.setHeader('Cache-Control', 'public, s-maxage=300, stale-while-revalidate=900');
    return res.status(200).json({ provider: 'Radio Browser', stations });
  } catch (error) {
    return res.status(503).json({ provider: 'Radio Browser', stations: [], error: 'Live radio provider is temporarily unavailable' });
  }
}
