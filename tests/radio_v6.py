from pathlib import Path

root = Path(__file__).resolve().parents[1]
api = (root / 'api/radio.js').read_text()
provider = (root / 'js/providers/radio-browser.js').read_text()
engine = (root / 'js/radio-reliability-v6.js').read_text()
css = (root / 'experience-v6.css').read_text()
sw = (root / 'sw.js').read_text()
workflow = (root / '.github/workflows/smoke.yml').read_text()

assert 'probeStream' in api and 'PROBE_TIMEOUT_MS' in api, 'radio streams must be runtime-probed'
assert 'canonicalStationName' in api and 'chooseHealthyVariant' in api, 'duplicate station variants must collapse'
assert 'auralis_verified' in api and 'auralis_stream_type' in api, 'verified stream metadata missing'
assert 'isSafePublicHttps' in api, 'radio probe must reject unsafe/non-HTTPS targets'
assert "AuralisMusic/6.0" in api, 'radio API identification not bumped'
assert "import '../radio-reliability-v6.js'" in provider, 'radio reliability engine not wired'
assert 'verified-streams' in provider and "'hls'" in provider, 'provider capabilities incomplete'
assert 'cdn.jsdelivr.net/npm/hls.js@1' in engine, 'HLS playback support missing'
assert 'radioActiveBlockV6' in engine and 'radioPopularGridV6' in engine, 'pinned popular + active result split missing'
assert 'tuneThroughAuralis' in engine, 'pinned cards must route through the Auralis player'
assert '#radioActiveBlockV6 { order:-1; }' in css, 'selected/search results must sit above Popular'
assert '#radioPopularBlockV5 { order:0; }' in css, 'Popular must remain pinned at the top level'
assert 'auralis-shell-v10' in sw and 'experience-v6.css' in sw and 'radio-reliability-v6.js' in sw, 'PWA v10 shell incomplete'
assert 'node --check js/radio-reliability-v6.js' in workflow and 'python tests/radio_v6.py' in workflow, 'CI does not validate radio v6'

print('Auralis Radio Reliability v6 regression tests passed')
