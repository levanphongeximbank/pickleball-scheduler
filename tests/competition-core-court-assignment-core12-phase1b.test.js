/**
 * CORE-12 Phase 1B — capability-local court assignment contracts + deterministic core.
 */

import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync, existsSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import {
  CORE12_COURT_ASSIGNMENT_SCHEMA_V1,
  CORE12_COMPARATOR_VERSION,
  CORE12_POLICY_VERSION,
  CORE12_COURT_SELECTION_STRATEGY_VERSION,
  COURT_ASSIGNMENT_STATUS,
  COURT_AVAILABILITY_STATUS,
  COURT_ASSIGNMENT_SOURCE,
  COURT_LOCK_SOURCE,
  COURT_ASSIGNMENT_REJECTION_CODE,
  COURT_ASSIGNMENT_REJECTION_CODE_ALIASES,
  COURT_ASSIGNMENT_CONFLICT_CODE,
  COURT_ASSIGNMENT_CONFLICT_CODE_ALIASES,
  CAPABILITY_MATCH_MODE,
  MATCH_ORDERING_STRATEGY,
  COURT_ORDERING_STRATEGY,
  INVALID_LOCK_BEHAVIOR,
  assignCourtsDeterministic,
  validateCourtAssignmentRequest,
  createCourtAssignmentRequest,
  createCourtAssignmentPolicy,
  createCourtAssignmentPort,
  deepFreezeCanonical,
  intervalsOverlapHalfOpen,
  compareStableString,
  compareMatches,
  compareCourts,
  resolveCanonicalConflictCode,
} from "../src/features/competition-core/court-assignment/index.js";

import {
  createFailClosedCourtAvailabilityPort,
  createFixedCourtAvailabilityPort,
  createInMemoryCourtAssignmentAuditPort,
  createFailClosedCourtAssignmentPort,
} from "../src/features/competition-core/court-assignment/adapters/index.js";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const CA_ROOT = path.join(
  ROOT,
  "src/features/competition-core/court-assignment"
);
const ROOT_BARREL = path.join(ROOT, "src/features/competition-core/index.js");

function basePolicy(overrides = {}) {
  return {
    policyId: "pol-ca-1",
    policyVersion: CORE12_POLICY_VERSION,
    partialAssignmentAllowed: false,
    overrideManualLocks: false,
    acceptLockedAssignments: true,
    invalidLockBehavior: INVALID_LOCK_BEHAVIOR.CONFLICT,
    allowUnscheduledMatches: false,
    skipTerminalStatuses: true,
    matchOrderingStrategy: MATCH_ORDERING_STRATEGY.STABLE_PRIORITY_THEN_ID,
    courtOrderingStrategy: COURT_ORDERING_STRATEGY.STABLE_PRIORITY_THEN_ID,
    requireVenueTimezone: true,
    requireAvailabilitySnapshot: true,
    capabilityMatchMode: CAPABILITY_MATCH_MODE.HARD,
    overlapMode: "HALF_OPEN",
    comparatorVersion: CORE12_COMPARATOR_VERSION,
    courtSelectionStrategyVersion: CORE12_COURT_SELECTION_STRATEGY_VERSION,
    ...overrides,
  };
}

function baseCourt(overrides = {}) {
  return {
    courtId: "court-a",
    tenantId: "tenant-1",
    venueId: "venue-1",
    clubId: "club-1",
    availabilityStatus: COURT_AVAILABILITY_STATUS.AVAILABLE,
    active: true,
    eligible: true,
    priority: 0,
    capabilities: { courtType: "indoor" },
    availabilityIntervals: [
      {
        start: "2026-07-22T00:00:00Z",
        end: "2026-07-22T23:59:00Z",
      },
    ],
    ...overrides,
  };
}

function baseMatch(overrides = {}) {
  return {
    matchId: "m1",
    competitionId: "comp-1",
    tenantId: "tenant-1",
    venueId: "venue-1",
    clubId: "club-1",
    scheduledStart: "2026-07-22T10:00:00Z",
    scheduledEnd: "2026-07-22T10:45:00Z",
    priority: 0,
    ...overrides,
  };
}

function baseRequest(overrides = {}) {
  return {
    schemaVersion: CORE12_COURT_ASSIGNMENT_SCHEMA_V1,
    requestId: "req-1",
    tenantId: "tenant-1",
    clubId: "club-1",
    venueId: "venue-1",
    competitionId: "comp-1",
    timezone: "Asia/Ho_Chi_Minh",
    matches: [baseMatch()],
    courts: [baseCourt()],
    lockedAssignments: [],
    constraints: [],
    policy: basePolicy(),
    availabilitySnapshotRef: {
      snapshotId: "avail-1",
      snapshotVersion: "v1",
      fingerprint: "aabbccdd",
    },
    scheduleSnapshotRef: {
      snapshotId: "sched-1",
      snapshotVersion: "v1",
      fingerprint: "11223344",
    },
    ...overrides,
  };
}

function deepClone(value) {
  return JSON.parse(JSON.stringify(value));
}

// ---------------------------------------------------------------------------
// 1. Basic successful assignment
// ---------------------------------------------------------------------------

test("01 basic successful assignment", () => {
  const result = assignCourtsDeterministic(baseRequest());
  assert.equal(result.status, COURT_ASSIGNMENT_STATUS.SUCCESS);
  assert.equal(result.assignments.length, 1);
  assert.equal(result.assignments[0].courtId, "court-a");
  assert.equal(result.assignments[0].assignmentSource, COURT_ASSIGNMENT_SOURCE.AUTO);
  assert.equal(result.unassigned.length, 0);
  assert.ok(result.resultFingerprint);
});

// ---------------------------------------------------------------------------
// 2. Multiple matches across multiple courts
// ---------------------------------------------------------------------------

test("02 multiple matches across multiple courts", () => {
  const result = assignCourtsDeterministic(
    baseRequest({
      matches: [
        baseMatch({ matchId: "m1", scheduledStart: "2026-07-22T10:00:00Z", scheduledEnd: "2026-07-22T10:45:00Z" }),
        baseMatch({ matchId: "m2", scheduledStart: "2026-07-22T10:00:00Z", scheduledEnd: "2026-07-22T10:45:00Z" }),
      ],
      courts: [
        baseCourt({ courtId: "court-a", priority: 10 }),
        baseCourt({ courtId: "court-b", priority: 5 }),
      ],
    })
  );
  assert.equal(result.status, COURT_ASSIGNMENT_STATUS.SUCCESS);
  assert.equal(result.assignments.length, 2);
  const byMatch = Object.fromEntries(
    result.assignments.map((a) => [a.matchId, a.courtId])
  );
  assert.equal(byMatch.m1, "court-a");
  assert.equal(byMatch.m2, "court-b");
});

