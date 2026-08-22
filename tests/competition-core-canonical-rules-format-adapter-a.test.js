/**
 * Narrow technical sanity for Canonical Competition Rules & Format / Adapter A.
 * Not a certification campaign.
 */

import assert from "node:assert/strict";
import test from "node:test";

import {
  COMPETITION_RULES_POLICY_GATEWAY_ID,
  COMPETITION_RULES_POLICY_GATEWAY_VERSION,
  COMPETITION_RULES_STAGE,
  RULE_CLASS,
  LIFECYCLE_MILESTONE,
  MATCH_SERIES,
  SCORING_METHOD,
  CAPABILITY_STATE,
  COMPETITION_RULES_CAPABILITY_ID,
  createCompetitionRulesProfile,
  validateCompetitionRulesProfile,
  deriveQualificationPlan,
  resolveEffectiveCompetitionRules,
  resolveStageMatchRules,
  canMutateCompetitionRule,
  resolveCapabilityState,
  resolveProfileCapabilityState,
  resolveWildcardRankingPolicy,
  resolveCourtRequirement,
  createCompetitionRulesPolicyGateway,
  CANONICAL_COMPETITION_RULES_CONTRACT,
} from "../src/features/competition-core/competition-rules/index.js";

import {
  OFFICIAL_CONTRACT_COUNT,
} from "../src/features/competition-engine/integration/contracts/kernel/constants.js";

const baseProfile = {
  tenantId: "tenant-1",
  competitionId: "comp-1",
  matchScoring: {
    scoringMethod: SCORING_METHOD.RALLY,
    matchSeries: MATCH_SERIES.BEST_OF_1,
    targetPoints: 15,
    winCondition: {
      winByEnabled: true,
      winByMargin: 2,
      pointCapEnabled: true,
      pointCap: 21,
    },
    changeEnd: {
      changeEndsEnabled: false,
    },
  },
  stageOverrides: {
    GROUP: { targetPoints: 15 },
    QUARTERFINAL: { targetPoints: 15 },
    SEMIFINAL: { targetPoints: 21 },
    FINAL: { targetPoints: 21 },
  },
  groupStage: {
    groupStageEnabled: true,
    groupCount: 3,
  },
  qualification: {
    totalQualifiers: 8,
    directQualifiersPerGroup: 2,
  },
  knockout: {
    knockoutEnabled: true,
    qualifierCount: 8,
  },
};

/** Ordinary valid profile: no group stage → no cross-group wildcard demand. */
const noGroupStageProfile = {
  ...baseProfile,
  groupStage: {
    groupStageEnabled: false,
    groupCount: 1,
  },
  qualification: {
    totalQualifiers: 8,
    directQualifiersPerGroup: 0,
  },
  knockout: {
    knockoutEnabled: true,
    qualifierCount: 8,
  },
};

/** Group stage with exact direct fill → wildcardSlots=0. */
const zeroWildcardProfile = {
  ...baseProfile,
  groupStage: {
    groupStageEnabled: true,
    groupCount: 4,
  },
  qualification: {
    totalQualifiers: 8,
    directQualifiersPerGroup: 2,
  },
  knockout: {
    knockoutEnabled: true,
    qualifierCount: 8,
  },
};

test("Adapter A identity is internal gateway, not catalog #17", () => {
  assert.equal(COMPETITION_RULES_POLICY_GATEWAY_ID, "competition.rules.policy.gateway.v1");
  assert.equal(COMPETITION_RULES_POLICY_GATEWAY_VERSION, "1.1.0");
  assert.equal(CANONICAL_COMPETITION_RULES_CONTRACT.isCanonicalAdapterCatalogContract, false);
  assert.equal(CANONICAL_COMPETITION_RULES_CONTRACT.catalogContractNumber, null);
  assert.equal(OFFICIAL_CONTRACT_COUNT, 16);
});

test("deriveQualificationPlan: 3 groups × 2 direct, total 8 → 6 direct + 2 wildcard", () => {
  const plan = deriveQualificationPlan({
    groupCount: 3,
    totalQualifiers: 8,
    directQualifiersPerGroup: 2,
  });
  assert.equal(plan.ok, true);
  assert.equal(plan.directSlots, 6);
  assert.equal(plan.wildcardSlots, 2);
});

test("deriveQualificationPlan fails closed when directSlots exceed total", () => {
  const plan = deriveQualificationPlan({
    groupCount: 4,
    totalQualifiers: 4,
    directQualifiersPerGroup: 2,
  });
  assert.equal(plan.ok, false);
  assert.equal(plan.directSlots, undefined);
});

