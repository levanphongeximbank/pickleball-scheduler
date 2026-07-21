/**
 * CORE-09 Phase 1E — duplicate dependency-edge invariant + large-N stress.
 * Capability-local only. Not added to Integrator unit-test-files.json.
 */

import test from "node:test";
import assert from "node:assert/strict";
import { performance } from "node:perf_hooks";

import {
  MATCH_GENERATOR_IDENTITY,
  MATCH_GENERATION_STRATEGY,
  MATCH_GENERATION_ISSUE_CODE,
  MATCH_DEPENDENCY_TYPE,
  PARTICIPANT_SLOT_KIND,
  DRAW_COMPLETION_STATUS,
  ROUND_ROBIN_MODE,
  BYE_POLICY,
  BRACKET_SIZE_POLICY,
  THIRD_PLACE_POLICY,
  createMatchGenerationRequest,
  createMatchGenerationContext,
  createDrawSnapshot,
  createDrawPlacementRef,
  createEvaluatedMatchGenerationRules,
  createParticipantSnapshotRef,
  createLogicalMatch,
  createMatchPlan,
  createMatchPlanStage,
  createMatchPlanRound,
  createParticipantSlot,
  createMatchDependency,
  generateMatchPlan,
  fingerprintMatchPlan,
  validateMatchPlanInvariants,
  detectDependencyCycle,
  buildLogicalMatchKey,
  computeSingleEliminationBracket,
  expectedSingleRoundRobinPlayedMatches,
} from "../src/features/competition-core/match-generation/index.js";

/** @param {number} n @param {string} [prefix] */
function makeIds(n, prefix = "p") {
  return Array.from({ length: n }, (_, i) => `${prefix}${i + 1}`);
}

function rrDraw(participantIds) {
  return createDrawSnapshot({
    drawId: "draw-rr",
    drawVersion: "1",
    drawFingerprint: "fp-rr",
    competitionId: "comp-1",
    divisionId: "div-1",
    categoryId: "cat-1",
    completionStatus: DRAW_COMPLETION_STATUS.COMPLETE,
    stageDefinitions: [{ stageId: "stage-rr", order: 1 }],
    groupPlacements: [],
    bracketPlacements: [],
    participantPlacements: participantIds.map((id, i) =>
      createDrawPlacementRef({
        placementRef: `place-${id}`,
        participantId: id,
        position: i + 1,
      })
    ),
    byePlacements: [],
  });
}

function rrRules(overrides = {}) {
  return createEvaluatedMatchGenerationRules({
    ruleSetId: "rules-1",
    ruleSetVersion: "1",
    ruleEvaluationFingerprint: "rule-fp-rr",
    generationStrategy: MATCH_GENERATION_STRATEGY.ROUND_ROBIN,
    roundRobinMode: ROUND_ROBIN_MODE.SINGLE,
    encounterCount: 1,
    byePolicy: BYE_POLICY.NONE,
    ...overrides,
  });
}

function rrRequest(overrides = {}) {
  return createMatchGenerationRequest({
    competitionId: "comp-1",
    divisionId: "div-1",
    categoryId: "cat-1",
    stageId: "stage-rr",
    strategy: MATCH_GENERATION_STRATEGY.ROUND_ROBIN,
    drawReference: {
      drawId: "draw-rr",
      drawVersion: "1",
      drawFingerprint: "fp-rr",
    },
    evaluatedRuleReference: {
      ruleSetId: "rules-1",
      ruleSetVersion: "1",
      ruleEvaluationFingerprint: "rule-fp-rr",
    },
    participantSnapshotReference: {
      snapshotId: "part-snap",
      participantFingerprint: "part-fp-rr",
    },
    generatorVersion: MATCH_GENERATOR_IDENTITY.version,
    ...overrides,
  });
}

function rrContext(draw, evaluated, participantIds) {
  return createMatchGenerationContext({
    drawSnapshot: draw,
    evaluatedRules: evaluated,
    participantSnapshot: createParticipantSnapshotRef({
      snapshotId: "part-snap",
      participantFingerprint: "part-fp-rr",
      participantIds,
    }),
    deterministicOrderingInputs: participantIds.map((id) => `place:${id}`),
    generatorVersion: MATCH_GENERATOR_IDENTITY.version,
  });
}

