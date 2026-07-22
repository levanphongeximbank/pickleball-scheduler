/**
 * CORE-14 Phase 1E — dormant resolution recommendations + dry-run validation.
 * Capability-local only. Not added to Integrator unit-test-files.json.
 */

import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync, readdirSync, statSync, existsSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import {
  RESOURCE_KIND,
  SCOPE_TYPE,
  OCCUPANCY_SOURCE,
  RESOURCE_FINDING_CODE,
  EVALUATION_STATUS,
  SEVERITY,
  AVAILABILITY_MODE,
  AVAILABILITY_STATUS,
  createResourceOccupancy,
  detectResourceConflicts,
  normalizeCapacityPolicy,
  REST_MODE,
  RESOLUTION_ACTION_TYPE,
  normalizeResolutionPolicy,
  createResolutionPolicy,
  getPermittedActionsForFinding,
  isActionPermittedForFinding,
  proposeResourceConflictResolutions,
  validateResolutionRecommendation,
  RESOLUTION_VALIDATION_STATUS,
  projectRecommendation,
  createRootConflictContinuityKey,
  compareFindingsWithContinuity,
  createResolutionRecommendation,
  createRecommendationId,
  rankRecommendations,
  compareRecommendations,
  buildMoveAssignmentTimeDelta,
  buildReassignCourtDelta,
  buildReassignRefereeDelta,
  buildReduceCapacityUsageDelta,
} from "../src/features/competition-core/resource-conflict/index.js";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const RC_ROOT = path.join(ROOT, "src/features/competition-core/resource-conflict");
const CC_INDEX = path.join(ROOT, "src/features/competition-core/index.js");

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

function key(kind, id, scopeType = SCOPE_TYPE.EVENT, scopeId = "event-1") {
  return {
    resourceKind: kind,
    resourceId: id,
    scopeType,
    scopeId: scopeType === SCOPE_TYPE.GLOBAL ? null : scopeId,
  };
}

function rawOcc(overrides = {}) {
  return {
    occupancyId: "occ-1",
    resourceKey: key(RESOURCE_KIND.PLAYER, "player-1"),
    assignmentId: "asg-1",
    activityId: null,
    matchId: null,
    competitionId: null,
    venueId: null,
    startMs: 1000,
    endMs: 2000,
    capacityUnits: 1,
    locked: false,
    published: false,
    source: OCCUPANCY_SOURCE.MANUAL,
    metadata: null,
    ...overrides,
  };
}

function basePolicy(overrides = {}) {
  return {
    policyVersion: "core14-resolution-policy-v1",
    allowedActionTypes: [
      RESOLUTION_ACTION_TYPE.MOVE_ASSIGNMENT_TIME,
      RESOLUTION_ACTION_TYPE.REASSIGN_COURT,
      RESOLUTION_ACTION_TYPE.REASSIGN_REFEREE,
      RESOLUTION_ACTION_TYPE.INSERT_REST_GAP,
      RESOLUTION_ACTION_TYPE.REDUCE_CAPACITY_USAGE,
      RESOLUTION_ACTION_TYPE.MARK_FOR_MANUAL_REVIEW,
      RESOLUTION_ACTION_TYPE.NO_SAFE_AUTOMATIC_RESOLUTION,
    ],
    maximumRecommendationCount: 20,
    maximumCandidatesPerConflict: 10,
    maximumChangedAssignments: 5,
    maximumShiftMs: 100000,
    allowTouchLocked: false,
    allowTouchPublished: false,
    allowCrossScopeResourceChange: false,
    requireManualApprovalForLocked: true,
    requireManualApprovalForPublished: true,
    automaticEligibilityEnabled: true,
    candidateTimeWindows: [],
    candidateCourtResources: [],
    candidateRefereeResources: [],
    candidateCapacityValues: [],
    metadata: null,
    ...overrides,
  };
}

function overlapPair(kind = RESOURCE_KIND.PLAYER, id = "player-1") {
  const rk = key(kind, id, kind === RESOURCE_KIND.COURT ? SCOPE_TYPE.VENUE : SCOPE_TYPE.EVENT, kind === RESOURCE_KIND.COURT ? "venue-1" : "event-1");
  return [
    rawOcc({
      occupancyId: "a",
      assignmentId: "asg-a",
      resourceKey: rk,
      startMs: 0,
      endMs: 100,
    }),
    rawOcc({
      occupancyId: "b",
      assignmentId: "asg-b",
      resourceKey: rk,
      startMs: 50,
      endMs: 150,
    }),
  ];
}

function detectOverlap(occupancies, extra = {}) {
  return detectResourceConflicts({ occupancies, ...extra });
}

// ——— POLICY (1–8) ———

test("1. Valid policy", () => {
  const result = normalizeResolutionPolicy(basePolicy());
  assert.equal(result.ok, true);
  assert.equal(result.value.allowTouchLocked, false);
  assert.equal(result.value.allowTouchPublished, false);
});

test("2. Missing policy version", () => {
  const result = normalizeResolutionPolicy(basePolicy({ policyVersion: "" }));
  assert.equal(result.ok, false);
});

test("3. Invalid maximum candidate limit", () => {
  const result = normalizeResolutionPolicy(basePolicy({ maximumCandidatesPerConflict: 0 }));
  assert.equal(result.ok, false);
});

test("4. Invalid maximum shift", () => {
  const result = normalizeResolutionPolicy(basePolicy({ maximumShiftMs: -1 }));
  assert.equal(result.ok, false);
});

test("5. Unknown action type", () => {
  const result = normalizeResolutionPolicy(
    basePolicy({ allowedActionTypes: ["REMOVE_ASSIGNMENT"] })
  );
  assert.equal(result.ok, false);
});

test("6. Invalid candidate time interval", () => {
  const result = normalizeResolutionPolicy(
    basePolicy({ candidateTimeWindows: [{ startMs: 100, endMs: 100 }] })
  );
  assert.equal(result.ok, false);
});

test("7. Invalid candidate resource key", () => {
  const result = normalizeResolutionPolicy(
    basePolicy({
      candidateCourtResources: [{ resourceKind: "COURT", resourceId: "", scopeType: "EVENT", scopeId: "e1" }],
    })
  );
  assert.equal(result.ok, false);
});

test("8. Candidate input not mutated", () => {
  const policy = basePolicy({
    candidateTimeWindows: [{ startMs: 200, endMs: 300 }],
    candidateCourtResources: [key(RESOURCE_KIND.COURT, "c2", SCOPE_TYPE.VENUE, "venue-1")],
  });
  const snap = JSON.stringify(policy);
  normalizeResolutionPolicy(policy);
  createResolutionPolicy(policy);
  assert.equal(JSON.stringify(policy), snap);
});

// ——— ACTION MAPPING (9–16) ———

test("9. Player overlap maps to time move", () => {
  const actions = getPermittedActionsForFinding(RESOURCE_FINDING_CODE.PLAYER_TIME_OVERLAP, RESOURCE_KIND.PLAYER);
  assert.equal(actions.includes(RESOLUTION_ACTION_TYPE.MOVE_ASSIGNMENT_TIME), true);
});

test("10. Team overlap maps to time move", () => {
  const actions = getPermittedActionsForFinding(RESOURCE_FINDING_CODE.TEAM_TIME_OVERLAP, RESOURCE_KIND.TEAM);
  assert.equal(actions.includes(RESOLUTION_ACTION_TYPE.MOVE_ASSIGNMENT_TIME), true);
});

test("11. Court overlap maps to court reassign and time move", () => {
  const actions = getPermittedActionsForFinding(RESOURCE_FINDING_CODE.COURT_TIME_OVERLAP, RESOURCE_KIND.COURT);
  assert.equal(actions.includes(RESOLUTION_ACTION_TYPE.REASSIGN_COURT), true);
  assert.equal(actions.includes(RESOLUTION_ACTION_TYPE.MOVE_ASSIGNMENT_TIME), true);
});

test("12. Referee overlap maps to referee reassign and time move", () => {
  const actions = getPermittedActionsForFinding(RESOURCE_FINDING_CODE.REFEREE_TIME_OVERLAP, RESOURCE_KIND.REFEREE);
  assert.equal(actions.includes(RESOLUTION_ACTION_TYPE.REASSIGN_REFEREE), true);
  assert.equal(actions.includes(RESOLUTION_ACTION_TYPE.MOVE_ASSIGNMENT_TIME), true);
});

test("13. Mandatory rest maps to rest-gap action", () => {
  const actions = getPermittedActionsForFinding(RESOURCE_FINDING_CODE.MANDATORY_REST_VIOLATION, RESOURCE_KIND.PLAYER);
  assert.equal(actions.includes(RESOLUTION_ACTION_TYPE.INSERT_REST_GAP), true);
});

test("14. Preferred rest maps to soft rest-gap option", () => {
  const actions = getPermittedActionsForFinding(RESOURCE_FINDING_CODE.PREFERRED_REST_WARNING, RESOURCE_KIND.PLAYER);
  assert.equal(actions.includes(RESOLUTION_ACTION_TYPE.INSERT_REST_GAP), true);
  assert.equal(actions.includes(RESOLUTION_ACTION_TYPE.NO_SAFE_AUTOMATIC_RESOLUTION), false);
});

