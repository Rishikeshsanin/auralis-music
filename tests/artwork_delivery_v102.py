from pathlib import Path

root = Path(__file__).resolve().parents[1]
audius = (root / 'js' / 'providers' / 'audius.js').read_text()
manager = (root / 'js' / 'providers' / 'catalog-manager.js').read_text()
app = (root / 'js' / 'app-v3.js').read_text()
hotfix = (root / 'js' / 'product-hotfix-v10-1-2.js').read_text()

# Home must keep the real Audius/Jamendo catalog architecture. The rejected
# experiment that replaced a slow first load with the Auralis demo feed must
# not return.
assert "const HOME_FEED_CACHE_KEY" not in manager, 'Home feed replacement cache must stay removed'
assert 'HOME_FEED_FAST_TIMEOUT_MS' not in manager, 'provider timeout must not replace real music with demo tracks'
assert "this.songProviders = [audiusProvider, jamendoProvider]" in manager, 'real song provider set changed'
assert 'audiusProvider.trending' in manager and 'jamendoProvider.popular' in manager, 'real trending sources changed'

# Audius exposes size-specific cover URLs. The card-sized 480px cover should
# be the primary URL, while larger/smaller/mirror URLs remain immediate
# fallbacks on the normalized track object.
first_480 = audius.index("art['480x480']")
first_mirror_spread = audius.index('...mirrors')
assert first_480 >= 0 and first_mirror_spread >= 0 and first_480 < first_mirror_spread, '480px artwork must be preferred before generic mirrors'
assert 'art._480x480' in audius, 'modern Audius 480px artwork key must remain supported'
assert "art['1000x1000']" in audius and "art['150x150']" in audius, 'Audius size fallbacks were removed'
assert 'artwork: artworkOf(track)' in audius and 'artworkCandidates: artworkCandidates(track)' in audius, 'normalized tracks must retain primary + fallback artwork URLs'

# Keep the existing v10.1.6 visible-artwork and poster-stability safeguards.
assert "const VERSION = '10.1.6'" in hotfix, 'v10.1.6 artwork stability layer must remain active'
assert 'prioritizeVisibleArtwork' in hotfix, 'visible artwork priority must remain active'
assert 'scanVisibleFallbacks' in hotfix, 'canonical artwork safety net must remain active'
assert 'installTrendingGridGuard' in hotfix, 'play/pause poster DOM guard must remain active'
assert "setInterval(syncVideoPopup, 350)" not in hotfix, 'continuous polling performance regression returned'

# No unrelated product paths or user storage are changed by this fix.
assert "import { catalogManager, dedupeTracks } from './providers/catalog-manager.js';" in app
assert 'loadTrending' in app and 'loadRadio' in app and 'togglePlayback' in app
assert 'localStorage.clear(' not in audius
assert 'sessionStorage.clear(' not in audius
assert 'indexedDB.deleteDatabase(' not in audius

print('Auralis v10.2 direct artwork delivery regression tests passed')
