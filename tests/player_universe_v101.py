from pathlib import Path

root = Path(__file__).resolve().parents[1]

required = [
    'js/player-universe-v10-1.js',
    'experience-v10-1.css',
    'js/konkani-radio-v7.js',
    'js/full-playback-v9-1.js',
    'js/music-graph-v9.js',
]
for name in required:
    path = root / name
    assert path.exists() and path.stat().st_size > 0, f'missing v10.1 file: {name}'

app = (root / 'js/player-universe-v10-1.js').read_text()
css = (root / 'experience-v10-1.css').read_text()
boot = (root / 'js/konkani-radio-v7.js').read_text()
full = (root / 'js/full-playback-v9-1.js').read_text()
graph = (root / 'js/music-graph-v9.js').read_text()

# Progressive boot only: preserve all existing layers, then add v10.1 last.
assert "import('./music-graph-v9.js')" in boot, 'Music Graph boot must remain'
assert "import('./full-playback-v9-1.js')" in boot, 'full playback boot must remain'
assert "import('./ux-reliability-v9-2.js')" in boot, 'UX reliability boot must remain'
assert "import('./playback-recovery-v9-2-1.js')" in boot, 'playback recovery boot must remain'
assert "import('./player-universe-v10-1.js')" in boot, 'v10.1 interaction layer must boot last'

# Video mode toggles visibility only; it must not replace or destroy YouTube playback.
assert 'videoModeToggleV101' in app and 'VIDEO_PREF_KEY' in app, 'bottom video-mode toggle missing'
assert 'v101-video-mode-off' in app and 'v101-video-mode-off .v91-playback-dock.open' in css, 'video visibility mode missing'
assert 'state.player?.destroy' not in app, 'v10.1 video toggle must not destroy the existing YouTube player'
assert 'youtube.com/embed/' in full and 'youtube-dl' not in full.lower() and 'yt-dlp' not in full.lower(), 'official YouTube playback contract changed'

# Unified explicit queue: direct catalog, rows, radio and Music Graph/video results.
for marker in ['.music-card', '.track-row', '.radio-card', '.v9-graph-card', '.v9-album-row,.v9-playlist-row']:
    assert marker in app, f'queue coverage missing for {marker}'
assert 'data-v101-add-queue' in app and 'renderUnifiedQueue' in app and 'playQueueIndex' in app, 'unified queue lifecycle incomplete'
assert 'AuralisFullPlaybackV91' in app and 'playTarget' in app, 'mixed direct/video queue routing missing'
assert 'clearUnifiedQueue' in app and 'data-v101-queue-remove' in app, 'queue clear/remove controls missing'

# API / Music Graph likes: card, detail, rows and bottom player all share persisted graph likes.
assert "auralis:graph-likes:v1" in app, 'existing graph-like storage must be preserved'
assert 'toggleGraphLike' in app and 'renderGraphLikes' in app and 'syncPlayerGraphLike' in app, 'graph-like lifecycle incomplete'
assert 'data-v101-graph-like' in app and 'detailLikeV101' in app, 'graph like controls missing'
assert '#playerLike' in app and "v91-youtube-active" in app and "v9-preview-active" in app, 'bottom player like integration missing'

# Search result shelf remains compact and exposes a clear route to more versions.
assert 'View more results' in app and 'openUniverseForQueryV9' in app, 'view-more search path missing'
assert 'graphMoreButton' in app, 'Universe pagination must remain available'

# Keep Preview and Full Song as peer actions; do not remove preview or playlist/detail behavior.
assert '▶ Full song' in app, 'full-song CTA label missing'
assert '.v9-card-actions .v91-full-button' in css and '.v9-card-actions .v9-preview-btn' in css, 'preview/full CTA parity missing'
assert 'data-v9-preview' in graph and 'detailPreviewV9' in graph, '30-second preview functionality must remain'
assert 'choosePlaylist' in graph and 'detailAddV9' in graph, 'playlist functionality must remain'

# No API/provider replacement and no downloader-style playback shortcuts.
assert '/api/youtube' not in app, 'v10.1 should reuse the existing resolver instead of creating another YouTube API path'
assert 'youtube-dl' not in app.lower() and 'yt-dlp' not in app.lower(), 'downloader-style playback is forbidden'

print('Auralis player + universe v10.1 regression tests passed')
