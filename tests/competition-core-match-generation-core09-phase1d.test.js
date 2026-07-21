/**
 * CORE-09 Phase 1D — Single Elimination Match Generator tests.
 * Capability-local only. Not added to Integrator unit-test-files.json.
 */

import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync, readdirSync, statSync, existsSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import {
  MATCH_GENERATOR_IDENTITY,
  MATCH_GENERATION_STRATEGY,
  MATCH_GENERATION_ISSUE_CODE,
  PARTICIPANT_SLOT_KIND,
  MATCH_DEPENDENCY_TYPE,
  DRAW_COMPLETION_STATUS,
  BYE_POLICY,
  BRACKET_SIZE_POLICY,
  THIRD_PLACE_POLICY,
  FORBIDDEN_MATCH_PLAN_FIELDS,
  createMatchGenerationRequest,
  createMatchGenerationContext,
  createDrawSnapshot,
  createDrawPlacementRef,
  createEvaluatedMatchGenerationRules,
  createParticipantSnapshotRef,
  generateMatchPlan,
  fingerprintMatchPlan,
  validateMatchPlanInvariants,
  findForbiddenNondeterminismPatterns,
  hasForbiddenSchedulingFields,
  computeSingleEliminationBracket,
  expectedLogicalMatchCount,
  expectedPlayedMatchCount,
} from "../src/features/competition-core/match-generation/index.js";

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

/**
 * Build Draw with explicit bracket positions 1..B.
 * byePositions: 1-based positions that are Draw-owned byes.
 * participantIds assigned to remaining positions in ascending position order.
 */
function seDraw(participantIds, byePositions = [], overrides = {}) {
  const N = participantIds.length;
  const dims = computeSingleEliminationBracket(
    N,
    BRACKET_SIZE_POLICY.POWER_OF_TWO
  );
  assert.equal(dims.ok, true);
  const B = dims.bracketSize;
  const byeSet = new Set(byePositions);
  assert.equal(byeSet.size, dims.byeCount);

  /** @type {ReturnType<typeof createDrawPlacementRef>[]} */
  const placements = [];
  let pi = 0;
  for (let pos = 1; pos <= B; pos += 1) {
    if (byeSet.has(pos)) {
      placements.push(
        createDrawPlacementRef({
          placementRef: `bye-slot-${pos}`,
          participantId: null,
          position: pos,
          isBye: true,
          bracketId: "br-1",
        })
      );
    } else {
      const id = participantIds[pi++];
      placements.push(
        createDrawPlacementRef({
          placementRef: `place-${id}`,
          participantId: id,
          position: pos,
          isBye: false,
          bracketId: "br-1",
        })
      );
    }
  }
  assert.equal(pi, N);

  return createDrawSnapshot({
    drawId: "draw-se-1",
    drawVersion: "1",
    drawFingerprint: "draw-fp-se",
    competitionId: "comp-1",
    divisionId: "div-1",
    categoryId: "cat-1",
    completionStatus: DRAW_COMPLETION_STATUS.COMPLETE,
    stageDefinitions: [{ stageId: "stage-se", order: 1 }],
    groupPlacements: [],
    bracketPlacements: [{ bracketId: "br-1", order: 1 }],
    participantPlacements: placements,
    byePlacements: [],
    seedReferences: [],
    ...overrides,
  });
}

