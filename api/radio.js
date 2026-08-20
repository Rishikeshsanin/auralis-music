const BASES = [
  'https://de1.api.radio-browser.info',
  'https://de2.api.radio-browser.info',
  'https://fi1.api.radio-browser.info'
];

const MUSIC_POSITIVE = /\b(pop|rock|hits?|music|dance|edm|electronic|house|techno|trance|hip[ -]?hop|r&b|rnb|soul|jazz|oldies|classic|80s|90s|2000s|alternative|indie|bollywood|melod(?:y|ies)|songs?|chart|top\s?40|anthems?|retro|disco|rainbow|club)\b/i;
const MUSIC_NEGATIVE = /\b(news|talk|speech|spoken word|podcast|politic|traffic|weather|sports? talk|religious|christian|gospel|quran|islamic|sermon|church|bible|business news|old time radio|otr|radio drama|audiobook)\b/i;
const ENGLISH_COUNTRIES = new Set(['GB', 'US', 'CA', 'AU', 'NZ', 'IE']);
const PROBE_TIMEOUT_MS = 2600;

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

  if (mode === 'tag' && query) return `/json/stations/bytag/${encodeURIComponent(query)}?${common}`;
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
          'User-Agent': 'AuralisMusic/6.0 (college portfolio music platform)'
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

function streamUrl(station) {
  return String(station?.url_resolved || station?.url || '').trim();
}

function isSafePublicHttps(value) {
  try {
    const url = new URL(value);
    if (url.protocol !== 'https:') return false;
    const host = url.hostname.toLowerCase();
    if (!host || host === 'localhost' || host.endsWith('.local')) return false;
    if (/^(127\.|10\.|192\.168\.|169\.254\.)/.test(host)) return false;
    if (/^172\.(1[6-9]|2\d|3[01])\./.test(host)) return false;
    if (host === '::1' || host.startsWith('fc') || host.startsWith('fd') || host.startsWith('fe80:')) return false;
    return true;
  } catch {
    return false;
  }
}

function popularityScore(station) {
  const clicks = Number(station?.clickcount || 0);
  const votes = Number(station?.votes || 0);
  const bitrate = Math.min(320, Number(station?.bitrate || 0));
  return clicks * 20 + votes / 10 + bitrate / 20;
}

function codecBoost(station) {
  const codec = String(station?.codec || '').toUpperCase();
  const url = streamUrl(station);
  if (codec.includes('MP3')) return 700;
  if (codec === 'AAC' || codec.includes('AAC+')) return 640;
  if (codec.includes('OGG')) return 520;
  if (Number(station?.hls || 0) === 1 || /\.m3u8(?:$|\?)/i.test(url)) return 430;
  if (codec.includes('FLAC')) return 300;
  return 180;
}

function canonicalStationName(value = '') {
  return String(value)
    .toLowerCase()
    .replace(/\([^)]*(?:mp3|aac|ogg|opus|\d+\s*k(?:bps)?)[^)]*\)/gi, ' ')
    .replace(/\b(?:hd|hq|opus|mp3|aac\+?|ogg|stream|\d+\s*k(?:bps)?)\b/gi, ' ')
    .replace(/[^a-z0-9\p{L}]+/gu, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function prepareStations(stations) {
  const seenIds = new Set();
  const seenStreams = new Set();
  return stations
    .filter(station => {
      const url = streamUrl(station);
      if (!station?.stationuuid || !isSafePublicHttps(url)) return false;
      if (Number(station.lastcheckok ?? 1) === 0) return false;
      if (seenIds.has(station.stationuuid) || seenStreams.has(url)) return false;
      seenIds.add(station.stationuuid);
      seenStreams.add(url);
      return true;
    })
    .map(station => ({ ...station, auralis_score: popularityScore(station) }));
}

function stationText(station) {
  return `${station?.name || ''} ${station?.tags || ''} ${station?.language || ''}`.toLowerCase();
}

function isMusicStation(station) {
  const text = stationText(station);
  if (MUSIC_NEGATIVE.test(text)) return false;
  if (MUSIC_POSITIVE.test(text)) return true;
  return /radio paradise|capital fm|bbc radio 1|absolute radio|virgin radio|kiss fm|radio mirchi|red fm|vividh bharati|big fm|fm rainbow|club fm/i.test(station?.name || '');
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
  if (country === 'US' && /102\.7 kiis|kiis fm/.test(name)) return 5200;
  if (country === 'US' && /z100/.test(name)) return 4800;
  if (country === 'GB' && /capital.*(uk|london)|capital fm london/.test(name)) return 5000;
  if (country === 'GB' && name.includes('bbc radio 1')) return 4500;
  if (country === 'US' && name.includes('radio paradise')) return 4300;
  if (country === 'GB' && name.includes('heart 80s')) return 3600;
  if (country === 'GB' && name.includes('absolute radio')) return 3400;
  if (country === 'GB' && /\bkiss\b/.test(name)) return 3000;
  if (country === 'IN' && name.includes('radio mirchi hindi')) return 4200;
  if (country === 'IN' && /red fm 93\.5/i.test(station?.name || '')) return 3500;
  if (country === 'IN' && /vividh bharati/i.test(station?.name || '')) return 3000;
  return 0;
}

function popularMusicScore(station) {
  const text = stationText(station);
  const clicks = Number(station?.clickcount || 0);
  const votes = Number(station?.votes || 0);
  const bitrate = Math.min(320, Number(station?.bitrate || 0));
  let score = clicks * 25 + Math.log10(votes + 1) * 900 + bitrate / 8 + codecBoost(station);
  if (/\b(pop|hits?|top\s?40|chart|anthems?)\b/i.test(text)) score += 750;
  if (/\b(rock|alternative|indie|dance|electronic|house|hip[ -]?hop|r&b|rnb|jazz|oldies|classic hits)\b/i.test(text)) score += 300;
  if (isEnglishStation(station)) score += 900;
  return score + brandBoost(station);
}

function groupOrderedStations(stations, scoreFn = popularityScore) {
  const groups = new Map();
  for (const station of prepareStations(stations)) {
    const key = canonicalStationName(station.name) || station.stationuuid;
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key).push(station);
  }
  return [...groups.values()].map(variants => variants.sort((a, b) =>
    (scoreFn(b) + codecBoost(b)) - (scoreFn(a) + codecBoost(a))
  ));
}

