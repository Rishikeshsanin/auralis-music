const BASES = [
  'https://de1.api.radio-browser.info',
  'https://de2.api.radio-browser.info',
  'https://fi1.api.radio-browser.info'
];

const MUSIC_POSITIVE = /\b(pop|rock|hits?|music|dance|edm|electronic|house|techno|trance|hip[ -]?hop|r&b|rnb|soul|jazz|oldies|classic|80s|90s|2000s|alternative|indie|bollywood|melod(?:y|ies)|songs?|chart|top\s?40|anthems?|retro|disco)\b/i;
const MUSIC_NEGATIVE = /\b(news|talk|speech|podcast|politic|traffic|weather|sports? talk|religious|christian|gospel|quran|islamic|sermon|church|bible|business news)\b/i;
const ENGLISH_COUNTRIES = new Set(['GB', 'US', 'CA', 'AU', 'NZ', 'IE']);

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
          'User-Agent': 'AuralisMusic/5.0 (college portfolio music platform)'
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

function prepareStations(stations) {
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
    .map(station => ({ ...station, auralis_score: popularityScore(station) }));
}

function cleanStations(stations, limit) {
  return prepareStations(stations)
    .sort((a, b) => b.auralis_score - a.auralis_score)
    .slice(0, limit);
}

function stationText(station) {
  return `${station?.name || ''} ${station?.tags || ''} ${station?.language || ''}`.toLowerCase();
}

function isMusicStation(station) {
  const text = stationText(station);
  if (MUSIC_NEGATIVE.test(text)) return false;
  if (MUSIC_POSITIVE.test(text)) return true;
  return /radio paradise|capital fm|bbc radio 1|absolute radio|virgin radio|kiss fm|radio mirchi|red fm|vividh bharati|big fm/i.test(station?.name || '');
}

function isEnglishStation(station) {
  const language = String(station?.language || '').toLowerCase();
  return language.includes('english') || ENGLISH_COUNTRIES.has(String(station?.countrycode || '').toUpperCase());
}

function isHindiStation(station) {
  const language = String(station?.language || '').toLowerCase();
  const name = String(station?.name || '');
  return String(station?.countrycode || '').toUpperCase() === 'IN'
    && (language.includes('hindi') || /mirchi|red fm|vividh bharati|bollywood/i.test(name));
}

function brandBoost(station) {
  const name = String(station?.name || '').toLowerCase();
  const country = String(station?.countrycode || '').toUpperCase();
  if (country === 'GB' && name.includes('capital fm london')) return 2400;
  if (country === 'GB' && name.includes('bbc radio 1')) return 2200;
  if (country === 'US' && name.includes('radio paradise')) return 1800;
  if (country === 'GB' && name.includes('absolute radio')) return 1500;
  if (country === 'GB' && name.includes('kiss')) return 1300;
  if (country === 'IN' && name.includes('radio mirchi hindi')) return 2200;
  if (country === 'IN' && /red fm 93\.5/i.test(station?.name || '')) return 1800;
  if (country === 'IN' && /vividh bharati/i.test(station?.name || '')) return 1500;
  return 0;
}

function popularMusicScore(station) {
  const text = stationText(station);
  let score = Number(station.auralis_score || popularityScore(station));
  if (/\b(pop|hits?|top\s?40|chart|anthems?)\b/i.test(text)) score += 500;
  if (/\b(rock|alternative|indie|dance|electronic|house|hip[ -]?hop|r&b|rnb)\b/i.test(text)) score += 220;
  if (isEnglishStation(station)) score += 800;
  score += brandBoost(station);
  return score;
}

async function fetchPopularMusic(limit, offset) {
  const sourceLimit = 60;
  const [pop, hits, english, hindi, gb, us] = await Promise.all([
    fetchStations(buildPath('tag', 'pop', sourceLimit, 0)).catch(() => []),
    fetchStations(buildPath('tag', 'hits', sourceLimit, 0)).catch(() => []),
    fetchStations(buildPath('language', 'english', sourceLimit, 0)).catch(() => []),
    fetchStations(buildPath('language', 'hindi', 30, 0, 'IN')).catch(() => []),
    fetchStations(buildPath('country', 'GB', 40, 0)).catch(() => []),
    fetchStations(buildPath('country', 'US', 40, 0)).catch(() => [])
  ]);

  const prepared = prepareStations([...pop, ...hits, ...english, ...hindi, ...gb, ...us])
    .filter(isMusicStation);

  const englishMusic = prepared
    .filter(station => isEnglishStation(station) && !isHindiStation(station))
    .sort((a, b) => popularMusicScore(b) - popularMusicScore(a));

  const hindiMusic = prepared
    .filter(isHindiStation)
    .sort((a, b) => popularMusicScore(b) - popularMusicScore(a))
    .slice(0, 3);

  const otherMusic = prepared
    .filter(station => !isEnglishStation(station) && !isHindiStation(station))
    .sort((a, b) => popularMusicScore(b) - popularMusicScore(a));

  const front = englishMusic.slice(0, 10);
  const restEnglish = englishMusic.slice(10);
  const ordered = prepareStations([...front, ...hindiMusic, ...restEnglish, ...otherMusic]);
  const pageSize = Math.min(limit, 18);
  return ordered.slice(offset, offset + pageSize);
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
    let stations;

    if (mode === 'top') {
      stations = await fetchPopularMusic(limit, offset);
    } else {
      stations = await fetchStations(buildPath(mode, query, Math.min(60, limit * 2), offset, country));

      if (mode === 'search' && query && stations.length < Math.min(6, limit)) {
        const byTag = await fetchStations(buildPath('tag', query, Math.min(60, limit * 2), offset)).catch(() => []);
        stations = [...stations, ...byTag];
      }

      stations = cleanStations(stations, limit);
    }

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
