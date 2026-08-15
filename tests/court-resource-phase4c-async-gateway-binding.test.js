import assert from "node:assert/strict";
import test, { beforeEach, afterEach } from "node:test";
import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import {
  __resetCanonicalReservationCutoverForTests,
  __setCanonicalReservationCutoverForTests,
} from "../src/features/court-resource/constants/canonicalReservation.js";
import { COURT_RESOURCE_CODE } from "../src/features/court-resource/constants/courtResourceContract.js";
import {
  __resetCourtResourceGatewayDepsForTests,
  __setCourtResourceGatewayDepsForTests,
  getCourtAvailability,
  releaseCourts,
  reserveCourts,
  validateCourtAssignment,
} from "../src/features/court-resource/services/courtResourceGateway.js";
import {
  productionCanonicalGetAvailability,
  productionCanonicalRelease,
  productionCanonicalReserve,
} from "../src/features/court-resource/runtime/canonicalReservationRuntime.js";
import {
  rpcGetAvailability,
  rpcReleaseCourts,
  rpcReserveCourts,
} from "../src/features/court-resource/services/canonicalReservationClient.js";
import { createCourtResourceCompetitionAdapter } from "../src/features/competition-core/adapters/courtResourceCompetitionAdapter.js";
import {
  COMPETITION_COURT_ADAPTER_CONTRACT_VERSION,
  COMPETITION_COURT_RESULT_CODE,
} from "../src/features/competition-core/contracts/competitionCourtAdapterContract.js";
import {
  __bindCanonicalBookingGateway,
  __resetCanonicalBookingGatewayForTests,
  createBooking,
  extendBookingTime,
  transferBookingCourt,
  updateBookingStatus,
} from "../src/domain/bookingService.js";
import {
  getDefaultClubData,
  saveBookingsForClub,
  saveClubData,
  saveCourtsForClub,
} from "../src/domain/clubStorage.js";
import { setActiveClubId } from "../src/data/club.js";
import { normalizeCourt } from "../src/models/court.js";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const COURT01 = "11111111-1111-4111-8111-111111111111";
const COURT02 = "22222222-2222-4222-8222-222222222222";
const CLUB = "club-async-phase4c";

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
  setActiveClubId(CLUB);
  const data = getDefaultClubData(CLUB);
  data.courts = [
    normalizeCourt({ id: "c1", name: "Court 1", number: 1, active: true }),
    normalizeCourt({ id: "c2", name: "Court 2", number: 2, active: true }),
  ];
  data.bookings = [];
  saveClubData(CLUB, data);
}

beforeEach(() => {
  globalThis.localStorage = createLocalStorageMock();
  seedClub();
  __resetCanonicalReservationCutoverForTests();
  __resetCanonicalBookingGatewayForTests();
  __resetCourtResourceGatewayDepsForTests();
});

afterEach(() => {
  __resetCanonicalReservationCutoverForTests();
  __resetCanonicalBookingGatewayForTests();
  __resetCourtResourceGatewayDepsForTests();
});

function baseWindow(extra = {}) {
  return {
    clubId: CLUB,
    tenantId: "tenant-async",
    date: "2026-08-15",
    startTime: "10:00",
    endTime: "11:00",
    canonicalReservationCutover: true,
    ...extra,
  };
}

function delay(ms = 0) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

test("production runtime binds canonicalReserve/release/availability to RPC client", () => {
  assert.equal(productionCanonicalReserve, rpcReserveCourts);
  assert.equal(productionCanonicalRelease, rpcReleaseCourts);
  assert.equal(productionCanonicalGetAvailability, rpcGetAvailability);
  const gatewaySource = readFileSync(
    path.join(root, "src/features/court-resource/services/courtResourceGateway.js"),
    "utf8"
  );
  assert.match(gatewaySource, /canonicalReserve:\s*productionCanonicalReserve/);
  assert.match(gatewaySource, /canonicalRelease:\s*productionCanonicalRelease/);
  assert.match(gatewaySource, /canonicalGetAvailability:\s*productionCanonicalGetAvailability/);
  assert.doesNotMatch(
    gatewaySource,
    /Canonical reservation adapter at the gateway boundary must be synchronous/
  );
  assert.match(gatewaySource, /async function invokeCanonicalAdapter/);
});

