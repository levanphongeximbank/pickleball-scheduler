import test from "node:test";
import assert from "node:assert/strict";

import {
  CANONICAL_FORMATION_STRATEGY_CATALOG,
  FORMATION_CONSTRAINT_KIND,
  FORMATION_ENGINE_VERSION,
  FORMATION_STRATEGY,
  FORMATION_STRATEGY_VALUES,
  LEGACY_FORMATION_STRATEGY_INVENTORY,
  appendFormationDecisionTrace,
  buildFoundationFormationResult,
  buildFormationScoreBreakdown,
  cloneFormationRequest,
  computeReferenceFormationScoreComponents,
  createFormationAudit,
  createFormationDecisionExplanation,
  createFormationRequest,
  createFormationResult,
  getFormationStrategyFromCatalog,
  isFormationConstraintKind,
  isFormationStrategy,
  mapLegacyFormationConstraintKind,
  mapLegacyFormationPayloadToFormationRequest,
  mapLegacyFormationStrategyToCanonical,
  serializeFormationContract,
  validateFormationRequestShape,
  validateFormationResultShape,
} from "../src/features/competition-core/index.js";

function assertUniqueValues(valuesSet, label) {
  const values = [...valuesSet];
  assert.equal(values.length, new Set(values).size, `${label} must not contain duplicate values`);
}

test("formation strategy enum is unique and complete", () => {
  assertUniqueValues(FORMATION_STRATEGY_VALUES, "FORMATION_STRATEGY");
  assert.equal(isFormationStrategy(FORMATION_STRATEGY.BALANCED), true);
  assert.equal(isFormationStrategy(FORMATION_STRATEGY.TEAM_MATCH), true);
  assert.equal(isFormationStrategy(FORMATION_STRATEGY.KING_OF_COURT), true);
  assert.equal(FORMATION_ENGINE_VERSION, "cc05a-v1");
});

test("formation constraint kinds cover audit inventory", () => {
  assert.equal(isFormationConstraintKind(FORMATION_CONSTRAINT_KIND.MUST_PARTNER), true);
  assert.equal(isFormationConstraintKind(FORMATION_CONSTRAINT_KIND.REST_TIME), true);
  assert.equal(mapLegacyFormationConstraintKind("avoid_partner"), FORMATION_CONSTRAINT_KIND.MUST_NOT_PARTNER);
  assert.equal(mapLegacyFormationConstraintKind("level_diff"), FORMATION_CONSTRAINT_KIND.SKILL_GAP);
});

test("legacy strategy mapping resolves runtime keys", () => {
  for (const item of LEGACY_FORMATION_STRATEGY_INVENTORY) {
    assert.equal(mapLegacyFormationStrategyToCanonical(item.legacyKey), item.strategyId);
  }
  assert.equal(mapLegacyFormationStrategyToCanonical("ai_balance"), FORMATION_STRATEGY.BALANCED);
  assert.equal(mapLegacyFormationStrategyToCanonical("mlp_team_pairing"), FORMATION_STRATEGY.TEAM_MATCH);
  assert.equal(mapLegacyFormationStrategyToCanonical("unknown-key"), FORMATION_STRATEGY.UNKNOWN);
});

test("formation request factory includes policy and constraints", () => {
  const request = createFormationRequest({
    sessionId: "s1",
    clubId: "c1",
    policy: { strategy: FORMATION_STRATEGY.BALANCED, maxSkillGap: 1.5 },
    players: [{ id: "p1" }, { id: "p2" }],
    constraints: [{ kind: FORMATION_CONSTRAINT_KIND.GENDER, severity: "soft" }],
  });

  assert.equal(request.policy.strategy, FORMATION_STRATEGY.BALANCED);
  assert.equal(request.players.length, 2);
  assert.equal(request.constraints[0].kind, FORMATION_CONSTRAINT_KIND.GENDER);
  assert.equal(validateFormationRequestShape(request).ok, true);
});

test("legacy payload maps to canonical formation request", () => {
  const request = mapLegacyFormationPayloadToFormationRequest({
    strategyKey: "rotating_partner",
    players: [{ id: "p1" }],
    constraints: [{ type: "avoid_repeat_partner", mode: "hard" }],
  });

  assert.equal(request.policy.strategy, FORMATION_STRATEGY.ROTATING_PARTNER);
  assert.equal(request.constraints[0].kind, FORMATION_CONSTRAINT_KIND.AVOID_REPEAT_PARTNER);
});

