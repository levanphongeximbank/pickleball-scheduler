/**
 * CORE-13 fixture capacity-safe scheduler — harness only.
 * Does not change canonical capacity guard semantics.
 */

import test from "node:test";
import assert from "node:assert/strict";

import { CASE_CATALOG } from "../scripts/core13/core13-staging-acceptance-proofs.mjs";
import {
  FIXTURE_BASE_HORIZON_ISO,
  FIXTURE_CANONICAL_SLOT_MS,
  NEGATIVE_OVERLAP_FIXTURE_CASE,
  POSITIVE_FIXTURE_SCHEDULE_CASES,
  collectAuthoritativeBlockingWindows,
  evaluateCapacitySafePlan,
  planCapacitySafeFixtureSchedule,
  resolveWriterScheduleWindow,
  toMatchScheduleFields,
  windowsOverlapHalfOpen,
} from "../scripts/core13/core13-staging-fixture-schedule-planner.mjs";
import {
  createValidFixtureReceipt,
  evaluateFixtureReceipt,
} from "../scripts/core13/core13-staging-fixture-receipt.mjs";
import { REQUIRED_WRITER_PORTS } from "../scripts/core13/core13-staging-fixture-writers.mjs";
import { createReadyDailyPreflightSnapshot } from "../scripts/core13/core13-staging-fixture-preflight.mjs";
import { materializeReceiptFromWriters } from "../scripts/core13/core13-staging-fixture-provisioner.mjs";
import { projectMatchScheduleFromAdapterB } from "../src/features/competition-engine/operations/referee/assignment/server/projectMatchScheduleFromAdapterB.js";

function nextUuid(seq) {
  return `aaaaaaaa-bbbb-4ccc-8ddd-${String(seq).padStart(12, "0")}`;
}

function createStubWriters(capture = []) {
  let seq = 20;
  const writers = {};
  for (const name of REQUIRED_WRITER_PORTS) {
    writers[name] = async (input = {}) => {
      capture.push({ name, input });
      return { id: nextUuid(seq++), ok: true, assignmentId: nextUuid(seq++) };
    };
  }
  writers.resolveExistingTenantFixture = async ({ scope } = {}) => ({
    id: scope === "TENANT_B" ? "core13-qa-tenant-b" : "core13-qa-tenant-a",
    tenantId: scope === "TENANT_B" ? "core13-qa-tenant-b" : "core13-qa-tenant-a",
    ok: true,
  });
  writers.resolveQaIdentitySet = async () => ({
    ok: true,
    organizerA: {
      userId: "11111111-1111-4111-8111-111111111111",
      tenantId: "core13-qa-tenant-a",
      role: "VENUE_OWNER",
      credentialPresent: true,
    },
    organizerB: {
      userId: "22222222-2222-4222-8222-222222222222",
      tenantId: "core13-qa-tenant-b",
      role: "VENUE_OWNER",
      credentialPresent: true,
    },
    refereeA: {
      userId: "33333333-3333-4333-8333-333333333333",
      tenantId: "core13-qa-tenant-a",
      role: "REFEREE",
      status: "ACTIVE",
      credentialPresent: true,
      contract01Evidence: {
        subjectId: "33333333-3333-4333-8333-333333333333",
        canonicalSubjectId: "33333333-3333-4333-8333-333333333333",
        role: "REFEREE",
        status: "active",
        active: true,
        tenantId: "core13-qa-tenant-a",
        venueId: "core13-qa-tenant-a",
        source: "identity",
      },
    },
    replacementReferee: {
      userId: "44444444-4444-4444-8444-444444444444",
      tenantId: "core13-qa-tenant-a",
      role: "REFEREE",
      status: "ACTIVE",
      contract01Evidence: {
        subjectId: "44444444-4444-4444-8444-444444444444",
        canonicalSubjectId: "44444444-4444-4444-8444-444444444444",
        role: "REFEREE",
        status: "active",
        active: true,
        tenantId: "core13-qa-tenant-a",
        venueId: "core13-qa-tenant-a",
        source: "identity",
      },
    },
    inactiveReferee: {
      userId: "55555555-5555-4555-8555-555555555555",
      tenantId: "core13-qa-tenant-a",
      role: "REFEREE",
      status: "suspended",
      contract01Evidence: {
        subjectId: "55555555-5555-4555-8555-555555555555",
        canonicalSubjectId: "55555555-5555-4555-8555-555555555555",
        role: "REFEREE",
        status: "suspended",
        active: false,
        tenantId: "core13-qa-tenant-a",
        venueId: null,
        source: "identity",
      },
    },
    nonCanonicalSubject: {
      id: "ffffffff-ffff-4fff-8fff-ffffffffffff",
      classification: "NON_CANONICAL_EXPECTED_ABSENT",
    },
  });
  writers.resolveDailyPlayPreflight = async ({ tenantId } = {}) =>
    createReadyDailyPreflightSnapshot({
      tenantId: tenantId || "core13-qa-tenant-a",
      clubTenantId: tenantId || "core13-qa-tenant-a",
    });
  return writers;
}

