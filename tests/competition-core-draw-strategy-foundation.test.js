import test from "node:test";
import assert from "node:assert/strict";

import {
  CANONICAL_DRAW_STRATEGY_ID,
  CANONICAL_DRAW_STRATEGY_CATALOG,
  CANONICAL_DRAW_STRATEGY_ID_VALUES,
  DISTRIBUTION_TYPE,
  DISTRIBUTION_TYPE_VALUES,
  DRAW_STRATEGY_ENGINE_VERSION,
  LEGACY_DRAW_STRATEGY_INVENTORY,
  buildFoundationStrategyDrawResult,
  cloneStrategyDrawRequest,
  createDistributionPolicy,
  createDrawPlacement,
  createDrawStrategyDefinition,
  createStrategyDrawAudit,
  createStrategyDrawConfiguration,
  createStrategyDrawRequest,
  createStrategyDrawResult,
  deriveDefaultPoliciesFromStrategy,
  getDrawStrategyFromCatalog,
  isCanonicalDrawStrategyId,
  isDistributionType,
  mapLegacyStrategyKeyToCatalogId,
  selectDrawStrategy,
  serializeStrategyDrawContract,
  validateStrategyDrawRequestShape,
  validateStrategyDrawResultShape,
} from "../src/features/competition-core/index.js";

function assertUniqueValues(valuesSet, label) {
  const values = [...valuesSet];
  assert.equal(values.length, new Set(values).size, `${label} must not contain duplicate values`);
}

test("draw strategy catalog and distribution enums are unique", () => {
  assertUniqueValues(DISTRIBUTION_TYPE_VALUES, "DISTRIBUTION_TYPE");
  assertUniqueValues(CANONICAL_DRAW_STRATEGY_ID_VALUES, "CANONICAL_DRAW_STRATEGY_ID");
  assert.equal(isDistributionType(DISTRIBUTION_TYPE.SNAKE), true);
  assert.equal(isDistributionType("pure_snake"), false);
  assert.equal(isCanonicalDrawStrategyId(CANONICAL_DRAW_STRATEGY_ID.SNAKE), true);
  assert.equal(DRAW_STRATEGY_ENGINE_VERSION, "cc04c-v1");
});

test("strategy inventory covers audited legacy keys", () => {
  assert.equal(CANONICAL_DRAW_STRATEGY_CATALOG.length, 11);
  assert.equal(LEGACY_DRAW_STRATEGY_INVENTORY.length >= 11, true);

  for (const item of LEGACY_DRAW_STRATEGY_INVENTORY) {
    const mapped = mapLegacyStrategyKeyToCatalogId(item.legacyKey);
    assert.equal(mapped, item.strategyId, `legacy key ${item.legacyKey}`);
  }
});

test("legacy strategy selection maps runtime keys to catalog ids", () => {
  assert.equal(
    mapLegacyStrategyKeyToCatalogId("skill_controlled"),
    CANONICAL_DRAW_STRATEGY_ID.SNAKE
  );
  assert.equal(mapLegacyStrategyKeyToCatalogId("open"), CANONICAL_DRAW_STRATEGY_ID.RANDOM);
  assert.equal(
    mapLegacyStrategyKeyToCatalogId("official_ai_balance"),
    CANONICAL_DRAW_STRATEGY_ID.BALANCED
  );
  assert.equal(mapLegacyStrategyKeyToCatalogId("manual"), CANONICAL_DRAW_STRATEGY_ID.MANUAL);
  assert.equal(
    mapLegacyStrategyKeyToCatalogId("heuristic"),
    CANONICAL_DRAW_STRATEGY_ID.AI_HEURISTIC
  );
  assert.equal(mapLegacyStrategyKeyToCatalogId("swiss"), CANONICAL_DRAW_STRATEGY_ID.SWISS);
  assert.equal(mapLegacyStrategyKeyToCatalogId("unknown-key"), CANONICAL_DRAW_STRATEGY_ID.UNKNOWN);

  const selection = selectDrawStrategy(
    createStrategyDrawRequest({
      configuration: createStrategyDrawConfiguration({ drawMode: "skill_controlled" }),
      options: { legacyStrategyKey: "skill_controlled" },
    })
  );
  assert.equal(selection.strategyId, CANONICAL_DRAW_STRATEGY_ID.SNAKE);
  assert.equal(selection.distributionType, DISTRIBUTION_TYPE.SNAKE);
  assert.equal(selection.strategy?.name, "Snake");
});

test("draw strategy definition includes capability metadata", () => {
  const snake = getDrawStrategyFromCatalog(CANONICAL_DRAW_STRATEGY_ID.SNAKE);
  assert.equal(snake?.requiresSeed, true);
  assert.equal(snake?.supportsConstraints, true);
  assert.equal(snake?.supportsBalance, true);
  assert.equal(snake?.distributionType, DISTRIBUTION_TYPE.SNAKE);

  const manual = createDrawStrategyDefinition({
    id: CANONICAL_DRAW_STRATEGY_ID.MANUAL,
    name: "Manual",
    distributionType: DISTRIBUTION_TYPE.MANUAL,
    supportsManualPlacement: true,
  });
  assert.equal(manual.supportsManualPlacement, true);
  assert.equal(manual.supportsGroups, true);
});

