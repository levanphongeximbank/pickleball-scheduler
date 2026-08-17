/**
 * Shared Court Resource Foundation ΓÇö contract tests.
 */
import test, { beforeEach, afterEach, describe } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { setActiveClubId, DEFAULT_CLUB, saveClubs } from "../../src/data/club.js";
import {
  saveCourtsForClub,
  saveBookingsForClub,
  loadBookingsForClub,
} from "../../src/domain/clubStorage.js";
import { saveCourtManagementSettings } from "../../src/domain/courtManagementSettings.js";
import { normalizeCourt } from "../../src/models/court.js";
import { createBookingRecord } from "../../src/models/booking.js";
import {
  AVAILABILITY_REASON,
  getCourtAvailability,
  getCompetitionCourtAvailability,
  listCanonicalCloudCourts,
  extractCourtsFromClubDataV3Payload,
  assertCourtClusterMembership,
  reserveCourts,
  releaseCourts,
  validateCourtAssignment,
  getReservationOwner,
  OWNERSHIP_STATUS,
  COURT_RESOURCE_CODE,
  RESERVATION_OWNER_TYPE,
} from "../../src/features/venue-court/index.js";
import {
  __resetCanonicalCloudCourtInventoryDepsForTests,
  __setCanonicalCloudCourtInventoryDepsForTests,
} from "../../src/features/venue-court/services/canonicalCloudCourtInventory.js";
import {
  __resetCourtResourceGatewayDepsForTests,
} from "../../src/features/venue-court/services/courtResourceGateway.js";
import * as canonicalGateway from "../../src/features/court-resource/services/courtResourceGateway.js";
import * as legacyGatewayPath from "../../src/features/venue-court/services/courtResourceGateway.js";
import * as canonicalContract from "../../src/features/court-resource/constants/courtResourceContract.js";
import * as legacyContractPath from "../../src/features/venue-court/constants/courtResourceContract.js";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");

const CLUB_ID = "club-nl";
const TENANT_A = "tenant-a";
const TENANT_B = "tenant-b";
const CLUSTER = "NAM_LONG";
const OTHER_CLUSTER = "OTHER_CLUSTER";
const DATE = "2026-08-15";
const CAPACITY = { date: DATE, startTime: "08:00", endTime: "18:00" };
const MATCH = { date: DATE, startTime: "10:00", endTime: "10:30" };

const PHYSICAL = ["NL_C01", "NL_C02", "NL_C03", "NL_C04", "NL_C05", "NL_C06"];
const SELECTED = ["NL_C01", "NL_C02", "NL_C04", "NL_C06"];

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

function namLongCourts() {
  return PHYSICAL.map((id, index) =>
    normalizeCourt({
      id,
      name: `Nam Long ${index + 1}`,
      number: index + 1,
      active: true,
      status: "active",
      clubId: CLUB_ID,
      tenantId: TENANT_A,
      clusterId: CLUSTER,
    })
  );
}

function seedLocalInventory(extraCourts = []) {
  saveClubs([
    { id: CLUB_ID, name: "CLB Nam Long", venueId: TENANT_A },
    { id: "club-b", name: "CLB B", venueId: TENANT_B },
  ]);
  saveCourtsForClub([...namLongCourts(), ...extraCourts], CLUB_ID);
  saveBookingsForClub([], CLUB_ID);
  saveCourtManagementSettings(CLUB_ID, { openHour: 6, closeHour: 22 });
}

function createRecordingClient(rows) {
  const eqCalls = [];
  return {
    eqCalls,
    from(table) {
      assert.equal(table, "club_data_v3");
      return {
        select() {
          return this;
        },
        eq(column, value) {
          eqCalls.push([column, value]);
          return this;
        },
        limit() {
          return Promise.resolve({ data: rows, error: null });
        },
      };
    },
  };
}

beforeEach(() => {
  globalThis.localStorage = createLocalStorageMock();
  setActiveClubId(DEFAULT_CLUB.id);
  __resetCanonicalCloudCourtInventoryDepsForTests();
  __resetCourtResourceGatewayDepsForTests();
  seedLocalInventory();
});

afterEach(() => {
  __resetCanonicalCloudCourtInventoryDepsForTests();
  __resetCourtResourceGatewayDepsForTests();
  delete globalThis.localStorage;
});

