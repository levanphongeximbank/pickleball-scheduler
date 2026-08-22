import test, { beforeEach } from "node:test";
import assert from "node:assert/strict";

import {
  getClubDirtyProvenance,
  getClubSyncMeta,
  isClubDataDirty,
  markClubDataDirty,
  markClubDataSynced,
} from "../src/domain/clubSyncMetadata.js";

function createLocalStorageMock(seed = {}) {
  const store = new Map(Object.entries(seed));
  return {
    getItem(key) {
      return store.has(key) ? store.get(key) : null;
    },
    setItem(key, value) {
      store.set(key, String(value));
    },
    removeItem(key) {
      store.delete(key);
    },
    clear() {
      store.clear();
    },
  };
}

beforeEach(() => {
  globalThis.localStorage = createLocalStorageMock();
});

test("markClubDataDirty sets dirty flag", () => {
  markClubDataDirty("club-a");
  assert.equal(isClubDataDirty("club-a"), true);
  assert.ok(getClubSyncMeta("club-a").lastLocalSaveAt);
});

test("markClubDataSynced push clears dirty", () => {
  markClubDataDirty("club-a");
  markClubDataSynced("club-a", { push: true });
  assert.equal(isClubDataDirty("club-a"), false);
  assert.ok(getClubSyncMeta("club-a").lastPushAt);
});

test("markClubDataSynced pull clears dirty", () => {
  markClubDataDirty("club-a");
  markClubDataSynced("club-a", { pull: true });
  assert.equal(isClubDataDirty("club-a"), false);
  assert.ok(getClubSyncMeta("club-a").lastPullAt);
});

test("dirty provenance records source/operation and clears after sync", () => {
  markClubDataDirty("club-a", {
    reason: "club-blob-write",
    source: "local",
    operation: "saveClubData",
    pendingPushScheduled: true,
  });
  const dirty = getClubDirtyProvenance("club-a");
  assert.equal(dirty.dirty, true);
  assert.equal(dirty.dirtyReason, "club-blob-write");
  assert.equal(dirty.dirtySource, "local");
  assert.equal(dirty.dirtyOperation, "saveClubData");
  assert.equal(dirty.pendingPushScheduled, true);
  assert.ok(dirty.dirtyGeneration >= 1);
  markClubDataSynced("club-a", { push: true, version: 4 });
  const synced = getClubDirtyProvenance("club-a");
  assert.equal(synced.dirty, false);
  assert.equal(synced.pendingPushScheduled, false);
  assert.equal(synced.lastSuccessfulSyncVersion, 4);
});
