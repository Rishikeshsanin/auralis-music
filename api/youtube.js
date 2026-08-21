function clampInt(value, fallback, min, max) {
  const parsed = Number.parseInt(value, 10);
  if (!Number.isFinite(parsed)) return fallback;
  return Math.min(max, Math.max(min, parsed));
}

function safeText(value = '') {
  return String(value || '').slice(0, 400);
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

  const q = safeText(req.query.q).trim();
  const limit = clampInt(req.query.limit, 8, 1, 12);
  if (!q) return res.status(400).json({ error: 'Search query required' });

  const url = new URL('https://www.googleapis.com/youtube/v3/search');
  url.searchParams.set('key', key);
  url.searchParams.set('part', 'snippet');
  url.searchParams.set('type', 'video');
  url.searchParams.set('videoCategoryId', '10');
  url.searchParams.set('maxResults', String(limit));
  url.searchParams.set('q', q);
  url.searchParams.set('safeSearch', 'none');

  try {
    const response = await fetch(url, { headers: { Accept: 'application/json' } });
    const json = await response.json();
    if (!response.ok) {
      return res.status(response.status).json({
        provider: 'YouTube',
        state: response.status === 403 ? 'quota_or_permission' : 'degraded',
        error: json?.error?.message || `YouTube request failed (${response.status})`
      });
    }

    const items = (json.items || []).map(item => ({
      id: item.id?.videoId || '',
      title: item.snippet?.title || 'Untitled',
      channel: item.snippet?.channelTitle || 'YouTube',
      publishedAt: item.snippet?.publishedAt || '',
      artwork: item.snippet?.thumbnails?.high?.url || item.snippet?.thumbnails?.medium?.url || item.snippet?.thumbnails?.default?.url || '',
      embedUrl: item.id?.videoId ? `https://www.youtube.com/embed/${item.id.videoId}?enablejsapi=1&rel=0` : '',
      watchUrl: item.id?.videoId ? `https://www.youtube.com/watch?v=${item.id.videoId}` : ''
    })).filter(item => item.id);

    res.setHeader('Cache-Control', 'public, s-maxage=300, stale-while-revalidate=900');
    return res.status(200).json({
      provider: 'YouTube',
      state: 'online',
      query: q,
      items,
      quotaNote: 'search.list uses the YouTube Data API search quota bucket'
    });
  } catch {
    return res.status(503).json({
      provider: 'YouTube',
      state: 'degraded',
      error: 'YouTube search is temporarily unavailable'
    });
  }
}
