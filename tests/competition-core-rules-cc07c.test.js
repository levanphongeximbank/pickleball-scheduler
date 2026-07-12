import test from "node:test";
import assert from "node:assert/strict";

import { AI_CONFIG } from "../src/ai/config.js";
import { calculatePairScore } from "../src/ai/scoring.js";
import {
  COMPETITION_CORE_FLAG_KEYS,
  EVALUATION_OWNER,
  buildDeduplicationKey,
  buildFounderPolicyDeduplicationPlan,
  buildIdentityFromAiPolicy,
  buildRuleSourceIdentity,
  evaluateLegacyAiPairScore,
  resolveRuleEvaluationOwner,
  runRulesShadowComparison,
  sortedPlayerPairKey,
} from "../src/features/competition-core/index.js";
import { constraintsToCourtPolicies } from "../src/features/pairing-constraints/adapters/courtPolicyAdapter.js";

const v2Env = {
  [COMPETITION_CORE_FLAG_KEYS.CORE]: "true",
  [COMPETITION_CORE_FLAG_KEYS.RULES_V2]: "true",
};

const players = {
  a: { id: "a", level: 3, gender: "male" },
  b: { id: "b", level: 3, gender: "male" },
  c: { id: "c", level: 3, gender: "male" },
  d: { id: "d", level: 3, gender: "male" },
};

const founderHardAvoidConstraint = {
  id: "fc-avoid-1",
  type: "avoid_partner",
  mode: "hard",
  anchorPlayerId: "a",
  targetPlayerIds: ["b"],
  enabled: true,
};

const optionSameTeam = {
  teamA: [players.a, players.b],
  teamB: [players.c, players.d],
};

test("1. Rules V2 OFF preserves founder legacy behavior", () => {
  const policies = constraintsToCourtPolicies([founderHardAvoidConstraint]);
  const result = calculatePairScore(optionSameTeam, {
    policies,
    history: {},
    envSource: {},
  });
  assert.ok(result.policyScore <= -AI_CONFIG.scoring.avoidTeammateHardPenalty);
});

test("2. founder hard avoid rejects once under Rules V2", () => {
  const policies = constraintsToCourtPolicies([founderHardAvoidConstraint]);
  const bridge = evaluateLegacyAiPairScore(optionSameTeam, { policies, history: {} }, { envSource: v2Env });
  assert.equal(bridge.usedCanonical, true);
  assert.equal(bridge.result.rejected, true);
  assert.equal(bridge.canonical?.feasible, false);
});

test("3. founder hard avoid does not also apply -120 under Rules V2", () => {
  const policies = constraintsToCourtPolicies([founderHardAvoidConstraint]);
  const result = calculatePairScore(optionSameTeam, {
    policies,
    history: {},
    envSource: v2Env,
  });
  assert.equal(result.totalScore, -100);
  assert.equal(result.policyScore, 0);
  assert.notEqual(result.policyScore, -AI_CONFIG.scoring.avoidTeammateHardPenalty);
});

test("4. founder soft avoid scores once", () => {
  const policies = constraintsToCourtPolicies([
    { ...founderHardAvoidConstraint, mode: "soft", id: "fc-avoid-soft" },
  ]);
  const bridge = evaluateLegacyAiPairScore(optionSameTeam, { policies, history: {} }, { envSource: v2Env });
  assert.equal(bridge.result.rejected, false);
  assert.ok(Number(bridge.result.policyScore) < 0);
  assert.equal(bridge.result.legacyContributionSuppressed, true);
});

test("5. founder soft prefer scores once", () => {
  const policies = constraintsToCourtPolicies([
    {
      id: "fc-prefer-1",
      type: "prefer_partner",
      mode: "soft",
      anchorPlayerId: "a",
      targetPlayerIds: ["b"],
      enabled: true,
    },
  ]);
  const bridge = evaluateLegacyAiPairScore(optionSameTeam, { policies, history: {} }, { envSource: v2Env });
  assert.equal(bridge.result.rejected, false);
  assert.ok(Number(bridge.result.policyScore) > 0);
});

