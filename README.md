# Auralis 🎧

> A polished, responsive multi-catalog music experience with real discovery, full-track playback, dynamic collections, queueing, likes, history, and a premium Spotify-inspired interface.

[![Smoke Test](https://github.com/Rishikeshsanin/auralis-music/actions/workflows/smoke.yml/badge.svg)](https://github.com/Rishikeshsanin/auralis-music/actions/workflows/smoke.yml)
[![Live on Vercel](https://img.shields.io/badge/Live-Vercel-000000?logo=vercel)](https://auralis-music-lime.vercel.app)
[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](LICENSE)

**Live demo:** https://auralis-music-lime.vercel.app

## Why Auralis

Auralis is not a static Spotify mockup. It normalizes playable tracks from programmable music catalogs into one player and one discovery experience. Audius is the primary open-streaming backbone and Jamendo adds an independent full-track catalog. The provider layer stays modular so future credentialed providers can be added without rebuilding the player or library model.

## Highlights

- Multi-catalog search across Audius + Jamendo with basic de-duplication
- 16 dynamic Auralis Collections, including Fresh Drops, Under the Radar, Remix Radar, Night Drive, Deep Focus, Jazz Room and Classical Space
- Expanded Audius discovery endpoints: trending, new releases, most-loved, remixables, under-the-radar and recommendations with search fallbacks
- Jamendo full-track streaming adapter for independent music discovery
- Full audio player with play/pause, seek, next/previous, volume, shuffle and repeat
- Queue drawer with removal and clear actions
- Provider/source badges throughout the player and track lists
- Liked songs and recently played history persisted locally
- Mood and genre discovery flows
- Media Session API support for browser/OS media controls
- Responsive desktop, tablet and mobile layouts
- Dedicated Collections view and multi-provider catalog status UI
- PWA manifest and offline application-shell caching
- Graceful provider fallback with original synthesized demo audio
- Vercel security headers and clean URLs
- GitHub Actions with JavaScript syntax checks + smoke tests on pull requests
- Shared Supabase Project Hub safety contract committed in `AGENTS.md` and `SUPABASE_HUB_RULES.md`

## Architecture

```text
                               AURALIS
                                  │
                         Unified Catalog Layer
                                  │
                  ┌───────────────┴───────────────┐
                  │                               │
               Audius                         Jamendo
        open full-stream catalog      independent full-track catalog
                  │                               │
                  └───────────────┬───────────────┘
                                  │
                      Normalize + de-duplicate
                                  │
                 ┌────────────────┼────────────────┐
                 │                │                │
              Search         Collections        Player
                                                   │
                                             Queue / Likes
                                                   │
                                      Local store → Supabase next
```

### Provider strategy

| Provider | Status | Role |
| --- | --- | --- |
| Audius | Active | Primary full-stream catalog, search and discovery |
| Jamendo | Active demo integration | Independent full-track catalog and genre collections |
| SoundCloud | Staged | Requires registered app + OAuth credentials before activation |
| Supabase Project Hub | Backend staged | Auth, profiles, cloud likes/history and playlists |

The Jamendo adapter currently uses Jamendo's documented read-API test client for this college/demo build. Before treating Auralis as a production service, configure a dedicated Jamendo developer `client_id`.

## Project structure

```text
auralis-music/
├── AGENTS.md                    # AI/agent boundary for shared Supabase Hub
├── SUPABASE_HUB_RULES.md        # Project Hub isolation rules
├── assets/
│   ├── covers/
│   └── icon.svg
├── js/
│   ├── providers/
│   │   ├── audius.js            # Audius adapter + discovery endpoints
│   │   └── jamendo.js           # Jamendo full-track adapter
│   ├── app-v2.js                # Multi-catalog player/search/UI controller
│   ├── collections.js           # Dynamic collection definitions
│   ├── app.js                   # Previous v1 controller retained for rollback
│   ├── fallback.js              # Built-in fallback catalog
│   └── store.js                 # Local likes/history state
├── tests/
│   └── smoke.py
├── .github/workflows/
│   └── smoke.yml
├── index.html
├── styles.css
├── fixes.css
├── experience.css
├── manifest.webmanifest
├── sw.js
└── vercel.json
```

## Run locally

No build step is required.

```bash
python -m http.server 4173
```

Then open `http://localhost:4173`.

> Do not open `index.html` directly with `file://`; ES modules and service workers require HTTP(S).

## Keyboard controls

| Shortcut | Action |
| --- | --- |
| `/` | Focus search |
| `Space` | Play / pause |
| `Alt + →` | Next track |
| `Alt + ←` | Previous track |

## Validation

Run:

```bash
node --check js/app-v2.js
node --check js/collections.js
node --check js/providers/audius.js
node --check js/providers/jamendo.js
python tests/smoke.py
```

GitHub Actions runs these checks automatically on pull requests and `main` pushes.

## Deployment

Auralis deploys directly to Vercel. The GitHub repository is connected to the Vercel project: pushes to `main` trigger production deployments while branches and pull requests create preview deployments.

Production: **https://auralis-music-lime.vercel.app**

## Supabase Project Hub boundary

Auralis will use the shared Supabase `Project Hub` as **App #1**, with an assigned application schema of `auralis`.

Before any database write, agents must read `AGENTS.md` and `SUPABASE_HUB_RULES.md`. Auralis must never modify another application's schema or shared Hub infrastructure unless the user explicitly approves that exact cross-project change.

## Music & rights

Auralis does not scrape, download or re-host commercial recordings. Playback is requested from provider streams that those providers expose for off-platform use. Availability can still change based on creator permissions, geography, catalog rules or provider policies. The built-in fallback audio is synthesized in-browser and is not copied from a commercial recording.

## Roadmap

- Register Auralis as App #1 in Supabase Project Hub
- Supabase authentication and cloud-synced libraries
- Account-backed playlists
- Cloud liked songs and listening history
- Artist and album detail pages
- SoundCloud provider after credential setup
- Better provider ranking and de-duplication
- Collaborative playlists
- Recommendation engine based on listening history
- Lyrics integration where licensing permits
- Shareable listening rooms
- Listening statistics and personalized discovery

## License

The Auralis application source code is released under the [MIT License](LICENSE). Third-party music and metadata remain subject to their respective provider and creator terms.
