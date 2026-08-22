from pathlib import Path

root = Path(__file__).resolve().parents[1]
js = (root / 'js' / 'product-hotfix-v10-1-2.js').read_text()

assert "const VERSION = '10.1.5'" in js, 'performance hotfix version missing'
assert "setInterval(syncVideoPopup, 350)" not in js, '350ms permanent video polling must be removed'
assert "addedNodeNeedsArtworkScan" in js, 'artwork observer must filter relevant added nodes'
assert "if (needsArtworkScan) scheduleScan()" in js, 'body mutations must only schedule artwork work when relevant'
assert "requestIdleCallback" in js, 'artwork scans should prefer idle time'
assert "videoObserver.observe(dock" in js, 'video state should use a focused dock observer instead of global polling'
assert "installTrendingGridGuard" in js, 'non-refreshing poster guard must remain'
assert "queryAudiusArtwork" in js and "queryArtwork" in js, 'real artwork recovery must remain'
assert "localStorage.clear(" not in js and "indexedDB.deleteDatabase(" not in js, 'performance patch must not touch user data'

print('Auralis v10.1.5 performance regression tests passed')
