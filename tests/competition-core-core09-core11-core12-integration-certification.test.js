/**
 * CORE-11 Phase 1I — CORE-09 -> CORE-11 -> CORE-12 end-to-end public-chain
 * certification. Tests and documentation only; no production orchestration
 * helper is introduced here.
 *
 * Imports ONLY from the public capability barrels:
 *   ../src/features/competition-core/match-generation/index.js
 *   ../src/features/competition-core/schedule-engine/index.js
 *   ../src/features/competition-core/integration/index.js
 *   ../src/features/competition-core/court-assignment/index.js
 * plus Node.js built-ins (node:test, node:assert/strict, node:fs, node:path,
 * node:url).
 *
 * Canonical success fixture (Owner-authorized):
 *   competitionId comp-1i-e2e-001, timezone Asia/Ho_Chi_Minh, 2026-08-01,
 *   operating+session window 08:00-18:00 (480-1080), scope
 *   tenant-1i/club-1i/venue-1i. m1 P1 vs P2, m2 P3 vs P4 (round 1),
 *   m3 P1 vs P5 (round 2). minParticipantRestMinutes 15, bufferMinutes 0,
 *   dependencyBufferMinutes 0, maxConcurrentMatches 2,
 *   defaultDurationMinutes 30. Expected baseline (Phase 1E-R1 rest-aware
 *   placement, see docs/competition-engine/core-11/09_PHASE_1I_BLOCKER_REST_AWARE_PLACEMENT.md):
 *   m1/m2 08:00-08:30 (480-510) concurrent, m3 08:45-09:15 (525-555).
 *   Two indoor courts court-a/court-b, MODEL_A availability snapshot.
 */

import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync, readdirSync, statSync, existsSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import {
  MATCH_GENERATION_STRATEGY,
  PARTICIPANT_SLOT_KIND,
  FORBIDDEN_MATCH_PLAN_FIELDS,
  createLogicalMatch,
  createParticipantSlot,
  assembleMatchPlan,
  fingerprintMatchPlan,
  assertMatchPlanValid,
  hasForbiddenSchedulingFields,
} from "../src/features/competition-core/match-generation/index.js";

import {
  PARTICIPANT_REFERENCE_KIND,
  SCHEDULE_DIAGNOSTIC_CODE,
  CONSTRAINT_CERTIFICATION,
  BASELINE_CANDIDATE_STATUS,
  CONSTRAINT_CERTIFICATION_RESULT_STATUS,
  createScheduleRequestFromMatchPlan,
  validateScheduleRequest,
  buildBaselineScheduleCandidate,
  certifyBaselineScheduleCandidateConstraints,
  fingerprintScheduleRequest,
  fingerprintBaselineScheduleCandidate,
  createScheduleRequest,
  createScheduleMatchInput,
  createSchedulePolicy,
  createScheduleParticipantReference,
  createScheduleDependency,
  createSchedulePlan,
  createScheduledMatch,
} from "../src/features/competition-core/schedule-engine/index.js";

import {
  COURT_ASSIGNMENT_STATUS,
  COURT_AVAILABILITY_STATUS,
  COURT_LOCK_SOURCE,
  fingerprintValue,
  validateCourtAssignmentRequest,
} from "../src/features/competition-core/court-assignment/index.js";

import {
  SCHEDULE_TO_COURT_ASSIGNMENT_HANDOFF_RESULT_STATUS,
  CERTIFIED_SCHEDULE_COURT_ASSIGNMENT_RESULT_STATUS,
  HANDOFF_DIAGNOSTIC_CODE,
  HANDOFF_AVAILABILITY_SNAPSHOT_TRUST_MODEL,
  createCourtAssignmentRequestFromCertifiedSchedule,
  assignCourtsFromCertifiedSchedule,
  fingerprintCourtAssignmentRequest,
} from "../src/features/competition-core/integration/index.js";

/* -------------------------------------------------------------------------- */
/* Path / source-scan helpers                                                 */
/* -------------------------------------------------------------------------- */

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const THIS_FILE = fileURLToPath(import.meta.url);
const MATCH_GENERATION_DIR = path.join(
  ROOT,
  "src/features/competition-core/match-generation"
);
const SCHEDULE_ENGINE_DIR = path.join(
  ROOT,
  "src/features/competition-core/schedule-engine"
);
const COURT_ASSIGNMENT_DIR = path.join(
  ROOT,
  "src/features/competition-core/court-assignment"
);
const INTEGRATION_DIR = path.join(
  ROOT,
  "src/features/competition-core/integration"
);

function toPosix(p) {
  return p.split(path.sep).join("/");
}

function listJsFiles(dir) {
  const out = [];
  if (!existsSync(dir)) return out;
  for (const name of readdirSync(dir)) {
    const full = path.join(dir, name);
    const st = statSync(full);
    if (st.isDirectory()) {
      out.push(...listJsFiles(full));
    } else if (name.endsWith(".js")) {
      out.push(full);
    }
  }
  return out;
}