describe("1-4 canonical cloud inventory", () => {
  test("1. canonical cloud court by club_id", async () => {
    const client = createRecordingClient([
      {
        club_id: CLUB_ID,
        venue_id: TENANT_A,
        version: 3,
        data: { schemaVersion: 3.5, clubId: CLUB_ID, courts: namLongCourts() },
      },
    ]);
    __setCanonicalCloudCourtInventoryDepsForTests({
      hasSupabaseConfig: () => true,
      getSupabaseAuthClient: () => client,
    });

    const result = await listCanonicalCloudCourts({ clubId: CLUB_ID, tenantId: TENANT_A });
    assert.equal(result.ok, true);
    assert.equal(result.source, "club_data_v3");
    assert.equal(result.courts.length, 6);
    assert.deepEqual(
      result.courts.map((court) => court.id),
      PHYSICAL
    );
    assert.ok(client.eqCalls.some(([column]) => column === "club_id"));
    assert.equal(
      client.eqCalls.some(([column]) => column === "venue_id"),
      false,
      "must not require blob venue_id on the query"
    );
  });

  test("2. venue_id NULL blob accepted when scoped physical courts match", async () => {
    const nested = {
      clubId: CLUB_ID,
      data: { courts: namLongCourts() },
      aiData: {},
    };
    assert.equal(extractCourtsFromClubDataV3Payload(nested).length, 6);

    const client = createRecordingClient([
      { club_id: CLUB_ID, venue_id: null, version: 1, data: nested },
    ]);
    __setCanonicalCloudCourtInventoryDepsForTests({
      hasSupabaseConfig: () => true,
      getSupabaseAuthClient: () => client,
    });

    const result = await listCanonicalCloudCourts({ clubId: CLUB_ID, tenantId: TENANT_A });
    assert.equal(result.ok, true);
    assert.equal(result.courts.length, 6);
    assert.equal(result.blobVenueId, null);
  });

  test("3. foreign tenant court denied", async () => {
    const mixed = [
      ...namLongCourts(),
      normalizeCourt({
        id: "FOREIGN_T",
        name: "Foreign tenant",
        active: true,
        status: "active",
        clubId: CLUB_ID,
        tenantId: TENANT_B,
        clusterId: CLUSTER,
      }),
    ];
    __setCanonicalCloudCourtInventoryDepsForTests({
      hasSupabaseConfig: () => true,
      getSupabaseAuthClient: () =>
        createRecordingClient([
          { club_id: CLUB_ID, venue_id: null, version: 1, data: { courts: mixed } },
        ]),
    });

    const result = await listCanonicalCloudCourts({ clubId: CLUB_ID, tenantId: TENANT_A });
    assert.equal(result.courts.some((court) => court.id === "FOREIGN_T"), false);
    assert.equal(result.courts.length, 6);
  });

  test("4. foreign club court denied", async () => {
    const mixed = [
      ...namLongCourts(),
      normalizeCourt({
        id: "FOREIGN_C",
        name: "Foreign club",
        active: true,
        status: "active",
        clubId: "club-b",
        tenantId: TENANT_A,
        clusterId: CLUSTER,
      }),
    ];
    __setCanonicalCloudCourtInventoryDepsForTests({
      hasSupabaseConfig: () => true,
      getSupabaseAuthClient: () =>
        createRecordingClient([
          { club_id: CLUB_ID, venue_id: null, version: 1, data: { courts: mixed } },
        ]),
    });

    const result = await listCanonicalCloudCourts({ clubId: CLUB_ID, tenantId: TENANT_A });
    assert.equal(result.courts.some((court) => court.id === "FOREIGN_C"), false);
  });
});

