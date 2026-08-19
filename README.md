# Auralis 🎧

Auralis is a polished, responsive web music player built around open, programmable music catalogs. The first provider adapter uses the Audius REST API for real track discovery and streaming, while the UI remains provider-agnostic so additional legal music sources can be added without rebuilding the player.

## Highlights

- Real music search and trending discovery through Audius
- Persistent bottom player with play/pause, seek, next/previous, shuffle and repeat
- Queue drawer with removal and clear actions
- Liked songs and listening history saved locally
- Mood and genre discovery flows
- Media Session API support for OS/browser media controls
- Responsive desktop, tablet and mobile layouts
- PWA shell with offline UI caching
- Graceful demo fallback with original generated audio if the external catalog is unreachable
- Zero frontend framework dependency for the MVP: fast load, tiny surface area, simple deployment

## Architecture

```text
Browser UI
   ├── Player + Queue
   ├── Local library store
   ├── Provider interface
   │      └── Audius REST API
   └── PWA service worker
```

The provider boundary lives in `js/providers/`. A future SoundCloud, Jamendo, self-hosted artist catalog, or licensed catalog can normalize results to the same track shape and reuse the existing interface/player.

## Run locally

Any static web server works. For example:

```bash
python -m http.server 4173
```

Then open `http://localhost:4173`.

> Do not open `index.html` directly with `file://`; ES modules and service workers require HTTP(S).

## Keyboard controls

- `/` focus search
- `Space` play / pause
- `Alt + →` next track
- `Alt + ←` previous track

## Deployment

Auralis is static and can be deployed directly to Vercel. `vercel.json` adds basic security headers and clean URLs.

## Music & rights

Auralis does not scrape, download, or re-host commercial recordings. Live catalog playback is requested from the active provider and remains subject to the creator/provider permissions attached to each track. The fallback audio is synthesized locally in the browser and is not copied from any commercial recording.

## Roadmap

- Supabase authentication and cloud-synced playlists
- Additional music provider adapters
- Artist and album detail routes
- Collaborative playlists
- Recommendation engine based on listening history
- Lyrics integration where licenses permit
- Shareable listening rooms
- Automated tests and performance budgets

## License

The application source code is MIT licensed. Third-party music and metadata remain subject to their respective provider and creator terms.
