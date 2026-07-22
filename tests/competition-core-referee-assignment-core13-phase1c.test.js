/**
 * CORE-13 Phase 1C — eligibility, conflicts, workload, manual validation, diagnostics.
 */

import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync, readdirSync, statSync, existsSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import * as Core13 from "../src/features/competition-core/referee-assignment/index.js";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const MOD_ROOT = path.join(
  ROOT,
  "src/features/competition-core/referee-assignment"
);
const ROOT_BARREL = path.join(ROOT, "src/features/competition-core/index.js");

const {
  CORE13_SCHEMA_VERSION,
  REFEREE_ROLE_CODE,
  REFEREE_ASSIGNMENT_STATUS,
  REFEREE_ASSIGNMENT_SOURCE,
  REFEREE_CONFLICT_TYPE,
  REFEREE_ASSIGNMENT_DIAGNOSTIC_CODE,
  REFEREE_SNAPSHOT_STATUS,
  REFEREE_RESOURCE_TYPE,
  createRefereeCandidate,
  createRefereeQualification,
  createRefereeAvailabilityWindow,
  createRefereeAssignmentPolicy,
  createRefereeAssignment,
  createManualRefereeAssignmentRequest,
  createPopulatedSnapshotResult,
  createEmptySnapshotResult,
  createMissingSnapshotResult,
  createMatchScheduleRow,
  evaluateRefereeEligibility,
  detectRefereeConflicts,
  calculateRefereeWorkload,
  validateManualRefereeAssignment,
  explainUnassignedMatch,
  intervalsOverlapHalfOpen,
  prepareFingerprintMaterial,
} = Core13;

function listJsFiles(dir) {
  const out = [];
  if (!existsSync(dir)) return out;
  for (const name of readdirSync(dir)) {
    const full = path.join(dir, name);
    const st = statSync(full);
    if (st.isDirectory()) out.push(...listJsFiles(full));
    else if (name.endsWith(".js")) out.push(full);
  }
  return out;
}

const MATCH = Object.freeze({
  matchId: "m-1",
  startAt: "2026-07-22T10:00:00.000Z",
  endAt: "2026-07-22T11:00:00.000Z",
  courtId: "court-1",
  participantRefs: ["player-a", "player-b"],
  teamRefs: ["team-a", "team-b"],
  clubIds: ["club-a", "club-b"],
  organizationIds: ["org-a"],
});

function baseCandidate(overrides = {}) {
  return createRefereeCandidate({
    refereeId: "ref-1",
    active: true,
    playerId: "player-ref",
    clubIds: ["club-x"],
    organizationIds: ["org-x"],
    preferenceTags: ["lang:en"],
    ...overrides,
  });
}

function baseQual(overrides = {}) {
  return createRefereeQualification({
    qualificationId: "qual-1",
    refereeId: "ref-1",
    roleCode: REFEREE_ROLE_CODE.PRIMARY,
    certificationCode: "CERT-A",
    validFrom: "2026-01-01T00:00:00.000Z",
    validTo: "2027-01-01T00:00:00.000Z",
    ...overrides,
  });
}

function baseAvail(overrides = {}) {
  return createRefereeAvailabilityWindow({
    windowId: "win-1",
    refereeId: "ref-1",
    startAt: "2026-07-22T08:00:00.000Z",
    endAt: "2026-07-22T18:00:00.000Z",
    ...overrides,
  });
}

function basePolicy(overrides = {}) {
  return createRefereeAssignmentPolicy({
    policyId: "pol-1",
    policyVersion: "1",
    maxSimultaneousAssignments: 1,
    allowSelfRefereed: false,
    allowSoftOverride: false,
    ...overrides,
  });
}

function eligInput(overrides = {}) {
  return {
    tenantId: "tenant-1",
    tournamentId: "tourn-1",
    candidate: baseCandidate(),
    match: { ...MATCH },
    roleCode: REFEREE_ROLE_CODE.PRIMARY,
    qualifications: [baseQual()],
    availabilityWindows: [baseAvail()],
    existingAssignments: [],
    scheduleRows: [MATCH],
    conflictPolicy: {
      prohibitSamePlayerId: true,
      prohibitSameClubId: true,
      prohibitSameOrganizationId: true,
      prohibitSelfReferee: true,
      excludedRefereeIds: [],
      prohibitedTeamIds: [],
      matchExclusions: [],
    },
    policy: basePolicy(),
    ...overrides,
  };
}

