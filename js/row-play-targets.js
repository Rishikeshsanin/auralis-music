(() => {
  const PLAYABLE_ROW_SELECTOR = '.track-row';
  const PLAY_TARGET_SELECTOR = '.row-title';
  const PROFILE_KEY = 'auralis:guest-profile:v1';

  const escapeHtml = (value = '') => String(value).replace(/[&<>'"]/g, char => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#039;', '"': '&quot;'
  }[char]));
  const cleanText = (value = '') => String(value).replace(/\s+/g, ' ').trim();
  const stationKey = (value = '') => cleanText(value).toLowerCase().replace(/[^a-z0-9]+/g, '');

  function ensureStyles() {
    [
      ['auralisV4', './experience-v4.css'],
      ['auralisV5', './experience-v5.css']
    ].forEach(([key, href]) => {
      if (document.querySelector(`link[data-${key.replace(/[A-Z]/g, letter => `-${letter.toLowerCase()}`)}]`)) return;
      const link = document.createElement('link');
      link.rel = 'stylesheet';
      link.href = href;
      link.dataset[key] = 'true';
      document.head.append(link);
    });
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

  // Track rows: artwork/title/artist remain first-class play targets.
  function playRow(row) {
    row?.querySelector('[data-play-row]')?.click();
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

  // Optional local guest name.
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
    if (!backdrop || !input) return;
    input.value = loadProfile().name;
    backdrop.querySelector('#profileDialogPreview').textContent = profileInitial(input.value || 'Listener');
    backdrop.classList.add('open');
    setTimeout(() => input.focus(), 50);
  }

  document.addEventListener('click', event => {
    if (event.target.closest?.('.profile-pill')) openProfileDialog();
  });

  // Brand always returns Home.
  document.addEventListener('click', event => {
    const brand = event.target.closest?.('.brand');
    if (!brand) return;
    event.preventDefault();
    document.querySelector('[data-view="home"]')?.click();
    const scroll = document.querySelector('#contentScroll');
    if (scroll) scroll.scrollTop = 0;
  });

  // Essentials shelf.
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
    const heading = document.querySelector('#collectionsView h1');
    if (heading && /Thirty-six/i.test(heading.textContent)) heading.textContent = 'Forty-four ways into the catalog.';
  }

  // Radio v5: search first, popular music first, then grouped languages.
  const LANGUAGE_GROUPS = [
    { label: 'English', mark: 'EN', query: 'english', country: '', countryLabel: 'UK · USA · Australia · global', limit: 3, searches: ['Capital FM', 'Radio Paradise', 'BBC Radio 1'] },
    { label: 'Hindi', mark: 'हि', query: 'hindi', country: 'IN', countryLabel: 'India', limit: 2, searches: ['Radio Mirchi', 'Red FM', 'Vividh Bharati'] },
    { label: 'Telugu', mark: 'తె', query: 'telugu', country: 'IN', countryLabel: 'India · Andhra Pradesh · Telangana', limit: 2, searches: ['Vividh Bharati Vijayawada', 'AP 9 FM'] },
    { label: 'Kannada', mark: 'ಕ', query: 'kannada', country: 'IN', countryLabel: 'India · Karnataka', limit: 2, searches: ['AIR FM Rainbow Bangalore', 'Sakkath Radio Kannada'] },
    { label: 'Tamil', mark: 'த', query: 'tamil', country: 'IN', countryLabel: 'India · Tamil Nadu', limit: 2, searches: ['Big FM Tamil', 'Tamil 80s'] },
    { label: 'Malayalam', mark: 'മ', query: 'malayalam', country: 'IN', countryLabel: 'India · Kerala', limit: 2, searches: ['Club FM', 'KJ Yesudas Malayalam'] },
    { label: 'Konkani', mark: 'कों', query: 'konkani', country: 'IN', countryLabel: 'India · Goa', limit: 1, searches: ['FM Rainbow Goa'] }
  ];

  const MUSIC_NEGATIVE = /\b(news|talk|speech|podcast|politic|traffic|weather|religious|christian|gospel|quran|sermon|church|bible)\b/i;
  const MUSIC_POSITIVE = /\b(pop|rock|hits?|music|dance|electronic|hip[ -]?hop|r&b|rnb|jazz|oldies|classic|melod(?:y|ies)|songs?|bollywood|retro|rainbow|club)\b/i;

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

  function stationText(station) {
    return `${station?.name || ''} ${station?.tags || ''}`.toLowerCase();
  }

  function languageMusicScore(station, group) {
    const text = stationText(station);
    let score = stationScore(station);
    if (MUSIC_NEGATIVE.test(text)) score -= 4000;
    if (MUSIC_POSITIVE.test(text)) score += 650;
    if (/vividh bharati|radio mirchi|red fm|big fm|sakkath|yesudas|fm rainbow|club fm|ap 9/i.test(station?.name || '')) score += 1200;
    if (group.label === 'English' && /capital fm london|radio paradise|bbc radio 1/i.test(station?.name || '')) score += 1800;
    if (group.label === 'Konkani' && /fm rainbow goa/i.test(station?.name || '')) score += 3000;
    return score;
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

  function dedupeStations(stations) {
    const seen = new Set();
    return stations.filter(station => {
      const key = station.stationuuid || `${stationKey(station.name)}:${station.url_resolved || station.url}`;
      if (!key || seen.has(key)) return false;
      seen.add(key);
      return true;
    });
  }

  function pickLanguageStations(stations, group) {
    const candidates = dedupeStations(stations)
      .filter(station => !group.country || !station.countrycode || station.countrycode === group.country)
      .sort((a, b) => languageMusicScore(b, group) - languageMusicScore(a, group));

    const musicFirst = candidates.filter(station => !MUSIC_NEGATIVE.test(stationText(station)) && (MUSIC_POSITIVE.test(stationText(station)) || languageMusicScore(station, group) > stationScore(station) + 800));
    const safeFallback = candidates.filter(station => !MUSIC_NEGATIVE.test(stationText(station)));
    const pool = musicFirst.length ? musicFirst : safeFallback.length ? safeFallback : candidates;
    return pool.slice(0, group.limit);
  }

  function logoMarkup(station) {
    const logo = cleanText(station.favicon || '');
    if (logo && logo !== 'null' && /^https:\/\//i.test(logo)) {
      return `<div class="v5-radio-logo"><img src="${escapeHtml(logo)}" alt="" loading="lazy" referrerpolicy="no-referrer" data-v5-logo="${escapeHtml(initials(station.name))}" /></div>`;
    }
    return `<div class="v5-radio-logo">${escapeHtml(initials(station.name))}</div>`;
  }

  function languageStationCard(station) {
    return `<button class="v5-language-station" type="button" data-v5-station="${escapeHtml(station.name || '')}">
      ${logoMarkup(station)}
      <span class="v5-language-station-copy"><span class="v5-live">LIVE</span><strong>${escapeHtml(station.name || 'Live station')}</strong><small>${escapeHtml(stationDetail(station) || 'Live radio')}</small></span>
      <span class="v5-station-play" aria-hidden="true">▶</span>
    </button>`;
  }

  function fixCustomLogos(root = document) {
    root.querySelectorAll?.('img[data-v5-logo]').forEach(img => {
      if (img.dataset.logoReady === 'true') return;
      img.dataset.logoReady = 'true';
      const fallback = () => {
        const parent = img.parentElement;
        if (parent) parent.textContent = img.dataset.v5Logo || '♪';
      };
      if (img.complete && !img.naturalWidth) fallback();
      else img.addEventListener('error', fallback, { once: true });
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
        logo.querySelector('span')?.remove();
        if (!logo.querySelector('.radio-fallback-mark')) {
          const mark = document.createElement('span');
          mark.className = 'radio-fallback-mark';
          mark.textContent = initials(title);
          logo.prepend(mark);
        }
      };
      const img = logo.querySelector('img');
      if (img) {
        if (img.complete && !img.naturalWidth) fallback();
        else img.addEventListener('error', fallback, { once: true });
      } else fallback();
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

  function bindLanguageCards(root, stations) {
    root.querySelectorAll('[data-v5-station]').forEach(card => {
      const station = stations.find(item => item.name === card.dataset.v5Station);
      if (station) card.addEventListener('click', () => playStation(station));
    });
    fixCustomLogos(root);
  }

  function skeletonMarkup(kind = 'card', count = 4) {
    return `<div class="auralis-loading-grid ${escapeHtml(kind)}" aria-hidden="true">${Array.from({ length: count }, () => `
      <div class="auralis-skeleton-card">
        <span class="auralis-skeleton-block media"></span>
        <span class="auralis-skeleton-copy"><i></i><i></i><i></i></span>
      </div>`).join('')}</div>`;
  }

  async function loadLanguageGroup(group, container) {
    container.setAttribute('aria-busy', 'true');
    container.innerHTML = skeletonMarkup('language', group.limit === 1 ? 1 : 2);

    try {
      const primary = radioRequest({ mode: 'language', q: group.query, country: group.country, limit: group.label === 'English' ? 18 : 10 }).catch(() => []);
      const searches = Promise.all(group.searches.map(query => radioRequest({ mode: 'search', q: query, limit: 6 }).catch(() => [])));
      const extraEnglish = group.label === 'English'
        ? Promise.all([
            radioRequest({ mode: 'country', q: 'GB', limit: 12 }).catch(() => []),
            radioRequest({ mode: 'country', q: 'US', limit: 12 }).catch(() => [])
          ])
        : Promise.resolve([]);

      const [primaryStations, searchGroups, englishGroups] = await Promise.all([primary, searches, extraEnglish]);
      const picked = pickLanguageStations([...primaryStations, ...searchGroups.flat(), ...englishGroups.flat()], group);

      if (!picked.length) {
        container.innerHTML = `<div class="v5-language-empty"><span>${escapeHtml(group.mark)}</span><strong>${escapeHtml(group.label)}</strong><small>No healthy stream is available right now.</small></div>`;
        return;
      }

      container.innerHTML = picked.map(languageStationCard).join('');
      bindLanguageCards(container, picked);
    } catch {
      container.innerHTML = `<div class="v5-language-empty"><span>${escapeHtml(group.mark)}</span><strong>${escapeHtml(group.label)}</strong><small>Station check temporarily unavailable.</small></div>`;
    } finally {
      container.removeAttribute('aria-busy');
    }
  }

  function injectRadioExperience() {
    const view = document.querySelector('#radioView');
    const hero = view?.querySelector('.radio-hero');
    const toolbar = view?.querySelector('.radio-toolbar');
    const heading = view?.querySelector('.compact-heading');
    const grid = document.querySelector('#radioGrid');
    const loadWrap = document.querySelector('#radioMoreButton')?.closest('.load-more-wrap');
    if (!view || !hero || !toolbar || !heading || !grid || !loadWrap) return;

    document.querySelector('#radioUniverseV4')?.remove();
    document.querySelector('#homeIndiaRadio')?.remove();

    if (!document.querySelector('#radioPopularBlockV5')) {
      const popular = document.createElement('section');
      popular.id = 'radioPopularBlockV5';
      popular.className = 'radio-popular-v5';
      toolbar.after(popular);
      popular.append(heading, grid, loadWrap);
    }

    hero.after(toolbar);

    const title = document.querySelector('#radioTitle');
    if (title && (!document.querySelector('#radioSearchInput')?.value.trim() || /Popular live stations/i.test(title.textContent))) {
      title.textContent = 'Popular music stations';
    }

    if (!document.querySelector('#radioLanguagesV5')) {
      const section = document.createElement('section');
      section.id = 'radioLanguagesV5';
      section.className = 'radio-languages-v5';
      section.innerHTML = `
        <div class="radio-v5-heading">
          <div><p class="eyebrow">LISTEN BY LANGUAGE</p><h2>Great stations, grouped where they belong</h2><p>English starts the language lanes, followed by Hindi and compact regional picks. Regional sections stay intentionally small so they never overwhelm the international music mix.</p></div>
          <span class="radio-v5-pill">music first</span>
        </div>
        <div class="radio-language-sections-v5">
          ${LANGUAGE_GROUPS.map(group => `
            <article class="radio-language-group-v5" data-language-group="${escapeHtml(group.query)}">
              <div class="radio-language-group-head"><span class="radio-language-mark">${escapeHtml(group.mark)}</span><div><strong>${escapeHtml(group.label)}</strong><small>${escapeHtml(group.countryLabel)}</small></div></div>
              <div class="radio-language-stations-v5" id="language-${escapeHtml(group.query)}"></div>
            </article>`).join('')}
        </div>`;
      document.querySelector('#radioPopularBlockV5')?.after(section);
      LANGUAGE_GROUPS.forEach(group => {
        const container = section.querySelector(`#language-${group.query}`);
        if (container) loadLanguageGroup(group, container);
      });
    }
  }

  // Upgrade backend loading text to visual shimmer without changing app-v3's data flow.
  const LOADING_TARGETS = [
    ['#trendingGrid', 'cards', 5],
    ['#searchList', 'rows', 6],
    ['#discoverList', 'rows', 6],
    ['#radioGrid', 'radio', 6]
  ];
  const LOADING_WORDS = /searching|finding|tuning|loading|checking|looking across/i;

  function enhanceLoadingStates() {
    LOADING_TARGETS.forEach(([selector, kind, count]) => {
      const target = document.querySelector(selector);
      if (!target || target.querySelector('.auralis-loading-grid')) return;
      if (LOADING_WORDS.test(target.textContent || '')) {
        target.setAttribute('aria-busy', 'true');
        target.innerHTML = skeletonMarkup(kind, count);
      } else {
        target.removeAttribute('aria-busy');
      }
    });

    document.querySelectorAll('button').forEach(button => {
      button.classList.toggle('auralis-button-loading', /^loading…?$|^loading\.\.\.$/i.test(button.textContent.trim()));
    });
  }

  function decorateLazyImages(root = document) {
    root.querySelectorAll?.('img[loading="lazy"]').forEach(img => {
      if (img.dataset.fadeReady === 'true') return;
      img.dataset.fadeReady = 'true';
      img.classList.add('auralis-image-loading');
      const done = () => img.classList.add('auralis-image-loaded');
      if (img.complete) done();
      else img.addEventListener('load', done, { once: true });
    });
  }

  function keepPopularTitleMusicFirst() {
    const input = document.querySelector('#radioSearchInput');
    const title = document.querySelector('#radioTitle');
    if (title && input && !input.value.trim() && /Popular live stations/i.test(title.textContent)) title.textContent = 'Popular music stations';
  }

  const observer = new MutationObserver(() => {
    decoratePlayTargets();
    fixNativeRadioLogos();
    fixCustomLogos();
    decorateLazyImages();
    enhanceLoadingStates();
    keepPopularTitleMusicFirst();
  });

  ensureStyles();
  renderProfile();
  decoratePlayTargets();
  injectEssentialsShelf();
  patchCollectionCounts();
  injectRadioExperience();
  fixNativeRadioLogos();
  fixCustomLogos();
  decorateLazyImages();
  enhanceLoadingStates();
  observer.observe(document.body, { childList: true, subtree: true, characterData: true });
})();
