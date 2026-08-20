from pathlib import Path
import re, json

root=Path(__file__).resolve().parents[1]
required=[
    'index.html','styles.css','fixes.css','experience.css',
    'js/app-v2.js','js/store.js','js/fallback.js','js/collections.js',
    'js/providers/audius.js','js/providers/jamendo.js',
    'manifest.webmanifest','sw.js','vercel.json','AGENTS.md','SUPABASE_HUB_RULES.md'
]
for f in required:
    p=root/f
    assert p.exists() and p.stat().st_size>0, f'missing {f}'

html=(root/'index.html').read_text()
for ref in re.findall(r'(?:src|href)="(\./[^"?#]+)',html):
    if ref.startswith('./') and not ref.endswith('/'):
        assert (root/ref[2:]).exists(), f'broken local reference: {ref}'

app=(root/'js/app-v2.js').read_text()
for ident in set(re.findall(r"\$\('#([^']+)'\)",app)):
    assert f'id="{ident}"' in html, f'JS references missing id #{ident}'

collections=(root/'js/collections.js').read_text()
assert collections.count("id:'") >= 16, 'expected at least 16 curated collections'
assert 'multiSearch' in app, 'multi-provider search missing'
assert 'jamendoProvider' in app, 'Jamendo integration missing'
assert 'audiusProvider' in app, 'Audius integration missing'
assert 'makeDemoAudio' in app, 'offline/demo playback fallback missing'
assert 'AGENTS.md' in (root/'SUPABASE_HUB_RULES.md').read_text(), 'Project Hub repo safety contract incomplete'

manifest=json.loads((root/'manifest.webmanifest').read_text())
assert manifest['name']=='Auralis Music'
vercel=json.loads((root/'vercel.json').read_text())
assert 'headers' in vercel

print('Auralis catalog v2 smoke tests passed')