test("15. Venue unavailable does not map to court reassign automatically", () => {
  const actions = getPermittedActionsForFinding(RESOURCE_FINDING_CODE.VENUE_UNAVAILABLE, RESOURCE_KIND.VENUE);
  assert.equal(actions.includes(RESOLUTION_ACTION_TYPE.REASSIGN_COURT), false);
  assert.equal(actions.includes(RESOLUTION_ACTION_TYPE.MOVE_ASSIGNMENT_TIME), true);
});

test("16. Resource-kind-incompatible action rejected", () => {
  assert.equal(
    isActionPermittedForFinding(
      RESOURCE_FINDING_CODE.RESOURCE_UNAVAILABLE,
      RESOLUTION_ACTION_TYPE.REASSIGN_COURT,
      RESOURCE_KIND.PLAYER
    ),
    false
  );
  assert.equal(
    isActionPermittedForFinding(
      RESOURCE_FINDING_CODE.RESOURCE_UNAVAILABLE,
      RESOLUTION_ACTION_TYPE.REASSIGN_COURT,
      RESOURCE_KIND.COURT
    ),
    true
  );
});

// ——— PROTECTION (17–22) ———

test("17. Locked assignment blocked by default", () => {
  const occupancies = overlapPair();
  occupancies[1].locked = true;
  const baseline = detectOverlap(occupancies);
  const result = proposeResourceConflictResolutions({
    baselineDetectionResult: baseline,
    occupancies,
    resolutionPolicy: basePolicy({
      candidateTimeWindows: [{ startMs: 500, endMs: 600 }],
    }),
  });
  assert.ok(result.recommendations.length > 0);
  for (const r of result.recommendations) {
    if (r.actionType === RESOLUTION_ACTION_TYPE.MOVE_ASSIGNMENT_TIME) {
      assert.equal(r.automaticEligible, false);
    }
  }
  assert.ok(
    result.recommendations.some(
      (r) =>
        r.actionType === RESOLUTION_ACTION_TYPE.MARK_FOR_MANUAL_REVIEW ||
        r.actionType === RESOLUTION_ACTION_TYPE.NO_SAFE_AUTOMATIC_RESOLUTION ||
        r.violatesLock === true
    )
  );
});

test("18. Published assignment blocked by default", () => {
  const occupancies = overlapPair();
  occupancies[1].published = true;
  const baseline = detectOverlap(occupancies);
  const result = proposeResourceConflictResolutions({
    baselineDetectionResult: baseline,
    occupancies,
    resolutionPolicy: basePolicy({
      candidateTimeWindows: [{ startMs: 500, endMs: 600 }],
    }),
  });
  assert.ok(
    result.recommendations.every((r) => r.automaticEligible === false)
  );
  assert.ok(
    result.recommendations.some(
      (r) =>
        r.affectsPublishedAssignment === true ||
        r.actionType === RESOLUTION_ACTION_TYPE.MARK_FOR_MANUAL_REVIEW ||
        r.actionType === RESOLUTION_ACTION_TYPE.NO_SAFE_AUTOMATIC_RESOLUTION
    )
  );
});

test("19. Explicit locked permission still requires manual approval", () => {
  const occupancies = overlapPair();
  occupancies[1].locked = true;
  const baseline = detectOverlap(occupancies);
  const result = proposeResourceConflictResolutions({
    baselineDetectionResult: baseline,
    occupancies,
    resolutionPolicy: basePolicy({
      allowTouchLocked: true,
      requireManualApprovalForLocked: true,
      candidateTimeWindows: [{ startMs: 500, endMs: 600 }],
    }),
  });
  const moves = result.recommendations.filter(
    (r) => r.actionType === RESOLUTION_ACTION_TYPE.MOVE_ASSIGNMENT_TIME
  );
  assert.ok(moves.length > 0);
  for (const r of moves) {
    assert.equal(r.requiresManualApproval, true);
    assert.equal(r.automaticEligible, false);
  }
});

test("20. Explicit published permission still requires manual approval", () => {
  const occupancies = overlapPair();
  occupancies[1].published = true;
  const baseline = detectOverlap(occupancies);
  const result = proposeResourceConflictResolutions({
    baselineDetectionResult: baseline,
    occupancies,
    resolutionPolicy: basePolicy({
      allowTouchPublished: true,
      requireManualApprovalForPublished: true,
      candidateTimeWindows: [{ startMs: 500, endMs: 600 }],
    }),
  });
  const moves = result.recommendations.filter(
    (r) => r.actionType === RESOLUTION_ACTION_TYPE.MOVE_ASSIGNMENT_TIME
  );
  assert.ok(moves.length > 0);
  for (const r of moves) {
    assert.equal(r.requiresManualApproval, true);
    assert.equal(r.automaticEligible, false);
  }
});

test("21. Cross-scope reassign blocked by default", () => {
  const occupancies = overlapPair(RESOURCE_KIND.COURT, "court-1");
  const baseline = detectOverlap(occupancies);
  const result = proposeResourceConflictResolutions({
    baselineDetectionResult: baseline,
    occupancies,
    resolutionPolicy: basePolicy({
      candidateCourtResources: [key(RESOURCE_KIND.COURT, "court-2", SCOPE_TYPE.VENUE, "other-venue")],
    }),
  });
  const reassigns = result.recommendations.filter(
    (r) => r.actionType === RESOLUTION_ACTION_TYPE.REASSIGN_COURT
  );
  assert.equal(reassigns.length, 0);
});

test("22. Allowed cross-scope change remains manual only", () => {
  const occupancies = overlapPair(RESOURCE_KIND.COURT, "court-1");
  const baseline = detectOverlap(occupancies);
  const result = proposeResourceConflictResolutions({
    baselineDetectionResult: baseline,
    occupancies,
    resolutionPolicy: basePolicy({
      allowCrossScopeResourceChange: true,
      candidateCourtResources: [key(RESOURCE_KIND.COURT, "court-2", SCOPE_TYPE.VENUE, "other-venue")],
    }),
  });
  const reassigns = result.recommendations.filter(
    (r) => r.actionType === RESOLUTION_ACTION_TYPE.REASSIGN_COURT
  );
  assert.ok(reassigns.length > 0);
  for (const r of reassigns) {
    assert.equal(r.crossesScopeBoundary, true);
    assert.equal(r.requiresManualApproval, true);
    assert.equal(r.automaticEligible, false);
  }
});

// ——— GENERATION (23–32) ———

test("23. No caller candidate produces manual fallback", () => {
  const occupancies = overlapPair();
  const baseline = detectOverlap(occupancies);
  const result = proposeResourceConflictResolutions({
    baselineDetectionResult: baseline,
    occupancies,
    resolutionPolicy: basePolicy(),
  });
  assert.ok(result.recommendations.length > 0);
  assert.ok(
    result.recommendations.some(
      (r) =>
        r.actionType === RESOLUTION_ACTION_TYPE.MARK_FOR_MANUAL_REVIEW ||
        r.actionType === RESOLUTION_ACTION_TYPE.NO_SAFE_AUTOMATIC_RESOLUTION
    )
  );
  assert.equal(result.automaticEligibleRecommendationCount, 0);
});

test("24. Candidate time window produces time move", () => {
  const occupancies = overlapPair();
  const baseline = detectOverlap(occupancies);
  const result = proposeResourceConflictResolutions({
    baselineDetectionResult: baseline,
    occupancies,
    resolutionPolicy: basePolicy({
      candidateTimeWindows: [{ startMs: 500, endMs: 600 }],
    }),
  });
  assert.ok(
    result.recommendations.some((r) => r.actionType === RESOLUTION_ACTION_TYPE.MOVE_ASSIGNMENT_TIME)
  );
});

test("25. Candidate court produces court reassignment", () => {
  const occupancies = overlapPair(RESOURCE_KIND.COURT, "court-1");
  const baseline = detectOverlap(occupancies);
  const result = proposeResourceConflictResolutions({
    baselineDetectionResult: baseline,
    occupancies,
    resolutionPolicy: basePolicy({
      candidateCourtResources: [key(RESOURCE_KIND.COURT, "court-2", SCOPE_TYPE.VENUE, "venue-1")],
    }),
  });
  assert.ok(
    result.recommendations.some((r) => r.actionType === RESOLUTION_ACTION_TYPE.REASSIGN_COURT)
  );
});

test("26. Candidate referee produces referee reassignment", () => {
  const occupancies = overlapPair(RESOURCE_KIND.REFEREE, "ref-1");
  const baseline = detectOverlap(occupancies);
  const result = proposeResourceConflictResolutions({
    baselineDetectionResult: baseline,
    occupancies,
    resolutionPolicy: basePolicy({
      candidateRefereeResources: [key(RESOURCE_KIND.REFEREE, "ref-2")],
    }),
  });
  assert.ok(
    result.recommendations.some((r) => r.actionType === RESOLUTION_ACTION_TYPE.REASSIGN_REFEREE)
  );
});

