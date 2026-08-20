# Auralis 🎧

> A polished, responsive multi-catalog music discovery platform with full-track catalogs, live radio, dynamic collections, genre/mood worlds, guest personalization, queueing, likes, history, and a premium interface.

[![Smoke Test](https://github.com/Rishikeshsanin/auralis-music/actions/workflows/smoke.yml/badge.svg)](https://github.com/Rishikeshsanin/auralis-music/actions/workflows/smoke.yml)
[![Live on Vercel](https://img.shields.io/badge/Live-Vercel-000000?logo=vercel)](https://auralis-music-lime.vercel.app)
[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](LICENSE)

**Live demo:** https://auralis-music-lime.vercel.app

## Why Auralis

Auralis is not a static Spotify mockup. It has a provider-management layer that normalizes different audio sources into one discovery and playback experience.

- **Audius** is the primary open full-stream music backbone.
- **Jamendo** adds an independent full-track catalog.
- **Radio Browser** adds worldwide live radio through a small same-origin Vercel API proxy.
- Future credentialed providers can be added as adapters without rewriting the core player, queue or browse system.

The product is built around discovery rather than copying Spotify's exact information architecture: **44 dynamic collections, 24 genre worlds, 16 mood worlds, India-first and worldwide live radio, expandable shelves, guest personalization and one unified player.**

## Radio + Personalization v4

### Guest personalization

Auralis remains guest-first. No account is required to browse, search or play music.

- optional local display name
- first letter of the chosen name in the profile avatar
- `Listener` remains the fallback
- name is stored only in local browser storage for now
- clicking the Auralis brand always returns to Home

Supabase authentication is intentionally a later cloud-sync phase rather than a playback gate.

### Radio Universe

The radio experience is arranged deliberately instead of being one endless list:

1. **India Spotlight** — recognizable Indian stations promoted only when a healthy HTTPS stream is currently available
2. **India by Language** — Telugu, Kannada, Tamil, Malayalam and Hindi, normally one strong starting station per language
3. **Country Explorer** — India, USA, UK, France, Germany, UAE, Japan, South Korea, Brazil and Australia
4. **Popular Worldwide** — the existing international discovery feed remains available
5. Search and genre tags remain available below the curated layers

Radio Browser requests are ranked with a small Auralis popularity score using current click activity, votes and stream quality. The API proxy supports `top`, `search`, `tag`, `country` and `language` modes.

Broken or missing radio favicons are replaced with an Auralis-generated station monogram rather than a browser broken-image icon.

## Catalog Universe

### Discovery

- **44 dynamic Auralis Collections**
- 24 dedicated genre worlds
- 16 mood-based discovery worlds
- 8 Essentials / era routes including Timeless Rock, Hip-Hop Canon, 2000s Anthems, Bollywood Route, Indie Classics, Electronic Legends, Jazz Standards and Screen Legends
- Multi-provider search and de-duplication
- Expandable Trending shelf
- `Show more` / `Load more` pagination across search, discovery and radio
- Collection categories: Discovery, Essentials, Genres, Moods, Focus, Energy and Night

Collections are live search/discovery recipes, not hard-coded copies of commercial albums or playlists. Results depend on what the active open catalogs can legally expose at that moment.

### Playback

- Full audio player with play/pause, seek, next/previous, volume, shuffle and repeat
- artwork/title/artist block is directly clickable in track lists
- keyboard-accessible track-list playback targets
- live-radio aware player state
- automatic stream failure detection and queue failover
- provider/source badges
- queue drawer with removal and clear actions
- Media Session API support
- liked items and recently played history persisted locally

### Product/UI

- Premium responsive desktop/tablet/mobile design
- existing Auralis hero preserved and expanded
- dedicated Collections, Genres, Moods and Live Radio views
- Radio Universe visual hierarchy
- generated radio-logo fallbacks
- provider health/status cards
- responsive world cards and station cards
- PWA application-shell cache with network-first navigation
- offline/demo fallback audio

## Architecture

```text
                                  AURALIS
                                     │
                            Catalog Manager
                                     │
          ┌──────────────────────────┼──────────────────────────┐
          │                          │                          │
       Audius                    Jamendo                 Radio Browser
  full-stream catalog      full-stream catalog            live radio
          │                          │                          │
          └──────────────┬───────────┘                          │
                         │                                      │
                normalize + de-dupe                 country/language ranking
                         │                                      │
                         └──────────────────┬───────────────────┘
                                            │
                                    Auralis Player
                                            │
             ┌──────────────────────────────┼──────────────────────────────┐
             │                              │                              │
          Search                       Collections                     Radio Universe
             │                              │                              │
      Load-more paging              Genres + Moods             India + language + world
```

### Provider-management layer

`js/providers/catalog-manager.js` is the central song-provider coordinator. It:

- registers active provider adapters
- tracks provider health
- runs providers concurrently
- normalizes pagination
- interleaves results
- de-duplicates obvious cross-catalog duplicates
- keeps track-search providers separate from live-radio sources

| Provider | Status | Role |
| --- | --- | --- |
| Audius | Active | Primary full-stream catalog, search, trending and discovery |
| Jamendo | Active demo integration | Independent full-track catalog and genre discovery |
| Radio Browser | Active | Live worldwide radio through `/api/radio` |
| SoundCloud | Staged | Requires registered app + OAuth credentials before activation |
| Supabase Project Hub | App #1 boundary registered | Auth, profiles, cloud likes/history and playlists are the backend phase |

The Jamendo adapter currently uses Jamendo's documented read-API test client for this college/demo build. A dedicated Jamendo developer `client_id` should be configured before treating the app as a production service.

## Project structure

```text
auralis-music/
├── AGENTS.md
├── SUPABASE_HUB_RULES.md
├── api/
│   └── radio.js                  # Radio Browser proxy + mirror/ranking logic
├── assets/
│   ├── covers/
│   └── icon.svg
├── js/
│   ├── providers/
│   │   ├── audius.js
│   │   ├── jamendo.js
│   │   ├── radio-browser.js
│   │   └── catalog-manager.js
│   ├── app-v3.js                # Catalog Universe controller
│   ├── row-play-targets.js      # clickable rows + v4 guest/radio enhancements
│   ├── app-v2.js                # previous release retained for rollback
│   ├── library-map.js           # genre + mood taxonomy
│   ├── collections.js           # 44 dynamic collection definitions
│   ├── store.js
│   └── fallback.js
├── tests/
│   └── smoke.py
├── .github/workflows/
│   └── smoke.yml
├── index.html
├── styles.css
├── fixes.css
├── experience.css
├── experience-v3.css
├── experience-v4.css
├── manifest.webmanifest
├── sw.js
└── vercel.json
```

## Run locally

No build step is required for the frontend.

```bash
python -m http.server 4173
```

Then open `http://localhost:4173`.

> The live-radio Vercel function is only available on Vercel unless you run the project with Vercel's local runtime.

## Keyboard controls

| Shortcut | Action |
| --- | --- |
| `/` | Focus search |
| `Space` | Play / pause |
| `Alt + →` | Next item |
| `Alt + ←` | Previous item |
| `Enter` / `Space` on a track title | Play that track |

## Validation

```bash
node --check js/app-v3.js
node --check js/row-play-targets.js
node --check js/collections.js
node --check js/library-map.js
node --check js/providers/audius.js
node --check js/providers/jamendo.js
node --check js/providers/radio-browser.js
node --check js/providers/catalog-manager.js
node --check api/radio.js
python tests/smoke.py
```

GitHub Actions runs these checks automatically on pull requests and `main` pushes.

## Deployment

Auralis deploys directly to Vercel. `main` triggers production while branches and pull requests create preview deployments.

Production: **https://auralis-music-lime.vercel.app**

## Supabase Project Hub boundary

Auralis is registered as **App #1** in the shared Supabase `Project Hub`, with the isolated schema:

```text
auralis.*
```

Before any database write, agents must read `AGENTS.md`, `SUPABASE_HUB_RULES.md` and `hub.read_me_first`, then pass:

```sql
select hub.assert_app_scope('auralis', 'auralis');
```

Auralis must never modify another application's schema or shared Hub infrastructure unless the user explicitly approves that exact cross-project change.

At present Auralis remains usable without Auth. The Project Hub boundary is preparation for optional accounts, cloud likes/history and playlists later.

## Music & rights

Auralis does not scrape, download or re-host commercial recordings. Playback is requested from provider streams those providers expose for off-platform use. Availability can change based on creator permissions, geography, catalog rules or provider policies.

Live radio is resolved from Radio Browser's open station directory. Individual station streams remain controlled by their station operators. A famous broadcast brand is not promoted merely because it is famous: Auralis also requires a currently healthy browser-playable HTTPS stream.

The built-in fallback audio is synthesized in-browser and is not copied from a commercial recording.

## Roadmap

- Supabase authentication and optional cloud-synced library UI
- Account-backed playlists
- Cloud liked songs and listening history
- Artist and album detail pages
- SoundCloud adapter after credential approval
- Optional MusicBrainz metadata enrichment
- Better cross-provider entity matching
- Personalized recommendation engine
- Collaborative playlists
- Lyrics integration where licensing permits
- Shareable listening rooms
- Listening statistics

## License

The Auralis application source code is released under the [MIT License](LICENSE). Third-party music, station streams and metadata remain subject to their respective provider/operator terms.
