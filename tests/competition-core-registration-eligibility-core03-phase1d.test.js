/**
 * Core-03 Phase 1D — Capacity & Waitlist Runtime tests.
 */
import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync, readdirSync, statSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

import {
  REGISTRATION_STATUS,
  REGISTRATION_ELIGIBILITY_ERROR_CODE,
  ELIGIBILITY_OUTCOME,
  CAPACITY_WAITLIST_OPERATION,
  CAPACITY_WAITLIST_SERVICE_VERSION,
  CAPACITY_AUTH_PURPOSE,
  createCapacityWaitlistTestHarness,
  createRegistrationCapacitySnapshot,
  createCapacityWaitlistService,
  fixtureIndividualRegistration,
  sortWaitlistEntries,
  calculateWaitlistPositions,
} from "../src/features/competition-core/registration-eligibility/index.js";

const __dirname = dirname(fileURLToPath(import.meta.url));
const MODULE_ROOT = join(
  __dirname,
  "../src/features/competition-core/registration-eligibility"
);
const SERVICES_ROOT = join(MODULE_ROOT, "services");

function collectJsFiles(dir) {
  const out = [];
  for (const name of readdirSync(dir)) {
    const full = join(dir, name);
    const st = statSync(full);
    if (st.isDirectory()) out.push(...collectJsFiles(full));
    else if (name.endsWith(".js")) out.push(full);
  }
  return out;
}

function harnessWithLimits(competitionLimit, divisionLimit = null) {
  const states = [
    {
      competitionId: "comp-1",
      divisionId: null,
      limit: competitionLimit,
      used: 0,
      reserved: 0,
      stateVersion: 0,
    },
  ];
  if (divisionLimit != null) {
    states.push({
      competitionId: "comp-1",
      divisionId: "div-1",
      limit: divisionLimit,
      used: 0,
      reserved: 0,
      stateVersion: 0,
    });
  }
  return createCapacityWaitlistTestHarness({ capacityStates: states });
}

async function seedReadyRegistration(harness, overrides = {}) {
  const registration = fixtureIndividualRegistration({
    status: REGISTRATION_STATUS.UNDER_REVIEW,
    submittedAt: "2026-07-20T04:00:00.000Z",
    ...overrides,
  });
  await harness.seedRegistration(registration);
  await harness.seedEligibleEvidence(registration);
  return registration;
}

function waitlistPlacementAuth(registration, overrides = {}) {
  return {
    purpose: CAPACITY_AUTH_PURPOSE.WAITLIST_PLACEMENT,
    registrationId: registration.id,
    competitionId: registration.competitionId,
    divisionId: registration.divisionId,
    authorizedBy: "director-1",
    authorizationRef: "AUTHZ-WL-PLACE-1",
    reason: "authorized waitlist placement",
    issuedAt: "2026-07-20T05:00:00.000Z",
    ...overrides,
  };
}

function waitlistPromotionAuth(registration, overrides = {}) {
  return {
    purpose: CAPACITY_AUTH_PURPOSE.WAITLIST_PROMOTION,
    registrationId: registration.id,
    competitionId: registration.competitionId,
    divisionId: registration.divisionId,
    authorizedBy: "director-1",
    authorizationRef: "AUTHZ-WL-PROMO-1",
    reason: "authorized waitlist promotion",
    issuedAt: "2026-07-20T05:00:00.000Z",
    ...overrides,
  };
}

function exhaustedHarness(extra = {}) {
  return createCapacityWaitlistTestHarness({
    capacityStates: [
      {
        competitionId: "comp-1",
        divisionId: null,
        limit: 0,
        used: 0,
        reserved: 0,
        stateVersion: 0,
      },
      {
        competitionId: "comp-1",
        divisionId: "div-1",
        limit: 0,
        used: 0,
        reserved: 0,
        stateVersion: 0,
      },
    ],
    ...extra,
  });
}

// ---------------------------------------------------------------------------
// Capacity evaluation
// ---------------------------------------------------------------------------

test("1. Competition capacity available", async () => {
  const harness = harnessWithLimits(10, null);
  const result = await harness.service.evaluateRegistrationCapacity({
    competitionId: "comp-1",
  });
  assert.equal(result.ok, true);
  assert.equal(result.capacitySnapshot.competitionRemaining, 10);
  assert.equal(result.capacitySnapshot.competitionHasCapacity, true);
  assert.equal(result.capacitySnapshot.effectiveRemaining, 10);
});

test("2. Competition capacity exhausted", async () => {
  const harness = createCapacityWaitlistTestHarness({
    capacityStates: [
      {
        competitionId: "comp-1",
        divisionId: null,
        limit: 2,
        used: 2,
        reserved: 0,
        stateVersion: 1,
      },
    ],
  });
  const result = await harness.service.evaluateRegistrationCapacity({
    competitionId: "comp-1",
  });
  assert.equal(result.ok, true);
  assert.equal(result.capacitySnapshot.competitionRemaining, 0);
  assert.equal(result.capacitySnapshot.competitionHasCapacity, false);
  assert.equal(result.capacitySnapshot.effectiveRemaining, 0);
});

test("3. Division capacity available", async () => {
  const harness = harnessWithLimits(100, 8);
  const result = await harness.service.evaluateRegistrationCapacity({
    competitionId: "comp-1",
    divisionId: "div-1",
  });
  assert.equal(result.ok, true);
  assert.equal(result.capacitySnapshot.divisionRemaining, 8);
  assert.equal(result.capacitySnapshot.divisionHasCapacity, true);
});

test("4. Division capacity exhausted", async () => {
  const harness = createCapacityWaitlistTestHarness({
    capacityStates: [
      {
        competitionId: "comp-1",
        divisionId: null,
        limit: 100,
        used: 0,
        reserved: 0,
        stateVersion: 0,
      },
      {
        competitionId: "comp-1",
        divisionId: "div-1",
        limit: 1,
        used: 1,
        reserved: 0,
        stateVersion: 0,
      },
    ],
  });
  const result = await harness.service.evaluateRegistrationCapacity({
    competitionId: "comp-1",
    divisionId: "div-1",
  });
  assert.equal(result.ok, true);
  assert.equal(result.capacitySnapshot.divisionRemaining, 0);
  assert.equal(result.capacitySnapshot.effectiveRemaining, 0);
});

test("5. Combined capacity uses the lower remaining value", async () => {
  const harness = createCapacityWaitlistTestHarness({
    capacityStates: [
      {
        competitionId: "comp-1",
        divisionId: null,
        limit: 5,
        used: 3,
        reserved: 0,
        stateVersion: 0,
      },
      {
        competitionId: "comp-1",
        divisionId: "div-1",
        limit: 10,
        used: 1,
        reserved: 0,
        stateVersion: 0,
      },
    ],
  });
  const result = await harness.service.evaluateRegistrationCapacity({
    competitionId: "comp-1",
    divisionId: "div-1",
  });
  assert.equal(result.ok, true);
  assert.equal(result.capacitySnapshot.competitionRemaining, 2);
  assert.equal(result.capacitySnapshot.divisionRemaining, 9);
  assert.equal(result.capacitySnapshot.effectiveRemaining, 2);
});

test("6. Invalid negative capacity fails closed", () => {
  assert.throws(
    () =>
      createRegistrationCapacitySnapshot({
        competitionId: "comp-1",
        competitionLimit: -1,
        capturedAt: "2026-07-20T05:00:00.000Z",
      }),
    /non-negative/
  );
  assert.throws(
    () =>
      createRegistrationCapacitySnapshot({
        competitionId: "comp-1",
        competitionLimit: 2,
        competitionUsed: 3,
        competitionReserved: 0,
        capturedAt: "2026-07-20T05:00:00.000Z",
      }),
    /exceeds/
  );
});

