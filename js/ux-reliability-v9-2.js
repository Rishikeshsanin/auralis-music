(() => {
  const VERSION = '9.2.1';
  const $ = (selector, root = document) => root.querySelector(selector);
  const $$ = (selector, root = document) => [...root.querySelectorAll(selector)];
  const ART_HOST_SELECTOR = '.cover-wrap,.row-cover,.queue-item-cover,.player-cover,.radio-logo,.v5-radio-logo,.v91-now-art';

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

  function repairImage(img) {
    if (!(img instanceof HTMLImageElement) || img.dataset.auralisArtRepaired === 'true') return;
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
    setTimeout(() => repairImage(event.target), 0);
  }, true);

  function enforceInactiveViewIsolation() {
    const radio = $('#radioView');
    if (!radio) return;
    radio.setAttribute('aria-hidden', radio.classList.contains('active-view') ? 'false' : 'true');
  }

  function restorePlaybackDockContract() {
    const dock = $('#fullPlaybackDockV91');
    if (!dock) return;
    dock.classList.remove('minimized-v92');
    dock.querySelector('#stopFullPlaybackV92')?.remove();
    const close = dock.querySelector('#closeFullPlaybackV91');
    if (close) {
      close.textContent = '×';
      close.title = 'Stop full playback';
      close.setAttribute('aria-label', 'Stop full playback');
    }
  }

  function start() {
    loadCss();
    restorePlaybackDockContract();
    scanBrokenArtwork();
    enforceInactiveViewIsolation();

    const observer = new MutationObserver(() => {
      restorePlaybackDockContract();
      scanBrokenArtwork();
      enforceInactiveViewIsolation();
    });
    observer.observe(document.body, { childList: true, subtree: true, attributes: true, attributeFilter: ['class', 'style'] });

    window.AuralisUXV92 = {
      version: VERSION,
      repairArtwork: scanBrokenArtwork
    };
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start, { once: true });
  else start();
})();