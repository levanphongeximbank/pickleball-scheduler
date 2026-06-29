import test, { beforeEach } from "node:test";
import assert from "node:assert/strict";

import {
  loadCourtsFromStorage,
  loadInitialSelectedCourts,
  loadPlayersFromStorage,
} from "../src/pages/selectPlayers.data.js";
import { setActiveClubId } from "../src/data/club.js";

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

test("loadCourtsFromStorage returns empty array for missing or invalid data", () => {
  assert.deepEqual(loadCourtsFromStorage(), []);

  globalThis.localStorage = createLocalStorageMock({
    courts: "not-json",
  });

  assert.deepEqual(loadCourtsFromStorage(), []);
});

test("loadCourtsFromStorage and loadPlayersFromStorage parse valid arrays", () => {
  globalThis.localStorage = createLocalStorageMock({
    courts: JSON.stringify([{ id: 1, name: "Sân 1", active: true }]),
    players: JSON.stringify([{ id: 1, name: "A", level: 3 }]),
  });

  assert.equal(loadCourtsFromStorage().length, 1);
  assert.equal(loadPlayersFromStorage().length, 1);
});

test("loaders prefer active club scoped keys over legacy keys", () => {
  globalThis.localStorage = createLocalStorageMock({
    "pickleball-clubs-v1": JSON.stringify([
      { id: "default-club", name: "CLB Mac dinh" },
      { id: "club-a", name: "CLB A" },
    ]),
    "pickleball-active-club-v1": "club-a",
    courts: JSON.stringify([{ id: 1, name: "Legacy Court", active: true }]),
    players: JSON.stringify([{ id: 1, name: "Legacy Player", level: 2.5 }]),
    "courts::club-a": JSON.stringify([{ id: 10, name: "Club A Court", active: true }]),
    "players::club-a": JSON.stringify([{ id: 10, name: "Club A Player", level: 3.5 }]),
  });

  setActiveClubId("club-a");

  assert.equal(loadCourtsFromStorage()[0].id, 10);
  assert.equal(loadPlayersFromStorage()[0].id, 10);
});

test("loadInitialSelectedCourts keeps only active courts", () => {
  const selected = loadInitialSelectedCourts([
    { id: 1, active: true },
    { id: 2, active: false },
    { id: 3 },
  ]);

  assert.deepEqual(selected, [1, 3]);
});