test("async reserve Promise resolves success", async () => {
  __setCourtResourceGatewayDepsForTests({
    isCanonicalReservationCutover: () => true,
    canonicalReserve: async () => {
      await delay(1);
      return {
        ok: true,
        reservationIds: ["r1"],
        reservations: [{ reservationId: "r1", physicalCourtId: COURT01 }],
      };
    },
  });
  const result = await reserveCourts(
    baseWindow({
      physicalCourtIds: [COURT01],
      owner: { type: "booking", id: "b1" },
      requestId: "req-success",
    })
  );
  assert.equal(result.ok, true);
  assert.equal(result.capacityAuthority, "canonical_reservation");
  __resetCourtResourceGatewayDepsForTests();
});

test("async reserve Promise resolves fail-closed", async () => {
  __setCourtResourceGatewayDepsForTests({
    isCanonicalReservationCutover: () => true,
    canonicalReserve: async () => {
      await delay(1);
      return { ok: false, code: COURT_RESOURCE_CODE.FOREIGN_RESERVATION_CONFLICT, error: "busy" };
    },
  });
  const result = await reserveCourts(
    baseWindow({
      physicalCourtIds: [COURT01],
      owner: { type: "booking", id: "b1" },
      requestId: "req-fail",
    })
  );
  assert.equal(result.ok, false);
  assert.equal(result.code, COURT_RESOURCE_CODE.FOREIGN_RESERVATION_CONFLICT);
  __resetCourtResourceGatewayDepsForTests();
});

test("async reserve Promise rejection fails closed", async () => {
  __setCourtResourceGatewayDepsForTests({
    isCanonicalReservationCutover: () => true,
    canonicalReserve: async () => {
      await delay(1);
      throw new Error("rpc transport down");
    },
  });
  const result = await reserveCourts(
    baseWindow({
      physicalCourtIds: [COURT01],
      owner: { type: "booking", id: "b1" },
      requestId: "req-reject",
    })
  );
  assert.equal(result.ok, false);
  assert.equal(result.code, COURT_RESOURCE_CODE.CANONICAL_PATH_UNAVAILABLE);
  assert.match(result.error, /rpc transport down/);
  __resetCourtResourceGatewayDepsForTests();
});

test("async release success/failure/rejection", async () => {
  __setCourtResourceGatewayDepsForTests({
    isCanonicalReservationCutover: () => true,
    canonicalRelease: async () => {
      await delay(1);
      return { ok: true, releasedReservationIds: ["r1"] };
    },
  });
  const ok = await releaseCourts(
    baseWindow({
      owner: { type: "booking", id: "b1" },
      requestId: "rel-ok",
    })
  );
  assert.equal(ok.ok, true);

  __setCourtResourceGatewayDepsForTests({
    isCanonicalReservationCutover: () => true,
    canonicalRelease: async () => ({ ok: false, code: COURT_RESOURCE_CODE.DATA_UNAVAILABLE }),
  });
  const fail = await releaseCourts(
    baseWindow({
      owner: { type: "booking", id: "b1" },
      requestId: "rel-fail",
    })
  );
  assert.equal(fail.ok, false);

  __setCourtResourceGatewayDepsForTests({
    isCanonicalReservationCutover: () => true,
    canonicalRelease: async () => {
      throw new Error("release boom");
    },
  });
  const rejected = await releaseCourts(
    baseWindow({
      owner: { type: "booking", id: "b1" },
      requestId: "rel-reject",
    })
  );
  assert.equal(rejected.ok, false);
  assert.equal(rejected.code, COURT_RESOURCE_CODE.CANONICAL_PATH_UNAVAILABLE);
  __resetCourtResourceGatewayDepsForTests();
});

