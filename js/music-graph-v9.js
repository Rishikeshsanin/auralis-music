(() => {
  const VERSION = '9.0';
  const PLAYLIST_KEY = 'auralis:playlists:v2';
  const GRAPH_LIKES_KEY = 'auralis:graph-likes:v1';
  const $ = (s, root = document) => root.querySelector(s);
  const $$ = (s, root = document) => [...root.querySelectorAll(s)];
  const clean = value => String(value || '').replace(/\s+/g, ' ').trim();
  const escapeHtml = (value = '') => String(value).replace(/[&<>'"]/g, char => ({
    '&':'&amp;', '<':'&lt;', '>':'&gt;', "'":'&#039;', '"':'&quot;'
  }[char]));

  const state = {
    kind: 'track',
    query: '',
    results: [],
    chart: [],
    providers: [],
    searchTimer: null,
    globalSearchTimer: null,
    preview: {
      active: false,
      queue: [],
      index: -1,
      item: null
    }
  };

  function loadCss() {
    if ($('#auralisV9Css')) return;
    const link = document.createElement('link');
    link.id = 'auralisV9Css';
    link.rel = 'stylesheet';
    link.href = './experience-v9.css';
    document.head.append(link);
  }

  function getPlaylists() {
    try {
      const value = JSON.parse(localStorage.getItem(PLAYLIST_KEY) || '[]');
      return Array.isArray(value) ? value : [];
    } catch {
      return [];
    }
  }

  function savePlaylists(playlists) {
    try { localStorage.setItem(PLAYLIST_KEY, JSON.stringify(playlists)); } catch {}
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
    try { localStorage.setItem(GRAPH_LIKES_KEY, JSON.stringify(items)); } catch {}
  }

  function toast(title, detail = '') {
    const region = $('#toastRegion');
    if (!region) return;
    const node = document.createElement('div');
    node.className = 'toast v9-toast';
    node.innerHTML = `<strong>${escapeHtml(title)}</strong>${detail ? `<small>${escapeHtml(detail)}</small>` : ''}`;
    region.append(node);
    setTimeout(() => node.remove(), 3600);
  }

  function formatTime(seconds) {
    const value = Number(seconds || 0);
    if (!Number.isFinite(value) || value <= 0) return '';
    const minutes = Math.floor(value / 60);
    const rest = String(Math.floor(value % 60)).padStart(2, '0');
    return `${minutes}:${rest}`;
  }

  function compact(value) {
    const number = Number(value || 0);
    if (!number) return '';
    return Intl.NumberFormat('en', { notation: 'compact', maximumFractionDigits: 1 }).format(number);
  }

  function activeView(view) {
    $$('.view').forEach(node => node.classList.remove('active-view'));
    $(`#${view}View`)?.classList.add('active-view');
    $$('[data-view]').forEach(button => button.classList.toggle('active', button.dataset.view === view));
    $$('[data-v9-view]').forEach(button => button.classList.toggle('active', button.dataset.v9View === view));
    const scroll = $('#contentScroll');
    if (scroll) scroll.scrollTop = 0;
  }

  function injectShell() {
    if ($('#universeView')) return;

    const liveRadioNav = $('[data-view="radio"]');
    const button = document.createElement('button');
    button.className = 'nav-item v9-nav';
    button.dataset.v9View = 'universe';
    button.innerHTML = '<span>◈</span> Universe';
    button.addEventListener('click', () => activeView('universe'));
    liveRadioNav?.before(button);

    const content = $('#contentScroll');
    content?.insertAdjacentHTML('beforeend', `
      <section id="universeView" class="view v9-universe-view">
        <div class="v9-universe-hero">
          <div class="v9-universe-copy">
            <p class="eyebrow">AURALIS MUSIC GRAPH · V${VERSION}</p>
            <h1>One song.<br/><em>Every useful source.</em></h1>
            <p>Auralis now separates music identity from playback. Search a broad commercial catalog, map canonical recording data, keep open full-track providers underneath, and resolve the best source without changing the Auralis experience.</p>
            <div class="v9-hero-badges">
              <span>Deezer catalog</span><span>MusicBrainz IDs</span><span>Cover Art Archive</span><span>Audius + Jamendo full streams</span><span>YouTube-ready</span>
            </div>
          </div>
          <div class="v9-graph-orbit" aria-hidden="true">
            <span class="v9-node v9-node-core">A</span>
            <span class="v9-node v9-node-a">♪</span>
            <span class="v9-node v9-node-b">◉</span>
            <span class="v9-node v9-node-c">YT</span>
            <span class="v9-node v9-node-d">MB</span>
            <i class="v9-orbit-line line-a"></i><i class="v9-orbit-line line-b"></i>
          </div>
        </div>

        <div class="v9-search-panel">
          <div class="v9-search-main"><span>⌕</span><input id="graphSearchInput" type="search" autocomplete="off" placeholder="Search almost any song, album or artist..." /><button id="graphSearchButton" class="primary-button">Search universe</button></div>
          <div class="v9-kind-tabs" id="graphKindTabs">
            <button class="active" data-graph-kind="track">Tracks</button>
            <button data-graph-kind="album">Albums</button>
            <button data-graph-kind="artist">Artists</button>
          </div>
          <p class="v9-search-note">Full playback is chosen only from providers that legally expose it. Mainstream catalog results may use a 30-second Deezer preview until an approved full-playback source is available.</p>
        </div>

        <section class="section-block v9-results-section">
          <div class="section-heading"><div><p class="eyebrow">UNIVERSAL CATALOG</p><h2 id="graphResultsTitle">Search the music graph</h2></div><span id="graphResultsMeta" class="v9-meta"></span></div>
          <div id="graphResults" class="v9-graph-grid"></div>
          <div class="load-more-wrap"><button id="graphMoreButton" class="ghost-button" hidden>Load more catalog results</button></div>
        </section>

        <section class="section-block">
          <div class="section-heading"><div><p class="eyebrow">GLOBAL PULSE</p><h2>Music people are opening right now</h2></div><button id="refreshGraphChart" class="text-button">Refresh</button></div>
          <div id="graphChart" class="v9-chart-grid"></div>
        </section>

        <section class="section-block">
          <div class="section-heading"><div><p class="eyebrow">YOUR SPACE</p><h2>Local Auralis playlists</h2></div><button id="createGraphPlaylist" class="text-button">＋ New playlist</button></div>
          <div id="graphPlaylists" class="v9-playlist-grid"></div>
        </section>

        <section class="section-block">
          <div class="section-heading"><div><p class="eyebrow">PROVIDER CONTROL PLANE</p><h2>Know what every API is doing</h2></div><button id="openProviderControlV9" class="text-button">Open Source Pulse →</button></div>
          <div id="providerPulsePreviewV9" class="v9-provider-preview"></div>
        </section>
      </section>
    `);

    const homeHero = $('#homeView .hero');
    homeHero?.insertAdjacentHTML('afterend', `
      <section class="section-block v9-home-graph">
        <div class="section-heading">
          <div><p class="eyebrow">AURALIS MUSIC GRAPH</p><h2>A much bigger catalog lives underneath the same player.</h2></div>
          <button class="text-button" id="openUniverseFromHome">Open Universe →</button>
        </div>
        <div class="v9-home-graph-grid">
          <button data-v9-home-action="search"><span>⌕</span><strong>Universal search</strong><small>Tracks, albums and artists beyond the open-stream catalogs.</small></button>
          <button data-v9-home-action="chart"><span>↗</span><strong>Global pulse</strong><small>Mainstream catalog discovery with proper artwork and metadata.</small></button>
          <button data-v9-home-action="playlists"><span>≡</span><strong>Auralis playlists</strong><small>Mix tracks from different catalog sources in one local playlist.</small></button>
          <button data-v9-home-action="providers"><span>◉</span><strong>Source Pulse</strong><small>Health, latency, capabilities, credentials and fallback state.</small></button>
        </div>
      </section>
    `);

    injectModals();
  }

  function injectModals() {
    if ($('#graphModalV9')) return;
    document.body.insertAdjacentHTML('beforeend', `
      <div class="v9-modal-backdrop" id="graphBackdropV9"></div>
      <aside class="v9-modal" id="graphModalV9" aria-hidden="true">
        <div class="v9-modal-head"><div><p class="eyebrow">AURALIS MUSIC GRAPH</p><h2 id="graphModalTitleV9">Details</h2></div><button class="icon-button" id="closeGraphModalV9">×</button></div>
        <div id="graphModalBodyV9" class="v9-modal-body"></div>
      </aside>

      <aside class="v9-modal v9-provider-modal" id="providerControlV9" aria-hidden="true">
        <div class="v9-modal-head"><div><p class="eyebrow">PROVIDER CONTROL PLANE</p><h2>Source Pulse</h2></div><button class="icon-button" id="closeProviderControlV9">×</button></div>
        <div class="v9-control-summary" id="providerControlSummaryV9"></div>
        <div id="providerControlBodyV9" class="v9-provider-list"></div>
      </aside>

      <dialog class="v9-dialog" id="playlistDialogV9">
        <form method="dialog" id="playlistFormV9">
          <div class="v9-dialog-head"><div><p class="eyebrow">AURALIS PLAYLIST</p><h2>Create playlist</h2></div><button value="cancel" class="icon-button">×</button></div>
          <label>Name<input id="playlistNameV9" maxlength="80" placeholder="Night drive, Study mode..." required /></label>
          <label>Description<textarea id="playlistDescriptionV9" maxlength="240" placeholder="Optional"></textarea></label>
          <div class="v9-dialog-actions"><button value="cancel" class="ghost-button">Cancel</button><button id="savePlaylistV9" value="default" class="primary-button">Create</button></div>
        </form>
      </dialog>
    `);
  }

  function setGraphLoading(target, count = 8, kind = 'card') {
    if (!target) return;
    target.innerHTML = Array.from({ length: count }, () => `<div class="v9-skeleton v9-skeleton-${kind}"><span></span><i></i><i></i><b></b></div>`).join('');
  }

  async function fetchCatalog(params) {
    const url = new URL('/api/catalog', location.origin);
    Object.entries(params).forEach(([key, value]) => {
      if (value !== undefined && value !== null && value !== '') url.searchParams.set(key, String(value));
    });
    const response = await fetch(url, { headers: { Accept: 'application/json' } });
    const json = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(json.error || `Catalog request failed (${response.status})`);
    return json;
  }

  function sourceButtons(item) {
    const links = item.sourceLinks || {};
    const entries = [
      ['Deezer', links.deezer],
      ['YouTube', links.youtubeSearch],
      ['Spotify', links.spotifySearch],
      ['Apple Music', links.appleMusicSearch],
      ['SoundCloud', links.soundcloudSearch]
    ].filter(([, href]) => href);
    return entries.map(([label, href]) => `<a href="${escapeHtml(href)}" target="_blank" rel="noopener noreferrer">${escapeHtml(label)}</a>`).join('');
  }

  function graphCard(item, index, context = 'results') {
    const art = item.artwork || item.artworkFallback || '';
    const subtitle = item.kind === 'artist'
      ? `${compact(item.fans)} fans · ${item.albumsCount || 0} albums`
      : item.kind === 'album'
        ? `${item.artist || 'Unknown artist'}${item.releaseDate ? ` · ${item.releaseDate.slice(0, 4)}` : ''}`
        : `${item.artist || 'Unknown artist'}${item.album ? ` · ${item.album}` : ''}`;
    const badge = item.kind === 'track'
      ? (item.previewUrl ? '30s PREVIEW' : 'CATALOG')
      : item.kind.toUpperCase();
    return `<article class="v9-graph-card" data-v9-index="${index}" data-v9-context="${context}">
      <button class="v9-art-button" data-v9-detail="${index}" aria-label="Open ${escapeHtml(item.title)}">
        <div class="v9-graph-art">${art ? `<img src="${escapeHtml(art)}" alt="" loading="lazy" referrerpolicy="no-referrer" onerror="this.remove();this.parentElement.classList.add('no-art')"/>` : ''}<span>${escapeHtml((item.title || 'A')[0])}</span><i>${escapeHtml(badge)}</i></div>
      </button>
      <div class="v9-graph-copy">
        <strong>${escapeHtml(item.title)}</strong>
        <span>${escapeHtml(subtitle)}</span>
        <small>${item.canonical?.isrc ? `ISRC ${escapeHtml(item.canonical.isrc)} · ` : ''}${escapeHtml(item.provider || 'Catalog')}</small>
      </div>
      <div class="v9-card-actions">
        ${item.previewUrl ? `<button class="v9-preview-btn" data-v9-preview="${index}" title="Play 30-second preview">▶ Preview</button>` : ''}
        <button data-v9-detail="${index}" class="v9-detail-btn">Details</button>
        <button data-v9-add="${index}" class="v9-add-btn" title="Add to playlist">＋</button>
      </div>
    </article>`;
  }

  function bindGraphCards(container, items, context = 'results') {
    $$('[data-v9-detail]', container).forEach(button => button.addEventListener('click', event => {
      event.stopPropagation();
      openDetail(items[Number(button.dataset.v9Detail)]);
    }));
    $$('[data-v9-preview]', container).forEach(button => button.addEventListener('click', event => {
      event.stopPropagation();
      const playable = items.filter(item => item.previewUrl);
      const item = items[Number(button.dataset.v9Preview)];
      const index = playable.findIndex(entry => entry.graphId === item?.graphId);
      if (item?.previewUrl) startPreview(playable, Math.max(0, index));
    }));
    $$('[data-v9-add]', container).forEach(button => button.addEventListener('click', event => {
      event.stopPropagation();
      const item = items[Number(button.dataset.v9Add)];
      if (item) choosePlaylist(item);
    }));
  }

  async function graphSearch({ append = false } = {}) {
    const input = $('#graphSearchInput');
    const q = clean(input?.value || state.query);
    if (!q) return;
    state.query = q;
    const target = $('#graphResults');
    const meta = $('#graphResultsMeta');
    const title = $('#graphResultsTitle');
    const more = $('#graphMoreButton');
    const offset = append ? state.results.length : 0;
    if (!append) {
      state.results = [];
      title.textContent = `“${q}”`;
      meta.textContent = 'mapping catalog…';
      setGraphLoading(target, 8);
    } else {
      more.disabled = true;
      more.textContent = 'Loading…';
    }

    try {
      const json = await fetchCatalog({ mode: 'search', q, kind: state.kind, limit: 18, offset });
      state.results = append ? mergeById(state.results, json.items || []) : (json.items || []);
      target.innerHTML = state.results.length
        ? state.results.map((item, index) => graphCard(item, index)).join('')
        : '<div class="empty-state"><strong>No catalog matches</strong>Try another title, artist or album.</div>';
      bindGraphCards(target, state.results);
      meta.textContent = `${state.results.length} ${state.kind}${state.results.length === 1 ? '' : 's'} · ${json.coverage?.catalog || 'catalog'}`;
      more.hidden = !json.hasMore;
      more.disabled = false;
      more.textContent = 'Load more catalog results';
    } catch (error) {
      target.innerHTML = `<div class="empty-state"><strong>Universal catalog unavailable</strong>${escapeHtml(error.message || 'Try again shortly.')}</div>`;
      meta.textContent = 'provider degraded';
      more.hidden = true;
    }
  }

  function mergeById(first, second) {
    const seen = new Set();
    return [...first, ...second].filter(item => {
      const key = item.graphId || `${item.kind}:${item.title}:${item.artist}`;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });
  }

  async function loadChart() {
    const target = $('#graphChart');
    setGraphLoading(target, 10, 'chart');
    try {
      const json = await fetchCatalog({ mode: 'chart', limit: 18 });
      state.chart = json.items || [];
      target.innerHTML = state.chart.map((item, index) => graphCard(item, index, 'chart')).join('');
      bindGraphCards(target, state.chart, 'chart');
    } catch {
      target.innerHTML = '<div class="empty-state"><strong>Global pulse is resting</strong>The rest of Auralis remains available.</div>';
    }
  }

  async function openDetail(item) {
    if (!item) return;
    openModal('#graphModalV9');
    $('#graphModalTitleV9').textContent = item.title;
    const body = $('#graphModalBodyV9');
    setGraphLoading(body, 4);
    try {
      if (item.kind === 'album') {
        const json = await fetchCatalog({ mode: 'album', id: item.providerId });
        renderAlbumDetail(json.item);
      } else if (item.kind === 'artist') {
        const json = await fetchCatalog({ mode: 'artist', id: item.providerId });
        renderArtistDetail(json.item);
      } else {
        renderTrackDetail(item);
      }
    } catch (error) {
      body.innerHTML = `<div class="empty-state"><strong>Could not load details</strong>${escapeHtml(error.message || 'Try again.')}</div>`;
    }
  }

  function detailHero(item, kicker) {
    const art = item.artwork || item.artworkFallback || '';
    return `<div class="v9-detail-hero">
      <div class="v9-detail-art">${art ? `<img src="${escapeHtml(art)}" alt="" referrerpolicy="no-referrer"/>` : `<span>${escapeHtml((item.title || 'A')[0])}</span>`}</div>
      <div><p class="eyebrow">${escapeHtml(kicker)}</p><h2>${escapeHtml(item.title)}</h2><p>${escapeHtml(item.artist || '')}${item.album && item.album !== item.title ? ` · ${escapeHtml(item.album)}` : ''}</p>
      <div class="v9-detail-meta">${item.releaseDate ? `<span>${escapeHtml(item.releaseDate.slice(0, 10))}</span>` : ''}${item.duration ? `<span>${formatTime(item.duration)}</span>` : ''}${item.canonical?.isrc ? `<span>ISRC ${escapeHtml(item.canonical.isrc)}</span>` : ''}</div></div>
    </div>`;
  }

  function renderTrackDetail(item) {
    const body = $('#graphModalBodyV9');
    body.innerHTML = `${detailHero(item, 'CANONICAL TRACK')}
      <div class="v9-detail-actions">
        ${item.previewUrl ? '<button class="primary-button" id="detailPreviewV9">▶ Play preview</button>' : ''}
        <button class="ghost-button" id="findFullV9">Find full source in Auralis</button>
        <button class="ghost-button" id="detailAddV9">＋ Add to playlist</button>
      </div>
      <div class="v9-source-map"><p class="eyebrow">AVAILABLE ROUTES</p>${sourceButtons(item)}</div>
      <div class="v9-canonical-card"><strong>Auralis identity layer</strong><span>${item.canonical?.mbid ? `MusicBrainz recording ${escapeHtml(item.canonical.mbid)}` : 'Deezer catalog identity'}${item.canonical?.releaseGroupId ? ' · Cover Art Archive linked' : ''}</span></div>
      <div class="v9-youtube-zone" id="youtubeZoneV9"><button class="text-button" id="youtubeLookupV9">Check official YouTube music results →</button></div>`;
    $('#detailPreviewV9')?.addEventListener('click', () => startPreview([item], 0));
    $('#findFullV9')?.addEventListener('click', () => findFullSource(item));
    $('#detailAddV9')?.addEventListener('click', () => choosePlaylist(item));
    $('#youtubeLookupV9')?.addEventListener('click', () => lookupYouTube(item));
  }

  function renderAlbumDetail(item) {
    const body = $('#graphModalBodyV9');
    const tracks = item.tracks || [];
    body.innerHTML = `${detailHero(item, 'ALBUM')}
      <div class="v9-detail-meta-row">${(item.genres || []).map(genre => `<span>${escapeHtml(genre)}</span>`).join('')}${item.label ? `<span>${escapeHtml(item.label)}</span>` : ''}</div>
      <div class="v9-album-tracks">${tracks.map((track, index) => `<div class="v9-album-row"><span>${index + 1}</span><div><strong>${escapeHtml(track.title)}</strong><small>${escapeHtml(track.artist)}</small></div><span>${formatTime(track.duration)}</span>${track.previewUrl ? `<button data-album-preview="${index}">▶</button>` : '<i>—</i>'}<button data-album-add="${index}">＋</button></div>`).join('')}</div>
      <div class="v9-source-map">${sourceButtons(item)}</div>`;
    $$('[data-album-preview]', body).forEach(button => button.addEventListener('click', () => {
      const playable = tracks.filter(track => track.previewUrl);
      const track = tracks[Number(button.dataset.albumPreview)];
      const index = playable.findIndex(entry => entry.graphId === track.graphId);
      startPreview(playable, Math.max(0, index));
    }));
    $$('[data-album-add]', body).forEach(button => button.addEventListener('click', () => choosePlaylist(tracks[Number(button.dataset.albumAdd)])));
  }

  function renderArtistDetail(item) {
    const body = $('#graphModalBodyV9');
    const tracks = item.topTracks || [];
    const albums = item.albums || [];
    body.innerHTML = `${detailHero(item, 'ARTIST')}
      <div class="v9-stat-row"><span><strong>${compact(item.fans)}</strong> fans</span><span><strong>${item.albumsCount || albums.length}</strong> albums</span></div>
      <div class="section-heading compact-heading"><h3>Top tracks</h3></div>
      <div class="v9-album-tracks">${tracks.map((track, index) => `<div class="v9-album-row"><span>${index + 1}</span><div><strong>${escapeHtml(track.title)}</strong><small>${escapeHtml(track.album || item.title)}</small></div><span>${formatTime(track.duration)}</span>${track.previewUrl ? `<button data-artist-preview="${index}">▶</button>` : '<i>—</i>'}<button data-artist-add="${index}">＋</button></div>`).join('')}</div>
      <div class="section-heading compact-heading"><h3>Albums</h3></div>
      <div class="v9-mini-albums">${albums.map((album, index) => `<button data-artist-album="${index}">${album.artwork ? `<img src="${escapeHtml(album.artwork)}" alt="" loading="lazy"/>` : ''}<strong>${escapeHtml(album.title)}</strong><small>${escapeHtml(album.releaseDate?.slice(0,4) || '')}</small></button>`).join('')}</div>`;
    $$('[data-artist-preview]', body).forEach(button => button.addEventListener('click', () => {
      const playable = tracks.filter(track => track.previewUrl);
      const track = tracks[Number(button.dataset.artistPreview)];
      const index = playable.findIndex(entry => entry.graphId === track.graphId);
      startPreview(playable, Math.max(0, index));
    }));
    $$('[data-artist-add]', body).forEach(button => button.addEventListener('click', () => choosePlaylist(tracks[Number(button.dataset.artistAdd)])));
    $$('[data-artist-album]', body).forEach(button => button.addEventListener('click', () => openDetail(albums[Number(button.dataset.artistAlbum)])));
  }

  async function lookupYouTube(item) {
    const zone = $('#youtubeZoneV9');
    zone.innerHTML = '<div class="v9-inline-loader"><i></i><span>Checking YouTube Data API…</span></div>';
    try {
      const q = `${item.title} ${item.artist || ''}`.trim();
      const response = await fetch(`/api/youtube?q=${encodeURIComponent(q)}&limit=6`);
      const json = await response.json();
      if (!response.ok) {
        const external = item.sourceLinks?.youtubeSearch;
        zone.innerHTML = `<div class="v9-provider-note"><strong>YouTube adapter is ready</strong><span>${escapeHtml(json.error || 'API key is not configured yet.')}</span>${external ? `<a href="${escapeHtml(external)}" target="_blank" rel="noopener noreferrer">Search YouTube externally ↗</a>` : ''}</div>`;
        return;
      }
      zone.innerHTML = `<div class="v9-youtube-grid">${(json.items || []).map(video => `<button data-youtube-id="${escapeHtml(video.id)}" data-youtube-title="${escapeHtml(video.title)}"><img src="${escapeHtml(video.artwork)}" alt="" loading="lazy"/><span><strong>${escapeHtml(video.title)}</strong><small>${escapeHtml(video.channel)}</small></span></button>`).join('')}</div><div id="youtubePlayerV9"></div>`;
      $$('[data-youtube-id]', zone).forEach(button => button.addEventListener('click', () => {
        const player = $('#youtubePlayerV9');
        player.innerHTML = `<div class="v9-youtube-player-wrap"><iframe src="https://www.youtube.com/embed/${encodeURIComponent(button.dataset.youtubeId)}?autoplay=1&rel=0" title="${escapeHtml(button.dataset.youtubeTitle)}" allow="autoplay; encrypted-media; picture-in-picture" allowfullscreen></iframe></div>`;
      }));
    } catch {
      zone.innerHTML = '<div class="v9-provider-note"><strong>YouTube check failed</strong><span>Try again shortly.</span></div>';
    }
  }

  function findFullSource(item) {
    deactivatePreview();
    closeModal('#graphModalV9');
    const input = $('#searchInput');
    if (!input) return;
    input.value = `${item.title} ${item.artist || ''}`.trim();
    input.dispatchEvent(new Event('input', { bubbles: true }));
    input.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }));
    toast('Searching full-track sources', 'Audius and Jamendo are being checked first.');
  }

  function playerNodes() {
    return {
      audio: $('#audio'),
      title: $('#playerTitle'),
      artist: $('#playerArtist'),
      source: $('#playerSource'),
      cover: $('#playerCover'),
      play: $('#playButton'),
      progress: $('#progressBar'),
      current: $('#currentTime'),
      duration: $('#durationTime')
    };
  }

  function previewItemAt(index) {
    return state.preview.queue[index] || null;
  }

  function updatePreviewPlayer() {
    if (!state.preview.active || !state.preview.item) return;
    const item = state.preview.item;
    const nodes = playerNodes();
    nodes.title.textContent = item.title || 'Preview';
    nodes.artist.textContent = item.artist || 'Auralis Music Graph';
    nodes.source.textContent = 'Deezer · 30-second catalog preview';
    nodes.play.textContent = nodes.audio.paused ? '▶' : '❚❚';
    nodes.progress.disabled = false;
    const duration = Number(nodes.audio.duration || 30);
    nodes.current.textContent = formatTime(nodes.audio.currentTime || 0) || '0:00';
    nodes.duration.textContent = formatTime(duration) || '0:30';
    nodes.progress.value = duration ? (nodes.audio.currentTime / duration * 100) : 0;
    nodes.cover.innerHTML = item.artwork
      ? `<img src="${escapeHtml(item.artwork)}" alt="${escapeHtml(item.title)} artwork" referrerpolicy="no-referrer"/>`
      : `<span>${escapeHtml((item.title || 'A')[0])}</span>`;
    $('#playerBar')?.classList.add('v9-preview-active');
  }

  function startPreview(queue, index = 0) {
    const playable = (queue || []).filter(item => item?.previewUrl);
    const item = playable[index];
    if (!item) {
      toast('No preview available', 'Try Find full source or another catalog result.');
      return;
    }
    const nodes = playerNodes();
    if (!nodes.audio) return;
    state.preview.active = true;
    state.preview.queue = playable;
    state.preview.index = index;
    state.preview.item = item;
    nodes.audio.pause();
    nodes.audio.src = item.previewUrl;
    nodes.audio.load();
    updatePreviewPlayer();
    nodes.audio.play().catch(() => {
      toast('Preview needs a tap', 'Your browser blocked autoplay. Tap the player once.');
      updatePreviewPlayer();
    });
  }

  function deactivatePreview() {
    if (!state.preview.active) return;
    state.preview.active = false;
    state.preview.queue = [];
    state.preview.index = -1;
    state.preview.item = null;
    $('#playerBar')?.classList.remove('v9-preview-active');
  }

  function nextPreview(delta = 1) {
    if (!state.preview.active || !state.preview.queue.length) return;
    const length = state.preview.queue.length;
    state.preview.index = (state.preview.index + delta + length) % length;
    state.preview.item = previewItemAt(state.preview.index);
    startPreview(state.preview.queue, state.preview.index);
  }

  function bindPreviewController() {
    const nodes = playerNodes();
    if (!nodes.audio) return;

    const stopCore = event => {
      if (!state.preview.active) return;
      event.stopImmediatePropagation();
      updatePreviewPlayer();
    };

    ['play', 'playing', 'pause', 'loadedmetadata', 'timeupdate'].forEach(type => {
      nodes.audio.addEventListener(type, stopCore, true);
    });

    nodes.audio.addEventListener('ended', event => {
      if (!state.preview.active) return;
      event.stopImmediatePropagation();
      nextPreview(1);
    }, true);

    nodes.audio.addEventListener('error', event => {
      if (!state.preview.active) return;
      event.stopImmediatePropagation();
      toast('Preview source failed', 'Auralis is moving to the next preview if one is available.');
      if (state.preview.queue.length > 1) nextPreview(1);
    }, true);

    $('#playButton')?.addEventListener('click', event => {
      if (!state.preview.active) return;
      event.stopImmediatePropagation();
      if (nodes.audio.paused) nodes.audio.play().catch(() => toast('Preview needs a tap'));
      else nodes.audio.pause();
    }, true);

    $('#nextButton')?.addEventListener('click', event => {
      if (!state.preview.active) return;
      event.stopImmediatePropagation();
      nextPreview(1);
    }, true);

    $('#prevButton')?.addEventListener('click', event => {
      if (!state.preview.active) return;
      event.stopImmediatePropagation();
      nextPreview(-1);
    }, true);

    $('#progressBar')?.addEventListener('input', event => {
      if (!state.preview.active) return;
      event.stopImmediatePropagation();
      if (nodes.audio.duration) nodes.audio.currentTime = Number(nodes.progress.value) / 100 * nodes.audio.duration;
    }, true);

    $('#playerLike')?.addEventListener('click', event => {
      if (!state.preview.active) return;
      event.stopImmediatePropagation();
      const likes = getGraphLikes();
      const exists = likes.findIndex(item => item.graphId === state.preview.item?.graphId);
      if (exists >= 0) likes.splice(exists, 1);
      else likes.unshift(state.preview.item);
      saveGraphLikes(likes.slice(0, 200));
      toast(exists >= 0 ? 'Removed preview favorite' : 'Saved catalog favorite', state.preview.item?.title || '');
    }, true);

    document.addEventListener('click', event => {
      if (!state.preview.active) return;
      if (event.target.closest('[data-play-index],[data-play-row],[data-radio-play],.music-card,.track-row,.radio-card') && !event.target.closest('.v9-graph-card,.v9-modal')) {
        deactivatePreview();
      }
    }, true);
  }

  function openModal(selector) {
    $('#graphBackdropV9')?.classList.add('show');
    const modal = $(selector);
    modal?.classList.add('open');
    modal?.setAttribute('aria-hidden', 'false');
  }

  function closeModal(selector) {
    const modal = $(selector);
    modal?.classList.remove('open');
    modal?.setAttribute('aria-hidden', 'true');
    if (!$('#graphModalV9')?.classList.contains('open') && !$('#providerControlV9')?.classList.contains('open')) {
      $('#graphBackdropV9')?.classList.remove('show');
    }
  }

  function renderPlaylists() {
    const playlists = getPlaylists();
    const target = $('#graphPlaylists');
    if (target) {
      target.innerHTML = playlists.length
        ? playlists.map(playlist => `<button class="v9-playlist-card" data-playlist-open="${escapeHtml(playlist.id)}"><span>≡</span><strong>${escapeHtml(playlist.name)}</strong><small>${playlist.items?.length || 0} items${playlist.description ? ` · ${escapeHtml(playlist.description)}` : ''}</small></button>`).join('')
        : '<div class="empty-state"><strong>No Auralis playlists yet</strong>Create one and mix catalog tracks from different sources.</div>';
      $$('[data-playlist-open]', target).forEach(button => button.addEventListener('click', () => openPlaylist(button.dataset.playlistOpen)));
    }

    let side = $('.v9-sidebar-playlists');
    if (!side) {
      const button = $('#newPlaylistButton');
      if (button) {
        side = document.createElement('div');
        side.className = 'v9-sidebar-playlists';
        button.after(side);
      }
    }
    if (side) {
      side.innerHTML = playlists.slice(0, 4).map(playlist => `<button data-side-playlist="${escapeHtml(playlist.id)}"><span>♪</span>${escapeHtml(playlist.name)}<b>${playlist.items?.length || 0}</b></button>`).join('');
      $$('[data-side-playlist]', side).forEach(button => button.addEventListener('click', () => {
        activeView('universe');
        setTimeout(() => openPlaylist(button.dataset.sidePlaylist), 20);
      }));
    }
  }

  function createPlaylist() {
    const dialog = $('#playlistDialogV9');
    $('#playlistNameV9').value = '';
    $('#playlistDescriptionV9').value = '';
    dialog?.showModal();
    setTimeout(() => $('#playlistNameV9')?.focus(), 40);
  }

  function saveNewPlaylist(event) {
    event.preventDefault();
    const name = clean($('#playlistNameV9')?.value);
    if (!name) return;
    const description = clean($('#playlistDescriptionV9')?.value);
    const playlists = getPlaylists();
    playlists.unshift({
      id: `playlist-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
      name,
      description,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      items: []
    });
    savePlaylists(playlists);
    $('#playlistDialogV9')?.close();
    renderPlaylists();
    toast('Playlist created', name);
  }

  function choosePlaylist(item) {
    const playlists = getPlaylists();
    if (!playlists.length) {
      createPlaylist();
      toast('Create a playlist first', 'Then add this catalog item.');
      return;
    }
    openModal('#graphModalV9');
    $('#graphModalTitleV9').textContent = 'Add to playlist';
    $('#graphModalBodyV9').innerHTML = `<div class="v9-playlist-picker">${playlists.map(playlist => `<button data-pick-playlist="${escapeHtml(playlist.id)}"><span>≡</span><strong>${escapeHtml(playlist.name)}</strong><small>${playlist.items?.length || 0} items</small></button>`).join('')}</div>`;
    $$('[data-pick-playlist]', $('#graphModalBodyV9')).forEach(button => button.addEventListener('click', () => {
      const all = getPlaylists();
      const playlist = all.find(value => value.id === button.dataset.pickPlaylist);
      if (!playlist) return;
      playlist.items = playlist.items || [];
      if (!playlist.items.some(value => value.graphId === item.graphId)) playlist.items.push(item);
      playlist.updatedAt = new Date().toISOString();
      savePlaylists(all);
      renderPlaylists();
      closeModal('#graphModalV9');
      toast('Added to playlist', `${item.title} → ${playlist.name}`);
    }));
  }

  function openPlaylist(id) {
    const playlists = getPlaylists();
    const playlist = playlists.find(value => value.id === id);
    if (!playlist) return;
    openModal('#graphModalV9');
    $('#graphModalTitleV9').textContent = playlist.name;
    const items = playlist.items || [];
    $('#graphModalBodyV9').innerHTML = `<div class="v9-playlist-detail"><p>${escapeHtml(playlist.description || 'A local Auralis playlist stored on this device.')}</p>
      <div class="v9-playlist-detail-actions">${items.some(item => item.previewUrl) ? '<button id="playPlaylistPreviewsV9" class="primary-button">▶ Play available previews</button>' : ''}<button id="deletePlaylistV9" class="ghost-button danger">Delete playlist</button></div>
      <div class="v9-playlist-rows">${items.length ? items.map((item, index) => `<div class="v9-playlist-row"><span>${index + 1}</span><div><strong>${escapeHtml(item.title)}</strong><small>${escapeHtml(item.artist || item.kind || '')}</small></div>${item.previewUrl ? `<button data-playlist-preview="${index}">▶</button>` : '<i>—</i>'}<button data-playlist-remove="${index}">×</button></div>`).join('') : '<div class="empty-state"><strong>Playlist is empty</strong>Add tracks from Universal Search or Global Pulse.</div>'}</div></div>`;
    $('#playPlaylistPreviewsV9')?.addEventListener('click', () => {
      const playable = items.filter(item => item.previewUrl);
      if (playable.length) startPreview(playable, 0);
    });
    $$('[data-playlist-preview]', $('#graphModalBodyV9')).forEach(button => button.addEventListener('click', () => {
      const item = items[Number(button.dataset.playlistPreview)];
      const playable = items.filter(value => value.previewUrl);
      const index = playable.findIndex(value => value.graphId === item.graphId);
      startPreview(playable, Math.max(0, index));
    }));
    $$('[data-playlist-remove]', $('#graphModalBodyV9')).forEach(button => button.addEventListener('click', () => {
      const all = getPlaylists();
      const current = all.find(value => value.id === id);
      if (!current) return;
      current.items.splice(Number(button.dataset.playlistRemove), 1);
      current.updatedAt = new Date().toISOString();
      savePlaylists(all);
      renderPlaylists();
      openPlaylist(id);
    }));
    $('#deletePlaylistV9')?.addEventListener('click', () => {
      savePlaylists(playlists.filter(value => value.id !== id));
      renderPlaylists();
      closeModal('#graphModalV9');
      toast('Playlist deleted', playlist.name);
    });
  }

  async function loadProviderStatus({ open = false } = {}) {
    const preview = $('#providerPulsePreviewV9');
    if (preview && !state.providers.length) setGraphLoading(preview, 4, 'provider');
    if (open) {
      openModal('#providerControlV9');
      setGraphLoading($('#providerControlBodyV9'), 7, 'provider');
    }
    try {
      const response = await fetch('/api/providers', { headers: { Accept: 'application/json' } });
      const json = await response.json();
      if (!response.ok) throw new Error('Provider status unavailable');
      state.providers = json.providers || [];
      renderProviderStatus(json);
    } catch {
      if (preview) preview.innerHTML = '<div class="empty-state"><strong>Source Pulse unavailable</strong>Music playback remains independent.</div>';
      if (open) $('#providerControlBodyV9').innerHTML = '<div class="empty-state"><strong>Could not check providers</strong>Try again shortly.</div>';
    }
  }

  function providerStateLabel(stateValue) {
    return String(stateValue || 'checking').replace(/_/g, ' ');
  }

  function renderProviderStatus(json) {
    const providers = json.providers || state.providers;
    const active = providers.filter(p => ['online', 'client', 'configured'].includes(p.state));
    const preview = $('#providerPulsePreviewV9');
    if (preview) {
      preview.innerHTML = providers.slice(0, 6).map(provider => `<article><i class="${escapeHtml(provider.state)}"></i><div><strong>${escapeHtml(provider.name)}</strong><span>${escapeHtml(provider.role || '')}</span></div><b>${provider.latency ? `${provider.latency}ms` : escapeHtml(providerStateLabel(provider.state))}</b></article>`).join('');
    }

    const body = $('#providerControlBodyV9');
    if (body) {
      body.innerHTML = providers.map(provider => `<article class="v9-provider-row">
        <div class="v9-provider-main"><i class="${escapeHtml(provider.state)}"></i><div><strong>${escapeHtml(provider.name)}</strong><span>${escapeHtml(provider.role || '')}</span></div></div>
        <div class="v9-provider-capabilities">${(provider.capabilities || []).slice(0, 6).map(cap => `<span>${escapeHtml(cap)}</span>`).join('')}</div>
        <div class="v9-provider-health"><b>${escapeHtml(providerStateLabel(provider.state))}</b>${provider.latency ? `<small>${provider.latency}ms</small>` : ''}</div>
        ${provider.note ? `<p>${escapeHtml(provider.note)}</p>` : ''}
      </article>`).join('');
    }
    const summary = $('#providerControlSummaryV9');
    if (summary) summary.innerHTML = `<strong>${active.length}</strong><span>sources ready</span><i></i><strong>${providers.filter(p => p.state === 'needs_credentials').length}</strong><span>credential-ready adapters</span><small>Checked ${new Date(json.checkedAt || Date.now()).toLocaleTimeString()}</small>`;
    const live = $('#catalogLiveText');
    if (live && active.length) live.textContent = `${active.length} sources ready`;
  }

  async function enhanceGlobalSearch(query) {
    const q = clean(query);
    const searchView = $('#searchView');
    if (!searchView) return;
    let rail = $('#graphSearchRailV9');
    if (!q) {
      rail?.remove();
      return;
    }
    if (!rail) {
      rail = document.createElement('section');
      rail.id = 'graphSearchRailV9';
      rail.className = 'v9-search-rail';
      const list = $('#searchList');
      list?.before(rail);
    }
    rail.innerHTML = '<div class="v9-rail-head"><div><p class="eyebrow">AURALIS MUSIC GRAPH</p><h2>Mapping the broader catalog…</h2></div><span>canonical + preview</span></div><div class="v9-rail-grid"></div>';
    setGraphLoading($('.v9-rail-grid', rail), 6);
    try {
      const json = await fetchCatalog({ mode: 'search', q, kind: 'track', limit: 8, offset: 0 });
      const items = json.items || [];
      rail.innerHTML = `<div class="v9-rail-head"><div><p class="eyebrow">AURALIS MUSIC GRAPH</p><h2>Broader catalog matches</h2></div><button id="openUniverseForQueryV9" class="text-button">Open Universe →</button></div><div class="v9-rail-grid">${items.map((item, index) => graphCard(item, index, 'rail')).join('')}</div><p class="v9-rail-note">Below this shelf, Auralis still shows the immediately playable Audius/Jamendo results.</p>`;
      bindGraphCards(rail, items, 'rail');
      $('#openUniverseForQueryV9')?.addEventListener('click', () => {
        activeView('universe');
        $('#graphSearchInput').value = q;
        state.kind = 'track';
        syncKindTabs();
        graphSearch();
      });
    } catch {
      rail.innerHTML = '<div class="v9-rail-head"><div><p class="eyebrow">AURALIS MUSIC GRAPH</p><h2>Broader catalog unavailable</h2></div></div>';
    }
  }

  function syncKindTabs() {
    $$('[data-graph-kind]').forEach(button => button.classList.toggle('active', button.dataset.graphKind === state.kind));
  }

  function bindEvents() {
    $('#openUniverseFromHome')?.addEventListener('click', () => activeView('universe'));
    $$('[data-v9-home-action]').forEach(button => button.addEventListener('click', () => {
      activeView('universe');
      const action = button.dataset.v9HomeAction;
      if (action === 'search') setTimeout(() => $('#graphSearchInput')?.focus(), 50);
      if (action === 'chart') setTimeout(() => $('#graphChart')?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 50);
      if (action === 'playlists') setTimeout(() => $('#graphPlaylists')?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 50);
      if (action === 'providers') setTimeout(() => loadProviderStatus({ open: true }), 50);
    }));

    $('#graphSearchButton')?.addEventListener('click', () => graphSearch());
    $('#graphSearchInput')?.addEventListener('input', () => {
      clearTimeout(state.searchTimer);
      state.searchTimer = setTimeout(() => graphSearch(), 440);
    });
    $('#graphSearchInput')?.addEventListener('keydown', event => {
      if (event.key === 'Enter') {
        clearTimeout(state.searchTimer);
        graphSearch();
      }
    });
    $$('[data-graph-kind]').forEach(button => button.addEventListener('click', () => {
      state.kind = button.dataset.graphKind;
      state.results = [];
      syncKindTabs();
      if (clean($('#graphSearchInput')?.value)) graphSearch();
    }));
    $('#graphMoreButton')?.addEventListener('click', () => graphSearch({ append: true }));
    $('#refreshGraphChart')?.addEventListener('click', loadChart);
    $('#createGraphPlaylist')?.addEventListener('click', createPlaylist);
    $('#playlistFormV9')?.addEventListener('submit', saveNewPlaylist);

    $('#newPlaylistButton')?.addEventListener('click', event => {
      event.preventDefault();
      event.stopImmediatePropagation();
      createPlaylist();
    }, true);

    $('#openProviderControlV9')?.addEventListener('click', () => loadProviderStatus({ open: true }));
    $('.catalog-live-pill')?.addEventListener('click', event => {
      event.preventDefault();
      loadProviderStatus({ open: true });
    });
    $('.catalog-live-pill')?.classList.add('v9-clickable');

    $('#closeGraphModalV9')?.addEventListener('click', () => closeModal('#graphModalV9'));
    $('#closeProviderControlV9')?.addEventListener('click', () => closeModal('#providerControlV9'));
    $('#graphBackdropV9')?.addEventListener('click', () => {
      closeModal('#graphModalV9');
      closeModal('#providerControlV9');
    });

    const mainSearch = $('#searchInput');
    mainSearch?.addEventListener('input', () => {
      clearTimeout(state.globalSearchTimer);
      state.globalSearchTimer = setTimeout(() => enhanceGlobalSearch(mainSearch.value), 560);
    });
    mainSearch?.addEventListener('keydown', event => {
      if (event.key === 'Enter') {
        clearTimeout(state.globalSearchTimer);
        setTimeout(() => enhanceGlobalSearch(mainSearch.value), 80);
      }
    });
  }

  function start() {
    loadCss();
    injectShell();
    bindEvents();
    bindPreviewController();
    renderPlaylists();
    loadChart();
    loadProviderStatus();
    setInterval(() => loadProviderStatus(), 120000);
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start, { once: true });
  else start();
})();