test("27. Candidate reduced capacity produces capacity action", () => {
  const loc = key(RESOURCE_KIND.LOCATION, "loc-1", SCOPE_TYPE.VENUE, "venue-1");
  const occupancies = [
    rawOcc({ occupancyId: "a", assignmentId: "a1", resourceKey: loc, startMs: 0, endMs: 100, capacityUnits: 3 }),
    rawOcc({ occupancyId: "b", assignmentId: "b1", resourceKey: loc, startMs: 0, endMs: 100, capacityUnits: 3 }),
  ];
  const cap = normalizeCapacityPolicy({
    capacities: [{ resourceKey: loc, capacity: 4 }],
    policyVersion: "core14-capacity-policy-v1",
  });
  assert.equal(cap.ok, true);
  const baseline = detectResourceConflicts({
    occupancies,
    capacityCheckEnabled: true,
    capacityPolicy: { capacities: [{ resourceKey: loc, capacity: 4 }], policyVersion: "core14-capacity-policy-v1" },
  });
  assert.ok(baseline.findings.some((f) => f.code === RESOURCE_FINDING_CODE.RESOURCE_CAPACITY_EXCEEDED));
  const result = proposeResourceConflictResolutions({
    baselineDetectionResult: baseline,
    occupancies,
    capacityCheckEnabled: true,
    capacityPolicy: { capacities: [{ resourceKey: loc, capacity: 4 }], policyVersion: "core14-capacity-policy-v1" },
    resolutionPolicy: basePolicy({ candidateCapacityValues: [1] }),
  });
  assert.ok(
    result.recommendations.some((r) => r.actionType === RESOLUTION_ACTION_TYPE.REDUCE_CAPACITY_USAGE)
  );
});

test("28. Duplicate candidates suppressed", () => {
  const occupancies = overlapPair();
  const baseline = detectOverlap(occupancies);
  const result = proposeResourceConflictResolutions({
    baselineDetectionResult: baseline,
    occupancies,
    resolutionPolicy: basePolicy({
      candidateTimeWindows: [
        { startMs: 500, endMs: 600 },
        { startMs: 500, endMs: 600 },
      ],
    }),
  });
  const moves = result.recommendations.filter(
    (r) => r.actionType === RESOLUTION_ACTION_TYPE.MOVE_ASSIGNMENT_TIME
  );
  const ids = new Set(moves.map((r) => r.recommendationId));
  assert.equal(ids.size, moves.length);
});

test("29. Per-conflict candidate limit enforced", () => {
  const occupancies = overlapPair();
  const baseline = detectOverlap(occupancies);
  const windows = [];
  for (let i = 0; i < 8; i += 1) {
    windows.push({ startMs: 1000 + i * 200, endMs: 1100 + i * 200 });
  }
  const result = proposeResourceConflictResolutions({
    baselineDetectionResult: baseline,
    occupancies,
    resolutionPolicy: basePolicy({
      maximumCandidatesPerConflict: 2,
      candidateTimeWindows: windows,
    }),
  });
  const moves = result.recommendations.filter(
    (r) => r.actionType === RESOLUTION_ACTION_TYPE.MOVE_ASSIGNMENT_TIME
  );
  assert.ok(moves.length <= 2);
});

test("30. Global recommendation limit enforced", () => {
  const occupancies = overlapPair();
  const baseline = detectOverlap(occupancies);
  const windows = [];
  for (let i = 0; i < 5; i += 1) {
    windows.push({ startMs: 1000 + i * 200, endMs: 1100 + i * 200 });
  }
  const result = proposeResourceConflictResolutions({
    baselineDetectionResult: baseline,
    occupancies,
    resolutionPolicy: basePolicy({
      maximumRecommendationCount: 1,
      candidateTimeWindows: windows,
    }),
  });
  assert.equal(result.recommendations.length, 1);
});

test("31. recommendationCount deterministic", () => {
  const occupancies = overlapPair();
  const baseline = detectOverlap(occupancies);
  const policy = basePolicy({ candidateTimeWindows: [{ startMs: 500, endMs: 600 }] });
  const a = proposeResourceConflictResolutions({
    baselineDetectionResult: baseline,
    occupancies,
    resolutionPolicy: policy,
  });
  const b = proposeResourceConflictResolutions({
    baselineDetectionResult: baseline,
    occupancies,
    resolutionPolicy: policy,
  });
  assert.equal(a.recommendationCount, b.recommendationCount);
  assert.equal(a.deterministicFingerprint, b.deterministicFingerprint);
});

test("32. No hidden candidate invention", () => {
  const occupancies = overlapPair(RESOURCE_KIND.COURT, "court-1");
  const baseline = detectOverlap(occupancies);
  const result = proposeResourceConflictResolutions({
    baselineDetectionResult: baseline,
    occupancies,
    resolutionPolicy: basePolicy(),
  });
  assert.equal(
    result.recommendations.some((r) => r.actionType === RESOLUTION_ACTION_TYPE.REASSIGN_COURT),
    false
  );
});

// ——— PROJECTION (33–40) ———

test("33. Time move updates copies only", () => {
  const occupancies = [
    createResourceOccupancy(rawOcc({ occupancyId: "a", assignmentId: "a1", startMs: 0, endMs: 100 })),
  ];
  const snap = JSON.stringify(occupancies);
  const rec = createResolutionRecommendation({
    conflictIds: ["c1"],
    actionType: RESOLUTION_ACTION_TYPE.MOVE_ASSIGNMENT_TIME,
    targetAssignmentIds: ["a1"],
    targetOccupancyIds: ["a"],
    proposedChanges: [
      buildMoveAssignmentTimeDelta({
        targetAssignmentId: "a1",
        targetOccupancyIds: ["a"],
        previousStartMs: 0,
        previousEndMs: 100,
        proposedStartMs: 200,
        proposedEndMs: 300,
      }),
    ],
    policyVersion: "core14-resolution-policy-v1",
  });
  const projected = projectRecommendation({ occupancies, recommendation: rec });
  assert.equal(projected.ok, true);
  assert.equal(projected.projectedOccupancies[0].startMs, 200);
  assert.equal(JSON.stringify(occupancies), snap);
});

test("34. Court reassign changes only court resource key", () => {
  const court1 = key(RESOURCE_KIND.COURT, "c1", SCOPE_TYPE.VENUE, "v1");
  const court2 = key(RESOURCE_KIND.COURT, "c2", SCOPE_TYPE.VENUE, "v1");
  const occupancies = [
    createResourceOccupancy(
      rawOcc({ occupancyId: "a", assignmentId: "a1", resourceKey: court1, startMs: 0, endMs: 100 })
    ),
  ];
  const rec = createResolutionRecommendation({
    conflictIds: ["c1"],
    actionType: RESOLUTION_ACTION_TYPE.REASSIGN_COURT,
    targetOccupancyIds: ["a"],
    targetAssignmentIds: ["a1"],
    proposedChanges: [
      buildReassignCourtDelta({
        targetAssignmentId: "a1",
        targetOccupancyIds: ["a"],
        previousCourtResourceKey: court1,
        proposedCourtResourceKey: court2,
      }),
    ],
    policyVersion: "core14-resolution-policy-v1",
  });
  const projected = projectRecommendation({ occupancies, recommendation: rec });
  assert.equal(projected.ok, true);
  assert.equal(projected.projectedOccupancies[0].resourceKey.resourceId, "c2");
  assert.equal(projected.projectedOccupancies[0].startMs, 0);
  assert.equal(projected.projectedOccupancies[0].occupancyId, "a");
});

test("35. Referee reassign changes only referee resource key", () => {
  const r1 = key(RESOURCE_KIND.REFEREE, "r1");
  const r2 = key(RESOURCE_KIND.REFEREE, "r2");
  const occupancies = [
    createResourceOccupancy(rawOcc({ occupancyId: "a", assignmentId: "a1", resourceKey: r1 })),
  ];
  const rec = createResolutionRecommendation({
    conflictIds: ["c1"],
    actionType: RESOLUTION_ACTION_TYPE.REASSIGN_REFEREE,
    targetOccupancyIds: ["a"],
    targetAssignmentIds: ["a1"],
    proposedChanges: [
      buildReassignRefereeDelta({
        targetAssignmentId: "a1",
        targetOccupancyIds: ["a"],
        previousRefereeResourceKey: r1,
        proposedRefereeResourceKey: r2,
      }),
    ],
    policyVersion: "core14-resolution-policy-v1",
  });
  const projected = projectRecommendation({ occupancies, recommendation: rec });
  assert.equal(projected.ok, true);
  assert.equal(projected.projectedOccupancies[0].resourceKey.resourceId, "r2");
});

test("36. Capacity change updates only capacityUnits", () => {
  const occupancies = [
    createResourceOccupancy(rawOcc({ occupancyId: "a", assignmentId: "a1", capacityUnits: 3 })),
  ];
  const rec = createResolutionRecommendation({
    conflictIds: ["c1"],
    actionType: RESOLUTION_ACTION_TYPE.REDUCE_CAPACITY_USAGE,
    targetOccupancyIds: ["a"],
    targetAssignmentIds: ["a1"],
    proposedChanges: [
      buildReduceCapacityUsageDelta({
        targetAssignmentId: "a1",
        targetOccupancyIds: ["a"],
        previousCapacityUnits: 3,
        proposedCapacityUnits: 1,
      }),
    ],
    policyVersion: "core14-resolution-policy-v1",
  });
  const projected = projectRecommendation({ occupancies, recommendation: rec });
  assert.equal(projected.ok, true);
  assert.equal(projected.projectedOccupancies[0].capacityUnits, 1);
  assert.equal(projected.projectedOccupancies[0].startMs, 1000);
});

