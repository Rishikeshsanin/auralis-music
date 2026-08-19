import { audiusProvider } from './providers/audius.js';
import { store } from './store.js';
import { fallbackTracks } from './fallback.js';

const $ = (s, root = document) => root.querySelector(s);
const $$ = (s, root = document) => [...root.querySelectorAll(s)];

const els = {
  audio: $('#audio'), search: $('#searchInput'), trending: $('#trendingGrid'), discover: $('#discoverList'), liked: $('#likedList'), recent: $('#recentList'), recentPreview: $('#recentPreview'), searchList: $('#searchList'), searchTitle: $('#searchTitle'), searchSubtitle: $('#searchSubtitle'), discoverTitle: $('#discoverTitle'), resultMeta: $('#resultMeta'), queueDrawer: $('#queueDrawer'), backdrop: $('#drawerBackdrop'), queueList: $('#queueList'), queueCount: $('#queueCount'), playerCover: $('#playerCover'), playerTitle: $('#playerTitle'), playerArtist: $('#playerArtist'), playerLike: $('#playerLike'), play: $('#playButton'), prev: $('#prevButton'), next: $('#nextButton'), shuffle: $('#shuffleButton'), repeat: $('#repeatButton'), progress: $('#progressBar'), currentTime: $('#currentTime'), duration: $('#durationTime'), volume: $('#volumeBar'), likedCountText: $('#likedCountText'), toastRegion: $('#toastRegion')
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
    let v=(Math.sin(2*Math.PI*freq*t)*.15 + Math.sin(2*Math.PI*freq*1.5*t+.4)*.065 + Math.sin(2*Math.PI*55*t)*.04*pulse)*Math.max(0,fade);
    view.setInt16(44+i*2,Math.max(-32767,Math.min(32767,Math.floor(v*32767))),true);
  }
  const url=URL.createObjectURL(new Blob([buffer],{type:'audio/wav'})); demoAudioCache.set(key,url); return url;
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
  providerOnline: false,
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

function escapeHtml(value='') {
  return String(value).replace(/[&<>'"]/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#039;','"':'&quot;'}[c]));
}

function imgTag(track, className='') {
  const title = escapeHtml(track.title);
  if (!track.artwork) return `<span class="cover-fallback ${className}">${escapeHtml((track.title || 'A')[0])}</span>`;
  return `<img class="${className}" src="${escapeHtml(track.artwork)}" alt="${title} artwork" loading="lazy" onerror="this.style.display='none';this.parentElement.classList.add('image-failed')"/>`;
}

function isCurrent(track) { return state.current?.id === track.id; }

function cardTemplate(track, index) {
  return `<article class="music-card ${isCurrent(track) ? 'active' : ''}" data-track-index="${index}">
    <div class="cover-wrap">${imgTag(track)}<button class="card-play" data-play-index="${index}" aria-label="Play ${escapeHtml(track.title)}">${isCurrent(track) && !els.audio.paused ? '❚❚' : '▶'}</button></div>
    <h3>${escapeHtml(track.title)}</h3><p>${escapeHtml(track.artist)}</p>
    <div class="card-meta"><span>${escapeHtml(track.genre || 'Music')}</span><span>${compact(track.playCount)} plays</span></div>
  </article>`;
}

function rowTemplate(track, index, source) {
  const liked = store.isLiked(track.id);
  return `<div class="track-row ${isCurrent(track) ? 'active' : ''}" data-track-index="${index}" data-source="${source}">
    <button class="track-index row-more" data-play-row="${index}" aria-label="Play ${escapeHtml(track.title)}">${isCurrent(track) && !els.audio.paused ? '❚❚' : (index + 1)}</button>
    <div class="row-title"><div class="row-cover">${track.artwork ? `<img src="${escapeHtml(track.artwork)}" alt="" loading="lazy"/>` : `<span>${escapeHtml(track.title[0] || 'A')}</span>`}</div><div class="row-title-copy"><strong>${escapeHtml(track.title)}</strong><span>${escapeHtml(track.artist)}</span></div></div>
    <span class="row-secondary row-genre">${escapeHtml(track.genre || track.provider)}</span>
    <span class="row-secondary">${compact(track.playCount)} plays</span>
    <span class="row-duration">${formatTime(track.duration)}</span>
    <button class="row-like ${liked ? 'liked' : ''}" data-like-row="${index}" aria-label="${liked ? 'Unlike' : 'Like'} ${escapeHtml(track.title)}">${liked ? '♥' : '♡'}</button>
  </div>`;
}

