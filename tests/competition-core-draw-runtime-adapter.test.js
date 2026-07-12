import test from "node:test";
import assert from "node:assert/strict";

import {
  CANONICAL_DRAW_STRATEGY_ID,
  COMPETITION_CORE_FLAG_KEYS,
  COMPETITION_ENGINE_TYPE,
  DISTRIBUTION_TYPE,
  DRAW_RUNTIME_ADAPTER_VERSION,
  LEGACY_DRAW_RUNTIME_INVENTORY,
  appendDrawDecisionTrace,
  buildDrawDecisionPath,
  buildDrawRuntimeCallGraph,
  cloneLegacyDrawPayload,
  evaluateCanonicalDraw,
  executeCompetitionEngine,
  isDrawV2Enabled,
  isEngineV2Available,
  isLegacyDrawOutputPreserved,
  mapLegacyDrawPayloadToDrawRequest,
  mapLegacyDrawPayloadToStrategyDrawRequest,
  mapLegacyDrawResultToDrawResult,
  mapLegacyGroupsToDrawGroups,
  resolveEngineExecutionPlan,
  summarizeDrawDecisionTrace,
} from "../src/features/competition-core/index.js";

const drawV2Env = {
  [COMPETITION_CORE_FLAG_KEYS.CORE]: "true",
  [COMPETITION_CORE_FLAG_KEYS.DRAW_V2]: "true",
};

const sampleLegacyGroups = [
  { id: "g1", label: "A", entryIds: ["e1", "e2"], entries: [{ id: "e1" }, { id: "e2" }] },
  { id: "g2", label: "B", entryIds: ["e3"], entries: [{ id: "e3" }] },
];

function mockLegacyExecutor(payload) {
  return {
    ok: true,
    groups: sampleLegacyGroups.map((group) => ({
      ...group,
      tournamentId: payload.tournamentId,
      eventId: payload.eventId,
    })),
    warnings: [],
  };
}

test("runtime inventory exposes audited draw call graph", () => {
  assert.equal(DRAW_RUNTIME_ADAPTER_VERSION, "cc04d-v1");
  assert.equal(LEGACY_DRAW_RUNTIME_INVENTORY.length >= 10, true);
  const graph = buildDrawRuntimeCallGraph();
  assert.equal(graph.version, "cc04d-v1");
  assert.equal(graph.nodes.includes("assignGroupsWithConstraints"), true);
  assert.equal(graph.edges.some((edge) => edge.to === "buildOfficialOpenPlan"), true);
});

test("legacy draw payload maps to canonical DrawRequest and StrategyDrawRequest", () => {
  const payload = {
    strategyKey: "skill_controlled",
    tournamentId: "t1",
    eventId: "ev1",
    groupCount: 4,
    entries: [{ id: "e1", playerIds: ["p1"] }],
    players: [{ id: "p1" }],
    constraints: [{ type: "avoid_same_group" }],
  };

  const drawRequest = mapLegacyDrawPayloadToDrawRequest(payload);
  assert.equal(drawRequest.tournamentId, "t1");
  assert.equal(drawRequest.groupCount, 4);
  assert.equal(drawRequest.drawMode, "snake");
  assert.equal(drawRequest.entries.length, 1);

  const strategyRequest = mapLegacyDrawPayloadToStrategyDrawRequest(payload);
  assert.equal(strategyRequest.selection?.strategyId, CANONICAL_DRAW_STRATEGY_ID.SNAKE);
  assert.equal(strategyRequest.selection?.distributionType, DISTRIBUTION_TYPE.SNAKE);
});

test("legacy groups map to canonical result without changing membership", () => {
  const legacyResult = mockLegacyExecutor({ tournamentId: "t1", eventId: "ev1" });
  const drawResult = mapLegacyDrawResultToDrawResult(legacyResult);
  const canonicalGroups = mapLegacyGroupsToDrawGroups(legacyResult.groups);

  assert.equal(drawResult.groups.length, 2);
  assert.deepEqual(canonicalGroups[0].entryIds, ["e1", "e2"]);
  assert.equal(drawResult.groups[0].entryIds.length, 2);
});

test("flag OFF evaluateCanonicalDraw uses direct legacy path", () => {
  let executorCalls = 0;
  const bridge = evaluateCanonicalDraw({
    consumer: "internal_tournament",
    legacyPayload: {
      strategyKey: "skill_controlled",
      entries: [{ id: "e1" }],
      groupCount: 2,
      players: [],
      constraints: [],
    },
    envSource: {},
    legacyExecutor: (payload) => {
      executorCalls += 1;
      return mockLegacyExecutor(payload);
    },
  });

  assert.equal(bridge.usedCanonical, false);
  assert.equal(bridge.executionPath, "legacy");
  assert.equal(executorCalls, 1);
  assert.equal(bridge.legacyResult.groups.length, 2);
  assert.equal(bridge.drawRequest, undefined);
  assert.equal(bridge.trace.records[0].usedCanonical, false);
});

