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
assert 'restorePlaybackDockContract' in ux, 'v9.2.1 must restore the known-good v9.1 playback dock contract'
assert "classList.toggle('minimized-v92'" not in ux and 'PANEL_KEY' not in ux and "event.target.closest?.('#closeFullPlaybackV91')" not in ux, 'v9.2.1 must not intercept or minimize the YouTube playback dock'
assert "import('./ux-reliability-v9-2.js')" in konkani, 'v9.2 UX layer is not in the progressive boot chain'
assert 'auralis-shell-v15' in sw and './experience-v9-2.css' in sw and './js/ux-reliability-v9-2.js' in sw, 'PWA shell must retain v9.2 assets'

print('Auralis UX Reliability v9.2/v9.2.1 regression tests passed')