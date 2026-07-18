import test, { beforeEach, afterEach } from "node:test";
import assert from "node:assert/strict";

import { setActiveClubId, DEFAULT_CLUB, saveClubs } from "../../src/data/club.js";
import { saveCourtsForClub } from "../../src/domain/clubStorage.js";
import {
  loadCourtsForClubScoped,
  loadCourtsForVenue,
  loadCourtsForVenueScoped,
} from "../../src/domain/courtService.js";
import { normalizeCourt } from "../../src/models/court.js";
import {
  listCourts,
  getCourtById,
} from "../../src/features/venue-court/index.js";
import {
  __resetCourtInventoryDepsForTests,
  __setCourtInventoryDepsForTests,
} from "../../src/features/venue-court/services/courtInventoryService.js";

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
  __resetCourtInventoryDepsForTests();

  saveClubs([
    { id: "club-a", name: "CLB A", venueId: "venue-a" },
    { id: "club-b", name: "CLB B", venueId: "venue-b" },
  ]);

  saveCourtsForClub(
    [
      normalizeCourt({
        id: "c1",
        name: "Sân A1",
        active: true,
        status: "active",
        tenantId: "venue-a",
        clusterId: "cluster-a",
        defaultHourlyRate: 100,
      }),
      normalizeCourt({
        id: "c-inactive",
        name: "Sân A2",
        active: false,
        status: "locked",
        tenantId: "venue-a",
        clusterId: "cluster-b",
      }),
    ],
    "club-a"
  );

  saveCourtsForClub(
    [
      normalizeCourt({
        id: "c2",
        name: "Sân B1",
        active: true,
        tenantId: "venue-b",
      }),
    ],
    "club-b"
  );
});

afterEach(() => {
  __resetCourtInventoryDepsForTests();
  delete globalThis.localStorage;
});

test("listCourts requires clubId or venueId", () => {
  assert.throws(() => listCourts({}), /requires clubId or venueId/);
});

test("listCourts delegates club scope to legacy courtService (active only)", () => {
  const legacy = loadCourtsForClubScoped("club-a", "venue-a");
  const facade = listCourts({ clubId: "club-a", tenantId: "venue-a" });

  assert.equal(facade.length, legacy.length);
  assert.deepEqual(
    facade.map((court) => court.id),
    legacy.map((court) => court.id)
  );
  assert.equal(facade.length, 1);
  assert.equal(facade[0].id, "c1");
});

test("listCourts preserves existing court fields", () => {
  const [court] = listCourts({ clubId: "club-a", tenantId: "venue-a" });

  assert.equal(court.id, "c1");
  assert.equal(court.name, "Sân A1");
  assert.equal(court.active, true);
  assert.equal(court.status, "active");
  assert.equal(court.clusterId, "cluster-a");
  assert.equal(court.tenantId, "venue-a");
  assert.equal(court.defaultHourlyRate, 100);
});

test("listCourts returns empty array for empty inventory when load succeeds", () => {
  saveCourtsForClub([], "club-a");
  const courts = listCourts({ clubId: "club-a", tenantId: "venue-a" });
  assert.deepEqual(courts, []);
});

test("listCourts does not turn data-loading errors into empty lists", () => {
  __setCourtInventoryDepsForTests({
    loadCourtsForClubScoped() {
      throw new Error("storage unavailable");
    },
  });

  assert.throws(
    () => listCourts({ clubId: "club-a", tenantId: "venue-a" }),
    (error) => {
      assert.equal(error.message, "Failed to load court inventory");
      assert.equal(error.cause?.message, "storage unavailable");
      return true;
    }
  );
});

test("listCourts venue scope matches legacy loadCourtsForVenueScoped", () => {
  const legacy = loadCourtsForVenueScoped("venue-a", "venue-a");
  const facade = listCourts({ venueId: "venue-a", tenantId: "venue-a" });

  assert.deepEqual(
    facade.map((court) => court.id),
    legacy.map((court) => court.id)
  );
});

test("listCourts includeInactive on venue returns inactive courts", () => {
  const legacy = loadCourtsForVenue("venue-a");
  const facade = listCourts({ venueId: "venue-a", includeInactive: true });

  assert.ok(facade.some((court) => court.id === "c-inactive"));
  assert.deepEqual(
    facade.map((court) => court.id).sort(),
    legacy.map((court) => court.id).sort()
  );
});

test("listCourts includeInactive on club returns inactive courts", () => {
  const facade = listCourts({
    clubId: "club-a",
    tenantId: "venue-a",
    includeInactive: true,
  });

  assert.equal(facade.length, 2);
  assert.ok(facade.some((court) => court.id === "c-inactive"));
});

test("listCourts filters by clusterId when provided", () => {
  const facade = listCourts({
    clubId: "club-a",
    tenantId: "venue-a",
    includeInactive: true,
    clusterId: "cluster-a",
  });

  assert.equal(facade.length, 1);
  assert.equal(facade[0].id, "c1");
});

test("getCourtById returns matching court", () => {
  const court = getCourtById("c1", { clubId: "club-a", tenantId: "venue-a" });
  assert.equal(court?.id, "c1");
  assert.equal(court?.name, "Sân A1");
});

test("getCourtById returns null when not found", () => {
  const court = getCourtById("missing", { clubId: "club-a", tenantId: "venue-a" });
  assert.equal(court, null);
});

test("consumer mutation does not change subsequent inventory reads", () => {
  const first = listCourts({ clubId: "club-a", tenantId: "venue-a" });
  first[0].name = "MUTATED";
  first.push({ id: "injected" });

  const second = listCourts({ clubId: "club-a", tenantId: "venue-a" });
  assert.equal(second.length, 1);
  assert.equal(second[0].name, "Sân A1");
  assert.equal(second[0].id, "c1");
});