// ---------------------------------------------------------------------------
// Reservation
// ---------------------------------------------------------------------------

test("7. Reservation succeeds and consumes one slot", async () => {
  const harness = harnessWithLimits(5, 5);
  const reg = await seedReadyRegistration(harness);
  const before = await harness.service.evaluateRegistrationCapacity({
    competitionId: "comp-1",
    divisionId: "div-1",
  });
  const result = await harness.service.reserveRegistrationCapacity({
    registrationId: reg.id,
    requestId: "rsv-1",
    actorId: "director-1",
  });
  assert.equal(result.ok, true);
  assert.equal(result.operation, CAPACITY_WAITLIST_OPERATION.RESERVE_CAPACITY);
  assert.equal(result.reservation.status, "ACTIVE");
  assert.equal(result.capacitySnapshot.competitionReserved, 1);
  assert.equal(result.capacitySnapshot.divisionReserved, 1);
  assert.equal(
    result.capacitySnapshot.effectiveRemaining,
    before.capacitySnapshot.effectiveRemaining - 1
  );
  assert.equal(result.replayed, false);
  assert.ok(result.auditEventId);
});

test("8. Duplicate reservation is rejected", async () => {
  const harness = harnessWithLimits(5, 5);
  const reg = await seedReadyRegistration(harness);
  const first = await harness.service.reserveRegistrationCapacity({
    registrationId: reg.id,
    requestId: "rsv-dup-a",
  });
  assert.equal(first.ok, true);
  const second = await harness.service.reserveRegistrationCapacity({
    registrationId: reg.id,
    requestId: "rsv-dup-b",
  });
  assert.equal(second.ok, false);
  assert.equal(
    second.errors[0].code,
    REGISTRATION_ELIGIBILITY_ERROR_CODE.DUPLICATE_ACTIVE_RESERVATION
  );
});

test("9. Reservation replay does not consume a second slot", async () => {
  const harness = harnessWithLimits(5, 5);
  const reg = await seedReadyRegistration(harness);
  const first = await harness.service.reserveRegistrationCapacity({
    registrationId: reg.id,
    requestId: "rsv-replay",
  });
  assert.equal(first.ok, true);
  const replay = await harness.service.reserveRegistrationCapacity({
    registrationId: reg.id,
    requestId: "rsv-replay",
  });
  assert.equal(replay.ok, true);
  assert.equal(replay.replayed, true);
  assert.equal(replay.idempotencyResult, "HIT");
  assert.equal(replay.capacitySnapshot.competitionReserved, 1);
  assert.equal(replay.reservation.reservationId, first.reservation.reservationId);
  assert.equal(harness.audit._events.length, 1);
});

test("10. Reservation request conflict fails", async () => {
  const harness = harnessWithLimits(5, 5);
  const regA = await seedReadyRegistration(harness, { id: "reg-a", registrationRequestId: "req-a" });
  const regB = await seedReadyRegistration(harness, {
    id: "reg-b",
    registrationRequestId: "req-b",
    target: { targetType: "INDIVIDUAL", participantId: "p-2" },
    applicant: { platformUserId: "user-2", participantId: "p-2" },
  });
  const first = await harness.service.reserveRegistrationCapacity({
    registrationId: regA.id,
    requestId: "rsv-conflict",
  });
  assert.equal(first.ok, true);
  const conflict = await harness.service.reserveRegistrationCapacity({
    registrationId: regB.id,
    requestId: "rsv-conflict",
  });
  assert.equal(conflict.ok, false);
  assert.equal(conflict.idempotencyResult, "CONFLICT");
  assert.equal(
    conflict.errors[0].code,
    REGISTRATION_ELIGIBILITY_ERROR_CODE.IDEMPOTENCY_CONFLICT
  );
});

// ---------------------------------------------------------------------------
// Release
// ---------------------------------------------------------------------------

test("11. Release restores capacity", async () => {
  const harness = harnessWithLimits(5, 5);
  const reg = await seedReadyRegistration(harness);
  await harness.service.reserveRegistrationCapacity({
    registrationId: reg.id,
    requestId: "rsv-rel-1",
  });
  const released = await harness.service.releaseRegistrationCapacity({
    registrationId: reg.id,
    requestId: "rel-1",
    reason: "withdrawn before confirm",
    actorId: "director-1",
  });
  assert.equal(released.ok, true);
  assert.equal(released.reservation.status, "RELEASED");
  assert.equal(released.capacitySnapshot.competitionReserved, 0);
  assert.equal(released.capacitySnapshot.divisionReserved, 0);
  assert.equal(released.capacitySnapshot.effectiveRemaining, 5);
});

test("12. Release replay does not restore capacity twice", async () => {
  const harness = harnessWithLimits(5, 5);
  const reg = await seedReadyRegistration(harness);
  await harness.service.reserveRegistrationCapacity({
    registrationId: reg.id,
    requestId: "rsv-rel-2",
  });
  const first = await harness.service.releaseRegistrationCapacity({
    registrationId: reg.id,
    requestId: "rel-replay",
    reason: "release once",
  });
  assert.equal(first.ok, true);
  const auditCount = harness.audit._events.length;
  const replay = await harness.service.releaseRegistrationCapacity({
    registrationId: reg.id,
    requestId: "rel-replay",
    reason: "release once",
  });
  assert.equal(replay.ok, true);
  assert.equal(replay.replayed, true);
  assert.equal(replay.capacitySnapshot.competitionReserved, 0);
  assert.equal(harness.audit._events.length, auditCount);
});

test("13. Missing reservation fails closed", async () => {
  const harness = harnessWithLimits(5, 5);
  const reg = await seedReadyRegistration(harness);
  const result = await harness.service.releaseRegistrationCapacity({
    registrationId: reg.id,
    requestId: "rel-missing",
  });
  assert.equal(result.ok, false);
  assert.equal(
    result.errors[0].code,
    REGISTRATION_ELIGIBILITY_ERROR_CODE.CAPACITY_RESERVATION_NOT_FOUND
  );
});

// ---------------------------------------------------------------------------
// Waitlist placement & ordering
// ---------------------------------------------------------------------------

test("14. Waitlist placement transitions registration to WAITLISTED", async () => {
  const harness = createCapacityWaitlistTestHarness({
    capacityStates: [
      {
        competitionId: "comp-1",
        divisionId: null,
        limit: 1,
        used: 1,
        reserved: 0,
        stateVersion: 0,
      },
      {
        competitionId: "comp-1",
        divisionId: "div-1",
        limit: 1,
        used: 1,
        reserved: 0,
        stateVersion: 0,
      },
    ],
  });
  const reg = await seedReadyRegistration(harness);
  const result = await harness.service.placeRegistrationOnWaitlist({
    registrationId: reg.id,
    requestId: "wl-place-1",
    priorityRank: 2,
  });
  assert.equal(result.ok, true);
  assert.equal(result.previousStatus, REGISTRATION_STATUS.UNDER_REVIEW);
  assert.equal(result.currentStatus, REGISTRATION_STATUS.WAITLISTED);
  assert.equal(result.registration.status, REGISTRATION_STATUS.WAITLISTED);
  assert.equal(result.waitlistEntry.status, "ACTIVE");
  assert.equal(result.waitlistPosition.position, 1);
});

