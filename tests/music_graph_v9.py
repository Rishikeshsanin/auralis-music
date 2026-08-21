from pathlib import Path

root = Path(__file__).resolve().parents[1]

required = [
    'experience-v9.css',
    'js/music-graph-v9.js',
    'api/catalog.js',
    'api/providers.js',
    'api/youtube.js',
]
for name in required:
    path = root / name
    assert path.exists() and path.stat().st_size > 0, f'missing v9 file: {name}'

app = (root / 'js/music-graph-v9.js').read_text()
css = (root / 'experience-v9.css').read_text()
catalog = (root / 'api/catalog.js').read_text()
providers = (root / 'api/providers.js').read_text()
youtube = (root / 'api/youtube.js').read_text()
konkani = (root / 'js/konkani-radio-v7.js').read_text()
sw = (root / 'sw.js').read_text()

# Universal catalog + Music Graph UI
assert 'AURALIS MUSIC GRAPH' in app and 'universeView' in app, 'Music Graph universe UI missing'
assert "new URL('/api/catalog'" in app, 'Universal catalog endpoint not wired'
assert 'graphSearchRailV9' in app, 'Global-search catalog rail missing'
assert "kind: 'track'" in app and "kind === 'album'" in app and "kind === 'artist'" in app, 'Track/album/artist modes missing'
assert 'MusicBrainz' in app and 'Deezer' in app, 'Catalog source explanation missing'

# Provider-independent local playlists
assert "auralis:playlists:v2" in app, 'Local Auralis playlist store missing'
assert 'createPlaylist' in app and 'choosePlaylist' in app and 'openPlaylist' in app, 'Playlist lifecycle incomplete'
assert "#newPlaylistButton" in app and 'stopImmediatePropagation' in app, 'Existing playlist placeholder not upgraded safely'

# Playback: clear labeling + full-source handoff + official YouTube path
assert '30-second catalog preview' in app, 'Preview playback must be labeled'
assert 'findFullSource' in app, 'Full-track provider fallback handoff missing'
assert "fetch(`/api/youtube" in app, 'YouTube adapter not wired'
assert 'youtube.com/embed/' in app, 'YouTube playback must use official embed'
assert 'youtube-dl' not in app.lower() and 'yt-dlp' not in app.lower(), 'Downloader-style YouTube integration is forbidden'

# Catalog endpoint: broad metadata, canonical identity and artwork fallback
assert "const DEEZER = 'https://api.deezer.com'" in catalog, 'Deezer catalog source missing'
assert "const MUSICBRAINZ = 'https://musicbrainz.org/ws/2'" in catalog, 'MusicBrainz source missing'
assert 'attachMusicBrainz' in catalog and 'isrc' in catalog.lower(), 'Canonical recording mapping missing'
assert 'coverartarchive.org/release-group/' in catalog, 'Cover Art Archive fallback missing'
assert "mode === 'album'" in catalog and "mode === 'artist'" in catalog and "mode === 'chart'" in catalog, 'Catalog entity routes missing'
assert "playback: 'preview'" in catalog or "item.preview ? 'preview'" in catalog, 'Preview availability not represented'
assert 'gaana' not in catalog.lower() and 'jiosaavn' not in catalog.lower(), 'Unofficial scraper catalog must not be a core dependency'

# Provider control plane + credential gates
for provider in ['Audius', 'Jamendo', 'Deezer', 'MusicBrainz', 'Radio Browser', 'YouTube', 'SoundCloud', 'Last.fm', 'Audiomack', 'Spotify', 'Apple Music']:
    assert provider in providers, f'provider control entry missing: {provider}'
assert 'needs_credentials' in providers, 'Credential-ready provider state missing'
assert 'latency' in providers and 'checkedAt' in providers, 'Provider health telemetry missing'
assert 'YOUTUBE_API_KEY' in youtube and 'needs_credentials' in youtube, 'YouTube credential gate missing'
assert 'videoCategoryId' in youtube and "'10'" in youtube, 'YouTube music-category search missing'
assert 'www.googleapis.com/youtube/v3/search' in youtube, 'Official YouTube Data API missing'

# v9 loading / responsive / accessible visual language
assert 'v9-skeleton' in css and '@keyframes' in css, 'v9 loading animation missing'
assert 'prefers-reduced-motion' in css, 'Reduced-motion support missing'
assert 'v9-provider-row' in css and 'v9-graph-card' in css and 'v9-playlist-card' in css, 'v9 major surfaces not styled'

# Layered boot + PWA shell
assert "import('./music-graph-v9.js')" in konkani, 'v9 boot loader missing'
assert "auralis-shell-v13" in sw, 'PWA cache was not bumped to v13'
assert './experience-v9.css' in sw and './js/music-graph-v9.js' in sw, 'v9 shell assets missing from PWA cache'

print('Auralis Music Graph v9 regression tests passed')