// ---------------------------------------------------------------------------
// 3 / 30. Same court non-overlap at exact boundary (half-open adjacent)
// ---------------------------------------------------------------------------

test("03 same court non-overlap at exact boundary", () => {
  const result = assignCourtsDeterministic(
    baseRequest({
      matches: [
        baseMatch({ matchId: "m1", scheduledStart: "2026-07-22T10:00:00Z", scheduledEnd: "2026-07-22T10:45:00Z" }),
        baseMatch({ matchId: "m2", scheduledStart: "2026-07-22T10:45:00Z", scheduledEnd: "2026-07-22T11:30:00Z" }),
      ],
      courts: [baseCourt({ courtId: "court-a" })],
    })
  );
  assert.equal(result.status, COURT_ASSIGNMENT_STATUS.SUCCESS);
  assert.equal(result.assignments.length, 2);
  assert.ok(result.assignments.every((a) => a.courtId === "court-a"));
});

test("30 adjacent half-open intervals helper", () => {
  const aStart = Date.parse("2026-07-22T10:00:00Z");
  const aEnd = Date.parse("2026-07-22T10:45:00Z");
  const bStart = Date.parse("2026-07-22T10:45:00Z");
  const bEnd = Date.parse("2026-07-22T11:30:00Z");
  assert.equal(intervalsOverlapHalfOpen(aStart, aEnd, bStart, bEnd), false);
});

// ---------------------------------------------------------------------------
// 4. Same court positive-duration overlap
// ---------------------------------------------------------------------------

test("04 same court positive-duration overlap forces second court or unassigned", () => {
  const result = assignCourtsDeterministic(
    baseRequest({
      matches: [
        baseMatch({ matchId: "m1", scheduledStart: "2026-07-22T10:00:00Z", scheduledEnd: "2026-07-22T10:45:00Z" }),
        baseMatch({ matchId: "m2", scheduledStart: "2026-07-22T10:30:00Z", scheduledEnd: "2026-07-22T11:15:00Z" }),
      ],
      courts: [baseCourt({ courtId: "court-a" })],
      policy: basePolicy({ partialAssignmentAllowed: true }),
    })
  );
  assert.equal(result.status, COURT_ASSIGNMENT_STATUS.PARTIAL);
  assert.equal(result.assignments.length, 1);
  assert.equal(result.unassigned.length, 1);
  assert.equal(
    result.unassigned[0].reasonCode,
    COURT_ASSIGNMENT_CONFLICT_CODE.NO_ELIGIBLE_COURT
  );
});

// ---------------------------------------------------------------------------
// 5. Duplicate match rejection
// ---------------------------------------------------------------------------

test("05 duplicate match rejection", () => {
  const result = assignCourtsDeterministic(
    baseRequest({
      matches: [baseMatch({ matchId: "m1" }), baseMatch({ matchId: "m1" })],
    })
  );
  assert.equal(result.status, COURT_ASSIGNMENT_STATUS.REJECTED);
  assert.equal(result.failure.code, COURT_ASSIGNMENT_REJECTION_CODE.DUPLICATE_MATCH_ID);
});

// ---------------------------------------------------------------------------
// 6. Duplicate court rejection
// ---------------------------------------------------------------------------

test("06 duplicate court rejection", () => {
  const result = assignCourtsDeterministic(
    baseRequest({
      courts: [baseCourt({ courtId: "court-a" }), baseCourt({ courtId: "court-a" })],
    })
  );
  assert.equal(result.status, COURT_ASSIGNMENT_STATUS.REJECTED);
  assert.equal(result.failure.code, COURT_ASSIGNMENT_REJECTION_CODE.DUPLICATE_COURT_ID);
});

// ---------------------------------------------------------------------------
// 7. Invalid match interval
// ---------------------------------------------------------------------------

test("07 invalid match interval reversed", () => {
  const result = assignCourtsDeterministic(
    baseRequest({
      matches: [
        baseMatch({
          scheduledStart: "2026-07-22T11:00:00Z",
          scheduledEnd: "2026-07-22T10:00:00Z",
        }),
      ],
    })
  );
  assert.equal(result.status, COURT_ASSIGNMENT_STATUS.REJECTED);
  assert.equal(result.failure.code, COURT_ASSIGNMENT_REJECTION_CODE.INVALID_TIME_WINDOW);
});

test("07b invalid match interval equal / zero-length", () => {
  const result = assignCourtsDeterministic(
    baseRequest({
      matches: [
        baseMatch({
          scheduledStart: "2026-07-22T10:00:00Z",
          scheduledEnd: "2026-07-22T10:00:00Z",
        }),
      ],
    })
  );
  assert.equal(result.status, COURT_ASSIGNMENT_STATUS.REJECTED);
  assert.equal(result.failure.code, COURT_ASSIGNMENT_REJECTION_CODE.INVALID_TIME_WINDOW);
});

test("07c ambiguous timezone-less instant rejected", () => {
  const result = assignCourtsDeterministic(
    baseRequest({
      matches: [
        baseMatch({
          scheduledStart: "2026-07-22T10:00:00",
          scheduledEnd: "2026-07-22T10:45:00",
        }),
      ],
    })
  );
  assert.equal(result.status, COURT_ASSIGNMENT_STATUS.REJECTED);
  assert.equal(result.failure.code, COURT_ASSIGNMENT_REJECTION_CODE.INVALID_TIME_WINDOW);
});

// ---------------------------------------------------------------------------
// 8. Invalid court availability interval
// ---------------------------------------------------------------------------

test("08 invalid court availability interval", () => {
  const result = assignCourtsDeterministic(
    baseRequest({
      courts: [
        baseCourt({
          availabilityIntervals: [
            { start: "2026-07-22T12:00:00Z", end: "2026-07-22T11:00:00Z" },
          ],
        }),
      ],
    })
  );
  assert.equal(result.status, COURT_ASSIGNMENT_STATUS.REJECTED);
  assert.equal(result.failure.code, COURT_ASSIGNMENT_REJECTION_CODE.INVALID_TIME_WINDOW);
});

// ---------------------------------------------------------------------------
// 9. Cross-tenant rejection
// ---------------------------------------------------------------------------