// ---------------------------------------------------------------------------
// Time model
// ---------------------------------------------------------------------------

test("T01: half-open — exact back-to-back does not overlap; one-minute does", () => {
  const a0 = Date.parse("2026-07-22T10:00:00.000Z");
  const a1 = Date.parse("2026-07-22T11:00:00.000Z");
  const b0 = Date.parse("2026-07-22T11:00:00.000Z");
  const b1 = Date.parse("2026-07-22T12:00:00.000Z");
  assert.equal(intervalsOverlapHalfOpen(a0, a1, b0, b1), false);

  const c0 = Date.parse("2026-07-22T10:59:00.000Z");
  assert.equal(intervalsOverlapHalfOpen(a0, a1, c0, b1), true);
});

// ---------------------------------------------------------------------------
// Eligibility
// ---------------------------------------------------------------------------

test("E01: eligible active qualified available referee", () => {
  const result = evaluateRefereeEligibility(eligInput());
  assert.equal(result.eligible, true);
  assert.equal(result.hardFailures.length, 0);
  assert.ok(Object.isFrozen(result));
});

test("E02: inactive referee rejection", () => {
  const result = evaluateRefereeEligibility(
    eligInput({ candidate: baseCandidate({ active: false }) })
  );
  assert.equal(result.eligible, false);
  assert.ok(
    result.hardFailures.some(
      (f) => f.code === REFEREE_ASSIGNMENT_DIAGNOSTIC_CODE.REFEREE_INACTIVE
    )
  );
});

test("E03: missing qualification", () => {
  const result = evaluateRefereeEligibility(
    eligInput({ qualifications: [] })
  );
  assert.ok(
    result.hardFailures.some(
      (f) => f.code === REFEREE_ASSIGNMENT_DIAGNOSTIC_CODE.REFEREE_NOT_QUALIFIED
    )
  );
});

test("E04: expired qualification for match time", () => {
  const result = evaluateRefereeEligibility(
    eligInput({
      qualifications: [
        baseQual({
          validFrom: "2025-01-01T00:00:00.000Z",
          validTo: "2026-07-01T00:00:00.000Z",
        }),
      ],
    })
  );
  assert.ok(
    result.hardFailures.some(
      (f) => f.code === REFEREE_ASSIGNMENT_DIAGNOSTIC_CODE.REFEREE_NOT_QUALIFIED
    )
  );
});

test("E05: availability does not fully cover match", () => {
  const result = evaluateRefereeEligibility(
    eligInput({
      availabilityWindows: [
        baseAvail({
          startAt: "2026-07-22T10:00:00.000Z",
          endAt: "2026-07-22T10:30:00.000Z",
        }),
      ],
    })
  );
  assert.ok(
    result.hardFailures.some(
      (f) => f.code === REFEREE_ASSIGNMENT_DIAGNOSTIC_CODE.REFEREE_UNAVAILABLE
    )
  );
});

test("E06: RefereeRoleCode.ANY rejected as concrete role", () => {
  const result = evaluateRefereeEligibility(
    eligInput({ roleCode: REFEREE_ROLE_CODE.ANY })
  );
  assert.ok(
    result.hardFailures.some(
      (f) =>
        f.code === REFEREE_ASSIGNMENT_DIAGNOSTIC_CODE.REFEREE_ROLE_UNSUPPORTED
    )
  );
});

test("E07: self-refereeing denied by default", () => {
  const result = evaluateRefereeEligibility(
    eligInput({
      candidate: baseCandidate({ playerId: "player-a" }),
    })
  );
  assert.ok(
    result.hardFailures.some(
      (f) =>
        f.code ===
        REFEREE_ASSIGNMENT_DIAGNOSTIC_CODE.REFEREE_CONFLICT_OF_INTEREST
    )
  );
});

// ---------------------------------------------------------------------------
// Conflicts
// ---------------------------------------------------------------------------