describe("5-7 cluster membership and inactive", () => {
  test("5. cluster membership pass", async () => {
    const result = assertCourtClusterMembership({
      tenantId: TENANT_A,
      clubId: CLUB_ID,
      venueId: TENANT_A,
      clusterId: CLUSTER,
      courtId: "NL_C01",
    });
    assert.equal(result.ok, true);
    assert.equal(result.courtId, "NL_C01");
  });

  test("6. cluster mismatch denied", async () => {
    seedLocalInventory([
      normalizeCourt({
        id: "OTHER_CLUSTER_C01",
        name: "Other",
        active: true,
        status: "active",
        clubId: CLUB_ID,
        tenantId: TENANT_A,
        clusterId: OTHER_CLUSTER,
      }),
    ]);
    const result = assertCourtClusterMembership({
      clubId: CLUB_ID,
      tenantId: TENANT_A,
      clusterId: CLUSTER,
      courtId: "OTHER_CLUSTER_C01",
    });
    assert.equal(result.ok, false);
    assert.equal(result.code, COURT_RESOURCE_CODE.CLUSTER_MISMATCH);
  });

  test("7. inactive court unavailable", async () => {
    seedLocalInventory([
      normalizeCourt({
        id: "NL_INACTIVE",
        name: "Inactive",
        active: false,
        status: "locked",
        clubId: CLUB_ID,
        tenantId: TENANT_A,
        clusterId: CLUSTER,
      }),
    ]);
    const membership = assertCourtClusterMembership({
      clubId: CLUB_ID,
      tenantId: TENANT_A,
      clusterId: CLUSTER,
      courtId: "NL_INACTIVE",
    });
    assert.equal(membership.ok, false);
    assert.equal(membership.code, COURT_RESOURCE_CODE.COURT_INACTIVE);

    const availability = await getCourtAvailability({
      clubId: CLUB_ID,
      venueId: TENANT_A,
      courtId: "NL_INACTIVE",
      ...MATCH,
    });
    assert.equal(availability.courts[0].available, false);
    assert.equal(availability.courts[0].conflicts[0].code, AVAILABILITY_REASON.COURT_INACTIVE);
  });
});

describe("8-11 conflicts and own-reservation reuse", () => {
  test("8. maintenance conflict", async () => {
    saveBookingsForClub(
      [
        createBookingRecord({
          id: "maint-1",
          courtId: "NL_C01",
          date: DATE,
          startTime: "10:00",
          endTime: "11:00",
          bookingStatus: "confirmed",
          bookingType: "maintenance",
        }),
      ],
      CLUB_ID
    );
    const result = await getCourtAvailability({
      clubId: CLUB_ID,
      venueId: TENANT_A,
      courtId: "NL_C01",
      ...MATCH,
      context: { owner: { type: "tournament", id: "T01" } },
    });
    assert.equal(result.courts[0].available, false);
    assert.equal(result.courts[0].conflicts[0].code, AVAILABILITY_REASON.MAINTENANCE_BOOKING);
  });

  test("9. customer booking conflict", async () => {
    saveBookingsForClub(
      [
        createBookingRecord({
          id: "cust-1",
          courtId: "NL_C01",
          date: DATE,
          startTime: "10:00",
          endTime: "11:00",
          bookingStatus: "confirmed",
          bookingType: "single",
        }),
      ],
      CLUB_ID
    );
    const result = await getCourtAvailability({
      clubId: CLUB_ID,
      venueId: TENANT_A,
      courtId: "NL_C01",
      ...MATCH,
      context: { owner: { type: "tournament", id: "T01" } },
    });
    assert.equal(result.courts[0].available, false);
    assert.equal(result.courts[0].conflicts[0].code, AVAILABILITY_REASON.BOOKING_CONFLICT);
  });

  test("10. foreign tournament conflict", async () => {
    const reserved = await reserveCourts({
      clubId: CLUB_ID,
      tenantId: TENANT_A,
      clusterId: CLUSTER,
      selectedCourtIds: ["NL_C01"],
      owner: { type: "tournament", id: "T01" },
      ...CAPACITY,
    });
    assert.equal(reserved.ok, true, reserved.error);

    const result = await getCourtAvailability({
      clubId: CLUB_ID,
      venueId: TENANT_A,
      courtId: "NL_C01",
      ...MATCH,
      context: { owner: { type: "tournament", id: "T02" } },
    });
    assert.equal(result.courts[0].available, false);
    assert.equal(
      result.courts[0].conflicts[0].code,
      AVAILABILITY_REASON.TOURNAMENT_BOOKING_CONFLICT
    );
  });

  test("11. own tournament reservation reuse", async () => {
    const reserved = await reserveCourts({
      clubId: CLUB_ID,
      tenantId: TENANT_A,
      clusterId: CLUSTER,
      selectedCourtIds: ["NL_C01"],
      owner: { type: "tournament", id: "T01" },
      ...CAPACITY,
    });
    assert.equal(reserved.ok, true, reserved.error);

    const result = await getCourtAvailability({
      clubId: CLUB_ID,
      venueId: TENANT_A,
      courtId: "NL_C01",
      ...MATCH,
      context: { owner: { type: "tournament", id: "T01" } },
    });
    assert.equal(result.courts[0].available, true);
    assert.equal(result.courts[0].ownership.status, OWNERSHIP_STATUS.OWN_RESERVATION);
    assert.equal(result.courts[0].ownership.owner.id, "T01");
    assert.equal(result.courts[0].ownership.owner.type, RESERVATION_OWNER_TYPE.TOURNAMENT);
  });
});

