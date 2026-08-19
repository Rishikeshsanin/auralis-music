# Auralis 🎧

> A polished, responsive open-catalog music experience with real discovery, playback, queueing, likes, history, mood browsing, and a premium Spotify-inspired interface.

[![Smoke Test](https://github.com/Rishikeshsanin/auralis-music/actions/workflows/smoke.yml/badge.svg)](https://github.com/Rishikeshsanin/auralis-music/actions/workflows/smoke.yml)
[![Live on Vercel](https://img.shields.io/badge/Live-Vercel-000000?logo=vercel)](https://auralis-music-lime.vercel.app)
[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](LICENSE)

**Live demo:** https://auralis-music-lime.vercel.app

## Why Auralis

Auralis is not a static Spotify mockup. The interface is backed by a provider layer that can search and stream real tracks from programmable music catalogs. The first adapter uses Audius, while the rest of the player stays provider-agnostic so additional legal catalogs can be added later without rebuilding the UI or playback system.

## Highlights

- Real music search and trending discovery through Audius
- Full audio player with play/pause, seek, next/previous, volume, shuffle and repeat
- Queue drawer with removal and clear actions
- Liked songs and recently played history persisted locally
- Mood and genre discovery flows
- Media Session API support for browser/OS media controls
- Responsive desktop, tablet and mobile layouts
- Mobile bottom navigation and compact player controls
- PWA manifest and offline application-shell caching
- Graceful offline/provider fallback with original synthesized demo audio
- Provider abstraction under `js/providers/`
- Vercel security headers and clean URLs
- GitHub Actions smoke testing on pushes and pull requests
- Zero framework dependency in v1 for a small, transparent frontend surface

## Architecture

```text
                         AURALIS
                            │
                    Provider Interface
                            │
                 ┌──────────┴──────────┐
                 │                     │
              Audius              Future providers
                 │                     │
                 └──────────┬──────────┘
                            │
                    Normalized tracks
                            │
              ┌─────────────┼─────────────┐
              │             │             │
           Player         Queue       Discovery
              │
       Local library store
        ├── Liked songs
        ├── History
        └── Volume
```

## Project structure

```text
auralis-music/
├── assets/
│   ├── covers/              # Original demo artwork
│   └── icon.svg
├── js/
│   ├── providers/
│   │   └── audius.js        # Music-provider adapter
│   ├── app.js               # Player, search, queue and UI controller
│   ├── fallback.js          # Built-in fallback catalog
│   └── store.js             # Local likes/history state
├── tests/
│   └── smoke.py
├── .github/workflows/
│   └── smoke.yml
├── index.html
├── styles.css
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

Run the repository smoke test with:

```bash
python tests/smoke.py
```

The test validates required project files, local HTML references, DOM IDs used by the JavaScript controller, the fallback audio path, the manifest, and Vercel configuration.

## Deployment

Auralis is a static application and deploys directly to Vercel. The checked-in `vercel.json` enables clean URLs and adds basic security headers.

The GitHub repository is connected directly to the Vercel project: pushes to `main` trigger production deployments, while branch and pull-request pushes can create preview deployments.

Production: **https://auralis-music-lime.vercel.app**

## Music & rights

Auralis does not scrape, download, or re-host commercial recordings. Live catalog playback is requested from the active provider and remains subject to the permissions and terms associated with each track and provider. The built-in fallback audio is synthesized locally in the browser and is not copied from any commercial recording.

## Roadmap

- Supabase authentication and cloud-synced libraries
- Account-backed playlists
- Additional legal music provider adapters
- Artist and album detail pages
- Better multi-provider search ranking and de-duplication
- Collaborative playlists
- Recommendation engine based on listening history
- Lyrics integration where licensing permits
- Shareable listening rooms
- Listening statistics and personalized discovery

## License

The Auralis application source code is released under the [MIT License](LICENSE). Third-party music and metadata remain subject to their respective provider and creator terms.