function emptyState(title, detail) { return `<div class="empty-state"><strong>${escapeHtml(title)}</strong>${escapeHtml(detail)}</div>`; }

function renderCards() {
  els.trending.innerHTML = state.trending.slice(0,10).map(cardTemplate).join('');
  $$('[data-play-index]', els.trending).forEach(btn => btn.addEventListener('click', e => { e.stopPropagation(); playFrom(state.trending, Number(btn.dataset.playIndex)); }));
  $$('.music-card', els.trending).forEach(card => card.addEventListener('click', () => playFrom(state.trending, Number(card.dataset.trackIndex))));
}

function renderList(target, tracks, source, emptyTitle='Nothing here yet', emptyDetail='Play or save a few tracks and they’ll appear here.') {
  target.innerHTML = tracks.length ? tracks.map((t,i)=>rowTemplate(t,i,source)).join('') : emptyState(emptyTitle, emptyDetail);
  $$('[data-play-row]', target).forEach(btn => btn.addEventListener('click', () => playFrom(tracks, Number(btn.dataset.playRow))));
  $$('[data-like-row]', target).forEach(btn => btn.addEventListener('click', () => { const track = tracks[Number(btn.dataset.likeRow)]; toggleLike(track); }));
}

function renderLibrary() {
  renderList(els.liked, store.liked, 'liked', 'No liked songs yet', 'Tap the heart beside any track to keep it here.');
  renderList(els.recent, store.recent, 'recent', 'No listening history yet', 'Your recently played tracks are stored locally on this device.');
  renderList(els.recentPreview, store.recent.slice(0,5), 'recentPreview', 'Your history is empty', 'Start a track and it will show up here.');
  els.likedCountText.textContent = `${store.liked.length} saved ${store.liked.length === 1 ? 'track' : 'tracks'} on this device.`;
}

function renderSearch() { renderList(els.searchList, state.searchResults, 'search', 'No matches', 'Try a different track, artist, or mood.'); }
function renderDiscover() { renderList(els.discover, state.discoverResults, 'discover', 'Nothing loaded yet', 'Pick a genre above to start exploring.'); }

function renderQueue() {
  els.queueCount.textContent = state.queue.length;
  if (!state.queue.length) { els.queueList.innerHTML = emptyState('Queue is empty','Choose a track or start a playlist.'); return; }
  els.queueList.innerHTML = state.queue.map((t,i)=>`<div class="queue-item"><div class="queue-item-cover">${t.artwork ? `<img src="${escapeHtml(t.artwork)}" alt=""/>` : ''}</div><div class="queue-item-copy"><strong>${escapeHtml(t.title)}</strong><span>${escapeHtml(t.artist)}</span></div><button class="queue-remove" data-remove="${i}" aria-label="Remove from queue">×</button></div>`).join('');
  $$('[data-remove]',els.queueList).forEach(b=>b.addEventListener('click',()=>{ const i=Number(b.dataset.remove); state.queue.splice(i,1); if(i < state.queueIndex) state.queueIndex--; renderQueue(); }));
}

