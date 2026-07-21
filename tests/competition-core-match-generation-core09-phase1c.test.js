/**
 * CORE-09 Phase 1C — Round Robin / Group Stage Match Generator tests.
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
  DRAW_COMPLETION_STATUS,
  ROUND_ROBIN_MODE,
  BYE_POLICY,
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

function placementsFromIds(ids, groupId = null) {
  return ids.map((id, i) =>
    createDrawPlacementRef({
      placementRef: groupId ? `${groupId}-${id}` : `place-${id}`,
      participantId: id,
      groupId,
      position: i + 1,
    })
  );
}

function baseRequest(overrides = {}) {
  return createMatchGenerationRequest({
    competitionId: "comp-1",
    divisionId: "div-1",
    categoryId: "cat-1",
    stageId: "stage-rr",
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

function completeDraw(participantIds, overrides = {}) {
  return createDrawSnapshot({
    drawId: "draw-1",
    drawVersion: "1",
    drawFingerprint: "draw-fp-aaa",
    competitionId: "comp-1",
    divisionId: "div-1",
    categoryId: "cat-1",
    completionStatus: DRAW_COMPLETION_STATUS.COMPLETE,
    stageDefinitions: [{ stageId: "stage-rr", order: 1 }],
    groupPlacements: [],
    bracketPlacements: [],
    participantPlacements: placementsFromIds(participantIds),
    byePlacements: [],
    seedReferences: [],
    ...overrides,
  });
}

function rules(overrides = {}) {
  return createEvaluatedMatchGenerationRules({
    ruleSetId: "rules-1",
    ruleSetVersion: "1",
    ruleEvaluationFingerprint: "rule-fp-bbb",
    generationStrategy: MATCH_GENERATION_STRATEGY.ROUND_ROBIN,
    roundRobinMode: ROUND_ROBIN_MODE.SINGLE,
    encounterCount: 1,
    byePolicy: BYE_POLICY.NONE,
    ...overrides,
  });
}

function contextFor(draw, evaluated, ordering = null) {
  const ids = (draw.participantPlacements || [])
    .filter((p) => p.isBye !== true && p.participantId)
    .map((p) => p.participantId);
  return createMatchGenerationContext({
    drawSnapshot: draw,
    evaluatedRules: evaluated,
    participantSnapshot: createParticipantSnapshotRef({
      snapshotId: "part-snap-1",
      participantFingerprint: "part-fp-ccc",
      participantIds: ids,
    }),
    deterministicOrderingInputs:
      ordering || ids.map((id) => `placement:${id}`),
    generatorVersion: MATCH_GENERATOR_IDENTITY.version,
  });
}

function playedMatches(plan) {
  return (plan.logicalMatches || []).filter((m) => m.isByeMatch !== true);
}

function byeMatches(plan) {
  return (plan.logicalMatches || []).filter((m) => m.isByeMatch === true);
}

function unorderedPair(m) {
  const a = m.participantSlotA.participantId;
  const b = m.participantSlotB.participantId;
  return a < b ? `${a}|${b}` : `${b}|${a}`;
}

function roundCount(plan) {
  const set = new Set((plan.logicalMatches || []).map((m) => m.roundNumber));
  return set.size;
}

function generate(participantIds, ruleOverrides = {}, requestOverrides = {}) {
  const draw = completeDraw(participantIds);
  const evaluated = rules(ruleOverrides);
  const request = baseRequest(requestOverrides);
  const context = contextFor(draw, evaluated);
  return { result: generateMatchPlan(request, context), draw, request, context };
}

// --- SINGLE ROUND ROBIN ---

test("1C-01: two participants produce one played match", () => {
  const { result } = generate(["p1", "p2"]);
  assert.equal(result.ok, true);
  assert.equal(playedMatches(result.matchPlan).length, 1);
  assert.equal(roundCount(result.matchPlan), 1);
});

test("1C-02: four participants produce three rounds and six matches", () => {
  const { result } = generate(["a", "b", "c", "d"]);
  assert.equal(result.ok, true);
  assert.equal(roundCount(result.matchPlan), 3);
  assert.equal(playedMatches(result.matchPlan).length, 6);
  assert.equal(byeMatches(result.matchPlan).length, 0);
});

test("1C-03: six participants produce five rounds and fifteen matches", () => {
  const { result } = generate(["a", "b", "c", "d", "e", "f"]);
  assert.equal(result.ok, true);
  assert.equal(roundCount(result.matchPlan), 5);
  assert.equal(playedMatches(result.matchPlan).length, 15);
});

test("1C-04: every pair appears exactly once (N=4)", () => {
  const { result } = generate(["a", "b", "c", "d"]);
  const pairs = playedMatches(result.matchPlan).map(unorderedPair);
  assert.equal(pairs.length, 6);
  assert.equal(new Set(pairs).size, 6);
});

test("1C-05: no self-match", () => {
  const { result } = generate(["a", "b", "c", "d", "e"]);
  for (const m of playedMatches(result.matchPlan)) {
    assert.notEqual(
      m.participantSlotA.participantId,
      m.participantSlotB.participantId
    );
  }
});

test("1C-06: no duplicate match key", () => {
  const { result } = generate(["a", "b", "c", "d"]);
  const keys = result.matchPlan.logicalMatches.map((m) => m.logicalMatchKey);
  assert.equal(keys.length, new Set(keys).size);
});

test("1C-07: deterministic output across repeated runs", () => {
  const r1 = generate(["a", "b", "c", "d"]);
  const r2 = generate(["a", "b", "c", "d"]);
  assert.equal(r1.result.ok, true);
  assert.deepEqual(
    r1.result.matchPlan.logicalMatches.map((m) => ({
      k: m.logicalMatchKey,
      a: m.participantSlotA.participantId,
      b: m.participantSlotB.participantId,
    })),
    r2.result.matchPlan.logicalMatches.map((m) => ({
      k: m.logicalMatchKey,
      a: m.participantSlotA.participantId,
      b: m.participantSlotB.participantId,
    }))
  );
});

test("1C-08: stable fingerprint across repeated runs", () => {
  const r1 = generate(["a", "b", "c", "d"]);
  const r2 = generate(["a", "b", "c", "d"]);
  assert.equal(
    r1.result.matchPlan.generationFingerprint,
    r2.result.matchPlan.generationFingerprint
  );
  assert.equal(
    r1.result.matchPlan.generationFingerprint,
    fingerprintMatchPlan(r1.result.matchPlan, {
      strategy: MATCH_GENERATION_STRATEGY.ROUND_ROBIN,
      deterministicOrderingInputs: r1.context.deterministicOrderingInputs,
    })
  );
});

test("1C-09: input order follows canonical Draw placement order", () => {
  const ids = ["z", "m", "a", "b"];
  const { result } = generate(ids);
  assert.deepEqual(result.diagnostics.placementOrder, ids);
  // First-round participants must be drawn from that ordered set only.
  for (const m of result.matchPlan.logicalMatches) {
    for (const slot of [m.participantSlotA, m.participantSlotB]) {
      if (slot.isBye) continue;
      assert.ok(ids.includes(slot.participantId));
    }
  }
});

test("1C-10: invalid participant placement fails closed", () => {
  const draw = completeDraw(["a", "b"], {
    participantPlacements: [
      createDrawPlacementRef({
        placementRef: "x",
        participantId: "a",
        position: 1,
      }),
      createDrawPlacementRef({
        placementRef: "y",
        participantId: "a",
        position: 2,
      }),
    ],
  });
  const evaluated = rules();
  const result = generateMatchPlan(baseRequest(), contextFor(draw, evaluated));
  assert.equal(result.ok, false);
  assert.ok(
    result.issues.some(
      (i) => i.code === MATCH_GENERATION_ISSUE_CODE.DRAW_PLACEMENT_DUPLICATE
    )
  );
  assert.equal(result.matchPlan, null);
});

// --- ODD PARTICIPANT COUNTS ---

test("1C-11: three participants produce three rounds and three played matches", () => {
  const { result } = generate(["a", "b", "c"]);
  assert.equal(result.ok, true);
  assert.equal(roundCount(result.matchPlan), 3);
  assert.equal(playedMatches(result.matchPlan).length, 3);
});

test("1C-12: five participants produce five rounds and ten played matches", () => {
  const { result } = generate(["a", "b", "c", "d", "e"]);
  assert.equal(result.ok, true);
  assert.equal(roundCount(result.matchPlan), 5);
  assert.equal(playedMatches(result.matchPlan).length, 10);
});

test("1C-13: every participant receives exactly one bye per leg", () => {
  const ids = ["a", "b", "c", "d", "e"];
  const { result } = generate(ids);
  const byes = byeMatches(result.matchPlan).map((m) =>
    m.participantSlotA.isBye
      ? m.participantSlotB.participantId
      : m.participantSlotA.participantId
  );
  assert.equal(byes.length, ids.length);
  assert.deepEqual([...byes].sort(), [...ids].sort());
});

test("1C-14: no fake participant appears in a played match", () => {
  const { result } = generate(["a", "b", "c"]);
  for (const m of playedMatches(result.matchPlan)) {
    assert.equal(m.participantSlotA.kind, PARTICIPANT_SLOT_KIND.DIRECT_PARTICIPANT);
    assert.equal(m.participantSlotB.kind, PARTICIPANT_SLOT_KIND.DIRECT_PARTICIPANT);
    assert.ok(m.participantSlotA.participantId);
    assert.ok(m.participantSlotB.participantId);
    assert.equal(m.isByeMatch, false);
  }
});

test("1C-15: bye rotation is deterministic", () => {
  const r1 = generate(["a", "b", "c"]);
  const r2 = generate(["a", "b", "c"]);
  assert.deepEqual(
    r1.result.diagnostics.byeRecipientIdsByLeg,
    r2.result.diagnostics.byeRecipientIdsByLeg
  );
});

// --- DOUBLE ROUND ROBIN ---

test("1C-16: four participants produce six rounds and twelve matches", () => {
  const { result } = generate(["a", "b", "c", "d"], {
    roundRobinMode: ROUND_ROBIN_MODE.DOUBLE,
    encounterCount: 2,
  });
  assert.equal(result.ok, true);
  assert.equal(roundCount(result.matchPlan), 6);
  assert.equal(playedMatches(result.matchPlan).length, 12);
});

test("1C-17: every pair appears exactly twice", () => {
  const { result } = generate(["a", "b", "c", "d"], {
    roundRobinMode: ROUND_ROBIN_MODE.DOUBLE,
    encounterCount: 2,
  });
  /** @type {Map<string, number>} */
  const counts = new Map();
  for (const m of playedMatches(result.matchPlan)) {
    const p = unorderedPair(m);
    counts.set(p, (counts.get(p) || 0) + 1);
  }
  assert.equal(counts.size, 6);
  for (const c of counts.values()) assert.equal(c, 2);
});

