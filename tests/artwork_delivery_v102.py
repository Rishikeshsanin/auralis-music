from pathlib import Path

root = Path(__file__).resolve().parents[1]
audius = (root / 'js' / 'providers' / 'audius.js').read_text()
manager = (root / 'js' / 'providers' / 'catalog-manager.js').read_text()
app = (root / 'js' / 'app-v3.js').read_text()
hotfix = (root / 'js' / 'product-hotfix-v10-1-2.js').read_text()
hotfix_css = (root / 'experience-v10-1-hotfix.css').read_text()

# Home must keep the real Audius/Jamendo catalog architecture. The rejected
# experiment that replaced a slow first load with the Auralis demo feed must
# not return.
assert "const HOME_FEED_CACHE_KEY" not in manager, 'Home feed replacement cache must stay removed'
assert 'HOME_FEED_FAST_TIMEOUT_MS' not in manager, 'provider timeout must not replace real music with demo tracks'
assert "this.songProviders = [audiusProvider, jamendoProvider]" in manager, 'real song provider set changed'
assert 'audiusProvider.trending' in manager and 'jamendoProvider.popular' in manager, 'real trending sources changed'

# Audius exposes size-specific cover URLs. The card-sized 480px cover should
# be the primary URL, while larger/smaller/mirror URLs remain immediate
# fallbacks on the normalized track object. This normalized artwork is shared
# by Home, Discover, Collections, Genres/Moods, Queue, Liked/Recent and Player.
first_480 = audius.index("art['480x480']")
first_mirror_spread = audius.index('...mirrors')
assert first_480 >= 0 and first_mirror_spread >= 0 and first_480 < first_mirror_spread, '480px artwork must be preferred before generic mirrors'
assert 'art._480x480' in audius, 'modern Audius 480px artwork key must remain supported'
assert "art['1000x1000']" in audius and "art['150x150']" in audius, 'Audius size fallbacks were removed'
assert 'artwork: artworkOf(track)' in audius and 'artworkCandidates: artworkCandidates(track)' in audius, 'normalized tracks must retain primary + fallback artwork URLs'

# Source-specific Collections must stay on real catalog music even when their
# specialized endpoint returns only a small curated batch. Preserve those real
# source items first, then fill the rest of the page from the collection's live
# multi-provider query. This is what prevents Fresh Drops from stopping at 4–5
# tracks while also preventing the offline Auralis Demo feed from replacing it.
assert 'async fillCollectionPage' in manager, 'partial live collection filler missing'
primary_pos = manager.index('const primary = dedupeTracks(primaryTracks || []);')
search_pos = manager.index('const liveFallback = await this.searchTracks(collection.query, { limit, offset });')
merge_pos = manager.index('dedupeTracks([...primary, ...liveFallback]).slice(0, limit)')
assert 0 <= primary_pos < search_pos < merge_pos, 'source-specific items must remain first before live fallback filling'
assert 'if (primary.length >= limit) return primary.slice(0, limit);' in manager, 'already-full provider collection pages should not make unnecessary fallback searches'
assert manager.count('return this.fillCollectionPage(tracks, collection, { limit, offset });') >= 2, 'Audius and Jamendo collections must both use partial-page filling'
assert 'fallbackTracks' not in manager, 'catalog manager must not insert Demo tracks into live collections'
assert 'state.discoverHasMore = tracks.length >= 16' in app, 'Discover pagination threshold changed unexpectedly'
assert "els.discoverMore.textContent = 'Load more tracks'" in app, 'Load more tracks control must remain available'

# Keep the existing v10.1.6 visible-artwork and poster-stability safeguards.
assert "const VERSION = '10.1.6'" in hotfix, 'v10.1.6 artwork stability layer must remain active'
assert 'prioritizeVisibleArtwork' in hotfix, 'visible artwork priority must remain active'
assert 'scanVisibleFallbacks' in hotfix, 'canonical artwork safety net must remain active'
assert 'installTrendingGridGuard' in hotfix, 'play/pause poster DOM guard must remain active'
assert "setInterval(syncVideoPopup, 350)" not in hotfix, 'continuous polling performance regression returned'

# If every legitimate artwork source truly fails, the fallback must be a quiet
# initial tile — never the synthetic record/wave Auralis poster treatment.
assert '.v1011-branded-art.v1012-cover::before' in hotfix_css
assert '.v1011-branded-art.v1012-cover::after' in hotfix_css
assert '.v1012-wave' in hotfix_css and 'display:none!important' in hotfix_css, 'synthetic waveform fallback must stay hidden'
assert 'place-items:center!important' in hotfix_css, 'neutral fallback initial must stay centered'

# No unrelated product paths or user storage are changed by this fix.
assert "import { catalogManager, dedupeTracks } from './providers/catalog-manager.js';" in app
assert 'loadTrending' in app and 'loadRadio' in app and 'togglePlayback' in app
assert 'localStorage.clear(' not in audius
assert 'sessionStorage.clear(' not in audius
assert 'indexedDB.deleteDatabase(' not in audius

print('Auralis v10.2 global artwork delivery regression tests passed')
