import { audiusProvider } from './providers/audius.js';
import { jamendoProvider } from './providers/jamendo.js';
import { collections, featuredCollectionIds, getCollection } from './collections.js';
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
  providerStrip: $('#providerStrip'),
  collectionCount: $('#collectionCount')
};

const demoAudioCache = new Map();
function makeDemoAudio(key='auralis') {
  if (demoAudioCache.has(key)) return demoAudioCache.get(key);
  const sampleRate = 8000, seconds = 12, samples = sampleRate * seconds;
  const buffer = new ArrayBuffer(44 + samples * 2);
  const view = new DataView(buffer);
  const write = (offset, text) => [...text].forEach((c,i)=>view.setUint8(offset+i,c.charCodeAt(0)));
  write(0,'RIFF'); view.setUint32(4,36+samples*2,true); write(8,'WAVE'); write(12,'fmt ');
  view.setUint32(16,16,true); view.setUint16(20,1,true); view.setUint16(22,1,true); view.setUint32(24,sampleRate,true);
  view.setUint32(28,sampleRate*2,true); view.setUint16(32,2,true); view.setUint16(34,16,true); write(36,'data'); view.setUint32(40,samples*2,true);
  const seed = [...key].reduce((a,c)=>a+c.charCodeAt(0),0);
  const base = 82 + (seed % 85);
  for (let i=0;i<samples;i++) {
    const t=i/sampleRate, section=Math.floor(t/3)%4, freq=base*Math.pow(2,[0,3,7,10][section]/12);
    const pulse=Math.max(0,1-((t*2)%1)*7);
    const fade=Math.min(1,t/.7,(seconds-t)/.8);
    const v=(Math.sin(2*Math.PI*freq*t)*.15 + Math.sin(2*Math.PI*freq*1.5*t+.4)*.065 + Math.sin(2*Math.PI*55*t)*.04*pulse)*Math.max(0,fade);
    view.setInt16(44+i*2,Math.max(-32767,Math.min(32767,Math.floor(v*32767))),true);
  }
  const url=URL.createObjectURL(new Blob([buffer],{type:'audio/wav'}));
  demoAudioCache.set(key,url);
  return url;
}

const state = {
  current: null,
  queue: [],
  queueIndex: -1,
  shuffle: false,
  repeat: 'off',
  trending: [...fallbackTracks],
  searchResults: [],
  discoverResults: [],
  searchToken: 0,
  activeCollection: null,
  providerHealth: {
    Audius: 'checking',
    Jamendo: jamendoProvider.usingTestClient ? 'demo' : 'checking',
    SoundCloud: 'planned',
    Cloud: 'planned'
  }
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

function escapeHtml(value='') {
  return String(value).replace(/[&<>'"]/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#039;','"':'&quot;'}[c]));
}

function canonicalTrackKey(track) {
  const clean = value => String(value || '').toLowerCase().replace(/[^a-z0-9]+/g,'').slice(0,80);
  return `${clean(track.title)}::${clean(track.artist)}`;
}

function dedupeTracks(tracks) {
  const seen = new Set();
  return tracks.filter(track => {
    const key = canonicalTrackKey(track);
    if (!key || seen.has(key)) return false;
    seen.add(key);
    return Boolean(track.streamUrl);
  });
}

function interleave(groups, limit = 50) {
  const pools = groups.filter(group => Array.isArray(group) && group.length).map(group => [...group]);
  const merged = [];
  while (pools.some(pool => pool.length) && merged.length < limit) {
    pools.forEach(pool => {
      if (pool.length && merged.length < limit) merged.push(pool.shift());
    });
  }
  return dedupeTracks(merged).slice(0,limit);
}

function providerClass(provider='') { return provider.toLowerCase().replace(/[^a-z0-9]/g,''); }
function providerBadge(track) { return `<span class="provider-badge ${providerClass(track.provider)}">${escapeHtml(track.provider || 'Music')}</span>`; }

function imgTag(track, className='') {
  const title = escapeHtml(track.title);
  if (!track.artwork) return `<span class="cover-fallback ${className}">${escapeHtml((track.title || 'A')[0])}</span>`;
  return `<img class="${className}" src="${escapeHtml(track.artwork)}" alt="${title} artwork" loading="lazy" onerror="this.style.display='none';this.parentElement.classList.add('image-failed')"/>`;
}

function isCurrent(track) { return state.current?.id === track.id; }