test("1C-18: second-leg A/B orientation reverses first leg", () => {
  const { result } = generate(["a", "b", "c", "d"], {
    roundRobinMode: ROUND_ROBIN_MODE.DOUBLE,
    encounterCount: 2,
  });
  const played = playedMatches(result.matchPlan);
  const leg1 = played.filter((m) => m.metadata.phase1c.legNumber === 1);
  const leg2 = played.filter((m) => m.metadata.phase1c.legNumber === 2);
  assert.equal(leg1.length, 6);
  assert.equal(leg2.length, 6);
  for (const m2 of leg2) {
    const key = m2.metadata.phase1c.reversesLogicalMatchKey;
    const m1 = result.matchPlan.logicalMatches.find(
      (m) => m.logicalMatchKey === key
    );
    assert.ok(m1);
    assert.equal(
      m2.participantSlotA.participantId,
      m1.participantSlotB.participantId
    );
    assert.equal(
      m2.participantSlotB.participantId,
      m1.participantSlotA.participantId
    );
  }
});

test("1C-19: no duplicate logicalMatchKey (double)", () => {
  const { result } = generate(["a", "b", "c"], {
    roundRobinMode: ROUND_ROBIN_MODE.DOUBLE,
    encounterCount: 2,
  });
  const keys = result.matchPlan.logicalMatches.map((m) => m.logicalMatchKey);
  assert.equal(keys.length, new Set(keys).size);
});

