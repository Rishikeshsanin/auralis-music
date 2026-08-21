const USER_AGENT = 'AuralisMusic/9.0 (college portfolio music platform; https://auralis-music-lime.vercel.app)';
const DEEZER = 'https://api.deezer.com';
const MUSICBRAINZ = 'https://musicbrainz.org/ws/2';

function clampInt(value, fallback, min, max) {
  const parsed = Number.parseInt(value, 10);
  if (!Number.isFinite(parsed)) return fallback;
  return Math.min(max, Math.max(min, parsed));
}

function clean(value = '') {
  return String(value).toLowerCase()
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/\([^)]*(official|video|audio|lyrics?|remaster|version)[^)]*\)/gi, ' ')
    .replace(/\[[^\]]*(official|video|audio|lyrics?|remaster|version)[^\]]*\]/gi, ' ')
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
}

function safeHttps(value = '') {
  try {
    const url = new URL(value);
    return url.protocol === 'https:' ? url.toString() : '';
  } catch {
    return '';
  }
}

function searchLinks(title = '', artist = '') {
  const query = encodeURIComponent(`${title} ${artist}`.trim());
  return {
    youtubeSearch: `https://www.youtube.com/results?search_query=${query}`,
    spotifySearch: `https://open.spotify.com/search/${query}`,
    appleMusicSearch: `https://music.apple.com/us/search?term=${query}`,
    soundcloudSearch: `https://soundcloud.com/search/sounds?q=${query}`
  };
}

async function fetchJson(url, { headers = {}, timeout = 4500 } = {}) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeout);
  try {
    const response = await fetch(url, {
      headers: { Accept: 'application/json', 'User-Agent': USER_AGENT, ...headers },
      signal: controller.signal
    });
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    return await response.json();
  } finally {
    clearTimeout(timer);
  }
}

function artistName(item) {
  return item?.artist?.name || item?.artistName || '';
}

function deezerTrack(item) {
  const artist = artistName(item) || 'Unknown artist';
  const album = item?.album || {};
  return {
    graphId: `deezer:track:${item.id}`,
    kind: 'track',
    provider: 'Deezer',
    providerId: String(item.id),
    title: item.title_short || item.title || 'Untitled',
    version: item.title_version || '',
    artist,
    artistId: item.artist?.id ? String(item.artist.id) : '',
    album: album.title || '',
    albumId: album.id ? String(album.id) : '',
    duration: Number(item.duration || 0),
    explicit: Boolean(item.explicit_lyrics),
    rank: Number(item.rank || 0),
    artwork: safeHttps(album.cover_xl || album.cover_big || album.cover_medium || album.cover || ''),
    previewUrl: safeHttps(item.preview || ''),
    permalink: safeHttps(item.link || ''),
    playback: item.preview ? 'preview' : 'metadata',
    sourceLinks: {
      deezer: safeHttps(item.link || ''),
      ...searchLinks(item?.title || '', artist)
    }
  };
}

function deezerAlbum(item) {
  const artist = artistName(item) || 'Unknown artist';
  const query = encodeURIComponent(`${item?.title || ''} ${artist}`.trim());
  return {
    graphId: `deezer:album:${item.id}`,
    kind: 'album',
    provider: 'Deezer',
    providerId: String(item.id),
    title: item.title || 'Untitled album',
    artist,
    artistId: item.artist?.id ? String(item.artist.id) : '',
    album: item.title || '',
    albumId: String(item.id),
    duration: Number(item.duration || 0),
    tracksCount: Number(item.nb_tracks || 0),
    releaseDate: item.release_date || '',
    artwork: safeHttps(item.cover_xl || item.cover_big || item.cover_medium || item.cover || ''),
    permalink: safeHttps(item.link || ''),
    playback: 'metadata',
    sourceLinks: {
      deezer: safeHttps(item.link || ''),
      youtubeSearch: `https://www.youtube.com/results?search_query=${query}`,
      spotifySearch: `https://open.spotify.com/search/${query}`,
      appleMusicSearch: `https://music.apple.com/us/search?term=${query}`
    }
  };
}

function deezerArtist(item) {
  const query = encodeURIComponent(item?.name || '');
  return {
    graphId: `deezer:artist:${item.id}`,
    kind: 'artist',
    provider: 'Deezer',
    providerId: String(item.id),
    title: item.name || 'Unknown artist',
    artist: item.name || 'Unknown artist',
    artistId: String(item.id),
    fans: Number(item.nb_fan || 0),
    albumsCount: Number(item.nb_album || 0),
    artwork: safeHttps(item.picture_xl || item.picture_big || item.picture_medium || item.picture || ''),
    permalink: safeHttps(item.link || ''),
    playback: 'metadata',
    sourceLinks: {
      deezer: safeHttps(item.link || ''),
      youtubeSearch: `https://www.youtube.com/results?search_query=${query}`,
      spotifySearch: `https://open.spotify.com/search/${query}`,
      appleMusicSearch: `https://music.apple.com/us/search?term=${query}`,
      soundcloudSearch: `https://soundcloud.com/search/people?q=${query}`
    }
  };
}

