import test, { afterEach, beforeEach } from "node:test";
import assert from "node:assert/strict";

import {
  DEFAULT_CLUB,
  addClub,
  getActiveClub,
  getActiveClubId,
  getScopedStorageKey,
  loadClubs,
  removeClub,
  setActiveClubId,
} from "../src/data/club.js";

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

let originalDateNow;

beforeEach(() => {
  globalThis.localStorage = createLocalStorageMock();
  originalDateNow = Date.now;
  Date.now = () => 12345;
});

afterEach(() => {
  Date.now = originalDateNow;
});

test("loadClubs seeds default club when storage is empty", () => {
  const clubs = loadClubs();

  assert.equal(clubs.length, 1);
  assert.equal(clubs[0].id, DEFAULT_CLUB.id);
  assert.equal(getActiveClubId(), DEFAULT_CLUB.id);
});

test("addClub creates a new club and allows switching active club", () => {
  const result = addClub("CLB Thu Bay");

  assert.equal(result.ok, true);
  assert.equal(setActiveClubId(result.club.id), true);
  assert.equal(getActiveClubId(), result.club.id);
  assert.equal(getActiveClub().name, "CLB Thu Bay");
});

test("removeClub rejects deleting default and resets active when removing current club", () => {
  const result = addClub("CLB Test");
  assert.equal(result.ok, true);

  setActiveClubId(result.club.id);
  const removeDefaultResult = removeClub(DEFAULT_CLUB.id);
  assert.equal(removeDefaultResult.ok, false);

  const removeResult = removeClub(result.club.id);
  assert.equal(removeResult.ok, true);
  assert.equal(getActiveClubId(), DEFAULT_CLUB.id);
});

test("getScopedStorageKey uses active club and accepts explicit club id", () => {
  assert.equal(getScopedStorageKey("players"), `players::${DEFAULT_CLUB.id}`);
  assert.equal(getScopedStorageKey("players", "club-a"), "players::club-a");
});