test("1C-20: fingerprint is deterministic (double)", () => {
  const r1 = generate(["a", "b", "c", "d"], {
    roundRobinMode: ROUND_ROBIN_MODE.DOUBLE,
    encounterCount: 2,
  });
  const r2 = generate(["a", "b", "c", "d"], {
    roundRobinMode: ROUND_ROBIN_MODE.DOUBLE,
    encounterCount: 2,
  });
  assert.equal(
    r1.result.matchPlan.generationFingerprint,
    r2.result.matchPlan.generationFingerprint
  );
});

test("1C-21: odd participant byes repeat deterministically across two legs", () => {
  const { result } = generate(["a", "b", "c"], {
    roundRobinMode: ROUND_ROBIN_MODE.DOUBLE,
    encounterCount: 2,
  });
  const [leg1, leg2] = result.diagnostics.byeRecipientIdsByLeg;
  assert.deepEqual(leg1, leg2);
  assert.equal(leg1.length, 3);
});

// --- GROUP STAGE ---

function groupDraw(groups) {
  /** @type {object[]} */
  const catalog = [];
  /** @type {object[]} */
  const placements = [];
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
  return completeDraw([], {
    groupPlacements: catalog,
    participantPlacements: placements,
    stageDefinitions: [{ stageId: "stage-rr", order: 1 }],
  });
}

