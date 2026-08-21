const USER_AGENT = 'AuralisMusic/9.0 (provider control plane; https://auralis-music-lime.vercel.app)';

function now() { return new Date().toISOString(); }

async function probe(name, url, { timeout = 2600, validate } = {}) {
  const controller = new AbortController();
  const started = Date.now();
  const timer = setTimeout(() => controller.abort(), timeout);
  try {
    const response = await fetch(url, {
      headers: { Accept: 'application/json', 'User-Agent': USER_AGENT },
      signal: controller.signal
    });
    const latency = Date.now() - started;
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    let json = null;
    if (validate) {
      json = await response.json();
      if (!validate(json)) throw new Error('Unexpected response');
    }
    return { name, state: 'online', latency, checkedAt: now() };
  } catch (error) {
    return { name, state: 'degraded', latency: Date.now() - started, checkedAt: now(), error: String(error?.name === 'AbortError' ? 'timeout' : error?.message || error) };
  } finally {
    clearTimeout(timer);
  }
}

function configured(name, ready, role, capabilities, note = '') {
  return {
    name,
    state: ready ? 'configured' : 'needs_credentials',
    role,
    capabilities,
    checkedAt: now(),
    note
  };
}

export default async function handler(req, res) {
  if (req.method !== 'GET') {
    res.setHeader('Allow', 'GET');
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const checks = await Promise.all([
    probe('Audius', 'https://api.audius.co/v1/tracks/trending?app_name=AuralisMusic&limit=1', {
      validate: json => Array.isArray(json?.data)
    }),
    probe('Deezer', 'https://api.deezer.com/search?q=auralis&limit=1', {
      validate: json => Array.isArray(json?.data)
    }),
    probe('MusicBrainz', 'https://musicbrainz.org/ws/2/recording/?query=auralis&fmt=json&limit=1', {
      timeout: 3400,
      validate: json => Array.isArray(json?.recordings)
    }),
    probe('Radio Browser', 'https://de1.api.radio-browser.info/json/stats', {
      validate: json => Boolean(json && typeof json === 'object')
    })
  ]);

  const optional = [
    configured(
      'YouTube',
      Boolean(process.env.YOUTUBE_API_KEY),
      'Official embedded playback fallback',
      ['search', 'video', 'playlists', 'official-embed'],
      process.env.YOUTUBE_API_KEY ? 'YouTube Data API key detected.' : 'Add YOUTUBE_API_KEY to activate music search + official IFrame playback.'
    ),
    configured(
      'SoundCloud',
      Boolean(process.env.SOUNDCLOUD_CLIENT_ID && process.env.SOUNDCLOUD_CLIENT_SECRET),
      'Full-track / preview catalog',
      ['search', 'tracks', 'playlists', 'full-stream-where-playable'],
      process.env.SOUNDCLOUD_CLIENT_ID ? 'SoundCloud app credentials detected.' : 'Requires a registered SoundCloud app.'
    ),
    configured(
      'Last.fm',
      Boolean(process.env.LASTFM_API_KEY),
      'Discovery intelligence',
      ['charts', 'similar-tracks', 'similar-artists', 'tags', 'geo'],
      process.env.LASTFM_API_KEY ? 'Last.fm API key detected.' : 'Add LASTFM_API_KEY for recommendations and charts.'
    ),
    configured(
      'Audiomack',
      Boolean(process.env.AUDIOMACK_CONSUMER_KEY && process.env.AUDIOMACK_CONSUMER_SECRET),
      'Tracks, albums and playlists',
      ['search', 'charts', 'albums', 'playlists', 'stream-source'],
      process.env.AUDIOMACK_CONSUMER_KEY ? 'Audiomack consumer credentials detected.' : 'Requires Audiomack OAuth consumer credentials.'
    ),
    configured(
      'Spotify',
      Boolean(process.env.SPOTIFY_CLIENT_ID && process.env.SPOTIFY_CLIENT_SECRET),
      'Connected catalog',
      ['search', 'albums', 'artists', 'playlists', 'premium-playback'],
      process.env.SPOTIFY_CLIENT_ID ? 'Spotify developer credentials detected.' : 'Optional connected service; Premium is required for browser playback.'
    ),
    configured(
      'Apple Music',
      Boolean(process.env.APPLE_MUSIC_DEVELOPER_TOKEN),
      'Connected catalog',
      ['search', 'albums', 'artists', 'playlists', 'subscriber-playback'],
      process.env.APPLE_MUSIC_DEVELOPER_TOKEN ? 'Apple Music developer token detected.' : 'Optional connected service via MusicKit.'
    )
  ];

  const jamendo = {
    name: 'Jamendo',
    state: 'client',
    role: 'Independent full-track catalog',
    capabilities: ['search', 'tracks', 'collections', 'full-stream'],
    checkedAt: now(),
    note: 'Browser adapter uses Jamendo read API; health is also tracked by Auralis client runtime.'
  };

  const coverArt = {
    name: 'Cover Art Archive',
    state: checks.find(item => item.name === 'MusicBrainz')?.state === 'online' ? 'online' : 'checking',
    role: 'Canonical album artwork',
    capabilities: ['album-art', 'release-group-art'],
    checkedAt: now(),
    note: 'Used as an artwork fallback through MusicBrainz release-group IDs.'
  };

  const providers = [
    checks.find(p => p.name === 'Audius'),
    jamendo,
    checks.find(p => p.name === 'Deezer'),
    checks.find(p => p.name === 'MusicBrainz'),
    coverArt,
    checks.find(p => p.name === 'Radio Browser'),
    ...optional
  ].filter(Boolean);

  const summary = providers.reduce((acc, provider) => {
    acc[provider.state] = (acc[provider.state] || 0) + 1;
    return acc;
  }, {});

  res.setHeader('Cache-Control', 'public, s-maxage=45, stale-while-revalidate=120');
  return res.status(200).json({
    version: 'Auralis Provider Control Plane v9',
    checkedAt: now(),
    summary,
    providers
  });
}
