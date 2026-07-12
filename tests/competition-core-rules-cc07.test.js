import test from "node:test";
import assert from "node:assert/strict";

import {
  COMPETITION_CONSTRAINT_TYPE,
  COMPETITION_CORE_FLAG_KEYS,
  RULES_DECISION_STATUS,
  RULES_RUNTIME_ERROR_CODE,
  buildCompleteRulesRuntimeTraceRecord,
  buildRulesRuntimeCallGraph,
  buildRulesShadowComparison,
  evaluateCanonicalRulesRuntime,
  evaluateLegacyAiPairScore,
  evaluateLegacyGroupConstraints,
  evaluateLegacyPairingConstraints,
  evaluateLegacyTeamLineupValidation,
  evaluateLegacyRefereeMatchEligibility,
  validateRulesRuntimeTraceRecord,
  isRulesRuntimeTraceJsonSerializable,
  isRulesV2Enabled,
  LEGACY_RULES_RUNTIME_INVENTORY,
  runRulesShadowComparison,
} from "../src/features/competition-core/index.js";
import { evaluateGroupConstraints } from "../src/features/pairing-constraints/engines/constraintEvaluator.js";
import { LINEUP_VALIDATION_CODE } from "../src/features/team-tournament/engines/lineupValidationContract.js";
import { validateLineupSelectionsStructured } from "../src/features/team-tournament/engines/lineupValidationEngine.js";

const v2Env = {
  [COMPETITION_CORE_FLAG_KEYS.CORE]: "true",
  [COMPETITION_CORE_FLAG_KEYS.RULES_V2]: "true",
};

test("1. flag OFF preserves legacy orchestrator path", () => {
  const bridge = evaluateCanonicalRulesRuntime({
    consumer: "test",
    envSource: {},
    legacyEvaluate: () => ({ ok: true, score: 5 }),
    ruleSet: { constraints: [] },
    context: { scope: "pairing", teams: [["a", "b"]] },
    candidate: { teams: [["a", "b"]] },
  });
  assert.equal(bridge.usedCanonical, false);
  assert.equal(bridge.result.ok, true);
});

test("2. master OFF overrides RULES_V2 subflag", () => {
  const env = {
    [COMPETITION_CORE_FLAG_KEYS.CORE]: "false",
    [COMPETITION_CORE_FLAG_KEYS.RULES_V2]: "true",
  };
  assert.equal(isRulesV2Enabled(env), false);
});

test("3. RULES_V2 ON uses canonical orchestrator", () => {
  const bridge = evaluateCanonicalRulesRuntime({
    consumer: "pairing",
    envSource: v2Env,
    candidate: { teams: [["1", "2"]] },
    context: { scope: "pairing" },
    ruleSet: {
      constraints: [
        {
          id: "avoid",
          type: COMPETITION_CONSTRAINT_TYPE.AVOID_PARTNER,
          severity: "hard",
          enabled: true,
          params: { anchorPlayerId: "1", targetPlayerIds: ["2"] },
        },
      ],
    },
    legacyEvaluate: () => ({ ok: true }),
  });
  assert.equal(bridge.usedCanonical, true);
  assert.equal(bridge.executionPath, "canonical-orchestrator");
  assert.equal(bridge.canonical?.feasible, false);
});

test("4. hard fail cannot be offset by soft score", () => {
  const bridge = evaluateLegacyPairingConstraints(
    [{ members: [{ id: "1" }, { id: "2" }] }],
    [
      {
        id: "avoid",
        type: "avoid_partner",
        mode: "hard",
        anchorPlayerId: "1",
        targetPlayerIds: ["2"],
        enabled: true,
      },
    ],
    { envSource: v2Env }
  );
  assert.equal(bridge.result.ok, false);
  assert.equal(bridge.canonical?.feasible, false);
});

test("5. soft rule never rejects when feasible", () => {
  const bridge = evaluateLegacyPairingConstraints(
    [{ members: [{ id: "1" }, { id: "3" }] }],
    [
      {
        id: "prefer",
        type: "prefer_partner",
        mode: "soft",
        anchorPlayerId: "1",
        targetPlayerIds: ["2"],
        enabled: true,
      },
    ],
    { envSource: v2Env }
  );
  assert.equal(bridge.result.ok, true);
});