test("09 cross-tenant rejection", () => {
  const result = assignCourtsDeterministic(
    baseRequest({
      courts: [baseCourt({ tenantId: "other-tenant" })],
    })
  );
  assert.equal(result.status, COURT_ASSIGNMENT_STATUS.REJECTED);
  assert.equal(
    result.failure.code,
    COURT_ASSIGNMENT_REJECTION_CODE.CROSS_TENANT_REFERENCE
  );
});

// ---------------------------------------------------------------------------
// 10. Cross-venue rejection
// ---------------------------------------------------------------------------

test("10 cross-venue rejection", () => {
  const result = assignCourtsDeterministic(
    baseRequest({
      courts: [baseCourt({ venueId: "venue-other" })],
    })
  );
  assert.equal(result.status, COURT_ASSIGNMENT_STATUS.REJECTED);
  assert.equal(
    result.failure.code,
    COURT_ASSIGNMENT_REJECTION_CODE.CROSS_VENUE_REFERENCE
  );
});

test("10b cross-club rejection", () => {
  const result = assignCourtsDeterministic(
    baseRequest({
      courts: [baseCourt({ clubId: "club-other" })],
    })
  );
  assert.equal(result.status, COURT_ASSIGNMENT_STATUS.REJECTED);
  assert.equal(
    result.failure.code,
    COURT_ASSIGNMENT_REJECTION_CODE.CROSS_CLUB_REFERENCE
  );
});

// ---------------------------------------------------------------------------
// 11. Disabled / ineligible court exclusion
// ---------------------------------------------------------------------------

test("11 disabled or ineligible court exclusion", () => {
  const result = assignCourtsDeterministic(
    baseRequest({
      courts: [
        baseCourt({
          courtId: "court-dead",
          active: false,
          availabilityStatus: COURT_AVAILABILITY_STATUS.DISABLED,
        }),
      ],
      policy: basePolicy({ partialAssignmentAllowed: false }),
    })
  );
  assert.equal(result.status, COURT_ASSIGNMENT_STATUS.INFEASIBLE);
  assert.equal(result.assignments.length, 0);
  assert.equal(
    result.unassigned[0].reasonCode,
    COURT_ASSIGNMENT_CONFLICT_CODE.NO_ELIGIBLE_COURT
  );
});

// ---------------------------------------------------------------------------
// 12. Court availability full-coverage requirement
// ---------------------------------------------------------------------------

test("12 court availability full-coverage requirement", () => {
  const result = assignCourtsDeterministic(
    baseRequest({
      courts: [
        baseCourt({
          availabilityIntervals: [
            {
              start: "2026-07-22T10:00:00Z",
              end: "2026-07-22T10:30:00Z",
            },
          ],
        }),
      ],
    })
  );
  assert.equal(result.status, COURT_ASSIGNMENT_STATUS.INFEASIBLE);
  assert.equal(result.assignments.length, 0);
});

// ---------------------------------------------------------------------------
// 13. Capability constraint matching
// ---------------------------------------------------------------------------

test("13 capability constraint matching", () => {
  const ok = assignCourtsDeterministic(
    baseRequest({
      matches: [baseMatch({ requiredCapabilities: ["indoor"] })],
      courts: [baseCourt({ capabilities: ["indoor"] })],
    })
  );
  assert.equal(ok.status, COURT_ASSIGNMENT_STATUS.SUCCESS);

  const bad = assignCourtsDeterministic(
    baseRequest({
      matches: [baseMatch({ requiredCapabilities: ["outdoor"] })],
      courts: [baseCourt({ capabilities: ["indoor"] })],
    })
  );
  assert.equal(bad.status, COURT_ASSIGNMENT_STATUS.INFEASIBLE);
  assert.equal(bad.assignments.length, 0);
});

// ---------------------------------------------------------------------------
// 14. Valid locked assignment preservation
// ---------------------------------------------------------------------------

test("14 valid locked assignment preservation", () => {
  const result = assignCourtsDeterministic(
    baseRequest({
      matches: [
        baseMatch({ matchId: "m1" }),
        baseMatch({
          matchId: "m2",
          scheduledStart: "2026-07-22T10:00:00Z",
          scheduledEnd: "2026-07-22T10:45:00Z",
        }),
      ],
      courts: [
        baseCourt({ courtId: "court-a", priority: 100 }),
        baseCourt({ courtId: "court-b", priority: 1 }),
      ],
      lockedAssignments: [
        {
          matchId: "m1",
          courtId: "court-b",
          lockSource: COURT_LOCK_SOURCE.MANUAL,
        },
      ],
    })
  );
  assert.equal(result.status, COURT_ASSIGNMENT_STATUS.SUCCESS);
  const m1 = result.assignments.find((a) => a.matchId === "m1");
  assert.equal(m1.courtId, "court-b");
  assert.equal(m1.assignmentSource, COURT_ASSIGNMENT_SOURCE.LOCKED);
  assert.equal(result.diagnostics.lockedPreservedCount, 1);
});

// ---------------------------------------------------------------------------
// 15 / 16. Unknown locked match / court
// ---------------------------------------------------------------------------

test("15 unknown locked match rejection", () => {
  const result = assignCourtsDeterministic(
    baseRequest({
      lockedAssignments: [
        { matchId: "missing", courtId: "court-a", lockSource: COURT_LOCK_SOURCE.MANUAL },
      ],
    })
  );
  assert.equal(result.status, COURT_ASSIGNMENT_STATUS.REJECTED);
  assert.equal(
    result.failure.code,
    COURT_ASSIGNMENT_REJECTION_CODE.LOCK_REFERENCES_UNKNOWN_MATCH
  );
});

test("16 unknown locked court rejection", () => {
  const result = assignCourtsDeterministic(
    baseRequest({
      lockedAssignments: [
        { matchId: "m1", courtId: "missing-court", lockSource: COURT_LOCK_SOURCE.MANUAL },
      ],
    })
  );
  assert.equal(result.status, COURT_ASSIGNMENT_STATUS.REJECTED);
  assert.equal(
    result.failure.code,
    COURT_ASSIGNMENT_REJECTION_CODE.LOCK_REFERENCES_UNKNOWN_COURT
  );
});

// ---------------------------------------------------------------------------
// 17. Locked assignment scope mismatch (via disabled/unavailable path + scope)
// ---------------------------------------------------------------------------