test("37. Missing target occupancy rejected", () => {
  const occupancies = [createResourceOccupancy(rawOcc({ occupancyId: "a", assignmentId: "a1" }))];
  const rec = createResolutionRecommendation({
    conflictIds: ["c1"],
    actionType: RESOLUTION_ACTION_TYPE.MOVE_ASSIGNMENT_TIME,
    targetOccupancyIds: ["missing"],
    targetAssignmentIds: ["a1"],
    proposedChanges: [
      buildMoveAssignmentTimeDelta({
        targetAssignmentId: "a1",
        targetOccupancyIds: ["missing"],
        previousStartMs: 0,
        previousEndMs: 100,
        proposedStartMs: 200,
        proposedEndMs: 300,
      }),
    ],
    policyVersion: "core14-resolution-policy-v1",
  });
  const projected = projectRecommendation({ occupancies, recommendation: rec });
  assert.equal(projected.ok, false);
});

test("38. Ambiguous target occupancy rejected", () => {
  const a = createResourceOccupancy(rawOcc({ occupancyId: "x", assignmentId: "dup" }));
  const b = createResourceOccupancy(rawOcc({ occupancyId: "y", assignmentId: "dup", startMs: 3000, endMs: 4000 }));
  // Force duplicate occupancyId scenario for ambiguity check via same id twice in array
  const copies = [
    { ...rawOcc({ occupancyId: "same", assignmentId: "a1" }) },
    { ...rawOcc({ occupancyId: "same", assignmentId: "a2", startMs: 5000, endMs: 6000 }) },
  ];
  // project uses occupancy id matching — duplicate ids in array
  const mutable = copies.map((c) => createResourceOccupancy({ ...c, occupancyId: c.occupancyId === "same" && c.assignmentId === "a2" ? "same" : c.occupancyId }));
  // createResourceOccupancy freezes; build raw copies for projector input path that allows pre-validate duplicates
  const raw = [
    rawOcc({ occupancyId: "same", assignmentId: "a1" }),
    rawOcc({ occupancyId: "same", assignmentId: "a2", startMs: 5000, endMs: 6000 }),
  ];
  const rec = createResolutionRecommendation({
    conflictIds: ["c1"],
    actionType: RESOLUTION_ACTION_TYPE.MOVE_ASSIGNMENT_TIME,
    targetOccupancyIds: ["same"],
    targetAssignmentIds: ["a1"],
    proposedChanges: [
      buildMoveAssignmentTimeDelta({
        targetAssignmentId: "a1",
        targetOccupancyIds: ["same"],
        previousStartMs: 1000,
        previousEndMs: 2000,
        proposedStartMs: 7000,
        proposedEndMs: 8000,
      }),
    ],
    policyVersion: "core14-resolution-policy-v1",
  });
  const projected = projectRecommendation({ occupancies: raw, recommendation: rec });
  assert.equal(projected.ok, false);
  void a;
  void b;
  void mutable;
});

test("39. Immutable identity fields preserved", () => {
  const occupancies = [
    createResourceOccupancy(
      rawOcc({
        occupancyId: "a",
        assignmentId: "a1",
        activityId: "act-1",
        matchId: "m-1",
        competitionId: "comp-1",
        locked: true,
        published: true,
      })
    ),
  ];
  const rec = createResolutionRecommendation({
    conflictIds: ["c1"],
    actionType: RESOLUTION_ACTION_TYPE.MOVE_ASSIGNMENT_TIME,
    targetOccupancyIds: ["a"],
    targetAssignmentIds: ["a1"],
    proposedChanges: [
      buildMoveAssignmentTimeDelta({
        targetAssignmentId: "a1",
        targetOccupancyIds: ["a"],
        previousStartMs: 1000,
        previousEndMs: 2000,
        proposedStartMs: 3000,
        proposedEndMs: 4000,
      }),
    ],
    policyVersion: "core14-resolution-policy-v1",
  });
  const projected = projectRecommendation({ occupancies, recommendation: rec });
  assert.equal(projected.ok, true);
  const p = projected.projectedOccupancies[0];
  assert.equal(p.occupancyId, "a");
  assert.equal(p.assignmentId, "a1");
  assert.equal(p.activityId, "act-1");
  assert.equal(p.matchId, "m-1");
  assert.equal(p.competitionId, "comp-1");
  assert.equal(p.locked, true);
  assert.equal(p.published, true);
});

test("40. Baseline occupancies not mutated", () => {
  const occupancies = overlapPair().map((o) => createResourceOccupancy(o));
  const snap = JSON.stringify(occupancies);
  const baseline = detectOverlap(occupancies);
  proposeResourceConflictResolutions({
    baselineDetectionResult: baseline,
    occupancies,
    resolutionPolicy: basePolicy({ candidateTimeWindows: [{ startMs: 500, endMs: 600 }] }),
  });
  assert.equal(JSON.stringify(occupancies), snap);
});

// ——— VALIDATION (41–56) ———

test("41. Candidate resolves target conflict", () => {
  const occupancies = overlapPair();
  const baseline = detectOverlap(occupancies);
  const finding = baseline.findings[0];
  const targetId = finding.occupancyIds[finding.occupancyIds.length - 1];
  const target = occupancies.find((o) => o.occupancyId === targetId);
  const rec = createResolutionRecommendation({
    conflictIds: [finding.findingId],
    actionType: RESOLUTION_ACTION_TYPE.MOVE_ASSIGNMENT_TIME,
    targetAssignmentIds: [target.assignmentId],
    targetOccupancyIds: [target.occupancyId],
    proposedChanges: [
      buildMoveAssignmentTimeDelta({
        targetAssignmentId: target.assignmentId,
        targetOccupancyIds: [target.occupancyId],
        previousStartMs: target.startMs,
        previousEndMs: target.endMs,
        proposedStartMs: 500,
        proposedEndMs: 600,
      }),
    ],
    expectedResolvedConflictIds: [finding.findingId],
    policyVersion: "core14-resolution-policy-v1",
  });
  const validation = validateResolutionRecommendation({
    recommendation: rec,
    baselineDetectionResult: baseline,
    occupancies,
    resolutionPolicy: createResolutionPolicy(basePolicy()),
  });
  assert.equal(validation.evaluationStatus, RESOLUTION_VALIDATION_STATUS.COMPLETED);
  assert.equal(validation.originalConflictsResolved, true);
});

test("42. Candidate leaves target conflict unresolved", () => {
  const occupancies = overlapPair();
  const baseline = detectOverlap(occupancies);
  const finding = baseline.findings[0];
  const target = occupancies.find((o) => o.occupancyId === finding.occupancyIds[1]);
  const rec = createResolutionRecommendation({
    conflictIds: [finding.findingId],
    actionType: RESOLUTION_ACTION_TYPE.MOVE_ASSIGNMENT_TIME,
    targetAssignmentIds: [target.assignmentId],
    targetOccupancyIds: [target.occupancyId],
    proposedChanges: [
      buildMoveAssignmentTimeDelta({
        targetAssignmentId: target.assignmentId,
        targetOccupancyIds: [target.occupancyId],
        previousStartMs: target.startMs,
        previousEndMs: target.endMs,
        proposedStartMs: 60,
        proposedEndMs: 160,
      }),
    ],
    expectedResolvedConflictIds: [finding.findingId],
    policyVersion: "core14-resolution-policy-v1",
  });
  const validation = validateResolutionRecommendation({
    recommendation: rec,
    baselineDetectionResult: baseline,
    occupancies,
    resolutionPolicy: createResolutionPolicy(basePolicy()),
  });
  assert.equal(validation.originalConflictsResolved, false);
  assert.ok(validation.unresolvedConflictIds.length > 0);
});

test("43. Candidate introduces secondary hard conflict", () => {
  const rk = key(RESOURCE_KIND.PLAYER, "player-1");
  const occupancies = [
    rawOcc({ occupancyId: "a", assignmentId: "a1", resourceKey: rk, startMs: 0, endMs: 100 }),
    rawOcc({ occupancyId: "b", assignmentId: "b1", resourceKey: rk, startMs: 50, endMs: 150 }),
    rawOcc({ occupancyId: "c", assignmentId: "c1", resourceKey: rk, startMs: 500, endMs: 600 }),
  ];
  const baseline = detectOverlap(occupancies);
  const finding = baseline.findings[0];
  const rec = createResolutionRecommendation({
    conflictIds: [finding.findingId],
    actionType: RESOLUTION_ACTION_TYPE.MOVE_ASSIGNMENT_TIME,
    targetAssignmentIds: ["b1"],
    targetOccupancyIds: ["b"],
    proposedChanges: [
      buildMoveAssignmentTimeDelta({
        targetAssignmentId: "b1",
        targetOccupancyIds: ["b"],
        previousStartMs: 50,
        previousEndMs: 150,
        proposedStartMs: 550,
        proposedEndMs: 650,
      }),
    ],
    expectedResolvedConflictIds: [finding.findingId],
    policyVersion: "core14-resolution-policy-v1",
  });
  const validation = validateResolutionRecommendation({
    recommendation: rec,
    baselineDetectionResult: baseline,
    occupancies,
    resolutionPolicy: createResolutionPolicy(basePolicy()),
  });
  assert.ok(validation.secondaryHardConflictIds.length > 0);
});

