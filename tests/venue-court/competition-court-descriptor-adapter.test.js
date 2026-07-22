/**
 * Phase 3B — listCanonicalCourtDescriptors contract tests.
 */
import test, { beforeEach, afterEach } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { setActiveClubId, DEFAULT_CLUB, saveClubs } from "../../src/data/club.js";
import { saveCourtsForClub } from "../../src/domain/clubStorage.js";
import { normalizeCourt } from "../../src/models/court.js";
import {
  listCanonicalCourtDescriptors,
  __resetCompetitionCourtDescriptorAdapterDepsForTests,
  __setCompetitionCourtDescriptorAdapterDepsForTests,
} from "../../src/features/venue-court/adapters/competitionCourtDescriptorAdapter.js";
import {
  listCanonicalCourtDescriptors as getFromIndex,
  DESCRIPTOR_AUTHORITY,
  SOURCE_CONTRACT_VERSION,
  DESCRIPTOR_DIAGNOSTIC_REASON,
  DESCRIPTOR_ERROR,
} from "../../src/features/venue-court/index.js";
import { getCompetitionCourtAvailability } from "../../src/features/venue-court/adapters/competitionCourtAvailabilityAdapter.js";
import { saveCourtManagementSettings } from "../../src/domain/courtManagementSettings.js";
import { saveBookingsForClub } from "../../src/domain/clubStorage.js";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const adapterPath = path.join(
  root,
  "src/features/venue-court/adapters/competitionCourtDescriptorAdapter.js"
);
const constantsPath = path.join(
  root,
  "src/features/venue-court/constants/descriptorContract.js"
);

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

function baseCourt(overrides = {}) {
  return {
    id: "c1",
    name: "Sân 1",
    number: 1,
    active: true,
    status: "active",
    tenantId: "venue-a",
    clusterId: "cluster-a",
    priority: 10,
    ...overrides,
  };
}

function seedClubs() {
  saveClubs([
    { id: "club-a", name: "CLB A", venueId: "venue-a" },
    { id: "club-b", name: "CLB B", venueId: "venue-a" },
    { id: "club-c", name: "CLB C", venueId: "venue-b" },
  ]);
}

function seedNormalizedInventory() {
  seedClubs();
  saveCourtsForClub(
    [
      normalizeCourt({
        id: "c1",
        name: "Sân 1",
        number: 1,
        active: true,
        status: "active",
        tenantId: "venue-a",
        clusterId: "cluster-a",
      }),
      normalizeCourt({
        id: "c2",
        name: "Sân 2",
        number: 2,
        active: true,
        status: "active",
        tenantId: "venue-a",
        clusterId: "cluster-a",
      }),
    ],
    "club-a"
  );
  saveBookingsForClub([], "club-a");
  saveCourtManagementSettings("club-a", { openHour: 6, closeHour: 22 });
}

const scopeOk = Object.freeze({
  tenantId: "venue-a",
  clubId: "club-a",
  venueId: "venue-a",
});

beforeEach(() => {
  globalThis.localStorage = createLocalStorageMock();
  setActiveClubId(DEFAULT_CLUB.id);
  __resetCompetitionCourtDescriptorAdapterDepsForTests();
  seedNormalizedInventory();
});

afterEach(() => {
  __resetCompetitionCourtDescriptorAdapterDepsForTests();
  delete globalThis.localStorage;
});

test("1. public export exists", () => {
  assert.equal(typeof getFromIndex, "function");
  assert.equal(typeof listCanonicalCourtDescriptors, "function");
  assert.equal(DESCRIPTOR_AUTHORITY, "venue-court.inventory.club_data_v3");
  assert.equal(
    SOURCE_CONTRACT_VERSION,
    "VENUE_COURT_CANONICAL_COURT_DESCRIPTOR_V1"
  );
});