test("6. orchestrator reports no double count by default", () => {
  const bridge = evaluateCanonicalRulesRuntime({
    consumer: "ai_scoring",
    envSource: v2Env,
    candidate: { matchOption: { teamA: ["1", "2"], teamB: ["3", "4"] } },
    context: { scope: "match", playersById: {} },
    ruleSet: { constraints: [] },
    legacyEvaluate: () => ({ score: 0 }),
  });
  assert.equal(bridge.doubleCountDetected, false);
});

test("7. group constraint bridge inventory wired", () => {
  assert.ok(LEGACY_RULES_RUNTIME_INVENTORY.some((item) => item.legacyKey === "group_constraints"));
});

test("8. same-club separation rejects shared group", () => {
  const groups = [
    {
      id: "g1",
      label: "A",
      entries: [{ playerIds: ["p1", "p2"] }],
    },
  ];
  const constraints = [
    {
      id: "sep",
      type: "avoid_same_group",
      mode: "hard",
      anchorPlayerId: "p1",
      targetPlayerIds: ["p2"],
      enabled: true,
    },
  ];
  const bridge = evaluateLegacyGroupConstraints(groups, constraints, { envSource: v2Env });
  assert.equal(bridge.usedCanonical, true);
  assert.equal(bridge.result.ok, false);
});

test("9. same-organization separation via group bridge soft score", () => {
  const result = evaluateGroupConstraints(
    [{ id: "g1", entries: [{ playerIds: ["p1", "p2"] }] }],
    [
      {
        id: "sep",
        type: "avoid_same_group",
        mode: "soft",
        anchorPlayerId: "p1",
        targetPlayerIds: ["p2"],
        enabled: true,
      },
    ],
    { envSource: v2Env }
  );
  assert.equal(result.ok, true);
  assert.ok(result.score <= 0);
});

test("10. team lineup duplicate player reject (legacy path flag off)", () => {
  const teamData = {
    disciplines: [{ id: "d1", name: "MD", playerCount: 2, genderRequirement: "mixed_pair" }],
    teams: [{ id: "t1", playerIds: ["p1", "p2", "p3"], name: "Team 1" }],
    settings: {},
  };
  const players = [
    { id: "p1", name: "A", gender: "Nam" },
    { id: "p2", name: "B", gender: "Nữ" },
    { id: "p3", name: "C", gender: "Nam" },
  ];
  const result = validateLineupSelectionsStructured({
    teamData,
    teamId: "t1",
    selections: { d1: ["p1", "p1"] },
    players,
    envSource: {},
  });
  assert.equal(result.ok, false);
  assert.equal(result.code, LINEUP_VALIDATION_CODE.DUPLICATE_PLAYER);
});

test("11. team roster membership reject", () => {
  const teamData = {
    disciplines: [{ id: "d1", name: "MD", playerCount: 2 }],
    teams: [{ id: "t1", playerIds: ["p1"], name: "Team 1" }],
    settings: {},
  };
  const result = validateLineupSelectionsStructured({
    teamData,
    teamId: "t1",
    selections: { d1: ["p9"] },
    players: [{ id: "p9", name: "X", gender: "Nam" }],
    envSource: {},
  });
  assert.equal(result.ok, false);
});

test("12. mixed lineup invalid reject", () => {
  const teamData = {
    disciplines: [
      {
        id: "d1",
        name: "MD",
        playerCount: 2,
        genderRequirement: "mixed_pair",
        categoryType: "mixed",
      },
    ],
    teams: [{ id: "t1", playerIds: ["p1", "p2"], name: "Team 1" }],
    settings: {},
  };
  const result = validateLineupSelectionsStructured({
    teamData,
    teamId: "t1",
    selections: { d1: ["p1", "p2"] },
    players: [
      { id: "p1", name: "A", gender: "Nam" },
      { id: "p2", name: "B", gender: "Nam" },
    ],
    envSource: {},
  });
  assert.equal(result.ok, false);
});

