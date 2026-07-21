/**
 * CORE-09 Phase 1B — Match Generator domain contracts & invariant tests.
 * Includes pre-commit remediation coverage (fail-closed enums, LMK, Draw refs, immutability).
 */

import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync, readdirSync, statSync, existsSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import {
  MATCH_GENERATOR_IDENTITY,
  MATCH_GENERATION_STRATEGY,
  MATCH_DEPENDENCY_TYPE,
  PARTICIPANT_SLOT_KIND,
  MATCH_GENERATION_ISSUE_CODE,
  MATCH_GENERATION_ISSUE_SEVERITY,
  DRAW_COMPLETION_STATUS,
  ROUND_ROBIN_MODE,
  BYE_POLICY,
  BRACKET_SIZE_POLICY,
  THIRD_PLACE_POLICY,
  createMatchGenerationRequest,
  createMatchGenerationContext,
  createLogicalMatch,
  createMatchPlan,
  createMatchPlanStage,
  createMatchPlanRound,
  createParticipantSlot,
  createByeParticipantSlot,
  createMatchDependency,
  createDrawSnapshot,
  createDrawPlacementRef,
  createEvaluatedMatchGenerationRules,
  createParticipantSnapshotRef,
  createMatchGenerationResult,
  createMatchGenerationIssue,
  collectForbiddenFieldPaths,
  buildLogicalMatchKey,
  isWellFormedLogicalMatchKey,
  parseLogicalMatchKey,
  fingerprintMatchPlan,
  fingerprintValue,
  validateMatchGenerationRequest,
  validateDrawSnapshotForGeneration,
  validateMatchPlanInvariants,
  detectDependencyCycle,
  rejectUnsupportedStrategy,
  createFixedDrawResultPort,
  createFailClosedDrawResultPort,
  createFixedMatchGenerationRulePort,
  DETERMINISM_POLICY,
  findForbiddenNondeterminismPatterns,
  MatchGenerationContractError,
} from "../src/features/competition-core/match-generation/index.js";
import { RULE_OPERATION } from "../src/features/competition-core/constraints/operations/ruleOperations.js";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const MG_ROOT = path.join(
  ROOT,
  "src/features/competition-core/match-generation"
);

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

function baseRequest(overrides = {}) {
  return createMatchGenerationRequest({
    competitionId: "comp-1",
    divisionId: "div-1",
    categoryId: "cat-1",
    stageId: "stage-group",
    strategy: MATCH_GENERATION_STRATEGY.ROUND_ROBIN,
    drawReference: {
      drawId: "draw-1",
      drawVersion: "1",
      drawFingerprint: "draw-fp-aaa",
    },
    evaluatedRuleReference: {
      ruleSetId: "rules-1",
      ruleSetVersion: "1",
      ruleEvaluationFingerprint: "rule-fp-bbb",
    },
    participantSnapshotReference: {
      snapshotId: "part-snap-1",
      participantFingerprint: "part-fp-ccc",
    },
    generatorVersion: MATCH_GENERATOR_IDENTITY.version,
    ...overrides,
  });
}

function completeDraw(overrides = {}) {
  return createDrawSnapshot({
    drawId: "draw-1",
    drawVersion: "1",
    drawFingerprint: "draw-fp-aaa",
    competitionId: "comp-1",
    divisionId: "div-1",
    categoryId: "cat-1",
    completionStatus: DRAW_COMPLETION_STATUS.COMPLETE,
    stageDefinitions: [{ stageId: "stage-group", order: 1 }],
    groupPlacements: [{ groupId: "g1", id: "g1" }],
    bracketPlacements: [],
    participantPlacements: [
      createDrawPlacementRef({
        placementRef: "g1-p1",
        participantId: "p1",
        groupId: "g1",
        position: 1,
      }),
      createDrawPlacementRef({
        placementRef: "g1-p2",
        participantId: "p2",
        groupId: "g1",
        position: 2,
      }),
    ],
    byePlacements: [],
    seedReferences: [{ seed: 1, participantId: "p1" }],
    ...overrides,
  });
}

function evaluatedRules(overrides = {}) {
  return createEvaluatedMatchGenerationRules({
    ruleSetId: "rules-1",
    ruleSetVersion: "1",
    ruleEvaluationFingerprint: "rule-fp-bbb",
    generationStrategy: MATCH_GENERATION_STRATEGY.ROUND_ROBIN,
    ...overrides,
  });
}

function slotDirect(participantId) {
  return createParticipantSlot({
    kind: PARTICIPANT_SLOT_KIND.DIRECT_PARTICIPANT,
    participantId,
  });
}

function slotWinnerOf(logicalMatchKey) {
  return createParticipantSlot({
    kind: PARTICIPANT_SLOT_KIND.WINNER_OF,
    sourceLogicalMatchKey: logicalMatchKey,
    dependency: createMatchDependency({
      type: MATCH_DEPENDENCY_TYPE.WINNER_OF,
      logicalMatchKey,
    }),
  });
}

function slotLoserOf(logicalMatchKey) {
  return createParticipantSlot({
    kind: PARTICIPANT_SLOT_KIND.LOSER_OF,
    sourceLogicalMatchKey: logicalMatchKey,
    dependency: createMatchDependency({
      type: MATCH_DEPENDENCY_TYPE.LOSER_OF,
      logicalMatchKey,
    }),
  });
}

