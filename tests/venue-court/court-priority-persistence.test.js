/**
 * Phase 3C — Authoritative court.priority persistence (Policy A).
 *
 * Locks Venue-owned optional finite numeric priority through normalizeCourt,
 * Club V3 save/load, facade reads, and Phase 3B descriptor emission.
 */

import test, { beforeEach, afterEach } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { setActiveClubId, DEFAULT_CLUB, saveClubs } from "../../src/data/club.js";
import {
  getClubDataKey,
  loadClubData,
  loadCourtsForClub,
  saveClubData,
  saveCourtsForClub,
} from "../../src/domain/clubStorage.js";
import { normalizeCourt, normalizeCourts } from "../../src/models/court.js";
import { upsertCourt } from "../../src/pages/courts.logic.js";
import {
  listCourts,
  getCourtById,
  listCanonicalCourtDescriptors,
  DESCRIPTOR_DIAGNOSTIC_REASON,
} from "../../src/features/venue-court/index.js";
import { __resetCourtInventoryDepsForTests } from "../../src/features/venue-court/services/courtInventoryService.js";
import { __resetCompetitionCourtDescriptorAdapterDepsForTests } from "../../src/features/venue-court/adapters/competitionCourtDescriptorAdapter.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = path.resolve(__dirname, "../..");

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

function seedClub() {
  saveClubs([{ id: "club-a", name: "CLB A", venueId: "venue-a" }]);
}

beforeEach(() => {
  globalThis.localStorage = createLocalStorageMock();
  setActiveClubId(DEFAULT_CLUB.id);
  __resetCourtInventoryDepsForTests();
  __resetCompetitionCourtDescriptorAdapterDepsForTests();
  seedClub();
});

afterEach(() => {
  __resetCourtInventoryDepsForTests();
  __resetCompetitionCourtDescriptorAdapterDepsForTests();
  delete globalThis.localStorage;
});

test("1-4. normalizeCourt preserves valid finite priorities including zero", () => {
  assert.equal(normalizeCourt({ id: "c1", priority: 10 }).priority, 10);
  assert.equal(normalizeCourt({ id: "c2", priority: 2.25 }).priority, 2.25);
  assert.equal(normalizeCourt({ id: "c3", priority: -4 }).priority, -4);
  assert.equal(normalizeCourt({ id: "c4", priority: 0 }).priority, 0);
});

test("5-13. normalizeCourt omits missing and invalid priority values", () => {
  const invalid = [
    undefined,
    null,
    "10",
    Number.NaN,
    Infinity,
    -Infinity,
    {},
    [1],
  ];

  assert.equal(Object.hasOwn(normalizeCourt({ id: "missing" }), "priority"), false);

  for (const priority of invalid) {
    const court = normalizeCourt({ id: "x", priority });
    assert.equal(
      Object.hasOwn(court, "priority"),
      false,
      `expected omit for ${String(priority)}`
    );
  }
});

test("14. normalizeCourt does not coerce string priority", () => {
  const court = normalizeCourt({ id: "c1", priority: "7" });
  assert.equal(Object.hasOwn(court, "priority"), false);
});

test("15. existing court fields remain unchanged when priority is present", () => {
  const court = normalizeCourt({
    id: "c1",
    name: "VIP",
    number: 3,
    active: true,
    status: "active",
    courtType: "indoor",
    defaultHourlyRate: 100,
    peakHourlyRate: 150,
    note: "note",
    tenantId: "venue-a",
    clusterId: "cluster-a",
    priority: 5,
  });

  assert.equal(court.id, "c1");
  assert.equal(court.name, "VIP");
  assert.equal(court.number, 3);
  assert.equal(court.active, true);
  assert.equal(court.status, "active");
  assert.equal(court.courtType, "indoor");
  assert.equal(court.defaultHourlyRate, 100);
  assert.equal(court.peakHourlyRate, 150);
  assert.equal(court.note, "note");
  assert.equal(court.tenantId, "venue-a");
  assert.equal(court.clusterId, "cluster-a");
  assert.equal(court.priority, 5);
});

test("16. normalizeCourts preserves valid priority per row", () => {
  const courts = normalizeCourts([
    { id: "a", priority: 1 },
    { id: "b" },
    { id: "c", priority: Number.NaN },
  ]);

  assert.equal(courts[0].priority, 1);
  assert.equal(Object.hasOwn(courts[1], "priority"), false);
  assert.equal(Object.hasOwn(courts[2], "priority"), false);
});

test("17-18. Club V3 save/load and normalizeClubData preserve valid priority", () => {
  saveCourtsForClub(
    [
      normalizeCourt({
        id: "c1",
        name: "Sân 1",
        active: true,
        status: "active",
        tenantId: "venue-a",
        priority: 10,
      }),
    ],
    "club-a"
  );

  const loaded = loadCourtsForClub("club-a");
  assert.equal(loaded.length, 1);
  assert.equal(loaded[0].priority, 10);

  const blob = loadClubData("club-a");
  assert.equal(blob.courts[0].priority, 10);

  const reSaved = saveClubData("club-a", {
    ...blob,
    courts: blob.courts,
  });
  assert.equal(reSaved.courts[0].priority, 10);
  assert.equal(loadCourtsForClub("club-a")[0].priority, 10);
});

test("19. invalid priority does not survive Club V3 round-trip", () => {
  saveCourtsForClub(
    [
      {
        id: "c1",
        name: "Sân 1",
        active: true,
        status: "active",
        tenantId: "venue-a",
        priority: "10",
      },
    ],
    "club-a"
  );

  const loaded = loadCourtsForClub("club-a");
  assert.equal(Object.hasOwn(loaded[0], "priority"), false);
});