test("15. Duplicate waitlist placement is rejected or deterministically replayed", async () => {
  const harness = createCapacityWaitlistTestHarness({
    capacityStates: [
      {
        competitionId: "comp-1",
        divisionId: null,
        limit: 0,
        used: 0,
        reserved: 0,
        stateVersion: 0,
      },
      {
        competitionId: "comp-1",
        divisionId: "div-1",
        limit: 0,
        used: 0,
        reserved: 0,
        stateVersion: 0,
      },
    ],
  });
  const reg = await seedReadyRegistration(harness);
  const first = await harness.service.placeRegistrationOnWaitlist({
    registrationId: reg.id,
    requestId: "wl-place-replay",
    priorityRank: 1,
  });
  assert.equal(first.ok, true);
  const replay = await harness.service.placeRegistrationOnWaitlist({
    registrationId: reg.id,
    requestId: "wl-place-replay",
    priorityRank: 1,
  });
  assert.equal(replay.ok, true);
  assert.equal(replay.replayed, true);
  assert.equal(replay.waitlistEntry.waitlistEntryId, first.waitlistEntry.waitlistEntryId);

  const other = await harness.service.placeRegistrationOnWaitlist({
    registrationId: reg.id,
    requestId: "wl-place-other",
    priorityRank: 1,
  });
  assert.equal(other.ok, false);
  assert.equal(
    other.errors[0].code,
    REGISTRATION_ELIGIBILITY_ERROR_CODE.WAITLIST_ENTRY_ALREADY_EXISTS
  );
});

test("16. Waitlist ordering respects priorityRank", () => {
  const ordered = sortWaitlistEntries([
    {
      registrationId: "reg-b",
      priorityRank: 5,
      submittedAt: "2026-07-20T01:00:00.000Z",
      waitlistedAt: "2026-07-20T02:00:00.000Z",
    },
    {
      registrationId: "reg-a",
      priorityRank: 1,
      submittedAt: "2026-07-20T03:00:00.000Z",
      waitlistedAt: "2026-07-20T04:00:00.000Z",
    },
  ]);
  assert.equal(ordered[0].registrationId, "reg-a");
  assert.equal(ordered[1].registrationId, "reg-b");
});

test("17. Equal priority orders by submittedAt", () => {
  const ordered = sortWaitlistEntries([
    {
      registrationId: "reg-late",
      priorityRank: 1,
      submittedAt: "2026-07-20T02:00:00.000Z",
      waitlistedAt: "2026-07-20T03:00:00.000Z",
    },
    {
      registrationId: "reg-early",
      priorityRank: 1,
      submittedAt: "2026-07-20T01:00:00.000Z",
      waitlistedAt: "2026-07-20T04:00:00.000Z",
    },
  ]);
  assert.equal(ordered[0].registrationId, "reg-early");
});

test("18. Equal submittedAt orders by waitlistedAt", () => {
  const ordered = sortWaitlistEntries([
    {
      registrationId: "reg-2",
      priorityRank: 1,
      submittedAt: "2026-07-20T01:00:00.000Z",
      waitlistedAt: "2026-07-20T03:00:00.000Z",
    },
    {
      registrationId: "reg-1",
      priorityRank: 1,
      submittedAt: "2026-07-20T01:00:00.000Z",
      waitlistedAt: "2026-07-20T02:00:00.000Z",
    },
  ]);
  assert.equal(ordered[0].registrationId, "reg-1");
});

test("19. Final tie orders by registrationId", () => {
  const ordered = sortWaitlistEntries([
    {
      registrationId: "reg-z",
      priorityRank: 1,
      submittedAt: "2026-07-20T01:00:00.000Z",
      waitlistedAt: "2026-07-20T02:00:00.000Z",
    },
    {
      registrationId: "reg-a",
      priorityRank: 1,
      submittedAt: "2026-07-20T01:00:00.000Z",
      waitlistedAt: "2026-07-20T02:00:00.000Z",
    },
  ]);
  assert.equal(ordered[0].registrationId, "reg-a");
  assert.equal(ordered[1].registrationId, "reg-z");
});

test("20. Waitlist positions are one-based", () => {
  const positions = calculateWaitlistPositions(
    [
      {
        waitlistEntryId: "wl-1",
        registrationId: "reg-a",
        competitionId: "comp-1",
        priorityRank: 1,
        submittedAt: "2026-07-20T01:00:00.000Z",
        waitlistedAt: "2026-07-20T02:00:00.000Z",
      },
      {
        waitlistEntryId: "wl-2",
        registrationId: "reg-b",
        competitionId: "comp-1",
        priorityRank: 2,
        submittedAt: "2026-07-20T01:00:00.000Z",
        waitlistedAt: "2026-07-20T02:00:00.000Z",
      },
    ],
    { calculatedAt: "2026-07-20T05:00:00.000Z", waitlistVersion: 1 }
  );
  assert.equal(positions[0].position, 1);
  assert.equal(positions[1].position, 2);
  assert.equal(positions[0].aheadCount, 0);
  assert.equal(positions[1].aheadCount, 1);
  assert.equal(positions[0].totalCount, 2);
});

test("21. Position recalculation is deterministic", async () => {
  const harness = createCapacityWaitlistTestHarness({
    capacityStates: [
      {
        competitionId: "comp-1",
        divisionId: null,
        limit: 0,
        used: 0,
        reserved: 0,
        stateVersion: 0,
      },
      {
        competitionId: "comp-1",
        divisionId: "div-1",
        limit: 0,
        used: 0,
        reserved: 0,
        stateVersion: 0,
      },
    ],
  });
  const a = await seedReadyRegistration(harness, {
    id: "reg-pos-a",
    registrationRequestId: "req-pos-a",
    submittedAt: "2026-07-20T01:00:00.000Z",
  });
  const b = await seedReadyRegistration(harness, {
    id: "reg-pos-b",
    registrationRequestId: "req-pos-b",
    submittedAt: "2026-07-20T02:00:00.000Z",
    target: { targetType: "INDIVIDUAL", participantId: "p-2" },
    applicant: { platformUserId: "user-2", participantId: "p-2" },
  });
  await harness.service.placeRegistrationOnWaitlist({
    registrationId: b.id,
    requestId: "wl-b",
    priorityRank: 1,
  });
  await harness.service.placeRegistrationOnWaitlist({
    registrationId: a.id,
    requestId: "wl-a",
    priorityRank: 1,
  });
  const first = await harness.service.getRegistrationWaitlistPosition({
    registrationId: a.id,
  });
  const second = await harness.service.getRegistrationWaitlistPosition({
    registrationId: a.id,
  });
  assert.equal(first.waitlistPosition.position, 1);
  assert.deepEqual(first.waitlistPosition.position, second.waitlistPosition.position);
  assert.deepEqual(first.waitlistPosition.aheadCount, second.waitlistPosition.aheadCount);
});

