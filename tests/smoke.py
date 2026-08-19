from pathlib import Path
import re, wave, json
root=Path(__file__).resolve().parents[1]
required=['index.html','styles.css','js/app.js','js/store.js','js/fallback.js','js/providers/audius.js','manifest.webmanifest','sw.js','vercel.json']
for f in required:
    p=root/f
    assert p.exists() and p.stat().st_size>0, f'missing {f}'
html=(root/'index.html').read_text()
# Local static references in HTML
for ref in re.findall(r'(?:src|href)="(\./[^"?#]+)',html):
    if ref.startswith('./') and not ref.endswith('/'):
        assert (root/ref[2:]).exists(), f'broken local reference: {ref}'
# IDs used by the app should exist in HTML
app=(root/'js/app.js').read_text()
for ident in set(re.findall(r"\$\('#([^']+)'\)",app)):
    assert f'id="{ident}"' in html, f'JS references missing id #{ident}'
# Demo fallback audio is synthesized in-browser, so the deployment stays text-only.
assert "makeDemoAudio" in app
manifest=json.loads((root/'manifest.webmanifest').read_text())
assert manifest['name']=='Auralis Music'
vercel=json.loads((root/'vercel.json').read_text())
assert 'headers' in vercel
print('Auralis smoke tests passed')
