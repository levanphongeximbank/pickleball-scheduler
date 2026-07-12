import test from "node:test";
import assert from "node:assert/strict";

import {
  COMPETITION_CORE_FLAG_KEYS,
  COMPETITION_ENGINE_TYPE,
  FORMATION_RUNTIME_ADAPTER_VERSION,
  FORMATION_STRATEGY,
  LEGACY_FORMATION_RUNTIME_INVENTORY,
  appendFormationRuntimeDecisionTrace,
  buildFormationDecisionPath,
  buildFormationRuntimeCallGraph,
  cloneLegacyFormationPayload,
  evaluateCanonicalFormation,
  executeCompetitionEngine,
  isEngineV2Available,
  isFormationV2Enabled,
  isLegacyFormationOutputPreserved,
  mapLegacyFormationPayloadToCanonicalRequest,
  mapLegacyFormationResultToFormationResult,
  resolveEngineExecutionPlan,
  resolveLegacyFormationRandomFn,
  runFormationShadowComparison,
  runLegacyFormationWithCanonicalAdapter,
  summarizeFormationRuntimeDecisionTrace,
  verifyFormationRandomParity,
} from "../src/features/competition-core/index.js";

const formationV2Env = {
  [COMPETITION_CORE_FLAG_KEYS.CORE]: "true",
  [COMPETITION_CORE_FLAG_KEYS.FORMATION_V2]: "true",
};

const samplePlayers = [
  { id: "m1", name: "Nam 1", gender: "male", rating: 4.5 },
  { id: "m2", name: "Nam 2", gender: "male", rating: 4.0 },
  { id: "m3", name: "Nam 3", gender: "male", rating: 3.8 },
  { id: "m4", name: "Nam 4", gender: "male", rating: 3.5 },
  { id: "f1", name: "Nu 1", gender: "female", rating: 4.2 },
  { id: "f2", name: "Nu 2", gender: "female", rating: 3.9 },
  { id: "f3", name: "Nu 3", gender: "female", rating: 3.6 },
  { id: "f4", name: "Nu 4", gender: "female", rating: 3.4 },
];

function mockLegacyExecutor(payload) {
  return {
    teams: [
      {
        id: "team-1",
        name: payload.options?.teamNames?.[0] || "Team 1",
        playerIds: ["m1", "m2", "f1", "f2"],
        avgLevel: 4.15,
        seed: 1,
      },
      {
        id: "team-2",
        name: payload.options?.teamNames?.[1] || "Team 2",
        playerIds: ["m3", "m4", "f3", "f4"],
        avgLevel: 3.58,
        seed: 2,
      },
    ],
    waitingPlayerIds: [],
    warnings: [],
  };
}

test("runtime inventory exposes audited formation call graph", () => {
  assert.equal(FORMATION_RUNTIME_ADAPTER_VERSION, "cc05b-v1");
  assert.equal(LEGACY_FORMATION_RUNTIME_INVENTORY.length >= 10, true);
  const graph = buildFormationRuntimeCallGraph();
  assert.equal(graph.version, "cc05b-v1");
  assert.equal(graph.nodes.includes("pairTeamsFromSelectedPlayers"), true);
  assert.equal(graph.edges.some((edge) => edge.to === "runAI"), true);
});

test("legacy formation payload maps to canonical FormationRequest", () => {
  const payload = {
    strategyKey: "mlp_team_pairing",
    sessionId: "s1",
    players: samplePlayers,
    constraints: [{ kind: "gender", severity: "hard" }],
    options: { teamCount: 2 },
  };

  const request = mapLegacyFormationPayloadToCanonicalRequest(payload);
  assert.equal(request.sessionId, "s1");
  assert.equal(request.policy.strategy, FORMATION_STRATEGY.TEAM_MATCH);
  assert.equal(request.players.length, 8);
  assert.equal(request.constraints[0].kind, "gender");
});