test("22. Withdrawal removes the waitlist entry", async () => {
  const harness = createCapacityWaitlistTestHarness({
    capacityStates: [
      {
        competitionId: "comp-1",
        divisionId: null,
        limit: 0,
        used: 0,
        reserved: 0,
        stateVersion: 0,
      },
      {
        competitionId: "comp-1",
        divisionId: "div-1",
        limit: 0,
        used: 0,
        reserved: 0,
        stateVersion: 0,
      },
    ],
  });
  const reg = await seedReadyRegistration(harness);
  await harness.service.placeRegistrationOnWaitlist({
    registrationId: reg.id,
    requestId: "wl-wdraw-place",
  });
  const withdrawn = await harness.service.withdrawWaitlistedRegistration({
    registrationId: reg.id,
    requestId: "wl-wdraw",
    actorId: "player-1",
    reason: "changed plans",
  });
  assert.equal(withdrawn.ok, true);
  assert.equal(withdrawn.waitlistEntry.status, "WITHDRAWN");
  assert.equal(withdrawn.currentStatus, REGISTRATION_STATUS.WITHDRAWN);
  const active = await harness.waitlist.findActiveByRegistrationId(reg.id);
  assert.equal(active, null);
});

test("23. Withdrawal uses the Phase 1A transition policy", async () => {
  const harness = createCapacityWaitlistTestHarness({
    capacityStates: [
      {
        competitionId: "comp-1",
        divisionId: null,
        limit: 0,
        used: 0,
        reserved: 0,
        stateVersion: 0,
      },
      {
        competitionId: "comp-1",
        divisionId: "div-1",
        limit: 0,
        used: 0,
        reserved: 0,
        stateVersion: 0,
      },
    ],
  });
  const reg = await seedReadyRegistration(harness);
  await harness.service.placeRegistrationOnWaitlist({
    registrationId: reg.id,
    requestId: "wl-policy-place",
  });
  const withdrawn = await harness.service.withdrawWaitlistedRegistration({
    registrationId: reg.id,
    requestId: "wl-policy-wdraw",
  });
  assert.equal(withdrawn.ok, true);
  assert.equal(withdrawn.previousStatus, REGISTRATION_STATUS.WAITLISTED);
  assert.equal(withdrawn.currentStatus, REGISTRATION_STATUS.WITHDRAWN);
});

// ---------------------------------------------------------------------------
// Promotion candidates
// ---------------------------------------------------------------------------

test("24. Candidate selection respects available capacity", async () => {
  const harness = createCapacityWaitlistTestHarness({
    capacityStates: [
      {
        competitionId: "comp-1",
        divisionId: null,
        limit: 1,
        used: 0,
        reserved: 0,
        stateVersion: 0,
      },
      {
        competitionId: "comp-1",
        divisionId: "div-1",
        limit: 1,
        used: 0,
        reserved: 0,
        stateVersion: 0,
      },
    ],
  });
  const a = await seedReadyRegistration(harness, {
    id: "reg-cand-a",
    registrationRequestId: "req-cand-a",
    submittedAt: "2026-07-20T01:00:00.000Z",
  });
  const b = await seedReadyRegistration(harness, {
    id: "reg-cand-b",
    registrationRequestId: "req-cand-b",
    submittedAt: "2026-07-20T02:00:00.000Z",
    target: { targetType: "INDIVIDUAL", participantId: "p-2" },
    applicant: { platformUserId: "user-2", participantId: "p-2" },
  });
  // Exhaust capacity then waitlist both via force after filling
  await harness.capacityState.saveState({
    competitionId: "comp-1",
    divisionId: null,
    limit: 1,
    used: 1,
    reserved: 0,
    stateVersion: 1,
    updatedAt: harness.now(),
  });
  await harness.capacityState.saveState({
    competitionId: "comp-1",
    divisionId: "div-1",
    limit: 1,
    used: 1,
    reserved: 0,
    stateVersion: 1,
    updatedAt: harness.now(),
  });
  await harness.service.placeRegistrationOnWaitlist({
    registrationId: a.id,
    requestId: "wl-cand-a",
  });
  await harness.service.placeRegistrationOnWaitlist({
    registrationId: b.id,
    requestId: "wl-cand-b",
  });
  // Free one slot
  await harness.capacityState.saveState({
    competitionId: "comp-1",
    divisionId: null,
    limit: 1,
    used: 0,
    reserved: 0,
    stateVersion: 2,
    updatedAt: harness.now(),
  });
  await harness.capacityState.saveState({
    competitionId: "comp-1",
    divisionId: "div-1",
    limit: 1,
    used: 0,
    reserved: 0,
    stateVersion: 2,
    updatedAt: harness.now(),
  });
  const selected = await harness.service.selectWaitlistPromotionCandidates({
    competitionId: "comp-1",
    divisionId: "div-1",
  });
  assert.equal(selected.ok, true);
  assert.equal(selected.promotionCandidates.length, 1);
  assert.equal(selected.promotionCandidates[0].registrationId, "reg-cand-a");
});

test("25. Candidate selection never exceeds effective capacity", async () => {
  const harness = createCapacityWaitlistTestHarness({
    capacityStates: [
      {
        competitionId: "comp-1",
        divisionId: null,
        limit: 2,
        used: 0,
        reserved: 0,
        stateVersion: 0,
      },
      {
        competitionId: "comp-1",
        divisionId: "div-1",
        limit: 2,
        used: 0,
        reserved: 0,
        stateVersion: 0,
      },
    ],
  });
  for (let i = 0; i < 3; i += 1) {
    const reg = await seedReadyRegistration(harness, {
      id: `reg-over-${i}`,
      registrationRequestId: `req-over-${i}`,
      submittedAt: `2026-07-20T0${i}:00:00.000Z`,
      target: { targetType: "INDIVIDUAL", participantId: `p-${i + 10}` },
      applicant: { platformUserId: `user-${i}`, participantId: `p-${i + 10}` },
    });
    await harness.service.placeRegistrationOnWaitlist({
      registrationId: reg.id,
      requestId: `wl-over-${i}`,
      waitlistAuthorization: waitlistPlacementAuth(reg, { authorizationRef: `AUTHZ-OVER-${i}` }),
    });
  }
  const selected = await harness.service.selectWaitlistPromotionCandidates({
    competitionId: "comp-1",
    divisionId: "div-1",
  });
  assert.equal(selected.ok, true);
  assert.ok(selected.promotionCandidates.length <= 2);
  assert.equal(selected.promotionCandidates.length, 2);
});

test("26. Candidate selection skips registrations with stale eligibility", async () => {
  const harness = createCapacityWaitlistTestHarness({
    capacityStates: [
      {
        competitionId: "comp-1",
        divisionId: null,
        limit: 5,
        used: 0,
        reserved: 0,
        stateVersion: 0,
      },
      {
        competitionId: "comp-1",
        divisionId: "div-1",
        limit: 5,
        used: 0,
        reserved: 0,
        stateVersion: 0,
      },
    ],
  });
  const fresh = await seedReadyRegistration(harness, {
    id: "reg-fresh",
    registrationRequestId: "req-fresh",
    submittedAt: "2026-07-20T01:00:00.000Z",
  });
  const stale = await seedReadyRegistration(harness, {
    id: "reg-stale",
    registrationRequestId: "req-stale",
    submittedAt: "2026-07-20T00:30:00.000Z",
    target: { targetType: "INDIVIDUAL", participantId: "p-2" },
    applicant: { platformUserId: "user-2", participantId: "p-2" },
  });
  await harness.seedEligibleEvidence(stale, {
    evaluatedAt: "2026-01-01T00:00:00.000Z",
  });
  await harness.service.placeRegistrationOnWaitlist({
    registrationId: stale.id,
    requestId: "wl-stale",
    waitlistAuthorization: waitlistPlacementAuth(stale, { authorizationRef: "AUTHZ-STALE" }),
    requireEligibility: false,
  });
  await harness.service.placeRegistrationOnWaitlist({
    registrationId: fresh.id,
    requestId: "wl-fresh",
    waitlistAuthorization: waitlistPlacementAuth(fresh, { authorizationRef: "AUTHZ-FRESH" }),
  });
  const selected = await harness.service.selectWaitlistPromotionCandidates({
    competitionId: "comp-1",
    divisionId: "div-1",
    eligibilityMaxAgeMs: 1000,
  });
  assert.equal(selected.ok, true);
  assert.equal(selected.promotionCandidates.length, 1);
  assert.equal(selected.promotionCandidates[0].registrationId, "reg-fresh");
});