test("20. existing records without priority remain readable", () => {
  saveCourtsForClub(
    [
      normalizeCourt({
        id: "c-legacy",
        name: "Legacy",
        active: true,
        status: "active",
        tenantId: "venue-a",
      }),
    ],
    "club-a"
  );

  const loaded = loadCourtsForClub("club-a");
  assert.equal(loaded[0].id, "c-legacy");
  assert.equal(Object.hasOwn(loaded[0], "priority"), false);
  assert.equal(listCourts({ clubId: "club-a", tenantId: "venue-a" })[0].id, "c-legacy");
});

test("21-22. listCourts and getCourtById return optional priority when present", () => {
  saveCourtsForClub(
    [
      normalizeCourt({
        id: "c1",
        name: "Sân 1",
        active: true,
        status: "active",
        tenantId: "venue-a",
        priority: 8,
      }),
    ],
    "club-a"
  );

  const listed = listCourts({ clubId: "club-a", tenantId: "venue-a" });
  assert.equal(listed[0].priority, 8);
  assert.equal(getCourtById("c1", { clubId: "club-a", tenantId: "venue-a" }).priority, 8);
});

test("23-25. descriptor emits persisted priority and omits courts without it", () => {
  saveCourtsForClub(
    [
      normalizeCourt({
        id: "c1",
        name: "With priority",
        active: true,
        status: "active",
        tenantId: "venue-a",
        priority: 12,
      }),
      normalizeCourt({
        id: "c2",
        name: "No priority",
        active: true,
        status: "active",
        tenantId: "venue-a",
      }),
    ],
    "club-a"
  );

  const result = listCanonicalCourtDescriptors({
    tenantId: "venue-a",
    clubId: "club-a",
    venueId: "venue-a",
  });

  assert.deepEqual(
    result.courts.map((court) => ({ courtId: court.courtId, priority: court.priority })),
    [{ courtId: "c1", priority: 12 }]
  );
  assert.deepEqual(result.diagnostics.excludedCourts, [
    {
      courtId: "c2",
      reason: DESCRIPTOR_DIAGNOSTIC_REASON.PRIORITY_NOT_AUTHORITATIVE,
    },
  ]);
});

test("26. array reorder does not alter stored priority values", () => {
  const courts = normalizeCourts([
    { id: "a", priority: 1 },
    { id: "b", priority: 2 },
  ]);
  const reordered = normalizeCourts([courts[1], courts[0]]);

  assert.equal(reordered.find((court) => court.id === "a").priority, 1);
  assert.equal(reordered.find((court) => court.id === "b").priority, 2);
});

test("27. create/update logic does not invent priority; explicit priority passes through", () => {
  const created = upsertCourt([], {
    courtName: "New",
    courtNumber: 1,
    extra: { status: "active", active: true },
  });
  assert.equal(Object.hasOwn(created[0], "priority"), false);

  const withPriority = upsertCourt([], {
    courtName: "P",
    courtNumber: 2,
    extra: { status: "active", active: true, priority: 9 },
  });
  assert.equal(withPriority[0].priority, 9);

  const existing = [
    normalizeCourt({
      id: "c1",
      name: "Old",
      number: 1,
      active: true,
      status: "active",
      priority: 4,
    }),
  ];
  const editedKeep = upsertCourt(existing, {
    courtName: "Renamed",
    courtNumber: 1,
    editingCourt: existing[0],
    extra: { status: "active", active: true },
  });
  assert.equal(editedKeep[0].priority, 4);
  assert.equal(editedKeep[0].name, "Renamed");

  const editedInvalid = upsertCourt(existing, {
    courtName: "Old",
    courtNumber: 1,
    editingCourt: existing[0],
    extra: { status: "active", active: true, priority: "bad" },
  });
  assert.equal(Object.hasOwn(editedInvalid[0], "priority"), false);
});

test("30-32. no Competition/Court Engine priority dependency; no SQL/UI/HTTP surface change", () => {
  const courtModel = fs.readFileSync(path.join(REPO_ROOT, "src/models/court.js"), "utf8");
  const courtsLogic = fs.readFileSync(
    path.join(REPO_ROOT, "src/pages/courts.logic.js"),
    "utf8"
  );
  const inventoryHandler = fs.readFileSync(
    path.join(REPO_ROOT, "src/features/api/router/handlers/courtsHandler.js"),
    "utf8"
  );

  for (const source of [courtModel, courtsLogic]) {
    assert.equal(/features\/competition-core/.test(source), false);
    assert.equal(/features\/court-engine/.test(source), false);
    assert.equal(/Math\.random/.test(source), false);
  }

  // Priority must not be derived from Date.now / Math.random / array index.
  assert.equal(/priority\s*[:=][^\n]*Date\.now/.test(courtModel), false);
  assert.equal(/priority\s*[:=][^\n]*Date\.now/.test(courtsLogic), false);
  assert.equal(/priority\s*[:=][^\n]*Math\.random/.test(courtModel), false);
  assert.equal(/priority\s*[:=][^\n]*Math\.random/.test(courtsLogic), false);
  assert.equal(/priority\s*[:=]\s*index\b/.test(courtModel), false);

  // HTTP GET /courts handler must remain unchanged for priority in this phase.
  assert.equal(/\bpriority\b/.test(inventoryHandler), false);
  assert.equal(
    fs.existsSync(path.join(REPO_ROOT, "docs/supabase-venue-court-phase-3c.sql")),
    false
  );

  const rawKey = getClubDataKey("club-a");
  saveCourtsForClub(
    [normalizeCourt({ id: "c1", name: "A", active: true, tenantId: "venue-a", priority: 1 })],
    "club-a"
  );
  const raw = JSON.parse(localStorage.getItem(rawKey));
  assert.equal(raw.courts[0].priority, 1);
});