function refreshAll() { renderCards(); renderLibrary(); renderSearch(); renderDiscover(); renderQueue(); updatePlayer(); }

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
      navigator.mediaSession.metadata = new MediaMetadata({ title:track.title, artist:track.artist, album:track.provider, artwork:track.artwork ? [{src:track.artwork}] : [] });
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
  const t = state.current;
  els.playerTitle.textContent = t?.title || 'Choose a track';
  els.playerArtist.textContent = t?.artist || 'Auralis';
  els.play.textContent = t && !els.audio.paused ? '❚❚' : '▶';
  els.playerLike.classList.toggle('liked', !!t && store.isLiked(t.id));
  els.playerLike.textContent = t && store.isLiked(t.id) ? '♥' : '♡';
  if (t?.artwork) els.playerCover.innerHTML = `<img src="${escapeHtml(t.artwork)}" alt="${escapeHtml(t.title)} artwork"/>`;
  else els.playerCover.innerHTML = '<span>A</span>';
}

function showView(view) {
  $$('.view').forEach(v=>v.classList.remove('active-view'));
  $(`#${view}View`)?.classList.add('active-view');
  $$('[data-view]').forEach(b=>b.classList.toggle('active',b.dataset.view===view));
  $('#contentScroll').scrollTop = 0;
}

function openQueue(open=true) { els.queueDrawer.classList.toggle('open',open); els.backdrop.classList.toggle('show',open); els.queueDrawer.setAttribute('aria-hidden', String(!open)); }

function toast(title, detail='') {
  const node=document.createElement('div'); node.className='toast'; node.innerHTML=`${escapeHtml(title)}${detail?`<small>${escapeHtml(detail)}</small>`:''}`; els.toastRegion.append(node); setTimeout(()=>node.remove(),3400);
}

function setLoading(target, count=5) { target.innerHTML = Array.from({length:count},()=>'<div class="skeleton"></div>').join(''); }

async function loadTrending() {
  setLoading(els.trending,5);
  try {
    const tracks = await audiusProvider.trending(24);
    if (!tracks.length) throw new Error('No tracks returned');
    state.trending = tracks;
    state.providerOnline = true;
    renderCards();
    state.discoverResults = tracks;
    renderDiscover();
  } catch (err) {
    state.providerOnline = false;
    state.trending = [...fallbackTracks];
    state.discoverResults = [...fallbackTracks];
    renderCards(); renderDiscover();
    toast('Demo catalog loaded','Live Audius data will appear when the provider is reachable.');
  }
}

let searchTimer;
async function doSearch(query) {
  const q=query.trim();
  if (!q) { showView('home'); return; }
  const token=++state.searchToken;
  showView('search');
  els.searchTitle.textContent = `“${q}”`;
  els.searchSubtitle.textContent = 'Searching the open catalog…';
  els.searchList.innerHTML = '<div class="empty-state"><strong>Searching…</strong>Looking across the active provider.</div>';
  try {
    const results=await audiusProvider.search(q,40);
    if(token!==state.searchToken)return;
    state.searchResults=results;
    els.searchSubtitle.textContent = `${results.length} result${results.length===1?'':'s'} from Audius.`;
    renderSearch();
  } catch {
    if(token!==state.searchToken)return;
    const local=fallbackTracks.filter(t=>`${t.title} ${t.artist} ${t.genre}`.toLowerCase().includes(q.toLowerCase()));
    state.searchResults=local;
    els.searchSubtitle.textContent = 'Live search is unavailable right now — showing local demo matches.';
    renderSearch();
  }
}