test("validateCompetitionRulesProfile accepts Owner example shape", () => {
  const result = validateCompetitionRulesProfile(baseProfile);
  assert.equal(result.ok, true);
  assert.equal(result.qualificationPlan.wildcardSlots, 2);
});

test("resolveStageMatchRules applies stage targetPoints", () => {
  const group = resolveStageMatchRules(baseProfile, COMPETITION_RULES_STAGE.GROUP);
  const final = resolveStageMatchRules(baseProfile, COMPETITION_RULES_STAGE.FINAL);
  assert.equal(group.ok, true);
  assert.equal(group.matchScoring.targetPoints, 15);
  assert.equal(final.matchScoring.targetPoints, 21);
  assert.equal(final.refereeRequirement, "REQUIRED");
});

test("lifecycle lock blocks scoring mutation after match start", () => {
  const locked = canMutateCompetitionRule({
    profile: baseProfile,
    ruleClass: RULE_CLASS.SCORING_FORMAT,
    lifecycleMilestone: LIFECYCLE_MILESTONE.AFTER_MATCH_START,
  });
  assert.equal(locked.allowed, false);
  assert.equal(locked.code, "COMPETITION_RULES_MUTATION_LOCKED");

  const open = canMutateCompetitionRule({
    profile: baseProfile,
    ruleClass: RULE_CLASS.SCORING_FORMAT,
    lifecycleMilestone: LIFECYCLE_MILESTONE.AFTER_GROUP_DRAW,
  });
  assert.equal(open.allowed, true);
});

test("capability truth: CHANGE_END policy SUPPORTED, execution PARTIAL", () => {
  const state = resolveCapabilityState(COMPETITION_RULES_CAPABILITY_ID.CHANGE_END);
  assert.equal(state.policy, CAPABILITY_STATE.SUPPORTED);
  assert.equal(state.execution, CAPABILITY_STATE.PARTIAL);
  assert.equal(state.fakeSupportCreated, false);
  assert.ok(state.executionCondition);
  assert.ok(Array.isArray(state.supportedRuntimePaths));
  assert.ok(Array.isArray(state.unsupportedOrHintOnlyPaths));
});

test("ordinary rules profile without wildcard requirement remains feasible", () => {
  const result = resolveEffectiveCompetitionRules(noGroupStageProfile);
  assert.equal(result.ok, true);
  assert.equal(result.feasible, true);
  assert.equal(result.qualificationPlan.wildcardSlots, 0);
  const cross = result.capability.features.find(
    (f) => f.capabilityId === COMPETITION_RULES_CAPABILITY_ID.CROSS_GROUP_WILDCARD_RANKING
  );
  assert.equal(cross.configured, false);
  assert.equal(result.capability.blockedConfigured.length, 0);
});

test("group stage with wildcardSlots=0 does not require cross-group execution", () => {
  const plan = deriveQualificationPlan({
    groupCount: 4,
    totalQualifiers: 8,
    directQualifiersPerGroup: 2,
    groupStageEnabled: true,
  });
  assert.equal(plan.wildcardSlots, 0);

  const result = resolveEffectiveCompetitionRules(zeroWildcardProfile);
  assert.equal(result.ok, true);
  assert.equal(result.feasible, true);
  assert.equal(result.qualificationPlan.wildcardSlots, 0);
  const cross = result.capability.features.find(
    (f) => f.capabilityId === COMPETITION_RULES_CAPABILITY_ID.CROSS_GROUP_WILDCARD_RANKING
  );
  assert.equal(cross.configured, false);
});

test("wildcard demand + supported execution remains feasible", () => {
  const result = resolveEffectiveCompetitionRules(baseProfile);
  assert.equal(result.ok, true);
  assert.equal(result.qualificationPlan.wildcardSlots, 2);
  assert.equal(result.feasible, true);
  const cross = result.capability.features.find(
    (f) => f.capabilityId === COMPETITION_RULES_CAPABILITY_ID.CROSS_GROUP_WILDCARD_RANKING
  );
  assert.equal(cross.configured, true);
  assert.equal(cross.execution, CAPABILITY_STATE.SUPPORTED);
  assert.equal(
    result.capability.blockedConfigured.some(
      (f) =>
        f.capabilityId === COMPETITION_RULES_CAPABILITY_ID.CROSS_GROUP_WILDCARD_RANKING
    ),
    false
  );

  const policyOnly = resolveWildcardRankingPolicy(baseProfile);
  assert.equal(policyOnly.ok, true);
  assert.equal(policyOnly.policyRepresentable, true);
  assert.equal(policyOnly.executionAvailable, true);

  const execRequest = resolveWildcardRankingPolicy(baseProfile, {
    requestAuthoritativeRanking: true,
  });
  assert.equal(execRequest.ok, true);
  assert.equal(execRequest.authoritativeRankingAvailable, true);

  const enforced = validateCompetitionRulesProfile(baseProfile, {
    enforceExecutionCapability: true,
  });
  assert.equal(enforced.ok, true);
});