test("async availability success/failure/rejection", async () => {
  __setCourtResourceGatewayDepsForTests({
    isCanonicalReservationCutover: () => true,
    canonicalGetAvailability: async () => {
      await delay(1);
      return {
        ok: true,
        courts: [{ physicalCourtId: COURT01, status: "AVAILABLE" }],
      };
    },
  });
  const ok = await getCourtAvailability(
    baseWindow({
      physicalCourtIds: [COURT01],
      owner: { type: "booking", id: "b1" },
    })
  );
  assert.equal(ok.ok, true);
  assert.equal(ok.courts[0].available, true);

  __setCourtResourceGatewayDepsForTests({
    isCanonicalReservationCutover: () => true,
    canonicalGetAvailability: async () => ({
      ok: false,
      code: COURT_RESOURCE_CODE.DATA_UNAVAILABLE,
    }),
  });
  const fail = await getCourtAvailability(
    baseWindow({
      physicalCourtIds: [COURT01],
      owner: { type: "booking", id: "b1" },
    })
  );
  assert.equal(fail.ok, false);
  assert.deepEqual(fail.courts, []);

  __setCourtResourceGatewayDepsForTests({
    isCanonicalReservationCutover: () => true,
    canonicalGetAvailability: async () => {
      throw new Error("availability boom");
    },
  });
  const rejected = await getCourtAvailability(
    baseWindow({
      physicalCourtIds: [COURT01],
      owner: { type: "booking", id: "b1" },
    })
  );
  assert.equal(rejected.ok, false);
  assert.equal(rejected.code, COURT_RESOURCE_CODE.CANONICAL_PATH_UNAVAILABLE);
  __resetCourtResourceGatewayDepsForTests();
});

test("OFF path returns Promise and resolves legacy behavior", async () => {
  __resetCanonicalReservationCutoverForTests();
  __setCourtResourceGatewayDepsForTests({
    isCanonicalReservationCutover: () => false,
    listCourts: () => [{ id: "c1", name: "Court 1", active: true, status: "active" }],
    assertCourtClusterMembership: () => ({ ok: true, court: { id: "c1", name: "Court 1" } }),
    createBooking: async (payload) => ({ ok: true, booking: { ...payload, id: payload.id } }),
  });
  const pending = reserveCourts({
    clubId: CLUB,
    tenantId: "tenant-async",
    courtIds: ["c1"],
    owner: { type: "booking", id: "legacy-1" },
    date: "2026-08-15",
    startTime: "10:00",
    endTime: "11:00",
    requestId: "legacy-req",
    canonicalReservationCutover: false,
  });
  assert.equal(typeof pending.then, "function");
  const result = await pending;
  assert.equal(result.ok, true);
  assert.notEqual(result.capacityAuthority, "canonical_reservation");
  __resetCourtResourceGatewayDepsForTests();
});

test("unbound canonical adapter under ON fails closed", async () => {
  __setCanonicalReservationCutoverForTests(true);
  __setCourtResourceGatewayDepsForTests({
    isCanonicalReservationCutover: () => true,
    canonicalReserve: null,
    canonicalRelease: null,
    canonicalGetAvailability: null,
  });
  const reserved = await reserveCourts(
    baseWindow({
      physicalCourtIds: [COURT01],
      owner: { type: "booking", id: "b1" },
      requestId: "unbound",
    })
  );
  assert.equal(reserved.ok, false);
  assert.equal(reserved.code, COURT_RESOURCE_CODE.CANONICAL_PATH_UNAVAILABLE);
  __resetCourtResourceGatewayDepsForTests();
  __resetCanonicalReservationCutoverForTests();
});

test("validateCourtAssignment awaits canonical availability", async () => {
  let availabilityCalls = 0;
  __setCourtResourceGatewayDepsForTests({
    isCanonicalReservationCutover: () => true,
    canonicalGetAvailability: async () => {
      availabilityCalls += 1;
      await delay(1);
      return {
        ok: true,
        courts: [{ physicalCourtId: COURT01, status: "OWN_RESERVATION" }],
      };
    },
  });
  const result = await validateCourtAssignment(
    baseWindow({
      physicalCourtIds: [COURT01],
      owner: { type: "booking", id: "b1" },
    })
  );
  assert.equal(availabilityCalls, 1);
  assert.equal(result.ok, true);
  assert.equal(result.valid, true);
  __resetCourtResourceGatewayDepsForTests();
});