test("C01: exact back-to-back assignments do not overlap", () => {
  const other = {
    matchId: "m-2",
    startAt: "2026-07-22T11:00:00.000Z",
    endAt: "2026-07-22T12:00:00.000Z",
  };
  const detected = detectRefereeConflicts({
    refereeId: "ref-1",
    match: MATCH,
    roleCode: REFEREE_ROLE_CODE.PRIMARY,
    existingAssignments: [
      createRefereeAssignment({
        assignmentId: "a-2",
        matchId: "m-2",
        refereeId: "ref-1",
        roleCode: REFEREE_ROLE_CODE.PRIMARY,
        status: REFEREE_ASSIGNMENT_STATUS.CONFIRMED,
      }),
    ],
    scheduleRows: [MATCH, other],
    conflictPolicy: {},
    policy: basePolicy(),
  });
  assert.equal(
    detected.conflicts.filter((c) => c.conflictType === REFEREE_CONFLICT_TYPE.OVERLAP)
      .length,
    0
  );
});

test("C02: one-minute overlap is detected", () => {
  const other = {
    matchId: "m-2",
    startAt: "2026-07-22T10:59:00.000Z",
    endAt: "2026-07-22T12:00:00.000Z",
  };
  const detected = detectRefereeConflicts({
    refereeId: "ref-1",
    match: MATCH,
    existingAssignments: [
      {
        assignmentId: "a-2",
        matchId: "m-2",
        refereeId: "ref-1",
        roleCode: REFEREE_ROLE_CODE.PRIMARY,
        status: REFEREE_ASSIGNMENT_STATUS.PLANNED,
      },
    ],
    scheduleRows: [MATCH, other],
    conflictPolicy: {},
  });
  assert.ok(
    detected.conflicts.some((c) => c.conflictType === REFEREE_CONFLICT_TYPE.OVERLAP)
  );
  assert.ok(
    detected.projections.every((p) => p.resourceType === REFEREE_RESOURCE_TYPE.REFEREE)
  );
});

test("C03: referee is also a participant", () => {
  const detected = detectRefereeConflicts({
    refereeId: "ref-1",
    candidate: baseCandidate({ playerId: "player-a" }),
    match: MATCH,
    conflictPolicy: { prohibitSamePlayerId: true },
  });
  assert.ok(
    detected.conflicts.some(
      (c) => c.conflictType === REFEREE_CONFLICT_TYPE.CONFLICT_OF_INTEREST
    )
  );
});

test("C04: prohibited team conflict", () => {
  const detected = detectRefereeConflicts({
    refereeId: "ref-1",
    candidate: baseCandidate(),
    match: MATCH,
    candidateTeamIds: ["team-evil"],
    conflictPolicy: { prohibitedTeamIds: ["team-evil"] },
  });
  assert.ok(
    detected.conflicts.some(
      (c) => c.metadata?.kind === "prohibited_team" || c.relatedIds?.includes("team-evil")
    )
  );
});

test("C05: prohibited club conflict", () => {
  const detected = detectRefereeConflicts({
    refereeId: "ref-1",
    candidate: baseCandidate({ clubIds: ["club-a"] }),
    match: MATCH,
    conflictPolicy: { disallowAffiliatedClubReferee: true },
  });
  assert.ok(
    detected.conflicts.some(
      (c) => c.conflictType === REFEREE_CONFLICT_TYPE.CONFLICT_OF_INTEREST
    )
  );
});

test("C05b: club affiliation is soft by default", () => {
  const detected = detectRefereeConflicts({
    refereeId: "ref-1",
    candidate: baseCandidate({ clubIds: ["club-a"] }),
    match: MATCH,
    conflictPolicy: {},
  });
  assert.equal(
    detected.conflicts.filter(
      (c) => c.metadata?.kind === "affiliated_club"
    ).length,
    0
  );
  assert.ok(detected.softNotes.some((n) => n.code === "AFFILIATED_CLUB"));
});

test("C06: explicit referee exclusion", () => {
  const detected = detectRefereeConflicts({
    refereeId: "ref-1",
    match: MATCH,
    conflictPolicy: { excludedRefereeIds: ["ref-1"] },
  });
  assert.ok(
    detected.conflicts.some((c) => c.conflictType === REFEREE_CONFLICT_TYPE.EXCLUSION)
  );
});

