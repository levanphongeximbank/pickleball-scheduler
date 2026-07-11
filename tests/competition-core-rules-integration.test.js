import test from "node:test";
import assert from "node:assert/strict";

import {
  COMPETITION_CORE_FLAG_KEYS,
  COMPETITION_CONSTRAINT_TYPE,
  evaluateLegacyAiPairScore,
  evaluateLegacyPairingConstraints,
  isConstraintsV2Enabled,
  isRulesV2Enabled,
  resolveRulesV2Flag,
} from "../src/features/competition-core/index.js";

const v2EnvRules = {
  [COMPETITION_CORE_FLAG_KEYS.CORE]: "true",
  [COMPETITION_CORE_FLAG_KEYS.RULES_V2]: "true",
};

const v2EnvAlias = {
  [COMPETITION_CORE_FLAG_KEYS.CORE]: "true",
  [COMPETITION_CORE_FLAG_KEYS.CONSTRAINTS_V2]: "true",
};

test("RULES_V2 canonical flag takes precedence over CONSTRAINTS_V2 alias", () => {
  const resolved = resolveRulesV2Flag({
    [COMPETITION_CORE_FLAG_KEYS.RULES_V2]: "false",
    [COMPETITION_CORE_FLAG_KEYS.CONSTRAINTS_V2]: "true",
  });
  assert.equal(resolved.source, "rules_v2");
  assert.equal(resolved.enabled, false);
  assert.equal(isRulesV2Enabled(v2EnvRules), true);
  assert.equal(isConstraintsV2Enabled(v2EnvAlias), true);
});

test("flag OFF uses legacy pairing evaluator via bridge fallback", () => {
  const teams = [{ members: [{ id: "1" }, { id: "2" }] }];
  const constraints = [
    {
      id: "avoid",
      type: COMPETITION_CONSTRAINT_TYPE.AVOID_PARTNER,
      mode: "hard",
      anchorPlayerId: "1",
      targetPlayerIds: ["2"],
      enabled: true,
    },
  ];

  const bridge = evaluateLegacyPairingConstraints(teams, constraints, {
    envSource: {},
    legacyEvaluate: () => ({
      score: 0,
      violations: [{ message: "legacy" }],
      satisfied: [],
      hardViolations: [{ message: "legacy" }],
      ok: false,
    }),
  });

  assert.equal(bridge.usedCanonical, false);
  assert.equal(bridge.result.ok, false);
});

test("flag ON pairing bridge rejects hard avoid on same team", () => {
  const teams = [{ members: [{ id: "1" }, { id: "2" }] }];
  const constraints = [
    {
      id: "avoid",
      type: "avoid_partner",
      mode: "hard",
      anchorPlayerId: "1",
      targetPlayerIds: ["2"],
      enabled: true,
    },
  ];

  const bridge = evaluateLegacyPairingConstraints(teams, constraints, {
    envSource: v2EnvRules,
  });

  assert.equal(bridge.usedCanonical, true);
  assert.equal(bridge.result.ok, false);
  assert.equal(bridge.trace.records.length, 1);
  assert.equal(bridge.trace.records[0].action, "reject");
});

test("flag ON AI bridge rejects hard level diff via canonical skill cap", () => {
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
    {
      envSource: v2EnvRules,
      levelDiffAllowed: 0.5,
    }
  );

  assert.equal(bridge.usedCanonical, true);
  assert.equal(bridge.result.rejected, true);
  assert.equal(bridge.result.totalScore, -100);
});

test("flag OFF AI bridge preserves legacyEvaluate path", () => {
  const bridge = evaluateLegacyAiPairScore(
    { teamA: [{ id: "1" }], teamB: [{ id: "2" }] },
    {},
    {
      envSource: {},
      legacyEvaluate: () => ({ totalScore: 42 }),
    }
  );

  assert.equal(bridge.usedCanonical, false);
  assert.equal(bridge.result.totalScore, 42);
});