function seRules(overrides = {}) {
  return createEvaluatedMatchGenerationRules({
    ruleSetId: "rules-1",
    ruleSetVersion: "1",
    ruleEvaluationFingerprint: "rule-fp-se",
    generationStrategy: MATCH_GENERATION_STRATEGY.SINGLE_ELIMINATION,
    encounterCount: 1,
    bracketSizePolicy: BRACKET_SIZE_POLICY.POWER_OF_TWO,
    byePolicy: BYE_POLICY.EXPLICIT_PLACEMENTS,
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
      drawId: "draw-se-1",
      drawVersion: "1",
      drawFingerprint: "draw-fp-se",
    },
    evaluatedRuleReference: {
      ruleSetId: "rules-1",
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

function seContext(draw, evaluated, ordering = null) {
  const ids = (draw.participantPlacements || [])
    .filter((p) => p.isBye !== true && p.participantId)
    .map((p) => p.participantId);
  return createMatchGenerationContext({
    drawSnapshot: draw,
    evaluatedRules: evaluated,
    participantSnapshot: createParticipantSnapshotRef({
      snapshotId: "part-snap-se",
      participantFingerprint: "part-fp-se",
      participantIds: ids,
    }),
    deterministicOrderingInputs:
      ordering || ids.map((id) => `placement:${id}`),
    generatorVersion: MATCH_GENERATOR_IDENTITY.version,
  });
}

function generate(participantIds, byePositions, ruleOverrides = {}) {
  const draw = seDraw(participantIds, byePositions);
  const evaluated = seRules({
    byePolicy:
      byePositions.length > 0
        ? BYE_POLICY.EXPLICIT_PLACEMENTS
        : BYE_POLICY.NONE,
    ...ruleOverrides,
  });
  return {
    draw,
    evaluated,
    result: generateMatchPlan(seRequest(), seContext(draw, evaluated)),
  };
}

function played(plan) {
  return (plan.logicalMatches || []).filter((m) => m.isByeMatch !== true);
}

function byes(plan) {
  return (plan.logicalMatches || []).filter((m) => m.isByeMatch === true);
}

function finalMatch(plan, rounds) {
  return plan.logicalMatches.find(
    (m) => m.roundNumber === rounds && m.matchNumber === 1
  );
}

function thirdMatch(plan, rounds) {
  return plan.logicalMatches.find(
    (m) => m.roundNumber === rounds && m.matchNumber === 2
  );
}

// --- Mathematics helpers ---

test("1D-math: N=2..9 bracket dimensions", () => {
  const table = [
    [2, 2, 1, 0, 1, 1],
    [3, 4, 2, 1, 2, 3],
    [4, 4, 2, 0, 3, 3],
    [5, 8, 3, 3, 4, 7],
    [6, 8, 3, 2, 5, 7],
    [7, 8, 3, 1, 6, 7],
    [8, 8, 3, 0, 7, 7],
    [9, 16, 4, 7, 8, 15],
  ];
  for (const [N, B, R, byesN, playedN, logical] of table) {
    const d = computeSingleEliminationBracket(N, BRACKET_SIZE_POLICY.POWER_OF_TWO);
    assert.equal(d.ok, true);
    assert.equal(d.bracketSize, B);
    assert.equal(d.championshipRoundCount, R);
    assert.equal(d.byeCount, byesN);
    assert.equal(expectedPlayedMatchCount(N, false), playedN);
    assert.equal(expectedLogicalMatchCount(B, false), logical);
  }
});

// --- Happy paths N=2..9 ---

test("1D-01: N=2 final only", () => {
  const { result } = generate(["a", "b"], []);
  assert.equal(result.ok, true);
  assert.equal(result.matchPlan.logicalMatches.length, 1);
  assert.equal(played(result.matchPlan).length, 1);
  assert.equal(byes(result.matchPlan).length, 0);
  const fin = finalMatch(result.matchPlan, 1);
  assert.ok(fin);
  assert.equal(fin.matchNumber, 1);
  assert.equal(fin.participantSlotA.kind, PARTICIPANT_SLOT_KIND.DIRECT_PARTICIPANT);
  assert.equal(fin.participantSlotB.kind, PARTICIPANT_SLOT_KIND.DIRECT_PARTICIPANT);
  assert.equal(fin.winnerTo, null);
});

test("1D-02: N=3 one explicit bye", () => {
  const { result } = generate(["a", "b", "c"], [2]);
  assert.equal(result.ok, true);
  assert.equal(result.matchPlan.logicalMatches.length, 3);
  assert.equal(byes(result.matchPlan).length, 1);
  assert.equal(played(result.matchPlan).length, 2);
  assert.equal(result.diagnostics.byeCount, 1);
});

test("1D-03: N=4 full semifinal/final", () => {
  const { result } = generate(["a", "b", "c", "d"], []);
  assert.equal(result.ok, true);
  assert.equal(result.matchPlan.logicalMatches.length, 3);
  assert.equal(played(result.matchPlan).length, 3);
  const fin = finalMatch(result.matchPlan, 2);
  assert.equal(fin.participantSlotA.kind, PARTICIPANT_SLOT_KIND.WINNER_OF);
  assert.equal(fin.participantSlotB.kind, PARTICIPANT_SLOT_KIND.WINNER_OF);
});

test("1D-04: N=5 three byes", () => {
  const { result } = generate(["a", "b", "c", "d", "e"], [2, 4, 6]);
  assert.equal(result.ok, true);
  assert.equal(byes(result.matchPlan).length, 3);
  assert.equal(played(result.matchPlan).length, 4);
  assert.equal(result.matchPlan.logicalMatches.length, 7);
});

test("1D-05: N=6 two byes", () => {
  const { result } = generate(["a", "b", "c", "d", "e", "f"], [2, 6]);
  assert.equal(result.ok, true);
  assert.equal(byes(result.matchPlan).length, 2);
  assert.equal(played(result.matchPlan).length, 5);
});

test("1D-06: N=7 one bye", () => {
  const { result } = generate(
    ["a", "b", "c", "d", "e", "f", "g"],
    [8]
  );
  assert.equal(result.ok, true);
  assert.equal(byes(result.matchPlan).length, 1);
  assert.equal(played(result.matchPlan).length, 6);
});

test("1D-07: N=8 full bracket", () => {
  const { result } = generate(
    ["a", "b", "c", "d", "e", "f", "g", "h"],
    []
  );
  assert.equal(result.ok, true);
  assert.equal(result.matchPlan.logicalMatches.length, 7);
  assert.equal(played(result.matchPlan).length, 7);
  assert.equal(byes(result.matchPlan).length, 0);
});

test("1D-08: N=9 seven byes", () => {
  const { result } = generate(
    ["a", "b", "c", "d", "e", "f", "g", "h", "i"],
    [2, 4, 6, 8, 10, 12, 14]
  );
  assert.equal(result.ok, true);
  assert.equal(byes(result.matchPlan).length, 7);
  assert.equal(played(result.matchPlan).length, 8);
  assert.equal(result.matchPlan.logicalMatches.length, 15);
});

test("1D-09: championship played count equals N-1", () => {
  for (const [ids, byesPos] of [
    [["a", "b"], []],
    [["a", "b", "c"], [1]],
    [["a", "b", "c", "d", "e"], [2, 4, 8]],
  ]) {
    const { result } = generate(ids, byesPos);
    assert.equal(result.ok, true);
    assert.equal(played(result.matchPlan).length, ids.length - 1);
  }
});

test("1D-10: LogicalMatch count equals B-1", () => {
  const { result } = generate(["a", "b", "c", "d", "e", "f"], [2, 4]);
  assert.equal(result.ok, true);
  assert.equal(result.matchPlan.logicalMatches.length, 7);
});

test("1D-11: exact bye count", () => {
  const { result } = generate(["a", "b", "c"], [4]);
  assert.equal(result.ok, true);
  assert.equal(result.diagnostics.byeCount, 1);
  assert.equal(byes(result.matchPlan).length, 1);
});

test("1D-12: no double-bye match", () => {
  const { result } = generate(["a", "b", "c", "d", "e"], [2, 4, 6]);
  assert.equal(result.ok, true);
  for (const m of result.matchPlan.logicalMatches) {
    const aBye = m.participantSlotA.kind === PARTICIPANT_SLOT_KIND.BYE;
    const bBye = m.participantSlotB.kind === PARTICIPANT_SLOT_KIND.BYE;
    assert.equal(aBye && bBye, false);
  }
});

test("1D-13: stable match ordering", () => {
  const { result } = generate(["a", "b", "c", "d"], []);
  const orders = result.matchPlan.logicalMatches.map((m) => m.deterministicOrder);
  assert.deepEqual(orders, [...orders].sort((x, y) => x - y));
});

test("1D-14: stable LogicalMatch keys", () => {
  const { result: r1 } = generate(["a", "b", "c", "d"], []);
  const { result: r2 } = generate(["a", "b", "c", "d"], []);
  assert.deepEqual(
    r1.matchPlan.logicalMatches.map((m) => m.logicalMatchKey),
    r2.matchPlan.logicalMatches.map((m) => m.logicalMatchKey)
  );
});

test("1D-15: deterministic repeated generation", () => {
  const { result: r1 } = generate(["a", "b", "c", "d", "e"], [2, 4, 6]);
  const { result: r2 } = generate(["a", "b", "c", "d", "e"], [2, 4, 6]);
  assert.equal(r1.matchPlan.generationFingerprint, r2.matchPlan.generationFingerprint);
  assert.deepEqual(
    r1.matchPlan.logicalMatches.map((m) => m.logicalMatchKey),
    r2.matchPlan.logicalMatches.map((m) => m.logicalMatchKey)
  );
});

test("1D-16: Draw placement coordinates preserved", () => {
  const { result } = generate(["z", "m", "a"], [2]);
  assert.equal(result.ok, true);
  const opening = result.matchPlan.logicalMatches.filter((m) => m.roundNumber === 1);
  const directs = opening.flatMap((m) =>
    [m.participantSlotA, m.participantSlotB]
      .filter((s) => s.kind === PARTICIPANT_SLOT_KIND.DIRECT_PARTICIPANT)
      .map((s) => s.participantId)
  );
  assert.deepEqual(new Set(directs), new Set(["z", "m", "a"]));
  assert.deepEqual(result.diagnostics.slotOrder[0], "z@1");
  assert.deepEqual(result.diagnostics.slotOrder[1], "BYE@2");
});

test("1D-17: no participant reshuffling from Draw positions", () => {
  const { result } = generate(["p3", "p1", "p2", "p4"], []);
  const r1 = result.matchPlan.logicalMatches.filter((m) => m.roundNumber === 1);
  assert.equal(r1[0].participantSlotA.participantId, "p3");
  assert.equal(r1[0].participantSlotB.participantId, "p1");
  assert.equal(r1[1].participantSlotA.participantId, "p2");
  assert.equal(r1[1].participantSlotB.participantId, "p4");
});

test("1D-18: winner dependency graph", () => {
  const { result } = generate(["a", "b", "c", "d"], []);
  const fin = finalMatch(result.matchPlan, 2);
  assert.equal(fin.dependencyInputs.length, 2);
  assert.ok(
    fin.dependencyInputs.every((d) => d.type === MATCH_DEPENDENCY_TYPE.WINNER_OF)
  );
});

test("1D-19: winnerTo reverse links", () => {
  const { result } = generate(["a", "b", "c", "d"], []);
  const semis = result.matchPlan.logicalMatches.filter((m) => m.roundNumber === 1);
  const fin = finalMatch(result.matchPlan, 2);
  for (const s of semis) {
    assert.equal(s.winnerTo.logicalMatchKey, fin.logicalMatchKey);
  }
});

test("1D-20: no cycles", () => {
  const { result } = generate(["a", "b", "c", "d", "e", "f", "g", "h"], []);
  const inv = validateMatchPlanInvariants(result.matchPlan, {
    strategy: MATCH_GENERATION_STRATEGY.SINGLE_ELIMINATION,
    requireGenerationFingerprintMatch: false,
  });
  assert.equal(
    inv.some((i) => i.code === MATCH_GENERATION_ISSUE_CODE.DEPENDENCY_CYCLE),
    false
  );
});

test("1D-21: no dangling dependencies", () => {
  const { result } = generate(["a", "b", "c", "d"], []);
  const inv = validateMatchPlanInvariants(result.matchPlan, {
    strategy: MATCH_GENERATION_STRATEGY.SINGLE_ELIMINATION,
    requireGenerationFingerprintMatch: false,
  });
  assert.equal(
    inv.some((i) => i.code === MATCH_GENERATION_ISSUE_CODE.DANGLING_DEPENDENCY),
    false
  );
});

test("1D-22: no forward-round references", () => {
  const { result } = generate(["a", "b", "c", "d", "e", "f", "g", "h"], []);
  const byKey = new Map(
    result.matchPlan.logicalMatches.map((m) => [m.logicalMatchKey, m])
  );
  for (const m of result.matchPlan.logicalMatches) {
    for (const slot of [m.participantSlotA, m.participantSlotB]) {
      if (!slot.sourceLogicalMatchKey) continue;
      const src = byKey.get(slot.sourceLogicalMatchKey);
      assert.ok(src);
      assert.ok(src.roundNumber < m.roundNumber);
    }
  }
});

test("1D-23: no orphan winnerTo targets", () => {
  const { result } = generate(["a", "b", "c", "d"], []);
  const keys = new Set(
    result.matchPlan.logicalMatches.map((m) => m.logicalMatchKey)
  );
  for (const m of result.matchPlan.logicalMatches) {
    if (m.winnerTo?.logicalMatchKey) {
      assert.ok(keys.has(m.winnerTo.logicalMatchKey));
    }
  }
});

// --- Third place ---

test("1D-24: N=4 third-place PLAYOFF", () => {
  const { result } = generate(["a", "b", "c", "d"], [], {
    thirdPlacePolicy: THIRD_PLACE_POLICY.PLAYOFF,
  });
  assert.equal(result.ok, true);
  assert.equal(result.matchPlan.logicalMatches.length, 4);
  assert.equal(played(result.matchPlan).length, 4);
  assert.ok(thirdMatch(result.matchPlan, 2));
});

test("1D-25: N=8 third-place PLAYOFF", () => {
  const { result } = generate(
    ["a", "b", "c", "d", "e", "f", "g", "h"],
    [],
    { thirdPlacePolicy: THIRD_PLACE_POLICY.PLAYOFF }
  );
  assert.equal(result.ok, true);
  assert.equal(result.matchPlan.logicalMatches.length, 8);
  const third = thirdMatch(result.matchPlan, 3);
  assert.ok(third);
  assert.equal(third.matchNumber, 2);
});

test("1D-26: third-place uses LOSER_OF semifinals", () => {
  const { result } = generate(["a", "b", "c", "d"], [], {
    thirdPlacePolicy: THIRD_PLACE_POLICY.PLAYOFF,
  });
  const third = thirdMatch(result.matchPlan, 2);
  assert.equal(third.participantSlotA.kind, PARTICIPANT_SLOT_KIND.LOSER_OF);
  assert.equal(third.participantSlotB.kind, PARTICIPANT_SLOT_KIND.LOSER_OF);
});

test("1D-27: semifinal loserTo links", () => {
  const { result } = generate(["a", "b", "c", "d"], [], {
    thirdPlacePolicy: THIRD_PLACE_POLICY.PLAYOFF,
  });
  const third = thirdMatch(result.matchPlan, 2);
  const semis = result.matchPlan.logicalMatches.filter((m) => m.roundNumber === 1);
  assert.equal(semis.length, 2);
  for (const s of semis) {
    assert.equal(s.loserTo.logicalMatchKey, third.logicalMatchKey);
  }
});

test("1D-28: final uses WINNER_OF semifinals", () => {
  const { result } = generate(["a", "b", "c", "d"], [], {
    thirdPlacePolicy: THIRD_PLACE_POLICY.PLAYOFF,
  });
  const fin = finalMatch(result.matchPlan, 2);
  assert.equal(fin.participantSlotA.kind, PARTICIPANT_SLOT_KIND.WINNER_OF);
  assert.equal(fin.participantSlotB.kind, PARTICIPANT_SLOT_KIND.WINNER_OF);
});

test("1D-29: final matchNumber 1", () => {
  const { result } = generate(["a", "b", "c", "d"], [], {
    thirdPlacePolicy: THIRD_PLACE_POLICY.PLAYOFF,
  });
  assert.equal(finalMatch(result.matchPlan, 2).matchNumber, 1);
});

test("1D-30: third-place matchNumber 2", () => {
  const { result } = generate(["a", "b", "c", "d"], [], {
    thirdPlacePolicy: THIRD_PLACE_POLICY.PLAYOFF,
  });
  assert.equal(thirdMatch(result.matchPlan, 2).matchNumber, 2);
});

test("1D-31: PLAYOFF rejected for N=3", () => {
  const { result } = generate(["a", "b", "c"], [2], {
    thirdPlacePolicy: THIRD_PLACE_POLICY.PLAYOFF,
  });
  assert.equal(result.ok, false);
  assert.equal(result.matchPlan, null);
  assert.ok(
    result.issues.some(
      (i) => i.code === MATCH_GENERATION_ISSUE_CODE.PARTICIPANT_COUNT_INSUFFICIENT
    )
  );
});

// --- Policies ---

test("1D-32: EXACT accepted for power-of-two N", () => {
  const { result } = generate(["a", "b", "c", "d"], [], {
    bracketSizePolicy: BRACKET_SIZE_POLICY.EXACT,
    byePolicy: BYE_POLICY.NONE,
  });
  assert.equal(result.ok, true);
  assert.equal(result.diagnostics.bracketSize, 4);
});

test("1D-33: EXACT rejected for non-power-of-two N", () => {
  const { result } = generate(["a", "b", "c"], [2], {
    bracketSizePolicy: BRACKET_SIZE_POLICY.EXACT,
  });
  assert.equal(result.ok, false);
  assert.ok(
    result.issues.some(
      (i) => i.code === MATCH_GENERATION_ISSUE_CODE.UNSUPPORTED_GENERATION_POLICY
    )
  );
});

// --- Failures ---

test("1D-34: duplicate participant placement rejected", () => {
  const draw = seDraw(["a", "b", "c", "d"], []);
  const bad = createDrawSnapshot({
    ...draw,
    participantPlacements: [
      createDrawPlacementRef({
        placementRef: "p1",
        participantId: "a",
        position: 1,
      }),
      createDrawPlacementRef({
        placementRef: "p2",
        participantId: "a",
        position: 2,
      }),
      createDrawPlacementRef({
        placementRef: "p3",
        participantId: "c",
        position: 3,
      }),
      createDrawPlacementRef({
        placementRef: "p4",
        participantId: "d",
        position: 4,
      }),
    ],
  });
  const evaluated = seRules({ byePolicy: BYE_POLICY.NONE });
  const result = generateMatchPlan(seRequest(), seContext(bad, evaluated));
  assert.equal(result.ok, false);
  assert.ok(
    result.issues.some(
      (i) => i.code === MATCH_GENERATION_ISSUE_CODE.DRAW_PLACEMENT_DUPLICATE
    )
  );
});

test("1D-35: incomplete Draw rejected", () => {
  const draw = seDraw(["a", "b"], [], {
    completionStatus: DRAW_COMPLETION_STATUS.INCOMPLETE,
  });
  const result = generateMatchPlan(seRequest(), seContext(draw, seRules({ byePolicy: BYE_POLICY.NONE })));
  assert.equal(result.ok, false);
  assert.ok(
    result.issues.some((i) => i.code === MATCH_GENERATION_ISSUE_CODE.DRAW_INCOMPLETE)
  );
});

test("1D-36: Draw fingerprint mismatch rejected", () => {
  const draw = seDraw(["a", "b"], []);
  const result = generateMatchPlan(
    seRequest({
      drawReference: {
        drawId: "draw-se-1",
        drawVersion: "1",
        drawFingerprint: "wrong-fp",
      },
    }),
    seContext(draw, seRules({ byePolicy: BYE_POLICY.NONE }))
  );
  assert.equal(result.ok, false);
  assert.ok(
    result.issues.some(
      (i) => i.code === MATCH_GENERATION_ISSUE_CODE.DRAW_FINGERPRINT_MISMATCH
    )
  );
});

test("1D-37: Draw version mismatch rejected", () => {
  const draw = seDraw(["a", "b"], []);
  const result = generateMatchPlan(
    seRequest({
      drawReference: {
        drawId: "draw-se-1",
        drawVersion: "99",
        drawFingerprint: "draw-fp-se",
      },
    }),
    seContext(draw, seRules({ byePolicy: BYE_POLICY.NONE }))
  );
  assert.equal(result.ok, false);
  assert.ok(
    result.issues.some(
      (i) => i.code === MATCH_GENERATION_ISSUE_CODE.DRAW_VERSION_MISMATCH
    )
  );
});

test("1D-38: strategy mismatch rejected", () => {
  const draw = seDraw(["a", "b"], []);
  const evaluated = seRules({
    byePolicy: BYE_POLICY.NONE,
    generationStrategy: MATCH_GENERATION_STRATEGY.ROUND_ROBIN,
  });
  // Request is SE; rules are RR — fail closed on mismatch inside SE path?
  // generateMatchPlan routes by request.strategy → SE path → RULE_STRATEGY_MISMATCH
  const result = generateMatchPlan(seRequest(), seContext(draw, evaluated));
  assert.equal(result.ok, false);
  assert.ok(
    result.issues.some(
      (i) => i.code === MATCH_GENERATION_ISSUE_CODE.RULE_STRATEGY_MISMATCH
    )
  );
});

test("1D-39: encounterCount other than 1 rejected", () => {
  const draw = seDraw(["a", "b"], []);
  const evaluated = seRules({
    byePolicy: BYE_POLICY.NONE,
    encounterCount: 2,
  });
  const result = generateMatchPlan(seRequest(), seContext(draw, evaluated));
  assert.equal(result.ok, false);
  assert.ok(
    result.issues.some(
      (i) => i.code === MATCH_GENERATION_ISSUE_CODE.ENCOUNTER_COUNT_UNSUPPORTED
    )
  );
});

test("1D-40: unsupported consolation policy rejected", () => {
  const draw = seDraw(["a", "b", "c", "d"], []);
  const evaluated = seRules({
    byePolicy: BYE_POLICY.NONE,
    consolationOrPlacementPolicy: "FULL_CONSOLATION",
  });
  const result = generateMatchPlan(seRequest(), seContext(draw, evaluated));
  assert.equal(result.ok, false);
  assert.ok(
    result.issues.some(
      (i) => i.code === MATCH_GENERATION_ISSUE_CODE.UNSUPPORTED_GENERATION_POLICY
    )
  );
});

test("1D-41: missing canonical bye allocation rejected", () => {
  // N=3 needs 1 bye but Draw only has participants (no bye slots)
  const placements = ["a", "b", "c"].map((id, i) =>
    createDrawPlacementRef({
      placementRef: `place-${id}`,
      participantId: id,
      position: i + 1,
      bracketId: "br-1",
    })
  );
  const draw = createDrawSnapshot({
    drawId: "draw-se-1",
    drawVersion: "1",
    drawFingerprint: "draw-fp-se",
    competitionId: "comp-1",
    divisionId: "div-1",
    categoryId: "cat-1",
    completionStatus: DRAW_COMPLETION_STATUS.COMPLETE,
    stageDefinitions: [{ stageId: "stage-se", order: 1 }],
    bracketPlacements: [{ bracketId: "br-1", order: 1 }],
    participantPlacements: placements,
    byePlacements: [],
  });
  const evaluated = seRules({ byePolicy: BYE_POLICY.EXPLICIT_PLACEMENTS });
  const result = generateMatchPlan(seRequest(), seContext(draw, evaluated));
  assert.equal(result.ok, false);
  assert.equal(result.matchPlan, null);
  assert.ok(
    result.issues.some(
      (i) => i.code === MATCH_GENERATION_ISSUE_CODE.DRAW_PLACEMENT_MISSING
    )
  );
});

test("1D-42: failure returns matchPlan null", () => {
  const draw = createDrawSnapshot({
    drawId: "draw-se-1",
    drawVersion: "1",
    drawFingerprint: "draw-fp-se",
    competitionId: "comp-1",
    divisionId: "div-1",
    categoryId: "cat-1",
    completionStatus: DRAW_COMPLETION_STATUS.COMPLETE,
    stageDefinitions: [{ stageId: "stage-se", order: 1 }],
    bracketPlacements: [{ bracketId: "br-1", order: 1 }],
    participantPlacements: [
      createDrawPlacementRef({
        placementRef: "place-a",
        participantId: "a",
        position: 1,
        bracketId: "br-1",
      }),
    ],
    byePlacements: [],
  });
  const evaluated = seRules({ byePolicy: BYE_POLICY.NONE });
  const result = generateMatchPlan(seRequest(), seContext(draw, evaluated));
  assert.equal(result.ok, false);
  assert.equal(result.matchPlan, null);
  assert.ok(
    result.issues.some(
      (i) => i.code === MATCH_GENERATION_ISSUE_CODE.PARTICIPANT_COUNT_INSUFFICIENT
    )
  );
});

test("1D-43: no input mutation", () => {
  const draw = seDraw(["a", "b", "c", "d"], []);
  const evaluated = seRules({ byePolicy: BYE_POLICY.NONE });
  const request = seRequest();
  const ctx = seContext(draw, evaluated);
  const before = JSON.stringify({
    draw: draw.participantPlacements,
    rules: evaluated,
    request,
  });
  generateMatchPlan(request, ctx);
  const after = JSON.stringify({
    draw: draw.participantPlacements,
    rules: evaluated,
    request,
  });
  assert.equal(before, after);
});

test("1D-44: no scheduling/runtime fields", () => {
  const { result } = generate(["a", "b", "c", "d"], []);
  assert.equal(result.ok, true);
  assert.equal(hasForbiddenSchedulingFields(result.matchPlan), false);
  for (const field of FORBIDDEN_MATCH_PLAN_FIELDS) {
    assert.equal(Object.hasOwn(result.matchPlan, field), false);
  }
});

test("1D-45: root competition-core barrel remains unchanged", () => {
  const barrel = readFileSync(
    path.join(ROOT, "src/features/competition-core/index.js"),
    "utf8"
  );
  assert.equal(barrel.includes("match-generation"), false);
  assert.equal(barrel.includes("generateMatchPlan"), false);
  assert.equal(barrel.includes("SINGLE_ELIMINATION"), false);
});

test("1D-46: generator version is phase1d", () => {
  assert.equal(MATCH_GENERATOR_IDENTITY.version, "1.0.0-phase1d");
  const { result } = generate(["a", "b"], []);
  assert.equal(result.matchPlan.generatorVersion, "1.0.0-phase1d");
});

test("1D-47: fingerprint matches recomputation", () => {
  const { result } = generate(["a", "b", "c", "d"], []);
  const recomputed = fingerprintMatchPlan(result.matchPlan, {
    strategy: MATCH_GENERATION_STRATEGY.SINGLE_ELIMINATION,
    deterministicOrderingInputs: ["placement:a", "placement:b", "placement:c", "placement:d"],
  });
  assert.equal(result.matchPlan.generationFingerprint, recomputed);
});

test("1D-48: no forbidden nondeterminism in module source", () => {
  for (const file of listJsFiles(MG_ROOT)) {
    const src = readFileSync(file, "utf8");
    const hits = findForbiddenNondeterminismPatterns(src);
    assert.deepEqual(hits, [], file);
  }
});

test("1D-49: byePolicy NONE rejected when byes required", () => {
  const draw = seDraw(["a", "b", "c"], [2]);
  const evaluated = seRules({ byePolicy: BYE_POLICY.NONE });
  const result = generateMatchPlan(seRequest(), seContext(draw, evaluated));
  assert.equal(result.ok, false);
  assert.ok(
    result.issues.some(
      (i) => i.code === MATCH_GENERATION_ISSUE_CODE.UNSUPPORTED_GENERATION_POLICY
    )
  );
});

test("1D-50: NEXT_POWER_OF_TWO matches POWER_OF_TWO sizing", () => {
  const a = computeSingleEliminationBracket(5, BRACKET_SIZE_POLICY.POWER_OF_TWO);
  const b = computeSingleEliminationBracket(
    5,
    BRACKET_SIZE_POLICY.NEXT_POWER_OF_TWO
  );
  assert.equal(a.bracketSize, b.bracketSize);
  assert.equal(a.byeCount, b.byeCount);
});
