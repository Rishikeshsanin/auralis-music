import { catalogManager, dedupeTracks } from './providers/catalog-manager.js';
import { collections, featuredCollectionIds, collectionCategories, getCollection } from './collections.js';
import { genres, moods } from './library-map.js';
import { store } from './store.js';
import { fallbackTracks } from './fallback.js';

const $ = (s, root = document) => root.querySelector(s);
const $$ = (s, root = document) => [...root.querySelectorAll(s)];

const els = {
  audio: $('#audio'),
  search: $('#searchInput'),
  trending: $('#trendingGrid'),
  discover: $('#discoverList'),
  liked: $('#likedList'),
  recent: $('#recentList'),
  recentPreview: $('#recentPreview'),
  searchList: $('#searchList'),
  searchTitle: $('#searchTitle'),
  searchSubtitle: $('#searchSubtitle'),
  discoverTitle: $('#discoverTitle'),
  resultMeta: $('#resultMeta'),
  queueDrawer: $('#queueDrawer'),
  backdrop: $('#drawerBackdrop'),
  queueList: $('#queueList'),
  queueCount: $('#queueCount'),
  playerCover: $('#playerCover'),
  playerTitle: $('#playerTitle'),
  playerArtist: $('#playerArtist'),
  playerSource: $('#playerSource'),
  playerLike: $('#playerLike'),
  play: $('#playButton'),
  prev: $('#prevButton'),
  next: $('#nextButton'),
  shuffle: $('#shuffleButton'),
  repeat: $('#repeatButton'),
  progress: $('#progressBar'),
  currentTime: $('#currentTime'),
  duration: $('#durationTime'),
  volume: $('#volumeBar'),
  likedCountText: $('#likedCountText'),
  toastRegion: $('#toastRegion'),
  homeCollections: $('#homeCollectionGrid'),
  collectionGrid: $('#collectionGrid'),
  collectionFilterBar: $('#collectionFilterBar'),
  providerStrip: $('#providerStrip'),
  collectionCount: $('#collectionCount'),
  homeGenreGrid: $('#homeGenreGrid'),
  genreWorldGrid: $('#genreWorldGrid'),
  homeMoodGrid: $('#homeMoodGrid'),
  moodWorldGrid: $('#moodWorldGrid'),
  homeRadioGrid: $('#homeRadioGrid'),
  radioGrid: $('#radioGrid'),
  radioTitle: $('#radioTitle'),
  radioMeta: $('#radioMeta'),
  radioSearchInput: $('#radioSearchInput'),
  catalogLiveText: $('#catalogLiveText'),
  discoverMore: $('#discoverMoreButton'),
  searchMore: $('#searchMoreButton'),
  radioMore: $('#radioMoreButton')
};

const demoAudioCache = new Map();

function makeDemoAudio(key = 'auralis') {
  if (demoAudioCache.has(key)) return demoAudioCache.get(key);
  const sampleRate = 8000;
  const seconds = 12;
  const samples = sampleRate * seconds;
  const buffer = new ArrayBuffer(44 + samples * 2);
  const view = new DataView(buffer);
  const write = (offset, text) => [...text].forEach((c, i) => view.setUint8(offset + i, c.charCodeAt(0)));
  write(0, 'RIFF');
  view.setUint32(4, 36 + samples * 2, true);
  write(8, 'WAVE');
  write(12, 'fmt ');
  view.setUint32(16, 16, true);
  view.setUint16(20, 1, true);
  view.setUint16(22, 1, true);
  view.setUint32(24, sampleRate, true);
  view.setUint32(28, sampleRate * 2, true);
  view.setUint16(32, 2, true);
  view.setUint16(34, 16, true);
  write(36, 'data');
  view.setUint32(40, samples * 2, true);
  const seed = [...key].reduce((a, c) => a + c.charCodeAt(0), 0);
  const base = 82 + (seed % 85);
  for (let i = 0; i < samples; i++) {
    const t = i / sampleRate;
    const section = Math.floor(t / 3) % 4;
    const freq = base * Math.pow(2, [0, 3, 7, 10][section] / 12);
    const pulse = Math.max(0, 1 - ((t * 2) % 1) * 7);
    const fade = Math.min(1, t / .7, (seconds - t) / .8);
    const v = (
      Math.sin(2 * Math.PI * freq * t) * .15 +
      Math.sin(2 * Math.PI * freq * 1.5 * t + .4) * .065 +
      Math.sin(2 * Math.PI * 55 * t) * .04 * pulse
    ) * Math.max(0, fade);
    view.setInt16(44 + i * 2, Math.max(-32767, Math.min(32767, Math.floor(v * 32767))), true);
  }
  const url = URL.createObjectURL(new Blob([buffer], { type: 'audio/wav' }));
  demoAudioCache.set(key, url);
  return url;
}

const state = {
  current: null,
  queue: [],
  queueIndex: -1,
  shuffle: false,
  repeat: 'off',
  trending: [...fallbackTracks],
  trendingVisible: 10,
  trendingOffset: 0,
  trendingHasMore: true,
  searchResults: [],
  searchQuery: '',
  searchOffset: 0,
  searchHasMore: false,
  discoverResults: [],
  discoverMode: null,
  discoverValue: null,
  discoverOffset: 0,
  discoverHasMore: false,
  activeCollection: null,
  collectionFilter: 'all',
  homeCollectionLimit: 8,
  radioResults: [],
  radioQuery: '',
  radioMode: 'top',
  radioOffset: 0,
  radioHasMore: true,
  failedTracks: new Set(),
  failureInProgress: false,
  playbackTimer: null,
  searchToken: 0
};

