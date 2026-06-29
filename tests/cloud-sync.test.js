import test, { beforeEach } from "node:test";
import assert from "node:assert/strict";

import { pullAIDataFromCloud, syncAIDataToCloud } from "../src/ai/cloudSync.js";
import { setActiveClubId } from "../src/data/club.js";
import { loadAIData } from "../src/ai/storage.js";

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
  globalThis.localStorage = createLocalStorageMock({
    "pickleball-clubs-v1": JSON.stringify([
      { id: "default-club", name: "CLB Mac dinh" },
      { id: "club-b", name: "CLB B" },
    ]),
    "pickleball-active-club-v1": "default-club",
  });
});

test("syncAIDataToCloud and pullAIDataFromCloud isolate data by active club", async () => {
  localStorage.setItem(
    "pickleball-ai::default-club",
    JSON.stringify({
      schemaVersion: 1,
      history: { a: { games: 1, partners: {}, opponents: {} } },
      waiting: {},
      sessions: [{ id: 1 }],
      policies: [],
      rules: [],
    })
  );

  localStorage.setItem(
    "pickleball-ai::club-b",
    JSON.stringify({
      schemaVersion: 1,
      history: { b1: { games: 1, partners: {}, opponents: {} }, b2: { games: 2, partners: {}, opponents: {} } },
      waiting: {},
      sessions: [{ id: 10 }, { id: 11 }, { id: 12 }],
      policies: [{ id: 1 }],
      rules: [{ id: 1 }],
    })
  );

  let result = await syncAIDataToCloud();
  assert.equal(result.ok, true);
  assert.equal(result.clubId, "default-club");

  setActiveClubId("club-b");
  result = await syncAIDataToCloud();
  assert.equal(result.ok, true);
  assert.equal(result.clubId, "club-b");

  localStorage.setItem(
    "pickleball-ai::club-b",
    JSON.stringify({
      schemaVersion: 1,
      history: {},
      waiting: {},
      sessions: [],
      policies: [],
      rules: [],
    })
  );

  const pullResult = await pullAIDataFromCloud();
  assert.equal(pullResult.ok, true);
  assert.equal(pullResult.clubId, "club-b");

  const clubBData = loadAIData();
  assert.equal(clubBData.sessions.length, 3);
  assert.equal(Object.keys(clubBData.history).length, 2);

  setActiveClubId("default-club");
  const defaultData = loadAIData();
  assert.equal(defaultData.sessions.length, 1);
  assert.equal(Object.keys(defaultData.history).length, 1);
});

test("pullAIDataFromCloud returns error when no cloud snapshot for active club", async () => {
  const result = await pullAIDataFromCloud();

  assert.equal(result.ok, false);
  assert.equal(result.clubId, "default-club");
});
