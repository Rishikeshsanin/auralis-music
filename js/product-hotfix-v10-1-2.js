(() => {
  const VERSION = '10.1.5';
  const $ = (selector, root = document) => root?.querySelector?.(selector) || null;
  const $$ = (selector, root = document) => root?.querySelectorAll ? [...root.querySelectorAll(selector)] : [];
  const clean = value => String(value || '').replace(/\s+/g, ' ').trim();
  const normalized = value => clean(value).toLowerCase().normalize('NFKD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-z0-9]+/g, ' ').trim();

  const state = {
    videoHidden: false,
    lastTrackKey: '',
    scanQueued: false,
    artworkCache: new Map(),
    audiusArtworkCache: new Map(),
    artworkPending: new WeakSet(),
    preserveTrendingUntil: 0,
    trendingGuardInstalled: false
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

  function markTrendingPreserveWindow() {
    state.preserveTrendingUntil = performance.now() + 220;
  }

  function cardSignature(card) {
    if (!card) return '';
    return [
      clean($('h3', card)?.textContent),
      clean($('p', card)?.textContent),
      clean($('.provider-badge', card)?.textContent),
      clean($('.card-meta', card)?.textContent)
    ].join('::');
  }

  function syncTrendingState(existingCards, nextCards) {
    existingCards.forEach((card, index) => {
      const next = nextCards[index];
      if (!next) return;
      card.classList.toggle('active', next.classList.contains('active'));
      const currentButton = $('[data-play-index]', card);
      const nextButton = $('[data-play-index]', next);
      if (currentButton && nextButton) {
        currentButton.textContent = nextButton.textContent;
        const label = nextButton.getAttribute('aria-label');
        if (label) currentButton.setAttribute('aria-label', label);
      }
    });
  }

  function installTrendingGridGuard() {
    if (state.trendingGuardInstalled) return;
    const grid = $('#trendingGrid');
    const descriptor = Object.getOwnPropertyDescriptor(Element.prototype, 'innerHTML');
    if (!grid || !descriptor?.get || !descriptor?.set) return;

    try {
      Object.defineProperty(grid, 'innerHTML', {
        configurable: true,
        get() {
          return descriptor.get.call(this);
        },
        set(value) {
          if (performance.now() <= state.preserveTrendingUntil) {
            const existingCards = $$('.music-card', this);
            if (existingCards.length) {
              const template = document.createElement('template');
              template.innerHTML = String(value ?? '');
              const nextCards = $$('.music-card', template.content);
              const sameCards = nextCards.length === existingCards.length
                && nextCards.every((card, index) => cardSignature(card) === cardSignature(existingCards[index]));
              if (sameCards) {
                syncTrendingState(existingCards, nextCards);
                return;
              }
            }
          }
          descriptor.set.call(this, value);
        }
      });
      state.trendingGuardInstalled = true;
    } catch {}
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

  function validArtworkUrl(value) {
    const url = clean(value);
    return /^https?:\/\//i.test(url) ? url : '';
  }

  function audiusCandidates(track) {
    const art = track?.artwork || {};
    const mirrors = Array.isArray(art.mirrors) ? art.mirrors : [];
    return [...new Set([
      art['480x480'],
      art['1000x1000'],
      art['150x150'],
      art._480x480,
      art._1000x1000,
      art._150x150,
      ...mirrors
    ].map(validArtworkUrl).filter(Boolean))];
  }

  function audiusMatchScore(track, identity) {
    const title = normalized(track?.title);
    const artist = normalized(track?.user?.name || track?.user?.handle);
    const wantedTitle = normalized(identity.title);
    const wantedArtist = normalized(identity.artist);
    if (!title || title !== wantedTitle) return 0;
    let score = 20;
    if (artist && wantedArtist && artist === wantedArtist) score += 14;
    else if (artist && wantedArtist && (artist.includes(wantedArtist) || wantedArtist.includes(artist))) score += 7;
    score += Math.min(3, audiusCandidates(track).length);
    return score;
  }

  async function queryAudiusArtwork(identity) {
    if (!identity.title || !identity.artist) return [];
    const key = `${normalized(identity.title)}::${normalized(identity.artist)}`;
    if (state.audiusArtworkCache.has(key)) return state.audiusArtworkCache.get(key);
    const request = (async () => {
      try {
        const url = new URL('https://api.audius.co/v1/tracks/search');
        url.searchParams.set('app_name', 'AuralisMusic');
        url.searchParams.set('query', `${identity.title} ${identity.artist}`);
        url.searchParams.set('limit', '10');
        const response = await fetch(url, { headers:{ Accept:'application/json' } });
        if (!response.ok) return [];
        const json = await response.json();
        const ranked = (Array.isArray(json.data) ? json.data : [])
          .map(track => ({ track, score:audiusMatchScore(track, identity) }))
          .filter(entry => entry.score >= 27)
          .sort((a,b) => b.score - a.score);
        return ranked.length ? audiusCandidates(ranked[0].track) : [];
      } catch {
        return [];
      }
    })();
    state.audiusArtworkCache.set(key, request);
    return request;
  }

  function hostIsAudius(host) {
    const owner = host?.closest?.('.music-card,.track-row,.queue-item,.v9-graph-card,.v9-album-row,.v9-playlist-row,.v101-liked-row,.player');
    return Boolean(owner && $('.provider-badge.audius,.provider-badge', owner)?.textContent?.trim().toLowerCase() === 'audius');
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

  function installRecoveredArtwork(host, urls, identity) {
    if (!host) return;
    const candidates = [...new Set((Array.isArray(urls) ? urls : [urls]).map(validArtworkUrl).filter(Boolean))];
    if (!candidates.length) return;
    const img = document.createElement('img');
    img.alt = `${identity.title || 'Track'} artwork`;
    img.loading = 'lazy';
    img.referrerPolicy = 'no-referrer';
    let index = 0;

    const tryNext = () => {
      if (!host.isConnected || index >= candidates.length) {
        img.remove();
        return;
      }
      img.src = candidates[index++];
    };

    img.addEventListener('load', () => {
      $('.v1011-branded-art', host)?.remove();
      $$('.cover-fallback,.auralis-art-fallback-v92', host).forEach(node => node.remove());
      host.classList.remove('v1011-art-fallback-active','auralis-art-failed-v92','image-failed','no-art');
      host.dataset.v1012PosterRecovered = 'true';
      host.dataset.v1012RecoveredSrc = img.currentSrc || img.src;
    }, { once:true });
    img.addEventListener('error', tryNext);
    host.prepend(img);
    tryNext();
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
      let candidates = hostIsAudius(host) ? await queryAudiusArtwork(identity) : [];
      if (!candidates.length) {
        const artwork = await queryArtwork(identity);
        if (artwork) candidates = [artwork];
      }
      if (candidates.length && host.isConnected) installRecoveredArtwork(host, candidates, identity);
    } finally {
      state.artworkPending.delete(host);
    }
  }

  function scanFallbacks() {
    $$('.v1011-branded-art').forEach(node => void improveFallback(node.parentElement));
  }

  function runScan() {
    state.scanQueued = false;
    scanFallbacks();
  }

  function scheduleScan() {
    if (state.scanQueued) return;
    state.scanQueued = true;
    const run = () => runScan();
    if ('requestIdleCallback' in window) window.requestIdleCallback(run, { timeout: 600 });
    else setTimeout(run, 40);
  }

  function addedNodeNeedsArtworkScan(node) {
    if (!(node instanceof HTMLElement)) return false;
    if (node.matches('.v1011-branded-art')) return true;
    return Boolean(node.querySelector?.('.v1011-branded-art'));
  }

  function start() {
    loadCss();
    restoreVideoShellToDock();
    installTrendingGridGuard();
    syncVideoPopup();
    scheduleScan();

    window.addEventListener('click', event => {
      const target = event.target;
      if (target instanceof Element && target.closest('#playButton,[data-play-index],.music-card')) {
        markTrendingPreserveWindow();
      }
      if (target instanceof Element && target.closest('[data-view],[data-view-trigger]')) {
        scheduleScan();
      }
      interceptVideoControls(event);
    }, true);

    document.addEventListener('play', event => {
      if (event.target?.id === 'audio') markTrendingPreserveWindow();
    }, true);
    document.addEventListener('pause', event => {
      if (event.target?.id === 'audio') markTrendingPreserveWindow();
    }, true);

    const observer = new MutationObserver(records => {
      let needsArtworkScan = false;
      records.forEach(record => record.addedNodes.forEach(node => {
        if (!(node instanceof HTMLElement)) return;
        suppressVideoToast(node);
        if (addedNodeNeedsArtworkScan(node)) needsArtworkScan = true;
      }));
      if (needsArtworkScan) scheduleScan();
    });
    observer.observe(document.body, { childList:true, subtree:true });

    const dock = $('#fullPlaybackDockV91');
    if (dock) {
      const videoObserver = new MutationObserver(() => {
        requestAnimationFrame(syncVideoPopup);
      });
      videoObserver.observe(dock, {
        childList:true,
        subtree:true,
        attributes:true,
        attributeFilter:['class','aria-hidden']
      });
    }

    window.addEventListener('resize', () => requestAnimationFrame(syncVideoPopup));

    window.AuralisProductHotfixV1012 = {
      version:VERSION,
      showVideo,
      hideVideo,
      syncVideoPopup,
      scanFallbacks,
      installTrendingGridGuard
    };
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start, { once:true });
  else start();
})();