function formatTime(seconds) {
  if (!Number.isFinite(seconds) || seconds < 0) return '0:00';
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60).toString().padStart(2, '0');
  return `${m}:${s}`;
}

function compact(n) {
  if (!n) return 'new';
  return Intl.NumberFormat('en', { notation: 'compact', maximumFractionDigits: 1 }).format(n);
}

function escapeHtml(value = '') {
  return String(value).replace(/[&<>'"]/g, c => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#039;', '"': '&quot;'
  }[c]));
}

function providerClass(provider = '') {
  return provider.toLowerCase().replace(/[^a-z0-9]/g, '');
}

function providerBadge(track) {
  const live = track.isLive ? '<span class="live-mini">LIVE</span>' : '';
  return `<span class="provider-badge ${providerClass(track.provider)}">${escapeHtml(track.provider || 'Music')}</span>${live}`;
}

function imgTag(track, className = '') {
  const title = escapeHtml(track.title);
  if (!track.artwork) {
    return `<span class="cover-fallback ${className}">${escapeHtml((track.title || 'A')[0])}</span>`;
  }
  return `<img class="${className}" src="${escapeHtml(track.artwork)}" alt="${title} artwork" loading="lazy" referrerpolicy="no-referrer" onerror="this.style.display='none';this.parentElement.classList.add('image-failed')"/>`;
}

function isCurrent(track) {
  return state.current?.id === track.id;
}

function mergeUnique(existing, incoming) {
  return dedupeTracks([...existing, ...incoming]);
}

function cardTemplate(track, index) {
  const secondary = track.isLive ? 'live station' : `${compact(track.playCount)} plays`;
  return `<article class="music-card ${isCurrent(track) ? 'active' : ''}" data-track-index="${index}">
    <div class="cover-wrap">${providerBadge(track)}${imgTag(track)}<button class="card-play" data-play-index="${index}" aria-label="Play ${escapeHtml(track.title)}">${isCurrent(track) && !els.audio.paused ? '❚❚' : '▶'}</button></div>
    <h3>${escapeHtml(track.title)}</h3><p>${escapeHtml(track.artist)}</p>
    <div class="card-meta"><span>${escapeHtml(track.genre || 'Music')}</span><span>${secondary}</span></div>
  </article>`;
}

function rowTemplate(track, index, source) {
  const liked = store.isLiked(track.id);
  const duration = track.isLive ? '<span class="live-duration">LIVE</span>' : formatTime(track.duration);
  return `<div class="track-row ${isCurrent(track) ? 'active' : ''}" data-track-index="${index}" data-source="${source}">
    <button class="track-index row-more" data-play-row="${index}" aria-label="Play ${escapeHtml(track.title)}">${isCurrent(track) && !els.audio.paused ? '❚❚' : (index + 1)}</button>
    <div class="row-title"><div class="row-cover">${track.artwork ? `<img src="${escapeHtml(track.artwork)}" alt="" loading="lazy" referrerpolicy="no-referrer"/>` : `<span>${escapeHtml(track.title[0] || 'A')}</span>`}</div><div class="row-title-copy"><strong>${escapeHtml(track.title)}</strong><span>${escapeHtml(track.artist)}</span></div></div>
    <span class="row-secondary row-genre">${providerBadge(track)}${escapeHtml(track.genre || 'Music')}</span>
    <span class="row-secondary">${track.isLive ? 'Live now' : `${compact(track.playCount)} plays`}</span>
    <span class="row-duration">${duration}</span>
    <button class="row-like ${liked ? 'liked' : ''}" data-like-row="${index}" aria-label="${liked ? 'Unlike' : 'Like'} ${escapeHtml(track.title)}">${liked ? '♥' : '♡'}</button>
  </div>`;
}

function emptyState(title, detail) {
  return `<div class="empty-state"><strong>${escapeHtml(title)}</strong>${escapeHtml(detail)}</div>`;
}

function collectionTemplate(collection) {
  const source = collection.source === 'jamendo' ? 'Jamendo' : collection.source === 'audius' ? 'Audius' : 'Multi-source';
  return `<button class="collection-card" data-collection="${escapeHtml(collection.id)}" data-accent="${escapeHtml(collection.accent)}">
    <span class="collection-icon">${escapeHtml(collection.icon)}</span>
    <strong>${escapeHtml(collection.title)}</strong>
    <small>${escapeHtml(collection.subtitle)}</small>
    <span class="collection-source">${source}</span>
  </button>`;
}

function worldTemplate(item, kind) {
  return `<button class="world-card ${kind}-card" data-${kind}="${escapeHtml(item.id)}" data-accent="${escapeHtml(item.accent)}">
    <span class="world-icon">${escapeHtml(item.icon)}</span>
    <span class="world-copy"><strong>${escapeHtml(item.label)}</strong><small>${escapeHtml(item.detail)}</small></span>
    <span class="world-arrow">→</span>
  </button>`;
}