function seDraw(participantIds) {
  const N = participantIds.length;
  const dims = computeSingleEliminationBracket(
    N,
    BRACKET_SIZE_POLICY.EXACT
  );
  assert.equal(dims.ok, true);
  const placements = participantIds.map((id, i) =>
    createDrawPlacementRef({
      placementRef: `place-${id}`,
      participantId: id,
      position: i + 1,
      isBye: false,
      bracketId: "br-1",
    })
  );
  return createDrawSnapshot({
    drawId: "draw-se",
    drawVersion: "1",
    drawFingerprint: "fp-se",
    competitionId: "comp-1",
    divisionId: "div-1",
    categoryId: "cat-1",
    completionStatus: DRAW_COMPLETION_STATUS.COMPLETE,
    stageDefinitions: [{ stageId: "stage-se", order: 1 }],
    groupPlacements: [],
    bracketPlacements: [{ bracketId: "br-1", order: 1 }],
    participantPlacements: placements,
    byePlacements: [],
  });
}

function seRules(overrides = {}) {
  return createEvaluatedMatchGenerationRules({
    ruleSetId: "rules-se",
    ruleSetVersion: "1",
    ruleEvaluationFingerprint: "rule-fp-se",
    generationStrategy: MATCH_GENERATION_STRATEGY.SINGLE_ELIMINATION,
    encounterCount: 1,
    bracketSizePolicy: BRACKET_SIZE_POLICY.EXACT,
    byePolicy: BYE_POLICY.NONE,
    thirdPlacePolicy: THIRD_PLACE_POLICY.NONE,
    ...overrides,
  });
}

function seRequest(overrides = {}) {
  return createMatchGenerationRequest({
    competitionId: "comp-1",
    divisionId: "div-1",
    categoryId: "cat-1",
    stageId: "stage-se",
    strategy: MATCH_GENERATION_STRATEGY.SINGLE_ELIMINATION,
    drawReference: {
      drawId: "draw-se",
      drawVersion: "1",
      drawFingerprint: "fp-se",
    },
    evaluatedRuleReference: {
      ruleSetId: "rules-se",
      ruleSetVersion: "1",
      ruleEvaluationFingerprint: "rule-fp-se",
    },
    participantSnapshotReference: {
      snapshotId: "part-snap-se",
      participantFingerprint: "part-fp-se",
    },
    generatorVersion: MATCH_GENERATOR_IDENTITY.version,
    ...overrides,
  });
}