test("legacy team result maps to FormationResult with round-trip preservation", () => {
  const legacyResult = mockLegacyExecutor({ options: { teamNames: ["A", "B"] } });
  const request = mapLegacyFormationPayloadToCanonicalRequest({
    strategyKey: "mlp_team_pairing",
    players: samplePlayers,
  });
  const formationResult = mapLegacyFormationResultToFormationResult(legacyResult, request);

  assert.equal(formationResult.pairs.length, 2);
  assert.equal(formationResult.ok, true);
  assert.equal(isLegacyFormationOutputPreserved(legacyResult, legacyResult), true);
  assert.equal(formationResult.audit?.strategy, FORMATION_STRATEGY.TEAM_MATCH);
});

test("flag OFF evaluateCanonicalFormation uses direct legacy path", () => {
  let executorCalls = 0;
  const bridge = evaluateCanonicalFormation({
    consumer: "team_mlp_pairing",
    legacyPayload: {
      strategyKey: "mlp_team_pairing",
      players: samplePlayers,
      options: { teamCount: 2 },
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
  assert.equal(bridge.formationRequest, undefined);
  assert.equal(bridge.trace.records[0].usedCanonical, false);
});

test("flag ON evaluateCanonicalFormation builds trace and preserves legacy output", () => {
  const bridge = evaluateCanonicalFormation({
    consumer: "team_mlp_pairing",
    legacyPayload: {
      strategyKey: "mlp_team_pairing",
      players: samplePlayers,
      options: { teamCount: 2, teamNames: ["A", "B"] },
    },
    envSource: formationV2Env,
    legacyExecutor: mockLegacyExecutor,
  });

  assert.equal(isFormationV2Enabled(formationV2Env), true);
  assert.equal(bridge.usedCanonical, true);
  assert.equal(bridge.executionPath, "canonical-adapter");
  assert.equal(bridge.formationRequest?.policy.strategy, FORMATION_STRATEGY.TEAM_MATCH);
  assert.equal(bridge.formationResult?.pairs.length, 2);
  assert.equal(bridge.outputPreserved, true);
  assert.equal(bridge.randomFnPreserved, true);

  const summary = summarizeFormationRuntimeDecisionTrace(bridge.trace);
  assert.equal(summary.canonicalCount, 1);
  assert.equal(bridge.trace.records[0].path.length, 6);
  assert.equal(bridge.trace.records[0].path[0].phase, "player");
  assert.equal(bridge.trace.records[0].path[5].phase, "result");
});

test("decision trace path includes player partner constraint score court result", () => {
  const path = buildFormationDecisionPath({
    formationRequest: {
      policy: { strategy: FORMATION_STRATEGY.TEAM_MATCH },
      players: samplePlayers,
      constraints: [{ kind: "gender", enabled: true }],
    },
    formationResult: {
      ok: true,
      pairs: [{ playerIds: ["m1", "f1"] }],
      courts: [{ id: "c1", label: "Court 1" }],
      audit: { scores: { finalScore: 0.9 } },
    },
  });

  assert.deepEqual(
    path.map((step) => step.phase),
    ["player", "partner", "constraint", "score", "court", "result"]
  );
});

test("legacy payload clone preserves Map and randomFn references", () => {
  const playersById = new Map([["p1", { id: "p1" }]]);
  const randomFn = () => 0.5;
  const payload = {
    strategyKey: "mlp_team_pairing",
    players: samplePlayers.slice(0, 2),
    options: { playersById, randomFn },
    randomFn,
  };
  const cloned = cloneLegacyFormationPayload(payload);
  cloned.players.push({ id: "x" });

  assert.equal(payload.players.length, 2);
  assert.equal(cloned.options.playersById, playersById);
  assert.equal(cloned.options.randomFn, randomFn);
  assert.equal(cloned.randomFn, randomFn);
});

test("adapter does not inject new randomFn", () => {
  const randomFn = () => 0.42;
  const payload = {
    strategyKey: "mlp_team_pairing",
    players: samplePlayers,
    randomFn,
  };

  evaluateCanonicalFormation({
    consumer: "team_mlp_pairing",
    legacyPayload: payload,
    envSource: formationV2Env,
    legacyExecutor: mockLegacyExecutor,
  });

  assert.equal(resolveLegacyFormationRandomFn(payload), randomFn);
  assert.equal(verifyFormationRandomParity(payload, payload), true);
});

test("formation v2 flag resolves to v2 execution plan when adapter available", () => {
  const input = {
    engineType: COMPETITION_ENGINE_TYPE.TEAM_FORMATION,
    sessionId: "s1",
    payload: { strategyKey: "mlp_team_pairing", players: samplePlayers },
  };

  assert.equal(isEngineV2Available(COMPETITION_ENGINE_TYPE.TEAM_FORMATION, formationV2Env), true);
  const plan = resolveEngineExecutionPlan(input, formationV2Env);
  assert.equal(plan.v2FlagEnabled, true);
  assert.equal(plan.executionPath, "v2");
});

test("executeCompetitionEngine team formation v2 delegates through canonical adapter", async () => {
  const legacyResult = mockLegacyExecutor({ options: { teamNames: ["A", "B"] } });
  const result = await executeCompetitionEngine(
    {
      engineType: COMPETITION_ENGINE_TYPE.TEAM_FORMATION,
      sessionId: "s1",
      payload: {
        strategyKey: "mlp_team_pairing",
        players: samplePlayers,
      },
    },
    {
      envSource: formationV2Env,
      legacyExecutor: () => legacyResult,
    }
  );

  assert.equal(result.executionPath, "v2");
  assert.equal(result.success, true);
  assert.equal(result.result.teams.length, 2);
});

test("shadow comparison reports parity for identical legacy output", () => {
  const payload = {
    strategyKey: "mlp_team_pairing",
    players: samplePlayers,
    options: { teamCount: 2 },
  };

  const shadow = runFormationShadowComparison({
    strategy: "mlp_team_pairing",
    legacyPayload: payload,
    envSource: formationV2Env,
    legacyExecutor: mockLegacyExecutor,
  });

  assert.equal(shadow.comparison.ok, true);
  assert.equal(shadow.comparison.membershipParity, true);
  assert.equal(shadow.comparison.waitingParity, true);
  assert.equal(shadow.comparison.randomFnPreserved, true);
  assert.deepEqual(shadow.primary.teams, shadow.bridge.legacyResult.teams);
});

test("runLegacyFormationWithCanonicalAdapter returns legacy consumer shape", () => {
  const result = runLegacyFormationWithCanonicalAdapter({
    consumer: "team_mlp_pairing",
    strategyKey: "mlp_team_pairing",
    legacyPayload: {
      players: samplePlayers,
      options: { teamCount: 2 },
    },
    envSource: formationV2Env,
    legacyExecutor: mockLegacyExecutor,
  });

  assert.equal(Array.isArray(result.teams), true);
  assert.equal(result.teams.length, 2);
});

test("CORE=false with FORMATION_V2=true stays on legacy path", () => {
  const env = {
    [COMPETITION_CORE_FLAG_KEYS.CORE]: "false",
    [COMPETITION_CORE_FLAG_KEYS.FORMATION_V2]: "true",
  };
  assert.equal(isFormationV2Enabled(env), false);
  const bridge = evaluateCanonicalFormation({
    consumer: "team_mlp_pairing",
    legacyPayload: { strategyKey: "mlp_team_pairing", players: samplePlayers },
    envSource: env,
    legacyExecutor: mockLegacyExecutor,
  });
  assert.equal(bridge.usedCanonical, false);
  assert.equal(bridge.executionPath, "legacy");
});

test("importing formation runtime adapter has no side effects", () => {
  assert.equal(typeof evaluateCanonicalFormation, "function");
  assert.equal(typeof appendFormationRuntimeDecisionTrace, "function");
  assert.equal(LEGACY_FORMATION_RUNTIME_INVENTORY.every((item) => item.runtimeFunction), true);
});
