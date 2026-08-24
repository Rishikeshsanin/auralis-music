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
    preview: null,
    syntheticDepth: 0,
    fullHooked: false,
    hookFrames: 0
  };

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
    if ($('#playerCover')) $('#playerCover').innerHTML = snapshot.coverHtml;
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

  function previewArtworkFromTrigger(trigger) {
    if (!(trigger instanceof Element)) return '';
    const card = trigger.closest('.v9-graph-card');
    if (card) return $('.v9-graph-art img', card)?.currentSrc || $('.v9-graph-art img', card)?.src || '';
    const body = trigger.closest('#graphModalBodyV9');
    return $('.v9-detail-art img', body)?.currentSrc || $('.v9-detail-art img', body)?.src || '';
  }

  function enforcePreviewArtwork(trigger) {
    const artwork = previewArtworkFromTrigger(trigger);
    if (!artwork || !playerBar()?.classList.contains('v9-preview-active')) return;
    const cover = $('#playerCover');
    if (!cover) return;
    const current = $('img', cover)?.currentSrc || $('img', cover)?.src || '';
    if (current === artwork) return;
    const img = document.createElement('img');
    img.src = artwork;
    img.alt = `${clean($('#playerTitle')?.textContent) || 'Preview'} artwork`;
    img.referrerPolicy = 'no-referrer';
    cover.replaceChildren(img);
  }

  function deactivateInternalPreview() {
    if (!state.preview) return;
    const sentinel = document.createElement('button');
    sentinel.type = 'button';
    sentinel.className = 'track-row';
    sentinel.dataset.v102PlaybackSentinel = 'true';
    sentinel.hidden = true;
    sentinel.addEventListener('click', event => {
      event.preventDefault();
      event.stopImmediatePropagation();
    }, true);
    document.body.append(sentinel);
    state.syntheticDepth += 1;
    try {
      sentinel.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true, view: window }));
    } finally {
      state.syntheticDepth -= 1;
      sentinel.remove();
    }
  }

  function finishPreview({ restore = true } = {}) {
    const session = state.preview;
    if (!session) return;
    const audio = audioNode();
    try { audio?.pause(); } catch {}
    deactivateInternalPreview();
    document.body.classList.remove('v102-preview-exclusive');
    state.preview = null;

    if (!restore) return;
    if (session.owner === 'full') {
      const full = fullApi();
      if (restoreFullPaused(full)) return;
    }
    restoreCorePaused(session.core);
  }

  function suspendFullForPreview(full) {
    if (!full?.state?.active || !full.state.player) return false;
    try { full.state.player.pauseVideo?.(); } catch {}
    // Keep the full-player object, track and seek position alive, but make the
    // preview the sole active owner so old progress/control handlers go idle.
    full.state.active = false;
    return true;
  }

  function beginPreview(trigger) {
    stopLegacyLookup();
    const alreadyPreviewing = Boolean(state.preview || playerBar()?.classList.contains('v9-preview-active'));
    if (!alreadyPreviewing) {
      const core = snapshotCorePlayer();
      const full = fullApi();
      const suspendedFull = suspendFullForPreview(full);
      if (!suspendedFull) audioNode()?.pause();
      state.preview = {
        owner: suspendedFull ? 'full' : (core?.hasTrack ? 'core' : 'none'),
        core,
        playlistSequence: Boolean(trigger.closest('#playPlaylistPreviewsV9')),
        playlistTotal: trigger.closest('#playPlaylistPreviewsV9')
          ? Math.max(1, document.querySelectorAll('#graphModalBodyV9 [data-playlist-preview]').length)
          : 1,
        endedCount: 0
      };
      document.body.classList.add('v102-preview-exclusive');
    }

    requestAnimationFrame(() => {
      if (!playerBar()?.classList.contains('v9-preview-active')) {
        finishPreview({ restore: true });
        return;
      }
      enforcePreviewArtwork(trigger);
    });
  }

  function claimFullPlayback() {
    stopLegacyLookup();
    if (state.preview) finishPreview({ restore: false });
    const audio = audioNode();
    try { audio?.pause(); } catch {}
    const full = fullApi();
    try { full?.state?.player?.pauseVideo?.(); } catch {}
  }

  function claimDirectPlayback() {
    stopLegacyLookup();
    if (state.preview) finishPreview({ restore: false });
    const full = fullApi();
    if (full?.state?.player || full?.state?.track) {
      try { full.stop?.(); } catch {}
    }
  }

  function claimLegacyLookup() {
    if (state.preview) finishPreview({ restore: false });
    const full = fullApi();
    try { full?.stop?.(); } catch {}
    try { audioNode()?.pause(); } catch {}
  }

  function handleClick(event) {
    if (state.syntheticDepth || !(event.target instanceof Element)) return;
    const target = event.target;

    const previewTrigger = target.closest(PREVIEW_TRIGGER);
    if (previewTrigger) {
      beginPreview(previewTrigger);
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

  function handlePreviewEnded(event) {
    if (!state.preview || event.target !== audioNode()) return;
    const session = state.preview;
    session.endedCount += 1;
    if (session.playlistSequence && session.endedCount < session.playlistTotal) {
      return; // Preserve the explicit "Play available previews" sequence.
    }
    event.preventDefault();
    event.stopImmediatePropagation();
    finishPreview({ restore: true });
  }

  function handleAudioPlay(event) {
    if (event.target !== audioNode() || state.preview) return;
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
    window.addEventListener('ended', handlePreviewEnded, true);
    window.addEventListener('play', handleAudioPlay, true);
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
