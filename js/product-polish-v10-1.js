(() => {
  const VERSION = '10.1.1';
  const PLAYLIST_KEY = 'auralis:playlists:v2';
  const VIDEO_LAYOUT_KEY = 'auralis:video-layout:v1011';
  const ART_HOST_SELECTOR = '.cover-wrap,.row-cover,.queue-item-cover,.player-cover,.v9-graph-art,.v9-detail-art,.v101-liked-art,.v91-now-art';
  const $ = (selector, root = document) => root.querySelector(selector);
  const $$ = (selector, root = document) => [...root.querySelectorAll(selector)];
  const clean = value => String(value || '').replace(/\s+/g, ' ').trim();
  const escapeHtml = (value = '') => String(value).replace(/[&<>'"]/g, char => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#039;', '"': '&quot;'
  }[char]));

  const state = {
    expandedVideo: false,
    dragging: false,
    dragX: 0,
    dragY: 0,
    artworkCache: new Map(),
    artworkPending: new Set(),
    scanQueued: false
  };

  function toast(title, detail = '') {
    const region = $('#toastRegion');
    if (!region) return;
    const node = document.createElement('div');
    node.className = 'toast v9-toast v1011-toast';
    node.innerHTML = `<strong>${escapeHtml(title)}</strong>${detail ? `<small>${escapeHtml(detail)}</small>` : ''}`;
    region.append(node);
    setTimeout(() => node.remove(), 3600);
  }

  function loadCss() {
    if ($('#auralisV1011Css')) return;
    const link = document.createElement('link');
    link.id = 'auralisV1011Css';
    link.rel = 'stylesheet';
    link.href = './experience-v10-1-polish.css';
    document.head.append(link);
  }

  function loadVideoLayout() {
    try {
      const value = JSON.parse(localStorage.getItem(VIDEO_LAYOUT_KEY) || '{}');
      return value && typeof value === 'object' ? value : {};
    } catch {
      return {};
    }
  }

  function saveVideoLayout() {
    const dock = $('#fullPlaybackDockV91');
    if (!dock || !state.expandedVideo || window.innerWidth <= 760) return;
    const rect = dock.getBoundingClientRect();
    try {
      localStorage.setItem(VIDEO_LAYOUT_KEY, JSON.stringify({
        left: Math.round(rect.left),
        top: Math.round(rect.top),
        width: Math.round(rect.width),
        height: Math.round(rect.height)
      }));
    } catch {}
  }

  function clampDock() {
    const dock = $('#fullPlaybackDockV91');
    if (!dock || !state.expandedVideo || window.innerWidth <= 760) return;
    const rect = dock.getBoundingClientRect();
    const maxLeft = Math.max(10, window.innerWidth - rect.width - 10);
    const maxTop = Math.max(10, window.innerHeight - rect.height - 94);
    const left = Math.min(maxLeft, Math.max(10, rect.left));
    const top = Math.min(maxTop, Math.max(10, rect.top));
    dock.style.left = `${left}px`;
    dock.style.top = `${top}px`;
    dock.style.right = 'auto';
    dock.style.bottom = 'auto';
  }

  function applySavedVideoLayout() {
    const dock = $('#fullPlaybackDockV91');
    if (!dock || !state.expandedVideo || window.innerWidth <= 760) return;
    const saved = loadVideoLayout();
    if (Number.isFinite(saved.width)) dock.style.width = `${Math.min(window.innerWidth - 20, Math.max(340, saved.width))}px`;
    if (Number.isFinite(saved.height)) dock.style.height = `${Math.min(window.innerHeight - 110, Math.max(270, saved.height))}px`;
    if (Number.isFinite(saved.left)) dock.style.left = `${saved.left}px`;
    if (Number.isFinite(saved.top)) dock.style.top = `${saved.top}px`;
    dock.style.right = 'auto';
    dock.style.bottom = 'auto';
    requestAnimationFrame(clampDock);
  }

  function resetDockInlineLayout() {
    const dock = $('#fullPlaybackDockV91');
    if (!dock) return;
    ['left', 'top', 'right', 'bottom', 'width', 'height'].forEach(prop => dock.style.removeProperty(prop));
  }

  function ensureVideoButtonPlacement() {
    const button = $('#videoModeToggleV101');
    const repeat = $('#repeatButton');
    if (!button || !repeat) return;
    if (button.previousElementSibling !== repeat) repeat.after(button);
    button.classList.add('v1011-video-button');
    button.innerHTML = '<span class="v1011-video-glyph" aria-hidden="true"><i></i></span><small>Video</small>';
    button.setAttribute('aria-label', 'Open video player');
  }

  function ensureDockControls() {
    const dock = $('#fullPlaybackDockV91');
    const head = $('.v91-dock-head', dock);
    const close = $('#closeFullPlaybackV91', dock);
    if (!dock || !head || !close || $('#minimizeVideoV1011', dock)) return;
    const minimize = document.createElement('button');
    minimize.id = 'minimizeVideoV1011';
    minimize.type = 'button';
    minimize.className = 'v1011-minimize-video';
    minimize.title = 'Minimize video player';
    minimize.setAttribute('aria-label', 'Minimize video player');
    minimize.textContent = '—';
    close.before(minimize);
  }

  function syncVideoPresentation() {
    ensureVideoButtonPlacement();
    ensureDockControls();
    const dock = $('#fullPlaybackDockV91');
    const button = $('#videoModeToggleV101');
    const full = window.AuralisFullPlaybackV91?.state;
    const active = Boolean(full?.active);

    document.body.classList.add('v1011-video-ready');
    document.body.classList.toggle('v1011-video-expanded', state.expandedVideo && active);
    document.body.classList.toggle('v1011-video-docked', !state.expandedVideo && active);
    document.body.classList.remove('v101-video-mode-off');

    if (button) {
      button.classList.toggle('active', state.expandedVideo && active);
      button.classList.toggle('playing-video', active);
      button.setAttribute('aria-pressed', String(state.expandedVideo && active));
      button.title = active
        ? (state.expandedVideo ? 'Minimize video player' : 'Open movable video player')
        : 'Video player becomes available during full playback';
    }

    if (!dock) return;
    dock.classList.toggle('v1011-expanded', state.expandedVideo && active);
    dock.classList.toggle('v1011-docked', !state.expandedVideo && active);
    if (!state.expandedVideo) resetDockInlineLayout();
  }

  function setVideoExpanded(expanded, announce = true) {
    const active = Boolean(window.AuralisFullPlaybackV91?.state?.active);
    if (expanded && !active) {
      if (announce) toast('Video is ready when a full song is playing', 'Start Full song first, then open Video.');
      return;
    }
    state.expandedVideo = Boolean(expanded && active);
    window.AuralisPlayerUniverseV101?.setVideoMode?.(true);
    syncVideoPresentation();
    if (state.expandedVideo) {
      applySavedVideoLayout();
      if (announce) toast('Video player opened', 'Drag the header to move it. Resize from the lower-right corner.');
    } else if (announce && active) {
      toast('Video minimized', 'Playback continues in the compact player beside the controls.');
    }
  }

  function beginDrag(event) {
    if (!state.expandedVideo || window.innerWidth <= 760 || event.button !== 0) return;
    if (event.target.closest('button,input,a')) return;
    const dock = $('#fullPlaybackDockV91');
    if (!dock) return;
    const rect = dock.getBoundingClientRect();
    state.dragging = true;
    state.dragX = event.clientX - rect.left;
    state.dragY = event.clientY - rect.top;
    dock.classList.add('v1011-dragging');
    event.preventDefault();
  }

  function moveDrag(event) {
    if (!state.dragging) return;
    const dock = $('#fullPlaybackDockV91');
    if (!dock) return;
    const rect = dock.getBoundingClientRect();
    const maxLeft = Math.max(10, window.innerWidth - rect.width - 10);
    const maxTop = Math.max(10, window.innerHeight - rect.height - 94);
    const left = Math.min(maxLeft, Math.max(10, event.clientX - state.dragX));
    const top = Math.min(maxTop, Math.max(10, event.clientY - state.dragY));
    dock.style.left = `${left}px`;
    dock.style.top = `${top}px`;
    dock.style.right = 'auto';
    dock.style.bottom = 'auto';
  }

  function endDrag() {
    if (!state.dragging) return;
    state.dragging = false;
    $('#fullPlaybackDockV91')?.classList.remove('v1011-dragging');
    saveVideoLayout();
  }

  function fixPlaylistDialog() {
    const dialog = $('#playlistDialogV9');
    const form = $('#playlistFormV9');
    if (!dialog || !form) return;
    dialog.classList.add('v1011-playlist-dialog');

    const heading = $('.v9-dialog-head > div', form);
    if (heading && !$('.v1011-playlist-mark', heading)) {
      heading.insertAdjacentHTML('afterbegin', '<span class="v1011-playlist-mark" aria-hidden="true"><i></i><i></i><i></i></span>');
    }

    $$('button[value="cancel"],.v9-dialog-head .icon-button', form).forEach(button => {
      button.type = 'button';
      button.formNoValidate = true;
      if (button.dataset.v1011CancelBound) return;
      button.dataset.v1011CancelBound = 'true';
      button.addEventListener('click', event => {
        event.preventDefault();
        event.stopImmediatePropagation();
        dialog.close('cancel');
      }, true);
    });

    if (!dialog.dataset.v1011CancelBound) {
      dialog.dataset.v1011CancelBound = 'true';
      dialog.addEventListener('cancel', event => {
        event.preventDefault();
        dialog.close('cancel');
      });
    }
  }

  function polishPlaylistEntryPoints() {
    const button = $('#newPlaylistButton');
    if (button && !button.dataset.v1011Polished) {
      button.dataset.v1011Polished = 'true';
      button.innerHTML = '<span class="v1011-list-icon" aria-hidden="true"><i></i><i></i><i></i></span><span>Create playlist</span>';
      button.title = 'Create an Auralis playlist';
    }
    const universe = $('#createGraphPlaylist');
    if (universe && !universe.dataset.v1011Polished) {
      universe.dataset.v1011Polished = 'true';
      universe.innerHTML = '<span class="v1011-inline-list" aria-hidden="true">☰</span> Create playlist';
    }
  }

  function removePreviewPosterBadges() {
    $$('.v9-graph-card').forEach(card => {
      const badge = $('.v9-graph-art i', card);
      if (badge && /30\s*s\s*preview/i.test(clean(badge.textContent))) {
        badge.classList.add('v1011-preview-badge-removed');
        badge.setAttribute('aria-hidden', 'true');
      }
      const preview = $('[data-v9-preview]', card);
      if (preview && !$('.v1011-preview-hint', preview)) {
        const label = clean(preview.textContent).replace(/^▶\s*/, '') || 'Preview';
        preview.innerHTML = `<span>▶ ${escapeHtml(label)}</span><small class="v1011-preview-hint">30 sec</small>`;
        preview.title = 'Play a 30-second catalog preview';
      }
    });
  }

  function graphTrackFromArtistRow(row, artistName) {
    const title = clean($('strong', row)?.textContent);
    const album = clean($('small', row)?.textContent);
    const artwork = $('.v9-detail-art img', row.closest('#graphModalBodyV9'))?.currentSrc || $('.v9-detail-art img', row.closest('#graphModalBodyV9'))?.src || '';
    return {
      id: `artist:${clean(artistName).toLowerCase()}:${title.toLowerCase()}`,
      graphId: `artist:${clean(artistName).toLowerCase()}:${title.toLowerCase()}`,
      kind: 'track',
      title,
      artist: clean(artistName),
      album,
      artwork,
      provider: 'YouTube',
      playbackMode: 'youtube'
    };
  }

  function artistTracks() {
    const body = $('#graphModalBodyV9');
    const kicker = clean($('.v9-detail-hero .eyebrow', body)?.textContent).toUpperCase();
    if (kicker !== 'ARTIST') return [];
    const artistName = clean($('.v9-detail-hero h2', body)?.textContent || $('#graphModalTitleV9')?.textContent);
    return $$('.v9-album-tracks .v9-album-row', body)
      .map(row => graphTrackFromArtistRow(row, artistName))
      .filter(track => track.title && track.artist);
  }

  function ensureArtistMix() {
    const body = $('#graphModalBodyV9');
    if (!body || !artistTracks().length || $('.v1011-artist-mix', body)) return;
    const anchor = $('.v9-stat-row', body) || $('.v9-detail-hero', body);
    if (!anchor) return;
    const bar = document.createElement('div');
    bar.className = 'v1011-artist-mix';
    bar.innerHTML = '<div><span class="v1011-list-icon" aria-hidden="true"><i></i><i></i><i></i></span><div><strong>Artist mix</strong><small>Play or queue the top tracks as one Auralis sequence.</small></div></div><div><button type="button" data-v1011-artist-play>▶ Play mix</button><button type="button" data-v1011-artist-queue>＋ Queue mix</button></div>';
    anchor.after(bar);

    $('[data-v1011-artist-play]', bar)?.addEventListener('click', async () => {
      const tracks = artistTracks();
      if (!tracks.length) return;
      const full = window.AuralisFullPlaybackV91;
      if (!full?.play) {
        toast('Full playback is still loading', 'Try the artist mix again in a moment.');
        return;
      }
      full.state.queue = tracks;
      full.state.index = 0;
      full.play(tracks[0]);
      toast('Artist mix started', `${tracks[0].artist} · ${tracks.length} top tracks`);
    });

    $('[data-v1011-artist-queue]', bar)?.addEventListener('click', () => {
      const tracks = artistTracks();
      if (!tracks.length || !window.AuralisPlayerUniverseV101?.addToQueue) return;
      tracks.slice(0, 10).forEach(track => window.AuralisPlayerUniverseV101.addToQueue(track));
      toast('Artist mix queued', `${tracks.length} top tracks are ready in Queue.`);
    });
  }

  function identityForHost(host) {
    const owner = host.closest('.music-card,.track-row,.queue-item,.player,.v9-graph-card,.v9-album-row,.v9-playlist-row,.v101-liked-row,.v91-playback-dock');
    if (!owner) return { title: '', artist: '' };
    if (owner.classList.contains('music-card')) return { title: clean($('h3', owner)?.textContent), artist: clean($('p', owner)?.textContent) };
    if (owner.classList.contains('track-row')) return { title: clean($('.row-title-copy strong', owner)?.textContent), artist: clean($('.row-title-copy span', owner)?.textContent) };
    if (owner.classList.contains('queue-item')) return { title: clean($('.queue-item-copy strong', owner)?.textContent), artist: clean(($('.queue-item-copy span', owner)?.textContent || '').split(' · ')[0]) };
    if (owner.classList.contains('player')) return { title: clean($('#playerTitle')?.textContent), artist: clean($('#playerArtist')?.textContent) };
    if (owner.classList.contains('v9-graph-card')) {
      const parts = clean($('.v9-graph-copy > span', owner)?.textContent).split(' · ');
      return { title: clean($('.v9-graph-copy > strong', owner)?.textContent), artist: parts[0] || '' };
    }
    if (owner.classList.contains('v9-album-row') || owner.classList.contains('v9-playlist-row')) {
      const body = owner.closest('#graphModalBodyV9');
      const kicker = clean($('.v9-detail-hero .eyebrow', body)?.textContent).toUpperCase();
      const modalTitle = clean($('.v9-detail-hero h2', body)?.textContent || $('#graphModalTitleV9')?.textContent);
      const secondary = clean($('small', owner)?.textContent);
      return {
        title: clean($('strong', owner)?.textContent),
        artist: kicker === 'ARTIST' ? modalTitle : secondary
      };
    }
    if (owner.classList.contains('v101-liked-row')) return { title: clean($('strong', owner)?.textContent), artist: clean($('span', owner)?.textContent) };
    return { title: clean($('#fullPlaybackTitleV91')?.textContent), artist: clean($('#fullPlaybackArtistV91')?.textContent) };
  }

  function artKey(identity) {
    return `${clean(identity.title).toLowerCase()}::${clean(identity.artist).toLowerCase()}`;
  }

  function exactish(value) {
    return clean(value).toLowerCase().normalize('NFKD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-z0-9]+/g, ' ').trim();
  }

  function chooseArtwork(items, identity) {
    const wantedTitle = exactish(identity.title);
    const wantedArtist = exactish(identity.artist);
    return (items || [])
      .map(item => {
        const title = exactish(item.title);
        const artist = exactish(item.artist);
        let score = title === wantedTitle ? 20 : title.includes(wantedTitle) || wantedTitle.includes(title) ? 10 : 0;
        if (artist === wantedArtist) score += 14;
        else if (artist && wantedArtist && (artist.includes(wantedArtist) || wantedArtist.includes(artist))) score += 7;
        const artwork = clean(item.artwork || item.artworkFallback || '');
        if (artwork) score += 3;
        return { artwork, score };
      })
      .filter(entry => entry.artwork && entry.score >= 20)
      .sort((a, b) => b.score - a.score)[0]?.artwork || '';
  }

  async function canonicalArtwork(identity) {
    const key = artKey(identity);
    if (!identity.title || !identity.artist) return '';
    if (state.artworkCache.has(key)) return state.artworkCache.get(key);
    const request = (async () => {
      try {
        const url = new URL('/api/catalog', location.origin);
        url.searchParams.set('mode', 'search');
        url.searchParams.set('kind', 'track');
        url.searchParams.set('q', `${identity.title} ${identity.artist}`);
        url.searchParams.set('limit', '8');
        const response = await fetch(url, { headers: { Accept: 'application/json' } });
        if (!response.ok) return '';
        const json = await response.json();
        return chooseArtwork(json.items || [], identity);
      } catch {
        return '';
      }
    })();
    state.artworkCache.set(key, request);
    return request;
  }

  function ensureBrandedFallback(host, identity) {
    if (!host || $('.v1011-branded-art', host)) return;
    const title = clean(identity.title);
    const letter = (title.match(/[\p{L}\p{N}]/u)?.[0] || 'A').toLocaleUpperCase();
    const fallback = document.createElement('span');
    fallback.className = 'v1011-branded-art';
    fallback.setAttribute('aria-hidden', 'true');
    fallback.innerHTML = `<i>A</i><b>${escapeHtml(letter)}</b><small>AURALIS</small>`;
    host.prepend(fallback);
    host.classList.add('v1011-art-fallback-active');
  }

  function installArtwork(host, url, identity) {
    if (!host || !url) return;
    let img = $('img', host);
    if (!img) {
      img = document.createElement('img');
      img.alt = `${identity.title || 'Track'} artwork`;
      img.loading = 'lazy';
      img.referrerPolicy = 'no-referrer';
      const badge = $('.provider-badge', host);
      if (badge) badge.after(img);
      else host.prepend(img);
    }
    img.style.display = '';
    img.removeAttribute('onerror');
    img.dataset.v1011Recovering = 'true';
    img.addEventListener('load', () => {
      host.classList.remove('image-failed', 'auralis-art-failed-v92', 'v1011-art-fallback-active');
      $('.v1011-branded-art', host)?.remove();
      img.dataset.v1011Recovering = 'false';
    }, { once: true });
    img.addEventListener('error', () => {
      img.dataset.v1011Recovering = 'false';
      img.remove();
      ensureBrandedFallback(host, identity);
    }, { once: true });
    img.src = url;
  }

  async function recoverArtworkHost(host) {
    if (!host || host.dataset.v1011ArtChecked === 'true' || state.artworkPending.has(host)) return;
    const image = $('img', host);
    if (image?.complete && image.naturalWidth && image.style.display !== 'none') {
      host.dataset.v1011ArtChecked = 'true';
      return;
    }
    const identity = identityForHost(host);
    if (!identity.title) return;
    state.artworkPending.add(host);
    try {
      if (image && !image.complete) {
        image.addEventListener('load', () => { host.dataset.v1011ArtChecked = 'true'; }, { once: true });
        image.addEventListener('error', () => { host.dataset.v1011ArtChecked = 'false'; scheduleScan(); }, { once: true });
        return;
      }
      const artwork = identity.artist ? await canonicalArtwork(identity) : '';
      if (artwork && host.isConnected) installArtwork(host, artwork, identity);
      else if (host.isConnected) ensureBrandedFallback(host, identity);
      host.dataset.v1011ArtChecked = 'true';
    } finally {
      state.artworkPending.delete(host);
    }
  }

  function scanArtwork() {
    $$(ART_HOST_SELECTOR).forEach(host => {
      const img = $('img', host);
      if (img && !img.dataset.v1011ErrorBound) {
        img.dataset.v1011ErrorBound = 'true';
        img.addEventListener('error', () => {
          host.dataset.v1011ArtChecked = 'false';
          void recoverArtworkHost(host);
        }, true);
      }
      if (!img || (img.complete && (!img.naturalWidth || img.style.display === 'none'))) void recoverArtworkHost(host);
    });
  }

  function polish() {
    state.scanQueued = false;
    fixPlaylistDialog();
    polishPlaylistEntryPoints();
    ensureVideoButtonPlacement();
    ensureDockControls();
    removePreviewPosterBadges();
    ensureArtistMix();
    scanArtwork();
    syncVideoPresentation();
  }

  function scheduleScan() {
    if (state.scanQueued) return;
    state.scanQueued = true;
    requestAnimationFrame(polish);
  }

  function captureClicks(event) {
    const video = event.target.closest('#videoModeToggleV101');
    if (video) {
      event.preventDefault();
      event.stopImmediatePropagation();
      setVideoExpanded(!state.expandedVideo);
      return;
    }

    const minimize = event.target.closest('#minimizeVideoV1011');
    if (minimize) {
      event.preventDefault();
      event.stopImmediatePropagation();
      setVideoExpanded(false);
    }
  }

  function start() {
    loadCss();
    document.body.classList.add('v1011-video-ready');
    window.AuralisPlayerUniverseV101?.setVideoMode?.(true);
    polish();

    const observer = new MutationObserver(scheduleScan);
    observer.observe(document.body, { childList: true, subtree: true, attributes: true, attributeFilter: ['class'] });

    document.addEventListener('click', captureClicks, true);
    document.addEventListener('pointerdown', event => {
      if (event.target.closest('#fullPlaybackDockV91 .v91-dock-head')) beginDrag(event);
    }, true);
    window.addEventListener('pointermove', moveDrag, { passive: true });
    window.addEventListener('pointerup', endDrag, { passive: true });
    window.addEventListener('resize', () => {
      clampDock();
      scheduleScan();
    });

    if ('ResizeObserver' in window) {
      let timer = null;
      const resizeObserver = new ResizeObserver(() => {
        if (!state.expandedVideo || state.dragging) return;
        clearTimeout(timer);
        timer = setTimeout(() => { clampDock(); saveVideoLayout(); }, 180);
      });
      const dock = $('#fullPlaybackDockV91');
      if (dock) resizeObserver.observe(dock);
    }

    setInterval(() => {
      if (!window.AuralisFullPlaybackV91?.state?.active && state.expandedVideo) state.expandedVideo = false;
      syncVideoPresentation();
    }, 500);

    window.AuralisProductPolishV1011 = {
      version: VERSION,
      setVideoExpanded,
      repairArtwork: scanArtwork,
      artistTracks
    };
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start, { once: true });
  else start();
})();
