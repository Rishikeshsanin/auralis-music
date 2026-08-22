# Auralis 🎧

> A polished multi-provider music platform with universal music discovery, full-song playback routes, albums/artists, live radio, playlists, provider health, and an artwork-driven Aura Mode — all behind one Auralis UI.

[![Smoke Test](https://github.com/Rishikeshsanin/auralis-music/actions/workflows/smoke.yml/badge.svg)](https://github.com/Rishikeshsanin/auralis-music/actions/workflows/smoke.yml)
[![Live on Vercel](https://img.shields.io/badge/Live-Vercel-000000?logo=vercel)](https://auralis-music-lime.vercel.app)
[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](LICENSE)

**Production:** https://auralis-music-lime.vercel.app

## What Auralis is

Auralis is not a static Spotify clone. It combines several legitimate music sources while keeping catalog discovery, canonical metadata, playback, live radio and provider health as separate layers.

The current platform uses:

- **YouTube Data API + IFrame Player** — full-song/video playback through visible official embeds when a reliable embeddable match is available.
- **Audius** — open full-track catalog where tracks are streamable.
- **Jamendo** — independent full-track catalog.
- **Deezer** — broad commercial track/album/artist discovery and clearly labelled 30-second previews.
- **MusicBrainz** — canonical recording identity, MBIDs, ISRCs and release metadata.
- **Cover Art Archive** — canonical artwork fallback.
- **Radio Browser** — worldwide live radio through Auralis's verified radio gateway.
- **hls.js** — HLS compatibility where native browser playback is insufficient.

Auralis never presents a preview as a full song and does not use downloader/extraction APIs.

## Full Playback v9.1

v9.1 adds the **Auralis Full Playback Resolver** on top of Music Graph v9.

```text
User selects a track
        ↓
Auralis Music Graph
(title / artist / album / artwork)
        ↓
Full Playback Resolver
        ↓
YouTube Data API
        ↓
embeddable public candidates
        ↓
match + quality ranking
        ↓
best reliable full source
        ↓
Official YouTube IFrame Player
        ↓
Auralis controls / queue / Aura UI
```

### Resolver behavior

The server-side resolver:

- searches primarily with **title + artist** to avoid album/remix bias
- uses album metadata as fallback context when artist metadata is unavailable
- requests only embeddable/syndicated video results
- verifies video status and duration through `videos.list`
- favors exact title/artist matches
- favors artist Topic channels and official/label-style sources
- penalizes unrelated covers, karaoke, nightcore, reactions, tutorials and unrequested variants
- returns one `bestMatch` plus fallback candidates
- keeps the YouTube API key server-side
- uses CDN/browser caching to reduce repeated search quota usage

Example production requests:

```text
GET /api/youtube?title=Tum%20Hi%20Ho&artist=Arijit%20Singh
GET /api/youtube?title=Blinding%20Lights&artist=The%20Weeknd
GET /api/youtube?title=Naatu%20Naatu&artist=Rahul%20Sipligunj%20Kaala%20Bhairava
```

### Playback UI

Music Graph tracks, album tracks and Auralis playlist rows expose a **▶ Full** action.

When full playback starts:

- a visible Auralis glass playback dock hosts the official YouTube IFrame
- the existing bottom player reflects the resolved title/artist/artwork
- play/pause is bridged to the YouTube player
- seek and volume use the existing Auralis controls
- next/previous works with the resolved Auralis queue
- Aura Mode continues to use the selected track artwork/theme
- the layout remains responsive on mobile

The embedded player is intentionally visible; Auralis does not extract or hide YouTube audio.

### Match cache

Resolved track-to-video matches are cached locally under:

```text
auralis:youtube-resolver:v1
```

with a bounded 24-hour TTL, while API responses also use CDN cache headers. This avoids spending a YouTube search request every time the same song is replayed.

## Music Graph v9

The **Auralis Music Graph** normalizes individual APIs into one catalog experience.

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

A search can contain:

- mainstream catalog tracks
- album entities
- artist entities
- artwork
- release dates
- MusicBrainz recording IDs
- ISRCs when available
- preview/full-playback availability
- source links

If Deezer has no result but MusicBrainz can identify a recording, the Music Graph can return a canonical metadata fallback instead of simply showing nothing.

## Source Pulse — provider control plane

`GET /api/providers` powers the provider-health layer.

It reports provider state, latency, capabilities and credential readiness without exposing secrets.

| Provider | Current role | Playback semantics |
| --- | --- | --- |
| YouTube | **Active full-playback resolver** | Full playback through visible official IFrame embeds |
| Audius | Active open catalog | Full stream where streamable |
| Jamendo | Active independent catalog | Full stream where exposed by Jamendo |
| Deezer | Universal catalog / albums / artists / charts | 30-second preview where available |
| MusicBrainz | Canonical identity | Metadata only |
| Cover Art Archive | Artwork fallback | Artwork only |
| Radio Browser | Worldwide live radio | Verified live streams |
| SoundCloud | Future registered provider | Full/preview according to provider availability |
| Last.fm | Future recommendation intelligence | Metadata/discovery only |
| Audiomack | Future credentialed provider | Provider-dependent |
| Spotify | Optional connected provider | User authorization / Premium rules apply |
| Apple Music | Optional connected provider | User authorization / subscription rules apply |

Missing optional credentials never prevent the rest of Auralis from working.

## Universe

The Universe/Music Graph UI supports:

- universal track search
- album search
- artist search
- global catalog pulse
- album detail views
- artist detail views
- artwork-rich cards
- canonical metadata
- full-playback actions
- Source Pulse
- shimmer/skeleton states
- responsive layouts

Normal Auralis search also receives the broad Music Graph catalog rail above existing direct Audius/Jamendo results.

## Auralis playlists

Auralis playlists are provider-independent and local-first.

Current capabilities:

- create and name playlists
- add Music Graph tracks
- mix tracks discovered through different providers
- open/remove/delete
- resolve full playback at play time

Storage key:

```text
auralis:playlists:v2
```

Optional cloud sync can be added later without becoming a playback requirement.

## Playback rules

Auralis is explicit about source capabilities.

### YouTube full playback

Auralis resolves a catalog track to a public, embeddable YouTube candidate and plays it through the official IFrame Player API.

The application deliberately does **not** use:

- `yt-dlp`
- `youtube-dl`
- MP3 extraction
- downloader APIs
- hidden audio extraction

### Audius / Jamendo full tracks

When those providers expose a complete playable stream, it feeds the normal HTML audio player directly.

### Deezer catalog previews

Deezer playback is labelled **30-second catalog preview** and is never represented as a full track.

### Live radio

Radio Browser stations route through the Auralis radio verifier and then use direct audio or HLS playback as appropriate.

## Discovery universe

Auralis includes:

- **44 dynamic collections**
- **24 genre worlds**
- **16 mood worlds**
- Essentials/era discovery routes
- expandable Trending
- `Show more` / `Load more`
- multi-provider search
- provider normalization and deduplication
- global catalog pulse

Collections are discovery recipes, not copied commercial playlists.

## Live Radio

Auralis adds its own reliability layer above the Radio Browser directory:

1. require safe public HTTPS targets
2. reject broken entries
3. collapse duplicate relays/codecs
4. prefer browser-friendly variants
5. perform bounded stream probes
6. reject obvious HTML/JSON/XML error responses
7. return Auralis verification metadata

HLS (`.m3u8`) stations use native playback where available and `hls.js` fallback elsewhere.

The radio UI keeps `Popular worldwide right now` pinned while selected/search/tuning content appears above it.

Language lanes include English, Hindi, Telugu, Kannada, Tamil, Malayalam and Konkani. Konkani intentionally promotes **Radio AmchiKONKANI** when its stream passes Auralis verification.

## Aura Mode v8+

Aura Mode is an optional full-site artwork-driven theme. Artwork itself is never used as the website background; Auralis derives a palette and drives:

- animated liquid-light fields
- sidebar/topbar glass
- player surfaces
- active navigation
- hero gradients
- cards/borders
- controls/glows

Palette changes follow the currently selected track. Aura is off by default and supports local auto-off settings.

## Loading / motion language

Auralis uses visible loading feedback for asynchronous work:

- track/card shimmer skeletons
- Music Graph skeletons
- full-playback resolver/loading state
- radio tuning animation
- bottom-player loading state
- artwork transitions
- reduced-motion support

## Guest-first personalization

No account is required to browse, search or play supported sources.

Local features include:

- display name/avatar initial
- liked items
- recently played
- playlists
- Aura preferences
- volume/preferences
- YouTube resolver cache

Supabase Project Hub remains untouched by v9/v9.1. Optional cloud authentication/library sync can be added later without becoming a playback gate.

## Project architecture

```text
auralis-music/
├── AGENTS.md
├── SUPABASE_HUB_RULES.md
├── api/
│   ├── catalog.js
│   ├── providers.js
│   ├── radio.js
│   └── youtube.js              # server-side full-playback resolver
├── docs/
│   ├── PROVIDER_ARCHITECTURE_V9.md
│   └── RELEASE_V9_CHECKLIST.md
├── js/
│   ├── providers/
│   │   ├── audius.js
│   │   ├── jamendo.js
│   │   ├── radio-browser.js
│   │   └── catalog-manager.js
│   ├── app-v3.js
│   ├── row-play-targets.js
│   ├── radio-reliability-v6.js
│   ├── auralis-experience-v7.js
│   ├── konkani-radio-v7.js
│   ├── music-graph-v9.js
│   ├── full-playback-v9-1.js
│   ├── collections.js
│   ├── library-map.js
│   ├── store.js
│   └── fallback.js
├── tests/
│   ├── smoke.py
│   ├── radio_v6.py
│   ├── experience_v7.py
│   ├── music_graph_v9.py
│   └── full_playback_v91.py
├── experience-v8-aura.css
├── experience-v9.css
├── experience-v9-1.css
├── sw.js
├── index.html
└── vercel.json
```

## Boot chain

```text
app-v3
  ↓
Catalog Manager
  ↓
Radio Browser provider
  ├── Radio Reliability v6
  ├── Experience/Aura v7-v8
  └── Konkani guard
          ↓
      Music Graph v9
          ↓
      Full Playback v9.1
```

Each release layer is protected by regression tests so newer features do not silently break proven radio/Aura/catalog behavior.

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

Requires the server-only Vercel environment variable:

```text
YOUTUBE_API_KEY=<secret>
```

The value must never be committed to GitHub or exposed in frontend JavaScript.

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

Because Auralis contains Vercel serverless routes, a basic static file server cannot execute `/api/*`.

Use:

```bash
npx vercel dev
```

Local full-playback testing also needs `YOUTUBE_API_KEY` through the local Vercel environment. Do not hard-code the key.

## Testing

GitHub Actions checks JavaScript syntax and all layered regression suites:

```bash
python tests/smoke.py
python tests/radio_v6.py
python tests/experience_v7.py
python tests/music_graph_v9.py
python tests/full_playback_v91.py
```

Coverage protects:

- Radio Browser verification/HLS behavior
- pinned Popular radio structure
- Aura Mode and loading states
- Konkani selection
- Music Graph entities/canonical matching
- Source Pulse provider telemetry
- YouTube secret gating
- full-playback resolver query integrity and match-quality rules
- visible official IFrame playback architecture
- Auralis player-control bridge
- playlist full-playback actions
- PWA shell v14
- no downloader-style YouTube integration
- no duplicate enhancement boot

## Security

- API keys stay in Vercel environment variables.
- `YOUTUBE_API_KEY` is consumed only by the serverless `/api/youtube` route.
- The Google key should be restricted to **YouTube Data API v3**.
- No secret is committed to the repository.
- Browser code receives only resolved public video metadata.

## Safety / Project Hub boundary

Auralis is App #1 in the shared Supabase Project Hub, but this release makes **no Supabase changes**.

Repository agents must read:

- `AGENTS.md`
- `SUPABASE_HUB_RULES.md`

No Auralis task may modify another application's schema, resources or deployment.

## Limitations

Auralis aims for a practical music-player experience, not a claim that every copyrighted recording on Earth can be anonymously streamed.

A full YouTube route depends on a suitable public video allowing embedding in the user's region. When no reliable match is available, Auralis should fail clearly rather than silently play an unrelated song.

## Roadmap

The current focus is to use v9.1 in real browsing and improve matching based on actual gaps. Future optional providers can then be activated only when they add meaningful coverage:

1. SoundCloud registered-app adapter
2. Last.fm recommendations/charts
3. Audiomack credentialed adapter
4. optional Spotify / Apple Music connected accounts
5. optional Supabase cloud playlists/likes/history

Quality > quantity: new providers should improve playback/discovery rather than simply increase the API count.

## License

MIT — see [LICENSE](LICENSE).
