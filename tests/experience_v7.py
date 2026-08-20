from pathlib import Path

root = Path(__file__).resolve().parents[1]
engine = (root / 'js/auralis-experience-v7.js').read_text()
provider = (root / 'js/providers/radio-browser.js').read_text()
css = (root / 'experience-v7.css').read_text()
aura_css = (root / 'experience-v7-aura.css').read_text()
sw = (root / 'sw.js').read_text()

assert 'Aura Mode' in engine and 'auraTopToggle' in engine and 'auraPlayerToggle' in engine, 'Aura controls missing'
assert 'timeoutMinutes: 10' in engine and 'profileAuraTimer' in engine, 'Aura auto-off settings missing'
assert 'derivePaletteFromImage' in engine and 'hashPalette' in engine, 'Artwork theme + fallback palette missing'
assert 'auralis-player-loading' in engine and 'playerLoadingBadge' in engine, 'Player loading state missing'
assert 'radioTuningV7' in engine and 'TUNING AURALIS' in engine, 'Radio tuning animation missing'
assert 'AmchiKONKANI' in engine and 'v7-konkani-pick' in engine, 'Single verified Konkani pick missing'
assert "import '../auralis-experience-v7.js'" in provider and 'experience-v7.css' in provider and 'experience-v7-aura.css' in provider, 'Experience v7 not wired into app'
assert '#radioTuningV7 { order:-2; }' in css, 'Tuning block must sit above pinned Popular'
assert '.player.auralis-player-loading::before' in css and '.aura-toggle.active' in css, 'Loading/Aura styling incomplete'
assert 'html.aura-mode-on .sidebar' in aura_css and 'html.aura-mode-on .player' in aura_css and '.nav-item.active' in aura_css, 'Aura Mode does not reach core surfaces'
assert 'auralis-shell-v11' in sw and 'auralis-experience-v7.js' in sw and 'experience-v7.css' in sw and 'experience-v7-aura.css' in sw, 'PWA v11 shell incomplete'

print('Auralis Experience v7 regression tests passed')
