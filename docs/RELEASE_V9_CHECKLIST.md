# Auralis Music Graph v9 — Release Checklist

This release must not merge until all checks pass.

## Safety
- [x] Work isolated to `release/auralis-music-graph-v9`
- [x] No Supabase changes
- [x] No other Project Hub application touched
- [x] No downloader/scraper-style YouTube integration
- [x] Credentialed providers fail closed when keys are unavailable

## Catalog architecture
- [x] Universal catalog endpoint
- [x] Track / album / artist entity modes
- [x] MusicBrainz canonical identity
- [x] Cover Art Archive fallback
- [x] Provider Control Plane / Source Pulse
- [x] Local provider-independent playlists
- [x] Preview playback clearly labeled
- [x] Full-source handoff back to Auralis playback catalogs

## Release validation
- [ ] GitHub Actions green
- [ ] Vercel preview READY
- [ ] `/api/providers` healthy
- [ ] `/api/catalog?mode=search&q=Blinding%20Lights` returns useful results
- [ ] `/api/catalog?mode=search&q=Tum%20Hi%20Ho` returns useful results
- [ ] album search returns artwork and track metadata
- [ ] artist search returns entity metadata
- [ ] radio regression remains healthy
- [ ] Aura Mode regression remains healthy
- [ ] mobile shell checked
- [ ] README updated
- [ ] production remains untouched until all above pass
