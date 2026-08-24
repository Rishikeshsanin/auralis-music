import { PreviewOwnershipLifecycle } from './preview-lifecycle-v10-2.mjs';

(() => {
  const VERSION = '10.2.0';
  const PREVIEW_TRIGGER = [
    '[data-v9-preview]',
    '#detailPreviewV9',
    '[data-album-preview]',
    '[data-artist-preview]',
    '#playPlaylistPreviewsV9',
    '[data-playlist-preview]'
  ].join(',');
  const FULL_TRIGGER = [
    '[data-v91-full]',
    '[data-v91-row-full]',
    '[data-v91-full-detail]',
    '[data-v101-liked-play]',
    '[data-v1011-artist-play]',
    '[data-v101-queue-play]'
  ].join(',');
  const DIRECT_TRIGGER = [
    '[data-play-index]',
    '[data-play-row]',
    '[data-radio-play]',
    '.music-card',
    '.track-row',
    '.radio-card'
  ].join(',');

  const $ = (selector, root = document) => root?.querySelector?.(selector) || null;
  const clean = value => String(value || '').replace(/\s+/g, ' ').trim();

  const state = {
    fullHooked: false,
    hookFrames: 0
  };

  const ownership = new PreviewOwnershipLifecycle({
    deactivate: options => deactivateInternalPreview(options),
    restorePaused: session => restoreInterruptedPaused(session),
    onChange: session => document.body?.classList.toggle('v102-preview-exclusive', Boolean(session))
  });
  Object.defineProperty(state, 'preview', { enumerable: true, get: () => ownership.session });

  function formatTime(seconds) {
    const value = Math.max(0, Math.floor(Number(seconds || 0)));
    return `${Math.floor(value / 60)}:${String(value % 60).padStart(2, '0')}`;
  }

  function fullApi() {
    return window.AuralisFullPlaybackV91 || null;
  }

  function audioNode() {
    return $('#audio');
  }

  function playerBar() {
    return $('#playerBar');
  }

  function stopLegacyLookup() {
    const mount = $('#youtubePlayerV9');
    if (mount?.querySelector('iframe')) mount.innerHTML = '';
  }

  function snapshotCorePlayer() {
    const audio = audioNode();
    const bar = playerBar();
    if (!audio || !bar) return null;
    const title = clean($('#playerTitle')?.textContent);
    const hasTrack = title && title !== 'Choose a track';
    return {
      hasTrack,
      src: clean(audio.currentSrc || audio.src),
      currentTime: Number(audio.currentTime || 0),
      titleHtml: $('#playerTitle')?.textContent || 'Choose a track',
      artistHtml: $('#playerArtist')?.textContent || 'Auralis',
      sourceHtml: $('#playerSource')?.textContent || 'Multi-source player',
      coverHtml: $('#playerCover')?.innerHTML || '<span>A</span>',
      coverKey: $('#playerCover')?.dataset.artworkKey || '',
      likeHtml: $('#playerLike')?.innerHTML || '♡',
      likeClass: $('#playerLike')?.className || 'like-button',
      progressValue: $('#progressBar')?.value || '0',
      progressDisabled: Boolean($('#progressBar')?.disabled),
      currentLabel: $('#currentTime')?.textContent || '0:00',
      durationLabel: $('#durationTime')?.textContent || '0:00'
    };
  }

  function applyCoreUi(snapshot) {
    if (!snapshot) return;
    const bar = playerBar();
    bar?.classList.remove('v9-preview-active', 'v91-youtube-active');
    if ($('#playerTitle')) $('#playerTitle').textContent = snapshot.titleHtml;
    if ($('#playerArtist')) $('#playerArtist').textContent = snapshot.artistHtml;
    if ($('#playerSource')) $('#playerSource').textContent = snapshot.sourceHtml;
    if ($('#playerCover') && ($('#playerCover').dataset.artworkKey !== snapshot.coverKey || $('#playerCover').innerHTML !== snapshot.coverHtml)) {
      $('#playerCover').innerHTML = snapshot.coverHtml;
      $('#playerCover').dataset.artworkKey = snapshot.coverKey;
    }
    if ($('#playerLike')) {
      $('#playerLike').innerHTML = snapshot.likeHtml;
      $('#playerLike').className = snapshot.likeClass;
    }
    if ($('#playButton')) $('#playButton').textContent = '▶';
    if ($('#progressBar')) {
      $('#progressBar').disabled = snapshot.progressDisabled;
      $('#progressBar').value = snapshot.progressValue;
    }
    if ($('#currentTime')) $('#currentTime').textContent = snapshot.currentLabel;
    if ($('#durationTime')) $('#durationTime').textContent = snapshot.durationLabel;
  }

  function restoreCorePaused(snapshot) {
    const audio = audioNode();
    if (!audio || !snapshot) return;
    audio.pause();

    if (snapshot.src) {
      const current = clean(audio.currentSrc || audio.src);
      if (current !== snapshot.src) {
        audio.src = snapshot.src;
        audio.load();
      }
      const seek = () => {
        try {
          if (Number.isFinite(snapshot.currentTime) && snapshot.currentTime > 0 && Number.isFinite(audio.duration) && audio.duration > 0) {
            audio.currentTime = Math.min(snapshot.currentTime, Math.max(0, audio.duration - 0.05));
          }
        } catch {}
        audio.pause();
        applyCoreUi(snapshot);
      };
      if (audio.readyState >= 1) seek();
      else audio.addEventListener('loadedmetadata', seek, { once: true });
    } else {
      audio.removeAttribute('src');
      audio.load();
    }

    applyCoreUi(snapshot);
    requestAnimationFrame(() => applyCoreUi(snapshot));
  }

  function restoreFullPaused(full) {
    if (!full?.state?.track || !full.state.video || !full.state.player) return false;
    const track = full.state.track;
    const video = full.state.video;
    try { full.state.player.pauseVideo?.(); } catch {}
    full.state.active = true;

    const bar = playerBar();
    bar?.classList.remove('v9-preview-active');
    bar?.classList.add('v91-youtube-active');
    if ($('#playerTitle')) $('#playerTitle').textContent = track.title || video.title || 'Full playback';
    if ($('#playerArtist')) $('#playerArtist').textContent = track.artist || video.channel || 'YouTube';
    if ($('#playerSource')) $('#playerSource').textContent = `YouTube · full playback · ${video.channel || 'official embed'}`;
    if ($('#playButton')) $('#playButton').textContent = '▶';
    const artwork = track.artwork || video.artwork || '';
    const cover = $('#playerCover');
    if (cover) {
      const artworkKey = `youtube::${track.graphId || track.id || track.title}::${artwork}`;
      if (cover.dataset.artworkKey !== artworkKey) {
        cover.dataset.artworkKey = artworkKey;
        cover.innerHTML = '';
        if (artwork) {
          const img = document.createElement('img');
          img.src = artwork;
          img.alt = `${track.title || video.title || 'Track'} artwork`;
          img.referrerPolicy = 'no-referrer';
          cover.append(img);
        } else {
          const span = document.createElement('span');
          span.textContent = (track.title || 'A')[0];
          cover.append(span);
        }
      }
    }

    try {
      const current = Number(full.state.player.getCurrentTime?.() || 0);
      const duration = Number(full.state.player.getDuration?.() || video.durationSeconds || 0);
      if ($('#progressBar')) {
        $('#progressBar').disabled = false;
        $('#progressBar').value = duration > 0 ? String(current / duration * 100) : '0';
      }
      if ($('#currentTime')) $('#currentTime').textContent = formatTime(current);
      if ($('#durationTime')) $('#durationTime').textContent = formatTime(duration);
    } catch {}
    return true;
  }

  function deactivateInternalPreview(options) {
    window.AuralisMusicGraphV9?.deactivatePreview?.(options);
  }

  function restoreInterruptedPaused(session) {
    if (!session) return;
    if (session.owner === 'full') {
      const full = fullApi();
      if (restoreFullPaused(full)) return;
    }
    restoreCorePaused(session.core);
  }

  function finishPreview({ restore = true, requestId = null, reason = 'finished', emitCancelled = false } = {}) {
    if (!ownership.session) return false;
    const audio = audioNode();
    try { audio?.pause(); } catch {}
    return Boolean(ownership.finish(requestId, { restore, reason, emitCancelled }));
  }

  function suspendFullForPreview(full) {
    if (!full?.state?.active || !full.state.player) return false;
    try { full.state.player.pauseVideo?.(); } catch {}
    // Keep the full-player object, track and seek position alive, but make the
    // preview the sole active owner so old progress/control handlers go idle.
    full.state.active = false;
    return true;
  }

  function beginPreview() {
    stopLegacyLookup();
    if (!ownership.session) {
      const core = snapshotCorePlayer();
      const full = fullApi();
      const suspendedFull = suspendFullForPreview(full);
      if (!suspendedFull) audioNode()?.pause();
      ownership.begin({
        owner: suspendedFull ? 'full' : (core?.hasTrack ? 'core' : 'none'),
        core
      });
    }
  }

  function claimFullPlayback() {
    stopLegacyLookup();
    if (ownership.session) ownership.supersede('full-playback');
    const audio = audioNode();
    try { audio?.pause(); } catch {}
    const full = fullApi();
    try { full?.state?.player?.pauseVideo?.(); } catch {}
  }

  function claimDirectPlayback() {
    stopLegacyLookup();
    if (ownership.session) finishPreview({ restore: true, reason: 'direct-playback', emitCancelled: true });
    const full = fullApi();
    if (full?.state?.player || full?.state?.track) {
      try { full.stop?.(); } catch {}
    }
  }

  function claimLegacyLookup() {
    if (ownership.session) ownership.supersede('legacy-playback');
    const full = fullApi();
    try { full?.stop?.(); } catch {}
    try { audioNode()?.pause(); } catch {}
  }

  function handleClick(event) {
    if (!(event.target instanceof Element)) return;
    const target = event.target;

    const previewTrigger = target.closest(PREVIEW_TRIGGER);
    if (previewTrigger) {
      beginPreview();
      return;
    }

    if (target.closest(FULL_TRIGGER)) {
      claimFullPlayback();
      return;
    }

    if (target.closest('[data-youtube-id]')) {
      claimLegacyLookup();
      return;
    }

    if (target.closest(DIRECT_TRIGGER) && !target.closest('.v9-graph-card,.v9-modal')) {
      claimDirectPlayback();
    }
  }

  function lifecycleRequestId(event) {
    const requestId = Number(event.detail?.requestId);
    return Number.isInteger(requestId) ? requestId : null;
  }

  function handlePreviewRequested(event) {
    if (!ownership.session) beginPreview();
    const requestId = lifecycleRequestId(event);
    if (requestId !== null) ownership.requested(requestId);
  }

  function handlePreviewStarted(event) {
    const requestId = lifecycleRequestId(event);
    if (requestId !== null) ownership.started(requestId);
  }

  function handlePreviewTerminal(event) {
    const requestId = lifecycleRequestId(event);
    if (requestId === null || !ownership.accepts(requestId)) return;
    finishPreview({ restore: true, requestId, reason: event.type.replace('auralis:preview-', '') });
  }

  function handleAudioPlay(event) {
    if (event.target !== audioNode() || ownership.session) return;
    const full = fullApi();
    if (full?.state?.active || full?.state?.player) {
      try { full.stop?.(); } catch {}
    }
    stopLegacyLookup();
  }

  function hookFullApi() {
    if (state.fullHooked) return true;
    const full = fullApi();
    if (!full?.play) return false;
    const originalPlay = full.play.bind(full);
    full.play = track => {
      claimFullPlayback();
      return originalPlay(track);
    };
    state.fullHooked = true;
    return true;
  }

  function waitForFullApi() {
    if (hookFullApi()) return;
    if (state.hookFrames >= 240) return;
    state.hookFrames += 1;
    requestAnimationFrame(waitForFullApi);
  }

  function installStyle() {
    if ($('#auralisPlaybackCoordinatorV102Style')) return;
    const style = document.createElement('style');
    style.id = 'auralisPlaybackCoordinatorV102Style';
    style.textContent = `
      body.v102-preview-exclusive #fullPlaybackDockV91 {
        pointer-events:none !important;
      }
    `;
    document.head.append(style);
  }

  function start() {
    installStyle();
    // This module loads before Full Playback v9.1 so its window-capture claim
    // listener runs first. That gives every user action exactly one audio owner.
    window.addEventListener('click', handleClick, true);
    window.addEventListener('play', handleAudioPlay, true);
    window.addEventListener('auralis:preview-requested', handlePreviewRequested);
    window.addEventListener('auralis:preview-started', handlePreviewStarted);
    ['failed', 'cancelled', 'ended'].forEach(phase => {
      window.addEventListener(`auralis:preview-${phase}`, handlePreviewTerminal);
    });
    waitForFullApi();
    window.AuralisPlaybackCoordinatorV102 = {
      version: VERSION,
      state,
      finishPreview,
      claimFullPlayback,
      claimDirectPlayback
    };
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start, { once: true });
  else start();
})();