test("C07: explicit referee-match exclusion", () => {
  const detected = detectRefereeConflicts({
    refereeId: "ref-1",
    match: MATCH,
    conflictPolicy: {
      matchExclusions: [{ refereeId: "ref-1", matchId: "m-1" }],
    },
  });
  assert.ok(
    detected.conflicts.some((c) => c.conflictType === REFEREE_CONFLICT_TYPE.EXCLUSION)
  );
});

test("C08: duplicate role assignment on one match", () => {
  const detected = detectRefereeConflicts({
    refereeId: "ref-2",
    match: MATCH,
    roleCode: REFEREE_ROLE_CODE.PRIMARY,
    existingAssignments: [
      createRefereeAssignment({
        assignmentId: "a-1",
        matchId: "m-1",
        refereeId: "ref-9",
        roleCode: REFEREE_ROLE_CODE.PRIMARY,
        status: REFEREE_ASSIGNMENT_STATUS.CONFIRMED,
      }),
    ],
    conflictPolicy: {},
  });
  assert.ok(
    detected.conflicts.some((c) => c.conflictType === REFEREE_CONFLICT_TYPE.CAPACITY)
  );
});

// ---------------------------------------------------------------------------
// Manual validation
// ---------------------------------------------------------------------------

function manualSnaps(extra = {}) {
  const candidate = baseCandidate();
  return {
    request: createManualRefereeAssignmentRequest({
      requestId: "man-1",
      tenantId: "tenant-1",
      tournamentId: "tourn-1",
      matchId: "m-1",
      refereeId: "ref-1",
      roleCode: REFEREE_ROLE_CODE.PRIMARY,
      allowSoftOverride: false,
      ...extra.request,
    }),
    directorySnapshot: createPopulatedSnapshotResult([candidate]),
    scheduleSnapshot: createPopulatedSnapshotResult([
      createMatchScheduleRow(MATCH),
    ]),
    existingAssignmentSnapshot: createEmptySnapshotResult(),
    qualificationSnapshot: createPopulatedSnapshotResult([baseQual()]),
    availabilitySnapshot: createPopulatedSnapshotResult([baseAvail()]),
    conflictPolicy: {
      prohibitSamePlayerId: true,
      prohibitSelfReferee: true,
    },
    policy: basePolicy(),
    ...extra,
  };
}

test("M01: manual validation accepted", () => {
  const result = validateManualRefereeAssignment(manualSnaps());
  assert.equal(result.ok, true);
  assert.equal(result.accepted, true);
  assert.equal(result.assignment.source, REFEREE_ASSIGNMENT_SOURCE.MANUAL);
  assert.notEqual(result.assignment.roleCode, REFEREE_ROLE_CODE.ANY);
});

test("M02: manual rejection preserves causedBy and stable reasonCodes", () => {
  const result = validateManualRefereeAssignment(
    manualSnaps({
      directorySnapshot: createPopulatedSnapshotResult([
        baseCandidate({ active: false }),
      ]),
    })
  );
  assert.equal(result.ok, false);
  assert.equal(
    result.failure.code,
    REFEREE_ASSIGNMENT_DIAGNOSTIC_CODE.MANUAL_ASSIGNMENT_REJECTED
  );
  assert.equal(
    result.failure.causedBy,
    REFEREE_ASSIGNMENT_DIAGNOSTIC_CODE.REFEREE_INACTIVE
  );
  assert.ok(
    result.failure.reasonCodes.includes(
      REFEREE_ASSIGNMENT_DIAGNOSTIC_CODE.REFEREE_INACTIVE
    )
  );
  const sorted = [...result.failure.reasonCodes].sort();
  assert.deepEqual([...result.failure.reasonCodes], sorted);
});

test("M03: hard failures cannot be overridden", () => {
  const result = validateManualRefereeAssignment(
    manualSnaps({
      request: {
        requestId: "man-1",
        tenantId: "tenant-1",
        tournamentId: "tourn-1",
        matchId: "m-1",
        refereeId: "ref-1",
        roleCode: REFEREE_ROLE_CODE.PRIMARY,
        allowSoftOverride: true,
      },
      directorySnapshot: createPopulatedSnapshotResult([
        baseCandidate({ active: false }),
      ]),
    })
  );
  assert.equal(result.ok, false);
  assert.equal(
    result.failure.causedBy,
    REFEREE_ASSIGNMENT_DIAGNOSTIC_CODE.REFEREE_INACTIVE
  );
});

