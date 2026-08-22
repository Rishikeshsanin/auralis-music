(() => {
  const VERSION = '9.1';
  const CACHE_KEY = 'auralis:youtube-resolver:v1';
  const CACHE_TTL = 24 * 60 * 60 * 1000;
  const $ = (selector, root = document) => root.querySelector(selector);
  const $$ = (selector, root = document) => [...root.querySelectorAll(selector)];
  const clean = value => String(value || '').replace(/\s+/g, ' ').trim();
  const escapeHtml = (value = '') => String(value).replace(/[&<>'"]/g, char => ({
    '&':'&amp;', '<':'&lt;', '>':'&gt;', "'":'&#039;', '"':'&quot;'
  }[char]));

  const state = {
    active: false,
    resolving: false,
    queue: [],
    index: -1,
    track: null,
    video: null,
    player: null,
    apiPromise: null,
    timer: null
  };

  function toast(title, detail = '') {
    const region = $('#toastRegion');
    if (!region) return;
    const node = document.createElement('div');
    node.className = 'toast v9-toast v91-toast';
    node.innerHTML = `<strong>${escapeHtml(title)}</strong>${detail ? `<small>${escapeHtml(detail)}</small>` : ''}`;
    region.append(node);
    setTimeout(() => node.remove(), 4200);
  }

  function loadCss() {
    if ($('#auralisV91Css')) return;
    const link = document.createElement('link');
    link.id = 'auralisV91Css';
    link.rel = 'stylesheet';
    link.href = './experience-v9-1.css';
    document.head.append(link);
  }

  function loadCache() {
    try {
      const parsed = JSON.parse(localStorage.getItem(CACHE_KEY) || '{}');
      return parsed && typeof parsed === 'object' ? parsed : {};
    } catch {
      return {};
    }
  }

  function saveCache(cache) {
    try { localStorage.setItem(CACHE_KEY, JSON.stringify(cache)); } catch {}
  }

  function cacheKey(track) {
    return [track.title, track.artist, track.album].map(value => clean(value).toLowerCase()).join('|');
  }

  function cachedVideo(track) {
    const cache = loadCache();
    const entry = cache[cacheKey(track)];
    if (!entry || Date.now() - Number(entry.savedAt || 0) > CACHE_TTL) return null;
    return entry.video || null;
  }

  function rememberVideo(track, video) {
    if (!video?.id) return;
    const cache = loadCache();
    cache[cacheKey(track)] = { savedAt: Date.now(), video };
    const entries = Object.entries(cache)
      .sort((a, b) => Number(b[1]?.savedAt || 0) - Number(a[1]?.savedAt || 0))
      .slice(0, 180);
    saveCache(Object.fromEntries(entries));
  }

  function ensureDock() {
    if ($('#fullPlaybackDockV91')) return;
    document.body.insertAdjacentHTML('beforeend', `
      <aside class="v91-playback-dock" id="fullPlaybackDockV91" aria-hidden="true">
        <div class="v91-dock-head">
          <div><span class="v91-source-dot"></span><strong>FULL PLAYBACK</strong><small>YouTube · official embed</small></div>
          <button id="closeFullPlaybackV91" aria-label="Stop full playback">×</button>
        </div>
        <div class="v91-video-shell">
          <div id="youtubePlayerMountV91"></div>
          <div class="v91-video-loader" id="youtubeLoaderV91"><i></i><span>Resolving the best full source…</span></div>
        </div>
        <div class="v91-now-playing">
          <div class="v91-now-art" id="fullPlaybackArtV91"><span>A</span></div>
          <div><strong id="fullPlaybackTitleV91">Auralis</strong><span id="fullPlaybackArtistV91">Full playback</span><small id="fullPlaybackMatchV91">Waiting for a track</small></div>
        </div>
      </aside>
    `);
    $('#closeFullPlaybackV91')?.addEventListener('click', stopFullPlayback);
  }

  function setDockOpen(open) {
    ensureDock();
    const dock = $('#fullPlaybackDockV91');
    dock?.classList.toggle('open', open);
    dock?.setAttribute('aria-hidden', open ? 'false' : 'true');
    document.body.classList.toggle('auralis-full-playback-v91', open);
  }

  function setLoader(message = 'Resolving the best full source…', active = true) {
    const loader = $('#youtubeLoaderV91');
    if (!loader) return;
    loader.classList.toggle('show', active);
    const span = $('span', loader);
    if (span) span.textContent = message;
  }

  function formatTime(seconds) {
    const value = Math.max(0, Math.floor(Number(seconds || 0)));
    const minutes = Math.floor(value / 60);
    return `${minutes}:${String(value % 60).padStart(2, '0')}`;
  }

  function playerNodes() {
    return {
      audio: $('#audio'),
      bar: $('#playerBar'),
      title: $('#playerTitle'),
      artist: $('#playerArtist'),
      source: $('#playerSource'),
      cover: $('#playerCover'),
      play: $('#playButton'),
      progress: $('#progressBar'),
      current: $('#currentTime'),
      duration: $('#durationTime'),
      volume: $('#volumeBar')
    };
  }

  function updateAuralisPlayer(track, video) {
    const nodes = playerNodes();
    nodes.audio?.pause();
    nodes.bar?.classList.remove('v9-preview-active');
    nodes.bar?.classList.add('v91-youtube-active');
    if (nodes.title) nodes.title.textContent = track.title || video.title || 'Full playback';
    if (nodes.artist) nodes.artist.textContent = track.artist || video.channel || 'YouTube';
    if (nodes.source) nodes.source.textContent = `YouTube · full playback · ${video.channel || 'official embed'}`;
    if (nodes.play) nodes.play.textContent = '❚❚';
    if (nodes.progress) nodes.progress.disabled = false;
    if (nodes.cover) {
      const artwork = track.artwork || video.artwork || '';
      nodes.cover.innerHTML = artwork
        ? `<img src="${escapeHtml(artwork)}" alt="${escapeHtml(track.title || video.title)} artwork" referrerpolicy="no-referrer"/>`
        : `<span>${escapeHtml((track.title || 'A')[0])}</span>`;
    }

    $('#fullPlaybackTitleV91').textContent = track.title || video.title || 'Full playback';
    $('#fullPlaybackArtistV91').textContent = track.artist || video.channel || 'YouTube';
    $('#fullPlaybackMatchV91').textContent = `${video.channel || 'YouTube'} · ${video.durationSeconds ? formatTime(video.durationSeconds) : 'full video'} · match ${video.matchScore ?? 'verified'}`;
    const art = $('#fullPlaybackArtV91');
    const artwork = track.artwork || video.artwork || '';
    if (art) art.innerHTML = artwork ? `<img src="${escapeHtml(artwork)}" alt="" referrerpolicy="no-referrer"/>` : `<span>${escapeHtml((track.title || 'A')[0])}</span>`;
  }

  function updateProgress() {
    if (!state.active || !state.player?.getCurrentTime) return;
    const nodes = playerNodes();
    const current = Number(state.player.getCurrentTime() || 0);
    const duration = Number(state.player.getDuration() || state.video?.durationSeconds || 0);
    if (nodes.current) nodes.current.textContent = formatTime(current);
    if (nodes.duration) nodes.duration.textContent = formatTime(duration);
    if (nodes.progress && duration > 0) nodes.progress.value = current / duration * 100;
  }

  function startProgressTimer() {
    clearInterval(state.timer);
    state.timer = setInterval(updateProgress, 500);
  }

  function loadYouTubeApi() {
    if (window.YT?.Player) return Promise.resolve(window.YT);
    if (state.apiPromise) return state.apiPromise;
    state.apiPromise = new Promise((resolve, reject) => {
      const previous = window.onYouTubeIframeAPIReady;
      window.onYouTubeIframeAPIReady = () => {
        try { previous?.(); } catch {}
        resolve(window.YT);
      };
      if (!document.querySelector('script[data-auralis-youtube-api]')) {
        const script = document.createElement('script');
        script.src = 'https://www.youtube.com/iframe_api';
        script.async = true;
        script.dataset.auralisYoutubeApi = 'true';
        script.onerror = () => reject(new Error('YouTube player API failed to load'));
        document.head.append(script);
      }
      setTimeout(() => {
        if (window.YT?.Player) resolve(window.YT);
      }, 5000);
    });
    return state.apiPromise;
  }

  async function resolveVideo(track) {
    const cached = cachedVideo(track);
    if (cached) return { ...cached, fromCache: true };
    const url = new URL('/api/youtube', location.origin);
    url.searchParams.set('title', track.title || '');
    if (track.artist) url.searchParams.set('artist', track.artist);
    if (track.album) url.searchParams.set('album', track.album);
    url.searchParams.set('limit', '8');
    const response = await fetch(url, { headers: { Accept: 'application/json' } });
    const json = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(json.error || `YouTube resolver failed (${response.status})`);
    if (!json.bestMatch) throw new Error('No reliable embeddable full-song match found');
    rememberVideo(track, json.bestMatch);
    return json.bestMatch;
  }

  function onYouTubeState(event) {
    if (!state.active) return;
    const nodes = playerNodes();
    const playing = window.YT && event.data === window.YT.PlayerState.PLAYING;
    const paused = window.YT && event.data === window.YT.PlayerState.PAUSED;
    const ended = window.YT && event.data === window.YT.PlayerState.ENDED;
    if (nodes.play && (playing || paused)) nodes.play.textContent = playing ? '❚❚' : '▶';
    if (playing) {
      setLoader('', false);
      startProgressTimer();
      const volume = Number(nodes.volume?.value ?? 0.8);
      try { state.player.setVolume(Math.round(volume * 100)); } catch {}
    }
    if (ended) nextFullTrack(1);
  }

  async function mountVideo(track, video) {
    ensureDock();
    setDockOpen(true);
    setLoader('Loading full playback…', true);
    updateAuralisPlayer(track, video);
    const YT = await loadYouTubeApi();
    try { state.player?.destroy?.(); } catch {}
    $('#youtubePlayerMountV91').innerHTML = '<div id="youtubeFrameV91"></div>';
    state.player = new YT.Player('youtubeFrameV91', {
      width: '100%',
      height: '100%',
      videoId: video.id,
      playerVars: { autoplay: 1, controls: 1, rel: 0, playsinline: 1, origin: location.origin },
      events: {
        onReady: event => {
          const volume = Number($('#volumeBar')?.value ?? 0.8);
          try { event.target.setVolume(Math.round(volume * 100)); event.target.playVideo(); } catch {}
          setLoader('Tap play if your browser blocked autoplay.', false);
          updateProgress();
        },
        onStateChange: onYouTubeState,
        onError: () => {
          setLoader('This YouTube source cannot play here. Trying the next route…', true);
          toast('YouTube source unavailable', 'Auralis will try the next track/source.');
          setTimeout(() => nextFullTrack(1), 700);
        }
      }
    });
  }

  async function playFullTrack(track, queue = null, index = null) {
    if (!track?.title || state.resolving) return;
    state.resolving = true;
    ensureDock();
    setDockOpen(true);
    setLoader(`Finding full playback for ${track.title}…`, true);
    if (Array.isArray(queue) && queue.length) {
      state.queue = queue;
      state.index = Number.isInteger(index) ? index : Math.max(0, queue.findIndex(item => item.title === track.title && item.artist === track.artist));
    } else if (!state.queue.length) {
      state.queue = [track];
      state.index = 0;
    }
    try {
      const video = await resolveVideo(track);
      state.active = true;
      state.track = track;
      state.video = video;
      await mountVideo(track, video);
      toast(video.fromCache ? 'Full source restored' : 'Full source resolved', `${track.title} · ${video.channel}`);
    } catch (error) {
      state.active = false;
      setLoader(error.message || 'Full playback unavailable', true);
      toast('Could not resolve full playback', error.message || 'Try another result.');
    } finally {
      state.resolving = false;
    }
  }

  function stopFullPlayback() {
    clearInterval(state.timer);
    try { state.player?.stopVideo?.(); state.player?.destroy?.(); } catch {}
    state.active = false;
    state.player = null;
    state.track = null;
    state.video = null;
    $('#playerBar')?.classList.remove('v91-youtube-active');
    if ($('#playButton')) $('#playButton').textContent = '▶';
    setDockOpen(false);
  }

  function nextFullTrack(delta = 1) {
    if (!state.queue.length || state.resolving) return;
    if (state.queue.length === 1) {
      try { state.player?.seekTo?.(0, true); state.player?.playVideo?.(); } catch {}
      return;
    }
    const length = state.queue.length;
    state.index = (state.index + delta + length) % length;
    const track = state.queue[state.index];
    state.active = false;
    playFullTrack(track, state.queue, state.index);
  }

  function splitSubtitle(value = '') {
    const parts = clean(value).split(' · ');
    return { artist: parts[0] || '', album: parts.slice(1).join(' · ') };
  }

  function trackFromGraphCard(card) {
    const title = clean($('.v9-graph-copy > strong', card)?.textContent);
    const subtitle = splitSubtitle($('.v9-graph-copy > span', card)?.textContent);
    return {
      title,
      artist: subtitle.artist,
      album: subtitle.album,
      artwork: $('.v9-graph-art img', card)?.src || ''
    };
  }

  function isTrackCard(card) {
    const badge = clean($('.v9-graph-art i', card)?.textContent).toUpperCase();
    return badge === '30S PREVIEW' || badge === 'CATALOG';
  }

  function trackFromRow(row) {
    const title = clean($('div > strong', row)?.textContent);
    const small = clean($('div > small', row)?.textContent);
    const modal = row.closest('#graphModalBodyV9');
    const kicker = clean($('.v9-detail-hero .eyebrow', modal)?.textContent).toUpperCase();
    const modalTitle = clean($('#graphModalTitleV9')?.textContent);
    if (kicker === 'ARTIST') return { title, artist: modalTitle, album: small, artwork: $('.v9-detail-art img', modal)?.src || '' };
    if (row.classList.contains('v9-playlist-row')) return { title, artist: small, album: '', artwork: '' };
    return { title, artist: small, album: modalTitle, artwork: $('.v9-detail-art img', modal)?.src || '' };
  }

  function trackFromDetail() {
    const body = $('#graphModalBodyV9');
    const title = clean($('.v9-detail-hero h2', body)?.textContent || $('#graphModalTitleV9')?.textContent);
    const line = clean($('.v9-detail-hero h2', body)?.nextElementSibling?.textContent);
    const parts = line.split(' · ');
    return { title, artist: parts[0] || '', album: parts.slice(1).join(' · '), artwork: $('.v9-detail-art img', body)?.src || '' };
  }

  function queueFromContainer(button, current) {
    const graphContainer = button.closest('.v9-graph-grid,.v9-rail-grid,.v9-chart-grid');
    if (graphContainer) {
      const queue = $$('.v9-graph-card', graphContainer).filter(isTrackCard).map(trackFromGraphCard).filter(item => item.title);
      const index = Math.max(0, queue.findIndex(item => item.title === current.title && item.artist === current.artist));
      return { queue, index };
    }
    const rows = button.closest('.v9-album-tracks,.v9-playlist-rows');
    if (rows) {
      const queue = $$(':scope > .v9-album-row,:scope > .v9-playlist-row', rows).map(trackFromRow).filter(item => item.title);
      const index = Math.max(0, queue.findIndex(item => item.title === current.title && item.artist === current.artist));
      return { queue, index };
    }
    return { queue: [current], index: 0 };
  }

  function scanFullPlayActions() {
    $$('.v9-graph-card').forEach(card => {
      if (!isTrackCard(card)) return;
      const actions = $('.v9-card-actions', card);
      if (!actions || $('[data-v91-full]', actions)) return;
      actions.insertAdjacentHTML('afterbegin', '<button class="v91-full-button" data-v91-full title="Play full song using Auralis resolver">▶ Full</button>');
    });

    $$('.v9-album-row,.v9-playlist-row').forEach(row => {
      if ($('[data-v91-row-full]', row)) return;
      const remove = $('[data-playlist-remove]', row);
      const button = document.createElement('button');
      button.className = 'v91-row-full';
      button.dataset.v91RowFull = 'true';
      button.title = 'Play full song';
      button.textContent = '▶ Full';
      if (remove) row.insertBefore(button, remove);
      else row.append(button);
    });

    const detail = $('#findFullV9');
    if (detail && !detail.dataset.v91FullDetail) {
      detail.dataset.v91FullDetail = 'true';
      detail.classList.add('v91-detail-full');
      detail.textContent = '▶ Play full song';
    }
  }

  function handleFullAction(event) {
    const graphButton = event.target.closest('[data-v91-full]');
    const rowButton = event.target.closest('[data-v91-row-full]');
    const detailButton = event.target.closest('[data-v91-full-detail]');
    const button = graphButton || rowButton || detailButton;
    if (!button) return false;
    event.preventDefault();
    event.stopImmediatePropagation();
    const track = graphButton ? trackFromGraphCard(graphButton.closest('.v9-graph-card')) : rowButton ? trackFromRow(rowButton.closest('.v9-album-row,.v9-playlist-row')) : trackFromDetail();
    if (!track.title) return true;
    const { queue, index } = queueFromContainer(button, track);
    playFullTrack(track, queue, index);
    return true;
  }

  function capturePlayerControls(event) {
    if (handleFullAction(event)) return;
    if (!state.active) return;
    const target = event.target;
    const player = state.player;

    if (target.closest('#playButton')) {
      event.preventDefault(); event.stopImmediatePropagation();
      try {
        const status = player?.getPlayerState?.();
        if (window.YT && status === window.YT.PlayerState.PLAYING) player.pauseVideo();
        else player?.playVideo?.();
      } catch {}
      return;
    }
    if (target.closest('#nextButton')) {
      event.preventDefault(); event.stopImmediatePropagation(); nextFullTrack(1); return;
    }
    if (target.closest('#prevButton')) {
      event.preventDefault(); event.stopImmediatePropagation(); nextFullTrack(-1); return;
    }

    if (target.closest('[data-play-index],[data-play-row],[data-radio-play],.music-card,.track-row,.radio-card') && !target.closest('.v9-graph-card,.v9-modal')) {
      stopFullPlayback();
    }
  }

  function captureRanges(event) {
    if (!state.active) return;
    if (event.target.matches('#progressBar')) {
      event.stopImmediatePropagation();
      try {
        const duration = Number(state.player?.getDuration?.() || 0);
        if (duration) state.player.seekTo(Number(event.target.value) / 100 * duration, true);
      } catch {}
    }
    if (event.target.matches('#volumeBar')) {
      event.stopImmediatePropagation();
      try { state.player?.setVolume?.(Math.round(Number(event.target.value) * 100)); } catch {}
    }
  }

  function start() {
    loadCss();
    ensureDock();
    scanFullPlayActions();
    const observer = new MutationObserver(() => requestAnimationFrame(scanFullPlayActions));
    observer.observe(document.body, { childList: true, subtree: true });
    window.addEventListener('click', capturePlayerControls, true);
    window.addEventListener('input', captureRanges, true);
    window.AuralisFullPlaybackV91 = {
      version: VERSION,
      play: track => playFullTrack(track),
      stop: stopFullPlayback,
      state
    };
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start, { once: true });
  else start();
})();