test("44. Candidate introduces secondary soft warning", () => {
  const rk = key(RESOURCE_KIND.PLAYER, "player-1");
  const occupancies = [
    rawOcc({ occupancyId: "a", assignmentId: "a1", resourceKey: rk, startMs: 0, endMs: 100 }),
    rawOcc({ occupancyId: "b", assignmentId: "b1", resourceKey: rk, startMs: 50, endMs: 150 }),
    rawOcc({ occupancyId: "c", assignmentId: "c1", resourceKey: rk, startMs: 400, endMs: 500 }),
  ];
  const baseline = detectResourceConflicts({
    occupancies,
    restPolicy: {
      restMode: REST_MODE.PREFERRED,
      minimumRestMs: 200,
      applicableResourceKinds: [RESOURCE_KIND.PLAYER],
      policyVersion: "core14-rest-policy-v1",
    },
  });
  const overlap = baseline.findings.find((f) => f.code === RESOURCE_FINDING_CODE.PLAYER_TIME_OVERLAP);
  assert.ok(overlap);
  const rec = createResolutionRecommendation({
    conflictIds: [overlap.findingId],
    actionType: RESOLUTION_ACTION_TYPE.MOVE_ASSIGNMENT_TIME,
    targetAssignmentIds: ["b1"],
    targetOccupancyIds: ["b"],
    proposedChanges: [
      buildMoveAssignmentTimeDelta({
        targetAssignmentId: "b1",
        targetOccupancyIds: ["b"],
        previousStartMs: 50,
        previousEndMs: 150,
        proposedStartMs: 250,
        proposedEndMs: 350,
      }),
    ],
    expectedResolvedConflictIds: [overlap.findingId],
    policyVersion: "core14-resolution-policy-v1",
  });
  const validation = validateResolutionRecommendation({
    recommendation: rec,
    baselineDetectionResult: baseline,
    occupancies,
    restPolicy: {
      restMode: REST_MODE.PREFERRED,
      minimumRestMs: 200,
      applicableResourceKinds: [RESOURCE_KIND.PLAYER],
      policyVersion: "core14-rest-policy-v1",
    },
    resolutionPolicy: createResolutionPolicy(basePolicy()),
  });
  assert.ok(validation.secondarySoftFindingIds.length > 0);
});

test("45. Pre-existing finding is not secondary", () => {
  const rk = key(RESOURCE_KIND.PLAYER, "player-1");
  const rk2 = key(RESOURCE_KIND.PLAYER, "player-2");
  const occupancies = [
    rawOcc({ occupancyId: "a", assignmentId: "a1", resourceKey: rk, startMs: 0, endMs: 100 }),
    rawOcc({ occupancyId: "b", assignmentId: "b1", resourceKey: rk, startMs: 50, endMs: 150 }),
    rawOcc({ occupancyId: "c", assignmentId: "c1", resourceKey: rk2, startMs: 0, endMs: 100 }),
    rawOcc({ occupancyId: "d", assignmentId: "d1", resourceKey: rk2, startMs: 50, endMs: 150 }),
  ];
  const baseline = detectOverlap(occupancies);
  assert.equal(baseline.findings.length, 2);
  const target = baseline.findings[0];
  const rec = createResolutionRecommendation({
    conflictIds: [target.findingId],
    actionType: RESOLUTION_ACTION_TYPE.MOVE_ASSIGNMENT_TIME,
    targetAssignmentIds: ["b1"],
    targetOccupancyIds: ["b"],
    proposedChanges: [
      buildMoveAssignmentTimeDelta({
        targetAssignmentId: "b1",
        targetOccupancyIds: ["b"],
        previousStartMs: 50,
        previousEndMs: 150,
        proposedStartMs: 500,
        proposedEndMs: 600,
      }),
    ],
    expectedResolvedConflictIds: [target.findingId],
    policyVersion: "core14-resolution-policy-v1",
  });
  const validation = validateResolutionRecommendation({
    recommendation: rec,
    baselineDetectionResult: baseline,
    occupancies,
    resolutionPolicy: createResolutionPolicy(basePolicy()),
  });
  const other = baseline.findings[1];
  assert.equal(validation.secondaryConflictIds.includes(other.findingId), false);
});

test("46. Exact finding ID comparison", () => {
  const occupancies = overlapPair();
  const baseline = detectOverlap(occupancies);
  const finding = baseline.findings[0];
  const comparison = compareFindingsWithContinuity(baseline.findings, baseline.findings, {
    targetConflictIds: [finding.findingId],
  });
  assert.equal(comparison.resolvedConflictIds.length, 0);
  assert.equal(comparison.unresolvedConflictIds.includes(finding.findingId), true);
});

test("47. Root continuity catches materially unchanged overlap", () => {
  const occupancies = overlapPair();
  const baseline = detectOverlap(occupancies);
  const finding = baseline.findings[0];
  // Shift both slightly but keep overlap — project only one with tiny shift still overlapping
  const target = occupancies.find((o) => o.occupancyId === finding.occupancyIds[1]);
  const rec = createResolutionRecommendation({
    conflictIds: [finding.findingId],
    actionType: RESOLUTION_ACTION_TYPE.MOVE_ASSIGNMENT_TIME,
    targetAssignmentIds: [target.assignmentId],
    targetOccupancyIds: [target.occupancyId],
    proposedChanges: [
      buildMoveAssignmentTimeDelta({
        targetAssignmentId: target.assignmentId,
        targetOccupancyIds: [target.occupancyId],
        previousStartMs: target.startMs,
        previousEndMs: target.endMs,
        proposedStartMs: target.startMs + 10,
        proposedEndMs: target.endMs + 10,
      }),
    ],
    expectedResolvedConflictIds: [finding.findingId],
    policyVersion: "core14-resolution-policy-v1",
  });
  const validation = validateResolutionRecommendation({
    recommendation: rec,
    baselineDetectionResult: baseline,
    occupancies,
    resolutionPolicy: createResolutionPolicy(basePolicy()),
  });
  assert.equal(validation.originalConflictsResolved, false);
  const continuity = createRootConflictContinuityKey(finding);
  assert.ok(continuity.startsWith("CORE14_RCK_V1:"));
});

test("48. Validation respects authoritative availability failure", () => {
  const occupancies = overlapPair();
  const baseline = detectResourceConflicts({
    occupancies,
    availabilityCheckEnabled: true,
    availabilityMode: AVAILABILITY_MODE.AUTHORITATIVE,
    availabilityFacts: [],
  });
  assert.equal(baseline.evaluationStatus, EVALUATION_STATUS.DATA_UNAVAILABLE);
  const result = proposeResourceConflictResolutions({
    baselineDetectionResult: baseline,
    occupancies,
    resolutionPolicy: basePolicy({ candidateTimeWindows: [{ startMs: 500, endMs: 600 }] }),
  });
  assert.equal(result.evaluationStatus, EVALUATION_STATUS.DATA_UNAVAILABLE);
});

test("49. Validation respects advisory availability warning", () => {
  const occupancies = [
    rawOcc({ occupancyId: "a", assignmentId: "a1", startMs: 0, endMs: 100 }),
  ];
  const baseline = detectResourceConflicts({
    occupancies,
    availabilityCheckEnabled: true,
    availabilityMode: AVAILABILITY_MODE.ADVISORY,
    availabilityFacts: [
      {
        resourceKey: key(RESOURCE_KIND.PLAYER, "player-1"),
        status: AVAILABILITY_STATUS.UNAVAILABLE,
        startMs: 0,
        endMs: 100,
        providerVersion: "test",
      },
    ],
  });
  assert.ok(baseline.findings.some((f) => f.severity === SEVERITY.SOFT));
  const result = proposeResourceConflictResolutions({
    baselineDetectionResult: baseline,
    occupancies,
    availabilityCheckEnabled: true,
    availabilityMode: AVAILABILITY_MODE.ADVISORY,
    availabilityFacts: [
      {
        resourceKey: key(RESOURCE_KIND.PLAYER, "player-1"),
        status: AVAILABILITY_STATUS.UNAVAILABLE,
        startMs: 0,
        endMs: 100,
        providerVersion: "test",
      },
    ],
    resolutionPolicy: basePolicy({ candidateTimeWindows: [{ startMs: 500, endMs: 600 }] }),
  });
  assert.equal(result.evaluationStatus, EVALUATION_STATUS.COMPLETED);
});

test("50. Maximum shift exceeded", () => {
  const occupancies = overlapPair();
  const baseline = detectOverlap(occupancies);
  const finding = baseline.findings[0];
  const target = occupancies.find((o) => o.occupancyId === finding.occupancyIds[1]);
  const rec = createResolutionRecommendation({
    conflictIds: [finding.findingId],
    actionType: RESOLUTION_ACTION_TYPE.MOVE_ASSIGNMENT_TIME,
    targetAssignmentIds: [target.assignmentId],
    targetOccupancyIds: [target.occupancyId],
    estimatedShiftMs: 999999,
    proposedChanges: [
      buildMoveAssignmentTimeDelta({
        targetAssignmentId: target.assignmentId,
        targetOccupancyIds: [target.occupancyId],
        previousStartMs: target.startMs,
        previousEndMs: target.endMs,
        proposedStartMs: 500000,
        proposedEndMs: 500100,
      }),
    ],
    policyVersion: "core14-resolution-policy-v1",
  });
  const validation = validateResolutionRecommendation({
    recommendation: rec,
    baselineDetectionResult: baseline,
    occupancies,
    resolutionPolicy: createResolutionPolicy(basePolicy({ maximumShiftMs: 10 })),
  });
  assert.equal(validation.exceedsMaximumShift, true);
  assert.equal(validation.automaticEligible, false);
});