test("27. Candidate selection skips registrations already holding capacity", async () => {
  const harness = harnessWithLimits(5, 5);
  const a = await seedReadyRegistration(harness, {
    id: "reg-hold-a",
    registrationRequestId: "req-hold-a",
    submittedAt: "2026-07-20T01:00:00.000Z",
  });
  const b = await seedReadyRegistration(harness, {
    id: "reg-hold-b",
    registrationRequestId: "req-hold-b",
    submittedAt: "2026-07-20T02:00:00.000Z",
    target: { targetType: "INDIVIDUAL", participantId: "p-2" },
    applicant: { platformUserId: "user-2", participantId: "p-2" },
  });
  await harness.service.placeRegistrationOnWaitlist({
    registrationId: a.id,
    requestId: "wl-hold-a",
    waitlistAuthorization: waitlistPlacementAuth(a, { authorizationRef: "AUTHZ-HOLD-A" }),
  });
  await harness.service.placeRegistrationOnWaitlist({
    registrationId: b.id,
    requestId: "wl-hold-b",
    waitlistAuthorization: waitlistPlacementAuth(b, { authorizationRef: "AUTHZ-HOLD-B" }),
  });
  // Manually give A a reservation while still waitlisted (edge case)
  const promotedLike = await harness.repository.getById(a.id);
  await harness.capacityReservations.save({
    reservationId: "manual-rsv",
    registrationId: a.id,
    competitionId: a.competitionId,
    divisionId: a.divisionId,
    status: "ACTIVE",
    reservedAt: harness.now(),
    stateVersion: 1,
  });
  assert.ok(promotedLike);
  const selected = await harness.service.selectWaitlistPromotionCandidates({
    competitionId: "comp-1",
    divisionId: "div-1",
  });
  assert.equal(selected.ok, true);
  assert.equal(selected.promotionCandidates.every((c) => c.registrationId !== "reg-hold-a"), true);
  assert.equal(selected.promotionCandidates[0].registrationId, "reg-hold-b");
});

test("28. Candidate selection is deterministic", async () => {
  const harness = harnessWithLimits(3, 3);
  for (const id of ["reg-d1", "reg-d2", "reg-d3"]) {
    const reg = await seedReadyRegistration(harness, {
      id,
      registrationRequestId: `req-${id}`,
      submittedAt: `2026-07-20T0${id.slice(-1)}:00:00.000Z`,
      target: { targetType: "INDIVIDUAL", participantId: id },
      applicant: { platformUserId: id, participantId: id },
    });
    await harness.service.placeRegistrationOnWaitlist({
      registrationId: reg.id,
      requestId: `wl-${id}`,
      waitlistAuthorization: waitlistPlacementAuth(reg, { authorizationRef: `AUTHZ-${id}` }),
    });
  }
  const a = await harness.service.selectWaitlistPromotionCandidates({
    competitionId: "comp-1",
    divisionId: "div-1",
  });
  const b = await harness.service.selectWaitlistPromotionCandidates({
    competitionId: "comp-1",
    divisionId: "div-1",
  });
  assert.deepEqual(
    a.promotionCandidates.map((c) => c.registrationId),
    b.promotionCandidates.map((c) => c.registrationId)
  );
  assert.equal(a.stateVersion, b.stateVersion);
});

// ---------------------------------------------------------------------------
// Promotion mutation
// ---------------------------------------------------------------------------

test("29. Promotion requires current WAITLISTED status", async () => {
  const harness = harnessWithLimits(5, 5);
  const reg = await seedReadyRegistration(harness);
  const result = await harness.service.promoteWaitlistedRegistration({
    registrationId: reg.id,
    requestId: "promo-not-wl",
    approvalAuthorization: waitlistPromotionAuth(reg, { authorizationRef: "authz-1", reason: "promote" }),
  });
  assert.equal(result.ok, false);
  assert.equal(
    result.errors[0].code,
    REGISTRATION_ELIGIBILITY_ERROR_CODE.INVALID_PROMOTION_PRECONDITION
  );
});

test("30. Promotion rejects stale capacity state", async () => {
  const harness = createCapacityWaitlistTestHarness({
    capacityStates: [
      {
        competitionId: "comp-1",
        divisionId: null,
        limit: 0,
        used: 0,
        reserved: 0,
        stateVersion: 0,
      },
      {
        competitionId: "comp-1",
        divisionId: "div-1",
        limit: 0,
        used: 0,
        reserved: 0,
        stateVersion: 0,
      },
    ],
  });
  const reg = await seedReadyRegistration(harness);
  await harness.service.placeRegistrationOnWaitlist({
    registrationId: reg.id,
    requestId: "wl-stale-cap",
  });
  await harness.capacityState.saveState({
    competitionId: "comp-1",
    divisionId: null,
    limit: 5,
    used: 0,
    reserved: 0,
    stateVersion: 3,
    updatedAt: harness.now(),
  });
  await harness.capacityState.saveState({
    competitionId: "comp-1",
    divisionId: "div-1",
    limit: 5,
    used: 0,
    reserved: 0,
    stateVersion: 3,
    updatedAt: harness.now(),
  });
  const result = await harness.service.promoteWaitlistedRegistration({
    registrationId: reg.id,
    requestId: "promo-stale",
    expectedStateVersion: 0,
    approvalAuthorization: waitlistPromotionAuth(reg, { authorizationRef: "authz-stale", reason: "promote" }),
  });
  assert.equal(result.ok, false);
  assert.equal(
    result.errors[0].code,
    REGISTRATION_ELIGIBILITY_ERROR_CODE.STALE_CAPACITY_VERSION
  );
});

