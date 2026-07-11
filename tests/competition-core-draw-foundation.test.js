import test from "node:test";
import assert from "node:assert/strict";

import {
  CANONICAL_DRAW_MODE,
  CANONICAL_DRAW_MODE_VALUES,
  CC01_DRAW_MODE_TO_CANONICAL,
  COMPETITION_CORE_FLAG_KEYS,
  DRAW_CONSTRAINT_CATEGORY,
  DRAW_ENGINE_VERSION,
  DRAW_MODE,
  DRAW_RANDOM_GENERATOR,
  DRAW_SEED_SOURCE,
  DRAW_STRATEGY_KIND,
  createAverageLevelDrawSeed,
  createDefaultDrawStrategyBundle,
  createDrawAudit,
  createDrawCandidate,
  createDrawConstraint,
  createDrawEngineResult,
  createDrawExplanation,
  createDrawGroup,
  createDrawMetadata,
  createDrawRandomMetadata,
  createDrawRequest,
  createDrawResult,
  createDrawSeed,
  createManualDrawSeed,
  createSeedStrategy,
  cloneDrawRequest,
  isCanonicalDrawMode,
  isDrawV2Enabled,
  mapCc01DrawModeToCanonical,
  mapLegacyDrawModeToCanonical,
  serializeDrawContract,
  validateDrawRequestShape,
  validateDrawResultShape,
} from "../src/features/competition-core/index.js";

function assertUniqueValues(valuesSet, label) {
  const values = [...valuesSet];
  assert.equal(values.length, new Set(values).size, `${label} must not contain duplicate values`);
}

test("canonical draw mode enum is unique and complete", () => {
  assert.equal(CANONICAL_DRAW_MODE.SEEDED, "seeded");
  assert.equal(CANONICAL_DRAW_MODE.OPEN, "open");
  assert.equal(CANONICAL_DRAW_MODE.RANDOM, "random");
  assert.equal(CANONICAL_DRAW_MODE.SNAKE, "snake");
  assert.equal(CANONICAL_DRAW_MODE.HEURISTIC, "heuristic");
  assert.equal(CANONICAL_DRAW_MODE.TEAM, "team");
  assert.equal(CANONICAL_DRAW_MODE.MANUAL, "manual");
  assert.equal(CANONICAL_DRAW_MODE.CUSTOM, "custom");
  assert.equal(CANONICAL_DRAW_MODE.UNKNOWN, "unknown");
  assertUniqueValues(CANONICAL_DRAW_MODE_VALUES, "CANONICAL_DRAW_MODE");
  assert.equal(isCanonicalDrawMode("snake"), true);
  assert.equal(isCanonicalDrawMode("pure_random"), false);
});

test("CC-01 DRAW_MODE maps to canonical modes without breaking legacy enum", () => {
  assert.equal(DRAW_MODE.PURE_RANDOM, "pure_random");
  assert.equal(mapCc01DrawModeToCanonical(DRAW_MODE.PURE_RANDOM), CANONICAL_DRAW_MODE.RANDOM);
  assert.equal(
    mapCc01DrawModeToCanonical(DRAW_MODE.CONSTRAINED_RANDOM),
    CANONICAL_DRAW_MODE.OPEN
  );
  assert.equal(
    mapCc01DrawModeToCanonical(DRAW_MODE.SKILL_CONTROLLED),
    CANONICAL_DRAW_MODE.SNAKE
  );
  assert.equal(mapCc01DrawModeToCanonical(DRAW_MODE.MANUAL), CANONICAL_DRAW_MODE.MANUAL);
  assert.equal(CC01_DRAW_MODE_TO_CANONICAL[DRAW_MODE.PURE_RANDOM], CANONICAL_DRAW_MODE.RANDOM);
});

test("legacy runtime strings map to canonical draw modes", () => {
  assert.equal(mapLegacyDrawModeToCanonical("open"), CANONICAL_DRAW_MODE.RANDOM);
  assert.equal(mapLegacyDrawModeToCanonical("official_open"), CANONICAL_DRAW_MODE.OPEN);
  assert.equal(mapLegacyDrawModeToCanonical("skill_controlled"), CANONICAL_DRAW_MODE.SNAKE);
  assert.equal(mapLegacyDrawModeToCanonical("heuristic"), CANONICAL_DRAW_MODE.HEURISTIC);
  assert.equal(mapLegacyDrawModeToCanonical("mlp_auto_draw"), CANONICAL_DRAW_MODE.TEAM);
  assert.equal(mapLegacyDrawModeToCanonical("not-a-mode"), CANONICAL_DRAW_MODE.UNKNOWN);
  assert.equal(mapLegacyDrawModeToCanonical("snake"), CANONICAL_DRAW_MODE.SNAKE);
});