function seContext(draw, evaluated, participantIds) {
  return createMatchGenerationContext({
    drawSnapshot: draw,
    evaluatedRules: evaluated,
    participantSnapshot: createParticipantSnapshotRef({
      snapshotId: "part-snap-se",
      participantFingerprint: "part-fp-se",
      participantIds,
    }),
    deterministicOrderingInputs: participantIds.map((id) => `place:${id}`),
    generatorVersion: MATCH_GENERATOR_IDENTITY.version,
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

function slotDirect(participantId) {
  return createParticipantSlot({
    kind: PARTICIPANT_SLOT_KIND.DIRECT_PARTICIPANT,
    participantId,
  });
}

/**
 * @param {import('../src/features/competition-core/match-generation/contracts/matchPlan.js').MatchPlan} plan
 */
function assertStableOrdering(plan) {
  const orders = plan.logicalMatches.map((m) => m.deterministicOrder);
  assert.deepEqual(orders, [...orders].sort((a, b) => a - b));
  for (let i = 1; i < orders.length; i += 1) {
    assert.ok(orders[i] > orders[i - 1], "deterministicOrder must be strictly increasing");
  }
}

/**
 * @param {import('../src/features/competition-core/match-generation/contracts/matchPlan.js').MatchPlan} plan
 */
function assertUniqueMatchKeys(plan) {
  const keys = plan.logicalMatches.map((m) => m.logicalMatchKey);
  assert.equal(keys.length, new Set(keys).size);
}

/**
 * @param {() => void} fn
 * @param {number} maxHeapDeltaBytes
 */
function assertBoundedHeap(fn, maxHeapDeltaBytes) {
  if (globalThis.gc) globalThis.gc();
  const before = process.memoryUsage().heapUsed;
  fn();
  if (globalThis.gc) globalThis.gc();
  const after = process.memoryUsage().heapUsed;
  const delta = after - before;
  assert.ok(
    delta <= maxHeapDeltaBytes,
    `heap delta ${(delta / 1024 / 1024).toFixed(2)}MB exceeds ${(maxHeapDeltaBytes / 1024 / 1024).toFixed(0)}MB cap`
  );
}

// --- Phase 1E: duplicate dependency-edge invariant ---

test("1E-01: duplicate dependencyInputs edge rejected", () => {
  const srcKey = buildLogicalMatchKey({
    competitionId: "c",
    divisionId: "d",
    stageId: "ko",
    roundNumber: 1,
    matchNumber: 1,
  });
  const finalKey = buildLogicalMatchKey({
    competitionId: "c",
    divisionId: "d",
    stageId: "ko",
    roundNumber: 2,
    matchNumber: 1,
  });

  const src = createLogicalMatch({
    logicalMatchKey: srcKey,
    competitionId: "c",
    divisionId: "d",
    stageId: "ko",
    roundNumber: 1,
    matchNumber: 1,
    deterministicOrder: 1,
    participantSlotA: slotDirect("a"),
    participantSlotB: slotDirect("b"),
  });
  const final = createLogicalMatch({
    logicalMatchKey: finalKey,
    competitionId: "c",
    divisionId: "d",
    stageId: "ko",
    roundNumber: 2,
    matchNumber: 1,
    deterministicOrder: 2,
    participantSlotA: slotWinnerOf(srcKey),
    participantSlotB: slotDirect("c"),
    dependencyInputs: [
      createMatchDependency({
        type: MATCH_DEPENDENCY_TYPE.WINNER_OF,
        logicalMatchKey: srcKey,
      }),
      createMatchDependency({
        type: MATCH_DEPENDENCY_TYPE.WINNER_OF,
        logicalMatchKey: srcKey,
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
        logicalMatchKeys: [srcKey],
      }),
      createMatchPlanRound({
        roundId: "r2",
        stageId: "ko",
        roundNumber: 2,
        roundOrder: 2,
        logicalMatchKeys: [finalKey],
      }),
    ],
    logicalMatches: [src, final],
    drawFingerprint: "df",
    ruleEvaluationFingerprint: "rf",
    participantFingerprint: "pf",
    generatorVersion: MATCH_GENERATOR_IDENTITY.version,
    generationFingerprint: "",
  });

  const issues = validateMatchPlanInvariants(plan, {
    requireGenerationFingerprintMatch: false,
  });
  assert.ok(
    issues.some(
      (i) => i.code === MATCH_GENERATION_ISSUE_CODE.DUPLICATE_DEPENDENCY_EDGE
    )
  );
  const dup = issues.find(
    (i) => i.code === MATCH_GENERATION_ISSUE_CODE.DUPLICATE_DEPENDENCY_EDGE
  );
  assert.equal(dup.details.dependencyType, MATCH_DEPENDENCY_TYPE.WINNER_OF);
  assert.equal(dup.details.referencedLogicalMatchKey, srcKey);
  assert.equal(dup.details.count, 2);
});

test("1E-02: distinct dependencyInputs edges remain valid", () => {
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
  const finalKey = buildLogicalMatchKey({
    competitionId: "c",
    divisionId: "d",
    stageId: "ko",
    roundNumber: 2,
    matchNumber: 1,
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
  });
  const final = createLogicalMatch({
    logicalMatchKey: finalKey,
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
        logicalMatchKeys: [finalKey],
      }),
    ],
    logicalMatches: [m1, m2, final],
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
      (i) => i.code === MATCH_GENERATION_ISSUE_CODE.DUPLICATE_DEPENDENCY_EDGE
    ).length,
    0
  );
});

test("1E-03: generated Single Elimination plans have no duplicate dependency edges", () => {
  const ids = makeIds(8, "s");
  const draw = seDraw(ids);
  const evaluated = seRules();
  const result = generateMatchPlan(seRequest(), seContext(draw, evaluated, ids));
  assert.equal(result.ok, true);
  const issues = validateMatchPlanInvariants(result.matchPlan, {
    boundDrawSnapshot: draw,
    expectedDrawFingerprint: draw.drawFingerprint,
    expectedRuleEvaluationFingerprint: evaluated.ruleEvaluationFingerprint,
    expectedParticipantFingerprint: "part-fp-se",
    strategy: MATCH_GENERATION_STRATEGY.SINGLE_ELIMINATION,
    deterministicOrderingInputs: ids.map((id) => `place:${id}`),
    requireGenerationFingerprintMatch: true,
  });
  assert.equal(
    issues.filter(
      (i) => i.code === MATCH_GENERATION_ISSUE_CODE.DUPLICATE_DEPENDENCY_EDGE
    ).length,
    0
  );
});

