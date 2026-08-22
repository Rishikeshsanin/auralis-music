from pathlib import Path

root = Path(__file__).resolve().parents[1]
ux = (root / 'js/ux-reliability-v9-2.js').read_text()
css = (root / 'experience-v9-2.css').read_text()
konkani = (root / 'js/konkani-radio-v7.js').read_text()
sw = (root / 'sw.js').read_text()

assert "#radioView.view:not(.active-view){display:none!important}" in css, 'inactive Radio view must never leak above search/discover pages'
assert "#radioView.view.active-view{display:flex!important" in css, 'Radio must remain flex-ordered when active'
assert 'ART_HOST_SELECTOR' in ux and 'repairImage' in ux and 'auralis-art-fallback-v92' in ux, 'global artwork failure recovery missing'
assert "window.addEventListener('error'" in ux and 'HTMLImageElement' in ux, 'runtime image failures are not captured'
assert 'scanBrokenArtwork' in ux and 'naturalWidth' in ux, 'already-failed cached images are not repaired'
assert 'auralis:full-playback-panel:v92' in ux and "return 'compact'" in ux, 'full playback should default to compact mode'
assert 'stopFullPlaybackV92' in ux and 'window.AuralisFullPlaybackV91?.stop?.()' in ux, 'compact playback needs a separate explicit stop control'
assert 'minimized-v92' in css and 'min-width:200px!important' in css and 'min-height:200px!important' in css, 'YouTube mini-player viewport must remain visibly at least 200x200'
assert "import('./ux-reliability-v9-2.js')" in konkani, 'v9.2 UX layer is not in the progressive boot chain'
assert 'auralis-shell-v15' in sw and './experience-v9-2.css' in sw and './js/ux-reliability-v9-2.js' in sw, 'PWA v15 must cache v9.2 assets'

print('Auralis UX Reliability v9.2 regression tests passed')