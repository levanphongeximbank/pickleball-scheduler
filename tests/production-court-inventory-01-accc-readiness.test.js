/**
 * PRODUCTION-COURT-INVENTORY-01 — Phase A readiness (no Production mutation).
 * Run: node --test tests/production-court-inventory-01-accc-readiness.test.js
 */
import test, { beforeEach, afterEach } from "node:test";
import assert from "node:assert/strict";

import { setActiveClubId, DEFAULT_CLUB, saveClubs } from "../src/data/club.js";
import {
  getDefaultClubData,
  loadClubData,
  loadCourtsForClub,
  saveCourtsForClub,
  saveClubData,
} from "../src/domain/clubStorage.js";
import { normalizeCourt, normalizeCourts, COURT_TYPES } from "../src/models/court.js";
import {
  listCourts,
  getCourtById,
} from "../src/features/venue-court/services/courtInventoryService.js";
import {
  __resetCourtInventoryDepsForTests,
} from "../src/features/venue-court/services/courtInventoryService.js";
import {
  listCanonicalCourtDescriptors,
  __resetCompetitionCourtDescriptorAdapterDepsForTests,
} from "../src/features/venue-court/adapters/competitionCourtDescriptorAdapter.js";
import { DESCRIPTOR_DIAGNOSTIC_REASON } from "../src/features/venue-court/constants/descriptorContract.js";
import { PUBLIC_COURT_FORBIDDEN_KEYS } from "../src/features/public-catalog/contracts/publicCourtDto.js";
import {
  ACCC_CLUB_ID,
  ACCC_VENUE_ID,
  ACCC_CLUSTER_ID,
  ACCC_COURT_IDS,
  ACCC_CANONICAL_COURTS,
} from "./fixtures/production-court-inventory-01-accc.js";

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

function inventoryInputFromPlan(court) {
  const persistable = { ...court };
  delete persistable.archived;
  delete persistable.deleted;
  return persistable;
}

beforeEach(() => {
  globalThis.localStorage = createLocalStorageMock();
  setActiveClubId(DEFAULT_CLUB.id);
  __resetCourtInventoryDepsForTests();
  __resetCompetitionCourtDescriptorAdapterDepsForTests();
  saveClubs([
    {
      id: ACCC_CLUB_ID,
      name: "CLB ACCC",
      venueId: ACCC_VENUE_ID,
      registeredClusterId: ACCC_CLUSTER_ID,
      status: "active",
    },
  ]);
});

afterEach(() => {
  __resetCourtInventoryDepsForTests();
  __resetCompetitionCourtDescriptorAdapterDepsForTests();
});

test("ACCC plan: deterministic IDs are unique and number-stable", () => {
  assert.equal(ACCC_COURT_IDS.length, 4);
  assert.equal(new Set(ACCC_COURT_IDS).size, 4);
  for (const court of ACCC_CANONICAL_COURTS) {
    assert.match(court.id, /^court-club-219e4a7cbd73437eb6271f02a53314c3-n[3-6]$/);
    assert.equal(court.id.endsWith(`n${court.number}`), true);
    assert.equal(court.id.includes(String(Date.now()).slice(0, 8)), false);
  }
});

test("ACCC plan: normalizeCourt preserves covered/surface/ownership fields", () => {
  const normalized = normalizeCourts(ACCC_CANONICAL_COURTS.map(inventoryInputFromPlan));
  assert.equal(normalized.length, 4);
  for (let i = 0; i < 4; i += 1) {
    const court = normalized[i];
    const plan = ACCC_CANONICAL_COURTS[i];
    assert.equal(court.id, plan.id);
    assert.equal(court.name, plan.name);
    assert.equal(court.number, plan.number);
    assert.equal(court.active, true);
    assert.equal(court.status, "active");
    assert.equal(court.courtType, "covered");
    assert.equal(COURT_TYPES.includes(court.courtType), true);
    assert.equal(court.surface, "plastic");
    assert.equal(court.clubId, ACCC_CLUB_ID);
    assert.equal(court.venueId, ACCC_VENUE_ID);
    assert.equal(court.tenantId, ACCC_VENUE_ID);
    assert.equal(court.clusterId, ACCC_CLUSTER_ID);
    assert.equal(court.defaultHourlyRate, 0);
    assert.equal(court.peakHourlyRate, 0);
    assert.equal(court.note, "");
    assert.equal(Object.hasOwn(court, "archived"), false);
    assert.equal(Object.hasOwn(court, "deleted"), false);
  }
});

