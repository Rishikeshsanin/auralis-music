(() => {
  const PREF_KEY = 'auralis:experience-v7';
  const DEFAULTS = { auraEnabled: false, controlsVisible: true, timeoutMinutes: 10 };
  const $ = (selector, root = document) => root.querySelector(selector);
  const $$ = (selector, root = document) => [...root.querySelectorAll(selector)];
  const clean = value => String(value || '').replace(/\s+/g, ' ').trim();
  const escapeHtml = (value = '') => String(value).replace(/[&<>'"]/g, char => ({ '&':'&amp;', '<':'&lt;', '>':'&gt;', "'":'&#039;', '"':'&quot;' }[char]));

  let prefs = loadPrefs();
  let auraTimer = null;
  let colorRun = 0;
  let tuningStartedAt = 0;
  let konkaniBusy = false;

  function loadPrefs() {
    try {
      const saved = JSON.parse(localStorage.getItem(PREF_KEY) || '{}');
      return { ...DEFAULTS, ...saved };
    } catch {
      return { ...DEFAULTS };
    }
  }

  function savePrefs(next = prefs) {
    prefs = { ...prefs, ...next };
    try { localStorage.setItem(PREF_KEY, JSON.stringify(prefs)); } catch {}
    syncAuraControls();
    syncProfileSettings();
  }

  function notify(title, detail = '') {
    const region = $('#toastRegion');
    if (!region) return;
    const node = document.createElement('div');
    node.className = 'toast';
    node.innerHTML = `${escapeHtml(title)}${detail ? `<small>${escapeHtml(detail)}</small>` : ''}`;
    region.append(node);
    setTimeout(() => node.remove(), 3600);
  }

  function ensureAuraControls() {
    const topActions = $('.top-actions');
    const livePill = $('.catalog-live-pill');
    if (topActions && livePill && !$('#auraTopToggle')) {
      const button = auraButton('auraTopToggle', 'top');
      topActions.insertBefore(button, livePill);
    }

    const extras = $('.player-extras');
    const queue = $('#mobileQueueButton');
    if (extras && queue && !$('#auraPlayerToggle')) {
      const button = auraButton('auraPlayerToggle', 'player');
      extras.insertBefore(button, queue);
    }
    syncAuraControls();
  }

  function auraButton(id, placement) {
    const button = document.createElement('button');
    button.id = id;
    button.type = 'button';
    button.className = `aura-toggle aura-toggle-${placement}`;
    button.setAttribute('aria-label', 'Toggle Aura Mode');
    button.setAttribute('aria-pressed', 'false');
    button.innerHTML = '<span class="aura-toggle-core" aria-hidden="true"><i></i><b></b></span><span class="aura-tooltip" role="tooltip">Aura Mode</span>';
    button.addEventListener('click', () => setAuraEnabled(!prefs.auraEnabled, true));
    return button;
  }

  function syncAuraControls() {
    $$('.aura-toggle').forEach(button => {
      button.classList.toggle('active', Boolean(prefs.auraEnabled));
      button.classList.toggle('aura-control-hidden', !prefs.controlsVisible);
      button.setAttribute('aria-pressed', String(Boolean(prefs.auraEnabled)));
    });
    document.documentElement.classList.toggle('aura-mode-on', Boolean(prefs.auraEnabled));
  }

  function clearAuraTimer() {
    if (auraTimer) clearTimeout(auraTimer);
    auraTimer = null;
  }

  function armAuraTimer() {
    clearAuraTimer();
    const minutes = Number(prefs.timeoutMinutes || 0);
    if (!prefs.auraEnabled || !minutes) return;
    auraTimer = setTimeout(() => {
      setAuraEnabled(false, false);
      notify('Aura Mode rested', `It switched off after ${minutes} minutes. Change the timer in your profile anytime.`);
    }, minutes * 60 * 1000);
  }

  function setAuraEnabled(enabled, announce = false) {
    prefs.auraEnabled = Boolean(enabled);
    savePrefs(prefs);
    if (prefs.auraEnabled) {
      armAuraTimer();
      updateArtworkAura();
      if (announce) notify('Aura Mode on', 'Auralis will follow the artwork palette while you listen.');
    } else {
      clearAuraTimer();
      resetAura();
      if (announce) notify('Aura Mode off', 'Auralis is back to its original visual palette.');
    }
  }

  function hashPalette(seed = 'auralis') {
    let hash = 2166136261;
    for (const char of seed) {
      hash ^= char.charCodeAt(0);
      hash = Math.imul(hash, 16777619);
    }
    const hue = Math.abs(hash) % 360;
    const hue2 = (hue + 42 + (Math.abs(hash >> 9) % 74)) % 360;
    return {
      primary: `hsl(${hue} 78% 64%)`,
      secondary: `hsl(${hue2} 82% 61%)`,
      rgb: hslToRgb(hue / 360, .78, .64)
    };
  }

  function hslToRgb(h, s, l) {
    if (s === 0) {
      const v = Math.round(l * 255);
      return [v, v, v];
    }
    const hue2rgb = (p, q, t) => {
      if (t < 0) t += 1;
      if (t > 1) t -= 1;
      if (t < 1/6) return p + (q - p) * 6 * t;
      if (t < 1/2) return q;
      if (t < 2/3) return p + (q - p) * (2/3 - t) * 6;
      return p;
    };
    const q = l < .5 ? l * (1 + s) : l + s - l * s;
    const p = 2 * l - q;
    return [hue2rgb(p, q, h + 1/3), hue2rgb(p, q, h), hue2rgb(p, q, h - 1/3)].map(v => Math.round(v * 255));
  }

  function rgbToCss(rgb) {
    return `rgb(${rgb.map(v => Math.max(0, Math.min(255, Math.round(v)))).join(' ')})`;
  }

  function derivePaletteFromImage(url) {
    return new Promise((resolve, reject) => {
      if (!url || !/^https?:/i.test(url)) return reject(new Error('No remote artwork'));
      const image = new Image();
      image.crossOrigin = 'anonymous';
      image.referrerPolicy = 'no-referrer';
      const timer = setTimeout(() => reject(new Error('Artwork color timeout')), 3500);
      image.onload = () => {
        clearTimeout(timer);
        try {
          const canvas = document.createElement('canvas');
          canvas.width = 32;
          canvas.height = 32;
          const context = canvas.getContext('2d', { willReadFrequently: true });
          context.drawImage(image, 0, 0, 32, 32);
          const pixels = context.getImageData(0, 0, 32, 32).data;
          const buckets = [];
          for (let i = 0; i < pixels.length; i += 16) {
            const r = pixels[i], g = pixels[i + 1], b = pixels[i + 2], a = pixels[i + 3];
            if (a < 180) continue;
            const max = Math.max(r, g, b), min = Math.min(r, g, b);
            const saturation = max - min;
            const brightness = (r + g + b) / 3;
            if (brightness < 32 || brightness > 238 || saturation < 20) continue;
            buckets.push({ rgb: [r, g, b], score: saturation * .9 + (128 - Math.abs(150 - brightness)) * .35 });
          }
          if (!buckets.length) throw new Error('Artwork palette too neutral');
          buckets.sort((a, b) => b.score - a.score);
          const primary = buckets[0].rgb;
          const secondary = buckets[Math.min(buckets.length - 1, Math.max(1, Math.floor(buckets.length * .28)))].rgb;
          resolve({ primary: rgbToCss(primary), secondary: rgbToCss(secondary), rgb: primary });
        } catch (error) {
          reject(error);
        }
      };
      image.onerror = () => {
        clearTimeout(timer);
        reject(new Error('Artwork blocks palette sampling'));
      };
      image.src = url;
    });
  }

  function applyAura(palette) {
    const root = document.documentElement;
    root.style.setProperty('--aura-primary', palette.primary);
    root.style.setProperty('--aura-secondary', palette.secondary);
    root.style.setProperty('--aura-rgb', palette.rgb.join(','));
  }

  function resetAura() {
    const root = document.documentElement;
    root.style.removeProperty('--aura-primary');
    root.style.removeProperty('--aura-secondary');
    root.style.removeProperty('--aura-rgb');
  }

  async function updateArtworkAura() {
    if (!prefs.auraEnabled) return;
    const run = ++colorRun;
    const image = $('#playerCover img');
    const title = clean($('#playerTitle')?.textContent || 'Auralis');
    const artwork = image?.currentSrc || image?.src || '';
    let palette;
    try {
      palette = await derivePaletteFromImage(artwork);
    } catch {
      palette = hashPalette(`${artwork}|${title}`);
    }
    if (run !== colorRun || !prefs.auraEnabled) return;
    applyAura(palette);
    document.documentElement.classList.remove('aura-swap');
    requestAnimationFrame(() => document.documentElement.classList.add('aura-swap'));
  }

  function ensurePlayerLoadingUi() {
    const player = $('#playerBar');
    const center = $('.player-center', player || document);
    if (!player || !center || $('#playerLoadingBadge')) return;
    const badge = document.createElement('div');
    badge.id = 'playerLoadingBadge';
    badge.className = 'player-loading-badge';
    badge.setAttribute('aria-live', 'polite');
    badge.innerHTML = '<span class="player-loading-wave" aria-hidden="true"><i></i><i></i><i></i><i></i></span><span class="player-loading-copy">Loading audio…</span>';
    center.prepend(badge);
  }

  function setPlayerLoading(loading, message = '') {
    ensurePlayerLoadingUi();
    const player = $('#playerBar');
    const badge = $('#playerLoadingBadge');
    if (!player || !badge) return;
    player.classList.toggle('auralis-player-loading', Boolean(loading));
    const copy = $('.player-loading-copy', badge);
    if (copy) copy.textContent = message || ($('#playerSource')?.textContent.includes('LIVE') ? 'Tuning live stream…' : 'Loading audio…');
  }

  function bindPlayerLoading() {
    const audio = $('#audio');
    if (!audio || audio.dataset.loadingV7 === 'true') return;
    audio.dataset.loadingV7 = 'true';
    ['loadstart', 'waiting', 'stalled', 'seeking'].forEach(event => audio.addEventListener(event, () => setPlayerLoading(true)));
    ['playing', 'canplay', 'canplaythrough', 'seeked'].forEach(event => audio.addEventListener(event, () => setPlayerLoading(false)));
    audio.addEventListener('error', () => setPlayerLoading(false));
    audio.addEventListener('emptied', () => {
      if ($('#playerTitle')?.textContent !== 'Choose a track') setPlayerLoading(true);
    });
  }

  function stationNameFromTarget(target) {
    const card = target.closest?.('.radio-card,.v5-language-station');
    return clean(card?.querySelector('strong')?.textContent || target.getAttribute?.('aria-label')?.replace(/^(Play|Tune)\s+/i, '') || 'Live radio');
  }

  function stationLogoFromTarget(target) {
    const card = target.closest?.('.radio-card,.v5-language-station');
    return card?.querySelector('img')?.src || '';
  }

  function showRadioTuning(name = 'Live radio', logo = '') {
    const radioView = $('#radioView');
    const popular = $('#radioPopularBlockV5');
    if (!radioView || !popular) return;
    let block = $('#radioTuningV7');
    if (!block) {
      block = document.createElement('section');
      block.id = 'radioTuningV7';
      block.className = 'radio-tuning-v7';
      popular.before(block);
    }
    tuningStartedAt = Date.now();
    const initial = (clean(name)[0] || 'R').toLocaleUpperCase();
    block.innerHTML = `
      <div class="tuning-visual-v7">
        <div class="tuning-logo-v7">${logo ? `<img src="${escapeHtml(logo)}" alt="" referrerpolicy="no-referrer" onerror="this.remove();this.parentElement.textContent='${escapeHtml(initial)}'"/>` : escapeHtml(initial)}</div>
        <div class="tuning-rings-v7"><i></i><i></i><i></i></div>
      </div>
      <div class="tuning-copy-v7"><p class="eyebrow">TUNING AURALIS</p><strong>${escapeHtml(name)}</strong><span>Checking the live route and preparing the player…</span><div class="tuning-spectrum-v7"><i></i><i></i><i></i><i></i><i></i><i></i><i></i></div></div>`;
    block.hidden = false;
  }

  function hideRadioTuning(delay = 0) {
    const block = $('#radioTuningV7');
    if (!block) return;
    const elapsed = Date.now() - tuningStartedAt;
    const wait = Math.max(delay, 650 - elapsed);
    setTimeout(() => {
      block.classList.add('leaving');
      setTimeout(() => {
        block.hidden = true;
        block.classList.remove('leaving');
      }, 260);
    }, wait);
  }

  function bindRadioTuning() {
    document.addEventListener('click', event => {
      const target = event.target.closest?.('#radioView .radio-play,#radioView [data-pinned-play],#radioView .v5-language-station');
      if (!target) return;
      showRadioTuning(stationNameFromTarget(target), stationLogoFromTarget(target));
    }, true);

    const audio = $('#audio');
    audio?.addEventListener('playing', () => hideRadioTuning());
    audio?.addEventListener('error', () => hideRadioTuning(150));

    const active = $('#radioActiveBlockV6');
    if (active) {
      new MutationObserver(() => {
        if (!active.hidden && active.querySelector('.radio-card')) hideRadioTuning(250);
      }).observe(active, { childList: true, subtree: true, attributes: true, attributeFilter: ['hidden'] });
    }
  }

  function waitForRadioCard(name, timeout = 9000) {
    const wanted = clean(name).toLowerCase();
    return new Promise(resolve => {
      const started = Date.now();
      const timer = setInterval(() => {
        const cards = $$('#radioGrid .radio-card');
        const exact = cards.find(card => clean(card.querySelector('strong')?.textContent).toLowerCase() === wanted)
          || cards.find(card => clean(card.querySelector('strong')?.textContent).toLowerCase().includes(wanted));
        if (exact || Date.now() - started > timeout) {
          clearInterval(timer);
          resolve(exact || cards[0] || null);
        }
      }, 120);
    });
  }

  async function tuneStationViaSearch(station) {
    if (!station?.name) return;
    const input = $('#radioSearchInput');
    const search = $('#radioSearchButton');
    if (!input || !search) return;
    showRadioTuning(station.name, station.favicon || '');
    input.value = station.name;
    input.dispatchEvent(new Event('input', { bubbles: true }));
    search.click();
    const card = await waitForRadioCard(station.name);
    const play = card?.querySelector('.radio-play');
    if (play) play.click();
    else {
      hideRadioTuning();
      notify('Konkani radio is refreshing', 'The verified stream changed while you were opening it. Try again in a moment.');
    }
  }

  function konkaniCard(station) {
    const logo = clean(station.favicon || '');
    return `<button class="v5-language-station v7-konkani-pick" type="button" data-v7-konkani="true">
      <div class="v5-radio-logo">${logo ? `<img src="${escapeHtml(logo)}" alt="" loading="lazy" referrerpolicy="no-referrer" onerror="this.remove();this.parentElement.textContent='AK'"/>` : 'AK'}</div>
      <span class="v5-language-station-copy"><span class="v5-live">LIVE · VERIFIED</span><strong>${escapeHtml(station.name)}</strong><small>India · Goa · Konkani music pick · ${escapeHtml(station.codec || 'audio')}${station.bitrate ? ` · ${station.bitrate}kbps` : ''}</small></span>
      <span class="v5-station-play" aria-hidden="true">▶</span>
    </button>`;
  }

  async function enforceSingleKonkaniPick() {
    const container = $('#language-konkani');
    if (!container || konkaniBusy || container.dataset.v7Konkani === 'ready') return;
    konkaniBusy = true;
    try {
      const response = await fetch('/api/radio?mode=search&q=AmchiKONKANI&limit=3', { headers: { Accept: 'application/json' } });
      const json = response.ok ? await response.json() : {};
      const station = (json.stations || []).find(item => /amchikonkani/i.test(item.name || '') && item.auralis_verified) || (json.stations || [])[0];
      if (!station) return;
      container.innerHTML = konkaniCard(station);
      container.dataset.v7Konkani = 'ready';
      container.querySelector('[data-v7-konkani]')?.addEventListener('click', () => tuneStationViaSearch(station));
    } catch {
      // Keep the existing language fallback if the dedicated station is temporarily unreachable.
    } finally {
      konkaniBusy = false;
    }
  }

  function enhanceProfileDialog() {
    const dialog = $('.auralis-profile-dialog');
    if (!dialog || $('#auraProfileSettings')) return;
    const actions = $('.profile-dialog-actions', dialog);
    const section = document.createElement('section');
    section.id = 'auraProfileSettings';
    section.className = 'aura-profile-settings';
    section.innerHTML = `
      <div class="aura-profile-heading"><div><p class="eyebrow">AURALIS EXPERIENCE</p><h3>Aura Mode</h3><span>Let the interface borrow color from the current artwork. Everything stays local to this device.</span></div><button type="button" id="profileAuraToggle" class="profile-aura-toggle">${prefs.auraEnabled ? 'On' : 'Off'}</button></div>
      <label class="aura-setting-row"><span><strong>Show Aura controls</strong><small>Keep the animated Aura buttons in the header and player.</small></span><input id="profileAuraControls" type="checkbox" ${prefs.controlsVisible ? 'checked' : ''}/></label>
      <label class="aura-setting-row"><span><strong>Auto-off timer</strong><small>Default is 10 minutes so the effect never overstays its welcome.</small></span><select id="profileAuraTimer"><option value="5">5 min</option><option value="10">10 min</option><option value="20">20 min</option><option value="30">30 min</option><option value="60">60 min</option><option value="0">Never</option></select></label>
      <div class="aura-profile-note"><strong>Guest mode</strong><span>Your display name, likes, history and Aura preferences are stored locally until optional Auralis Cloud accounts are enabled.</span></div>`;
    dialog.insertBefore(section, actions || null);

    const timer = $('#profileAuraTimer', section);
    timer.value = String(Number(prefs.timeoutMinutes || 0));
    $('#profileAuraToggle', section).addEventListener('click', event => {
      setAuraEnabled(!prefs.auraEnabled, false);
      event.currentTarget.textContent = prefs.auraEnabled ? 'On' : 'Off';
    });
    $('#profileAuraControls', section).addEventListener('change', event => savePrefs({ controlsVisible: event.target.checked }));
    timer.addEventListener('change', event => {
      savePrefs({ timeoutMinutes: Number(event.target.value) });
      if (prefs.auraEnabled) armAuraTimer();
    });
  }

  function syncProfileSettings() {
    const toggle = $('#profileAuraToggle');
    if (toggle) toggle.textContent = prefs.auraEnabled ? 'On' : 'Off';
    const controls = $('#profileAuraControls');
    if (controls) controls.checked = prefs.controlsVisible;
    const timer = $('#profileAuraTimer');
    if (timer) timer.value = String(Number(prefs.timeoutMinutes || 0));
  }

  function watchPlayerArtwork() {
    const cover = $('#playerCover');
    const title = $('#playerTitle');
    if (cover) new MutationObserver(() => updateArtworkAura()).observe(cover, { childList: true, subtree: true, attributes: true });
    if (title) new MutationObserver(() => updateArtworkAura()).observe(title, { childList: true, characterData: true, subtree: true });
  }

  function init() {
    ensureAuraControls();
    ensurePlayerLoadingUi();
    bindPlayerLoading();
    bindRadioTuning();
    watchPlayerArtwork();
    syncAuraControls();
    if (prefs.auraEnabled) {
      armAuraTimer();
      updateArtworkAura();
    }
    enforceSingleKonkaniPick();

    const observer = new MutationObserver(() => {
      ensureAuraControls();
      enhanceProfileDialog();
      enforceSingleKonkaniPick();
    });
    observer.observe(document.body, { childList: true, subtree: true });
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', () => setTimeout(init, 0));
  else setTimeout(init, 0);
})();
