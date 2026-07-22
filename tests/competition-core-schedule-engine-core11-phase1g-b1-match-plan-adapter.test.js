/**
 * CORE-11 Phase 1G-B1 — MatchPlan → ScheduleRequest adapter (focused).
 * Scenario traceability: docs/competition-engine/core-11/07_PHASE_1G_B1_CORE09_ADAPTER.md
 */

import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync, readdirSync, statSync, existsSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import {
  MATCH_DEPENDENCY_TYPE,
  MATCH_GENERATION_STRATEGY,
  MATCH_GENERATOR_IDENTITY,
  PARTICIPANT_SLOT_KIND,
  createLogicalMatch,
  createMatchDependency,
  createParticipantSlot,
  createByeParticipantSlot,
  assembleMatchPlan,
  fingerprintMatchPlan,
} from "../src/features/competition-core/match-generation/index.js";

import {
  PARTICIPANT_REFERENCE_KIND,
  SCHEDULE_DIAGNOSTIC_CODE,
  SCHEDULE_DEPENDENCY_TYPE,
  MATCH_PLAN_TO_SCHEDULE_REQUEST_RESULT_STATUS,
  createScheduleRequestFromMatchPlan,
  validateScheduleRequest,
  buildScheduleDependencyGraph,
  buildBaselineScheduleCandidate,
  certifyBaselineScheduleCandidateConstraints,
  CONSTRAINT_CERTIFICATION,
} from "../src/features/competition-core/schedule-engine/index.js";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const SE_ROOT = path.join(ROOT, "src/features/competition-core/schedule-engine");
const ADAPTER = path.join(SE_ROOT, "adapters/createScheduleRequestFromMatchPlan.js");
const TZ = "Asia/Ho_Chi_Minh";

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