function radioTemplate(track, index, compactCard = false) {
  const detail = [track.country, track.codec ? `${track.codec}${track.bitrate ? ` · ${track.bitrate}kbps` : ''}` : ''].filter(Boolean).join(' · ');
  return `<article class="radio-card ${compactCard ? 'radio-card-compact' : ''} ${isCurrent(track) ? 'active' : ''}" data-radio-index="${index}">
    <div class="radio-logo">${track.artwork ? `<img src="${escapeHtml(track.artwork)}" alt="" loading="lazy" referrerpolicy="no-referrer"/>` : `<span>◍</span>`}<i></i></div>
    <div class="radio-copy"><span class="live-label">LIVE</span><strong>${escapeHtml(track.title)}</strong><small>${escapeHtml(detail || track.genre || 'Live station')}</small></div>
    <button class="radio-play" data-radio-play="${index}" aria-label="Play ${escapeHtml(track.title)}">${isCurrent(track) && !els.audio.paused ? '❚❚' : '▶'}</button>
  </article>`;
}

function bindTrackCards(target, tracks) {
  $$('[data-play-index]', target).forEach(btn => btn.addEventListener('click', event => {
    event.stopPropagation();
    playFrom(tracks, Number(btn.dataset.playIndex));
  }));
  $$('.music-card', target).forEach(card => card.addEventListener('click', () => {
    playFrom(tracks, Number(card.dataset.trackIndex));
  }));
}

function renderCards() {
  const visible = state.trending.slice(0, state.trendingVisible);
  els.trending.innerHTML = visible.length
    ? visible.map(cardTemplate).join('')
    : emptyState('No trending tracks', 'Refresh the catalogs and try again.');
  bindTrackCards(els.trending, visible);
  const bottom = $('#trendingMoreBottom');
  if (bottom) bottom.hidden = !state.trendingHasMore && state.trendingVisible >= state.trending.length;
}

function renderList(target, tracks, source, emptyTitle = 'Nothing here yet', emptyDetail = 'Play or save a few tracks and they’ll appear here.') {
  target.innerHTML = tracks.length ? tracks.map((track, index) => rowTemplate(track, index, source)).join('') : emptyState(emptyTitle, emptyDetail);
  $$('[data-play-row]', target).forEach(btn => btn.addEventListener('click', () => playFrom(tracks, Number(btn.dataset.playRow))));
  $$('[data-like-row]', target).forEach(btn => btn.addEventListener('click', () => toggleLike(tracks[Number(btn.dataset.likeRow)])));
}

function renderLibrary() {
  renderList(els.liked, store.liked, 'liked', 'No liked songs yet', 'Tap the heart beside any track or station to keep it here.');
  renderList(els.recent, store.recent, 'recent', 'No listening history yet', 'Your recently played music is stored locally until Auralis Cloud sync is enabled.');
  renderList(els.recentPreview, store.recent.slice(0, 5), 'recentPreview', 'Your history is empty', 'Start a track or station and it will show up here.');
  els.likedCountText.textContent = `${store.liked.length} saved ${store.liked.length === 1 ? 'item' : 'items'} on this device.`;
}

function renderSearch() {
  renderList(els.searchList, state.searchResults, 'search', 'No matches', 'Try another track, artist, genre or mood.');
  if (els.searchMore) els.searchMore.hidden = !state.searchHasMore;
}

function renderDiscover() {
  renderList(els.discover, state.discoverResults, 'discover', 'Nothing loaded yet', 'Open a collection, genre or mood to start exploring.');
  if (els.discoverMore) els.discoverMore.hidden = !state.discoverHasMore;
}

function renderQueue() {
  els.queueCount.textContent = state.queue.length;
  if (!state.queue.length) {
    els.queueList.innerHTML = emptyState('Queue is empty', 'Choose a track, collection or station.');
    return;
  }
  els.queueList.innerHTML = state.queue.map((track, index) => `<div class="queue-item">
    <div class="queue-item-cover">${track.artwork ? `<img src="${escapeHtml(track.artwork)}" alt="" referrerpolicy="no-referrer"/>` : '<span>♪</span>'}</div>
    <div class="queue-item-copy"><strong>${escapeHtml(track.title)}</strong><span>${escapeHtml(track.artist)} · ${escapeHtml(track.provider || 'Music')}${track.isLive ? ' · LIVE' : ''}</span></div>
    <button class="queue-remove" data-remove="${index}" aria-label="Remove from queue">×</button>
  </div>`).join('');
  $$('[data-remove]', els.queueList).forEach(button => button.addEventListener('click', () => {
    const index = Number(button.dataset.remove);
    state.queue.splice(index, 1);
    if (index < state.queueIndex) state.queueIndex--;
    renderQueue();
  }));
}

function renderCollections() {
  const featured = featuredCollectionIds.map(getCollection).filter(Boolean);
  const homePool = collections.filter(collection => featured.some(item => item.id === collection.id))
    .concat(collections.filter(collection => !featured.some(item => item.id === collection.id)));
  els.homeCollections.innerHTML = homePool.slice(0, state.homeCollectionLimit).map(collectionTemplate).join('');

  const filtered = state.collectionFilter === 'all'
    ? collections
    : collections.filter(collection => collection.category === state.collectionFilter);
  els.collectionGrid.innerHTML = filtered.map(collectionTemplate).join('');

  if (els.collectionCount) els.collectionCount.textContent = `${collections.length} curated collections`;

  els.collectionFilterBar.innerHTML = collectionCategories.map(category =>
    `<button class="${category.id === state.collectionFilter ? 'active' : ''}" data-collection-filter="${category.id}">${escapeHtml(category.label)}</button>`
  ).join('');

  $$('[data-collection]').forEach(button => button.addEventListener('click', () => loadCollection(button.dataset.collection)));
  $$('[data-collection-filter]', els.collectionFilterBar).forEach(button => button.addEventListener('click', () => {
    state.collectionFilter = button.dataset.collectionFilter;
    renderCollections();
  }));
}

