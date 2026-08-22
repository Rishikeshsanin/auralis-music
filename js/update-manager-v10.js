(() => {
  const VERSION = '10.0.0';
  const WORKER_VERSION = '18';
  const MIGRATION_KEY = 'auralis:update-migration:v10';
  const RELOAD_KEY = 'auralis:update-reload:v10';
  const UPDATE_INTERVAL = 30 * 60 * 1000;
  const LEGACY_CACHE_PREFIXES = ['auralis-shell-', 'auralis-runtime-'];

  let registration = null;
  let waitingWorker = null;
  let reloadArmed = false;
  let lastUpdateCheck = 0;
  let appStarted = false;

  function safeStorageGet(storage, key) {
    try { return storage.getItem(key); } catch { return null; }
  }

  function safeStorageSet(storage, key, value) {
    try { storage.setItem(key, value); } catch {}
  }

  function safeStorageRemove(storage, key) {
    try { storage.removeItem(key); } catch {}
  }

  function addStatusOverlay(message = 'Preparing the latest Auralis…') {
    let overlay = document.querySelector('#auralisUpdateOverlayV10');
    if (!overlay) {
      overlay = document.createElement('div');
      overlay.id = 'auralisUpdateOverlayV10';
      overlay.setAttribute('role', 'status');
      overlay.setAttribute('aria-live', 'polite');
      overlay.innerHTML = '<div><span class="auralis-update-spinner-v10"></span><strong>Auralis is upgrading safely</strong><p></p></div>';
      const style = document.createElement('style');
      style.id = 'auralisUpdateStyleV10';
      style.textContent = `
        #auralisUpdateOverlayV10{position:fixed;inset:0;z-index:2147483647;display:grid;place-items:center;background:#08090df2;color:#f7f7fb;font-family:Inter,system-ui,sans-serif;padding:24px}
        #auralisUpdateOverlayV10>div{width:min(430px,90vw);padding:28px;border:1px solid #ffffff1c;border-radius:24px;background:#12131be8;box-shadow:0 30px 80px #0008;text-align:center;backdrop-filter:blur(20px)}
        #auralisUpdateOverlayV10 strong{display:block;font-size:18px;margin:14px 0 8px}#auralisUpdateOverlayV10 p{margin:0;color:#a9aabb;line-height:1.5;font-size:14px}
        .auralis-update-spinner-v10{display:inline-block;width:28px;height:28px;border:3px solid #ffffff22;border-top-color:#9d7cff;border-radius:50%;animation:auralisUpdateSpinV10 .8s linear infinite}@keyframes auralisUpdateSpinV10{to{transform:rotate(360deg)}}
        .auralis-update-banner-v10{position:fixed;left:50%;bottom:96px;z-index:2147483600;transform:translateX(-50%);display:flex;align-items:center;gap:12px;width:min(560px,calc(100vw - 28px));padding:12px 14px;border:1px solid #ffffff1c;border-radius:16px;background:#11121af2;color:#f7f7fb;box-shadow:0 18px 50px #0008;backdrop-filter:blur(18px);font-family:Inter,system-ui,sans-serif}.auralis-update-banner-v10 span{flex:1;font-size:13px;color:#c7c8d4}.auralis-update-banner-v10 button{border:0;border-radius:10px;padding:9px 13px;background:#ece8ff;color:#181520;font-weight:800;cursor:pointer}
      `;
      document.head.append(style);
      document.body.append(overlay);
    }
    const copy = overlay.querySelector('p');
    if (copy) copy.textContent = message;
    return overlay;
  }

  function removeStatusOverlay() {
    document.querySelector('#auralisUpdateOverlayV10')?.remove();
  }

  function showUpdateBanner() {
    if (document.querySelector('#auralisUpdateBannerV10')) return;
    const banner = document.createElement('div');
    banner.id = 'auralisUpdateBannerV10';
    banner.className = 'auralis-update-banner-v10';
    banner.innerHTML = '<span>A newer Auralis runtime is ready. Your music and local library are safe.</span><button type="button">Refresh Auralis</button>';
    banner.querySelector('button')?.addEventListener('click', () => activateWaitingWorker(true));
    document.body.append(banner);
  }

  function hideUpdateBanner() {
    document.querySelector('#auralisUpdateBannerV10')?.remove();
  }

  function isPlaybackActive() {
    const audio = document.querySelector('#audio');
    const htmlAudioActive = Boolean(audio && !audio.paused && !audio.ended && audio.currentTime >= 0);
    const youtubeActive = Boolean(window.AuralisFullPlaybackV91?.state?.active);
    return htmlAudioActive || youtubeActive;
  }

  function queryControllerVersion(timeout = 450) {
    const controller = navigator.serviceWorker?.controller;
    if (!controller || typeof MessageChannel === 'undefined') return Promise.resolve(null);
    return new Promise(resolve => {
      const channel = new MessageChannel();
      let settled = false;
      const finish = value => {
        if (settled) return;
        settled = true;
        try { channel.port1.close(); channel.port2.close(); } catch {}
        resolve(value || null);
      };
      channel.port1.onmessage = event => finish(event.data?.version || null);
      try {
        controller.postMessage({ type: 'AURALIS_VERSION' }, [channel.port2]);
      } catch {
        finish(null);
        return;
      }
      setTimeout(() => finish(null), timeout);
    });
  }

  async function clearLegacyCaches() {
    if (!('caches' in window)) return;
    let keys = [];
    try { keys = await caches.keys(); } catch { return; }
    await Promise.allSettled(keys
      .filter(name => LEGACY_CACHE_PREFIXES.some(prefix => name.startsWith(prefix)))
      .map(name => caches.delete(name)));
  }

  async function unregisterCurrentOriginWorkers() {
    if (!('serviceWorker' in navigator)) return;
    let registrations = [];
    try { registrations = await navigator.serviceWorker.getRegistrations(); } catch { return; }
    await Promise.allSettled(registrations
      .filter(item => {
        try { return new URL(item.scope).origin === location.origin; } catch { return false; }
      })
      .map(item => item.unregister()));
  }

  async function migrateLegacyRuntime() {
    addStatusOverlay('Removing only old Auralis runtime caches. Your likes, playlists, history, profile and Aura preferences are not touched.');
    try {
      await unregisterCurrentOriginWorkers();
      await clearLegacyCaches();
      safeStorageSet(localStorage, MIGRATION_KEY, VERSION);
      const next = new URL(location.href);
      next.searchParams.set('auralis-upgraded', VERSION);
      location.replace(next.toString());
      return true;
    } catch (error) {
      const overlay = addStatusOverlay('The automatic upgrade could not finish. Reload the page once to retry — your local library remains untouched.');
      const strong = overlay.querySelector('strong');
      if (strong) strong.textContent = 'Auralis upgrade needs one retry';
      console.error('Auralis legacy runtime migration failed', error);
      return true;
    }
  }

  function loadClassicScript(src) {
    return new Promise((resolve, reject) => {
      if ([...document.scripts].some(script => script.src === new URL(src, location.href).href)) return resolve();
      const script = document.createElement('script');
      script.src = src;
      script.async = false;
      script.dataset.auralisReleaseAsset = VERSION;
      script.onload = resolve;
      script.onerror = () => reject(new Error(`Could not load ${src}`));
      document.body.append(script);
    });
  }

  async function startApplication() {
    if (appStarted) return;
    appStarted = true;
    removeStatusOverlay();
    try {
      await loadClassicScript(`./js/row-play-targets.js?v=${encodeURIComponent(VERSION)}`);
      await import(`./app-v3.js?v=${encodeURIComponent(VERSION)}`);
      document.documentElement.dataset.auralisRuntime = VERSION;
      window.dispatchEvent(new CustomEvent('auralis:runtime-ready', { detail: { version: VERSION } }));
    } catch (error) {
      appStarted = false;
      const overlay = addStatusOverlay('Auralis could not load the current runtime. Reloading once usually recovers from a partial network response.');
      const strong = overlay.querySelector('strong');
      if (strong) strong.textContent = 'Auralis runtime did not start';
      console.error('Auralis v10 runtime start failed', error);
    }
  }

  function armReload() {
    if (reloadArmed) return;
    reloadArmed = true;
    safeStorageSet(sessionStorage, RELOAD_KEY, 'armed');
  }

  function activateWaitingWorker(force = false) {
    if (!waitingWorker) return;
    if (!force && isPlaybackActive()) {
      showUpdateBanner();
      return;
    }
    hideUpdateBanner();
    armReload();
    try { waitingWorker.postMessage({ type: 'SKIP_WAITING' }); } catch {}
  }

  function handleWaitingWorker(worker) {
    if (!worker) return;
    waitingWorker = worker;
    if (isPlaybackActive()) showUpdateBanner();
    else activateWaitingWorker(false);
  }

  function watchRegistration(reg) {
    registration = reg;
    if (reg.waiting) handleWaitingWorker(reg.waiting);
    reg.addEventListener('updatefound', () => {
      const installing = reg.installing;
      if (!installing) return;
      installing.addEventListener('statechange', () => {
        if (installing.state === 'installed' && navigator.serviceWorker.controller) {
          handleWaitingWorker(installing);
        }
      });
    });
  }

  async function registerSafeWorker() {
    if (!('serviceWorker' in navigator)) return;
    try {
      const reg = await navigator.serviceWorker.register('./sw.js', { updateViaCache: 'none' });
      watchRegistration(reg);
      lastUpdateCheck = Date.now();
      reg.update().catch(() => {});
    } catch (error) {
      console.warn('Auralis service worker registration failed; online mode remains available.', error);
    }
  }

  async function checkForUpdate() {
    if (!registration || Date.now() - lastUpdateCheck < UPDATE_INTERVAL) return;
    lastUpdateCheck = Date.now();
    try { await registration.update(); } catch {}
  }

  function bindUpdateLifecycle() {
    if (!('serviceWorker' in navigator)) return;
    navigator.serviceWorker.addEventListener('controllerchange', () => {
      if (!reloadArmed && safeStorageGet(sessionStorage, RELOAD_KEY) !== 'armed') return;
      safeStorageRemove(sessionStorage, RELOAD_KEY);
      location.reload();
    });
    document.addEventListener('visibilitychange', () => {
      if (!document.hidden) checkForUpdate();
    });
    window.addEventListener('online', checkForUpdate);
    document.addEventListener('pause', () => waitingWorker && activateWaitingWorker(false), true);
    document.addEventListener('ended', () => waitingWorker && activateWaitingWorker(false), true);
  }

  async function boot() {
    bindUpdateLifecycle();

    if ('serviceWorker' in navigator && navigator.serviceWorker.controller) {
      const controllerVersion = await queryControllerVersion();
      if (controllerVersion !== WORKER_VERSION) {
        await migrateLegacyRuntime();
        return;
      }
      safeStorageSet(localStorage, MIGRATION_KEY, VERSION);
    }

    await startApplication();

    if (document.readyState === 'complete') registerSafeWorker();
    else window.addEventListener('load', registerSafeWorker, { once: true });
  }

  window.AuralisUpdateManagerV10 = {
    version: VERSION,
    workerVersion: WORKER_VERSION,
    checkForUpdate,
    activateUpdate: () => activateWaitingWorker(true)
  };

  boot().catch(error => {
    console.error('Auralis update manager failed', error);
    startApplication();
  });
})();
