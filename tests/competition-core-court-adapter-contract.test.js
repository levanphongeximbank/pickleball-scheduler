/**
 * Competition Court Adapter Contract (ĐẦU A) — focused contract tests.
 */
import test, { afterEach, beforeEach, describe } from "node:test";
import assert from "node:assert/strict";
import { setActiveClubId, DEFAULT_CLUB, saveClubs } from "../src/data/club.js";
import {
  saveBookingsForClub,
  saveCourtsForClub,
} from "../src/domain/clubStorage.js";
import { saveCourtManagementSettings } from "../src/domain/courtManagementSettings.js";
import { normalizeCourt } from "../src/models/court.js";
import {
  COURT_RESOURCE_CODE,
  OWNERSHIP_STATUS,
} from "../src/features/court-resource/index.js";
import {
  __resetCourtResourceGatewayDepsForTests,
  __setCourtResourceGatewayDepsForTests,
} from "../src/features/court-resource/services/courtResourceGateway.js";
import { createCanonicalInventoryReader } from "../src/features/court-resource/services/canonicalCourtInventoryService.js";
import {
  COMPETITION_COURT_ADAPTER_CONTRACT_VERSION,
  COMPETITION_COURT_ADAPTER_CAPABILITY,
  COMPETITION_COURT_ERROR_CODE,
  COMPETITION_COURT_RESULT_CODE,
  COMPETITION_RESERVATION_OWNER_TYPE,
  COMPETITION_TYPE,
  createSharedContractCapabilityGap,
  hasCourtCountWithoutPhysicalIds,
  hasDisplayIdentityWithoutPhysicalIds,
  isSupportedCompetitionCourtCapability,
  isWholeClusterReservationAttempt,
} from "../src/features/competition-core/contracts/competitionCourtAdapterContract.js";
import {
  createCourtResourceCompetitionAdapter,
  courtResourceCompetitionAdapter,
} from "../src/features/competition-core/adapters/courtResourceCompetitionAdapter.js";

const CLUB_ID = "club-nl";
const TENANT_A = "tenant-a";
const CLUSTER = "NAM_LONG";
const DATE = "2026-08-15";
const CAPACITY = { date: DATE, startTime: "08:00", endTime: "18:00" };
const MATCH = { date: DATE, startTime: "10:00", endTime: "10:30" };
const PHYSICAL = ["NL_C01", "NL_C02", "NL_C03", "NL_C04"];
const CANONICAL_PHYSICAL = [
  "11111111-1111-4111-8111-111111111111",
  "22222222-2222-4222-8222-222222222222",
  "33333333-3333-4333-8333-333333333333",
  "44444444-4444-4444-8444-444444444444",
];

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

function seedCourts() {
  saveClubs([{ id: CLUB_ID, name: "CLB Nam Long", venueId: TENANT_A }]);
  saveCourtsForClub(
    PHYSICAL.map((id, index) =>
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
    ),
    CLUB_ID
  );
  saveBookingsForClub([], CLUB_ID);
  saveCourtManagementSettings(CLUB_ID, { openHour: 6, closeHour: 22 });
}

function bindCanonicalEligibleCourts() {
  __setCourtResourceGatewayDepsForTests({
    listEligiblePhysicalCourts: createCanonicalInventoryReader({
      clubs: [{ id: CLUB_ID, tenantId: TENANT_A }],
      clusters: [{ id: CLUSTER, tenantId: TENANT_A, venueId: TENANT_A }],
      physicalCourts: CANONICAL_PHYSICAL.map((physicalCourtId, index) => ({
        physicalCourtId,
        tenantId: TENANT_A,
        clusterId: CLUSTER,
        displayName: `Nam Long ${index + 1}`,
        displayCode: PHYSICAL[index],
        displayNumber: String(index + 1),
        sortOrder: index + 1,
        lifecycleStatus: "active",
      })),
      clubOperationalAccess: CANONICAL_PHYSICAL.map((physicalCourtId) => ({
        tenantId: TENANT_A,
        clubId: CLUB_ID,
        physicalCourtId,
        status: "enabled",
      })),
    }),
  });
}