test("2. required scope fields fail closed", () => {
  assert.throws(
    () => listCanonicalCourtDescriptors({ clubId: "club-a", venueId: "venue-a" }),
    (error) => error.code === DESCRIPTOR_ERROR.TENANT_SCOPE_MISSING
  );
  assert.throws(
    () =>
      listCanonicalCourtDescriptors({
        tenantId: "venue-a",
        venueId: "venue-a",
      }),
    (error) => error.code === DESCRIPTOR_ERROR.CLUB_SCOPE_MISSING
  );
  assert.throws(
    () =>
      listCanonicalCourtDescriptors({
        tenantId: "venue-a",
        clubId: "club-a",
      }),
    (error) => error.code === DESCRIPTOR_ERROR.VENUE_SCOPE_MISSING
  );
  assert.throws(
    () => listCanonicalCourtDescriptors(null),
    (error) => error.code === DESCRIPTOR_ERROR.INVALID_REQUEST
  );
  assert.throws(
    () =>
      listCanonicalCourtDescriptors({
        ...scopeOk,
        includeInactive: "yes",
      }),
    (error) => error.code === DESCRIPTOR_ERROR.INVALID_REQUEST
  );
  assert.throws(
    () =>
      listCanonicalCourtDescriptors({
        ...scopeOk,
        includeLocked: 1,
      }),
    (error) => error.code === DESCRIPTOR_ERROR.INVALID_REQUEST
  );
  assert.throws(
    () =>
      listCanonicalCourtDescriptors({
        ...scopeOk,
        courtIds: "c1",
      }),
    (error) => error.code === DESCRIPTOR_ERROR.INVALID_REQUEST
  );
});

test("3. exact tenant/club/venue scoping echoes verified ids", () => {
  __setCompetitionCourtDescriptorAdapterDepsForTests({
    listCourts: () => [baseCourt({ id: "c1", priority: 3 })],
  });
  const result = listCanonicalCourtDescriptors(scopeOk);
  assert.equal(result.tenantId, "venue-a");
  assert.equal(result.clubId, "club-a");
  assert.equal(result.venueId, "venue-a");
  assert.equal(result.courts.length, 1);
  assert.equal(result.courts[0].tenantId, "venue-a");
  assert.equal(result.courts[0].clubId, "club-a");
  assert.equal(result.courts[0].venueId, "venue-a");
  assert.equal(result.courts[0].courtId, "c1");
});

test("4. no first-club fallback", () => {
  assert.throws(
    () =>
      listCanonicalCourtDescriptors({
        tenantId: "venue-a",
        venueId: "venue-a",
      }),
    (error) => error.code === DESCRIPTOR_ERROR.CLUB_SCOPE_MISSING
  );
});

test("5. no first-venue fallback", () => {
  assert.throws(
    () =>
      listCanonicalCourtDescriptors({
        tenantId: "venue-a",
        clubId: "club-a",
      }),
    (error) => error.code === DESCRIPTOR_ERROR.VENUE_SCOPE_MISSING
  );
});

test("6. deterministic inventory ordering", () => {
  __setCompetitionCourtDescriptorAdapterDepsForTests({
    listCourts: () => [
      baseCourt({ id: "c-a", priority: 1 }),
      baseCourt({ id: "c-b", priority: 2 }),
      baseCourt({ id: "c-c", priority: 3 }),
    ],
  });
  const a = listCanonicalCourtDescriptors(scopeOk);
  const b = listCanonicalCourtDescriptors(scopeOk);
  assert.deepEqual(
    a.courts.map((c) => c.courtId),
    ["c-a", "c-b", "c-c"]
  );
  assert.deepEqual(
    a.courts.map((c) => c.courtId),
    b.courts.map((c) => c.courtId)
  );
});

test("7. courtIds requested ordering", () => {
  __setCompetitionCourtDescriptorAdapterDepsForTests({
    listCourts: () => [
      baseCourt({ id: "c1", priority: 1 }),
      baseCourt({ id: "c2", priority: 2 }),
      baseCourt({ id: "c3", priority: 3 }),
    ],
  });
  const result = listCanonicalCourtDescriptors({
    ...scopeOk,
    courtIds: ["c3", "c1"],
  });
  assert.deepEqual(
    result.courts.map((c) => c.courtId),
    ["c3", "c1"]
  );
});

test("8. default includeInactive false", () => {
  __setCompetitionCourtDescriptorAdapterDepsForTests({
    listCourts: () => [
      baseCourt({ id: "c-active", priority: 1, active: true }),
      baseCourt({ id: "c-inactive", priority: 2, active: false }),
    ],
  });
  const result = listCanonicalCourtDescriptors(scopeOk);
  assert.deepEqual(
    result.courts.map((c) => c.courtId),
    ["c-active"]
  );
});