function stripComments(text) {
  return text
    .replace(/\/\*[\s\S]*?\*\//g, "")
    .replace(/(^|[^:])\/\/.*$/gm, "$1");
}

function basePolicy(overrides = {}) {
  return {
    timezone: TZ,
    operatingWindows: [
      { date: "2026-08-01", startMinutes: 480, endMinutes: 1200 },
    ],
    sessionWindows: [],
    defaultDurationMinutes: 30,
    bufferMinutes: 5,
    dependencyBufferMinutes: 5,
    minParticipantRestMinutes: 5,
    minTeamRestMinutes: 0,
    maxConcurrentMatches: 2,
    defaultDirectParticipantKind: PARTICIPANT_REFERENCE_KIND.PLAYER,
    ...overrides,
  };
}

function direct(id) {
  return createParticipantSlot({
    kind: PARTICIPANT_SLOT_KIND.DIRECT_PARTICIPANT,
    participantId: id,
  });
}

function winnerOf(sourceKey) {
  return createParticipantSlot({
    kind: PARTICIPANT_SLOT_KIND.WINNER_OF,
    sourceLogicalMatchKey: sourceKey,
  });
}

function loserOf(sourceKey) {
  return createParticipantSlot({
    kind: PARTICIPANT_SLOT_KIND.LOSER_OF,
    sourceLogicalMatchKey: sourceKey,
  });
}

function lm(partial) {
  return createLogicalMatch({
    competitionId: "comp-1",
    divisionId: "div-1",
    stageId: "stage-1",
    roundNumber: 1,
    matchNumber: 1,
    participantSlotA: direct("p-a"),
    participantSlotB: direct("p-b"),
    ...partial,
  });
}

function plan(matches, extra = {}) {
  const stageId =
    extra.stageId ||
    (matches[0] && matches[0].stageId) ||
    "stage-1";
  return assembleMatchPlan({
    competitionId: "comp-1",
    divisionId: "div-1",
    categoryId: null,
    stageId,
    logicalMatches: matches,
    drawFingerprint: "draw-fp",
    ruleEvaluationFingerprint: "rule-fp",
    participantFingerprint: "part-fp",
    strategy: MATCH_GENERATION_STRATEGY.SINGLE_ELIMINATION,
    validationSummary: { ok: true, issueCount: 0, issueCodes: [] },
    ...extra,
    stageId,
  });
}

function codes(result) {
  return result.diagnostics.map((d) => d.code);
}

function adapt(matchPlan, policy) {
  return createScheduleRequestFromMatchPlan(matchPlan, policy);
}

/* -------------------------------------------------------------------------- */
/* Scenarios 1–16 — basic mapping                                              */
/* -------------------------------------------------------------------------- */

test("01-04 empty and basic MatchPlan mapping", () => {
  const empty = adapt(plan([]), basePolicy({ operatingWindows: [] }));
  assert.equal(empty.ok, true);
  assert.equal(empty.status, MATCH_PLAN_TO_SCHEDULE_REQUEST_RESULT_STATUS);
  assert.equal(empty.scheduleRequest.matches.length, 0);
  assert.equal(empty.mappingSummary.sourceMatchCount, 0);

  const one = adapt(
    plan([
      lm({
        logicalMatchKey: undefined,
        matchNumber: 1,
        participantSlotA: direct("alice"),
        participantSlotB: direct("bob"),
      }),
    ]),
    basePolicy()
  );
  assert.equal(one.ok, true);
  assert.equal(one.scheduleRequest.competitionId, "comp-1");
  assert.equal(one.scheduleRequest.matches.length, 1);
  assert.equal(one.scheduleRequest.matches[0].divisionId, "div-1");
});

test("05-12 stage round sequence priority rules", () => {
  const m = lm({
    stageId: "semi",
    roundNumber: 2,
    matchNumber: 7,
    deterministicOrder: 3,
    participantSlotA: direct("a"),
    participantSlotB: direct("b"),
  });
  const result = adapt(plan([m]), basePolicy({
    priorityByMatchId: { [m.logicalMatchKey]: 99 },
  }));
  assert.equal(result.ok, true);
  const mapped = result.scheduleRequest.matches[0];
  assert.equal(mapped.stageId, "semi");
  assert.equal(mapped.roundNumber, 2);
  assert.equal(mapped.sequence, 3);
  assert.equal(mapped.priority, 99);

  const fallback = adapt(
    plan([
      lm({
        matchNumber: 4,
        deterministicOrder: undefined,
        participantSlotA: direct("a"),
        participantSlotB: direct("b"),
      }),
    ]),
    basePolicy()
  );
  // createLogicalMatch defaults deterministicOrder to matchNumber
  assert.equal(fallback.scheduleRequest.matches[0].sequence, 4);

  const noPriorityFromOrder = adapt(plan([m]), basePolicy());
  assert.equal(noPriorityFromOrder.scheduleRequest.matches[0].priority, undefined);
});

test("13-16 duration and bye mapping", () => {
  const m = lm({
    matchNumber: 1,
    participantSlotA: direct("a"),
    participantSlotB: direct("b"),
  });
  const withDur = adapt(plan([m]), basePolicy({
    estimatedDurationByMatchId: { [m.logicalMatchKey]: 45 },
  }));
  assert.equal(withDur.scheduleRequest.matches[0].estimatedDurationMinutes, 45);

  const fallback = adapt(plan([m]), basePolicy());
  assert.equal(fallback.scheduleRequest.matches[0].estimatedDurationMinutes, undefined);
  assert.equal(fallback.scheduleRequest.policy.duration.defaultDurationMinutes, 30);

  const bye = adapt(
    plan([
      lm({
        matchNumber: 1,
        isByeMatch: true,
        participantSlotA: direct("advances"),
        participantSlotB: createByeParticipantSlot(),
      }),
    ]),
    basePolicy()
  );
  assert.equal(bye.ok, true);
  assert.equal(bye.scheduleRequest.matches[0].isBye, true);
  assert.equal(bye.mappingSummary.byeMatchCount, 1);
  assert.ok(
    !bye.scheduleRequest.matches[0].participants.some((p) =>
      (p.constraintResourceIds || []).length
    )
  );
});

/* -------------------------------------------------------------------------- */
/* Scenarios 17–26 — identity                                                  */
/* -------------------------------------------------------------------------- */

test("17-26 participant kinds and enrichment", () => {
  const mPlayer = lm({
    matchNumber: 1,
    participantSlotA: direct("p1"),
    participantSlotB: direct("p2"),
  });
  assert.equal(
    adapt(plan([mPlayer]), basePolicy({
      defaultDirectParticipantKind: PARTICIPANT_REFERENCE_KIND.PLAYER,
    })).ok,
    true
  );

  const mTeam = adapt(plan([mPlayer]), basePolicy({
    defaultDirectParticipantKind: PARTICIPANT_REFERENCE_KIND.TEAM,
  }));
  assert.equal(mTeam.scheduleRequest.matches[0].participants[0].kind, "TEAM");

  const mEntry = adapt(plan([mPlayer]), basePolicy({
    defaultDirectParticipantKind: PARTICIPANT_REFERENCE_KIND.ENTRY,
    identityByParticipantId: {
      p1: {
        kind: PARTICIPANT_REFERENCE_KIND.PLAYER,
        constraintResourceIds: ["player:2", "player:1", "player:1"],
      },
    },
  }));
  assert.equal(mEntry.scheduleRequest.matches[0].participants.find((p) => p.participantId === "p1").kind, "PLAYER");
  assert.deepEqual(
    mEntry.scheduleRequest.matches[0].participants.find((p) => p.participantId === "p1").constraintResourceIds,
    ["player:1", "player:2"]
  );

  const missingKind = adapt(plan([mPlayer]), basePolicy({
    defaultDirectParticipantKind: undefined,
    identityByParticipantId: {},
  }));
  assert.equal(missingKind.ok, false);
  assert.ok(codes(missingKind).includes(SCHEDULE_DIAGNOSTIC_CODE.MATCH_PLAN_PARTICIPANT_IDENTITY_MISSING));

  const missingId = adapt(
    plan([
      lm({
        matchNumber: 1,
        participantSlotA: createParticipantSlot({
          kind: PARTICIPANT_SLOT_KIND.DIRECT_PARTICIPANT,
          participantId: null,
        }),
        participantSlotB: direct("b"),
      }),
    ]),
    basePolicy()
  );
  assert.equal(missingId.ok, false);

  const badEnrich = adapt(plan([mPlayer]), basePolicy({
    identityByParticipantId: { p1: { kind: "DISPLAY" } },
  }));
  assert.equal(badEnrich.ok, false);
  assert.ok(codes(badEnrich).includes(SCHEDULE_DIAGNOSTIC_CODE.IDENTITY_ENRICHMENT_INVALID));
});

/* -------------------------------------------------------------------------- */
/* Scenarios 27–44 — dependencies                                              */
/* -------------------------------------------------------------------------- */

test("27-36 winner loser deps orientation and normalization", () => {
  const semiKeyBase = lm({
    matchNumber: 1,
    roundNumber: 1,
    stageId: "elim",
    deterministicOrder: 1,
    participantSlotA: direct("a"),
    participantSlotB: direct("b"),
  });
  const final2 = lm({
    matchNumber: 1,
    roundNumber: 2,
    stageId: "elim",
    bracketId: "main",
    deterministicOrder: 2,
    participantSlotA: winnerOf(semiKeyBase.logicalMatchKey),
    participantSlotB: direct("c"),
    dependencyInputs: [
      createMatchDependency({
        type: MATCH_DEPENDENCY_TYPE.WINNER_OF,
        logicalMatchKey: semiKeyBase.logicalMatchKey,
      }),
    ],
  });
  const semi2 = lm({
    matchNumber: 1,
    roundNumber: 1,
    stageId: "elim",
    deterministicOrder: 1,
    participantSlotA: direct("a"),
    participantSlotB: direct("b"),
    winnerTo: createMatchDependency({
      type: MATCH_DEPENDENCY_TYPE.WINNER_OF,
      logicalMatchKey: final2.logicalMatchKey,
    }),
  });
  assert.equal(semi2.logicalMatchKey, semiKeyBase.logicalMatchKey);

  const result = adapt(plan([semi2, final2]), basePolicy());
  assert.equal(result.ok, true, codes(result).join(","));
  const depMatch = result.scheduleRequest.matches.find(
    (x) => x.matchId === final2.logicalMatchKey
  );
  assert.equal(depMatch.dependencies.length, 1);
  assert.equal(depMatch.dependencies[0].type, SCHEDULE_DEPENDENCY_TYPE.WINNER_OF);
  assert.equal(depMatch.dependencies[0].sourceMatchId, semiKeyBase.logicalMatchKey);
  assert.equal(
    depMatch.participants.some(
      (p) => p.participantId === `WINNER_OF:${semiKeyBase.logicalMatchKey}`
    ),
    true
  );

  const loserFinal = lm({
    matchNumber: 2,
    roundNumber: 2,
    stageId: "elim",
    bracketId: "consolation",
    deterministicOrder: 3,
    participantSlotA: loserOf(semiKeyBase.logicalMatchKey),
    participantSlotB: direct("d"),
    dependencyInputs: [
      createMatchDependency({
        type: MATCH_DEPENDENCY_TYPE.LOSER_OF,
        logicalMatchKey: semiKeyBase.logicalMatchKey,
      }),
    ],
  });
  const semiLoser = lm({
    matchNumber: 1,
    roundNumber: 1,
    stageId: "elim",
    deterministicOrder: 1,
    participantSlotA: direct("a"),
    participantSlotB: direct("b"),
    loserTo: createMatchDependency({
      type: MATCH_DEPENDENCY_TYPE.LOSER_OF,
      logicalMatchKey: loserFinal.logicalMatchKey,
    }),
  });
  const loserResult = adapt(plan([semiLoser, loserFinal]), basePolicy());
  assert.equal(loserResult.ok, true, codes(loserResult).join(","));
});

test("33-37 contradictory unknown self outgoing mismatch", () => {
  const a = lm({
    matchNumber: 1,
    deterministicOrder: 1,
    participantSlotA: direct("a"),
    participantSlotB: direct("b"),
  });
  const badSelf = lm({
    matchNumber: 2,
    roundNumber: 2,
    deterministicOrder: 2,
    participantSlotA: winnerOf(a.logicalMatchKey),
    participantSlotB: direct("c"),
    dependencyInputs: [
      createMatchDependency({
        type: MATCH_DEPENDENCY_TYPE.WINNER_OF,
        logicalMatchKey: "missing-key",
      }),
    ],
  });
  const unknown = adapt(plan([a, badSelf]), basePolicy());
  assert.equal(unknown.ok, false);
  assert.ok(
    codes(unknown).includes(SCHEDULE_DIAGNOSTIC_CODE.UNKNOWN_MATCH_DEPENDENCY) ||
      codes(unknown).includes(SCHEDULE_DIAGNOSTIC_CODE.MATCH_PLAN_INVALID)
  );

  const selfDep = lm({
    matchNumber: 3,
    deterministicOrder: 1,
    participantSlotA: direct("x"),
    participantSlotB: direct("y"),
  });
  const selfPlan = plan([
    {
      ...selfDep,
      participantSlotA: winnerOf(selfDep.logicalMatchKey),
      dependencyInputs: [
        createMatchDependency({
          type: MATCH_DEPENDENCY_TYPE.WINNER_OF,
          logicalMatchKey: selfDep.logicalMatchKey,
        }),
      ],
    },
  ]);
  const selfResult = adapt(selfPlan, basePolicy());
  assert.equal(selfResult.ok, false);
  assert.ok(
    codes(selfResult).includes(SCHEDULE_DIAGNOSTIC_CODE.SELF_MATCH_DEPENDENCY) ||
      codes(selfResult).includes(SCHEDULE_DIAGNOSTIC_CODE.MATCH_PLAN_INVALID)
  );

  const target = lm({
    matchNumber: 9,
    roundNumber: 2,
    bracketId: "x",
    deterministicOrder: 2,
    participantSlotA: direct("p"),
    participantSlotB: direct("q"),
  });
  const source = lm({
    matchNumber: 8,
    deterministicOrder: 1,
    participantSlotA: direct("a"),
    participantSlotB: direct("b"),
    winnerTo: createMatchDependency({
      type: MATCH_DEPENDENCY_TYPE.WINNER_OF,
      logicalMatchKey: target.logicalMatchKey,
    }),
  });
  const mismatch = adapt(plan([source, target]), basePolicy());
  assert.equal(mismatch.ok, false);
  assert.ok(
    codes(mismatch).includes(
      SCHEDULE_DIAGNOSTIC_CODE.MATCH_PLAN_DEPENDENCY_INCONSISTENT
    ) || codes(mismatch).includes(SCHEDULE_DIAGNOSTIC_CODE.MATCH_PLAN_INVALID)
  );
});

test("38-44 placement enrichment and no barrier invention", () => {
  const place = lm({
    matchNumber: 1,
    participantSlotA: createParticipantSlot({
      kind: PARTICIPANT_SLOT_KIND.UNRESOLVED_PLACEMENT,
      placementRef: "draw:seed:1",
    }),
    participantSlotB: direct("opp"),
  });
  const resolved = adapt(plan([place]), basePolicy({
    placementIdentityByRef: {
      "draw:seed:1": {
        participantId: "seeded-1",
        kind: PARTICIPANT_REFERENCE_KIND.PLAYER,
      },
    },
  }));
  assert.equal(resolved.ok, true, codes(resolved).join(","));
  assert.ok(
    resolved.scheduleRequest.matches[0].participants.some(
      (p) => p.participantId === "seeded-1"
    )
  );

  const unresolved = adapt(plan([place]), basePolicy());
  assert.equal(unresolved.ok, false);
  assert.ok(
    codes(unresolved).includes(SCHEDULE_DIAGNOSTIC_CODE.PLACEMENT_IDENTITY_MISSING)
  );

  const src = readFileSync(ADAPTER, "utf8");
  assert.equal(/PREVIOUS_ROUND|QUALIFICATION|GROUP_STAGE_COMPLETE/.test(src), false);
});

/* -------------------------------------------------------------------------- */
/* Scenarios 45–54 — policy and MatchPlan validation                           */
/* -------------------------------------------------------------------------- */

test("45-54 policy and MatchPlan validation failures", () => {
  const m = plan([
    lm({
      matchNumber: 1,
      participantSlotA: direct("a"),
      participantSlotB: direct("b"),
    }),
  ]);
  assert.equal(adapt(m, basePolicy({ timezone: "" })).ok, false);
  assert.equal(adapt(m, basePolicy({ operatingWindows: [] })).ok, false);
  assert.equal(adapt(m, basePolicy({ defaultDurationMinutes: undefined })).ok, false);
  assert.equal(adapt(m, basePolicy({ bufferMinutes: undefined })).ok, false);
  assert.equal(adapt(m, basePolicy({ dependencyBufferMinutes: undefined })).ok, false);
  assert.equal(adapt(m, basePolicy({ minParticipantRestMinutes: undefined })).ok, false);
  assert.equal(adapt(m, basePolicy({ maxConcurrentMatches: undefined })).ok, false);
  assert.equal(adapt(m, basePolicy({ bufferMinutes: -1 })).ok, false);
  assert.equal(adapt(m, basePolicy({ dependencyBufferMinutes: -1 })).ok, false);
  const divergent = adapt(
    m,
    basePolicy({ bufferMinutes: 5, dependencyBufferMinutes: 10 })
  );
  assert.equal(divergent.ok, false);
  assert.ok(
    codes(divergent).includes(SCHEDULE_DIAGNOSTIC_CODE.SCHEDULE_POLICY_BUFFER_CONFLICT)
  );

  const withSessions = adapt(m, basePolicy({
    sessionWindows: [
      { sessionId: "s1", date: "2026-08-01", startMinutes: 480, endMinutes: 720 },
    ],
  }));
  assert.equal(withSessions.ok, true);
  assert.equal(withSessions.scheduleRequest.policy.duration.bufferMinutes, 5);
  assert.equal(
    withSessions.scheduleRequest.policy.duration.dependencyBufferMinutes,
    undefined
  );

  const invalidPlan = adapt(
    { competitionId: "c", logicalMatches: "bad" },
    basePolicy()
  );
  assert.equal(invalidPlan.ok, false);
  assert.ok(codes(invalidPlan).includes(SCHEDULE_DIAGNOSTIC_CODE.MATCH_PLAN_INVALID));
});

test("45-52 shared-buffer Outcome B certification", () => {
  const m = plan([
    lm({
      matchNumber: 1,
      participantSlotA: direct("a"),
      participantSlotB: direct("b"),
    }),
  ]);
  const before = JSON.stringify(basePolicy());

  assert.equal(adapt(m, basePolicy({ bufferMinutes: 0, dependencyBufferMinutes: 0 })).ok, true);
  assert.equal(adapt(m, basePolicy({ bufferMinutes: undefined })).ok, false);
  assert.equal(adapt(m, basePolicy({ dependencyBufferMinutes: undefined })).ok, false);
  assert.equal(adapt(m, basePolicy({ bufferMinutes: -3 })).ok, false);
  assert.equal(adapt(m, basePolicy({ dependencyBufferMinutes: -3 })).ok, false);

  const conflict = adapt(m, basePolicy({ bufferMinutes: 7, dependencyBufferMinutes: 8 }));
  assert.equal(conflict.ok, false);
  assert.equal(conflict.scheduleRequest, null);
  assert.ok(
    codes(conflict).includes(SCHEDULE_DIAGNOSTIC_CODE.SCHEDULE_POLICY_BUFFER_CONFLICT)
  );

  const equal = adapt(m, basePolicy({ bufferMinutes: 11, dependencyBufferMinutes: 11 }));
  assert.equal(equal.ok, true);
  assert.equal(equal.scheduleRequest.policy.duration.bufferMinutes, 11);
  assert.equal(
    Object.prototype.hasOwnProperty.call(
      equal.scheduleRequest.policy.duration,
      "dependencyBufferMinutes"
    ),
    false
  );

  const adapterSrc = stripComments(readFileSync(ADAPTER, "utf8"));
  assert.equal(/maxConcurrentMatches\s*=\s*.*courts|courtCount/.test(adapterSrc), false);
  assert.equal(/dependencyBufferMinutes\s*=\s*.*duration/.test(adapterSrc), false);
  assert.equal(JSON.stringify(basePolicy()), before);
});

/* -------------------------------------------------------------------------- */
/* Scenarios 55–58 — CORE-11 integration                                       */
/* -------------------------------------------------------------------------- */

test("55-58 mapped request validates and can feed 1D/1E/1F", () => {
  const m1 = lm({
    matchNumber: 1,
    participantSlotA: direct("a"),
    participantSlotB: direct("b"),
  });
  const m2 = lm({
    matchNumber: 2,
    roundNumber: 2,
    bracketId: "f",
    participantSlotA: winnerOf(m1.logicalMatchKey),
    participantSlotB: direct("c"),
    dependencyInputs: [
      createMatchDependency({
        type: MATCH_DEPENDENCY_TYPE.WINNER_OF,
        logicalMatchKey: m1.logicalMatchKey,
      }),
    ],
  });
  const m1o = lm({
    matchNumber: 1,
    participantSlotA: direct("a"),
    participantSlotB: direct("b"),
    winnerTo: createMatchDependency({
      type: MATCH_DEPENDENCY_TYPE.WINNER_OF,
      logicalMatchKey: m2.logicalMatchKey,
    }),
  });
  const m2o = lm({
    matchNumber: 2,
    roundNumber: 2,
    bracketId: "f",
    participantSlotA: winnerOf(m1o.logicalMatchKey),
    participantSlotB: direct("c"),
    dependencyInputs: [
      createMatchDependency({
        type: MATCH_DEPENDENCY_TYPE.WINNER_OF,
        logicalMatchKey: m1o.logicalMatchKey,
      }),
    ],
  });
  const adapted = adapt(plan([m1o, m2o]), basePolicy({
    minParticipantRestMinutes: 5,
    maxConcurrentMatches: 1,
  }));
  assert.equal(adapted.ok, true, codes(adapted).join(","));
  const v = validateScheduleRequest(adapted.scheduleRequest);
  assert.equal(v.ok, true);

  const graph = buildScheduleDependencyGraph(adapted.scheduleRequest.matches);
  assert.equal(graph.ok, true);

  const candidate = buildBaselineScheduleCandidate(adapted.scheduleRequest);
  assert.equal(candidate.ok, true);
  assert.equal(candidate.plan.unscheduled.length, 0);

  const cert = certifyBaselineScheduleCandidateConstraints(
    adapted.scheduleRequest,
    candidate
  );
  assert.equal(cert.ok, true);
  assert.equal(cert.certification, CONSTRAINT_CERTIFICATION.HARD_CONSTRAINTS_CERTIFIED);
});

/* -------------------------------------------------------------------------- */
/* Scenarios 59–76 — determinism and boundaries                                */
/* -------------------------------------------------------------------------- */

test("59-66 immutability and order independence", () => {
  const m1 = lm({
    matchNumber: 1,
    participantSlotA: direct("z"),
    participantSlotB: direct("a"),
  });
  const m2 = lm({
    matchNumber: 2,
    participantSlotA: direct("c"),
    participantSlotB: direct("d"),
  });
  const policy = basePolicy({
    identityByParticipantId: {
      z: { kind: "PLAYER", constraintResourceIds: ["r2", "r1"] },
      a: { kind: "PLAYER" },
      c: { kind: "PLAYER" },
      d: { kind: "PLAYER" },
    },
    defaultDirectParticipantKind: undefined,
  });
  const planA = plan([m1, m2]);
  const planB = plan([m2, m1]);
  const beforePlan = JSON.stringify(planA);
  const beforePolicy = JSON.stringify(policy);
  const ra = adapt(planA, policy);
  const rb = adapt(planB, {
    ...policy,
    identityByParticipantId: {
      a: { kind: "PLAYER" },
      z: { kind: "PLAYER", constraintResourceIds: ["r1", "r2"] },
      d: { kind: "PLAYER" },
      c: { kind: "PLAYER" },
    },
  });
  assert.equal(JSON.stringify(planA), beforePlan);
  assert.equal(JSON.stringify(policy), beforePolicy);
  assert.equal(ra.ok, true);
  assert.equal(rb.ok, true);
  assert.deepEqual(
    ra.scheduleRequest.matches.map((m) => m.matchId).sort(),
    rb.scheduleRequest.matches.map((m) => m.matchId).sort()
  );
  assert.equal(JSON.stringify(adapt(planA, policy)), JSON.stringify(adapt(planA, policy)));
});

test("67-71 fingerprint metadata and no score/lifecycle", () => {
  const m = plan([
    lm({
      matchNumber: 1,
      participantSlotA: direct("a"),
      participantSlotB: direct("b"),
      metadata: { displayName: "Finals" },
    }),
  ]);
  const result = adapt(m, basePolicy());
  assert.equal(result.ok, true);
  assert.equal(result.replay.matchPlanFingerprint, fingerprintMatchPlan(m, {
    strategy: MATCH_GENERATION_STRATEGY.SINGLE_ELIMINATION,
  }));
  assert.equal(result.replay.matchPlanFingerprint, m.generationFingerprint);
  assert.ok(result.replay.scheduleRequestFingerprint);
  const src = stripComments(readFileSync(ADAPTER, "utf8"));
  assert.equal(/winnerId|loserId|lifecycleStatus|playedWinner/.test(src), false);
  assert.equal(/displayName/.test(src), false);
  assert.match(src, /fingerprintMatchPlan\s*\(/);
  assert.equal(/from\s+["'][^"']*services\/fingerprint/.test(src), false);
  assert.equal(/phase1c\.strategy\s*(===|==)/.test(src), false);
});

test("67-71 MatchPlan fingerprint certification", () => {
  const m1 = lm({
    matchNumber: 1,
    participantSlotA: direct("a"),
    participantSlotB: direct("b"),
  });
  const m2 = lm({
    matchNumber: 2,
    participantSlotA: direct("c"),
    participantSlotB: direct("d"),
  });
  const ordered = plan([m1, m2]);
  const reordered = plan([m2, m1]);
  const before = JSON.stringify(ordered);

  const a = adapt(ordered, basePolicy());
  const b = adapt(reordered, basePolicy());
  assert.equal(a.ok, true);
  assert.equal(b.ok, true);
  assert.equal(a.replay.matchPlanFingerprint, b.replay.matchPlanFingerprint);
  assert.equal(
    a.replay.matchPlanFingerprint,
    fingerprintMatchPlan(ordered, {
      strategy: MATCH_GENERATION_STRATEGY.SINGLE_ELIMINATION,
    })
  );
  assert.equal(JSON.stringify(ordered), before);
  assert.equal(
    JSON.stringify(adapt(ordered, basePolicy())),
    JSON.stringify(adapt(ordered, basePolicy()))
  );

  const labeled = plan([
    lm({
      matchNumber: 1,
      participantSlotA: direct("a"),
      participantSlotB: direct("b"),
      metadata: { displayName: "Court Final" },
    }),
  ]);
  const unlabeled = plan([
    lm({
      matchNumber: 1,
      participantSlotA: direct("a"),
      participantSlotB: direct("b"),
    }),
  ]);
  assert.equal(
    adapt(labeled, basePolicy()).replay.matchPlanFingerprint,
    adapt(unlabeled, basePolicy()).replay.matchPlanFingerprint
  );
  assert.equal(
    adapt(labeled, basePolicy()).scheduleRequest.matches[0].matchId,
    adapt(unlabeled, basePolicy()).scheduleRequest.matches[0].matchId
  );

  const semantic = plan([
    lm({
      matchNumber: 1,
      participantSlotA: direct("a"),
      participantSlotB: direct("changed"),
    }),
  ]);
  assert.notEqual(
    adapt(unlabeled, basePolicy()).replay.matchPlanFingerprint,
    adapt(semantic, basePolicy()).replay.matchPlanFingerprint
  );

  const withoutStrategyMeta = structuredClone(unlabeled);
  delete withoutStrategyMeta.metadata;
  withoutStrategyMeta.generationFingerprint = fingerprintMatchPlan(
    withoutStrategyMeta,
    {}
  );
  const missingStrategy = adapt(withoutStrategyMeta, basePolicy());
  assert.equal(missingStrategy.ok, true);
  assert.equal(
    missingStrategy.replay.matchPlanFingerprint,
    fingerprintMatchPlan(withoutStrategyMeta, {})
  );

  const badStrategy = structuredClone(unlabeled);
  badStrategy.metadata = {
    phase1c: { strategy: "CHAOS_BALL" },
  };
  const invalidStrategy = adapt(badStrategy, basePolicy());
  assert.equal(invalidStrategy.ok, false);
  assert.ok(
    codes(invalidStrategy).includes(SCHEDULE_DIAGNOSTIC_CODE.MATCH_PLAN_INVALID)
  );

  const mismatched = structuredClone(unlabeled);
  mismatched.generationFingerprint = "deadbeef";
  const mismatch = adapt(mismatched, basePolicy());
  assert.equal(mismatch.ok, false);
  assert.equal(mismatch.scheduleRequest, null);
  const fpDiag = mismatch.diagnostics.find(
    (d) => d.path === "generationFingerprint"
  );
  assert.ok(fpDiag);
  assert.equal(fpDiag.details.upstreamCode, "GENERATION_FINGERPRINT_MISMATCH");
  assert.equal(
    mismatch.replay.matchPlanFingerprint,
    fingerprintMatchPlan(mismatched, {
      strategy: MATCH_GENERATION_STRATEGY.SINGLE_ELIMINATION,
    })
  );

  const adapterSrc = stripComments(readFileSync(ADAPTER, "utf8"));
  assert.equal(/Date\.now\s*\(|Math\.random\s*\(|randomUUID\s*\(/.test(adapterSrc), false);
  assert.match(adapterSrc, /fingerprintMatchPlan\s*\(/);
  assert.equal(
    /from\s+["'][^"']*match-generation\/(?!index\.js)/.test(adapterSrc),
    false
  );
});

test("72-76 import and nondeterminism boundaries", () => {
  const adapterSrc = stripComments(readFileSync(ADAPTER, "utf8"));
  assert.equal(
    /from ["']\.\.\/\.\.\/match-generation\/(?!index\.js)/.test(adapterSrc),
    false
  );
  assert.match(adapterSrc, /from ["']\.\.\/\.\.\/match-generation\/index\.js["']/);
  assert.equal(/optimizer|global-optimizer|scheduling\//.test(adapterSrc), false);
  assert.equal(/supabase|react|@mui|tournament-engine|team-tournament|court-engine|venue-court/.test(adapterSrc), false);
  assert.equal(/Date\.now\s*\(|Math\.random\s*\(|randomUUID\s*\(|localeCompare\s*\(/.test(adapterSrc), false);

  for (const file of listJsFiles(path.join(SE_ROOT, "adapters"))) {
    const code = stripComments(readFileSync(file, "utf8"));
    assert.equal(/Date\.now\s*\(/.test(code), false, file);
  }
});

/* -------------------------------------------------------------------------- */
/* Scenarios 77–81 — prior suites present                                      */
/* -------------------------------------------------------------------------- */

test("77-81 prior CORE-11 suites remain present", () => {
  for (const name of [
    "competition-core-schedule-engine-core11-phase1b-contracts.test.js",
    "competition-core-schedule-engine-core11-phase1c-time-windows.test.js",
    "competition-core-schedule-engine-core11-phase1d-dependency-graph.test.js",
    "competition-core-schedule-engine-core11-phase1e-baseline-scheduler.test.js",
    "competition-core-schedule-engine-core11-phase1f-constraint-certification.test.js",
  ]) {
    assert.equal(existsSync(path.join(ROOT, "tests", name)), true);
  }
});

test("multiple independent matches and competition mapping", () => {
  const a = lm({
    matchNumber: 1,
    participantSlotA: direct("a1"),
    participantSlotB: direct("a2"),
  });
  const b = lm({
    matchNumber: 2,
    participantSlotA: direct("b1"),
    participantSlotB: direct("b2"),
  });
  const result = adapt(plan([b, a]), basePolicy());
  assert.equal(result.ok, true);
  assert.equal(result.scheduleRequest.competitionId, "comp-1");
  assert.equal(result.mappingSummary.mappedMatchCount, 2);
  assert.equal(result.mappingSummary.concreteParticipantCount, 4);
});