function renderWorlds() {
  els.homeGenreGrid.innerHTML = genres.slice(0, 8).map(item => worldTemplate(item, 'genre')).join('');
  els.genreWorldGrid.innerHTML = genres.map(item => worldTemplate(item, 'genre')).join('');
  els.homeMoodGrid.innerHTML = moods.slice(0, 8).map(item => worldTemplate(item, 'mood')).join('');
  els.moodWorldGrid.innerHTML = moods.map(item => worldTemplate(item, 'mood')).join('');

  $$('[data-genre]').forEach(button => button.addEventListener('click', () => {
    const item = genres.find(genre => genre.id === button.dataset.genre);
    if (item) discoverQuery(item.query, `${item.label} — genre`);
  }));

  $$('[data-mood]').forEach(button => button.addEventListener('click', () => {
    const item = moods.find(mood => mood.id === button.dataset.mood);
    if (item) discoverQuery(item.query, `${item.label} — mood`);
  }));
}

function renderProviderStrip() {
  const cards = catalogManager.providerCards();
  els.providerStrip.innerHTML = cards.map(card => `<article class="provider-card">
    <div class="provider-card-top"><div><strong>${escapeHtml(card.name)}</strong><span class="provider-role">${escapeHtml(card.role)}</span></div><span class="provider-status ${escapeHtml(card.status)}">${escapeHtml(card.status)}</span></div>
    <p>${escapeHtml(card.text)}</p>
  </article>`).join('');

  const healthy = cards.filter(card => ['online', 'demo'].includes(card.status)).length;
  if (els.catalogLiveText) els.catalogLiveText.textContent = healthy >= 2 ? `${healthy} sources online` : healthy === 1 ? '1 source online' : 'Catalog checking';
}

function renderRadio(target = els.radioGrid, tracks = state.radioResults, compactCard = false) {
  target.innerHTML = tracks.length ? tracks.map((track, index) => radioTemplate(track, index, compactCard)).join('') : emptyState('No live stations', 'Try another station name or genre.');
  $$('[data-radio-play]', target).forEach(button => button.addEventListener('click', event => {
    event.stopPropagation();
    playFrom(tracks, Number(button.dataset.radioPlay));
  }));
  $$('[data-radio-index]', target).forEach(card => card.addEventListener('click', () => {
    playFrom(tracks, Number(card.dataset.radioIndex));
  }));
}

function refreshAll() {
  renderCards();
  renderLibrary();
  renderSearch();
  renderDiscover();
  renderQueue();
  updatePlayer();
  renderProviderStrip();
}

function clearPlaybackTimer() {
  if (state.playbackTimer) {
    clearTimeout(state.playbackTimer);
    state.playbackTimer = null;
  }
}

function armPlaybackWatchdog(track) {
  clearPlaybackTimer();
  state.playbackTimer = setTimeout(() => {
    if (state.current?.id === track.id && els.audio.paused && els.audio.readyState < 3) {
      handlePlaybackFailure(track, 'The stream did not become playable in time.');
    }
  }, track.isLive ? 14000 : 10000);
}

function playFrom(tracks, index) {
  if (!tracks[index]) return;
  if (state.current?.id === tracks[index].id) {
    togglePlayback();
    return;
  }
  state.queue = [...tracks];
  state.queueIndex = index;
  loadTrack(tracks[index], true);
  renderQueue();
}

function loadTrack(track, autoplay = false) {
  clearPlaybackTimer();
  state.failureInProgress = false;
  state.current = track;
  els.audio.pause();
  els.audio.removeAttribute('src');
  els.audio.load();
  els.audio.src = track.streamUrl?.startsWith('demo:') ? makeDemoAudio(track.streamUrl.slice(5)) : track.streamUrl;
  els.audio.volume = store.volume;
  els.volume.value = store.volume;
  els.progress.disabled = Boolean(track.isLive);
  store.addRecent(track);
  updatePlayer();
  renderLibrary();
  renderCards();
  renderDiscover();
  renderSearch();
  renderRadio();
  if (state.radioResults.length) renderRadio(els.homeRadioGrid, state.radioResults.slice(0, 6), true);

  if (autoplay) {
    armPlaybackWatchdog(track);
    els.audio.play().catch(error => {
      const message = error?.name === 'NotAllowedError'
        ? 'Your browser blocked autoplay. Tap play once.'
        : 'That source could not start.';
      if (error?.name === 'NotAllowedError') {
        clearPlaybackTimer();
        toast('Playback needs a tap', message);
        updatePlayer();
      } else {
        handlePlaybackFailure(track, message);
      }
    });
  }

  if ('mediaSession' in navigator) {
    try {
      navigator.mediaSession.metadata = new MediaMetadata({
        title: track.title,
        artist: track.artist,
        album: `${track.provider || 'Auralis'} · ${track.isLive ? 'Live radio' : (track.genre || 'Music')}`,
        artwork: track.artwork ? [{ src: track.artwork }] : []
      });
    } catch {}
  }
}

function findNextPlayableIndex() {
  if (!state.queue.length) return -1;
  for (let step = 1; step <= state.queue.length; step++) {
    const index = (state.queueIndex + step) % state.queue.length;
    if (!state.failedTracks.has(state.queue[index]?.id)) return index;
  }
  return -1;
}