function buildCanonicalPlan(overrides = {}) {
  const key1 = buildLogicalMatchKey({
    competitionId: "comp-1",
    divisionId: "div-1",
    categoryId: "cat-1",
    stageId: "stage-group",
    groupId: "g1",
    roundNumber: 1,
    matchNumber: 1,
  });
  const key2 = buildLogicalMatchKey({
    competitionId: "comp-1",
    divisionId: "div-1",
    categoryId: "cat-1",
    stageId: "stage-group",
    groupId: "g1",
    roundNumber: 1,
    matchNumber: 2,
  });

  const m1 = createLogicalMatch({
    logicalMatchKey: key1,
    competitionId: "comp-1",
    divisionId: "div-1",
    categoryId: "cat-1",
    stageId: "stage-group",
    groupId: "g1",
    roundNumber: 1,
    matchNumber: 1,
    deterministicOrder: 1,
    participantSlotA: slotDirect("p1"),
    participantSlotB: slotDirect("p2"),
    sourcePlacementRefs: ["g1-p1", "g1-p2"],
    dependencyInputs: [
      createMatchDependency({
        type: MATCH_DEPENDENCY_TYPE.DRAW_PLACEMENT,
        placementRef: "g1-p1",
      }),
      createMatchDependency({
        type: MATCH_DEPENDENCY_TYPE.DRAW_PLACEMENT,
        placementRef: "g1-p2",
      }),
    ],
  });

  const m2 = createLogicalMatch({
    logicalMatchKey: key2,
    competitionId: "comp-1",
    divisionId: "div-1",
    categoryId: "cat-1",
    stageId: "stage-group",
    groupId: "g1",
    roundNumber: 1,
    matchNumber: 2,
    deterministicOrder: 2,
    participantSlotA: slotDirect("p3"),
    participantSlotB: createByeParticipantSlot(),
    isByeMatch: true,
    sourcePlacementRefs: ["g1-p3"],
  });

  const stages = [
    createMatchPlanStage({
      stageId: "stage-group",
      stageOrder: 1,
      roundIds: ["round-1"],
    }),
  ];
  const rounds = [
    createMatchPlanRound({
      roundId: "round-1",
      stageId: "stage-group",
      roundNumber: 1,
      roundOrder: 1,
      logicalMatchKeys: [key1, key2],
    }),
  ];

  const partial = {
    competitionId: "comp-1",
    divisionId: "div-1",
    categoryId: "cat-1",
    stages,
    rounds,
    logicalMatches: [m1, m2],
    drawFingerprint: "draw-fp-aaa",
    ruleEvaluationFingerprint: "rule-fp-bbb",
    participantFingerprint: "part-fp-ccc",
    generatorVersion: MATCH_GENERATOR_IDENTITY.version,
    ...overrides,
  };

  const generationFingerprint = fingerprintMatchPlan(partial, {
    strategy: MATCH_GENERATION_STRATEGY.ROUND_ROBIN,
    deterministicOrderingInputs: ["seed:1", "seed:2", "seed:3"],
  });

  return createMatchPlan({
    ...partial,
    generationFingerprint,
    validationSummary: { ok: true, issueCount: 0, issueCodes: [] },
  });
}

function assertThrowsContract(fn, code) {
  assert.throws(fn, (err) => {
    assert.ok(err instanceof MatchGenerationContractError);
    if (code) assert.equal(err.code, code);
    return true;
  });
}

// --- Existing regression suite ---

test("1B contract: MatchGenerationRequest rejects missing fingerprints and forbidden fields", () => {
  const okIssues = validateMatchGenerationRequest(baseRequest());
  assert.equal(okIssues.length, 0);

  const missingDrawFp = validateMatchGenerationRequest(
    baseRequest({
      drawReference: {
        drawId: "draw-1",
        drawVersion: "1",
        drawFingerprint: "",
      },
    })
  );
  assert.ok(
    missingDrawFp.some(
      (i) => i.code === MATCH_GENERATION_ISSUE_CODE.DRAW_FINGERPRINT_MISSING
    )
  );

  const withCourt = {
    ...baseRequest(),
    courtId: "court-9",
  };
  const forbidden = validateMatchGenerationRequest(withCourt);
  assert.ok(
    forbidden.some(
      (i) => i.code === MATCH_GENERATION_ISSUE_CODE.FORBIDDEN_SCHEDULING_FIELD
    )
  );
});

test("1B contract: stable structural logical match key", () => {
  const key = buildLogicalMatchKey({
    competitionId: "comp-1",
    divisionId: "div-1",
    categoryId: null,
    stageId: "s1",
    groupId: null,
    bracketId: null,
    roundNumber: 2,
    matchNumber: 3,
  });
  const parsed = parseLogicalMatchKey(key);
  assert.equal(parsed.competitionId, "comp-1");
  assert.equal(parsed.categoryId, null);
  assert.equal(parsed.roundNumber, 2);
  assert.equal(parsed.matchNumber, 3);
  assert.equal(isWellFormedLogicalMatchKey(key), true);
  assert.equal(isWellFormedLogicalMatchKey("bad"), false);
});