function cardTemplate(track, index) {
  return `<article class="music-card ${isCurrent(track) ? 'active' : ''}" data-track-index="${index}">
    <div class="cover-wrap">${providerBadge(track)}${imgTag(track)}<button class="card-play" data-play-index="${index}" aria-label="Play ${escapeHtml(track.title)}">${isCurrent(track) && !els.audio.paused ? '❚❚' : '▶'}</button></div>
    <h3>${escapeHtml(track.title)}</h3><p>${escapeHtml(track.artist)}</p>
    <div class="card-meta"><span>${escapeHtml(track.genre || 'Music')}</span><span>${compact(track.playCount)} plays</span></div>
  </article>`;
}

function rowTemplate(track, index, source) {
  const liked = store.isLiked(track.id);
  return `<div class="track-row ${isCurrent(track) ? 'active' : ''}" data-track-index="${index}" data-source="${source}">
    <button class="track-index row-more" data-play-row="${index}" aria-label="Play ${escapeHtml(track.title)}">${isCurrent(track) && !els.audio.paused ? '❚❚' : (index + 1)}</button>
    <div class="row-title"><div class="row-cover">${track.artwork ? `<img src="${escapeHtml(track.artwork)}" alt="" loading="lazy"/>` : `<span>${escapeHtml(track.title[0] || 'A')}</span>`}</div><div class="row-title-copy"><strong>${escapeHtml(track.title)}</strong><span>${escapeHtml(track.artist)}</span></div></div>
    <span class="row-secondary row-genre">${providerBadge(track)}${escapeHtml(track.genre || 'Music')}</span>
    <span class="row-secondary">${compact(track.playCount)} plays</span>
    <span class="row-duration">${formatTime(track.duration)}</span>
    <button class="row-like ${liked ? 'liked' : ''}" data-like-row="${index}" aria-label="${liked ? 'Unlike' : 'Like'} ${escapeHtml(track.title)}">${liked ? '♥' : '♡'}</button>
  </div>`;
}

function emptyState(title, detail) { return `<div class="empty-state"><strong>${escapeHtml(title)}</strong>${escapeHtml(detail)}</div>`; }

function collectionTemplate(collection) {
  const source = collection.source === 'jamendo' ? 'Jamendo' : collection.source === 'audius' ? 'Audius' : 'Multi-source';
  return `<button class="collection-card" data-collection="${escapeHtml(collection.id)}" data-accent="${escapeHtml(collection.accent)}">
    <span class="collection-icon">${escapeHtml(collection.icon)}</span>
    <strong>${escapeHtml(collection.title)}</strong>
    <small>${escapeHtml(collection.subtitle)}</small>
    <span class="collection-source">${source}</span>
  </button>`;
}

function renderCollections() {
  const featured = featuredCollectionIds.map(getCollection).filter(Boolean);
  els.homeCollections.innerHTML = featured.map(collectionTemplate).join('');
  els.collectionGrid.innerHTML = collections.map(collectionTemplate).join('');
  if (els.collectionCount) els.collectionCount.textContent = `${collections.length} curated collections`;
  $$('[data-collection]').forEach(button => button.addEventListener('click', () => loadCollection(button.dataset.collection)));
}

function renderProviderStrip() {
  const cards = [
    { name:'Audius', status:state.providerHealth.Audius, text:'Primary full-stream open catalog with trending, search and deep discovery endpoints.' },
    { name:'Jamendo', status:state.providerHealth.Jamendo, text:jamendoProvider.usingTestClient ? 'Independent full-track catalog using Jamendo’s official read-API test client for this college demo.' : 'Independent full-track catalog with a configured developer client.' },
    { name:'SoundCloud', status:'planned', text:'Provider adapter planned. Requires a registered SoundCloud app and OAuth credentials before activation.' },
    { name:'Auralis Cloud', status:'planned', text:'Profiles, playlists, likes and history will sync through the isolated Supabase Project Hub schema.' }
  ];
  els.providerStrip.innerHTML = cards.map(card => `<article class="provider-card"><div class="provider-card-top"><strong>${escapeHtml(card.name)}</strong><span class="provider-status ${escapeHtml(card.status)}">${escapeHtml(card.status === 'checking' ? 'checking' : card.status)}</span></div><p>${escapeHtml(card.text)}</p></article>`).join('');
}

function renderCards() {
  els.trending.innerHTML = state.trending.slice(0,10).map(cardTemplate).join('');
  $$('[data-play-index]', els.trending).forEach(btn => btn.addEventListener('click', e => { e.stopPropagation(); playFrom(state.trending, Number(btn.dataset.playIndex)); }));
  $$('.music-card', els.trending).forEach(card => card.addEventListener('click', () => playFrom(state.trending, Number(card.dataset.trackIndex))));
}