describe("12-17 reserve / release / owner / assignment", () => {
  test("12. reserve selected physical courts only", async () => {
    const result = await reserveCourts({
      clubId: CLUB_ID,
      tenantId: TENANT_A,
      clusterId: CLUSTER,
      selectedCourtIds: SELECTED,
      owner: { type: "tournament", id: "T01" },
      ...CAPACITY,
    });
    assert.equal(result.ok, true, result.error);
    assert.equal(result.selectedCourtIds.length, 4);
    const bookings = loadBookingsForClub(CLUB_ID).filter(
      (booking) => booking.bookingStatus === "confirmed"
    );
    assert.equal(bookings.length, 4);
    assert.deepEqual(
      bookings.map((booking) => String(booking.courtId)).sort(),
      [...SELECTED].sort()
    );
    assert.equal(bookings.every((booking) => String(booking.courtId) !== "NL_C03"), true);
    assert.equal(bookings.every((booking) => String(booking.courtId) !== "NL_C05"), true);
  });

  test("13. no whole-cluster reservation", async () => {
    const denied = await reserveCourts({
      clubId: CLUB_ID,
      clusterId: CLUSTER,
      selectedCourtIds: [CLUSTER],
      owner: { type: "tournament", id: "T01" },
      ...CAPACITY,
    });
    assert.equal(denied.ok, false);
    assert.ok(
      denied.code === COURT_RESOURCE_CODE.WHOLE_CLUSTER_DENIED ||
        denied.code === COURT_RESOURCE_CODE.COURT_NOT_FOUND
    );

    const selected = await reserveCourts({
      clubId: CLUB_ID,
      clusterId: CLUSTER,
      selectedCourtIds: SELECTED,
      owner: { type: "tournament", id: "T01" },
      ...CAPACITY,
    });
    assert.equal(selected.ok, true);
    assert.equal(selected.granularity, "physical_court_x_capacity_window");
    const bookedIds = loadBookingsForClub(CLUB_ID)
      .filter((booking) => booking.bookingStatus === "confirmed")
      .map((booking) => String(booking.courtId));
    assert.equal(bookedIds.length, 4);
    assert.equal(bookedIds.includes("NL_C03"), false);
  });

  test("14. release only own reservations", async () => {
    assert.equal(
      (await reserveCourts({
        clubId: CLUB_ID,
        selectedCourtIds: ["NL_C01"],
        owner: { type: "tournament", id: "T01" },
        ...CAPACITY,
      })).ok,
      true
    );
    assert.equal(
      (await reserveCourts({
        clubId: CLUB_ID,
        selectedCourtIds: ["NL_C02"],
        owner: { type: "tournament", id: "T02" },
        ...CAPACITY,
      })).ok,
      true
    );
    saveBookingsForClub(
      [
        ...loadBookingsForClub(CLUB_ID),
        createBookingRecord({
          id: "cust-keep",
          courtId: "NL_C03",
          date: DATE,
          startTime: "09:00",
          endTime: "10:00",
          bookingStatus: "confirmed",
          bookingType: "single",
        }),
        createBookingRecord({
          id: "maint-keep",
          courtId: "NL_C05",
          date: DATE,
          startTime: "09:00",
          endTime: "10:00",
          bookingStatus: "confirmed",
          bookingType: "maintenance",
        }),
      ],
      CLUB_ID
    );

    const released = await releaseCourts({
      clubId: CLUB_ID,
      owner: { type: "tournament", id: "T01" },
    });
    assert.equal(released.ok, true);
    const remaining = loadBookingsForClub(CLUB_ID).filter(
      (booking) => booking.bookingStatus === "confirmed"
    );
    const remainingIds = remaining.map((booking) => String(booking.id));
    assert.equal(
      remaining.some((booking) => String(booking.tournamentId) === "T01"),
      false
    );
    assert.equal(
      remaining.some((booking) => String(booking.tournamentId) === "T02"),
      true
    );
    assert.ok(remainingIds.includes("cust-keep"));
    assert.ok(remainingIds.includes("maint-keep"));
  });

  test("15. reservation owner lookup", async () => {
    assert.equal(
      (await reserveCourts({
        clubId: CLUB_ID,
        selectedCourtIds: ["NL_C01"],
        owner: { type: "tournament", id: "T01" },
        ...CAPACITY,
      })).ok,
      true
    );
    const owner = getReservationOwner({
      clubId: CLUB_ID,
      courtId: "NL_C01",
      ...MATCH,
    });
    assert.equal(owner.found, true);
    assert.equal(owner.owner.type, "tournament");
    assert.equal(owner.owner.id, "T01");
    assert.equal(owner.courtId, "NL_C01");
    assert.equal("data" in owner, false);
  });

  test("16. no synthetic courtLabel authority", async () => {
    const denied = await reserveCourts({
      clubId: CLUB_ID,
      courtLabel: "S├ón 1",
      owner: { type: "tournament", id: "T01" },
      ...CAPACITY,
    });
    assert.equal(denied.ok, false);
    assert.equal(denied.code, COURT_RESOURCE_CODE.SYNTHETIC_COURT_DENIED);

    const assignDenied = await validateCourtAssignment({
      clubId: CLUB_ID,
      courtLabel: "S├ón 2",
      owner: { type: "tournament", id: "T01" },
      ...MATCH,
    });
    assert.equal(assignDenied.ok, false);
    assert.equal(assignDenied.code, COURT_RESOURCE_CODE.SYNTHETIC_COURT_DENIED);
  });

  test("17. no per-match reservation requirement", async () => {
    const reserved = await reserveCourts({
      clubId: CLUB_ID,
      selectedCourtIds: SELECTED,
      owner: { type: "tournament", id: "T01" },
      ...CAPACITY,
    });
    assert.equal(reserved.ok, true);
    const before = loadBookingsForClub(CLUB_ID).filter(
      (booking) => booking.bookingStatus === "confirmed"
    ).length;
    assert.equal(before, 4);

    const assignment = await validateCourtAssignment({
      tenantId: TENANT_A,
      clubId: CLUB_ID,
      venueId: TENANT_A,
      clusterId: CLUSTER,
      courtId: "NL_C01",
      scheduledStart: MATCH.startTime,
      scheduledEnd: MATCH.endTime,
      date: DATE,
      owner: { type: "tournament", id: "T01" },
    });
    assert.equal(assignment.ok, true, assignment.error);
    assert.equal(assignment.valid, true);
    assert.equal(assignment.ownership.status, OWNERSHIP_STATUS.OWN_RESERVATION);

    const after = loadBookingsForClub(CLUB_ID).filter(
      (booking) => booking.bookingStatus === "confirmed"
    ).length;
    assert.equal(after, before);

    const unreservedCourt = await validateCourtAssignment({
      clubId: CLUB_ID,
      clusterId: CLUSTER,
      courtId: "NL_C03",
      date: DATE,
      scheduledStart: MATCH.startTime,
      scheduledEnd: MATCH.endTime,
      owner: { type: "tournament", id: "T01" },
    });
    assert.equal(unreservedCourt.ok, false);
    assert.equal(unreservedCourt.code, COURT_RESOURCE_CODE.COURT_NOT_IN_OWNER_SCOPE);
  });
});

