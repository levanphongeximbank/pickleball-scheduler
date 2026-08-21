/**
 * Canonical Competition Rules Contract — stable mode-agnostic API surface.
 * Internal Competition Platform contract — NOT Canonical Adapter Contract #17.
 */

import {
  COMPETITION_RULES_CONTRACT_ID,
  COMPETITION_RULES_CONTRACT_VERSION,
  COMPETITION_RULES_POLICY_GATEWAY_ID,
  COMPETITION_RULES_POLICY_GATEWAY_VERSION,
} from "../constants/versions.js";
import {
  getCompetitionRulesProfile,
  validateCompetitionRulesProfile,
  resolveEffectiveCompetitionRules,
  resolveStageMatchRules,
  deriveQualificationPlan,
  resolveTieBreakPolicy,
  resolveWildcardRankingPolicy,
  canMutateCompetitionRule,
  resolveCapabilityState,
  resolveProfileCapabilityState,
} from "../services/index.js";
import { deriveKnockoutEntryRound } from "../constants/enums.js";
import { createCompetitionRulesProfile } from "../domain/competitionRulesProfile.js";

/**
 * Resolve referee requirement for a stage from a profile.
 * @param {object} profileOrRaw
 * @param {string} stage
 */
export function resolveRefereeRequirement(profileOrRaw, stage) {
  const stageRules = resolveStageMatchRules(profileOrRaw, stage);
  if (!stageRules.ok) return stageRules;
  return Object.freeze({
    ok: true,
    stage: stageRules.stage,
    requirement: stageRules.refereeRequirement,
    fallbackPolicy: stageRules.refereeFallbackPolicy,
    assignmentOwner: "CORE-13",
    policyOwner: "competition-core.competition-rules",
  });
}

/**
 * Resolve court requirement policy (not court inventory / physical SSOT).
 *
 * COURT_REQUIREMENT_POLICY_OWNER = competition-core.competition-rules
 * COURT_ASSIGNMENT_EXECUTION_OWNER = CORE-12 (competition-core court-assignment)
 * PHYSICAL_COURT_SSOT_OWNER = 2.2_COURT_OPERATIONS (court-resource / physicalCourtId)
 * COURT_ADAPTER_A_ROLE = integration/projection boundary — not physical court SSOT
 *
 * Tenant != Venue. Venue / Facility / Court Cluster != Physical Court.
 *
 * @param {object} profileOrRaw
 * @param {string} [stage]
 */
export function resolveCourtRequirement(profileOrRaw, stage) {
  const profile = createCompetitionRulesProfile(profileOrRaw);
  const authority = Object.freeze({
    courtRequirementPolicyOwner: "competition-core.competition-rules",
    courtAssignmentExecutionOwner: "CORE-12",
    physicalCourtSsotOwner: "2.2_COURT_OPERATIONS",
    courtAdapterARole:
      "integration/projection boundary — not physical court SSOT",
    tenantIsNotVenue: true,
    venueAsTenantFallback: false,
  });
  if (stage) {
    const stageRules = resolveStageMatchRules(profile, stage);
    if (!stageRules.ok) return stageRules;
    return Object.freeze({
      ok: true,
      stage: stageRules.stage,
      courtRequirement: stageRules.courtRequirement,
      policyOwner: authority.courtRequirementPolicyOwner,
      ...authority,
    });
  }
  return Object.freeze({
    ok: true,
    courtRequirement: profile.courtRequirement,
    policyOwner: authority.courtRequirementPolicyOwner,
    ...authority,
  });
}

/**
 * @param {object} profileOrRaw
 * @param {string} [stage]
 */
export function resolveScheduleConstraints(profileOrRaw, stage) {
  const profile = createCompetitionRulesProfile(profileOrRaw);
  if (stage) {
    const stageRules = resolveStageMatchRules(profile, stage);
    if (!stageRules.ok) return stageRules;
    return Object.freeze({
      ok: true,
      stage: stageRules.stage,
      scheduleConstraints: stageRules.scheduleConstraints,
      scheduleExecutionOwner: "schedule-engine / CORE-11",
      policyOwner: "competition-core.competition-rules",
    });
  }
  return Object.freeze({
    ok: true,
    scheduleConstraints: profile.scheduleConstraints,
    scheduleExecutionOwner: "schedule-engine / CORE-11",
    policyOwner: "competition-core.competition-rules",
  });
}

/**
 * @param {object} profileOrRaw
 */
export function resolvePublicationPolicy(profileOrRaw) {
  const profile = createCompetitionRulesProfile(profileOrRaw);
  return Object.freeze({
    ok: true,
    publication: profile.publication,
    resultAcceptanceOwner: "CORE-17",
    policyOwner: "competition-core.competition-rules",
  });
}

/**
 * @param {number} qualifierCount
 */
export function resolveKnockoutEntryRound(qualifierCount) {
  const entryRound = deriveKnockoutEntryRound(qualifierCount);
  return Object.freeze({
    ok: entryRound != null,
    qualifierCount: Number(qualifierCount) || 0,
    entryRound,
  });
}

/**
 * Frozen contract descriptor (documentation + runtime identity).
 */
export const CANONICAL_COMPETITION_RULES_CONTRACT = Object.freeze({
  contractId: COMPETITION_RULES_CONTRACT_ID,
  contractVersion: COMPETITION_RULES_CONTRACT_VERSION,
  catalogContractNumber: null,
  isCanonicalAdapterCatalogContract: false,
  adapterAId: COMPETITION_RULES_POLICY_GATEWAY_ID,
  adapterAVersion: COMPETITION_RULES_POLICY_GATEWAY_VERSION,
  persistenceAuthority: false,
  executionAuthority: false,
  modeAgnostic: true,
  methods: Object.freeze([
    "getCompetitionRulesProfile",
    "validateCompetitionRulesProfile",
    "resolveEffectiveCompetitionRules",
    "resolveStageMatchRules",
    "deriveQualificationPlan",
    "resolveTieBreakPolicy",
    "resolveWildcardRankingPolicy",
    "resolveKnockoutEntryRound",
    "canMutateCompetitionRule",
    "resolveRefereeRequirement",
    "resolveCourtRequirement",
    "resolveScheduleConstraints",
    "resolvePublicationPolicy",
    "resolveCapabilityState",
    "resolveProfileCapabilityState",
  ]),
});

export const canonicalCompetitionRulesContractApi = Object.freeze({
  getCompetitionRulesProfile,
  validateCompetitionRulesProfile,
  resolveEffectiveCompetitionRules,
  resolveStageMatchRules,
  deriveQualificationPlan,
  resolveTieBreakPolicy,
  resolveWildcardRankingPolicy,
  resolveKnockoutEntryRound,
  canMutateCompetitionRule,
  resolveRefereeRequirement,
  resolveCourtRequirement,
  resolveScheduleConstraints,
  resolvePublicationPolicy,
  resolveCapabilityState,
  resolveProfileCapabilityState,
});