test("1B invariant: duplicate logical match key detection", () => {
  const plan = buildCanonicalPlan();
  const dup = createMatchPlan({
    ...plan,
    logicalMatches: [plan.logicalMatches[0], plan.logicalMatches[0]],
    rounds: [
      createMatchPlanRound({
        roundId: "round-1",
        stageId: "stage-group",
        roundNumber: 1,
        roundOrder: 1,
        logicalMatchKeys: [
          plan.logicalMatches[0].logicalMatchKey,
          plan.logicalMatches[0].logicalMatchKey,
        ],
      }),
    ],
    generationFingerprint: "",
  });
  const issues = validateMatchPlanInvariants(dup, {
    requireGenerationFingerprintMatch: false,
  });
  assert.ok(
    issues.some(
      (i) => i.code === MATCH_GENERATION_ISSUE_CODE.DUPLICATE_LOGICAL_MATCH_KEY
    )
  );
});

test("1B invariant: self-match rejection", () => {
  const plan = buildCanonicalPlan();
  const bad = createLogicalMatch({
    competitionId: "comp-1",
    divisionId: "div-1",
    categoryId: "cat-1",
    stageId: "stage-group",
    groupId: "g1",
    roundNumber: 1,
    matchNumber: 1,
    deterministicOrder: 1,
    participantSlotA: slotDirect("p1"),
    participantSlotB: slotDirect("p1"),
  });
  const issues = validateMatchPlanInvariants(
    createMatchPlan({
      ...plan,
      logicalMatches: [bad, plan.logicalMatches[1]],
      generationFingerprint: "",
    }),
    { requireGenerationFingerprintMatch: false }
  );
  assert.ok(
    issues.some((i) => i.code === MATCH_GENERATION_ISSUE_CODE.SELF_MATCH)
  );
});

test("1B invariant: dangling dependency rejection", () => {
  const plan = buildCanonicalPlan();
  const bad = createLogicalMatch({
    competitionId: "comp-1",
    divisionId: "div-1",
    categoryId: "cat-1",
    stageId: "stage-group",
    groupId: "g1",
    roundNumber: 1,
    matchNumber: 1,
    deterministicOrder: 1,
    participantSlotA: slotWinnerOf("missing-match-key"),
    participantSlotB: slotDirect("p2"),
    dependencyInputs: [
      createMatchDependency({
        type: MATCH_DEPENDENCY_TYPE.WINNER_OF,
        logicalMatchKey: "missing-match-key",
      }),
    ],
  });
  const issues = validateMatchPlanInvariants(
    createMatchPlan({
      ...plan,
      logicalMatches: [bad, plan.logicalMatches[1]],
      generationFingerprint: "",
    }),
    { requireGenerationFingerprintMatch: false }
  );
  assert.ok(
    issues.some((i) => i.code === MATCH_GENERATION_ISSUE_CODE.DANGLING_DEPENDENCY)
  );
});

test("1B invariant: dependency cycle detection", () => {
  const keyA = buildLogicalMatchKey({
    competitionId: "comp-1",
    divisionId: "div-1",
    stageId: "ko",
    roundNumber: 1,
    matchNumber: 1,
  });
  const keyB = buildLogicalMatchKey({
    competitionId: "comp-1",
    divisionId: "div-1",
    stageId: "ko",
    roundNumber: 1,
    matchNumber: 2,
  });

  const a = createLogicalMatch({
    logicalMatchKey: keyA,
    competitionId: "comp-1",
    divisionId: "div-1",
    stageId: "ko",
    roundNumber: 1,
    matchNumber: 1,
    deterministicOrder: 1,
    participantSlotA: slotWinnerOf(keyB),
    participantSlotB: slotDirect("p2"),
    dependencyInputs: [
      createMatchDependency({
        type: MATCH_DEPENDENCY_TYPE.WINNER_OF,
        logicalMatchKey: keyB,
      }),
    ],
  });
  const b = createLogicalMatch({
    logicalMatchKey: keyB,
    competitionId: "comp-1",
    divisionId: "div-1",
    stageId: "ko",
    roundNumber: 1,
    matchNumber: 2,
    deterministicOrder: 2,
    participantSlotA: slotWinnerOf(keyA),
    participantSlotB: slotDirect("p3"),
    dependencyInputs: [
      createMatchDependency({
        type: MATCH_DEPENDENCY_TYPE.WINNER_OF,
        logicalMatchKey: keyA,
      }),
    ],
  });

  const plan = createMatchPlan({
    competitionId: "comp-1",
    divisionId: "div-1",
    stages: [
      createMatchPlanStage({
        stageId: "ko",
        stageOrder: 1,
        roundIds: ["r1"],
      }),
    ],
    rounds: [
      createMatchPlanRound({
        roundId: "r1",
        stageId: "ko",
        roundNumber: 1,
        roundOrder: 1,
        logicalMatchKeys: [keyA, keyB],
      }),
    ],
    logicalMatches: [a, b],
    drawFingerprint: "draw-fp-aaa",
    ruleEvaluationFingerprint: "rule-fp-bbb",
    participantFingerprint: "part-fp-ccc",
    generatorVersion: MATCH_GENERATOR_IDENTITY.version,
    generationFingerprint: "",
  });

  assert.ok(detectDependencyCycle(plan));
  const issues = validateMatchPlanInvariants(plan, {
    requireGenerationFingerprintMatch: false,
  });
  assert.ok(
    issues.some((i) => i.code === MATCH_GENERATION_ISSUE_CODE.DEPENDENCY_CYCLE)
  );
});