async function probeStream(station) {
  const url = streamUrl(station);
  if (!isSafePublicHttps(url)) return null;
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), PROBE_TIMEOUT_MS);
  try {
    const response = await fetch(url, {
      method: 'GET',
      redirect: 'follow',
      signal: controller.signal,
      headers: {
        Accept: 'audio/mpeg,audio/aac,audio/ogg,application/ogg,application/vnd.apple.mpegurl,application/x-mpegURL,*/*;q=0.2',
        Range: 'bytes=0-1',
        'Icy-MetaData': '0',
        'User-Agent': 'AuralisMusic/6.0 stream-check'
      }
    });
    const finalUrl = response.url || url;
    const type = String(response.headers.get('content-type') || '').toLowerCase();
    const hls = Number(station?.hls || 0) === 1 || /\.m3u8(?:$|\?)/i.test(url) || type.includes('mpegurl');
    const looksAudio = type.startsWith('audio/') || type.includes('application/ogg') || type.includes('octet-stream');
    const obviouslyWrong = /text\/html|application\/json|text\/xml|application\/xml/.test(type);
    const ok = response.ok && isSafePublicHttps(finalUrl) && !obviouslyWrong && (hls || looksAudio || !type);
    try { await response.body?.cancel(); } catch {}
    if (!ok) return null;
    return {
      ...station,
      auralis_verified: true,
      auralis_stream_type: hls ? 'hls' : 'direct',
      auralis_checked_at: new Date().toISOString()
    };
  } catch {
    return null;
  } finally {
    clearTimeout(timeout);
  }
}

async function chooseHealthyVariant(variants) {
  for (const station of variants.slice(0, 4)) {
    const checked = await probeStream(station);
    if (checked) return { ...checked, auralis_variants: variants.length };
  }
  return null;
}

async function verifyOrderedStations(stations, limit, offset = 0, scoreFn = popularityScore) {
  const groups = groupOrderedStations(stations, scoreFn);
  const windowSize = Math.max(limit * 3, limit + 8);
  const candidates = groups.slice(offset, offset + windowSize);
  const checked = await Promise.all(candidates.map(chooseHealthyVariant));
  return checked.filter(Boolean).slice(0, limit);
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

  const prepared = prepareStations([...pop, ...hits, ...english, ...hindi, ...gb, ...us]).filter(isMusicStation);
  const englishMusic = prepared.filter(station => isEnglishStation(station) && !isHindiStation(station)).sort((a, b) => popularMusicScore(b) - popularMusicScore(a));
  const hindiMusic = prepared.filter(isHindiStation).sort((a, b) => popularMusicScore(b) - popularMusicScore(a)).slice(0, 3);
  const otherMusic = prepared.filter(station => !isEnglishStation(station) && !isHindiStation(station)).sort((a, b) => popularMusicScore(b) - popularMusicScore(a));
  const ordered = [...englishMusic.slice(0, 10), ...hindiMusic, ...englishMusic.slice(10), ...otherMusic];
  const pageSize = Math.min(limit, 18);
  return verifyOrderedStations(ordered, pageSize, offset, popularMusicScore);
}

export default async function handler(req, res) {
  if (req.method !== 'GET') {
    res.setHeader('Allow', 'GET');
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const mode = ['top', 'search', 'tag', 'country', 'language'].includes(req.query.mode) ? req.query.mode : 'top';
  const query = String(req.query.q || '').trim().slice(0, 80);
  const country = String(req.query.country || '').trim().slice(0, 2);
  const limit = clampInt(req.query.limit, 24, 1, 36);
  const offset = clampInt(req.query.offset, 0, 0, 500);

  try {
    let stations;
    if (mode === 'top') {
      stations = await fetchPopularMusic(limit, offset);
    } else {
      const sourceLimit = Math.min(60, Math.max(limit * 4, 24));
      let raw = await fetchStations(buildPath(mode, query, sourceLimit, offset, country));
      if (mode === 'search' && query && raw.length < Math.min(8, limit)) {
        const byTag = await fetchStations(buildPath('tag', query, sourceLimit, offset)).catch(() => []);
        raw = [...raw, ...byTag];
      }
      const prepared = prepareStations(raw).sort((a, b) => (popularityScore(b) + codecBoost(b)) - (popularityScore(a) + codecBoost(a)));
      stations = await verifyOrderedStations(prepared, limit, 0, popularityScore);
    }

    res.setHeader('Cache-Control', 'public, s-maxage=120, stale-while-revalidate=600');
    return res.status(200).json({ provider: 'Radio Browser', mode, verified: true, stations });
  } catch (error) {
    return res.status(503).json({
      provider: 'Radio Browser',
      mode,
      verified: false,
      stations: [],
      error: 'Live radio provider is temporarily unavailable'
    });
  }
}