function handlePlaybackFailure(track, detail = 'Try another source.') {
  if (!track || state.current?.id !== track.id || state.failureInProgress) return;
  state.failureInProgress = true;
  clearPlaybackTimer();
  state.failedTracks.add(track.id);
  const nextIndex = findNextPlayableIndex();
  if (nextIndex >= 0 && nextIndex !== state.queueIndex) {
    toast(`${track.provider || 'Provider'} stream skipped`, 'Auralis is moving to the next playable item automatically.');
    state.queueIndex = nextIndex;
    setTimeout(() => {
      state.failureInProgress = false;
      loadTrack(state.queue[nextIndex], true);
    }, 180);
    return;
  }
  toast('Could not start playback', detail);
  state.failureInProgress = false;
  updatePlayer();
}

function togglePlayback() {
  if (!state.current) {
    playFrom(state.trending, 0);
    return;
  }
  if (els.audio.paused) {
    armPlaybackWatchdog(state.current);
    els.audio.play().catch(error => {
      clearPlaybackTimer();
      if (error?.name === 'NotAllowedError') toast('Playback needs a tap', 'Try once more.');
      else handlePlaybackFailure(state.current, 'Try another track or station.');
    });
  } else {
    els.audio.pause();
  }
}

function nextTrack(userInitiated = true) {
  if (!state.queue.length) return;
  let next;
  if (state.shuffle && state.queue.length > 1) {
    do {
      next = Math.floor(Math.random() * state.queue.length);
    } while (next === state.queueIndex);
  } else {
    next = state.queueIndex + 1;
  }
  if (next >= state.queue.length) {
    if (state.repeat === 'all') next = 0;
    else if (userInitiated) next = 0;
    else return;
  }
  state.queueIndex = next;
  loadTrack(state.queue[next], true);
}

function prevTrack() {
  if (!state.current?.isLive && els.audio.currentTime > 4) {
    els.audio.currentTime = 0;
    return;
  }
  if (!state.queue.length) return;
  let prev = state.queueIndex - 1;
  if (prev < 0) prev = state.repeat === 'all' ? state.queue.length - 1 : 0;
  state.queueIndex = prev;
  loadTrack(state.queue[prev], true);
}

function toggleLike(track = state.current) {
  if (!track) return;
  const liked = store.toggleLike(track);
  toast(liked ? 'Added to Liked Songs' : 'Removed from Liked Songs', track.title);
  refreshAll();
}

function updatePlayer() {
  const track = state.current;
  els.playerTitle.textContent = track?.title || 'Choose a track';
  els.playerArtist.textContent = track?.artist || 'Auralis';
  if (els.playerSource) {
    els.playerSource.textContent = track
      ? `${track.provider || 'Music'} · ${track.isLive ? 'LIVE' : (track.genre || 'Open catalog')}`
      : 'Multi-source player';
  }
  els.play.textContent = track && !els.audio.paused ? '❚❚' : '▶';
  els.playerLike.classList.toggle('liked', Boolean(track) && store.isLiked(track.id));
  els.playerLike.textContent = track && store.isLiked(track.id) ? '♥' : '♡';
  if (track?.artwork) {
    els.playerCover.innerHTML = `<img src="${escapeHtml(track.artwork)}" alt="${escapeHtml(track.title)} artwork" referrerpolicy="no-referrer"/>`;
  } else {
    els.playerCover.innerHTML = `<span>${track?.isLive ? '◍' : 'A'}</span>`;
  }
  if (track?.isLive) {
    els.currentTime.textContent = 'LIVE';
    els.duration.textContent = 'LIVE';
    els.progress.value = 0;
    els.progress.disabled = true;
  } else {
    els.progress.disabled = false;
  }
}

function showView(view) {
  $$('.view').forEach(node => node.classList.remove('active-view'));
  $(`#${view}View`)?.classList.add('active-view');
  $$('[data-view]').forEach(button => button.classList.toggle('active', button.dataset.view === view));
  $('#contentScroll').scrollTop = 0;
}

function openQueue(open = true) {
  els.queueDrawer.classList.toggle('open', open);
  els.backdrop.classList.toggle('show', open);
  els.queueDrawer.setAttribute('aria-hidden', String(!open));
}

function toast(title, detail = '') {
  const node = document.createElement('div');
  node.className = 'toast';
  node.innerHTML = `${escapeHtml(title)}${detail ? `<small>${escapeHtml(detail)}</small>` : ''}`;
  els.toastRegion.append(node);
  setTimeout(() => node.remove(), 3600);
}

function setLoading(target, count = 5) {
  target.innerHTML = Array.from({ length: count }, () => '<div class="skeleton"></div>').join('');
}

async function loadTrending({ append = false } = {}) {
  if (!append) {
    setLoading(els.trending, 5);
    state.trendingOffset = 0;
  }
  const offset = append ? state.trendingOffset : 0;
  const tracks = await catalogManager.trendingTracks({ limit: 36, offset });
  renderProviderStrip();

  if (tracks.length) {
    state.trending = append ? mergeUnique(state.trending, tracks) : tracks;
    state.trendingOffset = offset + tracks.length;
    state.trendingHasMore = tracks.length >= 12;
    state.discoverResults = [...state.trending];
    state.trendingVisible = Math.min(append ? state.trendingVisible + 10 : 10, state.trending.length);
    renderCards();
    renderDiscover();
    return;
  }

  if (!append) {
    state.trending = [...fallbackTracks];
    state.discoverResults = [...fallbackTracks];
    state.trendingHasMore = false;
    renderCards();
    renderDiscover();
    toast('Demo catalog loaded', 'Live song providers are unavailable right now.');
  } else {
    state.trendingHasMore = false;
    renderCards();
    toast('You reached the end', 'No more trending tracks came back from the providers.');
  }
}