test("1B draw port: incomplete Draw rejection", async () => {
  const port = createFixedDrawResultPort(
    completeDraw({ completionStatus: DRAW_COMPLETION_STATUS.INCOMPLETE })
  );
  const result = await port.resolveDrawSnapshot({
    drawId: "draw-1",
    drawVersion: "1",
    drawFingerprint: "draw-fp-aaa",
  });
  assert.equal(result.ok, false);
  assert.ok(
    result.issues.some(
      (i) => i.code === MATCH_GENERATION_ISSUE_CODE.DRAW_INCOMPLETE
    )
  );
});

test("1B draw validation: missing Draw fingerprint rejection", () => {
  const issues = validateDrawSnapshotForGeneration(
    completeDraw({ drawFingerprint: "" })
  );
  assert.ok(
    issues.some(
      (i) => i.code === MATCH_GENERATION_ISSUE_CODE.DRAW_FINGERPRINT_MISSING
    )
  );
});

test("1B draw validation: duplicate participant placement", () => {
  const issues = validateDrawSnapshotForGeneration(
    completeDraw({
      participantPlacements: [
        createDrawPlacementRef({
          placementRef: "g1-p1",
          participantId: "p1",
          groupId: "g1",
        }),
        createDrawPlacementRef({
          placementRef: "g1-p2",
          participantId: "p1",
          groupId: "g1",
        }),
      ],
    })
  );
  assert.ok(
    issues.some(
      (i) => i.code === MATCH_GENERATION_ISSUE_CODE.DRAW_PLACEMENT_DUPLICATE
    )
  );
});

test("1B rule fingerprint binding on MatchPlan", () => {
  const plan = buildCanonicalPlan({ ruleEvaluationFingerprint: "" });
  const issues = validateMatchPlanInvariants(plan, {
    requireGenerationFingerprintMatch: false,
  });
  assert.ok(
    issues.some(
      (i) => i.code === MATCH_GENERATION_ISSUE_CODE.RULE_FINGERPRINT_MISSING
    )
  );

  const bound = buildCanonicalPlan();
  const mismatch = validateMatchPlanInvariants(bound, {
    expectedRuleEvaluationFingerprint: "other-rule-fp",
    requireGenerationFingerprintMatch: false,
  });
  assert.ok(
    mismatch.some(
      (i) => i.code === MATCH_GENERATION_ISSUE_CODE.RULE_FINGERPRINT_MISMATCH
    )
  );
});

test("1B forbidden scheduling fields on MatchPlan", () => {
  const plan = buildCanonicalPlan();
  const polluted = {
    ...plan,
    logicalMatches: [
      {
        ...plan.logicalMatches[0],
        scheduledAt: "2026-07-21T10:00:00.000Z",
        courtId: "c1",
        score: { a: 11, b: 5 },
      },
      plan.logicalMatches[1],
    ],
  };
  const paths = collectForbiddenFieldPaths(polluted);
  assert.ok(paths.some((p) => p.includes("scheduledAt")));
  const issues = validateMatchPlanInvariants(polluted, {
    requireGenerationFingerprintMatch: false,
  });
  assert.ok(
    issues.some(
      (i) => i.code === MATCH_GENERATION_ISSUE_CODE.FORBIDDEN_SCHEDULING_FIELD
    )
  );
});

test("1B unsupported strategy fails closed", () => {
  const swiss = rejectUnsupportedStrategy("SWISS");
  assert.ok(swiss);
  assert.equal(swiss.ok, false);
  assert.equal(
    swiss.issues[0].code,
    MATCH_GENERATION_ISSUE_CODE.STRATEGY_DEFERRED
  );

  const unknown = rejectUnsupportedStrategy("CHAOS_BALL");
  assert.ok(unknown);
  assert.equal(
    unknown.issues[0].code,
    MATCH_GENERATION_ISSUE_CODE.STRATEGY_UNSUPPORTED
  );

  assert.equal(
    rejectUnsupportedStrategy(MATCH_GENERATION_STRATEGY.ROUND_ROBIN),
    null
  );
});

test("1B deterministic fingerprint generation with fixed canonical inputs", () => {
  const planA = buildCanonicalPlan();
  const planB = buildCanonicalPlan();
  assert.equal(planA.generationFingerprint, planB.generationFingerprint);
  assert.equal(
    fingerprintValue({ a: 1, b: 2 }),
    fingerprintValue({ b: 2, a: 1 })
  );
  const issues = validateMatchPlanInvariants(planA, {
    strategy: MATCH_GENERATION_STRATEGY.ROUND_ROBIN,
    deterministicOrderingInputs: ["seed:1", "seed:2", "seed:3"],
    requireGenerationFingerprintMatch: true,
  });
  assert.equal(issues.length, 0);
});

test("1B DrawResultPort + RulePort fixed doubles succeed for complete inputs", async () => {
  const drawPort = createFixedDrawResultPort(completeDraw());
  const drawResult = await drawPort.resolveDrawSnapshot({
    competitionId: "comp-1",
    divisionId: "div-1",
    drawId: "draw-1",
    drawVersion: "1",
    drawFingerprint: "draw-fp-aaa",
  });
  assert.equal(drawResult.ok, true);

  const rulePort = createFixedMatchGenerationRulePort({
    ruleSetId: "rules-1",
    ruleSetVersion: "1",
    ruleEvaluationFingerprint: "rule-fp-bbb",
    generationStrategy: MATCH_GENERATION_STRATEGY.ROUND_ROBIN,
  });
  const ruleResult = await rulePort.resolveEvaluatedRules({
    competitionId: "comp-1",
    divisionId: "div-1",
    ruleSetId: "rules-1",
    ruleSetVersion: "1",
    ruleEvaluationFingerprint: "rule-fp-bbb",
    strategy: MATCH_GENERATION_STRATEGY.ROUND_ROBIN,
  });
  assert.equal(ruleResult.ok, true);
  assert.equal(ruleResult.evaluatedRules.operation, RULE_OPERATION.MATCHUP);

  const failDraw = createFailClosedDrawResultPort();
  const denied = await failDraw.resolveDrawSnapshot({ drawId: "x" });
  assert.equal(denied.ok, false);
});