// --- Phase 1E: large-N deterministic stress ---

test("1E-stress-RR-128: deterministic fingerprint and stable ordering", () => {
  const ids = makeIds(128, "r");
  const draw = rrDraw(ids);
  const evaluated = rrRules();
  const request = rrRequest();
  const context = rrContext(draw, evaluated, ids);

  const t0 = performance.now();
  const r1 = generateMatchPlan(request, context);
  const t1 = performance.now();
  const r2 = generateMatchPlan(request, context);
  const t2 = performance.now();

  assert.equal(r1.ok, true);
  assert.equal(r2.ok, true);
  assert.equal(
    r1.matchPlan.generationFingerprint,
    r2.matchPlan.generationFingerprint
  );
  assert.equal(
    r1.matchPlan.generationFingerprint,
    fingerprintMatchPlan(r1.matchPlan, {
      strategy: MATCH_GENERATION_STRATEGY.ROUND_ROBIN,
      deterministicOrderingInputs: context.deterministicOrderingInputs,
    })
  );

  const played = r1.matchPlan.logicalMatches.filter((m) => m.isByeMatch !== true);
  assert.equal(played.length, expectedSingleRoundRobinPlayedMatches(128));
  assertStableOrdering(r1.matchPlan);
  assertUniqueMatchKeys(r1.matchPlan);
  assert.equal(detectDependencyCycle(r1.matchPlan), null);

  const inv = validateMatchPlanInvariants(r1.matchPlan, {
    boundDrawSnapshot: draw,
    expectedDrawFingerprint: draw.drawFingerprint,
    expectedRuleEvaluationFingerprint: evaluated.ruleEvaluationFingerprint,
    expectedParticipantFingerprint: "part-fp-rr",
    strategy: MATCH_GENERATION_STRATEGY.ROUND_ROBIN,
    deterministicOrderingInputs: context.deterministicOrderingInputs,
    requireGenerationFingerprintMatch: true,
    maxDirectPairOccurrences: 1,
  });
  assert.deepEqual(inv, []);

  assert.ok(t1 - t0 < 5000, `RR N=128 first run ${(t1 - t0).toFixed(0)}ms`);
  assert.ok(t2 - t1 < 5000, `RR N=128 repeat run ${(t2 - t1).toFixed(0)}ms`);

  assertBoundedHeap(() => {
    generateMatchPlan(request, context);
  }, 256 * 1024 * 1024);
});

test("1E-stress-SE-1024: graph integrity and deterministic output", () => {
  const ids = makeIds(1024, "s");
  const draw = seDraw(ids);
  const evaluated = seRules();
  const request = seRequest();
  const context = seContext(draw, evaluated, ids);

  const t0 = performance.now();
  const r1 = generateMatchPlan(request, context);
  const t1 = performance.now();
  const r2 = generateMatchPlan(request, context);
  const t2 = performance.now();

  assert.equal(r1.ok, true);
  assert.equal(r2.ok, true);
  assert.equal(r1.matchPlan.logicalMatches.length, 1023);
  assert.equal(
    r1.matchPlan.generationFingerprint,
    r2.matchPlan.generationFingerprint
  );

  assertStableOrdering(r1.matchPlan);
  assertUniqueMatchKeys(r1.matchPlan);
  assert.equal(detectDependencyCycle(r1.matchPlan), null);

  const inv = validateMatchPlanInvariants(r1.matchPlan, {
    boundDrawSnapshot: draw,
    expectedDrawFingerprint: draw.drawFingerprint,
    expectedRuleEvaluationFingerprint: evaluated.ruleEvaluationFingerprint,
    expectedParticipantFingerprint: "part-fp-se",
    strategy: MATCH_GENERATION_STRATEGY.SINGLE_ELIMINATION,
    deterministicOrderingInputs: context.deterministicOrderingInputs,
    requireGenerationFingerprintMatch: true,
    maxDirectPairOccurrences: 1,
  });
  assert.deepEqual(inv, []);

  assert.ok(t1 - t0 < 15000, `SE N=1024 first run ${(t1 - t0).toFixed(0)}ms`);
  assert.ok(t2 - t1 < 15000, `SE N=1024 repeat run ${(t2 - t1).toFixed(0)}ms`);

  assertBoundedHeap(() => {
    generateMatchPlan(request, context);
  }, 512 * 1024 * 1024);
});