test("A. positive inProgress and scoringActive get distinct non-overlapping windows", () => {
  const plan = planCapacitySafeFixtureSchedule();
  assert.equal(plan.ok, true);
  const inProgress = plan.cases.inProgress;
  const scoringActive = plan.cases.scoringActive;
  assert.ok(inProgress.startAt);
  assert.ok(scoringActive.startAt);
  assert.notEqual(inProgress.startAt, scoringActive.startAt);
  assert.equal(windowsOverlapHalfOpen(inProgress, scoringActive), false);
});

test("B. scheduler avoids an unrelated authoritative active assignment", () => {
  const blocking = collectAuthoritativeBlockingWindows([
    {
      assignmentId: "unrelated-team",
      matchId: "team-match-1",
      refereeId: "ref-a",
      startAt: FIXTURE_BASE_HORIZON_ISO,
      endAt: new Date(Date.parse(FIXTURE_BASE_HORIZON_ISO) + FIXTURE_CANONICAL_SLOT_MS).toISOString(),
      source: "UNRELATED_TEAM_TOURNAMENT",
    },
  ]);
  const plan = planCapacitySafeFixtureSchedule({
    authoritativeBlockingWindows: blocking,
  });
  assert.equal(plan.ok, true);
  for (const key of POSITIVE_FIXTURE_SCHEDULE_CASES) {
    assert.equal(windowsOverlapHalfOpen(plan.cases[key], blocking[0]), false);
  }
});

test("C. scheduler remains deterministic for same capacity snapshot", () => {
  const snapshot = [
    {
      startAt: "2099-06-15T13:00:00.000Z",
      endAt: "2099-06-15T14:00:00.000Z",
      matchId: "block-1",
    },
  ];
  const a = planCapacitySafeFixtureSchedule({ authoritativeBlockingWindows: snapshot });
  const b = planCapacitySafeFixtureSchedule({ authoritativeBlockingWindows: snapshot });
  assert.deepEqual(a.cases, b.cases);
  assert.equal(a.horizonStartIso, b.horizonStartIso);
});

test("D. scheduler reserves windows selected earlier in same fixture plan", () => {
  const plan = planCapacitySafeFixtureSchedule();
  const seen = [];
  for (const key of POSITIVE_FIXTURE_SCHEDULE_CASES) {
    const window = plan.cases[key];
    for (const prior of seen) {
      assert.equal(windowsOverlapHalfOpen(window, prior), false);
    }
    seen.push(window);
  }
});

test("E. explicit overlap-negative case still overlaps intentionally", () => {
  const plan = planCapacitySafeFixtureSchedule();
  assert.equal(
    windowsOverlapHalfOpen(plan.cases.overlapA, plan.cases[NEGATIVE_OVERLAP_FIXTURE_CASE]),
    true
  );
  assert.equal(plan.cases.overlapB.kind, "EXPLICIT_NEGATIVE_OVERLAP");
});

test("F. positive cases never use overlap-negative slot except the overlapA source", () => {
  const plan = planCapacitySafeFixtureSchedule();
  const negative = plan.cases.overlapB;
  for (const key of POSITIVE_FIXTURE_SCHEDULE_CASES) {
    if (key === "overlapA") continue;
    assert.equal(windowsOverlapHalfOpen(plan.cases[key], negative), false);
  }
});

test("G. no fixed 08:00-09:00 shared positive default", () => {
  const plan = planCapacitySafeFixtureSchedule();
  assert.equal(plan.FIXED_SHARED_08_00_09_00_POSITIVE_WINDOW, "DENY");
  assert.notEqual(plan.horizonStartIso, "08:00");
  const starts = POSITIVE_FIXTURE_SCHEDULE_CASES.map((key) => plan.cases[key].startAt);
  assert.equal(new Set(starts).size, POSITIVE_FIXTURE_SCHEDULE_CASES.length);
  for (const start of starts) {
    assert.equal(start.includes("T08:00:00"), false);
  }
  const shared0800 = planCapacitySafeFixtureSchedule({
    horizonStartIso: "2026-08-19T08:00:00.000Z",
  });
  assert.equal(evaluateCapacitySafePlan(shared0800).ok, true);
  assert.notEqual(shared0800.cases.inProgress.startAt, shared0800.cases.scoringActive.startAt);
});