test("distribution policy metadata derives from strategy capabilities", () => {
  const strategy = getDrawStrategyFromCatalog(CANONICAL_DRAW_STRATEGY_ID.BALANCED);
  const policies = deriveDefaultPoliciesFromStrategy(strategy, {
    balancePolicy: { targetSpread: 0.5 },
  });

  assert.equal(policies.distributionPolicy.type, DISTRIBUTION_TYPE.BALANCED);
  assert.equal(policies.constraintPolicy.enabled, true);
  assert.equal(policies.balancePolicy.enabled, true);
  assert.equal(policies.balancePolicy.targetSpread, 0.5);
  assert.equal(policies.seedPolicy.required, true);
});

test("foundation draw result includes explainability path and audit", () => {
  const request = createStrategyDrawRequest({
    configuration: createStrategyDrawConfiguration({
      drawMode: "official_ai_balance",
      groupCount: 4,
      randomSeed: 42,
    }),
    options: { legacyStrategyKey: "official_ai_balance" },
    seeds: [{ participantId: "p1", seedNumber: 1 }],
  });

  const result = buildFoundationStrategyDrawResult(request);
  assert.equal(result.ok, true);
  assert.equal(Array.isArray(result.groups), true);
  assert.equal(result.placements.length, 0);
  assert.equal(result.distributionSteps.length, 0);
  assert.equal(result.explanations.length, 1);
  assert.equal(result.explanations[0].distributionPath?.includes("Strategy"), true);
  assert.equal(result.explanations[0].distributionPath?.includes("Seed policy"), true);
  assert.equal(result.explanations[0].distributionPath?.includes("Distribution"), true);
  assert.equal(result.audit?.distributionType, DISTRIBUTION_TYPE.BALANCED);
  assert.equal(result.audit?.seedUsed, true);
  assert.equal(result.audit?.randomSeed, 42);
  assert.equal(result.audit?.engineVersion, DRAW_STRATEGY_ENGINE_VERSION);
  assert.equal(result.metadata?.foundationOnly, true);
});

test("strategy draw audit factory captures constraint and balance summaries", () => {
  const strategy = getDrawStrategyFromCatalog(CANONICAL_DRAW_STRATEGY_ID.AI_HEURISTIC);
  const audit = createStrategyDrawAudit({
    strategy,
    distributionType: DISTRIBUTION_TYPE.HYBRID,
    seedUsed: true,
    constraintSummary: { enabled: true, categories: ["club"], repairAllowed: true },
    balanceSummary: { enabled: true, metric: "average_level", targetSpread: 0.3 },
    randomSeed: 99,
  });

  assert.equal(audit.strategy?.id, CANONICAL_DRAW_STRATEGY_ID.AI_HEURISTIC);
  assert.equal(audit.constraintSummary.enabled, true);
  assert.equal(audit.balanceSummary.metric, "average_level");
  assert.equal(audit.randomSeed, 99);
});

test("strategy contracts serialize and clone safely", () => {
  const request = createStrategyDrawRequest({
    tournamentId: "t1",
    configuration: createStrategyDrawConfiguration({ drawMode: "open", groupCount: 2 }),
    distributionPolicy: createDistributionPolicy({ type: DISTRIBUTION_TYPE.RANDOM }),
    entries: [{ id: "e1" }],
  });

  const cloned = cloneStrategyDrawRequest(request);
  cloned.entries.push({ id: "e2" });
  assert.equal(request.entries.length, 1);
  assert.equal(cloned.entries.length, 2);

  const serialized = serializeStrategyDrawContract(
    createStrategyDrawResult({
      placements: [createDrawPlacement({ entryId: "e1", groupIndex: 0 })],
      audit: createStrategyDrawAudit({ distributionType: DISTRIBUTION_TYPE.RANDOM }),
    })
  );
  assert.equal(typeof serialized, "object");
  assert.equal(serialized.placements[0].entryId, "e1");
});

test("strategy request and result shape validators", () => {
  const validRequest = createStrategyDrawRequest({
    configuration: createStrategyDrawConfiguration({ drawMode: "manual" }),
  });
  assert.equal(validateStrategyDrawRequestShape(validRequest).ok, true);

  const validResult = createStrategyDrawResult({});
  assert.equal(validateStrategyDrawResultShape(validResult).ok, true);

  assert.equal(validateStrategyDrawRequestShape(null).ok, false);
  assert.equal(validateStrategyDrawResultShape({ groups: null }).ok, false);
});

test("importing competition-core draw strategy foundation has no side effects", () => {
  assert.equal(typeof selectDrawStrategy, "function");
  assert.equal(typeof buildFoundationStrategyDrawResult, "function");
  assert.equal(CANONICAL_DRAW_STRATEGY_CATALOG.every((item) => item.id && item.name), true);
});