function baseInput(extra = {}) {
  return {
    tenantId: TENANT_A,
    competitionId: "COMP-01",
    competitionType: COMPETITION_TYPE.INTERNAL,
    clubId: CLUB_ID,
    clusterId: CLUSTER,
    actorId: "actor-1",
    ...extra,
  };
}

function recordingGateway(handlers = {}) {
  const calls = [];
  const wrap = (name, fallback) => (options) => {
    calls.push({ name, options });
    if (handlers[name]) return handlers[name](options);
    return fallback(options);
  };
  return {
    calls,
    listEligibleCourts: wrap("listEligibleCourts", () => ({ ok: true, code: "OK", courts: [] })),
    getCourtAvailability: wrap("getCourtAvailability", () => ({ courts: [] })),
    reserveCourts: wrap("reserveCourts", () => ({
      ok: true,
      code: "OK",
      selectedCourtIds: [],
    })),
    releaseCourts: wrap("releaseCourts", () => ({ ok: true, code: "OK", cancelled: [] })),
    validateCourtAssignment: wrap("validateCourtAssignment", () => ({
      ok: true,
      valid: true,
      code: COURT_RESOURCE_CODE.ASSIGNMENT_VALID,
      courtId: "NL_C01",
      ownership: { status: OWNERSHIP_STATUS.OWN_RESERVATION, owner: { type: "tournament", id: "COMP-01" } },
    })),
  };
}

describe("contract surface", () => {
  test("one authoritative contract version exists", async () => {
    assert.equal(COMPETITION_COURT_ADAPTER_CONTRACT_VERSION, 1);
    assert.equal(courtResourceCompetitionAdapter.contractVersion, 1);
    assert.deepEqual(
      Object.values(COMPETITION_COURT_ADAPTER_CAPABILITY).sort(),
      [
        "getCourtAvailability",
        "listEligibleCourts",
        "releaseCourts",
        "reserveCourts",
        "validateMatchAssignment",
      ]
    );
  });

  test("physicalCourtId is identity; courtLabel and courtCount are not", async () => {
    assert.equal(
      hasDisplayIdentityWithoutPhysicalIds({ courtLabel: "Sân 1", clusterId: CLUSTER }),
      true
    );
    assert.equal(
      hasDisplayIdentityWithoutPhysicalIds({
        courtLabel: "Sân 1",
        physicalCourtId: "NL_C01",
      }),
      false
    );
    assert.equal(hasCourtCountWithoutPhysicalIds({ courtCount: 4, clusterId: CLUSTER }), true);
    assert.equal(
      hasCourtCountWithoutPhysicalIds({ courtCount: 4, physicalCourtIds: ["NL_C01"] }),
      false
    );
    assert.equal(isWholeClusterReservationAttempt({ clusterId: CLUSTER }), true);
    assert.equal(
      isWholeClusterReservationAttempt({ clusterId: CLUSTER, physicalCourtIds: [CLUSTER] }),
      true
    );
    assert.equal(
      isWholeClusterReservationAttempt({
        clusterId: CLUSTER,
        physicalCourtIds: ["NL_C01", "NL_C02"],
      }),
      false
    );
  });

  test("unknown capability is SHARED_CONTRACT_CAPABILITY_GAP", async () => {
    assert.equal(isSupportedCompetitionCourtCapability("assignByCourtCount"), false);
    const gap = await courtResourceCompetitionAdapter.invoke("assignByCourtCount", {});
    assert.equal(gap.code, COMPETITION_COURT_ERROR_CODE.SHARED_CONTRACT_CAPABILITY_GAP);
    assert.equal(createSharedContractCapabilityGap("x").ok, false);
  });
});

