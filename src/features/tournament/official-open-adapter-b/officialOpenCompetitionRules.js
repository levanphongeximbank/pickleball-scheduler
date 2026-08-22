/**
 * Official/Open Adapter B — Canonical Competition Rules consumption.
 * Translation / compose only. ownsAuthority=false.
 */

import {
  competitionRulesPolicyGateway,
  COMPETITION_RULES_POLICY_GATEWAY_ID,
  COMPETITION_RULES_PROFILE_SCHEMA_V1,
  COMPETITION_RULES_CONTRACT_VERSION,
  COMPETITION_RULES_CAPABILITY_ID,
  CAPABILITY_STATE,
  resolveCapabilityState,
  resolveCrossGroupWildcardRankingDemand,
} from "../../competition-core/competition-rules/index.js";
import { buildOfficialOpenCompetitionRulesProfile } from "./buildOfficialOpenCompetitionRulesProfile.js";
import { BEST_OF_3_OPERATIONAL } from "../../individual-tournament/engines/officialTournamentSettingsEngine.js";
import { ADAPTER_B_STATUS, SHARED_CONTRACT_CAPABILITY_GAP } from "./constants.js";

/** Keep gap strings local to avoid circular import with live scoring binding. */
const SIDEOUT_DURABLE_GAP =
  "DURABLE_MATCH_LIVE_STATES_EDGE_REQUIRED — browser token path cannot write match_live_states (service_role only); serve state is CORE-16 session projection until Official scoring Edge host exists.";
const CHANGE_END_PARTIAL_GAP =
  "CORE-16 emits ENDS_SWITCH_MILESTONE hint on RALLY only; confirmChangeEnds / orientation ACK is competition-engine ops (not CORE-16 state). Official binds detection+session ACK only — not durable court orientation SSOT.";

const RANK = Object.freeze({
  [CAPABILITY_STATE.SUPPORTED]: 3,
  [CAPABILITY_STATE.PARTIAL]: 2,
  [CAPABILITY_STATE.DEFERRED]: 1,
  [CAPABILITY_STATE.UNSUPPORTED]: 0,
});

function weakerState(a, b) {
  const ra = RANK[a] ?? 0;
  const rb = RANK[b] ?? 0;
  return ra <= rb ? a : b;
}

/**
 * Official Adapter B → CORE-16 execution binding (not Adapter A truth).
 * EFFECTIVE = min(Adapter A, Official binding).
 *
 * Rally / Side-out / Win-by: CORE-16 commands wired via
 * officialOpenCore16LiveScoringBinding (translation only).
 * Change-end: PARTIAL (hint + session ACK; not CORE-16 state mutation).
 * BO3: hard stop this wave.
 */