test("9. includeInactive true", () => {
  __setCompetitionCourtDescriptorAdapterDepsForTests({
    listCourts: () => [
      baseCourt({ id: "c-active", priority: 1, active: true }),
      baseCourt({ id: "c-inactive", priority: 2, active: false }),
    ],
  });
  const result = listCanonicalCourtDescriptors({
    ...scopeOk,
    includeInactive: true,
  });
  assert.deepEqual(
    result.courts.map((c) => c.courtId),
    ["c-active", "c-inactive"]
  );
  assert.equal(result.courts[1].active, false);
});

test("10. default includeLocked true", () => {
  __setCompetitionCourtDescriptorAdapterDepsForTests({
    listCourts: () => [
      baseCourt({ id: "c-open", priority: 1, status: "active" }),
      baseCourt({ id: "c-locked", priority: 2, status: "locked" }),
    ],
  });
  const result = listCanonicalCourtDescriptors(scopeOk);
  assert.deepEqual(
    result.courts.map((c) => c.courtId),
    ["c-open", "c-locked"]
  );
  assert.equal(result.courts[1].locked, true);
});

test("11. includeLocked false", () => {
  __setCompetitionCourtDescriptorAdapterDepsForTests({
    listCourts: () => [
      baseCourt({ id: "c-open", priority: 1, status: "active" }),
      baseCourt({ id: "c-locked", priority: 2, status: "locked" }),
    ],
  });
  const result = listCanonicalCourtDescriptors({
    ...scopeOk,
    includeLocked: false,
  });
  assert.deepEqual(
    result.courts.map((c) => c.courtId),
    ["c-open"]
  );
});

test("12. active mapping", () => {
  __setCompetitionCourtDescriptorAdapterDepsForTests({
    listCourts: () => [
      baseCourt({ id: "c1", priority: 1, active: true }),
      baseCourt({ id: "c2", priority: 2, active: false }),
      baseCourt({ id: "c3", priority: 3 }), // active undefined → true
    ],
  });
  const result = listCanonicalCourtDescriptors({
    ...scopeOk,
    includeInactive: true,
  });
  assert.equal(result.courts[0].active, true);
  assert.equal(result.courts[1].active, false);
  assert.equal(result.courts[2].active, true);
});

test("13. locked mapping", () => {
  __setCompetitionCourtDescriptorAdapterDepsForTests({
    listCourts: () => [
      baseCourt({ id: "c1", priority: 1, status: "active" }),
      baseCourt({ id: "c2", priority: 2, status: "locked" }),
    ],
  });
  const result = listCanonicalCourtDescriptors(scopeOk);
  assert.equal(result.courts[0].locked, false);
  assert.equal(result.courts[1].locked, true);
});

test("14. maintenance is not mapped to locked", () => {
  __setCompetitionCourtDescriptorAdapterDepsForTests({
    listCourts: () => [
      baseCourt({ id: "c-maint", priority: 1, status: "maintenance" }),
    ],
  });
  const result = listCanonicalCourtDescriptors(scopeOk);
  assert.equal(result.courts.length, 1);
  assert.equal(result.courts[0].locked, false);
});

test("15. capabilities is exactly []", () => {
  __setCompetitionCourtDescriptorAdapterDepsForTests({
    listCourts: () => [
      baseCourt({ id: "c1", priority: 1, courtType: "indoor" }),
    ],
  });
  const result = listCanonicalCourtDescriptors(scopeOk);
  assert.deepEqual(result.courts[0].capabilities, []);
  assert.equal(Array.isArray(result.courts[0].capabilities), true);
  assert.equal(result.courts[0].capabilities.length, 0);
});

test("16. explicit finite priority is preserved", () => {
  __setCompetitionCourtDescriptorAdapterDepsForTests({
    listCourts: () => [
      baseCourt({ id: "c1", priority: 0 }),
      baseCourt({ id: "c2", priority: 7.5 }),
      baseCourt({ id: "c3", priority: -2 }),
    ],
  });
  const result = listCanonicalCourtDescriptors(scopeOk);
  assert.deepEqual(
    result.courts.map((c) => c.priority),
    [0, 7.5, -2]
  );
});