function renderList(target, tracks, source, emptyTitle='Nothing here yet', emptyDetail='Play or save a few tracks and they’ll appear here.') {
  target.innerHTML = tracks.length ? tracks.map((t,i)=>rowTemplate(t,i,source)).join('') : emptyState(emptyTitle, emptyDetail);
  $$('[data-play-row]', target).forEach(btn => btn.addEventListener('click', () => playFrom(tracks, Number(btn.dataset.playRow))));
  $$('[data-like-row]', target).forEach(btn => btn.addEventListener('click', () => toggleLike(tracks[Number(btn.dataset.likeRow)])));
}

function renderLibrary() {
  renderList(els.liked, store.liked, 'liked', 'No liked songs yet', 'Tap the heart beside any track to keep it here.');
  renderList(els.recent, store.recent, 'recent', 'No listening history yet', 'Your recently played tracks are stored locally until Auralis Cloud sync is enabled.');
  renderList(els.recentPreview, store.recent.slice(0,5), 'recentPreview', 'Your history is empty', 'Start a track and it will show up here.');
  els.likedCountText.textContent = `${store.liked.length} saved ${store.liked.length === 1 ? 'track' : 'tracks'} on this device.`;
}

function renderSearch() { renderList(els.searchList, state.searchResults, 'search', 'No matches', 'Try another track, artist, genre or mood.'); }
function renderDiscover() { renderList(els.discover, state.discoverResults, 'discover', 'Nothing loaded yet', 'Open a collection or pick a genre to start exploring.'); }

function renderQueue() {
  els.queueCount.textContent = state.queue.length;
  if (!state.queue.length) { els.queueList.innerHTML = emptyState('Queue is empty','Choose a track or open a collection.'); return; }
  els.queueList.innerHTML = state.queue.map((t,i)=>`<div class="queue-item"><div class="queue-item-cover">${t.artwork ? `<img src="${escapeHtml(t.artwork)}" alt=""/>` : ''}</div><div class="queue-item-copy"><strong>${escapeHtml(t.title)}</strong><span>${escapeHtml(t.artist)} · ${escapeHtml(t.provider || 'Music')}</span></div><button class="queue-remove" data-remove="${i}" aria-label="Remove from queue">×</button></div>`).join('');
  $$('[data-remove]',els.queueList).forEach(button => button.addEventListener('click',()=>{ const i=Number(button.dataset.remove); state.queue.splice(i,1); if(i < state.queueIndex) state.queueIndex--; renderQueue(); }));
}

function refreshAll() { renderCards(); renderLibrary(); renderSearch(); renderDiscover(); renderQueue(); updatePlayer(); renderProviderStrip(); }

function playFrom(tracks, index) {
  if (!tracks[index]) return;
  if (state.current?.id === tracks[index].id) { togglePlayback(); return; }
  state.queue = [...tracks];
  state.queueIndex = index;
  loadTrack(tracks[index], true);
  renderQueue();
}

function loadTrack(track, autoplay=false) {
  state.current = track;
  els.audio.src = track.streamUrl?.startsWith('demo:') ? makeDemoAudio(track.streamUrl.slice(5)) : track.streamUrl;
  els.audio.volume = store.volume;
  els.volume.value = store.volume;
  store.addRecent(track);
  updatePlayer();
  renderLibrary(); renderCards(); renderDiscover(); renderSearch();
  if (autoplay) {
    els.audio.play().catch(err => {
      toast('Playback needs attention', err?.message?.includes('NotSupported') ? 'This provider stream is unavailable for this track.' : 'Tap play once more if your browser blocked autoplay.');
      updatePlayer();
    });
  }
  if ('mediaSession' in navigator) {
    try {
      navigator.mediaSession.metadata = new MediaMetadata({ title:track.title, artist:track.artist, album:`${track.provider || 'Auralis'} · ${track.genre || 'Music'}`, artwork:track.artwork ? [{src:track.artwork}] : [] });
    } catch {}
  }
}

function togglePlayback() {
  if (!state.current) { playFrom(state.trending,0); return; }
  if (els.audio.paused) els.audio.play().catch(()=>toast('Could not start playback','Try another track.'));
  else els.audio.pause();
}

