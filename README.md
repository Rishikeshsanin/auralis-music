# Auralis 🎧

> A polished multi-provider music platform for discovery, full-song playback, live radio, playlists, likes, queueing, artists/albums, provider health, and an artwork-driven Aura Mode — all behind one Auralis UI.

[![Smoke Test](https://github.com/Rishikeshsanin/auralis-music/actions/workflows/smoke.yml/badge.svg)](https://github.com/Rishikeshsanin/auralis-music/actions/workflows/smoke.yml)
[![Live on Vercel](https://img.shields.io/badge/Live-Vercel-000000?logo=vercel)](https://auralis-music-lime.vercel.app)
[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](LICENSE)

**Production:** https://auralis-music-lime.vercel.app  
**Current release:** **Auralis v10.1 — Player + Universe**  
**Release notes:** [docs/RELEASE_V10_1.md](docs/RELEASE_V10_1.md)

## What Auralis is

Auralis is not a static Spotify clone. It combines several legitimate music sources while keeping discovery, canonical metadata, playback, live radio, provider health, user library features, and visual theming as separate layers.

The current provider network uses:

| Provider | Role | Playback semantics |
| --- | --- | --- |
| YouTube Data API + IFrame Player | Full-song resolver | Full playback through visible official embeds |
| Audius | Open catalog | Full stream where streamable |
| Jamendo | Independent catalog | Full stream where exposed |
| Deezer | Mainstream discovery | Clearly labelled 30-second preview |
| MusicBrainz | Canonical identity | Metadata only |
| Cover Art Archive | Artwork fallback | Artwork only |
| Radio Browser | Worldwide radio | Verified live streams |
| hls.js | Stream compatibility | HLS fallback where required |

Auralis never presents a preview as a full song and does not use downloader/extraction APIs.

## v10.1 highlights

### Full Song + Video mode

Auralis resolves eligible tracks through the server-side YouTube resolver and plays them with the official YouTube IFrame Player.

Final v10.1 behavior:

- **Full song** opens the floating video player by default.
- The normal bottom player stays compact.
- The **Video** control sits beside Repeat so the feature is discoverable.
- `×` hides only the video window while the song keeps playing.
- Pressing **Video** restores the same active video player.
- Starting a different Full song shows its video again by default.
- On desktop the floating player can be moved and resized.
- Play/pause, seek, volume, next/previous, queue, artwork, and Aura remain bridged to Auralis.

Auralis deliberately does **not** use `yt-dlp`, `youtube-dl`, MP3 extraction, downloader APIs, or hidden YouTube audio extraction.

### Unified queue

One Auralis queue now accepts music discovered through the broader product surface instead of splitting queue behavior by provider.

Queue entry points cover:

- normal/open-stream tracks
- Music Graph/API results
- YouTube-resolved full songs
- album rows
- playlist rows
- radio where applicable

### Likes across API / Music Graph songs

Music Graph/API tracks can now be liked from their user-facing controls and appear in **Liked songs** alongside existing local-library items.

Existing collection likes remain intact.

### Better search flow

- **Full song** has stronger visual weight where available.
- Preview remains clearly labelled as a 30-second preview.
- Preview duration text no longer covers artwork.
- Compact global search exposes **View more results** into Universe.
- Universe keeps its deeper result pagination for alternate versions and broader discovery.

### Artist playlist / mix

Artist detail pages now expose a playable Auralis artist mix from available top-track data with:

- **Play mix**
- **Queue mix**

### Playlist UX fix

Playlist creation has a cleaner Auralis-styled interface and fixes the browser validation bug where Cancel/close could be blocked by the empty required Name field.

**Cancel**, `×`, and `Esc` now always exit the dialog; required-field validation runs only when Create is submitted.

### Artwork reliability

Artwork recovery follows this order:

1. original provider artwork
2. provider alternate/mirror artwork where available
3. strict canonical Music Graph/catalog lookup using title + artist
4. an Aura-aware Auralis branded fallback only when no legitimate poster can be recovered

The fallback is intentionally album-art-like and track-specific rather than a plain giant initial block.

## Stability v10 foundation

v10.1 is layered on top of the Stability v10 release rather than replacing it.

The stability layer includes:

- Service Worker v18
- returning-user upgrade migration
- network-first version-sensitive runtime assets
- safe service-worker activation during playback
- no localStorage / IndexedDB user-data wipe
- observer-loop hardening
- Source Pulse startup-flash fix
- playback-recovery protections

Local playlists, likes, history, profile preferences, Aura preferences, and resolver cache remain preserved across updates.

## Music Graph

The Auralis Music Graph normalizes discovery and metadata into one catalog experience.

```text
                              AURALIS
                                 │
                         Auralis Music Graph
                                 │
              ┌──────────────────┼──────────────────┐
              │                  │                  │
           Identity           Discovery           Playback
              │                  │                  │
        MusicBrainz          Deezer            YouTube
        ISRC / MBID          charts            Audius
        releases             albums            Jamendo
              │              artists          Radio Browser
        Cover Art                │                  │
              └──────────────────┴──────────────────┘
                                 │
                         one Auralis UI
```

Search can surface:

- tracks
- albums
- artists
- release metadata
- artwork
- MusicBrainz IDs / ISRCs when available
- preview availability
- full-playback availability
- source links

## Full Playback Resolver

```text
Auralis track
    ↓
Music Graph metadata
    ↓
/api/youtube
    ↓
YouTube Data API
    ↓
embeddable public candidates
    ↓
match + quality ranking
    ↓
best reliable source
    ↓
Official YouTube IFrame Player
```

The resolver:

- prioritizes title + artist
- uses album context as fallback
- requests embeddable/syndicated candidates
- checks video status and duration
- favors exact title/artist matches and official/Topic/label-style sources
- penalizes covers, karaoke, nightcore, reactions, tutorials, and wrong variants
- returns a best match plus fallbacks
- keeps `YOUTUBE_API_KEY` server-side
- uses bounded caching to reduce repeated search quota usage

Resolved matches are cached locally under:

```text
auralis:youtube-resolver:v1
```

with a 24-hour TTL.

## Universe + Source Pulse

Universe provides the broader catalog/discovery surface with:

- universal track search
- album search
- artist search
- alternate-version discovery
- Music Graph detail views
- artist mixes
- artwork-rich cards
- full-playback actions
- provider/source state
- loading skeletons
- responsive layouts

`GET /api/providers` powers Source Pulse and reports provider health/capabilities without exposing secrets.

## Auralis playlists

Playlists are provider-independent and local-first.

Current capabilities:

- create/name/describe playlists
- add Music Graph/API tracks
- mix tracks from different discovery sources
- open/remove/delete
- resolve full playback at play time

Storage key:

```text
auralis:playlists:v2
```

Optional cloud sync can be added later without becoming a playback gate.

## Live Radio

Auralis adds a reliability layer above Radio Browser:

1. require safe public HTTPS targets
2. reject broken entries
3. collapse duplicate relays/codecs
4. prefer browser-friendly variants
5. perform bounded probes
6. reject HTML/JSON/XML error responses
7. return Auralis verification metadata

HLS stations use native playback where possible and `hls.js` fallback where needed.

Regional lanes include English, Hindi, Telugu, Kannada, Tamil, Malayalam, and Konkani.

## Aura Mode

Aura Mode is an optional artwork-driven full-site theme system. It derives a palette from the active artwork and applies it to:

- ambient liquid-light fields
- player surfaces
- sidebar/topbar glass
- navigation state
- cards/borders
- controls/glows

Artwork itself is not stretched into a full-page background.

## Guest-first personalization

No account is required to browse, search, or play supported sources.

Local features include:

- display name/avatar initial
- liked items
- recently played
- playlists
- queue
- Aura preferences
- volume/preferences
- YouTube resolver cache

## API endpoints

### Universal catalog

```text
GET /api/catalog?mode=search&q=Blinding%20Lights&kind=track
GET /api/catalog?mode=search&q=After%20Hours&kind=album
GET /api/catalog?mode=search&q=The%20Weeknd&kind=artist
GET /api/catalog?mode=chart
GET /api/catalog?mode=album&id=<deezer_album_id>
GET /api/catalog?mode=artist&id=<deezer_artist_id>
```

### Full playback resolver

```text
GET /api/youtube?title=<track>&artist=<artist>&album=<optional-album>&limit=8
```

Required production/local server secret:

```text
YOUTUBE_API_KEY=<secret>
```

Never commit the value to GitHub or frontend JavaScript.

### Provider status

```text
GET /api/providers
```

### Radio

```text
GET /api/radio?mode=top
GET /api/radio?mode=search&q=Dance%20Wave
GET /api/radio?mode=language&q=hindi&country=IN
```

## Local development

Auralis uses Vercel serverless `/api/*` routes, so use:

```bash
npx vercel dev
```

Local YouTube full-playback testing requires `YOUTUBE_API_KEY` through the local Vercel environment.

## Testing

GitHub Actions performs JavaScript syntax checks plus the layered regression suite:

```bash
python tests/smoke.py
python tests/radio_v6.py
python tests/experience_v7.py
python tests/music_graph_v9.py
python tests/full_playback_v91.py
python tests/ux_v92.py
python tests/playback_recovery_v921.py
python tests/stability_v10.py
python tests/player_universe_v101.py
python tests/product_polish_v1011.py
python tests/product_hotfix_v1012.py
node tests/sw_lifecycle_v10.mjs
```

Coverage protects radio, Aura, Music Graph, official YouTube playback, queue/likes, playlist UX, artwork recovery, Stability v10 migration, observer safety, and service-worker lifecycle behavior.

## Project boundaries / Supabase Hub

Auralis is App #1 in the shared Supabase Project Hub, but **v10.1 makes no Supabase changes**.

Repository agents must read:

- `AGENTS.md`
- `SUPABASE_HUB_RULES.md`

No Auralis task may modify another application's schema/resources or shared project-level configuration.

## Project structure

```text
auralis-music/
├── AGENTS.md
├── SUPABASE_HUB_RULES.md
├── api/
│   ├── catalog.js
│   ├── providers.js
│   ├── radio.js
│   └── youtube.js
├── docs/
│   ├── PROVIDER_ARCHITECTURE_V9.md
│   ├── RELEASE_V9_CHECKLIST.md
│   └── RELEASE_V10_1.md
├── js/
│   ├── providers/
│   ├── app-v3.js
│   ├── row-play-targets.js
│   ├── radio-reliability-v6.js
│   ├── auralis-experience-v7.js
│   ├── konkani-radio-v7.js
│   ├── music-graph-v9.js
│   ├── full-playback-v9-1.js
│   ├── ux-reliability-v9-2.js
│   ├── playback-recovery-v9-2-1.js
│   ├── update-manager-v10.js
│   ├── player-universe-v10-1.js
│   ├── product-polish-v10-1.js
│   └── product-hotfix-v10-1-2.js
├── tests/
├── sw.js
├── index.html
└── vercel.json
```

## Security

- API keys stay in Vercel environment variables.
- `YOUTUBE_API_KEY` is consumed only server-side by `/api/youtube`.
- Browser code receives only resolved public metadata.
- No service-role key or provider secret belongs in GitHub.

## Roadmap

Next work should continue the same principle: improve quality before provider count.

Potential later additions:

1. Last.fm recommendation intelligence
2. registered SoundCloud adapter
3. credentialed Audiomack adapter
4. optional Spotify / Apple Music connected accounts
5. optional Supabase cloud playlists/likes/history

**Quality > quantity.** New providers or features should materially improve the Auralis experience rather than simply increase the number of integrations.

## License

MIT — see [LICENSE](LICENSE).