test("Competition V1 promise-backed binding preserves envelopes", async () => {
  const adapter = createCourtResourceCompetitionAdapter({
    reserveCourts: async () => {
      await delay(1);
      return {
        ok: true,
        code: COURT_RESOURCE_CODE.OK,
        selectedCourtIds: [COURT01],
      };
    },
    releaseCourts: async () => {
      await delay(1);
      return { ok: true, code: COURT_RESOURCE_CODE.OK, cancelled: [{ id: "r1", courtId: COURT01 }] };
    },
    getCourtAvailability: async () => {
      await delay(1);
      return {
        ok: true,
        courts: [
          {
            courtId: COURT01,
            available: true,
            ownership: { status: "UNRESERVED" },
            reasons: [],
            conflicts: [],
          },
        ],
      };
    },
    validateCourtAssignment: async () => {
      await delay(1);
      return {
        ok: true,
        valid: true,
        code: COURT_RESOURCE_CODE.ASSIGNMENT_VALID,
        courtId: COURT01,
        ownership: { status: "OWN_RESERVATION" },
      };
    },
  });

  assert.equal(adapter.contractVersion, COMPETITION_COURT_ADAPTER_CONTRACT_VERSION);
  const reserved = await adapter.reserveCourts({
    clubId: CLUB,
    tenantId: "tenant-async",
    competitionId: "comp-1",
    physicalCourtIds: [COURT01],
    date: "2026-08-15",
    startTime: "10:00",
    endTime: "11:00",
  });
  assert.equal(reserved.ok, true);
  assert.equal(reserved.contractVersion, 1);
  assert.deepEqual(reserved.reserved, [{ physicalCourtId: COURT01 }]);

  const availability = await adapter.getCourtAvailability({
    clubId: CLUB,
    tenantId: "tenant-async",
    competitionId: "comp-1",
    physicalCourtIds: [COURT01],
    date: "2026-08-15",
    startTime: "10:00",
    endTime: "11:00",
  });
  assert.equal(availability.ok, true);
  assert.equal(availability.courts[0].resultCode, COMPETITION_COURT_RESULT_CODE.AVAILABLE);

  const validated = await adapter.validateMatchAssignment({
    clubId: CLUB,
    tenantId: "tenant-async",
    competitionId: "comp-1",
    matchId: "m1",
    physicalCourtId: COURT01,
    date: "2026-08-15",
    startTime: "10:00",
    endTime: "11:00",
  });
  assert.equal(validated.ok, true);
  assert.equal(validated.valid, true);
  assert.equal(validated.code, COMPETITION_COURT_RESULT_CODE.ASSIGNMENT_VALID);

  const released = await adapter.releaseCourts({
    clubId: CLUB,
    tenantId: "tenant-async",
    competitionId: "comp-1",
    physicalCourtIds: [COURT01],
  });
  assert.equal(released.ok, true);
  assert.equal(released.released.length, 1);
});