function nextTrack(userInitiated=true) {
  if (!state.queue.length) return;
  let next;
  if (state.shuffle && state.queue.length > 1) {
    do { next = Math.floor(Math.random()*state.queue.length); } while (next === state.queueIndex);
  } else next = state.queueIndex + 1;
  if (next >= state.queue.length) {
    if (state.repeat === 'all') next = 0;
    else { if (userInitiated) next = 0; else return; }
  }
  state.queueIndex = next;
  loadTrack(state.queue[next], true);
}

function prevTrack() {
  if (els.audio.currentTime > 4) { els.audio.currentTime = 0; return; }
  if (!state.queue.length) return;
  let prev = state.queueIndex - 1;
  if (prev < 0) prev = state.repeat === 'all' ? state.queue.length-1 : 0;
  state.queueIndex = prev;
  loadTrack(state.queue[prev], true);
}

function toggleLike(track=state.current) {
  if (!track) return;
  const liked = store.toggleLike(track);
  toast(liked ? 'Added to Liked Songs' : 'Removed from Liked Songs', track.title);
  refreshAll();
}

function updatePlayer() {
  const track = state.current;
  els.playerTitle.textContent = track?.title || 'Choose a track';
  els.playerArtist.textContent = track?.artist || 'Auralis';
  if (els.playerSource) els.playerSource.textContent = track ? `${track.provider || 'Music'} · ${track.genre || 'Open catalog'}` : 'Multi-source player';
  els.play.textContent = track && !els.audio.paused ? '❚❚' : '▶';
  els.playerLike.classList.toggle('liked', !!track && store.isLiked(track.id));
  els.playerLike.textContent = track && store.isLiked(track.id) ? '♥' : '♡';
  if (track?.artwork) els.playerCover.innerHTML = `<img src="${escapeHtml(track.artwork)}" alt="${escapeHtml(track.title)} artwork"/>`;
  else els.playerCover.innerHTML = '<span>A</span>';
}

function showView(view) {
  $$('.view').forEach(v=>v.classList.remove('active-view'));
  $(`#${view}View`)?.classList.add('active-view');
  $$('[data-view]').forEach(b=>b.classList.toggle('active',b.dataset.view===view));
  $('#contentScroll').scrollTop = 0;
}

function openQueue(open=true) {
  els.queueDrawer.classList.toggle('open',open);
  els.backdrop.classList.toggle('show',open);
  els.queueDrawer.setAttribute('aria-hidden', String(!open));
}

function toast(title, detail='') {
  const node=document.createElement('div');
  node.className='toast';
  node.innerHTML=`${escapeHtml(title)}${detail?`<small>${escapeHtml(detail)}</small>`:''}`;
  els.toastRegion.append(node);
  setTimeout(()=>node.remove(),3400);
}

function setLoading(target, count=5) { target.innerHTML = Array.from({length:count},()=>'<div class="skeleton"></div>').join(''); }

async function multiSearch(query, limit=40) {
  const perProvider = Math.max(12, Math.ceil(limit / 2));
  const [audiusResult, jamendoResult] = await Promise.allSettled([
    audiusProvider.search(query, perProvider),
    jamendoProvider.search(query, perProvider)
  ]);

  const groups = [];
  if (audiusResult.status === 'fulfilled') { state.providerHealth.Audius = 'online'; groups.push(audiusResult.value); }
  else state.providerHealth.Audius = 'offline';

  if (jamendoResult.status === 'fulfilled') { state.providerHealth.Jamendo = jamendoProvider.usingTestClient ? 'demo' : 'online'; groups.push(jamendoResult.value); }
  else state.providerHealth.Jamendo = 'offline';

  renderProviderStrip();
  return interleave(groups, limit);
}

async function loadTrending() {
  setLoading(els.trending,5);
  const [audiusResult, jamendoResult] = await Promise.allSettled([
    audiusProvider.trending(22,'week'),
    jamendoProvider.popular(10)
  ]);

  const groups = [];
  if (audiusResult.status === 'fulfilled' && audiusResult.value.length) {
    state.providerHealth.Audius = 'online';
    groups.push(audiusResult.value);
  } else state.providerHealth.Audius = 'offline';

  if (jamendoResult.status === 'fulfilled' && jamendoResult.value.length) {
    state.providerHealth.Jamendo = jamendoProvider.usingTestClient ? 'demo' : 'online';
    groups.push(jamendoResult.value);
  } else state.providerHealth.Jamendo = 'offline';

  const tracks = interleave(groups,32);
  if (tracks.length) {
    state.trending = tracks;
    state.discoverResults = tracks;
    renderCards(); renderDiscover(); renderProviderStrip();
    return;
  }

  state.trending = [...fallbackTracks];
  state.discoverResults = [...fallbackTracks];
  renderCards(); renderDiscover(); renderProviderStrip();
  toast('Demo catalog loaded','Live providers are unavailable right now.');
}