function mbArtist(recording) {
  return (recording?.['artist-credit'] || [])
    .map(part => part?.artist?.name || part?.name || '')
    .filter(Boolean)
    .join(', ');
}

function mbCandidate(recording) {
  const release = (recording.releases || [])[0] || {};
  const releaseGroup = release['release-group'] || {};
  return {
    mbid: recording.id || '',
    title: recording.title || '',
    artist: mbArtist(recording),
    isrc: (recording.isrcs || [])[0] || '',
    releaseDate: recording['first-release-date'] || release.date || '',
    releaseGroupId: releaseGroup.id || '',
    releaseTitle: release.title || releaseGroup.title || '',
    length: Number(recording.length || 0)
  };
}

function musicBrainzTrack(recording) {
  const candidate = mbCandidate(recording);
  const artworkFallback = candidate.releaseGroupId
    ? `https://coverartarchive.org/release-group/${encodeURIComponent(candidate.releaseGroupId)}/front-500`
    : '';
  return {
    graphId: `musicbrainz:recording:${candidate.mbid}`,
    kind: 'track',
    provider: 'MusicBrainz',
    providerId: candidate.mbid,
    title: candidate.title || 'Untitled',
    artist: candidate.artist || 'Unknown artist',
    album: candidate.releaseTitle || '',
    duration: candidate.length ? Math.round(candidate.length / 1000) : 0,
    releaseDate: candidate.releaseDate,
    artwork: '',
    artworkFallback,
    previewUrl: '',
    permalink: candidate.mbid ? `https://musicbrainz.org/recording/${encodeURIComponent(candidate.mbid)}` : '',
    playback: 'metadata',
    canonical: {
      mbid: candidate.mbid,
      isrc: candidate.isrc,
      releaseDate: candidate.releaseDate,
      releaseGroupId: candidate.releaseGroupId
    },
    sourceLinks: searchLinks(candidate.title, candidate.artist)
  };
}

function matchScore(item, mb) {
  const t1 = clean(item.title);
  const t2 = clean(mb.title);
  const a1 = clean(item.artist);
  const a2 = clean(mb.artist);

  const titleExact = Boolean(t1 && t2 && t1 === t2);
  const titlePartial = Boolean(t1 && t2 && (t1.includes(t2) || t2.includes(t1)));
  const artistExact = Boolean(a1 && a2 && a1 === a2);
  const artistPartial = Boolean(a1 && a2 && (a1.includes(a2) || a2.includes(a1)));
  const titleMatched = titleExact || titlePartial;
  const artistMatched = artistExact || artistPartial;

  // An exact title alone is unsafe: covers/remixes by unrelated artists are common.
  if (!titleMatched || !artistMatched) return 0;

  let score = (titleExact ? 8 : 4) + (artistExact ? 8 : 3);
  const itemDuration = Number(item.duration || 0);
  const mbDuration = Number(mb.length || 0) / 1000;
  if (itemDuration && mbDuration) {
    const delta = Math.abs(itemDuration - mbDuration);
    if (delta <= 4) score += 4;
    else if (delta <= 12) score += 2;
  }
  return score;
}

function attachMusicBrainz(items, recordings) {
  const mb = recordings.map(mbCandidate);
  return items.map(item => {
    if (item.kind !== 'track') return item;
    const best = mb
      .map(candidate => ({ candidate, score: matchScore(item, candidate) }))
      .sort((a, b) => b.score - a.score)[0];
    if (!best || best.score < 7) return item;
    const candidate = best.candidate;
    return {
      ...item,
      canonical: {
        mbid: candidate.mbid,
        isrc: candidate.isrc,
        releaseDate: candidate.releaseDate,
        releaseGroupId: candidate.releaseGroupId
      },
      releaseDate: item.releaseDate || candidate.releaseDate,
      album: item.album || candidate.releaseTitle,
      artworkFallback: candidate.releaseGroupId
        ? `https://coverartarchive.org/release-group/${encodeURIComponent(candidate.releaseGroupId)}/front-500`
        : ''
    };
  });
}

async function deezerSearch(q, kind, limit, offset) {
  const path = kind === 'album' ? 'search/album' : kind === 'artist' ? 'search/artist' : 'search';
  const url = new URL(`${DEEZER}/${path}`);
  url.searchParams.set('q', q);
  url.searchParams.set('limit', String(limit));
  url.searchParams.set('index', String(offset));
  const json = await fetchJson(url, { timeout: 4200 });
  const data = Array.isArray(json.data) ? json.data : [];
  if (kind === 'album') return data.map(deezerAlbum);
  if (kind === 'artist') return data.map(deezerArtist);
  return data.map(deezerTrack);
}

