import test from "node:test";
import assert from "node:assert/strict";

import {
  buildCourtEngineStorageKey,
  exportCourtEngineStore,
  importCourtEngineStore,
  loadCourtEngineStore,
  saveCourtEngineStore,
} from "../src/features/court-engine/storage/courtEngineStorage.js";
import { createCourtSession } from "../src/features/court-engine/models/courtSession.js";

const memoryStorage = () => {
  const map = new Map();
  return {
    getItem(key) {
      return map.has(key) ? map.get(key) : null;
    },
    setItem(key, value) {
      map.set(key, value);
    },
    removeItem(key) {
      map.delete(key);
    },
    clear() {
      map.clear();
    },
  };
};

test("court engine storage — tenant A cannot read tenant B data", () => {
  const storage = memoryStorage();
  global.localStorage = storage;

  const sessionA = createCourtSession({ clubId: "club-1", name: "Tenant A session" });
  saveCourtEngineStore("club-1", { sessions: [sessionA] }, { tenantId: "tenant-a" });

  const tenantBView = loadCourtEngineStore("club-1", { tenantId: "tenant-b" });
  assert.equal(tenantBView.sessions.length, 0);

  const tenantAView = loadCourtEngineStore("club-1", { tenantId: "tenant-a" });
  assert.equal(tenantAView.sessions.length, 1);
  assert.equal(tenantAView.sessions[0].name, "Tenant A session");
});

test("court engine storage — reload keeps data for same tenant", () => {
  const storage = memoryStorage();
  global.localStorage = storage;

  const session = createCourtSession({ clubId: "club-2", name: "Persist" });
  saveCourtEngineStore("club-2", { sessions: [session] }, { tenantId: "venue-1" });

  const reloaded = loadCourtEngineStore("club-2", { tenantId: "venue-1" });
  assert.equal(reloaded.sessions.length, 1);
  assert.equal(reloaded.tenantId, "venue-1");
});

test("court engine storage — empty store does not crash without season/league", () => {
  const storage = memoryStorage();
  global.localStorage = storage;

  const empty = loadCourtEngineStore("club-missing", { tenantId: "venue-x" });
  assert.equal(empty.sessions.length, 0);
  assert.equal(empty.clubId, "club-missing");
});

test("court engine storage — scoped key format includes tenant", () => {
  const key = buildCourtEngineStorageKey("club-9", "venue-9");
  assert.match(key, /pickleball-court-engine-v1::venue-9::club-9/);
});

test("court engine storage — export/import backup roundtrip", () => {
  const storage = memoryStorage();
  global.localStorage = storage;

  const session = createCourtSession({ clubId: "club-3", name: "Backup" });
  saveCourtEngineStore("club-3", { sessions: [session] }, { tenantId: "venue-3" });

  const exported = exportCourtEngineStore("club-3", { tenantId: "venue-3" });
  assert.equal(exported.ok, true);
  assert.equal(exported.store.sessions.length, 1);

  storage.clear();
  const afterClear = loadCourtEngineStore("club-3", { tenantId: "venue-3" });
  assert.equal(afterClear.sessions.length, 0);

  importCourtEngineStore("club-3", exported, { tenantId: "venue-3" });

  const restored = loadCourtEngineStore("club-3", { tenantId: "venue-3" });
  assert.equal(restored.sessions.length, 1);
});