export const OFFICIAL_CLASSIC_EXECUTION_BINDING = Object.freeze({
  [COMPETITION_RULES_CAPABILITY_ID.SCORING_METHOD_RALLY]: Object.freeze({
    policy: CAPABILITY_STATE.SUPPORTED,
    execution: CAPABILITY_STATE.SUPPORTED,
    bindingGap: false,
  }),
  [COMPETITION_RULES_CAPABILITY_ID.SCORING_METHOD_SIDE_OUT]: Object.freeze({
    policy: CAPABILITY_STATE.SUPPORTED,
    execution: CAPABILITY_STATE.SUPPORTED,
    // CORE-16 Side-out commands are wired; durable match_live_states Edge gap is
    // reported separately and does not block effectiveSelectable.
    bindingGap: false,
    durablePersistenceGap: true,
    bindingGapReason: SIDEOUT_DURABLE_GAP,
  }),
  [COMPETITION_RULES_CAPABILITY_ID.MATCH_SERIES_BEST_OF_1]: Object.freeze({
    policy: CAPABILITY_STATE.SUPPORTED,
    execution: CAPABILITY_STATE.SUPPORTED,
    bindingGap: false,
  }),
  [COMPETITION_RULES_CAPABILITY_ID.MATCH_SERIES_BEST_OF_3]: Object.freeze({
    policy: CAPABILITY_STATE.SUPPORTED,
    execution: BEST_OF_3_OPERATIONAL
      ? CAPABILITY_STATE.PARTIAL
      : CAPABILITY_STATE.UNSUPPORTED,
    bindingGap: !BEST_OF_3_OPERATIONAL,
    bindingGapReason:
      "Official classic completion uses single scoreA/scoreB — multi-game BO3 not bound.",
  }),
  [COMPETITION_RULES_CAPABILITY_ID.WIN_BY]: Object.freeze({
    policy: CAPABILITY_STATE.SUPPORTED,
    execution: CAPABILITY_STATE.SUPPORTED,
    bindingGap: false,
    bindingGapReason: null,
  }),
  [COMPETITION_RULES_CAPABILITY_ID.CHANGE_END]: Object.freeze({
    policy: CAPABILITY_STATE.SUPPORTED,
    execution: CAPABILITY_STATE.PARTIAL,
    bindingGap: true,
    bindingGapReason: CHANGE_END_PARTIAL_GAP,
  }),
  [COMPETITION_RULES_CAPABILITY_ID.CROSS_GROUP_WILDCARD_RANKING]: Object.freeze({
    policy: CAPABILITY_STATE.SUPPORTED,
    execution: CAPABILITY_STATE.DEFERRED,
    bindingGap: false,
    failClosed: true,
  }),
});

/**
 * @param {string} capabilityId
 */
export function resolveOfficialEffectiveCapability(capabilityId) {
  const shared = resolveCapabilityState(capabilityId);
  const binding = OFFICIAL_CLASSIC_EXECUTION_BINDING[capabilityId] || {
    policy: CAPABILITY_STATE.UNSUPPORTED,
    execution: CAPABILITY_STATE.UNSUPPORTED,
    bindingGap: true,
  };
  if (!shared.ok) {
    return {
      ...shared,
      officialBinding: binding,
      effectiveSelectable: false,
    };
  }
  const policy = weakerState(shared.policy, binding.policy);
  const execution = weakerState(shared.execution, binding.execution);
  const effectiveSelectable =
    policy === CAPABILITY_STATE.SUPPORTED &&
    (execution === CAPABILITY_STATE.SUPPORTED || execution === CAPABILITY_STATE.PARTIAL) &&
    binding.bindingGap !== true &&
    execution !== CAPABILITY_STATE.DEFERRED &&
    execution !== CAPABILITY_STATE.UNSUPPORTED;

  return Object.freeze({
    ok: true,
    capabilityId,
    sharedPolicy: shared.policy,
    sharedExecution: shared.execution,
    officialBinding: binding,
    policy,
    execution,
    effectiveSelectable,
    bindingGap: binding.bindingGap === true,
    bindingGapReason: binding.bindingGapReason || null,
    failClosed: binding.failClosed === true || execution === CAPABILITY_STATE.DEFERRED,
  });
}

