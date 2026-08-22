(() => {
  const VERSION = '9.2.2';
  const $ = (selector, root = document) => root.querySelector(selector);
  const $$ = (selector, root = document) => [...root.querySelectorAll(selector)];
  const ART_HOST_SELECTOR = '.cover-wrap,.row-cover,.queue-item-cover,.player-cover,.radio-logo,.v5-radio-logo,.v91-now-art';
  const ART_OWNER_SELECTOR = '.music-card,.track-row,.queue-item,.player,.v91-playback-dock';
  const ART_SIZES = ['1000x1000', '480x480', '150x150'];
  const canonicalArtworkCache = new Map();
  let maintenanceQueued = false;

  function loadCss() {
    if ($('#auralisV92Css')) return;
    const link = document.createElement('link');
    link.id = 'auralisV92Css';
    link.rel = 'stylesheet';
    link.href = './experience-v9-2.css';
    document.head.append(link);
  }

  function clean(value = '') {
    return String(value || '').replace(/\s+/g, ' ').trim();
  }

  function identityText(value = '') {
    return clean(value)
      .toLocaleLowerCase()
      .normalize('NFKD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/[^a-z0-9]+/g, ' ')
      .trim();
  }

  function fallbackLabel(host) {
    const owner = host.closest('.music-card,.track-row,.queue-item,.radio-card,.v5-language-station,.player,.v91-playback-dock');
    const title = clean(
      owner?.querySelector('h3')?.textContent ||
      owner?.querySelector('strong')?.textContent ||
      (host.classList.contains('player-cover') ? $('#playerTitle')?.textContent : '') ||
      (host.classList.contains('v91-now-art') ? $('#fullPlaybackTitleV91')?.textContent : '')
    );
    const words = title.replace(/[^\p{L}\p{N} ]/gu, ' ').split(' ').filter(Boolean);
    if (!words.length) return '♪';
    return words.slice(0, 2).map(word => word[0]).join('').toLocaleUpperCase();
  }

  function artworkIdentity(img) {
    const owner = img.closest(ART_OWNER_SELECTOR);
    if (!owner) return { title: '', artist: '' };

    if (owner.classList.contains('music-card')) {
      return {
        title: clean(owner.querySelector('h3')?.textContent),
        artist: clean(owner.querySelector('p')?.textContent)
      };
    }

    if (owner.classList.contains('track-row')) {
      return {
        title: clean(owner.querySelector('.row-title-copy strong')?.textContent || owner.querySelector('strong')?.textContent),
        artist: clean(owner.querySelector('.row-title-copy span')?.textContent)
      };
    }

    if (owner.classList.contains('queue-item')) {
      return {
        title: clean(owner.querySelector('.queue-item-copy strong')?.textContent || owner.querySelector('strong')?.textContent),
        artist: clean((owner.querySelector('.queue-item-copy span')?.textContent || '').split(' · ')[0])
      };
    }

    if (owner.classList.contains('player')) {
      return { title: clean($('#playerTitle')?.textContent), artist: clean($('#playerArtist')?.textContent) };
    }

    return {
      title: clean($('#fullPlaybackTitleV91')?.textContent || owner.querySelector('strong')?.textContent),
      artist: clean($('#fullPlaybackArtistV91')?.textContent || owner.querySelector('small')?.textContent)
    };
  }

  function scoreArtworkCandidate(item, identity) {
    const title = identityText(item?.title);
    const artist = identityText(item?.artist);
    const wantedTitle = identityText(identity.title);
    const wantedArtist = identityText(identity.artist);
    if (!title || !wantedTitle || title !== wantedTitle) return 0;

    let score = 20;
    if (artist && wantedArtist && artist === wantedArtist) score += 14;
    else if (artist && wantedArtist && (artist.includes(wantedArtist) || wantedArtist.includes(artist))) score += 7;
    if (item?.artwork) score += 2;
    if (item?.artworkFallback) score += 1;
    return score;
  }

  function candidateArtwork(item) {
    return clean(item?.artwork || item?.artworkFallback || '');
  }

  async function canonicalArtworkFor(identity) {
    const title = clean(identity.title);
    const artist = clean(identity.artist);
    if (!title || !artist) return '';
    const key = `${identityText(title)}::${identityText(artist)}`;
    if (canonicalArtworkCache.has(key)) return canonicalArtworkCache.get(key);

    const request = (async () => {
      try {
        const endpoint = new URL('./api/catalog', window.location.href);
        endpoint.searchParams.set('mode', 'search');
        endpoint.searchParams.set('kind', 'track');
        endpoint.searchParams.set('q', `${title} ${artist}`);
        endpoint.searchParams.set('limit', '8');
        const response = await fetch(endpoint, { headers: { Accept: 'application/json' } });
        if (!response.ok) return '';
        const json = await response.json();
        const ranked = (Array.isArray(json?.items) ? json.items : [])
          .map(item => ({ item, score: scoreArtworkCandidate(item, { title, artist }) }))
          .filter(entry => entry.score >= 27 && candidateArtwork(entry.item))
          .sort((a, b) => b.score - a.score);
        return ranked.length ? candidateArtwork(ranked[0].item) : '';
      } catch {
        return '';
      }
    })();

    canonicalArtworkCache.set(key, request);
    return request;
  }

  function prepareImageRetry(img) {
    img.onerror = null;
    img.removeAttribute('onerror');
    img.style.display = '';
    img.dataset.auralisArtRepaired = 'false';
    const host = img.closest(ART_HOST_SELECTOR);
    host?.classList.remove('image-failed', 'auralis-art-failed-v92');
    host?.querySelector(':scope > .auralis-art-fallback-v92')?.remove();
  }

  function isAudiusArtwork(img, src = '') {
    const ownerText = clean(img.closest(ART_OWNER_SELECTOR)?.textContent || '');
    return /\bAudius\b/i.test(ownerText) || /audius|creatornode|discoveryprovider/i.test(src);
  }

  function tryAlternateArtwork(img) {
    if (!(img instanceof HTMLImageElement)) return false;
    const src = clean(img.currentSrc || img.src || '');
    if (!src || !isAudiusArtwork(img, src)) return false;

    const match = src.match(/(1000x1000|480x480|150x150)/i);
    if (!match) return false;

    const currentSize = match[1].toLowerCase();
    const tried = new Set((img.dataset.auralisArtSizes || '').split(',').filter(Boolean));
    tried.add(currentSize);
    const nextSize = ART_SIZES.find(size => !tried.has(size));
    if (!nextSize) return false;

    tried.add(nextSize);
    img.dataset.auralisArtSizes = [...tried].join(',');
    prepareImageRetry(img);
    img.src = src.replace(match[1], nextSize);
    return true;
  }

  async function tryCanonicalArtwork(img) {
    if (!(img instanceof HTMLImageElement)) return false;
    if (img.dataset.auralisCanonicalPending === 'true') return true;
    if (img.dataset.auralisCanonicalTried === 'true') return false;

    const identity = artworkIdentity(img);
    if (!identity.title || !identity.artist) {
      img.dataset.auralisCanonicalTried = 'true';
      return false;
    }

    img.dataset.auralisCanonicalPending = 'true';
    const artwork = await canonicalArtworkFor(identity);
    img.dataset.auralisCanonicalPending = 'false';
    img.dataset.auralisCanonicalTried = 'true';
    if (!artwork || !img.isConnected || artwork === clean(img.currentSrc || img.src || '')) return false;

    prepareImageRetry(img);
    img.src = artwork;
    return true;
  }

  function repairImage(img) {
    if (!(img instanceof HTMLImageElement) || img.dataset.auralisArtRepaired === 'true') return;
    if (!img.complete) return;
    if (img.naturalWidth && img.style.display !== 'none') return;

    const host = img.closest(ART_HOST_SELECTOR);
    if (!host) return;
    img.dataset.auralisArtRepaired = 'true';
    host.classList.add('auralis-art-host-v92', 'auralis-art-failed-v92');
    if (!host.querySelector(':scope > .auralis-art-fallback-v92')) {
      const fallback = document.createElement('span');
      fallback.className = 'auralis-art-fallback-v92';
      fallback.textContent = fallbackLabel(host);
      fallback.setAttribute('aria-hidden', 'true');
      host.prepend(fallback);
    }
    img.remove();
  }

  async function recoverArtwork(img) {
    if (!(img instanceof HTMLImageElement)) return;
    if (img.complete && img.naturalWidth && img.style.display !== 'none') return;
    if (tryAlternateArtwork(img)) return;
    if (await tryCanonicalArtwork(img)) return;
    repairImage(img);
  }

  function scanBrokenArtwork(root = document) {
    $$(`${ART_HOST_SELECTOR} img`, root).forEach(img => {
      if (img.complete && (!img.naturalWidth || img.style.display === 'none')) void recoverArtwork(img);
    });
  }

  window.addEventListener('error', event => {
    if (!(event.target instanceof HTMLImageElement)) return;
    // The original card markup has a legacy inline onerror that hides the image.
    // Remove it during capture so a successful alternate/canonical retry remains visible.
    event.target.onerror = null;
    event.target.removeAttribute('onerror');
    void recoverArtwork(event.target);
  }, true);

  function enforceInactiveViewIsolation() {
    const radio = $('#radioView');
    if (!radio) return;
    const next = radio.classList.contains('active-view') ? 'false' : 'true';
    if (radio.getAttribute('aria-hidden') !== next) radio.setAttribute('aria-hidden', next);
  }

  function restorePlaybackDockContract() {
    const dock = $('#fullPlaybackDockV91');
    if (!dock) return;

    // Important: every mutation below is guarded. The v9.2.1 implementation
    // rewrote text/attributes on every MutationObserver callback, which could
    // recursively trigger the observer and freeze the page.
    if (dock.classList.contains('minimized-v92')) dock.classList.remove('minimized-v92');

    const legacyStop = dock.querySelector('#stopFullPlaybackV92');
    if (legacyStop) legacyStop.remove();

    const close = dock.querySelector('#closeFullPlaybackV91');
    if (!close) return;
    if (close.textContent !== '×') close.textContent = '×';
    if (close.title !== 'Stop full playback') close.title = 'Stop full playback';
    if (close.getAttribute('aria-label') !== 'Stop full playback') {
      close.setAttribute('aria-label', 'Stop full playback');
    }
  }

  function runMaintenance() {
    maintenanceQueued = false;
    restorePlaybackDockContract();
    scanBrokenArtwork();
    enforceInactiveViewIsolation();
  }

  function queueMaintenance() {
    if (maintenanceQueued) return;
    maintenanceQueued = true;
    requestAnimationFrame(runMaintenance);
  }

  function start() {
    loadCss();
    runMaintenance();

    const observer = new MutationObserver(queueMaintenance);
    observer.observe(document.body, {
      childList: true,
      subtree: true,
      attributes: true,
      attributeFilter: ['class']
    });

    window.AuralisUXV92 = {
      version: VERSION,
      repairArtwork: scanBrokenArtwork,
      tryAlternateArtwork,
      tryCanonicalArtwork,
      runMaintenance
    };
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start, { once: true });
  else start();
})();