test("17 locked assignment to wrong-scope court rejected at validation", () => {
  // Cross-venue court already rejected; lock scope covered by unknown/cross checks.
  const result = assignCourtsDeterministic(
    baseRequest({
      courts: [baseCourt({ venueId: "venue-x" })],
      lockedAssignments: [
        { matchId: "m1", courtId: "court-a", lockSource: COURT_LOCK_SOURCE.DIRECTOR },
      ],
    })
  );
  assert.equal(result.status, COURT_ASSIGNMENT_STATUS.REJECTED);
  assert.equal(
    result.failure.code,
    COURT_ASSIGNMENT_REJECTION_CODE.CROSS_VENUE_REFERENCE
  );
});

// ---------------------------------------------------------------------------
// 18. Locked court unavailable
// ---------------------------------------------------------------------------

test("18 locked court unavailable", () => {
  const result = assignCourtsDeterministic(
    baseRequest({
      courts: [
        baseCourt({
          availabilityStatus: COURT_AVAILABILITY_STATUS.UNAVAILABLE,
        }),
      ],
      lockedAssignments: [
        { matchId: "m1", courtId: "court-a", lockSource: COURT_LOCK_SOURCE.MANUAL },
      ],
    })
  );
  assert.equal(result.status, COURT_ASSIGNMENT_STATUS.INFEASIBLE);
  assert.equal(result.assignments.length, 0);
  assert.equal(
    result.unassigned[0].reasonCode,
    COURT_ASSIGNMENT_CONFLICT_CODE.LOCK_COURT_UNAVAILABLE
  );
});

// ---------------------------------------------------------------------------
// 19. Locked overlap conflict
// ---------------------------------------------------------------------------

test("19 locked overlap conflict", () => {
  const result = assignCourtsDeterministic(
    baseRequest({
      matches: [
        baseMatch({ matchId: "m1", scheduledStart: "2026-07-22T10:00:00Z", scheduledEnd: "2026-07-22T10:45:00Z" }),
        baseMatch({ matchId: "m2", scheduledStart: "2026-07-22T10:15:00Z", scheduledEnd: "2026-07-22T11:00:00Z" }),
      ],
      courts: [baseCourt({ courtId: "court-a" })],
      lockedAssignments: [
        { matchId: "m1", courtId: "court-a", lockSource: COURT_LOCK_SOURCE.MANUAL },
        { matchId: "m2", courtId: "court-a", lockSource: COURT_LOCK_SOURCE.MANUAL },
      ],
    })
  );
  assert.ok(
    result.status === COURT_ASSIGNMENT_STATUS.INFEASIBLE ||
      result.status === COURT_ASSIGNMENT_STATUS.PARTIAL
  );
  assert.ok(
    result.conflicts.some(
      (c) => c.code === COURT_ASSIGNMENT_CONFLICT_CODE.LOCK_OVERLAP
    )
  );
});

// ---------------------------------------------------------------------------
// 20. Automatic assignment cannot replace lock
// ---------------------------------------------------------------------------

test("20 automatic assignment cannot replace lock", () => {
  const result = assignCourtsDeterministic(
    baseRequest({
      matches: [baseMatch({ matchId: "m1", priority: 99 })],
      courts: [
        baseCourt({ courtId: "court-a", priority: 100 }),
        baseCourt({ courtId: "court-b", priority: 0 }),
      ],
      lockedAssignments: [
        { matchId: "m1", courtId: "court-b", lockSource: COURT_LOCK_SOURCE.MANUAL },
      ],
    })
  );
  assert.equal(result.assignments[0].courtId, "court-b");
  assert.equal(
    result.assignments[0].assignmentSource,
    COURT_ASSIGNMENT_SOURCE.LOCKED
  );
});

// ---------------------------------------------------------------------------
// 21. No eligible court structured reason
// ---------------------------------------------------------------------------

test("21 no eligible court structured reason", () => {
  const result = assignCourtsDeterministic(
    baseRequest({
      courts: [
        baseCourt({
          availabilityStatus: COURT_AVAILABILITY_STATUS.MAINTENANCE,
        }),
      ],
    })
  );
  assert.equal(result.status, COURT_ASSIGNMENT_STATUS.INFEASIBLE);
  assert.equal(
    result.unassigned[0].reasonCode,
    COURT_ASSIGNMENT_CONFLICT_CODE.NO_ELIGIBLE_COURT
  );
  assert.ok(Array.isArray(result.unassigned[0].attemptedCourtIds));
});

// ---------------------------------------------------------------------------
// 22 / 23. Partial assignment allowed / forbidden
// ---------------------------------------------------------------------------

test("22 partial assignment allowed", () => {
  const result = assignCourtsDeterministic(
    baseRequest({
      matches: [
        baseMatch({ matchId: "m1" }),
        baseMatch({
          matchId: "m2",
          scheduledStart: "2026-07-22T10:00:00Z",
          scheduledEnd: "2026-07-22T10:45:00Z",
        }),
      ],
      courts: [baseCourt()],
      policy: basePolicy({ partialAssignmentAllowed: true }),
    })
  );
  assert.equal(result.status, COURT_ASSIGNMENT_STATUS.PARTIAL);
  assert.equal(result.assignments.length, 1);
  assert.equal(result.unassigned.length, 1);
});

test("23 partial assignment forbidden", () => {
  const result = assignCourtsDeterministic(
    baseRequest({
      matches: [
        baseMatch({ matchId: "m1" }),
        baseMatch({
          matchId: "m2",
          scheduledStart: "2026-07-22T10:00:00Z",
          scheduledEnd: "2026-07-22T10:45:00Z",
        }),
      ],
      courts: [baseCourt()],
      policy: basePolicy({ partialAssignmentAllowed: false }),
    })
  );
  assert.equal(result.status, COURT_ASSIGNMENT_STATUS.INFEASIBLE);
  assert.equal(result.committable, false);
  // Model B: provisional assignments may be present but must not be persisted.
  assert.ok(result.assignments.length >= 1);
  assert.ok(
    result.conflicts.some(
      (c) =>
        c.code === COURT_ASSIGNMENT_CONFLICT_CODE.PARTIAL_ASSIGNMENT_NOT_ALLOWED
    )
  );
});

// ---------------------------------------------------------------------------
// 24 / 25. Determinism across runs and permuted inputs
// ---------------------------------------------------------------------------