test("flag ON evaluateCanonicalDraw builds trace and preserves legacy output", () => {
  const bridge = evaluateCanonicalDraw({
    consumer: "official_ai_balance",
    legacyPayload: {
      strategyKey: "official_ai_balance",
      tournamentId: "t1",
      entries: [{ id: "e1" }, { id: "e2" }, { id: "e3" }],
      groupCount: 2,
      players: [],
      constraints: [],
    },
    envSource: drawV2Env,
    legacyExecutor: mockLegacyExecutor,
  });

  assert.equal(isDrawV2Enabled(drawV2Env), true);
  assert.equal(bridge.usedCanonical, true);
  assert.equal(bridge.executionPath, "canonical-adapter");
  assert.equal(bridge.drawRequest?.drawMode, "snake");
  assert.equal(bridge.strategyDrawRequest?.selection?.strategyId, CANONICAL_DRAW_STRATEGY_ID.BALANCED);
  assert.equal(bridge.drawResult?.groups.length, 2);
  assert.equal(bridge.outputPreserved, true);
  assert.equal(isLegacyDrawOutputPreserved(mockLegacyExecutor({}), bridge.legacyResult), true);

  const summary = summarizeDrawDecisionTrace(bridge.trace);
  assert.equal(summary.canonicalCount, 1);
  assert.equal(bridge.trace.records[0].path.length, 6);
  assert.equal(bridge.trace.records[0].path[0].phase, "strategy");
  assert.equal(bridge.trace.records[0].path[5].phase, "final_placement");
});

test("decision trace path includes strategy seed distribution constraint balance placement", () => {
  const path = buildDrawDecisionPath({
    selection: {
      strategyId: CANONICAL_DRAW_STRATEGY_ID.SNAKE,
      distributionType: DISTRIBUTION_TYPE.SNAKE,
      strategy: { name: "Snake" },
    },
    seedPolicy: { required: true },
    distributionPolicy: { type: DISTRIBUTION_TYPE.SNAKE, deterministic: true },
    constraintPolicy: { enabled: true, categories: ["club"], repairAllowed: true },
    balancePolicy: { enabled: true, metric: "average_level", targetSpread: 0.5 },
    drawResult: { groups: [{ entryIds: ["e1"] }] },
  });

  assert.deepEqual(
    path.map((step) => step.phase),
    ["strategy", "seed", "distribution", "constraint", "balance", "final_placement"]
  );
});

test("legacy payload clone preserves Map and function references", () => {
  const playersById = new Map([["p1", { id: "p1" }]]);
  const randomFn = () => 0.5;
  const payload = {
    strategyKey: "official_open",
    entries: [{ id: "e1" }],
    options: { playersById, randomFn },
  };
  const cloned = cloneLegacyDrawPayload(payload);
  cloned.entries.push({ id: "e2" });

  assert.equal(payload.entries.length, 1);
  assert.equal(cloned.options.playersById, playersById);
  assert.equal(cloned.options.randomFn, randomFn);
});

test("draw v2 flag resolves to v2 execution plan when adapter available", () => {
  const input = {
    engineType: COMPETITION_ENGINE_TYPE.DRAW,
    tournamentId: "t1",
    payload: { strategyKey: "skill_controlled", groupCount: 4, entries: [] },
  };

  assert.equal(isEngineV2Available(COMPETITION_ENGINE_TYPE.DRAW, drawV2Env), true);
  const plan = resolveEngineExecutionPlan(input, drawV2Env);
  assert.equal(plan.v2FlagEnabled, true);
  assert.equal(plan.executionPath, "v2");
});

test("executeCompetitionEngine draw v2 delegates through canonical adapter", async () => {
  const legacyResult = { ok: true, groups: sampleLegacyGroups, warnings: [] };
  const result = await executeCompetitionEngine(
    {
      engineType: COMPETITION_ENGINE_TYPE.DRAW,
      tournamentId: "t1",
      payload: {
        strategyKey: "skill_controlled",
        groupCount: 2,
        entries: [{ id: "e1" }],
      },
    },
    {
      envSource: drawV2Env,
      legacyExecutor: () => legacyResult,
    }
  );

  assert.equal(result.executionPath, "v2");
  assert.equal(result.success, true);
  assert.equal(result.result.groups.length, 2);
});

test("importing draw runtime adapter has no side effects", () => {
  assert.equal(typeof evaluateCanonicalDraw, "function");
  assert.equal(typeof appendDrawDecisionTrace, "function");
  assert.equal(LEGACY_DRAW_RUNTIME_INVENTORY.every((item) => item.runtimeFunction), true);
});
