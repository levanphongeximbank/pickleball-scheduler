import test from "node:test";
import assert from "node:assert/strict";

import {
  COMPETITION_CORE_VERSION,
  COMPETITION_ENGINE_TYPE,
  CONSTRAINT_SEVERITY,
  COMPETITION_CONSTRAINT_TYPE,
  createCompetitionEngineInput,
  createCompetitionEngineResult,
  createConstraintDefinition,
  createDrawConfiguration,
  createEngineRunMetadata,
  createRatingSnapshot,
} from "../src/features/competition-core/index.js";

test("createCompetitionEngineResult includes required envelope fields", () => {
  const result = createCompetitionEngineResult({
    success: true,
    engineType: COMPETITION_ENGINE_TYPE.DRAW,
    result: { groups: [] },
    score: 91,
    executionPath: "legacy",
  });

  assert.equal(result.success, true);
  assert.equal(result.engineType, COMPETITION_ENGINE_TYPE.DRAW);
  assert.equal(result.engineVersion, COMPETITION_CORE_VERSION);
  assert.equal(result.score, 91);
  assert.equal(result.executionPath, "legacy");
  assert.ok(Array.isArray(result.explanations));
  assert.ok(Array.isArray(result.warnings));
});

test("createEngineRunMetadata keeps optional CC-01 fields undefined when omitted", () => {
  const metadata = createEngineRunMetadata({});
  assert.equal(metadata.engineVersion, COMPETITION_CORE_VERSION);
  assert.equal(metadata.randomSeed, undefined);
  assert.equal(metadata.generatedBy, undefined);
  assert.equal(metadata.legacyEngine, undefined);
});

test("contract factories clone nested objects", () => {
  const draw = createDrawConfiguration({ mode: "skill_controlled", groupCount: 4 });
  draw.groupCount = 8;

  const input = createCompetitionEngineInput({
    engineType: COMPETITION_ENGINE_TYPE.TEAM_FORMATION,
    draw: createDrawConfiguration({ mode: "skill_controlled", groupCount: 4 }),
    payload: { playerIds: ["1", "2"] },
  });

  assert.equal(input.draw?.groupCount, 4);
  assert.deepEqual(input.payload, { playerIds: ["1", "2"] });
});

test("createConstraintDefinition preserves severity and type", () => {
  const constraint = createConstraintDefinition({
    type: COMPETITION_CONSTRAINT_TYPE.MUST_NOT_PARTNER,
    severity: CONSTRAINT_SEVERITY.HARD,
    params: { playerA: "1", playerB: "2" },
  });

  assert.equal(constraint.type, COMPETITION_CONSTRAINT_TYPE.MUST_NOT_PARTNER);
  assert.equal(constraint.severity, CONSTRAINT_SEVERITY.HARD);
  assert.deepEqual(constraint.params, { playerA: "1", playerB: "2" });
});

test("createRatingSnapshot defaults nullable fields to null", () => {
  const snapshot = createRatingSnapshot({});
  assert.equal(snapshot.publicSkillLevel, null);
  assert.equal(snapshot.competitionElo, null);
  assert.equal(snapshot.dailyPlayRating, null);
});
