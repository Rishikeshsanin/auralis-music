(() => {
  const HLS_SRC = 'https://cdn.jsdelivr.net/npm/hls.js@1/dist/hls.min.js';
  const clean = value => String(value || '').replace(/\s+/g, ' ').trim();
  const key = value => clean(value).toLowerCase().replace(/\([^)]*(?:mp3|aac|ogg|opus|\d+\s*k(?:bps)?)[^)]*\)/gi, ' ').replace(/\b(?:hd|hq|opus|mp3|aac\+?|ogg|stream|\d+\s*k(?:bps)?)\b/gi, ' ').replace(/[^a-z0-9\p{L}]+/gu, ' ').replace(/\s+/g, ' ').trim();
  const escapeHtml = (value = '') => String(value).replace(/[&<>'"]/g, c => ({ '&':'&amp;', '<':'&lt;', '>':'&gt;', "'":'&#039;', '"':'&quot;' }[c]));

  function notify(title, detail = '') {
    const region = document.querySelector('#toastRegion');
    if (!region) return;
    const node = document.createElement('div');
    node.className = 'toast';
    node.innerHTML = `${escapeHtml(title)}${detail ? `<small>${escapeHtml(detail)}</small>` : ''}`;
    region.append(node);
    setTimeout(() => node.remove(), 3800);
  }

  let hlsLibraryPromise = null;
  function loadHlsLibrary() {
    if (window.Hls) return Promise.resolve(window.Hls);
    if (hlsLibraryPromise) return hlsLibraryPromise;
    hlsLibraryPromise = new Promise((resolve, reject) => {
      const script = document.createElement('script');
      script.src = HLS_SRC;
      script.async = true;
      script.crossOrigin = 'anonymous';
      script.dataset.auralisHls = 'true';
      script.onload = () => window.Hls ? resolve(window.Hls) : reject(new Error('HLS engine unavailable'));
      script.onerror = () => reject(new Error('Could not load HLS engine'));
      document.head.append(script);
    });
    return hlsLibraryPromise;
  }

  function installHlsBridge() {
    const audio = document.querySelector('#audio');
    if (!audio || audio.dataset.auralisHlsBridge === 'true') return;
    const descriptor = Object.getOwnPropertyDescriptor(HTMLMediaElement.prototype, 'src');
    if (!descriptor?.get || !descriptor?.set) return;

    audio.dataset.auralisHlsBridge = 'true';
    const nativePlay = audio.play.bind(audio);
    const nativeRemoveAttribute = audio.removeAttribute.bind(audio);
    let hls = null;
    let pending = null;
    let internalMutation = false;
    let fatalForwarded = false;

    const isHls = value => {
      const source = String(value || '');
      return /\.m3u8(?:$|[?#])/i.test(source) || /#auralis-hls$/i.test(source);
    };
    const cleanHlsUrl = value => String(value || '').replace(/#auralis-hls$/i, '');

    function destroyHls() {
      pending = null;
      fatalForwarded = false;
      if (!hls) return;
      internalMutation = true;
      try { hls.destroy(); } catch {}
      internalMutation = false;
      hls = null;
    }

    function attachHls(url) {
      const sourceUrl = cleanHlsUrl(url);
      pending = loadHlsLibrary().then(Hls => {
        if (!Hls?.isSupported?.()) {
          descriptor.set.call(audio, sourceUrl);
          return;
        }
        return new Promise((resolve, reject) => {
          let ready = false;
          let networkRecoveries = 0;
          let mediaRecoveries = 0;
          hls = new Hls({
            enableWorker: true,
            lowLatencyMode: true,
            backBufferLength: 10,
            maxBufferLength: 30,
            manifestLoadingTimeOut: 7000,
            fragLoadingTimeOut: 9000
          });
          hls.on(Hls.Events.MEDIA_ATTACHED, () => hls?.loadSource(sourceUrl));
          hls.on(Hls.Events.MANIFEST_PARSED, () => {
            ready = true;
            audio.dataset.radioStreamEngine = 'hls.js';
            resolve();
          });
          hls.on(Hls.Events.ERROR, (_event, data) => {
            if (!data?.fatal) return;
            if (data.type === Hls.ErrorTypes.NETWORK_ERROR && networkRecoveries < 1) {
              networkRecoveries += 1;
              try { hls.startLoad(); return; } catch {}
            }
            if (data.type === Hls.ErrorTypes.MEDIA_ERROR && mediaRecoveries < 1) {
              mediaRecoveries += 1;
              try { hls.recoverMediaError(); return; } catch {}
            }
            const error = new Error(`HLS playback failed: ${data.details || data.type || 'unknown error'}`);
            if (!ready) reject(error);
            else if (!fatalForwarded) {
              fatalForwarded = true;
              audio.dispatchEvent(new Event('error'));
            }
          });
          internalMutation = true;
          hls.attachMedia(audio);
          internalMutation = false;
        });
      });
      return pending;
    }

    Object.defineProperty(audio, 'src', {
      configurable: true,
      enumerable: descriptor.enumerable,
      get() { return descriptor.get.call(audio); },
      set(value) {
        const url = String(value || '');
        if (internalMutation || (hls && url.startsWith('blob:'))) {
          descriptor.set.call(audio, url);
          return;
        }
        destroyHls();
        delete audio.dataset.radioStreamEngine;
        if (isHls(url)) {
          audio.dataset.radioStreamEngine = 'hls-pending';
          attachHls(url).catch(() => {});
          return;
        }
        descriptor.set.call(audio, url);
      }
    });

    audio.removeAttribute = function(name) {
      if (String(name).toLowerCase() === 'src') destroyHls();
      return nativeRemoveAttribute(name);
    };

    audio.play = function(...args) {
      if (!pending) return nativePlay(...args);
      return pending.then(() => nativePlay(...args));
    };

    loadHlsLibrary().catch(() => {
      // Direct MP3/AAC/OGG radio remains fully functional if the optional HLS engine cannot load.
    });
  }

  async function radioRequest(params = {}) {
    const url = new URL('/api/radio', window.location.origin);
    Object.entries(params).forEach(([name, value]) => {
      if (value !== undefined && value !== null && value !== '') url.searchParams.set(name, String(value));
    });
    const response = await fetch(url, { headers: { Accept: 'application/json' } });
    if (!response.ok) throw new Error(`Radio API ${response.status}`);
    return response.json();
  }

  function initials(name = '') {
    const parts = clean(name).replace(/[^\p{L}\p{N} ]/gu, ' ').split(' ').filter(Boolean);
    return (parts.slice(0, 2).map(part => part[0]).join('') || '♪').toLocaleUpperCase();
  }

  function stationCard(station, index) {
    const type = station.auralis_stream_type === 'hls' ? 'HLS' : (station.codec || 'audio');
    const detail = [station.country, type, station.bitrate ? `${station.bitrate}kbps` : '', station.auralis_verified ? 'verified now' : ''].filter(Boolean).join(' · ');
    const favicon = clean(station.favicon);
    return `<article class="radio-card radio-card-v6" data-pinned-radio="${index}">
      <div class="radio-logo ${favicon ? '' : 'logo-fallback'}">
        ${favicon ? `<img src="${escapeHtml(favicon)}" alt="" loading="lazy" referrerpolicy="no-referrer" onerror="this.remove();this.parentElement.classList.add('logo-fallback');this.parentElement.querySelector('.v6-fallback').hidden=false"/>` : ''}
        <span class="radio-fallback-mark v6-fallback" ${favicon ? 'hidden' : ''}>${escapeHtml(initials(station.name))}</span><i></i>
      </div>
      <div class="radio-copy"><span class="live-label">LIVE · CHECKED</span><strong>${escapeHtml(station.name || 'Live radio')}</strong><small>${escapeHtml(detail)}</small></div>
      <button class="radio-play" data-pinned-play="${index}" aria-label="Tune ${escapeHtml(station.name || 'station')}">▶</button>
    </article>`;
  }

  function skeleton(count = 9) {
    return Array.from({ length: count }, () => `<div class="auralis-skeleton-card"><span class="auralis-skeleton-block media"></span><span class="auralis-skeleton-copy"><i></i><i></i><i></i></span></div>`).join('');
  }

  function waitForRadioLayout(timeout = 5000) {
    return new Promise(resolve => {
      const started = Date.now();
      const check = () => {
        const popular = document.querySelector('#radioPopularBlockV5');
        const grid = document.querySelector('#radioGrid');
        const heading = document.querySelector('#radioTitle')?.closest('.section-heading');
        const load = document.querySelector('#radioMoreButton')?.closest('.load-more-wrap');
        if (popular && grid && heading && load) return resolve({ popular, grid, heading, load });
        if (Date.now() - started > timeout) return resolve(null);
        setTimeout(check, 60);
      };
      check();
    });
  }

  async function tuneThroughAuralis(station, button) {
    const input = document.querySelector('#radioSearchInput');
    const search = document.querySelector('#radioSearchButton');
    const grid = document.querySelector('#radioGrid');
    const title = document.querySelector('#radioTitle');
    if (!input || !search || !grid || !title) return;

    button?.classList.add('auralis-button-loading');
    input.value = station.name || '';
    input.dispatchEvent(new Event('input', { bubbles: true }));
    search.click();

    const wanted = key(station.name);
    const started = Date.now();
    const timer = setInterval(() => {
      const cards = [...grid.querySelectorAll('.radio-card')];
      const loaded = !/^Popular/i.test(clean(title.textContent)) && cards.length > 0;
      if (loaded) {
        clearInterval(timer);
        button?.classList.remove('auralis-button-loading');
        const exact = cards.find(card => key(card.querySelector('strong')?.textContent) === wanted)
          || cards.find(card => key(card.querySelector('strong')?.textContent).includes(wanted) || wanted.includes(key(card.querySelector('strong')?.textContent)))
          || cards[0];
        exact?.querySelector('.radio-play')?.click();
        exact?.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
      } else if (Date.now() - started > 10000) {
        clearInterval(timer);
        button?.classList.remove('auralis-button-loading');
        notify('Station could not be verified', 'Auralis kept the Popular shelf intact. Try another station.');
      }
    }, 120);
  }

  async function setupPinnedPopular() {
    const layout = await waitForRadioLayout();
    if (!layout || document.querySelector('#radioActiveBlockV6')) return;
    const { popular, grid, heading, load } = layout;

    const active = document.createElement('section');
    active.id = 'radioActiveBlockV6';
    active.className = 'radio-active-v6';
    active.hidden = true;
    popular.before(active);
    active.append(heading, grid, load);

    popular.innerHTML = `
      <div class="section-heading compact-heading v6-popular-heading">
        <div><p class="eyebrow">PINNED · ALWAYS HERE</p><h2>Popular worldwide right now</h2></div>
        <span id="radioPopularMetaV6">Checking stations…</span>
      </div>
      <div class="radio-grid auralis-loading-grid" id="radioPopularGridV6">${skeleton(9)}</div>`;

    const popularGrid = popular.querySelector('#radioPopularGridV6');
    const popularMeta = popular.querySelector('#radioPopularMetaV6');

    const syncActiveVisibility = () => {
      const titleText = clean(document.querySelector('#radioTitle')?.textContent);
      const hasCards = Boolean(grid.querySelector('.radio-card'));
      active.hidden = !hasCards || /^Popular/i.test(titleText);
    };
    new MutationObserver(syncActiveVisibility).observe(heading, { childList: true, subtree: true, characterData: true });
    new MutationObserver(syncActiveVisibility).observe(grid, { childList: true, subtree: false });
    syncActiveVisibility();

    try {
      const json = await radioRequest({ mode: 'top', limit: 18, offset: 0 });
      const stations = Array.isArray(json.stations) ? json.stations : [];
      popularGrid.classList.remove('auralis-loading-grid');
      popularGrid.innerHTML = stations.length
        ? stations.map(stationCard).join('')
        : '<div class="empty-state"><strong>Popular radio is refreshing</strong>Try again in a moment.</div>';
      popularMeta.textContent = `${stations.length} verified music station${stations.length === 1 ? '' : 's'}`;
      popularGrid.querySelectorAll('[data-pinned-play]').forEach(button => button.addEventListener('click', () => {
        const station = stations[Number(button.dataset.pinnedPlay)];
        if (station) tuneThroughAuralis(station, button);
      }));
    } catch {
      popularGrid.classList.remove('auralis-loading-grid');
      popularGrid.innerHTML = '<div class="empty-state"><strong>Popular radio is reconnecting</strong>The live directory is temporarily unavailable.</div>';
      popularMeta.textContent = 'reconnecting';
    }
  }

  function init() {
    installHlsBridge();
    setupPinnedPopular();
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', () => setTimeout(init, 0));
  else setTimeout(init, 0);
})();