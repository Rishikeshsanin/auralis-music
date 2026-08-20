from pathlib import Path
import re, json

root = Path(__file__).resolve().parents[1]
required = [
    'index.html','styles.css','fixes.css','experience.css','experience-v3.css',
    'js/app-v3.js','js/app-v2.js','js/store.js','js/fallback.js','js/collections.js','js/library-map.js',
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

assert collections.count("id:'") >= 36, 'expected at least 36 curated collections'
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
assert 'User-Agent' in radio_api and 'AuralisMusic/3.0' in radio_api, 'radio proxy identification missing'
assert 'handlePlaybackFailure' in app and 'failedTracks' in app, 'automatic playback failover missing'
assert 'crossorigin="anonymous"' not in html, 'audio element must not force CORS mode for provider streams'
assert 'AGENTS.md' in (root / 'SUPABASE_HUB_RULES.md').read_text(), 'Project Hub repo safety contract incomplete'

manifest = json.loads((root / 'manifest.webmanifest').read_text())
assert manifest['name'] == 'Auralis Music'
vercel = json.loads((root / 'vercel.json').read_text())
assert 'headers' in vercel

print('Auralis catalog universe v3 smoke tests passed')
