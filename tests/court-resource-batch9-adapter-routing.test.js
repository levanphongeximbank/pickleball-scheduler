/**
 * Batch 9 — Mode Adapter B → Head A routing (application-level).
 * Not a substitute for real DB concurrency proof.
 */
import assert from "node:assert/strict";
import test from "node:test";

import { COMPETITION_COURT_ADAPTER_CAPABILITY } from "../src/features/competition-core/contracts/competitionCourtAdapterContract.js";
import {
  createDailyPlayCourtAdapter,
  createDailyPlayCourtOrchestrator,
  createDailyPlayLeaseProjectionStore,
  createInternalTournamentCourtAdapter,
  createOfficialTournamentCourtAdapter,
  createTeamTournamentCourtAdapter,
  DAILY_PLAY_LEASE_IS_PROJECTION,
  MODE_COURT_ADAPTER_B_CODE,
} from "../src/features/competition-engine/integration/court-adapters/index.js";

const TENANT = "tenant-a";
const VENUE = "venue-a";
const CLUB = "club-a";
const COURT_A = "11111111-1111-4111-8111-111111111111";
const COURT_B = "22222222-2222-4222-8222-222222222222";

function createSpyHeadA() {
  const calls = [];
  const impl = {};
  for (const name of Object.values(COMPETITION_COURT_ADAPTER_CAPABILITY)) {
    impl[name] = async (input) => {
      calls.push({ name, input });
      if (name === "reserveCourts") {
        return {
          ok: true,
          contractVersion: 1,
          code: "OK",
          reserved: (input.physicalCourtIds || []).map((physicalCourtId) => ({ physicalCourtId })),
        };
      }
      if (name === "releaseCourts") {
        return { ok: true, contractVersion: 1, code: "OK", released: input.physicalCourtIds || [] };
      }
      if (name === "validateMatchAssignment") {
        return { ok: true, valid: true, contractVersion: 1, code: "ASSIGNMENT_VALID" };
      }
      if (name === "listEligibleCourts") {
        return { ok: true, contractVersion: 1, code: "OK", courts: [{ physicalCourtId: COURT_A }] };
      }
      return { ok: true, contractVersion: 1, code: "OK", courts: [] };
    };
  }
  return { calls, ...impl };
}

const factories = [
  ["daily", createDailyPlayCourtAdapter],
  ["internal", createInternalTournamentCourtAdapter],
  ["official", createOfficialTournamentCourtAdapter],
  ["team", createTeamTournamentCourtAdapter],
];

test("B9-ROUTE-01 every competition mode Adapter B invokes Head A only", async () => {
  for (const [mode, factory] of factories) {
    const headA = createSpyHeadA();
    const adapter = factory({ headA });
    assert.equal(adapter.adapterOwner, "2.13_COMPETITION_ENGINE");
    assert.equal(Object.keys(adapter.capabilities).length, 5);

    const reserved = await adapter.reserveCourts({
      tenantId: TENANT,
      venueId: VENUE,
      clubId: CLUB,
      competitionId: `${mode}-comp-1`,
      physicalCourtIds: [COURT_A],
      startsAt: "2026-09-01T18:00:00.000Z",
      endsAt: "2026-09-01T19:00:00.000Z",
      requestId: `${mode}-req-1`,
    });
    assert.equal(reserved.ok, true, mode);
    assert.equal(headA.calls.length, 1, mode);
    assert.equal(headA.calls[0].name, "reserveCourts", mode);
    assert.equal(headA.calls[0].input.tenantId, TENANT, mode);
    assert.equal(headA.calls[0].input.clubId, CLUB, mode);
    assert.deepEqual(headA.calls[0].input.physicalCourtIds, [COURT_A], mode);
    assert.equal(headA.calls[0].input.physicalCourtId, COURT_A, mode);
    assert.equal(headA.calls[0].input.competitionId, `${mode}-comp-1`, mode);
    assert.equal(headA.calls[0].input.ownerId, `${mode}-comp-1`, mode);
  }
});

