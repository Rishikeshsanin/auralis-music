# Auralis 🎧

> A polished multi-provider music platform for discovery, full-song playback, live radio, playlists, likes, queueing, artists/albums, provider health, and artwork-driven Aura Mode — all behind one Auralis UI.

[![Smoke Test](https://github.com/Rishikeshsanin/auralis-music/actions/workflows/smoke.yml/badge.svg)](https://github.com/Rishikeshsanin/auralis-music/actions/workflows/smoke.yml)
[![Live on Vercel](https://img.shields.io/badge/Live-Vercel-000000?logo=vercel)](https://auralis-music-lime.vercel.app)
[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](LICENSE)

**Production:** https://auralis-music-lime.vercel.app  
**Current release:** **Auralis v10.2 — Artwork, Catalog & Playback Stabilization**  
**Release PR:** [#28](https://github.com/Rishikeshsanin/auralis-music/pull/28)

## What Auralis is

Auralis is not a static Spotify clone. It combines legitimate music sources while keeping discovery, metadata, playback, live radio, provider health, user-library features and visual theming as separate layers.

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

## v10.2 highlights

v10.2 is a stabilization release built on the approved v10.1.6 product. It focuses on the areas users notice immediately: artwork, playable catalog reliability, collection depth, queue ownership and clean transitions between playback sources.

### Artwork that follows the track everywhere

Artwork is normalized once and then reused across Home, Discover, Collections, Genres/Moods, Search, Queue, Liked Songs, Recently Played and the bottom player.

Audius artwork now prefers its direct **480×480** card-sized cover first while keeping 1000×1000, 150×150 and alternate mirror hosts as immediate fallbacks. Canonical Music Graph recovery remains available when provider artwork genuinely fails.

The important v10.2 rules are:

1. original provider artwork first
2. provider-specific alternate artwork URLs
3. canonical Music Graph / MusicBrainz / Cover Art recovery where appropriate
4. quiet themed initial only when legitimate artwork cannot be recovered

Auralis no longer presents a synthetic record/wave graphic as if it were real album art.

Player artwork is keyed by track identity, so play/pause state changes no longer rebuild the full shelf or unnecessarily reload posters. Aura Mode continues to derive its palette from the actual active artwork.

### Audius playback recovery

A temporary Audius stream failure no longer immediately skips a song. Auralis makes bounded fresh stream attempts before applying queue fallback.

This protects tracks such as **Smokestax — Get Down** from single-host or stale-route failures while still allowing the queue to move on when a source is genuinely unavailable.

Repeated failures are bounded so users do not receive a stack of duplicate “stream skipped” notifications.

### Fresh Drops and live collection pagination

Source-specific collections keep their genuine specialist results first, but a sparse endpoint no longer means a four-song collection.

For example, **Fresh Drops** can preserve its real Audius best-new-release results and then fill the remaining page from a semantically related live Audius route. Pagination deduplicates by canonical track identity and keeps the existing **Load more tracks** flow.

The same partial-page contract applies to source-specific collection families where appropriate. Demo tracks remain only an emergency/offline fallback; they are not used merely because a live specialist endpoint returns a small batch.

### One playback owner at a time

Auralis now coordinates the sound-producing paths explicitly:

- Audius / Jamendo direct playback
- live radio
- Deezer / Music Graph previews
- official YouTube Full Playback
- legacy YouTube lookup paths
- mixed-provider unified queue transitions

Only one source may be audible at a time.

If a full/direct song is interrupted by a Preview:

- the existing song pauses in place
- the Preview becomes the sole audible owner
- the bottom player follows the Preview title / artist / artwork
- when the Preview ends, the interrupted song context is restored
- the interrupted song remains **paused** at its preserved position
- it never auto-resumes without the user pressing Play

Starting Full Song, another direct track or radio cancels an in-flight Preview cleanly.

### Expiring preview protection

Deezer preview URLs can be short-lived signed resources. v10.2 therefore keeps track/chart preview caching short and adds a no-store track refresh endpoint for an individual preview when its signed URL is near expiry.

Preview startup has an explicit lifecycle:

```text
requested → started → ended / failed / cancelled
```

Monotonic request IDs prevent delayed or superseded preview refreshes from beginning playback after the user has already selected something else.

### Mixed-provider queue ownership

Core/direct playback and official YouTube Full Playback emit cancelable queue-navigation and ended events. The unified Auralis queue becomes the deterministic owner of Next / Previous / end-of-item transitions when a mixed queue is active.

This prevents individual playback engines from independently advancing and losing the correct queue index.

### Performance cleanup

v10.2 removes several fragile or expensive presentation patterns:

- no full Trending shelf rebuild on simple play/pause changes
- no temporary `innerHTML` monkey patch used to protect artwork DOM
- no permanent 500 ms video presentation polling
- class-only whole-page mutation rescans were removed from the stabilized paths
- artwork retries are centralized instead of repeatedly hammering catalog recovery

The result keeps the v10.1.5/v10.1.6 smoothness work while restoring fast, stable real artwork.

## Full Song + Video mode

Auralis resolves eligible tracks through the server-side YouTube resolver and plays them with the official YouTube IFrame Player.

Final behavior:

- **Full song** opens the floating video player by default.
- The normal bottom player remains compact.
- The **Video** control sits beside Repeat.
- `×` hides only the video window; the song continues playing.
- Pressing **Video** restores the same active player.
- Starting a different Full Song shows the video again by default.
- On desktop the floating player can be moved and resized.
- Play/pause, seek, volume, queue, artwork and Aura remain bridged to Auralis.

Auralis deliberately does **not** use `yt-dlp`, `youtube-dl`, MP3 extraction, downloader APIs, or hidden YouTube audio extraction.

## Music Graph / Universe

The Auralis Music Graph separates identity, discovery and playback while presenting one catalog experience.

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

Universe includes tracks, albums, artists, alternate-version discovery, Music Graph detail views, artist mixes, previews, full-song actions, likes, queue actions and deeper pagination.

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

The resolver prioritizes title + artist, uses album context as fallback, requests embeddable/syndicated candidates, checks duration/status, favors official/Topic/label-style sources and penalizes covers, karaoke, nightcore, reactions, tutorials and wrong variants.

`YOUTUBE_API_KEY` remains server-side.

## Auralis playlists and likes

Auralis stays guest-first and local-first.

Current capabilities include:

- create/name/describe playlists
- add/remove mixed-provider tracks
- like normal catalog tracks and Music Graph/API tracks
- local Recently Played
- unified queue
- optional full-source resolution at playback time

Playlist storage key:

```text
auralis:playlists:v2
```

Cloud sync may be added later without becoming a playback gate.

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

Regional lanes include English, Hindi, Telugu, Kannada, Tamil, Malayalam and Konkani.

## Aura Mode

Aura Mode is an optional artwork-driven full-site theme system. It derives a palette from the active artwork and applies it to ambient fields, player surfaces, glass/navigation states, cards, borders, controls and glows.

Artwork itself is not stretched into a full-page background. Preview/full/direct transitions keep Aura tied to the actual active playback artwork.

## Stability v10 foundation

v10.2 remains layered on Stability v10 rather than replacing it.

The stability layer includes:

- Service Worker v18
- returning-user migration
- network-first version-sensitive runtime assets
- safe activation during playback
- no localStorage / IndexedDB user-data wipe
- observer-loop hardening
- playback-recovery protections

Local playlists, likes, history, profile preferences, Aura preferences and resolver cache remain preserved across updates.

## API endpoints

### Universal catalog

```text
GET /api/catalog?mode=search&q=Blinding%20Lights&kind=track
GET /api/catalog?mode=search&q=After%20Hours&kind=album
GET /api/catalog?mode=search&q=The%20Weeknd&kind=artist
GET /api/catalog?mode=chart
GET /api/catalog?mode=track&id=<deezer_track_id>
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

GitHub Actions performs JavaScript/MJS syntax checks plus the layered regression suite, including:

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
python tests/performance_v1015.py
python tests/artwork_delivery_v102.py
python tests/playback_collection_v102.py
python tests/stabilization_v102.py
node tests/preview_race_v102.mjs
node tests/sw_lifecycle_v10.mjs
```

The v10.2 release candidate passed the complete regression gate and dedicated delayed-preview ownership tests before merge.

## Project boundaries / Supabase Hub

Auralis is App #1 in the shared Supabase Project Hub, but **v10.2 makes no Supabase changes**.

Repository agents must read:

- `AGENTS.md`
- `SUPABASE_HUB_RULES.md`

No Auralis task may modify another application's schema/resources or shared project-level configuration.

## Security

- API keys stay in Vercel environment variables.
- `YOUTUBE_API_KEY` is consumed only server-side by `/api/youtube`.
- Browser code receives only resolved public metadata.
- No service-role key or provider secret belongs in GitHub.
- User libraries/preferences are not wiped as part of runtime upgrades.

## Release history

- **v10.2** — artwork, catalog and playback stabilization
- **v10.1.6** — visible artwork loading refinement
- **v10.1.5** — performance hotfix
- **v10.1.4** — artwork stability hotfix
- **v10.1** — Player + Universe product release
- **v10** — returning-user/service-worker stability release
- **v9.2.2** — MutationObserver freeze hotfix
- **v9.1** — official YouTube full playback
- **v9** — Music Graph
- **v6–v8** — radio reliability, experience and Aura foundations

## Roadmap

Next work should continue the same principle: **quality before provider count**.

Potential later additions include Last.fm recommendation intelligence, a registered SoundCloud adapter, credentialed Audiomack, optional Spotify / Apple Music connected accounts and optional Supabase cloud library sync.

**Quality > quantity.** New providers or features should materially improve the Auralis experience rather than simply increase the number of integrations.

## License

MIT — see [LICENSE](LICENSE).
