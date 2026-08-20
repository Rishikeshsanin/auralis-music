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

function buildPath(mode, query, limit, offset, country = '') {
  const common = new URLSearchParams({
    hidebroken: 'true',
    order: 'clickcount',
    reverse: 'true',
    limit: String(limit),
    offset: String(offset)
  });

  if (mode === 'tag' && query) {
    return `/json/stations/bytag/${encodeURIComponent(query)}?${common}`;
  }

  if (mode === 'search' && query) {
    common.set('name', query);
    return `/json/stations/search?${common}`;
  }

  if (mode === 'country' && query) {
    common.set('countrycode', query.toUpperCase());
    common.set('countrycodeExact', 'true');
    return `/json/stations/search?${common}`;
  }

  if (mode === 'language' && query) {
    common.set('language', query);
    common.set('languageExact', 'true');
    if (country) {
      common.set('countrycode', country.toUpperCase());
      common.set('countrycodeExact', 'true');
    }
    return `/json/stations/search?${common}`;
  }

  return `/json/stations/search?${common}`;
}

async function fetchStations(path) {
  let lastError;
  for (const base of BASES) {
    try {
      const response = await fetch(`${base}${path}`, {
        headers: {
          Accept: 'application/json',
          'User-Agent': 'AuralisMusic/4.0 (college portfolio music platform)'
        }
      });
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      const json = await response.json();
      if (Array.isArray(json)) return json;
    } catch (error) {
      lastError = error;
    }
  }
  throw lastError || new Error('Radio Browser unavailable');
}

function popularityScore(station) {
  const clicks = Number(station?.clickcount || 0);
  const votes = Number(station?.votes || 0);
  const bitrate = Math.min(320, Number(station?.bitrate || 0));
  return clicks * 20 + votes / 10 + bitrate / 20;
}

function cleanStations(stations, limit) {
  const seenIds = new Set();
  const seenStreams = new Set();

  return stations
    .filter(station => {
      const streamUrl = station?.url_resolved || station?.url || '';
      if (!station?.stationuuid || !streamUrl.startsWith('https://')) return false;
      if (Number(station.lastcheckok ?? 1) === 0) return false;
      if (seenIds.has(station.stationuuid) || seenStreams.has(streamUrl)) return false;
      seenIds.add(station.stationuuid);
      seenStreams.add(streamUrl);
      return true;
    })
    .map(station => ({ ...station, auralis_score: popularityScore(station) }))
    .sort((a, b) => b.auralis_score - a.auralis_score)
    .slice(0, limit);
}

export default async function handler(req, res) {
  if (req.method !== 'GET') {
    res.setHeader('Allow', 'GET');
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const mode = ['top', 'search', 'tag', 'country', 'language'].includes(req.query.mode)
    ? req.query.mode
    : 'top';
  const query = String(req.query.q || '').trim().slice(0, 80);
  const country = String(req.query.country || '').trim().slice(0, 2);
  const limit = clampInt(req.query.limit, 24, 1, 60);
  const offset = clampInt(req.query.offset, 0, 0, 500);

  try {
    let stations = await fetchStations(buildPath(mode, query, Math.min(60, limit * 2), offset, country));

    if (mode === 'search' && query && stations.length < Math.min(6, limit)) {
      const byTag = await fetchStations(buildPath('tag', query, Math.min(60, limit * 2), offset)).catch(() => []);
      stations = [...stations, ...byTag];
    }

    stations = cleanStations(stations, limit);

    res.setHeader('Cache-Control', 'public, s-maxage=300, stale-while-revalidate=900');
    return res.status(200).json({ provider: 'Radio Browser', mode, stations });
  } catch (error) {
    return res.status(503).json({
      provider: 'Radio Browser',
      mode,
      stations: [],
      error: 'Live radio provider is temporarily unavailable'
    });
  }
}