test("17. missing priority excludes the court", () => {
  __setCompetitionCourtDescriptorAdapterDepsForTests({
    listCourts: () => [
      baseCourt({ id: "c-ok", priority: 1 }),
      { id: "c-missing", name: "No P", active: true, status: "active" },
    ],
  });
  const result = listCanonicalCourtDescriptors(scopeOk);
  assert.deepEqual(
    result.courts.map((c) => c.courtId),
    ["c-ok"]
  );
});

test("18. invalid priority excludes the court", () => {
  __setCompetitionCourtDescriptorAdapterDepsForTests({
    listCourts: () => [
      baseCourt({ id: "c-nan", priority: Number.NaN }),
      baseCourt({ id: "c-inf", priority: Number.POSITIVE_INFINITY }),
      baseCourt({ id: "c-str", priority: "5" }),
      baseCourt({ id: "c-null", priority: null }),
      baseCourt({ id: "c-ok", priority: 4 }),
    ],
  });
  const result = listCanonicalCourtDescriptors(scopeOk);
  assert.deepEqual(
    result.courts.map((c) => c.courtId),
    ["c-ok"]
  );
});

test("19. PRIORITY_NOT_AUTHORITATIVE diagnostics", () => {
  __setCompetitionCourtDescriptorAdapterDepsForTests({
    listCourts: () => [
      { id: "c-a", active: true, status: "active" },
      baseCourt({ id: "c-b", priority: "x" }),
      baseCourt({ id: "c-c", priority: 1 }),
    ],
  });
  const result = listCanonicalCourtDescriptors(scopeOk);
  assert.deepEqual(result.diagnostics.excludedCourts, [
    {
      courtId: "c-a",
      reason: DESCRIPTOR_DIAGNOSTIC_REASON.PRIORITY_NOT_AUTHORITATIVE,
    },
    {
      courtId: "c-b",
      reason: DESCRIPTOR_DIAGNOSTIC_REASON.PRIORITY_NOT_AUTHORITATIVE,
    },
  ]);
  assert.deepEqual(
    result.courts.map((c) => c.courtId),
    ["c-c"]
  );
});

test("20. exact descriptorAuthority literal", () => {
  __setCompetitionCourtDescriptorAdapterDepsForTests({
    listCourts: () => [],
  });
  const result = listCanonicalCourtDescriptors(scopeOk);
  assert.equal(result.descriptorAuthority, "venue-court.inventory.club_data_v3");
});

test("21. exact sourceContractVersion literal", () => {
  __setCompetitionCourtDescriptorAdapterDepsForTests({
    listCourts: () => [],
  });
  const result = listCanonicalCourtDescriptors(scopeOk);
  assert.equal(
    result.sourceContractVersion,
    "VENUE_COURT_CANONICAL_COURT_DESCRIPTOR_V1"
  );
});

test("22. snapshot fields exist and are null", () => {
  __setCompetitionCourtDescriptorAdapterDepsForTests({
    listCourts: () => [baseCourt({ id: "c1", priority: 1 })],
  });
  const result = listCanonicalCourtDescriptors(scopeOk);
  assert.equal(Object.hasOwn(result, "sourceSnapshotId"), true);
  assert.equal(Object.hasOwn(result, "sourceSnapshotVersion"), true);
  assert.equal(result.sourceSnapshotId, null);
  assert.equal(result.sourceSnapshotVersion, null);
});

test("23. valid empty result", () => {
  __setCompetitionCourtDescriptorAdapterDepsForTests({
    listCourts: () => [],
  });
  const result = listCanonicalCourtDescriptors(scopeOk);
  assert.deepEqual(result.courts, []);
  assert.deepEqual(result.diagnostics.excludedCourts, []);
  assert.equal(result.descriptorAuthority, DESCRIPTOR_AUTHORITY);
});

test("24. inventory failure propagates", () => {
  __setCompetitionCourtDescriptorAdapterDepsForTests({
    listCourts() {
      throw new Error("blob down");
    },
  });
  assert.throws(
    () => listCanonicalCourtDescriptors(scopeOk),
    (error) => error.code === DESCRIPTOR_ERROR.DATA_UNAVAILABLE
  );
});

