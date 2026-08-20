(() => {
  const PLAYABLE_ROW_SELECTOR = '.track-row';
  const PLAY_TARGET_SELECTOR = '.row-title';
  const PROFILE_KEY = 'auralis:guest-profile:v1';

  const escapeHtml = (value = '') => String(value).replace(/[&<>'"]/g, char => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#039;', '"': '&quot;'
  }[char]));

  const cleanText = (value = '') => String(value).replace(/\s+/g, ' ').trim();
  const stationKey = (value = '') => cleanText(value).toLowerCase().replace(/[^a-z0-9]+/g, '');

  function ensureV4Styles() {
    if (document.querySelector('link[data-auralis-v4]')) return;
    const link = document.createElement('link');
    link.rel = 'stylesheet';
    link.href = './experience-v4.css';
    link.dataset.auralisV4 = 'true';
    document.head.append(link);
  }

  function notify(title, detail = '') {
    const region = document.querySelector('#toastRegion');
    if (!region) return;
    const node = document.createElement('div');
    node.className = 'toast';
    node.innerHTML = `${escapeHtml(title)}${detail ? `<small>${escapeHtml(detail)}</small>` : ''}`;
    region.append(node);
    setTimeout(() => node.remove(), 3600);
  }

  // -------------------------------------------------------------------------
  // Track rows: artwork/title/artist are first-class play targets.
  // -------------------------------------------------------------------------

  function playRow(row) {
    const playButton = row?.querySelector('[data-play-row]');
    if (playButton) playButton.click();
  }

  function decoratePlayTargets(root = document) {
    root.querySelectorAll?.(PLAY_TARGET_SELECTOR).forEach(target => {
      if (target.dataset.playTargetReady === 'true') return;
      target.dataset.playTargetReady = 'true';
      target.setAttribute('role', 'button');
      target.setAttribute('tabindex', '0');
      const title = target.querySelector('strong')?.textContent?.trim();
      if (title) target.setAttribute('aria-label', `Play ${title}`);
    });
  }

  document.addEventListener('click', event => {
    const target = event.target.closest?.(PLAY_TARGET_SELECTOR);
    if (!target) return;
    const row = target.closest(PLAYABLE_ROW_SELECTOR);
    if (row) playRow(row);
  });

  document.addEventListener('keydown', event => {
    const target = event.target.closest?.(PLAY_TARGET_SELECTOR);
    if (!target || (event.key !== 'Enter' && event.key !== ' ')) return;
    const row = target.closest(PLAYABLE_ROW_SELECTOR);
    if (!row) return;
    event.preventDefault();
    playRow(row);
  });

  // -------------------------------------------------------------------------
  // Guest profile: optional name stored locally, no login required.
  // -------------------------------------------------------------------------

  function loadProfile() {
    try {
      const parsed = JSON.parse(localStorage.getItem(PROFILE_KEY) || '{}');
      return { name: cleanText(parsed.name || '').slice(0, 40) };
    } catch {
      return { name: '' };
    }
  }

  function saveProfile(name) {
    const clean = cleanText(name).slice(0, 40);
    try { localStorage.setItem(PROFILE_KEY, JSON.stringify({ name: clean })); } catch {}
    renderProfile(clean);
    return clean;
  }

  function profileInitial(name) {
    const value = cleanText(name || 'Listener');
    return (value[0] || 'L').toLocaleUpperCase();
  }

  function renderProfile(name = loadProfile().name) {
    const display = name || 'Listener';
    document.querySelectorAll('.profile-pill').forEach(button => {
      const avatar = button.querySelector('.profile-avatar');
      const label = [...button.children].find(child => child !== avatar);
      if (avatar) avatar.textContent = profileInitial(display);
      if (label) label.textContent = display;
      button.title = name ? `Listening as ${display}` : 'Set an optional local display name';
    });
  }

  function buildProfileDialog() {
    if (document.querySelector('#auralisProfileBackdrop')) return;
    const current = loadProfile().name;
    const backdrop = document.createElement('div');
    backdrop.id = 'auralisProfileBackdrop';
    backdrop.className = 'auralis-profile-backdrop';
    backdrop.innerHTML = `
      <div class="auralis-profile-dialog" role="dialog" aria-modal="true" aria-labelledby="auralisProfileTitle">
        <div class="profile-dialog-top">
          <div class="profile-dialog-copy">
            <p class="eyebrow">YOUR LOCAL LISTENING SPACE</p>
            <h2 id="auralisProfileTitle">What should Auralis call you?</h2>
            <p>This is optional and stays on this device. No account is required to browse or play music.</p>
          </div>
          <div class="profile-dialog-preview" id="profileDialogPreview">${escapeHtml(profileInitial(current || 'Listener'))}</div>
        </div>
        <div class="profile-dialog-field">
          <label for="auralisDisplayName">Display name</label>
          <input id="auralisDisplayName" maxlength="40" autocomplete="nickname" placeholder="Listener" value="${escapeHtml(current)}" />
        </div>
        <div class="profile-dialog-actions">
          <button class="clear-name" type="button" id="clearAuralisName">Use Listener</button>
          <button class="save-name" type="button" id="saveAuralisName">Save name</button>
        </div>
      </div>`;
    document.body.append(backdrop);

    const input = backdrop.querySelector('#auralisDisplayName');
    const preview = backdrop.querySelector('#profileDialogPreview');
    const close = () => backdrop.classList.remove('open');
    const save = () => {
      const name = saveProfile(input.value);
      preview.textContent = profileInitial(name || 'Listener');
      notify(name ? `Hi, ${name}` : 'Guest mode', name ? 'Your name is saved locally on this device.' : 'Auralis will keep calling you Listener.');
      close();
    };

    input.addEventListener('input', () => { preview.textContent = profileInitial(input.value || 'Listener'); });
    input.addEventListener('keydown', event => {
      if (event.key === 'Enter') save();
      if (event.key === 'Escape') close();
    });
    backdrop.querySelector('#saveAuralisName').addEventListener('click', save);
    backdrop.querySelector('#clearAuralisName').addEventListener('click', () => {
      input.value = '';
      save();
    });
    backdrop.addEventListener('click', event => { if (event.target === backdrop) close(); });
    document.addEventListener('keydown', event => { if (event.key === 'Escape') close(); });
  }

  function openProfileDialog() {
    buildProfileDialog();
    const backdrop = document.querySelector('#auralisProfileBackdrop');
    const input = backdrop?.querySelector('#auralisDisplayName');
    if (!backdrop) return;
    input.value = loadProfile().name;
    backdrop.querySelector('#profileDialogPreview').textContent = profileInitial(input.value || 'Listener');
    backdrop.classList.add('open');
    setTimeout(() => input?.focus(), 50);
  }

  document.addEventListener('click', event => {
    if (event.target.closest?.('.profile-pill')) openProfileDialog();
  });

  // -------------------------------------------------------------------------
  // Brand is always a reliable Home button.
  // -------------------------------------------------------------------------

  document.addEventListener('click', event => {
    const brand = event.target.closest?.('.brand');
    if (!brand) return;
    event.preventDefault();
    document.querySelector('[data-view="home"]')?.click();
    const scroll = document.querySelector('#contentScroll');
    if (scroll) scroll.scrollTop = 0;
  });

  // -------------------------------------------------------------------------
  // Essentials shelf: more timeless/era-based routes into active catalogs.
  // -------------------------------------------------------------------------

  const essentialRoutes = [
    ['Timeless Rock','Classic riffs and evergreen songwriting','classic rock greatest hits timeless','rose'],
    ['Hip-Hop Canon','Old-school foundations and lyrical craft','classic hip hop greatest tracks old school','amber'],
    ['2000s Anthems','Y2K pop, alt-rock and electronic nostalgia','2000s anthems pop rock electronic','cyan'],
    ['Bollywood Route','Hindi film energy across available open catalogs','bollywood hindi film music indian','rose'],
    ['Indie Classics','Cult-favorite alternative textures','indie classics alternative greatest','mint'],
    ['Electronic Legends','Landmark house, techno and trance energy','classic electronic house techno trance greatest','cyan'],
    ['Jazz Standards','Timeless forms, swing and late-night piano','jazz standards classic jazz','amber'],
    ['Screen Legends','Cinematic scores and soundtrack-scale moments','iconic film score soundtrack cinematic','mint']
  ];

  function runMainSearch(query) {
    const input = document.querySelector('#searchInput');
    if (!input) return;
    input.value = query;
    input.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }));
  }

  function injectEssentialsShelf() {
    if (document.querySelector('#essentialsV4')) return;
    const radioSection = document.querySelector('#homeView .radio-section');
    if (!radioSection) return;
    const section = document.createElement('section');
    section.id = 'essentialsV4';
    section.className = 'section-block essentials-v4';
    section.innerHTML = `
      <div class="section-heading">
        <div><p class="eyebrow">AURALIS ESSENTIALS</p><h2>Great records, eras and sounds — through our catalogs</h2></div>
        <button class="text-button" data-view-trigger-v4="collections">Browse all 44 collections →</button>
      </div>
      <div class="essentials-grid-v4">
        ${essentialRoutes.map(([title, detail, query, tone]) => `
          <button class="essential-route" data-essential-query="${escapeHtml(query)}" data-tone="${tone}">
            <span>Discovery route</span><strong>${escapeHtml(title)}</strong><small>${escapeHtml(detail)}</small>
          </button>`).join('')}
      </div>`;
    radioSection.before(section);
    section.querySelectorAll('[data-essential-query]').forEach(button => button.addEventListener('click', () => runMainSearch(button.dataset.essentialQuery)));
    section.querySelector('[data-view-trigger-v4="collections"]')?.addEventListener('click', () => document.querySelector('[data-view="collections"]')?.click());
  }

  function patchCollectionCounts() {
    const browse = document.querySelector('#browseAllCollections');
    if (browse) browse.textContent = 'All 44 collections →';
    document.querySelectorAll('.catalog-kicker strong').forEach(strong => {
      if (strong.textContent.trim() === '36') strong.textContent = '44';
    });
  }

  // -------------------------------------------------------------------------
  // Radio Universe v4
  // -------------------------------------------------------------------------

  const languages = [
    { label: 'Telugu', query: 'telugu', mark: 'తె' },
    { label: 'Kannada', query: 'kannada', mark: 'ಕ' },
    { label: 'Tamil', query: 'tamil', mark: 'த' },
    { label: 'Malayalam', query: 'malayalam', mark: 'മ' },
    { label: 'Hindi', query: 'hindi', mark: 'हि' }
  ];

  const regions = [
    ['IN','India'],['US','USA'],['GB','UK'],['FR','France'],['DE','Germany'],['AE','UAE'],['JP','Japan'],['KR','South Korea'],['BR','Brazil'],['AU','Australia']
  ];

  function initials(name = '') {
    const words = cleanText(name).replace(/[^\p{L}\p{N} ]/gu, ' ').split(' ').filter(Boolean);
    if (!words.length) return '♪';
    return words.slice(0, 2).map(word => word[0]).join('').toLocaleUpperCase();
  }

  function stationDetail(station) {
    return [station.country, station.language, station.codec && `${station.codec}${station.bitrate ? ` · ${station.bitrate}kbps` : ''}`]
      .filter(Boolean).join(' · ');
  }

  function stationScore(station) {
    return Number(station.auralis_score || 0) || (Number(station.clickcount || 0) * 20 + Number(station.votes || 0) / 10);
  }

  async function radioRequest(params = {}) {
    const url = new URL('/api/radio', window.location.origin);
    Object.entries(params).forEach(([key, value]) => {
      if (value !== undefined && value !== null && value !== '') url.searchParams.set(key, String(value));
    });
    const response = await fetch(url, { headers: { Accept: 'application/json' } });
    if (!response.ok) throw new Error(`Radio request failed (${response.status})`);
    const json = await response.json();
    return Array.isArray(json.stations) ? json.stations : [];
  }

  function logoMarkup(station) {
    const logo = cleanText(station.favicon || '');
    if (logo && logo !== 'null' && /^https:\/\//i.test(logo)) {
      return `<div class="v4-radio-logo"><img src="${escapeHtml(logo)}" alt="" loading="lazy" referrerpolicy="no-referrer" data-v4-logo="${escapeHtml(initials(station.name))}" /></div>`;
    }
    return `<div class="v4-radio-logo">${escapeHtml(initials(station.name))}</div>`;
  }

  function stationCard(station, { india = false } = {}) {
    return `<article class="v4-radio-card ${india ? 'india' : ''}" data-v4-station="${escapeHtml(station.name || '')}">
      ${logoMarkup(station)}
      <div class="v4-radio-copy">
        <span class="station-kicker">${india ? 'INDIA · ' : ''}LIVE</span>
        <strong>${escapeHtml(station.name || 'Live station')}</strong>
        <small>${escapeHtml(stationDetail(station) || 'Live radio')}</small>
      </div>
      <button class="v4-radio-play" type="button" aria-label="Play ${escapeHtml(station.name || 'station')}">▶</button>
    </article>`;
  }

  function fixCustomLogos(root = document) {
    root.querySelectorAll?.('img[data-v4-logo]').forEach(img => {
      if (img.dataset.logoReady === 'true') return;
      img.dataset.logoReady = 'true';
      img.addEventListener('error', () => {
        const parent = img.parentElement;
        if (!parent) return;
        parent.textContent = img.dataset.v4Logo || '♪';
      }, { once: true });
    });
  }

  function fixNativeRadioLogos(root = document) {
    root.querySelectorAll?.('.radio-card').forEach(card => {
      const logo = card.querySelector('.radio-logo');
      if (!logo || logo.dataset.fallbackReady === 'true') return;
      logo.dataset.fallbackReady = 'true';
      const title = card.querySelector('.radio-copy strong')?.textContent || 'Radio';
      const fallback = () => {
        logo.classList.add('logo-fallback');
        logo.querySelector('img')?.remove();
        const old = logo.querySelector('span');
        if (old) old.remove();
        if (!logo.querySelector('.radio-fallback-mark')) {
          const mark = document.createElement('span');
          mark.className = 'radio-fallback-mark';
          mark.textContent = initials(title);
          logo.prepend(mark);
        }
      };
      const img = logo.querySelector('img');
      if (img) img.addEventListener('error', fallback, { once: true });
      else fallback();
    });
  }

  function waitForRadioResult(name, timeout = 7000) {
    const wanted = stationKey(name);
    return new Promise(resolve => {
      const find = () => {
        const cards = [...document.querySelectorAll('#radioGrid .radio-card')];
        return cards.find(card => stationKey(card.querySelector('strong')?.textContent || '') === wanted)
          || cards.find(card => stationKey(card.querySelector('strong')?.textContent || '').includes(wanted))
          || cards[0];
      };
      const immediate = find();
      if (immediate) return resolve(immediate);
      const observer = new MutationObserver(() => {
        const match = find();
        if (!match) return;
        observer.disconnect();
        resolve(match);
      });
      const grid = document.querySelector('#radioGrid');
      if (grid) observer.observe(grid, { childList: true, subtree: true });
      setTimeout(() => { observer.disconnect(); resolve(find()); }, timeout);
    });
  }

  async function playStation(station) {
    if (!station?.name) return;
    document.querySelector('[data-view="radio"]')?.click();
    const input = document.querySelector('#radioSearchInput');
    const button = document.querySelector('#radioSearchButton');
    if (!input || !button) return;
    input.value = station.name;
    const waiting = waitForRadioResult(station.name);
    button.click();
    const card = await waiting;
    const play = card?.querySelector('.radio-play');
    if (play) play.click();
    else notify('Station found', 'Open the result and tap play.');
  }

  function bindStationCards(root, stations) {
    root.querySelectorAll('[data-v4-station]').forEach(card => {
      const station = stations.find(item => item.name === card.dataset.v4Station);
      if (!station) return;
      card.addEventListener('click', event => {
        event.preventDefault();
        playStation(station);
      });
    });
    fixCustomLogos(root);
  }

  function dedupeStations(stations) {
    const seen = new Set();
    return stations.filter(station => {
      const key = station.stationuuid || `${stationKey(station.name)}:${station.url_resolved || station.url}`;
      if (!key || seen.has(key)) return false;
      seen.add(key);
      return true;
    });
  }

  async function loadIndiaFeatured() {
    const grid = document.querySelector('#indiaFeaturedGrid');
    const homeGrid = document.querySelector('#homeIndiaRadioGrid');
    if (!grid) return [];
    grid.innerHTML = '<div class="radio-loading-v4">Finding healthy India streams…</div>';

    try {
      const [country, mirchi, city, club] = await Promise.all([
        radioRequest({ mode: 'country', q: 'IN', limit: 28 }),
        radioRequest({ mode: 'search', q: 'Radio Mirchi', limit: 8 }),
        radioRequest({ mode: 'search', q: 'Radio City', limit: 8 }),
        radioRequest({ mode: 'search', q: 'Club FM', limit: 8 })
      ]);
      const curated = [...mirchi, ...city, ...club].filter(station => station.countrycode === 'IN');
      const stations = dedupeStations([...curated, ...country])
        .sort((a, b) => stationScore(b) - stationScore(a))
        .slice(0, 8);
      grid.innerHTML = stations.map(station => stationCard(station, { india: true })).join('');
      bindStationCards(grid, stations);
      if (homeGrid) {
        const homeStations = stations.slice(0, 4);
        homeGrid.innerHTML = homeStations.map(station => stationCard(station, { india: true })).join('');
        bindStationCards(homeGrid, homeStations);
      }
      return stations;
    } catch {
      grid.innerHTML = '<div class="radio-loading-v4">India radio is temporarily checking its streams.</div>';
      if (homeGrid) homeGrid.innerHTML = '<div class="radio-loading-v4">India stations are checking.</div>';
      return [];
    }
  }

  async function loadLanguagePicks() {
    const grid = document.querySelector('#indiaLanguageGrid');
    if (!grid) return;
    grid.innerHTML = '<div class="radio-loading-v4">Tuning Telugu, Kannada, Tamil, Malayalam and Hindi…</div>';

    const groups = await Promise.all(languages.map(async language => {
      let stations = await radioRequest({ mode: 'language', q: language.query, country: 'IN', limit: 8 }).catch(() => []);
      if (!stations.length) stations = await radioRequest({ mode: 'search', q: language.query, limit: 8 }).catch(() => []);
      stations = stations.filter(station => !station.countrycode || station.countrycode === 'IN').sort((a, b) => stationScore(b) - stationScore(a));
      const picks = stations.slice(0, 1);
      if (stations[1] && stationScore(stations[1]) >= Math.max(80, stationScore(stations[0]) * .7)) picks.push(stations[1]);
      return { language, picks };
    }));

    const all = groups.flatMap(group => group.picks.map(station => ({ station, language: group.language })));
    if (!all.length) {
      grid.innerHTML = '<div class="radio-loading-v4">No healthy language streams were returned right now.</div>';
      return;
    }

    grid.innerHTML = all.map(({ station, language }) => `
      <button class="language-card" type="button" data-language-station="${escapeHtml(station.name)}">
        <span class="language-card-top"><span class="language-flag">${escapeHtml(language.mark)}</span><span class="language-live">LIVE · ${escapeHtml(language.label)}</span></span>
        <span class="language-card-copy"><strong>${escapeHtml(station.name)}</strong><small>${escapeHtml(stationDetail(station) || `${language.label} radio`)}</small></span>
      </button>`).join('');

    grid.querySelectorAll('[data-language-station]').forEach(button => {
      const item = all.find(({ station }) => station.name === button.dataset.languageStation);
      if (item) button.addEventListener('click', () => playStation(item.station));
    });
  }

  async function loadRegion(code, label) {
    const results = document.querySelector('#radioRegionResults');
    if (!results) return;
    results.innerHTML = `<div class="radio-loading-v4">Loading ${escapeHtml(label)} stations…</div>`;
    document.querySelectorAll('[data-radio-country]').forEach(button => button.classList.toggle('active', button.dataset.radioCountry === code));
    try {
      const stations = await radioRequest({ mode: 'country', q: code, limit: 12 });
      const visible = stations.slice(0, 9);
      results.innerHTML = `<div class="radio-featured-grid">${visible.map(station => stationCard(station, { india: code === 'IN' })).join('')}</div>`;
      bindStationCards(results, visible);
    } catch {
      results.innerHTML = '<div class="radio-loading-v4">This region is temporarily unavailable.</div>';
    }
  }

  function injectRadioUniverse() {
    if (document.querySelector('#radioUniverseV4')) return;
    const view = document.querySelector('#radioView');
    const hero = view?.querySelector('.radio-hero');
    if (!view || !hero) return;

    const shell = document.createElement('div');
    shell.id = 'radioUniverseV4';
    shell.className = 'radio-v4-shell';
    shell.innerHTML = `
      <section class="radio-v4-section">
        <div class="radio-v4-heading"><div><p class="eyebrow">INDIA SPOTLIGHT</p><h2>Big names + healthy streams</h2><p>Recognizable Indian stations are promoted only when their current HTTPS stream is healthy enough for the browser player.</p></div><span class="radio-v4-pill">curated live</span></div>
        <div class="radio-featured-grid" id="indiaFeaturedGrid"></div>
      </section>
      <section class="radio-v4-section">
        <div class="radio-v4-heading"><div><p class="eyebrow">INDIA BY LANGUAGE</p><h2>One strong starting point per language</h2><p>Telugu, Kannada, Tamil, Malayalam and Hindi — with an extra station only when another option is genuinely strong.</p></div><span class="radio-v4-pill">language lanes</span></div>
        <div class="language-radio-grid" id="indiaLanguageGrid"></div>
      </section>
      <section class="radio-v4-section">
        <div class="radio-v4-heading"><div><p class="eyebrow">AROUND THE WORLD</p><h2>Explore radio by country</h2><p>Keep the international discovery you liked, but make it easier to move around the world deliberately.</p></div></div>
        <div class="radio-region-toolbar" id="radioRegionToolbar">${regions.map(([code,label]) => `<button type="button" data-radio-country="${code}">${escapeHtml(label)}</button>`).join('')}</div>
        <div class="radio-region-results" id="radioRegionResults"></div>
      </section>`;
    hero.after(shell);

    shell.querySelectorAll('[data-radio-country]').forEach(button => button.addEventListener('click', () => loadRegion(button.dataset.radioCountry, button.textContent.trim())));

    const title = document.querySelector('#radioTitle');
    if (title) title.textContent = 'Popular worldwide right now';

    const homeRadio = document.querySelector('#homeView .radio-section');
    const homeGrid = document.querySelector('#homeRadioGrid');
    if (homeRadio && homeGrid && !document.querySelector('#homeIndiaRadio')) {
      const lane = document.createElement('div');
      lane.id = 'homeIndiaRadio';
      lane.className = 'home-india-radio';
      lane.innerHTML = `<div class="home-india-radio-head"><div><strong>India on air</strong><small>Popular healthy streams before the worldwide mix</small></div><button class="text-button" type="button" id="openIndiaRadioV4">See radio universe →</button></div><div class="home-india-radio-grid" id="homeIndiaRadioGrid"></div>`;
      homeGrid.before(lane);
      lane.querySelector('#openIndiaRadioV4').addEventListener('click', () => document.querySelector('[data-view="radio"]')?.click());
    }

    loadIndiaFeatured();
    loadLanguagePicks();
    loadRegion('IN', 'India');
  }

  // Keep broken/missing station favicons from becoming ugly broken-image boxes.
  const observer = new MutationObserver(mutations => {
    decoratePlayTargets();
    fixNativeRadioLogos();
    for (const mutation of mutations) {
      for (const node of mutation.addedNodes) {
        if (!(node instanceof Element)) continue;
        fixCustomLogos(node);
      }
    }
  });

  ensureV4Styles();
  renderProfile();
  decoratePlayTargets();
  injectEssentialsShelf();
  patchCollectionCounts();
  injectRadioUniverse();
  fixNativeRadioLogos();
  observer.observe(document.body, { childList: true, subtree: true });
})();
