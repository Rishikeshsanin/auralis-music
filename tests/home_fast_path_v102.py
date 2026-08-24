from pathlib import Path

root = Path(__file__).resolve().parents[1]
manager = (root / 'js' / 'providers' / 'catalog-manager.js').read_text()
app = (root / 'js' / 'app-v3.js').read_text()
hotfix = (root / 'js' / 'product-hotfix-v10-1-2.js').read_text()

# First-impression Home feed must not block on the slowest music provider.
assert "const HOME_FEED_CACHE_KEY = 'auralis:home-feed:v2'" in manager, 'dedicated Home feed cache missing'
assert 'HOME_FEED_FAST_TIMEOUT_MS = 1600' in manager, 'initial Home provider budget must stay bounded'
assert 'homeBootCacheUsed' in manager, 'boot cache must only be consumed once per page session'
assert 'readHomeFeedCache(limit)' in manager and 'writeHomeFeedCache(merged)' in manager, 'stale-while-revalidate Home cache missing'
assert 'Promise.race([audiusTask, timeoutValue(HOME_FEED_FAST_TIMEOUT_MS)])' in manager, 'Audius initial request must be bounded'
assert 'Promise.race([jamendoTask, timeoutValue(HOME_FEED_FAST_TIMEOUT_MS)])' in manager, 'Jamendo initial request must be bounded'
assert 'void liveMergeTask.catch(() => [])' in manager, 'full provider refresh must continue in the background'

# No provider or feature may be removed from the existing catalog behavior.
assert "this.songProviders = [audiusProvider, jamendoProvider]" in manager, 'Audius/Jamendo provider set changed'
assert 'if (offset > 0)' in manager and 'Promise.all([' in manager, 'pagination must still query the full live provider set'
assert 'searchTracks(query' in manager and 'collection(collection' in manager, 'search/collection catalog paths must remain'
assert "import { catalogManager, dedupeTracks } from './providers/catalog-manager.js';" in app, 'app must keep the same catalog-manager integration'

# Artwork/Aura stability work from v10.1.4-v10.1.6 must remain in place.
assert "const VERSION = '10.1.6'" in hotfix, 'artwork loading hotfix must remain active'
assert 'installTrendingGridGuard' in hotfix, 'poster DOM preservation must remain active'
assert 'prioritizeVisibleArtwork' in hotfix and 'scanVisibleFallbacks' in hotfix, 'fast visible artwork path must remain active'
assert "setInterval(syncVideoPopup, 350)" not in hotfix, 'performance regression: permanent video polling returned'

# This cache is discovery-only. It must never clear or mutate unrelated user state.
assert 'localStorage.clear(' not in manager
assert 'sessionStorage.clear(' not in manager
assert 'indexedDB.deleteDatabase(' not in manager

print('Auralis v10.2 Home fast-path regression tests passed')
