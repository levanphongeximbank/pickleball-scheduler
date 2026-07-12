import test from "node:test";
import assert from "node:assert/strict";

import { runAI } from "../src/ai/engine.js";
import {
  COMPETITION_CORE_FLAG_KEYS,
  COMPETITION_ENGINE_TYPE,
  buildCompleteMatchmakingTraceRecord,
  buildMatchmakingRuntimeCallGraph,
  cloneLegacyMatchmakingPayload,
  evaluateCanonicalMatchmaking,
  executeCompetitionEngine,
  isDrawV2Enabled,
  isEngineV2Available,
  isFormationV2Enabled,
  isLegacyMatchmakingOutputPreserved,
  isMatchmakingTraceJsonSerializable,
  isMatchmakingV2Enabled,
  isRatingV2Enabled,
  LEGACY_MATCHMAKING_RUNTIME_INVENTORY,
  mapLegacyMatchmakingPayloadToMatchmakingRequest,
  mapLegacyMatchmakingResultToMatchmakingResult,
  MATCHMAKING_STRATEGY,
  redactMatchmakingTraceSecrets,
  runMatchmakingShadowComparison,
  validateCompleteMatchmakingTraceRecord,
  verifyMatchmakingPayloadPreservation,
  verifyMatchmakingRandomParity,
} from "../src/features/competition-core/index.js";

const matchmakingV2Env = {
  [COMPETITION_CORE_FLAG_KEYS.CORE]: "true",
  [COMPETITION_CORE_FLAG_KEYS.MATCHMAKING_V2]: "true",
};

function createLocalStorageMock(seed = {}) {
  const store = new Map(Object.entries(seed));
  return {
    getItem(key) {
      return store.has(key) ? store.get(key) : null;
    },
    setItem(key, value) {
      store.set(key, String(value));
    },
    removeItem(key) {
      store.delete(key);
    },
    clear() {
      store.clear();
    },
  };
}

function createPlayers(count) {
  return Array.from({ length: count }, (_, index) => ({
    id: `p${index + 1}`,
    name: `Player ${index + 1}`,
    level: 3 + (index % 3) * 0.5,
    gender: index % 2 === 0 ? "Nam" : "Nữ",
  }));
}

function createCourts(count) {
  return Array.from({ length: count }, (_, index) => ({
    id: index + 1,
    name: `Court ${index + 1}`,
    number: index + 1,
    active: true,
  }));
}

function runAiExecutor(players, options) {
  globalThis.localStorage = createLocalStorageMock();
  return runAI(players, { ...options, persist: false });
}

function buildPayload(players, courts, options = {}) {
  return {
    strategyKey: "ai_balance",
    players,
    courts,
    options: {
      enabledCourts: courts,
      competitionType: options.competitionType || "doubles_mixed",
      persist: false,
      ...options,
    },
  };
}

test("runtime inventory exposes daily matchmaking call graph", () => {
  assert.equal(LEGACY_MATCHMAKING_RUNTIME_INVENTORY.length >= 6, true);
  const graph = buildMatchmakingRuntimeCallGraph();
  assert.equal(graph.nodes.includes("runAI"), true);
  assert.equal(graph.edges.some((e) => e.to === "runAI"), true);
});

test("legacy payload maps to MatchmakingRequest", () => {
  const payload = buildPayload(createPlayers(8), createCourts(2));
  const request = mapLegacyMatchmakingPayloadToMatchmakingRequest(payload);
  assert.equal(request.policy.strategy, MATCHMAKING_STRATEGY.BALANCED);
  assert.equal(request.players.length, 8);
  assert.equal(request.courts.length, 2);
});

test("legacy runAI result maps to MatchmakingResult with round-trip", () => {
  const players = createPlayers(8);
  const courts = createCourts(2);
  const legacy = runAiExecutor(players, { enabledCourts: courts, persist: false });
  const request = mapLegacyMatchmakingPayloadToMatchmakingRequest(buildPayload(players, courts));
  const canonical = mapLegacyMatchmakingResultToMatchmakingResult(legacy, request);
  assert.equal(canonical.courts.length, 2);
  assert.equal(isLegacyMatchmakingOutputPreserved(legacy, legacy), true);
});

