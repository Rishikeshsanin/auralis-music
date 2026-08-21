# Auralis 🎧

> A polished multi-provider music platform that keeps one Auralis UI over full-track catalogs, universal music metadata, albums/artists, live radio, playlists, moods, genres, provider health and an artwork-driven Aura Mode.

[![Smoke Test](https://github.com/Rishikeshsanin/auralis-music/actions/workflows/smoke.yml/badge.svg)](https://github.com/Rishikeshsanin/auralis-music/actions/workflows/smoke.yml)
[![Live on Vercel](https://img.shields.io/badge/Live-Vercel-000000?logo=vercel)](https://auralis-music-lime.vercel.app)
[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](LICENSE)

**Production:** https://auralis-music-lime.vercel.app

## What Auralis is

Auralis is not a static Spotify clone and it does not pretend every catalog API grants unrestricted full-song playback.

The platform separates five concerns:

1. **Full playback** — Audius and Jamendo where those providers expose complete streams.
2. **Universal catalog discovery** — Deezer-backed track/album/artist discovery with explicitly labelled previews where available.
3. **Canonical music identity** — MusicBrainz IDs, ISRCs and release metadata.
4. **Artwork + context** — provider artwork with Cover Art Archive fallback.
5. **Live radio** — Radio Browser with Auralis-side stream verification and HLS support.

Credentialed services such as YouTube, SoundCloud, Audiomack, Last.fm, Spotify and Apple Music are represented in the provider control plane and can be activated without rewriting the Auralis interface.

## Music Graph v9

v9 introduces the **Auralis Music Graph**: a normalized layer above individual APIs.

```text
                              AURALIS
                                 │
                         Auralis Music Graph
                                 │
              ┌──────────────────┼──────────────────┐
              │                  │                  │
           Identity           Discovery           Playback
              │                  │                  │
        MusicBrainz          Deezer            Audius
        ISRC / MBID          charts            Jamendo
        releases             albums            Radio Browser
              │              artists                │
        Cover Art                │             direct / HLS
              │                  │                  │
              └──────────────────┴──────────────────┘
                                 │
                         one Auralis UI
```

A search can now contain:

- mainstream catalog tracks
- album entities
- artist entities
- artwork
- release dates
- MusicBrainz recording IDs
- ISRCs when available
- preview availability
- source links
- a handoff to the existing full-track Auralis catalogs

If Deezer has no result but MusicBrainz can identify the recording, v9 can return a **canonical metadata fallback** instead of showing nothing.

### Search philosophy

Auralis does not show an “API 1 / API 2 / API 3” interface. Providers are implementation details.

```text
query
  ↓
provider search
  ↓
normalize
  ↓
canonical identity
  ↓
artwork / metadata enrichment
  ↓
playback availability
  ↓
Auralis result
```

## Source Pulse — provider control plane

`/api/providers` powers **Source Pulse**, the internal provider-health/control layer.

It reports provider state, latency, last check, capabilities and credential readiness.

Current provider roles:

| Provider | v9 role | Playback semantics |
| --- | --- | --- |
| Audius | Active open music catalog | Full stream where streamable |
| Jamendo | Active independent catalog | Full stream exposed by Jamendo |
| Deezer | Universal catalog / charts / albums / artists | 30-second preview where available; never labelled as full |
| MusicBrainz | Canonical recording / release identity | Metadata only |
| Cover Art Archive | Album/release artwork fallback | Artwork only |
| Radio Browser | Worldwide live-radio directory | Verified live streams |
| YouTube | Official music video fallback | Credential-gated official IFrame playback |
| SoundCloud | Future registered provider | Full/preview according to provider availability |
| Last.fm | Future recommendation intelligence | Metadata/discovery only |
| Audiomack | Future catalog provider | Credential-gated |
| Spotify | Optional connected provider | User authorization / Premium playback rules apply |
| Apple Music | Optional connected provider | User authorization / subscription rules apply |

A provider can be online, degraded, client-managed or `needs_credentials`. Missing credentials do not break the rest of Auralis.

## Universe

The v9 UI adds a Music Graph/Universe experience while preserving the existing visual language.

It supports:

- universal track search
- album search
- artist search
- global catalog pulse
- album detail views
- artist detail views
- artwork-rich cards
- source availability
- canonical metadata
- shimmer/skeleton states
- responsive layouts
- Source Pulse provider view

Normal Auralis search also receives a broad-catalog rail above the existing playable Audius/Jamendo results.

## Auralis playlists

v9 replaces the old playlist placeholder with real **provider-independent local playlists**.

A playlist can contain Music Graph entries regardless of which catalog originally supplied the metadata. This is intentionally local-first until optional cloud sync is enabled.

Current playlist capabilities:

- create
- name
- add tracks
- open
- remove tracks
- delete
- resolve playable sources where available

Storage key: `auralis:playlists:v2`.

## Playback rules

Auralis is explicit about what each source can legally/technically provide.

### Full-track path

Audius and Jamendo feed the main HTML audio player when they expose a playable stream.

### Catalog-preview path

Deezer previews are labelled **30-second catalog preview**. They are never presented as complete tracks.

### Full-source resolver

A Music Graph track can use **Find full source in Auralis** to search the active full-track catalogs for the canonical title + artist.

### YouTube path

`api/youtube.js` is prepared for the **official YouTube Data API + visible IFrame player** only.

It deliberately does **not** use:

- `yt-dlp`
- `youtube-dl`
- MP3 extraction
- downloader APIs
- hidden audio extraction

Until a legitimate `YOUTUBE_API_KEY` is configured, the provider reports `needs_credentials` and Auralis continues normally.

## Discovery universe

Auralis currently includes:

- **44 dynamic collections**
- **24 genre worlds**
- **16 mood worlds**
- Essentials/era discovery routes
- expandable Trending
- `Show more` / `Load more`
- multi-provider search
- provider normalization and deduplication
- global catalog pulse in v9

Collections are discovery recipes, not copied commercial playlists.

## Live Radio

Radio remains a first-class part of Auralis.

### Reliability layer

Auralis adds server-side checks on top of Radio Browser:

1. require safe public HTTPS targets
2. reject broken entries
3. collapse duplicate relays/codecs
4. prefer browser-friendly variants
5. perform a bounded stream probe
6. reject obvious HTML/JSON/XML error pages
7. mark returned stations with Auralis verification metadata

### HLS

Regional/AIR-style `.m3u8` streams are supported through native HLS where available and `hls.js` fallback elsewhere.

### Radio layout

```text
selected / tuning result
        ↓
Popular worldwide right now   ← pinned
        ↓
radio intro + search
        ↓
language lanes
```

Language lanes currently include:

- English
- Hindi
- Telugu
- Kannada
- Tamil
- Malayalam
- Konkani

Konkani intentionally promotes one verified music-first option: **Radio AmchiKONKANI** when its stream passes the live verifier.

## Aura Mode v8+

Aura Mode is an optional full-site artwork-driven theme.

The artwork itself is never used as the page background. Auralis samples/falls back to a palette and uses those colors to drive:

- animated liquid-light fields
- sidebar and topbar glass
- player surfaces
- active navigation
- hero gradients
- cards and borders
- controls and glows

The palette transitions when the current track changes. Aura is off by default and has configurable auto-off timing in the local profile.

## Loading / motion language

Auralis uses loading feedback rather than appearing frozen during network work:

- track/card shimmer skeletons
- radio tuning animation
- bottom-player loading wave
- artwork fade-in
- button loading states
- v9 Music Graph skeletons
- reduced-motion support

## Guest-first personalization

No account is required to browse or listen.

Local features include:

- optional display name
- avatar initial
- liked items
- recently played
- playlists
- Aura preferences
- volume/preferences

Supabase Project Hub is intentionally **not used by v9**. Optional cloud authentication/library sync can be added later without becoming a playback gate.

## Project architecture

```text
auralis-music/
├── AGENTS.md
├── SUPABASE_HUB_RULES.md
├── api/
│   ├── catalog.js          # Music Graph catalog gateway
│   ├── providers.js        # Source Pulse provider telemetry
│   ├── radio.js            # verified radio gateway
│   └── youtube.js          # official credential-gated YouTube adapter
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
│   ├── collections.js
│   ├── library-map.js
│   ├── store.js
│   └── fallback.js
├── tests/
│   ├── smoke.py
│   ├── radio_v6.py
│   ├── experience_v7.py
│   └── music_graph_v9.py
├── experience-v8-aura.css
├── experience-v9.css
├── sw.js
├── index.html
└── vercel.json
```

## Boot chain

The release is deliberately layered so older proven subsystems remain covered by regression tests.

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
```

The v9 test suite specifically prevents accidental duplicate classic-script booting of those enhancement layers.

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

### YouTube

```text
GET /api/youtube?q=<music query>
```

Requires server environment variable:

```text
YOUTUBE_API_KEY=...
```

Do not place server/API secrets in frontend JavaScript or commit them to GitHub.

## Local development

Because Auralis contains Vercel serverless routes, `python -m http.server` is only suitable for static-shell checks. It cannot execute `/api/*`.

For the complete application:

```bash
npx vercel dev
```

Or use the deployed Vercel preview/production URL.

## Testing

GitHub Actions validates JavaScript syntax plus layered regression suites:

```bash
python tests/smoke.py
python tests/radio_v6.py
python tests/experience_v7.py
python tests/music_graph_v9.py
```

The tests protect:

- radio verification/HLS behavior
- pinned Popular radio structure
- Aura Mode
- player/radio loading states
- Konkani selection
- v9 Music Graph entities
- provider telemetry
- official YouTube architecture
- local playlist lifecycle
- PWA shell assets
- no downloader-style YouTube integration
- no duplicate enhancement boot

## Safety / Project Hub boundary

Auralis is App #1 in the shared Supabase Project Hub, but this release makes **no Supabase changes**.

Repository agents must read:

- `AGENTS.md`
- `SUPABASE_HUB_RULES.md`

No Auralis task may modify another application's schema, resources or deployment.

## Important limitation

The goal is broad legitimate discovery and multiple playback routes — **not** to falsely promise that every copyrighted commercial recording can be anonymously streamed in full for free.

Auralis aims for:

> almost any song should be discoverable, and as many as possible should resolve to a legitimate playback path.

That is why provider capabilities and playback semantics are explicit.

## Roadmap

The provider control plane is ready for the next activation steps:

1. official YouTube search + IFrame playback
2. SoundCloud registered-app adapter
3. Last.fm recommendations/charts
4. Audiomack credentialed adapter
5. optional Spotify / Apple Music connected accounts
6. optional Supabase cloud playlists/likes/history

## License

MIT — see [LICENSE](LICENSE).