describe("18-19 determinism and isolation", () => {
  test("18. availability deterministic", async () => {
    const query = {
      clubId: CLUB_ID,
      venueId: TENANT_A,
      clusterId: CLUSTER,
      date: DATE,
      startTime: "10:00",
      endTime: "11:00",
    };
    const a = await getCourtAvailability(query);
    const b = await getCourtAvailability(query);
    assert.deepEqual(
      a.courts.map((row) => [row.courtId, row.available]),
      b.courts.map((row) => [row.courtId, row.available])
    );
    const competitionA = getCompetitionCourtAvailability(query);
    const competitionB = getCompetitionCourtAvailability(query);
    assert.deepEqual(competitionA.availableCourtIds, competitionB.availableCourtIds);
  });

  test("19. no cross-scope leak", async () => {
    const unknown = assertCourtClusterMembership({
      clubId: CLUB_ID,
      clusterId: CLUSTER,
      courtId: "DOES_NOT_EXIST",
    });
    assert.equal(unknown.ok, false);
    assert.equal(unknown.code, COURT_RESOURCE_CODE.COURT_NOT_FOUND);

    const availability = await getCourtAvailability({
      clubId: CLUB_ID,
      venueId: TENANT_A,
      courtId: "DOES_NOT_EXIST",
      ...MATCH,
    });
    assert.equal(availability.courts[0].available, false);
    assert.equal(availability.courts[0].conflicts[0].code, AVAILABILITY_REASON.COURT_NOT_FOUND);

    await assert.rejects(async () =>
        await getCourtAvailability({
          venueId: TENANT_A,
          courtId: "NL_C01",
          ...MATCH,
        }),
      (error) => error.code === AVAILABILITY_REASON.CLUB_SCOPE_MISSING
    );
  });
});

