import test, { beforeEach } from "node:test";
import assert from "node:assert/strict";

import {
  loadCourtsFromStorage,
  loadInitialSelectedCourts,
  loadPlayersFromStorage,
} from "../src/pages/selectPlayers.data.js";
import { setActiveClubId } from "../src/data/club.js";
import { saveClubData, getDefaultClubData } from "../src/domain/clubStorage.js";

const CLUB_ID = "club-a";

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

test("loadCourtsFromStorage requires an explicit clubId", () => {
  assert.throws(() => loadCourtsFromStorage(), (err) => err.code === "CLUB_REQUIRED");
  assert.deepEqual(loadCourtsFromStorage(CLUB_ID), []);
});

test("loadCourtsFromStorage and loadPlayersFromStorage parse club blob arrays", () => {
  saveClubData(CLUB_ID, {
    ...getDefaultClubData(CLUB_ID),
    courts: [{ id: 1, name: "Sân 1", number: 1, active: true }],
    players: [{ id: 1, name: "A", gender: "Nam", level: 3, active: true }],
  });

  assert.equal(loadCourtsFromStorage(CLUB_ID).length, 1);
  assert.equal(loadPlayersFromStorage(CLUB_ID).length, 1);
});

test("loaders use the explicit club blob, not a hidden active-club lookup", () => {
  setActiveClubId("club-a");
  saveClubData("club-a", {
    ...getDefaultClubData("club-a"),
    courts: [{ id: 10, name: "Club A Court", number: 1, active: true }],
    players: [{ id: 10, name: "Club A Player", gender: "Nam", level: 3.5, active: true }],
  });
  saveClubData("default-club", {
    ...getDefaultClubData("default-club"),
    courts: [{ id: 1, name: "Legacy Court", number: 1, active: true }],
    players: [{ id: 1, name: "Legacy Player", gender: "Nam", level: 2.5, active: true }],
  });

  assert.equal(loadCourtsFromStorage("club-a")[0].id, 10);
  assert.equal(loadPlayersFromStorage("club-a")[0].id, 10);
});

test("loadInitialSelectedCourts keeps only active courts", () => {
  const selected = loadInitialSelectedCourts([
    { id: 1, active: true },
    { id: 2, active: false },
    { id: 3 },
  ]);

  assert.deepEqual(selected, [1, 3]);
});
