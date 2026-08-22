from pathlib import Path

root = Path(__file__).resolve().parents[1]
client = (root / 'js/full-playback-v9-1.js').read_text()
css = (root / 'experience-v9-1.css').read_text()
youtube = (root / 'api/youtube.js').read_text()
konkani = (root / 'js/konkani-radio-v7.js').read_text()
sw = (root / 'sw.js').read_text()
workflow = (root / '.github/workflows/smoke.yml').read_text()

assert 'Auralis Full Playback v9.1' in youtube, 'server resolver version missing'
assert 'YOUTUBE_API_KEY' in youtube, 'YouTube key must stay server-side'
assert "videoEmbeddable', 'true'" in youtube and "videoSyndicated', 'true'" in youtube, 'resolver must request embeddable/syndicated videos'
assert "snippet,status,contentDetails" in youtube, 'resolver must verify video status and duration'
assert 'qualityScore' in youtube and 'bestMatch' in youtube, 'exact-song ranking/resolver missing'
assert '.map(value => safeText(value))' in youtube and '.map(safeText)' not in youtube, 'resolver query terms must not be truncated by Array.map index arguments'
assert '[title || q, artist || album]' in youtube, 'resolver should prefer title + artist and only use album when artist is missing'
assert 'karaoke' in youtube and 'cover' in youtube and 'nightcore' in youtube, 'bad-match penalties missing'
assert 'youtube-dl' not in youtube.lower() and 'yt-dlp' not in youtube.lower(), 'download/extraction integrations are forbidden'

assert "new URL('/api/youtube'" in client, 'full playback client is not wired to resolver'
assert 'https://www.youtube.com/iframe_api' in client and 'new YT.Player' in client, 'official YouTube IFrame player missing'
assert 'playFullTrack' in client and 'nextFullTrack' in client and 'stopFullPlayback' in client, 'full playback lifecycle incomplete'
assert 'auralis:youtube-resolver:v1' in client and 'CACHE_TTL' in client, 'client-side match cache missing'
assert 'data-v91-full' in client and 'data-v91-row-full' in client, 'track/album/playlist full-play actions missing'
assert '#playButton' in client and '#nextButton' in client and '#prevButton' in client and '#progressBar' in client and '#volumeBar' in client, 'Auralis player control bridge incomplete'
assert 'youtube-dl' not in client.lower() and 'yt-dlp' not in client.lower(), 'client must use official embed only'

assert '.v91-playback-dock' in css and 'min-height:200px' in css, 'visible YouTube playback dock must remain at least 200px tall'
assert '@media(max-width:720px)' in css, 'mobile full-playback layout missing'
assert 'prefers-reduced-motion' in css, 'reduced motion support missing'
assert "import('./full-playback-v9-1.js')" in konkani, 'v9.1 progressive boot missing'
assert 'auralis-shell-v15' in sw and './experience-v9-1.css' in sw and './js/full-playback-v9-1.js' in sw, 'v9.1 assets missing from PWA v15 shell'
assert 'node --check js/full-playback-v9-1.js' in workflow and 'python tests/full_playback_v91.py' in workflow, 'CI does not validate Full Playback v9.1'

print('Auralis Full Playback v9.1 regression tests passed')