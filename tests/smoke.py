from pathlib import Path
import re, json

root = Path(__file__).resolve().parents[1]
required = [
    'index.html','styles.css','fixes.css','experience.css','experience-v3.css','experience-v4.css','experience-v5.css','experience-v6.css',
    'js/app-v3.js','js/row-play-targets.js','js/radio-reliability-v6.js','js/app-v2.js','js/store.js','js/fallback.js','js/collections.js','js/library-map.js',
    'js/providers/audius.js','js/providers/jamendo.js','js/providers/radio-browser.js',
    'js/providers/catalog-manager.js','api/radio.js',
    'manifest.webmanifest','sw.js','vercel.json','AGENTS.md','SUPABASE_HUB_RULES.md'
]
for f in required:
    p = root / f
    assert p.exists() and p.stat().st_size > 0, f'missing {f}'

html = (root / 'index.html').read_text()
for ref in re.findall(r'(?:src|href)="(\./[^"?#]+)', html):
    if ref.startswith('./') and not ref.endswith('/'):
        assert (root / ref[2:]).exists(), f'broken local reference: {ref}'

app = (root / 'js/app-v3.js').read_text()
for ident in set(re.findall(r"\$\('#([^']+)'\)", app)):
    assert f'id="{ident}"' in html, f'JS references missing id #{ident}'

collections = (root / 'js/collections.js').read_text()
library_map = (root / 'js/library-map.js').read_text()
audius = (root / 'js/providers/audius.js').read_text()
jamendo = (root / 'js/providers/jamendo.js').read_text()
radio = (root / 'js/providers/radio-browser.js').read_text()
manager = (root / 'js/providers/catalog-manager.js').read_text()
radio_api = (root / 'api/radio.js').read_text()
enhancements = (root / 'js/row-play-targets.js').read_text()
radio_v6 = (root / 'js/radio-reliability-v6.js').read_text()
v5_css = (root / 'experience-v5.css').read_text()
v6_css = (root / 'experience-v6.css').read_text()
sw = (root / 'sw.js').read_text()

assert collections.count("id:'") >= 44, 'expected at least 44 curated collections'
assert "id:'timeless-rock'" in collections and "id:'bollywood-essentials'" in collections, 'essentials collections missing'
assert "id:'essentials'" in collections, 'essentials collection filter missing'
assert library_map.count("label:'") >= 40, 'expected broad genre + mood taxonomy'
assert 'catalogManager' in app, 'provider manager integration missing'
assert 'loadMoreDiscover' in app, 'discover pagination missing'
assert 'searchMoreButton' in html, 'search load-more UI missing'
assert 'discoverMoreButton' in html, 'discover load-more UI missing'
assert 'radioMoreButton' in html, 'radio pagination UI missing'
assert 'genresView' in html and 'moodsView' in html and 'radioView' in html, 'browse hubs missing'
assert 'radioBrowserProvider' in manager, 'Radio Browser provider not registered'
assert 'audiusProvider' in manager and 'jamendoProvider' in manager, 'song providers missing'
assert 'pagination' in audius and 'pagination' in jamendo, 'provider pagination capability missing'
assert 'isLive' in radio, 'live-radio normalization missing'
assert 'AuralisMusic/6.0' in radio_api, 'radio proxy v6 identification missing'
assert "'country'" in radio_api and "'language'" in radio_api, 'country/language radio modes missing'
assert 'countrycodeExact' in radio_api and 'languageExact' in radio_api, 'radio regional filtering missing'
assert 'MUSIC_POSITIVE' in radio_api and 'MUSIC_NEGATIVE' in radio_api, 'music-first radio filters missing'
assert 'fetchPopularMusic' in radio_api and 'isEnglishStation' in radio_api and 'isHindiStation' in radio_api, 'popular music ranking missing'
assert 'probeStream' in radio_api and 'canonicalStationName' in radio_api, 'radio stream verification/dedupe missing'
assert 'handlePlaybackFailure' in app and 'failedTracks' in app, 'automatic playback failover missing'
assert 'crossorigin="anonymous"' not in html, 'audio element must not force CORS mode for provider streams'
assert 'AGENTS.md' in (root / 'SUPABASE_HUB_RULES.md').read_text(), 'Project Hub repo safety contract incomplete'
assert 'auralis:guest-profile:v1' in enhancements, 'local guest profile missing'
assert "label: 'English'" in enhancements and "label: 'Hindi'" in enhancements, 'language-first radio ordering missing'
assert "label: 'Konkani'" in enhancements and 'FM Rainbow Goa' in enhancements, 'Konkani radio lane missing'
assert 'radioPopularBlockV5' in enhancements and 'radioLanguagesV5' in enhancements, 'radio v5 structure missing'
assert 'auralis-loading-grid' in enhancements and 'LOADING_WORDS' in enhancements, 'loading-state enhancer missing'
assert 'experience-v5.css' in enhancements, 'v5 stylesheet loader missing'
assert '@keyframes auralisShimmer' in v5_css and 'radio-language-sections-v5' in v5_css, 'v5 radio styling incomplete'
assert '#radioPopularBlockV5 { order: 0; }' in v5_css, 'popular radio baseline ordering missing'
assert 'radioActiveBlockV6' in radio_v6 and 'radioPopularGridV6' in radio_v6, 'v6 persistent radio shelves missing'
assert 'cdn.jsdelivr.net/npm/hls.js@1' in radio_v6, 'HLS engine missing'
assert '#radioActiveBlockV6 { order:-1; }' in v6_css and '#radioPopularBlockV5 { order:0; }' in v6_css, 'v6 selected/popular ordering incorrect'
assert "auralis-shell-v10" in sw and 'experience-v6.css' in sw and 'radio-reliability-v6.js' in sw, 'PWA v10 radio shell missing'

manifest = json.loads((root / 'manifest.webmanifest').read_text())
assert manifest['name'] == 'Auralis Music'
vercel = json.loads((root / 'vercel.json').read_text())
assert 'headers' in vercel

print('Auralis Radio Reliability v6 smoke tests passed')