let searchTimer;

async function doSearch(query, { append = false } = {}) {
  const q = query.trim();
  if (!q) {
    showView('home');
    return;
  }

  const token = ++state.searchToken;
  if (!append) {
    state.searchQuery = q;
    state.searchOffset = 0;
    state.searchResults = [];
    showView('search');
    els.searchTitle.textContent = `“${q}”`;
    els.searchSubtitle.textContent = 'Searching Audius + Jamendo…';
    els.searchList.innerHTML = '<div class="empty-state"><strong>Searching…</strong>Looking across active song catalogs and removing duplicates.</div>';
  }

  const offset = append ? state.searchOffset : 0;
  try {
    const results = await catalogManager.searchTracks(q, { limit: 48, offset });
    if (token !== state.searchToken) return;
    if (!results.length && !append) throw new Error('No results');

    state.searchResults = append ? mergeUnique(state.searchResults, results) : results;
    state.searchOffset = offset + results.length;
    state.searchHasMore = results.length >= 16;
    const providers = [...new Set(state.searchResults.map(track => track.provider))].join(' + ');
    els.searchSubtitle.textContent = `${state.searchResults.length} playable result${state.searchResults.length === 1 ? '' : 's'} across ${providers || 'Auralis'}.`;
    renderSearch();
    renderProviderStrip();
  } catch {
    if (token !== state.searchToken) return;
    if (!append) {
      const local = fallbackTracks.filter(track =>
        `${track.title} ${track.artist} ${track.genre}`.toLowerCase().includes(q.toLowerCase())
      );
      state.searchResults = local;
      state.searchHasMore = false;
      els.searchSubtitle.textContent = 'Live search is unavailable — showing local demo matches.';
      renderSearch();
    }
  }
}

async function discoverQuery(query, title = query, { append = false } = {}) {
  if (!append) {
    showView('discover');
    state.activeCollection = null;
    state.discoverMode = 'query';
    state.discoverValue = query;
    state.discoverOffset = 0;
    state.discoverResults = [];
    els.discoverTitle.textContent = title;
    els.resultMeta.textContent = 'multi-source · loading…';
    els.discover.innerHTML = '<div class="empty-state"><strong>Finding tracks…</strong>Searching more than one song catalog.</div>';
  }

  const offset = append ? state.discoverOffset : 0;
  try {
    const tracks = await catalogManager.searchTracks(query, { limit: 48, offset });
    if (!tracks.length && !append) throw new Error('No tracks');
    state.discoverResults = append ? mergeUnique(state.discoverResults, tracks) : tracks;
    state.discoverOffset = offset + tracks.length;
    state.discoverHasMore = tracks.length >= 16;
    els.resultMeta.textContent = `${state.discoverResults.length} tracks · ${[...new Set(state.discoverResults.map(track => track.provider))].join(' + ')}`;
    renderDiscover();
    renderProviderStrip();
  } catch {
    if (!append) {
      state.discoverResults = fallbackTracks;
      state.discoverHasMore = false;
      els.resultMeta.textContent = 'demo catalog';
      renderDiscover();
      toast('Live discovery unavailable', 'Showing the built-in demo catalog.');
    }
  }
}

async function loadCollection(id, { append = false } = {}) {
  const collection = getCollection(id);
  if (!collection) return;

  if (!append) {
    state.activeCollection = id;
    state.discoverMode = 'collection';
    state.discoverValue = id;
    state.discoverOffset = 0;
    state.discoverResults = [];
    showView('discover');
    els.discoverTitle.textContent = collection.title;
    els.resultMeta.textContent = 'loading collection…';
    els.discover.innerHTML = `<div class="empty-state"><strong>${escapeHtml(collection.title)}</strong>${escapeHtml(collection.subtitle)} — loading playable tracks…</div>`;
  }

  const offset = append ? state.discoverOffset : 0;
  try {
    const tracks = await catalogManager.collection(collection, { limit: 48, offset });
    if (!tracks.length && !append) throw new Error('No tracks');
    state.discoverResults = append ? mergeUnique(state.discoverResults, tracks) : tracks;
    state.discoverOffset = offset + tracks.length;
    state.discoverHasMore = tracks.length >= 16;
    els.resultMeta.textContent = `${state.discoverResults.length} tracks · ${[...new Set(state.discoverResults.map(track => track.provider))].join(' + ')}`;
    renderDiscover();
    renderProviderStrip();
  } catch {
    if (!append) {
      state.discoverResults = fallbackTracks;
      state.discoverHasMore = false;
      els.resultMeta.textContent = 'demo catalog';
      renderDiscover();
      toast('Collection source unavailable', 'Auralis kept the experience alive with the demo catalog.');
    }
  }
}

async function loadMoreDiscover() {
  if (!state.discoverHasMore) return;
  els.discoverMore.disabled = true;
  els.discoverMore.textContent = 'Loading…';
  if (state.discoverMode === 'collection') await loadCollection(state.discoverValue, { append: true });
  else if (state.discoverMode === 'query') await discoverQuery(state.discoverValue, els.discoverTitle.textContent, { append: true });
  els.discoverMore.disabled = false;
  els.discoverMore.textContent = 'Load more tracks';
}

