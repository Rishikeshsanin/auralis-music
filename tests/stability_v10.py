from pathlib import Path

root = Path(__file__).resolve().parents[1]
manager = (root / 'js/update-manager-v10.js').read_text()
sw = (root / 'sw.js').read_text()
konkani = (root / 'js/konkani-radio-v7.js').read_text()
recovery = (root / 'js/playback-recovery-v9-2-1.js').read_text()
ux = (root / 'js/ux-reliability-v9-2.js').read_text()
store = (root / 'js/store.js').read_text()
graph = (root / 'js/music-graph-v9.js').read_text()
row = (root / 'js/row-play-targets.js').read_text()
aura = (root / 'js/auralis-experience-v7.js').read_text()

# Update manager / returning-user migration.
assert "const VERSION = '10.0.0'" in manager
assert "const WORKER_VERSION = '18'" in manager
assert "AURALIS_VERSION" in manager and "SKIP_WAITING" in manager
assert "updateViaCache: 'none'" in manager
assert "navigator.serviceWorker.getRegistrations" in manager
assert "caches.keys()" in manager and "caches.delete(name)" in manager
assert "auralis-shell-" in manager and "auralis-runtime-" in manager
assert "DIRECT_APP_BOOT" in manager, 'manager must not start a second app instance while the legacy direct shell still exists'
assert "APP_URL" in manager and "ROW_TARGETS_URL" in manager and "CURRENT_SCRIPT" in manager, 'runtime assets need explicit stable URL resolution'
assert "isPlaybackActive" in manager and "showUpdateBanner" in manager, 'future worker activation must respect active playback'
assert "controllerchange" in manager and "RELOAD_KEY" in manager, 'controlled one-time reload handoff missing'
assert "import('./update-manager-v10.js')" in konkani, 'stability manager must boot in the current direct-shell architecture'

# User data must never be wiped by runtime migration.
for forbidden in [
    'localStorage.clear(',
    'sessionStorage.clear(',
    'indexedDB.deleteDatabase(',
    "removeItem('auralis:v1'",
    'removeItem("auralis:v1"',
    "removeItem('auralis:playlists:v2'",
    "removeItem('auralis:graph-likes:v1'",
    "removeItem('auralis:guest-profile:v1'",
    "removeItem('auralis:experience-v7'",
]:
    assert forbidden not in manager, f'update manager must preserve user state: {forbidden}'

# Verify the known persistent keys still exist in their owning modules.
assert "const KEY = 'auralis:v1'" in store
assert "const PLAYLIST_KEY = 'auralis:playlists:v2'" in graph
assert "const GRAPH_LIKES_KEY = 'auralis:graph-likes:v1'" in graph
assert "const PROFILE_KEY = 'auralis:guest-profile:v1'" in row
assert "const PREF_KEY = 'auralis:experience-v7'" in aura

# Worker v18: no cache-first runtime mixing and no normal install takeover.
assert "const WORKER_VERSION = '18'" in sw
assert "const CACHE = 'auralis-runtime-v18'" in sw
assert "LEGACY_SHELL_PREFIX = 'auralis-shell-'" in sw
assert "destination === 'script'" in sw and "destination === 'style'" in sw
assert "event.respondWith(networkFirst(request))" in sw
assert "request.mode === 'navigate'" in sw and "networkFirst(request, OFFLINE_FALLBACK)" in sw
assert "url.pathname.startsWith('/api/')" in sw and "event.respondWith(fetch(request))" in sw
assert "type === 'AURALIS_VERSION'" in sw and "version: WORKER_VERSION" in sw
assert "type === 'SKIP_WAITING'" in sw
assert "if (legacyShell)" in sw and "await self.skipWaiting()" in sw, 'only legacy shell migration may force one-time activation'
normal_install_tail = sw.split("if (legacyShell)", 1)[1]
assert "Normal v18+ updates do NOT call skipWaiting" in normal_install_tail
assert "reloadLegacyClientsOnce" in sw and "auralis-sw-migrated" in sw, 'legacy users need an automatic one-time clean reload'
assert "self.clients.claim()" in sw

# Observer hardening from freeze investigations.
assert "attributeFilter: ['class']" in ux
assert 'maintenanceQueued' in ux and 'requestAnimationFrame(runMaintenance)' in ux
assert 'new MutationObserver' not in recovery, 'recovery observer was redundant and must stay removed'
assert 'let enforceTimer = null' in konkani and 'function scheduleEnforce()' in konkani, 'Konkani observer callbacks must be coalesced'
assert "new MutationObserver(scheduleEnforce)" in konkani

print('Auralis Stability v10 static regression tests passed')