test("31. Promotion rejects missing approval or eligibility evidence", async () => {
  const harness = createCapacityWaitlistTestHarness({
    capacityStates: [
      {
        competitionId: "comp-1",
        divisionId: null,
        limit: 0,
        used: 0,
        reserved: 0,
        stateVersion: 0,
      },
      {
        competitionId: "comp-1",
        divisionId: "div-1",
        limit: 0,
        used: 0,
        reserved: 0,
        stateVersion: 0,
      },
    ],
  });
  const reg = await seedReadyRegistration(harness);
  await harness.service.placeRegistrationOnWaitlist({
    registrationId: reg.id,
    requestId: "wl-no-auth",
  });
  const boolFlag = await harness.service.promoteWaitlistedRegistration({
    registrationId: reg.id,
    requestId: "promo-bool",
    approvalAuthorization: { approved: true },
  });
  assert.equal(boolFlag.ok, false);
  assert.equal(
    boolFlag.errors[0].code,
    REGISTRATION_ELIGIBILITY_ERROR_CODE.INVALID_PROMOTION_PRECONDITION
  );

  const noEvidenceHarness = createCapacityWaitlistTestHarness({
    capacityStates: [
      {
        competitionId: "comp-1",
        divisionId: null,
        limit: 0,
        used: 0,
        reserved: 0,
        stateVersion: 0,
      },
      {
        competitionId: "comp-1",
        divisionId: "div-1",
        limit: 0,
        used: 0,
        reserved: 0,
        stateVersion: 0,
      },
    ],
  });
  const reg2 = fixtureIndividualRegistration({
    id: "reg-no-ev",
    status: REGISTRATION_STATUS.UNDER_REVIEW,
    submittedAt: noEvidenceHarness.now(),
  });
  await noEvidenceHarness.seedRegistration(reg2);
  await noEvidenceHarness.service.placeRegistrationOnWaitlist({
    registrationId: reg2.id,
    requestId: "wl-no-ev",
    requireEligibility: false,
  });
  await noEvidenceHarness.capacityState.saveState({
    competitionId: "comp-1",
    divisionId: null,
    limit: 5,
    used: 0,
    reserved: 0,
    stateVersion: 1,
    updatedAt: noEvidenceHarness.now(),
  });
  await noEvidenceHarness.capacityState.saveState({
    competitionId: "comp-1",
    divisionId: "div-1",
    limit: 5,
    used: 0,
    reserved: 0,
    stateVersion: 1,
    updatedAt: noEvidenceHarness.now(),
  });
  const missing = await noEvidenceHarness.service.promoteWaitlistedRegistration({
    registrationId: reg2.id,
    requestId: "promo-no-ev",
    approvalAuthorization: waitlistPromotionAuth(reg2, { authorizationRef: "authz-2", reason: "promote" }),
  });
  assert.equal(missing.ok, false);
  assert.equal(
    missing.errors[0].code,
    REGISTRATION_ELIGIBILITY_ERROR_CODE.ELIGIBILITY_EVIDENCE_MISSING
  );
});

test("32. Successful promotion uses WAITLISTED → APPROVED only when validated", async () => {
  const harness = createCapacityWaitlistTestHarness({
    capacityStates: [
      {
        competitionId: "comp-1",
        divisionId: null,
        limit: 0,
        used: 0,
        reserved: 0,
        stateVersion: 0,
      },
      {
        competitionId: "comp-1",
        divisionId: "div-1",
        limit: 0,
        used: 0,
        reserved: 0,
        stateVersion: 0,
      },
    ],
  });
  const reg = await seedReadyRegistration(harness);
  await harness.service.placeRegistrationOnWaitlist({
    registrationId: reg.id,
    requestId: "wl-promo-ok",
  });
  await harness.capacityState.saveState({
    competitionId: "comp-1",
    divisionId: null,
    limit: 5,
    used: 0,
    reserved: 0,
    stateVersion: 1,
    updatedAt: harness.now(),
  });
  await harness.capacityState.saveState({
    competitionId: "comp-1",
    divisionId: "div-1",
    limit: 5,
    used: 0,
    reserved: 0,
    stateVersion: 1,
    updatedAt: harness.now(),
  });
  const snap = await harness.service.evaluateRegistrationCapacity({
    competitionId: "comp-1",
    divisionId: "div-1",
  });
  const result = await harness.service.promoteWaitlistedRegistration({
    registrationId: reg.id,
    requestId: "promo-ok",
    expectedStateVersion: snap.capacitySnapshot.stateVersion,
    approvalAuthorization: waitlistPromotionAuth(reg, {
      authorizationRef: "AUTHZ-PROMO-1",
      reason: "slot opened",
    }),
  });
  assert.equal(result.ok, true);
  assert.equal(result.previousStatus, REGISTRATION_STATUS.WAITLISTED);
  assert.equal(result.currentStatus, REGISTRATION_STATUS.APPROVED);
  assert.equal(result.reservation.status, "ACTIVE");
  assert.equal(result.waitlistEntry.status, "PROMOTED");
  assert.equal(result.metadata.entryCreated, false);
});

test("33. Promotion never creates a Core-02 Entry", async () => {
  const harness = createCapacityWaitlistTestHarness({
    capacityStates: [
      {
        competitionId: "comp-1",
        divisionId: null,
        limit: 0,
        used: 0,
        reserved: 0,
        stateVersion: 0,
      },
      {
        competitionId: "comp-1",
        divisionId: "div-1",
        limit: 0,
        used: 0,
        reserved: 0,
        stateVersion: 0,
      },
    ],
  });
  const reg = await seedReadyRegistration(harness, { id: "reg-no-entry" });
  await harness.service.placeRegistrationOnWaitlist({
    registrationId: reg.id,
    requestId: "wl-no-entry",
  });
  await harness.capacityState.saveState({
    competitionId: "comp-1",
    divisionId: null,
    limit: 2,
    used: 0,
    reserved: 0,
    stateVersion: 1,
    updatedAt: harness.now(),
  });
  await harness.capacityState.saveState({
    competitionId: "comp-1",
    divisionId: "div-1",
    limit: 2,
    used: 0,
    reserved: 0,
    stateVersion: 1,
    updatedAt: harness.now(),
  });
  const result = await harness.service.promoteWaitlistedRegistration({
    registrationId: reg.id,
    requestId: "promo-no-entry",
    approvalAuthorization: waitlistPromotionAuth(reg, {
      authorizationRef: "AUTHZ-NO-ENTRY",
      reason: "promote without entry",
    }),
  });
  assert.equal(result.ok, true);
  assert.equal(result.metadata.core02Entry, null);
  assert.equal(result.metadata.entryCreated, false);
  const src = readFileSync(join(SERVICES_ROOT, "capacityWaitlistService.js"), "utf8");
  assert.equal(src.includes("createEntry"), false);
  assert.equal(src.includes("EntryCreation"), false);
});

// ---------------------------------------------------------------------------
// Audit / isolation
// ---------------------------------------------------------------------------

test("34. Audit event is appended once per state-changing operation", async () => {
  const harness = harnessWithLimits(5, 5);
  const reg = await seedReadyRegistration(harness);
  const before = harness.audit._events.length;
  await harness.service.reserveRegistrationCapacity({
    registrationId: reg.id,
    requestId: "audit-once",
  });
  assert.equal(harness.audit._events.length, before + 1);
  assert.equal(harness.audit._events.at(-1).serviceVersion, CAPACITY_WAITLIST_SERVICE_VERSION);
});

test("35. Audit failure is not hidden", async () => {
  const harness = harnessWithLimits(5, 5);
  const reg = await seedReadyRegistration(harness);
  harness.audit.append = async () => {
    throw new Error("audit backend unavailable");
  };
  const result = await harness.service.reserveRegistrationCapacity({
    registrationId: reg.id,
    requestId: "audit-fail",
  });
  assert.equal(result.ok, false);
  assert.equal(result.metadata?.persistedWithoutAudit, true);
  assert.equal(result.metadata?.capacityReservationPersisted, true);
  assert.equal(result.metadata?.reconciliationRequired, true);
  assert.ok(result.errors.length > 0);
});

// ---------------------------------------------------------------------------
// Condition remediation — waitlist placement authorization
// ---------------------------------------------------------------------------

test("42. Capacity exhausted permits waitlist placement", async () => {
  const harness = exhaustedHarness();
  const reg = await seedReadyRegistration(harness);
  const result = await harness.service.placeRegistrationOnWaitlist({
    registrationId: reg.id,
    requestId: "wl-exhausted-ok",
  });
  assert.equal(result.ok, true);
  assert.equal(result.currentStatus, REGISTRATION_STATUS.WAITLISTED);
});

