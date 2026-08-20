# Auralis 🎧

> A polished, responsive multi-catalog music discovery platform with open full-track catalogs, music-first live radio, dynamic collections, genre/mood worlds, guest personalization, queueing, likes, history, and an adaptive visual experience.

[![Smoke Test](https://github.com/Rishikeshsanin/auralis-music/actions/workflows/smoke.yml/badge.svg)](https://github.com/Rishikeshsanin/auralis-music/actions/workflows/smoke.yml)
[![Live on Vercel](https://img.shields.io/badge/Live-Vercel-000000?logo=vercel)](https://auralis-music-lime.vercel.app)
[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](LICENSE)

**Live demo:** https://auralis-music-lime.vercel.app

## Why Auralis

Auralis is not a static Spotify mockup. It combines legitimate/open audio sources behind one discovery and playback experience while keeping each provider's limits explicit.

- **Audius** — primary open full-stream music catalog.
- **Jamendo** — independent full-track catalog.
- **Radio Browser** — worldwide live-radio directory through Auralis's same-origin radio API.
- **hls.js** — compatibility for HLS radio streams where the browser needs an HLS engine.
- Future credentialed providers can be added as adapters without rewriting the player, queue, or browse system.

Auralis is built around context-driven discovery: **44 dynamic collections, 24 genre worlds, 16 mood worlds, expandable results, music-first radio and one unified player.**

## Experience v7 — Aura Mode + better loading feedback

### Aura Mode

**Aura Mode** is an optional artwork-driven visual layer. It is **off by default** so Auralis always has a stable base design.

When enabled, Auralis samples the current track/station artwork where browser CORS rules allow it and derives a restrained accent palette. If the artwork cannot be sampled, Auralis generates a deterministic fallback palette from the artwork/title instead of failing.

Aura Mode subtly influences:

- ambient background light
- sidebar and topbar surfaces
- bottom player
- active navigation
- selected tracks/stations
- interactive borders and glows
- range/control accents

Readability stays fixed; artwork never gets permission to arbitrarily recolor text or destroy contrast.

Aura controls appear in two places:

```text
Header:        Aura button → Sources online
Bottom player: Aura button → Queue → Volume
```

The control name appears on hover/focus rather than permanently occupying UI space.

### Local Aura settings

The guest profile includes:

- Aura Mode on/off
- show/hide Aura controls
- auto-off timer: **5 / 10 / 20 / 30 / 60 minutes / Never**
- default auto-off: **10 minutes**

Aura settings, display name, likes and history remain local to the device until optional cloud accounts are enabled.

### Player loading feedback

The bottom player now communicates real loading/buffering work instead of appearing frozen:

- animated top shimmer line
- small equalizer/wave status
- artwork sheen
- animated play-ring
- `Loading audio…` / `Tuning live stream…` feedback

The state reacts to media events such as `loadstart`, `waiting`, `stalled`, `seeking`, `canplay` and `playing`.

### Radio tuning feedback

Selecting a radio station can take a moment because Auralis resolves/searches the station and prepares a verified live route. During that gap a dedicated **TUNING AURALIS** card appears above the pinned Popular shelf with:

- station logo/initial
- animated radio rings
- live spectrum bars
- tuning status copy

The placeholder fades away when the active station result/player is ready.

## Radio Reliability v6+

The radio engine focuses on **quality, browser compatibility and stable page structure**.

### Permanent Popular shelf

`Popular worldwide right now` remains pinned even while a search, language pick or selected station opens above it.

```text
Selected / searched / tuning result (only when active)
                         ↓
Popular worldwide right now  ← always present
                         ↓
Radio intro
                         ↓
Search + genre filters
                         ↓
Language lanes
```

### Stream preflight verification

Radio Browser's directory-health flag cannot guarantee a stream will start in this browser right now, so Auralis adds server-side preflight:

1. require a public HTTPS stream URL
2. reject entries marked broken
3. group duplicate station/relay variants
4. prefer browser-friendly MP3/AAC/OGG/HLS variants
5. make a short bounded request to the stream
6. reject obvious HTML/JSON/XML error responses
7. return the best healthy variant

Returned entries expose `auralis_verified` and `auralis_stream_type` metadata.

### Duplicate relay cleanup

Multiple codec/relay entries for the same station are normalized and collapsed. A search that once showed several `Dance Wave` cards now resolves to the strongest currently healthy variant.

### HLS regional-radio support

A number of AIR/regional stations use HLS (`.m3u8`). Auralis:

- uses native HLS where supported
- loads **hls.js** where needed
- performs bounded network/media recovery
- tears down the previous HLS session when changing stations
- leaves direct MP3/AAC/OGG playback untouched

### Music-first ranking

The Popular feed intentionally prioritizes music over raw directory counts and filters obvious:

- news/talk/politics
- podcasts/spoken word
- religious/sermon feeds
- old-time radio drama

The main mix is English/global-heavy with only a few strong Hindi choices mixed in.

### Language lanes

Current order:

```text
English
Hindi
Telugu
Kannada
Tamil
Malayalam
Konkani
```

Regional sections stay intentionally compact: a couple of worthwhile options are better than a large wall of unreliable entries.

### Konkani

Konkani intentionally has **one music-first pick**:

**Radio AmchiKONKANI** — selected only when Auralis's own radio API currently verifies its HTTPS stream.

The dedicated guard prevents the generic regional loader from replacing this selection with weaker filler stations.

### Station artwork

Broken/missing favicons fall back to generated station initials instead of browser broken-image boxes.

## Guest personalization

Auralis remains guest-first. An account is not required to browse, search, play music or use radio.

- optional local display name
- avatar initial derived from that name
- `Listener` fallback
- local likes
- local recently played history
- local Aura preferences
- Auralis logo always returns to Home

Supabase authentication is reserved for a later optional cloud-sync layer rather than acting as a playback gate.

## Catalog universe

### Discovery

- **44 dynamic Auralis Collections**
- **24 genres**
- **16 moods**
- Essentials/era discovery routes
- multi-provider song search
- provider normalization + de-duplication
- expandable Trending
- `Show more` / `Load more`
- collection filters for Discovery, Essentials, Genres, Moods, Focus, Energy and Night

Collections are discovery recipes—not hard-coded copies of commercial albums/playlists. Results depend on music legitimately exposed by active providers.

### Playback

- play/pause
- seek for normal tracks
- next/previous
- volume
- shuffle/repeat
- artwork/title/artist row play targets
- keyboard-accessible playback targets
- live-radio state
- HLS playback support
- stream-failure detection/failover
- loading/buffering feedback
- queue drawer
- Media Session API
- provider/source badges
- local likes/history
- optional Aura Mode

## Architecture

```text
                                      AURALIS
                                         │
                                Catalog Manager
                                         │
          ┌──────────────────────────────┼──────────────────────────────┐
          │                              │                              │
       Audius                         Jamendo                    Radio Browser
  full-track catalog            full-track catalog             station directory
          │                              │                              │
          └─────────────── normalize + de-dupe ────────────────┐       │
                                                               │       ↓
                                                               │  Auralis radio API
                                                               │       │
                                                               │  filter / rank
                                                               │  dedupe variants
                                                               │  stream preflight
                                                               │       │
                                                               └───────┤
                                                                       ↓
                                                                 Auralis Player
                                                                       │
                                                    direct audio / HLS / loading UI
                                                                       │
                                                                 Aura Mode
```

### Provider-management layer

`js/providers/catalog-manager.js` coordinates music providers. Radio gets an additional reliability layer because broadcaster streams are more volatile than catalog tracks.

| Provider | Status | Role |
| --- | --- | --- |
| Audius | Active | Primary full-stream music catalog/search/discovery |
| Jamendo | Active demo integration | Independent full-track catalog |
| Radio Browser | Active | Worldwide live-station discovery |
| hls.js | Active compatibility dependency | HLS playback where native support is insufficient |
| SoundCloud | Staged | Requires registered application + OAuth credentials |
| Supabase Project Hub | App #1 registered | Future optional Auth/cloud-library layer |

The Jamendo adapter currently uses its documented read-API test client for this college/demo build. A dedicated Jamendo developer `client_id` should be configured before treating it as a production commercial service.

Auralis does **not** count metadata-only/short-preview services as full music providers.

## Project structure

```text
auralis-music/
├── AGENTS.md
├── SUPABASE_HUB_RULES.md
├── api/
│   └── radio.js
├── assets/
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
│   ├── library-map.js
│   ├── collections.js
│   ├── store.js
│   └── fallback.js
├── tests/
│   ├── smoke.py
│   ├── radio_v6.py
│   └── experience_v7.py
├── .github/workflows/smoke.yml
├── index.html
├── styles.css
├── fixes.css
├── experience.css
├── experience-v3.css
├── experience-v4.css
├── experience-v5.css
├── experience-v6.css
├── experience-v7.css
├── experience-v7-aura.css
├── manifest.webmanifest
├── sw.js
└── vercel.json
```

## Run locally

The frontend has no build step:

```bash
python -m http.server 4173
```

Then open `http://localhost:4173`.

> The `/api/radio` serverless function requires Vercel's runtime for live-radio API behavior.

## Validation

```bash
node --check js/app-v3.js
node --check js/row-play-targets.js
node --check js/radio-reliability-v6.js
node --check js/auralis-experience-v7.js
node --check js/konkani-radio-v7.js
node --check js/providers/audius.js
node --check js/providers/jamendo.js
node --check js/providers/radio-browser.js
node --check js/providers/catalog-manager.js
node --check api/radio.js
python tests/smoke.py
python tests/radio_v6.py
python tests/experience_v7.py
```

GitHub Actions runs these checks automatically on pull requests and `main` pushes.

## Deployment

Auralis deploys directly to Vercel. `main` triggers production while pull requests normally create isolated previews.

Production: **https://auralis-music-lime.vercel.app**

## Supabase Project Hub boundary

Auralis is registered as **App #1** in the shared Supabase `Project Hub` with the isolated namespace:

```text
auralis.*
```

Before database writes, agents must read `AGENTS.md`, `SUPABASE_HUB_RULES.md` and `hub.read_me_first`, then pass:

```sql
select hub.assert_app_scope('auralis', 'auralis');
```

Experience v7 makes **no Supabase/database changes**.

## Music & rights

Auralis does not scrape, download or re-host commercial recordings. Playback comes from provider/broadcaster streams exposed by their respective services/operators, and availability can change.

Passing Auralis's stream preflight means a station looked technically reachable immediately before it was shown; it is not a licensing statement or a guarantee of permanent availability.

The built-in fallback audio is synthesized in-browser and is not copied from a commercial recording.

## Roadmap

- optional Supabase sign-in + cloud library sync
- account-backed playlists
- cloud liked songs/history
- artist and album detail pages
- SoundCloud adapter after official credential approval
- optional MusicBrainz metadata enrichment
- additional legitimate full-track catalog adapters
- richer provider entity matching
- personalized recommendations
- collaborative playlists
- lyrics integration where licensing permits
- shareable listening rooms
- listening statistics

## License

The Auralis application source code is released under the [MIT License](LICENSE). Third-party music, station streams and metadata remain subject to their respective provider/operator terms.