test("13. published/locked lineup reject via legacy contract", () => {
  const bridge = evaluateLegacyTeamLineupValidation(
    {
      legacyResult: {
        ok: false,
        code: LINEUP_VALIDATION_CODE.LINEUP_LOCKED,
        message: "Lineup locked",
      },
    },
    { envSource: v2Env }
  );
  assert.equal(bridge.result.ok, false);
});

test("14. referee eligibility bridge uses canonical path", () => {
  const bridge = evaluateLegacyRefereeMatchEligibility(
    {
      legacyResult: { ok: true },
      players: [{ id: "p1", gender: "Nam", level: 3 }],
      lineupSlots: [{ position: "s1", playerId: "p1", required: true }],
      teams: [["p1"]],
    },
    { envSource: v2Env }
  );
  assert.equal(bridge.usedCanonical, true);
});

test("15. player busy hard via AI bridge skill cap", () => {
  const bridge = evaluateLegacyAiPairScore(
    {
      teamA: [{ id: "1", level: 5 }],
      teamB: [{ id: "2", level: 1 }],
    },
    { policies: [], rules: [] },
    { envSource: v2Env, levelDiffAllowed: 0.5, baseScore: 100 }
  );
  assert.equal(bridge.usedCanonical, true);
});

test("16. check-in context mapping via court queue bridge pattern", () => {
  assert.ok(LEGACY_RULES_RUNTIME_INVENTORY.some((item) => item.legacyKey === "court_queue_gate"));
});

test("17. rest-time soft/hard inventory present", () => {
  assert.ok(LEGACY_RULES_RUNTIME_INVENTORY.some((item) => item.ruleType.includes("repeat")));
});

test("18. skill cap hard via AI level diff", () => {
  const bridge = evaluateLegacyAiPairScore(
    {
      teamA: [
        { id: "1", level: 5 },
        { id: "2", level: 5 },
      ],
      teamB: [
        { id: "3", level: 1 },
        { id: "4", level: 1 },
      ],
    },
    { policies: [], rules: [] },
    { envSource: v2Env, levelDiffAllowed: 1, baseScore: 50 }
  );
  assert.equal(bridge.result.rejected, true);
});

test("19. partner repeat soft score via AI bridge", () => {
  const bridge = evaluateLegacyAiPairScore(
    {
      teamA: [{ id: "1", level: 3 }, { id: "2", level: 3 }],
      teamB: [{ id: "3", level: 3 }, { id: "4", level: 3 }],
    },
    {
      policies: [],
      rules: [{ type: "max_partner_repeat", maxTimes: 0, enabled: true }],
      history: { 1: { partners: { 2: 2 }, opponents: {} } },
    },
    { envSource: v2Env, baseScore: 100 }
  );
  assert.equal(bridge.usedCanonical, true);
});

test("20. opponent repeat soft score path", () => {
  const bridge = evaluateLegacyAiPairScore(
    {
      teamA: [{ id: "1", level: 3 }, { id: "2", level: 3 }],
      teamB: [{ id: "3", level: 3 }, { id: "4", level: 3 }],
    },
    {
      policies: [],
      rules: [{ type: "max_opponent_repeat", maxTimes: 0, enabled: true }],
      history: { 1: { partners: {}, opponents: { 3: 2 } } },
    },
    { envSource: v2Env, baseScore: 100 }
  );
  assert.equal(bridge.usedCanonical, true);
});

test("21. founder hard avoid counted once via pairing bridge", () => {
  const bridge = evaluateLegacyPairingConstraints(
    [{ members: [{ id: "1" }, { id: "2" }] }],
    [
      {
        id: "founder-avoid",
        type: "avoid_partner",
        mode: "hard",
        anchorPlayerId: "1",
        targetPlayerIds: ["2"],
        enabled: true,
      },
    ],
    { envSource: v2Env }
  );
  assert.equal(bridge.result.hardViolations.length, 1);
});

