# Auralis Music Graph v9 — Provider Architecture

Auralis v9 separates **music identity**, **discovery**, and **playback**. An API result is no longer treated as the song itself; each provider contributes one capability to a normalized Auralis experience.

## Safety boundary

This release is repository/Vercel-only. It does not modify Supabase, Project Hub, or any other application. Existing Auralis radio and open-catalog playback remain intact.

## Active anonymous sources

| Provider | Role | Playback |
| --- | --- | --- |
| Audius | open full-track search/trending | full where streamable |
| Jamendo | independent catalog | full tracks exposed by Jamendo |
| Radio Browser | worldwide live radio | live streams after Auralis health checks |
| Deezer | broad commercial catalog, charts, albums, artists, artwork | clearly-labelled 30-second previews where returned |
| MusicBrainz | canonical recording/release identity | metadata only |
| Cover Art Archive | canonical release artwork fallback | artwork only |

## Credential-ready adapters

These providers are represented in Source Pulse but remain disabled until official credentials are configured.

- **YouTube Data API + IFrame** — broad official video-search/playback fallback. Requires `YOUTUBE_API_KEY`. Auralis uses the official visible IFrame; no audio extraction/downloader route is allowed.
- **SoundCloud** — track/playlists/full playback where the creator permits off-platform playback. Requires an approved SoundCloud app.
- **Audiomack** — songs/albums/playlists and stream-source API. Requires official OAuth consumer credentials.
- **Last.fm** — charts, similar tracks/artists, tags and geographic discovery. Requires `LASTFM_API_KEY`.
- **Spotify** — optional connected catalog/playback. Browser playback requires the user's eligible Spotify account/Premium capabilities.
- **Apple Music** — optional connected MusicKit catalog/playback. Requires Apple developer/user authorization.

## Universal Track model

Auralis Graph track records may contain:

- `graphId`
- title / artist / album
- provider + provider ID
- duration / explicit / rank
- artwork + canonical artwork fallback
- preview/full-playback availability
- MusicBrainz recording ID (MBID)
- ISRC
- MusicBrainz release-group ID
- source links / fallback routes

This lets Auralis show one coherent song card while different providers supply identity, artwork, previews, full streams, or official embedded playback.

## Playback priority

Current v9 UI follows this rule:

1. Existing legal full-track Auralis sources (Audius/Jamendo) when an exact playable match is found.
2. Provider-specific full playback once an official adapter is credentialed and available.
3. Official YouTube embedded playback when configured.
4. Clearly-labelled commercial-catalog preview when that is the only in-app route.
5. External official-service links as a final availability map.

Auralis never claims a 30-second preview is a full track.

## Provider Control Plane / Source Pulse

`/api/providers` reports source health and capability state:

- online / degraded
- client-side active
- configured
- needs credentials
- latency
- last check time
- provider capabilities

The UI polls Source Pulse periodically. The architecture is ready for future quota counters, circuit breakers and version notices without coupling the main UI to any one provider.

## Local playlists

v9 introduces provider-independent local playlists stored under `auralis:playlists:v2`. They can contain normalized Graph items from different catalog sources. This is deliberately local-only for this release so Project Hub/Supabase is not touched.

Cloud playlist synchronization can later be added only inside the registered `auralis.*` schema after the existing Project Hub safety checks.

## public-apis/public-apis policy

`public-apis/public-apis` is used as an API discovery index, **not** as an automatic trust list. Every activated provider must still pass:

1. official/credible API verification,
2. HTTPS/browser compatibility,
3. clear playback/usage semantics,
4. graceful health/failure behavior,
5. no dependency on downloader/scraper endpoints for copyrighted streams.

## Goal

The realistic v9 objective is:

> Make almost every mainstream song/album **discoverable**, attach as much canonical metadata/artwork as possible, and resolve the best legitimate playback route available to the current user.

This is intentionally different from promising unrestricted anonymous full streaming of every copyrighted commercial recording.
