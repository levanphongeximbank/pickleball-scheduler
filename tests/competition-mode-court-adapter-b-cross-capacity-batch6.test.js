/**
 * Batch 6 — focused shared-capacity certification via Mode Adapter B.
 * Competition ↔ Booking and Competition ↔ Resource Block conflict through
 * court_resource_reservations semantics (simulated Head A / capacity map).
 */
import test from "node:test";
import assert from "node:assert/strict";

import { COMPETITION_COURT_RESULT_CODE } from "../src/features/competition-core/contracts/competitionCourtAdapterContract.js";
import { createInternalTournamentCourtAdapter } from "../src/features/competition-engine/integration/court-adapters/index.js";

const TENANT = "tenant-cap-01";
const CLUB = "club-cap-01";
const COURT_A = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const COURT_B = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb";

function overlaps(aStart, aEnd, bStart, bEnd) {
  return aStart < bEnd && bStart < aEnd;
}

function createSharedCapacityHeadA() {
  /** @type {Array<{ ownerKind: string, ownerId: string, physicalCourtId: string, startsAt: string, endsAt: string }>} */
  const rows = [];
  const calls = [];

  function toInstant(input) {
    if (input.startsAt && input.endsAt) {
      return { startsAt: input.startsAt, endsAt: input.endsAt };
    }
    return {
      startsAt: `${input.date}T${input.startTime}:00.000Z`,
      endsAt: `${input.date}T${input.endTime}:00.000Z`,
    };
  }

  async function reserveCourts(input) {
    calls.push({ name: "reserveCourts", input });
    const window = toInstant(input);
    const ownerKind = input.ownerKind || "competition";
    const ownerId = input.competitionId || input.ownerId || "unknown";
    for (const physicalCourtId of input.physicalCourtIds || []) {
      const conflict = rows.find(
        (row) =>
          row.physicalCourtId === physicalCourtId &&
          overlaps(row.startsAt, row.endsAt, window.startsAt, window.endsAt) &&
          !(row.ownerKind === ownerKind && row.ownerId === ownerId)
      );
      if (conflict) {
        return {
          ok: false,
          contractVersion: 1,
          code: COMPETITION_COURT_RESULT_CODE.FOREIGN_RESERVATION,
          error: `Conflict with ${conflict.ownerKind}:${conflict.ownerId}`,
          reserved: [],
        };
      }
    }
    for (const physicalCourtId of input.physicalCourtIds || []) {
      rows.push({
        ownerKind,
        ownerId,
        physicalCourtId,
        startsAt: window.startsAt,
        endsAt: window.endsAt,
      });
    }
    return {
      ok: true,
      contractVersion: 1,
      code: "OK",
      reserved: (input.physicalCourtIds || []).map((id) => ({ physicalCourtId: id })),
    };
  }

  return {
    rows,
    calls,
    listEligibleCourts: async () => ({ ok: true, contractVersion: 1, code: "OK", courts: [] }),
    getCourtAvailability: async () => ({ ok: true, contractVersion: 1, code: "OK", courts: [] }),
    releaseCourts: async () => ({ ok: true, contractVersion: 1, code: "OK", released: [] }),
    validateMatchAssignment: async () => ({
      ok: true,
      valid: true,
      contractVersion: 1,
      code: "ASSIGNMENT_VALID",
    }),
    reserveCourts,
    /** Simulate Booking / Resource Block writing the same capacity SSOT. */
    async writeForeignCapacity({ ownerKind, ownerId, physicalCourtId, date, startTime, endTime }) {
      return reserveCourts({
        ownerKind,
        ownerId,
        competitionId: ownerId,
        physicalCourtIds: [physicalCourtId],
        date,
        startTime,
        endTime,
      });
    },
  };
}

test("AJ. Competition Adapter B reservation vs Booking → conflict", async () => {
  const headA = createSharedCapacityHeadA();
  const adapter = createInternalTournamentCourtAdapter({ headA });

  const bookingFirst = await headA.writeForeignCapacity({
    ownerKind: "booking",
    ownerId: "booking-1",
    physicalCourtId: COURT_A,
    date: "2026-08-21",
    startTime: "10:00",
    endTime: "12:00",
  });
  assert.equal(bookingFirst.ok, true);

  const competition = await adapter.reserveCourts({
    tenantId: TENANT,
    clubId: CLUB,
    competitionId: "comp-1",
    physicalCourtIds: [COURT_A],
    date: "2026-08-21",
    startTime: "11:00",
    endTime: "13:00",
  });
  assert.equal(competition.ok, false);
  assert.equal(competition.code, COMPETITION_COURT_RESULT_CODE.FOREIGN_RESERVATION);
});