describe("architecture boundaries", () => {
  test("one canonical gateway implementation and identity-preserving compatibility exports", async () => {
    const gateway = readFileSync(
      path.join(root, "src/features/court-resource/services/courtResourceGateway.js"),
      "utf8"
    );
    const compatibilityGateway = readFileSync(
      path.join(root, "src/features/venue-court/services/courtResourceGateway.js"),
      "utf8"
    );
    const adapter = readFileSync(
      path.join(root, "src/features/court-resource/adapters/legacyReservationAdapter.js"),
      "utf8"
    );
    const facade = readFileSync(
      path.join(root, "src/domain/tournamentBookingService.js"),
      "utf8"
    );
    const inventory = readFileSync(
      path.join(root, "src/features/venue-court/services/canonicalCloudCourtInventory.js"),
      "utf8"
    );
    assert.match(compatibilityGateway, /^\s*\/\/[^\n]*\nexport \* from /);
    assert.equal(legacyGatewayPath.reserveCourts, canonicalGateway.reserveCourts);
    assert.equal(legacyGatewayPath.releaseCourts, canonicalGateway.releaseCourts);
    assert.equal(legacyGatewayPath.validateCourtAssignment, canonicalGateway.validateCourtAssignment);
    assert.equal(legacyGatewayPath.__setCourtResourceGatewayDepsForTests, canonicalGateway.__setCourtResourceGatewayDepsForTests);
    assert.equal(legacyContractPath.COURT_RESOURCE_CODE, canonicalContract.COURT_RESOURCE_CODE);
    assert.doesNotMatch(gateway, /tournamentBookingService|team-tournament|TEAM_TOURNAMENT|FormatVenue/);
    assert.doesNotMatch(adapter, /tournamentBookingService|team-tournament|features[\\/]court-engine|features[\\/]ai/);
    assert.doesNotMatch(adapter, /courtResourceGateway|court-resource[\\/]index/);
    assert.match(facade, /features\/court-resource/);
    assert.doesNotMatch(facade, /from ["'].*bookingService|from ["'].*clubStorage|from ["'].*courtBookingEngine/);
    assert.doesNotMatch(inventory, /team-tournament|localStorage\.getItem|loadCourtsForClub/);
    assert.match(inventory, /club_data_v3/);
  });

  test("team tournament inventory is compatibility-only", async () => {
    const adapter = readFileSync(
      path.join(root, "src/features/team-tournament/services/canonicalClubCourtInventory.js"),
      "utf8"
    );
    assert.match(adapter, /club_data_v3/);
    assert.match(adapter, /canonicalCloudCourtInventory/);
    assert.doesNotMatch(adapter, /localStorage\.getItem|loadCourtsForClub|loadClubData/);
  });

  test("no new SQL authority in this foundation", async () => {
    const doc = readFileSync(
      path.join(root, "docs/v5/SHARED_COURT_RESOURCE_FOUNDATION.md"),
      "utf8"
    );
    assert.match(doc, /No new booking table/);
    assert.match(doc, /Court Cluster/);
    assert.match(doc, /Physical Court/);
  });
});
