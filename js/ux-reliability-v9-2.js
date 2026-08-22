(() => {
  const VERSION = '9.2';
  const PANEL_KEY = 'auralis:full-playback-panel:v92';
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

  function panelMode() {
    try { return localStorage.getItem(PANEL_KEY) === 'expanded' ? 'expanded' : 'compact'; }
    catch { return 'compact'; }
  }

  function savePanelMode(mode) {
    try { localStorage.setItem(PANEL_KEY, mode); } catch {}
  }

  function applyPanelMode(mode = panelMode(), persist = false) {
    const dock = $('#fullPlaybackDockV91');
    if (!dock) return;
    const compact = mode !== 'expanded';
    dock.classList.toggle('minimized-v92', compact);
    const toggle = $('#closeFullPlaybackV91', dock);
    if (toggle) {
      toggle.textContent = compact ? '↗' : '–';
      toggle.title = compact ? 'Expand full playback' : 'Minimize full playback';
      toggle.setAttribute('aria-label', toggle.title);
    }
    if (persist) savePanelMode(compact ? 'compact' : 'expanded');
  }

  function stopFullPlayback() {
    window.AuralisFullPlaybackV91?.stop?.();
    const dock = $('#fullPlaybackDockV91');
    dock?.classList.remove('minimized-v92');
  }

  function wirePlaybackDock() {
    const dock = $('#fullPlaybackDockV91');
    const head = $('.v91-dock-head', dock || document);
    const toggle = $('#closeFullPlaybackV91', dock || document);
    if (!dock || !head || !toggle) return;

    if (!head.querySelector('.v92-dock-actions')) {
      const actions = document.createElement('div');
      actions.className = 'v92-dock-actions';
      head.append(actions);
      actions.append(toggle);
      const stop = document.createElement('button');
      stop.id = 'stopFullPlaybackV92';
      stop.type = 'button';
      stop.textContent = '×';
      stop.title = 'Stop full playback';
      stop.setAttribute('aria-label', stop.title);
      actions.append(stop);
    }

    if (dock.dataset.v92Observed !== 'true') {
      dock.dataset.v92Observed = 'true';
      const observer = new MutationObserver(() => {
        if (dock.classList.contains('open')) applyPanelMode(panelMode(), false);
      });
      observer.observe(dock, { attributes: true, attributeFilter: ['class'] });
    }

    if (dock.classList.contains('open')) applyPanelMode(panelMode(), false);
  }

  document.addEventListener('click', event => {
    const toggle = event.target.closest?.('#closeFullPlaybackV91');
    if (toggle) {
      event.preventDefault();
      event.stopImmediatePropagation();
      const dock = $('#fullPlaybackDockV91');
      const next = dock?.classList.contains('minimized-v92') ? 'expanded' : 'compact';
      applyPanelMode(next, true);
      return;
    }

    if (event.target.closest?.('#stopFullPlaybackV92')) {
      event.preventDefault();
      event.stopImmediatePropagation();
      stopFullPlayback();
    }
  }, true);

  function enforceInactiveViewIsolation() {
    const radio = $('#radioView');
    if (!radio) return;
    radio.setAttribute('aria-hidden', radio.classList.contains('active-view') ? 'false' : 'true');
  }

  function start() {
    loadCss();
    wirePlaybackDock();
    scanBrokenArtwork();
    enforceInactiveViewIsolation();

    const observer = new MutationObserver(() => {
      wirePlaybackDock();
      scanBrokenArtwork();
      enforceInactiveViewIsolation();
    });
    observer.observe(document.body, { childList: true, subtree: true, attributes: true, attributeFilter: ['class', 'style'] });

    window.AuralisUXV92 = {
      version: VERSION,
      repairArtwork: scanBrokenArtwork,
      setFullPlaybackPanel: mode => applyPanelMode(mode === 'expanded' ? 'expanded' : 'compact', true)
    };
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start, { once: true });
  else start();
})();