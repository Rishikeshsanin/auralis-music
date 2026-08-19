const KEY = 'auralis:v1';
const MAX_RECENT = 50;

const defaults = {
  liked: [],
  recent: [],
  volume: 0.8
};

function load() {
  try {
    return { ...defaults, ...JSON.parse(localStorage.getItem(KEY) || '{}') };
  } catch {
    return { ...defaults };
  }
}

let data = load();

function persist() {
  try { localStorage.setItem(KEY, JSON.stringify(data)); } catch {}
}

export const store = {
  get liked() { return data.liked || []; },
  get recent() { return data.recent || []; },
  get volume() { return Number.isFinite(data.volume) ? data.volume : .8; },
  isLiked(id) { return data.liked.some(t => t.id === id); },
  toggleLike(track) {
    const exists = data.liked.findIndex(t => t.id === track.id);
    if (exists >= 0) data.liked.splice(exists, 1);
    else data.liked.unshift(track);
    persist();
    return exists < 0;
  },
  addRecent(track) {
    data.recent = [track, ...data.recent.filter(t => t.id !== track.id)].slice(0, MAX_RECENT);
    persist();
  },
  setVolume(value) { data.volume = value; persist(); }
};
