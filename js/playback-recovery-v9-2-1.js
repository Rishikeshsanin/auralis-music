(() => {
  const VERSION = '9.2.1';
  const attemptedByTrack = new Map();
  let patchInstalled = false;

  const $ = (selector, root = document) => root.querySelector(selector);
  const clean = value => String(value || '').replace(/\s+/g, ' ').trim();

  function trackKey(track = {}) {
    return [track.title, track.artist, track.album].map(value => clean(value).toLowerCase()).join('|');
  }

  function toast(title, detail = '') {
    const region = $('#toastRegion');
    if (!region) return;
    const node = document.createElement('div');
    node.className = 'toast v9-toast v921-toast';
    node.innerHTML = `<strong>${String(title || '')}</strong>${detail ? `<small>${String(detail || '')}</small>` : ''}`;
    region.append(node);
    setTimeout(() => node.remove(), 4200);
  }

  function loader(message, visible = true) {
    const node = $('#youtubeLoaderV91');
    if (!node) return;
    const text = $('span', node);
    if (text) text.textContent = message;
    node.classList.toggle('show', visible);
  }

  function wireTapToStart() {
    const node = $('#youtubeLoaderV91');
    if (!node || node.dataset.v921TapReady === 'true') return;
    node.dataset.v921TapReady = 'true';
    node.style.cursor = 'pointer';
    node.addEventListener('click', () => {
      const state = window.AuralisFullPlaybackV91?.state;
      if (!state?.active || !state.player?.playVideo) return;
      try {
        state.player.playVideo();
        loader('', false);
      } catch {}
    });
  }

  function updateCandidateUi(track, video) {
    const state = window.AuralisFullPlaybackV91?.state;
    if (state) state.video = video;
    const match = $('#fullPlaybackMatchV91');
    if (match) {
      const seconds = Number(video?.durationSeconds || 0);
      const duration = seconds ? `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, '0')}` : 'full video';
      match.textContent = `${video?.channel || 'YouTube'} · ${duration} · recovery match ${video?.matchScore ?? 'verified'}`;
    }
    const source = $('#playerSource');
    if (source) source.textContent = `YouTube · full playback · ${video?.channel || 'official embed'}`;
    if (track?.title && $('#playerTitle')) $('#playerTitle').textContent = track.title;
    if (track?.artist && $('#playerArtist')) $('#playerArtist').textContent = track.artist;
  }

  async function fetchCandidates(track) {
    const url = new URL('/api/youtube', location.origin);
    url.searchParams.set('title', track.title || '');
    if (track.artist) url.searchParams.set('artist', track.artist);
    if (track.album) url.searchParams.set('album', track.album);
    url.searchParams.set('limit', '8');
    url.searchParams.set('retry', String(Date.now()));
    const response = await fetch(url, { headers: { Accept: 'application/json' }, cache: 'no-store' });
    const json = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(json.error || `YouTube recovery failed (${response.status})`);
    const ordered = [json.bestMatch, ...(Array.isArray(json.items) ? json.items : [])].filter(Boolean);
    const seen = new Set();
    return ordered.filter(video => {
      if (!video?.id || video.embeddable === false || seen.has(video.id)) return false;
      seen.add(video.id);
      return true;
    });
  }

  async function recoverSameSong(event, originalOnError) {
    const state = window.AuralisFullPlaybackV91?.state;
    const track = state?.track;
    if (!track) {
      originalOnError?.(event);
      return;
    }

    const key = trackKey(track);
    const attempted = attemptedByTrack.get(key) || new Set();
    if (state.video?.id) attempted.add(state.video.id);
    attemptedByTrack.set(key, attempted);

    loader(`That YouTube source failed (code ${event?.data ?? 'unknown'}). Trying another verified source…`, true);

    try {
      const candidates = await fetchCandidates(track);
      const next = candidates.find(video => !attempted.has(video.id));
      if (!next) throw new Error('No alternate verified embed is available for this song.');

      attempted.add(next.id);
      updateCandidateUi(track, next);
      toast('Trying another full source', `${track.title} · ${next.channel || 'YouTube'}`);
      try {
        event.target.loadVideoById(next.id);
        event.target.playVideo();
      } catch (error) {
        throw error;
      }
    } catch (error) {
      loader(`${error.message || 'Full playback failed.'} Tap ▶ Full to retry.`, true);
      toast('Full playback source failed', `YouTube error ${event?.data ?? 'unknown'} · ${error.message || 'Try again.'}`);
      // Do not auto-loop a broken source. The user can retry or choose another result.
    }
  }

  function guardAutoplay(player) {
    wireTapToStart();
    setTimeout(() => {
      const state = window.AuralisFullPlaybackV91?.state;
      if (!state?.active || state.player !== player) return;
      let status = -1;
      try { status = player.getPlayerState?.(); } catch {}
      const playing = window.YT && status === window.YT.PlayerState.PLAYING;
      const buffering = window.YT && status === window.YT.PlayerState.BUFFERING;
      if (!playing && !buffering) {
        loader('Playback is ready — tap here to start.', true);
        const play = $('#playButton');
        if (play) play.textContent = '▶';
      }
    }, 2200);
  }

  function patchPlayer() {
    if (patchInstalled || !window.YT?.Player || window.YT.Player.__auralisRecoveryV921) return;
    const OriginalPlayer = window.YT.Player;

    function RecoveryPlayer(element, options = {}) {
      const events = { ...(options.events || {}) };
      const originalOnReady = events.onReady;
      const originalOnError = events.onError;

      events.onReady = event => {
        originalOnReady?.(event);
        guardAutoplay(event.target);
      };

      events.onError = event => {
        recoverSameSong(event, originalOnError);
      };

      return new OriginalPlayer(element, { ...options, events });
    }

    RecoveryPlayer.prototype = OriginalPlayer.prototype;
    Object.setPrototypeOf(RecoveryPlayer, OriginalPlayer);
    RecoveryPlayer.__auralisRecoveryV921 = true;
    window.YT.Player = RecoveryPlayer;
    patchInstalled = true;
  }

  function installBeforeIframeApi() {
    if (window.YT?.Player) {
      patchPlayer();
      return;
    }
    const previous = window.onYouTubeIframeAPIReady;
    window.onYouTubeIframeAPIReady = () => {
      try { previous?.(); } catch {}
      patchPlayer();
    };
  }

  function start() {
    wireTapToStart();
    installBeforeIframeApi();
    const observer = new MutationObserver(() => wireTapToStart());
    observer.observe(document.body, { childList: true, subtree: true });
    window.AuralisPlaybackRecoveryV921 = { version: VERSION, patchPlayer };
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start, { once: true });
  else start();
})();