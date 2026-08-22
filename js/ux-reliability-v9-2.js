(() => {
  const VERSION = '9.2.2';
  const $ = (selector, root = document) => root.querySelector(selector);
  const $$ = (selector, root = document) => [...root.querySelectorAll(selector)];
  const ART_HOST_SELECTOR = '.cover-wrap,.row-cover,.queue-item-cover,.player-cover,.radio-logo,.v5-radio-logo,.v91-now-art';
  const ART_OWNER_SELECTOR = '.music-card,.track-row,.queue-item,.player,.v91-playback-dock';
  const ART_SIZES = ['1000x1000', '480x480', '150x150'];
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
    img.dataset.auralisArtRepaired = 'false';
    img.style.display = '';
    img.src = src.replace(match[1], nextSize);
    return true;
  }

  function repairImage(img) {
    if (!(img instanceof HTMLImageElement) || img.dataset.auralisArtRepaired === 'true') return;
    if (!img.complete) return;
    if (img.naturalWidth && img.style.display !== 'none') return;
    if (tryAlternateArtwork(img)) return;

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

  function scanBrokenArtwork(root = document) {
    $$(`${ART_HOST_SELECTOR} img`, root).forEach(img => {
      if (img.complete && (!img.naturalWidth || img.style.display === 'none')) repairImage(img);
    });
  }

  window.addEventListener('error', event => {
    if (!(event.target instanceof HTMLImageElement)) return;
    if (tryAlternateArtwork(event.target)) return;
    setTimeout(() => repairImage(event.target), 0);
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
      runMaintenance
    };
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start, { once: true });
  else start();
})();