function generateGroups(groups, ruleOverrides = {}) {
  const draw = groupDraw(groups);
  const evaluated = rules({
    generationStrategy: MATCH_GENERATION_STRATEGY.GROUP_ROUND_ROBIN,
    ...ruleOverrides,
  });
  const request = baseRequest({
    strategy: MATCH_GENERATION_STRATEGY.GROUP_ROUND_ROBIN,
  });
  const context = contextFor(draw, evaluated);
  return { result: generateMatchPlan(request, context), draw, context };
}

test("1C-22: two independent groups generate no cross-group matches", () => {
  const { result } = generateGroups([
    ["g1", ["a1", "a2", "a3", "a4"]],
    ["g2", ["b1", "b2", "b3", "b4"]],
  ]);
  assert.equal(result.ok, true);
  for (const m of playedMatches(result.matchPlan)) {
    const a = m.participantSlotA.participantId;
    const b = m.participantSlotB.participantId;
    const aG = a.startsWith("a") ? "g1" : "g2";
    const bG = b.startsWith("a") ? "g1" : "g2";
    assert.equal(aG, bG);
    assert.equal(m.groupId, aG);
  }
});

test("1C-23: group identities appear in logical match keys", () => {
  const { result } = generateGroups([
    ["g1", ["a1", "a2"]],
    ["g2", ["b1", "b2"]],
  ]);
  for (const m of result.matchPlan.logicalMatches) {
    assert.ok(m.groupId);
    assert.ok(m.logicalMatchKey.includes(m.groupId));
  }
});

test("1C-24: groups with different participant counts generate correctly", () => {
  const { result } = generateGroups([
    ["g1", ["a1", "a2", "a3", "a4"]],
    ["g2", ["b1", "b2"]],
  ]);
  assert.equal(result.ok, true);
  const g1 = playedMatches(result.matchPlan).filter((m) => m.groupId === "g1");
  const g2 = playedMatches(result.matchPlan).filter((m) => m.groupId === "g2");
  assert.equal(g1.length, 6);
  assert.equal(g2.length, 1);
});

test("1C-25: odd and even groups can coexist", () => {
  const { result } = generateGroups([
    ["g-odd", ["o1", "o2", "o3"]],
    ["g-even", ["e1", "e2", "e3", "e4"]],
  ]);
  assert.equal(result.ok, true);
  assert.equal(
    playedMatches(result.matchPlan).filter((m) => m.groupId === "g-odd").length,
    3
  );
  assert.equal(
    playedMatches(result.matchPlan).filter((m) => m.groupId === "g-even")
      .length,
    6
  );
  assert.ok(byeMatches(result.matchPlan).some((m) => m.groupId === "g-odd"));
  assert.equal(
    byeMatches(result.matchPlan).filter((m) => m.groupId === "g-even").length,
    0
  );
});

