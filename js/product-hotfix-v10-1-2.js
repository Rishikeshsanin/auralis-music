(() => {
  const VERSION = '10.1.3';
  const $ = (selector, root = document) => root?.querySelector?.(selector) || null;
  const $$ = (selector, root = document) => root?.querySelectorAll ? [...root.querySelectorAll(selector)] : [];
  const clean = value => String(value || '').replace(/\s+/g, ' ').trim();
  const normalized = value => clean(value).toLowerCase().normalize('NFKD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-z0-9]+/g, ' ').trim();

  const state = {
    videoHidden: false,
    lastTrackKey: '',
    scanQueued: false,
    artworkCache: new Map(),
    artworkPending: new WeakSet()
  };

  function loadCss() {
    if ($('#auralisV1012Css')) return;
    const link = document.createElement('link');
    link.id = 'auralisV1012Css';
    link.rel = 'stylesheet';
    link.href = './experience-v10-1-hotfix.css';
    document.head.append(link);
  }

  function restoreVideoShellToDock() {
    const dock = $('#fullPlaybackDockV91');
    const shell = $('#inlineVideoSlotV1012 .v91-video-shell') || $('#fullPlaybackDockV91 .v91-video-shell');
    if (dock && shell && shell.parentNode !== dock) {
      const nowPlaying = $('.v91-now-playing', dock);
      if (nowPlaying) dock.insertBefore(shell, nowPlaying);
      else dock.append(shell);
    }
    $('#inlineVideoSlotV1012')?.remove();
    document.body.classList.remove('v1012-inline-video-active');
  }

  function fullPlaybackActive() {
    return Boolean(window.AuralisFullPlaybackV91?.state?.active);
  }

  function currentTrackKey() {
    const track = window.AuralisFullPlaybackV91?.state?.track;
    return track ? `${clean(track.title).toLowerCase()}::${clean(track.artist).toLowerCase()}` : '';
  }

  function labelVideoControls() {
    const close = $('#closeFullPlaybackV91');
    if (close) {
      if (close.title !== 'Hide video') close.title = 'Hide video';
      if (close.getAttribute('aria-label') !== 'Hide video') close.setAttribute('aria-label', 'Hide video');
    }
    const button = $('#videoModeToggleV101');
    if (button) {
      const active = fullPlaybackActive();
      button.title = active
        ? (state.videoHidden ? 'Show video player' : 'Hide video player')
        : 'Video becomes available during full playback';
      button.setAttribute('aria-pressed', String(active && !state.videoHidden));
      button.classList.toggle('v1013-video-visible', active && !state.videoHidden);
    }
  }

  function showVideo() {
    if (!fullPlaybackActive()) return;
    restoreVideoShellToDock();
    state.videoHidden = false;
    document.body.classList.remove('v1013-video-hidden');
    window.AuralisProductPolishV1011?.setVideoExpanded?.(true, false);
    const dock = $('#fullPlaybackDockV91');
    dock?.classList.add('open');
    dock?.setAttribute('aria-hidden', 'false');
    labelVideoControls();
  }

  function hideVideo() {
    if (!fullPlaybackActive()) return;
    restoreVideoShellToDock();
    state.videoHidden = true;
    window.AuralisProductPolishV1011?.setVideoExpanded?.(false, false);
    document.body.classList.add('v1013-video-hidden');
    labelVideoControls();
  }

  function syncVideoPopup() {
    restoreVideoShellToDock();
    const active = fullPlaybackActive();
    const key = currentTrackKey();

    if (!active) {
      state.videoHidden = false;
      state.lastTrackKey = '';
      document.body.classList.remove('v1013-video-hidden');
      labelVideoControls();
      return;
    }

    // A newly started full song shows its video by default. The user can hide it
    // with × and reopen it from the Video control without stopping playback.
    if (key && key !== state.lastTrackKey) {
      state.lastTrackKey = key;
      state.videoHidden = false;
      document.body.classList.remove('v1013-video-hidden');
      window.AuralisProductPolishV1011?.setVideoExpanded?.(true, false);
    }

    if (state.videoHidden) {
      document.body.classList.add('v1013-video-hidden');
    } else {
      document.body.classList.remove('v1013-video-hidden');
      if (!document.body.classList.contains('v1011-video-expanded')) {
        window.AuralisProductPolishV1011?.setVideoExpanded?.(true, false);
      }
    }
    labelVideoControls();
  }

  function interceptVideoControls(event) {
    const target = event.target;
    if (!(target instanceof Element)) return;

    if (target.closest('#closeFullPlaybackV91') || target.closest('#minimizeVideoV1011')) {
      if (!fullPlaybackActive()) return;
      event.preventDefault();
      event.stopImmediatePropagation();
      hideVideo();
      return;
    }

    if (target.closest('#videoModeToggleV101')) {
      if (!fullPlaybackActive()) return;
      event.preventDefault();
      event.stopImmediatePropagation();
      if (state.videoHidden) hideVideo();
      if (state.videoHidden) showVideo();
      else hideVideo();
    }
  }

  function suppressVideoToast(node) {
    if (!(node instanceof HTMLElement)) return;
    const toast = node.matches?.('.v1011-toast') ? node : node.closest?.('.v1011-toast');
    if (!toast) return;
    const title = clean($('strong', toast)?.textContent || toast.textContent);
    if (/^Video (player opened|minimized)$/i.test(title)) {
      toast.classList.add('v1012-video-toast-suppressed');
      requestAnimationFrame(() => toast.remove());
    }
  }

  function identityForHost(host) {
    const owner = host.closest('.track-row,.music-card,.queue-item,.v9-graph-card,.v9-album-row,.v9-playlist-row,.v101-liked-row,.player');
    if (!owner) return { title:'', artist:'' };
    if (owner.classList.contains('track-row')) return { title:clean($('.row-title-copy strong', owner)?.textContent), artist:clean($('.row-title-copy span', owner)?.textContent) };
    if (owner.classList.contains('music-card')) return { title:clean($('h3', owner)?.textContent), artist:clean($('p', owner)?.textContent) };
    if (owner.classList.contains('queue-item')) return { title:clean($('.queue-item-copy strong', owner)?.textContent), artist:clean(($('.queue-item-copy span', owner)?.textContent || '').split(' · ')[0]) };
    if (owner.classList.contains('v9-graph-card')) return { title:clean($('.v9-graph-copy > strong', owner)?.textContent), artist:clean(($('.v9-graph-copy > span', owner)?.textContent || '').split(' · ')[0]) };
    if (owner.classList.contains('v101-liked-row')) return { title:clean($('strong', owner)?.textContent), artist:clean($('span', owner)?.textContent) };
    if (owner.classList.contains('player')) return { title:clean($('#playerTitle')?.textContent), artist:clean($('#playerArtist')?.textContent) };
    const body = owner.closest('#graphModalBodyV9');
    const kicker = clean($('.v9-detail-hero .eyebrow', body)?.textContent).toUpperCase();
    const modalTitle = clean($('.v9-detail-hero h2', body)?.textContent || $('#graphModalTitleV9')?.textContent);
    return { title:clean($('strong', owner)?.textContent), artist:kicker === 'ARTIST' ? modalTitle : clean($('small', owner)?.textContent) };
  }

  function candidateScore(item, identity) {
    const title = normalized(item?.title);
    const artist = normalized(item?.artist);
    const wantedTitle = normalized(identity.title);
    const wantedArtist = normalized(identity.artist);
    if (!title || !wantedTitle || title !== wantedTitle) return 0;
    let score = 20;
    if (artist && wantedArtist && artist === wantedArtist) score += 14;
    else if (artist && wantedArtist && (artist.includes(wantedArtist) || wantedArtist.includes(artist))) score += 7;
    if (item?.artwork || item?.artworkFallback) score += 3;
    return score;
  }

  async function queryArtwork(identity) {
    if (!identity.title || !identity.artist) return '';
    const key = `${normalized(identity.title)}::${normalized(identity.artist)}`;
    if (state.artworkCache.has(key)) return state.artworkCache.get(key);
    const request = (async () => {
      const queries = [
        `artist:\"${identity.artist}\" track:\"${identity.title}\"`,
        `\"${identity.title}\" \"${identity.artist}\"`,
        `${identity.title} ${identity.artist}`
      ];
      for (const q of queries) {
        try {
          const url = new URL('/api/catalog', location.origin);
          url.searchParams.set('mode','search');
          url.searchParams.set('kind','track');
          url.searchParams.set('q',q);
          url.searchParams.set('limit','12');
          const response = await fetch(url, { headers:{ Accept:'application/json' } });
          if (!response.ok) continue;
          const json = await response.json();
          const ranked = (json.items || []).map(item => ({
            item,
            score:candidateScore(item, identity),
            artwork:clean(item?.artwork || item?.artworkFallback || '')
          })).filter(entry => entry.artwork && entry.score >= 27).sort((a,b) => b.score - a.score);
          if (ranked.length) return ranked[0].artwork;
        } catch {}
      }
      return '';
    })();
    state.artworkCache.set(key, request);
    return request;
  }

  function seedFallback(host, identity) {
    const fallback = $('.v1011-branded-art', host);
    if (!fallback) return;
    const seed = [...`${identity.title}|${identity.artist}`].reduce((sum, char) => (sum + char.charCodeAt(0) * 17) % 360, 0);
    host.style.setProperty('--v1012-hue', String(seed));
    host.style.setProperty('--v1012-hue2', String((seed + 118) % 360));
    fallback.classList.add('v1012-cover');
    if (!$('.v1012-wave', fallback)) {
      const wave = document.createElement('span');
      wave.className = 'v1012-wave';
      wave.innerHTML = '<span></span><span></span><span></span><span></span><span></span><span></span><span></span><span></span><span></span>';
      fallback.append(wave);
    }
  }

  function installRecoveredArtwork(host, url, identity) {
    if (!host || !url) return;
    const img = document.createElement('img');
    img.alt = `${identity.title || 'Track'} artwork`;
    img.loading = 'lazy';
    img.referrerPolicy = 'no-referrer';
    img.addEventListener('load', () => {
      $('.v1011-branded-art', host)?.remove();
      $$('.cover-fallback,.auralis-art-fallback-v92', host).forEach(node => node.remove());
      host.classList.remove('v1011-art-fallback-active','auralis-art-failed-v92','image-failed','no-art');
      host.dataset.v1012PosterRecovered = 'true';
    }, { once:true });
    img.addEventListener('error', () => img.remove(), { once:true });
    host.prepend(img);
    img.src = url;
  }

  async function improveFallback(host) {
    if (!host || host.dataset.v1012PosterTried === 'true' || state.artworkPending.has(host)) return;
    const fallback = $('.v1011-branded-art', host);
    if (!fallback) return;
    const view = host.closest('.view');
    if (view && !view.classList.contains('active-view')) return;
    const modal = host.closest('.v9-modal');
    if (modal && !modal.classList.contains('open')) return;
    const identity = identityForHost(host);
    if (!identity.title) return;
    seedFallback(host, identity);
    host.dataset.v1012PosterTried = 'true';
    if (!identity.artist) return;
    state.artworkPending.add(host);
    try {
      const artwork = await queryArtwork(identity);
      if (artwork && host.isConnected) installRecoveredArtwork(host, artwork, identity);
    } finally {
      state.artworkPending.delete(host);
    }
  }

  function scanFallbacks() {
    $$('.v1011-branded-art').forEach(node => void improveFallback(node.parentElement));
  }

  function runScan() {
    state.scanQueued = false;
    syncVideoPopup();
    scanFallbacks();
  }

  function scheduleScan() {
    if (state.scanQueued) return;
    state.scanQueued = true;
    requestAnimationFrame(runScan);
  }

  function start() {
    loadCss();
    restoreVideoShellToDock();
    syncVideoPopup();
    scanFallbacks();
    window.addEventListener('click', interceptVideoControls, true);

    const observer = new MutationObserver(records => {
      records.forEach(record => record.addedNodes.forEach(node => {
        if (node instanceof HTMLElement) suppressVideoToast(node);
      }));
      scheduleScan();
    });
    observer.observe(document.body, { childList:true, subtree:true });
    window.addEventListener('resize', scheduleScan);
    setInterval(syncVideoPopup, 350);

    window.AuralisProductHotfixV1012 = {
      version:VERSION,
      showVideo,
      hideVideo,
      syncVideoPopup,
      scanFallbacks
    };
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start, { once:true });
  else start();
})();