test("1B MatchGenerationContext freezes draw + rules + participant snapshot", () => {
  const ctx = createMatchGenerationContext({
    drawSnapshot: completeDraw(),
    evaluatedRules: evaluatedRules(),
    participantSnapshot: createParticipantSnapshotRef({
      snapshotId: "part-snap-1",
      participantFingerprint: "part-fp-ccc",
      participantIds: ["p1", "p2"],
    }),
    deterministicOrderingInputs: ["p1", "p2"],
    generatorVersion: MATCH_GENERATOR_IDENTITY.version,
  });
  assert.equal(ctx.drawSnapshot.completionStatus, DRAW_COMPLETION_STATUS.COMPLETE);
  assert.equal(ctx.evaluatedRules.operation, RULE_OPERATION.MATCHUP);
});

test("1B MatchGenerationResult envelope", () => {
  const plan = buildCanonicalPlan();
  const ok = createMatchGenerationResult({
    ok: true,
    matchPlan: plan,
    fingerprints: {
      drawFingerprint: plan.drawFingerprint,
      ruleEvaluationFingerprint: plan.ruleEvaluationFingerprint,
      participantFingerprint: plan.participantFingerprint,
      generationFingerprint: plan.generationFingerprint,
    },
  });
  assert.equal(ok.ok, true);
});

test("1B architecture: no forbidden nondeterminism patterns in module source", () => {
  assert.ok(DETERMINISM_POLICY.rules.includes("NO_MATH_RANDOM"));
  const files = listJsFiles(MG_ROOT);
  assert.ok(files.length > 10);
  for (const file of files) {
    const src = readFileSync(file, "utf8");
    const hits = findForbiddenNondeterminismPatterns(src);
    assert.deepEqual(
      hits,
      [],
      `Forbidden nondeterminism in ${path.relative(ROOT, file)}: ${hits.join(",")}`
    );
  }
});

test("1B scope: docs exist under docs/competition-engine/core-09", () => {
  for (const name of [
    "00_MATCH_GENERATOR_FOUNDATION.md",
    "01_OWNERSHIP_BOUNDARY.md",
    "02_DOMAIN_INVARIANTS.md",
    "03_DETERMINISM_POLICY.md",
    "04_PORTS.md",
    "05_MIGRATION_AND_COMPATIBILITY_MAP.md",
    "06_PHASE_1B_DOMAIN_CONTRACTS.md",
    "07_CONTRACT_DEFAULTS_AND_IMMUTABILITY.md",
  ]) {
    assert.ok(
      existsSync(path.join(ROOT, "docs/competition-engine/core-09", name)),
      name
    );
  }
});

// --- Remediation suite ---

test("1B rem: unknown request strategy is rejected", () => {
  assertThrowsContract(
    () =>
      createMatchGenerationRequest({
        competitionId: "c",
        divisionId: "d",
        stageId: "s",
        strategy: "CHAOS_BALL",
        drawReference: { drawId: "d", drawVersion: "1", drawFingerprint: "f" },
        evaluatedRuleReference: {
          ruleSetId: "r",
          ruleSetVersion: "1",
          ruleEvaluationFingerprint: "f",
        },
        participantSnapshotReference: {
          snapshotId: "p",
          participantFingerprint: "f",
        },
      }),
    MATCH_GENERATION_ISSUE_CODE.STRATEGY_UNSUPPORTED
  );
});

test("1B rem: unknown evaluated-rule strategy is rejected", () => {
  assertThrowsContract(
    () =>
      createEvaluatedMatchGenerationRules({
        ruleSetId: "r",
        ruleSetVersion: "1",
        ruleEvaluationFingerprint: "f",
        generationStrategy: "NOT_A_STRATEGY",
      }),
    MATCH_GENERATION_ISSUE_CODE.STRATEGY_UNSUPPORTED
  );
});

test("1B rem: unknown roundRobinMode is rejected", () => {
  assertThrowsContract(
    () =>
      createEvaluatedMatchGenerationRules({
        ruleSetId: "r",
        ruleSetVersion: "1",
        ruleEvaluationFingerprint: "f",
        generationStrategy: MATCH_GENERATION_STRATEGY.ROUND_ROBIN,
        roundRobinMode: "TRIPLE",
      }),
    MATCH_GENERATION_ISSUE_CODE.INVALID_ENUM_VALUE
  );
});

test("1B rem: unknown byePolicy is rejected", () => {
  assertThrowsContract(
    () =>
      evaluatedRules({ byePolicy: "RANDOM_BYES" }),
    MATCH_GENERATION_ISSUE_CODE.INVALID_ENUM_VALUE
  );
});

test("1B rem: unknown bracketSizePolicy is rejected", () => {
  assertThrowsContract(
    () => evaluatedRules({ bracketSizePolicy: "WHATEVER" }),
    MATCH_GENERATION_ISSUE_CODE.INVALID_ENUM_VALUE
  );
});