let searchTimer;
async function doSearch(query) {
  const q=query.trim();
  if (!q) { showView('home'); return; }
  const token=++state.searchToken;
  showView('search');
  els.searchTitle.textContent = `“${q}”`;
  els.searchSubtitle.textContent = 'Searching Audius + Jamendo…';
  els.searchList.innerHTML = '<div class="empty-state"><strong>Searching…</strong>Looking across multiple catalogs and removing duplicates.</div>';
  try {
    const results=await multiSearch(q,48);
    if(token!==state.searchToken)return;
    if (!results.length) throw new Error('No results');
    state.searchResults=results;
    const providers=[...new Set(results.map(track=>track.provider))].join(' + ');
    els.searchSubtitle.textContent = `${results.length} playable result${results.length===1?'':'s'} across ${providers}.`;
    renderSearch();
  } catch {
    if(token!==state.searchToken)return;
    const local=fallbackTracks.filter(t=>`${t.title} ${t.artist} ${t.genre}`.toLowerCase().includes(q.toLowerCase()));
    state.searchResults=local;
    els.searchSubtitle.textContent = 'Live search is unavailable — showing local demo matches.';
    renderSearch();
  }
}

async function discover(query) {
  showView('discover');
  state.activeCollection = null;
  els.discoverTitle.textContent = `Exploring ${query}`;
  els.resultMeta.textContent = 'multi-source · loading…';
  els.discover.innerHTML = '<div class="empty-state"><strong>Finding tracks…</strong>Searching more than one catalog.</div>';
  try {
    const tracks = await multiSearch(query,42);
    if (!tracks.length) throw new Error('No tracks');
    state.discoverResults = tracks;
    els.resultMeta.textContent = `${tracks.length} tracks · ${[...new Set(tracks.map(t=>t.provider))].join(' + ')}`;
    renderDiscover();
  } catch {
    state.discoverResults = fallbackTracks;
    els.resultMeta.textContent = 'demo catalog';
    renderDiscover();
    toast('Live discovery unavailable','Showing the built-in demo catalog.');
  }
}

async function loadCollection(id) {
  const collection = getCollection(id);
  if (!collection) return;
  state.activeCollection = id;
  showView('discover');
  els.discoverTitle.textContent = collection.title;
  els.resultMeta.textContent = 'loading collection…';
  els.discover.innerHTML = `<div class="empty-state"><strong>${escapeHtml(collection.title)}</strong>${escapeHtml(collection.subtitle)} — loading playable tracks…</div>`;

  try {
    let tracks = [];
    if (collection.source === 'audius' && typeof audiusProvider[collection.loader] === 'function') {
      tracks = await audiusProvider[collection.loader](45);
      state.providerHealth.Audius = 'online';
    } else if (collection.source === 'jamendo') {
      try {
        tracks = await jamendoProvider.featured(collection.tag,45);
        state.providerHealth.Jamendo = jamendoProvider.usingTestClient ? 'demo' : 'online';
      } catch {
        tracks = await audiusProvider.search(collection.query,45);
      }
    } else {
      tracks = await multiSearch(collection.query,45);
    }

    tracks = dedupeTracks(tracks);
    if (!tracks.length) throw new Error('No tracks');
    state.discoverResults = tracks;
    els.resultMeta.textContent = `${tracks.length} tracks · ${[...new Set(tracks.map(t=>t.provider))].join(' + ')}`;
    renderDiscover(); renderProviderStrip();
  } catch {
    state.discoverResults = fallbackTracks;
    els.resultMeta.textContent = 'demo catalog';
    renderDiscover();
    toast('Collection provider unavailable','Auralis kept the experience alive with the local demo catalog.');
  }
}