test("1C-26: duplicate participant across groups fails", () => {
  const draw = groupDraw([
    ["g1", ["a", "b"]],
    ["g2", ["a", "c"]],
  ]);
  // groupDraw would create two placements for "a" — rebuild with shared id.
  const bad = completeDraw([], {
    groupPlacements: [
      { groupId: "g1", id: "g1" },
      { groupId: "g2", id: "g2" },
    ],
    participantPlacements: [
      createDrawPlacementRef({
        placementRef: "g1-a",
        participantId: "shared",
        groupId: "g1",
        position: 1,
      }),
      createDrawPlacementRef({
        placementRef: "g1-b",
        participantId: "b",
        groupId: "g1",
        position: 2,
      }),
      createDrawPlacementRef({
        placementRef: "g2-a",
        participantId: "shared",
        groupId: "g2",
        position: 1,
      }),
      createDrawPlacementRef({
        placementRef: "g2-c",
        participantId: "c",
        groupId: "g2",
        position: 2,
      }),
    ],
  });
  void draw;
  const evaluated = rules({
    generationStrategy: MATCH_GENERATION_STRATEGY.GROUP_ROUND_ROBIN,
  });
  const result = generateMatchPlan(
    baseRequest({ strategy: MATCH_GENERATION_STRATEGY.GROUP_ROUND_ROBIN }),
    contextFor(bad, evaluated)
  );
  assert.equal(result.ok, false);
  assert.ok(
    result.issues.some(
      (i) => i.code === MATCH_GENERATION_ISSUE_CODE.DRAW_PLACEMENT_DUPLICATE
    )
  );
});

test("1C-27: missing group catalog fails", () => {
  const draw = completeDraw(["a", "b", "c", "d"], {
    groupPlacements: [],
    participantPlacements: placementsFromIds(["a", "b"], "g1").concat(
      placementsFromIds(["c", "d"], "g2")
    ),
  });
  const evaluated = rules({
    generationStrategy: MATCH_GENERATION_STRATEGY.GROUP_ROUND_ROBIN,
  });
  const result = generateMatchPlan(
    baseRequest({ strategy: MATCH_GENERATION_STRATEGY.GROUP_ROUND_ROBIN }),
    contextFor(draw, evaluated)
  );
  assert.equal(result.ok, false);
  assert.ok(
    result.issues.some(
      (i) =>
        i.code === MATCH_GENERATION_ISSUE_CODE.DRAW_CATALOG_EMPTY ||
        i.code === MATCH_GENERATION_ISSUE_CODE.DRAW_REFERENCE_INVALID
    )
  );
});

test("1C-28: invalid group reference fails", () => {
  const draw = completeDraw([], {
    groupPlacements: [{ groupId: "g1", id: "g1" }],
    participantPlacements: [
      createDrawPlacementRef({
        placementRef: "x",
        participantId: "a",
        groupId: "missing",
        position: 1,
      }),
      createDrawPlacementRef({
        placementRef: "y",
        participantId: "b",
        groupId: "g1",
        position: 1,
      }),
    ],
  });
  const evaluated = rules({
    generationStrategy: MATCH_GENERATION_STRATEGY.GROUP_ROUND_ROBIN,
  });
  const result = generateMatchPlan(
    baseRequest({ strategy: MATCH_GENERATION_STRATEGY.GROUP_ROUND_ROBIN }),
    contextFor(draw, evaluated)
  );
  assert.equal(result.ok, false);
  assert.ok(
    result.issues.some(
      (i) => i.code === MATCH_GENERATION_ISSUE_CODE.DRAW_REFERENCE_INVALID
    )
  );
});

test("1C-29: group ordering follows DrawSnapshot ordering", () => {
  const { result } = generateGroups([
    ["g-beta", ["b1", "b2"]],
    ["g-alpha", ["a1", "a2"]],
  ]);
  assert.deepEqual(result.diagnostics.groupOrder, ["g-beta", "g-alpha"]);
});

test("1C-30: participant ordering follows Draw placement ordering", () => {
  const { result } = generateGroups([["g1", ["z", "m", "a", "b"]]]);
  assert.deepEqual(result.diagnostics.groups[0].placementOrder, [
    "z",
    "m",
    "a",
    "b",
  ]);
});

// --- BOUNDARY AND FAILURE ---

