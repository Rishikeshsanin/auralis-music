(() => {
  let working = false;
  let lastAppliedAt = 0;

  const clean = value => String(value || '').replace(/\s+/g, ' ').trim();
  const escapeHtml = (value = '') => String(value).replace(/[&<>'"]/g, char => ({ '&':'&amp;', '<':'&lt;', '>':'&gt;', "'":'&#039;', '"':'&quot;' }[char]));

  function waitForResult(name, timeout = 9000) {
    const wanted = clean(name).toLowerCase();
    return new Promise(resolve => {
      const started = Date.now();
      const timer = setInterval(() => {
        const cards = [...document.querySelectorAll('#radioGrid .radio-card')];
        const card = cards.find(item => clean(item.querySelector('strong')?.textContent).toLowerCase() === wanted)
          || cards.find(item => clean(item.querySelector('strong')?.textContent).toLowerCase().includes(wanted));
        if (card || Date.now() - started > timeout) {
          clearInterval(timer);
          resolve(card || null);
        }
      }, 120);
    });
  }

  async function play(station) {
    const input = document.querySelector('#radioSearchInput');
    const search = document.querySelector('#radioSearchButton');
    if (!input || !search) return;
    input.value = station.name;
    input.dispatchEvent(new Event('input', { bubbles: true }));
    search.click();
    const card = await waitForResult(station.name);
    card?.querySelector('.radio-play')?.click();
  }

  function card(station) {
    const logo = /^https:\/\//i.test(station.favicon || '')
      ? `<img src="${escapeHtml(station.favicon)}" alt="" loading="lazy" referrerpolicy="no-referrer" onerror="this.remove();this.parentElement.textContent='AK'"/>`
      : 'AK';
    return `<button class="v5-language-station v7-konkani-pick" type="button" data-v7-konkani="true">
      <div class="v5-radio-logo">${logo}</div>
      <span class="v5-language-station-copy"><span class="v5-live">LIVE · VERIFIED</span><strong>${escapeHtml(station.name)}</strong><small>India · Goa · Konkani music pick · ${escapeHtml(station.codec || 'audio')}${station.bitrate ? ` · ${station.bitrate}kbps` : ''}</small></span>
      <span class="v5-station-play" aria-hidden="true">▶</span>
    </button>`;
  }

  async function enforce() {
    const container = document.querySelector('#language-konkani');
    if (!container || working || container.querySelector('.v7-konkani-pick')) return;
    if (Date.now() - lastAppliedAt < 500) return;
    working = true;
    try {
      const response = await fetch('/api/radio?mode=search&q=AmchiKONKANI&limit=3', { headers: { Accept: 'application/json' } });
      if (!response.ok) return;
      const json = await response.json();
      const station = (json.stations || []).find(item => /amchikonkani/i.test(item.name || '') && item.auralis_verified);
      if (!station) return;
      container.innerHTML = card(station);
      lastAppliedAt = Date.now();
      container.querySelector('[data-v7-konkani]')?.addEventListener('click', () => play(station));
    } catch {
      // Existing regional fallback remains visible if the dedicated stream is down.
    } finally {
      working = false;
    }
  }

  const observer = new MutationObserver(() => setTimeout(enforce, 120));
  const start = () => {
    enforce();
    observer.observe(document.body, { childList: true, subtree: true });
  };

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start, { once: true });
  else start();
})();

// Progressive release chain: proven v7/v8 shell → Music Graph v9 → Full Playback v9.1 → UX Reliability v9.2.
import('./music-graph-v9.js')
  .then(() => import('./full-playback-v9-1.js'))
  .then(() => import('./ux-reliability-v9-2.js'))
  .catch(error => console.warn('Auralis Music Graph / Full Playback / UX Reliability did not start', error));