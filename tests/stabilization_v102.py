from pathlib import Path

root = Path(__file__).resolve().parents[1]
app = (root / 'js' / 'app-v3.js').read_text(encoding='utf-8')
graph = (root / 'js' / 'music-graph-v9.js').read_text(encoding='utf-8')
coordinator = (root / 'js' / 'playback-coordinator-v10-2.js').read_text(encoding='utf-8')
full = (root / 'js' / 'full-playback-v9-1.js').read_text(encoding='utf-8')
universe = (root / 'js' / 'player-universe-v10-1.js').read_text(encoding='utf-8')
polish = (root / 'js' / 'product-polish-v10-1.js').read_text(encoding='utf-8')
hotfix = (root / 'js' / 'product-hotfix-v10-1-2.js').read_text(encoding='utf-8')
catalog = (root / 'api' / 'catalog.js').read_text(encoding='utf-8')
ux = (root / 'js' / 'ux-reliability-v9-2.js').read_text(encoding='utf-8')
collections = (root / 'js' / 'collections.js').read_text(encoding='utf-8')
manager = (root / 'js' / 'providers' / 'catalog-manager.js').read_text(encoding='utf-8')
audius = (root / 'js' / 'providers' / 'audius.js').read_text(encoding='utf-8')

# Provider artwork candidates flow from normalization to every core image.
assert 'dataset.auralisArtworkCandidates' in app
assert 'auralisArtworkCandidates' in ux and 'configuredNext' in ux
assert ux.index("['480x480', '1000x1000', '150x150']") >= 0
assert "auralisRecoveryLoadBound" in ux and "v1011-branded-art" in ux
assert "new URL(path, mirror).href" in audius

# Sparse curated collections use a semantically related live provider route.
assert "id:'fresh-drops'" in collections and "fallbackLoader:'latest'" in collections
assert 'collection.fallbackLoader' in manager and 'specializedFallback' in manager

# Player artwork and cards are stable during state-only updates.
assert 'els.playerCover.dataset.artworkKey !== artworkKey' in app
assert 'syncPlaybackIndicators' in app
assert "Object.getOwnPropertyDescriptor(Element.prototype, 'innerHTML')" not in hotfix
assert "if (node !== img) node.remove()" in hotfix

# Audius failures retry a fresh canonical stream request before queue skipping.
assert 'function retryStream(track)' in app
assert "url.searchParams.set('_auralis_attempt'" in app
assert app.index('if (retryStream(track)) return;') < app.index('state.failedTracks.add(track.id)')

# Signed Deezer previews are refreshed and failures are bounded to one replacement.
assert "if (mode === 'track')" in catalog and "private, no-store" in catalog
assert 'previewExpiresSoon' in graph and "fetchCatalog({ mode: 'track'" in graph
assert 'state.preview.recoveryCount < 1' in graph
assert "toast('Preview source unavailable'" in graph
assert "toast('Preview source failed'" not in graph
assert 'AuralisMusicGraphV9?.deactivatePreview?.()' in coordinator

# Mixed queues own next/previous/ended transitions across direct and YouTube sources.
assert 'AuralisCorePlayerV102' in app and 'trackForNode' in app
assert "auralis:core-ended" in app and "auralis:core-ended" in universe
assert "auralis:full-ended" in full and "auralis:full-ended" in universe
assert "auralis:full-queue-navigation" in full and "auralis:full-queue-navigation" in universe

# Full/player presentation synchronization is event-driven, not permanently polled.
assert "auralis:full-playback-state" in full
assert 'setInterval(syncVideoPresentation, 500)' not in polish
assert 'setInterval(() =>' not in universe
assert "attributes: true, attributeFilter: ['class']" not in universe
assert "attributes:true, attributeFilter:['class']" not in polish
assert "window.addEventListener('auralis:view-change', queueMaintenance)" in ux
assert "observer.observe($('#contentScroll') || document.body" in full

print('Auralis v10.2 stabilization regression tests passed')