export function createOfficialOpenCompetitionRulesSurface(deps = {}) {
  const gateway = deps.gateway || competitionRulesPolicyGateway;
  const tournament = deps.tournament || null;

  function buildProfile(input = {}) {
    return buildOfficialOpenCompetitionRulesProfile(tournament || input.tournament, {
      eventId: input.eventId,
      tenantId: input.tenantId || deps.tenantId,
      lifecycleEvidence: input.lifecycleEvidence,
    });
  }

  return Object.freeze({
    ownsAuthority: false,
    translationOnly: true,
    adapterAId: COMPETITION_RULES_POLICY_GATEWAY_ID,
    profileSchema: COMPETITION_RULES_PROFILE_SCHEMA_V1,
    contractVersion: COMPETITION_RULES_CONTRACT_VERSION,
    status: ADAPTER_B_STATUS.CANONICAL_BOUND,
    gapKind: SHARED_CONTRACT_CAPABILITY_GAP,
    buildProfile,
    validateProfile(input = {}) {
      const built = buildProfile(input);
      if (!built.ok) return built;
      return gateway.validateCompetitionRulesProfile({
        profile: built.profile,
        enforceExecutionCapability: false,
      });
    },
    resolveEffectiveRules(input = {}) {
      const built = buildProfile(input);
      if (!built.ok) return built;
      return gateway.resolveEffectiveCompetitionRules({
        profile: built.profile,
        stage: input.stage || null,
        ruleSource: input.ruleSource || "TOURNAMENT",
        enforceExecutionCapability: false,
      });
    },
    resolveStageMatchRules(input = {}) {
      const built = buildProfile(input);
      if (!built.ok) return built;
      return gateway.resolveStageMatchRules({
        profile: built.profile,
        stage: input.stage,
      });
    },
    deriveQualificationPlan(input = {}) {
      const built = buildProfile(input);
      if (!built.ok) return built;
      return gateway.deriveQualificationPlan({ profile: built.profile });
    },
    resolveTieBreakPolicy(input = {}) {
      const built = buildProfile(input);
      if (!built.ok) return built;
      return gateway.resolveTieBreakPolicy({ profile: built.profile });
    },
    resolveWildcardRankingPolicy(input = {}) {
      const built = buildProfile(input);
      if (!built.ok) return built;
      const demand = resolveCrossGroupWildcardRankingDemand(built.profile);
      const policy = gateway.resolveWildcardRankingPolicy({ profile: built.profile });
      if (demand.configured === true) {
        return Object.freeze({
          ...policy,
          ok: false,
          code: "CROSS_GROUP_WILDCARD_EXECUTION_DEFERRED",
          failClosed: true,
          demand,
          error:
            "Cross-group wildcard ranking POLICY=SUPPORTED nhưng EXECUTION=DEFERRED — fail closed trước qualification authoritative.",
        });
      }
      return Object.freeze({ ...policy, demand, failClosed: false });
    },
    resolveKnockoutEntryRound(input = {}) {
      const built = buildProfile(input);
      if (!built.ok) return built;
      const plan = gateway.deriveQualificationPlan({ profile: built.profile });
      const qualifierCount =
        input.qualifierCount != null
          ? Number(input.qualifierCount)
          : plan?.totalQualifiers ?? built.profile.knockout?.qualifierCount;
      return gateway.resolveKnockoutEntryRound({
        profile: built.profile,
        qualifierCount,
      });
    },
    canMutateCompetitionRule(input = {}) {
      const built = buildProfile(input);
      if (!built.ok) return built;
      return gateway.canMutateCompetitionRule({
        profile: built.profile,
        ruleClass: input.ruleClass,
        lifecycleMilestone: input.lifecycleMilestone,
      });
    },
    resolveRefereeRequirement(input = {}) {
      const built = buildProfile(input);
      if (!built.ok) return built;
      return gateway.resolveRefereeRequirement({
        profile: built.profile,
        stage: input.stage,
      });
    },
    resolveScheduleConstraints(input = {}) {
      const built = buildProfile(input);
      if (!built.ok) return built;
      return gateway.resolveScheduleConstraints({
        profile: built.profile,
        stage: input.stage,
      });
    },
    resolveCourtRequirement(input = {}) {
      const built = buildProfile(input);
      if (!built.ok) return built;
      return gateway.resolveCourtRequirement({ profile: built.profile });
    },
    resolvePublicationPolicy(input = {}) {
      const built = buildProfile(input);
      if (!built.ok) return built;
      return gateway.resolvePublicationPolicy({ profile: built.profile });
    },
    resolveCapability: resolveOfficialEffectiveCapability,
    resolveCapabilityTruthTable() {
      const ids = Object.values(COMPETITION_RULES_CAPABILITY_ID);
      const rows = {};
      for (const id of ids) {
        rows[id] = resolveOfficialEffectiveCapability(id);
      }
      return Object.freeze(rows);
    },
  });
}