test("default crossGroupRanking schema alone does not configure capability", () => {
  const profile = createCompetitionRulesProfile(noGroupStageProfile);
  assert.ok(Array.isArray(profile.crossGroupRanking.criteria));
  assert.ok(profile.crossGroupRanking.criteria.length > 0);
  const cap = resolveProfileCapabilityState(profile);
  const cross = cap.features.find(
    (f) => f.capabilityId === COMPETITION_RULES_CAPABILITY_ID.CROSS_GROUP_WILDCARD_RANKING
  );
  assert.equal(cross.configured, false);
});

test("court authority metadata separates policy, assignment, and physical SSOT", () => {
  const court = resolveCourtRequirement(baseProfile);
  assert.equal(court.ok, true);
  assert.equal(court.courtRequirementPolicyOwner, "competition-core.competition-rules");
  assert.equal(court.courtAssignmentExecutionOwner, "CORE-12");
  assert.equal(court.physicalCourtSsotOwner, "2.2_COURT_OPERATIONS");
  assert.match(court.courtAdapterARole, /not physical court SSOT/i);
  assert.equal(court.tenantIsNotVenue, true);

  const stage = resolveStageMatchRules(baseProfile, COMPETITION_RULES_STAGE.FINAL);
  assert.equal(stage.executionOwners.courtAssignment, "CORE-12");
  assert.equal(stage.executionOwners.physicalCourtSsot, "2.2_COURT_OPERATIONS");
  assert.equal(stage.policyOwners.courtRequirement, "competition-core.competition-rules");
  assert.equal(stage.executionOwners.court, undefined);
});

test("Adapter A gateway resolves effective rules and rejects mode keys", () => {
  const gateway = createCompetitionRulesPolicyGateway();
  assert.equal(gateway.modeAgnostic, true);
  assert.equal(gateway.persistenceAuthority, false);
  assert.equal(gateway.executionAuthority, false);
  assert.equal(gateway.isCatalogContract17, false);

  const effective = gateway.resolveEffectiveCompetitionRules({
    profile: zeroWildcardProfile,
    stage: COMPETITION_RULES_STAGE.SEMIFINAL,
  });
  assert.equal(effective.ok, true);
  assert.equal(effective.feasible, true);
  assert.equal(effective.qualificationPlan.wildcardSlots, 0);
  assert.equal(effective.stageRules.matchScoring.targetPoints, 21);
  assert.equal(effective.engineComposition.parallelRuleEngine, false);

  const forbidden = gateway.getCompetitionRulesProfile({
    profile: baseProfile,
    officialUi: true,
  });
  assert.equal(forbidden.ok, false);
  assert.equal(forbidden.code, "COMPETITION_RULES_MODE_LOGIC_FORBIDDEN");

  assert.equal(gateway.assignReferee().ok, false);
  assert.equal(gateway.scoreMatch().ok, false);
  assert.equal(gateway.acceptResult().ok, false);

  const rankingOk = gateway.resolveWildcardRankingPolicy({
    profile: baseProfile,
    requestAuthoritativeRanking: true,
  });
  assert.equal(rankingOk.ok, true);
  assert.equal(rankingOk.executionAvailable, true);
});

test("createCompetitionRulesProfile is deterministic for identical input", () => {
  const a = createCompetitionRulesProfile(baseProfile);
  const b = createCompetitionRulesProfile(baseProfile);
  assert.deepEqual(a, b);
});

test("resolveEffectiveCompetitionRules composes CORE-01 without parallel engine", () => {
  const result = resolveEffectiveCompetitionRules(zeroWildcardProfile, {
    stage: "FINAL",
    ruleSource: "TOURNAMENT",
  });
  assert.equal(result.ok, true);
  assert.equal(result.feasible, true);
  assert.equal(result.authority.core01.reused, true);
  assert.equal(result.engineComposition.parallelRuleEngine, false);
  assert.equal(result.engineComposition.scoringExecution, "CORE-16");
});

test("frozen catalog remains exactly 16 contracts", () => {
  assert.equal(OFFICIAL_CONTRACT_COUNT, 16);
  assert.equal(CANONICAL_COMPETITION_RULES_CONTRACT.catalogContractNumber, null);
});