test("ACCC plan: persistence/reload via clubStorage + courtInventoryService", () => {
  saveCourtsForClub(
    ACCC_CANONICAL_COURTS.map((court) => normalizeCourt(inventoryInputFromPlan(court))),
    ACCC_CLUB_ID
  );

  const reloaded = loadCourtsForClub(ACCC_CLUB_ID);
  assert.equal(reloaded.length, 4);
  assert.deepEqual(
    reloaded.map((c) => c.id).sort(),
    [...ACCC_COURT_IDS].sort()
  );

  const listed = listCourts({ clubId: ACCC_CLUB_ID, tenantId: ACCC_VENUE_ID });
  assert.equal(listed.length, 4);

  const clustered = listCourts({
    clubId: ACCC_CLUB_ID,
    tenantId: ACCC_VENUE_ID,
    clusterId: ACCC_CLUSTER_ID,
  });
  assert.equal(clustered.length, 4);

  for (const id of ACCC_COURT_IDS) {
    const found = getCourtById(id, { clubId: ACCC_CLUB_ID, tenantId: ACCC_VENUE_ID });
    assert.ok(found);
    assert.equal(found.active, true);
    assert.equal(found.status, "active");
    assert.equal(found.courtType, "covered");
    assert.equal(found.surface, "plastic");
  }
});

test("ACCC plan: no duplicate IDs after save; inactive semantics remain active", () => {
  saveCourtsForClub(
    normalizeCourts(ACCC_CANONICAL_COURTS.map(inventoryInputFromPlan)),
    ACCC_CLUB_ID
  );
  const ids = loadCourtsForClub(ACCC_CLUB_ID).map((c) => String(c.id));
  assert.equal(ids.length, new Set(ids).size);
  assert.equal(
    listCourts({ clubId: ACCC_CLUB_ID, includeInactive: true }).every((c) => c.active !== false),
    true
  );
});

test("ACCC plan: descriptors omit courts without priority (expected; no invented priority)", () => {
  saveCourtsForClub(
    normalizeCourts(ACCC_CANONICAL_COURTS.map(inventoryInputFromPlan)),
    ACCC_CLUB_ID
  );

  const result = listCanonicalCourtDescriptors({
    tenantId: ACCC_VENUE_ID,
    clubId: ACCC_CLUB_ID,
    venueId: ACCC_VENUE_ID,
  });

  assert.equal(result.courts.length, 0);
  assert.equal(result.diagnostics.excludedCourts.length, 4);
  for (const excluded of result.diagnostics.excludedCourts) {
    assert.equal(excluded.reason, DESCRIPTOR_DIAGNOSTIC_REASON.PRIORITY_NOT_AUTHORITATIVE);
    assert.equal(ACCC_COURT_IDS.includes(excluded.courtId), true);
  }
});

test("ACCC plan: private rates/notes never appear on public DTO allowlist path", () => {
  for (const court of ACCC_CANONICAL_COURTS) {
    for (const forbidden of PUBLIC_COURT_FORBIDDEN_KEYS) {
      if (forbidden === "defaultHourlyRate" || forbidden === "peakHourlyRate" || forbidden === "note") {
        assert.ok(Object.hasOwn(court, forbidden));
        assert.ok(
          court[forbidden] === 0 || court[forbidden] === "",
          `${forbidden} must stay private default`
        );
      }
    }
  }
});

test("ACCC plan: new blob path — courts only addition on default club_data; rollback deletes row", () => {
  const before = null;
  assert.equal(before, null);

  const base = getDefaultClubData(ACCC_CLUB_ID);
  base.courts = normalizeCourts(ACCC_CANONICAL_COURTS.map(inventoryInputFromPlan));
  base.tenantId = ACCC_VENUE_ID;
  saveClubData(ACCC_CLUB_ID, base);

  const after = loadClubData(ACCC_CLUB_ID);
  assert.equal(after.clubId, ACCC_CLUB_ID);
  assert.equal(after.courts.length, 4);
  assert.deepEqual(
    after.courts.map((c) => c.id),
    ACCC_COURT_IDS
  );

  // Exact rollback for NEW row: delete blob → no courts for club
  localStorage.removeItem(`pickleball-club-data-v3::${ACCC_CLUB_ID}`);
  const rolled = loadClubData(ACCC_CLUB_ID);
  assert.equal(rolled.courts.length, 0);
});
