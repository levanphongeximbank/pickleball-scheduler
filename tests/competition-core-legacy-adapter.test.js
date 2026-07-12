import test from "node:test";
import assert from "node:assert/strict";

import {
  COMPETITION_ENGINE_TYPE,
  cloneCompetitionEngineInput,
  executeCompetitionEngine,
  isBusinessPayloadPreserved,
  isEngineV2Available,
  resolveEngineExecutionPlan,
  wrapLegacyEngineResult,
} from "../src/features/competition-core/index.js";

const sampleInput = {
  engineType: COMPETITION_ENGINE_TYPE.DRAW,
  tournamentId: "t-1",
  clubId: "club-a",
  payload: {
    groupCount: 4,
    participants: [{ id: "p1" }],
  },
};

test("resolveEngineExecutionPlan selects legacy path when flags off", () => {
  const plan = resolveEngineExecutionPlan(sampleInput, {});
  assert.equal(plan.executionPath, "legacy");
  assert.equal(plan.v2FlagEnabled, false);
  assert.equal(isEngineV2Available(COMPETITION_ENGINE_TYPE.DRAW, {}), false);
  assert.match(plan.legacyEngineId, /legacy:drawEngine/);
});

test("adapter clone does not mutate original business payload", () => {
  const plan = resolveEngineExecutionPlan(sampleInput, {});
  plan.input.payload.groupCount = 99;

  assert.equal(sampleInput.payload.groupCount, 4);
  assert.equal(isBusinessPayloadPreserved(sampleInput.payload, plan.input.payload), false);

  const cloned = cloneCompetitionEngineInput(sampleInput);
  cloned.payload.groupCount = 99;
  assert.equal(sampleInput.payload.groupCount, 4);
});

test("executeCompetitionEngine without executor does not throw and does not write data", async () => {
  const result = await executeCompetitionEngine(sampleInput, { envSource: {} });
  assert.equal(result.executionPath, "legacy");
  assert.equal(result.success, false);
  assert.match(result.error || "", /Legacy executor not configured/);
});

test("executeCompetitionEngine delegates to injected legacy executor", async () => {
  let receivedInput = null;
  const legacyResult = { ok: true, data: { groups: [{ label: "A" }] } };

  const result = await executeCompetitionEngine(sampleInput, {
    envSource: {},
    legacyExecutor: (normalizedInput) => {
      receivedInput = normalizedInput;
      return legacyResult;
    },
  });

  assert.equal(result.success, true);
  assert.equal(result.result, legacyResult);
  assert.equal(receivedInput.tournamentId, "t-1");
  assert.deepEqual(receivedInput.payload, sampleInput.payload);
});

test("wrapLegacyEngineResult passes legacy payload through unchanged", () => {
  const legacy = { ok: true, data: { drawScore: 880 }, explain: ["snake"] };
  const wrapped = wrapLegacyEngineResult({
    engineType: COMPETITION_ENGINE_TYPE.DRAW,
    legacyEngine: "legacy:drawEngine",
    legacyResult: legacy,
  });

  assert.equal(wrapped.result, legacy);
  assert.equal(wrapped.result.data.drawScore, 880);
});

test("draw v2 flag enabled resolves to v2 when draw adapter available", () => {
  const env = {
    VITE_COMPETITION_CORE_ENABLED: "true",
    VITE_COMPETITION_CORE_DRAW_V2_ENABLED: "true",
  };

  const plan = resolveEngineExecutionPlan(sampleInput, env);
  assert.equal(plan.v2FlagEnabled, true);
  assert.equal(isEngineV2Available(COMPETITION_ENGINE_TYPE.DRAW, env), true);
  assert.equal(plan.executionPath, "v2");
});

test("rating v2 flag reports engine available in CC-02", () => {
  const env = {
    VITE_COMPETITION_CORE_ENABLED: "true",
    VITE_COMPETITION_CORE_RATING_V2_ENABLED: "true",
  };

  assert.equal(isEngineV2Available(COMPETITION_ENGINE_TYPE.RATING, env), true);

  const ratingInput = {
    ...sampleInput,
    engineType: COMPETITION_ENGINE_TYPE.RATING,
  };
  const plan = resolveEngineExecutionPlan(ratingInput, env);
  assert.equal(plan.v2FlagEnabled, true);
  assert.equal(plan.executionPath, "v2");
});

test("importing competition core has no localStorage side effects", () => {
  const original = globalThis.localStorage;
  globalThis.localStorage = {
    getItem() {
      throw new Error("localStorage should not be accessed on import");
    },
    setItem() {
      throw new Error("localStorage should not be accessed on import");
    },
  };

  assert.doesNotThrow(() => {
    void cloneCompetitionEngineInput(sampleInput);
    void resolveEngineExecutionPlan(sampleInput, {});
  });

  globalThis.localStorage = original;
});