test("M04: soft note override requires explicit allowSoftOverride", () => {
  const blocked = validateManualRefereeAssignment(
    manualSnaps({
      preferredTags: ["lang:vi"],
      request: {
        requestId: "man-1",
        tenantId: "tenant-1",
        tournamentId: "tourn-1",
        matchId: "m-1",
        refereeId: "ref-1",
        roleCode: REFEREE_ROLE_CODE.PRIMARY,
        allowSoftOverride: false,
      },
    })
  );
  assert.equal(blocked.ok, false);

  const allowed = validateManualRefereeAssignment(
    manualSnaps({
      preferredTags: ["lang:vi"],
      request: {
        requestId: "man-1",
        tenantId: "tenant-1",
        tournamentId: "tourn-1",
        matchId: "m-1",
        refereeId: "ref-1",
        roleCode: REFEREE_ROLE_CODE.PRIMARY,
        allowSoftOverride: true,
      },
    })
  );
  assert.equal(allowed.ok, true);
});

test("M05: ANY concrete role rejected", () => {
  assert.throws(() =>
    createManualRefereeAssignmentRequest({
      requestId: "man-1",
      tenantId: "tenant-1",
      tournamentId: "tourn-1",
      matchId: "m-1",
      refereeId: "ref-1",
      roleCode: REFEREE_ROLE_CODE.ANY,
    })
  );
  // Direct validate path with prebuilt-like input
  const result = validateManualRefereeAssignment({
    ...manualSnaps(),
    request: {
      schemaVersion: CORE13_SCHEMA_VERSION,
      requestId: "man-1",
      tenantId: "tenant-1",
      tournamentId: "tourn-1",
      matchId: "m-1",
      refereeId: "ref-1",
      roleCode: REFEREE_ROLE_CODE.ANY,
      actorRef: null,
      allowSoftOverride: false,
      metadata: {},
    },
  });
  assert.equal(result.ok, false);
  assert.equal(
    result.failure.causedBy,
    REFEREE_ASSIGNMENT_DIAGNOSTIC_CODE.REFEREE_ROLE_UNSUPPORTED
  );
});

test("M06: missing snapshot is fatal", () => {
  const result = validateManualRefereeAssignment(
    manualSnaps({ directorySnapshot: createMissingSnapshotResult() })
  );
  assert.equal(result.ok, false);
  assert.equal(
    result.failure.causedBy,
    REFEREE_ASSIGNMENT_DIAGNOSTIC_CODE.SNAPSHOT_MISSING
  );
});

// ---------------------------------------------------------------------------
// Unassigned diagnostics
// ---------------------------------------------------------------------------

test("U01: valid empty directory produces NO_REFEREE_CANDIDATES", () => {
  const u = explainUnassignedMatch({
    tenantId: "tenant-1",
    tournamentId: "tourn-1",
    match: MATCH,
    roleCode: REFEREE_ROLE_CODE.PRIMARY,
    candidates: [],
    qualifications: [],
    availabilityWindows: [],
    existingAssignments: [],
    policy: basePolicy(),
  });
  assert.ok(
    u.reasonCodes.includes(
      REFEREE_ASSIGNMENT_DIAGNOSTIC_CODE.NO_REFEREE_CANDIDATES
    )
  );
  assert.equal(u.candidateCountEvaluated, 0);
});

test("U02: populated but no eligible produces NO_ELIGIBLE_REFEREE", () => {
  const u = explainUnassignedMatch({
    tenantId: "tenant-1",
    tournamentId: "tourn-1",
    match: MATCH,
    roleCode: REFEREE_ROLE_CODE.PRIMARY,
    candidates: [baseCandidate({ active: false })],
    qualifications: [],
    availabilityWindows: [],
    existingAssignments: [],
    policy: basePolicy(),
  });
  assert.ok(
    u.reasonCodes.includes(
      REFEREE_ASSIGNMENT_DIAGNOSTIC_CODE.NO_ELIGIBLE_REFEREE
    )
  );
  assert.ok(
    u.reasonCodes.includes(REFEREE_ASSIGNMENT_DIAGNOSTIC_CODE.REFEREE_INACTIVE)
  );
});