test("H. Adapter B / match schedule / receipt use the same planned window", async () => {
  const capture = [];
  const result = await materializeReceiptFromWriters({
    writers: createStubWriters(capture),
    allowExecute: true,
    runId: "run-schedule-align",
  });
  assert.equal(result.ok, true);
  const plan = result.receipt.schedulePlan;
  assert.equal(evaluateCapacitySafePlan(plan).ok, true);
  const matchCreates = capture.filter((row) => row.name === "createInternalMatch");
  const byKey = Object.fromEntries(
    matchCreates.map((row) => [row.input.fixtureKey, row.input])
  );
  for (const key of [...POSITIVE_FIXTURE_SCHEDULE_CASES, NEGATIVE_OVERLAP_FIXTURE_CASE]) {
    const fields = toMatchScheduleFields(plan.cases[key]);
    assert.equal(byKey[key].startAt, fields.startAt);
    assert.equal(byKey[key].endAt, fields.endAt);
    assert.equal(result.receipt.matches[key].startAt, fields.startAt);
    assert.equal(result.receipt.matches[key].endAt, fields.endAt);
    const projected = projectMatchScheduleFromAdapterB({
      matchId: result.receipt.matches[key].id,
      matchContext: { scheduledAt: fields.scheduledAt },
      modeMatch: {
        scheduledStart: fields.scheduledStart,
        durationMinutes: fields.durationMinutes,
      },
    });
    assert.equal(projected.startAt, fields.startAt);
    assert.equal(projected.endAt, fields.endAt);
  }
  const receiptOk = evaluateFixtureReceipt(result.receipt);
  assert.equal(receiptOk.ok, true);
});

test("I. CAS expectedVersion remains sourced authoritatively", async () => {
  const capture = [];
  const writers = createStubWriters(capture);
  writers.bootstrapRefereeAssignment = async (input = {}) => {
    capture.push({ name: "bootstrapRefereeAssignment", input });
    assert.equal(Object.prototype.hasOwnProperty.call(input, "expectedVersion"), false);
    return {
      ok: true,
      id: nextUuid(90),
      assignmentId: nextUuid(91),
      BOOTSTRAP_EXPECTED_VERSION_SOURCE: "CANONICAL_AUTHORITATIVE_ASSIGNMENT_STATE",
    };
  };
  const result = await materializeReceiptFromWriters({
    writers,
    allowExecute: true,
    runId: "run-cas-source",
  });
  assert.equal(result.ok, true);
  const boots = capture.filter((row) => row.name === "bootstrapRefereeAssignment");
  assert.ok(boots.length >= 1);
  for (const row of boots) {
    assert.equal(Object.prototype.hasOwnProperty.call(row.input, "expectedVersion"), false);
  }
});

test("J. 29-case catalog remains exactly 29", () => {
  assert.equal(CASE_CATALOG.length, 29);
  assert.equal(new Set(CASE_CATALOG).size, 29);
});

test("writer schedule window is planner-derived and has no 08:00-09:00 fallback", () => {
  assert.equal(resolveWriterScheduleWindow({}), null);
  assert.equal(
    resolveWriterScheduleWindow({
      startAt: "2026-08-19T08:00:00.000Z",
      endAt: "2026-08-19T09:00:00.000Z",
    }).startAt,
    "2026-08-19T08:00:00.000Z"
  );
  const plan = planCapacitySafeFixtureSchedule();
  const fromPlanner = resolveWriterScheduleWindow({
    fixtureKey: "inProgress",
    scheduleWindow: plan.cases.inProgress,
  });
  assert.equal(fromPlanner.startAt, plan.cases.inProgress.startAt);
  assert.notEqual(fromPlanner.startAt, plan.cases.scoringActive.startAt);
});

test("planner stays test orchestration and does not weaken capacity", () => {
  const plan = planCapacitySafeFixtureSchedule();
  assert.equal(plan.orchestrationOnly, true);
  assert.equal(plan.authority, "TEST_ORCHESTRATION_NOT_CANONICAL_RUNTIME");
  const receipt = createValidFixtureReceipt({ runId: "run-planner-receipt" });
  assert.equal(evaluateFixtureReceipt(receipt).ok, true);
});