$$('[data-view]').forEach(btn=>btn.addEventListener('click',()=>showView(btn.dataset.view)));
$$('[data-view-trigger]').forEach(btn=>btn.addEventListener('click',()=>showView(btn.dataset.viewTrigger)));
$$('[data-mood]').forEach(btn=>btn.addEventListener('click',()=>discover(btn.dataset.mood)));
$$('[data-query]').forEach(btn=>btn.addEventListener('click',()=>discover(btn.dataset.query)));
els.search.addEventListener('input',()=>{ clearTimeout(searchTimer); searchTimer=setTimeout(()=>doSearch(els.search.value),320); });
els.search.addEventListener('keydown',e=>{ if(e.key==='Enter') { clearTimeout(searchTimer); doSearch(els.search.value); }});
$('#refreshButton').addEventListener('click',loadTrending);
$('#heroPlayButton').addEventListener('click',()=>playFrom(state.trending,Math.floor(Math.random()*state.trending.length)));
$('#seeAllTrending').addEventListener('click',()=>{state.discoverResults=[...state.trending];els.discoverTitle.textContent='Trending across Auralis';els.resultMeta.textContent=`${state.trending.length} tracks`;renderDiscover();showView('discover');});
$('#browseAllCollections')?.addEventListener('click',()=>showView('collections'));
$('#queueButton').addEventListener('click',()=>openQueue(true));
$('#mobileQueueButton').addEventListener('click',()=>openQueue(true));
$('#closeQueue').addEventListener('click',()=>openQueue(false));
els.backdrop.addEventListener('click',()=>openQueue(false));
$('#clearQueue').addEventListener('click',()=>{state.queue=[];state.queueIndex=-1;renderQueue();});
$('#newPlaylistButton').addEventListener('click',()=>toast('Cloud playlists are staged','The Supabase Project Hub connection will make playlists sync across devices.'));
els.play.addEventListener('click',togglePlayback);
els.next.addEventListener('click',()=>nextTrack(true));
els.prev.addEventListener('click',prevTrack);
els.playerLike.addEventListener('click',()=>toggleLike());
els.shuffle.addEventListener('click',()=>{state.shuffle=!state.shuffle;els.shuffle.classList.toggle('active-control',state.shuffle);toast(state.shuffle?'Shuffle on':'Shuffle off');});
els.repeat.addEventListener('click',()=>{state.repeat=state.repeat==='off'?'all':state.repeat==='all'?'one':'off';els.repeat.classList.toggle('active-control',state.repeat!=='off');els.repeat.textContent=state.repeat==='one'?'↻¹':'↻';toast(`Repeat ${state.repeat}`);});
els.audio.addEventListener('play',()=>{updatePlayer();renderCards();});
els.audio.addEventListener('pause',()=>{updatePlayer();renderCards();});
els.audio.addEventListener('timeupdate',()=>{const d=els.audio.duration||state.current?.duration||0;const p=d?els.audio.currentTime/d*100:0;els.progress.value=p;els.currentTime.textContent=formatTime(els.audio.currentTime);els.duration.textContent=formatTime(d);});
els.audio.addEventListener('loadedmetadata',()=>els.duration.textContent=formatTime(els.audio.duration));
els.audio.addEventListener('ended',()=>{if(state.repeat==='one'){els.audio.currentTime=0;els.audio.play();}else nextTrack(false);});
els.audio.addEventListener('error',()=>{ if(state.current) toast(`${state.current.provider || 'Provider'} stream unavailable`,'Try another track — Auralis filters for playable sources but creator/provider restrictions can still change.'); updatePlayer(); });
els.progress.addEventListener('input',()=>{if(els.audio.duration)els.audio.currentTime=Number(els.progress.value)/100*els.audio.duration;});
els.volume.addEventListener('input',()=>{els.audio.volume=Number(els.volume.value);store.setVolume(Number(els.volume.value));});
document.addEventListener('keydown',e=>{if(e.target.matches('input,textarea'))return;if(e.key===' '){e.preventDefault();togglePlayback();}if(e.key==='/'){e.preventDefault();els.search.focus();}if(e.key==='ArrowRight'&&e.altKey)nextTrack(true);if(e.key==='ArrowLeft'&&e.altKey)prevTrack();});
if('mediaSession'in navigator){navigator.mediaSession.setActionHandler?.('play',()=>els.audio.play());navigator.mediaSession.setActionHandler?.('pause',()=>els.audio.pause());navigator.mediaSession.setActionHandler?.('nexttrack',()=>nextTrack(true));navigator.mediaSession.setActionHandler?.('previoustrack',prevTrack);}
if('serviceWorker'in navigator){window.addEventListener('load',()=>navigator.serviceWorker.register('./sw.js').catch(()=>{}));}

els.audio.volume=store.volume;
els.volume.value=store.volume;
renderCollections();
renderProviderStrip();
renderLibrary();
renderCards();
renderDiscover();
renderQueue();
loadTrending();
