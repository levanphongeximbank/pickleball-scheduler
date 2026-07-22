/**
 * CORE-13 Phase 1D — planner, fingerprints, replacement, Phase 1C corrections.
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
  REFEREE_ROLE_CODE,
  REFEREE_ASSIGNMENT_STATUS,
  REFEREE_ASSIGNMENT_SOURCE,
  REFEREE_SOFT_NOTE_CODE,
  REFEREE_SOFT_OBJECTIVE_KEY,
  REFEREE_ASSIGNMENT_DIAGNOSTIC_CODE,
  REFEREE_SNAPSHOT_STATUS,
  createRefereeCandidate,
  createRefereeQualification,
  createRefereeAvailabilityWindow,
  createRefereeAssignmentPolicy,
  createRefereeAssignmentRequest,
  createRefereeAssignment,
  createPopulatedSnapshotResult,
  createEmptySnapshotResult,
  createMissingSnapshotResult,
  createInvalidSnapshotResult,
  createMatchScheduleRow,
  calculateRefereeWorkload,
  detectRefereeConflicts,
  assignReferees,
  replaceRefereeAssignment,
  fingerprintValue,
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

const MATCH = {
  matchId: "m-1",
  startAt: "2026-07-22T10:00:00.000Z",
  endAt: "2026-07-22T11:00:00.000Z",
  courtId: "court-1",
  participantRefs: ["player-a", "player-b"],
  teamRefs: ["team-a", "team-b"],
  clubIds: ["club-a"],
  organizationIds: ["org-a"],
};

function cand(id, overrides = {}) {
  return createRefereeCandidate({
    refereeId: id,
    active: true,
    playerId: `player-${id}`,
    clubIds: ["club-x"],
    organizationIds: ["org-x"],
    ...overrides,
  });
}

function qual(refereeId, roleCode = REFEREE_ROLE_CODE.PRIMARY) {
  return createRefereeQualification({
    qualificationId: `q-${refereeId}-${roleCode}`,
    refereeId,
    roleCode,
    certificationCode: "CERT",
    validFrom: "2026-01-01T00:00:00.000Z",
    validTo: "2027-01-01T00:00:00.000Z",
  });
}

function avail(refereeId) {
  return createRefereeAvailabilityWindow({
    windowId: `w-${refereeId}`,
    refereeId,
    startAt: "2026-07-22T00:00:00.000Z",
    endAt: "2026-07-22T23:59:59.000Z",
  });
}

function policy(overrides = {}) {
  return createRefereeAssignmentPolicy({
    policyId: "pol-1",
    policyVersion: "1",
    softObjectiveKeys: [
      REFEREE_SOFT_OBJECTIVE_KEY.WORKLOAD_BALANCE,
      REFEREE_SOFT_OBJECTIVE_KEY.CONSECUTIVE_MATCH_MINIMIZATION,
      REFEREE_SOFT_OBJECTIVE_KEY.COURT_TRANSITION_MINIMIZATION,
      REFEREE_SOFT_OBJECTIVE_KEY.ROLE_PREFERENCE,
    ],
    ...overrides,
  });
}

function planInput({
  candidates = [cand("ref-1"), cand("ref-2")],
  matches = [MATCH],
  scheduleMatches,
  existing = [],
  pol = policy(),
  conflictPolicy = {},
  roleRequirementsByMatch,
} = {}) {
  const matchIds = matches.map((m) => m.matchId);
  const scheduleSource = scheduleMatches || matches;
  const request = createRefereeAssignmentRequest({
    requestId: "req-1",
    tenantId: "tenant-1",
    tournamentId: "tourn-1",
    matchIds,
    policy: pol,
    context: {
      tenantId: "tenant-1",
      tournamentId: "tourn-1",
      matchIds,
      snapshotRefs: [
        {
          snapshotId: "s1",
          snapshotVersion: "v1",
          fingerprint: "abcd1234",
        },
      ],
    },
  });
  return {
    request,
    policy: pol,
    directorySnapshot: createPopulatedSnapshotResult(candidates),
    qualificationSnapshot: createPopulatedSnapshotResult(
      candidates.flatMap((c) => [
        qual(c.refereeId, REFEREE_ROLE_CODE.PRIMARY),
        qual(c.refereeId, REFEREE_ROLE_CODE.ASSISTANT),
      ])
    ),
    availabilitySnapshot: createPopulatedSnapshotResult(
      candidates.map((c) => avail(c.refereeId))
    ),
    existingAssignmentSnapshot:
      existing.length > 0
        ? createPopulatedSnapshotResult(existing)
        : createEmptySnapshotResult(),
    scheduleSnapshot: createPopulatedSnapshotResult(
      scheduleSource.map((m) => createMatchScheduleRow(m))
    ),
    conflictPolicy,
    roleRequirementsByMatch,
  };
}

// ---- Phase 1C corrections ----

test("P1C-1: fairnessDelta symmetric for counts [1,2]", () => {
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
  assert.equal(byId["ref-1"].fairnessDelta, 1);
  assert.equal(byId["ref-2"].fairnessDelta, 1);
  assert.equal(byId["ref-1"].fairnessScale, 2);
  assert.equal(result.fairnessScale, 2);
});

test("P1C-2: team affiliation not hard by default; hard when flagged", () => {
  const soft = detectRefereeConflicts({
    refereeId: "ref-1",
    candidate: cand("ref-1"),
    match: MATCH,
    candidateTeamIds: ["team-a"],
    conflictPolicy: {},
  });
  assert.equal(soft.conflicts.length, 0);
  assert.ok(soft.softNotes.some((n) => n.code === REFEREE_SOFT_NOTE_CODE.AFFILIATED_TEAM));

  const hard = detectRefereeConflicts({
    refereeId: "ref-1",
    candidate: cand("ref-1"),
    match: MATCH,
    candidateTeamIds: ["team-a"],
    conflictPolicy: { disallowAffiliatedTeamReferee: true },
  });
  assert.ok(hard.conflicts.length > 0);
});

test("P1C-3: club and org affiliation policy-gated; self-referee denied", () => {
  const club = detectRefereeConflicts({
    refereeId: "ref-1",
    candidate: cand("ref-1", { clubIds: ["club-a"] }),
    match: MATCH,
    conflictPolicy: { disallowAffiliatedClubReferee: true },
  });
  assert.ok(club.conflicts.length > 0);

  const org = detectRefereeConflicts({
    refereeId: "ref-1",
    candidate: cand("ref-1", { organizationIds: ["org-a"] }),
    match: MATCH,
    conflictPolicy: { disallowAffiliatedOrganizationReferee: true },
  });
  assert.ok(org.conflicts.length > 0);

  const self = detectRefereeConflicts({
    refereeId: "ref-1",
    candidate: cand("ref-1", { playerId: "player-a" }),
    match: MATCH,
    conflictPolicy: {},
    policy: { allowSelfRefereed: false },
  });
  assert.ok(self.conflicts.length > 0);
});

test("P1C-4: soft notes use stable enum codes", () => {
  assert.ok(Object.isFrozen(REFEREE_SOFT_NOTE_CODE));
  assert.equal(
    REFEREE_SOFT_NOTE_CODE.PREFERRED_TAG_MISSING,
    "PREFERRED_TAG_MISSING"
  );
});

// ---- Planner ----

test("P1D-1: fills single mandatory PRIMARY slot", () => {
  const result = assignReferees(planInput());
  assert.equal(result.ok, true);
  assert.equal(result.plan.assignments.length, 1);
  assert.equal(result.plan.assignments[0].roleCode, REFEREE_ROLE_CODE.PRIMARY);
  assert.notEqual(result.plan.assignments[0].roleCode, REFEREE_ROLE_CODE.ANY);
  assert.equal(result.plan.assignments[0].source, REFEREE_ASSIGNMENT_SOURCE.AUTO);
});

test("P1D-2: multiple matches deterministic; shuffle-invariant fingerprint", () => {
  const matches = [
    MATCH,
    {
      matchId: "m-2",
      startAt: "2026-07-22T12:00:00.000Z",
      endAt: "2026-07-22T13:00:00.000Z",
      courtId: "court-2",
      participantRefs: ["p3", "p4"],
      teamRefs: [],
      clubIds: [],
    },
  ];
  const a = assignReferees(planInput({ matches }));
  const b = assignReferees(
    planInput({
      matches: [matches[1], matches[0]],
      candidates: [cand("ref-2"), cand("ref-1")],
    })
  );
  assert.equal(a.ok, true);
  assert.equal(b.ok, true);
  assert.equal(a.plan.assignments.length, 2);
  assert.equal(a.plan.planFingerprint, b.plan.planFingerprint);
  assert.equal(a.plan.planId, b.plan.planId);
});

test("P1D-3: multiple roles; same referee blocked by default; allowed when enabled", () => {
  const roleRequirementsByMatch = {
    "m-1": [
      {
        roleCode: REFEREE_ROLE_CODE.PRIMARY,
        mandatory: true,
        minCount: 1,
        maxCount: 1,
      },
      {
        roleCode: REFEREE_ROLE_CODE.ASSISTANT,
        mandatory: true,
        minCount: 1,
        maxCount: 1,
      },
    ],
  };
  const blocked = assignReferees(
    planInput({
      candidates: [cand("ref-1")],
      roleRequirementsByMatch,
      pol: policy({ allowSameRefereeMultipleRolesOnMatch: false }),
    })
  );
  assert.equal(blocked.plan.assignments.length, 1);
  assert.ok(blocked.plan.unassigned.length >= 1);

  const allowed = assignReferees(
    planInput({
      candidates: [cand("ref-1")],
      roleRequirementsByMatch,
      pol: policy({ allowSameRefereeMultipleRolesOnMatch: true }),
    })
  );
  assert.equal(allowed.plan.assignments.length, 2);
});

test("P1D-4: ANY requirement emits concrete role", () => {
  const result = assignReferees(
    planInput({
      candidates: [cand("ref-1")],
      roleRequirementsByMatch: {
        "m-1": [
          {
            roleCode: REFEREE_ROLE_CODE.ANY,
            mandatory: true,
            minCount: 1,
            maxCount: 1,
          },
        ],
      },
      pol: policy({
        preferredConcreteRoles: [REFEREE_ROLE_CODE.ASSISTANT],
      }),
    })
  );
  assert.equal(result.ok, true);
  assert.equal(result.plan.assignments[0].roleCode, REFEREE_ROLE_CODE.ASSISTANT);
});

test("P1D-5: lower workload preferred; newly planned blocks overlap", () => {
  const m2 = {
    matchId: "m-2",
    startAt: "2026-07-22T10:30:00.000Z",
    endAt: "2026-07-22T11:30:00.000Z",
    courtId: "court-1",
    participantRefs: ["p3", "p4"],
    teamRefs: [],
    clubIds: [],
  };
  const result = assignReferees(
    planInput({
      matches: [MATCH, m2],
      candidates: [cand("ref-1"), cand("ref-2")],
    })
  );
  assert.equal(result.ok, true);
  assert.equal(result.plan.assignments.length, 2);
  const refs = result.plan.assignments.map((a) => a.refereeId).sort();
  assert.deepEqual(refs, ["ref-1", "ref-2"]);
});

test("P1D-6: empty directory valid plan with unassigned; missing snapshot fatal", () => {
  const empty = assignReferees({
    ...planInput({ candidates: [] }),
    directorySnapshot: createEmptySnapshotResult(),
  });
  assert.equal(empty.ok, true);
  assert.equal(empty.plan.assignments.length, 0);
  assert.ok(empty.plan.unassigned.length > 0);
  assert.ok(
    empty.plan.unassigned[0].reasonCodes.includes(
      REFEREE_ASSIGNMENT_DIAGNOSTIC_CODE.NO_REFEREE_CANDIDATES
    )
  );

  const missing = assignReferees({
    ...planInput(),
    directorySnapshot: createMissingSnapshotResult(),
  });
  assert.equal(missing.ok, false);
  assert.equal(
    missing.failure.code,
    REFEREE_ASSIGNMENT_DIAGNOSTIC_CODE.SNAPSHOT_MISSING
  );

  const invalid = assignReferees({
    ...planInput(),
    scheduleSnapshot: createInvalidSnapshotResult(),
  });
  assert.equal(invalid.ok, false);
  assert.equal(
    invalid.failure.code,
    REFEREE_ASSIGNMENT_DIAGNOSTIC_CODE.SNAPSHOT_INVALID
  );
});

test("P1D-7: missing match window recoverable; displayLabel ignored in fingerprint", () => {
  const badMatch = { matchId: "m-bad" };
  const good = assignReferees(
    planInput({
      matches: [MATCH, badMatch],
      candidates: [cand("ref-1"), cand("ref-2")],
    })
  );
  assert.equal(good.ok, true);
  assert.ok(good.plan.assignments.some((a) => a.matchId === "m-1"));
  assert.ok(good.plan.unassigned.some((u) => u.matchId === "m-bad"));

  const a = assignReferees(
    planInput({ candidates: [cand("ref-1", { displayLabel: "A" })] })
  );
  const b = assignReferees(
    planInput({ candidates: [cand("ref-1", { displayLabel: "B" })] })
  );
  assert.equal(a.plan.planFingerprint, b.plan.planFingerprint);
});

test("P1D-8: decision change changes fingerprint; assignment ids stable", () => {
  const a = assignReferees(planInput({ candidates: [cand("ref-1")] }));
  const b = assignReferees(planInput({ candidates: [cand("ref-2")] }));
  assert.notEqual(a.plan.planFingerprint, b.plan.planFingerprint);
  const again = assignReferees(planInput({ candidates: [cand("ref-1")] }));
  assert.equal(
    a.plan.assignments[0].assignmentId,
    again.plan.assignments[0].assignmentId
  );
  assert.ok(Object.isFrozen(a.plan));
});

// ---- Replacement ----

test("P1D-9: replacement success and audit without recordedAt", () => {
  const prior = createRefereeAssignment({
    assignmentId: "asg-prior",
    matchId: "m-1",
    refereeId: "ref-1",
    roleCode: REFEREE_ROLE_CODE.PRIMARY,
    status: REFEREE_ASSIGNMENT_STATUS.CONFIRMED,
    source: REFEREE_ASSIGNMENT_SOURCE.AUTO,
  });
  const result = replaceRefereeAssignment({
    request: {
      requestId: "rep-1",
      tenantId: "tenant-1",
      tournamentId: "tourn-1",
      assignmentId: "asg-prior",
      incomingRefereeId: "ref-2",
      reasonCode: "SWAP",
    },
    directorySnapshot: createPopulatedSnapshotResult([
      cand("ref-1"),
      cand("ref-2"),
    ]),
    qualificationSnapshot: createPopulatedSnapshotResult([
      qual("ref-1"),
      qual("ref-2"),
    ]),
    availabilitySnapshot: createPopulatedSnapshotResult([
      avail("ref-1"),
      avail("ref-2"),
    ]),
    existingAssignmentSnapshot: createPopulatedSnapshotResult([prior]),
    scheduleSnapshot: createPopulatedSnapshotResult([
      createMatchScheduleRow(MATCH),
    ]),
    conflictPolicy: {},
    policy: policy(),
  });
  assert.equal(result.ok, true);
  assert.equal(result.outgoingAssignment.status, REFEREE_ASSIGNMENT_STATUS.REPLACED);
  assert.equal(
    result.incomingAssignment.source,
    REFEREE_ASSIGNMENT_SOURCE.REPLACEMENT
  );
  assert.equal(result.incomingAssignment.roleCode, REFEREE_ROLE_CODE.PRIMARY);
  assert.equal(result.auditPayload.recordedAt, null);
  assert.ok(result.resultFingerprint);
});

test("P1D-10: replacement rejects same referee, missing, RELEASED, REPLACED", () => {
  const prior = createRefereeAssignment({
    assignmentId: "asg-prior",
    matchId: "m-1",
    refereeId: "ref-1",
    roleCode: REFEREE_ROLE_CODE.PRIMARY,
    status: REFEREE_ASSIGNMENT_STATUS.PLANNED,
  });
  const base = {
    directorySnapshot: createPopulatedSnapshotResult([cand("ref-1"), cand("ref-2")]),
    qualificationSnapshot: createPopulatedSnapshotResult([
      qual("ref-1"),
      qual("ref-2"),
    ]),
    availabilitySnapshot: createPopulatedSnapshotResult([
      avail("ref-1"),
      avail("ref-2"),
    ]),
    scheduleSnapshot: createPopulatedSnapshotResult([
      createMatchScheduleRow(MATCH),
    ]),
    conflictPolicy: {},
    policy: policy(),
  };

  const same = replaceRefereeAssignment({
    ...base,
    request: {
      requestId: "r1",
      tenantId: "tenant-1",
      tournamentId: "tourn-1",
      assignmentId: "asg-prior",
      incomingRefereeId: "ref-1",
    },
    existingAssignmentSnapshot: createPopulatedSnapshotResult([prior]),
  });
  assert.equal(same.ok, false);
  assert.equal(
    same.failure.causedBy,
    REFEREE_ASSIGNMENT_DIAGNOSTIC_CODE.REFEREE_ALREADY_ASSIGNED
  );

  const missing = replaceRefereeAssignment({
    ...base,
    request: {
      requestId: "r2",
      tenantId: "tenant-1",
      tournamentId: "tourn-1",
      assignmentId: "nope",
      incomingRefereeId: "ref-2",
    },
    existingAssignmentSnapshot: createPopulatedSnapshotResult([prior]),
  });
  assert.equal(missing.ok, false);

  for (const status of [
    REFEREE_ASSIGNMENT_STATUS.RELEASED,
    REFEREE_ASSIGNMENT_STATUS.REPLACED,
  ]) {
    const r = replaceRefereeAssignment({
      ...base,
      request: {
        requestId: "r3",
        tenantId: "tenant-1",
        tournamentId: "tourn-1",
        assignmentId: "asg-prior",
        incomingRefereeId: "ref-2",
      },
      existingAssignmentSnapshot: createPopulatedSnapshotResult([
        { ...prior, status },
      ]),
    });
    assert.equal(r.ok, false, status);
  }
});

test("P1D-11: architecture guards", () => {
  assert.equal(typeof Core13.assignReferees, "function");
  assert.equal(typeof Core13.replaceRefereeAssignment, "function");
  assert.equal("autoAssignReferees" in Core13, false);
  assert.equal("dispatchReferees" in Core13, false);
  assert.equal("planRefereeAssignments" in Core13, false);
  assert.equal("reassignReferee" in Core13, false);
  const barrel = readFileSync(ROOT_BARREL, "utf8");
  assert.equal(barrel.includes("referee-assignment"), false);
  assert.ok(
    existsSync(
      path.join(
        ROOT,
        "docs/competition-engine/core-13/07_PHASE_1D_ASSIGNMENT_PLANNER.md"
      )
    )
  );
  for (const file of listJsFiles(MOD_ROOT)) {
    const src = readFileSync(file, "utf8");
    assert.equal(/Math\.random\s*\(/.test(src), false, file);
    assert.equal(/Date\.now\s*\(/.test(src), false, file);
    assert.equal(/randomUUID\s*\(/.test(src), false, file);
    assert.equal(src.includes("localeCompare"), false, file);
    assert.equal(src.includes("referee-v5"), false, file);
    assert.equal(src.includes("@supabase"), false, file);
    assert.equal(/from\s+["']react["']/.test(src), false, file);
    assert.equal(
      /from\s+["'][^"']*(?:resource-conflict|core-14|\/core14)/i.test(src),
      false,
      file
    );
  }
  void fingerprintValue;
  void REFEREE_SNAPSHOT_STATUS;
});

test("P1D-12: mandatory before optional; refereeId final tie-break", () => {
  const result = assignReferees(
    planInput({
      candidates: [cand("ref-z"), cand("ref-a")],
      roleRequirementsByMatch: {
        "m-1": [
          {
            roleCode: REFEREE_ROLE_CODE.ASSISTANT,
            mandatory: false,
            minCount: 1,
            maxCount: 1,
            priority: 1,
          },
          {
            roleCode: REFEREE_ROLE_CODE.PRIMARY,
            mandatory: true,
            minCount: 1,
            maxCount: 1,
            priority: 99,
          },
        ],
      },
      pol: policy({ softObjectiveKeys: [] }),
    })
  );
  assert.equal(result.ok, true);
  assert.equal(result.plan.assignments.length, 2);
  // With empty objectives, lower refereeId wins first mandatory fill → ref-a PRIMARY
  const primary = result.plan.assignments.find(
    (a) => a.roleCode === REFEREE_ROLE_CODE.PRIMARY
  );
  assert.equal(primary.refereeId, "ref-a");
});

test("P1D-13: objective order and consecutive/court/role preferences", () => {
  const early = {
    matchId: "m-early",
    startAt: "2026-07-22T09:00:00.000Z",
    endAt: "2026-07-22T10:00:00.000Z",
    courtId: "court-a",
    participantRefs: ["px", "py"],
    teamRefs: [],
    clubIds: [],
  };
  const laterSameCourt = {
    ...MATCH,
    matchId: "m-later",
    startAt: "2026-07-22T10:15:00.000Z",
    endAt: "2026-07-22T11:15:00.000Z",
    courtId: "court-a",
  };
  const laterOtherCourt = {
    ...laterSameCourt,
    matchId: "m-later",
    courtId: "court-b",
  };

  const existing = [
    createRefereeAssignment({
      assignmentId: "asg-early-1",
      matchId: "m-early",
      refereeId: "ref-1",
      roleCode: REFEREE_ROLE_CODE.PRIMARY,
      status: REFEREE_ASSIGNMENT_STATUS.CONFIRMED,
    }),
  ];

  const consecutivePreferred = assignReferees(
    planInput({
      matches: [laterSameCourt],
      scheduleMatches: [early, laterSameCourt],
      candidates: [cand("ref-1"), cand("ref-2")],
      existing,
      pol: policy({
        softObjectiveKeys: [
          REFEREE_SOFT_OBJECTIVE_KEY.CONSECUTIVE_MATCH_MINIMIZATION,
        ],
        consecutiveGapMinutesThreshold: 30,
      }),
    })
  );
  // Prefer ref-2 on later match to avoid consecutive after early assignment
  assert.equal(consecutivePreferred.plan.assignments[0].refereeId, "ref-2");

  const courtPreferred = assignReferees(
    planInput({
      matches: [laterOtherCourt],
      scheduleMatches: [early, laterOtherCourt],
      candidates: [cand("ref-1"), cand("ref-2")],
      existing,
      pol: policy({
        softObjectiveKeys: [
          REFEREE_SOFT_OBJECTIVE_KEY.COURT_TRANSITION_MINIMIZATION,
        ],
        consecutiveGapMinutesThreshold: 30,
      }),
    })
  );
  assert.equal(courtPreferred.plan.assignments[0].refereeId, "ref-2");

  const roleOrderA = assignReferees(
    planInput({
      candidates: [cand("ref-1")],
      roleRequirementsByMatch: {
        "m-1": [
          {
            roleCode: REFEREE_ROLE_CODE.ANY,
            mandatory: true,
            minCount: 1,
            maxCount: 1,
          },
        ],
      },
      pol: policy({
        softObjectiveKeys: [REFEREE_SOFT_OBJECTIVE_KEY.ROLE_PREFERENCE],
        preferredConcreteRoles: [REFEREE_ROLE_CODE.PRIMARY],
      }),
    })
  );
  const roleOrderB = assignReferees(
    planInput({
      candidates: [cand("ref-1")],
      roleRequirementsByMatch: {
        "m-1": [
          {
            roleCode: REFEREE_ROLE_CODE.ANY,
            mandatory: true,
            minCount: 1,
            maxCount: 1,
          },
        ],
      },
      pol: policy({
        softObjectiveKeys: [REFEREE_SOFT_OBJECTIVE_KEY.ROLE_PREFERENCE],
        preferredConcreteRoles: [REFEREE_ROLE_CODE.ASSISTANT],
      }),
    })
  );
  assert.equal(roleOrderA.plan.assignments[0].roleCode, REFEREE_ROLE_CODE.PRIMARY);
  assert.equal(
    roleOrderB.plan.assignments[0].roleCode,
    REFEREE_ROLE_CODE.ASSISTANT
  );
  assert.notEqual(
    roleOrderA.plan.planFingerprint,
    roleOrderB.plan.planFingerprint
  );
});

test("P1D-14: ineligible excluded; max simultaneous; slot ids differ", () => {
  const inactive = cand("ref-bad", { active: false });
  const result = assignReferees(
    planInput({
      candidates: [inactive, cand("ref-1")],
    })
  );
  assert.equal(result.plan.assignments[0].refereeId, "ref-1");

  const maxed = assignReferees(
    planInput({
      matches: [
        MATCH,
        {
          matchId: "m-2",
          startAt: "2026-07-22T10:30:00.000Z",
          endAt: "2026-07-22T11:30:00.000Z",
          courtId: "court-2",
          participantRefs: ["p3", "p4"],
          teamRefs: [],
          clubIds: [],
        },
      ],
      candidates: [cand("ref-1")],
      pol: policy({ maxSimultaneousAssignments: 1 }),
    })
  );
  assert.equal(maxed.plan.assignments.length, 1);
  assert.ok(maxed.plan.unassigned.length >= 1);

  const multiSlot = assignReferees(
    planInput({
      candidates: [cand("ref-1"), cand("ref-2")],
      roleRequirementsByMatch: {
        "m-1": [
          {
            roleCode: REFEREE_ROLE_CODE.PRIMARY,
            mandatory: true,
            minCount: 2,
            maxCount: 2,
          },
        ],
      },
    })
  );
  assert.equal(multiSlot.plan.assignments.length, 2);
  assert.notEqual(
    multiSlot.plan.assignments[0].assignmentId,
    multiSlot.plan.assignments[1].assignmentId
  );
});

test("P1D-15: replacement overlap isolation; causedBy preserved; fingerprint ignores sink time", () => {
  const prior = createRefereeAssignment({
    assignmentId: "asg-prior",
    matchId: "m-1",
    refereeId: "ref-1",
    roleCode: REFEREE_ROLE_CODE.PRIMARY,
    status: REFEREE_ASSIGNMENT_STATUS.CONFIRMED,
  });
  const unrelated = createRefereeAssignment({
    assignmentId: "asg-other",
    matchId: "m-2",
    refereeId: "ref-2",
    roleCode: REFEREE_ROLE_CODE.PRIMARY,
    status: REFEREE_ASSIGNMENT_STATUS.CONFIRMED,
  });
  const overlapOther = {
    matchId: "m-2",
    startAt: "2026-07-22T10:30:00.000Z",
    endAt: "2026-07-22T11:30:00.000Z",
    courtId: "court-2",
    participantRefs: ["p3", "p4"],
    teamRefs: [],
    clubIds: [],
  };

  const okIgnoreOutgoing = replaceRefereeAssignment({
    request: {
      requestId: "rep-ok",
      tenantId: "tenant-1",
      tournamentId: "tourn-1",
      assignmentId: "asg-prior",
      incomingRefereeId: "ref-3",
      reasonCode: "SWAP",
    },
    directorySnapshot: createPopulatedSnapshotResult([
      cand("ref-1"),
      cand("ref-2"),
      cand("ref-3"),
    ]),
    qualificationSnapshot: createPopulatedSnapshotResult([
      qual("ref-1"),
      qual("ref-2"),
      qual("ref-3"),
    ]),
    availabilitySnapshot: createPopulatedSnapshotResult([
      avail("ref-1"),
      avail("ref-2"),
      avail("ref-3"),
    ]),
    existingAssignmentSnapshot: createPopulatedSnapshotResult([prior]),
    scheduleSnapshot: createPopulatedSnapshotResult([
      createMatchScheduleRow(MATCH),
    ]),
    conflictPolicy: {},
    policy: policy(),
  });
  assert.equal(okIgnoreOutgoing.ok, true);

  const rejectUnrelated = replaceRefereeAssignment({
    request: {
      requestId: "rep-block",
      tenantId: "tenant-1",
      tournamentId: "tourn-1",
      assignmentId: "asg-prior",
      incomingRefereeId: "ref-2",
    },
    directorySnapshot: createPopulatedSnapshotResult([
      cand("ref-1"),
      cand("ref-2"),
    ]),
    qualificationSnapshot: createPopulatedSnapshotResult([
      qual("ref-1"),
      qual("ref-2"),
    ]),
    availabilitySnapshot: createPopulatedSnapshotResult([
      avail("ref-1"),
      avail("ref-2"),
    ]),
    existingAssignmentSnapshot: createPopulatedSnapshotResult([
      prior,
      unrelated,
    ]),
    scheduleSnapshot: createPopulatedSnapshotResult([
      createMatchScheduleRow(MATCH),
      createMatchScheduleRow(overlapOther),
    ]),
    conflictPolicy: {},
    policy: policy({ maxSimultaneousAssignments: 1 }),
  });
  assert.equal(rejectUnrelated.ok, false);
  assert.equal(
    rejectUnrelated.failure.code,
    REFEREE_ASSIGNMENT_DIAGNOSTIC_CODE.REPLACEMENT_REFEREE_REJECTED
  );
  assert.ok(rejectUnrelated.failure.causedBy);
  assert.ok(Array.isArray(rejectUnrelated.failure.reasonCodes));
  assert.ok(rejectUnrelated.failure.reasonCodes.length >= 1);

  const anyReject = replaceRefereeAssignment({
    request: {
      requestId: "rep-any",
      tenantId: "tenant-1",
      tournamentId: "tourn-1",
      assignmentId: "asg-prior",
      incomingRefereeId: "ref-2",
      roleCode: REFEREE_ROLE_CODE.ANY,
    },
    directorySnapshot: createPopulatedSnapshotResult([
      cand("ref-1"),
      cand("ref-2"),
    ]),
    qualificationSnapshot: createPopulatedSnapshotResult([
      qual("ref-1"),
      qual("ref-2"),
    ]),
    availabilitySnapshot: createPopulatedSnapshotResult([
      avail("ref-1"),
      avail("ref-2"),
    ]),
    existingAssignmentSnapshot: createPopulatedSnapshotResult([prior]),
    scheduleSnapshot: createPopulatedSnapshotResult([
      createMatchScheduleRow(MATCH),
    ]),
    conflictPolicy: {},
    policy: policy(),
  });
  assert.equal(anyReject.ok, false);

  // Fingerprint ignores sink timestamps — pure result has no recordedAt
  assert.equal(okIgnoreOutgoing.auditPayload.recordedAt, null);
  const fp1 = okIgnoreOutgoing.resultFingerprint;
  assert.equal(typeof fp1, "string");
  assert.ok(fp1.length > 0);
});