test("43. Policy requireWaitlist permits placement with available capacity", async () => {
  const harness = createCapacityWaitlistTestHarness({
    capacityStates: [
      {
        competitionId: "comp-1",
        divisionId: null,
        limit: 10,
        used: 0,
        reserved: 0,
        stateVersion: 0,
      },
      {
        competitionId: "comp-1",
        divisionId: "div-1",
        limit: 10,
        used: 0,
        reserved: 0,
        stateVersion: 0,
      },
    ],
    competitionPolicies: {
      "comp-1": {
        windowOpen: true,
        requireWaitlist: true,
        allowWaitlist: true,
        policyRef: "pol-require-wl",
      },
    },
  });
  const reg = await seedReadyRegistration(harness);
  const result = await harness.service.placeRegistrationOnWaitlist({
    registrationId: reg.id,
    requestId: "wl-policy-ok",
  });
  assert.equal(result.ok, true);
  assert.equal(result.currentStatus, REGISTRATION_STATUS.WAITLISTED);
  assert.equal(result.waitlistEntry.metadata.placementBasis, "POLICY_REQUIRED");
});

test("44. Bare forceWaitlist boolean without policy/authorization fails closed", async () => {
  const harness = harnessWithLimits(5, 5);
  const reg = await seedReadyRegistration(harness);
  const result = await harness.service.placeRegistrationOnWaitlist({
    registrationId: reg.id,
    requestId: "wl-bare-force",
    forceWaitlist: true,
  });
  assert.equal(result.ok, false);
  assert.equal(
    result.errors[0].code,
    REGISTRATION_ELIGIBILITY_ERROR_CODE.INVALID_WAITLIST_TRANSITION
  );
  assert.match(result.errors[0].message, /Bare forceWaitlist/);
});

test("45. Waitlist authorization for another registration fails", async () => {
  const harness = harnessWithLimits(5, 5);
  const reg = await seedReadyRegistration(harness);
  const result = await harness.service.placeRegistrationOnWaitlist({
    registrationId: reg.id,
    requestId: "wl-wrong-reg",
    waitlistAuthorization: waitlistPlacementAuth(reg, { registrationId: "other-reg" }),
  });
  assert.equal(result.ok, false);
  assert.equal(
    result.errors[0].code,
    REGISTRATION_ELIGIBILITY_ERROR_CODE.INVALID_WAITLIST_TRANSITION
  );
});

test("46. Waitlist authorization for another competition or division fails", async () => {
  const harness = harnessWithLimits(5, 5);
  const reg = await seedReadyRegistration(harness);
  const wrongComp = await harness.service.placeRegistrationOnWaitlist({
    registrationId: reg.id,
    requestId: "wl-wrong-comp",
    waitlistAuthorization: waitlistPlacementAuth(reg, { competitionId: "comp-other" }),
  });
  assert.equal(wrongComp.ok, false);
  const wrongDiv = await harness.service.placeRegistrationOnWaitlist({
    registrationId: reg.id,
    requestId: "wl-wrong-div",
    waitlistAuthorization: waitlistPlacementAuth(reg, { divisionId: "div-other" }),
  });
  assert.equal(wrongDiv.ok, false);
});

test("47. Valid scope-bound waitlist authorization permits placement", async () => {
  const harness = harnessWithLimits(5, 5);
  const reg = await seedReadyRegistration(harness);
  const result = await harness.service.placeRegistrationOnWaitlist({
    registrationId: reg.id,
    requestId: "wl-auth-ok",
    waitlistAuthorization: waitlistPlacementAuth(reg),
  });
  assert.equal(result.ok, true);
  assert.equal(result.waitlistEntry.metadata.placementBasis, "SCOPE_AUTHORIZATION");
});

// ---------------------------------------------------------------------------
// Condition remediation — promotion authorization scope
// ---------------------------------------------------------------------------

test("48. Missing promotion authorization fails", async () => {
  const harness = exhaustedHarness();
  const reg = await seedReadyRegistration(harness);
  await harness.service.placeRegistrationOnWaitlist({
    registrationId: reg.id,
    requestId: "wl-promo-missing-auth",
  });
  const result = await harness.service.promoteWaitlistedRegistration({
    registrationId: reg.id,
    requestId: "promo-missing-auth",
  });
  assert.equal(result.ok, false);
  assert.equal(
    result.errors[0].code,
    REGISTRATION_ELIGIBILITY_ERROR_CODE.INVALID_PROMOTION_PRECONDITION
  );
});

test("49. Bare boolean promotion authorization fails", async () => {
  const harness = exhaustedHarness();
  const reg = await seedReadyRegistration(harness);
  await harness.service.placeRegistrationOnWaitlist({
    registrationId: reg.id,
    requestId: "wl-promo-bool",
  });
  const result = await harness.service.promoteWaitlistedRegistration({
    registrationId: reg.id,
    requestId: "promo-bare-bool",
    approvalAuthorization: true,
  });
  assert.equal(result.ok, false);
});

test("50. Wrong registration scope on promotion authorization fails", async () => {
  const harness = exhaustedHarness();
  const reg = await seedReadyRegistration(harness);
  await harness.service.placeRegistrationOnWaitlist({
    registrationId: reg.id,
    requestId: "wl-promo-wrong-reg",
  });
  await harness.capacityState.saveState({
    competitionId: "comp-1",
    divisionId: null,
    limit: 5,
    used: 0,
    reserved: 0,
    stateVersion: 1,
    updatedAt: harness.now(),
  });
  await harness.capacityState.saveState({
    competitionId: "comp-1",
    divisionId: "div-1",
    limit: 5,
    used: 0,
    reserved: 0,
    stateVersion: 1,
    updatedAt: harness.now(),
  });
  const result = await harness.service.promoteWaitlistedRegistration({
    registrationId: reg.id,
    requestId: "promo-wrong-reg",
    approvalAuthorization: waitlistPromotionAuth(reg, { registrationId: "other-reg" }),
  });
  assert.equal(result.ok, false);
  assert.match(result.errors[0].path, /registrationId/);
});

test("51. Wrong competition scope on promotion authorization fails", async () => {
  const harness = exhaustedHarness();
  const reg = await seedReadyRegistration(harness);
  await harness.service.placeRegistrationOnWaitlist({
    registrationId: reg.id,
    requestId: "wl-promo-wrong-comp",
  });
  await harness.capacityState.saveState({
    competitionId: "comp-1",
    divisionId: null,
    limit: 5,
    used: 0,
    reserved: 0,
    stateVersion: 1,
    updatedAt: harness.now(),
  });
  await harness.capacityState.saveState({
    competitionId: "comp-1",
    divisionId: "div-1",
    limit: 5,
    used: 0,
    reserved: 0,
    stateVersion: 1,
    updatedAt: harness.now(),
  });
  const result = await harness.service.promoteWaitlistedRegistration({
    registrationId: reg.id,
    requestId: "promo-wrong-comp",
    approvalAuthorization: waitlistPromotionAuth(reg, { competitionId: "comp-other" }),
  });
  assert.equal(result.ok, false);
  assert.match(result.errors[0].path, /competitionId/);
});