async function loadRadio({ query = '', mode = 'top', append = false } = {}) {
  if (!append) {
    state.radioQuery = query;
    state.radioMode = mode;
    state.radioOffset = 0;
    state.radioResults = [];
    if (mode === 'top') els.radioTitle.textContent = 'Popular live stations';
    else els.radioTitle.textContent = query ? `Live: ${query}` : 'Live stations';
    els.radioMeta.textContent = 'loading…';
    if (els.radioGrid) els.radioGrid.innerHTML = '<div class="empty-state"><strong>Tuning in…</strong>Finding healthy live stations.</div>';
  }

  const offset = append ? state.radioOffset : 0;
  const tracks = mode === 'top'
    ? await catalogManager.radioTop({ limit: 24, offset })
    : await catalogManager.radioSearch(query, { limit: 24, offset, tag: mode === 'tag' });

  state.radioResults = append ? mergeUnique(state.radioResults, tracks) : tracks;
  state.radioOffset = offset + tracks.length;
  state.radioHasMore = tracks.length >= 12;
  els.radioMeta.textContent = `${state.radioResults.length} live station${state.radioResults.length === 1 ? '' : 's'}`;
  renderRadio();
  if (els.radioMore) els.radioMore.hidden = !state.radioHasMore;
  if (state.radioResults.length) renderRadio(els.homeRadioGrid, state.radioResults.slice(0, 6), true);
  else els.homeRadioGrid.innerHTML = emptyState('Live radio is checking', 'The rest of Auralis stays available if radio is temporarily offline.');
  renderProviderStrip();
}

function bindStaticNavigation() {
  $$('[data-view]').forEach(button => button.addEventListener('click', () => showView(button.dataset.view)));
  $$('[data-view-trigger]').forEach(button => button.addEventListener('click', () => showView(button.dataset.viewTrigger)));
  $$('[data-query]').forEach(button => button.addEventListener('click', () => discoverQuery(button.dataset.query, `Exploring ${button.textContent.trim()}`)));

  $('#browseAllCollections')?.addEventListener('click', () => showView('collections'));
  $('#browseAllGenres')?.addEventListener('click', () => showView('genres'));
  $('#browseAllMoods')?.addEventListener('click', () => showView('moods'));
  $('#browseLiveRadio')?.addEventListener('click', () => showView('radio'));

  $('#queueButton').addEventListener('click', () => openQueue(true));
  $('#mobileQueueButton').addEventListener('click', () => openQueue(true));
  $('#closeQueue').addEventListener('click', () => openQueue(false));
  els.backdrop.addEventListener('click', () => openQueue(false));
  $('#clearQueue').addEventListener('click', () => {
    state.queue = [];
    state.queueIndex = -1;
    renderQueue();
  });

  $('#newPlaylistButton').addEventListener('click', () => toast(
    'Cloud playlists are next',
    'Auralis App #1 is isolated in Project Hub; account-backed playlist UI is the next backend release.'
  ));

  $('#showMoreTrending')?.addEventListener('click', async () => {
    if (state.trendingVisible < state.trending.length) {
      state.trendingVisible = Math.min(state.trendingVisible + 10, state.trending.length);
      renderCards();
    } else if (state.trendingHasMore) {
      await loadTrending({ append: true });
    }
  });

  $('#trendingMoreBottom')?.addEventListener('click', async () => {
    if (state.trendingVisible < state.trending.length) {
      state.trendingVisible = Math.min(state.trendingVisible + 10, state.trending.length);
      renderCards();
    } else if (state.trendingHasMore) {
      await loadTrending({ append: true });
    }
  });

  $('#showMoreCollections')?.addEventListener('click', () => {
    state.homeCollectionLimit = Math.min(collections.length, state.homeCollectionLimit + 8);
    renderCollections();
    if (state.homeCollectionLimit >= collections.length) $('#showMoreCollections').textContent = 'All shown';
  });

  $('#seeAllTrending').addEventListener('click', () => {
    state.discoverMode = 'trending';
    state.discoverValue = null;
    state.discoverResults = [...state.trending];
    state.discoverHasMore = state.trendingHasMore;
    els.discoverTitle.textContent = 'Trending across Auralis';
    els.resultMeta.textContent = `${state.trending.length} tracks`;
    renderDiscover();
    showView('discover');
  });
}

function bindSearch() {
  els.search.addEventListener('input', () => {
    clearTimeout(searchTimer);
    searchTimer = setTimeout(() => doSearch(els.search.value), 320);
  });

  els.search.addEventListener('keydown', event => {
    if (event.key === 'Enter') {
      clearTimeout(searchTimer);
      doSearch(els.search.value);
    }
  });

  els.searchMore?.addEventListener('click', async () => {
    if (!state.searchQuery || !state.searchHasMore) return;
    els.searchMore.disabled = true;
    els.searchMore.textContent = 'Loading…';
    await doSearch(state.searchQuery, { append: true });
    els.searchMore.disabled = false;
    els.searchMore.textContent = 'Load more results';
  });

  els.discoverMore?.addEventListener('click', loadMoreDiscover);
}

