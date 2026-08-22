from pathlib import Path

root = Path(__file__).resolve().parents[1]
engine = (root / 'js/auralis-experience-v7.js').read_text()
konkani_guard = (root / 'js/konkani-radio-v7.js').read_text()
provider = (root / 'js/providers/radio-browser.js').read_text()
css = (root / 'experience-v7.css').read_text()
aura_css = (root / 'experience-v7-aura.css').read_text()
aura_v8 = (root / 'experience-v8-aura.css').read_text()
sw = (root / 'sw.js').read_text()

assert 'Aura Mode' in engine and 'auraTopToggle' in engine and 'auraPlayerToggle' in engine, 'Aura controls missing'
assert 'timeoutMinutes: 10' in engine and 'profileAuraTimer' in engine, 'Aura auto-off settings missing'
assert 'derivePaletteFromImage' in engine and 'hashPalette' in engine, 'Artwork theme + fallback palette missing'
assert 'auralis-player-loading' in engine and 'playerLoadingBadge' in engine, 'Player loading state missing'
assert 'radioTuningV7' in engine and 'TUNING AURALIS' in engine, 'Radio tuning animation missing'
assert 'AmchiKONKANI' in engine and 'v7-konkani-pick' in engine, 'Single verified Konkani pick missing'
assert 'AmchiKONKANI' in konkani_guard and 'auralis_verified' in konkani_guard and 'v7-konkani-pick' in konkani_guard, 'Stable verified Konkani guard missing'
assert "import '../auralis-experience-v7.js'" in provider and "import '../konkani-radio-v7.js'" in provider, 'Experience v7 scripts not wired into app'
assert 'experience-v7.css' in provider and 'experience-v7-aura.css' in provider and 'experience-v8-aura.css' in provider, 'Aura styles not wired into app'
assert '#radioTuningV7 { order:-2; }' in css, 'Tuning block must sit above pinned Popular'
assert '.player.auralis-player-loading::before' in css and '.aura-toggle.active' in css, 'Loading/Aura styling incomplete'
assert 'html.aura-mode-on .sidebar' in aura_css and 'html.aura-mode-on .player' in aura_css and '.nav-item.active' in aura_css, 'Aura Mode does not reach core surfaces'
assert '@property --aura-primary' in aura_v8 and 'auraLiquidA' in aura_v8 and 'auraLiquidB' in aura_v8, 'Liquid Aura field missing'
assert 'html.aura-mode-on .hero' in aura_v8 and 'html.aura-mode-on .music-card' in aura_v8 and '--accent: var(--aura-primary)' in aura_v8, 'Aura v8 is not a full-site theme'
assert 'auralis-shell-v15' in sw and 'auralis-experience-v7.js' in sw and 'konkani-radio-v7.js' in sw and 'experience-v8-aura.css' in sw, 'PWA v15 shell must retain Experience v7/v8 assets'

print('Auralis Experience v7/v8 regression tests passed')