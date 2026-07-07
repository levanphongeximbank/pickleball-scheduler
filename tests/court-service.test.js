import test, { beforeEach, afterEach } from "node:test";
import assert from "node:assert/strict";

import { setActiveClubId, DEFAULT_CLUB, saveClubs } from "../src/data/club.js";
import {
  getDefaultClubData,
  loadClubData,
  saveClubData,
  saveCourtsForClub,
} from "../src/domain/clubStorage.js";
import {
  filterCourtsByTenant,
  loadCourtsForVenue,
  loadCourtsForVenueScoped,
  loadCourtsForClubScoped,
} from "../src/domain/courtService.js";
import { normalizeCourt } from "../src/models/court.js";

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
  setActiveClubId(DEFAULT_CLUB.id);

  const clubs = [
    { id: "club-a", name: "CLB A", venueId: "venue-a" },
    { id: "club-b", name: "CLB B", venueId: "venue-b" },
    { id: "club-legacy", name: "CLB Legacy" },
  ];
  saveClubs(clubs);

  saveCourtsForClub(
    [normalizeCourt({ id: "c1", name: "Sân A1", active: true, tenantId: "venue-a" })],
    "club-a"
  );
  saveCourtsForClub(
    [normalizeCourt({ id: "c2", name: "Sân B1", active: true, tenantId: "venue-b" })],
    "club-b"
  );
  saveCourtsForClub(
    [normalizeCourt({ id: "c3", name: "Sân Legacy", active: true })],
    "club-legacy"
  );
});

afterEach(() => {
  delete globalThis.localStorage;
});

test("loadCourtsForVenue returns courts only for matching venue", () => {
  const courts = loadCourtsForVenue("venue-a");
  assert.equal(courts.length, 1);
  assert.equal(courts[0].id, "c1");
  assert.equal(courts[0].clubId, "club-a");
  assert.equal(courts[0].clubName, "CLB A");
});

test("loadCourtsForVenueScoped filters inactive courts", () => {
  saveCourtsForClub(
    [
      normalizeCourt({ id: "c1", name: "Sân A1", active: true, tenantId: "venue-a" }),
      normalizeCourt({ id: "c4", name: "Sân A2", active: false, tenantId: "venue-a" }),
    ],
    "club-a"
  );

  const courts = loadCourtsForVenueScoped("venue-a", "venue-a");
  assert.equal(courts.length, 1);
  assert.equal(courts[0].id, "c1");
});

test("loadCourtsForClubScoped returns empty for club outside tenant", () => {
  const courts = loadCourtsForClubScoped("club-b", "venue-a");
  assert.equal(courts.length, 0);
});

test("filterCourtsByTenant removes foreign tenant records", () => {
  const filtered = filterCourtsByTenant(
    [
      { id: "1", tenantId: "venue-a" },
      { id: "2", tenantId: "venue-b" },
      { id: "3" },
    ],
    "venue-a"
  );

  assert.deepEqual(
    filtered.map((item) => item.id),
    ["1", "3"]
  );
});