test("AK. Booking vs Competition Adapter B reservation → conflict", async () => {
  const headA = createSharedCapacityHeadA();
  const adapter = createInternalTournamentCourtAdapter({ headA });

  const competition = await adapter.reserveCourts({
    tenantId: TENANT,
    clubId: CLUB,
    competitionId: "comp-2",
    physicalCourtIds: [COURT_A],
    date: "2026-08-21",
    startTime: "10:00",
    endTime: "12:00",
  });
  assert.equal(competition.ok, true);

  const booking = await headA.writeForeignCapacity({
    ownerKind: "booking",
    ownerId: "booking-2",
    physicalCourtId: COURT_A,
    date: "2026-08-21",
    startTime: "11:00",
    endTime: "12:30",
  });
  assert.equal(booking.ok, false);
  assert.equal(booking.code, COMPETITION_COURT_RESULT_CODE.FOREIGN_RESERVATION);
});

test("AL. Competition Adapter B reservation vs Resource Block → conflict", async () => {
  const headA = createSharedCapacityHeadA();
  const adapter = createInternalTournamentCourtAdapter({ headA });

  const reserved = await adapter.reserveCourts({
    tenantId: TENANT,
    clubId: CLUB,
    competitionId: "comp-3",
    physicalCourtIds: [COURT_A],
    date: "2026-08-22",
    startTime: "09:00",
    endTime: "11:00",
  });
  assert.equal(reserved.ok, true);

  const block = await headA.writeForeignCapacity({
    ownerKind: "maintenance",
    ownerId: "block-1",
    physicalCourtId: COURT_A,
    date: "2026-08-22",
    startTime: "10:00",
    endTime: "12:00",
  });
  assert.equal(block.ok, false);
  assert.equal(block.code, COMPETITION_COURT_RESULT_CODE.FOREIGN_RESERVATION);
});

test("AM. Resource Block vs Competition Adapter B reservation → conflict", async () => {
  const headA = createSharedCapacityHeadA();
  const adapter = createInternalTournamentCourtAdapter({ headA });

  const block = await headA.writeForeignCapacity({
    ownerKind: "operations",
    ownerId: "block-2",
    physicalCourtId: COURT_A,
    date: "2026-08-22",
    startTime: "14:00",
    endTime: "16:00",
  });
  assert.equal(block.ok, true);

  const competition = await adapter.reserveCourts({
    tenantId: TENANT,
    clubId: CLUB,
    competitionId: "comp-4",
    physicalCourtIds: [COURT_A],
    date: "2026-08-22",
    startTime: "15:00",
    endTime: "17:00",
  });
  assert.equal(competition.ok, false);
  assert.equal(competition.code, COMPETITION_COURT_RESULT_CODE.FOREIGN_RESERVATION);
});

test("AN. different physical courts → allowed", async () => {
  const headA = createSharedCapacityHeadA();
  const adapter = createInternalTournamentCourtAdapter({ headA });

  const a = await adapter.reserveCourts({
    tenantId: TENANT,
    clubId: CLUB,
    competitionId: "comp-5",
    physicalCourtIds: [COURT_A],
    date: "2026-08-23",
    startTime: "09:00",
    endTime: "11:00",
  });
  const b = await adapter.reserveCourts({
    tenantId: TENANT,
    clubId: CLUB,
    competitionId: "comp-6",
    physicalCourtIds: [COURT_B],
    date: "2026-08-23",
    startTime: "09:00",
    endTime: "11:00",
  });
  assert.equal(a.ok, true);
  assert.equal(b.ok, true);
});

test("AO. non-overlap same physical court → allowed", async () => {
  const headA = createSharedCapacityHeadA();
  const adapter = createInternalTournamentCourtAdapter({ headA });

  const first = await adapter.reserveCourts({
    tenantId: TENANT,
    clubId: CLUB,
    competitionId: "comp-7",
    physicalCourtIds: [COURT_A],
    date: "2026-08-23",
    startTime: "09:00",
    endTime: "10:00",
  });
  const second = await adapter.reserveCourts({
    tenantId: TENANT,
    clubId: CLUB,
    competitionId: "comp-8",
    physicalCourtIds: [COURT_A],
    date: "2026-08-23",
    startTime: "10:00",
    endTime: "11:00",
  });
  assert.equal(first.ok, true);
  assert.equal(second.ok, true);
});