test("52. Wrong division scope on promotion authorization fails", async () => {
  const harness = exhaustedHarness();
  const reg = await seedReadyRegistration(harness);
  await harness.service.placeRegistrationOnWaitlist({
    registrationId: reg.id,
    requestId: "wl-promo-wrong-div",
  });
  await harness.capacityState.saveState({
    competitionId: "comp-1",
    divisionId: null,
    limit: 5,
    used: 0,
    reserved: 0,
    stateVersion: 1,
    updatedAt: harness.now(),
  });
  await harness.capacityState.saveState({
    competitionId: "comp-1",
    divisionId: "div-1",
    limit: 5,
    used: 0,
    reserved: 0,
    stateVersion: 1,
    updatedAt: harness.now(),
  });
  const result = await harness.service.promoteWaitlistedRegistration({
    registrationId: reg.id,
    requestId: "promo-wrong-div",
    approvalAuthorization: waitlistPromotionAuth(reg, { divisionId: "div-other" }),
  });
  assert.equal(result.ok, false);
  assert.match(result.errors[0].path, /divisionId/);
});

test("53. Wrong authorization purpose fails", async () => {
  const harness = exhaustedHarness();
  const reg = await seedReadyRegistration(harness);
  await harness.service.placeRegistrationOnWaitlist({
    registrationId: reg.id,
    requestId: "wl-promo-wrong-purpose",
  });
  await harness.capacityState.saveState({
    competitionId: "comp-1",
    divisionId: null,
    limit: 5,
    used: 0,
    reserved: 0,
    stateVersion: 1,
    updatedAt: harness.now(),
  });
  await harness.capacityState.saveState({
    competitionId: "comp-1",
    divisionId: "div-1",
    limit: 5,
    used: 0,
    reserved: 0,
    stateVersion: 1,
    updatedAt: harness.now(),
  });
  const result = await harness.service.promoteWaitlistedRegistration({
    registrationId: reg.id,
    requestId: "promo-wrong-purpose",
    approvalAuthorization: waitlistPromotionAuth(reg, {
      purpose: CAPACITY_AUTH_PURPOSE.WAITLIST_PLACEMENT,
    }),
  });
  assert.equal(result.ok, false);
  assert.match(result.errors[0].path, /purpose/);
});

test("54. Correct scope-bound authorization permits validated promotion", async () => {
  const harness = exhaustedHarness();
  const reg = await seedReadyRegistration(harness);
  await harness.service.placeRegistrationOnWaitlist({
    registrationId: reg.id,
    requestId: "wl-promo-scope-ok",
  });
  await harness.capacityState.saveState({
    competitionId: "comp-1",
    divisionId: null,
    limit: 5,
    used: 0,
    reserved: 0,
    stateVersion: 1,
    updatedAt: harness.now(),
  });
  await harness.capacityState.saveState({
    competitionId: "comp-1",
    divisionId: "div-1",
    limit: 5,
    used: 0,
    reserved: 0,
    stateVersion: 1,
    updatedAt: harness.now(),
  });
  const result = await harness.service.promoteWaitlistedRegistration({
    registrationId: reg.id,
    requestId: "promo-scope-ok",
    approvalAuthorization: waitlistPromotionAuth(reg),
  });
  assert.equal(result.ok, true);
  assert.equal(result.currentStatus, REGISTRATION_STATUS.APPROVED);
  assert.equal(result.metadata.authorizationPurpose, CAPACITY_AUTH_PURPOSE.WAITLIST_PROMOTION);
  assert.equal(result.metadata.entryCreated, false);
});

test("55. Exact reservation replay after audit partial failure does not consume capacity twice", async () => {
  const harness = harnessWithLimits(5, 5);
  const reg = await seedReadyRegistration(harness);
  const originalAppend = harness.audit.append.bind(harness.audit);
  let failOnce = true;
  harness.audit.append = async (event) => {
    if (failOnce) {
      failOnce = false;
      throw new Error("transient audit failure");
    }
    return originalAppend(event);
  };

  const first = await harness.service.reserveRegistrationCapacity({
    registrationId: reg.id,
    requestId: "rsv-partial-replay",
  });
  assert.equal(first.ok, false);
  assert.equal(first.metadata.persistedWithoutAudit, true);
  assert.equal(first.metadata.capacityReservationPersisted, true);

  // Restore audit, but reservation already exists — duplicate active reserve with new requestId fails.
  // Exact same requestId cannot HIT because idempotency record was not saved; must fail closed without
  // consuming a second slot (already reserved).
  harness.audit.append = originalAppend;
  const after = await harness.service.evaluateRegistrationCapacity({
    competitionId: "comp-1",
    divisionId: "div-1",
  });
  assert.equal(after.capacitySnapshot.competitionReserved, 1);

  const second = await harness.service.reserveRegistrationCapacity({
    registrationId: reg.id,
    requestId: "rsv-partial-replay",
  });
  assert.equal(second.ok, false);
  assert.equal(
    second.errors[0].code,
    REGISTRATION_ELIGIBILITY_ERROR_CODE.DUPLICATE_ACTIVE_RESERVATION
  );
  const finalSnap = await harness.service.evaluateRegistrationCapacity({
    competitionId: "comp-1",
    divisionId: "div-1",
  });
  assert.equal(finalSnap.capacitySnapshot.competitionReserved, 1);
});

test("36. No direct Date.now usage in capacity services", () => {
  const files = collectJsFiles(SERVICES_ROOT).filter((f) =>
    f.includes("capacityWaitlist")
  );
  for (const file of files) {
    const src = readFileSync(file, "utf8");
    const withoutBlockComments = src.replace(/\/\*[\s\S]*?\*\//g, "").replace(/\/\/.*$/gm, "");
    assert.equal(
      withoutBlockComments.includes("Date.now("),
      false,
      `${file} must not call Date.now`
    );
  }
});

test("37. No random identifier generation in capacity services", () => {
  const files = collectJsFiles(SERVICES_ROOT).filter((f) =>
    f.includes("capacityWaitlist")
  );
  for (const file of files) {
    const src = readFileSync(file, "utf8");
    assert.equal(src.includes("Math.random("), false, `${file} must not call Math.random`);
    assert.equal(src.includes("crypto.random"), false, `${file} must not use crypto.random*`);
  }
});

test("38. No direct runtime imports from Core-01/02/04/05 or legacy Phase 3C", () => {
  const files = collectJsFiles(MODULE_ROOT);
  const banned = [
    "participants/",
    "classification/",
    "constraints/",
    "team-tournament/",
    "individual-tournament/",
    "registrations/services/",
  ];
  for (const file of files) {
    const src = readFileSync(file, "utf8");
    for (const bannedPath of banned) {
      assert.equal(
        src.includes(`../${bannedPath}`) ||
          src.includes(`../../${bannedPath}`) ||
          src.includes(`competition-core/${bannedPath}`),
        false,
        `${file} must not import ${bannedPath}`
      );
    }
  }
});

test("39. Phase 1C public surface remains available", async () => {
  const mod = await import("../src/features/competition-core/registration-eligibility/index.js");
  assert.equal(typeof mod.createEligibilityEvaluationService, "function");
});

test("40. Phase 1B public surface remains available", async () => {
  const mod = await import("../src/features/competition-core/registration-eligibility/index.js");
  assert.equal(typeof mod.createRegistrationLifecycleService, "function");
});

test("41. Phase 1A public surface remains available", async () => {
  const mod = await import("../src/features/competition-core/registration-eligibility/index.js");
  assert.equal(typeof mod.createEligibilityDecision, "function");
  assert.equal(typeof mod.applyRegistrationTransition, "function");
  assert.equal(typeof createCapacityWaitlistService, "function");
  assert.equal(typeof mod.createCapacityWaitlistService, "function");
  assert.equal(ELIGIBILITY_OUTCOME.ELIGIBLE, "ELIGIBLE");
});