function bindRadio() {
  $('#radioSearchButton')?.addEventListener('click', () => {
    const q = els.radioSearchInput.value.trim();
    loadRadio({ query: q, mode: q ? 'search' : 'top' });
  });

  els.radioSearchInput?.addEventListener('keydown', event => {
    if (event.key === 'Enter') {
      const q = els.radioSearchInput.value.trim();
      loadRadio({ query: q, mode: q ? 'search' : 'top' });
    }
  });

  $$('[data-radio-tag]').forEach(button => button.addEventListener('click', () => {
    const tag = button.dataset.radioTag;
    els.radioSearchInput.value = tag;
    loadRadio({ query: tag, mode: 'tag' });
  }));

  els.radioMore?.addEventListener('click', async () => {
    if (!state.radioHasMore) return;
    els.radioMore.disabled = true;
    els.radioMore.textContent = 'Loading…';
    await loadRadio({ query: state.radioQuery, mode: state.radioMode, append: true });
    els.radioMore.disabled = false;
    els.radioMore.textContent = 'Load more stations';
  });
}

function bindPlayer() {
  els.play.addEventListener('click', togglePlayback);
  els.next.addEventListener('click', () => nextTrack(true));
  els.prev.addEventListener('click', prevTrack);
  els.playerLike.addEventListener('click', () => toggleLike());

  els.shuffle.addEventListener('click', () => {
    state.shuffle = !state.shuffle;
    els.shuffle.classList.toggle('active-control', state.shuffle);
    toast(state.shuffle ? 'Shuffle on' : 'Shuffle off');
  });

  els.repeat.addEventListener('click', () => {
    state.repeat = state.repeat === 'off' ? 'all' : state.repeat === 'all' ? 'one' : 'off';
    els.repeat.classList.toggle('active-control', state.repeat !== 'off');
    els.repeat.textContent = state.repeat === 'one' ? '↻¹' : '↻';
    toast(`Repeat ${state.repeat}`);
  });

  els.audio.addEventListener('play', () => {
    updatePlayer();
    renderCards();
  });

  els.audio.addEventListener('playing', () => {
    clearPlaybackTimer();
    state.failureInProgress = false;
    if (state.current) state.failedTracks.delete(state.current.id);
    updatePlayer();
  });

  els.audio.addEventListener('canplay', clearPlaybackTimer);

  els.audio.addEventListener('pause', () => {
    updatePlayer();
    renderCards();
  });

  els.audio.addEventListener('timeupdate', () => {
    if (state.current?.isLive) {
      els.progress.value = 0;
      els.currentTime.textContent = 'LIVE';
      els.duration.textContent = 'LIVE';
      return;
    }
    const duration = els.audio.duration || state.current?.duration || 0;
    const progress = duration ? els.audio.currentTime / duration * 100 : 0;
    els.progress.value = progress;
    els.currentTime.textContent = formatTime(els.audio.currentTime);
    els.duration.textContent = formatTime(duration);
  });

  els.audio.addEventListener('loadedmetadata', () => {
    if (!state.current?.isLive) els.duration.textContent = formatTime(els.audio.duration);
  });

  els.audio.addEventListener('ended', () => {
    if (state.repeat === 'one') {
      els.audio.currentTime = 0;
      els.audio.play();
    } else {
      nextTrack(false);
    }
  });

  els.audio.addEventListener('error', () => {
    if (state.current) handlePlaybackFailure(state.current, 'The provider rejected or lost this stream.');
  });

  els.progress.addEventListener('input', () => {
    if (!state.current?.isLive && els.audio.duration) {
      els.audio.currentTime = Number(els.progress.value) / 100 * els.audio.duration;
    }
  });

  els.volume.addEventListener('input', () => {
    els.audio.volume = Number(els.volume.value);
    store.setVolume(Number(els.volume.value));
  });

  document.addEventListener('keydown', event => {
    if (event.target.matches('input,textarea')) return;
    if (event.key === ' ') {
      event.preventDefault();
      togglePlayback();
    }
    if (event.key === '/') {
      event.preventDefault();
      els.search.focus();
    }
    if (event.key === 'ArrowRight' && event.altKey) nextTrack(true);
    if (event.key === 'ArrowLeft' && event.altKey) prevTrack();
  });

  if ('mediaSession' in navigator) {
    navigator.mediaSession.setActionHandler?.('play', () => els.audio.play());
    navigator.mediaSession.setActionHandler?.('pause', () => els.audio.pause());
    navigator.mediaSession.setActionHandler?.('nexttrack', () => nextTrack(true));
    navigator.mediaSession.setActionHandler?.('previoustrack', prevTrack);
  }
}

async function refreshCatalogs() {
  const refresh = $('#refreshButton');
  refresh.disabled = true;
  refresh.textContent = '…';
  await Promise.allSettled([
    loadTrending(),
    loadRadio({ mode: 'top' })
  ]);
  refresh.disabled = false;
  refresh.textContent = '↻';
  toast('Catalog refreshed', 'Auralis checked music and live-radio sources.');
}

$('#refreshButton').addEventListener('click', refreshCatalogs);
$('#heroPlayButton').addEventListener('click', () => {
  const index = Math.floor(Math.random() * Math.max(1, state.trending.length));
  playFrom(state.trending, index);
});

bindStaticNavigation();
bindSearch();
bindRadio();
bindPlayer();

els.audio.volume = store.volume;
els.volume.value = store.volume;

renderCollections();
renderWorlds();
renderProviderStrip();
renderLibrary();
renderCards();
renderDiscover();
renderQueue();

Promise.allSettled([
  loadTrending(),
  loadRadio({ mode: 'top' })
]);

if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => navigator.serviceWorker.register('./sw.js').catch(() => {}));
}