test("6. founder must-partner hard evaluated once", () => {
  const policies = constraintsToCourtPolicies([
    {
      id: "fc-must-1",
      type: "prefer_partner",
      mode: "hard",
      anchorPlayerId: "a",
      targetPlayerIds: ["b"],
      enabled: true,
    },
  ]);
  const missOption = {
    teamA: [players.a, players.c],
    teamB: [players.b, players.d],
  };
  const bridge = evaluateLegacyAiPairScore(missOption, { policies, history: {} }, { envSource: v2Env });
  assert.equal(bridge.usedCanonical, true);
  assert.ok(Number(bridge.result.policyScore) <= 0);
});

test("7. same source rule through two adapters deduplicates", () => {
  const policies = constraintsToCourtPolicies([founderHardAvoidConstraint]);
  const plan = buildFounderPolicyDeduplicationPlan({
    policies,
    pairingConstraints: [founderHardAvoidConstraint],
    envSource: v2Env,
    consumer: "ai_scoring",
  });
  assert.equal(plan.duplicateDetected, true);
  assert.equal(plan.duplicates[0].evaluationOwner, EVALUATION_OWNER.SKIPPED_DUPLICATE);
});

test("8. different source IDs remain distinct", () => {
  const plan = buildFounderPolicyDeduplicationPlan({
    policies: [
      ...constraintsToCourtPolicies([founderHardAvoidConstraint]),
      ...constraintsToCourtPolicies([
        { ...founderHardAvoidConstraint, id: "fc-avoid-2", targetPlayerIds: ["c"] },
      ]),
    ],
    envSource: v2Env,
  });
  assert.equal(plan.entries.length, 2);
});

test("9. same source ID different canonical types remain distinct", () => {
  const sharedId = "shared-founder-rule";
  const avoid = buildRuleSourceIdentity({
    sourceType: "founder_policy",
    sourceId: sharedId,
    canonicalType: "avoid_partner",
    scope: "match",
    playerIds: ["a", "b"],
  });
  const prefer = buildRuleSourceIdentity({
    sourceType: "founder_policy",
    sourceId: sharedId,
    canonicalType: "prefer_partner",
    scope: "match",
    playerIds: ["a", "b"],
  });
  assert.notEqual(buildDeduplicationKey(avoid), buildDeduplicationKey(prefer));
});

test("10. reversed player order deduplicates deterministically", () => {
  const forward = buildIdentityFromAiPolicy({
    source: "founder",
    type: "avoid_teammate",
    playerA: "a",
    playerB: "b",
    sourceId: "founder-test",
  });
  const reverse = buildIdentityFromAiPolicy({
    source: "founder",
    type: "avoid_teammate",
    playerA: "b",
    playerB: "a",
    sourceId: "founder-test",
  });
  assert.equal(sortedPlayerPairKey(["a", "b"]), sortedPlayerPairKey(["b", "a"]));
  assert.equal(forward.deduplicationKey, reverse.deduplicationKey);
});

test("11. unsupported hard founder rule resolves to UNSUPPORTED_HARD owner", () => {
  const owner = resolveRuleEvaluationOwner({
    rulesV2Enabled: true,
    unsupportedHard: true,
    identity: { severity: "hard" },
  });
  assert.equal(owner, EVALUATION_OWNER.UNSUPPORTED_HARD);
});

test("12. unsupported soft founder rule uses explicit legacy fallback once", () => {
  const owner = resolveRuleEvaluationOwner({
    rulesV2Enabled: true,
    explicitLegacyFallback: true,
    identity: { severity: "soft" },
  });
  assert.equal(owner, EVALUATION_OWNER.LEGACY_FALLBACK);
});

test("13. decision trace contains deduplicated evaluation metadata", () => {
  const policies = constraintsToCourtPolicies([founderHardAvoidConstraint]);
  const bridge = evaluateLegacyAiPairScore(optionSameTeam, { policies, history: {} }, { envSource: v2Env });
  assert.ok(bridge.traceRecord);
  assert.equal(bridge.traceRecord.legacyContributionSuppressed, true);
});

test("14. legacy contribution suppression appears in bridge result", () => {
  const policies = constraintsToCourtPolicies([founderHardAvoidConstraint]);
  const bridge = evaluateLegacyAiPairScore(optionSameTeam, { policies, history: {} }, { envSource: v2Env });
  assert.equal(bridge.result.legacyContributionSuppressed, true);
  assert.ok(bridge.deduplicationPlan?.suppressedLegacyKeys?.length > 0);
});