test("1B rem: unknown thirdPlacePolicy is rejected", () => {
  assertThrowsContract(
    () => evaluatedRules({ thirdPlacePolicy: "BRONZE_SCRAMBLE" }),
    MATCH_GENERATION_ISSUE_CODE.INVALID_ENUM_VALUE
  );
});

test("1B rem: unknown dependency type is rejected", () => {
  assertThrowsContract(
    () => createMatchDependency({ type: "MAYBE_WINNER" }),
    MATCH_GENERATION_ISSUE_CODE.INVALID_ENUM_VALUE
  );
});

test("1B rem: unknown participant-slot kind is rejected", () => {
  assertThrowsContract(
    () => createParticipantSlot({ kind: "GHOST" }),
    MATCH_GENERATION_ISSUE_CODE.INVALID_ENUM_VALUE
  );
});

test("1B rem: unknown issue code is rejected", () => {
  assertThrowsContract(
    () => createMatchGenerationIssue({ code: "NOT_A_CODE" }),
    MATCH_GENERATION_ISSUE_CODE.INVALID_ISSUE_CODE
  );
  const ok = createMatchGenerationIssue({
    code: MATCH_GENERATION_ISSUE_CODE.SELF_MATCH,
  });
  assert.equal(ok.severity, MATCH_GENERATION_ISSUE_SEVERITY.ERROR);
});

test("1B rem: ID equal to NONE cannot collide with absent optional segment", () => {
  const absent = buildLogicalMatchKey({
    competitionId: "c",
    divisionId: "d",
    stageId: "s",
    categoryId: null,
    roundNumber: 1,
    matchNumber: 1,
  });
  const namedNone = buildLogicalMatchKey({
    competitionId: "c",
    divisionId: "d",
    stageId: "s",
    categoryId: "NONE",
    roundNumber: 1,
    matchNumber: 1,
  });
  assert.notEqual(absent, namedNone);
  assert.equal(parseLogicalMatchKey(absent).categoryId, null);
  assert.equal(parseLogicalMatchKey(namedNone).categoryId, "NONE");
});

test("1B rem: IDs containing :: cannot create an ambiguous key", () => {
  const key = buildLogicalMatchKey({
    competitionId: "comp::x",
    divisionId: "div|y",
    stageId: "stage::z",
    groupId: "g::1",
    roundNumber: 1,
    matchNumber: 1,
  });
  const parsed = parseLogicalMatchKey(key);
  assert.equal(parsed.competitionId, "comp::x");
  assert.equal(parsed.divisionId, "div|y");
  assert.equal(parsed.stageId, "stage::z");
  assert.equal(parsed.groupId, "g::1");
});

test("1B rem: distinct bracket IDs generate distinct match keys", () => {
  const a = buildLogicalMatchKey({
    competitionId: "c",
    divisionId: "d",
    stageId: "s",
    bracketId: "br-a",
    roundNumber: 1,
    matchNumber: 1,
  });
  const b = buildLogicalMatchKey({
    competitionId: "c",
    divisionId: "d",
    stageId: "s",
    bracketId: "br-b",
    roundNumber: 1,
    matchNumber: 1,
  });
  assert.notEqual(a, b);
});

test("1B rem: invalid roundNumber / matchNumber / empty IDs rejected", () => {
  assertThrowsContract(
    () =>
      buildLogicalMatchKey({
        competitionId: "c",
        divisionId: "d",
        stageId: "s",
        roundNumber: 0,
        matchNumber: 1,
      }),
    MATCH_GENERATION_ISSUE_CODE.INVALID_LOGICAL_MATCH_COORDINATES
  );
  assertThrowsContract(
    () =>
      buildLogicalMatchKey({
        competitionId: "c",
        divisionId: "d",
        stageId: "s",
        roundNumber: 1,
        matchNumber: 1.5,
      }),
    MATCH_GENERATION_ISSUE_CODE.INVALID_LOGICAL_MATCH_COORDINATES
  );
  assertThrowsContract(
    () =>
      buildLogicalMatchKey({
        competitionId: "",
        divisionId: "d",
        stageId: "s",
        roundNumber: 1,
        matchNumber: 1,
      }),
    MATCH_GENERATION_ISSUE_CODE.INVALID_LOGICAL_MATCH_COORDINATES
  );
});

test("1B rem: group/bracket catalog empty with references rejected", () => {
  const groupEmpty = validateDrawSnapshotForGeneration(
    completeDraw({
      groupPlacements: [],
      participantPlacements: [
        createDrawPlacementRef({
          placementRef: "x",
          participantId: "p1",
          groupId: "g1",
        }),
      ],
    })
  );
  assert.ok(
    groupEmpty.some((i) => i.code === MATCH_GENERATION_ISSUE_CODE.DRAW_CATALOG_EMPTY)
  );

  const bracketEmpty = validateDrawSnapshotForGeneration(
    completeDraw({
      groupPlacements: [{ groupId: "g1" }],
      bracketPlacements: [],
      participantPlacements: [
        createDrawPlacementRef({
          placementRef: "x",
          participantId: "p1",
          groupId: "g1",
          bracketId: "br1",
        }),
      ],
    })
  );
  assert.ok(
    bracketEmpty.some(
      (i) => i.code === MATCH_GENERATION_ISSUE_CODE.DRAW_CATALOG_EMPTY
    )
  );
});

