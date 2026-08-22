from pathlib import Path

root = Path(__file__).resolve().parents[1]
js = (root / 'js' / 'product-hotfix-v10-1-2.js').read_text()
css = (root / 'experience-v10-1-hotfix.css').read_text()
boot = (root / 'js' / 'konkani-radio-v7.js').read_text()
full = (root / 'js' / 'full-playback-v9-1.js').read_text()

assert "import('./product-hotfix-v10-1-2.js')" in boot, 'final v10.1 video/artwork refinement must boot'
assert boot.index("import('./product-polish-v10-1.js')") < boot.index("import('./product-hotfix-v10-1-2.js')"), 'hotfix must run after product polish'
assert "const VERSION = '10.1.5'" in js, 'performance/artwork hotfix version missing'

# Full playback must not enlarge the Auralis bottom player.
assert 'moveShellToInline' not in js, 'YouTube video must no longer be reparented into the bottom player'
assert '--player-h:220px' not in css and '--player-h:272px' not in css, 'full playback must never enlarge the player bar'
assert 'restoreVideoShellToDock' in js, 'video shell must remain in its floating dock'
assert '.v1012-inline-video-slot { display:none!important; }' in css, 'stale inline-video slot must remain non-visual'

# Floating video is shown by default for a new full track, but × hides only the visual.
assert 'lastTrackKey' in js and 'setVideoExpanded?.(true, false)' in js, 'new full songs must show the floating video by default'
assert "target.closest('#closeFullPlaybackV91')" in js, 'video × must be intercepted'
assert 'event.stopImmediatePropagation()' in js and 'hideVideo()' in js, '× must not reach the legacy stop handler'
assert 'v1013-video-hidden' in js and 'visibility:hidden!important' in css, 'hide-only video visibility state missing'
assert "target.closest('#videoModeToggleV101')" in js and 'showVideo()' in js, 'Video control must restore/toggle the hidden window'
assert 'YT.Player' in full, 'official YouTube iframe player must remain unchanged'

# Play/pause must not rebuild the Trending grid and force every poster to reload.
assert 'installTrendingGridGuard' in js, 'Trending artwork stability guard missing'
assert "Object.getOwnPropertyDescriptor(Element.prototype, 'innerHTML')" in js, 'guard must preserve the existing Trending DOM during state-only renders'
assert 'markTrendingPreserveWindow' in js and "event.target?.id === 'audio'" in js, 'audio play/pause must mark the preservation window'
assert 'syncTrendingState' in js and 'cardSignature' in js, 'guard must update active/play state without replacing card artwork nodes'

# Poster recovery should prefer real Audius artwork, then canonical catalog art, before branded fallback remains.
assert 'queryAudiusArtwork' in js and 'audiusCandidates' in js, 'Audius artwork retry path missing'
assert "art['480x480']" in js and "art['1000x1000']" in js and "art['150x150']" in js, 'Audius size fallbacks missing'
assert 'queryArtwork' in js and 'candidateScore' in js, 'canonical poster recovery missing'
assert 'artist:\\"' in js and 'track:\\"' in js, 'exact artist/track lookup missing'
assert 'v1012-cover' in js and 'v1012-wave' in js and '--v1012-hue' in css, 'refined unique Auralis cover missing'
assert 'font-size:9px' in css, 'fallback monogram must stay subtle rather than giant'

# Keep the release non-destructive and make observer work event-driven/idle.
assert 'scanQueued' in js and 'requestIdleCallback' in js, 'artwork recovery must be coalesced into idle work'
assert "setInterval(syncVideoPopup, 350)" not in js, 'permanent 350ms video polling must stay removed'
assert 'addedNodeNeedsArtworkScan' in js, 'body observer must filter irrelevant mutations'
assert 'videoObserver.observe(dock' in js, 'video state must use the focused playback dock observer'
assert 'localStorage.clear(' not in js and 'indexedDB.deleteDatabase(' not in js, 'hotfix must not wipe user data'
assert "import('./update-manager-v10.js')" in boot, 'Stability v10 must remain active'

print('Auralis v10.1.5 artwork-stability/performance tests passed')