async function discover(query) {
  showView('discover');
  els.discoverTitle.textContent = `Exploring ${query}`;
  els.resultMeta.textContent = 'loading…';
  els.discover.innerHTML = '<div class="empty-state"><strong>Finding tracks…</strong>Building a fresh list.</div>';
  try {
    const tracks = await audiusProvider.search(query,35);
    state.discoverResults = tracks;
    els.resultMeta.textContent = `${tracks.length} tracks`;
    renderDiscover();
  } catch {
    state.discoverResults = fallbackTracks;
    els.resultMeta.textContent = 'demo catalog';
    renderDiscover(); toast('Live discovery unavailable','Showing the built-in demo catalog.');
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
$('#seeAllTrending').addEventListener('click',()=>{state.discoverResults=[...state.trending];els.discoverTitle.textContent='Trending this week';els.resultMeta.textContent=`${state.trending.length} tracks`;renderDiscover();showView('discover');});
$('#queueButton').addEventListener('click',()=>openQueue(true)); $('#mobileQueueButton').addEventListener('click',()=>openQueue(true)); $('#closeQueue').addEventListener('click',()=>openQueue(false)); els.backdrop.addEventListener('click',()=>openQueue(false));
$('#clearQueue').addEventListener('click',()=>{state.queue=[];state.queueIndex=-1;renderQueue();});
$('#newPlaylistButton').addEventListener('click',()=>toast('Playlists are next','The player, likes and history already work; account-backed playlists come with the database layer.'));
els.play.addEventListener('click',togglePlayback); els.next.addEventListener('click',()=>nextTrack(true)); els.prev.addEventListener('click',prevTrack); els.playerLike.addEventListener('click',()=>toggleLike());
els.shuffle.addEventListener('click',()=>{state.shuffle=!state.shuffle;els.shuffle.classList.toggle('active-control',state.shuffle);toast(state.shuffle?'Shuffle on':'Shuffle off');});
els.repeat.addEventListener('click',()=>{state.repeat=state.repeat==='off'?'all':state.repeat==='all'?'one':'off';els.repeat.classList.toggle('active-control',state.repeat!=='off');els.repeat.textContent=state.repeat==='one'?'↻¹':'↻';toast(`Repeat ${state.repeat}`);});
els.audio.addEventListener('play',()=>{updatePlayer();renderCards();}); els.audio.addEventListener('pause',()=>{updatePlayer();renderCards();});
els.audio.addEventListener('timeupdate',()=>{const d=els.audio.duration||state.current?.duration||0;const p=d?els.audio.currentTime/d*100:0;els.progress.value=p;els.currentTime.textContent=formatTime(els.audio.currentTime);els.duration.textContent=formatTime(d);});
els.audio.addEventListener('loadedmetadata',()=>els.duration.textContent=formatTime(els.audio.duration));
els.audio.addEventListener('ended',()=>{if(state.repeat==='one'){els.audio.currentTime=0;els.audio.play();}else nextTrack(false);});
els.audio.addEventListener('error',()=>{ if(state.current?.provider==='Audius') toast('That stream could not be played','The creator may have restricted API playback, or the provider may be temporarily unavailable.'); updatePlayer(); });
els.progress.addEventListener('input',()=>{if(els.audio.duration)els.audio.currentTime=Number(els.progress.value)/100*els.audio.duration;});
els.volume.addEventListener('input',()=>{els.audio.volume=Number(els.volume.value);store.setVolume(Number(els.volume.value));});
document.addEventListener('keydown',e=>{if(e.target.matches('input,textarea'))return;if(e.key===' '){e.preventDefault();togglePlayback();}if(e.key==='/'){e.preventDefault();els.search.focus();}if(e.key==='ArrowRight'&&e.altKey)nextTrack(true);if(e.key==='ArrowLeft'&&e.altKey)prevTrack();});
if('mediaSession'in navigator){navigator.mediaSession.setActionHandler?.('play',()=>els.audio.play());navigator.mediaSession.setActionHandler?.('pause',()=>els.audio.pause());navigator.mediaSession.setActionHandler?.('nexttrack',()=>nextTrack(true));navigator.mediaSession.setActionHandler?.('previoustrack',prevTrack);}
if('serviceWorker'in navigator){window.addEventListener('load',()=>navigator.serviceWorker.register('./sw.js').catch(()=>{}));}

els.audio.volume=store.volume;els.volume.value=store.volume;renderLibrary();renderCards();renderDiscover();renderQueue();loadTrending();