test("draw domain factories create metadata, audit, and explanation objects", () => {
  const seed = createManualDrawSeed({
    entryId: "e1",
    seedNumber: 3,
    averageLevel: 4.2,
  });
  assert.equal(seed.source, DRAW_SEED_SOURCE.MANUAL);
  assert.equal(seed.seedNumber, 3);

  const group = createDrawGroup({
    id: "g-b",
    label: "Group B",
    entryIds: ["e1"],
    seedNumbers: [3],
  });
  assert.deepEqual(group.entryIds, ["e1"]);

  const explanation = createDrawExplanation({
    code: "snake_placement",
    title: "Snake distribution",
    message: "Player X placed into Group B",
    playerId: "p1",
    seedNumber: 3,
    groupId: "g-b",
    distributionPath: [
      "Player X",
      "Seed #3",
      "Snake distribution",
      "Group B",
      "Balanced average level",
      "Club separation satisfied",
    ],
    reasons: ["Balanced average level", "Club separation satisfied"],
  });
  assert.equal(explanation.distributionPath.length, 6);

  const metadata = createDrawMetadata({
    drawId: "draw-1",
    drawMode: CANONICAL_DRAW_MODE.SNAKE,
    randomSeed: 42,
    retryCount: 2,
    heuristicScore: 88,
    strategy: createSeedStrategy({ id: "seed-v1" }),
  });
  assert.equal(metadata.engineVersion, DRAW_ENGINE_VERSION);
  assert.equal(metadata.drawMode, CANONICAL_DRAW_MODE.SNAKE);
  assert.equal(metadata.strategy.kind, DRAW_STRATEGY_KIND.SEED);
  assert.equal(metadata.strategy.implemented, false);

  const audit = createDrawAudit({
    requestSnapshot: { groupCount: 4 },
    resolvedSeeds: [seed],
    distributionPath: explanation.distributionPath,
    selectedCandidate: createDrawCandidate({
      id: "c1",
      groups: [group],
      score: 88,
    }),
    finalScore: 88,
    randomSeed: 42,
    explanations: [explanation],
  });
  assert.equal(audit.engineVersion, DRAW_ENGINE_VERSION);
  assert.equal(audit.selectedCandidate?.groups[0].id, "g-b");
});

test("draw request/result contracts validate and serialize safely", () => {
  const request = createDrawRequest({
    tournamentId: "t1",
    drawMode: CANONICAL_DRAW_MODE.OPEN,
    groupCount: 4,
    entries: [{ id: "e1" }],
    seeds: [createAverageLevelDrawSeed({ entryId: "e1", seedNumber: 1 })],
    constraints: [
      createDrawConstraint({
        category: DRAW_CONSTRAINT_CATEGORY.CLUB_SEPARATION,
        severity: "soft",
      }),
    ],
    strategies: createDefaultDrawStrategyBundle(),
    random: createDrawRandomMetadata({
      randomSeed: 99,
      generator: DRAW_RANDOM_GENERATOR.MULBERRY32,
      deterministic: true,
    }),
  });

  const validation = validateDrawRequestShape(request);
  assert.equal(validation.ok, true);

  const cloned = cloneDrawRequest(request);
  cloned.entries.push({ id: "mutated" });
  assert.equal(request.entries.length, 1);

  const result = createDrawResult({
    ok: true,
    groups: [createDrawGroup({ id: "g1", entryIds: ["e1"] })],
    explanations: [],
    conflicts: [],
    metadata: createDrawMetadata({ drawMode: CANONICAL_DRAW_MODE.OPEN }),
  });
  assert.equal(validateDrawResultShape(result).ok, true);

  const roundTrip = serializeDrawContract(request);
  assert.equal(roundTrip.drawMode, CANONICAL_DRAW_MODE.OPEN);
  assert.equal(roundTrip.random.generator, DRAW_RANDOM_GENERATOR.MULBERRY32);

  const engineResult = createDrawEngineResult({
    success: false,
    enabled: false,
    request,
    result,
    executionPath: "foundation",
  });
  assert.equal(engineResult.enabled, false);
  assert.equal(engineResult.engineVersion, DRAW_ENGINE_VERSION);
});

test("DRAW_V2 flag defaults false and requires master flag", () => {
  assert.equal(isDrawV2Enabled({}), false);
  assert.equal(
    isDrawV2Enabled({
      [COMPETITION_CORE_FLAG_KEYS.DRAW_V2]: "true",
    }),
    false
  );
  assert.equal(
    isDrawV2Enabled({
      [COMPETITION_CORE_FLAG_KEYS.CORE]: "true",
      [COMPETITION_CORE_FLAG_KEYS.DRAW_V2]: "true",
    }),
    true
  );
});

test("importing draw foundation has no runtime side effects", async () => {
  const before = Object.keys(globalThis).length;
  await import("../src/features/competition-core/draw/index.js");
  const after = Object.keys(globalThis).length;
  assert.equal(after, before);
  assert.equal(createDrawSeed({}).source, DRAW_SEED_SOURCE.UNKNOWN);
});