test("U03: individual match missing schedule window", () => {
  const u = explainUnassignedMatch({
    tenantId: "tenant-1",
    tournamentId: "tourn-1",
    match: { matchId: "m-1" },
    roleCode: REFEREE_ROLE_CODE.PRIMARY,
    candidates: [baseCandidate()],
    qualifications: [baseQual()],
    availabilityWindows: [baseAvail()],
    policy: basePolicy(),
  });
  assert.ok(
    u.reasonCodes.includes(
      REFEREE_ASSIGNMENT_DIAGNOSTIC_CODE.SCHEDULE_WINDOW_REQUIRED
    )
  );
});

// ---------------------------------------------------------------------------
// Workload
// ---------------------------------------------------------------------------

test("W01: workload excludes RELEASED and REPLACED; counts planned/confirmed", () => {
  const rows = [
    MATCH,
    {
      matchId: "m-2",
      startAt: "2026-07-22T11:00:00.000Z",
      endAt: "2026-07-22T12:00:00.000Z",
      courtId: "court-2",
    },
    {
      matchId: "m-3",
      startAt: "2026-07-22T12:00:00.000Z",
      endAt: "2026-07-22T13:00:00.000Z",
      courtId: "court-2",
    },
  ];
  const result = calculateRefereeWorkload({
    assignments: [
      {
        assignmentId: "a1",
        matchId: "m-1",
        refereeId: "ref-1",
        roleCode: REFEREE_ROLE_CODE.PRIMARY,
        status: REFEREE_ASSIGNMENT_STATUS.PLANNED,
      },
      {
        assignmentId: "a2",
        matchId: "m-2",
        refereeId: "ref-1",
        roleCode: REFEREE_ROLE_CODE.PRIMARY,
        status: REFEREE_ASSIGNMENT_STATUS.CONFIRMED,
      },
      {
        assignmentId: "a3",
        matchId: "m-3",
        refereeId: "ref-1",
        roleCode: REFEREE_ROLE_CODE.ASSISTANT,
        status: REFEREE_ASSIGNMENT_STATUS.RELEASED,
      },
      {
        assignmentId: "a4",
        matchId: "m-3",
        refereeId: "ref-1",
        roleCode: REFEREE_ROLE_CODE.PRIMARY,
        status: REFEREE_ASSIGNMENT_STATUS.REPLACED,
      },
    ],
    scheduleRows: rows,
    consecutiveGapMinutesThreshold: 30,
    historyWorkloads: [{ refereeId: "ref-1", assignmentCount: 9 }],
  });
  const wl = result.workloads[0];
  assert.equal(wl.assignmentCount, 2);
  assert.equal(wl.plannedAssignmentCount, 1);
  assert.equal(wl.confirmedAssignmentCount, 1);
  assert.equal(wl.minutesAssigned, 120);
  assert.equal(wl.consecutiveMatchCount, 1);
  assert.equal(wl.courtTransitionCount, 1);
  assert.equal(wl.historicalAssignmentCount, 9);
  assert.ok(Object.isFrozen(wl));
});

test("W02: fairnessDelta uses peer mean; historical stays separate", () => {
  const result = calculateRefereeWorkload({
    assignments: [
      {
        assignmentId: "a1",
        matchId: "m-1",
        refereeId: "ref-1",
        roleCode: "PRIMARY",
        status: "PLANNED",
        startAt: MATCH.startAt,
        endAt: MATCH.endAt,
      },
      {
        assignmentId: "a2",
        matchId: "m-1",
        refereeId: "ref-2",
        roleCode: "PRIMARY",
        status: "PLANNED",
        startAt: MATCH.startAt,
        endAt: MATCH.endAt,
      },
      {
        assignmentId: "a3",
        matchId: "m-2",
        refereeId: "ref-2",
        roleCode: "PRIMARY",
        status: "CONFIRMED",
        startAt: "2026-07-22T11:00:00.000Z",
        endAt: "2026-07-22T12:00:00.000Z",
      },
    ],
    scheduleRows: [
      MATCH,
      {
        matchId: "m-2",
        startAt: "2026-07-22T11:00:00.000Z",
        endAt: "2026-07-22T12:00:00.000Z",
      },
    ],
  });
  const byId = Object.fromEntries(
    result.workloads.map((w) => [w.refereeId, w])
  );
  // peer scale=2 total=3; fairnessDelta = abs(count*2 - 3) → both 1
  assert.equal(byId["ref-1"].fairnessDelta, 1);
  assert.equal(byId["ref-2"].fairnessDelta, 1);
  assert.equal(byId["ref-1"].fairnessScale, 2);
  assert.equal(byId["ref-2"].fairnessScale, 2);
  assert.equal(byId["ref-1"].historicalAssignmentCount, null);
});

