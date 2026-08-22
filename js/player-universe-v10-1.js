(() => {
  const VERSION = '10.1';
  const GRAPH_LIKES_KEY = 'auralis:graph-likes:v1';
  const VIDEO_PREF_KEY = 'auralis:video-mode:v1';
  const $ = (selector, root = document) => root.querySelector(selector);
  const $$ = (selector, root = document) => [...root.querySelectorAll(selector)];
  const clean = value => String(value || '').replace(/\s+/g, ' ').trim();
  const escapeHtml = (value = '') => String(value).replace(/[&<>'"]/g, char => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#039;', '"': '&quot;'
  }[char]));

  const queueState = {
    items: [],
    currentIndex: -1,
    explicit: false,
    activePlayback: false,
    rendering: false,
    coreClearPass: false
  };

  let scanScheduled = false;
  let videoMode = loadVideoPreference();

  function loadCss() {
    if ($('#auralisV101Css')) return;
    const link = document.createElement('link');
    link.id = 'auralisV101Css';
    link.rel = 'stylesheet';
    link.href = './experience-v10-1.css';
    document.head.append(link);
  }

  function toast(title, detail = '') {
    const region = $('#toastRegion');
    if (!region) return;
    const node = document.createElement('div');
    node.className = 'toast v9-toast v101-toast';
    node.innerHTML = `<strong>${escapeHtml(title)}</strong>${detail ? `<small>${escapeHtml(detail)}</small>` : ''}`;
    region.append(node);
    setTimeout(() => node.remove(), 3600);
  }

  function slug(value = '') {
    return clean(value).toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 90);
  }

  function stableGraphId(track) {
    return track.graphId || `ui:${slug(track.title)}:${slug(track.artist)}`;
  }

  function normalizeGraphTrack(track = {}) {
    const title = clean(track.title);
    const artist = clean(track.artist);
    return {
      ...track,
      graphId: stableGraphId({ ...track, title, artist }),
      id: track.id || `graph:${stableGraphId({ ...track, title, artist })}`,
      kind: 'track',
      title,
      artist,
      album: clean(track.album),
      artwork: track.artwork || track.artworkFallback || '',
      provider: track.provider || 'YouTube',
      playbackMode: 'youtube'
    };
  }

  function sameGraphTrack(a, b) {
    if (!a || !b) return false;
    if (a.graphId && b.graphId && a.graphId === b.graphId) return true;
    return clean(a.title).toLowerCase() === clean(b.title).toLowerCase()
      && clean(a.artist).toLowerCase() === clean(b.artist).toLowerCase();
  }

  function getGraphLikes() {
    try {
      const value = JSON.parse(localStorage.getItem(GRAPH_LIKES_KEY) || '[]');
      return Array.isArray(value) ? value : [];
    } catch {
      return [];
    }
  }

  function saveGraphLikes(items) {
    try { localStorage.setItem(GRAPH_LIKES_KEY, JSON.stringify(items.slice(0, 200))); } catch {}
  }

  function isGraphLiked(track) {
    return getGraphLikes().some(item => sameGraphTrack(item, track));
  }

  function toggleGraphLike(track, announce = true) {
    const normalized = normalizeGraphTrack(track);
    if (!normalized.title) return false;
    const likes = getGraphLikes();
    const index = likes.findIndex(item => sameGraphTrack(item, normalized));
    const liked = index < 0;
    if (liked) likes.unshift(normalized);
    else likes.splice(index, 1);
    saveGraphLikes(likes);
    syncGraphLikeButtons();
    renderGraphLikes();
    syncPlayerGraphLike();
    if (announce) toast(liked ? 'Added to Liked Songs' : 'Removed from Liked Songs', normalized.title);
    return liked;
  }

  function graphTrackFromCard(card) {
    const title = clean($('.v9-graph-copy > strong', card)?.textContent);
    const parts = clean($('.v9-graph-copy > span', card)?.textContent).split(' · ');
    return normalizeGraphTrack({
      title,
      artist: parts.shift() || '',
      album: parts.join(' · '),
      artwork: $('.v9-graph-art img', card)?.currentSrc || $('.v9-graph-art img', card)?.src || '',
      provider: 'YouTube'
    });
  }

  function graphTrackFromRow(row) {
    const title = clean($('strong', row)?.textContent);
    const small = clean($('small', row)?.textContent);
    const modal = row.closest('#graphModalBodyV9');
    const kicker = clean($('.v9-detail-hero .eyebrow', modal)?.textContent).toUpperCase();
    const modalTitle = clean($('#graphModalTitleV9')?.textContent);
    let artist = small;
    let album = '';
    if (kicker === 'ARTIST') {
      artist = modalTitle;
      album = small;
    } else if (kicker === 'ALBUM') {
      artist = small;
      album = modalTitle;
    }
    return normalizeGraphTrack({
      title,
      artist,
      album,
      artwork: $('.v9-detail-art img', modal)?.currentSrc || $('.v9-detail-art img', modal)?.src || '',
      provider: 'YouTube'
    });
  }

  function graphTrackFromDetail() {
    const body = $('#graphModalBodyV9');
    const title = clean($('.v9-detail-hero h2', body)?.textContent || $('#graphModalTitleV9')?.textContent);
    const line = clean($('.v9-detail-hero h2', body)?.nextElementSibling?.textContent);
    const parts = line.split(' · ');
    return normalizeGraphTrack({
      title,
      artist: parts.shift() || '',
      album: parts.join(' · '),
      artwork: $('.v9-detail-art img', body)?.currentSrc || $('.v9-detail-art img', body)?.src || '',
      provider: 'YouTube'
    });
  }

  function graphTrackFromPlayer() {
    const full = window.AuralisFullPlaybackV91?.state;
    if (full?.active && full.track) return normalizeGraphTrack(full.track);
    return normalizeGraphTrack({
      title: clean($('#playerTitle')?.textContent),
      artist: clean($('#playerArtist')?.textContent),
      artwork: $('#playerCover img')?.currentSrc || $('#playerCover img')?.src || '',
      provider: 'YouTube'
    });
  }

  function directItemFromNode(node) {
    const card = node.closest('.music-card');
    if (card) {
      const target = $('[data-play-index]', card);
      return {
        id: `direct:${slug($('h3', card)?.textContent)}:${slug($('p', card)?.textContent)}`,
        title: clean($('h3', card)?.textContent),
        artist: clean($('p', card)?.textContent),
        artwork: $('.cover-wrap img', card)?.currentSrc || $('.cover-wrap img', card)?.src || '',
        provider: clean($('.provider-badge', card)?.textContent) || 'Auralis',
        playbackMode: 'direct',
        playTarget: target
      };
    }

    const row = node.closest('.track-row');
    if (row) {
      const target = $('[data-play-row]', row);
      return {
        id: `direct:${slug($('.row-title-copy strong', row)?.textContent)}:${slug($('.row-title-copy span', row)?.textContent)}`,
        title: clean($('.row-title-copy strong', row)?.textContent),
        artist: clean($('.row-title-copy span', row)?.textContent),
        artwork: $('.row-cover img', row)?.currentSrc || $('.row-cover img', row)?.src || '',
        provider: clean($('.provider-badge', row)?.textContent) || 'Auralis',
        playbackMode: 'direct',
        playTarget: target
      };
    }

    const radio = node.closest('.radio-card');
    if (radio) {
      const target = $('[data-radio-play]', radio);
      return {
        id: `radio:${slug($('.radio-copy strong', radio)?.textContent)}`,
        title: clean($('.radio-copy strong', radio)?.textContent),
        artist: clean($('.radio-copy small', radio)?.textContent) || 'Live radio',
        artwork: $('.radio-logo img', radio)?.currentSrc || $('.radio-logo img', radio)?.src || '',
        provider: 'Radio Browser',
        playbackMode: 'direct',
        isLive: true,
        playTarget: target
      };
    }
    return null;
  }

  function queueDisplayProvider(item) {
    if (item.playbackMode === 'youtube') return 'YouTube · full video';
    if (item.isLive) return `${item.provider || 'Radio'} · LIVE`;
    return item.provider || 'Auralis';
  }

  function enqueue(item) {
    if (!item?.title) return;
    queueState.explicit = true;
    queueState.items.push(item);
    renderUnifiedQueue();
    toast('Added to queue', `${item.title} · ${queueDisplayProvider(item)}`);
  }

  function renderUnifiedQueue() {
    if (!queueState.explicit || queueState.rendering) return;
    const list = $('#queueList');
    const count = $('#queueCount');
    if (!list) return;
    queueState.rendering = true;
    list.innerHTML = queueState.items.length
      ? `<div class="v101-unified-queue">${queueState.items.map((item, index) => `<div class="queue-item v101-queue-item ${index === queueState.currentIndex ? 'v101-current' : ''}" data-v101-queue-index="${index}">
          <button class="v101-queue-play" data-v101-queue-play="${index}" aria-label="Play ${escapeHtml(item.title)}">${index === queueState.currentIndex ? '▶' : '▷'}</button>
          <div class="queue-item-cover">${item.artwork ? `<img src="${escapeHtml(item.artwork)}" alt="" referrerpolicy="no-referrer"/>` : '<span>♪</span>'}</div>
          <div class="queue-item-copy"><strong>${escapeHtml(item.title)}</strong><span>${escapeHtml(item.artist || '')} · ${escapeHtml(queueDisplayProvider(item))}</span></div>
          <button class="queue-remove" data-v101-queue-remove="${index}" aria-label="Remove from queue">×</button>
        </div>`).join('')}</div>`
      : '<div class="v101-unified-queue"><div class="empty-state"><strong>Queue is empty</strong>Add any song, Music Graph result or radio station.</div></div>';
    if (count) count.textContent = String(queueState.items.length);
    queueState.rendering = false;
  }

  function portableQueue() {
    return queueState.items.map(item => ({
      id: item.id,
      graphId: item.graphId,
      title: item.title,
      artist: item.artist,
      album: item.album || '',
      artwork: item.artwork || '',
      provider: item.provider || 'Auralis',
      playbackMode: item.playbackMode || 'direct',
      isLive: Boolean(item.isLive)
    }));
  }

  async function waitForFullPlayback(timeout = 3500) {
    const started = Date.now();
    while (!window.AuralisFullPlaybackV91?.play && Date.now() - started < timeout) {
      await new Promise(resolve => setTimeout(resolve, 50));
    }
    return window.AuralisFullPlaybackV91 || null;
  }

  async function playQueueIndex(index) {
    const item = queueState.items[index];
    if (!item) return;
    queueState.currentIndex = index;
    queueState.activePlayback = true;
    renderUnifiedQueue();

    if (item.playbackMode === 'youtube') {
      const full = await waitForFullPlayback();
      if (!full) {
        toast('Full playback is still loading', 'Try again in a moment.');
        return;
      }
      full.state.queue = portableQueue();
      full.state.index = index;
      full.play(normalizeGraphTrack(item));
      return;
    }

    window.AuralisFullPlaybackV91?.stop?.();
    if (item.playTarget?.click) {
      item.playTarget.click();
      return;
    }
    toast('This queue item expired', 'Open the song again and add it back to the queue.');
  }

  function playRelative(delta) {
    if (!queueState.items.length) return;
    const base = queueState.currentIndex >= 0 ? queueState.currentIndex : 0;
    playQueueIndex((base + delta + queueState.items.length) % queueState.items.length);
  }

  function removeQueueIndex(index) {
    if (!queueState.items[index]) return;
    queueState.items.splice(index, 1);
    if (index < queueState.currentIndex) queueState.currentIndex -= 1;
    else if (index === queueState.currentIndex) queueState.currentIndex = Math.min(queueState.currentIndex, queueState.items.length - 1);
    if (!queueState.items.length) {
      queueState.currentIndex = -1;
      queueState.activePlayback = false;
    }
    renderUnifiedQueue();
  }

  function clearUnifiedQueue(button) {
    queueState.items = [];
    queueState.currentIndex = -1;
    queueState.activePlayback = false;
    queueState.explicit = false;
    const list = $('#queueList');
    if (list) list.innerHTML = '';
    const count = $('#queueCount');
    if (count) count.textContent = '0';

    if (button && !queueState.coreClearPass) {
      queueState.coreClearPass = true;
      button.click();
      queueState.coreClearPass = false;
    }
    toast('Queue cleared');
  }

  function loadVideoPreference() {
    try {
      const stored = localStorage.getItem(VIDEO_PREF_KEY);
      return stored === null ? true : stored !== 'off';
    } catch {
      return true;
    }
  }

  function saveVideoPreference() {
    try { localStorage.setItem(VIDEO_PREF_KEY, videoMode ? 'on' : 'off'); } catch {}
  }

  function ensureVideoToggle() {
    const extras = $('.player-extras');
    const queue = $('#mobileQueueButton');
    if (!extras || !queue || $('#videoModeToggleV101')) return;
    const button = document.createElement('button');
    button.id = 'videoModeToggleV101';
    button.type = 'button';
    button.className = 'v101-video-toggle';
    button.innerHTML = '<span aria-hidden="true">▣</span><small>Video</small>';
    button.setAttribute('aria-label', 'Toggle video player mode');
    button.addEventListener('click', () => {
      videoMode = !videoMode;
      saveVideoPreference();
      syncVideoMode();
      toast(videoMode ? 'Video mode on' : 'Video mode off', videoMode ? 'YouTube full playback will show the embedded video player.' : 'Full songs keep playing while the video panel stays hidden.');
    });
    extras.insertBefore(button, queue);
  }

  function syncVideoMode() {
    ensureVideoToggle();
    document.body.classList.toggle('v101-video-mode-off', !videoMode);
    const button = $('#videoModeToggleV101');
    const active = Boolean(window.AuralisFullPlaybackV91?.state?.active);
    if (button) {
      button.classList.toggle('active', videoMode);
      button.classList.toggle('playing-video', active);
      button.setAttribute('aria-pressed', String(videoMode));
      button.title = active
        ? (videoMode ? 'Hide video player (audio keeps playing)' : 'Show video player')
        : (videoMode ? 'Video mode is on for full playback' : 'Video mode is off for full playback');
    }
  }

  function addQueueControl(target, kind) {
    if (!target || $('[data-v101-add-queue]', target)) return;
    const button = document.createElement('button');
    button.type = 'button';
    button.dataset.v101AddQueue = kind;
    button.className = `v101-add-queue v101-add-queue-${kind}`;
    button.textContent = kind === 'graph' ? '＋ Queue' : '＋';
    button.title = 'Add to Auralis queue';
    button.setAttribute('aria-label', 'Add to queue');
    button.addEventListener('click', event => {
      event.preventDefault();
      event.stopPropagation();
      event.stopImmediatePropagation();
      const item = kind === 'graph'
        ? graphTrackFromCard(target.closest('.v9-graph-card'))
        : kind === 'graph-row'
          ? graphTrackFromRow(target.closest('.v9-album-row,.v9-playlist-row'))
          : directItemFromNode(target);
      if (item?.title) enqueue(item);
    });
    target.append(button);
  }

  function addGraphLikeControl(card) {
    const actions = $('.v9-card-actions', card);
    if (!actions || $('[data-v101-graph-like]', actions)) return;
    const button = document.createElement('button');
    button.type = 'button';
    button.dataset.v101GraphLike = 'true';
    button.className = 'v101-graph-like';
    button.title = 'Like this song';
    button.addEventListener('click', event => {
      event.preventDefault();
      event.stopPropagation();
      event.stopImmediatePropagation();
      toggleGraphLike(graphTrackFromCard(card));
    });
    actions.append(button);
  }

  function addGraphRowControls(row) {
    if (!$('[data-v101-graph-like]', row)) {
      const like = document.createElement('button');
      like.type = 'button';
      like.dataset.v101GraphLike = 'row';
      like.className = 'v101-graph-like v101-row-like';
      like.title = 'Like this song';
      like.addEventListener('click', event => {
        event.preventDefault();
        event.stopPropagation();
        event.stopImmediatePropagation();
        toggleGraphLike(graphTrackFromRow(row));
      });
      row.append(like);
    }
    if (!$('[data-v101-add-queue]', row)) addQueueControl(row, 'graph-row');
  }

  function enhanceTrackDetail() {
    const actions = $('#graphModalBodyV9 .v9-detail-actions');
    if (!actions || !$('#findFullV9', actions)) return;
    if (!$('#detailLikeV101', actions)) {
      const like = document.createElement('button');
      like.id = 'detailLikeV101';
      like.className = 'ghost-button v101-detail-like';
      like.type = 'button';
      like.addEventListener('click', () => toggleGraphLike(graphTrackFromDetail()));
      actions.append(like);
    }
    if (!$('#detailQueueV101', actions)) {
      const queue = document.createElement('button');
      queue.id = 'detailQueueV101';
      queue.className = 'ghost-button v101-detail-queue';
      queue.type = 'button';
      queue.textContent = '＋ Add to queue';
      queue.addEventListener('click', () => enqueue(graphTrackFromDetail()));
      actions.append(queue);
    }
  }

  function syncGraphLikeButtons() {
    $$('.v9-graph-card').forEach(card => {
      const button = $('[data-v101-graph-like]', card);
      if (!button) return;
      const liked = isGraphLiked(graphTrackFromCard(card));
      button.classList.toggle('liked', liked);
      button.textContent = liked ? '♥' : '♡';
      button.setAttribute('aria-label', liked ? 'Unlike song' : 'Like song');
    });
    $$('.v9-album-row,.v9-playlist-row').forEach(row => {
      const button = $('[data-v101-graph-like]', row);
      if (!button) return;
      const liked = isGraphLiked(graphTrackFromRow(row));
      button.classList.toggle('liked', liked);
      button.textContent = liked ? '♥' : '♡';
    });
    const detail = $('#detailLikeV101');
    if (detail) {
      const liked = isGraphLiked(graphTrackFromDetail());
      detail.classList.toggle('liked', liked);
      detail.textContent = liked ? '♥ Liked' : '♡ Like song';
    }
  }

  function renderGraphLikes() {
    const view = $('#likedView');
    const base = $('#likedList');
    if (!view || !base) return;
    let section = $('#graphLikedV101');
    if (!section) {
      section = document.createElement('section');
      section.id = 'graphLikedV101';
      section.className = 'v101-graph-liked';
      base.before(section);
    }
    const likes = getGraphLikes().map(normalizeGraphTrack);
    if (!likes.length) {
      section.innerHTML = '';
      section.hidden = true;
      return;
    }
    section.hidden = false;
    section.innerHTML = `<div class="v101-liked-head"><div><p class="eyebrow">MUSIC GRAPH + VIDEO</p><h2>Catalog favorites</h2></div><span>${likes.length} saved</span></div>
      <div class="v101-liked-list">${likes.map((item, index) => `<div class="v101-liked-row">
        <div class="v101-liked-art">${item.artwork ? `<img src="${escapeHtml(item.artwork)}" alt="" referrerpolicy="no-referrer"/>` : '<span>♪</span>'}</div>
        <div><strong>${escapeHtml(item.title)}</strong><span>${escapeHtml(item.artist || 'Auralis Music Graph')}</span></div>
        <button data-v101-liked-play="${index}">▶ Full song</button>
        <button data-v101-liked-queue="${index}" title="Add to queue">＋</button>
        <button data-v101-liked-remove="${index}" title="Unlike">♥</button>
      </div>`).join('')}</div>`;
    $$('[data-v101-liked-play]', section).forEach(button => button.addEventListener('click', () => {
      queueState.items = likes.map(item => ({ ...item, playbackMode: 'youtube' }));
      queueState.explicit = true;
      playQueueIndex(Number(button.dataset.v101LikedPlay));
    }));
    $$('[data-v101-liked-queue]', section).forEach(button => button.addEventListener('click', () => enqueue(likes[Number(button.dataset.v101LikedQueue)])));
    $$('[data-v101-liked-remove]', section).forEach(button => button.addEventListener('click', () => toggleGraphLike(likes[Number(button.dataset.v101LikedRemove)])));
  }

  function syncPlayerGraphLike() {
    const player = $('#playerBar');
    const button = $('#playerLike');
    if (!player || !button) return;
    const graphMode = player.classList.contains('v91-youtube-active') || player.classList.contains('v9-preview-active');
    if (!graphMode) return;
    const liked = isGraphLiked(graphTrackFromPlayer());
    button.classList.toggle('liked', liked);
    button.textContent = liked ? '♥' : '♡';
    button.setAttribute('aria-label', liked ? 'Unlike current song' : 'Like current song');
  }

  function enhanceSearchResults() {
    const rail = $('#graphSearchRailV9');
    if (rail && $('#openUniverseForQueryV9', rail) && !$('.v101-search-more', rail)) {
      const footer = document.createElement('div');
      footer.className = 'v101-search-more';
      footer.innerHTML = '<button type="button" class="ghost-button">View more results →</button><span>Open the full Music Graph when you need another version, release or match.</span>';
      $('button', footer).addEventListener('click', () => $('#openUniverseForQueryV9', rail)?.click());
      rail.append(footer);
    }
    const more = $('#graphMoreButton');
    if (more && !more.disabled && more.textContent !== 'View more results') more.textContent = 'View more results';
  }

  function polishFullButtons() {
    $$('[data-v91-full]').forEach(button => {
      button.textContent = '▶ Full song';
      button.title = 'Play the full song with the official YouTube player';
    });
  }

  function scan() {
    scanScheduled = false;
    ensureVideoToggle();

    $$('.music-card').forEach(card => {
      const wrap = $('.cover-wrap', card);
      if (wrap) addQueueControl(wrap, 'card');
    });
    $$('.track-row').forEach(row => addQueueControl(row, 'row'));
    $$('.radio-card').forEach(card => addQueueControl(card, 'radio'));

    $$('.v9-graph-card').forEach(card => {
      const actions = $('.v9-card-actions', card);
      if (!actions) return;
      if (!$('[data-v101-add-queue]', actions)) addQueueControl(actions, 'graph');
      addGraphLikeControl(card);
    });
    $$('.v9-album-row,.v9-playlist-row').forEach(addGraphRowControls);

    enhanceTrackDetail();
    syncGraphLikeButtons();
    renderGraphLikes();
    enhanceSearchResults();
    polishFullButtons();
    syncVideoMode();

    if (queueState.explicit) {
      const list = $('#queueList');
      if (list && !$('.v101-unified-queue', list)) renderUnifiedQueue();
      const count = $('#queueCount');
      if (count) count.textContent = String(queueState.items.length);
    }
  }

  function scheduleScan() {
    if (scanScheduled) return;
    scanScheduled = true;
    requestAnimationFrame(scan);
  }

  function captureControls(event) {
    const target = event.target;

    if (target.closest('#playerLike')) {
      const player = $('#playerBar');
      const graphMode = player?.classList.contains('v91-youtube-active') || player?.classList.contains('v9-preview-active');
      if (graphMode) {
        event.preventDefault();
        event.stopImmediatePropagation();
        toggleGraphLike(graphTrackFromPlayer());
        return;
      }
    }

    const play = target.closest('[data-v101-queue-play]');
    if (play) {
      event.preventDefault();
      event.stopImmediatePropagation();
      playQueueIndex(Number(play.dataset.v101QueuePlay));
      return;
    }

    const remove = target.closest('[data-v101-queue-remove]');
    if (remove) {
      event.preventDefault();
      event.stopImmediatePropagation();
      removeQueueIndex(Number(remove.dataset.v101QueueRemove));
      return;
    }

    const clear = target.closest('#clearQueue');
    if (clear && queueState.explicit && !queueState.coreClearPass) {
      event.preventDefault();
      event.stopImmediatePropagation();
      clearUnifiedQueue(clear);
      return;
    }

    // Direct/open-stream playback is controlled by the base Auralis player.
    // When a user explicitly starts a unified queue from a direct item, capture
    // the bottom next/previous controls so that the mixed queue remains ordered.
    if (queueState.activePlayback && !window.AuralisFullPlaybackV91?.state?.active) {
      if (target.closest('#nextButton')) {
        event.preventDefault();
        event.stopImmediatePropagation();
        playRelative(1);
        return;
      }
      if (target.closest('#prevButton')) {
        event.preventDefault();
        event.stopImmediatePropagation();
        playRelative(-1);
      }
    }
  }

  function syncFullQueueIndex() {
    const full = window.AuralisFullPlaybackV91?.state;
    if (!queueState.activePlayback || !full?.active || !queueState.items.length) return;
    const index = Number(full.index);
    if (Number.isInteger(index) && index >= 0 && index < queueState.items.length && index !== queueState.currentIndex) {
      queueState.currentIndex = index;
      renderUnifiedQueue();
    }
  }

  function start() {
    loadCss();
    ensureVideoToggle();
    renderGraphLikes();
    scan();

    const observer = new MutationObserver(scheduleScan);
    observer.observe(document.body, { childList: true, subtree: true, attributes: true, attributeFilter: ['class'] });
    window.addEventListener('click', captureControls, true);

    setInterval(() => {
      syncVideoMode();
      syncPlayerGraphLike();
      syncFullQueueIndex();
    }, 500);

    window.AuralisPlayerUniverseV101 = {
      version: VERSION,
      queue: queueState,
      addToQueue: enqueue,
      playQueueIndex,
      toggleGraphLike,
      getGraphLikes,
      get videoMode() { return videoMode; },
      setVideoMode(enabled) {
        videoMode = Boolean(enabled);
        saveVideoPreference();
        syncVideoMode();
      }
    };
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start, { once: true });
  else start();
})();