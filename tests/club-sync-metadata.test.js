import test, { beforeEach } from "node:test";
import assert from "node:assert/strict";

import {
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
