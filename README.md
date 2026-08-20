# Auralis 🎧

> A polished, responsive multi-catalog music discovery platform with full-track open catalogs, music-first live radio, dynamic collections, genre/mood worlds, guest personalization, queueing, likes, history, and a premium interface.

[![Smoke Test](https://github.com/Rishikeshsanin/auralis-music/actions/workflows/smoke.yml/badge.svg)](https://github.com/Rishikeshsanin/auralis-music/actions/workflows/smoke.yml)
[![Live on Vercel](https://img.shields.io/badge/Live-Vercel-000000?logo=vercel)](https://auralis-music-lime.vercel.app)
[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](LICENSE)

**Live demo:** https://auralis-music-lime.vercel.app

## Why Auralis

Auralis is not a static Spotify mockup. It combines different legitimate/open audio sources behind one discovery and playback experience while keeping each provider's limitations explicit.

- **Audius** — primary open full-stream music catalog.
- **Jamendo** — independent full-track catalog.
- **Radio Browser** — worldwide live-radio directory through a same-origin Auralis API.
- **hls.js** — browser compatibility layer for HLS radio streams where native HLS playback is unavailable.
- Future credentialed providers can be added as adapters without rewriting the player, queue or browse system.

Auralis is built around context-driven discovery: **44 dynamic collections, 24 genre worlds, 16 mood worlds, live radio, guest personalization, expandable result sets and one unified player.**

## Radio Reliability v6

The current radio release focuses on two things: **station quality** and **stable page structure**.

### Permanent Popular shelf

`Popular worldwide right now` is a pinned music shelf. Searching, opening a tag, or choosing a language station no longer destroys it.

The layout behaves like this:

```text
Selected / searched / language result (only when active)
                         ↓
Popular worldwide right now  ← always present
                         ↓
Radio intro
                         ↓
Search + genre filters
                         ↓
Language lanes
```

So if a user opens Dance Wave, Telugu radio, Kannada radio, etc., that result appears above Popular while the Popular shelf stays visible underneath.

### Stream preflight verification

Radio Browser's directory-health flag is useful, but it cannot guarantee that a stream will start in a particular browser at this exact moment. Auralis therefore adds its own server-side preflight before returning radio results:

1. require a public HTTPS stream URL
2. reject directory entries currently marked broken
3. group duplicate station/relay variants
4. prefer browser-friendly MP3/AAC/OGG/HLS variants
5. make a short bounded request to the stream
6. reject obvious HTML/JSON/XML error pages
7. return the first healthy variant from each station group

The API marks preflighted entries with `auralis_verified` and `auralis_stream_type` metadata. This greatly reduces dead cards, while still acknowledging that a third-party broadcaster can stop or change a stream after the check.

### Duplicate relay cleanup

Stations often publish the same service through several MP3/AAC/OGG relays. Auralis normalizes noisy station names and collapses those variants before rendering them.

For example, a search that previously showed several `Dance Wave` relay cards is reduced to the strongest currently healthy variant instead of five nearly identical cards.

### HLS regional-radio support

A number of regional/AIR-style stations use HLS (`.m3u8`) rather than a direct MP3/AAC stream.

Auralis now:

- uses native HLS when the browser supports it
- loads **hls.js** for supported browsers that need an HLS engine
- performs one network/media recovery attempt for HLS playback
- tears down the previous HLS session when the user changes station
- keeps direct MP3/AAC/OGG playback untouched

This is particularly important for Indian regional radio where otherwise-valid HLS stations could previously fail in Chromium browsers.

### Music-first ranking

The Popular feed intentionally favors music rather than raw radio-directory counts.

It filters obvious:

- news
- talk/politics
- podcasts/spoken word
- religious/sermon feeds
- old-time radio drama

The top mix is English/global-heavy, with only a few strong Hindi choices mixed in. Current activity, directory reputation, stream quality, codec suitability and recognizable music brands contribute to ranking.

### Language lanes

Current language ordering:

```text
English
Hindi
Telugu
Kannada
Tamil
Malayalam
Konkani
```

Regional sections stay intentionally compact. The goal is a couple of worthwhile options rather than filling the UI with weak/dead stations for the sake of a larger number.

For Konkani, Auralis prioritizes **FM Rainbow Goa** when available.

### Station artwork

Broken/missing station favicons never need to become browser broken-image boxes. Auralis falls back to generated station initials/monograms.

## Loading experience

Backend activity has a consistent visual language:

- shimmer/skeleton cards for catalog shelves
- skeleton rows for search/discovery
- skeleton station cards for radio/language lanes
- loading-button spinners
- lazy artwork fade-in
- reduced-motion support

## Guest personalization

Auralis remains guest-first. An account is not required to browse, search or play.

- optional local display name
- avatar initial derived from the chosen name
- `Listener` fallback
- local likes and recently played history
- Auralis logo always returns to Home

Supabase authentication is reserved for the later cloud-sync layer rather than acting as a playback gate.

## Catalog Universe

### Discovery

- **44 dynamic Auralis Collections**
- **24 genres**
- **16 moods**
- Essentials/era discovery routes
- multi-provider song search
- provider-result normalization and de-duplication
- expandable Trending shelf
- `Show more` / `Load more` workflows
- collection filters including Discovery, Essentials, Genres, Moods, Focus, Energy and Night

Collections are discovery recipes, not hard-coded copies of commercial albums/playlists. Results depend on music legitimately exposed by the active providers.

### Playback

- play/pause
- seek for normal tracks
- next/previous
- volume
- shuffle/repeat
- directly clickable artwork/title/artist in track rows
- keyboard-accessible playback targets
- live-radio player state
- HLS live-radio support
- stream-failure detection/failover
- queue drawer
- Media Session API integration
- provider/source badges
- local likes/history

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
                                                         direct audio / HLS bridge
```

### Provider-management layer

`js/providers/catalog-manager.js` coordinates music providers. Radio has an additional reliability layer because broadcaster streams are more volatile than catalog tracks.

| Provider | Status | Role |
| --- | --- | --- |
| Audius | Active | Primary full-stream music catalog/search/discovery |
| Jamendo | Active demo integration | Independent full-track catalog |
| Radio Browser | Active | Worldwide station discovery |
| hls.js | Active compatibility dependency | HLS playback in browsers without suitable native support |
| SoundCloud | Staged | Requires registered application + OAuth credentials |
| Supabase Project Hub | App #1 registered | Future Auth/cloud library layer |

The Jamendo adapter currently uses the documented read-API test client for the college/demo build. A dedicated Jamendo developer `client_id` should be configured before treating it as a production service.

Auralis does **not** count metadata-only/short-preview services as full music providers.

## Project structure

```text
auralis-music/
├── AGENTS.md
├── SUPABASE_HUB_RULES.md
├── api/
│   └── radio.js                      # ranking + dedupe + runtime stream preflight
├── assets/
├── js/
│   ├── providers/
│   │   ├── audius.js
│   │   ├── jamendo.js
│   │   ├── radio-browser.js
│   │   └── catalog-manager.js
│   ├── app-v3.js
│   ├── row-play-targets.js
│   ├── radio-reliability-v6.js       # pinned Popular + HLS bridge
│   ├── library-map.js
│   ├── collections.js
│   ├── store.js
│   └── fallback.js
├── tests/
│   ├── smoke.py
│   └── radio_v6.py
├── .github/workflows/smoke.yml
├── index.html
├── styles.css
├── fixes.css
├── experience.css
├── experience-v3.css
├── experience-v4.css
├── experience-v5.css
├── experience-v6.css
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

> The `/api/radio` Vercel function requires Vercel's runtime when testing live radio locally.

## Validation

```bash
node --check js/app-v3.js
node --check js/row-play-targets.js
node --check js/radio-reliability-v6.js
node --check js/providers/audius.js
node --check js/providers/jamendo.js
node --check js/providers/radio-browser.js
node --check js/providers/catalog-manager.js
node --check api/radio.js
python tests/smoke.py
python tests/radio_v6.py
```

GitHub Actions runs the validation automatically for pull requests and pushes to `main`.

## Deployment

Auralis deploys directly to Vercel. `main` triggers production while pull requests create isolated preview deployments.

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

The radio reliability releases make **no Supabase/database changes**.

## Music & rights

Auralis does not scrape, download or re-host commercial recordings. Playback comes from provider/broadcaster streams exposed for use by their respective services/operators, and availability can change.

Live-radio station operators remain responsible for their streams/content. Passing Auralis's preflight means the stream looked technically reachable immediately before it was shown; it is not a licensing statement or a guarantee of permanent availability.

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