test("1E-stress-GROUP-8x16: cross-group isolation at scale", () => {
  /** @type {[string, string[]][]} */
  const groups = [];
  for (let g = 1; g <= 8; g += 1) {
    groups.push([`g${g}`, makeIds(16, `g${g}-`)]);
  }

  /** @type {ReturnType<typeof createDrawPlacementRef>[]} */
  const placements = [];
  const catalog = [];
  for (const [groupId, ids] of groups) {
    catalog.push({ groupId, id: groupId });
    for (let i = 0; i < ids.length; i += 1) {
      placements.push(
        createDrawPlacementRef({
          placementRef: `${groupId}-${ids[i]}`,
          participantId: ids[i],
          groupId,
          position: i + 1,
        })
      );
    }
  }

  const allIds = groups.flatMap(([, ids]) => ids);
  const draw = createDrawSnapshot({
    drawId: "draw-gr",
    drawVersion: "1",
    drawFingerprint: "fp-gr",
    competitionId: "comp-1",
    divisionId: "div-1",
    categoryId: "cat-1",
    completionStatus: DRAW_COMPLETION_STATUS.COMPLETE,
    stageDefinitions: [{ stageId: "stage-gr", order: 1 }],
    groupPlacements: catalog,
    bracketPlacements: [],
    participantPlacements: placements,
    byePlacements: [],
  });

  const evaluated = rrRules({
    generationStrategy: MATCH_GENERATION_STRATEGY.GROUP_ROUND_ROBIN,
    ruleEvaluationFingerprint: "rule-fp-gr",
  });
  const request = rrRequest({
    stageId: "stage-gr",
    strategy: MATCH_GENERATION_STRATEGY.GROUP_ROUND_ROBIN,
    drawReference: {
      drawId: "draw-gr",
      drawVersion: "1",
      drawFingerprint: "fp-gr",
    },
    evaluatedRuleReference: {
      ruleSetId: "rules-1",
      ruleSetVersion: "1",
      ruleEvaluationFingerprint: "rule-fp-gr",
    },
    participantSnapshotReference: {
      snapshotId: "part-snap-gr",
      participantFingerprint: "part-fp-gr",
    },
  });
  const context = createMatchGenerationContext({
    drawSnapshot: draw,
    evaluatedRules: evaluated,
    participantSnapshot: createParticipantSnapshotRef({
      snapshotId: "part-snap-gr",
      participantFingerprint: "part-fp-gr",
      participantIds: allIds,
    }),
    deterministicOrderingInputs: allIds.map((id) => `place:${id}`),
    generatorVersion: MATCH_GENERATOR_IDENTITY.version,
  });

  const r1 = generateMatchPlan(request, context);
  const r2 = generateMatchPlan(request, context);
  assert.equal(r1.ok, true);
  assert.equal(r2.ok, true);
  assert.equal(
    r1.matchPlan.generationFingerprint,
    r2.matchPlan.generationFingerprint
  );
  assertStableOrdering(r1.matchPlan);
  assertUniqueMatchKeys(r1.matchPlan);

  for (const m of r1.matchPlan.logicalMatches) {
    if (m.isByeMatch) continue;
    const a = m.participantSlotA?.participantId;
    const b = m.participantSlotB?.participantId;
    if (!a || !b) continue;
    const aGroup = placements.find((p) => p.participantId === a)?.groupId;
    const bGroup = placements.find((p) => p.participantId === b)?.groupId;
    assert.equal(aGroup, bGroup);
    assert.equal(m.groupId, aGroup);
  }

  const inv = validateMatchPlanInvariants(r1.matchPlan, {
    boundDrawSnapshot: draw,
    expectedDrawFingerprint: draw.drawFingerprint,
    expectedRuleEvaluationFingerprint: evaluated.ruleEvaluationFingerprint,
    expectedParticipantFingerprint: "part-fp-gr",
    strategy: MATCH_GENERATION_STRATEGY.GROUP_ROUND_ROBIN,
    deterministicOrderingInputs: context.deterministicOrderingInputs,
    requireGenerationFingerprintMatch: true,
    maxDirectPairOccurrences: 1,
  });
  assert.deepEqual(inv, []);
});