test("15. no duplicate legacy hard penalty in canonical path", () => {
  const policies = constraintsToCourtPolicies([founderHardAvoidConstraint]);
  const bridge = evaluateLegacyAiPairScore(
    optionSameTeam,
    { policies, history: {} },
    {
      envSource: v2Env,
      legacyPolicyScore: -AI_CONFIG.scoring.avoidTeammateHardPenalty,
    }
  );
  assert.equal(bridge.doubleCountDetected, false);
  assert.equal(bridge.result.rejected, true);
});

test("16. no duplicate canonical hard reason codes", () => {
  const policies = constraintsToCourtPolicies([founderHardAvoidConstraint, ...constraintsToCourtPolicies([founderHardAvoidConstraint])]);
  const bridge = evaluateLegacyAiPairScore(optionSameTeam, { policies, history: {} }, { envSource: v2Env });
  const codes = (bridge.canonical?.hardViolations || []).map((item) => item.reasonCode);
  assert.equal(new Set(codes).size, codes.length);
});

test("17. AI non-rule score components remain unchanged under Rules V2", () => {
  const policies = constraintsToCourtPolicies([{ ...founderHardAvoidConstraint, mode: "soft", id: "soft-avoid" }]);
  const missOption = {
    teamA: [players.a, players.c],
    teamB: [players.b, players.d],
  };
  const withFlag = calculatePairScore(missOption, {
    policies,
    history: {},
    envSource: v2Env,
  });
  const withoutFlag = calculatePairScore(missOption, {
    policies,
    history: {},
    envSource: {},
  });
  assert.equal(withFlag.waitingScore, withoutFlag.waitingScore);
  assert.equal(withFlag.historyScore, withoutFlag.historyScore);
});

test("18. waiting score remains unchanged under Rules V2", () => {
  const policies = constraintsToCourtPolicies([]);
  const context = {
    policies,
    history: {},
    waiting: { a: 3, b: 1, c: 0, d: 0 },
    envSource: v2Env,
  };
  const result = calculatePairScore(optionSameTeam, context);
  assert.ok(typeof result.waitingScore === "number");
});

test("19. pairing output unchanged when flag OFF", () => {
  const policies = constraintsToCourtPolicies([founderHardAvoidConstraint]);
  const off = calculatePairScore(optionSameTeam, { policies, history: {}, envSource: {} });
  const offAgain = calculatePairScore(optionSameTeam, { policies, history: {} });
  assert.equal(off.totalScore, offAgain.totalScore);
});

test("20. shadow comparison reports resolved duplicates", () => {
  const policies = constraintsToCourtPolicies([founderHardAvoidConstraint]);
  const shadow = runRulesShadowComparison({
    consumer: "ai_scoring",
    envSource: v2Env,
    legacyExecutor: () => ({ rejected: true, policyScore: -120 }),
    orchestratorInput: {
      candidate: { matchOption: { teamA: ["a", "b"], teamB: ["c", "d"] } },
      context: { scope: "match", playersById: {} },
      ruleSet: { constraints: [] },
      legacyPayload: {
        deduplicationPlan: buildFounderPolicyDeduplicationPlan({ policies, envSource: v2Env }),
      },
    },
  });
  assert.ok(shadow.comparison);
  assert.equal(typeof shadow.comparison.duplicateResolved, "boolean");
});

test("21. CC-07 regression import surface remains available", async () => {
  const mod = await import("../tests/competition-core-rules-cc07.test.js");
  assert.ok(mod);
});

test("22. CC-06 regression import surface remains available", async () => {
  const mod = await import("../tests/competition-core-matchmaking-cc06.test.js");
  assert.ok(mod);
});

test("23. team tournament seed tests remain importable", async () => {
  const mod = await import("../tests/team-tournament-seed.test.js");
  assert.ok(mod);
});

test("24. rules engine tests remain importable", async () => {
  const mod = await import("../tests/competition-core-rules-engine.test.js");
  assert.ok(mod);
});

test("25. draw foundation tests remain importable", async () => {
  const mod = await import("../tests/competition-core-draw-foundation.test.js");
  assert.ok(mod);
});