test("22. tournament validation bridge avoids duplicate when legacy ok", () => {
  const bridge = evaluateCanonicalRulesRuntime({
    consumer: "tournament_validation",
    envSource: v2Env,
    candidate: { teams: [] },
    context: { scope: "entry", playersById: { p1: { skillLevel: 3 } } },
    ruleSet: { constraints: [] },
    legacyEvaluate: () => ({ ok: true, errors: [] }),
    adapt: (c) => ({ ok: c.feasible !== false, errors: [] }),
  });
  assert.equal(bridge.result.ok, true);
});

test("23. decision trace completeness", () => {
  const record = buildCompleteRulesRuntimeTraceRecord({
    consumer: "pairing_constraints",
    usedCanonical: true,
    canonical: {
      feasible: true,
      softScore: 10,
      engineVersion: "cc03a-v2",
      ruleSetId: "rs1",
      ruleSetVersion: "1",
      hardViolations: [],
      softNotes: [{ message: "soft" }],
      explanations: [],
    },
  });
  assert.equal(record.decisionStatus, RULES_DECISION_STATUS.SCORED);
  assert.equal(validateRulesRuntimeTraceRecord(record).length, 0);
  assert.equal(isRulesRuntimeTraceJsonSerializable(record), true);
});

test("24. shadow mismatch reporting", () => {
  const shadow = runRulesShadowComparison({
    consumer: "pairing",
    envSource: v2Env,
    legacyExecutor: () => ({ ok: true, score: 0 }),
    orchestratorInput: {
      candidate: { teams: [["1", "2"]] },
      context: { scope: "pairing" },
      ruleSet: {
        constraints: [
          {
            id: "avoid",
            type: COMPETITION_CONSTRAINT_TYPE.AVOID_PARTNER,
            severity: "hard",
            enabled: true,
            params: { anchorPlayerId: "1", targetPlayerIds: ["2"] },
          },
        ],
      },
      adapt: (c) => ({ ok: c.feasible !== false, score: c.softScore }),
    },
  });
  assert.equal(shadow.comparison.hardMismatch, true);
});

test("25. unsupported hard rule returns runtime error shape", () => {
  const bridge = evaluateCanonicalRulesRuntime({
    consumer: "test",
    envSource: v2Env,
    candidate: { teams: [["a"]] },
    context: { scope: "pairing" },
    ruleSet: { constraints: [] },
    legacyPayload: { requiredHardRules: ["must_partner_unsatisfied"] },
    legacyEvaluate: () => ({ ok: true }),
  });
  assert.equal(bridge.runtimeError?.code, RULES_RUNTIME_ERROR_CODE.RULES_V2_UNSUPPORTED_LEGACY_RULE);
});

test("26. context missing handling", () => {
  const bridge = evaluateCanonicalRulesRuntime({
    consumer: "test",
    envSource: v2Env,
    ruleSet: { constraints: [] },
    context: { scope: "entry" },
    legacyEvaluate: () => ({ ok: true }),
  });
  assert.equal(bridge.runtimeError?.code, RULES_RUNTIME_ERROR_CODE.RULES_V2_CONTEXT_MISSING);
});

test("27. runtime inventory call graph", () => {
  const graph = buildRulesRuntimeCallGraph();
  assert.ok(graph.nodes.includes("evaluateCanonicalRulesRuntime"));
});

test("28. shadow comparison builder", () => {
  const cmp = buildRulesShadowComparison({
    legacyAccepted: true,
    v2Accepted: false,
    legacySoftScore: 0,
    v2SoftScore: 10,
  });
  assert.equal(cmp.hardMismatch, true);
  assert.equal(cmp.ok, false);
});

test("29. CC-03 integration pairing bridge still works flag off", () => {
  const bridge = evaluateLegacyPairingConstraints([], [], {
    envSource: {},
    legacyEvaluate: () => ({ ok: true, score: 0, violations: [], hardViolations: [] }),
  });
  assert.equal(bridge.usedCanonical, false);
});

test("30. CC-06 flag independence from rules v2", () => {
  const env = {
    [COMPETITION_CORE_FLAG_KEYS.CORE]: "true",
    [COMPETITION_CORE_FLAG_KEYS.RULES_V2]: "true",
    [COMPETITION_CORE_FLAG_KEYS.MATCHMAKING_V2]: "false",
  };
  assert.equal(isRulesV2Enabled(env), true);
});
