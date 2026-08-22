from pathlib import Path

root = Path(__file__).resolve().parents[1]
js = (root / 'js' / 'product-hotfix-v10-1-2.js').read_text()
css = (root / 'experience-v10-1-hotfix.css').read_text()
boot = (root / 'js' / 'konkani-radio-v7.js').read_text()
full = (root / 'js' / 'full-playback-v9-1.js').read_text()

assert "import('./product-hotfix-v10-1-2.js')" in boot, 'v10.1.2 refinement must boot'
assert boot.index("import('./product-polish-v10-1.js')") < boot.index("import('./product-hotfix-v10-1-2.js')"), 'hotfix must run after product polish'

# Minimized playback is integrated into the Auralis player, not left as a floating dock.
assert 'inlineVideoSlotV1012' in js and 'moveShellToInline' in js and 'moveShellToDock' in js, 'inline video reparenting missing'
assert 'v1012-inline-video-active' in js and 'v1012-inline-video-slot' in css, 'inline video state missing'
assert 'visibility:hidden!important' in css and 'v91-playback-dock' in css, 'legacy minimized floating dock must be non-visual'
assert "target.closest('#videoModeToggleV101')" in js and 'setVideoExpanded(!expanded, false)' in js, 'Video control must explicitly open floating mode without toast spam'
assert 'setVideoExpanded(false, false)' in js, 'minimize must return to integrated mode quietly'
assert 'YT.Player' in full, 'official YouTube iframe player must remain unchanged'

# Poster fallback should try another exact canonical lookup before branded art remains.
assert 'queryArtwork' in js and 'candidateScore' in js, 'second-pass poster recovery missing'
assert 'artist:\\"' in js and 'track:\\"' in js, 'exact artist/track lookup missing'
assert 'v1012-cover' in js and 'v1012-wave' in js and '--v1012-hue' in css, 'refined unique Auralis cover missing'
assert 'font-size:9px' in css, 'fallback monogram must stay subtle rather than giant'

# Keep the release non-destructive and observer work coalesced.
assert 'scanQueued' in js and 'requestAnimationFrame(runScan)' in js, 'hotfix scan must be coalesced'
assert 'localStorage.clear(' not in js and 'indexedDB.deleteDatabase(' not in js, 'hotfix must not wipe user data'
assert "import('./update-manager-v10.js')" in boot, 'Stability v10 must remain active'

print('Auralis v10.1.2 video/artwork refinement tests passed')
