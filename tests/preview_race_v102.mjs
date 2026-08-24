import assert from 'node:assert/strict';
import {
  PreviewOwnershipLifecycle,
  PreviewRequestLifecycle,
  previewExpiresSoon
} from '../js/preview-lifecycle-v10-2.mjs';

function deferred() {
  let resolve;
  const promise = new Promise(done => { resolve = done; });
  return { promise, resolve };
}

function createHarness() {
  let graph;
  let previewAudible = false;
  let restored = null;
  let restoreCount = 0;
  const events = [];
  const ownership = new PreviewOwnershipLifecycle({
    deactivate: ({ reason, emitCancelled }) => {
      previewAudible = false;
      graph.cancel(reason, { emit: emitCancelled });
    },
    restorePaused: session => {
      restoreCount += 1;
      restored = { ...session.interrupted, playing: false, paused: true };
    }
  });

  graph = new PreviewRequestLifecycle((phase, detail) => {
    events.push({ phase, requestId: detail.requestId, reason: detail.reason });
    if (phase === 'requested') ownership.requested(detail.requestId);
    else if (phase === 'started' && ownership.started(detail.requestId)) previewAudible = true;
    else if (['failed', 'cancelled', 'ended'].includes(phase) && ownership.accepts(detail.requestId)) {
      ownership.finish(detail.requestId, { restore: true, reason: phase });
    }
  });

  return {
    events,
    graph,
    ownership,
    get previewAudible() { return previewAudible; },
    get restored() { return restored; },
    get restoreCount() { return restoreCount; }
  };
}

const now = 1_800_000_000_000;
const expiringUrl = `https://preview.example/song.mp3?hdnea=exp=${Math.floor(now / 1000) + 10}~acl=/*~hmac=test`;
assert.equal(previewExpiresSoon(expiringUrl, now), true, 'test preview must take the delayed refresh path');

// A full track is interrupted in place while a near-expiry preview refresh is delayed.
const startHarness = createHarness();
const interruptedFull = { kind: 'full', title: 'Interrupted full song', playing: true, paused: false, currentTime: 41 };
interruptedFull.playing = false;
interruptedFull.paused = true;
startHarness.ownership.begin({ owner: 'full', interrupted: interruptedFull });
const refresh = deferred();
const requestId = startHarness.graph.request({ item: { previewUrl: expiringUrl }, sequence: false });
const delayedStart = (async () => {
  const refreshedItem = await refresh.promise;
  if (!startHarness.graph.isCurrent(requestId)) return false;
  return startHarness.graph.started(requestId, { item: refreshedItem, playing: true });
})();

await Promise.resolve();
assert.equal(startHarness.ownership.session?.phase, 'requested');
assert.equal(startHarness.restoreCount, 0, 'coordinator must not restore while refresh is pending');
assert.equal(startHarness.previewAudible, false);

refresh.resolve({ previewUrl: 'https://preview.example/fresh.mp3' });
assert.equal(await delayedStart, true);
assert.equal(startHarness.ownership.session?.phase, 'started');
assert.equal(startHarness.previewAudible, true, 'refreshed preview must become the sole audible owner');
assert.equal(interruptedFull.paused, true);

startHarness.graph.terminal(requestId, 'ended');
assert.equal(startHarness.previewAudible, false);
assert.equal(startHarness.restoreCount, 1);
assert.deepEqual(startHarness.restored, { ...interruptedFull, playing: false, paused: true });
assert.equal(startHarness.ownership.session, null);

// Starting a direct/radio/full owner while refresh is pending invalidates the request.
const cancelHarness = createHarness();
const interruptedDirect = { kind: 'direct', title: 'Original direct song', playing: true, paused: false, currentTime: 12 };
interruptedDirect.playing = false;
interruptedDirect.paused = true;
cancelHarness.ownership.begin({ owner: 'core', interrupted: interruptedDirect });
const cancelledRefresh = deferred();
const cancelledRequestId = cancelHarness.graph.request({ item: { previewUrl: expiringUrl } });
const cancelledStart = (async () => {
  const refreshedItem = await cancelledRefresh.promise;
  if (!cancelHarness.graph.isCurrent(cancelledRequestId)) return false;
  return cancelHarness.graph.started(cancelledRequestId, { item: refreshedItem, playing: true });
})();

assert.ok(cancelHarness.ownership.supersede('direct-playback'));
const replacementDirect = { kind: 'direct', title: 'Replacement direct song', playing: true, paused: false };
cancelledRefresh.resolve({ previewUrl: 'https://preview.example/must-not-play.mp3' });
assert.equal(await cancelledStart, false, 'stale refreshed preview must never start');
assert.equal(cancelHarness.previewAudible, false);
assert.equal(cancelHarness.restoreCount, 0, 'superseding playback must not restore the interrupted source');
assert.equal(cancelHarness.ownership.session, null);
assert.equal(replacementDirect.playing, true);
assert.ok(cancelHarness.events.some(event => event.phase === 'cancelled' && event.reason === 'direct-playback'));

// Rapid Preview clicks transfer the same interrupted session to the newest token.
const rapidHarness = createHarness();
rapidHarness.ownership.begin({ owner: 'core', interrupted: interruptedDirect });
const firstRapidId = rapidHarness.graph.request({ item: { previewUrl: expiringUrl } });
const secondRapidId = rapidHarness.graph.request({ item: { previewUrl: expiringUrl }, index: 1 });
assert.notEqual(firstRapidId, secondRapidId);
assert.equal(rapidHarness.graph.isCurrent(firstRapidId), false);
assert.equal(rapidHarness.ownership.session?.requestId, secondRapidId);
assert.equal(rapidHarness.restoreCount, 0);
assert.equal(rapidHarness.graph.started(firstRapidId, { playing: true }), false);
assert.equal(rapidHarness.graph.started(secondRapidId, { playing: true }), true);
assert.equal(rapidHarness.previewAudible, true);

console.log('Auralis v10.2 delayed preview ownership regression tests passed');