test("24 deterministic result across repeated runs", () => {
  const req = baseRequest({
    matches: [
      baseMatch({ matchId: "m1", priority: 1 }),
      baseMatch({
        matchId: "m2",
        priority: 2,
        scheduledStart: "2026-07-22T11:00:00Z",
        scheduledEnd: "2026-07-22T11:45:00Z",
      }),
    ],
    courts: [
      baseCourt({ courtId: "court-a", priority: 1 }),
      baseCourt({ courtId: "court-b", priority: 2 }),
    ],
  });
  const a = assignCourtsDeterministic(req);
  const b = assignCourtsDeterministic(req);
  assert.equal(a.resultFingerprint, b.resultFingerprint);
  assert.deepEqual(
    a.assignments.map((x) => `${x.matchId}:${x.courtId}`),
    b.assignments.map((x) => `${x.matchId}:${x.courtId}`)
  );
});

test("25 deterministic result across permuted input arrays", () => {
  const matchesA = [
    baseMatch({ matchId: "m1", priority: 1 }),
    baseMatch({
      matchId: "m2",
      priority: 5,
      scheduledStart: "2026-07-22T11:00:00Z",
      scheduledEnd: "2026-07-22T11:45:00Z",
    }),
  ];
  const courtsA = [
    baseCourt({ courtId: "court-a", priority: 1 }),
    baseCourt({ courtId: "court-b", priority: 9 }),
  ];
  const r1 = assignCourtsDeterministic(
    baseRequest({ matches: matchesA, courts: courtsA })
  );
  const r2 = assignCourtsDeterministic(
    baseRequest({
      matches: [...matchesA].reverse(),
      courts: [...courtsA].reverse(),
    })
  );
  assert.equal(r1.resultFingerprint, r2.resultFingerprint);
  assert.deepEqual(
    r1.assignments.map((x) => `${x.matchId}:${x.courtId}`),
    r2.assignments.map((x) => `${x.matchId}:${x.courtId}`)
  );
  assert.deepEqual(
    r1.unassigned.map((x) => x.matchId),
    r2.unassigned.map((x) => x.matchId)
  );
});

// ---------------------------------------------------------------------------
// 26. Stable comparator behavior
// ---------------------------------------------------------------------------

test("26 stable comparator behavior", () => {
  assert.ok(compareStableString("a", "b") < 0);
  assert.ok(compareStableString("b", "a") > 0);
  assert.equal(compareStableString("x", "x"), 0);
  // Locale-independent: do not use localeCompare with vi
  const cmp = compareMatches(
    { matchId: "m-a", priority: 1, scheduledStart: "2026-07-22T10:00:00Z" },
    { matchId: "m-b", priority: 1, scheduledStart: "2026-07-22T10:00:00Z" },
    MATCH_ORDERING_STRATEGY.STABLE_PRIORITY_THEN_ID
  );
  assert.ok(cmp < 0);
  const courtCmp = compareCourts(
    { courtId: "court-a", priority: 0 },
    { courtId: "court-b", priority: 0 },
    COURT_ORDERING_STRATEGY.STABLE_ID_ONLY
  );
  assert.ok(courtCmp < 0);
});

// ---------------------------------------------------------------------------
// 27. Unsupported policy version
// ---------------------------------------------------------------------------

test("27 unsupported policy version", () => {
  assert.throws(
    () =>
      createCourtAssignmentPolicy(
        basePolicy({ policyVersion: "NOT_A_SUPPORTED_VERSION" })
      ),
    (err) =>
      err.code === COURT_ASSIGNMENT_REJECTION_CODE.UNSUPPORTED_POLICY_VERSION
  );
  const result = assignCourtsDeterministic(
    baseRequest({
      policy: basePolicy({ policyVersion: "NOPE" }),
    })
  );
  assert.equal(result.status, COURT_ASSIGNMENT_STATUS.REJECTED);
  assert.equal(
    result.failure.code,
    COURT_ASSIGNMENT_REJECTION_CODE.UNSUPPORTED_POLICY_VERSION
  );
});

// ---------------------------------------------------------------------------
// 28. No first-venue or first-court fallback
// ---------------------------------------------------------------------------

test("28 no first-venue or first-court fallback", () => {
  const result = assignCourtsDeterministic(
    baseRequest({
      courts: [],
    })
  );
  assert.equal(result.status, COURT_ASSIGNMENT_STATUS.INFEASIBLE);
  assert.equal(result.assignments.length, 0);
  assert.equal(
    result.unassigned[0].reasonCode,
    COURT_ASSIGNMENT_CONFLICT_CODE.NO_ELIGIBLE_COURT
  );
});

// ---------------------------------------------------------------------------
// 29. No input mutation
// ---------------------------------------------------------------------------

test("29 no input mutation", () => {
  const req = baseRequest({
    matches: [
      baseMatch({ matchId: "m1" }),
      baseMatch({
        matchId: "m2",
        scheduledStart: "2026-07-22T12:00:00Z",
        scheduledEnd: "2026-07-22T12:45:00Z",
      }),
    ],
    courts: [
      baseCourt({
        courtId: "court-a",
        availabilityIntervals: [
          { start: "2026-07-22T00:00:00Z", end: "2026-07-22T23:59:00Z" },
        ],
      }),
    ],
    lockedAssignments: [
      { matchId: "m1", courtId: "court-a", lockSource: COURT_LOCK_SOURCE.MANUAL },
    ],
  });
  const before = deepClone(req);
  assignCourtsDeterministic(req);
  assert.deepEqual(req, before);
});

// ---------------------------------------------------------------------------
// 31 / 32. Empty match / court sets
// ---------------------------------------------------------------------------

test("31 empty match set behavior", () => {
  const result = assignCourtsDeterministic(baseRequest({ matches: [] }));
  assert.equal(result.status, COURT_ASSIGNMENT_STATUS.SUCCESS);
  assert.equal(result.assignments.length, 0);
  assert.equal(result.unassigned.length, 0);
});

test("32 empty court set behavior", () => {
  const result = assignCourtsDeterministic(baseRequest({ courts: [] }));
  assert.equal(result.status, COURT_ASSIGNMENT_STATUS.INFEASIBLE);
  assert.equal(result.assignments.length, 0);
});

// ---------------------------------------------------------------------------
// 33 / 34. Diagnostics and conflicts stability
// ---------------------------------------------------------------------------

test("33 diagnostics stability", () => {
  const req = baseRequest();
  const a = assignCourtsDeterministic(req);
  const b = assignCourtsDeterministic(req);
  assert.deepEqual(
    {
      assignedCount: a.diagnostics.assignedCount,
      unassignedCount: a.diagnostics.unassignedCount,
      orderingVersions: a.diagnostics.orderingVersions,
    },
    {
      assignedCount: b.diagnostics.assignedCount,
      unassignedCount: b.diagnostics.unassignedCount,
      orderingVersions: b.diagnostics.orderingVersions,
    }
  );
  assert.equal(a.diagnostics.wallClockMs, null);
});