function stripComments(text) {
  return text.replace(/\/\*[\s\S]*?\*\//g, "").replace(/(^|[^:])\/\/.*$/gm, "$1");
}

function importSpecifiers(src) {
  const specs = [];
  const re = /from\s+["']([^"']+)["']/g;
  let m;
  while ((m = re.exec(src))) specs.push(m[1]);
  return specs;
}

/* -------------------------------------------------------------------------- */
/* Canonical fixture helpers                                                  */
/* -------------------------------------------------------------------------- */

const TZ = "Asia/Ho_Chi_Minh";
const DATE = "2026-08-01";
const COMPETITION_ID = "comp-1i-e2e-001";
const SCOPE = { tenantId: "tenant-1i", clubId: "club-1i", venueId: "venue-1i" };

function direct(id) {
  return createParticipantSlot({
    kind: PARTICIPANT_SLOT_KIND.DIRECT_PARTICIPANT,
    participantId: id,
  });
}

function lm(partial = {}) {
  return createLogicalMatch({
    competitionId: COMPETITION_ID,
    divisionId: "div-1i",
    stageId: "stage-1i",
    roundNumber: 1,
    matchNumber: 1,
    participantSlotA: direct("P1"),
    participantSlotB: direct("P2"),
    ...partial,
  });
}

function canonicalLogicalMatches() {
  return [
    lm({
      roundNumber: 1,
      matchNumber: 1,
      deterministicOrder: 1,
      participantSlotA: direct("P1"),
      participantSlotB: direct("P2"),
    }),
    lm({
      roundNumber: 1,
      matchNumber: 2,
      deterministicOrder: 2,
      participantSlotA: direct("P3"),
      participantSlotB: direct("P4"),
    }),
    lm({
      roundNumber: 2,
      matchNumber: 3,
      deterministicOrder: 3,
      participantSlotA: direct("P1"),
      participantSlotB: direct("P5"),
    }),
  ];
}

function assemblePlan(matches, extra = {}) {
  return assembleMatchPlan({
    competitionId: COMPETITION_ID,
    divisionId: "div-1i",
    categoryId: null,
    stageId: "stage-1i",
    logicalMatches: matches,
    drawFingerprint: "draw-fp-1i",
    ruleEvaluationFingerprint: "rule-fp-1i",
    participantFingerprint: "part-fp-1i",
    strategy: MATCH_GENERATION_STRATEGY.SINGLE_ELIMINATION,
    validationSummary: { ok: true, issueCount: 0, issueCodes: [] },
    ...extra,
  });
}

function canonicalMatchPlan() {
  return assemblePlan(canonicalLogicalMatches());
}

function canonicalAdapterPolicy(overrides = {}) {
  return {
    timezone: TZ,
    operatingWindows: [{ date: DATE, startMinutes: 480, endMinutes: 1080 }],
    sessionWindows: [
      { sessionId: "sess-1i", date: DATE, startMinutes: 480, endMinutes: 1080 },
    ],
    defaultDurationMinutes: 30,
    bufferMinutes: 0,
    dependencyBufferMinutes: 0,
    minParticipantRestMinutes: 15,
    maxConcurrentMatches: 2,
    defaultDirectParticipantKind: PARTICIPANT_REFERENCE_KIND.PLAYER,
    ...overrides,
  };
}

function findBySuffix(rows, suffix) {
  return (rows || []).find((r) => String(r.matchId).endsWith(suffix));
}

/** Builds the full public chain from CORE-09 MatchPlan through Phase 1F
 * certification. Does not touch CORE-12. */
function buildCanonicalChain(overrides = {}) {
  const matchPlan = overrides.matchPlan || canonicalMatchPlan();
  const policy = overrides.policy || canonicalAdapterPolicy();
  const adapterResult = createScheduleRequestFromMatchPlan(matchPlan, policy);
  if (!adapterResult.ok) {
    return { matchPlan, policy, adapterResult };
  }
  const scheduleRequest = adapterResult.scheduleRequest;
  const candidate = buildBaselineScheduleCandidate(scheduleRequest);
  const certificationResult = certifyBaselineScheduleCandidateConstraints(
    scheduleRequest,
    candidate
  );
  return { matchPlan, policy, adapterResult, scheduleRequest, candidate, certificationResult };
}

function wideInterval() {
  return { start: `${DATE}T00:00:00.000Z`, end: `${DATE}T23:59:00.000Z` };
}

function canonicalCourts(overrides = {}) {
  return [
    {
      courtId: "court-a",
      tenantId: SCOPE.tenantId,
      clubId: SCOPE.clubId,
      venueId: SCOPE.venueId,
      availabilityStatus: COURT_AVAILABILITY_STATUS.AVAILABLE,
      active: true,
      eligible: true,
      priority: 1,
      capabilities: { indoor: true },
      availabilityIntervals: [wideInterval()],
      ...(overrides.a || {}),
    },
    {
      courtId: "court-b",
      tenantId: SCOPE.tenantId,
      clubId: SCOPE.clubId,
      venueId: SCOPE.venueId,
      availabilityStatus: COURT_AVAILABILITY_STATUS.AVAILABLE,
      active: true,
      eligible: true,
      priority: 2,
      capabilities: { indoor: true },
      availabilityIntervals: [wideInterval()],
      ...(overrides.b || {}),
    },
  ];
}

function availabilityRef(courts) {
  return {
    snapshotId: "avail-1i-e2e",
    snapshotVersion: "v1",
    fingerprint: fingerprintValue({
      courts: (courts || []).map((c) => ({
        courtId: c.courtId,
        intervals: c.availabilityIntervals,
      })),
    }),
  };
}

/** Full handoff input for the canonical certified chain + two indoor courts. */
function canonicalHandoffInput(chain, partial = {}) {
  const courts = partial.courts === undefined ? canonicalCourts() : partial.courts;
  return {
    scheduleRequest: chain.scheduleRequest,
    candidate: chain.candidate,
    certificationResult: chain.certificationResult,
    scope: partial.scope || { ...SCOPE },
    courts,
    availabilitySnapshotRef:
      partial.availabilitySnapshotRef === undefined
        ? availabilityRef(courts)
        : partial.availabilitySnapshotRef,
    courtAssignmentPolicy: partial.courtAssignmentPolicy,
    lockedAssignments: partial.lockedAssignments,
    courtRequirementsByMatchId: partial.courtRequirementsByMatchId,
    requestId: partial.requestId,
  };
}

function codesOf(result) {
  return (result.diagnostics || []).map((d) => d.code);
}

function deepEqualJson(a, b) {
  return JSON.stringify(a) === JSON.stringify(b);
}

/* -------------------------------------------------------------------------- */
/* 1I-S01..S06 — Stage A-F public success chain                               */
/* -------------------------------------------------------------------------- */

test("1I-S01 Stage A: MatchPlan valid, fingerprint stable, no forbidden fields", () => {
  const matchPlan = canonicalMatchPlan();
  const validation = assertMatchPlanValid(matchPlan, {
    strategy: MATCH_GENERATION_STRATEGY.SINGLE_ELIMINATION,
  });
  assert.equal(validation.ok, true, JSON.stringify(validation.issues));

  const fp = fingerprintMatchPlan(matchPlan, {
    strategy: MATCH_GENERATION_STRATEGY.SINGLE_ELIMINATION,
  });
  assert.equal(fp, matchPlan.generationFingerprint);
  assert.equal(typeof fp, "string");
  assert.ok(fp.length > 0);

  assert.equal(hasForbiddenSchedulingFields(matchPlan), false);
  for (const field of FORBIDDEN_MATCH_PLAN_FIELDS) {
    assert.equal(Object.prototype.hasOwnProperty.call(matchPlan, field), false, field);
  }
  assert.equal(matchPlan.logicalMatches.length, 3);
});

test("1I-S02 Stage B: CORE-09 -> CORE-11 adapter success", () => {
  const matchPlan = canonicalMatchPlan();
  const policy = canonicalAdapterPolicy();
  const before = JSON.stringify(matchPlan);
  const result = createScheduleRequestFromMatchPlan(matchPlan, policy);
  assert.equal(result.ok, true, JSON.stringify(result.diagnostics));
  assert.equal(result.scheduleRequest.competitionId, COMPETITION_ID);
  assert.equal(result.scheduleRequest.matches.length, 3);
  assert.equal(result.mappingSummary.mappedMatchCount, 3);
  assert.equal(JSON.stringify(matchPlan), before);
  assert.equal(
    result.replay.matchPlanFingerprint,
    fingerprintMatchPlan(matchPlan, { strategy: MATCH_GENERATION_STRATEGY.SINGLE_ELIMINATION })
  );
});

test("1I-S03 Stage C: adapted ScheduleRequest validates publicly", () => {
  const chain = buildCanonicalChain();
  assert.equal(chain.adapterResult.ok, true);
  const validation = validateScheduleRequest(chain.scheduleRequest);
  assert.equal(validation.ok, true, JSON.stringify(validation.diagnostics));
});

test("1I-S04 Stage D: baseline candidate BASELINE_ONLY with expected times", () => {
  const chain = buildCanonicalChain();
  const { candidate } = chain;
  assert.equal(candidate.status, BASELINE_CANDIDATE_STATUS);
  assert.equal(candidate.constraintCertification, CONSTRAINT_CERTIFICATION.BASELINE_ONLY);
  assert.equal(candidate.ok, true);
  assert.equal(candidate.plan.unscheduled.length, 0);

  const m1 = findBySuffix(candidate.plan.scheduled, "R:1M:1");
  const m2 = findBySuffix(candidate.plan.scheduled, "R:1M:2");
  const m3 = findBySuffix(candidate.plan.scheduled, "R:2M:3");
  assert.ok(m1 && m2 && m3);
  assert.equal(m1.start.minutesFromMidnight, 480);
  assert.equal(m1.end.minutesFromMidnight, 510);
  assert.equal(m2.start.minutesFromMidnight, 480);
  assert.equal(m2.end.minutesFromMidnight, 510);
  assert.equal(m3.start.minutesFromMidnight, 525);
  assert.equal(m3.end.minutesFromMidnight, 555);
});

test("1I-S05 Stage E: Phase 1F certification HARD_CONSTRAINTS_CERTIFIED with replay", () => {
  const chain = buildCanonicalChain();
  const { scheduleRequest, candidate, certificationResult } = chain;
  assert.equal(certificationResult.status, CONSTRAINT_CERTIFICATION_RESULT_STATUS);
  assert.equal(certificationResult.ok, true);
  assert.equal(
    certificationResult.certification,
    CONSTRAINT_CERTIFICATION.HARD_CONSTRAINTS_CERTIFIED
  );
  assert.equal(certificationResult.violations.length, 0);
  assert.equal(
    certificationResult.replay.inputFingerprint,
    fingerprintScheduleRequest(scheduleRequest)
  );
  assert.equal(
    certificationResult.replay.resultFingerprint,
    fingerprintBaselineScheduleCandidate(candidate)
  );
});

test("1I-S06 Stage F: handoff validates, SUCCESS assignment, no mutation, no lane-to-court leak", () => {
  const chain = buildCanonicalChain();
  const courts = canonicalCourts();
  const input = canonicalHandoffInput(chain, { courts });

  const beforeRequest = JSON.stringify(chain.scheduleRequest);
  const beforeCandidate = JSON.stringify(chain.candidate);
  const beforeCert = JSON.stringify(chain.certificationResult);
  const beforeCourts = JSON.stringify(courts);

  const handoff = createCourtAssignmentRequestFromCertifiedSchedule(input);
  assert.equal(handoff.ok, true, JSON.stringify(handoff.diagnostics));
  assert.equal(handoff.status, SCHEDULE_TO_COURT_ASSIGNMENT_HANDOFF_RESULT_STATUS);

  const cavalidation = validateCourtAssignmentRequest(handoff.courtAssignmentRequest);
  assert.equal(cavalidation.ok, true, JSON.stringify(cavalidation));

  // No physical/abstract leak onto the candidate rows used for the handoff.
  for (const s of chain.candidate.plan.scheduled) {
    assert.equal(Object.prototype.hasOwnProperty.call(s, "courtId"), false);
    assert.notEqual(String(s.concurrencyIndex), "court-a");
    assert.notEqual(String(s.concurrencyIndex), "court-b");
  }
  const m1Row = findBySuffix(chain.candidate.plan.scheduled, "R:1M:1");
  assert.notEqual(m1Row.capacityReleaseUtcMs, undefined);

  // Mapped matches never expose the abstract lane / capacity-release fields,
  // and scheduledEnd is sourced from the certified end, never capacityRelease.
  const mapped1 = handoff.courtAssignmentRequest.matches.find((m) =>
    m.matchId.endsWith("R:1M:1")
  );
  assert.equal(mapped1.scheduledEnd, m1Row.endUtcIso);
  assert.equal(Object.prototype.hasOwnProperty.call(mapped1, "concurrencyIndex"), false);
  assert.equal(Object.prototype.hasOwnProperty.call(mapped1, "capacityReleaseUtcMs"), false);
  assert.equal(Object.prototype.hasOwnProperty.call(mapped1, "sessionId"), false);
  assert.equal(mapped1.courtId, undefined);

  const result = assignCourtsFromCertifiedSchedule(input);
  assert.equal(result.ok, true, JSON.stringify(result.diagnostics));
  assert.equal(result.status, CERTIFIED_SCHEDULE_COURT_ASSIGNMENT_RESULT_STATUS);
  assert.equal(result.courtAssignmentResult.status, COURT_ASSIGNMENT_STATUS.SUCCESS);
  assert.equal(result.courtAssignmentResult.assignments.length, 3);
  assert.equal(result.courtAssignmentResult.unassigned.length, 0);
  assert.ok(result.replay.courtAssignmentResultFingerprint);
  assert.equal(
    result.replay.courtAssignmentResultFingerprint,
    result.courtAssignmentResult.resultFingerprint
  );

  // No-mutation via JSON snapshots across the whole Stage F call.
  assert.equal(JSON.stringify(chain.scheduleRequest), beforeRequest);
  assert.equal(JSON.stringify(chain.candidate), beforeCandidate);
  assert.equal(JSON.stringify(chain.certificationResult), beforeCert);
  assert.equal(JSON.stringify(courts), beforeCourts);
});

/* -------------------------------------------------------------------------- */
/* 1I-S07 — abstract-pass, physical-fail with a single court                  */
/* -------------------------------------------------------------------------- */

test("1I-S07 abstract-pass physical-fail: one court cannot cover all matches", () => {
  const chain = buildCanonicalChain();
  const m1 = findBySuffix(chain.candidate.plan.scheduled, "R:1M:1");
  const m2 = findBySuffix(chain.candidate.plan.scheduled, "R:1M:2");
  // Single court only covers the m1/m2 window; m3 (08:45-09:15) is uncovered.
  const narrowCourt = {
    courtId: "court-a",
    tenantId: SCOPE.tenantId,
    clubId: SCOPE.clubId,
    venueId: SCOPE.venueId,
    availabilityStatus: COURT_AVAILABILITY_STATUS.AVAILABLE,
    active: true,
    eligible: true,
    priority: 1,
    capabilities: { indoor: true },
    availabilityIntervals: [{ start: m1.startUtcIso, end: m2.endUtcIso }],
  };
  const courts = [narrowCourt];
  const input = canonicalHandoffInput(chain, { courts });

  const result = assignCourtsFromCertifiedSchedule(input);
  assert.equal(result.ok, false);
  assert.equal(result.courtAssignmentResult.status, COURT_ASSIGNMENT_STATUS.INFEASIBLE);
  assert.ok(codesOf(result).includes(HANDOFF_DIAGNOSTIC_CODE.COURT_ASSIGNMENT_INFEASIBLE));

  // Baseline times are unchanged and Phase 1F certification is unaffected.
  const m1After = findBySuffix(chain.candidate.plan.scheduled, "R:1M:1");
  const m3After = findBySuffix(chain.candidate.plan.scheduled, "R:2M:3");
  assert.equal(m1After.start.minutesFromMidnight, 480);
  assert.equal(m3After.start.minutesFromMidnight, 525);
  assert.equal(
    chain.certificationResult.certification,
    CONSTRAINT_CERTIFICATION.HARD_CONSTRAINTS_CERTIFIED
  );
});

/* -------------------------------------------------------------------------- */
/* 1I-F01..F05 — CORE-09 adapter failure matrix                               */
/* -------------------------------------------------------------------------- */

test("1I-F01 invalid MatchPlan rejected by adapter", () => {
  const result = createScheduleRequestFromMatchPlan(
    { competitionId: COMPETITION_ID, logicalMatches: "not-an-array" },
    canonicalAdapterPolicy()
  );
  assert.equal(result.ok, false);
  assert.equal(result.scheduleRequest, null);
  assert.ok(codesOf(result).includes(SCHEDULE_DIAGNOSTIC_CODE.MATCH_PLAN_INVALID));
});

test("1I-F02 missing participant identity enrichment rejected", () => {
  const matchPlan = canonicalMatchPlan();
  const result = createScheduleRequestFromMatchPlan(
    matchPlan,
    canonicalAdapterPolicy({ defaultDirectParticipantKind: undefined })
  );
  assert.equal(result.ok, false);
  assert.ok(
    codesOf(result).includes(
      SCHEDULE_DIAGNOSTIC_CODE.MATCH_PLAN_PARTICIPANT_IDENTITY_MISSING
    )
  );
});

test("1I-F03 UNRESOLVED_PLACEMENT without placementIdentityByRef rejected", () => {
  const placement = lm({
    matchNumber: 1,
    participantSlotA: createParticipantSlot({
      kind: PARTICIPANT_SLOT_KIND.UNRESOLVED_PLACEMENT,
      placementRef: "draw:seed:1i",
    }),
    participantSlotB: direct("opp-1i"),
  });
  const matchPlan = assemblePlan([placement]);
  const result = createScheduleRequestFromMatchPlan(matchPlan, canonicalAdapterPolicy());
  assert.equal(result.ok, false);
  assert.ok(
    codesOf(result).includes(SCHEDULE_DIAGNOSTIC_CODE.PLACEMENT_IDENTITY_MISSING)
  );

  // Resolving the placement identity fixes it (documents the enum exists and works).
  const resolved = createScheduleRequestFromMatchPlan(
    matchPlan,
    canonicalAdapterPolicy({
      placementIdentityByRef: {
        "draw:seed:1i": { participantId: "seeded-1i", kind: PARTICIPANT_REFERENCE_KIND.PLAYER },
      },
    })
  );
  assert.equal(resolved.ok, true, codesOf(resolved).join(","));
});

test("1I-F04 winnerTo dependency without matching incoming dependency rejected", () => {
  const target = lm({
    matchNumber: 9,
    roundNumber: 2,
    bracketId: "x-1i",
    deterministicOrder: 9,
    participantSlotA: direct("px"),
    participantSlotB: direct("py"),
  });
  // winnerTo points at `target`, but `target` has no dependencyInputs
  // referencing this match back — an incoming/outgoing contradiction.
  const sourceWithWinnerTo = lm({
    matchNumber: 8,
    deterministicOrder: 8,
    participantSlotA: direct("pa"),
    participantSlotB: direct("pb"),
    winnerTo: {
      type: "WINNER_OF",
      logicalMatchKey: target.logicalMatchKey,
    },
  });
  const matchPlan = assemblePlan([sourceWithWinnerTo, target]);
  const result = createScheduleRequestFromMatchPlan(matchPlan, canonicalAdapterPolicy());
  assert.equal(result.ok, false);
  assert.ok(
    codesOf(result).includes(
      SCHEDULE_DIAGNOSTIC_CODE.MATCH_PLAN_DEPENDENCY_INCONSISTENT
    ) || codesOf(result).includes(SCHEDULE_DIAGNOSTIC_CODE.MATCH_PLAN_INVALID)
  );
});

test("1I-F05 tampered generationFingerprint (deadbeef) rejected", () => {
  const matchPlan = structuredClone(canonicalMatchPlan());
  matchPlan.generationFingerprint = "deadbeef";
  const result = createScheduleRequestFromMatchPlan(matchPlan, canonicalAdapterPolicy());
  assert.equal(result.ok, false);
  assert.equal(result.scheduleRequest, null);
  const diag = result.diagnostics.find((d) => d.path === "generationFingerprint");
  assert.ok(diag);
});

/* -------------------------------------------------------------------------- */
/* 1I-F06..F14 — CORE-11 failure matrix                                       */
/* -------------------------------------------------------------------------- */

test("1I-F06 empty timezone rejected", () => {
  const matchPlan = canonicalMatchPlan();
  const result = createScheduleRequestFromMatchPlan(
    matchPlan,
    canonicalAdapterPolicy({ timezone: "" })
  );
  assert.equal(result.ok, false);
});

test("1I-F07 missing defaultDurationMinutes rejected", () => {
  const matchPlan = canonicalMatchPlan();
  const result = createScheduleRequestFromMatchPlan(
    matchPlan,
    canonicalAdapterPolicy({ defaultDurationMinutes: undefined })
  );
  assert.equal(result.ok, false);
});

test("1I-F08 dependency cycle detected via direct createScheduleRequest", () => {
  const p = (id) => createScheduleParticipantReference({ participantId: id });
  const request = createScheduleRequest({
    competitionId: "comp-1i-cycle",
    timezone: TZ,
    policy: createSchedulePolicy({
      duration: { defaultDurationMinutes: 30, bufferMinutes: 0 },
      rest: { minParticipantRestMinutes: 0, minTeamRestMinutes: 0 },
      capacity: { maxConcurrentMatches: 2 },
    }),
    operatingWindows: [{ date: DATE, startMinutes: 480, endMinutes: 1080 }],
    matches: [
      createScheduleMatchInput({
        matchId: "cyc-a",
        participants: [p("ca1"), p("ca2")],
        dependencies: [createScheduleDependency({ sourceMatchId: "cyc-b" })],
      }),
      createScheduleMatchInput({
        matchId: "cyc-b",
        participants: [p("cb1"), p("cb2")],
        dependencies: [createScheduleDependency({ sourceMatchId: "cyc-a" })],
      }),
    ],
  });
  const validation = validateScheduleRequest(request);
  assert.equal(validation.ok, true, JSON.stringify(validation.diagnostics));

  const candidate = buildBaselineScheduleCandidate(request);
  assert.equal(candidate.ok, false);
  assert.equal(candidate.plan.scheduled.length, 0);
  assert.equal(candidate.plan.unscheduled.length, 2);
});

test("1I-F09 forged PARTICIPANT_OVERLAP rejected at certification", () => {
  const chain = buildCanonicalChain();
  const m1 = findBySuffix(chain.candidate.plan.scheduled, "R:1M:1");
  const m3 = findBySuffix(chain.candidate.plan.scheduled, "R:2M:3");
  const forgedPlan = createSchedulePlan({
    ...chain.candidate.plan,
    scheduled: chain.candidate.plan.scheduled.map((s) =>
      s.matchId === m3.matchId
        ? {
            ...s,
            start: { ...m1.start },
            end: { ...m1.end },
            startUtcMs: m1.startUtcMs,
            endUtcMs: m1.endUtcMs,
            capacityReleaseUtcMs: m1.capacityReleaseUtcMs,
            durationMinutes: m1.durationMinutes,
            bufferMinutes: m1.bufferMinutes,
            concurrencyIndex: 1,
            abstractSlotIndex: 1,
          }
        : s
    ),
  });
  const forgedCandidate = {
    ...chain.candidate,
    plan: forgedPlan,
    status: BASELINE_CANDIDATE_STATUS,
    constraintCertification: CONSTRAINT_CERTIFICATION.BASELINE_ONLY,
  };
  const result = certifyBaselineScheduleCandidateConstraints(
    chain.scheduleRequest,
    forgedCandidate
  );
  assert.equal(result.ok, false);
  assert.ok(codesOf(result).includes(SCHEDULE_DIAGNOSTIC_CODE.PARTICIPANT_OVERLAP));
});

test("1I-F10 forged INSUFFICIENT_REST rejected at certification", () => {
  const chain = buildCanonicalChain();
  const m1 = findBySuffix(chain.candidate.plan.scheduled, "R:1M:1");
  const m3 = findBySuffix(chain.candidate.plan.scheduled, "R:2M:3");
  // Move m3 to start exactly at m1.end (zero rest for shared participant P1).
  const forgedPlan = createSchedulePlan({
    ...chain.candidate.plan,
    scheduled: chain.candidate.plan.scheduled.map((s) => {
      if (s.matchId !== m3.matchId) return s;
      return {
        ...s,
        start: { date: m1.end.date, minutesFromMidnight: m1.end.minutesFromMidnight },
        end: {
          date: m1.end.date,
          minutesFromMidnight: m1.end.minutesFromMidnight + 30,
        },
        startUtcMs: m1.endUtcMs,
        endUtcMs: m1.endUtcMs + 30 * 60_000,
        capacityReleaseUtcMs: m1.endUtcMs + 30 * 60_000,
        durationMinutes: 30,
        bufferMinutes: 0,
      };
    }),
  });
  const forgedCandidate = {
    ...chain.candidate,
    plan: forgedPlan,
    status: BASELINE_CANDIDATE_STATUS,
    constraintCertification: CONSTRAINT_CERTIFICATION.BASELINE_ONLY,
  };
  const result = certifyBaselineScheduleCandidateConstraints(
    chain.scheduleRequest,
    forgedCandidate
  );
  assert.equal(result.ok, false);
  assert.ok(codesOf(result).includes(SCHEDULE_DIAGNOSTIC_CODE.INSUFFICIENT_REST));
});

test("1I-F11 forged CAPACITY_EXCEEDED rejected at certification", () => {
  const chain = buildCanonicalChain({
    policy: canonicalAdapterPolicy({ maxConcurrentMatches: 1 }),
  });
  assert.equal(chain.adapterResult.ok, true);
  const m1 = findBySuffix(chain.candidate.plan.scheduled, "R:1M:1");
  const m2 = findBySuffix(chain.candidate.plan.scheduled, "R:1M:2");
  const forgedPlan = createSchedulePlan({
    ...chain.candidate.plan,
    scheduled: chain.candidate.plan.scheduled.map((s) =>
      s.matchId === m2.matchId
        ? {
            ...s,
            start: { ...m1.start },
            end: { ...m1.end },
            startUtcMs: m1.startUtcMs,
            endUtcMs: m1.endUtcMs,
            capacityReleaseUtcMs: m1.capacityReleaseUtcMs,
            concurrencyIndex: 0,
            abstractSlotIndex: 0,
            durationMinutes: m1.durationMinutes,
            bufferMinutes: m1.bufferMinutes,
          }
        : s
    ),
  });
  const forgedCandidate = {
    ...chain.candidate,
    plan: forgedPlan,
    status: BASELINE_CANDIDATE_STATUS,
    constraintCertification: CONSTRAINT_CERTIFICATION.BASELINE_ONLY,
  };
  const result = certifyBaselineScheduleCandidateConstraints(
    chain.scheduleRequest,
    forgedCandidate
  );
  assert.equal(result.ok, false);
  assert.ok(codesOf(result).includes(SCHEDULE_DIAGNOSTIC_CODE.CAPACITY_EXCEEDED));
});

test("1I-F12 tiny operating window leaves matches unscheduled", () => {
  const matchPlan = canonicalMatchPlan();
  const policy = canonicalAdapterPolicy({
    operatingWindows: [{ date: DATE, startMinutes: 480, endMinutes: 500 }],
    sessionWindows: [{ sessionId: "sess-tiny", date: DATE, startMinutes: 480, endMinutes: 500 }],
  });
  const adapterResult = createScheduleRequestFromMatchPlan(matchPlan, policy);
  assert.equal(adapterResult.ok, true);
  const candidate = buildBaselineScheduleCandidate(adapterResult.scheduleRequest);
  assert.equal(candidate.ok, false);
  assert.ok(candidate.plan.unscheduled.length > 0);
});

test("1I-F13 certification replay fingerprint swap fails handoff", () => {
  const chain = buildCanonicalChain();
  const liveReq = fingerprintScheduleRequest(chain.scheduleRequest);
  const liveCand = fingerprintBaselineScheduleCandidate(chain.candidate);
  const swapped = {
    ...chain.certificationResult,
    replay: {
      ...chain.certificationResult.replay,
      inputFingerprint: liveCand,
      resultFingerprint: liveReq,
    },
  };
  const courts = canonicalCourts();
  const result = createCourtAssignmentRequestFromCertifiedSchedule({
    scheduleRequest: chain.scheduleRequest,
    candidate: chain.candidate,
    certificationResult: swapped,
    scope: { ...SCOPE },
    courts,
    availabilitySnapshotRef: availabilityRef(courts),
  });
  assert.equal(result.ok, false);
  assert.ok(
    codesOf(result).includes(HANDOFF_DIAGNOSTIC_CODE.SCHEDULE_CERTIFICATION_MISMATCH)
  );
});

test("1I-F14 candidate time tamper without replay update fails handoff", () => {
  const chain = buildCanonicalChain();
  const tamperedCandidate = {
    ...chain.candidate,
    plan: createSchedulePlan({
      ...chain.candidate.plan,
      scheduled: chain.candidate.plan.scheduled.map((s) => ({
        ...s,
        durationMinutes: (s.durationMinutes || 30) + 1,
      })),
    }),
  };
  const courts = canonicalCourts();
  const result = createCourtAssignmentRequestFromCertifiedSchedule({
    scheduleRequest: chain.scheduleRequest,
    candidate: tamperedCandidate,
    certificationResult: chain.certificationResult,
    scope: { ...SCOPE },
    courts,
    availabilitySnapshotRef: availabilityRef(courts),
  });
  assert.equal(result.ok, false);
});

/* -------------------------------------------------------------------------- */
/* 1I-F15..F23 — integration (Phase 1H-B) failure matrix                      */
/* -------------------------------------------------------------------------- */

test("1I-F15 empty scope.tenantId -> COURT_SCOPE_MISSING", () => {
  const chain = buildCanonicalChain();
  const input = canonicalHandoffInput(chain, { scope: { ...SCOPE, tenantId: "" } });
  const result = createCourtAssignmentRequestFromCertifiedSchedule(input);
  assert.equal(result.ok, false);
  assert.ok(codesOf(result).includes(HANDOFF_DIAGNOSTIC_CODE.COURT_SCOPE_MISSING));
});

test("1I-F16 empty scope.clubId -> COURT_SCOPE_MISSING", () => {
  const chain = buildCanonicalChain();
  const input = canonicalHandoffInput(chain, { scope: { ...SCOPE, clubId: "  " } });
  const result = createCourtAssignmentRequestFromCertifiedSchedule(input);
  assert.equal(result.ok, false);
  assert.ok(codesOf(result).includes(HANDOFF_DIAGNOSTIC_CODE.COURT_SCOPE_MISSING));
});

test("1I-F17 empty scope.venueId -> COURT_SCOPE_MISSING", () => {
  const chain = buildCanonicalChain();
  const input = canonicalHandoffInput(chain, { scope: { ...SCOPE, venueId: "" } });
  const result = createCourtAssignmentRequestFromCertifiedSchedule(input);
  assert.equal(result.ok, false);
  assert.ok(codesOf(result).includes(HANDOFF_DIAGNOSTIC_CODE.COURT_SCOPE_MISSING));
});

test("1I-F18 empty courts array -> COURT_SNAPSHOT_MISSING", () => {
  const chain = buildCanonicalChain();
  const input = canonicalHandoffInput(chain, { courts: [] });
  const result = createCourtAssignmentRequestFromCertifiedSchedule(input);
  assert.equal(result.ok, false);
  assert.ok(codesOf(result).includes(HANDOFF_DIAGNOSTIC_CODE.COURT_SNAPSHOT_MISSING));
});

test("1I-F19 omitted availabilitySnapshotRef -> AVAILABILITY_SNAPSHOT_MISSING", () => {
  const chain = buildCanonicalChain();
  const input = canonicalHandoffInput(chain, { availabilitySnapshotRef: null });
  delete input.availabilitySnapshotRef;
  const result = createCourtAssignmentRequestFromCertifiedSchedule(input);
  assert.equal(result.ok, false);
  assert.ok(
    codesOf(result).includes(HANDOFF_DIAGNOSTIC_CODE.AVAILABILITY_SNAPSHOT_MISSING)
  );
});

test("1I-F20 scheduled bye forged into candidate -> MATCH_MAPPING_INVALID", () => {
  const chain = buildCanonicalChain();
  const m1 = findBySuffix(chain.candidate.plan.scheduled, "R:1M:1");
  const forgedCandidate = {
    ...chain.candidate,
    plan: createSchedulePlan({
      ...chain.candidate.plan,
      scheduled: [
        ...chain.candidate.plan.scheduled,
        createScheduledMatch({ ...m1, matchId: "forged-bye-1i" }),
      ],
    }),
  };
  const liveReq = fingerprintScheduleRequest(chain.scheduleRequest);
  const liveCand = fingerprintBaselineScheduleCandidate(forgedCandidate);
  const courts = canonicalCourts();
  const result = createCourtAssignmentRequestFromCertifiedSchedule({
    scheduleRequest: chain.scheduleRequest,
    candidate: forgedCandidate,
    certificationResult: {
      ...chain.certificationResult,
      replay: { ...chain.certificationResult.replay, inputFingerprint: liveReq, resultFingerprint: liveCand },
    },
    scope: { ...SCOPE },
    courts,
    availabilitySnapshotRef: availabilityRef(courts),
  });
  assert.equal(result.ok, false);
  // Either fails at completeness gate (unknown matchId) — both are valid earliest fails.
  assert.ok(
    codesOf(result).includes(HANDOFF_DIAGNOSTIC_CODE.SCHEDULE_CANDIDATE_INCOMPLETE) ||
      codesOf(result).includes(HANDOFF_DIAGNOSTIC_CODE.MATCH_MAPPING_INVALID)
  );
});

test("1I-F21 courtId present on candidate scheduled rows -> PHYSICAL_ASSIGNMENT_FIELD_PRESENT", () => {
  const chain = buildCanonicalChain();
  const tampered = {
    ...chain.candidate,
    plan: {
      ...chain.candidate.plan,
      scheduled: chain.candidate.plan.scheduled.map((s) => ({
        ...s,
        courtId: "court-from-schedule-1i",
      })),
    },
  };
  const input = canonicalHandoffInput(chain);
  const result = createCourtAssignmentRequestFromCertifiedSchedule({
    ...input,
    candidate: tampered,
  });
  assert.equal(result.ok, false);
  assert.ok(
    codesOf(result).includes(HANDOFF_DIAGNOSTIC_CODE.PHYSICAL_ASSIGNMENT_FIELD_PRESENT)
  );
});

test("1I-F22 partialAssignmentAllowed=true rejected by certified handoff policy", () => {
  const chain = buildCanonicalChain();
  const input = canonicalHandoffInput(chain, {
    courtAssignmentPolicy: { partialAssignmentAllowed: true },
  });
  const result = createCourtAssignmentRequestFromCertifiedSchedule(input);
  assert.equal(result.ok, false);
  assert.ok(
    codesOf(result).includes(HANDOFF_DIAGNOSTIC_CODE.COURT_ASSIGNMENT_POLICY_INVALID)
  );
});

test("1I-F23 empty availability snapshot fingerprint -> AVAILABILITY_SNAPSHOT_INVALID", () => {
  const chain = buildCanonicalChain();
  const input = canonicalHandoffInput(chain, {
    availabilitySnapshotRef: { snapshotId: "avail-1i", snapshotVersion: "v1", fingerprint: "" },
  });
  const result = createCourtAssignmentRequestFromCertifiedSchedule(input);
  assert.equal(result.ok, false);
  assert.ok(
    codesOf(result).includes(HANDOFF_DIAGNOSTIC_CODE.AVAILABILITY_SNAPSHOT_INVALID)
  );
});

/* -------------------------------------------------------------------------- */
/* 1I-F24..F32 — CORE-12 failure matrix                                       */
/* -------------------------------------------------------------------------- */

test("1I-F24 single court cannot cover all matches -> COURT_ASSIGNMENT_INFEASIBLE", () => {
  const chain = buildCanonicalChain();
  const m1 = findBySuffix(chain.candidate.plan.scheduled, "R:1M:1");
  const m2 = findBySuffix(chain.candidate.plan.scheduled, "R:1M:2");
  const courts = [
    {
      courtId: "court-a",
      tenantId: SCOPE.tenantId,
      clubId: SCOPE.clubId,
      venueId: SCOPE.venueId,
      availabilityStatus: COURT_AVAILABILITY_STATUS.AVAILABLE,
      active: true,
      eligible: true,
      priority: 1,
      capabilities: { indoor: true },
      availabilityIntervals: [{ start: m1.startUtcIso, end: m2.endUtcIso }],
    },
  ];
  const input = canonicalHandoffInput(chain, { courts });
  const result = assignCourtsFromCertifiedSchedule(input);
  assert.equal(result.ok, false);
  assert.equal(result.courtAssignmentResult.status, COURT_ASSIGNMENT_STATUS.INFEASIBLE);
  assert.ok(codesOf(result).includes(HANDOFF_DIAGNOSTIC_CODE.COURT_ASSIGNMENT_INFEASIBLE));
});

test("1I-F25 court venueId mismatch -> COURT_SCOPE_MISMATCH", () => {
  const chain = buildCanonicalChain();
  const courts = canonicalCourts({ a: { venueId: "other-venue-1i" } });
  const input = canonicalHandoffInput(chain, { courts });
  const result = createCourtAssignmentRequestFromCertifiedSchedule(input);
  assert.equal(result.ok, false);
  assert.ok(codesOf(result).includes(HANDOFF_DIAGNOSTIC_CODE.COURT_SCOPE_MISMATCH));
});

test("1I-F26 outdoor-only courts + indoor requirement -> INFEASIBLE (capability mismatch)", () => {
  const chain = buildCanonicalChain();
  const courts = canonicalCourts({
    a: { capabilities: { outdoor: true } },
    b: { capabilities: { outdoor: true } },
  });
  const m1Id = findBySuffix(chain.scheduleRequest.matches, "R:1M:1").matchId;
  const input = canonicalHandoffInput(chain, {
    courts,
    courtRequirementsByMatchId: { [m1Id]: ["indoor"] },
  });
  const result = assignCourtsFromCertifiedSchedule(input);
  assert.equal(result.ok, false);
  assert.equal(result.courtAssignmentResult.status, COURT_ASSIGNMENT_STATUS.INFEASIBLE);
  const unassignedIds = result.courtAssignmentResult.unassigned.map((u) => u.matchId);
  assert.ok(unassignedIds.includes(m1Id));
});

test("1I-F27 duplicate locked assignment for same match -> DUPLICATE_LOCK", () => {
  const chain = buildCanonicalChain();
  const courts = canonicalCourts();
  const m1Id = findBySuffix(chain.scheduleRequest.matches, "R:1M:1").matchId;
  const input = canonicalHandoffInput(chain, {
    courts,
    lockedAssignments: [
      { matchId: m1Id, courtId: "court-a", lockSource: COURT_LOCK_SOURCE.MANUAL },
      { matchId: m1Id, courtId: "court-b", lockSource: COURT_LOCK_SOURCE.MANUAL },
    ],
  });
  const result = createCourtAssignmentRequestFromCertifiedSchedule(input);
  assert.equal(result.ok, false);
  assert.ok(codesOf(result).includes(HANDOFF_DIAGNOSTIC_CODE.DUPLICATE_LOCK));
});

test("1I-F28 partial court-assignment policy invalid -> COURT_ASSIGNMENT_POLICY_INVALID", () => {
  const chain = buildCanonicalChain();
  const input = canonicalHandoffInput(chain, {
    courtAssignmentPolicy: { acceptLockedAssignments: false },
  });
  const result = createCourtAssignmentRequestFromCertifiedSchedule(input);
  assert.equal(result.ok, false);
  assert.ok(
    codesOf(result).includes(HANDOFF_DIAGNOSTIC_CODE.COURT_ASSIGNMENT_POLICY_INVALID)
  );
});

test("1I-F29 empty courtId in court snapshot -> COURT_SNAPSHOT_INVALID", () => {
  const chain = buildCanonicalChain();
  const courts = canonicalCourts({ a: { courtId: "" } });
  const input = canonicalHandoffInput(chain, { courts });
  const result = createCourtAssignmentRequestFromCertifiedSchedule(input);
  assert.equal(result.ok, false);
  assert.ok(codesOf(result).includes(HANDOFF_DIAGNOSTIC_CODE.COURT_SNAPSHOT_INVALID));
});

test("1I-F30 result fingerprint type boundary", () => {
  const chain = buildCanonicalChain();
  const input = canonicalHandoffInput(chain);
  const result = assignCourtsFromCertifiedSchedule(input);
  assert.equal(result.ok, true);
  assert.equal(typeof result.courtAssignmentResult.resultFingerprint, "string");
  assert.ok(result.courtAssignmentResult.resultFingerprint.length > 0);
  assert.equal(typeof result.replay.courtAssignmentRequestFingerprint, "string");
  assert.notEqual(
    result.replay.courtAssignmentRequestFingerprint,
    result.courtAssignmentResult.resultFingerprint
  );
});

test("1I-F31 SUCCESS assignment does not mutate certified times", () => {
  const chain = buildCanonicalChain();
  const input = canonicalHandoffInput(chain);
  const beforePlan = JSON.stringify(chain.candidate.plan);
  const beforeTimes = chain.candidate.plan.scheduled.map((s) => ({
    id: s.matchId,
    start: s.startUtcIso,
    end: s.endUtcIso,
  }));
  const result = assignCourtsFromCertifiedSchedule(input);
  assert.equal(result.ok, true);
  assert.equal(JSON.stringify(chain.candidate.plan), beforePlan);
  for (const t of beforeTimes) {
    const slot = result.courtAssignmentResult.assignments.find((a) => a.matchId === t.id);
    assert.ok(slot);
    assert.equal(slot.scheduledStart, t.start);
    assert.equal(slot.scheduledEnd, t.end);
  }
});

test("1I-F32 duplicate courtId in court snapshot -> DUPLICATE_COURT_ID", () => {
  const chain = buildCanonicalChain();
  const courts = canonicalCourts({ b: { courtId: "court-a" } });
  const input = canonicalHandoffInput(chain, { courts });
  const result = createCourtAssignmentRequestFromCertifiedSchedule(input);
  assert.equal(result.ok, false);
  assert.ok(codesOf(result).includes(HANDOFF_DIAGNOSTIC_CODE.DUPLICATE_COURT_ID));
});

/* -------------------------------------------------------------------------- */
/* 1I-D01..D06 — determinism / order-independence                            */
/* -------------------------------------------------------------------------- */

test("1I-D01 reversed LogicalMatch order -> identical MatchPlan fingerprint", () => {
  const forward = assemblePlan(canonicalLogicalMatches());
  const reversed = assemblePlan([...canonicalLogicalMatches()].reverse());
  assert.equal(
    fingerprintMatchPlan(forward, { strategy: MATCH_GENERATION_STRATEGY.SINGLE_ELIMINATION }),
    fingerprintMatchPlan(reversed, { strategy: MATCH_GENERATION_STRATEGY.SINGLE_ELIMINATION })
  );
});

test("1I-D02 reversed MatchPlan order -> identical adapted ScheduleRequest fingerprint", () => {
  const forward = createScheduleRequestFromMatchPlan(
    assemblePlan(canonicalLogicalMatches()),
    canonicalAdapterPolicy()
  );
  const reversed = createScheduleRequestFromMatchPlan(
    assemblePlan([...canonicalLogicalMatches()].reverse()),
    canonicalAdapterPolicy()
  );
  assert.equal(forward.ok, true);
  assert.equal(reversed.ok, true);
  assert.equal(
    fingerprintScheduleRequest(forward.scheduleRequest),
    fingerprintScheduleRequest(reversed.scheduleRequest)
  );
});

test("1I-D03 reversed MatchPlan order -> identical baseline candidate and certification", () => {
  const forwardChain = buildCanonicalChain({ matchPlan: assemblePlan(canonicalLogicalMatches()) });
  const reversedChain = buildCanonicalChain({
    matchPlan: assemblePlan([...canonicalLogicalMatches()].reverse()),
  });
  assert.equal(
    fingerprintBaselineScheduleCandidate(forwardChain.candidate),
    fingerprintBaselineScheduleCandidate(reversedChain.candidate)
  );
  assert.equal(
    forwardChain.certificationResult.certification,
    reversedChain.certificationResult.certification
  );
  assert.equal(
    forwardChain.certificationResult.replay.resultFingerprint,
    reversedChain.certificationResult.replay.resultFingerprint
  );
});

test("1I-D04 reversed courts array -> identical CourtAssignmentRequest fingerprint and SUCCESS", () => {
  const chain = buildCanonicalChain();
  const courtsA = canonicalCourts();
  const courtsB = [...courtsA].reverse();
  const a = createCourtAssignmentRequestFromCertifiedSchedule(
    canonicalHandoffInput(chain, { courts: courtsA })
  );
  const b = createCourtAssignmentRequestFromCertifiedSchedule(
    canonicalHandoffInput(chain, { courts: courtsB, availabilitySnapshotRef: availabilityRef(courtsA) })
  );
  assert.equal(a.ok, true);
  assert.equal(b.ok, true);
  assert.equal(
    a.replay.courtAssignmentRequestFingerprint,
    b.replay.courtAssignmentRequestFingerprint
  );
  assert.equal(a.courtAssignmentRequest.requestId, b.courtAssignmentRequest.requestId);

  const resultA = assignCourtsFromCertifiedSchedule(canonicalHandoffInput(chain, { courts: courtsA }));
  const resultB = assignCourtsFromCertifiedSchedule(
    canonicalHandoffInput(chain, { courts: courtsB, availabilitySnapshotRef: availabilityRef(courtsA) })
  );
  assert.equal(resultA.ok, true);
  assert.equal(resultB.ok, true);
  assert.equal(resultA.courtAssignmentResult.status, COURT_ASSIGNMENT_STATUS.SUCCESS);
  assert.equal(resultB.courtAssignmentResult.status, COURT_ASSIGNMENT_STATUS.SUCCESS);
});

test("1I-D05 changing defaultDurationMinutes to 45 changes ScheduleRequest fingerprint", () => {
  const base = createScheduleRequestFromMatchPlan(canonicalMatchPlan(), canonicalAdapterPolicy());
  const changed = createScheduleRequestFromMatchPlan(
    canonicalMatchPlan(),
    canonicalAdapterPolicy({ defaultDurationMinutes: 45 })
  );
  assert.equal(base.ok, true);
  assert.equal(changed.ok, true);
  assert.notEqual(
    fingerprintScheduleRequest(base.scheduleRequest),
    fingerprintScheduleRequest(changed.scheduleRequest)
  );
});

test("1I-D06 reversed courts array -> semantically identical assignment mapping", () => {
  const chain = buildCanonicalChain();
  const courtsA = canonicalCourts();
  const courtsB = [...courtsA].reverse();
  const resultA = assignCourtsFromCertifiedSchedule(canonicalHandoffInput(chain, { courts: courtsA }));
  const resultB = assignCourtsFromCertifiedSchedule(
    canonicalHandoffInput(chain, { courts: courtsB, availabilitySnapshotRef: availabilityRef(courtsA) })
  );
  const mapA = new Map(
    resultA.courtAssignmentResult.assignments.map((a) => [a.matchId, a.scheduledStart])
  );
  const mapB = new Map(
    resultB.courtAssignmentResult.assignments.map((a) => [a.matchId, a.scheduledStart])
  );
  assert.deepEqual([...mapA.keys()].sort(), [...mapB.keys()].sort());
  for (const [id, start] of mapA) {
    assert.equal(mapB.get(id), start);
  }
});

/* -------------------------------------------------------------------------- */
/* 1I-M01..M05 — no-mutation across the whole chain                          */
/* -------------------------------------------------------------------------- */

test("1I-M01 adapter does not mutate MatchPlan or policy inputs", () => {
  const matchPlan = canonicalMatchPlan();
  const policy = canonicalAdapterPolicy();
  const beforePlan = JSON.stringify(matchPlan);
  const beforePolicy = JSON.stringify(policy);
  const result = createScheduleRequestFromMatchPlan(matchPlan, policy);
  assert.equal(result.ok, true);
  assert.equal(JSON.stringify(matchPlan), beforePlan);
  assert.equal(JSON.stringify(policy), beforePolicy);
});

test("1I-M02 buildBaselineScheduleCandidate does not mutate ScheduleRequest", () => {
  const chain = buildCanonicalChain();
  const before = JSON.stringify(chain.scheduleRequest);
  buildBaselineScheduleCandidate(chain.scheduleRequest);
  assert.equal(JSON.stringify(chain.scheduleRequest), before);
});

test("1I-M03 certifyBaselineScheduleCandidateConstraints does not mutate request or candidate", () => {
  const chain = buildCanonicalChain();
  const beforeRequest = JSON.stringify(chain.scheduleRequest);
  const beforeCandidate = JSON.stringify(chain.candidate);
  certifyBaselineScheduleCandidateConstraints(chain.scheduleRequest, chain.candidate);
  assert.equal(JSON.stringify(chain.scheduleRequest), beforeRequest);
  assert.equal(JSON.stringify(chain.candidate), beforeCandidate);
});

test("1I-M04 createCourtAssignmentRequestFromCertifiedSchedule does not mutate its inputs", () => {
  const chain = buildCanonicalChain();
  const courts = canonicalCourts();
  const scopeObj = { ...SCOPE };
  const beforeRequest = JSON.stringify(chain.scheduleRequest);
  const beforeCandidate = JSON.stringify(chain.candidate);
  const beforeCert = JSON.stringify(chain.certificationResult);
  const beforeScope = JSON.stringify(scopeObj);
  const beforeCourts = JSON.stringify(courts);
  createCourtAssignmentRequestFromCertifiedSchedule({
    scheduleRequest: chain.scheduleRequest,
    candidate: chain.candidate,
    certificationResult: chain.certificationResult,
    scope: scopeObj,
    courts,
    availabilitySnapshotRef: availabilityRef(courts),
  });
  assert.equal(JSON.stringify(chain.scheduleRequest), beforeRequest);
  assert.equal(JSON.stringify(chain.candidate), beforeCandidate);
  assert.equal(JSON.stringify(chain.certificationResult), beforeCert);
  assert.equal(JSON.stringify(scopeObj), beforeScope);
  assert.equal(JSON.stringify(courts), beforeCourts);
});

test("1I-M05 assignCourtsFromCertifiedSchedule does not mutate candidate plan times", () => {
  const chain = buildCanonicalChain();
  const input = canonicalHandoffInput(chain);
  const beforeScheduled = JSON.stringify(chain.candidate.plan.scheduled);
  const result = assignCourtsFromCertifiedSchedule(input);
  assert.equal(result.ok, true);
  assert.equal(JSON.stringify(chain.candidate.plan.scheduled), beforeScheduled);
});

/* -------------------------------------------------------------------------- */
/* 1I-FP — fingerprint continuity and type boundaries                        */
/* -------------------------------------------------------------------------- */

test("1I-FP fingerprint continuity and type boundaries across the whole chain", () => {
  const chain = buildCanonicalChain();
  const courts = canonicalCourts();
  const input = canonicalHandoffInput(chain, { courts });

  const matchPlanFp = fingerprintMatchPlan(chain.matchPlan, {
    strategy: MATCH_GENERATION_STRATEGY.SINGLE_ELIMINATION,
  });
  const scheduleRequestFp = fingerprintScheduleRequest(chain.scheduleRequest);
  const candidateFp = fingerprintBaselineScheduleCandidate(chain.candidate);

  const handoff = createCourtAssignmentRequestFromCertifiedSchedule(input);
  assert.equal(handoff.ok, true);
  const handoffFp = handoff.replay.courtAssignmentRequestFingerprint;

  const orchestrated = assignCourtsFromCertifiedSchedule(input);
  assert.equal(orchestrated.ok, true);
  const resultFp = orchestrated.courtAssignmentResult.resultFingerprint;

  // All five layers of fingerprint are strings and mutually distinct.
  const all = [matchPlanFp, scheduleRequestFp, candidateFp, handoffFp, resultFp];
  for (const fp of all) {
    assert.equal(typeof fp, "string");
    assert.ok(fp.length > 0);
  }
  const unique = new Set(all);
  assert.equal(unique.size, all.length, JSON.stringify(all));

  // Cross-checks against the source-of-truth public fingerprint functions.
  assert.equal(matchPlanFp, chain.matchPlan.generationFingerprint);
  assert.equal(chain.adapterResult.replay.matchPlanFingerprint, matchPlanFp);
  assert.equal(chain.adapterResult.replay.scheduleRequestFingerprint, scheduleRequestFp);
  assert.equal(chain.certificationResult.replay.inputFingerprint, scheduleRequestFp);
  assert.equal(chain.certificationResult.replay.resultFingerprint, candidateFp);
  assert.equal(handoffFp, fingerprintCourtAssignmentRequest(handoff.courtAssignmentRequest));
  assert.equal(orchestrated.replay.courtAssignmentResultFingerprint, resultFp);

  // Certification replay is reproducible on a fresh call (deterministic).
  const recert = certifyBaselineScheduleCandidateConstraints(chain.scheduleRequest, chain.candidate);
  assert.equal(recert.replay.inputFingerprint, chain.certificationResult.replay.inputFingerprint);
  assert.equal(recert.replay.resultFingerprint, chain.certificationResult.replay.resultFingerprint);
});

/* -------------------------------------------------------------------------- */
/* 1I-B01..B08 — static ownership and import boundaries                      */
/* -------------------------------------------------------------------------- */

test("1I-B01 CORE-09 (match-generation) never imports schedule-engine/court-assignment/integration", () => {
  for (const file of listJsFiles(MATCH_GENERATION_DIR)) {
    const src = stripComments(readFileSync(file, "utf8"));
    for (const spec of importSpecifiers(src)) {
      assert.equal(/schedule-engine/.test(spec), false, `${toPosix(file)} -> ${spec}`);
      assert.equal(/court-assignment/.test(spec), false, `${toPosix(file)} -> ${spec}`);
      assert.equal(/\/integration\//.test(spec), false, `${toPosix(file)} -> ${spec}`);
    }
  }
});

test("1I-B02 schedule-engine core (excluding adapters/) never imports integration/court-assignment", () => {
  const adaptersDir = toPosix(path.join(SCHEDULE_ENGINE_DIR, "adapters"));
  for (const file of listJsFiles(SCHEDULE_ENGINE_DIR)) {
    const posix = toPosix(file);
    if (posix.startsWith(adaptersDir)) continue;
    const src = stripComments(readFileSync(file, "utf8"));
    for (const spec of importSpecifiers(src)) {
      assert.equal(/court-assignment/.test(spec), false, `${posix} -> ${spec}`);
      assert.equal(/\/integration\//.test(spec), false, `${posix} -> ${spec}`);
    }
  }
});

test("1I-B03 court-assignment never imports schedule-engine or integration", () => {
  for (const file of listJsFiles(COURT_ASSIGNMENT_DIR)) {
    const src = stripComments(readFileSync(file, "utf8"));
    for (const spec of importSpecifiers(src)) {
      assert.equal(/schedule-engine/.test(spec), false, `${toPosix(file)} -> ${spec}`);
      assert.equal(/\/integration\//.test(spec), false, `${toPosix(file)} -> ${spec}`);
    }
  }
});

test("1I-B04 integration layer imports only public schedule-engine/court-assignment barrels", () => {
  for (const file of listJsFiles(INTEGRATION_DIR)) {
    const src = stripComments(readFileSync(file, "utf8"));
    for (const spec of importSpecifiers(src)) {
      if (/schedule-engine/.test(spec)) {
        assert.match(spec, /schedule-engine\/index\.js$/, `${toPosix(file)} -> ${spec}`);
      }
      if (/court-assignment/.test(spec)) {
        assert.match(spec, /court-assignment\/index\.js$/, `${toPosix(file)} -> ${spec}`);
      }
    }
  }
  const bundled =
    readFileSync(path.join(INTEGRATION_DIR, "scheduleToCourtAssignment.js"), "utf8") +
    readFileSync(path.join(INTEGRATION_DIR, "index.js"), "utf8");
  assert.match(bundled, /from\s+["']\.\.\/schedule-engine\/index\.js["']/);
  assert.match(bundled, /from\s+["']\.\.\/court-assignment\/index\.js["']/);
});

test("1I-B05 schedule-engine adapters import only match-generation/index.js barrel", () => {
  const adapterFile = path.join(SCHEDULE_ENGINE_DIR, "adapters/createScheduleRequestFromMatchPlan.js");
  const src = stripComments(readFileSync(adapterFile, "utf8"));
  let sawMatchGeneration = false;
  for (const spec of importSpecifiers(src)) {
    if (/match-generation/.test(spec)) {
      sawMatchGeneration = true;
      assert.match(spec, /match-generation\/index\.js$/, spec);
    }
  }
  assert.equal(sawMatchGeneration, true);
});

test("1I-B06 no forbidden external module imports across the public chain", () => {
  const forbidden = /(supabase|tournament-engine|court-engine|venue-court|\/optimizer\/)/;
  const dirs = [MATCH_GENERATION_DIR, SCHEDULE_ENGINE_DIR, COURT_ASSIGNMENT_DIR, INTEGRATION_DIR];
  for (const dir of dirs) {
    for (const file of listJsFiles(dir)) {
      const src = stripComments(readFileSync(file, "utf8"));
      for (const spec of importSpecifiers(src)) {
        assert.equal(forbidden.test(spec), false, `${toPosix(file)} -> ${spec}`);
      }
    }
  }
});

test("1I-B07 this test file imports only public */index.js barrels and node: builtins", () => {
  const src = readFileSync(THIS_FILE, "utf8");
  for (const spec of importSpecifiers(src)) {
    const isNodeBuiltin = spec.startsWith("node:");
    const isPublicBarrel = /\/(match-generation|schedule-engine|integration|court-assignment)\/index\.js$/.test(
      spec
    );
    assert.ok(isNodeBuiltin || isPublicBarrel, spec);
  }
});

test("1I-B08 this test file uses no nondeterministic primitives in assertions", () => {
  const src = readFileSync(THIS_FILE, "utf8");
  assert.equal(/Date\.now\s*\(/.test(src), false);
  assert.equal(/Math\.random\s*\(/.test(src), false);
  assert.equal(/randomUUID\s*\(/.test(src), false);
  assert.equal(/localeCompare\s*\(/.test(src), false);
});