describe("neutral adapter → CourtResourceGateway", () => {
  test("listEligibleCourts and reserveCourts call the gateway with physical ids", async () => {
    const gateway = recordingGateway({
      listEligibleCourts: () => ({
        ok: true,
        courts: [{ id: "NL_C01", name: "Nam Long 1", clusterId: CLUSTER, number: 1 }],
      }),
      reserveCourts: (options) => ({
        ok: true,
        selectedCourtIds: options.selectedCourtIds,
      }),
    });
    const adapter = createCourtResourceCompetitionAdapter(gateway);

    const listed = await adapter.listEligibleCourts(baseInput({ physicalCourtIds: ["NL_C01"] }));
    assert.equal(listed.ok, true);
    assert.equal(listed.contractVersion, 1);
    assert.equal(listed.courts[0].physicalCourtId, "NL_C01");
    assert.equal(listed.courts[0].courtLabel, "Nam Long 1");
    assert.equal(gateway.calls[0].name, "listEligibleCourts");
    assert.deepEqual(gateway.calls[0].options.physicalCourtIds, ["NL_C01"]);
    assert.equal(gateway.calls[0].options.selectedCourtIds, undefined);
    assert.equal(gateway.calls[0].options.courtIds, undefined);
    assert.equal(gateway.calls[0].options.owner.type, "tournament");
    assert.equal(gateway.calls[0].options.owner.id, "COMP-01");

    const reserved = await adapter.reserveCourts(
      baseInput({ physicalCourtIds: ["NL_C01", "NL_C02"], ...CAPACITY })
    );
    assert.equal(reserved.ok, true);
    assert.deepEqual(
      reserved.reserved.map((row) => row.physicalCourtId),
      ["NL_C01", "NL_C02"]
    );
    const reserveCall = gateway.calls.find((call) => call.name === "reserveCourts");
    assert.deepEqual(reserveCall.options.physicalCourtIds, ["NL_C01", "NL_C02"]);
    assert.equal(reserveCall.options.selectedCourtIds, undefined);
    assert.equal(reserveCall.options.courtIds, undefined);
    assert.equal(reserveCall.options.owner.type, "tournament");
  });

  test("courtLabel cannot become identity authority", async () => {
    const gateway = recordingGateway();
    const adapter = createCourtResourceCompetitionAdapter(gateway);
    const result = await adapter.reserveCourts(
      baseInput({ courtLabel: "Sân VIP", ...CAPACITY })
    );
    assert.equal(result.ok, false);
    assert.equal(result.code, COMPETITION_COURT_ERROR_CODE.SYNTHETIC_COURT_DENIED);
    assert.equal(
      gateway.calls.some((call) => call.name === "reserveCourts"),
      false
    );
  });

  test("courtCount cannot become reservation authority", async () => {
    const gateway = recordingGateway();
    const adapter = createCourtResourceCompetitionAdapter(gateway);
    const result = await adapter.reserveCourts(baseInput({ courtCount: 6, ...CAPACITY }));
    assert.equal(result.ok, false);
    assert.equal(result.code, COMPETITION_COURT_ERROR_CODE.COURT_COUNT_RESERVATION_DENIED);
    assert.equal(
      gateway.calls.some((call) => call.name === "reserveCourts"),
      false
    );
  });

  test("cluster does not imply whole-cluster reservation", async () => {
    const gateway = recordingGateway();
    const adapter = createCourtResourceCompetitionAdapter(gateway);
    const result = await adapter.reserveCourts(baseInput({ ...CAPACITY }));
    assert.equal(result.ok, false);
    assert.equal(result.code, COMPETITION_COURT_ERROR_CODE.WHOLE_CLUSTER_DENIED);
    assert.equal(
      gateway.calls.some((call) => call.name === "reserveCourts"),
      false
    );
  });

  test("OWN_RESERVATION is preserved on availability", async () => {
    const gateway = recordingGateway({
      getCourtAvailability: () => ({
        courts: [
          {
            available: true,
            courtId: "NL_C01",
            court: { id: "NL_C01", name: "Nam Long 1", clusterId: CLUSTER },
            ownership: {
              status: OWNERSHIP_STATUS.OWN_RESERVATION,
              owner: { type: "tournament", id: "COMP-01" },
              reservationId: "res-1",
            },
            reasons: [],
            conflicts: [],
          },
        ],
      }),
    });
    const adapter = createCourtResourceCompetitionAdapter(gateway);
    const result = await adapter.getCourtAvailability(
      baseInput({ physicalCourtIds: ["NL_C01"], ...MATCH })
    );
    assert.equal(result.ok, true);
    assert.equal(result.courts[0].available, true);
    assert.equal(result.courts[0].resultCode, COMPETITION_COURT_RESULT_CODE.OWN_RESERVATION);
    assert.equal(result.courts[0].ownership.owner.ownerType, COMPETITION_RESERVATION_OWNER_TYPE);
    assert.equal(result.courts[0].ownership.owner.ownerId, "COMP-01");
  });

  test("FOREIGN_RESERVATION fails closed on reserve and availability", async () => {
    const gateway = recordingGateway({
      reserveCourts: () => ({
        ok: false,
        code: COURT_RESOURCE_CODE.FOREIGN_RESERVATION_CONFLICT,
        error: "Foreign reservation",
      }),
      getCourtAvailability: () => ({
        courts: [
          {
            available: false,
            courtId: "NL_C01",
            court: { id: "NL_C01", clusterId: CLUSTER },
            ownership: { status: OWNERSHIP_STATUS.FOREIGN },
            conflicts: [{ code: COURT_RESOURCE_CODE.FOREIGN_RESERVATION_CONFLICT }],
            reasons: ["foreign"],
          },
        ],
      }),
    });
    const adapter = createCourtResourceCompetitionAdapter(gateway);
    const reserved = await adapter.reserveCourts(
      baseInput({ physicalCourtIds: ["NL_C01"], ...CAPACITY })
    );
    assert.equal(reserved.ok, false);
    assert.equal(reserved.code, COMPETITION_COURT_RESULT_CODE.FOREIGN_RESERVATION);

    const availability = await adapter.getCourtAvailability(
      baseInput({ physicalCourtIds: ["NL_C01"], ...MATCH })
    );
    assert.equal(availability.courts[0].available, false);
    assert.equal(
      availability.courts[0].resultCode,
      COMPETITION_COURT_RESULT_CODE.FOREIGN_RESERVATION
    );
  });

  test("unknown and out-of-scope Physical Courts fail closed", async () => {
    const gateway = recordingGateway({
      listEligibleCourts: () => ({
        ok: false,
        code: COURT_RESOURCE_CODE.COURT_NOT_FOUND,
        error: "Unknown court",
      }),
      validateCourtAssignment: () => ({
        ok: false,
        code: COURT_RESOURCE_CODE.COURT_NOT_IN_OWNER_SCOPE,
        error: "out of scope",
      }),
    });
    const adapter = createCourtResourceCompetitionAdapter(gateway);
    const unknown = await adapter.listEligibleCourts(
      baseInput({ physicalCourtIds: ["MISSING"] })
    );
    assert.equal(unknown.ok, false);
    assert.equal(unknown.code, COMPETITION_COURT_RESULT_CODE.UNKNOWN_COURT);

    const assignment = await adapter.validateMatchAssignment(
      baseInput({
        matchId: "M-1",
        physicalCourtId: "NL_C99",
        ...MATCH,
      })
    );
    assert.equal(assignment.ok, false);
    assert.equal(assignment.valid, false);
    assert.equal(assignment.code, COMPETITION_COURT_RESULT_CODE.OUT_OF_SCOPE);
  });

  test("match assignment validates physicalCourtId and rejects courtLabel identity", async () => {
    const gateway = recordingGateway();
    const adapter = createCourtResourceCompetitionAdapter(gateway);
    const labeled = await adapter.validateMatchAssignment(
      baseInput({ matchId: "M-1", courtLabel: "Sân 1", ...MATCH })
    );
    assert.equal(labeled.ok, false);
    assert.equal(labeled.code, COMPETITION_COURT_ERROR_CODE.SYNTHETIC_COURT_DENIED);

    const valid = await adapter.validateMatchAssignment(
      baseInput({ matchId: "M-1", physicalCourtId: "NL_C01", ...MATCH })
    );
    assert.equal(valid.ok, true);
    assert.equal(valid.valid, true);
    assert.equal(valid.physicalCourtId, "NL_C01");
    assert.equal(valid.matchId, "M-1");
    const call = gateway.calls.find((item) => item.name === "validateCourtAssignment");
    assert.equal(call.options.physicalCourtId, "NL_C01");
    assert.deepEqual(call.options.physicalCourtIds, ["NL_C01"]);
    assert.equal(call.options.courtId, undefined);
  });

  test("Phase 3B can replace the gateway implementation without changing the public contract", async () => {
    const phase3bGateway = recordingGateway({
      listEligibleCourts: () => ({
        ok: true,
        courts: [{ physicalCourtId: "uuid-c01", id: "uuid-c01", name: "C01", clusterId: CLUSTER }],
      }),
      reserveCourts: () => ({ ok: true, selectedCourtIds: ["uuid-c01"] }),
    });
    const adapter = createCourtResourceCompetitionAdapter(phase3bGateway);
    assert.equal(adapter.contractVersion, COMPETITION_COURT_ADAPTER_CONTRACT_VERSION);
    assert.ok(typeof adapter.listEligibleCourts === "function");
    assert.ok(typeof adapter.getCourtAvailability === "function");
    assert.ok(typeof adapter.reserveCourts === "function");
    assert.ok(typeof adapter.releaseCourts === "function");
    assert.ok(typeof adapter.validateMatchAssignment === "function");

    const listed = await adapter.listEligibleCourts(baseInput());
    assert.equal(listed.contractVersion, 1);
    assert.equal(listed.courts[0].physicalCourtId, "uuid-c01");
    const reserved = await adapter.reserveCourts(
      baseInput({ physicalCourtIds: ["uuid-c01"], ...CAPACITY })
    );
    assert.equal(reserved.ok, true);
    assert.equal(reserved.reserved[0].physicalCourtId, "uuid-c01");
  });
});