test("1B rem: missing participant placement rejected", () => {
  const issues = validateDrawSnapshotForGeneration(
    completeDraw({
      participantPlacements: [
        createDrawPlacementRef({
          placementRef: "x",
          participantId: null,
          groupId: "g1",
          isBye: false,
        }),
      ],
    })
  );
  assert.ok(
    issues.some(
      (i) => i.code === MATCH_GENERATION_ISSUE_CODE.DRAW_PLACEMENT_MISSING
    )
  );
});

test("1B rem: invalid group/bracket reference rejected", () => {
  const issues = validateDrawSnapshotForGeneration(
    completeDraw({
      groupPlacements: [{ groupId: "g1" }],
      bracketPlacements: [{ bracketId: "br1" }],
      participantPlacements: [
        createDrawPlacementRef({
          placementRef: "x",
          participantId: "p1",
          groupId: "missing-g",
          bracketId: "missing-br",
        }),
      ],
    })
  );
  assert.ok(
    issues.filter(
      (i) => i.code === MATCH_GENERATION_ISSUE_CODE.DRAW_REFERENCE_INVALID
    ).length >= 2
  );
});

test("1B rem: caller input unchanged after factory creation", () => {
  const meta = { nested: { v: 1 } };
  const input = {
    kind: PARTICIPANT_SLOT_KIND.DIRECT_PARTICIPANT,
    participantId: "p1",
    metadata: meta,
  };
  createParticipantSlot(input);
  assert.equal(meta.nested.v, 1);
  meta.nested.v = 2;
  assert.equal(input.metadata.nested.v, 2);
});

test("1B rem: nested canonical contract data cannot be mutated after creation", () => {
  const slot = createParticipantSlot({
    kind: PARTICIPANT_SLOT_KIND.DIRECT_PARTICIPANT,
    participantId: "p1",
    metadata: { nested: { v: 1 } },
  });
  assert.throws(() => {
    slot.metadata.nested.v = 99;
  });
  assert.equal(slot.metadata.nested.v, 1);
});

test("1B rem: fingerprint material cannot be modified after fingerprint generation", () => {
  const plan = buildCanonicalPlan();
  const fp = plan.generationFingerprint;
  assert.throws(() => {
    plan.logicalMatches.push({});
  });
  assert.equal(
    fingerprintMatchPlan(plan, {
      strategy: MATCH_GENERATION_STRATEGY.ROUND_ROBIN,
      deterministicOrderingInputs: ["seed:1", "seed:2", "seed:3"],
    }),
    fp
  );
});

test("1B rem: Draw version mismatch is rejected", () => {
  const issues = validateDrawSnapshotForGeneration(completeDraw(), {
    drawVersion: "999",
    drawFingerprint: "draw-fp-aaa",
  });
  assert.ok(
    issues.some(
      (i) => i.code === MATCH_GENERATION_ISSUE_CODE.DRAW_VERSION_MISMATCH
    )
  );
});

test("1B rem: duplicate pairing is rejected", () => {
  const plan = buildCanonicalPlan();
  const m1 = plan.logicalMatches[0];
  const dupPair = createLogicalMatch({
    competitionId: "comp-1",
    divisionId: "div-1",
    categoryId: "cat-1",
    stageId: "stage-group",
    groupId: "g1",
    roundNumber: 1,
    matchNumber: 3,
    deterministicOrder: 3,
    participantSlotA: slotDirect("p1"),
    participantSlotB: slotDirect("p2"),
  });
  const issues = validateMatchPlanInvariants(
    createMatchPlan({
      ...plan,
      logicalMatches: [m1, plan.logicalMatches[1], dupPair],
      rounds: [
        createMatchPlanRound({
          roundId: "round-1",
          stageId: "stage-group",
          roundNumber: 1,
          roundOrder: 1,
          logicalMatchKeys: [
            m1.logicalMatchKey,
            plan.logicalMatches[1].logicalMatchKey,
            dupPair.logicalMatchKey,
          ],
        }),
      ],
      generationFingerprint: "",
    }),
    { requireGenerationFingerprintMatch: false }
  );
  assert.ok(
    issues.some(
      (i) => i.code === MATCH_GENERATION_ISSUE_CODE.FORBIDDEN_DUPLICATE_PAIRING
    )
  );
});