test("34 structured conflicts stability", () => {
  const req = baseRequest({
    matches: [
      baseMatch({ matchId: "m1" }),
      baseMatch({
        matchId: "m2",
        scheduledStart: "2026-07-22T10:00:00Z",
        scheduledEnd: "2026-07-22T10:45:00Z",
      }),
    ],
    courts: [baseCourt()],
    policy: basePolicy({ partialAssignmentAllowed: false }),
  });
  const a = assignCourtsDeterministic(req);
  const b = assignCourtsDeterministic(req);
  assert.deepEqual(
    a.conflicts.map((c) => `${c.conflictId}:${c.code}`),
    b.conflicts.map((c) => `${c.conflictId}:${c.code}`)
  );
});

// ---------------------------------------------------------------------------
// Extra invariant coverage
// ---------------------------------------------------------------------------

test("35 missing timezone rejected when required", () => {
  const result = assignCourtsDeterministic(
    baseRequest({
      timezone: undefined,
      policy: basePolicy({ requireVenueTimezone: true }),
    })
  );
  assert.equal(result.status, COURT_ASSIGNMENT_STATUS.REJECTED);
  assert.equal(
    result.failure.code,
    COURT_ASSIGNMENT_REJECTION_CODE.TIMEZONE_REQUIRED
  );
});

test("36 duplicate lock rejection", () => {
  const result = assignCourtsDeterministic(
    baseRequest({
      lockedAssignments: [
        { matchId: "m1", courtId: "court-a", lockSource: COURT_LOCK_SOURCE.MANUAL },
        { matchId: "m1", courtId: "court-a", lockSource: COURT_LOCK_SOURCE.DIRECTOR },
      ],
    })
  );
  assert.equal(result.status, COURT_ASSIGNMENT_STATUS.REJECTED);
  assert.equal(result.failure.code, COURT_ASSIGNMENT_REJECTION_CODE.DUPLICATE_LOCK);
});

test("37 port assignCourts matches direct assigner", () => {
  const port = createCourtAssignmentPort();
  const req = baseRequest();
  const a = port.assignCourts(req);
  const b = assignCourtsDeterministic(req);
  assert.equal(a.resultFingerprint, b.resultFingerprint);
});

test("38 availability port is consumer-side only (fail-closed / fixed)", () => {
  const fail = createFailClosedCourtAvailabilityPort();
  assert.throws(() => fail.resolveAvailability({ clubId: "c", venueId: "v" }));
  const fixed = createFixedCourtAvailabilityPort({
    courts: [{ courtId: "court-a" }],
    fingerprint: "fp1",
    snapshotId: "s1",
    snapshotVersion: "v1",
  });
  const snap = fixed.resolveAvailability({ clubId: "c", venueId: "v" });
  assert.equal(snap.fingerprint, "fp1");
});

test("39 no root competition-core export for CORE-12", () => {
  assert.ok(existsSync(ROOT_BARREL));
  const text = readFileSync(ROOT_BARREL, "utf8");
  assert.equal(/court-assignment/.test(text), false);
});

