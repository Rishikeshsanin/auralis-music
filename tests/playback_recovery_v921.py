from pathlib import Path

root = Path(__file__).resolve().parents[1]
recovery = (root / 'js/playback-recovery-v9-2-1.js').read_text()
ux = (root / 'js/ux-reliability-v9-2.js').read_text()
konkani = (root / 'js/konkani-radio-v7.js').read_text()
sw = (root / 'sw.js').read_text()

assert "const VERSION = '9.2.1'" in recovery, 'playback recovery version missing'
assert 'recoverSameSong' in recovery and 'fetchCandidates' in recovery, 'same-song YouTube fallback missing'
assert "url.searchParams.set('retry'" in recovery and "cache: 'no-store'" in recovery, 'recovery must bypass stale resolver cache'
assert 'loadVideoById' in recovery, 'alternate verified candidate is not loaded into the existing player'
assert 'guardAutoplay' in recovery and 'Playback is ready — tap here to start.' in recovery, 'autoplay recovery missing'
assert 'onError' in recovery and 'event?.data' in recovery, 'YouTube player error diagnostics missing'
assert 'new MutationObserver' not in recovery, 'playback recovery must not keep a redundant whole-document observer'
assert 'escapeHtml' in recovery, 'provider/title text must be escaped before toast rendering'
assert "classList.toggle('minimized-v92'" not in ux and 'PANEL_KEY' not in ux, 'v9.2 must not actively minimize the playback viewport during recovery hotfix'
assert 'restorePlaybackDockContract' in ux, 'known-good v9.1 playback dock contract not restored'
assert "import('./playback-recovery-v9-2-1.js')" in konkani, 'v9.2.1 recovery layer not booted'
assert "const WORKER_VERSION = '18'" in sw and "destination === 'script'" in sw, 'v18 must network-first version-sensitive playback assets'

print('Auralis Playback Recovery v9.2.1 regression tests passed')
