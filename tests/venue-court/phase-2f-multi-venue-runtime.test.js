/**
 * Phase 2F — Multi-venue / multi-club runtime scope hardening.
 */
import assert from "node:assert/strict";
import { beforeEach, afterEach, describe, test } from "node:test";
import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { saveClubs } from "../../src/data/club.js";
import { saveVenues } from "../../src/data/venue.js";
import {
  saveCourtsForClub,
  loadCourtsForClub,
} from "../../src/domain/clubStorage.js";
import { normalizeCourt } from "../../src/models/court.js";
import { normalizeVenue } from "../../src/models/venue.js";
import {
  loadCourtsForClubScoped,
  loadCourtsForVenueScoped,
} from "../../src/domain/courtService.js";
import {
  getCourtAvailability,
  AVAILABILITY_REASON,
  __resetCourtAvailabilityDepsForTests,
} from "../../src/features/venue-court/services/courtAvailabilityService.js";
import {
  VENUE_COURT_SCOPE_ERROR,
  assertClubVenueScope,
  assertCourtOwnedByClub,
  filterCourtsToClubScope,
  applyClusterFilterOnly,
  __resetVenueCourtScopeDepsForTests,
  __setVenueCourtScopeDepsForTests,
} from "../../src/features/venue-court/services/venueCourtScopeService.js";
import {
  resolveVenueTimezoneForClub,
  CIVIL_TIME_ERROR,
} from "../../src/domain/civilTime.js";
import { resolveActiveClubSelection } from "../../src/features/club/context/clubCanonicalReadModel.js";
import { getPrimaryClubIdForTenant } from "../../src/features/tenant/services/tenantService.js";
import { createCourtSession } from "../../src/features/court-engine/models/courtSession.js";
import {
  performCourtLock,
  performCourtMaintenance,
} from "../../src/features/court-engine/services/courtEngineService.js";
import { saveCourtManagementSettings } from "../../src/domain/courtManagementSettings.js";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");

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

function seedTwoClubsSameVenue() {
  saveVenues([
    normalizeVenue({
      id: "venue-a",
      name: "Venue A",
      timezone: "Asia/Ho_Chi_Minh",
    }),
    normalizeVenue({
      id: "venue-b",
      name: "Venue B",
      timezone: "America/Los_Angeles",
    }),
  ]);
  saveClubs([
    { id: "club-a", name: "CLB A", venueId: "venue-a" },
    { id: "club-b", name: "CLB B", venueId: "venue-a" },
    { id: "club-c", name: "CLB C", venueId: "venue-b" },
  ]);
  saveCourtsForClub(
    [
      normalizeCourt({
        id: "court-a1",
        name: "A1",
        number: 1,
        active: true,
        status: "active",
        tenantId: "venue-a",
        clusterId: "cluster-1",
      }),
    ],
    "club-a"
  );
  saveCourtsForClub(
    [
      normalizeCourt({
        id: "court-b1",
        name: "B1",
        number: 1,
        active: true,
        status: "active",
        tenantId: "venue-a",
        clusterId: "cluster-2",
      }),
    ],
    "club-b"
  );
  saveCourtsForClub(
    [
      normalizeCourt({
        id: "court-c1",
        name: "C1",
        number: 1,
        active: true,
        status: "active",
        tenantId: "venue-b",
        clusterId: "cluster-3",
      }),
    ],
    "club-c"
  );
  saveCourtManagementSettings(
    { openHour: 6, closeHour: 22 },
    { clubId: "club-a" }
  );
  saveCourtManagementSettings(
    { openHour: 6, closeHour: 22 },
    { clubId: "club-b" }
  );
}