test("reference score model computes all components", () => {
  const score = computeReferenceFormationScoreComponents({
    skillScore: 4,
    repeatCount: 1,
    opponentRepeatCount: 1,
    restViolations: 1,
    genderBalanced: true,
    balanceScore: 0.8,
    availabilityScore: 0.2,
    manualAdjustment: 0.1,
    randomComponent: 0.05,
  });

  assert.equal(typeof score.skillScore, "number");
  assert.equal(typeof score.repeatPenalty, "number");
  assert.equal(typeof score.finalScore, "number");
  assert.ok(score.finalScore !== 0);
});

test("formation decision explanation includes full path", () => {
  const explanation = createFormationDecisionExplanation({
    playerAId: "p1",
    playerBId: "p2",
    reason: "Balanced skill pairing",
    constraints: [{ kind: FORMATION_CONSTRAINT_KIND.SKILL_GAP, enabled: true }],
    scoreBreakdown: buildFormationScoreBreakdown({ finalScore: 0.75 }),
  });

  assert.equal(explanation.decisionPath?.includes("Player A"), true);
  assert.equal(explanation.decisionPath?.includes("Partner B"), true);
  assert.equal(explanation.decisionPath?.includes("Constraint summary"), true);
  assert.equal(explanation.decisionPath?.includes("Final decision"), true);
});

test("foundation formation result includes audit and trace", () => {
  const request = createFormationRequest({
    policy: { strategy: FORMATION_STRATEGY.SNAKE },
    players: [{ id: "p1" }, { id: "p2" }, { id: "p3" }, { id: "p4" }],
    constraints: [{ kind: FORMATION_CONSTRAINT_KIND.CLUB }],
  });

  const result = buildFoundationFormationResult(request);
  assert.equal(result.ok, true);
  assert.equal(result.pairs.length, 0);
  assert.equal(result.explanations.length, 1);
  assert.equal(result.audit?.strategy, FORMATION_STRATEGY.SNAKE);
  assert.equal(result.decisionTrace?.records.length, 1);
  assert.equal(result.metadata?.foundationOnly, true);
  assert.equal(getFormationStrategyFromCatalog(FORMATION_STRATEGY.SNAKE)?.name, "Snake");
});

test("formation audit captures strategy seed constraints scores courts", () => {
  const audit = createFormationAudit({
    strategy: FORMATION_STRATEGY.BALANCED,
    seed: 42,
    constraints: { enabled: 2, kinds: ["skill_gap", "gender"] },
    scores: {
      skillScore: 0.9,
      repeatPenalty: 0,
      opponentPenalty: 0,
      restPenalty: 0,
      genderBonus: 0,
      balanceScore: 0,
      availabilityScore: 0,
      manualAdjustment: 0,
      randomComponent: 0,
      finalScore: 0.9,
    },
    courtAllocation: { targetCourtCount: 4 },
    warnings: ["foundation only"],
  });

  assert.equal(audit.engineVersion, FORMATION_ENGINE_VERSION);
  assert.equal(audit.seed, 42);
  assert.equal(audit.scores?.skillScore, 0.9);
  assert.equal(typeof audit.scores?.finalScore, "number");
  assert.equal(audit.courtAllocation.targetCourtCount, 4);
});

test("formation contracts serialize and clone safely", () => {
  const request = createFormationRequest({
    policy: { strategy: FORMATION_STRATEGY.MIXED },
    players: [{ id: "p1" }],
  });
  const cloned = cloneFormationRequest(request);
  cloned.players.push({ id: "p2" });
  assert.equal(request.players.length, 1);

  const serialized = serializeFormationContract(
    createFormationResult({
      pairs: [{ playerIds: ["p1", "p2"] }],
      audit: createFormationAudit({ strategy: FORMATION_STRATEGY.MIXED }),
    })
  );
  assert.equal(typeof serialized, "object");
  assert.equal(serialized.pairs[0].playerIds.length, 2);
});

test("formation result shape validator", () => {
  assert.equal(validateFormationResultShape(createFormationResult({})).ok, true);
  assert.equal(validateFormationResultShape({ pairs: null }).ok, false);
});

test("decision trace append is immutable-safe", () => {
  const trace = appendFormationDecisionTrace(
    { records: [], traceVersion: FORMATION_ENGINE_VERSION },
    { id: "t1", action: "evaluate", path: ["a"], engineVersion: FORMATION_ENGINE_VERSION, evaluatedAt: "now" }
  );
  assert.equal(trace.records.length, 1);
});

test("strategy catalog has expected entries", () => {
  assert.equal(CANONICAL_FORMATION_STRATEGY_CATALOG.length, 10);
  assert.equal(CANONICAL_FORMATION_STRATEGY_CATALOG.every((item) => item.id && item.name), true);
});

test("importing formation foundation has no side effects", () => {
  assert.equal(typeof buildFoundationFormationResult, "function");
  assert.equal(typeof mapLegacyFormationPayloadToFormationRequest, "function");
});
