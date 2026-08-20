const PLAYABLE_ROW_SELECTOR = '.track-row';
const PLAY_TARGET_SELECTOR = '.row-title';

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

const style = document.createElement('style');
style.textContent = `
  .row-title[data-play-target-ready="true"] {
    cursor: pointer;
    border-radius: 9px;
    transition: background .16s ease, transform .16s ease;
  }
  .row-title[data-play-target-ready="true"]:hover {
    background: rgba(255,255,255,.035);
  }
  .row-title[data-play-target-ready="true"]:active {
    transform: translateY(1px);
  }
  .row-title[data-play-target-ready="true"]:focus-visible {
    outline: 2px solid var(--accent-2, #65d2ff);
    outline-offset: 3px;
  }
`;
document.head.append(style);

document.addEventListener('click', event => {
  const target = event.target.closest?.(PLAY_TARGET_SELECTOR);
  if (!target) return;
  const row = target.closest(PLAYABLE_ROW_SELECTOR);
  if (!row) return;
  playRow(row);
});

document.addEventListener('keydown', event => {
  const target = event.target.closest?.(PLAY_TARGET_SELECTOR);
  if (!target || (event.key !== 'Enter' && event.key !== ' ')) return;
  const row = target.closest(PLAYABLE_ROW_SELECTOR);
  if (!row) return;
  event.preventDefault();
  playRow(row);
});

decoratePlayTargets();

new MutationObserver(mutations => {
  for (const mutation of mutations) {
    for (const node of mutation.addedNodes) {
      if (!(node instanceof Element)) continue;
      if (node.matches?.(PLAY_TARGET_SELECTOR)) decoratePlayTargets(node.parentElement || document);
      else if (node.querySelector?.(PLAY_TARGET_SELECTOR)) decoratePlayTargets(node);
    }
  }
}).observe(document.body, { childList: true, subtree: true });