test("1C-31: unsupported strategy fails closed", () => {
  const draw = completeDraw(["a", "b"]);
  const evaluated = rules({
    generationStrategy: MATCH_GENERATION_STRATEGY.SINGLE_ELIMINATION,
  });
  // Request factory rejects deferred? SINGLE_ELIMINATION is contract-supported.
  const request = baseRequest({
    strategy: MATCH_GENERATION_STRATEGY.SINGLE_ELIMINATION,
  });
  const result = generateMatchPlan(request, contextFor(draw, evaluated));
  assert.equal(result.ok, false);
  assert.ok(
    result.issues.some(
      (i) => i.code === MATCH_GENERATION_ISSUE_CODE.STRATEGY_UNSUPPORTED
    )
  );
});

test("1C-32: missing Draw fingerprint fails", () => {
  const draw = completeDraw(["a", "b"], { drawFingerprint: "" });
  const evaluated = rules();
  const result = generateMatchPlan(baseRequest(), contextFor(draw, evaluated));
  assert.equal(result.ok, false);
  assert.ok(
    result.issues.some(
      (i) => i.code === MATCH_GENERATION_ISSUE_CODE.DRAW_FINGERPRINT_MISSING
    )
  );
});

test("1C-33: missing rule fingerprint fails", () => {
  const draw = completeDraw(["a", "b"]);
  const request = createMatchGenerationRequest({
    competitionId: "comp-1",
    divisionId: "div-1",
    stageId: "stage-rr",
    strategy: MATCH_GENERATION_STRATEGY.ROUND_ROBIN,
    drawReference: {
      drawId: "draw-1",
      drawVersion: "1",
      drawFingerprint: "draw-fp-aaa",
    },
    evaluatedRuleReference: {
      ruleSetId: "rules-1",
      ruleSetVersion: "1",
      ruleEvaluationFingerprint: "",
    },
    participantSnapshotReference: {
      snapshotId: "part-snap-1",
      participantFingerprint: "part-fp-ccc",
    },
  });
  assert.equal(request.evaluatedRuleReference.ruleEvaluationFingerprint, "");
  const result = generateMatchPlan(request, contextFor(draw, rules()));
  assert.equal(result.ok, false);
  assert.ok(
    result.issues.some(
      (i) =>
        i.code === MATCH_GENERATION_ISSUE_CODE.RULE_FINGERPRINT_MISSING ||
        i.code === MATCH_GENERATION_ISSUE_CODE.RULE_FINGERPRINT_MISMATCH
    )
  );
});

test("1C-34: incomplete Draw fails", () => {
  const draw = completeDraw(["a", "b"], {
    completionStatus: DRAW_COMPLETION_STATUS.INCOMPLETE,
  });
  const result = generateMatchPlan(baseRequest(), contextFor(draw, rules()));
  assert.equal(result.ok, false);
  assert.ok(
    result.issues.some(
      (i) => i.code === MATCH_GENERATION_ISSUE_CODE.DRAW_INCOMPLETE
    )
  );
});

test("1C-35: rule strategy mismatch fails", () => {
  const draw = completeDraw(["a", "b", "c", "d"]);
  const evaluated = rules({
    generationStrategy: MATCH_GENERATION_STRATEGY.GROUP_ROUND_ROBIN,
  });
  const result = generateMatchPlan(
    baseRequest({ strategy: MATCH_GENERATION_STRATEGY.ROUND_ROBIN }),
    contextFor(draw, evaluated)
  );
  assert.equal(result.ok, false);
  assert.ok(
    result.issues.some(
      (i) => i.code === MATCH_GENERATION_ISSUE_CODE.RULE_STRATEGY_MISMATCH
    )
  );
});

test("1C-36: scheduling/court/referee/score fields are absent", () => {
  const { result } = generate(["a", "b", "c", "d"]);
  assert.equal(result.ok, true);
  assert.equal(hasForbiddenSchedulingFields(result.matchPlan), false);
  for (const field of FORBIDDEN_MATCH_PLAN_FIELDS) {
    assert.equal(
      Object.prototype.hasOwnProperty.call(result.matchPlan, field),
      false
    );
  }
  for (const m of result.matchPlan.logicalMatches) {
    for (const field of [
      "scheduledAt",
      "courtId",
      "refereeId",
      "score",
      "startTime",
      "endTime",
    ]) {
      assert.equal(Object.prototype.hasOwnProperty.call(m, field), false);
    }
  }
});

