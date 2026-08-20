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

test("loadClubs does not fabricate default-club when storage is empty", () => {
  const clubs = loadClubs();

  assert.deepEqual(clubs, []);
  assert.equal(getActiveClubId(), null);
  assert.equal(getActiveClub(), null);
});

test("addClub creates a new club and allows switching active club preference", () => {
  const result = addClub("CLB Thu Bay");

  assert.equal(result.ok, true);
  assert.equal(setActiveClubId(result.club.id), true);
  assert.equal(getActiveClubId(), result.club.id);
  assert.equal(getActiveClub().name, "CLB Thu Bay");
});

test("removeClub rejects deleting default identity and clears preference when removing current club", () => {
  const result = addClub("CLB Test");
  assert.equal(result.ok, true);

  setActiveClubId(result.club.id);
  const removeDefaultResult = removeClub(DEFAULT_CLUB.id);
  assert.equal(removeDefaultResult.ok, false);

  const removeResult = removeClub(result.club.id);
  assert.equal(removeResult.ok, true);
  assert.equal(getActiveClubId(), null);
});

test("getScopedStorageKey requires an explicit club id", () => {
  assert.throws(() => getScopedStorageKey("players"), (err) =>
    String(err?.message || "").includes("CLUB_REQUIRED")
  );
  assert.equal(getScopedStorageKey("players", "club-a"), "players::club-a");
});