async function musicBrainzSearch(q, limit) {
  const url = new URL(`${MUSICBRAINZ}/recording/`);
  url.searchParams.set('query', q);
  url.searchParams.set('fmt', 'json');
  url.searchParams.set('limit', String(Math.min(limit, 25)));
  const json = await fetchJson(url, { timeout: 4200 });
  return Array.isArray(json.recordings) ? json.recordings : [];
}

async function chart(limit) {
  const json = await fetchJson(`${DEEZER}/chart/0/tracks?limit=${limit}`, { timeout: 4200 });
  return (json?.data || []).map(deezerTrack);
}

async function albumDetails(id) {
  const album = await fetchJson(`${DEEZER}/album/${encodeURIComponent(id)}`, { timeout: 4200 });
  if (album?.error) throw new Error(album.error.message || 'Album unavailable');
  const normalized = deezerAlbum(album);
  const tracks = (album?.tracks?.data || []).map(item => deezerTrack({
    ...item,
    album: {
      id: album.id,
      title: album.title,
      cover: album.cover,
      cover_medium: album.cover_medium,
      cover_big: album.cover_big,
      cover_xl: album.cover_xl
    }
  }));
  return {
    ...normalized,
    label: album.label || '',
    genres: (album.genres?.data || []).map(g => g.name).filter(Boolean),
    tracks
  };
}

async function artistDetails(id) {
  const [artist, top, albums] = await Promise.all([
    fetchJson(`${DEEZER}/artist/${encodeURIComponent(id)}`, { timeout: 4200 }),
    fetchJson(`${DEEZER}/artist/${encodeURIComponent(id)}/top?limit=12`, { timeout: 4200 }).catch(() => ({ data: [] })),
    fetchJson(`${DEEZER}/artist/${encodeURIComponent(id)}/albums?limit=18`, { timeout: 4200 }).catch(() => ({ data: [] }))
  ]);
  return {
    ...deezerArtist(artist),
    topTracks: (top.data || []).map(deezerTrack),
    albums: (albums.data || []).map(item => deezerAlbum({ ...item, artist }))
  };
}

export default async function handler(req, res) {
  if (req.method !== 'GET') {
    res.setHeader('Allow', 'GET');
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const mode = String(req.query.mode || 'search');
  const q = String(req.query.q || '').trim().slice(0, 160);
  const kind = ['track', 'album', 'artist'].includes(req.query.kind) ? req.query.kind : 'track';
  const limit = clampInt(req.query.limit, 18, 1, 30);
  const offset = clampInt(req.query.offset, 0, 0, 300);
  const id = String(req.query.id || '').trim().slice(0, 40);

  try {
    if (mode === 'chart') {
      const items = await chart(limit);
      res.setHeader('Cache-Control', 'public, s-maxage=180, stale-while-revalidate=900');
      return res.status(200).json({
        mode,
        items,
        coverage: { catalog: 'Deezer', canonical: 'MusicBrainz ready', playback: '30-second previews where available' }
      });
    }

    if (mode === 'album') {
      if (!id) return res.status(400).json({ error: 'Album id required' });
      const item = await albumDetails(id);
      res.setHeader('Cache-Control', 'public, s-maxage=900, stale-while-revalidate=3600');
      return res.status(200).json({ mode, item });
    }

    if (mode === 'artist') {
      if (!id) return res.status(400).json({ error: 'Artist id required' });
      const item = await artistDetails(id);
      res.setHeader('Cache-Control', 'public, s-maxage=900, stale-while-revalidate=3600');
      return res.status(200).json({ mode, item });
    }

    if (!q) return res.status(400).json({ error: 'Search query required' });

    const shouldCanonicalize = kind === 'track' && offset === 0;
    const [deezer, recordings] = await Promise.all([
      deezerSearch(q, kind, limit, offset).catch(() => []),
      shouldCanonicalize ? musicBrainzSearch(q, Math.min(limit, 20)).catch(() => []) : Promise.resolve([])
    ]);

    let items;
    if (kind === 'track') {
      items = deezer.length
        ? attachMusicBrainz(deezer, recordings)
        : recordings.slice(0, limit).map(musicBrainzTrack);
    } else {
      items = deezer;
    }

    res.setHeader('Cache-Control', 'public, s-maxage=120, stale-while-revalidate=600');
    return res.status(200).json({
      mode: 'search',
      kind,
      query: q,
      items,
      nextOffset: offset + items.length,
      hasMore: deezer.length >= limit,
      coverage: {
        catalog: deezer.length ? 'Deezer' : recordings.length ? 'MusicBrainz canonical fallback' : 'No active catalog match',
        canonical: recordings.length ? 'MusicBrainz' : 'Deezer',
        artwork: 'Deezer + Cover Art Archive fallback',
        playback: deezer.length ? 'Deezer 30-second preview where available' : 'Resolve through Auralis full-source / official-embed providers'
      }
    });
  } catch (error) {
    return res.status(503).json({
      error: 'Universal catalog is temporarily unavailable',
      detail: String(error?.name === 'AbortError' ? 'provider timeout' : error?.message || error)
    });
  }
}
