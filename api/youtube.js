const SEARCH_ENDPOINT = 'https://www.googleapis.com/youtube/v3/search';
const VIDEOS_ENDPOINT = 'https://www.googleapis.com/youtube/v3/videos';

function clampInt(value, fallback, min, max) {
  const parsed = Number.parseInt(value, 10);
  if (!Number.isFinite(parsed)) return fallback;
  return Math.min(max, Math.max(min, parsed));
}

function safeText(value = '', max = 400) {
  return String(value || '').slice(0, max).trim();
}

function decodeEntities(value = '') {
  return String(value)
    .replace(/&amp;/gi, '&')
    .replace(/&quot;/gi, '"')
    .replace(/&#39;/gi, "'")
    .replace(/&lt;/gi, '<')
    .replace(/&gt;/gi, '>');
}

function normalize(value = '') {
  return decodeEntities(value)
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function tokenSet(value = '') {
  return new Set(normalize(value).split(' ').filter(token => token.length > 1));
}

function overlapScore(wanted, actual) {
  if (!wanted.size || !actual.size) return 0;
  let hits = 0;
  wanted.forEach(token => { if (actual.has(token)) hits += 1; });
  return hits / wanted.size;
}

function parseDuration(value = '') {
  const match = String(value).match(/^PT(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?$/i);
  if (!match) return 0;
  return Number(match[1] || 0) * 3600 + Number(match[2] || 0) * 60 + Number(match[3] || 0);
}

function qualifierFlags(value = '') {
  const text = normalize(value);
  return {
    remix: /\bremix\b/.test(text),
    acoustic: /\bacoustic\b/.test(text),
    live: /\blive\b/.test(text),
    slowed: /\bslowed\b/.test(text),
    sped: /\bsped\b|\bspeed up\b/.test(text),
    instrumental: /\binstrumental\b/.test(text),
    karaoke: /\bkaraoke\b/.test(text),
    cover: /\bcover\b/.test(text),
    nightcore: /\bnightcore\b/.test(text),
    reaction: /\breaction\b/.test(text),
    tutorial: /\btutorial\b/.test(text),
    lyrics: /\blyrics?\b/.test(text)
  };
}

function qualityScore(video, request) {
  const wantedTitle = normalize(request.title || request.q);
  const wantedArtist = normalize(request.artist);
  const candidateTitle = normalize(video.title);
  const candidateChannel = normalize(video.channel);
  const wantedTitleTokens = tokenSet(wantedTitle);
  const wantedArtistTokens = tokenSet(wantedArtist);
  const candidateTokens = tokenSet(`${candidateTitle} ${candidateChannel}`);

  let score = 0;
  const titleOverlap = overlapScore(wantedTitleTokens, tokenSet(candidateTitle));
  const artistOverlap = wantedArtistTokens.size ? overlapScore(wantedArtistTokens, candidateTokens) : 0;

  if (wantedTitle && candidateTitle === wantedTitle) score += 50;
  else if (wantedTitle && candidateTitle.includes(wantedTitle)) score += 34;
  else score += Math.round(titleOverlap * 32);

  if (wantedArtistTokens.size) {
    score += Math.round(artistOverlap * 32);
    if (wantedArtist && candidateChannel.includes(wantedArtist)) score += 12;
  }

  if (/\bofficial audio\b|\bofficial video\b|\bofficial music video\b/.test(candidateTitle)) score += 14;
  if (/\btopic\b/.test(candidateChannel)) score += 12;
  if (/\bvevo\b|\brecords\b|\bmusic\b|\bofficial\b/.test(candidateChannel)) score += 7;
  if (video.durationSeconds >= 90 && video.durationSeconds <= 720) score += 5;

  const wantedFlags = qualifierFlags(`${request.title || request.q} ${request.album || ''}`);
  const candidateFlags = qualifierFlags(video.title);
  ['remix','acoustic','live','slowed','sped','instrumental','karaoke','cover','nightcore','reaction','tutorial'].forEach(flag => {
    if (candidateFlags[flag] && !wantedFlags[flag]) score -= ['karaoke','cover','reaction','tutorial','nightcore'].includes(flag) ? 32 : 20;
    if (candidateFlags[flag] && wantedFlags[flag]) score += 8;
  });

  if (candidateFlags.lyrics && !wantedFlags.lyrics) score -= 2;
  if (video.durationSeconds && video.durationSeconds < 55) score -= 24;
  if (video.liveBroadcastContent && video.liveBroadcastContent !== 'none') score -= 12;

  return score;
}

async function fetchJson(url, timeout = 6500) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeout);
  try {
    const response = await fetch(url, { headers: { Accept: 'application/json' }, signal: controller.signal });
    const json = await response.json().catch(() => ({}));
    if (!response.ok) {
      const error = new Error(json?.error?.message || `YouTube request failed (${response.status})`);
      error.status = response.status;
      throw error;
    }
    return json;
  } finally {
    clearTimeout(timer);
  }
}

function buildSearchQuery({ q, title, artist, album }) {
  // Title + artist is usually the cleanest path to the canonical song. Album names can
  // bias YouTube toward alternate releases/remixes, so only use album when artist is missing.
  const pieces = [title || q, artist || album].map(value => safeText(value)).filter(Boolean);
  return `${pieces.join(' ')} official audio`.trim();
}

export default async function handler(req, res) {
  if (req.method !== 'GET') {
    res.setHeader('Allow', 'GET');
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const key = process.env.YOUTUBE_API_KEY;
  if (!key) {
    return res.status(503).json({
      provider: 'YouTube',
      state: 'needs_credentials',
      error: 'YOUTUBE_API_KEY is not configured'
    });
  }

  const request = {
    q: safeText(req.query.q),
    title: safeText(req.query.title),
    artist: safeText(req.query.artist),
    album: safeText(req.query.album)
  };
  const baseQuery = request.title || request.q;
  if (!baseQuery) return res.status(400).json({ error: 'Search query required' });

  const limit = clampInt(req.query.limit, 8, 1, 10);
  const searchLimit = Math.min(10, Math.max(limit, 8));
  const query = buildSearchQuery(request);

  const searchUrl = new URL(SEARCH_ENDPOINT);
  searchUrl.searchParams.set('key', key);
  searchUrl.searchParams.set('part', 'snippet');
  searchUrl.searchParams.set('type', 'video');
  searchUrl.searchParams.set('videoCategoryId', '10');
  searchUrl.searchParams.set('videoEmbeddable', 'true');
  searchUrl.searchParams.set('videoSyndicated', 'true');
  searchUrl.searchParams.set('maxResults', String(searchLimit));
  searchUrl.searchParams.set('q', query);
  searchUrl.searchParams.set('safeSearch', 'none');

  try {
    const searchJson = await fetchJson(searchUrl);
    const ids = (searchJson.items || []).map(item => item.id?.videoId).filter(Boolean);

    if (!ids.length) {
      res.setHeader('Cache-Control', 'public, s-maxage=900, stale-while-revalidate=3600');
      return res.status(200).json({ provider: 'YouTube', state: 'online', query, bestMatch: null, items: [] });
    }

    const detailUrl = new URL(VIDEOS_ENDPOINT);
    detailUrl.searchParams.set('key', key);
    detailUrl.searchParams.set('part', 'snippet,status,contentDetails');
    detailUrl.searchParams.set('id', ids.join(','));
    const detailsJson = await fetchJson(detailUrl);

    const byId = new Map((detailsJson.items || []).map(item => [item.id, item]));
    const items = (searchJson.items || []).map(searchItem => {
      const id = searchItem.id?.videoId || '';
      const detail = byId.get(id) || {};
      const snippet = detail.snippet || searchItem.snippet || {};
      const status = detail.status || {};
      const durationSeconds = parseDuration(detail.contentDetails?.duration || '');
      const video = {
        id,
        title: decodeEntities(snippet.title || 'Untitled'),
        channel: decodeEntities(snippet.channelTitle || 'YouTube'),
        publishedAt: snippet.publishedAt || '',
        artwork: snippet.thumbnails?.high?.url || snippet.thumbnails?.medium?.url || snippet.thumbnails?.default?.url || '',
        durationSeconds,
        embeddable: status.embeddable !== false,
        privacyStatus: status.privacyStatus || 'public',
        liveBroadcastContent: snippet.liveBroadcastContent || 'none',
        embedUrl: id ? `https://www.youtube.com/embed/${id}?enablejsapi=1&rel=0&playsinline=1` : '',
        watchUrl: id ? `https://www.youtube.com/watch?v=${id}` : ''
      };
      return { ...video, matchScore: qualityScore(video, request) };
    })
      .filter(item => item.id && item.embeddable && item.privacyStatus === 'public')
      .sort((a, b) => b.matchScore - a.matchScore)
      .slice(0, limit);

    const bestMatch = items[0] && items[0].matchScore >= 28 ? items[0] : null;
    res.setHeader('Cache-Control', 'public, s-maxage=3600, stale-while-revalidate=21600');
    return res.status(200).json({
      provider: 'YouTube',
      state: 'online',
      query,
      requested: { title: request.title || request.q, artist: request.artist, album: request.album },
      bestMatch,
      items,
      resolver: 'Auralis Full Playback v9.1',
      quotaNote: 'YouTube search is performed only on playback resolution; results are CDN-cacheable.'
    });
  } catch (error) {
    const status = Number(error?.status || 503);
    return res.status(status >= 400 && status < 600 ? status : 503).json({
      provider: 'YouTube',
      state: status === 403 ? 'quota_or_permission' : 'degraded',
      error: error?.name === 'AbortError' ? 'YouTube resolver timed out' : (error?.message || 'YouTube search is temporarily unavailable')
    });
  }
}