test("flag OFF evaluateCanonicalMatchmaking uses direct legacy", () => {
  const payload = buildPayload(createPlayers(8), createCourts(2));
  const bridge = evaluateCanonicalMatchmaking({
    consumer: "daily_matchmaking",
    legacyPayload: payload,
    envSource: {},
    legacyExecutor: runAiExecutor,
  });
  assert.equal(bridge.usedCanonical, false);
  assert.equal(bridge.executionPath, "legacy");
  assert.equal(bridge.legacyResult.courts.length, 2);
});

test("master OFF + matchmaking ON stays legacy", () => {
  const env = {
    [COMPETITION_CORE_FLAG_KEYS.CORE]: "false",
    [COMPETITION_CORE_FLAG_KEYS.MATCHMAKING_V2]: "true",
  };
  assert.equal(isMatchmakingV2Enabled(env), false);
  const bridge = evaluateCanonicalMatchmaking({
    consumer: "daily_matchmaking",
    legacyPayload: buildPayload(createPlayers(8), createCourts(2)),
    envSource: env,
    legacyExecutor: runAiExecutor,
  });
  assert.equal(bridge.usedCanonical, false);
});

test("master ON + matchmaking OFF stays legacy", () => {
  const env = {
    [COMPETITION_CORE_FLAG_KEYS.CORE]: "true",
    [COMPETITION_CORE_FLAG_KEYS.MATCHMAKING_V2]: "false",
  };
  const bridge = evaluateCanonicalMatchmaking({
    consumer: "daily_matchmaking",
    legacyPayload: buildPayload(createPlayers(8), createCourts(2)),
    envSource: env,
    legacyExecutor: runAiExecutor,
  });
  assert.equal(bridge.usedCanonical, false);
});

test("both ON uses adapter path", () => {
  const bridge = evaluateCanonicalMatchmaking({
    consumer: "daily_matchmaking",
    legacyPayload: buildPayload(createPlayers(8), createCourts(2)),
    envSource: matchmakingV2Env,
    legacyExecutor: runAiExecutor,
  });
  assert.equal(isMatchmakingV2Enabled(matchmakingV2Env), true);
  assert.equal(bridge.usedCanonical, true);
  assert.equal(bridge.executionPath, "canonical-adapter");
});

test("shadow primary output is direct legacy", () => {
  const payload = buildPayload(createPlayers(8), createCourts(2));
  const shadow = runMatchmakingShadowComparison({
    strategy: "ai_balance",
    legacyPayload: payload,
    envSource: matchmakingV2Env,
    legacyExecutor: runAiExecutor,
  });
  assert.equal(shadow.comparison.ok, true);
  assert.equal(shadow.sideEffectSafe, true);
  assert.equal(shadow.executorInvocationCount, 1);
  assert.deepEqual(
    shadow.primary.courts?.length,
    shadow.bridge.legacyResult.courts?.length
  );
});

test("court allocation parity", () => {
  const shadow = runMatchmakingShadowComparison({
    strategy: "court_parity",
    legacyPayload: buildPayload(createPlayers(8), createCourts(2)),
    envSource: matchmakingV2Env,
    legacyExecutor: runAiExecutor,
  });
  assert.equal(shadow.comparison.courtAllocationParity, true);
});

test("waiting list parity with overflow players", () => {
  const shadow = runMatchmakingShadowComparison({
    strategy: "waiting_parity",
    legacyPayload: buildPayload(createPlayers(10), createCourts(2)),
    envSource: matchmakingV2Env,
    legacyExecutor: runAiExecutor,
  });
  assert.equal(shadow.comparison.waitingListParity, true);
});

test("score parity preserved", () => {
  const shadow = runMatchmakingShadowComparison({
    strategy: "score_parity",
    legacyPayload: buildPayload(createPlayers(8), createCourts(2)),
    envSource: matchmakingV2Env,
    legacyExecutor: runAiExecutor,
  });
  assert.equal(shadow.comparison.scoreParity, true);
});

test("randomFn reference preserved", () => {
  const randomFn = () => 0.33;
  const payload = buildPayload(createPlayers(8), createCourts(2), { randomFn });
  payload.randomFn = randomFn;
  const cloned = cloneLegacyMatchmakingPayload(payload);
  assert.equal(verifyMatchmakingRandomParity(payload, cloned), true);
});