test("51. Maximum changed assignments exceeded", () => {
  const occupancies = overlapPair();
  const baseline = detectOverlap(occupancies);
  const finding = baseline.findings[0];
  const rec = createResolutionRecommendation({
    conflictIds: [finding.findingId],
    actionType: RESOLUTION_ACTION_TYPE.MOVE_ASSIGNMENT_TIME,
    targetAssignmentIds: ["asg-a", "asg-b"],
    targetOccupancyIds: ["a", "b"],
    changedAssignmentCount: 2,
    proposedChanges: [
      buildMoveAssignmentTimeDelta({
        targetAssignmentId: "asg-a",
        targetOccupancyIds: ["a"],
        previousStartMs: 0,
        previousEndMs: 100,
        proposedStartMs: 500,
        proposedEndMs: 600,
      }),
      buildMoveAssignmentTimeDelta({
        targetAssignmentId: "asg-b",
        targetOccupancyIds: ["b"],
        previousStartMs: 50,
        previousEndMs: 150,
        proposedStartMs: 700,
        proposedEndMs: 800,
      }),
    ],
    policyVersion: "core14-resolution-policy-v1",
  });
  const validation = validateResolutionRecommendation({
    recommendation: rec,
    baselineDetectionResult: baseline,
    occupancies,
    resolutionPolicy: createResolutionPolicy(basePolicy({ maximumChangedAssignments: 1 })),
  });
  assert.equal(validation.exceedsMaximumChangedAssignments, true);
});

test("52. Locked restriction reported", () => {
  const occupancies = overlapPair();
  occupancies[1].locked = true;
  const baseline = detectOverlap(occupancies);
  const finding = baseline.findings[0];
  const rec = createResolutionRecommendation({
    conflictIds: [finding.findingId],
    actionType: RESOLUTION_ACTION_TYPE.MOVE_ASSIGNMENT_TIME,
    targetAssignmentIds: ["asg-b"],
    targetOccupancyIds: ["b"],
    violatesLock: true,
    proposedChanges: [
      buildMoveAssignmentTimeDelta({
        targetAssignmentId: "asg-b",
        targetOccupancyIds: ["b"],
        previousStartMs: 50,
        previousEndMs: 150,
        proposedStartMs: 500,
        proposedEndMs: 600,
      }),
    ],
    policyVersion: "core14-resolution-policy-v1",
  });
  const validation = validateResolutionRecommendation({
    recommendation: rec,
    baselineDetectionResult: baseline,
    occupancies,
    resolutionPolicy: createResolutionPolicy(basePolicy()),
  });
  assert.equal(validation.affectsLockedAssignments, true);
});

test("53. Published restriction reported", () => {
  const occupancies = overlapPair();
  occupancies[1].published = true;
  const baseline = detectOverlap(occupancies);
  const finding = baseline.findings[0];
  const rec = createResolutionRecommendation({
    conflictIds: [finding.findingId],
    actionType: RESOLUTION_ACTION_TYPE.MOVE_ASSIGNMENT_TIME,
    targetAssignmentIds: ["asg-b"],
    targetOccupancyIds: ["b"],
    affectsPublishedAssignment: true,
    proposedChanges: [
      buildMoveAssignmentTimeDelta({
        targetAssignmentId: "asg-b",
        targetOccupancyIds: ["b"],
        previousStartMs: 50,
        previousEndMs: 150,
        proposedStartMs: 500,
        proposedEndMs: 600,
      }),
    ],
    policyVersion: "core14-resolution-policy-v1",
  });
  const validation = validateResolutionRecommendation({
    recommendation: rec,
    baselineDetectionResult: baseline,
    occupancies,
    resolutionPolicy: createResolutionPolicy(basePolicy()),
  });
  assert.equal(validation.affectsPublishedAssignments, true);
});

test("54. Cross-scope restriction reported", () => {
  const court1 = key(RESOURCE_KIND.COURT, "c1", SCOPE_TYPE.VENUE, "v1");
  const court2 = key(RESOURCE_KIND.COURT, "c2", SCOPE_TYPE.VENUE, "v2");
  const occupancies = overlapPair(RESOURCE_KIND.COURT, "c1");
  const baseline = detectOverlap(occupancies);
  const finding = baseline.findings[0];
  const rec = createResolutionRecommendation({
    conflictIds: [finding.findingId],
    actionType: RESOLUTION_ACTION_TYPE.REASSIGN_COURT,
    targetAssignmentIds: ["asg-b"],
    targetOccupancyIds: ["b"],
    crossesScopeBoundary: true,
    proposedChanges: [
      buildReassignCourtDelta({
        targetAssignmentId: "asg-b",
        targetOccupancyIds: ["b"],
        previousCourtResourceKey: court1,
        proposedCourtResourceKey: court2,
      }),
    ],
    policyVersion: "core14-resolution-policy-v1",
  });
  const validation = validateResolutionRecommendation({
    recommendation: rec,
    baselineDetectionResult: baseline,
    occupancies,
    resolutionPolicy: createResolutionPolicy(
      basePolicy({ allowCrossScopeResourceChange: true })
    ),
  });
  assert.equal(validation.crossesScopeBoundary, true);
  assert.equal(validation.automaticEligible, false);
});

test("55. Automatic eligibility true for safe candidate", () => {
  const occupancies = overlapPair();
  const baseline = detectOverlap(occupancies);
  const result = proposeResourceConflictResolutions({
    baselineDetectionResult: baseline,
    occupancies,
    resolutionPolicy: basePolicy({
      candidateTimeWindows: [{ startMs: 500, endMs: 600 }],
      automaticEligibilityEnabled: true,
    }),
  });
  assert.ok(result.automaticEligibleRecommendationCount > 0);
  assert.ok(result.recommendations.some((r) => r.automaticEligible === true));
});

test("56. Automatic eligibility false for manual candidate", () => {
  const occupancies = overlapPair();
  const baseline = detectOverlap(occupancies);
  const result = proposeResourceConflictResolutions({
    baselineDetectionResult: baseline,
    occupancies,
    resolutionPolicy: basePolicy(),
  });
  const manuals = result.recommendations.filter(
    (r) => r.actionType === RESOLUTION_ACTION_TYPE.MARK_FOR_MANUAL_REVIEW
  );
  assert.ok(manuals.length > 0);
  for (const r of manuals) {
    assert.equal(r.automaticEligible, false);
  }
});

// ——— RANKING (57–67) ———

test("57. Fully resolved before unresolved", () => {
  const a = {
    recommendationId: "r-unresolved",
    actionType: RESOLUTION_ACTION_TYPE.MOVE_ASSIGNMENT_TIME,
    violatesLock: false,
    affectsPublishedAssignment: false,
    requiresManualApproval: false,
    automaticEligible: false,
    changedAssignmentCount: 1,
    estimatedShiftMs: 10,
    targetAssignmentIds: ["a"],
    targetOccupancyIds: ["a"],
    _validation: {
      evaluationStatus: "COMPLETED",
      originalConflictsResolved: false,
      secondaryHardConflictIds: [],
      secondarySoftFindingIds: [],
    },
  };
  const b = {
    recommendationId: "r-resolved",
    actionType: RESOLUTION_ACTION_TYPE.MOVE_ASSIGNMENT_TIME,
    violatesLock: false,
    affectsPublishedAssignment: false,
    requiresManualApproval: false,
    automaticEligible: true,
    changedAssignmentCount: 1,
    estimatedShiftMs: 10,
    targetAssignmentIds: ["a"],
    targetOccupancyIds: ["a"],
    _validation: {
      evaluationStatus: "COMPLETED",
      originalConflictsResolved: true,
      secondaryHardConflictIds: [],
      secondarySoftFindingIds: [],
    },
  };
  assert.ok(compareRecommendations(b, a) < 0);
});

test("58. No secondary hard before secondary hard", () => {
  const clean = {
    recommendationId: "clean",
    actionType: RESOLUTION_ACTION_TYPE.MOVE_ASSIGNMENT_TIME,
    violatesLock: false,
    affectsPublishedAssignment: false,
    requiresManualApproval: false,
    automaticEligible: true,
    changedAssignmentCount: 1,
    estimatedShiftMs: 10,
    targetAssignmentIds: ["a"],
    targetOccupancyIds: ["a"],
    _validation: {
      evaluationStatus: "COMPLETED",
      originalConflictsResolved: true,
      secondaryHardConflictIds: [],
      secondarySoftFindingIds: [],
    },
  };
  const dirty = {
    ...clean,
    recommendationId: "dirty",
    automaticEligible: false,
    _validation: {
      evaluationStatus: "COMPLETED",
      originalConflictsResolved: true,
      secondaryHardConflictIds: ["h1"],
      secondarySoftFindingIds: [],
    },
  };
  assert.ok(compareRecommendations(clean, dirty) < 0);
});

