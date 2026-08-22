(() => {
  const VERSION = '10.1.2';
  const $ = (selector, root = document) => root?.querySelector?.(selector) || null;
  const $$ = (selector, root = document) => root?.querySelectorAll ? [...root.querySelectorAll(selector)] : [];
  const clean = value => String(value || '').replace(/\s+/g, ' ').trim();
  const normalized = value => clean(value).toLowerCase().normalize('NFKD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-z0-9]+/g, ' ').trim();

  const state = {
    shellHome: null,
    shellNext: null,
    shellMoved: false,
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

  function ensureInlineSlot() {
    let slot = $('#inlineVideoSlotV1012');
    if (slot) return slot;
    const player = $('#playerBar');
    if (!player) return null;
    slot = document.createElement('div');
    slot.id = 'inlineVideoSlotV1012';
    slot.className = 'v1012-inline-video-slot';
    slot.setAttribute('aria-label', 'YouTube video player');
    const extras = $('.player-extras', player);
    if (extras) extras.before(slot);
    else player.append(slot);
    return slot;
  }

  function rememberShellHome(shell) {
    if (!shell || state.shellHome) return;
    state.shellHome = shell.parentNode;
    state.shellNext = shell.nextSibling;
  }

  function moveShellToInline() {
    const shell = $('#fullPlaybackDockV91 .v91-video-shell') || $('#inlineVideoSlotV1012 .v91-video-shell');
    const slot = ensureInlineSlot();
    if (!shell || !slot) return;
    rememberShellHome(shell);
    if (shell.parentNode !== slot) slot.append(shell);
    state.shellMoved = true;
  }

  function moveShellToDock() {
    const shell = $('#inlineVideoSlotV1012 .v91-video-shell') || $('#fullPlaybackDockV91 .v91-video-shell');
    const dock = $('#fullPlaybackDockV91');
    if (!shell || !dock) return;
    if (shell.parentNode !== dock) {
      const anchor = $('.v91-now-playing', dock);
      if (anchor?.nextSibling) dock.insertBefore(shell, anchor.nextSibling);
      else dock.append(shell);
    }
    state.shellMoved = false;
  }

  function syncVideoHome() {
    const active = Boolean(window.AuralisFullPlaybackV91?.state?.active);
    const expanded = document.body.classList.contains('v1011-video-expanded');
    if (!active) {
      document.body.classList.remove('v1012-inline-video-active');
      if (state.shellMoved) moveShellToDock();
      return;
    }
    if (expanded) {
      document.body.classList.remove('v1012-inline-video-active');
      moveShellToDock();
    } else {
      moveShellToInline();
      document.body.classList.add('v1012-inline-video-active');
    }
  }

  function interceptVideoControls(event) {
    const target = event.target;
    if (target.closest('#videoModeToggleV101')) {
      const api = window.AuralisProductPolishV1011;
      if (!api?.setVideoExpanded) return;
      event.preventDefault();
      event.stopImmediatePropagation();
      const expanded = document.body.classList.contains('v1011-video-expanded');
      api.setVideoExpanded(!expanded, false);
      requestAnimationFrame(syncVideoHome);
      return;
    }
    if (target.closest('#minimizeVideoV1011')) {
      const api = window.AuralisProductPolishV1011;
      if (!api?.setVideoExpanded) return;
      event.preventDefault();
      event.stopImmediatePropagation();
      api.setVideoExpanded(false, false);
      requestAnimationFrame(syncVideoHome);
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
    syncVideoHome();
    scanFallbacks();
  }

  function scheduleScan() {
    if (state.scanQueued) return;
    state.scanQueued = true;
    requestAnimationFrame(runScan);
  }

  function start() {
    loadCss();
    ensureInlineSlot();
    syncVideoHome();
    scanFallbacks();
    window.addEventListener('click', interceptVideoControls, true);

    const observer = new MutationObserver(records => {
      records.forEach(record => record.addedNodes.forEach(node => {
        if (node instanceof HTMLElement) suppressVideoToast(node);
      }));
      scheduleScan();
    });
    observer.observe(document.body, { childList:true, subtree:true, attributes:true, attributeFilter:['class'] });
    window.addEventListener('resize', scheduleScan);
    setInterval(syncVideoHome, 400);

    window.AuralisProductHotfixV1012 = {
      version:VERSION,
      syncVideoHome,
      scanFallbacks
    };
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start, { once:true });
  else start();
})();