describe("Phase 2F multi-venue runtime", () => {
  let previousLocalStorage;

  beforeEach(() => {
    previousLocalStorage = globalThis.localStorage;
    globalThis.localStorage = createLocalStorageMock();
    __resetCourtAvailabilityDepsForTests();
    __resetVenueCourtScopeDepsForTests();
    seedTwoClubsSameVenue();
  });

  afterEach(() => {
    __resetCourtAvailabilityDepsForTests();
    __resetVenueCourtScopeDepsForTests();
    globalThis.localStorage = previousLocalStorage;
  });

  test("venue/club mismatch fails closed on availability", () => {
    assert.throws(
      () =>
        getCourtAvailability({
          clubId: "club-a",
          venueId: "venue-b",
          date: "2026-07-19",
          startTime: "10:00",
          endTime: "11:00",
        }),
      (error) => error?.code === AVAILABILITY_REASON.VENUE_MISMATCH
    );
  });

  test("venue/club mismatch fails closed on assertClubVenueScope", () => {
    const result = assertClubVenueScope({
      clubId: "club-a",
      venueId: "venue-b",
    });
    assert.equal(result.ok, false);
    assert.equal(result.code, VENUE_COURT_SCOPE_ERROR.VENUE_MISMATCH);
  });

  test("missing clubId does not invent a first club", () => {
    const result = assertClubVenueScope({ venueId: "venue-a" });
    assert.equal(result.ok, false);
    assert.equal(result.code, VENUE_COURT_SCOPE_ERROR.CLUB_SCOPE_MISSING);

    assert.throws(
      () =>
        getCourtAvailability({
          date: "2026-07-19",
          startTime: "10:00",
          endTime: "11:00",
        }),
      (error) => error?.code === AVAILABILITY_REASON.CLUB_SCOPE_MISSING
    );
  });

  test("resolveActiveClubSelection does not pick first of many", () => {
    const sel = resolveActiveClubSelection({
      preferredClubId: null,
      visibleClubs: [
        { id: "club-a" },
        { id: "club-b" },
      ],
    });
    assert.equal(sel.activeClubId, null);
  });

  test("getPrimaryClubIdForTenant returns null when multiple clubs", () => {
    assert.equal(getPrimaryClubIdForTenant("venue-a"), null);
  });

  test("getPrimaryClubIdForTenant returns the unique club", () => {
    assert.equal(getPrimaryClubIdForTenant("venue-b"), "club-c");
  });

  test("foreign courts cannot leak across clubs via club-scoped load", () => {
    const clubA = loadCourtsForClubScoped("club-a", "venue-a").map((c) => c.id);
    const clubB = loadCourtsForClubScoped("club-b", "venue-a").map((c) => c.id);
    assert.deepEqual(clubA, ["court-a1"]);
    assert.deepEqual(clubB, ["court-b1"]);
    assert.ok(!clubA.includes("court-b1"));
    assert.ok(!clubB.includes("court-a1"));
  });

  test("venue-union includes foreign clubs but filterCourtsToClubScope removes them", () => {
    const venueCourts = loadCourtsForVenueScoped("venue-a", "venue-a");
    assert.ok(venueCourts.some((c) => c.id === "court-a1"));
    assert.ok(venueCourts.some((c) => c.id === "court-b1"));

    const scoped = filterCourtsToClubScope(venueCourts, "club-a", {
      inventoryCourtIds: loadCourtsForClub("club-a").map((c) => c.id),
    });
    assert.deepEqual(
      scoped.map((c) => c.id),
      ["court-a1"]
    );
  });

  test("assertCourtOwnedByClub rejects foreign court", () => {
    const result = assertCourtOwnedByClub({
      clubId: "club-a",
      courtId: "court-b1",
      venueId: "venue-a",
    });
    assert.equal(result.ok, false);
    assert.equal(result.code, VENUE_COURT_SCOPE_ERROR.COURT_OUT_OF_SCOPE);
  });

  test("cluster filter does not grant ownership of foreign courts", () => {
    const venueCourts = loadCourtsForVenueScoped("venue-a", "venue-a");
    const filtered = applyClusterFilterOnly(venueCourts, "cluster-2");
    assert.ok(filtered.some((c) => c.id === "court-b1"));

    const ownership = assertCourtOwnedByClub({
      clubId: "club-a",
      courtId: "court-b1",
      clusterId: "cluster-2",
    });
    assert.equal(ownership.ok, false);
    assert.equal(ownership.code, VENUE_COURT_SCOPE_ERROR.COURT_OUT_OF_SCOPE);
  });

  test("Court Engine lock rejects court outside club inventory", () => {
    const session = createCourtSession({ clubId: "club-a", name: "2F" });
    const result = performCourtLock("club-a", session, "court-b1", true, {
      rbacEnabled: false,
    });
    assert.equal(result.ok, false);
    assert.equal(result.code, VENUE_COURT_SCOPE_ERROR.COURT_OUT_OF_SCOPE);
  });

  test("Court Engine lock accepts court inside club inventory", () => {
    const session = createCourtSession({ clubId: "club-a", name: "2F" });
    const result = performCourtLock("club-a", session, "court-a1", true, {
      rbacEnabled: false,
    });
    assert.equal(result.ok, true);
  });

  test("Court Engine maintenance rejects foreign court even with matching cluster", () => {
    const session = createCourtSession({ clubId: "club-a", name: "2F" });
    const result = performCourtMaintenance("club-a", session, "court-b1", true, {
      rbacEnabled: false,
      clusterId: "cluster-2",
    });
    assert.equal(result.ok, false);
    assert.equal(result.code, VENUE_COURT_SCOPE_ERROR.COURT_OUT_OF_SCOPE);
  });

  test("venue-specific timezone remains correct per club venue", () => {
    const hcm = resolveVenueTimezoneForClub("club-a");
    const la = resolveVenueTimezoneForClub("club-c");
    assert.equal(hcm.ok, true);
    assert.equal(hcm.timezone, "Asia/Ho_Chi_Minh");
    assert.equal(la.ok, true);
    assert.equal(la.timezone, "America/Los_Angeles");
  });

  test("missing club for timezone fails closed without inventing first club", () => {
    const result = resolveVenueTimezoneForClub(null);
    assert.equal(result.ok, false);
    assert.equal(result.code, CIVIL_TIME_ERROR.TIMEZONE_REQUIRED);
  });

  test("CE session inventory path stays club-scoped (no venue-union helper in hook)", () => {
    const hookSource = readFileSync(
      path.join(root, "src/features/court-engine/hooks/useCourtEngine.js"),
      "utf8"
    );
    assert.equal(hookSource.includes("loadCourtsForVenueScoped"), false);
    assert.equal(hookSource.includes("loadCourtsForClubScoped"), true);
    assert.match(
      hookSource,
      /Phase 2F: CE session is club-keyed/
    );
  });

  test("scope helpers ignore clusterId for ownership (deps override)", () => {
    __setVenueCourtScopeDepsForTests({
      loadClubs: () => [{ id: "club-a", venueId: "venue-a" }],
      loadCourtsForClub: () => [{ id: "court-a1" }],
    });
    const ok = assertCourtOwnedByClub({
      clubId: "club-a",
      courtId: "court-a1",
      clusterId: "any-cluster",
    });
    assert.equal(ok.ok, true);
    const bad = assertCourtOwnedByClub({
      clubId: "club-a",
      courtId: "foreign",
      clusterId: "any-cluster",
    });
    assert.equal(bad.ok, false);
  });
});