test("Map/randomFn clone preserved", () => {
  const randomFn = () => 0.5;
  const payload = buildPayload(createPlayers(4), createCourts(1), { randomFn });
  payload.randomFn = randomFn;
  const cloned = cloneLegacyMatchmakingPayload(payload);
  assert.equal(cloned.randomFn, randomFn);
  assert.equal(cloned.options.randomFn, randomFn);
});

test("custom extension fields warned when unmapped", () => {
  const payload = buildPayload(createPlayers(4), createCourts(1));
  payload.customExtension = { foo: "bar" };
  const check = verifyMatchmakingPayloadPreservation(payload);
  assert.ok(check.unmappedFields.includes("customExtension"));
});

test("trace JSON serialization and secret redaction", () => {
  const payload = buildPayload(createPlayers(8), createCourts(2));
  const shadow = runMatchmakingShadowComparison({
    strategy: "trace",
    legacyPayload: payload,
    envSource: matchmakingV2Env,
    legacyExecutor: runAiExecutor,
  });
  assert.equal(isMatchmakingTraceJsonSerializable(shadow.traceRecord), true);
  assert.equal(validateCompleteMatchmakingTraceRecord(shadow.traceRecord).length, 0);

  const redacted = redactMatchmakingTraceSecrets({
    ...shadow.traceRecord,
    accessToken: "secret",
  });
  assert.equal(redacted.accessToken, "[REDACTED]");
});

test("executeCompetitionEngine matchmaking v2 delegates through adapter", async () => {
  const players = createPlayers(8);
  const courts = createCourts(2);
  const payload = buildPayload(players, courts);
  const result = await executeCompetitionEngine(
    {
      engineType: COMPETITION_ENGINE_TYPE.MATCHMAKING,
      sessionId: "s1",
      payload,
    },
    {
      envSource: matchmakingV2Env,
      legacyExecutor: (input) =>
        runAiExecutor(input.payload?.players || players, {
          enabledCourts: courts,
          persist: false,
        }),
    }
  );
  assert.equal(result.executionPath, "v2");
  assert.equal(result.success, true);
  assert.equal(result.result.courts.length, 2);
});

test("isEngineV2Available matchmaking", () => {
  assert.equal(isEngineV2Available(COMPETITION_ENGINE_TYPE.MATCHMAKING, matchmakingV2Env), true);
});

test("other v2 flags remain independent", () => {
  assert.equal(isFormationV2Enabled(matchmakingV2Env), false);
  assert.equal(isDrawV2Enabled(matchmakingV2Env), false);
  assert.equal(isRatingV2Enabled(matchmakingV2Env), false);
});

test("director lock strategy mapping", () => {
  const payload = buildPayload(createPlayers(8), createCourts(2), {
    lockedCourts: [1],
  });
  delete payload.strategyKey;
  payload.options.lockedCourts = [1];
  const request = mapLegacyMatchmakingPayloadToMatchmakingRequest(payload);
  assert.equal(request.policy.strategy, MATCHMAKING_STRATEGY.DIRECTOR_LOCK);
});

test("director lock explicit strategyKey", () => {
  const payload = buildPayload(createPlayers(8), createCourts(2));
  payload.strategyKey = "director_lock";
  const request = mapLegacyMatchmakingPayloadToMatchmakingRequest(payload);
  assert.equal(request.policy.strategy, MATCHMAKING_STRATEGY.DIRECTOR_LOCK);
});

test("invalid input preserves legacy errors through adapter", () => {
  const bridge = evaluateCanonicalMatchmaking({
    consumer: "invalid",
    legacyPayload: buildPayload([], createCourts(1)),
    envSource: matchmakingV2Env,
    legacyExecutor: runAiExecutor,
  });
  assert.ok(bridge.legacyResult.errors?.length > 0);
});

test("buildCompleteMatchmakingTraceRecord standalone", () => {
  const record = buildCompleteMatchmakingTraceRecord({
    bridge: {
      usedCanonical: true,
      executionPath: "canonical-adapter",
      legacyResult: { courts: [], waiting: [] },
      matchmakingRequest: { policy: { strategy: "balanced" }, players: [] },
      trace: { records: [] },
      randomFnPreserved: true,
      outputPreserved: true,
    },
  });
  assert.equal(record.strategy, "balanced");
  assert.equal(record.parityStatus, "output_preserved");
});
