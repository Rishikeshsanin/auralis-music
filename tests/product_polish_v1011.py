from pathlib import Path

root = Path(__file__).resolve().parents[1]
js = (root / 'js' / 'product-polish-v10-1.js').read_text()
css = (root / 'experience-v10-1-polish.css').read_text()
boot = (root / 'js' / 'konkani-radio-v7.js').read_text()
graph = (root / 'js' / 'music-graph-v9.js').read_text()
full = (root / 'js' / 'full-playback-v9-1.js').read_text()

assert "import('./product-polish-v10-1.js')" in boot, 'final product polish must boot after v10.1'
assert boot.index("import('./player-universe-v10-1.js')") < boot.index("import('./product-polish-v10-1.js')"), 'polish must boot after player/universe layer'

# Video is opt-in as a large floating window. Default is a simple dock attached
# to the player, never the large popup.
assert "expandedVideo: false" in js, 'large video must not open automatically'
assert "repeat.after(button)" in js, 'Video control must sit next to Repeat'
assert 'v1011-video-docked' in js and 'v1011-video-expanded' in js, 'docked/expanded video states missing'
assert 'beginDrag' in js and 'moveDrag' in js and 'ResizeObserver' in js, 'desktop drag/resize support missing'
assert 'VIDEO_LAYOUT_KEY' in js and 'saveVideoLayout' in js, 'video size/position persistence missing'
assert 'v1011-docked.open' in css and 'resize:both' in css, 'docked + resizable video styling missing'
assert 'width:320px' in css and 'height:200px' in css and 'min-height:200px!important' in css, 'docked YouTube viewport must stay at least 200px in each axis'
assert '.v1011-video-button.v1011-open' in css, 'Video control should highlight only when floating video is open'
assert 'window.AuralisFullPlaybackV91' in js and 'YT.Player' in full, 'official YouTube player must remain the playback engine'
assert 'youtube-dl' not in js.lower() and 'yt-dlp' not in js.lower(), 'downloader-style playback is forbidden'

# Avoid observer feedback loops: decoration is one-time and scans are coalesced.
assert "button.dataset.v1011Decorated !== 'true'" in js, 'Video decoration must be guarded'
assert 'scanQueued' in js and 'requestAnimationFrame(polish)' in js, 'product observer work must be coalesced'

# Playlist cancel/close must never be blocked by required Name validation.
assert "button.type = 'button'" in js and 'button.formNoValidate = true' in js, 'playlist cancel buttons must bypass form validation'
assert "dialog.close('cancel')" in js, 'playlist dialog cancel must close explicitly'
assert 'v1011-playlist-mark' in js and 'v1011-list-icon' in css, 'playlist UI polish missing'

# Preview duration leaves the poster and appears only around the Preview control.
assert 'v1011-preview-badge-removed' in js and 'v1011-preview-hint' in js, 'preview label relocation missing'
assert '.v9-graph-art i.v1011-preview-badge-removed' in css, 'poster preview badge must be hidden'
assert ':hover .v1011-preview-hint' in css, '30-second hint must be hover/focus driven'
assert 'data-v9-preview' in graph, 'existing preview playback must remain'

# Artist pages expose a real playable/queueable sequence.
assert 'Artist playlist' in js and 'data-v1011-artist-play' in js and 'data-v1011-artist-queue' in js, 'artist playlist controls missing'
assert 'full.state.queue = next' in js and 'api.addToQueue(track)' in js, 'artist playlist playback/queue behavior missing'

# Artwork recovery: real provider/canonical artwork first, branded Aura fallback last.
assert "new URL('/api/catalog'" in js and "url.searchParams.set('kind','track')" in js, 'canonical artwork recovery must reuse Music Graph catalog'
assert 'visibleHost' in js, 'artwork recovery must be limited to active/visible surfaces'
assert 'v1011-branded-art' in js and 'v1011-branded-art' in css, 'branded artwork fallback missing'
assert '--aura-primary' in css and '--aura-secondary' in css, 'fallback artwork should react to Aura colors'

# Existing core feature contracts remain intact.
for marker in ["auralis:playlists:v2", 'graphMoreButton', 'detailPreviewV9', 'choosePlaylist']:
    assert marker in graph, f'existing Music Graph contract changed: {marker}'
assert "import('./update-manager-v10.js')" in boot, 'Stability v10 must remain active'
assert 'localStorage.clear(' not in js and 'indexedDB.deleteDatabase(' not in js, 'polish layer must not wipe user data'

print('Auralis v10.1.1 product polish regression tests passed')