test("booking create awaits canonical reserve and compensates on save failure", async () => {
  const active = new Map();
  const releases = [];
  saveCourtsForClub(
    [{ id: "c1", name: "Court 1", active: true, status: "active", number: 1 }],
    CLUB
  );
  saveBookingsForClub([], CLUB);

  __setCanonicalReservationCutoverForTests(true);
  __bindCanonicalBookingGateway({
    reserveCourts: async (payload) => {
      await delay(1);
      active.set(payload.requestId, payload);
      return {
        ok: true,
        reservationIds: [`res-${payload.requestId}`],
        reserved: [{ reservationId: `res-${payload.requestId}`, physicalCourtId: COURT01 }],
        physicalCourtIds: [COURT01],
      };
    },
    releaseCourts: async (payload) => {
      await delay(1);
      releases.push(payload.requestId);
      active.delete(payload.requestId.replace(/^booking-compensate:/, ""));
      return { ok: true, releasedReservationIds: ["compensated"] };
    },
  });

  // Force projection save failure by removing club courts mid-flight via invalid court after reserve.
  // Use a spy on create path: first reserve succeeds then saveBooking fails due to missing court.
  saveCourtsForClub([], CLUB);
  const failed = await createBooking(
    {
      id: "bk-compensate-1",
      courtId: "missing-court",
      date: "2026-08-15",
      startTime: "10:00",
      endTime: "11:00",
      customerName: "A",
      bookingStatus: "confirmed",
      physicalCourtId: COURT01,
    },
    CLUB
  );
  assert.equal(failed.ok, false);
  assert.equal(failed.compensated, true);
  assert.ok(releases.some((id) => String(id).includes("booking-compensate:bk-compensate-1")));

  saveCourtsForClub(
    [{ id: "c1", name: "Court 1", active: true, status: "active", number: 1 }],
    CLUB
  );
  const ok = await createBooking(
    {
      id: "bk-ok-1",
      courtId: "c1",
      date: "2026-08-15",
      startTime: "12:00",
      endTime: "13:00",
      customerName: "B",
      bookingStatus: "confirmed",
      totalAmount: 0,
      depositAmount: 0,
      paidAmount: 0,
      physicalCourtId: COURT01,
    },
    CLUB
  );
  assert.equal(ok.ok, true);
  assert.equal(ok.booking.reservationId, "res-bk-ok-1");

  __resetCanonicalBookingGatewayForTests();
  __resetCanonicalReservationCutoverForTests();
  saveBookingsForClub([], CLUB);
});

test("booking compensation release failure reports reconciliation", async () => {
  saveCourtsForClub([], CLUB);
  saveBookingsForClub([], CLUB);
  __setCanonicalReservationCutoverForTests(true);
  __bindCanonicalBookingGateway({
    reserveCourts: async () => ({
      ok: true,
      reservationIds: ["res-x"],
      physicalCourtIds: [COURT01],
      reserved: [{ reservationId: "res-x", physicalCourtId: COURT01 }],
    }),
    releaseCourts: async () => ({
      ok: false,
      code: COURT_RESOURCE_CODE.DATA_UNAVAILABLE,
      error: "release failed",
    }),
  });
  const result = await createBooking(
    {
      id: "bk-recon-1",
      courtId: "missing",
      date: "2026-08-15",
      startTime: "10:00",
      endTime: "11:00",
      customerName: "C",
      bookingStatus: "confirmed",
      physicalCourtId: COURT01,
    },
    CLUB
  );
  assert.equal(result.ok, false);
  assert.equal(result.code, COURT_RESOURCE_CODE.CANONICAL_RECONCILIATION_REQUIRED);
  assert.equal(result.reconciliationRequired, true);
  __resetCanonicalBookingGatewayForTests();
  __resetCanonicalReservationCutoverForTests();
});

test("booking reschedule keeps old reservation when target reserve fails", async () => {
  saveCourtsForClub(
    [
      { id: "c1", name: "Court 1", active: true, status: "active", number: 1 },
      { id: "c2", name: "Court 2", active: true, status: "active", number: 2 },
    ],
    CLUB
  );
  saveBookingsForClub(
    [
      {
        id: "bk-move-1",
        courtId: "c1",
        date: "2026-08-15",
        startTime: "10:00",
        endTime: "11:00",
        bookingStatus: "confirmed",
        bookingType: "single",
        customerName: "Move",
        totalAmount: 0,
        depositAmount: 0,
        paidAmount: 0,
        reservationId: "res-old",
        physicalCourtId: COURT01,
      },
    ],
    CLUB
  );

  const reserveCalls = [];
  const releaseCalls = [];
  __setCanonicalReservationCutoverForTests(true);
  __bindCanonicalBookingGateway({
    reserveCourts: async (payload) => {
      reserveCalls.push(payload.requestId);
      return {
        ok: false,
        code: COURT_RESOURCE_CODE.FOREIGN_RESERVATION_CONFLICT,
        error: "target busy",
      };
    },
    releaseCourts: async (payload) => {
      releaseCalls.push(payload.requestId);
      return { ok: true, releasedReservationIds: [] };
    },
  });

  const moved = await transferBookingCourt("bk-move-1", "c2", CLUB);
  assert.equal(moved.ok, false);
  assert.equal(reserveCalls.length, 1);
  assert.equal(releaseCalls.length, 0);

  const extended = await extendBookingTime("bk-move-1", 30, CLUB);
  assert.equal(extended.ok, false);
  assert.equal(releaseCalls.length, 0);

  __resetCanonicalBookingGatewayForTests();
  __resetCanonicalReservationCutoverForTests();
  saveBookingsForClub([], CLUB);
});