test("1C-37: no production runtime import", () => {
  const files = listJsFiles(MG_ROOT);
  const forbidden = [
    /from\s+["'].*\/pages\//,
    /from\s+["'].*features\/tournament/,
    /from\s+["'].*DailyPlay/,
    /from\s+["'].*daily-play/,
    /from\s+["'].*team-tournament/,
    /from\s+["'].*\/scheduling\//,
    /from\s+["']@supabase/,
    /from\s+["'].*supabase/,
  ];
  for (const file of files) {
    const src = readFileSync(file, "utf8");
    for (const re of forbidden) {
      assert.equal(
        re.test(src),
        false,
        `${path.relative(ROOT, file)} matched ${re}`
      );
    }
  }
});

test("1C-38: no Math.random, Date.now, random UUID, or localeCompare", () => {
  const files = listJsFiles(MG_ROOT);
  for (const file of files) {
    const src = readFileSync(file, "utf8");
    const hits = findForbiddenNondeterminismPatterns(src);
    assert.deepEqual(hits, [], `${path.relative(ROOT, file)}: ${hits}`);
  }
});

test("1C-39: caller inputs remain immutable", () => {
  const draw = completeDraw(["a", "b", "c", "d"]);
  const evaluated = rules();
  const request = baseRequest();
  const context = contextFor(draw, evaluated);
  const beforeReq = JSON.stringify(request);
  const beforeCtx = JSON.stringify({
    drawFingerprint: context.drawSnapshot.drawFingerprint,
    placements: context.drawSnapshot.participantPlacements,
    rulesFp: context.evaluatedRules.ruleEvaluationFingerprint,
  });
  const result = generateMatchPlan(request, context);
  assert.equal(result.ok, true);
  assert.equal(JSON.stringify(request), beforeReq);
  assert.equal(
    JSON.stringify({
      drawFingerprint: context.drawSnapshot.drawFingerprint,
      placements: context.drawSnapshot.participantPlacements,
      rulesFp: context.evaluatedRules.ruleEvaluationFingerprint,
    }),
    beforeCtx
  );
});

test("1C-40: generated MatchPlan passes all existing Phase 1B invariants", () => {
  const { result, context } = generate(["a", "b", "c", "d", "e"]);
  assert.equal(result.ok, true);
  const issues = validateMatchPlanInvariants(result.matchPlan, {
    boundDrawSnapshot: context.drawSnapshot,
    expectedDrawFingerprint: context.drawSnapshot.drawFingerprint,
    expectedRuleEvaluationFingerprint:
      context.evaluatedRules.ruleEvaluationFingerprint,
    expectedParticipantFingerprint: "part-fp-ccc",
    strategy: MATCH_GENERATION_STRATEGY.ROUND_ROBIN,
    deterministicOrderingInputs: context.deterministicOrderingInputs,
    requireGenerationFingerprintMatch: true,
    maxDirectPairOccurrences: 1,
  });
  assert.deepEqual(issues, []);
});

test("1C: CUSTOM roundRobinMode fails closed", () => {
  const { result } = generate(["a", "b"], {
    roundRobinMode: ROUND_ROBIN_MODE.CUSTOM,
    encounterCount: 1,
  });
  assert.equal(result.ok, false);
  assert.ok(
    result.issues.some(
      (i) =>
        i.code === MATCH_GENERATION_ISSUE_CODE.ROUND_ROBIN_MODE_UNSUPPORTED
    )
  );
});

test("1C: double mode with rematchRestrictions fails closed", () => {
  const { result } = generate(["a", "b", "c", "d"], {
    roundRobinMode: ROUND_ROBIN_MODE.DOUBLE,
    encounterCount: 2,
    rematchRestrictions: true,
  });
  assert.equal(result.ok, false);
  assert.ok(
    result.issues.some(
      (i) => i.code === MATCH_GENERATION_ISSUE_CODE.UNSUPPORTED_GENERATION_POLICY
    )
  );
});

test("1C: root competition-core barrel unchanged by Phase 1C exports", () => {
  const rootBarrel = path.join(
    ROOT,
    "src/features/competition-core/index.js"
  );
  const src = readFileSync(rootBarrel, "utf8");
  assert.equal(src.includes("generateMatchPlan"), false);
  assert.equal(src.includes("match-generation"), false);
});