describe("live gateway binding", () => {
  beforeEach(() => {
    globalThis.localStorage = createLocalStorageMock();
    setActiveClubId(DEFAULT_CLUB.id);
    __resetCourtResourceGatewayDepsForTests();
    seedCourts();
    bindCanonicalEligibleCourts();
  });

  afterEach(() => {
    __resetCourtResourceGatewayDepsForTests();
    delete globalThis.localStorage;
  });

  test("reserve / own availability / foreign fail-closed / match assignment", async () => {
    const store = [];
    let resolverCalls = 0;
    __setCourtResourceGatewayDepsForTests({
      listEligiblePhysicalCourts: createCanonicalInventoryReader({
        clubs: [{ id: CLUB_ID, tenantId: TENANT_A }],
        clusters: [{ id: CLUSTER, tenantId: TENANT_A, venueId: TENANT_A }],
        physicalCourts: CANONICAL_PHYSICAL.map((physicalCourtId, index) => ({
          physicalCourtId,
          tenantId: TENANT_A,
          clusterId: CLUSTER,
          displayName: `Nam Long ${index + 1}`,
          displayCode: PHYSICAL[index],
          displayNumber: String(index + 1),
          sortOrder: index + 1,
          lifecycleStatus: "active",
        })),
        clubOperationalAccess: CANONICAL_PHYSICAL.map((physicalCourtId) => ({
          tenantId: TENANT_A,
          clubId: CLUB_ID,
          physicalCourtId,
          status: "enabled",
        })),
      }),
      isCanonicalReservationCutover: () => false,
      resolveLegacyPhysicalCourt: () => {
        resolverCalls += 1;
        return { ok: false, code: "UNRESOLVED_MAPPING" };
      },
      canonicalReserve: (payload) => {
        const conflict = store.find(
          (row) =>
            row.physicalCourtIds.some((id) => payload.physicalCourtIds.includes(id))
            && row.startsAt < payload.endsAt
            && payload.startsAt < row.endsAt
            && !(row.ownerType === payload.ownerType && row.ownerId === payload.ownerId)
        );
        if (conflict) {
          return { ok: false, code: COURT_RESOURCE_CODE.FOREIGN_RESERVATION_CONFLICT };
        }
        store.push(payload);
        return {
          ok: true,
          reservationIds: payload.physicalCourtIds.map((id) => `res-${id}`),
          reservations: payload.physicalCourtIds.map((id) => ({
            reservationId: `res-${id}`,
            physicalCourtId: id,
            status: "active",
          })),
          physicalCourtIds: payload.physicalCourtIds,
        };
      },
      canonicalGetAvailability: (payload) => ({
        ok: true,
        courts: payload.physicalCourtIds.map((id) => {
          const hit = store.find((row) => row.physicalCourtIds.includes(id));
          if (!hit) {
            return { physicalCourtId: id, status: "AVAILABLE" };
          }
          const own = hit.ownerType === payload.ownerType && hit.ownerId === payload.ownerId;
          return {
            physicalCourtId: id,
            status: own ? "OWN_RESERVATION" : "FOREIGN_RESERVATION",
          };
        }),
      }),
      canonicalRelease: (payload) => ({
        ok: true,
        releasedReservationIds: ["rel-1"],
        physicalCourtIds: payload.physicalCourtIds || [],
      }),
    });

    const adapter = createCourtResourceCompetitionAdapter();
    const reserved = await adapter.reserveCourts(
      baseInput({
        physicalCourtIds: [CANONICAL_PHYSICAL[0], CANONICAL_PHYSICAL[1]],
        ...CAPACITY,
      })
    );
    assert.equal(reserved.ok, true, reserved.error);
    assert.deepEqual(
      reserved.reserved.map((row) => row.physicalCourtId).sort(),
      [CANONICAL_PHYSICAL[0], CANONICAL_PHYSICAL[1]].sort()
    );
    assert.deepEqual(store[0].physicalCourtIds.sort(), [CANONICAL_PHYSICAL[0], CANONICAL_PHYSICAL[1]].sort());
    assert.equal(resolverCalls, 0);

    const own = await adapter.getCourtAvailability(
      baseInput({ physicalCourtIds: [CANONICAL_PHYSICAL[0]], ...MATCH })
    );
    assert.equal(own.courts[0].available, true);
    assert.equal(own.courts[0].resultCode, COMPETITION_COURT_RESULT_CODE.OWN_RESERVATION);

    const foreign = await adapter.getCourtAvailability(
      baseInput({
        competitionId: "COMP-FOREIGN",
        physicalCourtIds: [CANONICAL_PHYSICAL[0]],
        ...MATCH,
      })
    );
    assert.equal(foreign.courts[0].available, false);
    assert.equal(foreign.courts[0].resultCode, COMPETITION_COURT_RESULT_CODE.FOREIGN_RESERVATION);

    const foreignReserve = await adapter.reserveCourts(
      baseInput({
        competitionId: "COMP-FOREIGN",
        physicalCourtIds: [CANONICAL_PHYSICAL[0]],
        ...CAPACITY,
      })
    );
    assert.equal(foreignReserve.ok, false);
    assert.equal(foreignReserve.code, COMPETITION_COURT_RESULT_CODE.FOREIGN_RESERVATION);

    const assignment = await adapter.validateMatchAssignment(
      baseInput({
        matchId: "M-12",
        physicalCourtId: CANONICAL_PHYSICAL[0],
        ...MATCH,
      })
    );
    assert.equal(assignment.ok, true, assignment.error);
    assert.equal(assignment.valid, true);
    assert.equal(assignment.physicalCourtId, CANONICAL_PHYSICAL[0]);

    const unknown = await adapter.validateMatchAssignment(
      baseInput({
        matchId: "M-99",
        physicalCourtId: "MISSING",
        ...MATCH,
      })
    );
    assert.equal(unknown.ok, false);
    assert.equal(unknown.valid, false);

    const released = await adapter.releaseCourts(
      baseInput({ physicalCourtIds: [CANONICAL_PHYSICAL[0], CANONICAL_PHYSICAL[1]] })
    );
    assert.equal(released.ok, true, released.error);
    assert.equal(resolverCalls, 0);
  });

  test("listEligibleCourts returns Physical Courts in competition scope, not whole-cluster reservation", async () => {
    const adapter = createCourtResourceCompetitionAdapter();
    const listed = await adapter.listEligibleCourts(baseInput());
    assert.equal(listed.ok, true, listed.error);
    assert.ok(listed.courts.length >= 2);
    assert.ok(listed.courts.every((court) => court.physicalCourtId));
    assert.ok(listed.courts.every((court) => court.physicalCourtId !== CLUSTER));
  });
});