test("booking reschedule compensates target and retains old when projection save fails", async () => {
  saveCourtsForClub(
    [{ id: "c1", name: "Court 1", active: true, status: "active", number: 1 }],
    CLUB
  );
  saveBookingsForClub(
    [
      {
        id: "bk-move-2",
        courtId: "c1",
        date: "2026-08-15",
        startTime: "10:00",
        endTime: "11:00",
        bookingStatus: "confirmed",
        bookingType: "single",
        customerName: "Move2",
        totalAmount: 0,
        depositAmount: 0,
        paidAmount: 0,
        reservationId: "res-old-2",
        physicalCourtId: COURT01,
      },
    ],
    CLUB
  );

  const releases = [];
  __setCanonicalReservationCutoverForTests(true);
  __bindCanonicalBookingGateway({
    reserveCourts: async (payload) => ({
      ok: true,
      reservationIds: ["res-new"],
      physicalCourtIds: [COURT02],
      reserved: [{ reservationId: "res-new", physicalCourtId: COURT02 }],
      requestId: payload.requestId,
    }),
    releaseCourts: async (payload) => {
      releases.push(payload);
      return { ok: true, releasedReservationIds: ["res-new"] };
    },
  });

  // Target court missing from inventory → saveBooking fails after reserve.
  const moved = await transferBookingCourt("bk-move-2", "missing-court", CLUB);
  assert.equal(moved.ok, false);
  assert.equal(moved.compensated, true);
  assert.ok(releases.some((row) => String(row.requestId).includes("booking-compensate")));
  assert.equal(
    releases.some((row) => String(row.requestId).includes("reschedule-previous")),
    false
  );

  __resetCanonicalBookingGatewayForTests();
  __resetCanonicalReservationCutoverForTests();
  saveBookingsForClub([], CLUB);
});

test("booking cancel releases canonical capacity", async () => {
  saveCourtsForClub(
    [{ id: "c1", name: "Court 1", active: true, status: "active", number: 1 }],
    CLUB
  );
  saveBookingsForClub(
    [
      {
        id: "bk-cancel-1",
        courtId: "c1",
        date: "2026-08-15",
        startTime: "10:00",
        endTime: "11:00",
        bookingStatus: "confirmed",
        bookingType: "single",
        customerName: "Cancel",
        totalAmount: 0,
        depositAmount: 0,
        paidAmount: 0,
        reservationId: "res-cancel",
        physicalCourtId: COURT01,
      },
    ],
    CLUB
  );
  const releases = [];
  __setCanonicalReservationCutoverForTests(true);
  __bindCanonicalBookingGateway({
    reserveCourts: async () => ({ ok: true }),
    releaseCourts: async (payload) => {
      releases.push(payload.requestId);
      return { ok: true, releasedReservationIds: ["res-cancel"] };
    },
  });
  const cancelled = await updateBookingStatus("bk-cancel-1", "cancelled", CLUB);
  assert.equal(cancelled.ok, true);
  assert.ok(releases.some((id) => String(id).includes("booking-release:cancel:bk-cancel-1")));
  __resetCanonicalBookingGatewayForTests();
  __resetCanonicalReservationCutoverForTests();
  saveBookingsForClub([], CLUB);
});