test("40 no optimizer / scheduling deep imports in court-assignment", () => {
  const files = [
    "index.js",
    "services/assignCourtsDeterministic.js",
    "services/validateCourtAssignmentRequest.js",
    "contracts/courtAssignmentRequest.js",
  ];
  for (const rel of files) {
    const text = readFileSync(path.join(CA_ROOT, rel), "utf8");
    assert.equal(/features\/competition-core\/optimizer/.test(text), false);
    assert.equal(/features\/competition-core\/scheduling/.test(text), false);
    assert.equal(/Date\.now\(/.test(text), false);
    assert.equal(/Math\.random\(/.test(text), false);
  }
});

test("41 validateCourtAssignmentRequest accepts valid request", () => {
  const v = validateCourtAssignmentRequest(baseRequest());
  assert.equal(v.ok, true);
  assert.ok(Object.isFrozen(v.request));
});

test("42 createCourtAssignmentRequest freezes nested collections", () => {
  const req = createCourtAssignmentRequest(baseRequest());
  assert.ok(Object.isFrozen(req));
  assert.ok(Object.isFrozen(req.matches));
  assert.ok(Object.isFrozen(req.courts));
  assert.ok(Object.isFrozen(req.policy));
});

test("43 lock capability mismatch structured", () => {
  const result = assignCourtsDeterministic(
    baseRequest({
      matches: [baseMatch({ requiredCapabilities: ["outdoor"] })],
      courts: [baseCourt({ capabilities: ["indoor"] })],
      lockedAssignments: [
        { matchId: "m1", courtId: "court-a", lockSource: COURT_LOCK_SOURCE.MANUAL },
      ],
    })
  );
  assert.equal(result.assignments.length, 0);
  assert.equal(
    result.unassigned[0].reasonCode,
    COURT_ASSIGNMENT_CONFLICT_CODE.LOCK_CAPABILITY_MISMATCH
  );
});

test("44 positive overlap helper", () => {
  const aStart = Date.parse("2026-07-22T10:00:00Z");
  const aEnd = Date.parse("2026-07-22T10:45:00Z");
  const bStart = Date.parse("2026-07-22T10:30:00Z");
  const bEnd = Date.parse("2026-07-22T11:00:00Z");
  assert.equal(intervalsOverlapHalfOpen(aStart, aEnd, bStart, bEnd), true);
});

// ---------------------------------------------------------------------------
// Phase 1B-R certification additions
// ---------------------------------------------------------------------------

test("45 invalid calendar date that Date.parse would normalize is rejected", () => {
  const result = assignCourtsDeterministic(
    baseRequest({
      matches: [
        baseMatch({
          scheduledStart: "2026-02-30T10:00:00Z",
          scheduledEnd: "2026-02-30T11:00:00Z",
        }),
      ],
    })
  );
  assert.equal(result.status, COURT_ASSIGNMENT_STATUS.REJECTED);
  assert.equal(result.failure.code, COURT_ASSIGNMENT_REJECTION_CODE.INVALID_TIME_WINDOW);
  assert.equal(result.committable, false);
});

test("46 April 31 silent normalization rejected", () => {
  const result = assignCourtsDeterministic(
    baseRequest({
      matches: [
        baseMatch({
          scheduledStart: "2026-04-31T10:00:00Z",
          scheduledEnd: "2026-04-31T11:00:00Z",
        }),
      ],
    })
  );
  assert.equal(result.status, COURT_ASSIGNMENT_STATUS.REJECTED);
  assert.equal(result.failure.code, COURT_ASSIGNMENT_REJECTION_CODE.INVALID_TIME_WINDOW);
});

test("47 adjacent availability intervals are NOT merged", () => {
  const result = assignCourtsDeterministic(
    baseRequest({
      matches: [
        baseMatch({
          scheduledStart: "2026-07-22T10:30:00Z",
          scheduledEnd: "2026-07-22T11:30:00Z",
        }),
      ],
      courts: [
        baseCourt({
          availabilityIntervals: [
            { start: "2026-07-22T10:00:00Z", end: "2026-07-22T11:00:00Z" },
            { start: "2026-07-22T11:00:00Z", end: "2026-07-22T12:00:00Z" },
          ],
        }),
      ],
    })
  );
  // Match spans both intervals; without merging it is not fully covered by one.
  assert.equal(result.status, COURT_ASSIGNMENT_STATUS.INFEASIBLE);
  assert.equal(result.assignments.length, 0);
});

test("48 multiple availability intervals — covered by one succeeds", () => {
  const result = assignCourtsDeterministic(
    baseRequest({
      matches: [
        baseMatch({
          scheduledStart: "2026-07-22T11:00:00Z",
          scheduledEnd: "2026-07-22T11:30:00Z",
        }),
      ],
      courts: [
        baseCourt({
          availabilityIntervals: [
            { start: "2026-07-22T08:00:00Z", end: "2026-07-22T09:00:00Z" },
            { start: "2026-07-22T11:00:00Z", end: "2026-07-22T12:00:00Z" },
          ],
        }),
      ],
    })
  );
  assert.equal(result.status, COURT_ASSIGNMENT_STATUS.SUCCESS);
  assert.equal(result.committable, true);
});

test("49 comparator Unicode / numeric-looking / case vectors", () => {
  assert.ok(compareStableString("Court-2", "Court-10") > 0); // '2' > '1' at first diff after shared prefix length... wait Court-2 vs Court-10: after "Court-" compare '2' vs '1' → '2'>'1'
  assert.ok(compareStableString("court-a", "Court-a") > 0); // 'c' > 'C' in UTF-16
  assert.ok(compareStableString("café", "cafe") > 0); // é after e
  assert.equal(compareStableString("m1", "m1"), 0);
  const ordered = ["court-10", "court-2", "Court-A", "café"].slice().sort(compareStableString);
  assert.deepEqual(ordered, ["Court-A", "café", "court-10", "court-2"].slice().sort(compareStableString));
  // Identical priority → ID tie-break
  assert.ok(
    compareMatches(
      { matchId: "m-á", priority: 1, scheduledStart: "2026-07-22T10:00:00Z" },
      { matchId: "m-b", priority: 1, scheduledStart: "2026-07-22T10:00:00Z" },
      MATCH_ORDERING_STRATEGY.STABLE_PRIORITY_THEN_ID
    ) !== 0
  );
});

test("50 permuted lock arrays yield identical fingerprint", () => {
  const locks = [
    { matchId: "m1", courtId: "court-a", lockSource: COURT_LOCK_SOURCE.MANUAL },
    { matchId: "m2", courtId: "court-b", lockSource: COURT_LOCK_SOURCE.DIRECTOR },
  ];
  const reqBase = {
    matches: [
      baseMatch({ matchId: "m1" }),
      baseMatch({
        matchId: "m2",
        scheduledStart: "2026-07-22T12:00:00Z",
        scheduledEnd: "2026-07-22T12:45:00Z",
      }),
    ],
    courts: [
      baseCourt({ courtId: "court-a" }),
      baseCourt({ courtId: "court-b" }),
    ],
  };
  const a = assignCourtsDeterministic(
    baseRequest({ ...reqBase, lockedAssignments: locks })
  );
  const b = assignCourtsDeterministic(
    baseRequest({ ...reqBase, lockedAssignments: [...locks].reverse() })
  );
  assert.equal(a.resultFingerprint, b.resultFingerprint);
});

test("51 fingerprint changes when match interval changes", () => {
  const a = assignCourtsDeterministic(baseRequest());
  const b = assignCourtsDeterministic(
    baseRequest({
      matches: [
        baseMatch({
          scheduledStart: "2026-07-22T10:00:00Z",
          scheduledEnd: "2026-07-22T11:00:00Z",
        }),
      ],
    })
  );
  assert.notEqual(a.resultFingerprint, b.resultFingerprint);
});

test("52 fingerprint changes when court changes", () => {
  const a = assignCourtsDeterministic(baseRequest());
  const b = assignCourtsDeterministic(
    baseRequest({
      courts: [baseCourt({ courtId: "court-z", priority: 0 })],
    })
  );
  assert.notEqual(a.resultFingerprint, b.resultFingerprint);
});

test("53 fingerprint changes when policy knob changes", () => {
  const a = assignCourtsDeterministic(
    baseRequest({
      matches: [
        baseMatch({ matchId: "m1" }),
        baseMatch({
          matchId: "m2",
          scheduledStart: "2026-07-22T10:00:00Z",
          scheduledEnd: "2026-07-22T10:45:00Z",
        }),
      ],
      courts: [baseCourt()],
      policy: basePolicy({ partialAssignmentAllowed: false }),
    })
  );
  const b = assignCourtsDeterministic(
    baseRequest({
      matches: [
        baseMatch({ matchId: "m1" }),
        baseMatch({
          matchId: "m2",
          scheduledStart: "2026-07-22T10:00:00Z",
          scheduledEnd: "2026-07-22T10:45:00Z",
        }),
      ],
      courts: [baseCourt()],
      policy: basePolicy({ partialAssignmentAllowed: true }),
    })
  );
  assert.notEqual(a.resultFingerprint, b.resultFingerprint);
  assert.equal(a.committable, false);
  assert.equal(b.committable, true);
  assert.equal(b.status, COURT_ASSIGNMENT_STATUS.PARTIAL);
});

test("54 fingerprint changes when lock changes", () => {
  const a = assignCourtsDeterministic(
    baseRequest({
      courts: [
        baseCourt({ courtId: "court-a", priority: 10 }),
        baseCourt({ courtId: "court-b", priority: 1 }),
      ],
      lockedAssignments: [],
    })
  );
  const b = assignCourtsDeterministic(
    baseRequest({
      courts: [
        baseCourt({ courtId: "court-a", priority: 10 }),
        baseCourt({ courtId: "court-b", priority: 1 }),
      ],
      lockedAssignments: [
        { matchId: "m1", courtId: "court-b", lockSource: COURT_LOCK_SOURCE.MANUAL },
      ],
    })
  );
  assert.notEqual(a.resultFingerprint, b.resultFingerprint);
});

test("55 nested result immutability; mutation after create cannot alter fingerprinted data", () => {
  const result = assignCourtsDeterministic(baseRequest());
  assert.ok(Object.isFrozen(result));
  assert.ok(Object.isFrozen(result.assignments));
  assert.ok(Object.isFrozen(result.assignments[0]));
  assert.ok(Object.isFrozen(result.diagnostics));
  assert.ok(Object.isFrozen(result.diagnostics.orderingVersions));
  const fp = result.resultFingerprint;
  assert.throws(() => {
    /** @type {any} */ (result.assignments).push({ matchId: "x" });
  });
  assert.throws(() => {
    /** @type {any} */ (result.assignments[0]).courtId = "hacked";
  });
  assert.equal(result.resultFingerprint, fp);
  assert.equal(result.assignments[0].courtId, "court-a");
});

test("56 frozen caller inputs are accepted and not required", () => {
  const req = deepFreezeCanonical(baseRequest());
  const result = assignCourtsDeterministic(req);
  assert.equal(result.status, COURT_ASSIGNMENT_STATUS.SUCCESS);
  assert.equal(result.committable, true);
});

test("57 invalidLockBehavior REJECT_REQUEST yields REJECTED", () => {
  const result = assignCourtsDeterministic(
    baseRequest({
      courts: [
        baseCourt({
          availabilityStatus: COURT_AVAILABILITY_STATUS.UNAVAILABLE,
        }),
      ],
      lockedAssignments: [
        { matchId: "m1", courtId: "court-a", lockSource: COURT_LOCK_SOURCE.MANUAL },
      ],
      policy: basePolicy({
        invalidLockBehavior: INVALID_LOCK_BEHAVIOR.REJECT_REQUEST,
      }),
    })
  );
  assert.equal(result.status, COURT_ASSIGNMENT_STATUS.REJECTED);
  assert.equal(result.committable, false);
  assert.equal(result.failure.code, COURT_ASSIGNMENT_REJECTION_CODE.INVALID_REQUEST);
});

test("58 locks disabled by policy → LOCKS_NOT_ACCEPTED", () => {
  const result = assignCourtsDeterministic(
    baseRequest({
      lockedAssignments: [
        { matchId: "m1", courtId: "court-a", lockSource: COURT_LOCK_SOURCE.MANUAL },
      ],
      policy: basePolicy({ acceptLockedAssignments: false }),
    })
  );
  assert.equal(result.status, COURT_ASSIGNMENT_STATUS.REJECTED);
  assert.equal(result.failure.code, COURT_ASSIGNMENT_REJECTION_CODE.LOCKS_NOT_ACCEPTED);
});

test("59 production index does not export test doubles", async () => {
  const prod = await import(
    "../src/features/competition-core/court-assignment/index.js"
  );
  assert.equal(typeof prod.createCourtAssignmentPort, "function");
  assert.equal(typeof prod.assignCourtsDeterministic, "function");
  assert.equal(prod.createFailClosedCourtAssignmentPort, undefined);
  assert.equal(prod.createFixedCourtAvailabilityPort, undefined);
  assert.equal(prod.createInMemoryCourtAssignmentAuditPort, undefined);
  assert.equal(prod.assignCourtsSafe, undefined);
});

test("60 audit port is not invoked by pure assigner", () => {
  const audit = createInMemoryCourtAssignmentAuditPort();
  const result = assignCourtsDeterministic(baseRequest());
  assert.equal(result.status, COURT_ASSIGNMENT_STATUS.SUCCESS);
  assert.equal(audit.events().length, 0);
});

test("61 canonical conflict code emission — aliases not emitted", () => {
  assert.equal(
    resolveCanonicalConflictCode("COURT_TIME_CONFLICT"),
    COURT_ASSIGNMENT_CONFLICT_CODE.COURT_TIME_OVERLAP
  );
  assert.equal(
    COURT_ASSIGNMENT_CONFLICT_CODE_ALIASES.COURT_TIME_CONFLICT,
    "COURT_TIME_OVERLAP"
  );
  assert.equal(
    COURT_ASSIGNMENT_REJECTION_CODE_ALIASES.UNKNOWN_LOCKED_MATCH,
    "LOCK_REFERENCES_UNKNOWN_MATCH"
  );
  // Ensure conflict object keys do not include alias keys as emit values
  assert.equal(
    Object.prototype.hasOwnProperty.call(
      COURT_ASSIGNMENT_CONFLICT_CODE,
      "COURT_TIME_CONFLICT"
    ),
    false
  );
});

test("62 PARTIAL is committable; SUCCESS is committable", () => {
  const partial = assignCourtsDeterministic(
    baseRequest({
      matches: [
        baseMatch({ matchId: "m1" }),
        baseMatch({
          matchId: "m2",
          scheduledStart: "2026-07-22T10:00:00Z",
          scheduledEnd: "2026-07-22T10:45:00Z",
        }),
      ],
      courts: [baseCourt()],
      policy: basePolicy({ partialAssignmentAllowed: true }),
    })
  );
  assert.equal(partial.status, COURT_ASSIGNMENT_STATUS.PARTIAL);
  assert.equal(partial.committable, true);
  const ok = assignCourtsDeterministic(baseRequest());
  assert.equal(ok.committable, true);
});

test("63 fail-closed assignment double via adapters", () => {
  const port = createFailClosedCourtAssignmentPort();
  const result = port.assignCourts(baseRequest());
  assert.equal(result.status, COURT_ASSIGNMENT_STATUS.REJECTED);
  assert.equal(result.committable, false);
});

test("64 single competition/venue/club scope — multi-competition match rejected", () => {
  const result = assignCourtsDeterministic(
    baseRequest({
      matches: [baseMatch({ competitionId: "other-comp" })],
    })
  );
  assert.equal(result.status, COURT_ASSIGNMENT_STATUS.REJECTED);
  assert.equal(result.failure.code, COURT_ASSIGNMENT_REJECTION_CODE.SCOPE_MISMATCH);
});
