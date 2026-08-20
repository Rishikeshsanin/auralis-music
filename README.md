# Auralis 🎧

> A polished, responsive multi-catalog music discovery platform with full-track catalogs, live radio, expandable provider adapters, dynamic collections, genre/mood worlds, queueing, likes, history, and a premium interface.

[![Smoke Test](https://github.com/Rishikeshsanin/auralis-music/actions/workflows/smoke.yml/badge.svg)](https://github.com/Rishikeshsanin/auralis-music/actions/workflows/smoke.yml)
[![Live on Vercel](https://img.shields.io/badge/Live-Vercel-000000?logo=vercel)](https://auralis-music-lime.vercel.app)
[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](LICENSE)

**Live demo:** https://auralis-music-lime.vercel.app

## Why Auralis

Auralis is not a static Spotify mockup. It has a provider-management layer that normalizes several types of audio sources into one player and one discovery experience.

- **Audius** is the primary open full-stream music backbone.
- **Jamendo** adds an independent full-track catalog.
- **Radio Browser** adds live worldwide radio through a small same-origin Vercel API proxy.
- Future credentialed providers can be added as adapters without rewriting the player, queue or browse system.

The product is built around discovery rather than copying Spotify's exact information architecture: **36 dynamic collections, 24 genre worlds, 16 mood worlds, live radio, expandable shelves and one unified player.**

## Catalog Universe v3

### Discovery

- 36 dynamic Auralis Collections
- 24 dedicated genre worlds
- 16 mood-based discovery worlds
- Multi-provider search and de-duplication
- Expandable Trending shelf
- `Show more` / `Load more` pagination across search, discovery and radio
- Collection categories: Discovery, Genres, Moods, Focus, Energy and Night
- Live worldwide radio search and genre tags

### Playback

- Full audio player with play/pause, seek, next/previous, volume, shuffle and repeat
- Live-radio aware player state
- Automatic stream failure detection and queue failover
- Provider/source badges
- Queue drawer with removal and clear actions
- Media Session API support
- Liked items and recently played history persisted locally

### Product/UI

- Premium responsive desktop/tablet/mobile design
- Existing Auralis hero preserved and expanded
- Dedicated Collections, Genres, Moods and Live Radio views
- Provider health/status cards
- Responsive world cards and radio station cards
- PWA application-shell cache with network-first navigation
- Offline/demo fallback audio

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
                normalize + de-dupe                       live normalize
                         │                                      │
                         └──────────────────┬───────────────────┘
                                            │
                                    Auralis Player
                                            │
                  ┌─────────────────────────┼─────────────────────────┐
                  │                         │                         │
               Search                  Collections               Queue/Library
                  │                         │
           Load more paging        Genres + Moods
```

### Provider-management layer

`js/providers/catalog-manager.js` is the central provider coordinator. It:

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
│   └── radio.js                  # Radio Browser proxy + mirror failover
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
│   ├── app-v2.js                # previous release retained for rollback
│   ├── library-map.js           # genre + mood taxonomy
│   ├── collections.js           # 36 dynamic collection definitions
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

## Validation

```bash
node --check js/app-v3.js
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

## Music & rights

Auralis does not scrape, download or re-host commercial recordings. Playback is requested from provider streams those providers expose for off-platform use. Availability can change based on creator permissions, geography, catalog rules or provider policies.

Live radio is resolved from Radio Browser's open station directory. Individual station streams remain controlled by their station operators.

The built-in fallback audio is synthesized in-browser and is not copied from a commercial recording.

## Roadmap

- Supabase authentication and cloud-synced library UI
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