test("59. Fewer secondary findings first", () => {
  const fewer = {
    recommendationId: "fewer",
    actionType: RESOLUTION_ACTION_TYPE.MOVE_ASSIGNMENT_TIME,
    violatesLock: false,
    affectsPublishedAssignment: false,
    requiresManualApproval: false,
    automaticEligible: true,
    changedAssignmentCount: 1,
    estimatedShiftMs: 10,
    targetAssignmentIds: ["a"],
    targetOccupancyIds: ["a"],
    _validation: {
      evaluationStatus: "COMPLETED",
      originalConflictsResolved: true,
      secondaryHardConflictIds: [],
      secondarySoftFindingIds: ["s1"],
    },
  };
  const more = {
    ...fewer,
    recommendationId: "more",
    _validation: {
      evaluationStatus: "COMPLETED",
      originalConflictsResolved: true,
      secondaryHardConflictIds: [],
      secondarySoftFindingIds: ["s1", "s2"],
    },
  };
  assert.ok(compareRecommendations(fewer, more) < 0);
});

test("60. Automatic eligible before manual", () => {
  const auto = {
    recommendationId: "auto",
    actionType: RESOLUTION_ACTION_TYPE.MOVE_ASSIGNMENT_TIME,
    violatesLock: false,
    affectsPublishedAssignment: false,
    requiresManualApproval: false,
    automaticEligible: true,
    changedAssignmentCount: 1,
    estimatedShiftMs: 10,
    targetAssignmentIds: ["a"],
    targetOccupancyIds: ["a"],
    _validation: {
      evaluationStatus: "COMPLETED",
      originalConflictsResolved: true,
      secondaryHardConflictIds: [],
      secondarySoftFindingIds: [],
    },
  };
  const manual = {
    ...auto,
    recommendationId: "manual",
    requiresManualApproval: true,
    automaticEligible: false,
  };
  assert.ok(compareRecommendations(auto, manual) < 0);
});

test("61. Fewer changed assignments first", () => {
  const base = {
    recommendationId: "x",
    actionType: RESOLUTION_ACTION_TYPE.MOVE_ASSIGNMENT_TIME,
    violatesLock: false,
    affectsPublishedAssignment: false,
    requiresManualApproval: false,
    automaticEligible: true,
    estimatedShiftMs: 10,
    targetAssignmentIds: ["a"],
    targetOccupancyIds: ["a"],
    _validation: {
      evaluationStatus: "COMPLETED",
      originalConflictsResolved: true,
      secondaryHardConflictIds: [],
      secondarySoftFindingIds: [],
    },
  };
  assert.ok(
    compareRecommendations(
      { ...base, recommendationId: "one", changedAssignmentCount: 1 },
      { ...base, recommendationId: "two", changedAssignmentCount: 2 }
    ) < 0
  );
});

test("62. Lower shift first", () => {
  const base = {
    recommendationId: "x",
    actionType: RESOLUTION_ACTION_TYPE.MOVE_ASSIGNMENT_TIME,
    violatesLock: false,
    affectsPublishedAssignment: false,
    requiresManualApproval: false,
    automaticEligible: true,
    changedAssignmentCount: 1,
    targetAssignmentIds: ["a"],
    targetOccupancyIds: ["a"],
    _validation: {
      evaluationStatus: "COMPLETED",
      originalConflictsResolved: true,
      secondaryHardConflictIds: [],
      secondarySoftFindingIds: [],
    },
  };
  assert.ok(
    compareRecommendations(
      { ...base, recommendationId: "low", estimatedShiftMs: 5 },
      { ...base, recommendationId: "high", estimatedShiftMs: 50 }
    ) < 0
  );
});

test("63. Action ordinal tie-break", () => {
  const base = {
    recommendationId: "same-id-base",
    violatesLock: false,
    affectsPublishedAssignment: false,
    requiresManualApproval: false,
    automaticEligible: true,
    changedAssignmentCount: 1,
    estimatedShiftMs: 0,
    targetAssignmentIds: ["a"],
    targetOccupancyIds: ["a"],
    _validation: {
      evaluationStatus: "COMPLETED",
      originalConflictsResolved: true,
      secondaryHardConflictIds: [],
      secondarySoftFindingIds: [],
    },
  };
  const move = {
    ...base,
    recommendationId: "move",
    actionType: RESOLUTION_ACTION_TYPE.MOVE_ASSIGNMENT_TIME,
  };
  const court = {
    ...base,
    recommendationId: "court",
    actionType: RESOLUTION_ACTION_TYPE.REASSIGN_COURT,
  };
  assert.ok(compareRecommendations(move, court) < 0);
});

test("64. Recommendation ID final tie-break", () => {
  const base = {
    actionType: RESOLUTION_ACTION_TYPE.MOVE_ASSIGNMENT_TIME,
    violatesLock: false,
    affectsPublishedAssignment: false,
    requiresManualApproval: false,
    automaticEligible: true,
    changedAssignmentCount: 1,
    estimatedShiftMs: 0,
    targetAssignmentIds: ["a"],
    targetOccupancyIds: ["a"],
    _validation: {
      evaluationStatus: "COMPLETED",
      originalConflictsResolved: true,
      secondaryHardConflictIds: [],
      secondarySoftFindingIds: [],
    },
  };
  assert.ok(
    compareRecommendations(
      { ...base, recommendationId: "aaa" },
      { ...base, recommendationId: "zzz" }
    ) < 0
  );
});

test("65. Manual review after safe candidate", () => {
  const ranked = rankRecommendations([
    {
      recommendationId: "manual",
      actionType: RESOLUTION_ACTION_TYPE.MARK_FOR_MANUAL_REVIEW,
      violatesLock: false,
      affectsPublishedAssignment: false,
      requiresManualApproval: true,
      automaticEligible: false,
      changedAssignmentCount: 0,
      estimatedShiftMs: 0,
      targetAssignmentIds: [],
      targetOccupancyIds: [],
    },
    {
      recommendationId: "safe",
      actionType: RESOLUTION_ACTION_TYPE.MOVE_ASSIGNMENT_TIME,
      violatesLock: false,
      affectsPublishedAssignment: false,
      requiresManualApproval: false,
      automaticEligible: true,
      changedAssignmentCount: 1,
      estimatedShiftMs: 10,
      targetAssignmentIds: ["a"],
      targetOccupancyIds: ["a"],
    },
  ]);
  assert.equal(ranked[0].recommendationId, "safe");
  assert.equal(ranked[1].recommendationId, "manual");
});

test("66. No-safe action last", () => {
  const ranked = rankRecommendations([
    {
      recommendationId: "nosafe",
      actionType: RESOLUTION_ACTION_TYPE.NO_SAFE_AUTOMATIC_RESOLUTION,
      violatesLock: false,
      affectsPublishedAssignment: false,
      requiresManualApproval: true,
      automaticEligible: false,
      changedAssignmentCount: 0,
      estimatedShiftMs: 0,
      targetAssignmentIds: [],
      targetOccupancyIds: [],
    },
    {
      recommendationId: "manual",
      actionType: RESOLUTION_ACTION_TYPE.MARK_FOR_MANUAL_REVIEW,
      violatesLock: false,
      affectsPublishedAssignment: false,
      requiresManualApproval: true,
      automaticEligible: false,
      changedAssignmentCount: 0,
      estimatedShiftMs: 0,
      targetAssignmentIds: [],
      targetOccupancyIds: [],
    },
  ]);
  assert.equal(ranked[ranked.length - 1].actionType, RESOLUTION_ACTION_TYPE.NO_SAFE_AUTOMATIC_RESOLUTION);
});

test("67. Reordered candidate input parity", () => {
  const occupancies = overlapPair();
  const baseline = detectOverlap(occupancies);
  const windowsA = [
    { startMs: 500, endMs: 600 },
    { startMs: 700, endMs: 800 },
  ];
  const windowsB = [
    { startMs: 700, endMs: 800 },
    { startMs: 500, endMs: 600 },
  ];
  const a = proposeResourceConflictResolutions({
    baselineDetectionResult: baseline,
    occupancies,
    resolutionPolicy: basePolicy({ candidateTimeWindows: windowsA }),
  });
  const b = proposeResourceConflictResolutions({
    baselineDetectionResult: baseline,
    occupancies,
    resolutionPolicy: basePolicy({ candidateTimeWindows: windowsB }),
  });
  assert.equal(a.deterministicFingerprint, b.deterministicFingerprint);
  assert.deepEqual(
    a.recommendations.map((r) => r.recommendationId),
    b.recommendations.map((r) => r.recommendationId)
  );
});

// ——— RESULT (68–74) ———

test("68. Deterministic recommendation IDs", () => {
  const id1 = createRecommendationId({
    conflictIds: ["b", "a"],
    actionType: RESOLUTION_ACTION_TYPE.MOVE_ASSIGNMENT_TIME,
    targetAssignmentIds: ["x"],
    targetOccupancyIds: ["y"],
    proposedChanges: [],
    policyVersion: "v1",
  });
  const id2 = createRecommendationId({
    conflictIds: ["a", "b"],
    actionType: RESOLUTION_ACTION_TYPE.MOVE_ASSIGNMENT_TIME,
    targetAssignmentIds: ["x"],
    targetOccupancyIds: ["y"],
    proposedChanges: [],
    policyVersion: "v1",
  });
  assert.equal(id1, id2);
  assert.ok(id1.startsWith("CORE14_RID_V1:"));
});