test("1B rem: winner and loser dependency paths validate correctly", () => {
  const key1 = buildLogicalMatchKey({
    competitionId: "c",
    divisionId: "d",
    stageId: "ko",
    roundNumber: 1,
    matchNumber: 1,
  });
  const key2 = buildLogicalMatchKey({
    competitionId: "c",
    divisionId: "d",
    stageId: "ko",
    roundNumber: 1,
    matchNumber: 2,
  });
  const keyFinal = buildLogicalMatchKey({
    competitionId: "c",
    divisionId: "d",
    stageId: "ko",
    roundNumber: 2,
    matchNumber: 1,
  });
  const keyConsolation = buildLogicalMatchKey({
    competitionId: "c",
    divisionId: "d",
    stageId: "ko",
    roundNumber: 2,
    matchNumber: 2,
  });

  const m1 = createLogicalMatch({
    logicalMatchKey: key1,
    competitionId: "c",
    divisionId: "d",
    stageId: "ko",
    roundNumber: 1,
    matchNumber: 1,
    deterministicOrder: 1,
    participantSlotA: slotDirect("a"),
    participantSlotB: slotDirect("b"),
    winnerTo: createMatchDependency({
      type: MATCH_DEPENDENCY_TYPE.WINNER_OF,
      logicalMatchKey: keyFinal,
    }),
    loserTo: createMatchDependency({
      type: MATCH_DEPENDENCY_TYPE.LOSER_OF,
      logicalMatchKey: keyConsolation,
    }),
  });
  const m2 = createLogicalMatch({
    logicalMatchKey: key2,
    competitionId: "c",
    divisionId: "d",
    stageId: "ko",
    roundNumber: 1,
    matchNumber: 2,
    deterministicOrder: 2,
    participantSlotA: slotDirect("c"),
    participantSlotB: slotDirect("d"),
    winnerTo: createMatchDependency({
      type: MATCH_DEPENDENCY_TYPE.WINNER_OF,
      logicalMatchKey: keyFinal,
    }),
  });
  const final = createLogicalMatch({
    logicalMatchKey: keyFinal,
    competitionId: "c",
    divisionId: "d",
    stageId: "ko",
    roundNumber: 2,
    matchNumber: 1,
    deterministicOrder: 3,
    participantSlotA: slotWinnerOf(key1),
    participantSlotB: slotWinnerOf(key2),
    dependencyInputs: [
      createMatchDependency({
        type: MATCH_DEPENDENCY_TYPE.WINNER_OF,
        logicalMatchKey: key1,
      }),
      createMatchDependency({
        type: MATCH_DEPENDENCY_TYPE.WINNER_OF,
        logicalMatchKey: key2,
      }),
    ],
  });
  const consolation = createLogicalMatch({
    logicalMatchKey: keyConsolation,
    competitionId: "c",
    divisionId: "d",
    stageId: "ko",
    roundNumber: 2,
    matchNumber: 2,
    deterministicOrder: 4,
    participantSlotA: slotLoserOf(key1),
    participantSlotB: slotDirect("e"),
    dependencyInputs: [
      createMatchDependency({
        type: MATCH_DEPENDENCY_TYPE.LOSER_OF,
        logicalMatchKey: key1,
      }),
    ],
  });

  const plan = createMatchPlan({
    competitionId: "c",
    divisionId: "d",
    stages: [
      createMatchPlanStage({
        stageId: "ko",
        stageOrder: 1,
        roundIds: ["r1", "r2"],
      }),
    ],
    rounds: [
      createMatchPlanRound({
        roundId: "r1",
        stageId: "ko",
        roundNumber: 1,
        roundOrder: 1,
        logicalMatchKeys: [key1, key2],
      }),
      createMatchPlanRound({
        roundId: "r2",
        stageId: "ko",
        roundNumber: 2,
        roundOrder: 2,
        logicalMatchKeys: [keyFinal, keyConsolation],
      }),
    ],
    logicalMatches: [m1, m2, final, consolation],
    drawFingerprint: "df",
    ruleEvaluationFingerprint: "rf",
    participantFingerprint: "pf",
    generatorVersion: MATCH_GENERATOR_IDENTITY.version,
    generationFingerprint: "",
  });

  const issues = validateMatchPlanInvariants(plan, {
    requireGenerationFingerprintMatch: false,
  });
  assert.equal(
    issues.filter(
      (i) =>
        i.code === MATCH_GENERATION_ISSUE_CODE.INVALID_WINNER_PATH ||
        i.code === MATCH_GENERATION_ISSUE_CODE.INVALID_LOSER_PATH
    ).length,
    0,
    JSON.stringify(issues)
  );

  // dangling loser path
  const bad = createLogicalMatch({
    ...m1,
    loserTo: createMatchDependency({
      type: MATCH_DEPENDENCY_TYPE.LOSER_OF,
      logicalMatchKey: "nope",
    }),
  });
  const badPlan = createMatchPlan({
    ...plan,
    logicalMatches: [bad, m2, final, consolation],
    generationFingerprint: "",
  });
  const badIssues = validateMatchPlanInvariants(badPlan, {
    requireGenerationFingerprintMatch: false,
  });
  assert.ok(
    badIssues.some(
      (i) =>
        i.code === MATCH_GENERATION_ISSUE_CODE.INVALID_LOSER_PATH ||
        i.code === MATCH_GENERATION_ISSUE_CODE.DANGLING_DEPENDENCY
    )
  );
});

test("1B rem: fixed rule port rejects unknown strategy before factory", async () => {
  const port = createFixedMatchGenerationRulePort({
    ruleSetId: "r",
    ruleSetVersion: "1",
    ruleEvaluationFingerprint: "f",
    generationStrategy: "CHAOS",
  });
  const result = await port.resolveEvaluatedRules({
    ruleEvaluationFingerprint: "f",
  });
  assert.equal(result.ok, false);
  assert.equal(
    result.issues[0].code,
    MATCH_GENERATION_ISSUE_CODE.STRATEGY_UNSUPPORTED
  );
});

test("1B rem: omitted policy defaults are documented enums only", () => {
  const rules = evaluatedRules();
  assert.equal(rules.roundRobinMode, ROUND_ROBIN_MODE.SINGLE);
  assert.equal(rules.byePolicy, BYE_POLICY.NONE);
  assert.equal(rules.bracketSizePolicy, BRACKET_SIZE_POLICY.POWER_OF_TWO);
  assert.equal(rules.thirdPlacePolicy, THIRD_PLACE_POLICY.NONE);
  assert.equal(rules.encounterCount, 1);
});
