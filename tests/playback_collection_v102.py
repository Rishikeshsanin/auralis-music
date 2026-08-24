from pathlib import Path

root = Path(__file__).resolve().parents[1]
manager = (root / 'js' / 'providers' / 'catalog-manager.js').read_text()
coordinator = (root / 'js' / 'playback-coordinator-v10-2.js').read_text()
boot = (root / 'js' / 'konkani-radio-v7.js').read_text()
app = (root / 'js' / 'app-v3.js').read_text()
graph = (root / 'js' / 'music-graph-v9.js').read_text()
full = (root / 'js' / 'full-playback-v9-1.js').read_text()
lifecycle = (root / 'js' / 'preview-lifecycle-v10-2.mjs').read_text()

# Partial provider collections must remain real and gain enough live results for pagination.
assert 'async fillCollectionPage' in manager, 'partial collection filler missing'
assert 'dedupeTracks([...primary, ...specializedFallback, ...liveFallback]).slice(0, limit)' in manager, 'real collection items must be preserved before specialized/live fallback items'
assert 'collection.fallbackLoader' in manager, 'sparse specialized collections need a relevant live provider fallback'
assert "return this.fillCollectionPage(tracks, collection, { limit, offset });" in manager, 'source-specific collections must use live page filling'
assert 'fallbackTracks' not in manager, 'catalog manager must never substitute Demo tracks into a live collection'
assert 'state.discoverHasMore = tracks.length >= 16' in app, 'Discover load-more contract changed unexpectedly'
assert "els.discoverMore.textContent = 'Load more tracks'" in app, 'Load more tracks control must remain available'

# The coordinator must boot after preview support but before Full Playback's capture handlers.
graph_pos = boot.index("import('./music-graph-v9.js')")
coord_pos = boot.index("import('./playback-coordinator-v10-2.js')")
full_pos = boot.index("import('./full-playback-v9-1.js')")
assert graph_pos < coord_pos < full_pos, 'playback coordinator must boot between Music Graph and Full Playback'
assert "const VERSION = '10.2.0'" in coordinator

# Preview owns playback exclusively and pauses an interrupted YouTube full song in place.
assert 'suspendFullForPreview' in coordinator and 'full.state.player.pauseVideo?.()' in coordinator
assert 'full.state.active = false' in coordinator, 'full-player progress/control handlers must go idle during preview'
assert 'v102-preview-exclusive' in coordinator and 'pointer-events:none' in coordinator, 'paused full iframe must not be interactable during a preview'

# Preview startup and completion must be explicit lifecycle transitions, never inferred from one DOM frame.
assert "window.addEventListener('auralis:preview-requested', handlePreviewRequested)" in coordinator
assert "window.addEventListener('auralis:preview-started', handlePreviewStarted)" in coordinator
assert "['failed', 'cancelled', 'ended']" in coordinator
assert "playerBar()?.classList.contains('v9-preview-active')" not in coordinator, 'coordinator must not infer preview startup from DOM timing'
assert 'class PreviewRequestLifecycle' in lifecycle and 'class PreviewOwnershipLifecycle' in lifecycle
assert 'state.preview.sequence && state.preview.index < state.preview.queue.length - 1' in graph, 'preview playlists must finish after the last available preview'

# Previous playback is restored as PAUSED, never auto-resumed.
assert 'restoreFullPaused' in coordinator and "$('#playButton').textContent = '▶'" in coordinator
assert 'restoreCorePaused' in coordinator and 'audio.pause();' in coordinator
assert 'audio.play(' not in coordinator, 'coordinator must never auto-resume interrupted core audio'
assert 'playVideo?.();' not in coordinator, 'coordinator must never auto-resume interrupted YouTube playback'

# Any new owner must silence every competing source.
assert 'claimFullPlayback' in coordinator and 'claimDirectPlayback' in coordinator and 'claimLegacyLookup' in coordinator
assert 'stopLegacyLookup' in coordinator, 'old YouTube lookup iframe must be silenced when another owner starts'
assert "window.addEventListener('play', handleAudioPlay, true)" in coordinator, 'programmatic core audio starts must also claim exclusive ownership'
assert "full.stop?.()" in coordinator, 'direct playback must stop any prior full-player session'

# Bottom player artwork must follow preview/full ownership.
assert 'track.artwork || video.artwork' in coordinator, 'full song artwork must restore into the bottom player'
assert 'nodes.cover.dataset.artworkKey' in graph and 'item.artwork' in graph, 'Music Graph preview must keep stable, source-correct player artwork'
assert 'const artwork = track.artwork || video.artwork' in full, 'Full Playback must continue updating player artwork'

# Existing playback implementations remain present; this is coordination, not replacement.
assert 'function loadTrack(track, autoplay = false)' in app
assert 'async function startPreview(queue, index = 0' in graph
assert 'async function playFullTrack(track, queue = null, index = null)' in full

print('Auralis v10.2 collection pagination + playback ownership regression tests passed')