test("69. Deterministic validation fingerprints", () => {
  const occupancies = overlapPair();
  const baseline = detectOverlap(occupancies);
  const finding = baseline.findings[0];
  const target = occupancies.find((o) => o.occupancyId === finding.occupancyIds[1]);
  const rec = createResolutionRecommendation({
    conflictIds: [finding.findingId],
    actionType: RESOLUTION_ACTION_TYPE.MOVE_ASSIGNMENT_TIME,
    targetAssignmentIds: [target.assignmentId],
    targetOccupancyIds: [target.occupancyId],
    proposedChanges: [
      buildMoveAssignmentTimeDelta({
        targetAssignmentId: target.assignmentId,
        targetOccupancyIds: [target.occupancyId],
        previousStartMs: target.startMs,
        previousEndMs: target.endMs,
        proposedStartMs: 500,
        proposedEndMs: 600,
      }),
    ],
    policyVersion: "core14-resolution-policy-v1",
  });
  const policy = createResolutionPolicy(basePolicy());
  const a = validateResolutionRecommendation({
    recommendation: rec,
    baselineDetectionResult: baseline,
    occupancies,
    resolutionPolicy: policy,
  });
  const b = validateResolutionRecommendation({
    recommendation: rec,
    baselineDetectionResult: baseline,
    occupancies,
    resolutionPolicy: policy,
  });
  assert.equal(a.deterministicFingerprint, b.deterministicFingerprint);
});

test("70. Deterministic result fingerprint", () => {
  const occupancies = overlapPair();
  const baseline = detectOverlap(occupancies);
  const req = {
    baselineDetectionResult: baseline,
    occupancies,
    resolutionPolicy: basePolicy({ candidateTimeWindows: [{ startMs: 500, endMs: 600 }] }),
  };
  const a = proposeResourceConflictResolutions(req);
  const b = proposeResourceConflictResolutions(req);
  assert.equal(a.deterministicFingerprint, b.deterministicFingerprint);
});

test("71. Reordered equivalent request parity", () => {
  const occA = overlapPair();
  const occB = [occA[1], occA[0]];
  const baselineA = detectOverlap(occA);
  const baselineB = detectOverlap(occB);
  assert.equal(baselineA.deterministicFingerprint, baselineB.deterministicFingerprint);
  const a = proposeResourceConflictResolutions({
    baselineDetectionResult: baselineA,
    occupancies: occA,
    resolutionPolicy: basePolicy({ candidateTimeWindows: [{ startMs: 500, endMs: 600 }] }),
  });
  const b = proposeResourceConflictResolutions({
    baselineDetectionResult: baselineB,
    occupancies: occB,
    resolutionPolicy: basePolicy({ candidateTimeWindows: [{ startMs: 500, endMs: 600 }] }),
  });
  assert.equal(a.deterministicFingerprint, b.deterministicFingerprint);
});

test("72. Counts correct", () => {
  const occupancies = overlapPair();
  const baseline = detectOverlap(occupancies);
  const result = proposeResourceConflictResolutions({
    baselineDetectionResult: baseline,
    occupancies,
    resolutionPolicy: basePolicy({ candidateTimeWindows: [{ startMs: 500, endMs: 600 }] }),
  });
  assert.equal(
    result.automaticEligibleRecommendationCount +
      result.manualReviewRecommendationCount +
      result.noSafeResolutionCount <=
      result.recommendationCount +
        result.automaticEligibleRecommendationCount,
    true
  );
  assert.equal(result.recommendationCount, result.recommendations.length);
});

test("73. recommendationCount does not imply application", () => {
  const occupancies = overlapPair();
  const baseline = detectOverlap(occupancies);
  const result = proposeResourceConflictResolutions({
    baselineDetectionResult: baseline,
    occupancies,
    resolutionPolicy: basePolicy({ candidateTimeWindows: [{ startMs: 500, endMs: 600 }] }),
  });
  assert.ok(result.recommendationCount > 0);
  assert.equal(result.selectedMutationState, null);
  assert.equal(result.appliedOccupancies, null);
});

test("74. No selected mutation state returned", () => {
  const occupancies = overlapPair();
  const baseline = detectOverlap(occupancies);
  const result = proposeResourceConflictResolutions({
    baselineDetectionResult: baseline,
    occupancies,
    resolutionPolicy: basePolicy({ candidateTimeWindows: [{ startMs: 500, endMs: 600 }] }),
  });
  assert.equal("selectedMutationState" in result, true);
  assert.equal(result.selectedMutationState, null);
});

// ——— ARCHITECTURE (75–86) ———

test("75. No CORE-10/11/12/13 implementation imports", () => {
  for (const file of listJsFiles(RC_ROOT)) {
    const text = readFileSync(file, "utf8");
    assert.equal(text.includes("competition-core/optimizer"), false, file);
    assert.equal(text.includes("competition-core/scheduling"), false, file);
    assert.equal(/from ["'].*core-1[123]/.test(text), false, file);
  }
});

test("76. No Venue & Court implementation import", () => {
  for (const file of listJsFiles(RC_ROOT)) {
    const text = readFileSync(file, "utf8");
    assert.equal(text.includes("features/venue"), false, file);
    assert.equal(text.includes("features/court"), false, file);
  }
});

test("77. No root competition-core export", () => {
  assert.equal(existsSync(CC_INDEX), true);
  const text = readFileSync(CC_INDEX, "utf8");
  assert.equal(text.includes("resource-conflict"), false);
});

test("78. No Date.now or Math.random", () => {
  for (const file of listJsFiles(path.join(RC_ROOT, "resolution"))) {
    const text = readFileSync(file, "utf8");
    assert.equal(text.includes("Date.now"), false, file);
    assert.equal(text.includes("Math.random"), false, file);
  }
  for (const file of [
    path.join(RC_ROOT, "services/proposeResourceConflictResolutions.js"),
    path.join(RC_ROOT, "services/validateResolutionRecommendation.js"),
  ]) {
    const text = readFileSync(file, "utf8");
    assert.equal(text.includes("Date.now"), false, file);
    assert.equal(text.includes("Math.random"), false, file);
  }
});

test("79. No SQL/UI/persistence", () => {
  for (const file of listJsFiles(path.join(RC_ROOT, "resolution"))) {
    const text = readFileSync(file, "utf8");
    assert.equal(/supabase/i.test(text), false, file);
    assert.equal(/localStorage/i.test(text), false, file);
    assert.equal(text.includes("react"), false, file);
  }
});

test("80. No automatic application", () => {
  const occupancies = overlapPair();
  const baseline = detectOverlap(occupancies);
  const before = JSON.stringify(occupancies);
  const result = proposeResourceConflictResolutions({
    baselineDetectionResult: baseline,
    occupancies,
    resolutionPolicy: basePolicy({ candidateTimeWindows: [{ startMs: 500, endMs: 600 }] }),
  });
  assert.equal(JSON.stringify(occupancies), before);
  assert.equal(result.appliedOccupancies, null);
});

test("81. No global optimizer search", () => {
  for (const file of listJsFiles(path.join(RC_ROOT, "resolution"))) {
    const text = readFileSync(file, "utf8");
    assert.equal(text.includes("globalSearch"), false, file);
    assert.equal(text.includes("optimizeSchedule"), false, file);
  }
});

test("82. No production adapter", () => {
  for (const file of listJsFiles(RC_ROOT)) {
    const text = readFileSync(file, "utf8");
    assert.equal(text.includes("createVenueAvailability"), false, file);
  }
});

test("83. Phase 1C module still importable", async () => {
  const mod = await import("../src/features/competition-core/resource-conflict/index.js");
  assert.equal(typeof mod.createCanonicalResourceKey, "function");
  assert.equal(typeof mod.createResourceOccupancy, "function");
});

test("84. Phase 1D detectors still available", () => {
  const findings = detectResourceConflicts({
    occupancies: overlapPair(),
  });
  assert.ok(findings.findings.length > 0);
});

test("85. Competition Core root remains free of resource-conflict", () => {
  const text = readFileSync(CC_INDEX, "utf8");
  assert.equal(text.includes("resource-conflict"), false);
  assert.equal(text.includes("proposeResourceConflictResolutions"), false);
});

test("86. Caller-input mutation safety", () => {
  const occupancies = overlapPair();
  const policy = basePolicy({
    candidateTimeWindows: [{ startMs: 500, endMs: 600 }],
    candidateCourtResources: [key(RESOURCE_KIND.COURT, "c9", SCOPE_TYPE.VENUE, "venue-1")],
  });
  const occSnap = JSON.stringify(occupancies);
  const policySnap = JSON.stringify(policy);
  const baseline = detectOverlap(occupancies);
  const baselineSnap = JSON.stringify(baseline);
  proposeResourceConflictResolutions({
    baselineDetectionResult: baseline,
    occupancies,
    resolutionPolicy: policy,
  });
  assert.equal(JSON.stringify(occupancies), occSnap);
  assert.equal(JSON.stringify(policy), policySnap);
  assert.equal(JSON.stringify(baseline), baselineSnap);
});