test("B9-ROUTE-02 venueId cannot substitute for tenantId", async () => {
  const headA = createSpyHeadA();
  const adapter = createInternalTournamentCourtAdapter({ headA });
  const result = await adapter.reserveCourts({
    venueId: VENUE,
    clubId: CLUB,
    competitionId: "comp-collapse",
    physicalCourtIds: [COURT_A],
    startsAt: "2026-09-01T18:00:00.000Z",
    endsAt: "2026-09-01T19:00:00.000Z",
  });
  assert.equal(result.ok, false);
  assert.equal(result.code, MODE_COURT_ADAPTER_B_CODE.TENANT_VENUE_COLLAPSE_DENIED);
  assert.equal(headA.calls.length, 0);
});

test("B9-ROUTE-03 legacy court labels fail closed before Head A", async () => {
  const headA = createSpyHeadA();
  const adapter = createOfficialTournamentCourtAdapter({ headA });
  const result = await adapter.reserveCourts({
    tenantId: TENANT,
    clubId: CLUB,
    competitionId: "comp-legacy",
    physicalCourtIds: ["Court 1"],
    startsAt: "2026-09-01T18:00:00.000Z",
    endsAt: "2026-09-01T19:00:00.000Z",
  });
  assert.equal(result.ok, false);
  assert.equal(result.code, MODE_COURT_ADAPTER_B_CODE.LEGACY_COURT_IDENTITY_DENIED);
  assert.equal(headA.calls.length, 0);
});

test("B9-ROUTE-04 Daily Play orchestrator records lease projection without D4 acquire", async () => {
  const headA = createSpyHeadA();
  const orchestrator = createDailyPlayCourtOrchestrator({
    headA,
    leaseStore: createDailyPlayLeaseProjectionStore(),
  });
  assert.equal(orchestrator.leaseIsProjection, true);
  assert.equal(DAILY_PLAY_LEASE_IS_PROJECTION, true);
  assert.equal(orchestrator.leaseIsCapacitySsot, false);
  assert.equal(orchestrator.capacityAuthority, "court_resource_reservations");
  assert.equal(orchestrator.forbiddenAcquireRpc, "court_resource_daily_play_acquire");

  const reserved = await orchestrator.reserveWithProjection({
    tenantId: TENANT,
    clubId: CLUB,
    competitionId: "daily-1",
    matchId: "m-1",
    physicalCourtIds: [COURT_A],
    startsAt: "2026-09-01T18:00:00.000Z",
    endsAt: "2026-09-01T19:00:00.000Z",
    requestId: "daily-orch-1",
  });
  assert.equal(reserved.ok, true);
  assert.equal(headA.calls.filter((row) => row.name === "reserveCourts").length, 1);
  assert.equal(orchestrator.getD4AcquireCallCount(), 0);
  assert.equal(reserved.doubleReservationPaths ?? 0, 0);
});

test("B9-ROUTE-05 all five Head A capabilities are invoked by Adapter B", async () => {
  const headA = createSpyHeadA();
  const adapter = createTeamTournamentCourtAdapter({ headA });
  const base = {
    tenantId: TENANT,
    clubId: CLUB,
    competitionId: "team-1",
    physicalCourtIds: [COURT_A, COURT_B],
    startsAt: "2026-09-01T18:00:00.000Z",
    endsAt: "2026-09-01T20:00:00.000Z",
  };
  await adapter.listEligibleCourts(base);
  await adapter.getCourtAvailability(base);
  await adapter.reserveCourts({ ...base, requestId: "team-res" });
  await adapter.releaseCourts({ ...base, requestId: "team-rel" });
  await adapter.validateMatchAssignment(base);
  assert.deepEqual(
    headA.calls.map((row) => row.name).sort(),
    Object.values(COMPETITION_COURT_ADAPTER_CAPABILITY).sort()
  );
});
