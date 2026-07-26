import test from "node:test";
import assert from "node:assert/strict";

import {
  isCourtEngineCloudEnabled,
  isCourtEngineMigrated,
} from "../src/features/court-engine/storage/courtEngineCloudStore.js";
import {
  loadCourtEngineStore,
  saveCourtEngineStore,
} from "../src/features/court-engine/storage/courtEngineStorage.js";
import {
  __resetCourtRuntimeForTests,
  COURT_RUNTIME_AUTHORITY,
} from "../src/features/court-engine/runtime/index.js";

function memoryStorage() {
  const map = new Map();
  return {
    getItem(key) {
      return map.has(key) ? map.get(key) : null;
    },
    setItem(key, value) {
      map.set(key, String(value));
    },
    removeItem(key) {
      map.delete(key);
    },
    clear() {
      map.clear();
    },
  };
}

test("isCourtEngineCloudEnabled is false when authority is local", () => {
  __resetCourtRuntimeForTests({
    authority: COURT_RUNTIME_AUTHORITY.DEVELOPMENT_LOCAL,
  });
  assert.equal(isCourtEngineCloudEnabled(), false);
});

test("court engine store preserves cloudVersion on save in explicit local mode", () => {
  __resetCourtRuntimeForTests({
    authority: COURT_RUNTIME_AUTHORITY.DEVELOPMENT_LOCAL,
  });
  global.localStorage = memoryStorage();
  const result = saveCourtEngineStore(
    "club-1",
    {
      sessions: [],
      cloudVersion: 3,
    },
    { tenantId: "venue-1" }
  );

  assert.equal(result.ok, true);
  assert.equal(result.store.cloudVersion, 3);

  const loaded = loadCourtEngineStore("club-1", { tenantId: "venue-1" });
  assert.equal(loaded.cloudVersion, 3);
});

test("isCourtEngineMigrated reads migration flag", () => {
  global.localStorage = memoryStorage();
  assert.equal(isCourtEngineMigrated("club-1", "venue-1"), false);
  localStorage.setItem(
    "pickleball-court-engine-migrated-v1::venue-1::club-1",
    "2026-07-06"
  );
  assert.equal(isCourtEngineMigrated("club-1", "venue-1"), true);
});
