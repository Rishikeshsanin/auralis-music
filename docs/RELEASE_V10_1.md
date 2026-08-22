# Auralis v10.1 — Player + Universe Release

**Status: Merged to `main`; production promotion pending Vercel build quota**  
Release branch: `release/player-universe-v10-1`  
Production target: `main` → Vercel  
Release date: 2026-08-22

## Summary

Auralis v10.1 builds on Stability v10 without replacing the existing provider, playback, radio, Aura, playlist, or update-migration architecture. The release focuses on making Auralis feel like one coherent music product across open-stream tracks, Music Graph/API tracks, YouTube full playback, playlists, queueing, likes, artists, and artwork recovery.

## Finalized video/full-playback behavior

YouTube full playback continues to use the official YouTube IFrame Player API.

The final interaction model is:

1. Start **Full song**.
2. The floating Auralis video player opens by default.
3. The normal bottom Auralis player remains compact.
4. Press `×` on the video window to hide only the visual window; playback continues.
5. Press **Video** beside Repeat to restore the video window.
6. On desktop, the floating video window can be moved and resized.
7. Starting a different Full song shows the video again by default.

The `×` action is intentionally a visibility action while full playback is active; it does not destroy the YouTube player or stop the track.

Auralis does not use downloader APIs, hidden audio extraction, `yt-dlp`, or `youtube-dl`.

## Unified queue

Queue controls now work across the broader Auralis catalog, including:

- direct/open-stream tracks
- Music Graph/API search results
- YouTube-resolved full songs
- album rows
- playlist rows
- radio where applicable

The existing queue remains the single user-facing queue instead of creating provider-specific queue systems.

## Likes across the Music Graph

Music Graph/API songs can now be liked from the relevant cards/rows/details and surfaced inside **Liked songs**.

Existing local collection likes remain supported and are not migrated away or cleared.

## Search and discovery polish

- **Full song** is promoted as a strong primary action where available.
- 30-second preview labeling no longer sits over album artwork.
- Preview duration guidance appears around the Preview action instead of covering the poster.
- Compact search results expose a clear **View more results** path into Universe.
- Existing Universe pagination remains available for deeper browsing and alternate versions.

## Artist playlist/mix

Artist detail pages now expose an Auralis artist mix built from the available artist track data.

Users can:

- play the mix
- queue the mix

This turns artist pages into actionable listening surfaces rather than metadata-only views.

## Playlist creation UX

The playlist dialog has been polished with Auralis list iconography and improved visual treatment.

A validation bug was fixed: **Cancel**, `×`, and `Esc` now work even if the required playlist name field is empty. Required-field validation applies only when the user actually submits Create.

## Artwork reliability

Artwork now follows a stronger recovery chain:

1. provider artwork
2. provider-specific alternate/mirror artwork when available
3. canonical Music Graph/catalog lookup using strict title + artist matching
4. Auralis branded Aura-aware fallback only when no legitimate artwork can be recovered

The branded fallback is intentionally album-art-like and track-specific rather than a plain giant initial block.

Artwork recovery is scoped to visible/active surfaces to avoid unnecessary hidden-view catalog traffic.

## Stability safeguards

v10.1 inherits Stability v10 and keeps its returning-user migration and no-freeze protections.

Important safeguards retained:

- Service Worker v18 lifecycle/update manager
- no localStorage/IndexedDB user-data wipe
- guarded/coalesced DOM observer work
- playback recovery layer
- Source Pulse startup flash fix
- provider failures remain isolated
- no cross-project or Supabase Project Hub changes

## Provider architecture preserved

The release preserves the established provider roles:

- YouTube Data API + official IFrame Player — full playback/video
- Audius — open full-track catalog where streamable
- Jamendo — independent full-track catalog
- Deezer — discovery + clearly labelled 30-second previews
- MusicBrainz — canonical identity/metadata
- Cover Art Archive — artwork fallback
- Radio Browser — verified worldwide live radio
- hls.js — HLS compatibility

Missing optional provider credentials must not take down the rest of Auralis.

## Test gate

The release is covered by the existing layered regression suite plus v10.1 product tests, including:

- base smoke tests
- Radio v6
- Experience/Aura v7+
- Music Graph v9
- Full Playback v9.1
- UX v9.2
- Playback Recovery v9.2.1
- Stability v10
- Player + Universe v10.1
- Product polish / video-artwork refinements
- Service Worker lifecycle simulation

The final pre-release branch gate passed before promotion to `main`.

## Data and backend boundaries

This release does **not** require Supabase changes.

It does not modify:

- other Project Hub application schemas
- shared Hub resources
- Auth/OAuth project configuration
- Storage for other apps
- service-role secrets

Local user data such as playlists, likes, history, profile preferences, Aura settings, and resolver cache remains preserved.

## Production

Production alias:

https://auralis-music-lime.vercel.app

The tested v10.1 preview is READY and can be promoted directly without rebuilding once Vercel allows production traffic to be pointed at it.

Repository:

https://github.com/Rishikeshsanin/auralis-music

---

**Release principle:** Quality > quantity. v10.1 improves the coherence and reliability of existing music paths instead of adding provider count for its own sake.