// ---------------------------------------------------------------------------
// Determinism / architecture
// ---------------------------------------------------------------------------

test("D01: equivalent shuffled input produces equivalent eligibility output", () => {
  const a = evaluateRefereeEligibility(
    eligInput({
      qualifications: [baseQual({ qualificationId: "q-b" }), baseQual({ qualificationId: "q-a", refereeId: "ref-1" })],
    })
  );
  const b = evaluateRefereeEligibility(
    eligInput({
      qualifications: [baseQual({ qualificationId: "q-a" }), baseQual({ qualificationId: "q-b", refereeId: "ref-1" })],
    })
  );
  // Both eligible; hardFailures empty — freeze equality via prepareFingerprintMaterial on key fields
  assert.equal(a.eligible, b.eligible);
  assert.deepEqual(
    prepareFingerprintMaterial({
      eligible: a.eligible,
      codes: a.hardFailures.map((f) => f.code),
    }),
    prepareFingerprintMaterial({
      eligible: b.eligible,
      codes: b.hardFailures.map((f) => f.code),
    })
  );
});

test("D02: public results deeply immutable", () => {
  const result = evaluateRefereeEligibility(eligInput());
  assert.throws(() => {
    result.eligible = false;
  });
  assert.throws(() => {
    result.hardFailures.push({});
  });
});

test("D03: no forbidden imports or RNG in CORE-13", () => {
  const forbidden = [
    "react",
    "@supabase",
    "referee-v5",
    "competition-core/resource-conflict",
    "core-14",
    "individual-tournament/engines/refereeAssignEngine",
    "team-tournament/engines/refereeAssignEngine",
  ];
  for (const file of listJsFiles(MOD_ROOT)) {
    const src = readFileSync(file, "utf8");
    assert.equal(/Math\.random\s*\(/.test(src), false, file);
    assert.equal(/Date\.now\s*\(/.test(src), false, file);
    assert.equal(/randomUUID\s*\(/.test(src), false, file);
    assert.equal(src.includes("localeCompare"), false, file);
    for (const token of forbidden) {
      assert.equal(src.includes(token), false, `${file} ${token}`);
    }
  }
});

test("D04: index exports Phase 1B+1C+1D; no public aliases", () => {
  assert.equal(typeof Core13.evaluateRefereeEligibility, "function");
  assert.equal(typeof Core13.detectRefereeConflicts, "function");
  assert.equal(typeof Core13.calculateRefereeWorkload, "function");
  assert.equal(typeof Core13.validateManualRefereeAssignment, "function");
  assert.equal(typeof Core13.explainUnassignedMatch, "function");
  assert.equal(typeof Core13.assignReferees, "function");
  assert.equal(typeof Core13.replaceRefereeAssignment, "function");
  assert.equal("scoreRefereeCandidates" in Core13, false);
  assert.equal("autoAssignReferees" in Core13, false);
  assert.equal("dispatchReferees" in Core13, false);
});

test("D05: root competition-core barrel unchanged", () => {
  const barrel = readFileSync(ROOT_BARREL, "utf8");
  assert.equal(barrel.includes("referee-assignment"), false);
});

test("D06: Phase 1C docs exist", () => {
  assert.ok(
    existsSync(
      path.join(ROOT, "docs/competition-engine/core-13/06_PHASE_1C_SERVICE_SEMANTICS.md")
    )
  );
});

void REFEREE_SNAPSHOT_STATUS;
void createEmptySnapshotResult;