test("25. scope mismatch fails closed", () => {
  assert.throws(
    () =>
      listCanonicalCourtDescriptors({
        ...scopeOk,
        venueId: "venue-other",
      }),
    (error) => error.code === DESCRIPTOR_ERROR.VENUE_MISMATCH
  );
  assert.throws(
    () =>
      listCanonicalCourtDescriptors({
        tenantId: "tenant-other",
        clubId: "club-a",
        venueId: "venue-a",
      }),
    (error) => error.code === DESCRIPTOR_ERROR.TENANT_MISMATCH
  );
  assert.throws(
    () =>
      listCanonicalCourtDescriptors({
        tenantId: "venue-a",
        clubId: "club-missing",
        venueId: "venue-a",
      }),
    (error) => error.code === DESCRIPTOR_ERROR.CLUB_NOT_FOUND
  );
});

test("26. existing CAA response remains unchanged", () => {
  const caa = getCompetitionCourtAvailability({
    clubId: "club-a",
    venueId: "venue-a",
    date: "2026-07-18",
    startTime: "10:00",
    endTime: "11:00",
  });
  assert.deepEqual(Object.keys(caa).sort(), [
    "availableCourtIds",
    "clubId",
    "date",
    "endTime",
    "startTime",
    "unavailableCourts",
    "venueId",
  ]);
  assert.equal(Object.hasOwn(caa, "descriptorAuthority"), false);
  assert.equal(Object.hasOwn(caa, "sourceContractVersion"), false);
  assert.equal(Object.hasOwn(caa, "courts"), false);
  assert.equal(Object.hasOwn(caa, "diagnostics"), false);
  assert.ok(Array.isArray(caa.availableCourtIds));
});

test("28. no import from Competition Engine", () => {
  const source = readFileSync(adapterPath, "utf8");
  const constants = readFileSync(constantsPath, "utf8");
  assert.doesNotMatch(source, /competition-engine|tournament-engine|competition-core/);
  assert.doesNotMatch(constants, /competition-engine|tournament-engine|competition-core/);
});

test("29. no import from Court Engine repository", () => {
  const source = readFileSync(adapterPath, "utf8");
  assert.doesNotMatch(source, /court-engine|features\/court-engine/);
  assert.doesNotMatch(source, /from ["'].*\/ai\//);
});

test("30. no nondeterminism Date.now Math.random UUID hash", () => {
  const source = readFileSync(adapterPath, "utf8");
  assert.doesNotMatch(source, /Date\.now|Math\.random|randomUUID|crypto\.|createHash|uuid/i);
});

test("unknown courtIds receive COURT_NOT_FOUND diagnostic", () => {
  __setCompetitionCourtDescriptorAdapterDepsForTests({
    listCourts: () => [baseCourt({ id: "c1", priority: 1 })],
  });
  const result = listCanonicalCourtDescriptors({
    ...scopeOk,
    courtIds: ["missing", "c1"],
  });
  assert.deepEqual(
    result.courts.map((c) => c.courtId),
    ["c1"]
  );
  assert.deepEqual(result.diagnostics.excludedCourts, [
    {
      courtId: "missing",
      reason: DESCRIPTOR_DIAGNOSTIC_REASON.COURT_NOT_FOUND,
    },
  ]);
});

test("clusterId is filter only and never establishes ownership", () => {
  const calls = [];
  __setCompetitionCourtDescriptorAdapterDepsForTests({
    listCourts(options) {
      calls.push(options);
      return [baseCourt({ id: "c1", priority: 1, clusterId: "cluster-a" })];
    },
  });
  listCanonicalCourtDescriptors({
    ...scopeOk,
    clusterId: "cluster-a",
  });
  assert.equal(calls[0].clubId, "club-a");
  assert.equal(calls[0].clusterId, "cluster-a");
  assert.equal(calls[0].tenantId, "venue-a");
});

test("normalized Club V3 inventory without priority yields empty descriptors + diagnostics", () => {
  // Real persistence path strips priority via normalizeCourt — fail-closed omission.
  const result = listCanonicalCourtDescriptors(scopeOk);
  assert.deepEqual(result.courts, []);
  assert.ok(result.diagnostics.excludedCourts.length >= 1);
  assert.ok(
    result.diagnostics.excludedCourts.every(
      (row) =>
        row.reason === DESCRIPTOR_DIAGNOSTIC_REASON.PRIORITY_NOT_AUTHORITATIVE
    )
  );
});
